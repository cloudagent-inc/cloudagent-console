import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { DEFAULT_GUARDRAIL_CATALOG } from "../src/services/default-guardrail-catalog.mjs";
import { runCloudFormationValidation } from "../src/services/cloudformation-validation.mjs";

const TEMPLATE = `AWSTemplateFormatVersion: '2010-09-09'
Resources:
  Database:
    Type: AWS::RDS::DBInstance
    Properties:
      PubliclyAccessible: false
      StorageEncrypted: true
`;

function selection(ruleId, disposition = null) {
  return {
    rules: {
      [ruleId]: {
        enabled: true,
        ...(disposition ? { disposition } : {}),
      },
    },
  };
}

test("CloudFormation validation prepares only selected rules in an isolated temporary directory", async () => {
  let tempDir;
  let copiedRules = [];
  const calls = [];
  const commandRunner = async (command, args, options) => {
    calls.push({ command, args, options });
    tempDir = options.cwd;
    if (command === "cfn-lint") return { code: 0, stdout: "[]", stderr: "" };
    copiedRules = await fs.readdir(args[args.indexOf("--rules") + 1]);
    return { code: 0, stdout: "", stderr: "" };
  };

  const result = await runCloudFormationValidation({
    templateBody: TEMPLATE,
    catalog: DEFAULT_GUARDRAIL_CATALOG,
    securityRules: selection("RDS_STORAGE_ENCRYPTED"),
    commandRunner,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "passed");
  assert.deepEqual(copiedRules, ["rds_storage_encrypted.guard"]);
  assert.ok(calls.find((call) => call.command === "cfn-lint"));
  const guardCall = calls.find((call) => call.command === "cfn-guard");
  assert.ok(guardCall.args.includes("CFNTemplate"));
  await assert.rejects(fs.access(tempDir));
});

test("CloudFormation validation prepares the selected S3 Guard rules", async () => {
  let copiedRules = [];
  const commandRunner = async (command, args) => {
    if (command === "cfn-lint") return { code: 0, stdout: "[]", stderr: "" };
    copiedRules = await fs.readdir(args[args.indexOf("--rules") + 1]);
    return { code: 0, stdout: "", stderr: "" };
  };

  const result = await runCloudFormationValidation({
    templateBody: TEMPLATE,
    catalog: DEFAULT_GUARDRAIL_CATALOG,
    securityRules: {
      rules: {
        S3_BUCKET_LOGGING_ENABLED: { enabled: true },
        S3_BUCKET_LEVEL_PUBLIC_ACCESS_PROHIBITED: { enabled: true },
        S3_BUCKET_VERSIONING_ENABLED: { enabled: true },
      },
    },
    commandRunner,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(copiedRules, [
    "s3_bucket_level_public_access_prohibited.guard",
    "s3_bucket_logging_enabled.guard",
    "s3_bucket_versioning_enabled.guard",
  ]);
});

test("CloudFormation validation can prepare all 38 shared Guard policies", async () => {
  let copiedRules = [];
  const commandRunner = async (command, args) => {
    if (command === "cfn-lint") return { code: 0, stdout: "[]", stderr: "" };
    copiedRules = await fs.readdir(args[args.indexOf("--rules") + 1]);
    return { code: 0, stdout: "", stderr: "" };
  };
  const securityRules = {
    rules: Object.fromEntries(
      DEFAULT_GUARDRAIL_CATALOG.rules.map((rule) => [rule.id, { enabled: true }])
    ),
  };

  const result = await runCloudFormationValidation({
    templateBody: TEMPLATE,
    catalog: DEFAULT_GUARDRAIL_CATALOG,
    securityRules,
    commandRunner,
  });

  assert.equal(result.ok, true);
  assert.equal(result.policy.coverageComplete, true);
  assert.equal(result.policy.evaluatedGuardRuleRefs.length, 38);
  assert.equal(copiedRules.length, 38);
  assert.deepEqual(
    copiedRules,
    DEFAULT_GUARDRAIL_CATALOG.rules
      .flatMap((rule) => rule.enforcement.cloudformation.ruleRefs)
      .map((ruleRef) => `${ruleRef}.guard`)
      .sort()
  );
});

test("CloudFormation Guard violations block deployment and retain their disposition", async () => {
  const commandRunner = async (command) => {
    if (command === "cfn-lint") return { code: 0, stdout: "[]", stderr: "" };
    return {
      code: 19,
      stderr: "",
      stdout: JSON.stringify({
        name: "template.yaml",
        status: "FAIL",
        not_compliant: [{
          rule: "RDS_STORAGE_ENCRYPTED",
          path: "Resources.Database.Properties.StorageEncrypted",
          message: "Storage encryption is required.",
        }],
      }),
    };
  };

  const result = await runCloudFormationValidation({
    templateBody: TEMPLATE,
    catalog: DEFAULT_GUARDRAIL_CATALOG,
    securityRules: selection("RDS_STORAGE_ENCRYPTED"),
    commandRunner,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "policy_failed");
  assert.equal(result.deploymentAllowed, false);
  assert.equal(result.requiresTemplateRevision, true);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].policyId, "RDS_STORAGE_ENCRYPTED");
  assert.equal(result.findings[0].engine, "guard");
  assert.equal(result.findings[0].resource, "Database");
  assert.equal(result.findings[0].disposition, "require_confirmation");
});

test("warning-disposition Guard findings still block CloudFormation deployment", async () => {
  const commandRunner = async (command) => command === "cfn-lint"
    ? { code: 0, stdout: "[]", stderr: "" }
    : {
        code: 19,
        stderr: "",
        stdout: JSON.stringify({
          status: "FAIL",
          not_compliant: [{ rule: "S3_BUCKET_LOGGING_ENABLED", path: "Resources.Logs" }],
        }),
      };
  const result = await runCloudFormationValidation({
    templateBody: TEMPLATE,
    catalog: DEFAULT_GUARDRAIL_CATALOG,
    securityRules: selection("S3_BUCKET_LOGGING_ENABLED", "warning"),
    commandRunner,
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, "policy_failed");
  assert.equal(result.deploymentAllowed, false);
  assert.equal(result.requiresTemplateRevision, true);
  assert.equal(result.engines.guard.compliant, false);
  assert.equal(result.findings[0].disposition, "warning");
});

test("selected rules outside the curated CloudFormation mapping fail with incomplete coverage", async () => {
  let commandCalled = false;
  const result = await runCloudFormationValidation({
    templateBody: TEMPLATE,
    catalog: DEFAULT_GUARDRAIL_CATALOG,
    securityRules: selection("UNMAPPED_TEST_RULE"),
    commandRunner: async () => {
      commandCalled = true;
      return { code: 0, stdout: "", stderr: "" };
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, "coverage_incomplete");
  assert.deepEqual(result.policy.unmappedPolicyIds, ["UNMAPPED_TEST_RULE"]);
  assert.equal(commandCalled, false);
});

test("cfn-lint errors block CloudFormation deployment", async () => {
  const commandRunner = async (command) => {
    if (command === "cfn-lint") {
      return {
        code: 2,
        stdout: JSON.stringify([{
          Rule: { Id: "E3001", Severity: "Error" },
          Message: "Invalid resource property.",
          Location: ["Resources", "Database"],
        }]),
        stderr: "",
      };
    }
    return { code: 0, stdout: "", stderr: "" };
  };
  const result = await runCloudFormationValidation({
    templateBody: TEMPLATE,
    catalog: DEFAULT_GUARDRAIL_CATALOG,
    securityRules: { rules: {} },
    commandRunner,
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, "lint_failed");
  assert.equal(result.lintFindings[0].ruleId, "E3001");
});
