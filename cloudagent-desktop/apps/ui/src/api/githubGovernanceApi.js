import { requestJson } from './clients/httpClient';

// Client for the GitHub governance / branch-protection endpoints. The backend
// is being built in parallel against exactly these contracts; every call is
// defensive so the UI degrades to a neutral "not verified yet" state rather
// than crashing when an endpoint 404s before the backend lands.

const buildQuery = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.append(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

// GET /github/governance/effective
// -> { ok, repoFullName, defaultBranch, github, source }
export async function fetchEffectiveGithubGovernance({ workloadId, repoFullName } = {}) {
  try {
    const data = await requestJson(
      `/github/governance/effective${buildQuery({ workloadId, repoFullName })}`,
      { method: 'GET', auth: false }
    );
    if (!data || typeof data !== 'object') return { ok: false, unavailable: true };
    return { ok: data.ok !== false, ...data };
  } catch (error) {
    return { ok: false, unavailable: true, error: normalizeError(error) };
  }
}

// POST /github/branch-protection/verify
// -> { ok, repoFullName, defaultBranch, protected, requiresPullRequest, method, checkedAt, error }
export async function verifyBranchProtection({ repoFullName, workloadId } = {}) {
  try {
    const data = await requestJson('/github/branch-protection/verify', {
      method: 'POST',
      auth: false,
      body: { repoFullName, ...(workloadId ? { workloadId } : {}) },
    });
    if (!data || typeof data !== 'object') return { ok: false, unavailable: true };
    return { ok: data.ok !== false, ...data };
  } catch (error) {
    return { ok: false, unavailable: true, error: normalizeError(error) };
  }
}

// GET /github/branch-protection/status
// -> last cached result or { ok: true, checked: false }
export async function fetchBranchProtectionStatus({ repoFullName } = {}) {
  try {
    const data = await requestJson(
      `/github/branch-protection/status${buildQuery({ repoFullName })}`,
      { method: 'GET', auth: false }
    );
    if (!data || typeof data !== 'object') return { ok: true, checked: false };
    return { ok: data.ok !== false, checked: false, ...data };
  } catch (error) {
    // A missing endpoint or cache is not an error surface — treat as unchecked.
    return { ok: true, checked: false, unavailable: true, error: normalizeError(error) };
  }
}

function normalizeError(error) {
  if (!error) return null;
  if (typeof error === 'string') return { message: error };
  if (typeof error?.message === 'string') return { message: error.message };
  return { message: 'Request failed' };
}
