import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  logout,
  updateSingleWorkloadInUserProfile,
  updateWorkloadSummaryInUserProfile,
} from '../auth/authSlice';
import { evaluateAwsResourceHealth, launchAwsScannerBatch } from '../../api/scanner';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';
import { updateWorkloadInState, updateWorkloadSummary } from '../workload/workloadSlice';
import {
  buildWorkloadHealthSummaryPatchesFromEnvironmentPayload,
  buildTrackedResourceHealthSummary,
  DEFAULT_HEALTH_LOOKBACK_HOURS,
  DEFAULT_HEALTH_MAX_AGE_HOURS,
  extractHealthResources,
  getHealthGeneratedAt,
  getHealthRecordTimestamp,
  getWorkloadPermissionProfileIds,
  isFreshTimestamp,
  mergeWorkloadHealthResponse,
  normalizeHealthResponseShape,
  parseSummaryObject,
  safeParseJson,
} from './healthUtils';

const initialState = {
  environmentRequestsById: {},
  workloadRequestsById: {},
  environmentResultsById: {},
  workloadResultsById: {},
};

const normalizeHealthRequestOptions = (params = {}) => {
  const lookbackHours = Number(params.lookbackHours);
  const maxAgeHours = Number(params.maxAgeHours);

  return {
    enableCloudWatchLogChecks: Boolean(params.enableCloudWatchLogChecks),
    forceRefresh: Boolean(params.forceRefresh),
    lookbackHours:
      Number.isFinite(lookbackHours) && lookbackHours > 0
        ? lookbackHours
        : DEFAULT_HEALTH_LOOKBACK_HOURS,
    maxAgeHours:
      Number.isFinite(maxAgeHours) && maxAgeHours > 0
        ? maxAgeHours
        : DEFAULT_HEALTH_MAX_AGE_HOURS,
  };
};

const getScannerConnectionId = (state) =>
  String(state?.operations?.scannerUpdatesConnectionId || '').trim();

const normalizeHealthLaunchTargets = (params = {}) => {
  if (Array.isArray(params.targets)) {
    return params.targets
      .map((target) => {
        const permissionProfileId = String(target?.permissionProfileId || '').trim();
        const workloadId = String(target?.workloadId || '').trim();
        const subscriptionIds = Array.isArray(target?.subscriptionIds)
          ? target.subscriptionIds.map((value) => String(value || '').trim()).filter(Boolean)
          : undefined;
        if (permissionProfileId) {
          return {
            permissionProfileId,
            ...(subscriptionIds?.length ? { subscriptionIds } : {}),
          };
        }
        if (workloadId) return { workloadId };
        return null;
      })
      .filter(Boolean);
  }

  const permissionProfileId = String(params.permissionProfileId || '').trim();
  if (permissionProfileId) return [{ permissionProfileId }];

  const workloadId = String(params.workloadId || '').trim();
  return workloadId ? [{ workloadId }] : [];
};

const buildPermissionProfilesByAccount = (profiles = []) => {
  const map = new Map();
  profiles.forEach((profile) => {
    const authProfile = safeParseJson(profile?.authProfile, {});
    const accountId = authProfile?.awsAccountId || authProfile?.aws_account_id;
    const permissionProfileId = profile?.recordId || profile?.id || profile?.permissionProfileId;
    if (!accountId || !permissionProfileId) return;
    map.set(String(accountId), String(permissionProfileId));
  });
  return map;
};

const getMergedWorkloadsById = (state) => {
  const byId = new Map();
  (state?.auth?.userProfile?.workloads || []).forEach((workload) => {
    if (!workload?.workloadId) return;
    byId.set(workload.workloadId, workload);
  });
  (state?.workload?.workloads || []).forEach((workload) => {
    if (!workload?.workloadId) return;
    byId.set(workload.workloadId, {
      ...(byId.get(workload.workloadId) || {}),
      ...workload,
    });
  });
  return byId;
};

const getMergedWorkloadById = (state, workloadId) => {
  const byId = new Map();
  (state?.workload?.workloads || []).forEach((workload) => {
    if (!workload?.workloadId) return;
    byId.set(workload.workloadId, workload);
  });
  (state?.auth?.userProfile?.workloads || []).forEach((workload) => {
    if (!workload?.workloadId) return;
    const current = byId.get(workload.workloadId) || {};
    byId.set(workload.workloadId, {
      ...workload,
      ...current,
    });
  });
  return byId.get(workloadId) || null;
};

const hasFreshHealthRecord = (record, maxAgeHours = DEFAULT_HEALTH_MAX_AGE_HOURS) =>
  isFreshTimestamp(getHealthRecordTimestamp(record), maxAgeHours);

const hasCompatibleHealthParams = (record, options) => {
  if (!record?.params) return true;
  return (
    Boolean(record.params.enableCloudWatchLogChecks) ===
      Boolean(options.enableCloudWatchLogChecks) &&
    Number(record.params.lookbackHours || DEFAULT_HEALTH_LOOKBACK_HOURS) ===
      Number(options.lookbackHours || DEFAULT_HEALTH_LOOKBACK_HOURS)
  );
};

const toTimestampMs = (value) => {
  if (!value) return null;
  const timestamp = Date.parse(String(value));
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
};

const shouldKeepWaitingForFreshArtifact = (request, artifactTimestamp) => {
  if (!request || request.status !== 'loading') return false;
  if (request?.params?.forceRefresh !== true) return false;

  const artifactTs = toTimestampMs(artifactTimestamp);
  const baselineTs = toTimestampMs(request?.baselineGeneratedAt);
  if (baselineTs && artifactTs) {
    return artifactTs <= baselineTs;
  }
  if (baselineTs && !artifactTs) {
    return true;
  }

  const startedAtTs = toTimestampMs(request?.startedAt);
  if (startedAtTs && artifactTs) {
    return artifactTs < startedAtTs;
  }

  return false;
};

const getWorkloadResultGeneratedAt = (updatedWorkload, updatedAt) => {
  const summary = parseSummaryObject(updatedWorkload?.summary);
  const analysis =
    summary?.analysis && typeof summary.analysis === 'object' ? summary.analysis : {};
  const healthMeta =
    analysis?.health && typeof analysis.health === 'object' ? analysis.health : {};
  return getHealthGeneratedAt(healthMeta) || updatedAt;
};

const buildSummaryWithIncomingHealth = (summary, healthAnalysis) => {
  const existingSummary = parseSummaryObject(summary);
  return {
    ...existingSummary,
    analysis: {
      ...(existingSummary?.analysis && typeof existingSummary.analysis === 'object'
        ? existingSummary.analysis
        : {}),
      health: healthAnalysis,
    },
  };
};

const syncWorkloadsFromEnvironmentHealthPayload = ({
  dispatch,
  state,
  permissionProfileId,
  payload,
  generatedAt,
  updatedAt,
  params,
}) => {
  if (!dispatch || !state || !permissionProfileId || !payload) {
    return { workloadSummaryPatches: [], workloadResultsById: {} };
  }

  const permissionProfilesByAccount = buildPermissionProfilesByAccount(
    state?.auth?.userProfile?.agentPermissionProfiles || []
  );
  const mergedWorkloadsById = getMergedWorkloadsById(state);
  const incomingHealthMeta =
    payload?.analysis?.health && typeof payload.analysis.health === 'object'
      ? payload.analysis.health
      : {};
  const workloadSummaryPatches = buildWorkloadHealthSummaryPatchesFromEnvironmentPayload(payload);
  const patchedWorkloadIds = new Set();
  const workloadResultsById = {};

  workloadSummaryPatches.forEach(({ workloadId, healthSummary }) => {
    if (!workloadId) return;
    patchedWorkloadIds.add(workloadId);
    const workload = mergedWorkloadsById.get(workloadId);
    const existingSummary = parseSummaryObject(workload?.summary);
    const existingAnalysis =
      existingSummary?.analysis && typeof existingSummary.analysis === 'object'
        ? existingSummary.analysis
        : {};
    const existingHealth =
      existingAnalysis?.health && typeof existingAnalysis.health === 'object'
        ? existingAnalysis.health
        : {};
    const nextSummary = {
      ...existingSummary,
      analysis: {
        ...existingAnalysis,
        health: {
          ...existingHealth,
          generatedAt:
            getHealthGeneratedAt(incomingHealthMeta) ||
            getHealthGeneratedAt(existingHealth) ||
            generatedAt ||
            updatedAt,
          summary: healthSummary,
        },
      },
    };

    dispatch(updateWorkloadSummary({ workloadId, summary: nextSummary }));
    dispatch(updateWorkloadSummaryInUserProfile({ workloadId, summary: nextSummary }));
  });

  Array.from(mergedWorkloadsById.values()).forEach((workload) => {
    if (!workload?.workloadId) return;
    const workloadPermissionProfileIds = getWorkloadPermissionProfileIds(
      workload,
      permissionProfilesByAccount
    );
    if (!workloadPermissionProfileIds.includes(permissionProfileId)) return;

    const updatedWorkload = mergeWorkloadHealthResponse(
      workload,
      [{ permissionProfileId, body: payload }],
      permissionProfilesByAccount
    );
    const updatedTrackedResources = safeParseJson(updatedWorkload?.trackedResources, { resources: [] });
    const trackedResourceItems = Array.isArray(updatedTrackedResources?.resources)
      ? updatedTrackedResources.resources
      : [];
    const workloadGeneratedAt = getWorkloadResultGeneratedAt(updatedWorkload, updatedAt);
    const trackedHealthSummary = buildTrackedResourceHealthSummary(trackedResourceItems);
    const existingSummary = parseSummaryObject(updatedWorkload?.summary);
    const existingAnalysis =
      existingSummary?.analysis && typeof existingSummary.analysis === 'object'
        ? existingSummary.analysis
        : {};
    const existingHealth =
      existingAnalysis?.health && typeof existingAnalysis.health === 'object'
        ? existingAnalysis.health
        : {};
    const nextSummary = {
      ...existingSummary,
      analysis: {
        ...existingAnalysis,
        health: {
          ...existingHealth,
          generatedAt:
            getHealthGeneratedAt(incomingHealthMeta) ||
            workloadGeneratedAt ||
            getHealthGeneratedAt(existingHealth),
          summary: trackedHealthSummary,
        },
      },
    };
    const nextWorkload = {
      ...updatedWorkload,
      summary: JSON.stringify(nextSummary),
    };

    dispatch(updateWorkloadInState(nextWorkload));
    dispatch(updateSingleWorkloadInUserProfile(nextWorkload));
    workloadResultsById[workload.workloadId] = {
      resources: trackedResourceItems,
      updatedAt,
      generatedAt: workloadGeneratedAt,
      params,
    };

    if (!patchedWorkloadIds.has(workload.workloadId)) {
      dispatch(updateWorkloadSummary({ workloadId: workload.workloadId, summary: nextSummary }));
      dispatch(updateWorkloadSummaryInUserProfile({
        workloadId: workload.workloadId,
        summary: nextSummary,
      }));
    }
  });

  if (Object.keys(workloadResultsById).length > 0) {
    dispatch(mergeWorkloadHealthResults(workloadResultsById));
  }

  return { workloadSummaryPatches, workloadResultsById };
};

export const launchHealthScans = createAsyncThunk(
  'health/launchHealthScans',
  async (params = {}, { dispatch, getState, rejectWithValue }) => {
    const targets = normalizeHealthLaunchTargets(params);
    if (targets.length === 0) {
      return rejectWithValue('No health scan targets were provided');
    }

    const localRuntime = isLocalRuntime();
    const websocketConnectionId = getScannerConnectionId(getState());
    if (!localRuntime && !websocketConnectionId) {
      console.warn('[health/launchHealthScans] Scanner websocket connection is not ready', {
        targets,
        params,
        connectionId: websocketConnectionId,
      });
      return rejectWithValue(
        'Scanner updates connection is not ready. Check the dashboard console for websocket logs.'
      );
    }

    try {
      console.info('[health/launchHealthScans] Launching health scanner batch', {
        targetCount: targets.length,
        targets,
        websocketConnectionId,
        forceRefresh: params.forceRefresh !== false,
        lookbackHours: params.lookbackHours,
        enableCloudWatchLogChecks: params.enableCloudWatchLogChecks === true,
      });
      const payload = await launchAwsScannerBatch({
        cloudProvider: params.cloudProvider || 'aws',
        reportType: 'health',
        websocketConnectionId,
        targets,
        forceRefresh: params.forceRefresh !== false,
        lookbackHours: params.lookbackHours,
        enableCloudWatchLogChecks: params.enableCloudWatchLogChecks,
      });

      let results = [];
      let failures = [];
      if (localRuntime) {
        const settled = await Promise.allSettled(
          targets.map(async (target) => {
            const body = await evaluateAwsResourceHealth({
              permissionProfileId: target.permissionProfileId,
              workloadId: target.workloadId,
              forceRefresh: false,
              enableCloudWatchLogChecks: params.enableCloudWatchLogChecks,
              lookbackHours: params.lookbackHours,
            });
            const normalized = normalizeHealthResponseShape(body);
            return {
              ...target,
              payload: normalized,
              generatedAt:
                getHealthRecordTimestamp({
                  payload: normalized,
                  updatedAt: new Date().toISOString(),
                }) || new Date().toISOString(),
            };
          })
        );
        results = settled
          .filter((result) => result.status === 'fulfilled')
          .map((result) => result.value);
        results
          .filter((result) => result.permissionProfileId && result.payload)
          .forEach((result) => {
            const updatedAt = new Date().toISOString();
            syncWorkloadsFromEnvironmentHealthPayload({
              dispatch,
              state: getState(),
              permissionProfileId: result.permissionProfileId,
              payload: result.payload,
              generatedAt: result.generatedAt || updatedAt,
              updatedAt,
              params: normalizeHealthRequestOptions({ ...params, forceRefresh: true }),
            });
          });
        failures = [
          ...(Array.isArray(payload?.failures) ? payload.failures : []),
          ...settled
            .map((result, index) => {
              if (result.status !== 'rejected') return null;
              return {
                ...targets[index],
                message: result.reason?.message || 'Failed to fetch local health artifact',
              };
            })
            .filter(Boolean),
        ];
      }

      return {
        targets,
        payload,
        results,
        failures,
        startedAt: new Date().toISOString(),
        params: normalizeHealthRequestOptions({ ...params, forceRefresh: true }),
      };
    } catch (error) {
      console.error('[health/launchHealthScans] Failed to launch health scanner batch', {
        targets,
        params,
        message: error?.message || String(error),
      });
      return rejectWithValue(error?.message || 'Failed to start health checks');
    }
  }
);

export const refreshEnvironmentHealth = createAsyncThunk(
  'health/refreshEnvironmentHealth',
  async (params = {}, { dispatch, getState, rejectWithValue }) => {
    const options = normalizeHealthRequestOptions(params);
    const permissionProfileId = String(params.permissionProfileId || '').trim();

    try {
      const response = await evaluateAwsResourceHealth({
        permissionProfileId,
        forceRefresh: options.forceRefresh,
        enableCloudWatchLogChecks: options.enableCloudWatchLogChecks,
        lookbackHours: options.lookbackHours,
      });
      if (response?.pending) {
        return {
          permissionProfileId,
          payload: null,
          updatedAt: null,
          generatedAt: null,
          pending: true,
          params: options,
          workloadSummaryPatches: [],
        };
      }
      const normalizedResponse = normalizeHealthResponseShape(response);
      const updatedAt = new Date().toISOString();
      const generatedAt = getHealthRecordTimestamp({
        payload: normalizedResponse,
        updatedAt,
      });
      const { workloadSummaryPatches } = syncWorkloadsFromEnvironmentHealthPayload({
        dispatch,
        state: getState(),
        permissionProfileId,
        payload: normalizedResponse,
        generatedAt,
        updatedAt,
        params: options,
      });

      return {
        permissionProfileId,
        payload: normalizedResponse,
        updatedAt,
        generatedAt,
        params: options,
        workloadSummaryPatches,
      };
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to refresh environment health');
    }
  },
  {
    condition: (params = {}, { getState }) => {
      const permissionProfileId = String(params.permissionProfileId || '').trim();
      if (!permissionProfileId) return false;

      const state = getState();
      const options = normalizeHealthRequestOptions(params);
      const request = state.health?.environmentRequestsById?.[permissionProfileId];
      if (request?.status === 'loading' && !params.allowWhileLoading) {
        return false;
      }

      if (options.forceRefresh || params.bypassLocalCache) {
        return true;
      }

      const existing = state.health?.environmentResultsById?.[permissionProfileId];
      return !(
        hasCompatibleHealthParams(existing, options) &&
        hasFreshHealthRecord(existing, options.maxAgeHours)
      );
    },
  }
);

export const refreshWorkloadHealth = createAsyncThunk(
  'health/refreshWorkloadHealth',
  async (params = {}, { dispatch, getState, rejectWithValue }) => {
    const options = normalizeHealthRequestOptions(params);
    const workloadId = String(params.workloadId || '').trim();
    const state = getState();
    const workload = getMergedWorkloadById(state, workloadId);

    if (!workload) {
      return rejectWithValue('Workload not found');
    }

    if (!options.forceRefresh) {
      try {
        const cachedResponse = await evaluateAwsResourceHealth({
          workloadId,
          forceRefresh: false,
          enableCloudWatchLogChecks: options.enableCloudWatchLogChecks,
          lookbackHours: options.lookbackHours,
        });
        if (cachedResponse?.pending) {
          return {
            workloadId,
            updatedWorkload: workload,
            updatedAt: null,
            generatedAt: null,
            pending: true,
            params: options,
            resources: [],
            responses: [],
          };
        }
        const normalizedCachedResponse = normalizeHealthResponseShape(cachedResponse);

        if (normalizedCachedResponse && normalizedCachedResponse.ok !== false) {
          const updatedAt = new Date().toISOString();
          const generatedAt =
            getHealthRecordTimestamp({
              payload: normalizedCachedResponse,
              updatedAt,
            }) || updatedAt;
          const incomingHealthAnalysis =
            normalizedCachedResponse?.analysis?.health &&
            typeof normalizedCachedResponse.analysis.health === 'object'
              ? normalizedCachedResponse.analysis.health
              : null;

          if (incomingHealthAnalysis) {
            const nextSummary = buildSummaryWithIncomingHealth(
              workload?.summary,
              incomingHealthAnalysis
            );
            dispatch(updateWorkloadSummary({ workloadId, summary: nextSummary }));
            dispatch(updateWorkloadSummaryInUserProfile({ workloadId, summary: nextSummary }));
          }

          return {
            workloadId,
            updatedWorkload: workload,
            updatedAt,
            generatedAt,
            params: options,
            resources: extractHealthResources(normalizedCachedResponse),
            responses: [],
          };
        }
      } catch {
        // Fall back to the existing per-environment path when there is no workload cache yet.
      }
    }

    const permissionProfilesByAccount = buildPermissionProfilesByAccount(
      state?.auth?.userProfile?.agentPermissionProfiles || []
    );
    const permissionProfileIds = getWorkloadPermissionProfileIds(
      workload,
      permissionProfilesByAccount
    );

    if (permissionProfileIds.length === 0) {
      return rejectWithValue('No cloud environments available for health checks');
    }

    try {
      const settledResponses = await Promise.allSettled(
        permissionProfileIds.map((permissionProfileId) =>
          evaluateAwsResourceHealth({
            permissionProfileId,
            forceRefresh: options.forceRefresh,
            enableCloudWatchLogChecks: options.enableCloudWatchLogChecks,
            lookbackHours: options.lookbackHours,
          }).then((body) => ({
            permissionProfileId,
            body: normalizeHealthResponseShape(body),
          }))
        )
      );

      const successfulResponses = settledResponses
        .filter((result) => result.status === 'fulfilled' && result.value?.body?.ok !== false)
        .map((result) => result.value);
      const failedResponses = settledResponses
        .map((result, index) => {
          const permissionProfileId = permissionProfileIds[index];
          if (result.status === 'rejected') {
            return {
              permissionProfileId,
              error: result.reason?.message || 'Failed to refresh environment health',
            };
          }
          if (result.value?.body?.ok === false) {
            return {
              permissionProfileId,
              error:
                result.value?.body?.error ||
                result.value?.body?.message ||
                'Failed to refresh environment health',
            };
          }
          return null;
        })
        .filter(Boolean);

      if (successfulResponses.length === 0) {
        return rejectWithValue('No health results were returned for this workload');
      }

      const updatedWorkload = mergeWorkloadHealthResponse(
        workload,
        successfulResponses,
        permissionProfilesByAccount
      );
      const updatedAt = new Date().toISOString();
      const generatedAt = getWorkloadResultGeneratedAt(updatedWorkload, updatedAt);
      const mergedResources = successfulResponses.flatMap(({ body }) =>
        extractHealthResources(normalizeHealthResponseShape(body))
      );
      const updatedTrackedResources = safeParseJson(updatedWorkload?.trackedResources, { resources: [] });
      const trackedResourceItems = Array.isArray(updatedTrackedResources?.resources)
        ? updatedTrackedResources.resources
        : [];

      dispatch(updateWorkloadInState(updatedWorkload));
      dispatch(updateSingleWorkloadInUserProfile(updatedWorkload));

      return {
        workloadId,
        updatedWorkload,
        updatedAt,
        generatedAt,
        params: options,
        resources: trackedResourceItems.length > 0 ? trackedResourceItems : mergedResources,
        failures: failedResponses,
        responses: successfulResponses.map(({ permissionProfileId, body }) => ({
          permissionProfileId,
          payload: body,
          generatedAt:
            getHealthRecordTimestamp({
              payload: body,
              updatedAt,
            }) || updatedAt,
        })),
      };
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to refresh workload health');
    }
  },
  {
    condition: (params = {}, { getState }) => {
      const workloadId = String(params.workloadId || '').trim();
      if (!workloadId) return false;

      const state = getState();
      const options = normalizeHealthRequestOptions(params);
      const request = state.health?.workloadRequestsById?.[workloadId];
      if (request?.status === 'loading' && !params.allowWhileLoading) {
        return false;
      }

      if (options.forceRefresh || params.bypassLocalCache) {
        return true;
      }

      const existing = state.health?.workloadResultsById?.[workloadId];
      return !(
        hasCompatibleHealthParams(existing, options) &&
        hasFreshHealthRecord(existing, options.maxAgeHours)
      );
    },
  }
);

const healthSlice = createSlice({
  name: 'health',
  initialState,
  reducers: {
    clearHealthState: () => initialState,
    markEnvironmentHealthScanFailed: (state, action) => {
      const permissionProfileId = String(action.payload?.permissionProfileId || '').trim();
      if (!permissionProfileId) return;
      state.environmentRequestsById[permissionProfileId] = {
        status: 'failed',
        error: action.payload?.error || 'Failed to refresh environment health',
        startedAt: state.environmentRequestsById[permissionProfileId]?.startedAt || null,
        finishedAt: new Date().toISOString(),
        baselineGeneratedAt:
          state.environmentRequestsById[permissionProfileId]?.baselineGeneratedAt ||
          state.environmentResultsById[permissionProfileId]?.generatedAt ||
          null,
        params:
          state.environmentRequestsById[permissionProfileId]?.params ||
          normalizeHealthRequestOptions({ forceRefresh: true }),
      };
    },
    markEnvironmentHealthScanReady: (state, action) => {
      const permissionProfileId = String(action.payload?.permissionProfileId || '').trim();
      if (!permissionProfileId) return;
      const finishedAt = action.payload?.generatedAt || new Date().toISOString();
      state.environmentRequestsById[permissionProfileId] = {
        status: 'succeeded',
        error: null,
        startedAt: state.environmentRequestsById[permissionProfileId]?.startedAt || null,
        finishedAt,
        baselineGeneratedAt:
          state.environmentRequestsById[permissionProfileId]?.baselineGeneratedAt ||
          state.environmentResultsById[permissionProfileId]?.generatedAt ||
          null,
        params:
          state.environmentRequestsById[permissionProfileId]?.params ||
          normalizeHealthRequestOptions({ forceRefresh: true }),
      };
    },
    markWorkloadHealthScanFailed: (state, action) => {
      const workloadId = String(action.payload?.workloadId || '').trim();
      if (!workloadId) return;
      state.workloadRequestsById[workloadId] = {
        status: 'failed',
        error: action.payload?.error || 'Failed to refresh workload health',
        startedAt: state.workloadRequestsById[workloadId]?.startedAt || null,
        finishedAt: new Date().toISOString(),
        baselineGeneratedAt:
          state.workloadRequestsById[workloadId]?.baselineGeneratedAt ||
          state.workloadResultsById[workloadId]?.generatedAt ||
          null,
        params:
          state.workloadRequestsById[workloadId]?.params ||
          normalizeHealthRequestOptions({ forceRefresh: true }),
      };
    },
    markWorkloadHealthScanReady: (state, action) => {
      const workloadId = String(action.payload?.workloadId || '').trim();
      if (!workloadId) return;
      const finishedAt = action.payload?.generatedAt || new Date().toISOString();
      state.workloadRequestsById[workloadId] = {
        status: 'succeeded',
        error: null,
        startedAt: state.workloadRequestsById[workloadId]?.startedAt || null,
        finishedAt,
        baselineGeneratedAt:
          state.workloadRequestsById[workloadId]?.baselineGeneratedAt ||
          state.workloadResultsById[workloadId]?.generatedAt ||
          null,
        params:
          state.workloadRequestsById[workloadId]?.params ||
          normalizeHealthRequestOptions({ forceRefresh: true }),
      };
    },
    mergeWorkloadHealthResults: (state, action) => {
      const nextResults = action.payload || {};
      Object.entries(nextResults).forEach(([workloadId, result]) => {
        if (!workloadId || !result || typeof result !== 'object') return;
        state.workloadResultsById[workloadId] = {
          ...state.workloadResultsById[workloadId],
          ...result,
        };
      });
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => initialState)
      .addCase(launchHealthScans.pending, (state, action) => {
        const startedAt = new Date().toISOString();
        const params = normalizeHealthRequestOptions({ ...action.meta.arg, forceRefresh: true });
        normalizeHealthLaunchTargets(action.meta.arg).forEach((target) => {
          if (target.permissionProfileId) {
            state.environmentRequestsById[target.permissionProfileId] = {
              status: 'loading',
              error: null,
              startedAt,
              finishedAt: null,
              baselineGeneratedAt:
                state.environmentResultsById[target.permissionProfileId]?.generatedAt || null,
              params,
            };
          }
          if (target.workloadId) {
            state.workloadRequestsById[target.workloadId] = {
              status: 'loading',
              error: null,
              startedAt,
              finishedAt: null,
              baselineGeneratedAt:
                state.workloadResultsById[target.workloadId]?.generatedAt || null,
              params,
            };
          }
        });
      })
      .addCase(launchHealthScans.fulfilled, (state, action) => {
        const startedAt = action.payload?.startedAt || new Date().toISOString();
        const params =
          action.payload?.params || normalizeHealthRequestOptions({ forceRefresh: true });
        const localResults = Array.isArray(action.payload?.results) ? action.payload.results : [];
        const localFailures = Array.isArray(action.payload?.failures) ? action.payload.failures : [];
        if (localResults.length > 0 || localFailures.length > 0) {
          localResults.forEach((result) => {
            const updatedAt = new Date().toISOString();
            if (result.permissionProfileId) {
              state.environmentRequestsById[result.permissionProfileId] = {
                status: 'succeeded',
                error: null,
                startedAt:
                  state.environmentRequestsById[result.permissionProfileId]?.startedAt ||
                  startedAt,
                finishedAt: updatedAt,
                baselineGeneratedAt:
                  state.environmentRequestsById[result.permissionProfileId]?.baselineGeneratedAt ||
                  state.environmentResultsById[result.permissionProfileId]?.generatedAt ||
                  null,
                params,
              };
              state.environmentResultsById[result.permissionProfileId] = {
                payload: result.payload,
                updatedAt,
                generatedAt: result.generatedAt || updatedAt,
                params,
              };
            }
            if (result.workloadId) {
              state.workloadRequestsById[result.workloadId] = {
                status: 'succeeded',
                error: null,
                startedAt:
                  state.workloadRequestsById[result.workloadId]?.startedAt || startedAt,
                finishedAt: updatedAt,
                baselineGeneratedAt:
                  state.workloadRequestsById[result.workloadId]?.baselineGeneratedAt ||
                  state.workloadResultsById[result.workloadId]?.generatedAt ||
                  null,
                params,
              };
              state.workloadResultsById[result.workloadId] = {
                payload: result.payload,
                updatedAt,
                generatedAt: result.generatedAt || updatedAt,
                params,
                resources: extractHealthResources(result.payload),
              };
            }
          });
          localFailures.forEach((failure) => {
            const error = failure?.message || failure?.error || 'Failed to run local health scan';
            if (failure?.permissionProfileId) {
              state.environmentRequestsById[failure.permissionProfileId] = {
                status: 'failed',
                error,
                startedAt:
                  state.environmentRequestsById[failure.permissionProfileId]?.startedAt ||
                  startedAt,
                finishedAt: new Date().toISOString(),
                baselineGeneratedAt:
                  state.environmentRequestsById[failure.permissionProfileId]?.baselineGeneratedAt ||
                  state.environmentResultsById[failure.permissionProfileId]?.generatedAt ||
                  null,
                params,
              };
            }
            if (failure?.workloadId) {
              state.workloadRequestsById[failure.workloadId] = {
                status: 'failed',
                error,
                startedAt:
                  state.workloadRequestsById[failure.workloadId]?.startedAt || startedAt,
                finishedAt: new Date().toISOString(),
                baselineGeneratedAt:
                  state.workloadRequestsById[failure.workloadId]?.baselineGeneratedAt ||
                  state.workloadResultsById[failure.workloadId]?.generatedAt ||
                  null,
                params,
              };
            }
          });
          return;
        }
        (action.payload?.targets || []).forEach((target) => {
          if (target.permissionProfileId) {
            state.environmentRequestsById[target.permissionProfileId] = {
              status: 'loading',
              error: null,
              startedAt:
                state.environmentRequestsById[target.permissionProfileId]?.startedAt || startedAt,
              finishedAt: null,
              baselineGeneratedAt:
                state.environmentRequestsById[target.permissionProfileId]?.baselineGeneratedAt ||
                state.environmentResultsById[target.permissionProfileId]?.generatedAt ||
                null,
              params,
            };
          }
          if (target.workloadId) {
            state.workloadRequestsById[target.workloadId] = {
              status: 'loading',
              error: null,
              startedAt: state.workloadRequestsById[target.workloadId]?.startedAt || startedAt,
              finishedAt: null,
              baselineGeneratedAt:
                state.workloadRequestsById[target.workloadId]?.baselineGeneratedAt ||
                state.workloadResultsById[target.workloadId]?.generatedAt ||
                null,
              params,
            };
          }
        });
      })
      .addCase(launchHealthScans.rejected, (state, action) => {
        if (action.meta.condition) return;
        const startedAt = new Date().toISOString();
        const error = action.payload || action.error?.message || 'Failed to start health checks';
        const params = normalizeHealthRequestOptions({ ...action.meta.arg, forceRefresh: true });
        normalizeHealthLaunchTargets(action.meta.arg).forEach((target) => {
          if (target.permissionProfileId) {
            state.environmentRequestsById[target.permissionProfileId] = {
              status: 'failed',
              error,
              startedAt:
                state.environmentRequestsById[target.permissionProfileId]?.startedAt || null,
              finishedAt: startedAt,
              baselineGeneratedAt:
                state.environmentRequestsById[target.permissionProfileId]?.baselineGeneratedAt ||
                state.environmentResultsById[target.permissionProfileId]?.generatedAt ||
                null,
              params,
            };
          }
          if (target.workloadId) {
            state.workloadRequestsById[target.workloadId] = {
              status: 'failed',
              error,
              startedAt: state.workloadRequestsById[target.workloadId]?.startedAt || null,
              finishedAt: startedAt,
              baselineGeneratedAt:
                state.workloadRequestsById[target.workloadId]?.baselineGeneratedAt ||
                state.workloadResultsById[target.workloadId]?.generatedAt ||
                null,
              params,
            };
          }
        });
      })
      .addCase(refreshEnvironmentHealth.pending, (state, action) => {
        const permissionProfileId = String(action.meta.arg?.permissionProfileId || '').trim();
        if (!permissionProfileId) return;
        const existingRequest = state.environmentRequestsById[permissionProfileId];
        state.environmentRequestsById[permissionProfileId] = {
          status: 'loading',
          error: null,
          startedAt: existingRequest?.startedAt || new Date().toISOString(),
          finishedAt: null,
          baselineGeneratedAt:
            existingRequest?.baselineGeneratedAt ||
            state.environmentResultsById[permissionProfileId]?.generatedAt ||
            null,
          params: normalizeHealthRequestOptions(action.meta.arg),
        };
      })
      .addCase(refreshEnvironmentHealth.fulfilled, (state, action) => {
        const { permissionProfileId, payload, updatedAt, generatedAt, pending, params } = action.payload || {};
        if (!permissionProfileId) return;
        const existingRequest = state.environmentRequestsById[permissionProfileId];
        const shouldKeepLoading =
          pending ||
          shouldKeepWaitingForFreshArtifact(
            existingRequest,
            generatedAt || updatedAt || getHealthRecordTimestamp({ payload, updatedAt })
          );
        if (shouldKeepLoading) {
          state.environmentRequestsById[permissionProfileId] = {
            status: 'loading',
            error: null,
            startedAt:
              existingRequest?.startedAt ||
              new Date().toISOString(),
            finishedAt: null,
            baselineGeneratedAt:
              existingRequest?.baselineGeneratedAt ||
              state.environmentResultsById[permissionProfileId]?.generatedAt ||
              null,
            params,
          };
          return;
        }
        state.environmentRequestsById[permissionProfileId] = {
          status: 'succeeded',
          error: null,
          startedAt: existingRequest?.startedAt || updatedAt,
          finishedAt: updatedAt,
          baselineGeneratedAt:
            existingRequest?.baselineGeneratedAt ||
            state.environmentResultsById[permissionProfileId]?.generatedAt ||
            null,
          params,
        };
        state.environmentResultsById[permissionProfileId] = {
          payload,
          updatedAt,
          generatedAt: generatedAt || updatedAt,
          params,
        };
      })
      .addCase(refreshEnvironmentHealth.rejected, (state, action) => {
        const permissionProfileId = String(action.meta.arg?.permissionProfileId || '').trim();
        if (!permissionProfileId || action.meta.condition) return;
        state.environmentRequestsById[permissionProfileId] = {
          status: 'failed',
          error: action.payload || action.error?.message || 'Failed to refresh environment health',
          startedAt: state.environmentRequestsById[permissionProfileId]?.startedAt || null,
          finishedAt: new Date().toISOString(),
          baselineGeneratedAt:
            state.environmentRequestsById[permissionProfileId]?.baselineGeneratedAt ||
            state.environmentResultsById[permissionProfileId]?.generatedAt ||
            null,
          params: normalizeHealthRequestOptions(action.meta.arg),
        };
      })
      .addCase(refreshWorkloadHealth.pending, (state, action) => {
        const workloadId = String(action.meta.arg?.workloadId || '').trim();
        if (!workloadId) return;
        const existingRequest = state.workloadRequestsById[workloadId];
        state.workloadRequestsById[workloadId] = {
          status: 'loading',
          error: null,
          startedAt: existingRequest?.startedAt || new Date().toISOString(),
          finishedAt: null,
          baselineGeneratedAt:
            existingRequest?.baselineGeneratedAt ||
            state.workloadResultsById[workloadId]?.generatedAt ||
            null,
          params: normalizeHealthRequestOptions(action.meta.arg),
        };
      })
      .addCase(refreshWorkloadHealth.fulfilled, (state, action) => {
        const { workloadId, updatedAt, generatedAt, pending, params, resources, responses } = action.payload || {};
        if (!workloadId) return;
        const existingRequest = state.workloadRequestsById[workloadId];
        const shouldKeepLoading =
          pending ||
          shouldKeepWaitingForFreshArtifact(
            existingRequest,
            generatedAt || updatedAt
          );
        if (shouldKeepLoading) {
          state.workloadRequestsById[workloadId] = {
            status: 'loading',
            error: null,
            startedAt:
              existingRequest?.startedAt ||
              new Date().toISOString(),
            finishedAt: null,
            baselineGeneratedAt:
              existingRequest?.baselineGeneratedAt ||
              state.workloadResultsById[workloadId]?.generatedAt ||
              null,
            params,
          };
          return;
        }
        state.workloadRequestsById[workloadId] = {
          status: 'succeeded',
          error: null,
          startedAt: existingRequest?.startedAt || updatedAt,
          finishedAt: updatedAt,
          baselineGeneratedAt:
            existingRequest?.baselineGeneratedAt ||
            state.workloadResultsById[workloadId]?.generatedAt ||
            null,
          params,
        };
        state.workloadResultsById[workloadId] = {
          resources: Array.isArray(resources) ? resources : [],
          updatedAt,
          generatedAt: generatedAt || updatedAt,
          params,
        };

        (responses || []).forEach((response) => {
          const permissionProfileId = String(response?.permissionProfileId || '').trim();
          if (!permissionProfileId) return;
          state.environmentResultsById[permissionProfileId] = {
            payload: response.payload,
            updatedAt,
            generatedAt: response.generatedAt || updatedAt,
            params,
          };
        });
      })
      .addCase(refreshWorkloadHealth.rejected, (state, action) => {
        const workloadId = String(action.meta.arg?.workloadId || '').trim();
        if (!workloadId || action.meta.condition) return;
        state.workloadRequestsById[workloadId] = {
          status: 'failed',
          error: action.payload || action.error?.message || 'Failed to refresh workload health',
          startedAt: state.workloadRequestsById[workloadId]?.startedAt || null,
          finishedAt: new Date().toISOString(),
          baselineGeneratedAt:
            state.workloadRequestsById[workloadId]?.baselineGeneratedAt ||
            state.workloadResultsById[workloadId]?.generatedAt ||
            null,
          params: normalizeHealthRequestOptions(action.meta.arg),
        };
      });
  },
});

export const {
  clearHealthState,
  markEnvironmentHealthScanFailed,
  markEnvironmentHealthScanReady,
  markWorkloadHealthScanFailed,
  markWorkloadHealthScanReady,
  mergeWorkloadHealthResults,
} = healthSlice.actions;

export const selectEnvironmentHealthRequestsById = (state) =>
  state.health?.environmentRequestsById || {};

export const selectWorkloadHealthRequestsById = (state) =>
  state.health?.workloadRequestsById || {};

export const selectEnvironmentHealthResultsById = (state) =>
  state.health?.environmentResultsById || {};

export const selectWorkloadHealthResultsById = (state) =>
  state.health?.workloadResultsById || {};

export const selectIsEnvironmentHealthRefreshing = (state, permissionProfileId) =>
  state.health?.environmentRequestsById?.[permissionProfileId]?.status === 'loading';

export const selectIsWorkloadHealthRefreshing = (state, workloadId) =>
  state.health?.workloadRequestsById?.[workloadId]?.status === 'loading';

export const selectHasFreshEnvironmentHealthResult = (
  state,
  permissionProfileId,
  maxAgeHours = DEFAULT_HEALTH_MAX_AGE_HOURS
) => hasFreshHealthRecord(state.health?.environmentResultsById?.[permissionProfileId], maxAgeHours);

export const selectHasFreshWorkloadHealthResult = (
  state,
  workloadId,
  maxAgeHours = DEFAULT_HEALTH_MAX_AGE_HOURS
) => hasFreshHealthRecord(state.health?.workloadResultsById?.[workloadId], maxAgeHours);

export default healthSlice.reducer;
