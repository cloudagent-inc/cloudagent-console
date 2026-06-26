import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeSecurityGroupsCommand,
  DescribeVpcsCommand,
  DescribeSubnetsCommand,
  DescribeInternetGatewaysCommand,
  DescribeNatGatewaysCommand,
  DescribeLaunchTemplatesCommand,
  DescribeVolumesCommand,
  DescribeSnapshotsCommand,
} from "@aws-sdk/client-ec2";
import { DEFAULT_REGION, coerceRegions, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "EC2";
const INSTANCE_RESOURCE_TYPE = "AWS::EC2::Instance";

function createEc2Client(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new EC2Client(config);
}

function chunk(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}


export async function scanEc2Resources(options = {}) {
  const [instances, securityGroups, vpcs, subnets, igws, ngws] = await Promise.all([
    scanEc2Instances({ ...options, resourceType: INSTANCE_RESOURCE_TYPE }),
    scanEc2SecurityGroups(options),
    scanEc2Vpcs(options),
    scanEc2Subnets(options),
    scanEc2InternetGateways(options),
    scanEc2NatGateways(options),
  ]);

  const allRegions =
    instances?.regions ||
    securityGroups?.regions ||
    vpcs?.regions ||
    subnets?.regions ||
    igws?.regions ||
    ngws?.regions ||
    options?.regions || [DEFAULT_REGION];

  return {
    service: SERVICE_LABEL,
    regions: allRegions,
    resources: [
      ...(instances?.resources || []),
      ...(securityGroups?.resources || []),
      ...(vpcs?.resources || []),
      ...(subnets?.resources || []),
      ...(igws?.resources || []),
      ...(ngws?.resources || []),
    ],
    errors: [
      ...(instances?.errors || []),
      ...(securityGroups?.errors || []),
      ...(vpcs?.errors || []),
      ...(subnets?.errors || []),
      ...(igws?.errors || []),
      ...(ngws?.errors || []),
    ],
    lastSynced:
      instances?.lastSynced ||
      securityGroups?.lastSynced ||
      vpcs?.lastSynced ||
      subnets?.lastSynced ||
      igws?.lastSynced ||
      ngws?.lastSynced ||
      new Date().toISOString(),
  };
}

async function scanEc2Instances({
  regions,
  logger,
  syncedAt,
  accountId,
  credentials,
  instanceIds,
  resourceType,
} = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const filteredInstanceIds = Array.isArray(instanceIds)
    ? [...new Set(instanceIds.map((id) => id?.trim()).filter(Boolean))]
    : [];
  const hasFilter = filteredInstanceIds.length > 0;

  for (const region of targetRegions) {
    const ec2 = createEc2Client(region, credentials);

    if (hasFilter) {
      const batches = chunk(filteredInstanceIds, 100);
      for (const batch of batches) {
        try {
          const response = await ec2.send(new DescribeInstancesCommand({ InstanceIds: batch }));
          collectInstances({
            response,
            accountId,
            region,
            resources,
            lastSynced,
            resourceType,
          });
        } catch (error) {
          errors.push({
            region,
            instanceIds: batch,
            message: error?.message || "Failed to describe EC2 instances",
          });
          logger?.warn?.("[scanner:ec2] describeInstances filtered request failed", {
            region,
            instanceIds: batch,
            error,
          });
        }
      }
      continue;
    }

    let nextToken = undefined;
    do {
      try {
        const response = await ec2.send(new DescribeInstancesCommand({ NextToken: nextToken }));
        collectInstances({
          response,
          accountId,
          region,
          resources,
          lastSynced,
          resourceType,
        });
        nextToken = response?.NextToken;
      } catch (error) {
        errors.push({
          region,
          message: error?.message || "Failed to describe EC2 instances",
        });
        logger?.warn?.("[scanner:ec2] describeInstances failed", { region, error });
        break;
      }
    } while (nextToken);
  }

  return {
    service: SERVICE_LABEL,
    regions: targetRegions,
    resources,
    errors,
    lastSynced,
  };
}

// --- Additional EC2 resource scanners ---

export async function scanEc2SecurityGroups({
  regions,
  logger,
  syncedAt,
  accountId,
  credentials,
  securityGroupIds,
} = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const ids = Array.isArray(securityGroupIds)
    ? [...new Set(securityGroupIds.map((id) => id?.trim()).filter(Boolean))]
    : [];
  for (const region of targetRegions) {
    const ec2 = createEc2Client(region, credentials);
    if (ids.length > 0) {
      try {
        const response = await ec2.send(new DescribeSecurityGroupsCommand({ GroupIds: ids }));
        for (const sg of response?.SecurityGroups || []) {
          const id = sg?.GroupId;
          const name = sg?.GroupName || id;
          resources.push({
            displayName: name || id,
            resourceId: id || name,
            resourceArn: null,
            region,
            accountId: accountId || "",
            source: "AWS Resource Scan",
            lastSynced,
            resourceType: "AWS::EC2::SecurityGroup",
            service: SERVICE_LABEL,
            details: {
              tags: normalizeTags(sg?.Tags),
            },
          });
        }
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe security groups" });
        logger?.warn?.("[scanner:ec2] describeSecurityGroups failed", { region, error });
      }
      continue;
    }

    let nextToken = undefined;
    do {
      try {
        const response = await ec2.send(
          new DescribeSecurityGroupsCommand({ NextToken: nextToken, MaxResults: 100 })
        );
        for (const sg of response?.SecurityGroups || []) {
          const id = sg?.GroupId;
          const name = sg?.GroupName || id;
          resources.push({
            displayName: name || id,
            resourceId: id || name,
            resourceArn: null,
            region,
            accountId: accountId || "",
            source: "AWS Resource Scan",
            lastSynced,
            resourceType: "AWS::EC2::SecurityGroup",
            service: SERVICE_LABEL,
            details: {
              tags: normalizeTags(sg?.Tags),
            },
          });
        }
        nextToken = response?.NextToken;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list security groups" });
        logger?.warn?.("[scanner:ec2] describeSecurityGroups list failed", { region, error });
        break;
      }
    } while (nextToken);
  }
  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanEc2Vpcs({ regions, logger, syncedAt, accountId, credentials, vpcIds } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const ids = Array.isArray(vpcIds) ? [...new Set(vpcIds.map((id) => id?.trim()).filter(Boolean))] : [];
  for (const region of targetRegions) {
    const ec2 = createEc2Client(region, credentials);
    if (ids.length > 0) {
      try {
        const response = await ec2.send(new DescribeVpcsCommand({ VpcIds: ids }));
        for (const vpc of response?.Vpcs || []) {
          const id = vpc?.VpcId;
          const tags = normalizeTags(vpc?.Tags);
          const name = tags?.Name || id;
          resources.push({
            displayName: name || id,
            resourceId: id || name,
            resourceArn: null,
            region,
            accountId: accountId || "",
            source: "AWS Resource Scan",
            lastSynced,
            resourceType: "AWS::EC2::VPC",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        }
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe VPCs" });
        logger?.warn?.("[scanner:ec2] describeVpcs failed", { region, error });
      }
      continue;
    }

    let nextToken = undefined;
    do {
      try {
        const response = await ec2.send(
          new DescribeVpcsCommand({ NextToken: nextToken, MaxResults: 100 })
        );
        for (const vpc of response?.Vpcs || []) {
          const id = vpc?.VpcId;
          const tags = normalizeTags(vpc?.Tags);
          const name = tags?.Name || id;
          resources.push({
            displayName: name || id,
            resourceId: id || name,
            resourceArn: null,
            region,
            accountId: accountId || "",
            source: "AWS Resource Scan",
            lastSynced,
            resourceType: "AWS::EC2::VPC",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        }
        nextToken = response?.NextToken;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list VPCs" });
        logger?.warn?.("[scanner:ec2] describeVpcs list failed", { region, error });
        break;
      }
    } while (nextToken);
  }
  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanEc2Subnets({
  regions,
  logger,
  syncedAt,
  accountId,
  credentials,
  subnetIds,
} = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const ids = Array.isArray(subnetIds)
    ? [...new Set(subnetIds.map((id) => id?.trim()).filter(Boolean))]
    : [];
  for (const region of targetRegions) {
    const ec2 = createEc2Client(region, credentials);
    if (ids.length > 0) {
      try {
        const response = await ec2.send(new DescribeSubnetsCommand({ SubnetIds: ids }));
        for (const subnet of response?.Subnets || []) {
          const id = subnet?.SubnetId;
          const tags = normalizeTags(subnet?.Tags);
          const name = tags?.Name || id;
          resources.push({
            displayName: name || id,
            resourceId: id || name,
            resourceArn: null,
            region,
            accountId: accountId || "",
            source: "AWS Resource Scan",
            lastSynced,
            resourceType: "AWS::EC2::Subnet",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        }
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe subnets" });
        logger?.warn?.("[scanner:ec2] describeSubnets failed", { region, error });
      }
      continue;
    }

    let nextToken = undefined;
    do {
      try {
        const response = await ec2.send(
          new DescribeSubnetsCommand({ NextToken: nextToken, MaxResults: 100 })
        );
        for (const subnet of response?.Subnets || []) {
          const id = subnet?.SubnetId;
          const tags = normalizeTags(subnet?.Tags);
          const name = tags?.Name || id;
          resources.push({
            displayName: name || id,
            resourceId: id || name,
            resourceArn: null,
            region,
            accountId: accountId || "",
            source: "AWS Resource Scan",
            lastSynced,
            resourceType: "AWS::EC2::Subnet",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        }
        nextToken = response?.NextToken;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list subnets" });
        logger?.warn?.("[scanner:ec2] describeSubnets list failed", { region, error });
        break;
      }
    } while (nextToken);
  }
  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanEc2InternetGateways({
  regions,
  logger,
  syncedAt,
  accountId,
  credentials,
  internetGatewayIds,
} = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const ids = Array.isArray(internetGatewayIds)
    ? [...new Set(internetGatewayIds.map((id) => id?.trim()).filter(Boolean))]
    : [];
  for (const region of targetRegions) {
    const ec2 = createEc2Client(region, credentials);
    if (ids.length > 0) {
      try {
        const response = await ec2.send(
          new DescribeInternetGatewaysCommand({ InternetGatewayIds: ids })
        );
        for (const igw of response?.InternetGateways || []) {
          const id = igw?.InternetGatewayId;
          const tags = normalizeTags(igw?.Tags);
          const name = tags?.Name || id;
          resources.push({
            displayName: name || id,
            resourceId: id || name,
            resourceArn: null,
            region,
            accountId: accountId || "",
            source: "AWS Resource Scan",
            lastSynced,
            resourceType: "AWS::EC2::InternetGateway",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        }
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe internet gateways" });
        logger?.warn?.("[scanner:ec2] describeInternetGateways failed", { region, error });
      }
      continue;
    }

    let nextToken = undefined;
    do {
      try {
        const response = await ec2.send(
          new DescribeInternetGatewaysCommand({ NextToken: nextToken, MaxResults: 100 })
        );
        for (const igw of response?.InternetGateways || []) {
          const id = igw?.InternetGatewayId;
          const tags = normalizeTags(igw?.Tags);
          const name = tags?.Name || id;
          resources.push({
            displayName: name || id,
            resourceId: id || name,
            resourceArn: null,
            region,
            accountId: accountId || "",
            source: "AWS Resource Scan",
            lastSynced,
            resourceType: "AWS::EC2::InternetGateway",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        }
        nextToken = response?.NextToken;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list internet gateways" });
        logger?.warn?.("[scanner:ec2] describeInternetGateways list failed", { region, error });
        break;
      }
    } while (nextToken);
  }
  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanEc2NatGateways({
  regions,
  logger,
  syncedAt,
  accountId,
  credentials,
  natGatewayIds,
} = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const ids = Array.isArray(natGatewayIds)
    ? [...new Set(natGatewayIds.map((id) => id?.trim()).filter(Boolean))]
    : [];
  for (const region of targetRegions) {
    const ec2 = createEc2Client(region, credentials);
    if (ids.length > 0) {
      try {
        const response = await ec2.send(new DescribeNatGatewaysCommand({ NatGatewayIds: ids }));
        for (const ngw of response?.NatGateways || []) {
          const id = ngw?.NatGatewayId;
          const tags = normalizeTags(ngw?.Tags);
          resources.push({
            displayName: id || "NatGateway",
            resourceId: id || "NatGateway",
            resourceArn: null,
            region,
            accountId: accountId || "",
            source: "AWS Resource Scan",
            lastSynced,
            resourceType: "AWS::EC2::NatGateway",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        }
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe NAT gateways" });
        logger?.warn?.("[scanner:ec2] describeNatGateways failed", { region, error });
      }
      continue;
    }

    let nextToken = undefined;
    do {
      try {
        const response = await ec2.send(
          new DescribeNatGatewaysCommand({ NextToken: nextToken, MaxResults: 100 })
        );
        for (const ngw of response?.NatGateways || []) {
          const id = ngw?.NatGatewayId;
          const tags = normalizeTags(ngw?.Tags);
          resources.push({
            displayName: id || "NatGateway",
            resourceId: id || "NatGateway",
            resourceArn: null,
            region,
            accountId: accountId || "",
            source: "AWS Resource Scan",
            lastSynced,
            resourceType: "AWS::EC2::NatGateway",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        }
        nextToken = response?.NextToken;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list NAT gateways" });
        logger?.warn?.("[scanner:ec2] describeNatGateways list failed", { region, error });
        break;
      }
    } while (nextToken);
  }
  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanEc2LaunchTemplates({ regions, logger, syncedAt, accountId, credentials, launchTemplateIds, launchTemplateNames } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const ids = Array.isArray(launchTemplateIds) ? [...new Set(launchTemplateIds.map((id) => id?.trim()).filter(Boolean))] : [];
  const names = Array.isArray(launchTemplateNames) ? [...new Set(launchTemplateNames.map((n) => n?.trim()).filter(Boolean))] : [];
  for (const region of targetRegions) {
    const ec2 = createEc2Client(region, credentials);
    let nextToken = undefined;
    do {
      try {
        const response = await ec2.send(new DescribeLaunchTemplatesCommand({ NextToken: nextToken, LaunchTemplateIds: ids.length ? ids : undefined, LaunchTemplateNames: names.length ? names : undefined }));
        for (const lt of response?.LaunchTemplates || []) {
          const id = lt?.LaunchTemplateId;
          const name = lt?.LaunchTemplateName || id;
          const tags = normalizeTags(lt?.Tags);
          resources.push({
            displayName: name || id,
            resourceId: id || name,
            resourceArn: null,
            region,
            accountId: accountId || "",
            source: "AWS Resource Scan",
            lastSynced,
            resourceType: "AWS::EC2::LaunchTemplate",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        }
        nextToken = response?.NextToken;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe launch templates" });
        logger?.warn?.("[scanner:ec2] describeLaunchTemplates failed", { region, error });
        break;
      }
    } while (nextToken);
  }
  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanEc2Volumes({ regions, logger, syncedAt, accountId, credentials, volumeIds } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const ids = Array.isArray(volumeIds) ? [...new Set(volumeIds.map((id) => id?.trim()).filter(Boolean))] : [];
  for (const region of targetRegions) {
    const ec2 = createEc2Client(region, credentials);
    let nextToken = undefined;
    do {
      try {
        const response = await ec2.send(new DescribeVolumesCommand({ NextToken: nextToken, VolumeIds: ids.length ? ids : undefined }));
        for (const vol of response?.Volumes || []) {
          const id = vol?.VolumeId;
          const tags = normalizeTags(vol?.Tags);
          resources.push({
            displayName: id || "Volume",
            resourceId: id || "Volume",
            resourceArn: null,
            region,
            accountId: accountId || "",
            source: "AWS Resource Scan",
            lastSynced,
            resourceType: "AWS::EC2::Volume",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        }
        nextToken = response?.NextToken;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe EBS volumes" });
        logger?.warn?.("[scanner:ec2] describeVolumes failed", { region, error });
        break;
      }
    } while (nextToken);
  }
  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanEc2Snapshots({ regions, logger, syncedAt, accountId, credentials, snapshotIds } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const ids = Array.isArray(snapshotIds) ? [...new Set(snapshotIds.map((id) => id?.trim()).filter(Boolean))] : [];
  for (const region of targetRegions) {
    const ec2 = createEc2Client(region, credentials);
    let nextToken = undefined;
    do {
      try {
        const response = await ec2.send(new DescribeSnapshotsCommand({ NextToken: nextToken, SnapshotIds: ids.length ? ids : undefined, OwnerIds: [accountId || "self"] }));
        for (const sn of response?.Snapshots || []) {
          const id = sn?.SnapshotId;
          const tags = normalizeTags(sn?.Tags);
          resources.push({
            displayName: id || "Snapshot",
            resourceId: id || "Snapshot",
            resourceArn: null,
            region,
            accountId: accountId || "",
            source: "AWS Resource Scan",
            lastSynced,
            resourceType: "AWS::EC2::Snapshot",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        }
        nextToken = response?.NextToken;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe EBS snapshots" });
        logger?.warn?.("[scanner:ec2] describeSnapshots failed", { region, error });
        break;
      }
    } while (nextToken);
  }
  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

function collectInstances({ response, accountId, region, resources, lastSynced, resourceType }) {
  const reservations = response?.Reservations || [];
  for (const reservation of reservations) {
    const reservationAccountId = reservation?.OwnerId || accountId || "";
    for (const instance of reservation?.Instances || []) {
      const instanceId = instance?.InstanceId;
      if (!instanceId) continue;

      const tags = normalizeTags(instance?.Tags);
      const displayName = tags?.Name || instanceId;
      const resolvedAccountId = reservationAccountId || accountId || "";
      const resourceArn =
        resolvedAccountId && instanceId
          ? `arn:aws:ec2:${region}:${resolvedAccountId}:instance/${instanceId}`
          : null;

      resources.push({
        displayName,
        resourceId: instanceId,
        resourceArn,
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
    }
  }
}
