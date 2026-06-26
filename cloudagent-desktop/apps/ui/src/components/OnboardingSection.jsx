import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  CheckCircle,
  Cloud,
  Layers,
  FileBarChart,
  Sparkles,
  GitBranch,
  RefreshCw,
  X,
  ArrowRight,
  Shield,
  Plug,
  ExternalLink,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { PermissionsModal } from '../pages/Libraries/PermissionsModal';
import { getPersonalizedConfig } from '../helpers/onboardingIntentConfig';
import DiscoverWorkloadsModal from './DiscoverWorkloadsModal';
import { analytics, ANALYTICS_EVENTS, getAnalyticsRoute } from '@/hooks/useAnalytics';
import { IS_PUBLIC_SITE } from '@/config/appConfig';

const OnboardingSection = ({ 
  hasPermissions, 
  hasRunReport, 
  hasRunAgent, 
  hasRunWorkflow,
  hasMCPExtension,
  hasDiscoveredWorkloads,
  onClose,
  isManuallyShown,
  onRefresh,
  userProfile
}) => {
  const navigate = useNavigate();
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [isDiscoverWorkloadsOpen, setIsDiscoverWorkloadsOpen] = useState(false);
  const trackedSetupGuideVideoEventsRef = useRef(new Set());
  const [permissionsState, setPermissionsState] = useState({
    accountId: '',
    authProfile: {
      roleName: 'CloudAgentAccess',
      externalId: '',
      validated: false,
    },
  });

  // Helper to navigate and close the modal
  const navigateAndClose = useCallback((path) => {
    if (onClose) onClose();
    navigate(path);
  }, [onClose, navigate]);

  // Get personalized config based on survey intent
  const intentConfig = useMemo(() => getPersonalizedConfig(), []);

  const trackSetupGuideVideoEvent = useCallback((video, interactionType, { allowRepeat = false } = {}) => {
    const dedupeKey = `${video.id}:${interactionType}`;
    if (!allowRepeat && trackedSetupGuideVideoEventsRef.current.has(dedupeKey)) {
      return;
    }
    if (!allowRepeat) {
      trackedSetupGuideVideoEventsRef.current.add(dedupeKey);
    }

    analytics.track(ANALYTICS_EVENTS.MARKETING_VIDEO_INTERACTED, {
      video_id: video.youtubeId,
      video_title: video.title,
      video_provider: 'youtube',
      video_surface: 'setup_guide',
      interaction_type: interactionType,
      route: getAnalyticsRoute(),
    });
  }, []);

  const setupGuideVideos = [
    {
      id: 'cloudagent-demo',
      youtubeId: 'YhsfbwyxuK0',
      title: 'CloudAgent Demo',
      href: 'https://youtu.be/YhsfbwyxuK0',
      thumbnail: 'https://i.ytimg.com/vi/YhsfbwyxuK0/hqdefault.jpg',
    },
    {
      id: 'document-applications',
      youtubeId: 'vF6Sh9KvbXE',
      title: 'How to document your applications',
      href: 'https://youtu.be/vF6Sh9KvbXE',
      thumbnail: 'https://i.ytimg.com/vi/vF6Sh9KvbXE/hqdefault.jpg',
    },
  ];

  // Featured cards with expanded explanations
  const featuredTasks = [
    {
      id: 'permission',
      title: 'Connect Your Cloud',
      subtitle: 'Required to get started',
      description: 'Link your AWS account so CloudAgent can run reports, review resources, and help you manage your infrastructure.',
      trust: 'We request read-only access by default. Write access is only requested when needed for specific actions.',
      icon: Cloud,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      buttonText: 'Connect AWS Account',
      onClick: () => setIsPermissionsOpen(true),
      completed: hasPermissions,
      hasCheckbox: true,
    },
    {
      id: 'workloads',
      title: 'Create or Import Workloads',
      subtitle: 'Organize your cloud resources',
      description: 'Workloads are groups of related resources (like an app and its database). Use them to track changes, generate diagrams, and build documentation.',
      icon: Layers,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      buttonText: 'Discover Workloads',
      onClick: () => setIsDiscoverWorkloadsOpen(true),
      completed: hasDiscoveredWorkloads,
      hasCheckbox: true,
      disabled: !hasPermissions,
      disabledReason: 'Connect a cloud environment first',
    },
  ];

  // Quick action tasks
  const quickTasks = [
    {
      id: 'agent',
      title: 'Run an Agent',
      description: 'Automate a task like setting up budgets or security controls',
      icon: Sparkles,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      buttonText: 'Browse Agents',
      onClick: () => navigateAndClose(IS_PUBLIC_SITE ? '/libraries/cost_and_billing' : '/dashboard/blueprints/library'),
      completed: hasRunAgent,
      hasCheckbox: true,
      suggestions: [
        { name: 'Create Cost Budget', onClick: () => navigateAndClose(IS_PUBLIC_SITE ? '/library/blueprint/cost_budget_sns' : '/dashboard/blueprints/library') },
        { name: 'Root Account Security', onClick: () => navigateAndClose(IS_PUBLIC_SITE ? '/library/blueprint/root_account_security' : '/dashboard/blueprints/library') },
      ]
    },
    {
      id: 'workflow',
      title: 'Create a Workflow',
      description: 'Chain multiple actions together, run on schedule',
      icon: GitBranch,
      iconBg: 'bg-pink-100',
      iconColor: 'text-pink-600',
      buttonText: 'Create Workflow',
      onClick: () => navigateAndClose('/dashboard/workflow-def'),
      completed: hasRunWorkflow,
      hasCheckbox: true,
    },
  ];

  // Reorder tasks based on intent if available
  const orderedFeaturedTasks = useMemo(() => {
    if (!intentConfig?.taskOrder) return featuredTasks;
    const allTasks = [...featuredTasks, ...quickTasks];
    const taskMap = {};
    allTasks.forEach((t) => (taskMap[t.id] = t));

    const featured = [];
    intentConfig.taskOrder.forEach((id) => {
      if (taskMap[id] && featuredTasks.find((t) => t.id === id)) {
        featured.push(taskMap[id]);
      }
    });
    // Add any remaining featured tasks not in taskOrder
    featuredTasks.forEach((t) => {
      if (!featured.find((f) => f.id === t.id)) featured.push(t);
    });
    return featured;
  }, [intentConfig, featuredTasks, quickTasks]);

  const orderedQuickTasks = useMemo(() => {
    if (!intentConfig?.taskOrder) return quickTasks;

    // Update suggestions based on intent
    const updatedTasks = quickTasks.map((task) => {
      if (intentConfig.highlightedSuggestions && task.id === 'report') {
        const intentSuggestions = intentConfig.highlightedSuggestions
          .filter((s) => s.path.includes('report'))
          .map((s) => ({ name: s.name, onClick: () => navigateAndClose(s.path) }));
        if (intentSuggestions.length > 0) {
          return { ...task, suggestions: intentSuggestions };
        }
      }
      return task;
    });

    const taskMap = {};
    updatedTasks.forEach((t) => (taskMap[t.id] = t));

    const ordered = [];
    intentConfig.taskOrder.forEach((id) => {
      if (taskMap[id]) ordered.push(taskMap[id]);
    });
    // Add any remaining quick tasks not in taskOrder
    updatedTasks.forEach((t) => {
      if (!ordered.find((o) => o.id === t.id)) ordered.push(t);
    });
    return ordered;
  }, [intentConfig, quickTasks, navigateAndClose]);

  // Info-only cards (no checkbox)
  const infoCards = [
    {
      id: 'mcp',
      title: 'Use CloudAgent from Your Tools',
      description: 'Access CloudAgent from IDEs like Cursor, or chatbots like ChatGPT and Claude using MCP.',
      icon: Plug,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-600',
      buttonText: 'Learn More',
      onClick: () => navigateAndClose('/dashboard/mcp'),
    },
    {
      id: 'security',
      title: 'Configure Security Preferences',
      description: 'Set up approval workflows, deployment controls, and access policies.',
      icon: Shield,
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
      buttonText: 'Go to Settings',
      onClick: () => navigateAndClose('/dashboard/cloud-setup'),
    },
  ];

  const FeaturedCard = ({ task }) => {
    // Compact version for completed tasks
    if (task.completed) {
      return (
        <div className="rounded-lg px-4 py-2.5 border border-green-200 bg-green-50/50 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <span className="font-medium text-sm text-green-700">{task.title}</span>
          <span className="text-xs text-green-600 ml-auto">Done</span>
        </div>
      );
    }

    return (
      <div className="rounded-xl p-5 border-2 border-gray-200 bg-white hover:border-primary-200 hover:shadow-md transition-all duration-200">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${task.iconBg} flex-shrink-0`}>
            <task.icon className={`w-6 h-6 ${task.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-gray-900 mb-1">
              {task.title}
            </h3>
            {task.subtitle && (
              <p className="text-xs font-medium text-primary-600 mb-2">{task.subtitle}</p>
            )}
            <p className="text-sm text-gray-600 mb-3">
              {task.description}
            </p>
            {task.trust && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                {task.trust}
              </p>
            )}
            <div className="mt-1">
              <Button
                onClick={task.onClick}
                size="sm"
                disabled={task.disabled}
              >
                {task.buttonText}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              {task.disabled && task.disabledReason && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5" />
                  {task.disabledReason}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const QuickTaskCard = ({ task }) => {
    // Compact version for completed tasks
    if (task.completed) {
      return (
        <div className="rounded-lg px-3 py-2 border border-green-200 bg-green-50/50 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span className="font-medium text-xs text-green-700">{task.title}</span>
        </div>
      );
    }

    return (
      <div className="rounded-xl p-4 border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all duration-200">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${task.iconBg} flex-shrink-0`}>
            <task.icon className={`w-5 h-5 ${task.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm text-gray-900 mb-0.5">
              {task.title}
            </h4>
            <p className="text-xs text-gray-500 mb-2">
              {task.description}
            </p>
            {task.suggestions && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {task.suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={suggestion.onClick}
                    className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800 transition-colors"
                  >
                    {suggestion.name}
                  </button>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={task.onClick}
              className="text-xs h-7"
            >
              {task.buttonText}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const InfoCard = ({ task }) => (
    <div className="rounded-xl p-4 border border-gray-200 bg-gradient-to-br from-gray-50 to-white hover:border-gray-300 hover:shadow-sm transition-all duration-200">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${task.iconBg} flex-shrink-0`}>
          <task.icon className={`w-5 h-5 ${task.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-gray-900 mb-0.5">
            {task.title}
          </h4>
          <p className="text-xs text-gray-500 mb-2">
            {task.description}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={task.onClick}
            className="text-xs h-7 px-2 text-primary-600 hover:text-primary-700 p-0"
          >
            {task.buttonText}
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );

  const completedCount = [
    hasPermissions,
    hasDiscoveredWorkloads,
    hasRunReport,
    hasRunAgent,
    hasRunWorkflow
  ].filter(Boolean).length;
  const totalTasks = 5;

  const containerClasses = isManuallyShown
    ? "bg-gradient-to-br from-slate-50 via-blue-50/30 to-white p-6 sm:p-8 relative"
    : "bg-gradient-to-br from-slate-50 via-blue-50/30 to-white rounded-2xl p-6 sm:p-8 mb-6 border border-slate-200 relative";

  return (
    <div className={containerClasses}>
      {/* Header controls */}
      {(onRefresh || (isManuallyShown && onClose)) && (
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="text-xs h-8 px-2 text-gray-600 hover:text-gray-800"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
          {isManuallyShown && onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 h-8 w-8"
              title="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
          {isManuallyShown
            ? 'Getting Started'
            : intentConfig?.welcomeMessage || 'Welcome to CloudAgent'}
        </h2>
        <p className="text-gray-600">
          Complete these steps to start managing your cloud environment
        </p>
        {/* Progress indicator */}
        <div className="flex items-center gap-3 mt-4">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / totalTasks) * 100}%` }}
            />
          </div>
          <span className="text-sm font-medium text-gray-600">
            {completedCount}/{totalTasks}
          </span>
        </div>
      </div>

      {isManuallyShown && (
        <div className="mb-6">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Watch to get started
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl">
            {setupGuideVideos.map((video) => (
              <a
                key={video.id}
                href={video.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all"
                onMouseEnter={() => trackSetupGuideVideoEvent(video, 'hover')}
                onFocus={() => trackSetupGuideVideoEvent(video, 'focus')}
                onClick={() => trackSetupGuideVideoEvent(video, 'click', { allowRepeat: true })}
              >
                <div className="relative aspect-[16/9] bg-gray-100 overflow-hidden">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full bg-white/90 p-2.5 shadow-lg">
                      <Play className="h-4 w-4 text-red-600 ml-0.5" fill="currentColor" />
                    </div>
                  </div>
                  <span className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                    Watch video
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 p-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                      {video.title}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Open on YouTube
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-primary-500 transition-colors flex-shrink-0" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Incomplete Featured Tasks */}
      {orderedFeaturedTasks.some(t => !t.completed) && (
        <div className="space-y-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Essential Setup</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {orderedFeaturedTasks.filter(t => !t.completed).map((task) => (
              <FeaturedCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {/* Incomplete Quick Tasks */}
      {orderedQuickTasks.some(t => !t.completed) && (
        <div className="space-y-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Try These Next</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {orderedQuickTasks.filter(t => !t.completed).map((task) => (
              <QuickTaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {/* Completed Tasks - Compact section */}
      {(orderedFeaturedTasks.some(t => t.completed) || orderedQuickTasks.some(t => t.completed)) && (
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Completed
          </h3>
          <div className="flex flex-wrap gap-2">
            {orderedFeaturedTasks.filter(t => t.completed).map((task) => (
              <FeaturedCard key={task.id} task={task} />
            ))}
            {orderedQuickTasks.filter(t => t.completed).map((task) => (
              <QuickTaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {/* Info Cards */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Good to Know</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {infoCards.map((task) => (
            <InfoCard key={task.id} task={task} />
          ))}
        </div>
      </div>

      {/* Permissions Modal */}
      {isPermissionsOpen && (
        <PermissionsModal
          isOpen={isPermissionsOpen}
          state={permissionsState}
          setState={setPermissionsState}
          onCancel={() => setIsPermissionsOpen(false)}
          onOpenChange={() => setIsPermissionsOpen(false)}
          isDashboard={true}
        />
      )}

      {/* Discover Workloads Modal */}
      <DiscoverWorkloadsModal
        isOpen={isDiscoverWorkloadsOpen}
        onClose={() => setIsDiscoverWorkloadsOpen(false)}
        userProfile={userProfile}
      />
    </div>
  );
};

export default OnboardingSection;
