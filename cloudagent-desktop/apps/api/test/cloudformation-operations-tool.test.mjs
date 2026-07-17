import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCloudFormationStackConsoleUrl,
  createAwsCfnOperationsTool,
  createLocalWorkloadsService,
} from "../src/modules/cloudagent/cloudagent-tools.mjs";

const INPUT = {
  operation: "create",
  permissionProfileId: "environment-1",
  region: "us-east-1",
  stackName: "test-stack",
  templateBody: "Resources: {}",
};

function accountsService(environmentRules, deploymentPreferences = {}) {
  return {
    async getPermissionProfileDefaults() {
      return {
        authProfile: { awsAccountId: "123456789012", awsProfile: "readonly" },
        securityRules: environmentRules,
        deploymentPreferences,
      };
    },
    async getAccountDefaults() {
      return null;
    },
  };
}

test("workload service resolves CloudFormation stack ownership from tracked stack metadata", async () => {
  const service = createLocalWorkloadsService({
    store: {
      async listWorkloads() {
        return [
          {
            workloadId: "workload-1",
            environments: ["environment-1"],
            deploymentPreferences: JSON.stringify({ changeSet: true }),
            trackedResources: JSON.stringify({
              stacks: [{
                stackId: "arn:aws:cloudformation:us-east-1:123456789012:stack/test-stack/abc",
                region: "us-east-1",
                accountId: "123456789012",
              }],
            }),
          },
        ];
      },
    },
  });

  const result = await service.findWorkloadForCloudFormationStack("local-user", {
    stackName: "test-stack",
    region: "us-east-1",
    accountId: "123456789012",
    permissionProfileId: "environment-1",
  });

  assert.equal(result.ambiguous, false);
  assert.equal(result.workloadId, "workload-1");
  assert.equal(result.matchSource, "tracked_stack");
});

test("CloudFormation operations validate workload rules and do not deploy when validation blocks", async () => {
  const environmentRules = { rules: { ENVIRONMENT_RULE: { enabled: true } } };
  const workloadRules = { rules: { RDS_STORAGE_ENCRYPTED: { enabled: true } } };
  let validatedRules;
  let cliCalled = false;
  const tool = createAwsCfnOperationsTool({
    accountsService: accountsService(environmentRules),
    workloadsService: {
      async getWorkloadDefaults() {
        return { workload: { workloadId: "workload-1" }, securityRules: workloadRules };
      },
    },
    validationRunner: async ({ securityRules }) => {
      validatedRules = securityRules;
      return { ok: false, status: "needs_confirmation", findings: [{ policyId: "RDS_STORAGE_ENCRYPTED" }] };
    },
    awsCliRunner: async () => {
      cliCalled = true;
      return { statusCode: 200, output: { stdout: "", stderr: "" } };
    },
  });
  const result = await tool.invoke(
    { context: { userId: "local-user" } },
    JSON.stringify({ ...INPUT, workloadId: "workload-1" }),
    {}
  );
  assert.deepEqual(validatedRules, workloadRules);
  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 422);
  assert.equal(result.status, "policy_failed");
  assert.equal(result.deploymentAttempted, false);
  assert.equal(result.requiresTemplateRevision, true);
  assert.equal(result.retryable, true);
  assert.equal(result.requiredAction, "revise_template_and_retry_validation");
  assert.equal(result.securityRulesSource, "workload");
  assert.equal(cliCalled, false);
});

test("CloudFormation operations fall back to environment rules for legacy workloads without selections", async () => {
  const environmentRules = { rules: { RDS_STORAGE_ENCRYPTED: { enabled: true } } };
  let validatedRules;
  const tool = createAwsCfnOperationsTool({
    accountsService: accountsService(environmentRules),
    workloadsService: {
      async getWorkloadDefaults() {
        return { workload: { workloadId: "workload-1" }, securityRules: { rules: {} } };
      },
    },
    validationRunner: async ({ securityRules }) => {
      validatedRules = securityRules;
      return { ok: false, status: "coverage_incomplete" };
    },
  });
  const result = await tool.invoke(
    { context: { userId: "local-user" } },
    JSON.stringify({ ...INPUT, workloadId: "workload-1" }),
    {}
  );
  assert.deepEqual(validatedRules, environmentRules);
  assert.equal(result.securityRulesSource, "environment");
});

test("CloudFormation operations create but never execute a change set when workload governance requires it", async () => {
  const commands = [];
  const tool = createAwsCfnOperationsTool({
    accountsService: accountsService({}, { changeSet: false }),
    workloadsService: {
      async findWorkloadForCloudFormationStack() {
        return {
          workloadId: "workload-1",
          matchSource: "tracked_stack",
          ambiguous: false,
          candidates: ["workload-1"],
        };
      },
      async getWorkloadDefaults() {
        return {
          workload: { workloadId: "workload-1" },
          securityRules: { rules: {} },
          deploymentPreferences: { method: "cloudformation", changeSet: true },
        };
      },
    },
    validationRunner: async () => ({ ok: true, status: "passed", findings: [] }),
    awsCliRunner: async ({ args }) => {
      commands.push(args);
      if (args[1] === "create-change-set") {
        return {
          statusCode: 200,
          output: {
            stdout: JSON.stringify({
              Id: "arn:aws:cloudformation:us-east-1:123456789012:changeSet/test/abc",
              StackId: "arn:aws:cloudformation:us-east-1:123456789012:stack/test-stack/def",
            }),
            stderr: "",
          },
        };
      }
      if (args[1] === "wait") {
        return { statusCode: 200, output: { stdout: "", stderr: "" } };
      }
      return {
        statusCode: 200,
        output: {
          stdout: JSON.stringify({
            Status: "CREATE_COMPLETE",
            ChangeSetId: "arn:aws:cloudformation:us-east-1:123456789012:changeSet/test/abc",
            StackId: "arn:aws:cloudformation:us-east-1:123456789012:stack/test-stack/def",
            Changes: [{ Type: "Resource" }],
          }),
          stderr: "",
        },
      };
    },
  });

  const result = await tool.invoke(
    { context: { userId: "local-user" } },
    JSON.stringify({ ...INPUT, operation: "update" }),
    {}
  );

  assert.equal(result.ok, true);
  assert.equal(result.executionMode, "change_set");
  assert.equal(result.changeSetRequired, true);
  assert.equal(result.changeSetExecuted, false);
  assert.equal(result.deploymentPreferencesSource, "workload");
  assert.equal(result.workloadResolutionSource, "tracked_stack");
  assert.equal(result.workloadId, "workload-1");
  assert.equal(result.status, "CREATE_COMPLETE");
  assert.equal(result.changeSetStatus, "CREATE_COMPLETE");
  assert.equal(result.deploymentAttempted, false);
  assert.match(result.stackUrl, /cloudformation\/home/);
  assert.match(result.stackUrl, /stackinfo/);
  assert.equal(result.changes.length, 1);
  assert.deepEqual(commands.map((args) => args[1]), [
    "create-change-set",
    "wait",
    "describe-change-set",
  ]);
  assert.equal(commands.some((args) => args.includes("deploy")), false);
});

test("an explicit workload changeSet false overrides an enabled environment default", async () => {
  const commands = [];
  const tool = createAwsCfnOperationsTool({
    accountsService: accountsService({}, { changeSet: true }),
    workloadsService: {
      async getWorkloadDefaults() {
        return {
          workload: { workloadId: "workload-1" },
          securityRules: { rules: {} },
          deploymentPreferences: { method: "cloudformation", changeSet: false },
        };
      },
    },
    validationRunner: async () => ({ ok: true, status: "passed", findings: [] }),
    awsCliRunner: async ({ args }) => {
      commands.push(args);
      if (args[1] === "describe-stacks") {
        return {
          statusCode: 200,
          output: {
            stdout: JSON.stringify({
              Stacks: [{
                StackId: "arn:aws:cloudformation:us-east-1:123456789012:stack/test-stack/def",
                StackName: "test-stack",
                StackStatus: "UPDATE_COMPLETE",
                CreationTime: "2026-07-16T12:00:00.000Z",
                LastUpdatedTime: "2026-07-16T12:05:00.000Z",
              }],
            }),
            stderr: "",
          },
        };
      }
      return { statusCode: 200, output: { stdout: "deployed", stderr: "" } };
    },
  });

  const result = await tool.invoke(
    { context: { userId: "local-user" } },
    JSON.stringify({ ...INPUT, operation: "update", workloadId: "workload-1" }),
    {}
  );

  assert.equal(result.ok, true);
  assert.equal(result.executionMode, "direct_deploy");
  assert.equal(result.changeSetRequired, false);
  assert.equal(result.deploymentPreferencesSource, "workload");
  assert.equal(result.stackName, "test-stack");
  assert.equal(result.stackId, "arn:aws:cloudformation:us-east-1:123456789012:stack/test-stack/def");
  assert.equal(result.stackStatus, "UPDATE_COMPLETE");
  assert.equal(result.status, "UPDATE_COMPLETE");
  assert.equal(result.deploymentAttempted, true);
  assert.equal(
    result.stackUrl,
    buildCloudFormationStackConsoleUrl({
      region: "us-east-1",
      stackId: result.stackId,
      stackName: "test-stack",
    })
  );
  assert.deepEqual(commands.map((args) => args[1]), ["deploy", "describe-stacks"]);
});

test("environment changeSet governance is enforced when there is no workload", async () => {
  const commands = [];
  const tool = createAwsCfnOperationsTool({
    accountsService: accountsService({}, { method: "cloudformation", changeSet: true }),
    workloadsService: {
      async getWorkloadDefaults() {
        throw new Error("getWorkloadDefaults should not be called without a workload");
      },
    },
    validationRunner: async () => ({ ok: true, status: "passed", findings: [] }),
    awsCliRunner: async ({ args }) => {
      commands.push(args);
      if (args[1] === "create-change-set") {
        return {
          statusCode: 200,
          output: {
            stdout: JSON.stringify({
              Id: "arn:aws:cloudformation:us-east-1:123456789012:changeSet/environment-test/abc",
              StackId: "arn:aws:cloudformation:us-east-1:123456789012:stack/test-stack/def",
            }),
            stderr: "",
          },
        };
      }
      if (args[1] === "wait") {
        return { statusCode: 200, output: { stdout: "", stderr: "" } };
      }
      return {
        statusCode: 200,
        output: {
          stdout: JSON.stringify({
            Status: "CREATE_COMPLETE",
            ChangeSetId: "arn:aws:cloudformation:us-east-1:123456789012:changeSet/environment-test/abc",
            Changes: [],
          }),
          stderr: "",
        },
      };
    },
  });

  const result = await tool.invoke(
    { context: { userId: "local-user" } },
    JSON.stringify({ ...INPUT, operation: "update" }),
    {}
  );

  assert.equal(result.ok, true);
  assert.equal(result.executionMode, "change_set");
  assert.equal(result.changeSetRequired, true);
  assert.equal(result.changeSetExecuted, false);
  assert.equal(result.deploymentPreferencesSource, "environment");
  assert.equal(result.workloadId, null);
  assert.deepEqual(commands.map((args) => args[1]), [
    "create-change-set",
    "wait",
    "describe-change-set",
  ]);
  assert.equal(commands.some((args) => args.includes("deploy")), false);
});

test("CloudFormation operations fail closed when a stack maps to multiple workloads", async () => {
  let validationCalled = false;
  let cliCalled = false;
  const tool = createAwsCfnOperationsTool({
    accountsService: accountsService({}, { changeSet: false }),
    workloadsService: {
      async findWorkloadForCloudFormationStack() {
        return {
          workload: null,
          workloadId: null,
          ambiguous: true,
          candidates: ["workload-1", "workload-2"],
        };
      },
      async getWorkloadDefaults() {
        throw new Error("getWorkloadDefaults should not be called for an ambiguous match");
      },
    },
    validationRunner: async () => {
      validationCalled = true;
      return { ok: true };
    },
    awsCliRunner: async () => {
      cliCalled = true;
      return { statusCode: 200, output: { stdout: "", stderr: "" } };
    },
  });

  const result = await tool.invoke(
    { context: { userId: "local-user" } },
    JSON.stringify({ ...INPUT, operation: "update" }),
    {}
  );

  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 409);
  assert.equal(result.error.code, "ambiguous_workload_for_stack");
  assert.deepEqual(result.error.workloadIds, ["workload-1", "workload-2"]);
  assert.equal(validationCalled, false);
  assert.equal(cliCalled, false);
});
