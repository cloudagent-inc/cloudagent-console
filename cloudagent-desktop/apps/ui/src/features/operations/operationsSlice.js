import { generateClient } from 'aws-amplify/api';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  logout,
  refreshAccountScans,
  updatePermissionProfileSummary,
  updateWorkloadSummaryInUserProfile,
} from '../auth/authSlice';
import { updateWorkloadSummary } from '../workload/workloadSlice';
import { fetchBlueprints } from '../skill/skillSlice';
import { generateExecutiveSummary } from '../../api/executiveSummary';
import { ingestScannerRecommendations } from '../../api/recommendationsApi';
import { getCommandCenterBootstrap } from '../../api/commandCenterApi';
import { initiateAssessment } from '../../api/assessments';
import { refreshUserCredits } from '../agent/agentSlice';
import { isSupportedExecutiveSummaryEnvironmentType } from '../../helpers/shared';
import {
  getPermissionProfileAwsAccountId,
  getPermissionProfileAzureSubscriptionId,
  getPermissionProfileDomain,
  getPermissionProfileId,
  resolveWorkloadEnvironmentProfile,
} from '../workload/workloadEnvironmentUtils';
import {
  onUpdateReportHistoryAssessmentResults,
  onUpdateReportHistoryStatus,
} from '../../api/eventQueries';
import {
  setBriefing as setCommandCenterBriefing,
  setSuggestionCards as setCommandCenterSuggestionCards,
  setSuggestionPageAction as setCommandCenterSuggestionPage,
  setSuggestionsState as setCommandCenterSuggestionsState,
} from '../commandCenter/commandCenterSlice';
import { isLocalRuntime } from '../../runtime/cloudAgentRuntime';

const client = generateClient();
const PLANS_BASE_URL =
  'https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/plans';
const reportOperationSubscriptionsByScanId = new Map();
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

const serializeStoreError = (error, fallback = 'Request failed') => {
  if (!error) return null;
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'object') {
    return error.message || JSON.stringify(error);
  }
  return String(error);
};

const normalizeCreditAmount = (value, fallback = 1) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getAvailableCreditsFromProfile = (userProfile = {}) => {
  const agentCredits = userProfile?.agentCredits || {};
  return (
    Number(agentCredits.monthlyBaseCredits || 0) +
    Number(agentCredits.adhocCredits || 0)
  );
};

const formatInsufficientCreditsMessage = (required, available) =>
  `Insufficient credits. This operation requires ${required} credits, but you have ${available}.`;

const initialState = {
  scannerUpdatesConnectionId: '',
  executiveSummaryRequestsByKey: {},
  executiveSummariesByKey: {},
  recommendationRefresh: {
    status: 'idle',
    error: null,
    startedAt: null,
    finishedAt: null,
    progress: null,
    result: null,
  },
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

const toArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
};

const buildAzureAssessmentConfig = ({ authProfile = {}, services = [], regions = [] }) => {
  const azureRegions = Array.isArray(regions) && regions.length > 0 ? regions : ['all'];
  const tenantId =
    authProfile.tenantId ||
    authProfile.azureTenantId ||
    authProfile.directoryTenantId ||
    authProfile.accountId ||
    '';
  const tenantType =
    authProfile.tenantType ||
    authProfile.azureTenantType ||
    (['m365', 'entra'].includes(authProfile.provider) ? authProfile.provider : 'azure');
  const subscriptionIds =
    toArray(authProfile.subscriptionIds).length > 0
      ? toArray(authProfile.subscriptionIds)
      : toArray(authProfile.azureSubscriptionIds).length > 0
        ? toArray(authProfile.azureSubscriptionIds)
        : Array.isArray(authProfile.subscriptions)
          ? authProfile.subscriptions
              .map((subscription) => subscription?.subscriptionId || subscription?.id)
              .filter(Boolean)
          : tenantType === 'm365' || tenantType === 'entra'
            ? [tenantType]
            : [];
  const authDetails = authProfile.authDetails || (
    authProfile.clientId && authProfile.clientSecret
      ? {
          all: {
            clientId: authProfile.clientId,
            clientSecret: authProfile.clientSecret,
          },
        }
      : {}
  );

  return {
    tenantId,
    subscriptionIds,
    authDetails,
    services,
    regions: azureRegions,
    tenantType,
    tenantEnvironment: authProfile.tenantEnvironment || authProfile.azureEnvironment || 'public',
  };
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

const fetchPlanDefinition = async (planId) => {
  const normalizedPlanId = String(planId || '').trim();
  if (!normalizedPlanId) {
    throw new Error('Report plan was not found');
  }

  const response = await fetch(`${PLANS_BASE_URL}/${normalizedPlanId}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load report plan (${response.status})`);
  }
  return response.json();
};

const teardownReportOperationTracking = (scanId) => {
  const subscriptionSet = reportOperationSubscriptionsByScanId.get(scanId);
  if (subscriptionSet?.postSubscription) {
    try {
      subscriptionSet.postSubscription.unsubscribe();
    } catch (_) {
      // Ignore unsubscribe failures.
    }
  }
  if (subscriptionSet?.resultsSubscription) {
    try {
      subscriptionSet.resultsSubscription.unsubscribe();
    } catch (_) {
      // Ignore unsubscribe failures.
    }
  }
  if (subscriptionSet?.reportHistoryStatusSubscription) {
    try {
      subscriptionSet.reportHistoryStatusSubscription.unsubscribe();
    } catch (_) {
      // Ignore unsubscribe failures.
    }
  }
  if (subscriptionSet?.reportHistoryResultsSubscription) {
    try {
      subscriptionSet.reportHistoryResultsSubscription.unsubscribe();
    } catch (_) {
      // Ignore unsubscribe failures.
    }
  }
  reportOperationSubscriptionsByScanId.delete(scanId);
};

export const stopAllTrackedReportOperations = () => {
  Array.from(reportOperationSubscriptionsByScanId.keys()).forEach((scanId) => {
    teardownReportOperationTracking(scanId);
  });
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

  if (reportOperationSubscriptionsByScanId.has(normalizedScanId)) {
    return;
  }

  const reportHistoryStatusSubscription = client
    .graphql({
      query: onUpdateReportHistoryStatus,
      variables: { userId: normalizedUserId },
    })
    .subscribe({
      next: (value) => {
        const event = value?.data?.onUpdateReportHistoryStatus;
        if (!event || event.scanId !== normalizedScanId) {
          return;
        }

        const latestScanStatus = event.status || 'in_progress';
        dispatch(
          updateReportOperation({
            scanId: normalizedScanId,
            latestScanStatus,
          })
        );

        if (FAILED_REPORT_STATUS_SET.has(normalizeStatusToken(latestScanStatus))) {
          dispatch(
            failReportOperation({
              scanId: normalizedScanId,
              error: `Report ended with status: ${latestScanStatus}`,
            })
          );
          dispatch(refreshAccountScans()).catch(() => {});
          teardownReportOperationTracking(normalizedScanId);
        }
      },
      error: (error) => {
        console.error('[operations.ensureReportOperationTracking] onUpdateReportHistoryStatus error:', error);
      },
    });

  const reportHistoryResultsSubscription = client
    .graphql({
      query: onUpdateReportHistoryAssessmentResults,
      variables: { userId: normalizedUserId },
    })
    .subscribe({
      next: async (value) => {
        const event = value?.data?.onUpdateReportHistoryAssessmentResults;
        if (!event || event.scanId !== normalizedScanId || !event.assessmentResultsUrl) {
          return;
        }

        dispatch(
          completeReportOperation({
            scanId: normalizedScanId,
            assessmentResultsUrl: event.assessmentResultsUrl,
          })
        );

        try {
          await dispatch(refreshAccountScans()).unwrap();
        } catch (error) {
          console.error(
            '[operations.ensureReportOperationTracking] Failed to refresh report history:',
            error
          );
        }

        dispatch(refreshRecommendationsFromScans({ refreshBlueprints: false })).catch((error) => {
          console.error(
            '[operations.ensureReportOperationTracking] Failed to refresh recommendations:',
            error
          );
        });

        teardownReportOperationTracking(normalizedScanId);
      },
      error: (error) => {
        console.error(
          '[operations.ensureReportOperationTracking] onUpdateReportHistoryAssessmentResults error:',
          error
        );
      },
    });

  reportOperationSubscriptionsByScanId.set(normalizedScanId, {
    reportHistoryStatusSubscription,
    reportHistoryResultsSubscription,
  });
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
    const planData = await fetchPlanDefinition(planId).catch((error) => {
      throw error;
    });

    const firstTask = planData?.plan?.[0]?.tasks?.[0] || {};
    const reportId =
      normalizeReportId(params.reportId || firstTask?.reportId, planId);
    const title = params.title || planData?.title || firstTask?.title || 'Report Run';
    const requiredCredits = normalizeCreditAmount(
      params.credits ?? planData?.credits ?? planData?.creditCost,
      1
    );
    const availableCredits = getAvailableCreditsFromProfile(state.auth?.userProfile);
    if (!isLocalRuntime() && availableCredits < requiredCredits) {
      return rejectWithValue(
        formatInsufficientCreditsMessage(requiredCredits, availableCredits)
      );
    }

    const services = Array.isArray(firstTask?.services) ? firstTask.services : [];
    const isGoogleWorkspace =
      cloudProvider === 'google_workspace' || authProfile?.provider === 'google_workspace';
    const isAzure = cloudProvider === 'azure' || authProfile?.provider === 'azure';
    const accountId =
      params.accountId ||
      (isGoogleWorkspace
        ? authProfile?.domain
        : isAzure
          ? authProfile?.tenantId || authProfile?.azureTenantId || authProfile?.accountId
        : authProfile?.awsAccountId || authProfile?.accountId) ||
      '';
    let scanId =
      String(params.scanId || '').trim() ||
      `${accountId}-${Date.now()}-${planId}`;

    if (!userId || !planId || !accountId) {
      return rejectWithValue('Report settings are incomplete');
    }

    const operationRecord = buildReportOperationRecord({
      scanId,
      reportId,
      planId,
      title,
      accountId,
      cloudProvider,
      parentId: params.parentId || null,
      authProfile,
      operationMode: 'background',
      latestScanStatus: 'starting',
    });

    dispatch(registerReportOperation(operationRecord));
    ensureReportOperationTracking({ dispatch, scanId, userId });

    try {
      await initiateAssessment({
        cloudProvider: isGoogleWorkspace ? 'google_workspace' : isAzure ? 'azure' : 'aws',
        config: isGoogleWorkspace
          ? {
              scanId,
              domain: authProfile?.domain,
              superAdminEmailAddress: authProfile?.adminEmail,
              serviceAccountJson:
                typeof authProfile?.serviceAccountJson === 'string'
                  ? authProfile.serviceAccountJson
                  : JSON.stringify(authProfile?.serviceAccountJson),
              services,
            }
          : isAzure
            ? buildAzureAssessmentConfig({
                authProfile,
                services,
                regions:
                  Array.isArray(params.regions) && params.regions.length > 0
                    ? params.regions
                    : ['all'],
              })
          : {
              accountId,
              services,
              regions:
                Array.isArray(params.regions) && params.regions.length > 0
                  ? params.regions
                  : ['us-east-1'],
              authProfile: {
                ...authProfile,
                accountId,
              },
            },
        common: {
          assessmentId: scanId,
          reportId,
          title,
          parentId: params.parentId || null,
          licenseType: 'ongoing',
          connectionId: null,
        },
        callbacks: {
          onError: (error) => {
            console.error('[operations.startBackgroundReportOperation] Assessment error:', error);
          },
          onSuccess: () => {},
        },
      });

      dispatch(
        updateReportOperation({
          scanId,
          latestScanStatus: 'started',
        })
      );

      dispatch(refreshUserCredits())
        .unwrap()
        .catch((error) => {
          console.warn('[operations.startBackgroundReportOperation] Failed to refresh credits:', error);
        });
      dispatch(refreshAccountScans()).catch(() => {});

      return operationRecord;
    } catch (error) {
      dispatch(
        failReportOperation({
          scanId,
          error: error?.message || 'Failed to start report',
        })
      );
      teardownReportOperationTracking(scanId);
      return rejectWithValue(error?.message || 'Failed to start report');
    }
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

export const refreshRecommendationsFromScans = createAsyncThunk(
  'operations/refreshRecommendationsFromScans',
  async (params = {}, { dispatch, getState, rejectWithValue }) => {
    const state = getState();
    const reportHistory = state.auth?.userProfile?.reportHistory || [];
    const history = state.auth?.userProfile?.recommendations?.history || [];

    if (!Array.isArray(reportHistory) || reportHistory.length === 0) {
      return rejectWithValue('No report history available to refresh');
    }

    try {
      dispatch(setRecommendationsRefreshProgress({ current: 0, total: 0 }));

      const results = await ingestScannerRecommendations(
        reportHistory,
        history,
        dispatch,
        (progress) => {
          dispatch(setRecommendationsRefreshProgress(progress));
        }
      );

      if (params.refreshBlueprints !== false) {
        try {
          await dispatch(fetchBlueprints({ count: 50 })).unwrap();
        } catch (error) {
          console.warn('[operations.refreshRecommendationsFromScans] Failed to refresh blueprints', error);
        }
      }

      const successful = results.filter((result) => result?.success).length;
      const failed = results.filter((result) => !result?.success).length;

      return {
        results,
        total: results.length,
        successful,
        failed,
      };
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to refresh recommendations');
    }
  },
  {
    condition: (_params = {}, { getState }) =>
      getState().operations?.recommendationRefresh?.status !== 'loading',
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
    setRecommendationsRefreshProgress: (state, action) => {
      if (!action.payload || typeof action.payload !== 'object') {
        state.recommendationRefresh.progress = null;
        return;
      }

      state.recommendationRefresh.progress = {
        ...action.payload,
        error: serializeStoreError(action.payload.error),
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
      .addCase(refreshRecommendationsFromScans.pending, (state) => {
        state.recommendationRefresh = {
          status: 'loading',
          error: null,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          progress: { current: 0, total: 0 },
          result: null,
        };
      })
      .addCase(refreshRecommendationsFromScans.fulfilled, (state, action) => {
        state.recommendationRefresh = {
          status: 'succeeded',
          error: null,
          startedAt:
            state.recommendationRefresh?.startedAt || new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          progress: state.recommendationRefresh?.progress || null,
          result: action.payload || null,
        };
      })
      .addCase(refreshRecommendationsFromScans.rejected, (state, action) => {
        if (action.meta.condition) return;
        state.recommendationRefresh = {
          status: 'failed',
          error:
            action.payload || action.error?.message || 'Failed to refresh recommendations',
          startedAt: state.recommendationRefresh?.startedAt || null,
          finishedAt: new Date().toISOString(),
          progress: state.recommendationRefresh?.progress || null,
          result: null,
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
  setRecommendationsRefreshProgress,
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

export const selectRecommendationRefreshState = (state) =>
  state.operations?.recommendationRefresh || initialState.recommendationRefresh;

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

export const selectIsRecommendationsRefreshLoading = (state) =>
  state.operations?.recommendationRefresh?.status === 'loading';

export default operationsSlice.reducer;
