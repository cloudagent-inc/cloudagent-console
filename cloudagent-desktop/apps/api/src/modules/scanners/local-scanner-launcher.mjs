import { fromIni } from "@aws-sdk/credential-provider-ini";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";
import {
  GuardDutyClient,
  ListDetectorsCommand,
  GetDetectorCommand,
  ListFindingsCommand as ListGuardDutyFindingsCommand,
  GetFindingsCommand as GetGuardDutyFindingsCommand,
} from "@aws-sdk/client-guardduty";
import {
  Inspector2Client,
  ListCoverageCommand as ListInspectorCoverageCommand,
  ListFindingsCommand as ListInspectorFindingsCommand,
} from "@aws-sdk/client-inspector2";
import {
  AccessAnalyzerClient,
  ListAnalyzersCommand,
  ListFindingsV2Command,
} from "@aws-sdk/client-accessanalyzer";
import {
  SSMClient,
  DescribeInstanceInformationCommand,
  ListResourceComplianceSummariesCommand,
} from "@aws-sdk/client-ssm";

import { parseStoredObject } from "@cloudagent/storage";
import { scanAwsResources } from "@cloudagent/scanners/aws/discovery";

const LOCAL_USER_ID = "local-user";
const DEFAULT_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";

function safeTrim(value) {
  return value == null ? "" : String(value).trim();
}

function nowIso() {
  return new Date().toISOString();
}

function parseAuthProfile(profile = {}) {
  return parseStoredObject(profile?.authProfile, profile?.authProfile || {});
}

function getProfileId(profile = {}) {
  return safeTrim(profile.recordId || profile.id || profile.permissionProfileId);
}

function isAwsPermissionProfile(profile = {}) {
  const authProfile = parseAuthProfile(profile);
  const type = safeTrim(profile.type).toLowerCase().replace(/_/g, " ");
  const provider = safeTrim(authProfile.provider).toLowerCase();
  return type === "aws account" || provider === "aws";
}

function getCredentialStatus(profile = {}) {
  const status = profile.credentialStatus || profile.localCredentialStatus || profile._credentialStatus || null;
  return status && typeof status === "object" ? status : null;
}

function hasValidCredentialCheck(profile = {}) {
  const status = getCredentialStatus(profile);
  if (!status) return false;
  if (status.lastCheckedValid === true) return true;
  if (status.lastCheckedValid === false) return false;
  return status.ok === true || safeTrim(status.status).toLowerCase() === "valid";
}

function credentialBlockMessage(profile = {}) {
  const status = getCredentialStatus(profile);
  const environmentName = profile.name || getProfileId(profile) || "environment";
  if (!status) {
    return `AWS credentials for ${environmentName} have not been checked yet. Recheck credentials in Cloud Setup before running local scanners.`;
  }
  const detail = [status.message, status.remediation].filter(Boolean).join(" ");
  return detail || `AWS credentials for ${environmentName} are not valid. Recheck credentials in Cloud Setup before running local scanners.`;
}

function assertCredentialsAllowScanner(profile = {}) {
  if (!isAwsPermissionProfile(profile)) return;
  if (hasValidCredentialCheck(profile)) return;
  const error = new Error(credentialBlockMessage(profile));
  error.status = 412;
  error.code = "LOCAL_AWS_CREDENTIALS_NOT_VALID";
  throw error;
}

function getAccountId(authProfile = {}) {
  return safeTrim(authProfile.awsAccountId || authProfile.aws_account_id || authProfile.accountId);
}

function getRegions(authProfile = {}, options = {}) {
  const values = [
    ...(Array.isArray(options.regions) ? options.regions : []),
    ...(Array.isArray(authProfile.regions) ? authProfile.regions : []),
    authProfile.region,
    authProfile.defaultRegion,
    DEFAULT_REGION,
  ];
  return [...new Set(values.map(safeTrim).filter(Boolean))];
}

function getCredentials(authProfile = {}) {
  const accessKeyId = safeTrim(authProfile.accessKeyId);
  const secretAccessKey = safeTrim(authProfile.secretAccessKey);
  const sessionToken = safeTrim(authProfile.sessionToken || authProfile.refreshKey);
  if (accessKeyId && secretAccessKey) {
    return {
      accessKeyId,
      secretAccessKey,
      ...(sessionToken ? { sessionToken } : {}),
    };
  }

  const profile = safeTrim(authProfile.awsProfile || authProfile.profileName || authProfile.profile);
  if (profile) {
    return fromIni({ profile });
  }

  throw new Error("Selected local AWS environment is missing an AWS profile or access keys.");
}

async function resolveAccountId({ credentials, accountId, region, logger }) {
  if (accountId) return accountId;
  try {
    const sts = new STSClient({ region: region || DEFAULT_REGION, credentials });
    const identity = await sts.send(new GetCallerIdentityCommand({}));
    return safeTrim(identity?.Account) || null;
  } catch (error) {
    logger?.warn?.("[local-scanner] failed to resolve account id", {
      message: error?.message || String(error),
    });
    return null;
  }
}

function flattenInventoryResources(payload = {}) {
  const resources = [];
  const results = payload?.results;
  if (!results || typeof results !== "object" || Array.isArray(results)) return resources;
  for (const serviceResult of Object.values(results)) {
    if (Array.isArray(serviceResult?.resources)) {
      resources.push(...serviceResult.resources);
    }
  }
  return resources;
}

function normalizeHealthResource(resource = {}) {
  const resourceType = safeTrim(
    resource.canonicalResourceType || resource.resourceType || resource.type
  );
  const identifier = safeTrim(
    resource.identifier || resource.resourceArn || resource.resourceId || resource.displayName
  );
  if (!resourceType || !identifier) return null;
  return {
    resourceType,
    identifier,
    resourceArn: safeTrim(resource.resourceArn) || undefined,
    resourceId: safeTrim(resource.resourceId) || undefined,
    region: safeTrim(resource.region) || undefined,
    accountId: safeTrim(resource.accountId) || undefined,
    displayName: safeTrim(resource.displayName) || undefined,
    permissionProfileId: safeTrim(resource.permissionProfileId || resource.environmentProfileId) || undefined,
    workloadId: safeTrim(resource.workloadId) || undefined,
    workloadName: safeTrim(resource.workloadName) || undefined,
  };
}

function createHealthSummary(resources = []) {
  const total = Array.isArray(resources) ? resources.length : 0;
  return {
    resourceCounts: {
      total,
      evaluated: 0,
      healthy: 0,
      issues: 0,
      notChecked: total,
      skipped: total,
    },
    healthScore: null,
    issueCounts: {},
    resourceTypeCounts: resources.reduce((acc, resource) => {
      const key = safeTrim(resource.resourceType) || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    topIssues: [],
    topResourceTypes: [],
  };
}

function buildHealthUnavailableResult(resources = [], error) {
  const normalizedResources = (Array.isArray(resources) ? resources : [])
    .map((resource) => ({
      ...resource,
      checks: [],
      errors: [
        "Local resource-health execution is unavailable because the AWS scanner package dependencies are not installed for the local API runtime.",
        error?.message || String(error || ""),
      ].filter(Boolean),
      notApplicable: true,
      notApplicableReason: "local_health_scanner_unavailable",
      generatedAt: nowIso(),
    }));
  return {
    version: "local-unavailable",
    generatedAt: nowIso(),
    inputResourceCount: resources.length,
    normalizedResourceCount: normalizedResources.length,
    unsupportedResourceTypes: [],
    resources: normalizedResources,
    summary: createHealthSummary(normalizedResources),
  };
}

function buildCostUnavailableResult(error) {
  const generatedAt = nowIso();
  return {
    version: "local-unavailable",
    generatedAt,
    lookbackDays: 90,
    checks: [
      {
        checkId: "local.cost_scanner.unavailable",
        checkName: "Local cost scanner unavailable",
        category: "local-runtime",
        status: "unknown",
        summary:
          "Local cost execution is unavailable because the AWS scanner package dependencies are not installed for the local API runtime.",
        details: {
          error: error?.message || String(error || ""),
        },
        servicesApisUsed: [],
        costImpact: "none",
        checkedAt: generatedAt,
      },
    ],
    statusCounts: { unknown: 1 },
    errors: [error?.message || "Local cost scanner unavailable"],
    data: {},
    callCostNotes: [],
  };
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildCostDateRange(lookbackDays = 90) {
  const endExclusive = startOfUtcDay(new Date());
  const days = Number.isFinite(Number(lookbackDays)) && Number(lookbackDays) > 0
    ? Math.floor(Number(lookbackDays))
    : 90;
  const startInclusive = new Date(endExclusive.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    startDate: formatDate(startInclusive),
    endDate: formatDate(endExclusive),
    lookbackDays: days,
  };
}

function normalizeCostResultRow(point = {}) {
  const amount = Number(point?.Total?.UnblendedCost?.Amount || 0);
  return {
    date: point?.TimePeriod?.Start || "",
    amount: Number.isFinite(amount) ? amount : 0,
    unit: point?.Total?.UnblendedCost?.Unit || "USD",
  };
}

function normalizeCostGroupRow(point = {}, group = {}) {
  const amount = Number(group?.Metrics?.UnblendedCost?.Amount || 0);
  return {
    date: point?.TimePeriod?.Start || "",
    service: group?.Keys?.[0] || "Unknown",
    amount: Number.isFinite(amount) ? amount : 0,
    unit: group?.Metrics?.UnblendedCost?.Unit || "USD",
  };
}

async function runMinimalLocalCostAnalysis({ accountId, credentials, lookbackDays, logger }) {
  const range = buildCostDateRange(lookbackDays);
  const ce = new CostExplorerClient({
    region: process.env.AWS_BILLING_REGION || "us-east-1",
    credentials,
  });
  const [dailyTotalResponse, dailyByServiceResponse] = await Promise.all([
    ce.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: range.startDate, End: range.endDate },
        Granularity: "DAILY",
        Metrics: ["UnblendedCost"],
      })
    ),
    ce.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: range.startDate, End: range.endDate },
        Granularity: "DAILY",
        Metrics: ["UnblendedCost"],
        GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
      })
    ),
  ]);
  const dailyTotal = (dailyTotalResponse.ResultsByTime || []).map(normalizeCostResultRow);
  const dailyByService = (dailyByServiceResponse.ResultsByTime || []).flatMap((point) =>
    (point.Groups || []).map((group) => normalizeCostGroupRow(point, group))
  );
  const total = dailyTotal.reduce((sum, point) => sum + Number(point.amount || 0), 0);
  const generatedAt = nowIso();
  logger?.info?.("[local-scanner] minimal cost analysis completed", {
    accountId: accountId || null,
    days: range.lookbackDays,
    dailyPointCount: dailyTotal.length,
  });
  return {
    version: "local-cost-explorer-minimal",
    generatedAt,
    provider: "aws",
    lookbackDays: range.lookbackDays,
    checks: [
      {
        checkId: "ce.spend.daily_total_local",
        checkName: "Daily total spend",
        category: "spend",
        status: "healthy",
        summary: `Retrieved ${dailyTotal.length} daily spend points for the last ${range.lookbackDays} days.`,
        details: {
          dataPath: "data.spend.dailyTotal",
          totalUnblendedCost: total,
          range,
        },
        servicesApisUsed: ["CostExplorer.GetCostAndUsage"],
        costImpact: "paid-api",
        checkedAt: generatedAt,
      },
    ],
    statusCounts: { healthy: 1 },
    errors: [],
    data: {
      spend: {
        dailyTotal,
        dailyByService,
        range,
        monthlyTotal12m: [],
        dailyByLinkedAccount: [],
      },
    },
    callCostNotes: ["Local mode used a minimal Cost Explorer scan when the full scanner package was unavailable."],
  };
}

async function collectAwsPages(client, CommandCtor, input = {}, outputKey, tokenKey = "nextToken") {
  const items = [];
  let nextToken;
  do {
    const response = await client.send(new CommandCtor({ ...input, [tokenKey]: nextToken }));
    const pageItems = Array.isArray(response?.[outputKey]) ? response[outputKey] : [];
    items.push(...pageItems);
    nextToken = response?.nextToken || response?.NextToken;
  } while (nextToken && items.length < 500);
  return items;
}

function normalizeSeverity(value) {
  const raw = safeTrim(value).toLowerCase();
  if (!raw) return "unknown";
  if (["critical", "high", "medium", "low", "info", "informational"].includes(raw)) {
    return raw === "informational" ? "info" : raw;
  }
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    if (numeric >= 8.9) return "critical";
    if (numeric >= 7) return "high";
    if (numeric >= 4) return "medium";
    return "low";
  }
  return raw;
}

function countBy(items = [], selector = (item) => item) {
  return items.reduce((acc, item) => {
    const key = safeTrim(selector(item)) || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

async function scanGuardDutyThreats({ credentials, accountId, regions, logger }) {
  const findings = [];
  const detectorSummaries = [];
  const featureSummary = {};
  const errors = [];

  for (const region of regions) {
    try {
      const client = new GuardDutyClient({ region, credentials });
      const detectorIds = await collectAwsPages(client, ListDetectorsCommand, {}, "DetectorIds");
      for (const detectorId of detectorIds) {
        let detector = {};
        try {
          detector = await client.send(new GetDetectorCommand({ DetectorId: detectorId }));
        } catch (error) {
          errors.push({ service: "guardduty", region, message: error?.message || String(error) });
        }
        detectorSummaries.push({
          region,
          detectorId,
          status: detector?.Status || "UNKNOWN",
          findingPublishingFrequency: detector?.FindingPublishingFrequency || null,
          features: detector?.Features || [],
        });
        for (const feature of Array.isArray(detector?.Features) ? detector.Features : []) {
          const name = safeTrim(feature?.Name).toLowerCase();
          const enabled = safeTrim(feature?.Status).toUpperCase() === "ENABLED";
          if (name.includes("s3")) featureSummary.s3ProtectionEnabled = enabled;
          if (name.includes("eks_audit")) featureSummary.eksProtectionEnabled = enabled;
          if (name.includes("rds")) featureSummary.rdsProtectionEnabled = enabled;
          if (name.includes("lambda")) featureSummary.lambdaProtectionEnabled = enabled;
          if (name.includes("malware")) featureSummary.ec2MalwareProtectionEnabled = enabled;
          if (name.includes("runtime")) {
            featureSummary.ec2EcsRuntimeProtectionEnabled = enabled;
            featureSummary.eksRuntimeProtectionEnabled = enabled;
          }
        }
        const findingIds = await collectAwsPages(
          client,
          ListGuardDutyFindingsCommand,
          {
            DetectorId: detectorId,
            MaxResults: 50,
            FindingCriteria: {
              Criterion: {
                serviceArchived: { Eq: ["false"] },
              },
            },
          },
          "FindingIds"
        );
        for (let index = 0; index < findingIds.length; index += 50) {
          const batch = findingIds.slice(index, index + 50);
          if (!batch.length) continue;
          const response = await client.send(
            new GetGuardDutyFindingsCommand({ DetectorId: detectorId, FindingIds: batch })
          );
          for (const finding of Array.isArray(response?.Findings) ? response.Findings : []) {
            findings.push({
              id: finding.Id,
              title: finding.Title,
              type: finding.Type,
              severity: normalizeSeverity(finding.Severity),
              severityScore: finding.Severity,
              region,
              accountId: finding.AccountId || accountId,
              resource: finding.Resource?.ResourceType || finding.Resource?.InstanceDetails?.InstanceId || null,
              resourceType: finding.Resource?.ResourceType || null,
              service: finding.Service?.ServiceName || "guardduty",
              createdAt: finding.CreatedAt,
              updatedAt: finding.UpdatedAt,
              description: finding.Description || "",
              details: finding,
            });
          }
        }
      }
    } catch (error) {
      errors.push({ service: "guardduty", region, message: error?.message || String(error) });
      logger?.warn?.("[local-scanner] guardduty threat scan failed", { region, message: error?.message || String(error) });
    }
  }

  return { findings, detectorSummaries, featureSummary, errors };
}

async function scanInspectorThreats({ credentials, accountId, regions, logger }) {
  const findings = [];
  const coverage = [];
  const errors = [];

  for (const region of regions) {
    try {
      const client = new Inspector2Client({ region, credentials });
      const coverageRows = await collectAwsPages(
        client,
        ListInspectorCoverageCommand,
        { maxResults: 100 },
        "coveredResources"
      );
      coverage.push(...coverageRows.map((item) => ({ ...item, region })));
      const findingRows = await collectAwsPages(
        client,
        ListInspectorFindingsCommand,
        {
          maxResults: 100,
          filterCriteria: {
            findingStatus: [{ comparison: "EQUALS", value: "ACTIVE" }],
          },
        },
        "findings"
      );
      for (const finding of findingRows) {
        const primaryResource = Array.isArray(finding.resources) ? finding.resources[0] : null;
        findings.push({
          findingArn: finding.findingArn,
          title: finding.title || finding.type || "Inspector finding",
          type: finding.type,
          severity: normalizeSeverity(finding.severity),
          inspectorScore: finding.inspectorScore,
          status: finding.status,
          region,
          accountId,
          resourceId: primaryResource?.id || null,
          resourceType: primaryResource?.type || null,
          firstObservedAt: finding.firstObservedAt,
          updatedAt: finding.updatedAt,
          description: finding.description || "",
          details: finding,
        });
      }
    } catch (error) {
      errors.push({ service: "inspector", region, message: error?.message || String(error) });
      logger?.warn?.("[local-scanner] inspector threat scan failed", { region, message: error?.message || String(error) });
    }
  }

  return { findings, coverage, errors };
}

async function scanAccessAnalyzerThreats({ credentials, regions, logger }) {
  const findings = [];
  const analyzers = [];
  const errors = [];

  for (const region of regions) {
    try {
      const client = new AccessAnalyzerClient({ region, credentials });
      const analyzerRows = await collectAwsPages(client, ListAnalyzersCommand, {}, "analyzers");
      analyzers.push(...analyzerRows.map((item) => ({ ...item, region })));
      for (const analyzer of analyzerRows) {
        const findingRows = await collectAwsPages(
          client,
          ListFindingsV2Command,
          {
            analyzerArn: analyzer.arn,
            maxResults: 100,
            filter: {
              status: { eq: ["ACTIVE"] },
            },
          },
          "findings"
        );
        findings.push(...findingRows.map((finding) => ({
          id: finding.id,
          analyzerArn: analyzer.arn,
          analyzerName: analyzer.name,
          region,
          accountId: finding.resourceOwnerAccount,
          resource: finding.resource,
          resourceType: finding.resourceType,
          status: finding.status,
          isPublic: finding.isPublic,
          severity: finding.isPublic ? "high" : "medium",
          createdAt: finding.createdAt,
          updatedAt: finding.updatedAt,
          details: finding,
        })));
      }
    } catch (error) {
      errors.push({ service: "accessAnalyzer", region, message: error?.message || String(error) });
      logger?.warn?.("[local-scanner] access analyzer threat scan failed", { region, message: error?.message || String(error) });
    }
  }

  return { findings, analyzers, errors };
}

async function scanPatchComplianceThreats({ credentials, accountId, regions, logger }) {
  const nonCompliantInstances = [];
  const managedInstances = [];
  const errors = [];

  for (const region of regions) {
    try {
      const client = new SSMClient({ region, credentials });
      const instances = await collectAwsPages(
        client,
        DescribeInstanceInformationCommand,
        { MaxResults: 50 },
        "InstanceInformationList",
        "NextToken"
      );
      managedInstances.push(...instances.map((item) => ({ ...item, region })));
      const summaries = await collectAwsPages(
        client,
        ListResourceComplianceSummariesCommand,
        { MaxResults: 50 },
        "ResourceComplianceSummaryItems",
        "NextToken"
      );
      for (const item of summaries) {
        const status = safeTrim(item.Status).toUpperCase();
        if (status === "COMPLIANT") continue;
        nonCompliantInstances.push({
          instanceId: item.ResourceId,
          resourceType: item.ResourceType,
          status: item.Status,
          overallSeverity: item.OverallSeverity,
          executionTime: item.ExecutionSummary?.ExecutionTime,
          region,
          accountId,
          details: item,
        });
      }
    } catch (error) {
      errors.push({ service: "patchCompliance", region, message: error?.message || String(error) });
      logger?.warn?.("[local-scanner] patch compliance threat scan failed", { region, message: error?.message || String(error) });
    }
  }

  return { managedInstances, nonCompliantInstances, errors };
}

function buildInspectorCoverageByType(coverage = []) {
  const result = {
    ec2: { total: 0, active: 0, inactive: 0, managed: 0, unmanaged: 0 },
    ecr: { total: 0, active: 0, inactive: 0, managed: 0, unmanaged: 0 },
    lambda: { total: 0, active: 0, inactive: 0, managed: 0, unmanaged: 0 },
  };
  for (const item of coverage) {
    const type = safeTrim(item.resourceType).toLowerCase();
    const key = type.includes("lambda") ? "lambda" : type.includes("ecr") ? "ecr" : "ec2";
    if (!result[key]) continue;
    result[key].total += 1;
    const scanStatus = safeTrim(item.scanStatus?.statusCode || item.scanStatus?.reason).toUpperCase();
    if (scanStatus.includes("ACTIVE") || scanStatus.includes("SUCCESS")) {
      result[key].active += 1;
      result[key].managed += 1;
    } else {
      result[key].inactive += 1;
      result[key].unmanaged += 1;
    }
  }
  return result;
}

async function runLocalThreatDetection({ accountId, credentials, regions, logger }) {
  let bundledThreatScanner = null;
  try {
    bundledThreatScanner = await import("@cloudagent/scanners/aws/threat");
  } catch (error) {
    logger?.warn?.("[local-scanner] bundled threat scanner unavailable, using compatibility scanner", {
      message: error?.message || String(error),
    });
  }

  if (bundledThreatScanner?.runAwsThreatDetectionAnalysis) {
    const result = await bundledThreatScanner.runAwsThreatDetectionAnalysis({
      accountId,
      credentials,
      logger,
    });
    return {
      ok: true,
      version: "local-threat-scanner",
      ...result,
      regions: Array.isArray(result?.regions) && result.regions.length ? result.regions : regions,
      errors: Array.isArray(result?.errors) ? result.errors : [],
    };
  }

  const generatedAt = nowIso();
  const [guardDuty, inspector, accessAnalyzer, patchCompliance] = await Promise.all([
    scanGuardDutyThreats({ credentials, accountId, regions, logger }),
    scanInspectorThreats({ credentials, accountId, regions, logger }),
    scanAccessAnalyzerThreats({ credentials, regions, logger }),
    scanPatchComplianceThreats({ credentials, accountId, regions, logger }),
  ]);
  const errors = [
    ...guardDuty.errors,
    ...inspector.errors,
    ...accessAnalyzer.errors,
    ...patchCompliance.errors,
  ];
  const guardDutyEnabledRegions = guardDuty.detectorSummaries.filter((detector) =>
    safeTrim(detector.status).toUpperCase() === "ENABLED"
  ).length;
  const findingCounts = {
    guardDuty: guardDuty.findings.length,
    inspector: inspector.findings.length,
    accessAnalyzer: accessAnalyzer.findings.length,
    patchCompliance: patchCompliance.nonCompliantInstances.length,
  };
  findingCounts.total =
    findingCounts.guardDuty +
    findingCounts.inspector +
    findingCounts.accessAnalyzer +
    findingCounts.patchCompliance;
  const severityCounts = countBy(
    [
      ...guardDuty.findings,
      ...inspector.findings,
      ...accessAnalyzer.findings,
      ...patchCompliance.nonCompliantInstances,
    ],
    (finding) => normalizeSeverity(finding.severity || finding.overallSeverity)
  );
  const hasServiceError = (service) => errors.some((error) => error.service === service);

  return {
    ok: true,
    version: "local-threat-minimal",
    generatedAt,
    accountId,
    regions,
    summary: {
      totalRegions: regions.length,
      findings: findingCounts,
      severityCounts,
      guardDuty: {
        enabled: guardDutyEnabledRegions > 0,
        enabledRegions: guardDutyEnabledRegions,
        detectorCount: guardDuty.detectorSummaries.length,
        featureSummary: guardDuty.featureSummary,
      },
      inspector: {
        findingCount: inspector.findings.length,
        coverageByType: buildInspectorCoverageByType(inspector.coverage),
      },
      accessAnalyzer: {
        analyzerCount: accessAnalyzer.analyzers.length,
        findingCount: accessAnalyzer.findings.length,
      },
      patchCompliance: {
        managedEc2Instances: patchCompliance.managedInstances.length,
        compliantManagedInstances: Math.max(
          0,
          patchCompliance.managedInstances.length - patchCompliance.nonCompliantInstances.length
        ),
        nonCompliantManagedInstances: patchCompliance.nonCompliantInstances.length,
        unmanagedEc2Instances: 0,
      },
      errorCount: errors.length,
    },
    checks: [
      {
        checkId: "local.threat.guardduty",
        checkName: "GuardDuty findings",
        category: "threat-detection",
        status: hasServiceError("guardduty") ? "unknown" : findingCounts.guardDuty > 0 ? "problem" : "healthy",
        summary: `${findingCounts.guardDuty} active GuardDuty finding(s) found.`,
        checkedAt: generatedAt,
      },
      {
        checkId: "local.threat.inspector",
        checkName: "Inspector findings",
        category: "vulnerability-management",
        status: hasServiceError("inspector") ? "unknown" : findingCounts.inspector > 0 ? "problem" : "healthy",
        summary: `${findingCounts.inspector} active Inspector finding(s) found.`,
        checkedAt: generatedAt,
      },
      {
        checkId: "local.threat.access_analyzer",
        checkName: "IAM Access Analyzer findings",
        category: "public-access",
        status: hasServiceError("accessAnalyzer") ? "unknown" : findingCounts.accessAnalyzer > 0 ? "problem" : "healthy",
        summary: `${findingCounts.accessAnalyzer} active Access Analyzer finding(s) found.`,
        checkedAt: generatedAt,
      },
      {
        checkId: "local.threat.patch_compliance",
        checkName: "SSM patch compliance",
        category: "patch-compliance",
        status: hasServiceError("patchCompliance") ? "unknown" : findingCounts.patchCompliance > 0 ? "problem" : "healthy",
        summary: `${findingCounts.patchCompliance} non-compliant managed instance(s) found.`,
        checkedAt: generatedAt,
      },
    ],
    data: {
      guardDuty: {
        detectors: guardDuty.detectorSummaries,
        findings: guardDuty.findings,
      },
      inspector: {
        coverage: inspector.coverage,
        findings: inspector.findings,
      },
      accessAnalyzer: {
        analyzers: accessAnalyzer.analyzers,
        findings: accessAnalyzer.findings,
      },
      patchCompliance: {
        managedInstances: patchCompliance.managedInstances,
        nonCompliantInstances: patchCompliance.nonCompliantInstances,
      },
    },
    errors,
  };
}

async function runLocalHealthChecks(args, logger) {
  try {
    const module = await import("@cloudagent/scanners/aws/resource-health");
    return module.runAwsResourceHealthChecks(args);
  } catch (error) {
    logger?.warn?.("[local-scanner] falling back to health compatibility artifact", {
      message: error?.message || String(error),
    });
    return buildHealthUnavailableResult(args?.resources || [], error);
  }
}

async function runLocalCostAnalysis(args, logger) {
  try {
    const module = await import("@cloudagent/scanners/aws/cost");
    return module.runAwsCostAnalysis(args);
  } catch (error) {
    logger?.warn?.("[local-scanner] full cost scanner unavailable; using minimal cost fallback", {
      message: error?.message || String(error),
    });
    try {
      return await runMinimalLocalCostAnalysis(args);
    } catch (fallbackError) {
      logger?.warn?.("[local-scanner] minimal cost fallback failed", {
        message: fallbackError?.message || String(fallbackError),
      });
      return buildCostUnavailableResult(fallbackError);
    }
  }
}

function normalizeTrackedResources(workload = {}) {
  const tracked = parseStoredObject(workload.trackedResources, { resources: [] });
  return (Array.isArray(tracked.resources) ? tracked.resources : [])
    .map((resource) =>
      normalizeHealthResource({
        ...resource,
        permissionProfileId: safeTrim(resource.permissionProfileId || resource.environmentProfileId) || undefined,
        workloadId: workload.workloadId,
        workloadName: workload.workloadName,
      })
    )
    .filter(Boolean);
}

function resourceProfileId(resource = {}) {
  return safeTrim(resource.permissionProfileId || resource.environmentProfileId);
}

function mergeHealthResults(results = []) {
  const resources = results.flatMap((result) => (Array.isArray(result?.resources) ? result.resources : []));
  const unsupportedResourceTypes = [
    ...new Set(results.flatMap((result) => result?.unsupportedResourceTypes || [])),
  ].sort();
  const generatedAt = nowIso();
  return {
    version: results.find((result) => result?.version)?.version || "local-merged",
    generatedAt,
    inputResourceCount: results.reduce(
      (sum, result) => sum + Number(result?.inputResourceCount || 0),
      0
    ),
    normalizedResourceCount: results.reduce(
      (sum, result) => sum + Number(result?.normalizedResourceCount || 0),
      0
    ),
    unsupportedResourceTypes,
    resources,
    summary: createHealthSummary(resources),
  };
}

function buildInventoryPayload({ permissionProfileId, scanResult, accountId }) {
  return {
    ok: true,
    permissionProfileId,
    requestedServices: Array.isArray(scanResult?.requestedServices)
      ? scanResult.requestedServices
      : [],
    results: scanResult?.results || {},
    syncedAt: scanResult?.syncedAt || nowIso(),
    defaultAccountId: scanResult?.defaultAccountId || accountId || null,
    generatedAt: nowIso(),
  };
}

function buildAnalysisMetadata(artifact) {
  return artifact?.metadata || {};
}

async function updateTargetAnalysis({ store, targetType, targetId, reportType, artifact }) {
  const patch = { [reportType]: buildAnalysisMetadata(artifact) };
  if (targetType === "workload") {
    await store.updateWorkloadAnalysis(targetId, patch);
  } else {
    await store.updatePermissionProfileAnalysis(targetId, patch);
  }
}

async function scanInventory({ store, profile, options, logger, scanId }) {
  const permissionProfileId = getProfileId(profile);
  const authProfile = parseAuthProfile(profile);
  const regions = getRegions(authProfile, options);
  const credentials = getCredentials(authProfile);
  const accountId = await resolveAccountId({
    credentials,
    accountId: getAccountId(authProfile),
    region: regions[0],
    logger,
  });
  const scanResult = await scanAwsResources({
    services: Array.isArray(options.services) ? options.services : undefined,
    regions,
    logger,
    credentials,
    accountId,
  });
  const payload = buildInventoryPayload({ permissionProfileId, scanResult, accountId });
  const artifact = await store.writeScannerArtifact("inventory", permissionProfileId, scanId, payload);
  await updateTargetAnalysis({
    store,
    targetType: "permissionProfile",
    targetId: permissionProfileId,
    reportType: "inventory",
    artifact,
  });
  return { payload: artifact.payload, artifact };
}

async function scanEnvironmentHealth({ store, profile, options, logger, scanId }) {
  const permissionProfileId = getProfileId(profile);
  const authProfile = parseAuthProfile(profile);
  const credentials = getCredentials(authProfile);
  const regions = getRegions(authProfile, options);
  const accountId = await resolveAccountId({
    credentials,
    accountId: getAccountId(authProfile),
    region: regions[0],
    logger,
  });
  const inventory = await scanInventory({ store, profile, options, logger, scanId });
  const resources = flattenInventoryResources(inventory.payload)
    .map(normalizeHealthResource)
    .filter(Boolean);
  const result = await runLocalHealthChecks({
    resources,
    credentials,
    lookbackHours: Number(options.lookbackHours) || undefined,
    includeCloudWatchLogChecks: options.enableCloudWatchLogChecks === true,
    logger,
  }, logger);
  const timestamp = Date.now();
  const payload = {
    ok: true,
    permissionProfileId,
    workloadId: null,
    accountId,
    ...result,
    output: {
      scopeType: "permissionProfileId",
      scopeId: permissionProfileId,
      timestamp,
      cache: {
        source: "generated",
        cacheHit: false,
        maxAgeHours: 24,
        forceRefresh: true,
      },
    },
  };
  const artifact = await store.writeScannerArtifact("health", permissionProfileId, scanId, payload);
  artifact.payload.analysis.health = {
    ...artifact.payload.analysis.health,
    summary: result.summary || {},
    options: {
      lookbackHours: Number(options.lookbackHours) || undefined,
      includeCloudWatchLogChecks: options.enableCloudWatchLogChecks === true,
    },
  };
  await store.writeScannerArtifact("health", permissionProfileId, scanId, artifact.payload);
  await updateTargetAnalysis({
    store,
    targetType: "permissionProfile",
    targetId: permissionProfileId,
    reportType: "health",
    artifact: { ...artifact, metadata: artifact.payload.analysis.health },
  });
  return { payload: artifact.payload, artifact };
}

function workloadProfileIds(workload = {}) {
  const ids = new Set();
  (Array.isArray(workload.environments) ? workload.environments : []).forEach((id) => {
    const value = safeTrim(id);
    if (value) ids.add(value);
  });
  const tracked = parseStoredObject(workload.trackedResources, { resources: [] });
  for (const resource of Array.isArray(tracked.resources) ? tracked.resources : []) {
    const value = safeTrim(resource.permissionProfileId || resource.environmentProfileId);
    if (value) ids.add(value);
  }
  return Array.from(ids);
}

async function scanWorkloadHealth({ store, workload, options, logger, scanId }) {
  const workloadId = safeTrim(workload.workloadId);
  const resources = normalizeTrackedResources(workload);
  const profileIds = workloadProfileIds(workload);
  if (!profileIds.length) {
    throw new Error(`No environments are associated with workload ${workloadId}`);
  }
  const unscopedResources = resources.filter((resource) => !resourceProfileId(resource));
  if (profileIds.length > 1 && unscopedResources.length > 0) {
    throw new Error(
      `Workload ${workloadId} spans multiple environments, but ${unscopedResources.length} tracked resource(s) are not tied to an environment. Re-discover or edit resources before running local health.`
    );
  }

  const results = [];
  const usedProfileIds = [];
  for (const profileId of profileIds) {
    const profile = await store.getPermissionProfile(profileId);
    if (!profile) throw new Error(`Environment ${profileId} was not found`);
    assertCredentialsAllowScanner(profile);
    const profileResources =
      profileIds.length === 1
        ? resources
        : resources.filter((resource) => resourceProfileId(resource) === profileId);
    if (!profileResources.length) continue;
    const authProfile = parseAuthProfile(profile);
    const credentials = getCredentials(authProfile);
    const result = await runLocalHealthChecks({
      resources: profileResources,
      credentials,
      lookbackHours: Number(options.lookbackHours) || undefined,
      includeCloudWatchLogChecks: options.enableCloudWatchLogChecks === true,
      logger,
    }, logger);
    results.push(result);
    usedProfileIds.push(profileId);
  }

  if (!results.length) {
    throw new Error(`No workload health resources matched the selected environments for ${workloadId}`);
  }

  const result = results.length === 1 ? results[0] : mergeHealthResults(results);
  const timestamp = Date.now();
  const payload = {
    ok: true,
    workloadId,
    permissionProfileId: usedProfileIds[0] || null,
    permissionProfileIds: usedProfileIds,
    ...result,
    output: {
      scopeType: "workloadId",
      scopeId: workloadId,
      timestamp,
      cache: {
        source: "generated",
        cacheHit: false,
        maxAgeHours: 24,
        forceRefresh: true,
      },
    },
  };
  const artifact = await store.writeScannerArtifact("health", workloadId, scanId, payload);
  artifact.payload.analysis.health = {
    ...artifact.payload.analysis.health,
    summary: result.summary || {},
    options: {
      lookbackHours: Number(options.lookbackHours) || undefined,
      includeCloudWatchLogChecks: options.enableCloudWatchLogChecks === true,
    },
  };
  await store.writeScannerArtifact("health", workloadId, scanId, artifact.payload);
  await updateTargetAnalysis({
    store,
    targetType: "workload",
    targetId: workloadId,
    reportType: "health",
    artifact: { ...artifact, metadata: artifact.payload.analysis.health },
  });
  return { payload: artifact.payload, artifact };
}

async function scanCost({ store, profile, options, logger, scanId }) {
  const permissionProfileId = getProfileId(profile);
  const authProfile = parseAuthProfile(profile);
  const credentials = getCredentials(authProfile);
  const accountId = await resolveAccountId({
    credentials,
    accountId: getAccountId(authProfile),
    region: getRegions(authProfile, options)[0],
    logger,
  });
  const result = await runLocalCostAnalysis({
    accountId,
    credentials,
    logger,
    lookbackDays: Number(options.lookbackDays) || undefined,
  }, logger);
  const timestamp = Date.now();
  const payload = {
    ok: true,
    permissionProfileId,
    accountId,
    ...result,
    output: {
      scopeType: "permissionProfileId",
      scopeId: permissionProfileId,
      timestamp,
      cache: {
        source: "generated",
        cacheHit: false,
        maxAgeHours: 24,
        forceRefresh: true,
      },
    },
  };
  const artifact = await store.writeScannerArtifact("cost", permissionProfileId, scanId, payload);
  artifact.payload.analysis.cost = {
    ...artifact.payload.analysis.cost,
    summary: {
      statusCounts: result.statusCounts || {},
      checkCount: Array.isArray(result.checks) ? result.checks.length : 0,
      errorCount: Array.isArray(result.errors) ? result.errors.length : 0,
    },
  };
  await store.writeScannerArtifact("cost", permissionProfileId, scanId, artifact.payload);
  await updateTargetAnalysis({
    store,
    targetType: "permissionProfile",
    targetId: permissionProfileId,
    reportType: "cost",
    artifact: { ...artifact, metadata: artifact.payload.analysis.cost },
  });
  return { payload: artifact.payload, artifact };
}

async function scanThreat({ store, profile, options, logger, scanId }) {
  const permissionProfileId = getProfileId(profile);
  const authProfile = parseAuthProfile(profile);
  const credentials = getCredentials(authProfile);
  const regions = getRegions(authProfile, options);
  const accountId = await resolveAccountId({
    credentials,
    accountId: getAccountId(authProfile),
    region: regions[0],
    logger,
  });
  const result = await runLocalThreatDetection({
    accountId,
    credentials,
    regions,
    logger,
  });
  const timestamp = Date.now();
  const payload = {
    ok: true,
    permissionProfileId,
    accountId,
    ...result,
    output: {
      scopeType: "permissionProfileId",
      scopeId: permissionProfileId,
      timestamp,
      cache: {
        source: "generated",
        cacheHit: false,
        maxAgeHours: 24,
        forceRefresh: true,
      },
    },
  };
  const artifact = await store.writeScannerArtifact("threat", permissionProfileId, scanId, payload);
  artifact.payload.analysis.threat = {
    ...artifact.payload.analysis.threat,
    summary: {
      findings: result.summary?.findings || {},
      severityCounts: result.summary?.severityCounts || {},
      errorCount: Array.isArray(result.errors) ? result.errors.length : 0,
    },
  };
  await store.writeScannerArtifact("threat", permissionProfileId, scanId, artifact.payload);
  await updateTargetAnalysis({
    store,
    targetType: "permissionProfile",
    targetId: permissionProfileId,
    reportType: "threat",
    artifact: { ...artifact, metadata: artifact.payload.analysis.threat },
  });
  return { payload: artifact.payload, artifact };
}

async function assertTargetCredentialsAllowScanner({ store, reportType, target }) {
  const permissionProfileId = safeTrim(target.permissionProfileId);
  const workloadId = safeTrim(target.workloadId);

  if (reportType === "health" && workloadId) {
    const workload = await store.getWorkload(workloadId);
    if (!workload) throw new Error(`Workload ${workloadId} was not found`);
    const profileIds = workloadProfileIds(workload);
    if (!profileIds.length) return;
    for (const profileId of profileIds) {
      const profile = await store.getPermissionProfile(profileId);
      if (!profile) throw new Error(`Environment ${profileId} was not found`);
      assertCredentialsAllowScanner(profile);
    }
    return;
  }

  if (!permissionProfileId) return;
  const profile = await store.getPermissionProfile(permissionProfileId);
  if (!profile) throw new Error(`Environment ${permissionProfileId} was not found`);
  assertCredentialsAllowScanner(profile);
}

async function processTarget({ store, reportType, target, options, logger, scanId }) {
  const permissionProfileId = safeTrim(target.permissionProfileId);
  const workloadId = safeTrim(target.workloadId);
  if (reportType === "health" && workloadId) {
    const workload = await store.getWorkload(workloadId);
    if (!workload) throw new Error(`Workload ${workloadId} was not found`);
    return scanWorkloadHealth({ store, workload, options, logger, scanId });
  }

  if (!permissionProfileId) {
    throw new Error(`${reportType} scanner target requires permissionProfileId`);
  }
  const profile = await store.getPermissionProfile(permissionProfileId);
  if (!profile) throw new Error(`Environment ${permissionProfileId} was not found`);
  assertCredentialsAllowScanner(profile);

  if (reportType === "inventory") {
    return scanInventory({ store, profile, options, logger, scanId });
  }
  if (reportType === "health") {
    return scanEnvironmentHealth({ store, profile, options, logger, scanId });
  }
  if (reportType === "cost") {
    return scanCost({ store, profile, options, logger, scanId });
  }
  if (reportType === "threat") {
    return scanThreat({ store, profile, options, logger, scanId });
  }

  throw new Error(`Local scanner report type is not supported yet: ${reportType}`);
}

export async function launchLocalAwsScanner({
  store,
  cloudProvider = "aws",
  reportType,
  targets = [],
  forceRefresh = true,
  options = {},
  logger = console,
} = {}) {
  const normalizedCloudProvider = safeTrim(cloudProvider).toLowerCase() || "aws";
  const normalizedReportType = safeTrim(reportType).toLowerCase();
  if (normalizedCloudProvider !== "aws") {
    throw new Error("Local scanner currently supports AWS only");
  }
  if (!["inventory", "health", "cost", "threat"].includes(normalizedReportType)) {
    throw new Error(`Local scanner does not support report type: ${normalizedReportType}`);
  }
  const normalizedTargets = (Array.isArray(targets) ? targets : [])
    .map((target) => ({
      permissionProfileId: safeTrim(target?.permissionProfileId) || undefined,
      workloadId: safeTrim(target?.workloadId) || undefined,
    }))
    .filter((target) => target.permissionProfileId || target.workloadId);
  if (!normalizedTargets.length) {
    throw new Error("At least one scanner target is required");
  }

  for (const target of normalizedTargets) {
    await assertTargetCredentialsAllowScanner({
      store,
      reportType: normalizedReportType,
      target,
    });
  }

  const run = await store.createScannerRun({
    cloudProvider: normalizedCloudProvider,
    reportType: normalizedReportType,
    targets: normalizedTargets,
    status: "running",
    forceRefresh,
    options,
    startedAt: nowIso(),
  });

  const failures = [];
  const results = [];
  for (const target of normalizedTargets) {
    try {
      const result = await processTarget({
        store,
        reportType: normalizedReportType,
        target,
        options,
        logger,
        scanId: run.scanId,
      });
      const targetType = target.workloadId ? "workload" : "permissionProfile";
      const targetId = target.workloadId || target.permissionProfileId;
      results.push({
        kind: normalizedReportType,
        targetType,
        targetId,
        permissionProfileId: target.permissionProfileId || null,
        workloadId: target.workloadId || null,
        generatedAt:
          result?.payload?.analysis?.[normalizedReportType]?.generatedAt ||
          result?.payload?.generatedAt ||
          nowIso(),
      });
    } catch (error) {
      failures.push({
        permissionProfileId: target.permissionProfileId || null,
        workloadId: target.workloadId || null,
        message: error?.message || String(error),
      });
      logger?.error?.("[local-scanner] target failed", {
        reportType: normalizedReportType,
        target,
        message: error?.message || String(error),
      });
    }
  }

  const completed = await store.updateScannerRun(run.scanId, {
    status: failures.length ? "failed" : "succeeded",
    failures,
    results,
    completedAt: nowIso(),
  });

  return {
    ok: results.length > 0,
    cloudProvider: normalizedCloudProvider,
    reportType: normalizedReportType,
    accepted: true,
    completed: true,
    taskArn: completed?.taskArn || `local:${run.scanId}`,
    taskArns: completed?.taskArns || [`local:${run.scanId}`],
    scanId: run.scanId,
    chunkCount: 1,
    chunkSize: normalizedTargets.length,
    failures,
    results,
    targetCount: normalizedTargets.length,
  };
}

export function LOCAL_SCANNER_USER_ID() {
  return LOCAL_USER_ID;
}
