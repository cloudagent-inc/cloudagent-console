import { tool } from "@openai/agents";
import { z } from "zod";
import { logStart, logEnd } from "../util/logging.mjs";

const SUPPORTED_REPORT_TYPES = new Set(["inventory", "health", "cost", "threat", "executive_summary"]);
const ARTIFACT_STORAGE_DIR_BY_REPORT_TYPE = Object.freeze({
  inventory: "artifacts/inventory",
  health: "artifacts/healthAnalysis",
  cost: "artifacts/costAnalysis",
  threat: "artifacts/threatDetection",
  executive_summary: "summaries",
});

function safeTrim(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeReportType(value) {
  const normalized = safeTrim(value).toLowerCase();
  if (normalized === "executivesummary" || normalized === "executive-summary") return "executive_summary";
  if (normalized === "healthanalysis") return "health";
  if (normalized === "costanalysis") return "cost";
  if (normalized === "threatdetection" || normalized === "threatanalysis") return "threat";
  return normalized;
}

function normalizeTargetType(value, { workloadId } = {}) {
  const normalized = safeTrim(value).toLowerCase();
  if (normalized === "workload") return "workload";
  if (normalized === "permissionprofile" || normalized === "permission_profile" || normalized === "environment") {
    return "permissionProfile";
  }
  return workloadId ? "workload" : "permissionProfile";
}

function getGeneratedAt(reportType, payload = {}) {
  if (reportType === "executive_summary") {
    return payload?.summary?.updatedAt || payload?.updatedAt || payload?.createdAt || null;
  }
  return (
    payload?.analysis?.[reportType]?.generatedAt ||
    payload?.generatedAt ||
    payload?.updatedAt ||
    null
  );
}

function getArtifactMetadata(reportType, payload = {}) {
  if (reportType === "executive_summary") {
    const summaryType = payload?.type || (payload?.workloadId ? "workload" : "environment");
    const targetId = payload?.targetId || payload?.recordId || payload?.workloadId || null;
    const localStorePath = payload?.localStorePath || (
      summaryType === "workload" && targetId
        ? `summaries/workloads/${artifactFileNameForId(targetId)}`
        : targetId
          ? `summaries/environments/${artifactFileNameForId(targetId)}`
          : null
    );
    return {
      bucket: "local-files",
      objectKey: localStorePath,
      fileName: targetId ? artifactFileNameForId(targetId) : null,
      path: localStorePath ? `local://${localStorePath}` : null,
      localStorePath,
      scanId: payload?.summary?.updatedAt || payload?.updatedAt || null,
      generatedAt: getGeneratedAt(reportType, payload),
    };
  }
  const analysis = payload?.analysis?.[reportType] || {};
  const outputArtifact = payload?.output?.artifact || {};
  return {
    bucket: analysis.bucket || outputArtifact.bucket || "local-files",
    objectKey: analysis.objectKey || outputArtifact.objectKey || null,
    fileName: analysis.fileName || outputArtifact.fileName || null,
    path: analysis.path || outputArtifact.path || null,
    scanId: analysis.scanId || outputArtifact.scanId || null,
    generatedAt: getGeneratedAt(reportType, payload),
  };
}

function artifactPathSegment(value) {
  return safeTrim(value).replace(/[^A-Za-z0-9._@+=,-]/g, "_");
}

function artifactRefSegment(value) {
  return encodeURIComponent(safeTrim(value));
}

function artifactFileNameForId(value) {
  return `${encodeURIComponent(safeTrim(value))}.json`;
}

function buildArtifactRef({ reportType, targetType, targetId, scanId }) {
  return [
    "cloudagent-artifact:/",
    artifactRefSegment(reportType),
    artifactRefSegment(targetType),
    artifactRefSegment(targetId),
    artifactRefSegment(scanId || "latest"),
  ].join("/");
}

function buildLocalStorePath({ reportType, targetId, scanId }) {
  if (!scanId) return null;
  const dir = ARTIFACT_STORAGE_DIR_BY_REPORT_TYPE[reportType];
  if (!dir) return null;
  return `${dir}/${artifactPathSegment(targetId)}/${artifactPathSegment(scanId)}.json`;
}

function getArtifactSummary(reportType, payload = {}) {
  if (reportType === "executive_summary") {
    return payload?.summary && typeof payload.summary === "object" && !Array.isArray(payload.summary)
      ? {
          summaryText: payload.summary.summaryText || "",
          updatedAt: payload.summary.updatedAt || payload.updatedAt || null,
          sources: payload.summary.sources || null,
        }
      : null;
  }
  const directSummary = payload?.summary;
  if (directSummary && typeof directSummary === "object" && !Array.isArray(directSummary)) {
    return directSummary;
  }
  const analysisSummary = payload?.analysis?.[reportType]?.summary;
  if (analysisSummary && typeof analysisSummary === "object" && !Array.isArray(analysisSummary)) {
    return analysisSummary;
  }
  return null;
}

function buildArtifactReference({ reportType, targetType, targetId, requestedScanId, artifact, payload }) {
  const resolvedScanId = requestedScanId || artifact.scanId || payload?.scanId || payload?.id || null;
  return {
    artifactRef: buildArtifactRef({
      reportType,
      targetType,
      targetId,
      scanId: resolvedScanId,
    }),
    localReadUri: artifact.path || null,
    localStorePath: artifact.localStorePath || buildLocalStorePath({
      reportType,
      targetId,
      scanId: resolvedScanId,
    }),
    payloadAvailableInline: true,
    inlinePayloadRequest: {
      tool: "get_artifact",
      arguments: {
        reportType,
        targetType,
        ...(targetType === "workload" ? { workloadId: targetId } : { permissionProfileId: targetId }),
        ...(resolvedScanId ? { scanId: resolvedScanId } : {}),
        includePayload: true,
      },
    },
  };
}

function createArtifactTool({ store, name = "get_artifact" }) {
  if (!store?.readLatestScannerArtifact || !store?.readScannerArtifact) {
    throw new Error("createGetArtifactTool requires artifact store methods");
  }

  return tool({
    name,
    description:
      "Check for a local inventory, health, cost, threat, or executive summary artifact and return metadata plus a stable artifact reference. Set includePayload=true only when the full JSON payload is required.",
    parameters: z.object({
      reportType: z.enum(["inventory", "health", "cost", "threat", "healthAnalysis", "costAnalysis", "threatDetection", "threatAnalysis", "executive_summary", "executiveSummary"]),
      targetType: z.enum(["permissionProfile", "permission_profile", "environment", "workload"]).nullable().optional(),
      permissionProfileId: z.string().nullable().optional(),
      workloadId: z.string().nullable().optional(),
      scanId: z.string().nullable().optional(),
      includePayload: z.boolean().nullable().optional(),
    }).strict(),

    async execute(args = {}) {
      const reportType = normalizeReportType(args.reportType);
      const workloadId = safeTrim(args.workloadId);
      const permissionProfileId = safeTrim(args.permissionProfileId);
      const targetType = normalizeTargetType(args.targetType, { workloadId });
      const targetId = targetType === "workload" ? workloadId : permissionProfileId;
      const scanId = safeTrim(args.scanId);
      const includePayload = args.includePayload === true;

      logStart(name, {
        reportType,
        targetType,
        targetId,
        scanId: scanId || null,
        includePayload,
      });

      try {
        if (!SUPPORTED_REPORT_TYPES.has(reportType)) {
          const out = {
            ok: false,
            exists: false,
            error: `Unsupported artifact reportType: ${args.reportType || "(empty)"}`,
          };
          logEnd(name, out);
          return out;
        }

        if (targetType === "workload" && !["health", "executive_summary"].includes(reportType)) {
          const out = {
            ok: false,
            exists: false,
            error: "Only health and executive_summary artifacts support workload targets.",
            reportType,
            targetType,
          };
          logEnd(name, out);
          return out;
        }

        if (!targetId) {
          const out = {
            ok: false,
            exists: false,
            error: targetType === "workload" ? "workloadId is required" : "permissionProfileId is required",
            reportType,
            targetType,
          };
          logEnd(name, out);
          return out;
        }

        const payload = reportType === "executive_summary"
          ? targetType === "workload"
            ? await store.getWorkloadSummary?.(targetId)
            : await store.getEnvironmentSummary?.(targetId)
          : scanId
            ? await store.readScannerArtifact(reportType, targetId, scanId)
            : await store.readLatestScannerArtifact(reportType, targetId);

        if (!payload) {
          const out = {
            ok: true,
            exists: false,
            reportType,
            targetType,
            targetId,
            scanId: scanId || null,
          };
          logEnd(name, out);
          return out;
        }

        const artifact = getArtifactMetadata(reportType, payload);
        const artifactReference = buildArtifactReference({
          reportType,
          targetType,
          targetId,
          requestedScanId: scanId,
          artifact,
          payload,
        });
        const resolvedScanId = scanId || artifact.scanId || payload?.scanId || payload?.id || null;
        const out = {
          ok: true,
          exists: true,
          reportType,
          targetType,
          targetId,
          scanId: resolvedScanId,
          generatedAt: artifact.generatedAt,
          summary: getArtifactSummary(reportType, payload),
          artifact: {
            ...artifact,
            ...artifactReference,
            localReadPath: artifactReference.localStorePath,
          },
          artifactRef: artifactReference.artifactRef,
          localReadUri: artifactReference.localReadUri,
          localStorePath: artifactReference.localStorePath,
          localReadPath: artifactReference.localStorePath,
          payloadIncluded: includePayload,
          payloadAvailableInline: artifactReference.payloadAvailableInline,
          inlinePayloadRequest: artifactReference.inlinePayloadRequest,
          ...(includePayload ? { payload } : {}),
        };
        logEnd(name, {
          ...out,
          payload: includePayload ? "[omitted from logs]" : undefined,
        });
        return out;
      } catch (error) {
        const out = { ok: false, exists: false, error: error?.message || String(error) };
        logEnd(name, out);
        throw error;
      }
    },
  });
}

export function createGetArtifactTool({ store }) {
  return createArtifactTool({ store, name: "get_artifact" });
}

function normalizeArtifactTypes(values = []) {
  const source = Array.isArray(values) && values.length > 0 ? values : Array.from(SUPPORTED_REPORT_TYPES);
  return [...new Set(source.map(normalizeReportType).filter((type) => SUPPORTED_REPORT_TYPES.has(type)))];
}

function artifactTargetMatches(item = {}, { targetType = null, permissionProfileId = null, workloadId = null } = {}) {
  if (!permissionProfileId && !workloadId && !targetType) return true;
  const itemTargetType = normalizeTargetType(item.targetType || (item.workloadId ? "workload" : "permissionProfile"), {
    workloadId: item.workloadId,
  });
  if (targetType && normalizeTargetType(targetType, { workloadId }) !== itemTargetType) return false;
  const itemTargetId = item.targetId || item.scopeId || item.permissionProfileId || item.recordId || item.workloadId || item.id;
  if (workloadId) return itemTargetType === "workload" && itemTargetId === workloadId;
  if (permissionProfileId) return itemTargetType === "permissionProfile" && itemTargetId === permissionProfileId;
  return true;
}

function buildArtifactListItem(item = {}) {
  const reportType = normalizeReportType(item.kind || item.reportType || item.artifactType || "executive_summary");
  const targetType = normalizeTargetType(item.targetType, { workloadId: item.workloadId });
  const targetId = item.targetId || item.scopeId || item.permissionProfileId || item.recordId || item.workloadId || item.id || null;
  const scanId = item.scanId || item.updatedAt || item.generatedAt || null;
  const artifactRef = buildArtifactRef({ reportType, targetType, targetId, scanId });
  return {
    reportType,
    targetType,
    targetId,
    scanId,
    generatedAt: item.generatedAt || item.updatedAt || item.createdAt || null,
    artifactRef,
    localReadUri: item.path || (item.localStorePath ? `local://${item.localStorePath}` : null),
    localStorePath: item.localStorePath || null,
    localReadPath: item.localStorePath || null,
    fileName: item.fileName || null,
    objectKey: item.objectKey || item.localStorePath || null,
    summary: item.summary && typeof item.summary === "object" && !Array.isArray(item.summary)
      ? item.summary
      : null,
  };
}

export function createListArtifactsTool({ store }) {
  if (!store) throw new Error("createListArtifactsTool requires store");

  return tool({
    name: "list_artifacts",
    description:
      "List local inventory, health, cost, threat, and executive summary artifacts available to CloudAgent. Returns metadata and artifact references only.",
    parameters: z.object({
      artifactTypes: z.array(z.enum(["inventory", "health", "cost", "threat", "executive_summary", "executiveSummary", "healthAnalysis", "costAnalysis", "threatDetection", "threatAnalysis"])).nullable().optional(),
      targetType: z.enum(["permissionProfile", "permission_profile", "environment", "workload"]).nullable().optional(),
      permissionProfileId: z.string().nullable().optional(),
      workloadId: z.string().nullable().optional(),
      limit: z.number().int().min(1).max(500).nullable().optional(),
    }).strict(),
    async execute(args = {}) {
      const artifactTypes = normalizeArtifactTypes(args.artifactTypes);
      const targetType = args.targetType || null;
      const permissionProfileId = safeTrim(args.permissionProfileId);
      const workloadId = safeTrim(args.workloadId);
      const limit = Math.max(1, Math.min(500, Number(args.limit) || 100));
      const items = [];

      for (const artifactType of artifactTypes) {
        if (artifactType === "executive_summary") {
          const summaries = typeof store.listExecutiveSummaries === "function"
            ? await store.listExecutiveSummaries()
            : [];
          items.push(...summaries.map((summary) => buildArtifactListItem({
            ...summary,
            kind: "executive_summary",
            targetType: summary.targetType || (summary.type === "workload" ? "workload" : "permissionProfile"),
            targetId: summary.targetId || summary.id,
            generatedAt: summary.updatedAt || summary.summary?.updatedAt || null,
          })));
          continue;
        }
        if (typeof store.listScannerArtifacts === "function") {
          const scannerArtifacts = await store.listScannerArtifacts(artifactType, workloadId || permissionProfileId || null);
          items.push(...scannerArtifacts.map((artifact) => buildArtifactListItem({
            ...artifact,
            targetType: workloadId ? "workload" : "permissionProfile",
          })));
        }
      }

      const filtered = items
        .filter((item) => artifactTargetMatches(item, { targetType, permissionProfileId, workloadId }))
        .sort((a, b) => String(b.generatedAt || "").localeCompare(String(a.generatedAt || "")))
        .slice(0, limit);
      return {
        ok: true,
        count: filtered.length,
        artifactTypes,
        items: filtered,
      };
    },
  });
}

function normalizeTargets(args = {}) {
  if (Array.isArray(args.targets)) {
    return args.targets
      .map((target) => ({
        permissionProfileId: safeTrim(target?.permissionProfileId) || undefined,
        workloadId: safeTrim(target?.workloadId) || undefined,
      }))
      .filter((target) => target.permissionProfileId || target.workloadId);
  }

  const workloadId = safeTrim(args.workloadId);
  const permissionProfileId = safeTrim(args.permissionProfileId);
  return workloadId
    ? [{ workloadId }]
    : permissionProfileId
      ? [{ permissionProfileId }]
      : [];
}

function normalizeLaunchOptions(args = {}) {
  return {
    ...(typeof args.lookbackHours === "number" ? { lookbackHours: args.lookbackHours } : {}),
    ...(typeof args.lookbackDays === "number" ? { lookbackDays: args.lookbackDays } : {}),
    ...(typeof args.enableCloudWatchLogChecks === "boolean"
      ? { enableCloudWatchLogChecks: args.enableCloudWatchLogChecks }
      : {}),
    ...(Array.isArray(args.regions) ? { regions: args.regions } : {}),
    ...(Array.isArray(args.services) ? { services: args.services } : {}),
  };
}

export function createLaunchArtifactTool({ launchArtifact }) {
  if (typeof launchArtifact !== "function") {
    throw new Error("createLaunchArtifactTool requires launchArtifact");
  }

  return tool({
    name: "launch_artifact",
    description:
      "Launch local generation for a health, cost, or threat artifact. Use get_artifact afterward to retrieve the generated artifact.",
    parameters: z.object({
      reportType: z.enum(["health", "cost", "threat", "healthAnalysis", "costAnalysis", "threatDetection", "threatAnalysis"]),
      targetType: z.enum(["permissionProfile", "permission_profile", "environment", "workload"]).nullable().optional(),
      permissionProfileId: z.string().nullable().optional(),
      workloadId: z.string().nullable().optional(),
      targets: z.array(z.object({
        permissionProfileId: z.string().nullable().optional(),
        workloadId: z.string().nullable().optional(),
      }).strict()).nullable().optional(),
      cloudProvider: z.enum(["aws"]).nullable().optional(),
      forceRefresh: z.boolean().nullable().optional(),
      lookbackHours: z.number().int().positive().nullable().optional(),
      lookbackDays: z.number().int().positive().nullable().optional(),
      enableCloudWatchLogChecks: z.boolean().nullable().optional(),
      regions: z.array(z.string()).nullable().optional(),
      services: z.array(z.string()).nullable().optional(),
    }).strict(),

    async execute(args = {}) {
      const reportType = normalizeReportType(args.reportType);
      const targetType = normalizeTargetType(args.targetType, { workloadId: args.workloadId });
      const targets = normalizeTargets(args);
      const forceRefresh = args.forceRefresh !== false;
      const cloudProvider = safeTrim(args.cloudProvider).toLowerCase() || "aws";

      logStart("launch_artifact", {
        reportType,
        targetType,
        targetCount: targets.length,
        forceRefresh,
        cloudProvider,
      });

      try {
        if (!SUPPORTED_REPORT_TYPES.has(reportType)) {
          const out = {
            ok: false,
            error: `Unsupported artifact reportType: ${args.reportType || "(empty)"}`,
          };
          logEnd("launch_artifact", out);
          return out;
        }

        if (cloudProvider !== "aws") {
          const out = {
            ok: false,
            error: "Only AWS artifact generation is supported locally.",
            cloudProvider,
          };
          logEnd("launch_artifact", out);
          return out;
        }

        if (!targets.length) {
          const out = {
            ok: false,
            error: "At least one permissionProfileId or workloadId target is required.",
          };
          logEnd("launch_artifact", out);
          return out;
        }

        if (targets.some((target) => target.workloadId) && reportType !== "health") {
          const out = {
            ok: false,
            error: "Only health artifacts support workload targets.",
            reportType,
          };
          logEnd("launch_artifact", out);
          return out;
        }

        if ((reportType === "cost" || reportType === "threat") && targets.some((target) => !target.permissionProfileId)) {
          const out = {
            ok: false,
            error: `${reportType} artifacts require permissionProfileId targets.`,
            reportType,
          };
          logEnd("launch_artifact", out);
          return out;
        }

        const result = await launchArtifact({
          cloudProvider,
          reportType,
          targets,
          forceRefresh,
          options: normalizeLaunchOptions(args),
        });
        const out = {
          ok: true,
          reportType,
          cloudProvider,
          targetType,
          targets,
          forceRefresh,
          result,
        };
        logEnd("launch_artifact", out);
        return out;
      } catch (error) {
        const out = { ok: false, error: error?.message || String(error) };
        logEnd("launch_artifact", out);
        throw error;
      }
    },
  });
}
