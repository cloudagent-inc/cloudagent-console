import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Compass, Plus, Trash2, ChevronRight, CheckCircle2, AlertTriangle, Minus, Search, Loader2, Play, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import WorkloadCreateWizard from '@/components/WorkloadCreateWizard';
import DiscoverWorkloadsModal from '@/components/DiscoverWorkloadsModal';
import DeleteModal from '@/components/DeleteModal';
import {
  deleteWorkloadDefinition,
  loadWorkloadsFromUserProfile,
} from '@/features/workload/workloadSlice';
import { clearBackgroundDiscovery } from '@/features/workload/workloadDiscoverySlice';
import {
  selectWorkloadHealthRequestsById,
  selectWorkloadHealthResultsById,
} from '@/features/health/healthSlice';
import {
  buildAwsResourceHealthSummary,
  buildTrackedResourceHealthSummary,
  extractHealthResources,
} from '@/features/health/healthUtils';
import { Icons } from '@/components/icons';
import {
  matchesWorkload,
  selectActiveWorkspaceScope,
} from '@/features/workspace/workspaceScope';
import {
  getAwsAccountIdForWorkloadEnvironment,
  normalizeWorkloadEnvironmentIds,
  resolveWorkloadEnvironmentRef,
} from '@/features/workload/workloadEnvironmentUtils';
import { analytics, ANALYTICS_EVENTS, getAnalyticsRoute } from '@/hooks/useAnalytics';
import toast from 'react-hot-toast';
import {
  countUserWorkloads,
  getCloudAgentCreationLimits,
} from '@/lib/subscription';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';

const safeParseJson = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const unwrapScannerRecord = (record) => (
  record?.payload && typeof record.payload === 'object' ? record.payload : record
);

const parseSummaryObject = (summary) => {
  if (!summary) return {};
  if (typeof summary === 'object') return summary;
  if (typeof summary !== 'string') return {};
  try {
    const parsed = JSON.parse(summary);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const getStoredHealthSummary = (workload) => {
  const summary = parseSummaryObject(workload?.summary);
  const analysis =
    summary?.analysis && typeof summary.analysis === 'object' ? summary.analysis : {};
  const health =
    analysis?.health && typeof analysis.health === 'object' ? analysis.health : {};
  return health?.summary && typeof health.summary === 'object' ? health.summary : null;
};

export default function WorkloadsPage() {
  const { userProfile, deletedWorkloadIds = [] } = useSelector((state) => state.auth);
  const { workloads: storeWorkloads, deleteLoading } = useSelector((state) => state.workload);
  const activeDiscoveryRun = useSelector((state) => state.workloadDiscovery.activeRun);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const workloadHealthRequestsById = useSelector(selectWorkloadHealthRequestsById);
  const workloadHealthResultsById = useSelector(selectWorkloadHealthResultsById);
  const activeWorkspaceScope = useSelector(selectActiveWorkspaceScope);
  const isLocalMode = isLocalRuntime();

  const [isWorkloadWizardOpen, setIsWorkloadWizardOpen] = useState(false);
  const [isDiscoverModalOpen, setIsDiscoverModalOpen] = useState(false);
  const [discoverModalPermissionProfileId, setDiscoverModalPermissionProfileId] = useState(null);
  const [deleteWorkloadModalOpen, setDeleteWorkloadModalOpen] = useState(false);
  const [deletingWorkload, setDeletingWorkload] = useState(null);
  const [filterText, setFilterText] = useState('');
  const [hideSystemWorkloads, setHideSystemWorkloads] = useState(true);
  const workloadVideoPrompt = {
    youtubeId: 'vF6Sh9KvbXE',
    title: 'How to import your existing workloads/applications',
    href: 'https://youtu.be/vF6Sh9KvbXE',
    thumbnail: 'https://i.ytimg.com/vi/vF6Sh9KvbXE/hqdefault.jpg',
  };

  const isSystemWorkload = (workload) => {
    const name = workload?.workloadName || '';
    return name.startsWith('PermissionProfile-');
  };

  const trackWorkloadVideoPrompt = useCallback((interactionType) => {
    analytics.track(ANALYTICS_EVENTS.MARKETING_VIDEO_INTERACTED, {
      video_id: workloadVideoPrompt.youtubeId,
      video_title: workloadVideoPrompt.title,
      video_provider: 'youtube',
      video_surface: 'workloads_empty_state',
      interaction_type: interactionType,
      route: getAnalyticsRoute(),
    });
  }, []);

  const dashboardWorkloads = useMemo(() => {
    const byId = new Map();
    const deletedIds = new Set((deletedWorkloadIds || []).map((id) => String(id).trim()).filter(Boolean));

    (storeWorkloads || []).forEach((workload) => {
      if (!workload?.workloadId) return;
      if (deletedIds.has(String(workload.workloadId))) return;
      byId.set(workload.workloadId, workload);
    });

    (userProfile?.workloads || []).forEach((workload) => {
      if (!workload?.workloadId) return;
      if (deletedIds.has(String(workload.workloadId))) return;
      const current = byId.get(workload.workloadId) || {};
      byId.set(workload.workloadId, {
        ...workload,
        ...current,
      });
    });

    return Array.from(byId.values());
  }, [deletedWorkloadIds, storeWorkloads, userProfile?.workloads]);

  const workloadCountForLimits = useMemo(
    () => countUserWorkloads(dashboardWorkloads),
    [dashboardWorkloads]
  );

  const creationLimits = useMemo(
    () =>
      getCloudAgentCreationLimits(userProfile, {
        workloadCountOverride: workloadCountForLimits,
      }),
    [userProfile, workloadCountForLimits]
  );

  const refreshingWorkloadIds = useMemo(() => {
    const next = new Set();
    Object.entries(workloadHealthRequestsById || {}).forEach(([workloadId, request]) => {
      if (request?.status === 'loading') {
        next.add(workloadId);
      }
    });
    return next;
  }, [workloadHealthRequestsById]);

  const displayWorkloads = useMemo(() => {
    let workloads = dashboardWorkloads || [];

    if (hideSystemWorkloads) {
      workloads = workloads.filter((w) => !isSystemWorkload(w));
    }

    workloads = workloads.filter((workload) => matchesWorkload(workload, activeWorkspaceScope));

    if (!filterText.trim()) return workloads;

    const searchLower = filterText.toLowerCase().trim();
    return workloads.filter((w) => {
      const name = (w.workloadName || '').toLowerCase();
      const description = (w.description || '').toLowerCase();
      return name.includes(searchLower) || description.includes(searchLower);
    });
  }, [dashboardWorkloads, filterText, hideSystemWorkloads, activeWorkspaceScope]);

  const systemWorkloadsCount = useMemo(() => {
    const workloads = dashboardWorkloads || [];
    return workloads.filter(isSystemWorkload).length;
  }, [dashboardWorkloads]);

  const permissionProfiles = userProfile?.agentPermissionProfiles || [];

  // Resolve account ID from environment string
  const resolveAccountId = useCallback((envValue) => {
    const accountId = getAwsAccountIdForWorkloadEnvironment(envValue, permissionProfiles);
    return accountId || null;
  }, [permissionProfiles]);

  // Get environment display info for a workload
  const getWorkloadEnvironments = useCallback((workload) => {
    const environments = normalizeWorkloadEnvironmentIds(workload?.environments || [], permissionProfiles);
    return environments
      .map((environmentId) => resolveWorkloadEnvironmentRef(environmentId, permissionProfiles))
      .filter(Boolean)
      .map((environmentRef) => ({
        accountId: environmentRef.accountId || '',
        permissionProfileId: environmentRef.permissionProfileId,
        name: environmentRef.name,
        provider: environmentRef.type || 'aws',
      }));
  }, [permissionProfiles]);

  // Get workload recommendations count
  const getWorkloadRecommendationsCount = useCallback((workload) => {
    if (!workload?.workloadId) return 0;
    const recommendations = userProfile?.recommendations?.recommendations || [];
    if (!Array.isArray(recommendations)) return 0;
    
    return recommendations.filter((rec) => {
      let targetResources = rec?.targetResources;
      if (typeof targetResources === 'string') {
        try { targetResources = JSON.parse(targetResources); } catch { return false; }
      }
      if (!Array.isArray(targetResources)) return false;
      return targetResources.some((r) => r?.workloadId === workload.workloadId);
    }).length;
  }, [userProfile?.recommendations?.recommendations]);

  // Get environment recommendations count for workload's environments
  const getEnvironmentRecommendationsCount = useCallback((workload) => {
    const environments = getWorkloadEnvironments(workload);
    const accountIds = environments.map((e) => e.accountId);
    if (accountIds.length === 0) return 0;
    
    const recommendations = userProfile?.recommendations?.recommendations || [];
    if (!Array.isArray(recommendations)) return 0;
    
    const uniqueRecIds = new Set();
    recommendations.forEach((rec) => {
      let targetResources = rec?.targetResources;
      if (typeof targetResources === 'string') {
        try { targetResources = JSON.parse(targetResources); } catch { return; }
      }
      if (!Array.isArray(targetResources)) return;
      
      const hasMatchingEnv = targetResources.some((r) => {
        const hasMatchingAccountId = r?.accountId && accountIds.includes(String(r.accountId));
        const hasNoWorkloadId = !r?.workloadId || r.workloadId !== workload.workloadId;
        return hasMatchingAccountId && hasNoWorkloadId;
      });
      
      if (hasMatchingEnv) {
        uniqueRecIds.add(rec.recommendationId);
      }
    });
    
    return uniqueRecIds.size;
  }, [userProfile?.recommendations?.recommendations, getWorkloadEnvironments]);

  // Get workload health stats
  const getWorkloadHealthStats = useCallback((workload) => {
    const liveHealthResult = workloadHealthResultsById?.[workload?.workloadId] || null;
    const liveHealthPayload = unwrapScannerRecord(liveHealthResult);
    const liveResources = extractHealthResources(liveHealthPayload);
    const liveHealthSummary =
      liveHealthPayload?.analysis?.health?.summary &&
      typeof liveHealthPayload.analysis.health.summary === 'object'
        ? liveHealthPayload.analysis.health.summary
        : null;
    const liveResourceCounts =
      liveHealthSummary?.resourceCounts &&
      typeof liveHealthSummary.resourceCounts === 'object'
        ? liveHealthSummary.resourceCounts
        : null;
    if (liveResources.length > 0) {
      const liveSummary = buildAwsResourceHealthSummary({ resources: liveResources });
      const liveCounts = liveSummary.resourceCounts || {};
      return {
        total: Number(liveCounts.total) || liveResources.length,
        evaluated: Number(liveCounts.evaluated) || 0,
        healthy: Number(liveCounts.healthy) || 0,
        issues: Number(liveCounts.issues) || 0,
      };
    }
    if (liveResourceCounts) {
      const total = Number(liveResourceCounts.total);
      const evaluated = Number(liveResourceCounts.evaluated);
      const healthy = Number(liveResourceCounts.healthy);
      const issues = Number(liveResourceCounts.issues);
      return {
        total: Number.isFinite(total) ? total : 0,
        evaluated: Number.isFinite(evaluated) ? evaluated : 0,
        healthy: Number.isFinite(healthy) ? healthy : 0,
        issues: Number.isFinite(issues) ? issues : 0,
      };
    }

    const storedHealthSummary = getStoredHealthSummary(workload);
    const resourceCounts =
      storedHealthSummary?.resourceCounts &&
      typeof storedHealthSummary.resourceCounts === 'object'
        ? storedHealthSummary.resourceCounts
        : null;
    const trackedResources = safeParseJson(workload?.trackedResources, { resources: [] });
    const resources = Array.isArray(trackedResources?.resources) ? trackedResources.resources : [];
    const trackedHealthSummary = buildTrackedResourceHealthSummary(resources);
    const trackedCounts =
      trackedHealthSummary?.resourceCounts &&
      typeof trackedHealthSummary.resourceCounts === 'object'
        ? trackedHealthSummary.resourceCounts
        : null;

    const storedEvaluated = Number(resourceCounts?.evaluated);
    const trackedEvaluated = Number(trackedCounts?.evaluated);

    if (resourceCounts && Number.isFinite(storedEvaluated) && storedEvaluated > 0) {
      const total = Number(resourceCounts.total);
      const healthy = Number(resourceCounts.healthy);
      const issues = Number(resourceCounts.issues);
      return {
        total: Number.isFinite(total) ? total : resources.length,
        evaluated: storedEvaluated,
        healthy: Number.isFinite(healthy) ? healthy : 0,
        issues: Number.isFinite(issues) ? issues : 0,
      };
    }

    if (resources.length > 0 && trackedCounts) {
      const total = Number(trackedCounts.total);
      const healthy = Number(trackedCounts.healthy);
      const issues = Number(trackedCounts.issues);
      return {
        total: Number.isFinite(total) ? total : resources.length,
        evaluated: Number.isFinite(trackedEvaluated) ? trackedEvaluated : 0,
        healthy: Number.isFinite(healthy) ? healthy : 0,
        issues: Number.isFinite(issues) ? issues : 0,
      };
    }

    if (resourceCounts) {
      const total = Number(resourceCounts.total);
      const evaluated = Number(resourceCounts.evaluated);
      const healthy = Number(resourceCounts.healthy);
      const issues = Number(resourceCounts.issues);
      return {
        total: Number.isFinite(total) ? total : resources.length,
        evaluated: Number.isFinite(evaluated) ? evaluated : 0,
        healthy: Number.isFinite(healthy) ? healthy : 0,
        issues: Number.isFinite(issues) ? issues : 0,
      };
    }

    if (trackedCounts) {
      const total = Number(trackedCounts.total);
      const evaluated = Number(trackedCounts.evaluated);
      const healthy = Number(trackedCounts.healthy);
      const issues = Number(trackedCounts.issues);
      return {
        total: Number.isFinite(total) ? total : resources.length,
        evaluated: Number.isFinite(evaluated) ? evaluated : 0,
        healthy: Number.isFinite(healthy) ? healthy : 0,
        issues: Number.isFinite(issues) ? issues : 0,
      };
    }

    return {
      total: resources.length,
      evaluated: 0,
      healthy: 0,
      issues: 0,
    };
  }, [workloadHealthResultsById]);

  useEffect(() => {
    if (
      userProfile?.workloads &&
      userProfile.workloads.length > 0 &&
      storeWorkloads.length === 0
    ) {
      dispatch(loadWorkloadsFromUserProfile(userProfile.workloads));
    }
  }, [userProfile?.workloads, storeWorkloads.length, dispatch]);

  useEffect(() => {
    if (!location.state) return;
    if (!userProfile) return;

    let shouldClearState = false;
    if (location.state.openDiscoverWorkloadsModal) {
      if (creationLimits.canCreateWorkload) {
        setDiscoverModalPermissionProfileId(
          location.state.permissionProfileId || location.state.environmentId || null
        );
        setIsDiscoverModalOpen(true);
      } else {
        toast.error(creationLimits.workloadLimitMessage);
      }
      shouldClearState = true;
    }
    if (location.state.openWorkloadWizard) {
      if (creationLimits.canCreateWorkload) {
        setIsWorkloadWizardOpen(true);
      } else {
        toast.error(creationLimits.workloadLimitMessage);
      }
      shouldClearState = true;
    }

    if (shouldClearState) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [creationLimits, location.pathname, location.state, navigate, userProfile]);

  const openWorkloadWizard = () => {
    if (!creationLimits.canCreateWorkload) {
      toast.error(creationLimits.workloadLimitMessage);
      return;
    }
    setIsWorkloadWizardOpen(true);
  };

  const openDiscoverWorkloads = () => {
    if (!userProfile?.agentPermissionProfiles?.length) {
      toast.error('Add a cloud environment before discovering workloads.');
      return;
    }
    if (!creationLimits.canCreateWorkload) {
      toast.error(creationLimits.workloadLimitMessage);
      return;
    }
    setDiscoverModalPermissionProfileId(null);
    setIsDiscoverModalOpen(true);
  };

  const openWorkload = (workload) => {
    if (workload?.workloadId) {
      navigate(`/dashboard/workloads/${workload.workloadId}`);
    }
  };

  const deleteWorkload = (workload, e) => {
    e?.stopPropagation();
    setDeletingWorkload(workload);
    setDeleteWorkloadModalOpen(true);
  };

  return (
    <>
      <Card className="bg-white">
        <CardHeader className="border-b p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl text-primary-800 font-[500]">
                My Workloads
              </h1>
            </div>
            <div className="flex gap-2 self-start sm:self-auto order-first sm:order-last">
              <Button
                onClick={openWorkloadWizard}
                variant="outline"
                disabled={!creationLimits.canCreateWorkload}
              >
                <Plus className="mr-2 h-4 w-4" /> New Workload
              </Button>
              <Button
                onClick={openDiscoverWorkloads}
                disabled={
                  !userProfile?.agentPermissionProfiles?.length ||
                  !creationLimits.canCreateWorkload
                }
              >
                <Compass className="mr-2 h-4 w-4" />
                Discover Workloads
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!creationLimits.canCreateWorkload && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {creationLimits.workloadLimitMessage}{' '}
              <a href="/pricing" className="font-medium underline">
                View plans
              </a>
            </div>
          )}
          {activeDiscoveryRun && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-blue-900">
                    {activeDiscoveryRun.executionState === 'completed'
                      ? 'Workload discovery ready for review'
                      : activeDiscoveryRun.executionState === 'error'
                      ? 'Workload discovery failed'
                      : 'Workload discovery in progress'}
                  </div>
                  <div className="mt-1 text-sm text-blue-800">
                    {activeDiscoveryRun.executionState === 'completed'
                      ? `${activeDiscoveryRun.workloads?.length || 0} discovered workload(s) are ready to review.`
                      : activeDiscoveryRun.executionState === 'error'
                      ? activeDiscoveryRun.error || 'The last discovery run did not complete successfully.'
                      : `Scanning ${activeDiscoveryRun.environments?.length || 0} environment(s) in the background.`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={activeDiscoveryRun.executionState === 'completed' ? 'default' : 'outline'}
                    onClick={() => {
                      setDiscoverModalPermissionProfileId(null);
                      setIsDiscoverModalOpen(true);
                    }}
                  >
                    {activeDiscoveryRun.executionState === 'completed'
                      ? 'Review discovery'
                      : 'Open progress'}
                  </Button>
                  {(activeDiscoveryRun.executionState === 'completed' ||
                    activeDiscoveryRun.executionState === 'error') && (
                    <Button
                      variant="ghost"
                      onClick={() => dispatch(clearBackgroundDiscovery())}
                    >
                      Dismiss
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
          {(storeWorkloads || []).length > 0 && (
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Filter workloads..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="pl-9"
                />
              </div>
              {systemWorkloadsCount > 0 && (
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <Switch
                    checked={hideSystemWorkloads}
                    onCheckedChange={setHideSystemWorkloads}
                    className="data-[state=checked]:bg-blue-600"
                  />
                  Hide system workloads ({systemWorkloadsCount})
                </label>
              )}
            </div>
          )}
          {displayWorkloads.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {filterText.trim() ? 'No workloads match your filter.' : 'No workloads found.'}
              </p>
              {!filterText.trim() && (
                <>
                  <p className="text-sm text-gray-400 mt-1">
                    Create a new workload or discover existing ones from your AWS environment.
                  </p>
                  <div className="mt-6 mx-auto max-w-md text-left">
                    <a
                      href={workloadVideoPrompt.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:border-primary-300 hover:shadow-md"
                      onMouseEnter={() => trackWorkloadVideoPrompt('hover')}
                      onFocus={() => trackWorkloadVideoPrompt('focus')}
                      onClick={() => trackWorkloadVideoPrompt('click')}
                    >
                      <div className="relative aspect-video overflow-hidden bg-gray-100">
                        <img
                          src={workloadVideoPrompt.thumbnail}
                          alt={workloadVideoPrompt.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="rounded-full bg-white/90 p-3 shadow-lg">
                            <Play className="ml-0.5 h-5 w-5 text-red-600" fill="currentColor" />
                          </div>
                        </div>
                        <span className="absolute top-3 right-3 rounded-full bg-black/70 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white">
                          Watch video
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 p-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 transition-colors group-hover:text-primary-600">
                            {workloadVideoPrompt.title}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            See how to discover and document workloads
                          </p>
                        </div>
                        <ExternalLink className="h-4 w-4 flex-shrink-0 text-gray-400 transition-colors group-hover:text-primary-500" />
                      </div>
                    </a>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[320px]">Workload</TableHead>
                  <TableHead className="w-[180px]">Environments</TableHead>
                  <TableHead className="w-[90px]">Resources</TableHead>
                  <TableHead className="w-[140px]">Health</TableHead>
                  {!isLocalMode && <TableHead className="w-[130px]">Recommendations</TableHead>}
                  <TableHead className="text-right w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayWorkloads.map((workload) => {
                  const healthStats = getWorkloadHealthStats(workload);
                  const workloadRecsCount = isLocalMode ? 0 : getWorkloadRecommendationsCount(workload);
                  const envRecsCount = isLocalMode ? 0 : getEnvironmentRecommendationsCount(workload);
                  const environments = getWorkloadEnvironments(workload);
                  const trackedResources = safeParseJson(workload?.trackedResources, { resources: [] });
                  const resourceCount = Array.isArray(trackedResources?.resources) ? trackedResources.resources.length : 0;
                  const isRefreshingHealth = refreshingWorkloadIds.has(workload.workloadId);
                  
                  return (
                    <TableRow
                      key={workload.workloadId}
                      onClick={() => openWorkload(workload)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-medium">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {workload.workloadName || 'Untitled Workload'}
                          </div>
                          {workload.description && (
                            <div className="text-xs text-gray-500 line-clamp-1 max-w-[300px]">
                              {workload.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {environments.length > 0 ? (
                          <div className="flex items-center gap-2">
                            {environments.length === 1 ? (
                              <>
                                {environments[0].provider === 'aws' && <Icons.aws className="h-5 w-5" />}
                                <span className="text-xs text-gray-600">{environments[0].name}</span>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center gap-1">
                                  {environments.slice(0, 3).map((env) => (
                                    <span key={env.accountId} title={`${env.name} (${env.accountId})`}>
                                      {env.provider === 'aws' && <Icons.aws className="h-5 w-5" />}
                                    </span>
                                  ))}
                                </div>
                                <span className="text-xs text-gray-600">
                                  {environments.length} environments
                                </span>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-gray-900">{resourceCount}</span>
                      </TableCell>
                      <TableCell>
                        {isRefreshingHealth ? (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Updating...
                          </span>
                        ) : healthStats.evaluated > 0 ? (
                          healthStats.issues === 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 w-fit">
                              <CheckCircle2 className="h-3 w-3" />
                              Healthy
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 w-fit">
                              <AlertTriangle className="h-3 w-3" />
                              {healthStats.issues} issue{healthStats.issues !== 1 ? 's' : ''}
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                            <Minus className="h-3 w-3" />
                            Not checked
                          </span>
                        )}
                      </TableCell>
                      {!isLocalMode && (
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {workloadRecsCount > 0 || envRecsCount > 0 ? (
                              <>
                                {workloadRecsCount > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                                      {workloadRecsCount}
                                    </span>
                                    <span className="text-xs text-gray-500">workload</span>
                                  </div>
                                )}
                                {envRecsCount > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center rounded bg-purple-50 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                                      {envRecsCount}
                                    </span>
                                    <span className="text-xs text-gray-500">environment</span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => deleteWorkload(workload, e)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isWorkloadWizardOpen && (
        <WorkloadCreateWizard
          isOpen={isWorkloadWizardOpen}
          onClose={() => {
            setIsWorkloadWizardOpen(false);
          }}
          userProfile={userProfile}
        />
      )}

      {isDiscoverModalOpen && (
        <DiscoverWorkloadsModal
          isOpen={isDiscoverModalOpen}
          onClose={() => {
            setIsDiscoverModalOpen(false);
            setDiscoverModalPermissionProfileId(null);
          }}
          permissionProfileId={discoverModalPermissionProfileId}
          userProfile={userProfile}
        />
      )}

      <DeleteModal
        isOpen={deleteWorkloadModalOpen}
        isLoading={deleteLoading}
        onClose={() => {
          if (deleteLoading) return;
          setDeleteWorkloadModalOpen(false);
          setDeletingWorkload(null);
        }}
        onConfirm={async () => {
          if (deleteLoading) return;
          try {
            if (deletingWorkload) {
              const result = await dispatch(
                deleteWorkloadDefinition({
                  workloadId: deletingWorkload.workloadId,
                })
              ).unwrap();

              if (result && result.success) {
                toast.success('Workload deleted successfully');
              } else {
                toast.error('Failed to delete workload');
              }
            }
          } catch {
            toast.error('Failed to delete workload');
          } finally {
            setDeleteWorkloadModalOpen(false);
            setDeletingWorkload(null);
          }
        }}
        deleteText="Delete Workload"
        deleteDescription={`Are you sure you want to delete "${deletingWorkload?.workloadName}"?`}
        deleteButtonText="Delete Workload"
      />
    </>
  );
}
