import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Input } from '@/components/ui/input';
import Markdown from 'markdown-to-jsx';
import {
  Search,
  Loader2,
  AlertCircle,
  Clock,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  RefreshCw,
  Bot,
  XCircle,
} from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getWorkflows,
  resetWorkflows,
} from '../../features/workflow/workflowSlice';
import { workflowCancel } from '../../api/workflows';
import {
  matchesWorkflowRun,
  selectActiveWorkspaceScope,
} from '@/features/workspace/workspaceScope';

const workflowSummaryMarkdownOptions = {
  overrides: {
    h1: {
      props: { className: 'text-xl font-semibold mb-3 mt-5 first:mt-0 text-slate-900' },
    },
    h2: {
      props: { className: 'text-lg font-semibold mb-3 mt-5 first:mt-0 text-slate-900' },
    },
    h3: {
      props: { className: 'text-base font-semibold mb-2 mt-4 first:mt-0 text-slate-900' },
    },
    p: {
      props: { className: 'mb-3 text-sm leading-6 text-slate-700' },
    },
    ul: {
      props: { className: 'mb-4 list-disc pl-5 space-y-1 text-sm leading-6 text-slate-700' },
    },
    ol: {
      props: { className: 'mb-4 list-decimal pl-5 space-y-1 text-sm leading-6 text-slate-700' },
    },
    li: {
      props: { className: 'text-sm leading-6 text-slate-700' },
    },
    code: {
      props: { className: 'rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-slate-800' },
    },
    pre: {
      props: { className: 'mb-4 overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-800' },
    },
    blockquote: {
      props: { className: 'mb-4 border-l-4 border-slate-300 pl-4 italic text-slate-600' },
    },
    a: {
      props: { className: 'text-primary underline underline-offset-4' },
    },
    strong: {
      props: { className: 'font-semibold text-slate-900' },
    },
  },
};

const workflowSummaryPreviewMarkdownOptions = {
  overrides: {
    h1: {
      props: { className: 'mb-1 text-xs font-semibold text-slate-700' },
    },
    h2: {
      props: { className: 'mb-1 text-xs font-semibold text-slate-700' },
    },
    h3: {
      props: { className: 'mb-1 text-xs font-semibold text-slate-700' },
    },
    p: {
      props: { className: 'mb-1 text-xs leading-5 text-muted-foreground' },
    },
    ul: {
      props: { className: 'mb-1 list-disc pl-4 text-xs leading-5 text-muted-foreground' },
    },
    ol: {
      props: { className: 'mb-1 list-decimal pl-4 text-xs leading-5 text-muted-foreground' },
    },
    li: {
      props: { className: 'text-xs leading-5 text-muted-foreground' },
    },
    code: {
      props: { className: 'rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700' },
    },
    pre: {
      props: { className: 'mb-1 overflow-hidden rounded bg-slate-100 p-2 text-[11px] text-slate-700' },
    },
    strong: {
      props: { className: 'font-medium text-slate-700' },
    },
  },
};

const getWorkflowStatusBadgeClassName = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'bg-green-100 text-green-800';
  if (normalized === 'failed') return 'bg-red-100 text-red-800';
  if (normalized === 'cancelled') return 'bg-slate-100 text-slate-700';
  if (normalized === 'running' || normalized === 'in_progress') {
    return 'bg-blue-100 text-blue-800';
  }
  if (
    normalized === 'waiting_on_user_input' ||
    normalized === 'agent_waiting_on_user_input'
  ) {
    return 'bg-amber-100 text-amber-800';
  }
  return 'bg-yellow-100 text-yellow-800';
};

const CANCELLABLE_WORKFLOW_STATUSES = new Set([
  'running',
  'in_progress',
  'waiting_on_user_input',
  'agent_waiting_on_user_input',
]);
const POLLING_WORKFLOW_STATUSES = new Set(['running', 'in_progress']);

const WORKFLOW_HISTORY_PAGE_SIZE = 10;
const RECENT_HISTORY_DAYS = 30;
const OLDER_HISTORY_WINDOW_DAYS = 90;
const INITIAL_WORKFLOW_RANGE = {
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

const getNextWorkflowHistoryRange = (currentRange) => {
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

const parseWorkflowDefinitionValue = (workflowDefinition) => {
  if (
    workflowDefinition == null ||
    workflowDefinition === '' ||
    workflowDefinition === 'undefined' ||
    workflowDefinition === 'null'
  ) {
    return null;
  }

  if (typeof workflowDefinition === 'object') return workflowDefinition;

  try {
    return JSON.parse(workflowDefinition);
  } catch (error) {
    console.error('Error parsing workflow definition:', error);
    return null;
  }
};

const buildWorkflowRunChatPrompt = ({ workflowRunId, title, status }) => [
  `Inspect workflow run "${workflowRunId}"${title ? ` (${title})` : ''}.`,
  'Call get_workflow_run with this workflowRunId first and use the returned execution history as the source of truth.',
  'Summarize the current status, failed or waiting nodes, task inputs and outputs, and the next recommended action.',
  'If any workflow task references an agentRunId or linkedAgentRunIds, call get_agent_run for the relevant failed, waiting, or unclear agent runs before explaining what happened.',
  status ? `Known status from the workflow history page: ${status}.` : null,
].filter(Boolean).join('\n');

export default function WorkflowHistory() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const activeWorkspaceScope = useSelector(selectActiveWorkspaceScope);
  const userProfile = useSelector((state) => state.auth?.userProfile || {});
  const [searchQuery, setSearchQuery] = useState('');
  const [hasInitialized, setHasInitialized] = useState(false);
  const [currentRange, setCurrentRange] = useState(INITIAL_WORKFLOW_RANGE);
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [workflowOverrides, setWorkflowOverrides] = useState({});
  const [cancelLoadingByRunId, setCancelLoadingByRunId] = useState({});
  const [summaryModal, setSummaryModal] = useState({
    open: false,
    title: '',
    summary: '',
  });

  const {
    userWorkflows,
    loading,
    error,
    nextToken,
    hasMoreTimeWindows,
    loadedTimeWindows,
  } = useSelector((state) => state.workflow);

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

  const loadWorkflowHistoryRange = useCallback(
    async (
      range,
      { reset = false, drainAllPages = false, initialCursor = null } = {}
    ) => {
      const { startDate, endDate } = toHistoryRangeDates(range);

      if (reset) {
        dispatch(resetWorkflows());
      }

      let cursor = initialCursor;

      do {
        const payload = await dispatch(
          getWorkflows({
            count: WORKFLOW_HISTORY_PAGE_SIZE,
            nextToken: cursor,
            sortBy,
            sortOrder,
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
    if (!hasInitialized && userWorkflows.length === 0 && !loading) {
      setHasInitialized(true);
      setCurrentRange(INITIAL_WORKFLOW_RANGE);
      void loadWorkflowHistoryRange(INITIAL_WORKFLOW_RANGE, {
        reset: true,
        drainAllPages: true,
      });
    }
  }, [
    hasInitialized,
    loadWorkflowHistoryRange,
    userWorkflows.length,
    loading,
  ]);

  // Handle refresh trigger from navigation state (e.g., after starting a workflow)
  useEffect(() => {
    if (location.state?.refresh) {
      setHasInitialized(true);
      setCurrentRange(INITIAL_WORKFLOW_RANGE);
      void loadWorkflowHistoryRange(INITIAL_WORKFLOW_RANGE, {
        reset: true,
        drainAllPages: true,
      });
      // Clear the state to prevent repeated refreshes
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, loadWorkflowHistoryRange, navigate, location.pathname]);

  useEffect(() => {
    const hasRunningWorkflow = (userWorkflows || []).some((workflow) =>
      POLLING_WORKFLOW_STATUSES.has(String(workflow?.workflowStatus || '').toLowerCase())
    );
    if (!hasRunningWorkflow) return undefined;

    const timer = window.setInterval(() => {
      if (loading) return;
      void loadWorkflowHistoryRange(INITIAL_WORKFLOW_RANGE, {
        reset: true,
        drainAllPages: true,
      });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [loadWorkflowHistoryRange, loading, userWorkflows]);

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

  const filteredWorkflows = useMemo(() => {
    if (!userWorkflows) return [];

    return userWorkflows.filter((workflow) => {
      if (!matchesWorkflowRun(workflow, activeWorkspaceScope, { workloadById: workloadsById })) {
        return false;
      }

      const parsedDefinition = parseWorkflowDefinitionValue(
        workflow.workflowDefinition
      );
      const title = parsedDefinition?.title || 'Unknown Workflow';
      const status = String(workflow.workflowStatus || '');

      return (
        title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        status.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [activeWorkspaceScope, searchQuery, userWorkflows, workloadsById]);

  const parseWorkflowDefinition = useCallback((workflowDefinition) => {
    return parseWorkflowDefinitionValue(workflowDefinition);
  }, []);

  const getWorkflowTitle = (workflowDefinition) => {
    const parsedDefinition = parseWorkflowDefinition(workflowDefinition);
    return parsedDefinition?.title || 'Unknown Workflow';
  };

  const buildCancelledWorkflowDefinition = useCallback(
    (workflowDefinition) => {
      const parsedDefinition = parseWorkflowDefinition(workflowDefinition);
      if (!parsedDefinition || typeof parsedDefinition !== 'object') {
        return workflowDefinition;
      }

      const timestamp = new Date();
      const cancellationMessage = `This workflow run was cancelled by the user on ${timestamp.toLocaleString()}.`;
      const existingSummary =
        parsedDefinition?.workflowRunSummary?.summary || '';
      const nextSummary = existingSummary
        ? `${existingSummary}\n\n### Cancellation\n${cancellationMessage}`
        : `## Workflow Summary\n\n### Status\n- ${cancellationMessage}`;

      return JSON.stringify({
        ...parsedDefinition,
        workflowRunSummary: {
          ...(parsedDefinition.workflowRunSummary || {}),
          summary: nextSummary,
          finalSummary: nextSummary,
          generatedAt: timestamp.toISOString(),
          status: 'cancelled',
        },
      });
    },
    [parseWorkflowDefinition]
  );

  const handleWorkflowCancel = useCallback(
    async (workflow) => {
      const workflowRunId = workflow?.workflowRunId;
      if (!workflowRunId) return;

      const normalizedStatus = String(workflow?.workflowStatus || '').toLowerCase();
      if (!CANCELLABLE_WORKFLOW_STATUSES.has(normalizedStatus)) return;
      if (cancelLoadingByRunId[workflowRunId]) return;

      setCancelLoadingByRunId((current) => ({
        ...current,
        [workflowRunId]: true,
      }));

      try {
        const data = await workflowCancel({
          userId: userProfile?.userId,
          workflowRunId,
        });

        setWorkflowOverrides((current) => ({
          ...current,
          [workflowRunId]: {
            workflowStatus: 'cancelled',
            updatedAt: new Date().toISOString(),
            currentExecutions: [],
            workflowDefinition: buildCancelledWorkflowDefinition(
              workflow.workflowDefinition
            ),
          },
        }));

        toast.success(data?.message || 'Workflow cancelled.');
      } catch (cancelError) {
        console.error('Workflow cancel error:', cancelError);
        toast.error('Failed to cancel workflow.');
      } finally {
        setCancelLoadingByRunId((current) => ({
          ...current,
          [workflowRunId]: false,
        }));
      }
    },
    [
      buildCancelledWorkflowDefinition,
      cancelLoadingByRunId,
      userProfile?.userId,
    ]
  );

  const handleLoadMore = useCallback(async () => {
    if (!hasMoreTimeWindows || loading) return;

    const targetRange = nextToken
      ? currentRange
      : getNextWorkflowHistoryRange(currentRange);

    await loadWorkflowHistoryRange(targetRange, {
      reset: false,
      drainAllPages: false,
      initialCursor: nextToken,
    });
  }, [
    currentRange,
    hasMoreTimeWindows,
    loadWorkflowHistoryRange,
    loading,
    nextToken,
  ]);

  const handleRefresh = useCallback(() => {
    setHasInitialized(true);
    setCurrentRange(INITIAL_WORKFLOW_RANGE);
    void loadWorkflowHistoryRange(INITIAL_WORKFLOW_RANGE, {
      reset: true,
      drainAllPages: true,
    });
  }, [loadWorkflowHistoryRange]);

  const handleOpenWorkflowChat = useCallback((workflow) => {
    const workflowRunId = workflow?.workflowRunId || null;
    if (!workflowRunId) return;
    const workflowDefinition = parseWorkflowDefinitionValue(workflow?.workflowDefinition);
    const workflowTitle = workflowDefinition?.title || workflowDefinition?.workflowName || 'Workflow';
    const workflowStatus = workflow?.workflowStatus || null;

    navigate('/dashboard/commandcenter', {
      state: {
        preloadPrompt: buildWorkflowRunChatPrompt({
          workflowRunId,
          title: workflowTitle,
          status: workflowStatus,
        }),
        preloadVisibleUserText: `Summarize workflow run ${workflowRunId}.`,
        preloadPromptKey: `workflow-run:${workflowRunId}`,
        workflowContext: {
          workflowRunId,
          workflowId: workflow?.workflowId || workflowDefinition?.workflowId || workflowDefinition?.id || null,
          title: workflowTitle,
          status: workflowStatus,
          startedAt: workflow?.startedAt || null,
          completedAt: workflow?.completedAt || null,
          updatedAt: workflow?.updatedAt || null,
        },
      },
    });
  }, [navigate]);

  const handleSortChange = useCallback(
    (newSortBy) => {
      let newSortOrder = 'desc';
      if (newSortBy === sortBy) {
        newSortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
      }

      setSortBy(newSortBy);
      setSortOrder(newSortOrder);
      setCurrentRange(INITIAL_WORKFLOW_RANGE);
      dispatch(resetWorkflows());
      setHasInitialized(false);
    },
    [sortBy, sortOrder, dispatch]
  );



  return (
    <div className="bg-white rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl text-primary-800 font-medium">
          Workflow History
        </h1>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          {
            loading && userWorkflows.length === 0
            ? <div className="flex items-center justify-between bg-primary-50 text-primary-600 px-3 py-2 rounded-full border border-primary-50">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {loading && userWorkflows.length === 0
                  ? 'Loading...'
                  : ''}
              </span>
            </div>
          </div> : null
          }
          
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search Workflows"
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={loading}
        />
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">
            Failed to load workflows: {error}
          </span>
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

      <div className="rounded-xl border border-primary-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer hover:bg-gray-50 select-none">
                <div className="flex items-center gap-2">
                  Workflow Title
                  {getSortIcon('name')}
                </div>
              </TableHead>
              <TableHead>Summary</TableHead>
              <TableHead className="cursor-pointer hover:bg-gray-50 select-none">
                <div className="flex items-center gap-2">
                  Status
                  {getSortIcon('status')}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-50 select-none"
                onClick={() => handleSortChange('updatedAt')}
              >
                <div className="flex items-center gap-2">
                  Last Update
                  {getSortIcon('updatedAt')}
                </div>
              </TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && userWorkflows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-muted-foreground">
                      Loading workflows...
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredWorkflows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="text-gray-500">
                    {searchQuery
                      ? `No workflows found matching "${searchQuery}"`
                      : 'No workflows found'}
                  </div>
                  {!searchQuery && !error && (
                    <div className="mt-2 text-sm text-gray-400">
                      Create your first workflow to get started
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredWorkflows.map((workflow) => {
                const workflowKey = workflow.workflowRunId || workflow.workflowId;
                const workflowWithOverrides = workflowOverrides[workflowKey]
                  ? { ...workflow, ...workflowOverrides[workflowKey] }
                  : workflow;
                const title = getWorkflowTitle(workflowWithOverrides.workflowDefinition);
                const workflowDefinition = parseWorkflowDefinition(
                  workflowWithOverrides.workflowDefinition
                );
                const workflowSummary = workflowDefinition?.workflowRunSummary?.summary || '';
                const workflowRunId = workflowWithOverrides.workflowRunId;
                const isWorkflowCancellable = CANCELLABLE_WORKFLOW_STATUSES.has(
                  String(workflowWithOverrides.workflowStatus || '').toLowerCase()
                );
                const isCancelLoading = Boolean(cancelLoadingByRunId[workflowRunId]);

                return (
                  <TableRow key={workflowKey}>
                    <TableCell className="font-medium">
                      <div>{title}</div>
                    </TableCell>
                    <TableCell className="align-top">
                      {workflowSummary ? (
                        <div className="max-w-[320px]">
                          <div className="max-h-6 overflow-hidden">
                            <Markdown options={workflowSummaryPreviewMarkdownOptions}>
                              {workflowSummary}
                            </Markdown>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setSummaryModal({
                                open: true,
                                title,
                                summary: workflowSummary,
                              })
                            }
                            className="mt-1 text-xs font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                          >
                            View more
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div
                        className={`px-3 py-1 rounded-full inline-flex items-center text-xs font-medium ${getWorkflowStatusBadgeClassName(workflowWithOverrides.workflowStatus)}`}
                      >
                        {workflowWithOverrides.workflowStatus}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {workflowWithOverrides.updatedAt
                        ? new Date(workflowWithOverrides.updatedAt).toLocaleString()
                        : 'Unknown'}
                    </TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider delayDuration={150}>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-w-[112px] whitespace-nowrap"
                          onClick={() =>
                            navigate(
                              `/dashboard/workflow-history/${workflowRunId || workflow.workflowId}`,
                              {
                                state: {
                                  workflowDefinition:
                                    workflowWithOverrides.workflowDefinition,
                                },
                              }
                            )
                          }
                        >
                          View Details
                        </Button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleOpenWorkflowChat(workflowWithOverrides)}
                              disabled={!workflowRunId}
                              aria-label="Open workflow chat"
                            >
                              <Bot className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {workflowRunId
                              ? 'Open in CloudAgent'
                              : 'Workflow run not ready for chat'}
                          </TooltipContent>
                        </Tooltip>
                        {isWorkflowCancellable && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() =>
                                  handleWorkflowCancel(workflowWithOverrides)
                                }
                                disabled={isCancelLoading}
                                aria-label="Cancel workflow"
                              >
                                {isCancelLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <XCircle className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              Cancel workflow
                            </TooltipContent>
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
          (userWorkflows?.length > 0 || loadedTimeWindows?.length > 0) && (
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
                  {nextToken ? 'Loading more workflows...' : 'Loading next 3 months...'}
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  {nextToken ? 'Load More Workflows' : 'Load Next 3 Months'}
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={summaryModal.open}
        onOpenChange={(open) =>
          setSummaryModal((current) => ({
            ...current,
            open,
          }))
        }
      >
        <DialogContent className="max-w-3xl border border-slate-200 bg-white p-0 shadow-2xl">
          <DialogHeader className="border-b border-slate-200 px-6 py-4">
            <DialogTitle>{summaryModal.title || 'Workflow Summary'}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
            <Markdown options={workflowSummaryMarkdownOptions}>
              {summaryModal.summary}
            </Markdown>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
