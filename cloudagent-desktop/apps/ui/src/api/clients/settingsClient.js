import { requestJson } from './httpClient';

export const settingsClient = {
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

  async getPreferencesStatus() {
    return requestJson('/local/preferences/status', { auth: false });
  },

  async getIacToolSettings() {
    return requestJson('/local/iac-tools/settings', { auth: false });
  },

  async updateIacToolSettings(settings) {
    return requestJson('/local/iac-tools/settings', {
      method: 'PATCH',
      body: settings,
      auth: false,
    });
  },
};
