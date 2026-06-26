import OpenAI from "openai";

const DEFAULT_LOCAL_MODEL = "gpt-5.4";

function safeJsonParse(value, fallback = {}) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeModel(value) {
  return String(value || "").trim() || DEFAULT_LOCAL_MODEL;
}

function maskOpenAIKey(value) {
  const key = String(value || "").trim();
  if (!key) return "";
  if (key.length <= 12) return "••••";
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

function getEnvOpenAIKey() {
  return process.env.OPENAI_TOKEN || process.env.OPENAI_API_KEY || "";
}

function getEnvOpenAIModel() {
  return (
    process.env.OPENAI_LOCAL_MODEL ||
    process.env.OPENAI_MODEL ||
    DEFAULT_LOCAL_MODEL
  );
}

export function normalizeLocalOpenAISettingsRecord(settingsRecord = {}) {
  const userSettings = safeJsonParse(settingsRecord?.settings, {});
  const openaiSettings =
    userSettings?.openai && typeof userSettings.openai === "object"
      ? userSettings.openai
      : {};
  const apiKey = String(
    settingsRecord?.openaiApiKey ||
      settingsRecord?.openai?.apiKey ||
      settingsRecord?.openAI?.apiKey ||
      ""
  ).trim();
  const model = normalizeModel(
    settingsRecord?.openaiModel ||
      settingsRecord?.openai?.model ||
      openaiSettings.model ||
      getEnvOpenAIModel()
  );
  return {
    apiKey,
    model,
  };
}

export async function applyLocalOpenAISettingsFromStore(store) {
  if (!store || typeof store.getSettings !== "function") return getLocalOpenAIConfig();
  const settingsRecord = await store.getSettings().catch(() => null);
  const settings = normalizeLocalOpenAISettingsRecord(settingsRecord || {});

  if (settings.apiKey) {
    process.env.OPENAI_TOKEN = settings.apiKey;
    process.env.OPENAI_API_KEY = settings.apiKey;
  }
  if (settings.model) {
    process.env.OPENAI_LOCAL_MODEL = settings.model;
    process.env.OPENAI_MODEL = settings.model;
  }
  return getLocalOpenAIConfig();
}

export function getLocalOpenAIConfig() {
  const apiKey = getEnvOpenAIKey();
  return {
    apiKey,
    model: normalizeModel(getEnvOpenAIModel()),
    configured: Boolean(apiKey),
    hasApiKey: Boolean(apiKey),
    apiKeyMasked: maskOpenAIKey(apiKey),
  };
}

export function publicLocalOpenAISettings() {
  const config = getLocalOpenAIConfig();
  return {
    model: config.model,
    hasApiKey: config.hasApiKey,
    apiKeyMasked: config.apiKeyMasked,
  };
}

export async function updateLocalOpenAISettings(store, patch = {}) {
  if (!store || typeof store.updateSettings !== "function") {
    throw new Error("Local settings store is not available");
  }

  const existing = await store.getSettings();
  const existingUserSettings = safeJsonParse(existing?.settings, {});
  const existingOpenAI = normalizeLocalOpenAISettingsRecord(existing || {});
  const nextModel =
    patch.model !== undefined
      ? normalizeModel(patch.model)
      : normalizeModel(existingOpenAI.model);
  const hasApiKeyPatch = Object.prototype.hasOwnProperty.call(patch, "apiKey");
  const nextApiKey = hasApiKeyPatch
    ? String(patch.apiKey || "").trim()
    : existingOpenAI.apiKey;
  const clearApiKey = Boolean(patch.clearApiKey);

  const nextUserSettings = {
    ...existingUserSettings,
    openai: {
      ...(existingUserSettings.openai && typeof existingUserSettings.openai === "object"
        ? existingUserSettings.openai
        : {}),
      model: nextModel,
      hasApiKey: clearApiKey ? false : Boolean(nextApiKey),
    },
  };

  await store.updateSettings({
    settings: JSON.stringify(nextUserSettings),
    openaiModel: nextModel,
    ...(clearApiKey ? { openaiApiKey: "" } : {}),
    ...(!clearApiKey && hasApiKeyPatch && nextApiKey ? { openaiApiKey: nextApiKey } : {}),
  });

  if (clearApiKey) {
    delete process.env.OPENAI_TOKEN;
    delete process.env.OPENAI_API_KEY;
  }
  await applyLocalOpenAISettingsFromStore(store);
  return publicLocalOpenAISettings();
}

export function getLocalOpenAIKey() {
  return getEnvOpenAIKey();
}

export function isLocalOpenAIConfigured() {
  return Boolean(getLocalOpenAIKey());
}

function getLocalModel() {
  return normalizeModel(getEnvOpenAIModel());
}

function getClient() {
  const apiKey = getLocalOpenAIKey();
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    maxRetries: Math.max(0, Number(process.env.OPENAI_MAX_RETRIES || 2)),
    timeout: Math.max(30_000, Number(process.env.OPENAI_TIMEOUT_MS || 120_000)),
  });
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

function extractOutputText(response) {
  if (typeof response?.output_text === "string") return response.output_text;
  if (Array.isArray(response?.output_text)) return response.output_text.join("\n");
  const chunks = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && content?.text) chunks.push(content.text);
      if (typeof content?.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
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

async function createTextResponse({ instructions, input, model = getLocalModel() }) {
  const client = getClient();
  if (!client) return null;

  const response = await client.responses.create({
    model,
    instructions,
    input,
  });
  return extractOutputText(response);
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

export async function generateLocalChatReply({ message, state, sessionContext } = {}) {
  if (!isLocalOpenAIConfigured()) return null;
  const profiles = await state.store.listPermissionProfiles();
  const workloads = await state.store.listWorkloads();
  const context = {
    runtime: "local",
    userMessage: message,
    commandCenter: {
      limits: state.limits,
      activeScope: state.activeScope,
    },
    environments: normalizeProfiles(profiles),
    workloads: normalizeWorkloads(workloads),
    sessionContext: compactValue(redactSensitive(sessionContext || {})),
  };

  return createTextResponse({
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

export async function generateLocalExecutiveSummaryWithOpenAI({
  scope,
  target,
  relatedProfiles = [],
  relatedWorkloads = [],
  fallbackSummaryText = "",
} = {}) {
  if (!isLocalOpenAIConfigured()) return null;
  const context = {
    runtime: "local",
    scope,
    target: redactSensitive(compactValue(target)),
    relatedProfiles: normalizeProfiles(relatedProfiles),
    relatedWorkloads: normalizeWorkloads(relatedWorkloads),
    fallbackSummaryText,
  };

  return createTextResponse({
    instructions: [
      "Write an executive summary for CloudAgent local mode in Markdown.",
      "Use only local environment/workload metadata provided in the input.",
      "If health, cost, recommendations, reports, or compliance data is absent, state that coverage is not available yet.",
      "Keep it business-readable: Overview, Key Observations, Data Coverage, Recommended Next Actions.",
      "Do not expose secrets or credential details.",
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
  if (!isLocalOpenAIConfigured()) return null;
  const context = {
    runtime: "local",
    environment: normalizeProfiles([profile])[0],
    accountId,
    environmentNotes: truncateString(environmentNotes || "", 3000),
    scanResults: compactValue(scanResults, { maxArray: 80, maxDepth: 7, maxString: 1500 }),
    initialWorkloads: normalizeWorkloads(workloads),
  };

  const text = await createTextResponse({
    instructions: [
      "You are refining AWS workload discovery results for CloudAgent local mode.",
      "Return ONLY JSON with shape: {\"workloads\": [...], \"summary\": \"...\"}.",
      "Each workload must preserve CloudAgent discovery fields where possible: name, description, environments, trackedResources, deploymentPreferences, confidence, reasoning.",
      "Use the field name `name` for the discovered workload title. Do not use `workloadName` in discovery output.",
      "Group resources by CloudFormation stacks, application tags, naming conventions, and clear service relationships.",
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
  if (!isLocalOpenAIConfigured()) return null;

  const context = {
    runtime: "local",
    deliveryMode: "dummy_email_only",
    workflow: compactValue(workflow, { maxArray: 40, maxDepth: 5, maxString: 1500 }),
    communicationNode: compactValue(node, { maxArray: 40, maxDepth: 6, maxString: 2500 }),
    recipients,
    priorExecutionText: truncateString(priorExecutionText || "", 12000),
  };

  const text = await createTextResponse({
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
  if (!isLocalOpenAIConfigured()) return null;

  const context = {
    runtime: "local",
    workflow: compactValue(workflow, { maxArray: 40, maxDepth: 5, maxString: 1500 }),
    endNode: compactValue(endNode, { maxArray: 40, maxDepth: 5, maxString: 2000 }),
    summaryInstructions: truncateString(instructions || endNode?.summaryInstructions || "", 4000),
    executionHistory: compactValue(executionHistory, { maxArray: 50, maxDepth: 8, maxString: 2500 }),
  };

  const text = await createTextResponse({
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
