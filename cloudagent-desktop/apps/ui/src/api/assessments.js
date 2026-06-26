import { fetchAuthSession } from 'aws-amplify/auth';
import { post } from 'aws-amplify/api';

const formatAssessmentLaunchError = (data, fallback) => {
  if (data?.error === 'INSUFFICIENT_CREDITS') {
    const required = Number(data.requiredCredits);
    const available = Number(data.availableCredits);
    if (Number.isFinite(required) && Number.isFinite(available)) {
      return `Insufficient credits. This operation requires ${required} credits, but only ${available} are available.`;
    }
    return 'Insufficient credits to launch this operation.';
  }

  return data?.message || data?.error || fallback;
};

const assertAssessmentLaunchAccepted = (data, fallback) => {
  if (data?.ok === false || Number(data?.code || 0) >= 400) {
    const error = new Error(formatAssessmentLaunchError(data, fallback));
    error.code = data?.error || data?.code || 'ASSESSMENT_LAUNCH_FAILED';
    error.data = data;
    throw error;
  }
};

/**
 * Main entry point for initiating assessments
 * Routes to the appropriate assessment function based on cloudProvider
 * 
 * @param {Object} params - Assessment parameters
 * @param {string} params.cloudProvider - The cloud provider type ('aws', 'google_workspace', etc.)
 * @param {Object} params.config - Provider-specific configuration
 * @param {Object} params.common - Common parameters (scanId, reportId, title, parentId, etc.)
 * @param {Object} params.callbacks - Callback functions (onSuccess, onError)
 * @returns {Promise<Object>} Assessment result
 */
export async function initiateAssessment({
  cloudProvider = 'aws',
  config,
  common,
  callbacks = {},
}) {
  const provider = cloudProvider?.toLowerCase() || 'aws';

  switch (provider) {
    case 'google_workspace':
      return initiateGoogleWorkspaceAssessment({
        ...config,
        ...common,
        ...callbacks,
      });

    case 'azure':
      return initiateAzureAssessment({
        ...config,
        ...common,
        ...callbacks,
      });

    case 'aws':
    default:
      return initiateAwsAssessment({
        ...config,
        ...common,
        ...callbacks,
      });
  }
}

/**
 * Initiates an AWS assessment scan via API Gateway
 * 
 * @param {Object} params - AWS assessment parameters
 * @param {string} params.accountId - AWS account ID
 * @param {Array<string>} params.services - List of AWS services to scan
 * @param {Array<string>} params.regions - List of AWS regions to scan
 * @param {Object} params.authProfile - Authentication profile for AWS
 * @param {string} params.assessmentId - Unique assessment/scan ID
 * @param {string} [params.reportId] - Optional report ID
 * @param {string} [params.title] - Optional title for the scan
 * @param {string} [params.parentId] - Optional parent ID (for workflow runs)
 * @param {string} [params.licenseType] - License type
 * @param {string} [params.connectionId] - WebSocket connection ID for real-time updates
 * @param {Function} [params.onSuccess] - Success callback
 * @param {Function} [params.onError] - Error callback
 */
export async function initiateAwsAssessment({
  accountId,
  services,
  regions,
  authProfile,
  assessmentId,
  reportId,
  title,
  parentId,
  licenseType,
  onError,
  onSuccess,
  connectionId,
}) {
  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens.idToken.toString();

    const restOperation = post({
      apiName: 'frontEndAPI',
      path: '/scanners-launch',
      options: {
        body: {
          launchType: 'reportAssessment',
          cloudProvider: 'aws',
          scanId: assessmentId,
          accountId,
          regions,
          services,
          authProfile: {
            ...authProfile,
            accountId,
          },
          licenseType,
          websocketConnectionId: connectionId,
          ...(reportId && { reportId }),
          ...(title && { title }),
          ...(parentId && { parentId }),
        },
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    });

    const { body } = await restOperation.response;
    const response = await body.json();

    assertAssessmentLaunchAccepted(response, 'Failed to initiate AWS assessment');

    if (onSuccess) {
      onSuccess(response.code, response.message);
    }

    return response;
  } catch (error) {
    if (onError) {
      onError(error);
    }
    throw error;
  }
}

/**
 * Initiates an Azure assessment scan via API Gateway.
 */
export async function initiateAzureAssessment({
  scanId,
  assessmentId,
  tenantId,
  subscriptionIds,
  authDetails,
  services,
  regions,
  tenantType = 'azure',
  tenantEnvironment = 'public',
  reportId,
  title,
  parentId,
  licenseType,
  connectionId,
  onSuccess,
  onError,
}) {
  const resolvedScanId = scanId || assessmentId;
  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens.idToken.toString();

    const restOperation = post({
      apiName: 'frontEndAPI',
      path: '/scanners-launch',
      options: {
        body: {
          launchType: 'reportAssessment',
          scanId: resolvedScanId,
          tenantId,
          subscriptionIds,
          authDetails,
          services,
          regions,
          tenantType,
          tenantEnvironment,
          cloudProvider: 'azure',
          appsyncSchemaTarget: 'cloudagent',
          websocketConnectionId: connectionId,
          ...(reportId && { reportId }),
          ...(title && { title }),
          ...(parentId && { parentId }),
          ...(licenseType && { licenseType }),
        },
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    });

    const { body } = await restOperation.response;
    const response = await body.json();

    assertAssessmentLaunchAccepted(response, 'Failed to initiate Azure assessment');

    if (onSuccess) {
      onSuccess(response.code, response.message);
    }

    return response;
  } catch (error) {
    if (onError) {
      onError(error);
    }
    throw error;
  }
}

/**
 * Initiates a Google Workspace assessment scan
 * 
 * @param {Object} params - Google Workspace assessment parameters
 * @param {string} params.scanId - Unique scan ID (e.g., "domain-2026-01-02T22-26-36-521Z")
 * @param {string} params.domain - Google Workspace domain (e.g., "asecure.cloud")
 * @param {string} params.superAdminEmailAddress - Super admin email for the workspace
 * @param {string} params.serviceAccountJson - Raw JSON string of service account credentials
 * @param {Array<string>} [params.services] - Optional list of services to scan (e.g., ["directory", "gmail", "drive"])
 * @param {string} [params.reportId] - Optional report ID
 * @param {string} [params.title] - Optional title for the scan
 * @param {string} [params.parentId] - Optional parent ID (for workflow runs)
 * @param {string} [params.connectionId] - WebSocket connection ID for real-time updates
 * @param {Function} [params.onSuccess] - Success callback
 * @param {Function} [params.onError] - Error callback
 */
export async function initiateGoogleWorkspaceAssessment({
  scanId,
  assessmentId,
  domain,
  superAdminEmailAddress,
  serviceAccountJson,
  services,
  reportId,
  title,
  parentId,
  connectionId,
  onSuccess,
  onError,
}) {
  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens.idToken.toString();
    const resolvedScanId = scanId || assessmentId;

    console.log('[assessments] Initiating Google Workspace assessment:', {
      scanId: resolvedScanId,
      domain,
      superAdminEmailAddress,
      servicesCount: services?.length || 0,
      reportId,
      title,
      parentId,
      websocketConnectionId: connectionId,
    });

    const restOperation = post({
      apiName: 'frontEndAPI',
      path: '/scanners-launch',
      options: {
        body: {
          launchType: 'reportAssessment',
          cloudProvider: 'google_workspace',
          scanId: resolvedScanId,
          domain,
          superAdminEmailAddress,
          serviceAccountJson,
          services,
          websocketConnectionId: connectionId,
          ...(reportId && { reportId }),
          ...(title && { title }),
          ...(parentId && { parentId }),
        },
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    });

    const { body } = await restOperation.response;
    const data = await body.json();

    assertAssessmentLaunchAccepted(
      data,
      'Failed to initiate Google Workspace assessment'
    );

    if (onSuccess) {
      onSuccess(data.code || 200, data.message || 'Assessment initiated successfully');
    }

    return data;
  } catch (error) {
    console.error('[assessments] Google Workspace assessment error:', error);
    
    if (onError) {
      onError(error);
    }
    throw error;
  }
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use initiateAssessment or initiateAwsAssessment instead
 */
export const initiateAssessmentScan = initiateAwsAssessment;

/**
 * Fetch assessment results for a specific scan
 * Always fetches a fresh presigned URL via GraphQL to avoid expiration issues
 *
 * @param {Object} params - Parameters
 * @param {string} params.scanId - The scan ID to fetch results for
 * @param {string} [params.accountId] - The AWS account ID for the scan
 * @param {string} [params.userId] - The user ID (optional, will be fetched if not provided)
 * @param {string} [params.groupId] - The group ID (optional)
 * @returns {Promise<Object>} Assessment results object
 */
export async function fetchAssessmentResults({
  scanId,
  accountId,
  userId,
  groupId = '',
  cloudProvider = 'aws',
  useReportHistory = false,
}) {
  try {
    const { generateClient } = await import('aws-amplify/api');
    const {
      queryGetLatestAssessmentResultWithUser,
      queryGetLatestReportHistoryAssessmentResult,
    } = await import('./eventQueries');

    // Get user info if userId not provided
    let currentUserId = userId;
    if (!currentUserId) {
      try {
        const session = await fetchAuthSession();
        // Try to get userId from the token
        const idToken = session?.tokens?.idToken;
        if (idToken) {
          const payload = idToken.payload;
          currentUserId = payload.sub || payload['cognito:username'] || '';
        }
      } catch (e) {
        console.warn('[assessments] Could not get userId from session:', e);
      }
    }

    // Fetch fresh presigned URL via GraphQL (like asecurecloud)
    const client = generateClient();
    const provider = String(cloudProvider || 'aws').trim().toLowerCase();
    const shouldUseReportHistory = useReportHistory || provider === 'azure';
    const query = shouldUseReportHistory
      ? queryGetLatestReportHistoryAssessmentResult
      : queryGetLatestAssessmentResultWithUser;
    const variables = shouldUseReportHistory
      ? {
          scanId,
          userId: currentUserId || '',
        }
      : {
          scanId,
          userId: currentUserId || '',
          accountId: accountId || '',
          groupId: groupId || '',
        };
    const response = await client.graphql({
      query,
      variables,
    });

    const url = shouldUseReportHistory
      ? response.data.__getLatestReportHistoryAssessmentResult
      : response.data.__getLatestAssessmentResult;

    if (!url) {
      throw new Error('No assessment results URL returned from GraphQL');
    }

    // Fetch the assessment results JSON from the presigned URL
    const fetchResponse = await fetch(url);
    if (!fetchResponse.ok) {
      throw new Error(`Failed to fetch assessment results: ${fetchResponse.status}`);
    }

    const assessmentResults = await fetchResponse.json();
    return assessmentResults;
  } catch (error) {
    console.error('[assessments] Error fetching assessment results:', error);
    throw error;
  }
}
