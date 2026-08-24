import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import test from "node:test";

import { JsonFileStore } from "@cloudagent/storage";
import {
  applyLocalLLMSettingsFromStore,
  detectCustomEndpointProtocol,
  normalizeLocalLLMSettingsRecord,
  publicLocalLLMSettings,
  updateLocalLLMSettings,
  updateLocalOpenAISettings,
} from "../src/platform/llm.mjs";

const LLM_ENV_NAMES = [
  "ANTHROPIC_API_KEY",
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

// Local stand-in for a model endpoint: `routes` maps a pathname to a status
// code, anything else answers 404 like an unknown route.
async function createEndpointStub(t, routes) {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const status = routes[pathname] || 404;
    req.resume();
    req.on("end", () => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(status < 300 ? { ok: true } : { error: "not found" }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  return `http://127.0.0.1:${server.address().port}/v1`;
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
    protocols: { bedrock: "openai-chat" },
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
    () => updateLocalLLMSettings(store, { provider: "azure" }),
    (error) => error.status === 400 && /Unsupported model provider/.test(error.message)
  );
});

test("the anthropic provider needs a key and a model and forces its protocol", async (t) => {
  isolateEnvironment(t);
  const store = await createStore(t);

  const saved = await updateLocalLLMSettings(store, {
    provider: "anthropic",
    apiKey: "sk-ant-key",
    model: "claude-sonnet-5",
  });

  assert.equal(saved.provider, "anthropic");
  assert.equal(saved.protocol, "anthropic-messages");
  assert.equal(saved.model, "claude-sonnet-5");
  assert.equal(saved.baseUrl, "");
  assert.equal(saved.region, "");
  assert.equal(saved.hasApiKey, true);
  assert.equal(saved.configured, true);
  assert.equal(process.env.CLOUDAGENT_LLM_PROTOCOL, "anthropic-messages");
  assert.equal(process.env.CLOUDAGENT_LLM_BASE_URL, undefined);
  // The platform layer only reads ANTHROPIC_API_KEY as a fallback; the user's
  // own env var is never written or removed here.
  assert.equal(process.env.ANTHROPIC_API_KEY, undefined);
  assert.equal(process.env.OPENAI_TOKEN, undefined);

  // An AWS-hosted Anthropic endpoint is optional and surfaces as-is.
  const hosted = await updateLocalLLMSettings(store, {
    baseUrl: "https://bedrock-mantle.us-east-1.api.aws/anthropic/v1",
  });
  assert.equal(hosted.baseUrl, "https://bedrock-mantle.us-east-1.api.aws/anthropic/v1");
  assert.equal(hosted.protocol, "anthropic-messages");
  assert.equal(hosted.configured, true);
});

test("anthropic without a model is not configured", async (t) => {
  isolateEnvironment(t);
  const store = await createStore(t);

  const saved = await updateLocalLLMSettings(store, {
    provider: "anthropic",
    apiKey: "sk-ant-key",
    model: "",
  });
  assert.equal(saved.model, "");
  assert.equal(saved.configured, false);
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

test("openai forces its protocol while custom keeps the stored value", async (t) => {
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

  // Switching back to custom without sending a protocol keeps the saved choice.
  const back = await updateLocalLLMSettings(store, {
    provider: "custom",
    baseUrl: "https://bedrock-mantle.us-east-1.api.aws/v1",
    model: "openai.gpt-5.4",
  });
  assert.equal(back.protocol, "openai-responses");
});

test("custom and bedrock keep separate protocol preferences", async (t) => {
  isolateEnvironment(t);
  const store = await createStore(t);

  await updateLocalLLMSettings(store, {
    provider: "custom",
    baseUrl: "https://bedrock-mantle.us-east-1.api.aws/v1",
    model: "openai.gpt-5.4",
    protocol: "openai-responses",
  });

  // Bedrock no longer forces a protocol, so it accepts its own preference.
  const bedrock = await updateLocalLLMSettings(store, {
    provider: "bedrock",
    model: "anthropic.claude-sonnet-5",
    region: "us-east-1",
    baseUrl: "",
    protocol: "bedrock-converse",
  });
  assert.equal(bedrock.protocol, "bedrock-converse");
  // Converse signs with the AWS credential chain, so a model alone configures it.
  assert.equal(bedrock.hasApiKey, false);
  assert.equal(bedrock.configured, true);
  assert.equal(bedrock.baseUrl, "");

  const backToCustom = await updateLocalLLMSettings(store, { provider: "custom" });
  assert.equal(backToCustom.protocol, "openai-responses");

  const backToBedrock = await updateLocalLLMSettings(store, { provider: "bedrock" });
  assert.equal(backToBedrock.protocol, "bedrock-converse");
  assert.equal(process.env.CLOUDAGENT_LLM_PROTOCOL, "bedrock-converse");

  const record = await store.getSettings();
  assert.deepEqual(JSON.parse(record.settings).llm.protocols, {
    custom: "openai-responses",
    bedrock: "bedrock-converse",
  });
  assert.equal(record.llmProtocol, "bedrock-converse");

  await assert.rejects(
    () => updateLocalLLMSettings(store, { provider: "bedrock", protocol: "nonsense" }),
    (error) => error.status === 400 && /Unsupported model API/.test(error.message)
  );
});

test("a legacy single protocol field still applies to its own provider", (t) => {
  isolateEnvironment(t);

  const settings = normalizeLocalLLMSettingsRecord({
    llmProvider: "custom",
    llmProtocol: "openai-responses",
    llmModel: "openai.gpt-5.4",
    llmBaseUrl: "https://bedrock-mantle.us-east-1.api.aws/v1",
    settings: JSON.stringify({ llm: { provider: "custom", protocol: "openai-responses" } }),
  });
  assert.equal(settings.protocol, "openai-responses");

  // A protocol saved next to a different provider must not be inherited.
  const switched = normalizeLocalLLMSettingsRecord({
    llmProvider: "bedrock",
    llmModel: "anthropic.claude-sonnet-5",
    settings: JSON.stringify({ llm: { provider: "custom", protocol: "openai-responses" } }),
  });
  assert.equal(switched.protocol, "openai-chat");
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
    () => updateLocalLLMSettings(store, { provider: "custom", protocol: "nonsense" }),
    (error) => error.status === 400 && /Unsupported model API/.test(error.message)
  );
  assert.equal(publicLocalLLMSettings().protocol, "openai-chat");

  // anthropic-messages joined the allowlist, so a custom endpoint can select it.
  const native = await updateLocalLLMSettings(store, {
    provider: "custom",
    protocol: "anthropic-messages",
  });
  assert.equal(native.protocol, "anthropic-messages");
});

test("the protocol probe detects an Anthropic-only endpoint", async (t) => {
  isolateEnvironment(t);
  const baseUrl = await createEndpointStub(t, { "/v1/messages": 200 });

  const detected = await detectCustomEndpointProtocol({
    baseUrl,
    model: "claude-sonnet-5",
    apiKey: "endpoint-key",
  });
  assert.equal(detected, "anthropic-messages");
});

test("the protocol probe prefers a working Chat Completions endpoint", async (t) => {
  isolateEnvironment(t);
  const baseUrl = await createEndpointStub(t, {
    "/v1/chat/completions": 200,
    "/v1/messages": 200,
  });

  const detected = await detectCustomEndpointProtocol({ baseUrl, model: "llama-3.3" });
  assert.equal(detected, "openai-chat");
});

test("the protocol probe detects a Responses-only endpoint", async (t) => {
  isolateEnvironment(t);
  const baseUrl = await createEndpointStub(t, { "/v1/responses": 200 });

  const detected = await detectCustomEndpointProtocol({ baseUrl, model: "openai.gpt-5.4" });
  assert.equal(detected, "openai-responses");
});

test("the protocol probe stays inconclusive for an unreachable endpoint", async (t) => {
  isolateEnvironment(t);

  const detected = await detectCustomEndpointProtocol({
    baseUrl: "http://127.0.0.1:1/v1",
    model: "llama-3.3",
  });
  assert.equal(detected, null);
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
