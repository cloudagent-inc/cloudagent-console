import { requestJson, unwrapRecord } from './httpClient';

export const workloadsClient = {
  async create(input) {
    return unwrapRecord(
      await requestJson('/local/workloads', {
        method: 'POST',
        body: input,
        auth: false,
      }),
      ['workload']
    );
  },

  async update(input) {
    const { workloadId, ...patch } = input || {};
    return unwrapRecord(
      await requestJson(`/local/workloads/${encodeURIComponent(workloadId)}`, {
        method: 'PATCH',
        body: patch,
        auth: false,
      }),
      ['workload']
    );
  },

  async delete(workloadId) {
    await requestJson(`/local/workloads/${encodeURIComponent(workloadId)}`, {
      method: 'DELETE',
      auth: false,
    });
    return true;
  },
};
