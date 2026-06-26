import { runEc2HealthChecks, EC2_SUPPORTED_RESOURCE_TYPES } from "./ec2.mjs";
import { runEcsHealthChecks, ECS_SUPPORTED_RESOURCE_TYPES } from "./ecs.mjs";
import { runLambdaHealthChecks, LAMBDA_SUPPORTED_RESOURCE_TYPES } from "./lambda.mjs";
import { runDynamoDbHealthChecks, DYNAMODB_SUPPORTED_RESOURCE_TYPES } from "./dynamodb.mjs";
import { runAppSyncHealthChecks, APPSYNC_SUPPORTED_RESOURCE_TYPES } from "./appsync.mjs";
import { runDatabaseHealthChecks, DATABASE_SUPPORTED_RESOURCE_TYPES } from "./database.mjs";
import { runOtherAwsHealthChecks, OTHER_SUPPORTED_RESOURCE_TYPES } from "./other.mjs";
import {
  coerceLookbackHours,
  createResourceResult,
  normalizeHealthCheckResources,
} from "./shared.mjs";

const RESOURCE_TYPE_SERVICE_MAP = Object.freeze(
  new Map([
    ...EC2_SUPPORTED_RESOURCE_TYPES.map((resourceType) => [resourceType, "ec2"]),
    ...ECS_SUPPORTED_RESOURCE_TYPES.map((resourceType) => [resourceType, "ecs"]),
    ...LAMBDA_SUPPORTED_RESOURCE_TYPES.map((resourceType) => [resourceType, "lambda"]),
    ...DYNAMODB_SUPPORTED_RESOURCE_TYPES.map((resourceType) => [resourceType, "dynamodb"]),
    ...APPSYNC_SUPPORTED_RESOURCE_TYPES.map((resourceType) => [resourceType, "appsync"]),
    ...DATABASE_SUPPORTED_RESOURCE_TYPES.map((resourceType) => [resourceType, "database"]),
    ...OTHER_SUPPORTED_RESOURCE_TYPES.map((resourceType) => [resourceType, "other"]),
  ])
);

export const AWS_IMPLEMENTED_HEALTH_RESOURCE_TYPES = Object.freeze(
  [...RESOURCE_TYPE_SERVICE_MAP.keys()].sort()
);

function normalizeSummaryStatus(status) {
  const normalized = typeof status === "string" ? status.toLowerCase().trim() : "";
  if (normalized === "healthy") return "healthy";
  if (normalized === "problem" || normalized === "error") return "unhealthy";
  if (normalized === "not_applicable") return "not_applicable";
  return "unknown";
}

function isSkippedError(errorText) {
  if (typeof errorText !== "string") return false;
  const lower = errorText.toLowerCase();
  return lower.includes("not implemented") || lower.includes("not supported");
}

function getResourceSummaryStatus(resource) {
  const checks = Array.isArray(resource?.checks) ? resource.checks : [];
  const allErrors = Array.isArray(resource?.errors) ? resource.errors : [];
  const realErrors = allErrors.filter((errorText) => !isSkippedError(errorText));
  const skippedErrors = allErrors.filter(isSkippedError);

  if (checks.length === 0 && skippedErrors.length > 0 && realErrors.length === 0) {
    return "skipped";
  }
  if (checks.length === 0 && allErrors.length === 0) {
    return "not_checked";
  }

  if (realErrors.length > 0) {
    return "unhealthy";
  }

  const checkStatuses = checks.map((check) => normalizeSummaryStatus(check?.status));
  if (checkStatuses.includes("unhealthy")) {
    return "unhealthy";
  }
  if (checkStatuses.includes("unknown")) {
    return "unknown";
  }
  if (checkStatuses.includes("not_applicable")) {
    return "not_checked";
  }

  return "healthy";
}

function getResourceIssueLabels(resource) {
  const issueLabels = new Set();
  const checks = Array.isArray(resource?.checks) ? resource.checks : [];

  checks.forEach((check) => {
    if (normalizeSummaryStatus(check?.status) !== "unhealthy") return;
    const label = String(
      check?.checkName || check?.checkId || check?.summary || "Unknown issue"
    ).trim();
    if (label) issueLabels.add(label);
  });

  const realErrors = (Array.isArray(resource?.errors) ? resource.errors : []).filter(
    (errorText) => !isSkippedError(errorText)
  );
  realErrors.forEach((errorText) => {
    const label = String(errorText || "").trim();
    if (label) issueLabels.add(label);
  });

  return Array.from(issueLabels);
}

function buildSummaryResourceKey(resource) {
  return [
    resource?.targetKey ||
      resource?.resourceArn ||
      resource?.identifier ||
      resource?.resourceId ||
      resource?.displayName ||
      "",
    resource?.resourceType || "",
    resource?.region || "",
    resource?.accountId || "",
  ].join("|");
}

function sortCountEntries(a, b) {
  if (b.count !== a.count) return b.count - a.count;
  return a.key.localeCompare(b.key);
}

function toCountMap(map) {
  return Object.fromEntries(
    Array.from(map.entries())
      .filter(([, count]) => Number.isFinite(count) && count > 0)
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      })
  );
}

export function buildAwsResourceHealthSummary({ resources = [] } = {}) {
  const resourceCounts = {
    total: 0,
    evaluated: 0,
    healthy: 0,
    issues: 0,
    notChecked: 0,
    skipped: 0,
  };
  const issueCounts = new Map();
  const resourceTypeCounts = new Map();

  for (const resource of Array.isArray(resources) ? resources : []) {
    resourceCounts.total += 1;

    const resourceStatus = getResourceSummaryStatus(resource);
    if (resourceStatus === "healthy") {
      resourceCounts.evaluated += 1;
      resourceCounts.healthy += 1;
      continue;
    }
    if (resourceStatus === "unhealthy") {
      resourceCounts.evaluated += 1;
      resourceCounts.issues += 1;

      const resourceKey = buildSummaryResourceKey(resource);
      for (const label of getResourceIssueLabels(resource)) {
        const issueKey = `${label}|${resourceKey}`;
        if (!issueCounts.has(issueKey)) {
          issueCounts.set(issueKey, label);
        }
      }

      const resourceType = String(resource?.resourceType || "").trim();
      if (resourceType) {
        const next = resourceTypeCounts.get(resourceType) || 0;
        resourceTypeCounts.set(resourceType, next + 1);
      }
      continue;
    }
    if (resourceStatus === "skipped") {
      resourceCounts.skipped += 1;
      continue;
    }
    resourceCounts.notChecked += 1;
  }

  const issueAggregate = new Map();
  issueCounts.forEach((label) => {
    issueAggregate.set(label, (issueAggregate.get(label) || 0) + 1);
  });

  const evaluated = resourceCounts.evaluated;
  const healthScore = evaluated > 0
    ? Math.round((resourceCounts.healthy / evaluated) * 100)
    : 0;

  const topIssues = Array.from(issueAggregate.entries())
    .map(([key, count]) => ({ key, label: key, count }))
    .sort(sortCountEntries)
    .slice(0, 5);

  const topResourceTypes = Array.from(resourceTypeCounts.entries())
    .map(([key, count]) => ({ key, resourceType: key, count }))
    .sort(sortCountEntries)
    .slice(0, 5);

  return {
    resourceCounts,
    healthScore,
    issueCounts: toCountMap(issueAggregate),
    resourceTypeCounts: toCountMap(resourceTypeCounts),
    topIssues,
    topResourceTypes,
  };
}

export async function runAwsResourceHealthChecks({
  resources = [],
  credentials,
  lookbackHours,
  includeCloudWatchLogChecks = false,
  logger,
} = {}) {
  const normalizedResources = normalizeHealthCheckResources(resources);
  const effectiveLookbackHours = coerceLookbackHours(lookbackHours);
  const shouldRunLogChecks = includeCloudWatchLogChecks === true;

  const ec2Targets = [];
  const ecsTargets = [];
  const lambdaTargets = [];
  const dynamoDbTargets = [];
  const appSyncTargets = [];
  const databaseTargets = [];
  const otherTargets = [];
  const unsupportedTargets = [];

  for (const target of normalizedResources) {
    const serviceId = RESOURCE_TYPE_SERVICE_MAP.get(target.resourceType);
    if (serviceId === "ec2") {
      ec2Targets.push(target);
      continue;
    }
    if (serviceId === "ecs") {
      ecsTargets.push(target);
      continue;
    }
    if (serviceId === "lambda") {
      lambdaTargets.push(target);
      continue;
    }
    if (serviceId === "dynamodb") {
      dynamoDbTargets.push(target);
      continue;
    }
    if (serviceId === "appsync") {
      appSyncTargets.push(target);
      continue;
    }
    if (serviceId === "database") {
      databaseTargets.push(target);
      continue;
    }
    if (serviceId === "other") {
      otherTargets.push(target);
      continue;
    }
    unsupportedTargets.push(target);
  }

  const [ec2Results, ecsResults, lambdaResults, dynamoDbResults, appSyncResults, databaseResults, otherResults] =
    await Promise.all([
      ec2Targets.length > 0
        ? runEc2HealthChecks({
            resources: ec2Targets,
            credentials,
            lookbackHours: effectiveLookbackHours,
            logger,
          })
        : Promise.resolve([]),
      ecsTargets.length > 0
        ? runEcsHealthChecks({
            resources: ecsTargets,
            credentials,
            lookbackHours: effectiveLookbackHours,
            includeCloudWatchLogChecks: shouldRunLogChecks,
            logger,
          })
        : Promise.resolve([]),
      lambdaTargets.length > 0
        ? runLambdaHealthChecks({
            resources: lambdaTargets,
            credentials,
            lookbackHours: effectiveLookbackHours,
            includeCloudWatchLogChecks: shouldRunLogChecks,
            logger,
          })
        : Promise.resolve([]),
      dynamoDbTargets.length > 0
        ? runDynamoDbHealthChecks({
            resources: dynamoDbTargets,
            credentials,
            lookbackHours: effectiveLookbackHours,
            logger,
          })
        : Promise.resolve([]),
      appSyncTargets.length > 0
        ? runAppSyncHealthChecks({
            resources: appSyncTargets,
            credentials,
            lookbackHours: effectiveLookbackHours,
            includeCloudWatchLogChecks: shouldRunLogChecks,
            logger,
          })
        : Promise.resolve([]),
      databaseTargets.length > 0
        ? runDatabaseHealthChecks({
            resources: databaseTargets,
            credentials,
            lookbackHours: effectiveLookbackHours,
            includeCloudWatchLogChecks: shouldRunLogChecks,
            logger,
          })
        : Promise.resolve([]),
      otherTargets.length > 0
        ? runOtherAwsHealthChecks({
            resources: otherTargets,
            credentials,
            logger,
          })
        : Promise.resolve([]),
    ]);

  const resultByKey = new Map();
  for (const result of [
    ...ec2Results,
    ...ecsResults,
    ...lambdaResults,
    ...dynamoDbResults,
    ...appSyncResults,
    ...databaseResults,
    ...otherResults,
  ]) {
    resultByKey.set(result.targetKey, result);
  }

  const resourcesWithResults = normalizedResources.map((target) => {
    const existing = resultByKey.get(target.targetKey);
    if (existing) return existing;
    return createResourceResult({
      target,
      checks: [],
        errors: [`Resource type ${target.resourceType} is not implemented for health checks yet.`],
    });
  });

  const unsupportedResourceTypes = [
    ...new Set(unsupportedTargets.map((target) => target.resourceType)),
  ].sort();

  return {
    version: "2026-03-23",
    generatedAt: new Date().toISOString(),
    inputResourceCount: Array.isArray(resources) ? resources.length : 0,
    normalizedResourceCount: normalizedResources.length,
    unsupportedResourceTypes,
    resources: resourcesWithResults,
    summary: buildAwsResourceHealthSummary({ resources: resourcesWithResults }),
  };
}
