import { normalizeWorkflowRunNodes } from '../helpers/workflowRunNormalization';
import { requestJson } from './clients/httpClient';

function normalizeWorkflowDefinition({
  workflowId,
  title,
  nodes,
  workflowDefinition,
}) {
  if (workflowDefinition && typeof workflowDefinition === 'object') {
    return {
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
    };
  }

  return {
    workflowId,
    title,
    nodes: normalizeWorkflowRunNodes(nodes || []),
  };
}

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
    const data = await requestJson('/workflowManager', {
      method: 'POST',
      auth: false,
      body: {
        eventType: 'workflowStart',
        userId,
        workflowDefinition: normalizeWorkflowDefinition({
          workflowId,
          title,
          nodes,
          workflowDefinition,
        }),
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
  } catch (error) {
    if (onError) onError(error);
    throw error;
  }
}
