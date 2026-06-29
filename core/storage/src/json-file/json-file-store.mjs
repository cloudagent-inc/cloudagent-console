import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const SCHEMA_VERSION = 1;
const LOCAL_USER_ID = "local-user";

const STORE_DIRS = [
  "permission-profiles",
  "workloads",
  "workflows",
  "workflow-runs",
  "blueprints",
  "agent-history",
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

function normalizeBlueprintDescription(value, fallback = []) {
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

function stripBlueprintRunnerFields(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { executionMode: _executionMode, runner: _runner, ...rest } = value;
  return rest;
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

function safeTrim(value) {
  return value == null ? "" : String(value).trim();
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
  return raw.replace(/[^A-Za-z0-9._@+=,-]/g, "_");
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

export function normalizeBlueprint(input = {}, existing = null) {
  const timestamp = nowIso();
  const {
    executionMode: _inputExecutionMode,
    runner: _inputRunner,
    ...inputWithoutRunner
  } = input || {};
  const existingWithoutRunner = existing ? stripBlueprintRunnerFields(existing) : null;
  const recordId = safeTrim(input.recordId || input.blueprintId || input.id || existing?.recordId) || createId("blueprint");
  const planValue = stripBlueprintRunnerFields(parseJsonValue(input.plan ?? existing?.plan, {}) || {});
  const createdAt = existing?.createdAt || input.createdAt || timestamp;
  const title =
    safeTrim(input.title ?? input.planTitle ?? planValue?.title ?? planValue?.planTitle ?? existing?.title) ||
    "Untitled Blueprint";
  const cloudProvider =
    safeTrim(input.cloudProvider ?? planValue?.cloudProvider ?? existing?.cloudProvider) || "aws";

  return {
    ...(existingWithoutRunner || {}),
    ...inputWithoutRunner,
    schemaVersion: SCHEMA_VERSION,
    userId: LOCAL_USER_ID,
    recordId,
    title,
    description: normalizeBlueprintDescription(input.description ?? existing?.description, []),
    credits: Number(input.credits ?? existing?.credits ?? planValue?.credits ?? 1) || 1,
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

export class LocalJsonFileStore {
  constructor({ dataDir } = {}) {
    this.dataDir = path.resolve(dataDir || process.env.CLOUDAGENT_LOCAL_DATA_DIR || defaultLocalDataDir());
  }

  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await Promise.all(STORE_DIRS.map((dir) => fs.mkdir(path.join(this.dataDir, dir), { recursive: true })));
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

  async listBlueprints() {
    return this.#listRecords("blueprints");
  }

  async getBlueprint(recordId) {
    return this.#readRecord("blueprints", recordId);
  }

  async createBlueprint(input) {
    const record = normalizeBlueprint(input);
    const existing = await this.getBlueprint(record.recordId);
    if (existing) throw conflictError(`Blueprint already exists: ${record.recordId}`);
    await this.#writeRecord("blueprints", record.recordId, record);
    return record;
  }

  async updateBlueprint(recordId, patch) {
    const existing = await this.getBlueprint(recordId);
    if (!existing) return null;
    const record = normalizeBlueprint({ ...patch, recordId }, existing);
    await this.#writeRecord("blueprints", record.recordId, record);
    return record;
  }

  async deleteBlueprint(recordId) {
    return this.#deleteRecord("blueprints", recordId);
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
    const scopeDir = path.join(this.dataDir, config.dir, sanitizePathSegment(scopeId));
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
    return artifacts.sort((a, b) => {
      const left = String(b?.analysis?.[config.analysisKey]?.generatedAt || b?.generatedAt || b?.updatedAt || "");
      const right = String(a?.analysis?.[config.analysisKey]?.generatedAt || a?.generatedAt || a?.updatedAt || "");
      return left.localeCompare(right);
    })[0] || null;
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
    const absoluteDir = path.join(this.dataDir, dir);
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
    const filePath = path.join(this.dataDir, dir, fileNameForId(id));
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if (error?.code === "ENOENT") return false;
      throw error;
    }
  }

  async #readJson(relativePath) {
    const text = await fs.readFile(path.join(this.dataDir, relativePath), "utf8");
    return JSON.parse(text);
  }

  async #writeJson(relativePath, value) {
    const filePath = path.join(this.dataDir, relativePath);
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

export const LOCAL_AUTH = Object.freeze({
  userId: LOCAL_USER_ID,
  mode: "local",
});
