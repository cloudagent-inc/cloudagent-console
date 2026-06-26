import { generateClient } from 'aws-amplify/api';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';
import {
  queryGetUserInfo,
  updateUserSettingsMutation,
} from '@/api/eventQueries';
import { fetchAllPermissionProfilesSafe } from '@/api/permissionProfiles';
import { requestJson } from './localHttpClient';

const client = generateClient();

export const userProfileClient = {
  async getCurrentProfile({ hasTeams } = {}) {
    if (isLocalRuntime()) {
      return requestJson('/local/bootstrap', { auth: false });
    }

    const response = await client.graphql({
      query: queryGetUserInfo,
      variables: { hasTeams },
    });
    const userData = response.data?.getUserInfo;
    if (!userData) return null;

    const agentPermissionProfiles = await fetchAllPermissionProfilesSafe(client, {
      fallbackProfiles: userData.agentPermissionProfiles,
      hasTeams,
    });

    return {
      ...userData,
      agentPermissionProfiles,
    };
  },

  async updateSettings(settings) {
    if (isLocalRuntime()) {
      return requestJson('/local/settings', {
        method: 'PATCH',
        body: { settings },
        auth: false,
      });
    }

    const response = await client.graphql({
      query: updateUserSettingsMutation,
      variables: { settings },
    });

    return response.data?.updateUserSettings;
  },
};
