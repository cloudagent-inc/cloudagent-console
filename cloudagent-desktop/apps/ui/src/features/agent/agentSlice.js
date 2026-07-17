import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { agentRunsClient } from '@/api/clients/agentRunsClient';
import { permissionProfilesClient } from '@/api/clients/permissionProfilesClient';
import {
  updateUserProfile,
  updateSingleProfileInState,
  removeProfileFromState,
  addProfileToState,
  updateUserAgentSettings,
} from '../auth/authSlice';

const LOCAL_UNLIMITED_AGENT_CREDITS = {
  monthlyBaseCredits: Number.MAX_SAFE_INTEGER,
  adhocCredits: 0,
};

const normalizeWorkloadIdForProfile = (value) => {
  if (value == null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;

  const lower = normalized.toLowerCase();
  if (
    ['omit', ':omit', ':omit:', 'null', 'undefined', 'none', 'new', 'auto', 'n/a', 'na'].includes(lower) ||
    /^:[a-z_]+:?$/i.test(normalized)
  ) {
    return null;
  }

  return normalized;
};

export const recordAgentConnection = createAsyncThunk(
  'agent/recordConnection',
  async (
    { itemId, agentType, status, parentId, log, authProfile, title },
    { dispatch, rejectWithValue }
  ) => {
    const normalizedAgentType =
      typeof agentType === 'string'
        ? agentType.toLowerCase() === 'blueprint'
          ? 'agent'
          : agentType
        : 'agent';

    try {
      const record = await agentRunsClient.create({
        itemId,
        agentType: normalizedAgentType,
        status,
        parentId,
        log,
        authProfile,
        title,
      });

      if (record) {
        dispatch(updateUserProfile({ agentHistory: record }));
      }

      return record;
    } catch (error) {
      console.log('error', error);
      return rejectWithValue(error.message);
    }
  }
);

export const updateAgentConnection = createAsyncThunk(
  'agent/updateConnection',
  async (
    { recordId, status, log, scanId, authProfile },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const localUpdate = {
        recordId,
        ...(status !== undefined ? { status } : {}),
        ...(log !== undefined ? { log } : {}),
        ...(scanId !== undefined ? { scanId: scanId || '' } : {}),
        ...(authProfile !== undefined ? { authProfile } : {}),
      };
      const updatedRecord = await agentRunsClient.update(localUpdate);
      dispatch(
        updateUserProfile({
          agentHistory: updatedRecord,
        })
      );

      return updatedRecord;
    } catch (error) {
      console.log(error);
      return rejectWithValue(error.message);
    }
  }
);

export const cancelAgentConnection = createAsyncThunk(
  'agent/cancelConnection',
  async ({ recordId, log }, { dispatch, rejectWithValue }) => {
    try {
      const updatedRecord = await agentRunsClient.cancel({ recordId, log });
      dispatch(
        updateUserProfile({
          agentHistory: updatedRecord,
        })
      );

      return updatedRecord;
    } catch (error) {
      console.log(error);
      return rejectWithValue(error.message);
    }
  }
);

export const updateUserCredits = createAsyncThunk(
  'agent/updateCredits',
  async ({ credits, idempotencyKey, source = 'frontend', resourceType = 'legacy', resourceId = null, runId = null, metadata = {} }, { dispatch, rejectWithValue }) => {
    try {
      const agentCredits = LOCAL_UNLIMITED_AGENT_CREDITS;
      dispatch(updateUserProfile({ agentCredits }));
      return { ok: true, agentCredits };
    } catch (error) {
      console.log('error', error);
      return rejectWithValue(error.message);
    }
  }
);

export const refreshUserCredits = createAsyncThunk(
  'agent/refreshCredits',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const agentCredits = LOCAL_UNLIMITED_AGENT_CREDITS;
      dispatch(
        updateUserProfile({
          agentCredits,
        })
      );

      return agentCredits;
    } catch (error) {
      console.log('error', error);
      return rejectWithValue(error.message);
    }
  }
);

export const createAgentPermissionProfile = createAsyncThunk(
  'agent/createAgentPermissionProfile',
  async (profileData, { rejectWithValue, dispatch }) => {
    try {
      // Transform the data to match the new schema
      const { 
        name, 
        description,
        type, // 'aws account' or 'google_workspace'
        awsAccountId,
        authType,
        roleName,
        externalId,
        accessKeyId,
        secretAccessKey,
        sessionToken,
        stackArn,
        deploymentPreferences,
        securityRules,
        authProfile: preBuiltAuthProfile, // For Google Workspace, authProfile is pre-built
      } = profileData;

      let authProfileString;
      let profileType = type || 'aws account';

      // Check if authProfile is already provided (e.g., for Google Workspace)
      if (preBuiltAuthProfile) {
        // If it's already a string, use it directly; otherwise stringify it
        authProfileString = typeof preBuiltAuthProfile === 'string' 
          ? preBuiltAuthProfile 
          : JSON.stringify(preBuiltAuthProfile);
      } else {
        // Build the authProfile object for AWS with all auth-related data
        const authProfile = {
          awsAccountId,
          authType,
          ...(authType === 'role' 
            ? { roleName, externalId }
            : { accessKeyId, secretAccessKey, sessionToken }
          ),
        };

        if (stackArn) {
          authProfile.stackArn = stackArn;
        }

        authProfileString = JSON.stringify(authProfile);
      }

      const transformedData = {
        name,
        type: profileType,
        description,
        authProfile: authProfileString,
        deploymentPreferences,
        securityRules
      };

      const newProfile = await permissionProfilesClient.create(transformedData);

      dispatch(addProfileToState(newProfile));

      return newProfile;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateAgentPermissionProfile = createAsyncThunk(
  'agent/updateAgentPermissionProfile',
  async (profileData, { rejectWithValue, dispatch, getState }) => {
    try {
      // Transform the data to match the new schema
      const { 
        recordId,
        name, 
        type,
        description,
        authProfile: preBuiltAuthProfile,
        awsAccountId,
        authType,
        roleName,
        externalId,
        accessKeyId,
        secretAccessKey,
        sessionToken,
        stackArn,
        workloadId,
        deploymentPreferences,
        securityRules
      } = profileData;

      // Preserve existing profile details so updates remain additive
      const state = getState();
      const existingProfile = state?.auth?.userProfile?.agentPermissionProfiles?.find(
        (p) => p.recordId === recordId
      );
      const rawAuthProfile = existingProfile?.authProfile;
      let existingAuthProfile = {};

      if (typeof rawAuthProfile === 'string') {
        try {
          existingAuthProfile = JSON.parse(rawAuthProfile) || {};
        } catch (_) {
          existingAuthProfile = {};
        }
      } else if (rawAuthProfile && typeof rawAuthProfile === 'object') {
        existingAuthProfile = rawAuthProfile;
      }

      const nextAuthProfile = { ...existingAuthProfile };

      if (awsAccountId !== undefined) {
        nextAuthProfile.awsAccountId = awsAccountId;
      }
      if (authType !== undefined) {
        nextAuthProfile.authType = authType;
        if (authType === 'role') {
          delete nextAuthProfile.accessKeyId;
          delete nextAuthProfile.secretAccessKey;
          delete nextAuthProfile.sessionToken;
        } else if (authType === 'credentials') {
          delete nextAuthProfile.roleName;
          delete nextAuthProfile.externalId;
        }
      }

      const effectiveAuthType =
        authType !== undefined
          ? authType
          : nextAuthProfile.authType || existingAuthProfile.authType;

      if (effectiveAuthType === 'role') {
        delete nextAuthProfile.accessKeyId;
        delete nextAuthProfile.secretAccessKey;
        delete nextAuthProfile.sessionToken;
        if (roleName !== undefined) nextAuthProfile.roleName = roleName;
        if (externalId !== undefined) nextAuthProfile.externalId = externalId;
      } else if (effectiveAuthType === 'credentials') {
        delete nextAuthProfile.roleName;
        delete nextAuthProfile.externalId;
        if (accessKeyId !== undefined) nextAuthProfile.accessKeyId = accessKeyId;
        if (secretAccessKey !== undefined) nextAuthProfile.secretAccessKey = secretAccessKey;
        if (sessionToken !== undefined) nextAuthProfile.sessionToken = sessionToken;
      } else {
        if (roleName !== undefined) nextAuthProfile.roleName = roleName;
        if (externalId !== undefined) nextAuthProfile.externalId = externalId;
        if (accessKeyId !== undefined) nextAuthProfile.accessKeyId = accessKeyId;
        if (secretAccessKey !== undefined) nextAuthProfile.secretAccessKey = secretAccessKey;
        if (sessionToken !== undefined) nextAuthProfile.sessionToken = sessionToken;
      }

      if (stackArn !== undefined) {
        if (stackArn) {
          nextAuthProfile.stackArn = stackArn;
        } else {
          delete nextAuthProfile.stackArn;
        }
      }

      if (workloadId !== undefined) {
        const normalizedWorkloadId = normalizeWorkloadIdForProfile(workloadId);
        if (workloadId === null || workloadId === '') {
          delete nextAuthProfile.workloadId;
        } else if (normalizedWorkloadId) {
          nextAuthProfile.workloadId = normalizedWorkloadId;
        } else {
          console.warn(
            '[agentSlice.updateAgentPermissionProfile] Ignoring invalid workloadId',
            workloadId
          );
        }
      }

      const shouldSendAuthProfile =
        preBuiltAuthProfile !== undefined ||
        existingProfile?.authProfile !== undefined ||
        [
          awsAccountId,
          authType,
          roleName,
          externalId,
          accessKeyId,
          secretAccessKey,
          sessionToken,
          stackArn,
          workloadId,
        ].some((v) => v !== undefined);

      const transformedData = {
        recordId,
      };

      const resolvedName = name !== undefined ? name : existingProfile?.name;
      if (resolvedName !== undefined) {
        transformedData.name = resolvedName;
      }

      const resolvedType = type !== undefined ? type : existingProfile?.type;
      if (resolvedType !== undefined) {
        transformedData.type = resolvedType;
      }

      const resolvedDescription =
        description !== undefined ? description : existingProfile?.description;
      if (resolvedDescription !== undefined) {
        transformedData.description = resolvedDescription;
      }

      if (shouldSendAuthProfile) {
        const authProfilePayload =
          preBuiltAuthProfile !== undefined
            ? typeof preBuiltAuthProfile === 'string'
              ? preBuiltAuthProfile
              : JSON.stringify(preBuiltAuthProfile || {})
            : Object.keys(nextAuthProfile).length > 0
              ? JSON.stringify(nextAuthProfile)
              : typeof existingProfile?.authProfile === 'string'
                ? existingProfile.authProfile
                : existingProfile?.authProfile
                  ? JSON.stringify(existingProfile.authProfile)
                  : JSON.stringify({});
        transformedData.authProfile = authProfilePayload;
      }

      const resolvedDeploymentPreferences =
        deploymentPreferences !== undefined
          ? deploymentPreferences
          : existingProfile?.deploymentPreferences;
      if (resolvedDeploymentPreferences !== undefined) {
        transformedData.deploymentPreferences = resolvedDeploymentPreferences;
      }

      const resolvedSecurityRules =
        securityRules !== undefined ? securityRules : existingProfile?.securityRules;
      if (resolvedSecurityRules !== undefined) {
        transformedData.securityRules = resolvedSecurityRules;
      }

      const updatedProfile = await permissionProfilesClient.update(transformedData);

      dispatch(updateSingleProfileInState(updatedProfile));

      return updatedProfile;
    } catch (error) {
      console.log('error updateAgentPermissionProfile', error);
      return rejectWithValue(error.message);
    }
  }
);

export const deleteAgentPermissionProfile = createAsyncThunk(
  'agent/deleteAgentPermissionProfile',
  async ({ recordId }, { rejectWithValue, dispatch }) => {
    try {
      const deletedProfile = await permissionProfilesClient.delete(recordId);

      dispatch(removeProfileFromState(recordId));

      return deletedProfile;
    } catch (error) {
      console.error('Error deleting agent permission profile:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const getAgentHistory = createAsyncThunk(
  'agent/getAgentHistory',
  async (
    {
      count = 200,
      nextToken = null,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      agentType = null,
      monthsOffset = 0,
      startDateOverride = null,
      endDateOverride = null,
    } = {},
    { rejectWithValue }
  ) => {
    try {
      const resolvedEndDate = endDateOverride || (() => {
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() - monthsOffset);
        return endDate.toISOString();
      })();

      const resolvedStartDate = startDateOverride || (() => {
        const startDate = new Date(resolvedEndDate);
        startDate.setMonth(startDate.getMonth() - 3);
        return startDate.toISOString();
      })();

      return {
        ...(await agentRunsClient.list({
          count,
          nextToken,
          sortBy,
          sortOrder,
          agentType,
          startDate: resolvedStartDate,
          endDate: resolvedEndDate,
        })),
        requestedNextToken: nextToken,
        monthsOffset,
        startDate: resolvedStartDate,
        endDate: resolvedEndDate,
      };
    } catch (error) {
      console.log('error', error);
      return rejectWithValue(error.message);
    }
  }
);

/**
 * @deprecated Reports are now stored in accountScans, not agentHistory.
 * Use accountScans from userProfile instead.
 * This thunk is kept for backward compatibility but should not be used for new code.
 */
export const getReportHistory = createAsyncThunk(
  'report/getReportHistory',
  async (
    {
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      agentType = null,
      monthsOffset = 0,
    } = {},
    { rejectWithValue }
  ) => {
    console.warn('getReportHistory is deprecated. Reports are now in accountScans. Use accountScans from userProfile instead.');
    try {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() - monthsOffset);

      const startDate = new Date(endDate);
      startDate.setMonth(startDate.getMonth() - 3);

      return {
        ...(await agentRunsClient.list({
          count: 200,
          nextToken: null,
          sortBy,
          sortOrder,
          agentType,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })),
        monthsOffset,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const getAgentCount = createAsyncThunk(
  'agent/getAgentCount',
  async (_, { rejectWithValue }) => {
    try {
      const response = await agentRunsClient.list({ count: 200 });
      return { totalCount: Array.isArray(response?.items) ? response.items.length : 0 };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const getAgentConnection = createAsyncThunk(
  'agent/getAgentConnection',
  async (recordId, { rejectWithValue }) => {
    try {
      return await agentRunsClient.get(recordId);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateUserAgent = createAsyncThunk(
  'agent/updateUserAgent',
  async (
    { allowOverages, mcpToken },
    { dispatch, rejectWithValue, getState }
  ) => {
    try {
      const state = getState();
      const userId = state.auth.userProfile?.userId;

      if (!userId) {
        throw new Error('User ID not found');
      }

      const updatedUser = { userId, allowOverages, mcpToken };

      dispatch(
        updateUserAgentSettings({
          allowOverages: updatedUser.allowOverages,
          mcpToken: updatedUser.mcpToken,
        })
      );

      return updatedUser;
    } catch (error) {
      console.error('Error updating user agent settings:', error);
      return rejectWithValue(error.message);
    }
  }
);

// Slice: Agent
const agentSlice = createSlice({
  name: 'agent',
  initialState: {
    loading: false,
    error: null,
    purchasedAgents: [],
    deleteLoading: false,
    agentHistory: [],
    nextToken: null,
    hasMoreAgents: false,
    totalCount: null,
    countLoading: false,
    countError: null,
    currentAgentConnection: null,
    connectionLoading: false,
    isRegionModalOpen: false,
    reportHistory: [],
    hasMoreReports: false,
    currentMonthsOffset: 0,
    hasMoreTimeWindows: true,
    loadedTimeWindows: [],
    currentMonthsOffsetReport: 0,
    hasMoreTimeWindowsReport: true,
    loadedTimeWindowsReport: [],
  },
  reducers: {
    addAgentHistory: (state, action) => {
      state.purchasedAgents.push(action.payload);
    },
    setIsRegionModalOpen: (state, action) => {
      state.isRegionModalOpen = action.payload;
    },
    toggleRegionModal: (state) => {
      state.isRegionModalOpen = !state.isRegionModalOpen;
    },
    resetAgentHistory: (state) => {
      state.agentHistory = [];
      state.nextToken = null;
      state.hasMoreAgents = false;
      state.currentMonthsOffset = 0;
      state.hasMoreTimeWindows = true;
      state.loadedTimeWindows = [];
    },
    resetReportHistory: (state) => {
      state.reportHistory = [];
      state.currentMonthsOffsetReport = 0;
      state.hasMoreTimeWindowsReport = true;
      state.loadedTimeWindowsReport = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(recordAgentConnection.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(recordAgentConnection.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(recordAgentConnection.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(updateAgentConnection.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateAgentConnection.fulfilled, (state, action) => {
        state.loading = false;
        const updatedRecord = action.payload?.recordId
          ? action.payload
          : action.meta.arg;

        if (!updatedRecord?.recordId) {
          return;
        }

        const existingIndex = state.agentHistory.findIndex(
          (record) => record?.recordId === updatedRecord.recordId
        );

        if (existingIndex !== -1) {
          state.agentHistory[existingIndex] = {
            ...state.agentHistory[existingIndex],
            ...updatedRecord,
          };
        }
      })
      .addCase(updateAgentConnection.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(cancelAgentConnection.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(cancelAgentConnection.fulfilled, (state, action) => {
        state.loading = false;
        const updatedRecord = action.payload?.recordId
          ? action.payload
          : action.meta.arg;

        if (!updatedRecord?.recordId) {
          return;
        }

        const existingIndex = state.agentHistory.findIndex(
          (record) => record?.recordId === updatedRecord.recordId
        );

        if (existingIndex !== -1) {
          state.agentHistory[existingIndex] = {
            ...state.agentHistory[existingIndex],
            ...updatedRecord,
          };
        }
      })
      .addCase(cancelAgentConnection.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(updateUserCredits.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUserCredits.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(updateUserCredits.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })

      .addCase(deleteAgentPermissionProfile.pending, (state) => {
        state.deleteLoading = true;
      })
      .addCase(deleteAgentPermissionProfile.fulfilled, (state) => {
        state.deleteLoading = false;
        state.error = null;
      })
      .addCase(deleteAgentPermissionProfile.rejected, (state, action) => {
        state.deleteLoading = false;
        state.error = action.payload;
      })
      .addCase(getAgentHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAgentHistory.fulfilled, (state, action) => {
        const payload = action.payload || {};
        const items = Array.isArray(payload.items) ? payload.items : [];
        const nextToken = payload.nextToken ?? null;
        const monthsOffset = Number.isFinite(payload.monthsOffset)
          ? payload.monthsOffset
          : 0;
        const startDate = payload.startDate || null;
        const endDate = payload.endDate || null;
        const requestedNextToken = payload.requestedNextToken ?? null;
        const isContinuation = Boolean(requestedNextToken);
        const existingWindowIndex = state.loadedTimeWindows.findIndex(
          (window) => window?.monthsOffset === monthsOffset
        );

        if (monthsOffset === 0 && !isContinuation) {
          state.agentHistory = items;
          state.loadedTimeWindows = [
            { monthsOffset, startDate, endDate, count: items.length },
          ];
        } else if (isContinuation) {
          state.agentHistory = [...state.agentHistory, ...items];

          if (existingWindowIndex === -1) {
            state.loadedTimeWindows.push({
              monthsOffset,
              startDate,
              endDate,
              count: items.length,
            });
          } else {
            state.loadedTimeWindows[existingWindowIndex] = {
              ...state.loadedTimeWindows[existingWindowIndex],
              startDate,
              endDate,
              count:
                (state.loadedTimeWindows[existingWindowIndex]?.count || 0) +
                items.length,
            };
          }
        } else {
          state.agentHistory = [...state.agentHistory, ...items];
          if (existingWindowIndex === -1) {
            state.loadedTimeWindows.push({
              monthsOffset,
              startDate,
              endDate,
              count: items.length,
            });
          } else {
            state.loadedTimeWindows[existingWindowIndex] = {
              ...state.loadedTimeWindows[existingWindowIndex],
              startDate,
              endDate,
              count: items.length,
            };
          }
        }

        state.currentMonthsOffset = monthsOffset;
        state.nextToken = nextToken;
        state.hasMoreAgents = Boolean(nextToken);

        state.hasMoreTimeWindows =
          Boolean(nextToken) ||
          isContinuation ||
          items.length > 0 ||
          monthsOffset === 0;

        state.loading = false;
      })
      .addCase(getAgentHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(getAgentCount.pending, (state) => {
        state.countLoading = true;
        state.countError = null;
      })
      .addCase(getAgentCount.fulfilled, (state, action) => {
        state.countLoading = false;
        state.totalCount = action.payload.totalCount;
      })
      .addCase(getAgentCount.rejected, (state, action) => {
        state.countLoading = false;
        state.countError = action.payload;
      })
      .addCase(getAgentConnection.pending, (state) => {
        state.connectionLoading = true;
        state.connectionError = null;
      })
      .addCase(getAgentConnection.fulfilled, (state, action) => {
        state.connectionLoading = false;
        state.currentAgentConnection = action.payload;
      })
      .addCase(getAgentConnection.rejected, (state, action) => {
        state.connectionLoading = false;
        state.connectionError = action.payload;
      })
      .addCase(getReportHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getReportHistory.fulfilled, (state, action) => {
        const payload = action.payload || {};
        const items = Array.isArray(payload.items) ? payload.items : [];
        const monthsOffset = Number.isFinite(payload.monthsOffset)
          ? payload.monthsOffset
          : 0;
        const startDate = payload.startDate || null;
        const endDate = payload.endDate || null;

        if (monthsOffset === 0) {
          state.reportHistory = items;
          state.loadedTimeWindowsReport = [
            { monthsOffset, startDate, endDate, count: items.length },
          ];
        } else {
          state.reportHistory = [...state.reportHistory, ...items];
          state.loadedTimeWindowsReport.push({
            monthsOffset,
            startDate,
            endDate,
            count: items.length,
          });
        }

        state.currentMonthsOffsetReport = monthsOffset;

        state.hasMoreTimeWindowsReport = items.length > 0;

        state.loading = false;
      })
      .addCase(getReportHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(updateUserAgent.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUserAgent.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(updateUserAgent.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      });
  },
});

export const {
  addAgentHistory,
  setIsRegionModalOpen,
  toggleRegionModal,
  resetAgentHistory,
  resetReportHistory,
} = agentSlice.actions;
export default agentSlice.reducer;
