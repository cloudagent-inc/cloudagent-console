import React, { useState, useMemo, useEffect } from 'react';
import {
  Play,
  ArrowRight,
  Settings,
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle,
  GraduationCap,
  Sparkles,
  FileText,
  Cloud,
  Layers,
  Send,
  ChevronRight,
  FileBarChart,
  Search,
  GitBranch,
  LayoutGrid,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ExecutiveSummaryContent,
  ExecutiveSummaryModal,
  parseSummary,
} from '@/components/ExecutiveSummary';
import { Icons } from '../../components/icons';
import { Button } from '@/components/ui/button';
import HelpChatModal from '../../components/HelpChatModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { getOverviewData } from '../../features/overview/overviewSlice';
import { fetchAllRecommendations, refreshUserProfile } from '../../features/auth/authSlice';
import OnboardingSection from '../../components/OnboardingSection';
import { buildReportRoute } from '../../helpers/accountScans';
import { toLogObject } from '../../helpers/logUtils';
import { isLocalRuntime } from '../../runtime/cloudAgentRuntime';

import { filterCloudEnvironments } from '../../helpers/shared';

// Helper functions for recommendations processing
const safeJsonParse = (value) => {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return '';
  const couldBeJson =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'));
  if (!couldBeJson) return trimmed;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
};

const toArray = (value) => {
  if (value == null) return [];
  const parsed = safeJsonParse(value);
  if (Array.isArray(parsed)) return parsed;
  if (parsed == null) return [];
  if (typeof parsed === 'object') {
    if (Array.isArray(parsed.active)) return parsed.active;
    if (Array.isArray(parsed.resources)) return parsed.resources;
    const nestedArrays = Object.values(parsed).filter((item) => Array.isArray(item));
    if (nestedArrays.length) return nestedArrays.flat();
    return [parsed];
  }
  if (typeof parsed === 'string') return parsed ? [parsed] : [];
  return [parsed];
};

const getPriorityMeta = (priority) => {
  if (priority === null || priority === undefined || priority === '') return null;
  const numericValue = Number(priority);
  if (!Number.isFinite(numericValue)) return null;
  const value = Math.max(0, Math.min(100, Math.round(numericValue)));
  if (value >= 90) return { label: 'Critical', value, variant: 'destructive' };
  if (value >= 80) return { label: 'High', value, variant: 'default' };
  if (value >= 50) return { label: 'Medium', value, variant: 'secondary' };
  return { label: 'Low', value, variant: 'outline' };
};

const Overview = () => {
  const [activeScheduledTab, setActiveScheduledTab] =
    useState('All Activities');
  const [activeLatestTab, setActiveLatestTab] = useState('All Activity');
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [showOnboardingManually, setShowOnboardingManually] = useState(false);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  
  // Chat launcher state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInputValue, setChatInputValue] = useState('');

  const {
    loading,
    error,
    agentHistory,
    reportHistory,
    workflows,
    workFlowDefs,
    stats,
    lastFetched,
  } = useSelector((state) => state.overview);
  const { userProfile } = useSelector((state) => state.auth);

  // Get recommendations from userProfile
  const recommendations = useMemo(() => {
    return userProfile?.recommendations?.recommendations || [];
  }, [userProfile]);

  useEffect(() => {
    dispatch(getOverviewData());
    
    // Fetch recommendations if not already loaded
    if (recommendations.length === 0 && !recommendationsLoading) {
      setRecommendationsLoading(true);
      dispatch(fetchAllRecommendations())
        .finally(() => setRecommendationsLoading(false));
    }
  }, [dispatch, recommendations.length]);

  const getWorkflowData = (workflow) => {
    try {
      if (workflow.workflowDefinition) {
        return JSON.parse(workflow.workflowDefinition);
      } else if (workflow.nodes) {
        return {
          workflowName: workflow.workflowName || workflow.title,
          workflowDescription:
            workflow.workflowDescription || workflow.description,
          nodes:
            typeof workflow.nodes === 'string'
              ? JSON.parse(workflow.nodes)
              : workflow.nodes,
        };
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  };

  const calculateNextRun = (schedule) => {
    if (!schedule) return 'Unknown';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (schedule.type) {
      case 'daily': {
        const [hours, minutes] = (schedule.time || '09:00').split(':');
        const nextDaily = new Date(today);
        nextDaily.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        if (nextDaily <= now) {
          nextDaily.setDate(nextDaily.getDate() + 1);
        }

        return nextDaily.toLocaleDateString() + ' at ' + schedule.time;
      }

      case 'weekly':
        return `Weekly on ${schedule.day || 'Unknown'} at ${schedule.time || 'Unknown'}`;

      case 'monthly':
        return `Monthly on ${schedule.date || 'Unknown'} at ${schedule.time || 'Unknown'}`;

      default:
        return 'Unknown';
    }
  };

  const scheduledWorkflows = useMemo(() => {
    return (
      workFlowDefs
        .filter(
          (workflow) =>
            workflow.schedule &&
            JSON.parse(workflow.schedule).triggerType === 'scheduled'
        )
        // .filter((workflow) => {
        //   const workflowData = getWorkflowData(workflow);
        //   if (!workflowData || !workflowData.nodes) return false;

        //   return workflowData.nodes.some(
        //     (node) =>
        //       (node.type === 'startNode' || node.id === 'start') &&
        //       node.triggerType === 'scheduled'
        //   );
        // })
        .map((workflow) => {
          const workflowData = getWorkflowData(workflow);
          if (!workflowData || !workflowData.nodes) {
            return {
              id: `scheduled-${workflow.workflowId}`,
              name:
                workflow.workflowName ||
                workflow.title ||
                `Workflow ${workflow.workflowId}`,
              schedule: { type: 'Unknown', time: 'Unknown' },
              status: workflow.status || 'Active',
              lastRun: workflow.lastRun || 'Never',
              nextRun: 'Unknown',
              workflowId: workflow.workflowId,
              data: workflow,
            };
          }

          const startNode = workflowData.nodes.find(
            (node) =>
              (node.type === 'startNode' || node.id === 'start') &&
              node.triggerType === 'scheduled'
          );

          return {
            id: `scheduled-${workflow.workflowId}`,
            name:
              workflowData.workflowName ||
              workflow.workflowName ||
              workflow.title ||
              `Workflow ${workflow.workflowId}`,
            schedule: startNode?.schedule || {
              type: 'Unknown',
              time: 'Unknown',
            },
            status: workflow.status || 'Active',
            lastRun: workflow.lastRun || 'Never',
            nextRun: calculateNextRun(startNode?.schedule),
            workflowId: workflow.workflowId,
            data: workflow,
          };
        })
    );
  }, [workFlowDefs]);

  const filteredScheduledWorkflows = useMemo(() => {
    switch (activeScheduledTab) {
      case 'Active':
        return scheduledWorkflows.filter(
          (item) => item.status === 'Active' || item.status === 'active'
        );
      case 'Paused':
        return scheduledWorkflows.filter(
          (item) =>
            item.status === 'Paused' ||
            item.status === 'paused' ||
            item.status === 'inactive'
        );
      case 'All Activities':
      default:
        return scheduledWorkflows;
    }
  }, [scheduledWorkflows, activeScheduledTab]);

  const latestActivity = useMemo(() => {
    const activities = [];

    workflows.forEach((workflow) => {
      activities.push({
        id: `workflow-${workflow.workflowRunId}`,
        name: (() => {
          try {
            if (workflow.workflowDefinition) {
              const definition = JSON.parse(workflow.workflowDefinition);
              return (
                definition.workflowName ||
                definition.title ||
                `Workflow Run ${workflow.workflowRunId}`
              );
            } else {
              return (
                workflow.workflowName ||
                workflow.title ||
                `Workflow Run ${workflow.workflowRunId}`
              );
            }
          } catch {
            return (
              workflow.workflowName ||
              workflow.title ||
              `Workflow Run ${workflow.workflowRunId}`
            );
          }
        })(),
        date: workflow.updatedAt
          ? new Date(workflow.updatedAt).toLocaleDateString()
          : 'Unknown',
        status: workflow.workflowStatus || 'Unknown',
        type: 'workflow',
        workflowId: workflow.workflowRunId,
        data: workflow,
        category: 'run',
      });
    });

    agentHistory.forEach((agent) => {
      // Skip reports from agentHistory; report runs are tracked in reportHistory.
      if (agent.agentType === 'report') return;
      
      activities.push({
        id: `agent-${agent.recordId || agent.itemId}`,
        name: agent.itemId || `Agent ${agent.recordId}`,
        date: agent.purchaseDate
          ? new Date(agent.purchaseDate).toLocaleDateString()
          : 'Unknown',
        status: agent.status || 'Available',
        type:
          agent?.agentType === 'individual'
            ? 'agent'
            : agent?.agentType || 'agent',
        agentId: agent.itemId || agent.recordId,
        data: agent,
        category: 'agent',
      });
    });

          // Add reportHistory entries with reportId.
          reportHistory
            .filter((scan) => scan.reportId) // Only include scans that are reports
            .forEach((scan) => {
              activities.push({
                id: `report-${scan.scanId}`,
                name: scan.title || scan.reportId || `Report ${scan.scanId}`,
                date: scan.lastUpdateTime
                  ? new Date(scan.lastUpdateTime).toLocaleDateString()
                  : 'Unknown',
                status: scan.status || 'Unknown',
                type: 'report',
                scanId: scan.scanId,
                reportId: scan.reportId,
                data: scan,
                category: 'report',
              });
            });

    return activities.sort((a, b) => {
      const dateA = new Date(a.data?.updatedAt || a.data?.purchaseDate || a.data?.lastUpdateTime || 0);
      const dateB = new Date(b.data?.updatedAt || b.data?.purchaseDate || b.data?.lastUpdateTime || 0);
      return dateB - dateA;
    });
  }, [workflows, agentHistory, reportHistory]);

  const filteredLatestActivity = useMemo(() => {
    let filtered;

    switch (activeLatestTab) {
      case 'Agents':
        filtered = latestActivity.filter((item) => item.type === 'agent');
        break;
      case 'Workflows':
        filtered = latestActivity.filter((item) => item.type === 'workflow');
        break;
      case 'Platform Insights':
        filtered = latestActivity.filter((item) => item.type === 'report');
        break;
      case 'Waiting on User':
        filtered = latestActivity.filter(
          (item) =>
            item.status === 'Waiting on User' ||
            item.status === 'waiting' ||
            item.status === 'pending'
        );
        break;
      case 'Done':
        filtered = latestActivity.filter(
          (item) =>
            item.status === 'Done' ||
            item.status === 'completed' ||
            item.status === 'complete'
        );
        break;
      case 'All Activity':
      default:
        filtered = latestActivity;
        break;
    }

    return filtered.sort((a, b) => {
      const dateA = new Date(a.data?.updatedAt || a.data?.purchaseDate || 0);
      const dateB = new Date(b.data?.updatedAt || b.data?.purchaseDate || 0);
      return dateB - dateA;
    });
  }, [latestActivity, activeLatestTab]);

  // Calculate recommendation stats
  const recommendationStats = useMemo(() => {
    const activeRecommendations = recommendations.filter((rec) => {
      const status = rec?.status?.toLowerCase();
      return (
        status !== 'archived' &&
        status !== 'closed' &&
        status !== 'completed'
      );
    });

    const byPriority = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const affectedWorkloads = new Set();

    activeRecommendations.forEach((rec) => {
      const metadata = safeJsonParse(rec?.metadata);
      const priorityMeta = getPriorityMeta(metadata?.priority);
      if (priorityMeta) {
        if (priorityMeta.label === 'Critical') byPriority.critical++;
        else if (priorityMeta.label === 'High') byPriority.high++;
        else if (priorityMeta.label === 'Medium') byPriority.medium++;
        else byPriority.low++;
      }

      // Count affected workloads
      const targetResources = toArray(rec?.targetResources);
      targetResources.forEach((resource) => {
        if (resource?.workloadName) {
          affectedWorkloads.add(resource.workloadName);
        }
      });
    });

    return {
      total: activeRecommendations.length,
      byPriority,
      criticalAndHigh: byPriority.critical + byPriority.high,
      affectedWorkloads: affectedWorkloads.size,
    };
  }, [recommendations]);

  // Top recommendations for Option 4
  const topRecommendations = useMemo(() => {
    const activeRecommendations = recommendations.filter((rec) => {
      const status = rec?.status?.toLowerCase();
      return (
        status !== 'archived' &&
        status !== 'closed' &&
        status !== 'completed'
      );
    });

    return activeRecommendations
      .map((rec) => {
        const metadata = safeJsonParse(rec?.metadata);
        const targetResources = toArray(rec?.targetResources);
        const workloadNames = new Set();
        targetResources.forEach((resource) => {
          if (resource?.workloadName) {
            workloadNames.add(resource.workloadName);
          }
        });

        return {
          id: rec.recommendationId || rec.id,
          title: rec.title || rec.recommendationTitle || 'Untitled Recommendation',
          priority: getPriorityMeta(metadata?.priority),
          category: Array.isArray(metadata?.category)
            ? metadata.category[0]
            : metadata?.category,
          domain: metadata?.domain,
          workloadCount: workloadNames.size,
          workloadNames: Array.from(workloadNames),
          recommendation: rec,
        };
      })
      .sort((a, b) => {
        const priorityA = a.priority?.value || 0;
        const priorityB = b.priority?.value || 0;
        return priorityB - priorityA;
      })
      .slice(0, 5);
  }, [recommendations]);

  // Sampled recommendations for the overview page
  // Shows all active recommendations if 5 or fewer, otherwise shows category groups
  const sampledRecommendations = useMemo(() => {
    const activeRecommendations = recommendations.filter((rec) => {
      const status = rec?.status?.toLowerCase();
      return (
        status !== 'archived' &&
        status !== 'closed' &&
        status !== 'completed'
      );
    });

    const processRec = (rec) => {
      const metadata = safeJsonParse(rec?.metadata);
      const recommendedAction = safeJsonParse(rec?.recommendedAction);
      const action = safeJsonParse(rec?.action);
      const source = rec?.source;
      const sourceArray = Array.isArray(source) ? source : [];
      const isPlatformInsight = sourceArray.some((s) => s?.type === 'local_rule');
      const category = Array.isArray(metadata?.category) ? metadata.category[0] : metadata?.category;
      const domain = metadata?.domain;
      
      const actionType = recommendedAction && typeof recommendedAction === 'object'
        ? recommendedAction?.type
        : undefined;
      
      const libraryBlueprintId = recommendedAction && typeof recommendedAction === 'object' 
        ? recommendedAction?.blueprintId 
        : null;
      const customBlueprintId = action && typeof action === 'object' ? action?.blueprintId : null;
      const blueprintId = libraryBlueprintId || customBlueprintId;
      
      let actionLabel = 'View';
      let platformPath = null;
      
      if (actionType === 'blueprint') {
        actionLabel = blueprintId ? 'Run Blueprint' : 'Generate Blueprint';
      } else if (actionType === 'report') {
        actionLabel = 'Run Report';
      } else if (actionType === 'platform' || actionType === 'plaform') {
        actionLabel = 'Go to';
        platformPath = recommendedAction?.path || action?.path || null;
      }
      
      return {
        id: rec.recommendationId || rec.id,
        title: rec.title || rec.recommendationTitle || 'Untitled Recommendation',
        priority: getPriorityMeta(metadata?.priority),
        category,
        domain,
        isPlatformInsight,
        isCostOrCleanup: domain === 'Cost and Usage' || category === 'Resource Cleanup',
        actionLabel,
        actionType,
        platformPath,
        recommendation: rec,
      };
    };

    // Simply show all active recommendations (up to 5) sorted by priority
    return activeRecommendations
      .map(processRec)
      .sort((a, b) => (b.priority?.value || 0) - (a.priority?.value || 0))
      .slice(0, 5);
  }, [recommendations]);

  // Smart filter groups for Recommended Actions
  const smartGroups = useMemo(() => {
    const activeRecommendations = recommendations.filter((rec) => {
      const status = rec?.status?.toLowerCase();
      return (
        status !== 'archived' &&
        status !== 'closed' &&
        status !== 'completed'
      );
    });

    const calculateCount = (filter) => {
      return activeRecommendations.filter((rec) => {
        const metadata = safeJsonParse(rec?.metadata);
        const recommendedAction = safeJsonParse(rec?.recommendedAction);
        const actionType =
          recommendedAction && typeof recommendedAction === 'object'
            ? recommendedAction?.type
            : undefined;

        let matches = true;

        if (filter.priorities && filter.priorities.length > 0) {
          const priority = metadata?.priority != null ? Number(metadata.priority) : null;
          if (priority == null) {
            matches = false;
          } else {
            const priorityMeta = getPriorityMeta(priority);
            matches = matches && filter.priorities.includes(priorityMeta?.label);
          }
        }

        if (filter.domains && filter.domains.length > 0) {
          matches = matches && filter.domains.includes(metadata?.domain);
        }

        if (filter.categories && filter.categories.length > 0) {
          const recCategory = metadata?.category;
          const categoryArray = Array.isArray(recCategory)
            ? recCategory
            : recCategory
            ? [recCategory]
            : [];
          matches =
            matches &&
            categoryArray.some((cat) => filter.categories.includes(cat));
        }

        if (filter.actionType) {
          matches = matches && actionType === filter.actionType;
        }

        if (filter.excludeActionType) {
          matches = matches && actionType !== filter.excludeActionType;
        }

        if (filter.sourceType) {
          const source = rec?.source;
          const sourceArray = Array.isArray(source) ? source : [];
          const hasMatchingSource = sourceArray.some((s) => s?.type === filter.sourceType);
          matches = matches && hasMatchingSource;
        }

        return matches;
      }).length;
    };

    return [
      {
        id: 'critical-security',
        label: 'Critical Security',
        description: 'High priority security issues',
        count: calculateCount({ priorities: ['Critical'], domains: ['Security'] }),
        filter: { priorities: ['Critical'], domains: ['Security'] },
        borderColor: 'border-l-red-300',
        badgeColor: 'bg-red-100',
        badgeTextColor: 'text-red-600',
      },
      {
        id: 'cost-savings',
        label: 'Cost Savings',
        description: 'Opportunities to reduce costs',
        count: calculateCount({ domains: ['Cost and Usage'] }),
        filter: { domains: ['Cost and Usage'] },
        borderColor: 'border-l-green-300',
        badgeColor: 'bg-green-100',
        badgeTextColor: 'text-green-600',
      },
      {
        id: 'resource-cleanup',
        label: 'Resource Cleanup',
        description: 'Unused or idle resources',
        count: calculateCount({ categories: ['Resource Cleanup'] }),
        filter: { categories: ['Resource Cleanup'] },
        borderColor: 'border-l-amber-300',
        badgeColor: 'bg-amber-100',
        badgeTextColor: 'text-amber-600',
      },
      {
        id: 'compliance',
        label: 'Compliance',
        description: 'Compliance and audit items',
        count: calculateCount({ categories: ['Compliance', 'Audit Trail'] }),
        filter: { categories: ['Compliance', 'Audit Trail'] },
        borderColor: 'border-l-blue-300',
        badgeColor: 'bg-blue-100',
        badgeTextColor: 'text-blue-600',
      },
      {
        id: 'reports-to-run',
        label: 'Reports to Run',
        description: 'Platform recommendations to run reports',
        count: calculateCount({ sourceType: 'local_rule', actionType: 'report' }),
        filter: { sourceType: 'local_rule', actionType: 'report' },
        borderColor: 'border-l-cyan-300',
        badgeColor: 'bg-cyan-100',
        badgeTextColor: 'text-cyan-600',
        special: true,
      },
      {
        id: 'platform-insights',
        label: 'Platform Insights',
        description: 'Platform recommendations from CloudAgent to maximize your value',
        count: calculateCount({ sourceType: 'local_rule', excludeActionType: 'report' }),
        filter: { sourceType: 'local_rule', excludeActionType: 'report' },
        borderColor: 'border-l-purple-300',
        badgeColor: 'bg-purple-100',
        badgeTextColor: 'text-purple-600',
        special: true,
      },
    ].filter((group) => group.count > 0); // Only show groups with recommendations
  }, [recommendations]);

  // Navigation helper for recommendations with filters
  const navigateToRecommendations = (filters = {}, groupId = null) => {
    const params = new URLSearchParams();
    
    // Use group ID if provided (preferred method)
    if (groupId) {
      params.append('group', groupId);
    } else {
      // Fallback to filter-based approach
      if (filters.priorities) {
        params.append('priority', filters.priorities.join(','));
      }
      if (filters.domains) {
        params.append('domain', filters.domains.join(','));
      }
      if (filters.categories) {
        params.append('category', filters.categories.join(','));
      }
      if (filters.actionType) {
        params.append('actionType', filters.actionType);
      }
      if (filters.sourceType) {
        params.append('sourceType', filters.sourceType);
      }
    }
    
    const queryString = params.toString();
    navigate(`/dashboard/recommendations${queryString ? `?${queryString}` : ''}`);
  };

  // Get workloads count
  const workloadsCount = useMemo(() => {
    return userProfile?.workloads?.length || 0;
  }, [userProfile]);

  // Get environments count (only approved cloud environment types)
  const environmentsCount = useMemo(() => {
    const cloudEnvironments = filterCloudEnvironments(userProfile?.agentPermissionProfiles);
    return cloudEnvironments.length;
  }, [userProfile]);

  // Get permission profiles with summaries (only approved cloud environment types)
  const permissionProfiles = useMemo(() => {
    return filterCloudEnvironments(userProfile?.agentPermissionProfiles);
  }, [userProfile]);

  // Get workloads
  const workloads = useMemo(() => {
    return userProfile?.workloads || [];
  }, [userProfile]);

  // Combined list of environments and workloads with summaries
  const itemsWithSummaries = useMemo(() => {
    const environments = permissionProfiles.map((profile) => {
      const authProfile = safeJsonParse(profile.authProfile);
      const summary = parseSummary(profile.summary);
      return {
        id: profile.recordId,
        name: profile.name,
        type: 'environment',
        parsedSummary: summary,
        awsAccountId: authProfile?.awsAccountId || 'N/A',
        original: profile,
      };
    });

    const workloadItems = workloads.map((workload) => {
      const summary = parseSummary(workload.summary);
      return {
        id: workload.workloadId,
        name: workload.workloadName,
        type: 'workload',
        parsedSummary: summary,
        description: workload.description,
        original: workload,
      };
    });

    return [...environments, ...workloadItems];
  }, [permissionProfiles, workloads]);

  // Mixed list for display - ensures balance of environments and workloads
  const mixedSummariesForDisplay = useMemo(() => {
    const environments = itemsWithSummaries.filter(item => item.type === 'environment');
    const workloadItems = itemsWithSummaries.filter(item => item.type === 'workload');
    
    const maxItems = 4;
    const result = [];
    
    // If we have both, ensure at least 2 from each (if available)
    if (environments.length > 0 && workloadItems.length > 0) {
      const minFromEach = 2;
      const envsToTake = Math.min(environments.length, Math.max(minFromEach, maxItems - Math.min(workloadItems.length, minFromEach)));
      const workloadsToTake = Math.min(workloadItems.length, maxItems - envsToTake);
      
      result.push(...environments.slice(0, envsToTake));
      result.push(...workloadItems.slice(0, workloadsToTake));
    } else {
      // Only one type exists, just take up to maxItems
      result.push(...environments.slice(0, maxItems));
      result.push(...workloadItems.slice(0, maxItems));
    }
    
    return result.slice(0, maxItems);
  }, [itemsWithSummaries]);

  // State for selected item tab
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  
  // State for full-screen summary modal
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);

  // State for locally updated summaries (keyed by item id)
  const [localSummaries, setLocalSummaries] = useState({});

  // Get the current summary for the selected item (local override or original)
  const getCurrentSummary = (item) => {
    if (!item) return null;
    // Check if we have a local override
    if (localSummaries[item.id]) {
      return localSummaries[item.id];
    }
    // Fall back to the original parsed summary
    return item.parsedSummary;
  };

  // Handler for summary updates from the component
  const handleSummaryUpdate = (newSummary) => {
    const item = itemsWithSummaries[selectedItemIndex];
    if (!item) return;
    setLocalSummaries((prev) => ({
      ...prev,
      [item.id]: newSummary,
    }));
  };

  const statsData = [
    {
      title: 'Activity',
      count: stats.totalAgents,
      countSecondary: stats.totalWorkflows,
      countTertiary: stats.totalReports || 0,
      unit: 'agents',
      unitSecondary: 'workflows',
      unitTertiary: 'reports',
      linkText: 'See More',
      link: '/dashboard/agents',
      showThreeMetrics: true,
    },
  ];

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'waiting on user':
      case 'waiting':
      case 'pending':
        return 'text-orange-600 bg-orange-100';
      case 'done':
      case 'completed':
      case 'complete':
        return 'text-green-600 bg-green-100';
      case 'available':
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'paused':
      case 'inactive':
        return 'text-gray-600 bg-gray-100';
      case 'failed':
      case 'error':
        return 'text-red-600 bg-red-100';
      case 'running':
      case 'in progress':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getTypeIcon = (type) => {
    return type === 'workflow' ? (
      <Play className="w-4 h-4 text-primary-600" />
    ) : (
      <Settings className="w-4 h-4 text-primary-600" />
    );
  };

  const getScheduleIcon = () => {
    return <Clock className="w-4 h-4 text-primary-600" />;
  };

  const formatSchedule = (schedule) => {
    if (!schedule) return 'Unknown';

    switch (schedule.type) {
      case 'daily':
        return `Daily at ${schedule.time}`;
      case 'weekly':
        return `Weekly   at ${schedule.time}`;
      case 'monthly':
        return `Monthly at ${schedule.time}`;
      default:
        return 'Unknown';
    }
  };

  const handleActivityAccess = (activity) => {
    if (activity.type === 'workflow') {
      if (activity.category === 'definition') {
        navigate(`/dashboard/workflow-def/${activity.workflowId}`);
      } else {
        navigate(`/dashboard/workflow-history/${activity.workflowId}`);
      }
    } else if (activity.type === 'agent') {
      // Parse log to check if it's a custom blueprint
      const parsedLog = toLogObject(activity?.data?.log);
      const isBluePrint = parsedLog?.isBluePrint || false;
      const blueprintId = parsedLog?.blueprintId || null;
      
      navigate(`/dashboard/agent/${activity?.data?.recordId}`, {
        state: {
          isReconnecting: true,
          isBluePrint: isBluePrint,
          ...(isBluePrint && { recordId: blueprintId }),
        },
      });
    } else if (activity.type === 'report') {
      const reportRoute = buildReportRoute({
        scanId: activity.scanId || activity.data?.scanId,
        reportId: activity.reportId || activity.data?.reportId || null,
      }) || `/report/${activity.scanId || activity.data.scanId}`;
      navigate(reportRoute, {
        state: {
          isReconnecting: true,
          parentId: activity.data?.parentId,
          reportId: activity.reportId || activity.data?.reportId || null,
        },
      });
    }
  };

  const handleScheduledWorkflowAccess = (workflow) => {
    navigate(`/workflow/${workflow.workflowId}`);
  };

  const handleRefresh = () => {
    dispatch(getOverviewData());
    dispatch(refreshUserProfile());
  };

  // Handler to open chat with optional initial message
  const handleOpenChat = (initialMessage = '') => {
    setChatInputValue(initialMessage);
    setIsChatOpen(true);
  };

  // Quick actions for the top of the page
  const quickActions = [
    {
      id: 'run-report',
      label: 'Run Report',
      icon: FileBarChart,
      onClick: () => navigate(isLocalRuntime() ? '/dashboard/reports/library' : '/libraries/all-reports'),
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      id: 'discover-workloads',
      label: 'Discover Workloads',
      icon: Search,
      onClick: () => navigate('/use-cases/workload-documentation'),
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      id: 'create-diagram',
      label: 'Create Diagram',
      icon: LayoutGrid,
      onClick: () => navigate('/tools/cloud-diagrammer'),
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      id: 'create-workflow',
      label: 'Create Workflow',
      icon: GitBranch,
      onClick: () => navigate('/dashboard/workflow-def'),
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      id: 'executive-summary',
      label: 'Executive Summary',
      icon: FileText,
      onClick: () => navigate('/dashboard/cloud-setup'),
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      id: 'well-architected',
      label: 'Well-Architected Review',
      icon: CheckCircle,
      onClick: () => navigate('/dashboard/well-architected'),
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
    },
  ];


  const hasPermissions = !!stats.totalPermissionProfiles;
  const hasRunReport = !!stats.totalReports;
  const hasRunAgent = !!stats.totalAgents;
  const hasRunWorkflow = !!stats.totalWorkflows;
  const hasMCPExtension = !!userProfile?.mcpToken;

  // Check if there are workloads that don't have "PermissionProfile-" in their name
  const hasDiscoveredWorkloads = useMemo(() => {
    const workloads = userProfile?.workloads || [];
    const discoveredWorkloads = workloads.filter(
      (workload) => !workload?.workloadName?.includes('PermissionProfile-')
    );
    return discoveredWorkloads.length > 0;
  }, [userProfile]);

  const hasCompletedOnboarding = 
    hasPermissions && (hasRunReport || hasRunAgent || hasRunWorkflow || hasMCPExtension);

  if (loading && !lastFetched) {
    return (
      <div className="p-4 space-y-6 bg-gray-50 min-h-screen">
        <div className="flex justify-center items-center h-64">
          <div className="text-center flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-gray-600">Loading overview data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 bg-gray-50 min-h-screen">
      {/* <div className="bg-white border border-primary-100 rounded-[16px] p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
        <div className="flex items-center">
          <Icons.aiIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600 mr-2" />
          <span className="text-primary-800 font-medium text-sm sm:text-base">
            How can we help you today?
          </span>
        </div>
        <span className="text-primary-600 text-xs sm:text-sm">
          Coming soon!
        </span>
      </div> */}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-[16px] p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
          <div className="flex items-center">
            <div className="text-red-600 mr-2">⚠️</div>
            <span className="text-red-800 text-sm sm:text-base">
              Failed to load overview data: {error}
            </span>
          </div>
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            className="self-start sm:self-auto"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Retry</span>
          </Button>
        </div>
      )}
      {(!hasCompletedOnboarding || showOnboardingManually) && (
        <OnboardingSection
          hasPermissions={hasPermissions}
          hasRunReport={hasRunReport}
          hasRunAgent={hasRunAgent}
          hasRunWorkflow={hasRunWorkflow}
          hasMCPExtension={hasMCPExtension}
          hasDiscoveredWorkloads={hasDiscoveredWorkloads}
          onClose={showOnboardingManually ? () => setShowOnboardingManually(false) : null}
          isManuallyShown={showOnboardingManually}
          onRefresh={handleRefresh}
          userProfile={userProfile}
        />
      )}

      {/* Quick Actions - Centered at top */}
      {hasCompletedOnboarding && !showOnboardingManually && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={action.onClick}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm font-medium whitespace-nowrap border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm text-gray-700"
            >
              <div className={`p-1 rounded ${action.bgColor}`}>
                <action.icon className={`w-3.5 h-3.5 ${action.color}`} />
              </div>
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Chat Input Bar */}
      {hasCompletedOnboarding && !showOnboardingManually && (
        <div className="bg-gradient-to-r from-primary-50 via-blue-50 to-indigo-50 border border-primary-100 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg">
                <Icons.chatStar className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm hidden sm:block">Ask CloudAgent</h3>
            </div>
            <div className="flex-1 w-full">
              <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-4 py-2.5 shadow-sm focus-within:border-primary-300 focus-within:shadow-md transition-all">
                <input
                  type="text"
                  placeholder="How can I help you today?"
                  className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
                  value={chatInputValue}
                  onChange={(e) => setChatInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleOpenChat(chatInputValue);
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="rounded-lg px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white shadow-sm"
                  onClick={() => handleOpenChat(chatInputValue)}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {hasCompletedOnboarding && !showOnboardingManually && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
          {/* Left Column - Activity, Cloud Overview, Getting Started */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            {/* Activity Stats */}
            {statsData.map((stat, index) => (
              <div
                key={index}
                className="rounded-[16px] p-3 sm:p-4 shadow-sm bg-white"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base pr-2">
                    {stat.title}
                  </h3>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-primary-600 hover:text-primary-700 h-auto text-xs sm:text-sm flex-shrink-0"
                    onClick={() => {
                      if (stat.onClick) {
                        stat.onClick();
                      } else if (stat.link) {
                        navigate(stat.link);
                      }
                    }}
                  >
                    {stat.linkText}
                  </Button>
                </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col items-start">
                        <span className="text-xl sm:text-2xl font-bold text-gray-900">
                          {loading ? '...' : stat.count}
                        </span>
                        <span className="text-xs text-gray-600">
                          {stat.unit}
                        </span>
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-xl sm:text-2xl font-bold text-gray-900">
                          {loading ? '...' : stat.countSecondary}
                        </span>
                        <span className="text-xs text-gray-600">
                          {stat.unitSecondary}
                        </span>
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-xl sm:text-2xl font-bold text-gray-900">
                          {loading ? '...' : (stat.countTertiary ?? 0)}
                        </span>
                        <span className="text-xs text-gray-600">
                          {stat.unitTertiary}
                        </span>
                      </div>
                    </div>
              </div>
            ))}

            {/* Executive Summaries - Compact */}
            <div className="rounded-[16px] p-3 sm:p-4 shadow-sm bg-white">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary-600" />
                  <h3 className="font-semibold text-gray-900 text-sm">Executive Summaries</h3>
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="text-primary-600 hover:text-primary-700 h-auto text-xs flex-shrink-0 p-0"
                  onClick={() => navigate('/dashboard/cloud-setup')}
                >
                  Manage
                </Button>
              </div>
              
              <p className="text-xs text-gray-500 mb-2">
                {environmentsCount} environment{environmentsCount !== 1 ? 's' : ''} · {workloadsCount} workload{workloadsCount !== 1 ? 's' : ''}
              </p>
              
              {itemsWithSummaries.length > 0 ? (
                <div className="space-y-1.5">
                  {mixedSummariesForDisplay.map((item) => {
                    // Find the actual index in itemsWithSummaries for the modal
                    const actualIndex = itemsWithSummaries.findIndex(i => i.id === item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedItemIndex(actualIndex >= 0 ? actualIndex : 0);
                          setSummaryModalOpen(true);
                        }}
                        className="group flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-all text-left w-full"
                      >
                        <div className={`p-1 rounded flex-shrink-0 ${item.type === 'environment' ? 'bg-blue-50' : 'bg-purple-50'}`}>
                          {item.type === 'environment' ? (
                            <Cloud className="w-3 h-3 text-blue-600" />
                          ) : (
                            <Layers className="w-3 h-3 text-purple-600" />
                            )}
                          </div>
                        <p className="font-medium text-gray-900 text-xs truncate flex-1">{item.name}</p>
                        <ChevronRight className="w-3 h-3 text-gray-400 group-hover:text-primary-600 flex-shrink-0" />
                      </button>
                    );
                  })}
                  {itemsWithSummaries.length > 4 && (
                    <button
                      onClick={() => navigate('/dashboard/cloud-setup')}
                      className="text-xs text-primary-600 hover:text-primary-700 w-full text-center py-0.5"
                    >
                      +{itemsWithSummaries.length - 4} more
                    </button>
                        )}
                      </div>
              ) : (
                <div className="text-center py-3">
                  <Cloud className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                  <p className="text-xs text-gray-500 mb-2">No environments yet</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => navigate('/dashboard/cloud-setup')}
                  >
                    Add Environment
                  </Button>
                </div>
                  )}
                </div>

            {/* Compact Getting Started Card */}
            <div
              className="rounded-[16px] p-3 shadow-sm bg-blue-50 border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
              onClick={() => setShowOnboardingManually(true)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <GraduationCap className="w-4 h-4 mr-2 text-blue-600" />
                  <span className="font-medium text-gray-900 text-sm">Getting Started</span>
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="text-primary-600 hover:text-primary-700 h-auto text-xs flex-shrink-0 p-0"
                >
                  Open Guide
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column - Recommended Actions with merged stats */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl p-5 shadow-sm bg-white border border-gray-100">
              {/* Header with merged recommendation stats */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary-100 to-blue-100">
                    <Sparkles className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Recommendations
                    </h2>
                      <span className="text-2xl font-bold text-gray-900">
                        {recommendationsLoading ? '...' : recommendationStats.total}
                      </span>
                    </div>
                    {/* Priority badges */}
                    <div className="flex items-center gap-1.5 mt-1">
                      {recommendationStats.byPriority.critical > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {recommendationStats.byPriority.critical} Critical
                      </span>
                      )}
                      {recommendationStats.byPriority.high > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          {recommendationStats.byPriority.high} High
                        </span>
                      )}
                      {recommendationStats.byPriority.medium > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          {recommendationStats.byPriority.medium} Medium
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary-600 hover:text-primary-700"
                  onClick={() => navigate('/dashboard/recommendations')}
                >
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>

              {/* Recommendations List */}
              {recommendationsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-600 mr-2" />
                  <span className="text-gray-600">Loading recommendations...</span>
                </div>
              ) : recommendationStats.total === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="p-4 rounded-2xl bg-gray-100 mb-4">
                    <CheckCircle className="w-10 h-10 text-green-500" />
                  </div>
                  <h3 className="font-medium text-gray-900 mb-1">All caught up!</h3>
                  <p className="text-sm text-gray-500 max-w-sm">
                    No active recommendations at this time. Run a report to discover new insights.
                  </p>
                </div>
              ) : recommendationStats.total <= 5 ? (
                // Show individual recommendations when 5 or fewer
                <div className="space-y-1.5">
                  {sampledRecommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="group flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/dashboard/recommendations?id=${rec.id}`)}
                    >
                      {/* Subtle priority indicator */}
                      <div className={`w-1 h-8 rounded-full flex-shrink-0 ${
                        rec.priority?.label === 'Critical' ? 'bg-red-400' :
                        rec.priority?.label === 'High' ? 'bg-orange-400' :
                        rec.priority?.label === 'Medium' ? 'bg-yellow-400' :
                        'bg-gray-200'
                      }`} />

                      {/* Content - simplified */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{rec.title}</p>
                        <p className="text-xs text-gray-500 truncate">{rec.category || rec.domain}</p>
                  </div>
                      
                      {/* Subtle insight indicator */}
                      {rec.isPlatformInsight && (
                        <span className="text-purple-500 flex-shrink-0" title="Platform Insight">
                          <Sparkles className="w-3.5 h-3.5" />
                        </span>
                      )}
                      
                      {/* Action button - cleaner */}
                    <Button
                      size="sm"
                        variant="ghost"
                        className="flex-shrink-0 text-xs text-primary-600 hover:text-primary-700 hover:bg-primary-50 h-7 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (rec.platformPath) {
                            navigate(rec.platformPath);
                          } else {
                            // Navigate to recommendations page - the recommendation row click opens the action modal
                            navigate('/dashboard/recommendations', {
                              state: { 
                                openRecommendationId: rec.id,
                                openActionModal: true 
                              }
                            });
                          }
                        }}
                    >
                        {rec.actionLabel}
                        <ChevronRight className="w-3 h-3 ml-0.5" />
                    </Button>
                    </div>
                  ))}
                </div>
              ) : (
                // Show category groups when more than 5 recommendations
                <div className="space-y-1.5">
                  {smartGroups.slice(0, 5).map((group) => (
                    <button
                      key={group.id}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-gray-50 border-l-[3px] ${group.borderColor}`}
                      onClick={() => navigateToRecommendations(group.filter, group.id)}
                    >
                      <div className="text-left">
                        <p className="font-medium text-gray-900 text-sm">
                          {group.label}
                        </p>
                        <p className="text-xs text-gray-500">{group.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-xs font-semibold ${group.badgeColor} ${group.badgeTextColor}`}>
                          {group.count}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full-screen Summary Modal */}
      <ExecutiveSummaryModal
        open={summaryModalOpen}
        onOpenChange={setSummaryModalOpen}
        item={itemsWithSummaries[selectedItemIndex]?.original}
        summary={getCurrentSummary(itemsWithSummaries[selectedItemIndex])}
        onSummaryUpdate={handleSummaryUpdate}
        accountScans={reportHistory}
        recommendations={recommendations}
        type={itemsWithSummaries[selectedItemIndex]?.type}
      />

      {/* <div className="bg-white rounded-[16px] p-3 sm:p-4 lg:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2 sm:gap-0">
          <div className="flex items-center">
            <Icons.startIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600 mr-2" />
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              Recommended Actions
              <span className="text-gray-600 block text-xs sm:text-sm font-normal">
                Based on your current setup
              </span>
            </h2>
          </div>
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={loading}
            className="self-start sm:self-auto"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>

        <div className="rounded-xl border border-primary-100 overflow-hidden mt-4">
          <div className="block sm:hidden">
            {recommendedActions.map((action) => (
              <div
                key={action.id}
                className="p-3 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                    <div className="font-medium text-gray-900 text-sm mb-1">
                      {action.title}
                    </div>
                    <div className="text-gray-600 text-xs">
                      {action.category}
                    </div>
                  </div>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-primary-600 hover:text-primary-700 p-0 h-auto text-xs flex-shrink-0"
                    onClick={action.action}
                  >
                    Access <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden sm:block">
            <Table className="border-collapse">
              <TableHeader>
                <TableRow>
                  <TableHead className="font-medium text-gray-700">
                    Actions
                  </TableHead>
                  <TableHead className="font-medium text-gray-700">
                    Category
                  </TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recommendedActions.map((action) => (
                  <TableRow key={action.id}>
                    <TableCell className="font-medium text-gray-900">
                      {action.title}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {action.category}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-primary-600 hover:text-primary-700 p-0 h-auto"
                        onClick={action.action}
                      >
                        Access <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div> */}


      {hasCompletedOnboarding && !showOnboardingManually && (
        <>
          <div className="bg-white rounded-[16px] p-3 sm:p-4 lg:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2 sm:gap-0">
              <div className="flex items-center">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600 mr-2" />
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                  Scheduled Activities
                  <span className="text-gray-600 block text-xs sm:text-sm font-normal">
                    Workflows running on schedule
                  </span>
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary-600 hover:text-primary-700 h-auto self-start sm:self-auto"
                onClick={() => navigate('/dashboard/workflow-def')}
              >
                View All
              </Button>
            </div>

            <div className="mb-4 sm:mb-6 overflow-x-auto">
              <div className="flex space-x-2 min-w-max sm:min-w-0">
                {['All Activities'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveScheduledTab(tab)}
                    className={`p-2 px-3 sm:px-4 font-medium text-xs sm:text-sm rounded-[6px] hover:bg-primary-50 hover:text-primary-600 transition-colors whitespace-nowrap ${
                      activeScheduledTab === tab
                        ? 'bg-primary-50 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-primary-100 overflow-hidden mt-4">
              <div className="block lg:hidden">
                {loading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    <div className="text-sm text-gray-600">
                      Loading scheduled workflows...
                    </div>
                  </div>
                ) : filteredScheduledWorkflows.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-sm">No scheduled workflows found</div>
                  </div>
                ) : (
                  filteredScheduledWorkflows.slice(0, 10).map((workflow) => (
                    <div
                      key={workflow.id}
                      className="p-3 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center flex-1">
                          {getScheduleIcon()}
                          <span className="ml-2 font-medium text-gray-900 text-sm">
                            {workflow.name}
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${getStatusColor(workflow.status)} ml-2`}
                        >
                          • {workflow.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mb-2">
                        <div>Schedule: {formatSchedule(workflow.schedule)}</div>
                        <div>Next Run: {workflow.nextRun}</div>
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-primary-600 hover:text-primary-700 p-0 h-auto text-xs"
                        onClick={() => handleScheduledWorkflowAccess(workflow)}
                      >
                        Edit Workflow <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="hidden lg:block">
                <Table className="border-collapse">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Workflow Name</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                          Loading scheduled workflows...
                        </TableCell>
                      </TableRow>
                    ) : filteredScheduledWorkflows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-gray-500"
                        >
                          No scheduled workflows found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredScheduledWorkflows
                        .slice(0, 10)
                        .map((workflow) => (
                          <TableRow
                            key={workflow.id}
                            className="hover:bg-gray-50"
                          >
                            <TableCell>
                              <div className="flex items-center">
                                {getScheduleIcon()}
                                <span className="ml-2 font-medium text-gray-900">
                                  {workflow.name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-600">
                              {formatSchedule(workflow.schedule)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${getStatusColor(workflow.status)}`}
                              >
                                • {workflow.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="link"
                                size="sm"
                                className="text-primary-600 hover:text-primary-700 p-0 h-auto"
                                onClick={() =>
                                  handleScheduledWorkflowAccess(workflow)
                                }
                              >
                                Edit Workflow{' '}
                                <ArrowRight className="w-4 h-4 ml-1" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[16px] p-3 sm:p-4 lg:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2 sm:gap-0">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                Latest Activity
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary-600 hover:text-primary-700 h-auto self-start sm:self-auto"
                onClick={() => navigate('/dashboard/workflow-history')}
              >
                View All
              </Button>
            </div>

            <div className="mb-4 sm:mb-6 overflow-x-auto">
              <div className="flex space-x-2 min-w-max sm:min-w-0">
                {[
                  'All Activity',
                  'Workflows',
                  'Agents',
                  'Platform Insights',
                  'Waiting on User',
                  'Done',
                ].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveLatestTab(tab)}
                    className={`p-2 px-3 sm:px-4 font-medium text-xs sm:text-sm rounded-[6px] hover:bg-primary-50 hover:text-primary-600 transition-colors whitespace-nowrap ${
                      activeLatestTab === tab
                        ? 'bg-primary-50 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-primary-100 overflow-hidden mt-4">
              <div className="block sm:hidden">
                {loading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    <div className="text-sm text-gray-600">
                      Loading activities...
                    </div>
                  </div>
                ) : filteredLatestActivity.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-sm">
                      No {activeLatestTab.toLowerCase()} found
                    </div>
                    {activeLatestTab === 'All Activity' && (
                      <div className="mt-2 text-sm">
                        <Button
                          variant="link"
                          className="text-primary-600 text-xs"
                          onClick={() => navigate('/dashboard/workflow-def')}
                        >
                          Create your first workflow
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  filteredLatestActivity.slice(0, 10).map((activity) => (
                    <div
                      key={activity.id}
                      className="p-3 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center flex-1">
                          {getTypeIcon(activity.type)}
                          <span className="ml-2 font-medium text-gray-900 text-sm">
                            {activity.name}
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${getStatusColor(activity.status)} ml-2`}
                        >
                          • {activity.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mb-2">
                        {activity.date}
                      </div>
                      {activity.type === 'report' &&
                      activity.status === 'running' ? null : (
                        <Button
                          variant="link"
                          size="sm"
                          className="text-primary-600 hover:text-primary-700 p-0 h-auto text-xs"
                          onClick={() => handleActivityAccess(activity)}
                        >
                          {activity.type === 'workflow'
                            ? activity.category === 'definition'
                              ? 'Edit Workflow'
                              : 'View Details'
                            : activity.type === 'report'
                              ? 'View Report'
                              : 'Connect to Agent'}{' '}
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="hidden sm:block">
                <Table className="border-collapse">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                          Loading activities...
                        </TableCell>
                      </TableRow>
                    ) : filteredLatestActivity.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center py-8 text-gray-500"
                        >
                          No {activeLatestTab.toLowerCase()} found
                          {activeLatestTab === 'All Activity' && (
                            <div className="mt-2 text-sm">
                              <Button
                                variant="link"
                                className="text-primary-600"
                                onClick={() =>
                                  navigate('/dashboard/workflow-def')
                                }
                              >
                                Create your first workflow
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLatestActivity.slice(0, 10).map((activity) => (
                        <TableRow
                          key={activity.id}
                          className="hover:bg-gray-50"
                        >
                          <TableCell>
                            <div className="flex items-center">
                              {getTypeIcon(activity.type)}
                              <span className="ml-2 font-medium text-gray-900">
                                {activity.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {activity.date}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${getStatusColor(activity.status)}`}
                            >
                              • {activity.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {activity.type === 'report' &&
                            activity.status === 'running' ? null : (
                              <Button
                                variant="link"
                                size="sm"
                                className="text-primary-600 hover:text-primary-700 p-0 h-auto"
                                onClick={() => handleActivityAccess(activity)}
                              >
                                {activity.type === 'workflow'
                                  ? activity.category === 'definition'
                                    ? 'Edit Workflow'
                                    : 'View Details'
                                  : activity.type === 'report'
                                    ? 'View Report'
                                    : 'Connect to Agent'}{' '}
                                <ArrowRight className="w-4 h-4 ml-1" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Chat Modal */}
      {isChatOpen && (
        <HelpChatModal 
          onClose={() => {
            setIsChatOpen(false);
            setChatInputValue('');
          }}
          initialMessage={chatInputValue}
        />
      )}
    </div>
  );
};

export default Overview;
