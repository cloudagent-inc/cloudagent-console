import { AppSyncClient, GetGraphqlApiCommand } from "@aws-sdk/client-appsync";
import {
  DEFAULT_LOOKBACK_HOURS,
  HEALTH_STATUS,
  createCheckResult,
  createResourceResult,
  getCloudWatchMetricSum,
  queryLogGroupsForErrorKeywords,
  safeTrim,
} from "./shared.mjs";

const APPSYNC_CHECK_IDS = Object.freeze({
  API_REACHABILITY: "appsync.api.reachability",
  GRAPHQL_4XX_ERRORS: "appsync.api.4xx_errors",
  GRAPHQL_5XX_ERRORS: "appsync.api.5xx_errors",
  RECENT_LOG_ERRORS: "appsync.api.logs.error_keywords",
});

export const APPSYNC_SUPPORTED_RESOURCE_TYPES = Object.freeze([
  "AWS::AppSync::GraphQLApi",
]);

function createAppSyncClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new AppSyncClient(config);
}

function parseGraphQlApiId(target) {
  const candidates = [
    safeTrim(target.resourceArn),
    safeTrim(target.resourceId),
    safeTrim(target.identifier),
  ].filter(Boolean);

  for (const value of candidates) {
    if (value.startsWith("arn:") && value.includes(":apis/")) {
      const after = value.split(":apis/")[1] || "";
      const apiId = after.split("/")[0];
      if (apiId) return apiId;
    }
    if (!value.includes("/") && !value.includes(":") && value.length >= 8) {
      return value;
    }
  }
  return "";
}

async function fetchGraphQlApi({ target, credentials, clientCache }) {
  const apiId = parseGraphQlApiId(target);
  if (!apiId) throw new Error("AppSync GraphQL API id is required");
  const cacheKey = `appsync:${target.region}`;
  let client = clientCache.get(cacheKey);
  if (!client) {
    client = createAppSyncClient(target.region, credentials);
    clientCache.set(cacheKey, client);
  }
  const response = await client.send(new GetGraphqlApiCommand({ apiId }));
  const graphqlApi = response?.graphqlApi;
  if (!graphqlApi) throw new Error("AppSync GraphQL API not found");
  return { apiId, graphqlApi };
}

function checkApiReachability({ apiId, graphqlApi }) {
  return createCheckResult({
    checkId: APPSYNC_CHECK_IDS.API_REACHABILITY,
    checkName: "GraphQL API reachability",
    category: "availability",
    status: HEALTH_STATUS.HEALTHY,
    summary: "Successfully retrieved GraphQL API configuration from AppSync.",
    details: {
      apiId,
      name: graphqlApi?.name || null,
      authenticationType: graphqlApi?.authenticationType || null,
      visibility: graphqlApi?.visibility || null,
    },
  });
}

async function checkMetricZeroIsHealthy({
  checkId,
  checkName,
  metricName,
  apiId,
  region,
  credentials,
  lookbackHours,
  cloudWatchClientCache,
}) {
  try {
    const metricSum = await getCloudWatchMetricSum({
      region,
      credentials,
      namespace: "AWS/AppSync",
      metricName,
      dimensions: [{ Name: "GraphQLAPIId", Value: apiId }],
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
      details: { apiId, metricName, metricSum, lookbackHours },
    });
  } catch (error) {
    return createCheckResult({
      checkId,
      checkName,
      category: "errors",
      status: HEALTH_STATUS.ERROR,
      summary: `CloudWatch metric query failed: ${error?.message || "unknown error"}.`,
      details: { apiId, metricName },
    });
  }
}

async function checkRecentAppSyncLogErrors({
  apiId,
  graphqlApi,
  region,
  credentials,
  lookbackHours,
  logger,
  logsClientCache,
}) {
  const fieldLogLevel = safeTrim(graphqlApi?.logConfig?.fieldLogLevel).toUpperCase();
  if (!fieldLogLevel || fieldLogLevel === "NONE") {
    return createCheckResult({
      checkId: APPSYNC_CHECK_IDS.RECENT_LOG_ERRORS,
      checkName: "Recent CloudWatch log errors",
      category: "error-logs",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "AppSync field logging is disabled or not configured.",
      details: { apiId, fieldLogLevel: fieldLogLevel || null },
    });
  }

  const logGroupName = `/aws/appsync/apis/${apiId}`;
  try {
    const queryResult = await queryLogGroupsForErrorKeywords({
      region,
      credentials,
      logGroupNames: [logGroupName],
      lookbackHours,
      logger,
      clientCache: logsClientCache,
    });
    const status =
      Number(queryResult?.matchCount || 0) > 0 ? HEALTH_STATUS.PROBLEM : HEALTH_STATUS.HEALTHY;
    return createCheckResult({
      checkId: APPSYNC_CHECK_IDS.RECENT_LOG_ERRORS,
      checkName: "Recent CloudWatch log errors",
      category: "error-logs",
      status,
      summary:
        status === HEALTH_STATUS.HEALTHY
          ? "No error-like keywords found in recent AppSync logs."
          : `Found ${queryResult.matchCount} error-like log matches in recent AppSync logs.`,
      details: { apiId, fieldLogLevel, logGroupName, matchCount: queryResult.matchCount, lookbackHours },
    });
  } catch (error) {
    return createCheckResult({
      checkId: APPSYNC_CHECK_IDS.RECENT_LOG_ERRORS,
      checkName: "Recent CloudWatch log errors",
      category: "error-logs",
      status: HEALTH_STATUS.ERROR,
      summary: `CloudWatch Logs query failed: ${error?.message || "unknown error"}.`,
      details: { apiId, fieldLogLevel, logGroupName },
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

async function evaluateGraphQlApi({
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
    const { apiId, graphqlApi } = await fetchGraphQlApi({
      target,
      credentials,
      clientCache: caches.appSyncClientCache,
    });
    checks.push(checkApiReachability({ apiId, graphqlApi }));
    checks.push(
      await checkMetricZeroIsHealthy({
        checkId: APPSYNC_CHECK_IDS.GRAPHQL_4XX_ERRORS,
        checkName: "GraphQL 4XX errors",
        metricName: "4XXError",
        apiId,
        region: target.region,
        credentials,
        lookbackHours,
        cloudWatchClientCache: caches.cloudWatchClientCache,
      })
    );
    checks.push(
      await checkMetricZeroIsHealthy({
        checkId: APPSYNC_CHECK_IDS.GRAPHQL_5XX_ERRORS,
        checkName: "GraphQL 5XX errors",
        metricName: "5XXError",
        apiId,
        region: target.region,
        credentials,
        lookbackHours,
        cloudWatchClientCache: caches.cloudWatchClientCache,
      })
    );
    if (includeCloudWatchLogChecks) {
      checks.push(
        await checkRecentAppSyncLogErrors({
          apiId,
          graphqlApi,
          region: target.region,
          credentials,
          lookbackHours,
          logger,
          logsClientCache: caches.logsClientCache,
        })
      );
    }
  } catch (error) {
    const message = error?.message || "Unable to evaluate AppSync GraphQL API checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: APPSYNC_CHECK_IDS.API_REACHABILITY,
        checkName: "GraphQL API reachability",
        category: "availability",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: APPSYNC_CHECK_IDS.GRAPHQL_4XX_ERRORS,
        checkName: "GraphQL 4XX errors",
        category: "errors",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: APPSYNC_CHECK_IDS.GRAPHQL_5XX_ERRORS,
        checkName: "GraphQL 5XX errors",
        category: "errors",
        summary: message,
      })
    );
    if (includeCloudWatchLogChecks) {
      checks.push(
        buildCheckError({
          checkId: APPSYNC_CHECK_IDS.RECENT_LOG_ERRORS,
          checkName: "Recent CloudWatch log errors",
          category: "error-logs",
          summary: message,
        })
      );
    }
  }
  return createResourceResult({ target, checks, errors });
}

export async function runAppSyncHealthChecks({
  resources = [],
  credentials,
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
  includeCloudWatchLogChecks = false,
  logger,
} = {}) {
  const caches = {
    appSyncClientCache: new Map(),
    logsClientCache: new Map(),
    cloudWatchClientCache: new Map(),
  };
  const results = [];
  for (const target of resources) {
    if (target.resourceType !== "AWS::AppSync::GraphQLApi") continue;
    results.push(
      await evaluateGraphQlApi({
        target,
        credentials,
        lookbackHours,
        includeCloudWatchLogChecks,
        caches,
        logger,
      })
    );
  }
  return results;
}
