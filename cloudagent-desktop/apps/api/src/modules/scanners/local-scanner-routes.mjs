import { Router } from "express";

import { launchLocalAwsScanner } from "./local-scanner-launcher.mjs";

const SUPPORTED_REPORT_TYPES = new Set(["inventory", "health", "cost", "threat"]);

function safeTrim(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeReportType(value) {
  return safeTrim(value).toLowerCase();
}

function normalizeTargetType(value, { workloadId } = {}) {
  const normalized = safeTrim(value).toLowerCase();
  if (normalized === "workload") return "workload";
  if (normalized === "permissionprofile" || normalized === "permission_profile") {
    return "permissionProfile";
  }
  return workloadId ? "workload" : "permissionProfile";
}

function normalizeTargets(targets = []) {
  return (Array.isArray(targets) ? targets : [])
    .map((target) => ({
      permissionProfileId: safeTrim(target?.permissionProfileId) || undefined,
      workloadId: safeTrim(target?.workloadId) || undefined,
    }))
    .filter((target) => target.permissionProfileId || target.workloadId);
}

function artifactResponse(payload = {}, { reportType, targetType, targetId }) {
  const analysis = payload?.analysis?.[reportType] || {};
  const output = payload?.output && typeof payload.output === "object" ? payload.output : {};
  return {
    ...payload,
    ...(targetType === "workload"
      ? { workloadId: payload.workloadId ?? targetId }
      : { permissionProfileId: payload.permissionProfileId ?? targetId }),
    output: {
      ...output,
      reportType,
      scopeType: targetType,
      scopeId: targetId,
      cache: {
        source: "stored_artifact",
        cacheHit: true,
        ...(output.cache && typeof output.cache === "object" ? output.cache : {}),
      },
      artifact: {
        bucket: analysis.bucket || output?.artifact?.bucket || "local-files",
        objectKey: analysis.objectKey || output?.artifact?.objectKey || null,
        fileName: analysis.fileName || output?.artifact?.fileName || null,
        path: analysis.path || output?.artifact?.path || null,
        scanId: analysis.scanId || output?.artifact?.scanId || null,
      },
    },
  };
}

async function readScannerResult({ store, body = {} }) {
  const reportType = normalizeReportType(body.reportType);
  if (!SUPPORTED_REPORT_TYPES.has(reportType)) {
    const error = new Error(`Unsupported local scanner report type: ${reportType || "(empty)"}`);
    error.status = 400;
    throw error;
  }
  const permissionProfileId = safeTrim(
    body.permissionProfileId || body.agentPermissionProfileId || body.agentPermissinoProfileId
  );
  const workloadId = safeTrim(body.workloadId);
  const targetType = normalizeTargetType(body.targetType, { workloadId });
  const targetId = targetType === "workload" ? workloadId : permissionProfileId;
  if (!targetId) {
    const error = new Error("permissionProfileId or workloadId is required");
    error.status = 400;
    throw error;
  }
  if (targetType === "workload" && reportType !== "health") {
    const error = new Error("Only health scanner results support workload targets");
    error.status = 400;
    throw error;
  }

  const scanId = safeTrim(body.scanId);
  const payload = scanId
    ? await store.readScannerArtifact(reportType, targetId, scanId)
    : await store.readLatestScannerArtifact(reportType, targetId);
  if (!payload) {
    const error = new Error(`No cached ${reportType} result is available yet`);
    error.status = 202;
    error.pending = true;
    throw error;
  }
  return artifactResponse(payload, { reportType, targetType, targetId });
}

export function createLocalScannerRouter({ store } = {}) {
  if (!store) throw new Error("createLocalScannerRouter requires store");
  const router = Router();

  async function handleLaunch(req, res) {
    const logger = req.app?.get?.("logger") || console;
    const reportType = normalizeReportType(req.body?.reportType);
    const cloudProvider = safeTrim(req.body?.cloudProvider).toLowerCase() || "aws";
    const targets = normalizeTargets(req.body?.targets);
    if (!SUPPORTED_REPORT_TYPES.has(reportType)) {
      return res.status(400).json({
        ok: false,
        error: `Local scanner supports ${Array.from(SUPPORTED_REPORT_TYPES).join(", ")} only`,
      });
    }
    if (!targets.length) {
      return res.status(400).json({
        ok: false,
        error: "At least one scanner target is required",
      });
    }
    if (reportType === "cost" || reportType === "inventory" || reportType === "threat") {
      const invalid = targets.find((target) => !target.permissionProfileId);
      if (invalid) {
        return res.status(400).json({
          ok: false,
          error: `${reportType} targets require permissionProfileId`,
        });
      }
    }

    try {
      const result = await launchLocalAwsScanner({
        store,
        cloudProvider,
        reportType,
        targets,
        forceRefresh: req.body?.forceRefresh !== false,
        options: {
          ...(typeof req.body?.lookbackHours === "number"
            ? { lookbackHours: req.body.lookbackHours }
            : {}),
          ...(typeof req.body?.lookbackDays === "number"
            ? { lookbackDays: req.body.lookbackDays }
            : {}),
          ...(typeof req.body?.enableCloudWatchLogChecks === "boolean"
            ? { enableCloudWatchLogChecks: req.body.enableCloudWatchLogChecks }
            : {}),
          ...(Array.isArray(req.body?.regions) ? { regions: req.body.regions } : {}),
          ...(Array.isArray(req.body?.services) ? { services: req.body.services } : {}),
        },
        logger,
      });
      return res.status(202).json(result);
    } catch (error) {
      logger?.error?.("[local-scanner-routes] launch failed", {
        reportType,
        targetCount: targets.length,
        message: error?.message || String(error),
      });
      return res.status(error?.status || 500).json({
        ok: false,
        error: error?.message || "Failed to launch local scanner",
      });
    }
  }

  router.post("/ops/scan/aws-scanners/launch", handleLaunch);
  router.post("/scanners-launch", handleLaunch);

  router.post("/ops/scan/aws-scanners/result", async (req, res) => {
    try {
      return res.json(await readScannerResult({ store, body: req.body || {} }));
    } catch (error) {
      if (error?.pending) {
        return res.status(202).json({
          ok: false,
          pending: true,
          error: error.message,
        });
      }
      return res.status(error?.status || 500).json({
        ok: false,
        error: error?.message || "Failed to fetch local scanner result",
      });
    }
  });

  router.post("/ops/scan/resource-health/evaluate", async (req, res) => {
    try {
      return res.json(
        await readScannerResult({
          store,
          body: {
            ...req.body,
            reportType: "health",
            targetType: req.body?.workloadId ? "workload" : "permissionProfile",
          },
        })
      );
    } catch (error) {
      if (error?.pending) {
        return res.status(202).json({
          ok: false,
          pending: true,
          error: "No cached resource health result is available yet",
        });
      }
      return res.status(error?.status || 500).json({
        ok: false,
        error: error?.message || "Failed to fetch cached resource health checks",
      });
    }
  });

  router.post("/ops/scan/cost-analysis/evaluate", async (req, res) => {
    try {
      return res.json(
        await readScannerResult({
          store,
          body: {
            ...req.body,
            reportType: "cost",
            targetType: "permissionProfile",
            permissionProfileId:
              req.body?.permissionProfileId ||
              req.body?.agentPermissionProfileId ||
              req.body?.agentPermissinoProfileId,
          },
        })
      );
    } catch (error) {
      if (error?.pending) {
        return res.status(202).json({
          ok: false,
          pending: true,
          error: "No cached cost analysis is available yet",
        });
      }
      return res.status(error?.status || 500).json({
        ok: false,
        error: error?.message || "Failed to fetch cached cost analysis",
      });
    }
  });

  router.post("/ops/scan/threat-detection/evaluate", async (req, res) => {
    try {
      return res.json(
        await readScannerResult({
          store,
          body: {
            ...req.body,
            reportType: "threat",
            targetType: "permissionProfile",
            permissionProfileId: req.body?.permissionProfileId,
          },
        })
      );
    } catch (error) {
      if (error?.pending) {
        return res.status(202).json({
          ok: false,
          pending: true,
          error: "No cached threat detection result is available yet",
        });
      }
      return res.status(error?.status || 500).json({
        ok: false,
        error: error?.message || "Failed to fetch cached threat detection",
      });
    }
  });

  return router;
}
