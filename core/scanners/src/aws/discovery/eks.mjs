import {
  EKSClient,
  ListClustersCommand,
  DescribeClusterCommand,
  ListNodegroupsCommand,
  DescribeNodegroupCommand,
  ListFargateProfilesCommand,
  DescribeFargateProfileCommand,
  ListTagsForResourceCommand,
} from "@aws-sdk/client-eks";
import { DEFAULT_REGION, coerceRegions, uniqueTrimmed, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "EKS";

function createEksClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new EKSClient(config);
}

async function listTagsForResource({ client, resourceArn, logger }) {
  if (!resourceArn) return {};
  try {
    const response = await client.send(new ListTagsForResourceCommand({ resourceArn }));
    return normalizeTags(response?.tags);
  } catch (error) {
    const code = error?.name || error?.Code;
    if (code !== "ResourceNotFoundException" && code !== "AccessDeniedException") {
      logger?.warn?.("[scanner:eks] ListTagsForResource failed", { resourceArn, error });
    }
  }
  return {};
}

export async function scanEksClusters({ regions, logger, syncedAt, accountId, credentials, clusterNames } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const names = uniqueTrimmed(clusterNames);

  for (const region of targetRegions) {
    const client = createEksClient(region, credentials);
    if (names.length > 0) {
      for (const name of names) {
        try {
          const response = await client.send(new DescribeClusterCommand({ name }));
          const cluster = response?.cluster;
          if (!cluster) continue;
          const arn = cluster?.arn || null;
          const displayName = cluster?.name || arn || "Cluster";
          const tags = await listTagsForResource({ client, resourceArn: arn, logger });
          resources.push({
            displayName,
            resourceId: arn || displayName,
            resourceArn: arn,
            region,
            accountId: accountId || "",
            source: SOURCE_LABEL,
            lastSynced,
            resourceType: "AWS::EKS::Cluster",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        } catch (error) {
          errors.push({ region, message: error?.message || "Failed to describe EKS cluster" });
          logger?.warn?.("[scanner:eks] describeCluster failed", { region, name, error });
        }
      }
      continue;
    }

    let nextToken = undefined;
    do {
      try {
        const list = await client.send(new ListClustersCommand({ nextToken }));
        for (const name of list?.clusters || []) {
          try {
            const response = await client.send(new DescribeClusterCommand({ name }));
            const cluster = response?.cluster;
            if (!cluster) continue;
            const arn = cluster?.arn || null;
            const displayName = cluster?.name || arn || "Cluster";
            const tags = await listTagsForResource({ client, resourceArn: arn, logger });
            resources.push({
              displayName,
              resourceId: arn || displayName,
              resourceArn: arn,
              region,
              accountId: accountId || "",
              source: SOURCE_LABEL,
              lastSynced,
              resourceType: "AWS::EKS::Cluster",
              service: SERVICE_LABEL,
              details: {
                tags,
              },
            });
          } catch (error) {
            errors.push({ region, message: error?.message || "Failed to describe EKS cluster" });
            logger?.warn?.("[scanner:eks] describeCluster failed", { region, name, error });
          }
        }
        nextToken = list?.nextToken;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list EKS clusters" });
        logger?.warn?.("[scanner:eks] listClusters failed", { region, error });
        break;
      }
    } while (nextToken);
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanEksNodegroups({ regions, logger, syncedAt, accountId, credentials, nodegroupArns } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const arns = uniqueTrimmed(nodegroupArns);

  function parseClusterFromNodegroupArn(arn) {
    // arn:aws:eks:region:acct:nodegroup/cluster/name/uuid
    if (!arn || !arn.includes(":nodegroup/")) return null;
    const after = arn.split(":nodegroup/")[1];
    if (!after) return null;
    return after.split("/")[0] || null;
  }

  for (const region of targetRegions) {
    const client = createEksClient(region, credentials);
    if (arns.length > 0) {
      for (const arn of arns) {
        const clusterName = parseClusterFromNodegroupArn(arn);
        const nodegroupName = arn?.split("/")?.[2];
        if (!clusterName || !nodegroupName) continue;
        try {
          const response = await client.send(new DescribeNodegroupCommand({ clusterName, nodegroupName }));
          const ng = response?.nodegroup;
          if (!ng) continue;
          const ngArn = ng?.nodegroupArn || arn;
          const displayName = ng?.nodegroupName || ngArn;
          const tags = await listTagsForResource({ client, resourceArn: ngArn, logger });
          resources.push({
            displayName,
            resourceId: ngArn || displayName,
            resourceArn: ngArn,
            region,
            accountId: accountId || "",
            source: SOURCE_LABEL,
            lastSynced,
            resourceType: "AWS::EKS::Nodegroup",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        } catch (error) {
          errors.push({ region, message: error?.message || "Failed to describe EKS nodegroup" });
          logger?.warn?.("[scanner:eks] describeNodegroup failed", { region, arn, error });
        }
      }
      continue;
    }

    // No safe unfiltered scan for nodegroups without per-cluster enumeration; skip by default
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanEksFargateProfiles({ regions, logger, syncedAt, accountId, credentials, fargateProfileArns } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const arns = uniqueTrimmed(fargateProfileArns);

  function parseClusterFromProfileArn(arn) {
    // arn:aws:eks:region:acct:fargateprofile/cluster/name/uuid
    if (!arn || !arn.includes(":fargateprofile/")) return null;
    const after = arn.split(":fargateprofile/")[1];
    if (!after) return null;
    return after.split("/")[0] || null;
  }

  for (const region of targetRegions) {
    const client = createEksClient(region, credentials);
    if (arns.length > 0) {
      for (const arn of arns) {
        const clusterName = parseClusterFromProfileArn(arn);
        const profileName = arn?.split("/")?.[2];
        if (!clusterName || !profileName) continue;
        try {
          const response = await client.send(new DescribeFargateProfileCommand({ clusterName, fargateProfileName: profileName }));
          const fp = response?.fargateProfile;
          if (!fp) continue;
          const fpArn = fp?.fargateProfileArn || arn;
          const displayName = fp?.fargateProfileName || fpArn;
          const tags = await listTagsForResource({ client, resourceArn: fpArn, logger });
          resources.push({
            displayName,
            resourceId: fpArn || displayName,
            resourceArn: fpArn,
            region,
            accountId: accountId || "",
            source: SOURCE_LABEL,
            lastSynced,
            resourceType: "AWS::EKS::FargateProfile",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        } catch (error) {
          errors.push({ region, message: error?.message || "Failed to describe EKS fargate profile" });
          logger?.warn?.("[scanner:eks] describeFargateProfile failed", { region, arn, error });
        }
      }
    }
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanEksResources(options = {}) {
  const [clusters, nodegroups, fargate] = await Promise.all([
    scanEksClusters(options),
    scanEksNodegroups(options),
    scanEksFargateProfiles(options),
  ]);
  return {
    service: SERVICE_LABEL,
    regions: clusters?.regions || options?.regions || [DEFAULT_REGION],
    resources: [
      ...(clusters?.resources || []),
      ...(nodegroups?.resources || []),
      ...(fargate?.resources || []),
    ],
    errors: [...(clusters?.errors || []), ...(nodegroups?.errors || []), ...(fargate?.errors || [])],
    lastSynced: clusters?.lastSynced || nodegroups?.lastSynced || fargate?.lastSynced || new Date().toISOString(),
  };
}


