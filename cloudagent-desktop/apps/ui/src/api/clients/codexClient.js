import { requestJson } from './localHttpClient';

export const codexClient = {
  async getSettings() {
    return requestJson('/local/codex/settings', { auth: false });
  },

  async updateSettings(settings) {
    return requestJson('/local/codex/settings', {
      method: 'PATCH',
      body: settings,
      auth: false,
    });
  },

  async getSkillFiles(recordId) {
    return requestJson(`/local/codex/skills/${encodeURIComponent(recordId)}/skill`, {
      auth: false,
    });
  },

  async updateSkillFile(recordId, { relativePath, content }) {
    return requestJson(`/local/codex/skills/${encodeURIComponent(recordId)}/skill/files`, {
      method: 'PUT',
      body: { relativePath, content },
      auth: false,
    });
  },
};
