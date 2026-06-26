import { fetchAuthSession } from 'aws-amplify/auth';
import { getRuntimeApiUrl, isLocalRuntime } from '@/runtime/cloudAgentRuntime';

const parseJsonResponse = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export async function requestJson(path, { method = 'GET', body, auth = true, fallbackApiBaseUrl } = {}) {
  const headers = {
    Accept: 'application/json',
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
  };

  if (auth && !isLocalRuntime()) {
    try {
      const session = await fetchAuthSession();
      const idToken = session?.tokens?.idToken?.toString();
      if (idToken) {
        headers.Authorization = `Bearer ${idToken}`;
      }
    } catch {
      // Some hosted endpoints allow unauthenticated requests; preserve that behavior.
    }
  }

  const response = await fetch(getRuntimeApiUrl(path, { fallbackApiBaseUrl }), {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const message =
      typeof data === 'object' && data
        ? data.error || data.message || JSON.stringify(data)
        : data || response.statusText;
    throw new Error(message || 'Request failed');
  }

  return data;
}

export const unwrapRecord = (response, keys = []) => {
  if (!response || typeof response !== 'object') return response;
  for (const key of keys) {
    if (response[key]) return response[key];
  }
  if (response.item) return response.item;
  if (response.record) return response.record;
  if (response.data) return response.data;
  return response;
};
