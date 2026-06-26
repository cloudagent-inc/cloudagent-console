import {
  APIGatewayClient,
  GetRestApisCommand,
  GetStagesCommand,
  GetDeploymentsCommand,
  GetApiKeysCommand,
  GetTagsCommand,
} from "@aws-sdk/client-api-gateway";
import { DEFAULT_REGION, coerceRegions, uniqueTrimmed, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "APIGateway";

function createApigwClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new APIGatewayClient(config);
}

async function listTagsForResource({ client, resourceArn, logger }) {
  if (!resourceArn) return {};
  try {
    const response = await client.send(new GetTagsCommand({ resourceArn }));
    return normalizeTags(response?.tags);
  } catch (error) {
    const code = error?.name || error?.Code;
    if (code !== "ResourceNotFoundException" && code !== "AccessDeniedException" && code !== "NotFoundException") {
      logger?.warn?.("[scanner:apigw] GetTags failed", { resourceArn, error });
    }
  }
  return {};
}

export async function scanApiGatewayRestApis({ regions, logger, syncedAt, accountId, credentials, restApiIds } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const ids = uniqueTrimmed(restApiIds);

  for (const region of targetRegions) {
    const client = createApigwClient(region, credentials);
    if (ids.length > 0) {
      // No direct describe by ID in batch; list and filter
      try {
        let position = undefined;
        do {
          const response = await client.send(new GetRestApisCommand({ position }));
          for (const api of response?.items || []) {
            if (!ids.includes(api?.id)) continue;
            const id = api?.id;
            const name = api?.name || id;
            const arn = api?.id ? `arn:aws:apigateway:${region}::/restapis/${id}` : null;
            const tags = await listTagsForResource({ client, resourceArn: arn, logger });
            resources.push({
              displayName: name,
              resourceId: id,
              resourceArn: arn,
              region,
              accountId: accountId || "",
              source: SOURCE_LABEL,
              lastSynced,
              resourceType: "AWS::ApiGateway::RestApi",
              service: SERVICE_LABEL,
              details: {
                tags,
              },
            });
          }
          position = response?.position;
        } while (position);
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list RestApis" });
        logger?.warn?.("[scanner:apigw] getRestApis filtered failed", { region, error });
      }
      continue;
    }

    let position = undefined;
    do {
      try {
        const response = await client.send(new GetRestApisCommand({ position }));
        for (const api of response?.items || []) {
          const id = api?.id;
          const name = api?.name || id;
          const arn = id ? `arn:aws:apigateway:${region}::/restapis/${id}` : null;
          const tags = await listTagsForResource({ client, resourceArn: arn, logger });
          resources.push({
            displayName: name,
            resourceId: id,
            resourceArn: arn,
            region,
            accountId: accountId || "",
            source: SOURCE_LABEL,
            lastSynced,
            resourceType: "AWS::ApiGateway::RestApi",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        }
        position = response?.position;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list RestApis" });
        logger?.warn?.("[scanner:apigw] getRestApis failed", { region, error });
        break;
      }
    } while (position);
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanApiGatewayApiKeys({ regions, logger, syncedAt, accountId, credentials, apiKeyIds } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const ids = uniqueTrimmed(apiKeyIds);

  for (const region of targetRegions) {
    const client = createApigwClient(region, credentials);
    let position = undefined;
    do {
      try {
        const response = await client.send(new GetApiKeysCommand({ position, includeValues: false }));
        for (const key of response?.items || []) {
          if (ids.length > 0 && !ids.includes(key?.id)) continue;
          const id = key?.id;
          const arn = id ? `arn:aws:apigateway:${region}::/apikeys/${id}` : null;
          const tags = await listTagsForResource({ client, resourceArn: arn, logger });
          resources.push({
            displayName: key?.name || id,
            resourceId: id,
            resourceArn: arn,
            region,
            accountId: accountId || "",
            source: SOURCE_LABEL,
            lastSynced,
            resourceType: "AWS::ApiGateway::ApiKey",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        }
        position = response?.position;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list API keys" });
        logger?.warn?.("[scanner:apigw] getApiKeys failed", { region, error });
        break;
      }
    } while (position);
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanApiGatewayResources(options = {}) {
  // We expose RestApis and ApiKeys in the service-level scan. Stages/Deployments require per-API context.
  const [apis, keys] = await Promise.all([
    scanApiGatewayRestApis(options),
    scanApiGatewayApiKeys(options),
  ]);
  return {
    service: SERVICE_LABEL,
    regions: apis?.regions || options?.regions || [DEFAULT_REGION],
    resources: [...(apis?.resources || []), ...(keys?.resources || [])],
    errors: [...(apis?.errors || []), ...(keys?.errors || [])],
    lastSynced: apis?.lastSynced || keys?.lastSynced || new Date().toISOString(),
  };
}


