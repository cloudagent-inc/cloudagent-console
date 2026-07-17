import { CloudWatchLogsClient, DescribeLogGroupsCommand, ListTagsLogGroupCommand } from "@aws-sdk/client-cloudwatch-logs";
import { DEFAULT_REGION, coerceRegions, uniqueTrimmed, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "CloudWatchLogs";
const LOG_GROUP_NAME_PATTERN = /^[\.\-_/#A-Za-z0-9]+$/;

function createLogsClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new CloudWatchLogsClient(config);
}

function normalizeLogGroupName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  // CloudWatch Logs ARNs are shaped like:
  // arn:aws:logs:region:account-id:log-group:<group-name>:*
  // arn:aws:logs:region:account-id:log-group:<group-name>:log-stream:<stream-name>
  if (raw.startsWith("arn:")) {
    const marker = ":log-group:";
    const markerIndex = raw.indexOf(marker);
    if (markerIndex >= 0) {
      let name = raw.slice(markerIndex + marker.length);
      const streamDelimiter = ":log-stream:";
      if (name.includes(streamDelimiter)) {
        name = name.split(streamDelimiter)[0];
      }
      if (name.endsWith(":*")) {
        name = name.slice(0, -2);
      }
      return name.trim();
    }
  }

  // Some inputs come as "<name>:*".
  if (raw.endsWith(":*")) {
    return raw.slice(0, -2).trim();
  }

  return raw;
}

async function listTagsForResource({ client, logGroupName, logger }) {
  if (!logGroupName) return {};
  try {
    const response = await client.send(new ListTagsLogGroupCommand({ logGroupName }));
    return normalizeTags(response?.tags);
  } catch (error) {
    const code = error?.name || error?.Code;
    if (code !== "ResourceNotFoundException" && code !== "AccessDeniedException") {
      logger?.warn?.("[scanner:logs] ListTagsLogGroup failed", { logGroupName, error });
    }
  }
  return {};
}

export async function scanCloudWatchLogGroups({
  regions,
  logger,
  syncedAt,
  accountId,
  credentials,
  logGroupNames,
} = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const names = uniqueTrimmed(logGroupNames).map(normalizeLogGroupName).filter(Boolean);
  const hasFilter = names.length > 0;

  for (const region of targetRegions) {
    const client = createLogsClient(region, credentials);

    if (hasFilter) {
      for (const name of names) {
        if (!LOG_GROUP_NAME_PATTERN.test(name)) {
          logger?.warn?.("[scanner:logs] skipping invalid log group name", { region, name });
          continue;
        }
        try {
          // Use name as prefix to retrieve the single group
          const response = await client.send(
            new DescribeLogGroupsCommand({ logGroupNamePrefix: name })
          );
          for (const group of response?.logGroups || []) {
            if (group?.logGroupName !== name) continue;
            const tags = await listTagsForResource({ client, logGroupName: name, logger });
            resources.push({
              displayName: name,
              resourceId: name,
              resourceArn: group?.arn || null,
              region,
              accountId: accountId || "",
              source: SOURCE_LABEL,
              lastSynced,
              resourceType: "AWS::Logs::LogGroup",
              service: SERVICE_LABEL,
              details: {
                tags,
              },
            });
          }
        } catch (error) {
          errors.push({
            region,
            message: error?.message || "Failed to describe log group",
          });
          logger?.warn?.("[scanner:logs] describeLogGroups failed", { region, error, name });
        }
      }
      continue;
    }

    let nextToken = undefined;
    do {
      try {
        const response = await client.send(
          new DescribeLogGroupsCommand({ nextToken: nextToken })
        );
        for (const group of response?.logGroups || []) {
          const name = group?.logGroupName;
          const tags = await listTagsForResource({ client, logGroupName: name, logger });
          resources.push({
            displayName: name || "LogGroup",
            resourceId: name || "LogGroup",
            resourceArn: group?.arn || null,
            region,
            accountId: accountId || "",
            source: SOURCE_LABEL,
            lastSynced,
            resourceType: "AWS::Logs::LogGroup",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        }
        nextToken = response?.nextToken;
      } catch (error) {
        errors.push({
          region,
          message: error?.message || "Failed to describe log groups",
        });
        logger?.warn?.("[scanner:logs] describeLogGroups failed", { region, error });
        break;
      }
    } while (nextToken);
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanCloudWatchLogsResources(options = {}) {
  return scanCloudWatchLogGroups(options);
}

