import {
  AutoScalingClient,
  DescribeAutoScalingGroupsCommand,
  DescribeLaunchConfigurationsCommand,
} from "@aws-sdk/client-auto-scaling";
import { DEFAULT_REGION, coerceRegions, uniqueTrimmed, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "AutoScaling";

function createAsgClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new AutoScalingClient(config);
}

// Deprecated: Use normalizeTags from shared.mjs instead
function toTagMap(tags) {
  return normalizeTags(tags);
}

export async function scanAutoScalingGroups({ regions, logger, syncedAt, accountId, credentials, autoScalingGroupNames } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const names = uniqueTrimmed(autoScalingGroupNames);

  for (const region of targetRegions) {
    const client = createAsgClient(region, credentials);
    if (names.length > 0) {
      try {
        const response = await client.send(new DescribeAutoScalingGroupsCommand({ AutoScalingGroupNames: names }));
        collectAsgs({ response, region, accountId, lastSynced, resources });
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe AutoScalingGroups" });
        logger?.warn?.("[scanner:autoscaling] describeAutoScalingGroups filtered failed", { region, error });
      }
      continue;
    }

    let nextToken = undefined;
    do {
      try {
        const response = await client.send(new DescribeAutoScalingGroupsCommand({ NextToken: nextToken }));
        collectAsgs({ response, region, accountId, lastSynced, resources });
        nextToken = response?.NextToken;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe AutoScalingGroups" });
        logger?.warn?.("[scanner:autoscaling] describeAutoScalingGroups failed", { region, error });
        break;
      }
    } while (nextToken);
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanLaunchConfigurations({ regions, logger, syncedAt, accountId, credentials, launchConfigurationNames } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const names = uniqueTrimmed(launchConfigurationNames);

  for (const region of targetRegions) {
    const client = createAsgClient(region, credentials);
    if (names.length > 0) {
      try {
        const response = await client.send(new DescribeLaunchConfigurationsCommand({ LaunchConfigurationNames: names }));
        collectLaunchConfigs({ response, region, accountId, lastSynced, resources });
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe LaunchConfigurations" });
        logger?.warn?.("[scanner:autoscaling] describeLaunchConfigurations filtered failed", { region, error });
      }
      continue;
    }

    let nextToken = undefined;
    do {
      try {
        const response = await client.send(new DescribeLaunchConfigurationsCommand({ NextToken: nextToken }));
        collectLaunchConfigs({ response, region, accountId, lastSynced, resources });
        nextToken = response?.NextToken;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe LaunchConfigurations" });
        logger?.warn?.("[scanner:autoscaling] describeLaunchConfigurations failed", { region, error });
        break;
      }
    } while (nextToken);
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanAutoScalingResources(options = {}) {
  const [asgs, lcs] = await Promise.all([
    scanAutoScalingGroups(options),
    scanLaunchConfigurations(options),
  ]);
  return {
    service: SERVICE_LABEL,
    regions: asgs?.regions || options?.regions || [DEFAULT_REGION],
    resources: [...(asgs?.resources || []), ...(lcs?.resources || [])],
    errors: [...(asgs?.errors || []), ...(lcs?.errors || [])],
    lastSynced: asgs?.lastSynced || lcs?.lastSynced || new Date().toISOString(),
  };
}

function collectAsgs({ response, region, accountId, lastSynced, resources }) {
  for (const asg of response?.AutoScalingGroups || []) {
    const name = asg?.AutoScalingGroupName || "AutoScalingGroup";
    const tags = toTagMap(asg?.Tags);
    resources.push({
      displayName: name,
      resourceId: name,
      resourceArn: asg?.AutoScalingGroupARN || null,
      region,
      accountId: accountId || "",
      source: SOURCE_LABEL,
      lastSynced,
      resourceType: "AWS::AutoScaling::AutoScalingGroup",
      service: SERVICE_LABEL,
      details: {
        tags,
      },
    });
  }
}

function collectLaunchConfigs({ response, region, accountId, lastSynced, resources }) {
  for (const lc of response?.LaunchConfigurations || []) {
    const name = lc?.LaunchConfigurationName || "LaunchConfiguration";
    resources.push({
      displayName: name,
      resourceId: name,
      resourceArn: null,
      region,
      accountId: accountId || "",
      source: SOURCE_LABEL,
      lastSynced,
      resourceType: "AWS::AutoScaling::LaunchConfiguration",
      service: SERVICE_LABEL,
      details: {
        tags: {},
      },
    });
  }
}


