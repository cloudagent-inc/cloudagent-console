import { ApiGatewayV2Client, GetApisCommand, GetStagesCommand, GetIntegrationsCommand, GetRoutesCommand, GetTagsCommand } from "@aws-sdk/client-apigatewayv2";
import { DEFAULT_REGION, coerceRegions, uniqueTrimmed, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "APIGatewayV2";

function createClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new ApiGatewayV2Client(config);
}

async function listTagsForResource({ client, resourceArn, logger }) {
  if (!resourceArn) return {};
  try {
    const response = await client.send(new GetTagsCommand({ ResourceArn: resourceArn }));
    return normalizeTags(response?.Tags);
  } catch (error) {
    const code = error?.name || error?.Code;
    if (code !== "ResourceNotFoundException" && code !== "AccessDeniedException" && code !== "NotFoundException") {
      logger?.warn?.("[scanner:apigwv2] GetTags failed", { resourceArn, error });
    }
  }
  return {};
}

export async function scanApiGatewayV2Apis({ regions, logger, syncedAt, accountId, credentials, apiIds } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();

  for (const region of targetRegions) {
    const client = createClient(region, credentials);
    let nextToken = undefined;
    do {
      try {
        const response = await client.send(new GetApisCommand({ NextToken: nextToken }));
        for (const api of response?.Items || []) {
          if (Array.isArray(apiIds) && apiIds.length && !apiIds.includes(api?.ApiId)) continue;
          const id = api?.ApiId;
          const name = api?.Name || id;
          const arn = api?.ApiId ? `arn:aws:apigateway:${region}::/apis/${id}` : null;
          const tags = await listTagsForResource({ client, resourceArn: arn, logger });
          resources.push({
            displayName: name,
            resourceId: id,
            resourceArn: arn,
            region,
            accountId: accountId || "",
            source: SOURCE_LABEL,
            lastSynced,
            resourceType: "AWS::ApiGatewayV2::Api",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        }
        nextToken = response?.NextToken;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list API Gateway v2 APIs" });
        logger?.warn?.("[scanner:apigwv2] getApis failed", { region, error });
        break;
      }
    } while (nextToken);
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanApiGatewayV2Resources(options = {}) {
  return scanApiGatewayV2Apis(options);
}


