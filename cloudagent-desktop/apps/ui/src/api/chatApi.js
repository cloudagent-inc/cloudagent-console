import { fetchAuthSession } from 'aws-amplify/auth';
import { BACKEND_API_ENDPOINT } from '../config/appConfig';
import { getRuntimeApiUrl, isLocalRuntime } from '@/runtime/cloudAgentRuntime';

// Backend server configuration

export const CHAT_SERVER_URL = BACKEND_API_ENDPOINT;
const chatUrl = (path) => getRuntimeApiUrl(path, { fallbackApiBaseUrl: CHAT_SERVER_URL });


/**
 * Builds authentication headers for chat API requests
 * @returns {Promise<Object>} Headers object with Authorization if available
 */
const buildAuthHeaders = async () => {
  if (isLocalRuntime()) return {};
  try {
    const session = await fetchAuthSession().catch(() => null);
    const idToken = session?.tokens?.idToken?.toString();
    if (idToken) {
      return { Authorization: `Bearer ${idToken}` };
    } else {
      console.warn('No Cognito ID token found; proceeding without Authorization header');
    }
  } catch (error) {
    console.warn('Failed to fetch auth session:', error);
  }
  return {};
};

/**
 * SSE (Server-Sent Events) iterator for parsing streaming responses
 * @param {ReadableStream} stream - The response stream
 * @returns {AsyncGenerator<{event: string, data: any}>}
 */
async function* sseIterator(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (!frame.trim()) continue;

      let event = 'message';
      const datas = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) datas.push(line.slice(5));
      }
      const raw = datas.join('\n'); // multiple data: lines allowed
      let payload = null;
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = raw;
      }
      yield { event, data: payload };
    }
  }
}

/**
 * Send message to chat backend with streaming support
 * 
 * @param {Object} params
 * @param {string} params.sessionId - Session ID for the chat
 * @param {string} params.message - User message to send
 * @param {string} [params.previousResponseId] - Previous response ID for conversation continuity
 * @param {Object} [params.sessionContext] - Session context (environments, workloads, reports, notes)
 * 
 * @param {Object} handlers - Event handlers for streaming
 * @param {Function} handlers.onToken - Called for each token chunk: (fullResponse, activeTools) => void
 * @param {Function} handlers.onToolCall - Called when a tool starts: (toolName) => void
 * @param {Function} handlers.onToolResult - Called when a tool completes: (toolName) => void
 * @param {Function} handlers.onFinal - Called with final response: (fullResponse, responseId) => void
 * @param {Function} handlers.onDone - Called when stream completes: () => void
 * @param {Function} handlers.onContextUpdate - Called when session context updates: (payload) => void
 * 
 * @returns {Promise<{message: string, responseId: string|null}>}
 */
export async function sendChatMessage(params, handlers = {}) {
  const { sessionId, message, previousResponseId, sessionContext } = params;
  const { onToken, onToolCall, onToolResult, onFinal, onDone, onContextUpdate } = handlers;

  if (!sessionId) {
    throw new Error('Session ID is required');
  }

  if (!message || !message.trim()) {
    throw new Error('Message is required');
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(await buildAuthHeaders()),
  };

  const response = await fetch(chatUrl('/api/chat'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sessionId,
      message,
      previousResponseId: previousResponseId || undefined,
      sessionContext: sessionContext || undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // Check if response is streaming
  const contentType = response.headers.get('content-type');
  
  // Try streaming first (either based on content-type or as fallback)
  if (contentType && (contentType.includes('text/plain') || contentType.includes('text/event-stream'))) {
    // Handle Server-Sent Events (SSE) streaming response
    let fullResponse = '';
    let latestResponseId = null;

    for await (const { event, data } of sseIterator(response.body)) {
      if (event === 'token') {
        const token = typeof data === 'string' ? data : (data && data.token) || '';
        if (token) {
          fullResponse += token;
          if (onToken) onToken(fullResponse);
        }
      } else if (event === 'tool_call') {
        const name = (data && data.name) || 'tool';
        if (onToolCall) onToolCall(name);
      } else if (event === 'tool_result') {
        const name = (data && data.name) || 'tool';
        if (onToolResult) onToolResult(name);
      } else if (event === 'final') {
        const text = typeof data === 'string' ? data : (data && data.text) || '';
        const respId = typeof data === 'string' ? null : (data && data.responseId) || null;
        fullResponse = text;
        latestResponseId = respId;
        if (onFinal) onFinal(fullResponse, latestResponseId);
      } else if (event === 'context_update') {
        if (onContextUpdate) onContextUpdate(data);
      } else if (event === 'done') {
        if (onDone) onDone();
      }
    }

    return { message: fullResponse, responseId: latestResponseId };
  } else {
    // Handle regular JSON response
    const data = await response.json();
    return data;
  }
}

export async function prepareReportFile(params) {
  const { reportId, scanId, permissionProfileId } = params || {};
  const headers = {
    'Content-Type': 'application/json',
    ...(await buildAuthHeaders()),
  };

  const response = await fetch(chatUrl('/api/report/prepare'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      reportId: reportId || undefined,
      scanId: scanId || undefined,
      permissionProfileId: permissionProfileId || undefined,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function prepareHealthFindingsFile(params) {
  const {
    findings,
    reviewKind,
    targetType,
    targetId,
    targetName,
    permissionProfileId,
    workloadId,
  } = params || {};

  const headers = {
    'Content-Type': 'application/json',
    ...(await buildAuthHeaders()),
  };

  const response = await fetch(chatUrl('/api/health/prepare'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      findings: findings === undefined ? undefined : findings,
      reviewKind: reviewKind || undefined,
      targetType: targetType || undefined,
      targetId: targetId || undefined,
      targetName: targetName || undefined,
      permissionProfileId: permissionProfileId || undefined,
      workloadId: workloadId || undefined,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}
