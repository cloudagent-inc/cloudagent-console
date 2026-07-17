import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildEnabledEngineSelection,
  normalizeEngineFinding,
} from "./guardrail-normalization.mjs";

const activeRoots = new Set();
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_OUTPUT_LIMIT = 2 * 1024 * 1024;

function text(value) {
  return String(value ?? "").trim();
}

function unique(values = []) {
  return [...new Set(values.map(text).filter(Boolean))];
}

function failure(code, message, details = {}) {
  return { ok: false, status: "error", error: { code, message }, ...details };
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function resolveContainedDirectory(repoPath, relativePath) {
  let repository;
  try {
    repository = await fs.realpath(path.resolve(repoPath));
  } catch {
    const error = new Error("The configured local repository checkout does not exist.");
    error.code = "repo_path_missing";
    throw error;
  }
  const requested = path.resolve(repository, text(relativePath) || ".");
  let resolved;
  try {
    resolved = await fs.realpath(requested);
  } catch {
    const error = new Error("The configured Terraform root does not exist in the repository.");
    error.code = "root_not_found";
    throw error;
  }
  if (!isWithin(repository, resolved)) {
    const error = new Error("Terraform root resolves outside the repository checkout.");
    error.code = "root_outside_repository";
    throw error;
  }
  const stat = await fs.stat(resolved);
  if (!stat.isDirectory()) {
    const error = new Error("Terraform root is not a directory.");
    error.code = "invalid_root";
    throw error;
  }
  return { repository, root: resolved };
}

async function resolveVarFiles(root, values = []) {
  const files = [];
  for (const value of values || []) {
    const requested = path.resolve(root, text(value));
    const resolved = await fs.realpath(requested);
    if (!isWithin(root, resolved)) {
      const error = new Error(`Variable file resolves outside the Terraform root: ${value}`);
      error.code = "var_file_outside_root";
      throw error;
    }
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) {
      const error = new Error(`Variable file is not a file: ${value}`);
      error.code = "invalid_var_file";
      throw error;
    }
    files.push(resolved);
  }
  return files;
}

async function detectBackendTypes(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const backendTypes = new Set();
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".tf")) continue;
    const source = await fs.readFile(path.join(root, entry.name), "utf8");
    for (const match of source.matchAll(/\bbackend\s+"([^"]+)"\s*\{/g)) {
      backendTypes.add(text(match[1]).toLowerCase());
    }
  }
  return [...backendTypes];
}

export function buildTerraformExecutionEnv({ baseEnv = process.env, credentialEnv = {}, tempDir, workspace } = {}) {
  const env = { ...baseEnv, ...credentialEnv };
  for (const key of Object.keys(env)) {
    if (/^TF_CLI_ARGS(?:_|$)/i.test(key) || /^TF_LOG(?:_|$)/i.test(key) || /^TF_VAR_/i.test(key)) {
      delete env[key];
    }
  }
  delete env.TF_WORKSPACE;
  env.TF_IN_AUTOMATION = "1";
  env.TF_INPUT = "0";
  env.TF_DATA_DIR = path.join(tempDir, "terraform-data");
  env.TF_PLUGIN_CACHE_DIR = path.join(tempDir, "plugin-cache");
  env.TRIVY_CACHE_DIR = path.join(tempDir, "trivy-cache");
  if (text(workspace)) env.TF_WORKSPACE = text(workspace);
  return env;
}

export function runBoundedCommand(command, args = [], {
  cwd,
  env,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  outputLimit = DEFAULT_OUTPUT_LIMIT,
} = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let timedOut = false;
    let outputExceeded = false;
    let closed = false;
    const append = (current, chunk) => {
      const next = Buffer.concat([current, Buffer.from(chunk)]);
      if (next.length <= outputLimit) return next;
      outputExceeded = true;
      child.kill("SIGKILL");
      return next.subarray(0, outputLimit);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout?.on("data", (chunk) => { stdout = append(stdout, chunk); });
    child.stderr?.on("data", (chunk) => { stderr = append(stderr, chunk); });
    child.on("error", (error) => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      resolve({ code: null, stdout: "", stderr: error?.message || String(error), error, timedOut, outputExceeded });
    });
    child.on("close", (code) => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      resolve({
        code,
        stdout: stdout.toString("utf8"),
        stderr: stderr.toString("utf8"),
        timedOut,
        outputExceeded,
      });
    });
  });
}

function commandFailure(stage, result) {
  if (result?.error?.code === "ENOENT") {
    return failure(`${stage}_binary_missing`, `${stage === "trivy" ? "Trivy" : "Terraform/OpenTofu"} executable was not found.`);
  }
  if (result?.timedOut) return failure(`${stage}_timeout`, `${stage} timed out.`);
  if (result?.outputExceeded) return failure(`${stage}_output_limit`, `${stage} exceeded the output limit.`);
  return failure(`${stage}_failed`, `${stage} failed.`, {
    diagnostics: text(result?.stderr || result?.stdout).slice(0, 8_000) || null,
  });
}

export function summarizeTerraformPlan(plan = {}) {
  const changedAddresses = [];
  const counts = { add: 0, change: 0, replace: 0, destroy: 0, noOp: 0 };
  for (const change of plan?.resource_changes || []) {
    const actions = Array.isArray(change?.change?.actions) ? change.change.actions : [];
    const address = text(change?.address);
    const creates = actions.includes("create");
    const deletes = actions.includes("delete");
    const updates = actions.includes("update");
    if (creates && deletes) counts.replace += 1;
    else if (creates) counts.add += 1;
    else if (updates) counts.change += 1;
    else if (deletes) counts.destroy += 1;
    else counts.noOp += 1;
    if (address && (creates || updates)) changedAddresses.push(address);
  }
  return { counts, changedAddresses: unique(changedAddresses) };
}

function trivyRuleIds(misconfiguration = {}) {
  return unique([
    misconfiguration.ID,
    misconfiguration.AVDID,
    misconfiguration.RuleID,
    ...(Array.isArray(misconfiguration.Aliases) ? misconfiguration.Aliases : []),
  ]).map((value) => value.toUpperCase());
}

function trivyAddress(result = {}, misconfiguration = {}) {
  const metadata = misconfiguration.CauseMetadata || {};
  const candidate = text(
    (typeof metadata.Resource === "string" ? metadata.Resource : "") ||
    metadata.ResourceName ||
    metadata.Address ||
    (typeof misconfiguration.Resource === "string" ? misconfiguration.Resource : "")
  );
  if (!candidate || candidate.includes("/") || candidate.includes("\\")) return "";
  return /^(?:module\.[^.]+\.)*(?:data\.)?[a-z0-9_]+\.[a-zA-Z0-9_\[\]"'-]+$/.test(candidate)
    ? candidate
    : "";
}

export function normalizeTrivyPlanFindings({
  report = {},
  catalog = {},
  securityRules = {},
  enabledCheckIds = [],
  changedAddresses = [],
} = {}) {
  const enabled = new Set(enabledCheckIds.map((value) => text(value).toUpperCase()));
  const changed = new Set(changedAddresses);
  const findings = [];
  for (const result of report?.Results || []) {
    for (const item of result?.Misconfigurations || []) {
      const matchedId = trivyRuleIds(item).find((id) => enabled.has(id));
      if (!matchedId) continue;
      const address = trivyAddress(result, item);
      const normalized = normalizeEngineFinding({
        catalog,
        securityRules,
        engine: "trivy",
        engineRuleId: matchedId,
        finding: {
          title: text(item.Title) || null,
          message: text(item.Message || item.Description) || null,
          address: address || null,
          sourceSeverity: text(item.Severity).toLowerCase() || "unknown",
          status: text(item.Status).toLowerCase() || "failed",
        },
      });
      if (!normalized) continue;
      const scope = catalog.rules.find((rule) => rule.id === normalized.policyId)
        ?.enforcement?.terraform?.scope || "resource";
      if (scope === "resource" && address && changed.size && !changed.has(address)) continue;
      findings.push({ ...normalized, scope, changedResource: address ? changed.has(address) : null });
    }
  }
  return findings;
}

export async function runTerraformPlanCheck({
  repoPath,
  root,
  credentialEnv = {},
  catalog = { rules: [] },
  securityRules = {},
  terraformBinary = "terraform",
  trivyBinary = "trivy",
  commandRunner = runBoundedCommand,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  let tempDir = null;
  let canonicalRoot = null;
  try {
    if (!repoPath) return failure("repository_not_configured", "A local repository checkout is required.");
    if (!root?.rootPath) return failure("terraform_root_not_configured", "A Terraform root module must be configured.");
    const contained = await resolveContainedDirectory(repoPath, root.rootPath);
    canonicalRoot = contained.root;
    if (activeRoots.has(canonicalRoot)) {
      return failure("checkout_busy", "A Terraform validation is already running for this root module.");
    }
    activeRoots.add(canonicalRoot);
    const varFiles = await resolveVarFiles(canonicalRoot, root.varFiles || []);
    const backendTypes = await detectBackendTypes(canonicalRoot);
    if (backendTypes.length > 1) {
      return failure("backend_ambiguous", "Multiple Terraform backend types were found in the configured root.");
    }
    const detectedBackend = backendTypes[0] || "local";
    if (!new Set(["local", "s3"]).has(detectedBackend)) {
      return failure("backend_unsupported", `Terraform backend '${detectedBackend}' is not supported by the local plan check.`);
    }
    if (root.backendType && root.backendType !== detectedBackend) {
      return failure(
        "backend_hint_mismatch",
        `The workload expects backend '${root.backendType}', but the Terraform root declares '${detectedBackend}'.`
      );
    }
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cloudagent-terraform-"));
    await fs.chmod(tempDir, 0o700);
    await fs.mkdir(path.join(tempDir, "terraform-data"), { recursive: true });
    await fs.mkdir(path.join(tempDir, "plugin-cache"), { recursive: true });
    await fs.mkdir(path.join(tempDir, "trivy-cache"), { recursive: true });
    const env = buildTerraformExecutionEnv({ credentialEnv, tempDir, workspace: root.workspace });
    const runnerOptions = { cwd: canonicalRoot, env, timeoutMs };
    const gitHead = await commandRunner("git", ["rev-parse", "HEAD"], runnerOptions);
    if (gitHead.code !== 0) {
      return failure("not_git_repository", "The configured checkout is not a Git repository.");
    }
    const gitStatus = await commandRunner("git", ["status", "--porcelain"], runnerOptions);
    if (gitStatus.code !== 0) return commandFailure("git_status", gitStatus);
    const init = await commandRunner(
      terraformBinary,
      ["init", "-input=false", "-no-color", "-lockfile=readonly"],
      runnerOptions
    );
    if (init.code !== 0) return commandFailure("terraform_init", init);

    const planPath = path.join(tempDir, "tf.plan");
    const planArgs = [
      "plan",
      "-lock=false",
      "-input=false",
      "-no-color",
      "-detailed-exitcode",
      `-out=${planPath}`,
      ...varFiles.map((file) => `-var-file=${file}`),
    ];
    const planResult = await commandRunner(terraformBinary, planArgs, runnerOptions);
    if (![0, 2].includes(planResult.code)) return commandFailure("terraform_plan", planResult);
    const show = await commandRunner(terraformBinary, ["show", "-json", planPath], runnerOptions);
    if (show.code !== 0) return commandFailure("terraform_show", show);
    let planJson;
    try {
      planJson = JSON.parse(show.stdout);
    } catch {
      return failure("terraform_show_invalid_json", "Terraform returned invalid plan JSON.");
    }
    const summary = summarizeTerraformPlan(planJson);
    const selection = buildEnabledEngineSelection({ catalog, securityRules });
    const terraformLimited = selection.surfaceLimited.filter((item) => !item.terraform);
    let findings = [];
    if (selection.trivyCheckIds.length) {
      const planJsonPath = path.join(tempDir, "tfplan.json");
      await fs.writeFile(planJsonPath, JSON.stringify(planJson), { mode: 0o600 });
      const trivy = await commandRunner(
        trivyBinary,
        ["config", "--format", "json", "--exit-code", "0", "--disable-telemetry", "--skip-version-check", planJsonPath],
        runnerOptions
      );
      if (trivy.code !== 0) return commandFailure("trivy", trivy);
      let report;
      try {
        report = JSON.parse(trivy.stdout || "{}");
      } catch {
        return failure("trivy_invalid_json", "Trivy returned invalid JSON.");
      }
      findings = normalizeTrivyPlanFindings({
        report,
        catalog,
        securityRules,
        enabledCheckIds: selection.trivyCheckIds,
        changedAddresses: summary.changedAddresses,
      });
    }
    const requiresConfirmation = findings.some((finding) => finding.disposition === "require_confirmation");
    const coverageComplete = terraformLimited.length === 0;
    return {
      ok: coverageComplete,
      status: !coverageComplete
        ? "coverage_incomplete"
        : requiresConfirmation
          ? "needs_confirmation"
          : findings.length
            ? "warnings"
            : "passed",
      engine: root.type === "opentofu" ? "opentofu" : "terraform",
      rootId: root.id || null,
      workspace: text(root.workspace) || null,
      backendType: detectedBackend,
      checkout: {
        commitSha: text(gitHead.stdout),
        dirty: Boolean(text(gitStatus.stdout)),
      },
      plan: {
        hasChanges: planResult.code === 2,
        ...summary,
      },
      policy: {
        enabledPolicyIds: selection.policyIds,
        evaluatedTrivyCheckIds: selection.trivyPrimaryCheckIds,
        coverageComplete,
        unmappedPolicyIds: terraformLimited.map((item) => item.policyId),
      },
      findings,
    };
  } catch (error) {
    return failure(error?.code || "terraform_plan_check_failed", error?.message || String(error));
  } finally {
    if (canonicalRoot) activeRoots.delete(canonicalRoot);
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
