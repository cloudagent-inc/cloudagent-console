import assert from "node:assert/strict";
import test from "node:test";

import {
  getRuntimeOpenAIKey,
  getRuntimeOpenAIModel,
} from "../src/global-variables.mjs";

test("runtime OpenAI settings read the current environment instead of import-time values", () => {
  const env = {
    OPENAI_TOKEN: "  saved-preferences-key  ",
    OPENAI_API_KEY: "fallback-key",
    OPENAI_LOCAL_MODEL: "gpt-local",
    OPENAI_MODEL: "gpt-environment",
  };

  assert.equal(getRuntimeOpenAIKey(env), "saved-preferences-key");
  assert.equal(getRuntimeOpenAIModel(env), "gpt-local");

  env.OPENAI_TOKEN = "rotated-key";
  env.OPENAI_LOCAL_MODEL = "gpt-rotated";

  assert.equal(getRuntimeOpenAIKey(env), "rotated-key");
  assert.equal(getRuntimeOpenAIModel(env), "gpt-rotated");
});

test("runtime OpenAI key falls back to OPENAI_API_KEY", () => {
  assert.equal(getRuntimeOpenAIKey({ OPENAI_API_KEY: "api-key" }), "api-key");
});
