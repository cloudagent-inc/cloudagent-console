import { requestJson } from './httpClient';

export const awsClient = {
  async listProfiles() {
    const response = await requestJson('/local/aws/profiles', { auth: false });
    return Array.isArray(response?.profiles) ? response.profiles : [];
  },

  async validatePermissionProfiles() {
    const response = await requestJson('/local/permission-profiles/validate-credentials', {
      method: 'POST',
      auth: false,
    });
    return {
      profiles: Array.isArray(response?.agentPermissionProfiles)
        ? response.agentPermissionProfiles
        : Array.isArray(response?.permissionProfiles)
          ? response.permissionProfiles
          : Array.isArray(response?.items)
            ? response.items
            : [],
      invalidCount: Number(response?.invalidCount) || 0,
    };
  },

  async validatePermissionProfile(recordId) {
    const response = await requestJson(
      `/local/permission-profiles/${encodeURIComponent(recordId)}/validate-credentials`,
      {
        method: 'POST',
        auth: false,
      }
    );
    return response?.profile || response?.item || null;
  },
};
