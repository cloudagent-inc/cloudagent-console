import fs from "node:fs/promises";
import path from "node:path";
import { safeJsonParse } from "@cloudagent/platform/utils";
import { publicLocalOpenAISettings } from "../../platform/openai.mjs";
import { checkWritableDirectory, runCommandStatus } from "../../lib/process-status.mjs";

export async function buildLocalPreferencesStatus({ store, app } = {}) {
  const [openaiSettings, codexSettings, iacToolSettings, localData, awsCli] = await Promise.all([
    Promise.resolve(publicLocalOpenAISettings()),
    getLocalCodexSettings(store),
    getLocalIacToolSettings(store),
    checkWritableDirectory(store?.dataDir),
    runCommandStatus("aws"),
  ]);

  const [codexCli, claudeCli, cursorCli, terraformCli, opentofuCli, trivyCli, cfnGuardCli, cfnLintCli, githubCli] = await Promise.all([
    codexSettings.enabled === false
      ? Promise.resolve({ ok: true, disabled: true, command: codexSettings.binary || "codex" })
      : runCommandStatus(codexSettings.binary || "codex"),
    codexSettings.claude?.enabled === false
      ? Promise.resolve({ ok: true, disabled: true, command: codexSettings.claude?.binary || "claude" })
      : runCommandStatus(codexSettings.claude?.binary || "claude"),
    codexSettings.cursor?.enabled === false
      ? Promise.resolve({ ok: true, disabled: true, command: codexSettings.cursor?.binary || "cursor-agent" })
      : runCommandStatus(codexSettings.cursor?.binary || "cursor-agent"),
    runCommandStatus(iacToolSettings.terraformBinary),
    runCommandStatus(iacToolSettings.opentofuBinary),
    runCommandStatus(iacToolSettings.trivyBinary),
    runCommandStatus(iacToolSettings.cfnGuardBinary),
    runCommandStatus(iacToolSettings.cfnLintBinary),
    runCommandStatus(iacToolSettings.githubBinary),
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
        terraform: {
          label: "Terraform CLI",
          optional: true,
          ...terraformCli,
        },
        opentofu: {
          label: "OpenTofu CLI",
          optional: true,
          ...opentofuCli,
        },
        trivy: {
          label: "Trivy",
          optional: true,
          ...trivyCli,
        },
        cfnGuard: {
          label: "CloudFormation Guard",
          optional: true,
          ...cfnGuardCli,
        },
        cfnLint: {
          label: "CloudFormation Linter",
          optional: true,
          ...cfnLintCli,
        },
        github: {
          label: "GitHub CLI",
          optional: true,
          ...githubCli,
        },
      },
    },
  };
}

// Global GitHub governance defaults live in the user settings blob under
// settings.workloadRules.deploymentPreferences.github (the same location the
// UI writes global workload rules to). Returns null when none configured so
// the resolver falls back to the hardcoded secure defaults.
export async function getGlobalWorkloadGithubGovernance(store) {
  if (!store || typeof store.getSettings !== "function") return null;
  const settingsRecord = await store.getSettings().catch(() => null);
  const settings = safeJsonParse(settingsRecord?.settings, {});
  const workloadRules = settings?.workloadRules && typeof settings.workloadRules === "object"
    ? settings.workloadRules
    : {};
  const deploymentPreferences = workloadRules?.deploymentPreferences && typeof workloadRules.deploymentPreferences === "object"
    ? workloadRules.deploymentPreferences
    : {};
  const github = deploymentPreferences?.github;
  return github && typeof github === "object" && !Array.isArray(github) ? github : null;
}

export async function getLocalIacToolSettings(store) {
  const settingsRecord = await store.getSettings();
  const settings = safeJsonParse(settingsRecord?.settings, {});
  const tools = settings?.iacTools && typeof settings.iacTools === "object"
    ? settings.iacTools
    : {};
  return {
    terraformBinary: String(tools.terraformBinary || process.env.CLOUDAGENT_TERRAFORM_BIN || "terraform").trim() || "terraform",
    opentofuBinary: String(tools.opentofuBinary || process.env.CLOUDAGENT_OPENTOFU_BIN || "tofu").trim() || "tofu",
    trivyBinary: String(tools.trivyBinary || process.env.CLOUDAGENT_TRIVY_BIN || "trivy").trim() || "trivy",
    cfnGuardBinary: String(tools.cfnGuardBinary || process.env.CLOUDAGENT_CFN_GUARD_BIN || "cfn-guard").trim() || "cfn-guard",
    cfnLintBinary: String(tools.cfnLintBinary || process.env.CLOUDAGENT_CFN_LINT_BIN || "cfn-lint").trim() || "cfn-lint",
    githubBinary: String(tools.githubBinary || process.env.CLOUDAGENT_GITHUB_BIN || "gh").trim() || "gh",
  };
}

export async function updateLocalIacToolSettings(store, patch = {}) {
  const settingsRecord = await store.getSettings();
  const settings = safeJsonParse(settingsRecord?.settings, {});
  const existing = await getLocalIacToolSettings(store);
  const next = {
    terraformBinary: String(patch.terraformBinary || existing.terraformBinary).trim() || "terraform",
    opentofuBinary: String(patch.opentofuBinary || existing.opentofuBinary).trim() || "tofu",
    trivyBinary: String(patch.trivyBinary || existing.trivyBinary).trim() || "trivy",
    cfnGuardBinary: String(patch.cfnGuardBinary || existing.cfnGuardBinary).trim() || "cfn-guard",
    cfnLintBinary: String(patch.cfnLintBinary || existing.cfnLintBinary).trim() || "cfn-lint",
    githubBinary: String(patch.githubBinary || existing.githubBinary).trim() || "gh",
  };
  await store.updateSettings({
    settings: JSON.stringify({ ...settings, iacTools: next }),
  });
  return next;
}

export function defaultCodexWorkspaceDir() {
  return path.resolve(process.env.CLOUDAGENT_CODEX_WORKSPACE_DIR || process.cwd());
}

export function defaultCodexSkillsDir() {
  return path.resolve(
    process.env.CLOUDAGENT_CODEX_SKILLS_DIR ||
      path.join(defaultCodexWorkspaceDir(), ".cloudagent", "codex-skills")
  );
}

export function defaultClaudeWorkspaceDir() {
  return path.resolve(
    process.env.CLOUDAGENT_CLAUDE_WORKSPACE_DIR ||
      process.env.CLOUDAGENT_CODE_AGENT_WORKSPACE_DIR ||
      defaultCodexWorkspaceDir()
  );
}

export function defaultCursorWorkspaceDir() {
  return path.resolve(
    process.env.CLOUDAGENT_CURSOR_WORKSPACE_DIR ||
      process.env.CLOUDAGENT_CODE_AGENT_WORKSPACE_DIR ||
      defaultCodexWorkspaceDir()
  );
}

export function defaultCursorAgentBinary() {
  return String(process.env.CLOUDAGENT_CURSOR_BIN || "cursor-agent").trim() || "cursor-agent";
}

export function defaultCodexBinary() {
  return String(process.env.CLOUDAGENT_CODEX_BIN || process.env.CODEX_BIN || "codex").trim() || "codex";
}

export function normalizeCursorAgentBinary(value) {
  const raw = String(value || "").trim();
  return raw && raw !== "agent" ? raw : defaultCursorAgentBinary();
}

export function normalizeAbsoluteDirectory(value, fallback) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  return path.resolve(raw.replace(/^~(?=$|\/)/, process.env.HOME || ""));
}

export async function getLocalCodexSettings(store) {
  const settingsRecord = await store.getSettings();
  const settings = safeJsonParse(settingsRecord?.settings, {});
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

export async function updateLocalCodexSettings(store, patch = {}) {
  const settingsRecord = await store.getSettings();
  const settings = safeJsonParse(settingsRecord?.settings, {});
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

export function publicLocalCodexSettings(settings = {}) {
  const { skillsDir: _skillsDir, ...publicSettings } = settings || {};
  return publicSettings;
}
