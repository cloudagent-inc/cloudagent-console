import { CloudFrontClient, ListDistributionsCommand, ListTagsForResourceCommand } from "@aws-sdk/client-cloudfront";
import { DEFAULT_REGION, coerceRegions, uniqueTrimmed, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "CloudFront";

function createCfClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new CloudFrontClient(config);
}

async function listTagsForResource({ client, resourceArn, logger }) {
  if (!resourceArn) return {};
  try {
    const response = await client.send(new ListTagsForResourceCommand({ Resource: resourceArn }));
    return normalizeTags(response?.Tags);
  } catch (error) {
    const code = error?.name || error?.Code;
    if (code !== "ResourceNotFoundException" && code !== "AccessDeniedException") {
      logger?.warn?.("[scanner:cloudfront] ListTagsForResource failed", { resourceArn, error });
    }
  }
  return {};
}

export async function scanCloudFrontDistributions({
  regions,
  logger,
  syncedAt,
  accountId,
  credentials,
  distributionIds,
  distributionArns,
} = {}) {
  // CloudFront is global. Use the first provided region or DEFAULT_REGION once.
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const region = targetRegions[0];
  const client = createCfClient(region, credentials);

  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const ids = uniqueTrimmed(distributionIds);
  const arns = uniqueTrimmed(distributionArns);

  let marker = undefined;
  do {
    try {
      const response = await client.send(new ListDistributionsCommand({ Marker: marker }));
      const list = response?.DistributionList;
      for (const d of list?.Items || []) {
        const id = d?.Id;
        const arn = d?.ARN || null;
        if (ids.length > 0 && !ids.includes(id)) continue;
        if (arns.length > 0 && arn && !arns.includes(arn)) continue;
        const displayName = d?.DomainName || id;
        const tags = await listTagsForResource({ client, resourceArn: arn, logger });
        resources.push({
          displayName,
          resourceId: id, // CFN physical id is distribution Id
          resourceArn: arn,
          region,
          accountId: accountId || "",
          source: SOURCE_LABEL,
          lastSynced,
          resourceType: "AWS::CloudFront::Distribution",
          service: SERVICE_LABEL,
          details: {
            tags,
          },
        });
      }
      marker = list?.NextMarker;
    } catch (error) {
      errors.push({ region, message: error?.message || "Failed to list CloudFront distributions" });
      logger?.warn?.("[scanner:cloudfront] listDistributions failed", { region, error });
      break;
    }
  } while (marker);

  return { service: SERVICE_LABEL, regions: [region], resources, errors, lastSynced };
}

export async function scanCloudFrontResources(options = {}) {
  return scanCloudFrontDistributions(options);
}


