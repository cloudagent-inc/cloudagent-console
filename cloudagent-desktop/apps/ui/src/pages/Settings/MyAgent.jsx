import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Search,
  Clock,
  Loader2,
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Bot,
  ExternalLink,
  Workflow,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import StatusIndicator from '../../components/ui/status-indicator';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Markdown from 'markdown-to-jsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  cancelAgentConnection,
  getAgentHistory,
  resetAgentHistory,
} from '../../features/agent/agentSlice';
import { toLogObject, getRunSummaryFromLog } from '../../helpers/logUtils';
import {
  buildPermissionProfileLookup,
  matchesAgentRun,
  selectActiveWorkspaceScope,
} from '@/features/workspace/workspaceScope';

const RESUMABLE_AGENT_STATUSES = new Set([
  'waiting_on_user_input',
  'agent_waiting_on_user_input',
]);

const IN_PROGRESS_AGENT_STATUSES = new Set([
  'running',
  'in_progress',
  'in-progress',
  'task_in_progress',
]);

const CANCELLABLE_AGENT_STATUSES = new Set([
  ...IN_PROGRESS_AGENT_STATUSES,
  ...RESUMABLE_AGENT_STATUSES,
  'pending',
]);

const normalizeAgentStatus = (status) => String(status || '').toLowerCase();

const parseJsonMaybe = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
};

const AGENT_HISTORY_PAGE_SIZE = 20;
const RECENT_HISTORY_DAYS = 30;
const OLDER_HISTORY_WINDOW_DAYS = 90;
const INITIAL_AGENT_RANGE = {
  windowId: 0,
  startDaysAgo: RECENT_HISTORY_DAYS,
  endDaysAgo: 0,
};

const toHistoryRangeDates = ({ startDaysAgo, endDaysAgo }) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - startDaysAgo);

  const endDate = new Date();
  endDate.setDate(endDate.getDate() - endDaysAgo);

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
};

const getNextAgentHistoryRange = (currentRange) => {
  if (!currentRange || currentRange.endDaysAgo === 0) {
    return {
      windowId: 1,
      startDaysAgo: RECENT_HISTORY_DAYS + OLDER_HISTORY_WINDOW_DAYS,
      endDaysAgo: RECENT_HISTORY_DAYS,
    };
  }

  return {
    windowId: currentRange.windowId + 3,
    startDaysAgo: currentRange.startDaysAgo + OLDER_HISTORY_WINDOW_DAYS,
    endDaysAgo: currentRange.endDaysAgo + OLDER_HISTORY_WINDOW_DAYS,
  };
};

export default function MyAgents() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingAgents, setLoadingAgents] = useState({});
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [hasInitialized, setHasInitialized] = useState(false);
  const [currentRange, setCurrentRange] = useState(INITIAL_AGENT_RANGE);
  const [summaryModal, setSummaryModal] = useState({
    isOpen: false,
    title: '',
    summary: '',
  });
  const [agentOverrides, setAgentOverrides] = useState({});
  const userProfile = useSelector((state) => state.auth?.userProfile || {});
  const activeWorkspaceScope = useSelector(selectActiveWorkspaceScope);

  const {
    agentHistory,
    loading,
    error,
    nextToken,
    hasMoreTimeWindows,
    loadedTimeWindows,
  } = useSelector((state) => state.agent || {});

  const historyByRecordId = useMemo(() => {
    const history = Array.isArray(userProfile?.agentHistory)
      ? userProfile.agentHistory
      : [];
    return new Map(
      history
        .filter((entry) => entry?.recordId)
        .map((entry) => [entry.recordId, entry])
    );
  }, [userProfile?.agentHistory]);

  const permissionProfileLookup = useMemo(() => {
    const profiles = Array.isArray(userProfile?.agentPermissionProfiles)
      ? userProfile.agentPermissionProfiles
      : [];
    return buildPermissionProfileLookup(profiles);
  }, [userProfile?.agentPermissionProfiles]);

  const workloadsById = useMemo(() => {
    const map = new Map();
    const workloads = Array.isArray(userProfile?.workloads) ? userProfile.workloads : [];
    workloads.forEach((workload) => {
      const workloadId = String(workload?.workloadId || '').trim();
      if (!workloadId) return;
      map.set(workloadId, workload);
    });
    return map;
  }, [userProfile?.workloads]);

  const loadAgentHistoryRange = useCallback(
    async (
      range,
      { reset = false, drainAllPages = false, initialCursor = null } = {}
    ) => {
      const { startDate, endDate } = toHistoryRangeDates(range);

      if (reset) {
        dispatch(resetAgentHistory());
      }

      let cursor = initialCursor;

      do {
        const payload = await dispatch(
          getAgentHistory({
            count: AGENT_HISTORY_PAGE_SIZE,
            nextToken: cursor,
            sortBy,
            sortOrder,
            agentType: 'agent',
            monthsOffset: range.windowId,
            startDateOverride: startDate,
            endDateOverride: endDate,
          })
        ).unwrap();

        cursor = payload?.nextToken ?? null;
      } while (drainAllPages && cursor);

      setCurrentRange(range);
    },
    [dispatch, sortBy, sortOrder]
  );

  useEffect(() => {
    if (!hasInitialized && !loading) {
      setHasInitialized(true);
      setCurrentRange(INITIAL_AGENT_RANGE);
      void loadAgentHistoryRange(INITIAL_AGENT_RANGE, {
        reset: true,
        drainAllPages: true,
      });
    }
  }, [hasInitialized, loadAgentHistoryRange, loading]);

  const handleSortChange = useCallback(
    (newSortBy) => {
      let newSortOrder = 'desc';
      if (newSortBy === sortBy) {
        newSortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
      }

      setSortBy(newSortBy);
      setSortOrder(newSortOrder);
      setCurrentRange(INITIAL_AGENT_RANGE);
      setHasInitialized(false);
    },
    [sortBy, sortOrder]
  );

  const handleLoadMore = useCallback(async () => {
    if (!hasMoreTimeWindows || loading) return;

    const targetRange = nextToken
      ? currentRange
      : getNextAgentHistoryRange(currentRange);

    await loadAgentHistoryRange(targetRange, {
      reset: false,
      drainAllPages: false,
      initialCursor: nextToken,
    });
  }, [
    currentRange,
    hasMoreTimeWindows,
    loadAgentHistoryRange,
    loading,
    nextToken,
  ]);

  const getSummaryPreview = useCallback((summary) => {
    if (!summary || typeof summary !== 'string') return '';
    return summary
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#>*_~-]+/g, ' ')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const openSummaryModal = useCallback((agentTitle, summary) => {
    if (!summary) return;
    setSummaryModal({
      isOpen: true,
      title: agentTitle || 'Run Summary',
      summary,
    });
  }, []);

  const getEnvironmentName = useCallback(
    (agent) => {
      const historyRecord = historyByRecordId.get(agent?.recordId);
      const resolvedAuthProfile = parseJsonMaybe(
        agent?.authProfile || historyRecord?.authProfile
      );
      const logData = toLogObject(agent?.log || historyRecord?.log);

      const candidates = [
        resolvedAuthProfile?.recordId,
        resolvedAuthProfile?.profileId,
        resolvedAuthProfile?.permissionProfileId,
        resolvedAuthProfile?.authProfileName,
        resolvedAuthProfile?.name,
        resolvedAuthProfile?.awsAccountId,
        logData?.authProfileName,
      ].filter(Boolean);

      for (const key of candidates) {
        const match = permissionProfileLookup.get(String(key).trim().toLowerCase());
        if (match?.name) return match.name;
      }

      return (
        resolvedAuthProfile?.authProfileName ||
        resolvedAuthProfile?.name ||
        logData?.authProfileName ||
        resolvedAuthProfile?.awsAccountId ||
        '—'
      );
    },
    [historyByRecordId, permissionProfileLookup]
  );

  const filteredAgents = useMemo(() => {
    if (!agentHistory || !Array.isArray(agentHistory)) {
      return [];
    }

    const workspaceScopedAgents = agentHistory.filter((agent) =>
      matchesAgentRun(agent, activeWorkspaceScope, {
        historyRecord: historyByRecordId.get(agent?.recordId),
        permissionProfileLookup,
        workloadById: workloadsById,
      })
    );

    if (!searchQuery.trim()) {
      return workspaceScopedAgents;
    }

    const query = searchQuery.toLowerCase();
    return workspaceScopedAgents.filter((agent) => {
      const title = (agent?.title || '').toLowerCase();
      const status = (agent?.status || '').toLowerCase();
      const environmentName = getEnvironmentName(agent).toLowerCase();
      const summary = getRunSummaryFromLog(agent?.log).toLowerCase();
      return (
        title.includes(query) ||
        status.includes(query) ||
        environmentName.includes(query) ||
        summary.includes(query)
      );
    });
  }, [
    activeWorkspaceScope,
    agentHistory,
    getEnvironmentName,
    historyByRecordId,
    permissionProfileLookup,
    searchQuery,
    workloadsById,
  ]);

  const handleConnectAgent = useCallback(
    (agent) => {
      if (!agent) return;

      const parsedLog = toLogObject(agent?.log);
      const isBluePrint = parsedLog?.isBluePrint || false;
      const recordId = parsedLog?.blueprintId || null;
      const normalizedStatus = normalizeAgentStatus(agent.status);
      if (IN_PROGRESS_AGENT_STATUSES.has(normalizedStatus)) return;

      const canResume = RESUMABLE_AGENT_STATUSES.has(normalizedStatus);

      if (canResume && agent.agentType !== 'report') {
        navigate(`/dashboard/agent/${agent.recordId}`, {
          state: {
            isReconnecting: true,
            isBluePrint: isBluePrint,
            ...(isBluePrint && { recordId: recordId }),
          },
        });
      } else if (
        (agent.agentType === 'report' || agent.agentType === 'assessment') &&
        canResume
      ) {
        navigate(`/report/${agent.scanId || agent.recordId}`, {
          state: { isReconnecting: true },
        });
      } else if (
        (agent.agentType === 'report' || agent.agentType === 'assessment') &&
        normalizedStatus === 'complete'
      ) {
        navigate(`/report/${agent.scanId || agent.recordId}`, {});
      } else {
        navigate(`/dashboard/agent/${agent.recordId}`, {
          state: {
            isReconnecting: true,
            isBluePrint: isBluePrint,
            ...(isBluePrint && { recordId: recordId }),
          },
        });
      }
    },
    [navigate]
  );

  const handleOpenAgentChat = useCallback(
    (agent) => {
      const recordId = agent?.recordId || null;
      if (!recordId) return;

      navigate('/dashboard/cloudagent', {
        state: {
          preloadPrompt: `Summarize the status of agent run ${recordId}.`,
          preloadPromptKey: `agent-run:${recordId}`,
        },
      });
    },
    [navigate]
  );

  const handleCancelAgentRun = useCallback(
    async (agent) => {
      const recordId = agent?.recordId;
      if (
        !recordId ||
        !CANCELLABLE_AGENT_STATUSES.has(normalizeAgentStatus(agent.status)) ||
        loadingAgents[recordId]
      ) {
        return;
      }

      setLoadingAgents((prev) => ({ ...prev, [recordId]: true }));

      try {
        const existingLog = toLogObject(agent?.log);
        const existingLogs = Array.isArray(existingLog?.logs) ? existingLog.logs : [];
        const timestamp = new Date().toISOString();
        const cancellationMessage = `This run was cancelled by the user on ${new Date(timestamp).toLocaleString()}.`;
        const existingRunSummary =
          existingLog?.runSummary && typeof existingLog.runSummary === 'object'
            ? existingLog.runSummary
            : {};
        const priorSummary = getRunSummaryFromLog(existingLog);
        const nextSummary = priorSummary
          ? `${priorSummary}\n\n### Cancellation\n${cancellationMessage}`
          : `## Run Summary\n\n### Status\n- ${cancellationMessage}`;
        const nextLog = {
          ...existingLog,
          logs: [
            ...existingLogs,
            {
              taskId: 'run_cancelled',
              status: 'cancelled',
              output: cancellationMessage,
              task_output: cancellationMessage,
              timestamp,
            },
          ],
          runSummary: {
            ...existingRunSummary,
            summary: nextSummary,
            finalSummary: nextSummary,
            generatedAt: timestamp,
            cancelledAt: timestamp,
            status: 'cancelled',
          },
          lastUpdated: timestamp,
          cancelledAt: timestamp,
        };

        const updatedRecord = await dispatch(
          cancelAgentConnection({
            recordId,
            log: JSON.stringify(nextLog),
          })
        ).unwrap();

        setAgentOverrides((current) => ({
          ...current,
          [recordId]: updatedRecord,
        }));
        toast.success('Agent run cancelled.');
      } catch (error) {
        console.error('Failed to cancel agent run:', error);
        toast.error('Failed to cancel agent run.');
      } finally {
        setLoadingAgents((prev) => ({ ...prev, [recordId]: false }));
      }
    },
    [dispatch, loadingAgents]
  );

  const handleRefresh = useCallback(() => {
    setHasInitialized(true);
    setCurrentRange(INITIAL_AGENT_RANGE);
    void loadAgentHistoryRange(INITIAL_AGENT_RANGE, {
      reset: true,
      drainAllPages: true,
    });
  }, [loadAgentHistoryRange]);

  const formatTimestamp = useCallback((timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (error) {
      return 'Invalid Date';
    }
  }, []);

  const getAgentNameDisplay = useCallback(
    (agent) => {
      if (!agent || !agent.itemId) return null;

      const sameNameAgents = filteredAgents.filter(
        (a) => a?.itemId === agent.itemId
      );
      const isAmbiguous = sameNameAgents.length > 1;
      return (
        <div className="flex flex-col min-w-0">
          <span className="font-medium truncate" title={agent.title || agent.itemId}>{agent.title || agent.itemId}</span>
          {isAmbiguous && (
            <div className="flex items-center text-xs text-gray-500 mt-1">
              <Clock className="w-3 h-3 mr-1 shrink-0" />
              <span className="truncate">{formatTimestamp(agent.purchaseDate)}</span>
            </div>
          )}
        </div>
      );
    },
    [filteredAgents, formatTimestamp]
  );

  const getSortIcon = (field) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortOrder === 'desc' ? (
      <ArrowDown className="h-4 w-4 text-primary" />
    ) : (
      <ArrowUp className="h-4 w-4 text-primary" />
    );
  };

  return (
    <div className="bg-white rounded-lg px-3 py-2 w-full max-w-none">

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search history (name, status, environment, summary)"
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={loading}
          />
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={loading}
          title="Refresh agent history"
          className="h-10 w-10 p-0"
          aria-label="Refresh agent history"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 mt-4">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">Failed to load agents: {error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="ml-auto"
          >
            Retry
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-primary-100 overflow-hidden mt-2 w-full">
        <Table className="border-collapse w-full table-fixed [&_th]:px-3 [&_td]:px-3">
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-gray-50 select-none w-[22%]"
                onClick={() => handleSortChange('name')}
              >
                <div className="flex items-center gap-2">
                  Name
                  {getSortIcon('name')}
                </div>
              </TableHead>
              <TableHead className="w-[13%]">Environment</TableHead>
              <TableHead className="w-[8%]">Workflow</TableHead>
              <TableHead className="cursor-pointer hover:bg-gray-50 select-none w-[10%]">
                <div className="flex items-center gap-2">Status</div>
              </TableHead>
              <TableHead className="w-[22%]">Summary</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-50 select-none w-[13%]"
                onClick={() => handleSortChange('updatedAt')}
              >
                <div className="flex items-center gap-2">
                  Updated
                  {getSortIcon('updatedAt')}
                </div>
              </TableHead>
              <TableHead className="text-right w-[12%]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (!agentHistory || agentHistory.length === 0) ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-muted-foreground">
                      Loading agents...
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredAgents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="text-gray-500">
                    {searchQuery
                      ? `No agents found matching "${searchQuery}"`
                      : 'No agents found'}
                  </div>
                  {!searchQuery && !error && (
                    <div className="mt-2 text-sm text-gray-400">
                      Purchase your first agent to get started
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredAgents.map((agent, index) => {
                if (!agent || !agent.itemId) return null;

                const agentWithOverrides = agentOverrides[agent.recordId]
                  ? { ...agent, ...agentOverrides[agent.recordId] }
                  : agent;
                const normalizedStatus = normalizeAgentStatus(agentWithOverrides.status);
                const canOpenRunDetails =
                  Boolean(agentWithOverrides.recordId) &&
                  !IN_PROGRESS_AGENT_STATUSES.has(normalizedStatus);
                const isAgentCancellable =
                  Boolean(agentWithOverrides.recordId) &&
                  CANCELLABLE_AGENT_STATUSES.has(normalizedStatus);
                const detailsTooltip = canOpenRunDetails
                  ? RESUMABLE_AGENT_STATUSES.has(normalizedStatus)
                    ? 'Continue run'
                    : 'View run details'
                  : 'Run details are available after the run stops';

                const uniqueKey = `${agentWithOverrides.itemId}-${agentWithOverrides.purchaseDate}-${agentWithOverrides.recordId}-${index}`;
                const sameNameCount = filteredAgents.filter(
                  (a) => a?.itemId === agentWithOverrides.itemId
                ).length;
                const summary = getRunSummaryFromLog(agentWithOverrides?.log);
                const summaryPreview = getSummaryPreview(summary);

                return (
                  <TableRow
                    key={uniqueKey}
                    className={sameNameCount > 1 ? 'bg-blue-50/30' : ''}
                  >
                    <TableCell className="overflow-hidden">
                      <div className="truncate">
                        {getAgentNameDisplay(agent)}
                      </div>
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <span className="text-sm text-gray-700 block truncate" title={getEnvironmentName(agent)}>
                        {getEnvironmentName(agent)}
                      </span>
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <WorkflowIndicator parentId={agent.parentId} />
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <StatusIndicator status={agentWithOverrides.status} />
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      {summary ? (
                        <div className="min-w-0">
                          <p
                            className="text-sm text-gray-600 break-words"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                            title={summaryPreview}
                          >
                            {summaryPreview}
                          </p>
                          <button
                            type="button"
                            className="mt-1 text-xs font-medium text-primary-600 hover:underline"
                            onClick={() =>
                              openSummaryModal(agentWithOverrides.title || agentWithOverrides.itemId, summary)
                            }
                          >
                            View full summary
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">—</span>
                      )}
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <span className="text-sm text-gray-600 block truncate">
                        {formatTimestamp(agentWithOverrides.updatedAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <TooltipProvider delayDuration={150}>
                      <div className="flex justify-end gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <Button
                                variant="outline"
                                className="border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 rounded-md h-8 w-8 p-0 flex items-center justify-center shadow-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => handleConnectAgent(agentWithOverrides)}
                                disabled={!canOpenRunDetails}
                                aria-label={detailsTooltip}
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">{detailsTooltip}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <Button
                                variant="outline"
                                className="h-8 w-8 p-0 flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => handleOpenAgentChat(agentWithOverrides)}
                                disabled={!agentWithOverrides.recordId}
                                aria-label="Open agent chat"
                              >
                                <Bot className="w-3.5 h-3.5" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {agentWithOverrides.recordId
                              ? 'Open in CloudAgent'
                              : 'Agent run not ready for chat'}
                          </TooltipContent>
                        </Tooltip>
                        {isAgentCancellable && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    variant="outline"
                                    className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-200 rounded-md h-8 w-8 p-0 flex items-center justify-center shadow-sm shrink-0 disabled:opacity-70 disabled:cursor-not-allowed"
                                    onClick={() => handleCancelAgentRun(agentWithOverrides)}
                                    disabled={loadingAgents[agentWithOverrides.recordId]}
                                    aria-label="Cancel run"
                                  >
                                    {loadingAgents[agentWithOverrides.recordId] ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <XCircle className="w-3.5 h-3.5" />
                                    )}
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">Cancel run</TooltipContent>
                            </Tooltip>
                        )}
                      </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {hasMoreTimeWindows &&
          !searchQuery &&
          (agentHistory?.length > 0 || loadedTimeWindows?.length > 0) && (
          <div className="p-4 border-t bg-gray-50">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {nextToken ? 'Loading more runs...' : 'Loading next 3 months...'}
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  {nextToken ? 'Load More Runs' : 'Load Next 3 Months'}
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={summaryModal.isOpen}
        onOpenChange={(isOpen) =>
          setSummaryModal((prev) => ({ ...prev, isOpen }))
        }
      >
        <DialogContent className="max-w-3xl bg-white">
          <DialogHeader>
            <DialogTitle>{summaryModal.title}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <Markdown
              options={{
                overrides: {
                  h1: { props: { className: 'text-xl font-semibold my-2 text-gray-900' } },
                  h2: { props: { className: 'text-lg font-semibold my-2 text-gray-900' } },
                  h3: { props: { className: 'text-base font-semibold my-2 text-gray-800' } },
                  p: { props: { className: 'text-sm text-gray-700 mb-2 whitespace-pre-wrap' } },
                  ul: { props: { className: 'list-disc pl-5 space-y-1 text-gray-700 mb-2' } },
                  ol: { props: { className: 'list-decimal pl-5 space-y-1 text-gray-700 mb-2' } },
                  li: { props: { className: 'text-sm text-gray-700' } },
                  code: {
                    props: {
                      className: 'font-mono bg-gray-100 rounded px-1',
                      style: { whiteSpace: 'pre-wrap' },
                    },
                  },
                  pre: { props: { className: 'bg-gray-100 rounded p-3 overflow-x-auto mb-2' } },
                  a: { props: { className: 'text-primary-600 hover:underline', target: '_blank' } },
                },
              }}
            >
              {summaryModal.summary || ''}
            </Markdown>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const WorkflowIndicator = ({ parentId }) => {
  const navigate = useNavigate();

  const getWorkflowInfo = (parentId) => {
    if (!parentId) return null;

    try {
      const parsed = JSON.parse(parentId);
      return parsed.workflowRunId
        ? {
            workflowRunId: parsed.workflowRunId,
            taskId: parsed.taskId,
            branchId: parsed.branchId,
          }
        : null;
    } catch (error) {
      console.error('Failed to parse parentId:', error);
      return null;
    }
  };

  const workflowInfo = getWorkflowInfo(parentId);

  if (!workflowInfo) {
    return <span className="text-xs text-gray-400">Manual</span>;
  }

  const handleWorkflowClick = () => {
    navigate(`/dashboard/workflow-history/${workflowInfo.workflowRunId}`);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 max-w-full"
      onClick={handleWorkflowClick}
    >
      <div className="flex items-center gap-1 min-w-0">
        <Workflow className="w-3 h-3 shrink-0" />
        <span className="truncate">View Workflow</span>
      </div>
    </Button>
  );
};
