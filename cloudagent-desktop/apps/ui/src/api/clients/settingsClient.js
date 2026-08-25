import { requestJson } from './httpClient';

export const settingsClient = {
  async getLLMSettings() {
    return requestJson('/local/llm/settings', { auth: false });
  },

  async updateLLMSettings(settings) {
    return requestJson('/local/llm/settings', {
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
