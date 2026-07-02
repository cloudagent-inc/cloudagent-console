import { fetchAuthSession } from 'aws-amplify/auth';
import { BACKEND_API_ENDPOINT } from '../config/appConfig';

// Centralized Ops endpoint
export const OPS_EXECUTE_ENDPOINT = `${BACKEND_API_ENDPOINT}/ops/execute`;

function redactAuthHeader(value) {
  if (!value || typeof value !== 'string') return value;
  if (!value.startsWith('Bearer ')) return value;
  return `Bearer ${value.slice(7, 27)}...`;
}

export async function executeOperation(operationId, params, initOverrides = {}, handlers = {}) {
  let idToken;
  try {
    const session = await fetchAuthSession();
    idToken = session?.tokens?.idToken?.toString();
  } catch (_) {
    // proceed without Authorization header
  }

  const {
    onEvent,
    onToken,
    onToolEvent,
    onFinalText,
    onOperationFinal,
    onDone,
  } = handlers || {};

  const payload = { operationId, params };
  const { headers: overrideHeaders = {}, ...fetchOverrides } = initOverrides || {};
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    ...overrideHeaders,
  };

  const safeHeaders = {
    ...headers,
    ...(headers.Authorization ? { Authorization: redactAuthHeader(headers.Authorization) } : {}),
  };

  const res = await fetch(OPS_EXECUTE_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    ...fetchOverrides,
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
    tokens: '',
    finalText: '',
    toolEvents: [],
    operationFinal: null,
    done: null,
  };

  const emitEvent = (eventType, data) => {
    if (typeof onEvent === 'function') {
      try {
        onEvent(eventType, data);
      } catch (error) {
        console.warn('[Ops.executeOperation] onEvent handler failed', error);
      }
    }

    switch (eventType) {
      case 'hello':
        summary.hello = data;
        break;
      case 'token': {
        const token =
          typeof data === 'string'
            ? data
            : data?.delta ?? data?.token ?? data?.text ?? data?.content ?? '';
        if (token) {
          summary.tokens += token;
          if (typeof onToken === 'function') {
            try {
              onToken(token, summary.tokens);
            } catch (error) {
              console.warn('[Ops.executeOperation] onToken handler failed', error);
            }
          }
        }
        break;
      }
      case 'tool_call':
      case 'tool_result': {
        summary.toolEvents.push({ type: eventType, data });
        if (typeof onToolEvent === 'function') {
          try {
            onToolEvent(eventType, data);
          } catch (error) {
            console.warn('[Ops.executeOperation] onToolEvent handler failed', error);
          }
        }
        break;
      }
      case 'final_text': {
        const text =
          typeof data === 'string'
            ? data
            : data?.text ?? data?.content ?? summary.tokens ?? '';
        if (text) {
          summary.finalText = text;
          if (typeof onFinalText === 'function') {
            try {
              onFinalText(text, data);
            } catch (error) {
              console.warn('[Ops.executeOperation] onFinalText handler failed', error);
            }
          }
        }
        break;
      }
      case 'operation_final': {
        summary.operationFinal = data;
        if (typeof onOperationFinal === 'function') {
          try {
            onOperationFinal(data);
          } catch (error) {
            console.warn('[Ops.executeOperation] onOperationFinal handler failed', error);
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
            console.warn('[Ops.executeOperation] onDone handler failed', error);
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

  const finalEnvelope =
    summary.operationFinal ?? summary.done?.payload ?? summary.done ?? summary.finalText ?? null;

  let finalBody = finalEnvelope;
  if (typeof finalBody === 'string') {
    try {
      finalBody = JSON.parse(finalBody);
    } catch (_) {
      // keep as string
    }
  }

  if (finalBody && typeof finalBody === 'object' && 'ok' in finalBody && !('success' in finalBody)) {
    finalBody = {
      ...finalBody,
      success: !!finalBody.ok,
      message:
        finalBody.message ??
        finalBody.text ??
        (typeof finalBody.error === 'string' ? finalBody.error : ''),
    };
  }

  if (!finalBody || typeof finalBody !== 'object') {
    finalBody = {
      success: summary.done?.ok ?? summary.operationFinal?.success ?? false,
      message:
        summary.finalText ||
        summary.tokens ||
        (typeof summary.done?.text === 'string' ? summary.done.text : ''),
    };
  }

  const finalOperationId =
    summary.operationFinal?.operationId ??
    summary.done?.operationId ??
    summary.hello?.operationId ??
    operationId ??
    null;

  return {
    status: res.status,
    body: finalBody,
    meta: {
      operationId: finalOperationId,
      finalText: summary.finalText || summary.tokens || null,
      toolEvents: summary.toolEvents,
      done: summary.done,
      hello: summary.hello,
    },
  };
}

// Specific helper for permission profile validation
export async function validatePermissionProfile({ workloadId, permissions }, handlers = {}) {
  const currentTimestamp = new Date().toISOString();
  const result = await executeOperation('permission-profile:validate-permissions', {
    workloadId,
    permissions,
    currentTimestamp,
  }, {}, handlers);

  if (result && typeof result === 'object' && result.body && typeof result.body === 'object') {
    const raw =
      result.body.permissionsValid !== undefined
        ? result.body.permissionsValid
        : result.body.success !== undefined
          ? result.body.success
          : undefined;
    if (raw !== undefined) {
      const normalized = typeof raw === 'boolean' ? raw : !!raw;
      result.body = {
        ...result.body,
        permissionsValid: normalized,
      };
    }
  }

  return result;
}

export async function prefillBlueprintFormValues({ plan, defaultValues, targetResources, fieldNames }, handlers = {}) {
  if (!plan) {
    throw new Error('plan is required');
  }
  if (!defaultValues || typeof defaultValues !== 'string') {
    throw new Error('defaultValues (string) is required');
  }
  if (!targetResources || !Array.isArray(targetResources) || targetResources.length === 0) {
    throw new Error('targetResources (non-empty array) is required');
  }

  const result = await executeOperation('blueprint:update-defaults-from-recommendation', {
    plan: typeof plan === 'string' ? plan : JSON.stringify(plan),
    defaultValues,
    targetResources,
    ...(fieldNames && Object.keys(fieldNames).length > 0 ? { fieldNames } : {}),
  }, {}, handlers);

  // Parse the details if it's a string
  if (result && typeof result === 'object' && result.body && typeof result.body === 'object') {
    if (result.body.details && typeof result.body.details === 'string') {
      try {
        result.body.details = JSON.parse(result.body.details);
      } catch (e) {
        console.warn('[prefillBlueprintFormValues] Failed to parse details:', e);
      }
    }
  }

  return result;
}

export async function updatePermissionProfilePermissions({ workloadId, roleName, policy, temporaryAccessHours }, handlers = {}) {
  if (!workloadId) {
    throw new Error('workloadId is required');
  }
  if (!roleName) {
    throw new Error('roleName is required');
  }
  if (!policy || typeof policy !== 'object') {
    throw new Error('policy (JSON object) is required');
  }

  const newPermissions = {
    policy,
  };

  const parsedHours = temporaryAccessHours !== undefined ? parseInt(temporaryAccessHours, 10) : NaN;

  if (!Number.isNaN(parsedHours) && parsedHours > 0) {
    const currentTimestamp = new Date();
    currentTimestamp.setHours(currentTimestamp.getHours() + parsedHours);

    newPermissions.condition = {
      DateLessThan: {
        'aws:CurrentTime': currentTimestamp.toISOString(),
      },
    };

    newPermissions.message =
      'Apply the provided condition to every Allow statement that you add to enforce temporary access.';
  }

  return executeOperation('permission-profile:update-permissions', {
    workloadId,
    roleName,
    newPermissions,
  }, {}, handlers);
}

// Create a skill plan for a recommendation
export async function createBlueprint({ planId, planDescription, planTitle, cloudProvider = 'aws' }) {
  return executeOperation('blueprint:create', {
    planId,
    planDescription,
    planTitle,
    cloudProvider,
  });
}

export function normalizeWorkloadId(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;

  const lower = normalized.toLowerCase();
  if (
    ['omit', ':omit', ':omit:', 'null', 'undefined', 'none', 'new', 'auto', 'n/a', 'na'].includes(lower) ||
    /^:[a-z_]+:?$/i.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

// Create a workload for a permission profile and return success + workloadId/message
export async function createPermissionProfileWorkload({ permissionProfileId, accountId, stackArn }) {
  const safePermissionProfileId = String(permissionProfileId || '').trim();
  const safeAccountId = String(accountId || '').trim();
  const safeStackArn = String(stackArn || '').trim();

  if (!safePermissionProfileId) {
    return { success: false, message: 'Permission profile ID is required to create a workload' };
  }
  if (!safeAccountId || !safeStackArn) {
    return { success: false, message: 'Account ID and stack ARN are required to create a workload' };
  }

  const { body } = await executeOperation('permission-profile:create-workload', {
    permissionProfileId: safePermissionProfileId,
    accountId: safeAccountId,
    stackArn: safeStackArn,
  });

  const success = !!body?.success;
  const message = body?.message || '';
  let workloadId = body?.workloadId;

  if (success) {
    const detailsRaw = body?.details;
    if (typeof detailsRaw === 'string') {
      try {
        const parsed = JSON.parse(detailsRaw);
        workloadId = parsed?.workloadId;
      } catch (_) {
        // ignore parse error, keep workloadId undefined
      }
    } else if (detailsRaw && typeof detailsRaw === 'object') {
      workloadId = detailsRaw?.workloadId;
    }
  }

  const normalizedWorkloadId = normalizeWorkloadId(workloadId);

  return success
    ? normalizedWorkloadId
      ? { success: true, workloadId: normalizedWorkloadId, message }
      : { success: false, message: message || 'Workload creation did not return a valid workload ID' }
    : { success: false, message: message || 'Operation failed' };
}
