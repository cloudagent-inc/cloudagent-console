// GitHub governance + branch-protection verification service. Backs the
// /github Express routes. CloudAgent only VERIFIES branch protection; it
// never modifies protection settings.

import { runCommand, createGithubGovernanceResolver } from "../cloudagent/cloudagent-tools.mjs";
import { getLocalIacToolSettings } from "../settings/settings-service.mjs";

function parseFullName(repoFullName) {
  const text = String(repoFullName || "").trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
  const [owner, repo] = text.split("/", 2).map((part) => String(part || "").trim());
  if (!owner || !repo) return null;
  return { owner, repo };
}

function parseJson(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function createGithubService({ store, commandRunner = runCommand, getToolSettings = null } = {}) {
  if (!store) throw new Error("createGithubService requires a store");
  const resolveToolSettings = getToolSettings || (() => getLocalIacToolSettings(store));
  const { resolveGithubGovernance } = createGithubGovernanceResolver({
    store,
    getToolSettings: resolveToolSettings,
    commandRunner,
  });
  const statusCache = new Map();

  async function ghBinary() {
    const settings = typeof resolveToolSettings === "function" ? await resolveToolSettings() : {};
    return settings.githubBinary || "gh";
  }

  async function getEffectiveGovernance({ workloadId = null, repoFullName = null } = {}) {
    const resolved = await resolveGithubGovernance({ args: { repoFullName, workloadId } });
    if (resolved.ok === false) return resolved;
    let defaultBranch = resolved.defaultBranch || null;
    if (!defaultBranch) {
      const parsed = parseFullName(repoFullName);
      if (parsed) defaultBranch = await resolveDefaultBranch({ repoFullName, workloadId, parsed });
    }
    return {
      ok: true,
      repoFullName: resolved.repoFullName || repoFullName || null,
      defaultBranch,
      github: resolved.github,
      source: resolved.githubGovernanceSource,
      workloadId: resolved.workloadId || null,
    };
  }

  async function resolveDefaultBranch({ repoFullName, workloadId, parsed }) {
    const governance = await resolveGithubGovernance({ args: { repoFullName, workloadId } }).catch(() => null);
    if (governance?.ok && governance.defaultBranch) return governance.defaultBranch;
    const gh = await ghBinary();
    const view = await commandRunner(gh, ["api", `repos/${parsed.owner}/${parsed.repo}`, "--jq", ".default_branch"]);
    if (view.statusCode === 200) {
      const name = String(view.stdout || "").trim();
      if (name) return name;
    }
    return null;
  }

  async function verifyBranchProtection({ repoFullName, workloadId = null } = {}) {
    const parsed = parseFullName(repoFullName);
    const checkedAt = new Date().toISOString();
    if (!parsed) {
      const result = {
        ok: true,
        repoFullName: repoFullName || null,
        defaultBranch: null,
        protected: null,
        requiresPullRequest: null,
        method: null,
        checkedAt,
        error: { code: "invalid_repo_full_name", message: "repoFullName must be in the form owner/repo." },
      };
      if (repoFullName) statusCache.set(repoFullName, result);
      return result;
    }

    const defaultBranch = await resolveDefaultBranch({ repoFullName, workloadId, parsed });
    if (!defaultBranch) {
      const result = {
        ok: true,
        repoFullName,
        defaultBranch: null,
        protected: null,
        requiresPullRequest: null,
        method: null,
        checkedAt,
        error: { code: "default_branch_unknown", message: "Could not determine the repository default branch." },
      };
      statusCache.set(repoFullName, result);
      return result;
    }

    const gh = await ghBinary();
    // 1. Classic branch protection.
    const protection = await commandRunner(gh, [
      "api",
      `repos/${parsed.owner}/${parsed.repo}/branches/${defaultBranch}/protection`,
    ]);
    if (protection.statusCode === 200) {
      const parsedProtection = parseJson(protection.stdout, {}) || {};
      const requiresPullRequest = Boolean(parsedProtection.required_pull_request_reviews);
      const result = {
        ok: true,
        repoFullName,
        defaultBranch,
        protected: true,
        requiresPullRequest,
        method: "branch_protection",
        checkedAt,
        error: null,
      };
      statusCache.set(repoFullName, result);
      return result;
    }

    // 2. Rulesets fallback (fine-grained repository rules applied to the branch).
    const rules = await commandRunner(gh, [
      "api",
      `repos/${parsed.owner}/${parsed.repo}/rules/branches/${defaultBranch}`,
    ]);
    if (rules.statusCode === 200) {
      const parsedRules = parseJson(rules.stdout, []) || [];
      const ruleList = Array.isArray(parsedRules) ? parsedRules : [];
      const requiresPullRequest = ruleList.some((rule) => String(rule?.type) === "pull_request");
      const isProtected = ruleList.length > 0;
      const result = {
        ok: true,
        repoFullName,
        defaultBranch,
        protected: isProtected,
        requiresPullRequest: isProtected ? requiresPullRequest : false,
        method: isProtected ? "rulesets" : null,
        checkedAt,
        error: null,
      };
      statusCache.set(repoFullName, result);
      return result;
    }

    // Classic protection returns 404 when the branch is unprotected and the
    // caller has admin scope; treat that as a definitive "not protected".
    const combined = `${protection.stdout || ""}\n${protection.stderr || ""}`;
    if (/not protected|404|Branch not protected/i.test(combined)) {
      const result = {
        ok: true,
        repoFullName,
        defaultBranch,
        protected: false,
        requiresPullRequest: false,
        method: null,
        checkedAt,
        error: null,
      };
      statusCache.set(repoFullName, result);
      return result;
    }

    const result = {
      ok: true,
      repoFullName,
      defaultBranch,
      protected: null,
      requiresPullRequest: null,
      method: null,
      checkedAt,
      error: {
        code: "verification_failed",
        message: String(protection.stderr || rules.stderr || "Could not verify branch protection.").slice(0, 500),
      },
    };
    statusCache.set(repoFullName, result);
    return result;
  }

  function getBranchProtectionStatus({ repoFullName } = {}) {
    if (repoFullName && statusCache.has(repoFullName)) {
      return statusCache.get(repoFullName);
    }
    return { ok: true, checked: false };
  }

  return {
    getEffectiveGovernance,
    verifyBranchProtection,
    getBranchProtectionStatus,
  };
}
