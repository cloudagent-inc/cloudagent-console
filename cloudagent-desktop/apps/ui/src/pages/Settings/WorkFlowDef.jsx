import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Search,
  GitBranch,
  Plus,
  Edit2,
  Loader2,
  Calendar,
  Trash2,
  RefreshCw,
  Sparkles,
  Play,
} from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { useNavigate } from 'react-router-dom';
import DeleteModal from '../../components/DeleteModal';
import {
  createWorkflow,
  deleteWorkflow,
  updateWorkflow,
} from '../../features/workflow/workflowSlice';
import { refreshUserCredits } from '../../features/agent/agentSlice';
import { updateUserProfile } from '../../features/auth/authSlice';
import { getOverviewData } from '../../features/overview/overviewSlice';
import WorkflowHistory from './WorkflowHistory';
import { fetchAgentList } from '@/helpers/agentList';
import { runWorkflow } from '../../api/workflows';
import QuickRunWorkflowModal from '../../components/workflows/QuickRunWorkflowModal';
import toast from 'react-hot-toast';

const normalizeDescriptionText = (description) => {
  if (Array.isArray(description)) {
    return description.filter(Boolean).join(' ');
  }

  if (typeof description === 'string') {
    const trimmed = description.trim();
    if (!trimmed) return '';

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean).join(' ');
      }
    } catch {
      // fall through
    }

    return trimmed;
  }

  return '';
};

const safeParseWorkflowNodes = (nodes) => {
  if (Array.isArray(nodes)) return nodes;
  if (typeof nodes !== 'string') return [];
  try {
    const parsed = JSON.parse(nodes);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const safeParseSchedule = (schedule) => {
  if (!schedule) return {};
  if (typeof schedule === 'object') return schedule;
  if (typeof schedule !== 'string') return {};
  try {
    return JSON.parse(schedule);
  } catch {
    return {};
  }
};

const getDashboardWorkflowTab = (pathname = '') => {
  if (pathname.includes('/dashboard/workflow-def/library')) return 'library';
  if (pathname.includes('/dashboard/workflow-history')) return 'history';
  if (pathname.includes('/dashboard/workflow-def')) return 'workflows';
  return 'workflows';
};

const renderCloudProviderIcon = (provider) => {
  switch (String(provider || 'aws').toLowerCase()) {
    case 'google_workspace':
      return <Icons.googleWorkspace className="h-5 w-5 flex-shrink-0" />;
    case 'gcp':
      return <Icons.gcp className="h-5 w-5 flex-shrink-0" />;
    case 'azure':
      return <Icons.azure className="h-5 w-5 flex-shrink-0" />;
    case 'platform':
      return (
        <div className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-blue-500 shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
      );
    case 'aws':
    default:
      return <Icons.aws className="h-5 w-5 flex-shrink-0" />;
  }
};

const WorkFlowDef = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const [availableWorkflows, setAvailableWorkflows] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [libraryWorkflows, setLibraryWorkflows] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState(null);
  const [quickRunState, setQuickRunState] = useState(null);
  const [quickRunLoadingId, setQuickRunLoadingId] = useState(null);
  const [quickRunSubmitting, setQuickRunSubmitting] = useState(false);

  const userProfile = useSelector((state) => state.auth.userProfile);
  const workflowDefs = userProfile?.workFlowDefs || [];
  const { workflows } = useSelector((state) => state.overview);

  const filteredWorkflows = workflowDefs.filter(
    (workflow) =>
      workflow.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workflow.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const count = workflowDefs.filter(
      (wf) => wf.status !== 'completed' && wf.status !== 'failed'
    ).length;
    setAvailableWorkflows(count);
  }, [workflowDefs]);

  // Fetch overview data to get workflow runs
  useEffect(() => {
    dispatch(getOverviewData());
  }, [dispatch]);

  const handleEditWorkflow = (workflow) => {
    navigate(`/workflow/${workflow.workflowId}`, {
      state: {
        workflowName: workflow.title,
        workflowDescription: workflow.description,
        isLibrary: false,
      },
    });
  };

  const transformNodesForUI = (simpleNodes) => {
    const childMap = {};

    simpleNodes.forEach((node) => {
      const parents = Array.isArray(node.inputFrom)
        ? node.inputFrom
        : node.inputFrom
          ? [node.inputFrom]
          : [];

      parents.forEach((parentId) => {
        if (!childMap[parentId]) {
          childMap[parentId] = [];
        }
        childMap[parentId].push(node.id);
      });
    });

    return simpleNodes.map((node) => {
      const inputFrom = Array.isArray(node.inputFrom)
        ? node.inputFrom
        : node.inputFrom
          ? [node.inputFrom]
          : [];

      const logic = Array.isArray(node.logic)
        ? node.logic
        : node.logic
          ? [node.logic]
          : [];

      return {
        id: node.id,
        type: node.type,
        data: {
          ...node,
          name: node.name || `Node ${node.id}`,
          next: childMap[node.id] || [],
          inputFrom: inputFrom,
          logic: logic,
          triggerType:
            node.triggerType || (node.type === 'start' ? 'manual' : 'none'),
          schedule: node.schedule,
        },
        selectable: true,
        draggable: true,
        position: node.position || { x: 0, y: 0 },
        width: node.width || 220,
        height: node.height || 52,
      };
    });
  };

  // Helper function to get relative time
  const getRelativeTime = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Helper function to get status color - Red/Yellow/Green system
  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || '';

    // Green - Success
    if (statusLower === 'completed' || statusLower === 'complete' || statusLower === 'success') {
      return 'bg-green-500';
    }

    // Red - Failure
    if (statusLower === 'failed' || statusLower === 'error' || statusLower === 'cancelled') {
      return 'bg-red-500';
    }

    // Yellow - In Progress/Pending
    if (statusLower === 'running' || statusLower === 'in progress' ||
        statusLower === 'pending' || statusLower === 'waiting') {
      return 'bg-yellow-500';
    }

    // Gray - Unknown
    return 'bg-gray-400';
  };

  // Calculate workflow stats - lightweight for performance
  const workflowStats = useMemo(() => {
    const stats = {};

    workflows.forEach((run) => {
      try {
        const definition = JSON.parse(run.workflowDefinition || '{}');
        // Try to match by workflowId first, then fall back to title
        const workflowId = definition.workflowId || definition.title;

        if (!workflowId) return;

        if (!stats[workflowId]) {
          stats[workflowId] = {
            totalRuns: 0,
            lastRun: null,
            lastStatus: null,
          };
        }

        stats[workflowId].totalRuns++;

        // Track the most recent run
        if (!stats[workflowId].lastRun || new Date(run.updatedAt) > new Date(stats[workflowId].lastRun)) {
          stats[workflowId].lastRun = run.updatedAt;
          stats[workflowId].lastStatus = run.workflowStatus;
        }
      } catch (error) {
        console.error('Error parsing workflow definition:', error);
      }
    });

    return stats;
  }, [workflows, workflowDefs]);

  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() =>
    getDashboardWorkflowTab(location.pathname)
  );

  // Sync active tab with URL changes
  useEffect(() => {
    setActiveTab(getDashboardWorkflowTab(location.pathname));
  }, [location.pathname]);

  const loadLibraryWorkflows = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError(null);

    try {
      const response = await fetchAgentList();
      if (!response.ok) {
        throw new Error(
          `Failed to load library workflows (${response.status} ${response.statusText})`
        );
      }

      const payload = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error('Library workflow response was not an array.');
      }

      const libraryItems = payload
        .filter((workflow) => workflow?.active && workflow?.type === 'workflow')
        .map((workflow) => ({
          id: workflow.id,
          title: workflow.title || 'Untitled Workflow',
          description: normalizeDescriptionText(workflow.description),
          category: workflow.category || 'Uncategorized',
          credits: workflow.credits || 0,
          cloudProvider: workflow.cloudProvider || 'aws',
        }))
        .filter((workflow) => workflow.id);

      const deduped = Array.from(
        libraryItems.reduce((accumulator, workflow) => {
          if (!accumulator.has(workflow.id)) {
            accumulator.set(workflow.id, workflow);
          }
          return accumulator;
        }, new Map()).values()
      ).sort((a, b) => a.title.localeCompare(b.title));

      setLibraryWorkflows(deduped);
    } catch (fetchError) {
      console.error('Failed to load library workflows:', fetchError);
      setLibraryError(
        fetchError?.message || 'Failed to load library workflows.'
      );
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLibraryWorkflows();
  }, [loadLibraryWorkflows]);

  const filteredLibraryWorkflows = useMemo(() => {
    const normalizedQuery = searchQuery.toLowerCase().trim();
    const filtered = libraryWorkflows.filter((workflow) => {
      if (!normalizedQuery) return true;

      return (
        workflow.title.toLowerCase().includes(normalizedQuery) ||
        workflow.description.toLowerCase().includes(normalizedQuery) ||
        workflow.category.toLowerCase().includes(normalizedQuery) ||
        workflow.cloudProvider.toLowerCase().includes(normalizedQuery) ||
        workflow.id.toLowerCase().includes(normalizedQuery)
      );
    });

    return filtered.sort((a, b) => a.title.localeCompare(b.title));
  }, [libraryWorkflows, searchQuery]);

  const handleReviewLibraryWorkflow = useCallback(
    (workflow) => {
      if (!workflow?.id) return;
      navigate(`/dashboard/workflow-template/${workflow.id}`);
    },
    [navigate]
  );

  const openSavedQuickRun = useCallback((workflow) => {
    if (!workflow?.workflowId) return;
    const nodes = safeParseWorkflowNodes(workflow.nodes);
    setQuickRunState({
      source: 'saved',
      workflow: {
        workflowId: workflow.workflowId,
        title: workflow.title || 'Untitled Workflow',
        description: workflow.description || '',
        schedule: safeParseSchedule(workflow.schedule),
        nodes,
      },
      originalWorkflow: workflow,
    });
  }, []);

  const openLibraryQuickRun = useCallback(async (workflow) => {
    if (!workflow?.id) return;
    setQuickRunLoadingId(workflow.id);
    try {
      const response = await fetch(
        `https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/workflows/${workflow.id}.json`
      );
      if (!response.ok) {
        throw new Error(
          `Failed to load workflow (${response.status} ${response.statusText})`
        );
      }
      const definition = await response.json();
      if (!definition || !Array.isArray(definition.nodes)) {
        throw new Error('Library workflow definition is missing nodes.');
      }
      setQuickRunState({
        source: 'library',
        workflow: {
          ...definition,
          workflowId: definition.workflowId || definition.id || workflow.id,
          id: definition.id || workflow.id,
          title:
            definition.title ||
            definition.workflowName ||
            workflow.title ||
            'Untitled Workflow',
          description:
            definition.description ||
            definition.workflowDescription ||
            workflow.description ||
            '',
          sourceWorkflowId: workflow.id,
        },
        originalWorkflow: workflow,
      });
    } catch (error) {
      console.error('Failed to prepare library workflow quick run:', error);
      toast.error(error?.message || 'Failed to prepare workflow.');
    } finally {
      setQuickRunLoadingId(null);
    }
  }, []);

  const closeQuickRun = useCallback(() => {
    if (quickRunSubmitting) return;
    setQuickRunState(null);
  }, [quickRunSubmitting]);

  const startQuickRun = useCallback(
    async (definition, workflowRunPreferences) => {
      setQuickRunSubmitting(true);
      try {
        await runWorkflow({
          workflowDefinition: definition,
          workflowRunPreferences,
          userId: userProfile?.userId,
          navigate,
        });
        dispatch(refreshUserCredits())
          .unwrap()
          .catch((error) => {
            console.warn('[WorkFlowDef] Failed to refresh credits after workflow start:', error);
          });
        setQuickRunState(null);
      } catch (error) {
        toast.error(error?.message || 'Failed to start workflow.');
      } finally {
        setQuickRunSubmitting(false);
      }
    },
    [dispatch, navigate, userProfile?.userId]
  );

  const saveAndStartQuickRun = useCallback(
    async (definition, workflowRunPreferences) => {
      setQuickRunSubmitting(true);
      try {
        let savedWorkflow;
        if (quickRunState?.source === 'saved') {
          const workflowId =
            quickRunState.originalWorkflow?.workflowId || definition.workflowId;
          savedWorkflow = await dispatch(
            updateWorkflow({
              workflowId,
              nodes: JSON.stringify(definition.nodes || []),
              title: definition.title,
              description: definition.description || '',
              schedule: JSON.stringify(definition.schedule || {}),
            })
          ).unwrap();
        } else {
          savedWorkflow = await dispatch(
            createWorkflow({
              nodes: JSON.stringify(definition.nodes || []),
              title: definition.title,
              description: definition.description || '',
              schedule: JSON.stringify(definition.schedule || {}),
            })
          ).unwrap();
        }

        await runWorkflow({
          workflowDefinition: {
            ...definition,
            workflowId: savedWorkflow?.workflowId || definition.workflowId,
            title: savedWorkflow?.title || definition.title,
          },
          workflowRunPreferences,
          userId: userProfile?.userId,
          navigate,
        });
        dispatch(refreshUserCredits())
          .unwrap()
          .catch((error) => {
            console.warn('[WorkFlowDef] Failed to refresh credits after workflow start:', error);
          });
        setQuickRunState(null);
      } catch (error) {
        toast.error(error?.message || 'Failed to save and start workflow.');
      } finally {
        setQuickRunSubmitting(false);
      }
    },
    [dispatch, navigate, quickRunState, userProfile?.userId]
  );

  const reviewQuickRunWorkflow = useCallback(() => {
    const state = quickRunState;
    if (!state?.workflow) return;
    if (state.source === 'library') {
      navigate(`/workflow/${state.workflow.sourceWorkflowId || state.workflow.workflowId}`, {
        state: {
          workflowName: state.workflow.title || state.workflow.workflowName,
          workflowDescription:
            state.workflow.description || state.workflow.workflowDescription,
          isLibrary: true,
        },
      });
    } else {
      navigate(`/workflow/${state.workflow.workflowId}`, {
        state: {
          workflowName: state.workflow.title,
          workflowDescription: state.workflow.description,
          isLibrary: false,
        },
      });
    }
  }, [navigate, quickRunState]);

  const handleRefresh = useCallback(() => {
    if (activeTab === 'library') {
      loadLibraryWorkflows();
    }
  }, [activeTab, loadLibraryWorkflows]);

  return (
    <div>
      <div className="bg-white rounded-lg p-6 mt-2">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex justify-between items-center">
            <nav className="flex space-x-8">
              <NavLink
                to="/dashboard/workflow-def"
                onClick={() => setActiveTab('workflows')}
                className={() =>
                  `py-3 px-2 border-b-2 font-semibold text-base transition-colors ${
                    activeTab === 'workflows'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`
                }
              >
                My Workflows
              </NavLink>
              <NavLink
                to="/dashboard/workflow-def/library"
                onClick={() => setActiveTab('library')}
                className={() =>
                  `py-3 px-2 border-b-2 font-semibold text-base transition-colors ${
                    activeTab === 'library'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`
                }
              >
                Library Workflows
              </NavLink>
              <NavLink
                to="/dashboard/workflow-history"
                onClick={() => setActiveTab('history')}
                className={() =>
                  `py-3 px-2 border-b-2 font-semibold text-base transition-colors ${
                    activeTab === 'history'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`
                }
              >
                Workflow History
              </NavLink>
            </nav>
            <Button
              className="text-white"
              onClick={() => navigate('/workflow/new')}
            >
              <Plus className="w-4 h-4 mr-1" />
              Create Workflow
            </Button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'history' ? (
          <div className="mt-0">
            <WorkflowHistory />
          </div>
        ) : activeTab === 'library' ? (
          <>
            <div className="relative mt-4 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search Library Workflows"
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={libraryLoading}
                title="Refresh workflows list"
                className="h-10 w-10 p-0"
              >
                <RefreshCw
                  className={`w-4 h-4 ${libraryLoading ? 'animate-spin' : ''}`}
                />
              </Button>
            </div>

            {libraryError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{libraryError}</p>
              </div>
            )}

            <div className="rounded-xl border border-primary-100 overflow-hidden mt-4">
              <Table className="border-collapse">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[92px] text-center">Provider</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {libraryLoading && libraryWorkflows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <div className="flex items-center justify-center">
                          <Loader2 className="w-6 h-6 animate-spin mr-2" />
                          Loading library workflows...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredLibraryWorkflows.length > 0 ? (
                    filteredLibraryWorkflows.map((workflow) => (
                      <TableRow
                        key={workflow.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {workflow.title}
                            </div>
                            {workflow.description && (
                              <div className="text-sm text-gray-500 mt-1 line-clamp-2">
                                {workflow.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center">
                            {renderCloudProviderIcon(workflow.cloudProvider)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {workflow.category}
                        </TableCell>
                        <TableCell className="text-right w-24">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              className="border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 rounded-md px-2 py-1 h-8 w-8 flex items-center justify-center shadow-sm"
                              onClick={() => openLibraryQuickRun(workflow)}
                              title="Run workflow"
                              disabled={quickRunLoadingId === workflow.id}
                            >
                              {quickRunLoadingId === workflow.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              className="border-indigo-500 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200 rounded-md px-2 py-1 h-8 w-8 flex items-center justify-center shadow-sm"
                              onClick={() => handleReviewLibraryWorkflow(workflow)}
                              title="Review workflow"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center py-8 text-gray-500"
                      >
                        {searchQuery ? (
                          <>
                            <div className="text-lg font-medium">
                              No matching library workflows found
                            </div>
                            <p className="mt-1">
                              Try a different search term or clear your search
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="text-lg font-medium">
                              No library workflows available
                            </div>
                            <p className="mt-1">
                              Active library workflows will appear here when available
                            </p>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <>
            <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search Workflow"
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="rounded-xl border border-primary-100 overflow-hidden mt-4">
          <Table className="border-collapse">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorkflows.length > 0 ? (
                filteredWorkflows.map((workflow) => {
                  // Match by workflowId or title (for backward compatibility)
                  const stats = workflowStats[workflow.workflowId] ||
                               workflowStats[workflow.title] || {};
                  const hasRuns = stats.totalRuns > 0;

                  return (
                    <React.Fragment key={workflow.workflowId}>
                      <TableRow className="hover:bg-gray-50 transition-colors">
                        <TableCell className="font-medium">
                          {workflow.title || 'Untitled Workflow'}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {workflow.description}
                        </TableCell>
                        <TableCell>
                          {JSON.parse(workflow.schedule || '{}')?.triggerType ===
                          'scheduled' ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>Scheduled</span>
                            </div>
                          ) : (
                            <span>Manual</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {hasRuns ? (
                            <button
                              onClick={() => navigate('/dashboard/workflow-history')}
                              className="hover:opacity-70 transition-opacity group"
                            >
                              <div className="flex flex-col gap-1">
                                <span className="text-sm text-gray-700 group-hover:text-primary-600 transition-colors whitespace-nowrap">
                                  {stats.totalRuns} run{stats.totalRuns > 1 ? 's' : ''}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(stats.lastStatus)}`}></div>
                                  <span className="text-xs text-gray-500 whitespace-nowrap">
                                    {getRelativeTime(stats.lastRun)}
                                  </span>
                                </div>
                              </div>
                            </button>
                          ) : (
                            <span className="text-sm text-gray-400">No runs yet</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right w-24">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              className="border-indigo-500 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200 rounded-md px-2 py-1 h-8 w-8 flex items-center justify-center shadow-sm"
                              onClick={() => handleEditWorkflow(workflow)}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              variant="outline"
                              className="border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 rounded-md px-2 py-1 h-8 w-8 flex items-center justify-center shadow-sm"
                              onClick={() => openSavedQuickRun(workflow)}
                              title="Run workflow"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-200 rounded-md px-2 py-1 h-8 w-8 flex items-center justify-center shadow-sm"
                              disabled={deletingId === workflow.workflowId}
                              onClick={() => {
                                setWorkflowToDelete(workflow);
                                setShowDeleteModal(true);
                              }}
                            >
                              {deletingId === workflow.workflowId ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-gray-500"
                  >
                    {searchQuery ? (
                      <>
                        <div className="text-lg font-medium">
                          No matching workflows found
                        </div>
                        <p className="mt-1">
                          Try a different search term or clear your search
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="text-lg font-medium">
                          No workflows yet
                        </div>
                        <p className="mt-1">
                          Create your first workflow to get started
                        </p>
                        <Button
                          className="mt-4 bg-primary-600 hover:bg-primary-700"
                          onClick={() => navigate('/workflow/new')}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Create Workflow
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
          </>
        )}
      </div>
      {showDeleteModal && (
        <DeleteModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={async () => {
            if (workflowToDelete) {
              setDeletingId(workflowToDelete.workflowId);
              await dispatch(deleteWorkflow(workflowToDelete.workflowId));
              await dispatch(
                updateUserProfile({
                  removeWorkflowId: workflowToDelete.workflowId,
                })
              );
              setDeletingId(null);
            }
            setShowDeleteModal(false);
            setWorkflowToDelete(null);
          }}
          deleteText="Delete Workflow"
          deleteDescription={
            workflowToDelete
              ? `Are you sure you want to delete workflow "${workflowToDelete.title}"? This action cannot be undone.`
              : ''
          }
          deleteButtonText="Delete Workflow"
        />
      )}
      <QuickRunWorkflowModal
        isOpen={Boolean(quickRunState)}
        onClose={closeQuickRun}
        workflow={quickRunState?.workflow}
        source={quickRunState?.source}
        userProfile={userProfile}
        onRun={startQuickRun}
        onSaveAndRun={saveAndStartQuickRun}
        onReview={reviewQuickRunWorkflow}
        isSubmitting={quickRunSubmitting}
      />
    </div>
  );
};

export default WorkFlowDef;
