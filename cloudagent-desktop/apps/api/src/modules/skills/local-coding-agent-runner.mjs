import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  CLOUDAGENT_MCP_TOOLS,
  buildCloudAgentMcpJsonConfig,
  buildCodexCloudAgentMcpConfigToml,
  buildCodexTomlString,
  buildCursorCloudAgentMcpJsonConfig,
  codingAgentRunnerLabel,
  getCodingAgentRunnerDefinition,
  normalizeCodingAgentRunner,
} from "@cloudagent/agent-runtime";

function safeJson(value) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return JSON.stringify(null, null, 2);
  }
}

function compactText(value, maxLength = 24_000) {
  const text = typeof value === "string" ? value : safeJson(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n...[truncated]` : text;
}

function parseMaybeJson(value, fallback = {}) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeAuthProfile(authProfile = {}) {
  const direct = authProfile && typeof authProfile === "object" ? authProfile : {};
  const nestedAuthProfile = parseMaybeJson(direct.authProfile, {});
  const nestedCredentials = parseMaybeJson(direct.credentials, {});
  return {
    ...direct,
    ...(nestedAuthProfile && typeof nestedAuthProfile === "object" ? nestedAuthProfile : {}),
    ...(nestedCredentials && typeof nestedCredentials === "object" ? nestedCredentials : {}),
  };
}

export { codingAgentRunnerLabel, normalizeCodingAgentRunner };

function slug(value, runner = "codex") {
  const text = String(value || `${runner}-run`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return text || `${runner}-run`;
}

function getCodingAgentRunsRoot(workspaceDir = null, runner = "codex") {
  const definition = getCodingAgentRunnerDefinition(runner);
  if (definition?.id === "cursor") {
    const explicitRunsDir = definition.runsDirEnvVars
      .map((key) => process.env[key])
      .find(Boolean);
    return (
      explicitRunsDir ||
      process.env.CLOUDAGENT_CODE_AGENT_RUNS_DIR ||
      path.join(os.homedir(), ".cloudagent", definition.runDirName)
    );
  }
  const workspaceEnvDir = definition?.workspaceEnvVars
    ?.map((key) => process.env[key])
    .find(Boolean);
  const explicitRunsDir = definition?.runsDirEnvVars
    ?.map((key) => process.env[key])
    .find(Boolean);
  const baseWorkspace =
    workspaceDir ||
    workspaceEnvDir ||
    process.env.CLOUDAGENT_CODE_AGENT_WORKSPACE_DIR ||
    process.env.CLOUDAGENT_CODEX_WORKSPACE_DIR ||
    process.cwd();
  return (
    explicitRunsDir ||
    process.env.CLOUDAGENT_CODE_AGENT_RUNS_DIR ||
    process.env.CLOUDAGENT_CODEX_RUNS_DIR ||
    path.join(baseWorkspace, ".cloudagent", definition?.runDirName || `${runner}-runs`)
  );
}

function buildAwsCredentialEnv(authProfile = {}) {
  const normalizedAuthProfile = normalizeAuthProfile(authProfile);
  const env = {};
  const accessKeyId = normalizedAuthProfile.accessKeyId || normalizedAuthProfile.awsAccessKeyId || normalizedAuthProfile.AWS_ACCESS_KEY_ID;
  const secretAccessKey = normalizedAuthProfile.secretAccessKey || normalizedAuthProfile.awsSecretAccessKey || normalizedAuthProfile.AWS_SECRET_ACCESS_KEY;
  const sessionToken = normalizedAuthProfile.sessionToken || normalizedAuthProfile.awsSessionToken || normalizedAuthProfile.AWS_SESSION_TOKEN;
  const profile = normalizedAuthProfile.awsProfile || normalizedAuthProfile.profileName || normalizedAuthProfile.profile || null;
  const region = normalizedAuthProfile.region || normalizedAuthProfile.defaultRegion || normalizedAuthProfile.awsRegion || null;

  if (accessKeyId && secretAccessKey) {
    env.AWS_ACCESS_KEY_ID = String(accessKeyId);
    env.AWS_SECRET_ACCESS_KEY = String(secretAccessKey);
    if (sessionToken) env.AWS_SESSION_TOKEN = String(sessionToken);
  } else if (profile) {
    env.AWS_PROFILE = String(profile);
  }
  if (region) {
    env.AWS_REGION = String(region);
    env.AWS_DEFAULT_REGION = String(region);
  }
  return env;
}

function normalizeCursorAgentBinary(value) {
  const configured = String(value || "").trim();
  if (configured && configured !== "agent") return configured;
  return String(process.env.CLOUDAGENT_CURSOR_BIN || "cursor-agent").trim() || "cursor-agent";
}

function getCodexExecOptions({ mcpUrl = null } = {}) {
  const args = ["-c", "shell_environment_policy.inherit=all"];
  if (String(process.env.CLOUDAGENT_CODEX_IGNORE_USER_CONFIG ?? "true").toLowerCase() !== "false") {
    args.push("--ignore-user-config");
  }
  if (mcpUrl) {
    args.push(
      "-c",
      `mcp_servers.cloudagent.url=${buildCodexTomlString(mcpUrl)}`,
      "-c",
      `mcp_servers.cloudagent.enabled_tools=${JSON.stringify(CLOUDAGENT_MCP_TOOLS)}`,
      "-c",
      'mcp_servers.cloudagent.default_tools_approval_mode="approve"',
      "-c",
      "mcp_servers.cloudagent.tool_timeout_sec=120",
      ...CLOUDAGENT_MCP_TOOLS.flatMap((toolName) => [
        "-c",
        `mcp_servers.cloudagent.tools.${toolName}.approval_mode="approve"`,
      ])
    );
  }
  const sandbox = String(process.env.CLOUDAGENT_CODEX_SANDBOX || "").trim();
  if (sandbox) {
    args.push("--sandbox", sandbox);
  }
  return args;
}

function getClaudeExecOptions(prompt, { mcpConfigPath = null, continuePrevious = false } = {}) {
  const args = ["-p", prompt, "--output-format", process.env.CLOUDAGENT_CLAUDE_OUTPUT_FORMAT || "stream-json"];
  if (continuePrevious) {
    args.push("--continue");
  }
  if (String(process.env.CLOUDAGENT_CLAUDE_VERBOSE ?? "true").toLowerCase() !== "false") {
    args.push("--verbose");
  }
  if (mcpConfigPath) {
    if (String(process.env.CLOUDAGENT_CLAUDE_STRICT_MCP_CONFIG ?? "true").toLowerCase() !== "false") {
      args.push("--strict-mcp-config");
    }
    args.push("--mcp-config", mcpConfigPath);
  }
  const permissionMode = String(process.env.CLOUDAGENT_CLAUDE_PERMISSION_MODE || "").trim();
  if (permissionMode) {
    args.push("--permission-mode", permissionMode);
  }
  return args;
}

function getCursorExecOptions(prompt, { workspaceDir = null, continuePrevious = false } = {}) {
  const args = [
    "-p",
    prompt,
    "--output-format",
    process.env.CLOUDAGENT_CURSOR_OUTPUT_FORMAT || "stream-json",
  ];
  if (workspaceDir) {
    args.push("--workspace", workspaceDir);
  }
  if (continuePrevious) {
    args.push("--continue");
  }
  if (String(process.env.CLOUDAGENT_CURSOR_APPROVE_MCPS ?? "true").toLowerCase() !== "false") {
    args.push("--approve-mcps");
  }
  if (String(process.env.CLOUDAGENT_CURSOR_STREAM_PARTIAL_OUTPUT ?? "false").toLowerCase() === "true") {
    args.push("--stream-partial-output");
  }
  if (String(process.env.CLOUDAGENT_CURSOR_TRUST_WORKSPACE ?? "true").toLowerCase() !== "false") {
    args.push("--trust");
  }
  const forceMode = String(process.env.CLOUDAGENT_CURSOR_FORCE ?? "true").trim().toLowerCase();
  if (["true", "1", "yes"].includes(forceMode)) args.push("--force");
  if (["yolo"].includes(forceMode)) args.push("--yolo");
  return args;
}

function summarizeLaunchArgs(args = []) {
  return args.map((arg) => {
    const text = String(arg || "");
    if (text.length > 240) return `[${text.length} chars]`;
    return text;
  });
}

function emitJsonLineEvents(lines, onEvent) {
  if (typeof onEvent !== "function") return;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      onEvent(JSON.parse(trimmed));
    } catch {
      onEvent({ type: "stdout", text: trimmed });
    }
  }
}

function formatSpawnErrorMessage(command, error) {
  if (error?.code !== "ENOENT") return error?.message || `Failed to launch ${command}.`;
  const binary = String(command || "").trim();
  if (binary === "cursor-agent") {
    return 'Cursor Agent CLI was not found. Install Cursor Agent CLI or set the Cursor agent binary/path in Preferences. Expected command: cursor-agent.';
  }
  if (binary === "claude") {
    return "Claude Code CLI was not found. Install Claude Code or set the Claude binary/path in Preferences. Expected command: claude.";
  }
  if (binary === "codex") {
    return "Codex CLI was not found. Install Codex CLI or set CODEX_BIN/CLOUDAGENT_CODEX_BIN. Expected command: codex.";
  }
  return `External agent command "${binary || command}" was not found. Install the CLI or set the agent binary/path in Preferences.`;
}

function runProcess(command, args, { cwd, env, timeoutMs, onStdout, onStderr, onEvent } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...(env || {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let stdoutLineBuffer = "";
    let timedOut = false;
    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
          setTimeout(() => child.kill("SIGKILL"), 3000).unref?.();
        }, timeoutMs)
      : null;

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (typeof onStdout === "function") onStdout(text);
      stdoutLineBuffer += text;
      const lines = stdoutLineBuffer.split(/\r?\n/);
      stdoutLineBuffer = lines.pop() || "";
      emitJsonLineEvents(lines, onEvent);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (typeof onStderr === "function") onStderr(text);
    });
    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      resolve({ exitCode: 127, stdout, stderr: stderr || formatSpawnErrorMessage(command, error), error, timedOut });
    });
    child.on("close", (exitCode) => {
      if (timer) clearTimeout(timer);
      emitJsonLineEvents(stdoutLineBuffer ? [stdoutLineBuffer] : [], onEvent);
      resolve({ exitCode, stdout, stderr, timedOut });
    });
  });
}

async function approveCursorMcpServer({ command, runDir, env = {}, onEvent = null } = {}) {
  if (!command || !runDir) return null;
  const enabled = String(process.env.CLOUDAGENT_CURSOR_PREAPPROVE_MCPS ?? "true").toLowerCase();
  if (["false", "0", "no"].includes(enabled)) return null;
  const timeoutMs = Number(process.env.CLOUDAGENT_CURSOR_MCP_APPROVAL_TIMEOUT_MS || 15_000);
  const result = await runProcess(command, ["mcp", "enable", "cloudagent"], {
    cwd: runDir,
    env,
    timeoutMs,
  });
  const debug = {
    type: "agent_runtime_debug",
    stage: "cursor_mcp_approval",
    runner: "cursor",
    runDir,
    ok: result.exitCode === 0,
    exitCode: result.exitCode,
    timedOut: Boolean(result.timedOut),
    stdout: compactText(result.stdout, 2000),
    stderr: compactText(result.stderr, 2000),
  };
  console.log("[local coding agent] cursor mcp approval", debug);
  if (typeof onEvent === "function") onEvent(debug);
  return result;
}

function parseCodexJsonEvents(stdout = "") {
  const events = [];
  for (const line of String(stdout || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      events.push({ type: "stdout", text: trimmed });
    }
  }
  return events;
}

function extractCodexFinalText(events = [], stdout = "") {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    const candidates = [
      event?.message,
      event?.content,
      event?.text,
      event?.data?.message,
      event?.data?.content,
      event?.data?.text,
      event?.item?.text,
      event?.item?.content,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
  }
  const textLines = String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("{"));
  return textLines.slice(-20).join("\n").trim();
}

function extractExternalAgentText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((entry) => extractExternalAgentText(entry))
      .filter(Boolean)
      .join("\n");
  }
  if (!value || typeof value !== "object") return "";
  if (typeof value.text === "string") return value.text;
  if (typeof value.content === "string") return value.content;
  if (Array.isArray(value.content)) return extractExternalAgentText(value.content);
  if (typeof value.message === "string") return value.message;
  if (typeof value.result === "string") return value.result;
  return "";
}

function mergeExternalAgentText(currentValue, nextValue) {
  const current = String(currentValue || "").trimEnd();
  const next = String(nextValue || "").trim();
  if (!next) return current;
  if (!current) return next;
  if (next.startsWith(current)) return next;
  if (current.endsWith(next) || current.includes(next)) return current;
  if (/^[,.;:!?)]/.test(next) || current.endsWith("\n") || next.startsWith("\n")) return `${current}${next}`;
  return `${current} ${next}`;
}

function normalizeExternalAgentTextForCompare(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isLikelyExternalAgentFragment(value) {
  const text = String(value || "").trim();
  return Boolean(text) && text.length < 80 && !/[.!?:\]\)`]$/.test(text);
}

function appendExternalAgentMessage(messages, text) {
  const next = String(text || "").trim();
  if (!next) return messages;
  const out = [...messages];
  const lastIndex = out.length - 1;
  const last = out[lastIndex] || "";
  const normalizedLast = normalizeExternalAgentTextForCompare(last);
  const normalizedNext = normalizeExternalAgentTextForCompare(next);
  if (last && normalizedNext && normalizedLast && normalizedNext.startsWith(normalizedLast)) {
    out[lastIndex] = next;
    return out;
  }
  if (last && normalizedLast && normalizedNext && normalizedLast.includes(normalizedNext)) return out;
  if (last && (isLikelyExternalAgentFragment(last) || isLikelyExternalAgentFragment(next))) {
    out[lastIndex] = mergeExternalAgentText(last, next);
    return out;
  }
  out.push(next);
  return out;
}

function extractCursorFinalText(events = [], stdout = "") {
  const resultCandidates = [];
  let streamedMessages = [];
  for (const event of events) {
    const eventType = String(event?.type || "").toLowerCase();
    const text = extractExternalAgentText(
      event?.result ??
        event?.message ??
        event?.content ??
        event?.text ??
        event?.data?.result ??
        event?.data?.message ??
        event?.data?.content ??
        event?.data?.text
    );
    if (!text.trim()) continue;
    if (eventType === "result" || eventType === "final" || eventType.includes("complete")) {
      resultCandidates.push(text.trim());
    } else if (["assistant", "message", "output", "text", "stdout"].includes(eventType) || !eventType) {
      streamedMessages = appendExternalAgentMessage(streamedMessages, text);
    }
  }
  const bestResult = resultCandidates
    .sort((a, b) => b.length - a.length)[0];
  return (bestResult || streamedMessages.join("\n\n") || extractCodexFinalText(events, stdout)).trim();
}

function extractClaudeFinalText(events = [], stdout = "") {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    const candidates = [
      event?.result,
      event?.message,
      event?.content,
      event?.text,
      event?.data?.result,
      event?.data?.message,
      event?.data?.content,
      event?.data?.text,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
      if (Array.isArray(candidate)) {
        const text = candidate
          .map((item) => typeof item === "string" ? item : item?.text || item?.content || "")
          .filter(Boolean)
          .join("\n")
          .trim();
        if (text) return text;
      }
    }
  }
  return extractCodexFinalText(events, stdout);
}

function isCodexUserInputRequest(text = "") {
  const normalized = String(text || "").replace(/[*_`>#-]/g, " ");
  return /(^|\n)\s*(user\s+input\s+needed)\b/i.test(normalized);
}

function extractCodexThreadId(events = []) {
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.type === "thread.started" && event.thread_id) return String(event.thread_id);
    if (event?.thread_id) return String(event.thread_id);
  }
  return null;
}

function buildCodingAgentRunResult(processResult, { runner = "codex" } = {}) {
  const events = parseCodexJsonEvents(processResult.stdout);
  const finalText =
    runner === "claude"
      ? extractClaudeFinalText(events, processResult.stdout)
      : runner === "cursor"
        ? extractCursorFinalText(events, processResult.stdout)
        : extractCodexFinalText(events, processResult.stdout);
  const label = codingAgentRunnerLabel(runner);
  const status =
    processResult.exitCode === 0 && finalText
      ? isCodexUserInputRequest(finalText)
        ? "waiting_on_user_input"
        : "complete"
      : "failed";
  const output =
    finalText ||
    compactText(processResult.stderr, 8000) ||
    (processResult.timedOut ? `${label} run timed out.` : `${label} completed without a final response.`);

  return {
    ok: status === "complete",
    status,
    output,
    summary: output.split(/\r?\n/).slice(0, 8).join("\n"),
    exitCode: processResult.exitCode,
    timedOut: processResult.timedOut,
    events,
    threadId: runner === "codex" ? extractCodexThreadId(events) : null,
    runner,
    stdout: processResult.stdout,
    stderr: processResult.stderr,
  };
}

export async function runLocalCodingAgentBlueprint({
  runner = "codex",
  blueprintId,
  title,
  blueprint,
  planPayload,
  task = null,
  phase = null,
  phases = [],
  priorLogs = [],
  authProfile = {},
  executionContext = null,
  regions = [],
  defaultValues = {},
  executionPreferences = {},
  localDataSnapshot = {},
  mcpUrl = null,
  recordId = null,
  workspaceDir = null,
  agentBinary = null,
  skillFiles = [],
  onEvent = null,
  onStdout = null,
  onStderr = null,
} = {}) {
  const normalizedRunner = normalizeCodingAgentRunner(runner);
  const agentRunner = ["codex", "claude", "cursor"].includes(normalizedRunner) ? normalizedRunner : "codex";
  const runnerDefinition = getCodingAgentRunnerDefinition(agentRunner);
  const runnerLabel = codingAgentRunnerLabel(agentRunner);
  const root = getCodingAgentRunsRoot(workspaceDir, agentRunner);
  const runId = recordId || `${agentRunner}-run-${Date.now()}`;
  const runDir = path.join(root, `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(runId, agentRunner)}`);
  await fs.mkdir(runDir, { recursive: true });
  if (agentRunner === "codex") await fs.mkdir(path.join(runDir, ".codex"), { recursive: true });
  const normalizedAuthProfile = normalizeAuthProfile(authProfile);
  const awsCredentialEnv = buildAwsCredentialEnv(normalizedAuthProfile);
  const awsCredentialEnvKeys = Object.keys(awsCredentialEnv).sort();

  if (Array.isArray(skillFiles) && skillFiles.length > 0) {
    await Promise.all(
      skillFiles.map(async (file) => {
        const relativePath = String(file?.relativePath || "").replace(/^\/+/, "");
        if (!relativePath || relativePath.includes("..")) return;
        if (["blueprint.json", "plan.json", "session-context.json", "prompt.md"].includes(relativePath)) return;
        const target = relativePath === "SKILL.md"
          ? path.join(runDir, "SKILL.md")
          : path.join(runDir, "skill", relativePath);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, String(file?.content || ""));
      })
    );
  }

  let claudeMcpConfigPath = null;
  if (agentRunner === "codex" && mcpUrl) {
    await fs.writeFile(
      path.join(runDir, ".codex", "config.toml"),
      buildCodexCloudAgentMcpConfigToml(mcpUrl)
    );
  } else if ((agentRunner === "claude" || agentRunner === "cursor") && mcpUrl) {
    const mcpConfig = safeJson(buildCloudAgentMcpJsonConfig(mcpUrl));
    if (agentRunner === "claude") {
      claudeMcpConfigPath = path.join(runDir, "claude-mcp.json");
      await fs.writeFile(claudeMcpConfigPath, mcpConfig);
    } else {
      const cursorMcpConfig = safeJson(buildCursorCloudAgentMcpJsonConfig(mcpUrl));
      const cursorMcpDir = path.join(runDir, ".cursor");
      await fs.mkdir(cursorMcpDir, { recursive: true });
      await fs.writeFile(path.join(cursorMcpDir, "mcp.json"), cursorMcpConfig);
      await fs.writeFile(path.join(runDir, ".mcp.json"), cursorMcpConfig);
    }
  }

  const prompt = [
    `You are running a CloudAgent skill through ${runnerLabel} in local desktop mode.`,
    "",
    "Execution rules:",
    "- Read `SKILL.md` in the current working directory completely before taking any action. It is the source of truth for this run.",
    `- Run this skill as one ${runnerLabel} session.`,
    mcpUrl
      ? "- Use the configured CloudAgent MCP tools for cloud CLI work. CloudAgent binds the selected environment and credentials to `cli_session_start` and `cli_session_execute` automatically."
      : "- Use the injected AWS process environment for AWS CLI work because MCP is not configured for this run.",
    "- Prefer read-only inspection unless the skill task explicitly requires configuration changes and the CloudAgent preflight context allows it.",
    "- If a step needs user input or you are unsure whether it is safe to continue, stop and return a `User input needed` section with the exact question, options, and recommended default.",
    "- Produce concise Markdown with Findings, Evidence, Actions Taken, and Result.",
    "- Do not claim AWS or local changes were made unless you actually performed them.",
    "",
    task
      ? `Current task to execute:\n${compactText(task, 8000)}`
      : "Execute the skill plan from the beginning using the generated skill.",
  ].filter(Boolean).join("\n");

  const timeoutMs = Number(
    (agentRunner === "claude" ? process.env.CLOUDAGENT_CLAUDE_TIMEOUT_MS : null) ||
    (agentRunner === "cursor" ? process.env.CLOUDAGENT_CURSOR_TIMEOUT_MS : null) ||
    process.env.CLOUDAGENT_CODE_AGENT_TIMEOUT_MS ||
    process.env.CLOUDAGENT_CODEX_TIMEOUT_MS ||
    15 * 60 * 1000
  );
  const configuredBinary = runnerDefinition?.binaryEnvVars
    ?.map((key) => process.env[key])
    .find(Boolean);
  const command =
    agentRunner === "cursor"
      ? normalizeCursorAgentBinary(agentBinary)
      : agentBinary || configuredBinary || runnerDefinition?.defaultBinary || "codex";
  if (agentRunner === "cursor" && mcpUrl) {
    await approveCursorMcpServer({
      command,
      runDir,
      env: awsCredentialEnv,
      onEvent,
    }).catch((error) => {
      const debug = {
        type: "agent_runtime_debug",
        stage: "cursor_mcp_approval",
        runner: "cursor",
        runDir,
        ok: false,
        error: error?.message || String(error),
      };
      console.warn("[local coding agent] cursor mcp approval failed", debug);
      if (typeof onEvent === "function") onEvent(debug);
    });
  }
  const args =
    agentRunner === "claude"
      ? getClaudeExecOptions(prompt, { mcpConfigPath: claudeMcpConfigPath })
      : agentRunner === "cursor"
        ? getCursorExecOptions(prompt, { workspaceDir: runDir })
        : ["exec", ...getCodexExecOptions({ mcpUrl }), "--json", "--skip-git-repo-check", "--cd", runDir, prompt];
  const launchDebug = {
    type: "agent_runtime_debug",
    stage: "process_launch",
    requestedRunner: runner,
    normalizedRunner,
    runner: agentRunner,
    runnerLabel,
    command,
    args: summarizeLaunchArgs(args),
    cwd: runDir,
    workspaceDir: workspaceDir || null,
    runDir,
    mcpEnabled: Boolean(mcpUrl),
    credentialEnvKeys: awsCredentialEnvKeys,
    timeoutMs,
  };
  console.log("[local coding agent] launch", launchDebug);
  if (typeof onEvent === "function") onEvent(launchDebug);
  const result = await runProcess(
    command,
    args,
    {
      cwd: runDir,
      timeoutMs,
      env: awsCredentialEnv,
      onStdout,
      onStderr,
      onEvent: typeof onEvent === "function"
        ? (event) => onEvent({ ...(event && typeof event === "object" ? event : { text: String(event || "") }), runner: agentRunner })
        : null,
    }
  );
  const agentResult = buildCodingAgentRunResult(result, { runner: agentRunner });

  return {
    ...agentResult,
    runDir,
  };
}

export async function runLocalExternalAgentBlueprint(options = {}) {
  return runLocalCodingAgentBlueprint(options);
}

export async function runLocalCodexBlueprint(options = {}) {
  return runLocalCodingAgentBlueprint({ ...options, runner: "codex" });
}

export async function runLocalClaudeBlueprint(options = {}) {
  return runLocalCodingAgentBlueprint({ ...options, runner: "claude" });
}

export async function runLocalCursorBlueprint(options = {}) {
  return runLocalCodingAgentBlueprint({ ...options, runner: "cursor" });
}

export async function resumeLocalCodexBlueprint({
  runner = "codex",
  threadId = null,
  runDir,
  prompt,
  authProfile = {},
  mcpUrl = null,
  agentBinary = null,
  onEvent = null,
  onStdout = null,
  onStderr = null,
} = {}) {
  const normalizedRunner = normalizeCodingAgentRunner(runner);
  const agentRunner = ["codex", "claude", "cursor"].includes(normalizedRunner) ? normalizedRunner : "codex";
  const runnerDefinition = getCodingAgentRunnerDefinition(agentRunner);
  const runnerLabel = codingAgentRunnerLabel(agentRunner);
  if (!runDir) throw new Error(`${runnerLabel} run directory is required to resume a ${runnerLabel} session.`);
  const trimmedPrompt = String(prompt || "").trim();
  if (!trimmedPrompt) throw new Error(`Prompt is required to resume a ${runnerLabel} session.`);
  const normalizedAuthProfile = normalizeAuthProfile(authProfile);
  const awsCredentialEnv = buildAwsCredentialEnv(normalizedAuthProfile);
  const configuredBinary = runnerDefinition?.binaryEnvVars
    ?.map((key) => process.env[key])
    .find(Boolean);

  if (agentRunner === "cursor") {
    const command = normalizeCursorAgentBinary(agentBinary);
    if (mcpUrl) {
      await approveCursorMcpServer({
        command,
        runDir,
        env: awsCredentialEnv,
        onEvent,
      }).catch((error) => {
        const debug = {
          type: "agent_runtime_debug",
          stage: "cursor_mcp_approval",
          runner: "cursor",
          runDir,
          ok: false,
          error: error?.message || String(error),
        };
        console.warn("[local coding agent] cursor mcp approval failed", debug);
        if (typeof onEvent === "function") onEvent(debug);
      });
    }
    const timeoutMs = Number(
      process.env.CLOUDAGENT_CURSOR_TIMEOUT_MS ||
      process.env.CLOUDAGENT_CODE_AGENT_TIMEOUT_MS ||
      process.env.CLOUDAGENT_CODEX_TIMEOUT_MS ||
      15 * 60 * 1000
    );
    const args = getCursorExecOptions(trimmedPrompt, {
      workspaceDir: runDir,
      continuePrevious: true,
    });
    const launchDebug = {
      type: "agent_runtime_debug",
      stage: "process_resume",
      runner: agentRunner,
      runnerLabel,
      command,
      args: summarizeLaunchArgs(args),
      cwd: runDir,
      runDir,
      mcpEnabled: Boolean(mcpUrl),
      credentialEnvKeys: Object.keys(awsCredentialEnv).sort(),
      timeoutMs,
    };
    console.log("[local coding agent] resume", launchDebug);
    if (typeof onEvent === "function") onEvent(launchDebug);
    const result = await runProcess(command, args, {
      cwd: runDir,
      timeoutMs,
      env: awsCredentialEnv,
      onStdout,
      onStderr,
      onEvent: typeof onEvent === "function"
        ? (event) => onEvent({ ...(event && typeof event === "object" ? event : { text: String(event || "") }), runner: agentRunner })
        : null,
    });
    return {
      ...buildCodingAgentRunResult(result, { runner: agentRunner }),
      runDir,
    };
  }

  if (agentRunner === "claude") {
    const command = agentBinary || configuredBinary || runnerDefinition?.defaultBinary || "claude";
    let claudeMcpConfigPath = null;
    if (mcpUrl) {
      const candidate = path.join(runDir, "claude-mcp.json");
      try {
        await fs.access(candidate);
        claudeMcpConfigPath = candidate;
      } catch {
        claudeMcpConfigPath = null;
      }
    }
    const timeoutMs = Number(
      process.env.CLOUDAGENT_CLAUDE_TIMEOUT_MS ||
      process.env.CLOUDAGENT_CODE_AGENT_TIMEOUT_MS ||
      process.env.CLOUDAGENT_CODEX_TIMEOUT_MS ||
      15 * 60 * 1000
    );
    const args = getClaudeExecOptions(trimmedPrompt, {
      mcpConfigPath: claudeMcpConfigPath,
      continuePrevious: true,
    });
    const launchDebug = {
      type: "agent_runtime_debug",
      stage: "process_resume",
      runner: agentRunner,
      runnerLabel,
      command,
      args: summarizeLaunchArgs(args),
      cwd: runDir,
      runDir,
      mcpEnabled: Boolean(claudeMcpConfigPath),
      credentialEnvKeys: Object.keys(awsCredentialEnv).sort(),
      timeoutMs,
    };
    console.log("[local coding agent] resume", launchDebug);
    if (typeof onEvent === "function") onEvent(launchDebug);
    const result = await runProcess(command, args, {
      cwd: runDir,
      timeoutMs,
      env: awsCredentialEnv,
      onStdout,
      onStderr,
      onEvent: typeof onEvent === "function"
        ? (event) => onEvent({ ...(event && typeof event === "object" ? event : { text: String(event || "") }), runner: agentRunner })
        : null,
    });
    return {
      ...buildCodingAgentRunResult(result, { runner: agentRunner }),
      runDir,
    };
  }

  const args = ["exec", ...getCodexExecOptions({ mcpUrl }), "resume", "--json", "--skip-git-repo-check"];
  if (threadId) {
    args.push(String(threadId));
  } else {
    args.push("--last");
  }
  args.push(trimmedPrompt);

  const timeoutMs = Number(process.env.CLOUDAGENT_CODEX_TIMEOUT_MS || 15 * 60 * 1000);
  const command = agentBinary || configuredBinary || runnerDefinition?.defaultBinary || "codex";
  const result = await runProcess(command, args, {
    cwd: runDir,
    timeoutMs,
    env: awsCredentialEnv,
    onStdout,
    onStderr,
    onEvent,
  });
  return {
    ...buildCodingAgentRunResult(result, { runner: "codex" }),
    runDir,
  };
}

export async function resumeLocalExternalAgentBlueprint(options = {}) {
  return resumeLocalCodexBlueprint(options);
}
