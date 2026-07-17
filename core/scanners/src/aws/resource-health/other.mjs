import {
  CloudFormationClient,
  DescribeStackDriftDetectionStatusCommand,
  DescribeStacksCommand,
  DetectStackDriftCommand,
} from "@aws-sdk/client-cloudformation";
import { GetRoleCommand, IAMClient } from "@aws-sdk/client-iam";
import { DEFAULT_REGION } from "../discovery/shared.mjs";
import { scanApiGatewayApiKeys, scanApiGatewayRestApis } from "../discovery/apigateway.mjs";
import { scanApiGatewayV2Apis } from "../discovery/apigatewayv2.mjs";
import { scanAutoScalingGroups, scanLaunchConfigurations } from "../discovery/autoscaling.mjs";
import { scanCloudFrontDistributions } from "../discovery/cloudfront.mjs";
import { scanEc2SecurityGroups, scanEc2Vpcs } from "../discovery/ec2.mjs";
import { scanEcrRepositories } from "../discovery/ecr.mjs";
import { scanEcsClusters } from "../discovery/ecs.mjs";
import { scanEfsFileSystems, scanEfsMountTargets } from "../discovery/efs.mjs";
import { scanEksClusters, scanEksFargateProfiles, scanEksNodegroups } from "../discovery/eks.mjs";
import {
  scanElbv2Listeners,
  scanElbv2LoadBalancers,
  scanElbv2TargetGroups,
} from "../discovery/elbv2.mjs";
import { scanEventBridgeEventBuses, scanEventBridgeRules } from "../discovery/eventbridge.mjs";
import { scanCloudWatchLogGroups } from "../discovery/logs.mjs";
import { scanOpenSearchDomains } from "../discovery/opensearch.mjs";
import {
  scanRdsDbParameterGroups,
  scanRdsDbSubnetGroups,
} from "../discovery/rds.mjs";
import { scanS3Resources } from "../discovery/s3.mjs";
import { scanSfnStateMachines } from "../discovery/sfn.mjs";
import { scanSnsSubscriptions, scanSnsTopics } from "../discovery/sns.mjs";
import { scanSqsQueues } from "../discovery/sqs.mjs";
import {
  HEALTH_STATUS,
  createCheckResult,
  createResourceResult,
  isLikelyNotFoundError,
  parseAwsArn,
  safeTrim,
  sleep,
} from "./shared.mjs";

const CLOUDFORMATION_STACK_STATUS_CHECK_ID = "cfn.stack.status";
const CLOUDFORMATION_STACK_STATUS_CHECK_NAME = "Stack status failure";
const CLOUDFORMATION_DRIFT_CHECK_ID = "cloudformation.stack.drift_status";
const CLOUDFORMATION_DRIFT_CHECK_NAME = "CloudFormation stack drift status";
const CLOUDFORMATION_DRIFT_REUSE_WINDOW_MS = 24 * 60 * 60 * 1000;
const CLOUDFORMATION_DRIFT_POLL_MS = 3000;
const CLOUDFORMATION_DRIFT_MAX_POLLS = 20;
const IAM_ROLE_LAST_USED_CHECK_ID = "iam.role.last_used_180d";
const IAM_ROLE_LAST_USED_CHECK_NAME = "IAM role used in last 6 months";
const IAM_ROLE_LAST_USED_THRESHOLD_DAYS = 180;
const CLOUDFORMATION_FAILED_STACK_STATUSES = new Set([
  "CREATE_FAILED",
  "ROLLBACK_FAILED",
  "ROLLBACK_COMPLETE",
  "DELETE_FAILED",
  "UPDATE_FAILED",
  "UPDATE_ROLLBACK_FAILED",
  "UPDATE_ROLLBACK_COMPLETE",
  "IMPORT_ROLLBACK_FAILED",
  "IMPORT_ROLLBACK_COMPLETE",
]);
const CLOUDFORMATION_DRIFT_SUPPORTED_STACK_STATUSES = new Set([
  "CREATE_COMPLETE",
  "UPDATE_COMPLETE",
  "UPDATE_ROLLBACK_COMPLETE",
  "UPDATE_ROLLBACK_FAILED",
]);

export const OTHER_SUPPORTED_RESOURCE_TYPES = Object.freeze([
  "AWS::ApiGateway::ApiKey",
  "AWS::ApiGateway::RestApi",
  "AWS::ApiGatewayV2::Api",
  "AWS::AutoScaling::AutoScalingGroup",
  "AWS::AutoScaling::LaunchConfiguration",
  "AWS::CloudFormation::Stack",
  "AWS::CloudFront::Distribution",
  "AWS::EC2::SecurityGroup",
  "AWS::EC2::VPC",
  "AWS::ECR::Repository",
  "AWS::ECS::Cluster",
  "AWS::EFS::FileSystem",
  "AWS::EFS::MountTarget",
  "AWS::EKS::Cluster",
  "AWS::EKS::FargateProfile",
  "AWS::EKS::Nodegroup",
  "AWS::ElasticLoadBalancingV2::Listener",
  "AWS::ElasticLoadBalancingV2::LoadBalancer",
  "AWS::ElasticLoadBalancingV2::TargetGroup",
  "AWS::Events::EventBus",
  "AWS::Events::Rule",
  "AWS::IAM::Role",
  "AWS::Logs::LogGroup",
  "AWS::OpenSearchService::Domain",
  "AWS::RDS::DBParameterGroup",
  "AWS::RDS::DBSubnetGroup",
  "AWS::S3::Bucket",
  "AWS::SNS::Subscription",
  "AWS::SNS::Topic",
  "AWS::SQS::Queue",
  "AWS::StepFunctions::StateMachine",
]);

function normalizeMatchTokens(values = []) {
  const out = new Set();
  for (const value of values) {
    const s = safeTrim(value);
    if (!s) continue;
    out.add(s.toLowerCase());
  }
  return out;
}

function targetTokens(target) {
  return normalizeMatchTokens([
    target?.identifier,
    target?.resourceArn,
    target?.resourceId,
    target?.displayName,
  ]);
}

function resourceTokens(resource) {
  return normalizeMatchTokens([
    resource?.identifier,
    resource?.resourceArn,
    resource?.resourceId,
    resource?.displayName,
  ]);
}

function hasTokenIntersection(a, b) {
  for (const token of a) {
    if (b.has(token)) return true;
  }
  return false;
}

function scanBaseOptions(target, credentials, logger) {
  return {
    regions: [safeTrim(target?.region) || DEFAULT_REGION],
    credentials,
    logger,
    syncedAt: new Date().toISOString(),
    accountId: safeTrim(target?.accountId) || undefined,
  };
}

function firstIdentifier(target) {
  return (
    safeTrim(target?.resourceArn) ||
    safeTrim(target?.resourceId) ||
    safeTrim(target?.identifier) ||
    safeTrim(target?.displayName)
  );
}

function parseResourceFragment(target) {
  const parsed = parseAwsArn(target?.resourceArn || target?.identifier || "");
  return safeTrim(parsed?.resource);
}

function parseApiGatewayRestApiId(target) {
  const candidate = safeTrim(target?.resourceId);
  if (candidate && !candidate.startsWith("arn:")) return candidate;
  const fragment = parseResourceFragment(target);
  const match = fragment.match(/\/restapis\/([^/]+)/);
  return safeTrim(match?.[1]) || safeTrim(target?.identifier);
}

function parseApiGatewayApiKeyId(target) {
  const candidate = safeTrim(target?.resourceId);
  if (candidate && !candidate.startsWith("arn:")) return candidate;
  const fragment = parseResourceFragment(target);
  const match = fragment.match(/\/apikeys\/([^/]+)/);
  return safeTrim(match?.[1]) || safeTrim(target?.identifier);
}

function parseApiGatewayV2ApiId(target) {
  const candidate = safeTrim(target?.resourceId);
  if (candidate && !candidate.startsWith("arn:")) return candidate;
  const fragment = parseResourceFragment(target);
  const match = fragment.match(/\/apis\/([^/]+)/);
  return safeTrim(match?.[1]) || safeTrim(target?.identifier);
}

function parseRoleName(target) {
  const candidate = safeTrim(target?.resourceId);
  if (candidate && !candidate.startsWith("arn:")) return candidate;
  const parsed = parseAwsArn(target?.resourceArn || target?.identifier || "");
  const match = safeTrim(parsed?.resource).match(/^role\/(.+)$/);
  const rolePath = safeTrim(match?.[1]);
  if (rolePath) {
    const segments = rolePath.split("/").filter(Boolean);
    if (segments.length > 0) return segments[segments.length - 1];
  }
  return safeTrim(target?.identifier);
}

function parseRepositoryName(target) {
  const candidate = safeTrim(target?.resourceId);
  if (candidate && !candidate.startsWith("arn:")) return candidate;
  const parsed = parseAwsArn(target?.resourceArn || target?.identifier || "");
  const match = safeTrim(parsed?.resource).match(/^repository\/(.+)$/);
  return safeTrim(match?.[1]) || safeTrim(target?.identifier);
}

function parseCloudFrontDistributionId(target) {
  const candidate = safeTrim(target?.resourceId);
  if (candidate && !candidate.startsWith("arn:")) return candidate;
  const parsed = parseAwsArn(target?.resourceArn || target?.identifier || "");
  const match = safeTrim(parsed?.resource).match(/^distribution\/([^/]+)$/);
  return safeTrim(match?.[1]) || safeTrim(target?.identifier);
}

function parseEc2Id(target, prefix) {
  const candidate = safeTrim(target?.resourceId || target?.identifier);
  if (candidate.startsWith(prefix)) return candidate;
  const parsed = parseAwsArn(target?.resourceArn || target?.identifier || "");
  const match = safeTrim(parsed?.resource).match(new RegExp(`^${prefix.replace("-", "\\-")}\\/([^/]+)$`));
  return safeTrim(match?.[1]) || candidate;
}

function parseNameOrArn(target) {
  return firstIdentifier(target);
}

function parseCloudWatchLogGroupName(target) {
  const candidate = safeTrim(target?.resourceId || target?.identifier);
  if (candidate && !candidate.startsWith("arn:")) {
    return candidate.endsWith(":*") ? candidate.slice(0, -2) : candidate;
  }

  const parsed = parseAwsArn(target?.resourceArn || target?.identifier || "");
  const resource = safeTrim(parsed?.resource);
  const match = resource.match(/^log-group:([^:]+)(?::\*)?(?::log-stream:.+)?$/);
  const parsedName = safeTrim(match?.[1]);
  if (parsedName) return parsedName;

  return candidate.endsWith(":*") ? candidate.slice(0, -2) : candidate;
}

function parseEfsFileSystemId(target) {
  return parseEc2Id(target, "fs");
}

function parseEfsMountTargetId(target) {
  return parseEc2Id(target, "fsmt");
}

function parseEksClusterName(target) {
  const candidate = safeTrim(target?.resourceId);
  if (candidate && !candidate.startsWith("arn:")) return candidate;
  const parsed = parseAwsArn(target?.resourceArn || target?.identifier || "");
  const match = safeTrim(parsed?.resource).match(/^cluster\/([^/]+)$/);
  return safeTrim(match?.[1]) || safeTrim(target?.identifier);
}

function parseArnOrIdentifier(target) {
  return safeTrim(target?.resourceArn || target?.resourceId || target?.identifier);
}

function parseEventBusName(target) {
  const candidate = safeTrim(target?.resourceId || target?.identifier);
  if (candidate && !candidate.startsWith("arn:")) return candidate;
  const parsed = parseAwsArn(target?.resourceArn || target?.identifier || "");
  const match = safeTrim(parsed?.resource).match(/^event-bus\/([^/]+)$/);
  return safeTrim(match?.[1]) || "default";
}

function parseEventRuleParts(target) {
  const id = safeTrim(target?.resourceId || target?.identifier);
  const parsed = parseAwsArn(target?.resourceArn || target?.identifier || "");
  const resource = safeTrim(parsed?.resource);
  const arnMatch = resource.match(/^rule\/([^/]+)\/([^/]+)$/);
  if (arnMatch) {
    return { ruleName: arnMatch[2], eventBusName: arnMatch[1] };
  }
  const defaultBusMatch = resource.match(/^rule\/([^/]+)$/);
  if (defaultBusMatch) {
    return { ruleName: defaultBusMatch[1], eventBusName: undefined };
  }
  return { ruleName: id, eventBusName: undefined };
}

function parseOpenSearchDomainName(target) {
  const candidate = safeTrim(target?.resourceId);
  if (candidate && !candidate.startsWith("arn:")) return candidate;
  const parsed = parseAwsArn(target?.resourceArn || target?.identifier || "");
  const match = safeTrim(parsed?.resource).match(/^domain\/([^/]+)$/);
  return safeTrim(match?.[1]) || safeTrim(target?.identifier);
}

function parseRdsIdentifier(target) {
  return safeTrim(target?.resourceId || target?.identifier);
}

function parseS3BucketName(target) {
  const candidate = safeTrim(target?.resourceId || target?.identifier);
  if (candidate && !candidate.startsWith("arn:")) return candidate;
  const parsed = parseAwsArn(target?.resourceArn || target?.identifier || "");
  const match = safeTrim(parsed?.resource).match(/^([^/]+)$/);
  return safeTrim(match?.[1]) || candidate;
}

function parseSqsQueueUrl(target) {
  const candidate = safeTrim(target?.resourceId || target?.identifier);
  if (candidate.startsWith("https://")) return candidate;

  const parsed = parseAwsArn(target?.resourceArn || target?.identifier || "");
  if (parsed?.service === "sqs") {
    const queueName = safeTrim(parsed?.resource);
    const region = safeTrim(parsed?.region) || safeTrim(target?.region) || DEFAULT_REGION;
    const accountId = safeTrim(parsed?.accountId) || safeTrim(target?.accountId);
    if (queueName && accountId) {
      return `https://sqs.${region}.amazonaws.com/${accountId}/${queueName}`;
    }
  }
  return candidate;
}

function parseSnsArn(target) {
  return safeTrim(target?.resourceArn || target?.resourceId || target?.identifier);
}

function parseStateMachineArn(target) {
  return safeTrim(target?.resourceArn || target?.resourceId || target?.identifier);
}

function summarizeErrors(errors = []) {
  if (!Array.isArray(errors) || errors.length === 0) return "";
  const messages = errors
    .map((entry) => safeTrim(entry?.message || entry))
    .filter(Boolean);
  if (messages.length === 0) return "";
  const uniq = [...new Set(messages)];
  return uniq.slice(0, 2).join(" | ");
}

function createCloudFormationClient(region, credentials) {
  const config = {
    region: region || DEFAULT_REGION,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new CloudFormationClient(config);
}

function createIamClient(credentials) {
  const config = {
    region: DEFAULT_REGION,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new IAMClient(config);
}

function isIamRoleNotFound(error) {
  const code = String(error?.name || error?.Code || "").toLowerCase();
  if (code === "nosuchentityexception") return true;
  return isLikelyNotFoundError(error?.message);
}

async function fetchIamRole({ target, credentials }) {
  const roleName = parseRoleName(target);
  if (!roleName) {
    throw new Error("IAM role name is required");
  }
  const client = createIamClient(credentials);
  const response = await client.send(new GetRoleCommand({ RoleName: roleName }));
  const role = response?.Role;
  if (!role) {
    throw new Error("IAM role not found");
  }
  return role;
}

function checkIamRoleLastUsed({ role }) {
  const roleName = safeTrim(role?.RoleName) || null;
  const rawLastUsed = role?.RoleLastUsed?.LastUsedDate || null;
  const lastUsedDate = rawLastUsed ? new Date(rawLastUsed) : null;
  const lastUsedAt = lastUsedDate && Number.isFinite(lastUsedDate.getTime())
    ? lastUsedDate.toISOString()
    : null;
  const thresholdDays = IAM_ROLE_LAST_USED_THRESHOLD_DAYS;
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const lastUsedMs = lastUsedDate?.getTime?.() || NaN;
  const hasValidLastUsed = Number.isFinite(lastUsedMs);
  const daysSinceLastUsed = hasValidLastUsed ? Math.floor((nowMs - lastUsedMs) / (24 * 60 * 60 * 1000)) : null;
  const recentlyUsed = hasValidLastUsed && nowMs - lastUsedMs <= thresholdMs;
  const status = recentlyUsed ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.PROBLEM;

  return createCheckResult({
    checkId: IAM_ROLE_LAST_USED_CHECK_ID,
    checkName: IAM_ROLE_LAST_USED_CHECK_NAME,
    category: "activity",
    status,
    summary: recentlyUsed
      ? `Role was used within the last ${thresholdDays} days.`
      : "Role has not been used in the last 6 months (or no recent usage was recorded).",
    details: {
      roleName,
      roleArn: role?.Arn || null,
      lastUsedAt,
      lastUsedRegion: safeTrim(role?.RoleLastUsed?.Region) || null,
      daysSinceLastUsed,
      thresholdDays,
    },
  });
}

function candidateStackIdentifiers(target) {
  const candidates = new Set();
  for (const value of [
    target?.resourceArn,
    target?.resourceId,
    target?.identifier,
    target?.displayName,
  ]) {
    const normalized = safeTrim(value);
    if (normalized) candidates.add(normalized);
  }
  return [...candidates];
}

function isCloudFormationStackNotFound(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("does not exist") || message.includes("stack with id");
}

function isCloudFormationDriftOperationInProgress(error) {
  const code = safeTrim(error?.name || error?.Code).toLowerCase();
  if (code === "operationinprogressexception") return true;
  const message = String(error?.message || "").toLowerCase();
  return message.includes("operation") && message.includes("in progress");
}

function normalizeCloudFormationStackStatus(value) {
  return safeTrim(value).toUpperCase();
}

function toIsoTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function isRecentTimestamp(value, maxAgeMs) {
  const normalized = toIsoTimestamp(value);
  if (!normalized) return false;
  const timestampMs = Date.parse(normalized);
  return Number.isFinite(timestampMs) && Date.now() - timestampMs < maxAgeMs;
}

async function fetchCloudFormationStack({ target, credentials }) {
  const region = safeTrim(target?.region) || DEFAULT_REGION;
  const client = createCloudFormationClient(region, credentials);
  const identifiers = candidateStackIdentifiers(target);
  if (identifiers.length === 0) {
    throw new Error("CloudFormation stack identifier is required");
  }

  let lastNotFoundError = null;
  for (const stackName of identifiers) {
    try {
      const response = await client.send(new DescribeStacksCommand({ StackName: stackName }));
      const stack = Array.isArray(response?.Stacks) ? response.Stacks[0] : null;
      if (!stack) continue;
      return { stack, stackName };
    } catch (error) {
      if (isCloudFormationStackNotFound(error)) {
        lastNotFoundError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastNotFoundError) throw lastNotFoundError;
  throw new Error("CloudFormation stack not found");
}

function checkCloudFormationStackStatus({ stack }) {
  const stackStatus = normalizeCloudFormationStackStatus(stack?.StackStatus);
  const failed = CLOUDFORMATION_FAILED_STACK_STATUSES.has(stackStatus);

  return createCheckResult({
    checkId: CLOUDFORMATION_STACK_STATUS_CHECK_ID,
    checkName: CLOUDFORMATION_STACK_STATUS_CHECK_NAME,
    category: "availability",
    status: stackStatus
      ? failed
        ? HEALTH_STATUS.PROBLEM
        : HEALTH_STATUS.HEALTHY
      : HEALTH_STATUS.UNKNOWN,
    summary: stackStatus
      ? `CloudFormation stack status is ${stackStatus}.`
      : "CloudFormation stack status is unavailable.",
    details: {
      stackId: stack?.StackId || null,
      stackName: stack?.StackName || null,
      stackStatus: stackStatus || null,
      stackStatusReason: safeTrim(stack?.StackStatusReason) || null,
    },
  });
}

async function detectCloudFormationStackDrift({ stack, credentials }) {
  const stackStatus = normalizeCloudFormationStackStatus(stack?.StackStatus);
  const storedDriftStatus = safeTrim(stack?.DriftInformation?.StackDriftStatus).toUpperCase();
  const storedLastCheckTimestamp = toIsoTimestamp(stack?.DriftInformation?.LastCheckTimestamp);
  const stackRef = safeTrim(stack?.StackId) || safeTrim(stack?.StackName);
  const region = safeTrim(stack?.StackId?.split(":")?.[3]) || DEFAULT_REGION;

  if (!stackRef) {
    throw new Error("CloudFormation stack identifier is required for drift detection");
  }

  if (!CLOUDFORMATION_DRIFT_SUPPORTED_STACK_STATUSES.has(stackStatus)) {
    return {
      mode: "unsupported_status",
      stackStatus,
      driftStatus: storedDriftStatus || null,
      lastCheckTimestamp: storedLastCheckTimestamp,
      usedStoredResult: Boolean(storedDriftStatus),
      message:
        "Drift detection only runs for stacks in CREATE_COMPLETE, UPDATE_COMPLETE, UPDATE_ROLLBACK_COMPLETE, or UPDATE_ROLLBACK_FAILED.",
    };
  }

  if (
    storedDriftStatus &&
    storedDriftStatus !== "NOT_CHECKED" &&
    storedDriftStatus !== "UNKNOWN" &&
    isRecentTimestamp(storedLastCheckTimestamp, CLOUDFORMATION_DRIFT_REUSE_WINDOW_MS)
  ) {
    return {
      mode: "recent_cached_result",
      stackStatus,
      driftStatus: storedDriftStatus,
      lastCheckTimestamp: storedLastCheckTimestamp,
      usedStoredResult: true,
      reusedRecentCheck: true,
      message: "Reusing CloudFormation drift status from a check completed within the last 24 hours.",
    };
  }

  const client = createCloudFormationClient(region, credentials);

  let detectionId = null;
  try {
    const detection = await client.send(new DetectStackDriftCommand({ StackName: stackRef }));
    detectionId = safeTrim(detection?.StackDriftDetectionId);
  } catch (error) {
    if (isCloudFormationDriftOperationInProgress(error)) {
      return {
        mode: "operation_in_progress",
        stackStatus,
        driftStatus: storedDriftStatus || null,
        lastCheckTimestamp: storedLastCheckTimestamp,
        detectionStatus: "DETECTION_IN_PROGRESS",
        detectionStatusReason:
          safeTrim(error?.message) || "A CloudFormation drift detection operation is already in progress for this stack.",
        usedStoredResult: Boolean(storedDriftStatus),
      };
    }
    throw error;
  }

  if (!detectionId) {
    throw new Error("CloudFormation drift detection did not return a detection id");
  }

  let lastResponse = null;
  for (let attempt = 0; attempt < CLOUDFORMATION_DRIFT_MAX_POLLS; attempt += 1) {
    if (attempt > 0) {
      await sleep(CLOUDFORMATION_DRIFT_POLL_MS);
    }

    const response = await client.send(
      new DescribeStackDriftDetectionStatusCommand({
        StackDriftDetectionId: detectionId,
      })
    );
    lastResponse = response;

    const detectionStatus = safeTrim(response?.DetectionStatus).toUpperCase();
    if (
      detectionStatus === "DETECTION_COMPLETE" ||
      detectionStatus === "DETECTION_FAILED"
    ) {
      return {
        mode: "active_detection",
        stackStatus,
        detectionId,
        detectionStatus,
        detectionStatusReason: safeTrim(response?.DetectionStatusReason) || null,
        driftStatus:
          safeTrim(response?.StackDriftStatus).toUpperCase() || storedDriftStatus || null,
        lastCheckTimestamp: toIsoTimestamp(response?.Timestamp) || storedLastCheckTimestamp,
        driftedStackResourceCount: Number.isFinite(Number(response?.DriftedStackResourceCount))
          ? Number(response.DriftedStackResourceCount)
          : null,
        usedStoredResult: false,
      };
    }
  }

  return {
    mode: "active_detection_timeout",
    stackStatus,
    detectionId,
    detectionStatus:
      safeTrim(lastResponse?.DetectionStatus).toUpperCase() || "DETECTION_IN_PROGRESS",
    detectionStatusReason:
      safeTrim(lastResponse?.DetectionStatusReason) ||
      "CloudFormation drift detection did not finish before the health scan timed out.",
    driftStatus: storedDriftStatus || null,
    lastCheckTimestamp: storedLastCheckTimestamp,
    driftedStackResourceCount: Number.isFinite(Number(lastResponse?.DriftedStackResourceCount))
      ? Number(lastResponse.DriftedStackResourceCount)
      : null,
    usedStoredResult: Boolean(storedDriftStatus),
  };
}

function checkCloudFormationDrift({ stack, driftEvaluation = null }) {
  const driftStatus = safeTrim(
    driftEvaluation?.driftStatus || stack?.DriftInformation?.StackDriftStatus
  ).toUpperCase();
  const lastCheckTimestamp =
    driftEvaluation?.lastCheckTimestamp || toIsoTimestamp(stack?.DriftInformation?.LastCheckTimestamp);
  const detectionStatus = safeTrim(driftEvaluation?.detectionStatus).toUpperCase();
  const driftDetails = {
    stackId: stack?.StackId || null,
    stackName: stack?.StackName || null,
    stackStatus:
      driftEvaluation?.stackStatus || normalizeCloudFormationStackStatus(stack?.StackStatus) || null,
    driftStatus: driftStatus || null,
    lastCheckTimestamp,
    detectionStatus: detectionStatus || null,
    detectionStatusReason: safeTrim(driftEvaluation?.detectionStatusReason) || null,
    stackDriftDetectionId: safeTrim(driftEvaluation?.detectionId) || null,
    driftedStackResourceCount: Number.isFinite(driftEvaluation?.driftedStackResourceCount)
      ? driftEvaluation.driftedStackResourceCount
      : null,
    evaluationMode: safeTrim(driftEvaluation?.mode) || "describe_stacks",
    reusedRecentCheck: driftEvaluation?.reusedRecentCheck === true,
    usedStoredResult: driftEvaluation?.usedStoredResult === true,
  };

  if (driftEvaluation?.mode === "unsupported_status") {
    return createCheckResult({
      checkId: CLOUDFORMATION_DRIFT_CHECK_ID,
      checkName: CLOUDFORMATION_DRIFT_CHECK_NAME,
      category: "configuration",
      status: HEALTH_STATUS.UNKNOWN,
      summary:
        driftEvaluation?.message ||
        "CloudFormation drift detection is unavailable for the current stack status.",
      details: driftDetails,
    });
  }

  if (
    driftEvaluation?.mode === "recent_cached_result" ||
    driftEvaluation?.mode === "operation_in_progress" ||
    driftEvaluation?.mode === "active_detection_timeout"
  ) {
    if (driftStatus === "DRIFTED") {
      return createCheckResult({
        checkId: CLOUDFORMATION_DRIFT_CHECK_ID,
        checkName: CLOUDFORMATION_DRIFT_CHECK_NAME,
        category: "configuration",
        status: HEALTH_STATUS.PROBLEM,
        summary:
          driftEvaluation?.mode === "recent_cached_result"
            ? "CloudFormation stack is currently reported as DRIFTED based on a drift check completed within the last 24 hours."
            : "CloudFormation stack is currently reported as DRIFTED while a fresh drift detection is still in progress.",
        details: driftDetails,
      });
    }

    if (
      driftEvaluation?.mode === "recent_cached_result" &&
      driftStatus === "IN_SYNC"
    ) {
      return createCheckResult({
        checkId: CLOUDFORMATION_DRIFT_CHECK_ID,
        checkName: CLOUDFORMATION_DRIFT_CHECK_NAME,
        category: "configuration",
        status: HEALTH_STATUS.HEALTHY,
        summary:
          "CloudFormation stack is currently reported as IN_SYNC based on a drift check completed within the last 24 hours.",
        details: driftDetails,
      });
    }

    return createCheckResult({
      checkId: CLOUDFORMATION_DRIFT_CHECK_ID,
      checkName: CLOUDFORMATION_DRIFT_CHECK_NAME,
      category: "configuration",
      status: HEALTH_STATUS.UNKNOWN,
      summary:
        driftEvaluation?.mode === "recent_cached_result"
          ? "Reusing CloudFormation drift status from a check completed within the last 24 hours."
          : "CloudFormation drift detection is still in progress.",
      details: driftDetails,
    });
  }

  if (driftStatus === "IN_SYNC") {
    return createCheckResult({
      checkId: CLOUDFORMATION_DRIFT_CHECK_ID,
      checkName: CLOUDFORMATION_DRIFT_CHECK_NAME,
      category: "configuration",
      status: HEALTH_STATUS.HEALTHY,
      summary: "CloudFormation stack drift status is IN_SYNC.",
      details: driftDetails,
    });
  }

  if (driftStatus === "DRIFTED") {
    return createCheckResult({
      checkId: CLOUDFORMATION_DRIFT_CHECK_ID,
      checkName: CLOUDFORMATION_DRIFT_CHECK_NAME,
      category: "configuration",
      status: HEALTH_STATUS.PROBLEM,
      summary: "CloudFormation stack drift status is DRIFTED.",
      details: driftDetails,
    });
  }

  if (detectionStatus === "DETECTION_FAILED") {
    return createCheckResult({
      checkId: CLOUDFORMATION_DRIFT_CHECK_ID,
      checkName: CLOUDFORMATION_DRIFT_CHECK_NAME,
      category: "configuration",
      status: HEALTH_STATUS.UNKNOWN,
      summary: "CloudFormation drift detection did not complete successfully.",
      details: driftDetails,
    });
  }

  if (!driftStatus || driftStatus === "NOT_CHECKED" || driftStatus === "UNKNOWN") {
    const completedWithUnknown =
      driftStatus === "UNKNOWN" && driftEvaluation?.mode === "active_detection";
    return createCheckResult({
      checkId: CLOUDFORMATION_DRIFT_CHECK_ID,
      checkName: CLOUDFORMATION_DRIFT_CHECK_NAME,
      category: "configuration",
      status: completedWithUnknown ? HEALTH_STATUS.ERROR : HEALTH_STATUS.UNKNOWN,
      summary: completedWithUnknown
        ? "CloudFormation drift detection completed but returned UNKNOWN."
        : driftStatus
        ? `CloudFormation stack drift status is ${driftStatus}.`
        : "CloudFormation stack drift status is unavailable.",
      details: driftDetails,
    });
  }

  return createCheckResult({
    checkId: CLOUDFORMATION_DRIFT_CHECK_ID,
    checkName: CLOUDFORMATION_DRIFT_CHECK_NAME,
    category: "configuration",
    status: HEALTH_STATUS.UNKNOWN,
    summary: `CloudFormation stack drift status is ${driftStatus}.`,
    details: driftDetails,
  });
}

function buildDiscoverabilityResult({
  target,
  matched,
  errorSummary,
  explicitStatus,
}) {
  const status = explicitStatus || (matched ? "healthy" : errorSummary ? "error" : "problem");
  const errors = status === "error" ? [errorSummary || "Resource health check failed"] : [];
  return createResourceResult({ target, checks: [], errors });
}

function resolveMatchedResources(result, target) {
  const resources = Array.isArray(result?.resources) ? result.resources : [];
  const targetSet = targetTokens(target);
  return resources.filter((resource) => hasTokenIntersection(targetSet, resourceTokens(resource)));
}

async function evaluateScannerLookup({
  target,
  credentials,
  logger,
  scanFn,
  buildScanOptions,
  explicitMatch,
}) {
  const result = await scanFn({
    ...scanBaseOptions(target, credentials, logger),
    ...(buildScanOptions ? buildScanOptions(target) : {}),
  });
  const errors = Array.isArray(result?.errors) ? result.errors : [];
  const matched = explicitMatch
    ? explicitMatch(result, target)
    : resolveMatchedResources(result, target).length > 0;
  const errorSummary = summarizeErrors(errors);

  if (matched) {
    return buildDiscoverabilityResult({
      target,
      matched: true,
      errorSummary,
    });
  }

  if (errorSummary && errors.every((entry) => isLikelyNotFoundError(entry?.message || entry))) {
    return buildDiscoverabilityResult({
      target,
      matched: false,
      explicitStatus: "problem",
    });
  }

  return buildDiscoverabilityResult({
    target,
    matched: false,
    errorSummary,
  });
}

async function evaluateCloudFormationStack({ target, credentials, logger }) {
  const checks = [];
  const errors = [];
  try {
    const { stack } = await fetchCloudFormationStack({ target, credentials });
    checks.push(checkCloudFormationStackStatus({ stack }));

    try {
      const driftEvaluation = await detectCloudFormationStackDrift({ stack, credentials });
      checks.push(checkCloudFormationDrift({ stack, driftEvaluation }));
    } catch (error) {
      const message = error?.message || "CloudFormation drift detection failed";
      logger?.warn?.("[resource-health] cloudformation drift detection failed", {
        targetKey: target?.targetKey || null,
        stackId: stack?.StackId || null,
        stackName: stack?.StackName || null,
        message,
      });
      checks.push(
        createCheckResult({
          checkId: CLOUDFORMATION_DRIFT_CHECK_ID,
          checkName: CLOUDFORMATION_DRIFT_CHECK_NAME,
          category: "configuration",
          status: HEALTH_STATUS.ERROR,
          summary: `Unable to evaluate stack drift status: ${message}.`,
          details: {
            stackId: stack?.StackId || null,
            stackName: stack?.StackName || null,
            stackStatus: normalizeCloudFormationStackStatus(stack?.StackStatus) || null,
          },
        })
      );
    }
  } catch (error) {
    const message = error?.message || "CloudFormation stack check failed";
    const notFound = isCloudFormationStackNotFound(error);
    if (!notFound) {
      errors.push(message);
    }
    checks.push(
      createCheckResult({
        checkId: CLOUDFORMATION_STACK_STATUS_CHECK_ID,
        checkName: CLOUDFORMATION_STACK_STATUS_CHECK_NAME,
        category: "availability",
        status: notFound ? HEALTH_STATUS.UNKNOWN : HEALTH_STATUS.ERROR,
        summary: notFound
          ? "Cannot evaluate CloudFormation stack status because the stack was not found."
          : `Unable to evaluate CloudFormation stack status: ${message}.`,
      })
    );
    checks.push(
      createCheckResult({
        checkId: CLOUDFORMATION_DRIFT_CHECK_ID,
        checkName: CLOUDFORMATION_DRIFT_CHECK_NAME,
        category: "configuration",
        status: notFound ? HEALTH_STATUS.UNKNOWN : HEALTH_STATUS.ERROR,
        summary: notFound
          ? "Cannot evaluate stack drift because the stack was not found."
          : `Unable to evaluate stack drift status: ${message}.`,
      })
    );
  }
  return createResourceResult({ target, checks, errors });
}

async function evaluateIamRole({ target, credentials }) {
  const checks = [];
  const errors = [];

  try {
    const role = await fetchIamRole({ target, credentials });
    checks.push(checkIamRoleLastUsed({ role }));
  } catch (error) {
    const message = error?.message || "IAM role check failed";
    const notFound = isIamRoleNotFound(error);
    if (!notFound) errors.push(message);

    checks.push(
      createCheckResult({
        checkId: IAM_ROLE_LAST_USED_CHECK_ID,
        checkName: IAM_ROLE_LAST_USED_CHECK_NAME,
        category: "activity",
        status: notFound ? HEALTH_STATUS.UNKNOWN : HEALTH_STATUS.ERROR,
        summary: notFound
          ? "Cannot evaluate IAM role last-used because the role was not found."
          : `Unable to evaluate IAM role last-used status: ${message}.`,
      })
    );
  }

  return createResourceResult({ target, checks, errors });
}

async function evaluateTarget(target, { credentials, logger }) {
  switch (target.resourceType) {
    case "AWS::ApiGateway::ApiKey":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanApiGatewayApiKeys,
        buildScanOptions: (t) => ({ apiKeyIds: [parseApiGatewayApiKeyId(t)] }),
      });
    case "AWS::ApiGateway::RestApi":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanApiGatewayRestApis,
        buildScanOptions: (t) => ({ restApiIds: [parseApiGatewayRestApiId(t)] }),
      });
    case "AWS::ApiGatewayV2::Api":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanApiGatewayV2Apis,
        buildScanOptions: (t) => ({ apiIds: [parseApiGatewayV2ApiId(t)] }),
      });
    case "AWS::AutoScaling::AutoScalingGroup":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanAutoScalingGroups,
        buildScanOptions: (t) => ({ autoScalingGroupNames: [parseNameOrArn(t)] }),
      });
    case "AWS::AutoScaling::LaunchConfiguration":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanLaunchConfigurations,
        buildScanOptions: (t) => ({ launchConfigurationNames: [parseNameOrArn(t)] }),
      });
    case "AWS::CloudFormation::Stack":
      return evaluateCloudFormationStack({ target, credentials, logger });
    case "AWS::CloudFront::Distribution":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanCloudFrontDistributions,
        buildScanOptions: (t) => ({
          distributionIds: [parseCloudFrontDistributionId(t)],
          distributionArns: [safeTrim(t?.resourceArn)].filter(Boolean),
        }),
      });
    case "AWS::EC2::SecurityGroup":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanEc2SecurityGroups,
        buildScanOptions: (t) => ({ groupIds: [parseEc2Id(t, "sg")] }),
      });
    case "AWS::EC2::VPC":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanEc2Vpcs,
        buildScanOptions: (t) => ({ vpcIds: [parseEc2Id(t, "vpc")] }),
      });
    case "AWS::ECR::Repository":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanEcrRepositories,
        buildScanOptions: (t) => ({ repositoryNames: [parseRepositoryName(t)] }),
      });
    case "AWS::ECS::Cluster":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanEcsClusters,
        buildScanOptions: (t) => ({ clusters: [parseNameOrArn(t)] }),
      });
    case "AWS::EFS::FileSystem":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanEfsFileSystems,
        buildScanOptions: (t) => ({ fileSystemIds: [parseEfsFileSystemId(t)] }),
      });
    case "AWS::EFS::MountTarget":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanEfsMountTargets,
        buildScanOptions: (t) => ({ mountTargetIds: [parseEfsMountTargetId(t)] }),
      });
    case "AWS::EKS::Cluster":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanEksClusters,
        buildScanOptions: (t) => ({ clusterNames: [parseEksClusterName(t)] }),
      });
    case "AWS::EKS::Nodegroup":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanEksNodegroups,
        buildScanOptions: (t) => ({ nodegroupArns: [parseArnOrIdentifier(t)] }),
      });
    case "AWS::EKS::FargateProfile":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanEksFargateProfiles,
        buildScanOptions: (t) => ({ fargateProfileArns: [parseArnOrIdentifier(t)] }),
      });
    case "AWS::ElasticLoadBalancingV2::LoadBalancer":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanElbv2LoadBalancers,
        buildScanOptions: (t) => ({ loadBalancerArns: [parseArnOrIdentifier(t)] }),
      });
    case "AWS::ElasticLoadBalancingV2::Listener":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanElbv2Listeners,
        buildScanOptions: (t) => ({ listenerArns: [parseArnOrIdentifier(t)] }),
      });
    case "AWS::ElasticLoadBalancingV2::TargetGroup":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanElbv2TargetGroups,
        buildScanOptions: (t) => ({ targetGroupArns: [parseArnOrIdentifier(t)] }),
      });
    case "AWS::Events::EventBus":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanEventBridgeEventBuses,
        buildScanOptions: (t) => ({ eventBusNames: [parseEventBusName(t)] }),
      });
    case "AWS::Events::Rule":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanEventBridgeRules,
        buildScanOptions: (t) => {
          const { ruleName, eventBusName } = parseEventRuleParts(t);
          return {
            ruleNames: [ruleName],
            ...(eventBusName ? { eventBusName } : {}),
          };
        },
      });
    case "AWS::IAM::Role":
      return evaluateIamRole({ target, credentials });
    case "AWS::Logs::LogGroup":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanCloudWatchLogGroups,
        buildScanOptions: (t) => ({ logGroupNames: [parseCloudWatchLogGroupName(t)] }),
      });
    case "AWS::OpenSearchService::Domain":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanOpenSearchDomains,
        buildScanOptions: (t) => ({ domainNames: [parseOpenSearchDomainName(t)] }),
      });
    case "AWS::RDS::DBSubnetGroup":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanRdsDbSubnetGroups,
        buildScanOptions: (t) => ({ dbSubnetGroupNames: [parseRdsIdentifier(t)] }),
      });
    case "AWS::RDS::DBParameterGroup":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanRdsDbParameterGroups,
        buildScanOptions: (t) => ({ dbParameterGroupNames: [parseRdsIdentifier(t)] }),
      });
    case "AWS::S3::Bucket":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanS3Resources,
        buildScanOptions: (t) => ({ bucketNames: [parseS3BucketName(t)] }),
      });
    case "AWS::StepFunctions::StateMachine":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanSfnStateMachines,
        buildScanOptions: (t) => ({ stateMachineArns: [parseStateMachineArn(t)] }),
      });
    case "AWS::SNS::Topic":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanSnsTopics,
        buildScanOptions: (t) => ({ topicArns: [parseSnsArn(t)] }),
      });
    case "AWS::SNS::Subscription":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanSnsSubscriptions,
        buildScanOptions: (t) => ({ subscriptionArns: [parseSnsArn(t)] }),
      });
    case "AWS::SQS::Queue":
      return evaluateScannerLookup({
        target,
        credentials,
        logger,
        scanFn: scanSqsQueues,
        buildScanOptions: (t) => ({ queueUrls: [parseSqsQueueUrl(t)] }),
      });
    default:
      return createResourceResult({
        target,
        checks: [],
        errors: [],
      });
  }
}

export async function runOtherAwsHealthChecks({
  resources = [],
  credentials,
  logger,
} = {}) {
  const results = [];
  for (const target of resources) {
    results.push(await evaluateTarget(target, { credentials, logger }));
  }
  return results;
}
