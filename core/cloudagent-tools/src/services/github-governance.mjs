// Deterministic GitHub tool governance: secure defaults, inheritance
// resolution (global -> environment -> workload), path scoping, secret
// scanning, and branch-name helpers. Pure logic only so it can be unit
// tested and reused by both the MCP tools and the Express verify routes.

export const SECURE_GITHUB_DEFAULTS = Object.freeze({
  mode: "pr_only", // "pr_only" | "unrestricted"
  protectedBranches: ["main", "master"],
  branchPrefix: "cloudagent/",
  allowBranchReset: "prefix_only", // "prefix_only" | "never" | "always"
  draftPrs: true,
  pathScope: {
    mode: "iac_roots", // "iac_roots" | "any"
    additionalAllow: [],
    deny: [".github/workflows/**", "**/*.tfstate", "**/.env*"],
  },
  secretScan: true,
  strictReads: false,
  limits: { maxFilesPerPr: 50, maxDiffKb: 512, allowBinary: false },
  attribution: { coAuthorTrailer: true, prLabel: "cloudagent" },
});

export const CO_AUTHOR_TRAILER = "Co-Authored-By: CloudAgent <noreply@cloudagent.dev>";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneConfig(value) {
  return JSON.parse(JSON.stringify(value));
}

// Field-level deep merge: nested plain objects merge recursively, every
// other value (including arrays) is replaced by the override.
export function deepMergeGithubConfig(base, override) {
  if (override === undefined || override === null) return base;
  if (!isPlainObject(override)) return override;
  const out = isPlainObject(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    out[key] = isPlainObject(value) && isPlainObject(out[key])
      ? deepMergeGithubConfig(out[key], value)
      : value;
  }
  return out;
}

// Resolve the effective github config down the inheritance chain and
// report which level was the most specific contributor.
export function resolveGithubGovernanceConfig({
  globalGithub = null,
  environmentGithub = null,
  workloadGithub = null,
} = {}) {
  let github = cloneConfig(SECURE_GITHUB_DEFAULTS);
  let source = "default";
  if (isPlainObject(globalGithub) && Object.keys(globalGithub).length) {
    github = deepMergeGithubConfig(github, globalGithub);
    source = "global";
  }
  if (isPlainObject(environmentGithub) && Object.keys(environmentGithub).length) {
    github = deepMergeGithubConfig(github, environmentGithub);
    source = "environment";
  }
  if (isPlainObject(workloadGithub) && Object.keys(workloadGithub).length) {
    github = deepMergeGithubConfig(github, workloadGithub);
    source = "workload";
  }
  return { github, source };
}

function normalizeBranch(value) {
  return String(value ?? "").trim();
}

// Union the configured protected branches with the detected repo default
// branch (spec: "union with detected repo default branch").
export function unionProtectedBranches(protectedBranches = [], defaultBranch = null) {
  const set = new Set(
    (Array.isArray(protectedBranches) ? protectedBranches : [])
      .map(normalizeBranch)
      .filter(Boolean)
  );
  const detected = normalizeBranch(defaultBranch);
  if (detected) set.add(detected);
  return [...set];
}

export function isProtectedBranch(branch, protectedBranches = []) {
  const target = normalizeBranch(branch);
  if (!target) return false;
  return (Array.isArray(protectedBranches) ? protectedBranches : [])
    .map(normalizeBranch)
    .includes(target);
}

// --- Branch prefix helpers -------------------------------------------------

export function slugifyBranchName(name) {
  const slug = String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, "-")
    .replace(/\/+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return slug || "change";
}

export function hasBranchPrefix(branch, prefix) {
  const normalizedPrefix = normalizeBranch(prefix);
  if (!normalizedPrefix) return true;
  return normalizeBranch(branch).startsWith(normalizedPrefix);
}

export function suggestPrefixedBranch(branch, prefix) {
  const normalizedPrefix = normalizeBranch(prefix);
  const raw = normalizeBranch(branch);
  const withoutPrefix = normalizedPrefix && raw.startsWith(normalizedPrefix)
    ? raw.slice(normalizedPrefix.length)
    : raw;
  return `${normalizedPrefix}${slugifyBranchName(withoutPrefix)}`;
}

// --- Secret scanning -------------------------------------------------------
// Return only the pattern NAME on a hit, never the matched value.

const SECRET_PATTERNS = [
  { name: "aws_access_key_id", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "private_key_block", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "github_personal_access_token", regex: /ghp_[A-Za-z0-9]{36,}/ },
  { name: "github_fine_grained_pat", regex: /github_pat_[A-Za-z0-9_]{20,}/ },
  { name: "openai_api_key", regex: /sk-[A-Za-z0-9_-]{20,}/ },
  { name: "aws_secret_access_key", regex: /aws.{0,20}['"][0-9a-zA-Z/+]{40}['"]/i },
];

export function scanForSecrets(content) {
  const text = String(content ?? "");
  for (const { name, regex } of SECRET_PATTERNS) {
    if (regex.test(text)) return { pattern: name };
  }
  return null;
}

// --- Path scoping ----------------------------------------------------------

function globToRegExp(glob) {
  const normalized = String(glob ?? "").replace(/\\/g, "/");
  let out = "";
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (char === "*") {
      if (normalized[i + 1] === "*") {
        i += 1;
        if (normalized[i + 1] === "/") {
          i += 1;
          out += "(?:.*/)?";
        } else {
          out += ".*";
        }
      } else {
        out += "[^/]*";
      }
    } else if (char === "?") {
      out += "[^/]";
    } else if (".+^${}()|[]\\".includes(char)) {
      out += `\\${char}`;
    } else {
      out += char;
    }
  }
  return new RegExp(`^${out}$`);
}

export function matchesGlob(glob, relativePath) {
  try {
    return globToRegExp(glob).test(String(relativePath ?? ""));
  } catch {
    return false;
  }
}

function normalizeRoot(root) {
  return String(root ?? "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+|\/+$/g, "")
    .trim();
}

function isUnderRoot(root, relativePath) {
  const normalizedRoot = normalizeRoot(root);
  if (!normalizedRoot || normalizedRoot === ".") return true;
  const target = String(relativePath ?? "").replace(/^\/+/, "");
  return target === normalizedRoot || target.startsWith(`${normalizedRoot}/`);
}

// Evaluate a repo-relative write path against the effective path scope.
// Deny globs ALWAYS apply, even in mode "any". In mode "iac_roots" with no
// declared roots we degrade gracefully to allow-with-deny-globs.
export function evaluatePathScope({ relativePath, github = {}, iacRoots = [] } = {}) {
  const pathScope = isPlainObject(github?.pathScope) ? github.pathScope : {};
  const deny = Array.isArray(pathScope.deny) ? pathScope.deny : [];
  for (const glob of deny) {
    if (matchesGlob(glob, relativePath)) {
      return { allowed: false, code: "path_denied", reason: "deny_glob", matchedDeny: glob, pathScopeMode: pathScope.mode || "iac_roots" };
    }
  }
  const mode = pathScope.mode === "any" ? "any" : "iac_roots";
  const additionalAllow = Array.isArray(pathScope.additionalAllow) ? pathScope.additionalAllow : [];
  if (mode === "any") {
    return { allowed: true, pathScopeMode: "any" };
  }
  const roots = (Array.isArray(iacRoots) ? iacRoots : [])
    .map(normalizeRoot)
    .filter(Boolean);
  if (!roots.length) {
    return { allowed: true, pathScopeMode: "any (no iac roots declared)" };
  }
  const allowed = roots.some((root) => isUnderRoot(root, relativePath)) ||
    additionalAllow.some((glob) => matchesGlob(glob, relativePath));
  if (allowed) {
    return { allowed: true, pathScopeMode: "iac_roots", allowedRoots: roots };
  }
  return { allowed: false, code: "path_denied", reason: "not_in_iac_roots", allowedRoots: roots, pathScopeMode: "iac_roots" };
}

// Extract declared IaC root paths from a workload deploymentPreferences.
export function extractIacRoots(deploymentPreferences = {}) {
  const roots = Array.isArray(deploymentPreferences?.iac?.roots)
    ? deploymentPreferences.iac.roots
    : [];
  return roots
    .map((root) => (typeof root === "string" ? root : root?.rootPath || root?.path || root?.dir))
    .map(normalizeRoot)
    .filter(Boolean);
}

// Structured guardrail refusal matching the terraform_plan_check convention.
export function guardrailRefusal(code, message, extras = {}) {
  return {
    ok: false,
    error: {
      code,
      message,
      actor: "agent",
      retryable: false,
      ...extras,
    },
  };
}
