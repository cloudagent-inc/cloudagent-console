import { generateClient, post } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import { queryGetStoredAnalysisArtifactAccess } from './eventQueries';
import { getRuntimeApiUrl, isLocalRuntime } from '@/runtime/cloudAgentRuntime';

const graphQlClient = generateClient();

function parseErrorMessage(errorBody, fallbackMessage) {
  if (!errorBody) return fallbackMessage;
  try {
    const parsed = JSON.parse(errorBody);
    if (parsed && typeof parsed === 'object') {
      const base = parsed.error || parsed.message || fallbackMessage;
      if (Array.isArray(parsed.issues) && parsed.issues.length > 0) {
        const issueMessages = parsed.issues
          .map((issue) => issue?.message)
          .filter(Boolean)
          .join('; ');
        return issueMessages ? `${base}: ${issueMessages}` : base;
      }
      return base;
    }
  } catch (_) {
    // Non-JSON error body.
  }
  return errorBody || fallbackMessage;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function resolveRequestBody(defaultBody, overrideBody) {
  if (overrideBody === undefined) {
    return defaultBody;
  }

  if (typeof overrideBody === 'string') {
    try {
      return JSON.parse(overrideBody);
    } catch (_) {
      return defaultBody;
    }
  }

  return isPlainObject(overrideBody) ? overrideBody : defaultBody;
}

function buildStoredArtifactPayload(payload, access = {}) {
  const basePayload = isPlainObject(payload) ? payload : { payload };
  const reportType = String(access?.reportType || '').trim();
  const targetType = String(access?.targetType || '').trim();
  const targetId = String(access?.targetId || '').trim();
  const existingOutput = isPlainObject(basePayload.output) ? basePayload.output : {};
  const existingAnalysis = isPlainObject(basePayload.analysis) ? basePayload.analysis : {};
  const existingArtifactMeta = isPlainObject(existingAnalysis?.[reportType])
    ? existingAnalysis[reportType]
    : {};

  const nextAnalysis =
    reportType && isPlainObject(existingAnalysis)
      ? {
          ...existingAnalysis,
          [reportType]: {
            ...existingArtifactMeta,
            ...(access?.generatedAt ? { generatedAt: access.generatedAt } : {}),
            ...(access?.fileName ? { fileName: access.fileName } : {}),
            ...(access?.bucket ? { bucket: access.bucket } : {}),
            ...(access?.objectKey ? { objectKey: access.objectKey } : {}),
            ...(access?.downloadUrl ? { downloadUrl: access.downloadUrl } : {}),
            ...(access?.expiresAt ? { expiresAt: access.expiresAt } : {}),
          },
        }
      : existingAnalysis;

  return {
    ...basePayload,
    ...(targetType === 'workload'
      ? { workloadId: basePayload.workloadId ?? targetId }
      : { permissionProfileId: basePayload.permissionProfileId ?? targetId }),
    ...(Object.keys(nextAnalysis || {}).length > 0 ? { analysis: nextAnalysis } : {}),
    output: {
      ...existingOutput,
      reportType: reportType || existingOutput.reportType,
      scopeType: targetType || existingOutput.scopeType,
      scopeId: targetId || existingOutput.scopeId,
      cache: {
        source: 'stored_artifact',
        cacheHit: true,
        ...(isPlainObject(existingOutput.cache) ? existingOutput.cache : {}),
      },
      artifact: {
        bucket: access?.bucket || existingOutput?.artifact?.bucket || null,
        objectKey: access?.objectKey || existingOutput?.artifact?.objectKey || null,
        fileName: access?.fileName || existingOutput?.artifact?.fileName || null,
        downloadUrl: access?.downloadUrl || existingOutput?.artifact?.downloadUrl || null,
        expiresAt: access?.expiresAt || existingOutput?.artifact?.expiresAt || null,
      },
    },
  };
}

async function parseJsonResponse(response, fallbackMessage) {
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(parseErrorMessage(errorBody, fallbackMessage));
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const rawBody = await response.text();
  return rawBody ? JSON.parse(rawBody) : null;
}

async function fetchStoredAwsScannerResultViaAppSync(requestBody, initOverrides = {}) {
  const response = await graphQlClient.graphql({
    query: queryGetStoredAnalysisArtifactAccess,
    variables: {
      reportType: requestBody?.reportType,
      permissionProfileId: requestBody?.permissionProfileId || null,
      workloadId: requestBody?.workloadId || null,
      targetType: requestBody?.targetType || null,
    },
  });

  const access = response?.data?.getStoredAnalysisArtifactAccess;
  if (!access) {
    throw new Error('Stored analysis artifact access response was empty');
  }

  if (access.pending) {
    return {
      pending: true,
      analysis: requestBody?.reportType
        ? {
            [requestBody.reportType]: {
              ...(access.generatedAt ? { generatedAt: access.generatedAt } : {}),
              ...(access.fileName ? { fileName: access.fileName } : {}),
              ...(access.bucket ? { bucket: access.bucket } : {}),
              ...(access.objectKey ? { objectKey: access.objectKey } : {}),
            },
          }
        : undefined,
    };
  }

  const downloadUrl = String(access?.downloadUrl || '').trim();
  if (!downloadUrl) {
    throw new Error('Stored analysis artifact access did not return a download URL');
  }

  const artifactResponse = await fetch(downloadUrl, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
    signal: initOverrides?.signal,
  });
  const payload = await parseJsonResponse(
    artifactResponse,
    `Stored analysis artifact download failed with status ${artifactResponse.status}`
  );

  return buildStoredArtifactPayload(payload, access);
}

async function fetchStoredAwsScannerResult(requestBody, initOverrides = {}) {
  if (isLocalRuntime()) {
    const response = await fetch(
      getRuntimeApiUrl('/ops/scan/aws-scanners/result'),
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(initOverrides?.headers || {}),
        },
        body: JSON.stringify(resolveRequestBody(requestBody, initOverrides?.body)),
        signal: initOverrides?.signal,
      }
    );
    return parseJsonResponse(
      response,
      `Stored analysis artifact request failed with status ${response.status}`
    );
  }

  return fetchStoredAwsScannerResultViaAppSync(requestBody, initOverrides);
}

async function callAwsAccountFunctions(action, body = {}, initOverrides = {}) {
  let idToken;

  try {
    const session = await fetchAuthSession();
    idToken = session?.tokens?.idToken?.toString();
  } catch (_) {
    // proceed without Authorization header
  }

  const { headers: overrideHeaders = {}, body: overrideBody } = initOverrides || {};
  const requestBody = resolveRequestBody({ action, ...body }, overrideBody);
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...overrideHeaders,
  };
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }

  const restOperation = post({
    apiName: 'frontEndAPI',
    path: '/awsAccountFunctions',
    options: {
      body: requestBody,
      headers,
    },
  });

  const { body: responseBody } = await restOperation.response;
  const response = await responseBody.json();

  if (response?.ok === false || Number(response?.code || 200) >= 400) {
    throw new Error(response?.error || response?.message || 'AWS account operation failed');
  }

  return response;
}

export async function fetchCloudFormationStacks(params = {}, initOverrides = {}) {
  return callAwsAccountFunctions('listCloudFormationStacks', {
    permissionProfileId: params.permissionProfileId,
    regions: params.regions,
    services: params.services,
  }, initOverrides);
}

export async function fetchCloudFormationStackResources(
  stackId,
  params = {},
  initOverrides = {}
) {
  return callAwsAccountFunctions('getCloudFormationStackResources', {
    stackId,
    permissionProfileId: params.permissionProfileId,
    region: params.region,
  }, initOverrides);
}

export async function fetchAwsOrganizationAccounts(
  params = {},
  initOverrides = {}
) {
  return callAwsAccountFunctions('listAwsOrganizationAccounts', {
    permissionProfileId: params.permissionProfileId,
    authProfile: params.authProfile,
    includeSuspended: params.includeSuspended,
  }, initOverrides);
}

export async function fetchAwsOrganizationStackSetStatus(
  params = {},
  initOverrides = {}
) {
  return callAwsAccountFunctions('getAwsOrganizationStackSetStatus', {
    permissionProfileId: params.permissionProfileId,
    authProfile: params.authProfile,
    stackSetName: params.stackSetName,
    stackSetRegion: params.stackSetRegion,
    operationId: params.operationId,
    callAs: params.callAs,
  }, initOverrides);
}

export async function evaluateAwsResourceHealth(
  params = {},
  initOverrides = {}
) {
  const requestBody = resolveRequestBody(
    {
      reportType: 'health',
      targetType: params.workloadId ? 'workload' : 'permissionProfile',
      permissionProfileId: params.permissionProfileId,
      workloadId: params.workloadId,
    },
    initOverrides?.body
  );

  return fetchStoredAwsScannerResult(requestBody, initOverrides);
}

export async function evaluateAwsCostAnalysis(
  params = {},
  initOverrides = {}
) {
  const requestBody = resolveRequestBody(
    {
      cloudProvider: params.cloudProvider || 'aws',
      reportType: 'cost',
      targetType: 'permissionProfile',
      permissionProfileId: params.agentPermissionProfileId || params.permissionProfileId,
    },
    initOverrides?.body
  );

  return fetchStoredAwsScannerResult(requestBody, initOverrides);
}

export async function evaluateAwsThreatDetection(
  params = {},
  initOverrides = {}
) {
  const requestBody = resolveRequestBody(
    {
      reportType: 'threat',
      targetType: 'permissionProfile',
      permissionProfileId: params.permissionProfileId,
    },
    initOverrides?.body
  );

  return fetchStoredAwsScannerResult(requestBody, initOverrides);
}

export async function launchAwsScannerBatch(params = {}, initOverrides = {}) {
  const { headers: overrideHeaders = {}, body: overrideBody } = initOverrides || {};
  const requestBody =
    overrideBody !== undefined
      ? overrideBody
      : {
          cloudProvider: params.cloudProvider || 'aws',
          reportType: params.reportType,
          targets: Array.isArray(params.targets) ? params.targets : [],
          websocketConnectionId: params.websocketConnectionId,
          forceRefresh: params.forceRefresh,
          lookbackHours: params.lookbackHours,
          lookbackDays: params.lookbackDays,
          enableCloudWatchLogChecks: params.enableCloudWatchLogChecks,
        };

  if (isLocalRuntime()) {
    const response = await fetch(getRuntimeApiUrl('/ops/scan/aws-scanners/launch'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...overrideHeaders,
      },
      body: JSON.stringify(requestBody),
      signal: initOverrides?.signal,
    });
    const payload = await parseJsonResponse(
      response,
      `Scanner launch failed with status ${response.status}`
    );
    if (payload?.ok === false) {
      throw new Error(payload?.error || 'Failed to launch scanner batch');
    }
    return payload;
  }

  let idToken;

  try {
    const session = await fetchAuthSession();
    idToken = session?.tokens?.idToken?.toString();
  } catch (_) {
    // proceed without Authorization header
  }

  const restOperation = post({
    apiName: 'frontEndAPI',
    path: '/scanners-launch',
    options: {
      body: requestBody,
      headers: {
        Authorization: idToken ? `Bearer ${idToken}` : undefined,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...overrideHeaders,
      },
    },
  });

  const { body } = await restOperation.response;
  const response = await body.json();

  if (response?.ok === false) {
    throw new Error(response?.error || 'Failed to launch scanner batch');
  }

  return response;
}
