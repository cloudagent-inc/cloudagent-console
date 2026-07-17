import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { normalizeGuardrailCatalog } from "../src/services/guardrail-normalization.mjs";
import {
  buildTerraformExecutionEnv,
  runTerraformPlanCheck,
  summarizeTerraformPlan,
} from "../src/services/terraform-plan-check.mjs";

test("buildTerraformExecutionEnv removes inherited Terraform overrides", () => {
  const env = buildTerraformExecutionEnv({
    baseEnv: {
      PATH: "/bin",
      TF_CLI_ARGS: "-destroy",
      TF_CLI_ARGS_plan: "-lock=true",
      TF_LOG: "TRACE",
      TF_VAR_password: "secret",
      TF_WORKSPACE: "wrong",
    },
    credentialEnv: { AWS_PROFILE: "readonly" },
    tempDir: "/tmp/cloudagent-test",
    workspace: "dev",
  });
  assert.equal(env.TF_CLI_ARGS, undefined);
  assert.equal(env.TF_CLI_ARGS_plan, undefined);
  assert.equal(env.TF_LOG, undefined);
  assert.equal(env.TF_VAR_password, undefined);
  assert.equal(env.TF_WORKSPACE, "dev");
  assert.equal(env.TF_INPUT, "0");
  assert.equal(env.AWS_PROFILE, "readonly");
});

test("summarizeTerraformPlan distinguishes replacements and excludes pure deletes from changed scope", () => {
  const summary = summarizeTerraformPlan({
    resource_changes: [
      { address: "aws_s3_bucket.new", change: { actions: ["create"] } },
      { address: "aws_s3_bucket.update", change: { actions: ["update"] } },
      { address: "aws_s3_bucket.replace", change: { actions: ["delete", "create"] } },
      { address: "aws_s3_bucket.old", change: { actions: ["delete"] } },
    ],
  });
  assert.deepEqual(summary.counts, { add: 1, change: 1, replace: 1, destroy: 1, noOp: 0 });
  assert.deepEqual(summary.changedAddresses, [
    "aws_s3_bucket.new",
    "aws_s3_bucket.update",
    "aws_s3_bucket.replace",
  ]);
});

test("runTerraformPlanCheck disables locking and scopes enabled Trivy findings to changed resources", async (t) => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "cloudagent-plan-test-"));
  await fs.mkdir(path.join(repo, "infra"));
  await fs.writeFile(path.join(repo, "infra", "dev.tfvars"), "name = \"dev\"\n");
  t.after(() => fs.rm(repo, { recursive: true, force: true }));

  const catalog = normalizeGuardrailCatalog({
    rules: [{ id: "S3_ENCRYPTED", title: "S3 encrypted", severity: "high", disposition: "warning" }],
    trivyMappings: { S3_ENCRYPTED: { checkIds: ["AVD-AWS-9999"], scope: "resource" } },
  });
  const calls = [];
  let planOutputPath = null;
  const commandRunner = async (command, args, options) => {
    calls.push({ command, args, options });
    if (command === "git" && args[0] === "rev-parse") return { code: 0, stdout: "abc123\n", stderr: "" };
    if (command === "git" && args[0] === "status") return { code: 0, stdout: " M main.tf\n", stderr: "" };
    if (args[0] === "init") return { code: 0, stdout: "", stderr: "" };
    if (args[0] === "plan") {
      planOutputPath = args.find((arg) => arg.startsWith("-out=")).slice(5);
      return { code: 2, stdout: "", stderr: "" };
    }
    if (args[0] === "show") {
      return {
        code: 0,
        stderr: "",
        stdout: JSON.stringify({
          resource_changes: [
            { address: "aws_s3_bucket.changed", change: { actions: ["update"] } },
            { address: "aws_s3_bucket.unchanged", change: { actions: ["no-op"] } },
          ],
        }),
      };
    }
    if (command === "trivy") {
      return {
        code: 0,
        stderr: "",
        stdout: JSON.stringify({
          Results: [
            { Target: "tfplan.json", Misconfigurations: [{ ID: "AVD-AWS-9999", Title: "Encrypted", Severity: "HIGH", CauseMetadata: { Resource: "aws_s3_bucket.changed" } }] },
            { Target: "tfplan.json", Misconfigurations: [{ ID: "AVD-AWS-9999", Title: "Encrypted", Severity: "HIGH", CauseMetadata: { Resource: "aws_s3_bucket.unchanged" } }] },
          ],
        }),
      };
    }
    throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
  };

  const result = await runTerraformPlanCheck({
    repoPath: repo,
    root: { id: "primary", type: "terraform", rootPath: "infra", varFiles: ["dev.tfvars"] },
    credentialEnv: { AWS_PROFILE: "readonly" },
    catalog,
    securityRules: { rules: { S3_ENCRYPTED: { enabled: true } } },
    commandRunner,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "warnings");
  assert.equal(result.plan.hasChanges, true);
  assert.deepEqual(result.checkout, { commitSha: "abc123", dirty: true });
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].address, "aws_s3_bucket.changed");
  assert.deepEqual(result.policy.evaluatedTrivyCheckIds, ["AVD-AWS-9999"]);
  const planCall = calls.find((call) => call.args[0] === "plan");
  const initCall = calls.find((call) => call.args[0] === "init");
  assert.ok(initCall.args.includes("-lockfile=readonly"));
  assert.ok(planCall.args.includes("-lock=false"));
  const canonicalVarFile = await fs.realpath(path.join(repo, "infra", "dev.tfvars"));
  assert.ok(planCall.args.includes(`-var-file=${canonicalVarFile}`));
  await assert.rejects(fs.access(path.dirname(planOutputPath)));
});

test("runTerraformPlanCheck reports selected policies without Terraform mappings as incomplete coverage", async (t) => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "cloudagent-plan-test-"));
  t.after(() => fs.rm(repo, { recursive: true, force: true }));
  const catalog = normalizeGuardrailCatalog({
    rules: [{ id: "GUARD_ONLY", title: "Guard only" }],
    guardMappings: { GUARD_ONLY: { ruleRef: "guard_only" } },
  });
  const commandRunner = async (_command, args) => {
    if (_command === "git" && args[0] === "rev-parse") return { code: 0, stdout: "abc123\n", stderr: "" };
    if (_command === "git" && args[0] === "status") return { code: 0, stdout: "", stderr: "" };
    if (args[0] === "show") return { code: 0, stdout: JSON.stringify({ resource_changes: [] }), stderr: "" };
    return { code: args[0] === "plan" ? 0 : 0, stdout: "", stderr: "" };
  };
  const result = await runTerraformPlanCheck({
    repoPath: repo,
    root: { id: "primary", type: "terraform", rootPath: "." },
    catalog,
    securityRules: { rules: { GUARD_ONLY: { enabled: true } } },
    commandRunner,
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, "coverage_incomplete");
  assert.deepEqual(result.policy.unmappedPolicyIds, ["GUARD_ONLY"]);
});

test("runTerraformPlanCheck rejects unsupported remote backends before init", async (t) => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "cloudagent-plan-test-"));
  t.after(() => fs.rm(repo, { recursive: true, force: true }));
  await fs.writeFile(path.join(repo, "backend.tf"), 'terraform { backend "remote" {} }\n');
  let called = false;
  const result = await runTerraformPlanCheck({
    repoPath: repo,
    root: { id: "primary", type: "terraform", rootPath: "." },
    commandRunner: async () => {
      called = true;
      return { code: 0, stdout: "", stderr: "" };
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "backend_unsupported");
  assert.equal(called, false);
});
