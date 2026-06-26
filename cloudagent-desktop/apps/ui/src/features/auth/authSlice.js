// src/features/auth/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { generateClient } from 'aws-amplify/api';
import { evaluateRecommendationRules } from '@/helpers/recommendations';
import { normalizeWorkloadRecord, normalizeWorkloadsCollection } from '@/features/workload/workloadNormalizer';
import { 
  queryGetRecommendations,
  queryGetExceptions,
  queryGetRecommendationsHistory,
  queryGetReportHistoryList,
  mutationUpdateRecommendationHistory,
  mutationUpdateRecommendation,
  mutationCreateException,
  mutationUpdateException,
  mutationDeleteException,
} from '@/api/eventQueries';
import { userProfileClient } from '@/api/clients/userProfileClient';
import { resolveUserSettings } from '@/lib/userSettings';
const getKnownHasTeamsValue = () => false;

const client = generateClient();

function normalizeJsonValue(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeReportHistoryRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const targetDetails = normalizeJsonValue(record.targetDetails, {});
  const summary = normalizeJsonValue(record.summary, {});
  const accountId =
    targetDetails?.accountId ||
    targetDetails?.awsAccountId ||
    targetDetails?.tenantId ||
    (Array.isArray(targetDetails?.subscriptionIds) ? targetDetails.subscriptionIds[0] : '') ||
    '';
  return {
    userId: record.userId,
    scanId: record.scanId,
    accountId,
    regions: JSON.stringify(targetDetails?.regions || []),
    services: JSON.stringify(targetDetails?.services || []),
    status: record.status,
    details: '',
    scanDataUrls: record.scanDataUrls || '',
    lastUpdateTime: record.updatedAt || record.createdAt || null,
    assessmentResultsUrl: record.assessmentResultsUrl || null,
    latestAssessmentDate: record.latestAssessmentDate || null,
    assessmentScore: summary?.assessmentScore ? JSON.stringify(summary.assessmentScore) : null,
    reportId: record.reportId || null,
    title: record.title || null,
    parentId: targetDetails?.parentId || null,
    summary,
    cloudProvider: record.cloudProvider || 'azure',
    targetDetails,
    source: 'reportHistory',
  };
}

function normalizeReportHistoryCollection(reportHistory = []) {
  return (Array.isArray(reportHistory) ? reportHistory : [])
    .map(normalizeReportHistoryRecord)
    .filter(Boolean);
}

function filterLocallyDeletedWorkloads(workloads, deletedWorkloadIds = []) {
  const deletedIds = new Set((deletedWorkloadIds || []).map((id) => String(id).trim()).filter(Boolean));
  if (deletedIds.size === 0) {
    return normalizeWorkloadsCollection(workloads, {
      source: 'auth.filterLocallyDeletedWorkloads',
    });
  }
  return normalizeWorkloadsCollection(workloads, {
    source: 'auth.filterLocallyDeletedWorkloads',
  }).filter((workload) => !deletedIds.has(String(workload?.workloadId || '').trim()));
}

// Async thunks for recommendations
export const fetchRecommendations = createAsyncThunk(
  'auth/fetchRecommendations',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { count, nextToken } = params;
      const response = await client.graphql({
        query: queryGetRecommendations,
        variables: { count, nextToken },
      });
      
      return {
        items: response.data.getRecommendations?.items || [],
        nextToken: response.data.getRecommendations?.nextToken || null,
      };
    } catch (error) {
      console.error('[AuthSlice.fetchRecommendations] Error', error);
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Helper function to enrich recommendation resources with workload information
 * @param {Array} recommendations - Array of recommendation objects
 * @param {Array} workloads - Array of workload objects from userProfile
 * @returns {Array} Enriched recommendations
 */
function enrichRecommendationsWithWorkloads(recommendations, workloads) {
  if (!Array.isArray(recommendations) || !Array.isArray(workloads)) {
    return recommendations;
  }

  // Build a map of resources by resourceArn and resourceId for quick lookup
  // Map structure: { 'resourceArn': { workloadId, workloadName }, 'resourceId': { workloadId, workloadName } }
  const resourceToWorkloadMap = new Map();

  workloads.forEach((workload) => {
    if (!workload?.workloadId || !workload?.trackedResources) {
      return;
    }

    const workloadId = workload.workloadId;
    const workloadName = workload.workloadName || workload.workloadTitle || 'Untitled Workload';
    
    // Parse trackedResources if it's a JSON string
    let trackedResourcesObj = workload.trackedResources;
    if (typeof trackedResourcesObj === 'string') {
      try {
        trackedResourcesObj = JSON.parse(trackedResourcesObj);
      } catch (error) {
        console.error('[enrichRecommendationsWithWorkloads] Failed to parse trackedResources:', error);
        return;
      }
    }

    // Ensure trackedResources has resources array
    if (!trackedResourcesObj?.resources || !Array.isArray(trackedResourcesObj.resources)) {
      return;
    }

    const trackedResources = trackedResourcesObj.resources;

    trackedResources.forEach((trackedResource) => {
      // Match on resourceArn first (if available and not empty)
      if (trackedResource.resourceArn && trackedResource.resourceArn.trim() !== '') {
        resourceToWorkloadMap.set(trackedResource.resourceArn, {
          workloadId,
          workloadName,
        });
      }
      
      // Also match on resourceId (if available and not empty)
      if (trackedResource.resourceId && trackedResource.resourceId.trim() !== '') {
        resourceToWorkloadMap.set(trackedResource.resourceId, {
          workloadId,
          workloadName,
        });
      }
    });
  });
  // Enrich each recommendation's targetResources
  return recommendations.map((recommendation) => {
    if (!recommendation?.targetResources) {
      return recommendation;
    }

    // Parse targetResources if it's a JSON string
    let targetResources = recommendation.targetResources;
    if (typeof targetResources === 'string') {
      try {
        targetResources = JSON.parse(targetResources);
      } catch {
        // If parsing fails, return recommendation as-is
        return recommendation;
      }
    }

    // Ensure targetResources is an array
    if (!Array.isArray(targetResources)) {
      return recommendation;
    }

    // Enrich each resource in targetResources
    const enrichedResources = targetResources.map((resource) => {
      // If resource is a string, convert to object or skip enrichment
      if (typeof resource === 'string') {
        return resource;
      }

      const baseResource = { ...resource };
      delete baseResource.workloadId;
      delete baseResource.workloadName;

      // Try to match on resourceArn first
      let workloadInfo = null;
      if (resource.resourceArn && resource.resourceArn.trim() !== '') {
        workloadInfo = resourceToWorkloadMap.get(resource.resourceArn);
      }

      // If no match on resourceArn, try resourceId
      if (!workloadInfo && resource.resourceId && resource.resourceId.trim() !== '') {
        workloadInfo = resourceToWorkloadMap.get(resource.resourceId);
      }

      // If we found a match, add workload info to the resource
      if (workloadInfo) {
        return {
          ...baseResource,
          workloadId: workloadInfo.workloadId,
          workloadName: workloadInfo.workloadName,
        };
      }

      // No match found, return the resource without stale workload metadata
      return baseResource;
    });

    // Return recommendation with enriched targetResources
    return {
      ...recommendation,
      targetResources: enrichedResources,
    };
  });
}

function syncRecommendationsWithCurrentWorkloads(state) {
  if (!state.userProfile?.recommendations) {
    return;
  }
  const currentRecommendations = Array.isArray(state.userProfile.recommendations.recommendations)
    ? state.userProfile.recommendations.recommendations
    : [];
  const currentWorkloads = Array.isArray(state.userProfile.workloads)
    ? state.userProfile.workloads
    : [];
  state.userProfile.recommendations.recommendations = enrichRecommendationsWithWorkloads(
    currentRecommendations,
    currentWorkloads
  );
}

function hasRecommendationTargets(recommendation) {
  if (!recommendation) {
    return false;
  }

  const resources = recommendation.targetResources;
  if (Array.isArray(resources)) {
    return resources.length > 0;
  }

  if (typeof resources === 'string') {
    try {
      const parsed = JSON.parse(resources);
      return Array.isArray(parsed) ? parsed.length > 0 : Boolean(parsed);
    } catch {
      return Boolean(resources.trim());
    }
  }

  return Boolean(resources);
}

export const fetchAllRecommendations = createAsyncThunk(
  'auth/fetchAllRecommendations',
  async (params = {}, { dispatch, getState, rejectWithValue }) => {
    try {
      let allItems = [];
      let nextToken = null;
      let hasMore = true;
      let pageCount = 0;

      while (hasMore) {
        pageCount++;
        const result = await dispatch(
          fetchRecommendations({ ...params, nextToken })
        ).unwrap();

        allItems = [...allItems, ...result.items];
        nextToken = result.nextToken;
        hasMore = !!nextToken;
      }

      allItems = allItems.filter(hasRecommendationTargets);

      // Enrich recommendations with workload information
      const state = getState();
      const workloads = state.auth?.userProfile?.workloads || [];
      
      if (workloads.length > 0) {
        const enrichedItems = enrichRecommendationsWithWorkloads(allItems, workloads);
        
        return enrichedItems;
      }

      return allItems;
    } catch (error) {
      console.error('[AuthSlice.fetchAllRecommendations] Error', error);
      return rejectWithValue(error.message);
    }
  }
);

export const fetchExceptions = createAsyncThunk(
  'auth/fetchExceptions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { count, nextToken } = params;
      const response = await client.graphql({
        query: queryGetExceptions,
        variables: { count, nextToken },
      });
      
      return {
        items: response.data.getExceptions?.items || [],
        nextToken: response.data.getExceptions?.nextToken || null,
      };
    } catch (error) {
      console.error('[AuthSlice.fetchExceptions] Error', error);
      return rejectWithValue(error.message);
    }
  }
);

export const fetchAllExceptions = createAsyncThunk(
  'auth/fetchAllExceptions',
  async (params = {}, { dispatch, rejectWithValue }) => {
    try {
      let allItems = [];
      let nextToken = null;
      let hasMore = true;
      let pageCount = 0;

      while (hasMore) {
        pageCount++;
        const result = await dispatch(
          fetchExceptions({ ...params, nextToken })
        ).unwrap();

        allItems = [...allItems, ...result.items];
        nextToken = result.nextToken;
        hasMore = !!nextToken;
      }

      return allItems;
    } catch (error) {
      console.error('[AuthSlice.fetchAllExceptions] Error', error);
      return rejectWithValue(error.message);
    }
  }
);

export const fetchRecommendationsHistory = createAsyncThunk(
  'auth/fetchRecommendationsHistory',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { count, nextToken } = params;
      const response = await client.graphql({
        query: queryGetRecommendationsHistory,
        variables: { count, nextToken },
      });
      
      return {
        items: response.data.getRecommendationsHistory?.items || [],
        nextToken: response.data.getRecommendationsHistory?.nextToken || null,
      };
    } catch (error) {
      console.error('[AuthSlice.fetchRecommendationsHistory] Error', error);
      return rejectWithValue(error.message);
    }
  }
);

export const fetchAllRecommendationsHistory = createAsyncThunk(
  'auth/fetchAllRecommendationsHistory',
  async (params = {}, { dispatch, rejectWithValue }) => {
    try {
     
      let allItems = [];
      let nextToken = null;
      let hasMore = true;
      let pageCount = 0;

      while (hasMore) {
        pageCount++;
        const result = await dispatch(
          fetchRecommendationsHistory({ ...params, nextToken })
        ).unwrap();

        allItems = [...allItems, ...result.items];
        nextToken = result.nextToken;
        hasMore = !!nextToken;
      }

     

      return allItems;
    } catch (error) {
      console.error('[AuthSlice.fetchAllRecommendationsHistory] Error', error);
      return rejectWithValue(error.message);
    }
  }
);

export const updateRecommendationHistory = createAsyncThunk(
  'auth/updateRecommendationHistory',
  async (params, { rejectWithValue }) => {
    try {
      const { historyId, recordKey, updates } = params;
      const response = await client.graphql({
        query: mutationUpdateRecommendationHistory,
        variables: { historyId, recordKey, updates },
      });
      return response.data.updateRecommendationHistory;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateRecommendation = createAsyncThunk(
  'auth/updateRecommendation',
  async (params, { rejectWithValue }) => {
    try {
      const { recommendationId, recordKey, updates } = params;
      
      // Extract recommendationId from recordKey if not provided
      let finalRecommendationId = recommendationId;
      if (!finalRecommendationId && recordKey) {
        // recordKey format: RECOMMENDATION#<recommendationId>
        if (recordKey.startsWith('RECOMMENDATION#')) {
          finalRecommendationId = recordKey.replace('RECOMMENDATION#', '');
        }
      }
      
      if (!finalRecommendationId) {
        throw new Error('recommendationId is required (can be extracted from recordKey)');
      }
      
      const response = await client.graphql({
        query: mutationUpdateRecommendation,
        variables: { 
          recommendationId: finalRecommendationId,
          recordKey: recordKey || undefined,
          updates 
        },
      });
      return response.data.updateRecommendation;
    } catch (error) {
      console.error('[updateRecommendation] Error:', error);
      console.error('[updateRecommendation] Error details:', {
        message: error.message,
        stack: error.stack,
        params: params,
      });
      return rejectWithValue(error.message);
    }
  }
);

export const createException = createAsyncThunk(
  'auth/createException',
  async (params, { rejectWithValue }) => {
    try {
      const { recommendationId, recommendationTitle, scope, reason, notes, expiresAt } = params;
      
      // Build variables object, only including non-null values
      const variables = {
        recommendationId,
        recommendationTitle,
        scope,
      };
      
      // Only include optional fields if they have values
      if (reason != null && reason !== '') {
        variables.reason = reason;
      }
      if (notes != null && notes !== '') {
        variables.notes = notes;
      }
      if (expiresAt != null && expiresAt !== '') {
        variables.expiresAt = expiresAt;
      }
      
      const response = await client.graphql({
        query: mutationCreateException,
        variables,
      });
      return response.data.createException;
    } catch (error) {
      console.log(error)
      return rejectWithValue(error.message);
    }
  }
);

export const updateException = createAsyncThunk(
  'auth/updateException',
  async (params, { rejectWithValue }) => {
    try {
      const { exceptionId, recordKey, updates } = params;
      const response = await client.graphql({
        query: mutationUpdateException,
        variables: { exceptionId, recordKey, updates },
      });
      return response.data.updateException;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteException = createAsyncThunk(
  'auth/deleteException',
  async (params, { rejectWithValue }) => {
    try {
      const { exceptionId, recordKey } = params;
      
      // Ensure recordKey is always provided - construct it if not provided
      let finalRecordKey = recordKey;
      if (!finalRecordKey && exceptionId) {
        finalRecordKey = `EXCEPTION#${exceptionId}`;
      }
      
      if (!exceptionId) {
        throw new Error('exceptionId is required');
      }
      
      // Only include recordKey in variables if it's provided (not undefined)
      const variables = { exceptionId };
      if (finalRecordKey) {
        variables.recordKey = finalRecordKey;
      }
      
      const response = await client.graphql({
        query: mutationDeleteException,
        variables,
      });
      return { exceptionId, success: true };
    } catch (error) {
      console.error('[AuthSlice.deleteException] Error:', error);
      return rejectWithValue(error.message);
    }
  }
);

async function fetchAllReportHistory() {
  let allReportHistory = [];
  let nextToken = null;

  do {
    const response = await client.graphql({
      query: queryGetReportHistoryList,
      variables: {
        count: 100,
        nextToken,
      },
    });
    const data = response.data?.getReportHistoryList;
    if (data?.items) {
      allReportHistory = [...allReportHistory, ...data.items];
    }
    nextToken = data?.nextToken;
  } while (nextToken);

  return normalizeReportHistoryCollection(allReportHistory);
}

/**
 * Refreshes reportHistory from the API and updates userProfile.
 * The exported name is retained while call sites are migrated.
 */
export const refreshAccountScans = createAsyncThunk(
  'auth/refreshAccountScans',
  async (_, { getState, rejectWithValue }) => {
    try {
      return fetchAllReportHistory();
    } catch (error) {
      console.error('[AuthSlice.refreshReportHistory] Error:', error);
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Refreshes user profile info and updates userProfile.
 */
export const refreshUserProfile = createAsyncThunk(
  'auth/refreshUserProfile',
  async (_, { dispatch, getState, rejectWithValue }) => {
    try {
      dispatch(setUserProfileLoading(true));
      const hasTeams = getKnownHasTeamsValue(getState());

      const userData = await userProfileClient.getCurrentProfile({ hasTeams });

      if (!userData) {
        dispatch(setUserProfileLoading(false));
        return rejectWithValue('No user data found');
      }

      const existingProfile = getState()?.auth?.userProfile || {};
      const mergedProfile = {
        ...existingProfile,
        ...userData,
      };

      dispatch(setUserProfile(mergedProfile));
      dispatch(setUserProfileLoading(false));

      return mergedProfile;
    } catch (error) {
      dispatch(setUserProfileLoading(false));
      console.error('[AuthSlice.refreshUserProfile] Error:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const updateUserSettings = createAsyncThunk(
  'auth/updateUserSettings',
  async ({ settings }, { dispatch, rejectWithValue }) => {
    try {
      const normalizedSettings = resolveUserSettings(settings);
      const serializedSettings =
        typeof normalizedSettings === 'string'
          ? normalizedSettings
          : JSON.stringify(normalizedSettings);

      const updatedUser = await userProfileClient.updateSettings(serializedSettings);
      const updatedSettings = resolveUserSettings(updatedUser?.settings ?? normalizedSettings);
      dispatch(setStoredUserSettings(updatedSettings));
      return {
        userId: updatedUser?.userId || null,
        settings: updatedSettings,
      };
    } catch (error) {
      console.error('[AuthSlice.updateUserSettings] Error:', error);
      return rejectWithValue(error.message || 'Failed to update user settings');
    }
  }
);

const initialState = {
  user: null,
  isAuthenticated: false,
  loading: true,
  userProfileLoading: true,
  error: null,
  deletedWorkloadIds: [],
  userProfile: {
    agentPermissionProfiles: [],
    recommendations: {
      recommendations: [],
      exceptions: [],
      history: [],
      loadingRecommendations: false,
      loadingExceptions: false,
      loadingHistory: false,
    },
  },
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = action.payload?.isSignedIn;
      state.loading = false;
      state.error = null;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
      state.deletedWorkloadIds = [];
      state.userProfile = {
        recommendations: {
          recommendations: [],
          exceptions: [],
          history: [],
          loadingRecommendations: false,
          loadingExceptions: false,
          loadingHistory: false,
        },
      };
    },
    updateHistoryFromSubscription: (state, action) => {
      if (!state.userProfile.recommendations) {
        state.userProfile.recommendations = {
          recommendations: [],
          exceptions: [],
          history: [],
          loadingRecommendations: false,
          loadingExceptions: false,
          loadingHistory: false,
        };
      }
      const updated = action.payload;
      const index = state.userProfile.recommendations.history.findIndex(
        (h) => h.historyId === updated.historyId
      );
      if (index !== -1) {
        state.userProfile.recommendations.history[index] = updated;
      } else {
        state.userProfile.recommendations.history.unshift(updated);
      }
    },
    setUserProfile: (state, action) => {
      const payload =
        action.payload && typeof action.payload === 'object'
          ? action.payload
          : {};
      const userData = { ...payload };
      userData.reportHistory = normalizeReportHistoryCollection(userData.reportHistory);

      if (typeof userData.agentCredits === 'string') {
        try {
          userData.agentCredits = JSON.parse(userData.agentCredits);
        } catch {
          userData.agentCredits = null;
        }
      }

      userData.settings = resolveUserSettings(userData.settings);

      const rawRecommendations = userData.recommendations;
      const normalizedRecommendations =
        rawRecommendations &&
        typeof rawRecommendations === 'object' &&
        !Array.isArray(rawRecommendations)
          ? {
              ...rawRecommendations,
              recommendations: Array.isArray(rawRecommendations.recommendations)
                ? [...rawRecommendations.recommendations]
                : [],
              exceptions: Array.isArray(rawRecommendations.exceptions)
                ? [...rawRecommendations.exceptions]
                : [],
              history: Array.isArray(rawRecommendations.history)
                ? [...rawRecommendations.history]
                : [],
              loadingRecommendations: Boolean(
                rawRecommendations.loadingRecommendations
              ),
              loadingExceptions: Boolean(rawRecommendations.loadingExceptions),
              loadingHistory: Boolean(rawRecommendations.loadingHistory),
            }
          : {
              recommendations: Array.isArray(rawRecommendations)
                ? [...rawRecommendations]
                : [],
              exceptions: [],
              history: [],
              loadingRecommendations: false,
              loadingExceptions: false,
              loadingHistory: false,
            };

      const evaluatedRecommendations = evaluateRecommendationRules({
        ...userData,
        recommendations: normalizedRecommendations,
      });

      state.userProfile = {
        ...userData,
        recommendations: {
          ...normalizedRecommendations,
          recommendations: evaluatedRecommendations,
        },
        workloads: filterLocallyDeletedWorkloads(
          userData.workloads,
          state.deletedWorkloadIds
        ),
        agentPermissionProfiles: Array.isArray(userData.agentPermissionProfiles)
          ? [...userData.agentPermissionProfiles]
          : [],
      };
      syncRecommendationsWithCurrentWorkloads(state);
    },
    setUserProfileLoading: (state, action) => {
      state.userProfileLoading = action.payload;
    },
    updateCredits: (state, action) => {
      if (state.userProfile?.subscription) {
        state.userProfile.subscription.availableCredits = action.payload;
      }
    },
    updateSingleProfileInState: (state, action) => {
      const updatedProfile = action.payload;
      if (!updatedProfile?.recordId) return;
      if (!state.userProfile?.agentPermissionProfiles) return;
      const index = state.userProfile.agentPermissionProfiles.findIndex(
        (profile) => profile.recordId === updatedProfile.recordId
      );
      if (index !== -1) {
        state.userProfile.agentPermissionProfiles[index] = updatedProfile;
      }
    },
    updatePermissionProfileSummary: (state, action) => {
      const { recordId, summary } = action.payload || {};
      if (!recordId) return;
      if (!state.userProfile?.agentPermissionProfiles) return;
      
      const index = state.userProfile.agentPermissionProfiles.findIndex(
        (profile) => profile.recordId === recordId
      );
      if (index !== -1) {
        // Store summary as stringified JSON (AWSJSON format)
        state.userProfile.agentPermissionProfiles[index].summary = 
          typeof summary === 'string' ? summary : JSON.stringify(summary);
      }
    },
    updateWorkloadSummaryInUserProfile: (state, action) => {
      const { workloadId, summary } = action.payload;
      if (!state.userProfile?.workloads) return;
      
      const index = state.userProfile.workloads.findIndex(
        (workload) => workload.workloadId === workloadId
      );
      if (index !== -1) {
        // Store summary as stringified JSON (AWSJSON format)
        state.userProfile.workloads[index].summary = 
          typeof summary === 'string' ? summary : JSON.stringify(summary);
      }
    },
    updateSingleWorkloadInUserProfile: (state, action) => {
      const { workload: updatedWorkload } = normalizeWorkloadRecord(action.payload, {
        source: 'auth.updateSingleWorkloadInUserProfile',
      });
      if (!updatedWorkload?.workloadId) return;
      if (!state.userProfile) {
        state.userProfile = {};
      }
      if (!Array.isArray(state.userProfile.workloads)) {
        state.userProfile.workloads = [];
      }

      const index = state.userProfile.workloads.findIndex(
        (workload) => workload.workloadId === updatedWorkload.workloadId
      );
      if (index !== -1) {
        state.userProfile.workloads[index] = {
          ...state.userProfile.workloads[index],
          ...updatedWorkload,
        };
      } else {
        state.userProfile.workloads.push(updatedWorkload);
      }
      state.deletedWorkloadIds = state.deletedWorkloadIds.filter(
        (workloadId) => workloadId !== updatedWorkload.workloadId
      );
      syncRecommendationsWithCurrentWorkloads(state);
    },
    removeSingleWorkloadFromUserProfile: (state, action) => {
      const workloadId = String(action.payload || '').trim();
      if (!workloadId) return;
      if (Array.isArray(state.userProfile?.workloads)) {
        state.userProfile.workloads = state.userProfile.workloads.filter(
          (workload) => workload?.workloadId !== workloadId
        );
      }
      if (!state.deletedWorkloadIds.includes(workloadId)) {
        state.deletedWorkloadIds.push(workloadId);
      }
      syncRecommendationsWithCurrentWorkloads(state);
    },
    removeProfileFromState: (state, action) => {
      const recordId = action.payload;
      if (!state.userProfile?.agentPermissionProfiles) return;
      state.userProfile.agentPermissionProfiles =
        state.userProfile.agentPermissionProfiles.filter(
          (profile) => profile.recordId !== recordId
        );
    },
    addProfileToState: (state, action) => {
      const newProfile = action.payload;
      if (!state.userProfile) {
        state.userProfile = { agentPermissionProfiles: [] };
      }
      if (!Array.isArray(state.userProfile.agentPermissionProfiles)) {
        state.userProfile.agentPermissionProfiles = [];
      }
      state.userProfile.agentPermissionProfiles.push(newProfile);
    },
    updateUserAgentSettings: (state, action) => {
      const { allowOverages, mcpToken } = action.payload;
      if (state.userProfile) {
        state.userProfile.allowOverages = allowOverages;
        state.userProfile.mcpToken = mcpToken;
      }
    },
    setStoredUserSettings: (state, action) => {
      if (!state.userProfile || typeof state.userProfile !== 'object') {
        state.userProfile = {};
      }
      state.userProfile.settings = resolveUserSettings(action.payload);
    },
    updateUserProfile: (state, action) => {
      if (!state.userProfile || typeof state.userProfile !== 'object') {
        state.userProfile = {};
      }
      const {
        agentCredits,
        agentHistory,
        agentPermissionProfiles,
        settings,
        subscription,
        userTeams,
        workflows,
        removeWorkflowId,
      } = action.payload;

      if (agentCredits) {
        const parsedAgentCredits =
          typeof agentCredits === 'string'
            ? JSON.parse(agentCredits)
            : agentCredits;

        state.userProfile.agentCredits = {
          monthlyBaseCredits: parsedAgentCredits.monthlyBaseCredits,
          adhocCredits: parsedAgentCredits.adhocCredits,
        };
      }

      if (agentHistory) {
        if (!Array.isArray(state.userProfile.agentHistory)) {
          state.userProfile.agentHistory = [];
        }

        const historyToUpdate = Array.isArray(agentHistory)
          ? agentHistory
          : [agentHistory];

        historyToUpdate.forEach((newRecord) => {
          if (!newRecord || typeof newRecord !== 'object' || !newRecord.recordId) {
            return;
          }

          const existingIndex = state.userProfile.agentHistory.findIndex(
            (record) => record.recordId === newRecord.recordId
          );

          if (existingIndex !== -1) {
            state.userProfile.agentHistory[existingIndex] = {
              ...state.userProfile.agentHistory[existingIndex],
              ...newRecord,
            };
          } else {
            state.userProfile.agentHistory.push(newRecord);
          }
        });
      }

      if (agentPermissionProfiles || agentPermissionProfiles?.length === 0) {
        if (agentPermissionProfiles.length === 0) {
          state.userProfile.agentPermissionProfiles = [];
        } else {
          state.userProfile.agentPermissionProfiles = Array.isArray(
            agentPermissionProfiles
          )
            ? agentPermissionProfiles
            : [agentPermissionProfiles];
        }
      }

      if (removeWorkflowId) {
        state.userProfile.workFlowDefs =
          state.userProfile.workFlowDefs?.filter(
            (workflow) => workflow.workflowId !== removeWorkflowId
          ) || [];
      }

      if (workflows) {
        if (!state.userProfile.workFlowDefs) {
          state.userProfile.workFlowDefs = [];
        }

        const workflowsToUpdate = Array.isArray(workflows)
          ? workflows
          : [workflows];

        workflowsToUpdate.forEach((newWorkflow) => {
          if (!newWorkflow || typeof newWorkflow !== 'object' || !newWorkflow.workflowId) {
            return;
          }

          const existingIndex = state.userProfile.workFlowDefs.findIndex(
            (workflow) => workflow.workflowId === newWorkflow.workflowId
          );

          if (existingIndex !== -1) {
            state.userProfile.workFlowDefs[existingIndex] = {
              ...state.userProfile.workFlowDefs[existingIndex],
              ...newWorkflow,
            };
          } else {
            state.userProfile.workFlowDefs.push(newWorkflow);
          }
        });
      }

      if (settings !== undefined) {
        state.userProfile.settings = resolveUserSettings(settings);
      }

      if (subscription !== undefined) {
        state.userProfile.subscription =
          typeof subscription === 'string'
            ? normalizeJsonValue(subscription, {})
            : subscription;
      }

      if (userTeams !== undefined) {
        const teamsToMerge = Array.isArray(userTeams) ? userTeams : [userTeams];
        const existingTeams = Array.isArray(state.userProfile.userTeams)
          ? state.userProfile.userTeams
          : [];
        state.userProfile.userTeams = [
          ...teamsToMerge,
          ...existingTeams.filter(
            (existingTeam) =>
              !teamsToMerge.some(
                (team) => team?.teamId && team.teamId === existingTeam?.teamId
              )
          ),
        ];
      }

      // Update recommendations in nested structure
      if (!state.userProfile.recommendations) {
        state.userProfile.recommendations = {
          recommendations: [],
          exceptions: [],
          history: [],
          loadingRecommendations: false,
          loadingExceptions: false,
          loadingHistory: false,
        };
      }
      const evaluatedRecommendations = evaluateRecommendationRules(
        state.userProfile
      );
      state.userProfile.recommendations.recommendations = evaluatedRecommendations;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch recommendations (single page)
      .addCase(fetchRecommendations.pending, (state) => {
        if (!state.userProfile.recommendations) {
          state.userProfile.recommendations = {
            recommendations: [],
            exceptions: [],
            history: [],
            loadingRecommendations: false,
            loadingExceptions: false,
            loadingHistory: false,
          };
        }
        state.userProfile.recommendations.loadingRecommendations = true;
      })
      .addCase(fetchRecommendations.fulfilled, (state, action) => {
        state.userProfile.recommendations.loadingRecommendations = false;

        const payload = action.payload || {};
        const backendItems = Array.isArray(payload.items) ? payload.items : [];
        const nextToken = payload.nextToken ?? null;
        const currentRecommendations = state.userProfile.recommendations.recommendations || [];
        
        // Identify local recommendations (ones with recommendationId starting with 'local_rule.')
        const localRecommendations = currentRecommendations.filter(rec => {
          const recId = rec.recommendationId || rec.id;
          return recId && String(recId).startsWith('local_rule.');
        });
        
        if (!nextToken) {
          // First page - merge local + backend (avoid duplicates)
          const localRecsByRuleId = new Map();
          localRecommendations.forEach(rec => {
            const ruleId = rec.ruleId || rec.recommendationId || rec.id;
            if (ruleId) {
              localRecsByRuleId.set(String(ruleId), rec);
            }
          });
          
          const merged = [
            ...localRecommendations,
            ...backendItems.filter(backendRec => {
              const backendRuleId = backendRec.ruleId || backendRec.recommendationId;
              return !backendRuleId || !localRecsByRuleId.has(String(backendRuleId));
            })
          ];
          
          state.userProfile.recommendations.recommendations = merged;
        } else {
          // Subsequent pages - append backend items
          state.userProfile.recommendations.recommendations = [
            ...currentRecommendations,
            ...backendItems
          ];
        }
      })
      .addCase(fetchRecommendations.rejected, (state, action) => {
        state.userProfile.recommendations.loadingRecommendations = false;
        state.error = action.payload;
      })
      // Fetch all recommendations (all pages)
      .addCase(fetchAllRecommendations.pending, (state) => {
        if (!state.userProfile.recommendations) {
          state.userProfile.recommendations = {
            recommendations: [],
            exceptions: [],
            history: [],
            loadingRecommendations: false,
            loadingExceptions: false,
            loadingHistory: false,
          };
        }
        state.userProfile.recommendations.loadingRecommendations = true;
      })
      .addCase(fetchAllRecommendations.fulfilled, (state, action) => {
        state.userProfile.recommendations.loadingRecommendations = false;
        
        // Merge backend recommendations with locally evaluated ones
        // Local recommendations have recommendationId like 'local_rule.cis_report' or 'local_rule.unused_resources'
        // Backend recommendations have recommendationId from database (UUIDs or other formats)
        const backendRecommendations = action.payload || [];
        const currentRecommendations = state.userProfile.recommendations.recommendations || [];
        
        // Identify local recommendations (ones with recommendationId starting with 'local_rule.')
        // Check both current state and ensure we preserve them
        const localRecommendations = currentRecommendations.filter(rec => {
          const recId = rec.recommendationId || rec.id;
          return recId && String(recId).startsWith('local_rule.');
        });
        
        // If no local recommendations found in current state, re-evaluate them
        // This handles the case where they might have been lost during pagination
        let finalLocalRecommendations = localRecommendations;
        if (localRecommendations.length === 0 && state.userProfile) {
          const reEvaluated = evaluateRecommendationRules(state.userProfile);
          finalLocalRecommendations = reEvaluated.filter(rec => {
            const recId = rec.recommendationId || rec.id;
            return recId && String(recId).startsWith('local_rule.');
          });
        }
        
        // Create a map of local recommendations by ruleId to check for duplicates
        const localRecsByRuleId = new Map();
        finalLocalRecommendations.forEach(rec => {
          const ruleId = rec.ruleId || rec.recommendationId || rec.id;
          if (ruleId) {
            localRecsByRuleId.set(String(ruleId), rec);
          }
        });
        
        // Merge: keep local recommendations + backend recommendations (avoid duplicates by ruleId)
        const mergedRecommendations = [
          ...finalLocalRecommendations,
          ...backendRecommendations.filter(backendRec => {
            // Check if a local recommendation with same ruleId exists
            const backendRuleId = backendRec.ruleId || backendRec.recommendationId;
            if (backendRuleId && localRecsByRuleId.has(String(backendRuleId))) {
              // Local recommendation exists for this ruleId, skip backend one
              return false;
            }
            return true; // Include backend recommendation
          })
        ];
        
        state.userProfile.recommendations.recommendations = mergedRecommendations;
      })
      .addCase(fetchAllRecommendations.rejected, (state, action) => {
        state.userProfile.recommendations.loadingRecommendations = false;
        state.error = action.payload;
      })
      // Fetch exceptions (single page)
      .addCase(fetchExceptions.pending, (state) => {
        if (!state.userProfile.recommendations) {
          state.userProfile.recommendations = {
            recommendations: [],
            exceptions: [],
            history: [],
            loadingRecommendations: false,
            loadingExceptions: false,
            loadingHistory: false,
          };
        }
        state.userProfile.recommendations.loadingExceptions = true;
      })
      .addCase(fetchExceptions.fulfilled, (state, action) => {
        const payload = action.payload || {};
        const items = Array.isArray(payload.items) ? payload.items : [];
        const nextToken = payload.nextToken ?? null;
        state.userProfile.recommendations.loadingExceptions = false;
        if (!nextToken) {
          state.userProfile.recommendations.exceptions = items;
        } else {
          state.userProfile.recommendations.exceptions = [
            ...state.userProfile.recommendations.exceptions,
            ...items
          ];
        }
      })
      .addCase(fetchExceptions.rejected, (state, action) => {
        state.userProfile.recommendations.loadingExceptions = false;
        state.error = action.payload;
      })
      // Fetch all exceptions (all pages)
      .addCase(fetchAllExceptions.pending, (state) => {
        if (!state.userProfile.recommendations) {
          state.userProfile.recommendations = {
            recommendations: [],
            exceptions: [],
            history: [],
            loadingRecommendations: false,
            loadingExceptions: false,
            loadingHistory: false,
          };
        }
        state.userProfile.recommendations.loadingExceptions = true;
      })
      .addCase(fetchAllExceptions.fulfilled, (state, action) => {
        state.userProfile.recommendations.loadingExceptions = false;
        state.userProfile.recommendations.exceptions = Array.isArray(action.payload)
          ? action.payload
          : [];
      })
      .addCase(fetchAllExceptions.rejected, (state, action) => {
        state.userProfile.recommendations.loadingExceptions = false;
        state.error = action.payload;
      })
      // Fetch history (single page)
      .addCase(fetchRecommendationsHistory.pending, (state) => {
        if (!state.userProfile.recommendations) {
          state.userProfile.recommendations = {
            recommendations: [],
            exceptions: [],
            history: [],
            loadingRecommendations: false,
            loadingExceptions: false,
            loadingHistory: false,
          };
        }
        state.userProfile.recommendations.loadingHistory = true;
      })
      .addCase(fetchRecommendationsHistory.fulfilled, (state, action) => {
        const payload = action.payload || {};
        const items = Array.isArray(payload.items) ? payload.items : [];
        const nextToken = payload.nextToken ?? null;
        state.userProfile.recommendations.loadingHistory = false;
        if (!nextToken) {
          state.userProfile.recommendations.history = items;
        } else {
          state.userProfile.recommendations.history = [
            ...state.userProfile.recommendations.history,
            ...items
          ];
        }
      })
      .addCase(fetchRecommendationsHistory.rejected, (state, action) => {
        state.userProfile.recommendations.loadingHistory = false;
        state.error = action.payload;
      })
      // Fetch all history (all pages)
      .addCase(fetchAllRecommendationsHistory.pending, (state) => {
        if (!state.userProfile.recommendations) {
          state.userProfile.recommendations = {
            recommendations: [],
            exceptions: [],
            history: [],
            loadingRecommendations: false,
            loadingExceptions: false,
            loadingHistory: false,
          };
        }
        state.userProfile.recommendations.loadingHistory = true;
      })
      .addCase(fetchAllRecommendationsHistory.fulfilled, (state, action) => {
        state.userProfile.recommendations.loadingHistory = false;
        state.userProfile.recommendations.history = Array.isArray(action.payload)
          ? action.payload
          : [];
      })
      .addCase(fetchAllRecommendationsHistory.rejected, (state, action) => {
        state.userProfile.recommendations.loadingHistory = false;
        state.error = action.payload;
      })
      // Update recommendation
      .addCase(updateRecommendation.fulfilled, (state, action) => {
        const updated = action.payload;
        const index = state.userProfile.recommendations.recommendations.findIndex(
          (r) => r.recommendationId === updated.recommendationId
        );
        if (index !== -1) {
          // Merge updated fields with existing recommendation to preserve fields not returned by mutation
          // (like priority, category, metadata, recommendedAction, etc.)
          state.userProfile.recommendations.recommendations[index] = {
            ...state.userProfile.recommendations.recommendations[index],
            ...updated,
          };
        }
      })
      // Create exception
      .addCase(createException.fulfilled, (state, action) => {
        state.userProfile.recommendations.exceptions.push(action.payload);
      })
      // Update exception
      .addCase(updateException.fulfilled, (state, action) => {
        const updated = action.payload;
        const index = state.userProfile.recommendations.exceptions.findIndex(
          (e) => e.exceptionId === updated.exceptionId
        );
        if (index !== -1) {
          state.userProfile.recommendations.exceptions[index] = updated;
        }
      })
      // Delete exception
      .addCase(deleteException.fulfilled, (state, action) => {
        state.userProfile.recommendations.exceptions = state.userProfile.recommendations.exceptions.filter(
          (e) => e.exceptionId !== action.payload.exceptionId
        );
      })
      // Refresh reportHistory
      .addCase(refreshAccountScans.fulfilled, (state, action) => {
        if (state.userProfile) {
          state.userProfile.reportHistory = action.payload;
        }
      })
      .addCase(refreshAccountScans.rejected, (state, action) => {
        console.error('[AuthSlice.refreshReportHistory] Failed:', action.payload);
        // Don't update state on error, keep existing reportHistory
      })
  },
});

export const {
  setUser,
  setLoading,
  setError,
  logout,
  setUserProfile,
  updateCredits,
  updateUserProfile,
  setUserProfileLoading,
  updateSingleProfileInState,
  removeProfileFromState,
  addProfileToState,
  updateUserAgentSettings,
  setStoredUserSettings,
  updateHistoryFromSubscription,
  updatePermissionProfileSummary,
  updateWorkloadSummaryInUserProfile,
  updateSingleWorkloadInUserProfile,
  removeSingleWorkloadFromUserProfile,
} = authSlice.actions;
export default authSlice.reducer;
