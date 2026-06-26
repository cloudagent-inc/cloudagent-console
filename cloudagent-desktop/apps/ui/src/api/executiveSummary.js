import { executiveSummaryClient } from './clients/executiveSummaryClient';
import { isSupportedExecutiveSummaryEnvironmentType } from '../helpers/shared';

/**
 * Generate executive summary for a cloud environment (permission profile)
 * @param {string} recordId - The recordId of the permission profile
 * @returns {Promise<any>} - Response from the executive summary endpoint
 */
export async function generateEnvironmentSummary(recordId) {
  return executiveSummaryClient.generateEnvironmentSummary(recordId);
}

/**
 * Generate executive summary for a workload
 * @param {string} workloadId - The workloadId of the workload
 * @returns {Promise<any>} - Response from the executive summary endpoint
 */
export async function generateWorkloadSummary(workloadId) {
  return executiveSummaryClient.generateWorkloadSummary(workloadId);
}

/**
 * Generate executive summary based on item type
 * @param {object} item - The item object with type, id, and original data
 * @returns {Promise<any>} - Response from the executive summary endpoint
 */
export async function generateExecutiveSummary(item) {
  if (item.type === 'environment') {
    const profileType =
      item?.original?.type ||
      item?.permissionProfileType ||
      item?.profileType ||
      null;
    if (profileType && !isSupportedExecutiveSummaryEnvironmentType(profileType)) {
      throw new Error('Executive summaries are only available for supported cloud environments.');
    }
    return generateEnvironmentSummary(item.original?.recordId || item.id);
  } else if (item.type === 'workload') {
    return generateWorkloadSummary(item.original?.workloadId || item.id);
  }
  throw new Error('Unknown item type for executive summary generation');
}

/**
 * Parse summary field from AWSJSON format
 * @param {any} summary - The summary field (string or object)
 * @returns {object|null} - Parsed summary object or null
 */
function parseSummary(summary) {
  if (!summary) return null;
  if (typeof summary === 'string') {
    try {
      return JSON.parse(summary);
    } catch {
      return null;
    }
  }
  return summary;
}

/**
 * Check if an item has a valid executive summary
 * @param {any} summary - The summary field
 * @returns {boolean} - True if has valid summaryText
 */
function hasSummary(summary) {
  const parsed = parseSummary(summary);
  return !!(parsed?.summaryText);
}

/**
 * Check and generate missing executive summaries for permission profiles and workloads
 * This function is called after user profile is loaded to auto-generate summaries
 * 
 * @param {object} userProfile - The user profile object containing agentPermissionProfiles and workloads
 * @param {function} dispatch - Redux dispatch function to update state
 * @param {object} actions - Object containing Redux actions { updatePermissionProfileSummary, updateWorkloadSummaryInUserProfile, updateWorkloadSummary }
 * @returns {Promise<{environments: number, workloads: number}>} - Count of summaries requested
 */
export async function checkAndGenerateMissingSummaries(userProfile, dispatch, actions) {
  const results = {
    environments: 0,
    workloads: 0,
    errors: [],
  };

  if (!userProfile) {
    return results;
  }

  const {
    updatePermissionProfileSummary,
    updateWorkloadSummaryInUserProfile,
    updateWorkloadSummary,
  } = actions || {};

  // Check permission profiles (environments)
  const permissionProfiles = userProfile.agentPermissionProfiles || [];
  const profilesWithoutSummary = permissionProfiles.filter(
    (profile) =>
      profile.recordId &&
      !hasSummary(profile.summary) &&
      isSupportedExecutiveSummaryEnvironmentType(profile.type)
  );

  // Check workloads
  const workloads = userProfile.workloads || [];
  const workloadsWithoutSummary = workloads.filter(
    (workload) => workload.workloadId && !hasSummary(workload.summary)
  );

  console.log(
    `[ExecutiveSummary] Found ${profilesWithoutSummary.length} environments and ${workloadsWithoutSummary.length} workloads without summaries`
  );

  // Generate summaries for environments (fire and forget, don't block)
  for (const profile of profilesWithoutSummary) {
    try {
      // Don't await - fire and forget so it doesn't block the UI
      generateEnvironmentSummary(profile.recordId)
        .then((response) => {
          console.log(`[ExecutiveSummary] Received summary for environment: ${profile.name || profile.recordId}`);
          
          // Update Redux state if we got a successful response
          if (response?.ok && dispatch && updatePermissionProfileSummary) {
            // Extract all summary fields from response, excluding status fields
            const { ok, message, ...summaryData } = response;
            dispatch(updatePermissionProfileSummary({
              recordId: profile.recordId,
              summary: summaryData,
            }));
            console.log(`[ExecutiveSummary] Updated state for environment: ${profile.name || profile.recordId}`);
          }
        })
        .catch((err) => {
          console.error(`[ExecutiveSummary] Failed to request summary for environment ${profile.recordId}:`, err);
        });
      results.environments++;
    } catch (err) {
      console.error(`[ExecutiveSummary] Error requesting summary for environment ${profile.recordId}:`, err);
      results.errors.push({ type: 'environment', id: profile.recordId, error: err.message });
    }
  }

  // Generate summaries for workloads (fire and forget, don't block)
  for (const workload of workloadsWithoutSummary) {
    try {
      // Don't await - fire and forget so it doesn't block the UI
      generateWorkloadSummary(workload.workloadId)
        .then((response) => {
          console.log(`[ExecutiveSummary] Received summary for workload: ${workload.workloadName || workload.workloadId}`);
          
          // Update Redux state if we got a successful response
          if (response?.ok && dispatch) {
            // Extract all summary fields from response, excluding status fields
            const { ok, message, ...summaryData } = response;
            
            // Update workload in userProfile
            if (updateWorkloadSummaryInUserProfile) {
              dispatch(updateWorkloadSummaryInUserProfile({
                workloadId: workload.workloadId,
                summary: summaryData,
              }));
            }
            
            // Update workload in workload slice
            if (updateWorkloadSummary) {
              dispatch(updateWorkloadSummary({
                workloadId: workload.workloadId,
                summary: summaryData,
              }));
            }
            
            console.log(`[ExecutiveSummary] Updated state for workload: ${workload.workloadName || workload.workloadId}`);
          }
        })
        .catch((err) => {
          console.error(`[ExecutiveSummary] Failed to request summary for workload ${workload.workloadId}:`, err);
        });
      results.workloads++;
    } catch (err) {
      console.error(`[ExecutiveSummary] Error requesting summary for workload ${workload.workloadId}:`, err);
      results.errors.push({ type: 'workload', id: workload.workloadId, error: err.message });
    }
  }

  if (results.environments > 0 || results.workloads > 0) {
    console.log(
      `[ExecutiveSummary] Requested ${results.environments} environment and ${results.workloads} workload summaries`
    );
  }

  return results;
}
