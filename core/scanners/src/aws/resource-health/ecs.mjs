import {
  ECSClient,
  DescribeServicesCommand,
  DescribeTaskDefinitionCommand,
} from "@aws-sdk/client-ecs";
import {
  DEFAULT_LOOKBACK_HOURS,
  HEALTH_STATUS,
  createCheckResult,
  createResourceResult,
  getOrCreateClient,
  parseAwsArn,
  queryLogGroupsForErrorKeywords,
  safeTrim,
} from "./shared.mjs";

const SERVICE_API_NAME = "ECS";

const ECS_CHECK_IDS = Object.freeze({
  SERVICE_RUNNING_VS_DESIRED: "ecs.service.running_vs_desired",
  SERVICE_ERROR_EVENTS: "ecs.service.error_events",
  SERVICE_LOG_ERRORS: "ecs.service.logs.error_keywords",
  TASKDEF_ACTIVE_STATUS: "ecs.task_definition.active_status",
  TASKDEF_LOG_ERRORS: "ecs.task_definition.logs.error_keywords",
});

const EVENT_ERROR_REGEX = /(error|failed|unable|unhealthy|cannot|timeout)/i;

export const ECS_SUPPORTED_RESOURCE_TYPES = Object.freeze([
  "AWS::ECS::Service",
  "AWS::ECS::TaskDefinition",
]);

function createEcsClient(region, credentials) {
  const config = { region, maxAttempts: 5, retryMode: "standard" };
  if (credentials) config.credentials = credentials;
  return new ECSClient(config);
}

function parseEcsServiceIdentifier(target) {
  const arnParsed = parseAwsArn(target.resourceArn || target.identifier);
  if (arnParsed?.service === "ecs" && arnParsed.resource?.startsWith("service/")) {
    const segments = arnParsed.resource.split("/");
    if (segments.length >= 3) {
      return {
        clusterName: segments[1],
        serviceName: segments[2],
        serviceIdentifierForApi: target.resourceArn || segments[2],
      };
    }
  }

  const raw = safeTrim(target.resourceId || target.identifier);
  if (raw.includes("/")) {
    const [clusterName, serviceName] = raw.split("/", 2);
    if (clusterName && serviceName) {
      return {
        clusterName,
        serviceName,
        serviceIdentifierForApi: serviceName,
      };
    }
  }
  return null;
}

function extractTaskDefinitionIdentifier(target) {
  const raw = safeTrim(target.resourceArn || target.resourceId || target.identifier);
  if (!raw) return "";
  const arnParsed = parseAwsArn(raw);
  if (arnParsed?.service === "ecs" && arnParsed.resource?.startsWith("task-definition/")) {
    return raw;
  }
  return raw;
}

function extractAwsLogsGroups(taskDefinition) {
  const groups = new Set();
  for (const container of taskDefinition?.containerDefinitions || []) {
    const groupName = safeTrim(container?.logConfiguration?.options?.["awslogs-group"]);
    if (groupName) groups.add(groupName);
  }
  return [...groups];
}

async function fetchEcsService({ target, credentials, cache, logger }) {
  const parsed = parseEcsServiceIdentifier(target);
  if (!parsed?.clusterName || !parsed?.serviceIdentifierForApi) {
    throw new Error(
      "ECS service identifier is missing cluster context. Provide service ARN or cluster/service."
    );
  }

  const key = `${target.region}:${parsed.clusterName}`;
  const client = getOrCreateClient(cache, key, () => createEcsClient(target.region, credentials));
  const response = await client.send(
    new DescribeServicesCommand({
      cluster: parsed.clusterName,
      services: [parsed.serviceIdentifierForApi],
    })
  );

  if (Array.isArray(response?.failures) && response.failures.length > 0) {
    throw new Error(response.failures[0]?.reason || "DescribeServices returned a failure");
  }
  const service = response?.services?.[0];
  if (!service) {
    logger?.warn?.("[resource-health:ecs] service not found", {
      resource: target.identifier,
      region: target.region,
    });
    throw new Error("ECS service not found");
  }
  return service;
}

async function fetchTaskDefinition({ taskDefinitionRef, region, credentials, cache }) {
  const cacheKey = `${region}:${taskDefinitionRef}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const client = getOrCreateClient(cache, `client:${region}`, () =>
    createEcsClient(region, credentials)
  );
  const response = await client.send(
    new DescribeTaskDefinitionCommand({ taskDefinition: taskDefinitionRef })
  );
  const taskDefinition = response?.taskDefinition;
  if (!taskDefinition) {
    throw new Error("Task definition not found");
  }
  cache.set(cacheKey, taskDefinition);
  return taskDefinition;
}

function checkServiceRunningCount({ service }) {
  const desiredCount = Number(service?.desiredCount ?? 0);
  const runningCount = Number(service?.runningCount ?? 0);
  const status =
    Number.isFinite(desiredCount) && Number.isFinite(runningCount) && runningCount >= desiredCount
      ? HEALTH_STATUS.HEALTHY
      : HEALTH_STATUS.PROBLEM;

  return createCheckResult({
    checkId: ECS_CHECK_IDS.SERVICE_RUNNING_VS_DESIRED,
    checkName: "Running task count below desired",
    category: "availability",
    status,
    summary:
      status === HEALTH_STATUS.HEALTHY
        ? `runningCount (${runningCount}) is >= desiredCount (${desiredCount}).`
        : `runningCount (${runningCount}) is below desiredCount (${desiredCount}).`,
    servicesApisUsed: [`${SERVICE_API_NAME}.DescribeServices`],
    details: {
      desiredCount,
      runningCount,
      pendingCount: Number(service?.pendingCount ?? 0),
    },
  });
}

function checkServiceEventErrorStream({ service, lookbackHours }) {
  const nowMs = Date.now();
  const lookbackStartMs = nowMs - lookbackHours * 60 * 60 * 1000;
  const recentEvents = (service?.events || []).filter((event) => {
    const createdAtMs = new Date(event?.createdAt || 0).getTime();
    return Number.isFinite(createdAtMs) && createdAtMs >= lookbackStartMs;
  });
  const errorEvents = recentEvents.filter((event) => EVENT_ERROR_REGEX.test(event?.message || ""));
  const status = errorEvents.length > 0 ? HEALTH_STATUS.PROBLEM : HEALTH_STATUS.HEALTHY;

  return createCheckResult({
    checkId: ECS_CHECK_IDS.SERVICE_ERROR_EVENTS,
    checkName: "Service event error stream",
    category: "errors",
    status,
    summary:
      status === HEALTH_STATUS.HEALTHY
        ? "No recent ECS service events matched error patterns."
        : `Found ${errorEvents.length} recent ECS service events matching error patterns.`,
    servicesApisUsed: [`${SERVICE_API_NAME}.DescribeServices`],
    details: {
      lookbackHours,
      recentEventCount: recentEvents.length,
      matchedErrorEvents: errorEvents.slice(0, 5).map((event) => ({
        createdAt: event?.createdAt || null,
        message: event?.message || null,
      })),
    },
  });
}

async function checkServiceRecentLogErrors({
  service,
  region,
  credentials,
  lookbackHours,
  logger,
  taskDefinitionCache,
  logsClientCache,
}) {
  const taskDefinitionRef = safeTrim(service?.taskDefinition);
  if (!taskDefinitionRef) {
    return createCheckResult({
      checkId: ECS_CHECK_IDS.SERVICE_LOG_ERRORS,
      checkName: "Recent CloudWatch log errors (if awslogs enabled)",
      category: "error-logs",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "Service does not include a task definition reference.",
      servicesApisUsed: [`${SERVICE_API_NAME}.DescribeServices`],
    });
  }

  let taskDefinition;
  try {
    taskDefinition = await fetchTaskDefinition({
      taskDefinitionRef,
      region,
      credentials,
      cache: taskDefinitionCache,
    });
  } catch (error) {
    return createCheckResult({
      checkId: ECS_CHECK_IDS.SERVICE_LOG_ERRORS,
      checkName: "Recent CloudWatch log errors (if awslogs enabled)",
      category: "error-logs",
      status: HEALTH_STATUS.ERROR,
      summary: `Unable to resolve task definition logs: ${error?.message || "unknown error"}.`,
      servicesApisUsed: [`${SERVICE_API_NAME}.DescribeTaskDefinition`],
    });
  }

  const logGroupNames = extractAwsLogsGroups(taskDefinition);
  if (logGroupNames.length === 0) {
    return createCheckResult({
      checkId: ECS_CHECK_IDS.SERVICE_LOG_ERRORS,
      checkName: "Recent CloudWatch log errors (if awslogs enabled)",
      category: "error-logs",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "No awslogs log groups were found in the service task definition.",
      servicesApisUsed: [`${SERVICE_API_NAME}.DescribeTaskDefinition`],
    });
  }

  try {
    const queryResult = await queryLogGroupsForErrorKeywords({
      region,
      credentials,
      logGroupNames,
      lookbackHours,
      logger,
      clientCache: logsClientCache,
    });
    const status =
      Number(queryResult?.matchCount || 0) > 0 ? HEALTH_STATUS.PROBLEM : HEALTH_STATUS.HEALTHY;
    return createCheckResult({
      checkId: ECS_CHECK_IDS.SERVICE_LOG_ERRORS,
      checkName: "Recent CloudWatch log errors (if awslogs enabled)",
      category: "error-logs",
      status,
      summary:
        status === HEALTH_STATUS.HEALTHY
          ? "No error-like keywords were found in recent container logs."
          : `Found ${queryResult.matchCount} log matches for error-like keywords.`,
      servicesApisUsed: [
        `${SERVICE_API_NAME}.DescribeTaskDefinition`,
        "CloudWatchLogs.StartQuery",
        "CloudWatchLogs.GetQueryResults",
      ],
      details: {
        lookbackHours,
        logGroupNames,
        matchCount: queryResult.matchCount,
      },
    });
  } catch (error) {
    return createCheckResult({
      checkId: ECS_CHECK_IDS.SERVICE_LOG_ERRORS,
      checkName: "Recent CloudWatch log errors (if awslogs enabled)",
      category: "error-logs",
      status: HEALTH_STATUS.ERROR,
      summary: `CloudWatch Logs query failed: ${error?.message || "unknown error"}.`,
      servicesApisUsed: ["CloudWatchLogs.StartQuery", "CloudWatchLogs.GetQueryResults"],
    });
  }
}

function checkTaskDefinitionActiveStatus({ taskDefinition }) {
  const statusValue = safeTrim(taskDefinition?.status).toUpperCase();
  const status =
    statusValue && statusValue !== "INACTIVE" ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.PROBLEM;
  return createCheckResult({
    checkId: ECS_CHECK_IDS.TASKDEF_ACTIVE_STATUS,
    checkName: "Task definition active status",
    category: "configuration",
    status,
    summary:
      status === HEALTH_STATUS.HEALTHY
        ? `Task definition status is ${statusValue || "ACTIVE"}.`
        : "Task definition status is INACTIVE.",
    servicesApisUsed: [`${SERVICE_API_NAME}.DescribeTaskDefinition`],
    details: {
      status: statusValue || null,
      taskDefinitionArn: taskDefinition?.taskDefinitionArn || null,
    },
  });
}

async function checkTaskDefinitionRecentLogErrors({
  taskDefinition,
  region,
  credentials,
  lookbackHours,
  logger,
  logsClientCache,
}) {
  const logGroupNames = extractAwsLogsGroups(taskDefinition);
  if (logGroupNames.length === 0) {
    return createCheckResult({
      checkId: ECS_CHECK_IDS.TASKDEF_LOG_ERRORS,
      checkName: "Container error log rate",
      category: "error-logs",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "No awslogs log groups were found in this task definition.",
      servicesApisUsed: [`${SERVICE_API_NAME}.DescribeTaskDefinition`],
    });
  }

  try {
    const queryResult = await queryLogGroupsForErrorKeywords({
      region,
      credentials,
      logGroupNames,
      lookbackHours,
      logger,
      clientCache: logsClientCache,
    });
    const status =
      Number(queryResult?.matchCount || 0) > 0 ? HEALTH_STATUS.PROBLEM : HEALTH_STATUS.HEALTHY;
    return createCheckResult({
      checkId: ECS_CHECK_IDS.TASKDEF_LOG_ERRORS,
      checkName: "Container error log rate",
      category: "error-logs",
      status,
      summary:
        status === HEALTH_STATUS.HEALTHY
          ? "No error-like keywords were found in recent task logs."
          : `Found ${queryResult.matchCount} log matches for error-like keywords.`,
      servicesApisUsed: ["CloudWatchLogs.StartQuery", "CloudWatchLogs.GetQueryResults"],
      details: {
        lookbackHours,
        logGroupNames,
        matchCount: queryResult.matchCount,
      },
    });
  } catch (error) {
    return createCheckResult({
      checkId: ECS_CHECK_IDS.TASKDEF_LOG_ERRORS,
      checkName: "Container error log rate",
      category: "error-logs",
      status: HEALTH_STATUS.ERROR,
      summary: `CloudWatch Logs query failed: ${error?.message || "unknown error"}.`,
      servicesApisUsed: ["CloudWatchLogs.StartQuery", "CloudWatchLogs.GetQueryResults"],
    });
  }
}

function buildCheckError({ checkId, checkName, category, summary, servicesApisUsed }) {
  return createCheckResult({
    checkId,
    checkName,
    category,
    status: HEALTH_STATUS.ERROR,
    summary,
    servicesApisUsed,
  });
}

async function evaluateEcsServiceResource({
  target,
  credentials,
  lookbackHours,
  includeCloudWatchLogChecks,
  caches,
  logger,
}) {
  const checks = [];
  const errors = [];
  try {
    const service = await fetchEcsService({
      target,
      credentials,
      cache: caches.ecsClientCache,
      logger,
    });
    checks.push(checkServiceRunningCount({ service }));
    checks.push(checkServiceEventErrorStream({ service, lookbackHours }));
    if (includeCloudWatchLogChecks) {
      checks.push(
        await checkServiceRecentLogErrors({
          service,
          region: target.region,
          credentials,
          lookbackHours,
          logger,
          taskDefinitionCache: caches.taskDefinitionCache,
          logsClientCache: caches.logsClientCache,
        })
      );
    }
  } catch (error) {
    const message = error?.message || "Unable to evaluate ECS service checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: ECS_CHECK_IDS.SERVICE_RUNNING_VS_DESIRED,
        checkName: "Running task count below desired",
        category: "availability",
        summary: message,
        servicesApisUsed: [`${SERVICE_API_NAME}.DescribeServices`],
      })
    );
    checks.push(
      buildCheckError({
        checkId: ECS_CHECK_IDS.SERVICE_ERROR_EVENTS,
        checkName: "Service event error stream",
        category: "errors",
        summary: message,
        servicesApisUsed: [`${SERVICE_API_NAME}.DescribeServices`],
      })
    );
    if (includeCloudWatchLogChecks) {
      checks.push(
        buildCheckError({
          checkId: ECS_CHECK_IDS.SERVICE_LOG_ERRORS,
          checkName: "Recent CloudWatch log errors (if awslogs enabled)",
          category: "error-logs",
          summary: message,
          servicesApisUsed: [`${SERVICE_API_NAME}.DescribeServices`],
        })
      );
    }
  }

  return createResourceResult({ target, checks, errors });
}

async function evaluateEcsTaskDefinitionResource({
  target,
  credentials,
  lookbackHours,
  includeCloudWatchLogChecks,
  caches,
  logger,
}) {
  const checks = [];
  const errors = [];
  const taskDefinitionRef = extractTaskDefinitionIdentifier(target);
  if (!taskDefinitionRef) {
    errors.push("Task definition identifier is required");
    checks.push(
      buildCheckError({
        checkId: ECS_CHECK_IDS.TASKDEF_ACTIVE_STATUS,
        checkName: "Task definition active status",
        category: "configuration",
        summary: "Task definition identifier is required.",
        servicesApisUsed: [`${SERVICE_API_NAME}.DescribeTaskDefinition`],
      })
    );
    if (includeCloudWatchLogChecks) {
      checks.push(
        buildCheckError({
          checkId: ECS_CHECK_IDS.TASKDEF_LOG_ERRORS,
          checkName: "Container error log rate",
          category: "error-logs",
          summary: "Task definition identifier is required.",
          servicesApisUsed: [`${SERVICE_API_NAME}.DescribeTaskDefinition`],
        })
      );
    }
    return createResourceResult({ target, checks, errors });
  }

  try {
    const taskDefinition = await fetchTaskDefinition({
      taskDefinitionRef,
      region: target.region,
      credentials,
      cache: caches.taskDefinitionCache,
    });
    checks.push(checkTaskDefinitionActiveStatus({ taskDefinition }));
    if (includeCloudWatchLogChecks) {
      checks.push(
        await checkTaskDefinitionRecentLogErrors({
          taskDefinition,
          region: target.region,
          credentials,
          lookbackHours,
          logger,
          logsClientCache: caches.logsClientCache,
        })
      );
    }
  } catch (error) {
    const message = error?.message || "Unable to evaluate ECS task definition checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: ECS_CHECK_IDS.TASKDEF_ACTIVE_STATUS,
        checkName: "Task definition active status",
        category: "configuration",
        summary: message,
        servicesApisUsed: [`${SERVICE_API_NAME}.DescribeTaskDefinition`],
      })
    );
    if (includeCloudWatchLogChecks) {
      checks.push(
        buildCheckError({
          checkId: ECS_CHECK_IDS.TASKDEF_LOG_ERRORS,
          checkName: "Container error log rate",
          category: "error-logs",
          summary: message,
          servicesApisUsed: [`${SERVICE_API_NAME}.DescribeTaskDefinition`],
        })
      );
    }
  }

  return createResourceResult({ target, checks, errors });
}

export async function runEcsHealthChecks({
  resources = [],
  credentials,
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
  includeCloudWatchLogChecks = false,
  logger,
} = {}) {
  const caches = {
    ecsClientCache: new Map(),
    taskDefinitionCache: new Map(),
    logsClientCache: new Map(),
  };

  const results = [];
  for (const target of resources) {
    if (target.resourceType === "AWS::ECS::Service") {
      results.push(
        await evaluateEcsServiceResource({
          target,
          credentials,
          lookbackHours,
          includeCloudWatchLogChecks,
          caches,
          logger,
        })
      );
      continue;
    }
    if (target.resourceType === "AWS::ECS::TaskDefinition") {
      results.push(
        await evaluateEcsTaskDefinitionResource({
          target,
          credentials,
          lookbackHours,
          includeCloudWatchLogChecks,
          caches,
          logger,
        })
      );
      continue;
    }
  }

  return results;
}
