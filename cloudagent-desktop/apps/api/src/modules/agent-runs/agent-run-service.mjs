import fs from "node:fs/promises";
import path from "node:path";
import { AGENT_RUN_EVENT_TYPES, codingAgentRunnerLabel, createAgentMessageEvent, createAgentRunEvent, createAgentRunStatusEvent, createAgentTaskEvent, getCodingAgentRunnerDefinition, normalizeAgentRawStreamChunk, normalizeCodingAgentRunner } from "@cloudagent/agent-runtime";
import globals from "@cloudagent/platform/global-variables";
import { resolveSkillExecutionContext } from "@cloudagent/skills/execution-context";
import { runSkillPreflight } from "@cloudagent/skills/preflight";
import { DEFAULT_AUTH, parseStoredJsonValue, parseStoredObject } from "@cloudagent/storage";
import { generateLocalAgentRunSummaryWithOpenAI, isLocalOpenAIConfigured } from "../../platform/openai.mjs";
import { createCloudAgentTools } from "../cloudagent/cloudagent-tools.mjs";
import { resumeLocalExternalAgentBlueprint, runLocalExternalAgentBlueprint } from "../skills/codex-runner.mjs";
import { appendQueryParams, compactLocalJson, filterByDateWindow, firstLocalNonEmpty, localAuthSummary, paginateLocalItems, sortLocalItems, uniqueLocalStrings } from "../../lib/http.mjs";
import { getLocalCodexSettings } from "../settings/settings-service.mjs";
import { buildRuntimeExternalAgentSkillFilesForRun } from "../skills/skill-service.mjs";

export const EXTERNAL_AGENT_RUN_TASK_ID = "external_agent_run";
export function createAgentRunLog({ title, status = "complete", blueprintId = null, summary = null } = {}) {
  const now = new Date().toISOString();
  const finalSummary =
    summary ||
    `Local mode recorded a run for "${title || blueprintId || "agent"}". Full local agent execution is not implemented yet.`;
  return {
    logs: [
      {
        taskId: "local_run_recorded",
        status,
        output: finalSummary,
        task_output: finalSummary,
        timestamp: now,
      },
    ],
    currentPhase: 0,
    currentTask: 0,
    lastUpdated: now,
    blueprintId,
    runSummary: {
      summary: finalSummary,
      finalSummary,
      generatedAt: now,
      status,
    },
  };
}

export async function listAgentHistoryForQuery(store, query = {}) {
  const includeReports = query.includeReports === true || query.includeReports === "true";
  const agentType = query.agentType ? String(query.agentType) : null;
  const filtered = filterByDateWindow(
    (await store.listAgentHistory()).filter((item) => {
      if (agentType && item?.agentType !== agentType) return false;
      if (!includeReports && ["report", "assessment"].includes(String(item?.agentType || "").toLowerCase())) return false;
      return true;
    }),
    { startDate: query.startDate, endDate: query.endDate }
  );
  return paginateLocalItems(
    sortLocalItems(filtered, query.sortBy || "updatedAt", query.sortOrder || "desc"),
    query
  );
}

export const localAgentRunEventSubscribers = new Map();

export function sendAgentChunk(res, payload) {
  if (!res || res.destroyed || res.writableEnded) return false;
  try {
    res.write(`<<CHUNK_START>>${JSON.stringify(payload)}<<CHUNK_END>>`);
    return true;
  } catch (error) {
    console.warn("[local /agent] failed to write stream chunk", {
      type: payload?.type || null,
      error: error?.message || String(error),
    });
    return false;
  }
}

export function getAgentEventRecordId(event, fallbackRecordId = null) {
  return (
    event?.runId ||
    event?.recordId ||
    event?.payload?.recordId ||
    fallbackRecordId ||
    null
  );
}

export function publishAgentRunEvent(recordId, event) {
  const runId = String(recordId || "").trim();
  if (!runId || !event) return;
  const subscribers = localAgentRunEventSubscribers.get(runId);
  if (!subscribers || subscribers.size === 0) return;
  for (const subscriber of subscribers) {
    try {
      subscriber(event);
    } catch (error) {
      console.warn("[local /agent] failed to publish run event", {
        recordId: runId,
        error: error?.message || String(error),
      });
    }
  }
}

export async function persistAgentRunEvent({ store, event, recordId = null } = {}) {
  if (!store || !event) return null;
  const runId = getAgentEventRecordId(event, recordId);
  if (!runId) return null;
  const storedEvent = await store.appendAgentRunEvent(runId, event);
  publishAgentRunEvent(runId, storedEvent);
  return storedEvent;
}

export function createAgentRunEventRecorder({ store, recordId = null } = {}) {
  return (event) => {
    if (!event) return;
    persistAgentRunEvent({ store, event, recordId }).catch((error) => {
      console.warn("[local /agent] failed to persist run event", {
        recordId: getAgentEventRecordId(event, recordId),
        eventType: event?.type || null,
        error: error?.message || String(error),
      });
    });
  };
}

export function attachAgentRunEventRecorder(res, { store, recordId = null } = {}) {
  if (!res?.locals) return null;
  const recorder = createAgentRunEventRecorder({ store, recordId });
  res.locals.agentRunEventRecorder = recorder;
  return recorder;
}

export function sendAgentEventChunk(res, event) {
  if (!event) return;
  res?.locals?.agentRunEventRecorder?.(event);
  sendAgentChunk(res, { type: "agent_event", event });
}

export function getLocalAgentRunId({ recordId = null, sessionId = null, req = null } = {}) {
  return (
    recordId ||
    req?.body?.recordId ||
    req?.body?.agentRunId ||
    req?.body?.sessionId ||
    sessionId ||
    null
  );
}

export function getLocalTaskId(task = null, fallback = null) {
  return task?.id || task?.task_id || fallback || null;
}

export function sendAgentMessageEvent(res, {
  text = "",
  completed = false,
  recordId = null,
  req = null,
  runner = "cloudagent",
  task = null,
  phaseIndex = null,
  taskIndex = null,
  raw = null,
} = {}) {
  if (!String(text || "")) return;
  sendAgentEventChunk(res, createAgentMessageEvent({
    runId: getLocalAgentRunId({ recordId, req }),
    runner,
    text,
    completed,
    taskId: getLocalTaskId(task),
    phaseIndex,
    taskIndex,
    raw,
  }));
}

export function sendAgentTaskStatusEvent(res, {
  status = "running",
  output = "",
  summary = "",
  runSummary = null,
  recordId = null,
  req = null,
  runner = "cloudagent",
  task = null,
  taskId = null,
  phaseIndex = null,
  taskIndex = null,
  raw = null,
} = {}) {
  const resolvedTaskId = getLocalTaskId(task, taskId);
  sendAgentEventChunk(res, createAgentTaskEvent({
    runId: getLocalAgentRunId({ recordId, req }),
    runner,
    taskId: resolvedTaskId,
    phaseIndex,
    taskIndex,
    status,
    output,
    summary: summary || output,
    runSummary,
    payload: {
      task_id: resolvedTaskId,
      taskTitle: task?.title || task?.name || null,
      task_output_summary_message: output || summary,
    },
    raw,
  }));
}

export function sendAgentRunStatus(res, {
  status = "running",
  completed = false,
  summary = "",
  runSummary = null,
  recordId = null,
  req = null,
  runner = "cloudagent",
  raw = null,
} = {}) {
  sendAgentEventChunk(res, createAgentRunStatusEvent({
    runId: getLocalAgentRunId({ recordId, req }),
    runner,
    completed,
    status,
    summary,
    runSummary,
    recordId,
    raw,
  }));
}

export function sendNormalizedAgentRawEvents(res, chunk, {
  recordId = null,
  req = null,
  runner = "cloudagent",
  task = null,
  phaseIndex = null,
  taskIndex = null,
} = {}) {
  const events = normalizeAgentRawStreamChunk(chunk, {
    runId: getLocalAgentRunId({ recordId, req }),
    runner,
    taskId: getLocalTaskId(task),
    phaseIndex,
    taskIndex,
  });
  for (const event of events) {
    if (event?.type === AGENT_RUN_EVENT_TYPES.RAW && event?.payload?.render === false) continue;
    sendAgentEventChunk(res, event);
  }
}

export function recordNormalizedAgentRawEvents(recordEvent, chunk, {
  recordId = null,
  req = null,
  runner = "cloudagent",
  task = null,
  phaseIndex = null,
  taskIndex = null,
} = {}) {
  if (typeof recordEvent !== "function") return;
  const events = normalizeAgentRawStreamChunk(chunk, {
    runId: getLocalAgentRunId({ recordId, req }),
    runner,
    taskId: getLocalTaskId(task),
    phaseIndex,
    taskIndex,
  });
  for (const event of events) {
    if (event?.type === AGENT_RUN_EVENT_TYPES.RAW && event?.payload?.render === false) continue;
    recordEvent(event);
  }
}

export function recordAgentMessageEvent(recordEvent, {
  text = "",
  completed = false,
  recordId = null,
  req = null,
  runner = "cloudagent",
  task = null,
  phaseIndex = null,
  taskIndex = null,
  raw = null,
} = {}) {
  if (typeof recordEvent !== "function" || !String(text || "")) return;
  recordEvent(createAgentMessageEvent({
    runId: getLocalAgentRunId({ recordId, req }),
    runner,
    text,
    completed,
    taskId: getLocalTaskId(task),
    phaseIndex,
    taskIndex,
    raw,
  }));
}

export function recordAgentTaskStatusEvent(recordEvent, {
  status = "running",
  output = "",
  summary = "",
  runSummary = null,
  recordId = null,
  req = null,
  runner = "cloudagent",
  task = null,
  taskId = null,
  phaseIndex = null,
  taskIndex = null,
  raw = null,
} = {}) {
  if (typeof recordEvent !== "function") return;
  const resolvedTaskId = getLocalTaskId(task, taskId);
  recordEvent(createAgentTaskEvent({
    runId: getLocalAgentRunId({ recordId, req }),
    runner,
    taskId: resolvedTaskId,
    phaseIndex,
    taskIndex,
    status,
    output,
    summary: summary || output,
    runSummary,
    payload: {
      task_id: resolvedTaskId,
      taskTitle: task?.title || task?.name || null,
      task_output_summary_message: output || summary,
    },
    raw,
  }));
}

export function recordAgentRunStatusEvent(recordEvent, {
  status = "running",
  completed = false,
  summary = "",
  runSummary = null,
  recordId = null,
  req = null,
  runner = "cloudagent",
  raw = null,
} = {}) {
  if (typeof recordEvent !== "function") return;
  recordEvent(createAgentRunStatusEvent({
    runId: getLocalAgentRunId({ recordId, req }),
    runner,
    completed,
    status,
    summary,
    runSummary,
    recordId,
    raw,
  }));
}

export function recordAgentTerminalOutputEvent(recordEvent, {
  command = "",
  output = "",
  source = null,
  recordId = null,
  req = null,
  runner = "cloudagent",
  task = null,
  phaseIndex = null,
  taskIndex = null,
  raw = null,
} = {}) {
  if (typeof recordEvent !== "function" || !String(output || "")) return;
  recordEvent(createAgentRunEvent({
    runId: getLocalAgentRunId({ recordId, req }),
    runner,
    source: source || runner,
    taskId: getLocalTaskId(task),
    phaseIndex,
    taskIndex,
    type: AGENT_RUN_EVENT_TYPES.TERMINAL_OUTPUT,
    payload: {
      command,
      output,
    },
    raw,
  }));
}

export function sendAgentTerminalOutputEvent(res, {
  command = "",
  output = "",
  source = null,
  recordId = null,
  req = null,
  runner = "cloudagent",
  task = null,
  phaseIndex = null,
  taskIndex = null,
  raw = null,
} = {}) {
  if (!String(output || "")) return;
  sendAgentEventChunk(res, createAgentRunEvent({
    runId: getLocalAgentRunId({ recordId, req }),
    runner,
    source: source || runner,
    taskId: getLocalTaskId(task),
    phaseIndex,
    taskIndex,
    type: AGENT_RUN_EVENT_TYPES.TERMINAL_OUTPUT,
    payload: {
      command,
      output,
    },
    raw,
  }));
}

export function summarizeLocalAgentRequest(body = {}) {
  const authProfile = parseStoredObject(body.authProfile, {});
  return {
    recordId: body.recordId || body.agentRunId || null,
    blueprintId: body.blueprintId || body.planId || body.plan?.recordId || null,
    sessionId: body.sessionId || null,
    taskId: body.task?.id || body.task?.task_id || null,
    hasPlanPayload: Boolean(body.plan),
    permissionProfileId: body.permissionProfileId || authProfile.permissionProfileId || authProfile.recordId || authProfile.id || null,
    authType: authProfile.authType || null,
    provider: authProfile.provider || "aws",
    awsProfile: authProfile.awsProfile || authProfile.profileName || authProfile.profile || null,
    awsAccountId: authProfile.awsAccountId || authProfile.accountId || null,
    requestedExecutionMode: body.executionMode || null,
    requestedRunner: body.runner || null,
  };
}

export function buildAgentRuntimeDebug({
  stage,
  requestBody = {},
  blueprint = null,
  planPayload = null,
  executionMode = null,
  agentSettings = null,
  reason = null,
} = {}) {
  return {
    type: "agent_runtime_debug",
    stage,
    requestedExecutionMode: requestBody?.executionMode || null,
    requestedRunner: requestBody?.runner || null,
    blueprintExecutionMode: blueprint?.executionMode || blueprint?.runner || null,
    planExecutionMode: planPayload?.executionMode || planPayload?.runner || null,
    normalizedExecutionMode: executionMode,
    isExternalCodingAgent: isLocalCodingAgentExecutionMode(executionMode),
    agentBinary: agentSettings?.agentBinary || null,
    workspaceDir: agentSettings?.workspaceDir || null,
    reason,
  };
}

export function sendAgentRuntimeDebug(res, debug) {
  console.log("[local /agent] runtime debug", debug);
  if (res) sendAgentChunk(res, debug);
}

export function extractLocalPlanForSummary({ blueprint, planPayload }) {
  const rawPlan = blueprint ? parseStoredJsonValue(blueprint.plan, {}) : planPayload;
  const phases = Array.isArray(rawPlan?.plan)
    ? rawPlan.plan
    : Array.isArray(rawPlan)
      ? rawPlan
      : [];
  const taskCount = phases.reduce(
    (sum, phase) => sum + (Array.isArray(phase?.tasks) ? phase.tasks.length : 0),
    0
  );
  return {
    phases,
    phaseCount: phases.length,
    taskCount,
  };
}

export function findLocalPlanTask({ blueprint, planPayload, taskId }) {
  const { phases } = extractLocalPlanForSummary({ blueprint, planPayload });
  for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex += 1) {
    const phase = phases[phaseIndex] || {};
    const tasks = Array.isArray(phase.tasks) ? phase.tasks : [];
    for (let taskIndex = 0; taskIndex < tasks.length; taskIndex += 1) {
      const task = tasks[taskIndex] || {};
      const id = String(task.id || task.task_id || "").trim();
      if (id && id === String(taskId || "").trim()) {
        return { phase, task, phaseIndex, taskIndex, phases };
      }
    }
  }
  return { phase: null, task: null, phaseIndex: 0, taskIndex: 0, phases };
}

export const CODEX_HISTORY_EVENT_LIMIT = 500;
export const CODEX_HISTORY_STRING_LIMIT = 30_000;
export const CODEX_HISTORY_ARRAY_LIMIT = 120;

export function compactCodexHistoryValue(value, depth = 0) {
  if (value == null) return value;
  if (typeof value === "string") {
    return value.length > CODEX_HISTORY_STRING_LIMIT
      ? `${value.slice(0, CODEX_HISTORY_STRING_LIMIT)}\n...[truncated]`
      : value;
  }
  if (typeof value !== "object") return value;
  if (depth > 8) return "[truncated]";
  if (Array.isArray(value)) {
    const compacted = value
      .slice(0, CODEX_HISTORY_ARRAY_LIMIT)
      .map((entry) => compactCodexHistoryValue(entry, depth + 1));
    if (value.length > CODEX_HISTORY_ARRAY_LIMIT) {
      compacted.push(`...[${value.length - CODEX_HISTORY_ARRAY_LIMIT} more item(s) truncated]`);
    }
    return compacted;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      compactCodexHistoryValue(child, depth + 1),
    ])
  );
}

export function compactCodexHistoryEvents(events = []) {
  if (!Array.isArray(events) || events.length === 0) return [];
  return events
    .slice(-CODEX_HISTORY_EVENT_LIMIT)
    .map((event) => compactCodexHistoryValue(event));
}

export function normalizeBlueprintExecutionMode(...values) {
  for (const value of values) {
    const normalized = normalizeCodingAgentRunner(value);
    if (["codex", "claude", "cursor"].includes(normalized)) return normalized;
    const text = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (["cloudagent", "cloud_agent", "default"].includes(text)) return "cloudagent";
  }
  return "cloudagent";
}

export function isLocalCodingAgentExecutionMode(value) {
  return ["codex", "claude", "cursor"].includes(value);
}

export function inferStoredCodingAgentRunner(record = {}, storedLog = {}) {
  const logs = Array.isArray(storedLog?.logs) ? storedLog.logs : [];
  const candidates = [
    record?.runner,
    record?.executionMode,
    storedLog?.runner,
    storedLog?.executionMode,
    storedLog?.codexRun?.runner,
    ...logs.slice().reverse().flatMap((entry) => [
      entry?.runner,
      entry?.executionMode,
      entry?.codex?.runner,
    ]),
  ];
  for (const candidate of candidates) {
    const normalized = normalizeCodingAgentRunner(candidate);
    if (isLocalCodingAgentExecutionMode(normalized)) return normalized;
  }
  return "codex";
}

export function getLocalCodingAgentSettings(codexSettings = {}, executionMode = "codex") {
  const definition = getCodingAgentRunnerDefinition(executionMode);
  const getPathValue = (value, pathParts = []) => {
    let current = value;
    for (const part of pathParts) {
      if (!current || typeof current !== "object") return null;
      current = current[part];
    }
    return current || null;
  };
  if (definition) {
    return {
      workspaceDir:
        getPathValue(codexSettings, definition.workspaceSettingPath) ||
        codexSettings.workspaceDir ||
        null,
      agentBinary: getPathValue(codexSettings, definition.binarySettingPath),
    };
  }
  return {
    workspaceDir: codexSettings.workspaceDir || null,
    agentBinary: codexSettings.binary || null,
  };
}

export function getBlueprintExecutionMode(blueprint, planPayload = null, requestBody = {}) {
  return normalizeBlueprintExecutionMode(
    requestBody?.executionMode,
    requestBody?.runner,
    planPayload?.executionMode,
    planPayload?.runner,
    blueprint?.executionMode,
    blueprint?.runner
  );
}

export function buildLocalMcpUrl(
  req,
  {
    recordId = null,
    runner = null,
    authProfile = null,
    regions = [],
    executionContext = null,
    preflightResult = null,
    permissionProfileId = null,
    accountId = null,
    region = null,
  } = {}
) {
  const configured = process.env.CLOUDAGENT_LOCAL_MCP_URL || process.env.CLOUDAGENT_MCP_URL;
  const authSummary = authProfile && typeof authProfile === "object" ? localAuthSummary(authProfile) : {};
  const context = executionContext || preflightResult?.executionContext || {};
  const target = context?.target && typeof context.target === "object" ? context.target : {};
  const environment = context?.environment && typeof context.environment === "object" ? context.environment : {};
  const environmentAuth =
    environment?.authProfile && typeof environment.authProfile === "object"
      ? environment.authProfile
      : {};
  const rewriteConfig =
    preflightResult?.rewriteConfig && typeof preflightResult.rewriteConfig === "object"
      ? preflightResult.rewriteConfig
      : {};
  const selectedPermissionProfileId = firstLocalNonEmpty(
    permissionProfileId,
    authSummary.permissionProfileId,
    rewriteConfig.permissionProfileId,
    target.permissionProfileId,
    environment.permissionProfileId,
    environmentAuth.permissionProfileId,
    environmentAuth.recordId,
    environmentAuth.id
  );
  const selectedAccountId = firstLocalNonEmpty(
    accountId,
    authSummary.accountId,
    target.accountId,
    environment.accountId,
    environmentAuth.awsAccountId,
    environmentAuth.accountId
  );
  const selectedRegion =
    firstLocalNonEmpty(
      region,
      authSummary.region,
      target.regions,
      rewriteConfig.regions,
      regions,
      environmentAuth.region,
      environmentAuth.defaultRegion
    );
  // The spawned CLI agents (codex/claude/cursor) connect to /mcp via the URL we
  // write into their config. The API is auth-gated, but the /mcp path accepts a
  // ?token= query param, so embed the API's own per-launch token here. This is
  // the single chokepoint feeding every runner's MCP config.
  const apiToken = req?.app?.get?.("apiToken") || null;
  const contextParams = {
    cloudagentRunId: recordId,
    cloudagentRunner: runner,
    cloudagentPermissionProfileId: selectedPermissionProfileId || null,
    cloudagentAccountId: selectedAccountId || null,
    cloudagentRegion: selectedRegion,
    token: apiToken,
  };
  if (configured) return appendQueryParams(configured, contextParams);
  const host = req?.get?.("host");
  if (!host) return null;
  return appendQueryParams(`${req.protocol || "http"}://${host}/mcp`, contextParams);
}

export function buildExternalAgentMcpStreamEvent(event = {}, fallbackRunner = "codex") {
  const lifecycle = String(event.lifecycle || "").toLowerCase();
  const completed = ["completed", "failed", "error"].includes(lifecycle);
  const status = lifecycle === "failed" || lifecycle === "error"
    ? "failed"
    : completed
      ? "completed"
      : "in_progress";
  const type = completed ? "tool.completed" : "tool.started";
  const toolName = event.toolName || event.name || "cloudagent_mcp";
  return {
    type,
    runner: event.runner || fallbackRunner || "codex",
    name: toolName,
    tool_name: toolName,
    status,
    args: event.args || {},
    result: event.result || (event.error ? { ok: false, stderr: event.error } : {}),
    item: {
      type: "tool_use",
      name: toolName,
      status,
      arguments: event.args || {},
      output: event.result || (event.error ? { ok: false, stderr: event.error } : {}),
    },
    requestId: event.requestId || null,
    timestamp: event.timestamp || new Date().toISOString(),
  };
}

export function subscribeToLocalMcpRunEvents({ req, recordId, runner = "codex", onEvent, onMcpEvent }) {
  const bus = req?.app?.locals?.localMcpEventBus;
  if (!bus || !recordId || (typeof onEvent !== "function" && typeof onMcpEvent !== "function")) {
    return { events: [], cleanup: () => {} };
  }
  const events = [];
  const channel = `run:${recordId}`;
  const handler = (event) => {
    const streamEvent = buildExternalAgentMcpStreamEvent(event, runner);
    events.push(streamEvent);
    if (typeof onMcpEvent === "function") {
      onMcpEvent(event);
    } else {
      onEvent(streamEvent);
    }
  };
  bus.on(channel, handler);
  return {
    events,
    cleanup: () => bus.off(channel, handler),
  };
}

export async function buildCodexLocalDataSnapshot(store, { authProfile = {}, selectedWorkloadOrStack = null } = {}) {
  const [profiles, workloads, scannerRuns, summaries] = await Promise.all([
    store.listPermissionProfiles().catch(() => []),
    store.listWorkloads().catch(() => []),
    store.listScannerRuns().catch(() => []),
    typeof store.listExecutiveSummaries === "function"
      ? store.listExecutiveSummaries().catch(() => [])
      : [],
  ]);
  const permissionProfileId = authProfile?.permissionProfileId || authProfile?.recordId || authProfile?.id || null;
  const accountId = authProfile?.awsAccountId || authProfile?.accountId || null;
  const selectedProfiles = profiles.filter((profile) => {
    if (!permissionProfileId && !accountId) return false;
    const profileAuth = parseStoredObject(profile?.authProfile, {});
    return (
      profile?.recordId === permissionProfileId ||
      profile?.id === permissionProfileId ||
      profileAuth?.awsAccountId === accountId ||
      profileAuth?.accountId === accountId
    );
  });
  const selectedWorkloads = workloads.filter((workload) => {
    const workloadId = workload?.workloadId || workload?.recordId || workload?.id;
    if (selectedWorkloadOrStack && workloadId === selectedWorkloadOrStack) return true;
    const environments = Array.isArray(workload?.environments) ? workload.environments : [];
    return permissionProfileId
      ? environments.some((env) => env?.permissionProfileId === permissionProfileId || env?.recordId === permissionProfileId)
      : false;
  });
  return {
    selectedProfiles,
    selectedWorkloads,
    profilesCount: profiles.length,
    workloadsCount: workloads.length,
    recentScannerRuns: scannerRuns
      .slice()
      .sort((a, b) => String(b?.updatedAt || b?.createdAt || "").localeCompare(String(a?.updatedAt || a?.createdAt || "")))
      .slice(0, 20),
    summaries: Array.isArray(summaries) ? summaries.slice(0, 20) : [],
  };
}

export function extractAwsCliOutputsFromContextEvents(contextEvents = []) {
  const outputs = [];
  for (const event of Array.isArray(contextEvents) ? contextEvents : []) {
    if (!event || typeof event !== "object") continue;
    if (event.type !== "tool_execution" || event.sourceTool !== "cli_session_execute") continue;
    const output = event.output && typeof event.output === "object" ? event.output : {};
    const input = output.input && typeof output.input === "object" ? output.input : event.input || {};
    const result = output.result && typeof output.result === "object" ? output.result : {};
    const resultOutput = result.output && typeof result.output === "object"
      ? result.output
      : { stdout: result.stdout || result.output || "", stderr: result.stderr || "" };
    const stdout = String(resultOutput.stdout || "").trim();
    const stderr = String(resultOutput.stderr || "").trim();
    outputs.push({
      command: input.command || "",
      cli_command: input.command || "",
      output: [stdout, stderr ? `stderr:\n${stderr}` : ""].filter(Boolean).join("\n\n") || "Command completed without output.",
      statusCode: result.statusCode || (output.ok ? 200 : 400),
    });
  }
  return outputs;
}

export function buildLocalTaskPrompt({
  title,
  blueprintId,
  task,
  phase,
  phases,
  priorLogs,
  authProfile,
  executionContext = null,
  regions = [],
  defaultValues = {},
  executionPreferences = {},
}) {
  return [
    "Execute this CloudAgent skill task in local desktop mode.",
    "",
    "Rules:",
    "- Use cli_session_start and cli_session_execute for live cloud CLI data whenever the task requires account evidence.",
    "- Run commands through the CloudAgent CLI session tools so terminal evidence and temporary files are captured.",
    "- Do not invent AWS findings. Base conclusions on tool output or prior task outputs.",
    "- If the task is a summary task, use prior task outputs first and only call AWS if more evidence is needed.",
    "- Return concise user-facing Markdown focused on findings, impact, and result.",
    "- Do not include internal process details, tool names, or raw evidence unless the user asks for an audit trail.",
    "",
    `Skill: ${title || blueprintId || "Local skill"}`,
    `Target auth summary: ${compactLocalJson(localAuthSummary(authProfile), 2000)}`,
    `Selected regions: ${Array.isArray(regions) && regions.length ? regions.join(", ") : "not specified"}`,
    "",
    "Execution context:",
    compactLocalJson(executionContext, 6000),
    "",
    "Current phase:",
    compactLocalJson(phase || {}, 4000),
    "",
    "Current task:",
    compactLocalJson(task || {}, 5000),
    "",
    "Full plan outline:",
    compactLocalJson(phases, 8000),
    "",
    "Default values:",
    compactLocalJson(defaultValues, 3000),
    "",
    "Execution preferences:",
    compactLocalJson(executionPreferences, 3000),
    "",
    "Prior task outputs:",
    compactLocalJson(priorLogs, 8000),
  ].join("\n");
}

export function buildLocalPreflightPrompt({ title, blueprintId, blueprint, planPayload, authProfile, regions = [] }) {
  const summary = extractLocalPlanForSummary({ blueprint, planPayload });
  return [
    "Review this CloudAgent skill before local desktop execution.",
    "",
    "Do not execute AWS CLI commands in this review. Analyze the skill structure, expected local read-only AWS checks, selected environment, and likely prerequisites.",
    "Return concise Markdown with: Execution scope, Local prerequisites, Task review, and Risks/limitations.",
    "",
    `Skill: ${title || blueprintId || "Local skill"}`,
    `Target auth summary: ${compactLocalJson(localAuthSummary(authProfile), 2000)}`,
    `Selected regions: ${Array.isArray(regions) && regions.length ? regions.join(", ") : "not specified"}`,
    `Plan summary: ${summary.phaseCount} phase(s), ${summary.taskCount} task(s)`,
    "",
    "Plan:",
    compactLocalJson(summary.phases, 10000),
  ].join("\n");
}

export function buildRunSummaryObject({ title, status, output }) {
  return {
    summary: `Local CloudAgent finished "${title}" with status ${status}.`,
    finalSummary: output || `Local CloudAgent finished "${title}" with status ${status}.`,
    generatedAt: new Date().toISOString(),
    status,
  };
}

export async function buildExternalAgentRunSummary({ title, runnerLabel, runner, status, output, events = [] } = {}) {
  const fallback = output || `Local ${runnerLabel || "external agent"} finished "${title}" with status ${status}.`;
  const fallbackSummary = `Local ${runnerLabel || "external agent"} finished "${title}" with status ${status}.`;
  let llmSummary = null;
  const eventSummary = {
    eventCount: Array.isArray(events) ? events.length : 0,
    eventTypes: uniqueLocalStrings((Array.isArray(events) ? events : []).map((event) => event?.type)).slice(0, 30),
  };
  if (!isLocalOpenAIConfigured()) {
    console.log("[local /agent] external run summary LLM skipped: local OpenAI is not configured", {
      title,
      runner: runnerLabel || runner,
      status,
      outputChars: String(fallback || "").length,
      eventCount: eventSummary.eventCount,
    });
  } else if (!fallback.trim()) {
    console.log("[local /agent] external run summary LLM skipped: no final output", {
      title,
      runner: runnerLabel || runner,
      status,
      eventCount: eventSummary.eventCount,
    });
  } else {
    try {
      console.log("[local /agent] external run summary LLM starting", {
        title,
        runner: runnerLabel || runner,
        status,
        outputChars: String(fallback || "").length,
        eventCount: eventSummary.eventCount,
        eventTypes: eventSummary.eventTypes,
      });
      llmSummary = await generateLocalAgentRunSummaryWithOpenAI({
        title,
        runner: runnerLabel || runner,
        status,
        finalOutput: fallback,
        eventSummary,
      });
      if (String(llmSummary || "").trim()) {
        console.log("[local /agent] external run summary LLM completed", {
          title,
          runner: runnerLabel || runner,
          status,
          summaryChars: String(llmSummary || "").trim().length,
        });
      } else {
        console.log("[local /agent] external run summary LLM returned empty summary", {
          title,
          runner: runnerLabel || runner,
          status,
        });
      }
    } catch (error) {
      console.warn("[local /agent] external run summary generation failed", error?.message || error);
    }
  }
  return {
    ...buildRunSummaryObject({ title, status, output: llmSummary || fallbackSummary }),
    summary: `Local ${runnerLabel || "external agent"} finished "${title}" with status ${status}.`,
    rawFinalSummary: fallback,
    generatedBy: llmSummary ? "local-openai" : "deterministic-fallback",
  };
}

export function buildLocalFinalRunSummary({ title, phases = [], logs = [], finalTaskSummary = "", completedAt = new Date().toISOString() }) {
  const taskLabels = new Map();
  for (const phase of Array.isArray(phases) ? phases : []) {
    for (const task of Array.isArray(phase?.tasks) ? phase.tasks : []) {
      const id = task?.id || task?.task_id;
      if (id) taskLabels.set(id, task.title || task.name || id);
    }
  }
  const completed = logs.filter((entry) => String(entry?.status || "").toLowerCase() === "complete");
  const failed = logs.filter((entry) => String(entry?.status || "").toLowerCase() === "failed");
  const cliCommandCount = logs.reduce(
    (sum, entry) => sum + (Array.isArray(entry?.cli_command_output) ? entry.cli_command_output.length : 0),
    0
  );
  const taskLines = logs.map((entry) => {
    const taskId = entry?.taskId || "task";
    const taskTitle = taskLabels.get(taskId) || taskId;
    const statusText = entry?.status || "unknown";
    const evidenceCount = Array.isArray(entry?.cli_command_output) ? entry.cli_command_output.length : 0;
    return `- ${taskTitle}: ${statusText}${evidenceCount ? ` (${evidenceCount} AWS CLI evidence call${evidenceCount === 1 ? "" : "s"})` : ""}`;
  });
  const summary = [
    `Local CloudAgent completed "${title}" with ${completed.length} completed task(s) and ${failed.length} failed task(s).`,
    cliCommandCount ? `${cliCommandCount} read-only AWS CLI evidence call(s) were captured.` : "No AWS CLI evidence calls were captured.",
    finalTaskSummary ? `Final task summary: ${finalTaskSummary}` : null,
  ].filter(Boolean).join(" ");
  return {
    summary,
    finalSummary: [
      summary,
      "",
      "Task outcomes:",
      ...(taskLines.length ? taskLines : ["- No task logs were recorded."]),
    ].join("\n"),
    completedAt,
    status: failed.length ? "failed" : "complete",
    completedTasks: completed.length,
    failedTasks: failed.length,
    cliCommandCount,
  };
}

export function localDebugSlug(value, fallback = "blueprint") {
  return (
    String(value || fallback)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || fallback
  );
}

export function localDebugTimestamp(value = new Date()) {
  return value.toISOString().replace(/[:.]/g, "-");
}

export async function writeLocalUpdatedBlueprintDebugFile({
  store,
  blueprintId = null,
  title = null,
  recordId = null,
  preflightResult = null,
} = {}) {
  const updatedBlueprint = preflightResult?.updatedBlueprint || null;
  if (!updatedBlueprint) return null;

  const baseDir = store?.dataDir
    ? path.join(store.dataDir, "debug", "skills")
    : path.join(process.cwd(), ".cloudagent", "debug", "skills");
  await fs.mkdir(baseDir, { recursive: true });

  const writtenAt = new Date();
  const nameParts = [
    "updated-skill",
    localDebugSlug(blueprintId || title || "skill"),
    recordId ? localDebugSlug(recordId, "run") : null,
    localDebugTimestamp(writtenAt),
  ].filter(Boolean);
  const fileName = `${nameParts.join("-")}.json`;
  const filePath = path.join(baseDir, fileName);
  await fs.writeFile(filePath, `${JSON.stringify(updatedBlueprint, null, 2)}\n`, "utf8");

  return {
    kind: "updated_skill",
    fileName,
    filePath,
    relativePath: store?.dataDir ? path.relative(store.dataDir, filePath) : null,
    writtenAt: writtenAt.toISOString(),
    blueprintId,
    title,
    recordId,
  };
}

export function normalizeLocalBackgroundRunSettings(inputSettings = {}) {
  const settings = inputSettings && typeof inputSettings === "object" ? inputSettings : {};
  return {
    authProfile: parseStoredObject(settings.authProfile, settings.authProfile || {}),
    regions: Array.isArray(settings.regions)
      ? settings.regions
      : Array.isArray(settings.select_aws_regions)
        ? settings.select_aws_regions
        : [],
    defaultValues:
      settings.defaultValues && typeof settings.defaultValues === "object"
        ? settings.defaultValues
        : settings.default_values && typeof settings.default_values === "object"
          ? settings.default_values
          : {},
    additionalInstructions:
      settings.additionalInstructions || settings.additional_instructions || null,
    executionPreferences:
      settings.executionPreferences && typeof settings.executionPreferences === "object"
        ? settings.executionPreferences
        : settings.execution_preferences && typeof settings.execution_preferences === "object"
          ? settings.execution_preferences
          : {},
    configurationMode:
      settings.configurationMode || settings.configuration_mode || null,
    stackAction:
      settings.stackAction || settings.stack_action || null,
    existingStack:
      settings.existingStack || settings.existing_stack || null,
    existingStacks:
      Array.isArray(settings.existingStacks)
        ? settings.existingStacks
        : Array.isArray(settings.existing_stacks)
          ? settings.existing_stacks
          : [],
    selectedWorkloadOrStack:
      settings.selectedWorkloadOrStack || settings.selected_workload_or_stack || null,
  };
}

export function buildLocalBackgroundPreflightAnswer() {
  return {
    questionId: "analysis_review",
    selectedOptionId: "continue",
    value: "continue",
    source: "local_background_auto_confirm",
  };
}

export function buildLocalBackgroundPreflightLog({
  blueprintId,
  preflightResult,
  defaultValues = {},
  regions = [],
  permissionProfileId = null,
  executionMode = "cloudagent",
} = {}) {
  return {
    logs: [],
    currentPhase: 0,
    currentTask: 0,
    lastUpdated: new Date().toISOString(),
    blueprintId,
    isBluePrint: true,
    executionMode,
    runner: executionMode,
    preflight: {
      executionContext: preflightResult?.executionContext || null,
      analysis: preflightResult?.analysis || null,
      recommendation: preflightResult?.recommendation || null,
      updateStrategy: preflightResult?.updateStrategy || null,
      rewriteConfig: preflightResult?.rewriteConfig || null,
      validation: preflightResult?.validation || null,
      readOnlyResult: preflightResult?.readOnlyResult || null,
      debugArtifacts: preflightResult?.debugArtifacts || null,
      updatedBlueprintDebugFile: preflightResult?.updatedBlueprintDebugFile || null,
      source: "local_background_auto_confirm",
    },
    globalSettings: {
      ...(Object.keys(defaultValues || {}).length ? { defaultValues } : {}),
      ...(Array.isArray(regions) && regions.length ? { select_aws_regions: regions } : {}),
      ...(permissionProfileId ? { permissionProfileId } : {}),
    },
    runSummary: {
      summary: "Local background run completed skill review and rewrite preflight.",
      finalSummary: "Local background run completed skill review and rewrite preflight.",
      generatedAt: new Date().toISOString(),
      status: "running",
    },
  };
}

export function buildLocalPlanUrl(base, key) {
  return `${String(base || "").replace(/\/+$/, "")}/${String(key || "").replace(/^\/+/, "")}`;
}

export function stripBlueprintRunnerFields(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { executionMode: _executionMode, runner: _runner, ...rest } = value;
  return rest;
}

export function normalizeLocalLibraryBlueprintRecord(raw = {}, blueprintId = null) {
  const plan = parseStoredJsonValue(raw?.plan, raw?.plan || []);
  const planPayloadRaw = Array.isArray(plan)
    ? {
        title: raw?.title || raw?.planTitle || blueprintId || "Library Skill",
        cloudProvider: raw?.cloudProvider || "aws",
        plan,
      }
    : {
        ...(plan && typeof plan === "object" && !Array.isArray(plan) ? plan : {}),
        title: raw?.title || raw?.planTitle || plan?.title || blueprintId || "Library Skill",
        cloudProvider: raw?.cloudProvider || plan?.cloudProvider || "aws",
        plan: Array.isArray(plan?.plan) ? plan.plan : [],
      };
  const planPayload = stripBlueprintRunnerFields(planPayloadRaw);
  return {
    recordId: raw?.recordId || raw?.blueprintId || raw?.planId || blueprintId,
    title: raw?.title || raw?.planTitle || planPayload.title,
    description: raw?.description || raw?.planDescription || planPayload.description || "",
    cloudProvider: raw?.cloudProvider || planPayload.cloudProvider || "aws",
    plan: planPayload,
    requiredPermissions: raw?.requiredPermissions || {},
    planSettings: raw?.planSettings || {},
    source: raw?.source || "library",
  };
}

export async function resolveLocalBackgroundBlueprint(store, blueprintId) {
  const id = String(blueprintId || "").trim();
  if (!id) return null;
  const local = await store.getSkill(id);
  if (local) return local;

  const base = globals?.URLS?.PLAN_DEFS_HTTP_BASE_URL || "https://agent-plans-sandbox.s3.us-east-1.amazonaws.com";
  const candidates = [
    buildLocalPlanUrl(base, `plans/${encodeURIComponent(id)}.json`),
    buildLocalPlanUrl("https://s3.us-east-1.amazonaws.com/agent-plans-sandbox", `plans/${encodeURIComponent(id)}.json`),
  ];
  for (const url of [...new Set(candidates)]) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const parsed = await response.json();
      return normalizeLocalLibraryBlueprintRecord({ ...parsed, source: "library_http", fetchUrl: url }, id);
    } catch (error) {
      console.warn("[local /runAgentBackground] failed to fetch library blueprint", {
        blueprintId: id,
        url,
        message: error?.message || String(error),
      });
    }
  }
  return null;
}

export function unwrapAgentStreamEvent(ev) {
  return ev?.data?.event ?? ev?.data ?? null;
}

export async function runLocalCloudAgentChat({
  store,
  message,
  selectedAuthProfile = null,
  previousResponseId = null,
  cliSessionScopeId = null,
  onToken,
  onContextEvent,
}) {
  if (!isLocalOpenAIConfigured()) return null;

  const [
    { user },
    { runCloudAgentStream },
    { createCloudAgentTools },
  ] = await Promise.all([
    import("@openai/agents"),
    import("@cloudagent/cloudagent/core"),
    import("../cloudagent/cloudagent-tools.mjs"),
  ]);

  const { tools } = createCloudAgentTools({ store, selectedAuthProfile });
  const contextEvents = [];
  const toolExecutionsByKey = new Map();
  const { stream } = await runCloudAgentStream({
    userId: DEFAULT_AUTH.userId,
    history: [user(String(message || ""))],
    mode: "local",
    toolsOverride: tools,
    previousResponseId,
    contextExtras: {
      recordId: cliSessionScopeId,
      cliSessionScopeId,
    },
    onContextEvent: (payload) => {
      if (!payload) return;
      if (payload.type === "terminal_output") {
        if (typeof onContextEvent === "function") onContextEvent(payload);
        return;
      }
      contextEvents.push(payload);
      if (typeof onContextEvent === "function") onContextEvent(payload);
    },
  });

  let text = "";
  let responseId = null;
  for await (const ev of stream) {
    if (ev?.type !== "raw_model_stream_event") continue;
    const inner = unwrapAgentStreamEvent(ev);
    if (!inner) continue;
    const type = inner.type;

    if (type === "response.created" && inner.response?.id) responseId = inner.response.id;
    if (type === "response.completed" && inner.response?.id) responseId = inner.response.id;

    if (type === "response.output_text.delta" || type === "response.text.delta") {
      const token = inner.delta || "";
      if (token) {
        text += token;
        if (typeof onToken === "function") onToken(token);
      }
      continue;
    }

    if (type === "response.output_item.added" || type === "response.output_item.done") {
      const item = inner.item || {};
      const itemType = item.type;
      if (itemType === "tool_call" || itemType === "function_call") {
        const key = item.id || item.call_id || `${item.name || "tool"}-${toolExecutionsByKey.size + 1}`;
        const existing = toolExecutionsByKey.get(key) || {
          id: key,
          name: item.name || item.tool_name || "tool",
          status: "running",
        };
        existing.name = item.name || item.tool_name || existing.name;
        existing.input = item.arguments || item.input || existing.input || null;
        existing.status = type === "response.output_item.done" ? "completed" : existing.status;
        toolExecutionsByKey.set(key, existing);
      } else if (itemType === "tool_result" || itemType === "function_call_output") {
        const key = item.id || item.call_id || `${item.name || "tool"}-${toolExecutionsByKey.size + 1}`;
        const existing = toolExecutionsByKey.get(key) || {
          id: key,
          name: item.name || item.tool_name || "tool",
        };
        existing.output = item.output || item.result || null;
        existing.status = "completed";
        toolExecutionsByKey.set(key, existing);
      }
    }
  }

  return {
    text,
    responseId,
    toolExecutions: Array.from(toolExecutionsByKey.values()),
    contextEvents,
  };
}

export function buildTaskChatSeed(task = {}, execution = {}, timestamp = new Date().toISOString()) {
  const output = task?.result?.output && typeof task.result.output === "object"
    ? task.result.output
    : {};
  const initialAnswer =
    output.message ||
    output.summary ||
    task?.result?.summary ||
    task?.task_output ||
    task?.output ||
    execution?.nodeOutput?.summary ||
    "";
  return {
    query: task?.taskTitle || task?.title || execution?.nodeName || "Initial task",
    answer: initialAnswer || "Task started.",
    timestamp: task?.startedAt || execution?.startedAt || timestamp,
  };
}

export function appendWorkflowTaskChatEntry(executions = [], {
  branchId = null,
  taskId = null,
  followUpMessage = "",
  assistantText = "",
  responseId = null,
  timestamp = new Date().toISOString(),
} = {}) {
  let matched = false;
  const updated = (Array.isArray(executions) ? executions : []).map((execution) => {
    const branchMatches = !branchId || execution?.branchId === branchId || execution?.nodeId === branchId;
    const tasks = Array.isArray(execution?.tasks) ? execution.tasks : [];
    let taskMatchedInExecution = false;
    const nextTasks = tasks.map((task) => {
      const taskMatches = !taskId || task?.taskId === taskId || task?.id === taskId;
      if (!branchMatches || !taskMatches) return task;
      matched = true;
      taskMatchedInExecution = true;
      const result = task?.result && typeof task.result === "object" ? task.result : {};
      const output = result.output && typeof result.output === "object" ? result.output : {};
      const existingHistory = Array.isArray(output.chatHistory) ? output.chatHistory : [];
      const baseHistory = existingHistory.length > 0
        ? existingHistory
        : [buildTaskChatSeed(task, execution, timestamp)];
      return {
        ...task,
        lastResponseId: responseId || task?.lastResponseId || null,
        result: {
          ...result,
          output: {
            ...output,
            chatHistory: [
              ...baseHistory,
              {
                query: followUpMessage,
                answer: assistantText,
                timestamp,
                responseId,
              },
            ],
          },
        },
      };
    });

    if (!taskMatchedInExecution) return execution;
    return {
      ...execution,
      tasks: nextTasks,
      nodeOutput: {
        ...(execution?.nodeOutput || {}),
        summary: assistantText || execution?.nodeOutput?.summary || "Local workflow follow-up recorded.",
      },
    };
  });

  return { updated, matched };
}

export async function runLocalCloudAgentBlueprintTask({
  store,
  recordId,
  blueprintId,
  blueprint,
  planPayload,
  title,
  taskId,
  authProfile,
  regions = [],
  defaultValues = {},
  executionPreferences = {},
  selectedWorkloadOrStack = null,
  onToken,
} = {}) {
  if (!isLocalOpenAIConfigured()) return null;

  const existing = recordId ? await store.getAgentHistoryRecord(recordId) : null;
  const existingLog = parseStoredJsonValue(existing?.log, {}) || {};
  const existingPreflight = existingLog?.preflight && typeof existingLog.preflight === "object"
    ? existingLog.preflight
    : {};
  const storedRewriteConfig = existingPreflight?.rewriteConfig && typeof existingPreflight.rewriteConfig === "object"
    ? existingPreflight.rewriteConfig
    : {};
  const effectiveSelectedWorkloadOrStack =
    selectedWorkloadOrStack ||
    storedRewriteConfig.selectedWorkloadOrStack ||
    existingPreflight?.executionContext?.target?.rawSelection ||
    null;
  const priorLogs = Array.isArray(existingLog.logs) ? existingLog.logs : [];
  const { phase, task, phaseIndex, taskIndex, phases } = findLocalPlanTask({
    blueprint,
    planPayload,
    taskId,
  });
  if (!task) {
    throw new Error(`Local skill task not found: ${taskId}`);
  }
  const existingCompletedLog = priorLogs.find(
    (entry) =>
      entry?.taskId === (task.id || task.task_id || taskId) &&
      String(entry?.status || "").toLowerCase() === "complete"
  );
  if (existingCompletedLog) {
    const runSummary = buildRunSummaryObject({
      title,
      status: "complete",
      output: existingCompletedLog.task_output || existingCompletedLog.output || "",
    });
    return {
      ok: true,
      status: "complete",
      recordId: existing?.recordId || recordId,
      record: existing,
      agentRun: existing,
      summary: runSummary.summary,
      runSummary,
      logs: priorLogs,
      task,
      logEntry: existingCompletedLog,
      cliOutputs: Array.isArray(existingCompletedLog.cli_command_output)
        ? existingCompletedLog.cli_command_output
        : [],
      cached: true,
    };
  }

  const { accountsService, workloadsService } = createCloudAgentTools({
    store,
    selectedAuthProfile: authProfile,
  });
  const taskExecutionContext = await resolveSkillExecutionContext({
    userId: DEFAULT_AUTH.userId,
    accountId: authProfile?.awsAccountId || authProfile?.accountId || null,
    permissionProfileId: authProfile?.permissionProfileId || authProfile?.recordId || authProfile?.id || null,
    selectedTarget: effectiveSelectedWorkloadOrStack,
    configurationMode: storedRewriteConfig.configurationMode || null,
    stackAction: storedRewriteConfig.stackAction || null,
    existingStack: storedRewriteConfig.existingStack || null,
    existingStacks: Array.isArray(storedRewriteConfig.existingStacks) ? storedRewriteConfig.existingStacks : [],
    regions,
    defaultValues,
    executionPreferences,
    deliveryTargetOverride: storedRewriteConfig.deliveryTargetOverride || null,
    accountsService,
    workloadsService,
  });

  const prompt = buildLocalTaskPrompt({
    title,
    blueprintId,
    task,
    phase,
    phases,
    priorLogs,
    authProfile,
    executionContext: taskExecutionContext,
    regions,
    defaultValues,
    executionPreferences,
  });
  console.log("[local /agent] llm task start", {
    recordId,
    blueprintId,
    taskId,
    title: task.title || task.name || taskId,
  });
  const response = await runLocalCloudAgentChat({
    store,
    message: prompt,
    selectedAuthProfile: authProfile,
    onToken,
  });
  const text = String(response?.text || "").trim();
  const cliOutputs = extractAwsCliOutputsFromContextEvents(response?.contextEvents || []);
  const status = text ? "complete" : "failed";
  const output = text || "Local CloudAgent did not return a task response.";
  const now = new Date().toISOString();
  const isLastTask =
    phases.length > 0 &&
    phaseIndex === phases.length - 1 &&
    taskIndex === (Array.isArray(phases[phaseIndex]?.tasks) ? phases[phaseIndex].tasks.length - 1 : 0);
  const logEntry = {
    taskId: task.id || task.task_id || taskId,
    phaseIndex,
    taskIndex,
    status,
    output,
    task_output: output,
    cli_command_output: cliOutputs,
    toolExecutions: response?.toolExecutions || [],
    timestamp: now,
  };
  const nextLogs = [
    ...priorLogs.filter((entry) => entry?.taskId !== logEntry.taskId),
    logEntry,
  ];
  const runSummary =
    status === "complete" && isLastTask
      ? buildLocalFinalRunSummary({
          title,
          phases,
          logs: nextLogs,
          finalTaskSummary: output,
          completedAt: now,
        })
      : buildRunSummaryObject({ title, status, output });
  const recordPatch = {
    status: status === "complete" && !isLastTask ? "running" : status,
    authProfile: authProfile || existing?.authProfile || {},
    log: {
      ...existingLog,
      logs: nextLogs,
      currentPhase: phaseIndex,
      currentTask: taskIndex,
      lastUpdated: now,
      blueprintId: blueprintId || existingLog.blueprintId || existing?.itemId,
      isBluePrint: true,
      preflight: existingPreflight,
      ...(status === "complete" && isLastTask ? { runSummary } : {}),
    },
  };
  const record = existing
    ? await store.updateAgentHistoryRecord(existing.recordId, recordPatch)
    : await store.createAgentHistoryRecord({
        itemId: blueprintId || "local-agent",
        title,
        agentType: "agent",
        ...recordPatch,
      });
  console.log("[local /agent] llm task complete", {
    recordId: record?.recordId,
    blueprintId,
    taskId: logEntry.taskId,
    status,
    toolCount: cliOutputs.length,
  });
  return {
    ok: status === "complete",
    status,
    recordStatus: recordPatch.status,
    recordId: record?.recordId,
    record,
    agentRun: record,
    summary: runSummary.summary,
    runSummary,
    logs: nextLogs,
    task,
    logEntry,
    cliOutputs,
  };
}

export async function runLocalExternalAgentBlueprintTask({
  runner = "codex",
  req,
  store,
  recordId,
  blueprintId,
  blueprint,
  planPayload,
  title,
  taskId,
  authProfile,
  regions = [],
  defaultValues = {},
  executionPreferences = {},
  selectedWorkloadOrStack = null,
  onCodexEvent = null,
  onMcpEvent = null,
  onCodexStdout = null,
  onCodexStderr = null,
} = {}) {
  const normalizedRunner = normalizeCodingAgentRunner(runner);
  const executionMode = isLocalCodingAgentExecutionMode(normalizedRunner) ? normalizedRunner : "codex";
  const runnerLabel = codingAgentRunnerLabel(executionMode);
  const existing = recordId ? await store.getAgentHistoryRecord(recordId) : null;
  const existingLog = parseStoredJsonValue(existing?.log, {}) || {};
  const existingPreflight = existingLog?.preflight && typeof existingLog.preflight === "object"
    ? existingLog.preflight
    : {};
  const storedRewriteConfig = existingPreflight?.rewriteConfig && typeof existingPreflight.rewriteConfig === "object"
    ? existingPreflight.rewriteConfig
    : {};
  const effectiveSelectedWorkloadOrStack =
    selectedWorkloadOrStack ||
    storedRewriteConfig.selectedWorkloadOrStack ||
    existingPreflight?.executionContext?.target?.rawSelection ||
    null;
  const priorLogs = Array.isArray(existingLog.logs) ? existingLog.logs : [];
  const { phase, task, phaseIndex, taskIndex, phases } = findLocalPlanTask({
    blueprint,
    planPayload,
    taskId,
  });
  if (!task) {
    throw new Error(`Local Codex skill task not found: ${taskId}`);
  }

  const { accountsService, workloadsService } = createCloudAgentTools({
    store,
    selectedAuthProfile: authProfile,
  });
  const taskExecutionContext = await resolveSkillExecutionContext({
    userId: DEFAULT_AUTH.userId,
    accountId: authProfile?.awsAccountId || authProfile?.accountId || null,
    permissionProfileId: authProfile?.permissionProfileId || authProfile?.recordId || authProfile?.id || null,
    selectedTarget: effectiveSelectedWorkloadOrStack,
    configurationMode: storedRewriteConfig.configurationMode || null,
    stackAction: storedRewriteConfig.stackAction || null,
    existingStack: storedRewriteConfig.existingStack || null,
    existingStacks: Array.isArray(storedRewriteConfig.existingStacks) ? storedRewriteConfig.existingStacks : [],
    regions,
    defaultValues,
    executionPreferences,
    deliveryTargetOverride: storedRewriteConfig.deliveryTargetOverride || null,
    accountsService,
    workloadsService,
  });
  const localDataSnapshot = await buildCodexLocalDataSnapshot(store, {
    authProfile,
    selectedWorkloadOrStack: effectiveSelectedWorkloadOrStack,
  });
  const codexSettings = await getLocalCodexSettings(store);
  const agentSettings = getLocalCodingAgentSettings(codexSettings, executionMode);
  const { skillFiles: codexSkillFiles, executionContext: skillExecutionContext } =
    await buildRuntimeExternalAgentSkillFilesForRun({
      title,
      runner: executionMode,
      blueprint,
      planPayload,
      preflightResult: {
        ...existingPreflight,
        executionContext: taskExecutionContext || existingPreflight?.executionContext || null,
      },
      authProfile,
      regions,
      defaultValues,
      executionPreferences,
      localDataSnapshot,
    });

  console.log(`[local /agent] ${runnerLabel} task start`, {
    recordId,
    blueprintId,
    taskId,
    title: task.title || task.name || taskId,
    skillContextGeneratedBy: skillExecutionContext.generatedBy,
  });
  const mcpForwarder = subscribeToLocalMcpRunEvents({
    req,
    recordId,
    runner: executionMode,
    onEvent: onCodexEvent,
    onMcpEvent,
  });
  let codexResult;
  try {
    codexResult = await runLocalExternalAgentBlueprint({
      runner: executionMode,
      blueprintId,
      title,
      blueprint,
      planPayload,
      task,
      phase,
      phases,
      priorLogs,
      authProfile,
      executionContext: taskExecutionContext,
      regions,
      defaultValues,
      executionPreferences,
      localDataSnapshot,
      mcpUrl: buildLocalMcpUrl(req, {
        recordId,
        runner: executionMode,
        authProfile,
        regions,
        executionContext: taskExecutionContext,
        preflightResult: existingPreflight,
      }),
      recordId,
      workspaceDir: agentSettings.workspaceDir,
      agentBinary: agentSettings.agentBinary,
      skillFiles: codexSkillFiles,
      onEvent: onCodexEvent,
      onStdout: onCodexStdout,
      onStderr: onCodexStderr,
    });
  } finally {
    mcpForwarder.cleanup();
  }
  codexResult.events = [
    ...(Array.isArray(codexResult.events) ? codexResult.events : []),
    ...mcpForwarder.events,
  ];
  const now = new Date().toISOString();
  const isLastTask =
    phases.length > 0 &&
    phaseIndex === phases.length - 1 &&
    taskIndex === (Array.isArray(phases[phaseIndex]?.tasks) ? phases[phaseIndex].tasks.length - 1 : 0);
  const logEntry = {
    taskId: task.id || task.task_id || taskId,
    phaseIndex,
    taskIndex,
    status: codexResult.status,
    output: codexResult.output,
    task_output: codexResult.output,
    executionMode,
    runner: executionMode,
    codex: {
      runDir: codexResult.runDir,
      threadId: codexResult.threadId || null,
      exitCode: codexResult.exitCode,
      timedOut: Boolean(codexResult.timedOut),
      eventCount: Array.isArray(codexResult.events) ? codexResult.events.length : 0,
      events: compactCodexHistoryEvents(codexResult.events),
      stderr: compactLocalJson(codexResult.stderr || "", 4000),
    },
    timestamp: now,
  };
  const nextLogs = [
    ...priorLogs.filter((entry) => entry?.taskId !== logEntry.taskId),
    logEntry,
  ];
  const runSummary =
    codexResult.status === "complete" && isLastTask
      ? await buildExternalAgentRunSummary({
          title,
          runnerLabel,
          runner: executionMode,
          status: codexResult.status,
          output: codexResult.output,
          events: codexResult.events,
        })
      : buildRunSummaryObject({ title, status: codexResult.status, output: codexResult.output });
  const recordPatch = {
    status: codexResult.status === "complete" && !isLastTask ? "running" : codexResult.status,
    executionMode,
    runner: executionMode,
    authProfile: authProfile || existing?.authProfile || {},
    log: {
      ...existingLog,
      executionMode,
      runner: executionMode,
      logs: nextLogs,
      currentPhase: phaseIndex,
      currentTask: taskIndex,
      lastUpdated: now,
      blueprintId: blueprintId || existingLog.blueprintId || existing?.itemId,
      isBluePrint: true,
      preflight: existingPreflight,
      ...(codexResult.status === "complete" && isLastTask ? { runSummary } : {}),
    },
  };
  const record = existing
    ? await store.updateAgentHistoryRecord(existing.recordId, recordPatch)
    : await store.createAgentHistoryRecord({
        itemId: blueprintId || "local-agent",
        title,
        agentType: "agent",
        ...recordPatch,
      });
  console.log(`[local /agent] ${runnerLabel} task complete`, {
    recordId: record?.recordId,
    blueprintId,
    taskId: logEntry.taskId,
    status: codexResult.status,
    runDir: codexResult.runDir,
  });
  return {
    ok: codexResult.status === "complete",
    status: codexResult.status,
    recordStatus: recordPatch.status,
    recordId: record?.recordId,
    record,
    agentRun: record,
    summary: runSummary.summary,
    runSummary,
    logs: nextLogs,
    task,
    logEntry,
    cliOutputs: [],
  };
}

export async function runLocalExternalAgentBlueprintSession({
  runner = "codex",
  req,
  store,
  recordId,
  blueprintId,
  blueprint,
  planPayload,
  title,
  authProfile,
  regions = [],
  defaultValues = {},
  executionPreferences = {},
  selectedWorkloadOrStack = null,
  preflightResult = null,
  onCodexEvent = null,
  onMcpEvent = null,
  onCodexStdout = null,
  onCodexStderr = null,
} = {}) {
  const normalizedRunner = normalizeCodingAgentRunner(runner);
  const executionMode = isLocalCodingAgentExecutionMode(normalizedRunner) ? normalizedRunner : "codex";
  const runnerLabel = codingAgentRunnerLabel(executionMode);
  const existing = recordId ? await store.getAgentHistoryRecord(recordId) : null;
  const existingLog = parseStoredJsonValue(existing?.log, {}) || {};
  const existingPreflight = preflightResult
    ? {
        status: preflightResult.status || null,
        readOnlyResult: preflightResult.readOnlyResult || null,
        executionContext: preflightResult.executionContext || null,
        analysis: preflightResult.analysis || null,
        recommendation: preflightResult.recommendation || null,
        updateStrategy: preflightResult.updateStrategy || null,
        rewriteConfig: preflightResult.rewriteConfig || null,
        validation: preflightResult.validation || null,
        debugArtifacts: preflightResult.debugArtifacts || null,
        updatedBlueprintDebugFile: preflightResult.updatedBlueprintDebugFile || null,
      }
    : existingLog?.preflight && typeof existingLog.preflight === "object"
      ? existingLog.preflight
      : {};
  const storedRewriteConfig =
    existingPreflight?.rewriteConfig && typeof existingPreflight.rewriteConfig === "object"
      ? existingPreflight.rewriteConfig
      : {};
  const effectiveSelectedWorkloadOrStack =
    selectedWorkloadOrStack ||
    storedRewriteConfig.selectedWorkloadOrStack ||
    existingPreflight?.executionContext?.target?.rawSelection ||
    null;
  const priorLogs = Array.isArray(existingLog.logs) ? existingLog.logs : [];
  const { phases } = extractLocalPlanForSummary({ blueprint, planPayload });
  let executionContext = existingPreflight?.executionContext || preflightResult?.executionContext || null;
  if (!executionContext) {
    const { accountsService, workloadsService } = createCloudAgentTools({
      store,
      selectedAuthProfile: authProfile,
    });
    executionContext = await resolveSkillExecutionContext({
      userId: DEFAULT_AUTH.userId,
      accountId: authProfile?.awsAccountId || authProfile?.accountId || null,
      permissionProfileId: authProfile?.permissionProfileId || authProfile?.recordId || authProfile?.id || null,
      selectedTarget: effectiveSelectedWorkloadOrStack,
      configurationMode: storedRewriteConfig.configurationMode || null,
      stackAction: storedRewriteConfig.stackAction || null,
      existingStack: storedRewriteConfig.existingStack || null,
      existingStacks: Array.isArray(storedRewriteConfig.existingStacks) ? storedRewriteConfig.existingStacks : [],
      regions,
      defaultValues,
      executionPreferences,
      deliveryTargetOverride: storedRewriteConfig.deliveryTargetOverride || null,
      accountsService,
      workloadsService,
    });
  }
  const localDataSnapshot = await buildCodexLocalDataSnapshot(store, {
    authProfile,
    selectedWorkloadOrStack: effectiveSelectedWorkloadOrStack,
  });
  const codexSettings = await getLocalCodexSettings(store);
  const agentSettings = getLocalCodingAgentSettings(codexSettings, executionMode);
  const { skillFiles: codexSkillFiles, executionContext: skillExecutionContext } =
    await buildRuntimeExternalAgentSkillFilesForRun({
      title,
      runner: executionMode,
      blueprint,
      planPayload,
      preflightResult: existingPreflight,
      authProfile,
      regions,
      defaultValues,
      executionPreferences,
      localDataSnapshot,
    });

  console.log(`[local /agent] ${runnerLabel} session start`, {
    recordId,
    blueprintId,
    title,
    phaseCount: phases.length,
    taskCount: phases.reduce((sum, phase) => sum + (Array.isArray(phase?.tasks) ? phase.tasks.length : 0), 0),
    skillContextGeneratedBy: skillExecutionContext.generatedBy,
  });

  const mcpForwarder = subscribeToLocalMcpRunEvents({
    req,
    recordId,
    runner: executionMode,
    onEvent: onCodexEvent,
    onMcpEvent,
  });
  let codexResult;
  try {
    codexResult = await runLocalExternalAgentBlueprint({
      runner: executionMode,
      blueprintId,
      title,
      blueprint,
      planPayload,
      phases,
      priorLogs,
      authProfile,
      executionContext,
      regions,
      defaultValues,
      executionPreferences,
      localDataSnapshot,
      mcpUrl: buildLocalMcpUrl(req, {
        recordId,
        runner: executionMode,
        authProfile,
        regions,
        executionContext,
        preflightResult: existingPreflight,
      }),
      recordId,
      workspaceDir: agentSettings.workspaceDir,
      agentBinary: agentSettings.agentBinary,
      skillFiles: codexSkillFiles,
      onEvent: onCodexEvent,
      onStdout: onCodexStdout,
      onStderr: onCodexStderr,
    });
  } finally {
    mcpForwarder.cleanup();
  }
  codexResult.events = [
    ...(Array.isArray(codexResult.events) ? codexResult.events : []),
    ...mcpForwarder.events,
  ];
  const now = new Date().toISOString();
  const logEntry = {
    taskId: EXTERNAL_AGENT_RUN_TASK_ID,
    taskTitle: `${runnerLabel} skill session`,
    status: codexResult.status,
    output: codexResult.output,
    task_output: codexResult.output,
    executionMode,
    runner: executionMode,
    codex: {
      runDir: codexResult.runDir,
      threadId: codexResult.threadId || null,
      exitCode: codexResult.exitCode,
      timedOut: Boolean(codexResult.timedOut),
      eventCount: Array.isArray(codexResult.events) ? codexResult.events.length : 0,
      events: compactCodexHistoryEvents(codexResult.events),
      stderr: compactLocalJson(codexResult.stderr || "", 4000),
    },
    timestamp: now,
  };
  const nextLogs = [
    ...priorLogs.filter((entry) => entry?.taskId !== EXTERNAL_AGENT_RUN_TASK_ID),
    logEntry,
  ];
  const runSummary = await buildExternalAgentRunSummary({
    title,
    runnerLabel,
    runner: executionMode,
    status: codexResult.status,
    output: codexResult.output,
    events: codexResult.events,
  });
  const recordPatch = {
    status: codexResult.status,
    executionMode,
    runner: executionMode,
    authProfile: authProfile || existing?.authProfile || {},
    log: {
      ...existingLog,
      executionMode,
      runner: executionMode,
      logs: nextLogs,
      currentPhase: null,
      currentTask: null,
      lastUpdated: now,
      blueprintId: blueprintId || existingLog.blueprintId || existing?.itemId,
      isBluePrint: true,
      preflight: existingPreflight,
      runSummary,
      codexRun: {
        runDir: codexResult.runDir,
        threadId: codexResult.threadId || null,
        exitCode: codexResult.exitCode,
        timedOut: Boolean(codexResult.timedOut),
        runner: executionMode,
      },
    },
  };
  const record = existing
    ? await store.updateAgentHistoryRecord(existing.recordId, recordPatch)
    : await store.createAgentHistoryRecord({
        itemId: blueprintId || "local-agent",
        title,
        agentType: "agent",
        ...recordPatch,
      });
  console.log(`[local /agent] ${runnerLabel} session complete`, {
    recordId: record?.recordId,
    blueprintId,
    status: codexResult.status,
    runDir: codexResult.runDir,
  });
  return {
    ok: codexResult.status === "complete",
    status: codexResult.status,
    recordStatus: codexResult.status,
    recordId: record?.recordId,
    record,
    agentRun: record,
    summary: runSummary.summary,
    runSummary,
    logs: nextLogs,
    logEntry,
    codexResult,
  };
}

export async function resumeLocalExternalAgentRun({
  store,
  recordId,
  runner = null,
  prompt,
  mcpUrl = null,
  onCodexEvent = null,
  onCodexStdout = null,
  onCodexStderr = null,
} = {}) {
  const existing = recordId ? await store.getAgentHistoryRecord(recordId) : null;
  if (!existing) {
    const error = new Error("Agent run not found");
    error.status = 404;
    throw error;
  }
  const existingLog = parseStoredJsonValue(existing.log, {}) || {};
  const agentRunner = inferStoredCodingAgentRunner(
    runner ? { ...existing, runner } : existing,
    existingLog
  );
  const runnerLabel = codingAgentRunnerLabel(agentRunner);
  const logs = Array.isArray(existingLog.logs) ? existingLog.logs : [];
  const latestCodexLog = logs
    .slice()
    .reverse()
    .find((entry) =>
      entry?.executionMode === agentRunner ||
      entry?.runner === agentRunner ||
      (entry?.codex && (!entry?.runner || entry.runner === agentRunner))
    );
  const codexRun = existingLog.codexRun && typeof existingLog.codexRun === "object"
    ? existingLog.codexRun
    : {};
  const runDir = codexRun.runDir || latestCodexLog?.codex?.runDir || null;
  const threadId = codexRun.threadId || latestCodexLog?.codex?.threadId || null;
  if (!runDir) {
    const error = new Error(`This ${runnerLabel} run does not have a saved run directory and cannot be resumed.`);
    error.status = 409;
    throw error;
  }

  const authProfile = parseStoredObject(existing.authProfile, {});
  const codexSettings = await getLocalCodexSettings(store);
  const agentSettings = getLocalCodingAgentSettings(codexSettings, agentRunner);
  const resumeResult = await resumeLocalExternalAgentBlueprint({
    runner: agentRunner,
    threadId,
    runDir,
    prompt,
    authProfile,
    mcpUrl,
    agentBinary: agentSettings.agentBinary,
    onEvent: onCodexEvent,
    onStdout: onCodexStdout,
    onStderr: onCodexStderr,
  });
  const now = new Date().toISOString();
  const resumeTaskPrefix = `${agentRunner}_resume_`;
  const resumeIndex = logs.filter((entry) => String(entry?.taskId || "").startsWith(resumeTaskPrefix)).length + 1;
  const logEntry = {
    taskId: `${resumeTaskPrefix}${resumeIndex}`,
    taskTitle: `${runnerLabel} resume ${resumeIndex}`,
    status: resumeResult.status,
    input: prompt,
    output: resumeResult.output,
    task_output: resumeResult.output,
    executionMode: agentRunner,
    runner: agentRunner,
    codex: {
      runDir: resumeResult.runDir,
      threadId: resumeResult.threadId || threadId || null,
      exitCode: resumeResult.exitCode,
      timedOut: Boolean(resumeResult.timedOut),
      eventCount: Array.isArray(resumeResult.events) ? resumeResult.events.length : 0,
      events: compactCodexHistoryEvents(resumeResult.events),
      stderr: compactLocalJson(resumeResult.stderr || "", 4000),
    },
    timestamp: now,
  };
  const runSummary = {
    ...buildRunSummaryObject({
      title: existing.title || existing.itemId || recordId,
      status: resumeResult.status,
      output: resumeResult.output,
    }),
    summary: `Local ${runnerLabel} resumed "${existing.title || existing.itemId || recordId}" with status ${resumeResult.status}.`,
  };
  const nextLog = {
    ...existingLog,
    executionMode: agentRunner,
    runner: agentRunner,
    logs: [...logs, logEntry],
    lastUpdated: now,
    runSummary,
    codexRun: {
      ...codexRun,
      runDir: resumeResult.runDir,
      threadId: resumeResult.threadId || threadId || null,
      exitCode: resumeResult.exitCode,
      timedOut: Boolean(resumeResult.timedOut),
      lastResumedAt: now,
      runner: agentRunner,
    },
  };
  const record = await store.updateAgentHistoryRecord(recordId, {
    status: resumeResult.status,
    executionMode: agentRunner,
    runner: agentRunner,
    log: nextLog,
  });

  return {
    ok: resumeResult.status === "complete",
    status: resumeResult.status,
    recordStatus: resumeResult.status,
    recordId: record?.recordId || recordId,
    record,
    agentRun: record,
    summary: runSummary.summary,
    runSummary,
    logEntry,
    codexResult: resumeResult,
  };
}

export async function runLocalBlueprintPreflight({
  store,
  recordId = null,
  blueprintId = null,
  blueprint,
  planPayload,
  title = null,
  authProfile,
  regions = [],
  defaultValues = {},
  executionPreferences = {},
  selectedTarget = null,
  selectedWorkloadOrStack = null,
  configurationMode = null,
  stackAction = null,
  existingStack = null,
  existingStacks = [],
  additionalInstructions = null,
  preflightAnswer = null,
  skipBlueprintRewrite = false,
  onPrepEvent = null,
} = {}) {
  const { accountsService, workloadsService } = createCloudAgentTools({
    store,
    selectedAuthProfile: authProfile,
  });
  const permissionProfileId =
    authProfile?.permissionProfileId || authProfile?.recordId || authProfile?.id || null;
  const accountId = authProfile?.awsAccountId || authProfile?.accountId || null;
  const blueprintForAnalysis = planPayload || (blueprint ? parseStoredJsonValue(blueprint.plan, {}) : {});
  const preflightResult = await runSkillPreflight({
    userId: DEFAULT_AUTH.userId,
    accountId,
    permissionProfileId,
    blueprint: blueprintForAnalysis,
    accountsService,
    workloadsService,
    regions,
    defaultValues,
    executionPreferences,
    selectedTarget: selectedTarget || selectedWorkloadOrStack,
    selectedWorkloadOrStack,
    configurationMode,
    stackAction,
    existingStack,
    existingStacks,
    additionalInstructions,
    preflightAnswer,
    canRewrite: !skipBlueprintRewrite && isLocalOpenAIConfigured(),
    onPrepEvent,
  });
  const debugArtifact = await writeLocalUpdatedBlueprintDebugFile({
    store,
    blueprintId,
    title: title || blueprintForAnalysis?.title || blueprint?.title || null,
    recordId,
    preflightResult,
  }).catch((error) => {
    console.warn("[local skill preflight] failed to write updated skill debug file", {
      recordId,
      blueprintId,
      error: error?.message || String(error),
    });
    return null;
  });

  if (debugArtifact) {
    preflightResult.debugArtifacts = {
      ...(preflightResult.debugArtifacts || {}),
      updatedBlueprint: debugArtifact,
    };
    preflightResult.updatedBlueprintDebugFile = debugArtifact.filePath;
    console.log("[local skill preflight] updated skill debug file written", {
      recordId,
      blueprintId,
      fileName: debugArtifact.fileName,
      filePath: debugArtifact.filePath,
    });
    if (typeof onPrepEvent === "function") {
      onPrepEvent("prep_progress", {
        phase: "rewrite_blueprint",
        message: `Updated blueprint written to ${debugArtifact.filePath}.`,
        updatedBlueprintFile: debugArtifact.filePath,
        debugArtifact,
      });
    }
  }

  return preflightResult;
}
