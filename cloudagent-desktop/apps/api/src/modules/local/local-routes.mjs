import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { Router } from "express";
import { z } from "zod";
import {
  LOCAL_AUTH,
  LocalJsonFileStore,
  parseStoredObject,
  parseStoredJsonValue,
} from "@cloudagent/storage";
import { listLocalAwsProfiles, validateLocalAwsCredentials } from "../cloud-setup/aws-local-discovery.mjs";
import { createLocalCloudAgentTools } from "../cloudagent/local-cloudagent-tools.mjs";
import {
  generateLocalChatReply,
  generateLocalAgentRunSummaryWithOpenAI,
  generateLocalExternalAgentExecutionContextWithOpenAI,
  generateLocalExecutiveSummaryWithOpenAI,
  getLocalOpenAIKey,
  publicLocalOpenAISettings,
  isLocalOpenAIConfigured,
  updateLocalOpenAISettings,
} from "../../platform/local-openai.mjs";
import {
  executeLocalAgentPlan,
  executeLocalAgentPlanWithCloudAgent,
  createLocalWorkflowRun,
} from "../runners/local-runner.mjs";
import { startLocalWorkflowJob } from "../workflows/local-workflow-jobs.mjs";
import {
  resumeLocalExternalAgentBlueprint,
  runLocalExternalAgentBlueprint,
} from "../skills/local-codex-runner.mjs";
import {
  AGENT_RUN_EVENT_TYPES,
  createAgentMessageEvent,
  createAgentRunEvent,
  createAgentRunStatusEvent,
  createAgentTaskEvent,
  codingAgentRunnerLabel,
  getCodingAgentRunnerDefinition,
  normalizeAgentRawStreamChunk,
  normalizeCodingAgentRunner,
} from "@cloudagent/agent-runtime";
import { getNextScheduledRunAt } from "../workflows/local-workflow-scheduler.mjs";
import { resolveSkillExecutionContext } from "@cloudagent/skills/execution-context";
import { runSkillPreflight } from "@cloudagent/skills/preflight";
import globals from "@cloudagent/core/global-variables";

const AnyObjectSchema = z.record(z.any()).default({});

const PermissionProfileCreateSchema = AnyObjectSchema.refine(
  (value) => value && typeof value === "object" && !Array.isArray(value),
  "body must be an object"
);
const PermissionProfilePatchSchema = PermissionProfileCreateSchema;
const WorkloadCreateSchema = PermissionProfileCreateSchema;
const WorkloadPatchSchema = PermissionProfileCreateSchema;
const WorkflowCreateSchema = PermissionProfileCreateSchema;
const WorkflowPatchSchema = PermissionProfileCreateSchema;
const BlueprintCreateSchema = PermissionProfileCreateSchema;
const BlueprintPatchSchema = PermissionProfileCreateSchema;
const AgentHistoryCreateSchema = PermissionProfileCreateSchema;
const AgentHistoryPatchSchema = PermissionProfileCreateSchema;

const DEFAULT_PLAN_BUILDER_TASK_MAX_TURNS = 50;
const MAX_PLAN_BUILDER_TASK_MAX_TURNS = 150;
const EXTERNAL_AGENT_RUN_TASK_ID = "external_agent_run";
const localPlanBuilderSessions = new Map();
const localPlanBuilderHistories = new Map();

const ExecutiveSummaryBodySchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("account"),
    recordId: z.string().min(1),
    options: z.record(z.any()).optional(),
  }).passthrough(),
  z.object({
    scope: z.literal("workload"),
    workloadId: z.string().min(1),
    options: z.record(z.any()).optional(),
  }).passthrough(),
]);

function parseBody(schema, req, res) {
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Invalid request body", issues: parsed.error.issues });
    return null;
  }
  return parsed.data;
}

function safeJsonParseLocal(value, fallback = {}) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function safeTrimLocal(value) {
  return value == null ? "" : String(value).trim();
}

function compactStatusText(value, maxLength = 800) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function runCommandStatus(command, args = ["--version"], { timeoutMs = 3000 } = {}) {
  const binary = safeTrimLocal(command);
  if (!binary) {
    return Promise.resolve({
      ok: false,
      command: "",
      error: "No command configured.",
    });
  }

  return new Promise((resolve) => {
    const child = spawn(binary, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        command: binary,
        ...result,
      });
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      settle({
        ok: false,
        timedOut: true,
        error: `Timed out after ${timeoutMs}ms.`,
      });
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      settle({
        ok: false,
        error: error?.code === "ENOENT"
          ? `Command not found: ${binary}`
          : error?.message || `Failed to run ${binary}.`,
      });
    });
    child.on("close", (exitCode) => {
      const output = compactStatusText(stdout || stderr);
      settle({
        ok: exitCode === 0,
        exitCode,
        version: output.split(/\r?\n/).find(Boolean) || "",
        error: exitCode === 0 ? null : output || `${binary} exited with code ${exitCode}.`,
      });
    });
  });
}

async function checkWritableDirectory(dirPath) {
  const directory = path.resolve(dirPath || process.cwd());
  const probePath = path.join(directory, `.cloudagent-write-test-${process.pid}-${Date.now()}`);
  try {
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(probePath, "ok", "utf8");
    await fs.unlink(probePath).catch(() => {});
    return {
      ok: true,
      path: directory,
      writable: true,
    };
  } catch (error) {
    return {
      ok: false,
      path: directory,
      writable: false,
      error: error?.message || "Directory is not writable.",
    };
  }
}

async function buildLocalPreferencesStatus({ store, app } = {}) {
  const [openaiSettings, codexSettings, localData, awsCli] = await Promise.all([
    Promise.resolve(publicLocalOpenAISettings()),
    getLocalCodexSettings(store),
    checkWritableDirectory(store?.dataDir),
    runCommandStatus("aws"),
  ]);

  const [codexCli, claudeCli, cursorCli] = await Promise.all([
    codexSettings.enabled === false
      ? Promise.resolve({ ok: true, disabled: true, command: codexSettings.binary || "codex" })
      : runCommandStatus(codexSettings.binary || "codex"),
    codexSettings.claude?.enabled === false
      ? Promise.resolve({ ok: true, disabled: true, command: codexSettings.claude?.binary || "claude" })
      : runCommandStatus(codexSettings.claude?.binary || "claude"),
    codexSettings.cursor?.enabled === false
      ? Promise.resolve({ ok: true, disabled: true, command: codexSettings.cursor?.binary || "cursor-agent" })
      : runCommandStatus(codexSettings.cursor?.binary || "cursor-agent"),
  ]);

  const mcpEnabled = app?.get?.("localMcpEnabled") !== false;
  const openai = {
    ok: Boolean(openaiSettings.hasApiKey),
    configured: Boolean(openaiSettings.hasApiKey),
    model: openaiSettings.model,
    source: openaiSettings.source || (openaiSettings.hasApiKey ? "preferences" : "none"),
    apiKeyMasked: openaiSettings.apiKeyMasked || "",
    message: openaiSettings.hasApiKey
      ? "Configured for local model-backed features."
      : "OpenAI API key is not configured.",
  };

  return {
    ok: true,
    ready: Boolean(openai.ok && localData.ok),
    status: {
      openai,
      localData,
      mcp: {
        ok: true,
        enabled: mcpEnabled,
        message: mcpEnabled ? "Local MCP server is enabled." : "Local MCP server is disabled.",
      },
      tools: {
        aws: {
          label: "AWS CLI",
          optional: true,
          ...awsCli,
        },
        codex: {
          label: "Codex CLI",
          optional: true,
          enabled: codexSettings.enabled !== false,
          ...codexCli,
        },
        claude: {
          label: "Claude Code CLI",
          optional: true,
          enabled: codexSettings.claude?.enabled !== false,
          ...claudeCli,
        },
        cursor: {
          label: "Cursor Agent CLI",
          optional: true,
          enabled: codexSettings.cursor?.enabled !== false,
          ...cursorCli,
        },
      },
    },
  };
}

function codexSlug(value) {
  return String(value || "codex-skill")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "codex-skill";
}

function defaultCodexWorkspaceDir() {
  return path.resolve(process.env.CLOUDAGENT_CODEX_WORKSPACE_DIR || process.cwd());
}

function defaultCodexSkillsDir() {
  return path.resolve(
    process.env.CLOUDAGENT_CODEX_SKILLS_DIR ||
      path.join(defaultCodexWorkspaceDir(), ".cloudagent", "codex-skills")
  );
}

function defaultClaudeWorkspaceDir() {
  return path.resolve(
    process.env.CLOUDAGENT_CLAUDE_WORKSPACE_DIR ||
      process.env.CLOUDAGENT_CODE_AGENT_WORKSPACE_DIR ||
      defaultCodexWorkspaceDir()
  );
}

function defaultCursorWorkspaceDir() {
  return path.resolve(
    process.env.CLOUDAGENT_CURSOR_WORKSPACE_DIR ||
      process.env.CLOUDAGENT_CODE_AGENT_WORKSPACE_DIR ||
      defaultCodexWorkspaceDir()
  );
}

function defaultCursorAgentBinary() {
  return String(process.env.CLOUDAGENT_CURSOR_BIN || "cursor-agent").trim() || "cursor-agent";
}

function defaultCodexBinary() {
  return String(process.env.CLOUDAGENT_CODEX_BIN || process.env.CODEX_BIN || "codex").trim() || "codex";
}

function normalizeCursorAgentBinary(value) {
  const raw = String(value || "").trim();
  return raw && raw !== "agent" ? raw : defaultCursorAgentBinary();
}

function normalizeAbsoluteDirectory(value, fallback) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  return path.resolve(raw.replace(/^~(?=$|\/)/, process.env.HOME || ""));
}

async function getLocalCodexSettings(store) {
  const settingsRecord = await store.getSettings();
  const settings = safeJsonParseLocal(settingsRecord?.settings, {});
  const codex = settings?.codex && typeof settings.codex === "object" ? settings.codex : {};
  const claude = settings?.claude && typeof settings.claude === "object" ? settings.claude : {};
  const cursor = settings?.cursor && typeof settings.cursor === "object" ? settings.cursor : {};
  return {
    enabled: codex.enabled !== false,
    skillsDir: normalizeAbsoluteDirectory(codex.skillsDir, defaultCodexSkillsDir()),
    workspaceDir: normalizeAbsoluteDirectory(codex.workspaceDir, defaultCodexWorkspaceDir()),
    binary: String(codex.binary || defaultCodexBinary()).trim() || defaultCodexBinary(),
    claude: {
      enabled: claude.enabled !== false,
      workspaceDir: normalizeAbsoluteDirectory(claude.workspaceDir, defaultClaudeWorkspaceDir()),
      binary: String(claude.binary || process.env.CLOUDAGENT_CLAUDE_BIN || "claude"),
    },
    cursor: {
      enabled: cursor.enabled !== false,
      workspaceDir: normalizeAbsoluteDirectory(cursor.workspaceDir, defaultCursorWorkspaceDir()),
      binary: normalizeCursorAgentBinary(cursor.binary),
    },
  };
}

async function updateLocalCodexSettings(store, patch = {}) {
  const settingsRecord = await store.getSettings();
  const settings = safeJsonParseLocal(settingsRecord?.settings, {});
  const existing = await getLocalCodexSettings(store);
  const nextCodex = {
    enabled: existing.enabled,
    workspaceDir: existing.workspaceDir,
    binary: existing.binary,
    ...(patch.workspaceDir !== undefined
      ? { workspaceDir: normalizeAbsoluteDirectory(patch.workspaceDir, existing.workspaceDir) }
      : {}),
    ...(patch.enabled !== undefined ? { enabled: patch.enabled !== false } : {}),
    ...(patch.binary !== undefined
      ? { binary: String(patch.binary || defaultCodexBinary()).trim() || defaultCodexBinary() }
      : {}),
  };
  const existingClaude = existing.claude || {};
  const existingCursor = existing.cursor || {};
  const nextClaude = {
    ...existingClaude,
    ...(patch.claude && typeof patch.claude === "object"
      ? {
          ...(patch.claude.workspaceDir !== undefined
            ? { workspaceDir: normalizeAbsoluteDirectory(patch.claude.workspaceDir, existingClaude.workspaceDir) }
            : {}),
          ...(patch.claude.enabled !== undefined ? { enabled: patch.claude.enabled !== false } : {}),
          ...(patch.claude.binary !== undefined
            ? { binary: String(patch.claude.binary || "claude").trim() || "claude" }
            : {}),
        }
      : {}),
  };
  const nextCursor = {
    ...existingCursor,
    ...(patch.cursor && typeof patch.cursor === "object"
      ? {
          ...(patch.cursor.workspaceDir !== undefined
            ? { workspaceDir: normalizeAbsoluteDirectory(patch.cursor.workspaceDir, existingCursor.workspaceDir) }
            : {}),
          ...(patch.cursor.enabled !== undefined ? { enabled: patch.cursor.enabled !== false } : {}),
          ...(patch.cursor.binary !== undefined
            ? { binary: normalizeCursorAgentBinary(patch.cursor.binary) }
            : {}),
        }
      : {}),
  };
  await fs.mkdir(nextCodex.workspaceDir, { recursive: true });
  await fs.mkdir(nextClaude.workspaceDir, { recursive: true });
  await fs.mkdir(nextCursor.workspaceDir, { recursive: true });
  const nextSettings = {
    ...settings,
    codex: {
      ...nextCodex,
    },
    claude: {
      ...(settings.claude && typeof settings.claude === "object" ? settings.claude : {}),
      ...nextClaude,
    },
    cursor: {
      ...(settings.cursor && typeof settings.cursor === "object" ? settings.cursor : {}),
      ...nextCursor,
    },
  };
  await store.updateSettings({ settings: JSON.stringify(nextSettings) });
  return { ...nextCodex, claude: nextClaude, cursor: nextCursor };
}

function publicLocalCodexSettings(settings = {}) {
  const { skillsDir: _skillsDir, ...publicSettings } = settings || {};
  return publicSettings;
}

function safeSkillRelativePath(value) {
  const normalized = String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || path.isAbsolute(normalized)) {
    throw new Error("Invalid skill file path");
  }
  return normalized;
}

function resolveSkillFilePath(skillDir, relativePath) {
  const safeRelative = safeSkillRelativePath(relativePath);
  const fullPath = path.resolve(skillDir, safeRelative);
  const root = path.resolve(skillDir);
  if (fullPath !== root && !fullPath.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid skill file path");
  }
  return { fullPath, relativePath: safeRelative };
}

async function listEditableSkillFiles(skillDir, relativeRoot = "") {
  const files = [];
  const dir = relativeRoot ? path.join(skillDir, relativeRoot) : skillDir;
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const relativePath = relativeRoot ? `${relativeRoot}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...await listEditableSkillFiles(skillDir, relativePath));
      continue;
    }
    if (!/\.(md|json|txt|toml|yaml|yml)$/i.test(entry.name)) continue;
    const content = await fs.readFile(path.join(skillDir, relativePath), "utf8").catch(() => "");
    files.push({ relativePath, content });
  }
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function redactLocalSensitiveValue(value) {
  if (Array.isArray(value)) return value.map(redactLocalSensitiveValue);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/secret|token|password|private|accessKeyId|sessionToken|apiKey/i.test(key)) {
      out[key] = "[redacted]";
    } else {
      out[key] = redactLocalSensitiveValue(entry);
    }
  }
  return out;
}

function normalizeExternalAgentContextMarkdown(markdown = "") {
  const text = String(markdown || "").trim();
  if (!text) return "";
  if (/^#{1,3}\s+Execution Context\b/im.test(text)) {
    return text.replace(/^#{1,3}\s+Execution Context\b/im, "## Execution Context");
  }
  return `## Execution Context\n\n${text}`;
}

function buildExternalAgentMcpSkillInstructionLines({ runner = "codex" } = {}) {
  const normalizedRunner = normalizeCodingAgentRunner(runner);
  return [
    normalizedRunner === "cursor"
      ? "- Cursor MCP configuration for this run is written to `.cursor/mcp.json` and `.mcp.json` in the run workspace."
      : null,
    "- Use CloudAgent MCP CLI session tools for cloud CLI work: `cli_session_start` and `cli_session_execute`.",
    "- CloudAgent binds the selected environment and credentials to those CLI session tools automatically; do not ask the user for cloud secrets or credential locations.",
    "- Run shell commands through `cli_session_execute` when you need AWS CLI calls, temporary files, helper scripts, or command pipelines for this skill. `cli_session_execute` can create the session automatically when needed.",
    "- First validate cloud access through the CLI session with `aws sts get-caller-identity --output json`, then continue through that same session.",
    "- Do not call the MCP HTTP endpoint directly with curl or JSON-RPC. If native CloudAgent MCP tools are not exposed in the agent session, stop and report that the MCP server did not load.",
    "- Do not run cloud CLI commands directly from the agent process shell for account inspection; use the MCP CLI session tools.",
    "- If the skill requires approved CloudFormation changes, prefer CloudAgent MCP `aws_cfn_operations` over direct mutating AWS CLI commands.",
  ].filter(Boolean);
}

function buildDefaultSkillMarkdown({ blueprint, planPayload, runner = "codex" }) {
  const runnerLabel = codingAgentRunnerLabel(runner);
  return [
    `# ${blueprint?.title || planPayload?.title || `CloudAgent ${runnerLabel} Skill`}`,
    "",
    `Use this skill when running this CloudAgent skill through ${runnerLabel}.`,
    "",
    "## Instructions",
    "",
    "- Read this `SKILL.md` completely before acting. It is the source of truth for the run.",
    ...buildExternalAgentMcpSkillInstructionLines({ runner }),
    "- Keep all work scoped to the selected environment, workload, regions, and preflight context.",
    "- If a step needs user input or you are unsure whether it is safe to continue, stop and return a `User input needed` section with the exact question, options, and recommended default.",
    "- Return concise Markdown with Findings, Evidence, Actions Taken, and Result.",
    "- Do not claim AWS or local changes were made unless you actually performed them.",
    "",
  ].join("\n");
}

function isEmptySkillValue(value) {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0 || value.every(isEmptySkillValue);
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

function stringifySkillValue(value) {
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "string")) {
      return value.map((item) => `- ${item}`).join("\n");
    }
    return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
  }
  if (value && typeof value === "object") {
    return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
  }
  return String(value);
}

function sanitizeBlueprintSkillValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeBlueprintSkillValue);
  if (!value || typeof value !== "object") return value;
  const ignored = new Set(["id", "task_id", "maxTurns", "max_turns", "status"]);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !ignored.has(key))
      .map(([key, entry]) => [key, sanitizeBlueprintSkillValue(entry)])
  );
}

function appendSkillSection(lines, heading, value, level = 2) {
  if (isEmptySkillValue(value)) return;
  lines.push("", `${"#".repeat(level)} ${heading}`, "", stringifySkillValue(value));
}

function taskToMarkdown(task = {}, index = 0) {
  const lines = [];
  const title = task.title || task.name || `Task ${index + 1}`;
  lines.push(`#### ${index + 1}. ${title}`, "");
  const ignored = new Set(["title", "name", "id", "task_id", "maxTurns", "max_turns", "status"]);
  for (const [key, value] of Object.entries(task)) {
    if (ignored.has(key) || isEmptySkillValue(value)) continue;
    const cleanValue = sanitizeBlueprintSkillValue(value);
    if (isEmptySkillValue(cleanValue)) continue;
    const label = key
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
    lines.push(`**${label}**`, "", stringifySkillValue(cleanValue), "");
  }
  return lines.join("\n").trim();
}

function planToSkillMarkdown(planPayload = {}) {
  const phases = Array.isArray(planPayload?.plan)
    ? planPayload.plan
    : Array.isArray(planPayload?.phases)
      ? planPayload.phases
      : [];
  if (!phases.length) return "";
  const lines = ["## Execution Plan"];
  phases.forEach((phase, phaseIndex) => {
    const phaseTitle = phase?.title || phase?.name || `Phase ${phaseIndex + 1}`;
    lines.push("", `### ${phaseIndex + 1}. ${phaseTitle}`);
    if (!isEmptySkillValue(phase?.description)) {
      lines.push("", stringifySkillValue(phase.description));
    }
    const tasks = Array.isArray(phase?.tasks) ? phase.tasks : [];
    tasks.forEach((task, taskIndex) => {
      lines.push("", taskToMarkdown(task, taskIndex));
    });
  });
  return lines.join("\n").trim();
}

function normalizeExecutionPreferencesForSkill(executionPreferences = {}) {
  const preferences = executionPreferences && typeof executionPreferences === "object"
    ? executionPreferences
    : {};
  return {
    ...preferences,
    useDefaultValuesWithoutConfirmation: Boolean(preferences.useDefaultValuesWithoutConfirmation),
    applyChangesWithoutConfirmation: Boolean(preferences.applyChangesWithoutConfirmation),
  };
}

function buildExternalAgentExecutionContextPayload({
  title,
  runner,
  blueprint = {},
  planPayload = {},
  preflightResult = {},
  authProfile = {},
  regions = [],
  defaultValues = {},
  executionPreferences = {},
  localDataSnapshot = {},
} = {}) {
  const preflight =
    preflightResult && typeof preflightResult === "object"
      ? {
          status: preflightResult.status || null,
          readOnlyResult: preflightResult.readOnlyResult || null,
          analysis: preflightResult.analysis || null,
          recommendation: preflightResult.recommendation || null,
          updateStrategy: preflightResult.updateStrategy || null,
          rewriteConfig: preflightResult.rewriteConfig || null,
          validation: preflightResult.validation || null,
          executionContext: preflightResult.executionContext || null,
        }
      : {};
  return redactLocalSensitiveValue({
    runtime: "local",
    title,
    runner,
    skillId: blueprint?.recordId || blueprint?.id || planPayload?.recordId || planPayload?.id || null,
    skillTitle: blueprint?.title || planPayload?.title || planPayload?.planTitle || title || null,
    authSummary: localAuthSummary(authProfile),
    regions,
    defaultValues,
    executionPreferences: normalizeExecutionPreferencesForSkill(executionPreferences),
    preflight,
    localDataSnapshot: {
      selectedProfiles: Array.isArray(localDataSnapshot?.selectedProfiles)
        ? localDataSnapshot.selectedProfiles.slice(0, 5)
        : [],
      selectedWorkloads: Array.isArray(localDataSnapshot?.selectedWorkloads)
        ? localDataSnapshot.selectedWorkloads.slice(0, 5)
        : [],
      recentScannerRuns: Array.isArray(localDataSnapshot?.recentScannerRuns)
        ? localDataSnapshot.recentScannerRuns.slice(0, 5)
        : [],
      summaries: Array.isArray(localDataSnapshot?.summaries)
        ? localDataSnapshot.summaries.slice(0, 5)
        : [],
    },
  });
}

function appendExternalContextJson(lines, heading, value, maxLength = 5000) {
  if (isEmptySkillValue(value)) return;
  lines.push("", `### ${heading}`, "", "```json", compactLocalJson(redactLocalSensitiveValue(value), maxLength), "```");
}

function appendExternalExecutionPreferences(lines, executionPreferences = {}) {
  const preferences = normalizeExecutionPreferencesForSkill(executionPreferences);
  const knownKeys = new Set([
    "useDefaultValuesWithoutConfirmation",
    "applyChangesWithoutConfirmation",
  ]);
  lines.push(
    "",
    "### Execution Preferences",
    "",
    `- Auto-confirm defaults (\`useDefaultValuesWithoutConfirmation\`): ${preferences.useDefaultValuesWithoutConfirmation}`,
    `- Auto-confirm changes (\`applyChangesWithoutConfirmation\`): ${preferences.applyChangesWithoutConfirmation}`
  );
  const otherPreferences = Object.fromEntries(
    Object.entries(preferences).filter(([key]) => !knownKeys.has(key))
  );
  if (!isEmptySkillValue(otherPreferences)) {
    lines.push("", "Additional preferences:", "", "```json", compactLocalJson(otherPreferences, 3000), "```");
  }
}

function buildExternalAgentExecutionContextFallback(payload = {}) {
  const runnerLabel = codingAgentRunnerLabel(payload.runner);
  const authSummary = payload.authSummary || {};
  const preflight = payload.preflight || {};
  const executionContext = preflight.executionContext || {};
  const target = executionContext.target || {};
  const delivery = executionContext.delivery || executionContext.deliveryTarget || null;
  const analysis = preflight.analysis || {};
  const readOnlyResult = preflight.readOnlyResult || {};
  const selectedProfiles = payload.localDataSnapshot?.selectedProfiles || [];
  const selectedWorkloads = payload.localDataSnapshot?.selectedWorkloads || [];
  const safetyMode = analysis.isMutating
    ? "mutating"
    : readOnlyResult.isReadOnly === true
      ? "read-only"
      : "unknown";
  const lines = [
    "## Execution Context",
    "",
    `- Runner: ${runnerLabel}.`,
    `- Target scope: ${target.scope || target.type || "environment/workload not explicitly resolved"}.`,
    authSummary.accountId ? `- Account: ${authSummary.accountId}.` : null,
    authSummary.permissionProfileId ? `- Permission profile: ${authSummary.permissionProfileId}.` : null,
    authSummary.awsProfile ? `- AWS profile label: ${authSummary.awsProfile}.` : null,
    authSummary.region ? `- Default region: ${authSummary.region}.` : null,
    Array.isArray(payload.regions) && payload.regions.length
      ? `- Requested regions: ${uniqueLocalStrings(payload.regions).join(", ")}.`
      : null,
    `- Safety classification: ${safetyMode}.`,
    preflight.recommendation?.summary ? `- Preflight recommendation: ${preflight.recommendation.summary}` : null,
    preflight.updateStrategy?.method ? `- Skill method: ${preflight.updateStrategy.method}.` : null,
    delivery?.type || delivery?.mode ? `- Delivery target: ${delivery.type || delivery.mode}.` : null,
    "",
    "### Operational Guidance",
    "",
    "- Keep the run scoped to the target account, region set, workload/environment, and safety classification above.",
    "- CloudAgent handles authentication for the selected environment inside the `cli_session_*` tools. You do not need to discover, request, or manage credential values.",
    "- Use the CloudAgent MCP CLI session for AWS CLI commands and for temporary files or helper scripts needed during the session.",
    "- Treat missing workload deployment settings or scanner data as a coverage limitation; do not invent resource state.",
  ].filter(Boolean);
  appendExternalContextJson(lines, "Target Details", target, 5000);
  appendExternalContextJson(lines, "Deployment Settings", executionContext.deployment || executionContext.deploymentSettings || {}, 6000);
  appendExternalContextJson(lines, "Selected Workloads", selectedWorkloads, 9000);
  appendExternalContextJson(lines, "Selected Environments", selectedProfiles, 7000);
  appendExternalExecutionPreferences(lines, payload.executionPreferences || {});
  return lines.join("\n");
}

async function buildExternalAgentExecutionContextMarkdown({
  title,
  runner = "codex",
  blueprint = {},
  planPayload = {},
  preflightResult = {},
  authProfile = {},
  regions = [],
  defaultValues = {},
  executionPreferences = {},
  localDataSnapshot = {},
} = {}) {
  const runnerLabel = codingAgentRunnerLabel(runner);
  const payload = buildExternalAgentExecutionContextPayload({
    title,
    runner,
    blueprint,
    planPayload,
    preflightResult,
    authProfile,
    regions,
    defaultValues,
    executionPreferences,
    localDataSnapshot,
  });
  const fallbackContextText = buildExternalAgentExecutionContextFallback(payload);

  if (!isLocalOpenAIConfigured()) {
    console.log("[local /agent] external execution context LLM skipped: local OpenAI is not configured", {
      title,
      runner: runnerLabel,
      fallbackContextChars: fallbackContextText.length,
    });
    return {
      markdown: fallbackContextText,
      generatedBy: "deterministic-fallback",
    };
  }

  try {
    console.log("[local /agent] external execution context LLM starting", {
      title,
      runner: runnerLabel,
      payloadChars: compactLocalJson(payload, 200_000).length,
      fallbackContextChars: fallbackContextText.length,
      hasExecutionContext: Boolean(payload.preflight?.executionContext),
      selectedWorkloadCount: payload.localDataSnapshot?.selectedWorkloads?.length || 0,
      selectedEnvironmentCount: payload.localDataSnapshot?.selectedProfiles?.length || 0,
    });
    const generated = await generateLocalExternalAgentExecutionContextWithOpenAI({
      title,
      runner: runnerLabel,
      blueprint,
      planPayload,
      preflight: payload.preflight,
      executionContext: payload.preflight?.executionContext || null,
      authSummary: payload.authSummary,
      regions,
      defaultValues,
      executionPreferences: payload.executionPreferences,
      localDataSnapshot: payload.localDataSnapshot,
      fallbackContextText,
    });
    const markdown = normalizeExternalAgentContextMarkdown(generated);
    if (markdown.trim()) {
      console.log("[local /agent] external execution context LLM completed", {
        title,
        runner: runnerLabel,
        contextChars: markdown.trim().length,
      });
      return {
        markdown,
        generatedBy: "local-openai",
      };
    }
    console.log("[local /agent] external execution context LLM returned empty context", {
      title,
      runner: runnerLabel,
    });
  } catch (error) {
    console.warn("[local /agent] external execution context generation failed", {
      title,
      runner: runnerLabel,
      error: error?.message || String(error),
    });
  }

  return {
    markdown: fallbackContextText,
    generatedBy: "deterministic-fallback",
  };
}

function buildRuntimeExternalAgentSkillMarkdown({
  blueprint = {},
  planPayload = {},
  runner = "codex",
  externalAgentContextMarkdown = "",
} = {}) {
  const lines = [buildDefaultSkillMarkdown({ blueprint, planPayload, runner }).trim()];
  const executionContextMarkdown = normalizeExternalAgentContextMarkdown(externalAgentContextMarkdown);
  if (executionContextMarkdown) lines.push("", executionContextMarkdown);
  appendSkillSection(lines, "Skill", blueprint?.title || planPayload?.title || planPayload?.planTitle);
  appendSkillSection(lines, "Description", parseStoredJsonValue(blueprint?.description, planPayload?.description));
  appendSkillSection(lines, "Cloud Provider", blueprint?.cloudProvider || planPayload?.cloudProvider);
  appendSkillSection(lines, "Required Permissions", parseStoredJsonValue(blueprint?.requiredPermissions, {}));
  appendSkillSection(lines, "Plan Settings", parseStoredJsonValue(blueprint?.planSettings, planPayload?.planSettings || {}));
  const planMarkdown = planToSkillMarkdown(planPayload);
  if (planMarkdown) {
    lines.push("", planMarkdown);
  }
  return `${lines.filter(Boolean).join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

function buildRuntimeExternalAgentSkillFiles({
  blueprint = {},
  planPayload = {},
  runner = "codex",
  externalAgentContextMarkdown = "",
} = {}) {
  return [
    {
      relativePath: "SKILL.md",
      content: buildRuntimeExternalAgentSkillMarkdown({
        blueprint,
        planPayload,
        runner,
        externalAgentContextMarkdown,
      }),
    },
  ];
}

async function buildRuntimeExternalAgentSkillFilesForRun({
  title,
  runner = "codex",
  blueprint = {},
  planPayload = {},
  preflightResult = {},
  authProfile = {},
  regions = [],
  defaultValues = {},
  executionPreferences = {},
  localDataSnapshot = {},
} = {}) {
  const executionContext = await buildExternalAgentExecutionContextMarkdown({
    title,
    runner,
    blueprint,
    planPayload,
    preflightResult,
    authProfile,
    regions,
    defaultValues,
    executionPreferences,
    localDataSnapshot,
  });
  return {
    skillFiles: buildRuntimeExternalAgentSkillFiles({
      blueprint,
      planPayload,
      runner,
      externalAgentContextMarkdown: executionContext.markdown,
    }),
    executionContext,
  };
}

function migrateDefaultCodexSkillMarkdown(content = "") {
  return String(content || "")
    .replace(
      "- Read `blueprint.json`, `plan.json`, and `cloudagent-run-context.json` before acting.",
      "- Read this `SKILL.md` completely before acting. It contains the execution context and skill plan for this run."
    )
    .replace(
      "- Use the AWS CLI for AWS inspection or execution. CloudAgent passes credentials to the Codex process through the standard AWS environment variables or selected AWS profile described in `session-context.json`.",
      "- Use the Execution Context section to understand the selected AWS account/profile and region.\n- For cloud CLI work, use the CloudAgent MCP tools `cli_session_start` and `cli_session_execute`. CloudAgent binds the selected environment and credentials to those tools automatically.\n- Do not call the MCP HTTP endpoint directly with curl or JSON-RPC. If native CloudAgent MCP tools are not exposed in the agent session, stop and report that the MCP server did not load.\n- Do not run cloud CLI commands directly from the agent process shell for account inspection; use the MCP CLI session tools.\n- First validate AWS access through `cli_session_execute` with `aws sts get-caller-identity --output json`, then continue through that same CLI session."
    )
    .replace(
      "- Use CloudAgent MCP tools when live CloudAgent data is needed and the files do not already contain it.",
      "- Use the Execution Context section to understand the selected AWS account/profile and region.\n- For cloud CLI work, use the CloudAgent MCP tools `cli_session_start` and `cli_session_execute`. CloudAgent binds the selected environment and credentials to those tools automatically.\n- Do not call the MCP HTTP endpoint directly with curl or JSON-RPC. If native CloudAgent MCP tools are not exposed in the agent session, stop and report that the MCP server did not load.\n- Do not run cloud CLI commands directly from the agent process shell for account inspection; use the MCP CLI session tools.\n- First validate AWS access through `cli_session_execute` with `aws sts get-caller-identity --output json`, then continue through that same CLI session.\n- If a step needs user input or you are unsure whether it is safe to continue, stop and return a `User input needed` section with the exact question, options, and recommended default."
    )
    .replace(
      "- Use the AWS CLI for AWS inspection or execution. CloudAgent passes credential values to the Codex process through the environment variables listed at `session-context.json.credentialAccess.availableEnvVars` and `session-context.json.environment.authProfile.credentialEnvVars`.",
      "- For cloud CLI work, use the CloudAgent MCP tools `cli_session_start` and `cli_session_execute`. CloudAgent binds the selected environment and credentials to those tools automatically."
    )
    .replace(
      "- Do not ask the user where credentials are stored. Do not rely on `~/.aws/config`, `~/.aws/credentials`, or `aws configure list` to find credentials. The process environment is the credential source of truth.",
      "- Do not call the MCP HTTP endpoint directly with curl or JSON-RPC. If native CloudAgent MCP tools are not exposed in the agent session, stop and report that the MCP server did not load.\n- Do not run cloud CLI commands directly from the agent process shell for account inspection; use the MCP CLI session tools."
    )
    .replace(
      "- First validate AWS access with `aws sts get-caller-identity --output json`, then continue with the skill-specific read-only AWS CLI commands.",
      "- First validate AWS access by calling MCP `cli_session_execute` with `aws sts get-caller-identity --output json`, then continue through that same CLI session."
    );
}

async function ensureCodexSkillForBlueprint(store, blueprintId) {
  const blueprint = await store.getSkill(blueprintId);
  if (!blueprint) return null;
  const settings = await getLocalCodexSettings(store);
  const existingPath = String(blueprint.codexSkillPath || "").trim();
  const root = path.resolve(settings.skillsDir);
  const fallbackDir = path.join(root, codexSlug(`${blueprint.title || blueprint.recordId}-${blueprint.recordId}`));
  const skillDir = existingPath ? path.resolve(existingPath) : fallbackDir;
  if (skillDir !== root && !skillDir.startsWith(`${root}${path.sep}`)) {
    throw new Error("Configured skill path is outside the Codex skills directory");
  }
  await fs.mkdir(skillDir, { recursive: true });
  const planPayload = parseStoredJsonValue(blueprint.plan, {}) || {};
  const defaults = {
    "SKILL.md": buildDefaultSkillMarkdown({ blueprint, planPayload }),
  };
  for (const [fileName, content] of Object.entries(defaults)) {
    const target = path.join(skillDir, fileName);
    try {
      await fs.access(target);
    } catch {
      await fs.writeFile(target, content);
    }
  }
  const skillMarkdownPath = path.join(skillDir, "SKILL.md");
  const existingSkillMarkdown = await fs.readFile(skillMarkdownPath, "utf8").catch(() => "");
  const migratedSkillMarkdown = migrateDefaultCodexSkillMarkdown(existingSkillMarkdown);
  if (migratedSkillMarkdown && migratedSkillMarkdown !== existingSkillMarkdown) {
    await fs.writeFile(skillMarkdownPath, migratedSkillMarkdown);
  }
  return {
    blueprint,
    settings,
    skillDir,
    files: await listEditableSkillFiles(skillDir),
  };
}

function localAuth(req, _res, next) {
  req.auth = { ...LOCAL_AUTH };
  next();
}

function profileSummaryLine(profile) {
  const authProfile = parseStoredObject(profile?.authProfile, {});
  const accountId = authProfile.awsAccountId || authProfile.accountId || authProfile.subscriptionId || null;
  return [
    profile?.name || profile?.recordId || "Untitled environment",
    profile?.type ? `type: ${profile.type}` : null,
    accountId ? `account/subscription: ${accountId}` : null,
  ].filter(Boolean).join(" | ");
}

function workloadSummaryLine(workload) {
  const trackedResources = parseStoredObject(workload?.trackedResources, { resources: [], stacks: [] });
  const resourceCount = Array.isArray(trackedResources.resources) ? trackedResources.resources.length : 0;
  const stackCount = Array.isArray(trackedResources.stacks) ? trackedResources.stacks.length : 0;
  return [
    workload?.workloadName || workload?.workloadId || "Untitled workload",
    `${Array.isArray(workload?.environments) ? workload.environments.length : 0} environment(s)`,
    `${resourceCount} resource(s)`,
    `${stackCount} stack(s)`,
  ].join(" | ");
}

function localArray(value) {
  return Array.isArray(value) ? value : [];
}

function scannerGeneratedAt(kind, payload = {}) {
  return payload?.analysis?.[kind]?.generatedAt || payload?.generatedAt || payload?.updatedAt || null;
}

function scannerResourceArray(payload = {}) {
  if (Array.isArray(payload.resources)) return payload.resources;
  const results = payload?.results;
  if (!results || typeof results !== "object" || Array.isArray(results)) return [];
  return Object.values(results).flatMap((result) =>
    Array.isArray(result?.resources) ? result.resources : []
  );
}

function summarizeInventoryForExecutiveSummary(payload = {}) {
  const resources = scannerResourceArray(payload);
  const serviceCounts = resources.reduce((counts, resource) => {
    const service = String(
      resource?.service || resource?.serviceKey || resource?.resourceType || resource?.type || "unknown"
    );
    counts[service] = (counts[service] || 0) + 1;
    return counts;
  }, {});
  const regionCounts = resources.reduce((counts, resource) => {
    const region = String(resource?.region || "global");
    counts[region] = (counts[region] || 0) + 1;
    return counts;
  }, {});

  return {
    available: true,
    generatedAt: scannerGeneratedAt("inventory", payload),
    accountId: payload.accountId || payload.defaultAccountId || payload.authProfile?.awsAccountId || null,
    resourceCount: resources.length,
    services: Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([service, count]) => ({ service, count })),
    regions: Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([region, count]) => ({ region, count })),
    resourceSamples: resources.slice(0, 20).map((resource) => ({
      resourceId: resource.resourceId || resource.id || resource.name || resource.arn || null,
      resourceType: resource.resourceType || resource.type || null,
      service: resource.service || resource.serviceKey || null,
      region: resource.region || null,
      name: resource.name || null,
    })),
  };
}

function isExecutiveSummaryProblemStatus(value) {
  return /(fail|error|warn|critical|alarm|unhealthy|impaired|unknown|expired|aborted|problem)/i.test(
    String(value || "")
  );
}

function summarizeHealthForExecutiveSummary(payload = {}) {
  const resources = localArray(payload.resources);
  const issueResources = resources.filter((resource) => {
    const checks = localArray(resource?.checks);
    return (
      localArray(resource?.errors).length > 0 ||
      isExecutiveSummaryProblemStatus(resource?.status || resource?.healthStatus || resource?.state) ||
      checks.some((check) => isExecutiveSummaryProblemStatus(check?.status || check?.severity))
    );
  });

  return {
    available: true,
    generatedAt: scannerGeneratedAt("health", payload),
    accountId: payload.accountId || null,
    permissionProfileId: payload.permissionProfileId || null,
    workloadId: payload.workloadId || null,
    resourceCount: resources.length,
    issueResourceCount: issueResources.length,
    summary: payload.summary || payload.analysis?.health?.summary || {},
    issueSamples: issueResources.slice(0, 15).map((resource) => ({
      resourceId: resource.resourceId || resource.id || resource.name || resource.arn || null,
      resourceType: resource.resourceType || resource.type || null,
      region: resource.region || null,
      status: resource.status || resource.healthStatus || resource.state || null,
      errors: localArray(resource.errors).slice(0, 3),
      failedChecks: localArray(resource.checks)
        .filter((check) => isExecutiveSummaryProblemStatus(check?.status || check?.severity))
        .slice(0, 5)
        .map((check) => ({
          checkId: check.checkId || check.id || null,
          name: check.checkName || check.name || null,
          status: check.status || check.severity || null,
          summary: String(check.summary || check.message || check.description || "").slice(0, 500),
        })),
    })),
  };
}

function summarizeCostForExecutiveSummary(payload = {}) {
  const checks = localArray(payload.checks);
  const problemChecks = checks.filter((check) =>
    isExecutiveSummaryProblemStatus(check?.status || check?.severity)
  );
  return {
    available: true,
    generatedAt: scannerGeneratedAt("cost", payload),
    accountId: payload.accountId || null,
    permissionProfileId: payload.permissionProfileId || null,
    lookbackDays: payload.lookbackDays || payload.data?.spend?.range?.lookbackDays || null,
    statusCounts: payload.statusCounts || {},
    errorCount: localArray(payload.errors).length,
    errors: localArray(payload.errors).slice(0, 5),
    spend: {
      range: payload.data?.spend?.range || null,
      dailyTotalCount: localArray(payload.data?.spend?.dailyTotal).length,
      dailyByServiceCount: localArray(payload.data?.spend?.dailyByService).length,
    },
    issueSamples: problemChecks.slice(0, 15).map((check) => ({
      checkId: check.checkId || check.id || null,
      name: check.checkName || check.name || null,
      category: check.category || null,
      status: check.status || null,
      summary: String(check.summary || "").slice(0, 500),
    })),
  };
}

async function readExecutiveSummaryScannerContext(store, kind, scopeId) {
  if (!scopeId || !store || typeof store.readLatestScannerArtifact !== "function") return null;
  const payload = await store.readLatestScannerArtifact(kind, scopeId).catch((error) => {
    console.warn("[local executive summary] failed to read scanner artifact", {
      kind,
      scopeId,
      message: error?.message || String(error),
    });
    return null;
  });
  if (!payload) return null;
  if (kind === "inventory") return summarizeInventoryForExecutiveSummary(payload);
  if (kind === "health") return summarizeHealthForExecutiveSummary(payload);
  if (kind === "cost") return summarizeCostForExecutiveSummary(payload);
  return null;
}

function executiveSummaryAvailability(context = {}) {
  const environmentArtifacts = localArray(context.environmentArtifacts);
  return {
    inventory: Boolean(context.inventory || environmentArtifacts.some((entry) => entry.inventory)),
    health: Boolean(context.health || environmentArtifacts.some((entry) => entry.health)),
    cost: Boolean(context.cost || environmentArtifacts.some((entry) => entry.cost)),
  };
}

function missingExecutiveSummarySources(context = {}) {
  const availability = context.availability || executiveSummaryAvailability(context);
  return ["inventory", "health", "cost"].filter((kind) => !availability[kind]);
}

async function buildExecutiveSummaryAnalysisContext({
  store,
  scope,
  target,
  relatedProfiles = [],
} = {}) {
  if (scope === "account") {
    const scopeId = target?.recordId;
    const [inventory, health, cost] = await Promise.all([
      readExecutiveSummaryScannerContext(store, "inventory", scopeId),
      readExecutiveSummaryScannerContext(store, "health", scopeId),
      readExecutiveSummaryScannerContext(store, "cost", scopeId),
    ]);
    const context = {
      scope: "account",
      scopeId,
      inventory,
      health,
      cost,
    };
    return { ...context, availability: executiveSummaryAvailability(context) };
  }

  const workloadId = target?.workloadId;
  const workloadHealth = await readExecutiveSummaryScannerContext(store, "health", workloadId);
  const environmentArtifacts = await Promise.all(
    relatedProfiles.map(async (profile) => {
      const scopeId = profile?.recordId;
      const [inventory, health, cost] = await Promise.all([
        readExecutiveSummaryScannerContext(store, "inventory", scopeId),
        readExecutiveSummaryScannerContext(store, "health", scopeId),
        readExecutiveSummaryScannerContext(store, "cost", scopeId),
      ]);
      return {
        permissionProfileId: scopeId,
        name: profile?.name || scopeId,
        inventory,
        health,
        cost,
      };
    })
  );
  const context = {
    scope: "workload",
    scopeId: workloadId,
    health: workloadHealth,
    environmentArtifacts,
  };
  return { ...context, availability: executiveSummaryAvailability(context) };
}

function toPositiveInt(value, fallback = 50, max = 200) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function getTimestamp(item) {
  return item?.updatedAt || item?.createdAt || item?.purchaseDate || item?.startedAt || "";
}

function getCredentialType(authProfile = {}) {
  const authType = String(authProfile.authType || authProfile.credentialMode || "").trim();
  if (authType === "aws-sso") return "aws-sso";
  if (authType === "static-credentials") return "static-credentials";
  if (authProfile.accessKeyId && authProfile.secretAccessKey) return "static-credentials";
  if (authProfile.awsProfile || authProfile.profileName || authProfile.profile) return "profile";
  return "unknown";
}

function credentialRemediation({ authProfile = {}, code } = {}) {
  const profile = String(authProfile.awsProfile || authProfile.profileName || authProfile.profile || "").trim();
  if (code === "AWS_SSO_LOGIN_REQUIRED") {
    return profile
      ? `Run: aws sso login --profile ${profile}`
      : "Run aws sso login for the selected AWS SSO profile.";
  }
  if (code === "AWS_PROFILE_NOT_FOUND") {
    return "Choose an existing AWS profile from ~/.aws/config or ~/.aws/credentials, or update this environment to use access keys.";
  }
  if (code === "AWS_TOKEN_EXPIRED") {
    return profile
      ? `Refresh the session for profile ${profile}, then recheck credentials.`
      : "Refresh the AWS session token, then recheck credentials.";
  }
  if (code === "AWS_STATIC_CREDENTIALS_INVALID") {
    return "Update the access key ID, secret access key, and session token if one is required.";
  }
  if (code === "AWS_ACCOUNT_MISMATCH") {
    return "Update the configured AWS account ID or choose credentials for the configured account.";
  }
  return "Open Cloud Setup, update the credentials, then recheck this environment.";
}

function classifyCredentialError(error, authProfile = {}) {
  const rawMessage = error?.message || String(error || "Failed to validate AWS credentials.");
  let code = "AWS_CREDENTIALS_INVALID";
  let message = rawMessage;

  if (/resolved to account .* configured for/i.test(rawMessage)) {
    code = "AWS_ACCOUNT_MISMATCH";
    message = rawMessage;
  } else if (/sso|token.*expired|session.*expired|login/i.test(rawMessage)) {
    code = "AWS_SSO_LOGIN_REQUIRED";
    message = "AWS SSO session needs login or refresh.";
  } else if (/profile .*not.*found|could not.*profile|config profile.*not.*found/i.test(rawMessage)) {
    code = "AWS_PROFILE_NOT_FOUND";
    message = "AWS profile was not found in the local AWS config files.";
  } else if (/expiredtoken|security token.*expired|token.*expired|expired/i.test(rawMessage)) {
    code = "AWS_TOKEN_EXPIRED";
    message = "AWS session token is expired.";
  } else if (/invalidclienttokenid|signaturedoesnotmatch|invalid.*access|unrecognizedclient|access key/i.test(rawMessage)) {
    code = "AWS_STATIC_CREDENTIALS_INVALID";
    message = "AWS access keys or session token are invalid.";
  } else if (/could not be loaded from any providers|credential/i.test(rawMessage)) {
    code = "AWS_CREDENTIALS_UNAVAILABLE";
    message = "AWS credentials could not be resolved.";
  }

  return {
    ok: false,
    lastCheckedValid: false,
    status: "invalid",
    code,
    message,
    remediation: credentialRemediation({ authProfile, code }),
    checkedAt: new Date().toISOString(),
    lastCheckedAt: new Date().toISOString(),
    credentialType: getCredentialType(authProfile),
  };
}

async function validatePermissionProfileCredentials({ store, profile }) {
  const authProfile = parseStoredObject(profile?.authProfile, {});
  const normalizedType = String(profile?.type || "").trim().toLowerCase().replace(/_/g, " ");
  const provider = String(authProfile.provider || "").trim().toLowerCase();

  if (normalizedType !== "aws account" && provider !== "aws") {
    const status = {
      ok: true,
      lastCheckedValid: true,
      status: "not_applicable",
      code: "NOT_APPLICABLE",
      message: "Credential validation is only enabled for local AWS accounts.",
      checkedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      credentialType: getCredentialType(authProfile),
    };
    return store.updatePermissionProfile(profile.recordId, { credentialStatus: status });
  }

  try {
    const result = await validateLocalAwsCredentials({
      authProfile,
      region: authProfile.region || authProfile.defaultRegion,
    });
    const expectedAccountId = String(authProfile.awsAccountId || authProfile.accountId || "").trim();
    if (expectedAccountId && result.accountId && expectedAccountId !== result.accountId) {
      throw new Error(`AWS credentials resolved to account ${result.accountId}, but this environment is configured for ${expectedAccountId}.`);
    }
    const status = {
      ok: true,
      lastCheckedValid: true,
      status: "valid",
      code: result.code || "SUCCESS",
      message: result.message || "AWS credentials are valid.",
      accountId: result.accountId || null,
      arn: result.arn || null,
      checkedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      credentialType: getCredentialType(authProfile),
    };
    return store.updatePermissionProfile(profile.recordId, { credentialStatus: status });
  } catch (error) {
    const status = classifyCredentialError(error, authProfile);
    return store.updatePermissionProfile(profile.recordId, { credentialStatus: status });
  }
}

async function validateStoredPermissionProfiles({ store, recordId = null } = {}) {
  const profiles = recordId
    ? [await store.getPermissionProfile(recordId)].filter(Boolean)
    : await store.listPermissionProfiles();
  const results = await Promise.all(
    profiles.map((profile) => validatePermissionProfileCredentials({ store, profile }))
  );
  return results.filter(Boolean);
}

function isAwsCredentialBackedLocalProfile(profile, authProfile = null) {
  const parsedAuthProfile = authProfile || parseStoredObject(profile?.authProfile, {});
  const normalizedType = String(profile?.type || "").trim().toLowerCase().replace(/_/g, " ");
  const provider = String(parsedAuthProfile?.provider || "").trim().toLowerCase();
  return normalizedType === "aws account" || provider === "aws";
}

function getLocalCredentialRunBlocker(profile, authProfile = null) {
  if (!profile || !isAwsCredentialBackedLocalProfile(profile, authProfile)) return null;
  const status = profile.credentialStatus || profile.localCredentialStatus || null;
  const isValid =
    status?.lastCheckedValid === true ||
    status?.ok === true ||
    String(status?.status || "").trim().toLowerCase() === "valid";
  if (isValid) return null;
  const message =
    [status?.message, status?.remediation].filter(Boolean).join(" ") ||
    "AWS credentials have not been checked or are invalid. Recheck this environment in Cloud Setup.";
  return {
    code: status?.code || "AWS_CREDENTIALS_NOT_VALIDATED",
    message,
    status: status?.status || "invalid",
    credentialStatus: status,
  };
}

async function findPermissionProfileForAuthProfile(store, authProfile = {}) {
  const permissionProfileId =
    authProfile?.permissionProfileId ||
    authProfile?.recordId ||
    authProfile?.id ||
    null;
  if (permissionProfileId) {
    const profile = await store.getPermissionProfile(permissionProfileId);
    if (profile) return profile;
  }
  const accountId = String(authProfile?.awsAccountId || authProfile?.accountId || "").trim();
  if (!accountId) return null;
  const profiles = await store.listPermissionProfiles();
  return profiles.find((profile) => {
    const parsed = parseStoredObject(profile?.authProfile, {});
    return String(parsed.awsAccountId || parsed.accountId || "").trim() === accountId;
  }) || null;
}

function sortLocalItems(items = [], sortBy = "updatedAt", sortOrder = "desc") {
  const direction = String(sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = sortBy ? a?.[sortBy] : getTimestamp(a);
    const bv = sortBy ? b?.[sortBy] : getTimestamp(b);
    return direction * String(av || "").localeCompare(String(bv || ""));
  });
}

function filterByDateWindow(items = [], { startDate, endDate } = {}) {
  const startMs = startDate ? Date.parse(startDate) : null;
  const endMs = endDate ? Date.parse(endDate) : null;
  return items.filter((item) => {
    const timestamp = getTimestamp(item);
    const itemMs = timestamp ? Date.parse(timestamp) : null;
    if (!Number.isFinite(itemMs)) return true;
    if (Number.isFinite(startMs) && itemMs < startMs) return false;
    if (Number.isFinite(endMs) && itemMs > endMs) return false;
    return true;
  });
}

function paginateLocalItems(items = [], query = {}) {
  const pageSize = toPositiveInt(query.count ?? query.limit, 50);
  const start = Math.max(0, Number.parseInt(String(query.nextToken ?? query.cursor ?? "0"), 10) || 0);
  const pageItems = items.slice(start, start + pageSize);
  const nextOffset = start + pageItems.length;
  const nextToken = nextOffset < items.length ? String(nextOffset) : null;
  return {
    items: pageItems,
    count: pageItems.length,
    nextToken,
    nextCursor: nextToken,
  };
}

function workflowRunMatchesWorkflowId(run, workflowId) {
  if (!workflowId) return true;
  if (run?.workflowId === workflowId) return true;
  const definition = parseStoredJsonValue(run?.workflowDefinition, {});
  return definition?.workflowId === workflowId || definition?.id === workflowId;
}

function createWorkflowRunSummary(workflowDefinition = {}, status = "completed") {
  const title = workflowDefinition?.title || workflowDefinition?.workflowName || "Untitled Workflow";
  const now = new Date().toISOString();
  return {
    ...workflowDefinition,
    title,
    workflowRunSummary: {
      ...(workflowDefinition?.workflowRunSummary || {}),
      summary:
        workflowDefinition?.workflowRunSummary?.summary ||
        `Local mode recorded a run for "${title}". Full local workflow execution is not implemented yet.`,
      finalSummary:
        workflowDefinition?.workflowRunSummary?.finalSummary ||
        `Local mode recorded a run for "${title}". Full local workflow execution is not implemented yet.`,
      generatedAt: workflowDefinition?.workflowRunSummary?.generatedAt || now,
      status,
    },
  };
}

function createAgentRunLog({ title, status = "complete", blueprintId = null, summary = null } = {}) {
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

async function listWorkflowRunsForQuery(store, query = {}) {
  const runs = await store.listWorkflowRuns();
  const filtered = filterByDateWindow(
    runs.filter((run) => workflowRunMatchesWorkflowId(run, query.workflowId)),
    { startDate: query.startDate, endDate: query.endDate }
  );
  return paginateLocalItems(
    sortLocalItems(filtered, query.sortBy || "updatedAt", query.sortOrder || "desc"),
    query
  );
}

async function listAgentHistoryForQuery(store, query = {}) {
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

function blueprintToPlanState(blueprint = {}) {
  const plan = parseStoredJsonValue(blueprint?.plan, {}) || {};
  const rawDescription = parseStoredJsonValue(blueprint?.description, blueprint?.description);
  const planDescription = Array.isArray(rawDescription)
    ? rawDescription.join("\n")
    : (typeof rawDescription === "string" ? rawDescription : "");
  const planSettings = parseStoredJsonValue(blueprint?.planSettings, {}) || {};
  return {
    planId: blueprint?.recordId || plan?.planId || plan?.id || null,
    planTitle: blueprint?.title || plan?.planTitle || plan?.title || "Untitled Skill",
    planDescription,
    cloudProvider: blueprint?.cloudProvider || plan?.cloudProvider || "aws",
    plan: Array.isArray(plan?.plan) ? plan.plan : Array.isArray(plan?.tasks) ? plan.tasks : [],
    requiredPermissions: parseStoredJsonValue(blueprint?.requiredPermissions, {}),
    planSettings,
    planOverview: planSettings.planOverview || plan?.planOverview || null,
    planDefaultValues: planSettings.defaultValues || plan?.planDefaultValues || null,
    skeletonSettings: planSettings.skeletonSettings || plan?.skeletonSettings || null,
  };
}

function normalizeDescriptionList(value) {
  const parsed = parseStoredJsonValue(value, value);
  if (Array.isArray(parsed)) return parsed.filter((entry) => typeof entry === "string" && entry.trim());
  if (typeof parsed === "string" && parsed.trim()) return [parsed.trim()];
  return [];
}

function normalizeBuilderPlanArray(value) {
  const parsed = parseStoredJsonValue(value, value);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.plan)) return parsed.plan;
  if (Array.isArray(parsed?.skeleton)) return parsed.skeleton;
  return [];
}

function normalizeLocalPlanArrays(phases) {
  if (!Array.isArray(phases)) return [];
  return phases.map((phase) => ({
    ...phase,
    tasks: Array.isArray(phase?.tasks)
      ? phase.tasks.map((task) => {
          const parsedMaxTurns = Number.parseInt(String(task?.maxTurns ?? ""), 10);
          return {
            ...task,
            completionCriteria: Array.isArray(task?.completionCriteria)
              ? task.completionCriteria
              : task?.completionCriteria == null
                ? []
                : [String(task.completionCriteria)],
            maxTurns: Number.isFinite(parsedMaxTurns)
              ? Math.min(
                  MAX_PLAN_BUILDER_TASK_MAX_TURNS,
                  Math.max(1, parsedMaxTurns)
                )
              : DEFAULT_PLAN_BUILDER_TASK_MAX_TURNS,
          };
        })
      : [],
  }));
}

function ensureLocalPlanCloudProvider(phases, cloudProvider = "aws") {
  const provider = String(cloudProvider || "aws").trim().toLowerCase() === "azure" ? "azure" : "aws";
  return normalizeLocalPlanArrays(phases).map((phase) => ({
    ...phase,
    tasks: Array.isArray(phase?.tasks)
      ? phase.tasks.map((task) => ({
          ...task,
          cloudProvider: task?.cloudProvider || provider,
        }))
      : [],
  }));
}

function getOrInitLocalPlanBuilderState(sessionId) {
  const empty = {
    planId: undefined,
    planTitle: undefined,
    planDescription: undefined,
    cloudProvider: "aws",
    plan: [],
    status: "idle",
    cursor: undefined,
    requiredPermissions: undefined,
    planSettings: undefined,
  };
  if (!sessionId) return { ...empty };
  if (!localPlanBuilderSessions.has(sessionId)) {
    localPlanBuilderSessions.set(sessionId, { ...empty });
  }
  return localPlanBuilderSessions.get(sessionId);
}

function setLocalPlanBuilderState(sessionId, nextState) {
  if (!sessionId) return;
  const current = getOrInitLocalPlanBuilderState(sessionId);
  localPlanBuilderSessions.set(sessionId, { ...current, ...nextState });
}

function normalizeLocalPlanBuilderMessageArgs(message, planState, normalizeBlueprintCloudProvider) {
  if (!message || typeof message !== "object" || Array.isArray(message)) return message;
  const action = message?.action;
  const args = message?.args && typeof message.args === "object" ? { ...message.args } : null;
  if (!action || !args) return message;

  args.cloudProvider = normalizeBlueprintCloudProvider(
    args.cloudProvider || planState?.cloudProvider || "aws"
  );

  if (action === "generate_or_update_skeleton") {
    const hasExisting = Array.isArray(args.existingPlan) && args.existingPlan.length > 0;
    if (!hasExisting && Array.isArray(planState?.plan) && planState.plan.length > 0) {
      args.existingPlan = planState.plan;
    }
  }

  if (
    (action === "update_tasks_batch" || action === "update_tasks_all") &&
    (!Array.isArray(args.plan) || args.plan.length === 0)
  ) {
    args.plan = Array.isArray(planState?.plan) ? planState.plan : [];
  }

  if (action === "update_plan_settings") {
    const planObj = args.planObj && typeof args.planObj === "object" ? { ...args.planObj } : {};
    if (!Array.isArray(planObj.plan) || planObj.plan.length === 0) {
      planObj.plan = Array.isArray(planState?.plan) ? planState.plan : [];
    }
    args.planObj = planObj;
  }

  return { ...message, args };
}

async function savePlanBuilderBlueprint(store, payload = {}) {
  const planState = payload.planState || payload.plan || {};
  const recordId = payload.recordId || planState.recordId || planState.planId || planState.blueprintId;
  const planTitle = planState.planTitle || planState.title || payload.title || "Untitled Skill";
  const planDescription =
    (typeof planState.planDescription === "string" ? planState.planDescription : "") ||
    (typeof payload.planDescription === "string" ? payload.planDescription : "") ||
    (typeof planState.description === "string" ? planState.description : "") ||
    (typeof payload.description === "string" ? payload.description : "") ||
    "";
  const sourcePlanSettings =
    planState.planSettings && typeof planState.planSettings === "object" && !Array.isArray(planState.planSettings)
      ? planState.planSettings
      : payload.planSettings && typeof payload.planSettings === "object" && !Array.isArray(payload.planSettings)
        ? payload.planSettings
        : {};
  const planSettings = {
    ...sourcePlanSettings,
    ...(planState.planOverview ? { planOverview: planState.planOverview } : {}),
    ...(planState.planDefaultValues ? { defaultValues: planState.planDefaultValues } : {}),
    ...(planState.skeletonSettings ? { skeletonSettings: planState.skeletonSettings } : {}),
  };
  const planPayload = {
    title: planTitle,
    planTitle,
    cloudProvider: planState.cloudProvider || payload.cloudProvider || "aws",
    plan: normalizeBuilderPlanArray(planState.plan || planState.skeleton),
    ...(planDescription ? { description: planDescription } : {}),
    ...(planState.planOverview ? { planOverview: planState.planOverview } : {}),
    ...(planState.planDefaultValues ? { planDefaultValues: planState.planDefaultValues } : {}),
    ...(planState.skeletonSettings ? { skeletonSettings: planState.skeletonSettings } : {}),
  };
  const blueprintInput = {
    ...(recordId ? { recordId } : {}),
    title: planTitle,
    description: normalizeDescriptionList(planDescription),
    cloudProvider: planPayload.cloudProvider,
    plan: planPayload,
    requiredPermissions: planState.requiredPermissions || payload.requiredPermissions || {},
    planSettings,
    status: payload.status || "ready",
  };
  const blueprint = recordId && await store.getSkill(recordId)
    ? await store.updateSkill(recordId, blueprintInput)
    : await store.createSkill(blueprintInput);
  return {
    ok: true,
    recordId: blueprint.recordId,
    blueprint,
    planState: blueprintToPlanState(blueprint),
    warnings: [],
  };
}

function getLocalPlanBuilderOpenAIError() {
  return {
    ok: false,
    success: false,
    error: "OPENAI_NOT_CONFIGURED",
    message:
      "Set an OpenAI API key in Preferences, or set OPENAI_TOKEN or OPENAI_API_KEY, to use the local skill builder.",
  };
}

async function loadLocalPlanBuilderFunctions() {
  if (!process.env.OPENAI_TOKEN && process.env.OPENAI_API_KEY) {
    process.env.OPENAI_TOKEN = process.env.OPENAI_API_KEY;
  }
  const [functionsModule, serviceModule] = await Promise.all([
    import("@cloudagent/skills/builder-functions"),
    import("@cloudagent/skills/skill-service"),
  ]);
  return {
    generateOrUpdateSkeleton: functionsModule.generateOrUpdateSkeleton,
    updateTasksBatch: functionsModule.updateTasksBatch,
    updateTasksSerial: functionsModule.updateTasksSerial,
    updatePlanSettings: functionsModule.updatePlanSettings,
    generatePlanTitleAndDescriptionFromPlan:
      functionsModule.generatePlanTitleAndDescriptionFromPlan,
    DEFAULT_SKELETON_SETTINGS: serviceModule.DEFAULT_SKELETON_SETTINGS,
    normalizeBlueprintCloudProvider: serviceModule.normalizeBlueprintCloudProvider,
    normalizeTitle: serviceModule.normalizeTitle,
  };
}

function parsePlanBuilderMessage(message) {
  if (message && typeof message === "object" && !Array.isArray(message)) return message;
  if (typeof message !== "string") return { action: "chat", args: {} };
  const trimmed = message.trim();
  if (!trimmed) return { action: "chat", args: {} };
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {}
  return { action: "chat", args: { prompt: trimmed } };
}

function buildPlanBuilderStateFromPayload(payload = {}) {
  const planState = payload.planState || {};
  return {
    planId:
      payload.planId ||
      payload.recordId ||
      planState.planId ||
      planState.recordId ||
      `local-plan-${Date.now()}`,
    planTitle:
      payload.planTitle ||
      planState.planTitle ||
      planState.title ||
      "Untitled Skill",
    planDescription:
      payload.planDescription ||
      planState.planDescription ||
      planState.description ||
      "",
    cloudProvider:
      payload.cloudProvider ||
      planState.cloudProvider ||
      "aws",
    plan: normalizeBuilderPlanArray(planState.plan || planState.skeleton || payload.plan),
    requiredPermissions: planState.requiredPermissions || payload.requiredPermissions || {},
    planSettings: planState.planSettings || payload.planSettings || {},
    planOverview: planState.planOverview || null,
    planDefaultValues:
      planState.planDefaultValues ||
      planState.planSettings?.defaultValues ||
      null,
    skeletonSettings:
      planState.skeletonSettings ||
      payload.skeletonSettings ||
      planState.planSettings?.skeletonSettings ||
      null,
  };
}

function collectPlanTaskPointers(plan = []) {
  const pointers = [];
  if (!Array.isArray(plan)) return pointers;
  plan.forEach((phase, phaseIndex) => {
    if (!Array.isArray(phase?.tasks)) return;
    phase.tasks.forEach((_task, taskIndex) => {
      pointers.push({ phaseIndex, taskIndex });
    });
  });
  return pointers;
}

async function persistPlanBuilderDraft(store, payload, planState, status = "in_progress") {
  if (payload.persistDraft === false && !payload.recordId) {
    return {
      recordId: payload.recordId || planState.planId,
      planState,
      blueprint: null,
    };
  }
  return savePlanBuilderBlueprint(store, {
    ...payload,
    recordId: payload.recordId || planState.recordId || planState.planId,
    planState,
    status,
  });
}

async function runLocalPlanBuilderGenerate(store, payload = {}) {
  if (!isLocalOpenAIConfigured()) return getLocalPlanBuilderOpenAIError();

  const started = Date.now();
  const {
    generateOrUpdateSkeleton,
    updateTasksBatch,
    updatePlanSettings,
    generatePlanTitleAndDescriptionFromPlan,
    DEFAULT_SKELETON_SETTINGS,
    normalizeBlueprintCloudProvider,
    normalizeTitle,
  } = await loadLocalPlanBuilderFunctions();
  const initial = buildPlanBuilderStateFromPayload(payload);
  const cloudProvider = normalizeBlueprintCloudProvider(initial.cloudProvider);
  const skeletonSettings = {
    ...DEFAULT_SKELETON_SETTINGS,
    ...(initial.skeletonSettings || payload.skeletonSettings || {}),
    phases: {
      ...DEFAULT_SKELETON_SETTINGS.phases,
      ...(initial.skeletonSettings?.phases || payload.skeletonSettings?.phases || {}),
    },
  };
  const planDescription =
    initial.planDescription ||
    payload.planDescription ||
    (typeof payload.message === "string" ? payload.message : "") ||
    initial.planTitle;

  await persistPlanBuilderDraft(
    store,
    payload,
    {
      ...initial,
      cloudProvider,
      skeletonSettings,
      planDescription,
    },
    "in_progress"
  );

  const skeleton = await generateOrUpdateSkeleton({
    planId: initial.planId,
    planTitle: initial.planTitle,
    planDescription,
    existingPlan: initial.plan,
    skeletonSettings,
    cloudProvider,
  });
  const taskPointers = collectPlanTaskPointers(skeleton);
  const { plan: generatedPlan } = taskPointers.length
    ? await updateTasksBatch({
        plan: skeleton,
        tasks: taskPointers,
        notes: skeletonSettings.notes || payload.notes || "",
        skeletonSettings,
        cloudProvider,
      })
    : { plan: skeleton };
  const meta = await generatePlanTitleAndDescriptionFromPlan(
    generatedPlan,
    planDescription,
    cloudProvider
  ).catch(() => ({
    title: initial.planTitle,
    description: planDescription,
  }));
  const { overview, defaultValues, policy } = await updatePlanSettings({
    planId: initial.planId,
    planObj: { plan: generatedPlan },
    planDescription: meta.description || planDescription,
    cloudProvider,
  });
  const finalState = {
    ...initial,
    planId: initial.planId,
    planTitle: normalizeTitle(meta.title || initial.planTitle, meta.description || planDescription),
    planDescription: meta.description || planDescription,
    cloudProvider,
    plan: generatedPlan,
    skeleton: generatedPlan,
    planOverview: overview || null,
    planDefaultValues: defaultValues || null,
    requiredPermissions: policy || initial.requiredPermissions || null,
    planSettings: {
      ...(initial.planSettings || {}),
      ...(defaultValues ? { defaultValues } : {}),
      ...(overview ? { planOverview: overview } : {}),
      skeletonSettings,
    },
    skeletonSettings,
  };
  const saved = await savePlanBuilderBlueprint(store, {
    ...payload,
    recordId: payload.recordId || initial.planId,
    planState: finalState,
    status: "ready",
  });
  return {
    ok: true,
    success: true,
    sessionId: payload.sessionId || null,
    recordId: saved.recordId,
    planState: saved.planState,
    blueprint: saved.blueprint,
    durationMs: Date.now() - started,
  };
}

async function runLocalPlanBuilderAgentChat(store, payload = {}) {
  if (!isLocalOpenAIConfigured()) return getLocalPlanBuilderOpenAIError();

  const started = Date.now();
  const sessionId = String(payload.sessionId || "").trim();
  if (!sessionId) {
    return {
      ok: false,
      success: false,
      error: "sessionId required",
    };
  }

  const [
    { Agent, run, user, extractAllTextOutput, tool },
    { OpenAIResponsesModel, setDefaultOpenAIKey },
    { default: OpenAI },
  ] = await Promise.all([
    import("@openai/agents"),
    import("@openai/agents-openai"),
    import("openai"),
  ]);
  const {
    generateOrUpdateSkeleton,
    updateTasksBatch,
    updateTasksSerial,
    updatePlanSettings,
    generatePlanTitleAndDescriptionFromPlan,
    DEFAULT_SKELETON_SETTINGS,
    normalizeBlueprintCloudProvider,
    normalizeTitle,
  } = await loadLocalPlanBuilderFunctions();

  const apiKey = getLocalOpenAIKey();
  setDefaultOpenAIKey(apiKey);
  const modelName =
    process.env.OPENAI_LOCAL_MODEL ||
    process.env.OPENAI_MODEL ||
    globals.OPENAI_MODEL ||
    "gpt-5.4";
  const openai = new OpenAI({ apiKey });
  const model = new OpenAIResponsesModel(openai, modelName);

  const StructuredResponse = z.object({
    planState: z.unknown().nullable().optional(),
    commentary: z.string(),
  });
  const TaskPointer = z.object({
    phaseIndex: z.number().int().nonnegative(),
    taskIndex: z.number().int().nonnegative(),
    notes: z.string().nullable().optional(),
  });
  const SkeletonSettings = z.object({
    phases: z.object({
      assessment: z.boolean().nullable().optional(),
      summary: z.boolean().nullable().optional(),
      configuration: z.boolean().nullable().optional(),
      validation: z.boolean().nullable().optional(),
    }).nullable().optional(),
    notes: z.string().nullable().optional(),
    deploymentMethod: z.enum(["cli", "cloudformation"]).nullable().optional(),
    cloudFormationStackExists: z.boolean().nullable().optional(),
  }).nullable().optional();
  const CloudProvider = z.enum(["aws", "azure"]).nullable().optional();
  const PlanTask = z.object({
    id: z.string(),
    title: z.string().nullable().optional(),
    cloudProvider: z.enum(["aws", "azure"]).nullable().optional(),
    notes: z.array(z.string()).nullable().optional(),
    description: z.string().nullable().optional(),
    depends_on: z.array(z.string()).nullable().optional(),
    skip_conditions: z.string().nullable().optional(),
    completionCriteria: z.array(z.string()).nullable().optional(),
    maxTurns: z.number().int().min(1).max(MAX_PLAN_BUILDER_TASK_MAX_TURNS).nullable().optional(),
  }).strict();
  const PlanPhase = z.object({
    title: z.string(),
    tasks: z.array(PlanTask),
  }).strict();
  const PlanArray = z.array(PlanPhase);
  const PlanObj = z.object({ plan: PlanArray }).strict();

  const generateOrUpdateSkeletonTool = tool({
    name: "generate_or_update_skeleton",
    description: "Generate a new AWS or Azure plan skeleton or update an existing one using notes.",
    parameters: z.object({
      planId: z.string(),
      planTitle: z.string(),
      planDescription: z.string(),
      cloudProvider: CloudProvider,
      existingPlan: PlanArray.nullable().optional(),
      skeletonSettings: SkeletonSettings,
    }),
    async execute({ planId, planTitle, planDescription, cloudProvider = "aws", existingPlan = [], skeletonSettings }) {
      const normalizedCloudProvider = normalizeBlueprintCloudProvider(cloudProvider);
      const skeleton = await generateOrUpdateSkeleton({
        planId,
        planTitle,
        planDescription,
        cloudProvider: normalizedCloudProvider,
        existingPlan: existingPlan || [],
        skeletonSettings,
      });
      return {
        cloudProvider: normalizedCloudProvider,
        plan: ensureLocalPlanCloudProvider(skeleton, normalizedCloudProvider),
      };
    },
  });

  const updateTasksBatchTool = tool({
    name: "update_tasks_batch",
    description: "Update settings for one or more selected tasks in a single pass.",
    parameters: z.object({
      plan: PlanArray,
      tasks: z.array(TaskPointer).min(1),
      notes: z.string().nullable().optional(),
      cloudProvider: CloudProvider,
      skeletonSettings: SkeletonSettings,
    }),
    async execute({ plan, tasks, notes = "", cloudProvider = "aws", skeletonSettings }) {
      const normalizedCloudProvider = normalizeBlueprintCloudProvider(cloudProvider);
      const result = await updateTasksBatch({
        plan,
        tasks,
        notes,
        skeletonSettings,
        cloudProvider: normalizedCloudProvider,
      });
      return {
        cloudProvider: normalizedCloudProvider,
        plan: ensureLocalPlanCloudProvider(result.plan, normalizedCloudProvider),
      };
    },
  });

  const updateTasksSerialTool = tool({
    name: "update_tasks_all",
    description: "Sequentially update settings for all tasks in order.",
    parameters: z.object({
      plan: PlanArray,
      cloudProvider: CloudProvider,
      notes: z.string().nullable().optional(),
    }),
    async execute({ plan, cloudProvider = "aws", notes = "" }) {
      const normalizedCloudProvider = normalizeBlueprintCloudProvider(cloudProvider);
      const result = await updateTasksSerial({
        plan,
        notes,
        cloudProvider: normalizedCloudProvider,
      });
      return {
        cloudProvider: normalizedCloudProvider,
        plan: ensureLocalPlanCloudProvider(result.plan, normalizedCloudProvider),
      };
    },
  });

  const updatePlanSettingsTool = tool({
    name: "update_plan_settings",
    description: "Generate overview, default values, and permissions for the current plan.",
    parameters: z.object({
      planId: z.string().nullable().optional(),
      planObj: PlanObj,
      cloudProvider: CloudProvider,
      planDescription: z.string(),
    }),
    async execute({ planId, planObj, cloudProvider = "aws", planDescription }) {
      const normalizedCloudProvider = normalizeBlueprintCloudProvider(cloudProvider);
      return updatePlanSettings({
        planId,
        planObj: {
          ...planObj,
          plan: ensureLocalPlanCloudProvider(planObj?.plan || [], normalizedCloudProvider),
        },
        planDescription,
        cloudProvider: normalizedCloudProvider,
      });
    },
  });

  const agent = new Agent({
    name: "Local Plan Builder",
    instructions: `
You are a Plan Builder Agent. Help users quickly create and refine AWS or Azure plans using the available tools.

RESPONSE FORMAT:
- Always respond with a structured JSON object containing:
  - planState: The current full plan state object, or null if unchanged
  - commentary: Short explanation of what changed or next steps

TOOLS:
- generate_or_update_skeleton: Create or update the skeleton.
- update_tasks_all: Sequentially update task settings for all tasks.
- update_tasks_batch: Update selected tasks only.
- update_plan_settings: Generate overview, default values, and required permissions.

DEFAULT FLOW:
- Unless the user explicitly asks to update tasks now, only create or update the skeleton and stop for review.
- When the user asks to generate or update the whole blueprint/task details, use update_tasks_all.
- When the user asks to update selected tasks, use update_tasks_batch.
- When the user asks to finalize settings, defaults, or permissions, use update_plan_settings.

RULES:
- Preserve planState.cloudProvider and pass it into every tool call.
- Default to "aws" only when no provider is specified.
- Do not use a skeleton field in planState; store the current phases/tasks under planState.plan.
- Keep existing fields when not updated; do not alter task order or task ids unless the user asks.
- Ensure depends_on references only prior tasks.
- Keep commentary concise.

PLAN STATE UPDATES:
- After generate_or_update_skeleton, set planState.plan from the returned plan and preserve planId, planTitle, planDescription, and cloudProvider.
- After update_tasks_batch or update_tasks_all, set planState.plan from the returned plan and preserve planId, planTitle, planDescription, and cloudProvider.
- After update_plan_settings, set planOverview, planDefaultValues, and requiredPermissions without changing plan tasks.
    `,
    model,
    tools: [
      generateOrUpdateSkeletonTool,
      updateTasksBatchTool,
      updateTasksSerialTool,
      updatePlanSettingsTool,
    ],
    responseFormat: { type: "json_object" },
  });

  const recordId = payload.recordId || null;
  let serverPlanState = getOrInitLocalPlanBuilderState(sessionId);
  if (recordId) {
    const blueprint = await store.getSkill(recordId).catch(() => null);
    if (blueprint) {
      serverPlanState = {
        ...serverPlanState,
        ...blueprintToPlanState(blueprint),
      };
    }
  }

  const payloadState = buildPlanBuilderStateFromPayload(payload);
  let mergedState = {
    ...serverPlanState,
    ...payloadState,
    ...(payload.planState && typeof payload.planState === "object" ? payload.planState : {}),
  };
  const explicitPlanId =
    payload.planId ||
    payload.recordId ||
    payload.planState?.planId ||
    payload.planState?.recordId;
  if (!explicitPlanId && serverPlanState?.planId) {
    mergedState.planId = serverPlanState.planId;
  }
  if (!payload.planTitle && !payload.planState?.planTitle && serverPlanState?.planTitle) {
    mergedState.planTitle = serverPlanState.planTitle;
  }
  if (!payload.planDescription && !payload.planState?.planDescription && serverPlanState?.planDescription) {
    mergedState.planDescription = serverPlanState.planDescription;
  }
  mergedState.cloudProvider = normalizeBlueprintCloudProvider(mergedState.cloudProvider);
  mergedState.plan = ensureLocalPlanCloudProvider(
    normalizeBuilderPlanArray(mergedState.plan || mergedState.skeleton),
    mergedState.cloudProvider
  );
  delete mergedState.skeleton;
  setLocalPlanBuilderState(sessionId, mergedState);

  const currentPlanState = getOrInitLocalPlanBuilderState(sessionId);
  const normalizedMessage = normalizeLocalPlanBuilderMessageArgs(
    payload.message,
    currentPlanState,
    normalizeBlueprintCloudProvider
  );
  const historyKey = sessionId;
  const history = localPlanBuilderHistories.get(historyKey) || [];
  const contextMessage =
    `Current Plan State (if any):\n${JSON.stringify(currentPlanState, null, 2)}\n\n` +
    `User request: ${typeof normalizedMessage === "string" ? normalizedMessage : JSON.stringify(normalizedMessage)}`;
  history.push(user(contextMessage));

  const result = await run(agent, history, {
    maxTurns: 30,
    runConfig: { tracingDisabled: true },
    context: { ui: "local-api" },
  });
  const rawResponse = result.finalOutput ?? extractAllTextOutput(result.history) ?? "";
  localPlanBuilderHistories.set(historyKey, result.history);

  let structuredResponse;
  try {
    structuredResponse = StructuredResponse.parse(
      typeof rawResponse === "string" ? JSON.parse(rawResponse) : rawResponse
    );
  } catch {
    const jsonMatch = typeof rawResponse === "string"
      ? rawResponse.match(/```json\n([\s\S]*?)\n```/)
      : null;
    if (jsonMatch) {
      try {
        structuredResponse = StructuredResponse.parse(JSON.parse(jsonMatch[1]));
      } catch {
        structuredResponse = { planState: null, commentary: String(rawResponse || "") };
      }
    } else {
      structuredResponse = { planState: null, commentary: String(rawResponse || "") };
    }
  }

  let normalizedPlanState = currentPlanState;
  if (structuredResponse.planState && typeof structuredResponse.planState === "object") {
    normalizedPlanState = {
      ...currentPlanState,
      ...structuredResponse.planState,
    };
  }
  normalizedPlanState.cloudProvider = normalizeBlueprintCloudProvider(normalizedPlanState.cloudProvider);
  normalizedPlanState.plan = ensureLocalPlanCloudProvider(
    normalizeBuilderPlanArray(normalizedPlanState.plan || normalizedPlanState.skeleton),
    normalizedPlanState.cloudProvider
  );
  delete normalizedPlanState.skeleton;

  if (Array.isArray(normalizedPlanState.plan) && normalizedPlanState.plan.length > 0) {
    const meta = await generatePlanTitleAndDescriptionFromPlan(
      normalizedPlanState.plan,
      typeof payload.message === "string"
        ? payload.message
        : normalizedPlanState.planDescription || normalizedPlanState.planTitle || "",
      normalizedPlanState.cloudProvider
    ).catch(() => null);
    if (meta) {
      normalizedPlanState.planTitle = normalizeTitle(
        meta.title || normalizedPlanState.planTitle,
        meta.description || normalizedPlanState.planDescription
      );
      normalizedPlanState.planDescription =
        meta.description || normalizedPlanState.planDescription;
    }
  }
  setLocalPlanBuilderState(sessionId, normalizedPlanState);

  const hasPlan = Array.isArray(normalizedPlanState.plan) && normalizedPlanState.plan.length > 0;
  const hasSettingsAny = Boolean(normalizedPlanState.planOverview || normalizedPlanState.planDefaultValues);
  const hasSettingsAll = Boolean(normalizedPlanState.planOverview && normalizedPlanState.planDefaultValues);
  let status = "in_progress";
  if (hasPlan) status = "in_progress_skeleton";
  if (hasSettingsAny) status = "in_progress_settings";
  if (hasSettingsAll) status = "ready";

  const saved = await persistPlanBuilderDraft(
    store,
    payload,
    normalizedPlanState,
    status
  );
  const savedState = saved.planState || normalizedPlanState;
  if (savedState) {
    setLocalPlanBuilderState(sessionId, savedState);
  }

  return {
    ok: true,
    success: true,
    response: structuredResponse.commentary,
    message: structuredResponse.commentary,
    recordId: saved.recordId,
    planState: savedState,
    blueprint: saved.blueprint || null,
    sessionId,
    warnings: [],
    durationMs: Date.now() - started,
  };
}

async function runLocalPlanBuilderChatAction(store, payload = {}) {
  if (!isLocalOpenAIConfigured()) return getLocalPlanBuilderOpenAIError();

  if (payload.useDirectLocalPlanBuilder !== true) {
    return runLocalPlanBuilderAgentChat(store, payload);
  }

  const started = Date.now();
  const message = parsePlanBuilderMessage(payload.message);
  const args = message.args || {};
  const {
    generateOrUpdateSkeleton,
    updateTasksBatch,
    updatePlanSettings,
    DEFAULT_SKELETON_SETTINGS,
    normalizeBlueprintCloudProvider,
  } = await loadLocalPlanBuilderFunctions();
  const current = buildPlanBuilderStateFromPayload(payload);
  const action = message.action || "chat";
  let nextState = { ...current };
  let response = "Updated the local skill draft.";
  let status = "in_progress";

  if (action === "generate_or_update_skeleton" || action === "chat") {
    const cloudProvider = normalizeBlueprintCloudProvider(args.cloudProvider || current.cloudProvider);
    const planDescription =
      args.planDescription ||
      current.planDescription ||
      args.prompt ||
      (typeof payload.message === "string" ? payload.message : "") ||
      current.planTitle;
    const skeletonSettings = {
      ...DEFAULT_SKELETON_SETTINGS,
      ...(current.skeletonSettings || {}),
      ...(args.skeletonSettings || {}),
      phases: {
        ...DEFAULT_SKELETON_SETTINGS.phases,
        ...(current.skeletonSettings?.phases || {}),
        ...(args.skeletonSettings?.phases || {}),
      },
    };
    const skeleton = await generateOrUpdateSkeleton({
      planId: args.planId || current.planId,
      planTitle: args.planTitle || current.planTitle,
      planDescription,
      existingPlan: normalizeBuilderPlanArray(args.existingPlan || current.plan),
      skeletonSettings,
      cloudProvider,
    });
    nextState = {
      ...current,
      planId: args.planId || current.planId,
      planTitle: args.planTitle || current.planTitle,
      planDescription,
      cloudProvider,
      plan: skeleton,
      skeleton,
      skeletonSettings,
    };
    response = "Generated an updated local skill skeleton.";
    status = "in_progress_skeleton";
  } else if (action === "update_tasks_batch") {
    const cloudProvider = normalizeBlueprintCloudProvider(args.cloudProvider || current.cloudProvider);
    const { plan } = await updateTasksBatch({
      plan: normalizeBuilderPlanArray(args.plan || current.plan),
      tasks: Array.isArray(args.tasks) ? args.tasks : collectPlanTaskPointers(current.plan),
      notes: args.notes || "",
      skeletonSettings: current.skeletonSettings || args.skeletonSettings || null,
      cloudProvider,
    });
    nextState = {
      ...current,
      cloudProvider,
      plan,
      skeleton: plan,
    };
    response = "Updated local skill task details.";
    status = "in_progress_tasks";
  } else if (action === "update_plan_settings") {
    const cloudProvider = normalizeBlueprintCloudProvider(args.cloudProvider || current.cloudProvider);
    const plan = normalizeBuilderPlanArray(args.planObj?.plan || args.plan || current.plan);
    const { overview, defaultValues, policy } = await updatePlanSettings({
      planId: args.planId || current.planId,
      planObj: { plan },
      planDescription: args.planDescription || current.planDescription,
      cloudProvider,
    });
    nextState = {
      ...current,
      cloudProvider,
      plan,
      skeleton: plan,
      planOverview: overview || null,
      planDefaultValues: defaultValues || null,
      requiredPermissions: policy || current.requiredPermissions || null,
      planSettings: {
        ...(current.planSettings || {}),
        ...(defaultValues ? { defaultValues } : {}),
        ...(overview ? { planOverview: overview } : {}),
        ...(current.skeletonSettings ? { skeletonSettings: current.skeletonSettings } : {}),
      },
    };
    response = "Generated local skill settings.";
    status = "ready";
  } else {
    response = `Unsupported local plan builder action: ${action}`;
  }

  const saved = await persistPlanBuilderDraft(store, payload, nextState, status);
  return {
    ok: true,
    success: true,
    response,
    message: response,
    recordId: saved.recordId,
    planState: saved.planState || nextState,
    sessionId: payload.sessionId || null,
    warnings: [],
    durationMs: Date.now() - started,
  };
}

const localAgentRunEventSubscribers = new Map();

function sendAgentChunk(res, payload) {
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

function getAgentEventRecordId(event, fallbackRecordId = null) {
  return (
    event?.runId ||
    event?.recordId ||
    event?.payload?.recordId ||
    fallbackRecordId ||
    null
  );
}

function publishAgentRunEvent(recordId, event) {
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

async function persistAgentRunEvent({ store, event, recordId = null } = {}) {
  if (!store || !event) return null;
  const runId = getAgentEventRecordId(event, recordId);
  if (!runId) return null;
  const storedEvent = await store.appendAgentRunEvent(runId, event);
  publishAgentRunEvent(runId, storedEvent);
  return storedEvent;
}

function createAgentRunEventRecorder({ store, recordId = null } = {}) {
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

function attachAgentRunEventRecorder(res, { store, recordId = null } = {}) {
  if (!res?.locals) return null;
  const recorder = createAgentRunEventRecorder({ store, recordId });
  res.locals.agentRunEventRecorder = recorder;
  return recorder;
}

function sendAgentEventChunk(res, event) {
  if (!event) return;
  res?.locals?.agentRunEventRecorder?.(event);
  sendAgentChunk(res, { type: "agent_event", event });
}

function getLocalAgentRunId({ recordId = null, sessionId = null, req = null } = {}) {
  return (
    recordId ||
    req?.body?.recordId ||
    req?.body?.agentRunId ||
    req?.body?.sessionId ||
    sessionId ||
    null
  );
}

function getLocalTaskId(task = null, fallback = null) {
  return task?.id || task?.task_id || fallback || null;
}

function sendAgentMessageEvent(res, {
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

function sendAgentTaskStatusEvent(res, {
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

function sendAgentRunStatus(res, {
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

function sendNormalizedAgentRawEvents(res, chunk, {
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

function recordNormalizedAgentRawEvents(recordEvent, chunk, {
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

function recordAgentMessageEvent(recordEvent, {
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

function recordAgentTaskStatusEvent(recordEvent, {
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

function recordAgentRunStatusEvent(recordEvent, {
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

function recordAgentTerminalOutputEvent(recordEvent, {
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

function sendAgentTerminalOutputEvent(res, {
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

function summarizeLocalAgentRequest(body = {}) {
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

function buildAgentRuntimeDebug({
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

function sendAgentRuntimeDebug(res, debug) {
  console.log("[local /agent] runtime debug", debug);
  if (res) sendAgentChunk(res, debug);
}

function extractLocalPlanForSummary({ blueprint, planPayload }) {
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

function findLocalPlanTask({ blueprint, planPayload, taskId }) {
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

function compactLocalJson(value, maxLength = 12_000) {
  const text = JSON.stringify(value ?? null, null, 2);
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n...[truncated]` : text;
}

const CODEX_HISTORY_EVENT_LIMIT = 500;
const CODEX_HISTORY_STRING_LIMIT = 30_000;
const CODEX_HISTORY_ARRAY_LIMIT = 120;

function compactCodexHistoryValue(value, depth = 0) {
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

function compactCodexHistoryEvents(events = []) {
  if (!Array.isArray(events) || events.length === 0) return [];
  return events
    .slice(-CODEX_HISTORY_EVENT_LIMIT)
    .map((event) => compactCodexHistoryValue(event));
}

function localAuthSummary(authProfile = {}) {
  return {
    provider: authProfile.provider || "aws",
    authType: authProfile.authType || null,
    permissionProfileId: authProfile.permissionProfileId || authProfile.recordId || authProfile.id || null,
    accountId: authProfile.awsAccountId || authProfile.accountId || null,
    awsProfile: authProfile.awsProfile || authProfile.profileName || authProfile.profile || null,
    region: authProfile.region || authProfile.defaultRegion || null,
  };
}

function normalizeBlueprintExecutionMode(...values) {
  for (const value of values) {
    const normalized = normalizeCodingAgentRunner(value);
    if (["codex", "claude", "cursor"].includes(normalized)) return normalized;
    const text = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (["cloudagent", "cloud_agent", "default"].includes(text)) return "cloudagent";
  }
  return "cloudagent";
}

function isLocalCodingAgentExecutionMode(value) {
  return ["codex", "claude", "cursor"].includes(value);
}

function inferStoredCodingAgentRunner(record = {}, storedLog = {}) {
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

function getLocalCodingAgentSettings(codexSettings = {}, executionMode = "codex") {
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

function getBlueprintExecutionMode(blueprint, planPayload = null, requestBody = {}) {
  return normalizeBlueprintExecutionMode(
    requestBody?.executionMode,
    requestBody?.runner,
    planPayload?.executionMode,
    planPayload?.runner,
    blueprint?.executionMode,
    blueprint?.runner
  );
}

function appendQueryParams(url, params = {}) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    Object.entries(params).forEach(([key, value]) => {
      if (value != null && value !== "") parsed.searchParams.set(key, String(value));
    });
    return parsed.toString();
  } catch {
    const entries = Object.entries(params).filter(([, value]) => value != null && value !== "");
    if (!entries.length) return url;
    const query = entries
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join("&");
    return `${url}${url.includes("?") ? "&" : "?"}${query}`;
  }
}

function firstLocalNonEmpty(...values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const nested = firstLocalNonEmpty(...value);
      if (nested != null && nested !== "") return nested;
      continue;
    }
    if (value == null) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
      continue;
    }
    if (value !== "") return value;
  }
  return null;
}

function buildLocalMcpUrl(
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
  const contextParams = {
    cloudagentRunId: recordId,
    cloudagentRunner: runner,
    cloudagentPermissionProfileId: selectedPermissionProfileId || null,
    cloudagentAccountId: selectedAccountId || null,
    cloudagentRegion: selectedRegion,
  };
  if (configured) return appendQueryParams(configured, contextParams);
  const host = req?.get?.("host");
  if (!host) return null;
  return appendQueryParams(`${req.protocol || "http"}://${host}/mcp`, contextParams);
}

function buildExternalAgentMcpStreamEvent(event = {}, fallbackRunner = "codex") {
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

function subscribeToLocalMcpRunEvents({ req, recordId, runner = "codex", onEvent, onMcpEvent }) {
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

async function buildCodexLocalDataSnapshot(store, { authProfile = {}, selectedWorkloadOrStack = null } = {}) {
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

function extractAwsCliOutputsFromContextEvents(contextEvents = []) {
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

function buildLocalBlueprintSessionContext({ authProfile = {}, regions = [], selectedWorkloadOrStack = null } = {}) {
  const permissionProfileId =
    authProfile.permissionProfileId || authProfile.recordId || authProfile.id || null;
  const accountId = authProfile.awsAccountId || authProfile.accountId || null;
  const workloadContext =
    selectedWorkloadOrStack && typeof selectedWorkloadOrStack === "object"
      ? selectedWorkloadOrStack
      : selectedWorkloadOrStack
        ? { id: selectedWorkloadOrStack }
        : null;
  return {
    environments: [
      {
        id: permissionProfileId || accountId || "selected-local-environment",
        permissionProfileId,
        accountId,
        name: authProfile.name || authProfile.authProfileName || "Selected local AWS environment",
        cloudProvider: authProfile.provider || "aws",
      },
    ],
    workloads: workloadContext ? [workloadContext] : [],
    notes: [
      "This is a local desktop skill run.",
      regions.length ? `Selected AWS regions: ${regions.join(", ")}` : null,
    ].filter(Boolean).join(" "),
  };
}

function buildLocalTaskPrompt({
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
    "- Return concise Markdown with Findings, Evidence, and Result.",
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

function buildLocalPreflightPrompt({ title, blueprintId, blueprint, planPayload, authProfile, regions = [] }) {
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

function buildRunSummaryObject({ title, status, output }) {
  return {
    summary: `Local CloudAgent finished "${title}" with status ${status}.`,
    finalSummary: output || `Local CloudAgent finished "${title}" with status ${status}.`,
    generatedAt: new Date().toISOString(),
    status,
  };
}

async function buildExternalAgentRunSummary({ title, runnerLabel, runner, status, output, events = [] } = {}) {
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

function buildLocalFinalRunSummary({ title, phases = [], logs = [], finalTaskSummary = "", completedAt = new Date().toISOString() }) {
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

function uniqueLocalStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : [values]).map((value) => String(value || "").trim()).filter(Boolean))];
}

function localDebugSlug(value, fallback = "blueprint") {
  return (
    String(value || fallback)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || fallback
  );
}

function localDebugTimestamp(value = new Date()) {
  return value.toISOString().replace(/[:.]/g, "-");
}

async function writeLocalUpdatedBlueprintDebugFile({
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

function normalizeLocalBackgroundRunSettings(inputSettings = {}) {
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

function buildLocalBackgroundPreflightAnswer() {
  return {
    questionId: "analysis_review",
    selectedOptionId: "continue",
    value: "continue",
    source: "local_background_auto_confirm",
  };
}

function buildLocalBackgroundPreflightLog({
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

function buildLocalPlanUrl(base, key) {
  return `${String(base || "").replace(/\/+$/, "")}/${String(key || "").replace(/^\/+/, "")}`;
}

function stripBlueprintRunnerFields(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { executionMode: _executionMode, runner: _runner, ...rest } = value;
  return rest;
}

function normalizeLocalLibraryBlueprintRecord(raw = {}, blueprintId = null) {
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

async function resolveLocalBackgroundBlueprint(store, blueprintId) {
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

function buildLocalSummaryText({
  scope,
  target,
  relatedProfiles = [],
  relatedWorkloads = [],
  analysisContext = {},
}) {
  const title = scope === "account"
    ? `# Executive Summary: ${target.name || target.recordId}`
    : `# Executive Summary: ${target.workloadName || target.workloadId}`;
  const updatedAt = new Date().toISOString();
  const availability = analysisContext.availability || executiveSummaryAvailability(analysisContext);
  const availabilityText = (kind) => availability[kind] ? "available" : "not available yet";

  const targetLines = scope === "account"
    ? [
        `Environment: ${profileSummaryLine(target)}`,
        `Related workloads: ${relatedWorkloads.length || 0}`,
        ...relatedWorkloads.slice(0, 10).map((workload) => `- ${workloadSummaryLine(workload)}`),
      ]
    : [
        `Workload: ${workloadSummaryLine(target)}`,
        `Linked environments: ${relatedProfiles.length || 0}`,
        ...relatedProfiles.slice(0, 10).map((profile) => `- ${profileSummaryLine(profile)}`),
      ];
  const scannerReadoutLines = [
    `Inventory data: ${availabilityText("inventory")}`,
    `Health data: ${availabilityText("health")}`,
    `Cost data: ${availabilityText("cost")}`,
  ];

  return [
    title,
    "",
    `Generated: ${updatedAt}`,
    "",
    "## Scope",
    ...targetLines,
    "",
    "## Local Mode Data Coverage",
    "This summary was generated from local workload and permission profile metadata plus the latest local scanner artifacts available for inventory, health, and cost.",
    ...scannerReadoutLines.map((line) => `- ${line}`),
    "",
    "## Operational Readout",
    scope === "account"
      ? `The environment is onboarded locally as ${target.type || "a cloud environment"}. Use inventory to understand discovered services and resources, health to identify operational risk, and cost data to prioritize spend attention.`
      : `The workload is defined locally with ${Array.isArray(target.environments) ? target.environments.length : 0} linked environment(s). Keep tracked resources current so inventory, health, and cost scanners can produce stronger application-level analysis.`,
    "",
    "## Recommended Next Steps",
    "- Confirm the environment metadata and authentication profile details are complete.",
    "- Attach workloads to the correct environments.",
    "- Add tracked resources or stack references where they are known.",
    "- Run inventory, health, and cost discovery when scanner data is missing or stale.",
  ].join("\n");
}

async function generateLocalExecutiveSummary({ store, body }) {
  const updatedAt = new Date().toISOString();
  const profiles = await store.listPermissionProfiles();
  const workloads = await store.listWorkloads();

  if (body.scope === "account") {
    const profile = await store.getPermissionProfile(body.recordId);
    if (!profile) return { status: 404, payload: { ok: false, error: "Permission profile not found" } };

    const relatedWorkloads = workloads.filter((workload) =>
      Array.isArray(workload?.environments) && workload.environments.includes(profile.recordId)
    );
    const analysisContext = await buildExecutiveSummaryAnalysisContext({
      store,
      scope: "account",
      target: profile,
    });
    const summaryText = buildLocalSummaryText({
      scope: "account",
      target: profile,
      relatedWorkloads,
      analysisContext,
    });
    const llmSummaryText = await generateLocalExecutiveSummaryWithOpenAI({
      scope: "account",
      target: profile,
      relatedWorkloads,
      analysisContext,
      fallbackSummaryText: summaryText,
    }).catch((error) => {
      console.warn("[local executive summary] OpenAI generation failed", error?.message || error);
      return null;
    });
    const sources = {
      runtime: "local",
      model: llmSummaryText ? "openai" : "heuristic",
      permissionProfile: profile.recordId,
      workloads: relatedWorkloads.map((workload) => workload.workloadId),
      dataSources: analysisContext.availability,
      unavailable: missingExecutiveSummarySources(analysisContext),
    };
    const finalSummaryText = llmSummaryText || summaryText;
    const summary = { summaryText: finalSummaryText, updatedAt, sources, reportSummaries: [] };
    await store.persistEnvironmentSummary(profile.recordId, summary);
    return {
      status: 200,
      payload: {
        ok: true,
        scope: "account",
        id: profile.recordId,
        updatedAt,
        summaryText: finalSummaryText,
        reportSummaries: [],
        sources,
      },
    };
  }

  const workload = await store.getWorkload(body.workloadId);
  if (!workload) return { status: 404, payload: { ok: false, error: "Workload not found" } };

  const envIds = new Set(Array.isArray(workload.environments) ? workload.environments : []);
  const relatedProfiles = profiles.filter((profile) => envIds.has(profile.recordId));
  const analysisContext = await buildExecutiveSummaryAnalysisContext({
    store,
    scope: "workload",
    target: workload,
    relatedProfiles,
  });
  const summaryText = buildLocalSummaryText({
    scope: "workload",
    target: workload,
    relatedProfiles,
    analysisContext,
  });
  const llmSummaryText = await generateLocalExecutiveSummaryWithOpenAI({
    scope: "workload",
    target: workload,
    relatedProfiles,
    analysisContext,
    fallbackSummaryText: summaryText,
  }).catch((error) => {
    console.warn("[local executive summary] OpenAI generation failed", error?.message || error);
    return null;
  });
  const sources = {
    runtime: "local",
    model: llmSummaryText ? "openai" : "heuristic",
    workload: workload.workloadId,
    permissionProfiles: relatedProfiles.map((profile) => profile.recordId),
    dataSources: analysisContext.availability,
    unavailable: missingExecutiveSummarySources(analysisContext),
  };
  const finalSummaryText = llmSummaryText || summaryText;
  const summary = { summaryText: finalSummaryText, updatedAt, sources, reportSummaries: [] };
  await store.persistWorkloadSummary(workload.workloadId, summary);
  return {
    status: 200,
    payload: {
      ok: true,
      scope: "workload",
      id: workload.workloadId,
      updatedAt,
      summaryText: finalSummaryText,
      reportSummaries: [],
      sources,
    },
  };
}

export async function createLocalStore(options = {}) {
  return new LocalJsonFileStore({ dataDir: options.localDataDir }).init();
}

export function createLocalRouter({ store }) {
  if (!store) throw new Error("createLocalRouter requires a store");

  const router = Router();
  router.use(localAuth);

  router.get("/bootstrap", async (_req, res, next) => {
    try {
      const [settings, profiles, workloads, workFlowDefs, workflowHistory, agentHistory] = await Promise.all([
        store.getSettings(),
        store.listPermissionProfiles(),
        store.listWorkloads(),
        store.listWorkflowDefinitions(),
        store.listWorkflowRuns(),
        store.listAgentHistory(),
      ]);
      res.json({
        userId: LOCAL_AUTH.userId,
        email: settings?.email || "local@cloudagent",
        name: settings?.name || "Local User",
        settings: settings?.settings || "{}",
        agentPermissionProfiles: profiles,
        workloads,
        workFlowDefs,
        workflowHistory,
        agentHistory,
        reportHistory: [],
        recommendations: {
          recommendations: [],
          exceptions: [],
          history: [],
          loadingRecommendations: false,
          loadingExceptions: false,
          loadingHistory: false,
        },
        agentCredits: {
          adhocCredits: 0,
          monthlyBaseCredits: Number.MAX_SAFE_INTEGER,
        },
        subscription: {
          tier: "local",
          status: "local",
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/settings", async (req, res, next) => {
    const body = parseBody(PermissionProfilePatchSchema, req, res);
    if (!body) return;
    try {
      const nextSettingsValue =
        body.settings !== undefined && typeof body.settings !== "string"
          ? JSON.stringify(body.settings || {})
          : body.settings;
      const settings = await store.updateSettings({
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.settings !== undefined ? { settings: nextSettingsValue } : {}),
      });
      res.json({ ok: true, userId: LOCAL_AUTH.userId, settings: settings.settings });
    } catch (error) {
      next(error);
    }
  });

  router.get("/codex/settings", async (_req, res, next) => {
    try {
      const settings = await getLocalCodexSettings(store);
      await fs.mkdir(settings.workspaceDir, { recursive: true });
      await fs.mkdir(settings.claude.workspaceDir, { recursive: true });
      await fs.mkdir(settings.cursor.workspaceDir, { recursive: true });
      res.json({ ok: true, settings: publicLocalCodexSettings(settings) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/codex/settings", async (req, res, next) => {
    const body = parseBody(PermissionProfilePatchSchema, req, res);
    if (!body) return;
    try {
      const settings = await updateLocalCodexSettings(store, {
        enabled: body.enabled,
        binary: body.binary,
        workspaceDir: body.workspaceDir,
        claude: body.claude,
        cursor: body.cursor,
      });
      res.json({ ok: true, settings: publicLocalCodexSettings(settings) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/openai/settings", async (_req, res, next) => {
    try {
      res.json({ ok: true, settings: publicLocalOpenAISettings() });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/openai/settings", async (req, res, next) => {
    const body = parseBody(PermissionProfilePatchSchema, req, res);
    if (!body) return;
    try {
      const patch = {
        ...(Object.prototype.hasOwnProperty.call(body, "apiKey") ? { apiKey: body.apiKey } : {}),
        ...(Object.prototype.hasOwnProperty.call(body, "model") ? { model: body.model } : {}),
        ...(Object.prototype.hasOwnProperty.call(body, "clearApiKey")
          ? { clearApiKey: body.clearApiKey }
          : {}),
      };
      const settings = await updateLocalOpenAISettings(store, patch);
      res.json({ ok: true, settings });
    } catch (error) {
      next(error);
    }
  });

  router.get("/preferences/status", async (req, res, next) => {
    try {
      res.json(await buildLocalPreferencesStatus({ store, app: req.app }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/codex/skills/:recordId/skill", async (req, res, next) => {
    try {
      const result = await ensureCodexSkillForBlueprint(store, req.params.recordId);
      if (!result) return res.status(404).json({ ok: false, error: "Skill not found" });
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  });

  router.put("/codex/skills/:recordId/skill/files", async (req, res, next) => {
    const body = parseBody(PermissionProfilePatchSchema, req, res);
    if (!body) return;
    try {
      const result = await ensureCodexSkillForBlueprint(store, req.params.recordId);
      if (!result) return res.status(404).json({ ok: false, error: "Skill not found" });
      const { fullPath, relativePath } = resolveSkillFilePath(result.skillDir, body.relativePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, String(body.content ?? ""));
      const files = await listEditableSkillFiles(result.skillDir);
      res.json({ ok: true, skillDir: result.skillDir, relativePath, files });
    } catch (error) {
      next(error);
    }
  });

  router.get("/aws/profiles", async (_req, res, next) => {
    try {
      const profiles = await listLocalAwsProfiles();
      res.json({ ok: true, profiles });
    } catch (error) {
      next(error);
    }
  });

  router.get("/permission-profiles", async (_req, res, next) => {
    try {
      const profiles = await store.listPermissionProfiles();
      res.json({ ok: true, agentPermissionProfiles: profiles, permissionProfiles: profiles, items: profiles });
    } catch (error) {
      next(error);
    }
  });

  router.post("/permission-profiles", async (req, res, next) => {
    const body = parseBody(PermissionProfileCreateSchema, req, res);
    if (!body) return;
    try {
      const profile = await store.createPermissionProfile(body);
      res.status(201).json({ ok: true, profile, item: profile });
    } catch (error) {
      next(error);
    }
  });

  router.post("/permission-profiles/validate-credentials", async (_req, res, next) => {
    try {
      const profiles = await validateStoredPermissionProfiles({ store });
      const invalidProfiles = profiles.filter((profile) => {
        const status = profile?.credentialStatus || null;
        return status?.lastCheckedValid === false || status?.ok === false;
      });
      res.json({
        ok: true,
        agentPermissionProfiles: profiles,
        permissionProfiles: profiles,
        items: profiles,
        invalidCount: invalidProfiles.length,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/permission-profiles/:recordId/validate-credentials", async (req, res, next) => {
    try {
      const profile = await store.getPermissionProfile(req.params.recordId);
      if (!profile) return res.status(404).json({ ok: false, error: "Permission profile not found" });
      const [updatedProfile] = await validateStoredPermissionProfiles({ store, recordId: req.params.recordId });
      res.json({
        ok: true,
        profile: updatedProfile,
        item: updatedProfile,
        credentialStatus: updatedProfile?.credentialStatus || null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/permission-profiles/:recordId", async (req, res, next) => {
    const body = parseBody(PermissionProfilePatchSchema, req, res);
    if (!body) return;
    try {
      const profile = await store.updatePermissionProfile(req.params.recordId, body);
      if (!profile) return res.status(404).json({ ok: false, error: "Permission profile not found" });
      res.json({ ok: true, profile, item: profile });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/permission-profiles/:recordId", async (req, res, next) => {
    try {
      const deleted = await store.deletePermissionProfile(req.params.recordId);
      res.status(deleted ? 200 : 404).json({
        ok: deleted,
        deleted,
        recordId: req.params.recordId,
        ...(deleted ? {} : { error: "Permission profile not found" }),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/workloads", async (_req, res, next) => {
    try {
      const workloads = await store.listWorkloads();
      res.json({ ok: true, workloads, items: workloads });
    } catch (error) {
      next(error);
    }
  });

  router.post("/workloads", async (req, res, next) => {
    const body = parseBody(WorkloadCreateSchema, req, res);
    if (!body) return;
    try {
      const workload = await store.createWorkload(body);
      res.status(201).json({ ok: true, workload, item: workload });
    } catch (error) {
      next(error);
    }
  });

  router.get("/workloads/:workloadId", async (req, res, next) => {
    try {
      const workload = await store.getWorkload(req.params.workloadId);
      if (!workload) return res.status(404).json({ ok: false, error: "Workload not found" });
      res.json({ ok: true, workload, item: workload });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/workloads/:workloadId", async (req, res, next) => {
    const body = parseBody(WorkloadPatchSchema, req, res);
    if (!body) return;
    try {
      const workload = await store.updateWorkload(req.params.workloadId, body);
      if (!workload) return res.status(404).json({ ok: false, error: "Workload not found" });
      res.json({ ok: true, workload, item: workload });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/workloads/:workloadId", async (req, res, next) => {
    try {
      const deleted = await store.deleteWorkload(req.params.workloadId);
      res.status(deleted ? 200 : 404).json({
        ok: deleted,
        deleted,
        workloadId: req.params.workloadId,
        ...(deleted ? {} : { error: "Workload not found" }),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/workflows", async (req, res, next) => {
    try {
      const items = sortLocalItems(
        await store.listWorkflowDefinitions(),
        req.query.sortBy || "updatedAt",
        req.query.sortOrder || "desc"
      );
      const page = paginateLocalItems(items, req.query);
      res.json({ ok: true, workflows: page.items, ...page });
    } catch (error) {
      next(error);
    }
  });

  router.post("/workflows", async (req, res, next) => {
    const body = parseBody(WorkflowCreateSchema, req, res);
    if (!body) return;
    try {
      const workflow = await store.createWorkflowDefinition(body);
      res.status(201).json({ ok: true, workflow, item: workflow });
    } catch (error) {
      next(error);
    }
  });

  router.get("/workflows/:workflowId", async (req, res, next) => {
    try {
      const workflow = await store.getWorkflowDefinition(req.params.workflowId);
      if (!workflow) return res.status(404).json({ ok: false, error: "Workflow not found" });
      res.json({ ok: true, workflow, item: workflow });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/workflows/:workflowId", async (req, res, next) => {
    const body = parseBody(WorkflowPatchSchema, req, res);
    if (!body) return;
    try {
      const workflow = await store.updateWorkflowDefinition(req.params.workflowId, body);
      if (!workflow) return res.status(404).json({ ok: false, error: "Workflow not found" });
      res.json({ ok: true, workflow, item: workflow });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/workflows/:workflowId", async (req, res, next) => {
    try {
      const deleted = await store.deleteWorkflowDefinition(req.params.workflowId);
      res.status(deleted ? 200 : 404).json({
        ok: deleted,
        deleted,
        workflowId: req.params.workflowId,
        ...(deleted ? {} : { error: "Workflow not found" }),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/scheduler/workflows", async (_req, res, next) => {
    try {
      const states = await store.listWorkflowScheduleStates();
      res.json({ ok: true, items: states, schedulerStates: states });
    } catch (error) {
      next(error);
    }
  });

  router.get("/scheduler/workflows/:workflowId", async (req, res, next) => {
    try {
      const state = await store.getWorkflowScheduleState(req.params.workflowId);
      if (!state) return res.status(404).json({ ok: false, error: "Workflow schedule state not found" });
      res.json({ ok: true, state, item: state });
    } catch (error) {
      next(error);
    }
  });

  router.post("/scheduler/workflows/:workflowId/recalculate", async (req, res, next) => {
    try {
      const workflow = await store.getWorkflowDefinition(req.params.workflowId);
      if (!workflow) return res.status(404).json({ ok: false, error: "Workflow not found" });
      const schedule = parseStoredJsonValue(workflow.schedule, workflow.schedule || {});
      const nextRunAt = getNextScheduledRunAt(schedule, req.body?.after ? new Date(req.body.after) : new Date());
      const state = await store.updateWorkflowScheduleState(req.params.workflowId, {
        enabled: true,
        nextRunAt,
      });
      res.json({ ok: true, nextRunAt, state });
    } catch (error) {
      next(error);
    }
  });

  router.get("/workflow-runs", async (req, res, next) => {
    try {
      const page = await listWorkflowRunsForQuery(store, req.query);
      res.json({ ok: true, workflowRuns: page.items, ...page });
    } catch (error) {
      next(error);
    }
  });

  router.post("/workflow-runs", async (req, res, next) => {
    const body = parseBody(WorkflowCreateSchema, req, res);
    if (!body) return;
    try {
      const run = await store.createWorkflowRun(body);
      res.status(201).json({ ok: true, workflowRun: run, item: run });
    } catch (error) {
      next(error);
    }
  });

  router.get("/workflow-runs/:workflowRunId", async (req, res, next) => {
    try {
      const run = await store.getWorkflowRun(req.params.workflowRunId);
      if (!run) return res.status(404).json({ ok: false, error: "Workflow run not found" });
      res.json({ ok: true, workflowRunId: req.params.workflowRunId, workflowRun: run, item: run });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/workflow-runs/:workflowRunId", async (req, res, next) => {
    const body = parseBody(WorkflowPatchSchema, req, res);
    if (!body) return;
    try {
      const run = await store.updateWorkflowRun(req.params.workflowRunId, body);
      if (!run) return res.status(404).json({ ok: false, error: "Workflow run not found" });
      res.json({ ok: true, workflowRun: run, item: run });
    } catch (error) {
      next(error);
    }
  });

  router.post("/workflow-runs/:workflowRunId/cancel", async (req, res, next) => {
    try {
      const existing = await store.getWorkflowRun(req.params.workflowRunId);
      if (!existing) return res.status(404).json({ ok: false, error: "Workflow run not found" });
      const definition = parseStoredJsonValue(existing.workflowDefinition, {});
      const cancelledDefinition = createWorkflowRunSummary(definition, "cancelled");
      const run = await store.updateWorkflowRun(req.params.workflowRunId, {
        workflowStatus: "cancelled",
        workflowDefinition: cancelledDefinition,
        currentExecutions: [],
        statusMessage: req.body?.message || "Workflow cancelled in local mode.",
      });
      res.json({ ok: true, workflowRunId: run.workflowRunId, workflowStatus: run.workflowStatus, workflowRun: run, item: run, message: "Workflow cancelled." });
    } catch (error) {
      next(error);
    }
  });

  router.get("/skills", async (req, res, next) => {
    try {
      const items = sortLocalItems(
        await store.listSkills(),
        req.query.sortBy || "updatedAt",
        req.query.sortOrder || "desc"
      );
      const page = paginateLocalItems(items, req.query);
      res.json({
        ok: true,
        skills: page.items,
        blueprints: page.items,
        items: page.items,
        count: page.count,
        nextToken: page.nextToken,
        nextCursor: page.nextCursor,
        summary: {
          total: items.length,
          custom: items.length,
          library: 0,
          agents: items.length,
          reports: 0,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/skills", async (req, res, next) => {
    const body = parseBody(BlueprintCreateSchema, req, res);
    if (!body) return;
    try {
      const skill = await store.createSkill(body);
      res.status(201).json({ ok: true, skill, blueprint: skill, item: skill });
    } catch (error) {
      next(error);
    }
  });

  router.get("/skills/:recordId", async (req, res, next) => {
    try {
      const skill = await store.getSkill(req.params.recordId);
      if (!skill) return res.status(404).json({ ok: false, error: "Skill not found" });
      res.json({ ok: true, skill, blueprint: skill, item: skill });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/skills/:recordId", async (req, res, next) => {
    const body = parseBody(BlueprintPatchSchema, req, res);
    if (!body) return;
    try {
      const skill = await store.updateSkill(req.params.recordId, body);
      if (!skill) return res.status(404).json({ ok: false, error: "Skill not found" });
      res.json({ ok: true, skill, blueprint: skill, item: skill });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/skills/:recordId", async (req, res, next) => {
    try {
      const deleted = await store.deleteSkill(req.params.recordId);
      res.status(deleted ? 200 : 404).json({
        ok: deleted,
        deleted,
        recordId: req.params.recordId,
        ...(deleted ? {} : { error: "Skill not found" }),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/agent-history", async (req, res, next) => {
    try {
      const page = await listAgentHistoryForQuery(store, req.query);
      res.json({ ok: true, agentHistory: page.items, ...page });
    } catch (error) {
      next(error);
    }
  });

  router.get("/agent-history/:recordId", async (req, res, next) => {
    try {
      const run = await store.getAgentHistoryRecord(req.params.recordId);
      if (!run) return res.status(404).json({ ok: false, error: "Agent run not found" });
      res.json({ ok: true, recordId: req.params.recordId, agentRun: run, record: run, item: run });
    } catch (error) {
      next(error);
    }
  });

  router.get("/agent-runs", async (req, res, next) => {
    try {
      const page = await listAgentHistoryForQuery(store, req.query);
      res.json({ ok: true, agentRuns: page.items, ...page });
    } catch (error) {
      next(error);
    }
  });

  router.post("/agent-runs", async (req, res, next) => {
    const body = parseBody(AgentHistoryCreateSchema, req, res);
    if (!body) return;
    try {
      const run = await store.createAgentHistoryRecord(body);
      res.status(201).json({ ok: true, agentRun: run, record: run, item: run });
    } catch (error) {
      next(error);
    }
  });

  router.get("/agent-runs/:recordId", async (req, res, next) => {
    try {
      const run = await store.getAgentHistoryRecord(req.params.recordId);
      if (!run) return res.status(404).json({ ok: false, error: "Agent run not found" });
      res.json({ ok: true, recordId: req.params.recordId, agentRun: run, record: run, item: run });
    } catch (error) {
      next(error);
    }
  });

  router.get("/agent-runs/:recordId/events", async (req, res, next) => {
    try {
      const recordId = req.params.recordId;
      const run = await store.getAgentHistoryRecord(recordId);
      if (!run) return res.status(404).json({ ok: false, error: "Agent run not found" });
      const page = await store.listAgentRunEvents(recordId, {
        afterSeq: req.query?.afterSeq ?? req.query?.after ?? 0,
        limit: req.query?.limit ?? 1000,
      });
      res.json({ ok: true, ...page });
    } catch (error) {
      next(error);
    }
  });

  router.get("/agent-runs/:recordId/events/stream", async (req, res, next) => {
    const recordId = req.params.recordId;
    try {
      const run = await store.getAgentHistoryRecord(recordId);
      if (!run) return res.status(404).json({ ok: false, error: "Agent run not found" });

      res.status(200);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();
      sendAgentChunk(res, { type: "message_start", recordId, replay: true });

      const page = await store.listAgentRunEvents(recordId, {
        afterSeq: req.query?.afterSeq ?? req.query?.after ?? 0,
        limit: req.query?.limit ?? 5000,
      });
      for (const event of page.events) {
        sendAgentChunk(res, { type: "agent_event", event });
      }

      const latestRun = await store.getAgentHistoryRecord(recordId).catch(() => run);
      const terminalStatus = ["complete", "completed", "success", "failed", "cancelled", "canceled"].includes(
        String(latestRun?.status || run.status || "").toLowerCase()
      );
      if (terminalStatus) {
        sendAgentChunk(res, { type: "completed", recordId, replay: true });
        return res.end();
      }

      const subscriber = (event) => {
        const wrote = sendAgentChunk(res, { type: "agent_event", event });
        if (!wrote) {
          const subscribers = localAgentRunEventSubscribers.get(recordId);
          subscribers?.delete(subscriber);
          if (subscribers?.size === 0) localAgentRunEventSubscribers.delete(recordId);
        }
      };
      const subscribers = localAgentRunEventSubscribers.get(recordId) || new Set();
      subscribers.add(subscriber);
      localAgentRunEventSubscribers.set(recordId, subscribers);

      const heartbeat = setInterval(() => {
        sendAgentChunk(res, { type: "heartbeat", recordId });
      }, 15000);

      req.on("close", () => {
        clearInterval(heartbeat);
        subscribers.delete(subscriber);
        if (subscribers.size === 0) localAgentRunEventSubscribers.delete(recordId);
      });
    } catch (error) {
      if (res.headersSent) {
        sendAgentChunk(res, {
          type: "error",
          error_code: error?.status || "AGENT_RUN_EVENTS_STREAM_FAILED",
          message: error?.message || "Failed to stream agent run events.",
        });
        return res.end();
      }
      next(error);
    }
  });

  router.patch("/agent-runs/:recordId", async (req, res, next) => {
    const body = parseBody(AgentHistoryPatchSchema, req, res);
    if (!body) return;
    try {
      const run = await store.updateAgentHistoryRecord(req.params.recordId, body);
      if (!run) return res.status(404).json({ ok: false, error: "Agent run not found" });
      res.json({ ok: true, agentRun: run, record: run, item: run });
    } catch (error) {
      next(error);
    }
  });

  router.post("/codex/agent-runs/:recordId/resume", async (req, res, next) => {
    try {
      const prompt = String(req.body?.prompt || req.body?.message || "").trim();
      if (!prompt) {
        return res.status(400).json({ ok: false, error: "Prompt is required" });
      }
      const existing = await store.getAgentHistoryRecord(req.params.recordId);
      if (!existing) return res.status(404).json({ ok: false, error: "Agent run not found" });
      const existingLog = parseStoredJsonValue(existing?.log, {}) || {};
      const existingPreflight =
        existingLog?.preflight && typeof existingLog.preflight === "object"
          ? existingLog.preflight
          : null;
      const runner = inferStoredCodingAgentRunner(existing, existingLog);
      const runnerLabel = codingAgentRunnerLabel(runner);

      res.status(200);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.flushHeaders?.();
      attachAgentRunEventRecorder(res, { store, recordId: req.params.recordId });
      sendAgentChunk(res, { type: "message_start", recordId: req.params.recordId });
      sendAgentTaskStatusEvent(res, {
        recordId: req.params.recordId,
        runner,
        taskId: EXTERNAL_AGENT_RUN_TASK_ID,
        status: "in-progress",
        output: `Resuming ${runnerLabel} session with your reply.`,
      });

      await store.updateAgentHistoryRecord(req.params.recordId, {
        status: "running",
        executionMode: runner,
        runner,
      });

      const forwardExternalAgentEvent = (event) => {
        sendNormalizedAgentRawEvents(res, { event }, {
          recordId: req.params.recordId,
          runner,
          task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
          phaseIndex: 0,
          taskIndex: 0,
        });
      };
      const mcpForwarder = subscribeToLocalMcpRunEvents({
        req,
        recordId: req.params.recordId,
        runner,
        onEvent: forwardExternalAgentEvent,
        onMcpEvent: (event) => {
          sendNormalizedAgentRawEvents(res, { event }, {
            recordId: req.params.recordId,
            runner,
            task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
            phaseIndex: 0,
            taskIndex: 0,
          });
        },
      });
      let result;
      try {
        result = await resumeLocalExternalAgentRun({
          store,
          recordId: req.params.recordId,
          runner,
          prompt,
          mcpUrl: buildLocalMcpUrl(req, {
            recordId: req.params.recordId,
            runner,
            authProfile: parseStoredObject(existing.authProfile, existing.authProfile || {}),
            executionContext: existingPreflight?.executionContext || null,
            preflightResult: existingPreflight,
          }),
          onCodexEvent: forwardExternalAgentEvent,
          onCodexStderr: (content) => {
            sendNormalizedAgentRawEvents(res, { type: "codex_stderr", content }, {
              recordId: req.params.recordId,
              runner,
              task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
              phaseIndex: 0,
              taskIndex: 0,
            });
          },
        });
      } finally {
        mcpForwarder.cleanup();
      }

      sendAgentTaskStatusEvent(res, {
        recordId: result.recordId || req.params.recordId,
        runner,
        taskId: EXTERNAL_AGENT_RUN_TASK_ID,
        status: result.status,
        output: result.logEntry?.task_output || result.summary,
        runSummary: result.runSummary,
      });
      sendAgentRunStatus(res, {
        recordId: result.recordId || req.params.recordId,
        runner,
        completed: true,
        status: result.recordStatus || result.status,
        summary: result.summary,
        runSummary: result.runSummary,
      });
      sendAgentChunk(res, {
        type: "message_end",
        recordId: result.recordId,
        status: result.recordStatus || result.status,
      });
      sendAgentChunk(res, { type: "completed" });
      return res.end();
    } catch (error) {
      if (res.headersSent) {
        sendAgentChunk(res, {
          type: "error",
          error_code: error?.status || "EXTERNAL_AGENT_RESUME_FAILED",
          message: error?.message || "Failed to resume external agent session.",
        });
        sendAgentChunk(res, { type: "completed" });
        return res.end();
      }
      next(error);
    }
  });

  router.get("/blueprint-runs", async (req, res, next) => {
    try {
      const blueprintId = req.query.blueprintId ? String(req.query.blueprintId) : null;
      const page = await listAgentHistoryForQuery(store, {
        ...req.query,
        agentType: req.query.agentType || "agent",
      });
      const items = blueprintId
        ? page.items.filter((item) => item?.itemId === blueprintId)
        : page.items;
      res.json({
        ok: true,
        blueprintRuns: items,
        items,
        count: items.length,
        nextToken: page.nextToken,
        nextCursor: page.nextCursor,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/agent-runs/:recordId/cancel", async (req, res, next) => {
    try {
      const existing = await store.getAgentHistoryRecord(req.params.recordId);
      if (!existing) return res.status(404).json({ ok: false, error: "Agent run not found" });
      const run = await store.updateAgentHistoryRecord(req.params.recordId, {
        status: "cancelled",
        log: req.body?.log || createAgentRunLog({
          title: existing.title,
          status: "cancelled",
          blueprintId: existing.itemId,
          summary: "This local agent run was cancelled.",
        }),
      });
      res.json({ ok: true, recordId: run.recordId, agentRun: run, record: run, item: run, message: "Agent run cancelled." });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function createLocalExecutiveSummaryRouter({ store }) {
  if (!store) throw new Error("createLocalExecutiveSummaryRouter requires a store");

  const router = Router();
  router.use(localAuth);

  router.post("/executive-summary", async (req, res, next) => {
    const body = parseBody(ExecutiveSummaryBodySchema, req, res);
    if (!body) return;
    try {
      const result = await generateLocalExecutiveSummary({ store, body });
      res.status(result.status).json(result.payload);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function buildLocalCommandCenterSuggestions({ profiles = [], workloads = [] } = {}) {
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

async function buildLocalCommandCenterState({ store, chatId }) {
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
    activeScope: {
      environmentIds: profiles.map((profile) => profile.recordId).filter(Boolean),
      workloadIds: workloads.map((workload) => workload.workloadId).filter(Boolean),
      reportIds: [],
    },
  };
}

function sendSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data ?? null)}\n\n`);
}

function unwrapAgentStreamEvent(ev) {
  return ev?.data?.event ?? ev?.data ?? null;
}

async function runLocalCloudAgentChat({
  store,
  message,
  sessionContext,
  selectedAuthProfile = null,
  onToken,
  onContextEvent,
}) {
  if (!isLocalOpenAIConfigured()) return null;

  const [
    { user },
    { runCloudAgentStream },
    { createLocalCloudAgentTools },
  ] = await Promise.all([
    import("@openai/agents"),
    import("@cloudagent/cloudagent/core"),
    import("../cloudagent/local-cloudagent-tools.mjs"),
  ]);

  const { tools } = createLocalCloudAgentTools({ store, selectedAuthProfile });
  const contextEvents = [];
  const toolExecutionsByKey = new Map();
  const { stream } = await runCloudAgentStream({
    userId: LOCAL_AUTH.userId,
    history: [user(String(message || ""))],
    mode: "local",
    sessionContext,
    toolsOverride: tools,
    onContextEvent: (payload) => {
      if (!payload) return;
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

function buildTaskChatSeed(task = {}, execution = {}, timestamp = new Date().toISOString()) {
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

function appendWorkflowTaskChatEntry(executions = [], {
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

async function runLocalCloudAgentBlueprintTask({
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

  const { accountsService, workloadsService } = createLocalCloudAgentTools({
    store,
    selectedAuthProfile: authProfile,
  });
  const taskExecutionContext = await resolveSkillExecutionContext({
    userId: LOCAL_AUTH.userId,
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
  const sessionContext = buildLocalBlueprintSessionContext({
    authProfile,
    regions,
    selectedWorkloadOrStack: taskExecutionContext?.workload?.selected
      ? {
          id: taskExecutionContext.workload.id,
          name: taskExecutionContext.workload.name,
          foundIn: taskExecutionContext.workload.foundIn,
          trackedResources: taskExecutionContext.workload.trackedResources,
        }
      : effectiveSelectedWorkloadOrStack,
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
    sessionContext,
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

async function runLocalExternalAgentBlueprintTask({
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

  const { accountsService, workloadsService } = createLocalCloudAgentTools({
    store,
    selectedAuthProfile: authProfile,
  });
  const taskExecutionContext = await resolveSkillExecutionContext({
    userId: LOCAL_AUTH.userId,
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

async function runLocalExternalAgentBlueprintSession({
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
    const { accountsService, workloadsService } = createLocalCloudAgentTools({
      store,
      selectedAuthProfile: authProfile,
    });
    executionContext = await resolveSkillExecutionContext({
      userId: LOCAL_AUTH.userId,
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

async function resumeLocalExternalAgentRun({
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

async function runLocalBlueprintPreflight({
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
  const { accountsService, workloadsService } = createLocalCloudAgentTools({
    store,
    selectedAuthProfile: authProfile,
  });
  const permissionProfileId =
    authProfile?.permissionProfileId || authProfile?.recordId || authProfile?.id || null;
  const accountId = authProfile?.awsAccountId || authProfile?.accountId || null;
  const blueprintForAnalysis = planPayload || (blueprint ? parseStoredJsonValue(blueprint.plan, {}) : {});
  const preflightResult = await runSkillPreflight({
    userId: LOCAL_AUTH.userId,
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

export function createLocalCommandCenterRouter({ store }) {
  if (!store) throw new Error("createLocalCommandCenterRouter requires a store");

  const router = Router();
  router.use(localAuth);

  router.get("/v1/command-center/bootstrap", async (req, res, next) => {
    try {
      res.json(await buildLocalCommandCenterState({ store, chatId: req.query.chatId }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/v1/command-center/bootstrap", async (req, res, next) => {
    try {
      res.json(await buildLocalCommandCenterState({ store, chatId: req.body?.chatId }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/v1/command-center/state", async (req, res, next) => {
    try {
      res.json(await buildLocalCommandCenterState({ store, chatId: req.query.chatId }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/v1/command-center/scope", async (req, res, next) => {
    try {
      const state = await buildLocalCommandCenterState({ store, chatId: req.body?.chatId });
      res.json({
        ...state,
        scopeSync: {
          activeScope: req.body?.scope || state.activeScope,
          limits: state.limits,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/v1/command-center/intent", async (req, res, next) => {
    try {
      const state = await buildLocalCommandCenterState({ store, chatId: req.body?.chatId });
      res.json({
        ...state,
        assistantMessage: {
          id: `local-intent-${Date.now()}`,
          text: "This action opens the relevant local dashboard area. Advanced CloudAgent tool execution is not available in local mode yet.",
          blocks: [],
          tools: [],
          toolExecutions: [],
          contextEvents: [],
        },
        responseId: null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/v1/chat/send", async (req, res, next) => {
    try {
      const state = await buildLocalCommandCenterState({ store, chatId: req.body?.chatId });
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.flushHeaders?.();

      let agentResult = null;
      if (isLocalOpenAIConfigured()) {
        agentResult = await runLocalCloudAgentChat({
          store,
          message: req.body?.message || "",
          sessionContext: req.body?.sessionContext || req.body?.activeScope || null,
          onToken: (token) => sendSse(res, "token", { token }),
          onContextEvent: (payload) => sendSse(res, "context_update", payload),
        }).catch((error) => {
          console.warn("[local CloudAgent] tool-backed chat failed", error?.message || error);
          return null;
        });
      }

      let text = agentResult?.text || "";
      if (!text) {
        state.store = store;
        const llmText = await generateLocalChatReply({
          message: req.body?.message || "",
          state,
          sessionContext: req.body?.sessionContext || req.body?.activeScope || null,
        }).catch((error) => {
          console.warn("[local chat] OpenAI generation failed", error?.message || error);
          return null;
        });
        delete state.store;
        text = llmText || [
          "Local CloudAgent is running against files on this machine.",
          `I can see ${state.limits.environments.count} environment(s) and ${state.limits.workloads.count} workload(s).`,
          isLocalOpenAIConfigured()
            ? "OpenAI is configured, but the model call failed. Check the backend terminal for details."
            : "Set an OpenAI API key in Preferences, or set OPENAI_TOKEN or OPENAI_API_KEY, to enable model-backed local chat.",
        ].join(" ");
        sendSse(res, "token", { token: text });
      }

      sendSse(res, "final", {
        assistantMessage: {
          id: `local-message-${Date.now()}`,
          text,
          blocks: [],
          tools: [],
          toolExecutions: agentResult?.toolExecutions || [],
          contextEvents: agentResult?.contextEvents || [],
        },
        responseId: agentResult?.responseId || (isLocalOpenAIConfigured() ? `local-openai-${Date.now()}` : null),
        ...state,
      });
      sendSse(res, "done", { ok: true });
      res.end();
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/chat", async (req, res) => {
    const state = await buildLocalCommandCenterState({ store, chatId: req.body?.sessionId });
    const agentResult = isLocalOpenAIConfigured()
      ? await runLocalCloudAgentChat({
          store,
          message: req.body?.message || "",
          sessionContext: req.body?.sessionContext || null,
        }).catch((error) => {
          console.warn("[local /api/chat] tool-backed chat failed", error?.message || error);
          return null;
        })
      : null;
    let llmText = agentResult?.text || "";
    if (!llmText) {
      state.store = store;
      llmText = await generateLocalChatReply({
        message: req.body?.message || "",
        state,
        sessionContext: req.body?.sessionContext || null,
      }).catch((error) => {
        console.warn("[local /api/chat] OpenAI generation failed", error?.message || error);
        return null;
      });
      delete state.store;
    }
    res.json({
      message:
        llmText ||
        `Local CloudAgent is available. ${state.limits.environments.count} environment(s), ${state.limits.workloads.count} workload(s). Set an OpenAI API key in Preferences, or set OPENAI_TOKEN or OPENAI_API_KEY, to enable model-backed local chat.`,
      responseId: agentResult?.responseId || (llmText ? `local-openai-${Date.now()}` : null),
    });
  });

  router.post("/validateAwsCredentialsV2", async (req, res) => {
    try {
      const result = await validateLocalAwsCredentials({
        authProfile: req.body?.authProfile || req.body || {},
        region: req.body?.region || req.body?.defaultRegion,
      });
      res.json(result);
    } catch (error) {
      res.status(400).json({
        ok: false,
        code: "ERROR",
        message: error?.message || "Failed to validate AWS credentials.",
      });
    }
  });

  router.post("/validate-creds", async (req, res) => {
    try {
      const result = await validateLocalAwsCredentials({
        authProfile: req.body?.authProfile || req.body || {},
        region: req.body?.region || req.body?.defaultRegion,
      });
      res.json(result);
    } catch (error) {
      res.status(400).json({
        ok: false,
        code: "ERROR",
        message: error?.message || "Failed to validate AWS credentials.",
      });
    }
  });

  router.post("/workflowManager", async (req, res, next) => {
    try {
      const eventType = req.body?.eventType || "workflowStart";
      const workflowRunId = req.body?.workflowRunId;
      console.log("[local workflow] request", {
        eventType,
        workflowRunId: workflowRunId || null,
        workflowId: req.body?.workflowId || req.body?.workflowDefinition?.workflowId || null,
        title: req.body?.title || req.body?.workflowDefinition?.title || null,
        hasWorkflowDefinition: Boolean(req.body?.workflowDefinition),
      });

      if (eventType === "workflowStart") {
        const rawDefinition = req.body?.workflowDefinition || {};
        const workflowDefinition =
          typeof rawDefinition === "string"
            ? parseStoredJsonValue(rawDefinition, {})
            : rawDefinition;
        const result = await createLocalWorkflowRun({
          store,
          workflowRunPreferences:
            req.body?.workflowRunPreferences ||
            workflowDefinition.workflowRunPreferences ||
            workflowDefinition.runPreferences ||
            {},
          mcpUrl: buildLocalMcpUrl(req),
          workflowDefinition: {
            workflowId: workflowDefinition.workflowId || req.body?.workflowId || null,
            title: workflowDefinition.title || req.body?.title || "Untitled Workflow",
            ...workflowDefinition,
          },
        });
        const job = startLocalWorkflowJob({
          store,
          workflowRunId: result.workflowRunId,
          mcpUrl: buildLocalMcpUrl(req),
        });
        console.log("[local workflow] workflowStart accepted", {
          workflowRunId: result.workflowRunId || null,
          workflowStatus: result.workflowStatus || null,
          backgroundJobStartedAt: job.startedAt,
          alreadyRunning: job.alreadyRunning === true,
          message: result.message || null,
        });
        return res.status(202).json({
          ...result,
          ok: true,
          background: true,
          message: result.message || "Workflow run started in local mode.",
        });
      }

      if (!workflowRunId) {
        console.warn("[local workflow] missing workflowRunId", { eventType });
        return res.status(400).json({ ok: false, error: "workflowRunId is required" });
      }

      const existing = await store.getWorkflowRun(workflowRunId);
      if (!existing) {
        console.warn("[local workflow] workflow run not found", {
          eventType,
          workflowRunId,
        });
        return res.status(404).json({ ok: false, error: "Workflow run not found" });
      }

      if (eventType === "workflowCancel") {
        const definition = parseStoredJsonValue(existing.workflowDefinition, {});
        const run = await store.updateWorkflowRun(workflowRunId, {
          workflowStatus: "cancelled",
          workflowDefinition: createWorkflowRunSummary(definition, "cancelled"),
          currentExecutions: [],
          statusMessage: "Workflow cancelled in local mode.",
        });
        console.log("[local workflow] workflowCancel completed", {
          workflowRunId,
          workflowStatus: run.workflowStatus,
        });
        return res.json({
          ok: true,
          workflowRunId: run.workflowRunId,
          workflowStatus: run.workflowStatus,
          workflowRun: run,
          message: "Workflow cancelled.",
        });
      }

      if (eventType === "taskFollowUp") {
        const followUpMessage = String(req.body?.followUpMessage || "").trim();
        if (!followUpMessage) {
          return res.status(400).json({ ok: false, error: "followUpMessage is required" });
        }
        const branchId = req.body?.branchId || null;
        const taskId = req.body?.taskId || null;
        const lastResponseId = req.body?.lastResponseId || null;
        const timestamp = new Date().toISOString();
        const sessionContext = {
          workflowRuns: [{
            workflowRunId,
            workflowId: existing.workflowId || null,
            title: existing.title || existing.workflowName || null,
            status: existing.workflowStatus || null,
          }],
        };
        const prompt = [
          `A user sent a follow-up message for local workflow run "${workflowRunId}".`,
          branchId ? `Target branch/node id: ${branchId}.` : null,
          taskId ? `Target task id: ${taskId}.` : null,
          lastResponseId ? `Previous response id: ${lastResponseId}.` : null,
          "Use get_workflow_run if you need workflow execution details. Answer the user's follow-up for this workflow task.",
          "If the user is trying to resume execution, explain what can be handled locally and whether a manual rerun is needed.",
          "",
          `User follow-up: ${followUpMessage}`,
        ].filter(Boolean).join("\n");
        const agentResult = isLocalOpenAIConfigured()
          ? await runLocalCloudAgentChat({
              store,
              message: prompt,
              sessionContext,
            }).catch((error) => {
              console.warn("[local workflow] follow-up chat failed", {
                workflowRunId,
                branchId,
                taskId,
                error: error?.message || String(error),
              });
              return null;
            })
          : null;
        const assistantText = agentResult?.text || [
          `Local follow-up recorded for workflow run ${workflowRunId}.`,
          isLocalOpenAIConfigured()
            ? "The model call failed; check the backend terminal for details."
            : "Set an OpenAI API key in Preferences, or set OPENAI_TOKEN or OPENAI_API_KEY, to enable model-backed local workflow chat.",
        ].join(" ");
        const executionHistory = parseStoredJsonValue(existing.executionHistory, []);
        const currentExecutions = parseStoredJsonValue(existing.currentExecutions, []);
        const historyUpdate = appendWorkflowTaskChatEntry(executionHistory, {
          branchId,
          taskId,
          followUpMessage,
          assistantText,
          responseId: agentResult?.responseId || null,
          timestamp,
        });
        const currentUpdate = appendWorkflowTaskChatEntry(currentExecutions, {
          branchId,
          taskId,
          followUpMessage,
          assistantText,
          responseId: agentResult?.responseId || null,
          timestamp,
        });
        const run = await store.updateWorkflowRun(workflowRunId, {
          executionHistory: historyUpdate.updated,
          currentExecutions: currentUpdate.updated,
          lastMessage: followUpMessage,
          statusMessage: currentUpdate.matched || historyUpdate.matched
            ? "Local workflow follow-up answered."
            : "Local workflow follow-up answered, but the target task was not found in stored execution history.",
        });
        console.log("[local workflow] follow-up answered", {
          workflowRunId,
          branchId,
          taskId,
          matchedExecutionHistory: historyUpdate.matched,
          matchedCurrentExecutions: currentUpdate.matched,
          responseId: agentResult?.responseId || null,
        });
        return res.json({
          ok: true,
          workflowRunId: run.workflowRunId,
          workflowStatus: run.workflowStatus,
          workflowRun: run,
          responseId: agentResult?.responseId || null,
          message: run.statusMessage,
        });
      }

      const run = await store.updateWorkflowRun(workflowRunId, {
        statusMessage:
          eventType === "workflowReconcile"
            ? "Local workflow reconciliation recorded."
            : eventType === "taskRetry"
              ? "Local task retry recorded."
              : `Local workflow event recorded: ${eventType}`,
      });
      console.log("[local workflow] event recorded", {
        eventType,
        workflowRunId,
        workflowStatus: run.workflowStatus,
        statusMessage: run.statusMessage,
      });
      return res.json({
        ok: true,
        workflowRunId: run.workflowRunId,
        workflowStatus: run.workflowStatus,
        workflowRun: run,
        requeuedTaskCount: 0,
        message: run.statusMessage,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/runAgentBackground", async (req, res, next) => {
    try {
      console.log("[local /runAgentBackground] request", summarizeLocalAgentRequest({
        ...(req.body || {}),
        authProfile: req.body?.inputSettings?.authProfile || req.body?.authProfile || null,
      }));
      const eventType = req.body?.eventType || "runAgent";

      if (eventType === "taskFollowUp") {
        const recordId = req.body?.followUp?.recordId || req.body?.agentRunId;
        if (!recordId) return res.status(400).json({ ok: false, error: "recordId is required" });
        const existing = await store.getAgentHistoryRecord(recordId);
        if (!existing) return res.status(404).json({ ok: false, error: "Agent run not found" });
        const message = String(req.body?.followUp?.followUpMessage || req.body?.followUpMessage || "").trim();
        if (!message) return res.status(400).json({ ok: false, error: "followUpMessage is required" });
        const existingLog = parseStoredJsonValue(existing.log, {}) || {};
        const logs = Array.isArray(existingLog.logs) ? existingLog.logs : [];
        const prompt = [
          `A user sent a follow-up message for local agent run "${recordId}".`,
          "Use get_agent_run if you need the run details. Answer the user's follow-up based on the local agent run state.",
          "If local execution cannot resume automatically, say that clearly and suggest the next local action.",
          "",
          `User follow-up: ${message}`,
        ].join("\n");
        const agentResult = isLocalOpenAIConfigured()
          ? await runLocalCloudAgentChat({
              store,
              message: prompt,
              sessionContext: null,
            }).catch((error) => {
              console.warn("[local /runAgentBackground] follow-up chat failed", {
                recordId,
                error: error?.message || String(error),
              });
              return null;
            })
          : null;
        const assistantText = agentResult?.text || [
          `Local follow-up recorded for agent run ${recordId}.`,
          isLocalOpenAIConfigured()
            ? "The model call failed; check the backend terminal for details."
            : "Set an OpenAI API key in Preferences, or set OPENAI_TOKEN or OPENAI_API_KEY, to enable model-backed local agent follow-up chat.",
        ].join(" ");
        const run = await store.updateAgentHistoryRecord(recordId, {
          log: {
            ...existingLog,
            logs: [
              ...logs,
              {
                taskId: "local_follow_up",
                status: "complete",
                input: message,
                output: assistantText,
                task_output: assistantText,
                responseId: agentResult?.responseId || null,
                timestamp: new Date().toISOString(),
              },
            ],
          },
        });
        return res.json({
          ok: true,
          recordId: run.recordId,
          record: run,
          agentRun: run,
          responseId: agentResult?.responseId || null,
          message: "Local agent follow-up answered.",
        });
      }

      const planId = req.body?.planId || req.body?.blueprintId || req.body?.recordId || "local-agent";
      const inputSettings = req.body?.inputSettings || {};
      const runSettings = normalizeLocalBackgroundRunSettings(inputSettings);
      const authProfile = runSettings.authProfile && Object.keys(runSettings.authProfile).length
        ? runSettings.authProfile
        : parseStoredObject(req.body?.authProfile, {});
      const selectedPermissionProfile = await findPermissionProfileForAuthProfile(store, authProfile);
      const credentialBlocker = getLocalCredentialRunBlocker(selectedPermissionProfile, authProfile);
      if (credentialBlocker) {
        console.warn("[local /runAgentBackground] blocked by credential status", {
          planId,
          permissionProfileId:
            selectedPermissionProfile?.recordId ||
            authProfile?.permissionProfileId ||
            authProfile?.recordId ||
            authProfile?.id ||
            null,
          code: credentialBlocker.code,
          status: credentialBlocker.status,
        });
        return res.status(412).json({
          ok: false,
          error: credentialBlocker.message,
          code: credentialBlocker.code,
          credentialStatus: credentialBlocker.credentialStatus,
        });
      }
      const blueprint = await resolveLocalBackgroundBlueprint(store, planId);
      if (!blueprint && !req.body?.plan) {
        return res.status(404).json({
          ok: false,
          error: "Skill not found",
          planId,
        });
      }
      const title = blueprint?.title || req.body?.title || planId;
      const requestedExecutionMode = getBlueprintExecutionMode(blueprint, req.body?.plan || null, req.body || {});
      const skipBlueprintRewrite = isLocalCodingAgentExecutionMode(requestedExecutionMode);
      const requestedRunnerLabel = codingAgentRunnerLabel(requestedExecutionMode);
      const startedAt = new Date().toISOString();
      let preflightRecord = await store.createAgentHistoryRecord({
        itemId: planId,
        agentType: "agent",
        status: "running",
        title,
        parentId: req.body?.parentId || null,
        authProfile,
        executionMode: requestedExecutionMode,
        runner: requestedExecutionMode,
        settings: {
          ...inputSettings,
          executionMode: requestedExecutionMode,
          runner: requestedExecutionMode,
          localBackgroundPreflight: {
            status: "starting",
            autoConfirmed: true,
          },
        },
        log: {
          logs: [],
          currentPhase: 0,
          currentTask: 0,
          lastUpdated: startedAt,
          blueprintId: planId,
          isBluePrint: true,
          executionMode: requestedExecutionMode,
          runner: requestedExecutionMode,
          runSummary: {
            summary: `Preparing local ${requestedRunnerLabel} run for "${title}".`,
            finalSummary: `Preparing local ${requestedRunnerLabel} run for "${title}".`,
            generatedAt: startedAt,
            status: "running",
          },
        },
      });
      console.log("[local /runAgentBackground] preflight starting", {
        planId,
        title,
        recordId: preflightRecord.recordId,
        hasBlueprint: Boolean(blueprint),
        hasPlanPayload: Boolean(req.body?.plan),
        openAIConfigured: isLocalOpenAIConfigured(),
        requestedExecutionMode,
        skipBlueprintRewrite,
        configurationMode: runSettings.configurationMode,
        selectedWorkloadOrStack: runSettings.selectedWorkloadOrStack,
        regionCount: runSettings.regions.length,
      });
      let preflightResult;
      try {
        preflightResult = await runLocalBlueprintPreflight({
          store,
          blueprintId: planId,
          blueprint,
          planPayload: req.body?.plan || null,
          title,
          authProfile,
          regions: runSettings.regions,
          defaultValues: runSettings.defaultValues,
          executionPreferences: runSettings.executionPreferences,
          selectedWorkloadOrStack: runSettings.selectedWorkloadOrStack,
          configurationMode: runSettings.configurationMode,
          stackAction: runSettings.stackAction,
          existingStack: runSettings.existingStack,
          existingStacks: runSettings.existingStacks,
          additionalInstructions: runSettings.additionalInstructions,
          preflightAnswer: buildLocalBackgroundPreflightAnswer(),
          skipBlueprintRewrite,
          onPrepEvent: (type, payload = {}) => {
            console.log("[local /runAgentBackground] preflight event", {
              type,
              phase: payload.phase || null,
              message: payload.message || null,
            });
          },
        });
      } catch (error) {
        const failedAt = new Date().toISOString();
        const errorMessage = error?.message || String(error);
        await store.updateAgentHistoryRecord(preflightRecord.recordId, {
          status: "failed",
          executionMode: requestedExecutionMode,
          runner: requestedExecutionMode,
          log: {
            logs: [
              {
                taskId: "local_background_preflight",
                phaseIndex: 0,
                taskIndex: 0,
                status: "failed",
                output: errorMessage,
                task_output: errorMessage,
                cli_command_output: [],
                timestamp: failedAt,
              },
            ],
            currentPhase: 0,
            currentTask: 0,
            lastUpdated: failedAt,
            blueprintId: planId,
            isBluePrint: true,
            executionMode: requestedExecutionMode,
            runner: requestedExecutionMode,
            runSummary: {
              summary: `Local ${requestedRunnerLabel} preflight failed for "${title}".`,
              finalSummary: `Local ${requestedRunnerLabel} preflight failed for "${title}".`,
              generatedAt: failedAt,
              status: "failed",
            },
          },
        });
        throw error;
      }
      const effectivePlanPayload = skipBlueprintRewrite
        ? req.body?.plan || null
        : preflightResult?.updatedBlueprint || req.body?.plan || null;
      const permissionProfileId =
        preflightResult?.rewriteConfig?.permissionProfileId ||
        authProfile?.permissionProfileId ||
        authProfile?.recordId ||
        authProfile?.id ||
        null;
      preflightRecord = await store.updateAgentHistoryRecord(preflightRecord.recordId, {
        status: "running",
        executionMode: requestedExecutionMode,
        runner: requestedExecutionMode,
        authProfile,
        settings: {
          ...inputSettings,
          executionMode: requestedExecutionMode,
          runner: requestedExecutionMode,
          localBackgroundPreflight: {
            status: preflightResult?.status || null,
            autoConfirmed: true,
            updatedBlueprint: !skipBlueprintRewrite && Boolean(preflightResult?.updatedBlueprint),
            updatedBlueprintFile: !skipBlueprintRewrite ? preflightResult?.updatedBlueprintDebugFile || null : null,
            validationOk: preflightResult?.validation?.ok ?? null,
          },
        },
        updatedBlueprint: !skipBlueprintRewrite ? preflightResult?.updatedBlueprint || null : null,
        log: buildLocalBackgroundPreflightLog({
          blueprintId: planId,
          preflightResult,
          defaultValues: runSettings.defaultValues,
          regions: runSettings.regions,
          permissionProfileId,
          executionMode: requestedExecutionMode,
        }),
      });
      console.log("[local /runAgentBackground] preflight complete", {
        planId,
        recordId: preflightRecord.recordId,
        status: preflightResult?.status || null,
        isReadOnly: preflightResult?.readOnlyResult?.isReadOnly ?? null,
        isMutating: preflightResult?.analysis?.isMutating ?? null,
        updatedBlueprint: !skipBlueprintRewrite && Boolean(preflightResult?.updatedBlueprint),
        updatedBlueprintFile: !skipBlueprintRewrite ? preflightResult?.updatedBlueprintDebugFile || null : null,
        validationOk: preflightResult?.validation?.ok ?? null,
      });
      const recordRunEvent = createAgentRunEventRecorder({
        store,
        recordId: preflightRecord.recordId,
      });
      const executionMode = getBlueprintExecutionMode(blueprint, effectivePlanPayload, req.body || {});
      if (isLocalCodingAgentExecutionMode(executionMode)) {
        const runnerLabel = codingAgentRunnerLabel(executionMode);
        const phases = extractLocalPlanForSummary({ blueprint, planPayload: effectivePlanPayload }).phases;
        const localDataSnapshot = await buildCodexLocalDataSnapshot(store, {
          authProfile,
          selectedWorkloadOrStack: runSettings.selectedWorkloadOrStack,
        });
        const codexSettings = await getLocalCodexSettings(store);
        const agentSettings = getLocalCodingAgentSettings(codexSettings, executionMode);
        const { skillFiles: codexSkillFiles, executionContext: skillExecutionContext } =
          await buildRuntimeExternalAgentSkillFilesForRun({
            title,
            runner: executionMode,
            blueprint,
            planPayload: effectivePlanPayload,
            preflightResult,
            authProfile,
            regions: runSettings.regions,
            defaultValues: runSettings.defaultValues,
            executionPreferences: runSettings.executionPreferences,
            localDataSnapshot,
          });
        console.log(`[local /runAgentBackground] ${runnerLabel} skill context ready`, {
          planId,
          recordId: preflightRecord.recordId,
          generatedBy: skillExecutionContext.generatedBy,
          contextChars: String(skillExecutionContext.markdown || "").length,
        });
        recordAgentTaskStatusEvent(recordRunEvent, {
          recordId: preflightRecord.recordId,
          runner: executionMode,
          taskId: EXTERNAL_AGENT_RUN_TASK_ID,
          status: "in-progress",
          output: `Starting ${runnerLabel} session for "${title}".`,
        });
        const forwardCodingAgentEvent = (event) => {
          recordNormalizedAgentRawEvents(recordRunEvent, { event }, {
            req,
            recordId: preflightRecord.recordId,
            runner: executionMode,
            task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
            phaseIndex: 0,
            taskIndex: 0,
          });
        };
        const mcpForwarder = subscribeToLocalMcpRunEvents({
          req,
          recordId: preflightRecord.recordId,
          runner: executionMode,
          onEvent: forwardCodingAgentEvent,
          onMcpEvent: forwardCodingAgentEvent,
        });
        let codexResult;
        try {
          codexResult = await runLocalExternalAgentBlueprint({
            runner: executionMode,
            blueprintId: planId,
            title,
            blueprint,
            planPayload: effectivePlanPayload,
            phases,
            priorLogs: [],
            authProfile,
            executionContext: preflightResult?.executionContext || null,
            regions: runSettings.regions,
            defaultValues: runSettings.defaultValues,
            executionPreferences: runSettings.executionPreferences,
            localDataSnapshot,
            mcpUrl: buildLocalMcpUrl(req, {
              recordId: preflightRecord.recordId,
              runner: executionMode,
              authProfile,
              regions: runSettings.regions,
              executionContext: preflightResult?.executionContext || null,
              preflightResult,
              permissionProfileId,
            }),
            recordId: preflightRecord.recordId,
            workspaceDir: agentSettings.workspaceDir,
            agentBinary: agentSettings.agentBinary,
            skillFiles: codexSkillFiles,
            onEvent: forwardCodingAgentEvent,
            onStderr: (content) => {
              recordNormalizedAgentRawEvents(recordRunEvent, { type: "codex_stderr", content }, {
                req,
                recordId: preflightRecord.recordId,
                runner: executionMode,
                task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
                phaseIndex: 0,
                taskIndex: 0,
              });
            },
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
        const runSummary = await buildExternalAgentRunSummary({
          title,
          runnerLabel,
          runner: executionMode,
          status: codexResult.status,
          output: codexResult.output,
          events: codexResult.events,
        });
        recordAgentTaskStatusEvent(recordRunEvent, {
          recordId: preflightRecord.recordId,
          runner: executionMode,
          taskId: EXTERNAL_AGENT_RUN_TASK_ID,
          status: codexResult.status,
          output: logEntry.task_output || runSummary.summary,
          runSummary,
        });
        recordAgentRunStatusEvent(recordRunEvent, {
          recordId: preflightRecord.recordId,
          runner: executionMode,
          completed: true,
          status: codexResult.status,
          summary: runSummary.summary,
          runSummary,
        });
        const record = await store.updateAgentHistoryRecord(preflightRecord.recordId, {
          status: codexResult.status,
          executionMode,
          runner: executionMode,
          log: {
            ...parseStoredJsonValue(preflightRecord.log, {}),
            executionMode,
            runner: executionMode,
            logs: [logEntry],
            lastUpdated: now,
            runSummary,
          },
        });
        return res.status(201).json({
          ok: codexResult.status === "complete",
          status: codexResult.status,
          recordId: record?.recordId || preflightRecord.recordId,
          record,
          agentRun: record,
          summary: runSummary.summary,
          runSummary,
          logs: [logEntry],
          preflight: preflightResult,
          runner: executionMode,
          executionMode,
          message: runSummary.summary || `Local ${runnerLabel} finished "${title}" with status ${codexResult.status}.`,
        });
      }
      recordAgentRunStatusEvent(recordRunEvent, {
        recordId: preflightRecord.recordId,
        runner: "cloudagent",
        status: "running",
        summary: `Local CloudAgent started "${title}".`,
      });
      const recordCloudAgentTaskStart = async ({ task, phaseIndex, taskIndex }) => {
        recordAgentTaskStatusEvent(recordRunEvent, {
          recordId: preflightRecord.recordId,
          runner: "cloudagent",
          task,
          phaseIndex,
          taskIndex,
          status: "in-progress",
          output: `Running ${task?.title || task?.name || task?.id || "task"}.`,
        });
      };
      const recordCloudAgentTaskResult = async ({ task, logEntry, runSummary }) => {
        for (const commandOutput of Array.isArray(logEntry?.cli_command_output)
          ? logEntry.cli_command_output
          : []) {
          recordAgentTerminalOutputEvent(recordRunEvent, {
            recordId: preflightRecord.recordId,
            runner: "cloudagent",
            task,
            phaseIndex: logEntry.phaseIndex,
            taskIndex: logEntry.taskIndex,
            command: commandOutput.command || commandOutput.cli_command,
            output: commandOutput.output || "",
            raw: commandOutput,
          });
        }
        recordAgentTaskStatusEvent(recordRunEvent, {
          recordId: preflightRecord.recordId,
          runner: "cloudagent",
          task,
          phaseIndex: logEntry?.phaseIndex,
          taskIndex: logEntry?.taskIndex,
          status: logEntry?.status,
          output: logEntry?.task_output || logEntry?.output || "",
          runSummary,
          raw: logEntry,
        });
      };
      const cloudAgentResult = await executeLocalAgentPlanWithCloudAgent({
        store,
        planId,
        blueprint,
        planPayload: effectivePlanPayload,
        inputSettings: {
          ...inputSettings,
          authProfile,
          regions: runSettings.regions,
          defaultValues: runSettings.defaultValues,
          executionPreferences: runSettings.executionPreferences,
          selectedWorkloadOrStack: runSettings.selectedWorkloadOrStack,
          preflight: preflightResult,
        },
        authProfile,
        recordId: preflightRecord.recordId,
        parentId: req.body?.parentId || null,
        title,
        onTaskStart: recordCloudAgentTaskStart,
        onTaskToken: ({ token, task, phaseIndex, taskIndex }) => {
          recordAgentMessageEvent(recordRunEvent, {
            recordId: preflightRecord.recordId,
            runner: "cloudagent",
            task,
            phaseIndex,
            taskIndex,
            text: token,
          });
        },
        onContextEvent: ({ payload, task, phaseIndex, taskIndex }) => {
          recordNormalizedAgentRawEvents(recordRunEvent, { event: payload }, {
            recordId: preflightRecord.recordId,
            runner: "cloudagent",
            task,
            phaseIndex,
            taskIndex,
          });
        },
        onTaskResult: recordCloudAgentTaskResult,
      });
      if (!cloudAgentResult) {
        console.log("[local /runAgentBackground] falling back to CLI executor", {
          planId,
          recordId: preflightRecord.recordId,
          reason: "local_openai_not_configured",
        });
      }
      const result = cloudAgentResult || await executeLocalAgentPlan({
        store,
        planId,
        blueprint,
        planPayload: effectivePlanPayload,
        inputSettings: {
          ...inputSettings,
          authProfile,
          regions: runSettings.regions,
          defaultValues: runSettings.defaultValues,
          executionPreferences: runSettings.executionPreferences,
          selectedWorkloadOrStack: runSettings.selectedWorkloadOrStack,
          preflight: preflightResult,
        },
        authProfile,
        recordId: preflightRecord.recordId,
        parentId: req.body?.parentId || null,
        title,
        onTaskStart: recordCloudAgentTaskStart,
        onTaskResult: recordCloudAgentTaskResult,
      });
      recordAgentRunStatusEvent(recordRunEvent, {
        recordId: result.recordId || preflightRecord.recordId,
        runner: "cloudagent",
        completed: true,
        status: result.status,
        summary: result.summary,
        runSummary: result.runSummary,
      });
      res.status(201).json({
        ...result,
        preflight: preflightResult,
        message: result.summary || "Agent run completed in local mode.",
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/agent/connections/:recordId", async (req, res, next) => {
    try {
      const record = await store.getAgentHistoryRecord(req.params.recordId);
      if (!record) return res.status(404).json({ ok: false, error: "Agent run not found" });
      res.json({ ok: true, record, agentRun: record, item: record });
    } catch (error) {
      next(error);
    }
  });

  router.post("/agent/connections", async (req, res, next) => {
    try {
      const record = await store.createAgentHistoryRecord(req.body || {});
      res.status(201).json({ ok: true, record, agentRun: record, item: record });
    } catch (error) {
      next(error);
    }
  });

  router.post(["/agent/skill-evaluation", "/agent/blueprint-evaluation"], (_req, res) => {
    res.json({
      method_valid: true,
      message: {
        summary: "Local mode accepts this skill configuration method for tracking, but full execution validation is not implemented yet.",
        details: [],
      },
      raw: null,
      runtime: "local",
    });
  });

  router.post(["/agent/skill-rewrite", "/agent/blueprint-rewrite"], async (req, res, next) => {
    try {
      const blueprintId = req.body?.blueprintId || req.body?.recordId || null;
      const blueprint = blueprintId ? await store.getSkill(blueprintId) : null;
      res.json({
        ok: true,
        runtime: "local",
        blueprintId,
        configurationMode: req.body?.configurationMode || "cli",
        plan: blueprint ? parseStoredJsonValue(blueprint.plan, {}) : null,
        message: "Local mode returned the saved skill without hosted rewrite.",
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/agent", async (req, res, next) => {
    try {
      console.log("[local /agent] request", summarizeLocalAgentRequest(req.body || {}));
      const recordId = req.body?.recordId || req.body?.agentRunId || null;
      const blueprintId = req.body?.blueprintId || req.body?.planId || req.body?.plan?.recordId || null;
      const blueprint = blueprintId ? await store.getSkill(blueprintId) : null;
      const planPayload = req.body?.plan || null;
      const title = req.body?.plan?.title || req.body?.plan?.planTitle || blueprint?.title || blueprintId || "Local Agent";

      res.status(200);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.flushHeaders?.();
      attachAgentRunEventRecorder(res, { store, recordId });
      sendAgentChunk(res, { type: "message_start", sessionId: req.body?.sessionId || null });
      if (blueprint || planPayload) {
        const blueprintPayload = blueprint
          ? {
              recordId: blueprint.recordId,
              title: blueprint.title,
              cloudProvider: blueprint.cloudProvider,
              plan: parseStoredJsonValue(blueprint.plan, {}),
              planSettings: parseStoredJsonValue(blueprint.planSettings, {}),
            }
          : planPayload;
        sendAgentChunk(res, { type: "blueprint_updated", blueprint: blueprintPayload });
      }
      if (!req.body?.task) {
        const authProfileForRun = parseStoredObject(req.body?.authProfile, {});
        const requestedExecutionMode = getBlueprintExecutionMode(blueprint, planPayload, req.body || {});
        const skipBlueprintRewrite = isLocalCodingAgentExecutionMode(requestedExecutionMode);
        sendAgentChunk(res, {
          type: "prep_started",
          phase: "analyze_skill_intent",
          message: "Preparing skill execution context.",
        });
        const preflightResult = await runLocalBlueprintPreflight({
          store,
          recordId,
          blueprintId,
          blueprint,
          planPayload,
          title,
          authProfile: authProfileForRun,
          regions: Array.isArray(req.body?.regions) ? req.body.regions : [],
          defaultValues: req.body?.defaultValues || {},
          executionPreferences: req.body?.executionPreferences || {},
          selectedWorkloadOrStack: req.body?.selectedWorkloadOrStack || null,
          configurationMode: req.body?.configurationMode || req.body?.configurationMethod || null,
          stackAction: req.body?.stackAction || null,
          existingStack: req.body?.existingStack || null,
          existingStacks: Array.isArray(req.body?.existingStacks) ? req.body.existingStacks : [],
          additionalInstructions: req.body?.additionalInstructions || null,
          preflightAnswer: req.body?.preflightAnswer || null,
          skipBlueprintRewrite,
          onPrepEvent: (type, payload) => sendAgentChunk(res, { type, ...payload }),
        });

        if (!req.body?.preflightAnswer) {
          sendAgentChunk(res, {
            type: "prep_question",
            phase: "confirm_analysis",
            message: "Review the analysis outcomes before continuing.",
            question: preflightResult.question,
          });
          sendAgentChunk(res, {
            type: "message_end",
            recordId,
            status: "waiting_on_user_input",
          });
          sendAgentChunk(res, { type: "completed" });
          console.log("[local /agent] preflight review requested", {
            recordId,
            blueprintId,
            hasPlanPayload: Boolean(planPayload),
          });
          return res.end();
        }

        const existing = recordId ? await store.getAgentHistoryRecord(recordId) : null;
        const rewrittenBlueprintPayload = skipBlueprintRewrite ? null : preflightResult.updatedBlueprint || null;
        if (rewrittenBlueprintPayload) {
          sendAgentChunk(res, { type: "blueprint_updated", blueprint: rewrittenBlueprintPayload });
        }
        sendAgentChunk(res, {
          type: "prep_ready",
          phase: preflightResult.validation ? "validate_rewrite" : "confirm_analysis",
          analysis: preflightResult.analysis || null,
          validation: preflightResult.validation || null,
          updatedBlueprintFile: preflightResult.updatedBlueprintDebugFile || null,
        });
        if (existing) {
          const existingLog = parseStoredJsonValue(existing.log, {}) || {};
          await store.updateAgentHistoryRecord(recordId, {
            status: "running",
            authProfile: req.body?.authProfile || existing.authProfile || {},
            updatedBlueprint: skipBlueprintRewrite ? null : rewrittenBlueprintPayload || existing.updatedBlueprint || null,
            log: {
              ...existingLog,
              currentPhase: existingLog.currentPhase || 0,
              currentTask: existingLog.currentTask || 0,
              lastUpdated: new Date().toISOString(),
              blueprintId: blueprintId || existingLog.blueprintId || existing.itemId,
              isBluePrint: existingLog.isBluePrint ?? Boolean(blueprintId),
              executionMode: getBlueprintExecutionMode(blueprint, planPayload, req.body || {}),
              runner: getBlueprintExecutionMode(blueprint, planPayload, req.body || {}),
              preflight: {
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
              },
              globalSettings: {
                ...(existingLog.globalSettings || {}),
                ...(req.body?.defaultValues ? { defaultValues: req.body.defaultValues } : {}),
                ...(Array.isArray(req.body?.regions) ? { select_aws_regions: req.body.regions } : {}),
                ...(req.body?.permissionProfileId ? { permissionProfileId: req.body.permissionProfileId } : {}),
              },
            },
          });
        }
        const executionMode = getBlueprintExecutionMode(blueprint, rewrittenBlueprintPayload || planPayload, req.body || {});
        const externalAgentPlanPayload = isLocalCodingAgentExecutionMode(executionMode)
          ? planPayload
          : rewrittenBlueprintPayload || planPayload;
        sendAgentRuntimeDebug(res, buildAgentRuntimeDebug({
          stage: "route_selection_after_preflight",
          requestBody: req.body || {},
          blueprint,
          planPayload: externalAgentPlanPayload,
          executionMode,
        }));
        if (isLocalCodingAgentExecutionMode(executionMode)) {
          const runnerLabel = codingAgentRunnerLabel(executionMode);
          sendAgentTaskStatusEvent(res, {
            req,
            recordId,
            runner: executionMode,
            taskId: EXTERNAL_AGENT_RUN_TASK_ID,
            status: "in-progress",
            output: `Starting ${runnerLabel} session for "${title}".`,
          });
          const codexSettings = await getLocalCodexSettings(store);
          const agentSettings = getLocalCodingAgentSettings(codexSettings, executionMode);
          sendAgentRuntimeDebug(res, buildAgentRuntimeDebug({
            stage: "external_agent_settings",
            requestBody: req.body || {},
            blueprint,
            planPayload: externalAgentPlanPayload,
            executionMode,
            agentSettings,
          }));
          const codexSessionResult = await runLocalExternalAgentBlueprintSession({
            runner: executionMode,
            req,
            store,
            recordId,
            blueprintId: blueprintId || req.body?.planId || recordId || "local-agent",
            blueprint,
            planPayload: externalAgentPlanPayload,
            title,
            authProfile: authProfileForRun,
            regions: Array.isArray(req.body?.regions) ? req.body.regions : [],
            defaultValues: req.body?.defaultValues || {},
            executionPreferences: req.body?.executionPreferences || {},
            selectedWorkloadOrStack: req.body?.selectedWorkloadOrStack || null,
            preflightResult,
            onCodexEvent: (event) => {
              sendNormalizedAgentRawEvents(res, { event }, {
                req,
                recordId,
                runner: executionMode,
                task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
                phaseIndex: 0,
                taskIndex: 0,
              });
            },
            onMcpEvent: (event) => {
              sendNormalizedAgentRawEvents(res, { event }, {
                req,
                recordId,
                runner: executionMode,
                task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
                phaseIndex: 0,
                taskIndex: 0,
              });
            },
            onCodexStderr: (content) => {
              sendNormalizedAgentRawEvents(res, { type: "codex_stderr", content }, {
                req,
                recordId,
                runner: executionMode,
                task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
                phaseIndex: 0,
                taskIndex: 0,
              });
            },
          });
          sendAgentTaskStatusEvent(res, {
            req,
            recordId: codexSessionResult.recordId || recordId,
            runner: executionMode,
            taskId: EXTERNAL_AGENT_RUN_TASK_ID,
            status: codexSessionResult.status,
            output: codexSessionResult.logEntry?.task_output || codexSessionResult.summary,
            runSummary: codexSessionResult.runSummary,
          });
          console.log("[local /agent] external run summary event", {
            recordId: codexSessionResult.recordId || recordId,
            runner: executionMode,
            status: codexSessionResult.recordStatus || codexSessionResult.status,
            summaryChars: String(codexSessionResult.summary || "").length,
            runSummarySummaryChars: String(codexSessionResult.runSummary?.summary || "").length,
            runSummaryFinalChars: String(codexSessionResult.runSummary?.finalSummary || "").length,
            rawFinalSummaryChars: String(codexSessionResult.runSummary?.rawFinalSummary || "").length,
            generatedBy: codexSessionResult.runSummary?.generatedBy || null,
          });
          sendAgentRunStatus(res, {
            req,
            recordId: codexSessionResult.recordId || recordId,
            runner: executionMode,
            completed: true,
            status: codexSessionResult.recordStatus || codexSessionResult.status,
            summary: codexSessionResult.summary,
            runSummary: codexSessionResult.runSummary,
          });
          sendAgentChunk(res, {
            type: "message_end",
            recordId: codexSessionResult.recordId || recordId,
            status: codexSessionResult.recordStatus || codexSessionResult.status,
          });
          sendAgentChunk(res, { type: "completed" });
          return res.end();
        }
        sendAgentRuntimeDebug(res, buildAgentRuntimeDebug({
          stage: "cloudagent_fallback",
          requestBody: req.body || {},
          blueprint,
          planPayload: rewrittenBlueprintPayload || planPayload,
          executionMode,
          reason: "normalized execution mode is not a local coding-agent mode; running CloudAgent plan on the backend",
        }));
        const runPlanId = blueprintId || req.body?.planId || recordId || "local-agent";
        const runInputSettings = {
          ...(req.body?.permissionProfileId ? { permissionProfileId: req.body.permissionProfileId } : {}),
          ...(req.body?.defaultValues ? { defaultValues: req.body.defaultValues } : {}),
          ...(Array.isArray(req.body?.regions) ? { regions: req.body.regions } : {}),
          ...(req.body?.executionPreferences ? { executionPreferences: req.body.executionPreferences } : {}),
          ...(req.body?.selectedWorkloadOrStack ? { selectedWorkloadOrStack: req.body.selectedWorkloadOrStack } : {}),
          preflight: preflightResult,
        };
        sendAgentRunStatus(res, {
          req,
          recordId,
          runner: "cloudagent",
          status: "running",
          summary: `Local CloudAgent started "${title}".`,
        });
        const streamTaskStart = async ({ task, phaseIndex, taskIndex }) => {
          sendAgentTaskStatusEvent(res, {
            req,
            recordId,
            runner: "cloudagent",
            task,
            phaseIndex,
            taskIndex,
            status: "in-progress",
            output: `Running ${task?.title || task?.name || task?.id || "task"}.`,
          });
        };
        const streamTaskResult = async ({ task, logEntry, runSummary }) => {
          for (const commandOutput of Array.isArray(logEntry?.cli_command_output)
            ? logEntry.cli_command_output
            : []) {
            sendAgentTerminalOutputEvent(res, {
              req,
              recordId,
              runner: "cloudagent",
              task,
              phaseIndex: logEntry.phaseIndex,
              taskIndex: logEntry.taskIndex,
              command: commandOutput.command || commandOutput.cli_command,
              output: commandOutput.output || "",
              raw: commandOutput,
            });
          }
          sendAgentTaskStatusEvent(res, {
            req,
            recordId,
            runner: "cloudagent",
            task,
            phaseIndex: logEntry?.phaseIndex,
            taskIndex: logEntry?.taskIndex,
            status: logEntry?.status,
            output: logEntry?.task_output || logEntry?.output || "",
            runSummary,
            raw: logEntry,
          });
        };
        const cloudAgentPlanResult = await executeLocalAgentPlanWithCloudAgent({
          store,
          planId: runPlanId,
          blueprint,
          planPayload: rewrittenBlueprintPayload || planPayload,
          inputSettings: runInputSettings,
          authProfile: authProfileForRun,
          recordId,
          parentId: req.body?.parentId || null,
          title,
          onTaskStart: streamTaskStart,
          onTaskToken: ({ token, task, phaseIndex, taskIndex }) => {
            sendAgentMessageEvent(res, {
              req,
              recordId,
              runner: "cloudagent",
              task,
              phaseIndex,
              taskIndex,
              text: token,
            });
          },
          onContextEvent: ({ payload, task, phaseIndex, taskIndex }) => {
            sendNormalizedAgentRawEvents(res, { event: payload }, {
              req,
              recordId,
              runner: "cloudagent",
              task,
              phaseIndex,
              taskIndex,
            });
          },
          onTaskResult: streamTaskResult,
        });
        const result = cloudAgentPlanResult || await executeLocalAgentPlan({
          store,
          planId: runPlanId,
          blueprint,
          planPayload: rewrittenBlueprintPayload || planPayload,
          inputSettings: runInputSettings,
          authProfile: authProfileForRun,
          recordId,
          parentId: req.body?.parentId || null,
          title,
          onTaskStart: streamTaskStart,
          onTaskResult: streamTaskResult,
        });
        console.log("[local /agent] backend CloudAgent run summary event", {
          recordId: result.recordId || recordId,
          status: result.status,
          summaryChars: String(result.summary || "").length,
          runSummarySummaryChars: String(result.runSummary?.summary || "").length,
          runSummaryFinalChars: String(result.runSummary?.finalSummary || "").length,
          generatedBy: result.runSummary?.generatedBy || null,
        });
        sendAgentRunStatus(res, {
          req,
          recordId: result.recordId || recordId,
          runner: "cloudagent",
          completed: true,
          status: result.status,
          summary: result.summary,
          runSummary: result.runSummary,
        });
        sendAgentChunk(res, {
          type: "message_end",
          recordId: result.recordId || recordId,
          status: result.status,
        });
        sendAgentChunk(res, { type: "completed" });
        console.log("[local /agent] backend CloudAgent run complete", {
          recordId: result.recordId || recordId,
          blueprintId,
          status: result.status,
        });
        return res.end();
      }
      const executionMode = getBlueprintExecutionMode(blueprint, planPayload, req.body || {});
      sendAgentRuntimeDebug(res, buildAgentRuntimeDebug({
        stage: "route_selection",
        requestBody: req.body || {},
        blueprint,
        planPayload,
        executionMode,
      }));
      if (isLocalCodingAgentExecutionMode(executionMode)) {
        const runnerLabel = codingAgentRunnerLabel(executionMode);
        const authProfileForRun = parseStoredObject(req.body?.authProfile, {});
        const existingRunForPlan = recordId ? await store.getAgentHistoryRecord(recordId) : null;
        const storedUpdatedBlueprint = parseStoredJsonValue(existingRunForPlan?.updatedBlueprint, null);
        const effectivePlanPayload = planPayload || storedUpdatedBlueprint;
        sendAgentTaskStatusEvent(res, {
          req,
          recordId,
          runner: executionMode,
          taskId: EXTERNAL_AGENT_RUN_TASK_ID,
          status: "in-progress",
          output: `Starting ${runnerLabel} session for "${title}".`,
        });
        const codexSettings = await getLocalCodexSettings(store);
        const agentSettings = getLocalCodingAgentSettings(codexSettings, executionMode);
        sendAgentRuntimeDebug(res, buildAgentRuntimeDebug({
          stage: "external_agent_settings",
          requestBody: req.body || {},
          blueprint,
          planPayload: effectivePlanPayload,
          executionMode,
          agentSettings,
        }));
        const codexTaskResult = await runLocalExternalAgentBlueprintSession({
          runner: executionMode,
          req,
          store,
          recordId,
          blueprintId: blueprintId || req.body?.planId || recordId || "local-agent",
          blueprint,
          planPayload: effectivePlanPayload,
          title,
          authProfile: authProfileForRun,
          regions: Array.isArray(req.body?.regions) ? req.body.regions : [],
          defaultValues: req.body?.defaultValues || {},
          executionPreferences: req.body?.executionPreferences || {},
          selectedWorkloadOrStack: req.body?.selectedWorkloadOrStack || null,
          onCodexEvent: (event) => {
            sendNormalizedAgentRawEvents(res, { event }, {
              req,
              recordId,
              runner: executionMode,
              task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
              phaseIndex: 0,
              taskIndex: 0,
            });
          },
          onMcpEvent: (event) => {
            sendNormalizedAgentRawEvents(res, { event }, {
              req,
              recordId,
              runner: executionMode,
              task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
              phaseIndex: 0,
              taskIndex: 0,
            });
          },
          onCodexStderr: (content) => {
            sendNormalizedAgentRawEvents(res, { type: "codex_stderr", content }, {
              req,
              recordId,
              runner: executionMode,
              task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
              phaseIndex: 0,
              taskIndex: 0,
            });
          },
        });
        sendAgentTaskStatusEvent(res, {
          req,
          recordId: codexTaskResult.recordId || recordId,
          runner: executionMode,
          taskId: EXTERNAL_AGENT_RUN_TASK_ID,
          status: codexTaskResult.status,
          output: codexTaskResult.logEntry?.task_output || codexTaskResult.summary,
          runSummary: codexTaskResult.runSummary,
        });
        sendAgentRunStatus(res, {
          req,
          recordId: codexTaskResult.recordId || recordId,
          runner: executionMode,
          completed: true,
          status: codexTaskResult.recordStatus || codexTaskResult.status,
          summary: codexTaskResult.summary,
          runSummary: codexTaskResult.runSummary,
        });
        sendAgentChunk(res, {
          type: "message_end",
          recordId: codexTaskResult.recordId,
          status: codexTaskResult.recordStatus || codexTaskResult.status,
        });
        sendAgentChunk(res, { type: "completed" });
        return res.end();
      }
      if (isLocalOpenAIConfigured()) {
        const authProfileForRun = parseStoredObject(req.body?.authProfile, {});
        const existingRunForPlan = recordId ? await store.getAgentHistoryRecord(recordId) : null;
        const storedUpdatedBlueprint = parseStoredJsonValue(existingRunForPlan?.updatedBlueprint, null);
        const effectivePlanPayload = storedUpdatedBlueprint || planPayload;
        const requestTask = req.body?.task || {
          id: req.body?.task?.id || req.body?.task?.task_id || "cloudagent_task",
        };
        sendAgentTaskStatusEvent(res, {
          req,
          recordId,
          runner: "cloudagent",
          task: requestTask,
          status: "in-progress",
          output: `Running ${requestTask?.title || requestTask?.name || requestTask?.id || "task"}.`,
        });
        const llmResult = await runLocalCloudAgentBlueprintTask({
          store,
          recordId,
          blueprintId: blueprintId || req.body?.planId || recordId || "local-agent",
          blueprint,
          planPayload: effectivePlanPayload,
          title,
          taskId: req.body?.task?.id || req.body?.task?.task_id || null,
          authProfile: authProfileForRun,
          regions: Array.isArray(req.body?.regions) ? req.body.regions : [],
          defaultValues: req.body?.defaultValues || {},
          executionPreferences: req.body?.executionPreferences || {},
          selectedWorkloadOrStack: req.body?.selectedWorkloadOrStack || null,
          onToken: (token) => {
            sendAgentMessageEvent(res, {
              req,
              recordId,
              runner: "cloudagent",
              task: requestTask,
              text: token,
            });
          },
        });
        if (llmResult) {
          for (const commandOutput of Array.isArray(llmResult.cliOutputs)
            ? llmResult.cliOutputs
            : []) {
            sendAgentTerminalOutputEvent(res, {
              req,
              recordId: llmResult.recordId || recordId,
              runner: "cloudagent",
              task: requestTask,
              command: commandOutput.command || commandOutput.cli_command,
              output: commandOutput.output || "",
              raw: commandOutput,
            });
          }
          const failedCommands = (Array.isArray(llmResult.cliOutputs) ? llmResult.cliOutputs : [])
            .filter((commandOutput) => commandOutput.statusCode !== 200)
            .map((commandOutput) => ({
              taskId: llmResult.logEntry?.taskId || null,
              command: commandOutput.command || commandOutput.cli_command || null,
              statusCode: commandOutput.statusCode || 400,
              error: String(commandOutput.output || "").split(/\r?\n/).slice(0, 3).join(" "),
            }));
          if (failedCommands.length > 0) {
            console.warn("[local /agent] command failures", failedCommands);
          }
          sendAgentTaskStatusEvent(res, {
            req,
            recordId: llmResult.recordId || recordId,
            runner: "cloudagent",
            task: requestTask,
            taskId: llmResult.logEntry?.taskId || req.body?.task?.id || req.body?.task?.task_id,
            phaseIndex: llmResult.logEntry?.phaseIndex,
            taskIndex: llmResult.logEntry?.taskIndex,
            status: llmResult.status,
            output: llmResult.logEntry?.task_output || llmResult.summary,
            runSummary: llmResult.runSummary,
            raw: llmResult.logEntry,
          });
          sendAgentRunStatus(res, {
            req,
            recordId: llmResult.recordId || recordId,
            runner: "cloudagent",
            completed: true,
            status: llmResult.recordStatus || llmResult.status,
            summary: llmResult.summary,
            runSummary: llmResult.runSummary,
          });
          sendAgentChunk(res, {
            type: "message_end",
            recordId: llmResult.recordId,
            status: llmResult.recordStatus || llmResult.status,
          });
          sendAgentChunk(res, { type: "completed" });
          console.log("[local /agent] llm run complete", {
            recordId: llmResult.recordId,
            blueprintId,
            taskId: llmResult.logEntry?.taskId || req.body?.task?.id || req.body?.task?.task_id || null,
            status: llmResult.status,
          });
          return res.end();
        }
      }
      const result = await executeLocalAgentPlan({
        store,
        planId: blueprintId || req.body?.planId || recordId || "local-agent",
        blueprint,
        planPayload,
        inputSettings: {
          targetTaskId: req.body?.task?.id || req.body?.task?.task_id || null,
          task: req.body?.task || null,
          ...(req.body?.permissionProfileId ? { permissionProfileId: req.body.permissionProfileId } : {}),
          ...(req.body?.defaultValues ? { defaultValues: req.body.defaultValues } : {}),
          ...(Array.isArray(req.body?.regions) ? { regions: req.body.regions } : {}),
          ...(req.body?.executionPreferences ? { executionPreferences: req.body.executionPreferences } : {}),
          ...(req.body?.selectedWorkloadOrStack ? { selectedWorkloadOrStack: req.body.selectedWorkloadOrStack } : {}),
        },
        authProfile: req.body?.authProfile || null,
        recordId,
        title,
        onTaskStart: async ({ task, phaseIndex, taskIndex }) => {
          sendAgentTaskStatusEvent(res, {
            req,
            recordId,
            runner: "cloudagent",
            task,
            phaseIndex,
            taskIndex,
            status: "in-progress",
            output: `Running ${task?.title || task?.name || task?.id || "task"}.`,
          });
        },
        onTaskResult: async ({ task, logEntry, runSummary }) => {
          for (const commandOutput of Array.isArray(logEntry.cli_command_output)
            ? logEntry.cli_command_output
            : []) {
            sendAgentTerminalOutputEvent(res, {
              req,
              recordId,
              runner: "cloudagent",
              task,
              phaseIndex: logEntry.phaseIndex,
              taskIndex: logEntry.taskIndex,
              command: commandOutput.command || commandOutput.cli_command,
              output: commandOutput.output || "",
              raw: commandOutput,
            });
          }
          sendAgentTaskStatusEvent(res, {
            req,
            recordId,
            runner: "cloudagent",
            task,
            phaseIndex: logEntry.phaseIndex,
            taskIndex: logEntry.taskIndex,
            status: logEntry.status,
            output: logEntry.task_output,
            runSummary,
            raw: logEntry,
          });
        },
      });
      const failedCommands = (Array.isArray(result.logs) ? result.logs : [])
        .flatMap((entry) =>
          (Array.isArray(entry.cli_command_output) ? entry.cli_command_output : [])
            .filter((commandOutput) => commandOutput.statusCode !== 200)
            .map((commandOutput) => ({
              taskId: entry.taskId || null,
              command: commandOutput.command || commandOutput.cli_command || null,
              statusCode: commandOutput.statusCode || 400,
              error: String(commandOutput.output || "").split(/\r?\n/).slice(0, 3).join(" "),
            }))
        );
      if (failedCommands.length > 0) {
        console.warn("[local /agent] command failures", failedCommands);
      }
      sendAgentRunStatus(res, {
        req,
        recordId: result.recordId || recordId,
        runner: "cloudagent",
        completed: true,
        status: result.status,
        summary: result.summary,
        runSummary: result.runSummary,
      });
      sendAgentChunk(res, {
        type: "message_end",
        recordId: result.recordId,
        status: result.status,
      });
      sendAgentChunk(res, { type: "completed" });
      console.log("[local /agent] run complete", {
        recordId: result.recordId,
        blueprintId,
        taskId: req.body?.task?.id || req.body?.task?.task_id || null,
        status: result.status,
      });
      res.end();
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/plan-builder/save", async (req, res, next) => {
    try {
      res.json(await savePlanBuilderBlueprint(store, req.body || {}));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/plan-builder/generate", async (req, res, next) => {
    try {
      const result = await runLocalPlanBuilderGenerate(store, req.body || {});
      if (result?.ok === false) return res.status(400).json(result);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/plan-builder/chat", async (req, res, next) => {
    try {
      const result = await runLocalPlanBuilderChatAction(store, req.body || {});
      if (result?.ok === false) return res.status(400).json(result);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/plan-builder/reset", (req, res) => {
    const sessionId = String(req.body?.sessionId || "").trim();
    if (sessionId) {
      localPlanBuilderSessions.delete(sessionId);
      localPlanBuilderHistories.delete(sessionId);
    }
    res.json({ ok: true, cleared: Boolean(sessionId) });
  });

  return router;
}

export function createLocalUnavailableMiddleware() {
  const localApiPrefixes = [
    "/api",
    "/agent",
    "/ops",
    "/diagrams-app-mcp",
    "/recommendations",
    "/diagrams",
    "/v1",
    "/executive-summary",
  ];

  return function localUnavailable(req, res, next) {
    if (localApiPrefixes.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
      return res.status(501).json({
        ok: false,
        error: "This feature is not available in local mode.",
      });
    }
    return next();
  };
}
