import {
  RDSClient,
  DescribeDBInstancesCommand,
  DescribeDBClustersCommand,
  DescribeDBSubnetGroupsCommand,
  DescribeDBParameterGroupsCommand,
  ListTagsForResourceCommand,
} from "@aws-sdk/client-rds";
import { DEFAULT_REGION, coerceRegions, uniqueTrimmed, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "RDS";

function createRdsClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new RDSClient(config);
}

async function listTagsForResource({ client, resourceArn, logger }) {
  if (!resourceArn) return {};
  try {
    const response = await client.send(new ListTagsForResourceCommand({ ResourceName: resourceArn }));
    return normalizeTags(response?.TagList);
  } catch (error) {
    const code = error?.name || error?.Code;
    if (code !== "ResourceNotFoundException" && code !== "AccessDeniedException") {
      logger?.warn?.("[scanner:rds] ListTagsForResource failed", { resourceArn, error });
    }
  }
  return {};
}

export async function scanRdsDbInstances({ regions, logger, syncedAt, accountId, credentials, dbInstanceIdentifiers } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const ids = uniqueTrimmed(dbInstanceIdentifiers);

  for (const region of targetRegions) {
    const client = createRdsClient(region, credentials);
    if (ids.length > 0) {
      for (const id of ids) {
        try {
          const response = await client.send(new DescribeDBInstancesCommand({ DBInstanceIdentifier: id }));
          await collectDbInstances({ response, region, accountId, lastSynced, resources, client, logger });
        } catch (error) {
          errors.push({ region, message: error?.message || "Failed to describe DBInstance" });
          logger?.warn?.("[scanner:rds] describeDBInstances filtered failed", { region, id, error });
        }
      }
      continue;
    }

    let marker = undefined;
    do {
      try {
        const response = await client.send(new DescribeDBInstancesCommand({ Marker: marker }));
        await collectDbInstances({ response, region, accountId, lastSynced, resources, client, logger });
        marker = response?.Marker;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list DBInstances" });
        logger?.warn?.("[scanner:rds] describeDBInstances failed", { region, error });
        break;
      }
    } while (marker);
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanRdsDbClusters({ regions, logger, syncedAt, accountId, credentials, dbClusterIdentifiers } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const ids = uniqueTrimmed(dbClusterIdentifiers);

  for (const region of targetRegions) {
    const client = createRdsClient(region, credentials);
    if (ids.length > 0) {
      for (const id of ids) {
        try {
          const response = await client.send(new DescribeDBClustersCommand({ DBClusterIdentifier: id }));
          await collectDbClusters({ response, region, accountId, lastSynced, resources, client, logger });
        } catch (error) {
          errors.push({ region, message: error?.message || "Failed to describe DBCluster" });
          logger?.warn?.("[scanner:rds] describeDBClusters filtered failed", { region, id, error });
        }
      }
      continue;
    }

    let marker = undefined;
    do {
      try {
        const response = await client.send(new DescribeDBClustersCommand({ Marker: marker }));
        await collectDbClusters({ response, region, accountId, lastSynced, resources, client, logger });
        marker = response?.Marker;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list DBClusters" });
        logger?.warn?.("[scanner:rds] describeDBClusters failed", { region, error });
        break;
      }
    } while (marker);
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanRdsDbSubnetGroups({ regions, logger, syncedAt, accountId, credentials, dbSubnetGroupNames } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const names = uniqueTrimmed(dbSubnetGroupNames);

  for (const region of targetRegions) {
    const client = createRdsClient(region, credentials);
    if (names.length > 0) {
      for (const name of names) {
        try {
          const response = await client.send(new DescribeDBSubnetGroupsCommand({ DBSubnetGroupName: name }));
          collectDbSubnetGroups({ response, region, accountId, lastSynced, resources });
        } catch (error) {
          errors.push({ region, message: error?.message || "Failed to describe DBSubnetGroup" });
          logger?.warn?.("[scanner:rds] describeDBSubnetGroups filtered failed", { region, name, error });
        }
      }
      continue;
    }

    let marker = undefined;
    do {
      try {
        const response = await client.send(new DescribeDBSubnetGroupsCommand({ Marker: marker }));
        collectDbSubnetGroups({ response, region, accountId, lastSynced, resources });
        marker = response?.Marker;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list DBSubnetGroups" });
        logger?.warn?.("[scanner:rds] describeDBSubnetGroups failed", { region, error });
        break;
      }
    } while (marker);
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanRdsDbParameterGroups({ regions, logger, syncedAt, accountId, credentials, dbParameterGroupNames } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const names = uniqueTrimmed(dbParameterGroupNames);

  for (const region of targetRegions) {
    const client = createRdsClient(region, credentials);
    if (names.length > 0) {
      for (const name of names) {
        try {
          const response = await client.send(new DescribeDBParameterGroupsCommand({ DBParameterGroupName: name }));
          collectDbParameterGroups({ response, region, accountId, lastSynced, resources });
        } catch (error) {
          errors.push({ region, message: error?.message || "Failed to describe DBParameterGroup" });
          logger?.warn?.("[scanner:rds] describeDBParameterGroups filtered failed", { region, name, error });
        }
      }
      continue;
    }

    let marker = undefined;
    do {
      try {
        const response = await client.send(new DescribeDBParameterGroupsCommand({ Marker: marker }));
        collectDbParameterGroups({ response, region, accountId, lastSynced, resources });
        marker = response?.Marker;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list DBParameterGroups" });
        logger?.warn?.("[scanner:rds] describeDBParameterGroups failed", { region, error });
        break;
      }
    } while (marker);
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanRdsResources(options = {}) {
  const [dbi, dbc, dbsg, dbpg] = await Promise.all([
    scanRdsDbInstances(options),
    scanRdsDbClusters(options),
    scanRdsDbSubnetGroups(options),
    scanRdsDbParameterGroups(options),
  ]);
  return {
    service: SERVICE_LABEL,
    regions: dbi?.regions || options?.regions || [DEFAULT_REGION],
    resources: [
      ...(dbi?.resources || []),
      ...(dbc?.resources || []),
      ...(dbsg?.resources || []),
      ...(dbpg?.resources || []),
    ],
    errors: [...(dbi?.errors || []), ...(dbc?.errors || []), ...(dbsg?.errors || []), ...(dbpg?.errors || [])],
    lastSynced: dbi?.lastSynced || dbc?.lastSynced || dbsg?.lastSynced || dbpg?.lastSynced || new Date().toISOString(),
  };
}

async function collectDbInstances({ response, region, accountId, lastSynced, resources, client, logger }) {
  for (const db of response?.DBInstances || []) {
    const id = db?.DBInstanceIdentifier || "db-instance";
    const arn = db?.DBInstanceArn || null;
    const tags = await listTagsForResource({ client, resourceArn: arn, logger });
    resources.push({
      displayName: id,
      resourceId: id,
      resourceArn: arn,
      region,
      accountId: accountId || "",
      source: SOURCE_LABEL,
      lastSynced,
      resourceType: "AWS::RDS::DBInstance",
      service: SERVICE_LABEL,
      details: {
        tags,
      },
    });
  }
}

async function collectDbClusters({ response, region, accountId, lastSynced, resources, client, logger }) {
  for (const cluster of response?.DBClusters || []) {
    const id = cluster?.DBClusterIdentifier || "db-cluster";
    const arn = cluster?.DBClusterArn || null;
    const tags = await listTagsForResource({ client, resourceArn: arn, logger });
    resources.push({
      displayName: id,
      resourceId: id,
      resourceArn: arn,
      region,
      accountId: accountId || "",
      source: SOURCE_LABEL,
      lastSynced,
      resourceType: "AWS::RDS::DBCluster",
      service: SERVICE_LABEL,
      details: {
        tags,
      },
    });
  }
}

function collectDbSubnetGroups({ response, region, accountId, lastSynced, resources }) {
  for (const group of response?.DBSubnetGroups || []) {
    const name = group?.DBSubnetGroupName || "db-subnet-group";
    resources.push({
      displayName: name,
      resourceId: name,
      resourceArn: null,
      region,
      accountId: accountId || "",
      source: SOURCE_LABEL,
      lastSynced,
      resourceType: "AWS::RDS::DBSubnetGroup",
      service: SERVICE_LABEL,
    });
  }
}

function collectDbParameterGroups({ response, region, accountId, lastSynced, resources }) {
  for (const group of response?.DBParameterGroups || []) {
    const name = group?.DBParameterGroupName || "db-parameter-group";
    resources.push({
      displayName: name,
      resourceId: name,
      resourceArn: null,
      region,
      accountId: accountId || "",
      source: SOURCE_LABEL,
      lastSynced,
      resourceType: "AWS::RDS::DBParameterGroup",
      service: SERVICE_LABEL,
    });
  }
}


