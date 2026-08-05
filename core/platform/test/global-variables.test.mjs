import assert from "node:assert/strict";
import test from "node:test";

import {
  getLLMCapabilities,
  getRuntimeLLMConfig,
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

test("runtime LLM config defaults to the openai provider with OpenAI fallbacks", () => {
  const config = getRuntimeLLMConfig({
    OPENAI_TOKEN: " openai-key ",
    OPENAI_LOCAL_MODEL: "gpt-local",
  });

  assert.equal(config.provider, "openai");
  assert.equal(config.apiKey, "openai-key");
  assert.equal(config.model, "gpt-local");
  assert.equal(config.baseURL, "");
  assert.equal(config.configured, true);
});

test("runtime LLM config uses the default OpenAI model and reports unconfigured without a key", () => {
  const config = getRuntimeLLMConfig({});
  assert.equal(config.provider, "openai");
  assert.equal(config.apiKey, "");
  assert.equal(config.model, "gpt-5.4");
  assert.equal(config.configured, false);
});

test("runtime LLM config prefers CLOUDAGENT_LLM_* over the OpenAI env vars", () => {
  const config = getRuntimeLLMConfig({
    CLOUDAGENT_LLM_API_KEY: "shared-key",
    CLOUDAGENT_LLM_MODEL: "shared-model",
    OPENAI_TOKEN: "legacy-key",
    OPENAI_LOCAL_MODEL: "legacy-model",
  });

  assert.equal(config.apiKey, "shared-key");
  assert.equal(config.model, "shared-model");
});

test("bedrock derives the base URL from the region", () => {
  const config = getRuntimeLLMConfig({
    CLOUDAGENT_LLM_PROVIDER: "bedrock",
    CLOUDAGENT_LLM_API_KEY: "bedrock-key",
    CLOUDAGENT_LLM_MODEL: "openai.gpt-oss-120b-1:0",
    CLOUDAGENT_LLM_REGION: "eu-west-1",
  });

  assert.equal(config.provider, "bedrock");
  assert.equal(config.region, "eu-west-1");
  assert.equal(
    config.baseURL,
    "https://bedrock-runtime.eu-west-1.amazonaws.com/openai/v1"
  );
  assert.equal(config.configured, true);
});

test("bedrock falls back to AWS_REGION then us-east-1 and honors an explicit base URL", () => {
  const fromAwsRegion = getRuntimeLLMConfig({
    CLOUDAGENT_LLM_PROVIDER: "bedrock",
    CLOUDAGENT_LLM_API_KEY: "bedrock-key",
    CLOUDAGENT_LLM_MODEL: "model",
    AWS_REGION: "ap-south-1",
  });
  assert.equal(fromAwsRegion.region, "ap-south-1");
  assert.equal(
    fromAwsRegion.baseURL,
    "https://bedrock-runtime.ap-south-1.amazonaws.com/openai/v1"
  );

  const fallback = getRuntimeLLMConfig({
    CLOUDAGENT_LLM_PROVIDER: "bedrock",
    CLOUDAGENT_LLM_API_KEY: "bedrock-key",
    CLOUDAGENT_LLM_MODEL: "model",
  });
  assert.equal(fallback.region, "us-east-1");
  assert.equal(
    fallback.baseURL,
    "https://bedrock-runtime.us-east-1.amazonaws.com/openai/v1"
  );

  const explicit = getRuntimeLLMConfig({
    CLOUDAGENT_LLM_PROVIDER: "bedrock",
    CLOUDAGENT_LLM_API_KEY: "bedrock-key",
    CLOUDAGENT_LLM_MODEL: "model",
    CLOUDAGENT_LLM_BASE_URL: "https://gateway.internal/openai/v1",
  });
  assert.equal(explicit.baseURL, "https://gateway.internal/openai/v1");
});

test("bedrock is unconfigured without both a key and a model", () => {
  assert.equal(
    getRuntimeLLMConfig({
      CLOUDAGENT_LLM_PROVIDER: "bedrock",
      CLOUDAGENT_LLM_API_KEY: "bedrock-key",
    }).configured,
    false
  );
  assert.equal(
    getRuntimeLLMConfig({
      CLOUDAGENT_LLM_PROVIDER: "bedrock",
      CLOUDAGENT_LLM_MODEL: "model",
    }).configured,
    false
  );
});

test("custom provider requires a base URL and model but not a key", () => {
  const config = getRuntimeLLMConfig({
    CLOUDAGENT_LLM_PROVIDER: "custom",
    CLOUDAGENT_LLM_BASE_URL: "http://localhost:4000/v1",
    CLOUDAGENT_LLM_MODEL: "llama-3.3-70b",
  });

  assert.equal(config.provider, "custom");
  assert.equal(config.apiKey, "");
  assert.equal(config.baseURL, "http://localhost:4000/v1");
  assert.equal(config.model, "llama-3.3-70b");
  assert.equal(config.configured, true);

  assert.equal(
    getRuntimeLLMConfig({
      CLOUDAGENT_LLM_PROVIDER: "custom",
      CLOUDAGENT_LLM_MODEL: "llama-3.3-70b",
    }).configured,
    false
  );
});

test("non-openai providers do not inherit the OpenAI env fallbacks", () => {
  const config = getRuntimeLLMConfig({
    CLOUDAGENT_LLM_PROVIDER: "custom",
    CLOUDAGENT_LLM_BASE_URL: "http://localhost:4000/v1",
    OPENAI_TOKEN: "legacy-key",
    OPENAI_MODEL: "gpt-legacy",
  });

  assert.equal(config.apiKey, "");
  assert.equal(config.model, "");
  assert.equal(config.configured, false);
});

test("unknown providers fall back to openai", () => {
  assert.equal(
    getRuntimeLLMConfig({ CLOUDAGENT_LLM_PROVIDER: "anthropic" }).provider,
    "openai"
  );
});

test("the openai provider always speaks the Responses API", () => {
  assert.equal(getRuntimeLLMConfig({ OPENAI_TOKEN: "key" }).protocol, "openai-responses");
  assert.equal(
    getRuntimeLLMConfig({
      OPENAI_TOKEN: "key",
      CLOUDAGENT_LLM_PROTOCOL: "openai-chat",
    }).protocol,
    "openai-responses"
  );
});

test("bedrock always speaks Chat Completions", () => {
  assert.equal(
    getRuntimeLLMConfig({
      CLOUDAGENT_LLM_PROVIDER: "bedrock",
      CLOUDAGENT_LLM_PROTOCOL: "openai-responses",
    }).protocol,
    "openai-chat"
  );
});

test("custom endpoints default to Chat Completions and honor the protocol env var", () => {
  const base = {
    CLOUDAGENT_LLM_PROVIDER: "custom",
    CLOUDAGENT_LLM_BASE_URL: "https://bedrock-mantle.us-east-1.api.aws/v1",
    CLOUDAGENT_LLM_MODEL: "openai.gpt-5.4",
  };

  assert.equal(getRuntimeLLMConfig(base).protocol, "openai-chat");
  assert.equal(
    getRuntimeLLMConfig({ ...base, CLOUDAGENT_LLM_PROTOCOL: "openai-responses" }).protocol,
    "openai-responses"
  );
  assert.equal(
    getRuntimeLLMConfig({ ...base, CLOUDAGENT_LLM_PROTOCOL: "anthropic-messages" }).protocol,
    "openai-chat"
  );
  assert.equal(
    getRuntimeLLMConfig({ ...base, CLOUDAGENT_LLM_PROTOCOL: "nonsense" }).protocol,
    "openai-chat"
  );
});

test("a custom endpoint on the Responses protocol only gains the responsesApi capability", () => {
  assert.deepEqual(
    getLLMCapabilities({
      CLOUDAGENT_LLM_PROVIDER: "custom",
      CLOUDAGENT_LLM_BASE_URL: "https://bedrock-mantle.us-east-1.api.aws/v1",
      CLOUDAGENT_LLM_MODEL: "openai.gpt-5.4",
      CLOUDAGENT_LLM_PROTOCOL: "openai-responses",
    }),
    {
      responsesApi: true,
      hostedWebSearch: false,
      jsonSchemaResponseFormat: false,
      reasoningEffort: false,
    }
  );
});

test("capabilities are enabled only for the openai provider", () => {
  assert.deepEqual(getLLMCapabilities({}), {
    responsesApi: true,
    hostedWebSearch: true,
    jsonSchemaResponseFormat: true,
    reasoningEffort: true,
  });

  assert.deepEqual(getLLMCapabilities({ CLOUDAGENT_LLM_PROVIDER: "bedrock" }), {
    responsesApi: false,
    hostedWebSearch: false,
    jsonSchemaResponseFormat: false,
    reasoningEffort: false,
  });

  assert.deepEqual(getLLMCapabilities({ CLOUDAGENT_LLM_PROVIDER: "custom" }), {
    responsesApi: false,
    hostedWebSearch: false,
    jsonSchemaResponseFormat: false,
    reasoningEffort: false,
  });
});
