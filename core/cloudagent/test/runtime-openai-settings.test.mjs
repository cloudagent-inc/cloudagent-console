import assert from "node:assert/strict";
import test from "node:test";

import { makeCloudAgent } from "../src/core/cloudagent.mjs";

const ENV_KEYS = [
  "OPENAI_TOKEN",
  "OPENAI_API_KEY",
  "OPENAI_LOCAL_MODEL",
  "CLOUDAGENT_LLM_PROVIDER",
  "CLOUDAGENT_LLM_API_KEY",
  "CLOUDAGENT_LLM_MODEL",
  "CLOUDAGENT_LLM_BASE_URL",
  "CLOUDAGENT_LLM_REGION",
];

function withCleanEnv(fn) {
  const saved = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  try {
    return fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("CloudAgent resolves an OpenAI key saved after module import", () => {
  withCleanEnv(() => {
    assert.throws(
      () => makeCloudAgent({ authLevel: "anonymous" }),
      /Configure a model provider/,
    );

    process.env.OPENAI_TOKEN = "runtime-preferences-test-key";
    process.env.OPENAI_LOCAL_MODEL = "gpt-5.4";
    assert.ok(makeCloudAgent({ authLevel: "anonymous" }));
  });
});

test("CloudAgent runs on a Bedrock provider configured at runtime", () => {
  withCleanEnv(() => {
    process.env.CLOUDAGENT_LLM_PROVIDER = "bedrock";
    process.env.CLOUDAGENT_LLM_API_KEY = "bedrock-test-key";
    process.env.CLOUDAGENT_LLM_MODEL = "openai.gpt-oss-120b-1:0";

    assert.ok(makeCloudAgent({ authLevel: "anonymous" }));
  });
});

test("CloudAgent rejects a partially configured custom provider", () => {
  withCleanEnv(() => {
    process.env.CLOUDAGENT_LLM_PROVIDER = "custom";
    process.env.CLOUDAGENT_LLM_BASE_URL = "http://localhost:4000/v1";

    assert.throws(
      () => makeCloudAgent({ authLevel: "anonymous" }),
      /Configure a model provider/,
    );
  });
});
