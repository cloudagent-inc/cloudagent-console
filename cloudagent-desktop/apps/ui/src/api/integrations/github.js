import { fetchAuthSession } from 'aws-amplify/auth';
import { BACKEND_API_ENDPOINT } from '../../config/appConfig';

const API_BASE = BACKEND_API_ENDPOINT;

async function getAuthHeaders() {
  try {
    const session = await fetchAuthSession();
    const idToken = session?.tokens?.idToken?.toString();
    return idToken ? { Authorization: `Bearer ${idToken}` } : {};
  } catch {
    return {};
  }
}

async function requestJson(path, { method = 'GET', body } = {}) {
  const authHeaders = await getAuthHeaders();
  const headers = {
    Accept: 'application/json',
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...authHeaders,
  };
  if (API_BASE.includes('ngrok-free.dev') || API_BASE.includes('ngrok.io')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let message = text;
    if (text) {
      try {
        const parsed = JSON.parse(text);
        message = parsed?.message || parsed?.error || text;
      } catch {
        message = text;
      }
    }
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  const text = await response.text().catch(() => '');
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function startGithubInstallation(payload) {
  return requestJson('/api/integrations/github/install/start', {
    method: 'POST',
    body: payload,
  });
}

export function exchangeGithubInstallation(payload) {
  return requestJson('/api/integrations/github/install/exchange', {
    method: 'POST',
    body: payload,
  });
}

export function listGithubRepositories(connectionId) {
  return requestJson(
    `/api/integrations/github/metadata/repos?connectionId=${encodeURIComponent(
      connectionId
    )}`
  );
}

export function listGithubBranches(connectionId, owner, repo) {
  return requestJson(
    `/api/integrations/github/metadata/branches?connectionId=${encodeURIComponent(
      connectionId
    )}&owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
  );
}

export function createGithubPullRequest(payload) {
  return requestJson('/api/integrations/github/pull-requests', {
    method: 'POST',
    body: payload,
  });
}

export function refreshGithubInstallationToken(connectionId) {
  return requestJson('/api/integrations/github/token/refresh', {
    method: 'POST',
    body: { connectionId },
  });
}
