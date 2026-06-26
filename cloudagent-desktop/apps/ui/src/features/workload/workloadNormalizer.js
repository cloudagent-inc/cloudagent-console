const LOG_PREFIX = '[workload-normalizer]';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeParseJson(value) {
  if (typeof value !== 'string') return { ok: false, value };
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false, value };
  }
}

function toTrimmedString(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeStructuredObject(value, fieldName, workloadId, issues, fallback = {}) {
  if (value == null) return fallback;
  if (isPlainObject(value)) return value;

  const parsed = safeParseJson(value);
  if (parsed.ok && isPlainObject(parsed.value)) {
    return parsed.value;
  }

  issues.push({
    code: `invalid_${fieldName}`,
    workloadId,
    message: `${fieldName} was not a valid object and was reset.`,
  });
  return fallback;
}

function normalizeOptionalJson(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  const parsed = safeParseJson(value);
  return parsed.ok ? parsed.value : value;
}

function normalizeTrackedResources(value, workloadId, issues) {
  const parsed = normalizeStructuredObject(value, 'trackedResources', workloadId, issues, {});
  const resources = Array.isArray(parsed.resources)
    ? parsed.resources
        .filter(isPlainObject)
        .map((resource) => {
          const { source: _source, ...rest } = resource;
          return rest;
        })
    : [];
  const stacks = Array.isArray(parsed.stacks)
    ? parsed.stacks.filter(isPlainObject)
    : [];

  if (parsed.resources != null && !Array.isArray(parsed.resources)) {
    issues.push({
      code: 'invalid_tracked_resources_resources',
      workloadId,
      message: 'trackedResources.resources was not an array and was reset.',
    });
  }
  if (parsed.stacks != null && !Array.isArray(parsed.stacks)) {
    issues.push({
      code: 'invalid_tracked_resources_stacks',
      workloadId,
      message: 'trackedResources.stacks was not an array and was reset.',
    });
  }

  return {
    ...parsed,
    resources,
    stacks,
  };
}

function workloadScore(workload) {
  if (!workload || typeof workload !== 'object') return 0;
  let score = 0;
  if (workload.workloadId) score += 5;
  if (workload.workloadName) score += 3;
  if (workload.description) score += 1;
  if (Array.isArray(workload.environments) && workload.environments.length > 0) score += 2;
  if (Array.isArray(workload.trackedResources?.resources) && workload.trackedResources.resources.length > 0) score += 2;
  if (Array.isArray(workload.trackedResources?.stacks) && workload.trackedResources.stacks.length > 0) score += 2;
  if (isPlainObject(workload.deploymentPreferences) && Object.keys(workload.deploymentPreferences).length > 0) score += 1;
  if (isPlainObject(workload.securityRules) && Object.keys(workload.securityRules).length > 0) score += 1;
  if (workload.diagram) score += 1;
  if (workload.summary) score += 1;
  return score;
}

export function normalizeWorkloadRecord(rawWorkload, { source = 'unknown', index = -1 } = {}) {
  const issues = [];

  if (!isPlainObject(rawWorkload)) {
    return {
      workload: null,
      issues: [{
        code: 'invalid_workload_record',
        workloadId: null,
        message: `Dropped workload at index ${index} from ${source} because it was not an object.`,
      }],
    };
  }

  const workloadId = toTrimmedString(rawWorkload.workloadId || rawWorkload.id);
  if (!workloadId) {
    return {
      workload: null,
      issues: [{
        code: 'missing_workload_id',
        workloadId: null,
        message: `Dropped workload at index ${index} from ${source} because workloadId was missing.`,
      }],
    };
  }

  const workloadName = toTrimmedString(rawWorkload.workloadName || rawWorkload.name) || workloadId;
  if (!toTrimmedString(rawWorkload.workloadName || rawWorkload.name)) {
    issues.push({
      code: 'missing_workload_name',
      workloadId,
      message: 'workloadName was missing and fell back to workloadId.',
    });
  }

  let environments = [];
  if (Array.isArray(rawWorkload.environments)) {
    environments = rawWorkload.environments.filter((entry) => entry != null);
  } else if (rawWorkload.environments != null) {
    issues.push({
      code: 'invalid_environments',
      workloadId,
      message: 'environments was not an array and was reset.',
    });
  }

  const workload = {
    ...rawWorkload,
    workloadId,
    workloadName,
    description: typeof rawWorkload.description === 'string'
      ? rawWorkload.description
      : rawWorkload.description == null
        ? ''
        : String(rawWorkload.description),
    environments,
    deploymentPreferences: normalizeStructuredObject(
      rawWorkload.deploymentPreferences,
      'deploymentPreferences',
      workloadId,
      issues,
      {}
    ),
    securityRules: normalizeStructuredObject(
      rawWorkload.securityRules,
      'securityRules',
      workloadId,
      issues,
      {}
    ),
    trackedResources: normalizeTrackedResources(rawWorkload.trackedResources, workloadId, issues),
    diagram: normalizeOptionalJson(rawWorkload.diagram),
    summary: normalizeOptionalJson(rawWorkload.summary),
  };

  return { workload, issues };
}

export function normalizeWorkloadsCollection(rawWorkloads, { source = 'unknown' } = {}) {
  const workloads = Array.isArray(rawWorkloads) ? rawWorkloads : [];
  const issues = [];
  const byId = new Map();

  workloads.forEach((rawWorkload, index) => {
    const { workload, issues: recordIssues } = normalizeWorkloadRecord(rawWorkload, { source, index });
    issues.push(...recordIssues);
    if (!workload?.workloadId) return;

    const existing = byId.get(workload.workloadId);
    if (!existing || workloadScore(workload) >= workloadScore(existing)) {
      byId.set(workload.workloadId, workload);
    }
  });

  if (issues.length > 0) {
    console.warn(LOG_PREFIX, {
      source,
      inputCount: workloads.length,
      outputCount: byId.size,
      droppedCount: Math.max(0, workloads.length - byId.size),
      issues: issues.slice(0, 12),
    });
  }

  return [...byId.values()];
}
