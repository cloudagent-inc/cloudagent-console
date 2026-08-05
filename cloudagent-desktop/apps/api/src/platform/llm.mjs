import { generateText, getRuntimeLLMConfig } from "@cloudagent/llm";
import { LLM_PROTOCOLS, resolveLLMProtocol } from "@cloudagent/platform/global-variables";
import { safeJsonParse } from "@cloudagent/platform/utils";

const DEFAULT_LOCAL_MODEL = "gpt-5.4";
const LLM_PROVIDERS = ["openai", "bedrock", "custom"];
let localLLMConfigSource = "environment";

function normalizeProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  return LLM_PROVIDERS.includes(provider) ? provider : "openai";
}

function requireProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  if (!LLM_PROVIDERS.includes(provider)) {
    const error = new Error(
      `Unsupported model provider "${value}". Expected one of: ${LLM_PROVIDERS.join(", ")}.`
    );
    error.status = 400;
    throw error;
  }
  return provider;
}

function requireProtocol(value) {
  const protocol = String(value || "").trim().toLowerCase();
  if (!LLM_PROTOCOLS.includes(protocol)) {
    const error = new Error(
      `Unsupported model API "${value}". Expected one of: ${LLM_PROTOCOLS.join(", ")}.`
    );
    error.status = 400;
    throw error;
  }
  return protocol;
}

function maskLLMApiKey(value) {
  const key = String(value || "").trim();
  if (!key) return "";
  if (key.length <= 12) return "••••";
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

function getEnvOpenAIModel() {
  return (
    process.env.OPENAI_LOCAL_MODEL ||
    process.env.OPENAI_MODEL ||
    DEFAULT_LOCAL_MODEL
  );
}

export function normalizeLocalLLMSettingsRecord(settingsRecord = {}) {
  const userSettings = safeJsonParse(settingsRecord?.settings, {});
  const llmSettings =
    userSettings?.llm && typeof userSettings.llm === "object" ? userSettings.llm : {};
  const openaiSettings =
    userSettings?.openai && typeof userSettings.openai === "object"
      ? userSettings.openai
      : {};

  const legacyApiKey = String(
    settingsRecord?.openaiApiKey ||
      settingsRecord?.openai?.apiKey ||
      settingsRecord?.openAI?.apiKey ||
      ""
  ).trim();
  const legacyModel = String(
    settingsRecord?.openaiModel || settingsRecord?.openai?.model || openaiSettings.model || ""
  ).trim();

  const storedProvider = String(
    settingsRecord?.llmProvider || llmSettings.provider || ""
  ).trim();
  const provider = normalizeProvider(
    storedProvider ||
      (legacyApiKey || legacyModel ? "openai" : "") ||
      process.env.CLOUDAGENT_LLM_PROVIDER
  );
  // Once a provider has been saved through preferences, the stored record is
  // authoritative; env fallbacks would resurrect values applied for a
  // previously selected provider.
  const recordIsAuthoritative = Boolean(storedProvider);

  const apiKey =
    String(settingsRecord?.llmApiKey || "").trim() ||
    (provider === "openai"
      ? legacyApiKey
      : recordIsAuthoritative
        ? ""
        : String(process.env.CLOUDAGENT_LLM_API_KEY || "").trim());

  const model =
    String(settingsRecord?.llmModel || llmSettings.model || "").trim() ||
    (provider === "openai" ? legacyModel : "") ||
    (provider === "openai"
      ? getEnvOpenAIModel()
      : recordIsAuthoritative
        ? ""
        : String(process.env.CLOUDAGENT_LLM_MODEL || "").trim());

  const baseUrl =
    provider === "openai"
      ? ""
      : String(
          settingsRecord?.llmBaseUrl ||
            llmSettings.baseUrl ||
            (recordIsAuthoritative ? "" : process.env.CLOUDAGENT_LLM_BASE_URL) ||
            ""
        ).trim();

  const region =
    provider === "openai"
      ? ""
      : String(
          settingsRecord?.llmRegion ||
            llmSettings.region ||
            (recordIsAuthoritative ? "" : process.env.CLOUDAGENT_LLM_REGION) ||
            ""
        ).trim();

  const protocol = resolveLLMProtocol(
    provider,
    settingsRecord?.llmProtocol ||
      llmSettings.protocol ||
      (recordIsAuthoritative ? "" : process.env.CLOUDAGENT_LLM_PROTOCOL) ||
      ""
  );

  return { provider, protocol, apiKey, model, baseUrl, region };
}

export async function applyLocalLLMSettingsFromStore(store) {
  if (!store || typeof store.getSettings !== "function") return getLocalLLMConfig();
  const settingsRecord = await store.getSettings().catch(() => null);
  const settings = normalizeLocalLLMSettingsRecord(settingsRecord || {});

  // Set-or-delete so values from a previously selected provider cannot leak
  // into the current one through stale env vars.
  const applyEnv = (key, value) => {
    if (value) process.env[key] = value;
    else delete process.env[key];
  };
  process.env.CLOUDAGENT_LLM_PROVIDER = settings.provider;
  process.env.CLOUDAGENT_LLM_PROTOCOL = settings.protocol;
  applyEnv("CLOUDAGENT_LLM_API_KEY", settings.apiKey);
  applyEnv("CLOUDAGENT_LLM_MODEL", settings.model);
  applyEnv("CLOUDAGENT_LLM_BASE_URL", settings.baseUrl);
  applyEnv("CLOUDAGENT_LLM_REGION", settings.region);

  if (settings.provider === "openai") {
    if (settings.apiKey) {
      process.env.OPENAI_TOKEN = settings.apiKey;
      process.env.OPENAI_API_KEY = settings.apiKey;
    }
    if (settings.model) {
      process.env.OPENAI_LOCAL_MODEL = settings.model;
      process.env.OPENAI_MODEL = settings.model;
    }
  } else {
    delete process.env.OPENAI_TOKEN;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_LOCAL_MODEL;
  }

  const record = settingsRecord || {};
  const storedConfig = Boolean(
    String(record.llmApiKey || record.openaiApiKey || "").trim() ||
      (settings.provider === "custom" && String(record.llmBaseUrl || "").trim())
  );
  if (storedConfig) {
    localLLMConfigSource = "preferences";
  } else {
    localLLMConfigSource = getRuntimeLLMConfig().configured ? "environment" : "none";
  }
  return getLocalLLMConfig();
}

export function getLocalLLMConfig() {
  const config = getRuntimeLLMConfig();
  const known = Boolean(config.apiKey || config.configured);
  return {
    provider: config.provider,
    protocol: config.protocol,
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: config.baseURL,
    region: config.region,
    configured: Boolean(config.configured),
    hasApiKey: Boolean(config.apiKey),
    apiKeyMasked: maskLLMApiKey(config.apiKey),
    source: known ? localLLMConfigSource : "none",
  };
}

export function publicLocalLLMSettings() {
  const config = getLocalLLMConfig();
  return {
    provider: config.provider,
    protocol: config.protocol,
    model: config.model,
    baseUrl: config.baseUrl,
    region: config.region,
    hasApiKey: config.hasApiKey,
    apiKeyMasked: config.apiKeyMasked,
    source: config.source,
    configured: config.configured,
  };
}

const PROTOCOL_PROBE_TIMEOUT_MS = 8000;

function isUnsupportedApiError(error, apiPath) {
  return (
    typeof error?.status === "number" &&
    new RegExp(`does not support the '${apiPath.replace(/\//g, "\\/")}' API`, "i").test(
      String(error?.message || "")
    )
  );
}

// Custom endpoints differ in which OpenAI API they serve (e.g. Bedrock Mantle
// GPT models are Responses-only). Probe with a ~1-token request at save time
// so users never have to pick a wire protocol. Returns null when the probe is
// inconclusive (network failure, auth error), leaving the stored value alone.
export async function detectCustomEndpointProtocol({ baseUrl, model, apiKey } = {}) {
  if (!baseUrl || !model) return null;
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: apiKey || "not-needed",
    baseURL: baseUrl,
    maxRetries: 0,
    timeout: PROTOCOL_PROBE_TIMEOUT_MS,
  });
  try {
    await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    });
    return "openai-chat";
  } catch (error) {
    if (!isUnsupportedApiError(error, "/v1/chat/completions")) return null;
  }
  try {
    await client.responses.create({ model, input: "ping", max_output_tokens: 16 });
    return "openai-responses";
  } catch (error) {
    // The endpoint rejected chat completions outright; a responses failure for
    // any reason other than "unsupported API" still means responses is the
    // better protocol for this model.
    return isUnsupportedApiError(error, "/v1/responses") ? null : "openai-responses";
  }
}

export async function updateLocalLLMSettings(store, patch = {}, { probeProtocol = false } = {}) {
  if (!store || typeof store.updateSettings !== "function") {
    throw new Error("Local settings store is not available");
  }

  const existing = await store.getSettings();
  const existingUserSettings = safeJsonParse(existing?.settings, {});
  const current = normalizeLocalLLMSettingsRecord(existing || {});

  const provider =
    patch.provider !== undefined ? requireProvider(patch.provider) : current.provider;
  const rawModel =
    patch.model !== undefined ? String(patch.model || "").trim() : current.model;
  const nextModel =
    provider === "openai" ? rawModel || DEFAULT_LOCAL_MODEL : rawModel;
  const nextBaseUrl =
    provider === "openai"
      ? ""
      : patch.baseUrl !== undefined
        ? String(patch.baseUrl || "").trim()
        : current.baseUrl;
  const nextRegion =
    provider === "openai"
      ? ""
      : patch.region !== undefined
        ? String(patch.region || "").trim()
        : current.region;
  // openai/bedrock force their protocol at read time, so the stored value is
  // always the custom-endpoint preference and survives a provider switch.
  const storedProtocol = String(
    existing?.llmProtocol ||
      (existingUserSettings.llm && typeof existingUserSettings.llm === "object"
        ? existingUserSettings.llm.protocol
        : "") ||
      ""
  ).trim();
  const hasApiKeyPatch = Object.prototype.hasOwnProperty.call(patch, "apiKey");
  const nextApiKey = hasApiKeyPatch ? String(patch.apiKey || "").trim() : current.apiKey;
  const clearApiKey = Boolean(patch.clearApiKey);

  let nextProtocol =
    provider === "custom" && patch.protocol !== undefined
      ? requireProtocol(patch.protocol)
      : resolveLLMProtocol(
          "custom",
          storedProtocol || (current.provider === "custom" ? current.protocol : "")
        );
  if (probeProtocol && provider === "custom" && patch.protocol === undefined) {
    const detected = await detectCustomEndpointProtocol({
      baseUrl: nextBaseUrl,
      model: nextModel,
      apiKey: clearApiKey ? "" : nextApiKey,
    }).catch(() => null);
    if (detected) nextProtocol = detected;
  }

  const nextUserSettings = {
    ...existingUserSettings,
    llm: {
      provider,
      protocol: nextProtocol,
      model: nextModel,
      baseUrl: nextBaseUrl,
      region: nextRegion,
      hasApiKey: clearApiKey ? false : Boolean(nextApiKey),
    },
    ...(provider === "openai"
      ? {
          openai: {
            ...(existingUserSettings.openai && typeof existingUserSettings.openai === "object"
              ? existingUserSettings.openai
              : {}),
            model: nextModel,
            hasApiKey: clearApiKey ? false : Boolean(nextApiKey),
          },
        }
      : {}),
  };

  await store.updateSettings({
    settings: JSON.stringify(nextUserSettings),
    llmProvider: provider,
    llmProtocol: nextProtocol,
    llmModel: nextModel,
    llmBaseUrl: nextBaseUrl,
    llmRegion: nextRegion,
    ...(provider === "openai" ? { openaiModel: nextModel } : {}),
    ...(clearApiKey ? { llmApiKey: "", openaiApiKey: "" } : {}),
    ...(!clearApiKey && hasApiKeyPatch && nextApiKey
      ? {
          llmApiKey: nextApiKey,
          ...(provider === "openai" ? { openaiApiKey: nextApiKey } : {}),
        }
      : {}),
  });

  if (clearApiKey) {
    delete process.env.CLOUDAGENT_LLM_API_KEY;
    delete process.env.OPENAI_TOKEN;
    delete process.env.OPENAI_API_KEY;
    localLLMConfigSource = "none";
  }
  await applyLocalLLMSettingsFromStore(store);
  return publicLocalLLMSettings();
}

export function getLocalLLMApiKey() {
  return getRuntimeLLMConfig().apiKey;
}

export function isLocalLLMConfigured() {
  return Boolean(getRuntimeLLMConfig().configured);
}

export const normalizeLocalOpenAISettingsRecord = normalizeLocalLLMSettingsRecord;
export const applyLocalOpenAISettingsFromStore = applyLocalLLMSettingsFromStore;
export const getLocalOpenAIConfig = getLocalLLMConfig;
export const publicLocalOpenAISettings = publicLocalLLMSettings;
export const getLocalOpenAIKey = getLocalLLMApiKey;
export const isLocalOpenAIConfigured = isLocalLLMConfigured;

export async function updateLocalOpenAISettings(store, patch = {}) {
  return updateLocalLLMSettings(store, { ...patch, provider: "openai" });
}

function redactSensitive(value) {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== "object") return value;

  const redacted = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/secret|token|password|private|accessKeyId|sessionToken/i.test(key)) {
      redacted[key] = "[redacted]";
    } else {
      redacted[key] = redactSensitive(entry);
    }
  }
  return redacted;
}

function truncateString(value, maxLength = 1000) {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function compactValue(value, { maxArray = 30, maxDepth = 5, maxString = 1000 } = {}, depth = 0) {
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return truncateString(value, maxString);
  if (depth >= maxDepth) return "[truncated]";
  if (Array.isArray(value)) {
    return value.slice(0, maxArray).map((item) =>
      compactValue(item, { maxArray, maxDepth, maxString }, depth + 1)
    );
  }
  if (typeof value === "object") {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = compactValue(entry, { maxArray, maxDepth, maxString }, depth + 1);
    }
    return out;
  }
  return String(value);
}

function parseJsonLoose(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeProfiles(profiles = []) {
  return profiles.map((profile) => {
    const authProfile =
      typeof profile?.authProfile === "string"
        ? parseJsonLoose(profile.authProfile) || {}
        : profile?.authProfile || {};
    return {
      recordId: profile?.recordId,
      name: profile?.name,
      type: profile?.type,
      description: profile?.description,
      authProfile: redactSensitive(authProfile),
      deploymentPreferences: redactSensitive(profile?.deploymentPreferences),
      summary: profile?.summary ? compactValue(profile.summary) : undefined,
    };
  });
}

function normalizeWorkloads(workloads = []) {
  return workloads.map((workload) => ({
    workloadId: workload?.workloadId,
    name: workload?.name || workload?.workloadName,
    workloadName: workload?.workloadName || workload?.name,
    description: workload?.description,
    environments: workload?.environments,
    trackedResources: compactValue(workload?.trackedResources),
    deploymentPreferences: compactValue(workload?.deploymentPreferences),
    summary: workload?.summary ? compactValue(workload.summary) : undefined,
  }));
}

export async function generateChatReply({ message, state } = {}) {
  if (!isLocalLLMConfigured()) return null;
  const profiles = await state.store.listPermissionProfiles();
  const workloads = await state.store.listWorkloads();
  const context = {
    runtime: "local",
    userMessage: message,
    commandCenter: {
      limits: state.limits,
    },
    environments: normalizeProfiles(profiles),
    workloads: normalizeWorkloads(workloads),
  };

  return generateText({
    instructions: [
      "You are CloudAgent running in local desktop mode.",
      "Use only the provided local file context. Do not claim access to hosted backend data.",
      "Cloud mode-only dashboards, reports, recommendations, health, and cost are unavailable unless present in local context.",
      "Never reveal or ask the user to paste secrets. Credential fields may be redacted.",
      "Give concise, practical answers and point users to Cloud Setup, Workloads, or Executive Summaries when relevant.",
    ].join("\n"),
    input: JSON.stringify(context),
  });
}

function normalizeGeneratedTitle(value) {
  const title = String(value || "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^[-*]\s+/, "")
    .replace(/^(chat\s+title|title)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.:-]+$/g, "")
    .trim();
  if (!title) return "";
  return title.length > 72 ? title.slice(0, 72).trim() : title;
}

export async function generateLocalCommandCenterTitle({
  messages = [],
  currentTitle = "",
  milestone = null,
  agentRunner = "cloudagent",
} = {}) {
  if (!isLocalLLMConfigured()) return null;
  const context = {
    runtime: "local",
    milestone,
    agentRunner,
    currentTitle,
    messages: (Array.isArray(messages) ? messages : [])
      .filter((message) => message && typeof message === "object")
      .slice(-24)
      .map((message) => ({
        role: String(message.role || "").trim() === "user" ? "user" : "assistant",
        content: truncateString(message.content ?? message.text ?? "", 1800),
      }))
      .filter((message) => message.content.trim()),
  };

  const text = await generateText({
    instructions: [
      "Create a short title for this CloudAgent Command Center conversation.",
      "Return only the title, with no quotes, no markdown, no explanation, and no trailing punctuation.",
      "Keep it specific to the user's cloud operations goal, investigation, report, environment, workload, or external-agent task.",
      "Use 3-7 words when possible and stay under 72 characters.",
      "Avoid generic titles like Command Center, CloudAgent Chat, or New Chat unless there is no meaningful topic.",
    ].join("\n"),
    input: JSON.stringify(context),
  });
  return normalizeGeneratedTitle(text);
}

export async function generateLocalExecutiveSummaryWithOpenAI({
  scope,
  target,
  relatedProfiles = [],
  relatedWorkloads = [],
  analysisContext = {},
  fallbackSummaryText = "",
} = {}) {
  if (!isLocalLLMConfigured()) return null;
  const context = {
    runtime: "local",
    scope,
    target: redactSensitive(compactValue(target)),
    relatedProfiles: normalizeProfiles(relatedProfiles),
    relatedWorkloads: normalizeWorkloads(relatedWorkloads),
    analysisContext: compactValue(analysisContext, { maxArray: 20, maxDepth: 5, maxString: 1500 }),
    fallbackSummaryText,
  };

  return generateText({
    instructions: [
      "Write an executive summary for CloudAgent local mode in Markdown.",
      "Use only local environment/workload metadata and local scanner artifacts provided in the input.",
      "Prioritize evidence in this order: inventory data, health data, then cost data.",
      "Do not rely on data sources outside the provided metadata and scanner artifacts.",
      "If inventory, health, or cost data is absent, state that the specific data source is not available yet.",
      "Keep it business-readable: Overview, Key Observations, Data Coverage, Recommended Next Actions.",
      "Do not expose secrets or credential details.",
    ].join("\n"),
    input: JSON.stringify(context),
  });
}

export async function generateLocalAgentRunSummaryWithOpenAI({
  title,
  runner,
  status,
  finalOutput = "",
  eventSummary = {},
  fallbackSummaryText = "",
} = {}) {
  if (!isLocalLLMConfigured()) return null;
  const context = {
    runtime: "local",
    title,
    runner,
    status,
    finalOutput: truncateString(finalOutput, 24_000),
    eventSummary: compactValue(eventSummary, { maxArray: 80, maxDepth: 6, maxString: 2000 }),
    fallbackSummaryText: truncateString(fallbackSummaryText, 8000),
  };

  return generateText({
    instructions: [
      "Write only a short final result summary for this external agent skill run.",
      "Use 2-4 concise sentences or up to 4 short bullets. Do not include headings, transcript excerpts, session history, or terminal output.",
      "Summarize what the agent found or changed according to the skill goal.",
      "Mention concrete findings, counts, account/region identifiers, affected resources, blockers, and follow-up only when they are present in the provided transcript.",
      "Do not copy the final agent message verbatim. Do not invent AWS results or actions. Do not expose secrets.",
    ].join("\n"),
    input: JSON.stringify(context),
  });
}

export async function generateLocalExternalAgentExecutionContextWithOpenAI({
  title,
  runner,
  blueprint = {},
  planPayload = {},
  preflight = {},
  executionContext = {},
  authSummary = {},
  regions = [],
  defaultValues = {},
  executionPreferences = {},
  localDataSnapshot = {},
  fallbackContextText = "",
} = {}) {
  if (!isLocalLLMConfigured()) return null;
  const context = {
    runtime: "local",
    title,
    runner,
    skill: compactValue(redactSensitive(blueprint), { maxArray: 60, maxDepth: 7, maxString: 2500 }),
    planPayload: compactValue(redactSensitive(planPayload), { maxArray: 80, maxDepth: 8, maxString: 3000 }),
    preflight: compactValue(redactSensitive(preflight), { maxArray: 80, maxDepth: 8, maxString: 2500 }),
    executionContext: compactValue(redactSensitive(executionContext), { maxArray: 80, maxDepth: 8, maxString: 2500 }),
    authSummary: redactSensitive(authSummary),
    regions,
    defaultValues: compactValue(redactSensitive(defaultValues), { maxArray: 40, maxDepth: 5, maxString: 1500 }),
    executionPreferences: compactValue(redactSensitive(executionPreferences), { maxArray: 40, maxDepth: 5, maxString: 1500 }),
    localDataSnapshot: compactValue(redactSensitive(localDataSnapshot), { maxArray: 30, maxDepth: 6, maxString: 1800 }),
    fallbackContextText: truncateString(fallbackContextText, 8000),
  };

  const text = await generateText({
    instructions: [
      "Write only the Execution Context section for a generated CloudAgent external-agent SKILL.md file.",
      "Return Markdown only. Start with `## Execution Context`.",
      "Use the skill details, preflight decisions, and selected workload/environment metadata to tell the external agent what context matters before executing.",
      "Include only information that helps complete the skill: target scope, account/region/profile metadata, workload/environment/deployment settings, safety posture, delivery/configuration path, constraints, and known blockers.",
      "State that CloudAgent handles authentication for the selected environment inside the `cli_session_*` tools, so the agent does not need to discover, request, or manage credential values.",
      "Include execution preferences with explicit boolean values for Auto-confirm defaults (`useDefaultValuesWithoutConfirmation`) and Auto-confirm changes (`applyChangesWithoutConfirmation`).",
      "Be concise and operational. Do not repeat the full execution plan.",
      "Do not include secrets, token values, credential values, raw terminal output, or irrelevant local data.",
      "If important context is missing, state the practical limitation briefly.",
    ].join("\n"),
    input: JSON.stringify(context),
  });
  return typeof text === "string" ? text.trim() : "";
}

export async function generateLocalAgentSessionSummaryWithOpenAI({
  title,
  runner = "CloudAgent",
  status,
  blueprintGoal = "",
  plan = [],
  sessionContents = [],
} = {}) {
  if (!isLocalLLMConfigured()) return null;
  const context = {
    runtime: "local",
    title,
    runner,
    status,
    skillGoal: truncateString(blueprintGoal, 6000),
    plan: compactValue(plan, { maxArray: 80, maxDepth: 6, maxString: 1500 }),
    sessionContents: compactValue(sessionContents, { maxArray: 120, maxDepth: 7, maxString: 4000 }),
  };

  return generateText({
    instructions: [
      "Write only a short final result summary for the CloudAgent skill run.",
      "Use 2-4 concise sentences or up to 4 short bullets. Do not include headings, task-by-task transcripts, session history, or terminal output.",
      "Summarize the result according to the skill goal using the task session contents.",
      "Mention concrete findings, counts, account/region identifiers, affected resources, blockers, and follow-up only when they are present in the provided contents.",
      "Do not copy fallback/status wording like task counts. Do not invent AWS results or actions. Do not expose secrets.",
    ].join("\n"),
    input: JSON.stringify(context),
  });
}

export async function refineLocalWorkloadDiscoveryWithOpenAI({
  profile,
  accountId,
  scanResults,
  workloads,
  environmentNotes,
} = {}) {
  if (!isLocalLLMConfigured()) return null;
  const context = {
    runtime: "local",
    environment: normalizeProfiles([profile])[0],
    accountId,
    environmentNotes: truncateString(environmentNotes || "", 3000),
    scanResults: compactValue(scanResults, { maxArray: 80, maxDepth: 7, maxString: 1500 }),
    initialWorkloads: normalizeWorkloads(workloads),
  };

  const text = await generateText({
    instructions: [
      "You are refining AWS workload discovery results for CloudAgent local mode.",
      "Return ONLY JSON with shape: {\"workloads\": [...], \"summary\": \"...\"}.",
      "Each workload must preserve CloudAgent discovery fields where possible: name, description, environments, trackedResources, deploymentPreferences, confidence, reasoning.",
      "Use the field name `name` for the discovered workload title. Do not use `workloadName` in discovery output.",
      "Return the top 3 to 5 coherent workload candidates, ordered from highest to lowest confidence. Never return more than 5 workloads. Return fewer than 3 only when the inventory clearly represents fewer distinct applications.",
      "Aggressively group related resources into application-level or business-service-level workloads. Do not create one workload per resource, service, or CloudFormation stack.",
      "Treat CloudFormation stacks, application tags, naming conventions, shared networking, data flows, and service relationships as grouping evidence. A stack is not automatically a separate workload, and related stacks should be combined.",
      "When more than 5 possible groups exist, merge lower-confidence groups into the closest coherent workload and keep the most useful 3 to 5 candidates for review.",
      "Assign each discovered resource or stack to at most one workload. Prefer a smaller number of broader, defensible groups over many narrow candidates.",
      "Do not invent resources. Do not expose secrets.",
    ].join("\n"),
    input: JSON.stringify(context),
  });
  const parsed = parseJsonLoose(text);
  if (!parsed || !Array.isArray(parsed.workloads)) {
    return {
      workloads,
      summary: text || "",
    };
  }
  return {
    workloads: parsed.workloads.map((workload) => ({
      ...workload,
      name: workload?.name || workload?.workloadName || "Discovered workload",
    })),
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  };
}

export async function generateLocalWorkflowEmailWithOpenAI({
  workflow = {},
  node = {},
  recipients = [],
  priorExecutionText = "",
} = {}) {
  if (!isLocalLLMConfigured()) return null;

  const context = {
    runtime: "local",
    deliveryMode: "dummy_email_only",
    workflow: compactValue(workflow, { maxArray: 40, maxDepth: 5, maxString: 1500 }),
    communicationNode: compactValue(node, { maxArray: 40, maxDepth: 6, maxString: 2500 }),
    recipients,
    priorExecutionText: truncateString(priorExecutionText || "", 12000),
  };

  const text = await generateText({
    instructions: [
      "You are CloudAgent composing a workflow email in local desktop mode.",
      "No real email will be sent. Produce the email that would have been sent.",
      "Use the communication node logic/instructions and prior workflow outputs.",
      "If the node has no specific instructions, summarize the prior workflow results clearly.",
      "Use a professional operational tone and sign as CloudAgent.",
      "Return ONLY JSON with shape:",
      "{\"status\":\"succeeded\",\"recipient\":\"...\",\"recipients\":[\"...\"],\"cc\":[],\"subject\":\"...\",\"textBody\":\"...\",\"htmlBody\":\"...\",\"message\":\"...\"}",
      "Do not include secrets or credential details.",
    ].join("\n"),
    input: JSON.stringify(context),
  });

  const parsed = parseJsonLoose(text);
  if (!parsed || typeof parsed !== "object") {
    return {
      status: "succeeded",
      recipient: recipients[0] || "",
      recipients,
      cc: [],
      subject: node?.name || workflow?.title || "CloudAgent workflow update",
      textBody: text || "",
      htmlBody: "",
      message: text || "Workflow email content generated.",
    };
  }

  return {
    status: parsed.status || "succeeded",
    recipient: parsed.recipient || recipients[0] || "",
    recipients: Array.isArray(parsed.recipients) ? parsed.recipients : recipients,
    cc: Array.isArray(parsed.cc) ? parsed.cc : [],
    subject: parsed.subject || node?.name || workflow?.title || "CloudAgent workflow update",
    textBody: parsed.textBody || parsed.body || parsed.message || "",
    htmlBody: parsed.htmlBody || "",
    message: parsed.message || "Workflow email content generated.",
  };
}

export async function generateLocalWorkflowSummaryWithOpenAI({
  workflow = {},
  endNode = {},
  executionHistory = [],
  instructions = "",
} = {}) {
  if (!isLocalLLMConfigured()) return null;

  const context = {
    runtime: "local",
    workflow: compactValue(workflow, { maxArray: 40, maxDepth: 5, maxString: 1500 }),
    endNode: compactValue(endNode, { maxArray: 40, maxDepth: 5, maxString: 2000 }),
    summaryInstructions: truncateString(instructions || endNode?.summaryInstructions || "", 4000),
    executionHistory: compactValue(executionHistory, { maxArray: 50, maxDepth: 8, maxString: 2500 }),
  };

  const text = await generateText({
    instructions: [
      "You are CloudAgent writing the final summary for a completed workflow run in local desktop mode.",
      "Use the end node summaryInstructions as the primary instruction for what to include.",
      "Use only the provided execution history as evidence. Do not invent results.",
      "Mention failed, waiting, skipped, or incomplete work if present.",
      "Do not include secrets or credential values.",
      "Return markdown only. Do not wrap it in JSON or code fences.",
    ].join("\n"),
    input: JSON.stringify(context),
  });

  return typeof text === "string" ? text.trim() : "";
}
