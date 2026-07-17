import { getRuntimeApiUrl } from '@/runtime/cloudAgentRuntime';

const commandCenterUrl = (path) => getRuntimeApiUrl(path);

async function buildAuthHeaders() {
  return {};
}

async function requestJson(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(await buildAuthHeaders()),
    ...(options.headers || {}),
  };

  const response = await fetch(commandCenterUrl(path), {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body?.message || body?.error || `HTTP error ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const raw = await response.text().catch(() => '');
    if (raw.includes('ERR_NGROK_6024') || raw.includes('ngrok')) {
      throw new Error('Ngrok interstitial blocked the request. Ensure ngrok allows browser API traffic for this domain.');
    }
    throw new Error(`Unexpected response content type: ${contentType || 'unknown'}`);
  }

  return response.json();
}

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
      const raw = datas.join('\n');
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

export async function getCommandCenterBootstrap({ goalId, chatId, personalization } = {}) {
  if (personalization && typeof personalization === 'object') {
    return requestJson('/v1/command-center/bootstrap', {
      method: 'POST',
      body: JSON.stringify({ goalId, chatId, personalization }),
    });
  }

  const params = new URLSearchParams();
  if (goalId) params.set('goalId', goalId);
  if (chatId) params.set('chatId', chatId);
  const query = params.toString();
  const path = `/v1/command-center/bootstrap${query ? `?${query}` : ''}`;
  return requestJson(path, { method: 'GET' });
}

export async function getCommandCenterState({ chatId } = {}) {
  const params = new URLSearchParams();
  if (chatId) params.set('chatId', chatId);
  const query = params.toString();
  const path = `/v1/command-center/state${query ? `?${query}` : ''}`;
  return requestJson(path, { method: 'GET' });
}

export async function generateCommandCenterTitle({
  chatId,
  recordId,
  milestone,
  currentTitle,
  agentRunner,
  messages,
} = {}) {
  return requestJson('/v1/command-center/title', {
    method: 'POST',
    body: JSON.stringify({
      chatId,
      recordId,
      milestone,
      currentTitle,
      agentRunner,
      messages: Array.isArray(messages) ? messages : [],
    }),
  });
}

export async function sendCommandCenterMessage(
  { chatId, goalId, message, previousResponseId, agentRunner, externalAgentSession },
  handlers = {}
) {
  const { onToken, onToolCall, onToolResult, onTerminalEvent, onFinal, onDone } = handlers;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'ngrok-skip-browser-warning': 'true',
    ...(await buildAuthHeaders()),
  };

  const response = await fetch(commandCenterUrl('/v1/chat/send'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ chatId, goalId, message, previousResponseId, agentRunner, externalAgentSession }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const messageText = body?.message || body?.error || `HTTP error ${response.status}`;
    const error = new Error(messageText);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
    let fullResponse = '';
    let finalPayload = null;

    for await (const { event, data } of sseIterator(response.body)) {
      if (event === 'token') {
        const token = typeof data === 'string' ? data : (data && data.token) || '';
        if (token) {
          fullResponse += token;
          if (onToken) onToken(fullResponse);
        }
      } else if (event === 'tool_call') {
        if (onToolCall) onToolCall(data && typeof data === 'object' ? data : { name: 'tool' });
      } else if (event === 'tool_result') {
        if (onToolResult) onToolResult(data && typeof data === 'object' ? data : { name: 'tool' });
      } else if (event === 'terminal') {
        if (onTerminalEvent) onTerminalEvent(data && typeof data === 'object' ? data : {});
      } else if (event === 'final') {
        if (data && typeof data === 'object' && data.assistantMessage) {
          finalPayload = data;
          const text = typeof data.assistantMessage?.text === 'string' ? data.assistantMessage.text : '';
          if (text) fullResponse = text;
        } else {
          const text = typeof data === 'string' ? data : (data && data.text) || '';
          const responseId = typeof data === 'string' ? null : (data && data.responseId) || null;
          fullResponse = text || fullResponse;
          finalPayload = {
            assistantMessage: {
              id: `msg_${Date.now()}`,
              text: fullResponse,
              blocks: [],
              tools: [],
              toolExecutions: [],
              contextEvents: [],
            },
            responseId,
          };
        }
        if (onFinal) onFinal(finalPayload);
      } else if (event === 'done') {
        if (onDone) onDone();
      }
    }

    if (!finalPayload) {
      finalPayload = {
        assistantMessage: {
          id: `msg_${Date.now()}`,
          text: fullResponse,
          blocks: [],
          tools: [],
          toolExecutions: [],
          contextEvents: [],
        },
        responseId: null,
      };
    }
    return finalPayload;
  }

  if (!contentType.includes('application/json')) {
    const raw = await response.text().catch(() => '');
    if (raw.includes('ERR_NGROK_6024') || raw.includes('ngrok')) {
      throw new Error('Ngrok interstitial blocked the request. Ensure ngrok allows browser API traffic for this domain.');
    }
    throw new Error(`Unexpected response content type: ${contentType || 'unknown'}`);
  }

  return response.json();
}

export async function sendCommandCenterIntent({ chatId, intent, payload }) {
  return requestJson('/v1/command-center/intent', {
    method: 'POST',
    body: JSON.stringify({ chatId, intent, payload }),
  });
}

export async function runCommandCenterGuardrailCheck({ chatId, planId }) {
  // Deprecated for Command Center UI; kept for backward compatibility.
  return requestJson('/v1/command-center/guardrails/check', {
    method: 'POST',
    body: JSON.stringify({ chatId, planId }),
  });
}
