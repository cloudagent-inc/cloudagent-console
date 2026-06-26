import { generateClient } from 'aws-amplify/api';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';
import {
  createWorkloadDefinitionMutation,
  deleteWorkloadDefinitionMutation,
  updateWorkloadDefinitionMutation,
} from '@/api/eventQueries';
import { requestJson, unwrapRecord } from './localHttpClient';

const client = generateClient();

export const workloadsClient = {
  async create(input) {
    if (isLocalRuntime()) {
      return unwrapRecord(
        await requestJson('/local/workloads', {
          method: 'POST',
          body: input,
          auth: false,
        }),
        ['workload']
      );
    }

    const response = await client.graphql({
      query: createWorkloadDefinitionMutation,
      variables: { input },
    });
    return response.data.createWorkloadDefinition;
  },

  async update(input) {
    if (isLocalRuntime()) {
      const { workloadId, ...patch } = input || {};
      return unwrapRecord(
        await requestJson(`/local/workloads/${encodeURIComponent(workloadId)}`, {
          method: 'PATCH',
          body: patch,
          auth: false,
        }),
        ['workload']
      );
    }

    const response = await client.graphql({
      query: updateWorkloadDefinitionMutation,
      variables: { input },
    });
    return response.data.updateWorkloadDefinition;
  },

  async delete(workloadId) {
    if (isLocalRuntime()) {
      await requestJson(`/local/workloads/${encodeURIComponent(workloadId)}`, {
        method: 'DELETE',
        auth: false,
      });
      return true;
    }

    const response = await client.graphql({
      query: deleteWorkloadDefinitionMutation,
      variables: { workloadId },
    });
    return response.data.deleteWorkloadDefinition;
  },
};
