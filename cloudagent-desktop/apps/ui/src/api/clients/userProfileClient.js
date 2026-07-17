import { requestJson } from './httpClient';

export const userProfileClient = {
  async getCurrentProfile() {
    return requestJson('/local/bootstrap', { auth: false });
  },

  async updateSettings(settings) {
    return requestJson('/local/settings', {
      method: 'PATCH',
      body: { settings },
      auth: false,
    });
  },
};
