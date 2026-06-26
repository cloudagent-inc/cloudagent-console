import fs from "node:fs/promises";
import path from "node:path";
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
} from "../workflows/local-runner.mjs";
import { startLocalWorkflowJob } from "../workflows/local-workflow-jobs.mjs";
import { resumeLocalCodexBlueprint, runLocalCodexBlueprint } from "../blueprints/local-codex-runner.mjs";
import { getNextScheduledRunAt } from "../workflows/local-workflow-scheduler.mjs";
import {
  normalizeExecutionMethod,
  normalizeExecutionStackAction,
  resolveBlueprintExecutionContext,
} from "@cloudagent/blueprints/execution-context";
import { validateRewrittenBlueprint } from "@cloudagent/blueprints/rewrite-validation";
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
const localPlanBuilderSessions = new Map();
const localPlanBuilderHistories = new Map();
let blueprintOpenAIFunctionsPromise = null;

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

async function loadBlueprintOpenAIFunctions() {
  blueprintOpenAIFunctionsPromise ||= Promise.all([
    import("@cloudagent/blueprints/configuration-planning"),
    import("@cloudagent/blueprints/execution-analysis"),
  ]).then(([configurationPlanning, executionAnalysis]) => ({
    applyBlueprintRuntimeSettings: configurationPlanning.applyBlueprintRuntimeSettings,
    rewriteBlueprintForExecution: configurationPlanning.rewriteBlueprintForExecution,
    analyzeBlueprintExecution: executionAnalysis.analyzeBlueprintExecution,
    classifyBlueprintReadOnly: executionAnalysis.classifyBlueprintReadOnly,
    determineBlueprintUpdateStrategy: executionAnalysis.determineBlueprintUpdateStrategy,
    recommendBlueprintExecutionTargets: executionAnalysis.recommendBlueprintExecutionTargets,
  }));
  return blueprintOpenAIFunctionsPromise;
}

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

function codexSlug(value) {
  return String(value || "codex-blueprint")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "codex-blueprint";
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

function normalizeAbsoluteDirectory(value, fallback) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  return path.resolve(raw.replace(/^~(?=$|\/)/, process.env.HOME || ""));
}

async function getLocalCodexSettings(store) {
  const settingsRecord = await store.getSettings();
  const settings = safeJsonParseLocal(settingsRecord?.settings, {});
  const codex = settings?.codex && typeof settings.codex === "object" ? settings.codex : {};
  return {
    skillsDir: normalizeAbsoluteDirectory(codex.skillsDir, defaultCodexSkillsDir()),
    workspaceDir: normalizeAbsoluteDirectory(codex.workspaceDir, defaultCodexWorkspaceDir()),
  };
}

async function updateLocalCodexSettings(store, patch = {}) {
  const settingsRecord = await store.getSettings();
  const settings = safeJsonParseLocal(settingsRecord?.settings, {});
  const existing = await getLocalCodexSettings(store);
  const nextCodex = {
    ...existing,
    ...(patch.skillsDir !== undefined
      ? { skillsDir: normalizeAbsoluteDirectory(patch.skillsDir, existing.skillsDir) }
      : {}),
    ...(patch.workspaceDir !== undefined
      ? { workspaceDir: normalizeAbsoluteDirectory(patch.workspaceDir, existing.workspaceDir) }
      : {}),
  };
  await fs.mkdir(nextCodex.skillsDir, { recursive: true });
  await fs.mkdir(nextCodex.workspaceDir, { recursive: true });
  const nextSettings = {
    ...settings,
    codex: {
      ...(settings.codex && typeof settings.codex === "object" ? settings.codex : {}),
      ...nextCodex,
    },
  };
  await store.updateSettings({ settings: JSON.stringify(nextSettings) });
  return nextCodex;
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

function buildDefaultSkillMarkdown({ blueprint, planPayload }) {
  return [
    `# ${blueprint?.title || planPayload?.title || "CloudAgent Codex Blueprint"}`,
    "",
    "Use this skill when running this CloudAgent blueprint through Codex CLI.",
    "",
    "## Instructions",
    "",
    "- Read `session-context.json` before acting. It contains the selected environment, workload, regions, preferences, local scan/report context, and the blueprint plan.",
    "- Use `session-context.json.environment.authProfile` to understand the selected AWS account/profile and region.",
    "- For AWS inspection, use the CloudAgent MCP tool `aws_cli_readonly` by default. Pass `permissionProfileId` and `accountId` from `session-context.json.environment.authProfile`, and pass concrete read-only AWS CLI commands such as `aws sts get-caller-identity --output json`.",
    "- Do not run AWS CLI commands directly from the shell for AWS account inspection unless the MCP tool is unavailable and you explicitly report that fallback.",
    "- First validate AWS access by calling MCP `aws_cli_readonly` with `aws sts get-caller-identity --output json`, then continue with blueprint-specific read-only AWS CLI commands through that same MCP tool.",
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

function appendSkillSection(lines, heading, value, level = 2) {
  if (isEmptySkillValue(value)) return;
  lines.push("", `${"#".repeat(level)} ${heading}`, "", stringifySkillValue(value));
}

function taskToMarkdown(task = {}, index = 0) {
  const lines = [];
  const title = task.title || task.name || task.id || task.task_id || `Task ${index + 1}`;
  lines.push(`#### ${index + 1}. ${title}`, "");
  const ignored = new Set(["title", "name"]);
  for (const [key, value] of Object.entries(task)) {
    if (ignored.has(key) || isEmptySkillValue(value)) continue;
    const label = key
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
    lines.push(`**${label}**`, "", stringifySkillValue(value), "");
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
  const lines = ["## Blueprint Plan"];
  phases.forEach((phase, phaseIndex) => {
    const phaseTitle = phase?.title || phase?.name || phase?.id || `Phase ${phaseIndex + 1}`;
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

function buildRuntimeCodexSkillMarkdown({ blueprint = {}, planPayload = {} } = {}) {
  const lines = [buildDefaultSkillMarkdown({ blueprint, planPayload }).trim()];
  appendSkillSection(lines, "Blueprint Title", blueprint?.title || planPayload?.title || planPayload?.planTitle);
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

function buildRuntimeCodexSkillFiles({ blueprint = {}, planPayload = {} } = {}) {
  return [
    {
      relativePath: "SKILL.md",
      content: buildRuntimeCodexSkillMarkdown({ blueprint, planPayload }),
    },
  ];
}

function migrateDefaultCodexSkillMarkdown(content = "") {
  return String(content || "")
    .replace(
      "- Read `blueprint.json`, `plan.json`, and `cloudagent-run-context.json` before acting.",
      "- Read `session-context.json` before acting. It contains the selected environment, workload, regions, preferences, local scan/report context, and the blueprint plan."
    )
    .replace(
      "- Use the AWS CLI for AWS inspection or execution. CloudAgent passes credentials to the Codex process through the standard AWS environment variables or selected AWS profile described in `session-context.json`.",
      "- Use `session-context.json.environment.authProfile` to understand the selected AWS account/profile and region.\n- For AWS inspection, use the CloudAgent MCP tool `aws_cli_readonly` by default. Pass `permissionProfileId` and `accountId` from `session-context.json.environment.authProfile`, and pass concrete read-only AWS CLI commands such as `aws sts get-caller-identity --output json`.\n- Do not run AWS CLI commands directly from the shell for AWS account inspection unless the MCP tool is unavailable and you explicitly report that fallback.\n- First validate AWS access by calling MCP `aws_cli_readonly` with `aws sts get-caller-identity --output json`, then continue with blueprint-specific read-only AWS CLI commands through that same MCP tool."
    )
    .replace(
      "- Use CloudAgent MCP tools when live CloudAgent data is needed and the files do not already contain it.",
      "- Use `session-context.json.environment.authProfile` to understand the selected AWS account/profile and region.\n- For AWS inspection, use the CloudAgent MCP tool `aws_cli_readonly` by default. Pass `permissionProfileId` and `accountId` from `session-context.json.environment.authProfile`, and pass concrete read-only AWS CLI commands such as `aws sts get-caller-identity --output json`.\n- Do not run AWS CLI commands directly from the shell for AWS account inspection unless the MCP tool is unavailable and you explicitly report that fallback.\n- First validate AWS access by calling MCP `aws_cli_readonly` with `aws sts get-caller-identity --output json`, then continue with blueprint-specific read-only AWS CLI commands through that same MCP tool.\n- If a step needs user input or you are unsure whether it is safe to continue, stop and return a `User input needed` section with the exact question, options, and recommended default."
    )
    .replace(
      "- Use the AWS CLI for AWS inspection or execution. CloudAgent passes credential values to the Codex process through the environment variables listed at `session-context.json.credentialAccess.availableEnvVars` and `session-context.json.environment.authProfile.credentialEnvVars`.",
      "- For AWS inspection, use the CloudAgent MCP tool `aws_cli_readonly` by default. Pass `permissionProfileId` and `accountId` from `session-context.json.environment.authProfile`, and pass concrete read-only AWS CLI commands such as `aws sts get-caller-identity --output json`."
    )
    .replace(
      "- Do not ask the user where credentials are stored. Do not rely on `~/.aws/config`, `~/.aws/credentials`, or `aws configure list` to find credentials. The process environment is the credential source of truth.",
      "- Do not run AWS CLI commands directly from the shell for AWS account inspection unless the MCP tool is unavailable and you explicitly report that fallback."
    )
    .replace(
      "- First validate AWS access with `aws sts get-caller-identity --output json`, then continue with the blueprint-specific read-only AWS CLI commands.",
      "- First validate AWS access by calling MCP `aws_cli_readonly` with `aws sts get-caller-identity --output json`, then continue with blueprint-specific read-only AWS CLI commands through that same MCP tool."
    );
}

async function ensureCodexSkillForBlueprint(store, blueprintId) {
  const blueprint = await store.getBlueprint(blueprintId);
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
    planTitle: blueprint?.title || plan?.planTitle || plan?.title || "Untitled Blueprint",
    planDescription,
    cloudProvider: blueprint?.cloudProvider || plan?.cloudProvider || "aws",
    plan: Array.isArray(plan?.plan) ? plan.plan : Array.isArray(plan?.tasks) ? plan.tasks : [],
    requiredPermissions: parseStoredJsonValue(blueprint?.requiredPermissions, {}),
    planSettings,
    planOverview: planSettings.planOverview || plan?.planOverview || null,
    planDefaultValues: planSettings.defaultValues || plan?.planDefaultValues || null,
    skeletonSettings: planSettings.skeletonSettings || plan?.skeletonSettings || null,
    credits: blueprint?.credits || plan?.credits || 1,
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
  const planTitle = planState.planTitle || planState.title || payload.title || "Untitled Blueprint";
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
    credits: planState.credits || payload.credits || 1,
    ...(planDescription ? { description: planDescription } : {}),
    ...(planState.planOverview ? { planOverview: planState.planOverview } : {}),
    ...(planState.planDefaultValues ? { planDefaultValues: planState.planDefaultValues } : {}),
    ...(planState.skeletonSettings ? { skeletonSettings: planState.skeletonSettings } : {}),
  };
  const blueprintInput = {
    ...(recordId ? { recordId } : {}),
    title: planTitle,
    description: normalizeDescriptionList(planDescription),
    credits: planState.credits || payload.credits || 1,
    cloudProvider: planPayload.cloudProvider,
    plan: planPayload,
    requiredPermissions: planState.requiredPermissions || payload.requiredPermissions || {},
    planSettings,
    status: payload.status || "ready",
  };
  const blueprint = recordId && await store.getBlueprint(recordId)
    ? await store.updateBlueprint(recordId, blueprintInput)
    : await store.createBlueprint(blueprintInput);
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
      "Set an OpenAI API key in Preferences, or set OPENAI_TOKEN or OPENAI_API_KEY, to use the local blueprint builder.",
  };
}

async function loadLocalPlanBuilderFunctions() {
  if (!process.env.OPENAI_TOKEN && process.env.OPENAI_API_KEY) {
    process.env.OPENAI_TOKEN = process.env.OPENAI_API_KEY;
  }
  const [functionsModule, serviceModule] = await Promise.all([
    import("@cloudagent/blueprints/builder-functions"),
    import("@cloudagent/blueprints/blueprint-service"),
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
      "Untitled Blueprint",
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
    credits: planState.credits || payload.credits || 1,
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
    credits: initial.credits || 1,
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
    const blueprint = await store.getBlueprint(recordId).catch(() => null);
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
  let response = "Updated the local blueprint draft.";
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
    response = "Generated an updated local blueprint skeleton.";
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
    response = "Updated local blueprint task details.";
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
    response = "Generated local blueprint settings.";
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

function sendAgentChunk(res, payload) {
  res.write(`<<CHUNK_START>>${JSON.stringify(payload)}<<CHUNK_END>>`);
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
  };
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
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    if (["codex", "codex_cli", "openai_codex"].includes(normalized)) return "codex";
    if (["cloudagent", "cloud_agent", "default"].includes(normalized)) return "cloudagent";
  }
  return "cloudagent";
}

function getBlueprintExecutionMode(blueprint, planPayload = null, requestBody = {}) {
  return normalizeBlueprintExecutionMode(
    requestBody?.executionMode,
    requestBody?.runner
  );
}

function buildLocalMcpUrl(req) {
  const configured = process.env.CLOUDAGENT_LOCAL_MCP_URL || process.env.CLOUDAGENT_MCP_URL;
  if (configured) return configured;
  const host = req?.get?.("host");
  if (!host) return null;
  return `${req.protocol || "http"}://${host}/mcp`;
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
    if (event.type !== "tool_execution" || event.sourceTool !== "aws_cli_readonly") continue;
    const output = event.output && typeof event.output === "object" ? event.output : {};
    const input = output.input && typeof output.input === "object" ? output.input : event.input || {};
    const result = output.result && typeof output.result === "object" ? output.result : {};
    const resultOutput = result.output && typeof result.output === "object"
      ? result.output
      : { stdout: result.output || "", stderr: "" };
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
      "This is a local desktop blueprint run.",
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
    "Execute this CloudAgent blueprint task in local desktop mode.",
    "",
    "Rules:",
    "- Use aws_cli_readonly for live AWS data whenever the task requires account evidence.",
    "- Only use read-only AWS CLI commands: describe, list, get, head, query, or scan.",
    "- Do not invent AWS findings. Base conclusions on tool output or prior task outputs.",
    "- If the task is a summary task, use prior task outputs first and only call AWS if more evidence is needed.",
    "- Return concise Markdown with Findings, Evidence, and Result.",
    "",
    `Blueprint: ${title || blueprintId || "Local blueprint"}`,
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
    "Review this CloudAgent blueprint before local desktop execution.",
    "",
    "Do not execute AWS CLI commands in this review. Analyze the blueprint structure, expected local read-only AWS checks, selected environment, and likely prerequisites.",
    "Return concise Markdown with: Execution scope, Local prerequisites, Task review, and Risks/limitations.",
    "",
    `Blueprint: ${title || blueprintId || "Local blueprint"}`,
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

function buildLocalReadOnlyExecutionContext(executionContext) {
  return {
    ...(executionContext || {}),
    deployment: {
      ...(executionContext?.deployment || {}),
      requestedMethod:
        executionContext?.deployment?.requestedMethod ||
        executionContext?.deployment?.workloadMethod ||
        executionContext?.deployment?.environmentMethod ||
        null,
      resolvedMethod: "aws_cli",
      methodSource: "read_only_blueprint",
      stackAction: null,
    },
    delivery: {
      source: "none",
      sourceOfTruth: "live_environment",
      target: "direct_cloud",
      deliveryMethod: null,
      repo: null,
      pipelineConfig: null,
      hasRepoConflict: false,
      availableTargets: ["direct_cloud"],
    },
  };
}

function buildLocalEnvironmentScopeRecommendation(reason) {
  return {
    status: "environment_scope_recommended",
    environmentScopeRecommended: true,
    candidates: [],
    topCandidate: null,
    reason:
      reason ||
      "The blueprint appears to fit better at the environment/account scope than any tracked workload.",
  };
}

function summarizeLocalUpdateStrategy(updateStrategy = null) {
  if (!updateStrategy) return null;
  return {
    method: updateStrategy.method || null,
    changeStrategy: updateStrategy.changeStrategy || null,
    targetType: updateStrategy.targetType || null,
    selectedStackId: updateStrategy.selectedStackId || updateStrategy.stackId || null,
    reason: updateStrategy.reason || null,
    planSummary: updateStrategy.planSummary || null,
  };
}

function buildLocalTargetScopeQuestion(recommendation, executionContext = null) {
  const options = [];
  const pushOption = (option) => {
    if (!option?.id || options.some((existing) => existing.id === option.id)) return;
    options.push(option);
  };
  if (executionContext?.workload?.selected && executionContext?.workload?.id) {
    pushOption({
      id: `workload:${executionContext.workload.id}`,
      label: executionContext.workload.name || executionContext.workload.id,
      description: "Currently selected workload target.",
      recommended: false,
    });
  }
  if (recommendation?.topCandidate?.workloadId) {
    pushOption({
      id: `workload:${recommendation.topCandidate.workloadId}`,
      label: recommendation.topCandidate.name,
      description: recommendation.topCandidate.reasons?.[0] || "Recommended workload target.",
      recommended: true,
    });
  }
  pushOption({
    id: "environment",
    label: "Environment-wide",
    description: recommendation?.reason || "Run this blueprint at the environment/account scope.",
    recommended: !recommendation?.topCandidate?.workloadId,
  });
  for (const candidate of recommendation?.candidates || []) {
    if (!candidate?.workloadId || candidate.workloadId === recommendation?.topCandidate?.workloadId) continue;
    pushOption({
      id: `workload:${candidate.workloadId}`,
      label: candidate.name,
      description: candidate.reasons?.[0] || "Alternative workload target.",
      recommended: false,
    });
  }
  return {
    id: "target_scope",
    kind: "single_select",
    title: "Choose where to run this blueprint",
    options,
  };
}

function buildLocalStackActionQuestion() {
  return {
    id: "stack_action",
    kind: "single_select",
    title: "Should this create new infrastructure or update existing infrastructure?",
    options: [
      {
        id: "create",
        label: "Create new",
        description: "Use this when the blueprint should create a new stack or template deployment.",
        recommended: true,
      },
      {
        id: "update",
        label: "Update existing",
        description: "Use this when the blueprint should change an existing stack or template deployment.",
        recommended: false,
      },
    ],
  };
}

function buildLocalFinalReviewQuestion({
  executionContext,
  analysis,
  recommendation,
  updateStrategy,
  rewriteConfig = {},
} = {}) {
  const targetQuestion = buildLocalTargetScopeQuestion(recommendation, executionContext);
  const stackActionQuestion = buildLocalStackActionQuestion();
  const currentTargetValue = executionContext?.workload?.selected
    ? `workload:${executionContext.workload.id}`
    : "environment";
  const scopeLabel = executionContext?.workload?.selected
    ? "Workload"
    : executionContext?.target?.scope === "stack"
      ? "Existing stack"
      : "Environment-wide";
  const targetLabel = executionContext?.workload?.selected
    ? executionContext?.workload?.name || executionContext?.workload?.id || "Selected workload"
    : executionContext?.target?.stackId || executionContext?.target?.accountId || "Environment-wide";
  const methodLabel = analysis?.isMutating
    ? updateStrategy?.method || executionContext?.deployment?.resolvedMethod || "undetermined"
    : "aws_cli (read-only)";
  const stackActionLabel = analysis?.isMutating
    ? updateStrategy?.changeStrategy === "update_existing"
      ? "update"
      : updateStrategy?.changeStrategy === "create_new"
        ? "create"
        : updateStrategy?.changeStrategy === "direct_aws_cli"
          ? "not template-managed"
          : executionContext?.deployment?.stackAction || "undetermined"
    : "not required";
  const existingStacks = uniqueLocalStrings([
    ...(Array.isArray(rewriteConfig?.existingStacks) ? rewriteConfig.existingStacks : []),
    updateStrategy?.selectedStackId || null,
    ...(Array.isArray(executionContext?.deployment?.existingStacks) ? executionContext.deployment.existingStacks : []),
    executionContext?.target?.stackId || null,
  ]);
  const changeTargetLabel =
    !analysis?.isMutating
      ? "not required"
      : updateStrategy?.targetType === "cloudformation_stack"
        ? existingStacks.length > 1
          ? `${existingStacks.length} CloudFormation stacks selected`
          : updateStrategy?.selectedStackId || "CloudFormation stack"
        : updateStrategy?.targetType === "github_repo"
          ? executionContext?.delivery?.repo?.fullName || "GitHub repo"
          : "direct AWS environment";
  const changePlanLabel = !analysis?.isMutating
    ? "Read-only blueprint; no deployment plan is required."
    : updateStrategy?.planSummary || "Execution strategy not yet determined.";
  const deliveryLabel = executionContext?.delivery?.repo?.fullName
    ? `${executionContext.delivery.target} via ${executionContext.delivery.repo.fullName}`
    : executionContext?.delivery?.target || "direct_cloud";

  return {
    id: "analysis_review",
    kind: "single_select",
    title: "Review the execution analysis before continuing",
    summary: [
      { label: "Blueprint type", value: analysis?.isMutating ? "Mutating" : "Read-only" },
      { label: "Scope", value: scopeLabel },
      { label: "Target", value: String(targetLabel || "Not determined") },
      { label: "Deployment method", value: String(methodLabel) },
      { label: "Create or update", value: String(stackActionLabel) },
      { label: "Change target", value: String(changeTargetLabel) },
      ...(analysis?.isMutating && existingStacks.length
        ? [{ label: "Associated stacks", value: existingStacks.join(", ") }]
        : []),
      { label: "Planned change", value: String(changePlanLabel) },
      { label: "Delivery path", value: String(deliveryLabel) },
    ],
    overrides: {
      target_scope: {
        title: "Target",
        value: currentTargetValue,
        options: targetQuestion.options,
      },
      ...(analysis?.isMutating && updateStrategy?.changeStrategy !== "direct_aws_cli"
        ? {
            stack_action: {
              title: "Create or update",
              value:
                updateStrategy?.changeStrategy === "update_existing"
                  ? "update"
                  : updateStrategy?.changeStrategy === "create_new"
                    ? "create"
                    : executionContext?.deployment?.stackAction || "create",
              options: stackActionQuestion.options,
            },
          }
        : {}),
    },
    options: [
      {
        id: "continue",
        label: "Continue",
        description: "Proceed with the blueprint rewrite using these determinations.",
        recommended: true,
      },
    ],
  };
}

function applyLocalPreflightAnswer(rewriteConfig = {}, preflightAnswer = null) {
  const next = { ...rewriteConfig };
  const answerId = preflightAnswer?.questionId || null;
  const selectedOptionId = preflightAnswer?.selectedOptionId || preflightAnswer?.value || null;

  const applyTargetScope = (value) => {
    if (!value) return;
    if (value === "environment") {
      next.selectedWorkloadOrStack = null;
    } else if (String(value).startsWith("workload:")) {
      next.selectedWorkloadOrStack = `workload-${String(value).slice("workload:".length)}`;
    }
  };

  if (answerId === "target_scope") {
    applyTargetScope(selectedOptionId);
  } else if (answerId === "stack_action") {
    next.stackAction = normalizeExecutionStackAction(selectedOptionId);
    if (next.stackAction !== "update") {
      next.existingStack = null;
      next.existingStacks = [];
    }
  } else if (answerId === "existing_stacks") {
    const selectedStacks = uniqueLocalStrings(Array.isArray(selectedOptionId) ? selectedOptionId : [selectedOptionId]);
    next.existingStacks = selectedStacks;
    next.existingStack = selectedStacks[0] || null;
  } else if (answerId === "implementation_method") {
    next.configurationMode = normalizeExecutionMethod(selectedOptionId);
  } else if (answerId === "analysis_review" && preflightAnswer?.overrides) {
    applyTargetScope(preflightAnswer.overrides.target_scope);
    if (preflightAnswer.overrides.stack_action) {
      next.stackAction = normalizeExecutionStackAction(preflightAnswer.overrides.stack_action);
      if (next.stackAction !== "update") {
        next.existingStack = null;
        next.existingStacks = [];
      }
    }
    const existingStackOverride =
      preflightAnswer.overrides.existing_stacks || preflightAnswer.overrides.existing_stack;
    if (existingStackOverride) {
      const selectedStacks = uniqueLocalStrings(
        Array.isArray(existingStackOverride) ? existingStackOverride : [existingStackOverride]
      );
      next.existingStacks = selectedStacks;
      next.existingStack = selectedStacks[0] || null;
    }
  }

  return next;
}

function buildLocalAnalysisReviewQuestion({ title, blueprint, planPayload, authProfile, regions = [], reviewText = "" }) {
  const planSummary = extractLocalPlanForSummary({ blueprint, planPayload });
  const defaultRegions = Array.isArray(regions) && regions.length ? regions.join(", ") : "Not specified";
  const summary = [
    { label: "Blueprint", value: title || blueprint?.title || "Local blueprint" },
    { label: "Plan", value: `${planSummary.phaseCount} phase(s), ${planSummary.taskCount} task(s)` },
    { label: "Environment", value: authProfile?.awsAccountId || authProfile?.accountId || authProfile?.awsProfile || authProfile?.profileName || "Local AWS credentials" },
    { label: "Regions", value: defaultRegions },
  ];
  if (reviewText) {
    summary.push({ label: "LLM review", value: reviewText });
  }
  return {
    id: "analysis_review",
    title: "Review local blueprint execution",
    summary,
    options: [
      {
        id: "continue",
        label: "Continue",
        description: "Run this blueprint locally with the selected AWS credentials.",
        recommended: true,
      },
    ],
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
} = {}) {
  return {
    logs: [],
    currentPhase: 0,
    currentTask: 0,
    lastUpdated: new Date().toISOString(),
    blueprintId,
    isBluePrint: true,
    preflight: {
      executionContext: preflightResult?.executionContext || null,
      analysis: preflightResult?.analysis || null,
      recommendation: preflightResult?.recommendation || null,
      updateStrategy: preflightResult?.updateStrategy || null,
      rewriteConfig: preflightResult?.rewriteConfig || null,
      validation: preflightResult?.validation || null,
      readOnlyResult: preflightResult?.readOnlyResult || null,
      source: "local_background_auto_confirm",
    },
    globalSettings: {
      ...(Object.keys(defaultValues || {}).length ? { defaultValues } : {}),
      ...(Array.isArray(regions) && regions.length ? { select_aws_regions: regions } : {}),
      ...(permissionProfileId ? { permissionProfileId } : {}),
    },
    runSummary: {
      summary: "Local background run completed blueprint review and rewrite preflight.",
      finalSummary: "Local background run completed blueprint review and rewrite preflight.",
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
        title: raw?.title || raw?.planTitle || blueprintId || "Library Blueprint",
        cloudProvider: raw?.cloudProvider || "aws",
        plan,
      }
    : {
        ...(plan && typeof plan === "object" && !Array.isArray(plan) ? plan : {}),
        title: raw?.title || raw?.planTitle || plan?.title || blueprintId || "Library Blueprint",
        cloudProvider: raw?.cloudProvider || plan?.cloudProvider || "aws",
        plan: Array.isArray(plan?.plan) ? plan.plan : [],
      };
  const planPayload = stripBlueprintRunnerFields(planPayloadRaw);
  return {
    recordId: raw?.recordId || raw?.blueprintId || raw?.planId || blueprintId,
    title: raw?.title || raw?.planTitle || planPayload.title,
    description: raw?.description || raw?.planDescription || planPayload.description || "",
    cloudProvider: raw?.cloudProvider || planPayload.cloudProvider || "aws",
    credits: raw?.credits || planPayload.credits || 1,
    plan: planPayload,
    requiredPermissions: raw?.requiredPermissions || {},
    planSettings: raw?.planSettings || {},
    source: raw?.source || "library",
  };
}

async function resolveLocalBackgroundBlueprint(store, blueprintId) {
  const id = String(blueprintId || "").trim();
  if (!id) return null;
  const local = await store.getBlueprint(id);
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

function buildLocalSummaryText({ scope, target, relatedProfiles = [], relatedWorkloads = [] }) {
  const title = scope === "account"
    ? `# Executive Summary: ${target.name || target.recordId}`
    : `# Executive Summary: ${target.workloadName || target.workloadId}`;
  const updatedAt = new Date().toISOString();

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

  return [
    title,
    "",
    `Generated: ${updatedAt}`,
    "",
    "## Scope",
    ...targetLines,
    "",
    "## Local Mode Data Coverage",
    "This summary was generated from local workload and permission profile metadata. Health, cost, recommendation, compliance, and report artifacts are not available yet in the local-mode MVP unless they are added by a later local scanner workflow.",
    "",
    "## Operational Readout",
    scope === "account"
      ? `The environment is onboarded locally as ${target.type || "a cloud environment"}. Use workloads to group applications and track resources against this environment.`
      : `The workload is defined locally with ${Array.isArray(target.environments) ? target.environments.length : 0} linked environment(s). Keep its tracked resources and deployment preferences current so future scanner and reporting features can produce stronger analysis.`,
    "",
    "## Recommended Next Steps",
    "- Confirm the environment metadata and authentication profile details are complete.",
    "- Attach workloads to the correct environments.",
    "- Add tracked resources or stack references where they are known.",
    "- Run a future local scanner/report workflow when available to populate health, cost, and compliance evidence.",
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
    const summaryText = buildLocalSummaryText({
      scope: "account",
      target: profile,
      relatedWorkloads,
    });
    const llmSummaryText = await generateLocalExecutiveSummaryWithOpenAI({
      scope: "account",
      target: profile,
      relatedWorkloads,
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
      unavailable: ["health", "cost", "reports", "recommendations", "compliance"],
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
  const summaryText = buildLocalSummaryText({
    scope: "workload",
    target: workload,
    relatedProfiles,
  });
  const llmSummaryText = await generateLocalExecutiveSummaryWithOpenAI({
    scope: "workload",
    target: workload,
    relatedProfiles,
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
    unavailable: ["health", "cost", "reports", "recommendations", "compliance"],
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
      await fs.mkdir(settings.skillsDir, { recursive: true });
      await fs.mkdir(settings.workspaceDir, { recursive: true });
      res.json({ ok: true, settings });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/codex/settings", async (req, res, next) => {
    const body = parseBody(PermissionProfilePatchSchema, req, res);
    if (!body) return;
    try {
      const settings = await updateLocalCodexSettings(store, {
        skillsDir: body.skillsDir,
        workspaceDir: body.workspaceDir,
      });
      res.json({ ok: true, settings });
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

  router.get("/codex/blueprints/:recordId/skill", async (req, res, next) => {
    try {
      const result = await ensureCodexSkillForBlueprint(store, req.params.recordId);
      if (!result) return res.status(404).json({ ok: false, error: "Blueprint not found" });
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  });

  router.put("/codex/blueprints/:recordId/skill/files", async (req, res, next) => {
    const body = parseBody(PermissionProfilePatchSchema, req, res);
    if (!body) return;
    try {
      const result = await ensureCodexSkillForBlueprint(store, req.params.recordId);
      if (!result) return res.status(404).json({ ok: false, error: "Blueprint not found" });
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

  router.get("/blueprints", async (req, res, next) => {
    try {
      const items = sortLocalItems(
        await store.listBlueprints(),
        req.query.sortBy || "updatedAt",
        req.query.sortOrder || "desc"
      );
      const page = paginateLocalItems(items, req.query);
      res.json({
        ok: true,
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

  router.post("/blueprints", async (req, res, next) => {
    const body = parseBody(BlueprintCreateSchema, req, res);
    if (!body) return;
    try {
      const blueprint = await store.createBlueprint(body);
      res.status(201).json({ ok: true, blueprint, item: blueprint });
    } catch (error) {
      next(error);
    }
  });

  router.get("/blueprints/:recordId", async (req, res, next) => {
    try {
      const blueprint = await store.getBlueprint(req.params.recordId);
      if (!blueprint) return res.status(404).json({ ok: false, error: "Blueprint not found" });
      res.json({ ok: true, blueprint, item: blueprint });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/blueprints/:recordId", async (req, res, next) => {
    const body = parseBody(BlueprintPatchSchema, req, res);
    if (!body) return;
    try {
      const blueprint = await store.updateBlueprint(req.params.recordId, body);
      if (!blueprint) return res.status(404).json({ ok: false, error: "Blueprint not found" });
      res.json({ ok: true, blueprint, item: blueprint });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/blueprints/:recordId", async (req, res, next) => {
    try {
      const deleted = await store.deleteBlueprint(req.params.recordId);
      res.status(deleted ? 200 : 404).json({
        ok: deleted,
        deleted,
        recordId: req.params.recordId,
        ...(deleted ? {} : { error: "Blueprint not found" }),
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

      res.status(200);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.flushHeaders?.();
      sendAgentChunk(res, { type: "message_start", recordId: req.params.recordId });
      sendAgentChunk(res, {
        type: "task_status_update",
        content: JSON.stringify({
          task_id: "codex_blueprint_run",
          status: "in-progress",
          task_output_summary_message: "Resuming Codex session with your reply.",
          executionMode: "codex",
        }),
      });

      await store.updateAgentHistoryRecord(req.params.recordId, {
        status: "running",
        executionMode: "codex",
        runner: "codex",
      });

      const result = await resumeLocalCodexAgentRun({
        store,
        recordId: req.params.recordId,
        prompt,
        mcpUrl: buildLocalMcpUrl(req),
        onCodexEvent: (event) => {
          sendAgentChunk(res, { type: "codex_event", event });
        },
        onCodexStderr: (content) => {
          sendAgentChunk(res, { type: "codex_stderr", content });
        },
      });

      sendAgentChunk(res, {
        type: "message_in_progress",
        content: result.logEntry?.task_output || result.summary,
      });
      sendAgentChunk(res, {
        type: "task_status_update",
        content: JSON.stringify({
          task_id: "codex_blueprint_run",
          status: result.status,
          task_output_summary_message: result.logEntry?.task_output || result.summary,
          run_summary: result.runSummary,
          executionMode: "codex",
        }),
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
          error_code: error?.status || "CODEX_RESUME_FAILED",
          message: error?.message || "Failed to resume Codex session.",
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
    throw new Error(`Local blueprint task not found: ${taskId}`);
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
  const taskExecutionContext = await resolveBlueprintExecutionContext({
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

async function runLocalCodexBlueprintTask({
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
  onCodexStdout = null,
  onCodexStderr = null,
} = {}) {
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
    throw new Error(`Local Codex blueprint task not found: ${taskId}`);
  }

  const { accountsService, workloadsService } = createLocalCloudAgentTools({
    store,
    selectedAuthProfile: authProfile,
  });
  const taskExecutionContext = await resolveBlueprintExecutionContext({
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
  const codexSkillFiles = buildRuntimeCodexSkillFiles({ blueprint, planPayload });

  console.log("[local /agent] codex task start", {
    recordId,
    blueprintId,
    taskId,
    title: task.title || task.name || taskId,
  });
  const codexResult = await runLocalCodexBlueprint({
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
    mcpUrl: buildLocalMcpUrl(req),
    recordId,
    workspaceDir: codexSettings.workspaceDir,
    skillFiles: codexSkillFiles,
    onEvent: onCodexEvent,
    onStdout: onCodexStdout,
    onStderr: onCodexStderr,
  });
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
    executionMode: "codex",
    runner: "codex",
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
      ? buildLocalFinalRunSummary({
          title,
          phases,
          logs: nextLogs,
          finalTaskSummary: codexResult.output,
          completedAt: now,
        })
      : buildRunSummaryObject({ title, status: codexResult.status, output: codexResult.output });
  const recordPatch = {
    status: codexResult.status === "complete" && !isLastTask ? "running" : codexResult.status,
    executionMode: "codex",
    runner: "codex",
    authProfile: authProfile || existing?.authProfile || {},
    log: {
      ...existingLog,
      executionMode: "codex",
      runner: "codex",
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
  console.log("[local /agent] codex task complete", {
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

async function runLocalCodexBlueprintSession({
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
  onCodexStdout = null,
  onCodexStderr = null,
} = {}) {
  const existing = recordId ? await store.getAgentHistoryRecord(recordId) : null;
  const existingLog = parseStoredJsonValue(existing?.log, {}) || {};
  const existingPreflight = preflightResult
    ? {
        executionContext: preflightResult.executionContext || null,
        analysis: preflightResult.analysis || null,
        recommendation: preflightResult.recommendation || null,
        updateStrategy: preflightResult.updateStrategy || null,
        rewriteConfig: preflightResult.rewriteConfig || null,
        validation: preflightResult.validation || null,
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
    executionContext = await resolveBlueprintExecutionContext({
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
  const codexSkillFiles = buildRuntimeCodexSkillFiles({ blueprint, planPayload });

  console.log("[local /agent] codex session start", {
    recordId,
    blueprintId,
    title,
    phaseCount: phases.length,
    taskCount: phases.reduce((sum, phase) => sum + (Array.isArray(phase?.tasks) ? phase.tasks.length : 0), 0),
  });

  const codexResult = await runLocalCodexBlueprint({
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
    mcpUrl: buildLocalMcpUrl(req),
    recordId,
    workspaceDir: codexSettings.workspaceDir,
    skillFiles: codexSkillFiles,
    onEvent: onCodexEvent,
    onStdout: onCodexStdout,
    onStderr: onCodexStderr,
  });
  const now = new Date().toISOString();
  const logEntry = {
    taskId: "codex_blueprint_run",
    taskTitle: "Codex blueprint session",
    status: codexResult.status,
    output: codexResult.output,
    task_output: codexResult.output,
    executionMode: "codex",
    runner: "codex",
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
    ...priorLogs.filter((entry) => entry?.taskId !== "codex_blueprint_run"),
    logEntry,
  ];
  const runSummary = {
    ...buildRunSummaryObject({ title, status: codexResult.status, output: codexResult.output }),
    summary: `Local Codex finished "${title}" with status ${codexResult.status}.`,
  };
  const recordPatch = {
    status: codexResult.status,
    executionMode: "codex",
    runner: "codex",
    authProfile: authProfile || existing?.authProfile || {},
    log: {
      ...existingLog,
      executionMode: "codex",
      runner: "codex",
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
  console.log("[local /agent] codex session complete", {
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

async function resumeLocalCodexAgentRun({
  store,
  recordId,
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
  const logs = Array.isArray(existingLog.logs) ? existingLog.logs : [];
  const latestCodexLog = logs
    .slice()
    .reverse()
    .find((entry) => entry?.executionMode === "codex" || entry?.runner === "codex" || entry?.codex);
  const codexRun = existingLog.codexRun && typeof existingLog.codexRun === "object"
    ? existingLog.codexRun
    : {};
  const runDir = codexRun.runDir || latestCodexLog?.codex?.runDir || null;
  const threadId = codexRun.threadId || latestCodexLog?.codex?.threadId || null;
  if (!runDir) {
    const error = new Error("This Codex run does not have a saved run directory and cannot be resumed.");
    error.status = 409;
    throw error;
  }

  const authProfile = parseStoredObject(existing.authProfile, {});
  const resumeResult = await resumeLocalCodexBlueprint({
    threadId,
    runDir,
    prompt,
    authProfile,
    mcpUrl,
    onEvent: onCodexEvent,
    onStdout: onCodexStdout,
    onStderr: onCodexStderr,
  });
  const now = new Date().toISOString();
  const resumeIndex = logs.filter((entry) => String(entry?.taskId || "").startsWith("codex_resume_")).length + 1;
  const logEntry = {
    taskId: `codex_resume_${resumeIndex}`,
    taskTitle: `Codex resume ${resumeIndex}`,
    status: resumeResult.status,
    input: prompt,
    output: resumeResult.output,
    task_output: resumeResult.output,
    executionMode: "codex",
    runner: "codex",
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
    summary: `Local Codex resumed "${existing.title || existing.itemId || recordId}" with status ${resumeResult.status}.`,
  };
  const nextLog = {
    ...existingLog,
    executionMode: "codex",
    runner: "codex",
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
    },
  };
  const record = await store.updateAgentHistoryRecord(recordId, {
    status: resumeResult.status,
    executionMode: "codex",
    runner: "codex",
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
  configurationMode = null,
  stackAction = null,
  existingStack = null,
  existingStacks = [],
  additionalInstructions = null,
  preflightAnswer = null,
  onPrepEvent = null,
} = {}) {
  const emit = (type, payload = {}) => {
    if (typeof onPrepEvent === "function") onPrepEvent(type, payload);
  };
  const {
    applyBlueprintRuntimeSettings,
    rewriteBlueprintForExecution,
    analyzeBlueprintExecution,
    classifyBlueprintReadOnly,
    determineBlueprintUpdateStrategy,
    recommendBlueprintExecutionTargets,
  } = await loadBlueprintOpenAIFunctions();
  const { accountsService, workloadsService } = createLocalCloudAgentTools({
    store,
    selectedAuthProfile: authProfile,
  });
  const permissionProfileId =
    authProfile?.permissionProfileId || authProfile?.recordId || authProfile?.id || null;
  const accountId = authProfile?.awsAccountId || authProfile?.accountId || null;
  let rewriteConfig = {
    permissionProfileId,
    selectedWorkloadOrStack,
    configurationMode: normalizeExecutionMethod(configurationMode),
    stackAction: normalizeExecutionStackAction(stackAction),
    existingStack: existingStack || null,
    existingStacks: uniqueLocalStrings(existingStacks),
    regions: Array.isArray(regions) ? regions : [],
    defaultValues: defaultValues || {},
    additionalInstructions,
    executionPreferences: executionPreferences || {},
    deliveryTargetOverride: null,
  };

  emit("prep_phase_started", {
    phase: "review_environment_settings",
    message: "Reviewing environment settings and execution target.",
  });
  let executionContext = await resolveBlueprintExecutionContext({
    userId: LOCAL_AUTH.userId,
    accountId,
    permissionProfileId,
    selectedTarget: rewriteConfig.selectedWorkloadOrStack,
    configurationMode: rewriteConfig.configurationMode,
    stackAction: rewriteConfig.stackAction,
    existingStack: rewriteConfig.existingStack,
    existingStacks: rewriteConfig.existingStacks,
    regions: rewriteConfig.regions,
    defaultValues: rewriteConfig.defaultValues,
    additionalInstructions: rewriteConfig.additionalInstructions,
    executionPreferences: rewriteConfig.executionPreferences,
    deliveryTargetOverride: rewriteConfig.deliveryTargetOverride,
    accountsService,
    workloadsService,
  });
  emit("prep_phase_completed", {
    phase: "review_environment_settings",
    message: "Environment settings resolved.",
  });

  emit("prep_phase_started", {
    phase: "analyze_blueprint_intent",
    message: "Analyzing blueprint scope and rewrite directives.",
  });
  const blueprintForAnalysis = planPayload || (blueprint ? parseStoredJsonValue(blueprint.plan, {}) : {});
  const readOnlyResult = await classifyBlueprintReadOnly({ blueprint: blueprintForAnalysis });
  emit("prep_progress", {
    phase: "analyze_blueprint_intent",
    message: readOnlyResult?.isReadOnly
      ? "Blueprint classified as read-only because no task requires implementing changes."
      : "Blueprint classified as mutating because at least one task requires implementing changes.",
    readOnlyResult,
  });
  let analysis = await analyzeBlueprintExecution({
    blueprint: blueprintForAnalysis,
    executionContext,
    readOnlyResult,
    recommendation: null,
  });
  emit("prep_phase_completed", {
    phase: "analyze_blueprint_intent",
    message: "Blueprint analysis completed.",
  });

  let recommendation = null;
  if (readOnlyResult?.isReadOnly) {
    rewriteConfig.configurationMode = "aws_cli";
    rewriteConfig.stackAction = null;
    rewriteConfig.deliveryTargetOverride = null;
    executionContext = buildLocalReadOnlyExecutionContext(executionContext);
    recommendation = buildLocalEnvironmentScopeRecommendation(
      "Blueprint is read-only, so environment/account scope is the default recommendation."
    );
    emit("prep_phase_started", {
      phase: "match_target_scope",
      message: "Checking whether this blueprint should run against a workload or the environment.",
    });
    emit("prep_recommendation", {
      phase: "match_target_scope",
      recommendation,
    });
    emit("prep_phase_completed", {
      phase: "match_target_scope",
      message: "Environment-wide execution is the recommended fit for this read-only blueprint.",
    });
    emit("prep_decision", {
      phase: "match_target_scope",
      decision: {
        questionId: "target_scope",
        selectedOptionId: "environment",
        source: "read_only_default",
        label: "Environment-wide",
      },
    });
    emit("prep_progress", {
      phase: "analyze_blueprint_intent",
      message: "Blueprint is read-only. Using AWS CLI and skipping deployment configuration checks.",
    });
  } else {
    if (!executionContext?.workload?.selected) {
      emit("prep_phase_started", {
        phase: "match_target_scope",
        message: "Checking existing workloads to recommend the best target scope.",
      });
      recommendation = await recommendBlueprintExecutionTargets({
        userId: LOCAL_AUTH.userId,
        accountId,
        permissionProfileId,
        blueprint: blueprintForAnalysis,
        workloadsService,
      });
      emit("prep_recommendation", {
        phase: "match_target_scope",
        recommendation,
      });
      emit("prep_phase_completed", {
        phase: "match_target_scope",
        message:
          recommendation?.status === "recommended_workload"
            ? "A likely workload target was found."
            : "Environment-wide execution is likely the better fit.",
      });
    }
  }

  const updateStrategy = await determineBlueprintUpdateStrategy({
    blueprint: blueprintForAnalysis,
    executionContext,
    analysis,
    candidateStacks: [],
    rewriteConfig,
  });
  if (!readOnlyResult?.isReadOnly) {
    emit("prep_phase_started", {
      phase: "resolve_update_strategy",
      message: "Resolving whether this change should update an existing target or create a new one.",
    });
    emit("prep_phase_completed", {
      phase: "resolve_update_strategy",
      message: updateStrategy?.planSummary || "Update strategy resolved.",
      updateStrategy: summarizeLocalUpdateStrategy(updateStrategy),
    });
  }

  const question = buildLocalFinalReviewQuestion({
    executionContext,
    analysis,
    recommendation,
    updateStrategy,
    rewriteConfig,
  });

  if (!preflightAnswer) {
    return {
      status: "waiting_for_input",
      question,
      executionContext,
      analysis,
      recommendation,
      updateStrategy,
      rewriteConfig,
      readOnlyResult,
      updatedBlueprint: null,
      validation: null,
    };
  }

  emit("prep_decision", {
    phase: "confirm_analysis",
    decision: {
      questionId: preflightAnswer.questionId || "analysis_review",
      selectedOptionId: preflightAnswer.selectedOptionId || preflightAnswer.value || "continue",
      overrides: preflightAnswer.overrides || {},
    },
  });

  rewriteConfig = applyLocalPreflightAnswer(rewriteConfig, preflightAnswer);
  executionContext = await resolveBlueprintExecutionContext({
    userId: LOCAL_AUTH.userId,
    accountId,
    permissionProfileId: rewriteConfig.permissionProfileId,
    selectedTarget: rewriteConfig.selectedWorkloadOrStack,
    configurationMode: rewriteConfig.configurationMode,
    stackAction: rewriteConfig.stackAction,
    existingStack: rewriteConfig.existingStack,
    existingStacks: rewriteConfig.existingStacks,
    regions: rewriteConfig.regions,
    defaultValues: rewriteConfig.defaultValues,
    additionalInstructions: rewriteConfig.additionalInstructions,
    executionPreferences: rewriteConfig.executionPreferences,
    deliveryTargetOverride: rewriteConfig.deliveryTargetOverride,
    accountsService,
    workloadsService,
  });
  analysis = await analyzeBlueprintExecution({
    blueprint: blueprintForAnalysis,
    executionContext,
    readOnlyResult,
    recommendation,
  });
  emit("prep_progress", {
    phase: "confirm_analysis",
    message: executionContext?.workload?.selected
      ? `Using workload target ${executionContext.workload.name || executionContext.workload.id}.`
      : "Using environment/account target.",
    executionContext: {
      target: executionContext?.target || null,
      workload: executionContext?.workload
        ? {
            selected: executionContext.workload.selected,
            id: executionContext.workload.id,
            name: executionContext.workload.name,
            foundIn: executionContext.workload.foundIn,
            trackedResourceCount:
              (executionContext.workload.trackedResources?.resources?.length || 0) +
              (executionContext.workload.trackedResources?.stacks?.length || 0),
          }
        : null,
    },
  });

  const resolvedRewriteMethod =
    executionContext?.deployment?.resolvedMethod || rewriteConfig.configurationMode;
  let updatedBlueprint = null;
  let validation = null;
  if (typeof resolvedRewriteMethod === "string" && isLocalOpenAIConfigured()) {
    emit("prep_phase_started", {
      phase: "rewrite_blueprint",
      message: "Rewriting the blueprint for the resolved target and delivery path.",
    });
    const rewriteResult = await rewriteBlueprintForExecution({
      blueprint: blueprintForAnalysis?.plan ? { plan: blueprintForAnalysis.plan } : blueprintForAnalysis,
      configurationMode: resolvedRewriteMethod,
      stackAction: executionContext?.deployment?.stackAction || rewriteConfig.stackAction,
      executionPreferences: rewriteConfig.executionPreferences,
      defaultValues: rewriteConfig.defaultValues,
      regions: rewriteConfig.regions,
      additionalInstructions: rewriteConfig.additionalInstructions,
      existingStack: executionContext?.deployment?.existingStacks?.[0] || rewriteConfig.existingStack || null,
      existingStacks: uniqueLocalStrings([
        ...(Array.isArray(executionContext?.deployment?.existingStacks) ? executionContext.deployment.existingStacks : []),
        ...(Array.isArray(rewriteConfig.existingStacks) ? rewriteConfig.existingStacks : []),
        rewriteConfig.existingStack || null,
      ]),
      executionContext,
      analysis,
    });
    updatedBlueprint = rewriteResult?.blueprint || null;
    emit("prep_phase_completed", {
      phase: "rewrite_blueprint",
      message: updatedBlueprint ? "Blueprint rewrite completed." : "Blueprint rewrite did not produce changes.",
    });
    if (updatedBlueprint) {
      emit("prep_phase_started", {
        phase: "validate_rewrite",
        message: "Validating the rewritten blueprint.",
      });
      validation = validateRewrittenBlueprint({
        blueprint: updatedBlueprint,
        executionContext,
        analysis,
      });
      if (!validation?.ok) {
        emit("prep_progress", {
          phase: "validate_rewrite",
          message: "Retrying blueprint rewrite with validation feedback.",
          validation,
        });
        const retryRewriteResult = await rewriteBlueprintForExecution({
          blueprint: blueprintForAnalysis?.plan ? { plan: blueprintForAnalysis.plan } : blueprintForAnalysis,
          configurationMode: resolvedRewriteMethod,
          stackAction: executionContext?.deployment?.stackAction || rewriteConfig.stackAction,
          executionPreferences: rewriteConfig.executionPreferences,
          defaultValues: rewriteConfig.defaultValues,
          regions: rewriteConfig.regions,
          additionalInstructions: rewriteConfig.additionalInstructions,
          existingStack: executionContext?.deployment?.existingStacks?.[0] || rewriteConfig.existingStack || null,
          existingStacks: uniqueLocalStrings([
            ...(Array.isArray(executionContext?.deployment?.existingStacks) ? executionContext.deployment.existingStacks : []),
            ...(Array.isArray(rewriteConfig.existingStacks) ? rewriteConfig.existingStacks : []),
            rewriteConfig.existingStack || null,
          ]),
          executionContext,
          analysis,
          validationFeedback: validation,
        });
        if (retryRewriteResult?.blueprint) {
          updatedBlueprint = retryRewriteResult.blueprint;
          validation = validateRewrittenBlueprint({
            blueprint: updatedBlueprint,
            executionContext,
            analysis,
          });
        }
      }
      emit("prep_phase_completed", {
        phase: "validate_rewrite",
        message: validation?.ok
          ? "Blueprint validation completed."
          : "Blueprint validation completed with remaining warnings.",
        validation,
      });
    }
  } else if (typeof resolvedRewriteMethod === "string" && !isLocalOpenAIConfigured()) {
    emit("prep_scope_warning", {
      phase: "rewrite_blueprint",
      message: "OpenAI is not configured for local mode, so the blueprint rewrite step was skipped.",
      scope: {
        reason: "Set an OpenAI API key in Preferences, or set OPENAI_API_KEY or OPENAI_TOKEN, to enable local blueprint rewrite.",
      },
    });
  } else if (
    !readOnlyResult?.isReadOnly &&
    (Object.keys(defaultValues || {}).length ||
      regions.length ||
      additionalInstructions ||
      Object.keys(executionPreferences || {}).length)
  ) {
    emit("prep_phase_started", {
      phase: "rewrite_blueprint",
      message: "Applying runtime settings to the blueprint while preserving the original implementation path.",
    });
    const runtimeSettingsResult = applyBlueprintRuntimeSettings({
      blueprint: blueprintForAnalysis?.plan ? { plan: blueprintForAnalysis.plan } : blueprintForAnalysis,
      executionPreferences,
      defaultValues,
      regions,
      additionalInstructions,
      executionContext,
    });
    updatedBlueprint = runtimeSettingsResult?.blueprint || null;
    emit("prep_phase_completed", {
      phase: "rewrite_blueprint",
      message: updatedBlueprint
        ? "Runtime settings were applied to the blueprint."
        : "No deterministic runtime-setting updates were needed.",
    });
  }

  return {
    status: "ready",
    question,
    executionContext,
    analysis,
    recommendation,
    updateStrategy,
    rewriteConfig,
    readOnlyResult,
    updatedBlueprint,
    validation,
  };
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
      console.log("[local workflowManager] request", {
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
        console.log("[local workflowManager] workflowStart accepted", {
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
        console.warn("[local workflowManager] missing workflowRunId", { eventType });
        return res.status(400).json({ ok: false, error: "workflowRunId is required" });
      }

      const existing = await store.getWorkflowRun(workflowRunId);
      if (!existing) {
        console.warn("[local workflowManager] workflow run not found", {
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
        console.log("[local workflowManager] workflowCancel completed", {
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
              console.warn("[local workflowManager] follow-up chat failed", {
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
        console.log("[local workflowManager] follow-up answered", {
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
      console.log("[local workflowManager] event recorded", {
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
          error: "Blueprint not found",
          planId,
        });
      }
      const title = blueprint?.title || req.body?.title || planId;
      console.log("[local /runAgentBackground] preflight starting", {
        planId,
        title,
        hasBlueprint: Boolean(blueprint),
        hasPlanPayload: Boolean(req.body?.plan),
        openAIConfigured: isLocalOpenAIConfigured(),
        configurationMode: runSettings.configurationMode,
        selectedWorkloadOrStack: runSettings.selectedWorkloadOrStack,
        regionCount: runSettings.regions.length,
      });
      const preflightResult = await runLocalBlueprintPreflight({
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
        onPrepEvent: (type, payload = {}) => {
          console.log("[local /runAgentBackground] preflight event", {
            type,
            phase: payload.phase || null,
            message: payload.message || null,
          });
        },
      });
      const effectivePlanPayload = preflightResult?.updatedBlueprint || req.body?.plan || null;
      const permissionProfileId =
        preflightResult?.rewriteConfig?.permissionProfileId ||
        authProfile?.permissionProfileId ||
        authProfile?.recordId ||
        authProfile?.id ||
        null;
      const preflightRecord = await store.createAgentHistoryRecord({
        itemId: planId,
        agentType: "agent",
        status: "running",
        title,
        parentId: req.body?.parentId || null,
        authProfile,
        settings: {
          ...inputSettings,
          localBackgroundPreflight: {
            status: preflightResult?.status || null,
            autoConfirmed: true,
            updatedBlueprint: Boolean(preflightResult?.updatedBlueprint),
            validationOk: preflightResult?.validation?.ok ?? null,
          },
        },
        updatedBlueprint: preflightResult?.updatedBlueprint || null,
        log: buildLocalBackgroundPreflightLog({
          blueprintId: planId,
          preflightResult,
          defaultValues: runSettings.defaultValues,
          regions: runSettings.regions,
          permissionProfileId,
        }),
      });
      console.log("[local /runAgentBackground] preflight complete", {
        planId,
        recordId: preflightRecord.recordId,
        status: preflightResult?.status || null,
        isReadOnly: preflightResult?.readOnlyResult?.isReadOnly ?? null,
        isMutating: preflightResult?.analysis?.isMutating ?? null,
        updatedBlueprint: Boolean(preflightResult?.updatedBlueprint),
        validationOk: preflightResult?.validation?.ok ?? null,
      });
      const executionMode = getBlueprintExecutionMode(blueprint, effectivePlanPayload, req.body || {});
      if (executionMode === "codex") {
        const phases = extractLocalPlanForSummary({ blueprint, planPayload: effectivePlanPayload }).phases;
        const localDataSnapshot = await buildCodexLocalDataSnapshot(store, {
          authProfile,
          selectedWorkloadOrStack: runSettings.selectedWorkloadOrStack,
        });
        const codexSettings = await getLocalCodexSettings(store);
        const codexSkillFiles = buildRuntimeCodexSkillFiles({
          blueprint,
          planPayload: effectivePlanPayload,
        });
        const codexResult = await runLocalCodexBlueprint({
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
          mcpUrl: buildLocalMcpUrl(req),
          recordId: preflightRecord.recordId,
          workspaceDir: codexSettings.workspaceDir,
          skillFiles: codexSkillFiles,
        });
        const now = new Date().toISOString();
        const logEntry = {
          taskId: "codex_blueprint_run",
          status: codexResult.status,
          output: codexResult.output,
          task_output: codexResult.output,
          executionMode: "codex",
          runner: "codex",
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
        const runSummary = buildRunSummaryObject({
          title,
          status: codexResult.status,
          output: codexResult.output,
        });
        const record = await store.updateAgentHistoryRecord(preflightRecord.recordId, {
          status: codexResult.status,
          executionMode: "codex",
          runner: "codex",
          log: {
            ...parseStoredJsonValue(preflightRecord.log, {}),
            executionMode: "codex",
            runner: "codex",
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
          executionMode: "codex",
          message: runSummary.summary,
        });
      }
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

  router.post("/agent/blueprint-evaluation", (_req, res) => {
    res.json({
      method_valid: true,
      message: {
        summary: "Local mode accepts this blueprint configuration method for tracking, but full execution validation is not implemented yet.",
        details: [],
      },
      raw: null,
      runtime: "local",
    });
  });

  router.post("/agent/blueprint-rewrite", async (req, res, next) => {
    try {
      const blueprintId = req.body?.blueprintId || req.body?.recordId || null;
      const blueprint = blueprintId ? await store.getBlueprint(blueprintId) : null;
      res.json({
        ok: true,
        runtime: "local",
        blueprintId,
        configurationMode: req.body?.configurationMode || "cli",
        plan: blueprint ? parseStoredJsonValue(blueprint.plan, {}) : null,
        message: "Local mode returned the saved blueprint without hosted rewrite.",
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
      const blueprint = blueprintId ? await store.getBlueprint(blueprintId) : null;
      const planPayload = req.body?.plan || null;
      const title = req.body?.plan?.title || req.body?.plan?.planTitle || blueprint?.title || blueprintId || "Local Agent";

      res.status(200);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.flushHeaders?.();
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
        sendAgentChunk(res, {
          type: "prep_started",
          phase: "analyze_blueprint_intent",
          message: "Preparing blueprint execution context.",
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
          onPrepEvent: (type, payload) => sendAgentChunk(res, { type, ...payload }),
        });

        if (!req.body?.preflightAnswer) {
          sendAgentChunk(res, {
            type: "prep_question",
            phase: "confirm_analysis",
            message: "Review the analysis outcomes before continuing with the rewrite.",
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
        const rewrittenBlueprintPayload = preflightResult.updatedBlueprint || null;
        if (rewrittenBlueprintPayload) {
          sendAgentChunk(res, { type: "blueprint_updated", blueprint: rewrittenBlueprintPayload });
        }
        sendAgentChunk(res, {
          type: "prep_ready",
          phase: preflightResult.validation ? "validate_rewrite" : "confirm_analysis",
          analysis: preflightResult.analysis || null,
          validation: preflightResult.validation || null,
        });
        if (existing) {
          const existingLog = parseStoredJsonValue(existing.log, {}) || {};
          await store.updateAgentHistoryRecord(recordId, {
            status: "running",
            authProfile: req.body?.authProfile || existing.authProfile || {},
            updatedBlueprint: rewrittenBlueprintPayload || existing.updatedBlueprint || null,
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
                executionContext: preflightResult.executionContext || null,
                analysis: preflightResult.analysis || null,
                recommendation: preflightResult.recommendation || null,
                updateStrategy: preflightResult.updateStrategy || null,
                rewriteConfig: preflightResult.rewriteConfig || null,
                validation: preflightResult.validation || null,
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
        if (executionMode === "codex") {
          sendAgentChunk(res, {
            type: "task_status_update",
            content: JSON.stringify({
              task_id: "codex_blueprint_run",
              status: "in-progress",
              task_output_summary_message: `Starting Codex session for "${title}".`,
              executionMode: "codex",
            }),
          });
          const codexSessionResult = await runLocalCodexBlueprintSession({
            req,
            store,
            recordId,
            blueprintId: blueprintId || req.body?.planId || recordId || "local-agent",
            blueprint,
            planPayload: rewrittenBlueprintPayload || planPayload,
            title,
            authProfile: authProfileForRun,
            regions: Array.isArray(req.body?.regions) ? req.body.regions : [],
            defaultValues: req.body?.defaultValues || {},
            executionPreferences: req.body?.executionPreferences || {},
            selectedWorkloadOrStack: req.body?.selectedWorkloadOrStack || null,
            preflightResult,
            onCodexEvent: (event) => {
              sendAgentChunk(res, { type: "codex_event", event });
            },
            onCodexStderr: (content) => {
              sendAgentChunk(res, { type: "codex_stderr", content });
            },
          });
          sendAgentChunk(res, {
            type: "message_in_progress",
            content: codexSessionResult.logEntry?.task_output || codexSessionResult.summary,
          });
          sendAgentChunk(res, {
            type: "task_status_update",
            content: JSON.stringify({
              task_id: "codex_blueprint_run",
              status: codexSessionResult.status,
              task_output_summary_message: codexSessionResult.logEntry?.task_output || codexSessionResult.summary,
              run_summary: codexSessionResult.runSummary,
              executionMode: "codex",
            }),
          });
          sendAgentChunk(res, {
            type: "message_end",
            recordId: codexSessionResult.recordId || recordId,
            status: codexSessionResult.recordStatus || codexSessionResult.status,
          });
          sendAgentChunk(res, { type: "completed" });
          return res.end();
        }
        sendAgentChunk(res, {
          type: "task_status_update",
          content: JSON.stringify({
            task_id: "agent_start",
            status: "complete",
            task_output_summary_message: `Local runner is ready to execute "${title}".`,
          }),
        });
        sendAgentChunk(res, {
          type: "message_end",
          recordId,
          status: "running",
        });
        sendAgentChunk(res, { type: "completed" });
        console.log("[local /agent] handshake complete", { recordId, blueprintId });
        return res.end();
      }
      const executionMode = getBlueprintExecutionMode(blueprint, planPayload, req.body || {});
      if (executionMode === "codex") {
        const authProfileForRun = parseStoredObject(req.body?.authProfile, {});
        const existingRunForPlan = recordId ? await store.getAgentHistoryRecord(recordId) : null;
        const storedUpdatedBlueprint = parseStoredJsonValue(existingRunForPlan?.updatedBlueprint, null);
        const effectivePlanPayload = storedUpdatedBlueprint || planPayload;
        sendAgentChunk(res, {
          type: "task_status_update",
          content: JSON.stringify({
            task_id: "codex_blueprint_run",
            status: "in-progress",
            task_output_summary_message: `Starting Codex session for "${title}".`,
            executionMode: "codex",
          }),
        });
        const codexTaskResult = await runLocalCodexBlueprintSession({
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
            sendAgentChunk(res, { type: "codex_event", event });
          },
          onCodexStderr: (content) => {
            sendAgentChunk(res, { type: "codex_stderr", content });
          },
        });
        sendAgentChunk(res, { type: "message_in_progress", content: codexTaskResult.logEntry?.task_output || codexTaskResult.summary });
        sendAgentChunk(res, {
          type: "task_status_update",
          content: JSON.stringify({
            task_id: "codex_blueprint_run",
            status: codexTaskResult.status,
            task_output_summary_message: codexTaskResult.logEntry?.task_output || codexTaskResult.summary,
            run_summary: codexTaskResult.runSummary,
            executionMode: "codex",
          }),
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
            sendAgentChunk(res, { type: "message_in_progress", content: token });
          },
        });
        if (llmResult) {
          for (const commandOutput of Array.isArray(llmResult.cliOutputs)
            ? llmResult.cliOutputs
            : []) {
            sendAgentChunk(res, {
              type: "cli_command_output",
              cli_command: commandOutput.command || commandOutput.cli_command,
              cli_command_output: commandOutput.output || "",
              statusCode: commandOutput.statusCode || 400,
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
          sendAgentChunk(res, {
            type: "task_status_update",
            content: JSON.stringify({
              task_id: llmResult.logEntry?.taskId || req.body?.task?.id || req.body?.task?.task_id,
              status: llmResult.status,
              task_output_summary_message: llmResult.logEntry?.task_output || llmResult.summary,
              run_summary: llmResult.runSummary,
            }),
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
        onTaskResult: async ({ task, logEntry, runSummary }) => {
          for (const commandOutput of Array.isArray(logEntry.cli_command_output)
            ? logEntry.cli_command_output
            : []) {
            sendAgentChunk(res, {
              type: "cli_command_output",
              cli_command: commandOutput.command || commandOutput.cli_command,
              cli_command_output: commandOutput.output || "",
              statusCode: commandOutput.statusCode || 400,
            });
          }
          sendAgentChunk(res, {
            type: "task_status_update",
            content: JSON.stringify({
              task_id: task.id,
              status: logEntry.status,
              task_output_summary_message: logEntry.task_output,
              run_summary: runSummary,
            }),
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
      sendAgentChunk(res, { type: "message_in_progress", content: result.summary });
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
