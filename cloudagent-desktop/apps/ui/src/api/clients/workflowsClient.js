import { generateClient } from 'aws-amplify/api';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';
import {
  createWorkflowMutation,
  deleteWorkflowMutation,
  queryGetWorkflow,
  queryGetWorkFlows,
  updateWorkflowMutation,
} from '@/api/eventQueries';
import { requestJson, unwrapRecord } from './localHttpClient';

const client = generateClient();

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
    if (isLocalRuntime()) {
      return unwrapRecord(
        await requestJson('/local/workflows', {
          method: 'POST',
          body: variables,
          auth: false,
        }),
        ['workflow']
      );
    }

    const response = await client.graphql({
      query: createWorkflowMutation,
      variables,
    });
    return response.data.createWorkflow;
  },

  async update({ workflowId, ...patch }) {
    if (isLocalRuntime()) {
      return unwrapRecord(
        await requestJson(`/local/workflows/${encodeURIComponent(workflowId)}`, {
          method: 'PATCH',
          body: patch,
          auth: false,
        }),
        ['workflow']
      );
    }

    const response = await client.graphql({
      query: updateWorkflowMutation,
      variables: { workflowId, ...patch },
    });
    return response.data.updateWorkflow;
  },

  async delete(workflowId) {
    if (isLocalRuntime()) {
      return {
        workflowId,
        ...(await requestJson(`/local/workflows/${encodeURIComponent(workflowId)}`, {
          method: 'DELETE',
          auth: false,
        })),
      };
    }

    const response = await client.graphql({
      query: deleteWorkflowMutation,
      variables: { workflowId },
    });
    return response.data.deleteWorkflow;
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
    if (isLocalRuntime()) {
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
    }

    const response = await client.graphql({
      query: queryGetWorkFlows,
      variables: {
        count,
        nextToken,
        sortBy,
        sortOrder,
        workflowType,
        startDate,
        endDate,
        hasTeams,
      },
    });
    return response?.data?.getWorkFlows;
  },

  async getRun(workflowRunId, { hasTeams } = {}) {
    if (isLocalRuntime()) {
      return unwrapRecord(
        await requestJson(`/local/workflow-runs/${encodeURIComponent(workflowRunId)}`, {
          auth: false,
        }),
        ['workflowRun']
      );
    }

    const response = await client.graphql({
      query: queryGetWorkflow,
      variables: { workflowRunId, hasTeams },
    });
    return response.data.getWorkflow;
  },
};
