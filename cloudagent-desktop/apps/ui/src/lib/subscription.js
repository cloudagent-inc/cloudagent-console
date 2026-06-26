export const normalizeSubscriptionValue = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const isCloudAgentCustomer = () => true;

export const getSubscriptionMeta = (userProfile = {}) => ({
  subscription: normalizeSubscriptionValue(userProfile?.subscription, {}),
  tier: '',
  planType: '',
  status: '',
  subscriptionId: '',
  isActive: false,
});

export const hasPaidCloudAgentSubscription = () => true;

export const hasTeamsSubscription = () => true;

const parseAuthProfileSafe = (profile = {}) => {
  const authProfile = profile?.authProfile;
  if (!authProfile) return {};
  if (typeof authProfile === 'object') return authProfile;
  try {
    return JSON.parse(authProfile) || {};
  } catch {
    return {};
  }
};

export const isCloudEnvironmentProfile = (profile = {}) => {
  if (!profile) return false;
  const type = String(profile?.type || '').trim().toLowerCase();
  const normalizedType = type.replace(/_/g, ' ');
  if (
    [
      'aws account',
      'aws org',
      'google workspace',
      'azure tenant',
      'azure subscription',
    ].includes(normalizedType)
  ) {
    return true;
  }

  const authProfile = parseAuthProfileSafe(profile);
  return Boolean(
    authProfile?.awsAccountId ||
      authProfile?.tenantId ||
      authProfile?.subscriptionId ||
      authProfile?.domain
  );
};

export const countCloudEnvironmentProfiles = (profiles = []) =>
  (Array.isArray(profiles) ? profiles : []).filter(isCloudEnvironmentProfile)
    .length;

export const countUserWorkloads = (workloads = [], deletedWorkloadIds = []) => {
  const deletedIds = new Set(
    (Array.isArray(deletedWorkloadIds) ? deletedWorkloadIds : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  );

  return (Array.isArray(workloads) ? workloads : []).filter((workload) => {
    const workloadId = String(workload?.workloadId || '').trim();
    const workloadName = String(workload?.workloadName || '').trim();
    if (!workloadId && !workloadName) return false;
    if (workloadId && deletedIds.has(workloadId)) return false;
    return !workloadName.startsWith('PermissionProfile-');
  }).length;
};

export const getCloudAgentCreationLimits = (
  userProfile = {},
  { workloadCountOverride, permissionProfileCountOverride, deletedWorkloadIds } = {}
) => {
  const permissionProfileCount =
    typeof permissionProfileCountOverride === 'number'
      ? permissionProfileCountOverride
      : countCloudEnvironmentProfiles(userProfile?.agentPermissionProfiles || []);
  const workloadCount =
    typeof workloadCountOverride === 'number'
      ? workloadCountOverride
      : countUserWorkloads(userProfile?.workloads || [], deletedWorkloadIds);

  return {
    shouldRestrict: false,
    maxPermissionProfiles: Infinity,
    maxWorkloads: Infinity,
    permissionProfileCount,
    workloadCount,
    canCreatePermissionProfile: true,
    canCreateWorkload: true,
    remainingWorkloadSlots: Infinity,
    permissionProfileLimitMessage: '',
    workloadLimitMessage: '',
  };
};
