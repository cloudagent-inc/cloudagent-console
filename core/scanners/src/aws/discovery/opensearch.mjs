import { OpenSearchClient, ListDomainNamesCommand, DescribeDomainCommand, ListTagsCommand } from "@aws-sdk/client-opensearch";
import { DEFAULT_REGION, coerceRegions, uniqueTrimmed, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "OpenSearch";

function createOsClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new OpenSearchClient(config);
}

async function listTagsForResource({ client, arn, logger }) {
  if (!arn) return {};
  try {
    const response = await client.send(new ListTagsCommand({ ARN: arn }));
    return normalizeTags(response?.TagList);
  } catch (error) {
    const code = error?.name || error?.Code;
    if (code !== "ResourceNotFoundException" && code !== "AccessDeniedException") {
      logger?.warn?.("[scanner:opensearch] ListTags failed", { arn, error });
    }
  }
  return {};
}

export async function scanOpenSearchDomains({ regions, logger, syncedAt, accountId, credentials, domainNames } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const names = uniqueTrimmed(domainNames);

  for (const region of targetRegions) {
    const client = createOsClient(region, credentials);
    if (names.length > 0) {
      for (const DomainName of names) {
        try {
          const response = await client.send(new DescribeDomainCommand({ DomainName }));
          const status = response?.DomainStatus;
          const arn = status?.ARN || null;
          const name = status?.DomainName || arn || "Domain";
          const tags = await listTagsForResource({ client, arn, logger });
          resources.push({
            displayName: name,
            resourceId: arn || name,
            resourceArn: arn,
            region,
            accountId: accountId || "",
            source: SOURCE_LABEL,
            lastSynced,
            resourceType: "AWS::OpenSearchService::Domain",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        } catch (error) {
          errors.push({ region, message: error?.message || "Failed to describe OpenSearch domain" });
          logger?.warn?.("[scanner:opensearch] describeDomain failed", { region, DomainName, error });
        }
      }
      continue;
    }

    try {
      const list = await client.send(new ListDomainNamesCommand({}));
      for (const entry of list?.DomainNames || []) {
        const DomainName = entry?.DomainName;
        if (!DomainName) continue;
        try {
          const response = await client.send(new DescribeDomainCommand({ DomainName }));
          const status = response?.DomainStatus;
          const arn = status?.ARN || null;
          const name = status?.DomainName || arn || "Domain";
          const tags = await listTagsForResource({ client, arn, logger });
          resources.push({
            displayName: name,
            resourceId: arn || name,
            resourceArn: arn,
            region,
            accountId: accountId || "",
            source: SOURCE_LABEL,
            lastSynced,
            resourceType: "AWS::OpenSearchService::Domain",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        } catch (error) {
          errors.push({ region, message: error?.message || "Failed to describe OpenSearch domain" });
          logger?.warn?.("[scanner:opensearch] describeDomain failed", { region, DomainName, error });
        }
      }
    } catch (error) {
      errors.push({ region, message: error?.message || "Failed to list OpenSearch domains" });
      logger?.warn?.("[scanner:opensearch] listDomainNames failed", { region, error });
    }
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanOpenSearchResources(options = {}) {
  return scanOpenSearchDomains(options);
}


