import { requestJson } from './localHttpClient';

export const localSettingsClient = {
  async getOpenAISettings() {
    return requestJson('/local/openai/settings', { auth: false });
  },

  async updateOpenAISettings(settings) {
    return requestJson('/local/openai/settings', {
      method: 'PATCH',
      body: settings,
      auth: false,
    });
  },
};
