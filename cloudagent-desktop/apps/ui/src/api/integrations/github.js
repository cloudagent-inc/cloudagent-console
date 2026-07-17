import { requestJson } from '@/api/clients/httpClient';

export function startGithubInstallation(payload) {
  return requestJson('/api/integrations/github/install/start', {
    method: 'POST',
    body: payload,
    auth: false,
  });
}

export function exchangeGithubInstallation(payload) {
  return requestJson('/api/integrations/github/install/exchange', {
    method: 'POST',
    body: payload,
    auth: false,
  });
}

export function listGithubRepositories(connectionId) {
  return requestJson(
    `/api/integrations/github/metadata/repos?connectionId=${encodeURIComponent(
      connectionId
    )}`,
    { auth: false }
  );
}

export function listGithubBranches(connectionId, owner, repo) {
  return requestJson(
    `/api/integrations/github/metadata/branches?connectionId=${encodeURIComponent(
      connectionId
    )}&owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
    { auth: false }
  );
}

export function createGithubPullRequest(payload) {
  return requestJson('/api/integrations/github/pull-requests', {
    method: 'POST',
    body: payload,
    auth: false,
  });
}

export function refreshGithubInstallationToken(connectionId) {
  return requestJson('/api/integrations/github/token/refresh', {
    method: 'POST',
    body: { connectionId },
    auth: false,
  });
}
