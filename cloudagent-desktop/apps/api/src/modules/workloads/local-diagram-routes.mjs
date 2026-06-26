import { Router } from "express";
import { z } from "zod";

import { createDiagramSpec, updateDiagramSpec } from "@cloudagent/workloads/diagrams/spec-service";
import { validateDiagramSpec } from "@cloudagent/workloads/diagrams/validate-spec";
import { LOCAL_AUTH, parseStoredObject } from "@cloudagent/storage";

const DEFAULT_EXCLUDE_TYPES = [
  "AWS::CloudFormation::Stack",
];

const DiagramRequestSchema = z
  .object({
    workloadId: z.string().min(1),
    cloudProvider: z.enum(["aws", "azure", "gcp"]).optional(),
    excludeTypes: z.array(z.string().min(1)).optional(),
    stylePreset: z.string().max(120).nullable().optional(),
    forceRefresh: z.boolean().optional(),
  })
  .strict();

const DiagramSpecSaveSchema = z
  .object({
    spec: z.any(),
  })
  .strict();

const DiagramSpecPromptUpdateSchema = z
  .object({
    instruction: z.string().min(1).max(4000),
  })
  .strict();

function localAuth(req, _res, next) {
  req.auth = { ...LOCAL_AUTH };
  next();
}

function safeTrim(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function safeParseJsonObject(value) {
  return parseStoredObject(value, {});
}

function sanitizeTrackedResourceEntries(resources = []) {
  if (!Array.isArray(resources)) return [];
  return resources
    .filter((resource) => resource && typeof resource === "object" && !Array.isArray(resource))
    .map((resource) => {
      const { source: _source, ...rest } = resource;
      return rest;
    });
}

function normalizeTrackedResourcesValue(trackedResources = {}, deploymentPreferences = {}) {
  const tracked = safeParseJsonObject(trackedResources);
  const deploymentPrefs = safeParseJsonObject(deploymentPreferences);
  const resources = Array.isArray(tracked?.resources)
    ? sanitizeTrackedResourceEntries(tracked.resources)
    : Array.isArray(tracked?.trackedResources)
      ? sanitizeTrackedResourceEntries(tracked.trackedResources)
      : [];
  const stacks = Array.isArray(tracked?.stacks)
    ? tracked.stacks
    : Array.isArray(deploymentPrefs?.stacks)
      ? deploymentPrefs.stacks
      : [];
  return { resources, stacks };
}

function filterTrackedResources(trackedResources = {}, excludeTypes = [], deploymentPreferences = {}) {
  const normalizedTracked = normalizeTrackedResourcesValue(
    trackedResources,
    deploymentPreferences
  );
  const excludeSet = new Set(
    [
      ...DEFAULT_EXCLUDE_TYPES,
      ...(Array.isArray(excludeTypes) ? excludeTypes : []),
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );
  const resources = Array.isArray(normalizedTracked.resources)
    ? normalizedTracked.resources.filter((resource) => {
        const resourceType = String(resource?.resourceType || "").trim();
        return !resourceType || !excludeSet.has(resourceType);
      })
    : [];
  const stacks = Array.isArray(normalizedTracked.stacks) ? normalizedTracked.stacks : [];
  return { resources, stacks };
}

function normalizeCloudProvider(value) {
  const normalized = safeTrim(value).toLowerCase().replace(/_/g, "-");
  if (normalized === "azure" || normalized === "microsoft-azure") return "azure";
  if (normalized === "gcp" || normalized === "google-cloud") return "gcp";
  return "aws";
}

function inferCloudProviderFromTrackedResources(resources = [], stacks = []) {
  const resourceList = Array.isArray(resources) ? resources : [];
  const stackList = Array.isArray(stacks) ? stacks : [];
  const explicitProvider = [...resourceList, ...stackList]
    .map((item) => safeTrim(item?.provider || item?.cloudProvider).toLowerCase())
    .find(Boolean);
  if (explicitProvider) return normalizeCloudProvider(explicitProvider);

  const hasAzureResource = resourceList.some((resource) => {
    const id = safeTrim(resource?.resourceId || resource?.id).toLowerCase();
    return Boolean(resource?.subscriptionId) || id.includes("/subscriptions/");
  });
  const hasAzureStack = stackList.some((stack) => {
    const id = safeTrim(stack?.resourceId || stack?.id).toLowerCase();
    return Boolean(stack?.subscriptionId) || id.includes("/subscriptions/");
  });
  if (hasAzureResource || hasAzureStack) return "azure";

  const hasAwsResource =
    resourceList.some(
      (resource) =>
        safeTrim(resource?.resourceArn || resource?.arn || resource?.resourceId || resource?.id).startsWith("arn:aws:") ||
        safeTrim(resource?.type || resource?.resourceType).startsWith("AWS::") ||
        Boolean(resource?.accountId)
    ) ||
    stackList.some((stack) =>
      safeTrim(stack?.stackId || stack?.arn || stack?.resourceId || stack?.id).startsWith("arn:aws:")
    );
  if (hasAwsResource) return "aws";

  return "aws";
}

function resolveDiagramCloudProvider({ requestedProvider, resources, stacks }) {
  const inferredProvider = inferCloudProviderFromTrackedResources(resources, stacks);
  const normalizedRequested = safeTrim(requestedProvider)
    ? normalizeCloudProvider(requestedProvider)
    : null;
  if (normalizedRequested === "aws" && inferredProvider !== "aws") {
    return inferredProvider;
  }
  return normalizedRequested || inferredProvider;
}

function buildProviderDiagramInstructions(provider) {
  if (provider === "azure") {
    return [
      "Create an Azure architecture diagram spec for this CloudAgent workload.",
      "Requirements:",
      "- Use Azure resource icons and Azure grouping concepts that fit the tracked resources provided below.",
      "- Do not use AWS-specific icons, AWS resource types, AWS account/VPC/subnet terminology, or CloudFormation stack concepts unless they appear explicitly in the input.",
      "- Use containers/clusters when they help show major boundaries such as subscription, resource group, virtual network, subnet, region, or application tier.",
    ];
  }
  if (provider === "gcp") {
    return [
      "Create a Google Cloud architecture diagram spec for this CloudAgent workload.",
      "Requirements:",
      "- Use GCP resource icons and GCP grouping concepts that fit the tracked resources provided below.",
      "- Do not use AWS-specific icons or Azure-specific icons unless they appear explicitly in the input.",
      "- Use containers/clusters when they help show major boundaries such as project, VPC network, subnet, region, zone, or application tier.",
    ];
  }
  return [
    "Create an AWS architecture diagram spec for this CloudAgent workload.",
    "Requirements:",
    "- Use AWS resource icons and AWS grouping concepts that fit the tracked resources provided below.",
    "- Use containers/clusters when they help show major boundaries such as account, VPC, subnet, region, or stack.",
  ];
}

function buildWorkloadDiagramPrompt({ workload, resources, stacks, cloudProvider }) {
  const provider = normalizeCloudProvider(cloudProvider);
  const workloadName = safeTrim(workload?.workloadName) || safeTrim(workload?.workloadId) || "Untitled workload";
  const workloadDescription = safeTrim(workload?.description);
  const sortedResources = [...(resources || [])].sort((a, b) => {
    const typeCompare = safeTrim(a?.resourceType).localeCompare(safeTrim(b?.resourceType));
    if (typeCompare !== 0) return typeCompare;
    return safeTrim(a?.resourceId).localeCompare(safeTrim(b?.resourceId));
  });
  const sortedStacks = [...(stacks || [])].sort((a, b) =>
    safeTrim(a?.name || a?.stackName || a?.stackId).localeCompare(
      safeTrim(b?.name || b?.stackName || b?.stackId)
    )
  );
  const resourceLines = sortedResources.map((resource) => {
    const resourceType = safeTrim(resource?.resourceType) || "Unknown";
    const resourceId = safeTrim(resource?.resourceId) || safeTrim(resource?.physicalResourceId) || "(missing id)";
    const details = [
      safeTrim(resource?.provider || resource?.cloudProvider)
        ? `provider=${safeTrim(resource?.provider || resource?.cloudProvider)}`
        : null,
      safeTrim(resource?.subscriptionId) ? `subscriptionId=${safeTrim(resource?.subscriptionId)}` : null,
      safeTrim(resource?.resourceGroup) ? `resourceGroup=${safeTrim(resource?.resourceGroup)}` : null,
      safeTrim(resource?.region || resource?.location)
        ? `region=${safeTrim(resource?.region || resource?.location)}`
        : null,
      safeTrim(resource?.accountId) ? `accountId=${safeTrim(resource?.accountId)}` : null,
    ].filter(Boolean);
    return `- ${resourceType}: ${resourceId}${details.length ? ` (${details.join(", ")})` : ""}`;
  });
  const stackLines = sortedStacks.map((stack) => {
    const stackName = safeTrim(stack?.name || stack?.stackName || stack?.stackId) || "Stack";
    const details = [
      safeTrim(stack?.region) ? `region=${safeTrim(stack.region)}` : null,
      safeTrim(stack?.accountId) ? `accountId=${safeTrim(stack.accountId)}` : null,
      safeTrim(stack?.status) ? `status=${safeTrim(stack.status)}` : null,
    ].filter(Boolean);
    return `- CloudFormation stack: ${stackName}${details.length ? ` (${details.join(", ")})` : ""}`;
  });

  return [
    ...buildProviderDiagramInstructions(provider),
    `Workload title: ${workloadName}`,
    workloadDescription ? `Workload description: ${workloadDescription}` : "Workload description: (not provided)",
    "",
    "General requirements:",
    `- Target cloud provider: ${provider}.`,
    "- Use only resources and containers that fit the tracked resources provided below.",
    "- Do not invent extra application components beyond what is needed to organize the tracked resources.",
    "- Focus on a clean, readable architecture view rather than an exhaustive dependency graph.",
    "- Prefer the main resources over every sub-resource. Include supporting sub-resources only when they materially improve understanding of the workload.",
    "- Avoid crowding the diagram with low-value details such as every listener, route, attachment, or volume unless they are important to understanding the architecture.",
    "- Infer likely parent/child grouping from the tracked resource types and identifiers when exact relationships are not provided.",
    "- Minimize the number of edges. Use connections mainly to show the primary direction of traffic or control flow, not every possible relationship.",
    "",
    `Tracked resource count: ${sortedResources.length}`,
    "Tracked resources (resource type -> resource id):",
    ...(resourceLines.length > 0 ? resourceLines : ["- None"]),
    "",
    `Tracked stack count: ${sortedStacks.length}`,
    "Tracked stacks:",
    ...(stackLines.length > 0 ? stackLines : ["- None"]),
  ].join("\n");
}

function parseBody(schema, req, res) {
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Invalid request body", issues: parsed.error.issues });
    return null;
  }
  return parsed.data;
}

function diagramMetaFor({ existingDiagram = {}, key, provider, stylePreset, forceRefresh, generatedAt, updatedAt }) {
  return {
    ...existingDiagram,
    key,
    format: "diagram-spec",
    contentType: "application/json",
    provider,
    stylePreset: stylePreset || existingDiagram?.stylePreset || null,
    forceRefresh: Boolean(forceRefresh),
    generatedAt: safeTrim(existingDiagram?.generatedAt) || generatedAt || updatedAt,
    updatedAt,
    storage: "local-files",
  };
}

export function createLocalDiagramRouter({ store }) {
  if (!store) throw new Error("createLocalDiagramRouter requires a store");

  const router = Router();
  router.use(localAuth);

  router.post("/diagrams/new", async (req, res) => {
    const parsed = parseBody(DiagramRequestSchema, req, res);
    if (!parsed) return;

    const { workloadId, cloudProvider, excludeTypes, stylePreset, forceRefresh } = parsed;
    try {
      const workload = await store.getWorkload(workloadId);
      if (!workload) {
        return res.status(404).json({ ok: false, error: "Workload not found" });
      }

      const { resources, stacks } = filterTrackedResources(
        workload.trackedResources,
        excludeTypes,
        workload.deploymentPreferences
      );
      if (!resources.length && !stacks.length) {
        return res.status(400).json({
          ok: false,
          error: "Workload has no tracked resources or stacks to diagram",
        });
      }

      const provider = resolveDiagramCloudProvider({
        requestedProvider: cloudProvider,
        resources,
        stacks,
      });
      const prompt = buildWorkloadDiagramPrompt({
        workload,
        resources,
        stacks,
        cloudProvider: provider,
      });
      const specResult = await createDiagramSpec({
        provider,
        message: prompt,
        history: [],
        log: Boolean(process.env.DIAGRAMS_ICON_LOG === "1"),
      });
      const now = new Date().toISOString();
      const record = await store.saveDiagramSpec(workloadId, specResult.spec, {
        provider,
        stylePreset: stylePreset || null,
        generatedAt: now,
      });
      const diagram = diagramMetaFor({
        key: record.key,
        provider,
        stylePreset,
        forceRefresh,
        generatedAt: now,
        updatedAt: now,
      });
      await store.updateWorkload(workloadId, { diagram });

      return res.json({
        ok: true,
        workloadId,
        diagram,
        spec: specResult.spec,
        message: "Diagram spec generated",
      });
    } catch (error) {
      console.error("[local diagram] failed to generate diagram", error);
      return res.status(500).json({
        ok: false,
        error: error?.message || "Failed to generate diagram",
      });
    }
  });

  router.get("/diagrams/:workloadId/spec", async (req, res) => {
    const workloadId = req.params?.workloadId;
    if (!workloadId) {
      return res.status(400).json({ ok: false, error: "workloadId is required" });
    }

    try {
      const workload = await store.getWorkload(workloadId);
      if (!workload) {
        return res.status(404).json({ ok: false, error: "Workload not found" });
      }
      const spec = await store.getDiagramSpec(workloadId);
      if (!spec) {
        return res.status(404).json({ ok: false, error: "Diagram spec not found for workload" });
      }
      return res.json({
        ok: true,
        workloadId,
        diagram: safeParseJsonObject(workload.diagram),
        spec: validateDiagramSpec(spec),
      });
    } catch (error) {
      console.error("[local diagram] failed to load diagram spec", error);
      return res.status(500).json({
        ok: false,
        error: error?.message || "Failed to load diagram spec",
      });
    }
  });

  router.put("/diagrams/:workloadId/spec", async (req, res) => {
    const workloadId = req.params?.workloadId;
    if (!workloadId) {
      return res.status(400).json({ ok: false, error: "workloadId is required" });
    }

    const parsed = parseBody(DiagramSpecSaveSchema, req, res);
    if (!parsed) return;

    let spec;
    try {
      spec = validateDiagramSpec(parsed.spec);
    } catch (error) {
      return res.status(400).json({ ok: false, error: error?.message || "Invalid diagram spec" });
    }

    try {
      const workload = await store.getWorkload(workloadId);
      if (!workload) {
        return res.status(404).json({ ok: false, error: "Workload not found" });
      }

      const existingDiagram = safeParseJsonObject(workload.diagram);
      const { resources, stacks } = filterTrackedResources(
        workload.trackedResources,
        [],
        workload.deploymentPreferences
      );
      const provider = resolveDiagramCloudProvider({
        requestedProvider: existingDiagram?.provider,
        resources,
        stacks,
      });
      const now = new Date().toISOString();
      const record = await store.saveDiagramSpec(workloadId, spec, {
        provider,
        updatedAt: now,
      });
      const diagram = diagramMetaFor({
        existingDiagram,
        key: record.key,
        provider,
        updatedAt: now,
      });
      await store.updateWorkload(workloadId, { diagram });

      return res.json({
        ok: true,
        workloadId,
        diagram,
        spec,
      });
    } catch (error) {
      console.error("[local diagram] failed to save diagram spec", error);
      return res.status(500).json({
        ok: false,
        error: error?.message || "Failed to save diagram spec",
      });
    }
  });

  router.post("/diagrams/:workloadId/spec/update", async (req, res) => {
    const workloadId = req.params?.workloadId;
    if (!workloadId) {
      return res.status(400).json({ ok: false, error: "workloadId is required" });
    }

    const parsed = parseBody(DiagramSpecPromptUpdateSchema, req, res);
    if (!parsed) return;

    try {
      const workload = await store.getWorkload(workloadId);
      if (!workload) {
        return res.status(404).json({ ok: false, error: "Workload not found" });
      }
      const priorSpec = await store.getDiagramSpec(workloadId);
      if (!priorSpec) {
        return res.status(404).json({ ok: false, error: "Diagram spec not found for workload" });
      }

      const existingDiagram = safeParseJsonObject(workload.diagram);
      const { resources, stacks } = filterTrackedResources(
        workload.trackedResources,
        [],
        workload.deploymentPreferences
      );
      const provider = resolveDiagramCloudProvider({
        requestedProvider: existingDiagram?.provider,
        resources,
        stacks,
      });
      const result = await updateDiagramSpec({
        provider,
        instruction: safeTrim(parsed.instruction),
        priorSpec: validateDiagramSpec(priorSpec),
        history: [],
        log: Boolean(process.env.DIAGRAMS_ICON_LOG === "1"),
      });

      const now = new Date().toISOString();
      const record = await store.saveDiagramSpec(workloadId, result.spec, {
        provider,
        updatedAt: now,
      });
      const diagram = diagramMetaFor({
        existingDiagram,
        key: record.key,
        provider,
        updatedAt: now,
      });
      await store.updateWorkload(workloadId, { diagram });

      return res.json({
        ok: true,
        workloadId,
        diagram,
        spec: result.spec,
        message: "Diagram updated from instruction",
      });
    } catch (error) {
      console.error("[local diagram] failed to update diagram spec", error);
      return res.status(500).json({
        ok: false,
        error: error?.message || "Failed to update diagram spec from instruction",
      });
    }
  });

  return router;
}
