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
    getRuntimeLLMConfig({ CLOUDAGENT_LLM_PROVIDER: "gemini" }).provider,
    "openai"
  );
});

test("the anthropic provider is always on the Messages protocol and has no default model", () => {
  const config = getRuntimeLLMConfig({
    CLOUDAGENT_LLM_PROVIDER: "anthropic",
    CLOUDAGENT_LLM_API_KEY: "anthropic-key",
    CLOUDAGENT_LLM_PROTOCOL: "openai-chat",
  });

  assert.equal(config.provider, "anthropic");
  assert.equal(config.protocol, "anthropic-messages");
  assert.equal(config.model, "");
  assert.equal(config.baseURL, "");
  assert.equal(config.configured, false);

  const configured = getRuntimeLLMConfig({
    CLOUDAGENT_LLM_PROVIDER: "anthropic",
    CLOUDAGENT_LLM_API_KEY: "anthropic-key",
    CLOUDAGENT_LLM_MODEL: "claude-sonnet-5",
  });
  assert.equal(configured.configured, true);
});

test("the anthropic provider falls back to ANTHROPIC_API_KEY", () => {
  const config = getRuntimeLLMConfig({
    CLOUDAGENT_LLM_PROVIDER: "anthropic",
    CLOUDAGENT_LLM_MODEL: "claude-sonnet-5",
    ANTHROPIC_API_KEY: " env-anthropic-key ",
  });
  assert.equal(config.apiKey, "env-anthropic-key");
  assert.equal(config.configured, true);

  assert.equal(
    getRuntimeLLMConfig({
      CLOUDAGENT_LLM_PROVIDER: "anthropic",
      CLOUDAGENT_LLM_API_KEY: "explicit-key",
      CLOUDAGENT_LLM_MODEL: "claude-sonnet-5",
      ANTHROPIC_API_KEY: "env-anthropic-key",
    }).apiKey,
    "explicit-key"
  );

  // Other providers do not inherit it.
  assert.equal(
    getRuntimeLLMConfig({
      CLOUDAGENT_LLM_PROVIDER: "bedrock",
      CLOUDAGENT_LLM_MODEL: "model",
      ANTHROPIC_API_KEY: "env-anthropic-key",
    }).apiKey,
    ""
  );
});

test("bedrock derives a base URL per protocol", () => {
  const base = {
    CLOUDAGENT_LLM_PROVIDER: "bedrock",
    CLOUDAGENT_LLM_API_KEY: "bedrock-key",
    CLOUDAGENT_LLM_MODEL: "model",
    CLOUDAGENT_LLM_REGION: "eu-west-1",
  };

  assert.equal(
    getRuntimeLLMConfig({ ...base, CLOUDAGENT_LLM_PROTOCOL: "openai-responses" }).baseURL,
    "https://bedrock-mantle.eu-west-1.api.aws/openai/v1"
  );
  assert.equal(
    getRuntimeLLMConfig({ ...base, CLOUDAGENT_LLM_PROTOCOL: "anthropic-messages" }).baseURL,
    "https://bedrock-mantle.eu-west-1.api.aws/anthropic/v1"
  );
  assert.equal(
    getRuntimeLLMConfig({ ...base, CLOUDAGENT_LLM_PROTOCOL: "bedrock-converse" }).baseURL,
    ""
  );
  assert.equal(
    getRuntimeLLMConfig({
      ...base,
      CLOUDAGENT_LLM_PROTOCOL: "anthropic-messages",
      CLOUDAGENT_LLM_BASE_URL: "https://gateway.internal/anthropic",
    }).baseURL,
    "https://gateway.internal/anthropic"
  );
});

test("bedrock on the Converse protocol is configured without an API key", () => {
  assert.equal(
    getRuntimeLLMConfig({
      CLOUDAGENT_LLM_PROVIDER: "bedrock",
      CLOUDAGENT_LLM_PROTOCOL: "bedrock-converse",
      CLOUDAGENT_LLM_MODEL: "us.deepseek.r1-v1:0",
    }).configured,
    true
  );
  assert.equal(
    getRuntimeLLMConfig({
      CLOUDAGENT_LLM_PROVIDER: "bedrock",
      CLOUDAGENT_LLM_PROTOCOL: "bedrock-converse",
    }).configured,
    false
  );
  assert.equal(
    getRuntimeLLMConfig({
      CLOUDAGENT_LLM_PROVIDER: "bedrock",
      CLOUDAGENT_LLM_PROTOCOL: "anthropic-messages",
      CLOUDAGENT_LLM_MODEL: "anthropic.claude-sonnet-5",
    }).configured,
    false
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

test("bedrock defaults to Chat Completions but keeps a stored protocol", () => {
  assert.equal(
    getRuntimeLLMConfig({ CLOUDAGENT_LLM_PROVIDER: "bedrock" }).protocol,
    "openai-chat"
  );
  for (const protocol of ["openai-responses", "anthropic-messages", "bedrock-converse"]) {
    assert.equal(
      getRuntimeLLMConfig({
        CLOUDAGENT_LLM_PROVIDER: "bedrock",
        CLOUDAGENT_LLM_PROTOCOL: protocol,
      }).protocol,
      protocol
    );
  }
  assert.equal(
    getRuntimeLLMConfig({
      CLOUDAGENT_LLM_PROVIDER: "bedrock",
      CLOUDAGENT_LLM_PROTOCOL: "nonsense",
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
    "anthropic-messages"
  );
  assert.equal(
    getRuntimeLLMConfig({ ...base, CLOUDAGENT_LLM_PROTOCOL: "bedrock-converse" }).protocol,
    "bedrock-converse"
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
      openaiWire: true,
      hostedWebSearch: false,
      jsonSchemaResponseFormat: false,
      reasoningEffort: false,
    }
  );
});

test("capabilities are enabled only for the openai provider", () => {
  assert.deepEqual(getLLMCapabilities({}), {
    responsesApi: true,
    openaiWire: true,
    hostedWebSearch: true,
    jsonSchemaResponseFormat: true,
    reasoningEffort: true,
  });

  assert.deepEqual(getLLMCapabilities({ CLOUDAGENT_LLM_PROVIDER: "bedrock" }), {
    responsesApi: false,
    openaiWire: true,
    hostedWebSearch: false,
    jsonSchemaResponseFormat: false,
    reasoningEffort: false,
  });

  assert.deepEqual(getLLMCapabilities({ CLOUDAGENT_LLM_PROVIDER: "custom" }), {
    responsesApi: false,
    openaiWire: true,
    hostedWebSearch: false,
    jsonSchemaResponseFormat: false,
    reasoningEffort: false,
  });
});

test("openaiWire is off for the native protocols", () => {
  assert.deepEqual(getLLMCapabilities({ CLOUDAGENT_LLM_PROVIDER: "anthropic" }), {
    responsesApi: false,
    openaiWire: false,
    hostedWebSearch: false,
    jsonSchemaResponseFormat: false,
    reasoningEffort: false,
  });

  assert.equal(
    getLLMCapabilities({
      CLOUDAGENT_LLM_PROVIDER: "bedrock",
      CLOUDAGENT_LLM_PROTOCOL: "bedrock-converse",
    }).openaiWire,
    false
  );
});
