import assert from "node:assert/strict";
import test from "node:test";

import { makeCloudAgent } from "../src/core/cloudagent.mjs";

test("CloudAgent resolves an OpenAI key saved after module import", () => {
  const originalToken = process.env.OPENAI_TOKEN;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalLocalModel = process.env.OPENAI_LOCAL_MODEL;

  try {
    delete process.env.OPENAI_TOKEN;
    delete process.env.OPENAI_API_KEY;
    assert.throws(
      () => makeCloudAgent({ authLevel: "anonymous" }),
      /OpenAI API key in Preferences/,
    );

    process.env.OPENAI_TOKEN = "runtime-preferences-test-key";
    process.env.OPENAI_LOCAL_MODEL = "gpt-5.4";
    const agent = makeCloudAgent({ authLevel: "anonymous" });

    assert.ok(agent);
  } finally {
    if (originalToken === undefined) delete process.env.OPENAI_TOKEN;
    else process.env.OPENAI_TOKEN = originalToken;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
    if (originalLocalModel === undefined) delete process.env.OPENAI_LOCAL_MODEL;
    else process.env.OPENAI_LOCAL_MODEL = originalLocalModel;
  }
});
