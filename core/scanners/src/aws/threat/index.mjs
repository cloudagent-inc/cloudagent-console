import {
  AccessAnalyzerClient,
  ListAnalyzersCommand,
  ListFindingsCommand as ListAccessAnalyzerFindingsCommand,
} from "@aws-sdk/client-accessanalyzer";
import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeRegionsCommand,
} from "@aws-sdk/client-ec2";
import {
  GetDetectorCommand,
  GetFindingsCommand as GetGuardDutyFindingsCommand,
  GuardDutyClient,
  ListDetectorsCommand,
  ListFindingsCommand as ListGuardDutyFindingsCommand,
} from "@aws-sdk/client-guardduty";
import {
  Inspector2Client,
  ListCoverageCommand,
  ListFindingsCommand as ListInspectorFindingsCommand,
} from "@aws-sdk/client-inspector2";
import {
  DescribeInstanceInformationCommand,
  DescribeInstancePatchStatesCommand,
  ListResourceComplianceSummariesCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";
import globals from "@cloudagent/platform/global-variables";
import { safeTrim } from "@cloudagent/platform/utils";

const DEFAULT_REGION = globals.AWS_REGION;
const MAX_GUARDDUTY_FINDINGS_PER_REGION = 25;
const MAX_INSPECTOR_FINDINGS_PER_REGION = 25;
const MAX_ACCESS_ANALYZER_FINDINGS_PER_ANALYZER = 25;
const MAX_INSPECTOR_COVERAGE_PER_REGION = 100;
const MAX_PATCH_COMPLIANCE_ITEMS = 200;
const MAX_EC2_INSTANCES_PER_REGION = 500;
const MAX_DETAIL_ARRAY_ITEMS = 20;
const MAX_DETAIL_KEYS = 30;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toIsoString(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function compactDetail(value, depth = 0) {
  if (value == null) return null;
  if (depth > 4) return "[truncated]";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (value instanceof Date) return toIsoString(value);
  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_DETAIL_ARRAY_ITEMS)
      .map((item) => compactDetail(item, depth + 1))
      .filter((item) => item != null);
    return items.length > 0 ? items : null;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .slice(0, MAX_DETAIL_KEYS)
      .map(([key, childValue]) => [key, compactDetail(childValue, depth + 1)])
      .filter(([, childValue]) => childValue != null);
    if (entries.length === 0) return null;
    return Object.fromEntries(entries);
  }
  return null;
}

function chunkArray(items, chunkSize) {
  const array = asArray(items);
  if (chunkSize <= 0 || array.length === 0) return [];
  const chunks = [];
  for (let index = 0; index < array.length; index += chunkSize) {
    chunks.push(array.slice(index, index + chunkSize));
  }
  return chunks;
}

function buildAwsConsoleUrl(region, path) {
  if (!region || !path) return null;
  return `https://${encodeURIComponent(region)}.console.aws.amazon.com/${path}`;
}

function buildGuardDutyFindingConsoleUrl({ region, findingId }) {
  if (!region || !findingId) return null;
  const encodedId = encodeURIComponent(findingId);
  return buildAwsConsoleUrl(
    region,
    `guardduty/home?region=${encodeURIComponent(region)}#/findings?search=id%3D${encodedId}`
  );
}

function buildInspectorFindingConsoleUrl({ region, findingArn }) {
  if (!region || !findingArn) return null;
  return buildAwsConsoleUrl(
    region,
    `inspector/v2/home?region=${encodeURIComponent(region)}#/findings?searchString=${encodeURIComponent(
      findingArn
    )}`
  );
}

function buildAccessAnalyzerFindingConsoleUrl({ region, analyzerName, findingId }) {
  if (!region || !analyzerName || !findingId) return null;
  return buildAwsConsoleUrl(
    region,
    `iam/home?region=${encodeURIComponent(
      region
    )}#/access-analyzer/analyzers/${encodeURIComponent(
      analyzerName
    )}/findings/${encodeURIComponent(findingId)}`
  );
}

function describeAccessAnalyzerSeverity(finding = {}) {
  if (finding?.isPublic === true) return "high";
  if (Object.keys(finding?.principal || {}).length > 0) return "medium";
  return "low";
}

function buildAccessAnalyzerDescription(finding = {}) {
  const resourceType = safeTrim(finding?.resourceType) || "resource";
  const resource = safeTrim(finding?.resource);
  if (finding?.isPublic === true) {
    return resource
      ? `${resourceType} ${resource} is accessible from the public internet.`
      : `${resourceType} is accessible from the public internet.`;
  }

  const principalCount = Object.keys(finding?.principal || {}).length;
  if (principalCount > 0) {
    return resource
      ? `${resourceType} ${resource} grants access to ${principalCount} external principal${principalCount === 1 ? "" : "s"}.`
      : `${resourceType} grants access to ${principalCount} external principal${principalCount === 1 ? "" : "s"}.`;
  }

  return resource
    ? `${resourceType} ${resource} has an active Access Analyzer finding.`
    : `${resourceType} has an active Access Analyzer finding.`;
}

function classifyInspectorCoverageStatus(statusCode) {
  const normalized = safeTrim(statusCode).toUpperCase();
  if (!normalized) {
    return { normalized, isActive: false, isManaged: false };
  }

  const inactivePatterns = [
    "INACTIVE",
    "UNMANAGED",
    "UNSUPPORTED",
    "NO_",
    "EXPIRED",
    "DISABLED",
    "STOPPED",
    "TERMINATED",
    "FAILED",
    "ERROR",
  ];

  const isInactive = inactivePatterns.some((pattern) =>
    pattern.endsWith("_") ? normalized.startsWith(pattern) : normalized.includes(pattern)
  );

  return {
    normalized,
    isActive: !isInactive,
    isManaged:
      !normalized.includes("UNMANAGED") &&
      !normalized.includes("NO_") &&
      !normalized.includes("UNSUPPORTED"),
  };
}

function summarizePatchState(patchState = {}) {
  const missingCount = Number(patchState?.MissingCount || 0);
  const failedCount = Number(patchState?.FailedCount || 0);
  const installedPendingRebootCount = Number(patchState?.InstalledPendingRebootCount || 0);
  const installedRejectedCount = Number(patchState?.InstalledRejectedCount || 0);
  const securityNonCompliantCount = Number(patchState?.SecurityNonCompliantCount || 0);
  const criticalNonCompliantCount = Number(patchState?.CriticalNonCompliantCount || 0);
  const otherNonCompliantCount = Number(patchState?.OtherNonCompliantCount || 0);
  const nonCompliantCount =
    missingCount +
    failedCount +
    installedPendingRebootCount +
    installedRejectedCount +
    securityNonCompliantCount +
    criticalNonCompliantCount +
    otherNonCompliantCount;

  return {
    nonCompliantCount,
    status: nonCompliantCount > 0 ? "NON_COMPLIANT" : "COMPLIANT",
    overallSeverity:
      criticalNonCompliantCount > 0
        ? "CRITICAL"
        : securityNonCompliantCount > 0 || failedCount > 0
          ? "HIGH"
          : missingCount > 0 || installedPendingRebootCount > 0
            ? "MEDIUM"
            : "LOW",
  };
}

function normalizeAwsCredentials(credentials) {
  if (!credentials?.accessKeyId || !credentials?.secretAccessKey) {
    return undefined;
  }
  return {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    ...(credentials?.sessionToken ? { sessionToken: credentials.sessionToken } : {}),
  };
}

function buildClientOptions(region, credentials) {
  return {
    region: region || DEFAULT_REGION,
    ...(normalizeAwsCredentials(credentials)
      ? { credentials: normalizeAwsCredentials(credentials) }
      : {}),
  };
}

function normalizeSeverityBucket(value, { numeric = false } = {}) {
  if (numeric) {
    const severity = Number(value);
    if (!Number.isFinite(severity)) return "unknown";
    if (severity >= 8) return "critical";
    if (severity >= 7) return "high";
    if (severity >= 4) return "medium";
    if (severity > 0) return "low";
    return "info";
  }

  const normalized = safeTrim(value).toUpperCase();
  if (!normalized) return "unknown";
  if (normalized === "CRITICAL") return "critical";
  if (normalized === "HIGH") return "high";
  if (normalized === "MEDIUM") return "medium";
  if (normalized === "LOW") return "low";
  if (normalized === "INFORMATIONAL" || normalized === "INFO") return "info";
  return "unknown";
}

function createSeverityCounters() {
  return {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    unknown: 0,
  };
}

function incrementSeverityCounter(counter, severity) {
  const bucket = normalizeSeverityBucket(severity);
  counter[bucket] = (counter[bucket] || 0) + 1;
}

function mergeSeverityCounters(...counters) {
  const merged = createSeverityCounters();
  counters.forEach((counter) => {
    Object.entries(counter || {}).forEach(([key, value]) => {
      merged[key] = (merged[key] || 0) + Number(value || 0);
    });
  });
  return merged;
}

function mapInspectorResourceType(value) {
  const normalized = safeTrim(value).toUpperCase();
  if (normalized === "EC2" || normalized === "AWS_EC2_INSTANCE") return "ec2";
  if (
    normalized === "ECR_REPOSITORY" ||
    normalized === "AWS_ECR_REPOSITORY" ||
    normalized === "AWS_ECR_CONTAINER_IMAGE"
  ) {
    return "ecr";
  }
  if (
    normalized === "LAMBDA_FUNCTION" ||
    normalized === "LAMBDA_CODE" ||
    normalized === "AWS_LAMBDA_FUNCTION"
  ) {
    return "lambda";
  }
  return normalized ? normalized.toLowerCase() : "unknown";
}

function featureIsEnabled(status) {
  return safeTrim(status).toUpperCase() === "ENABLED";
}

function readGuardDutyLegacyFeatureState(dataSources, key) {
  const entry = dataSources?.[key];
  return featureIsEnabled(entry?.Status) || featureIsEnabled(entry?.status);
}

function buildGuardDutyFeatureSummary(detector = {}) {
  const features = asArray(detector?.Features);
  const featureStatusByName = new Map(
    features
      .map((feature) => [safeTrim(feature?.Name).toUpperCase(), feature])
      .filter(([name]) => Boolean(name))
  );
  const dataSources = detector?.DataSources || {};

  const hasEnabledFeature = (...names) =>
    names.some((name) => {
      const feature = featureStatusByName.get(String(name).toUpperCase());
      if (!feature) return false;
      if (featureIsEnabled(feature?.Status)) return true;
      return asArray(feature?.AdditionalConfiguration).some((config) =>
        featureIsEnabled(config?.Status)
      );
    });

  const runtimeMonitoringEnabled = hasEnabledFeature("RUNTIME_MONITORING");

  return {
    s3ProtectionEnabled:
      hasEnabledFeature("S3_DATA_EVENTS") || readGuardDutyLegacyFeatureState(dataSources, "S3Logs"),
    eksProtectionEnabled:
      hasEnabledFeature("EKS_AUDIT_LOGS") ||
      readGuardDutyLegacyFeatureState(dataSources, "Kubernetes"),
    rdsProtectionEnabled:
      hasEnabledFeature("RDS_LOGIN_EVENTS") ||
      readGuardDutyLegacyFeatureState(dataSources, "RdsLoginEvents"),
    ec2MalwareProtectionEnabled:
      hasEnabledFeature("EBS_MALWARE_PROTECTION") ||
      readGuardDutyLegacyFeatureState(dataSources, "MalwareProtection"),
    lambdaProtectionEnabled:
      hasEnabledFeature("LAMBDA_NETWORK_LOGS") ||
      readGuardDutyLegacyFeatureState(dataSources, "LambdaNetworkLogs"),
    ec2EcsRuntimeProtectionEnabled:
      runtimeMonitoringEnabled ||
      hasEnabledFeature("EC2_RUNTIME_MONITORING", "ECS_FARGATE_RUNTIME_MONITORING"),
    eksRuntimeProtectionEnabled:
      runtimeMonitoringEnabled || hasEnabledFeature("EKS_RUNTIME_MONITORING"),
  };
}

async function listEnabledRegions({ credentials, logger }) {
  const client = new EC2Client(buildClientOptions(DEFAULT_REGION, credentials));
  try {
    const response = await client.send(
      new DescribeRegionsCommand({
        AllRegions: true,
      })
    );
    const regions = asArray(response?.Regions)
      .filter((region) => {
        const status = safeTrim(region?.OptInStatus).toLowerCase();
        return !status || status === "opt-in-not-required" || status === "opted-in";
      })
      .map((region) => safeTrim(region?.RegionName))
      .filter(Boolean);
    return regions.length > 0 ? regions.sort() : [DEFAULT_REGION];
  } catch (error) {
    logger?.warn?.("[threat-scanner] failed to list enabled regions, using default region", {
      message: error?.message || String(error),
    });
    return [DEFAULT_REGION];
  }
}

async function listEc2InstanceIdsByRegion({ credentials, regions, logger }) {
  const countsByRegion = {};
  const instanceIds = new Set();

  await Promise.all(
    asArray(regions).map(async (region) => {
      const client = new EC2Client(buildClientOptions(region, credentials));
      let nextToken;
      let count = 0;

      try {
        do {
          const response = await client.send(
            new DescribeInstancesCommand({
              MaxResults: 100,
              NextToken: nextToken,
              Filters: [
                {
                  Name: "instance-state-name",
                  Values: ["pending", "running", "stopping", "stopped"],
                },
              ],
            })
          );

          for (const reservation of response?.Reservations || []) {
            for (const instance of reservation?.Instances || []) {
              const instanceId = safeTrim(instance?.InstanceId);
              if (!instanceId) continue;
              instanceIds.add(instanceId);
              count += 1;
              if (count >= MAX_EC2_INSTANCES_PER_REGION) break;
            }
            if (count >= MAX_EC2_INSTANCES_PER_REGION) break;
          }

          nextToken =
            count >= MAX_EC2_INSTANCES_PER_REGION ? undefined : response?.NextToken;
        } while (nextToken);

        countsByRegion[region] = count;
      } catch (error) {
        countsByRegion[region] = 0;
        logger?.warn?.("[threat-scanner] failed to describe EC2 instances", {
          region,
          message: error?.message || String(error),
        });
      }
    })
  );

  return {
    total: instanceIds.size,
    instanceIds,
    countsByRegion,
  };
}

async function collectGuardDutyThreats({ credentials, regions, logger }) {
  const severity = createSeverityCounters();
  const regionalCoverage = [];
  const findings = [];

  await Promise.all(
    asArray(regions).map(async (region) => {
      const client = new GuardDutyClient(buildClientOptions(region, credentials));
      try {
        const detectorResponse = await client.send(new ListDetectorsCommand({}));
        const detectorId = safeTrim(detectorResponse?.DetectorIds?.[0]);

        if (!detectorId) {
          regionalCoverage.push({
            region,
            enabled: false,
            detectorId: null,
            featureSummary: buildGuardDutyFeatureSummary({}),
            findingCount: 0,
          });
          return;
        }

        const detector = await client.send(
          new GetDetectorCommand({
            DetectorId: detectorId,
          })
        );

        const listResponse = await client.send(
          new ListGuardDutyFindingsCommand({
            DetectorId: detectorId,
            MaxResults: 50,
            FindingCriteria: {
              Criterion: {
                "service.archived": {
                  Eq: ["false"],
                },
              },
            },
          })
        );

        const findingIds = asArray(listResponse?.FindingIds).slice(
          0,
          MAX_GUARDDUTY_FINDINGS_PER_REGION
        );
        const findingCount = asArray(listResponse?.FindingIds).length;

        regionalCoverage.push({
          region,
          enabled: true,
          detectorId,
          status: safeTrim(detector?.Status),
          featureSummary: buildGuardDutyFeatureSummary(detector),
          findingCount,
          updatedAt: toIsoString(detector?.UpdatedAt),
        });

        if (findingIds.length === 0) return;

        const findingsResponse = await client.send(
          new GetGuardDutyFindingsCommand({
            DetectorId: detectorId,
            FindingIds: findingIds,
          })
        );

        for (const finding of findingsResponse?.Findings || []) {
          const severityBucket = normalizeSeverityBucket(finding?.Severity, { numeric: true });
          incrementSeverityCounter(severity, severityBucket);
          findings.push({
            service: "guardduty",
            region,
            id: safeTrim(finding?.Id),
            title: safeTrim(finding?.Title),
            type: safeTrim(finding?.Type),
            description: safeTrim(finding?.Description),
            severity: severityBucket,
            rawSeverity: Number(finding?.Severity || 0),
            resourceType: safeTrim(finding?.Resource?.ResourceType),
            accountId: safeTrim(finding?.AccountId),
            createdAt: toIsoString(finding?.CreatedAt),
            updatedAt: toIsoString(finding?.UpdatedAt),
            consoleUrl: buildGuardDutyFindingConsoleUrl({
              region,
              findingId: safeTrim(finding?.Id),
            }),
            details: compactDetail({
              accountId: safeTrim(finding?.AccountId),
              arn: safeTrim(finding?.Arn),
              region,
              confidence: finding?.Confidence,
              resource: finding?.Resource,
              service: finding?.Service,
              createdAt: finding?.CreatedAt,
              updatedAt: finding?.UpdatedAt,
            }),
          });
        }
      } catch (error) {
        regionalCoverage.push({
          region,
          enabled: false,
          detectorId: null,
          findingCount: 0,
          error: error?.message || String(error),
          featureSummary: buildGuardDutyFeatureSummary({}),
        });
        logger?.warn?.("[threat-scanner] guardduty collection failed", {
          region,
          message: error?.message || String(error),
        });
      }
    })
  );

  const enabledRegions = regionalCoverage.filter((entry) => entry.enabled).length;
  const aggregateFeatures = regionalCoverage.reduce(
    (acc, entry) => {
      if (!entry?.enabled) return acc;
      const features = entry.featureSummary || {};
      Object.entries(features).forEach(([key, value]) => {
        acc[key] = acc[key] || Boolean(value);
      });
      return acc;
    },
    {
      s3ProtectionEnabled: false,
      eksProtectionEnabled: false,
      rdsProtectionEnabled: false,
      ec2MalwareProtectionEnabled: false,
      lambdaProtectionEnabled: false,
      ec2EcsRuntimeProtectionEnabled: false,
      eksRuntimeProtectionEnabled: false,
    }
  );

  return {
    enabled: enabledRegions > 0,
    enabledRegions,
    totalRegions: regionalCoverage.length,
    featureSummary: aggregateFeatures,
    regionalCoverage: regionalCoverage.sort((left, right) => left.region.localeCompare(right.region)),
    findings: findings
      .sort((left, right) => {
        const rightTime = Date.parse(right.updatedAt || 0);
        const leftTime = Date.parse(left.updatedAt || 0);
        return rightTime - leftTime;
      })
      .slice(0, 100),
    findingCounts: {
      total: findings.length,
      severity,
    },
  };
}

async function collectInspectorThreats({ credentials, regions, accountId, logger }) {
  const severity = createSeverityCounters();
  const coverageByType = {
    ec2: { total: 0, active: 0, inactive: 0, managed: 0, unmanaged: 0, statusCounts: {} },
    ecr: { total: 0, active: 0, inactive: 0, managed: 0, unmanaged: 0, statusCounts: {} },
    lambda: { total: 0, active: 0, inactive: 0, managed: 0, unmanaged: 0, statusCounts: {} },
  };
  const coverageSamples = [];
  const findings = [];
  const regionalCoverage = [];

  await Promise.all(
    asArray(regions).map(async (region) => {
      const client = new Inspector2Client(buildClientOptions(region, credentials));
      let coverageCount = 0;
      let nextCoverageToken;
      let nextFindingToken;
      try {
        do {
          const response = await client.send(
            new ListCoverageCommand({
              maxResults: 100,
              nextToken: nextCoverageToken,
              filterCriteria: {
                accountId: [{ comparison: "EQUALS", value: accountId }],
              },
            })
          );

          for (const resource of response?.coveredResources || []) {
            const resourceType = mapInspectorResourceType(resource?.resourceType);
            if (!coverageByType[resourceType]) continue;
            const status = classifyInspectorCoverageStatus(resource?.scanStatus?.statusCode);
            coverageByType[resourceType].total += 1;
            coverageByType[resourceType].statusCounts[status.normalized || "UNKNOWN"] =
              (coverageByType[resourceType].statusCounts[status.normalized || "UNKNOWN"] || 0) + 1;
            if (status.isActive) {
              coverageByType[resourceType].active += 1;
            } else {
              coverageByType[resourceType].inactive += 1;
            }
            if (status.isManaged) {
              coverageByType[resourceType].managed += 1;
            } else {
              coverageByType[resourceType].unmanaged += 1;
            }
            coverageCount += 1;

            if (coverageSamples.length < MAX_INSPECTOR_COVERAGE_PER_REGION) {
              coverageSamples.push({
                accountId,
                region,
                resourceType,
                resourceId: safeTrim(resource?.resourceId),
                scanStatus: status.normalized,
                scanStatusReason: safeTrim(resource?.scanStatus?.reason),
                lastScannedAt: toIsoString(resource?.lastScannedAt),
                details: compactDetail({
                  resourceId: resource?.resourceId,
                  resourceType: resource?.resourceType,
                  scanStatus: resource?.scanStatus,
                  lastScannedAt: resource?.lastScannedAt,
                }),
              });
            }
          }

          nextCoverageToken = response?.nextToken;
        } while (nextCoverageToken);

        do {
          const response = await client.send(
            new ListInspectorFindingsCommand({
              maxResults: 100,
              nextToken: nextFindingToken,
              filterCriteria: {
                awsAccountId: [{ comparison: "EQUALS", value: accountId }],
                resourceType: [
                  { comparison: "EQUALS", value: "AWS_EC2_INSTANCE" },
                  { comparison: "EQUALS", value: "AWS_ECR_REPOSITORY" },
                  { comparison: "EQUALS", value: "AWS_ECR_CONTAINER_IMAGE" },
                  { comparison: "EQUALS", value: "AWS_LAMBDA_FUNCTION" },
                ],
                findingStatus: [{ comparison: "EQUALS", value: "ACTIVE" }],
              },
            })
          );

          for (const finding of response?.findings || []) {
            const severityBucket = normalizeSeverityBucket(finding?.severity);
            incrementSeverityCounter(severity, severityBucket);
            findings.push({
              service: "inspector",
              region,
              accountId: safeTrim(finding?.awsAccountId) || accountId,
              findingArn: safeTrim(finding?.findingArn),
              title: safeTrim(finding?.title),
              type: safeTrim(finding?.type),
              description: safeTrim(finding?.description),
              severity: severityBucket,
              rawSeverity: safeTrim(finding?.severity),
              status: safeTrim(finding?.status),
              resourceType: mapInspectorResourceType(finding?.resources?.[0]?.type),
              resourceId: safeTrim(finding?.resources?.[0]?.id),
              firstObservedAt: toIsoString(finding?.firstObservedAt),
              lastObservedAt: toIsoString(finding?.lastObservedAt),
              updatedAt: toIsoString(finding?.updatedAt),
              consoleUrl: buildInspectorFindingConsoleUrl({
                region,
                findingArn: safeTrim(finding?.findingArn),
              }),
              details: compactDetail({
                awsAccountId: finding?.awsAccountId,
                inspectorScore: finding?.inspectorScore,
                inspectorScoreDetails: finding?.inspectorScoreDetails,
                vendorSeverity: finding?.vendorSeverity,
                exploitAvailable: finding?.exploitAvailable,
                fixAvailable: finding?.fixAvailable,
                resources: finding?.resources,
                packageVulnerabilityDetails: finding?.packageVulnerabilityDetails,
                networkReachabilityDetails: finding?.networkReachabilityDetails,
                codeVulnerabilityDetails: finding?.codeVulnerabilityDetails,
                remediation: finding?.remediation,
                epss: finding?.epss,
                firstObservedAt: finding?.firstObservedAt,
                lastObservedAt: finding?.lastObservedAt,
                updatedAt: finding?.updatedAt,
              }),
            });
            if (findings.length >= asArray(regions).length * MAX_INSPECTOR_FINDINGS_PER_REGION) {
              break;
            }
          }

          if (findings.length >= asArray(regions).length * MAX_INSPECTOR_FINDINGS_PER_REGION) {
            nextFindingToken = undefined;
          } else {
            nextFindingToken = response?.nextToken;
          }
        } while (nextFindingToken);

        regionalCoverage.push({
          region,
          coverageCount,
          ok: true,
        });
      } catch (error) {
        regionalCoverage.push({
          region,
          coverageCount,
          ok: false,
          error: error?.message || String(error),
        });
        logger?.warn?.("[threat-scanner] inspector collection failed", {
          region,
          message: error?.message || String(error),
        });
      }
    })
  );

  return {
    coverageByType,
    coverageSamples,
    findings: findings
      .sort((left, right) => {
        const rightTime = Date.parse(right.updatedAt || 0);
        const leftTime = Date.parse(left.updatedAt || 0);
        return rightTime - leftTime;
      })
      .slice(0, 100),
    findingCounts: {
      total: findings.length,
      severity,
    },
    regionalCoverage: regionalCoverage.sort((left, right) => left.region.localeCompare(right.region)),
  };
}

async function collectPatchCompliance({ credentials, regions, accountId, logger }) {
  const ec2Inventory = await listEc2InstanceIdsByRegion({ credentials, regions, logger });
  const client = new SSMClient(buildClientOptions(DEFAULT_REGION, credentials));

  const managedInstanceIds = new Set();
  const managedInstances = [];
  const complianceByStatus = {};
  const nonCompliantInstances = [];
  const complianceSummariesByInstanceId = new Map();
  const patchStatesByInstanceId = new Map();

  try {
    let nextToken;
    do {
      const response = await client.send(
        new DescribeInstanceInformationCommand({
          MaxResults: 50,
          NextToken: nextToken,
        })
      );
      for (const instance of response?.InstanceInformationList || []) {
        if (safeTrim(instance?.ResourceType) !== "EC2Instance") continue;
        const instanceId = safeTrim(instance?.InstanceId);
        if (!instanceId) continue;
        managedInstanceIds.add(instanceId);
        managedInstances.push({
          instanceId,
          pingStatus: safeTrim(instance?.PingStatus),
          platformType: safeTrim(instance?.PlatformType),
          agentVersion: safeTrim(instance?.AgentVersion),
          isLatestVersion: instance?.IsLatestVersion === true,
          associationStatus: safeTrim(instance?.AssociationStatus),
          lastPingDateTime: toIsoString(instance?.LastPingDateTime),
        });
      }
      nextToken = response?.NextToken;
    } while (nextToken);
  } catch (error) {
    logger?.warn?.("[threat-scanner] failed to describe SSM managed instances", {
      message: error?.message || String(error),
    });
  }

  try {
    let nextToken;
    do {
      const response = await client.send(
        new ListResourceComplianceSummariesCommand({
          MaxResults: 50,
          NextToken: nextToken,
          Filters: [
            {
              Key: "ComplianceType",
              Values: ["Patch"],
              Type: "EQUAL",
            },
          ],
        })
      );

      for (const item of response?.ResourceComplianceSummaryItems || []) {
        const status = safeTrim(item?.Status) || "UNKNOWN";
        complianceByStatus[status] = (complianceByStatus[status] || 0) + 1;

        if (status !== "COMPLIANT" && nonCompliantInstances.length < MAX_PATCH_COMPLIANCE_ITEMS) {
          const instanceId = safeTrim(item?.ResourceId);
          if (instanceId) {
            complianceSummariesByInstanceId.set(instanceId, {
              accountId,
              instanceId,
              status,
              overallSeverity: safeTrim(item?.OverallSeverity),
              compliantCount: Number(item?.CompliantSummary?.CompliantCount || 0),
              nonCompliantCount: Number(item?.NonCompliantSummary?.NonCompliantCount || 0),
              executionType: safeTrim(item?.ExecutionSummary?.ExecutionType),
              executionTime: toIsoString(item?.ExecutionSummary?.ExecutionTime),
              details: compactDetail(item),
            });
          }
        }
      }

      nextToken = response?.NextToken;
    } while (nextToken);
  } catch (error) {
    logger?.warn?.("[threat-scanner] failed to list patch compliance summaries", {
      message: error?.message || String(error),
    });
  }

  try {
    const managedInstanceIdChunks = chunkArray([...managedInstanceIds], 50);
    for (const instanceIds of managedInstanceIdChunks) {
      const response = await client.send(
        new DescribeInstancePatchStatesCommand({
          InstanceIds: instanceIds,
        })
      );

      for (const patchState of response?.InstancePatchStates || []) {
        const instanceId = safeTrim(patchState?.InstanceId);
        if (!instanceId) continue;
        patchStatesByInstanceId.set(instanceId, patchState);
      }
    }
  } catch (error) {
    logger?.warn?.("[threat-scanner] failed to describe patch states", {
      message: error?.message || String(error),
    });
  }

  const includedInstanceIds = new Set();

  for (const managedInstance of managedInstances) {
    const instanceId = managedInstance.instanceId;
    const patchState = patchStatesByInstanceId.get(instanceId);
    const complianceSummary = complianceSummariesByInstanceId.get(instanceId);
    const patchSummary = summarizePatchState(patchState);
    const status = safeTrim(complianceSummary?.status) || patchSummary.status;

    if (status === "COMPLIANT" && patchSummary.nonCompliantCount === 0) continue;
    if (nonCompliantInstances.length >= MAX_PATCH_COMPLIANCE_ITEMS) break;

    nonCompliantInstances.push({
      accountId,
      instanceId,
      status,
      overallSeverity:
        safeTrim(complianceSummary?.overallSeverity) || patchSummary.overallSeverity,
      compliantCount: Number(complianceSummary?.compliantCount || 0),
      nonCompliantCount:
        Number(complianceSummary?.nonCompliantCount || 0) || patchSummary.nonCompliantCount,
      executionType: safeTrim(complianceSummary?.executionType) || "PatchState",
      executionTime:
        complianceSummary?.executionTime ||
        toIsoString(patchState?.OperationEndTime) ||
        toIsoString(patchState?.OperationStartTime),
      details: compactDetail({
        managedInstance,
        patchState,
        complianceSummary,
      }),
    });
    includedInstanceIds.add(instanceId);
  }

  for (const [instanceId, complianceSummary] of complianceSummariesByInstanceId.entries()) {
    if (includedInstanceIds.has(instanceId)) continue;
    if (nonCompliantInstances.length >= MAX_PATCH_COMPLIANCE_ITEMS) break;

    nonCompliantInstances.push({
      accountId,
      instanceId,
      status: safeTrim(complianceSummary?.status) || "NON_COMPLIANT",
      overallSeverity: safeTrim(complianceSummary?.overallSeverity) || "MEDIUM",
      compliantCount: Number(complianceSummary?.compliantCount || 0),
      nonCompliantCount: Number(complianceSummary?.nonCompliantCount || 0),
      executionType: safeTrim(complianceSummary?.executionType),
      executionTime: complianceSummary?.executionTime || null,
      details: compactDetail({
        complianceSummary,
      }),
    });
  }

  const totalEc2Instances = ec2Inventory.total;
  const managedEc2Instances = managedInstanceIds.size;
  const unmanagedEc2Instances = Math.max(0, totalEc2Instances - managedEc2Instances);

  return {
    totalEc2Instances,
    managedEc2Instances,
    unmanagedEc2Instances,
    countsByRegion: ec2Inventory.countsByRegion,
    complianceByStatus,
    compliantManagedInstances: Number(complianceByStatus.COMPLIANT || 0),
    nonCompliantManagedInstances: Object.entries(complianceByStatus).reduce(
      (count, [status, value]) => (status === "COMPLIANT" ? count : count + Number(value || 0)),
      0
    ),
    managedInstances: managedInstances.slice(0, MAX_PATCH_COMPLIANCE_ITEMS),
    nonCompliantInstances,
  };
}

async function collectAccessAnalyzerThreats({ credentials, regions, accountId, logger }) {
  const findings = [];
  const analyzers = [];
  const regionalCoverage = [];

  await Promise.all(
    asArray(regions).map(async (region) => {
      const client = new AccessAnalyzerClient(buildClientOptions(region, credentials));
      try {
        const analyzersResponse = await client.send(
          new ListAnalyzersCommand({
            maxResults: 100,
          })
        );
        const regionAnalyzers = asArray(analyzersResponse?.analyzers);
        analyzers.push(
          ...regionAnalyzers.map((analyzer) => ({
            region,
            arn: safeTrim(analyzer?.arn),
            name: safeTrim(analyzer?.name),
            type: safeTrim(analyzer?.type),
            status: safeTrim(analyzer?.status),
            createdAt: toIsoString(analyzer?.createdAt),
            lastResourceAnalyzedAt: toIsoString(analyzer?.lastResourceAnalyzedAt),
          }))
        );

        for (const analyzer of regionAnalyzers) {
          const analyzerArn = safeTrim(analyzer?.arn);
          if (!analyzerArn) continue;
          let nextToken;
          let collected = 0;
          do {
            const response = await client.send(
              new ListAccessAnalyzerFindingsCommand({
                analyzerArn,
                maxResults: 50,
                nextToken,
                filter: {
                  status: {
                    eq: ["ACTIVE"],
                  },
                },
              })
            );

            for (const finding of response?.findings || []) {
              const severity = describeAccessAnalyzerSeverity(finding);
              findings.push({
                service: "accessAnalyzer",
                region,
                analyzerArn,
                analyzerName: safeTrim(analyzer?.name),
                accountId:
                  safeTrim(finding?.resourceOwnerAccount) ||
                  safeTrim(finding?.resourceOwner) ||
                  accountId,
                id: safeTrim(finding?.id),
                status: safeTrim(finding?.status),
                severity,
                resourceType: safeTrim(finding?.resourceType),
                resource: safeTrim(finding?.resource),
                isPublic: finding?.isPublic === true,
                principalCount: Object.keys(finding?.principal || {}).length,
                actionCount: asArray(finding?.action).length,
                description: buildAccessAnalyzerDescription(finding),
                createdAt: toIsoString(finding?.createdAt),
                updatedAt: toIsoString(finding?.updatedAt),
                error: safeTrim(finding?.error),
                consoleUrl: buildAccessAnalyzerFindingConsoleUrl({
                  region,
                  analyzerName: safeTrim(analyzer?.name),
                  findingId: safeTrim(finding?.id),
                }),
                details: compactDetail({
                  action: finding?.action,
                  condition: finding?.condition,
                  principal: finding?.principal,
                  sources: finding?.sources,
                  createdAt: finding?.createdAt,
                  updatedAt: finding?.updatedAt,
                  resourceOwnerAccount: finding?.resourceOwnerAccount,
                  resourceControlPolicyRestriction: finding?.resourceControlPolicyRestriction,
                }),
              });
              collected += 1;
              if (collected >= MAX_ACCESS_ANALYZER_FINDINGS_PER_ANALYZER) break;
            }

            if (collected >= MAX_ACCESS_ANALYZER_FINDINGS_PER_ANALYZER) {
              nextToken = undefined;
            } else {
              nextToken = response?.nextToken;
            }
          } while (nextToken);
        }

        regionalCoverage.push({
          region,
          analyzerCount: regionAnalyzers.length,
          ok: true,
        });
      } catch (error) {
        regionalCoverage.push({
          region,
          analyzerCount: 0,
          ok: false,
          error: error?.message || String(error),
        });
        logger?.warn?.("[threat-scanner] access analyzer collection failed", {
          region,
          message: error?.message || String(error),
        });
      }
    })
  );

  return {
    analyzers: analyzers.sort((left, right) => left.region.localeCompare(right.region)),
    findings: findings
      .sort((left, right) => {
        const rightTime = Date.parse(right.updatedAt || right.createdAt || 0);
        const leftTime = Date.parse(left.updatedAt || left.createdAt || 0);
        return rightTime - leftTime;
      })
      .slice(0, 100),
    findingCounts: {
      total: findings.length,
      publicFindings: findings.filter((finding) => finding.isPublic).length,
    },
    regionalCoverage: regionalCoverage.sort((left, right) => left.region.localeCompare(right.region)),
  };
}

function buildServiceChecks({ guardDuty, inspector, patchCompliance, accessAnalyzer }) {
  const hasGuardDutyFindings = Number(guardDuty?.findingCounts?.total || 0) > 0;
  const hasInspectorFindings = Number(inspector?.findingCounts?.total || 0) > 0;
  const hasAccessAnalyzerFindings = Number(accessAnalyzer?.findingCounts?.total || 0) > 0;
  const hasPatchComplianceIssues =
    Number(patchCompliance?.nonCompliantManagedInstances || 0) > 0 ||
    Number(patchCompliance?.unmanagedEc2Instances || 0) > 0;

  return [
    {
      key: "guardduty",
      label: "GuardDuty",
      status: guardDuty?.enabled ? (hasGuardDutyFindings ? "problem" : "healthy") : "problem",
      summary: guardDuty?.enabled
        ? `Enabled in ${guardDuty.enabledRegions}/${guardDuty.totalRegions || 0} regions`
        : "No GuardDuty detector found in enabled regions",
    },
    {
      key: "inspector",
      label: "Inspector",
      status:
        Number(inspector?.coverageByType?.ec2?.total || 0) +
          Number(inspector?.coverageByType?.ecr?.total || 0) +
          Number(inspector?.coverageByType?.lambda?.total || 0) >
        0
          ? hasInspectorFindings
            ? "problem"
            : "healthy"
          : "unknown",
      summary: `${Number(inspector?.findingCounts?.total || 0)} active findings across EC2, ECR, and Lambda`,
    },
    {
      key: "patchCompliance",
      label: "Patch Compliance",
      status:
        Number(patchCompliance?.totalEc2Instances || 0) === 0
          ? "unknown"
          : hasPatchComplianceIssues
            ? "problem"
            : "healthy",
      summary: `${Number(patchCompliance?.managedEc2Instances || 0)} managed / ${Number(
        patchCompliance?.unmanagedEc2Instances || 0
      )} unmanaged EC2 instances`,
    },
    {
      key: "accessAnalyzer",
      label: "Access Analyzer",
      status:
        Number(accessAnalyzer?.analyzers?.length || 0) === 0
          ? "unknown"
          : hasAccessAnalyzerFindings
            ? "problem"
            : "healthy",
      summary: `${Number(accessAnalyzer?.findingCounts?.total || 0)} active findings across ${Number(
        accessAnalyzer?.analyzers?.length || 0
      )} analyzers`,
    },
  ];
}

export async function runAwsThreatDetectionAnalysis({
  accountId,
  credentials,
  logger,
} = {}) {
  if (!accountId) throw new Error("accountId is required");

  const regions = await listEnabledRegions({ credentials, logger });
  const [guardDuty, inspector, patchCompliance, accessAnalyzer] = await Promise.all([
    collectGuardDutyThreats({ credentials, regions, logger }),
    collectInspectorThreats({ credentials, regions, accountId, logger }),
    collectPatchCompliance({ credentials, regions, accountId, logger }),
    collectAccessAnalyzerThreats({ credentials, regions, accountId, logger }),
  ]);

  const overallSeverity = mergeSeverityCounters(
    guardDuty?.findingCounts?.severity,
    inspector?.findingCounts?.severity
  );

  const summary = {
    totalRegions: regions.length,
    findings: {
      guardDuty: Number(guardDuty?.findingCounts?.total || 0),
      inspector: Number(inspector?.findingCounts?.total || 0),
      accessAnalyzer: Number(accessAnalyzer?.findingCounts?.total || 0),
      total:
        Number(guardDuty?.findingCounts?.total || 0) +
        Number(inspector?.findingCounts?.total || 0) +
        Number(accessAnalyzer?.findingCounts?.total || 0),
      severity: overallSeverity,
    },
    guardDuty: {
      enabled: guardDuty?.enabled === true,
      enabledRegions: Number(guardDuty?.enabledRegions || 0),
      featureSummary: guardDuty?.featureSummary || {},
    },
    inspector: {
      coverageByType: inspector?.coverageByType || {},
    },
    patchCompliance: {
      totalEc2Instances: Number(patchCompliance?.totalEc2Instances || 0),
      managedEc2Instances: Number(patchCompliance?.managedEc2Instances || 0),
      unmanagedEc2Instances: Number(patchCompliance?.unmanagedEc2Instances || 0),
      compliantManagedInstances: Number(patchCompliance?.compliantManagedInstances || 0),
      nonCompliantManagedInstances: Number(patchCompliance?.nonCompliantManagedInstances || 0),
    },
    accessAnalyzer: {
      analyzerCount: Number(accessAnalyzer?.analyzers?.length || 0),
      publicFindings: Number(accessAnalyzer?.findingCounts?.publicFindings || 0),
    },
  };

  return {
    accountId,
    generatedAt: new Date().toISOString(),
    regions,
    checks: buildServiceChecks({
      guardDuty,
      inspector,
      patchCompliance,
      accessAnalyzer,
    }),
    summary,
    data: {
      guardDuty,
      inspector,
      patchCompliance,
      accessAnalyzer,
    },
  };
}
