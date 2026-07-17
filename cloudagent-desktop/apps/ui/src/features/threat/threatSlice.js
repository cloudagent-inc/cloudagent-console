import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { logout } from '../auth/authSlice';
import { evaluateAwsThreatDetection, launchAwsScannerBatch } from '../../api/scanner';
import { DEFAULT_HEALTH_MAX_AGE_HOURS, isFreshTimestamp } from '../health/healthUtils';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';

const initialState = {
  environmentRequestsById: {},
  environmentResultsById: {},
};

const normalizeThreatRequestOptions = (params = {}) => {
  const maxAgeHours = Number(params.maxAgeHours);
  return {
    forceRefresh: Boolean(params.forceRefresh),
    maxAgeHours:
      Number.isFinite(maxAgeHours) && maxAgeHours > 0
        ? maxAgeHours
        : DEFAULT_HEALTH_MAX_AGE_HOURS,
  };
};

const getThreatGeneratedAt = (value = {}) =>
  value?.generatedAt || value?.createdAt || value?.timestamp || '';

const getThreatRecordTimestamp = (record) =>
  getThreatGeneratedAt(record) ||
  getThreatGeneratedAt(record?.payload) ||
  getThreatGeneratedAt(record?.payload?.analysis?.threat) ||
  record?.updatedAt ||
  '';

const hasFreshThreatRecord = (record, maxAgeHours = DEFAULT_HEALTH_MAX_AGE_HOURS) =>
  isFreshTimestamp(getThreatRecordTimestamp(record), maxAgeHours);

const getScannerConnectionId = (state) =>
  String(state?.operations?.scannerUpdatesConnectionId || '').trim();

const normalizeThreatTargets = (params = {}) => {
  if (Array.isArray(params.targets)) {
    return params.targets
      .map((target) => ({
        permissionProfileId: String(target?.permissionProfileId || '').trim(),
      }))
      .filter((target) => target.permissionProfileId);
  }

  const permissionProfileId = String(params.permissionProfileId || '').trim();
  return permissionProfileId ? [{ permissionProfileId }] : [];
};

export const launchEnvironmentThreatScans = createAsyncThunk(
  'threat/launchEnvironmentThreatScans',
  async (params = {}, { getState, rejectWithValue }) => {
    const targets = normalizeThreatTargets(params);
    if (targets.length === 0) {
      return rejectWithValue('No environments selected for threat detection');
    }

    const localRuntime = isLocalRuntime();
    const websocketConnectionId = localRuntime ? null : getScannerConnectionId(getState());
    if (!localRuntime && !websocketConnectionId) {
      console.warn('[threat/launchEnvironmentThreatScans] Scanner websocket connection is not ready', {
        targets,
        params,
        connectionId: websocketConnectionId,
      });
      return rejectWithValue(
        'Scanner updates connection is not ready. Check the dashboard console for websocket logs.'
      );
    }

    try {
      console.info('[threat/launchEnvironmentThreatScans] Launching threat scanner batch', {
        targetCount: targets.length,
        targets,
        websocketConnectionId,
        forceRefresh: params.forceRefresh !== false,
      });
      const payload = await launchAwsScannerBatch({
        reportType: 'threat',
        websocketConnectionId,
        targets,
        forceRefresh: params.forceRefresh !== false,
      });
      let localResults = [];
      let localFailures = [];
      if (localRuntime) {
        const settled = await Promise.allSettled(
          targets.map(async ({ permissionProfileId }) => {
            const result = await evaluateAwsThreatDetection({
              permissionProfileId,
              forceRefresh: false,
            });
            if (result?.pending) return null;
            return { permissionProfileId, payload: result };
          })
        );
        localResults = settled
          .filter((result) => result.status === 'fulfilled' && result.value)
          .map((result) => result.value);
        localFailures = [
          ...(Array.isArray(payload?.failures) ? payload.failures : []),
          ...settled
            .map((result, index) => {
              if (result.status !== 'rejected') return null;
              return {
                permissionProfileId: targets[index]?.permissionProfileId,
                message: result.reason?.message || 'Failed to fetch local threat artifact',
              };
            })
            .filter(Boolean),
        ];
      }

      return {
        targets,
        payload,
        localResults,
        localFailures,
        startedAt: new Date().toISOString(),
        params: normalizeThreatRequestOptions({ ...params, forceRefresh: true }),
      };
    } catch (error) {
      console.error('[threat/launchEnvironmentThreatScans] Failed to launch threat scanner batch', {
        targets,
        params,
        message: error?.message || String(error),
      });
      return rejectWithValue(error?.message || 'Failed to start threat detection');
    }
  }
);

export const refreshEnvironmentThreatDetection = createAsyncThunk(
  'threat/refreshEnvironmentThreatDetection',
  async (params = {}, { rejectWithValue }) => {
    const permissionProfileId = String(params.permissionProfileId || '').trim();
    const options = normalizeThreatRequestOptions(params);

    try {
      const payload = await evaluateAwsThreatDetection({
        permissionProfileId,
        forceRefresh: options.forceRefresh,
      });
      if (payload?.pending) {
        return {
          permissionProfileId,
          payload: null,
          updatedAt: null,
          pending: true,
          params: options,
        };
      }
      const updatedAt = new Date().toISOString();
      const generatedAt =
        getThreatGeneratedAt(payload) ||
        getThreatGeneratedAt(payload?.analysis?.threat) ||
        updatedAt;
      return {
        permissionProfileId,
        payload,
        updatedAt,
        generatedAt,
        params: options,
      };
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to refresh threat detection');
    }
  },
  {
    condition: (params = {}, { getState }) => {
      const permissionProfileId = String(params.permissionProfileId || '').trim();
      if (!permissionProfileId) return false;

      const state = getState();
      const options = normalizeThreatRequestOptions(params);
      const request = state.threat?.environmentRequestsById?.[permissionProfileId];
      if (request?.status === 'loading' && !params.allowWhileLoading) {
        return false;
      }

      if (options.forceRefresh) {
        return true;
      }

      const existing = state.threat?.environmentResultsById?.[permissionProfileId];
      return !hasFreshThreatRecord(existing, options.maxAgeHours);
    },
  }
);

const threatSlice = createSlice({
  name: 'threat',
  initialState,
  reducers: {
    clearThreatState: () => initialState,
    markEnvironmentThreatScanFailed: (state, action) => {
      const permissionProfileId = String(action.payload?.permissionProfileId || '').trim();
      if (!permissionProfileId) return;
      state.environmentRequestsById[permissionProfileId] = {
        status: 'failed',
        error: action.payload?.error || 'Failed to refresh threat detection',
        startedAt: state.environmentRequestsById[permissionProfileId]?.startedAt || null,
        finishedAt: new Date().toISOString(),
        params:
          state.environmentRequestsById[permissionProfileId]?.params ||
          normalizeThreatRequestOptions({ forceRefresh: true }),
      };
    },
    markEnvironmentThreatScanReady: (state, action) => {
      const permissionProfileId = String(action.payload?.permissionProfileId || '').trim();
      if (!permissionProfileId) return;
      const finishedAt = action.payload?.generatedAt || new Date().toISOString();
      state.environmentRequestsById[permissionProfileId] = {
        status: 'succeeded',
        error: null,
        startedAt: state.environmentRequestsById[permissionProfileId]?.startedAt || null,
        finishedAt,
        params:
          state.environmentRequestsById[permissionProfileId]?.params ||
          normalizeThreatRequestOptions({ forceRefresh: true }),
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => initialState)
      .addCase(launchEnvironmentThreatScans.pending, (state, action) => {
        normalizeThreatTargets(action.meta.arg).forEach(({ permissionProfileId }) => {
          state.environmentRequestsById[permissionProfileId] = {
            status: 'loading',
            error: null,
            startedAt: new Date().toISOString(),
            finishedAt: null,
            params: normalizeThreatRequestOptions({ ...action.meta.arg, forceRefresh: true }),
          };
        });
      })
      .addCase(launchEnvironmentThreatScans.fulfilled, (state, action) => {
        const startedAt = action.payload?.startedAt || new Date().toISOString();
        const params =
          action.payload?.params || normalizeThreatRequestOptions({ forceRefresh: true });
        const localResults = Array.isArray(action.payload?.localResults) ? action.payload.localResults : [];
        const localFailures = Array.isArray(action.payload?.localFailures) ? action.payload.localFailures : [];
        if (localResults.length > 0 || localFailures.length > 0) {
          const updatedAt = new Date().toISOString();
          localResults.forEach(({ permissionProfileId, payload }) => {
            if (!permissionProfileId) return;
            const generatedAt =
              getThreatGeneratedAt(payload) ||
              getThreatGeneratedAt(payload?.analysis?.threat) ||
              updatedAt;
            state.environmentRequestsById[permissionProfileId] = {
              status: 'succeeded',
              error: null,
              startedAt: state.environmentRequestsById[permissionProfileId]?.startedAt || startedAt,
              finishedAt: generatedAt,
              params,
            };
            state.environmentResultsById[permissionProfileId] = {
              payload,
              updatedAt,
              generatedAt,
              params,
            };
          });
          localFailures.forEach((failure) => {
            const permissionProfileId = String(failure?.permissionProfileId || '').trim();
            if (!permissionProfileId) return;
            state.environmentRequestsById[permissionProfileId] = {
              status: 'failed',
              error: failure?.message || failure?.error || 'Failed to run local threat scan',
              startedAt: state.environmentRequestsById[permissionProfileId]?.startedAt || startedAt,
              finishedAt: updatedAt,
              params,
            };
          });
          return;
        }
        (action.payload?.targets || []).forEach(({ permissionProfileId }) => {
          const localResult = action.payload?.localResultsById?.[permissionProfileId] || null;
          if (localResult) {
            const generatedAt =
              getThreatGeneratedAt(localResult) ||
              getThreatGeneratedAt(localResult?.analysis?.threat) ||
              startedAt;
            state.environmentRequestsById[permissionProfileId] = {
              status: 'succeeded',
              error: null,
              startedAt: state.environmentRequestsById[permissionProfileId]?.startedAt || startedAt,
              finishedAt: generatedAt,
              params,
            };
            state.environmentResultsById[permissionProfileId] = {
              payload: localResult,
              updatedAt: generatedAt,
              generatedAt,
              params,
            };
            return;
          }
          state.environmentRequestsById[permissionProfileId] = {
            status: 'loading',
            error: null,
            startedAt: state.environmentRequestsById[permissionProfileId]?.startedAt || startedAt,
            finishedAt: null,
            params,
          };
        });
      })
      .addCase(launchEnvironmentThreatScans.rejected, (state, action) => {
        if (action.meta.condition) return;
        const error = action.payload || action.error?.message || 'Failed to start threat detection';
        normalizeThreatTargets(action.meta.arg).forEach(({ permissionProfileId }) => {
          state.environmentRequestsById[permissionProfileId] = {
            status: 'failed',
            error,
            startedAt: state.environmentRequestsById[permissionProfileId]?.startedAt || null,
            finishedAt: new Date().toISOString(),
            params: normalizeThreatRequestOptions({ ...action.meta.arg, forceRefresh: true }),
          };
        });
      })
      .addCase(refreshEnvironmentThreatDetection.pending, (state, action) => {
        const permissionProfileId = String(action.meta.arg?.permissionProfileId || '').trim();
        if (!permissionProfileId) return;
        state.environmentRequestsById[permissionProfileId] = {
          status: 'loading',
          error: null,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          params: normalizeThreatRequestOptions(action.meta.arg),
        };
      })
      .addCase(refreshEnvironmentThreatDetection.fulfilled, (state, action) => {
        const { permissionProfileId, payload, updatedAt, generatedAt, pending, params } =
          action.payload || {};
        if (!permissionProfileId) return;
        if (pending) {
          state.environmentRequestsById[permissionProfileId] = {
            status: 'loading',
            error: null,
            startedAt:
              state.environmentRequestsById[permissionProfileId]?.startedAt ||
              new Date().toISOString(),
            finishedAt: null,
            params,
          };
          return;
        }
        state.environmentRequestsById[permissionProfileId] = {
          status: 'succeeded',
          error: null,
          startedAt: state.environmentRequestsById[permissionProfileId]?.startedAt || updatedAt,
          finishedAt: updatedAt,
          params,
        };
        state.environmentResultsById[permissionProfileId] = {
          payload,
          updatedAt,
          generatedAt: generatedAt || updatedAt,
          params,
        };
      })
      .addCase(refreshEnvironmentThreatDetection.rejected, (state, action) => {
        const permissionProfileId = String(action.meta.arg?.permissionProfileId || '').trim();
        if (!permissionProfileId || action.meta.condition) return;
        state.environmentRequestsById[permissionProfileId] = {
          status: 'failed',
          error: action.payload || action.error?.message || 'Failed to refresh threat detection',
          startedAt: state.environmentRequestsById[permissionProfileId]?.startedAt || null,
          finishedAt: new Date().toISOString(),
          params: normalizeThreatRequestOptions(action.meta.arg),
        };
      });
  },
});

export const {
  clearThreatState,
  markEnvironmentThreatScanFailed,
  markEnvironmentThreatScanReady,
} = threatSlice.actions;

export const selectEnvironmentThreatRequestsById = (state) =>
  state.threat?.environmentRequestsById || {};

export const selectEnvironmentThreatResultsById = (state) =>
  state.threat?.environmentResultsById || {};

export const selectHasFreshEnvironmentThreatResult = (
  state,
  permissionProfileId,
  maxAgeHours = DEFAULT_HEALTH_MAX_AGE_HOURS
) => hasFreshThreatRecord(state.threat?.environmentResultsById?.[permissionProfileId], maxAgeHours);

export default threatSlice.reducer;
