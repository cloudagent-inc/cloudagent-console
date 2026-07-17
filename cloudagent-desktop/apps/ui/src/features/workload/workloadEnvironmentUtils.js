const safeParseJson = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const getPermissionProfileId = (profile) =>
  String(profile?.recordId || profile?.id || profile?.permissionProfileId || '').trim();

export const getPermissionProfileAuthProfile = (profile) =>
  safeParseJson(profile?.authProfile, {});

export const getPermissionProfileType = (profile) =>
  String(profile?.type || getPermissionProfileAuthProfile(profile)?.provider || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');

export const getPermissionProfileAwsAccountId = (profile) => {
  const authProfile = getPermissionProfileAuthProfile(profile);
  return String(
    authProfile?.awsAccountId || authProfile?.aws_account_id || authProfile?.accountId || ''
  ).trim();
};

export const getPermissionProfileAzureSubscriptionId = (profile) => {
  const authProfile = getPermissionProfileAuthProfile(profile);
  return String(authProfile?.subscriptionId || '').trim();
};

export const getPermissionProfileDomain = (profile) => {
  const authProfile = getPermissionProfileAuthProfile(profile);
  return String(authProfile?.domain || '').trim();
};

export const isAwsAccountPermissionProfile = (profile) =>
  getPermissionProfileType(profile) === 'aws account';

export const isSystemWorkload = (workload) =>
  String(workload?.workloadName || '').startsWith('PermissionProfile-');

export const findPermissionProfileById = (profiles = [], permissionProfileId = '') => {
  const normalized = String(permissionProfileId || '').trim();
  if (!normalized) return null;
  return (
    (Array.isArray(profiles) ? profiles : []).find(
      (profile) => getPermissionProfileId(profile) === normalized
    ) || null
  );
};

export const findPermissionProfileByAwsAccountId = (profiles = [], accountId = '') => {
  const normalized = String(accountId || '').trim();
  if (!normalized) return null;
  return (
    (Array.isArray(profiles) ? profiles : []).find(
      (profile) => getPermissionProfileAwsAccountId(profile) === normalized
    ) || null
  );
};

export const findPermissionProfileByAzureSubscriptionId = (profiles = [], subscriptionId = '') => {
  const normalized = String(subscriptionId || '').trim();
  if (!normalized) return null;
  return (
    (Array.isArray(profiles) ? profiles : []).find(
      (profile) => getPermissionProfileAzureSubscriptionId(profile) === normalized
    ) || null
  );
};

export const resolveWorkloadEnvironmentProfile = (environmentValue, permissionProfiles = []) => {
  if (!environmentValue) return null;

  if (typeof environmentValue === 'object') {
    const directId =
      environmentValue.permissionProfileId ||
      environmentValue.environmentProfileId ||
      environmentValue.recordId ||
      environmentValue.id ||
      '';
    if (directId) {
      const directProfile = findPermissionProfileById(permissionProfiles, directId);
      if (directProfile) return directProfile;
    }

    const accountId =
      environmentValue.accountId ||
      environmentValue.awsAccountId ||
      environmentValue.subscriptionId ||
      '';
    if (accountId) {
      return (
        findPermissionProfileByAwsAccountId(permissionProfiles, accountId) ||
        findPermissionProfileByAzureSubscriptionId(permissionProfiles, accountId)
      );
    }
    return null;
  }

  const raw = String(environmentValue || '').trim();
  if (!raw) return null;

  const directProfile = findPermissionProfileById(permissionProfiles, raw);
  if (directProfile) return directProfile;

  if (/^\d{12}$/.test(raw)) {
    return findPermissionProfileByAwsAccountId(permissionProfiles, raw);
  }

  const azureProfile = findPermissionProfileByAzureSubscriptionId(permissionProfiles, raw);
  if (azureProfile) return azureProfile;

  if (raw.includes(':')) {
    const [accountId] = raw.split(':');
    if (/^\d{12}$/.test(accountId)) {
      return findPermissionProfileByAwsAccountId(permissionProfiles, accountId);
    }
  }

  return null;
};

export const resolveWorkloadEnvironmentRef = (environmentValue, permissionProfiles = []) => {
  const profile = resolveWorkloadEnvironmentProfile(environmentValue, permissionProfiles);
  if (!profile) return null;

  const permissionProfileId = getPermissionProfileId(profile);
  const accountId = getPermissionProfileAwsAccountId(profile);
  const subscriptionId = getPermissionProfileAzureSubscriptionId(profile);
  const domain = getPermissionProfileDomain(profile);
  const type = getPermissionProfileType(profile);
  const name = profile?.name || permissionProfileId;
  const identifier = accountId || subscriptionId || domain || permissionProfileId;

  return {
    permissionProfileId,
    name,
    type,
    accountId: accountId || subscriptionId || null,
    subscriptionId: subscriptionId || null,
    domain: domain || null,
    profile,
    label: identifier ? `${name} (${identifier})` : name,
  };
};

export const normalizeWorkloadEnvironmentIds = (environmentValues = [], permissionProfiles = []) => {
  const values = Array.isArray(environmentValues) ? environmentValues : [];
  const out = [];
  const seen = new Set();

  values.forEach((environmentValue) => {
    const resolved = resolveWorkloadEnvironmentRef(environmentValue, permissionProfiles);
    const nextValue = resolved?.permissionProfileId || String(environmentValue || '').trim();
    if (!nextValue || seen.has(nextValue)) return;
    seen.add(nextValue);
    out.push(nextValue);
  });

  return out;
};

export const getAwsAccountIdForWorkloadEnvironment = (
  environmentValue,
  permissionProfiles = []
) => resolveWorkloadEnvironmentRef(environmentValue, permissionProfiles)?.accountId || '';

export const buildWorkloadEnvironmentOptions = (
  permissionProfiles = [],
  { awsOnly = false } = {}
) => {
  const seen = new Set();

  return (Array.isArray(permissionProfiles) ? permissionProfiles : [])
    .map((profile) => resolveWorkloadEnvironmentRef(getPermissionProfileId(profile), permissionProfiles))
    .filter((environmentRef) => {
      if (!environmentRef?.permissionProfileId) return false;
      if (awsOnly && !environmentRef.accountId) return false;
      if (environmentRef.type === 'azure tenant') return false;
      if (seen.has(environmentRef.permissionProfileId)) return false;
      seen.add(environmentRef.permissionProfileId);
      return true;
    })
    .map((environmentRef) => ({
      id: environmentRef.permissionProfileId,
      value: environmentRef.permissionProfileId,
      name: environmentRef.name,
      label: environmentRef.label,
      accountId: environmentRef.accountId,
      domain: environmentRef.domain,
      type: environmentRef.type,
    }));
};
