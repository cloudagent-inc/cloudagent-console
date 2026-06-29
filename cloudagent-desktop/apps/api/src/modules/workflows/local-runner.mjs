import { executeLocalAwsCliCommand } from "../cloudagent/local-cloudagent-tools.mjs";
import {
  runLocalCodingAgentBlueprint,
} from "../blueprints/local-codex-runner.mjs";
import {
  buildCloudAgentMcpInstructionLines,
  codingAgentRunnerLabel,
  normalizeCodingAgentRunner,
} from "@cloudagent/agent-runtime";
import { parseStoredJsonValue, parseStoredObject } from "@cloudagent/storage";
import {
  generateLocalWorkflowEmailWithOpenAI,
  generateLocalWorkflowSummaryWithOpenAI,
  isLocalOpenAIConfigured,
} from "../../platform/local-openai.mjs";
import { launchLocalAwsScanner } from "../scanners/local-scanner-launcher.mjs";
import globals from "@cloudagent/core/global-variables";

const NODE_TYPES = new Set([
  "startNode",
  "endNode",
  "cloudTask",
  "reportTask",
  "communication",
  "approval",
  "decision",
]);

function nowIso() {
  return new Date().toISOString();
}

function workflowLog(message, details = {}) {
  const sanitized = { ...details };
  delete sanitized.authProfile;
  delete sanitized.credentials;
  console.log(`[local workflowManager] ${message}`, sanitized);
}

function safeString(value) {
  return value == null ? "" : String(value);
}

function safeTrim(value) {
  return safeString(value).trim();
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  }
  return [value];
}

function asObject(value, fallback = {}) {
  if (value == null || value === "") return fallback;
  if (typeof value === "string") return parseStoredObject(value, fallback);
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function parseJsonMaybe(value, fallback = null) {
  return parseStoredJsonValue(value, fallback);
}

function safeJson(value) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return JSON.stringify(null, null, 2);
  }
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const trimmed = safeTrim(value);
    if (trimmed) return trimmed;
  }
  return "";
}

function normalizeWorkflowDefinition(raw = {}) {
  const definition = typeof raw === "string" ? parseJsonMaybe(raw, {}) : raw;
  const nodes = asArray(definition?.nodes).map(normalizeWorkflowNode).filter(Boolean);
  return {
    ...(definition && typeof definition === "object" && !Array.isArray(definition) ? definition : {}),
    workflowId: definition?.workflowId || definition?.id || null,
    title: firstNonEmpty(definition?.title, definition?.workflowName, "Untitled Workflow"),
    description: safeString(definition?.description || definition?.workflowDescription || ""),
    schedule: parseJsonMaybe(definition?.schedule, definition?.schedule || {}),
    nodes,
  };
}

function normalizeWorkflowNode(node) {
  if (!node || typeof node !== "object") return null;
  const data = node.data && typeof node.data === "object" ? node.data : {};
  const type = safeTrim(node.type || data.type);
  return {
    ...data,
    ...node,
    data,
    id: safeTrim(node.id || data.id || data.name) || `node-${Math.random().toString(36).slice(2)}`,
    type: NODE_TYPES.has(type) ? type : type || "cloudTask",
    name: firstNonEmpty(node.name, data.name, node.label, data.label, node.id),
    inputFrom: asArray(node.inputFrom ?? data.inputFrom),
    next: asArray(node.next ?? data.next),
    blueprintId: asArray(node.blueprintId ?? data.blueprintId),
    inputSettings: asObject(node.inputSettings ?? data.inputSettings, {}),
    permissionProfile: firstNonEmpty(node.permissionProfile, data.permissionProfile),
    dynamicTargetsFromInput: Boolean(node.dynamicTargetsFromInput ?? data.dynamicTargetsFromInput),
    multiEnvironment: Boolean(node.multiEnvironment ?? data.multiEnvironment),
    advanceMode: firstNonEmpty(node.advanceMode, data.advanceMode, "all"),
    action: safeString(node.action ?? data.action ?? ""),
    communicationType: firstNonEmpty(node.communicationType, data.communicationType, "email"),
    recipients: asArray(node.recipients ?? data.recipients),
    branches: node.branches ?? data.branches ?? null,
    branchLogic: asObject(node.branchLogic ?? data.branchLogic, {}),
    condition: safeString(node.condition ?? data.condition ?? ""),
    logic: asArray(node.logic ?? data.logic),
    summaryInstructions: safeString(node.summaryInstructions ?? data.summaryInstructions ?? ""),
  };
}

function buildWorkflowOrder(nodes = []) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const starts = nodes.filter((node) => node.type === "startNode");
  const ordered = [];
  const visited = new Set();

  function visit(node) {
    if (!node || visited.has(node.id)) return;
    visited.add(node.id);
    ordered.push(node);
    for (const nextId of asArray(node.next)) {
      visit(byId.get(String(nextId)));
    }
  }

  if (starts.length > 0) starts.forEach(visit);
  if (ordered.length === 0 && nodes[0]) visit(nodes[0]);
  nodes.forEach(visit);
  return ordered;
}

function getPlanArray(value) {
  const parsed = parseJsonMaybe(value, value);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.plan)) return parsed.plan;
  if (Array.isArray(parsed?.skeleton)) return parsed.skeleton;
  if (Array.isArray(parsed?.tasks)) {
    return [{ title: parsed.title || "Tasks", tasks: parsed.tasks }];
  }
  return [];
}

function normalizePlanPayload({ blueprint, planPayload, planId }) {
  const raw = planPayload || (blueprint ? parseJsonMaybe(blueprint.plan, {}) : {});
  const plan = getPlanArray(raw);
  return {
    ...(raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}),
    plan,
    title: firstNonEmpty(raw?.title, raw?.planTitle, blueprint?.title, planId, "Local Agent"),
    cloudProvider: firstNonEmpty(raw?.cloudProvider, blueprint?.cloudProvider, "aws"),
  };
}

function toStringLines(value) {
  if (Array.isArray(value)) return value.flatMap(toStringLines);
  if (value == null) return [];
  if (typeof value === "object") {
    return [
      value.command,
      value.cli_command,
      value.awsCommand,
      value.aws_cli_command,
    ].map(safeTrim).filter(Boolean);
  }
  return safeString(value).split(/\r?\n/);
}

function extractAwsCommandsFromText(value) {
  const commands = [];
  for (const rawLine of toStringLines(value)) {
    const line = safeTrim(rawLine).replace(/^[-*]\s+/, "").replace(/^`+|`+$/g, "");
    if (line.startsWith("aws ")) commands.push(line);
  }
  return commands;
}

function extractAwsCliCommands(task = {}) {
  const candidates = [
    task.cliCommands,
    task.cli_commands,
    task.awsCliCommands,
    task.aws_cli_commands,
    task.readOnlyCommands,
    task.commands,
    task.command,
    task.executionPlan,
    task.execution_plan,
    task.description,
  ];
  const commands = [];
  for (const candidate of candidates) commands.push(...extractAwsCommandsFromText(candidate));
  return [...new Set(commands.map((command) => command.trim()).filter(Boolean))];
}

function summarizeCliOutput(result = {}) {
  const stdout = safeTrim(result?.output?.stdout ?? result?.output);
  const stderr = safeTrim(result?.output?.stderr);
  if (stdout && stderr) return `${stdout}\n\nstderr:\n${stderr}`;
  return stdout || stderr || "Command completed without output.";
}

function summarizeCommandResults(results = []) {
  if (!results.length) return "";
  return results.map((entry) => {
    const status = entry.statusCode === 200 ? "succeeded" : "failed";
    const details = entry.statusCode === 200
      ? ""
      : safeTrim(entry.output)
        ? `\n  ${safeTrim(entry.output).split(/\r?\n/).slice(0, 4).join("\n  ")}`
        : "";
    return `- ${entry.command}: ${status}${details}`;
  }).join("\n");
}

function buildHttpUrl(base, key) {
  return `${String(base || "").replace(/\/+$/, "")}/${String(key || "").replace(/^\/+/, "")}`;
}

function normalizeLibraryBlueprintRecord(raw = {}, blueprintId = null) {
  const plan = parseJsonMaybe(raw?.plan, raw?.plan || []);
  const planPayload = Array.isArray(plan)
    ? {
        title: raw?.title || raw?.planTitle || blueprintId || "Library Blueprint",
        cloudProvider: raw?.cloudProvider || "aws",
        plan,
      }
    : {
        ...(plan && typeof plan === "object" && !Array.isArray(plan) ? plan : {}),
        title: raw?.title || raw?.planTitle || plan?.title || blueprintId || "Library Blueprint",
        cloudProvider: raw?.cloudProvider || plan?.cloudProvider || "aws",
        plan: getPlanArray(plan),
      };
  return {
    recordId: raw?.recordId || raw?.blueprintId || raw?.planId || blueprintId,
    title: raw?.title || raw?.planTitle || planPayload.title,
    description: raw?.description || raw?.planDescription || planPayload.description || "",
    cloudProvider: raw?.cloudProvider || planPayload.cloudProvider || "aws",
    credits: raw?.credits || planPayload.credits || 1,
    plan: planPayload,
    requiredPermissions: raw?.requiredPermissions || {},
    planSettings: raw?.planSettings || {},
    source: raw?.source || "library",
  };
}

async function fetchLibraryBlueprint(blueprintId) {
  const id = safeTrim(blueprintId);
  if (!id) return null;
  const base = globals?.URLS?.PLAN_DEFS_HTTP_BASE_URL || "https://agent-plans-sandbox.s3.us-east-1.amazonaws.com";
  const candidates = [
    buildHttpUrl(base, `plans/${encodeURIComponent(id)}.json`),
    buildHttpUrl("https://s3.us-east-1.amazonaws.com/agent-plans-sandbox", `plans/${encodeURIComponent(id)}.json`),
  ];
  for (const url of [...new Set(candidates)]) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const parsed = await response.json();
      return normalizeLibraryBlueprintRecord({ ...parsed, source: "library_http", fetchUrl: url }, id);
    } catch (error) {
      console.warn("[local workflow] failed to fetch library blueprint", {
        blueprintId: id,
        url,
        message: error?.message || String(error),
      });
    }
  }
  return null;
}

async function resolveWorkflowBlueprint(store, blueprintId) {
  const id = safeTrim(blueprintId);
  if (!id) return null;
  const local = await store.getBlueprint(id);
  if (local) return local;
  return fetchLibraryBlueprint(id);
}

function unwrapAgentStreamEvent(ev) {
  return ev?.data?.event ?? ev?.data ?? null;
}

function extractAwsCliOutputsFromContextEvents(contextEvents = []) {
  return contextEvents
    .filter((event) => event?.type === "tool_execution" && event?.sourceTool === "aws_cli_readonly")
    .map((event) => {
      const output = event.output || {};
      const result = output.result || {};
      return {
        command: output.input?.command || event.input?.command || "",
        cli_command: output.input?.command || event.input?.command || "",
        output: summarizeCliOutput(result),
        statusCode: result.statusCode || (output.ok === false ? 400 : 200),
      };
    });
}

function compactAuthProfile(authProfile = {}) {
  if (!authProfile || typeof authProfile !== "object") return {};
  return {
    provider: authProfile.provider || authProfile.cloudProvider || "aws",
    name: authProfile.name || null,
    permissionProfileId:
      authProfile.permissionProfileId || authProfile.recordId || authProfile.id || null,
    awsAccountId: authProfile.awsAccountId || authProfile.accountId || null,
    defaultRegion: authProfile.defaultRegion || authProfile.region || null,
    authType: authProfile.authType || (authProfile.awsProfile ? "aws-profile" : null),
    awsProfile: authProfile.awsProfile || authProfile.profileName || authProfile.profile || null,
  };
}

function buildWorkflowTaskPrompt({
  runTitle,
  phase,
  task,
  plan,
  priorLogs,
  authProfile,
  inputSettings,
} = {}) {
  const priorOutput = priorLogs
    .map((entry) => ({
      taskId: entry.taskId,
      status: entry.status,
      output: safeTrim(entry.task_output || entry.output).slice(0, 4000),
    }))
    .filter((entry) => entry.output);
  return [
    `Execute this CloudAgent workflow blueprint task locally: ${task.title || task.id}.`,
    "",
    "Use the available local CloudAgent tools for real read-only AWS inspection when the task requires AWS data.",
    "If AWS data is needed, call aws_cli_readonly with concrete read-only AWS CLI commands instead of only describing what should happen.",
    "Do not use mutating AWS CLI commands. If this task cannot be executed safely in local mode, say so clearly and explain the missing capability.",
    "",
    "# Workflow Blueprint",
    JSON.stringify({
      title: runTitle,
      phases: plan.map((item) => ({
        title: item.title,
        tasks: (item.tasks || []).map((planTask) => ({
          id: planTask.id || planTask.task_id,
          title: planTask.title,
        })),
      })),
    }, null, 2),
    "",
    "# Current Phase",
    JSON.stringify({ title: phase?.title || "Phase" }, null, 2),
    "",
    "# Current Task",
    JSON.stringify(task, null, 2),
    "",
    "# Local Runtime Target",
    JSON.stringify({
      authProfile: compactAuthProfile(authProfile),
      regions: Array.isArray(inputSettings?.regions) ? inputSettings.regions : [],
      defaultValues: inputSettings?.defaultValues || inputSettings?.default_values || {},
      additionalInstructions:
        inputSettings?.additionalInstructions || inputSettings?.additional_instructions || null,
      targetEnvironment: inputSettings?.targetEnvironment || null,
      localAnalysisArtifactsContext: inputSettings?.localAnalysisArtifactsContext || [],
    }, null, 2),
    "",
    "# Previous Workflow/Blueprint Outputs",
    JSON.stringify(priorOutput, null, 2),
    "",
    "Return a concise task result with the actual findings, commands used, and any limitations.",
  ].join("\n");
}

function isSummaryLikeTask(task = {}) {
  const inputSettings = task.inputSettings && typeof task.inputSettings === "object" ? task.inputSettings : {};
  if (
    safeTrim(task.mode || inputSettings.mode) === "analyze_existing" ||
    safeTrim(task.reportNodeMode || inputSettings.reportNodeMode) === "analyze_existing" ||
    safeTrim(task.reportSourceType || inputSettings.reportSourceType) ||
    asArray(task.analysisArtifacts || inputSettings.analysisArtifacts).length > 0 ||
    asArray(task.localAnalysisArtifactsContext || inputSettings.localAnalysisArtifactsContext).length > 0
  ) {
    return true;
  }
  const text = `${task.title || ""} ${task.description || ""}`.toLowerCase();
  return /(summar|aggregat|report|review results|compile|consolidat|final)/.test(text);
}

function truncateText(value, maxLength = 12000) {
  const text = safeString(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n...[truncated]` : text;
}

function countByStatus(items = []) {
  return asArray(items).reduce((counts, item) => {
    const status = safeTrim(item?.status || item?.healthStatus || item?.state || item?.severity || "unknown").toLowerCase();
    counts[status || "unknown"] = (counts[status || "unknown"] || 0) + 1;
    return counts;
  }, {});
}

function isProblemStatus(value) {
  return /(fail|error|warn|critical|alarm|unhealthy|impaired|unknown|expired|aborted)/i.test(safeTrim(value));
}

function summarizeHealthArtifact(payload = {}, inputSettings = {}) {
  const requestedResourceType = safeTrim(inputSettings.resourceType).toLowerCase();
  const resources = asArray(payload.resources);
  const matchingResources = requestedResourceType
    ? resources.filter((resource) => safeTrim(resource.resourceType || resource.type).toLowerCase().includes(requestedResourceType))
    : resources;
  const issueResources = matchingResources.filter((resource) => {
    const checks = asArray(resource.checks);
    return (
      asArray(resource.errors).length > 0 ||
      isProblemStatus(resource.status || resource.healthStatus || resource.state) ||
      checks.some((check) => isProblemStatus(check?.status || check?.severity))
    );
  });
  return {
    generatedAt: payload.generatedAt || payload.analysis?.health?.generatedAt || null,
    accountId: payload.accountId || null,
    permissionProfileId: payload.permissionProfileId || null,
    workloadId: payload.workloadId || null,
    requestedResourceType: requestedResourceType || null,
    totalResourceCount: resources.length,
    matchingResourceCount: matchingResources.length,
    issueResourceCount: issueResources.length,
    summary: payload.summary || payload.analysis?.health?.summary || {},
    statusCounts: payload.summary?.issueCounts || countByStatus(matchingResources.flatMap((resource) => asArray(resource.checks))),
    issueSamples: issueResources.slice(0, 25).map((resource) => ({
      resourceId: resource.resourceId || resource.id || resource.name || resource.arn || null,
      resourceType: resource.resourceType || resource.type || null,
      region: resource.region || null,
      status: resource.status || resource.healthStatus || resource.state || null,
      errors: asArray(resource.errors).slice(0, 5),
      failedChecks: asArray(resource.checks)
        .filter((check) => isProblemStatus(check?.status || check?.severity))
        .slice(0, 10)
        .map((check) => ({
          checkId: check.checkId || check.id || null,
          name: check.checkName || check.name || null,
          status: check.status || check.severity || null,
          summary: truncateText(check.summary || check.message || check.description || "", 1000),
        })),
    })),
  };
}

function summarizeCostArtifact(payload = {}) {
  const checks = asArray(payload.checks);
  return {
    generatedAt: payload.generatedAt || payload.analysis?.cost?.generatedAt || null,
    accountId: payload.accountId || null,
    permissionProfileId: payload.permissionProfileId || null,
    lookbackDays: payload.lookbackDays || payload.data?.spend?.range?.lookbackDays || null,
    statusCounts: payload.statusCounts || countByStatus(checks),
    errorCount: asArray(payload.errors).length,
    errors: asArray(payload.errors).slice(0, 10),
    checkSamples: checks.slice(0, 25).map((check) => ({
      checkId: check.checkId || check.id || null,
      name: check.checkName || check.name || null,
      category: check.category || null,
      status: check.status || null,
      summary: truncateText(check.summary || "", 1000),
      details: check.details || {},
    })),
    spend: {
      range: payload.data?.spend?.range || null,
      dailyTotalCount: asArray(payload.data?.spend?.dailyTotal).length,
      dailyByServiceCount: asArray(payload.data?.spend?.dailyByService).length,
    },
  };
}

function summarizeThreatArtifact(payload = {}) {
  const data = payload.data || {};
  return {
    generatedAt: payload.generatedAt || payload.analysis?.threat?.generatedAt || null,
    accountId: payload.accountId || null,
    permissionProfileId: payload.permissionProfileId || null,
    summary: payload.summary || payload.analysis?.threat?.summary || {},
    findingCounts: payload.summary?.findings || {},
    severityCounts: payload.summary?.severityCounts || {},
    errorCount: asArray(payload.errors).length,
    errors: asArray(payload.errors).slice(0, 10),
    samples: {
      guardDuty: asArray(data.guardDuty?.findings).slice(0, 10),
      inspector: asArray(data.inspector?.findings).slice(0, 10),
      accessAnalyzer: asArray(data.accessAnalyzer?.findings).slice(0, 10),
      patchCompliance: asArray(data.patchCompliance?.nonCompliantInstances).slice(0, 10),
    },
  };
}

function summarizeScannerArtifact(kind, payload, inputSettings = {}) {
  if (kind === "health") return summarizeHealthArtifact(payload, inputSettings);
  if (kind === "cost") return summarizeCostArtifact(payload, inputSettings);
  if (kind === "threat") return summarizeThreatArtifact(payload, inputSettings);
  return {
    generatedAt: payload?.generatedAt || payload?.analysis?.[kind]?.generatedAt || null,
    summary: payload?.summary || payload?.analysis?.[kind]?.summary || {},
  };
}

function resolveArtifactScopeIds(kind, inputSettings = {}) {
  const targetEnvironment = inputSettings.targetEnvironment || {};
  const targetWorkload = inputSettings.targetWorkload || {};
  const permissionProfileId = firstNonEmpty(
    inputSettings.permissionProfileId,
    targetEnvironment.permissionProfileId,
    targetEnvironment.recordId,
    targetEnvironment.id,
  );
  const workloadId = firstNonEmpty(
    inputSettings.workloadId,
    targetWorkload.workloadId,
    targetWorkload.recordId,
    targetWorkload.id,
  );
  if (kind === "health" && workloadId) return [workloadId, permissionProfileId].filter(Boolean);
  return [permissionProfileId, workloadId].filter(Boolean);
}

async function buildAnalysisArtifactContext({ store, inputSettings = {} } = {}) {
  const artifacts = asArray(inputSettings.analysisArtifacts || inputSettings.analysis_artifacts);
  const kinds = artifacts
    .map((artifact) => safeTrim(artifact?.kind || artifact?.reportType || artifact?.type || artifact).toLowerCase())
    .filter(Boolean);
  const uniqueKinds = Array.from(new Set(kinds));
  const context = [];
  for (const kind of uniqueKinds) {
    const scopeIds = resolveArtifactScopeIds(kind, inputSettings);
    if (!scopeIds.length) {
      context.push({
        kind,
        ok: false,
        error: `No local scope id was available for ${kind} artifact lookup.`,
      });
      continue;
    }

    let found = false;
    for (const scopeId of scopeIds) {
      const payload = await store.readLatestScannerArtifact(kind, scopeId);
      if (!payload) continue;
      context.push({
        kind,
        scopeId,
        ok: true,
        summary: summarizeScannerArtifact(kind, payload, inputSettings),
      });
      found = true;
      break;
    }
    if (!found) {
      context.push({
        kind,
        scopeId: scopeIds[0],
        ok: false,
        pending: true,
        error: `No local ${kind} artifact was found for ${scopeIds.join(" or ")}.`,
      });
    }
  }
  return context;
}

function buildLocalWorkflowNodePlanPayload({ node, taskId, taskTitle, artifactContext = [] } = {}) {
  const inputSettings = node.inputSettings || {};
  return {
    title: taskTitle,
    cloudProvider: inputSettings.cloudProvider || "aws",
    plan: [{
      title: "Local Workflow Node",
      tasks: [{
        id: taskId,
        title: taskTitle,
        description: node.action || node.summaryInstructions || "Execute this local workflow node.",
        nodeType: node.type,
        mode: inputSettings.mode || null,
        reportNodeMode: inputSettings.reportNodeMode || null,
        reportSourceType: inputSettings.reportSourceType || null,
        analysisArtifacts: inputSettings.analysisArtifacts || [],
        localAnalysisArtifactsContext: artifactContext,
        resourceType: inputSettings.resourceType || null,
        cloudProvider: inputSettings.cloudProvider || "aws",
        permissionProfileId: inputSettings.permissionProfileId || null,
        targetEnvironment: inputSettings.targetEnvironment || null,
        regions: inputSettings.regions || [],
        inputSettings,
      }],
    }],
  };
}

function normalizeLocalReportType(value) {
  const normalized = safeTrim(value).toLowerCase();
  if (["health", "resource-health", "resource_health", "healthanalysis"].includes(normalized)) return "health";
  if (["cost", "cost-analysis", "cost_analysis", "costanalysis"].includes(normalized)) return "cost";
  if (["threat", "threat-detection", "threat_detection", "threatanalysis"].includes(normalized)) return "threat";
  if (["inventory", "asset-inventory", "asset_inventory"].includes(normalized)) return "inventory";
  return "";
}

function detectWorkflowReportType(node = {}) {
  const inputSettings = node.inputSettings || {};
  const candidates = [
    inputSettings.reportType,
    inputSettings.reportSourceType,
    inputSettings.sourceType,
    inputSettings.mode,
    ...asArray(inputSettings.analysisArtifacts).map((artifact) =>
      artifact?.kind || artifact?.reportType || artifact?.type || artifact
    ),
  ];
  for (const candidate of candidates) {
    const reportType = normalizeLocalReportType(candidate);
    if (reportType) return reportType;
  }
  const text = `${node.name || ""} ${node.action || ""} ${node.summaryInstructions || ""}`.toLowerCase();
  if (/\b(cost|spend|billing)\b/.test(text)) return "cost";
  if (/\b(threat|guardduty|security hub|securityhub|vulnerability|finding)\b/.test(text)) return "threat";
  if (/\b(health|drift|alarm|error|failure|incident|availability|latency)\b/.test(text)) return "health";
  if (/\b(inventory|resources?|assets?)\b/.test(text)) return "inventory";
  return "";
}

function buildWorkflowReportTargets(inputSettings = {}, reportType = "") {
  const targetEnvironment = inputSettings.targetEnvironment || {};
  const targetWorkload = inputSettings.targetWorkload || {};
  const authProfile = inputSettings.authProfile || {};
  const permissionProfileId = firstNonEmpty(
    inputSettings.permissionProfileId,
    inputSettings.agentPermissionProfileId,
    inputSettings.agentPermissinoProfileId,
    targetEnvironment.permissionProfileId,
    targetEnvironment.recordId,
    targetEnvironment.id,
    authProfile.permissionProfileId,
    authProfile.recordId,
    authProfile.id,
  );
  const workloadId = firstNonEmpty(
    inputSettings.workloadId,
    targetWorkload.workloadId,
    targetWorkload.recordId,
    targetWorkload.id,
  );
  if (reportType === "health" && workloadId) {
    return [{ workloadId, ...(permissionProfileId ? { permissionProfileId } : {}) }];
  }
  if (permissionProfileId) return [{ permissionProfileId }];
  return [];
}

function buildWorkflowReportOptions(inputSettings = {}) {
  return {
    ...(Number.isFinite(Number(inputSettings.lookbackHours))
      ? { lookbackHours: Number(inputSettings.lookbackHours) }
      : {}),
    ...(Number.isFinite(Number(inputSettings.lookbackDays))
      ? { lookbackDays: Number(inputSettings.lookbackDays) }
      : {}),
    ...(typeof inputSettings.enableCloudWatchLogChecks === "boolean"
      ? { enableCloudWatchLogChecks: inputSettings.enableCloudWatchLogChecks }
      : {}),
    ...(Array.isArray(inputSettings.regions) ? { regions: inputSettings.regions } : {}),
    ...(Array.isArray(inputSettings.services) ? { services: inputSettings.services } : {}),
    ...(inputSettings.resourceType ? { resourceType: inputSettings.resourceType } : {}),
  };
}

async function runLocalCloudAgentTask({
  store,
  prompt,
  authProfile,
  sessionContext = null,
}) {
  const [
    { user },
    { runCloudAgentStream },
    { createLocalCloudAgentTools },
  ] = await Promise.all([
    import("@openai/agents"),
    import("@cloudagent/cloudagent/core"),
    import("../cloudagent/local-cloudagent-tools.mjs"),
  ]);

  const contextEvents = [];
  const { tools } = createLocalCloudAgentTools({ store, selectedAuthProfile: authProfile });
  const { stream } = await runCloudAgentStream({
    userId: "local-user",
    history: [user(prompt)],
    mode: "local",
    sessionContext,
    toolsOverride: tools,
    onContextEvent: (payload) => {
      if (payload) contextEvents.push(payload);
    },
  });

  let text = "";
  for await (const ev of stream) {
    if (ev?.type !== "raw_model_stream_event") continue;
    const inner = unwrapAgentStreamEvent(ev);
    const type = inner?.type;
    if (type === "response.output_text.delta" || type === "response.text.delta") {
      text += inner.delta || "";
    }
  }
  return {
    text: text.trim(),
    contextEvents,
    cliOutputs: extractAwsCliOutputsFromContextEvents(contextEvents),
  };
}

async function resolvePermissionProfileAuth(store, id) {
  const recordId = safeTrim(id);
  if (!recordId) return null;
  const profile = await store.getPermissionProfile(recordId);
  if (!profile) return null;
  return asObject(profile.authProfile, {});
}

function unwrapAuthProfile(value) {
  const object = asObject(value, null);
  if (!object) return null;
  if (object.authProfile) return asObject(object.authProfile, {});
  return object;
}

async function resolveAuthProfile(store, ...candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === "string") {
      const byId = await resolvePermissionProfileAuth(store, candidate);
      if (byId) return byId;
      const parsed = unwrapAuthProfile(candidate);
      if (parsed) return parsed;
      continue;
    }
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const nested = await resolveAuthProfile(store, item);
        if (nested) return nested;
      }
      continue;
    }
    const object = unwrapAuthProfile(candidate);
    if (object && Object.keys(object).length > 0) return object;
  }
  return null;
}

function isAwsAuthProfile(authProfile = {}) {
  const provider = safeTrim(authProfile?.provider || authProfile?.cloudProvider).toLowerCase();
  return provider === "aws" ||
    Boolean(authProfile?.awsAccountId || authProfile?.accountId || authProfile?.awsProfile || authProfile?.accessKeyId);
}

function credentialStatusIsValid(status = null) {
  return Boolean(
    status?.lastCheckedValid === true ||
    status?.ok === true ||
    safeTrim(status?.status).toLowerCase() === "valid"
  );
}

async function findPermissionProfileForAuthProfile(store, authProfile = {}) {
  const permissionProfileId = firstNonEmpty(
    authProfile?.permissionProfileId,
    authProfile?.recordId,
    authProfile?.id,
  );
  if (permissionProfileId) {
    const profile = await store.getPermissionProfile(permissionProfileId);
    if (profile) return profile;
  }
  const accountId = firstNonEmpty(authProfile?.awsAccountId, authProfile?.accountId);
  if (!accountId) return null;
  const profiles = await store.listPermissionProfiles();
  return profiles.find((profile) => {
    const parsed = asObject(profile?.authProfile, {});
    return firstNonEmpty(parsed.awsAccountId, parsed.accountId) === accountId;
  }) || null;
}

async function getLocalCredentialRunBlocker(store, authProfile = {}) {
  if (!isAwsAuthProfile(authProfile)) return null;
  const profile = await findPermissionProfileForAuthProfile(store, authProfile);
  if (!profile) return null;
  const status = profile.credentialStatus || profile.localCredentialStatus || null;
  if (credentialStatusIsValid(status)) return null;
  return {
    code: status?.code || "AWS_CREDENTIALS_NOT_VALIDATED",
    message:
      [status?.message, status?.remediation].filter(Boolean).join(" ") ||
      "AWS credentials have not been checked or are invalid. Recheck this environment in Cloud Setup.",
    status: status?.status || "invalid",
    permissionProfileId: profile.recordId || profile.id || null,
  };
}

function normalizeTask(task = {}, phaseIndex, taskIndex) {
  const id = firstNonEmpty(task.id, task.task_id, `task_${phaseIndex + 1}_${taskIndex + 1}`);
  return {
    ...task,
    id,
    title: firstNonEmpty(task.title, task.name, id),
    description: safeString(task.description || ""),
  };
}

function buildRunSummary({ title, status, logs, failedCount = 0, skippedCount = 0 }) {
  const completedCount = logs.filter((entry) => entry.status === "complete").length;
  const failedTaskCount = logs.filter((entry) => entry.status === "failed").length;
  const summaryParts = [
    `Local runner finished "${title}" with status ${status}.`,
    `${completedCount} task(s) completed.`,
  ];
  if (failedTaskCount || failedCount) summaryParts.push(`${failedTaskCount || failedCount} task(s) failed.`);
  if (skippedCount) summaryParts.push(`${skippedCount} task(s) had no executable local commands and were marked failed.`);
  return {
    summary: summaryParts.join(" "),
    finalSummary: summaryParts.join(" "),
    completedAt: nowIso(),
    status,
  };
}

function normalizeWorkflowCloudTaskRunner(value) {
  return normalizeCodingAgentRunner(value);
}

function workflowStatusForAgentResult(result = {}) {
  const status = safeTrim(result.status).toLowerCase();
  if (["waiting_on_user_input", "agent_waiting_on_user_input"].includes(status)) {
    return "waiting_on_user_input";
  }
  return status === "complete" ? "succeeded" : "failed";
}

function compactCodexWorkflowEvents(events = []) {
  return asArray(events).slice(-120).map((event) => {
    if (!event || typeof event !== "object") return event;
    const item = event.item && typeof event.item === "object"
      ? {
          id: event.item.id || null,
          type: event.item.type || null,
          status: event.item.status || null,
          command: event.item.command || null,
          text: safeTrim(event.item.text || event.item.content).slice(0, 4000) || undefined,
          exit_code: event.item.exit_code ?? null,
        }
      : undefined;
    return {
      type: event.type || null,
      thread_id: event.thread_id || undefined,
      item,
      text: safeTrim(event.text || event.message || event.content).slice(0, 4000) || undefined,
    };
  });
}

function buildWorkflowCodexSkillMarkdown({ title, blueprint = null, planPayload = null, runner = "codex" } = {}) {
  const runnerLabel = codingAgentRunnerLabel(runner);
  const plan = planPayload || (blueprint ? parseJsonMaybe(blueprint.plan, {}) : {}) || {};
  const lines = [
    `# ${title || blueprint?.title || plan?.title || "CloudAgent Workflow Task"}`,
    "",
    `Use this skill when running a CloudAgent workflow cloud task through ${runnerLabel}.`,
    "",
    "## Instructions",
    "",
    "- Read `session-context.json` before acting. It contains the selected environment, workload, regions, workflow context, local scan/report context, and task plan.",
    "- Keep all work scoped to the selected CloudAgent environment/workload context.",
    "- Use `session-context.json.environment.authProfile` to understand the selected AWS account/profile and region.",
    ...buildCloudAgentMcpInstructionLines({ runner, mcpEnabled: true }),
    "- Prefer read-only inspection unless the task explicitly requires changes and the CloudAgent context allows it.",
    "- If a step needs user input or you are unsure whether it is safe to continue, stop and return a `User input needed` section with the exact question, options, and recommended default.",
    "- Produce concise Markdown with Findings, Evidence, Actions Taken, and Result.",
    "- Do not claim AWS or local changes were made unless you actually performed them.",
  ];

  if (plan && Object.keys(plan).length) {
    lines.push("", "## Workflow Task Plan", "", "```json", safeJson(plan), "```");
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

function buildWorkflowCodexSkillFiles({ title, blueprint = null, planPayload = null, runner = "codex" } = {}) {
  return [
    {
      relativePath: "SKILL.md",
      content: buildWorkflowCodexSkillMarkdown({ title, blueprint, planPayload, runner }),
    },
  ];
}

function buildLocalCloudAgentRunSummary({
  title,
  status,
  plan = [],
  logs = [],
  finalTaskSummary = "",
  completedAt = nowIso(),
}) {
  const taskLabels = new Map();
  for (const phase of Array.isArray(plan) ? plan : []) {
    for (const task of Array.isArray(phase?.tasks) ? phase.tasks : []) {
      const id = task?.id || task?.task_id;
      if (id) taskLabels.set(id, task.title || task.name || id);
    }
  }
  const completed = logs.filter((entry) => String(entry?.status || "").toLowerCase() === "complete");
  const failed = logs.filter((entry) => String(entry?.status || "").toLowerCase() === "failed");
  const cliCommandCount = logs.reduce(
    (sum, entry) => sum + (Array.isArray(entry?.cli_command_output) ? entry.cli_command_output.length : 0),
    0
  );
  const taskLines = logs.map((entry) => {
    const taskId = entry?.taskId || "task";
    const taskTitle = taskLabels.get(taskId) || taskId;
    const statusText = entry?.status || "unknown";
    const evidenceCount = Array.isArray(entry?.cli_command_output) ? entry.cli_command_output.length : 0;
    return `- ${taskTitle}: ${statusText}${evidenceCount ? ` (${evidenceCount} AWS CLI evidence call${evidenceCount === 1 ? "" : "s"})` : ""}`;
  });
  const summary = [
    `Local CloudAgent completed "${title}" with ${completed.length} completed task(s) and ${failed.length} failed task(s).`,
    cliCommandCount ? `${cliCommandCount} read-only AWS CLI evidence call(s) were captured.` : "No AWS CLI evidence calls were captured.",
    finalTaskSummary ? `Final task summary: ${finalTaskSummary}` : null,
  ].filter(Boolean).join(" ");
  return {
    summary,
    finalSummary: [
      summary,
      "",
      "Task outcomes:",
      ...(taskLines.length ? taskLines : ["- No task logs were recorded."]),
    ].join("\n"),
    completedAt,
    status,
    completedTasks: completed.length,
    failedTasks: failed.length,
    cliCommandCount,
  };
}

export async function executeLocalAgentPlan({
  store,
  planId,
  blueprint,
  planPayload,
  inputSettings = {},
  authProfile = null,
  recordId = null,
  parentId = null,
  title = null,
  onTaskResult = null,
} = {}) {
  const planState = normalizePlanPayload({ blueprint, planPayload, planId });
  const runTitle = firstNonEmpty(title, planState.title, blueprint?.title, planId, "Local Agent");
  const resolvedPlanId = firstNonEmpty(planId, blueprint?.recordId, planPayload?.recordId, planPayload?.planId, "local-agent");
  const existing = recordId ? await store.getAgentHistoryRecord(recordId) : null;
  const baseAuthProfile = await resolveAuthProfile(
    store,
    authProfile,
    inputSettings?.authProfile,
    inputSettings?.authProfiles,
    inputSettings?.permissionProfileId,
    inputSettings?.permissionProfile,
  );
  const existingLog = existing?.log ? parseJsonMaybe(existing.log, {}) : {};
  const logs = Array.isArray(existingLog?.logs) ? [...existingLog.logs] : [];
  const settings = {
    ...(asObject(existing?.settings, {})),
    ...(inputSettings || {}),
  };
  const targetTaskId = firstNonEmpty(
    inputSettings?.targetTaskId,
    inputSettings?.taskId,
    inputSettings?.task?.id,
    inputSettings?.task?.task_id,
  );
  const startedAt = nowIso();
  const startPayload = {
    ...(existing ? {} : { itemId: resolvedPlanId }),
    agentType: "agent",
    status: "running",
    title: runTitle,
    parentId: parentId ?? existing?.parentId ?? null,
    authProfile: baseAuthProfile || {},
    settings,
    log: {
      ...existingLog,
      logs,
      currentPhase: existingLog?.currentPhase || 0,
      currentTask: existingLog?.currentTask || 0,
      lastUpdated: startedAt,
      blueprintId: resolvedPlanId,
      runSummary: {
        summary: `Local runner started "${runTitle}".`,
        finalSummary: `Local runner started "${runTitle}".`,
        generatedAt: startedAt,
        status: "running",
      },
    },
  };
  const runRecord = existing
    ? await store.updateAgentHistoryRecord(existing.recordId, startPayload)
    : await store.createAgentHistoryRecord(startPayload);

  let failedCount = 0;
  let skippedCount = 0;
  let matchedTargetTask = false;
  let lastExecutedPhaseIndex = 0;
  let lastExecutedTaskIndex = 0;
  const plan = planState.plan.map((phase, phaseIndex) => ({
    title: firstNonEmpty(phase?.title, `Phase ${phaseIndex + 1}`),
    tasks: asArray(phase?.tasks).map((task, taskIndex) => normalizeTask(task, phaseIndex, taskIndex)),
  }));

  if (plan.length === 0 || plan.every((phase) => !phase.tasks.length)) {
    failedCount = 1;
    logs.push({
      taskId: "local_no_plan",
      phaseIndex: 0,
      taskIndex: 0,
      status: "failed",
      output: `Local runner could not execute "${runTitle}" because no local plan tasks were available.`,
      task_output: `Local runner could not execute "${runTitle}" because no local plan tasks were available.`,
      cli_command_output: [],
      timestamp: nowIso(),
    });
  }

  for (let phaseIndex = 0; phaseIndex < plan.length; phaseIndex += 1) {
    const phase = plan[phaseIndex];
    for (let taskIndex = 0; taskIndex < phase.tasks.length; taskIndex += 1) {
      const task = phase.tasks[taskIndex];
      if (targetTaskId && task.id !== targetTaskId) continue;
      matchedTargetTask = true;
      lastExecutedPhaseIndex = phaseIndex;
      lastExecutedTaskIndex = taskIndex;
      const commands = extractAwsCliCommands(task);
      const taskAuthProfile = await resolveAuthProfile(
        store,
        task.authProfile,
        task.inputSettings?.authProfile,
        task.inputSettings?.authProfiles,
        task.permissionProfileId,
        task.permissionProfile,
        baseAuthProfile,
      );
      const commandOutputs = [];
      let status = "complete";
      let output = "";

      if (commands.length === 0) {
        skippedCount += 1;
        status = "failed";
        output = [
          `Local runner could not execute task "${task.title}".`,
          "No executable read-only AWS CLI command was found in the task definition.",
          "Run this task through the local CloudAgent LLM path or update the task definition with explicit read-only AWS CLI commands.",
        ].join(" ");
      } else {
        for (const command of commands) {
          let result;
          try {
            result = await executeLocalAwsCliCommand({
              command,
              accountId: taskAuthProfile?.awsAccountId || taskAuthProfile?.accountId || null,
              authProfile: taskAuthProfile || {},
            });
          } catch (error) {
            result = {
              statusCode: 400,
              output: {
                stdout: "",
                stderr: error?.message || String(error),
              },
            };
          }
          commandOutputs.push({
            command,
            cli_command: command,
            output: summarizeCliOutput(result),
            statusCode: result?.statusCode || 400,
          });
          if (result?.statusCode !== 200) status = "failed";
        }
        output = [
          `Executed ${commands.length} local AWS CLI command(s) for "${task.title}".`,
          summarizeCommandResults(commandOutputs),
        ].filter(Boolean).join("\n");
      }

      if (status === "failed") failedCount += 1;
      const logEntry = {
        taskId: task.id,
        phaseIndex,
        taskIndex,
        status,
        output,
        task_output: output,
        cli_command_output: commandOutputs,
        timestamp: nowIso(),
      };
      logs.push(logEntry);
      const runningSummary = buildRunSummary({
        title: runTitle,
        status: failedCount ? "failed" : "running",
        logs,
        failedCount,
        skippedCount,
      });
      await store.updateAgentHistoryRecord(runRecord.recordId, {
        status: failedCount ? "failed" : "running",
        log: {
          ...existingLog,
          logs,
          currentPhase: phaseIndex,
          currentTask: taskIndex,
          lastUpdated: nowIso(),
          blueprintId: resolvedPlanId,
          runSummary: runningSummary,
        },
      });
      if (typeof onTaskResult === "function") {
        await onTaskResult({
          task,
          phase,
          phaseIndex,
          taskIndex,
          logEntry,
          runSummary: runningSummary,
        });
      }
    }
  }

  if (targetTaskId && !matchedTargetTask) {
    failedCount += 1;
    logs.push({
      taskId: targetTaskId,
      phaseIndex: 0,
      taskIndex: 0,
      status: "failed",
      output: `Local runner could not find task "${targetTaskId}" in "${runTitle}".`,
      task_output: `Local runner could not find task "${targetTaskId}" in "${runTitle}".`,
      cli_command_output: [],
      timestamp: nowIso(),
    });
  }

  const finalStatus = failedCount ? "failed" : "complete";
  const finalSummary = buildRunSummary({
    title: runTitle,
    status: finalStatus,
    logs,
    failedCount,
    skippedCount,
  });
  const finalRecord = await store.updateAgentHistoryRecord(runRecord.recordId, {
    status: finalStatus,
    log: {
      ...existingLog,
      logs,
      currentPhase: lastExecutedPhaseIndex,
      currentTask: lastExecutedTaskIndex,
      lastUpdated: nowIso(),
      blueprintId: resolvedPlanId,
      runSummary: finalSummary,
    },
  });

  return {
    ok: finalStatus === "complete",
    recordId: finalRecord.recordId,
    agentRunId: finalRecord.recordId,
    runId: finalRecord.recordId,
    record: finalRecord,
    agentRun: finalRecord,
    status: finalStatus,
    plan,
    summary: finalSummary.summary,
    runSummary: finalSummary,
    logs,
  };
}

export async function executeLocalAgentPlanWithCloudAgent({
  store,
  planId,
  blueprint,
  planPayload,
  inputSettings = {},
  authProfile = null,
  recordId = null,
  parentId = null,
  title = null,
  onTaskResult = null,
} = {}) {
  if (!isLocalOpenAIConfigured()) return null;

  const planState = normalizePlanPayload({ blueprint, planPayload, planId });
  const runTitle = firstNonEmpty(title, planState.title, blueprint?.title, planId, "Local Agent");
  const resolvedPlanId = firstNonEmpty(planId, blueprint?.recordId, planPayload?.recordId, planPayload?.planId, "local-agent");
  const existing = recordId ? await store.getAgentHistoryRecord(recordId) : null;
  const baseAuthProfile = await resolveAuthProfile(
    store,
    authProfile,
    inputSettings?.authProfile,
    inputSettings?.authProfiles,
    inputSettings?.permissionProfileId,
    inputSettings?.permissionProfile,
  );
  const existingLog = existing?.log ? parseJsonMaybe(existing.log, {}) : {};
  const logs = Array.isArray(existingLog?.logs) ? [...existingLog.logs] : [];
  const settings = {
    ...(asObject(existing?.settings, {})),
    ...(inputSettings || {}),
  };
  const targetTaskId = firstNonEmpty(
    inputSettings?.targetTaskId,
    inputSettings?.taskId,
    inputSettings?.task?.id,
    inputSettings?.task?.task_id,
  );
  const startedAt = nowIso();
  const runRecord = existing
    ? await store.updateAgentHistoryRecord(existing.recordId, {
        status: "running",
        authProfile: baseAuthProfile || existing.authProfile || {},
        settings,
        log: {
          ...existingLog,
          logs,
          currentPhase: existingLog?.currentPhase || 0,
          currentTask: existingLog?.currentTask || 0,
          lastUpdated: startedAt,
          blueprintId: resolvedPlanId,
          isBluePrint: true,
          runSummary: {
            summary: `Local CloudAgent workflow runner started "${runTitle}".`,
            finalSummary: `Local CloudAgent workflow runner started "${runTitle}".`,
            generatedAt: startedAt,
            status: "running",
          },
        },
      })
    : await store.createAgentHistoryRecord({
        itemId: resolvedPlanId,
        agentType: "agent",
        status: "running",
        title: runTitle,
        parentId: parentId ?? null,
        authProfile: baseAuthProfile || {},
        settings,
        log: {
          logs,
          currentPhase: 0,
          currentTask: 0,
          lastUpdated: startedAt,
          blueprintId: resolvedPlanId,
          isBluePrint: true,
          runSummary: {
            summary: `Local CloudAgent workflow runner started "${runTitle}".`,
            finalSummary: `Local CloudAgent workflow runner started "${runTitle}".`,
            generatedAt: startedAt,
            status: "running",
          },
        },
      });

  let failedCount = 0;
  let matchedTargetTask = false;
  let lastExecutedPhaseIndex = 0;
  let lastExecutedTaskIndex = 0;
  const plan = planState.plan.map((phase, phaseIndex) => ({
    title: firstNonEmpty(phase?.title, `Phase ${phaseIndex + 1}`),
    tasks: asArray(phase?.tasks).map((task, taskIndex) => normalizeTask(task, phaseIndex, taskIndex)),
  }));

  if (plan.length === 0 || plan.every((phase) => !phase.tasks.length)) {
    failedCount = 1;
    logs.push({
      taskId: "local_no_plan",
      phaseIndex: 0,
      taskIndex: 0,
      status: "failed",
      output: `Local CloudAgent could not execute "${runTitle}" because no local plan tasks were available.`,
      task_output: `Local CloudAgent could not execute "${runTitle}" because no local plan tasks were available.`,
      cli_command_output: [],
      timestamp: nowIso(),
    });
  }

  for (let phaseIndex = 0; phaseIndex < plan.length; phaseIndex += 1) {
    const phase = plan[phaseIndex];
    for (let taskIndex = 0; taskIndex < phase.tasks.length; taskIndex += 1) {
      const task = phase.tasks[taskIndex];
      if (targetTaskId && task.id !== targetTaskId) continue;
      matchedTargetTask = true;
      lastExecutedPhaseIndex = phaseIndex;
      lastExecutedTaskIndex = taskIndex;

      const taskAuthProfile = await resolveAuthProfile(
        store,
        task.authProfile,
        task.inputSettings?.authProfile,
        task.inputSettings?.authProfiles,
        task.permissionProfileId,
        task.permissionProfile,
        baseAuthProfile,
      );
      const prompt = buildWorkflowTaskPrompt({
        runTitle,
        phase,
        task,
        plan,
        priorLogs: logs,
        authProfile: taskAuthProfile,
        inputSettings: {
          ...(inputSettings || {}),
          ...(task.inputSettings || {}),
        },
      });
      let status = "complete";
      let output = "";
      let commandOutputs = [];
      try {
        workflowLog("local CloudAgent task stream starting", {
          workflowRunId: parentId || null,
          agentRunId: runRecord.recordId,
          blueprintId: resolvedPlanId,
          taskId: task.id,
          phaseIndex,
          taskIndex,
          summaryLikeTask: isSummaryLikeTask(task),
        });
        const result = await runLocalCloudAgentTask({
          store,
          prompt,
          authProfile: taskAuthProfile || {},
          sessionContext: {
            authProfile: compactAuthProfile(taskAuthProfile || {}),
            regions: Array.isArray(inputSettings?.regions) ? inputSettings.regions : [],
            workflowRunId: parentId || null,
            blueprintId: resolvedPlanId,
            taskId: task.id,
          },
        });
        commandOutputs = result.cliOutputs || [];
        output = result.text || "";
        workflowLog("local CloudAgent task stream finished", {
          workflowRunId: parentId || null,
          agentRunId: runRecord.recordId,
          blueprintId: resolvedPlanId,
          taskId: task.id,
          phaseIndex,
          taskIndex,
          outputLength: output.length,
          cliOutputCount: commandOutputs.length,
        });
        if (!output) {
          status = "failed";
          output = "Local CloudAgent did not return a response for this workflow task.";
        } else if (!commandOutputs.length && !isSummaryLikeTask(task)) {
          status = "failed";
          output = [
            output,
            "",
            "Local runner did not record any aws_cli_readonly tool execution for this task, so it was marked failed instead of completed.",
          ].join("\n");
        }
      } catch (error) {
        status = "failed";
        output = error?.message || String(error);
        workflowLog("local CloudAgent task stream failed", {
          workflowRunId: parentId || null,
          agentRunId: runRecord.recordId,
          blueprintId: resolvedPlanId,
          taskId: task.id,
          phaseIndex,
          taskIndex,
          error: output,
        });
      }

      if (status === "failed") failedCount += 1;
      const logEntry = {
        taskId: task.id,
        phaseIndex,
        taskIndex,
        status,
        output,
        task_output: output,
        cli_command_output: commandOutputs,
        timestamp: nowIso(),
      };
      logs.push(logEntry);
      const runningSummary = buildRunSummary({
        title: runTitle,
        status: failedCount ? "failed" : "running",
        logs,
        failedCount,
        skippedCount: 0,
      });
      await store.updateAgentHistoryRecord(runRecord.recordId, {
        status: failedCount ? "failed" : "running",
        log: {
          ...existingLog,
          logs,
          currentPhase: phaseIndex,
          currentTask: taskIndex,
          lastUpdated: nowIso(),
          blueprintId: resolvedPlanId,
          isBluePrint: true,
          runSummary: runningSummary,
        },
      });
      if (typeof onTaskResult === "function") {
        await onTaskResult({
          task,
          phase,
          phaseIndex,
          taskIndex,
          logEntry,
          runSummary: runningSummary,
        });
      }
    }
  }

  if (targetTaskId && !matchedTargetTask) {
    failedCount += 1;
    logs.push({
      taskId: targetTaskId,
      phaseIndex: 0,
      taskIndex: 0,
      status: "failed",
      output: `Local CloudAgent could not find task "${targetTaskId}" in "${runTitle}".`,
      task_output: `Local CloudAgent could not find task "${targetTaskId}" in "${runTitle}".`,
      cli_command_output: [],
      timestamp: nowIso(),
    });
  }

  const finalStatus = failedCount ? "failed" : "complete";
  const finalSummary = buildLocalCloudAgentRunSummary({
    title: runTitle,
    status: finalStatus,
    plan,
    logs,
    finalTaskSummary: logs.at(-1)?.task_output || logs.at(-1)?.output || "",
    completedAt: nowIso(),
  });
  const finalRecord = await store.updateAgentHistoryRecord(runRecord.recordId, {
    status: finalStatus,
    log: {
      ...existingLog,
      logs,
      currentPhase: lastExecutedPhaseIndex,
      currentTask: lastExecutedTaskIndex,
      lastUpdated: nowIso(),
      blueprintId: resolvedPlanId,
      isBluePrint: true,
      runSummary: finalSummary,
    },
  });

  return {
    ok: finalStatus === "complete",
    recordId: finalRecord.recordId,
    agentRunId: finalRecord.recordId,
    runId: finalRecord.recordId,
    record: finalRecord,
    agentRun: finalRecord,
    status: finalStatus,
    plan,
    summary: finalSummary.summary,
    runSummary: finalSummary,
    logs,
  };
}

async function executeLocalAgentPlanWithCodex({
  runner = "codex",
  store,
  planId,
  blueprint,
  planPayload,
  inputSettings = {},
  authProfile = null,
  recordId = null,
  parentId = null,
  title = null,
  mcpUrl = null,
  agentBinary = null,
} = {}) {
  const normalizedRunnerValue = normalizeCodingAgentRunner(runner);
  const normalizedRunner = ["codex", "claude", "cursor"].includes(normalizedRunnerValue)
    ? normalizedRunnerValue
    : "codex";
  const runnerLabel = codingAgentRunnerLabel(normalizedRunner);
  const planState = normalizePlanPayload({ blueprint, planPayload, planId });
  const runTitle = firstNonEmpty(title, planState.title, blueprint?.title, planId, `Local ${runnerLabel} Workflow Task`);
  const resolvedPlanId = firstNonEmpty(
    planId,
    blueprint?.recordId,
    planPayload?.recordId,
    planPayload?.planId,
    "local-codex-workflow-task"
  );
  const existing = recordId ? await store.getAgentHistoryRecord(recordId) : null;
  const baseAuthProfile = await resolveAuthProfile(
    store,
    authProfile,
    inputSettings?.authProfile,
    inputSettings?.authProfiles,
    inputSettings?.permissionProfileId,
    inputSettings?.permissionProfile,
  );
  const existingLog = existing?.log ? parseJsonMaybe(existing.log, {}) : {};
  const startedAt = nowIso();
  const plan = planState.plan.map((phase, phaseIndex) => ({
    title: firstNonEmpty(phase?.title, `Phase ${phaseIndex + 1}`),
    tasks: asArray(phase?.tasks).map((task, taskIndex) => normalizeTask(task, phaseIndex, taskIndex)),
  }));
  const effectivePlanPayload = planPayload || {
    recordId: resolvedPlanId,
    title: runTitle,
    plan,
  };
  const compactSettings = {
    ...(inputSettings || {}),
    authProfile: compactAuthProfile(baseAuthProfile || inputSettings?.authProfile || {}),
    authProfiles: asArray(inputSettings?.authProfiles).map((profile) => compactAuthProfile(profile)),
  };
  const desktopSettings = parseJsonMaybe((await store.getSettings().catch(() => null))?.settings, {}) || {};
  const codexSettings = desktopSettings?.codex && typeof desktopSettings.codex === "object"
    ? desktopSettings.codex
    : {};
  const claudeSettings = desktopSettings?.claude && typeof desktopSettings.claude === "object"
    ? desktopSettings.claude
    : {};
  const cursorSettings = desktopSettings?.cursor && typeof desktopSettings.cursor === "object"
    ? desktopSettings.cursor
    : {};
  const agentWorkspaceDir =
    normalizedRunner === "claude"
      ? claudeSettings.workspaceDir || null
      : normalizedRunner === "cursor"
        ? cursorSettings.workspaceDir || null
        : codexSettings.workspaceDir || null;
  const agentBinarySetting =
    normalizedRunner === "claude"
      ? claudeSettings.binary || null
      : normalizedRunner === "cursor"
        ? cursorSettings.binary || null
        : codexSettings.binary || null;

  const runRecord = existing
    ? await store.updateAgentHistoryRecord(existing.recordId, {
        status: "running",
        executionMode: normalizedRunner,
        runner: normalizedRunner,
        authProfile: compactAuthProfile(baseAuthProfile || existing.authProfile || {}),
        settings: compactSettings,
        log: {
          ...existingLog,
          logs: Array.isArray(existingLog?.logs) ? existingLog.logs : [],
          lastUpdated: startedAt,
          blueprintId: resolvedPlanId,
          isBluePrint: true,
          executionMode: normalizedRunner,
          runner: normalizedRunner,
          runSummary: {
            summary: `Local ${runnerLabel} workflow runner started "${runTitle}".`,
            finalSummary: `Local ${runnerLabel} workflow runner started "${runTitle}".`,
            generatedAt: startedAt,
            status: "running",
          },
        },
      })
    : await store.createAgentHistoryRecord({
        itemId: resolvedPlanId,
        agentType: "agent",
        status: "running",
        title: runTitle,
        parentId: parentId ?? null,
        executionMode: normalizedRunner,
        runner: normalizedRunner,
        authProfile: compactAuthProfile(baseAuthProfile || {}),
        settings: compactSettings,
        log: {
          logs: [],
          currentPhase: 0,
          currentTask: 0,
          lastUpdated: startedAt,
          blueprintId: resolvedPlanId,
          isBluePrint: true,
          executionMode: normalizedRunner,
          runner: normalizedRunner,
          runSummary: {
            summary: `Local ${runnerLabel} workflow runner started "${runTitle}".`,
            finalSummary: `Local ${runnerLabel} workflow runner started "${runTitle}".`,
            generatedAt: startedAt,
            status: "running",
          },
        },
      });

  workflowLog(`local ${runnerLabel} workflow task starting`, {
    workflowRunId: parentId || null,
    agentRunId: runRecord.recordId,
    blueprintId: resolvedPlanId,
    title: runTitle,
    mcpConfigured: Boolean(mcpUrl),
  });

  let codexResult;
  try {
    codexResult = await runLocalCodingAgentBlueprint({
      runner: normalizedRunner,
      blueprintId: resolvedPlanId,
      title: runTitle,
      blueprint,
      planPayload: effectivePlanPayload,
      phases: plan,
      priorLogs: [],
      authProfile: baseAuthProfile || {},
      regions: Array.isArray(inputSettings?.regions) ? inputSettings.regions : [],
      defaultValues: inputSettings?.default_values || inputSettings?.defaultValues || {},
      executionPreferences: {
        ...compactSettings,
        workflowRunId: parentId || null,
        workflowCloudTaskRunner: normalizedRunner,
      },
      localDataSnapshot: {
        workflowRunId: parentId || null,
        nodeInputSettings: {
          ...compactSettings,
          localAnalysisArtifactsContext: inputSettings?.localAnalysisArtifactsContext || [],
        },
      },
      mcpUrl,
      workspaceDir: agentWorkspaceDir,
      agentBinary: agentBinary || agentBinarySetting,
      recordId: runRecord.recordId,
      skillFiles: buildWorkflowCodexSkillFiles({
        title: runTitle,
        blueprint,
        planPayload: effectivePlanPayload,
        runner: normalizedRunner,
      }),
    });
  } catch (error) {
    codexResult = {
      status: "failed",
      output: error?.message || String(error),
      summary: error?.message || String(error),
      events: [],
      stderr: error?.stack || error?.message || String(error),
      exitCode: 1,
    };
  }

  const finalStatus = codexResult.status === "complete"
    ? "complete"
    : codexResult.status === "waiting_on_user_input"
      ? "waiting_on_user_input"
      : "failed";
  const finalOutput = safeTrim(codexResult.output || codexResult.summary) ||
    `Local ${runnerLabel} workflow runner finished "${runTitle}" with status ${finalStatus}.`;
  const logEntry = {
    taskId: `${normalizedRunner}_workflow_cloud_task`,
    phaseIndex: 0,
    taskIndex: 0,
    status: finalStatus,
    output: finalOutput,
    task_output: finalOutput,
    cli_command_output: [],
    executionMode: normalizedRunner,
    runner: normalizedRunner,
    codex: {
      runDir: codexResult.runDir || null,
      threadId: codexResult.threadId || null,
      exitCode: codexResult.exitCode ?? null,
      timedOut: codexResult.timedOut === true,
      eventCount: Array.isArray(codexResult.events) ? codexResult.events.length : 0,
      events: compactCodexWorkflowEvents(codexResult.events || []),
      stderr: safeTrim(codexResult.stderr).slice(0, 8000) || null,
    },
    timestamp: nowIso(),
  };
  const runSummary = {
    summary: finalOutput,
    finalSummary: finalOutput,
    completedAt: nowIso(),
    status: finalStatus,
  };
  const finalRecord = await store.updateAgentHistoryRecord(runRecord.recordId, {
    status: finalStatus,
    executionMode: normalizedRunner,
    runner: normalizedRunner,
    log: {
      ...existingLog,
      logs: [logEntry],
      currentPhase: 0,
      currentTask: 0,
      lastUpdated: nowIso(),
      blueprintId: resolvedPlanId,
      isBluePrint: true,
      executionMode: normalizedRunner,
      runner: normalizedRunner,
      codex: logEntry.codex,
      runSummary,
    },
  });

  workflowLog(`local ${runnerLabel} workflow task finished`, {
    workflowRunId: parentId || null,
    agentRunId: finalRecord.recordId,
    blueprintId: resolvedPlanId,
    status: finalStatus,
    outputLength: finalOutput.length,
    runDir: codexResult.runDir || null,
  });

  return {
    ok: finalStatus === "complete",
    recordId: finalRecord.recordId,
    agentRunId: finalRecord.recordId,
    runId: finalRecord.recordId,
    record: finalRecord,
    agentRun: finalRecord,
    status: finalStatus,
    plan,
    summary: finalOutput,
    runSummary,
    logs: [logEntry],
  };
}

function workflowTaskResult({
  status,
  message,
  logs = [],
  agentRunId = null,
  completedTask = null,
  extra = {},
} = {}) {
  return {
    status,
    agentRunId,
    currentPhase: completedTask?.phaseIndex ?? null,
    currentTask: completedTask?.taskIndex ?? null,
    output: {
      status,
      message,
      logs,
      agentRunId,
      currentPhase: completedTask?.phaseIndex ?? null,
      currentTask: completedTask?.taskIndex ?? null,
      completedTask,
      ...extra,
    },
  };
}

function createInProgressWorkflowNodeExecution(node, nodeIndex = 0) {
  const startedAt = nowIso();
  const branchId = node?.branchId || `local-${node?.id || nodeIndex}`;
  const output = `Local workflow node "${node?.name || node?.id || `Node ${nodeIndex + 1}`}" is running.`;
  return {
    branchId,
    nodeIndex,
    nodeId: node?.id || null,
    nodeName: node?.name || node?.id || `Node ${nodeIndex + 1}`,
    type: node?.type || "unknown",
    payloadHistory: [],
    startedAt,
    updatedAt: startedAt,
    completedAt: null,
    tasks: [{
      id: `${node?.id || `node-${nodeIndex}`}:local`,
      taskId: `${node?.id || `node-${nodeIndex}`}:local`,
      title: node?.name || node?.id || `Node ${nodeIndex + 1}`,
      taskLabel: node?.name || node?.id || `Node ${nodeIndex + 1}`,
      status: "in_progress",
      startedAt,
      updatedAt: startedAt,
      completedAt: null,
      output,
      task_output: output,
      taskInputSettings: {},
      result: workflowTaskResult({
        status: "in_progress",
        message: output,
        logs: [],
      }),
    }],
    nodeOutput: {
      summary: output,
    },
  };
}

function collectExecutionText(executionHistory = []) {
  const chunks = [];
  for (const execution of Array.isArray(executionHistory) ? executionHistory : []) {
    if (execution?.nodeOutput?.summary) chunks.push(execution.nodeOutput.summary);
    for (const task of Array.isArray(execution?.tasks) ? execution.tasks : []) {
      chunks.push(task.output, task.task_output, task.result?.output?.message);
      const logs = task.result?.output?.logs;
      if (Array.isArray(logs)) {
        logs.forEach((entry) => chunks.push(entry?.output, entry?.task_output));
      }
    }
  }
  return chunks.map(safeString).filter(Boolean).join("\n\n");
}

function inferWorkflowFacts(executionHistory = []) {
  const text = collectExecutionText(executionHistory);
  const lower = text.toLowerCase();
  const positivePatterns = [
    /\b([1-9]\d*)\s+(issue|issues|finding|findings|problem|problems|error|errors|failure|failures|alarm|alarms)\b/i,
    /\b(issueResourceCount|failedChecks|failedTaskCount|errorCount|failedTasks)\b[^0-9]{0,20}[1-9]\d*/i,
    /\b(status|severity)\b[^a-z0-9]{0,12}(failed|failure|unhealthy|critical|warning|alarm|error)\b/i,
  ];
  const negativePatterns = [
    /\bno\s+(issue|issues|finding|findings|problem|problems|error|errors|failure|failures|alarm|alarms)\b/i,
    /\b0\s+(issue|issues|finding|findings|problem|problems|error|errors|failure|failures|alarm|alarms)\b/i,
    /\b(issueResourceCount|failedChecks|failedTaskCount|errorCount|failedTasks)\b[^0-9]{0,20}0\b/i,
  ];
  const hasPositive = positivePatterns.some((pattern) => pattern.test(text));
  const hasNegative = negativePatterns.some((pattern) => pattern.test(text));
  return {
    text,
    lower,
    hasIssues: hasPositive && !hasNegative,
    hasExplicitNoIssues: hasNegative && !hasPositive,
  };
}

function branchLogicText(value) {
  if (Array.isArray(value)) return value.map(safeTrim).filter(Boolean).join("\n");
  if (value && typeof value === "object") return branchLogicText(value.logic);
  return safeTrim(value);
}

function branchMatchesFacts(logic, facts) {
  const text = branchLogicText(logic).toLowerCase();
  if (!text) return false;
  if (/(>|>=)\s*0|any|exists?|found|has\s+|with\s+(issues?|findings?)|issues?\s+present|findings?\s+present|yes/i.test(text)) {
    return facts.hasIssues;
  }
  if (/(==|=|<=)\s*0|no\s+|none|not\s+found|without\s+(issues?|findings?)|else|otherwise/i.test(text)) {
    return !facts.hasIssues || facts.hasExplicitNoIssues;
  }
  if (text.includes("fail") || text.includes("error") || text.includes("alarm") || text.includes("unhealthy")) {
    return facts.hasIssues;
  }
  return facts.lower.includes(text);
}

function executeDecisionWorkflowNode({ node, nodeIndex = 0, executionHistory = [] } = {}) {
  const startedAt = nowIso();
  const facts = inferWorkflowFacts(executionHistory);
  const branchEntries = Object.entries(node.branchLogic || {});
  const nextIds = asArray(node.next).map(String).filter(Boolean);
  const selectedNextIds = [];
  const branchResults = [];

  for (const nextId of nextIds) {
    const branch = node.branchLogic?.[nextId] || {};
    const runAlways = branch?.runAlways === true;
    const matched = runAlways || branchMatchesFacts(branch.logic ?? branch, facts);
    branchResults.push({
      nextId,
      title: branch?.title || nextId,
      logic: branchLogicText(branch.logic ?? branch),
      runAlways,
      matched,
    });
    if (matched) selectedNextIds.push(nextId);
  }

  if (!selectedNextIds.length && !branchEntries.length) {
    selectedNextIds.push(...nextIds);
  }
  if (!selectedNextIds.length && nextIds.length) {
    selectedNextIds.push(nextIds[0]);
  }

  const skippedNextIds = nextIds.filter((nextId) => !selectedNextIds.includes(nextId));
  const output = [
    selectedNextIds.length
      ? `Decision selected branch(es): ${selectedNextIds.join(", ")}.`
      : "Decision did not select a downstream branch.",
    facts.hasIssues
      ? "Prior workflow output appears to contain findings/issues."
      : "Prior workflow output does not appear to contain findings/issues.",
  ].join(" ");
  workflowLog("decision node evaluated", {
    nodeId: node.id,
    nodeName: node.name,
    nodeIndex,
    selectedNextIds,
    skippedNextIds,
    hasIssues: facts.hasIssues,
    hasExplicitNoIssues: facts.hasExplicitNoIssues,
    branchResults,
  });
  return {
    nodeExecution: {
      branchId: `local-${node.id}`,
      nodeIndex,
      nodeId: node.id,
      nodeName: node.name,
      type: node.type,
      payloadHistory: [],
      startedAt,
      updatedAt: nowIso(),
      completedAt: nowIso(),
      tasks: [{
        id: `${node.id}:local`,
        taskId: `${node.id}:local`,
        title: node.name,
        taskLabel: node.name,
        status: "succeeded",
        startedAt,
        updatedAt: nowIso(),
        completedAt: nowIso(),
        output,
        task_output: output,
        taskInputSettings: { branchResults, selectedNextIds, skippedNextIds },
        result: workflowTaskResult({
          status: "succeeded",
          message: output,
          logs: [],
          extra: { branchResults, selectedNextIds, skippedNextIds },
        }),
      }],
      nodeOutput: { summary: output, branchResults, selectedNextIds, skippedNextIds },
    },
    linkedAgentRunIds: [],
    selectedNextIds,
    skippedNextIds,
  };
}

async function executeWorkflowReportNode({ store, node, workflowRunId, nodeIndex = 0 }) {
  const startedAt = nowIso();
  const taskId = `${node.id}:report`;
  const reportType = detectWorkflowReportType(node);
  const inputSettings = node.inputSettings || {};
  const branchId = `local-${node.id}`;

  workflowLog("report node started", {
    workflowRunId,
    nodeId: node.id,
    nodeName: node.name,
    nodeIndex,
    reportType: reportType || null,
  });

  function buildReportTask({ status, output, extra = {} }) {
    return {
      id: taskId,
      taskId,
      title: node.name,
      taskLabel: node.name,
      status,
      startedAt,
      updatedAt: nowIso(),
      completedAt: nowIso(),
      output,
      task_output: output,
      taskInputSettings: {
        ...inputSettings,
        reportType: reportType || null,
        ...extra,
      },
      result: workflowTaskResult({
        status,
        message: output,
        logs: [],
        extra: {
          reportType: reportType || null,
          ...extra,
        },
      }),
    };
  }

  if (!reportType) {
    const output = "Local report task could not determine the report type from this workflow node.";
    const task = buildReportTask({ status: "failed", output, extra: { error: "REPORT_TYPE_NOT_FOUND" } });
    workflowLog("report node failed", {
      workflowRunId,
      nodeId: node.id,
      reason: "REPORT_TYPE_NOT_FOUND",
    });
    return {
      nodeExecution: {
        branchId,
        nodeIndex,
        nodeId: node.id,
        nodeName: node.name,
        type: node.type,
        payloadHistory: [],
        startedAt,
        updatedAt: nowIso(),
        completedAt: nowIso(),
        tasks: [task],
        nodeOutput: { summary: output },
      },
      linkedAgentRunIds: [],
    };
  }

  const targets = buildWorkflowReportTargets(inputSettings, reportType);
  if (!targets.length) {
    const output = `Local ${reportType} report task requires a permissionProfileId${reportType === "health" ? " or workloadId" : ""}.`;
    const task = buildReportTask({ status: "failed", output, extra: { error: "REPORT_TARGET_NOT_FOUND" } });
    workflowLog("report node failed", {
      workflowRunId,
      nodeId: node.id,
      reportType,
      reason: "REPORT_TARGET_NOT_FOUND",
    });
    return {
      nodeExecution: {
        branchId,
        nodeIndex,
        nodeId: node.id,
        nodeName: node.name,
        type: node.type,
        payloadHistory: [],
        startedAt,
        updatedAt: nowIso(),
        completedAt: nowIso(),
        tasks: [task],
        nodeOutput: { summary: output },
      },
      linkedAgentRunIds: [],
    };
  }

  try {
    const scannerResult = await launchLocalAwsScanner({
      store,
      cloudProvider: inputSettings.cloudProvider || "aws",
      reportType,
      targets,
      forceRefresh: inputSettings.forceRefresh !== false,
      options: buildWorkflowReportOptions(inputSettings),
      logger: console,
    });
    const artifactInputSettings = {
      ...inputSettings,
      reportType,
      reportSourceType: reportType,
      analysisArtifacts: [{ kind: reportType }],
      ...(targets[0]?.permissionProfileId ? { permissionProfileId: targets[0].permissionProfileId } : {}),
      ...(targets[0]?.workloadId ? { workloadId: targets[0].workloadId } : {}),
    };
    const artifactContext = await buildAnalysisArtifactContext({
      store,
      inputSettings: artifactInputSettings,
    });
    const output = [
      `Local ${reportType} report completed for ${targets.length} target(s).`,
      `Scanner run: ${scannerResult.scanId || scannerResult.taskArn || "unknown"}.`,
      artifactContext.length
        ? `Artifact context: ${JSON.stringify(artifactContext, null, 2)}`
        : "No artifact context was returned after the scan.",
    ].join("\n\n");
    const status = scannerResult.ok ? "succeeded" : "failed";
    const task = buildReportTask({
      status,
      output,
      extra: {
        scannerRunId: scannerResult.scanId || null,
        scannerResult,
        localAnalysisArtifactsContext: artifactContext,
      },
    });
    workflowLog("report node finished", {
      workflowRunId,
      nodeId: node.id,
      reportType,
      status,
      scannerRunId: scannerResult.scanId || null,
      resultCount: Array.isArray(scannerResult.results) ? scannerResult.results.length : 0,
      failureCount: Array.isArray(scannerResult.failures) ? scannerResult.failures.length : 0,
      artifactContextCount: artifactContext.length,
    });
    return {
      nodeExecution: {
        branchId,
        nodeIndex,
        nodeId: node.id,
        nodeName: node.name,
        type: node.type,
        payloadHistory: [],
        startedAt,
        updatedAt: nowIso(),
        completedAt: nowIso(),
        tasks: [task],
        nodeOutput: {
          summary: output,
          reportType,
          scannerRunId: scannerResult.scanId || null,
          localAnalysisArtifactsContext: artifactContext,
        },
      },
      linkedAgentRunIds: [],
    };
  } catch (error) {
    const output = `Local ${reportType} report failed: ${error?.message || String(error)}`;
    const task = buildReportTask({
      status: "failed",
      output,
      extra: { error: error?.message || String(error) },
    });
    workflowLog("report node failed", {
      workflowRunId,
      nodeId: node.id,
      reportType,
      error: error?.message || String(error),
    });
    return {
      nodeExecution: {
        branchId,
        nodeIndex,
        nodeId: node.id,
        nodeName: node.name,
        type: node.type,
        payloadHistory: [],
        startedAt,
        updatedAt: nowIso(),
        completedAt: nowIso(),
        tasks: [task],
        nodeOutput: { summary: output, reportType },
      },
      linkedAgentRunIds: [],
    };
  }
}

async function executeWorkflowTaskNode({
  store,
  node,
  workflowRunId,
  nodeIndex = 0,
  cloudTaskRunner = "cloudagent",
  mcpUrl = null,
}) {
  const startedAt = nowIso();
  const blueprintIds = node.blueprintId.length ? node.blueprintId : [null];
  const tasks = [];
  const linkedAgentRunIds = [];
  const branchId = `local-${node.id}`;
  const normalizedRunner = normalizeWorkflowCloudTaskRunner(cloudTaskRunner);

  workflowLog("task node started", {
    workflowRunId,
    nodeId: node.id,
    nodeName: node.name,
    nodeType: node.type,
    nodeIndex,
    blueprintCount: blueprintIds.filter(Boolean).length,
  });

  for (const blueprintId of blueprintIds) {
    const taskId = `${node.id}:${blueprintId || "local"}`;
    const taskTitle = blueprintId
      ? `${node.name} (${blueprintId})`
      : node.name;
    const blueprint = blueprintId ? await resolveWorkflowBlueprint(store, blueprintId) : null;

    workflowLog("task started", {
      workflowRunId,
      nodeId: node.id,
      taskId,
      taskTitle,
      blueprintId: blueprintId || null,
      hasBlueprint: Boolean(blueprint),
    });

    if (blueprintId && !blueprint) {
      tasks.push({
        id: taskId,
        taskId,
        title: taskTitle,
        taskLabel: taskTitle,
        status: "failed",
        startedAt,
        updatedAt: nowIso(),
        completedAt: nowIso(),
        output: `Blueprint ${blueprintId} is not available in local files.`,
        taskInputSettings: node.inputSettings,
        result: workflowTaskResult({
          status: "failed",
          message: `Blueprint ${blueprintId} is not available in local files.`,
          extra: { blueprintId, error: "BLUEPRINT_NOT_FOUND" },
        }),
      });
      workflowLog("task failed", {
        workflowRunId,
        nodeId: node.id,
        taskId,
        reason: "BLUEPRINT_NOT_FOUND",
      });
      continue;
    }

    const selectedAuthProfile = await resolveAuthProfile(
      store,
      node.inputSettings?.authProfile,
      node.inputSettings?.authProfiles,
      node.inputSettings?.permissionProfileId,
      node.permissionProfile,
    );
    const credentialBlocker = await getLocalCredentialRunBlocker(store, selectedAuthProfile || {});
    if (credentialBlocker) {
      const output = `Local workflow cannot run "${taskTitle}" because the selected AWS credentials are not valid. ${credentialBlocker.message}`;
      tasks.push({
        id: taskId,
        taskId,
        title: taskTitle,
        taskLabel: taskTitle,
        status: "failed",
        startedAt,
        updatedAt: nowIso(),
        completedAt: nowIso(),
        output,
        task_output: output,
        taskInputSettings: node.inputSettings,
        result: workflowTaskResult({
          status: "failed",
          message: output,
          extra: {
            blueprintId,
            error: credentialBlocker.code,
            permissionProfileId: credentialBlocker.permissionProfileId,
          },
        }),
      });
      workflowLog("task blocked by credential status", {
        workflowRunId,
        nodeId: node.id,
        taskId,
        blueprintId: blueprintId || null,
        code: credentialBlocker.code,
        permissionProfileId: credentialBlocker.permissionProfileId,
      });
      continue;
    }

    const artifactContext = await buildAnalysisArtifactContext({
      store,
      inputSettings: node.inputSettings,
    });
    const nodeInputSettings = {
      ...(node.inputSettings || {}),
      localAnalysisArtifactsContext: artifactContext,
    };
    const syntheticPlanPayload = blueprint
      ? null
      : buildLocalWorkflowNodePlanPayload({
          node: { ...node, inputSettings: nodeInputSettings },
          taskId,
          taskTitle,
          artifactContext,
        });
    workflowLog(`task dispatching local ${
      normalizedRunner === "cloudagent" ? "CloudAgent" : codingAgentRunnerLabel(normalizedRunner)
    } runner`, {
      workflowRunId,
      nodeId: node.id,
      taskId,
      blueprintId: blueprintId || null,
      hasBlueprint: Boolean(blueprint),
      hasSyntheticPlan: Boolean(syntheticPlanPayload),
      artifactContextCount: artifactContext.length,
      openAIConfigured: isLocalOpenAIConfigured(),
      runner: normalizedRunner,
    });
    const llmResult = ["codex", "claude", "cursor"].includes(normalizedRunner)
      ? await executeLocalAgentPlanWithCodex({
          runner: normalizedRunner,
          store,
          planId: blueprintId || node.id,
          blueprint,
          planPayload: syntheticPlanPayload,
          inputSettings: nodeInputSettings,
          authProfile: nodeInputSettings.authProfile || null,
          parentId: workflowRunId,
          title: taskTitle,
          mcpUrl,
        })
      : await executeLocalAgentPlanWithCloudAgent({
          store,
          planId: blueprintId || node.id,
          blueprint,
          planPayload: syntheticPlanPayload,
          inputSettings: nodeInputSettings,
          authProfile: nodeInputSettings.authProfile || null,
          parentId: workflowRunId,
          title: taskTitle,
        });
    if (!llmResult) {
      workflowLog("task falling back to local CLI extractor", {
        workflowRunId,
        nodeId: node.id,
        taskId,
        blueprintId: blueprintId || null,
        reason: "local_openai_not_configured_or_no_cloudagent_result",
        runner: normalizedRunner,
      });
    }
    const result = llmResult || await executeLocalAgentPlan({
      store,
      planId: blueprintId || node.id,
      blueprint,
      planPayload: syntheticPlanPayload,
      inputSettings: nodeInputSettings,
      parentId: workflowRunId,
      title: taskTitle,
    });
    const workflowTaskStatus = workflowStatusForAgentResult(result);
    const taskOutput = result.runSummary?.finalSummary || result.summary;
    linkedAgentRunIds.push(result.recordId);
    workflowLog("task finished", {
      workflowRunId,
      nodeId: node.id,
      taskId,
      status: workflowTaskStatus,
      agentRunId: result.recordId || null,
      logCount: Array.isArray(result.logs) ? result.logs.length : 0,
      summary: safeTrim(result.summary).slice(0, 500),
      runner: normalizedRunner,
    });
    tasks.push({
      id: taskId,
      taskId,
      title: taskTitle,
      taskLabel: taskTitle,
      status: workflowTaskStatus,
      startedAt,
      updatedAt: nowIso(),
      completedAt: nowIso(),
      output: taskOutput,
      task_output: taskOutput,
      taskInputSettings: nodeInputSettings,
      agentRunId: result.recordId,
      executionMode: normalizedRunner,
      runner: normalizedRunner,
      result: workflowTaskResult({
        status: workflowTaskStatus,
        message: taskOutput,
        logs: result.logs,
        agentRunId: result.recordId,
        completedTask: result.logs.at(-1)
          ? {
              title: result.logs.at(-1).taskId,
              phaseIndex: result.logs.at(-1).phaseIndex,
              taskIndex: result.logs.at(-1).taskIndex,
              status: result.logs.at(-1).status,
            }
          : null,
        extra: { blueprintId, runner: normalizedRunner, executionMode: normalizedRunner },
      }),
    });
  }

  workflowLog("task node finished", {
    workflowRunId,
    nodeId: node.id,
    nodeName: node.name,
    nodeIndex,
    taskCount: tasks.length,
    taskStatuses: tasks.map((task) => task.status),
  });

  return {
    nodeExecution: {
      branchId,
      nodeIndex,
      nodeId: node.id,
      nodeName: node.name,
      type: node.type,
      payloadHistory: [],
      startedAt,
      updatedAt: nowIso(),
      completedAt: nowIso(),
      tasks,
      nodeOutput: {
        summary: tasks.map((task) => task.output || task.task_output).filter(Boolean).join("\n\n"),
      },
    },
    linkedAgentRunIds,
  };
}

function normalizeEmailRecipients(value) {
  return asArray(value)
    .flatMap((entry) => safeString(entry).split(/[,\n;]/))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isEmailCommunicationNode(node = {}) {
  const communicationType = safeTrim(node.communicationType || node.action || "email").toLowerCase();
  return communicationType === "email" ||
    communicationType.includes("email") ||
    communicationType.includes("notify");
}

function buildFallbackWorkflowEmail({ definition = {}, node = {}, recipients = [], executionHistory = [] } = {}) {
  const priorText = truncateText(collectExecutionText(executionHistory), 8000);
  const subject = firstNonEmpty(
    node.subject,
    node.emailSubject,
    `${definition.title || "CloudAgent workflow"} summary`
  );
  const body = [
    `Workflow: ${definition.title || "CloudAgent workflow"}`,
    "",
    node.action || node.summaryInstructions || node.logic?.join?.("\n") || "CloudAgent workflow update.",
    "",
    priorText ? `Summary of prior workflow output:\n${priorText}` : "No prior workflow output was available.",
    "",
    "CloudAgent",
  ].join("\n");
  return {
    status: "succeeded",
    recipient: recipients[0] || "",
    recipients,
    cc: [],
    subject,
    textBody: body,
    htmlBody: "",
    message: "Local dummy email content was generated without OpenAI because no local OpenAI key is configured.",
  };
}

async function executeWorkflowCommunicationNode({
  definition,
  node,
  workflowRunId,
  nodeIndex = 0,
  executionHistory = [],
} = {}) {
  const startedAt = nowIso();
  const branchId = `local-${node.id}`;
  const recipients = normalizeEmailRecipients(node.recipients);
  const communicationType = safeTrim(node.communicationType || "email") || "email";

  workflowLog("communication node started", {
    workflowRunId,
    nodeId: node.id,
    nodeName: node.name,
    nodeIndex,
    communicationType,
    recipientCount: recipients.length,
    localDummyDelivery: true,
    openAIConfigured: isLocalOpenAIConfigured(),
  });

  if (!isEmailCommunicationNode(node)) {
    const output = `Communication type "${communicationType}" is not implemented in local mode.`;
    return {
      nodeExecution: {
        branchId,
        nodeIndex,
        nodeId: node.id,
        nodeName: node.name,
        type: node.type,
        payloadHistory: [],
        startedAt,
        updatedAt: nowIso(),
        completedAt: nowIso(),
        tasks: [{
          id: `${node.id}:local`,
          taskId: `${node.id}:local`,
          title: node.name,
          taskLabel: node.name,
          status: "waiting_on_user_input",
          startedAt,
          updatedAt: nowIso(),
          completedAt: null,
          output,
          task_output: output,
          taskInputSettings: { communicationType, recipients },
          result: workflowTaskResult({
            status: "waiting_on_user_input",
            message: output,
            logs: [],
          }),
        }],
        nodeOutput: { summary: output },
      },
      linkedAgentRunIds: [],
    };
  }

  const priorExecutionText = collectExecutionText(executionHistory);
  let email = null;
  let generationError = null;
  try {
    email = await generateLocalWorkflowEmailWithOpenAI({
      workflow: {
        workflowId: definition.workflowId,
        title: definition.title,
        description: definition.description,
      },
      node,
      recipients,
      priorExecutionText,
    });
  } catch (error) {
    generationError = error?.message || String(error);
    workflowLog("communication email generation failed", {
      workflowRunId,
      nodeId: node.id,
      error: generationError,
    });
  }

  if (!email) {
    email = buildFallbackWorkflowEmail({
      definition,
      node,
      recipients,
      executionHistory,
    });
  }

  const sentAt = nowIso();
  const sentEmail = {
    provider: "local-dummy",
    deliveryMode: "dummy",
    sent: true,
    sentAt,
    recipient: email.recipient || recipients[0] || "",
    recipients: normalizeEmailRecipients(email.recipients?.length ? email.recipients : recipients),
    cc: normalizeEmailRecipients(email.cc || []),
    subject: email.subject || `${definition.title || "CloudAgent workflow"} summary`,
    textBody: email.textBody || "",
    htmlBody: email.htmlBody || "",
    note: "Local mode dummy email: no external email was sent.",
    ...(generationError ? { generationError } : {}),
  };
  const output = [
    `Local dummy email marked as sent to ${sentEmail.recipients.join(", ") || sentEmail.recipient || "unknown recipient"}.`,
    `Subject: ${sentEmail.subject}`,
    "",
    sentEmail.textBody || sentEmail.htmlBody,
  ].filter(Boolean).join("\n");

  const task = {
    id: `${node.id}:local-email`,
    taskId: `${node.id}:local-email`,
    title: node.name,
    taskLabel: node.name,
    status: "succeeded",
    startedAt,
    updatedAt: sentAt,
    completedAt: sentAt,
    output,
    task_output: output,
    taskInputSettings: {
      communicationType,
      recipients,
      action: node.action,
      logic: node.logic,
      summaryInstructions: node.summaryInstructions,
      localDummyDelivery: true,
    },
    result: workflowTaskResult({
      status: "succeeded",
      message: email.message || "Local dummy email marked as sent.",
      logs: [],
      extra: {
        sentEmail,
        localDummyDelivery: true,
      },
    }),
  };

  workflowLog("communication node dummy email recorded", {
    workflowRunId,
    nodeId: node.id,
    nodeName: node.name,
    nodeIndex,
    recipientCount: sentEmail.recipients.length || (sentEmail.recipient ? 1 : 0),
    subject: sentEmail.subject,
    generatedWithOpenAI: Boolean(email && !generationError && isLocalOpenAIConfigured()),
  });

  return {
    nodeExecution: {
      branchId,
      nodeIndex,
      nodeId: node.id,
      nodeName: node.name,
      type: node.type,
      payloadHistory: [],
      startedAt,
      updatedAt: sentAt,
      completedAt: sentAt,
      tasks: [task],
      nodeOutput: {
        summary: output,
        sentEmail,
        localDummyDelivery: true,
      },
    },
    linkedAgentRunIds: [],
  };
}

function executeSimpleWorkflowNode(node, nodeIndex = 0) {
  const startedAt = nowIso();
  const waitTypes = new Set(["approval"]);
  const status = waitTypes.has(node.type) ? "waiting_on_user_input" : "succeeded";
  const outputByType = {
    startNode: "Workflow started in local mode.",
    endNode: node.summaryInstructions || "Workflow completed in local mode.",
    approval: "Approval node is waiting for local user approval handling.",
  };
  const output = outputByType[node.type] || `Node ${node.name} recorded.`;
  workflowLog("simple node executed", {
    nodeId: node.id,
    nodeName: node.name,
    nodeType: node.type,
    nodeIndex,
    status,
    output: safeTrim(output).slice(0, 500),
  });
  return {
    nodeExecution: {
      branchId: `local-${node.id}`,
      nodeIndex,
      nodeId: node.id,
      nodeName: node.name,
      type: node.type,
      payloadHistory: [],
      startedAt,
      updatedAt: nowIso(),
      completedAt: nowIso(),
      tasks: [{
        id: `${node.id}:local`,
        taskId: `${node.id}:local`,
        title: node.name,
        taskLabel: node.name,
        status,
        startedAt,
        updatedAt: nowIso(),
        completedAt: status === "succeeded" ? nowIso() : null,
        output,
        task_output: output,
        taskInputSettings: {},
        result: workflowTaskResult({
          status,
          message: output,
          logs: output,
        }),
      }],
      nodeOutput: { summary: output },
    },
    linkedAgentRunIds: [],
  };
}

function findLastExecutedEndNode(definition, executionHistory = []) {
  const nodesById = new Map((definition?.nodes || []).map((node) => [node.id, node]));
  for (let index = executionHistory.length - 1; index >= 0; index -= 1) {
    const execution = executionHistory[index];
    const node = nodesById.get(execution?.nodeId);
    if (node?.type === "endNode" || execution?.type === "endNode") {
      return node || execution;
    }
  }
  return null;
}

function buildFallbackWorkflowRunSummary({
  definition,
  endNode,
  executionHistory = [],
  finalStatus,
  failedCount = 0,
  waitingCount = 0,
  linkedAgentRunIds = [],
  stoppedEarly = false,
  stopReason = null,
} = {}) {
  const instructionText = safeTrim(endNode?.summaryInstructions);
  const executedNodes = executionHistory.filter((execution) =>
    !["startNode", "endNode"].includes(execution?.type)
  );
  const nodeLines = executedNodes.map((execution) => {
    const tasks = asArray(execution?.tasks);
    const statuses = tasks.map((task) => safeTrim(task?.status)).filter(Boolean);
    const statusText = statuses.length ? statuses.join(", ") : "recorded";
    const outputText = safeTrim(
      execution?.nodeOutput?.summary ||
      tasks.map((task) =>
        safeTrim(task?.result?.output?.message || task?.result?.output?.logs || task?.output)
      ).filter(Boolean).join(" ")
    );
    return `- ${execution?.nodeName || execution?.nodeId || "Workflow node"} (${execution?.type || "node"}): ${statusText}${outputText ? ` - ${outputText.slice(0, 500)}` : ""}`;
  });

  return [
    "## Workflow Summary",
    "",
    "### Status",
    `- Workflow: ${definition?.title || "Untitled Workflow"}`,
    `- Final status: ${finalStatus}`,
    `- Executed nodes: ${executionHistory.length}`,
    linkedAgentRunIds.length ? `- Linked agent runs: ${linkedAgentRunIds.length}` : null,
    failedCount ? `- Failed nodes: ${failedCount}` : null,
    waitingCount ? `- Waiting nodes: ${waitingCount}` : null,
    stoppedEarly ? `- Stopped early: ${stopReason || "yes"}` : null,
    instructionText ? ["", "### Summary Instructions", instructionText] : null,
    nodeLines.length ? ["", "### Node Results", ...nodeLines] : null,
  ].flat().filter(Boolean).join("\n");
}

async function buildFinalWorkflowRunSummary({
  definition,
  executionHistory = [],
  finalStatus,
  failedCount = 0,
  waitingCount = 0,
  linkedAgentRunIds = [],
  stoppedEarly = false,
  stopReason = null,
} = {}) {
  const endNode = findLastExecutedEndNode(definition, executionHistory);
  const fallbackSummary = buildFallbackWorkflowRunSummary({
    definition,
    endNode,
    executionHistory,
    finalStatus,
    failedCount,
    waitingCount,
    linkedAgentRunIds,
    stoppedEarly,
    stopReason,
  });

  if (!endNode || finalStatus !== "completed") {
    return fallbackSummary;
  }

  const instructions = safeTrim(endNode.summaryInstructions);
  if (!instructions || !isLocalOpenAIConfigured()) {
    return fallbackSummary;
  }

  try {
    const generated = await generateLocalWorkflowSummaryWithOpenAI({
      workflow: {
        workflowId: definition?.workflowId,
        title: definition?.title,
        description: definition?.description,
      },
      endNode,
      executionHistory,
      instructions,
    });
    return safeTrim(generated) || fallbackSummary;
  } catch (error) {
    workflowLog("workflow summary generation failed", {
      workflowId: definition?.workflowId || null,
      endNodeId: endNode?.id || null,
      error: error?.message || String(error),
    });
    return fallbackSummary;
  }
}

function collectReachableNodeIds(nodesById, startIds = []) {
  const reachable = new Set();
  const stack = [...startIds].map(String).filter(Boolean);
  while (stack.length) {
    const id = stack.pop();
    if (!id || reachable.has(id)) continue;
    reachable.add(id);
    const node = nodesById.get(id);
    if (!node) continue;
    stack.push(...asArray(node.next).map(String).filter(Boolean));
  }
  return reachable;
}

function collectSkippedBranchNodeIds({ nodesById, selectedNextIds = [], skippedNextIds = [] } = {}) {
  const selectedReachable = collectReachableNodeIds(nodesById, selectedNextIds);
  const skipped = new Set();
  const stack = skippedNextIds.map(String).filter(Boolean);
  while (stack.length) {
    const id = stack.pop();
    if (!id || skipped.has(id) || selectedReachable.has(id)) continue;
    skipped.add(id);
    const node = nodesById.get(id);
    if (!node) continue;
    stack.push(...asArray(node.next).map(String).filter(Boolean));
  }
  return skipped;
}

export async function createLocalWorkflowRun({
  store,
  workflowDefinition,
  workflowRunPreferences = {},
}) {
  const definition = normalizeWorkflowDefinition(workflowDefinition);
  const startedAt = nowIso();
  const cloudTaskRunner = normalizeWorkflowCloudTaskRunner(
    workflowRunPreferences?.cloudTaskRunner ||
    definition?.workflowRunPreferences?.cloudTaskRunner ||
    definition?.runPreferences?.cloudTaskRunner
  );
  const initialRun = await store.createWorkflowRun({
    workflowId: definition.workflowId,
    title: definition.title,
    workflowStatus: "running",
    workflowDefinition: {
      ...definition,
      workflowRunPreferences: {
        ...(definition.workflowRunPreferences || {}),
        cloudTaskRunner,
      },
      workflowRunSummary: {
        summary: `Local runner started "${definition.title}".`,
        generatedAt: startedAt,
        status: "running",
      },
    },
    executionHistory: [],
    currentExecutions: [],
    statusMessage: "Local runner started.",
    startedAt,
  });

  return {
    workflowRun: initialRun,
    workflowRunId: initialRun.workflowRunId,
    workflowStatus: initialRun.workflowStatus,
    definition,
    cloudTaskRunner,
    startedAt,
    message: `Local runner started "${definition.title}".`,
  };
}

export async function executeLocalWorkflow({
  store,
  workflowDefinition,
  workflowRunPreferences = {},
  mcpUrl = null,
  workflowRunId = null,
}) {
  let initialRun;
  let definition;
  let cloudTaskRunner;

  if (workflowRunId) {
    initialRun = await store.getWorkflowRun(workflowRunId);
    if (!initialRun) {
      throw new Error(`Workflow run not found: ${workflowRunId}`);
    }
    definition = normalizeWorkflowDefinition(initialRun.workflowDefinition || workflowDefinition || {});
    cloudTaskRunner = normalizeWorkflowCloudTaskRunner(
      initialRun.workflowDefinition?.workflowRunPreferences?.cloudTaskRunner ||
      workflowRunPreferences?.cloudTaskRunner ||
      definition?.workflowRunPreferences?.cloudTaskRunner ||
      definition?.runPreferences?.cloudTaskRunner
    );
  } else {
    const created = await createLocalWorkflowRun({
      store,
      workflowDefinition,
      workflowRunPreferences,
    });
    initialRun = created.workflowRun;
    definition = created.definition;
    cloudTaskRunner = created.cloudTaskRunner;
  }

  const executionHistory = [];
  const linkedAgentRunIds = [];
  const blockingExecutions = [];
  let failedCount = 0;
  let waitingCount = 0;
  let stoppedEarly = false;
  let stopReason = null;

  const orderedNodes = buildWorkflowOrder(definition.nodes);
  const nodesById = new Map(definition.nodes.map((node) => [node.id, node]));
  const skippedNodeIds = new Set();
  workflowLog("workflow started", {
    workflowRunId: initialRun.workflowRunId,
    workflowId: definition.workflowId || null,
    title: definition.title,
    nodeCount: definition.nodes.length,
    orderedNodeCount: orderedNodes.length,
    cloudTaskRunner,
    mcpConfigured: Boolean(mcpUrl),
    orderedNodes: orderedNodes.map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      next: node.next,
    })),
  });

  for (let nodeIndex = 0; nodeIndex < orderedNodes.length; nodeIndex += 1) {
    const node = orderedNodes[nodeIndex];
    const latestRun = await store.getWorkflowRun(initialRun.workflowRunId);
    if (String(latestRun?.workflowStatus || "").toLowerCase() === "cancelled") {
      stoppedEarly = true;
      stopReason = "workflow_cancelled";
      workflowLog("workflow stopped before next node", {
        workflowRunId: initialRun.workflowRunId,
        stopReason,
        nodeId: node.id,
        nodeName: node.name,
        skippedNodeCount: Math.max(0, orderedNodes.length - executionHistory.length),
      });
      return {
        ok: false,
        workflowRunId: latestRun.workflowRunId,
        workflowStatus: latestRun.workflowStatus,
        workflowRun: latestRun,
        linkedAgentRunIds,
        summary: latestRun.statusMessage || "Workflow cancelled.",
        message: latestRun.statusMessage || "Workflow cancelled.",
      };
    }
    if (skippedNodeIds.has(node.id)) {
      workflowLog("node skipped by decision branch", {
        workflowRunId: initialRun.workflowRunId,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        nodeIndex,
      });
      continue;
    }
    const inProgressExecution = createInProgressWorkflowNodeExecution(node, nodeIndex);
    await store.updateWorkflowRun(initialRun.workflowRunId, {
      workflowStatus: failedCount ? "failed" : waitingCount ? "waiting_on_user_input" : "running",
      currentExecutions: [inProgressExecution],
      executionHistory,
      linkedAgentRunIds,
      statusMessage: `Executing ${node.name || node.id || `node ${nodeIndex + 1}`}.`,
    });
    workflowLog("node started", {
      workflowRunId: initialRun.workflowRunId,
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      nodeIndex,
      inputFrom: node.inputFrom,
      next: node.next,
    });
    const result = node.type === "reportTask"
      ? await executeWorkflowReportNode({ store, node, workflowRunId: initialRun.workflowRunId, nodeIndex })
      : node.type === "cloudTask"
        ? await executeWorkflowTaskNode({
            store,
            node,
            workflowRunId: initialRun.workflowRunId,
            nodeIndex,
            cloudTaskRunner,
            mcpUrl,
          })
        : node.type === "communication"
          ? await executeWorkflowCommunicationNode({
              definition,
              node,
              workflowRunId: initialRun.workflowRunId,
              nodeIndex,
              executionHistory,
            })
        : node.type === "decision"
          ? executeDecisionWorkflowNode({ node, nodeIndex, executionHistory })
          : executeSimpleWorkflowNode(node, nodeIndex);
    const latestAfterNodeRun = await store.getWorkflowRun(initialRun.workflowRunId);
    if (String(latestAfterNodeRun?.workflowStatus || "").toLowerCase() === "cancelled") {
      stoppedEarly = true;
      stopReason = "workflow_cancelled";
      workflowLog("workflow stopped after node because it was cancelled", {
        workflowRunId: initialRun.workflowRunId,
        stopReason,
        nodeId: node.id,
        nodeName: node.name,
      });
      return {
        ok: false,
        workflowRunId: latestAfterNodeRun.workflowRunId,
        workflowStatus: latestAfterNodeRun.workflowStatus,
        workflowRun: latestAfterNodeRun,
        linkedAgentRunIds,
        summary: latestAfterNodeRun.statusMessage || "Workflow cancelled.",
        message: latestAfterNodeRun.statusMessage || "Workflow cancelled.",
      };
    }
    executionHistory.push(result.nodeExecution);
    linkedAgentRunIds.push(...result.linkedAgentRunIds);
    if (node.type === "decision") {
      const branchSkips = collectSkippedBranchNodeIds({
        nodesById,
        selectedNextIds: result.selectedNextIds || [],
        skippedNextIds: result.skippedNextIds || [],
      });
      branchSkips.forEach((id) => skippedNodeIds.add(id));
      workflowLog("decision branch selection applied", {
        workflowRunId: initialRun.workflowRunId,
        nodeId: node.id,
        selectedNextIds: result.selectedNextIds || [],
        skippedNextIds: result.skippedNextIds || [],
        skippedBranchNodeIds: Array.from(branchSkips),
      });
    }
    const taskStatuses = result.nodeExecution.tasks.map((task) => String(task.status).toLowerCase());
    const nodeFailed = taskStatuses.some((status) => ["failed", "error"].includes(status));
    const nodeWaiting = taskStatuses.some((status) =>
      ["waiting_on_user_input", "agent_waiting_on_user_input"].includes(status)
    );
    if (nodeFailed) {
      failedCount += 1;
    }
    if (nodeWaiting) {
      waitingCount += 1;
      blockingExecutions.push(result.nodeExecution);
    }
    const nextStatus = failedCount ? "failed" : waitingCount ? "waiting_on_user_input" : "running";
    workflowLog("node finished", {
      workflowRunId: initialRun.workflowRunId,
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      nodeIndex,
      taskStatuses,
      nodeFailed,
      nodeWaiting,
      nextWorkflowStatus: nextStatus,
      executedNodeCount: executionHistory.length,
      totalNodeCount: orderedNodes.length,
    });
    await store.updateWorkflowRun(initialRun.workflowRunId, {
      workflowStatus: nextStatus,
      currentExecutions: [result.nodeExecution],
      executionHistory,
      linkedAgentRunIds,
      statusMessage: `Executed ${executionHistory.length} of ${definition.nodes.length} node(s).`,
    });
    workflowLog("workflow status updated", {
      workflowRunId: initialRun.workflowRunId,
      workflowStatus: nextStatus,
      executionHistoryCount: executionHistory.length,
      failedCount,
      waitingCount,
    });

    if (nodeFailed || nodeWaiting) {
      stoppedEarly = true;
      stopReason = nodeFailed ? "node_failed" : "node_waiting_on_user_input";
      workflowLog("workflow stopped before downstream nodes", {
        workflowRunId: initialRun.workflowRunId,
        stopReason,
        nodeId: node.id,
        nodeName: node.name,
        skippedNodeCount: Math.max(0, orderedNodes.length - executionHistory.length),
        skippedNodes: orderedNodes.slice(nodeIndex + 1).map((item) => ({
          id: item.id,
          name: item.name,
          type: item.type,
        })),
      });
      break;
    }
  }

  const finalStatus = failedCount ? "failed" : waitingCount ? "waiting_on_user_input" : "completed";
  const summary = await buildFinalWorkflowRunSummary({
    definition,
    executionHistory,
    finalStatus,
    failedCount,
    waitingCount,
    linkedAgentRunIds,
    stoppedEarly,
    stopReason,
  });
  const finalDefinition = {
    ...definition,
    workflowRunPreferences: {
      ...(definition.workflowRunPreferences || {}),
      cloudTaskRunner,
    },
    workflowRunSummary: {
      summary,
      finalSummary: summary,
      generatedAt: nowIso(),
      status: finalStatus,
    },
  };
  const workflowRun = await store.updateWorkflowRun(initialRun.workflowRunId, {
    workflowStatus: finalStatus,
    workflowDefinition: finalDefinition,
    currentExecutions: finalStatus === "waiting_on_user_input" ? blockingExecutions : [],
    executionHistory,
    linkedAgentRunIds,
    statusMessage: summary,
    completedAt: nowIso(),
  });

  workflowLog("workflow finished", {
    workflowRunId: workflowRun.workflowRunId,
    workflowStatus: workflowRun.workflowStatus,
    executedNodeCount: executionHistory.length,
    totalNodeCount: orderedNodes.length,
    failedCount,
    waitingCount,
    stoppedEarly,
    stopReason,
    summary,
  });

  return {
    ok: finalStatus === "completed",
    workflowRunId: workflowRun.workflowRunId,
    workflowStatus: workflowRun.workflowStatus,
    workflowRun,
    linkedAgentRunIds,
    summary,
    message: summary,
  };
}
