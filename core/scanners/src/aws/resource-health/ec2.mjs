import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeInstanceStatusCommand,
  DescribeSubnetsCommand,
  DescribeNatGatewaysCommand,
  DescribeSnapshotsCommand,
  DescribeVolumesCommand,
  DescribeVolumeStatusCommand,
  DescribeInternetGatewaysCommand,
  DescribeLaunchTemplatesCommand,
  DescribeLaunchTemplateVersionsCommand,
  DescribeImagesCommand,
} from "@aws-sdk/client-ec2";
import {
  DEFAULT_LOOKBACK_HOURS,
  HEALTH_STATUS,
  createCheckResult,
  createResourceResult,
  extractCidrMask,
  getCloudWatchMetricValues,
  getArnResourceId,
  getOrCreateClient,
  safeTrim,
} from "./shared.mjs";

const SERVICE_API_NAME = "EC2";
const NAT_GATEWAY_METRIC_NAMESPACE = "AWS/NATGateway";
const EBS_METRIC_NAMESPACE = "AWS/EBS";
const BURST_BALANCE_SUPPORTED_VOLUME_TYPES = new Set(["gp2", "st1", "sc1"]);

const EC2_CHECK_IDS = Object.freeze({
  INSTANCE_STATE: "ec2.instance.state",
  INSTANCE_STATUS_CHECKS: "ec2.instance.status_checks",
  SUBNET_IPV4_CAPACITY: "ec2.subnet.available_ip_capacity",
  NAT_LIFECYCLE: "ec2.nat_gateway.lifecycle_state",
  NAT_PACKET_DROPS: "ec2.nat_gateway.packet_drop_count",
  NAT_PORT_ALLOCATION_ERRORS: "ec2.nat_gateway.port_allocation_errors",
  SNAPSHOT_COMPLETION: "ec2.snapshot.completion_state",
  VOLUME_STATUS: "ec2.volume.status",
  VOLUME_BURST_BALANCE: "ec2.volume.burst_balance",
  INTERNET_GATEWAY_ATTACHMENT: "ec2.internet_gateway.attachment_state",
  LAUNCH_TEMPLATE_DEFAULT_VERSION: "ec2.launch_template.default_version_validity",
});

export const EC2_SUPPORTED_RESOURCE_TYPES = Object.freeze([
  "AWS::EC2::Instance",
  "AWS::EC2::Subnet",
  "AWS::EC2::NatGateway",
  "AWS::EC2::Snapshot",
  "AWS::EC2::Volume",
  "AWS::EC2::InternetGateway",
  "AWS::EC2::LaunchTemplate",
]);

function createEc2Client(region, credentials) {
  const config = { region, maxAttempts: 5, retryMode: "standard" };
  if (credentials) config.credentials = credentials;
  return new EC2Client(config);
}

function getEc2Client(region, credentials, cache) {
  return getOrCreateClient(cache, region, () => createEc2Client(region, credentials));
}

function inferResourceId(target, arnPrefix) {
  return (
    safeTrim(target.resourceId) ||
    getArnResourceId(target.resourceArn || target.identifier, arnPrefix) ||
    safeTrim(target.identifier)
  );
}

async function fetchInstance({ target, credentials, cache }) {
  const instanceId = inferResourceId(target, "instance");
  if (!instanceId) throw new Error("Instance ID is required");
  const client = getEc2Client(target.region, credentials, cache);
  const response = await client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
  const instance = response?.Reservations?.[0]?.Instances?.[0];
  if (!instance) throw new Error("EC2 instance not found");
  return { instanceId, instance };
}

async function fetchInstanceStatus({ instanceId, target, credentials, cache }) {
  const client = getEc2Client(target.region, credentials, cache);
  const response = await client.send(
    new DescribeInstanceStatusCommand({
      InstanceIds: [instanceId],
      IncludeAllInstances: true,
    })
  );
  return response?.InstanceStatuses?.[0] || null;
}

async function fetchSubnet({ target, credentials, cache }) {
  const subnetId = inferResourceId(target, "subnet");
  if (!subnetId) throw new Error("Subnet ID is required");
  const client = getEc2Client(target.region, credentials, cache);
  const response = await client.send(new DescribeSubnetsCommand({ SubnetIds: [subnetId] }));
  const subnet = response?.Subnets?.[0];
  if (!subnet) throw new Error("Subnet not found");
  return { subnetId, subnet };
}

async function fetchNatGateway({ target, credentials, cache }) {
  const natGatewayId = inferResourceId(target, "natgateway");
  if (!natGatewayId) throw new Error("NAT Gateway ID is required");
  const client = getEc2Client(target.region, credentials, cache);
  const response = await client.send(new DescribeNatGatewaysCommand({ NatGatewayIds: [natGatewayId] }));
  const natGateway = response?.NatGateways?.[0];
  if (!natGateway) throw new Error("NAT Gateway not found");
  return { natGatewayId, natGateway };
}

async function fetchSnapshot({ target, credentials, cache }) {
  const snapshotId = inferResourceId(target, "snapshot");
  if (!snapshotId) throw new Error("Snapshot ID is required");
  const client = getEc2Client(target.region, credentials, cache);
  const response = await client.send(new DescribeSnapshotsCommand({ SnapshotIds: [snapshotId] }));
  const snapshot = response?.Snapshots?.[0];
  if (!snapshot) throw new Error("Snapshot not found");
  return { snapshotId, snapshot };
}

async function fetchVolumeStatus({ target, credentials, cache }) {
  const volumeId = inferResourceId(target, "volume");
  if (!volumeId) throw new Error("Volume ID is required");
  const client = getEc2Client(target.region, credentials, cache);
  const response = await client.send(new DescribeVolumeStatusCommand({ VolumeIds: [volumeId] }));
  const volumeStatus = response?.VolumeStatuses?.[0] || null;
  return { volumeId, volumeStatus };
}

async function fetchVolume({ target, credentials, cache }) {
  const volumeId = inferResourceId(target, "volume");
  if (!volumeId) throw new Error("Volume ID is required");
  const client = getEc2Client(target.region, credentials, cache);
  const response = await client.send(new DescribeVolumesCommand({ VolumeIds: [volumeId] }));
  const volume = response?.Volumes?.[0];
  if (!volume) throw new Error("EBS volume not found");
  return { volumeId, volume };
}

async function fetchInternetGateway({ target, credentials, cache }) {
  const internetGatewayId = inferResourceId(target, "internet-gateway");
  if (!internetGatewayId) throw new Error("Internet Gateway ID is required");
  const client = getEc2Client(target.region, credentials, cache);
  const response = await client.send(
    new DescribeInternetGatewaysCommand({ InternetGatewayIds: [internetGatewayId] })
  );
  const internetGateway = response?.InternetGateways?.[0];
  if (!internetGateway) throw new Error("Internet Gateway not found");
  return { internetGatewayId, internetGateway };
}

function resolveLaunchTemplateLookup(target) {
  const fromArn = getArnResourceId(target.resourceArn || target.identifier, "launch-template");
  const raw = safeTrim(target.resourceId || fromArn || target.identifier);
  if (!raw) return null;
  if (raw.startsWith("lt-")) return { LaunchTemplateIds: [raw] };
  return { LaunchTemplateNames: [raw] };
}

async function fetchLaunchTemplateDefaultVersion({ target, credentials, cache }) {
  const lookup = resolveLaunchTemplateLookup(target);
  if (!lookup) throw new Error("Launch template identifier is required");
  const client = getEc2Client(target.region, credentials, cache);
  const templatesResponse = await client.send(new DescribeLaunchTemplatesCommand(lookup));
  const launchTemplate = templatesResponse?.LaunchTemplates?.[0];
  if (!launchTemplate) throw new Error("Launch template not found");

  const versionResponse = await client.send(
    new DescribeLaunchTemplateVersionsCommand({
      ...(launchTemplate?.LaunchTemplateId
        ? { LaunchTemplateId: launchTemplate.LaunchTemplateId }
        : { LaunchTemplateName: launchTemplate.LaunchTemplateName }),
      Versions: [String(launchTemplate?.DefaultVersionNumber || "")],
    })
  );
  const defaultVersion = versionResponse?.LaunchTemplateVersions?.[0] || null;
  return { launchTemplate, defaultVersion };
}

async function checkImageExists({ imageId, region, credentials, cache }) {
  if (!imageId) return false;
  const client = getEc2Client(region, credentials, cache);
  try {
    const response = await client.send(new DescribeImagesCommand({ ImageIds: [imageId] }));
    return Array.isArray(response?.Images) && response.Images.length > 0;
  } catch {
    return false;
  }
}

function checkInstanceState({ instance }) {
  const stateName = safeTrim(instance?.State?.Name).toLowerCase();
  const status = stateName === "running" ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.PROBLEM;
  return createCheckResult({
    checkId: EC2_CHECK_IDS.INSTANCE_STATE,
    checkName: "Unexpected instance state changes",
    category: "availability",
    status,
    summary:
      status === HEALTH_STATUS.HEALTHY
        ? "Instance state is running."
        : `Instance state is ${stateName || "unknown"}, not running.`,
    servicesApisUsed: [`${SERVICE_API_NAME}.DescribeInstances`],
    details: { instanceState: stateName || null },
  });
}

function checkInstanceStatusChecks({ instanceStatus, instanceState }) {
  if (instanceState !== "running") {
    return createCheckResult({
      checkId: EC2_CHECK_IDS.INSTANCE_STATUS_CHECKS,
      checkName: "Instance/system status check failures",
      category: "availability",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "Status checks are not evaluated when instance is not running.",
      servicesApisUsed: [`${SERVICE_API_NAME}.DescribeInstanceStatus`],
    });
  }

  const instanceStatusValue = safeTrim(instanceStatus?.InstanceStatus?.Status).toLowerCase();
  const systemStatusValue = safeTrim(instanceStatus?.SystemStatus?.Status).toLowerCase();
  const healthy = instanceStatusValue === "ok" && systemStatusValue === "ok";
  return createCheckResult({
    checkId: EC2_CHECK_IDS.INSTANCE_STATUS_CHECKS,
    checkName: "Instance/system status check failures",
    category: "availability",
    status: healthy ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.PROBLEM,
    summary: healthy
      ? "Both instance and system status checks are OK."
      : `Instance/system status checks are degraded (instance=${instanceStatusValue || "unknown"}, system=${systemStatusValue || "unknown"}).`,
    servicesApisUsed: [`${SERVICE_API_NAME}.DescribeInstanceStatus`],
    details: {
      instanceStatus: instanceStatusValue || null,
      systemStatus: systemStatusValue || null,
    },
  });
}

function checkSubnetIpv4Capacity({ subnet }) {
  const mask = extractCidrMask(subnet?.CidrBlock);
  const available = Number(subnet?.AvailableIpAddressCount);
  if (!Number.isInteger(mask) || !Number.isFinite(available)) {
    return createCheckResult({
      checkId: EC2_CHECK_IDS.SUBNET_IPV4_CAPACITY,
      checkName: "Available IP address capacity",
      category: "capacity",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "Unable to calculate subnet IPv4 remaining capacity.",
      servicesApisUsed: [`${SERVICE_API_NAME}.DescribeSubnets`],
    });
  }

  // AWS reserves 5 IPs per subnet.
  const total = 2 ** (32 - mask);
  const usable = Math.max(total - 5, 0);
  if (usable === 0) {
    return createCheckResult({
      checkId: EC2_CHECK_IDS.SUBNET_IPV4_CAPACITY,
      checkName: "Available IP address capacity",
      category: "capacity",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "Subnet usable IPv4 capacity is zero.",
      servicesApisUsed: [`${SERVICE_API_NAME}.DescribeSubnets`],
    });
  }

  const remainingPct = available / usable;
  const status = remainingPct >= 0.2 ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.PROBLEM;
  return createCheckResult({
    checkId: EC2_CHECK_IDS.SUBNET_IPV4_CAPACITY,
    checkName: "Available IP address capacity",
    category: "capacity",
    status,
    summary:
      status === HEALTH_STATUS.HEALTHY
        ? `Remaining usable IPv4 is ${(remainingPct * 100).toFixed(2)}%.`
        : `Remaining usable IPv4 is ${(remainingPct * 100).toFixed(2)}%, below 20%.`,
    servicesApisUsed: [`${SERVICE_API_NAME}.DescribeSubnets`],
    details: {
      availableIpAddressCount: available,
      usableIpv4Addresses: usable,
      remainingPct,
      cidrBlock: subnet?.CidrBlock || null,
    },
  });
}

function checkNatGatewayLifecycle({ natGateway }) {
  const state = safeTrim(natGateway?.State).toLowerCase();
  const problemStates = new Set(["failed", "deleting", "deleted"]);
  const status = problemStates.has(state) ? HEALTH_STATUS.PROBLEM : HEALTH_STATUS.HEALTHY;
  return createCheckResult({
    checkId: EC2_CHECK_IDS.NAT_LIFECYCLE,
    checkName: "NAT gateway lifecycle state",
    category: "availability",
    status,
    summary:
      status === HEALTH_STATUS.HEALTHY
        ? `NAT Gateway state is ${state || "available"}.`
        : `NAT Gateway state is ${state || "unknown"} (problem state).`,
    servicesApisUsed: [`${SERVICE_API_NAME}.DescribeNatGateways`],
    details: { state: state || null },
  });
}

async function checkNatMetricSumZeroIsHealthy({
  checkId,
  checkName,
  metricName,
  category,
  natGatewayId,
  region,
  credentials,
  lookbackHours,
  cloudWatchClientCache,
}) {
  if (!natGatewayId) {
    return createCheckResult({
      checkId,
      checkName,
      category,
      status: HEALTH_STATUS.UNKNOWN,
      summary: "NAT gateway identifier unavailable for CloudWatch metric query.",
      details: { metricName, lookbackHours },
    });
  }

  try {
    const metricValues = await getCloudWatchMetricValues({
      region,
      credentials,
      namespace: NAT_GATEWAY_METRIC_NAMESPACE,
      metricName,
      dimensions: [{ Name: "NatGatewayId", Value: natGatewayId }],
      lookbackHours,
      statistic: "Sum",
      clientCache: cloudWatchClientCache,
    });

    if (metricValues.length === 0) {
      return createCheckResult({
        checkId,
        checkName,
        category,
        status: HEALTH_STATUS.UNKNOWN,
        summary: `No ${metricName} datapoints found in the last ${lookbackHours}h.`,
        details: { natGatewayId, metricName, datapointCount: 0, lookbackHours },
      });
    }

    const metricSum = metricValues.reduce((sum, value) => sum + value, 0);
    const status = metricSum > 0 ? HEALTH_STATUS.PROBLEM : HEALTH_STATUS.HEALTHY;
    return createCheckResult({
      checkId,
      checkName,
      category,
      status,
      summary:
        status === HEALTH_STATUS.HEALTHY
          ? `No ${checkName.toLowerCase()} in the last ${lookbackHours}h.`
          : `${metricSum} ${checkName.toLowerCase()} in the last ${lookbackHours}h.`,
      details: {
        natGatewayId,
        metricName,
        metricSum,
        datapointCount: metricValues.length,
        lookbackHours,
      },
    });
  } catch (error) {
    return createCheckResult({
      checkId,
      checkName,
      category,
      status: HEALTH_STATUS.ERROR,
      summary: `CloudWatch metric query failed: ${error?.message || "unknown error"}.`,
      details: { natGatewayId, metricName, lookbackHours },
    });
  }
}

async function checkVolumeBurstBalance({
  volumeId,
  volume,
  region,
  credentials,
  lookbackHours,
  cloudWatchClientCache,
}) {
  const volumeType = safeTrim(volume?.VolumeType).toLowerCase();
  if (!volumeId) {
    return createCheckResult({
      checkId: EC2_CHECK_IDS.VOLUME_BURST_BALANCE,
      checkName: "EBS burst balance depletion",
      category: "capacity",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "Volume identifier unavailable for CloudWatch metric query.",
      details: { lookbackHours },
    });
  }

  if (!BURST_BALANCE_SUPPORTED_VOLUME_TYPES.has(volumeType)) {
    return createCheckResult({
      checkId: EC2_CHECK_IDS.VOLUME_BURST_BALANCE,
      checkName: "EBS burst balance depletion",
      category: "capacity",
      status: HEALTH_STATUS.UNKNOWN,
      summary: `BurstBalance is not applicable for volume type ${volumeType || "unknown"}.`,
      details: { volumeId, volumeType: volumeType || null, lookbackHours },
    });
  }

  try {
    const metricValues = await getCloudWatchMetricValues({
      region,
      credentials,
      namespace: EBS_METRIC_NAMESPACE,
      metricName: "BurstBalance",
      dimensions: [{ Name: "VolumeId", Value: volumeId }],
      lookbackHours,
      statistic: "Minimum",
      clientCache: cloudWatchClientCache,
    });

    if (metricValues.length === 0) {
      return createCheckResult({
        checkId: EC2_CHECK_IDS.VOLUME_BURST_BALANCE,
        checkName: "EBS burst balance depletion",
        category: "capacity",
        status: HEALTH_STATUS.UNKNOWN,
        summary: `No BurstBalance datapoints found in the last ${lookbackHours}h.`,
        details: { volumeId, volumeType, datapointCount: 0, lookbackHours },
      });
    }

    const minimumBurstBalance = Math.min(...metricValues);
    const status =
      minimumBurstBalance < 20 ? HEALTH_STATUS.PROBLEM : HEALTH_STATUS.HEALTHY;
    return createCheckResult({
      checkId: EC2_CHECK_IDS.VOLUME_BURST_BALANCE,
      checkName: "EBS burst balance depletion",
      category: "capacity",
      status,
      summary:
        status === HEALTH_STATUS.HEALTHY
          ? `Minimum BurstBalance remained at ${minimumBurstBalance.toFixed(2)}% in the last ${lookbackHours}h.`
          : `Minimum BurstBalance dropped to ${minimumBurstBalance.toFixed(2)}% in the last ${lookbackHours}h.`,
      details: {
        volumeId,
        volumeType,
        minimumBurstBalance,
        datapointCount: metricValues.length,
        lookbackHours,
      },
    });
  } catch (error) {
    return createCheckResult({
      checkId: EC2_CHECK_IDS.VOLUME_BURST_BALANCE,
      checkName: "EBS burst balance depletion",
      category: "capacity",
      status: HEALTH_STATUS.ERROR,
      summary: `CloudWatch metric query failed: ${error?.message || "unknown error"}.`,
      details: { volumeId, volumeType: volumeType || null, lookbackHours },
    });
  }
}

function checkSnapshotCompletion({ snapshot }) {
  const state = safeTrim(snapshot?.State).toLowerCase();
  if (state === "completed") {
    return createCheckResult({
      checkId: EC2_CHECK_IDS.SNAPSHOT_COMPLETION,
      checkName: "Snapshot completion state",
      category: "availability",
      status: HEALTH_STATUS.HEALTHY,
      summary: "Snapshot state is completed.",
      servicesApisUsed: [`${SERVICE_API_NAME}.DescribeSnapshots`],
      details: { state },
    });
  }
  if (state === "pending") {
    const hasStartTime = Boolean(snapshot?.StartTime);
    const startTime = hasStartTime ? new Date(snapshot.StartTime).getTime() : NaN;
    const ageHours = Number.isFinite(startTime) ? (Date.now() - startTime) / (60 * 60 * 1000) : null;
    if (ageHours === null) {
      return createCheckResult({
        checkId: EC2_CHECK_IDS.SNAPSHOT_COMPLETION,
        checkName: "Snapshot completion state",
        category: "availability",
        status: HEALTH_STATUS.UNKNOWN,
        summary: "Snapshot is pending but StartTime is unavailable.",
        servicesApisUsed: [`${SERVICE_API_NAME}.DescribeSnapshots`],
        details: { state },
      });
    }
    const stuck = ageHours > 24;
    return createCheckResult({
      checkId: EC2_CHECK_IDS.SNAPSHOT_COMPLETION,
      checkName: "Snapshot completion state",
      category: "availability",
      status: stuck ? HEALTH_STATUS.PROBLEM : HEALTH_STATUS.UNKNOWN,
      summary: stuck
        ? `Snapshot is pending for ${ageHours.toFixed(1)} hours (>24h).`
        : `Snapshot is pending for ${ageHours.toFixed(1)} hours.`,
      servicesApisUsed: [`${SERVICE_API_NAME}.DescribeSnapshots`],
      details: { state, ageHours },
    });
  }
  return createCheckResult({
    checkId: EC2_CHECK_IDS.SNAPSHOT_COMPLETION,
    checkName: "Snapshot completion state",
    category: "availability",
    status: HEALTH_STATUS.PROBLEM,
    summary: `Snapshot state is ${state || "unknown"}.`,
    servicesApisUsed: [`${SERVICE_API_NAME}.DescribeSnapshots`],
    details: { state: state || null },
  });
}

function checkVolumeStatus({ volumeStatus }) {
  const statusValue = safeTrim(volumeStatus?.VolumeStatus?.Status).toLowerCase();
  if (!statusValue) {
    return createCheckResult({
      checkId: EC2_CHECK_IDS.VOLUME_STATUS,
      checkName: "EBS volume status",
      category: "availability",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "Volume status is unavailable from DescribeVolumeStatus.",
      servicesApisUsed: [`${SERVICE_API_NAME}.DescribeVolumeStatus`],
    });
  }
  const unhealthy = new Set(["impaired", "insufficient-data"]);
  const status = unhealthy.has(statusValue) ? HEALTH_STATUS.PROBLEM : HEALTH_STATUS.HEALTHY;
  return createCheckResult({
    checkId: EC2_CHECK_IDS.VOLUME_STATUS,
    checkName: "EBS volume status",
    category: "availability",
    status,
    summary:
      status === HEALTH_STATUS.HEALTHY
        ? `Volume status is ${statusValue}.`
        : `Volume status is ${statusValue} (problem state).`,
    servicesApisUsed: [`${SERVICE_API_NAME}.DescribeVolumeStatus`],
    details: { volumeStatus: statusValue },
  });
}

function checkInternetGatewayAttachment({ internetGateway }) {
  const attachments = Array.isArray(internetGateway?.Attachments) ? internetGateway.Attachments : [];
  const activeAttachments = attachments.filter(
    (attachment) => safeTrim(attachment?.State).toLowerCase() === "available"
  );
  const healthy = activeAttachments.length > 0;
  return createCheckResult({
    checkId: EC2_CHECK_IDS.INTERNET_GATEWAY_ATTACHMENT,
    checkName: "Internet gateway attachment state",
    category: "configuration",
    status: healthy ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.PROBLEM,
    summary: healthy
      ? "Internet Gateway has at least one available VPC attachment."
      : "Internet Gateway has no available VPC attachments.",
    servicesApisUsed: [`${SERVICE_API_NAME}.DescribeInternetGateways`],
    details: {
      attachmentCount: attachments.length,
      availableAttachmentCount: activeAttachments.length,
      attachmentVpcIds: activeAttachments.map((attachment) => attachment?.VpcId || null).filter(Boolean),
    },
  });
}

async function checkLaunchTemplateDefaultVersion({ launchTemplate, defaultVersion, target, credentials, cache }) {
  const imageId = safeTrim(defaultVersion?.LaunchTemplateData?.ImageId);
  const imageExists = await checkImageExists({
    imageId,
    region: target.region,
    credentials,
    cache,
  });

  const healthy = Boolean(imageId && imageExists);
  return createCheckResult({
    checkId: EC2_CHECK_IDS.LAUNCH_TEMPLATE_DEFAULT_VERSION,
    checkName: "Default launch template version validity",
    category: "configuration",
    status: healthy ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.PROBLEM,
    summary: healthy
      ? "Default launch template version references an existing AMI."
      : "Default launch template version references a missing/invalid AMI.",
    servicesApisUsed: [
      `${SERVICE_API_NAME}.DescribeLaunchTemplates`,
      `${SERVICE_API_NAME}.DescribeLaunchTemplateVersions`,
      `${SERVICE_API_NAME}.DescribeImages`,
    ],
    details: {
      launchTemplateId: launchTemplate?.LaunchTemplateId || null,
      launchTemplateName: launchTemplate?.LaunchTemplateName || null,
      defaultVersionNumber: launchTemplate?.DefaultVersionNumber || null,
      imageId: imageId || null,
      imageExists,
    },
  });
}

function buildCheckError({ checkId, checkName, category, summary, servicesApisUsed }) {
  return createCheckResult({
    checkId,
    checkName,
    category,
    status: HEALTH_STATUS.ERROR,
    summary,
    servicesApisUsed,
  });
}

async function evaluateEc2Instance({ target, credentials, caches }) {
  const checks = [];
  const errors = [];
  try {
    const { instanceId, instance } = await fetchInstance({
      target,
      credentials,
      cache: caches.ec2ClientCache,
    });
    checks.push(checkInstanceState({ instance }));
    const instanceState = safeTrim(instance?.State?.Name).toLowerCase();
    const instanceStatus = await fetchInstanceStatus({
      instanceId,
      target,
      credentials,
      cache: caches.ec2ClientCache,
    });
    checks.push(checkInstanceStatusChecks({ instanceStatus, instanceState }));
  } catch (error) {
    const message = error?.message || "Unable to evaluate EC2 instance checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: EC2_CHECK_IDS.INSTANCE_STATE,
        checkName: "Unexpected instance state changes",
        category: "availability",
        summary: message,
        servicesApisUsed: [`${SERVICE_API_NAME}.DescribeInstances`],
      })
    );
    checks.push(
      buildCheckError({
        checkId: EC2_CHECK_IDS.INSTANCE_STATUS_CHECKS,
        checkName: "Instance/system status check failures",
        category: "availability",
        summary: message,
        servicesApisUsed: [`${SERVICE_API_NAME}.DescribeInstanceStatus`],
      })
    );
  }
  return createResourceResult({ target, checks, errors });
}

async function evaluateEc2Subnet({ target, credentials, caches }) {
  const checks = [];
  const errors = [];
  try {
    const { subnet } = await fetchSubnet({ target, credentials, cache: caches.ec2ClientCache });
    checks.push(checkSubnetIpv4Capacity({ subnet }));
  } catch (error) {
    const message = error?.message || "Unable to evaluate subnet checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: EC2_CHECK_IDS.SUBNET_IPV4_CAPACITY,
        checkName: "Available IP address capacity",
        category: "capacity",
        summary: message,
        servicesApisUsed: [`${SERVICE_API_NAME}.DescribeSubnets`],
      })
    );
  }
  return createResourceResult({ target, checks, errors });
}

async function evaluateEc2NatGateway({ target, credentials, lookbackHours, caches }) {
  const checks = [];
  const errors = [];
  try {
    const { natGatewayId, natGateway } = await fetchNatGateway({
      target,
      credentials,
      cache: caches.ec2ClientCache,
    });
    checks.push(checkNatGatewayLifecycle({ natGateway }));
    checks.push(
      await checkNatMetricSumZeroIsHealthy({
        checkId: EC2_CHECK_IDS.NAT_PACKET_DROPS,
        checkName: "NAT packet drop count",
        metricName: "PacketsDropCount",
        category: "errors",
        natGatewayId,
        region: target.region,
        credentials,
        lookbackHours,
        cloudWatchClientCache: caches.cloudWatchClientCache,
      })
    );
    checks.push(
      await checkNatMetricSumZeroIsHealthy({
        checkId: EC2_CHECK_IDS.NAT_PORT_ALLOCATION_ERRORS,
        checkName: "NAT port allocation errors",
        metricName: "ErrorPortAllocation",
        category: "capacity",
        natGatewayId,
        region: target.region,
        credentials,
        lookbackHours,
        cloudWatchClientCache: caches.cloudWatchClientCache,
      })
    );
  } catch (error) {
    const message = error?.message || "Unable to evaluate NAT gateway checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: EC2_CHECK_IDS.NAT_LIFECYCLE,
        checkName: "NAT gateway lifecycle state",
        category: "availability",
        summary: message,
        servicesApisUsed: [`${SERVICE_API_NAME}.DescribeNatGateways`],
      })
    );
    checks.push(
      buildCheckError({
        checkId: EC2_CHECK_IDS.NAT_PACKET_DROPS,
        checkName: "NAT packet drop count",
        category: "errors",
        summary: message,
        servicesApisUsed: ["CloudWatch.GetMetricStatistics"],
      })
    );
    checks.push(
      buildCheckError({
        checkId: EC2_CHECK_IDS.NAT_PORT_ALLOCATION_ERRORS,
        checkName: "NAT port allocation errors",
        category: "capacity",
        summary: message,
        servicesApisUsed: ["CloudWatch.GetMetricStatistics"],
      })
    );
  }
  return createResourceResult({ target, checks, errors });
}

async function evaluateEc2Snapshot({ target, credentials, caches }) {
  const checks = [];
  const errors = [];
  try {
    const { snapshot } = await fetchSnapshot({
      target,
      credentials,
      cache: caches.ec2ClientCache,
    });
    checks.push(checkSnapshotCompletion({ snapshot }));
  } catch (error) {
    const message = error?.message || "Unable to evaluate snapshot checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: EC2_CHECK_IDS.SNAPSHOT_COMPLETION,
        checkName: "Snapshot completion state",
        category: "availability",
        summary: message,
        servicesApisUsed: [`${SERVICE_API_NAME}.DescribeSnapshots`],
      })
    );
  }
  return createResourceResult({ target, checks, errors });
}

async function evaluateEc2Volume({ target, credentials, lookbackHours, caches }) {
  const checks = [];
  const errors = [];
  try {
    const { volumeId, volume } = await fetchVolume({
      target,
      credentials,
      cache: caches.ec2ClientCache,
    });
    const { volumeStatus } = await fetchVolumeStatus({
      target,
      credentials,
      cache: caches.ec2ClientCache,
    });
    checks.push(checkVolumeStatus({ volumeStatus }));
    checks.push(
      await checkVolumeBurstBalance({
        volumeId,
        volume,
        region: target.region,
        credentials,
        lookbackHours,
        cloudWatchClientCache: caches.cloudWatchClientCache,
      })
    );
  } catch (error) {
    const message = error?.message || "Unable to evaluate volume checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: EC2_CHECK_IDS.VOLUME_STATUS,
        checkName: "EBS volume status",
        category: "availability",
        summary: message,
        servicesApisUsed: [`${SERVICE_API_NAME}.DescribeVolumeStatus`],
      })
    );
    checks.push(
      buildCheckError({
        checkId: EC2_CHECK_IDS.VOLUME_BURST_BALANCE,
        checkName: "EBS burst balance depletion",
        category: "capacity",
        summary: message,
        servicesApisUsed: [
          `${SERVICE_API_NAME}.DescribeVolumes`,
          "CloudWatch.GetMetricStatistics",
        ],
      })
    );
  }
  return createResourceResult({ target, checks, errors });
}

async function evaluateEc2InternetGateway({ target, credentials, caches }) {
  const checks = [];
  const errors = [];
  try {
    const { internetGateway } = await fetchInternetGateway({
      target,
      credentials,
      cache: caches.ec2ClientCache,
    });
    checks.push(checkInternetGatewayAttachment({ internetGateway }));
  } catch (error) {
    const message = error?.message || "Unable to evaluate internet gateway checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: EC2_CHECK_IDS.INTERNET_GATEWAY_ATTACHMENT,
        checkName: "Internet gateway attachment state",
        category: "configuration",
        summary: message,
        servicesApisUsed: [`${SERVICE_API_NAME}.DescribeInternetGateways`],
      })
    );
  }
  return createResourceResult({ target, checks, errors });
}

async function evaluateEc2LaunchTemplate({ target, credentials, caches }) {
  const checks = [];
  const errors = [];
  try {
    const { launchTemplate, defaultVersion } = await fetchLaunchTemplateDefaultVersion({
      target,
      credentials,
      cache: caches.ec2ClientCache,
    });
    checks.push(
      await checkLaunchTemplateDefaultVersion({
        launchTemplate,
        defaultVersion,
        target,
        credentials,
        cache: caches.ec2ClientCache,
      })
    );
  } catch (error) {
    const message = error?.message || "Unable to evaluate launch template checks";
    errors.push(message);
    checks.push(
      buildCheckError({
        checkId: EC2_CHECK_IDS.LAUNCH_TEMPLATE_DEFAULT_VERSION,
        checkName: "Default launch template version validity",
        category: "configuration",
        summary: message,
        servicesApisUsed: [
          `${SERVICE_API_NAME}.DescribeLaunchTemplates`,
          `${SERVICE_API_NAME}.DescribeLaunchTemplateVersions`,
        ],
      })
    );
  }
  return createResourceResult({ target, checks, errors });
}

export async function runEc2HealthChecks({
  resources = [],
  credentials,
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
} = {}) {
  const caches = {
    ec2ClientCache: new Map(),
    cloudWatchClientCache: new Map(),
  };
  const results = [];
  for (const target of resources) {
    if (target.resourceType === "AWS::EC2::Instance") {
      results.push(await evaluateEc2Instance({ target, credentials, caches }));
      continue;
    }
    if (target.resourceType === "AWS::EC2::Subnet") {
      results.push(await evaluateEc2Subnet({ target, credentials, caches }));
      continue;
    }
    if (target.resourceType === "AWS::EC2::NatGateway") {
      results.push(
        await evaluateEc2NatGateway({ target, credentials, lookbackHours, caches })
      );
      continue;
    }
    if (target.resourceType === "AWS::EC2::Snapshot") {
      results.push(await evaluateEc2Snapshot({ target, credentials, caches }));
      continue;
    }
    if (target.resourceType === "AWS::EC2::Volume") {
      results.push(await evaluateEc2Volume({ target, credentials, lookbackHours, caches }));
      continue;
    }
    if (target.resourceType === "AWS::EC2::InternetGateway") {
      results.push(await evaluateEc2InternetGateway({ target, credentials, caches }));
      continue;
    }
    if (target.resourceType === "AWS::EC2::LaunchTemplate") {
      results.push(await evaluateEc2LaunchTemplate({ target, credentials, caches }));
      continue;
    }
  }
  return results;
}
