import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import {
  createAgentModel,
  createLLMClient,
  generateText,
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
  "ANTHROPIC_API_KEY",
  "AWS_REGION",
  "AWS_DEFAULT_REGION",
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

test("bedrock honors a stored protocol and switches to the Mantle endpoint", () => {
  withEnv(
    {
      CLOUDAGENT_LLM_PROVIDER: "bedrock",
      CLOUDAGENT_LLM_API_KEY: "bedrock-key",
      CLOUDAGENT_LLM_MODEL: "openai.gpt-5.4",
      CLOUDAGENT_LLM_REGION: "us-east-1",
      CLOUDAGENT_LLM_PROTOCOL: "openai-responses",
    },
    () => {
      assert.equal(getRuntimeLLMConfig().protocol, "openai-responses");
      assert.equal(
        String(createLLMClient().baseURL),
        "https://bedrock-mantle.us-east-1.api.aws/openai/v1"
      );
      assert.equal(createAgentModel().constructor.name, "OpenAIResponsesModel");
    }
  );
});

function assertAdapterModel(model) {
  assert.notEqual(model, null);
  assert.notEqual(model.constructor.name, "OpenAIResponsesModel");
  assert.notEqual(model.constructor.name, "OpenAIChatCompletionsModel");
  assert.equal(model.constructor.name, "AiSdkModel");
  assert.equal(typeof model.getResponse, "function");
  assert.equal(typeof model.getStreamedResponse, "function");
}

test("the anthropic provider builds an AI SDK adapter model and no OpenAI client", () => {
  withEnv(
    {
      CLOUDAGENT_LLM_PROVIDER: "anthropic",
      CLOUDAGENT_LLM_API_KEY: "anthropic-key",
      CLOUDAGENT_LLM_MODEL: "claude-sonnet-5",
    },
    () => {
      assert.equal(isLLMConfigured(), true);
      assert.equal(getLLMCapabilities().openaiWire, false);
      assert.equal(createLLMClient(), null);
      assertAdapterModel(createAgentModel());
    }
  );
});

test("bedrock on anthropic-messages targets the Mantle Anthropic endpoint", () => {
  withEnv(
    {
      CLOUDAGENT_LLM_PROVIDER: "bedrock",
      CLOUDAGENT_LLM_PROTOCOL: "anthropic-messages",
      CLOUDAGENT_LLM_API_KEY: "bedrock-key",
      CLOUDAGENT_LLM_MODEL: "anthropic.claude-sonnet-5",
      CLOUDAGENT_LLM_REGION: "us-west-2",
    },
    () => {
      const config = getRuntimeLLMConfig();
      assert.equal(config.baseURL, "https://bedrock-mantle.us-west-2.api.aws/anthropic/v1");
      assert.equal(createLLMClient(), null);
      assertAdapterModel(createAgentModel());
    }
  );
});

test("bedrock-converse builds an adapter model without an API key", () => {
  withEnv(
    {
      CLOUDAGENT_LLM_PROVIDER: "bedrock",
      CLOUDAGENT_LLM_PROTOCOL: "bedrock-converse",
      CLOUDAGENT_LLM_MODEL: "us.deepseek.r1-v1:0",
      CLOUDAGENT_LLM_REGION: "eu-central-1",
    },
    () => {
      const config = getRuntimeLLMConfig();
      assert.equal(config.configured, true);
      assert.equal(config.apiKey, "");
      assert.equal(config.baseURL, "");
      assert.equal(createLLMClient(), null);
      assertAdapterModel(createAgentModel());
      assertAdapterModel(createAgentModel({ model: "meta.llama3-70b-instruct-v1:0" }));
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

test("generateText forwards maxRetries to the OpenAI-wire client", async () => {
  let requestCount = 0;
  const server = http.createServer((req, res) => {
    requestCount += 1;
    req.resume();
    req.on("end", () => {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "stub failure" } }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;

  try {
    const env = {
      CLOUDAGENT_LLM_PROVIDER: "custom",
      CLOUDAGENT_LLM_PROTOCOL: "openai-chat",
      CLOUDAGENT_LLM_BASE_URL: baseUrl,
      CLOUDAGENT_LLM_MODEL: "stub-model",
    };

    await assert.rejects(() =>
      withEnv(env, () => generateText({ instructions: "s", input: "i", maxRetries: 0 }))
    );
    assert.equal(requestCount, 1);

    requestCount = 0;
    await assert.rejects(() =>
      withEnv(env, () => generateText({ instructions: "s", input: "i", maxRetries: 1 }))
    );
    assert.equal(requestCount, 2);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
