import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { tool } from "@openai/agents";
import { z } from "zod";
import { createCloudAgentCache } from "@cloudagent/cloudagent-tools/util/cache";
import { assertOpenAiToolSchemas } from "@cloudagent/cloudagent-tools/util/openai-tool-schema";
import { createListPermissionProfilesTool } from "@cloudagent/cloudagent-tools/tools/tool_permission_profile_list";
import { createGetPermissionProfileTool } from "@cloudagent/cloudagent-tools/tools/tool_permission_profile_get";
import { createListWorkloadsTool } from "@cloudagent/cloudagent-tools/tools/tool_workload_list";
import { createGetWorkloadTool } from "@cloudagent/cloudagent-tools/tools/tool_workload_get";
import { createUpdateWorkloadTool } from "@cloudagent/cloudagent-tools/tools/tool_workload_update";
import { createCliSessionTools } from "@cloudagent/cloudagent-tools/tools/tool_cli_session";
import { getDefaultLocalCliSessionManager } from "@cloudagent/cloudagent-tools/cli-session/local-cli-session-manager";
import { createArchitectureTemplatesTool } from "@cloudagent/cloudagent-tools/tools/tool_architecture_get_templates";
import { createGetDeploymentPreferencesSummaryTool } from "@cloudagent/cloudagent-tools/tools/tool_deployment_get_preferences_summary";
import { createDiagramSpecTool } from "@cloudagent/cloudagent-tools/tools/tool_diagram_spec";
import { createGetArtifactTool, createLaunchArtifactTool, createListArtifactsTool } from "@cloudagent/cloudagent-tools/tools/tool_scanner_artifact_get";
import { createTerraformPlanCheckTool } from "@cloudagent/cloudagent-tools/tools/tool_terraform_plan_check";
import { DEFAULT_GUARDRAIL_CATALOG } from "@cloudagent/cloudagent-tools/services/default-guardrail-catalog";
import { runCloudFormationValidation } from "@cloudagent/cloudagent-tools/services/cloudformation-validation";
import architectureReferences from "@cloudagent/cloudagent/architecture-references";
import { parseStoredJsonValue, parseStoredObject } from "@cloudagent/storage";
import { launchLocalAwsScanner } from "../scanners/scanner-launcher.mjs";
import { safeTrim } from "@cloudagent/platform/utils";
import { getLocalIacToolSettings, getGlobalWorkloadGithubGovernance } from "../settings/settings-service.mjs";
import {
  CO_AUTHOR_TRAILER,
  resolveGithubGovernanceConfig,
  unionProtectedBranches,
  isProtectedBranch,
  hasBranchPrefix,
  suggestPrefixedBranch,
  scanForSecrets,
  evaluatePathScope,
  extractIacRoots,
  guardrailRefusal,
} from "@cloudagent/cloudagent-tools/services/github-governance";

const { templates: TEMPLATES } = architectureReferences;
const READ_ONLY_AWS_OPERATIONS = new Set(["describe", "list", "get", "head", "query", "scan"]);
const MAX_AWS_CLI_OUTPUT_CHARS = Number(process.env.LOCAL_AWS_CLI_MAX_OUTPUT_CHARS || 120_000);
const AWS_CLI_TIMEOUT_MS = Number(process.env.LOCAL_AWS_CLI_TIMEOUT_MS || 30_000);
const LOCAL_COMMAND_TIMEOUT_MS = Number(process.env.LOCAL_AGENT_COMMAND_TIMEOUT_MS || 5 * 60 * 1000);
const LOCAL_AWS_CLI_DEBUG_ENABLED = String(process.env.CLOUDAGENT_LOCAL_AWS_CLI_DEBUG ?? "true").toLowerCase() !== "false";
const MAX_DEBUG_COMMAND_CHARS = 500;

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

export function buildCloudFormationStackConsoleUrl({ region, stackId = null, stackName = null } = {}) {
  const resolvedRegion = safeTrim(region);
  if (!resolvedRegion) return null;
  const base = `https://${resolvedRegion}.console.aws.amazon.com/cloudformation/home?region=${encodeURIComponent(resolvedRegion)}`;
  if (safeTrim(stackId)) {
    return `${base}#/stacks/stackinfo?stackId=${encodeURIComponent(safeTrim(stackId))}`;
  }
  if (safeTrim(stackName)) {
    return `${base}#/stacks?filteringStatus=active&filteringText=${encodeURIComponent(safeTrim(stackName))}&viewNested=true`;
  }
  return null;
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

export function runCommand(command, args = [], { cwd = null, env = process.env, input = null, timeoutMs = LOCAL_COMMAND_TIMEOUT_MS } = {}) {
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
    hasUpdatedSkill: Boolean(item.updatedBlueprint),
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

function normalizeSkillSummary(item = {}) {
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

export function createLocalWorkloadsService({ store }) {
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

  async function findWorkloadForCloudFormationStack(
    _userId,
    { stackName, region = null, accountId = null, permissionProfileId = null } = {}
  ) {
    const targetStackName = safeTrim(stackName);
    if (!targetStackName) return { workload: null, workloadId: null, ambiguous: false, candidates: [] };
    const targetRegion = safeTrim(region);
    const targetAccountId = safeTrim(accountId);
    const targetPermissionProfileId = safeTrim(permissionProfileId);
    const workloads = await store.listWorkloads();
    const candidates = [];
    const stackNameFromId = (value) => {
      const text = safeTrim(value);
      const marker = ":stack/";
      if (text.includes(marker)) return text.split(marker)[1]?.split("/")[0] || text;
      return text.split("/")[0] || text;
    };

    for (const workload of workloads) {
      const deploymentPreferences = parseStoredObject(workload?.deploymentPreferences, {});
      const trackedResources = parseStoredObject(workload?.trackedResources, { resources: [], stacks: [] });
      const stacks = [
        ...(Array.isArray(trackedResources?.stacks) ? trackedResources.stacks : []),
        ...(Array.isArray(deploymentPreferences?.stacks) ? deploymentPreferences.stacks : []),
      ];
      const pipelineStackName = safeTrim(deploymentPreferences?.pipelineConfig?.stackName);
      const matchingStack = stacks.find((stack) => {
        const names = [
          stack?.stackName,
          stack?.name,
          stackNameFromId(stack?.stackId),
          stackNameFromId(stack?.stackArn),
        ].map(safeTrim).filter(Boolean);
        if (!names.includes(targetStackName)) return false;
        const stackRegion = safeTrim(stack?.region);
        const stackAccountId = safeTrim(stack?.accountId || stack?.environmentAccountId);
        if (targetRegion && stackRegion && targetRegion !== stackRegion) return false;
        if (targetAccountId && stackAccountId && targetAccountId !== stackAccountId) return false;
        return true;
      });
      const workloadEnvironments = Array.isArray(workload?.environments)
        ? workload.environments.map(safeTrim).filter(Boolean)
        : [];
      const environmentMatches = !targetPermissionProfileId ||
        workloadEnvironments.length === 0 ||
        workloadEnvironments.includes(targetPermissionProfileId);
      if (environmentMatches && (matchingStack || pipelineStackName === targetStackName)) {
        candidates.push({
          workloadId: workload?.workloadId || null,
          workload,
          matchSource: matchingStack ? "tracked_stack" : "pipeline_stack",
        });
      }
    }

    const unique = Array.from(
      new Map(candidates.filter((candidate) => candidate.workloadId).map((candidate) => [candidate.workloadId, candidate])).values()
    );
    return {
      workload: unique.length === 1 ? unique[0].workload : null,
      workloadId: unique.length === 1 ? unique[0].workloadId : null,
      matchSource: unique.length === 1 ? unique[0].matchSource : null,
      ambiguous: unique.length > 1,
      candidates: unique.map((candidate) => candidate.workloadId),
    };
  }

  return {
    listWorkloadsByUser,
    getWorkload,
    putWorkload,
    updateWorkloadPartial,
    getWorkloadDefaults,
    findWorkloadForCloudFormationStack,
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

function createListLocalSkillsTool({ store }) {
  return tool({
    name: "list_skills",
    description: "List local custom skills saved in desktop local mode.",
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
        ? (await store.listSkills()).map(normalizeSkillSummary).filter((item) => item.id)
        : [];
      const { items, nextCursor } = paginate(customItems, { limit, cursor });
      return {
        ok: true,
        skills: items,
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

export function createAwsCfnOperationsTool({
  accountsService,
  workloadsService,
  getToolSettings = null,
  catalog = DEFAULT_GUARDRAIL_CATALOG,
  validationRunner = runCloudFormationValidation,
  awsCliRunner = executeAwsCliArgs,
}) {
  if (!workloadsService?.getWorkloadDefaults) {
    throw new Error("createAwsCfnOperationsTool requires workloadsService.getWorkloadDefaults");
  }
  return tool({
    name: "aws_cfn_operations",
    description:
      "Validate a CloudFormation template with cfn-lint and every selected workload/environment CloudFormation Guard rule, then create or update the stack only when all selected policies pass. Any policy finding blocks deployment and requires the caller to revise and resubmit the template. Successful direct deployments return stack name, ARN, status, region, and AWS Console URL. When deploymentPreferences.changeSet is true, this tool creates a change set and never updates the stack directly.",
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
    async execute({ operation, accountId, permissionProfileId, region, stackName, templateBody, workloadId, parameters, capabilities }, runContext) {
      const runContextValue = runContext?.context || {};
      const userId = runContextValue.userId || "local-user";
      let effectiveWorkloadId = safeTrim(
        workloadId ||
        runContextValue.workloadId ||
        runContextValue.selectedWorkloadOrStack?.workloadId ||
        runContextValue.executionContext?.workload?.workloadId
      );
      let workloadResolutionSource = workloadId ? "tool_argument" : effectiveWorkloadId ? "run_context" : "none";
      const defaults = permissionProfileId
        ? await accountsService.getPermissionProfileDefaults(userId, permissionProfileId)
        : await accountsService.getAccountDefaults(userId, accountId);
      const authProfile = defaults?.authProfile || {};
      const resolvedAccountId = accountId || authProfile.awsAccountId || authProfile.accountId || null;
      if (!effectiveWorkloadId && typeof workloadsService.findWorkloadForCloudFormationStack === "function") {
        const resolution = await workloadsService.findWorkloadForCloudFormationStack(userId, {
          stackName,
          region,
          accountId: resolvedAccountId,
          permissionProfileId,
        });
        if (resolution?.ambiguous) {
          return {
            ok: false,
            statusCode: 409,
            error: {
              code: "ambiguous_workload_for_stack",
              message: `Stack ${stackName} matches multiple workloads. Pass workloadId so its governance settings can be enforced.`,
              workloadIds: resolution.candidates || [],
            },
          };
        }
        if (resolution?.workloadId) {
          effectiveWorkloadId = safeTrim(resolution.workloadId);
          workloadResolutionSource = resolution.matchSource || "stack_mapping";
        }
      }
      let securityRules = defaults?.securityRules || {};
      let securityRulesSource = "environment";
      let deploymentPreferences = defaults?.deploymentPreferences || {};
      let deploymentPreferencesSource = "environment";
      if (effectiveWorkloadId) {
        const workloadDefaults = await workloadsService.getWorkloadDefaults(userId, effectiveWorkloadId);
        if (!workloadDefaults?.workload) {
          return {
            ok: false,
            statusCode: 404,
            error: { code: "workload_not_found", message: "Workload not found." },
          };
        }
        if (Object.keys(workloadDefaults?.securityRules?.rules || {}).length > 0) {
          securityRules = workloadDefaults.securityRules;
          securityRulesSource = "workload";
        }
        if (Object.prototype.hasOwnProperty.call(workloadDefaults?.deploymentPreferences || {}, "changeSet")) {
          deploymentPreferences = workloadDefaults.deploymentPreferences;
          deploymentPreferencesSource = "workload";
        }
      }
      const changeSetRequired = deploymentPreferences?.changeSet === true;
      const configuredTools = typeof getToolSettings === "function"
        ? await getToolSettings()
        : {};
      const validation = await validationRunner({
        templateBody,
        catalog,
        securityRules,
        cfnGuardBinary: configuredTools.cfnGuardBinary || process.env.CLOUDAGENT_CFN_GUARD_BIN || "cfn-guard",
        cfnLintBinary: configuredTools.cfnLintBinary || process.env.CLOUDAGENT_CFN_LINT_BIN || "cfn-lint",
      });
      const policyFindings = Array.isArray(validation?.findings) ? validation.findings : [];
      const lintErrors = (Array.isArray(validation?.lintFindings) ? validation.lintFindings : [])
        .filter((finding) => String(finding?.severity || "").toLowerCase() === "error");
      const validationBlocked = validation?.ok !== true || policyFindings.length > 0 || lintErrors.length > 0;
      if (validationBlocked) {
        const policyFailed = policyFindings.length > 0;
        const templateRevisionRequired = policyFailed || lintErrors.length > 0 || [
          "policy_failed",
          "lint_failed",
        ].includes(validation?.status);
        const validationStatus = policyFailed ? "policy_failed" : validation?.status || "validation_failed";
        const validationMessage = templateRevisionRequired
          ? "CloudFormation validation prevented deployment. Revise the template to resolve every finding, then run validation again."
          : validation.error?.message || "CloudFormation validation prevented deployment.";
        const blockedValidation = {
          ...validation,
          ok: false,
          status: validationStatus,
          deploymentAllowed: false,
          requiresTemplateRevision: templateRevisionRequired,
        };
        const out = {
          ok: false,
          operation: operation || "deploy",
          accountId: resolvedAccountId,
          permissionProfileId: permissionProfileId || authProfile.permissionProfileId || authProfile.recordId || authProfile.id || null,
          workloadId: effectiveWorkloadId || null,
          region,
          stackName,
          statusCode: validationStatus === "error" ? 400 : 422,
          status: validationStatus,
          validation: blockedValidation,
          deploymentAttempted: false,
          requiresTemplateRevision: templateRevisionRequired,
          retryable: templateRevisionRequired,
          requiredAction: templateRevisionRequired
            ? "revise_template_and_retry_validation"
            : "resolve_validation_error",
          message: validationMessage,
          securityRulesSource,
          changeSetRequired,
          deploymentPreferencesSource,
          workloadResolutionSource,
        };
        runContextValue.recordContextEvent?.({
          type: "cloudformation_operation",
          sourceTool: "aws_cfn_operations",
          timestamp: new Date().toISOString(),
          ...out,
          status: "VALIDATION_FAILED",
          message: validationMessage,
        });
        return out;
      }

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cloudagent-cfn-"));
      try {
        await fs.chmod(tempDir, 0o700);
        const templatePath = path.join(tempDir, "template.yaml");
        await fs.writeFile(templatePath, String(templateBody || ""), { mode: 0o600 });
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
        const effectivePermissionProfileId = permissionProfileId || authProfile.permissionProfileId || authProfile.recordId || authProfile.id || null;

        if (changeSetRequired) {
          const normalizedOperation = operation || "deploy";
          const changeSetType = normalizedOperation === "create" ? "CREATE" : "UPDATE";
          const changeSetName = `cloudagent-${changeSetType.toLowerCase()}-${randomUUID().slice(0, 12)}`;
          const createArgs = [
            "cloudformation",
            "create-change-set",
            "--region",
            region,
            "--stack-name",
            stackName,
            "--change-set-name",
            changeSetName,
            "--change-set-type",
            changeSetType,
            "--template-body",
            `file://${templatePath}`,
            "--output",
            "json",
          ];
          if (effectiveCapabilities.length) createArgs.push("--capabilities", ...effectiveCapabilities);
          if (Array.isArray(parameters) && parameters.length > 0) {
            const parametersPath = path.join(tempDir, "parameters.json");
            await fs.writeFile(
              parametersPath,
              JSON.stringify(parameters.filter((item) => item?.ParameterKey)),
              { mode: 0o600 }
            );
            createArgs.push("--parameters", `file://${parametersPath}`);
          }

          const createResult = await awsCliRunner({
            args: createArgs,
            authProfile,
            timeoutMs: Number(process.env.LOCAL_AWS_CFN_TIMEOUT_MS || 30 * 60 * 1000),
          });
          const createOutput = parseJsonMaybe(createResult.output?.stdout, {}) || {};
          const changeSetId = safeTrim(createOutput.Id || createOutput.ChangeSetId || changeSetName);
          let waitResult = null;
          let describeResult = null;
          let changeSet = null;
          if (createResult.statusCode === 200) {
            waitResult = await awsCliRunner({
              args: [
                "cloudformation",
                "wait",
                "change-set-create-complete",
                "--region",
                region,
                "--stack-name",
                stackName,
                "--change-set-name",
                changeSetId,
              ],
              authProfile,
              timeoutMs: Number(process.env.LOCAL_AWS_CFN_TIMEOUT_MS || 30 * 60 * 1000),
            });
            describeResult = await awsCliRunner({
              args: [
                "cloudformation",
                "describe-change-set",
                "--region",
                region,
                "--stack-name",
                stackName,
                "--change-set-name",
                changeSetId,
                "--output",
                "json",
              ],
              authProfile,
              timeoutMs: Number(process.env.LOCAL_AWS_CFN_TIMEOUT_MS || 30 * 60 * 1000),
            });
            changeSet = parseJsonMaybe(describeResult.output?.stdout, null);
          }
          const noChanges = /didn.t contain changes|no updates are to be performed/i.test(
            `${changeSet?.StatusReason || ""}\n${waitResult?.output?.stderr || ""}\n${describeResult?.output?.stderr || ""}`
          );
          const ok = createResult.statusCode === 200 && (
            changeSet?.Status === "CREATE_COMPLETE" ||
            noChanges
          );
          const failureStatusCode = [
            createResult.statusCode,
            waitResult?.statusCode,
            describeResult?.statusCode,
          ].find((statusCode) => statusCode && statusCode !== 200) || 400;
          const resolvedStackId = safeTrim(changeSet?.StackId || createOutput.StackId) || null;
          const changeSetStatus = noChanges
            ? "NO_CHANGES"
            : changeSet?.Status || (ok ? "CHANGE_SET_CREATED" : "CHANGE_SET_FAILED");
          const changeSetMessage = noChanges
            ? "The CloudFormation change set contains no changes."
            : ok
              ? "CloudFormation change set created. The stack was not deployed."
              : changeSet?.StatusReason || "CloudFormation change-set creation failed.";
          const out = {
            ok,
            operation: normalizedOperation,
            executionMode: "change_set",
            accountId: resolvedAccountId,
            permissionProfileId: effectivePermissionProfileId,
            workloadId: effectiveWorkloadId || null,
            region,
            stackName,
            statusCode: ok ? 200 : failureStatusCode,
            status: changeSetStatus,
            changeSetStatus,
            stackStatus: null,
            changeSetRequired: true,
            changeSetExecuted: false,
            deploymentAttempted: false,
            changeSetName,
            changeSetId: safeTrim(changeSet?.ChangeSetId || createOutput.Id || changeSetId) || null,
            stackId: resolvedStackId,
            stackUrl: buildCloudFormationStackConsoleUrl({
              region,
              stackId: resolvedStackId,
              stackName,
            }),
            noChanges,
            changes: Array.isArray(changeSet?.Changes) ? changeSet.Changes : [],
            statusReason: changeSet?.StatusReason || null,
            message: changeSetMessage,
            stdout: describeResult?.output?.stdout || createResult.output?.stdout || "",
            stderr: [
              createResult.output?.stderr,
              waitResult?.output?.stderr,
              describeResult?.output?.stderr,
            ].filter(Boolean).join("\n"),
            validation,
            securityRulesSource,
            deploymentPreferencesSource,
            workloadResolutionSource,
          };
          runContextValue.recordContextEvent?.({
            type: "cloudformation_operation",
            sourceTool: "aws_cfn_operations",
            timestamp: new Date().toISOString(),
            ...out,
            message: changeSetMessage || out.stderr,
          });
          return out;
        }

        if (effectiveCapabilities.length) deployArgs.push("--capabilities", ...effectiveCapabilities);
        if (Array.isArray(parameters) && parameters.length > 0) {
          deployArgs.push(
            "--parameter-overrides",
            ...parameters
              .filter((item) => item?.ParameterKey)
              .map((item) => `${item.ParameterKey}=${item.ParameterValue ?? ""}`)
          );
        }
        const result = await awsCliRunner({ args: deployArgs, authProfile, timeoutMs: Number(process.env.LOCAL_AWS_CFN_TIMEOUT_MS || 30 * 60 * 1000) });
        let describeResult = null;
        let stack = null;
        if (result.statusCode === 200) {
          describeResult = await awsCliRunner({
            args: [
              "cloudformation",
              "describe-stacks",
              "--region",
              region,
              "--stack-name",
              stackName,
              "--output",
              "json",
            ],
            authProfile,
            timeoutMs: Number(process.env.LOCAL_AWS_CFN_TIMEOUT_MS || 30 * 60 * 1000),
          });
          const described = parseJsonMaybe(describeResult?.output?.stdout, {}) || {};
          stack = Array.isArray(described.Stacks) ? described.Stacks[0] || null : null;
        }
        const stackId = safeTrim(stack?.StackId) || null;
        const stackStatus = safeTrim(stack?.StackStatus) || (result.statusCode === 200
          ? "DEPLOY_COMPLETE"
          : "DEPLOY_FAILED");
        const resolvedStackName = safeTrim(stack?.StackName) || stackName;
        const deploymentMessage = result.statusCode === 200
          ? `CloudFormation stack ${resolvedStackName} reached ${stackStatus}.`
          : safeTrim(result.output?.stderr) || `CloudFormation deployment failed for ${resolvedStackName}.`;
        const out = {
          ok: result.statusCode === 200,
          operation: operation || "deploy",
          executionMode: "direct_deploy",
          accountId: resolvedAccountId,
          permissionProfileId: effectivePermissionProfileId,
          workloadId: effectiveWorkloadId || null,
          region,
          stackName: resolvedStackName,
          stackId,
          stackStatus,
          status: stackStatus,
          statusReason: safeTrim(stack?.StackStatusReason) || null,
          message: deploymentMessage,
          createdTime: stack?.CreationTime || null,
          lastUpdatedTime: stack?.LastUpdatedTime || null,
          stackUrl: buildCloudFormationStackConsoleUrl({
            region,
            stackId,
            stackName: resolvedStackName,
          }),
          statusCode: result.statusCode,
          deploymentAttempted: true,
          stdout: result.output.stdout,
          stderr: result.output.stderr,
          stackLookupWarning: result.statusCode === 200 && describeResult?.statusCode !== 200
            ? safeTrim(describeResult?.output?.stderr) || "The stack was deployed but its final details could not be retrieved."
            : null,
          validation,
          securityRulesSource,
          changeSetRequired: false,
          deploymentPreferencesSource,
          workloadResolutionSource,
        };
        runContextValue.recordContextEvent?.({
          type: "cloudformation_operation",
          sourceTool: "aws_cfn_operations",
          timestamp: new Date().toISOString(),
          ...out,
          message: deploymentMessage,
        });
        return out;
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    },
  });
}

function samePathValue(a, b) {
  if (!a || !b) return false;
  try {
    return path.resolve(a) === path.resolve(b);
  } catch {
    return false;
  }
}

// Shared GitHub governance resolution for all five github tools. Mirrors the
// aws_cfn_operations workload-resolution pattern: maps repo -> workload/
// environment, resolves the effective `github` config down the inheritance
// chain (global -> environment -> workload -> secure defaults), and detects
// the repo default branch. The repo scan and default-branch detection are
// cached for the lifetime of the tool set.
export function createGithubGovernanceResolver({ store, getToolSettings = null, commandRunner = runCommand }) {
  const cache = { scan: null, defaultBranch: new Map() };

  async function scanRepoOwners() {
    if (cache.scan) return cache.scan;
    const workloads = (await store.listWorkloads?.().catch(() => [])) || [];
    const profiles = (await store.listPermissionProfiles?.().catch(() => [])) || [];
    const workloadEntries = [];
    for (const workload of workloads) {
      const deploymentPreferences = parseStoredObject(workload?.deploymentPreferences, {});
      const repo = normalizeGitRepo(deploymentPreferences.gitRepo);
      const localPath = repo?.localPath || (repo ? await resolveLocalRepoPath(repo) : null);
      workloadEntries.push({
        workloadId: workload?.workloadId || null,
        environments: Array.isArray(workload?.environments)
          ? workload.environments.map(safeTrim).filter(Boolean)
          : [],
        deploymentPreferences,
        fullName: repo?.fullName || null,
        localPath: localPath || null,
      });
    }
    const profileEntries = [];
    for (const profile of profiles) {
      const deploymentPreferences = parseStoredObject(profile?.deploymentPreferences, {});
      const repo = normalizeGitRepo(deploymentPreferences.gitRepo);
      const localPath = repo?.localPath || (repo ? await resolveLocalRepoPath(repo) : null);
      profileEntries.push({
        permissionProfileId: profile?.recordId || profile?.id || null,
        deploymentPreferences,
        fullName: repo?.fullName || null,
        localPath: localPath || null,
      });
    }
    cache.scan = { workloadEntries, profileEntries };
    return cache.scan;
  }

  function matchEntry(entry, { repoPath, fullName }) {
    if (repoPath && entry.localPath && samePathValue(entry.localPath, repoPath)) return true;
    if (fullName && entry.fullName && entry.fullName === fullName) return true;
    return false;
  }

  async function detectDefaultBranch(repoPath) {
    if (!repoPath) return null;
    if (cache.defaultBranch.has(repoPath)) return cache.defaultBranch.get(repoPath);
    let defaultBranch = null;
    const symbolic = await commandRunner("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], { cwd: repoPath });
    if (symbolic.statusCode === 200) {
      defaultBranch = safeTrim(symbolic.stdout).replace(/^refs\/remotes\/origin\//, "") || null;
    }
    if (!defaultBranch) {
      const configuredTools = typeof getToolSettings === "function" ? await getToolSettings() : {};
      const gh = await commandRunner(
        configuredTools.githubBinary || "gh",
        ["repo", "view", "--json", "defaultBranchRef"],
        { cwd: repoPath }
      );
      if (gh.statusCode === 200) {
        const parsed = parseJsonMaybe(gh.stdout, {});
        defaultBranch = safeTrim(parsed?.defaultBranchRef?.name) || null;
      }
    }
    cache.defaultBranch.set(repoPath, defaultBranch);
    return defaultBranch;
  }

  async function resolveGithubGovernance({ args = {}, runContext = null } = {}) {
    const runContextValue = runContext?.context || {};
    const repoPath = await resolveLocalRepoPath(args);
    const fullName = safeTrim(args.repoFullName || (args.owner && args.repo ? `${args.owner}/${args.repo}` : "")) || null;
    const explicitWorkloadId = safeTrim(args.workloadId);
    const { workloadEntries, profileEntries } = await scanRepoOwners();

    const workloadMatches = workloadEntries.filter((entry) => matchEntry(entry, { repoPath, fullName }));
    const profileMatches = profileEntries.filter((entry) => matchEntry(entry, { repoPath, fullName }));
    const repoConfigured = workloadMatches.length > 0 || profileMatches.length > 0;

    let effectiveWorkloadId = explicitWorkloadId ||
      safeTrim(runContextValue.workloadId || runContextValue.selectedWorkloadOrStack?.workloadId) ||
      null;
    let workloadResolutionSource = explicitWorkloadId
      ? "tool_argument"
      : effectiveWorkloadId ? "run_context" : "none";

    if (!effectiveWorkloadId) {
      const uniqueWorkloadIds = [...new Set(workloadMatches.map((entry) => entry.workloadId).filter(Boolean))];
      if (uniqueWorkloadIds.length > 1) {
        return {
          ok: false,
          statusCode: 409,
          error: {
            code: "ambiguous_workload_for_repo",
            message: `Repository ${fullName || repoPath || "(unknown)"} matches multiple workloads. Pass workloadId so its GitHub governance settings can be enforced.`,
            actor: "agent",
            retryable: true,
            workloadIds: uniqueWorkloadIds,
          },
        };
      }
      if (uniqueWorkloadIds.length === 1) {
        effectiveWorkloadId = uniqueWorkloadIds[0];
        workloadResolutionSource = "repo_mapping";
      }
    }

    let workloadEntry = effectiveWorkloadId
      ? workloadEntries.find((entry) => entry.workloadId === effectiveWorkloadId) || null
      : null;
    let workloadDeploymentPreferences = workloadEntry?.deploymentPreferences || {};
    if (effectiveWorkloadId && !workloadEntry) {
      const workload = await store.getWorkload?.(effectiveWorkloadId).catch(() => null);
      if (workload) {
        workloadDeploymentPreferences = parseStoredObject(workload.deploymentPreferences, {});
        workloadEntry = {
          workloadId: effectiveWorkloadId,
          environments: Array.isArray(workload.environments)
            ? workload.environments.map(safeTrim).filter(Boolean)
            : [],
          deploymentPreferences: workloadDeploymentPreferences,
        };
      }
    }

    let environmentGithub = null;
    const environmentProfileId = workloadEntry?.environments?.[0] || profileMatches[0]?.permissionProfileId || null;
    if (environmentProfileId) {
      const profileEntry = profileEntries.find((entry) => entry.permissionProfileId === environmentProfileId);
      if (profileEntry) {
        environmentGithub = profileEntry.deploymentPreferences?.github || null;
      } else {
        const profile = await store.getPermissionProfile?.(environmentProfileId).catch(() => null);
        if (profile) environmentGithub = parseStoredObject(profile.deploymentPreferences, {}).github || null;
      }
    }

    const globalGithub = await getGlobalWorkloadGithubGovernance(store).catch(() => null);
    const workloadGithub = workloadDeploymentPreferences?.github || null;

    const { github: baseGithub, source: githubGovernanceSource } = resolveGithubGovernanceConfig({
      globalGithub,
      environmentGithub,
      workloadGithub,
    });

    const defaultBranch = await detectDefaultBranch(repoPath);
    const protectedBranches = unionProtectedBranches(baseGithub.protectedBranches, defaultBranch);
    const github = { ...baseGithub, protectedBranches };
    const iacRoots = extractIacRoots(workloadDeploymentPreferences);

    return {
      ok: true,
      repoPath,
      repoFullName: fullName,
      repoConfigured,
      workloadId: effectiveWorkloadId,
      permissionProfileId: environmentProfileId,
      workloadResolutionSource,
      github,
      githubGovernanceSource,
      defaultBranch,
      protectedBranches,
      iacRoots,
    };
  }

  return {
    resolveGithubGovernance,
    detectDefaultBranch,
    scanRepoOwners,
    clearCache: () => {
      cache.scan = null;
      cache.defaultBranch.clear();
    },
  };
}

const REPO_REQUIRED_ERROR = "localPath/repoPath is required, or set CLOUDAGENT_LOCAL_REPOS_DIR with owner/repo.";

export function createListGithubReposTool({ store, resolveGithubGovernance = null }) {
  return tool({
    name: "list_github_repos",
    description: "List GitHub repositories configured in local CloudAgent workload or environment deployment preferences, including each repo's effective GitHub governance summary.",
    parameters: z.object({ connectionId: z.string().nullable().optional() }).strict(),
    async execute({ connectionId }, runContext) {
      const repos = [];
      const addRepo = async (raw, source = {}) => {
        const repo = normalizeGitRepo(raw);
        if (!repo?.fullName) return;
        if (connectionId && repo.connectionId !== connectionId) return;
        const localPath = repo.localPath || await resolveLocalRepoPath(repo);
        let governance = null;
        if (typeof resolveGithubGovernance === "function") {
          const resolved = await resolveGithubGovernance({
            args: {
              repoFullName: repo.fullName,
              localPath,
              workloadId: source.workloadId || null,
            },
            runContext,
          }).catch(() => null);
          if (resolved?.ok) {
            governance = {
              mode: resolved.github.mode,
              branchPrefix: resolved.github.branchPrefix,
              protectedBranches: resolved.protectedBranches,
              defaultBranch: resolved.defaultBranch,
              source: resolved.githubGovernanceSource,
            };
          }
        }
        repos.push({
          ...repo,
          localPath,
          localPathExists: await pathExists(localPath),
          governance,
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

export function createReadGithubFileTool({ resolveGithubGovernance = null } = {}) {
  return tool({
    name: "read_github_file",
    description: "Read a file or directory from a local Git repository checkout.",
    parameters: z.object({
      localPath: z.string().nullable().optional(),
      repoPath: z.string().nullable().optional(),
      owner: z.string().nullable().optional(),
      repo: z.string().nullable().optional(),
      repoFullName: z.string().nullable().optional(),
      workloadId: z.string().nullable().optional(),
      path: z.string().min(1),
      ref: z.string().nullable().optional(),
    }).strict(),
    async execute(args, runContext) {
      let governance = null;
      if (typeof resolveGithubGovernance === "function") {
        governance = await resolveGithubGovernance({ args, runContext });
        if (governance.ok === false) return governance;
        if (governance.github?.strictReads && !governance.repoConfigured) {
          return {
            ...guardrailRefusal(
              "repo_not_configured",
              "This repository is not configured in any workload or environment deployment preferences. Configure it before reading, or disable github.strictReads.",
              { repoFullName: governance.repoFullName || null }
            ),
            githubGovernanceSource: governance.githubGovernanceSource,
          };
        }
      }
      const repoPath = await resolveLocalRepoPath(args);
      if (!repoPath) return { ok: false, error: REPO_REQUIRED_ERROR };
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

export function createGithubBranchTool({ resolveGithubGovernance = null } = {}) {
  return tool({
    name: "create_github_branch",
    description: "Create a branch in a local Git repository checkout from a base branch/ref. Refuses protected branches, enforces the configured branch prefix, and only resets an existing branch when the reset policy allows it.",
    parameters: z.object({
      localPath: z.string().nullable().optional(),
      repoPath: z.string().nullable().optional(),
      owner: z.string().nullable().optional(),
      repo: z.string().nullable().optional(),
      repoFullName: z.string().nullable().optional(),
      workloadId: z.string().nullable().optional(),
      base: z.string().min(1),
      branch: z.string().min(1),
    }).strict(),
    async execute(args, runContext) {
      if (typeof resolveGithubGovernance !== "function") {
        return { ok: false, error: "GitHub governance resolver is not configured." };
      }
      const governance = await resolveGithubGovernance({ args, runContext });
      if (governance.ok === false) return governance;
      const source = governance.githubGovernanceSource;
      const repoPath = governance.repoPath;
      if (!repoPath) return { ok: false, error: REPO_REQUIRED_ERROR };
      const github = governance.github;

      if (isProtectedBranch(args.branch, governance.protectedBranches)) {
        return {
          ...guardrailRefusal("protected_branch", `Refusing to create or reset the protected branch "${args.branch}".`, {
            branch: args.branch,
            protectedBranches: governance.protectedBranches,
          }),
          githubGovernanceSource: source,
        };
      }
      if (!hasBranchPrefix(args.branch, github.branchPrefix)) {
        return {
          ...guardrailRefusal("branch_prefix_required", `Branch names must start with the required prefix "${github.branchPrefix}".`, {
            retryable: true,
            branch: args.branch,
            branchPrefix: github.branchPrefix,
            suggestedBranch: suggestPrefixedBranch(args.branch, github.branchPrefix),
          }),
          githubGovernanceSource: source,
        };
      }

      const existing = await runCommand("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${args.branch}`], { cwd: repoPath });
      const branchExists = existing.statusCode === 200;
      if (branchExists) {
        const policy = github.allowBranchReset || "prefix_only";
        const resetAllowed = policy === "always" ||
          (policy === "prefix_only" && hasBranchPrefix(args.branch, github.branchPrefix));
        if (!resetAllowed) {
          return {
            ...guardrailRefusal("branch_exists", `Branch "${args.branch}" already exists and the reset policy (${policy}) does not allow resetting it.`, {
              retryable: true,
              branch: args.branch,
              allowBranchReset: policy,
            }),
            githubGovernanceSource: source,
          };
        }
        const result = await runCommand("git", ["checkout", "-B", args.branch, args.base], { cwd: repoPath });
        return { ok: result.statusCode === 200, branch: args.branch, base: args.base, reset: true, githubGovernanceSource: source, stdout: result.stdout, stderr: result.stderr };
      }

      const result = await runCommand("git", ["checkout", "-b", args.branch, args.base], { cwd: repoPath });
      return { ok: result.statusCode === 200, branch: args.branch, base: args.base, reset: false, githubGovernanceSource: source, stdout: result.stdout, stderr: result.stderr };
    },
  });
}

export function createWriteGithubFileTool({ resolveGithubGovernance = null } = {}) {
  return tool({
    name: "write_github_file",
    description: "Create or update a file in a local Git repository checkout and commit the change. Refuses writes to protected branches under pr_only mode, enforces path scope and secret scanning, and appends the CloudAgent co-author trailer when configured.",
    parameters: z.object({
      localPath: z.string().nullable().optional(),
      repoPath: z.string().nullable().optional(),
      owner: z.string().nullable().optional(),
      repo: z.string().nullable().optional(),
      repoFullName: z.string().nullable().optional(),
      workloadId: z.string().nullable().optional(),
      path: z.string().min(1),
      content: z.string(),
      message: z.string().min(1),
      branch: z.string().nullable().optional(),
    }).strict(),
    async execute(args, runContext) {
      if (typeof resolveGithubGovernance !== "function") {
        return { ok: false, error: "GitHub governance resolver is not configured." };
      }
      const governance = await resolveGithubGovernance({ args, runContext });
      if (governance.ok === false) return governance;
      const source = governance.githubGovernanceSource;
      const repoPath = governance.repoPath;
      if (!repoPath) return { ok: false, error: REPO_REQUIRED_ERROR };
      const github = governance.github;

      let targetBranch = safeTrim(args.branch);
      if (!targetBranch) {
        const head = await runCommand("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoPath });
        targetBranch = safeTrim(head.stdout) || null;
      }
      if (github.mode === "pr_only" && targetBranch && isProtectedBranch(targetBranch, governance.protectedBranches)) {
        return {
          ...guardrailRefusal("protected_branch", `Refusing to write to the protected branch "${targetBranch}" under pr_only mode.`, {
            branch: targetBranch,
            guidance: "create a branch with create_github_branch first",
          }),
          githubGovernanceSource: source,
        };
      }

      const relativePath = safeRepoRelativePath(args.path);
      const scope = evaluatePathScope({ relativePath, github, iacRoots: governance.iacRoots });
      if (!scope.allowed) {
        return {
          ...guardrailRefusal("path_denied", `Writing to "${relativePath}" is denied by the path scope (${scope.reason}).`, {
            path: relativePath,
            allowedRoots: scope.allowedRoots || [],
            matchedDeny: scope.matchedDeny || null,
            pathScopeMode: scope.pathScopeMode,
          }),
          githubGovernanceSource: source,
        };
      }

      if (github.secretScan) {
        const hit = scanForSecrets(args.content);
        if (hit) {
          return {
            ...guardrailRefusal("secret_detected", `A potential secret matching pattern "${hit.pattern}" was detected in the file content; refusing to commit.`, {
              pattern: hit.pattern,
              path: relativePath,
            }),
            githubGovernanceSource: source,
          };
        }
      }

      if (args.branch) {
        const checkout = await runCommand("git", ["checkout", args.branch], { cwd: repoPath });
        if (checkout.statusCode !== 200) return { ok: false, error: checkout.stderr || checkout.stdout };
      }
      const target = path.join(repoPath, relativePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, String(args.content ?? ""));
      await runCommand("git", ["add", relativePath], { cwd: repoPath });
      let commitMessage = args.message;
      if (github.attribution?.coAuthorTrailer && !commitMessage.includes(CO_AUTHOR_TRAILER)) {
        commitMessage = `${commitMessage}\n\n${CO_AUTHOR_TRAILER}`;
      }
      const commit = await runCommand("git", ["commit", "-m", commitMessage], { cwd: repoPath });
      const changed = commit.statusCode === 200;
      return {
        ok: changed || /nothing to commit/i.test(commit.stdout + commit.stderr),
        changed,
        path: relativePath,
        branch: targetBranch,
        pathScopeMode: scope.pathScopeMode,
        coAuthorTrailer: Boolean(github.attribution?.coAuthorTrailer),
        githubGovernanceSource: source,
        stdout: commit.stdout,
        stderr: commit.stderr,
      };
    },
  });
}

export function createGithubPullRequestTool({ getToolSettings = null, resolveGithubGovernance = null } = {}) {
  return tool({
    name: "create_github_pull_request",
    description: "Create a GitHub pull request from a local checkout using the GitHub CLI (`gh`). Enforces protected-branch/prefix rules on the head, verifies the base is the repo default branch, and checks diff limits before pushing. Include the terraform_plan_check summary and any confirmation-required findings in the PR body when infrastructure files were changed.",
    parameters: z.object({
      localPath: z.string().nullable().optional(),
      repoPath: z.string().nullable().optional(),
      owner: z.string().nullable().optional(),
      repo: z.string().nullable().optional(),
      repoFullName: z.string().nullable().optional(),
      workloadId: z.string().nullable().optional(),
      title: z.string().min(1),
      head: z.string().min(1),
      base: z.string().min(1),
      body: z.string().nullable().optional(),
      push: z.boolean().nullable().optional(),
    }).strict(),
    async execute(args, runContext) {
      if (typeof resolveGithubGovernance !== "function") {
        return { ok: false, error: "GitHub governance resolver is not configured." };
      }
      const governance = await resolveGithubGovernance({ args, runContext });
      if (governance.ok === false) return governance;
      const source = governance.githubGovernanceSource;
      const repoPath = governance.repoPath;
      if (!repoPath) return { ok: false, error: REPO_REQUIRED_ERROR };
      const github = governance.github;
      const runContextValue = runContext?.context || {};

      if (isProtectedBranch(args.head, governance.protectedBranches)) {
        return {
          ...guardrailRefusal("protected_branch", `Refusing to open a pull request from the protected branch "${args.head}".`, {
            head: args.head,
            protectedBranches: governance.protectedBranches,
          }),
          githubGovernanceSource: source,
        };
      }
      if (!hasBranchPrefix(args.head, github.branchPrefix)) {
        return {
          ...guardrailRefusal("branch_prefix_required", `The pull request head branch must start with the required prefix "${github.branchPrefix}".`, {
            retryable: true,
            head: args.head,
            branchPrefix: github.branchPrefix,
            suggestedBranch: suggestPrefixedBranch(args.head, github.branchPrefix),
          }),
          githubGovernanceSource: source,
        };
      }

      const configuredAlternates = Array.isArray(github.allowedBaseBranches) ? github.allowedBaseBranches.map(safeTrim).filter(Boolean) : [];
      const allowedBases = new Set([governance.defaultBranch, ...configuredAlternates].filter(Boolean));
      if (governance.defaultBranch && !allowedBases.has(args.base)) {
        return {
          ...guardrailRefusal("invalid_base_branch", `Pull requests must target the repository default branch "${governance.defaultBranch}", not "${args.base}".`, {
            retryable: true,
            base: args.base,
            defaultBranch: governance.defaultBranch,
            allowedBaseBranches: [...allowedBases],
          }),
          githubGovernanceSource: source,
        };
      }

      const limits = github.limits || {};
      const numstat = await runCommand("git", ["diff", "--numstat", `${args.base}...${args.head}`], { cwd: repoPath });
      if (numstat.statusCode === 200) {
        const lines = numstat.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
        let fileCount = 0;
        const binaryFiles = [];
        for (const line of lines) {
          const parts = line.split("\t");
          const added = parts[0];
          const removed = parts[1];
          const file = parts.slice(2).join("\t");
          fileCount += 1;
          if (added === "-" || removed === "-") binaryFiles.push(file);
        }
        const maxFiles = Number(limits.maxFilesPerPr);
        if (maxFiles && fileCount > maxFiles) {
          return {
            ...guardrailRefusal("diff_too_large", `The diff changes ${fileCount} files, exceeding the maximum of ${maxFiles}.`, {
              files: fileCount,
              maxFilesPerPr: maxFiles,
            }),
            githubGovernanceSource: source,
          };
        }
        if (limits.allowBinary === false && binaryFiles.length) {
          return {
            ...guardrailRefusal("binary_file_detected", `The diff includes ${binaryFiles.length} binary file(s), which are not allowed.`, {
              binaryFiles,
            }),
            githubGovernanceSource: source,
          };
        }
        const maxDiffKb = Number(limits.maxDiffKb);
        if (maxDiffKb) {
          const diff = await runCommand("git", ["diff", `${args.base}...${args.head}`], { cwd: repoPath });
          if (diff.statusCode === 200) {
            const diffKb = Buffer.byteLength(diff.stdout, "utf8") / 1024;
            if (diffKb > maxDiffKb) {
              return {
                ...guardrailRefusal("diff_too_large", `The diff is ${diffKb.toFixed(1)} KB, exceeding the maximum of ${maxDiffKb} KB.`, {
                  diffKb: Math.round(diffKb),
                  maxDiffKb,
                }),
                githubGovernanceSource: source,
              };
            }
          }
        }
      }

      if (args.push !== false) {
        const push = await runCommand("git", ["push", "-u", "origin", args.head], { cwd: repoPath });
        if (push.statusCode !== 200) return { ok: false, error: push.stderr || push.stdout, pushed: false, githubGovernanceSource: source };
      }

      let body = args.body || "";
      const footerBits = [];
      const runId = safeTrim(runContextValue.runId || runContextValue.agentRunId || runContextValue.recordId);
      if (runId) footerBits.push(`CloudAgent run: ${runId}`);
      if (governance.workloadId) footerBits.push(`Workload: ${governance.workloadId}`);
      if (footerBits.length) body = `${body}\n\n---\n${footerBits.join("\n")}`.trim();

      const ghArgs = ["pr", "create", "--title", args.title, "--head", args.head, "--base", args.base, "--body", body];
      if (github.draftPrs) ghArgs.push("--draft");
      const configuredTools = typeof getToolSettings === "function" ? await getToolSettings() : {};
      const ghBinary = configuredTools.githubBinary || "gh";
      const prLabel = safeTrim(github.attribution?.prLabel);
      let result;
      if (prLabel) {
        result = await runCommand(ghBinary, [...ghArgs, "--label", prLabel], { cwd: repoPath });
        if (result.statusCode !== 200 && /label/i.test(`${result.stderr || ""}`)) {
          result = await runCommand(ghBinary, ghArgs, { cwd: repoPath });
        }
      } else {
        result = await runCommand(ghBinary, ghArgs, { cwd: repoPath });
      }
      return {
        ok: result.statusCode === 200,
        pullRequestUrl: safeTrim(result.stdout) || null,
        draft: Boolean(github.draftPrs),
        base: args.base,
        head: args.head,
        defaultBranch: governance.defaultBranch,
        workloadId: governance.workloadId,
        github,
        githubGovernanceSource: source,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    },
  });
}

export function createCloudAgentTools({ store, selectedAuthProfile = null } = {}) {
  if (!store) throw new Error("createCloudAgentTools requires a store");

  const cache = createCloudAgentCache();
  const accountsService = createLocalAccountsService({ store, cache, selectedAuthProfile });
  const workloadsService = createLocalWorkloadsService({ store });
  const cliSessionManager = getDefaultLocalCliSessionManager({
    rootDir: process.env.CLOUDAGENT_CLI_SESSION_DIR || path.join(store.dataDir, "tmp", "cli-sessions"),
  });
  const { resolveGithubGovernance } = createGithubGovernanceResolver({
    store,
    getToolSettings: () => getLocalIacToolSettings(store),
  });

  const tools = [
    createListPermissionProfilesTool({ accountsService }),
    createGetPermissionProfileTool({ accountsService }),
    createListWorkloadsTool({ cache, workloadsService }),
    createGetWorkloadTool({ cache, workloadsService }),
    createUpdateWorkloadTool({ cache, workloadsService, accountsService }),
    ...createCliSessionTools({ accountsService, manager: cliSessionManager }),
    createAwsCfnOperationsTool({
      accountsService,
      workloadsService,
      getToolSettings: () => getLocalIacToolSettings(store),
      catalog: DEFAULT_GUARDRAIL_CATALOG,
    }),
    createListGithubReposTool({ store, resolveGithubGovernance }),
    createReadGithubFileTool({ resolveGithubGovernance }),
    createGithubBranchTool({ resolveGithubGovernance }),
    createWriteGithubFileTool({ resolveGithubGovernance }),
    createGithubPullRequestTool({ getToolSettings: () => getLocalIacToolSettings(store), resolveGithubGovernance }),
    createTerraformPlanCheckTool({
      workloadsService,
      accountsService,
      resolveRepoPath: resolveLocalRepoPath,
      buildCredentialEnv: buildAwsCliEnv,
      catalog: DEFAULT_GUARDRAIL_CATALOG,
      getToolSettings: () => getLocalIacToolSettings(store),
    }),
    createGetDeploymentPreferencesSummaryTool({ accountsService }),
    createListLocalWorkflowDefsTool({ store }),
    createListLocalWorkflowRunsTool({ store }),
    createGetLocalWorkflowRunTool({ store }),
    createListLocalSkillsTool({ store }),
    createListLocalAgentHistoryTool({ store }),
    createGetLocalAgentRunTool({ store }),
    createListArtifactsTool({ store }),
    createGetArtifactTool({ store }),
    createLaunchArtifactTool({
      launchArtifact: (params) => launchLocalAwsScanner({ store, logger: console, ...params }),
    }),
    createArchitectureTemplatesTool({ templates: TEMPLATES }),
    createDiagramSpecTool(),
  ];
  assertOpenAiToolSchemas(tools);

  return {
    cache,
    accountsService,
    workloadsService,
    tools,
  };
}
