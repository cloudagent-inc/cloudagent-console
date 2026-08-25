// Provider-aware LLM factories shared by the CloudAgent core packages.
// The wire protocol decides the API surface: `openai-responses` uses the
// Responses API, `openai-chat` the OpenAI-compatible Chat Completions API,
// `anthropic-messages` and `bedrock-converse` go through the Vercel AI SDK.

import OpenAI from "openai";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText as aiGenerateText } from "ai";
import { setTracingDisabled } from "@openai/agents";
import { aisdk } from "@openai/agents-extensions";
import {
  OpenAIChatCompletionsModel,
  OpenAIResponsesModel,
  setDefaultOpenAIKey,
} from "@openai/agents-openai";
import {
  getLLMCapabilities,
  getRuntimeLLMConfig,
} from "@cloudagent/platform/global-variables";

export { getLLMCapabilities, getRuntimeLLMConfig };

export function isLLMConfigured() {
  return Boolean(getRuntimeLLMConfig().configured);
}

let awsCredentialChain = null;

// Bedrock without an API key signs with SigV4; the AI SDK provider only reads
// AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY on its own, so hand it the full AWS
// default chain (profiles, SSO, IMDS) the rest of the app already relies on.
async function resolveAWSCredentials() {
  if (!awsCredentialChain) {
    const { defaultProvider } = await import("@aws-sdk/credential-provider-node");
    awsCredentialChain = defaultProvider();
  }
  return awsCredentialChain();
}

function isAWSHostedEndpoint(baseURL) {
  try {
    return new URL(baseURL).hostname.endsWith(".api.aws");
  } catch {
    return false;
  }
}

// Builds the Vercel AI SDK language model for the native protocols.
function createAISDKModel(config, modelName) {
  if (config.protocol === "anthropic-messages") {
    // The provider appends "/messages" to baseURL, so it is passed through as
    // the API root. AWS-hosted endpoints take a bearer token and reject
    // requests carrying both it and the provider's default x-api-key header,
    // so that header is suppressed via an explicit undefined override.
    const bearer = Boolean(config.apiKey) && isAWSHostedEndpoint(config.baseURL);
    return createAnthropic({
      apiKey: config.apiKey || "not-needed",
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
      ...(bearer
        ? { headers: { Authorization: `Bearer ${config.apiKey}`, "x-api-key": undefined } }
        : {}),
    })(modelName);
  }
  return createAmazonBedrock({
    region: config.region || "us-east-1",
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    ...(config.apiKey
      ? { apiKey: config.apiKey }
      : { credentialProvider: resolveAWSCredentials }),
  })(modelName);
}

export function createLLMClient({ maxRetries, timeout } = {}) {
  const config = getRuntimeLLMConfig();
  if (!config.configured) return null;
  if (!getLLMCapabilities().openaiWire) return null;
  return new OpenAI({
    apiKey: config.apiKey || "not-needed",
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    maxRetries: Math.max(
      0,
      Number(maxRetries ?? process.env.OPENAI_MAX_RETRIES ?? 2)
    ),
    timeout: Math.max(
      30_000,
      Number(timeout ?? process.env.OPENAI_TIMEOUT_MS ?? 120_000)
    ),
  });
}

export function createAgentModel({ model } = {}) {
  const config = getRuntimeLLMConfig();
  if (!config.configured) return null;
  const modelName = String(model || config.model || "").trim();

  if (config.provider === "openai") setDefaultOpenAIKey(config.apiKey);
  else setTracingDisabled(true);

  if (!getLLMCapabilities().openaiWire) {
    return aisdk(createAISDKModel(config, modelName));
  }

  if (getLLMCapabilities().responsesApi) {
    const client = new OpenAI({
      apiKey: config.apiKey || "not-needed",
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    });
    return new OpenAIResponsesModel(client, modelName);
  }

  const client = new OpenAI({
    apiKey: config.apiKey || "not-needed",
    baseURL: config.baseURL,
  });
  return new OpenAIChatCompletionsModel(client, modelName);
}

function extractOutputText(response) {
  if (typeof response?.output_text === "string") return response.output_text;
  if (Array.isArray(response?.output_text)) return response.output_text.join("\n");
  const chunks = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && content?.text) chunks.push(content.text);
      else if (typeof content?.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

export async function generateText({ instructions, input, model, maxRetries } = {}) {
  const config = getRuntimeLLMConfig();
  if (!config.configured) return null;
  const modelName = String(model || config.model || "").trim();

  if (!getLLMCapabilities().openaiWire) {
    const { text } = await aiGenerateText({
      model: createAISDKModel(config, modelName),
      system: instructions,
      prompt: input,
      // Left unset so the AI SDK keeps its own default retry count.
      ...(maxRetries === undefined ? {} : { maxRetries: Math.max(0, Number(maxRetries)) }),
    });
    return text;
  }

  const client = createLLMClient({ maxRetries });
  if (!client) return null;

  if (getLLMCapabilities().responsesApi) {
    const response = await client.responses.create({
      model: modelName,
      instructions,
      input,
    });
    return extractOutputText(response);
  }

  const completion = await client.chat.completions.create({
    model: modelName,
    messages: [
      { role: "system", content: instructions },
      { role: "user", content: input },
    ],
  });
  return completion?.choices?.[0]?.message?.content ?? "";
}
