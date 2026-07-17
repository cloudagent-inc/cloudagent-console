import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { collectOpenAiToolSchemaIssues } from "@cloudagent/cloudagent-tools/util/openai-tool-schema";
import { JsonFileStore } from "@cloudagent/storage";
import { createCloudAgentTools } from "../src/modules/cloudagent/cloudagent-tools.mjs";

test("all native CloudAgent tools generate OpenAI-compatible strict schemas", async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "cloudagent-tool-schemas-"));
  t.after(() => fs.rm(dataDir, { recursive: true, force: true }));
  const store = await new JsonFileStore({ dataDir }).init();
  const { tools } = createCloudAgentTools({ store });

  assert.equal(tools.length, 28);
  assert.deepEqual(collectOpenAiToolSchemaIssues(tools), []);

  const updateWorkload = tools.find((agentTool) => agentTool.name === "update_workload");
  assert.ok(updateWorkload);
  const deploymentPreferences = updateWorkload.parameters.properties.deploymentPreferences.anyOf[0];
  const securityRules = updateWorkload.parameters.properties.securityRules.anyOf[0];
  assert.equal(deploymentPreferences.additionalProperties, false);
  assert.equal(securityRules.additionalProperties, false);
  assert.equal(securityRules.properties.categories.anyOf[0].propertyNames, undefined);
  assert.equal(securityRules.properties.rules.anyOf[0].propertyNames, undefined);
  assert.deepEqual(
    securityRules.properties.categories.anyOf[0].additionalProperties.required,
    ["enable_all"]
  );
  assert.deepEqual(
    securityRules.properties.rules.anyOf[0].additionalProperties.required,
    ["enabled", "disposition"]
  );
  assert.equal(
    securityRules.properties.rules.anyOf[0].additionalProperties.type,
    "object"
  );
});

test("schema audit rejects object properties omitted from required", () => {
  const issues = collectOpenAiToolSchemaIssues([
    {
      type: "function",
      name: "invalid_required_tool",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          value: { type: "string" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  ]);

  assert.deepEqual(issues, [
    {
      tool: "invalid_required_tool",
      path: "parameters.required",
      code: "required_property_missing",
      property: "value",
    },
  ]);
});

test("schema audit rejects propertyNames emitted by Zod records", () => {
  const issues = collectOpenAiToolSchemaIssues([
    {
      type: "function",
      name: "invalid_record_tool",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          values: {
            type: "object",
            propertyNames: { type: "string" },
            additionalProperties: { type: "string" },
          },
        },
        required: ["values"],
        additionalProperties: false,
      },
    },
  ]);

  assert.deepEqual(issues, [
    {
      tool: "invalid_record_tool",
      path: "parameters.properties.values.propertyNames",
      code: "unsupported_property_names",
    },
  ]);
});
