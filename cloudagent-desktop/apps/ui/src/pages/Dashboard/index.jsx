import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  HelpCircle,
  ExternalLink,
  Gauge,
  Clock,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  GitBranch,
  Bot,
  FileBarChart,
  Loader2,
  ChevronRight,
  X,
  BookOpen,
  Compass,
  ChevronDown,
  LogOut,
  Server,
  FolderOpen,
  KeyRound,
} from 'lucide-react';
import { signOut } from '@aws-amplify/auth';
import { buildReportEntryKey } from '@/helpers/accountScans';
import { logout } from '../../features/auth/authSlice';
import DashboardSidebar from '../../components/DashboardSidebar';
import { clearSuggestions } from '../../features/commandCenter/commandCenterSlice';
import OnboardingModal from '../../components/OnboardingModal';
import OnboardingSurveyModal from '../../components/OnboardingSurveyModal';
import { shouldShowSurvey } from '../../helpers/onboardingIntentConfig';
import { analytics } from '../../hooks/useAnalytics';
import { Icons } from '../../components/icons';
import { Button } from '../../components/ui/button';
import { ScrollArea } from '../../components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { refreshUserProfile } from '../../features/auth/authSlice';
import { getOverviewData } from '../../features/overview/overviewSlice';
import {
  setScannerUpdatesConnectionId as setScannerUpdatesConnectionIdAction,
  stopAllTrackedReportOperations,
} from '../../features/operations/operationsSlice';
import {
  launchHealthScans,
  markEnvironmentHealthScanFailed,
  markEnvironmentHealthScanReady,
  markWorkloadHealthScanFailed,
  markWorkloadHealthScanReady,
  refreshEnvironmentHealth,
  refreshWorkloadHealth,
} from '../../features/health/healthSlice';
import {
  DEFAULT_HEALTH_MAX_AGE_HOURS,
  getWorkloadPermissionProfileIds,
} from '@/features/health/healthUtils';
import {
  launchEnvironmentCostScans,
  markEnvironmentCostScanFailed,
  markEnvironmentCostScanReady,
} from '../../features/cost/costSlice';
import {
  launchEnvironmentThreatScans,
  markEnvironmentThreatScanFailed,
  markEnvironmentThreatScanReady,
} from '../../features/threat/threatSlice';
import {
  buildPermissionProfileLookup,
  matchesAgentRun,
  matchesReportScan,
  matchesWorkflowRun,
  matchesWorkload,
  selectActiveWorkspaceScope,
  selectWorkspaceScopedEnvironmentProfiles,
} from '@/features/workspace/workspaceScope';
import {
  DEFAULT_CUSTOMER_KEY,
  SCAN_UPDATES_WEBSOCKET_ENDPOINT,
} from '@/config/appConfig';
import { hasRuntimeCapability, isLocalRuntime } from '@/runtime/cloudAgentRuntime';
import { localSettingsClient } from '@/api/clients/localSettingsClient';
import {
  canRunLocalAwsScannersForProfile,
  isAwsCredentialBackedProfile,
} from '@/features/workspace/credentialStatus';
import {
  getDashboardAutoRefreshOnLogin,
  getDashboardRefreshPeriodsHours,
} from '@/lib/userSettings';

const RUNNING_STATUS_SET = new Set(['running', 'in_progress', 'started', 'processing']);
const WAITING_STATUS_SET = new Set([
  'waiting', 'waiting_on_user_input', 'agent_waiting_on_user_input',
  'waiting_on_user', 'pending', 'paused', 'pending_approval', 'approval_required',
]);
const FAILED_STATUS_SET = new Set(['failed', 'error']);
const REPORT_SUCCESS_STATUS_SET = new Set(['successful', 'partial_success', 'complete', 'completed', 'done']);

function normalizeStatusToken(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

const COMPLETED_STATUS_SET = new Set(['successful', 'partial_success', 'complete', 'completed', 'done']);

function classifyQueueStatus(value) {
  const n = normalizeStatusToken(value);
  if (RUNNING_STATUS_SET.has(n)) return 'running';
  if (WAITING_STATUS_SET.has(n)) return 'waiting';
  if (FAILED_STATUS_SET.has(n)) return 'failed';
  if (COMPLETED_STATUS_SET.has(n)) return 'completed';
  return null;
}

function classifyReportQueueStatus(value) {
  const n = normalizeStatusToken(value);
  if (REPORT_SUCCESS_STATUS_SET.has(n)) return 'completed';
  return classifyQueueStatus(value);
}

function extractWorkflowTitle(workflow) {
  try {
    if (workflow?.workflowDefinition) {
      const parsed = JSON.parse(workflow.workflowDefinition);
      if (parsed?.workflowName) return parsed.workflowName;
    }
  } catch { /* ignore */ }
  return workflow?.workflowName || workflow?.title || workflow?.workflowRunId || 'Workflow Run';
}

function extractAgentTitle(agent) {
  return agent?.title || agent?.agentType || agent?.recordId || 'Agent Run';
}

function normalizeProfileType(value) {
  return String(value || '').trim().toLowerCase().replace(/_/g, ' ');
}

function isAwsAccountProfile(profile) {
  return normalizeProfileType(profile?.type) === 'aws account';
}

function isAzureSubscriptionProfile(profile) {
  const authProfile = safeParseJson(profile?.authProfile);
  return (
    normalizeProfileType(profile?.type) === 'azure subscription' ||
    (authProfile?.provider === 'azure' && Boolean(authProfile?.subscriptionId))
  );
}

function isAzureTenantProfile(profile) {
  const authProfile = safeParseJson(profile?.authProfile);
  return (
    normalizeProfileType(profile?.type) === 'azure tenant' ||
    (authProfile?.provider === 'azure' && !authProfile?.subscriptionId)
  );
}

function isAzureProfile(profile) {
  return isAzureTenantProfile(profile) || isAzureSubscriptionProfile(profile);
}

function getProfileCloudProvider(profile) {
  return isAzureProfile(profile) ? 'azure' : 'aws';
}

function isAwsOrgProfile(profile) {
  return normalizeProfileType(profile?.type) === 'aws org';
}

function safeParseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function parseSummaryObject(summary) {
  if (!summary) return {};
  if (typeof summary === 'object') return summary;
  if (typeof summary !== 'string') return {};
  try {
    const parsed = JSON.parse(summary);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function extractEnvironmentProfileIds(environmentValue) {
  const profileIds = new Set();
  const addProfileId = (value) => {
    const profileId = String(value || '').trim();
    if (profileId) profileIds.add(profileId);
  };
  const visit = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'string') {
      addProfileId(value);
      return;
    }
    if (typeof value !== 'object') return;
    addProfileId(value.profileId);
    addProfileId(value.environmentProfileId);
    addProfileId(value.permissionProfileId);
    addProfileId(value.recordId);
    addProfileId(value.id);
  };
  visit(environmentValue);
  return Array.from(profileIds);
}

function getWorkloadEnvironmentProfileIds(workload) {
  const metadata = safeParseJson(workload?.metadata);
  return extractEnvironmentProfileIds([
    metadata?.environmentProfileId,
    metadata?.environment,
    workload?.environmentProfileId,
    workload?.environment,
    workload?.environments,
  ]);
}

function isAzureTrackedResource(resource) {
  const resourceType = String(
    resource?.canonicalResourceType || resource?.resourceType || resource?.type || ''
  ).toLowerCase();
  const resourceId = String(resource?.resourceId || resource?.identifier || '').toLowerCase();
  return resourceType.startsWith('microsoft.') || resourceId.startsWith('/subscriptions/');
}

function inferWorkloadCloudProvider(workload, permissionProfilesById) {
  const profileProviders = getWorkloadEnvironmentProfileIds(workload)
    .map((profileId) => getProfileCloudProvider(permissionProfilesById.get(profileId)))
    .filter(Boolean);
  if (profileProviders.includes('azure')) return 'azure';

  const trackedResources = safeParseJson(workload?.trackedResources);
  const resources = Array.isArray(trackedResources?.resources) ? trackedResources.resources : [];
  return resources.some(isAzureTrackedResource) ? 'azure' : 'aws';
}

function isFreshTimestamp(value, maxAgeHours = DEFAULT_HEALTH_MAX_AGE_HOURS) {
  const timestamp = Date.parse(String(value || ''));
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  return Date.now() - timestamp < maxAgeHours * 60 * 60 * 1000;
}

function getAnalysisGeneratedAt(container, key) {
  const analysis =
    container?.analysis && typeof container.analysis === 'object' ? container.analysis : {};
  const artifact = analysis?.[key];
  if (!artifact || typeof artifact !== 'object') return '';
  return artifact.generatedAt || artifact.createdAt || artifact.timestamp || '';
}

function hasFreshProfileAnalysis(profile, key, maxAgeHours = DEFAULT_HEALTH_MAX_AGE_HOURS) {
  return isFreshTimestamp(
    getAnalysisGeneratedAt(parseSummaryObject(profile?.summary), key),
    maxAgeHours
  );
}

function hasFreshWorkloadHealth(workload, maxAgeHours = DEFAULT_HEALTH_MAX_AGE_HOURS) {
  return isFreshTimestamp(
    getAnalysisGeneratedAt(parseSummaryObject(workload?.summary), 'health'),
    maxAgeHours
  );
}

function extractEnvironmentAccountId(profile) {
  const authProfile = safeParseJson(profile?.authProfile);
  return authProfile?.awsAccountId || authProfile?.aws_account_id || null;
}

function getPermissionProfileId(profile) {
  return String(profile?.recordId || profile?.id || profile?.permissionProfileId || '').trim();
}

function getAzureTenantId(profile) {
  const authProfile = safeParseJson(profile?.authProfile);
  return String(authProfile?.tenantId || authProfile?.azureTenantId || '').trim();
}

function buildAwsAccountBootstrapSourceIds(profiles = []) {
  const normalizedProfiles = (Array.isArray(profiles) ? profiles : [])
    .map((profile) => {
      const permissionProfileId = getPermissionProfileId(profile);
      if (!permissionProfileId) return null;

      const type = normalizeProfileType(profile?.type);
      if (type !== 'aws account') return null;

      const authProfile = safeParseJson(profile?.authProfile);

      return {
        permissionProfileId,
        type,
        accountId: String(
          authProfile?.awsAccountId || authProfile?.aws_account_id || authProfile?.accountId || ''
        ).trim(),
      };
    })
    .filter(Boolean);

  const sourceIds = new Set();
  normalizedProfiles.forEach((profile) => {
    sourceIds.add(profile.permissionProfileId);
  });

  return Array.from(sourceIds);
}

function dedupeBootstrapTargets(targets = []) {
  const seen = new Set();
  return (Array.isArray(targets) ? targets : []).filter((target) => {
    const permissionProfileId = String(target?.permissionProfileId || '').trim();
    const cloudProvider = String(target?.cloudProvider || 'aws').trim().toLowerCase() || 'aws';
    const key = `${cloudProvider}:${permissionProfileId}`;
    if (!permissionProfileId || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildEnvironmentHealthBootstrapTargets(profiles = []) {
  return dedupeBootstrapTargets(
    (Array.isArray(profiles) ? profiles : [])
      .filter((profile) => isAwsAccountProfile(profile) || isAzureProfile(profile))
      .map((profile) => ({
        permissionProfileId: getPermissionProfileId(profile),
        cloudProvider: getProfileCloudProvider(profile),
      }))
  );
}

function buildEnvironmentCostBootstrapTargets(profiles = []) {
  const safeProfiles = Array.isArray(profiles) ? profiles : [];
  const azureSubscriptionsByTenantId = new Map();

  safeProfiles.forEach((profile) => {
    if (!isAzureSubscriptionProfile(profile)) return;
    const tenantId = getAzureTenantId(profile);
    if (!tenantId) return;
    const current = azureSubscriptionsByTenantId.get(tenantId) || [];
    current.push(profile);
    azureSubscriptionsByTenantId.set(tenantId, current);
  });

  return dedupeBootstrapTargets(
    safeProfiles.flatMap((profile) => {
      const permissionProfileId = getPermissionProfileId(profile);
      if (!permissionProfileId) return [];

      if (isAwsAccountProfile(profile)) {
        return [{ permissionProfileId, cloudProvider: 'aws' }];
      }

      if (isAzureSubscriptionProfile(profile)) {
        return [{ permissionProfileId, cloudProvider: 'azure' }];
      }

      if (isAzureTenantProfile(profile)) {
        const tenantId = getAzureTenantId(profile);
        const subscriptionTargets = (azureSubscriptionsByTenantId.get(tenantId) || [])
          .map((subscriptionProfile) => ({
            permissionProfileId: getPermissionProfileId(subscriptionProfile),
            cloudProvider: 'azure',
          }))
          .filter((target) => target.permissionProfileId);

        return [
          { permissionProfileId, cloudProvider: 'azure' },
          ...subscriptionTargets,
        ];
      }

      return [];
    })
  );
}

function shouldBootstrapWorkloadHealth(workload) {
  if (!workload) return false;

  const metadata = safeParseJson(workload?.metadata);
  const trackedResources = safeParseJson(workload?.trackedResources);
  const resources = Array.isArray(trackedResources?.resources) ? trackedResources.resources : [];
  const environments = Array.isArray(workload?.environments) ? workload.environments : [];
  const hasEnvironmentProfileId = Boolean(metadata?.environmentProfileId);

  return hasEnvironmentProfileId || environments.length > 0 || resources.length > 0;
}

function extractEnvironmentTitle(profile, fallbackId = null) {
  return (
    profile?.name ||
    profile?.permissionProfileName ||
    profile?.displayName ||
    profile?.title ||
    extractEnvironmentAccountId(profile) ||
    fallbackId ||
    'Cloud Environment'
  );
}

function extractWorkloadTitle(workload, fallbackId = null) {
  return (
    workload?.workloadName ||
    workload?.title ||
    workload?.name ||
    fallbackId ||
    'Workload'
  );
}

function formatPanelTimestamp(value) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildRefreshItems({
  environmentById,
  workloadById,
  queueRunningItems,
  environmentHealthRequestsById,
  workloadHealthRequestsById,
  environmentCostRequestsById,
  environmentThreatRequestsById,
  executiveSummaryRequestsByKey,
  suggestionRequestsByKey,
  reportOperationsByScanId,
  recommendationRefreshState,
}) {
  const items = [];
  const seenKeys = new Set();
  const shouldIncludeEnvironmentRequest = (permissionProfileId) => {
    const profile = environmentById.get(permissionProfileId);
    if (!profile) return true;
    return isAwsAccountProfile(profile);
  };

  (queueRunningItems || []).forEach((item) => {
    const rowKey = `${item.category}:${item.id || item.title}`;
    if (seenKeys.has(rowKey)) return;
    seenKeys.add(rowKey);
    items.push({
      id: `queue-running:${rowKey}`,
      title: item.title || item.id || 'Untitled',
      categoryLabel:
        item.category === 'workflow'
          ? 'Workflow Run'
          : item.category === 'agent'
            ? 'Agent Run'
            : 'Report Run',
      detail: item.rawStatus || null,
      startedAt: item.updatedAt || null,
      path: item.path,
      icon: item.icon,
    });
  });

  Object.entries(environmentHealthRequestsById || {}).forEach(([permissionProfileId, request]) => {
    if (request?.status !== 'loading') return;
    if (!shouldIncludeEnvironmentRequest(permissionProfileId)) return;
    const profile = environmentById.get(permissionProfileId);
    const title = extractEnvironmentTitle(profile, permissionProfileId);
    const accountId = extractEnvironmentAccountId(profile);
    items.push({
      id: `environment-health:${permissionProfileId}`,
      title,
      categoryLabel: 'Environment Health',
      detail: accountId && accountId !== title ? accountId : null,
      startedAt: request?.startedAt || null,
      path: '/dashboard/health',
      icon: Gauge,
    });
  });

  Object.entries(workloadHealthRequestsById || {}).forEach(([workloadId, request]) => {
    if (request?.status !== 'loading') return;
    const workload = workloadById.get(workloadId);
    items.push({
      id: `workload-health:${workloadId}`,
      title: extractWorkloadTitle(workload, workloadId),
      categoryLabel: 'Workload Health',
      detail: workload?.workloadId && workload?.workloadName ? workload.workloadId : null,
      startedAt: request?.startedAt || null,
      path: '/dashboard/workloads',
      icon: Gauge,
    });
  });

  Object.entries(environmentCostRequestsById || {}).forEach(([permissionProfileId, request]) => {
    if (request?.status !== 'loading') return;
    if (!shouldIncludeEnvironmentRequest(permissionProfileId)) return;
    const profile = environmentById.get(permissionProfileId);
    const title = extractEnvironmentTitle(profile, permissionProfileId);
    const accountId = extractEnvironmentAccountId(profile);
    items.push({
      id: `environment-cost:${permissionProfileId}`,
      title,
      categoryLabel: 'Cost Analysis',
      detail: accountId && accountId !== title ? accountId : null,
      startedAt: request?.startedAt || null,
      path: '/dashboard/cost',
      icon: FileBarChart,
    });
  });

  Object.entries(environmentThreatRequestsById || {}).forEach(([permissionProfileId, request]) => {
    if (request?.status !== 'loading') return;
    if (!shouldIncludeEnvironmentRequest(permissionProfileId)) return;
    const profile = environmentById.get(permissionProfileId);
    const title = extractEnvironmentTitle(profile, permissionProfileId);
    const accountId = extractEnvironmentAccountId(profile);
    items.push({
      id: `environment-threat:${permissionProfileId}`,
      title,
      categoryLabel: 'Threat Detection',
      detail: accountId && accountId !== title ? accountId : null,
      startedAt: request?.startedAt || null,
      path: '/dashboard/threat',
      icon: ShieldAlert,
    });
  });

  Object.entries(executiveSummaryRequestsByKey || {}).forEach(([summaryKey, request]) => {
    if (request?.status !== 'loading') return;
    const [type, rawId] = String(summaryKey || '').split(':');
    const isWorkload = type === 'workload';
    const workload = isWorkload ? workloadById.get(rawId) : null;
    const profile = !isWorkload ? environmentById.get(rawId) : null;
    items.push({
      id: `executive-summary:${summaryKey}`,
      title: isWorkload
        ? extractWorkloadTitle(workload, rawId)
        : extractEnvironmentTitle(profile, rawId),
      categoryLabel: 'Executive Summary',
      detail: isWorkload ? 'Workload' : 'Environment',
      startedAt: request?.startedAt || null,
      path: '/dashboard/executive-summaries',
      icon: BookOpen,
    });
  });

  Object.entries(suggestionRequestsByKey || {}).forEach(([requestKey, request]) => {
    if (request?.status !== 'loading') return;
    const pageNumber = Number.isFinite(Number(request?.page)) ? Number(request.page) + 1 : 1;
    items.push({
      id: `suggestions:${requestKey}`,
      title: 'Command Center suggestions',
      categoryLabel: 'Suggestion Refresh',
      detail: request?.mode === 'append' ? `Loading page ${pageNumber}` : 'Refreshing starter cards',
      startedAt: request?.startedAt || null,
      path: '/dashboard/commandcenter',
      icon: Bot,
    });
  });

  Object.entries(reportOperationsByScanId || {}).forEach(([scanId, operation]) => {
    if (operation?.status !== 'loading') return;
    const duplicateQueueKey = `report:${scanId}`;
    if (seenKeys.has(duplicateQueueKey)) {
      return;
    }
    const detailParts = [];
    if (operation?.operationMode) {
      detailParts.push(
        operation.operationMode === 'background' ? 'Background' : 'Interactive'
      );
    }
    if (operation?.accountId) {
      detailParts.push(operation.accountId);
    }
    if (operation?.latestScanStatus) {
      detailParts.push(String(operation.latestScanStatus).replace(/_/g, ' '));
    }

    items.push({
      id: `report-operation:${scanId}`,
      title: operation?.title || operation?.reportId || scanId || 'Report Run',
      categoryLabel: 'Report Run',
      detail:
        detailParts.length > 0
          ? `${detailParts.join(' • ')} • Opens when ready`
          : 'Opens when ready',
      startedAt: operation?.startedAt || null,
      path: operation?.path || '/dashboard',
      navigationState: operation?.navigationState || null,
      icon: FileBarChart,
      disabled: true,
    });
  });

  items.sort((a, b) => {
    const dateA = Date.parse(a.startedAt || '') || 0;
    const dateB = Date.parse(b.startedAt || '') || 0;
    return dateB - dateA;
  });

  return items;
}

function DashboardTopBar({ 
  activeRightPanel,
  setActiveRightPanel,
  refreshItems,
  onboardingProgress,
  shouldShowOnboardingProgress,
  onOpenOnboarding,
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { userProfile } = useSelector((state) => state.auth);
  const activeWorkspaceScope = useSelector(selectActiveWorkspaceScope);
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false);
  const skipHelpMenuFocusRestoreRef = useRef(false);
  const isLocalMode = isLocalRuntime();
  const [localRuntimeInfo, setLocalRuntimeInfo] = useState({
    localDataDir: '',
    configuredLocalDataDir: '',
    activeLocalDataDir: '',
    localDataDirPendingRestart: false,
    localDataDirSource: 'preferences',
    mcpEnabled: hasRuntimeCapability('mcp'),
  });
  const [openAISettings, setOpenAISettings] = useState({
    hasApiKey: true,
    model: '',
    apiKeyMasked: '',
  });
  const [isMcpTogglePending, setIsMcpTogglePending] = useState(false);

  const localRuntimeBridge =
    typeof window !== 'undefined' && window.cloudAgentRuntime
      ? window.cloudAgentRuntime
      : null;

  useEffect(() => {
    if (!isLocalMode || typeof localRuntimeBridge?.getLocalRuntimeInfo !== 'function') {
      return;
    }
    let isMounted = true;
    localRuntimeBridge
      .getLocalRuntimeInfo()
      .then((info) => {
        if (!isMounted || !info) return;
        setLocalRuntimeInfo((current) => ({
          ...current,
          localDataDir: info.localDataDir || current.localDataDir || '',
          configuredLocalDataDir: info.configuredLocalDataDir || current.configuredLocalDataDir || '',
          activeLocalDataDir: info.activeLocalDataDir || current.activeLocalDataDir || '',
          localDataDirPendingRestart: Boolean(info.localDataDirPendingRestart),
          localDataDirSource: info.localDataDirSource || current.localDataDirSource || 'preferences',
          mcpEnabled:
            typeof info.mcpEnabled === 'boolean'
              ? info.mcpEnabled
              : current.mcpEnabled,
        }));
      })
      .catch((error) => {
        console.warn('Failed to load local runtime info:', error);
      });
    return () => {
      isMounted = false;
    };
  }, [isLocalMode, localRuntimeBridge]);

  useEffect(() => {
    if (!isLocalMode) return;
    let isMounted = true;
    const loadOpenAISettings = () => {
      localSettingsClient.getOpenAISettings()
        .then((response) => {
          if (!isMounted) return;
          setOpenAISettings(response?.settings || { hasApiKey: false });
        })
        .catch((error) => {
          console.warn('Failed to load local OpenAI settings:', error);
          if (isMounted) setOpenAISettings({ hasApiKey: false });
        });
    };
    const handleOpenAISettingsUpdated = (event) => {
      setOpenAISettings(event?.detail || { hasApiKey: false });
    };
    loadOpenAISettings();
    window.addEventListener('cloudagent:openai-settings-updated', handleOpenAISettingsUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('cloudagent:openai-settings-updated', handleOpenAISettingsUpdated);
    };
  }, [isLocalMode]);

  useEffect(() => {
    if (!isLocalMode) return undefined;
    const handleLocalRuntimeSettingsUpdated = (event) => {
      const info = event?.detail || {};
      setLocalRuntimeInfo((current) => ({
        ...current,
        localDataDir: info.localDataDir || current.localDataDir || '',
        configuredLocalDataDir: info.configuredLocalDataDir || current.configuredLocalDataDir || '',
        activeLocalDataDir: info.activeLocalDataDir || current.activeLocalDataDir || '',
        localDataDirPendingRestart:
          typeof info.localDataDirPendingRestart === 'boolean'
            ? info.localDataDirPendingRestart
            : current.localDataDirPendingRestart,
        localDataDirSource: info.localDataDirSource || current.localDataDirSource || 'preferences',
        mcpEnabled:
          typeof info.mcpEnabled === 'boolean'
            ? info.mcpEnabled
            : typeof info.configuredMcpEnabled === 'boolean'
              ? info.configuredMcpEnabled
              : current.mcpEnabled,
      }));
    };
    window.addEventListener('cloudagent:local-runtime-settings-updated', handleLocalRuntimeSettingsUpdated);
    return () => {
      window.removeEventListener('cloudagent:local-runtime-settings-updated', handleLocalRuntimeSettingsUpdated);
    };
  }, [isLocalMode]);

  const handleSignOut = async () => {
    try {
      dispatch(clearSuggestions());
      stopAllTrackedReportOperations();
      await signOut();
      dispatch(logout());
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  const { workflows: overviewWorkflows, agentHistory: overviewAgentHistory } = useSelector((state) => state.overview);
  const { userWorkflows } = useSelector((state) => state.workflow);
  const { agentHistory: agentHistoryFromTab } = useSelector((state) => state.agent);

  const openOnboardingModal = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onOpenOnboarding();
  }, [onOpenOnboarding]);

  const openOnboardingFromHelpMenu = useCallback(() => {
    skipHelpMenuFocusRestoreRef.current = true;
    setIsHelpMenuOpen(false);
    requestAnimationFrame(() => {
      openOnboardingModal();
    });
  }, [openOnboardingModal]);

  const handleToggleLocalMcp = useCallback(async () => {
    if (!isLocalMode || typeof localRuntimeBridge?.setLocalMcpEnabled !== 'function') {
      return;
    }
    const nextEnabled = !localRuntimeInfo.mcpEnabled;
    setIsMcpTogglePending(true);
    setLocalRuntimeInfo((current) => ({ ...current, mcpEnabled: nextEnabled }));
    try {
      const result = await localRuntimeBridge.setLocalMcpEnabled(nextEnabled);
      const resolvedEnabled =
        typeof result?.mcpEnabled === 'boolean'
          ? result.mcpEnabled
          : nextEnabled;
      setLocalRuntimeInfo((current) => ({
        ...current,
        mcpEnabled: resolvedEnabled,
      }));
      window.dispatchEvent(new CustomEvent('cloudagent:local-runtime-settings-updated', {
        detail: {
          ...(result || {}),
          mcpEnabled: resolvedEnabled,
        },
      }));
    } catch (error) {
      console.error('Failed to toggle local MCP server:', error);
      setLocalRuntimeInfo((current) => ({ ...current, mcpEnabled: !nextEnabled }));
    } finally {
      setIsMcpTogglePending(false);
    }
  }, [isLocalMode, localRuntimeBridge, localRuntimeInfo.mcpEnabled]);

  const handleOpenLocalDataDir = useCallback(async () => {
    if (!isLocalMode || typeof localRuntimeBridge?.openLocalDataDir !== 'function') {
      return;
    }
    skipHelpMenuFocusRestoreRef.current = true;
    setIsHelpMenuOpen(false);
    try {
      const result = await localRuntimeBridge.openLocalDataDir();
      if (result?.localDataDir) {
        setLocalRuntimeInfo((current) => ({
          ...current,
          localDataDir: result.localDataDir,
          configuredLocalDataDir: result.configuredLocalDataDir || current.configuredLocalDataDir || '',
          activeLocalDataDir: result.activeLocalDataDir || current.activeLocalDataDir || '',
          localDataDirPendingRestart: Boolean(result.localDataDirPendingRestart),
          localDataDirSource: result.localDataDirSource || current.localDataDirSource || 'preferences',
        }));
      }
      if (result?.ok === false) {
        console.warn('Failed to open local data folder:', result.error);
      }
    } catch (error) {
      console.error('Failed to open local data folder:', error);
    }
  }, [isLocalMode, localRuntimeBridge]);

  const permissionProfileLookup = useMemo(
    () => buildPermissionProfileLookup(userProfile?.agentPermissionProfiles || []),
    [userProfile?.agentPermissionProfiles]
  );
  const workloadsById = useMemo(() => {
    const map = new Map();
    (userProfile?.workloads || []).forEach((workload) => {
      const workloadId = String(workload?.workloadId || '').trim();
      if (!workloadId) return;
      map.set(workloadId, workload);
    });
    return map;
  }, [userProfile?.workloads]);

  const availableScans = useMemo(
    () =>
      (userProfile?.reportHistory || []).filter((scan) =>
        matchesReportScan(scan, activeWorkspaceScope)
      ),
    [activeWorkspaceScope, userProfile?.reportHistory]
  );

  const workflowRunsForCounters = useMemo(() => {
    const source = Array.isArray(userWorkflows) && userWorkflows.length > 0
      ? userWorkflows
      : (overviewWorkflows || []);
    return source.filter((workflow) =>
      matchesWorkflowRun(workflow, activeWorkspaceScope, { workloadById: workloadsById })
    );
  }, [activeWorkspaceScope, overviewWorkflows, userWorkflows, workloadsById]);

  const agentRunsForCounters = useMemo(() => {
    const source = (Array.isArray(agentHistoryFromTab) && agentHistoryFromTab.length > 0)
      ? agentHistoryFromTab
      : (overviewAgentHistory || []);
    return source.filter((agent) => {
      const type = normalizeStatusToken(agent?.agentType);
      return (
        type !== 'report' &&
        type !== 'assessment' &&
        matchesAgentRun(agent, activeWorkspaceScope, {
          permissionProfileLookup,
          workloadById: workloadsById,
        })
      );
    });
  }, [activeWorkspaceScope, agentHistoryFromTab, overviewAgentHistory, permissionProfileLookup, workloadsById]);

  const reportRunsForCounters = useMemo(
    () => (availableScans || []).filter((scan) => scan?.reportId),
    [availableScans]
  );

  const queueSummary = useMemo(() => {
    const lookbackMs = 7 * 24 * 60 * 60 * 1000;
    const cutoffTimestamp = Date.now() - lookbackMs;
    const toTimestamp = (...candidates) => {
      for (const value of candidates) {
        if (!value) continue;
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      return null;
    };

    const counts = {
      running: { workflow: 0, agent: 0, report: 0 },
      waiting: { workflow: 0, agent: 0, report: 0 },
      failed: { workflow: 0, agent: 0, report: 0 },
      completed: { workflow: 0, agent: 0, report: 0 },
    };
    const workflowItems = [];
    const agentItems = [];
    const reportItems = [];

    (workflowRunsForCounters || []).forEach((workflow) => {
      const ts = toTimestamp(workflow?.updatedAt, workflow?.lastUpdateTime, workflow?.createdAt);
      if (!ts || ts < cutoffTimestamp) return;
      const queueStatus = classifyQueueStatus(workflow?.workflowStatus);
      if (!queueStatus) return;
      workflowItems.push({
        id: workflow.workflowRunId || workflow.workflowId || null,
        title: extractWorkflowTitle(workflow),
        rawStatus: workflow?.workflowStatus || null,
        queueStatus,
        updatedAt: workflow?.updatedAt || workflow?.lastUpdateTime || workflow?.createdAt || null,
      });
      counts[queueStatus].workflow += 1;
    });

    (agentRunsForCounters || []).forEach((agent) => {
      const ts = toTimestamp(agent?.purchaseDate, agent?.updatedAt, agent?.createdAt);
      if (!ts || ts < cutoffTimestamp) return;
      const queueStatus = classifyQueueStatus(agent?.status);
      if (!queueStatus) return;
      agentItems.push({
        id: agent.recordId || agent.itemId || null,
        title: extractAgentTitle(agent),
        rawStatus: agent?.status || null,
        queueStatus,
        updatedAt: agent?.purchaseDate || agent?.updatedAt || agent?.createdAt || null,
      });
      counts[queueStatus].agent += 1;
    });

    (reportRunsForCounters || []).forEach((scan) => {
      const ts = toTimestamp(scan?.lastUpdateTime, scan?.latestAssessmentDate, scan?.updatedAt, scan?.createdAt);
      if (!ts || ts < cutoffTimestamp) return;
      const queueStatus = classifyReportQueueStatus(scan?.status);
      if (!queueStatus) return;
      reportItems.push({
        id: buildReportEntryKey(scan) || scan.scanId || scan.reportId || null,
        title: scan.title || scan.reportId || scan.scanId || 'Report Run',
        rawStatus: scan?.status || null,
        queueStatus,
        updatedAt: scan?.lastUpdateTime || scan?.latestAssessmentDate || null,
      });
      counts[queueStatus].report += 1;
    });

    const totals = {
      running: counts.running.workflow + counts.running.agent + counts.running.report,
      waiting: counts.waiting.workflow + counts.waiting.agent + counts.waiting.report,
      failed: counts.failed.workflow + counts.failed.agent + counts.failed.report,
      completed: counts.completed.workflow + counts.completed.agent + counts.completed.report,
    };

    return { counts, totals, workflows: workflowItems, agents: agentItems, reports: reportItems };
  }, [workflowRunsForCounters, agentRunsForCounters, reportRunsForCounters]);

  const queueCards = useMemo(() => [
    {
      key: 'completed',
      label: 'Done',
      count: queueSummary.totals.completed,
      breakdown: queueSummary.counts.completed,
      icon: CheckCircle2,
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    },
    {
      key: 'waiting',
      label: 'Waiting',
      count: queueSummary.totals.waiting,
      breakdown: queueSummary.counts.waiting,
      icon: Clock,
      tone: 'border-amber-200 bg-amber-50 text-amber-800',
    },
    {
      key: 'failed',
      label: 'Failed',
      count: queueSummary.totals.failed,
      breakdown: queueSummary.counts.failed,
      icon: AlertTriangle,
      tone: 'border-red-200 bg-red-50 text-red-800',
    },
  ], [queueSummary]);

  const longRunningSummary = useMemo(() => {
    return {
      total: refreshItems.length,
    };
  }, [refreshItems]);

  return (
    <div className="h-12 border-b border-gray-200 bg-white flex items-center justify-between px-4 gap-2">
      {/* Left: Queue Status Cards */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mr-0.5">This week</span>
        {queueCards.map((card) => {
          const Icon = card.icon;
          const hasItems = card.count > 0;
          const isActive = activeRightPanel === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => {
                if (isActive) {
                  setActiveRightPanel(null);
                } else {
                  setActiveRightPanel(card.key);
                }
              }}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition hover:brightness-95 ${
                isActive ? 'ring-2 ring-primary-300 ' : ''
              }${hasItems ? card.tone : 'border-gray-200 bg-gray-50 text-gray-500'}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="font-medium">{card.count}</span>
              <span className="hidden sm:inline">{card.label}</span>
              <span className="hidden lg:flex items-center gap-1.5 text-[10px] opacity-80">
                {(card.breakdown?.workflow || 0) > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <GitBranch className="h-3 w-3" />
                    {card.breakdown.workflow}
                  </span>
                )}
                {(card.breakdown?.agent || 0) > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <Bot className="h-3 w-3" />
                    {card.breakdown.agent}
                  </span>
                )}
                {(card.breakdown?.report || 0) > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <FileBarChart className="h-3 w-3" />
                    {card.breakdown.report}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right: Setup Progress, Help, Back */}
      <div className="flex items-center gap-2">
        <TooltipProvider>
          {longRunningSummary.total > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveRightPanel(activeRightPanel === 'refreshes' ? null : 'refreshes')}
              className={`border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 gap-1.5 text-xs ${
                activeRightPanel === 'refreshes' ? 'ring-2 ring-primary-300' : ''
              }`}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="font-medium">{longRunningSummary.total}</span>
              <span className="hidden xl:inline">
                {longRunningSummary.total === 1
                  ? 'In progress operation'
                  : 'In progress operations'}
              </span>
            </Button>
          )}

          {/* Setup Progress Indicator - only show when onboarding is incomplete */}
          {!isLocalMode && shouldShowOnboardingProgress && onboardingProgress && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openOnboardingModal}
                  className="text-primary-600 border-primary-200 bg-primary-50 hover:bg-primary-100 gap-1.5 text-xs"
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span className="font-medium">
                    Setup {onboardingProgress.completed}/{onboardingProgress.total}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open Setup Guide</TooltipContent>
            </Tooltip>
          )}

          {isLocalMode && openAISettings?.hasApiKey === false && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/dashboard/preferences')}
                  className="gap-1.5 border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <KeyRound className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">OpenAI key missing</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Add an OpenAI API key in Preferences to enable local AI features.
              </TooltipContent>
            </Tooltip>
          )}

          {isLocalMode && hasRuntimeCapability('mcp') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleToggleLocalMcp}
                  disabled={isMcpTogglePending}
                  className={`gap-1.5 text-xs ${
                    localRuntimeInfo.mcpEnabled
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      localRuntimeInfo.mcpEnabled ? 'bg-emerald-500' : 'bg-gray-400'
                    }`}
                  />
                  <Server className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">
                    MCP {localRuntimeInfo.mcpEnabled ? 'On' : 'Off'}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {localRuntimeInfo.mcpEnabled
                  ? 'Local MCP server is on. Click to turn it off.'
                  : 'Local MCP server is off. Click to turn it on.'}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Help Dropdown Menu */}
          <DropdownMenu open={isHelpMenuOpen} onOpenChange={setIsHelpMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="text-gray-500 gap-1">
                <HelpCircle className="h-4 w-4" />
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-72"
              onCloseAutoFocus={(event) => {
                if (skipHelpMenuFocusRestoreRef.current) {
                  event.preventDefault();
                  skipHelpMenuFocusRestoreRef.current = false;
                }
              }}
            >
              <DropdownMenuItem asChild>
                <a
                  href="https://docs.cloudagent.io/guide"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <BookOpen className="h-4 w-4" />
                  Documentation
                  <ExternalLink className="h-3 w-3 ml-auto text-gray-400" />
                </a>
              </DropdownMenuItem>
              {!isLocalMode && (
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    openOnboardingFromHelpMenu();
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Compass className="h-4 w-4" />
                  Setup Guide
                </DropdownMenuItem>
              )}
              {isLocalMode && localRuntimeInfo.localDataDir ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      handleOpenLocalDataDir();
                    }}
                    className="items-start gap-2 cursor-pointer"
                  >
                    <FolderOpen className="mt-0.5 h-4 w-4" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">Open local folder</span>
                      <span
                        className="block truncate text-xs text-gray-500"
                        title={localRuntimeInfo.localDataDir}
                      >
                        {localRuntimeInfo.localDataDir}
                      </span>
                      {localRuntimeInfo.localDataDirPendingRestart ? (
                        <span className="block text-xs font-medium text-amber-700">
                          Restart required to use saved directory.
                        </span>
                      ) : null}
                    </span>
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          {!isLocalMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-500"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sign Out</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
    </div>
  );
}

function QueuePanelOverlay({ activeQueuePanel, queueSummary, onClose }) {
  const navigate = useNavigate();

  const items = useMemo(() => {
    if (!activeQueuePanel) return [];
    const { workflows = [], agents = [], reports = [] } = queueSummary;
    const allItems = [
      ...workflows.filter(i => i.queueStatus === activeQueuePanel).map(i => ({
        ...i,
        category: 'workflow',
        categoryLabel: 'Workflow',
        icon: GitBranch,
        path: i.id ? `/dashboard/workflow-history/${i.id}` : '/dashboard/workflow-history',
      })),
      ...agents.filter(i => i.queueStatus === activeQueuePanel).map(i => ({
        ...i,
        category: 'agent',
        categoryLabel: 'Agent',
        icon: Bot,
        path: i.id ? `/dashboard/agent/${i.id}` : '/dashboard/agents',
      })),
      ...reports.filter(i => i.queueStatus === activeQueuePanel).map(i => ({
        ...i,
        category: 'report',
        categoryLabel: 'Report',
        icon: FileBarChart,
        path: '/dashboard',
      })),
    ];
    allItems.sort((a, b) => {
      const dateA = Date.parse(a.updatedAt || '') || 0;
      const dateB = Date.parse(b.updatedAt || '') || 0;
      return dateB - dateA;
    });
    return allItems;
  }, [activeQueuePanel, queueSummary]);

  if (!activeQueuePanel) return null;

  return (
    <div className="absolute top-0 right-0 z-30 h-full w-80 border-l border-gray-200 bg-white shadow-xl flex flex-col">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {activeQueuePanel === 'running' && <Gauge className="h-4 w-4 text-blue-500" />}
          {activeQueuePanel === 'waiting' && <Clock className="h-4 w-4 text-amber-500" />}
          {activeQueuePanel === 'failed' && <AlertTriangle className="h-4 w-4 text-red-500" />}
          {activeQueuePanel === 'completed' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          <span className="text-sm font-medium text-gray-700 capitalize">{activeQueuePanel}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
            {items.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
          title="Close panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {items.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-gray-400">No {activeQueuePanel} items</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((item) => {
              const ItemIcon = item.icon;
              const dateRaw = item.updatedAt;
              const dateLabel = dateRaw
                ? new Date(dateRaw).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                : null;
              return (
                <button
                  key={`${item.category}-${item.id}`}
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(item.path);
                  }}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition group"
                >
                  <div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 ${
                    activeQueuePanel === 'running' ? 'bg-blue-50' :
                    activeQueuePanel === 'waiting' ? 'bg-amber-50' :
                    activeQueuePanel === 'completed' ? 'bg-emerald-50' :
                    'bg-red-50'
                  }`}>
                    <ItemIcon className={`h-3.5 w-3.5 ${
                      activeQueuePanel === 'running' ? 'text-blue-500' :
                      activeQueuePanel === 'waiting' ? 'text-amber-500' :
                      activeQueuePanel === 'completed' ? 'text-emerald-500' :
                      'text-red-500'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-800 truncate group-hover:text-primary-700 transition-colors">
                      {item.title || item.id || 'Untitled'}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-medium uppercase tracking-wide ${
                        activeQueuePanel === 'running' ? 'text-blue-500' :
                        activeQueuePanel === 'waiting' ? 'text-amber-500' :
                        activeQueuePanel === 'completed' ? 'text-emerald-500' :
                        'text-red-500'
                      }`}>
                        {item.categoryLabel}
                      </span>
                      {item.rawStatus && (
                        <span className="text-[10px] text-gray-400 truncate">{item.rawStatus}</span>
                      )}
                    </div>
                    {dateLabel && (
                      <div className="text-[10px] text-gray-400 mt-0.5">{dateLabel}</div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 mt-0.5 flex-shrink-0 transition-colors" />
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function RefreshPanelOverlay({ isOpen, items, onClose }) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="absolute top-0 right-0 z-30 h-full w-96 border-l border-gray-200 bg-white shadow-xl flex flex-col">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
          <span className="text-sm font-medium text-gray-700">In Progress Operations</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
            {items.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
          title="Close panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {items.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-gray-400">No operations in progress</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((item) => {
              const ItemIcon = item.icon || Loader2;
              const startedLabel = formatPanelTimestamp(item.startedAt);
              const isDisabled = Boolean(item.disabled);

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) {
                      return;
                    }
                    onClose();
                    if (item.navigationState) {
                      navigate(item.path, { state: item.navigationState });
                      return;
                    }
                    navigate(item.path);
                  }}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition group ${
                    isDisabled
                      ? 'cursor-default opacity-75'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 flex-shrink-0">
                    <ItemIcon className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-800 truncate group-hover:text-primary-700 transition-colors">
                      {item.title}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-blue-500">
                        {item.categoryLabel}
                      </span>
                      {item.detail && (
                        <span className="text-[10px] text-gray-400 truncate">{item.detail}</span>
                      )}
                    </div>
                    {startedLabel && (
                      <div className="text-[10px] text-gray-400 mt-0.5">Started {startedLabel}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                    <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                    {!isDisabled && (
                      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

const ONBOARDING_DISMISSED_KEY = 'cloudagent-onboarding-dismissed';
const SHOULD_SHOW_ONBOARDING_SURVEY = DEFAULT_CUSTOMER_KEY === 'cloudagent';

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isLocalMode = isLocalRuntime();
  const supportsHealthRefresh = hasRuntimeCapability('health');
  const supportsCostRefresh = hasRuntimeCapability('cost');
  const supportsThreatRefresh = hasRuntimeCapability('threat');

  const isFullScreenPage = location.pathname.startsWith('/dashboard/agent/') ||
    location.pathname.startsWith('/dashboard/skill/edit/');
  const [activeRightPanel, setActiveRightPanel] = useState(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [hasManuallyDismissed, setHasManuallyDismissed] = useState(() => {
    return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === 'true';
  });

  // Onboarding survey (role/intent capture for analytics tags).
  // Initialized synchronously from localStorage so it blocks Getting Started on first render.
  const [showSurvey, setShowSurvey] = useState(() => (
    !isLocalMode && SHOULD_SHOW_ONBOARDING_SURVEY && shouldShowSurvey()
  ));
  const hasAutoOpenedOnboardingRef = useRef(false);
  const bootstrappedEnvironmentHealthIdsRef = useRef(new Set());
  const bootstrappedEnvironmentCostIdsRef = useRef(new Set());
  const bootstrappedEnvironmentThreatIdsRef = useRef(new Set());
  const bootstrappedWorkloadHealthSyncIdsRef = useRef(new Set());
  const scannerUpdatesWsRef = useRef(null);
  const scannerUpdatesReconnectTimerRef = useRef(null);
  const scannerProfileRefreshTimerRef = useRef(null);
  const shouldMaintainScannerWsRef = useRef(true);
  const reconcileLoadingScannerResultsRef = useRef(() => {});
  const [scannerUpdatesConnectionId, setScannerUpdatesConnectionId] = useState('');
  const shouldRunLoginScannerBootstrap =
    supportsHealthRefresh || supportsCostRefresh || supportsThreatRefresh;
  const shouldUseScannerRuntime = !isLocalMode && shouldRunLoginScannerBootstrap;
  const isLoginScannerBootstrapReady = isLocalMode || Boolean(scannerUpdatesConnectionId);

  const { userProfile, userProfileLoading } = useSelector((state) => state.auth);
  const activeWorkspaceScope = useSelector(selectActiveWorkspaceScope);
  const scopedEnvironmentProfiles = useSelector(selectWorkspaceScopedEnvironmentProfiles);
  const loginRefreshPeriods = useMemo(
    () => getDashboardRefreshPeriodsHours(userProfile?.settings),
    [userProfile?.settings]
  );
  const loginAutoRefreshOnLogin = useMemo(
    () => getDashboardAutoRefreshOnLogin(userProfile?.settings),
    [userProfile?.settings]
  );
  const {
    workflows: overviewWorkflows,
    agentHistory: overviewAgentHistory,
    stats: overviewStats,
    loading: overviewLoading,
    lastFetched: overviewLastFetched,
    error: overviewError,
  } = useSelector((state) => state.overview);
  const { userWorkflows } = useSelector((state) => state.workflow);
  const workloadStateItems = useSelector((state) => state.workload?.workloads || []);
  const { agentHistory: agentHistoryFromTab } = useSelector((state) => state.agent);
  const environmentHealthRequestsById = useSelector((state) => state.health?.environmentRequestsById || {});
  const workloadHealthRequestsById = useSelector((state) => state.health?.workloadRequestsById || {});
  const environmentCostRequestsById = useSelector((state) => state.cost?.environmentRequestsById || {});
  const environmentThreatRequestsById = useSelector((state) => state.threat?.environmentRequestsById || {});
  const executiveSummaryRequestsByKey = useSelector(
    (state) => state.operations?.executiveSummaryRequestsByKey || {}
  );
  const suggestionRequestsByKey = useSelector(
    (state) => state.operations?.suggestionRequestsByKey || {}
  );
  const reportOperationsByScanId = useSelector(
    (state) => state.operations?.reportOperationsByScanId || {}
  );
  const recommendationRefreshState = useSelector(
    (state) => state.operations?.recommendationRefresh || {}
  );
  const permissionProfileLookup = useMemo(
    () => buildPermissionProfileLookup(userProfile?.agentPermissionProfiles || []),
    [userProfile?.agentPermissionProfiles]
  );
  const workloadById = useMemo(() => {
    const map = new Map();
    (userProfile?.workloads || []).forEach((workload) => {
      const workloadId = String(workload?.workloadId || '').trim();
      if (!workloadId) return;
      if (!matchesWorkload(workload, activeWorkspaceScope)) return;
      map.set(workloadId, workload);
    });
    (workloadStateItems || []).forEach((workload) => {
      const workloadId = String(workload?.workloadId || '').trim();
      if (!workloadId) return;
      if (!matchesWorkload(workload, activeWorkspaceScope)) return;
      map.set(workloadId, {
        ...map.get(workloadId),
        ...workload,
      });
    });
    return map;
  }, [activeWorkspaceScope, userProfile?.workloads, workloadStateItems]);

  // Onboarding progress tracking
  const hasPermissions = !!(overviewStats?.totalPermissionProfiles);
  const hasRunReport = !!(overviewStats?.totalReports);
  const hasRunAgent = !!(overviewStats?.totalAgents);
  const hasRunWorkflow = !!(overviewStats?.totalWorkflows);
  const hasMCPExtension = !!userProfile?.mcpToken;
  const hasDiscoveredWorkloads = useMemo(() => {
    const workloads = userProfile?.workloads || [];
    return workloads.filter(
      (workload) => !workload?.workloadName?.includes('PermissionProfile-')
    ).length > 0;
  }, [userProfile]);

  const onboardingProgress = useMemo(() => {
    const completed = [
      hasPermissions,
      hasDiscoveredWorkloads,
      hasRunReport,
      hasRunAgent,
      hasRunWorkflow,
    ].filter(Boolean).length;
    return { completed, total: 5 };
  }, [hasPermissions, hasDiscoveredWorkloads, hasRunReport, hasRunAgent, hasRunWorkflow]);

  const hasCompletedOnboarding = hasPermissions && (hasRunReport || hasRunAgent || hasRunWorkflow || hasMCPExtension);
  const shouldForceDefaultOnboarding = onboardingProgress.completed <= 1;
  const shouldShowOnboardingProgress = !isLocalMode && onboardingProgress.completed < Math.min(onboardingProgress.total, 4);
  const isOnboardingDataReady = !userProfileLoading && (Boolean(overviewLastFetched) || Boolean(overviewError) || overviewLoading);

  // Auto-show onboarding modal once per dashboard load.
  // Users at 0/5 or 1/5 should still see the guide by default even if they dismissed it before.
  // Suppressed while the onboarding survey is active so both don't appear at once.
  useEffect(() => {
    if (isLocalMode) return;
    if (!isOnboardingDataReady || overviewLoading) return;
    if (hasCompletedOnboarding || isOnboardingOpen || showSurvey) return;
    if (hasAutoOpenedOnboardingRef.current) return;
    if (!shouldForceDefaultOnboarding && hasManuallyDismissed) return;

    hasAutoOpenedOnboardingRef.current = true;
    setIsOnboardingOpen(true);
  }, [
    hasCompletedOnboarding,
    hasManuallyDismissed,
    isLocalMode,
    isOnboardingDataReady,
    isOnboardingOpen,
    overviewLoading,
    shouldForceDefaultOnboarding,
    showSurvey,
  ]);

  const handleSurveyComplete = useCallback(() => {
    setShowSurvey(false);
    // Defer Getting Started modal to the next login
    setHasManuallyDismissed(true);
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, 'true');
    if (userProfile) {
      analytics.identify(userProfile);
    }
  }, [userProfile]);

  const handleOnboardingOpenChange = useCallback((open) => {
    setIsOnboardingOpen(open);
    if (!open && !hasCompletedOnboarding) {
      setHasManuallyDismissed(true);
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, 'true');
    }
  }, [hasCompletedOnboarding]);

  const handleOpenOnboarding = useCallback(() => {
    setIsOnboardingOpen(true);
  }, []);

  const handleOnboardingRefresh = useCallback(() => {
    dispatch(refreshUserProfile());
    dispatch(getOverviewData());
  }, [dispatch]);

  const reconcileLoadingScannerResults = useCallback(() => {
    Object.entries(environmentHealthRequestsById || {}).forEach(([permissionProfileId, request]) => {
      if (request?.status !== 'loading') return;
      const profile = scopedEnvironmentProfiles.find(
        (item) => String(item?.recordId || item?.id || item?.permissionProfileId || '').trim() === permissionProfileId
      );
      dispatch(
        refreshEnvironmentHealth({
          permissionProfileId,
          forceRefresh: false,
          allowWhileLoading: true,
        })
      );
    });

    Object.entries(workloadHealthRequestsById || {}).forEach(([workloadId, request]) => {
      if (request?.status !== 'loading') return;
      dispatch(
        refreshWorkloadHealth({
          workloadId,
          forceRefresh: false,
          allowWhileLoading: true,
        })
      );
    });

    // Cost and threat scan completion is handled by websocket-ready messages and
    // user-profile refresh. Avoid pulling full artifacts into the main dashboard.
  }, [
    dispatch,
    environmentHealthRequestsById,
    scopedEnvironmentProfiles,
    workloadHealthRequestsById,
  ]);

  useEffect(() => {
    reconcileLoadingScannerResultsRef.current = reconcileLoadingScannerResults;
  }, [reconcileLoadingScannerResults]);

  useEffect(() => {
    if (!shouldUseScannerRuntime || !SCAN_UPDATES_WEBSOCKET_ENDPOINT) {
      setScannerUpdatesConnectionId('');
      dispatch(setScannerUpdatesConnectionIdAction(''));
      return undefined;
    }

    shouldMaintainScannerWsRef.current = true;

    const scheduleScannerProfileRefresh = () => {
      if (scannerProfileRefreshTimerRef.current) return;
      scannerProfileRefreshTimerRef.current = window.setTimeout(() => {
        scannerProfileRefreshTimerRef.current = null;
        dispatch(refreshUserProfile());
      }, 1500);
    };

    const scheduleReconnect = () => {
      if (!shouldMaintainScannerWsRef.current) return;
      if (scannerUpdatesReconnectTimerRef.current) return;
      scannerUpdatesReconnectTimerRef.current = window.setTimeout(() => {
        scannerUpdatesReconnectTimerRef.current = null;
        openScannerWebSocket();
      }, 2000);
    };

    const openScannerWebSocket = () => {
      if (!shouldMaintainScannerWsRef.current) return;
      if (scannerUpdatesWsRef.current) {
        const state = scannerUpdatesWsRef.current.readyState;
        if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
          return;
        }
      }

      console.info('[DashboardLayout] Opening scanner websocket', {
        endpoint: SCAN_UPDATES_WEBSOCKET_ENDPOINT,
      });
      const ws = new WebSocket(SCAN_UPDATES_WEBSOCKET_ENDPOINT);
      scannerUpdatesWsRef.current = ws;

      ws.onopen = () => {
        console.info('[DashboardLayout] Scanner websocket opened', {
          endpoint: SCAN_UPDATES_WEBSOCKET_ENDPOINT,
          readyState: ws.readyState,
        });
        ws.send(JSON.stringify({ action: 'connectionAck' }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data?.connectionId) {
            const connectionId = String(data.connectionId).trim();
            console.info('[DashboardLayout] Scanner websocket connection acknowledged', {
              connectionId,
            });
            setScannerUpdatesConnectionId(connectionId);
            dispatch(setScannerUpdatesConnectionIdAction(connectionId));
            return;
          }

          if (data?.service && data?.status) {
            console.info('[DashboardLayout] Scanner service status received', data);
            window.dispatchEvent(new CustomEvent('scan-service-status', { detail: data }));
            return;
          }

          if (!['aws-scanner', 'azure-scanner'].includes(data?.source)) {
            return;
          }

          console.info('[DashboardLayout] Scanner websocket message received', data);

          const reportType = String(data.reportType || '').trim().toLowerCase();
          const targetType = String(data.targetType || '').trim().toLowerCase();
          const targetId = String(data.targetId || '').trim();
          if (!reportType || !targetId) return;

          if (data?.status === 'failed') {
            const error = data?.error || 'Scanner task failed';
            if (reportType === 'cost' && targetType === 'permissionprofile') {
              dispatch(markEnvironmentCostScanFailed({ permissionProfileId: targetId, error }));
              return;
            }
            if (reportType === 'threat' && targetType === 'permissionprofile') {
              dispatch(markEnvironmentThreatScanFailed({ permissionProfileId: targetId, error }));
              return;
            }
            if (reportType === 'health') {
              if (targetType === 'workload') {
                dispatch(markWorkloadHealthScanFailed({ workloadId: targetId, error }));
                return;
              }
              if (targetType === 'permissionprofile') {
                dispatch(markEnvironmentHealthScanFailed({ permissionProfileId: targetId, error }));
              }
            }
            return;
          }

          if (data?.status !== 'ready') {
            return;
          }

          if (reportType === 'cost' && targetType === 'permissionprofile') {
            dispatch(markEnvironmentCostScanReady({
              permissionProfileId: targetId,
              generatedAt: data?.generatedAt || null,
            }));
            scheduleScannerProfileRefresh();
            return;
          }

          if (reportType === 'threat' && targetType === 'permissionprofile') {
            dispatch(markEnvironmentThreatScanReady({
              permissionProfileId: targetId,
              generatedAt: data?.generatedAt || null,
            }));
            scheduleScannerProfileRefresh();
            return;
          }

          if (reportType === 'health') {
            if (targetType === 'workload') {
              dispatch(markWorkloadHealthScanReady({
                workloadId: targetId,
                generatedAt: data?.generatedAt || null,
              }));
              dispatch(refreshWorkloadHealth({
                workloadId: targetId,
                forceRefresh: false,
                allowWhileLoading: true,
                bypassLocalCache: true,
              }));
              scheduleScannerProfileRefresh();
              return;
            }
            if (targetType === 'permissionprofile') {
              dispatch(markEnvironmentHealthScanReady({
                permissionProfileId: targetId,
                generatedAt: data?.generatedAt || null,
              }));
              dispatch(refreshEnvironmentHealth({
                permissionProfileId: targetId,
                forceRefresh: false,
                allowWhileLoading: true,
                bypassLocalCache: true,
              }));
              scheduleScannerProfileRefresh();
            }
          }
        } catch (error) {
          console.error('[DashboardLayout] Failed to parse scanner websocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[DashboardLayout] Scanner websocket error:', {
          error,
          endpoint: SCAN_UPDATES_WEBSOCKET_ENDPOINT,
          readyState: ws.readyState,
        });
      };

      ws.onclose = (event) => {
        console.warn('[DashboardLayout] Scanner websocket closed', {
          code: event?.code ?? null,
          reason: event?.reason || '',
          wasClean: event?.wasClean === true,
        });
        if (scannerUpdatesWsRef.current === ws) {
          scannerUpdatesWsRef.current = null;
        }
        setScannerUpdatesConnectionId('');
        dispatch(setScannerUpdatesConnectionIdAction(''));
        reconcileLoadingScannerResultsRef.current();
        scheduleReconnect();
      };
    };

    openScannerWebSocket();

    return () => {
      shouldMaintainScannerWsRef.current = false;
      console.info('[DashboardLayout] Cleaning up scanner websocket');
      if (scannerUpdatesReconnectTimerRef.current) {
        window.clearTimeout(scannerUpdatesReconnectTimerRef.current);
        scannerUpdatesReconnectTimerRef.current = null;
      }
      if (scannerProfileRefreshTimerRef.current) {
        window.clearTimeout(scannerProfileRefreshTimerRef.current);
        scannerProfileRefreshTimerRef.current = null;
      }
      if (scannerUpdatesWsRef.current) {
        scannerUpdatesWsRef.current.close();
        scannerUpdatesWsRef.current = null;
      }
      dispatch(setScannerUpdatesConnectionIdAction(''));
    };
  }, [dispatch, shouldUseScannerRuntime]);

  useEffect(() => {
    if (!shouldUseScannerRuntime) return undefined;

    const hasLoadingRequests =
      Object.values(environmentHealthRequestsById || {}).some((request) => request?.status === 'loading') ||
      Object.values(workloadHealthRequestsById || {}).some((request) => request?.status === 'loading') ||
      Object.values(environmentCostRequestsById || {}).some((request) => request?.status === 'loading') ||
      Object.values(environmentThreatRequestsById || {}).some((request) => request?.status === 'loading');

    if (!hasLoadingRequests) return undefined;

    const intervalId = window.setInterval(() => {
      reconcileLoadingScannerResultsRef.current();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    environmentCostRequestsById,
    environmentHealthRequestsById,
    environmentThreatRequestsById,
    reconcileLoadingScannerResults,
    shouldUseScannerRuntime,
    workloadHealthRequestsById,
  ]);

  useEffect(() => {
    if (!shouldRunLoginScannerBootstrap) return;
    if (!isLoginScannerBootstrapReady) return;

    const permissionProfiles = scopedEnvironmentProfiles || [];
    const workloads = Array.from(workloadById.values()).filter((workload) =>
      matchesWorkload(workload, activeWorkspaceScope)
    );
    const permissionProfilesById = new Map(
      permissionProfiles.map((profile) => [
        String(profile?.recordId || profile?.id || profile?.permissionProfileId || '').trim(),
        profile,
      ])
    );
    const permissionProfilesByAccount = new Map();
    permissionProfiles.forEach((profile) => {
      const permissionProfileId = getPermissionProfileId(profile);
      const accountId = extractEnvironmentAccountId(profile);
      if (permissionProfileId && accountId) {
        permissionProfilesByAccount.set(String(accountId), permissionProfileId);
      }
    });
    const canBootstrapProfile = (profile) =>
      !isLocalMode || (
        isAwsCredentialBackedProfile(profile) &&
        canRunLocalAwsScannersForProfile(profile)
      );
    const canBootstrapWorkload = (workload) => {
      if (!isLocalMode) return true;
      if (inferWorkloadCloudProvider(workload, permissionProfilesById) !== 'aws') return false;
      const profileIds = getWorkloadEnvironmentProfileIds(workload);
      if (!profileIds.length) return true;
      return profileIds.every((profileId) =>
        canBootstrapProfile(permissionProfilesById.get(profileId))
      );
    };

    const environmentHealthTargets = supportsHealthRefresh && loginAutoRefreshOnLogin.health
      ? buildEnvironmentHealthBootstrapTargets(permissionProfiles)
          .filter((target) => {
            const profile = permissionProfilesById.get(target.permissionProfileId);
            if (
              !profile ||
              !canBootstrapProfile(profile) ||
              hasFreshProfileAnalysis(profile, 'health', loginRefreshPeriods.health)
            ) {
              return false;
            }
            return !bootstrappedEnvironmentHealthIdsRef.current.has(target.permissionProfileId);
          })
      : [];

    const environmentCostTargets = supportsCostRefresh && loginAutoRefreshOnLogin.cost
      ? buildEnvironmentCostBootstrapTargets(permissionProfiles).filter((target) => {
          const profile = permissionProfilesById.get(target.permissionProfileId);
          if (
            !profile ||
            !canBootstrapProfile(profile) ||
            hasFreshProfileAnalysis(profile, 'cost', loginRefreshPeriods.cost)
          ) {
            return false;
          }
          return !bootstrappedEnvironmentCostIdsRef.current.has(target.permissionProfileId);
        })
      : [];

    const environmentThreatIds = supportsThreatRefresh && loginAutoRefreshOnLogin.threat
      ? buildAwsAccountBootstrapSourceIds(permissionProfiles).filter((permissionProfileId) => {
          const profile = permissionProfilesById.get(permissionProfileId);
          if (
            !profile ||
            !canBootstrapProfile(profile) ||
            hasFreshProfileAnalysis(profile, 'threat', loginRefreshPeriods.threat)
          ) {
            return false;
          }
          return !bootstrappedEnvironmentThreatIdsRef.current.has(permissionProfileId);
        })
      : [];

    const workloadHealthSyncTargets = supportsHealthRefresh && loginAutoRefreshOnLogin.health
      ? workloads
          .filter((workload) => shouldBootstrapWorkloadHealth(workload))
          .filter((workload) => canBootstrapWorkload(workload))
          .filter((workload) => !hasFreshWorkloadHealth(workload, loginRefreshPeriods.health))
          .flatMap((workload) => {
            const workloadId = String(workload?.workloadId || '').trim();
            if (!workloadId) return [];
            return getWorkloadPermissionProfileIds(workload, permissionProfilesByAccount)
              .map((permissionProfileId) => ({
                workloadId,
                permissionProfileId,
              }));
          })
          .filter(Boolean)
          .filter(({ workloadId, permissionProfileId }) => {
            const profile = permissionProfilesById.get(permissionProfileId);
            if (!profile || !canBootstrapProfile(profile)) return false;
            const syncKey = `${workloadId}:${permissionProfileId}`;
            if (bootstrappedWorkloadHealthSyncIdsRef.current.has(syncKey)) return false;
            return !environmentHealthTargets.some(
              (target) => target.permissionProfileId === permissionProfileId
            );
          })
      : [];

    const launches = [];

    if (environmentHealthTargets.length) {
      environmentHealthTargets.forEach((target) =>
        bootstrappedEnvironmentHealthIdsRef.current.add(target.permissionProfileId)
      );
      const healthTargetsByProvider = {};
      environmentHealthTargets.forEach(({ permissionProfileId, cloudProvider }) => {
        const provider = cloudProvider || getProfileCloudProvider(permissionProfilesById.get(permissionProfileId));
        healthTargetsByProvider[provider] = healthTargetsByProvider[provider] || [];
        healthTargetsByProvider[provider].push({ permissionProfileId });
      });
      Object.entries(healthTargetsByProvider).forEach(([cloudProvider, targets]) => {
        launches.push(
          dispatch(
            launchHealthScans({
              cloudProvider,
              targets,
              forceRefresh: true,
            })
          ).unwrap()
        );
      });
    }

    workloadHealthSyncTargets.forEach(({ workloadId, permissionProfileId }) => {
      bootstrappedWorkloadHealthSyncIdsRef.current.add(`${workloadId}:${permissionProfileId}`);
      dispatch(
        refreshEnvironmentHealth({
          permissionProfileId,
          forceRefresh: false,
          bypassLocalCache: true,
        })
      );
    });

    if (environmentCostTargets.length) {
      environmentCostTargets.forEach((target) =>
        bootstrappedEnvironmentCostIdsRef.current.add(target.permissionProfileId)
      );
      launches.push(
        dispatch(
          launchEnvironmentCostScans({
            targets: environmentCostTargets,
            forceRefresh: true,
          })
        ).unwrap()
      );
    }

    if (environmentThreatIds.length) {
      environmentThreatIds.forEach((id) => bootstrappedEnvironmentThreatIdsRef.current.add(id));
      launches.push(
        dispatch(
          launchEnvironmentThreatScans({
            targets: environmentThreatIds.map((permissionProfileId) => ({ permissionProfileId })),
            forceRefresh: true,
          })
        ).unwrap()
      );
    }

    if (launches.length > 0) {
      Promise.allSettled(launches).then((results) => {
        results.forEach((result) => {
          if (result.status === 'rejected') {
            console.error('[DashboardLayout] Failed to launch dashboard scanner refresh:', result.reason);
          }
        });
      });
    }
  }, [
    activeWorkspaceScope,
    dispatch,
    loginAutoRefreshOnLogin.cost,
    loginAutoRefreshOnLogin.health,
    loginAutoRefreshOnLogin.threat,
    loginRefreshPeriods.cost,
    loginRefreshPeriods.health,
    loginRefreshPeriods.threat,
    isLoginScannerBootstrapReady,
    isLocalMode,
    scopedEnvironmentProfiles,
    shouldRunLoginScannerBootstrap,
    supportsCostRefresh,
    supportsHealthRefresh,
    supportsThreatRefresh,
    userProfile?.workloads,
    workloadById,
  ]);

  const availableScans = useMemo(
    () =>
      (userProfile?.reportHistory || []).filter((scan) =>
        matchesReportScan(scan, activeWorkspaceScope)
      ),
    [activeWorkspaceScope, userProfile?.reportHistory]
  );

  const workflowRunsForCounters = useMemo(() => {
    const source = Array.isArray(userWorkflows) && userWorkflows.length > 0
      ? userWorkflows
      : (overviewWorkflows || []);
    return source.filter((workflow) =>
      matchesWorkflowRun(workflow, activeWorkspaceScope, { workloadById })
    );
  }, [activeWorkspaceScope, overviewWorkflows, userWorkflows, workloadById]);

  const agentRunsForCounters = useMemo(() => {
    const source = (Array.isArray(agentHistoryFromTab) && agentHistoryFromTab.length > 0)
      ? agentHistoryFromTab
      : (overviewAgentHistory || []);
    return source.filter((agent) => {
      const type = normalizeStatusToken(agent?.agentType);
      return (
        type !== 'report' &&
        type !== 'assessment' &&
        matchesAgentRun(agent, activeWorkspaceScope, {
          permissionProfileLookup,
          workloadById,
        })
      );
    });
  }, [activeWorkspaceScope, agentHistoryFromTab, overviewAgentHistory, permissionProfileLookup, workloadById]);

  const reportRunsForCounters = useMemo(
    () => (availableScans || []).filter((scan) => scan?.reportId),
    [availableScans]
  );

  const environmentById = useMemo(() => {
    const map = new Map();
    (scopedEnvironmentProfiles || []).forEach((profile) => {
      const profileId = String(profile?.recordId || '').trim();
      if (!profileId) return;
      map.set(profileId, profile);
    });
    return map;
  }, [scopedEnvironmentProfiles]);

  const queueSummaryForOverlay = useMemo(() => {
    const lookbackMs = 7 * 24 * 60 * 60 * 1000;
    const cutoffTimestamp = Date.now() - lookbackMs;
    const toTimestamp = (...candidates) => {
      for (const value of candidates) {
        if (!value) continue;
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      return null;
    };

    const workflowItems = [];
    const agentItems = [];
    const reportItems = [];

    (workflowRunsForCounters || []).forEach((workflow) => {
      const ts = toTimestamp(workflow?.updatedAt, workflow?.lastUpdateTime, workflow?.createdAt);
      if (!ts || ts < cutoffTimestamp) return;
      const queueStatus = classifyQueueStatus(workflow?.workflowStatus);
      if (!queueStatus) return;
      workflowItems.push({
        id: workflow.workflowRunId || workflow.workflowId || null,
        title: extractWorkflowTitle(workflow),
        rawStatus: workflow?.workflowStatus || null,
        queueStatus,
        updatedAt: workflow?.updatedAt || workflow?.lastUpdateTime || workflow?.createdAt || null,
      });
    });

    (agentRunsForCounters || []).forEach((agent) => {
      const ts = toTimestamp(agent?.purchaseDate, agent?.updatedAt, agent?.createdAt);
      if (!ts || ts < cutoffTimestamp) return;
      const queueStatus = classifyQueueStatus(agent?.status);
      if (!queueStatus) return;
      agentItems.push({
        id: agent.recordId || agent.itemId || null,
        title: extractAgentTitle(agent),
        rawStatus: agent?.status || null,
        queueStatus,
        updatedAt: agent?.purchaseDate || agent?.updatedAt || agent?.createdAt || null,
      });
    });

    (reportRunsForCounters || []).forEach((scan) => {
      const ts = toTimestamp(scan?.lastUpdateTime, scan?.latestAssessmentDate, scan?.updatedAt, scan?.createdAt);
      if (!ts || ts < cutoffTimestamp) return;
      const queueStatus = classifyReportQueueStatus(scan?.status);
      if (!queueStatus) return;
      reportItems.push({
        id: buildReportEntryKey(scan) || scan.scanId || scan.reportId || null,
        title: scan.title || scan.reportId || scan.scanId || 'Report Run',
        rawStatus: scan?.status || null,
        queueStatus,
        updatedAt: scan?.lastUpdateTime || scan?.latestAssessmentDate || null,
      });
    });

    return { workflows: workflowItems, agents: agentItems, reports: reportItems };
  }, [workflowRunsForCounters, agentRunsForCounters, reportRunsForCounters]);

  const queueRunningItems = useMemo(() => {
    const { workflows = [], agents = [], reports = [] } = queueSummaryForOverlay;
    const items = [
      ...workflows
        .filter((item) => item.queueStatus === 'running')
        .map((item) => ({
          ...item,
          category: 'workflow',
          icon: GitBranch,
          path: item.id ? `/dashboard/workflow-history/${item.id}` : '/dashboard/workflow-history',
        })),
      ...agents
        .filter((item) => item.queueStatus === 'running')
        .map((item) => ({
          ...item,
          category: 'agent',
          icon: Bot,
          path: item.id ? `/dashboard/agent/${item.id}` : '/dashboard/agents',
        })),
      ...reports
        .filter((item) => item.queueStatus === 'running')
        .map((item) => ({
          ...item,
          category: 'report',
          icon: FileBarChart,
          path: '/dashboard',
        })),
    ];

    items.sort((a, b) => {
      const dateA = Date.parse(a.updatedAt || '') || 0;
      const dateB = Date.parse(b.updatedAt || '') || 0;
      return dateB - dateA;
    });

    return items;
  }, [queueSummaryForOverlay]);

  const refreshItems = useMemo(() => buildRefreshItems({
    environmentById,
    workloadById,
    queueRunningItems,
    environmentHealthRequestsById,
    workloadHealthRequestsById,
    environmentCostRequestsById,
    environmentThreatRequestsById,
    executiveSummaryRequestsByKey,
    suggestionRequestsByKey: isLocalMode ? {} : suggestionRequestsByKey,
    reportOperationsByScanId,
    recommendationRefreshState: isLocalMode ? {} : recommendationRefreshState,
  }), [
    environmentById,
    workloadById,
    queueRunningItems,
    environmentHealthRequestsById,
    workloadHealthRequestsById,
    environmentCostRequestsById,
    environmentThreatRequestsById,
    executiveSummaryRequestsByKey,
    isLocalMode,
    suggestionRequestsByKey,
    reportOperationsByScanId,
    recommendationRefreshState,
  ]);

  if (isFullScreenPage) {
    return (
      <div className="h-screen flex flex-col">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardTopBar
          activeRightPanel={activeRightPanel}
          setActiveRightPanel={setActiveRightPanel}
          refreshItems={refreshItems}
          onboardingProgress={onboardingProgress}
          shouldShowOnboardingProgress={shouldShowOnboardingProgress}
          onOpenOnboarding={handleOpenOnboarding}
        />
        <div className="relative flex-1 overflow-auto bg-gray-50">
          <div className="h-full p-6">
            <Outlet />
          </div>
          <QueuePanelOverlay
            activeQueuePanel={['completed', 'waiting', 'failed'].includes(activeRightPanel) ? activeRightPanel : null}
            queueSummary={queueSummaryForOverlay}
            onClose={() => setActiveRightPanel(null)}
          />
          <RefreshPanelOverlay
            isOpen={activeRightPanel === 'refreshes'}
            items={refreshItems}
            onClose={() => setActiveRightPanel(null)}
          />
        </div>
      </div>

      {!isLocalMode && (
        <OnboardingModal
          isOpen={isOnboardingOpen}
          onOpenChange={handleOnboardingOpenChange}
          hasPermissions={hasPermissions}
          hasRunReport={hasRunReport}
          hasRunAgent={hasRunAgent}
          hasRunWorkflow={hasRunWorkflow}
          hasMCPExtension={hasMCPExtension}
          hasDiscoveredWorkloads={hasDiscoveredWorkloads}
          onRefresh={handleOnboardingRefresh}
          userProfile={userProfile}
        />
      )}

      {/* Onboarding Survey */}
      <OnboardingSurveyModal
        isOpen={SHOULD_SHOW_ONBOARDING_SURVEY && showSurvey}
        onComplete={handleSurveyComplete}
        userEmail={userProfile?.email || userProfile?.signInDetails?.loginId || ''}
      />

    </div>
  );
}
