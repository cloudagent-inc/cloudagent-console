import assert from "node:assert/strict";
import test from "node:test";

import {
  createAgentModel,
  createLLMClient,
  getLLMCapabilities,
  getRuntimeLLMConfig,
  isLLMConfigured,
} from "../src/index.mjs";

const LLM_ENV_KEYS = [
  "CLOUDAGENT_LLM_PROVIDER",
  "CLOUDAGENT_LLM_API_KEY",
  "CLOUDAGENT_LLM_MODEL",
  "CLOUDAGENT_LLM_BASE_URL",
  "CLOUDAGENT_LLM_REGION",
  "CLOUDAGENT_LLM_PROTOCOL",
  "OPENAI_TOKEN",
  "OPENAI_API_KEY",
  "OPENAI_LOCAL_MODEL",
  "OPENAI_MODEL",
  "OPENAI_MAX_RETRIES",
  "OPENAI_TIMEOUT_MS",
];

function withEnv(env, fn) {
  const saved = new Map(LLM_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of LLM_ENV_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  try {
    return fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("no provider configured yields null factories", () => {
  withEnv({}, () => {
    assert.equal(isLLMConfigured(), false);
    assert.equal(createLLMClient(), null);
    assert.equal(createAgentModel(), null);
  });
});

test("openai provider builds a Responses model against the default base URL", () => {
  withEnv({ OPENAI_TOKEN: "openai-key", OPENAI_LOCAL_MODEL: "gpt-local" }, () => {
    assert.equal(isLLMConfigured(), true);
    assert.deepEqual(getLLMCapabilities().responsesApi, true);

    const client = createLLMClient();
    assert.equal(client.apiKey, "openai-key");
    assert.equal(String(client.baseURL), "https://api.openai.com/v1");

    const model = createAgentModel();
    assert.equal(model.constructor.name, "OpenAIResponsesModel");
  });
});

test("bedrock provider builds a Chat Completions model against the regional endpoint", () => {
  withEnv(
    {
      CLOUDAGENT_LLM_PROVIDER: "bedrock",
      CLOUDAGENT_LLM_API_KEY: "bedrock-key",
      CLOUDAGENT_LLM_MODEL: "openai.gpt-oss-120b-1:0",
      CLOUDAGENT_LLM_REGION: "eu-west-1",
    },
    () => {
      assert.equal(getLLMCapabilities().responsesApi, false);

      const client = createLLMClient();
      assert.equal(client.apiKey, "bedrock-key");
      assert.equal(
        String(client.baseURL),
        "https://bedrock-runtime.eu-west-1.amazonaws.com/openai/v1"
      );

      const model = createAgentModel();
      assert.equal(model.constructor.name, "OpenAIChatCompletionsModel");
    }
  );
});

test("custom provider works without an API key", () => {
  withEnv(
    {
      CLOUDAGENT_LLM_PROVIDER: "custom",
      CLOUDAGENT_LLM_BASE_URL: "http://localhost:4000/v1",
      CLOUDAGENT_LLM_MODEL: "llama-3.3-70b",
    },
    () => {
      assert.equal(isLLMConfigured(), true);

      const client = createLLMClient();
      assert.equal(client.apiKey, "not-needed");
      assert.equal(String(client.baseURL), "http://localhost:4000/v1");

      const model = createAgentModel();
      assert.equal(model.constructor.name, "OpenAIChatCompletionsModel");
    }
  );
});

test("a custom endpoint on the openai-responses protocol builds a Responses model", () => {
  withEnv(
    {
      CLOUDAGENT_LLM_PROVIDER: "custom",
      CLOUDAGENT_LLM_BASE_URL: "https://bedrock-mantle.us-east-1.api.aws/v1",
      CLOUDAGENT_LLM_MODEL: "openai.gpt-5.4",
      CLOUDAGENT_LLM_PROTOCOL: "openai-responses",
    },
    () => {
      assert.equal(getLLMCapabilities().responsesApi, true);
      assert.equal(getLLMCapabilities().hostedWebSearch, false);

      const client = createLLMClient();
      assert.equal(String(client.baseURL), "https://bedrock-mantle.us-east-1.api.aws/v1");

      const model = createAgentModel();
      assert.equal(model.constructor.name, "OpenAIResponsesModel");
    }
  );
});

test("bedrock stays on Chat Completions even when the protocol env var says otherwise", () => {
  withEnv(
    {
      CLOUDAGENT_LLM_PROVIDER: "bedrock",
      CLOUDAGENT_LLM_API_KEY: "bedrock-key",
      CLOUDAGENT_LLM_MODEL: "openai.gpt-oss-120b-1:0",
      CLOUDAGENT_LLM_PROTOCOL: "openai-responses",
    },
    () => {
      assert.equal(getRuntimeLLMConfig().protocol, "openai-chat");
      assert.equal(createAgentModel().constructor.name, "OpenAIChatCompletionsModel");
    }
  );
});

test("createAgentModel honors a model override", () => {
  withEnv(
    {
      CLOUDAGENT_LLM_PROVIDER: "custom",
      CLOUDAGENT_LLM_BASE_URL: "http://localhost:4000/v1",
      CLOUDAGENT_LLM_MODEL: "llama-3.3-70b",
    },
    () => {
      assert.equal(getRuntimeLLMConfig().model, "llama-3.3-70b");
      assert.ok(createAgentModel({ model: "mistral-large" }));
    }
  );
});

test("createLLMClient applies the OPENAI_MAX_RETRIES / OPENAI_TIMEOUT_MS knobs", () => {
  withEnv(
    {
      OPENAI_TOKEN: "openai-key",
      OPENAI_MAX_RETRIES: "5",
      OPENAI_TIMEOUT_MS: "300000",
    },
    () => {
      const client = createLLMClient();
      assert.equal(client.maxRetries, 5);
      assert.equal(client.timeout, 300_000);
    }
  );

  withEnv({ OPENAI_TOKEN: "openai-key" }, () => {
    const client = createLLMClient();
    assert.equal(client.maxRetries, 2);
    assert.equal(client.timeout, 120_000);
  });
});
