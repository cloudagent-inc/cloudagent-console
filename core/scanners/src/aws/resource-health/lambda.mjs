import { LambdaClient, GetFunctionConfigurationCommand } from "@aws-sdk/client-lambda";
import {
  DEFAULT_LOOKBACK_HOURS,
  HEALTH_STATUS,
  createCheckResult,
  createResourceResult,
  getCloudWatchMetricSum,
  getOrCreateClient,
  queryLogGroupsForErrorKeywords,
  safeTrim,
} from "./shared.mjs";

const SERVICE_API_NAME = "Lambda";

const LAMBDA_CHECK_IDS = Object.freeze({
  FUNCTION_STATE: "lambda.function.state",
  RUNTIME_SUPPORTED: "lambda.function.runtime_supported",
  INVOCATION_ERRORS: "lambda.function.errors",
  RECENT_LOG_ERRORS: "lambda.function.logs.error_keywords",
});

const SUPPORTED_ZIP_RUNTIMES = new Set([
  "nodejs24.x",
  "nodejs22.x",
  "nodejs20.x",
  "python3.14",
  "python3.13",
  "python3.12",
  "python3.11",
  "python3.10",
  "java25",
  "java21",
  "java17",
  "java11",
  "java8.al2",
  "dotnet10",
  "dotnet8",
  "ruby3.4",
  "ruby3.3",
  "ruby3.2",
  "provided.al2023",
  "provided.al2",
]);

export const LAMBDA_SUPPORTED_RESOURCE_TYPES = Object.freeze(["AWS::Lambda::Function"]);

function createLambdaClient(region, credentials) {
  const config = { region, maxAttempts: 5, retryMode: "standard" };
  if (credentials) config.credentials = credentials;
  return new LambdaClient(config);
}

function parseFunctionName(target) {
  const arn = safeTrim(target.resourceArn || target.identifier);
  if (arn.startsWith("arn:") && arn.includes(":function:")) {
    const functionPart = arn.split(":function:")[1] || "";
    const segments = functionPart.split(":");
    return segments[0] || "";
  }
  return safeTrim(target.resourceId || target.identifier);
}

async function fetchFunctionConfiguration({ target, credentials, clientCache }) {
  const functionName = parseFunctionName(target);
  const functionIdentifier = safeTrim(target.resourceArn) || functionName;
  if (!functionIdentifier) throw new Error("Lambda function identifier is required");
  const key = `lambda:${target.region}`;
  const client = getOrCreateClient(clientCache, key, () =>
    createLambdaClient(target.region, credentials)
  );
  const config = await client.send(
    new GetFunctionConfigurationCommand({ FunctionName: functionIdentifier })
  );
  return config;
}

function checkLambdaFunctionState({ config }) {
  const state = safeTrim(config?.State);
  const updateStatus = safeTrim(config?.LastUpdateStatus);
  if (state === "Failed" || state === "Inactive" || updateStatus === "Failed") {
    return createCheckResult({
      checkId: LAMBDA_CHECK_IDS.FUNCTION_STATE,
      checkName: "Lambda function state",
      category: "availability",
      status: HEALTH_STATUS.PROBLEM,
      summary: `Function state=${state || "unknown"}, lastUpdateStatus=${updateStatus || "unknown"}.`,
      details: { state: state || null, lastUpdateStatus: updateStatus || null },
    });
  }

  if (state === "Active" && (!updateStatus || updateStatus === "Successful")) {
    return createCheckResult({
      checkId: LAMBDA_CHECK_IDS.FUNCTION_STATE,
      checkName: "Lambda function state",
      category: "availability",
      status: HEALTH_STATUS.HEALTHY,
      summary: "Function state is Active and update status is Successful.",
      details: { state, lastUpdateStatus: updateStatus || "Successful" },
    });
  }

  return createCheckResult({
    checkId: LAMBDA_CHECK_IDS.FUNCTION_STATE,
    checkName: "Lambda function state",
    category: "availability",
    status: HEALTH_STATUS.UNKNOWN,
    summary: `Function state=${state || "unknown"}, lastUpdateStatus=${updateStatus || "unknown"}.`,
    details: { state: state || null, lastUpdateStatus: updateStatus || null },
  });
}

function checkLambdaRuntimeSupported({ config }) {
  const packageType = safeTrim(config?.PackageType || "Zip");
  const runtime = safeTrim(config?.Runtime);
  if (packageType === "Image") {
    return createCheckResult({
      checkId: LAMBDA_CHECK_IDS.RUNTIME_SUPPORTED,
      checkName: "Supported runtime check",
      category: "runtime-eol",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "Runtime support check is not applicable for container-image Lambda functions.",
      details: { packageType, runtime: runtime || null },
    });
  }
  if (!runtime) {
    return createCheckResult({
      checkId: LAMBDA_CHECK_IDS.RUNTIME_SUPPORTED,
      checkName: "Supported runtime check",
      category: "runtime-eol",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "Lambda runtime is unavailable in function configuration.",
      details: { packageType, runtime: null },
    });
  }

  const supported = SUPPORTED_ZIP_RUNTIMES.has(runtime);
  return createCheckResult({
    checkId: LAMBDA_CHECK_IDS.RUNTIME_SUPPORTED,
    checkName: "Supported runtime check",
    category: "runtime-eol",
    status: supported ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.PROBLEM,
    summary: supported
      ? `Runtime ${runtime} is in the supported runtime set.`
      : `Runtime ${runtime} is not in the supported runtime set.`,
    details: { packageType, runtime, supported },
  });
}

async function checkLambdaInvocationErrors({
  config,
  region,
  credentials,
  lookbackHours,
  cloudWatchClientCache,
}) {
  const functionName = safeTrim(config?.FunctionName);
  if (!functionName) {
    return createCheckResult({
      checkId: LAMBDA_CHECK_IDS.INVOCATION_ERRORS,
      checkName: "Invocation errors",
      category: "errors",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "Function name unavailable for CloudWatch metric query.",
    });
  }

  try {
    const errorSum = await getCloudWatchMetricSum({
      region,
      credentials,
      namespace: "AWS/Lambda",
      metricName: "Errors",
      dimensions: [{ Name: "FunctionName", Value: functionName }],
      lookbackHours,
      statistic: "Sum",
      clientCache: cloudWatchClientCache,
    });
    const status = errorSum > 0 ? HEALTH_STATUS.PROBLEM : HEALTH_STATUS.HEALTHY;
    return createCheckResult({
      checkId: LAMBDA_CHECK_IDS.INVOCATION_ERRORS,
      checkName: "Invocation errors",
      category: "errors",
      status,
      summary:
        status === HEALTH_STATUS.HEALTHY
          ? `No Lambda invocation errors in the last ${lookbackHours}h.`
          : `${errorSum} Lambda invocation errors in the last ${lookbackHours}h.`,
      details: { functionName, errorSum, lookbackHours },
    });
  } catch (error) {
    return createCheckResult({
      checkId: LAMBDA_CHECK_IDS.INVOCATION_ERRORS,
      checkName: "Invocation errors",
      category: "errors",
      status: HEALTH_STATUS.ERROR,
      summary: `CloudWatch metric query failed: ${error?.message || "unknown error"}.`,
      details: { functionName },
    });
  }
}

async function checkLambdaRecentLogErrors({
  config,
  region,
  credentials,
  lookbackHours,
  logger,
  logsClientCache,
}) {
  const functionName = safeTrim(config?.FunctionName);
  if (!functionName) {
    return createCheckResult({
      checkId: LAMBDA_CHECK_IDS.RECENT_LOG_ERRORS,
      checkName: "Recent CloudWatch log errors",
      category: "error-logs",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "Function name unavailable for CloudWatch Logs query.",
    });
  }

  const logGroupName = `/aws/lambda/${functionName}`;
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
      checkId: LAMBDA_CHECK_IDS.RECENT_LOG_ERRORS,
      checkName: "Recent CloudWatch log errors",
      category: "error-logs",
      status,
      summary:
        status === HEALTH_STATUS.HEALTHY
          ? "No error-like keywords found in recent Lambda logs."
          : `Found ${queryResult.matchCount} error-like log matches in recent Lambda logs.`,
      details: { functionName, logGroupName, matchCount: queryResult.matchCount, lookbackHours },
    });
  } catch (error) {
    return createCheckResult({
      checkId: LAMBDA_CHECK_IDS.RECENT_LOG_ERRORS,
      checkName: "Recent CloudWatch log errors",
      category: "error-logs",
      status: HEALTH_STATUS.ERROR,
      summary: `CloudWatch Logs query failed: ${error?.message || "unknown error"}.`,
      details: { functionName, logGroupName },
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

async function evaluateLambdaFunction({
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
    const config = await fetchFunctionConfiguration({
      target,
      credentials,
      clientCache: caches.lambdaClientCache,
    });
    checks.push(checkLambdaFunctionState({ config }));
    checks.push(checkLambdaRuntimeSupported({ config }));
    checks.push(
      await checkLambdaInvocationErrors({
        config,
        region: target.region,
        credentials,
        lookbackHours,
        cloudWatchClientCache: caches.cloudWatchClientCache,
      })
    );
    if (includeCloudWatchLogChecks) {
      checks.push(
        await checkLambdaRecentLogErrors({
          config,
          region: target.region,
          credentials,
          lookbackHours,
          logger,
          logsClientCache: caches.logsClientCache,
        })
      );
    }
  } catch (error) {
    const message = error?.message || "Unable to evaluate Lambda function checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: LAMBDA_CHECK_IDS.FUNCTION_STATE,
        checkName: "Lambda function state",
        category: "availability",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: LAMBDA_CHECK_IDS.RUNTIME_SUPPORTED,
        checkName: "Supported runtime check",
        category: "runtime-eol",
        summary: message,
      })
    );
    checks.push(
      buildCheckError({
        checkId: LAMBDA_CHECK_IDS.INVOCATION_ERRORS,
        checkName: "Invocation errors",
        category: "errors",
        summary: message,
      })
    );
    if (includeCloudWatchLogChecks) {
      checks.push(
        buildCheckError({
          checkId: LAMBDA_CHECK_IDS.RECENT_LOG_ERRORS,
          checkName: "Recent CloudWatch log errors",
          category: "error-logs",
          summary: message,
        })
      );
    }
  }
  return createResourceResult({ target, checks, errors });
}

export async function runLambdaHealthChecks({
  resources = [],
  credentials,
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
  includeCloudWatchLogChecks = false,
  logger,
} = {}) {
  const caches = {
    lambdaClientCache: new Map(),
    logsClientCache: new Map(),
    cloudWatchClientCache: new Map(),
  };
  const results = [];
  for (const target of resources) {
    if (target.resourceType !== "AWS::Lambda::Function") continue;
    results.push(
      await evaluateLambdaFunction({
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
