import { requestJson } from './clients/httpClient';

export async function runBackgroundAgent({
  userId,
  planId,
  inputSettings,
  executionMode,
  runner,
  onSuccess,
  onError,
}) {
  try {
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
  } catch (error) {
    if (onError) onError(error);
    throw error;
  }
}
