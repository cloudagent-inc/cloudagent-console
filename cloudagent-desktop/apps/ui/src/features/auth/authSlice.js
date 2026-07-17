// src/features/auth/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { normalizeWorkloadRecord, normalizeWorkloadsCollection } from '@/features/workload/workloadNormalizer';
import { userProfileClient } from '@/api/clients/userProfileClient';
import { resolveUserSettings } from '@/lib/userSettings';
const getKnownHasTeamsValue = () => false;

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


async function fetchAllReportHistory() {
  const userData = await userProfileClient.getCurrentProfile();
  return normalizeReportHistoryCollection(userData?.reportHistory || userData?.accountScans || []);
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
      };
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

      delete userData.recommendations;

      state.userProfile = {
        ...userData,
        workloads: filterLocallyDeletedWorkloads(
          userData.workloads,
          state.deletedWorkloadIds
        ),
        agentPermissionProfiles: Array.isArray(userData.agentPermissionProfiles)
          ? [...userData.agentPermissionProfiles]
          : [],
      };
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
    },
  },
  extraReducers: (builder) => {
    builder
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
  updatePermissionProfileSummary,
  updateWorkloadSummaryInUserProfile,
  updateSingleWorkloadInUserProfile,
  removeSingleWorkloadFromUserProfile,
} = authSlice.actions;
export default authSlice.reducer;
