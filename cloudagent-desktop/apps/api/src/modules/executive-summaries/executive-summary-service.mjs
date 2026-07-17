import { z } from "zod";
import { parseStoredObject } from "@cloudagent/storage";
import { generateLocalExecutiveSummaryWithOpenAI } from "../../platform/openai.mjs";
import { localArray } from "../../lib/http.mjs";

export const ExecutiveSummaryBodySchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("account"),
    recordId: z.string().min(1),
    options: z.record(z.any()).optional(),
  }).passthrough(),
  z.object({
    scope: z.literal("workload"),
    workloadId: z.string().min(1),
    options: z.record(z.any()).optional(),
  }).passthrough(),
]);

export function profileSummaryLine(profile) {
  const authProfile = parseStoredObject(profile?.authProfile, {});
  const accountId = authProfile.awsAccountId || authProfile.accountId || authProfile.subscriptionId || null;
  return [
    profile?.name || profile?.recordId || "Untitled environment",
    profile?.type ? `type: ${profile.type}` : null,
    accountId ? `account/subscription: ${accountId}` : null,
  ].filter(Boolean).join(" | ");
}

export function workloadSummaryLine(workload) {
  const trackedResources = parseStoredObject(workload?.trackedResources, { resources: [], stacks: [] });
  const resourceCount = Array.isArray(trackedResources.resources) ? trackedResources.resources.length : 0;
  const stackCount = Array.isArray(trackedResources.stacks) ? trackedResources.stacks.length : 0;
  return [
    workload?.workloadName || workload?.workloadId || "Untitled workload",
    `${Array.isArray(workload?.environments) ? workload.environments.length : 0} environment(s)`,
    `${resourceCount} resource(s)`,
    `${stackCount} stack(s)`,
  ].join(" | ");
}

export function scannerGeneratedAt(kind, payload = {}) {
  return payload?.analysis?.[kind]?.generatedAt || payload?.generatedAt || payload?.updatedAt || null;
}

export function scannerResourceArray(payload = {}) {
  if (Array.isArray(payload.resources)) return payload.resources;
  const results = payload?.results;
  if (!results || typeof results !== "object" || Array.isArray(results)) return [];
  return Object.values(results).flatMap((result) =>
    Array.isArray(result?.resources) ? result.resources : []
  );
}

export function summarizeInventoryForExecutiveSummary(payload = {}) {
  const resources = scannerResourceArray(payload);
  const serviceCounts = resources.reduce((counts, resource) => {
    const service = String(
      resource?.service || resource?.serviceKey || resource?.resourceType || resource?.type || "unknown"
    );
    counts[service] = (counts[service] || 0) + 1;
    return counts;
  }, {});
  const regionCounts = resources.reduce((counts, resource) => {
    const region = String(resource?.region || "global");
    counts[region] = (counts[region] || 0) + 1;
    return counts;
  }, {});

  return {
    available: true,
    generatedAt: scannerGeneratedAt("inventory", payload),
    accountId: payload.accountId || payload.defaultAccountId || payload.authProfile?.awsAccountId || null,
    resourceCount: resources.length,
    services: Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([service, count]) => ({ service, count })),
    regions: Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([region, count]) => ({ region, count })),
    resourceSamples: resources.slice(0, 20).map((resource) => ({
      resourceId: resource.resourceId || resource.id || resource.name || resource.arn || null,
      resourceType: resource.resourceType || resource.type || null,
      service: resource.service || resource.serviceKey || null,
      region: resource.region || null,
      name: resource.name || null,
    })),
  };
}

export function isExecutiveSummaryProblemStatus(value) {
  return /(fail|error|warn|critical|alarm|unhealthy|impaired|unknown|expired|aborted|problem)/i.test(
    String(value || "")
  );
}

export function summarizeHealthForExecutiveSummary(payload = {}) {
  const resources = localArray(payload.resources);
  const issueResources = resources.filter((resource) => {
    const checks = localArray(resource?.checks);
    return (
      localArray(resource?.errors).length > 0 ||
      isExecutiveSummaryProblemStatus(resource?.status || resource?.healthStatus || resource?.state) ||
      checks.some((check) => isExecutiveSummaryProblemStatus(check?.status || check?.severity))
    );
  });

  return {
    available: true,
    generatedAt: scannerGeneratedAt("health", payload),
    accountId: payload.accountId || null,
    permissionProfileId: payload.permissionProfileId || null,
    workloadId: payload.workloadId || null,
    resourceCount: resources.length,
    issueResourceCount: issueResources.length,
    summary: payload.summary || payload.analysis?.health?.summary || {},
    issueSamples: issueResources.slice(0, 15).map((resource) => ({
      resourceId: resource.resourceId || resource.id || resource.name || resource.arn || null,
      resourceType: resource.resourceType || resource.type || null,
      region: resource.region || null,
      status: resource.status || resource.healthStatus || resource.state || null,
      errors: localArray(resource.errors).slice(0, 3),
      failedChecks: localArray(resource.checks)
        .filter((check) => isExecutiveSummaryProblemStatus(check?.status || check?.severity))
        .slice(0, 5)
        .map((check) => ({
          checkId: check.checkId || check.id || null,
          name: check.checkName || check.name || null,
          status: check.status || check.severity || null,
          summary: String(check.summary || check.message || check.description || "").slice(0, 500),
        })),
    })),
  };
}

export function summarizeCostForExecutiveSummary(payload = {}) {
  const checks = localArray(payload.checks);
  const problemChecks = checks.filter((check) =>
    isExecutiveSummaryProblemStatus(check?.status || check?.severity)
  );
  return {
    available: true,
    generatedAt: scannerGeneratedAt("cost", payload),
    accountId: payload.accountId || null,
    permissionProfileId: payload.permissionProfileId || null,
    lookbackDays: payload.lookbackDays || payload.data?.spend?.range?.lookbackDays || null,
    statusCounts: payload.statusCounts || {},
    errorCount: localArray(payload.errors).length,
    errors: localArray(payload.errors).slice(0, 5),
    spend: {
      range: payload.data?.spend?.range || null,
      dailyTotalCount: localArray(payload.data?.spend?.dailyTotal).length,
      dailyByServiceCount: localArray(payload.data?.spend?.dailyByService).length,
    },
    issueSamples: problemChecks.slice(0, 15).map((check) => ({
      checkId: check.checkId || check.id || null,
      name: check.checkName || check.name || null,
      category: check.category || null,
      status: check.status || null,
      summary: String(check.summary || "").slice(0, 500),
    })),
  };
}

export async function readExecutiveSummaryScannerContext(store, kind, scopeId) {
  if (!scopeId || !store || typeof store.readLatestScannerArtifact !== "function") return null;
  const payload = await store.readLatestScannerArtifact(kind, scopeId).catch((error) => {
    console.warn("[local executive summary] failed to read scanner artifact", {
      kind,
      scopeId,
      message: error?.message || String(error),
    });
    return null;
  });
  if (!payload) return null;
  if (kind === "inventory") return summarizeInventoryForExecutiveSummary(payload);
  if (kind === "health") return summarizeHealthForExecutiveSummary(payload);
  if (kind === "cost") return summarizeCostForExecutiveSummary(payload);
  return null;
}

export function executiveSummaryAvailability(context = {}) {
  const environmentArtifacts = localArray(context.environmentArtifacts);
  return {
    inventory: Boolean(context.inventory || environmentArtifacts.some((entry) => entry.inventory)),
    health: Boolean(context.health || environmentArtifacts.some((entry) => entry.health)),
    cost: Boolean(context.cost || environmentArtifacts.some((entry) => entry.cost)),
  };
}

export function missingExecutiveSummarySources(context = {}) {
  const availability = context.availability || executiveSummaryAvailability(context);
  return ["inventory", "health", "cost"].filter((kind) => !availability[kind]);
}

export async function buildExecutiveSummaryAnalysisContext({
  store,
  scope,
  target,
  relatedProfiles = [],
} = {}) {
  if (scope === "account") {
    const scopeId = target?.recordId;
    const [inventory, health, cost] = await Promise.all([
      readExecutiveSummaryScannerContext(store, "inventory", scopeId),
      readExecutiveSummaryScannerContext(store, "health", scopeId),
      readExecutiveSummaryScannerContext(store, "cost", scopeId),
    ]);
    const context = {
      scope: "account",
      scopeId,
      inventory,
      health,
      cost,
    };
    return { ...context, availability: executiveSummaryAvailability(context) };
  }

  const workloadId = target?.workloadId;
  const workloadHealth = await readExecutiveSummaryScannerContext(store, "health", workloadId);
  const environmentArtifacts = await Promise.all(
    relatedProfiles.map(async (profile) => {
      const scopeId = profile?.recordId;
      const [inventory, health, cost] = await Promise.all([
        readExecutiveSummaryScannerContext(store, "inventory", scopeId),
        readExecutiveSummaryScannerContext(store, "health", scopeId),
        readExecutiveSummaryScannerContext(store, "cost", scopeId),
      ]);
      return {
        permissionProfileId: scopeId,
        name: profile?.name || scopeId,
        inventory,
        health,
        cost,
      };
    })
  );
  const context = {
    scope: "workload",
    scopeId: workloadId,
    health: workloadHealth,
    environmentArtifacts,
  };
  return { ...context, availability: executiveSummaryAvailability(context) };
}

export function buildLocalSummaryText({
  scope,
  target,
  relatedProfiles = [],
  relatedWorkloads = [],
  analysisContext = {},
}) {
  const title = scope === "account"
    ? `# Executive Summary: ${target.name || target.recordId}`
    : `# Executive Summary: ${target.workloadName || target.workloadId}`;
  const updatedAt = new Date().toISOString();
  const availability = analysisContext.availability || executiveSummaryAvailability(analysisContext);
  const availabilityText = (kind) => availability[kind] ? "available" : "not available yet";

  const targetLines = scope === "account"
    ? [
        `Environment: ${profileSummaryLine(target)}`,
        `Related workloads: ${relatedWorkloads.length || 0}`,
        ...relatedWorkloads.slice(0, 10).map((workload) => `- ${workloadSummaryLine(workload)}`),
      ]
    : [
        `Workload: ${workloadSummaryLine(target)}`,
        `Linked environments: ${relatedProfiles.length || 0}`,
        ...relatedProfiles.slice(0, 10).map((profile) => `- ${profileSummaryLine(profile)}`),
      ];
  const scannerReadoutLines = [
    `Inventory data: ${availabilityText("inventory")}`,
    `Health data: ${availabilityText("health")}`,
    `Cost data: ${availabilityText("cost")}`,
  ];

  return [
    title,
    "",
    `Generated: ${updatedAt}`,
    "",
    "## Scope",
    ...targetLines,
    "",
    "## Local Mode Data Coverage",
    "This summary was generated from local workload and permission profile metadata plus the latest local scanner artifacts available for inventory, health, and cost.",
    ...scannerReadoutLines.map((line) => `- ${line}`),
    "",
    "## Operational Readout",
    scope === "account"
      ? `The environment is onboarded locally as ${target.type || "a cloud environment"}. Use inventory to understand discovered services and resources, health to identify operational risk, and cost data to prioritize spend attention.`
      : `The workload is defined locally with ${Array.isArray(target.environments) ? target.environments.length : 0} linked environment(s). Keep tracked resources current so inventory, health, and cost scanners can produce stronger application-level analysis.`,
    "",
    "## Recommended Next Steps",
    "- Confirm the environment metadata and authentication profile details are complete.",
    "- Attach workloads to the correct environments.",
    "- Add tracked resources or stack references where they are known.",
    "- Run inventory, health, and cost discovery when scanner data is missing or stale.",
  ].join("\n");
}

export async function generateLocalExecutiveSummary({ store, body }) {
  const updatedAt = new Date().toISOString();
  const profiles = await store.listPermissionProfiles();
  const workloads = await store.listWorkloads();

  if (body.scope === "account") {
    const profile = await store.getPermissionProfile(body.recordId);
    if (!profile) return { status: 404, payload: { ok: false, error: "Permission profile not found" } };

    const relatedWorkloads = workloads.filter((workload) =>
      Array.isArray(workload?.environments) && workload.environments.includes(profile.recordId)
    );
    const analysisContext = await buildExecutiveSummaryAnalysisContext({
      store,
      scope: "account",
      target: profile,
    });
    const summaryText = buildLocalSummaryText({
      scope: "account",
      target: profile,
      relatedWorkloads,
      analysisContext,
    });
    const llmSummaryText = await generateLocalExecutiveSummaryWithOpenAI({
      scope: "account",
      target: profile,
      relatedWorkloads,
      analysisContext,
      fallbackSummaryText: summaryText,
    }).catch((error) => {
      console.warn("[local executive summary] OpenAI generation failed", error?.message || error);
      return null;
    });
    const sources = {
      runtime: "local",
      model: llmSummaryText ? "openai" : "heuristic",
      permissionProfile: profile.recordId,
      workloads: relatedWorkloads.map((workload) => workload.workloadId),
      dataSources: analysisContext.availability,
      unavailable: missingExecutiveSummarySources(analysisContext),
    };
    const finalSummaryText = llmSummaryText || summaryText;
    const summary = { summaryText: finalSummaryText, updatedAt, sources, reportSummaries: [] };
    await store.persistEnvironmentSummary(profile.recordId, summary);
    return {
      status: 200,
      payload: {
        ok: true,
        scope: "account",
        id: profile.recordId,
        updatedAt,
        summaryText: finalSummaryText,
        reportSummaries: [],
        sources,
      },
    };
  }

  const workload = await store.getWorkload(body.workloadId);
  if (!workload) return { status: 404, payload: { ok: false, error: "Workload not found" } };

  const envIds = new Set(Array.isArray(workload.environments) ? workload.environments : []);
  const relatedProfiles = profiles.filter((profile) => envIds.has(profile.recordId));
  const analysisContext = await buildExecutiveSummaryAnalysisContext({
    store,
    scope: "workload",
    target: workload,
    relatedProfiles,
  });
  const summaryText = buildLocalSummaryText({
    scope: "workload",
    target: workload,
    relatedProfiles,
    analysisContext,
  });
  const llmSummaryText = await generateLocalExecutiveSummaryWithOpenAI({
    scope: "workload",
    target: workload,
    relatedProfiles,
    analysisContext,
    fallbackSummaryText: summaryText,
  }).catch((error) => {
    console.warn("[local executive summary] OpenAI generation failed", error?.message || error);
    return null;
  });
  const sources = {
    runtime: "local",
    model: llmSummaryText ? "openai" : "heuristic",
    workload: workload.workloadId,
    permissionProfiles: relatedProfiles.map((profile) => profile.recordId),
    dataSources: analysisContext.availability,
    unavailable: missingExecutiveSummarySources(analysisContext),
  };
  const finalSummaryText = llmSummaryText || summaryText;
  const summary = { summaryText: finalSummaryText, updatedAt, sources, reportSummaries: [] };
  await store.persistWorkloadSummary(workload.workloadId, summary);
  return {
    status: 200,
    payload: {
      ok: true,
      scope: "workload",
      id: workload.workloadId,
      updatedAt,
      summaryText: finalSummaryText,
      reportSummaries: [],
      sources,
    },
  };
}
