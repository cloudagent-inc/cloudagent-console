import assert from "node:assert/strict";
import test from "node:test";

import { createGithubService } from "../src/modules/github/github-service.mjs";

function makeStore() {
  return {
    async listWorkloads() {
      return [{
        workloadId: "w1",
        environments: [],
        deploymentPreferences: { gitRepo: { fullName: "acme/repo-a", localPath: "/tmp/repo-a" } },
      }];
    },
    async listPermissionProfiles() { return []; },
    async getWorkload(id) { return id === "w1" ? { workloadId: "w1", deploymentPreferences: {} } : null; },
    async getPermissionProfile() { return null; },
    async getSettings() { return { settings: "{}" }; },
  };
}

function runnerFor(handlers) {
  return async (command, args = []) => {
    const joined = args.join(" ");
    if (args.includes("symbolic-ref")) {
      return { statusCode: 200, stdout: "refs/remotes/origin/main\n", stderr: "" };
    }
    if (args.includes("--jq") && joined.includes(".default_branch")) {
      return { statusCode: 200, stdout: "main\n", stderr: "" };
    }
    for (const [needle, response] of handlers) {
      if (joined.includes(needle)) return response;
    }
    return { statusCode: 400, stdout: "", stderr: "not found" };
  };
}

const getToolSettings = async () => ({ githubBinary: "gh" });

test("getEffectiveGovernance returns the documented contract shape", async () => {
  const service = createGithubService({
    store: makeStore(),
    getToolSettings,
    commandRunner: runnerFor([]),
  });
  const result = await service.getEffectiveGovernance({ repoFullName: "acme/repo-a", workloadId: "w1" });
  assert.equal(result.ok, true);
  assert.equal(result.repoFullName, "acme/repo-a");
  assert.equal(result.defaultBranch, "main");
  assert.equal(result.source, "default"); // no github overrides configured -> secure defaults
  assert.equal(typeof result.github, "object");
  assert.equal(result.github.mode, "pr_only");
});

test("verifyBranchProtection reports classic branch protection", async () => {
  const service = createGithubService({
    store: makeStore(),
    getToolSettings,
    commandRunner: runnerFor([
      ["branches/main/protection", { statusCode: 200, stdout: JSON.stringify({ required_pull_request_reviews: { dismiss_stale_reviews: true } }), stderr: "" }],
    ]),
  });
  const result = await service.verifyBranchProtection({ repoFullName: "acme/repo-a", workloadId: "w1" });
  assert.equal(result.ok, true);
  assert.equal(result.protected, true);
  assert.equal(result.requiresPullRequest, true);
  assert.equal(result.method, "branch_protection");
  assert.equal(result.error, null);
  assert.ok(result.checkedAt);
});

test("verifyBranchProtection falls back to rulesets when classic protection is absent", async () => {
  const service = createGithubService({
    store: makeStore(),
    getToolSettings,
    commandRunner: runnerFor([
      ["branches/main/protection", { statusCode: 404, stdout: "", stderr: "Not Found" }],
      ["rules/branches/main", { statusCode: 200, stdout: JSON.stringify([{ type: "pull_request" }, { type: "deletion" }]), stderr: "" }],
    ]),
  });
  const result = await service.verifyBranchProtection({ repoFullName: "acme/repo-a", workloadId: "w1" });
  assert.equal(result.protected, true);
  assert.equal(result.requiresPullRequest, true);
  assert.equal(result.method, "rulesets");
});

test("verifyBranchProtection reports unprotected when neither protection nor rules apply", async () => {
  const service = createGithubService({
    store: makeStore(),
    getToolSettings,
    commandRunner: runnerFor([
      ["branches/main/protection", { statusCode: 404, stdout: "", stderr: "Branch not protected" }],
      ["rules/branches/main", { statusCode: 200, stdout: "[]", stderr: "" }],
    ]),
  });
  const result = await service.verifyBranchProtection({ repoFullName: "acme/repo-a", workloadId: "w1" });
  assert.equal(result.protected, false);
  assert.equal(result.requiresPullRequest, false);
  assert.equal(result.method, null);
  assert.equal(result.error, null);
});

test("verifyBranchProtection rejects an invalid repoFullName", async () => {
  const service = createGithubService({ store: makeStore(), getToolSettings, commandRunner: runnerFor([]) });
  const result = await service.verifyBranchProtection({ repoFullName: "not-a-repo" });
  assert.equal(result.ok, true);
  assert.equal(result.protected, null);
  assert.equal(result.error.code, "invalid_repo_full_name");
});

test("getBranchProtectionStatus returns unchecked, then the cached verify result", async () => {
  const service = createGithubService({
    store: makeStore(),
    getToolSettings,
    commandRunner: runnerFor([
      ["branches/main/protection", { statusCode: 200, stdout: JSON.stringify({ required_pull_request_reviews: {} }), stderr: "" }],
    ]),
  });
  assert.deepEqual(service.getBranchProtectionStatus({ repoFullName: "acme/repo-a" }), { ok: true, checked: false });
  await service.verifyBranchProtection({ repoFullName: "acme/repo-a", workloadId: "w1" });
  const cached = service.getBranchProtectionStatus({ repoFullName: "acme/repo-a" });
  assert.equal(cached.protected, true);
  assert.equal(cached.method, "branch_protection");
});
