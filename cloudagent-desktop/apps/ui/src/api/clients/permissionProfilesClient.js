import { generateClient } from 'aws-amplify/api';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';
import {
  createAgentPermissionProfileMutation,
  deleteAgentPermissionProfileMutation,
  updateAgentPermissionProfileMutation,
} from '@/api/eventQueries';
import { requestJson, unwrapRecord } from './localHttpClient';

const client = generateClient();

export const permissionProfilesClient = {
  async create(profile) {
    if (isLocalRuntime()) {
      return unwrapRecord(
        await requestJson('/local/permission-profiles', {
          method: 'POST',
          body: profile,
          auth: false,
        }),
        ['permissionProfile', 'profile']
      );
    }

    const response = await client.graphql({
      query: createAgentPermissionProfileMutation,
      variables: profile,
    });
    return response.data.createAgentPermissionProfile;
  },

  async update(profile) {
    if (isLocalRuntime()) {
      const { recordId, ...patch } = profile || {};
      return unwrapRecord(
        await requestJson(`/local/permission-profiles/${encodeURIComponent(recordId)}`, {
          method: 'PATCH',
          body: patch,
          auth: false,
        }),
        ['permissionProfile', 'profile']
      );
    }

    const response = await client.graphql({
      query: updateAgentPermissionProfileMutation,
      variables: profile,
    });
    return response.data.updateAgentPermissionProfile;
  },

  async delete(recordId) {
    if (isLocalRuntime()) {
      return unwrapRecord(
        await requestJson(`/local/permission-profiles/${encodeURIComponent(recordId)}`, {
          method: 'DELETE',
          auth: false,
        }),
        ['permissionProfile', 'profile']
      );
    }

    const response = await client.graphql({
      query: deleteAgentPermissionProfileMutation,
      variables: { recordId },
    });
    return response.data.deleteAgentPermissionProfile;
  },
};
