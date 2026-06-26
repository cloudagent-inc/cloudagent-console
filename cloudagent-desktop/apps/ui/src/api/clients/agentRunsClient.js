import { requestJson, unwrapRecord } from './localHttpClient';

const toQueryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : '';
};

export const agentRunsClient = {
  async create(record) {
    return unwrapRecord(
      await requestJson('/local/agent-runs', {
        method: 'POST',
        body: record,
        auth: false,
      }),
      ['agentRun', 'record']
    );
  },

  async update({ recordId, ...patch }) {
    return unwrapRecord(
      await requestJson(`/local/agent-runs/${encodeURIComponent(recordId)}`, {
        method: 'PATCH',
        body: patch,
        auth: false,
      }),
      ['agentRun', 'record']
    );
  },

  async cancel({ recordId, log }) {
    return unwrapRecord(
      await requestJson(`/local/agent-runs/${encodeURIComponent(recordId)}/cancel`, {
        method: 'POST',
        body: log !== undefined ? { log } : {},
        auth: false,
      }),
      ['agentRun', 'record']
    );
  },

  async list(params = {}) {
    return requestJson(`/local/agent-runs${toQueryString(params)}`, {
      auth: false,
    });
  },

  async get(recordId) {
    return unwrapRecord(
      await requestJson(`/local/agent-runs/${encodeURIComponent(recordId)}`, {
        auth: false,
      }),
      ['agentRun', 'record']
    );
  },
};
