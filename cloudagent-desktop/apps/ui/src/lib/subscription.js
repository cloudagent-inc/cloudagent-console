import { DEFAULT_CUSTOMER_KEY } from '@/config/appConfig';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['', 'active', 'trialing']);
const PAID_SUBSCRIPTION_TIERS = new Set([
  'individual',
  'teams',
  'team',
  'professional',
  'pro',
]);
const PAID_SUBSCRIPTION_PLAN_TYPES = new Set([
  'cloudagent_individual',
  'cloudagent_teams',
  'cloudagent_team',
  'cloudagent_professional',
  'cloudagent_professional_100',
  'cloudagent_professional_250',
  'cloudagent_team_1000',
  'cloudagent_team_2500',
]);

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

export const isCloudAgentCustomer = () => DEFAULT_CUSTOMER_KEY === 'cloudagent';

export const getSubscriptionMeta = (userProfile = {}) => {
  const subscription = normalizeSubscriptionValue(userProfile?.subscription, {});
  const tier = String(subscription?.tier || '').toLowerCase();
  const planType = String(subscription?.stripe_planType || '').toLowerCase();
  const status = String(subscription?.status || '').toLowerCase();
  const subscriptionId =
    subscription?.stripe_subscriptionId || subscription?.subscriptionId;
  const isActive =
    Boolean(subscriptionId) && ACTIVE_SUBSCRIPTION_STATUSES.has(status);

  return {
    subscription,
    tier,
    planType,
    status,
    subscriptionId,
    isActive,
  };
};

export const hasPaidCloudAgentSubscription = (userProfile = {}) => {
  if (!isCloudAgentCustomer()) return true;

  const { tier, planType, isActive } = getSubscriptionMeta(userProfile);
  return (
    isActive &&
    (PAID_SUBSCRIPTION_TIERS.has(tier) ||
      PAID_SUBSCRIPTION_PLAN_TYPES.has(planType))
  );
};

export const hasTeamsSubscription = (userProfile = {}) => {
  if (!isCloudAgentCustomer()) return true;

  const { tier, planType, isActive } = getSubscriptionMeta(userProfile);

  return (
    isActive &&
    (tier === 'teams' || planType === 'cloudagent_teams')
  );
};

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
  if (isLocalRuntime()) {
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
  }

  const shouldRestrict =
    isCloudAgentCustomer() && !hasPaidCloudAgentSubscription(userProfile);
  const permissionProfileCount =
    typeof permissionProfileCountOverride === 'number'
      ? permissionProfileCountOverride
      : countCloudEnvironmentProfiles(userProfile?.agentPermissionProfiles || []);
  const workloadCount =
    typeof workloadCountOverride === 'number'
      ? workloadCountOverride
      : countUserWorkloads(userProfile?.workloads || [], deletedWorkloadIds);

  return {
    shouldRestrict,
    maxPermissionProfiles: 1,
    maxWorkloads: 1,
    permissionProfileCount,
    workloadCount,
    canCreatePermissionProfile: !shouldRestrict || permissionProfileCount < 1,
    canCreateWorkload: !shouldRestrict || workloadCount < 1,
    remainingWorkloadSlots: shouldRestrict ? Math.max(0, 1 - workloadCount) : Infinity,
    permissionProfileLimitMessage:
      'Free plan includes 1 cloud environment. Upgrade to Individual or Teams to add more.',
    workloadLimitMessage:
      'Free plan includes 1 workload. Upgrade to Individual or Teams to add more.',
  };
};
