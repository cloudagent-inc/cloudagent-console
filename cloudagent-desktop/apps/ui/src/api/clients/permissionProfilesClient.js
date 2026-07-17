import { requestJson, unwrapRecord } from './httpClient';

export const permissionProfilesClient = {
  async create(profile) {
    return unwrapRecord(
      await requestJson('/local/permission-profiles', {
        method: 'POST',
        body: profile,
        auth: false,
      }),
      ['permissionProfile', 'profile']
    );
  },

  async update(profile) {
    const { recordId, ...patch } = profile || {};
    return unwrapRecord(
      await requestJson(`/local/permission-profiles/${encodeURIComponent(recordId)}`, {
        method: 'PATCH',
        body: patch,
        auth: false,
      }),
      ['permissionProfile', 'profile']
    );
  },

  async delete(recordId) {
    return unwrapRecord(
      await requestJson(`/local/permission-profiles/${encodeURIComponent(recordId)}`, {
        method: 'DELETE',
        auth: false,
      }),
      ['permissionProfile', 'profile']
    );
  },
};
