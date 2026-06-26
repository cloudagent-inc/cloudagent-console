import { fetchAuthSession } from 'aws-amplify/auth';
import { BACKEND_API_ENDPOINT } from '../config/appConfig';
import { getRuntimeApiUrl, isLocalRuntime } from '@/runtime/cloudAgentRuntime';

// Workload Discovery API endpoint
export const WORKLOAD_DISCOVERY_ENDPOINT = `${BACKEND_API_ENDPOINT}/ops/workload-discovery/chat`;
const workloadDiscoveryUrl = () =>
  getRuntimeApiUrl('/ops/workload-discovery/chat', {
    fallbackApiBaseUrl: BACKEND_API_ENDPOINT,
  });

function redactAuthHeader(value) {
  if (!value || typeof value !== 'string') return value;
  if (!value.startsWith('Bearer ')) return value;
  return `Bearer ${value.slice(7, 27)}...`;
}

/**
 * Sends a chat message to the workload discovery API
 * @param {Object} params - Request parameters
 * @param {string} [params.sessionId] - Session ID for follow-up messages
 * @param {string} [params.message] - Chat message (required on follow-ups)
 * @param {string} [params.cloudProvider] - Cloud provider for discovery ('aws' or 'azure')
 * @param {string} params.permissionProfileId - Permission profile ID (required)
 * @param {string} [params.subscriptionId] - Azure subscription ID to scope discovery
 * @param {string[]} [params.services] - AWS services to scan (required on first request)
 * @param {string[]} [params.regions] - AWS regions to scan (required on first request)
 * @param {string} [params.environmentNotes] - Optional description/notes about the environment to improve discovery
 * @param {boolean} [params.forceInventoryScan] - Force a new inventory scan even when recent cached inventory exists
 * @param {string} [params.previousResponseId] - Previous response ID for continuity
 * @param {Array} [params.workloads] - Current workloads array (optional, sent with every chat message)
 * @param {Object} handlers - Event handlers for SSE events
 * @returns {Promise<Object>} Response object with status and body
 */
export async function sendWorkloadDiscoveryChat(params = {}, handlers = {}) {
  const {
    sessionId,
    message,
    cloudProvider,
    permissionProfileId,
    subscriptionId,
    services,
    regions,
    environmentNotes,
    forceInventoryScan,
    previousResponseId,
    workloads,
  } = params;

  if (!permissionProfileId) {
    throw new Error('permissionProfileId is required');
  }

  // Get auth token
  let idToken;
  if (!isLocalRuntime()) {
    try {
      const session = await fetchAuthSession();
      idToken = session?.tokens?.idToken?.toString();
    } catch (_) {
      // proceed without Authorization header
    }
  }

  const {
    onEvent,
    onHello,
    onScanStart,
    onInventorySaved,
    onScanData,
    onScanComplete,
    onAgentStart,
    onToolCall,
    onToolResult,
    onDiscoveryComplete,
    onFinal,
    onDone,
    onError,
  } = handlers || {};

  const payload = {
    ...(sessionId ? { sessionId } : {}),
    ...(message ? { message } : {}),
    ...(cloudProvider ? { cloudProvider } : {}),
    permissionProfileId,
    ...(subscriptionId ? { subscriptionId } : {}),
    ...(services && Array.isArray(services) && services.length > 0 ? { services } : {}),
    ...(regions && Array.isArray(regions) && regions.length > 0 ? { regions } : {}),
    ...(typeof environmentNotes === 'string' && environmentNotes.trim()
      ? { environmentNotes: environmentNotes.trim() }
      : {}),
    ...(typeof forceInventoryScan === 'boolean' ? { forceInventoryScan } : {}),
    ...(previousResponseId ? { previousResponseId } : {}),
    ...(workloads && Array.isArray(workloads) ? { workloads } : {}),
  };

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
  };

  const safeHeaders = {
    ...headers,
    ...(headers.Authorization ? { Authorization: redactAuthHeader(headers.Authorization) } : {}),
  };

  const res = await fetch(workloadDiscoveryUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed with status ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  const isStream =
    !!res.body && (contentType.includes('text/event-stream') || contentType.includes('text/plain'));

  if (!isStream) {
    let responseBody;
    try {
      responseBody = contentType.includes('application/json') ? await res.json() : await res.text();
    } catch (_) {
      responseBody = undefined;
    }
    return { status: res.status, body: responseBody };
  }

  const summary = {
    hello: null,
    scanEvents: [],
    toolEvents: [],
    discoveryComplete: null,
    final: null,
    done: null,
    error: null,
  };

  const emitEvent = (eventType, data) => {
    if (typeof onEvent === 'function') {
      try {
        onEvent(eventType, data);
      } catch (error) {
        console.warn('[WorkloadDiscoveryApi.sendWorkloadDiscoveryChat] onEvent handler failed', error);
      }
    }

    switch (eventType) {
      case 'hello':
        summary.hello = data;
        if (typeof onHello === 'function') {
          try {
            onHello(data);
          } catch (error) {
            console.warn('[WorkloadDiscoveryApi.sendWorkloadDiscoveryChat] onHello handler failed', error);
          }
        }
        break;
      case 'scan_start':
      case 'inventory_saved':
      case 'scan_data':
      case 'upload_*':
      case 'scan_complete':
        summary.scanEvents.push({ type: eventType, data });
        if (typeof onScanStart === 'function' && eventType === 'scan_start') {
          try {
            onScanStart(data);
          } catch (error) {
            console.warn('[WorkloadDiscoveryApi.sendWorkloadDiscoveryChat] onScanStart handler failed', error);
          }
        }
        if (typeof onInventorySaved === 'function' && eventType === 'inventory_saved') {
          try {
            onInventorySaved(data);
          } catch (error) {
            console.warn('[WorkloadDiscoveryApi.sendWorkloadDiscoveryChat] onInventorySaved handler failed', error);
          }
        }
        if (typeof onScanData === 'function' && eventType === 'scan_data') {
          try {
            onScanData(data);
          } catch (error) {
            console.warn('[WorkloadDiscoveryApi.sendWorkloadDiscoveryChat] onScanData handler failed', error);
          }
        }
        if (typeof onScanComplete === 'function' && eventType === 'scan_complete') {
          try {
            onScanComplete(data);
          } catch (error) {
            console.warn('[WorkloadDiscoveryApi.sendWorkloadDiscoveryChat] onScanComplete handler failed', error);
          }
        }
        break;
      case 'agent_start':
        if (typeof onAgentStart === 'function') {
          try {
            onAgentStart(data);
          } catch (error) {
            console.warn('[WorkloadDiscoveryApi.sendWorkloadDiscoveryChat] onAgentStart handler failed', error);
          }
        }
        break;
      case 'tool_call':
      case 'tool_result': {
        summary.toolEvents.push({ type: eventType, data });
        if (typeof onToolCall === 'function' && eventType === 'tool_call') {
          try {
            onToolCall(data);
          } catch (error) {
            console.warn('[WorkloadDiscoveryApi.sendWorkloadDiscoveryChat] onToolCall handler failed', error);
          }
        }
        if (typeof onToolResult === 'function' && eventType === 'tool_result') {
          try {
            onToolResult(data);
          } catch (error) {
            console.warn('[WorkloadDiscoveryApi.sendWorkloadDiscoveryChat] onToolResult handler failed', error);
          }
        }
        break;
      }
      case 'discovery_complete': {
        summary.discoveryComplete = data;
        if (typeof onDiscoveryComplete === 'function') {
          try {
            onDiscoveryComplete(data);
          } catch (error) {
            console.warn('[WorkloadDiscoveryApi.sendWorkloadDiscoveryChat] onDiscoveryComplete handler failed', error);
          }
        }
        break;
      }
      case 'final': {
        summary.final = data;
        if (typeof onFinal === 'function') {
          try {
            onFinal(data);
          } catch (error) {
            console.warn('[WorkloadDiscoveryApi.sendWorkloadDiscoveryChat] onFinal handler failed', error);
          }
        }
        break;
      }
      case 'done': {
        summary.done = data;
        if (typeof onDone === 'function') {
          try {
            onDone(data);
          } catch (error) {
            console.warn('[WorkloadDiscoveryApi.sendWorkloadDiscoveryChat] onDone handler failed', error);
          }
        }
        break;
      }
      case 'error': {
        summary.error = data;
        if (typeof onError === 'function') {
          try {
            onError(data);
          } catch (error) {
            console.warn('[WorkloadDiscoveryApi.sendWorkloadDiscoveryChat] onError handler failed', error);
          }
        }
        break;
      }
      default:
        break;
    }
  };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const processBuffer = () => {
    buffer = buffer.replace(/\r/g, '');
    let separatorIndex = buffer.indexOf('\n\n');
    while (separatorIndex >= 0) {
      const frame = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      separatorIndex = buffer.indexOf('\n\n');
      if (!frame.trim()) continue;

      let eventType = 'message';
      const dataLines = [];

      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5));
        }
      }

      const rawData = dataLines.join('\n');
      let parsedData = rawData;
      if (rawData) {
        try {
          parsedData = JSON.parse(rawData);
        } catch (_) {
          parsedData = rawData;
        }
      } else {
        parsedData = null;
      }

      emitEvent(eventType, parsedData);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    processBuffer();
  }

  buffer += decoder.decode();
  processBuffer();

  if (summary.error) {
    const message =
      summary.error?.error ||
      summary.error?.message ||
      'Workload discovery failed';
    const error = new Error(message);
    error.body = summary.error;
    throw error;
  }

  const finalBody = summary.final ?? summary.discoveryComplete ?? summary.done ?? null;

  return {
    status: res.status,
    body: finalBody,
    meta: {
      sessionId: summary.hello?.sessionId,
      discoveryComplete: summary.discoveryComplete,
      final: summary.final,
      done: summary.done,
      scanEvents: summary.scanEvents,
      toolEvents: summary.toolEvents,
      error: summary.error,
    },
  };
}
