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

export function startJiraOAuth(payload) {
  return requestJson('/api/integrations/jira/oauth/start', {
    method: 'POST',
    body: payload,
  });
}

export function exchangeJiraOAuth(payload) {
  return requestJson('/api/integrations/jira/oauth/exchange', {
    method: 'POST',
    body: payload,
  });
}

export function verifyJiraApiToken(payload) {
  return requestJson('/api/integrations/jira/token/verify', {
    method: 'POST',
    body: payload,
  });
}

export function refreshJiraOAuthToken(connectionId) {
  return requestJson('/api/integrations/jira/token/refresh', {
    method: 'POST',
    body: { connectionId },
  });
}

export function listJiraProjects(connectionId) {
  return requestJson(
    `/api/integrations/jira/metadata/projects?connectionId=${encodeURIComponent(
      connectionId
    )}`
  );
}

export function listJiraIssueTypes(connectionId, projectKey) {
  return requestJson(
    `/api/integrations/jira/metadata/issue-types?connectionId=${encodeURIComponent(
      connectionId
    )}&projectKey=${encodeURIComponent(projectKey)}`
  );
}

export function createJiraIssuesFromRecommendations(payload) {
  return requestJson('/api/recommendations/jira', {
    method: 'POST',
    body: payload,
  });
}
