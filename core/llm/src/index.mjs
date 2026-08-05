// Provider-aware LLM factories shared by the CloudAgent core packages.
// The wire protocol decides the API surface: `openai-responses` uses the
// Responses API, `openai-chat` the OpenAI-compatible Chat Completions API.

import OpenAI from "openai";
import { setTracingDisabled } from "@openai/agents";
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

export function createLLMClient({ maxRetries, timeout } = {}) {
  const config = getRuntimeLLMConfig();
  if (!config.configured) return null;
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

export async function generateText({ instructions, input, model } = {}) {
  const client = createLLMClient();
  if (!client) return null;
  const config = getRuntimeLLMConfig();
  const modelName = String(model || config.model || "").trim();

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
