import { generateClient } from 'aws-amplify/api';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';
import {
  createBlueprintMutation,
  deleteBlueprintMutation,
  getBlueprintQuery,
  getBlueprintsQuery,
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

export const skillsClient = {
  async create(variables) {
    if (isLocalRuntime()) {
      return unwrapRecord(
        await requestJson('/local/skills', {
          method: 'POST',
          body: variables,
          auth: false,
        }),
        ['skill', 'blueprint']
      );
    }

    const response = await client.graphql({
      query: createBlueprintMutation,
      variables,
    });
    return response.data.createEC2ResizeBlueprint;
  },

  async list({ count = 50, nextToken = null, hasTeams } = {}) {
    if (isLocalRuntime()) {
      return requestJson(
        `/local/skills${toQueryString({ count, nextToken })}`,
        { auth: false }
      );
    }

    const response = await client.graphql({
      query: getBlueprintsQuery,
      variables: { count, nextToken, hasTeams },
    });
    return response.data.getBlueprints;
  },

  async get(recordId, { hasTeams } = {}) {
    if (isLocalRuntime()) {
      return unwrapRecord(
        await requestJson(`/local/skills/${encodeURIComponent(recordId)}`, {
          auth: false,
        }),
        ['skill', 'blueprint']
      );
    }

    const response = await client.graphql({
      query: getBlueprintQuery,
      variables: { recordId, hasTeams },
    });
    return response.data.getBlueprint;
  },

  async delete(recordId) {
    if (isLocalRuntime()) {
      return {
        recordId,
        ...(await requestJson(`/local/skills/${encodeURIComponent(recordId)}`, {
          method: 'DELETE',
          auth: false,
        })),
      };
    }

    const response = await client.graphql({
      query: deleteBlueprintMutation,
      variables: { recordId },
    });
    return { recordId, ...response.data.deleteBlueprint };
  },
};

export const blueprintsClient = skillsClient;
