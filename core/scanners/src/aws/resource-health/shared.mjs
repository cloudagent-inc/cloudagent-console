import {
  CloudWatchLogsClient,
  StartQueryCommand,
  GetQueryResultsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import AWS from "aws-sdk";
import { toAwsSdkV2Credentials } from "../../shared/aws-access.mjs";
import { DEFAULT_REGION } from "../discovery/shared.mjs";

export const HEALTH_STATUS = Object.freeze({
  HEALTHY: "healthy",
  PROBLEM: "problem",
  UNKNOWN: "unknown",
  ERROR: "error",
  NOT_APPLICABLE: "not_applicable",
});

export const DEFAULT_LOOKBACK_HOURS = 24 * 5;
const LOG_QUERY_MAX_POLLS = 15;
const LOG_QUERY_POLL_MS = 750;
const CLOUDWATCH_MAX_DATAPOINTS = 1440;
const CLOUDWATCH_DATAPOINT_BUFFER = 1;
const CLOUDWATCH_MIN_STANDARD_PERIOD_SECONDS = 60;

export function safeTrim(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function isLikelyNotFoundError(input) {
  const text = String(input || "").toLowerCase();
  if (!text) return false;
  return (
    text.includes("not found") ||
    text.includes("does not exist") ||
    text.includes("no such") ||
    text.includes("resource not found") ||
    text.includes("cannot be found") ||
    text.includes("no such entity") ||
    text.includes("notfound") ||
    text.includes("missing")
  );
}

export function parseAwsArn(arn) {
  const input = safeTrim(arn);
  if (!input.startsWith("arn:")) return null;
  const parts = input.split(":");
  if (parts.length < 6) return null;
  return {
    arn: input,
    partition: parts[1] || "",
    service: parts[2] || "",
    region: parts[3] || "",
    accountId: parts[4] || "",
    resource: parts.slice(5).join(":") || "",
  };
}

export function coerceLookbackHours(input, fallback = DEFAULT_LOOKBACK_HOURS) {
  const asNumber = Number(input);
  if (!Number.isFinite(asNumber) || asNumber <= 0) return fallback;
  return Math.min(Math.floor(asNumber), 24 * 30);
}

export function getSafeCloudWatchPeriodSeconds({
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
  requestedPeriodSeconds = 300,
} = {}) {
  const normalizedLookbackHours = coerceLookbackHours(lookbackHours);
  const lookbackSeconds = Math.max(1, normalizedLookbackHours * 60 * 60);
  const effectiveDatapointLimit = Math.max(
    1,
    CLOUDWATCH_MAX_DATAPOINTS - CLOUDWATCH_DATAPOINT_BUFFER
  );
  const periodFromLimit = Math.ceil(lookbackSeconds / effectiveDatapointLimit);
  const requestedPeriod = Number(requestedPeriodSeconds);
  const minimumPeriod = Number.isFinite(requestedPeriod) && requestedPeriod > 0
    ? Math.floor(requestedPeriod)
    : 300;

  const effectivePeriod = Math.max(
    minimumPeriod,
    periodFromLimit,
    CLOUDWATCH_MIN_STANDARD_PERIOD_SECONDS
  );

  return (
    Math.ceil(effectivePeriod / CLOUDWATCH_MIN_STANDARD_PERIOD_SECONDS) *
    CLOUDWATCH_MIN_STANDARD_PERIOD_SECONDS
  );
}

export function normalizeHealthCheckResources(resources = []) {
  if (!Array.isArray(resources)) return [];
  return resources
    .map((resource, index) => {
      const resourceType = safeTrim(resource?.resourceType);
      const rawArn = safeTrim(resource?.resourceArn);
      const rawIdentifier =
        safeTrim(resource?.identifier) ||
        safeTrim(resource?.resourceId) ||
        rawArn;
      const parsedArn = parseAwsArn(rawArn || rawIdentifier);
      const resourceArn = rawArn || (parsedArn ? parsedArn.arn : "");
      const region = safeTrim(resource?.region) || parsedArn?.region || DEFAULT_REGION;
      const accountId = safeTrim(resource?.accountId) || parsedArn?.accountId || "";
      const resourceId = safeTrim(resource?.resourceId) || (!parsedArn ? rawIdentifier : "");
      const displayName = safeTrim(resource?.displayName) || rawIdentifier;
      const identifier = rawIdentifier || resourceArn || resourceId;
      if (!resourceType || !identifier) return null;

      return {
        index,
        targetKey: `${resourceType}|${identifier}|${region}`,
        resourceType,
        identifier,
        resourceArn: resourceArn || null,
        resourceId: resourceId || null,
        region,
        accountId,
        displayName,
      };
    })
    .filter(Boolean);
}

export function createCheckResult({
  checkId,
  checkName,
  category,
  status,
  summary,
  details = {},
  checkedAt,
}) {
  return {
    checkId,
    checkName,
    category,
    status,
    summary,
    details,
    checkedAt: checkedAt || new Date().toISOString(),
  };
}

export function createResourceResult({ target, checks = [], errors = [] }) {
  return {
    targetKey: target.targetKey,
    resourceType: target.resourceType,
    identifier: target.identifier,
    resourceArn: target.resourceArn,
    resourceId: target.resourceId,
    region: target.region,
    accountId: target.accountId,
    displayName: target.displayName,
    checks,
    errors,
  };
}

export function getOrCreateClient(cache, key, factory) {
  if (cache.has(key)) return cache.get(key);
  const client = factory();
  cache.set(key, client);
  return client;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getArnResourceId(resourceArn, expectedPrefix) {
  const parsed = parseAwsArn(resourceArn);
  if (!parsed?.resource) return "";
  const [prefix, value] = parsed.resource.split("/");
  if (!value) return "";
  if (expectedPrefix && prefix !== expectedPrefix) return "";
  return value;
}

export function extractCidrMask(cidrBlock) {
  const cidr = safeTrim(cidrBlock);
  if (!cidr.includes("/")) return null;
  const suffix = cidr.split("/")[1];
  const mask = Number(suffix);
  if (!Number.isInteger(mask) || mask < 0 || mask > 32) return null;
  return mask;
}

function parseLogsInsightsCount(results) {
  if (!Array.isArray(results) || results.length === 0) return 0;
  for (const row of results) {
    if (!Array.isArray(row)) continue;
    const match = row.find((entry) => entry?.field === "matchCount");
    if (!match) continue;
    const value = Number(match?.value);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

export async function queryLogGroupsForErrorKeywords({
  region,
  credentials,
  logGroupNames = [],
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
  logger,
  clientCache,
}) {
  const names = [...new Set(logGroupNames.map(safeTrim).filter(Boolean))].slice(0, 50);
  if (names.length === 0) {
    return { status: "skipped", matchCount: 0 };
  }

  const cache = clientCache || new Map();
  const key = `logs:${region}`;
  const client = getOrCreateClient(cache, key, () => {
    const config = { region, maxAttempts: 5, retryMode: "standard" };
    if (credentials) config.credentials = credentials;
    return new CloudWatchLogsClient(config);
  });

  const nowMs = Date.now();
  const startMs = nowMs - coerceLookbackHours(lookbackHours) * 60 * 60 * 1000;
  const queryString =
    "fields @message | filter @message like /(?i)(error|fail|failed|exception|timeout|panic|critical)/ | stats count(*) as matchCount";

  const startResponse = await client.send(
    new StartQueryCommand({
      logGroupNames: names,
      startTime: Math.floor(startMs / 1000),
      endTime: Math.floor(nowMs / 1000),
      queryString,
    })
  );

  const queryId = startResponse?.queryId;
  if (!queryId) {
    throw new Error("CloudWatchLogs StartQuery did not return a queryId");
  }

  for (let attempt = 0; attempt < LOG_QUERY_MAX_POLLS; attempt += 1) {
    const response = await client.send(new GetQueryResultsCommand({ queryId }));
    const status = response?.status || "Unknown";
    if (status === "Complete") {
      return {
        status,
        matchCount: parseLogsInsightsCount(response?.results),
      };
    }
    if (["Cancelled", "Failed", "Timeout", "Unknown"].includes(status)) {
      logger?.warn?.("[resource-health] CloudWatch Logs Insights query ended unexpectedly", {
        status,
        queryId,
        region,
      });
      throw new Error(`CloudWatch Logs Insights query ${status.toLowerCase()}`);
    }
    await sleep(LOG_QUERY_POLL_MS);
  }

  throw new Error("CloudWatch Logs Insights query timed out while polling for completion");
}

function getCloudWatchClient({ region, credentials, clientCache }) {
  const cache = clientCache || new Map();
  const key = `cw:${region}`;
  if (cache.has(key)) return cache.get(key);
  const client = new AWS.CloudWatch({
    region,
    ...(credentials ? { credentials: toAwsSdkV2Credentials(credentials) } : {}),
  });
  cache.set(key, client);
  return client;
}

export async function getCloudWatchMetricSum({
  region,
  credentials,
  namespace,
  metricName,
  dimensions = [],
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
  statistic = "Sum",
  periodSeconds = 300,
  clientCache,
}) {
  const values = await getCloudWatchMetricValues({
    region,
    credentials,
    namespace,
    metricName,
    dimensions,
    lookbackHours,
    statistic,
    periodSeconds,
    clientCache,
  });

  let total = 0;
  for (const value of values) {
    if (Number.isFinite(value)) total += value;
  }
  return total;
}

export async function getCloudWatchMetricValues({
  region,
  credentials,
  namespace,
  metricName,
  dimensions = [],
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
  statistic = "Sum",
  periodSeconds = 300,
  clientCache,
}) {
  const client = getCloudWatchClient({ region, credentials, clientCache });
  const normalizedLookbackHours = coerceLookbackHours(lookbackHours);
  const effectivePeriodSeconds = getSafeCloudWatchPeriodSeconds({
    lookbackHours: normalizedLookbackHours,
    requestedPeriodSeconds: periodSeconds,
  });
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - normalizedLookbackHours * 60 * 60 * 1000);
  const response = await client
    .getMetricStatistics({
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: dimensions,
      StartTime: startTime,
      EndTime: endTime,
      Period: effectivePeriodSeconds,
      Statistics: [statistic],
    })
    .promise();

  const points = Array.isArray(response?.Datapoints) ? response.Datapoints : [];
  return points
    .map((point) => Number(point?.[statistic]))
    .filter((value) => Number.isFinite(value));
}
