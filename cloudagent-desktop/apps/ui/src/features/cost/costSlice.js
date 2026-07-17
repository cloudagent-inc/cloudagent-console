import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { logout } from '../auth/authSlice';
import { evaluateAwsCostAnalysis, launchAwsScannerBatch } from '../../api/scanner';
import { DEFAULT_HEALTH_MAX_AGE_HOURS, isFreshTimestamp } from '../health/healthUtils';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';

const initialState = {
  environmentRequestsById: {},
  environmentResultsById: {},
};

const normalizeCostRequestOptions = (params = {}) => {
  const maxAgeHours = Number(params.maxAgeHours);
  return {
    forceRefresh: Boolean(params.forceRefresh),
    maxAgeHours:
      Number.isFinite(maxAgeHours) && maxAgeHours > 0
        ? maxAgeHours
        : DEFAULT_HEALTH_MAX_AGE_HOURS,
  };
};

const getCostGeneratedAt = (value = {}) =>
  value?.generatedAt || value?.createdAt || value?.timestamp || '';

const getCostRecordTimestamp = (record) =>
  getCostGeneratedAt(record) ||
  getCostGeneratedAt(record?.payload) ||
  getCostGeneratedAt(record?.payload?.analysis?.cost) ||
  record?.updatedAt ||
  '';

const hasFreshCostRecord = (record, maxAgeHours = DEFAULT_HEALTH_MAX_AGE_HOURS) =>
  isFreshTimestamp(getCostRecordTimestamp(record), maxAgeHours);

const getScannerConnectionId = (state) =>
  String(state?.operations?.scannerUpdatesConnectionId || '').trim();

const normalizeCostTargets = (params = {}) => {
  if (Array.isArray(params.targets)) {
    return params.targets
      .map((target) => ({
        permissionProfileId: String(
          target?.permissionProfileId || target?.agentPermissionProfileId || ''
        ).trim(),
        cloudProvider: String(target?.cloudProvider || target?.provider || params.cloudProvider || 'aws')
          .trim()
          .toLowerCase() || 'aws',
      }))
      .filter((target) => target.permissionProfileId);
  }

  const permissionProfileId = String(
    params.permissionProfileId || params.agentPermissionProfileId || ''
  ).trim();
  return permissionProfileId
    ? [{
        permissionProfileId,
        cloudProvider: String(params.cloudProvider || params.provider || 'aws').trim().toLowerCase() || 'aws',
      }]
    : [];
};

const groupCostTargetsByProvider = (targets = []) =>
  targets.reduce((acc, target) => {
    const cloudProvider = String(target?.cloudProvider || 'aws').trim().toLowerCase() || 'aws';
    if (!acc[cloudProvider]) acc[cloudProvider] = [];
    acc[cloudProvider].push(target);
    return acc;
  }, {});

export const launchEnvironmentCostScans = createAsyncThunk(
  'cost/launchEnvironmentCostScans',
  async (params = {}, { getState, rejectWithValue }) => {
    const targets = normalizeCostTargets(params);
    if (targets.length === 0) {
      return rejectWithValue('No environments selected for cost analysis');
    }

    const localRuntime = isLocalRuntime();
    const websocketConnectionId = getScannerConnectionId(getState());
    if (!localRuntime && !websocketConnectionId) {
      console.warn('[cost/launchEnvironmentCostScans] Scanner websocket connection is not ready', {
        targets,
        params,
        connectionId: websocketConnectionId,
      });
      return rejectWithValue(
        'Scanner updates connection is not ready. Check the dashboard console for websocket logs.'
      );
    }

    try {
      console.info('[cost/launchEnvironmentCostScans] Launching cost scanner batch', {
        targetCount: targets.length,
        targets,
        websocketConnectionId,
        forceRefresh: params.forceRefresh !== false,
      });
      const targetsByProvider = groupCostTargetsByProvider(targets);
      const launches = await Promise.all(
        Object.entries(targetsByProvider).map(([cloudProvider, providerTargets]) =>
          launchAwsScannerBatch({
            cloudProvider,
            reportType: 'cost',
            websocketConnectionId,
            targets: providerTargets.map(({ cloudProvider: _cloudProvider, ...target }) => target),
            forceRefresh: params.forceRefresh !== false,
          })
        )
      );

      let results = [];
      let failures = [];
      if (localRuntime) {
        const settled = await Promise.allSettled(
          targets.map(async (target) => {
            const payload = await evaluateAwsCostAnalysis({
              permissionProfileId: target.permissionProfileId,
              cloudProvider: target.cloudProvider || params.cloudProvider || 'aws',
              forceRefresh: false,
            });
            const updatedAt = new Date().toISOString();
            return {
              permissionProfileId: target.permissionProfileId,
              payload,
              generatedAt:
                getCostGeneratedAt(payload) ||
                getCostGeneratedAt(payload?.analysis?.cost) ||
                updatedAt,
            };
          })
        );
        results = settled
          .filter((result) => result.status === 'fulfilled')
          .map((result) => result.value);
        failures = [
          ...(Array.isArray(launches?.[0]?.failures) ? launches[0].failures : []),
          ...settled
            .map((result, index) => {
              if (result.status !== 'rejected') return null;
              return {
                permissionProfileId: targets[index]?.permissionProfileId,
                message: result.reason?.message || 'Failed to fetch local cost artifact',
              };
            })
            .filter(Boolean),
        ];
      }

      return {
        targets,
        payload: launches.length === 1 ? launches[0] : { ok: true, launches },
        results,
        failures,
        startedAt: new Date().toISOString(),
        params: normalizeCostRequestOptions({ ...params, forceRefresh: true }),
      };
    } catch (error) {
      console.error('[cost/launchEnvironmentCostScans] Failed to launch cost scanner batch', {
        targets,
        params,
        message: error?.message || String(error),
      });
      return rejectWithValue(error?.message || 'Failed to start cost analysis');
    }
  }
);

export const refreshEnvironmentCostAnalysis = createAsyncThunk(
  'cost/refreshEnvironmentCostAnalysis',
  async (params = {}, { rejectWithValue }) => {
    const permissionProfileId = String(
      params.permissionProfileId || params.agentPermissionProfileId || ''
    ).trim();
    const options = normalizeCostRequestOptions(params);

    try {
      const payload = await evaluateAwsCostAnalysis({
        agentPermissionProfileId: permissionProfileId,
        cloudProvider: params.cloudProvider || 'aws',
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
        getCostGeneratedAt(payload) ||
        getCostGeneratedAt(payload?.analysis?.cost) ||
        updatedAt;
      return {
        permissionProfileId,
        payload,
        updatedAt,
        generatedAt,
        params: options,
      };
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to refresh cost analysis');
    }
  },
  {
    condition: (params = {}, { getState }) => {
      const permissionProfileId = String(
        params.permissionProfileId || params.agentPermissionProfileId || ''
      ).trim();
      if (!permissionProfileId) return false;

      const state = getState();
      const options = normalizeCostRequestOptions(params);
      const request = state.cost?.environmentRequestsById?.[permissionProfileId];
      if (request?.status === 'loading' && !params.allowWhileLoading) {
        return false;
      }

      if (options.forceRefresh) {
        return true;
      }

      const existing = state.cost?.environmentResultsById?.[permissionProfileId];
      return !hasFreshCostRecord(existing, options.maxAgeHours);
    },
  }
);

const costSlice = createSlice({
  name: 'cost',
  initialState,
  reducers: {
    clearCostState: () => initialState,
    markEnvironmentCostScanFailed: (state, action) => {
      const permissionProfileId = String(action.payload?.permissionProfileId || '').trim();
      if (!permissionProfileId) return;
      state.environmentRequestsById[permissionProfileId] = {
        status: 'failed',
        error: action.payload?.error || 'Failed to refresh cost analysis',
        startedAt: state.environmentRequestsById[permissionProfileId]?.startedAt || null,
        finishedAt: new Date().toISOString(),
        params:
          state.environmentRequestsById[permissionProfileId]?.params ||
          normalizeCostRequestOptions({ forceRefresh: true }),
      };
    },
    markEnvironmentCostScanReady: (state, action) => {
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
          normalizeCostRequestOptions({ forceRefresh: true }),
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => initialState)
      .addCase(launchEnvironmentCostScans.pending, (state, action) => {
        normalizeCostTargets(action.meta.arg).forEach(({ permissionProfileId }) => {
          state.environmentRequestsById[permissionProfileId] = {
            status: 'loading',
            error: null,
            startedAt: new Date().toISOString(),
            finishedAt: null,
            params: normalizeCostRequestOptions({ ...action.meta.arg, forceRefresh: true }),
          };
        });
      })
      .addCase(launchEnvironmentCostScans.fulfilled, (state, action) => {
        const startedAt = action.payload?.startedAt || new Date().toISOString();
        const params = action.payload?.params || normalizeCostRequestOptions({ forceRefresh: true });
        const localResults = Array.isArray(action.payload?.results) ? action.payload.results : [];
        const localFailures = Array.isArray(action.payload?.failures) ? action.payload.failures : [];
        if (localResults.length > 0 || localFailures.length > 0) {
          const updatedAt = new Date().toISOString();
          localResults.forEach(({ permissionProfileId, payload, generatedAt }) => {
            if (!permissionProfileId) return;
            state.environmentRequestsById[permissionProfileId] = {
              status: 'succeeded',
              error: null,
              startedAt: state.environmentRequestsById[permissionProfileId]?.startedAt || startedAt,
              finishedAt: updatedAt,
              params,
            };
            state.environmentResultsById[permissionProfileId] = {
              payload,
              updatedAt,
              generatedAt: generatedAt || updatedAt,
              params,
            };
          });
          localFailures.forEach((failure) => {
            const permissionProfileId = String(failure?.permissionProfileId || '').trim();
            if (!permissionProfileId) return;
            state.environmentRequestsById[permissionProfileId] = {
              status: 'failed',
              error: failure?.message || failure?.error || 'Failed to run local cost scan',
              startedAt: state.environmentRequestsById[permissionProfileId]?.startedAt || startedAt,
              finishedAt: updatedAt,
              params,
            };
          });
          return;
        }
        (action.payload?.targets || []).forEach(({ permissionProfileId }) => {
          state.environmentRequestsById[permissionProfileId] = {
            status: 'loading',
            error: null,
            startedAt: state.environmentRequestsById[permissionProfileId]?.startedAt || startedAt,
            finishedAt: null,
            params,
          };
        });
      })
      .addCase(launchEnvironmentCostScans.rejected, (state, action) => {
        if (action.meta.condition) return;
        const error = action.payload || action.error?.message || 'Failed to start cost analysis';
        normalizeCostTargets(action.meta.arg).forEach(({ permissionProfileId }) => {
          state.environmentRequestsById[permissionProfileId] = {
            status: 'failed',
            error,
            startedAt: state.environmentRequestsById[permissionProfileId]?.startedAt || null,
            finishedAt: new Date().toISOString(),
            params: normalizeCostRequestOptions({ ...action.meta.arg, forceRefresh: true }),
          };
        });
      })
      .addCase(refreshEnvironmentCostAnalysis.pending, (state, action) => {
        const permissionProfileId = String(
          action.meta.arg?.permissionProfileId || action.meta.arg?.agentPermissionProfileId || ''
        ).trim();
        if (!permissionProfileId) return;
        state.environmentRequestsById[permissionProfileId] = {
          status: 'loading',
          error: null,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          params: normalizeCostRequestOptions(action.meta.arg),
        };
      })
      .addCase(refreshEnvironmentCostAnalysis.fulfilled, (state, action) => {
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
      .addCase(refreshEnvironmentCostAnalysis.rejected, (state, action) => {
        const permissionProfileId = String(
          action.meta.arg?.permissionProfileId || action.meta.arg?.agentPermissionProfileId || ''
        ).trim();
        if (!permissionProfileId || action.meta.condition) return;
        state.environmentRequestsById[permissionProfileId] = {
          status: 'failed',
          error: action.payload || action.error?.message || 'Failed to refresh cost analysis',
          startedAt: state.environmentRequestsById[permissionProfileId]?.startedAt || null,
          finishedAt: new Date().toISOString(),
          params: normalizeCostRequestOptions(action.meta.arg),
        };
      });
  },
});

export const {
  clearCostState,
  markEnvironmentCostScanFailed,
  markEnvironmentCostScanReady,
} = costSlice.actions;

export const selectEnvironmentCostRequestsById = (state) =>
  state.cost?.environmentRequestsById || {};

export const selectEnvironmentCostResultsById = (state) =>
  state.cost?.environmentResultsById || {};

export const selectHasFreshEnvironmentCostResult = (
  state,
  permissionProfileId,
  maxAgeHours = DEFAULT_HEALTH_MAX_AGE_HOURS
) => hasFreshCostRecord(state.cost?.environmentResultsById?.[permissionProfileId], maxAgeHours);

export default costSlice.reducer;
