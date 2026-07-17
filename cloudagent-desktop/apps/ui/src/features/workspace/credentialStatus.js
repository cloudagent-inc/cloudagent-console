const normalizeProfileType = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');

const safeParseJson = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

export const getProfileCredentialStatus = (profile) =>
  profile?.credentialStatus ||
  profile?.localCredentialStatus ||
  profile?._credentialStatus ||
  null;

export const isAwsCredentialBackedProfile = (profile) => {
  const authProfile = safeParseJson(profile?.authProfile);
  return normalizeProfileType(profile?.type) === 'aws account' ||
    String(authProfile?.provider || '').trim().toLowerCase() === 'aws';
};

export const hasValidCredentialCheck = (profile) => {
  const status = getProfileCredentialStatus(profile);
  if (!status || typeof status !== 'object') return false;
  if (status.lastCheckedValid === true) return true;
  if (status.lastCheckedValid === false) return false;
  return status.ok === true || String(status.status || '').trim().toLowerCase() === 'valid';
};

export const canRunLocalAwsScannersForProfile = (profile) => {
  if (!isAwsCredentialBackedProfile(profile)) return true;
  return hasValidCredentialCheck(profile);
};

export const getLocalAwsCredentialIssueMessage = (profile) => {
  if (!isAwsCredentialBackedProfile(profile)) return '';
  const status = getProfileCredentialStatus(profile);
  if (hasValidCredentialCheck(profile)) return '';
  if (!status || typeof status !== 'object') {
    return 'AWS credentials have not been checked yet. Recheck this environment in Cloud Setup.';
  }
  return (
    [status.message, status.remediation].filter(Boolean).join(' ') ||
    'AWS credentials are invalid. Update or recheck this environment in Cloud Setup.'
  );
};

export const hasLocalAwsCredentialIssue = (profile) =>
  Boolean(getLocalAwsCredentialIssueMessage(profile));
