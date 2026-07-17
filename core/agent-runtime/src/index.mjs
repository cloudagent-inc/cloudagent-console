export const CLOUDAGENT_MCP_TOOLS = Object.freeze([
  "permission_profile_list",
  "list_permission_profiles",
  "get_permission_profile",
  "list_workloads",
  "get_workload",
  "update_workload",
  "cli_session_start",
  "cli_session_execute",
  "cli_session_status",
  "cli_session_end",
  "aws_cfn_operations",
  "get_deployment_preferences_summary",
  "list_workflow_defs",
  "list_workflow_runs",
  "get_workflow_run",
  "list_skills",
  "list_agent_history",
  "get_agent_run",
  "list_github_repos",
  "read_github_file",
  "create_github_branch",
  "write_github_file",
  "create_github_pull_request",
  "terraform_plan_check",
  "list_artifacts",
  "get_artifact",
  "launch_artifact",
  "architecture_templates",
  "diagram_spec",
]);

export const BUILT_IN_CODING_AGENT_RUNNERS = Object.freeze([
  Object.freeze({
    id: "codex",
    label: "Codex CLI",
    shortLabel: "Codex",
    aliases: Object.freeze(["codex_cli", "openai_codex"]),
    description: "Hand off this skill to Codex with CloudAgent context.",
    runDirName: "codex-runs",
    binarySettingPath: Object.freeze(["binary"]),
    workspaceSettingPath: Object.freeze(["workspaceDir"]),
    binaryEnvVars: Object.freeze(["CLOUDAGENT_CODEX_BIN", "CODEX_BIN"]),
    workspaceEnvVars: Object.freeze(["CLOUDAGENT_CODEX_WORKSPACE_DIR"]),
    runsDirEnvVars: Object.freeze(["CLOUDAGENT_CODEX_RUNS_DIR"]),
    defaultBinary: "codex",
    eventAdapter: "codex",
  }),
  Object.freeze({
    id: "claude",
    label: "Claude Code",
    shortLabel: "Claude Code",
    aliases: Object.freeze(["claude_code", "claude_cli", "anthropic_claude"]),
    description: "Hand off this skill to Claude Code with CloudAgent context.",
    runDirName: "claude-runs",
    binarySettingPath: Object.freeze(["claude", "binary"]),
    workspaceSettingPath: Object.freeze(["claude", "workspaceDir"]),
    binaryEnvVars: Object.freeze(["CLOUDAGENT_CLAUDE_BIN"]),
    workspaceEnvVars: Object.freeze(["CLOUDAGENT_CLAUDE_WORKSPACE_DIR"]),
    runsDirEnvVars: Object.freeze(["CLOUDAGENT_CLAUDE_RUNS_DIR"]),
    defaultBinary: "claude",
    eventAdapter: "claude",
  }),
  Object.freeze({
    id: "cursor",
    label: "Cursor Agent",
    shortLabel: "Cursor Agent",
    aliases: Object.freeze(["cursor_agent", "cursor_cli", "cursor_ai"]),
    description: "Hand off this skill to Cursor Agent with CloudAgent context.",
    runDirName: "cursor-runs",
    binarySettingPath: Object.freeze(["cursor", "binary"]),
    workspaceSettingPath: Object.freeze(["cursor", "workspaceDir"]),
    binaryEnvVars: Object.freeze(["CLOUDAGENT_CURSOR_BIN"]),
    workspaceEnvVars: Object.freeze(["CLOUDAGENT_CURSOR_WORKSPACE_DIR"]),
    runsDirEnvVars: Object.freeze(["CLOUDAGENT_CURSOR_RUNS_DIR"]),
    defaultBinary: "cursor-agent",
    eventAdapter: "cursor",
  }),
]);

export const CLOUDAGENT_RUNNER_DEFINITION = Object.freeze({
  id: "cloudagent",
  label: "CloudAgent",
  shortLabel: "CloudAgent",
  aliases: Object.freeze(["cloud_agent", "default"]),
  description: "Use the CloudAgent local agent runner.",
  eventAdapter: "cloudagent",
});

export const AGENT_RUNNER_DEFINITIONS = Object.freeze([
  CLOUDAGENT_RUNNER_DEFINITION,
  ...BUILT_IN_CODING_AGENT_RUNNERS,
]);

function normalizeRunnerId(value) {
  return String(value || "cloudagent").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function getCodingAgentRunnerDefinition(value) {
  const runner = normalizeRunnerId(value);
  return BUILT_IN_CODING_AGENT_RUNNERS.find(
    (definition) => definition.id === runner || definition.aliases.includes(runner)
  ) || null;
}

export function getAgentRunnerDefinition(value) {
  const runner = normalizeRunnerId(value);
  return AGENT_RUNNER_DEFINITIONS.find(
    (definition) => definition.id === runner || definition.aliases.includes(runner)
  ) || CLOUDAGENT_RUNNER_DEFINITION;
}

export function isBuiltInCodingAgentRunner(value) {
  return Boolean(getCodingAgentRunnerDefinition(value));
}

export function normalizeCodingAgentRunner(value) {
  return getCodingAgentRunnerDefinition(value)?.id || "cloudagent";
}

export function codingAgentRunnerLabel(value) {
  return getAgentRunnerDefinition(value).label;
}

export const AGENT_RUN_EVENT_SCHEMA_VERSION = 1;

export const AGENT_RUN_EVENT_TYPES = Object.freeze({
  MESSAGE_DELTA: "message.delta",
  MESSAGE_COMPLETED: "message.completed",
  TASK_STARTED: "task.started",
  TASK_COMPLETED: "task.completed",
  TASK_FAILED: "task.failed",
  TASK_STATUS: "task.status",
  TOOL_STARTED: "tool.started",
  TOOL_COMPLETED: "tool.completed",
  TERMINAL_OUTPUT: "terminal.output",
  SESSION_INFO: "session.info",
  RUN_STATUS: "run.status",
  RUN_COMPLETED: "run.completed",
  RAW: "raw",
});

function compactObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  );
}

function eventId(prefix = "agent-event") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createAgentRunEvent({
  type = AGENT_RUN_EVENT_TYPES.RAW,
  eventId: explicitEventId = null,
  runId = null,
  runner = "cloudagent",
  source = null,
  timestamp = null,
  phaseIndex = null,
  taskIndex = null,
  taskId = null,
  messageId = null,
  callId = null,
  payload = {},
  raw = null,
} = {}) {
  const normalizedRunner = normalizeCodingAgentRunner(runner || source || "cloudagent");
  return compactObject({
    schemaVersion: AGENT_RUN_EVENT_SCHEMA_VERSION,
    eventId: explicitEventId || eventId(),
    type: String(type || AGENT_RUN_EVENT_TYPES.RAW),
    runId: runId ? String(runId) : null,
    runner: normalizedRunner,
    source: source ? String(source) : normalizedRunner,
    timestamp: timestamp || new Date().toISOString(),
    phaseIndex: Number.isInteger(phaseIndex) ? phaseIndex : null,
    taskIndex: Number.isInteger(taskIndex) ? taskIndex : null,
    taskId: taskId ? String(taskId) : null,
    messageId: messageId ? String(messageId) : null,
    callId: callId ? String(callId) : null,
    payload: payload && typeof payload === "object" && !Array.isArray(payload) ? compactObject(payload) : {},
    raw,
  });
}

export function createAgentMessageEvent({
  text = "",
  completed = false,
  role = "assistant",
  messageId = null,
  ...rest
} = {}) {
  return createAgentRunEvent({
    ...rest,
    type: completed
      ? AGENT_RUN_EVENT_TYPES.MESSAGE_COMPLETED
      : AGENT_RUN_EVENT_TYPES.MESSAGE_DELTA,
    messageId,
    payload: {
      ...(rest.payload || {}),
      role,
      text: String(text || ""),
    },
  });
}

export function createAgentTaskEvent({
  status = "running",
  output = "",
  summary = "",
  runSummary = null,
  ...rest
} = {}) {
  const normalizedStatus = String(status || "running").toLowerCase();
  const type =
    ["running", "in-progress", "in_progress", "started"].includes(normalizedStatus)
      ? AGENT_RUN_EVENT_TYPES.TASK_STARTED
      : ["complete", "completed", "success"].includes(normalizedStatus)
        ? AGENT_RUN_EVENT_TYPES.TASK_COMPLETED
        : ["failed", "failure", "error"].includes(normalizedStatus)
          ? AGENT_RUN_EVENT_TYPES.TASK_FAILED
          : AGENT_RUN_EVENT_TYPES.TASK_STATUS;
  return createAgentRunEvent({
    ...rest,
    type,
    payload: {
      ...(rest.payload || {}),
      status,
      output,
      summary,
      runSummary,
    },
  });
}

export function createAgentRunStatusEvent({
  status = "running",
  completed = false,
  summary = "",
  runSummary = null,
  recordId = null,
  ...rest
} = {}) {
  return createAgentRunEvent({
    ...rest,
    type: completed ? AGENT_RUN_EVENT_TYPES.RUN_COMPLETED : AGENT_RUN_EVENT_TYPES.RUN_STATUS,
    payload: {
      ...(rest.payload || {}),
      status,
      summary,
      runSummary,
      recordId,
    },
  });
}

function parseJsonMaybe(value, fallback = null) {
  if (value == null) return fallback;
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

function extractAgentText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((entry) => extractAgentText(entry)).filter(Boolean).join("\n");
  }
  if (!value || typeof value !== "object") return "";
  if (typeof value.text === "string") return value.text;
  if (typeof value.delta === "string") return value.delta;
  if (typeof value.content === "string") return value.content;
  if (Array.isArray(value.content)) return extractAgentText(value.content);
  if (typeof value.message === "string") return value.message;
  if (typeof value.result === "string") return value.result;
  if (typeof value.output === "string") return value.output;
  return "";
}

function normalizeAgentMessageRole(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return null;
  if (["assistant", "agent", "model", "ai"].includes(text)) return "assistant";
  if (["user", "human", "system", "tool", "function"].includes(text)) return text;
  return null;
}

function inferAgentMessageRole(event = {}, type = "") {
  const candidates = [
    event.role,
    event.author?.role,
    event.message?.role,
    event.data?.role,
    event.item?.role,
    event.item?.author?.role,
  ];
  for (const candidate of candidates) {
    const role = normalizeAgentMessageRole(candidate);
    if (role) return role;
  }
  const normalizedType = String(type || "").trim().toLowerCase();
  if (["assistant", "agent", "message"].includes(normalizedType)) return "assistant";
  if (["user", "input", "prompt"].includes(normalizedType)) return "user";
  if (["system"].includes(normalizedType)) return "system";
  return "assistant";
}

function extractAgentMessageId(event = {}) {
  const candidates = [
    event.messageId,
    event.message_id,
    event.message?.id,
    event.data?.messageId,
    event.data?.message_id,
    event.data?.id,
    event.item?.id,
    event.id,
  ];
  for (const candidate of candidates) {
    const text = String(candidate || "").trim();
    if (text) return text;
  }
  return null;
}

function getValueByKeys(value, keys = []) {
  if (!value || typeof value !== "object") return undefined;
  const wanted = new Set(keys);
  const stack = [value];
  const seen = new Set();
  while (stack.length > 0) {
    const current = stack.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    for (const [key, child] of Object.entries(current)) {
      if (wanted.has(key) && child != null && child !== "") return child;
      if (child && typeof child === "object") stack.push(child);
    }
  }
  return undefined;
}

function normalizeToolPayload(value) {
  const parsed = parseJsonMaybe(value, value);
  if (Array.isArray(parsed)) {
    const text = parsed
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry?.type === "text" && typeof entry.text === "string") return entry.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
    return parseJsonMaybe(text, text || parsed);
  }
  if (parsed?.content && Array.isArray(parsed.content)) {
    return normalizeToolPayload(parsed.content);
  }
  return parsed;
}

function findKnownToolName(value) {
  if (!value || typeof value !== "object") return null;
  const candidates = [];
  const visit = (entry) => {
    if (!entry || typeof entry !== "object") return;
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    candidates.push(
      entry.sourceTool,
      entry.tool_name,
      entry.toolName,
      entry.name,
      entry.tool,
      entry.function?.name,
      entry.type === "function_call" ? entry.name : null,
      entry.type === "tool_use" ? entry.name : null,
      entry.type === "tool_call" ? entry.name : null
    );
    for (const key of ["message", "content", "data", "item", "function", "toolCall", "tool_call"]) {
      visit(entry[key]);
    }
  };
  visit(value);
  for (const candidate of candidates) {
    const text = String(candidate || "").trim();
    if (CLOUDAGENT_MCP_TOOLS.includes(text)) return text;
  }
  return null;
}

function normalizeExternalToolEvent(event, context = {}) {
  const toolName = findKnownToolName(event);
  if (!toolName) return null;
  const item = event?.item && typeof event.item === "object" ? event.item : null;
  const rawInput =
    event?.output?.input ??
    item?.arguments ??
    item?.args ??
    item?.input ??
    item?.params ??
    item?.tool_input ??
    item?.toolInput ??
    event?.arguments ??
    event?.args ??
    event?.input ??
    event?.params ??
    {};
  const input = normalizeToolPayload(rawInput);
  const outputPayload = normalizeToolPayload(
    event?.output?.result ??
    item?.output ??
      item?.result ??
      item?.content ??
      item?.structuredContent ??
      event?.output ??
      event?.result ??
      event?.content ??
      event?.structuredContent ??
      {}
  );
  const command =
    getValueByKeys(input, ["command", "cli_command"]) ||
    getValueByKeys(outputPayload, ["command", "cli_command"]) ||
    getValueByKeys(input, ["stackName", "path", "repoFullName", "branch", "title"]) ||
    getValueByKeys(outputPayload, ["stackName", "path", "repoFullName", "branch", "title"]) ||
    toolName;
  const output =
    getValueByKeys(outputPayload, ["stdout"]) ||
    getValueByKeys(outputPayload, ["stderr"]) ||
    extractAgentText(outputPayload) ||
    (outputPayload && typeof outputPayload === "object" && Object.keys(outputPayload).length
      ? JSON.stringify(outputPayload, null, 2)
      : "");
  const typeText = String(event?.type || item?.type || "").toLowerCase();
  const statusText = String(event?.status || item?.status || "").toLowerCase();
  const completed =
    typeText === "tool_execution" ||
    typeText.includes("completed") ||
    typeText.includes("result") ||
    ["completed", "failed", "error", "success"].includes(statusText);
  const started = typeText.includes("started") || statusText === "in_progress";

  return createAgentRunEvent({
    ...context,
    type: completed
      ? AGENT_RUN_EVENT_TYPES.TOOL_COMPLETED
      : started
        ? AGENT_RUN_EVENT_TYPES.TOOL_STARTED
        : AGENT_RUN_EVENT_TYPES.TOOL_STARTED,
    callId: item?.id || item?.call_id || event?.id || event?.call_id || null,
    payload: {
      toolName,
      command: String(command || toolName),
      output: String(output || ""),
      status: completed ? "completed" : "running",
    },
    raw: event,
  });
}

function formatShellCommand(command) {
  const text = String(command || "").trim();
  const shellPrefix = "/bin/zsh -lc ";
  if (!text.startsWith(shellPrefix)) return text;
  const shellCommand = text.slice(shellPrefix.length).trim();
  if (
    (shellCommand.startsWith("'") && shellCommand.endsWith("'")) ||
    (shellCommand.startsWith('"') && shellCommand.endsWith('"'))
  ) {
    return shellCommand.slice(1, -1);
  }
  return shellCommand;
}

export function normalizeAgentRawStreamChunk(chunk, context = {}) {
  const base = {
    runId: context.runId || context.recordId || null,
    runner: context.runner || chunk?.runner || chunk?.event?.runner || "cloudagent",
    taskId: context.taskId || null,
    phaseIndex: Number.isInteger(context.phaseIndex) ? context.phaseIndex : null,
    taskIndex: Number.isInteger(context.taskIndex) ? context.taskIndex : null,
  };
  const sourceType = String(chunk?.type || "").trim();

  if (sourceType === "codex_stdout" || sourceType === "codex_stderr") {
    const text = String(chunk?.content || chunk?.text || "");
    if (!text) return [];
    return [
      createAgentRunEvent({
        ...base,
        type: AGENT_RUN_EVENT_TYPES.TERMINAL_OUTPUT,
        payload: {
          command: codingAgentRunnerLabel(base.runner),
          output: text,
          stream: sourceType.endsWith("stderr") ? "stderr" : "stdout",
        },
        raw: chunk,
      }),
    ];
  }

  const event = chunk?.event && typeof chunk.event === "object" ? chunk.event : chunk;
  if (!event || typeof event !== "object") return [];
  const runner = normalizeCodingAgentRunner(event.runner || base.runner);
  const normalizedBase = { ...base, runner };
  const type = String(event.type || "").trim();
  const item = event?.item && typeof event.item === "object" ? event.item : null;

  if (item?.type === "command_execution" || event?.type === "command_execution") {
    const command = formatShellCommand(item?.command || event.command || "command");
    const output = extractAgentText(
      item?.output ??
        item?.result ??
        item?.content ??
        event.output ??
        event.result ??
        event.content
    );
    const completed =
      type.includes("completed") ||
      ["completed", "failed", "error", "success"].includes(String(item?.status || event.status || "").toLowerCase());
    return [
      createAgentRunEvent({
        ...normalizedBase,
        type: AGENT_RUN_EVENT_TYPES.TERMINAL_OUTPUT,
        callId: item?.id || event.id || null,
        payload: {
          command,
          output: completed
            ? [output ? `Output:\n${output}` : null].filter(Boolean).join("\n") || "[completed] Command\n"
            : "[running] Command\n",
        },
        raw: event,
      }),
    ];
  }

  const toolEvent = normalizeExternalToolEvent(event, normalizedBase);
  if (toolEvent) return [toolEvent];

  if (type === "agent_runtime_debug") {
    return [
      createAgentRunEvent({
        ...normalizedBase,
        type: AGENT_RUN_EVENT_TYPES.SESSION_INFO,
        payload: {
          text: event.stage ? `Runtime: ${event.stage}` : "Runtime event",
          stage: event.stage || null,
        },
        raw: event,
      }),
    ];
  }

  if (type === "thread.started" || type === "session.started") {
    return [
      createAgentRunEvent({
        ...normalizedBase,
        type: AGENT_RUN_EVENT_TYPES.SESSION_INFO,
        payload: {
          text: `${codingAgentRunnerLabel(runner)} session started.`,
          threadId: event.thread_id || event.threadId || null,
        },
        raw: event,
      }),
    ];
  }

  if (type === "error") {
    return [
      createAgentRunEvent({
        ...normalizedBase,
        type: AGENT_RUN_EVENT_TYPES.SESSION_INFO,
        payload: {
          text: event.message || event.error || "External agent reported an error.",
          level: "error",
        },
        raw: event,
      }),
    ];
  }

  const text = extractAgentText(
    event.delta ??
      event.text ??
      event.message ??
      event.content ??
      event.result ??
      event.output ??
      event.data?.delta ??
      event.data?.text ??
      event.data?.message ??
      event.data?.content ??
      event.item?.text ??
      event.item?.content
  );
  if (String(text || "").trim()) {
    const lowerType = type.toLowerCase();
    if (runner === "cursor" && ["output", "text", "stdout"].includes(lowerType)) {
      return [];
    }
    const role = inferAgentMessageRole(event, type);
    if (role && role !== "assistant") {
      return [];
    }
    const completed =
      lowerType === "result" ||
      lowerType === "final" ||
      lowerType.endsWith(".completed") ||
      lowerType.includes("complete") ||
      (runner === "cursor" && ["assistant", "message"].includes(lowerType));
    return [
      createAgentMessageEvent({
        ...normalizedBase,
        completed,
        role: role || "assistant",
        messageId: extractAgentMessageId(event),
        text,
        raw: event,
      }),
    ];
  }

  return [
    createAgentRunEvent({
      ...normalizedBase,
      type: AGENT_RUN_EVENT_TYPES.RAW,
      payload: {
        providerType: type || null,
        render: false,
      },
      raw: event,
    }),
  ];
}

export function buildCodexTomlString(value) {
  return JSON.stringify(String(value || ""));
}

export function buildCodexCloudAgentMcpConfigToml(mcpUrl) {
  return [
    "[mcp_servers.cloudagent]",
    `url = "${String(mcpUrl || "").replace(/"/g, '\\"')}"`,
    `enabled_tools = ${JSON.stringify(CLOUDAGENT_MCP_TOOLS)}`,
    'default_tools_approval_mode = "approve"',
    "tool_timeout_sec = 120",
    "",
    ...CLOUDAGENT_MCP_TOOLS.flatMap((toolName) => [
      `[mcp_servers.cloudagent.tools.${toolName}]`,
      'approval_mode = "approve"',
      "",
    ]),
    "",
  ].join("\n");
}

export function buildCloudAgentMcpJsonConfig(mcpUrl) {
  return {
    mcpServers: {
      cloudagent: {
        type: "http",
        url: String(mcpUrl || ""),
        alwaysLoad: true,
        timeout: 120_000,
        enabledTools: CLOUDAGENT_MCP_TOOLS,
      },
    },
  };
}

export function buildCursorCloudAgentMcpJsonConfig(mcpUrl) {
  return buildCloudAgentMcpJsonConfig(mcpUrl);
}

export function formatCloudAgentMcpToolsList() {
  return CLOUDAGENT_MCP_TOOLS.map((toolName) => `\`${toolName}\``).join(", ");
}

export function buildCloudAgentMcpInstructionLines({ runner = "codex", mcpEnabled = true } = {}) {
  const normalizedRunner = normalizeCodingAgentRunner(runner);
  if (!mcpEnabled) {
    return [
      "- Use the Execution Context section to understand the selected AWS account/profile and region.",
      "- For approved CloudFormation configuration changes, use AWS CLI/CloudFormation commands directly with the injected environment credentials.",
      "- For repo-based delivery, use local git commands only when a local checkout path is present in the execution context.",
      "- Do not ask the user where credentials are stored. Do not rely on ~/.aws/config, ~/.aws/credentials, or `aws configure list` to find credentials. The process environment is the credential source of truth.",
      "- First validate AWS access with `aws sts get-caller-identity --output json`, then continue with the skill-specific read-only AWS CLI commands.",
    ];
  }

  return [
    normalizedRunner === "cursor"
      ? "- Cursor MCP configuration for this run is written to .cursor/mcp.json and .mcp.json in this workspace."
      : null,
    "- For cloud CLI work, call `cli_session_start` once, keep its returned `cliSessionId`, and pass that ID to later `cli_session_execute`, `cli_session_status`, and `cli_session_end` calls. CloudAgent may reuse an exact session already attached to this run scope and environment.",
    "- If `permissionProfileId`, `accountId`, or `region` are omitted, CloudAgent uses the current run context when one is attached to the MCP URL.",
    "- If the execution plan says `cli_session_command_execute`, interpret that as a request to call CloudAgent MCP `cli_session_execute` with the specified shell command. Do not treat `cli_session_command_execute` as a local shell command outside MCP.",
    `- Available CloudAgent MCP tools for this run: ${formatCloudAgentMcpToolsList()}.`,
    "- For questions about onboarded environments/accounts, call MCP `permission_profile_list` or `list_permission_profiles`; for workload questions, call MCP `list_workloads`; for saved runs/history, call the relevant `list_*` MCP tool.",
    "- For approved CloudFormation configuration changes, use MCP `aws_cfn_operations` instead of running mutating AWS CLI commands directly.",
    "- Treat every CloudFormation policy failure or lint error as a hard pre-deployment gate. Revise the template and retry `aws_cfn_operations` until validation passes; never deploy or report success from a failed validation result.",
    "- After CloudFormation succeeds, report the returned stack name, stack ID/ARN, status, region/account, and stack URL. If a change set was created, report its ID/status and explicitly state that the stack was not deployed.",
    "- For repo-based delivery, use MCP `list_github_repos`, `read_github_file`, `create_github_branch`, `write_github_file`, and `create_github_pull_request` when a local checkout or repo path is configured.",
    "- Make all repository changes through the CloudAgent github tools, not the agent shell; the tools enforce branch, path, and secret guardrails deterministically.",
    "- Deliver changes as pull requests only. Never commit or push directly to a protected branch (for example `main`/`master`); create a branch with `create_github_branch` first.",
    "- New branches must use the configured branch prefix (for example `cloudagent/`); if a branch is rejected for a missing prefix, retry with the tool's `suggestedBranch`.",
    "- After changing Terraform/OpenTofu files, call MCP `terraform_plan_check` before creating the pull request. Revise and recheck mapped policy failures; do not open a PR with known selected-policy findings. Stop and report incomplete coverage or an unresolvable finding, and include a passing plan/policy summary in the PR body.",
    "- If a GitHub tool rejects a branch, path, content change, or pull request, correct the request and retry; never report success from a rejected result.",
    "- Do not call the MCP HTTP endpoint directly with curl or JSON-RPC. If native CloudAgent MCP tools are not exposed in the agent session, stop and report that the MCP server did not load.",
    "- Do not run cloud CLI commands directly from the agent process shell for account inspection; use the MCP CLI session tools.",
    "- First validate AWS access by calling MCP `cli_session_execute` with `aws sts get-caller-identity --output json`, then continue with skill-specific CLI commands through that same CLI session.",
    "- Keep final answers user-facing. Do not mention MCP, tool names, internal files, reading `SKILL.md`, copying artifacts, or other behind-the-scenes mechanics unless the user asks for implementation details or a tool/setup problem affects the result.",
  ].filter(Boolean);
}
