const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const OPENAI_MODEL = process.env.OPENAI_MODEL || process.env.OPENAI_LOCAL_MODEL || "gpt-5.4";

const DEFAULT_OPENAI_MODEL = "gpt-5.4";
const DEFAULT_LLM_PROVIDER = "openai";
const LLM_PROVIDERS = ["openai", "anthropic", "bedrock", "custom"];
// Wire protocols the LLM layer knows how to speak. Add new values here without
// touching stored records.
const LLM_PROTOCOLS = [
  "openai-responses",
  "openai-chat",
  "anthropic-messages",
  "bedrock-converse",
];
const DEFAULT_LLM_PROTOCOL = "openai-chat";

function normalizeLLMProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  return LLM_PROVIDERS.includes(provider) ? provider : DEFAULT_LLM_PROVIDER;
}

// First-party providers speak exactly one protocol; bedrock and custom
// endpoints serve several catalogs, so a stored value sticks there.
function resolveLLMProtocol(provider, value) {
  if (provider === "openai") return "openai-responses";
  if (provider === "anthropic") return "anthropic-messages";
  const protocol = String(value || "").trim().toLowerCase();
  return LLM_PROTOCOLS.includes(protocol) ? protocol : DEFAULT_LLM_PROTOCOL;
}

function bedrockBaseURL(protocol, region) {
  if (protocol === "openai-responses") {
    return `https://bedrock-mantle.${region}.api.aws/openai/v1`;
  }
  if (protocol === "anthropic-messages") {
    return `https://bedrock-mantle.${region}.api.aws/anthropic/v1`;
  }
  // The AI SDK Bedrock provider builds the converse endpoint from the region.
  if (protocol === "bedrock-converse") return "";
  return `https://bedrock-runtime.${region}.amazonaws.com/openai/v1`;
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
    (provider === "openai"
      ? getRuntimeOpenAIKey(env)
      : provider === "anthropic"
        ? readEnv(env, "ANTHROPIC_API_KEY")
        : "");

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
  if (!baseURL && provider === "bedrock") baseURL = bedrockBaseURL(protocol, region);
  if (provider === "openai") baseURL = "";

  const configured =
    provider === "openai"
      ? Boolean(apiKey)
      : provider === "bedrock"
        ? // Converse falls back to the AWS credential chain when no Bedrock API
          // key is set, so a model alone is enough.
          protocol === "bedrock-converse"
          ? Boolean(model)
          : Boolean(apiKey && model)
        : provider === "anthropic"
          ? Boolean(apiKey && model)
          : Boolean(baseURL && model);

  return { provider, protocol, apiKey, model, baseURL, region, configured };
}

function getLLMCapabilities(env = process.env) {
  const { provider, protocol } = getRuntimeLLMConfig(env);
  const openai = provider === "openai";
  return {
    responsesApi: protocol === "openai-responses",
    openaiWire: protocol === "openai-responses" || protocol === "openai-chat",
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
  LLM_PROVIDERS,
  OPENAI_MODEL,
  getLLMCapabilities,
  getRuntimeLLMConfig,
  getRuntimeOpenAIKey,
  getRuntimeOpenAIModel,
  resolveLLMProtocol,
};
export default globals;
