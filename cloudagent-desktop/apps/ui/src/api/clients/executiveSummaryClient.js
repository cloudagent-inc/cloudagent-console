import { BACKEND_API_ENDPOINT } from '@/config/appConfig';
import { requestJson } from './localHttpClient';

export const executiveSummaryClient = {
  generateEnvironmentSummary(recordId) {
    return requestJson('/executive-summary/', {
      method: 'POST',
      body: {
        scope: 'account',
        recordId,
      },
      fallbackApiBaseUrl: BACKEND_API_ENDPOINT,
    });
  },

  generateWorkloadSummary(workloadId) {
    return requestJson('/executive-summary/', {
      method: 'POST',
      body: {
        scope: 'workload',
        workloadId,
      },
      fallbackApiBaseUrl: BACKEND_API_ENDPOINT,
    });
  },
};
