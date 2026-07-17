import {
  DynamoDBClient,
  ListTablesCommand,
  DescribeTableCommand,
  ListTagsOfResourceCommand,
} from "@aws-sdk/client-dynamodb";
import { DEFAULT_REGION, coerceRegions, extractAccountIdFromArn, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "DynamoDB";
const TABLE_RESOURCE_TYPE = "AWS::DynamoDB::Table";

function createDynamoClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new DynamoDBClient(config);
}

export async function scanDynamoDbResources(options = {}) {
  return scanDynamoDbTables({ ...options, resourceType: TABLE_RESOURCE_TYPE });
}

async function scanDynamoDbTables({
  regions,
  logger,
  syncedAt,
  accountId,
  credentials,
  tableNames,
  resourceType,
} = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const filteredTableNames = Array.isArray(tableNames)
    ? [...new Set(tableNames.map((name) => name?.trim()).filter(Boolean))]
    : [];
  const hasFilter = filteredTableNames.length > 0;

  for (const region of targetRegions) {
    const client = createDynamoClient(region, credentials);

    if (hasFilter) {
      for (const tableName of filteredTableNames) {
        await describeTable({
          client,
          tableName,
          region,
          accountId,
          lastSynced,
          resources,
          errors,
          logger,
          resourceType,
        });
      }
      continue;
    }

    let ExclusiveStartTableName = undefined;
    do {
      try {
        const response = await client.send(new ListTablesCommand({ ExclusiveStartTableName }));
        const tableList = response?.TableNames || [];
        for (const tableName of tableList) {
          await describeTable({
            client,
            tableName,
            region,
            accountId,
            lastSynced,
            resources,
            errors,
            logger,
            resourceType,
          });
        }
        ExclusiveStartTableName = response?.LastEvaluatedTableName;
      } catch (error) {
        errors.push({
          region,
          message: error?.message || "Failed to list DynamoDB tables",
        });
        logger?.warn?.("[scanner:dynamodb] ListTables failed", { region, error });
        break;
      }
    } while (ExclusiveStartTableName);
  }

  return {
    service: SERVICE_LABEL,
    regions: targetRegions,
    resources,
    errors,
    lastSynced,
  };
}

async function describeTable({
  client,
  tableName,
  region,
  accountId,
  lastSynced,
  resources,
  errors,
  logger,
  resourceType,
}) {
  try {
    const response = await client.send(new DescribeTableCommand({ TableName: tableName }));
    const table = response?.Table;
    if (!table) return;

    const tableArn = table.TableArn || null;
    const resolvedAccountId = tableArn ? extractAccountIdFromArn(tableArn) : accountId || "";

    const tags = {};
    if (tableArn) {
      try {
        const tagsResponse = await client.send(
          new ListTagsOfResourceCommand({ ResourceArn: tableArn })
        );
        Object.assign(tags, normalizeTags(tagsResponse?.Tags));
      } catch (tagError) {
        const code = tagError?.name || tagError?.Code;
        if (code !== "ResourceNotFoundException" && code !== "AccessDeniedException") {
          errors.push({
            tableName,
            region,
            stage: "ListTagsOfResource",
            message: tagError?.message || "Failed to list DynamoDB table tags",
          });
          logger?.warn?.("[scanner:dynamodb] ListTagsOfResource failed", {
            tableName,
            region,
            error: tagError,
          });
        }
      }
    }

    resources.push({
      displayName: table.TableName || tableName,
      resourceId: table.TableName || tableName,
      resourceArn: tableArn,
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
  } catch (error) {
    errors.push({
      tableName,
      region,
      message: error?.message || "Failed to describe DynamoDB table",
    });
    logger?.warn?.("[scanner:dynamodb] DescribeTable failed", { tableName, region, error });
  }
}
