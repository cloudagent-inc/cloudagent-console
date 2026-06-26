import { fetchAuthSession } from 'aws-amplify/auth';
import { BACKEND_API_ENDPOINT } from '../config/appConfig';
import { getRuntimeApiUrl, isLocalRuntime } from '@/runtime/cloudAgentRuntime';

const getAgentUrl = () =>
  getRuntimeApiUrl('/agent', { fallbackApiBaseUrl: BACKEND_API_ENDPOINT });

const getAgentConnectionsUrl = () => `${getAgentUrl()}/connections`;

class AgentApiHttpError extends Error {
  constructor(message, { status, statusText, errorCode, details } = {}) {
    super(message);
    this.name = 'AgentApiHttpError';
    this.status = status;
    this.statusText = statusText;
    this.errorCode = errorCode;
    this.details = details;
    this.isHttpError = true;
  }
}

const parseErrorPayload = async (response) => {
  try {
    const raw = await response.text();
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return raw;
    }
  } catch (error) {
    console.warn('[Agent API] Failed to read error payload:', error);
    return null;
  }
};

const buildAuthHeaders = async () => {
  if (isLocalRuntime()) {
    return {};
  }

  try {
    const session = await fetchAuthSession();
    const idToken = session?.tokens?.idToken?.toString();
    if (idToken) {
      return { Authorization: `Bearer ${idToken}` };
    }
  } catch (_) {
    // ignore missing auth
  }
  return {};
};

const parseResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json().catch(() => null);
  }

  const text = await response.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
};

const handleResponse = async (response) => {
  const data = await parseResponse(response);
  if (!response.ok) {
    const message =
      (typeof data === 'object' && data?.message) ||
      (typeof data === 'string' && data) ||
      `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.details = data;
    error.status = response.status;
    throw error;
  }
  return data;
};

/**
 * Stream agent API call with chunk-based response handling
 * 
 * @param {Object} params
 * @param {string} params.query - The query/message to send
 * @param {Object} params.task - Task object (optional)
 * @param {string} params.sessionId - Session ID
 * @param {Object} params.authProfile - Auth profile object
 * @param {string} params.accountId - AWS account ID
 * @param {string} params.planId - Plan ID (for non-blueprint)
 * @param {Object} params.plan - Plan object (for blueprint: {title, credits, plan})
 * 
 * @param {Object} handlers - Event handlers
 * @param {Function} handlers.onChunk - Called for each parsed chunk: (chunk, answerIndex) => void
 * @param {Function} handlers.onLoadingChange - Called when loading state changes: (loading) => void
 * @param {Function} handlers.onError - Called on error: (error) => void
 * @param {Function} handlers.onStarted - Called once the backend accepts the run and starts streaming
 * @param {Function} handlers.onComplete - Called when stream completes: () => void
 * 
 * @returns {Promise<void>}
 */
export async function streamAgentCall(params, handlers = {}) {
  const {
    query,
    task = null,
    sessionId,
    authProfile,
    accountId,
    planId,
    blueprintId,
    plan,
    recordId,
    configurationMode,
    stackAction,
    executionPreferences,
    defaultValues,
    regions,
    additionalInstructions,
    existingStack,
    existingStacks,
    permissionProfileId,
    selectedWorkloadOrStack,
    recommendationContext,
    preflightAnswer,
    executionMode,
    runner,
  } = params;

  const {
    onChunk,
    onLoadingChange,
    onError,
    onStarted,
    onComplete,
  } = handlers;

  // Get Cognito token
  let idToken;
  if (!isLocalRuntime()) {
    try {
      const session = await fetchAuthSession();
      idToken = session?.tokens?.idToken?.toString();
    } catch (_) {
      // proceed without Authorization header
    }
  }

  // Build request body
  const body = {
    query,
    task,
    authProfile,
    accountId,
    sessionId,
    ...(plan ? { plan } : { planId }),
    ...(blueprintId ? { blueprintId } : {}),
    ...(recordId ? { recordId } : {}),
    ...(configurationMode ? { configurationMode } : {}),
    ...(stackAction ? { stackAction } : {}),
    ...(executionPreferences ? { executionPreferences } : {}),
    ...(defaultValues ? { defaultValues } : {}),
    ...(regions && regions.length > 0 ? { regions } : {}),
    ...(additionalInstructions ? { additionalInstructions } : {}),
    ...(existingStack ? { existingStack } : {}),
    ...(existingStacks && existingStacks.length > 0 ? { existingStacks } : {}),
    ...(permissionProfileId ? { permissionProfileId } : {}),
    ...(selectedWorkloadOrStack ? { selectedWorkloadOrStack } : {}),
    ...(recommendationContext ? { recommendationContext } : {}),
    ...(preflightAnswer ? { preflightAnswer } : {}),
    ...(executionMode ? { executionMode } : {}),
    ...(runner ? { runner } : {}),
  };

  try {
    // Set loading state
    if (onLoadingChange) onLoadingChange(true);

    if (!sessionId) {
      throw new AgentApiHttpError('Session ID is required before calling the agent.', {
        status: 400,
        errorCode: 'SESSION_ID_REQUIRED',
      });
    }

    if (!plan && !planId) {
      throw new AgentApiHttpError('Plan ID or plan payload is required for this request.', {
        status: 400,
        errorCode: 'PLAN_ID_OR_PLAN_REQUIRED',
      });
    }

    const response = await fetch(getAgentUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorPayload = await parseErrorPayload(response);
      const errorMessage =
        (typeof errorPayload === 'object' && errorPayload?.message) ||
        (typeof errorPayload === 'string' && errorPayload) ||
        `Request failed with status ${response.status}`;
      throw new AgentApiHttpError(errorMessage, {
        status: response.status,
        statusText: response.statusText,
        errorCode:
          (typeof errorPayload === 'object' &&
            (errorPayload.errorCode || errorPayload.code)) ||
          undefined,
        details: errorPayload,
      });
    }

    if (!response.body || typeof response.body.getReader !== 'function') {
      throw new AgentApiHttpError('The agent response did not provide a readable stream.', {
        status: response.status,
        statusText: response.statusText,
        errorCode: 'STREAM_UNAVAILABLE',
      });
    }

    if (onStarted) onStarted();

    // Stream processing
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (onLoadingChange) onLoadingChange(false);
        if (onComplete) onComplete();
        break;
      }

      // Decode chunk
      const decodedChunk = decoder.decode(value, { stream: true });
      buffer += decodedChunk;

      // Drop data before first marker
      const firstMarkerIndex = buffer.indexOf('<<CHUNK_START>>');
      if (firstMarkerIndex > 0) {
        buffer = buffer.slice(firstMarkerIndex);
      }

      // Extract complete chunks
      const chunkRegex = /<<CHUNK_START>>(.*?)<<CHUNK_END>>/s;
      let match;
      while ((match = chunkRegex.exec(buffer)) !== null) {
        try {
          const chunkJson = match[1].trim();
          const json = JSON.parse(chunkJson);

          // Call chunk handler (component will handle state updates and logging)
          if (onChunk) {
            onChunk(json, params.answerIndex);
          }

          // Remove processed chunk from buffer
          buffer = buffer.slice(match.index + match[0].length);
        } catch (e) {
          // Wait for more data if parsing fails
          break;
        }
      }
    }
  } catch (error) {
    if (onLoadingChange) onLoadingChange(false);
    if (onError) onError(error);
    throw error;
  }
}

export async function streamCodexAgentRunResume({ recordId, prompt, answerIndex }, handlers = {}) {
  const {
    onChunk,
    onLoadingChange,
    onError,
    onStarted,
    onComplete,
  } = handlers;

  try {
    if (onLoadingChange) onLoadingChange(true);
    if (!recordId) {
      throw new AgentApiHttpError('Record ID is required to resume a Codex run.', {
        status: 400,
        errorCode: 'RECORD_ID_REQUIRED',
      });
    }
    const trimmedPrompt = String(prompt || '').trim();
    if (!trimmedPrompt) {
      throw new AgentApiHttpError('Prompt is required to resume a Codex run.', {
        status: 400,
        errorCode: 'PROMPT_REQUIRED',
      });
    }

    const response = await fetch(
      getRuntimeApiUrl(`/local/codex/agent-runs/${encodeURIComponent(recordId)}/resume`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmedPrompt }),
      }
    );

    if (!response.ok) {
      const errorPayload = await parseErrorPayload(response);
      const errorMessage =
        (typeof errorPayload === 'object' && errorPayload?.message) ||
        (typeof errorPayload === 'object' && errorPayload?.error) ||
        (typeof errorPayload === 'string' && errorPayload) ||
        `Request failed with status ${response.status}`;
      throw new AgentApiHttpError(errorMessage, {
        status: response.status,
        statusText: response.statusText,
        errorCode:
          (typeof errorPayload === 'object' &&
            (errorPayload.errorCode || errorPayload.code)) ||
          undefined,
        details: errorPayload,
      });
    }

    if (!response.body || typeof response.body.getReader !== 'function') {
      throw new AgentApiHttpError('The Codex resume response did not provide a readable stream.', {
        status: response.status,
        statusText: response.statusText,
        errorCode: 'STREAM_UNAVAILABLE',
      });
    }

    if (onStarted) onStarted();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (onLoadingChange) onLoadingChange(false);
        if (onComplete) onComplete();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const firstMarkerIndex = buffer.indexOf('<<CHUNK_START>>');
      if (firstMarkerIndex > 0) {
        buffer = buffer.slice(firstMarkerIndex);
      }

      const chunkRegex = /<<CHUNK_START>>(.*?)<<CHUNK_END>>/s;
      let match;
      while ((match = chunkRegex.exec(buffer)) !== null) {
        try {
          const chunkJson = match[1].trim();
          const json = JSON.parse(chunkJson);
          if (onChunk) onChunk(json, answerIndex);
          buffer = buffer.slice(match.index + match[0].length);
        } catch (_) {
          break;
        }
      }
    }
  } catch (error) {
    if (onLoadingChange) onLoadingChange(false);
    if (onError) onError(error);
    throw error;
  }
}

export const createAgentConnection = async (payload) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(await buildAuthHeaders()),
  };

  const response = await fetch(getAgentConnectionsUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

export const fetchAgentConnection = async (recordId) => {
  if (!recordId) {
    throw new Error('recordId is required to fetch an agent connection');
  }

  const headers = {
    Accept: 'application/json',
    ...(await buildAuthHeaders()),
  };

  const response = await fetch(`${getAgentConnectionsUrl()}/${recordId}`, {
    method: 'GET',
    headers,
  });

  return handleResponse(response);
};

/**
 * Evaluate blueprint compatibility with a configuration method
 * 
 * @param {Object} params
 * @param {string} params.blueprintId - Blueprint ID
 * @param {string} params.configurationMethod - "cloudformation" | "cli"
 * @param {string} [params.stackAction] - "create" | "update" (optional)
 * @param {string[]} [params.existingStacks] - Array of existing stack IDs (optional)
 * @param {string} [params.accountId] - AWS account ID (optional)
 * 
 * @returns {Promise<Object>} - { method_valid: boolean, message: { summary: string, details?: string[] }, raw?: string }
 */
export async function evaluateBlueprint(params) {
  const {
    blueprintId,
    configurationMethod,
    stackAction,
    existingStacks,
    accountId,
  } = params;

  const headers = {
    'Content-Type': 'application/json',
    ...(await buildAuthHeaders()),
  };

  const body = {
    blueprintId,
    configurationMethod,
    ...(stackAction ? { stackAction } : {}),
    ...(existingStacks && existingStacks.length > 0 ? { existingStacks } : {}),
    ...(accountId ? { accountId } : {}),
  };

  const response = await fetch(`${getAgentUrl()}/blueprint-evaluation`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  return handleResponse(response);
}

/**
 * Rewrite blueprint for a specific configuration method
 * 
 * @param {Object} params
 * @param {string} params.blueprintId - Blueprint ID (required)
 * @param {string} params.configurationMode - "cloudformation" | "cli" (required)
 * @param {string} [params.stackAction] - "create" | "update" (optional)
 * @param {Object} [params.executionPreferences] - Optional execution preferences
 * @param {boolean} [params.executionPreferences.useDefaultValuesWithoutConfirmation] - Use default values without confirmation
 * @param {boolean} [params.executionPreferences.applyChangesWithoutConfirmation] - Apply changes without confirmation
 * @param {Object} [params.defaultValues] - Default values object (optional, defaults to {})
 * @param {string[]} [params.regions] - Array of region strings (optional, defaults to [])
 * @param {string} [params.additionalInstructions] - Additional instructions string (optional)
 * @param {string} [params.existingStack] - Existing stack ID (optional)
 * @param {string[]} [params.existingStacks] - Existing stack IDs (optional)
 * @param {string} [params.selectedWorkloadOrStack] - Selected workload or stack target (optional)
 * 
 * @returns {Promise<Object>} - Response from the blueprint rewrite endpoint
 */
export async function rewriteBlueprint(params) {
  const {
    blueprintId,
    configurationMode,
    stackAction,
    executionPreferences,
    defaultValues,
    regions,
    additionalInstructions,
    existingStack,
    existingStacks,
    selectedWorkloadOrStack,
  } = params;

  const headers = {
    'Content-Type': 'application/json',
    ...(await buildAuthHeaders()),
  };

  const body = {
    blueprintId,
    configurationMode,
    ...(stackAction ? { stackAction } : {}),
    executionPreferences: executionPreferences || {
      useDefaultValuesWithoutConfirmation: false,
      applyChangesWithoutConfirmation: false,
    },
    ...(defaultValues ? { defaultValues } : {}),
    ...(regions && regions.length > 0 ? { regions } : {}),
    ...(additionalInstructions ? { additionalInstructions } : {}),
    ...(existingStack ? { existingStack } : {}),
    ...(existingStacks && existingStacks.length > 0 ? { existingStacks } : {}),
    ...(selectedWorkloadOrStack ? { selectedWorkloadOrStack } : {}),
  };

  const response = await fetch(`${getAgentUrl()}/blueprint-rewrite`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  return handleResponse(response);
}

// Export endpoint for reference if needed
export const AGENT_URL = getAgentUrl();
