import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { Router } from "express";
import { fromIni } from "@aws-sdk/credential-provider-ini";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import {
  CloudFormationClient,
  DescribeStacksCommand,
  ListStackResourcesCommand,
} from "@aws-sdk/client-cloudformation";
import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import {
  S3Client,
  GetBucketLocationCommand,
  ListBucketsCommand,
} from "@aws-sdk/client-s3";
import { LambdaClient, ListFunctionsCommand } from "@aws-sdk/client-lambda";
import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import {
  DynamoDBClient,
  DescribeTableCommand,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";
import { parseStoredObject } from "@cloudagent/storage";
import { refineLocalWorkloadDiscoveryWithOpenAI } from "../../platform/openai.mjs";
import { safeTrim } from "@cloudagent/platform/utils";
import { consolidateDiscoveredWorkloads } from "./workload-discovery-grouping.mjs";

const DEFAULT_REGION = "us-east-1";
const GLOBAL_SERVICES = new Set(["s3"]);
const TAG_GROUP_KEYS = ["cloudagent:workload", "Workload", "Application", "App", "Project", "Service"];

function parseIni(text = "") {
  const sections = {};
  let current = null;
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const sectionMatch = line.match(/^\[([^\]]+)]$/);
    if (sectionMatch) {
      current = sectionMatch[1].trim();
      sections[current] ||= {};
      continue;
    }
    if (!current) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) sections[current][key] = value;
  }
  return sections;
}

async function readIniIfExists(filePath) {
  try {
    return parseIni(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
}

function normalizeConfigProfileName(sectionName) {
  if (sectionName === "default") return "default";
  return sectionName.startsWith("profile ")
    ? sectionName.slice("profile ".length).trim()
    : sectionName.trim();
}

export async function listAwsProfiles() {
  const awsDir = path.join(os.homedir(), ".aws");
  const [config, credentials] = await Promise.all([
    readIniIfExists(path.join(awsDir, "config")),
    readIniIfExists(path.join(awsDir, "credentials")),
  ]);
  const profiles = new Map();

  for (const [sectionName, values] of Object.entries(config)) {
    const name = normalizeConfigProfileName(sectionName);
    if (!name) continue;
    profiles.set(name, {
      name,
      region: values.region || "",
      sources: ["config"],
      hasSso: Boolean(values.sso_start_url || values.sso_session),
      hasStaticCredentials: false,
    });
  }

  for (const [name, values] of Object.entries(credentials)) {
    if (!name) continue;
    const existing = profiles.get(name) || {
      name,
      region: "",
      sources: [],
      hasSso: false,
      hasStaticCredentials: false,
    };
    profiles.set(name, {
      ...existing,
      sources: Array.from(new Set([...(existing.sources || []), "credentials"])),
      hasStaticCredentials: Boolean(values.aws_access_key_id && values.aws_secret_access_key),
    });
  }

  return Array.from(profiles.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function tagsArrayToObject(tags = []) {
  if (!Array.isArray(tags)) return {};
  return tags.reduce((acc, tag) => {
    const key = tag?.Key || tag?.key;
    if (!key) return acc;
    acc[String(key)] = String(tag?.Value ?? tag?.value ?? "");
    return acc;
  }, {});
}

function getCredentialProvider(authProfile = {}) {
  const authType = safeTrim(authProfile.authType || authProfile.credentialMode);
  const accessKeyId = safeTrim(authProfile.accessKeyId);
  const secretAccessKey = safeTrim(authProfile.secretAccessKey);
  const sessionToken = safeTrim(authProfile.sessionToken || authProfile.refreshKey);

  if (authType === "static-credentials" || (accessKeyId && secretAccessKey)) {
    if (!accessKeyId || !secretAccessKey) {
      throw new Error("Access key ID and secret access key are required.");
    }
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

  throw new Error("Local AWS discovery requires an AWS profile, AWS SSO profile, or access keys.");
}

function clientConfig({ authProfile, region }) {
  const credentials = getCredentialProvider(authProfile);
  return {
    region: region || DEFAULT_REGION,
    ...(credentials ? { credentials } : {}),
  };
}

async function getCallerIdentity({ authProfile, region }) {
  const client = new STSClient(clientConfig({ authProfile, region }));
  return client.send(new GetCallerIdentityCommand({}));
}

export async function validateAwsCredentials({ authProfile, region } = {}) {
  const normalizedAuthProfile = parseStoredObject(authProfile, authProfile || {});
  const identity = await getCallerIdentity({
    authProfile: normalizedAuthProfile,
    region: region || normalizedAuthProfile.region || normalizedAuthProfile.defaultRegion || DEFAULT_REGION,
  });
  return {
    ok: true,
    code: "SUCCESS",
    message: "AWS credentials are valid.",
    accountId: identity.Account || null,
    arn: identity.Arn || null,
    userId: identity.UserId || null,
    identity,
  };
}

function normalizeSelectedServices(services = []) {
  const values = Array.isArray(services) ? services : [];
  return new Set(values.map((item) => safeTrim(item).toLowerCase()).filter(Boolean));
}

function shouldScanService(selected, service) {
  return selected.size === 0 || selected.has(service);
}

async function scanCloudFormation({ authProfile, regions, accountId }) {
  const stacks = [];
  const errors = [];

  for (const region of regions) {
    const client = new CloudFormationClient(clientConfig({ authProfile, region }));
    let NextToken;
    do {
      try {
        const response = await client.send(new DescribeStacksCommand({ NextToken }));
        NextToken = response.NextToken;
        for (const stack of response.Stacks || []) {
          if (stack.StackStatus === "DELETE_COMPLETE") continue;
          let resources = [];
          try {
            let resourceNextToken;
            do {
              const resourceResponse = await client.send(new ListStackResourcesCommand({
                StackName: stack.StackName,
                NextToken: resourceNextToken,
              }));
              resourceNextToken = resourceResponse.NextToken;
              resources.push(...(resourceResponse.StackResourceSummaries || []).map((resource) => ({
                resourceId: safeTrim(resource.PhysicalResourceId || resource.LogicalResourceId),
                physicalResourceId: safeTrim(resource.PhysicalResourceId),
                logicalResourceId: safeTrim(resource.LogicalResourceId),
                resourceType: safeTrim(resource.ResourceType),
                region,
                accountId,
                displayName: safeTrim(resource.LogicalResourceId || resource.PhysicalResourceId),
                stackId: stack.StackId,
                stackName: stack.StackName,
              })));
            } while (resourceNextToken);
          } catch (error) {
            errors.push({
              region,
              stackName: stack.StackName,
              error: error?.message || String(error),
            });
          }

          stacks.push({
            stackId: stack.StackId,
            stackArn: stack.StackId,
            name: stack.StackName,
            description: stack.Description || "",
            region,
            accountId,
            status: stack.StackStatus,
            tags: tagsArrayToObject(stack.Tags || []),
            resourceCount: resources.length,
            resources,
          });
        }
      } catch (error) {
        NextToken = undefined;
        errors.push({ region, error: error?.message || String(error) });
      }
    } while (NextToken);
  }

  return { stacks, errors };
}

async function scanEc2({ authProfile, regions, accountId }) {
  const resources = [];
  const errors = [];
  for (const region of regions) {
    const client = new EC2Client(clientConfig({ authProfile, region }));
    let NextToken;
    do {
      try {
        const response = await client.send(new DescribeInstancesCommand({ NextToken }));
        NextToken = response.NextToken;
        for (const reservation of response.Reservations || []) {
          for (const instance of reservation.Instances || []) {
            const tags = tagsArrayToObject(instance.Tags || []);
            resources.push({
              resourceId: instance.InstanceId,
              resourceArn: `arn:aws:ec2:${region}:${accountId}:instance/${instance.InstanceId}`,
              resourceType: "AWS::EC2::Instance",
              region,
              accountId,
              displayName: tags.Name || instance.InstanceId,
              state: instance.State?.Name || "",
              tags,
            });
          }
        }
      } catch (error) {
        NextToken = undefined;
        errors.push({ region, error: error?.message || String(error) });
      }
    } while (NextToken);
  }
  return { service: "EC2", regions, resources, errors };
}

async function scanS3({ authProfile, regions, accountId }) {
  const client = new S3Client(clientConfig({ authProfile, region: DEFAULT_REGION }));
  const resources = [];
  const errors = [];
  try {
    const response = await client.send(new ListBucketsCommand({}));
    for (const bucket of response.Buckets || []) {
      let bucketRegion = DEFAULT_REGION;
      try {
        const location = await client.send(new GetBucketLocationCommand({ Bucket: bucket.Name }));
        bucketRegion = location.LocationConstraint || DEFAULT_REGION;
        if (bucketRegion === "EU") bucketRegion = "eu-west-1";
      } catch (error) {
        errors.push({ bucketName: bucket.Name, error: error?.message || String(error) });
      }
      if (regions.length > 0 && !regions.includes(bucketRegion)) continue;
      resources.push({
        resourceId: bucket.Name,
        resourceArn: `arn:aws:s3:::${bucket.Name}`,
        resourceType: "AWS::S3::Bucket",
        region: bucketRegion,
        accountId,
        displayName: bucket.Name,
      });
    }
  } catch (error) {
    errors.push({ region: "global", error: error?.message || String(error) });
  }
  return { service: "S3", regions: ["global"], resources, errors };
}

async function scanLambda({ authProfile, regions, accountId }) {
  const resources = [];
  const errors = [];
  for (const region of regions) {
    const client = new LambdaClient(clientConfig({ authProfile, region }));
    let Marker;
    do {
      try {
        const response = await client.send(new ListFunctionsCommand({ Marker }));
        Marker = response.NextMarker;
        resources.push(...(response.Functions || []).map((fn) => ({
          resourceId: fn.FunctionName,
          resourceArn: fn.FunctionArn,
          resourceType: "AWS::Lambda::Function",
          region,
          accountId,
          displayName: fn.FunctionName,
          runtime: fn.Runtime || "",
        })));
      } catch (error) {
        Marker = undefined;
        errors.push({ region, error: error?.message || String(error) });
      }
    } while (Marker);
  }
  return { service: "Lambda", regions, resources, errors };
}

async function scanRds({ authProfile, regions, accountId }) {
  const resources = [];
  const errors = [];
  for (const region of regions) {
    const client = new RDSClient(clientConfig({ authProfile, region }));
    let Marker;
    do {
      try {
        const response = await client.send(new DescribeDBInstancesCommand({ Marker }));
        Marker = response.Marker;
        resources.push(...(response.DBInstances || []).map((db) => ({
          resourceId: db.DBInstanceIdentifier,
          resourceArn: db.DBInstanceArn,
          resourceType: "AWS::RDS::DBInstance",
          region,
          accountId,
          displayName: db.DBInstanceIdentifier,
          engine: db.Engine || "",
        })));
      } catch (error) {
        Marker = undefined;
        errors.push({ region, error: error?.message || String(error) });
      }
    } while (Marker);
  }
  return { service: "RDS", regions, resources, errors };
}

async function scanDynamoDb({ authProfile, regions, accountId }) {
  const resources = [];
  const errors = [];
  for (const region of regions) {
    const client = new DynamoDBClient(clientConfig({ authProfile, region }));
    let ExclusiveStartTableName;
    do {
      try {
        const response = await client.send(new ListTablesCommand({ ExclusiveStartTableName }));
        ExclusiveStartTableName = response.LastEvaluatedTableName;
        for (const tableName of response.TableNames || []) {
          try {
            const tableResponse = await client.send(new DescribeTableCommand({ TableName: tableName }));
            resources.push({
              resourceId: tableName,
              resourceArn: tableResponse.Table?.TableArn || `arn:aws:dynamodb:${region}:${accountId}:table/${tableName}`,
              resourceType: "AWS::DynamoDB::Table",
              region,
              accountId,
              displayName: tableName,
            });
          } catch (error) {
            errors.push({ region, tableName, error: error?.message || String(error) });
          }
        }
      } catch (error) {
        ExclusiveStartTableName = undefined;
        errors.push({ region, error: error?.message || String(error) });
      }
    } while (ExclusiveStartTableName);
  }
  return { service: "DynamoDB", regions, resources, errors };
}

const SERVICE_SCANNERS = {
  ec2: scanEc2,
  s3: scanS3,
  lambda: scanLambda,
  rds: scanRds,
  dynamodb: scanDynamoDb,
};

function getTagGroupName(resource) {
  const tags = resource?.tags && typeof resource.tags === "object" ? resource.tags : {};
  for (const key of TAG_GROUP_KEYS) {
    const value = safeTrim(tags[key]);
    if (value) return value;
  }
  return "";
}

function buildDiscoveredWorkloads({ environmentName, accountId, scanResults }) {
  const workloads = [];
  const stackResourceIds = new Set();
  for (const stack of scanResults.cloudformation?.stacks || []) {
    for (const resource of stack.resources || []) {
      if (resource.resourceId) stackResourceIds.add(resource.resourceId);
      if (resource.physicalResourceId) stackResourceIds.add(resource.physicalResourceId);
    }
    workloads.push({
      name: stack.name || "CloudFormation stack",
      description: stack.description || `Discovered from CloudFormation stack ${stack.name || stack.stackId}.`,
      trackedResources: {
        stacks: [{
          stackId: stack.stackId,
          stackArn: stack.stackArn,
          name: stack.name,
          description: stack.description,
          region: stack.region,
          accountId,
        }],
        resources: Array.isArray(stack.resources) ? stack.resources : [],
      },
      metadata: {
        phase: "local_discovered",
        discoverySource: "cloudformation",
      },
    });
  }

  const taggedGroups = new Map();
  const ungrouped = [];
  const services = scanResults.services || {};
  for (const [serviceKey, serviceData] of Object.entries(services)) {
    for (const resource of serviceData.resources || []) {
      const resourceId = safeTrim(resource.resourceId || resource.physicalResourceId);
      if (resourceId && stackResourceIds.has(resourceId)) continue;
      const groupName = getTagGroupName(resource);
      const nextResource = {
        ...resource,
        serviceName: serviceData.service || serviceKey,
        serviceKey,
      };
      if (groupName) {
        if (!taggedGroups.has(groupName)) taggedGroups.set(groupName, []);
        taggedGroups.get(groupName).push(nextResource);
      } else {
        ungrouped.push(nextResource);
      }
    }
  }

  for (const [name, resources] of taggedGroups.entries()) {
    workloads.push({
      name,
      description: `Discovered from AWS resource tags in ${environmentName}.`,
      trackedResources: { resources, stacks: [] },
      metadata: {
        phase: "local_discovered",
        discoverySource: "tags",
      },
    });
  }

  if (ungrouped.length > 0 || workloads.length === 0) {
    workloads.push({
      name: `Discovered resources - ${environmentName}`,
      description: `Ungrouped AWS resources discovered in account ${accountId || "unknown"}.`,
      trackedResources: { resources: ungrouped, stacks: [] },
      metadata: {
        phase: "local_discovered",
        discoverySource: "ungrouped",
      },
    });
  }

  return workloads;
}

function countScannedResources(scanResults = {}) {
  return Object.values(scanResults.services || {})
    .reduce((sum, service) => sum + (Array.isArray(service.resources) ? service.resources.length : 0), 0);
}

function buildDiscoveryFinalText({ profile, scanResults, workloads, llmSummary }) {
  const serviceCount = Object.keys(scanResults.services || {}).length;
  const resourceCount = countScannedResources(scanResults);
  const stackCount = Array.isArray(scanResults.cloudformation?.stacks)
    ? scanResults.cloudformation.stacks.length
    : 0;
  const workloadLines = (Array.isArray(workloads) ? workloads : [])
    .slice(0, 4)
    .map((workload) => {
      const name = safeTrim(workload?.name || workload?.workloadName) || "Discovered workload";
      const description = safeTrim(workload?.description) || "Grouped from the local AWS inventory scan.";
      const confidence = typeof workload?.confidence === "number"
        ? ` Confidence: ${Math.max(0, Math.min(1, workload.confidence)).toFixed(2)}.`
        : "";
      return `- **${name}** - ${description}${confidence}`;
    });

  return [
    `I scanned ${profile.name || "this AWS account"} and found ${resourceCount} resource${resourceCount === 1 ? "" : "s"} across ${serviceCount} service${serviceCount === 1 ? "" : "s"}, plus ${stackCount} CloudFormation stack${stackCount === 1 ? "" : "s"}.`,
    "",
    "Proposed workloads:",
    ...(workloadLines.length > 0 ? workloadLines : ["- No confident workload candidates were identified yet."]),
    llmSummary ? "" : null,
    llmSummary ? `Notes: ${llmSummary}` : null,
    "",
    "Review the workload cards and quick-add the ones you want to keep locally.",
  ].filter((line) => line !== null).join("\n");
}

async function discoverAwsEnvironment({ store, body, emit }) {
  const permissionProfileId = safeTrim(body.permissionProfileId);
  if (!permissionProfileId) throw new Error("permissionProfileId is required");

  const profile = await store.getPermissionProfile(permissionProfileId);
  if (!profile) throw new Error("Permission profile not found");

  const authProfile = parseStoredObject(profile.authProfile, {});
  const deploymentPreferences = parseStoredObject(profile.deploymentPreferences, {});
  const profileType = safeTrim(profile.type).toLowerCase().replace(/_/g, " ");
  if (profileType !== "aws account" && authProfile.provider !== "aws") {
    throw new Error("Local workload discovery currently supports AWS accounts only.");
  }

  const selectedServices = normalizeSelectedServices(body.services);
  const regions = Array.from(new Set(
    (Array.isArray(body.regions) && body.regions.length
      ? body.regions
      : deploymentPreferences.defaultRegions || [DEFAULT_REGION])
      .map((region) => safeTrim(region))
      .filter(Boolean)
  ));
  if (regions.length === 0) regions.push(DEFAULT_REGION);

  emit("hello", {
    sessionId: body.sessionId || `local-discovery-${crypto.randomUUID()}`,
    runtime: "local",
  });
  emit("scan_start", {
    permissionProfileId,
    regions,
    services: Array.from(selectedServices),
  });

  const caller = await getCallerIdentity({ authProfile, region: regions[0] || DEFAULT_REGION });
  const accountId = safeTrim(caller.Account || authProfile.awsAccountId || authProfile.accountId);
  const expectedAccountId = safeTrim(authProfile.awsAccountId || authProfile.accountId);
  if (expectedAccountId && accountId && expectedAccountId !== accountId) {
    throw new Error(`AWS credentials resolved to account ${accountId}, but this environment is configured for ${expectedAccountId}.`);
  }

  const scanResults = {
    accountId,
    requestedServices: Array.from(selectedServices),
    services: {},
    syncedAt: new Date().toISOString(),
    inventory: {
      source: "local-aws-sdk",
      generatedAt: new Date().toISOString(),
    },
    cloudformation: { stacks: [], errors: [] },
  };

  const cfn = await scanCloudFormation({ authProfile, regions, accountId });
  scanResults.cloudformation = cfn;

  for (const [serviceKey, scanner] of Object.entries(SERVICE_SCANNERS)) {
    if (!shouldScanService(selectedServices, serviceKey)) continue;
    const serviceRegions = GLOBAL_SERVICES.has(serviceKey) ? regions : regions;
    const serviceResult = await scanner({ authProfile, regions: serviceRegions, accountId });
    scanResults.services[serviceKey] = {
      ...serviceResult,
      lastSynced: scanResults.syncedAt,
    };
  }

  emit("inventory_saved", {
    source: "fresh",
    inventory: scanResults.inventory,
  });
  emit("scan_data", { scanResults });
  emit("scan_complete", {
    accountId,
    resourceCount: Object.values(scanResults.services)
      .reduce((sum, service) => sum + (service.resources?.length || 0), 0),
    stackCount: scanResults.cloudformation.stacks.length,
  });
  emit("agent_start", {
    message: "Analyzing discovered AWS resources and proposing workload groupings...",
    runtime: "local",
  });

  let workloads = buildDiscoveredWorkloads({
    environmentName: profile.name || permissionProfileId,
    accountId,
    scanResults,
  });
  let llmSummary = "";

  const refined = await refineLocalWorkloadDiscoveryWithOpenAI({
    profile,
    accountId,
    scanResults,
    workloads,
    environmentNotes: body.environmentNotes,
  }).catch((error) => {
    console.warn("[local workload discovery] OpenAI refinement failed", {
      error: error?.message || String(error),
    });
    return null;
  });
  if (refined?.workloads?.length) {
    workloads = refined.workloads;
    llmSummary = refined.summary || "";
  }

  workloads = consolidateDiscoveredWorkloads(workloads, {
    environmentName: profile.name || permissionProfileId,
  });

  emit("discovery_complete", { workloads });
  return {
    scanResults,
    workloads,
    text: buildDiscoveryFinalText({ profile, scanResults, workloads, llmSummary }),
  };
}

function sendSse(res, event, data) {
  if (res.writableEnded || res.destroyed) return;
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data ?? null)}\n\n`);
}

export function createLocalWorkloadDiscoveryRouter({ store }) {
  if (!store) throw new Error("createLocalWorkloadDiscoveryRouter requires a store");
  const router = Router();

  router.post("/ops/workload-discovery/chat", async (req, res) => {
    const body = req.body || {};
    if (!safeTrim(body.permissionProfileId)) {
      return res.status(400).json({
        ok: false,
        error: "permissionProfileId is required",
      });
    }

    let closed = false;
    const heartbeat = setInterval(() => {
      if (closed || res.writableEnded || res.destroyed) return;
      res.write(": ping\n\n");
    }, 15_000);
    req.on("close", () => {
      closed = true;
      clearInterval(heartbeat);
    });

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
      if (req.body?.sessionId && req.body?.message && !req.body?.services) {
        sendSse(res, "final", {
          text: "Local follow-up chat for workload discovery is not available yet. Edit the workload cards directly or run discovery again.",
          responseId: null,
          structuredUpdateApplied: false,
        });
        sendSse(res, "done", { ok: true });
        res.end();
        return;
      }

      const result = await discoverAwsEnvironment({
        store,
        body,
        emit: (event, data) => sendSse(res, event, data),
      });
      sendSse(res, "final", {
        text: result.text,
        discovery: {
          workloads: result.workloads,
        },
        responseId: null,
        structuredUpdateApplied: true,
      });
      sendSse(res, "done", { ok: true });
      res.end();
    } catch (error) {
      const message = error?.message || "Local workload discovery failed";
      sendSse(res, "error", { error: message });
      sendSse(res, "done", { ok: false, error: message });
      res.end();
    } finally {
      closed = true;
      clearInterval(heartbeat);
    }
  });

  return router;
}
