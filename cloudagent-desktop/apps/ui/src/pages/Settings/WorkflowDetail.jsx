import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Loader2,
  XCircle,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Bot,
  ExternalLink,
} from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  workflowFollowUpMessage,
  agentFollowUpMessage,
  workflowRetryTask,
  workflowReconcile,
  workflowCancel,
} from '../../api/apigw';
import {
  getWorkflowById,
  clearSelectedWorkflow,
} from '../../features/workflow/workflowSlice';
import toast from 'react-hot-toast';

const parseJsonMaybe = (value) => {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const HIDDEN_WORKFLOW_DETAIL_NODE_TYPES = new Set(['startnode', 'endnode']);

const getExecutionNodeType = (execution) =>
  String(execution?.nodeType || execution?.type || '').toLowerCase();

const isDisplayableWorkflowExecution = (execution) =>
  !HIDDEN_WORKFLOW_DETAIL_NODE_TYPES.has(getExecutionNodeType(execution));

const getExecutionIdentity = (execution, fallbackIndex = 0) => {
  const taskIds = Array.isArray(execution?.tasks)
    ? execution.tasks.map((task) => task?.taskId || task?.id).filter(Boolean).join('|')
    : '';
  const stableParts = [
    execution?.branchId,
    execution?.nodeId,
    execution?.nodeIndex,
    getExecutionNodeType(execution),
    taskIds,
  ].filter((value) => value !== undefined && value !== null && value !== '');
  return stableParts.length ? stableParts.join(':') : `execution:${fallbackIndex}`;
};

const buildWorkflowRunChatPrompt = ({ workflowRunId, title, status }) => [
  `Inspect workflow run "${workflowRunId}"${title ? ` (${title})` : ''}.`,
  'Call get_workflow_run with this workflowRunId first and use the returned execution history as the source of truth.',
  'Summarize the current status, failed or waiting nodes, task inputs and outputs, and the next recommended action.',
  'If any workflow task references an agentRunId or linkedAgentRunIds, call get_agent_run for the relevant failed, waiting, or unclear agent runs before explaining what happened.',
  status ? `Known status from the workflow page: ${status}.` : null,
].filter(Boolean).join('\n');

const getTaskEnvironmentInfo = (task) => {
  const taskInputSettings = parseJsonMaybe(task?.taskInputSettings);
  const authProfile = parseJsonMaybe(taskInputSettings?.authProfile);
  if (!authProfile || typeof authProfile !== 'object') return null;

  const name = authProfile.name || 'Unknown Environment';
  const awsAccountId = authProfile.awsAccountId || authProfile.accountId || '';

  return {
    name,
    awsAccountId,
  };
};

const getTaskInputSettingsWithoutAuth = (task) => {
  const taskInputSettings = parseJsonMaybe(task?.taskInputSettings);
  if (!taskInputSettings || typeof taskInputSettings !== 'object') return null;

  const { authProfile, authProfiles, ...remaining } = taskInputSettings;
  if (!Object.keys(remaining).length) return null;

  const prioritized = {};

  if (remaining.accountScopedInput) {
    prioritized.accountScopedInput = remaining.accountScopedInput;
  }

  if (remaining.dynamicTargetResolution) {
    prioritized.dynamicTargetResolution = remaining.dynamicTargetResolution;
  }

  Object.entries(remaining).forEach(([key, value]) => {
    if (key === 'accountScopedInput' || key === 'dynamicTargetResolution') return;
    prioritized[key] = value;
  });

  return prioritized;
};

const getTaskAccountScopedInput = (task) => {
  const taskInputSettings = parseJsonMaybe(task?.taskInputSettings);
  const accountScopedInput = parseJsonMaybe(taskInputSettings?.accountScopedInput);
  if (!accountScopedInput || typeof accountScopedInput !== 'object') return null;
  return accountScopedInput;
};

const getTaskResultObject = (task) => {
  const parsed = parseJsonMaybe(task?.result);
  return parsed && typeof parsed === 'object' ? parsed : task?.result || null;
};

const getExecutionNodeOutputObject = (execution) => {
  const parsed = parseJsonMaybe(execution?.nodeOutput);
  return parsed && typeof parsed === 'object'
    ? parsed
    : execution?.nodeOutput || null;
};

const getInitialNodeTab = (node) => {
  if (getExecutionNodeOutputObject(node)) return 'nodeOutput';
  if (Array.isArray(node?.inputHistory) && node.inputHistory.length > 0) {
    return 'input';
  }
  return 0;
};

const buildHistoryResultForTask = (task) => {
  const result = getTaskResultObject(task);
  if (result && typeof result === 'object') {
    return {
      ...result,
      taskContext: {
        taskId: task?.taskId || null,
        taskLabel: task?.taskLabel || null,
      },
    };
  }

  return {
    statusCode: 200,
    output: {
      status: 'succeeded',
    },
    taskContext: {
      taskId: task?.taskId || null,
      taskLabel: task?.taskLabel || null,
    },
  };
};

const buildHistoryResultForExecution = (execution) => {
  const nodeOutput = getExecutionNodeOutputObject(execution);
  if (nodeOutput && typeof nodeOutput === 'object') {
    return nodeOutput;
  }

  const tasks = Array.isArray(execution?.tasks) ? execution.tasks : [];
  if (tasks.length === 1) {
    return buildHistoryResultForTask(tasks[0]);
  }

  return {
    statusCode: 200,
    output: {
      status: 'succeeded',
      advanceMode: 'all',
      taskResults: tasks.map((task) => ({
        taskId: task?.taskId || null,
        taskLabel: task?.taskLabel || null,
        result: getTaskResultObject(task),
      })),
    },
  };
};

const findExecutionByBranchId = (executions, branchId) => {
  const normalizedBranchId = String(branchId || '').trim();
  if (!normalizedBranchId) return null;
  return (Array.isArray(executions) ? executions : []).find(
    (execution) => String(execution?.branchId || '') === normalizedBranchId
  );
};

const resolvePayloadHistoryEntries = (payloadHistory, executions) => {
  return (Array.isArray(payloadHistory) ? payloadHistory : []).map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    if (entry.result || !entry.resultRef || typeof entry.resultRef !== 'object') {
      return entry;
    }

    const sourceExecution = findExecutionByBranchId(
      executions,
      entry.resultRef.branchId
    );
    if (!sourceExecution) return entry;

    let resolvedResult = null;
    if (entry.resultRef.taskId) {
      const sourceTask = Array.isArray(sourceExecution?.tasks)
        ? sourceExecution.tasks.find(
            (task) => task?.taskId === entry.resultRef.taskId
          )
        : null;
      if (sourceTask) {
        resolvedResult = buildHistoryResultForTask(sourceTask);
      }
    } else {
      resolvedResult = buildHistoryResultForExecution(sourceExecution);
    }

    if (!resolvedResult) return entry;

    return {
      ...entry,
      result: resolvedResult,
    };
  });
};

const getBlueprintTaskProgress = (task) => {
  const result = getTaskResultObject(task);
  if (!result || typeof result !== 'object') return null;

  const output = parseJsonMaybe(result.output) || result.output || {};
  const currentPhase = Number.isInteger(result.currentPhase)
    ? result.currentPhase
    : Number.isInteger(output?.currentPhase)
      ? output.currentPhase
      : null;
  const currentTask = Number.isInteger(result.currentTask)
    ? result.currentTask
    : Number.isInteger(output?.currentTask)
      ? output.currentTask
      : null;
  const completedTask = output?.completedTask || null;

  if (currentPhase == null && currentTask == null && !completedTask) return null;

  return {
    currentPhase,
    currentTask,
    completedTask,
  };
};

const getTaskProgressCounts = (tasks) => {
  if (!tasks || tasks.length === 0) return null;
  const total = tasks.length;
  const succeeded = tasks.filter((t) => t.status === 'succeeded').length;
  const failed = tasks.filter((t) => FAILED_TASK_STATUSES.has(String(t?.status || '').toLowerCase())).length;
  const cancelled = tasks.filter((t) =>
    CANCELLED_TASK_STATUSES.has(String(t?.status || '').toLowerCase())
  ).length;
  const pending = tasks.filter((t) => !t.status || t.status === 'pending').length;
  const inProgress = total - succeeded - failed - cancelled - pending;
  return { total, succeeded, failed, cancelled, inProgress, pending };
};

const parseWorkflowDefinitionMaybe = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getWorkflowDefinitionSource = (definition = {}) =>
  String(definition.workflowSource || definition.source || '')
    .trim()
    .toLowerCase();

const getWorkflowDefinitionLink = (definition = {}) => {
  const source = getWorkflowDefinitionSource(definition);
  const libraryWorkflowId = String(
    definition.sourceWorkflowId ||
      (source === 'library' ? definition.workflowId : '') ||
      ''
  ).trim();
  const savedWorkflowId = String(
    definition.workflowId ||
      (source !== 'library' ? definition.sourceWorkflowId : '') ||
      definition.id ||
      ''
  ).trim();

  if (source === 'library' && libraryWorkflowId) {
    return {
      label: 'View library definition',
      path: `/dashboard/workflow-template/${libraryWorkflowId}`,
    };
  }

  if (savedWorkflowId) {
    return {
      label: 'View workflow definition',
      path: `/workflow/${savedWorkflowId}`,
    };
  }

  if (libraryWorkflowId) {
    return {
      label: 'View library definition',
      path: `/dashboard/workflow-template/${libraryWorkflowId}`,
    };
  }

  return null;
};

const FAILED_TASK_STATUSES = new Set(['failed', 'error']);
const CANCELLED_TASK_STATUSES = new Set(['cancelled']);
const WAITING_TASK_STATUSES = new Set([
  'agent_waiting_on_user_input',
  'waiting_on_user_input',
]);
const TERMINAL_TASK_STATUSES = new Set([
  'succeeded',
  'failed',
  'error',
  'cancelled',
]);
const ACTIVE_WORKFLOW_STATUSES = new Set([
  'running',
  'in_progress',
  'waiting_on_user_input',
  'agent_waiting_on_user_input',
]);
const POLLING_WORKFLOW_STATUSES = new Set(['running', 'in_progress']);

const getWorkflowStatusBadgeClassName = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'bg-green-100 text-green-800';
  if (normalized === 'failed') return 'bg-red-100 text-red-800';
  if (normalized === 'cancelled') return 'bg-slate-100 text-slate-700';
  if (normalized === 'running' || normalized === 'in_progress') {
    return 'bg-blue-100 text-blue-800';
  }
  if (WAITING_TASK_STATUSES.has(normalized)) {
    return 'bg-amber-100 text-amber-800';
  }
  return 'bg-yellow-100 text-yellow-800';
};

const getExecutionStatusMeta = (tasks = []) => {
  const normalizedStatuses = (Array.isArray(tasks) ? tasks : []).map((task) =>
    String(task?.status || '').toLowerCase()
  );

  if (normalizedStatuses.length && normalizedStatuses.every((status) => status === 'succeeded')) {
    return {
      className: 'bg-green-100 text-green-800',
      label: 'Succeeded',
    };
  }

  if (normalizedStatuses.some((status) => FAILED_TASK_STATUSES.has(status))) {
    return {
      className: 'bg-red-100 text-red-800',
      label: 'Failed',
    };
  }

  if (normalizedStatuses.some((status) => CANCELLED_TASK_STATUSES.has(status))) {
    return {
      className: 'bg-slate-100 text-slate-700',
      label: 'Cancelled',
    };
  }

  if (normalizedStatuses.some((status) => WAITING_TASK_STATUSES.has(status))) {
    return {
      className: 'bg-amber-100 text-amber-800',
      label: 'Waiting on User Input',
    };
  }

  return {
    className: 'bg-yellow-100 text-yellow-800',
    label: 'In Progress',
  };
};

const getTaskStatusBadgeClassName = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'succeeded') return 'bg-green-100 text-green-800';
  if (FAILED_TASK_STATUSES.has(normalized)) return 'bg-red-100 text-red-800';
  if (CANCELLED_TASK_STATUSES.has(normalized)) return 'bg-slate-100 text-slate-700';
  if (WAITING_TASK_STATUSES.has(normalized)) return 'bg-amber-100 text-amber-800';
  return 'bg-yellow-100 text-yellow-800';
};

const TaskProgressBar = ({ tasks }) => {
  const counts = getTaskProgressCounts(tasks);
  if (!counts) return null;
  const { total, succeeded, failed, cancelled, inProgress, pending } = counts;
  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        {succeeded > 0 && (
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${(succeeded / total) * 100}%` }}
          />
        )}
        {failed > 0 && (
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${(failed / total) * 100}%` }}
          />
        )}
        {cancelled > 0 && (
          <div
            className="bg-slate-400 transition-all"
            style={{ width: `${(cancelled / total) * 100}%` }}
          />
        )}
        {inProgress > 0 && (
          <div
            className="bg-yellow-400 transition-all"
            style={{ width: `${(inProgress / total) * 100}%` }}
          />
        )}
        {pending > 0 && (
          <div
            className="bg-gray-300 transition-all"
            style={{ width: `${(pending / total) * 100}%` }}
          />
        )}
      </div>
      <p className="text-[10px] text-gray-500 leading-tight">
        {succeeded}/{total} done
        {failed > 0 && <span className="text-red-600"> · {failed} failed</span>}
        {cancelled > 0 && <span className="text-slate-600"> · {cancelled} cancelled</span>}
        {inProgress > 0 && <span> · {inProgress} running</span>}
        {pending > 0 && <span> · {pending} pending</span>}
      </p>
    </div>
  );
};

const WorkflowDetailPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { workflowId } = useParams();

  const { selectedWorkflow, selectedWorkflowLoading, selectedWorkflowError } =
    useSelector((state) => state.workflow);
  const { userProfile } = useSelector((state) => state.auth);

  const [selectedNode, setSelectedNode] = useState(null);
  const [activeTaskTab, setActiveTaskTab] = useState(0);
  const [followUpMessage, setFollowUpMessage] = useState('');
  const [followUpContext, setFollowUpContext] = useState({});
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [retryLoading, setRetryLoading] = useState(false);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [chatHistoryExpanded, setChatHistoryExpanded] = useState(false);

  const tabsNavRef = useRef(null);
  const [tabsCanScrollLeft, setTabsCanScrollLeft] = useState(false);
  const [tabsCanScrollRight, setTabsCanScrollRight] = useState(false);

  const updateTabsScroll = useCallback(() => {
    const el = tabsNavRef.current;
    if (!el) return;
    setTabsCanScrollLeft(el.scrollLeft > 0);
    setTabsCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateTabsScroll();
  }, [selectedNode, updateTabsScroll]);

  const scrollTabs = useCallback((direction) => {
    const el = tabsNavRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.6;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  }, []);

  // Close details modal and clear follow-up message
  const closeDetailsModal = () => {
    setSelectedNode(null);
    setFollowUpMessage('');
    setRetryLoading(false);
    setChatHistoryExpanded(false);
  };

  useEffect(() => {
    if (workflowId) {
      dispatch(getWorkflowById(workflowId));
    }

    return () => {
      dispatch(clearSelectedWorkflow());
    };
  }, [dispatch, workflowId]);

  useEffect(() => {
    const status = String(selectedWorkflow?.workflowStatus || '').toLowerCase();
    if (!workflowId || !POLLING_WORKFLOW_STATUSES.has(status)) return undefined;

    const timer = window.setInterval(() => {
      dispatch(getWorkflowById(workflowId));
    }, 3000);

    return () => window.clearInterval(timer);
  }, [dispatch, selectedWorkflow?.workflowStatus, workflowId]);

  useEffect(() => {
    if (
      selectedNode &&
      Array.isArray(selectedNode.tasks) &&
      typeof activeTaskTab === 'number' &&
      selectedNode.tasks[activeTaskTab]
    ) {
      const task = selectedNode.tasks[activeTaskTab];
      setFollowUpContext({
        workflowRunId: selectedWorkflow.workflowRunId,
        branchId: selectedNode.branchId,
        taskId: task.taskId,
        lastResponseId: task.result?.lastResponseId,
        agentRunId: task.agentRunId,
      });
      setChatHistoryExpanded(false);
    }
  }, [selectedNode, activeTaskTab]);

  const workflowDetails = React.useMemo(() => {
    let title = 'Unknown Workflow';
    let description = 'No description available';
    let runSummary = null;
    let definitionLink = null;

    if (selectedWorkflow?.workflowDefinition) {
      try {
        const parsedDefinition = parseWorkflowDefinitionMaybe(
          selectedWorkflow.workflowDefinition
        );
        if (parsedDefinition) {
          title =
            parsedDefinition.title || parsedDefinition.workflowName || title;
          description = parsedDefinition.description || description;
          runSummary = parsedDefinition.workflowRunSummary || null;
          definitionLink = getWorkflowDefinitionLink(parsedDefinition);
        }
      } catch (error) {
        console.error('Error parsing workflow definition:', error);
      }
    }

    return { title, description, runSummary, definitionLink };
  }, [selectedWorkflow?.workflowDefinition]);

  const executionHistory = React.useMemo(() => {
    if (!selectedWorkflow) return [];

    try {
      let allExecutions = [];

      if (selectedWorkflow.executionHistory) {
        const parsedHistory = parseJsonMaybe(selectedWorkflow.executionHistory);
        allExecutions = Array.isArray(parsedHistory)
          ? parsedHistory
          : parsedHistory
            ? [parsedHistory]
            : [];
      }

      if (selectedWorkflow.currentExecutions) {
        const parsedCurrent = parseJsonMaybe(selectedWorkflow.currentExecutions);
        const currentArray = Array.isArray(parsedCurrent)
          ? parsedCurrent
          : parsedCurrent
            ? [parsedCurrent]
            : [];
        allExecutions = [...allExecutions, ...currentArray];
      }

      const executionById = new Map();
      allExecutions.forEach((execution, index) => {
        if (!isDisplayableWorkflowExecution(execution)) return;
        const identity = getExecutionIdentity(execution, index);
        executionById.set(identity, execution);
      });

      const dedupedExecutions = Array.from(executionById.values());
      const hydratedExecutions = dedupedExecutions.map((execution) => ({
        ...execution,
        nodeOutput: getExecutionNodeOutputObject(execution),
        payloadHistory: resolvePayloadHistoryEntries(
          execution?.payloadHistory,
          allExecutions
        ),
      }));

      return hydratedExecutions.sort((a, b) => {
        const timeA = new Date(
          a.startedAt || a.timestamp || a.updatedAt || 0
        ).getTime();
        const timeB = new Date(
          b.startedAt || b.timestamp || b.updatedAt || 0
        ).getTime();
        return timeB - timeA;
      });
    } catch (error) {
      console.error('Error parsing execution history:', error);
      return [];
    }
  }, [selectedWorkflow?.executionHistory, selectedWorkflow?.currentExecutions]);

  const currentExecutions = React.useMemo(() => {
    if (!selectedWorkflow?.currentExecutions) return [];
    try {
      const parsed = parseJsonMaybe(selectedWorkflow.currentExecutions);
      if (!parsed) return [];
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
      console.error('Error parsing current executions:', error);
      return [];
    }
  }, [selectedWorkflow?.currentExecutions]);

  const recoverableWorkflowTaskCount = React.useMemo(() => {
    return currentExecutions.reduce((count, exec) => {
      const tasks = Array.isArray(exec?.tasks) ? exec.tasks : [];
      return (
        count +
        tasks.filter((task) =>
          ['pending', 'dispatching', 'in_progress'].includes(String(task?.status || '').toLowerCase())
        ).length
      );
    }, 0);
  }, [currentExecutions]);

  const isWorkflowCancellable = React.useMemo(() => {
    return ACTIVE_WORKFLOW_STATUSES.has(
      String(selectedWorkflow?.workflowStatus || '').toLowerCase()
    );
  }, [selectedWorkflow?.workflowStatus]);

  const handleBack = () => {
    navigate('/dashboard/workflow-history');
  };

  const handleRefresh = () => {
    if (workflowId) {
      dispatch(getWorkflowById(workflowId));
    }
  };

  const handleOpenWorkflowChat = useCallback(() => {
    const workflowRunId = selectedWorkflow?.workflowRunId || null;
    if (!workflowRunId) return;
    const workflowTitle = workflowDetails?.title || 'Workflow';
    const workflowStatus = selectedWorkflow?.workflowStatus || null;

    navigate('/dashboard/cloudagent', {
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
          workflowId: selectedWorkflow?.workflowId || null,
          title: workflowTitle,
          status: workflowStatus,
          startedAt: selectedWorkflow?.startedAt || null,
          completedAt: selectedWorkflow?.completedAt || null,
          updatedAt: selectedWorkflow?.updatedAt || null,
        },
      },
    });
  }, [
    navigate,
    selectedWorkflow?.completedAt,
    selectedWorkflow?.startedAt,
    selectedWorkflow?.updatedAt,
    selectedWorkflow?.workflowId,
    selectedWorkflow?.workflowRunId,
    selectedWorkflow?.workflowStatus,
    workflowDetails?.title,
  ]);

  if (selectedWorkflowLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="flex items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-muted-foreground">
            Loading workflow details...
          </span>
        </div>
      </div>
    );
  }

  if (selectedWorkflowError) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Button onClick={handleBack} variant="link" className="p-0">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Workflow History
          </Button>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Failed to Load Workflow
          </h2>
          <p className="text-red-600 mb-4">{selectedWorkflowError}</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
            <Button onClick={handleBack}>Back to List</Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Follow Up Modal Handlers ---

  const handleSendWorkflowFollowUp = () => {
    const { workflowRunId, branchId, taskId, lastResponseId } = followUpContext;
    setFollowUpLoading(true);
    workflowFollowUpMessage({
      userId: userProfile?.userId,
      workflowRunId,
      branchId,
      taskId,
      lastResponseId,
      followUpMessage,
      onSuccess: () => {
        setFollowUpMessage('');
        setFollowUpLoading(false);
        setSelectedNode(null);
        handleRefresh();
      },
      onError: (err) => {
        setFollowUpLoading(false);
        console.error('Follow-up error:', err);
        toast.error('Failed to send follow-up message.');
      },
    });
  };

  const handleSendAgentFollowUp = () => {
    const { agentRunId } = followUpContext;
    setFollowUpLoading(true);
    agentFollowUpMessage({
      userId: userProfile?.userId,
      agentRunId,
      followUpMessage,
      onSuccess: () => {
        setFollowUpMessage('');
        setFollowUpLoading(false);
        setSelectedNode(null);
        handleRefresh();
      },
      onError: (err) => {
        setFollowUpLoading(false);
        console.error('Follow-up error:', err);
        toast.error('Failed to send follow-up message to agent');
      },
    });
  };

  const handleRetryTask = () => {
    if (!selectedNode || activeTaskTab === 'input') return;
    const task = selectedNode.tasks?.[activeTaskTab];
    if (!task) return;

    setRetryLoading(true);
    workflowRetryTask({
      userId: userProfile?.userId,
      workflowRunId: selectedWorkflow.workflowRunId,
      branchId: selectedNode.branchId,
      taskId: task.taskId,
      onSuccess: () => {
        setRetryLoading(false);
        setSelectedNode(null);
        toast.success('Task restart scheduled.');
        handleRefresh();
      },
      onError: (err) => {
        setRetryLoading(false);
        console.error('Task retry error:', err);
        toast.error('Failed to retry task.');
      },
    });
  };

  const handleWorkflowReconcile = () => {
    if (!selectedWorkflow?.workflowRunId) return;

    setReconcileLoading(true);
    workflowReconcile({
      userId: userProfile?.userId,
      workflowRunId: selectedWorkflow.workflowRunId,
      onSuccess: (data) => {
        setReconcileLoading(false);
        toast.success(
          data?.requeuedTaskCount > 0
            ? `Requeued ${data.requeuedTaskCount} stuck task${data.requeuedTaskCount === 1 ? '' : 's'}.`
            : data?.message || 'Workflow reconciliation completed.'
        );
        handleRefresh();
      },
      onError: (err) => {
        setReconcileLoading(false);
        console.error('Workflow reconcile error:', err);
        toast.error('Failed to reconcile workflow.');
      },
    });
  };

  const handleWorkflowCancel = () => {
    if (!selectedWorkflow?.workflowRunId || !isWorkflowCancellable) return;

    setCancelLoading(true);
    workflowCancel({
      userId: userProfile?.userId,
      workflowRunId: selectedWorkflow.workflowRunId,
      onSuccess: (data) => {
        setCancelLoading(false);
        toast.success(data?.message || 'Workflow cancelled.');
        handleRefresh();
      },
      onError: (err) => {
        setCancelLoading(false);
        console.error('Workflow cancel error:', err);
        toast.error('Failed to cancel workflow.');
      },
    });
  };

  if (!selectedWorkflow) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Button onClick={handleBack} variant="link" className="p-0">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Workflow History
          </Button>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            Workflow Not Found
          </h2>
          <p className="text-gray-600 mb-4">
            The workflow you&apos;re looking for doesn&apos;t exist or you
            don&apos;t have access to it.
          </p>
          <Button onClick={handleBack}>Back to Workflow History</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 lg:p-0">
      <div className="bg-white rounded-[8px]">
        <div className="flex justify-between sm:items-center border-b p-3 sm:p-6 sm:py-4 mb-4 gap-3 sm:gap-0">
          <div className="flex items-center space-x-2">
            <Button onClick={handleBack} variant="link" className="p-0 h-auto">
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Workflow Details</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>
          <div className="flex flex-wrap justify-end gap-2 self-start sm:self-auto">
            {workflowDetails.definitionLink && (
              <Button
                onClick={() => navigate(workflowDetails.definitionLink.path)}
                variant="outline"
                size="sm"
                className="text-xs sm:text-sm"
              >
                <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">
                  {workflowDetails.definitionLink.label}
                </span>
                <span className="sm:hidden">Definition</span>
              </Button>
            )}
            <Button
              onClick={handleOpenWorkflowChat}
              variant="outline"
              size="sm"
              disabled={!selectedWorkflow?.workflowRunId}
              className="text-xs sm:text-sm"
              title={!selectedWorkflow?.workflowRunId ? 'Workflow run not ready for chat' : 'Open in CloudAgent'}
            >
              <Bot className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Chat</span>
            </Button>
            <Button
              onClick={handleWorkflowCancel}
              variant="outline"
              size="sm"
              disabled={selectedWorkflowLoading || cancelLoading || !isWorkflowCancellable}
              className="text-xs sm:text-sm border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
            >
              {cancelLoading ? (
                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
              ) : (
                <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              )}
              <span className="hidden sm:inline">Cancel Workflow</span>
              <span className="sm:hidden">Cancel</span>
            </Button>
            <Button
              onClick={handleWorkflowReconcile}
              variant="outline"
              size="sm"
              disabled={selectedWorkflowLoading || reconcileLoading || recoverableWorkflowTaskCount === 0}
              className="text-xs sm:text-sm"
            >
              {reconcileLoading && (
                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
              )}
              <span className="hidden sm:inline">Reconcile Stuck Tasks</span>
              <span className="sm:hidden">Reconcile</span>
            </Button>
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={selectedWorkflowLoading}
              className="text-xs sm:text-sm"
            >
              <RefreshCw
                className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${selectedWorkflowLoading ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        <div className="p-3 sm:p-6">
          <div className="bg-white rounded-xl border p-3 sm:p-6 mb-4 sm:mb-6">
            <div className="block lg:hidden space-y-4">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-1">
                  {workflowDetails.title}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500">
                  {workflowDetails.description}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <h3 className="text-xs sm:text-sm font-medium text-gray-600 mb-1">
                    Last Updated At
                  </h3>
                  <p className="text-sm sm:text-base text-gray-800">
                    {selectedWorkflow.updatedAt
                      ? new Date(selectedWorkflow.updatedAt).toLocaleString()
                      : 'Unknown'}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <h3 className="text-xs sm:text-sm font-medium text-gray-600 mb-1">
                    Status
                  </h3>
                  <div
                    className={`px-2 sm:px-3 py-1 rounded-full inline-flex items-center text-xs font-medium ${getWorkflowStatusBadgeClassName(selectedWorkflow.workflowStatus)}`}
                  >
                    {selectedWorkflow.workflowStatus}
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden lg:grid lg:grid-cols-3 gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  {workflowDetails.title}
                </h2>
                <p className="text-sm text-gray-500">
                  {workflowDetails.description}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600">
                  Last Updated At
                </h3>
                <p className="text-gray-800">
                  {selectedWorkflow.updatedAt
                    ? new Date(selectedWorkflow.updatedAt).toLocaleString()
                    : 'Unknown'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600">Status</h3>
                <div
                  className={`px-3 py-1 rounded-full inline-flex items-center text-xs font-medium ${getWorkflowStatusBadgeClassName(selectedWorkflow.workflowStatus)}`}
                >
                  {selectedWorkflow.workflowStatus}
                </div>
              </div>
            </div>

            {workflowDetails.runSummary?.summary && (
              <div className="mt-4 sm:mt-6 rounded-lg border border-blue-100 bg-blue-50 p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">
                  Workflow Summary
                </h3>
                <pre className="text-xs sm:text-sm text-blue-950 whitespace-pre-wrap break-words font-sans">
                  {workflowDetails.runSummary.summary}
                </pre>
                {workflowDetails.runSummary.generatedAt && (
                  <p className="mt-2 text-xs text-blue-700">
                    Generated {new Date(workflowDetails.runSummary.generatedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b">
              <h3 className="text-base sm:text-lg font-semibold">
                Execution History ({executionHistory.length} entries)
              </h3>
            </div>

            <div className="block lg:hidden">
              {executionHistory.length === 0 ? (
                <div className="text-center text-gray-500 py-8 px-4">
                  <div>
                    <p className="text-base sm:text-lg mb-2">
                      No execution history available
                    </p>
                    <p className="text-xs sm:text-sm">
                      This workflow hasn&apos;t been executed yet or execution
                      data is not available.
                    </p>
                  </div>
                </div>
              ) : (
                executionHistory.map((node, index) => {
                  const executionStatus = getExecutionStatusMeta(node.tasks);

                  return (
                    <div
                      key={getExecutionIdentity(node, index)}
                      className="border-b border-gray-100 last:border-b-0 p-3 sm:p-4"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm sm:text-base text-gray-900">
                              {node.nodeName || `Node ${index + 1}`}
                            </h4>
                            <p className="text-xs sm:text-sm text-gray-500">
                              {node.type || 'Unknown'} •{' '}
                              {node.tasks ? node.tasks.length : 0} tasks
                            </p>
                          </div>

                          <div className="text-right ml-2">
                            <div
                              className={`px-2 py-1 rounded-full inline-flex items-center text-xs font-medium ${executionStatus.className}`}
                            >
                              {executionStatus.label}
                            </div>
                            <TaskProgressBar tasks={node.tasks} />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Started:</span>{' '}
                            {node.startedAt
                              ? new Date(node.startedAt).toLocaleString()
                              : 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">Completed:</span>{' '}
                            {node.tasks &&
                            node.tasks.every((t) =>
                              TERMINAL_TASK_STATUSES.has(String(t?.status || '').toLowerCase())
                            ) &&
                            node.tasks.some((t) => t.completedAt)
                              ? new Date(
                                  Math.max(
                                    ...node.tasks
                                      .filter((t) => t.completedAt)
                                      .map((t) =>
                                        new Date(t.completedAt).getTime()
                                      )
                                  )
                                ).toLocaleString()
                              : 'N/A'}
                          </div>
                        </div>

                        <div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const inputHistory = node.payloadHistory || [];
                              setSelectedNode({
                                ...node,
                                inputHistory,
                              });
                              setActiveTaskTab(
                                getInitialNodeTab({
                                  ...node,
                                  inputHistory,
                                })
                              );
                            }}
                            disabled={!node.tasks || node.tasks.length === 0}
                            className="text-xs sm:text-sm"
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Node Name</TableHead>
                    <TableHead>Node Type</TableHead>
                    <TableHead>Tasks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started At</TableHead>
                    <TableHead>Completed At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executionHistory.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-gray-500 py-8"
                      >
                        <div>
                          <p className="text-lg mb-2">
                            No execution history available
                          </p>
                          <p className="text-sm">
                            This workflow hasn&apos;t been executed yet or
                            execution data is not available.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    executionHistory.map((node, index) => {
                      const executionStatus = getExecutionStatusMeta(node.tasks);

                      return (
                        <TableRow key={getExecutionIdentity(node, index)}>
                          <TableCell className="font-medium">
                            {node.nodeName || `Node ${index + 1}`}
                          </TableCell>
                          <TableCell>{node.type || 'Unknown'}</TableCell>
                          <TableCell>
                            {node.tasks ? node.tasks.length : 0}
                          </TableCell>
                          <TableCell>
                            <div
                              className={`px-3 py-1 rounded-full inline-flex items-center text-xs font-medium ${executionStatus.className}`}
                            >
                              {executionStatus.label}
                            </div>
                            <TaskProgressBar tasks={node.tasks} />
                          </TableCell>
                          <TableCell>
                            {node.startedAt
                              ? new Date(node.startedAt).toLocaleString()
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {node.tasks &&
                            node.tasks.every((t) =>
                              TERMINAL_TASK_STATUSES.has(String(t?.status || '').toLowerCase())
                            ) &&
                            node.tasks.some((t) => t.completedAt)
                              ? new Date(
                                  Math.max(
                                    ...node.tasks
                                      .filter((t) => t.completedAt)
                                      .map((t) =>
                                        new Date(t.completedAt).getTime()
                                      )
                                  )
                                ).toLocaleString()
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const inputHistory = node.payloadHistory || [];
                                  setSelectedNode({
                                    ...node,
                                    inputHistory,
                                  });
                                  setActiveTaskTab(
                                    getInitialNodeTab({
                                      ...node,
                                      inputHistory,
                                    })
                                  );
                                }}
                                disabled={!node.tasks || node.tasks.length === 0}
                              >
                                View Details
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {selectedNode && (
          <Dialog
            open={!!selectedNode}
            onOpenChange={(open) => {
              if (!open) closeDetailsModal();
            }}
          >
            <DialogContent className="max-w-xs sm:max-w-lg md:max-w-2xl lg:max-w-4xl bg-white overflow-y-auto max-h-[90vh] mx-2 sm:mx-4">
              <DialogHeader>
                <DialogTitle className="flex justify-between items-center text-sm sm:text-base">
                  <span className="truncate pr-2">
                    {selectedNode.nodeName || 'Unknown Node'} - Task Details
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={closeDetailsModal}
                    className="flex-shrink-0"
                  >
                    <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-gray-500 hover:text-gray-700" />
                  </Button>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="border-b border-gray-200 relative">
                  {tabsCanScrollLeft && (
                    <button
                      onClick={() => scrollTabs('left')}
                      className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-1 bg-gradient-to-r from-white via-white/90 to-transparent"
                      aria-label="Scroll tabs left"
                    >
                      <ChevronLeft className="h-4 w-4 text-gray-500" />
                    </button>
                  )}
                  <nav
                    ref={tabsNavRef}
                    onScroll={updateTabsScroll}
                    className={`-mb-px flex space-x-2 sm:space-x-4 overflow-x-auto scrollbar-hide ${tabsCanScrollLeft ? 'pl-6' : ''} ${tabsCanScrollRight ? 'pr-6' : ''}`}
                    style={{ scrollBehavior: 'smooth' }}
                  >
                    <>
                      {selectedNode.nodeOutput && (
                          <button
                            onClick={() =>
                              setActiveTaskTab('nodeOutput')
                            }
                            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap ${
                              activeTaskTab === 'nodeOutput'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            Node Output
                          </button>
                        )}
                      {selectedNode.inputHistory &&
                        selectedNode.inputHistory.length > 0 && (
                          <button
                            onClick={() => setActiveTaskTab('input')}
                            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap ${
                              activeTaskTab === 'input'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            Input
                          </button>
                        )}
                      {selectedNode.tasks &&
                        selectedNode.tasks.map((task, idx) => (
                          <button
                            key={idx}
                            onClick={() => setActiveTaskTab(idx)}
                            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
                              activeTaskTab === idx
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            Task {idx + 1}
                            {task.status === 'succeeded' && (
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                            )}
                            {FAILED_TASK_STATUSES.has(String(task?.status || '').toLowerCase()) && (
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
                            )}
                            {CANCELLED_TASK_STATUSES.has(String(task?.status || '').toLowerCase()) && (
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-500" />
                            )}
                          </button>
                        ))}
                    </>
                  </nav>
                  {tabsCanScrollRight && (
                    <button
                      onClick={() => scrollTabs('right')}
                      className="absolute right-0 top-0 bottom-0 z-10 flex items-center px-1 bg-gradient-to-l from-white via-white/90 to-transparent"
                      aria-label="Scroll tabs right"
                    >
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    </button>
                  )}
                </div>

                {activeTaskTab === 'nodeOutput' && selectedNode.nodeOutput && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-5">
                    <div className="mb-3">
                      <h4 className="text-xs sm:text-sm font-semibold text-gray-700">
                        Node Output
                      </h4>
                      <p className="text-xs text-gray-500">
                        Canonical output persisted for downstream nodes
                      </p>
                    </div>

                    {selectedNode.nodeOutput?.output?.message && (
                      <div className="mb-4">
                        <h5 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                          Message
                        </h5>
                        <pre className="text-xs text-gray-600 bg-white p-2 sm:p-3 rounded-md overflow-x-auto font-mono max-h-48 sm:max-h-64 overflow-y-auto whitespace-pre-wrap break-words border">
                          {selectedNode.nodeOutput.output.message}
                        </pre>
                      </div>
                    )}

                    <div>
                      <h5 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                        Raw Output
                      </h5>
                      <pre className="text-xs text-gray-600 bg-white p-2 sm:p-3 rounded-md overflow-x-auto font-mono max-h-64 sm:max-h-80 overflow-y-auto whitespace-pre-wrap break-words border">
                        {JSON.stringify(selectedNode.nodeOutput, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {activeTaskTab === 'input' &&
                  selectedNode.inputHistory?.length > 0 && (
                    <div className="space-y-4 sm:space-y-6">
                      {selectedNode.inputHistory.map((entry, idx) => (
                        <div
                          key={idx}
                          className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-5"
                        >
                          <div className="mb-3">
                            <h4 className="text-xs sm:text-sm font-semibold text-gray-700">
                              Node: {entry.nodeName || 'Unknown'}
                            </h4>
                            <p className="text-xs text-gray-500">
                              Type: {entry.nodeType || 'Unknown'}
                            </p>
                          </div>

                          {entry.result?.output && (
                            <div>
                              <h5 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                                Output
                              </h5>
                              <pre
                                className="text-xs text-gray-600 bg-white p-2 sm:p-3 rounded-md overflow-x-auto font-mono max-h-48 sm:max-h-64 overflow-y-auto whitespace-pre-wrap break-words border"
                                style={{ overflowWrap: 'anywhere' }}
                              >
                                {JSON.stringify(entry.result.output, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                {selectedNode.tasks &&
                  selectedNode.tasks[activeTaskTab] &&
                  activeTaskTab !== 'input' &&
                  activeTaskTab !== 'nodeOutput' && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-5">
                      <div className="mb-2 sm:mb-5 bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                        {(() => {
                          const task = selectedNode.tasks[activeTaskTab];
                          const isCloudOrReport = ['cloudtask', 'reporttask'].includes(
                            String(selectedNode.type || '').toLowerCase()
                          );
                          const environment = isCloudOrReport
                            ? getTaskEnvironmentInfo(task)
                            : null;
                          const filteredInputSettings =
                            getTaskInputSettingsWithoutAuth(task);
                          const accountScopedInput =
                            getTaskAccountScopedInput(task);

                          if (!environment && !filteredInputSettings) return null;

                          return (
                            <div className="space-y-3">
                              {environment && (
                                <div>
                                  <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                                    Environment
                                  </h4>
                                  <p className="text-xs text-gray-600">
                                    {environment.name}
                                    {environment.awsAccountId
                                      ? ` (${environment.awsAccountId})`
                                      : ''}
                                  </p>
                                </div>
                              )}

                              {filteredInputSettings && (
                                <div>
                                  {accountScopedInput && (
                                    <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
                                      <h4 className="text-xs sm:text-sm font-semibold text-blue-900 mb-2">
                                        Account-Scoped Input
                                      </h4>
                                      <pre className="text-xs text-blue-950 bg-white p-2 sm:p-3 rounded-md overflow-y-auto whitespace-pre-wrap break-words border max-h-[200px]">
                                        {JSON.stringify(accountScopedInput, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                                    Task Input Settings
                                  </h4>
                                  <pre className="text-xs text-gray-600 bg-gray-50 p-2 sm:p-3 rounded-md overflow-y-auto whitespace-pre-wrap break-words border max-h-[200px]">
                                    {JSON.stringify(filteredInputSettings, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {(() => {
                        const task = selectedNode.tasks[activeTaskTab];
                        const blueprintProgress = getBlueprintTaskProgress(task);
                        const normalizedStatus = String(task?.status || '').toLowerCase();
                        const isActiveBlueprintTask = ['in_progress', 'dispatching', 'agent_waiting_on_user_input', 'waiting_on_user_input'].includes(
                          normalizedStatus
                        );

                        if (!blueprintProgress || !isActiveBlueprintTask) return null;

                        return (
                          <div className="mb-2 sm:mb-5 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                            <h4 className="text-xs sm:text-sm font-semibold text-blue-900 mb-2">
                              Blueprint Progress
                            </h4>
                            <div className="space-y-1.5 text-xs text-blue-900">
                              {(blueprintProgress.currentPhase != null ||
                                blueprintProgress.currentTask != null) && (
                                <p>
                                  Currently at
                                  {blueprintProgress.currentPhase != null
                                    ? ` phase ${blueprintProgress.currentPhase + 1}`
                                    : ' an unknown phase'}
                                  {blueprintProgress.currentTask != null
                                    ? `, task ${blueprintProgress.currentTask + 1}`
                                    : ''}
                                  .
                                </p>
                              )}
                              {blueprintProgress.completedTask?.title && (
                                <p>
                                  Last completed blueprint task:{' '}
                                  <span className="font-medium">
                                    {blueprintProgress.completedTask.title}
                                  </span>
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      <div className="mb-2 sm:mb-5 bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                        {selectedNode.tasks[activeTaskTab].result?.output && (
                          <div className="mt-1">
                            <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                              Output
                            </h4>
                            <pre className="text-xs text-gray-600 bg-gray-50 p-2 sm:p-3 rounded-md overflow-y-auto whitespace-pre-wrap break-words border max-h-[200px]">
                              {selectedNode.tasks[activeTaskTab].result.output
                                ?.message
                                ? selectedNode.tasks[activeTaskTab].result
                                    .output.message
                                : selectedNode.tasks[activeTaskTab].result
                                    .output?.logs}
                            </pre>
                          </div>
                        )}
                        {selectedNode.tasks[activeTaskTab].result?.output?.sentEmail && (
                          <div className="mt-4 space-y-3">
                            <div>
                              <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                                Sent Email
                              </h4>
                              <div className="space-y-2 rounded-lg border bg-gray-50 p-3">
                                <p className="text-xs text-gray-700">
                                  <span className="font-semibold">To:</span>{' '}
                                  {selectedNode.tasks[activeTaskTab].result.output.sentEmail.recipient || 'Unknown'}
                                </p>
                                <p className="text-xs text-gray-700">
                                  <span className="font-semibold">Subject:</span>{' '}
                                  {selectedNode.tasks[activeTaskTab].result.output.sentEmail.subject || 'None'}
                                </p>
                                <div>
                                  <p className="text-xs font-semibold text-gray-700 mb-1">
                                    Body
                                  </p>
                                  <pre className="text-xs text-gray-600 bg-white p-2 sm:p-3 rounded-md overflow-y-auto whitespace-pre-wrap break-words border max-h-[260px]">
                                    {selectedNode.tasks[activeTaskTab].result.output.sentEmail.textBody ||
                                      selectedNode.tasks[activeTaskTab].result.output.sentEmail.htmlBody ||
                                      ''}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedNode.tasks[activeTaskTab].result?.output?.chatHistory &&
                          Array.isArray(selectedNode.tasks[activeTaskTab].result.output.chatHistory) &&
                          selectedNode.tasks[activeTaskTab].result.output.chatHistory.length > 1 && (
                            <div className="mt-4">
                              <button
                                onClick={() => setChatHistoryExpanded(!chatHistoryExpanded)}
                                className="flex items-center justify-between w-full text-left mb-2"
                              >
                                <h4 className="text-xs sm:text-sm font-semibold text-gray-700">
                                  Chat History
                                </h4>
                                {chatHistoryExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-500" />
                                )}
                              </button>
                              {chatHistoryExpanded && (
                                <div className="space-y-4">
                                  {selectedNode.tasks[activeTaskTab].result.output.chatHistory
                                    .slice(1)
                                    .map((chat, idx) => (
                                      <div
                                        key={idx}
                                        className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 space-y-2"
                                      >
                                        {chat.query && (
                                          <div>
                                            <h5 className="text-xs font-semibold text-gray-600 mb-1">
                                              Query
                                            </h5>
                                            <pre className="text-xs text-gray-700 bg-white p-2 sm:p-3 rounded-md overflow-y-auto whitespace-pre-wrap break-words border max-h-[200px]">
                                              {chat.query}
                                            </pre>
                                          </div>
                                        )}
                                        {chat.answer && (
                                          <div>
                                            <h5 className="text-xs font-semibold text-gray-600 mb-1">
                                              Response
                                            </h5>
                                            <pre className="text-xs text-gray-700 bg-white p-2 sm:p-3 rounded-md overflow-y-auto whitespace-pre-wrap break-words border max-h-[200px]">
                                              {chat.answer}
                                            </pre>
                                          </div>
                                        )}
                                        {chat.timestamp && (
                                          <p className="text-xs text-gray-500 mt-2">
                                            {new Date(chat.timestamp).toLocaleString()}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          )}
                        {!selectedNode.tasks[activeTaskTab].result?.output?.chatHistory &&
                          selectedNode.tasks[activeTaskTab].result?.agentRunId && (
                            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
                              <p className="text-xs text-blue-800">
                                Full chat history for agent-backed tasks is loaded from the agent run record.
                              </p>
                              <button
                                type="button"
                                className="mt-2 text-xs font-medium text-blue-700 underline underline-offset-2"
                                onClick={() => {
                                  navigate(
                                    `/dashboard/agent/${selectedNode.tasks[activeTaskTab].result.agentRunId}`,
                                    {
                                      state: {
                                        isReconnecting: true,
                                      },
                                    }
                                  );
                                }}
                              >
                                Open full agent transcript
                              </button>
                            </div>
                          )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                          <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-3">
                            Status
                          </h4>
                          <div className="space-y-2">
                            <div
                              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full inline-flex items-center text-xs font-medium ${getTaskStatusBadgeClassName(selectedNode.tasks[activeTaskTab].status)}`}
                            >
                              {selectedNode.tasks[activeTaskTab].status}
                            </div>
                            {selectedNode.tasks[activeTaskTab].result?.agentRunId && (
                              <p
                                className="text-xs text-primary-600 cursor-pointer hover:underline"
                                onClick={() => {
                                  navigate(
                                    `/dashboard/agent/${selectedNode.tasks[activeTaskTab].result.agentRunId}`,
                                    {
                                      state: {
                                        isReconnecting: true,
                                      },
                                    }
                                  );
                                }}
                              >
                                <span className="font-medium">Agent Run ID:</span>{' '}
                                {selectedNode.tasks[activeTaskTab].result.agentRunId}
                              </p>
                            )}
                          </div>
                          {FAILED_TASK_STATUSES.has(
                            String(selectedNode.tasks[activeTaskTab].status || '').toLowerCase()
                          ) && (
                            <div className="mt-4">
                              <Button
                                onClick={handleRetryTask}
                                disabled={retryLoading}
                                size="sm"
                                className="w-full sm:w-auto"
                              >
                                {retryLoading && (
                                  <Loader2 className="w-4 h-4 animate-spin text-primary mr-2" />
                                )}
                                Restart Task
                              </Button>
                            </div>
                          )}
                        </div>

                        {selectedNode.tasks[activeTaskTab].result
                          ?.lastResponseId && (
                          <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                            <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-3">
                              Thread Information
                            </h4>
                            <div className="space-y-1">
                              <p className="text-xs text-gray-600">
                                <span className="font-medium">Thread Id:</span>{' '}
                                <span className="break-all">
                                  {
                                    selectedNode.tasks[activeTaskTab].result
                                      .lastResponseId
                                  }
                                </span>
                              </p>
                              <p className="text-xs text-gray-600">
                                <span className="font-medium">
                                  Status Code:
                                </span>{' '}
                                {
                                  selectedNode.tasks[activeTaskTab].result
                                    .statusCode
                                }
                              </p>
                              {selectedNode.tasks[activeTaskTab].agentRunId && (
                                <p
                                  className="text-xs text-primary-600 cursor-pointer"
                                  onClick={() => {
                                    navigate(
                                      `/dashboard/agent/${selectedNode.tasks[activeTaskTab].agentRunId}`,
                                      {
                                        state: {
                                          isReconnecting: true,
                                        },
                                      }
                                    );
                                  }}
                                >
                                  <span className="font-medium">
                                    Agent Run ID:
                                  </span>{' '}
                                  {selectedNode.tasks[activeTaskTab].agentRunId}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Inline follow up input UI */}
                      {[
                        'waiting_on_user_input',
                        'agent_waiting_on_user_input',
                      ].includes(selectedNode.tasks[activeTaskTab].status) && (
                        <div className="bg-gray-50 border-t border-gray-200 rounded-b-lg p-3 sm:p-4 mt-4">
                          <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                            Send Follow Up
                          </h4>
                          <textarea
                            rows={3}
                            className="w-full border border-gray-300 rounded p-2 mb-2"
                            value={followUpMessage}
                            onChange={(e) => setFollowUpMessage(e.target.value)}
                            placeholder="Type follow-up message..."
                          />
                          <div className="flex justify-end">
                            <Button
                              onClick={
                                selectedNode.tasks[activeTaskTab].status ===
                                'agent_waiting_on_user_input'
                                  ? handleSendAgentFollowUp
                                  : handleSendWorkflowFollowUp
                              }
                              disabled={
                                !followUpMessage.trim() || followUpLoading
                              }
                            >
                              {followUpLoading && (
                                <Loader2 className="w-4 h-4 animate-spin text-primary mr-2" />
                              )}
                              Send
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
};

export default WorkflowDetailPage;
