import {
  ECSClient,
  DescribeClustersCommand,
  DescribeServicesCommand,
  DescribeTaskDefinitionCommand,
  ListTagsForResourceCommand,
} from "@aws-sdk/client-ecs";
import { DEFAULT_REGION, coerceRegions, uniqueTrimmed, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "ECS";

function createEcsClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new ECSClient(config);
}

function extractClusterFromServiceArn(serviceArn) {
  // arn:aws:ecs:region:acct:service/cluster-name/service-name
  if (!serviceArn || !serviceArn.includes(":service/")) return null;
  const after = serviceArn.split(":service/")[1];
  if (!after) return null;
  const parts = after.split("/");
  return parts.length >= 2 ? parts[0] : null;
}

async function listTagsForResource({ client, resourceArn, logger }) {
  if (!resourceArn) return {};
  try {
    const response = await client.send(new ListTagsForResourceCommand({ resourceArn }));
    return normalizeTags(response?.tags);
  } catch (error) {
    const code = error?.name || error?.Code;
    if (code !== "ResourceNotFoundException" && code !== "AccessDeniedException") {
      logger?.warn?.("[scanner:ecs] ListTagsForResource failed", { resourceArn, error });
    }
  }
  return {};
}

export async function scanEcsClusters({
  regions,
  logger,
  syncedAt,
  accountId,
  credentials,
  clusters, // names or ARNs
} = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const identifiers = uniqueTrimmed(clusters);
  const hasFilter = identifiers.length > 0;

  for (const region of targetRegions) {
    const client = createEcsClient(region, credentials);
    if (hasFilter) {
      try {
        const response = await client.send(new DescribeClustersCommand({ clusters: identifiers }));
        for (const cluster of response?.clusters || []) {
          const arn = cluster?.clusterArn || null;
          const name = cluster?.clusterName || arn || "Cluster";
          const tags = await listTagsForResource({ client, resourceArn: arn, logger });
          resources.push({
            displayName: name,
            resourceId: arn || name,
            resourceArn: arn,
            region,
            accountId: accountId || "",
            source: SOURCE_LABEL,
            lastSynced,
            resourceType: "AWS::ECS::Cluster",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        }
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe ECS clusters" });
        logger?.warn?.("[scanner:ecs] describeClusters filtered failed", { region, error });
      }
      continue;
    }

    // No easy full-scan without pagination: skip full cluster enumeration here
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanEcsServices({
  regions,
  logger,
  syncedAt,
  accountId,
  credentials,
  services, // service ARNs or names
} = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const identifiers = uniqueTrimmed(services);
  const hasFilter = identifiers.length > 0;

  for (const region of targetRegions) {
    const client = createEcsClient(region, credentials);
    if (!hasFilter) continue;

    // Group identifiers by cluster (when ARNs are provided); otherwise, attempt a best-effort call without cluster
    const byCluster = new Map();
    for (const id of identifiers) {
      const cluster = id.startsWith("arn:") ? extractClusterFromServiceArn(id) : null;
      const key = cluster || "__unknown__";
      if (!byCluster.has(key)) byCluster.set(key, []);
      byCluster.get(key).push(id);
    }

    for (const [cluster, svcIds] of byCluster.entries()) {
      try {
        const params = { services: svcIds };
        if (cluster && cluster !== "__unknown__") params.cluster = cluster;
        const response = await client.send(new DescribeServicesCommand(params));
        for (const service of response?.services || []) {
          const arn = service?.serviceArn || null;
          const name = service?.serviceName || arn || "Service";
          const tags = await listTagsForResource({ client, resourceArn: arn, logger });
          resources.push({
            displayName: name,
            resourceId: arn || name,
            resourceArn: arn,
            region,
            accountId: accountId || "",
            source: SOURCE_LABEL,
            lastSynced,
            resourceType: "AWS::ECS::Service",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        }
      } catch (error) {
        errors.push({
          region,
          message: error?.message || "Failed to describe ECS services",
        });
        logger?.warn?.("[scanner:ecs] describeServices failed", { region, error, cluster });
      }
    }
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanEcsTaskDefinitions({
  regions,
  logger,
  syncedAt,
  accountId,
  credentials,
  taskDefinitions, // ARNs or family:revision
} = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const identifiers = uniqueTrimmed(taskDefinitions);
  const hasFilter = identifiers.length > 0;

  for (const region of targetRegions) {
    const client = createEcsClient(region, credentials);
    if (!hasFilter) continue;

    for (const id of identifiers) {
      try {
        const response = await client.send(
          new DescribeTaskDefinitionCommand({ taskDefinition: id })
        );
        const td = response?.taskDefinition;
        if (!td) continue;
        const arn = td?.taskDefinitionArn || id;
        const family = td?.family;
        const revision = td?.revision;
        const name = family && revision ? `${family}:${revision}` : arn;
        const tags = await listTagsForResource({ client, resourceArn: arn, logger });
        resources.push({
          displayName: name,
          resourceId: arn || name,
          resourceArn: arn,
          region,
          accountId: accountId || "",
          source: SOURCE_LABEL,
          lastSynced,
          resourceType: "AWS::ECS::TaskDefinition",
          service: SERVICE_LABEL,
          details: {
            tags,
          },
        });
      } catch (error) {
        errors.push({
          region,
          message: error?.message || "Failed to describe ECS task definition",
        });
        logger?.warn?.("[scanner:ecs] describeTaskDefinition failed", { region, error, id });
      }
    }
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanEcsResources(options = {}) {
  const [clusters, services, taskDefs] = await Promise.all([
    scanEcsClusters(options),
    scanEcsServices(options),
    scanEcsTaskDefinitions(options),
  ]);
  return {
    service: SERVICE_LABEL,
    regions: clusters?.regions || options?.regions || [DEFAULT_REGION],
    resources: [
      ...(clusters?.resources || []),
      ...(services?.resources || []),
      ...(taskDefs?.resources || []),
    ],
    errors: [...(clusters?.errors || []), ...(services?.errors || []), ...(taskDefs?.errors || [])],
    lastSynced:
      clusters?.lastSynced || services?.lastSynced || taskDefs?.lastSynced || new Date().toISOString(),
  };
}


