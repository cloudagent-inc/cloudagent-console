import { fetchAuthSession } from 'aws-amplify/auth';
import { post } from 'aws-amplify/api';

// Well-Architected Lambda endpoint (for list/get operations)
const WELL_ARCHITECTED_ENDPOINT =
  'https://7zex6y5kfkulhezpjqx4h57yc40sojcd.lambda-url.us-east-1.on.aws/';

const stringifyErrorValue = (value, fallback = '') => {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message || fallback;

  if (typeof value === 'object') {
    const nestedMessage =
      value.message ||
      value.errorMessage ||
      value.error ||
      value.detail ||
      value.details ||
      value.reason;
    if (nestedMessage && nestedMessage !== value) {
      const formattedNested = stringifyErrorValue(nestedMessage, '');
      if (formattedNested) return formattedNested;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }

  return String(value || fallback);
};

const getBackendErrorMessage = (data, fallback) => {
  if (!data) return fallback;
  return stringifyErrorValue(
    data.message ||
      data.error ||
      data.errorMessage ||
      data.detail ||
      data.details ||
      data,
    fallback
  );
};

const isBackendErrorResponse = (data) => {
  if (!data || typeof data !== 'object') return false;
  if (data.ok === false || data.success === false) return true;

  const status = data.status ?? data.statusCode ?? data.code;
  if (status == null) return false;

  const numericStatus = Number(status);
  if (Number.isFinite(numericStatus)) {
    return numericStatus >= 400 || (data.status != null && numericStatus !== 200);
  }

  return ['error', 'failed', 'failure'].includes(
    String(status).trim().toLowerCase()
  );
};

/**
 * List Well-Architected workloads for an AWS account
 *
 * @param {Object} params - Parameters
 * @param {string} params.accountId - AWS account ID
 * @param {Object} params.authProfile - Authentication profile object
 * @param {string[]} [params.regions] - AWS regions to query (defaults to ['us-east-1'])
 * @returns {Promise<Object>} List of workloads
 */
export async function listWellArchitectedWorkloads({
  accountId,
  authProfile,
  regions = ['us-east-1'],
}) {
  const { roleName, externalId } = authProfile;
  const body = {
    requestType: 'listWorkloads',
    regions,
    accountId,
    roleName,
    externalId,
    authProfile,
  };

  try {
    console.log('[wellArchitected] Fetching workloads for account:', accountId);

    const response = await fetch(WELL_ARCHITECTED_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log('[wellArchitected] Workloads fetched:', data);
    return data;
  } catch (error) {
    console.error('[wellArchitected] Error fetching workloads:', error);
    throw error;
  }
}

/**
 * Get a specific Well-Architected workload details
 *
 * @param {Object} params - Parameters
 * @param {string} params.workloadId - Workload ID
 * @param {string} params.accountId - AWS account ID
 * @param {Object} params.authProfile - Authentication profile object
 * @param {string} [params.workloadRegion] - AWS region for the workload
 * @returns {Promise<Object>} Workload details
 */
export async function getWellArchitectedWorkload({
  workloadId,
  accountId,
  authProfile,
  workloadRegion = 'us-east-1',
}) {
  const { roleName, externalId } = authProfile;
  const body = {
    requestType: 'getWorkloadDetails',
    accountId,
    authProfile,
    roleName,
    externalId,
    workloadId,
    workloadRegion,
  };

  try {
    const response = await fetch(WELL_ARCHITECTED_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[wellArchitected] Error fetching workload:', error);
    throw error;
  }
}

/**
 * Upload/Update Well-Architected workload answers to AWS
 *
 * @param {Object} params - Parameters
 * @param {string} params.opType - Operation type ('create' or 'update')
 * @param {Object} params.authProfile - Authentication profile object
 * @param {Object} params.workloadDetails - Workload details (name, description, lenses, etc.)
 * @param {Array} params.answers - Array of answers to upload
 * @param {string} params.accountId - AWS account ID
 * @param {string} [params.selectedAssessmentId] - Assessment ID
 * @param {boolean} [params.createMilestone] - Whether to create a milestone
 * @param {string} [params.milestoneName] - Name of the milestone
 * @param {string} [params.sourceAccountId] - Source account ID for workload account IDs
 * @param {string} [params.awsRegion] - AWS region (defaults to 'us-east-1')
 * @returns {Promise<Object>} Response from the API
 */
export async function updateWellArchitected({
  opType,
  authProfile,
  workloadDetails,
  answers,
  accountId,
  selectedAssessmentId = '',
  createMilestone = false,
  milestoneName = '',
  sourceAccountId = '',
}) {
  try {
    // Get auth token
    const session = await fetchAuthSession();
    const idToken = session?.tokens?.idToken?.toString();

    if (!idToken) {
      throw new Error('No authentication token available');
    }

    const requestBody = {
      opType,
      authProfile,
      workloadDetails,
      answers,
      accountId,
      selectedAssessmentId,
      createMilestone,
      milestoneName,
      sourceAccountId,
    };

    console.log('[wellArchitected] Updating workload - Full request:', {
      opType,
      accountId,
      workloadDetails,
      answersCount: answers?.length,
      answers: answers?.slice(0, 2), // Log first 2 answers for debugging
    });

    const restOperation = post({
      apiName: 'frontEndAPI',
      path: '/updatewellarchitected',
      options: {
        body: requestBody,
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    });

    const { body } = await restOperation.response;
    const data = await body.json();

    // Check for backend error status
    if (isBackendErrorResponse(data)) {
      throw new Error(
        getBackendErrorMessage(
          data,
          'Failed to update Well-Architected workload'
        )
      );
    }

    return {
      ok: true,
      workloadId: data.workloadId,
      workloadCreated: data.workloadCreated,
      milestone: data.milestone,
      answersSummary: data.answersSummary,
    };
  } catch (error) {
    console.error('[wellArchitected] Error updating workload:', error);
    return {
      ok: false,
      error: stringifyErrorValue(
        error,
        'Failed to update Well-Architected workload'
      ),
    };
  }
}
