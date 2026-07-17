import path from "node:path";
import { AGENT_RUN_EVENT_TYPES, buildCloudAgentMcpInstructionLines, codingAgentRunnerLabel, normalizeAgentRawStreamChunk, normalizeCodingAgentRunner } from "@cloudagent/agent-runtime";
import { safeTrim } from "@cloudagent/platform/utils";
import { isLocalOpenAIConfigured } from "../../platform/openai.mjs";
import { resumeLocalExternalAgentBlueprint, runLocalExternalAgentBlueprint } from "../skills/codex-runner.mjs";
import { buildCodexLocalDataSnapshot, buildExternalAgentMcpStreamEvent, buildLocalMcpUrl, getLocalCodingAgentSettings, isLocalCodingAgentExecutionMode, subscribeToLocalMcpRunEvents } from "../agent-runs/agent-run-service.mjs";
import { getLocalCodexSettings } from "../settings/settings-service.mjs";
import { buildExternalAgentCloudAgentOperatingGuide } from "../skills/skill-service.mjs";

export const commandCenterExternalSessions = new Map();

export function buildLocalCommandCenterSuggestions({ profiles = [], workloads = [] } = {}) {
  const cards = [];
  if (profiles.length === 0) {
    cards.push({
      id: "local-add-aws-account",
      title: "Add an AWS account",
      description: "Connect a local AWS profile before discovering workloads.",
      intent: "navigate",
      payload: { path: "/dashboard/cloud-setup" },
      actions: [{ label: "Open Cloud Setup", intent: "navigate", payload: { path: "/dashboard/cloud-setup" } }],
    });
  }
  if (profiles.length > 0) {
    cards.push({
      id: "local-discover-workloads",
      title: "Discover workloads",
      description: "Scan the selected AWS account with local credentials and review workload candidates.",
      intent: "navigate",
      payload: { path: "/dashboard/workloads", state: { openDiscoverWorkloadsModal: true } },
      actions: [{ label: "Open Workloads", intent: "navigate", payload: { path: "/dashboard/workloads" } }],
    });
  }
  if (workloads.length > 0) {
    cards.push({
      id: "local-summarize-workloads",
      title: "Review executive summaries",
      description: "Generate a local executive summary from saved workload and environment metadata.",
      intent: "navigate",
      payload: { path: "/dashboard/executive-summaries" },
      actions: [{ label: "Open Summaries", intent: "navigate", payload: { path: "/dashboard/executive-summaries" } }],
    });
  }
  return cards;
}

export async function buildLocalCommandCenterState({ store, chatId }) {
  const [profiles, workloads, workflowRuns, agentHistory] = await Promise.all([
    store.listPermissionProfiles(),
    store.listWorkloads(),
    store.listWorkflowRuns(),
    store.listAgentHistory(),
  ]);
  const cards = buildLocalCommandCenterSuggestions({ profiles, workloads });
  return {
    ok: true,
    runtime: "local",
    chatId: chatId || `local-chat-${Date.now()}`,
    goal: {
      goalId: "local-command-center",
      title: "Local CloudAgent",
      status: "active",
    },
    briefing: {
      source: isLocalOpenAIConfigured() ? "local-openai-ready" : "local",
      sentence: `${profiles.length} local environment(s), ${workloads.length} workload(s), ${workflowRuns.length} workflow run(s), and ${agentHistory.length} agent run(s) are available.`,
    },
    chatStartBrief: { cards },
    rightRail: { cards: [] },
    limits: {
      environments: { max: null, count: profiles.length },
      workloads: { max: null, count: workloads.length },
      workflows: { max: null, count: workflowRuns.length },
      agents: { max: null, count: agentHistory.length },
      reports: { max: null, count: 0 },
    },
  };
}

export function sendSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data ?? null)}\n\n`);
}

export function normalizeCommandCenterAgentRunner(value) {
  const normalized = normalizeCodingAgentRunner(value);
  return isLocalCodingAgentExecutionMode(normalized) ? normalized : "cloudagent";
}

export function commandCenterExternalSessionKey(chatId, runner) {
  return `${runner}:${safeTrim(chatId) || "local-command-center"}`;
}

export function normalizeCommandCenterExternalSessionMetadata(value, runner) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const normalizedRunner = normalizeCommandCenterAgentRunner(value.runner || value.agentRunner || runner);
  if (normalizedRunner !== normalizeCommandCenterAgentRunner(runner)) return null;
  const runDir = safeTrim(value.runDir || value.directory || value.cwd);
  const threadId = safeTrim(value.threadId || value.sessionId || value.externalSessionId);
  if (!runDir && !threadId) return null;
  return {
    runner: normalizedRunner,
    runnerLabel: codingAgentRunnerLabel(normalizedRunner),
    recordId: safeTrim(value.recordId || value.runId) || null,
    chatId: safeTrim(value.chatId) || null,
    sessionKey: safeTrim(value.sessionKey) || null,
    runDir: runDir || null,
    directory: runDir || null,
    threadId: threadId || null,
    sessionId: threadId || null,
    workspaceDir: safeTrim(value.workspaceDir) || null,
    status: safeTrim(value.status) || null,
    updatedAt: value.updatedAt || null,
  };
}

export function buildCommandCenterExternalSkillMarkdown({ runner = "codex" } = {}) {
  const runnerLabel = codingAgentRunnerLabel(runner);
  const mcpLines = buildCloudAgentMcpInstructionLines({ runner, mcpEnabled: true });
  return [
    `# CloudAgent Command Center ${runnerLabel} Session`,
    "",
    "Use this skill when responding to CloudAgent Command Center chat turns in local desktop mode.",
    "",
    "## Operating Rules",
    "",
    "- Answer the user's latest Command Center message directly and concisely.",
    "- Use CloudAgent MCP tools for CloudAgent data, artifacts, and cloud CLI work.",
    "- For questions about all onboarded environments/accounts, call MCP `permission_profile_list` or `list_permission_profiles` before answering.",
    "- For questions about all workloads, workflows, artifacts, skills, or agent history, call the relevant MCP `list_*` discovery tool before answering.",
    "- Before loading a large artifact payload, call `list_artifacts` or `get_artifact` without `includePayload` and inspect the returned metadata/reference.",
    "- Call `get_artifact` with `includePayload: true` only when the actual JSON payload is needed for the answer.",
    "- Executive summaries are exposed as `executive_summary` artifacts.",
    "- Do not claim a CLI command, scan, or artifact read was performed unless the relevant MCP tool was actually called.",
    "- Keep the final response user-facing. Do not mention MCP, tool names, `SKILL.md`, artifact copying, or other behind-the-scenes mechanics unless the user asks for implementation details or a tool/setup problem affects the result.",
    ...mcpLines,
    "",
    buildExternalAgentCloudAgentOperatingGuide({
      clientId: `command-center-${normalizeCodingAgentRunner(runner)}`,
    }),
  ].join("\n");
}

export function buildCommandCenterExternalPrompt({ message, isResume = false } = {}) {
  return [
    isResume
      ? "Continue the existing CloudAgent Command Center session."
      : "Start this CloudAgent Command Center session.",
    "",
    "Latest user message:",
    String(message || "").trim(),
    "",
    "Use CloudAgent data access when needed. Return concise user-facing Markdown. Do not describe internal tool calls, MCP, files, or setup mechanics unless they directly affect the result.",
  ].join("\n");
}

export function appendExternalStreamText(currentValue, nextValue) {
  const current = String(currentValue || "");
  const next = String(nextValue || "");
  if (!next.trim()) return current;
  if (!current) return next;
  if (next.startsWith(current)) return next;
  if (current.includes(next)) return current;
  return `${current}${current.endsWith("\n") || next.startsWith("\n") ? "" : ""}${next}`;
}

export function parseExternalToolPayload(value, fallback = null) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch {
    return fallback;
  }
}

export function extractExternalToolPayloads(rawEvent = {}, payload = {}) {
  const raw = rawEvent && typeof rawEvent === "object" ? rawEvent : {};
  const rawInput = parseExternalToolPayload(
    raw.args ||
      raw.arguments ||
      raw.input ||
      raw.item?.arguments ||
      raw.item?.input ||
      null,
    null
  );
  const rawOutput = parseExternalToolPayload(
    raw.result ||
      raw.output ||
      raw.item?.output ||
      raw.item?.result ||
      payload.output ||
      null,
    null
  );
  return { rawInput, rawOutput };
}

export function normalizeExternalCommandCenterEvent(rawEvent, { runner, recordId, onToken, onContextEvent, onTerminalEvent, state }) {
  const normalizedEvents = normalizeAgentRawStreamChunk(rawEvent, {
    runner,
    runId: recordId,
  });
  for (const event of normalizedEvents) {
    const eventType = event?.type;
    const payload = event?.payload || {};
    if (eventType === AGENT_RUN_EVENT_TYPES.MESSAGE_DELTA) {
      const text = String(payload.text || "");
      if (text && typeof onToken === "function") {
        state.streamedText = appendExternalStreamText(state.streamedText, text);
        onToken(text);
      }
      continue;
    }
    if (eventType === AGENT_RUN_EVENT_TYPES.TERMINAL_OUTPUT) {
      if (["codex_stdout", "codex_stderr"].includes(String(rawEvent?.type || ""))) {
        continue;
      }
      const terminalEvent = {
        type: "terminal_output",
        runner,
        recordId,
        commandId: event.callId || null,
        timestamp: event.timestamp || new Date().toISOString(),
        ...payload,
      };
      if (typeof onTerminalEvent === "function") onTerminalEvent(terminalEvent);
      continue;
    }
    if (eventType === AGENT_RUN_EVENT_TYPES.TOOL_STARTED || eventType === AGENT_RUN_EVENT_TYPES.TOOL_COMPLETED) {
      const toolName = payload.toolName || payload.command || "cloudagent_mcp";
      const { rawInput, rawOutput } = extractExternalToolPayloads(event.raw || rawEvent, payload);
      const toolEvent = {
        type: "tool_execution",
        sourceTool: toolName,
        input: rawInput || payload.command || null,
        output: rawOutput || payload.output || null,
        status: eventType === AGENT_RUN_EVENT_TYPES.TOOL_COMPLETED ? "completed" : "running",
        raw: event,
      };
      state.toolExecutions.push({
        id: event.callId || `${toolEvent.sourceTool}-${state.toolExecutions.length + 1}`,
        name: toolEvent.sourceTool,
        input: toolEvent.input,
        output: toolEvent.output,
        status: toolEvent.status,
      });
      if (typeof onContextEvent === "function") onContextEvent(toolEvent);
    }
  }
}

export async function runLocalExternalAgentCommandCenterChat({
  req,
  store,
  runner = "codex",
  chatId,
  message,
  externalAgentSession = null,
  onToken,
  onContextEvent,
  onTerminalEvent,
}) {
  const executionMode = normalizeCommandCenterAgentRunner(runner);
  if (!isLocalCodingAgentExecutionMode(executionMode)) return null;

  const runnerLabel = codingAgentRunnerLabel(executionMode);
  const recordId = `command-center-${safeTrim(chatId) || Date.now()}`;
  const sessionKey = commandCenterExternalSessionKey(chatId, executionMode);
  const previousSession =
    commandCenterExternalSessions.get(sessionKey) ||
    normalizeCommandCenterExternalSessionMetadata(externalAgentSession, executionMode);
  const authProfile = null;
  const localDataSnapshot = await buildCodexLocalDataSnapshot(store, {
    authProfile: authProfile || {},
    selectedWorkloadOrStack: null,
  });
  const codexSettings = await getLocalCodexSettings(store);
  const agentSettings = getLocalCodingAgentSettings(codexSettings, executionMode);
  const mcpUrl = buildLocalMcpUrl(req, {
    recordId,
    runner: executionMode,
    authProfile,
  });
  const eventState = {
    streamedText: "",
    toolExecutions: [],
    contextEvents: [],
  };
  const handleEvent = (event) => normalizeExternalCommandCenterEvent(event, {
    runner: executionMode,
    recordId,
    onToken,
    onContextEvent,
    onTerminalEvent,
    state: eventState,
  });
  const mcpForwarder = subscribeToLocalMcpRunEvents({
    req,
    recordId,
    runner: executionMode,
    onEvent: handleEvent,
    onMcpEvent: (event) => {
      if (event?.type === "terminal_output") {
        const terminalEvent = {
          ...event,
          runner: executionMode,
          recordId,
        };
        if (typeof onTerminalEvent === "function") onTerminalEvent(terminalEvent);
        return;
      }
      handleEvent(buildExternalAgentMcpStreamEvent(event, executionMode));
    },
  });

  let result;
  try {
    if (previousSession?.runDir) {
      result = await resumeLocalExternalAgentBlueprint({
        runner: executionMode,
        threadId: previousSession.threadId || null,
        runDir: previousSession.runDir,
        prompt: buildCommandCenterExternalPrompt({ message, isResume: true }),
        authProfile: authProfile || {},
        mcpUrl,
        agentBinary: agentSettings.agentBinary,
        onEvent: handleEvent,
        onStdout: (content) => handleEvent({ type: "codex_stdout", content, runner: executionMode }),
        onStderr: (content) => handleEvent({ type: "codex_stderr", content, runner: executionMode }),
      });
    } else {
      result = await runLocalExternalAgentBlueprint({
        runner: executionMode,
        blueprintId: "command-center",
        title: "Command Center",
        blueprint: { title: "Command Center" },
        planPayload: { title: "Command Center", runner: executionMode },
        task: buildCommandCenterExternalPrompt({ message, isResume: false }),
        authProfile: authProfile || {},
        localDataSnapshot,
        mcpUrl,
        recordId,
        workspaceDir: agentSettings.workspaceDir,
        agentBinary: agentSettings.agentBinary,
        skillFiles: [
          {
            relativePath: "SKILL.md",
            content: buildCommandCenterExternalSkillMarkdown({ runner: executionMode }),
          },
        ],
        onEvent: handleEvent,
        onStdout: (content) => handleEvent({ type: "codex_stdout", content, runner: executionMode }),
        onStderr: (content) => handleEvent({ type: "codex_stderr", content, runner: executionMode }),
      });
    }
  } finally {
    mcpForwarder.cleanup();
  }

  const finalText = String(result?.output || result?.summary || "").trim() ||
    `${runnerLabel} completed without a final response.`;
  const runDir = result?.runDir || previousSession?.runDir || null;
  const threadId = result?.threadId || previousSession?.threadId || null;
  const updatedAt = new Date().toISOString();
  const sessionMetadata = {
    runner: executionMode,
    runnerLabel,
    recordId,
    chatId: safeTrim(chatId) || null,
    sessionKey,
    runDir,
    directory: runDir,
    threadId,
    sessionId: threadId,
    workspaceDir: agentSettings.workspaceDir || null,
    status: result?.status || "complete",
    resumed: Boolean(previousSession?.runDir || previousSession?.threadId),
    updatedAt,
  };
  commandCenterExternalSessions.set(sessionKey, sessionMetadata);
  return {
    text: finalText,
    responseId: `${executionMode}-${result?.threadId || Date.now()}`,
    status: result?.status || "complete",
    runner: executionMode,
    runnerLabel,
    runDir,
    threadId,
    recordId,
    sessionKey,
    externalAgent: sessionMetadata,
    toolExecutions: eventState.toolExecutions,
    contextEvents: eventState.contextEvents,
  };
}
