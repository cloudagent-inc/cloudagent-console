import { post } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import { normalizeWorkflowRunNodes } from '../helpers/workflowRunNormalization';
import { requestJson } from './clients/localHttpClient';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';

// Re-export assessment functions from the new assessments.js module for backward compatibility
export { initiateAssessmentScan, initiateAssessment, initiateAwsAssessment, initiateAzureAssessment, initiateGoogleWorkspaceAssessment } from './assessments';

const SENSITIVE_PAYLOAD_KEY_PATTERN =
  /authorization|password|secret|sessiontoken|session_token|accesstoken|access_token|idtoken|id_token|accesskey|access_key/i;

function redactSensitivePayloadValues(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitivePayloadValues(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      SENSITIVE_PAYLOAD_KEY_PATTERN.test(key)
        ? '[redacted]'
        : redactSensitivePayloadValues(entryValue),
    ])
  );
}

function getUtf8ByteLength(value) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }

  return value.length;
}

function getBase64EncodedLength(byteLength) {
  return Math.ceil(byteLength / 3) * 4;
}

function estimateRunTaskOverrideLength(base64PayloadLength) {
  return JSON.stringify({
    containerOverrides: [
      {
        name: 'run-agent-background',
        environment: [
          {
            name: 'RUN_AGENT_BACKGROUND_EVENT_BASE64',
            value: 'x'.repeat(base64PayloadLength),
          },
          {
            name: 'RUN_AGENT_BACKGROUND_AUTH_USER_ID',
            value: '',
          },
          {
            name: 'RUN_AGENT_BACKGROUND_AUTH_COGNITO_USERNAME',
            value: '',
          },
          {
            name: 'RUN_AGENT_BACKGROUND_AUTH_USERNAME',
            value: '',
          },
          {
            name: 'RUN_AGENT_BACKGROUND_AUTH_SUB',
            value: '',
          },
        ],
      },
    ],
  }).length;
}

function logBackgroundAgentPayloadDiagnostics(payload) {
  const serializedPayload = JSON.stringify(payload);
  const payloadByteLength = getUtf8ByteLength(serializedPayload);
  const base64PayloadLength = getBase64EncodedLength(payloadByteLength);
  const estimatedOverrideLength =
    estimateRunTaskOverrideLength(base64PayloadLength);

  console.log('[runBackgroundAgent] request diagnostics', {
    payloadByteLength,
    base64PayloadLength,
    estimatedOverrideLength,
    ecsOverrideLimit: 8192,
    estimatedOverrideWithinLimit: estimatedOverrideLength <= 8192,
    payload: redactSensitivePayloadValues(payload),
  });
}

export async function validateCreds(authProfile, onSuccess, onError) {
  try {
    if (isLocalRuntime()) {
      const response = await requestJson('/validate-creds', {
        method: 'POST',
        auth: false,
        body: { authProfile },
      });

      if (onSuccess) {
        onSuccess(response.code, response.message);
      }
      return response;
    }

    const session = await fetchAuthSession();
    const idToken = session.tokens.idToken.toString();

    const restOperation = post({
      apiName: 'frontEndAPI',
      path: '/validate-creds',
      options: {
        body: {
          authProfile,
        },
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    });

    const { body } = await restOperation.response;
    const response = await body.json();

    if (onSuccess) {
      onSuccess(response.code, response.message);
    }
  } catch (error) {
    if (onError) {
      onError(error);
    }
  }
}

export async function validateAwsCredentialsV2(
  {
    stackName,
    authProfile,
    ...validationOptions
  },
  onSuccess,
  onError
) {
  try {
    if (isLocalRuntime()) {
      const response = await requestJson('/validateAwsCredentialsV2', {
        method: 'POST',
        auth: false,
        body: {
          authProfile,
          ...(stackName ? { stackName } : {}),
          ...validationOptions,
        },
      });
      console.log('[validateAwsCredentialsV2] local API response', response);

      if (onSuccess) {
        onSuccess(response);
      }
      return response;
    }

    const session = await fetchAuthSession();
    const idToken = session.tokens.idToken.toString();

    const restOperation = post({
      apiName: 'frontEndAPI',
      path: '/validateAwsCredentialsV2',
      options: {
        body: {
          authProfile,
          ...(stackName ? { stackName } : {}),
          ...validationOptions,
        },
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    });

    const { body } = await restOperation.response;
    const response = await body.json();
    console.log('[validateAwsCredentialsV2] API response', response);

    if (onSuccess) {
      onSuccess(response);
    }
    return response;
  } catch (error) {
    if (onError) {
      onError(error);
    }
    throw error;
  }
}

/**
 * Calls the asecurecloud Azure account functions endpoint for validation and subscription listing.
 * DEPENDENCY: This uses the shared asecurecloud `/azureAccounFunctions` API Gateway endpoint.
 * See AZURE_ONBOARDING.md for migration plan.
 * @param {Object} params - { eventType: 'validate_creds'|'list_subscriptions', tenantId, clientId, clientSecret, ... }
 */
export async function azureAccountFunctions(params) {
  try {
    if (isLocalRuntime()) {
      throw new Error('Azure account setup is not available in local mode. Local mode currently supports AWS only.');
    }

    const session = await fetchAuthSession();
    const idToken = session.tokens.idToken.toString();

    const restOperation = post({
      apiName: 'frontEndAPI',
      path: '/azureAccounFunctions',
      options: {
        body: { ...params },
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    });

    const { body } = await restOperation.response;
    const response = await body.json();
    return response;
  } catch (error) {
    console.error('Azure account functions error:', error);
    throw error;
  }
}

export function sendemail(message, subject = 'Feedback message') {
  const functionUrl =
    'https://na63oooua7d67fnwegj2yvbhke0hsglb.lambda-url.us-east-1.on.aws/';

  fetch(functionUrl, {
    method: 'POST',
    headers: {
      // 'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      subject,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      return '';
    })
    .catch((error) => {
      throw error;
    });
}

// NOTE: initiateAssessmentScan has been moved to ./assessments.js
// It is re-exported from this file for backward compatibility

export async function runWorkflow({
  workflowId,
  title,
  nodes,
  workflowDefinition,
  workflowRunPreferences,
  userId,
  setIsLoading,
  navigate,
}) {
  setIsLoading?.(true);

  try {
    const normalizedWorkflowDefinition =
      workflowDefinition && typeof workflowDefinition === 'object'
        ? {
            ...workflowDefinition,
            workflowId:
              workflowDefinition.workflowId ||
              workflowDefinition.id ||
              workflowId,
            title:
              workflowDefinition.title ||
              workflowDefinition.workflowName ||
              title,
            description:
              workflowDefinition.description ||
              workflowDefinition.workflowDescription ||
              '',
            schedule: workflowDefinition.schedule,
            nodes: Array.isArray(workflowDefinition.nodes)
              ? normalizeWorkflowRunNodes(workflowDefinition.nodes)
              : [],
          }
        : {
            workflowId,
            title,
            nodes: normalizeWorkflowRunNodes(nodes || []),
          };

    if (isLocalRuntime()) {
      const data = await requestJson('/workflowManager', {
        method: 'POST',
        auth: false,
        body: {
          eventType: 'workflowStart',
          userId,
          workflowDefinition: normalizedWorkflowDefinition,
          workflowRunPreferences: workflowRunPreferences || {},
        },
      });

      setIsLoading?.(false);
      const workflowRunId =
        data?.workflowRunId ||
        data?.workflow_run_id ||
        data?.runId ||
        null;

      if (navigate) {
        navigate('/dashboard/workflow-history', {
          state: {
            refresh: true,
            ...(workflowRunId ? { workflowRunId } : {}),
          },
        });
      }

      return data;
    }

    const session = await fetchAuthSession();
    const idToken = session.tokens.idToken.toString();
    const restOperation = post({
      apiName: 'frontEndAPI',
      path: '/workflowManager',
      options: {
        body: {
          eventType: 'workflowStart',
          userId: userId,
          workflowDefinition: normalizedWorkflowDefinition,
        },
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    });
    const { body } = await restOperation.response;
    const data = await body.json();

    setIsLoading?.(false);

    const workflowRunId =
      data?.workflowRunId ||
      data?.workflow_run_id ||
      data?.runId ||
      null;

    if (navigate) {
      // Leave the editor and open workflow history (refresh list; deep-link run when id is returned)
      navigate('/dashboard/workflow-history', {
        state: {
          refresh: true,
          ...(workflowRunId ? { workflowRunId } : {}),
        },
      });
    }

    return data;
  } catch (error) {
    console.error('Failed to start workflow:', error);
    setIsLoading?.(false);
    throw error;
  }
}

export async function workflowFollowUpMessage({
  userId,

  workflowRunId,
  branchId,
  taskId,
  lastResponseId,
  followUpMessage,
  onSuccess,
  onError,
}) {
  try {
    if (isLocalRuntime()) {
      const data = await requestJson('/workflowManager', {
        method: 'POST',
        auth: false,
        body: {
          eventType: 'taskFollowUp',
          userId,
          workflowRunId,
          branchId,
          taskId,
          lastResponseId,
          followUpMessage,
        },
      });
      if (onSuccess) onSuccess(data);
      return data;
    }

    const session = await fetchAuthSession();
    const idToken = session.tokens.idToken.toString();

    const restOperation = post({
      apiName: 'frontEndAPI',
      path: '/workflowManager',
      options: {
        body: {
          eventType: 'taskFollowUp',
          userId: userId,
          workflowRunId,
          branchId,
          taskId,
          lastResponseId,
          followUpMessage,
        },
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    });

    const { body } = await restOperation.response;
    const data = await body.json();
    if (onSuccess) onSuccess(data);
    return data;
  } catch (error) {
    if (onError) onError(error);
    throw error;
  }
}

export async function workflowRetryTask({
  userId,
  workflowRunId,
  branchId,
  taskId,
  onSuccess,
  onError,
}) {
  try {
    if (isLocalRuntime()) {
      const data = await requestJson('/workflowManager', {
        method: 'POST',
        auth: false,
        body: {
          eventType: 'taskRetry',
          userId,
          workflowRunId,
          branchId,
          taskId,
        },
      });
      if (onSuccess) onSuccess(data);
      return data;
    }

    const session = await fetchAuthSession();
    const idToken = session.tokens.idToken.toString();

    const restOperation = post({
      apiName: 'frontEndAPI',
      path: '/workflowManager',
      options: {
        body: {
          eventType: 'taskRetry',
          userId,
          workflowRunId,
          branchId,
          taskId,
        },
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    });

    const { body } = await restOperation.response;
    const data = await body.json();
    if (onSuccess) onSuccess(data);
    return data;
  } catch (error) {
    if (onError) onError(error);
    throw error;
  }
}

export async function workflowReconcile({
  userId,
  workflowRunId,
  staleAfterMs,
  onSuccess,
  onError,
}) {
  try {
    if (isLocalRuntime()) {
      const data = await requestJson('/workflowManager', {
        method: 'POST',
        auth: false,
        body: {
          eventType: 'workflowReconcile',
          userId,
          workflowRunId,
          ...(staleAfterMs ? { staleAfterMs } : {}),
        },
      });
      if (onSuccess) onSuccess(data);
      return data;
    }

    const session = await fetchAuthSession();
    const idToken = session.tokens.idToken.toString();

    const restOperation = post({
      apiName: 'frontEndAPI',
      path: '/workflowManager',
      options: {
        body: {
          eventType: 'workflowReconcile',
          userId,
          workflowRunId,
          ...(staleAfterMs ? { staleAfterMs } : {}),
        },
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    });

    const { body } = await restOperation.response;
    const data = await body.json();
    if (onSuccess) onSuccess(data);
    return data;
  } catch (error) {
    if (onError) onError(error);
    throw error;
  }
}

export async function workflowCancel({
  userId,
  workflowRunId,
  onSuccess,
  onError,
}) {
  try {
    if (isLocalRuntime()) {
      const data = await requestJson('/workflowManager', {
        method: 'POST',
        auth: false,
        body: {
          eventType: 'workflowCancel',
          userId,
          workflowRunId,
        },
      });
      if (onSuccess) onSuccess(data);
      return data;
    }

    const session = await fetchAuthSession();
    const idToken = session.tokens.idToken.toString();

    const restOperation = post({
      apiName: 'frontEndAPI',
      path: '/workflowManager',
      options: {
        body: {
          eventType: 'workflowCancel',
          userId,
          workflowRunId,
        },
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    });

    const { body } = await restOperation.response;
    const data = await body.json();
    if (onSuccess) onSuccess(data);
    return data;
  } catch (error) {
    if (onError) onError(error);
    throw error;
  }
}

export async function runBackgroundAgent({
  userId,
  planId,
  inputSettings, // {blueprintInputs, authProfile, regions }
  executionMode,
  runner,
  onSuccess,
  onError,
}) {
  try {
    if (isLocalRuntime()) {
      const response = await requestJson('/runAgentBackground', {
        method: 'POST',
        auth: false,
        body: {
          userId,
          planId,
          inputSettings,
          ...(executionMode ? { executionMode } : {}),
          ...(runner ? { runner } : {}),
        },
      });
      if (onSuccess) {
        onSuccess(response);
      }
      return response;
    }

    const session = await fetchAuthSession();
    const idToken = session.tokens.idToken.toString();
    const backgroundAgentPayload = {
      userId: userId,
      planId,
      inputSettings,
      ...(executionMode ? { executionMode } : {}),
      ...(runner ? { runner } : {}),
    };

    logBackgroundAgentPayloadDiagnostics(backgroundAgentPayload);

    const restOperation = post({
      apiName: 'frontEndAPI',
      path: '/runAgentBackground',
      options: {
        body: backgroundAgentPayload,
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    });

    const { body } = await restOperation.response;
    const response = await body.json();

    if (onSuccess) {
      onSuccess(response);
    }

    return response;
  } catch (error) {
    console.error('Error running background agent:', error);
    if (onError) {
      onError(error);
    }
    throw error;
  }
}

export async function agentFollowUpMessage({
  userId,
  agentRunId,
  followUpMessage,
  onSuccess,
  onError,
}) {
  try {
    if (isLocalRuntime()) {
      const data = await requestJson('/runAgentBackground', {
        method: 'POST',
        auth: false,
        body: {
          eventType: 'taskFollowUp',
          userId,
          followUp: {
            recordId: agentRunId,
            followUpMessage,
          },
        },
      });
      if (onSuccess) onSuccess(data);
      return data;
    }

    const session = await fetchAuthSession();
    const idToken = session.tokens.idToken.toString();

    const restOperation = post({
      apiName: 'frontEndAPI',
      path: '/runAgentBackground',
      options: {
        body: {
          eventType: 'taskFollowUp',
          userId: userId,
          followUp: {
            recordId: agentRunId,
            followUpMessage,
          },
        },
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    });

    const { body } = await restOperation.response;
    const data = await body.json();
    if (onSuccess) onSuccess(data);
    return data;
  } catch (error) {
    if (onError) onError(error);
    throw error;
  }
}
