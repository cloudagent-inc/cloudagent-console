import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { tool } from "@openai/agents";
import { z } from "zod";
import { createCloudAgentCache } from "@cloudagent/cloudagent-tools/util/cache";
import { createListPermissionProfilesTool } from "@cloudagent/cloudagent-tools/tools/tool_permission_profile_list";
import { createGetPermissionProfileTool } from "@cloudagent/cloudagent-tools/tools/tool_permission_profile_get";
import { createListWorkloadsTool } from "@cloudagent/cloudagent-tools/tools/tool_workload_list";
import { createGetWorkloadTool } from "@cloudagent/cloudagent-tools/tools/tool_workload_get";
import { createUpdateWorkloadTool } from "@cloudagent/cloudagent-tools/tools/tool_workload_update";
import { createAwsCliReadOnlyTool } from "@cloudagent/cloudagent-tools/tools/tool_aws_cli_readonly";
import { createArchitectureTemplatesTool } from "@cloudagent/cloudagent-tools/tools/tool_architecture_get_templates";
import { createGetDeploymentPreferencesSummaryTool } from "@cloudagent/cloudagent-tools/tools/tool_deployment_get_preferences_summary";
import { createSessionContextUpdateTool } from "@cloudagent/cloudagent-tools/tools/tool_session_context_update";
import { createDiagramSpecTool } from "@cloudagent/cloudagent-tools/tools/tool_diagram_spec";
import architectureReferences from "@cloudagent/cloudagent/architecture-references";
import { parseStoredJsonValue, parseStoredObject } from "@cloudagent/storage";

const { templates: TEMPLATES } = architectureReferences;
const READ_ONLY_AWS_OPERATIONS = new Set(["describe", "list", "get", "head", "query", "scan"]);
const MAX_AWS_CLI_OUTPUT_CHARS = Number(process.env.LOCAL_AWS_CLI_MAX_OUTPUT_CHARS || 120_000);
const AWS_CLI_TIMEOUT_MS = Number(process.env.LOCAL_AWS_CLI_TIMEOUT_MS || 30_000);
const LOCAL_COMMAND_TIMEOUT_MS = Number(process.env.LOCAL_AGENT_COMMAND_TIMEOUT_MS || 5 * 60 * 1000);
const LOCAL_AWS_CLI_DEBUG_ENABLED = String(process.env.CLOUDAGENT_LOCAL_AWS_CLI_DEBUG ?? "true").toLowerCase() !== "false";
const MAX_DEBUG_COMMAND_CHARS = 500;

function safeTrim(value) {
  return value == null ? "" : String(value).trim();
}

function localAwsCliDebug(event, details = {}) {
  if (!LOCAL_AWS_CLI_DEBUG_ENABLED) return;
  console.log(`[local AWS CLI] ${event}`, details);
}

function summarizeAwsCliArgs(args = []) {
  const text = args.map((arg) => String(arg || "")).join(" ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > MAX_DEBUG_COMMAND_CHARS
    ? `${text.slice(0, MAX_DEBUG_COMMAND_CHARS)}... [${text.length} chars]`
    : text;
}

function normalizeType(value) {
  return safeTrim(value).toLowerCase().replace(/_/g, " ");
}

function resolveAccountId(authProfile = {}) {
  return (
    authProfile?.awsAccountId ||
    authProfile?.aws_account_id ||
    authProfile?.accountId ||
    authProfile?.subscriptionId ||
    authProfile?.tenantId ||
    null
  );
}

function profileToAccount(profile = {}, userId = "local-user") {
  const authProfile = {
    name: profile?.name || null,
    permissionProfileId: profile?.recordId || profile?.id || profile?.permissionProfileId || null,
    recordId: profile?.recordId || null,
    ...parseStoredObject(profile?.authProfile, {}),
  };
  return {
    permissionProfileId: profile?.recordId || profile?.id || profile?.permissionProfileId || null,
    accountId: resolveAccountId(authProfile),
    alias: profile?.name || null,
    recordId: profile?.recordId || null,
    type: profile?.type || null,
    createdAt: profile?.createdAt || null,
    updatedAt: profile?.updatedAt || null,
    authProfile,
    summary: profile?.summary || null,
    accountDefaults: {
      securityRules: parseStoredObject(profile?.securityRules, {}),
      deploymentPreferences: parseStoredObject(profile?.deploymentPreferences, {}),
    },
    isShared: false,
    ownerUserId: profile?.userId || userId,
    sharedViaTeamIds: [],
    sharedPermissions: [],
  };
}

function samePermissionProfileId(profile = {}, permissionProfileId = "") {
  const target = safeTrim(permissionProfileId);
  if (!target) return false;
  return (
    safeTrim(profile?.recordId) === target ||
    safeTrim(profile?.id) === target ||
    safeTrim(profile?.permissionProfileId) === target
  );
}

function parseJsonMaybe(value, fallback = null) {
  return parseStoredJsonValue(value, fallback);
}

function normalizeGitRepo(raw = {}) {
  if (!raw || typeof raw !== "object") return null;
  const owner = safeTrim(raw.owner);
  const repo = safeTrim(raw.repo);
  const fullName = safeTrim(raw.fullName || (owner && repo ? `${owner}/${repo}` : ""));
  const [derivedOwner, derivedRepo] = fullName.includes("/") ? fullName.split("/", 2) : [owner, repo];
  const localPath = safeTrim(raw.localPath || raw.repoPath || raw.path || raw.checkoutPath);
  return {
    connectionId: safeTrim(raw.connectionId) || null,
    owner: owner || derivedOwner || null,
    repo: repo || derivedRepo || null,
    fullName: fullName || null,
    branch: safeTrim(raw.branch || raw.defaultBranch || raw.baseBranch) || null,
    localPath: localPath || null,
  };
}

async function pathExists(value) {
  if (!value) return false;
  try {
    await fs.access(value);
    return true;
  } catch {
    return false;
  }
}

async function resolveLocalRepoPath({ localPath = null, repoPath = null, owner = null, repo = null, repoFullName = null } = {}) {
  const direct = safeTrim(localPath || repoPath);
  if (direct) return path.resolve(direct.replace(/^~(?=$|\/)/, process.env.HOME || ""));
  const fullName = safeTrim(repoFullName || (owner && repo ? `${owner}/${repo}` : ""));
  const reposRoot = safeTrim(process.env.CLOUDAGENT_LOCAL_REPOS_DIR || process.env.CLOUDAGENT_REPOS_DIR);
  if (!reposRoot || !fullName) return null;
  return path.resolve(reposRoot.replace(/^~(?=$|\/)/, process.env.HOME || ""), fullName);
}

function safeRepoRelativePath(value = "") {
  const normalized = String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || path.isAbsolute(normalized)) {
    throw new Error("Invalid repository-relative path.");
  }
  return normalized;
}

function runCommand(command, args = [], { cwd = null, env = process.env, input = null, timeoutMs = LOCAL_COMMAND_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: cwd || undefined,
      env,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout?.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr?.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ statusCode: 400, stdout: "", stderr: error?.message || String(error), timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        statusCode: code === 0 && !timedOut ? 200 : 400,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: timedOut ? `${command} timed out after ${timeoutMs}ms.` : Buffer.concat(stderr).toString("utf8"),
        timedOut,
      });
    });
    if (input != null) child.stdin.end(String(input));
    else child.stdin.end();
  });
}

function countItems(raw) {
  const parsed = parseJsonMaybe(raw, raw);
  if (Array.isArray(parsed)) return parsed.length;
  return parsed ? 1 : 0;
}

function extractRunSummary(logValue) {
  const parsedLog = parseJsonMaybe(logValue, null);
  if (!parsedLog || typeof parsedLog !== "object") return null;
  const runSummary = parsedLog.runSummary;
  if (typeof runSummary === "string" && runSummary.trim()) return runSummary.trim();
  if (runSummary && typeof runSummary === "object") {
    return (
      runSummary.finalTaskSummary ||
      runSummary.summary ||
      runSummary.text ||
      runSummary.finalSummary ||
      ""
    ).trim() || null;
  }
  const logs = Array.isArray(parsedLog.logs) ? parsedLog.logs : [];
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const entry = logs[index];
    const status = String(entry?.status || "").toLowerCase();
    if (!["complete", "completed", "success"].includes(status)) continue;
    const output = typeof entry?.task_output === "string"
      ? entry.task_output.trim()
      : typeof entry?.output === "string"
        ? entry.output.trim()
        : "";
    if (output) return output;
  }
  return null;
}

function summarizeWorkflowRun(item = {}) {
  const definition = parseJsonMaybe(item.workflowDefinition, {}) || {};
  return {
    userId: item.userId ?? null,
    workflowRunId: item.workflowRunId ?? null,
    workflowId: item.workflowId ?? definition.workflowId ?? null,
    workflowStatus: item.workflowStatus ?? null,
    updatedAt: item.updatedAt ?? null,
    createdAt: item.createdAt ?? null,
    startedAt: item.startedAt ?? null,
    completedAt: item.completedAt ?? null,
    title: item.title ?? definition.title ?? definition.workflowName ?? null,
    workflowName: item.workflowName ?? definition.workflowName ?? definition.title ?? null,
    workflowType: item.workflowType ?? definition.workflowType ?? null,
    lastMessage: item.lastMessage ?? null,
    statusMessage: item.statusMessage ?? null,
    currentExecutionCount: countItems(item.currentExecutions),
    executionHistoryCount: countItems(item.executionHistory),
    isShared: false,
    ownerUserId: item.userId ?? "local-user",
    sharedViaTeamIds: [],
  };
}

function summarizeAuthProfile(raw) {
  const authProfile = parseJsonMaybe(raw, null);
  if (!authProfile || typeof authProfile !== "object") return null;
  return {
    recordId: authProfile.recordId ?? null,
    permissionProfileId: authProfile.permissionProfileId ?? authProfile.profileId ?? null,
    name: authProfile.name ?? authProfile.authProfileName ?? null,
    awsAccountId: authProfile.awsAccountId ?? authProfile.accountId ?? null,
    provider: authProfile.provider ?? null,
    workloadId: authProfile.workloadId ?? null,
  };
}

function summarizeAgentHistoryItem(item = {}) {
  return {
    userId: item.userId ?? null,
    recordId: item.recordId ?? null,
    itemId: item.itemId ?? null,
    title: item.title ?? item.itemId ?? null,
    agentType: item.agentType ?? null,
    status: item.status ?? null,
    purchaseDate: item.purchaseDate ?? null,
    updatedAt: item.updatedAt ?? item.purchaseDate ?? null,
    parentId: item.parentId ?? null,
    cliSessionId: item.cliSessionId ?? item.threadId ?? null,
    scanId: item.scanId ?? null,
    authProfile: summarizeAuthProfile(item.authProfile),
    runSummary: extractRunSummary(item.log),
    hasLog: Boolean(item.log),
    hasUpdatedBlueprint: Boolean(item.updatedBlueprint),
    isShared: false,
    ownerUserId: item.userId ?? "local-user",
    sharedViaTeamIds: [],
  };
}

function normalizeDescription(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.filter(Boolean).join(" ");
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const parsed = parseJsonMaybe(trimmed, null);
    if (Array.isArray(parsed)) return parsed.filter(Boolean).join(" ");
    return trimmed;
  }
  return String(value);
}

function normalizeBlueprintSummary(item = {}) {
  return {
    source: "custom",
    id: item.recordId || null,
    title: item.title || "",
    description: normalizeDescription(item.description),
    type: "agent",
    status: item.status || null,
    updatedAt: item.updatedAt || null,
    isShared: false,
    ownerUserId: item.userId || "local-user",
    sharedViaTeamIds: [],
  };
}

function paginate(items = [], { limit, cursor } = {}) {
  const pageSize = Math.max(1, Math.min(200, Number(limit) || 50));
  const start = Math.max(0, Number(cursor) || 0);
  const pageItems = items.slice(start, start + pageSize);
  const next = start + pageItems.length < items.length ? String(start + pageItems.length) : null;
  return { items: pageItems, nextCursor: next };
}

function createLocalAccountsService({ store, cache, selectedAuthProfile = null }) {
  const selectedAuth = selectedAuthProfile && typeof selectedAuthProfile === "object"
    ? selectedAuthProfile
    : null;
  const selectedPermissionProfileId = safeTrim(
    selectedAuth?.permissionProfileId ||
    selectedAuth?.recordId ||
    selectedAuth?.id ||
    selectedAuth?.profileId
  );
  const selectedAccountId = safeTrim(resolveAccountId(selectedAuth || {}));

  function selectedAccountFallback(userId) {
    if (!selectedAuth) return null;
    return {
      permissionProfileId: selectedPermissionProfileId || null,
      accountId: selectedAccountId || null,
      alias: selectedAuth.name || selectedAuth.authProfileName || "Selected local environment",
      recordId: selectedAuth.recordId || selectedPermissionProfileId || null,
      type: selectedAuth.provider === "aws" ? "aws account" : selectedAuth.provider || "aws account",
      authProfile: selectedAuth,
      accountDefaults: {
        securityRules: {},
        deploymentPreferences: {},
      },
      isShared: false,
      ownerUserId: userId,
      sharedViaTeamIds: [],
      sharedPermissions: [],
    };
  }

  async function fetchPermissionProfiles(userId) {
    const profiles = await store.listPermissionProfiles();
    return profiles.filter((profile) => {
      const type = normalizeType(profile?.type);
      return type !== "jira" && type !== "github";
    }).map((profile) => ({ ...profile, userId: profile?.userId || userId }));
  }

  async function loadAccountsForUser({ userId = "local-user", forceRefresh = false } = {}) {
    const cacheKey = `${userId}:local`;
    if (!forceRefresh) {
      const cached = cache.getAccounts(cacheKey);
      if (cached) return { ...cached, source: "local-cache" };
    }
    const profiles = await fetchPermissionProfiles(userId);
    const accounts = profiles.map((profile) => profileToAccount(profile, userId));
    const payload = { userId, accounts };
    cache.setAccounts(cacheKey, payload);
    return { ...payload, source: "local-files" };
  }

  async function getPermissionProfile(userId, permissionProfileId) {
    const payload = await loadAccountsForUser({ userId, forceRefresh: false });
    const found = payload.accounts.find((account) =>
      samePermissionProfileId(account, permissionProfileId)
    ) || null;
    if (found) return found;
    if (selectedPermissionProfileId && selectedPermissionProfileId === safeTrim(permissionProfileId)) {
      return selectedAccountFallback(userId);
    }
    return null;
  }

  async function getPermissionProfileDefaults(userId, permissionProfileId) {
    const found = await getPermissionProfile(userId, permissionProfileId);
    if (!found && selectedAuth && !safeTrim(permissionProfileId)) {
      return {
        authProfile: selectedAuth,
        securityRules: {},
        deploymentPreferences: {},
      };
    }
    return {
      authProfile: found?.authProfile || null,
      securityRules: found?.accountDefaults?.securityRules || {},
      deploymentPreferences: found?.accountDefaults?.deploymentPreferences || {},
    };
  }

  async function getAccountDefaults(userId, accountId) {
    const target = safeTrim(accountId);
    if (!target) {
      return selectedAuth
        ? { authProfile: selectedAuth, securityRules: {}, deploymentPreferences: {} }
        : { authProfile: null, securityRules: {}, deploymentPreferences: {} };
    }
    const payload = await loadAccountsForUser({ userId, forceRefresh: false });
    const found = payload.accounts.find((account) => safeTrim(account?.accountId) === target) || null;
    if (!found && selectedAuth && (!target || selectedAccountId === target)) {
      return {
        authProfile: selectedAuth,
        securityRules: {},
        deploymentPreferences: {},
      };
    }
    return {
      authProfile: found?.authProfile || null,
      securityRules: found?.accountDefaults?.securityRules || {},
      deploymentPreferences: found?.accountDefaults?.deploymentPreferences || {},
    };
  }

  return {
    fetchPermissionProfiles,
    loadAccountsForUser,
    getPermissionProfile,
    getPermissionProfileDefaults,
    getAccountDefaults,
  };
}

function createLocalWorkloadsService({ store }) {
  async function listWorkloadsByUser(_userId, limit = 100) {
    const workloads = await store.listWorkloads();
    return workloads.slice(0, Math.max(1, Number(limit) || 100));
  }

  async function getWorkload(_userId, workloadId) {
    return store.getWorkload(workloadId);
  }

  async function putWorkload(finalItem) {
    const existing = finalItem?.workloadId ? await store.getWorkload(finalItem.workloadId) : null;
    return existing
      ? store.updateWorkload(finalItem.workloadId, finalItem)
      : store.createWorkload(finalItem);
  }

  async function updateWorkloadPartial({ workloadId, finalItem }) {
    const existing = await store.getWorkload(workloadId);
    if (!existing) return null;
    return store.updateWorkload(workloadId, finalItem);
  }

  async function getWorkloadDefaults(_userId, workloadId) {
    const workload = await store.getWorkload(workloadId);
    if (!workload) {
      return {
        deploymentPreferences: {},
        securityRules: {},
        trackedResources: { resources: [], stacks: [] },
        workload: null,
        foundIn: "none",
      };
    }
    return {
      deploymentPreferences: parseStoredObject(workload.deploymentPreferences, {}),
      securityRules: parseStoredObject(workload.securityRules, {}),
      trackedResources: parseStoredObject(workload.trackedResources, { resources: [], stacks: [] }),
      workload,
      foundIn: "local-files",
    };
  }

  return {
    listWorkloadsByUser,
    getWorkload,
    putWorkload,
    updateWorkloadPartial,
    getWorkloadDefaults,
  };
}

function createListLocalWorkflowDefsTool({ store }) {
  return tool({
    name: "list_workflow_defs",
    description: "List local workflow definitions saved in desktop local mode.",
    parameters: z.object({
      limit: z.number().int().min(1).max(200).nullable().optional(),
      cursor: z.string().nullable().optional(),
    }).strict(),
    async execute({ limit, cursor }) {
      const all = await store.listWorkflowDefinitions();
      const { items, nextCursor } = paginate(all, { limit, cursor });
      return { ok: true, count: items.length, items, nextCursor };
    },
  });
}

function createListLocalWorkflowRunsTool({ store }) {
  return tool({
    name: "list_workflow_runs",
    description: "List local workflow run history saved in desktop local mode. Returns summary fields only.",
    parameters: z.object({
      limit: z.number().int().min(1).max(200).nullable().optional(),
      cursor: z.string().nullable().optional(),
      workflowId: z.string().nullable().optional(),
    }).strict(),
    async execute({ limit, cursor, workflowId }) {
      const all = (await store.listWorkflowRuns()).filter((item) => {
        if (!workflowId) return true;
        if (item?.workflowId === workflowId) return true;
        const definition = parseJsonMaybe(item?.workflowDefinition, {});
        return definition?.workflowId === workflowId || definition?.id === workflowId;
      });
      const { items, nextCursor } = paginate(all.map(summarizeWorkflowRun), { limit, cursor });
      return { ok: true, count: items.length, items, nextCursor };
    },
  });
}

function createGetLocalWorkflowRunTool({ store }) {
  return tool({
    name: "get_workflow_run",
    description: "Fetch a specific local workflow run by workflowRunId with full details.",
    parameters: z.object({ workflowRunId: z.string().min(1) }).strict(),
    async execute({ workflowRunId }) {
      const item = await store.getWorkflowRun(workflowRunId);
      if (!item) return { ok: false, workflowRunId, error: "Workflow run not found" };
      return { ok: true, workflowRunId, item };
    },
  });
}

function createListLocalBlueprintsTool({ store }) {
  return tool({
    name: "list_blueprints",
    description: "List local custom blueprints saved in desktop local mode.",
    parameters: z.object({
      scope: z.enum(["all", "custom", "library"]).nullable().optional(),
      type: z.enum(["agent", "report", "all"]).nullable().optional(),
      limit: z.number().int().min(1).max(200).nullable().optional(),
      cursor: z.string().nullable().optional(),
    }).strict(),
    async execute({ scope, type, limit, cursor }) {
      const includeCustom = !scope || scope === "all" || scope === "custom";
      const requestedType = type || "all";
      const customItems = includeCustom && (requestedType === "all" || requestedType === "agent")
        ? (await store.listBlueprints()).map(normalizeBlueprintSummary).filter((item) => item.id)
        : [];
      const { items, nextCursor } = paginate(customItems, { limit, cursor });
      return {
        ok: true,
        blueprints: items,
        summary: {
          total: customItems.length,
          custom: customItems.length,
          library: 0,
          agents: customItems.length,
          reports: 0,
        },
        nextCursor,
      };
    },
  });
}

function createListLocalAgentHistoryTool({ store }) {
  return tool({
    name: "list_agent_history",
    description: "List local agent run history saved in desktop local mode. Returns summary fields only.",
    parameters: z.object({
      limit: z.number().int().min(1).max(200).nullable().optional(),
      cursor: z.string().nullable().optional(),
      agentType: z.string().nullable().optional(),
      includeReports: z.boolean().nullable().optional(),
    }).strict(),
    async execute({ limit, cursor, agentType, includeReports }) {
      const excluded = new Set(["report", "assessment"]);
      const all = (await store.listAgentHistory()).filter((item) => {
        if (agentType && item?.agentType !== agentType) return false;
        if (includeReports !== true && excluded.has(String(item?.agentType || "").toLowerCase())) return false;
        return true;
      });
      const { items, nextCursor } = paginate(all.map(summarizeAgentHistoryItem), { limit, cursor });
      return { ok: true, count: items.length, items, nextCursor };
    },
  });
}

function createGetLocalAgentRunTool({ store }) {
  return tool({
    name: "get_agent_run",
    description: "Fetch a specific local agent run by recordId with full details.",
    parameters: z.object({ recordId: z.string().min(1) }).strict(),
    async execute({ recordId }) {
      const item = await store.getAgentHistoryRecord(recordId);
      if (!item) return { ok: false, recordId, error: "Agent run not found" };
      return { ok: true, recordId, item };
    },
  });
}

function splitCommand(command = "") {
  const args = [];
  let current = "";
  let quote = null;
  let escaping = false;

  for (const ch of String(command)) {
    if (escaping) {
      current += ch;
      escaping = false;
      continue;
    }
    if (ch === "\\") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === "'" || ch === "\"") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (quote) throw new Error("Unclosed quote in AWS CLI command.");
  if (escaping) current += "\\";
  if (current) args.push(current);
  return args;
}

function assertReadOnlyAwsCommand(args = []) {
  if (args[0] !== "aws") {
    throw new Error("AWS CLI command must start with `aws`.");
  }
  if (args.includes("--profile")) {
    throw new Error("Do not pass --profile. CloudAgent uses the selected local environment credentials.");
  }
  const service = safeTrim(args[1]);
  const operation = safeTrim(args[2]);
  if (!service || !operation) {
    throw new Error("AWS CLI command must include a service and operation, for example `aws ec2 describe-instances`.");
  }
  const verb = operation.split("-")[0].toLowerCase();
  if (!READ_ONLY_AWS_OPERATIONS.has(verb)) {
    throw new Error(`Only read-only AWS CLI operations are allowed in local mode. Rejected operation: ${operation}`);
  }
}

function buildAwsCliEnv(authProfile = {}) {
  const env = { ...process.env };
  const profile = safeTrim(authProfile.awsProfile || authProfile.profileName || authProfile.profile);
  const accessKeyId = safeTrim(authProfile.accessKeyId);
  const secretAccessKey = safeTrim(authProfile.secretAccessKey);
  const sessionToken = safeTrim(authProfile.sessionToken || authProfile.refreshKey);
  const region = safeTrim(authProfile.region || authProfile.defaultRegion);

  delete env.AWS_ACCESS_KEY_ID;
  delete env.AWS_SECRET_ACCESS_KEY;
  delete env.AWS_SESSION_TOKEN;
  delete env.AWS_PROFILE;

  if (accessKeyId && secretAccessKey) {
    env.AWS_ACCESS_KEY_ID = accessKeyId;
    env.AWS_SECRET_ACCESS_KEY = secretAccessKey;
    if (sessionToken) env.AWS_SESSION_TOKEN = sessionToken;
  } else if (profile) {
    env.AWS_PROFILE = profile;
  } else {
    throw new Error("Selected local AWS environment is missing an AWS profile or access keys.");
  }
  if (region) env.AWS_REGION = region;
  if (region) env.AWS_DEFAULT_REGION = region;
  return env;
}

export async function executeLocalAwsCliCommand({ command, accountId, authProfile }) {
  const args = splitCommand(command);
  assertReadOnlyAwsCommand(args);
  const [, ...spawnArgs] = args;
  const env = buildAwsCliEnv(authProfile || {});
  const startedAt = Date.now();
  const resolvedAccountId = accountId || authProfile?.awsAccountId || authProfile?.accountId || null;
  localAwsCliDebug("execute_start", {
    accountId: resolvedAccountId,
    command: summarizeAwsCliArgs(args),
    timeoutMs: AWS_CLI_TIMEOUT_MS,
    outputLimitChars: MAX_AWS_CLI_OUTPUT_CHARS,
    authMode: env.AWS_PROFILE ? "profile" : "static-credentials",
    region: env.AWS_REGION || env.AWS_DEFAULT_REGION || null,
  });

  return new Promise((resolve) => {
    const child = spawn("aws", spawnArgs, {
      env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, AWS_CLI_TIMEOUT_MS);

    child.stdout?.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr?.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => {
      clearTimeout(timer);
      localAwsCliDebug("execute_error", {
        accountId: resolvedAccountId,
        command: summarizeAwsCliArgs(args),
        durationMs: Date.now() - startedAt,
        error: error?.code === "ENOENT"
          ? "AWS CLI is not installed or not available on PATH."
          : error?.message || String(error),
      });
      resolve({
        statusCode: 400,
        output: {
          stdout: "",
          stderr: error?.code === "ENOENT"
            ? "AWS CLI is not installed or not available on PATH."
            : error?.message || String(error),
        },
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const out = Buffer.concat(stdout).toString("utf8");
      const err = Buffer.concat(stderr).toString("utf8");
      const stdoutTruncated = out.length > MAX_AWS_CLI_OUTPUT_CHARS;
      const stderrTruncated = err.length > MAX_AWS_CLI_OUTPUT_CHARS;
      const clippedStdout = out.length > MAX_AWS_CLI_OUTPUT_CHARS
        ? `${out.slice(0, MAX_AWS_CLI_OUTPUT_CHARS)}\n[truncated]`
        : out;
      const clippedStderr = err.length > MAX_AWS_CLI_OUTPUT_CHARS
        ? `${err.slice(0, MAX_AWS_CLI_OUTPUT_CHARS)}\n[truncated]`
        : err;
      localAwsCliDebug("execute_end", {
        accountId: resolvedAccountId,
        command: summarizeAwsCliArgs(args),
        statusCode: code === 0 && !timedOut ? 200 : 400,
        exitCode: code,
        timedOut,
        stdoutChars: out.length,
        stderrChars: err.length,
        stdoutTruncated,
        stderrTruncated,
        durationMs: Date.now() - startedAt,
      });
      resolve({
        statusCode: code === 0 && !timedOut ? 200 : 400,
        output: {
          stdout: clippedStdout,
          stderr: timedOut ? `AWS CLI command timed out after ${AWS_CLI_TIMEOUT_MS}ms.` : clippedStderr,
        },
        accountId: resolvedAccountId,
        timedOut,
        stdoutTruncated,
        stderrTruncated,
        stdoutChars: out.length,
        stderrChars: err.length,
      });
    });
  });
}

async function executeAwsCliArgs({ args = [], authProfile = {}, timeoutMs = AWS_CLI_TIMEOUT_MS } = {}) {
  const env = buildAwsCliEnv(authProfile || {});
  const startedAt = Date.now();
  localAwsCliDebug("execute_args_start", {
    command: summarizeAwsCliArgs(["aws", ...args]),
    timeoutMs,
    outputLimitChars: MAX_AWS_CLI_OUTPUT_CHARS,
    authMode: env.AWS_PROFILE ? "profile" : "static-credentials",
    region: env.AWS_REGION || env.AWS_DEFAULT_REGION || null,
  });
  const result = await runCommand("aws", args, { env, timeoutMs });
  const stdoutTruncated = result.stdout.length > MAX_AWS_CLI_OUTPUT_CHARS;
  const stderrTruncated = result.stderr.length > MAX_AWS_CLI_OUTPUT_CHARS;
  localAwsCliDebug("execute_args_end", {
    command: summarizeAwsCliArgs(["aws", ...args]),
    statusCode: result.statusCode,
    timedOut: result.timedOut,
    stdoutChars: result.stdout.length,
    stderrChars: result.stderr.length,
    stdoutTruncated,
    stderrTruncated,
    durationMs: Date.now() - startedAt,
  });
  return {
    statusCode: result.statusCode,
    output: {
      stdout: result.stdout.length > MAX_AWS_CLI_OUTPUT_CHARS
        ? `${result.stdout.slice(0, MAX_AWS_CLI_OUTPUT_CHARS)}\n[truncated]`
        : result.stdout,
      stderr: result.stderr.length > MAX_AWS_CLI_OUTPUT_CHARS
        ? `${result.stderr.slice(0, MAX_AWS_CLI_OUTPUT_CHARS)}\n[truncated]`
        : result.stderr,
    },
    timedOut: result.timedOut,
    stdoutTruncated,
    stderrTruncated,
    stdoutChars: result.stdout.length,
    stderrChars: result.stderr.length,
  };
}

function createAwsCfnOperationsTool({ accountsService }) {
  return tool({
    name: "aws_cfn_operations",
    description:
      "Create or update a CloudFormation stack in a selected local AWS environment using aws cloudformation deploy.",
    parameters: z.object({
      operation: z.enum(["create", "update", "deploy"]).nullable().optional(),
      accountId: z.string().nullable().optional(),
      permissionProfileId: z.string().nullable().optional(),
      region: z.string().min(1),
      stackName: z.string().min(1),
      templateBody: z.string().min(1).describe("Full CloudFormation template as YAML or JSON."),
      workloadId: z.string().nullable().optional(),
      parameters: z.array(z.object({
        ParameterKey: z.string(),
        ParameterValue: z.string(),
      }).strict()).nullable().optional(),
      capabilities: z.array(z.string()).nullable().optional(),
    }).strict(),
    async execute({ operation, accountId, permissionProfileId, region, stackName, templateBody, parameters, capabilities }, runContext) {
      const userId = runContext?.context?.userId || "local-user";
      const defaults = permissionProfileId
        ? await accountsService.getPermissionProfileDefaults(userId, permissionProfileId)
        : await accountsService.getAccountDefaults(userId, accountId);
      const authProfile = defaults?.authProfile || {};
      const resolvedAccountId = accountId || authProfile.awsAccountId || authProfile.accountId || null;
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cloudagent-cfn-"));
      const templatePath = path.join(tempDir, "template.yaml");
      await fs.writeFile(templatePath, String(templateBody || ""));
      const deployArgs = [
        "cloudformation",
        "deploy",
        "--region",
        region,
        "--stack-name",
        stackName,
        "--template-file",
        templatePath,
        "--no-fail-on-empty-changeset",
      ];
      const effectiveCapabilities = Array.isArray(capabilities) && capabilities.length
        ? capabilities.map((item) => safeTrim(item)).filter(Boolean)
        : ["CAPABILITY_IAM", "CAPABILITY_NAMED_IAM", "CAPABILITY_AUTO_EXPAND"];
      if (effectiveCapabilities.length) deployArgs.push("--capabilities", ...effectiveCapabilities);
      if (Array.isArray(parameters) && parameters.length > 0) {
        deployArgs.push(
          "--parameter-overrides",
          ...parameters
            .filter((item) => item?.ParameterKey)
            .map((item) => `${item.ParameterKey}=${item.ParameterValue ?? ""}`)
        );
      }
      const result = await executeAwsCliArgs({ args: deployArgs, authProfile, timeoutMs: Number(process.env.LOCAL_AWS_CFN_TIMEOUT_MS || 30 * 60 * 1000) });
      const out = {
        ok: result.statusCode === 200,
        operation: operation || "deploy",
        accountId: resolvedAccountId,
        permissionProfileId: permissionProfileId || authProfile.permissionProfileId || authProfile.recordId || authProfile.id || null,
        region,
        stackName,
        statusCode: result.statusCode,
        stdout: result.output.stdout,
        stderr: result.output.stderr,
      };
      runContext?.context?.recordContextEvent?.({
        type: "cloudformation_operation",
        sourceTool: "aws_cfn_operations",
        timestamp: new Date().toISOString(),
        ...out,
        status: out.ok ? "DEPLOY_COMPLETE" : "DEPLOY_FAILED",
        message: out.ok ? result.output.stdout : result.output.stderr,
      });
      return out;
    },
  });
}

function createListGithubReposTool({ store }) {
  return tool({
    name: "list_github_repos",
    description: "List GitHub repositories configured in local CloudAgent workload or environment deployment preferences.",
    parameters: z.object({ connectionId: z.string().nullable().optional() }).strict(),
    async execute({ connectionId }) {
      const repos = [];
      const addRepo = async (raw, source = {}) => {
        const repo = normalizeGitRepo(raw);
        if (!repo?.fullName) return;
        if (connectionId && repo.connectionId !== connectionId) return;
        const localPath = repo.localPath || await resolveLocalRepoPath(repo);
        repos.push({
          ...repo,
          localPath,
          localPathExists: await pathExists(localPath),
          ...source,
        });
      };
      const profiles = await store.listPermissionProfiles?.().catch(() => []) || [];
      for (const profile of profiles) {
        const deploymentPreferences = parseStoredObject(profile?.deploymentPreferences, {});
        await addRepo(deploymentPreferences.gitRepo, { source: "permission_profile", permissionProfileId: profile?.recordId || null });
      }
      const workloads = await store.listWorkloads?.().catch(() => []) || [];
      for (const workload of workloads) {
        const deploymentPreferences = parseStoredObject(workload?.deploymentPreferences, {});
        await addRepo(deploymentPreferences.gitRepo, { source: "workload", workloadId: workload?.workloadId || null });
      }
      const unique = Array.from(new Map(repos.map((repo) => [`${repo.connectionId || ""}:${repo.fullName}`, repo])).values());
      return { ok: true, count: unique.length, repositories: unique };
    },
  });
}

function createReadGithubFileTool() {
  return tool({
    name: "read_github_file",
    description: "Read a file or directory from a local Git repository checkout.",
    parameters: z.object({
      localPath: z.string().nullable().optional(),
      repoPath: z.string().nullable().optional(),
      owner: z.string().nullable().optional(),
      repo: z.string().nullable().optional(),
      repoFullName: z.string().nullable().optional(),
      path: z.string().min(1),
      ref: z.string().nullable().optional(),
    }).strict(),
    async execute(args) {
      const repoPath = await resolveLocalRepoPath(args);
      if (!repoPath) return { ok: false, error: "localPath/repoPath is required, or set CLOUDAGENT_LOCAL_REPOS_DIR with owner/repo." };
      const relativePath = safeRepoRelativePath(args.path);
      if (args.ref) {
        const result = await runCommand("git", ["show", `${args.ref}:${relativePath}`], { cwd: repoPath });
        return { ok: result.statusCode === 200, path: relativePath, ref: args.ref, content: result.stdout, error: result.stderr || null };
      }
      const target = path.join(repoPath, relativePath);
      const stat = await fs.stat(target);
      if (stat.isDirectory()) {
        const entries = await fs.readdir(target, { withFileTypes: true });
        return { ok: true, path: relativePath, type: "dir", entries: entries.map((entry) => ({ name: entry.name, type: entry.isDirectory() ? "dir" : "file" })) };
      }
      return { ok: true, path: relativePath, type: "file", content: await fs.readFile(target, "utf8") };
    },
  });
}

function createGithubBranchTool() {
  return tool({
    name: "create_github_branch",
    description: "Create or reset a branch in a local Git repository checkout from a base branch/ref.",
    parameters: z.object({
      localPath: z.string().nullable().optional(),
      repoPath: z.string().nullable().optional(),
      owner: z.string().nullable().optional(),
      repo: z.string().nullable().optional(),
      repoFullName: z.string().nullable().optional(),
      base: z.string().min(1),
      branch: z.string().min(1),
    }).strict(),
    async execute(args) {
      const repoPath = await resolveLocalRepoPath(args);
      if (!repoPath) return { ok: false, error: "localPath/repoPath is required, or set CLOUDAGENT_LOCAL_REPOS_DIR with owner/repo." };
      const result = await runCommand("git", ["checkout", "-B", args.branch, args.base], { cwd: repoPath });
      return { ok: result.statusCode === 200, branch: args.branch, base: args.base, stdout: result.stdout, stderr: result.stderr };
    },
  });
}

function createWriteGithubFileTool() {
  return tool({
    name: "write_github_file",
    description: "Create or update a file in a local Git repository checkout and commit the change.",
    parameters: z.object({
      localPath: z.string().nullable().optional(),
      repoPath: z.string().nullable().optional(),
      owner: z.string().nullable().optional(),
      repo: z.string().nullable().optional(),
      repoFullName: z.string().nullable().optional(),
      path: z.string().min(1),
      content: z.string(),
      message: z.string().min(1),
      branch: z.string().nullable().optional(),
    }).strict(),
    async execute(args) {
      const repoPath = await resolveLocalRepoPath(args);
      if (!repoPath) return { ok: false, error: "localPath/repoPath is required, or set CLOUDAGENT_LOCAL_REPOS_DIR with owner/repo." };
      if (args.branch) {
        const checkout = await runCommand("git", ["checkout", args.branch], { cwd: repoPath });
        if (checkout.statusCode !== 200) return { ok: false, error: checkout.stderr || checkout.stdout };
      }
      const relativePath = safeRepoRelativePath(args.path);
      const target = path.join(repoPath, relativePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, String(args.content ?? ""));
      await runCommand("git", ["add", relativePath], { cwd: repoPath });
      const commit = await runCommand("git", ["commit", "-m", args.message], { cwd: repoPath });
      const changed = commit.statusCode === 200;
      return { ok: changed || /nothing to commit/i.test(commit.stdout + commit.stderr), changed, path: relativePath, stdout: commit.stdout, stderr: commit.stderr };
    },
  });
}

function createGithubPullRequestTool() {
  return tool({
    name: "create_github_pull_request",
    description: "Create a GitHub pull request from a local checkout using the GitHub CLI (`gh`).",
    parameters: z.object({
      localPath: z.string().nullable().optional(),
      repoPath: z.string().nullable().optional(),
      owner: z.string().nullable().optional(),
      repo: z.string().nullable().optional(),
      repoFullName: z.string().nullable().optional(),
      title: z.string().min(1),
      head: z.string().min(1),
      base: z.string().min(1),
      body: z.string().nullable().optional(),
      push: z.boolean().nullable().optional(),
    }).strict(),
    async execute(args) {
      const repoPath = await resolveLocalRepoPath(args);
      if (!repoPath) return { ok: false, error: "localPath/repoPath is required, or set CLOUDAGENT_LOCAL_REPOS_DIR with owner/repo." };
      if (args.push !== false) {
        const push = await runCommand("git", ["push", "-u", "origin", args.head], { cwd: repoPath });
        if (push.statusCode !== 200) return { ok: false, error: push.stderr || push.stdout, pushed: false };
      }
      const ghArgs = ["pr", "create", "--title", args.title, "--head", args.head, "--base", args.base, "--body", args.body || ""];
      const result = await runCommand("gh", ghArgs, { cwd: repoPath });
      return { ok: result.statusCode === 200, pullRequestUrl: safeTrim(result.stdout) || null, stdout: result.stdout, stderr: result.stderr };
    },
  });
}

export function createLocalCloudAgentTools({ store, selectedAuthProfile = null } = {}) {
  if (!store) throw new Error("createLocalCloudAgentTools requires a store");

  const cache = createCloudAgentCache();
  const accountsService = createLocalAccountsService({ store, cache, selectedAuthProfile });
  const workloadsService = createLocalWorkloadsService({ store });

  return {
    cache,
    accountsService,
    workloadsService,
    tools: [
      createListPermissionProfilesTool({ accountsService }),
      createGetPermissionProfileTool({ accountsService }),
      createListWorkloadsTool({ cache, workloadsService }),
      createGetWorkloadTool({ cache, workloadsService }),
      createUpdateWorkloadTool({ cache, workloadsService, accountsService }),
      createAwsCliReadOnlyTool({
        accountsService,
        executeCommand: executeLocalAwsCliCommand,
      }),
      createAwsCfnOperationsTool({ accountsService }),
      createListGithubReposTool({ store }),
      createReadGithubFileTool(),
      createGithubBranchTool(),
      createWriteGithubFileTool(),
      createGithubPullRequestTool(),
      createGetDeploymentPreferencesSummaryTool({ accountsService }),
      createListLocalWorkflowDefsTool({ store }),
      createListLocalWorkflowRunsTool({ store }),
      createGetLocalWorkflowRunTool({ store }),
      createListLocalBlueprintsTool({ store }),
      createListLocalAgentHistoryTool({ store }),
      createGetLocalAgentRunTool({ store }),
      createArchitectureTemplatesTool({ templates: TEMPLATES }),
      createDiagramSpecTool(),
      createSessionContextUpdateTool(),
    ],
  };
}
