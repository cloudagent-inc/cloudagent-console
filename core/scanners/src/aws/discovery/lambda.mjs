import {
  LambdaClient,
  ListFunctionsCommand,
  GetFunctionCommand,
  ListTagsCommand,
} from "@aws-sdk/client-lambda";
import { DEFAULT_REGION, coerceRegions, extractAccountIdFromArn, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "Lambda";
const FUNCTION_RESOURCE_TYPE = "AWS::Lambda::Function";

function createLambdaClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new LambdaClient(config);
}

export async function scanLambdaResources(options = {}) {
  return scanLambdaFunctions({ ...options, resourceType: FUNCTION_RESOURCE_TYPE });
}

async function scanLambdaFunctions({
  regions,
  logger,
  syncedAt,
  accountId,
  credentials,
  functionNames,
  resourceType,
} = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const filteredFunctionNames = Array.isArray(functionNames)
    ? [...new Set(functionNames.map((name) => name?.trim()).filter(Boolean))]
    : [];
  const hasFilter = filteredFunctionNames.length > 0;

  for (const region of targetRegions) {
    const client = createLambdaClient(region, credentials);

    if (hasFilter) {
      for (const functionName of filteredFunctionNames) {
        try {
          const response = await client.send(new GetFunctionCommand({ FunctionName: functionName }));
          const configuration = response?.Configuration;
          const tags = await listFunctionTags({ client, functionArn: configuration?.FunctionArn, logger });
          pushFunctionResource({
            configuration,
            tags,
            region,
            accountId,
            lastSynced,
            resources,
            resourceType,
          });
        } catch (error) {
          errors.push({
            region,
            functionName,
            message: error?.message || "Failed to retrieve Lambda function",
          });
          logger?.warn?.("[scanner:lambda] GetFunction failed", { region, functionName, error });
        }
      }
      continue;
    }

    let Marker = undefined;
    do {
      try {
        const response = await client.send(new ListFunctionsCommand({ Marker }));
        const functions = response?.Functions || [];
        for (const fn of functions) {
          const tags = await listFunctionTags({ client, functionArn: fn.FunctionArn, logger });
          pushFunctionResource({
            configuration: fn,
            tags,
            region,
            accountId,
            lastSynced,
            resources,
            resourceType,
          });
        }
        Marker = response?.NextMarker;
      } catch (error) {
        errors.push({
          region,
          message: error?.message || "Failed to list Lambda functions",
        });
        logger?.warn?.("[scanner:lambda] ListFunctions failed", { region, error });
        break;
      }
    } while (Marker);
  }

  return {
    service: SERVICE_LABEL,
    regions: targetRegions,
    resources,
    errors,
    lastSynced,
  };
}

async function listFunctionTags({ client, functionArn, logger }) {
  if (!functionArn) return {};
  try {
    const response = await client.send(new ListTagsCommand({ Resource: functionArn }));
    return normalizeTags(response?.Tags);
  } catch (error) {
    const code = error?.name || error?.Code;
    if (code !== "ResourceNotFoundException" && code !== "AccessDeniedException") {
      logger?.warn?.("[scanner:lambda] ListTags failed", { functionArn, error });
    }
  }
  return {};
}

function pushFunctionResource({
  configuration,
  tags,
  region,
  accountId,
  lastSynced,
  resources,
  resourceType,
}) {
  if (!configuration?.FunctionName) return;
  const functionArn = configuration.FunctionArn || null;
  const resolvedAccountId = functionArn ? extractAccountIdFromArn(functionArn) : accountId || "";

  resources.push({
    displayName: configuration.FunctionName,
    resourceId: configuration.FunctionName,
    resourceArn: functionArn,
    region,
    accountId: resolvedAccountId,
    source: SOURCE_LABEL,
    lastSynced,
    resourceType,
    service: SERVICE_LABEL,
    details: {
      tags,
    },
  });
}
