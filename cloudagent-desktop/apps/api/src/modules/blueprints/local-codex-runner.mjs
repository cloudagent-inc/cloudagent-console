import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

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

function slug(value) {
  const text = String(value || "codex-run")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return text || "codex-run";
}

function getCodexRunsRoot(workspaceDir = null) {
  const baseWorkspace =
    workspaceDir ||
    process.env.CLOUDAGENT_CODEX_WORKSPACE_DIR ||
    process.cwd();
  return (
    process.env.CLOUDAGENT_CODEX_RUNS_DIR ||
    path.join(baseWorkspace, ".cloudagent", "codex-runs")
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

function buildCodexTomlString(value) {
  return JSON.stringify(String(value || ""));
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
      'mcp_servers.cloudagent.enabled_tools=["aws_cli_readonly"]',
      "-c",
      'mcp_servers.cloudagent.default_tools_approval_mode="approve"',
      "-c",
      "mcp_servers.cloudagent.tool_timeout_sec=120",
      "-c",
      'mcp_servers.cloudagent.tools.aws_cli_readonly.approval_mode="approve"'
    );
  }
  const sandbox = String(process.env.CLOUDAGENT_CODEX_SANDBOX || "").trim();
  if (sandbox) {
    args.push("--sandbox", sandbox);
  }
  return args;
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
      resolve({ exitCode: 127, stdout, stderr: stderr || error.message, error, timedOut });
    });
    child.on("close", (exitCode) => {
      if (timer) clearTimeout(timer);
      emitJsonLineEvents(stdoutLineBuffer ? [stdoutLineBuffer] : [], onEvent);
      resolve({ exitCode, stdout, stderr, timedOut });
    });
  });
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

function buildCodexRunResult(processResult) {
  const events = parseCodexJsonEvents(processResult.stdout);
  const finalText = extractCodexFinalText(events, processResult.stdout);
  const status =
    processResult.exitCode === 0 && finalText
      ? isCodexUserInputRequest(finalText)
        ? "waiting_on_user_input"
        : "complete"
      : "failed";
  const output =
    finalText ||
    compactText(processResult.stderr, 8000) ||
    (processResult.timedOut ? "Codex CLI run timed out." : "Codex CLI completed without a final response.");

  return {
    ok: status === "complete",
    status,
    output,
    summary: output.split(/\r?\n/).slice(0, 8).join("\n"),
    exitCode: processResult.exitCode,
    timedOut: processResult.timedOut,
    events,
    threadId: extractCodexThreadId(events),
    stdout: processResult.stdout,
    stderr: processResult.stderr,
  };
}

export async function runLocalCodexBlueprint({
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
  skillFiles = [],
  onEvent = null,
  onStdout = null,
  onStderr = null,
} = {}) {
  const root = getCodexRunsRoot(workspaceDir);
  const runId = recordId || `codex-run-${Date.now()}`;
  const runDir = path.join(root, `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(runId)}`);
  await fs.mkdir(path.join(runDir, ".codex"), { recursive: true });
  const normalizedAuthProfile = normalizeAuthProfile(authProfile);
  const awsCredentialEnv = buildAwsCredentialEnv(normalizedAuthProfile);
  const awsCredentialEnvKeys = Object.keys(awsCredentialEnv).sort();

  const context = {
    runtime: "cloudagent-local-codex",
    recordId,
    blueprintId,
    title,
    credentialAccess: {
      mode: mcpUrl ? "cloudagent-mcp-aws-cli-readonly" : "process-environment",
      guidance:
        mcpUrl
          ? "Use the CloudAgent MCP aws_cli_readonly tool for AWS inspection. Pass permissionProfileId/accountId from session-context.json.environment.authProfile. The MCP server resolves local credentials; secret values are intentionally not written to disk or passed to Codex."
          : "Use the AWS CLI directly. CloudAgent injects credentials into the Codex process environment before launching codex exec. Secret values are intentionally not written to disk.",
      availableEnvVars: awsCredentialEnvKeys,
      requiredUsage:
        mcpUrl
          ? "Do not run AWS CLI commands directly from the shell for AWS account inspection. Call the CloudAgent MCP aws_cli_readonly tool with concrete read-only AWS CLI commands."
          : "Do not run aws configure list as the source of truth for credentials. Use AWS CLI commands normally; the child process already has the listed AWS_* variables or AWS_PROFILE in its environment.",
      firstCheckCommand: "aws sts get-caller-identity --output json",
      mcp: mcpUrl
        ? {
            server: "cloudagent",
            url: mcpUrl,
            tool: "aws_cli_readonly",
            accountId: normalizedAuthProfile.awsAccountId || normalizedAuthProfile.accountId || null,
            permissionProfileId:
              normalizedAuthProfile.permissionProfileId ||
              normalizedAuthProfile.recordId ||
              normalizedAuthProfile.id ||
              null,
          }
        : null,
    },
    environment: {
      authProfile: {
        provider: normalizedAuthProfile.provider || "aws",
        authType: normalizedAuthProfile.authType || normalizedAuthProfile.credentialMode || null,
        accountId: normalizedAuthProfile.awsAccountId || normalizedAuthProfile.accountId || null,
        permissionProfileId:
          normalizedAuthProfile.permissionProfileId ||
          normalizedAuthProfile.recordId ||
          normalizedAuthProfile.id ||
          null,
        awsProfile:
          normalizedAuthProfile.awsProfile ||
          normalizedAuthProfile.profileName ||
          normalizedAuthProfile.profile ||
          null,
        region:
          normalizedAuthProfile.region ||
          normalizedAuthProfile.defaultRegion ||
          normalizedAuthProfile.awsRegion ||
          null,
        credentialEnvVars: awsCredentialEnvKeys,
        credentialValuesStoredInFile: false,
      },
    },
    authProfileSummary: {
      provider: normalizedAuthProfile?.provider || "aws",
      authType: normalizedAuthProfile?.authType || normalizedAuthProfile?.credentialMode || null,
      accountId: normalizedAuthProfile?.awsAccountId || normalizedAuthProfile?.accountId || null,
      permissionProfileId: normalizedAuthProfile?.permissionProfileId || normalizedAuthProfile?.recordId || normalizedAuthProfile?.id || null,
      awsProfile: normalizedAuthProfile?.awsProfile || normalizedAuthProfile?.profileName || normalizedAuthProfile?.profile || null,
      region: normalizedAuthProfile?.region || normalizedAuthProfile?.defaultRegion || normalizedAuthProfile?.awsRegion || null,
    },
    regions,
    defaultValues,
    executionPreferences,
    executionContext,
    plan: phases.length ? phases : planPayload || blueprint || {},
    task,
    phase,
    priorLogs,
    localDataSnapshot,
  };

  await Promise.all([
    fs.writeFile(path.join(runDir, "session-context.json"), safeJson(context)),
    fs.writeFile(path.join(runDir, "plan.json"), safeJson(phases.length ? phases : planPayload || blueprint || {})),
  ]);

  if (Array.isArray(skillFiles) && skillFiles.length > 0) {
    await fs.mkdir(path.join(runDir, "skill"), { recursive: true });
    await Promise.all(
      skillFiles.map(async (file) => {
        const relativePath = String(file?.relativePath || "").replace(/^\/+/, "");
        if (!relativePath || relativePath.includes("..")) return;
        if (["blueprint.json", "plan.json"].includes(relativePath)) return;
        const target = path.join(runDir, "skill", relativePath);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, String(file?.content || ""));
      })
    );
  }

  if (mcpUrl) {
    await fs.writeFile(
      path.join(runDir, ".codex", "config.toml"),
      [
        "[mcp_servers.cloudagent]",
        `url = "${String(mcpUrl).replace(/"/g, '\\"')}"`,
        'enabled_tools = ["aws_cli_readonly"]',
        'default_tools_approval_mode = "approve"',
        "tool_timeout_sec = 120",
        "",
        "[mcp_servers.cloudagent.tools.aws_cli_readonly]",
        'approval_mode = "approve"',
        "",
      ].join("\n")
    );
  }

  const prompt = [
    "You are running a CloudAgent blueprint through OpenAI Codex CLI in local desktop mode.",
    "",
    "Use the files in this directory as the source of truth:",
    "- session-context.json: selected environment/workload context, environment.authProfile credential metadata, local data snapshot, prior outputs, and the blueprint plan",
    "- plan.json: convenience copy of the executable plan phases/tasks",
    "- skill/SKILL.md: generated Markdown skill for this run, combining CloudAgent Codex instructions with the selected blueprint",
    "",
    "Execution rules:",
    "- Treat this as one autonomous Codex session. CloudAgent will not send task IDs one at a time.",
    "- Read session-context.json and skill/SKILL.md first, then let the skill direct the run.",
    "- Keep work scoped to the selected CloudAgent environment/workload context.",
    "- Use session-context.json.environment.authProfile to understand the selected AWS account/profile and region.",
    mcpUrl
      ? "- For AWS inspection, use the CloudAgent MCP tool `aws_cli_readonly` by default. Pass `permissionProfileId` and `accountId` from `session-context.json.environment.authProfile`, and pass concrete read-only AWS CLI commands such as `aws sts get-caller-identity --output json`."
      : "- Use the AWS CLI for AWS inspection or execution. CloudAgent already passed the AWS credential values to this process through the environment variables listed at session-context.json.credentialAccess.availableEnvVars and session-context.json.environment.authProfile.credentialEnvVars.",
    mcpUrl
      ? "- Do not run AWS CLI commands directly from the shell for AWS account inspection unless the MCP tool is unavailable and you explicitly report that fallback."
      : "- Do not ask the user where credentials are stored. Do not rely on ~/.aws/config, ~/.aws/credentials, or `aws configure list` to find credentials. The process environment is the credential source of truth.",
    mcpUrl
      ? "- First validate AWS access by calling MCP `aws_cli_readonly` with `aws sts get-caller-identity --output json`, then continue with blueprint-specific read-only AWS CLI commands through that same MCP tool."
      : "- First validate AWS access with `aws sts get-caller-identity --output json`, then continue with the blueprint-specific read-only AWS CLI commands.",
    "- Prefer read-only inspection unless the blueprint task explicitly requires configuration changes and the CloudAgent preflight context allows it.",
    "- If a step needs user input or you are unsure whether it is safe to continue, stop and return a `User input needed` section with the exact question, options, and recommended default.",
    "- Produce concise Markdown with Findings, Evidence, Actions Taken, and Result.",
    "- Do not claim AWS or local changes were made unless you actually performed them.",
    "",
    task
      ? `Current task to execute:\n${compactText(task, 8000)}`
      : "Execute the blueprint plan from the beginning using the provided CloudAgent context.",
  ].join("\n");
  await fs.writeFile(path.join(runDir, "prompt.md"), prompt);

  const timeoutMs = Number(process.env.CLOUDAGENT_CODEX_TIMEOUT_MS || 15 * 60 * 1000);
  const result = await runProcess(
    process.env.CLOUDAGENT_CODEX_BIN || "codex",
    ["exec", ...getCodexExecOptions({ mcpUrl }), "--json", "--skip-git-repo-check", "--cd", runDir, prompt],
    {
      cwd: runDir,
      timeoutMs,
      env: awsCredentialEnv,
      onStdout,
      onStderr,
      onEvent,
    }
  );
  const codexResult = buildCodexRunResult(result);

  return {
    ...codexResult,
    runDir,
  };
}

export async function resumeLocalCodexBlueprint({
  threadId = null,
  runDir,
  prompt,
  authProfile = {},
  mcpUrl = null,
  onEvent = null,
  onStdout = null,
  onStderr = null,
} = {}) {
  if (!runDir) throw new Error("Codex run directory is required to resume a Codex session.");
  const trimmedPrompt = String(prompt || "").trim();
  if (!trimmedPrompt) throw new Error("Prompt is required to resume a Codex session.");
  const normalizedAuthProfile = normalizeAuthProfile(authProfile);

  const args = ["exec", ...getCodexExecOptions({ mcpUrl }), "resume", "--json", "--skip-git-repo-check"];
  if (threadId) {
    args.push(String(threadId));
  } else {
    args.push("--last");
  }
  args.push(trimmedPrompt);

  const timeoutMs = Number(process.env.CLOUDAGENT_CODEX_TIMEOUT_MS || 15 * 60 * 1000);
  const result = await runProcess(process.env.CLOUDAGENT_CODEX_BIN || "codex", args, {
    cwd: runDir,
    timeoutMs,
    env: buildAwsCredentialEnv(normalizedAuthProfile),
    onStdout,
    onStderr,
    onEvent,
  });
  return {
    ...buildCodexRunResult(result),
    runDir,
  };
}
