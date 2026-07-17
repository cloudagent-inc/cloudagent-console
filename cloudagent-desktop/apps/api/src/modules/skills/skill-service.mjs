import fs from "node:fs/promises";
import path from "node:path";
import { codingAgentRunnerLabel, normalizeCodingAgentRunner } from "@cloudagent/agent-runtime";
import { buildCloudAgentSystemPrompt } from "@cloudagent/cloudagent/core";
import { parseStoredJsonValue } from "@cloudagent/storage";
import { generateLocalExternalAgentExecutionContextWithOpenAI, isLocalOpenAIConfigured } from "../../platform/openai.mjs";
import { compactLocalJson, localAuthSummary, uniqueLocalStrings } from "../../lib/http.mjs";
import { redactLocalSensitiveValue } from "../../lib/redact.mjs";
import { getLocalCodexSettings } from "../settings/settings-service.mjs";

export function codexSlug(value) {
  return String(value || "codex-skill")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "codex-skill";
}

export function safeSkillRelativePath(value) {
  const normalized = String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || path.isAbsolute(normalized)) {
    throw new Error("Invalid skill file path");
  }
  return normalized;
}

export function resolveSkillFilePath(skillDir, relativePath) {
  const safeRelative = safeSkillRelativePath(relativePath);
  const fullPath = path.resolve(skillDir, safeRelative);
  const root = path.resolve(skillDir);
  if (fullPath !== root && !fullPath.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid skill file path");
  }
  return { fullPath, relativePath: safeRelative };
}

export async function listEditableSkillFiles(skillDir, relativeRoot = "") {
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

export function normalizeExternalAgentContextMarkdown(markdown = "") {
  const text = String(markdown || "").trim();
  if (!text) return "";
  if (/^#{1,3}\s+Execution Context\b/im.test(text)) {
    return text.replace(/^#{1,3}\s+Execution Context\b/im, "## Execution Context");
  }
  return `## Execution Context\n\n${text}`;
}

export function buildExternalAgentMcpSkillInstructionLines({ runner = "codex" } = {}) {
  const normalizedRunner = normalizeCodingAgentRunner(runner);
  return [
    normalizedRunner === "cursor"
      ? "- Cursor MCP configuration for this run is written to `.cursor/mcp.json` and `.mcp.json` in the run workspace."
      : null,
    "- For cloud CLI work, call `cli_session_start` once, keep its returned `cliSessionId`, and pass that ID to later `cli_session_execute`, `cli_session_status`, and `cli_session_end` calls.",
    "- CloudAgent binds the selected environment and credentials to those CLI session tools automatically; do not ask the user for cloud secrets or credential locations.",
    "- Run shell commands through `cli_session_execute` when you need AWS CLI calls, temporary files, helper scripts, or command pipelines for this skill. If the ID is omitted, CloudAgent can reuse an exact session for the current run scope and environment.",
    "- First validate cloud access through the CLI session with `aws sts get-caller-identity --output json`, then continue through that same session.",
    "- Do not call the MCP HTTP endpoint directly with curl or JSON-RPC. If native CloudAgent MCP tools are not exposed in the agent session, stop and report that the MCP server did not load.",
    "- Do not run cloud CLI commands directly from the agent process shell for account inspection; use the MCP CLI session tools.",
    "- If the skill requires approved CloudFormation changes, prefer CloudAgent MCP `aws_cfn_operations` over direct mutating AWS CLI commands.",
    "- If CloudFormation validation returns any policy failure or lint error, revise the template and retry; do not deploy or report success until validation passes.",
    "- After CloudFormation succeeds, report the returned stack name, stack ID/ARN, status, region/account, and console URL. If only a change set was created, say explicitly that it was not deployed.",
    "- For Terraform/OpenTofu repo changes, use the GitHub checkout tools to create a branch and commit files, call `terraform_plan_check`, revise and recheck policy failures, and create the pull request only with a passing validation report in its body.",
    "- Correct and retry GitHub guardrail rejections; never report a branch, write, or pull request as successful when its tool call was rejected.",
  ].filter(Boolean);
}

export function buildExternalAgentCloudAgentOperatingGuide({
  clientId = "external-agent",
} = {}) {
  const prompt = buildCloudAgentSystemPrompt({
    mode: "local",
    clientId,
  }).trim();
  return [
    "## CloudAgent Operating Guide",
    "",
    "Follow this CloudAgent operating guide when deciding scope, safety gates, change management, and tool use.",
    "",
    "External-agent adapter notes:",
    "- This file and the launch prompt are the closest portable equivalent to a system prompt for Codex, Claude Code, and Cursor Agent.",
    "- If this guide names a hosted tool that is not exposed in the external-agent session, use the CloudAgent MCP tool with the closest matching capability or report that the capability is unavailable.",
    "- For report and scanner data, prefer MCP `list_artifacts` and `get_artifact`; request inline payloads only when needed.",
    "- For CloudAgent inventory, workflow, skill, and history questions, call MCP discovery tools instead of relying on launch-time context.",
    "- Runner-specific MCP, credential, workspace, and execution-context instructions in this `SKILL.md` override conflicting hosted-mode details in the guide below.",
    "- Keep final answers user-facing. Do not mention MCP, tool names, internal files, reading `SKILL.md`, copied artifacts, or other behind-the-scenes mechanics unless the user asks for implementation details or a tool/setup problem affects the result.",
    "",
    "```text",
    prompt,
    "```",
  ].join("\n");
}

export function buildDefaultSkillMarkdown({ blueprint, planPayload, runner = "codex" }) {
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
    "- Return concise user-facing Markdown focused on the answer, findings, impact, and next step.",
    "- Do not include process-report sections like `Actions Taken` or raw `Evidence` unless the user asks for an audit trail. Do not list internal tool names or mention reading this file.",
    "- Do not claim AWS or local changes were made unless you actually performed them.",
    "",
    buildExternalAgentCloudAgentOperatingGuide({
      clientId: `external-skill-${normalizeCodingAgentRunner(runner)}`,
    }),
    "",
  ].join("\n");
}

export function ensureExternalSkillOperatingGuide(content = "", { runner = "codex" } = {}) {
  const text = String(content || "").trim();
  if (/^##\s+CloudAgent Operating Guide\b/im.test(text)) return `${text}\n`;
  return [
    text,
    "",
    buildExternalAgentCloudAgentOperatingGuide({
      clientId: `external-skill-${normalizeCodingAgentRunner(runner)}`,
    }),
    "",
  ].filter(Boolean).join("\n");
}

export function isEmptySkillValue(value) {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0 || value.every(isEmptySkillValue);
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

export function stringifySkillValue(value) {
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

export function sanitizeBlueprintSkillValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeBlueprintSkillValue);
  if (!value || typeof value !== "object") return value;
  const ignored = new Set(["id", "task_id", "maxTurns", "max_turns", "status"]);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !ignored.has(key))
      .map(([key, entry]) => [key, sanitizeBlueprintSkillValue(entry)])
  );
}

export function appendSkillSection(lines, heading, value, level = 2) {
  if (isEmptySkillValue(value)) return;
  lines.push("", `${"#".repeat(level)} ${heading}`, "", stringifySkillValue(value));
}

export function taskToMarkdown(task = {}, index = 0) {
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

export function planToSkillMarkdown(planPayload = {}) {
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

export function normalizeExecutionPreferencesForSkill(executionPreferences = {}) {
  const preferences = executionPreferences && typeof executionPreferences === "object"
    ? executionPreferences
    : {};
  return {
    ...preferences,
    useDefaultValuesWithoutConfirmation: Boolean(preferences.useDefaultValuesWithoutConfirmation),
    applyChangesWithoutConfirmation: Boolean(preferences.applyChangesWithoutConfirmation),
  };
}

export function buildExternalAgentExecutionContextPayload({
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

export function appendExternalContextJson(lines, heading, value, maxLength = 5000) {
  if (isEmptySkillValue(value)) return;
  lines.push("", `### ${heading}`, "", "```json", compactLocalJson(redactLocalSensitiveValue(value), maxLength), "```");
}

export function appendExternalExecutionPreferences(lines, executionPreferences = {}) {
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

export function buildExternalAgentExecutionContextFallback(payload = {}) {
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

export async function buildExternalAgentExecutionContextMarkdown({
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

export function buildRuntimeExternalAgentSkillMarkdown({
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

export function buildRuntimeExternalAgentSkillFiles({
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

export async function buildRuntimeExternalAgentSkillFilesForRun({
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

export function migrateDefaultCodexSkillMarkdown(content = "") {
  const legacyRunContextFile = `session-${"context"}.json`;
  const migrated = String(content || "")
    .replace(
      "- Read `blueprint.json`, `plan.json`, and `cloudagent-run-context.json` before acting.",
      "- Read this `SKILL.md` completely before acting. It contains the execution context and skill plan for this run."
    )
    .replace(
      `- Use the AWS CLI for AWS inspection or execution. CloudAgent passes credentials to the Codex process through the standard AWS environment variables or selected AWS profile described in \`${legacyRunContextFile}\`.`,
      "- Use the Execution Context section to understand the selected AWS account/profile and region.\n- For cloud CLI work, use the CloudAgent MCP tools `cli_session_start` and `cli_session_execute`. CloudAgent binds the selected environment and credentials to those tools automatically.\n- Do not call the MCP HTTP endpoint directly with curl or JSON-RPC. If native CloudAgent MCP tools are not exposed in the agent session, stop and report that the MCP server did not load.\n- Do not run cloud CLI commands directly from the agent process shell for account inspection; use the MCP CLI session tools.\n- First validate AWS access through `cli_session_execute` with `aws sts get-caller-identity --output json`, then continue through that same CLI session."
    )
    .replace(
      "- Use CloudAgent MCP tools when live CloudAgent data is needed and the files do not already contain it.",
      "- Use the Execution Context section to understand the selected AWS account/profile and region.\n- For cloud CLI work, use the CloudAgent MCP tools `cli_session_start` and `cli_session_execute`. CloudAgent binds the selected environment and credentials to those tools automatically.\n- Do not call the MCP HTTP endpoint directly with curl or JSON-RPC. If native CloudAgent MCP tools are not exposed in the agent session, stop and report that the MCP server did not load.\n- Do not run cloud CLI commands directly from the agent process shell for account inspection; use the MCP CLI session tools.\n- First validate AWS access through `cli_session_execute` with `aws sts get-caller-identity --output json`, then continue through that same CLI session.\n- If a step needs user input or you are unsure whether it is safe to continue, stop and return a `User input needed` section with the exact question, options, and recommended default."
    )
    .replace(
      `- Use the AWS CLI for AWS inspection or execution. CloudAgent passes credential values to the Codex process through the environment variables listed at \`${legacyRunContextFile}.credentialAccess.availableEnvVars\` and \`${legacyRunContextFile}.environment.authProfile.credentialEnvVars\`.`,
      "- For cloud CLI work, use the CloudAgent MCP tools `cli_session_start` and `cli_session_execute`. CloudAgent binds the selected environment and credentials to those tools automatically."
    )
    .replace(
      "- Do not ask the user where credentials are stored. Do not rely on `~/.aws/config`, `~/.aws/credentials`, or `aws configure list` to find credentials. The process environment is the credential source of truth.",
      "- Do not call the MCP HTTP endpoint directly with curl or JSON-RPC. If native CloudAgent MCP tools are not exposed in the agent session, stop and report that the MCP server did not load.\n- Do not run cloud CLI commands directly from the agent process shell for account inspection; use the MCP CLI session tools."
    )
    .replace(
      "- First validate AWS access with `aws sts get-caller-identity --output json`, then continue with the skill-specific read-only AWS CLI commands.",
      "- First validate AWS access by calling MCP `cli_session_execute` with `aws sts get-caller-identity --output json`, then continue through that same CLI session."
    )
    .replace(
      "- Produce concise Markdown with Findings, Evidence, Actions Taken, and Result.",
      "- Return concise user-facing Markdown focused on the answer, findings, impact, and next step.\n- Do not include process-report sections like `Actions Taken` or raw `Evidence` unless the user asks for an audit trail. Do not list internal tool names or mention reading this file."
    )
    .replace(
      "- Return concise Markdown with Findings, Evidence, Actions Taken, and Result.",
      "- Return concise user-facing Markdown focused on the answer, findings, impact, and next step.\n- Do not include process-report sections like `Actions Taken` or raw `Evidence` unless the user asks for an audit trail. Do not list internal tool names or mention reading this file."
    );
  return ensureExternalSkillOperatingGuide(migrated);
}

export async function ensureCodexSkillForBlueprint(store, blueprintId) {
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
