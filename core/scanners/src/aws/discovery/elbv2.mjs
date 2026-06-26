import {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand,
  DescribeListenersCommand,
  DescribeTargetGroupsCommand,
  DescribeTagsCommand,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { DEFAULT_REGION, coerceRegions, uniqueTrimmed, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "ElasticLoadBalancingV2";

function createElbv2Client(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new ElasticLoadBalancingV2Client(config);
}

async function listTagsForResource({ client, resourceArns, logger }) {
  const tags = {};
  if (!resourceArns || resourceArns.length === 0) return tags;
  try {
    const response = await client.send(new DescribeTagsCommand({ ResourceArns: resourceArns }));
    const tagDescriptions = response?.TagDescriptions || [];
    for (const desc of tagDescriptions) {
      const arn = desc?.ResourceArn;
      if (!arn) continue;
      tags[arn] = normalizeTags(desc?.Tags);
    }
  } catch (error) {
    const code = error?.name || error?.Code;
    if (code !== "ResourceNotFoundException" && code !== "AccessDeniedException") {
      logger?.warn?.("[scanner:elbv2] DescribeTags failed", { resourceArns, error });
    }
  }
  return tags;
}

export async function scanElbv2LoadBalancers({
  regions,
  logger,
  syncedAt,
  accountId,
  credentials,
  loadBalancerArns,
} = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const filteredArns = uniqueTrimmed(loadBalancerArns);
  const hasFilter = filteredArns.length > 0;

  for (const region of targetRegions) {
    const client = createElbv2Client(region, credentials);

    if (hasFilter) {
      try {
        const response = await client.send(
          new DescribeLoadBalancersCommand({ LoadBalancerArns: filteredArns })
        );
        await collectLoadBalancers({ response, accountId, region, resources, lastSynced, client, logger });
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe load balancers" });
        logger?.warn?.("[scanner:elbv2] describeLoadBalancers filtered failed", { region, error });
      }
      continue;
    }

    let marker = undefined;
    do {
      try {
        const response = await client.send(
          new DescribeLoadBalancersCommand({ Marker: marker })
        );
        await collectLoadBalancers({ response, accountId, region, resources, lastSynced, client, logger });
        marker = response?.NextMarker;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe load balancers" });
        logger?.warn?.("[scanner:elbv2] describeLoadBalancers failed", { region, error });
        break;
      }
    } while (marker);
  }

  return {
    service: SERVICE_LABEL,
    regions: targetRegions,
    resources,
    errors,
    lastSynced,
  };
}

export async function scanElbv2Listeners({
  regions,
  logger,
  syncedAt,
  accountId,
  credentials,
  listenerArns,
} = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const filteredArns = uniqueTrimmed(listenerArns);
  const hasFilter = filteredArns.length > 0;

  for (const region of targetRegions) {
    const client = createElbv2Client(region, credentials);

    if (hasFilter) {
      try {
        const response = await client.send(
          new DescribeListenersCommand({ ListenerArns: filteredArns })
        );
        collectListeners({ response, accountId, region, resources, lastSynced });
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe listeners" });
        logger?.warn?.("[scanner:elbv2] describeListeners filtered failed", { region, error });
      }
      continue;
    }

    // No unfiltered scan: requires LoadBalancerArn; skip when filter not provided
  }

  return {
    service: SERVICE_LABEL,
    regions: targetRegions,
    resources,
    errors,
    lastSynced,
  };
}

export async function scanElbv2TargetGroups({
  regions,
  logger,
  syncedAt,
  accountId,
  credentials,
  targetGroupArns,
} = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const filteredArns = uniqueTrimmed(targetGroupArns);
  const hasFilter = filteredArns.length > 0;

  for (const region of targetRegions) {
    const client = createElbv2Client(region, credentials);

    if (hasFilter) {
      try {
        const response = await client.send(
          new DescribeTargetGroupsCommand({ TargetGroupArns: filteredArns })
        );
        await collectTargetGroups({ response, accountId, region, resources, lastSynced, client, logger });
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe target groups" });
        logger?.warn?.("[scanner:elbv2] describeTargetGroups filtered failed", { region, error });
      }
      continue;
    }

    let marker = undefined;
    do {
      try {
        const response = await client.send(
          new DescribeTargetGroupsCommand({ Marker: marker })
        );
        await collectTargetGroups({ response, accountId, region, resources, lastSynced, client, logger });
        marker = response?.NextMarker;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe target groups" });
        logger?.warn?.("[scanner:elbv2] describeTargetGroups failed", { region, error });
        break;
      }
    } while (marker);
  }

  return {
    service: SERVICE_LABEL,
    regions: targetRegions,
    resources,
    errors,
    lastSynced,
  };
}

export async function scanElbv2Resources(options = {}) {
  const [lbs, tgs] = await Promise.all([
    scanElbv2LoadBalancers(options),
    scanElbv2TargetGroups(options),
  ]);
  // listeners require explicit ARNs, so exclude in full scan by default
  return {
    service: SERVICE_LABEL,
    regions: lbs?.regions || options?.regions || [DEFAULT_REGION],
    resources: [...(lbs?.resources || []), ...(tgs?.resources || [])],
    errors: [...(lbs?.errors || []), ...(tgs?.errors || [])],
    lastSynced: lbs?.lastSynced || tgs?.lastSynced || new Date().toISOString(),
  };
}

async function collectLoadBalancers({ response, accountId, region, resources, lastSynced, client, logger }) {
  const lbs = response?.LoadBalancers || [];
  const arns = lbs.map((lb) => lb?.LoadBalancerArn).filter(Boolean);
  const allTags = arns.length > 0 ? await listTagsForResource({ client, resourceArns: arns, logger }) : {};
  
  for (const lb of lbs) {
    const arn = lb?.LoadBalancerArn || null;
    const name = lb?.LoadBalancerName || arn || "LoadBalancer";
    const tags = allTags[arn] || {};
    resources.push({
      displayName: name,
      resourceId: arn || name,
      resourceArn: arn,
      region,
      accountId: accountId || "",
      source: SOURCE_LABEL,
      lastSynced,
      resourceType: "AWS::ElasticLoadBalancingV2::LoadBalancer",
      service: SERVICE_LABEL,
      details: {
        tags,
      },
    });
  }
}

function collectListeners({ response, accountId, region, resources, lastSynced }) {
  for (const listener of response?.Listeners || []) {
    const arn = listener?.ListenerArn || null;
    resources.push({
      displayName: arn || "Listener",
      resourceId: arn || "Listener",
      resourceArn: arn,
      region,
      accountId: accountId || "",
      source: SOURCE_LABEL,
      lastSynced,
      resourceType: "AWS::ElasticLoadBalancingV2::Listener",
      service: SERVICE_LABEL,
    });
  }
}

async function collectTargetGroups({ response, accountId, region, resources, lastSynced, client, logger }) {
  const tgs = response?.TargetGroups || [];
  const arns = tgs.map((tg) => tg?.TargetGroupArn).filter(Boolean);
  const allTags = arns.length > 0 ? await listTagsForResource({ client, resourceArns: arns, logger }) : {};
  
  for (const tg of tgs) {
    const arn = tg?.TargetGroupArn || null;
    const name = tg?.TargetGroupName || arn || "TargetGroup";
    const tags = allTags[arn] || {};
    resources.push({
      displayName: name,
      resourceId: arn || name,
      resourceArn: arn,
      region,
      accountId: accountId || "",
      source: SOURCE_LABEL,
      lastSynced,
      resourceType: "AWS::ElasticLoadBalancingV2::TargetGroup",
      service: SERVICE_LABEL,
      details: {
        tags,
      },
    });
  }
}


