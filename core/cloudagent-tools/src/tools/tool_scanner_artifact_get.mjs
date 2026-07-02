import { tool } from "@openai/agents";
import { z } from "zod";
import { logStart, logEnd } from "../util/logging.mjs";

const SUPPORTED_REPORT_TYPES = new Set(["health", "cost", "threat"]);

function safeTrim(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeReportType(value) {
  const normalized = safeTrim(value).toLowerCase();
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
  return (
    payload?.analysis?.[reportType]?.generatedAt ||
    payload?.generatedAt ||
    payload?.updatedAt ||
    null
  );
}

function getArtifactMetadata(reportType, payload = {}) {
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

function createArtifactTool({ store, name = "get_artifact" }) {
  if (!store?.readLatestScannerArtifact || !store?.readScannerArtifact) {
    throw new Error("createGetArtifactTool requires artifact store methods");
  }

  return tool({
    name,
    description:
      "Check for and optionally retrieve the latest local health, cost, or threat artifact. This is read-only and never launches a scan.",
    parameters: z.object({
      reportType: z.enum(["health", "cost", "threat", "healthAnalysis", "costAnalysis", "threatDetection", "threatAnalysis"]),
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
      const includePayload = args.includePayload !== false;

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

        if (targetType === "workload" && reportType !== "health") {
          const out = {
            ok: false,
            exists: false,
            error: "Only health artifacts support workload targets.",
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

        const payload = scanId
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
        const out = {
          ok: true,
          exists: true,
          reportType,
          targetType,
          targetId,
          scanId: scanId || artifact.scanId || null,
          generatedAt: artifact.generatedAt,
          artifact,
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
