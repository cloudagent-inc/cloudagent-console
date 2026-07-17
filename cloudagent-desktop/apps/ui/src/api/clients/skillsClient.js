import { requestJson, unwrapRecord } from './httpClient';

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
    return unwrapRecord(
      await requestJson('/local/skills', {
        method: 'POST',
        body: variables,
        auth: false,
      }),
      ['skill', 'blueprint']
    );
  },

  async list({ count = 50, nextToken = null, hasTeams } = {}) {
    return requestJson(
      `/local/skills${toQueryString({ count, nextToken })}`,
      { auth: false }
    );
  },

  async get(recordId, { hasTeams } = {}) {
    return unwrapRecord(
      await requestJson(`/local/skills/${encodeURIComponent(recordId)}`, {
        auth: false,
      }),
      ['skill', 'blueprint']
    );
  },

  async delete(recordId) {
    return {
      recordId,
      ...(await requestJson(`/local/skills/${encodeURIComponent(recordId)}`, {
        method: 'DELETE',
        auth: false,
      })),
    };
  },
};

export const blueprintsClient = skillsClient;
