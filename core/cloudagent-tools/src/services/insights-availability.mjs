export const ANALYSIS_CODE_INTERPRETER_MESSAGE =
  "Use code_interpreter to analyze this data artifact in detail.";

function safeTrim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toIsoTimestamp(value) {
  if (value == null) return null;
  const parsed = Date.parse(String(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return new Date(parsed).toISOString();
}

function extractS3KeyFromPath(value) {
  const path = safeTrim(value);
  if (!path) return null;
  if (!path.startsWith("s3://")) return path;
  const slashIndex = path.indexOf("/", "s3://".length);
  if (slashIndex < 0) return null;
  return path.slice(slashIndex + 1) || null;
}

function extractFileName(value) {
  const raw = safeTrim(value);
  if (!raw) return null;
  const normalized = raw.split("/").filter(Boolean).pop() || "";
  return normalized || null;
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
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

function sanitizeTrackedResources(value) {
  if (!isPlainObject(value)) return {};
  return {
    ...value,
    resources: sanitizeTrackedResourceEntries(value.resources),
    stacks: Array.isArray(value.stacks) ? value.stacks : [],
  };
}

function extractArtifactFileName(value) {
  if (!isPlainObject(value)) return null;
  const direct = extractFileName(value.fileName);
  if (direct) return direct;
  const derivedKey =
    extractS3KeyFromPath(value.objectKey) ||
    extractS3KeyFromPath(value.fileKey) ||
    extractS3KeyFromPath(value.key) ||
    extractS3KeyFromPath(value.path) ||
    null;
  return extractFileName(derivedKey);
}

function sanitizeAnalysisArtifactMetadata(value, { preserveOptions = false } = {}) {
  if (!isPlainObject(value)) return null;
  const fileName = extractArtifactFileName(value);
  const generatedAt =
    toIsoTimestamp(value.generatedAt) ||
    toIsoTimestamp(value.createdAt) ||
    toIsoTimestamp(value.timestamp) ||
    null;
  const out = {};
  if (fileName) out.fileName = fileName;
  if (generatedAt) out.generatedAt = generatedAt;
  if (preserveOptions && isPlainObject(value.options)) {
    out.options = { ...value.options };
  }
  if (isPlainObject(value.summary)) {
    out.summary = { ...value.summary };
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function parseSummaryObject(summary) {
  if (isPlainObject(summary)) return { ...summary };
  if (typeof summary !== "string") return {};
  try {
    const parsed = JSON.parse(summary);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return summary.trim() ? { summaryText: summary } : {};
  }
}

export function sanitizeSummaryForAgent(summaryValue) {
  const summary = parseSummaryObject(summaryValue);
  const analysis = isPlainObject(summary.analysis) ? summary.analysis : null;
  if (!analysis) return summary;

  const sanitizedAnalysis = {};
  for (const [analysisKey, analysisValue] of Object.entries(analysis)) {
    const sanitized = sanitizeAnalysisArtifactMetadata(analysisValue, {
      preserveOptions: analysisKey === "health",
    });
    if (sanitized) {
      sanitizedAnalysis[analysisKey] = sanitized;
    } else if (isPlainObject(analysisValue)) {
      sanitizedAnalysis[analysisKey] = {};
    }
  }

  return {
    ...summary,
    analysis: sanitizedAnalysis,
  };
}

function buildAnalysisArtifactInsight(analysisValue) {
  const value = isPlainObject(analysisValue) ? analysisValue : null;
  const hasFields = value && Object.keys(value).length > 0;
  if (!value || !hasFields) {
    return {
      available: false,
      generatedAt: null,
      fileName: null,
      objectKey: null,
      path: null,
      message: null,
      recommendedTool: null
    };
  }

  const fileName = extractArtifactFileName(value);
  const generatedAt =
    toIsoTimestamp(value.generatedAt) ||
    toIsoTimestamp(value.createdAt) ||
    toIsoTimestamp(value.timestamp) ||
    null;

  return {
    available: Boolean(fileName || generatedAt),
    generatedAt,
    fileName,
    objectKey: null,
    path: null,
    summary: isPlainObject(value.summary) ? { ...value.summary } : null,
    message: ANALYSIS_CODE_INTERPRETER_MESSAGE,
    recommendedTool: "code_interpreter"
  };
}

function summarizeReportSummaries(reportSummariesValue) {
  const reportSummaries = isPlainObject(reportSummariesValue) ? reportSummariesValue : {};
  const scanIds = Object.keys(reportSummaries).filter(Boolean);
  return {
    available: scanIds.length > 0,
    count: scanIds.length,
    scanIds
  };
}

export function buildSummaryInsights(summaryValue) {
  const summary = parseSummaryObject(summaryValue);
  const summaryText = safeTrim(summary.summaryText);
  const updatedAt = toIsoTimestamp(summary.updatedAt);
  const analysis = isPlainObject(summary.analysis) ? summary.analysis : {};

  return {
    executiveSummary: {
      available: !!summaryText,
      updatedAt,
      message: summaryText
        ? "Executive summary is available. Fetch full summary details when needed."
        : null
    },
    reportSummaries: summarizeReportSummaries(summary.reportSummaries),
    analysisGuidance: ANALYSIS_CODE_INTERPRETER_MESSAGE,
    analysis: {
      health: buildAnalysisArtifactInsight(analysis.health),
      cost: buildAnalysisArtifactInsight(analysis.cost),
      inventory: buildAnalysisArtifactInsight(analysis.inventory),
      threat: buildAnalysisArtifactInsight(analysis.threat)
    }
  };
}

function parseTrackedResources(value) {
  if (isPlainObject(value)) return sanitizeTrackedResources(value);
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return isPlainObject(parsed) ? sanitizeTrackedResources(parsed) : {};
  } catch {
    return {};
  }
}

export function buildTrackedResourcesInsight(trackedResourcesValue) {
  const trackedResources = parseTrackedResources(trackedResourcesValue);
  const resourcesCount = Array.isArray(trackedResources.resources)
    ? trackedResources.resources.length
    : 0;
  const stacksCount = Array.isArray(trackedResources.stacks)
    ? trackedResources.stacks.length
    : 0;
  const total = resourcesCount + stacksCount;

  return {
    available: total > 0,
    counts: {
      resources: resourcesCount,
      stacks: stacksCount,
      total
    },
    message: total > 0
      ? "Use get_workload to fetch trackedResources details."
      : "No tracked resources are currently linked."
  };
}
