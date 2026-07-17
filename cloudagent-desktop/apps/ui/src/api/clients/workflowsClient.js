import { requestJson, unwrapRecord } from './httpClient';

const toQueryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : '';
};

export const workflowsClient = {
  async create(variables) {
    return unwrapRecord(
      await requestJson('/local/workflows', {
        method: 'POST',
        body: variables,
        auth: false,
      }),
      ['workflow']
    );
  },

  async update({ workflowId, ...patch }) {
    return unwrapRecord(
      await requestJson(`/local/workflows/${encodeURIComponent(workflowId)}`, {
        method: 'PATCH',
        body: patch,
        auth: false,
      }),
      ['workflow']
    );
  },

  async delete(workflowId) {
    return {
      workflowId,
      ...(await requestJson(`/local/workflows/${encodeURIComponent(workflowId)}`, {
        method: 'DELETE',
        auth: false,
      })),
    };
  },

  async listRuns({
    count,
    nextToken,
    sortBy,
    sortOrder,
    workflowType,
    startDate,
    endDate,
    hasTeams,
  }) {
    return requestJson(
      `/local/workflow-runs${toQueryString({
        count,
        nextToken,
        sortBy,
        sortOrder,
        workflowType,
        startDate,
        endDate,
      })}`,
      { auth: false }
    );
  },

  async getRun(workflowRunId, { hasTeams } = {}) {
    return unwrapRecord(
      await requestJson(`/local/workflow-runs/${encodeURIComponent(workflowRunId)}`, {
        auth: false,
      }),
      ['workflowRun']
    );
  },
};
