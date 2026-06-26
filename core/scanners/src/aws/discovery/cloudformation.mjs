import {
  CloudFormationClient,
  ListStacksCommand,
  DescribeStackResourcesCommand,
} from "@aws-sdk/client-cloudformation";
import { DEFAULT_REGION, coerceRegions, extractAccountIdFromArn } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "CloudFormation";
const RESOURCE_TYPE = "AWS::CloudFormation::Stack";

function summarizeResourceTypes(resources = []) {
  const counts = new Map();
  for (const resource of resources) {
    const resourceType = resource?.resourceType || RESOURCE_TYPE;
    counts.set(resourceType, (counts.get(resourceType) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function createCloudFormationClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new CloudFormationClient(config);
}

function extractRegionFromArn(arn) {
  if (typeof arn !== "string") return null;
  const parts = arn.split(":");
  return parts.length >= 4 ? parts[3] || null : null;
}

export async function scanCloudFormationResources({
  regions,
  logger,
  syncedAt,
  accountId,
  credentials,
} = {}) {
  return scanCloudFormationStacks({ regions, logger, syncedAt, accountId, credentials });
}

async function scanCloudFormationStacks({
  regions,
  logger,
  syncedAt,
  accountId,
  credentials,
} = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const stacks = [];
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();

  for (const region of targetRegions) {
    const client = createCloudFormationClient(region, credentials);
    let nextToken = undefined;
    do {
      try {
        const response = await client.send(
          new ListStacksCommand({
            NextToken: nextToken,
          })
        );

        for (const summary of response?.StackSummaries || []) {
          // Skip stacks that are fully deleted
          if (summary?.StackStatus === "DELETE_COMPLETE") continue;

          const stackId = summary?.StackId;
          const stackName = summary?.StackName;
          if (!stackId || !stackName) continue;

          const stackAccountId = extractAccountIdFromArn(stackId) || accountId || "";
          const stackRecord = {
            stackId,
            name: stackName,
            accountId: stackAccountId,
            region,
          };
          const description = summary?.TemplateDescription || summary?.Description;
          if (description) stackRecord.description = description;

          stacks.push(stackRecord);
          resources.push({
            displayName: stackName,
            resourceId: stackId,
            resourceArn: stackId,
            region,
            accountId: stackAccountId,
            source: SOURCE_LABEL,
            lastSynced,
            resourceType: RESOURCE_TYPE,
            service: SERVICE_LABEL,
            details: {
              tags: {},
              stackId,
              stackName,
              stackStatus: summary?.StackStatus || null,
              driftStatus: summary?.DriftInformation?.StackDriftStatus || null,
              lastDriftCheckTimestamp:
                summary?.DriftInformation?.LastCheckTimestamp?.toISOString?.() ||
                summary?.DriftInformation?.LastCheckTimestamp ||
                null,
            },
          });
        }

        nextToken = response?.NextToken;
      } catch (error) {
        errors.push({
          region,
          message: error?.message || "Failed to list CloudFormation stacks",
        });
        logger?.warn?.("[scanner:cloudformation] listStacks failed", { region, error });
        break;
      }
    } while (nextToken);
  }

  return {
    service: SERVICE_LABEL,
    regions: targetRegions,
    resources,
    stacks,
    errors,
    lastSynced,
  };
}

export async function getCloudFormationStackResources({
  stackId,
  region,
  logger,
  syncedAt,
  accountId,
  credentials,
} = {}) {
  if (!stackId) {
    throw new Error("stackId is required to fetch CloudFormation stack resources");
  }

  const inferredRegion = region?.trim() || extractRegionFromArn(stackId);
  const resolvedRegion = inferredRegion || DEFAULT_REGION;
  const client = createCloudFormationClient(resolvedRegion, credentials);
  const lastSynced = syncedAt || new Date().toISOString();
  const resolvedAccountId = extractAccountIdFromArn(stackId) || accountId || "";
  const resources = [];
  const errors = [];

  try {
    const response = await client.send(
      new DescribeStackResourcesCommand({
        StackName: stackId,
      })
    );

    for (const resource of response?.StackResources || []) {
      const logicalId = resource?.LogicalResourceId || null;
      const physicalId = resource?.PhysicalResourceId || null;
      const resourceType = resource?.ResourceType || RESOURCE_TYPE;
      const displayName = logicalId || physicalId || resourceType;
      const resourceArn = physicalId && physicalId.startsWith("arn:") ? physicalId : null;

      resources.push({
        displayName,
        resourceId: physicalId || logicalId || resourceType,
        resourceArn,
        logicalResourceId: logicalId,
        physicalResourceId: physicalId,
        region: resolvedRegion,
        accountId: resolvedAccountId,
        source: SOURCE_LABEL,
        lastSynced,
        resourceType,
        service: SERVICE_LABEL,
        details: {
          tags: {},
          logicalResourceId: logicalId,
          physicalResourceId: physicalId,
          resourceStatus: resource?.ResourceStatus || null,
          stackId,
          stackName: resource?.StackName || null,
        },
      });
    }

    logger?.info?.("[scanner:cloudformation] describeStackResources completed", {
      stackId,
      region: resolvedRegion,
      resourceCount: resources.length,
      resourceTypes: summarizeResourceTypes(resources),
    });
  } catch (error) {
    errors.push({
      stackId,
      region: resolvedRegion,
      message: error?.message || "Failed to describe CloudFormation stack resources",
    });
    logger?.warn?.("[scanner:cloudformation] describeStackResources failed", {
      stackId,
      region: resolvedRegion,
      error,
    });
  }

  if (resources.length === 0 && errors.length === 0) {
    logger?.warn?.("[scanner:cloudformation] describeStackResources returned no resources", {
      stackId,
      region: resolvedRegion,
    });
  }

  return {
    service: SERVICE_LABEL,
    stackId,
    region: resolvedRegion,
    resources,
    errors,
    lastSynced,
  };
}
