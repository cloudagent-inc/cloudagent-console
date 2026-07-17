import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { safeTrim } from "@cloudagent/platform/utils";

const SCHEMA_VERSION = 1;
const LOCAL_USER_ID = "local-user";
const AGENT_RUN_EVENT_LIMIT = 5000;

const STORE_DIRS = [
  "permission-profiles",
  "workloads",
  "workflows",
  "workflow-runs",
  "skills",
  "chat-records",
  "agent-history",
  "agent-run-events",
  "scheduler/workflows",
  "summaries/environments",
  "summaries/workloads",
  "report-history",
  "scanner-runs",
  "artifacts",
  "artifacts/diagrams",
  "artifacts/inventory",
  "artifacts/healthAnalysis",
  "artifacts/costAnalysis",
  "artifacts/threatDetection",
];

function nowIso() {
  return new Date().toISOString();
}

function defaultLocalDataDir() {
  return path.join(os.homedir(), ".cloudagent", "local-data");
}

function fileNameForId(id) {
  const raw = String(id || "").trim();
  if (!raw) throw new Error("id is required");
  return `${encodeURIComponent(raw)}.json`;
}

function parseJsonObject(value, fallback = {}) {
  if (value == null || value === "") return fallback;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function normalizeJsonObject(value, fallback = {}) {
  return parseJsonObject(value, fallback);
}

function parseJsonValue(value, fallback = null) {
  if (value == null || value === "") return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

function normalizeJsonString(value, fallback = {}) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return JSON.stringify(fallback);
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      return JSON.stringify(fallback);
    }
  }
  return JSON.stringify(value ?? fallback);
}

function normalizeSkillDescription(value, fallback = []) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return JSON.stringify(fallback);
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      return trimmed;
    }
  }
  return JSON.stringify(value ?? fallback);
}

function stripSkillRunnerFields(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const {
    executionMode: _executionMode,
    runner: _runner,
    credits: _credits,
    ...rest
  } = value;
  return rest;
}

function stripSkillBillingFields(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const next = stripSkillRunnerFields(value);
  if (typeof next.plan === "string") {
    try {
      const parsedPlan = JSON.parse(next.plan);
      if (parsedPlan && typeof parsedPlan === "object" && !Array.isArray(parsedPlan)) {
        next.plan = JSON.stringify(stripSkillRunnerFields(parsedPlan));
      }
    } catch {}
  } else if (next.plan && typeof next.plan === "object" && !Array.isArray(next.plan)) {
    next.plan = stripSkillRunnerFields(next.plan);
  }
  return next;
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return normalizeStringArray(parsed);
    } catch {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    }
  }
  return [];
}

function normalizeExecutionMode(value, fallback = "cloudagent") {
  const normalized = String(value || fallback || "cloudagent")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (["codex", "codex_cli", "openai_codex"].includes(normalized)) return "codex";
  if (["claude", "claude_code", "claude_cli", "anthropic_claude"].includes(normalized)) return "claude";
  if (["cursor", "cursor_agent", "cursor_cli", "cursor_ai"].includes(normalized)) return "cursor";
  return "cloudagent";
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function sanitizePathSegment(value) {
  const raw = safeTrim(value);
  if (!raw) throw new Error("path segment is required");
  const sanitized = raw.replace(/[^A-Za-z0-9._@+=,-]/g, "_");
  // Neutralize all-dot segments (".", "..", "...") so they cannot be used to
  // traverse out of the intended directory via path.join. Segments containing
  // at least one non-dot character are left byte-identical to today.
  if (/^\.+$/.test(sanitized)) return sanitized.replace(/\./g, "_");
  return sanitized;
}

function formatArtifactTimestamp(value = Date.now()) {
  const date = new Date(value);
  const pad = (part) => String(part).padStart(2, "0");
  return [
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
    `${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}-${pad(date.getUTCSeconds())}Z`,
  ].join("_");
}

function normalizeArtifactKind(kind) {
  const normalized = safeTrim(kind).toLowerCase();
  if (normalized === "inventory") return { kind: "inventory", dir: "artifacts/inventory", analysisKey: "inventory" };
  if (normalized === "health" || normalized === "healthanalysis") {
    return { kind: "health", dir: "artifacts/healthAnalysis", analysisKey: "health" };
  }
  if (normalized === "cost" || normalized === "costanalysis") {
    return { kind: "cost", dir: "artifacts/costAnalysis", analysisKey: "cost" };
  }
  if (normalized === "threat" || normalized === "threatdetection" || normalized === "threatanalysis") {
    return { kind: "threat", dir: "artifacts/threatDetection", analysisKey: "threat" };
  }
  throw new Error(`Unsupported scanner artifact kind: ${kind || "(empty)"}`);
}

function hasCostSpendRows(payload = {}) {
  const spend = payload?.data?.spend && typeof payload.data.spend === "object"
    ? payload.data.spend
    : {};
  return [
    spend.dailyTotal,
    spend.monthlyTotal12m,
    spend.dailyByService,
    spend.dailyByLinkedAccount,
    spend.dailyByServiceLinkedAccount,
  ].some((value) => Array.isArray(value) && value.length > 0);
}

function mergeSummaryAnalysis(summary, analysisPatch = {}) {
  const existingSummary = parseJsonObject(summary, {});
  const existingAnalysis = parseJsonObject(existingSummary.analysis, {});
  return {
    ...existingSummary,
    analysis: {
      ...existingAnalysis,
      ...Object.fromEntries(
        Object.entries(analysisPatch || {}).map(([key, value]) => [
          key,
          {
            ...(existingAnalysis[key] && typeof existingAnalysis[key] === "object"
              ? existingAnalysis[key]
              : {}),
            ...(value && typeof value === "object" ? value : {}),
          },
        ])
      ),
    },
  };
}

function conflictError(message) {
  const error = new Error(message);
  error.status = 409;
  return error;
}

export function normalizePermissionProfile(input = {}, existing = null) {
  const timestamp = nowIso();
  const recordId = safeTrim(input.recordId || input.id || existing?.recordId) || createId("profile");
  const createdAt = existing?.createdAt || input.createdAt || timestamp;

  return {
    ...(existing || {}),
    ...input,
    schemaVersion: SCHEMA_VERSION,
    userId: LOCAL_USER_ID,
    recordId,
    name: safeTrim(input.name ?? existing?.name) || "Untitled environment",
    type: safeTrim(input.type ?? existing?.type) || "aws account",
    description: safeTrim(input.description ?? existing?.description),
    authProfile: normalizeJsonObject(input.authProfile ?? existing?.authProfile, {}),
    deploymentPreferences: normalizeJsonObject(input.deploymentPreferences ?? existing?.deploymentPreferences, {}),
    securityRules: normalizeJsonObject(input.securityRules ?? existing?.securityRules, {}),
    summary: input.summary ?? existing?.summary ?? null,
    createdAt,
    updatedAt: timestamp,
  };
}

export function normalizeWorkload(input = {}, existing = null) {
  const timestamp = nowIso();
  const workloadId = safeTrim(input.workloadId || input.id || existing?.workloadId) || createId("workload");
  const createdAt = existing?.createdAt || input.createdAt || timestamp;

  return {
    ...(existing || {}),
    ...input,
    schemaVersion: SCHEMA_VERSION,
    userId: LOCAL_USER_ID,
    workloadId,
    workloadName: safeTrim(input.workloadName ?? input.name ?? existing?.workloadName) || "Untitled workload",
    description: safeTrim(input.description ?? existing?.description),
    environments: normalizeStringArray(input.environments ?? existing?.environments),
    deploymentPreferences: normalizeJsonObject(input.deploymentPreferences ?? existing?.deploymentPreferences, {}),
    securityRules: normalizeJsonObject(input.securityRules ?? existing?.securityRules, {}),
    trackedResources: normalizeJsonObject(input.trackedResources ?? existing?.trackedResources, {
      resources: [],
      stacks: [],
    }),
    diagram: input.diagram ?? existing?.diagram ?? null,
    summary: input.summary ?? existing?.summary ?? null,
    createdAt,
    updatedAt: timestamp,
  };
}

export function parseStoredObject(value, fallback = {}) {
  return parseJsonObject(value, fallback);
}

export function parseStoredJsonValue(value, fallback = null) {
  return parseJsonValue(value, fallback);
}

export function normalizeWorkflowDefinition(input = {}, existing = null) {
  const timestamp = nowIso();
  const workflowId = safeTrim(input.workflowId || input.id || existing?.workflowId) || createId("workflow");
  const createdAt = existing?.createdAt || input.createdAt || timestamp;

  return {
    ...(existing || {}),
    ...input,
    schemaVersion: SCHEMA_VERSION,
    userId: LOCAL_USER_ID,
    workflowId,
    title: safeTrim(input.title ?? input.workflowName ?? existing?.title) || "Untitled Workflow",
    description: safeTrim(input.description ?? input.workflowDescription ?? existing?.description),
    nodes: normalizeJsonString(input.nodes ?? existing?.nodes, []),
    schedule: normalizeJsonString(input.schedule ?? existing?.schedule, {}),
    status: safeTrim(input.status ?? existing?.status) || "active",
    createdAt,
    updatedAt: timestamp,
  };
}

export function normalizeWorkflowRun(input = {}, existing = null) {
  const timestamp = nowIso();
  const workflowRunId = safeTrim(input.workflowRunId || input.runId || existing?.workflowRunId) || createId("workflow-run");
  const workflowDefinitionValue =
    input.workflowDefinition ?? existing?.workflowDefinition ?? {};
  const workflowDefinition =
    parseJsonValue(workflowDefinitionValue, workflowDefinitionValue) || {};
  const workflowId =
    safeTrim(input.workflowId || existing?.workflowId || workflowDefinition?.workflowId || workflowDefinition?.id) ||
    null;
  const title =
    safeTrim(input.title || existing?.title || workflowDefinition?.title || workflowDefinition?.workflowName) ||
    "Untitled Workflow";
  const createdAt = existing?.createdAt || input.createdAt || input.startedAt || timestamp;
  const startedAt = input.startedAt || existing?.startedAt || createdAt;
  const workflowStatus =
    safeTrim(input.workflowStatus ?? input.status ?? existing?.workflowStatus) || "completed";
  const summaryText =
    input.summary ||
    workflowDefinition?.workflowRunSummary?.summary ||
    (workflowStatus === "cancelled"
      ? "This local workflow run was cancelled."
      : "This local workflow run was recorded. Full local workflow execution is not implemented yet.");
  const normalizedDefinition = {
    ...(workflowDefinition && typeof workflowDefinition === "object" && !Array.isArray(workflowDefinition)
      ? workflowDefinition
      : {}),
    workflowId,
    title,
    description:
      workflowDefinition?.description ||
      workflowDefinition?.workflowDescription ||
      input.description ||
      existing?.description ||
      "",
    workflowRunSummary: {
      ...(workflowDefinition?.workflowRunSummary || {}),
      summary: summaryText,
      finalSummary: workflowDefinition?.workflowRunSummary?.finalSummary || summaryText,
      generatedAt: workflowDefinition?.workflowRunSummary?.generatedAt || timestamp,
      status: workflowStatus,
    },
  };

  return {
    ...(existing || {}),
    ...input,
    schemaVersion: SCHEMA_VERSION,
    userId: LOCAL_USER_ID,
    workflowRunId,
    workflowId,
    workflowName: title,
    title,
    workflowStatus,
    workflowDefinition: normalizeJsonString(normalizedDefinition, {}),
    currentExecutions: normalizeJsonString(input.currentExecutions ?? existing?.currentExecutions, []),
    executionHistory: normalizeJsonString(input.executionHistory ?? existing?.executionHistory, []),
    lastMessage: input.lastMessage ?? existing?.lastMessage ?? null,
    statusMessage: input.statusMessage ?? existing?.statusMessage ?? null,
    linkedAgentRunIds: normalizeStringArray(input.linkedAgentRunIds ?? existing?.linkedAgentRunIds),
    startedAt,
    completedAt:
      input.completedAt ??
      existing?.completedAt ??
      (["completed", "complete", "failed", "cancelled"].includes(workflowStatus.toLowerCase()) ? timestamp : null),
    createdAt,
    updatedAt: timestamp,
  };
}

export function normalizeSkill(input = {}, existing = null) {
  const timestamp = nowIso();
  const {
    executionMode: _inputExecutionMode,
    runner: _inputRunner,
    ...inputWithoutRunner
  } = input || {};
  const existingWithoutRunner = existing ? stripSkillRunnerFields(existing) : null;
  const recordId = safeTrim(input.recordId || input.skillId || input.blueprintId || input.id || existing?.recordId) || createId("skill");
  const planValue = stripSkillRunnerFields(parseJsonValue(input.plan ?? existing?.plan, {}) || {});
  const createdAt = existing?.createdAt || input.createdAt || timestamp;
  const title =
    safeTrim(input.title ?? input.planTitle ?? planValue?.title ?? planValue?.planTitle ?? existing?.title) ||
    "Untitled Skill";
  const cloudProvider =
    safeTrim(input.cloudProvider ?? planValue?.cloudProvider ?? existing?.cloudProvider) || "aws";

  return {
    ...(existingWithoutRunner || {}),
    ...inputWithoutRunner,
    schemaVersion: SCHEMA_VERSION,
    userId: LOCAL_USER_ID,
    recordId,
    title,
    description: normalizeSkillDescription(input.description ?? existing?.description, []),
    cloudProvider,
    plan: normalizeJsonString(
      planValue && Object.keys(planValue).length > 0 ? planValue : {
        title,
        cloudProvider,
        plan: [],
      },
      { title, cloudProvider, plan: [] }
    ),
    requiredPermissions: normalizeJsonString(input.requiredPermissions ?? existing?.requiredPermissions, {}),
    planSettings: normalizeJsonString(input.planSettings ?? existing?.planSettings, {}),
    status: safeTrim(input.status ?? existing?.status) || "ready",
    createdAt,
    updatedAt: timestamp,
  };
}

export function normalizeAgentHistoryRecord(input = {}, existing = null) {
  const timestamp = nowIso();
  const recordId = safeTrim(input.recordId || input.agentRunId || input.runId || existing?.recordId) || createId("agent-run");
  const purchaseDate = existing?.purchaseDate || input.purchaseDate || input.createdAt || timestamp;
  const itemId = safeTrim(input.itemId ?? input.planId ?? input.blueprintId ?? existing?.itemId) || "local-agent";
  const agentType = safeTrim(input.agentType ?? existing?.agentType) || "agent";
  const status = safeTrim(input.status ?? existing?.status) || "complete";
  const logValue = parseJsonValue(input.log ?? existing?.log, {}) || {};
  const executionMode = normalizeExecutionMode(
    input.executionMode ??
      input.runner ??
      logValue?.executionMode ??
      logValue?.runner ??
      existing?.executionMode ??
      existing?.runner
  );
  const summaryText =
    input.summary ||
    logValue?.runSummary?.summary ||
    logValue?.runSummary?.finalSummary ||
    "This local agent run was recorded. Full local agent execution is not implemented yet.";
  const normalizedLog = {
    ...(logValue && typeof logValue === "object" && !Array.isArray(logValue) ? logValue : {}),
    executionMode,
    runner: executionMode,
    logs: Array.isArray(logValue?.logs) ? logValue.logs : [],
    lastUpdated: timestamp,
    runSummary: {
      ...(logValue?.runSummary && typeof logValue.runSummary === "object" ? logValue.runSummary : {}),
      summary: summaryText,
      finalSummary: logValue?.runSummary?.finalSummary || summaryText,
      generatedAt: logValue?.runSummary?.generatedAt || timestamp,
      status,
    },
  };

  return {
    ...(existing || {}),
    ...input,
    schemaVersion: SCHEMA_VERSION,
    userId: LOCAL_USER_ID,
    recordId,
    itemId,
    agentType,
    status,
    executionMode,
    runner: executionMode,
    parentId: input.parentId ?? existing?.parentId ?? null,
    purchaseDate,
    updatedAt: timestamp,
    createdAt: existing?.createdAt || input.createdAt || purchaseDate,
    title: safeTrim(input.title ?? existing?.title) || itemId,
    log: normalizeJsonString(normalizedLog, {}),
    authProfile: normalizeJsonString(input.authProfile ?? existing?.authProfile, {}),
    cliSessionId: input.cliSessionId ?? existing?.cliSessionId ?? null,
    scanId: input.scanId ?? existing?.scanId ?? null,
    settings: normalizeJsonString(input.settings ?? existing?.settings, {}),
    updatedBlueprint: input.updatedBlueprint ?? existing?.updatedBlueprint ?? null,
  };
}

function normalizeChatMessageEntry(input = {}) {
  const role = safeTrim(input.role).toLowerCase() === "user" ? "user" : "assistant";
  return {
    role,
    content: String(input.content ?? input.text ?? ""),
    createdAt: input.createdAt || nowIso(),
  };
}

export function normalizeChatRecord(input = {}, existing = null) {
  const timestamp = nowIso();
  const sessionId = safeTrim(input.sessionId ?? existing?.sessionId) || createId("chat-session");
  const recordId = safeTrim(input.recordId || input.id || existing?.recordId) || createId("chat");
  const messages = Array.isArray(input.messages)
    ? input.messages.map((message) => normalizeChatMessageEntry(message))
    : Array.isArray(existing?.messages)
      ? existing.messages.map((message) => normalizeChatMessageEntry(message))
      : [];

  return {
    ...(existing || {}),
    ...input,
    schemaVersion: SCHEMA_VERSION,
    userId: LOCAL_USER_ID,
    recordId,
    sessionId,
    title: safeTrim(input.title ?? existing?.title) || "Untitled chat",
    messages,
    metadata: normalizeJsonString(input.metadata ?? existing?.metadata, {}),
    createdAt: existing?.createdAt || input.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

export function normalizeScannerRun(input = {}, existing = null) {
  const timestamp = nowIso();
  const scanId = safeTrim(input.scanId || input.id || existing?.scanId) || createId("scan");
  const reportType = safeTrim(input.reportType ?? existing?.reportType).toLowerCase() || "inventory";
  const cloudProvider = safeTrim(input.cloudProvider ?? existing?.cloudProvider).toLowerCase() || "aws";
  const status = safeTrim(input.status ?? existing?.status) || "queued";
  const targets = Array.isArray(input.targets)
    ? input.targets
    : Array.isArray(existing?.targets)
      ? existing.targets
      : [];

  return {
    ...(existing || {}),
    ...input,
    schemaVersion: SCHEMA_VERSION,
    userId: LOCAL_USER_ID,
    scanId,
    cloudProvider,
    reportType,
    targets,
    status,
    taskArn: input.taskArn || existing?.taskArn || `local:${scanId}`,
    taskArns: input.taskArns || existing?.taskArns || [`local:${scanId}`],
    failures: Array.isArray(input.failures) ? input.failures : existing?.failures || [],
    results: Array.isArray(input.results) ? input.results : existing?.results || [],
    options: normalizeJsonObject(input.options ?? existing?.options, {}),
    error: input.error ?? existing?.error ?? null,
    startedAt: input.startedAt ?? existing?.startedAt ?? null,
    completedAt: input.completedAt ?? existing?.completedAt ?? null,
    createdAt: existing?.createdAt || input.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

export class JsonFileStore {
  #agentRunEventWriteQueues = new Map();

  constructor({ dataDir } = {}) {
    this.dataDir = path.resolve(dataDir || defaultLocalDataDir());
  }

  // Defense-in-depth: resolve a path under the data directory and guarantee the
  // result cannot escape it. Every filesystem operation on an id/segment-derived
  // path in this class must route through here.
  #resolvePath(...segments) {
    const resolved = path.resolve(this.dataDir, ...segments);
    if (resolved !== this.dataDir && !resolved.startsWith(this.dataDir + path.sep)) {
      throw new Error("path escapes data directory");
    }
    return resolved;
  }

  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await Promise.all(STORE_DIRS.map((dir) => fs.mkdir(this.#resolvePath(dir), { recursive: true })));
    await this.#writeJsonIfMissing("schema.json", {
      schemaVersion: SCHEMA_VERSION,
      createdAt: nowIso(),
      store: "cloudagent-local",
    });
    await this.#writeJsonIfMissing("settings.json", {
      schemaVersion: SCHEMA_VERSION,
      userId: LOCAL_USER_ID,
      email: "local@cloudagent",
      name: "Local User",
      settings: "{}",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    return this;
  }

  async getSettings() {
    return this.#readJson("settings.json");
  }

  async updateSettings(patch = {}) {
    const existing = await this.getSettings();
    const next = {
      ...(existing || {}),
      ...patch,
      schemaVersion: SCHEMA_VERSION,
      userId: LOCAL_USER_ID,
      updatedAt: nowIso(),
    };
    await this.#writeJson("settings.json", next);
    return next;
  }

  async listPermissionProfiles() {
    return this.#listRecords("permission-profiles");
  }

  async getPermissionProfile(recordId) {
    return this.#readRecord("permission-profiles", recordId);
  }

  async createPermissionProfile(input) {
    const record = normalizePermissionProfile(input);
    const existing = await this.getPermissionProfile(record.recordId);
    if (existing) throw conflictError(`Permission profile already exists: ${record.recordId}`);
    await this.#writeRecord("permission-profiles", record.recordId, record);
    return record;
  }

  async updatePermissionProfile(recordId, patch) {
    const existing = await this.getPermissionProfile(recordId);
    if (!existing) return null;
    const record = normalizePermissionProfile({ ...patch, recordId }, existing);
    await this.#writeRecord("permission-profiles", record.recordId, record);
    return record;
  }

  async deletePermissionProfile(recordId) {
    return this.#deleteRecord("permission-profiles", recordId);
  }

  async listWorkloads() {
    return this.#listRecords("workloads");
  }

  async getWorkload(workloadId) {
    return this.#readRecord("workloads", workloadId);
  }

  async createWorkload(input) {
    const record = normalizeWorkload(input);
    const existing = await this.getWorkload(record.workloadId);
    if (existing) throw conflictError(`Workload already exists: ${record.workloadId}`);
    await this.#writeRecord("workloads", record.workloadId, record);
    return record;
  }

  async updateWorkload(workloadId, patch) {
    const existing = await this.getWorkload(workloadId);
    if (!existing) return null;
    const record = normalizeWorkload({ ...patch, workloadId }, existing);
    await this.#writeRecord("workloads", record.workloadId, record);
    return record;
  }

  async deleteWorkload(workloadId) {
    return this.#deleteRecord("workloads", workloadId);
  }

  async listWorkflowDefinitions() {
    return this.#listRecords("workflows");
  }

  async getWorkflowDefinition(workflowId) {
    return this.#readRecord("workflows", workflowId);
  }

  async createWorkflowDefinition(input) {
    const record = normalizeWorkflowDefinition(input);
    const existing = await this.getWorkflowDefinition(record.workflowId);
    if (existing) throw conflictError(`Workflow already exists: ${record.workflowId}`);
    await this.#writeRecord("workflows", record.workflowId, record);
    return record;
  }

  async updateWorkflowDefinition(workflowId, patch) {
    const existing = await this.getWorkflowDefinition(workflowId);
    if (!existing) return null;
    const record = normalizeWorkflowDefinition({ ...patch, workflowId }, existing);
    await this.#writeRecord("workflows", record.workflowId, record);
    return record;
  }

  async deleteWorkflowDefinition(workflowId) {
    return this.#deleteRecord("workflows", workflowId);
  }

  async getWorkflowScheduleState(workflowId) {
    return this.#readRecord("scheduler/workflows", workflowId);
  }

  async listWorkflowScheduleStates() {
    return this.#listRecords("scheduler/workflows");
  }

  async updateWorkflowScheduleState(workflowId, patch = {}) {
    const existing = await this.getWorkflowScheduleState(workflowId);
    const timestamp = nowIso();
    const record = {
      ...(existing || {}),
      ...patch,
      schemaVersion: SCHEMA_VERSION,
      userId: LOCAL_USER_ID,
      workflowId,
      createdAt: existing?.createdAt || patch.createdAt || timestamp,
      updatedAt: timestamp,
    };
    await this.#writeRecord("scheduler/workflows", workflowId, record);
    return record;
  }

  async listWorkflowRuns() {
    return this.#listRecords("workflow-runs");
  }

  async getWorkflowRun(workflowRunId) {
    return this.#readRecord("workflow-runs", workflowRunId);
  }

  async createWorkflowRun(input) {
    const record = normalizeWorkflowRun(input);
    const existing = await this.getWorkflowRun(record.workflowRunId);
    if (existing) throw conflictError(`Workflow run already exists: ${record.workflowRunId}`);
    await this.#writeRecord("workflow-runs", record.workflowRunId, record);
    return record;
  }

  async updateWorkflowRun(workflowRunId, patch) {
    const existing = await this.getWorkflowRun(workflowRunId);
    if (!existing) return null;
    const record = normalizeWorkflowRun({ ...patch, workflowRunId }, existing);
    await this.#writeRecord("workflow-runs", record.workflowRunId, record);
    return record;
  }

  async listSkills() {
    const records = await this.#listRecords("skills");
    return records.map((record) => stripSkillBillingFields(record));
  }

  async getSkill(recordId) {
    const record = await this.#readRecord("skills", recordId);
    return stripSkillBillingFields(record);
  }

  async createSkill(input) {
    const record = normalizeSkill(input);
    const existing = await this.getSkill(record.recordId);
    if (existing) throw conflictError(`Skill already exists: ${record.recordId}`);
    await this.#writeRecord("skills", record.recordId, record);
    return record;
  }

  async updateSkill(recordId, patch) {
    const existing = await this.getSkill(recordId);
    if (!existing) return null;
    const record = normalizeSkill({ ...patch, recordId }, existing);
    await this.#writeRecord("skills", record.recordId, record);
    return record;
  }

  async deleteSkill(recordId) {
    return this.#deleteRecord("skills", recordId);
  }

  async listBlueprints() {
    return this.listSkills();
  }

  async getBlueprint(recordId) {
    return this.getSkill(recordId);
  }

  async createBlueprint(input) {
    return this.createSkill(input);
  }

  async updateBlueprint(recordId, patch) {
    return this.updateSkill(recordId, patch);
  }

  async deleteBlueprint(recordId) {
    return this.deleteSkill(recordId);
  }

  async listChatRecords() {
    return this.#listRecords("chat-records");
  }

  async getChatRecord(recordId) {
    return this.#readRecord("chat-records", recordId);
  }

  async upsertChatRecord(input = {}) {
    const existing = input.recordId ? await this.getChatRecord(input.recordId) : null;
    const record = normalizeChatRecord(input, existing);
    await this.#writeRecord("chat-records", record.recordId, record);
    return record;
  }

  async appendChatMessages(recordId, messages = [], { metadata } = {}) {
    const existing = await this.getChatRecord(recordId);
    if (!existing) return null;
    const incoming = Array.isArray(messages) ? messages : [];
    const record = normalizeChatRecord({
      ...existing,
      recordId,
      messages: [
        ...(Array.isArray(existing.messages) ? existing.messages : []),
        ...incoming.map((message) => normalizeChatMessageEntry(message)),
      ],
      ...(metadata !== undefined ? { metadata } : {}),
    }, existing);
    await this.#writeRecord("chat-records", record.recordId, record);
    return record;
  }

  async listAgentHistory() {
    return this.#listRecords("agent-history");
  }

  async getAgentHistoryRecord(recordId) {
    return this.#readRecord("agent-history", recordId);
  }

  async createAgentHistoryRecord(input) {
    const record = normalizeAgentHistoryRecord(input);
    const existing = await this.getAgentHistoryRecord(record.recordId);
    if (existing) throw conflictError(`Agent run already exists: ${record.recordId}`);
    await this.#writeRecord("agent-history", record.recordId, record);
    return record;
  }

  async updateAgentHistoryRecord(recordId, patch) {
    const existing = await this.getAgentHistoryRecord(recordId);
    if (!existing) return null;
    const record = normalizeAgentHistoryRecord({ ...patch, recordId }, existing);
    await this.#writeRecord("agent-history", record.recordId, record);
    return record;
  }

  async getAgentRunEventsRecord(recordId) {
    return this.#readRecord("agent-run-events", recordId);
  }

  async listAgentRunEvents(recordId, { afterSeq = 0, limit = 1000 } = {}) {
    const record = await this.getAgentRunEventsRecord(recordId);
    const minSeq = Number.isFinite(Number(afterSeq)) ? Number(afterSeq) : 0;
    const max = Math.max(1, Math.min(5000, Number.isFinite(Number(limit)) ? Number(limit) : 1000));
    const events = Array.isArray(record?.events)
      ? record.events.filter((event) => Number(event?.seq || 0) > minSeq).slice(0, max)
      : [];
    return {
      recordId,
      events,
      count: events.length,
      nextSeq: record?.nextSeq || (Array.isArray(record?.events) ? record.events.length + 1 : 1),
      lastSeq: Array.isArray(record?.events) && record.events.length > 0
        ? Number(record.events[record.events.length - 1]?.seq || 0)
        : 0,
      updatedAt: record?.updatedAt || null,
    };
  }

  async appendAgentRunEvent(recordId, event = {}) {
    const normalizedRecordId = String(recordId || event?.runId || event?.payload?.recordId || "").trim();
    if (!normalizedRecordId) throw new Error("recordId is required");

    const previous = this.#agentRunEventWriteQueues.get(normalizedRecordId) || Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      const timestamp = nowIso();
      const existing = await this.getAgentRunEventsRecord(normalizedRecordId);
      const events = Array.isArray(existing?.events) ? existing.events : [];
      const seq = Math.max(1, Number(existing?.nextSeq || events.length + 1) || 1);
      const storedEvent = {
        ...event,
        runId: event?.runId || normalizedRecordId,
        seq,
        recordId: event?.recordId || normalizedRecordId,
        persistedAt: timestamp,
      };
      const recordEvents = [...events, storedEvent].slice(-AGENT_RUN_EVENT_LIMIT);
      const record = {
        schemaVersion: SCHEMA_VERSION,
        userId: LOCAL_USER_ID,
        recordId: normalizedRecordId,
        createdAt: existing?.createdAt || timestamp,
        updatedAt: timestamp,
        nextSeq: seq + 1,
        events: recordEvents,
      };
      await this.#writeRecord("agent-run-events", normalizedRecordId, record);
      return storedEvent;
    });

    this.#agentRunEventWriteQueues.set(normalizedRecordId, operation);
    try {
      return await operation;
    } finally {
      if (this.#agentRunEventWriteQueues.get(normalizedRecordId) === operation) {
        this.#agentRunEventWriteQueues.delete(normalizedRecordId);
      }
    }
  }

  async createScannerRun(input) {
    const record = normalizeScannerRun(input);
    const existing = await this.getScannerRun(record.scanId);
    if (existing) throw conflictError(`Scanner run already exists: ${record.scanId}`);
    await this.#writeRecord("scanner-runs", record.scanId, record);
    return record;
  }

  async getScannerRun(scanId) {
    return this.#readRecord("scanner-runs", scanId);
  }

  async listScannerRuns() {
    return this.#listRecords("scanner-runs");
  }

  async updateScannerRun(scanId, patch = {}) {
    const existing = await this.getScannerRun(scanId);
    if (!existing) return null;
    const record = normalizeScannerRun({ ...patch, scanId }, existing);
    await this.#writeRecord("scanner-runs", record.scanId, record);
    return record;
  }

  async writeScannerArtifact(kind, scopeId, scanId, payload = {}) {
    const config = normalizeArtifactKind(kind);
    const safeScopeId = sanitizePathSegment(scopeId);
    const safeScanId = sanitizePathSegment(scanId);
    const generatedAt =
      payload?.analysis?.[config.analysisKey]?.generatedAt ||
      payload?.generatedAt ||
      nowIso();
    const fileName =
      payload?.analysis?.[config.analysisKey]?.fileName ||
      `${safeScopeId}_${formatArtifactTimestamp(generatedAt)}.json`;
    const relativePath = path.join(config.dir, safeScopeId, `${safeScanId}.json`);
    const objectKey = `${config.dir.replace(/^artifacts\//, "")}/${LOCAL_USER_ID}/${safeScopeId}/${fileName}`;
    const metadata = {
      bucket: "local-files",
      fileName,
      objectKey,
      path: `local://${objectKey}`,
      generatedAt,
      scanId,
    };
    const nextPayload = {
      ...payload,
      generatedAt: payload?.generatedAt || generatedAt,
      analysis: {
        ...(payload?.analysis && typeof payload.analysis === "object" ? payload.analysis : {}),
        [config.analysisKey]: {
          ...(payload?.analysis?.[config.analysisKey] &&
          typeof payload.analysis[config.analysisKey] === "object"
            ? payload.analysis[config.analysisKey]
            : {}),
          ...metadata,
        },
      },
    };
    await this.#writeJson(relativePath, nextPayload);
    return {
      kind: config.kind,
      scopeId,
      scanId,
      fileName,
      objectKey,
      path: relativePath,
      generatedAt,
      payload: nextPayload,
      metadata,
    };
  }

  async readScannerArtifact(kind, scopeId, scanId) {
    const config = normalizeArtifactKind(kind);
    const relativePath = path.join(
      config.dir,
      sanitizePathSegment(scopeId),
      `${sanitizePathSegment(scanId)}.json`
    );
    try {
      return await this.#readJson(relativePath);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async readLatestScannerArtifact(kind, scopeId) {
    const config = normalizeArtifactKind(kind);
    const scopeDir = this.#resolvePath(config.dir, sanitizePathSegment(scopeId));
    let entries;
    try {
      entries = await fs.readdir(scopeDir, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }

    const artifacts = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      try {
        artifacts.push(await this.#readJson(path.join(config.dir, sanitizePathSegment(scopeId), entry.name)));
      } catch (error) {
        console.warn("[local-store] skipping unreadable scanner artifact", {
          kind: config.kind,
          scopeId,
          file: entry.name,
          error: error?.message,
        });
      }
    }
    const sortedArtifacts = artifacts.sort((a, b) => {
      const left = String(b?.analysis?.[config.analysisKey]?.generatedAt || b?.generatedAt || b?.updatedAt || "");
      const right = String(a?.analysis?.[config.analysisKey]?.generatedAt || a?.generatedAt || a?.updatedAt || "");
      return left.localeCompare(right);
    });
    if (config.kind === "cost") {
      return sortedArtifacts.find((artifact) => hasCostSpendRows(artifact)) || sortedArtifacts[0] || null;
    }
    return sortedArtifacts[0] || null;
  }

  async listScannerArtifacts(kind = null, scopeId = null) {
    const configs = kind
      ? [normalizeArtifactKind(kind)]
      : ["inventory", "health", "cost", "threat"].map((entry) => normalizeArtifactKind(entry));
    const artifacts = [];

    for (const config of configs) {
      const baseDir = this.#resolvePath(config.dir);
      let scopeEntries;
      try {
        scopeEntries = await fs.readdir(baseDir, { withFileTypes: true });
      } catch (error) {
        if (error?.code === "ENOENT") continue;
        throw error;
      }

      for (const scopeEntry of scopeEntries) {
        if (!scopeEntry.isDirectory()) continue;
        const currentScopeId = scopeEntry.name;
        if (scopeId && currentScopeId !== sanitizePathSegment(scopeId)) continue;
        const artifactDir = this.#resolvePath(config.dir, currentScopeId);
        let entries;
        try {
          entries = await fs.readdir(artifactDir, { withFileTypes: true });
        } catch (error) {
          if (error?.code === "ENOENT") continue;
          throw error;
        }
        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
          const scanId = entry.name.replace(/\.json$/i, "");
          try {
            const payload = await this.#readJson(path.join(config.dir, currentScopeId, entry.name));
            const analysis = payload?.analysis?.[config.analysisKey] || {};
            artifacts.push({
              kind: config.kind,
              scopeId: currentScopeId,
              scanId: analysis.scanId || payload?.scanId || scanId,
              fileName: analysis.fileName || entry.name,
              objectKey: analysis.objectKey || null,
              path: analysis.path || null,
              localStorePath: path.join(config.dir, currentScopeId, entry.name),
              generatedAt: analysis.generatedAt || payload?.generatedAt || payload?.updatedAt || null,
              summary: payload?.summary || analysis.summary || null,
            });
          } catch (error) {
            console.warn("[local-store] skipping unreadable scanner artifact", {
              kind: config.kind,
              scopeId: currentScopeId,
              fileName: entry.name,
              message: error?.message || String(error),
            });
          }
        }
      }
    }

    return artifacts.sort((a, b) => String(b.generatedAt || "").localeCompare(String(a.generatedAt || "")));
  }

  async updatePermissionProfileAnalysis(permissionProfileId, analysisPatch = {}) {
    const existing = await this.getPermissionProfile(permissionProfileId);
    if (!existing) return null;
    const summary = mergeSummaryAnalysis(existing.summary, analysisPatch);
    return this.updatePermissionProfile(permissionProfileId, { summary });
  }

  async updateWorkloadAnalysis(workloadId, analysisPatch = {}) {
    const existing = await this.getWorkload(workloadId);
    if (!existing) return null;
    const summary = mergeSummaryAnalysis(existing.summary, analysisPatch);
    return this.updateWorkload(workloadId, { summary });
  }

  async getDiagramSpec(workloadId) {
    const record = await this.#readRecord("artifacts/diagrams", workloadId);
    return record?.spec || null;
  }

  async saveDiagramSpec(workloadId, spec, metadata = {}) {
    const existing = await this.#readRecord("artifacts/diagrams", workloadId);
    const timestamp = nowIso();
    const record = {
      ...(existing || {}),
      schemaVersion: SCHEMA_VERSION,
      userId: LOCAL_USER_ID,
      workloadId,
      key: `${fileNameForId(workloadId)}`,
      spec,
      metadata: normalizeJsonObject(metadata, {}),
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
    };
    await this.#writeRecord("artifacts/diagrams", workloadId, record);
    return record;
  }

  async persistEnvironmentSummary(recordId, summary) {
    const existing = await this.getPermissionProfile(recordId);
    if (!existing) return null;
    const updated = await this.updatePermissionProfile(recordId, { summary });
    await this.#writeRecord("summaries/environments", recordId, {
      schemaVersion: SCHEMA_VERSION,
      userId: LOCAL_USER_ID,
      recordId,
      summary,
      createdAt: summary.updatedAt,
      updatedAt: summary.updatedAt,
    });
    return updated;
  }

  async getEnvironmentSummary(recordId) {
    return this.#readRecord("summaries/environments", recordId);
  }

  async getWorkloadSummary(workloadId) {
    return this.#readRecord("summaries/workloads", workloadId);
  }

  async listExecutiveSummaries() {
    const [environmentSummaries, workloadSummaries] = await Promise.all([
      this.#listRecords("summaries/environments"),
      this.#listRecords("summaries/workloads"),
    ]);
    return [
      ...environmentSummaries.map((record) => ({
        ...record,
        type: "environment",
        id: record.recordId,
        targetType: "permissionProfile",
        targetId: record.recordId,
        localStorePath: `summaries/environments/${fileNameForId(record.recordId)}`,
      })),
      ...workloadSummaries.map((record) => ({
        ...record,
        type: "workload",
        id: record.workloadId,
        targetType: "workload",
        targetId: record.workloadId,
        localStorePath: `summaries/workloads/${fileNameForId(record.workloadId)}`,
      })),
    ].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  }

  async persistWorkloadSummary(workloadId, summary) {
    const existing = await this.getWorkload(workloadId);
    if (!existing) return null;
    const updated = await this.updateWorkload(workloadId, { summary });
    await this.#writeRecord("summaries/workloads", workloadId, {
      schemaVersion: SCHEMA_VERSION,
      userId: LOCAL_USER_ID,
      workloadId,
      summary,
      createdAt: summary.updatedAt,
      updatedAt: summary.updatedAt,
    });
    return updated;
  }

  async #writeJsonIfMissing(relativePath, value) {
    try {
      await this.#readJson(relativePath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await this.#writeJson(relativePath, value);
    }
  }

  async #listRecords(dir) {
    const absoluteDir = this.#resolvePath(dir);
    let entries;
    try {
      entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }

    const records = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      try {
        records.push(await this.#readJson(path.join(dir, entry.name)));
      } catch (error) {
        console.warn("[local-store] skipping unreadable record", { dir, file: entry.name, error: error?.message });
      }
    }
    return records.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  }

  async #readRecord(dir, id) {
    try {
      return await this.#readJson(path.join(dir, fileNameForId(id)));
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async #writeRecord(dir, id, value) {
    return this.#writeJson(path.join(dir, fileNameForId(id)), value);
  }

  async #deleteRecord(dir, id) {
    const filePath = this.#resolvePath(dir, fileNameForId(id));
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if (error?.code === "ENOENT") return false;
      throw error;
    }
  }

  async #readJson(relativePath) {
    const text = await fs.readFile(this.#resolvePath(relativePath), "utf8");
    return JSON.parse(text);
  }

  async #writeJson(relativePath, value) {
    const filePath = this.#resolvePath(relativePath);
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`);
    const handle = await fs.open(tempPath, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }

    await fs.rename(tempPath, filePath);
    try {
      const dirHandle = await fs.open(dir, "r");
      try {
        await dirHandle.sync();
      } finally {
        await dirHandle.close();
      }
    } catch (error) {
      if (!["EINVAL", "EISDIR", "EPERM"].includes(error?.code)) throw error;
    }
  }
}

export const DEFAULT_AUTH = Object.freeze({
  userId: LOCAL_USER_ID,
  mode: "local",
});
