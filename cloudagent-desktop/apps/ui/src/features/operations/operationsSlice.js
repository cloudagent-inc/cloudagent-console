import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  logout,
  refreshAccountScans,
  updatePermissionProfileSummary,
  updateWorkloadSummaryInUserProfile,
} from '../auth/authSlice';
import { updateWorkloadSummary } from '../workload/workloadSlice';
import { generateExecutiveSummary } from '../../api/executiveSummary';
import { getCommandCenterBootstrap } from '../../api/commandCenterApi';
import { isSupportedExecutiveSummaryEnvironmentType } from '../../helpers/shared';
import {
  getPermissionProfileAwsAccountId,
  getPermissionProfileAzureSubscriptionId,
  getPermissionProfileDomain,
  getPermissionProfileId,
  resolveWorkloadEnvironmentProfile,
} from '../workload/workloadEnvironmentUtils';
import {
  setBriefing as setCommandCenterBriefing,
  setSuggestionCards as setCommandCenterSuggestionCards,
  setSuggestionPageAction as setCommandCenterSuggestionPage,
  setSuggestionsState as setCommandCenterSuggestionsState,
} from '../commandCenter/commandCenterSlice';

const FAILED_REPORT_STATUS_SET = new Set(['failed', 'error']);
const IN_PROGRESS_REPORT_STATUS_SET = new Set([
  'created',
  'queued',
  'pending',
  'starting',
  'started',
  'in_progress',
  'running',
  'processing',
  'loading',
]);
const EXECUTIVE_SUMMARY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const initialState = {
  scannerUpdatesConnectionId: '',
  executiveSummaryRequestsByKey: {},
  executiveSummariesByKey: {},
  suggestionRequestsByKey: {},
  reportOperationsByScanId: {},
};

const parseSummary = (summary) => {
  if (!summary) return null;
  if (typeof summary === 'string') {
    try {
      return JSON.parse(summary);
    } catch {
      return null;
    }
  }
  return typeof summary === 'object' ? summary : null;
};

const buildExecutiveSummaryKey = (type, id) => {
  const normalizedType = type === 'workload' ? 'workload' : 'environment';
  const normalizedId = String(id || '').trim();
  return normalizedId ? `${normalizedType}:${normalizedId}` : '';
};

const buildSuggestionRequestKey = ({ chatId, mode = 'replace', page = 0 } = {}) => {
  const normalizedChatId = String(chatId || '').trim() || 'anonymous';
  const normalizedMode = mode === 'append' ? 'append' : 'replace';
  const normalizedPage = Number.isFinite(Number(page)) ? Number(page) : 0;
  return `${normalizedChatId}:${normalizedMode}:${normalizedPage}`;
};

const normalizeStatusToken = (value) =>
  String(value || '').trim().toLowerCase().replace(/\s+/g, '_');

const toTimestampMs = (...values) => {
  for (const value of values) {
    if (value == null || value === '') continue;
    if (typeof value === 'number') {
      if (Number.isFinite(value) && value > 0) return value;
      continue;
    }
    const parsed = Date.parse(String(value));
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

const hasRenderableSummary = (summary) => Boolean(parseSummary(summary)?.summaryText);

const getSummaryUpdatedAtMs = (summary) => toTimestampMs(parseSummary(summary)?.updatedAt);

const hasSummaryExpired = (summary, now = Date.now()) => {
  const updatedAtMs = getSummaryUpdatedAtMs(summary);
  if (!updatedAtMs) {
    return hasRenderableSummary(summary);
  }
  return now - updatedAtMs >= EXECUTIVE_SUMMARY_MAX_AGE_MS;
};

const getCompletedScanTimestampMs = (scan) => {
  if (!scan || typeof scan !== 'object') return null;
  const status = normalizeStatusToken(scan.status);
  if (FAILED_REPORT_STATUS_SET.has(status) || IN_PROGRESS_REPORT_STATUS_SET.has(status)) {
    return null;
  }

  if (scan.assessmentResultsUrl || scan.latestAssessmentDate) {
    return toTimestampMs(scan.latestAssessmentDate, scan.lastUpdateTime, scan.updatedAt);
  }

  if (status === 'completed' || status === 'complete' || status === 'succeeded' || status === 'success') {
    return toTimestampMs(scan.lastUpdateTime, scan.updatedAt, scan.createdAt);
  }

  return null;
};

const scanMatchesPermissionProfile = (scan, profile) => {
  if (!scan || !profile) return false;

  const profileId = getPermissionProfileId(profile);
  const scanProfileId = String(
    scan.permissionProfileId || scan.parentId || scan.recordId || ''
  ).trim();
  if (profileId && scanProfileId && profileId === scanProfileId) {
    return true;
  }

  const scanAccountId = String(scan.accountId || '').trim();
  const profileAccountId = getPermissionProfileAwsAccountId(profile);
  if (profileAccountId && scanAccountId === profileAccountId) {
    return true;
  }

  const profileSubscriptionId = getPermissionProfileAzureSubscriptionId(profile);
  const scanSubscriptionId = String(
    scan.subscriptionId ||
      scan.azureSubscriptionId ||
      scan.authProfile?.subscriptionId ||
      ''
  ).trim();
  if (
    profileSubscriptionId &&
    (scanSubscriptionId === profileSubscriptionId || scanAccountId === profileSubscriptionId)
  ) {
    return true;
  }

  const profileDomain = getPermissionProfileDomain(profile).toLowerCase();
  return Boolean(profileDomain) && scanAccountId.toLowerCase() === profileDomain;
};

const getRelevantCompletedScans = (profiles = [], scans = []) => {
  const uniqueProfiles = [];
  const seenProfileIds = new Set();

  (Array.isArray(profiles) ? profiles : []).forEach((profile) => {
    const profileId = getPermissionProfileId(profile);
    const profileKey = profileId ||
      `${getPermissionProfileAwsAccountId(profile)}:${getPermissionProfileAzureSubscriptionId(profile)}:${getPermissionProfileDomain(profile)}`;
    if (!profileKey || seenProfileIds.has(profileKey)) return;
    seenProfileIds.add(profileKey);
    uniqueProfiles.push(profile);
  });

  const matchedScans = [];
  const seenScanKeys = new Set();

  (Array.isArray(scans) ? scans : []).forEach((scan) => {
    const completedAtMs = getCompletedScanTimestampMs(scan);
    if (!completedAtMs) return;
    if (!uniqueProfiles.some((profile) => scanMatchesPermissionProfile(scan, profile))) {
      return;
    }

    const scanKey = String(scan.reportEntryKey || `${scan.scanId || ''}:${scan.reportId || ''}`).trim();
    if (scanKey && seenScanKeys.has(scanKey)) return;
    if (scanKey) seenScanKeys.add(scanKey);
    matchedScans.push({ ...scan, completedAtMs });
  });

  return matchedScans;
};

const getNewestScanTimestampMs = (scans = []) =>
  (Array.isArray(scans) ? scans : []).reduce((latest, scan) => {
    const completedAtMs = scan?.completedAtMs || getCompletedScanTimestampMs(scan);
    return completedAtMs && completedAtMs > latest ? completedAtMs : latest;
  }, 0);

const getExecutiveSummaryRefreshReason = ({ summary, relevantScans = [], now = Date.now() } = {}) => {
  if (!hasRenderableSummary(summary)) {
    return 'missing_summary';
  }

  const summaryUpdatedAtMs = getSummaryUpdatedAtMs(summary);
  if (!summaryUpdatedAtMs) {
    return 'missing_summary_timestamp';
  }

  if (hasSummaryExpired(summary, now)) {
    return 'stale_summary';
  }

  const newestScanTimestampMs = getNewestScanTimestampMs(relevantScans);
  if (newestScanTimestampMs > summaryUpdatedAtMs) {
    return 'newer_reports_available';
  }

  return null;
};

const buildReportOperationPath = (scanId, reportId) => {
  const normalizedScanId = String(scanId || '').trim();
  return normalizedScanId ? '/dashboard' : '/dashboard';
};

const normalizeReportId = (reportId, fallback = '') =>
  String(reportId || fallback || '').trim();

const createReportNavigationState = ({
  accountId,
  authProfile,
  cloudProvider,
  parentId,
  planId,
  reportId,
  scanId,
}) => ({
  accountId: accountId || '',
  authProfile: authProfile || {},
  cloudProvider: cloudProvider || 'aws',
  parentId: parentId || null,
  planId: planId || null,
  reportId: reportId || null,
  scanId: scanId || null,
});

const buildReportOperationRecord = (params = {}) => {
  const scanId = String(params.scanId || '').trim();
  const startedAt = params.startedAt || new Date().toISOString();
  const navigationState =
    params.navigationState ||
    createReportNavigationState({
      accountId: params.accountId,
      authProfile: params.authProfile,
      cloudProvider: params.cloudProvider,
      parentId: params.parentId,
      planId: params.planId,
      reportId: params.reportId,
      scanId,
    });

  return {
    scanId,
    reportId: params.reportId || null,
    planId: params.planId || null,
    title: params.title || params.reportId || params.planId || 'Report Run',
    accountId: params.accountId || null,
    cloudProvider: params.cloudProvider || 'aws',
    parentId: params.parentId || null,
    authProfile: params.authProfile || {},
    operationMode: params.operationMode || 'background',
    status: params.status || 'loading',
    latestScanStatus: params.latestScanStatus || 'starting',
    assessmentResultsUrl: params.assessmentResultsUrl || null,
    error: params.error || null,
    startedAt,
    updatedAt: params.updatedAt || startedAt,
    finishedAt: params.finishedAt || null,
    path: params.path || buildReportOperationPath(scanId, params.reportId),
    navigationState,
  };
};

const teardownReportOperationTracking = (scanId) => {
  return scanId;
};

export const stopAllTrackedReportOperations = () => {
  return undefined;
};

const findEnvironmentById = (state, id) => {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return null;
  return (
    (state.auth?.userProfile?.agentPermissionProfiles || []).find(
      (profile) => String(profile?.recordId || '').trim() === normalizedId
    ) || null
  );
};

const findWorkloadById = (state, id) => {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return null;
  return (
    (state.workload?.workloads || []).find(
      (workload) => String(workload?.workloadId || '').trim() === normalizedId
    ) ||
    (state.auth?.userProfile?.workloads || []).find(
      (workload) => String(workload?.workloadId || '').trim() === normalizedId
    ) ||
    null
  );
};

const resolveExecutiveSummaryInput = (state, params = {}) => {
  const type = params.type === 'workload' ? 'workload' : 'environment';
  const id = String(
    params.id ||
      params.recordId ||
      params.workloadId ||
      params.item?.recordId ||
      params.item?.workloadId ||
      ''
  ).trim();

  if (!id) {
    return { key: '', type, id: '', item: null, existingSummary: null };
  }

  const item =
    params.item ||
    (type === 'environment' ? findEnvironmentById(state, id) : findWorkloadById(state, id));
  const existingSummary = parseSummary(
    params.summary ||
      item?.summary ||
      state.operations?.executiveSummariesByKey?.[buildExecutiveSummaryKey(type, id)]?.summary ||
      null
  );

  return {
    key: buildExecutiveSummaryKey(type, id),
    type,
    id,
    item,
    existingSummary,
  };
};

const ensureReportOperationTracking = ({ dispatch, scanId, userId }) => {
  const normalizedScanId = String(scanId || '').trim();
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedScanId || !normalizedUserId) {
    return;
  }

  dispatch(
    failReportOperation({
      scanId: normalizedScanId,
      error: 'Hosted report operation subscriptions are not available in local desktop mode.',
    })
  );
};

export const trackReportOperation = createAsyncThunk(
  'operations/trackReportOperation',
  async (params = {}, { dispatch, getState, rejectWithValue }) => {
    const state = getState();
    const scanId = String(params.scanId || '').trim();
    const userId = String(params.userId || state.auth?.userProfile?.userId || '').trim();

    if (!scanId || !userId) {
      return rejectWithValue('Report operation could not be tracked');
    }

    const existing = state.operations?.reportOperationsByScanId?.[scanId] || {};
    const nextOperation = buildReportOperationRecord({
      ...existing,
      ...params,
      scanId,
      userId,
      status: existing.status === 'succeeded' ? existing.status : 'loading',
      latestScanStatus: params.latestScanStatus || existing.latestScanStatus || 'in_progress',
    });

    dispatch(registerReportOperation(nextOperation));
    ensureReportOperationTracking({ dispatch, scanId, userId });

    return nextOperation;
  }
);

export const startBackgroundReportOperation = createAsyncThunk(
  'operations/startBackgroundReportOperation',
  async (params = {}, { dispatch, getState, rejectWithValue }) => {
    const state = getState();
    const userId = String(params.userId || state.auth?.userProfile?.userId || '').trim();
    const planId = String(params.planId || '').trim();
    const authProfile =
      params.authProfile && typeof params.authProfile === 'object'
        ? params.authProfile
        : parseSummary(params.authProfile) || {};
    const cloudProvider =
      String(params.cloudProvider || authProfile?.provider || 'aws').trim() || 'aws';
    const accountId =
      params.accountId ||
      authProfile?.awsAccountId ||
      authProfile?.accountId ||
      authProfile?.domain ||
      authProfile?.tenantId ||
      authProfile?.azureTenantId ||
      '';
    const scanId =
      String(params.scanId || '').trim() ||
      `${accountId}-${Date.now()}-${planId}`;
    const message =
      'Hosted report assessments are not available in local desktop mode. Use the local health, cost, and threat scanner dashboards instead.';

    if (scanId) {
      dispatch(
        registerReportOperation(
          buildReportOperationRecord({
            scanId,
            reportId: normalizeReportId(params.reportId, planId),
            planId,
            title: params.title || params.reportId || planId || 'Report Run',
            accountId,
            cloudProvider,
            parentId: params.parentId || null,
            authProfile,
            operationMode: 'background',
            status: 'failed',
            latestScanStatus: 'failed',
            error: message,
          })
        )
      );
      dispatch(
        failReportOperation({
          scanId,
          error: message,
        })
      );
    }

    if (!userId || !planId || !accountId) {
      return rejectWithValue('Report settings are incomplete');
    }

    return rejectWithValue(message);
  }
);

export const ensureExecutiveSummary = createAsyncThunk(
  'operations/ensureExecutiveSummary',
  async (params = {}, { dispatch, getState, rejectWithValue }) => {
    const state = getState();
    const { key, type, id, item, existingSummary } = resolveExecutiveSummaryInput(state, params);

    if (!key || !id || !item) {
      return rejectWithValue('Executive summary target was not found');
    }

    if (existingSummary?.summaryText && !params.forceRefresh) {
      return {
        key,
        type,
        id,
        item,
        summary: existingSummary,
        source: 'existing',
      };
    }

    try {
      const response = await generateExecutiveSummary({
        type,
        id,
        original: item,
      });

      if (!response?.ok) {
        return rejectWithValue(response?.message || 'Failed to generate executive summary');
      }

      const { ok, message, ...summaryData } = response;

      if (type === 'environment') {
        dispatch(updatePermissionProfileSummary({ recordId: id, summary: summaryData }));
      } else {
        dispatch(updateWorkloadSummaryInUserProfile({ workloadId: id, summary: summaryData }));
        dispatch(updateWorkloadSummary({ workloadId: id, summary: summaryData }));
      }

      return {
        key,
        type,
        id,
        item,
        summary: summaryData,
        source: 'generated',
      };
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to generate executive summary');
    }
  },
  {
    condition: (params = {}, { getState }) => {
      const state = getState();
      const { key } = resolveExecutiveSummaryInput(state, params);
      if (!key) return false;
      return state.operations?.executiveSummaryRequestsByKey?.[key]?.status !== 'loading';
    },
  }
);

export const refreshExecutiveSummariesOnLogin = createAsyncThunk(
  'operations/refreshExecutiveSummariesOnLogin',
  async (_, { dispatch, getState }) => {
    const state = getState();
    const now = Date.now();
    const userProfile = state.auth?.userProfile || {};
    const permissionProfiles = Array.isArray(userProfile.agentPermissionProfiles)
      ? userProfile.agentPermissionProfiles
      : [];
    const workloads = Array.isArray(userProfile.workloads) ? userProfile.workloads : [];
    const reportHistory = Array.isArray(userProfile.reportHistory) ? userProfile.reportHistory : [];

    const environmentRequests = permissionProfiles
      .filter(
        (profile) =>
          profile?.recordId && isSupportedExecutiveSummaryEnvironmentType(profile?.type)
      )
      .map((profile) => {
        const relevantScans = getRelevantCompletedScans([profile], reportHistory);
        const reason = getExecutiveSummaryRefreshReason({
          summary: profile.summary,
          relevantScans,
          now,
        });

        return reason
          ? {
              type: 'environment',
              id: profile.recordId,
              item: profile,
              reason,
            }
          : null;
      })
      .filter(Boolean);

    const workloadRequests = workloads
      .filter((workload) => workload?.workloadId)
      .map((workload) => {
        const linkedProfiles = (Array.isArray(workload.environments) ? workload.environments : [])
          .map((environmentValue) =>
            resolveWorkloadEnvironmentProfile(environmentValue, permissionProfiles)
          )
          .filter(Boolean);
        const relevantScans = getRelevantCompletedScans(linkedProfiles, reportHistory);
        const reason = getExecutiveSummaryRefreshReason({
          summary: workload.summary,
          relevantScans,
          now,
        });

        return reason
          ? {
              type: 'workload',
              id: workload.workloadId,
              item: workload,
              reason,
            }
          : null;
      })
      .filter(Boolean);

    const requests = [...environmentRequests, ...workloadRequests];
    if (requests.length === 0) {
      return {
        requested: [],
        counts: {
          environments: 0,
          workloads: 0,
        },
      };
    }

    await Promise.allSettled(
      requests.map((request) =>
        dispatch(
          ensureExecutiveSummary({
            type: request.type,
            id: request.id,
            item: request.item,
            forceRefresh: true,
          })
        )
      )
    );

    return {
      requested: requests.map(({ type, id, reason }) => ({ type, id, reason })),
      counts: {
        environments: environmentRequests.length,
        workloads: workloadRequests.length,
      },
    };
  }
);

export const refreshCommandCenterSuggestions = createAsyncThunk(
  'operations/refreshCommandCenterSuggestions',
  async (params = {}, { dispatch, getState, rejectWithValue }) => {
    const chatId = String(params.chatId || '').trim();
    const mode = params.mode === 'append' ? 'append' : 'replace';
    const page = Number.isFinite(Number(params.page)) ? Number(params.page) : 0;
    const requestKey = buildSuggestionRequestKey({ chatId, mode, page });

    try {
      const response = await getCommandCenterBootstrap({
        chatId: chatId || undefined,
        personalization:
          params.personalization && typeof params.personalization === 'object'
            ? params.personalization
            : undefined,
      });

      const cards = Array.isArray(response?.chatStartBrief?.cards)
        ? response.chatStartBrief.cards
        : [];

      if (mode === 'append') {
        const existingCards = getState().commandCenter?.suggestionCards || [];
        dispatch(setCommandCenterSuggestionCards([...existingCards, ...cards]));
        dispatch(setCommandCenterSuggestionPage(page));
        if (response?.briefing) {
          dispatch(setCommandCenterBriefing(response.briefing));
        }
      } else {
        dispatch(
          setCommandCenterSuggestionsState({
            cards,
            suggestionPage: page,
            briefing: response?.briefing ?? null,
          })
        );
      }

      return {
        requestKey,
        chatId,
        mode,
        page,
        cards,
        response,
      };
    } catch (error) {
      return rejectWithValue({
        message: error?.message || 'Failed to refresh suggestions',
        status: Number(error?.status) || null,
        requestKey,
      });
    }
  },
  {
    condition: (params = {}, { getState }) => {
      const requestKey = buildSuggestionRequestKey(params);
      if (!requestKey) return false;
      return getState().operations?.suggestionRequestsByKey?.[requestKey]?.status !== 'loading';
    },
  }
);

const operationsSlice = createSlice({
  name: 'operations',
  initialState,
  reducers: {
    clearOperationsState: () => initialState,
    setScannerUpdatesConnectionId: (state, action) => {
      state.scannerUpdatesConnectionId = String(action.payload || '').trim();
    },
    registerReportOperation: (state, action) => {
      const record = buildReportOperationRecord(action.payload || {});
      if (!record.scanId) return;
      const existing = state.reportOperationsByScanId[record.scanId] || {};
      state.reportOperationsByScanId[record.scanId] = {
        ...existing,
        ...record,
        startedAt: existing.startedAt || record.startedAt,
      };
    },
    updateReportOperation: (state, action) => {
      const scanId = String(action.payload?.scanId || '').trim();
      if (!scanId) return;
      const existing = state.reportOperationsByScanId[scanId];
      if (!existing) return;
      state.reportOperationsByScanId[scanId] = {
        ...existing,
        ...action.payload,
        updatedAt: new Date().toISOString(),
      };
    },
    completeReportOperation: (state, action) => {
      const scanId = String(action.payload?.scanId || '').trim();
      if (!scanId) return;
      const existing = state.reportOperationsByScanId[scanId];
      if (!existing) return;
      state.reportOperationsByScanId[scanId] = {
        ...existing,
        status: 'succeeded',
        latestScanStatus: 'done',
        assessmentResultsUrl: action.payload?.assessmentResultsUrl || existing.assessmentResultsUrl || null,
        error: null,
        updatedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      };
    },
    failReportOperation: (state, action) => {
      const scanId = String(action.payload?.scanId || '').trim();
      if (!scanId) return;
      const existing = state.reportOperationsByScanId[scanId];
      if (!existing) return;
      state.reportOperationsByScanId[scanId] = {
        ...existing,
        status: 'failed',
        error: action.payload?.error || 'Failed to run report',
        updatedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => initialState)
      .addCase(ensureExecutiveSummary.pending, (state, action) => {
        const key = buildExecutiveSummaryKey(
          action.meta.arg?.type,
          action.meta.arg?.id || action.meta.arg?.recordId || action.meta.arg?.workloadId
        );
        if (!key) return;
        state.executiveSummaryRequestsByKey[key] = {
          status: 'loading',
          error: null,
          startedAt: new Date().toISOString(),
          finishedAt: null,
        };
      })
      .addCase(ensureExecutiveSummary.fulfilled, (state, action) => {
        const { key, type, id, summary, source } = action.payload || {};
        if (!key || !summary) return;
        const finishedAt = new Date().toISOString();
        state.executiveSummaryRequestsByKey[key] = {
          status: 'succeeded',
          error: null,
          startedAt:
            state.executiveSummaryRequestsByKey[key]?.startedAt || finishedAt,
          finishedAt,
          source,
        };
        state.executiveSummariesByKey[key] = {
          key,
          type,
          id,
          summary,
          updatedAt: summary?.updatedAt || finishedAt,
          source,
        };
      })
      .addCase(ensureExecutiveSummary.rejected, (state, action) => {
        const key = buildExecutiveSummaryKey(
          action.meta.arg?.type,
          action.meta.arg?.id || action.meta.arg?.recordId || action.meta.arg?.workloadId
        );
        if (!key || action.meta.condition) return;
        state.executiveSummaryRequestsByKey[key] = {
          status: 'failed',
          error:
            action.payload || action.error?.message || 'Failed to generate executive summary',
          startedAt: state.executiveSummaryRequestsByKey[key]?.startedAt || null,
          finishedAt: new Date().toISOString(),
        };
      })
      .addCase(refreshCommandCenterSuggestions.pending, (state, action) => {
        const requestKey = buildSuggestionRequestKey(action.meta.arg);
        if (!requestKey) return;
        state.suggestionRequestsByKey[requestKey] = {
          status: 'loading',
          error: null,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          mode: action.meta.arg?.mode === 'append' ? 'append' : 'replace',
          page: Number.isFinite(Number(action.meta.arg?.page))
            ? Number(action.meta.arg.page)
            : 0,
        };
      })
      .addCase(refreshCommandCenterSuggestions.fulfilled, (state, action) => {
        const requestKey = action.payload?.requestKey || buildSuggestionRequestKey(action.meta.arg);
        if (!requestKey) return;
        state.suggestionRequestsByKey[requestKey] = {
          status: 'succeeded',
          error: null,
          startedAt:
            state.suggestionRequestsByKey[requestKey]?.startedAt || new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          mode: action.payload?.mode || 'replace',
          page: action.payload?.page || 0,
        };
      })
      .addCase(refreshCommandCenterSuggestions.rejected, (state, action) => {
        const requestKey =
          action.payload?.requestKey || buildSuggestionRequestKey(action.meta.arg);
        if (!requestKey || action.meta.condition) return;
        state.suggestionRequestsByKey[requestKey] = {
          status: 'failed',
          error:
            action.payload?.message || action.error?.message || 'Failed to refresh suggestions',
          startedAt: state.suggestionRequestsByKey[requestKey]?.startedAt || null,
          finishedAt: new Date().toISOString(),
          mode: action.meta.arg?.mode === 'append' ? 'append' : 'replace',
          page: Number.isFinite(Number(action.meta.arg?.page))
            ? Number(action.meta.arg.page)
            : 0,
        };
      });
  },
});

export const {
  clearOperationsState,
  completeReportOperation,
  failReportOperation,
  registerReportOperation,
  setScannerUpdatesConnectionId,
  updateReportOperation,
} = operationsSlice.actions;

export const selectScannerUpdatesConnectionId = (state) =>
  state.operations?.scannerUpdatesConnectionId || '';

export const selectExecutiveSummaryRequestsByKey = (state) =>
  state.operations?.executiveSummaryRequestsByKey || {};

export const selectExecutiveSummariesByKey = (state) =>
  state.operations?.executiveSummariesByKey || {};

export const selectSuggestionRequestsByKey = (state) =>
  state.operations?.suggestionRequestsByKey || {};

export const selectReportOperationsByScanId = (state) =>
  state.operations?.reportOperationsByScanId || {};

export const selectExecutiveSummaryForItem = (state, type, id) => {
  const key = buildExecutiveSummaryKey(type, id);
  const cached = state.operations?.executiveSummariesByKey?.[key]?.summary || null;
  if (cached?.summaryText) {
    return cached;
  }

  if (type === 'workload') {
    return parseSummary(findWorkloadById(state, id)?.summary);
  }

  return parseSummary(findEnvironmentById(state, id)?.summary);
};

export const selectIsExecutiveSummaryLoading = (state, type, id) =>
  state.operations?.executiveSummaryRequestsByKey?.[buildExecutiveSummaryKey(type, id)]?.status ===
  'loading';

export default operationsSlice.reducer;
