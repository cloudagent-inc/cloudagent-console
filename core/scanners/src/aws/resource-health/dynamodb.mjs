import { DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import {
  DEFAULT_LOOKBACK_HOURS,
  HEALTH_STATUS,
  createCheckResult,
  createResourceResult,
  getCloudWatchMetricSum,
  getOrCreateClient,
  safeTrim,
} from "./shared.mjs";

const DYNAMODB_CHECK_IDS = Object.freeze({
  TABLE_STATUS: "dynamodb.table.status",
  THROTTLED_REQUESTS: "dynamodb.table.throttled_requests",
  SYSTEM_ERRORS: "dynamodb.table.system_errors",
  USER_ERRORS: "dynamodb.table.user_errors",
});

export const DYNAMODB_SUPPORTED_RESOURCE_TYPES = Object.freeze(["AWS::DynamoDB::Table"]);

function createDynamoDbClient(region, credentials) {
  const config = { region, maxAttempts: 5, retryMode: "standard" };
  if (credentials) config.credentials = credentials;
  return new DynamoDBClient(config);
}

function parseTableName(target) {
  const arn = safeTrim(target.resourceArn || target.identifier);
  if (arn.startsWith("arn:") && arn.includes(":table/")) {
    return arn.split(":table/")[1]?.split("/")[0] || "";
  }
  return safeTrim(target.resourceId || target.identifier);
}

async function fetchTable({ target, credentials, clientCache }) {
  const tableName = parseTableName(target);
  if (!tableName) throw new Error("DynamoDB table identifier is required");
  const key = `dynamodb:${target.region}`;
  const client = getOrCreateClient(clientCache, key, () =>
    createDynamoDbClient(target.region, credentials)
  );
  const response = await client.send(new DescribeTableCommand({ TableName: tableName }));
  const table = response?.Table;
  if (!table) throw new Error("DynamoDB table not found");
  return { tableName, table };
}

function checkTableStatus({ table }) {
  const statusValue = safeTrim(table?.TableStatus);
  const status = statusValue === "ACTIVE" ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.PROBLEM;
  return createCheckResult({
    checkId: DYNAMODB_CHECK_IDS.TABLE_STATUS,
    checkName: "Table status",
    category: "availability",
    status,
    summary:
      status === HEALTH_STATUS.HEALTHY
        ? "DynamoDB table status is ACTIVE."
        : `DynamoDB table status is ${statusValue || "unknown"}.`,
    details: {
      tableStatus: statusValue || null,
      tableArn: table?.TableArn || null,
    },
  });
}

async function checkMetricZeroIsHealthy({
  checkId,
  checkName,
  metricName,
  tableName,
  region,
  credentials,
  lookbackHours,
  cloudWatchClientCache,
}) {
  try {
    const metricSum = await getCloudWatchMetricSum({
      region,
      credentials,
      namespace: "AWS/DynamoDB",
      metricName,
      dimensions: [{ Name: "TableName", Value: tableName }],
      lookbackHours,
      statistic: "Sum",
      clientCache: cloudWatchClientCache,
    });
    const status = metricSum > 0 ? HEALTH_STATUS.PROBLEM : HEALTH_STATUS.HEALTHY;
    return createCheckResult({
      checkId,
      checkName,
      category: "errors",
      status,
      summary:
        status === HEALTH_STATUS.HEALTHY
          ? `${metricName} is 0 in the last ${lookbackHours}h.`
          : `${metricName} is ${metricSum} in the last ${lookbackHours}h.`,
      details: { tableName, metricName, metricSum, lookbackHours },
    });
  } catch (error) {
    return createCheckResult({
      checkId,
      checkName,
      category: "errors",
      status: HEALTH_STATUS.ERROR,
      summary: `CloudWatch metric query failed: ${error?.message || "unknown error"}.`,
      details: { tableName, metricName, lookbackHours },
    });
  }
}

function buildCheckError({ checkId, checkName, category, summary }) {
  return createCheckResult({
    checkId,
    checkName,
    category,
    status: HEALTH_STATUS.ERROR,
    summary,
  });
}

async function evaluateDynamoDbTable({ target, credentials, lookbackHours, caches }) {
  const checks = [];
  const errors = [];
  try {
    const { tableName, table } = await fetchTable({
      target,
      credentials,
      clientCache: caches.dynamoClientCache,
    });
    checks.push(checkTableStatus({ table }));
    checks.push(
      await checkMetricZeroIsHealthy({
        checkId: DYNAMODB_CHECK_IDS.THROTTLED_REQUESTS,
        checkName: "Throttled requests",
        metricName: "ThrottledRequests",
        tableName,
        region: target.region,
        credentials,
        lookbackHours,
        cloudWatchClientCache: caches.cloudWatchClientCache,
      })
    );
    checks.push(
      await checkMetricZeroIsHealthy({
        checkId: DYNAMODB_CHECK_IDS.SYSTEM_ERRORS,
        checkName: "System errors",
        metricName: "SystemErrors",
        tableName,
        region: target.region,
        credentials,
        lookbackHours,
        cloudWatchClientCache: caches.cloudWatchClientCache,
      })
    );
    checks.push(
      await checkMetricZeroIsHealthy({
        checkId: DYNAMODB_CHECK_IDS.USER_ERRORS,
        checkName: "User errors",
        metricName: "UserErrors",
        tableName,
        region: target.region,
        credentials,
        lookbackHours,
        cloudWatchClientCache: caches.cloudWatchClientCache,
      })
    );
  } catch (error) {
    const message = error?.message || "Unable to evaluate DynamoDB table checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: DYNAMODB_CHECK_IDS.TABLE_STATUS,
        checkName: "Table status",
        category: "availability",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: DYNAMODB_CHECK_IDS.THROTTLED_REQUESTS,
        checkName: "Throttled requests",
        category: "errors",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: DYNAMODB_CHECK_IDS.SYSTEM_ERRORS,
        checkName: "System errors",
        category: "errors",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: DYNAMODB_CHECK_IDS.USER_ERRORS,
        checkName: "User errors",
        category: "errors",
        summary: message,
      })
    );
  }

  return createResourceResult({ target, checks, errors });
}

export async function runDynamoDbHealthChecks({
  resources = [],
  credentials,
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
} = {}) {
  const caches = {
    dynamoClientCache: new Map(),
    cloudWatchClientCache: new Map(),
  };
  const results = [];
  for (const target of resources) {
    if (target.resourceType !== "AWS::DynamoDB::Table") continue;
    results.push(
      await evaluateDynamoDbTable({
        target,
        credentials,
        lookbackHours,
        caches,
      })
    );
  }
  return results;
}
