import { getRuntimeApiUrl } from '../runtime/cloudAgentRuntime';

export const DIAGRAMS_BASE_URL = getRuntimeApiUrl('');
export const DIAGRAMS_CREATE_ENDPOINT = `${DIAGRAMS_BASE_URL}/diagrams/new`;

const buildHeaders = () => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'ngrok-skip-browser-warning': 'true',
});

const parseResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json().catch(() => null);
  }
  return await response.text().catch(() => '');
};

async function fetchJson(endpoint, { method = 'GET', body } = {}) {
  const resolvedEndpoint = getRuntimeApiUrl(endpoint.replace(DIAGRAMS_BASE_URL, ''));
  const response = await fetch(resolvedEndpoint, {
    method,
    headers: buildHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && (data.message || data.error)) ||
      (typeof data === 'string' && data) ||
      `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.details = data;
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function createWorkloadDiagram(params = {}) {
  const { workloadId, cloudProvider, excludeTypes, stylePreset, forceRefresh } = params;
  if (!workloadId) {
    throw new Error('workloadId is required to generate a diagram.');
  }

  return fetchJson(DIAGRAMS_CREATE_ENDPOINT, {
    method: 'POST',
    body: {
      workloadId,
      ...(cloudProvider ? { cloudProvider } : {}),
      ...(Array.isArray(excludeTypes) && excludeTypes.length > 0
        ? { excludeTypes }
        : {}),
      ...(stylePreset ? { stylePreset } : {}),
      ...(typeof forceRefresh === 'boolean' ? { forceRefresh } : {}),
    },
  });
}

export async function getWorkloadDiagramSpec(workloadId) {
  if (!workloadId) {
    throw new Error('workloadId is required to fetch a diagram spec.');
  }

  return fetchJson(
    `${DIAGRAMS_BASE_URL}/diagrams/${encodeURIComponent(workloadId)}/spec`
  );
}

export async function saveWorkloadDiagramSpec(workloadId, spec) {
  if (!workloadId) {
    throw new Error('workloadId is required to save a diagram spec.');
  }
  if (!spec || typeof spec !== 'object') {
    throw new Error('spec is required to save a diagram.');
  }

  return fetchJson(
    `${DIAGRAMS_BASE_URL}/diagrams/${encodeURIComponent(workloadId)}/spec`,
    {
      method: 'PUT',
      body: { spec },
    }
  );
}

export async function updateWorkloadDiagramSpecFromInstruction(workloadId, instruction) {
  if (!workloadId) {
    throw new Error('workloadId is required to update a diagram spec.');
  }
  if (!instruction || typeof instruction !== 'string' || instruction.trim() === '') {
    throw new Error('instruction is required to update a diagram spec.');
  }

  return fetchJson(
    `${DIAGRAMS_BASE_URL}/diagrams/${encodeURIComponent(workloadId)}/spec/update`,
    {
      method: 'POST',
      body: { instruction: instruction.trim() },
    }
  );
}
