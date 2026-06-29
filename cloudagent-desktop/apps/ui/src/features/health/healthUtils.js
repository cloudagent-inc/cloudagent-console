export const DEFAULT_HEALTH_LOOKBACK_HOURS = 120;
export const DEFAULT_HEALTH_MAX_AGE_HOURS = 72;

export const safeParseJson = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const parseSummaryObject = (summary) => {
  if (!summary) return {};
  if (typeof summary === 'object') return summary;
  if (typeof summary !== 'string') return {};
  try {
    const parsed = JSON.parse(summary);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const toTimestampMs = (value) => {
  if (!value) return null;
  const ts = Date.parse(String(value));
  return Number.isFinite(ts) && ts > 0 ? ts : null;
};

export const isFreshTimestamp = (value, maxAgeHours = DEFAULT_HEALTH_MAX_AGE_HOURS) => {
  const ts = toTimestampMs(value);
  if (!ts) return false;
  return Date.now() - ts < maxAgeHours * 60 * 60 * 1000;
};

export const getHealthGeneratedAt = (healthMeta = {}) =>
  healthMeta?.generatedAt || healthMeta?.createdAt || healthMeta?.timestamp || '';

export const resolveTrackedResourcePermissionProfileId = (resource) =>
  String(resource?.permissionProfileId || resource?.environmentProfileId || '').trim();

export const extractAccountIdFromArn = (value) => {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed.startsWith('arn:')) return '';
  const parts = trimmed.split(':');
  return parts.length >= 5 ? parts[4] : '';
};

export const resolveResourceAccountId = (resource) =>
  String(
    resource?.accountId ||
      extractAccountIdFromArn(resource?.resourceArn) ||
      extractAccountIdFromArn(resource?.identifier) ||
      ''
  ).trim();

export const getWorkloadEnvironmentProfileId = (workload) =>
  String(safeParseJson(workload?.metadata, {})?.environmentProfileId || '').trim();

export const getWorkloadEnvironmentProfileIds = (workload) => {
  const values = Array.isArray(workload?.environments) ? workload.environments : [];
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean);
};

export const buildTrackedResourceLookupKey = (resource, permissionProfileId = '') => {
  const canonicalType =
    resource?.canonicalResourceType || resource?.resourceType || resource?.type || '';
  const identifier =
    resource?.identifier ||
    resource?.resourceArn ||
    resource?.resourceId ||
    resource?.displayName ||
    '';
  const region = resource?.region || '';
  const scopeKey =
    permissionProfileId ||
    resolveTrackedResourcePermissionProfileId(resource) ||
    resolveResourceAccountId(resource) ||
    '';
  return [canonicalType, identifier, region, scopeKey].join('|');
};

const normalizeLookupPart = (value) => String(value || '').trim().toLowerCase();

const collectResourceIdentifiers = (resource) =>
  Array.from(
    new Set(
      [
        resource?.identifier,
        resource?.resourceArn,
        resource?.resourceId,
        resource?.physicalResourceId,
        resource?.displayName,
        resource?.id,
      ]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );

const buildTrackedResourceLookupKeys = (resource, permissionProfileId = '') => {
  const canonicalType =
    resource?.canonicalResourceType || resource?.resourceType || resource?.type || '';
  const region = resource?.region || '';
  const scopeKey =
    permissionProfileId ||
    resolveTrackedResourcePermissionProfileId(resource) ||
    resolveResourceAccountId(resource) ||
    '';

  const keys = [];
  collectResourceIdentifiers(resource).forEach((identifier) => {
    const normalizedIdentifier = normalizeLookupPart(identifier);
    const normalizedRegion = normalizeLookupPart(region);
    const normalizedScopeKey = normalizeLookupPart(scopeKey);
    const normalizedType = normalizeLookupPart(canonicalType);
    if (!normalizedIdentifier) return;

    const pushKey = (parts) => {
      const key = parts.join('|');
      if (!keys.includes(key)) keys.push(key);
    };

    if (normalizedType) {
      if (normalizedScopeKey) {
        pushKey(['typed', normalizedType, normalizedIdentifier, normalizedRegion, normalizedScopeKey]);
        pushKey(['typed', normalizedType, normalizedIdentifier, '', normalizedScopeKey]);
      }
      pushKey(['typed', normalizedType, normalizedIdentifier, normalizedRegion, '']);
      pushKey(['typed', normalizedType, normalizedIdentifier, '', '']);
    }

    if (normalizedScopeKey) {
      pushKey(['identity', normalizedIdentifier, normalizedRegion, normalizedScopeKey]);
      pushKey(['identity', normalizedIdentifier, '', normalizedScopeKey]);
    }
    pushKey(['identity', normalizedIdentifier, normalizedRegion, '']);
    pushKey(['identity', normalizedIdentifier, '', '']);
  });
  return keys;
};

export const getWorkloadPermissionProfileIds = (workload, permissionProfilesByAccount) => {
  const trackedResources = safeParseJson(workload?.trackedResources, { resources: [] });
  const resources = Array.isArray(trackedResources?.resources) ? trackedResources.resources : [];
  const profileIds = new Set();

  const workloadEnvironmentProfileId = getWorkloadEnvironmentProfileId(workload);
  if (workloadEnvironmentProfileId) {
    profileIds.add(workloadEnvironmentProfileId);
  }
  getWorkloadEnvironmentProfileIds(workload).forEach((profileId) => {
    profileIds.add(profileId);
  });

  resources.forEach((resource) => {
    const directProfileId = resolveTrackedResourcePermissionProfileId(resource);
    if (directProfileId) {
      profileIds.add(directProfileId);
      return;
    }
    const accountId = resolveResourceAccountId(resource);
    if (!accountId) return;
    const permissionProfileId = permissionProfilesByAccount.get(accountId);
    if (permissionProfileId) {
      profileIds.add(permissionProfileId);
    }
  });

  return Array.from(profileIds);
};

export const mergeWorkloadHealthResponse = (
  workload,
  responses,
  permissionProfilesByAccount
) => {
  const trackedResources = safeParseJson(workload?.trackedResources, { resources: [] });
  const resources = Array.isArray(trackedResources?.resources) ? trackedResources.resources : [];
  const nextResources = resources.map((resource) => ({ ...resource }));

  const resourceIndexByKey = new Map();
  nextResources.forEach((resource, index) => {
    const directProfileId = resolveTrackedResourcePermissionProfileId(resource);
    const accountId = resolveResourceAccountId(resource);
    const inferredProfileId =
      directProfileId || (accountId ? permissionProfilesByAccount.get(accountId) || '' : '');
    buildTrackedResourceLookupKeys(resource, inferredProfileId).forEach((lookupKey) => {
      if (!resourceIndexByKey.has(lookupKey)) {
        resourceIndexByKey.set(lookupKey, index);
      }
    });
  });

  let latestHealthAnalysis = null;

  responses.forEach(({ permissionProfileId, body }) => {
    const responseResources = Array.isArray(body?.resources) ? body.resources : [];

    responseResources.forEach((resourceResult) => {
      const lookupKeys = buildTrackedResourceLookupKeys(
        {
          resourceType: resourceResult?.resourceType || '',
          identifier: resourceResult?.identifier || '',
          resourceArn: resourceResult?.resourceArn || '',
          resourceId: resourceResult?.resourceId || '',
          physicalResourceId: resourceResult?.physicalResourceId || '',
          displayName: resourceResult?.displayName || '',
          region: resourceResult?.region || '',
          accountId: resourceResult?.accountId || '',
        },
        permissionProfileId
      );
      const resourceIndex = lookupKeys
        .map((lookupKey) => resourceIndexByKey.get(lookupKey))
        .find((index) => index !== undefined);
      if (resourceIndex === undefined) return;

      nextResources[resourceIndex] = {
        ...nextResources[resourceIndex],
        health: {
          targetKey: resourceResult?.targetKey || '',
          checks: Array.isArray(resourceResult?.checks) ? resourceResult.checks : [],
          errors: Array.isArray(resourceResult?.errors) ? resourceResult.errors : [],
          generatedAt: body?.generatedAt || '',
          permissionProfileId,
          cache: body?.output?.cache || null,
          result: {
            resourceType: resourceResult?.resourceType || '',
            identifier: resourceResult?.identifier || '',
            resourceArn: resourceResult?.resourceArn || '',
            resourceId: resourceResult?.resourceId || '',
            physicalResourceId: resourceResult?.physicalResourceId || '',
            region: resourceResult?.region || '',
            accountId: resourceResult?.accountId || '',
            displayName: resourceResult?.displayName || '',
          },
        },
      };
    });

    const incomingHealthAnalysis =
      body?.analysis?.health && typeof body.analysis.health === 'object'
        ? body.analysis.health
        : null;
    if (!incomingHealthAnalysis) return;

    if (!latestHealthAnalysis) {
      latestHealthAnalysis = incomingHealthAnalysis;
      return;
    }

    const latestTs = Date.parse(latestHealthAnalysis.generatedAt || 0);
    const incomingTs = Date.parse(incomingHealthAnalysis.generatedAt || 0);
    const latestSafeTs = Number.isFinite(latestTs) ? latestTs : 0;
    if (Number.isFinite(incomingTs) && incomingTs > latestSafeTs) {
      latestHealthAnalysis = incomingHealthAnalysis;
    }
  });

  const existingSummary = parseSummaryObject(workload?.summary);
  const workloadHealthSummary =
    nextResources.length > 0 ? buildTrackedResourceHealthSummary(nextResources) : null;
  const nextHealthAnalysis = latestHealthAnalysis || workloadHealthSummary
    ? {
        ...(latestHealthAnalysis || {}),
        generatedAt:
          latestHealthAnalysis?.generatedAt ||
          nextResources.find((resource) => resource?.health?.generatedAt)?.health?.generatedAt ||
          '',
        ...(workloadHealthSummary ? { summary: workloadHealthSummary } : {}),
      }
    : null;
  const nextSummary = nextHealthAnalysis
    ? {
        ...existingSummary,
        analysis: {
          ...(existingSummary?.analysis && typeof existingSummary.analysis === 'object'
            ? existingSummary.analysis
            : {}),
          health: nextHealthAnalysis,
        },
      }
    : existingSummary;

  return {
    ...workload,
    trackedResources: {
      ...trackedResources,
      resources: nextResources,
    },
    summary: JSON.stringify(nextSummary),
  };
};

export const extractHealthResources = (payload) => {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload?.resources)) return payload.resources;
  if (Array.isArray(payload?.result?.resources)) return payload.result.resources;
  if (Array.isArray(payload?.output?.resources)) return payload.output.resources;
  if (Array.isArray(payload?.data?.resources)) return payload.data.resources;
  if (Array.isArray(payload?.health?.resources)) return payload.health.resources;
  if (Array.isArray(payload?.analysis?.resources)) return payload.analysis.resources;
  if (Array.isArray(payload?.input?.resources)) return payload.input.resources;

  if (payload?.resources && typeof payload.resources === 'object') {
    return Object.values(payload.resources).filter(Boolean);
  }

  return [];
};

export const normalizeHealthResponseShape = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  const resources = extractHealthResources(payload);
  if (Array.isArray(payload.resources)) return payload;
  return {
    ...payload,
    resources,
  };
};

const normalizeSummaryStatus = (status) => {
  const normalized = typeof status === 'string' ? status.toLowerCase().trim() : '';
  if (normalized === 'healthy') return 'healthy';
  if (normalized === 'unhealthy' || normalized === 'problem' || normalized === 'error') {
    return 'unhealthy';
  }
  if (normalized === 'not_applicable') return 'not_applicable';
  return 'unknown';
};

const isSkippedError = (errorText) => {
  if (typeof errorText !== 'string') return false;
  const lower = errorText.toLowerCase();
  return lower.includes('not implemented') || lower.includes('not supported');
};

const isNotApplicableHealthMessage = (errorText) =>
  typeof errorText === 'string' &&
  errorText.trim().toLowerCase() === 'no health checks were returned for this resource.';

const getResourceSummaryStatus = (resource) => {
  const checks = Array.isArray(resource?.checks) ? resource.checks : [];
  const allErrors = Array.isArray(resource?.errors) ? resource.errors : [];
  const notApplicable = resource?.notApplicable === true;
  const notApplicableErrors = allErrors.filter(isNotApplicableHealthMessage);
  const realErrors = allErrors.filter((errorText) => !isSkippedError(errorText));
  const skippedErrors = allErrors.filter(isSkippedError);

  if (notApplicable || (checks.length === 0 && notApplicableErrors.length > 0)) {
    return 'not_checked';
  }
  if (checks.length === 0 && skippedErrors.length > 0 && realErrors.length === 0) {
    return 'skipped';
  }
  if (checks.length === 0 && allErrors.length === 0) {
    return 'not_checked';
  }

  if (realErrors.length > 0) {
    return 'unhealthy';
  }

  const checkStatuses = checks.map((check) => normalizeSummaryStatus(check?.status));
  if (checkStatuses.includes('unhealthy')) {
    return 'unhealthy';
  }
  if (checkStatuses.includes('healthy')) {
    return 'healthy';
  }
  if (checkStatuses.includes('unknown')) {
    return 'unknown';
  }
  if (checkStatuses.includes('not_applicable')) {
    return 'not_checked';
  }

  return 'healthy';
};

const getResourceIssueLabels = (resource) => {
  const issueLabels = new Set();
  const checks = Array.isArray(resource?.checks) ? resource.checks : [];

  checks.forEach((check) => {
    if (normalizeSummaryStatus(check?.status) !== 'unhealthy') return;
    const label = String(
      check?.checkName || check?.checkId || check?.summary || 'Unknown issue'
    ).trim();
    if (label) issueLabels.add(label);
  });

  (Array.isArray(resource?.errors) ? resource.errors : [])
    .filter(
      (errorText) => !isSkippedError(errorText) && !isNotApplicableHealthMessage(errorText)
    )
    .forEach((errorText) => {
      const label = String(errorText || '').trim();
      if (label) issueLabels.add(label);
    });

  return Array.from(issueLabels);
};

const buildSummaryResourceKey = (resource) =>
  [
    resource?.targetKey ||
      resource?.resourceArn ||
      resource?.identifier ||
      resource?.resourceId ||
      resource?.displayName ||
      '',
    resource?.resourceType || '',
    resource?.region || '',
    resource?.accountId || '',
  ].join('|');

const sortCountEntries = (a, b) => {
  if (b.count !== a.count) return b.count - a.count;
  return a.key.localeCompare(b.key);
};

const toCountMap = (map) =>
  Object.fromEntries(
    Array.from(map.entries())
      .filter(([, count]) => Number.isFinite(count) && count > 0)
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      })
  );

export const buildAwsResourceHealthSummary = ({ resources = [] } = {}) => {
  const resourceCounts = {
    total: 0,
    evaluated: 0,
    healthy: 0,
    issues: 0,
    notChecked: 0,
    skipped: 0,
  };
  const issueCounts = new Map();
  const resourceTypeCounts = new Map();

  for (const resource of Array.isArray(resources) ? resources : []) {
    resourceCounts.total += 1;

    const resourceStatus = getResourceSummaryStatus(resource);
    if (resourceStatus === 'healthy') {
      resourceCounts.evaluated += 1;
      resourceCounts.healthy += 1;
      continue;
    }
    if (resourceStatus === 'unhealthy') {
      resourceCounts.evaluated += 1;
      resourceCounts.issues += 1;

      const resourceKey = buildSummaryResourceKey(resource);
      for (const label of getResourceIssueLabels(resource)) {
        const issueKey = `${label}|${resourceKey}`;
        if (!issueCounts.has(issueKey)) {
          issueCounts.set(issueKey, label);
        }
      }

      const resourceType = String(resource?.resourceType || '').trim();
      if (resourceType) {
        resourceTypeCounts.set(resourceType, (resourceTypeCounts.get(resourceType) || 0) + 1);
      }
      continue;
    }
    if (resourceStatus === 'skipped') {
      resourceCounts.skipped += 1;
      continue;
    }
    resourceCounts.notChecked += 1;
  }

  const issueAggregate = new Map();
  issueCounts.forEach((label) => {
    issueAggregate.set(label, (issueAggregate.get(label) || 0) + 1);
  });

  const evaluated = resourceCounts.evaluated;
  const healthScore = evaluated > 0
    ? Math.round((resourceCounts.healthy / evaluated) * 100)
    : 0;

  const topIssues = Array.from(issueAggregate.entries())
    .map(([key, count]) => ({ key, label: key, count }))
    .sort(sortCountEntries)
    .slice(0, 5);

  const topResourceTypes = Array.from(resourceTypeCounts.entries())
    .map(([key, count]) => ({ key, resourceType: key, count }))
    .sort(sortCountEntries)
    .slice(0, 5);

  return {
    resourceCounts,
    healthScore,
    issueCounts: toCountMap(issueAggregate),
    resourceTypeCounts: toCountMap(resourceTypeCounts),
    topIssues,
    topResourceTypes,
  };
};

export const buildTrackedResourceHealthSummary = (resources = []) =>
  buildAwsResourceHealthSummary({
    resources: (Array.isArray(resources) ? resources : []).map((resource) => ({
      ...resource,
      checks: Array.isArray(resource?.health?.checks) ? resource.health.checks : [],
      errors: Array.isArray(resource?.health?.errors) ? resource.health.errors : [],
    })),
  });

const extractResourceWorkloadRefs = (resource) => {
  const refs = Array.isArray(resource?.workloads)
    ? resource.workloads.filter((entry) => entry?.workloadId)
    : [];
  if (refs.length > 0) {
    return refs.map((entry) => ({
      workloadId: String(entry.workloadId || '').trim(),
      workloadName: String(entry.workloadName || '').trim(),
    }));
  }

  const workloadId = String(resource?.workloadId || '').trim();
  if (!workloadId) return [];

  return [
    {
      workloadId,
      workloadName: String(resource?.workloadName || '').trim(),
    },
  ];
};

export const buildWorkloadHealthSummaryPatchesFromEnvironmentPayload = (payload) => {
  const resources = extractHealthResources(payload);
  const resourcesByWorkloadId = new Map();

  resources.forEach((resource) => {
    extractResourceWorkloadRefs(resource).forEach((ref) => {
      if (!ref.workloadId) return;
      const existing = resourcesByWorkloadId.get(ref.workloadId) || [];
      existing.push(resource);
      resourcesByWorkloadId.set(ref.workloadId, existing);
    });
  });

  return Array.from(resourcesByWorkloadId.entries()).map(([workloadId, workloadResources]) => ({
    workloadId,
    resources: workloadResources,
    healthSummary: buildAwsResourceHealthSummary({ resources: workloadResources }),
  }));
};

export const getHealthRecordTimestamp = (record) =>
  record?.generatedAt ||
  record?.payload?.generatedAt ||
  record?.payload?.analysis?.health?.generatedAt ||
  record?.updatedAt ||
  '';
