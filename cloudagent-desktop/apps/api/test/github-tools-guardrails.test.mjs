import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
  createGithubGovernanceResolver,
  createGithubBranchTool,
  createWriteGithubFileTool,
  createGithubPullRequestTool,
  createReadGithubFileTool,
} from "../src/modules/cloudagent/cloudagent-tools.mjs";
import { SECURE_GITHUB_DEFAULTS } from "@cloudagent/cloudagent-tools/services/github-governance";

// --- helpers ---------------------------------------------------------------

function git(cwd, args) {
  execFileSync("git", args, { cwd, stdio: "pipe" });
}

async function makeRepo({ initialBranch = "main" } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cloudagent-gh-"));
  git(dir, ["init", "-q", "-b", initialBranch]);
  git(dir, ["config", "user.email", "test@cloudagent.dev"]);
  git(dir, ["config", "user.name", "Test"]);
  await fs.writeFile(path.join(dir, "README.md"), "# repo\n");
  git(dir, ["add", "."]);
  git(dir, ["commit", "-q", "-m", "initial"]);
  return dir;
}

function fakeResolver(governance) {
  return async ({ args = {} } = {}) => ({
    ok: true,
    repoPath: governance.repoPath || null,
    repoFullName: governance.repoFullName || null,
    repoConfigured: governance.repoConfigured ?? true,
    workloadId: governance.workloadId || "w1",
    permissionProfileId: null,
    workloadResolutionSource: "repo_mapping",
    github: governance.github,
    githubGovernanceSource: governance.source || "workload",
    defaultBranch: governance.defaultBranch ?? "main",
    protectedBranches: governance.protectedBranches ?? ["main", "master"],
    iacRoots: governance.iacRoots || [],
    ...governance.extra,
  });
}

function invoke(toolInstance, args) {
  return toolInstance.invoke({ context: { userId: "local-user" } }, JSON.stringify(args), {});
}

function defaultsWith(overrides = {}) {
  return { ...JSON.parse(JSON.stringify(SECURE_GITHUB_DEFAULTS)), ...overrides };
}

// --- governance resolution chain + source ----------------------------------

function makeStore({ workloads = [], profiles = [], settings = {} }) {
  return {
    async listWorkloads() { return workloads; },
    async listPermissionProfiles() { return profiles; },
    async getWorkload(id) { return workloads.find((w) => w.workloadId === id) || null; },
    async getPermissionProfile(id) { return profiles.find((p) => (p.recordId || p.id) === id) || null; },
    async getSettings() { return { settings: JSON.stringify(settings) }; },
  };
}

test("governance resolution merges global -> environment -> workload and reports source + default branch", async () => {
  const store = makeStore({
    settings: { workloadRules: { deploymentPreferences: { github: { draftPrs: false } } } },
    profiles: [{ recordId: "env-1", deploymentPreferences: { github: { branchPrefix: "env/" } } }],
    workloads: [{
      workloadId: "w1",
      environments: ["env-1"],
      deploymentPreferences: { github: { mode: "unrestricted" }, gitRepo: { localPath: "/tmp/repo-a", fullName: "acme/repo-a" } },
    }],
  });
  const { resolveGithubGovernance } = createGithubGovernanceResolver({
    store,
    commandRunner: async (cmd, cmdArgs) => {
      if (cmdArgs.includes("symbolic-ref")) return { statusCode: 200, stdout: "refs/remotes/origin/main\n", stderr: "" };
      return { statusCode: 400, stdout: "", stderr: "" };
    },
  });
  const resolved = await resolveGithubGovernance({ args: { localPath: "/tmp/repo-a" } });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.githubGovernanceSource, "workload");
  assert.equal(resolved.github.mode, "unrestricted"); // workload
  assert.equal(resolved.github.branchPrefix, "env/"); // environment
  assert.equal(resolved.github.draftPrs, false); // global
  assert.equal(resolved.defaultBranch, "main");
  assert.ok(resolved.protectedBranches.includes("main"));
  assert.equal(resolved.workloadId, "w1");
});

test("governance resolution fails closed with 409 when a repo maps to multiple workloads", async () => {
  const store = makeStore({
    workloads: [
      { workloadId: "w1", deploymentPreferences: { gitRepo: { localPath: "/tmp/repo-a", fullName: "acme/repo-a" } } },
      { workloadId: "w2", deploymentPreferences: { gitRepo: { localPath: "/tmp/repo-a", fullName: "acme/repo-a" } } },
    ],
  });
  const { resolveGithubGovernance } = createGithubGovernanceResolver({
    store,
    commandRunner: async () => ({ statusCode: 400, stdout: "", stderr: "" }),
  });
  const resolved = await resolveGithubGovernance({ args: { localPath: "/tmp/repo-a" } });
  assert.equal(resolved.ok, false);
  assert.equal(resolved.statusCode, 409);
  assert.equal(resolved.error.code, "ambiguous_workload_for_repo");
  assert.deepEqual(resolved.error.workloadIds, ["w1", "w2"]);
});

// --- create_github_branch --------------------------------------------------

test("create_github_branch refuses protected branches", async () => {
  const branchTool = createGithubBranchTool({
    resolveGithubGovernance: fakeResolver({ repoPath: "/tmp/x", github: defaultsWith() }),
  });
  const result = await invoke(branchTool, { localPath: "/tmp/x", base: "main", branch: "main" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "protected_branch");
  assert.equal(result.error.actor, "agent");
});

test("create_github_branch enforces the branch prefix with a suggested branch", async () => {
  const branchTool = createGithubBranchTool({
    resolveGithubGovernance: fakeResolver({ repoPath: "/tmp/x", github: defaultsWith() }),
  });
  const result = await invoke(branchTool, { localPath: "/tmp/x", base: "main", branch: "My Fix" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "branch_prefix_required");
  assert.equal(result.error.suggestedBranch, "cloudagent/my-fix");
});

test("create_github_branch reset policy 'never' refuses an existing branch", async () => {
  const dir = await makeRepo();
  git(dir, ["branch", "cloudagent/existing"]);
  try {
    const branchTool = createGithubBranchTool({
      resolveGithubGovernance: fakeResolver({ repoPath: dir, github: defaultsWith({ allowBranchReset: "never" }) }),
    });
    const result = await invoke(branchTool, { localPath: dir, base: "main", branch: "cloudagent/existing" });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "branch_exists");
    assert.equal(result.error.allowBranchReset, "never");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("create_github_branch creates a new prefixed branch with -b", async () => {
  const dir = await makeRepo();
  try {
    const branchTool = createGithubBranchTool({
      resolveGithubGovernance: fakeResolver({ repoPath: dir, github: defaultsWith() }),
    });
    const result = await invoke(branchTool, { localPath: dir, base: "main", branch: "cloudagent/new-feature" });
    assert.equal(result.ok, true);
    assert.equal(result.reset, false);
    const current = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: dir }).toString().trim();
    assert.equal(current, "cloudagent/new-feature");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

// --- write_github_file -----------------------------------------------------

test("write_github_file refuses writes to a protected branch under pr_only", async () => {
  const writeTool = createWriteGithubFileTool({
    resolveGithubGovernance: fakeResolver({ repoPath: "/tmp/x", github: defaultsWith({ mode: "pr_only" }) }),
  });
  const result = await invoke(writeTool, { localPath: "/tmp/x", path: "a.txt", content: "hi", message: "m", branch: "main" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "protected_branch");
  assert.equal(result.error.guidance, "create a branch with create_github_branch first");
});

test("write_github_file applies deny globs even in path scope mode 'any'", async () => {
  const github = defaultsWith({ mode: "unrestricted", pathScope: { mode: "any", additionalAllow: [], deny: [".github/workflows/**"] } });
  const writeTool = createWriteGithubFileTool({
    resolveGithubGovernance: fakeResolver({ repoPath: "/tmp/x", github }),
  });
  const result = await invoke(writeTool, { localPath: "/tmp/x", path: ".github/workflows/ci.yml", content: "x", message: "m", branch: "cloudagent/x" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "path_denied");
  assert.equal(result.error.matchedDeny, ".github/workflows/**");
});

test("write_github_file secret scan reports the pattern name and never echoes the value", async () => {
  const github = defaultsWith({ mode: "unrestricted", secretScan: true, pathScope: { mode: "any", additionalAllow: [], deny: [] } });
  const writeTool = createWriteGithubFileTool({
    resolveGithubGovernance: fakeResolver({ repoPath: "/tmp/x", github }),
  });
  const secret = "AKIAIOSFODNN7EXAMPLE";
  const result = await invoke(writeTool, { localPath: "/tmp/x", path: "creds.txt", content: `key=${secret}`, message: "m", branch: "cloudagent/x" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "secret_detected");
  assert.equal(result.error.pattern, "aws_access_key_id");
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test("write_github_file appends the co-author trailer when configured", async () => {
  const dir = await makeRepo({ initialBranch: "cloudagent/feature" });
  try {
    const github = defaultsWith({ mode: "pr_only", secretScan: true, pathScope: { mode: "any", additionalAllow: [], deny: [] }, attribution: { coAuthorTrailer: true, prLabel: "cloudagent" } });
    const writeTool = createWriteGithubFileTool({
      resolveGithubGovernance: fakeResolver({ repoPath: dir, github, protectedBranches: ["main", "master"] }),
    });
    const result = await invoke(writeTool, { localPath: dir, path: "src/app.js", content: "console.log(1)\n", message: "add app" });
    assert.equal(result.ok, true);
    assert.equal(result.coAuthorTrailer, true);
    const body = execFileSync("git", ["log", "-1", "--format=%B"], { cwd: dir }).toString();
    assert.ok(body.includes("Co-Authored-By: CloudAgent <noreply@cloudagent.dev>"), body);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

// --- create_github_pull_request --------------------------------------------

test("create_github_pull_request refuses a base that is not the default branch", async () => {
  const prTool = createGithubPullRequestTool({
    resolveGithubGovernance: fakeResolver({ repoPath: "/tmp/x", github: defaultsWith(), defaultBranch: "main" }),
  });
  const result = await invoke(prTool, { localPath: "/tmp/x", title: "t", head: "cloudagent/x", base: "develop", push: false });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "invalid_base_branch");
  assert.equal(result.error.defaultBranch, "main");
});

test("create_github_pull_request enforces maxFilesPerPr before pushing", async () => {
  const dir = await makeRepo({ initialBranch: "main" });
  try {
    git(dir, ["checkout", "-q", "-b", "cloudagent/big"]);
    for (let i = 0; i < 5; i += 1) {
      await fs.writeFile(path.join(dir, `file-${i}.txt`), `content ${i}\n`);
    }
    git(dir, ["add", "."]);
    git(dir, ["commit", "-q", "-m", "many files"]);
    const github = defaultsWith({ limits: { maxFilesPerPr: 2, maxDiffKb: 512, allowBinary: false } });
    let ghCalled = false;
    const prTool = createGithubPullRequestTool({
      getToolSettings: async () => ({ githubBinary: "gh" }),
      resolveGithubGovernance: fakeResolver({ repoPath: dir, github, defaultBranch: "main" }),
    });
    // push:false ensures no network; the file-limit refusal happens before push anyway.
    const result = await invoke(prTool, { localPath: dir, title: "t", head: "cloudagent/big", base: "main", push: false });
    assert.equal(ghCalled, false);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "diff_too_large");
    assert.equal(result.error.files, 5);
    assert.equal(result.error.maxFilesPerPr, 2);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

// --- read_github_file ------------------------------------------------------

test("read_github_file enforces the repo allowlist only when strictReads is on", async () => {
  const github = defaultsWith({ strictReads: true });
  const readTool = createReadGithubFileTool({
    resolveGithubGovernance: fakeResolver({ repoPath: "/tmp/x", github, repoConfigured: false }),
  });
  const result = await invoke(readTool, { localPath: "/tmp/x", path: "README.md" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "repo_not_configured");
});
