import assert from "node:assert/strict";
import test from "node:test";

import {
  SECURE_GITHUB_DEFAULTS,
  resolveGithubGovernanceConfig,
  deepMergeGithubConfig,
  unionProtectedBranches,
  isProtectedBranch,
  hasBranchPrefix,
  suggestPrefixedBranch,
  slugifyBranchName,
  scanForSecrets,
  evaluatePathScope,
  extractIacRoots,
  matchesGlob,
} from "../src/services/github-governance.mjs";

test("secure defaults are pr_only with protected branches and iac_roots scope", () => {
  assert.equal(SECURE_GITHUB_DEFAULTS.mode, "pr_only");
  assert.deepEqual(SECURE_GITHUB_DEFAULTS.protectedBranches, ["main", "master"]);
  assert.equal(SECURE_GITHUB_DEFAULTS.branchPrefix, "cloudagent/");
  assert.equal(SECURE_GITHUB_DEFAULTS.allowBranchReset, "prefix_only");
  assert.equal(SECURE_GITHUB_DEFAULTS.pathScope.mode, "iac_roots");
  assert.equal(SECURE_GITHUB_DEFAULTS.secretScan, true);
  assert.equal(SECURE_GITHUB_DEFAULTS.strictReads, false);
});

test("resolveGithubGovernanceConfig reports the default source with no overrides", () => {
  const { github, source } = resolveGithubGovernanceConfig({});
  assert.equal(source, "default");
  assert.equal(github.mode, "pr_only");
  // returns a clone, not the frozen defaults
  github.mode = "unrestricted";
  assert.equal(SECURE_GITHUB_DEFAULTS.mode, "pr_only");
});

test("resolveGithubGovernanceConfig merges field-level down global -> environment -> workload", () => {
  const { github, source } = resolveGithubGovernanceConfig({
    globalGithub: { branchPrefix: "global/", draftPrs: false },
    environmentGithub: { branchPrefix: "env/", limits: { maxFilesPerPr: 10 } },
    workloadGithub: { mode: "unrestricted" },
  });
  assert.equal(source, "workload");
  assert.equal(github.mode, "unrestricted"); // from workload
  assert.equal(github.branchPrefix, "env/"); // environment overrides global
  assert.equal(github.draftPrs, false); // from global, untouched
  assert.equal(github.limits.maxFilesPerPr, 10); // deep-merged from environment
  assert.equal(github.limits.maxDiffKb, 512); // default preserved
});

test("resolveGithubGovernanceConfig source reflects the most specific contributor", () => {
  assert.equal(resolveGithubGovernanceConfig({ globalGithub: { draftPrs: false } }).source, "global");
  assert.equal(resolveGithubGovernanceConfig({ environmentGithub: { draftPrs: false } }).source, "environment");
  assert.equal(resolveGithubGovernanceConfig({ workloadGithub: { draftPrs: false } }).source, "workload");
  assert.equal(resolveGithubGovernanceConfig({ workloadGithub: {} }).source, "default");
});

test("deepMergeGithubConfig replaces arrays but merges nested objects", () => {
  const merged = deepMergeGithubConfig(
    { protectedBranches: ["main"], limits: { a: 1, b: 2 } },
    { protectedBranches: ["dev"], limits: { b: 3 } }
  );
  assert.deepEqual(merged.protectedBranches, ["dev"]);
  assert.deepEqual(merged.limits, { a: 1, b: 3 });
});

test("unionProtectedBranches folds the detected default branch in without duplicates", () => {
  assert.deepEqual(unionProtectedBranches(["main", "master"], "main"), ["main", "master"]);
  assert.deepEqual(unionProtectedBranches(["main"], "develop"), ["main", "develop"]);
  assert.deepEqual(unionProtectedBranches(["main"], null), ["main"]);
});

test("isProtectedBranch matches configured branches only", () => {
  assert.equal(isProtectedBranch("main", ["main", "master"]), true);
  assert.equal(isProtectedBranch("cloudagent/x", ["main"]), false);
});

test("branch prefix helpers detect and suggest prefixed names", () => {
  assert.equal(hasBranchPrefix("cloudagent/fix", "cloudagent/"), true);
  assert.equal(hasBranchPrefix("fix", "cloudagent/"), false);
  assert.equal(hasBranchPrefix("anything", ""), true);
  assert.equal(suggestPrefixedBranch("Fix The Bug!", "cloudagent/"), "cloudagent/fix-the-bug");
  assert.equal(suggestPrefixedBranch("feature/new thing", "cloudagent/"), "cloudagent/feature-new-thing");
  assert.equal(slugifyBranchName("  "), "change");
});

test("scanForSecrets returns the pattern name and never the matched value", () => {
  assert.equal(scanForSecrets("nothing here"), null);
  assert.deepEqual(scanForSecrets("AKIAIOSFODNN7EXAMPLE"), { pattern: "aws_access_key_id" });
  assert.deepEqual(scanForSecrets("-----BEGIN RSA PRIVATE KEY-----"), { pattern: "private_key_block" });
  assert.deepEqual(scanForSecrets(`ghp_${"a".repeat(36)}`), { pattern: "github_personal_access_token" });
  assert.deepEqual(scanForSecrets(`github_pat_${"a".repeat(22)}`), { pattern: "github_fine_grained_pat" });
  assert.deepEqual(scanForSecrets(`sk-${"a".repeat(24)}`), { pattern: "openai_api_key" });
  const secretValue = `aws_secret_access_key="${"a".repeat(40)}"`;
  const hit = scanForSecrets(secretValue);
  assert.equal(hit.pattern, "aws_secret_access_key");
  assert.equal(JSON.stringify(hit).includes("a".repeat(40)), false);
});

test("matchesGlob understands the deny-glob patterns", () => {
  assert.equal(matchesGlob(".github/workflows/**", ".github/workflows/ci.yml"), true);
  assert.equal(matchesGlob("**/*.tfstate", "infra/prod/terraform.tfstate"), true);
  assert.equal(matchesGlob("**/.env*", ".env.local"), true);
  assert.equal(matchesGlob("**/.env*", "src/app/.env"), true);
  assert.equal(matchesGlob("**/*.tfstate", "main.tf"), false);
});

test("evaluatePathScope deny globs always apply, even in mode any", () => {
  const github = { pathScope: { mode: "any", deny: [".github/workflows/**"] } };
  const denied = evaluatePathScope({ relativePath: ".github/workflows/deploy.yml", github });
  assert.equal(denied.allowed, false);
  assert.equal(denied.code, "path_denied");
  assert.equal(denied.matchedDeny, ".github/workflows/**");

  const allowed = evaluatePathScope({ relativePath: "src/index.js", github });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.pathScopeMode, "any");
});

test("evaluatePathScope in iac_roots restricts to declared roots plus additionalAllow", () => {
  const github = { pathScope: { mode: "iac_roots", deny: [], additionalAllow: ["docs/**"] } };
  const iacRoots = ["infra/prod"];
  assert.equal(evaluatePathScope({ relativePath: "infra/prod/main.tf", github, iacRoots }).allowed, true);
  assert.equal(evaluatePathScope({ relativePath: "docs/readme.md", github, iacRoots }).allowed, true);
  const denied = evaluatePathScope({ relativePath: "app/server.js", github, iacRoots });
  assert.equal(denied.allowed, false);
  assert.deepEqual(denied.allowedRoots, ["infra/prod"]);
});

test("evaluatePathScope degrades gracefully when no iac roots are declared", () => {
  const github = { pathScope: { mode: "iac_roots", deny: ["**/*.tfstate"] } };
  const result = evaluatePathScope({ relativePath: "app/server.js", github, iacRoots: [] });
  assert.equal(result.allowed, true);
  assert.equal(result.pathScopeMode, "any (no iac roots declared)");
  // deny still applies with no roots
  const denied = evaluatePathScope({ relativePath: "infra/terraform.tfstate", github, iacRoots: [] });
  assert.equal(denied.allowed, false);
});

test("extractIacRoots reads rootPath from workload deploymentPreferences", () => {
  const roots = extractIacRoots({ iac: { roots: [{ rootPath: "infra/prod" }, { path: "infra/dev" }, "modules/net"] } });
  assert.deepEqual(roots, ["infra/prod", "infra/dev", "modules/net"]);
});
