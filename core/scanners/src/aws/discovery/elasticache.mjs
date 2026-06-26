import {
  ElastiCacheClient,
  DescribeReplicationGroupsCommand,
  DescribeCacheClustersCommand,
  DescribeCacheSubnetGroupsCommand,
  ListTagsForResourceCommand,
} from "@aws-sdk/client-elasticache";
import { DEFAULT_REGION, coerceRegions, uniqueTrimmed, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "ElastiCache";

function createElastiCacheClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new ElastiCacheClient(config);
}

async function listTagsForResource({ client, resourceArn, logger }) {
  if (!resourceArn) return {};
  try {
    const response = await client.send(new ListTagsForResourceCommand({ ResourceName: resourceArn }));
    return normalizeTags(response?.TagList);
  } catch (error) {
    const code = error?.name || error?.Code;
    if (code !== "ResourceNotFoundException" && code !== "AccessDeniedException") {
      logger?.warn?.("[scanner:elasticache] ListTagsForResource failed", { resourceArn, error });
    }
  }
  return {};
}

export async function scanElastiCacheReplicationGroups({ regions, logger, syncedAt, accountId, credentials, replicationGroupIds } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const ids = uniqueTrimmed(replicationGroupIds);

  for (const region of targetRegions) {
    const client = createElastiCacheClient(region, credentials);
    if (ids.length > 0) {
      for (const id of ids) {
        try {
          const response = await client.send(new DescribeReplicationGroupsCommand({ ReplicationGroupId: id }));
          await collectReplicationGroups({ response, region, accountId, lastSynced, resources, client, logger });
        } catch (error) {
          errors.push({ region, message: error?.message || "Failed to describe ReplicationGroup" });
          logger?.warn?.("[scanner:elasticache] describeReplicationGroups filtered failed", { region, id, error });
        }
      }
      continue;
    }

    try {
      const response = await client.send(new DescribeReplicationGroupsCommand({}));
      await collectReplicationGroups({ response, region, accountId, lastSynced, resources, client, logger });
    } catch (error) {
      errors.push({ region, message: error?.message || "Failed to list ReplicationGroups" });
      logger?.warn?.("[scanner:elasticache] describeReplicationGroups failed", { region, error });
    }
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanElastiCacheCacheClusters({ regions, logger, syncedAt, accountId, credentials, cacheClusterIds } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const ids = uniqueTrimmed(cacheClusterIds);

  for (const region of targetRegions) {
    const client = createElastiCacheClient(region, credentials);
    if (ids.length > 0) {
      try {
        const response = await client.send(new DescribeCacheClustersCommand({ CacheClusterId: ids[0], ShowCacheNodeInfo: false }));
        await collectCacheClusters({ response, region, accountId, lastSynced, resources, client, logger });
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe CacheClusters" });
        logger?.warn?.("[scanner:elasticache] describeCacheClusters filtered failed", { region, error });
      }
      continue;
    }

    let marker = undefined;
    do {
      try {
        const response = await client.send(new DescribeCacheClustersCommand({ Marker: marker, ShowCacheNodeInfo: false }));
        await collectCacheClusters({ response, region, accountId, lastSynced, resources, client, logger });
        marker = response?.Marker;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list CacheClusters" });
        logger?.warn?.("[scanner:elasticache] describeCacheClusters failed", { region, error });
        break;
      }
    } while (marker);
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanElastiCacheSubnetGroups({ regions, logger, syncedAt, accountId, credentials, subnetGroupNames } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const names = uniqueTrimmed(subnetGroupNames);

  for (const region of targetRegions) {
    const client = createElastiCacheClient(region, credentials);
    if (names.length > 0) {
      for (const name of names) {
        try {
          const response = await client.send(new DescribeCacheSubnetGroupsCommand({ CacheSubnetGroupName: name }));
          collectSubnetGroups({ response, region, accountId, lastSynced, resources });
        } catch (error) {
          errors.push({ region, message: error?.message || "Failed to describe CacheSubnetGroup" });
          logger?.warn?.("[scanner:elasticache] describeCacheSubnetGroups filtered failed", { region, name, error });
        }
      }
      continue;
    }

    let marker = undefined;
    do {
      try {
        const response = await client.send(new DescribeCacheSubnetGroupsCommand({ Marker: marker }));
        collectSubnetGroups({ response, region, accountId, lastSynced, resources });
        marker = response?.Marker;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list CacheSubnetGroups" });
        logger?.warn?.("[scanner:elasticache] describeCacheSubnetGroups failed", { region, error });
        break;
      }
    } while (marker);
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanElastiCacheResources(options = {}) {
  const [rgs, ccs, sgs] = await Promise.all([
    scanElastiCacheReplicationGroups(options),
    scanElastiCacheCacheClusters(options),
    scanElastiCacheSubnetGroups(options),
  ]);
  return {
    service: SERVICE_LABEL,
    regions: rgs?.regions || options?.regions || [DEFAULT_REGION],
    resources: [
      ...(rgs?.resources || []),
      ...(ccs?.resources || []),
      ...(sgs?.resources || []),
    ],
    errors: [...(rgs?.errors || []), ...(ccs?.errors || []), ...(sgs?.errors || [])],
    lastSynced: rgs?.lastSynced || ccs?.lastSynced || sgs?.lastSynced || new Date().toISOString(),
  };
}

async function collectReplicationGroups({ response, region, accountId, lastSynced, resources, client, logger }) {
  for (const rg of response?.ReplicationGroups || []) {
    const id = rg?.ReplicationGroupId || "replication-group";
    const arn = rg?.ARN || null;
    const tags = await listTagsForResource({ client, resourceArn: arn, logger });
    resources.push({
      displayName: id,
      resourceId: id,
      resourceArn: arn,
      region,
      accountId: accountId || "",
      source: SOURCE_LABEL,
      lastSynced,
      resourceType: "AWS::ElastiCache::ReplicationGroup",
      service: SERVICE_LABEL,
      details: {
        tags,
      },
    });
  }
}

async function collectCacheClusters({ response, region, accountId, lastSynced, resources, client, logger }) {
  for (const cluster of response?.CacheClusters || []) {
    const id = cluster?.CacheClusterId || "cache-cluster";
    const arn = cluster?.ARN || null;
    const tags = await listTagsForResource({ client, resourceArn: arn, logger });
    resources.push({
      displayName: id,
      resourceId: id,
      resourceArn: arn,
      region,
      accountId: accountId || "",
      source: SOURCE_LABEL,
      lastSynced,
      resourceType: "AWS::ElastiCache::CacheCluster",
      service: SERVICE_LABEL,
      details: {
        tags,
      },
    });
  }
}

function collectSubnetGroups({ response, region, accountId, lastSynced, resources }) {
  for (const group of response?.CacheSubnetGroups || []) {
    const name = group?.CacheSubnetGroupName || "cache-subnet-group";
    resources.push({
      displayName: name,
      resourceId: name,
      resourceArn: null,
      region,
      accountId: accountId || "",
      source: SOURCE_LABEL,
      lastSynced,
      resourceType: "AWS::ElastiCache::SubnetGroup",
      service: SERVICE_LABEL,
      details: {
        tags: {},
      },
    });
  }
}


