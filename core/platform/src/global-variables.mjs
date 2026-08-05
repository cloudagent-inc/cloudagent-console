const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const OPENAI_MODEL = process.env.OPENAI_MODEL || process.env.OPENAI_LOCAL_MODEL || "gpt-5.4";

const DEFAULT_OPENAI_MODEL = "gpt-5.4";
const DEFAULT_LLM_PROVIDER = "openai";
const LLM_PROVIDERS = ["openai", "bedrock", "custom"];
// Wire protocols the LLM layer knows how to speak. Add new values here (e.g.
// "anthropic-messages") without touching stored records.
const LLM_PROTOCOLS = ["openai-responses", "openai-chat"];
const DEFAULT_LLM_PROTOCOL = "openai-chat";

function normalizeLLMProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  return LLM_PROVIDERS.includes(provider) ? provider : DEFAULT_LLM_PROVIDER;
}

// openai always speaks the Responses API, bedrock's compat endpoint always
// speaks Chat Completions; only custom endpoints are configurable.
function resolveLLMProtocol(provider, value) {
  if (provider === "openai") return "openai-responses";
  if (provider === "bedrock") return "openai-chat";
  const protocol = String(value || "").trim().toLowerCase();
  return LLM_PROTOCOLS.includes(protocol) ? protocol : DEFAULT_LLM_PROTOCOL;
}

function readEnv(env, key) {
  return String(env?.[key] || "").trim();
}

function getRuntimeOpenAIKey(env = process.env) {
  return String(env.OPENAI_TOKEN || env.OPENAI_API_KEY || "").trim();
}

function getRuntimeOpenAIModel(env = process.env) {
  return String(env.OPENAI_LOCAL_MODEL || env.OPENAI_MODEL || OPENAI_MODEL).trim() || OPENAI_MODEL;
}

function getRuntimeLLMConfig(env = process.env) {
  const provider = normalizeLLMProvider(env.CLOUDAGENT_LLM_PROVIDER);
  const protocol = resolveLLMProtocol(provider, env.CLOUDAGENT_LLM_PROTOCOL);

  const apiKey =
    readEnv(env, "CLOUDAGENT_LLM_API_KEY") ||
    (provider === "openai" ? getRuntimeOpenAIKey(env) : "");

  const model =
    readEnv(env, "CLOUDAGENT_LLM_MODEL") ||
    (provider === "openai"
      ? String(env.OPENAI_LOCAL_MODEL || env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim() ||
        DEFAULT_OPENAI_MODEL
      : "");

  const region =
    provider === "bedrock"
      ? readEnv(env, "CLOUDAGENT_LLM_REGION") ||
        readEnv(env, "AWS_REGION") ||
        readEnv(env, "AWS_DEFAULT_REGION") ||
        "us-east-1"
      : readEnv(env, "CLOUDAGENT_LLM_REGION");

  let baseURL = readEnv(env, "CLOUDAGENT_LLM_BASE_URL");
  if (!baseURL && provider === "bedrock") {
    baseURL = `https://bedrock-runtime.${region}.amazonaws.com/openai/v1`;
  }
  if (provider === "openai") baseURL = "";

  const configured =
    provider === "openai"
      ? Boolean(apiKey)
      : provider === "bedrock"
        ? Boolean(apiKey && model)
        : Boolean(baseURL && model);

  return { provider, protocol, apiKey, model, baseURL, region, configured };
}

function getLLMCapabilities(env = process.env) {
  const { provider, protocol } = getRuntimeLLMConfig(env);
  const openai = provider === "openai";
  return {
    responsesApi: protocol === "openai-responses",
    hostedWebSearch: openai,
    jsonSchemaResponseFormat: openai,
    reasoningEffort: openai,
  };
}

const globals = {
  AWS_REGION,
  OPENAI_MODEL,
};

export {
  AWS_REGION,
  DEFAULT_LLM_PROTOCOL,
  LLM_PROTOCOLS,
  OPENAI_MODEL,
  getLLMCapabilities,
  getRuntimeLLMConfig,
  getRuntimeOpenAIKey,
  getRuntimeOpenAIModel,
  resolveLLMProtocol,
};
export default globals;
