import { fetchAuthSession } from 'aws-amplify/auth';
import { BACKEND_API_ENDPOINT } from '../config/appConfig';
import { getRuntimeApiUrl, isLocalRuntime } from '@/runtime/cloudAgentRuntime';

/**
 * Generic POST JSON helper function
 * @param {string} path - API endpoint path
 * @param {object} body - Request body
 * @returns {Promise<any>} - Response JSON
 */
async function postJSON(path, body) {
  try {
    let idToken;
    if (!isLocalRuntime()) {
      try {
        const session = await fetchAuthSession();
        idToken = session?.tokens?.idToken?.toString();
      } catch (e) {
        // No session available; proceed without Authorization header
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    };

    const resp = await fetch(
      getRuntimeApiUrl(path, { fallbackApiBaseUrl: BACKEND_API_ENDPOINT }),
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      }
    );
    if (!resp.ok) throw new Error(await resp.text());
    return resp.json();
  } catch (e) {
    const message = e?.message?.includes('Failed to fetch')
      ? 'Network error: Could not reach the server. Please try again.'
      : e?.message || 'Request failed.';
    throw new Error(message);
  }
}

/**
 * Send a chat message to the plan builder agent
 * @param {object} payload - Chat payload containing sessionId, message, planState, etc.
 * @returns {Promise<any>} - Response from the plan builder chat endpoint
 */
export async function postPlanBuilderChat(payload) {
  return postJSON('/api/plan-builder/chat', payload);
}

/**
 * Generate blueprint from plan builder
 * @param {object} payload - Generation payload containing recordId, planId, etc.
 * @returns {Promise<any>} - Response from the plan builder generate endpoint
 */
export async function postPlanBuilderGenerate(payload) {
  return postJSON('/api/plan-builder/generate', payload);
}

/**
 * Save blueprint edits (no regeneration)
 * @param {object} payload - Save payload containing recordId and planState
 * @returns {Promise<any>} - Response from the plan builder save endpoint
 */
export async function postPlanBuilderSave(payload) {
  return postJSON('/api/plan-builder/save', payload);
}

/**
 * Reset plan builder session
 * @param {string} sessionId - Session ID to reset
 * @returns {Promise<void>}
 */
export async function resetPlanBuilderSession(sessionId) {
  try {
    await postJSON('/api/plan-builder/reset', { sessionId });
  } catch (e) {
    console.warn('Reset endpoint not available, clearing client state only.');
  }
}






