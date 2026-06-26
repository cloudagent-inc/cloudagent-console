import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation, Link as RouterLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Settings,
  Cloud,
  Link,
  Box,
  Workflow,
  Bot,
  PanelLeftClose,
  PanelLeft,
  Plug,
  DollarSign,
  HeartPulse,
  ShieldAlert,
  Gauge,
  ChevronDown,
  ChevronRight,
  User,
  Presentation,
} from 'lucide-react';
import { Icons } from '../icons';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import WorkspaceSelector from '../WorkspaceSelector';
import { selectWorkspaces } from '@/features/workspace/workspaceSlice';
import { hasRuntimeCapability, isLocalRuntime } from '@/runtime/cloudAgentRuntime';

const SIDEBAR_COLLAPSED_KEY = 'dashboard-sidebar-collapsed';
const DEFAULT_EXPANDED_GROUPS = {
  workloads: true,
  dashboards: true,
  insights: true,
  automation: true,
  setup: true,
};

const DEFAULT_NAV_GROUPS = [
  {
    id: 'command-center',
    name: 'CloudAgent',
    icon: Icons.chatStar,
    path: '/dashboard/cloudagent',
    isStandalone: true,
  },
  {
    id: 'workloads',
    name: 'Workloads',
    icon: Box,
    children: [
      {
        id: 'workloads-list',
        name: 'Workloads',
        path: '/dashboard/workloads',
        icon: Box,
      },
      {
        id: 'deployment-settings',
        name: 'Deployment Settings',
        path: '/dashboard/deployment-settings',
        icon: Settings,
      },
    ],
  },
  {
    id: 'dashboards',
    name: 'Dashboards',
    icon: Gauge,
    children: [
      {
        id: 'cost-dashboard',
        name: 'Cost',
        path: '/dashboard/cost',
        icon: DollarSign,
      },
      {
        id: 'health-dashboard',
        name: 'Health',
        path: '/dashboard/health',
        icon: HeartPulse,
      },
      {
        id: 'threat-dashboard',
        name: 'Threat Management',
        path: '/dashboard/threat',
        icon: ShieldAlert,
      },
      {
        name: 'Executive Summaries',
        path: '/dashboard/executive-summaries',
        icon: Presentation,
      },
      // {
      //   id: 'all-dashboards',
      //   name: 'View All',
      //   path: '#all-dashboards',
      //   icon: Gauge,
      //   comingSoon: true,
      // },
    ],
  },
  {
    id: 'automation',
    name: 'Agents & Workflows',
    icon: Workflow,
    children: [
      {
        name: 'My Workflows',
        path: '/dashboard/workflow-def',
        icon: Workflow,
      },
      {
        name: 'Blueprints & Agents',
        path: '/dashboard/blueprints',
        icon: Bot,
      },
    ],
  },
  {
    id: 'setup',
    name: 'Setup',
    icon: Settings,
    children: [
      {
        name: 'Cloud Setup',
        path: '/dashboard/cloud-setup',
        icon: Cloud,
      },
      {
        name: 'Preferences',
        path: '/dashboard/preferences',
        icon: User,
      },
      {
        name: 'Integrations',
        path: '/dashboard/integrations',
        icon: Link,
      },
      {
        name: 'MCP Extension',
        path: '/dashboard/mcp',
        icon: Plug,
      },
    ],
  },
];

const NAV_CAPABILITY_BY_ID = {
  'command-center': 'commandCenter',
};

const NAV_CAPABILITY_BY_PATH = {
  '/dashboard/cost': 'cost',
  '/dashboard/health': 'health',
  '/dashboard/threat': 'threat',
  '/dashboard/workflow-def': 'automation',
  '/dashboard/blueprints': 'blueprints',
  '/dashboard/executive-summaries': 'executiveSummaries',
  '/dashboard/integrations': 'integrations',
  '/dashboard/mcp': 'mcp',
};

const getNavCapability = (item) =>
  item?.capability || NAV_CAPABILITY_BY_ID[item?.id] || NAV_CAPABILITY_BY_PATH[item?.path];

const isNavItemEnabled = (item) => {
  const capability = getNavCapability(item);
  return !capability || hasRuntimeCapability(capability);
};

const filterNavGroupsByRuntime = (groups) =>
  groups
    .map((group) => {
      if (group.isStandalone) {
        return isNavItemEnabled(group) ? group : null;
      }

      const children = (group.children || []).filter(isNavItemEnabled);
      return children.length ? { ...group, children } : null;
    })
    .filter(Boolean);

function matchesNavPath(pathname, item) {
  const matchPaths =
    Array.isArray(item.matchPaths) && item.matchPaths.length > 0
      ? item.matchPaths
      : [item.path];

  return matchPaths.some(
    (path) => pathname === path || pathname.startsWith(path + '/')
  );
}

function NavItem({ item, isCollapsed, isActive }) {
  const Icon = item.icon;

  // Coming soon items - disabled style
  if (item.comingSoon) {
    const comingSoonContent = (
      <div
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-gray-400 cursor-not-allowed ${
          isCollapsed ? 'justify-center' : ''
        }`}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        {!isCollapsed && (
          <>
            <span className="truncate">{item.name}</span>
            <span className="ml-auto text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
              Soon
            </span>
          </>
        )}
      </div>
    );

    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{comingSoonContent}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {item.name} - Coming Soon
        </TooltipContent>
      </Tooltip>
    );
  }

  const content = (
    <NavLink
      to={item.path}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
        isActive
          ? 'bg-primary-100 text-primary-600 font-medium'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      } ${isCollapsed ? 'justify-center' : ''}`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!isCollapsed && <span className="truncate">{item.name}</span>}
    </NavLink>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {item.name}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

function NavGroup({ group, isCollapsed, location, isExpanded, onToggle }) {
  const Icon = group.icon;

  // Check if any child is active
  const isChildActive = group.children?.some((child) =>
    matchesNavPath(location.pathname, child)
  );

  // For standalone items (no children)
  if (group.isStandalone) {
    const isActive = matchesNavPath(location.pathname, group);

    return (
      <NavItem
        item={group}
        isCollapsed={isCollapsed}
        isActive={isActive}
      />
    );
  }

  // For groups with children
  if (isCollapsed) {
    // When collapsed, show children as individual tooltip items
    return (
      <div className="space-y-0.5">
        {group.children.map((child) => {
          const isActive = !child.comingSoon && matchesNavPath(location.pathname, child);
          return (
            <NavItem
              key={child.id || child.path}
              item={child}
              isCollapsed={isCollapsed}
              isActive={isActive}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-[13px] text-gray-400 hover:bg-gray-50 rounded-md ${
          isChildActive ? 'text-primary-500' : ''
        }`}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 text-left font-medium truncate text-[11px] uppercase tracking-wide">
          {group.name}
        </span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
        )}
      </button>
      {isExpanded && (
        <div className="ml-3 space-y-0.5 border-l border-gray-200 pl-2">
          {group.children.map((child) => {
            const isActive = !child.comingSoon && matchesNavPath(location.pathname, child);
            return (
              <NavItem
                key={child.id || child.path}
                item={child}
                isCollapsed={false}
                isActive={isActive}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DashboardSidebar() {
  const location = useLocation();
  const { userProfile } = useSelector((state) => state.auth);
  const workspaces = useSelector(selectWorkspaces);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === 'true';
  });
  const [expandedGroups, setExpandedGroups] = useState(DEFAULT_EXPANDED_GROUPS);

  const workflowHistoryCount = Array.isArray(userProfile?.workflowHistory)
    ? userProfile.workflowHistory.length
    : 0;
  const agentHistoryCount = Array.isArray(userProfile?.agentHistory)
    ? userProfile.agentHistory.filter((entry) => {
        const agentType = (entry?.agentType || '').toLowerCase();
        return agentType !== 'report' && agentType !== 'assessment';
      }).length
    : 0;
  const navGroups = useMemo(
    () =>
      filterNavGroupsByRuntime(DEFAULT_NAV_GROUPS).map((group) => {
        if (group.id !== 'automation') {
          return group;
        }

        return {
          ...group,
          children: [
            {
              ...group.children[0],
              path:
                workflowHistoryCount > 0
                  ? '/dashboard/workflow-history'
                  : '/dashboard/workflow-def',
              matchPaths: ['/dashboard/workflow-def', '/dashboard/workflow-def/library', '/dashboard/workflow-history'],
            },
            {
              ...group.children[1],
              path:
                agentHistoryCount > 0
                  ? '/dashboard/agents'
                  : '/dashboard/blueprints',
              matchPaths: [
                '/dashboard/blueprints',
                '/dashboard/blueprints/library',
                '/dashboard/agents',
              ],
            },
          ],
        };
      }),
    [agentHistoryCount, workflowHistoryCount]
  );

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, isCollapsed);
  }, [isCollapsed]);

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const homePath = isLocalRuntime() ? '/dashboard/cloudagent' : '/';

  return (
    <TooltipProvider>
      <aside
        className={`bg-white border-r border-gray-200 flex flex-col h-full ${
          isCollapsed ? 'w-14' : 'w-52'
        }`}
      >
        {/* Logo Header */}
        <div className={`h-12 border-b border-gray-200 flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'}`}>
          <RouterLink to={homePath} className="flex items-center" aria-label="CloudAgent Home">
            {isCollapsed ? (
              <Icons.logomark className="h-6 w-6" />
            ) : (
              <Icons.logo className="h-6" />
            )}
          </RouterLink>
        </div>

        {/* Workspace Selector - only shown when workspaces exist */}
        {workspaces.length > 0 && (
          <div className="border-b border-gray-200 px-2 py-2">
            <WorkspaceSelector isCollapsed={isCollapsed} />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {navGroups.map((group) => (
            <NavGroup
              key={group.id}
              group={group}
              isCollapsed={isCollapsed}
              location={location}
              isExpanded={expandedGroups[group.id] ?? false}
              onToggle={() => toggleGroup(group.id)}
            />
          ))}
        </nav>

        {/* Toggle section at bottom */}
        <div className="border-t border-gray-200">
          {/* Toggle button */}
          <div className={`px-2 py-2 ${isCollapsed ? 'flex justify-center' : ''}`}>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className={`flex items-center gap-2 p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 ${
                    isCollapsed ? '' : 'w-full'
                  }`}
                >
                  {isCollapsed ? (
                    <PanelLeft className="h-4 w-4" />
                  ) : (
                    <>
                      <PanelLeftClose className="h-4 w-4" />
                      <span className="text-[12px]">Hide menu</span>
                    </>
                  )}
                </button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right" sideOffset={10}>
                  Show menu
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
