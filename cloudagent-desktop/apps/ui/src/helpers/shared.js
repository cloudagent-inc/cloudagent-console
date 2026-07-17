const REGION_LABELS = {
  'us-west-2': 'US West (Oregon)',
  'us-west-1': 'US West (N. California)',
  'us-east-2': 'US East (Ohio)',
  'us-east-1': 'US East (N. Virginia)',
  'ap-south-1': 'Asia Pacific (Mumbai)',
  'ap-south-2': 'Asia Pacific (Hyderabad)',
  'ap-east-1': 'Asia Pacific (Hong Kong)',
  'ap-northeast-2': 'Asia Pacific (Seoul)',
  'ap-southeast-1': 'Asia Pacific (Singapore)',
  'ap-southeast-2': 'Asia Pacific (Sydney)',
  'ap-southeast-3': 'Asia Pacific (Jakarta)',
  'ap-southeast-4': 'Asia Pacific (Melbourne)',
  'ap-northeast-1': 'Asia Pacific (Tokyo)',
  'ap-northeast-3': 'Asia Pacific (Osaka)',
  'ca-central-1': 'Canada (Central)',
  'ca-west-1': 'Canada West (Calgary)',
  'cn-northwest-1': 'China (Ningxia)',
  'cn-north-1': 'China (Beijing)',
  'me-south-1': 'Middle East (Bahrain)',
  'me-central-1': 'Middle East (UAE)',
  'eu-central-1': 'Europe (Frankfurt)',
  'eu-central-2': 'Europe (Zurich)',
  'eu-west-1': 'Europe (Ireland)',
  'eu-west-2': 'Europe (London)',
  'eu-west-3': 'Europe (Paris)',
  'eu-north-1': 'Europe (Stockholm)',
  'sa-east-1': 'South America (São Paulo)',
  'af-south-1': 'Africa (Cape Town)',
  'eu-south-1': 'Europe (Milan)',
  'eu-south-2': 'Europe (Spain)',
  'il-central-1': 'Israel (Tel Aviv)',
  'us-gov-east-1': 'AWS GovCloud (US-East)',
  'us-gov-west-1': 'AWS GovCloud (US-West)',
};

const REGIONS = [
  'us-west-2',
  'us-west-1',
  'us-east-2',
  'us-east-1',
  'ap-south-1',
  'ap-south-2',
  'ap-east-1',
  'ap-northeast-2',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-southeast-3',
  'ap-southeast-4',
  'ap-northeast-1',
  'ap-northeast-3',
  'ca-central-1',
  'ca-west-1',
  'cn-northwest-1',
  'cn-north-1',
  'me-south-1',
  'me-central-1',
  'eu-central-1',
  'eu-central-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-north-1',
  'sa-east-1',
  'af-south-1',
  'eu-south-1',
  'eu-south-2',
  'il-central-1',
  'us-gov-east-1',
  'us-gov-west-1',
];

export const getRegionOptions = () =>
  REGIONS.map((region) => {
    const readableLabel = REGION_LABELS[region];
    const label = readableLabel ? `${readableLabel} - ${region}` : region;
    return {
      key: region,
      value: region,
      text: label,
      label,
    };
  });

export function generateRandomString(length) {
  let randomString = '';
  let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let i;

  for (i = 0; i < length; i++)
    randomString += possible.charAt(
      Math.floor(Math.random() * possible.length)
    );

  return randomString;
}

export const saveToFile = (text, defaultFilename) => {
  const filename = prompt('File name? ', defaultFilename);
  if (!filename) return;

  var element = document.createElement('a');
  element.setAttribute(
    'href',
    'data:text/plaincharset=utf-8,' + encodeURIComponent(text)
  );
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
};

/**
 * Cloud environment types that are supported for executive summaries and other features.
 * Permission profiles can be either cloud environments (AWS, Google Workspace) or integrations (Jira, etc.)
 */
export const APPROVED_CLOUD_ENVIRONMENT_TYPES = [
  'aws account',
  'google_workspace',
  'azure tenant',
  'azure subscription',
];

/**
 * Set of supported environment types for quick lookup (includes variations)
 */
export const SUPPORTED_ENVIRONMENT_TYPES = new Set([
  'aws account',
  'google_workspace',
  'google workspace', // Handle space vs underscore variation
  'azure tenant',
  'azure subscription',
]);

/**
 * Check if a permission profile type is a supported cloud environment type
 * @param {string} type - The permission profile type
 * @returns {boolean} - True if the type is a supported cloud environment
 */
export function isSupportedEnvironmentType(type) {
  if (!type) return false;
  const normalized = String(type).trim().toLowerCase();
  const normalizedAlt = normalized.replace(/_/g, ' ');
  return (
    SUPPORTED_ENVIRONMENT_TYPES.has(normalized) ||
    SUPPORTED_ENVIRONMENT_TYPES.has(normalizedAlt)
  );
}

/**
 * Executive summaries currently support account/subscription-level environments.
 * Azure tenants are connection containers and should not get their own summaries.
 */
export function isSupportedExecutiveSummaryEnvironmentType(type) {
  if (!isSupportedEnvironmentType(type)) return false;
  const normalized = String(type).trim().toLowerCase().replace(/_/g, ' ');
  return normalized !== 'azure tenant';
}

/**
 * Filter permission profiles to only include cloud environments (AWS account, Google Workspace)
 * Excludes integrations like Jira
 * @param {Array} profiles - Array of permission profiles
 * @returns {Array} - Filtered array containing only cloud environment profiles
 */
export function filterCloudEnvironments(profiles) {
  if (!profiles) return [];
  return profiles.filter((profile) => {
    // Check the type field directly
    const profileType = profile.type?.toLowerCase();
    if (profileType && APPROVED_CLOUD_ENVIRONMENT_TYPES.includes(profileType)) {
      return true;
    }
    // Also check for AWS accounts that might not have an explicit type (legacy)
    // AWS accounts have an authProfile with awsAccountId
    if (!profileType || profileType === 'aws account') {
      const authProfile = typeof profile.authProfile === 'string'
        ? JSON.parse(profile.authProfile || '{}')
        : profile.authProfile || {};
      if (authProfile.awsAccountId) {
        return true;
      }
    }
    return false;
  });
}
