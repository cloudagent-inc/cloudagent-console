import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { JsonFileStore } from "@cloudagent/storage";
import {
  applyLocalLLMSettingsFromStore,
  normalizeLocalLLMSettingsRecord,
  publicLocalLLMSettings,
  updateLocalLLMSettings,
  updateLocalOpenAISettings,
} from "../src/platform/llm.mjs";

const LLM_ENV_NAMES = [
  "CLOUDAGENT_LLM_PROVIDER",
  "CLOUDAGENT_LLM_API_KEY",
  "CLOUDAGENT_LLM_MODEL",
  "CLOUDAGENT_LLM_BASE_URL",
  "CLOUDAGENT_LLM_REGION",
  "CLOUDAGENT_LLM_PROTOCOL",
  "OPENAI_TOKEN",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_LOCAL_MODEL",
];

function isolateEnvironment(t) {
  const previous = {};
  for (const name of LLM_ENV_NAMES) {
    previous[name] = process.env[name];
    delete process.env[name];
  }
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}

async function createStore(t) {
  const dataDir = await fs.mkdtemp(path.join(process.cwd(), ".cloudagent-llm-test-"));
  t.after(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  return new JsonFileStore({ dataDir }).init();
}

test("legacy openai settings records migrate to the openai provider", (t) => {
  isolateEnvironment(t);

  const settings = normalizeLocalLLMSettingsRecord({
    openaiApiKey: "sk-legacy-key",
    openaiModel: "gpt-legacy",
    settings: JSON.stringify({ theme: "dark" }),
  });

  assert.deepEqual(settings, {
    provider: "openai",
    protocol: "openai-responses",
    apiKey: "sk-legacy-key",
    model: "gpt-legacy",
    baseUrl: "",
    region: "",
  });
});

test("llm fields win over legacy openai fields", (t) => {
  isolateEnvironment(t);

  const settings = normalizeLocalLLMSettingsRecord({
    llmProvider: "custom",
    llmModel: "llama-3.3",
    llmBaseUrl: "https://gateway.internal/v1",
    llmApiKey: "gateway-key",
    openaiApiKey: "sk-legacy-key",
    openaiModel: "gpt-legacy",
  });

  assert.deepEqual(settings, {
    provider: "custom",
    protocol: "openai-chat",
    apiKey: "gateway-key",
    model: "llama-3.3",
    baseUrl: "https://gateway.internal/v1",
    region: "",
  });
});

test("applying a bedrock record sets CLOUDAGENT_LLM_* and clears OPENAI_*", async (t) => {
  isolateEnvironment(t);
  const store = await createStore(t);

  await updateLocalLLMSettings(store, {
    provider: "openai",
    apiKey: "sk-openai-key",
    model: "gpt-openai",
  });
  assert.equal(process.env.OPENAI_TOKEN, "sk-openai-key");
  assert.equal(process.env.OPENAI_MODEL, "gpt-openai");

  await updateLocalLLMSettings(store, {
    provider: "bedrock",
    apiKey: "bedrock-key",
    model: "openai.gpt-oss-120b-1:0",
    region: "eu-west-1",
  });
  await applyLocalLLMSettingsFromStore(store);

  assert.equal(process.env.CLOUDAGENT_LLM_PROVIDER, "bedrock");
  assert.equal(process.env.CLOUDAGENT_LLM_API_KEY, "bedrock-key");
  assert.equal(process.env.CLOUDAGENT_LLM_MODEL, "openai.gpt-oss-120b-1:0");
  assert.equal(process.env.CLOUDAGENT_LLM_REGION, "eu-west-1");
  assert.equal(process.env.OPENAI_TOKEN, undefined);
  assert.equal(process.env.OPENAI_API_KEY, undefined);
  assert.equal(process.env.OPENAI_MODEL, undefined);
  assert.equal(process.env.OPENAI_LOCAL_MODEL, undefined);

  const publicSettings = publicLocalLLMSettings();
  assert.equal(publicSettings.provider, "bedrock");
  assert.equal(publicSettings.model, "openai.gpt-oss-120b-1:0");
  assert.equal(publicSettings.region, "eu-west-1");
  assert.equal(publicSettings.baseUrl, "https://bedrock-runtime.eu-west-1.amazonaws.com/openai/v1");
  assert.equal(publicSettings.hasApiKey, true);
  assert.equal(publicSettings.configured, true);
  assert.equal(publicSettings.source, "preferences");
  assert.ok(!publicSettings.apiKeyMasked.includes("bedrock-key"));

  const record = await store.getSettings();
  assert.equal(record.llmProvider, "bedrock");
  assert.equal(record.llmApiKey, "bedrock-key");
  assert.equal(record.openaiApiKey, "sk-openai-key");
  assert.deepEqual(JSON.parse(record.settings).llm, {
    provider: "bedrock",
    protocol: "openai-chat",
    model: "openai.gpt-oss-120b-1:0",
    baseUrl: "",
    region: "eu-west-1",
    hasApiKey: true,
  });
});

test("a custom endpoint is only configured with a base URL and a model", async (t) => {
  isolateEnvironment(t);
  const store = await createStore(t);

  await updateLocalLLMSettings(store, { provider: "custom", model: "mistral-large" });
  assert.equal(publicLocalLLMSettings().configured, false);

  await updateLocalLLMSettings(store, { baseUrl: "https://litellm.internal/v1" });
  const publicSettings = publicLocalLLMSettings();
  assert.equal(publicSettings.provider, "custom");
  assert.equal(publicSettings.baseUrl, "https://litellm.internal/v1");
  assert.equal(publicSettings.configured, true);
});

test("updateLocalLLMSettings rejects unknown providers with a 400", async (t) => {
  isolateEnvironment(t);
  const store = await createStore(t);

  await assert.rejects(
    () => updateLocalLLMSettings(store, { provider: "anthropic" }),
    (error) => error.status === 400 && /Unsupported model provider/.test(error.message)
  );
});

test("clearApiKey drops the llm and legacy openai keys", async (t) => {
  isolateEnvironment(t);
  const store = await createStore(t);

  await updateLocalLLMSettings(store, {
    provider: "openai",
    apiKey: "sk-clear-me",
    model: "gpt-clear",
  });
  assert.equal(publicLocalLLMSettings().hasApiKey, true);

  const cleared = await updateLocalLLMSettings(store, { clearApiKey: true });
  assert.equal(cleared.hasApiKey, false);
  assert.equal(cleared.configured, false);
  assert.equal(cleared.source, "none");
  assert.equal(process.env.CLOUDAGENT_LLM_API_KEY, undefined);
  assert.equal(process.env.OPENAI_TOKEN, undefined);

  const record = await store.getSettings();
  assert.equal(record.llmApiKey, "");
  assert.equal(record.openaiApiKey, "");
  assert.equal(JSON.parse(record.settings).openai.hasApiKey, false);
});

test("the legacy openai settings alias forces the openai provider", async (t) => {
  isolateEnvironment(t);
  const store = await createStore(t);

  await updateLocalLLMSettings(store, {
    provider: "custom",
    baseUrl: "https://gateway.internal/v1",
    model: "llama-3.3",
    apiKey: "gateway-key",
  });

  const settings = await updateLocalOpenAISettings(store, {
    apiKey: "sk-alias-key",
    model: "gpt-alias",
  });

  assert.equal(settings.provider, "openai");
  assert.equal(settings.model, "gpt-alias");
  assert.equal(settings.baseUrl, "");
  assert.equal(settings.hasApiKey, true);
  assert.equal(process.env.OPENAI_TOKEN, "sk-alias-key");

  const record = await store.getSettings();
  assert.equal(record.llmProvider, "openai");
  assert.equal(record.openaiApiKey, "sk-alias-key");
  assert.equal(record.openaiModel, "gpt-alias");
});

test("switching providers does not leak the previous provider's base URL", async (t) => {
  isolateEnvironment(t);
  const store = await createStore(t);

  await updateLocalLLMSettings(store, {
    provider: "custom",
    baseUrl: "https://gateway.internal/v1",
    model: "llama-3.3",
    apiKey: "gateway-key",
  });

  await updateLocalLLMSettings(store, {
    provider: "bedrock",
    region: "us-east-1",
    model: "openai.gpt-oss-120b-1:0",
    apiKey: "bedrock-key",
    baseUrl: "",
  });

  assert.equal(process.env.CLOUDAGENT_LLM_BASE_URL, undefined);
  const publicSettings = publicLocalLLMSettings();
  assert.equal(
    publicSettings.baseUrl,
    "https://bedrock-runtime.us-east-1.amazonaws.com/openai/v1"
  );

  await updateLocalLLMSettings(store, {
    provider: "openai",
    model: "gpt-5.4",
    apiKey: "sk-back-again",
    baseUrl: "",
    region: "",
  });
  assert.equal(process.env.CLOUDAGENT_LLM_BASE_URL, undefined);
  assert.equal(publicLocalLLMSettings().baseUrl, "");
});

test("a custom endpoint persists the Responses protocol and exports it to the env", async (t) => {
  isolateEnvironment(t);
  const store = await createStore(t);

  const saved = await updateLocalLLMSettings(store, {
    provider: "custom",
    baseUrl: "https://bedrock-mantle.us-east-1.api.aws/v1",
    model: "openai.gpt-5.4",
    protocol: "openai-responses",
  });

  assert.equal(saved.protocol, "openai-responses");
  assert.equal(publicLocalLLMSettings().protocol, "openai-responses");
  assert.equal(process.env.CLOUDAGENT_LLM_PROTOCOL, "openai-responses");

  const record = await store.getSettings();
  assert.equal(record.llmProtocol, "openai-responses");
  assert.equal(JSON.parse(record.settings).llm.protocol, "openai-responses");

  await applyLocalLLMSettingsFromStore(store);
  assert.equal(publicLocalLLMSettings().protocol, "openai-responses");
});

test("openai and bedrock force their protocol regardless of the stored value", async (t) => {
  isolateEnvironment(t);
  const store = await createStore(t);

  await updateLocalLLMSettings(store, {
    provider: "custom",
    baseUrl: "https://bedrock-mantle.us-east-1.api.aws/v1",
    model: "openai.gpt-5.4",
    protocol: "openai-responses",
  });

  await updateLocalLLMSettings(store, { provider: "openai", apiKey: "sk-openai" });
  assert.equal(publicLocalLLMSettings().protocol, "openai-responses");

  await updateLocalLLMSettings(store, {
    provider: "bedrock",
    apiKey: "bedrock-key",
    model: "openai.gpt-oss-120b-1:0",
    region: "us-east-1",
  });
  assert.equal(publicLocalLLMSettings().protocol, "openai-chat");
  assert.equal(process.env.CLOUDAGENT_LLM_PROTOCOL, "openai-chat");

  // Switching back to custom without sending a protocol keeps the saved choice.
  const back = await updateLocalLLMSettings(store, {
    provider: "custom",
    baseUrl: "https://bedrock-mantle.us-east-1.api.aws/v1",
    model: "openai.gpt-5.4",
  });
  assert.equal(back.protocol, "openai-responses");
});

test("a custom endpoint defaults to Chat Completions and rejects unknown protocols", async (t) => {
  isolateEnvironment(t);
  const store = await createStore(t);

  const saved = await updateLocalLLMSettings(store, {
    provider: "custom",
    baseUrl: "https://litellm.internal/v1",
    model: "llama-3.3",
  });
  assert.equal(saved.protocol, "openai-chat");

  await assert.rejects(
    () => updateLocalLLMSettings(store, { provider: "custom", protocol: "anthropic-messages" }),
    (error) => error.status === 400 && /Unsupported model API/.test(error.message)
  );
  await assert.rejects(
    () => updateLocalLLMSettings(store, { provider: "custom", protocol: "nonsense" }),
    (error) => error.status === 400
  );
  assert.equal(publicLocalLLMSettings().protocol, "openai-chat");
});

test("the openai provider falls back to the default model", async (t) => {
  isolateEnvironment(t);
  const store = await createStore(t);

  const settings = await updateLocalLLMSettings(store, {
    provider: "openai",
    model: "",
    apiKey: "sk-default-model",
  });
  assert.equal(settings.model, "gpt-5.4");
});
