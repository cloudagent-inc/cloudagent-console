import { createSelector } from '@reduxjs/toolkit';
import { selectActiveWorkspace } from './workspaceSlice';

const EMPTY_ARRAY = [];
const WORKSPACE_ELIGIBLE_TYPES = new Set([
  'aws account',
  'aws org',
  'google_workspace',
  'google workspace',
  'azure tenant',
  'azure subscription',
]);

export const safeParseWorkspaceJson = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const getEnvironmentProfileId = (profile) =>
  String(profile?.recordId || profile?.id || profile?.permissionProfileId || '').trim();

export const getEnvironmentAuthProfile = (profile) =>
  safeParseWorkspaceJson(profile?.authProfile, {});

export const getEnvironmentAccountId = (profile) => {
  const authProfile = getEnvironmentAuthProfile(profile);
  return String(
    authProfile?.awsAccountId ||
      authProfile?.aws_account_id ||
      authProfile?.accountId ||
      authProfile?.subscriptionId ||
      authProfile?.azureSubscriptionId ||
      ''
  ).trim();
};

export const getEnvironmentDomain = (profile) => {
  const authProfile = getEnvironmentAuthProfile(profile);
  return String(authProfile?.domain || '').trim().toLowerCase();
};

export const getEnvironmentProvider = (profile) => {
  const authProfile = getEnvironmentAuthProfile(profile);
  return String(
    profile?.type || profile?.cloudProvider || authProfile?.provider || ''
  ).trim().toLowerCase();
};

export const getNormalizedEnvironmentType = (profile) =>
  String(profile?.type || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');

export const isWorkspaceEligibleEnvironment = (profile) => {
  if (!profile || typeof profile !== 'object') return false;

  const normalizedType = getNormalizedEnvironmentType(profile);
  if (!normalizedType) {
    return Boolean(getEnvironmentAccountId(profile) || getEnvironmentDomain(profile));
  }

  if (normalizedType === 'workspace' || normalizedType === 'jira') {
    return false;
  }

  if (WORKSPACE_ELIGIBLE_TYPES.has(normalizedType)) {
    return true;
  }

  return Boolean(getEnvironmentAccountId(profile) || getEnvironmentDomain(profile));
};

export const filterWorkspaceEligibleEnvironments = (profiles) =>
  (Array.isArray(profiles) ? profiles : []).filter(isWorkspaceEligibleEnvironment);

const selectPermissionProfiles = (state) => state.auth?.userProfile?.agentPermissionProfiles || EMPTY_ARRAY;

export const selectWorkspaceEligibleEnvironmentProfiles = createSelector(
  [selectPermissionProfiles],
  (profiles) => filterWorkspaceEligibleEnvironments(profiles)
);

export const selectActiveWorkspaceScope = createSelector(
  [selectActiveWorkspace, selectWorkspaceEligibleEnvironmentProfiles],
  (activeWorkspace, environmentProfiles) => {
    const allowedEnvironmentIds = activeWorkspace
      ? new Set(
          (Array.isArray(activeWorkspace.environments) ? activeWorkspace.environments : [])
            .map((environmentId) => String(environmentId || '').trim())
            .filter(Boolean)
        )
      : null;

    const selectedProfiles = allowedEnvironmentIds
      ? environmentProfiles.filter((profile) =>
          allowedEnvironmentIds.has(getEnvironmentProfileId(profile))
        )
      : environmentProfiles;

    const environmentProfileIdSet = new Set();
    const awsAccountIdSet = new Set();
    const googleDomainSet = new Set();
    const environments = [];
    const environmentProfileById = new Map();

    selectedProfiles.forEach((profile) => {
      const environmentId = getEnvironmentProfileId(profile);
      if (!environmentId) return;

      const accountId = getEnvironmentAccountId(profile);
      const domain = getEnvironmentDomain(profile);
      const provider = getEnvironmentProvider(profile);
      const authProfile = getEnvironmentAuthProfile(profile);

      environmentProfileIdSet.add(environmentId);
      if (accountId) awsAccountIdSet.add(accountId);
      if (domain) googleDomainSet.add(domain);

      const environmentRef = {
        id: environmentId,
        name: profile?.name || environmentId,
        provider,
        accountId: accountId || null,
        domain: domain || null,
        authProfile,
      };

      environments.push(environmentRef);
      environmentProfileById.set(environmentId, profile);
    });

    return {
      workspaceId: activeWorkspace?.recordId || null,
      workspaceName: activeWorkspace?.name || null,
      isAllEnvironments: !activeWorkspace,
      environments,
      environmentProfiles: selectedProfiles,
      environmentProfileById,
      environmentProfileIdSet,
      awsAccountIdSet,
      googleDomainSet,
    };
  }
);

export const selectWorkspaceScopedEnvironmentProfiles = createSelector(
  [selectActiveWorkspaceScope],
  (scope) => scope.environmentProfiles || EMPTY_ARRAY
);

const hasMatchingEnvironmentId = (value, scope) => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  return scope.environmentProfileIdSet.has(normalized);
};

const hasMatchingAccountId = (value, scope) => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  return scope.awsAccountIdSet.has(normalized);
};

const hasMatchingDomain = (value, scope) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return false;
  return scope.googleDomainSet.has(normalized);
};

export const matchesEnvironmentAlias = (value, scope, provider = '') => {
  if (!scope || scope.isAllEnvironments) return true;
  if (hasMatchingEnvironmentId(value, scope)) return true;
  if (hasMatchingAccountId(value, scope)) return true;

  const normalizedProvider = String(provider || '').trim().toLowerCase();
  if (normalizedProvider === 'google_workspace' || normalizedProvider === 'google workspace') {
    return hasMatchingDomain(value, scope);
  }

  return hasMatchingDomain(value, scope);
};

export const matchesEnvironmentProfile = (profile, scope) => {
  if (!scope || scope.isAllEnvironments) {
    return isWorkspaceEligibleEnvironment(profile);
  }

  return (
    hasMatchingEnvironmentId(getEnvironmentProfileId(profile), scope) ||
    hasMatchingAccountId(getEnvironmentAccountId(profile), scope) ||
    hasMatchingDomain(getEnvironmentDomain(profile), scope)
  );
};

export const matchesWorkload = (workload, scope) => {
  if (!scope || scope.isAllEnvironments) return true;

  const environments = Array.isArray(workload?.environments) ? workload.environments : [];
  const metadata = safeParseWorkspaceJson(workload?.metadata, {});

  const candidates = [
    metadata?.environmentProfileId,
    metadata?.permissionProfileId,
    metadata?.accountId,
    metadata?.domain,
    ...environments,
  ].filter(Boolean);

  return candidates.some((candidate) => {
    const value = String(candidate || '').trim();
    if (!value) return false;

    if (matchesEnvironmentAlias(value, scope)) return true;

    if (value.includes(':')) {
      return value.split(':').some((part) => matchesEnvironmentAlias(part, scope));
    }

    return false;
  });
};

export const buildPermissionProfileLookup = (profiles = []) => {
  const lookup = new Map();

  const addKey = (key, profile) => {
    const normalized = String(key || '').trim().toLowerCase();
    if (!normalized || lookup.has(normalized)) return;
    lookup.set(normalized, profile);
  };

  (Array.isArray(profiles) ? profiles : []).forEach((profile) => {
    const parsedAuth = getEnvironmentAuthProfile(profile);
    addKey(getEnvironmentProfileId(profile), profile);
    addKey(profile?.name, profile);
    addKey(parsedAuth?.recordId, profile);
    addKey(parsedAuth?.profileId, profile);
    addKey(parsedAuth?.permissionProfileId, profile);
    addKey(parsedAuth?.authProfileName, profile);
    addKey(parsedAuth?.name, profile);
    addKey(parsedAuth?.awsAccountId, profile);
    addKey(parsedAuth?.accountId, profile);
    addKey(parsedAuth?.subscriptionId, profile);
    addKey(parsedAuth?.azureSubscriptionId, profile);
    addKey(parsedAuth?.domain, profile);
  });

  return lookup;
};

export const resolvePermissionProfileFromLookup = (lookup, candidates = []) => {
  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim().toLowerCase();
    if (!normalized) continue;
    const match = lookup.get(normalized);
    if (match) return match;
  }
  return null;
};

export const matchesReportScan = (scan, scope) => {
  if (!scope || scope.isAllEnvironments) return true;

  const provider = String(scan?.cloudProvider || 'aws').trim().toLowerCase();
  return (
    matchesEnvironmentAlias(scan?.permissionProfileId, scope, provider) ||
    matchesEnvironmentAlias(scan?.parentId, scope, provider) ||
    matchesEnvironmentAlias(scan?.accountId, scope, provider) ||
    matchesEnvironmentAlias(scan?.subscriptionId, scope, provider) ||
    matchesEnvironmentAlias(scan?.azureSubscriptionId, scope, provider)
  );
};

export const matchesRecommendationTargetResource = (resource, scope, options = {}) => {
  if (!scope || scope.isAllEnvironments) return true;
  if (!resource || typeof resource !== 'object') return false;

  if (
    matchesEnvironmentAlias(resource?.permissionProfileId, scope, resource?.cloudProvider) ||
    matchesEnvironmentAlias(resource?.environmentId, scope, resource?.cloudProvider) ||
    matchesEnvironmentAlias(resource?.recordId, scope, resource?.cloudProvider) ||
    matchesEnvironmentAlias(resource?.accountId, scope, resource?.cloudProvider) ||
    matchesEnvironmentAlias(resource?.subscriptionId, scope, resource?.cloudProvider) ||
    matchesEnvironmentAlias(resource?.azureSubscriptionId, scope, resource?.cloudProvider) ||
    matchesEnvironmentAlias(resource?.domain, scope, resource?.cloudProvider)
  ) {
    return true;
  }

  if (resource?.workloadId) {
    const workloadById = options.workloadById || new Map();
    const workload = workloadById.get(String(resource.workloadId));
    if (workload && matchesWorkload(workload, scope)) {
      return true;
    }
  }

  return false;
};

export const filterRecommendationTargetResources = (record, scope, options = {}) => {
  const targetResources = Array.isArray(record?.targetResources)
    ? record.targetResources
    : safeParseWorkspaceJson(record?.targetResources, []);

  if (!Array.isArray(targetResources)) return [];
  if (!scope || scope.isAllEnvironments) return targetResources;

  return targetResources.filter((resource) =>
    matchesRecommendationTargetResource(resource, scope, options)
  );
};

export const matchesRecommendationRecord = (record, scope, options = {}) => {
  if (!scope || scope.isAllEnvironments) return true;

  const targetResources = filterRecommendationTargetResources(record, scope, options);

  if (Array.isArray(targetResources) && targetResources.length > 0) {
    return true;
  }

  return (
    matchesEnvironmentAlias(record?.permissionProfileId, scope, record?.cloudProvider) ||
    matchesEnvironmentAlias(record?.accountId, scope, record?.cloudProvider)
  );
};

const collectDeepTokens = (value, tokens, depth = 0) => {
  if (value == null || depth > 5) return;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return;

    tokens.add(trimmed);

    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      const parsed = safeParseWorkspaceJson(trimmed, null);
      if (parsed && parsed !== trimmed) {
        collectDeepTokens(parsed, tokens, depth + 1);
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectDeepTokens(entry, tokens, depth + 1));
    return;
  }

  if (typeof value === 'object') {
    Object.values(value).forEach((entry) => collectDeepTokens(entry, tokens, depth + 1));
  }
};

const matchesTokenSet = (tokens, scope, provider = '') => {
  if (!scope || scope.isAllEnvironments) return true;

  for (const token of tokens) {
    if (matchesEnvironmentAlias(token, scope, provider)) return true;
    if (String(token).includes(':')) {
      const parts = String(token).split(':');
      if (parts.some((part) => matchesEnvironmentAlias(part, scope, provider))) {
        return true;
      }
    }
  }

  return false;
};

export const matchesAgentRun = (agent, scope, options = {}) => {
  if (!scope || scope.isAllEnvironments) return true;

  const historyRecord = options.historyRecord || null;
  const permissionProfileLookup = options.permissionProfileLookup || new Map();
  const workloadById = options.workloadById || new Map();
  const resolvedAuthProfile = safeParseWorkspaceJson(
    agent?.authProfile || historyRecord?.authProfile,
    {}
  );

  const candidates = [
    resolvedAuthProfile?.recordId,
    resolvedAuthProfile?.profileId,
    resolvedAuthProfile?.permissionProfileId,
    resolvedAuthProfile?.authProfileName,
    resolvedAuthProfile?.name,
    resolvedAuthProfile?.awsAccountId,
    resolvedAuthProfile?.accountId,
    resolvedAuthProfile?.subscriptionId,
    resolvedAuthProfile?.azureSubscriptionId,
    resolvedAuthProfile?.domain,
  ];

  const matchedProfile = resolvePermissionProfileFromLookup(permissionProfileLookup, candidates);
  if (matchedProfile && matchesEnvironmentProfile(matchedProfile, scope)) {
    return true;
  }

  if (
    candidates.some((candidate) =>
      matchesEnvironmentAlias(candidate, scope, resolvedAuthProfile?.provider)
    )
  ) {
    return true;
  }

  const workloadId = agent?.workloadId || historyRecord?.workloadId;
  if (workloadId) {
    const workload = workloadById.get(String(workloadId));
    if (workload && matchesWorkload(workload, scope)) {
      return true;
    }
  }

  const tokenSet = new Set();
  collectDeepTokens(agent, tokenSet);
  collectDeepTokens(historyRecord, tokenSet);
  return matchesTokenSet(tokenSet, scope, resolvedAuthProfile?.provider);
};

export const matchesWorkflowRun = (workflow, scope, options = {}) => {
  if (!scope || scope.isAllEnvironments) return true;

  const workloadById = options.workloadById || new Map();
  const tokenSet = new Set();
  collectDeepTokens(workflow, tokenSet);

  if (workflow?.workloadId) {
    const workload = workloadById.get(String(workflow.workloadId));
    if (workload && matchesWorkload(workload, scope)) {
      return true;
    }
  }

  return matchesTokenSet(tokenSet, scope);
};
