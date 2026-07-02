const parseJsonLike = (value, fallback = null) => {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  if (typeof value === 'object') return value;
  return fallback;
};

export const toRecommendationResources = (value) => {
  const parsed = parseJsonLike(value, value);
  if (Array.isArray(parsed)) {
    return parsed.filter((item) => item && typeof item === 'object');
  }
  if (parsed && typeof parsed === 'object') {
    return [parsed];
  }
  return [];
};

export const getRecommendationResolvedAction = (recommendation) => {
  const recommendedAction = parseJsonLike(recommendation?.recommendedAction, {});
  const fallbackAction = parseJsonLike(recommendation?.action, {});
  return Object.keys(recommendedAction || {}).length > 0
    ? recommendedAction
    : fallbackAction || {};
};

export const getRecommendationActionType = (recommendation) =>
  String(getRecommendationResolvedAction(recommendation)?.type || '')
    .trim()
    .toLowerCase();

export const getRecommendationActionLabel = (recommendation) => {
  const actionType = getRecommendationActionType(recommendation);
  if (actionType === 'blueprint' || actionType === 'skill') return 'Run Skill';
  if (actionType === 'report') return 'Run Report';
  if (actionType === 'platform' || actionType === 'plaform') return 'Open';
  return 'View Action';
};

export const buildPermissionProfilesById = (profiles = []) => {
  const map = new Map();
  (Array.isArray(profiles) ? profiles : []).forEach((profile) => {
    const identifier = profile?.recordId || profile?.id;
    if (identifier) {
      map.set(String(identifier), profile);
    }
  });
  return map;
};

export const buildPermissionProfilesByAccount = (profiles = []) => {
  const map = new Map();
  (Array.isArray(profiles) ? profiles : []).forEach((profile) => {
    const authProfile = parseJsonLike(profile?.authProfile, {});
    const awsAccountId =
      authProfile?.awsAccountId ||
      authProfile?.accountId ||
      authProfile?.AwsAccountId ||
      authProfile?.AWSAccountId ||
      null;
    const googleDomain =
      authProfile?.provider === 'google_workspace' ? authProfile?.domain || null : null;
    const azureSubscriptionIds =
      String(authProfile?.provider || profile?.type || '').toLowerCase().includes('azure')
        ? [
            authProfile?.subscriptionId,
            authProfile?.azureSubscriptionId,
            ...(Array.isArray(authProfile?.subscriptionIds) ? authProfile.subscriptionIds : []),
            ...(Array.isArray(authProfile?.azureSubscriptionIds) ? authProfile.azureSubscriptionIds : []),
            ...(Array.isArray(authProfile?.subscriptions)
              ? authProfile.subscriptions.map(
                  (subscription) => subscription?.subscriptionId || subscription?.id
                )
              : []),
          ].filter(Boolean)
        : [];

    [awsAccountId, googleDomain, ...azureSubscriptionIds]
      .filter(Boolean)
      .forEach((keyValue) => {
        const key = String(keyValue);
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key).push(profile);
      });
  });
  return map;
};

const getProfileIdentifier = (profile, fallbackKey = null) =>
  profile?.recordId || profile?.id || fallbackKey || null;

const getResourceAccountId = (resource) =>
  resource?.accountId != null
    ? String(resource.accountId)
    : resource?.subscriptionId != null
      ? String(resource.subscriptionId)
      : resource?.azureSubscriptionId != null
        ? String(resource.azureSubscriptionId)
        : null;

const getResourceCloudProvider = (resource) =>
  resource?.cloudProvider ? String(resource.cloudProvider) : 'aws';

const getMatchingProfileForAccount = ({
  accountId,
  cloudProvider,
  permissionProfiles = [],
  permissionProfilesByAccount = new Map(),
}) => {
  if (!accountId) return null;

  const accountKey = String(accountId);
  const indexedProfiles = permissionProfilesByAccount.get(accountKey);

  if (Array.isArray(indexedProfiles) && indexedProfiles.length > 0) {
    if (cloudProvider === 'google_workspace') {
      return (
        indexedProfiles.find((profile) => {
          const authProfile = parseJsonLike(profile?.authProfile, {});
          return authProfile?.provider === 'google_workspace';
        }) || indexedProfiles[0]
      );
    }
    return indexedProfiles[0];
  }

  return (
    (Array.isArray(permissionProfiles) ? permissionProfiles : []).find((profile) => {
      const authProfile = parseJsonLike(profile?.authProfile, {});
      if (cloudProvider === 'google_workspace') {
        return authProfile?.provider === 'google_workspace' && authProfile?.domain === accountKey;
      }
      const profileAccountId =
        authProfile?.awsAccountId ||
        authProfile?.accountId ||
        authProfile?.AwsAccountId ||
        authProfile?.AWSAccountId ||
        null;
      if (cloudProvider === 'azure') {
        const azureSubscriptionIds = [
          authProfile?.subscriptionId,
          authProfile?.azureSubscriptionId,
          ...(Array.isArray(authProfile?.subscriptionIds) ? authProfile.subscriptionIds : []),
          ...(Array.isArray(authProfile?.azureSubscriptionIds) ? authProfile.azureSubscriptionIds : []),
          ...(Array.isArray(authProfile?.subscriptions)
            ? authProfile.subscriptions.map(
                (subscription) => subscription?.subscriptionId || subscription?.id
              )
            : []),
        ].filter(Boolean);
        return azureSubscriptionIds.some((subscriptionId) => String(subscriptionId) === accountKey);
      }
      return profileAccountId && String(profileAccountId) === accountKey;
    }) || null
  );
};

const getResourceProfile = ({
  resource,
  permissionProfiles = [],
  permissionProfilesById = new Map(),
  permissionProfilesByAccount = new Map(),
}) => {
  const permissionProfileId = resource?.permissionProfileId
    ? String(resource.permissionProfileId)
    : null;
  if (permissionProfileId && permissionProfilesById.has(permissionProfileId)) {
    return permissionProfilesById.get(permissionProfileId);
  }

  return getMatchingProfileForAccount({
    accountId: getResourceAccountId(resource),
    cloudProvider: getResourceCloudProvider(resource),
    permissionProfiles,
    permissionProfilesByAccount,
  });
};

const getProfileDisplayName = (profile, accountId = null) =>
  profile?.name || profile?.permissionProfileName || accountId || 'Unknown Environment';

export const formatRecommendationResourceLabel = (resource) => {
  if (!resource || typeof resource !== 'object') return 'Resource';
  return (
    resource.displayName ||
    resource.resourceId ||
    resource.resourceArn ||
    resource.resourceType ||
    'Resource'
  );
};

const buildResourceSummary = (resources = []) => {
  const labels = resources
    .map((resource) => formatRecommendationResourceLabel(resource))
    .filter(Boolean);
  const preview = labels.slice(0, 3);
  const remaining = labels.length - preview.length;
  if (preview.length === 0) return 'No specific resources provided';
  if (remaining > 0) {
    return `${preview.join(', ')} +${remaining} more`;
  }
  return preview.join(', ');
};

export const buildRecommendationProfileEntries = ({
  recommendation,
  permissionProfiles = [],
  permissionProfilesById,
  permissionProfilesByAccount,
}) => {
  const resources = toRecommendationResources(recommendation?.targetResources);
  const profilesById = permissionProfilesById || buildPermissionProfilesById(permissionProfiles);
  const profilesByAccount =
    permissionProfilesByAccount || buildPermissionProfilesByAccount(permissionProfiles);

  const uniqueAccountPairs = Array.from(
    new Map(
      resources
        .map((resource) => {
          const accountId = getResourceAccountId(resource);
          if (!accountId) return null;
          return {
            accountId,
            cloudProvider: getResourceCloudProvider(resource),
          };
        })
        .filter(Boolean)
        .map((entry) => [`${entry.accountId}:${entry.cloudProvider}`, entry])
    ).values()
  );

  const matchedProfiles = uniqueAccountPairs.map(({ accountId, cloudProvider }) => {
    const profile = getMatchingProfileForAccount({
      accountId,
      cloudProvider,
      permissionProfiles,
      permissionProfilesByAccount: profilesByAccount,
    });
    return {
      accountId,
      cloudProvider,
      profile,
      profileName: getProfileDisplayName(profile, accountId),
    };
  });

  const resourceProfileMap = new Map();

  resources.forEach((resource, index) => {
    const profile = getResourceProfile({
      resource,
      permissionProfiles,
      permissionProfilesById: profilesById,
      permissionProfilesByAccount: profilesByAccount,
    });
    if (!profile) return;

    const accountId = getResourceAccountId(resource);
    const key =
      getProfileIdentifier(profile, accountId ? `account-${accountId}` : `index-${index}`) ||
      `index-${index}`;

    if (!resourceProfileMap.has(key)) {
      resourceProfileMap.set(key, {
        accountId,
        profile,
        resources: [],
      });
    }

    resourceProfileMap.get(key).resources.push(resource);
  });

  matchedProfiles.forEach(({ accountId, profile }) => {
    if (!profile) return;
    const key =
      getProfileIdentifier(profile, accountId ? `account-${accountId}` : profile?.name || 'profile') ||
      profile?.name ||
      'profile';
    if (!resourceProfileMap.has(key)) {
      resourceProfileMap.set(key, {
        accountId: accountId ? String(accountId) : null,
        profile,
        resources: [],
      });
    }
  });

  return {
    resources,
    matchedProfiles,
    profileEntries: Array.from(resourceProfileMap.values()),
  };
};

export const buildRecommendationBlueprintRunTargets = ({
  recommendation,
  permissionProfiles = [],
  permissionProfilesById,
  permissionProfilesByAccount,
}) => {
  const { resources, matchedProfiles, profileEntries } = buildRecommendationProfileEntries({
    recommendation,
    permissionProfiles,
    permissionProfilesById,
    permissionProfilesByAccount,
  });

  const environmentTargets = new Map();
  const workloadTargets = new Map();
  const workloadResourceKeys = new Set();

  const profilesById = permissionProfilesById || buildPermissionProfilesById(permissionProfiles);
  const profilesByAccount =
    permissionProfilesByAccount || buildPermissionProfilesByAccount(permissionProfiles);

  profileEntries.forEach((entry, index) => {
    const profile = entry?.profile || null;
    const accountId = entry?.accountId ? String(entry.accountId) : null;
    const environmentKey =
      getProfileIdentifier(profile, accountId ? `environment-${accountId}` : `environment-${index}`) ||
      `environment-${index}`;
    environmentTargets.set(environmentKey, {
      key: environmentKey,
      type: 'environment',
      accountId,
      profile,
      profileName: getProfileDisplayName(profile, accountId),
      label: getProfileDisplayName(profile, accountId),
      subtitle: accountId || null,
      resources: Array.isArray(entry?.resources) ? [...entry.resources] : [],
      workloadId: null,
      workloadName: null,
      environmentName: getProfileDisplayName(profile, accountId),
      cloudProvider:
        Array.isArray(entry?.resources) && entry.resources.length > 0
          ? getResourceCloudProvider(entry.resources[0])
          : 'aws',
      resourceSummary: '',
    });
  });

  resources.forEach((resource, index) => {
    const profile = getResourceProfile({
      resource,
      permissionProfiles,
      permissionProfilesById: profilesById,
      permissionProfilesByAccount: profilesByAccount,
    });
    if (!profile) return;

    const accountId = getResourceAccountId(resource);
    const profileKey =
      getProfileIdentifier(profile, accountId ? `environment-${accountId}` : `environment-${index}`) ||
      `environment-${index}`;
    const workloadId = resource?.workloadId ? String(resource.workloadId) : null;
    const workloadName = resource?.workloadName ? String(resource.workloadName) : null;
    if (!workloadId && !workloadName) return;

    const workloadKey = `${profileKey}:${workloadId || workloadName}`;
    if (!workloadTargets.has(workloadKey)) {
      workloadTargets.set(workloadKey, {
        key: workloadKey,
        type: 'workload',
        accountId,
        profile,
        profileName: getProfileDisplayName(profile, accountId),
        label: workloadName || workloadId || 'Workload',
        subtitle: getProfileDisplayName(profile, accountId),
        resources: [],
        workloadId,
        workloadName: workloadName || workloadId || null,
        environmentName: getProfileDisplayName(profile, accountId),
        cloudProvider: getResourceCloudProvider(resource),
        resourceSummary: '',
      });
    }

    workloadTargets.get(workloadKey).resources.push(resource);
    workloadResourceKeys.add(`${profileKey}:${index}`);
  });

  const environmentRunTargets = Array.from(environmentTargets.values())
    .map((target) => {
      const profileKey =
        getProfileIdentifier(
          target.profile,
          target.accountId ? `environment-${target.accountId}` : target.key
        ) || target.key;
      const remainingResources = target.resources.filter((resource, resourceIndex) => {
        const originalIndex = resources.findIndex((candidate) => candidate === resource);
        if (originalIndex < 0) return !workloadResourceKeys.has(`${profileKey}:${resourceIndex}`);
        return !workloadResourceKeys.has(`${profileKey}:${originalIndex}`);
      });

      return {
        ...target,
        resources: remainingResources,
        resourceSummary: buildResourceSummary(remainingResources),
      };
    })
    .filter((target) => {
      if (workloadTargets.size === 0) return true;
      return target.resources.length > 0;
    });

  const workloadRunTargets = Array.from(workloadTargets.values()).map((target) => ({
    ...target,
    resourceSummary: buildResourceSummary(target.resources),
  }));

  if (workloadRunTargets.length === 0 && environmentRunTargets.length === 0 && matchedProfiles.length > 0) {
    return matchedProfiles
      .filter((entry) => entry?.profile)
      .map((entry, index) => ({
        key:
          getProfileIdentifier(
            entry.profile,
            entry.accountId ? `environment-${entry.accountId}` : `environment-${index}`
          ) || `environment-${index}`,
        type: 'environment',
        accountId: entry.accountId ? String(entry.accountId) : null,
        profile: entry.profile,
        profileName: getProfileDisplayName(entry.profile, entry.accountId),
        label: getProfileDisplayName(entry.profile, entry.accountId),
        subtitle: entry.accountId || null,
        resources: [],
        workloadId: null,
        workloadName: null,
        environmentName: getProfileDisplayName(entry.profile, entry.accountId),
        cloudProvider: entry.cloudProvider || 'aws',
        resourceSummary: 'No specific resources provided',
      }));
  }

  return [...workloadRunTargets, ...environmentRunTargets];
};

export const serializeRecommendationRunTarget = (target) => {
  if (!target || typeof target !== 'object') return null;
  return {
    type: target.type || 'environment',
    label: target.label || null,
    subtitle: target.subtitle || null,
    accountId: target.accountId || null,
    cloudProvider: target.cloudProvider || null,
    workloadId: target.workloadId || null,
    workloadName: target.workloadName || null,
    environmentName: target.environmentName || target.profileName || null,
    resourceSummary: target.resourceSummary || buildResourceSummary(target.resources || []),
    resources: Array.isArray(target.resources) ? target.resources : [],
  };
};

const getRecommendationResourceIdentity = (resource) => {
  if (!resource || typeof resource !== 'object') return null;
  return (
    resource.resourceId ||
    resource.resourceArn ||
    resource.displayName ||
    null
  );
};

const extractRecommendationRecordId = (value) => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  if (value.recommendationRecordId) {
    return String(value.recommendationRecordId);
  }

  if (value.recordId) {
    return String(value.recordId);
  }

  if (
    typeof value.recordKey === 'string' &&
    value.recordKey.startsWith('RECOMMENDATION#')
  ) {
    const [, suffix] = value.recordKey.split('#', 2);
    return suffix || null;
  }

  return null;
};

const sanitizeRecommendationExecutionResource = (resource) => {
  if (!resource || typeof resource !== 'object') return null;
  const sanitized = {
    accountId: resource.accountId ?? null,
    resourceId: resource.resourceId ?? null,
    resourceArn: resource.resourceArn ?? null,
    displayName: resource.displayName ?? null,
    resourceType: resource.resourceType ?? null,
    region: resource.region ?? null,
    cloudProvider: resource.cloudProvider ?? null,
    workloadId: resource.workloadId ?? null,
    workloadName: resource.workloadName ?? null,
  };
  return Object.fromEntries(
    Object.entries(sanitized).filter(([, value]) => value != null && value !== '')
  );
};

export const buildRecommendationExecutionContext = (context) => {
  if (!context || typeof context !== 'object') return null;

  const targetResources = toRecommendationResources(context.targetResources)
    .map(sanitizeRecommendationExecutionResource)
    .filter(Boolean);
  const recommendationRecordId = extractRecommendationRecordId(context);

  if (!recommendationRecordId) {
    return null;
  }

  const targetedResourceIds = Array.from(
    new Set(
      [
        ...(Array.isArray(context.targetedResourceIds) ? context.targetedResourceIds : []),
        ...targetResources.map((resource) => getRecommendationResourceIdentity(resource)),
      ].filter(Boolean)
    )
  );

  return {
    source: context.source || 'recommendations',
    recommendationRecordId,
    recommendationId: context.recommendationId || null,
    recordKey: context.recordKey || null,
    blueprintId:
      context.blueprintId ||
      context.planId ||
      context.sourceBlueprintId ||
      null,
    accountId: context.accountId || null,
    workloadId:
      context.workloadId ||
      context.recommendationRunTarget?.workloadId ||
      null,
    workloadName:
      context.workloadName ||
      context.recommendationRunTarget?.workloadName ||
      null,
    targetType:
      context.targetType ||
      context.recommendationRunTarget?.type ||
      null,
    targetedResourceIds,
    targetResources,
    recommendationRunTarget:
      context.recommendationRunTarget || null,
  };
};
