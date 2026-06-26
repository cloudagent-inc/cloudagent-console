import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { generateClient } from 'aws-amplify/api';
import { queryGetOverviewData } from '../../api/eventQueries';
import { fetchAllPermissionProfilesSafe } from '../../api/permissionProfiles';
import { userProfileClient } from '@/api/clients/userProfileClient';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';

const client = generateClient();
const getKnownHasTeamsValue = () => false;

export const getOverviewData = createAsyncThunk(
  'overview/getOverviewData',
  async (_, { getState, rejectWithValue }) => {
    try {
      const readCachedUserProfile = () => {
        const userProfile = getState()?.auth?.userProfile;
        return userProfile?.userId ? userProfile : null;
      };

      let cachedUserProfile = readCachedUserProfile();
      if (cachedUserProfile) {
        return cachedUserProfile;
      }

      // Wait briefly for the auth bootstrap to populate userProfile before
      // issuing another full getUserInfo query from the overview page.
      if (getState()?.auth?.userProfileLoading) {
        for (let attempt = 0; attempt < 50; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          cachedUserProfile = readCachedUserProfile();
          if (cachedUserProfile) {
            return cachedUserProfile;
          }
          if (!getState()?.auth?.userProfileLoading) {
            break;
          }
        }
      }

      const hasTeams = getKnownHasTeamsValue(getState());
      if (isLocalRuntime()) {
        const localProfile = await userProfileClient.getCurrentProfile({ hasTeams });
        if (!localProfile) {
          return rejectWithValue('No local user data found');
        }
        return localProfile;
      }

      const response = await client.graphql({
        query: queryGetOverviewData,
        variables: { hasTeams },
      });

      if (!response.data.getUserInfo) {
        console.error('[OverviewSlice.getOverviewData] No user data found');
        return rejectWithValue('No user data found');
      }

      const userData = response.data.getUserInfo;
      const agentPermissionProfiles = await fetchAllPermissionProfilesSafe(
        client,
        {
          fallbackProfiles: userData.agentPermissionProfiles,
          hasTeams,
        }
      );

      return {
        ...userData,
        agentPermissionProfiles,
      };
    } catch (error) {
      console.error('[OverviewSlice.getOverviewData] Error', {
        error: error.message,
        errorDetails: error,
      });
      return rejectWithValue(error.message || 'Failed to fetch overview data');
    }
  }
);

const overviewSlice = createSlice({
  name: 'overview',
  initialState: {
    loading: false,
    error: null,
    userId: null,
    agentHistory: [],
    reportHistory: [],
    workflows: [],
    workFlowDefs: [],
    agentPermissionProfiles: [],
    // Computed values
    stats: {
      totalAgents: 0,
      totalReports: 0,
      totalWorkflows: 0,
      totalWorkflowDefs: 0,
      waitingOnUser: 0,
      totalPermissionProfiles: 0,
    },
    lastFetched: null,
  },
  reducers: {
    clearOverviewData: (state) => {
      state.agentHistory = [];
      state.reportHistory = [];
      state.workflows = [];
      state.workFlowDefs = [];
      state.stats = {
        totalAgents: 0,
        totalWorkflows: 0,
        totalWorkflowDefs: 0,
        waitingOnUser: 0,
        totalReports: 0,
      };
      state.error = null;
    },
    updateStats: (state) => {
      state.stats = {
        totalAgents: state.agentHistory.filter(
          (agent) => agent.agentType !== 'report'
        ).length,
        totalReports: state.reportHistory.filter((scan) => scan.reportId).length,
        totalWorkflows: state.workflows.length,
        totalWorkflowDefs: state.workFlowDefs.length,
        waitingOnUser: state.workflows.filter(
          (w) => w.workflowStatus === 'Waiting on User'
        ).length,
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getOverviewData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getOverviewData.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.userId = action.payload.userId;
        state.agentHistory = action.payload.agentHistory || [];
        state.reportHistory = action.payload.reportHistory || [];
        state.workflows = action.payload.workflowHistory || [];
        state.workFlowDefs = action.payload.workFlowDefs || [];
        state.agentPermissionProfiles =
          action.payload.agentPermissionProfiles || [];
        state.lastFetched = new Date().toISOString();

        // Update computed stats
        const reportsCount = state.reportHistory.filter((scan) => scan.reportId).length;
        state.stats = {
          totalAgents: state.agentHistory.filter(
            (agent) => agent.agentType !== 'report'
          ).length,
          totalPermissionProfiles: state.agentPermissionProfiles.length,
          totalReports: reportsCount,
          totalWorkflows: state.workflows.length,
          totalWorkflowDefs: state.workFlowDefs.length,
          waitingOnUser: state.workflows.filter(
            (w) => w.workflowStatus === 'Waiting on User'
          ).length,
        };

      })
      .addCase(getOverviewData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      });
  },
});

export const { clearOverviewData, updateStats } = overviewSlice.actions;
export default overviewSlice.reducer;
