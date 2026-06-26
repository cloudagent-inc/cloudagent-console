import { fetchAuthSession } from 'aws-amplify/auth';
import { BACKEND_API_ENDPOINT } from '../config/appConfig';

export const RECOMMENDATIONS_API_BASE_URL = `${BACKEND_API_ENDPOINT}/`;

function redactAuthHeader(value) {
  if (!value || typeof value !== 'string') return value;
  if (!value.startsWith('Bearer ')) return value;
  return `Bearer ${value.slice(7, 27)}...`;
}

function safeJsonParse(value) {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const couldBeJson =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'));

  if (!couldBeJson) {
    return trimmed;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function serializeError(error) {
  if (!error) return null;
  if (typeof error === 'string') return { message: error };
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || String(error),
      stack: error.stack || null,
    };
  }
  if (typeof error === 'object') {
    return {
      ...error,
      message: error.message || JSON.stringify(error),
    };
  }
  return { message: String(error) };
}

function shouldIngestScannerRecommendations(scan) {
  if (!scan || typeof scan !== 'object') return false;

  const cloudProvider = String(scan.cloudProvider || scan.provider || 'aws')
    .trim()
    .toLowerCase();

  return !cloudProvider || cloudProvider === 'aws';
}

/**
 * Ingests scanner recommendations for the latest scan entries per reportId
 * @param {Array} reportHistory - Array of reportHistory scan objects
 * @param {Array} recommendationsHistory - Array of history records to check for already processed scanIds
 * @param {Function} dispatch - Optional Redux dispatch function. If provided, will refresh recommendations history after successful ingestions
 * @param {Function} onProgress - Optional callback called after each scan completes. Called with { current, total, scan, success, error }
 * @returns {Promise<Array>} Array of response objects from the API calls
 */
export async function ingestScannerRecommendations(reportHistory = [], recommendationsHistory = [], dispatch = null, onProgress = null) {
  if (!Array.isArray(reportHistory) || reportHistory.length === 0) {
    
    return [];
  }

  // Group scans by reportId and get the latest entry for each unique reportId
  // Filter out failed scans
  const scansByReportId = new Map();
  
  reportHistory.forEach((scan) => {
    if (!scan || !scan.reportId || !scan.scanId) {
      return; // Skip scans without reportId or scanId
    }

    // Skip failed scans
    if (scan.status === 'FAILED' || scan.status === 'failed') {
      
      return;
    }

    const reportId = String(scan.reportId);
    const existingScan = scansByReportId.get(reportId);

    if (!existingScan) {
      scansByReportId.set(reportId, scan);
    } else {
      // Compare by lastUpdateTime to get the latest entry
      const existingTime = new Date(existingScan.lastUpdateTime || 0).getTime();
      const currentTime = new Date(scan.lastUpdateTime || 0).getTime();
      
      if (currentTime > existingTime) {
        scansByReportId.set(reportId, scan);
      }
    }
  });

  // Get the latest scan for each unique reportId, then collapse synthetic rows
  // back to one backend ingest call per physical scanId.
  const latestScans = Array.from(scansByReportId.values());
  const scansByScanId = new Map();

  latestScans.forEach((scan) => {
    if (!scan?.scanId) {
      return;
    }

    const existingScan = scansByScanId.get(scan.scanId);
    if (!existingScan) {
      scansByScanId.set(scan.scanId, scan);
      return;
    }

    const existingTime = new Date(existingScan.lastUpdateTime || 0).getTime();
    const currentTime = new Date(scan.lastUpdateTime || 0).getTime();
    if (currentTime > existingTime) {
      scansByScanId.set(scan.scanId, scan);
    }
  });
  const uniqueLatestScans = Array.from(scansByScanId.values());
  
  // Check history records to see which scanIds have already been processed
  // Exclude failed history records
  const processedScanIds = new Set();
  if (Array.isArray(recommendationsHistory) && recommendationsHistory.length > 0) {
    recommendationsHistory.forEach((historyItem) => {
      if (!historyItem || !historyItem.input) {
        return;
      }
      
      // Skip failed history records
      const status = historyItem?.status?.toLowerCase();
      if (status === 'failed') {
        
        return;
      }
      
      const inputData = safeJsonParse(historyItem.input);
      if (inputData && inputData.scanId) {
        processedScanIds.add(String(inputData.scanId));
      }
    });
  }

  // Filter out scanIds that have already been processed
  const scansToProcess = uniqueLatestScans.filter((scan) => {
    if (!shouldIngestScannerRecommendations(scan)) {
      return false;
    }

    const alreadyProcessed = processedScanIds.has(String(scan.scanId));
    
    return !alreadyProcessed;
  });
  
  

  if (scansToProcess.length === 0) {
    
    return [];
  }

  // Get auth token
  let idToken;
  try {
    const session = await fetchAuthSession();
    idToken = session?.tokens?.idToken?.toString();
  } catch (_) {
    // proceed without Authorization header
  }

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
  };

  const url = new URL('/recommendations/ingest/scanner', RECOMMENDATIONS_API_BASE_URL);

  const safeHeaders = {
    ...headers,
    ...(headers.Authorization ? { Authorization: redactAuthHeader(headers.Authorization) } : {}),
  };

  // Helper function to sleep/delay
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Process scans sequentially, one at a time
  const results = [];
  const totalScans = scansToProcess.length;
  
  console.log('[ingestScannerRecommendations] Starting to process scans', {
    totalScans,
    hasDispatch: !!dispatch,
    hasOnProgress: !!onProgress,
    scanIds: scansToProcess.map(s => s.scanId),
  });
  
  for (let i = 0; i < scansToProcess.length; i++) {
    const scan = scansToProcess[i];
    
    console.log(`[ingestScannerRecommendations] Processing scan ${i + 1}/${totalScans}`, {
      scanId: scan.scanId,
      reportId: scan.reportId,
    });
    
    // Add delay between scans (but not before the first one)
    if (i > 0) {
      console.log(`[ingestScannerRecommendations] Waiting 2 seconds before next scan...`);
      await sleep(2000); // 2 second delay
    }

    let success = false;
    let error = null;

    try {
      const payload = { scanId: scan.scanId };
      
      console.log(`[ingestScannerRecommendations] Calling backend API for scanId: ${scan.scanId}`);
      
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      console.log(`[ingestScannerRecommendations] Backend API response for scanId: ${scan.scanId}`, {
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(errorBody || `Recommendations ingest failed with status ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const body = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

      results.push({
        status: 'fulfilled',
        value: {
          scanId: scan.scanId,
          reportId: scan.reportId,
          status: response.status,
          body,
        },
      });
      
      success = true;
      console.log(`[ingestScannerRecommendations] Backend API call SUCCESS for scanId: ${scan.scanId}`);
      
      // Fetch recommendations after each successful API call completes
      if (dispatch) {
        console.log(`[ingestScannerRecommendations] Fetching recommendations (dispatch provided) for scanId: ${scan.scanId}`);
        try {
          // Dynamically import to avoid circular dependencies
          const { fetchAllRecommendationsHistory, fetchAllRecommendations } = await import('../features/auth/authSlice');
          
          // Refresh recommendations history
          console.log(`[ingestScannerRecommendations] Dispatching fetchAllRecommendationsHistory...`);
          const historyResult = await dispatch(fetchAllRecommendationsHistory()).unwrap();
          console.log(`[ingestScannerRecommendations] fetchAllRecommendationsHistory completed`, {
            historyCount: Array.isArray(historyResult) ? historyResult.length : 'N/A',
          });
          
          // Fetch recommendation table entries
          console.log(`[ingestScannerRecommendations] Dispatching fetchAllRecommendations...`);
          const recsResult = await dispatch(fetchAllRecommendations()).unwrap();
          console.log(`[ingestScannerRecommendations] fetchAllRecommendations completed`, {
            recommendationsCount: Array.isArray(recsResult) ? recsResult.length : 'N/A',
          });
          
          // Yield to the event loop to allow React to process state updates and re-render
          console.log(`[ingestScannerRecommendations] Yielding to event loop (setTimeout 0)...`);
          await new Promise(resolve => setTimeout(resolve, 0));
          console.log(`[ingestScannerRecommendations] Event loop yield complete`);
        } catch (fetchError) {
          console.error('[ingestScannerRecommendations] Error fetching recommendations after scan:', scan.scanId, fetchError);
          // Don't throw - fetch failure shouldn't fail the entire operation
        }
      } else {
        console.log(`[ingestScannerRecommendations] No dispatch provided, skipping recommendation fetch for scanId: ${scan.scanId}`);
      }
    } catch (err) {
      error = serializeError(err);
      console.error(`[ingestScannerRecommendations] Backend API call FAILED for scanId: ${scan.scanId}`, err);
      results.push({
        status: 'rejected',
        reason: error,
      });
    }
    
    // Call onProgress callback after each scan completes (success or failure)
    // Use setTimeout to ensure React has a chance to process state updates
    if (onProgress) {
      console.log(`[ingestScannerRecommendations] Calling onProgress callback for scan ${i + 1}/${totalScans}`);
      await new Promise(resolve => {
        setTimeout(() => {
          try {
            onProgress({
              current: i + 1,
              total: totalScans,
              scan,
              success,
              error,
            });
            console.log(`[ingestScannerRecommendations] onProgress callback completed for scan ${i + 1}/${totalScans}`);
          } catch (callbackError) {
            console.error('[ingestScannerRecommendations] Error in onProgress callback:', callbackError);
          }
          resolve();
        }, 0);
      });
    } else {
      console.log(`[ingestScannerRecommendations] No onProgress callback provided`);
    }
    
    console.log(`[ingestScannerRecommendations] Finished processing scan ${i + 1}/${totalScans}, moving to next...`);
  }

  // Log results
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  console.log('[ingestScannerRecommendations] All scans processed', {
    successful,
    failed,
    total: totalScans,
  });

  return results.map((result, index) => ({
    scanId: scansToProcess[index].scanId,
    reportId: scansToProcess[index].reportId,
    ...(result.status === 'fulfilled' ? { success: true, data: result.value } : { success: false, error: result.reason }),
  }));
}

/**
 * Creates an exception for a recommendation
 * @param {Object} params - Exception parameters
 * @param {string} params.recommendationId - ID of the recommendation
 * @param {string[]|null} params.accountId - Array of account IDs (optional, for cloud environments scope)
 * @param {Array<{resourceId?: string, resourceArn?: string, displayName?: string}>|null} params.resources - Array of resources (optional, for by-resource scope)
 * @param {string|null} params.reason - Reason for the exception (optional)
 * @returns {Promise<Object>} Response object from the API call
 */
export async function createException({ recommendationId, accountId = null, resources = null, reason = null }) {
  if (!recommendationId) {
    throw new Error('recommendationId is required');
  }

  // Get auth token
  let idToken;
  try {
    const session = await fetchAuthSession();
    idToken = session?.tokens?.idToken?.toString();
  } catch (_) {
    // proceed without Authorization header
  }

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
  };

  const url = new URL('/recommendations/exceptions/', RECOMMENDATIONS_API_BASE_URL);

  // Build request body according to API spec
  const body = {
    recommendationId,
  };

  // Only include accountId if provided (for cloud environments scope)
  if (accountId != null && Array.isArray(accountId) && accountId.length > 0) {
    body.accountId = accountId;
  }

  // Only include resources if provided (for by-resource scope)
  if (resources != null && Array.isArray(resources) && resources.length > 0) {
    body.resources = resources;
  }

  // Only include reason if provided
  if (reason != null && reason !== '') {
    body.reason = reason;
  }

  const safeHeaders = {
    ...headers,
    ...(headers.Authorization ? { Authorization: redactAuthHeader(headers.Authorization) } : {}),
  };

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(errorBody || `Create exception failed with status ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  return result;
}

export async function fetchCompletedRecommendations() {
  let idToken;
  try {
    const session = await fetchAuthSession();
    idToken = session?.tokens?.idToken?.toString();
  } catch (_) {
    // proceed without Authorization header
  }

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
  };

  const url = new URL('/recommendations/completed', RECOMMENDATIONS_API_BASE_URL);
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      errorBody || `Fetch completed recommendations failed with status ${response.status}`
    );
  }

  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  return Array.isArray(result?.items) ? result.items : [];
}
