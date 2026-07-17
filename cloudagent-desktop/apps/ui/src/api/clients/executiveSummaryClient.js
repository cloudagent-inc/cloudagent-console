import { requestJson } from './httpClient';

export const executiveSummaryClient = {
  generateEnvironmentSummary(recordId) {
    return requestJson('/executive-summary/', {
      method: 'POST',
      body: {
        scope: 'account',
        recordId,
      },
    });
  },

  generateWorkloadSummary(workloadId) {
    return requestJson('/executive-summary/', {
      method: 'POST',
      body: {
        scope: 'workload',
        workloadId,
      },
    });
  },
};
