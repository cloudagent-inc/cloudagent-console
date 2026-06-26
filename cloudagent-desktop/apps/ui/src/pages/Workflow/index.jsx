import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import ReactFlow, {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Controls,
  Handle,
  Background,
  useReactFlow,
  MarkerType,
  addEdge,
  useNodes,
} from 'reactflow';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Terminal, // Icon for CloudTask
  MessageSquare,
  UserCheck,
  PlayCircle,
  StopCircle,
  GitBranch,
  Trash2,
  List,
  X,
  Save,
  Copy,
  FileText, // Icon for ReportTask
  Edit2,
  Clock,
  Calendar,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  Wand2,
  Loader2,
  ChevronLeft,
  ChevronDown,
  Play,
  Plus,
  Settings,
  Search,
  CheckCircle2,
  Circle,
  MessageCircle,
  HelpCircle,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  ChevronRight,
  Layers,
  CheckSquare,
  Maximize2,
} from 'lucide-react';
import get from 'lodash.get';
import dagre from 'dagre';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import 'reactflow/dist/style.css';
import {
  createWorkflow,
  updateWorkflow,
} from '../../features/workflow/workflowSlice';
import { analytics, ANALYTICS_EVENTS, getAnalyticsRoute } from '../../hooks/useAnalytics';
import toast from 'react-hot-toast';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { generateClient } from 'aws-amplify/api';
import { Button } from '../../components/ui/button';
import { Icons } from '../../components/icons';
import { SettingsSummary } from '../Agent/Agent';
import { runWorkflow } from '../../api/apigw';
import { refreshUserCredits } from '../../features/agent/agentSlice';
import QuickRunWorkflowModal from '../../components/workflows/QuickRunWorkflowModal';
import {
  getBlueprintQuery,
  getBlueprintsQuery,
} from '../../api/eventQueries';
import { WORKFLOW_API_ENDPOINT, IS_PUBLIC_SITE } from '../../config/appConfig';
import { fetchAgentList } from '@/helpers/agentList';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';
import { getLocalAwsCredentialIssueMessage } from '@/features/workspace/credentialStatus';

import { getRegionOptions } from '../../helpers/shared';

const NODE_TYPES = {
  CLOUD_TASK: 'cloudTask', // Represents general/build tasks
  REPORT_TASK: 'reportTask', // New type for report-specific tasks
  COMMUNICATION: 'communication',
  DECISION: 'decision',
  APPROVAL: 'approval',
  START: 'startNode',
  END: 'endNode',
};

// REMOVED CLOUD_TASK_TYPES constant as it's no longer needed.

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /mac/i.test(navigator.platform || navigator.userAgent || '');

// Layout Constants (Unchanged)
const NODE_WIDTH = 250;
const NODE_HEIGHT = 150;
const VERTICAL_SPACING = 80;
const HORIZONTAL_SPACING = 150;
const START_X = 200;
const START_Y = 50;
const MAX_ENVIRONMENTS_PER_NODE = 30;

// --- Styles and Icons (Added ReportTask) ---
export const nodeStyles = {
  [NODE_TYPES.CLOUD_TASK]: { background: '#E3F2FD', border: '#42A5F5' }, // Blue for general cloud tasks
  [NODE_TYPES.REPORT_TASK]: { background: '#DCEDC8', border: '#AED581' },
  [NODE_TYPES.COMMUNICATION]: { background: '#FFE0B2', border: '#FFB74D' },
  [NODE_TYPES.APPROVAL]: { background: '#E8F5E9', border: '#81C784' },
  [NODE_TYPES.START]: { background: '#BBDEFB', border: '#1E88E5' },
  [NODE_TYPES.END]: { background: '#FFCDD2', border: '#E53935' },
  [NODE_TYPES.DECISION]: { background: '#EDE7F6', border: '#9575CD' },
};
const nodeIcons = {
  [NODE_TYPES.CLOUD_TASK]: Terminal, // General tasks use Terminal
  [NODE_TYPES.REPORT_TASK]: FileText, // Report tasks use FileText
  [NODE_TYPES.COMMUNICATION]: MessageSquare,
  [NODE_TYPES.APPROVAL]: UserCheck,
  [NODE_TYPES.START]: PlayCircle,
  [NODE_TYPES.END]: StopCircle,
  [NODE_TYPES.DECISION]: GitBranch,
};
// REMOVED cloudTaskReport icon key

const baseNodeStyle = {
  borderRadius: 8,
  padding: 12,
  fontSize: 13,
  width: NODE_WIDTH, // Fixed width
  minHeight: Math.round((NODE_HEIGHT - 30) * 0.7), // 30% smaller
  maxHeight: Math.round((NODE_HEIGHT + 50) * 0.7), // 30% smaller
  textAlign: 'left',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  wordWrap: 'break-word',
  overflowWrap: 'break-word',
  whiteSpace: 'normal',
  overflow: 'hidden', // Crop content that exceeds max height
};

// Compact style for Start/End nodes - smaller and simpler
const compactNodeStyle = {
  borderRadius: 8,
  padding: 10,
  fontSize: 12,
  width: 120, // Much smaller width for start/end
  minHeight: 60,
  textAlign: 'center',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  wordWrap: 'break-word',
  overflowWrap: 'break-word',
  whiteSpace: 'normal',
  overflow: 'hidden',
};

// Helper function to create consistent node titles with proper wrapping
const createNodeTitle = (Icon, data) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: 8,
        position: 'relative',
      }}
    >
      {/* Large icon centered */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 6,
        }}
      >
        <Icon size={24} style={{ color: '#666' }} />
      </div>

      {/* Title below icon */}
      <div
        style={{
          textAlign: 'center',
          width: '100%',
        }}
      >
        <span
          style={{
            fontWeight: 'bold',
            fontSize: 13,
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            lineHeight: '1.3',
            display: 'block',
          }}
        >
          {data.name}
        </span>
      </div>

      {/* Delete button positioned absolutely */}
      {data.onDelete && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
          }}
        >
          <Trash2
            size={18}
            style={{
              cursor: 'pointer',
              color: '#e53935',
            }}
            title="Delete Node"
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.();
            }}
          />
        </div>
      )}
    </div>
  );
};
const sidePanelStyle = {
  width: '400px',
  borderLeft: '1px solid #ccc',
  padding: '20px',
  overflowY: 'auto',
  height: 'calc(100vh - 50px)', // Base height, adjusted dynamically
  background: '#fdfdfd',
};

// --- Utility Functions (Unchanged logic, just ensuring usage is correct) ---
const ensureInputFromArray = (inputFrom) => {
  if (!inputFrom) return [];
  if (Array.isArray(inputFrom)) return inputFrom;
  return [String(inputFrom)];
};
const ensureLogicArray = (logic) => {
  if (!logic) return [];
  if (Array.isArray(logic)) return logic;
  if (typeof logic === 'string')
    return logic
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  return [];
};

const graphQlClient = generateClient();

const safeParseJSON = (value, fallback = null) => {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const parsePermissionProfileAuth = (profile) => {
  if (!profile) return {};
  try {
    if (typeof profile.authProfile === 'string') {
      return JSON.parse(profile.authProfile);
    }
    return profile.authProfile || {};
  } catch {
    return {};
  }
};

const normalizePermissionProfileType = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ');

const getPermissionProfileType = (profile) => {
  const authProfile = parsePermissionProfileAuth(profile);
  const explicitType = normalizePermissionProfileType(
    profile?.type || profile?.profileType || profile?.environmentType
  );

  if (explicitType) return explicitType;
  if (authProfile?.provider === 'azure') {
    return authProfile?.subscriptionId ? 'azure subscription' : 'azure tenant';
  }
  if (authProfile?.provider === 'google_workspace') return 'google workspace';
  if (authProfile?.awsAccountId || authProfile?.accountId) return 'aws account';
  return '';
};

const isAwsAccountPermissionProfile = (profile) => {
  const normalizedType = getPermissionProfileType(profile);

  if (normalizedType === 'aws org') return false;
  if (normalizedType === 'aws account') return true;

  // Keep legacy account-style profiles that do not yet carry an explicit type.
  const authProfile = parsePermissionProfileAuth(profile);
  return !normalizedType && Boolean(authProfile?.awsAccountId);
};

const isAzureTenantPermissionProfile = (profile) => {
  return getPermissionProfileType(profile) === 'azure tenant';
};

const isAzureSubscriptionPermissionProfile = (profile) => {
  return getPermissionProfileType(profile) === 'azure subscription';
};

const isGoogleWorkspacePermissionProfile = (profile) => {
  return getPermissionProfileType(profile) === 'google workspace';
};

const getPermissionProfileValue = (profile) => {
  const authProfile = parsePermissionProfileAuth(profile);
  if (isAwsAccountPermissionProfile(profile)) {
    return `${profile?.name || 'profile'}-${authProfile.awsAccountId || 'N/A'}`;
  }
  const profileId = profile?.recordId || profile?.id;
  if (profileId) return profileId;
  return `${profile?.name || 'profile'}-${
    authProfile.awsAccountId ||
    authProfile.subscriptionId ||
    authProfile.tenantId ||
    authProfile.domain ||
    'N/A'
  }`;
};

const getPermissionProfileLabel = (profile) => {
  const authProfile = parsePermissionProfileAuth(profile);
  const identifier =
    authProfile.awsAccountId ||
    authProfile.subscriptionName ||
    authProfile.subscriptionId ||
    authProfile.tenantId ||
    authProfile.domain ||
    '';
  return identifier
    ? `${profile?.name || 'Profile'} - ${identifier}`
    : profile?.name || 'Profile';
};

const getPermissionProfileDefaultRegions = (profile) => {
  const deploymentPreferences = safeParseJSON(
    profile?.deploymentPreferences,
    profile?.deploymentPreferences || {}
  );
  const defaultRegions = Array.isArray(deploymentPreferences?.defaultRegions)
    ? deploymentPreferences.defaultRegions
    : [];

  return Array.from(
    new Set(
      defaultRegions
        .map((region) =>
          typeof region === 'string'
            ? region
            : region?.value || region?.region || region?.name || ''
        )
        .map((region) => String(region).trim())
        .filter(Boolean)
    )
  );
};

const normalizeBlueprintDescription = (description) => {
  if (Array.isArray(description)) {
    return description.filter(Boolean).join(' ');
  }
  if (typeof description === 'string') {
    const parsed = safeParseJSON(description, description);
    if (Array.isArray(parsed)) return parsed.filter(Boolean).join(' ');
    if (typeof parsed === 'string') return parsed;
  }
  return '';
};

const normalizeBlueprintDetails = (planValue, planSettingsValue) => {
  const parsedPlan = safeParseJSON(planValue, {});
  const parsedSettings = safeParseJSON(planSettingsValue, {});
  const plan = Array.isArray(parsedPlan?.plan)
    ? parsedPlan.plan
    : Array.isArray(parsedPlan)
    ? parsedPlan
    : [];
  return {
    ...(parsedPlan && typeof parsedPlan === 'object' && !Array.isArray(parsedPlan)
      ? parsedPlan
      : {}),
    plan,
    planSettings:
      parsedSettings && typeof parsedSettings === 'object' ? parsedSettings : {},
  };
};

const normalizeCloudProvider = (value) => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return '';

  const normalized = String(raw).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['amazon', 'amazon_web_services', 'aws', 'aws_account', 'aws_org'].includes(normalized)) {
    return 'aws';
  }
  if (['azure', 'microsoft_azure', 'azure_tenant', 'azure_subscription'].includes(normalized)) {
    return 'azure';
  }
  if (['google_cloud', 'google_cloud_platform'].includes(normalized)) {
    return 'gcp';
  }
  if (['google_workspace', 'gws'].includes(normalized)) {
    return 'google_workspace';
  }
  return normalized;
};

const getBlueprintCloudProvider = (blueprint) => {
  const candidates = [
    blueprint?.cloudProvider,
    blueprint?.cloud_provider,
    blueprint?.provider,
    blueprint?.providerId,
    blueprint?.platform,
    blueprint?.cloud,
    blueprint?.metadata?.cloudProvider,
    blueprint?.plan?.cloudProvider,
    blueprint?.plan?.provider,
    blueprint?.planSettings?.cloudProvider,
    blueprint?.planSettings?.provider,
  ];

  const provider = candidates.map(normalizeCloudProvider).find(Boolean);
  if (provider) return provider;

  const searchableText = [
    blueprint?.id,
    blueprint?.title,
    blueprint?.category,
    blueprint?.class,
    blueprint?.type,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (searchableText.includes('azure')) return 'azure';
  if (searchableText.includes('gcp') || searchableText.includes('google cloud')) {
    return 'gcp';
  }
  if (
    searchableText.includes('google workspace') ||
    searchableText.includes('gws')
  ) {
    return 'google_workspace';
  }
  return 'aws';
};

const getCloudProviderLabel = (provider) => {
  switch (provider) {
    case 'azure':
      return 'Azure';
    case 'gcp':
      return 'GCP';
    case 'google_workspace':
      return 'Google Workspace';
    case 'aws':
    default:
      return 'AWS';
  }
};

const CloudProviderIcon = ({ provider, className = 'h-4 w-4' }) => {
  switch (provider) {
    case 'azure':
      return <Icons.azure className={className} />;
    case 'gcp':
      return <Icons.gcp className={className} />;
    case 'google_workspace':
      return <Icons.googleWorkspace className={className} />;
    case 'aws':
    default:
      return <Icons.aws className={className} />;
  }
};

// useMeasureNode (Unchanged)
const useMeasureNode = (nodeId, onHeightMeasured) => {
  const ref = useRef(null);
  useEffect(() => {
    let observer;
    const currentRef = ref.current;
    if (currentRef && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver((entries) => {
        for (let entry of entries) {
          const { width, height } = entry.contentRect;
          onHeightMeasured?.(nodeId, { width, height });
        }
      });
      observer.observe(currentRef);
      const initialWidth = currentRef.offsetWidth;
      const initialHeight = currentRef.offsetHeight;
      if (initialWidth > 0 && initialHeight > 0) {
        onHeightMeasured?.(nodeId, {
          width: initialWidth,
          height: initialHeight,
        });
      }
    } else if (currentRef && onHeightMeasured) {
      const initialWidth = currentRef.offsetWidth;
      const initialHeight = currentRef.offsetHeight;
      if (initialWidth > 0 && initialHeight > 0) {
        onHeightMeasured?.(nodeId, {
          width: initialWidth,
          height: initialHeight,
        });
      }
    }
    return () => {
      if (observer && currentRef) observer.unobserve(currentRef);
      if (observer) observer.disconnect();
    };
  }, [nodeId, onHeightMeasured]);
  return ref;
};

/**
 * Transforms the raw workflow data into React Flow node objects.
 * Assumes input `workflow.nodes` use the updated `type` field (cloudTask, reportTask, etc.).
 * @param {object} workflow - The raw workflow data object.
 * @param {function} handleHeightMeasured - Callback from useMeasureNode.
 * @returns {Array<object>} An array of React Flow node objects.
 */
export const transformWorkflowToNodes = (workflow, handleHeightMeasured) => {
  // Build a map of each node's direct children based on inputFrom
  const childMap = {};
  workflow.nodes.forEach((node) => {
    const parents = ensureInputFromArray(node.inputFrom);
    parents.forEach((parentId) => {
      if (!childMap[parentId]) childMap[parentId] = [];
      childMap[parentId].push(node.id);
    });
  });

  const rfNodes = workflow.nodes.map((n) => {
    let rfType = n.type; // Use the type directly from source data

    // Validate if the type is known, fallback if necessary
    if (!Object.values(NODE_TYPES).includes(rfType)) {
      console.warn(
        `Unknown node type: ${rfType} for node ${
          n.id
        }. Defaulting to ${NODE_TYPES.CLOUD_TASK}.`
      );
      rfType = NODE_TYPES.CLOUD_TASK; // Default fallback
    }

    const inputFrom = ensureInputFromArray(n.inputFrom);

    const blueprintIds = ensureInputFromArray(n.blueprintId);

    let nodeData = {
      ...n, // Keep original data
      // REMOVED cloudTaskType property from data
      name: n.name || `Node ${n.id}`,
      inputFrom: inputFrom,
      logic: ensureLogicArray(n.logic),
      blueprintId:
        rfType === NODE_TYPES.REPORT_TASK
          ? blueprintIds.length > 0
            ? blueprintIds
            : ensureInputFromArray(n.reportId)
          : n.blueprintId,
      onDelete: () => {}, // Placeholder
      onHeightMeasured: (id, size) => handleHeightMeasured(id, size),
      layoutDirection: 'LR', // Default to horizontal layout
    };
    // Attach direct downstream node IDs (next)
    nodeData.next = childMap[n.id] || [];

    if (rfType === NODE_TYPES.START) {
      nodeData.triggerType = workflow.schedule?.triggerType || 'manual';
      nodeData.schedule = workflow.schedule;
    }

    const initialPosition = n.position || { x: 0, y: 0 };

    return {
      id: n.id,
      type: rfType, // Set React Flow node type
      data: nodeData,
      selectable: true,
      draggable: true,
      position: initialPosition,
    };
  });
  return rfNodes;
};

// buildEdgesFromNodes (Unchanged - relies on type and condition, not specifics of task types)
export const buildEdgesFromNodes = (nodes, defaultEdgeOptions) => {
  // Map decision node IDs to their ordered list of child target IDs
  const decisionChildMap = {};
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  nodes.forEach((n) => {
    const parents = ensureInputFromArray(n.data?.inputFrom);
    parents.forEach((parentId) => {
      const parentNode = nodeMap.get(parentId);
      if (parentNode && parentNode.type === NODE_TYPES.DECISION) {
        if (!decisionChildMap[parentId]) decisionChildMap[parentId] = [];
        decisionChildMap[parentId].push(n.id);
      }
    });
  });

  const edges = [];
  // nodeMap already built above
  nodes.forEach((n) => {
    const inputFrom = ensureInputFromArray(n.data?.inputFrom);
    inputFrom.forEach((parentId) => {
      const parentNode = nodeMap.get(parentId);
      if (parentNode) {
        const edge = {
          id: `e-${parentId}-${n.id}`,
          source: parentId,
          target: n.id,
          ...defaultEdgeOptions,
        };

        // --- Logic to assign specific source handle for Decision nodes ---
        if (parentNode.type === NODE_TYPES.DECISION) {
          const children = decisionChildMap[parentId] || [];
          const idx = children.indexOf(n.id);
          edge.sourceHandle = `branch-${parentId}-${idx}`;
        }
        // --- End of source handle assignment ---

        // Logic for adding edge labels

        // if (
        //   parentNode.type === NODE_TYPES.DECISION &&
        //   n.data?.condition !== undefined &&
        //   n.data?.condition !== null &&
        //   String(n.data.condition).trim() !== ''
        // ) {
        //   edge.label = ` ${n.data.condition} `;
        //   edge.labelStyle = { fill: '#555', fontWeight: 500, fontSize: 11 };
        //   edge.labelBgStyle = { fill: '#ffffff', fillOpacity: 0.7 };
        //   edge.labelBgPadding = [4, 2];
        //   edge.labelBgBorderRadius = 2;
        // }
        edges.push(edge);
      } else {
        console.warn(
          `Edge source node ${parentId} for target ${n.id} not found when building initial edges.`
        );
      }
    });
  });
  return edges;
};

// --- Node Components (Split CloudTaskNode into CloudTaskNode and ReportTaskNode) ---

// General Cloud Task Node Component
function CloudTaskNode({ id, data }) {
  const { background, border } = nodeStyles[NODE_TYPES.CLOUD_TASK];
  const Icon = nodeIcons[NODE_TYPES.CLOUD_TASK]; // Fixed icon

  const ref = useMeasureNode(id, data.onHeightMeasured);

  // Determine handle positions based on layout direction
  const isHorizontal =
    data.layoutDirection === 'LR' || data.layoutDirection === 'horizontal';
  const targetPosition = isHorizontal ? 'left' : 'top';
  const sourcePosition = isHorizontal ? 'right' : 'bottom';

  // Check for validation errors
  const hasErrors = hasValidationErrors(data, NODE_TYPES.CLOUD_TASK);

  return (
    <div
      ref={ref}
      style={{
        ...baseNodeStyle,
        background,
        border: `2px solid ${hasErrors ? '#e53935' : border}`,
        position: 'relative',
      }}
    >
      <Handle
        type="target"
        position={targetPosition}
        style={{
          background: '#999',
          width: 16,
          height: 16,
          borderRadius: '50%',
        }}
        isConnectable={true}
      />
      {createNodeTitle(Icon, data)}

      {/* Validation indicator */}
      {hasErrors && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 10,
          }}
        >
          <AlertTriangle
            size={16}
            style={{
              color: '#e53935',
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
            }}
            title="Missing required fields"
          />
        </div>
      )}

      {/* Content section with border separator */}
      <div
        style={{
          borderTop: '1px solid #eee',
          paddingTop: 8,
          marginTop: 4,
          textAlign: 'center',
        }}
      >
        {data.blueprintId && data.blueprintId.length > 0 && (
          <div
            style={{
              fontSize: 10,
              marginBottom: 4,
              color: '#666',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={ensureInputFromArray(data.blueprintId).join(', ')}
          >
            <strong>Blueprint:</strong>{' '}
            {(() => {
              const bpId = ensureInputFromArray(data.blueprintId)[0] || '';
              return bpId.length > 20 ? `${bpId.slice(0, 20)}...` : bpId;
            })()}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={sourcePosition}
        style={{
          background: '#999',
          width: 16,
          height: 16,
          borderRadius: '50%',
        }}
        isConnectable={true}
      />
    </div>
  );
}

// New Report Task Node Component (Similar structure to CloudTaskNode)
function ReportTaskNode({ id, data }) {
  const { background, border } = nodeStyles[NODE_TYPES.REPORT_TASK]; // Use report task style
  const Icon = nodeIcons[NODE_TYPES.REPORT_TASK]; // Use report task icon

  const ref = useMeasureNode(id, data.onHeightMeasured);

  // Determine handle positions based on layout direction
  const isHorizontal =
    data.layoutDirection === 'LR' || data.layoutDirection === 'horizontal';
  const targetPosition = isHorizontal ? 'left' : 'top';
  const sourcePosition = isHorizontal ? 'right' : 'bottom';

  // Check for validation errors
  const hasErrors = hasValidationErrors(data, NODE_TYPES.REPORT_TASK);

  return (
    <div
      ref={ref}
      style={{
        ...baseNodeStyle,
        background,
        border: `2px solid ${hasErrors ? '#e53935' : border}`,
        position: 'relative',
      }}
    >
      <Handle
        type="target"
        position={targetPosition}
        style={{
          background: '#999',
          width: 16,
          height: 16,
          borderRadius: '50%',
        }}
        isConnectable={true}
      />
      {createNodeTitle(Icon, data)}

      {/* Validation indicator */}
      {hasErrors && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 10,
          }}
        >
          <AlertTriangle
            size={16}
            style={{
              color: '#e53935',
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
            }}
            title="Missing required fields"
          />
        </div>
      )}

      {/* Content section with border separator */}
      <div
        style={{
          borderTop: '1px solid #eee',
          paddingTop: 8,
          marginTop: 4,
          textAlign: 'center',
        }}
      >
        {data.blueprintId && data.blueprintId.length > 0 && (
          <div
            style={{
              fontSize: 10,
              marginBottom: 4,
              color: '#666',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={ensureInputFromArray(data.blueprintId).join(', ')}
          >
            <strong>Blueprint:</strong>{' '}
            {(() => {
              const bpId = ensureInputFromArray(data.blueprintId)[0] || '';
              return bpId.length > 20 ? `${bpId.slice(0, 20)}...` : bpId;
            })()}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={sourcePosition}
        style={{
          background: '#999',
          width: 16,
          height: 16,
          borderRadius: '50%',
        }}
        isConnectable={true}
      />
    </div>
  );
}

function CommunicationNode({ id, data }) {
  const { background, border } = nodeStyles[NODE_TYPES.COMMUNICATION];
  const Icon = nodeIcons[NODE_TYPES.COMMUNICATION];
  const ref = useMeasureNode(id, data.onHeightMeasured);

  // Determine handle positions based on layout direction
  const isHorizontal =
    data.layoutDirection === 'LR' || data.layoutDirection === 'horizontal';
  const targetPosition = isHorizontal ? 'left' : 'top';
  const sourcePosition = isHorizontal ? 'right' : 'bottom';

  // Extract communication type from data
  const communicationType = data.action || data.communicationType || 'email';

  // Check for validation errors
  const hasErrors = hasValidationErrors(data, NODE_TYPES.COMMUNICATION);

  return (
    <div
      ref={ref}
      style={{
        ...baseNodeStyle,
        background,
        border: `2px solid ${hasErrors ? '#e53935' : border}`,
        position: 'relative',
      }}
    >
      <Handle
        type="target"
        position={targetPosition}
        style={{
          background: '#999',
          width: 16,
          height: 16,
          borderRadius: '50%',
        }}
        isConnectable={true}
      />
      {createNodeTitle(Icon, data)}

      {/* Validation indicator */}
      {hasErrors && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 10,
          }}
        >
          <AlertTriangle
            size={16}
            style={{
              color: '#e53935',
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
            }}
            title="Missing required fields"
          />
        </div>
      )}

      {/* Content section with border separator */}
      <div
        style={{
          borderTop: '1px solid #eee',
          paddingTop: 8,
          marginTop: 4,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 11,
            marginBottom: 4,
            color: '#666',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
          }}
        >
          <strong>Type:</strong> {communicationType}
        </div>
        {data.condition && (
          <div
            style={{
              fontSize: 11,
              marginBottom: 4,
              color: '#666',
              fontStyle: 'italic',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            Path Condition: {data.condition}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={sourcePosition}
        style={{
          background: '#999',
          width: 16,
          height: 16,
          borderRadius: '50%',
        }}
        isConnectable={true}
      />
    </div>
  );
}

function ApprovalNode({ id, data }) {
  const { background, border } = nodeStyles[NODE_TYPES.APPROVAL];
  const Icon = nodeIcons[NODE_TYPES.APPROVAL];
  const ref = useMeasureNode(id, data.onHeightMeasured);

  // Determine handle positions based on layout direction
  const isHorizontal =
    data.layoutDirection === 'LR' || data.layoutDirection === 'horizontal';
  const targetPosition = isHorizontal ? 'left' : 'top';
  const sourcePosition = isHorizontal ? 'right' : 'bottom';

  // Check for validation errors
  const hasErrors = hasValidationErrors(data, NODE_TYPES.APPROVAL);

  return (
    <div
      ref={ref}
      style={{
        ...baseNodeStyle,
        background,
        border: `2px solid ${hasErrors ? '#e53935' : border}`,
        position: 'relative',
      }}
    >
      <Handle
        type="target"
        position={targetPosition}
        style={{
          background: '#999',
          width: 16,
          height: 16,
          borderRadius: '50%',
        }}
        isConnectable={true}
      />
      {createNodeTitle(Icon, data)}

      {/* Validation indicator */}
      {hasErrors && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 10,
          }}
        >
          <AlertTriangle
            size={16}
            style={{
              color: '#e53935',
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
            }}
            title="Missing required fields"
          />
        </div>
      )}

      {/* Content section with border separator */}
      <div
        style={{
          borderTop: '1px solid #eee',
          paddingTop: 8,
          marginTop: 4,
          textAlign: 'center',
        }}
      >
        {data.condition && (
          <div
            style={{
              fontSize: 11,
              marginBottom: 4,
              color: '#666',
              fontStyle: 'italic',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            Path Condition: {data.condition}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={sourcePosition}
        style={{
          background: '#999',
          width: 16,
          height: 16,
          borderRadius: '50%',
        }}
        isConnectable={true}
      />
    </div>
  );
}

function DecisionNode({ id, data }) {
  const { background, border } = nodeStyles[NODE_TYPES.DECISION];
  const Icon = nodeIcons[NODE_TYPES.DECISION];
  const ref = useMeasureNode(id, data.onHeightMeasured);

  // Determine handle positions based on layout direction
  const isHorizontal =
    data.layoutDirection === 'LR' || data.layoutDirection === 'horizontal';
  const targetPosition = isHorizontal ? 'left' : 'top';
  const sourcePosition = isHorizontal ? 'right' : 'bottom';

  // Check for validation errors
  const hasErrors = hasValidationErrors(data, NODE_TYPES.DECISION);

  // Static outgoing handles based on data.branches
  const branchHandles = Array.from({ length: data.branches || 0 }).map(
    (_, idx) => {
      const positionPercentage = (idx + 1) * (100 / ((data.branches || 0) + 1));
      return (
        <Handle
          key={`branch-${id}-${idx}`}
          type="source"
          position={sourcePosition}
          id={`branch-${id}-${idx}`}
          style={{
            [isHorizontal ? 'top' : 'left']:
              `calc(${positionPercentage}% - 8px)`,
            [isHorizontal ? 'right' : 'bottom']: 0,
            transform: 'translate(0.50%)',
            background: '#999',
            width: 16,
            height: 16,
            borderRadius: '50%',
          }}
          isConnectable={true}
        />
      );
    }
  );

  return (
    <div
      ref={ref}
      style={{
        ...baseNodeStyle,
        background,
        border: `2px solid ${hasErrors ? '#e53935' : border}`,
        position: 'relative',
      }}
    >
      <Handle
        type="target"
        position={targetPosition}
        style={{
          background: '#999',
          width: 16,
          height: 16,
          borderRadius: '50%',
        }}
        isConnectable={true}
      />
      {createNodeTitle(Icon, data)}

      {/* Validation indicator */}
      {hasErrors && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 10,
          }}
        >
          <AlertTriangle
            size={16}
            style={{
              color: '#e53935',
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
            }}
            title="Missing required fields"
          />
        </div>
      )}

      {/* Content section with border separator */}
      <div
        style={{
          borderTop: '1px solid #eee',
          paddingTop: 8,
          marginTop: 4,
          textAlign: 'center',
        }}
      >
        {data.condition && (
          <div
            style={{
              fontSize: 11,
              marginBottom: 4,
              color: '#666',
              fontStyle: 'italic',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            (Path Condition Ignored on Decision)
          </div>
        )}
        {data.branches > 0 && (
          <div
            style={{
              fontSize: 11,
              marginBottom: 4,
              color: '#666',
              fontStyle: 'italic',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            Branches: {data.branches}
          </div>
        )}
        {data.conditions && Object.keys(data.conditions).length > 0 && (
          <div
            style={{
              fontSize: 10,
              marginBottom: 4,
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              color: '#666',
            }}
          >
            <strong>Paths Ref:</strong> {JSON.stringify(data.conditions)}
          </div>
        )}
      </div>
      {branchHandles}
    </div>
  );
}

function StartNode({ id, data }) {
  const { background, border } = nodeStyles[NODE_TYPES.START];
  const Icon = nodeIcons[NODE_TYPES.START];
  const ref = useMeasureNode(id, data.onHeightMeasured);

  // Determine handle positions based on layout direction
  const isHorizontal =
    data.layoutDirection === 'LR' || data.layoutDirection === 'horizontal';
  const sourcePosition = isHorizontal ? 'right' : 'bottom';

  // Check for validation errors
  const hasErrors = hasValidationErrors(data, NODE_TYPES.START);

  const isScheduled = data.schedule?.triggerType === 'scheduled';

  return (
    <div
      ref={ref}
      style={{
        ...compactNodeStyle,
        background,
        border: `2px solid ${hasErrors ? '#e53935' : border}`,
        position: 'relative',
      }}
    >
      {/* Validation indicator */}
      {hasErrors && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            zIndex: 10,
          }}
        >
          <AlertTriangle
            size={12}
            style={{
              color: '#e53935',
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
            }}
            title="Missing required fields"
          />
        </div>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Icon size={18} style={{ color: '#666' }} />
        <span
          style={{
            fontWeight: 'bold',
            fontSize: 12,
            lineHeight: '1.2',
          }}
        >
          {data.name || 'Start'}
        </span>
        <div style={{ fontSize: 9, color: '#555', display: 'flex', alignItems: 'center', gap: 2 }}>
          {isScheduled ? <Clock size={9} /> : null}
          {isScheduled ? 'Scheduled' : 'Manual'}
        </div>
      </div>
      <Handle
        type="source"
        position={sourcePosition}
        style={{
          background: '#999',
          width: 12,
          height: 12,
          borderRadius: '50%',
        }}
        isConnectable={true}
      />
    </div>
  );
}

function EndNode({ id, data }) {
  const { background, border } = nodeStyles[NODE_TYPES.END];
  const Icon = nodeIcons[NODE_TYPES.END];
  const ref = useMeasureNode(id, data.onHeightMeasured);

  // Determine handle positions based on layout direction
  const isHorizontal =
    data.layoutDirection === 'LR' || data.layoutDirection === 'horizontal';
  const targetPosition = isHorizontal ? 'left' : 'top';

  // Check for validation errors
  const hasErrors = hasValidationErrors(data, NODE_TYPES.END);

  return (
    <div
      ref={ref}
      style={{
        ...compactNodeStyle,
        background,
        border: `2px solid ${hasErrors ? '#e53935' : border}`,
        position: 'relative',
      }}
    >
      {/* Validation indicator */}
      {hasErrors && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            zIndex: 10,
          }}
        >
          <AlertTriangle
            size={12}
            style={{
              color: '#e53935',
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
            }}
            title="Missing required fields"
          />
        </div>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Icon size={18} style={{ color: '#666' }} />
        <span
          style={{
            fontWeight: 'bold',
            fontSize: 12,
            lineHeight: '1.2',
          }}
        >
          {data.name || 'End'}
        </span>
      </div>
      <Handle
        type="target"
        position={targetPosition}
        style={{
          background: '#999',
          width: 12,
          height: 12,
          borderRadius: '50%',
        }}
        isConnectable={true}
      />
    </div>
  );
}

/**
 * Maps internal node type constants to their React component implementations.
 * Added ReportTaskNode.
 */
export const reactFlowNodeTypes = {
  [NODE_TYPES.CLOUD_TASK]: CloudTaskNode,
  [NODE_TYPES.REPORT_TASK]: ReportTaskNode, // Map the new type
  [NODE_TYPES.COMMUNICATION]: CommunicationNode,
  [NODE_TYPES.APPROVAL]: ApprovalNode,
  [NODE_TYPES.DECISION]: DecisionNode,
  [NODE_TYPES.START]: StartNode,
  [NODE_TYPES.END]: EndNode,
};

// --- Styles (Unchanged Definitions) ---
const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 49,
};
const modalContainerStyle = {
  background: 'white',
  padding: '25px',
  borderRadius: '8px',
  width: '90%',
  maxWidth: '450px',
  boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
};
const blueprintModalContainerStyle = {
  ...modalContainerStyle,
  width: '90vw',
  maxWidth: '900px',
};
const formGroupStyle = { marginBottom: '16px' };
const labelStyle = {
  marginBottom: '6px',
  fontWeight: '600',
  display: 'block',
  fontSize: '13px',
  color: '#374151',
};
const inputStyle = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  width: '100%',
  boxSizing: 'border-box',
  fontSize: '14px',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  outline: 'none',
  backgroundColor: '#f9fafb',
};
const textareaStyle = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: '80px',
  fontFamily: 'inherit',
  lineHeight: '1.5',
};
// Section wrapper for grouping related fields
const sectionStyle = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '16px',
  border: '1px solid #e5e7eb',
};
const sectionTitleStyle = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#111827',
  marginBottom: '12px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};
const buttonStyle = {
  padding: '10px 15px',
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 'bold',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
};
const buttonSecondaryStyle = {
  ...buttonStyle,
  backgroundColor: '#6c757d',
  color: 'white',
};
const blueprintTableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: '15px',
};
const blueprintThTdStyle = {
  border: '1px solid #ddd',
  padding: '8px',
  textAlign: 'left',
  fontSize: '13px',
};
const radioGroupStyle = {
  display: 'flex',
  gap: '15px',
  marginBottom: '15px',
  alignItems: 'center',
};
const radioLabelStyle = {
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
  fontSize: '14px',
};

export default function WorkflowEditor() {
  const { workflowId } = useParams();
  const isNewWorkflow = workflowId === 'new';

  if (!workflowId && !isNewWorkflow) {
    return <div>Error: Workflow ID is required.</div>;
  }

  return (
    <ReactFlowProvider>
      <FlowEditor
        workflowIdParam={isNewWorkflow ? null : workflowId}
        isNewWorkflowParam={isNewWorkflow}
      />
    </ReactFlowProvider>
  );
}

const BLUEPRINT_PREVIEW_HIDDEN_KEY = 'workflowBlueprintPreviewHidden';

const readBlueprintPreviewHiddenPreference = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(BLUEPRINT_PREVIEW_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
};

const writeBlueprintPreviewHiddenPreference = (hidden) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      BLUEPRINT_PREVIEW_HIDDEN_KEY,
      hidden ? '1' : '0'
    );
  } catch {
    // ignore storage errors
  }
};

const toPreviewStringArray = (value) => {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry : ''))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeBlueprintPhases = (planValue) => {
  const parsedPlan = safeParseJSON(planValue, planValue);
  let phases = [];
  if (Array.isArray(parsedPlan)) {
    phases = parsedPlan;
  } else if (Array.isArray(parsedPlan?.plan)) {
    phases = parsedPlan.plan;
  } else if (Array.isArray(parsedPlan?.skeleton)) {
    phases = parsedPlan.skeleton;
  }
  return phases
    .filter(Boolean)
    .map((phase, phaseIdx) => ({
      title:
        (typeof phase?.title === 'string' && phase.title.trim()) ||
        `Phase ${phaseIdx + 1}`,
      description:
        typeof phase?.description === 'string' ? phase.description : '',
      tasks: Array.isArray(phase?.tasks)
        ? phase.tasks.filter(Boolean).map((task, taskIdx) => ({
            id:
              task?.id ||
              `${phaseIdx + 1}.${taskIdx + 1}`,
            title:
              (typeof task?.title === 'string' && task.title.trim()) ||
              `Task ${taskIdx + 1}`,
            description:
              typeof task?.description === 'string' ? task.description : '',
            executionPlan: toPreviewStringArray(task?.executionPlan),
            completionCriteria: toPreviewStringArray(task?.completionCriteria),
            userExplanation: toPreviewStringArray(task?.userExplanation),
            services: Array.isArray(task?.services) ? task.services : [],
          }))
        : [],
    }));
};

function BlueprintPreviewPanel({
  blueprintId,
  blueprint,
  fetchBlueprintDetails,
  onHide,
  onOpenInEditor,
  nodeName,
  height,
}) {
  const [planDetails, setPlanDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedPhases, setExpandedPhases] = useState(() => new Set([0]));
  const [expandedTaskKey, setExpandedTaskKey] = useState(null);

  const blueprintTitle =
    blueprint?.title ||
    blueprint?.name ||
    (blueprintId ? blueprintId : 'Blueprint');

  useEffect(() => {
    if (!blueprintId) {
      setPlanDetails(null);
      setError(null);
      setIsLoading(false);
      return undefined;
    }

    const inlinePlan = Array.isArray(blueprint?.plan)
      ? { plan: blueprint.plan, planSettings: blueprint.planSettings }
      : blueprint?.plan && typeof blueprint.plan === 'object'
      ? blueprint.plan
      : null;

    if (inlinePlan && Array.isArray(inlinePlan?.plan) && inlinePlan.plan.length) {
      setPlanDetails(inlinePlan);
      setError(null);
      setIsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    Promise.resolve()
      .then(() => fetchBlueprintDetails?.(blueprintId))
      .then((details) => {
        if (cancelled) return;
        setPlanDetails(details || null);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load blueprint details.');
        setPlanDetails(null);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [blueprintId, blueprint, fetchBlueprintDetails]);

  useEffect(() => {
    setExpandedPhases(new Set([0]));
    setExpandedTaskKey(null);
  }, [blueprintId]);

  const phases = useMemo(
    () => normalizeBlueprintPhases(planDetails),
    [planDetails]
  );

  const totalTasks = useMemo(
    () => phases.reduce((sum, phase) => sum + phase.tasks.length, 0),
    [phases]
  );

  const togglePhase = (idx) => {
    setExpandedPhases((current) => {
      const next = new Set(current);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const toggleTask = (phaseIdx, taskIdx) => {
    const key = `${phaseIdx}-${taskIdx}`;
    setExpandedTaskKey((current) => (current === key ? null : key));
  };

  const expandAll = () => {
    setExpandedPhases(new Set(phases.map((_, idx) => idx)));
  };

  const collapseAll = () => {
    setExpandedPhases(new Set());
    setExpandedTaskKey(null);
  };

  return (
    <div
      className="w-80 shrink-0 border-l border-gray-200 shadow-lg flex flex-col rounded-[16px] z-[59] relative bg-white"
      style={{ height }}
    >
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">
              <Layers size={12} />
              Blueprint Preview
            </div>
            <div
              className="mt-0.5 truncate text-sm font-semibold text-gray-900"
              title={blueprintTitle}
            >
              {blueprintTitle}
            </div>
            {nodeName && (
              <div
                className="truncate text-[11px] text-gray-500"
                title={`Node: ${nodeName}`}
              >
                For: {nodeName}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onHide}
            title="Hide blueprint preview"
            aria-label="Hide blueprint preview"
            className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <EyeOff size={16} />
          </button>
        </div>
        {onOpenInEditor && blueprintId && (
          <button
            type="button"
            onClick={onOpenInEditor}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:border-blue-300 hover:bg-blue-50"
            title="Open this blueprint in the editor for full details"
          >
            <ExternalLink size={12} />
            Open in blueprint editor
          </button>
        )}
      </div>

      {!blueprintId ? (
        <div className="flex flex-1 items-center justify-center px-4 py-6 text-center text-sm text-gray-500">
          Select a blueprint on this node to preview its phases and tasks.
        </div>
      ) : isLoading ? (
        <div className="flex flex-1 items-center justify-center gap-2 px-4 py-6 text-sm text-gray-500">
          <Loader2 size={14} className="animate-spin" />
          Loading blueprint…
        </div>
      ) : error ? (
        <div className="px-4 py-4 text-sm text-red-600">
          <div className="flex items-center gap-1.5 font-medium">
            <AlertTriangle size={14} />
            Couldn’t load blueprint
          </div>
          <p className="mt-1 text-xs text-red-500">{error}</p>
        </div>
      ) : phases.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-6 text-center text-sm text-gray-500">
          No phases defined for this blueprint.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2 text-[11px] text-gray-500">
            <span>
              {phases.length} phase{phases.length === 1 ? '' : 's'} ·{' '}
              {totalTasks} task{totalTasks === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={expandAll}
                className="rounded px-1.5 py-0.5 hover:bg-gray-200 hover:text-gray-700"
              >
                Expand
              </button>
              <span className="text-gray-300">·</span>
              <button
                type="button"
                onClick={collapseAll}
                className="rounded px-1.5 py-0.5 hover:bg-gray-200 hover:text-gray-700"
              >
                Collapse
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            <div className="space-y-2">
              {phases.map((phase, phaseIdx) => {
                const phaseExpanded = expandedPhases.has(phaseIdx);
                return (
                  <div
                    key={`${phaseIdx}-${phase.title}`}
                    className="rounded-md border border-gray-200 bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => togglePhase(phaseIdx)}
                      className="flex w-full items-center gap-2 rounded-t-md px-2.5 py-2 text-left hover:bg-gray-50"
                    >
                      <ChevronRight
                        size={14}
                        className={cn(
                          'shrink-0 text-gray-400 transition-transform',
                          phaseExpanded && 'rotate-90'
                        )}
                      />
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-50 text-[11px] font-semibold text-blue-700">
                        {phaseIdx + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                        {phase.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-gray-400">
                        {phase.tasks.length} task
                        {phase.tasks.length === 1 ? '' : 's'}
                      </span>
                    </button>

                    {phaseExpanded && (
                      <div className="border-t border-gray-100">
                        {phase.tasks.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-gray-400">
                            No tasks defined.
                          </div>
                        ) : (
                          <ul className="divide-y divide-gray-100">
                            {phase.tasks.map((task, taskIdx) => {
                              const key = `${phaseIdx}-${taskIdx}`;
                              const taskExpanded = expandedTaskKey === key;
                              const hasDetails =
                                task.executionPlan.length > 0 ||
                                task.completionCriteria.length > 0 ||
                                task.userExplanation.length > 0 ||
                                task.description ||
                                task.services.length > 0;
                              return (
                                <li key={key} className="text-xs">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      hasDetails && toggleTask(phaseIdx, taskIdx)
                                    }
                                    className={cn(
                                      'flex w-full items-start gap-2 px-3 py-2 text-left',
                                      hasDetails && 'hover:bg-gray-50',
                                      !hasDetails && 'cursor-default'
                                    )}
                                  >
                                    <CheckSquare
                                      size={12}
                                      className="mt-0.5 shrink-0 text-gray-300"
                                    />
                                    <span className="min-w-0 flex-1 text-gray-700">
                                      <span className="mr-1 text-gray-400">
                                        {phaseIdx + 1}.{taskIdx + 1}
                                      </span>
                                      {task.title}
                                    </span>
                                    {hasDetails && (
                                      <ChevronDown
                                        size={12}
                                        className={cn(
                                          'mt-1 shrink-0 text-gray-300 transition-transform',
                                          taskExpanded && 'rotate-180'
                                        )}
                                      />
                                    )}
                                  </button>
                                  {hasDetails && taskExpanded && (
                                    <div className="space-y-2 bg-gray-50/70 px-3 py-2 text-[11px] text-gray-600">
                                      {task.description && (
                                        <p className="whitespace-pre-wrap text-gray-700">
                                          {task.description}
                                        </p>
                                      )}
                                      {task.userExplanation.length > 0 && (
                                        <div>
                                          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                            Explanation
                                          </div>
                                          <ul className="list-disc space-y-0.5 pl-4">
                                            {task.userExplanation.map((line, i) => (
                                              <li key={i}>{line}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {task.executionPlan.length > 0 && (
                                        <div>
                                          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                            Execution plan
                                          </div>
                                          <ul className="list-decimal space-y-0.5 pl-4">
                                            {task.executionPlan.map((line, i) => (
                                              <li key={i}>{line}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {task.completionCriteria.length > 0 && (
                                        <div>
                                          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                            Completion criteria
                                          </div>
                                          <ul className="list-disc space-y-0.5 pl-4">
                                            {task.completionCriteria.map((line, i) => (
                                              <li key={i}>{line}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {task.services.length > 0 && (
                                        <div>
                                          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                            Services
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                            {task.services.map((service, i) => {
                                              const label =
                                                typeof service === 'string'
                                                  ? service
                                                  : service?.name ||
                                                    service?.service ||
                                                    service?.id ||
                                                    '';
                                              if (!label) return null;
                                              return (
                                                <span
                                                  key={`${label}-${i}`}
                                                  className="inline-flex rounded bg-white px-1.5 py-0.5 text-[10px] text-gray-600 ring-1 ring-gray-200"
                                                >
                                                  {label}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BlueprintSelectionModal({
  isOpen,
  onClose,
  blueprints,
  initialSelectedIds,
  onConfirm,
  isLoading,
  error,
  filterType,
  selectedNodeInfo,
  setCurrentInputSummary,
  setIsSettingsModalOpen,
  setSettingsBlueprintId,
  setDefaultSettingsMap,
  fetchBlueprintDetails,
}) {
  const [selectedIds, setSelectedIds] = useState(
    new Set(initialSelectedIds || [])
  );
  const [filterKeyword, setFilterKeyword] = useState('');

  useEffect(() => {
    if (
      isOpen &&
      selectedNodeInfo?.node?.data?.inputSettings?.blueprintInputs
    ) {
      const existingBlueprintInputs =
        selectedNodeInfo.node.data.inputSettings.blueprintInputs;
      setDefaultSettingsMap(existingBlueprintInputs);
      setFilterKeyword('');
    } else if (isOpen) {
      setFilterKeyword('');
    }
  }, [isOpen, selectedNodeInfo]);

  const openSettingsModal = async (bpId) => {
    try {
      const plan = await fetchBlueprintDetails(bpId);
      setCurrentInputSummary(plan.planSettings?.defaultValues || '');
      setSettingsBlueprintId(bpId);
      // Preload the existing answers for this blueprint from the selected cloud task node
      const existingInputs =
        selectedNodeInfo?.node?.data?.inputSettings?.blueprintInputs[bpId] ||
        {};
      setDefaultSettingsMap(existingInputs);
      setIsSettingsModalOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setSelectedIds(new Set(initialSelectedIds || []));
  }, [initialSelectedIds, isOpen]);

  const handleSelectionChange = (id) => {
    // Single selection only - replace any existing selection
    setSelectedIds(new Set([id]));
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds));
  };

  const isReportBlueprint = useCallback(
    (bp) => bp?.class === 'report' || bp?.type === 'report',
    []
  );

  const filteredBlueprints = useMemo(() => {
    if (!blueprints) return [];
    let list =
      filterType === 'report'
        ? blueprints.filter((bp) => isReportBlueprint(bp))
        : blueprints.filter((bp) => !isReportBlueprint(bp));
    const kw = filterKeyword.trim().toLowerCase();
    if (kw) {
      list = list.filter((bp) => (bp.title || '').toLowerCase().includes(kw));
    }
    return list;
  }, [blueprints, filterType, filterKeyword, isReportBlueprint]);

  const myBlueprints = useMemo(
    () => filteredBlueprints.filter((bp) => bp.source === 'custom'),
    [filteredBlueprints]
  );
  const libraryBlueprints = useMemo(
    () => filteredBlueprints.filter((bp) => bp.source !== 'custom'),
    [filteredBlueprints]
  );

  if (!isOpen) return null;

  const modalTitle =
    filterType === 'report'
      ? 'Select Blueprints (Reports Only)'
      : 'Select Blueprints (Build/Other Only)';

  const selectedCount = selectedIds.size;

  const renderBlueprintTable = (items, title, sourceBadgeClass) => {
    if (!items?.length) return null;
    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
          <div className="font-medium text-sm">{title}</div>
          <Badge variant="outline" className={sourceBadgeClass}>
            {items.length}
          </Badge>
        </div>
        <div className="overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10">
              <TableRow>
                <TableHead className="w-12 text-center">Select</TableHead>
                <TableHead className="w-32">Category</TableHead>
                <TableHead className="w-36">Cloud Provider</TableHead>
                <TableHead className="min-w-[200px]">Title</TableHead>
                <TableHead className="w-24 text-center">View</TableHead>
                {filterType === 'build' && (
                  <TableHead className="w-32 text-center">Settings</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((bp) => {
                const isSelected = selectedIds.has(bp.id);
                const cloudProvider = getBlueprintCloudProvider(bp);
                const cloudProviderLabel = getCloudProviderLabel(cloudProvider);

                return (
                  <TableRow
                    key={bp.id}
                    className={cn(
                      'cursor-pointer hover:bg-gray-50 transition-colors',
                      isSelected && 'bg-blue-50 hover:bg-blue-100'
                    )}
                    onClick={() => handleSelectionChange(bp.id)}
                  >
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <input
                          type="radio"
                          name="blueprintSelection"
                          checked={isSelected}
                          onChange={() => handleSelectionChange(bp.id)}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {bp.category || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <CloudProviderIcon
                          provider={cloudProvider}
                          className="h-4 w-4 shrink-0"
                        />
                        <span>{cloudProviderLabel}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {bp.title || 'Untitled Blueprint'}
                    </TableCell>
                    <TableCell className="text-center">
                      <a
                        href={
                          isLocalRuntime()
                            ? bp.source === 'custom'
                              ? `/dashboard/library/blueprint/${bp.recordId || bp.id}`
                              : filterType === 'report'
                                ? `/dashboard/library/report/${bp.id}`
                                : `/dashboard/library/blueprint/${bp.id}`
                            : bp.source === 'custom'
                              ? `/blueprint/${bp.recordId || bp.id}`
                              : filterType === 'report'
                                ? `/library/report/${bp.id}`
                                : `/library/blueprint/${bp.id}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {bp.source === 'custom' ? 'My Blueprints' : 'Library'}
                        <ExternalLink size={12} />
                      </a>
                    </TableCell>
                    {filterType === 'build' && (
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openSettingsModal(bp.id);
                          }}
                          disabled={!isSelected}
                          className={cn(
                            'h-8 px-3 text-xs',
                            !isSelected && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Settings
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[100]" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] bg-white rounded-lg shadow-xl flex flex-col w-[90%] max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="border-b p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {modalTitle}
            </h2>
            {selectedCount > 0 && (
              <Badge variant="secondary" className="text-sm">
                {selectedCount} selected
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 border-b bg-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search blueprints by title..."
              value={filterKeyword}
              onChange={(e) => setFilterKeyword(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-6">
          {isLoading && (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-muted-foreground">Loading blueprints...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-32">
              <div className="text-center text-red-600">
                <p className="font-medium">Error loading blueprints</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {!isLoading && !error && filteredBlueprints.length === 0 && (
            <div className="flex items-center justify-center h-32">
              <div className="text-center text-muted-foreground">
                <p className="font-medium">No blueprints found</p>
                <p className="text-sm mt-1">
                  No blueprints match your search for "{filterKeyword}" in{' '}
                  {filterType === 'report' ? 'Report' : 'Build/Other'} category.
                </p>
              </div>
            </div>
          )}

          {!isLoading && !error && filteredBlueprints.length > 0 && (
            <div className="max-h-[50vh] overflow-y-auto space-y-6 pr-1">
              {renderBlueprintTable(
                myBlueprints,
                'My Blueprints',
                'border-blue-300 text-blue-700'
              )}
              {renderBlueprintTable(
                libraryBlueprints,
                'Library Blueprints',
                'border-gray-300 text-gray-700'
              )}
            </div>
          )}
        </div>

        <div className="border-t p-6 flex items-center justify-between bg-gray-50">
          <div className="text-sm text-muted-foreground">
            {filteredBlueprints.length > 0 && (
              <>
                Showing {filteredBlueprints.length} blueprint
                {filteredBlueprints.length !== 1 ? 's' : ''}
                {` (${myBlueprints.length} my, ${libraryBlueprints.length} library)`}
                {filterKeyword && ` matching "${filterKeyword}"`}
              </>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={selectedCount === 0}>
              Confirm Selection
              {selectedCount > 0 && ` (${selectedCount})`}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function WorkflowEditModal({
  isOpen,
  onClose,
  initialTitle,
  initialDescription,
  onSave,
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle || '');
      setDescription(initialDescription || '');
    }
  }, [isOpen, initialTitle, initialDescription]);

  const handleSave = () => {
    onSave(title, description);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-semibold text-gray-900 m-0">
            Edit Workflow Details
          </h3>
          <button
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer p-1 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title:
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Workflow title"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description:
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
            placeholder="Optional description"
            rows={3}
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Save Details
          </button>
        </div>
      </div>
    </div>
  );
}

function LogicEditModal({
  isOpen,
  onClose,
  onSave,
  title,
  subtitle,
  initialValue,
  placeholder,
  saveLabel = 'Save',
}) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue || '');
    }
  }, [isOpen, initialValue]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
      } else if (
        (event.metaKey || event.ctrlKey) &&
        event.key === 'Enter' &&
        document.activeElement === textareaRef.current
      ) {
        event.preventDefault();
        onSave?.(value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, onSave, value]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] px-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-[85vh]">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900 m-0 truncate">
              {title || 'Edit Logic'}
            </h3>
            {subtitle && (
              <p className="mt-0.5 text-xs text-gray-500 truncate" title={subtitle}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 p-5">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder || 'Describe what this node does...'}
            autoFocus
            className="block w-full h-[55vh] resize-none rounded-md border border-gray-300 bg-white p-3 text-sm leading-relaxed text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <span className="text-[11px] text-gray-500">
            Tip: press {IS_MAC ? '⌘' : 'Ctrl'}+Enter to save, Esc to cancel.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave?.(value)}
              className="px-3 py-1.5 text-sm text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700"
            >
              {saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Gets a user-friendly display name for a React Flow node type.
 * Updated to include ReportTaskNode.
 */
const getNodeTypeDisplayName = (type) => {
  switch (type) {
    case NODE_TYPES.CLOUD_TASK:
      return 'Cloud Task Node';
    case NODE_TYPES.REPORT_TASK:
      return 'Report Task Node'; // Added
    case NODE_TYPES.COMMUNICATION:
      return 'Communication Node';
    case NODE_TYPES.APPROVAL:
      return 'Approval Node';
    case NODE_TYPES.DECISION:
      return 'Decision/Branch Node';
    case NODE_TYPES.START:
      return 'Start Node';
    case NODE_TYPES.END:
      return 'End Node';
    default:
      return 'Unknown Node Type';
  }
};

/**
 * Side pane component for editing the selected node's details.
 * Removed cloudTaskType radio buttons and updated blueprint logic.
 */

function EditNodePane({
  node,
  parentNames,
  setNodes,
  openBlueprintModal,
  allBlueprints,
  onConfirm,
  workflowSchedule,
  setWorkflowSchedule,
}) {
  const { userProfile } = useSelector((state) => state.auth);
  const [editedData, setEditedData] = useState(null);
  const [logicEditor, setLogicEditor] = useState(null);
  const permissionProfiles = userProfile?.agentPermissionProfiles || [];

  // ReactFlow hooks for all nodes and nodeMap
  const allNodes = useNodes();
  const nodeMap = useMemo(
    () => new Map(allNodes.map((n) => [n.id, n])),
    [allNodes]
  );

  const createPermissionProfileOption = useCallback((profile) => {
        const authProfile = parsePermissionProfileAuth(profile);
        return {
          key: profile.recordId || getPermissionProfileValue(profile),
          value: getPermissionProfileValue(profile),
          label: getPermissionProfileLabel(profile),
          profile,
          defaultRegions: getPermissionProfileDefaultRegions(profile),
          authProfile: {
            ...authProfile,
            name: profile.name,
            permissionProfileId: profile.recordId || profile.id || null,
          },
        };
  }, []);

  const permissionProfileOptions = useMemo(
    () =>
      permissionProfiles
        .filter(isAwsAccountPermissionProfile)
        .map(createPermissionProfileOption),
    [permissionProfiles, createPermissionProfileOption]
  );

  const azureTenantOptions = useMemo(
    () =>
      permissionProfiles
        .filter(isAzureTenantPermissionProfile)
        .map(createPermissionProfileOption),
    [permissionProfiles, createPermissionProfileOption]
  );

  const azureSubscriptionOptions = useMemo(
    () =>
      permissionProfiles
        .filter(isAzureSubscriptionPermissionProfile)
        .map(createPermissionProfileOption),
    [permissionProfiles, createPermissionProfileOption]
  );

  const googleWorkspaceOptions = useMemo(
    () =>
      permissionProfiles
        .filter(isGoogleWorkspacePermissionProfile)
        .map(createPermissionProfileOption),
    [permissionProfiles, createPermissionProfileOption]
  );

  const getTaskCloudProvider = useCallback(
    (data = editedData) => {
      const selectedBlueprint = allBlueprints.find(
        (bp) => bp.id === ensureInputFromArray(data?.blueprintId)[0]
      );
      return (
        normalizeCloudProvider(data?.inputSettings?.cloudProvider) ||
        normalizeCloudProvider(data?.cloudProvider) ||
        getBlueprintCloudProvider(selectedBlueprint || {})
      );
    },
    [allBlueprints, editedData]
  );

  const selectedCloudProvider = getTaskCloudProvider();
  const isAwsProvider = selectedCloudProvider === 'aws';
  const isAzureProvider = selectedCloudProvider === 'azure';
  const isGoogleWorkspaceProvider = selectedCloudProvider === 'google_workspace';
  const selectedCloudProviderLabel = getCloudProviderLabel(selectedCloudProvider);
  const [azureSubscriptionModalTenantId, setAzureSubscriptionModalTenantId] =
    useState(null);

  const azureTenantOption =
    azureTenantOptions.find(
      (opt) =>
        opt.value === (editedData?.inputSettings?.azureTenantProfileId || '') ||
        opt.value === (editedData?.permissionProfile || '') ||
        opt.authProfile?.tenantId ===
          editedData?.inputSettings?.azureTenantProfile?.tenantId ||
        opt.authProfile?.tenantId === editedData?.inputSettings?.authProfile?.tenantId
    ) || null;
  const selectedAzureTenantId = azureTenantOption?.authProfile?.tenantId || '';
  const filteredAzureSubscriptionOptions = azureSubscriptionOptions.filter(
    (opt) =>
      !selectedAzureTenantId ||
      opt.authProfile?.tenantId === selectedAzureTenantId
  );
  const selectedAzureSubscriptions = Array.isArray(
    editedData?.inputSettings?.azureSubscriptionProfiles
  )
    ? editedData.inputSettings.azureSubscriptionProfiles.filter(Boolean)
    : Array.isArray(editedData?.inputSettings?.authProfiles)
    ? editedData.inputSettings.authProfiles.filter(
        (profile) => profile?.provider === 'azure' && profile?.subscriptionId
      )
    : [];
  const selectedAzureTenantProfiles = Array.isArray(
    editedData?.inputSettings?.azureTenantProfiles
  )
    ? editedData.inputSettings.azureTenantProfiles.filter(Boolean)
    : azureTenantOption?.authProfile
    ? [azureTenantOption.authProfile]
    : [];
  const azureSubscriptionModalTenantOption =
    azureTenantOptions.find(
      (opt) => opt.authProfile?.tenantId === azureSubscriptionModalTenantId
    ) || null;
  const getAzureSubscriptionsForTenant = (tenantId) =>
    azureSubscriptionOptions.filter(
      (opt) => opt.authProfile?.tenantId === tenantId
    );
  const getSelectedAzureSubscriptionsForTenant = (tenantId) =>
    selectedAzureSubscriptions.filter((profile) => profile?.tenantId === tenantId);
  const googleWorkspaceOption =
    googleWorkspaceOptions.find(
      (opt) => opt.value === (editedData?.permissionProfile || '')
    ) || null;
  const selectedGoogleWorkspaceProfiles = Array.isArray(
    editedData?.inputSettings?.authProfiles
  )
    ? editedData.inputSettings.authProfiles.filter(
        (profile) => profile?.provider === 'google_workspace' || profile?.domain
      )
    : [];

  const selectAzureTenant = (tenantOption) => {
    const tenantAuthProfile = tenantOption?.authProfile || null;
    handleDataChange('permissionProfile', tenantOption?.value || '');
    handleInputSettingsChange('cloudProvider', 'azure');
    handleInputSettingsChange('authProfile', tenantAuthProfile);
    handleInputSettingsChange('permissionProfileId', tenantAuthProfile?.permissionProfileId || '');
    handleInputSettingsChange('azureTenantProfile', tenantAuthProfile);
    handleInputSettingsChange('azureTenantProfileId', tenantOption?.value || '');
    handleInputSettingsChange('azureTenantProfiles', tenantAuthProfile ? [tenantAuthProfile] : []);
    handleInputSettingsChange('regions', []);
    handleInputSettingsChange('authProfiles', []);
    handleInputSettingsChange('azureSubscriptionProfiles', []);
  };

  const updateSelectedAzureTenants = (tenantProfiles) => {
    const tenantIds = new Set(tenantProfiles.map((profile) => profile?.tenantId));
    const nextSubscriptions = selectedAzureSubscriptions.filter((profile) =>
      tenantIds.has(profile?.tenantId)
    );
    const firstTenant = tenantProfiles[0] || null;
    const firstTenantOption = firstTenant
      ? azureTenantOptions.find(
          (opt) =>
            opt.authProfile?.tenantId === firstTenant?.tenantId ||
            opt.authProfile?.permissionProfileId === firstTenant?.permissionProfileId
        )
      : null;

    handleInputSettingsChange('cloudProvider', 'azure');
    handleDataChange('permissionProfile', firstTenantOption?.value || '');
    handleInputSettingsChange('authProfile', firstTenant);
    handleInputSettingsChange('permissionProfileId', firstTenant?.permissionProfileId || '');
    handleInputSettingsChange('azureTenantProfile', firstTenant);
    handleInputSettingsChange('azureTenantProfileId', firstTenantOption?.value || '');
    handleInputSettingsChange('azureTenantProfiles', tenantProfiles);
    handleInputSettingsChange('authProfiles', nextSubscriptions);
    handleInputSettingsChange('azureSubscriptionProfiles', nextSubscriptions);
    handleInputSettingsChange('regions', []);
  };

  const updateSelectedAzureSubscriptions = (subscriptions) => {
    handleInputSettingsChange('cloudProvider', 'azure');
    handleInputSettingsChange('regions', []);
    handleInputSettingsChange('authProfiles', subscriptions);
    handleInputSettingsChange('azureSubscriptionProfiles', subscriptions);
  };

  const updateSelectedAzureSubscriptionsForTenant = (tenantId, tenantSubscriptions) => {
    const isSingleAzureCloudTask =
      node?.type === NODE_TYPES.CLOUD_TASK && !editedData?.multiEnvironment;
    const nextSubscriptions = isSingleAzureCloudTask
      ? tenantSubscriptions.slice(0, 1)
      : [
          ...selectedAzureSubscriptions.filter(
            (profile) => profile?.tenantId !== tenantId
          ),
          ...tenantSubscriptions,
        ];
    updateSelectedAzureSubscriptions(nextSubscriptions);
  };

  const selectGoogleWorkspaceProfile = (option) => {
    const authProfile = option?.authProfile || null;
    handleDataChange('permissionProfile', option?.value || '');
    handleInputSettingsChange('cloudProvider', 'google_workspace');
    handleInputSettingsChange('authProfile', authProfile);
    handleInputSettingsChange('authProfiles', authProfile ? [authProfile] : []);
    handleInputSettingsChange('permissionProfileId', authProfile?.permissionProfileId || '');
    handleInputSettingsChange('regions', []);
  };

  const updateSelectedGoogleWorkspaceProfiles = (profiles) => {
    const firstProfile = profiles[0] || null;
    const firstOption = firstProfile
      ? googleWorkspaceOptions.find(
          (opt) =>
            opt.authProfile?.domain === firstProfile?.domain ||
            opt.authProfile?.permissionProfileId === firstProfile?.permissionProfileId
        )
      : null;

    handleInputSettingsChange('cloudProvider', 'google_workspace');
    handleInputSettingsChange('authProfiles', profiles);
    handleInputSettingsChange('authProfile', firstProfile);
    handleDataChange('permissionProfile', firstOption?.value || '');
    handleInputSettingsChange(
      'permissionProfileId',
      firstProfile?.permissionProfileId || ''
    );
    handleInputSettingsChange('regions', []);
  };

  const handleStaticMultiEnvironmentToggle = (isEnabled) => {
    handleDataChange('multiEnvironment', isEnabled);
    if (
      !isEnabled &&
      node?.type === NODE_TYPES.CLOUD_TASK &&
      selectedCloudProvider === 'azure'
    ) {
      const firstTenant = selectedAzureTenantProfiles[0] || azureTenantOption?.authProfile || null;
      const firstTenantOption = firstTenant
        ? azureTenantOptions.find(
            (opt) => opt.authProfile?.tenantId === firstTenant?.tenantId
          )
        : null;
      const firstSubscription =
        selectedAzureSubscriptions.find(
          (profile) => profile?.tenantId === firstTenant?.tenantId
        ) ||
        selectedAzureSubscriptions[0] ||
        null;

      handleDataChange('permissionProfile', firstTenantOption?.value || '');
      handleInputSettingsChange('authProfile', firstTenant);
      handleInputSettingsChange('permissionProfileId', firstTenant?.permissionProfileId || '');
      handleInputSettingsChange('azureTenantProfile', firstTenant);
      handleInputSettingsChange('azureTenantProfileId', firstTenantOption?.value || '');
      handleInputSettingsChange('azureTenantProfiles', firstTenant ? [firstTenant] : []);
      handleInputSettingsChange('authProfiles', firstSubscription ? [firstSubscription] : []);
      handleInputSettingsChange(
        'azureSubscriptionProfiles',
        firstSubscription ? [firstSubscription] : []
      );
    }
    if (isEnabled && !['each', 'all'].includes(editedData.advanceMode)) {
      handleDataChange('advanceMode', 'all');
    }
  };

  // State for Start node (unchanged)
  const [triggerType, setTriggerType] = useState(
    workflowSchedule?.triggerType || 'manual'
  );
  const [scheduleType, setScheduleType] = useState(
    workflowSchedule?.type || 'daily'
  );
  const [scheduleTime, setScheduleTime] = useState(
    workflowSchedule?.time || '09:00'
  );
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(
    workflowSchedule?.dayOfWeek || '1'
  );
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState(
    workflowSchedule?.dayOfMonth || '1'
  );

  // State for multi-environment selection modal
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
  const [environmentSearchQuery, setEnvironmentSearchQuery] = useState('');
  // State for regions selection modal
  const [isRegionsModalOpen, setIsRegionsModalOpen] = useState(false);
  const [isPermissionProfileComboboxOpen, setIsPermissionProfileComboboxOpen] =
    useState(false);

  const logicArrayToString = (arr) => ensureLogicArray(arr).join('\n');
  const logicStringToArray = (str) =>
    (str || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

  useEffect(() => {
    setIsPermissionProfileComboboxOpen(false);
    if (node) {
      if (node.type === NODE_TYPES.START) {
        // setTriggerType(node.data?.schedule?.triggerType || 'manual');
        // setScheduleType(node.data?.schedule?.type || 'daily');
        // setScheduleTime(node.data?.schedule?.time || '09:00');
        // setScheduleDayOfWeek(node.data?.schedule?.dayOfWeek || '1');
        // setScheduleDayOfMonth(node.data?.schedule?.dayOfMonth || '1');
        setEditedData(null);
      } else {
        const dataCopy = JSON.parse(JSON.stringify(node.data));

        // Only convert logic to string if it's an array, otherwise keep as is
        if (Array.isArray(dataCopy.logic)) {
          dataCopy.logic = logicArrayToString(dataCopy.logic);
        }

        if (node.type === NODE_TYPES.DECISION) {
          // dataCopy.conditions =
          //   dataCopy.conditions && typeof dataCopy.conditions === 'object'
          //     ? JSON.stringify(dataCopy.conditions, null, 2)
          //     : dataCopy.conditions || '{}';
          // Ensure branchLogic map exists
          dataCopy.branchLogic = dataCopy.branchLogic || {};
          // Convert any string values into objects with logic and title
          dataCopy.branchLogic = Object.fromEntries(
            Object.entries(dataCopy.branchLogic).map(([key, val]) => [
              key,
              typeof val === 'object'
                ? val
                : { logic: val, title: nodeMap.get(key)?.data?.name || key },
            ])
          );
          // Ensure empty entries for any new branches without logic yet
          (node.data.next || []).forEach((nextId) => {
            if (!dataCopy.branchLogic[nextId]) {
              dataCopy.branchLogic[nextId] = {
                logic: '',
                title: nodeMap.get(nextId)?.data?.name || nextId,
                runAlways: false,
              };
            }
          });
        }
        // --- Normalize communication fields for COMMUNICATION nodes ---
        if (node.type === NODE_TYPES.COMMUNICATION) {
          // Normalize communicationType and recipients as string
          dataCopy.communicationType = String(
            dataCopy.communicationType || 'email'
          ).toLowerCase();
          dataCopy.recipients = Array.isArray(dataCopy.recipients)
            ? dataCopy.recipients.join(', ')
            : String(dataCopy.recipients || '');
        }
        dataCopy.blueprintId = ensureInputFromArray(dataCopy.blueprintId);

        if (
          node.type === NODE_TYPES.CLOUD_TASK ||
          node.type === NODE_TYPES.REPORT_TASK
        ) {
          const existingAuthProfiles = Array.isArray(
            dataCopy.inputSettings?.authProfiles
          )
            ? dataCopy.inputSettings.authProfiles.filter(Boolean)
            : [];
          const singleAuthProfileCandidate = dataCopy.inputSettings?.authProfile;
          const singleAuthProfile =
            singleAuthProfileCandidate &&
            typeof singleAuthProfileCandidate === 'object' &&
            Object.keys(singleAuthProfileCandidate).length > 0
              ? singleAuthProfileCandidate
              : null;
          const normalizedAuthProfiles =
            existingAuthProfiles.length > 0
              ? existingAuthProfiles
              : singleAuthProfile
              ? [singleAuthProfile]
              : [];

          dataCopy.inputSettings = {
            ...(dataCopy.inputSettings || {}),
            ...(normalizedAuthProfiles.length > 0
              ? {
                  authProfiles: normalizedAuthProfiles,
                  authProfile: normalizedAuthProfiles[0],
                }
              : {}),
          };
          dataCopy.multiEnvironment =
            Boolean(dataCopy.multiEnvironment) ||
            normalizedAuthProfiles.length > 1;
          dataCopy.dynamicTargetsFromInput = Boolean(dataCopy.dynamicTargetsFromInput);
          dataCopy.advanceMode =
            dataCopy.advanceMode === 'each' ? 'each' : 'all';
        }

        setEditedData(dataCopy);
      }
    } else {
      setEditedData(null);
      setTriggerType('manual');
    }
  }, [node, nodeMap]);

  const handleDataChange = (field, value) => {
    if (node?.type !== NODE_TYPES.START && editedData !== null) {
      const normalizedValue =
        node.type === NODE_TYPES.DECISION && field === 'branches'
          ? parseInt(value, 10) || 0
          : value;

      // Update local editor state
      setEditedData((prev) => ({
        ...prev,
        [field]: normalizedValue,
      }));

      // Immediately save to the nodes
      setNodes((prevNodes) =>
        prevNodes.map((n) => {
          if (n.id !== node.id) return n;
          return {
            ...n,
            data: {
              ...n.data,
              [field]: normalizedValue,
            },
          };
        })
      );
    }
  };

  // Merge a single key/value into inputSettings without overwriting other keys
  const handleInputSettingsChange = (key, value) => {
    if (editedData) {
      // Update the edited data state
      setEditedData((prev) => ({
        ...prev,
        inputSettings: {
          ...(prev.inputSettings || {}),
          [key]: value,
        },
      }));

      // Immediately save to the nodes
      setNodes((prevNodes) =>
        prevNodes.map((n) => {
          if (n.id !== node.id) return n;
          const existingSettings = n.data.inputSettings || {};
          const newSettings = { ...existingSettings, [key]: value };
          return {
            ...n,
            data: {
              ...n.data,
              inputSettings: newSettings,
            },
          };
        })
      );
    }
  };

  const setReportTaskMode = (mode) => {
    handleInputSettingsChange('reportNodeMode', mode);
    handleInputSettingsChange('mode', mode);
  };

  const toggleAnalysisArtifact = (kind, enabled) => {
    const existingArtifacts = Array.isArray(editedData?.inputSettings?.analysisArtifacts)
      ? editedData.inputSettings.analysisArtifacts
      : [];
    const filteredArtifacts = existingArtifacts.filter(
      (artifact) => String(artifact?.kind || artifact || '').trim().toLowerCase() !== kind
    );
    const nextArtifacts = enabled
      ? [...filteredArtifacts, { kind }]
      : filteredArtifacts;
    handleInputSettingsChange('analysisArtifacts', nextArtifacts);
  };

  // Handle Start node schedule changes immediately
  const handleStartNodeScheduleChange = (field, value) => {
    // Update the local state
    switch (field) {
      case 'triggerType':
        setTriggerType(value);
        break;
      case 'scheduleType':
        setScheduleType(value);
        break;
      case 'scheduleTime':
        setScheduleTime(value);
        break;
      case 'scheduleDayOfWeek':
        setScheduleDayOfWeek(value);
        break;
      case 'scheduleDayOfMonth':
        setScheduleDayOfMonth(value);
        break;
    }

    // Build the new schedule object
    const newSchedule = {
      triggerType: field === 'triggerType' ? value : triggerType,
      type: field === 'scheduleType' ? value : scheduleType,
      time: field === 'scheduleTime' ? value : scheduleTime,
      dayOfWeek: field === 'scheduleDayOfWeek' ? value : scheduleDayOfWeek,
      dayOfMonth: field === 'scheduleDayOfMonth' ? value : scheduleDayOfMonth,
    };

    // Immediately save to the nodes and workflow schedule
    setNodes((prevNodes) =>
      prevNodes.map((n) =>
        n.id === node.id
          ? {
              ...n,
              data: {
                ...n.data,
                triggerType: newSchedule.triggerType,
                schedule: newSchedule,
              },
            }
          : n
      )
    );

    setWorkflowSchedule(newSchedule);
  };

  // Move isCloudTask, isReportTask, isTaskNode definitions here
  const isCloudTask = node.type === NODE_TYPES.CLOUD_TASK;
  const isReportTask = node.type === NODE_TYPES.REPORT_TASK;
  const isTaskNode = isCloudTask || isReportTask;
  const isDynamicTargetsEnabled = Boolean(editedData?.dynamicTargetsFromInput);
  const reportTaskMode = String(
    editedData?.inputSettings?.reportNodeMode ||
      editedData?.inputSettings?.mode ||
      editedData?.inputSettings?.reportMode ||
      'run_report'
  )
    .trim()
    .toLowerCase();
  const currentAnalysisArtifacts = Array.isArray(
    editedData?.inputSettings?.analysisArtifacts
  )
    ? editedData.inputSettings.analysisArtifacts
    : [];

  // Determine the current report source type for the streamlined UI
  const getReportSourceType = () => {
    if (!editedData) return null;

    const explicitSourceType = String(
      editedData?.inputSettings?.reportSourceType || ''
    )
      .trim()
      .toLowerCase();

    if (explicitSourceType) {
      return explicitSourceType;
    }

    // Check if any artifact types (cost, health, inventory, threat) are selected
    const artifactKinds = ['cost', 'health', 'inventory', 'threat'];
    const selectedArtifacts = currentAnalysisArtifacts
      .map((a) => String(a?.kind || a || '').trim().toLowerCase())
      .filter((k) => artifactKinds.includes(k));

    if (selectedArtifacts.length > 0) {
      return selectedArtifacts[0]; // Return first selected artifact type
    }

    // If mode is run_report (and no artifacts selected), it's blueprint mode
    // This includes when a blueprint is selected OR when user has chosen this option but not picked a blueprint yet
    if (reportTaskMode === 'run_report') {
      return 'blueprint';
    }

    return null; // No selection yet
  };

  const currentReportSourceType = getReportSourceType();

  // Handle report source type selection
  const handleReportSourceTypeChange = (sourceType) => {
    const artifactKinds = ['cost', 'health', 'inventory', 'threat'];

    if (sourceType === 'blueprint') {
      // Switch to run_report mode and clear artifact selections
      handleInputSettingsChange('reportSourceType', 'blueprint');
      setReportTaskMode('run_report');
      handleInputSettingsChange('analysisArtifacts', []);
    } else if (artifactKinds.includes(sourceType)) {
      // Switch to analyze_existing mode
      handleInputSettingsChange('reportSourceType', sourceType);
      setReportTaskMode('analyze_existing');
      // Clear any existing artifacts and set the new one
      handleInputSettingsChange('analysisArtifacts', [{ kind: sourceType }]);
      // Clear blueprint selection when switching to artifact mode
      handleDataChange('blueprintId', []);
    }
  };

  // Validate required fields using the utility function
  const validationErrors = useMemo(() => {
    if (!editedData) return {};
    return validateNodeData(editedData, node.type);
  }, [editedData, node.type]);
  const isValid = Object.keys(validationErrors).length === 0;

  if (!node) return <div>Select a node to view/edit details.</div>;

  // Start Node Form (unchanged rendering)
  if (node.type === NODE_TYPES.START) {
    return (
      <>
        <h3
          style={{
            marginTop: 0,
            borderBottom: '1px solid #eee',
            paddingBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '15px',
          }}
        >
          <PlayCircle size={18} /> {getNodeTypeDisplayName(node.type)}
        </h3>
        <div style={formGroupStyle}>
          {' '}
          <label style={labelStyle}>Trigger Type:</label>{' '}
          <div style={radioGroupStyle}>
            {' '}
            <label style={radioLabelStyle}>
              {' '}
              <input
                type="radio"
                value="manual"
                checked={triggerType === 'manual'}
                onChange={(e) =>
                  handleStartNodeScheduleChange('triggerType', e.target.value)
                }
                className="mr-2"
              />{' '}
              Manual{' '}
            </label>{' '}
            <label style={radioLabelStyle}>
              {' '}
              <input
                type="radio"
                value="scheduled"
                checked={triggerType === 'scheduled'}
                onChange={(e) =>
                  handleStartNodeScheduleChange('triggerType', e.target.value)
                }
                className="mr-2"
              />{' '}
              Scheduled{' '}
            </label>{' '}
          </div>{' '}
        </div>
        {triggerType === 'scheduled' && (
          <div
            style={{
              border: '1px solid #eee',
              padding: '15px',
              borderRadius: '4px',
              marginBottom: '15px',
              background: '#f9f9f9',
            }}
          >
            {' '}
            <label
              style={{
                ...labelStyle,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '15px',
              }}
            >
              {' '}
              <Calendar size={16} /> Schedule Details{' '}
            </label>{' '}
            <div style={formGroupStyle}>
              <select
                value={scheduleType}
                onChange={(e) =>
                  handleStartNodeScheduleChange('scheduleType', e.target.value)
                }
                style={inputStyle}
              >
                {' '}
                <option value="daily">Daily</option>{' '}
                <option value="weekly">Weekly</option>{' '}
                <option value="monthly">Monthly</option>{' '}
              </select>{' '}
            </div>
            <div style={formGroupStyle}>
              <label style={labelStyle}>Time:</label>
              <select
                value={scheduleTime}
                onChange={(e) =>
                  handleStartNodeScheduleChange('scheduleTime', e.target.value)
                }
                style={inputStyle}
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const hour = String(i).padStart(2, '0');
                  return (
                    <option key={hour} value={`${hour}:00`}>
                      {`${hour}:00`}
                    </option>
                  );
                })}
              </select>
            </div>
            {scheduleType === 'weekly' && (
              <div style={formGroupStyle}>
                <label style={labelStyle}>Day of Week:</label>
                <select
                  value={scheduleDayOfWeek}
                  onChange={(e) =>
                    handleStartNodeScheduleChange(
                      'scheduleDayOfWeek',
                      e.target.value
                    )
                  }
                  style={inputStyle}
                >
                  <option value="1">Sunday</option>
                  <option value="2">Monday</option>
                  <option value="3">Tuesday</option>
                  <option value="4">Wednesday</option>
                  <option value="5">Thursday</option>
                  <option value="6">Friday</option>
                  <option value="7">Saturday</option>
                </select>
              </div>
            )}
            {scheduleType === 'monthly' && (
              <div style={formGroupStyle}>
                <label style={labelStyle}>Day of Month:</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={scheduleDayOfMonth}
                  onChange={(e) =>
                    handleStartNodeScheduleChange(
                      'scheduleDayOfMonth',
                      e.target.value
                    )
                  }
                  style={inputStyle}
                />
              </div>
            )}
            <small
              style={{
                marginTop: '8px',
                display: 'block',
                color: '#666',
                fontSize: '11px',
              }}
            >
              {' '}
              All times are in UTC. Cron format: minute hour day(month) month
              day(week).{' '}
            </small>{' '}
          </div>
        )}
      </>
    );
  }

  if (!editedData) return <div>Loading node data...</div>;

  // Generic Node Form Rendering
  const NodeIcon = nodeIcons[node.type] || Terminal;
  // const isCloudTask = node.type === NODE_TYPES.CLOUD_TASK;
  // const isReportTask = node.type === NODE_TYPES.REPORT_TASK; // Moved above
  // const isTaskNode = isCloudTask || isReportTask; // Moved above
  const isDecision = node.type === NODE_TYPES.DECISION;
  const isApprovalOrComm =
    node.type === NODE_TYPES.APPROVAL || node.type === NODE_TYPES.COMMUNICATION;
  const selectedAuthProfiles = Array.isArray(
    editedData.inputSettings?.authProfiles
  )
    ? editedData.inputSettings.authProfiles.filter(Boolean)
    : [];
  const selectedMultiProfileValues = selectedAuthProfiles.map((authProfile) => {
    const matched = permissionProfileOptions.find(
      (opt) =>
        opt.authProfile?.awsAccountId === authProfile?.awsAccountId &&
        (opt.authProfile?.name || '') === (authProfile?.name || '')
    );
    if (matched) return matched.value;
    return `${authProfile?.name || 'profile'}-${authProfile?.awsAccountId || 'N/A'}`;
  });
  const selectedPermissionProfileOption =
    permissionProfileOptions.find(
      (opt) => opt.value === (editedData.permissionProfile || '')
    ) || null;
  const selectedEnvironmentCredentialIssue = isLocalRuntime()
    ? getLocalAwsCredentialIssueMessage(selectedPermissionProfileOption?.profile)
    : '';
  const filteredEnvironmentOptions = permissionProfileOptions.filter((opt) => {
    const query = environmentSearchQuery.trim().toLowerCase();
    if (!query) return true;

    return [opt.label, opt.authProfile?.name, opt.authProfile?.awsAccountId]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
  const visibleEnvironmentAccountIds = new Set(
    filteredEnvironmentOptions
      .map((opt) => opt.authProfile?.awsAccountId)
      .filter(Boolean)
  );
  const areAllVisibleEnvironmentsSelected =
    filteredEnvironmentOptions.length > 0 &&
    filteredEnvironmentOptions.every((opt) =>
      selectedAuthProfiles.some(
        (profile) => profile?.awsAccountId === opt.authProfile?.awsAccountId
      )
    );
  const hasVisibleEnvironmentSelections = selectedAuthProfiles.some((profile) =>
    visibleEnvironmentAccountIds.has(profile?.awsAccountId)
  );
  const selectedEnvironmentCount = selectedAuthProfiles.length;
  const remainingEnvironmentSlots = Math.max(
    0,
    MAX_ENVIRONMENTS_PER_NODE - selectedEnvironmentCount
  );
  const isEnvironmentSelectionLimitReached =
    selectedEnvironmentCount >= MAX_ENVIRONMENTS_PER_NODE;
  const getOptionForAuthProfile = (authProfile) =>
    permissionProfileOptions.find(
      (opt) =>
        opt.authProfile?.awsAccountId === authProfile?.awsAccountId &&
        (opt.authProfile?.name || '') === (authProfile?.name || '')
    ) ||
    permissionProfileOptions.find(
      (opt) => opt.authProfile?.awsAccountId === authProfile?.awsAccountId
    ) ||
    null;
  const getDefaultRegionsForAuthProfiles = (authProfiles) =>
    Array.from(
      new Set(
        authProfiles.flatMap(
          (authProfile) => getOptionForAuthProfile(authProfile)?.defaultRegions || []
        )
      )
    );
  const selectedMultiEnvironmentCredentialIssue = isLocalRuntime()
    ? selectedAuthProfiles
        .map((authProfile) => getOptionForAuthProfile(authProfile))
        .map((opt) => getLocalAwsCredentialIssueMessage(opt?.profile))
        .find(Boolean) || ''
    : '';
  const updateSelectedEnvironmentProfiles = (updatedProfiles) => {
    if (updatedProfiles.length > MAX_ENVIRONMENTS_PER_NODE) {
      toast.error(
        `You can select up to ${MAX_ENVIRONMENTS_PER_NODE} environments per node.`
      );
      return false;
    }
    handleInputSettingsChange('authProfiles', updatedProfiles);
    handleInputSettingsChange('authProfile', updatedProfiles[0] || null);
    const firstSelectedOption = updatedProfiles[0]
      ? getOptionForAuthProfile(updatedProfiles[0])
      : null;
    handleDataChange('permissionProfile', firstSelectedOption?.value || '');
    handleInputSettingsChange(
      'permissionProfileId',
      firstSelectedOption?.authProfile?.permissionProfileId || ''
    );
    const defaultRegions = getDefaultRegionsForAuthProfiles(updatedProfiles);
    if (defaultRegions.length > 0) {
      handleInputSettingsChange('regions', defaultRegions);
    }
    return true;
  };

  // Determine blueprint filter type text based on node type
  const blueprintFilterText = isReportTask ? 'Report' : 'Build/Other';

  // For Decision nodes, get outgoing connections (next IDs)
  // nodeMap is available in parent via useMemo, but we don't have it here.
  // We'll just use node.data.next and label with nextId for now.

  return (
    <div style={{ paddingBottom: '16px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '2px solid #e5e7eb',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: nodeStyles[node.type]?.background || '#f3f4f6',
            border: `2px solid ${nodeStyles[node.type]?.border || '#d1d5db'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <NodeIcon size={18} style={{ color: '#374151' }} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#111827' }}>
            {getNodeTypeDisplayName(node.type)}
          </h3>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
            {parentNames && parentNames.length > 0
              ? `Input from: ${parentNames.join(', ')}`
              : 'Not connected'}
          </div>
        </div>
      </div>

      {/* Basic Info Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <Edit2 size={14} /> Basic Info
        </div>
        <div style={formGroupStyle}>
          <label style={labelStyle}>
            Name <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            value={editedData.name || ''}
            onChange={(e) => handleDataChange('name', e.target.value)}
            style={inputStyle}
            placeholder="Enter node name"
          />
        </div>
      </div>

      {/* Blueprint Section - Single blueprint only (for Cloud Tasks only; Report Tasks use integrated selection) */}
      {isCloudTask && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>
            <FileText size={14} /> Blueprint
          </div>
          
          {editedData.blueprintId && editedData.blueprintId.length > 0 ? (
            (() => {
              const blueprintId = editedData.blueprintId[0]; // Only show first blueprint
              const blueprint = allBlueprints.find((bp) => bp.id === blueprintId);
              const displayTitle = blueprint?.title || blueprintId;

              const handleRemoveBlueprint = () => {
                if (onConfirm) {
                  onConfirm([]);
                } else {
                  handleDataChange('blueprintId', []);
                  // Reset node name to default when blueprint is removed
                  handleDataChange('name', isCloudTask ? 'New Cloud Task' : 'New Report Task');
                  setIsDirty(true);
                }
              };

              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    gap: '8px',
                  }}
                >
                  <div 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      flex: 1,
                      minWidth: 0,
                    }}
                    title={displayTitle}
                  >
                    <FileText size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                    <span style={{ 
                      fontSize: '13px', 
                      color: '#374151', 
                      fontWeight: '500',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {displayTitle}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                    <button
                      onClick={() => openBlueprintModal(blueprintId)}
                      style={{
                        padding: '4px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      className="hover:bg-green-100"
                      title="Configure Blueprint Settings"
                    >
                      <Settings size={14} style={{ color: '#16a34a' }} />
                    </button>
                    <button
                      onClick={handleRemoveBlueprint}
                      style={{
                        padding: '4px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      className="hover:bg-red-100"
                      title="Remove Blueprint"
                    >
                      <X size={14} style={{ color: '#ef4444' }} />
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            <button
              onClick={() => openBlueprintModal(null)}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px dashed #d1d5db',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
              className="hover:bg-gray-100 hover:border-gray-400"
            >
              <FileText size={16} style={{ color: '#9ca3af' }} />
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
                Click to select a blueprint
              </span>
            </button>
          )}
        </div>
      )}

      {isReportTask && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>
            <FileText size={14} /> Report Source
          </div>
          <div style={{ ...formGroupStyle, marginBottom: 0 }}>
            <label style={labelStyle}>Select Report Type</label>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {/* Blueprint-based reports section */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: currentReportSourceType === 'blueprint' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                  backgroundColor: currentReportSourceType === 'blueprint' ? '#eff6ff' : '#f9fafb',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => handleReportSourceTypeChange('blueprint')}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="reportSourceType"
                    checked={currentReportSourceType === 'blueprint'}
                    onChange={() => handleReportSourceTypeChange('blueprint')}
                    style={{ accentColor: '#3b82f6', marginTop: '2px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>
                      Run Report Blueprint
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                      Execute a compliance or configuration summary report
                    </div>
                    {currentReportSourceType === 'blueprint' && (
                      <div style={{ marginTop: '10px' }}>
                        {editedData?.blueprintId && editedData.blueprintId.length > 0 ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '6px 10px',
                              backgroundColor: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                              borderRadius: '6px',
                              fontSize: '12px',
                            }}
                          >
                            <FileText size={12} style={{ color: '#16a34a' }} />
                            <span style={{ color: '#374151', fontWeight: '500' }}>
                              {allBlueprints.find((bp) => bp.id === editedData?.blueprintId?.[0])?.title || editedData?.blueprintId?.[0]}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openBlueprintModal(null);
                              }}
                              style={{
                                marginLeft: 'auto',
                                padding: '2px 6px',
                                fontSize: '11px',
                                color: '#3b82f6',
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              Change
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openBlueprintModal(null);
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              backgroundColor: '#fff',
                              borderRadius: '6px',
                              border: '1px dashed #d1d5db',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              fontSize: '12px',
                              color: '#6b7280',
                            }}
                          >
                            <FileText size={12} />
                            Select a report blueprint
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {/* Divider with label */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '4px 0',
                }}
              >
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
                <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '500' }}>
                  OR ANALYZE ARTIFACTS
                </span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
              </div>

              {/* Artifact-based analysis options */}
              {[
                {
                  kind: 'cost',
                  label: 'Cost Analysis',
                  description: 'Analyze environment cost data and spending patterns',
                  icon: '💰',
                },
                {
                  kind: 'health',
                  label: 'Health Analysis',
                  description: 'Review environment health findings and issues',
                  icon: '🏥',
                },
                {
                  kind: 'inventory',
                  label: 'Inventory Analysis',
                  description: 'Examine environment resource inventory snapshot',
                  icon: '📦',
                },
                {
                  kind: 'threat',
                  label: 'Threat Analysis',
                  description: 'Analyze security threat findings',
                  icon: '🛡️',
                },
              ].map((artifact) => {
                const isSelected = currentReportSourceType === artifact.kind;
                return (
                  <div
                    key={artifact.kind}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                      backgroundColor: isSelected ? '#eff6ff' : '#f9fafb',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => handleReportSourceTypeChange(artifact.kind)}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="reportSourceType"
                        checked={isSelected}
                        onChange={() => handleReportSourceTypeChange(artifact.kind)}
                        style={{ accentColor: '#3b82f6', marginTop: '2px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{artifact.icon}</span>
                          {artifact.label}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                          {artifact.description}
                        </div>
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#9ca3af',
                marginTop: '10px',
                lineHeight: '1.4',
              }}
            >
              Artifact analyses use scanner data from the selected cloud environment. The logic field controls what to analyze.
            </div>
          </div>
        </div>
      )}
      {/* Cloud Environment Section */}
      {(isCloudTask || isReportTask) && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>
            <Terminal size={14} /> Cloud Environment
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              borderRadius: '999px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
              color: '#374151',
              fontSize: '12px',
              fontWeight: 500,
              marginBottom: '12px',
            }}
          >
            <CloudProviderIcon
              provider={selectedCloudProvider}
              className="h-4 w-4 shrink-0"
            />
            {selectedCloudProviderLabel}
          </div>

          {isAwsProvider ? (
            <>
          {isTaskNode && (
            <div style={{ marginBottom: '12px' }}>
              {isTaskNode ? (
                <>
                  <label 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      color: '#374151',
                      cursor: 'pointer',
                      padding: '8px 12px',
                      backgroundColor: isDynamicTargetsEnabled ? '#eff6ff' : '#f9fafb',
                      borderRadius: '8px',
                      border: isDynamicTargetsEnabled ? '1px solid #bfdbfe' : '1px solid #e5e7eb',
                      transition: 'all 0.15s ease',
                      marginBottom: '8px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isDynamicTargetsEnabled}
                      onChange={(e) =>
                        handleDataChange('dynamicTargetsFromInput', e.target.checked)
                      }
                      style={{ accentColor: '#3b82f6' }}
                    />
                    <span style={{ fontWeight: '500' }}>
                      Resolve environments and regions from previous node output
                    </span>
                  </label>

                  {isDynamicTargetsEnabled ? (
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                        lineHeight: '1.5',
                        color: '#475569',
                      }}
                    >
                      This {isCloudTask ? 'cloud task' : 'report task'} will resolve AWS permission profiles and
                      regions at runtime from prior node outputs and this node&apos;s
                      logic. Static account and region selectors are disabled in
                      this mode.
                    </div>
                  ) : null}
                </>
              ) : null}

              {!isDynamicTargetsEnabled ? (
              <label 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  color: '#374151',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  backgroundColor: editedData.multiEnvironment ? '#eff6ff' : '#f9fafb',
                  borderRadius: '8px',
                  border: editedData.multiEnvironment ? '1px solid #bfdbfe' : '1px solid #e5e7eb',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(editedData.multiEnvironment)}
                  onChange={(e) => {
                    const isEnabled = e.target.checked;
                    handleDataChange('multiEnvironment', isEnabled);
                    if (isEnabled) {
                      const existingProfiles = Array.isArray(
                        editedData.inputSettings?.authProfiles
                      )
                        ? editedData.inputSettings.authProfiles.filter(Boolean)
                        : [];
                      if (
                        existingProfiles.length === 0 &&
                        editedData.inputSettings?.authProfile
                      ) {
                        handleInputSettingsChange('authProfiles', [
                          editedData.inputSettings.authProfile,
                        ]);
                      }
                    } else {
                      const selectedSingle = permissionProfileOptions.find(
                        (opt) => opt.value === editedData.permissionProfile
                      );
                      const fallbackProfile = selectedSingle?.authProfile || null;
                      handleInputSettingsChange(
                        'authProfiles',
                        fallbackProfile ? [fallbackProfile] : []
                      );
                      if (fallbackProfile) {
                        handleInputSettingsChange('authProfile', fallbackProfile);
                      }
                    }
                  }}
                  style={{ accentColor: '#3b82f6' }}
                />
                <span style={{ fontWeight: '500' }}>
                  Run in multiple cloud environments
                </span>
              </label>
              ) : null}
            </div>
          )}

          <div style={formGroupStyle}>
            <label style={labelStyle}>
              Target AWS Account{editedData.multiEnvironment ? 's' : ''}
              {!isDynamicTargetsEnabled ? (
                <>
                  {' '}
                  <span style={{ color: '#ef4444' }}>*</span>
                </>
              ) : null}
            </label>
            {isDynamicTargetsEnabled ? (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px dashed #cbd5e1',
                  backgroundColor: '#f8fafc',
                  color: '#64748b',
                  fontSize: '12px',
                  lineHeight: '1.5',
                }}
              >
                AWS permission profiles will be selected dynamically at runtime
                from the previous node output.
              </div>
            ) : editedData.multiEnvironment ? (
              <>
                {/* Show selected environments */}
                {selectedAuthProfiles.length > 0 ? (
                  <div style={{ marginBottom: '8px' }}>
                    {selectedAuthProfiles.map((profile, idx) => {
                      const profileLabel = permissionProfileOptions.find(
                        (opt) => opt.authProfile?.awsAccountId === profile?.awsAccountId
                      )?.label || profile?.name || 'Unknown';
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            backgroundColor: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            marginBottom: '6px',
                            fontSize: '12px',
                          }}
                        >
                          <span style={{ color: '#1e40af', fontWeight: '500' }}>{profileLabel}</span>
                          <button
                            onClick={() => {
                              const updatedProfiles = selectedAuthProfiles.filter((_, i) => i !== idx);
                              updateSelectedEnvironmentProfiles(updatedProfiles);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                            }}
                          >
                            <X size={14} style={{ color: '#6b7280' }} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                <div
                  style={{
                    marginBottom: '8px',
                    fontSize: '12px',
                    color: isEnvironmentSelectionLimitReached ? '#b45309' : '#6b7280',
                  }}
                >
                  {selectedEnvironmentCount} / {MAX_ENVIRONMENTS_PER_NODE} environments selected
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEnvironmentSearchQuery('');
                    setIsEnvModalOpen(true);
                  }}
                  className="w-full"
                >
                  <Plus size={14} className="mr-2" />
                  {selectedAuthProfiles.length > 0 ? 'Manage Environments' : 'Select Environments'}
                </Button>
                {selectedMultiEnvironmentCredentialIssue ? (
                  <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{selectedMultiEnvironmentCredentialIssue}</span>
                  </div>
                ) : null}

                {/* Environment Selection Modal */}
                {isEnvModalOpen && (
                  <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100,
                  }}>
                    <div style={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      padding: '20px',
                      width: '90%',
                      maxWidth: '400px',
                      maxHeight: '80vh',
                      overflow: 'auto',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Select Cloud Environments</h3>
                        <button
                          onClick={() => {
                            setEnvironmentSearchQuery('');
                            setIsEnvModalOpen(false);
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                        >
                          <X size={20} />
                        </button>
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <Input
                          value={environmentSearchQuery}
                          onChange={(e) => setEnvironmentSearchQuery(e.target.value)}
                          placeholder="Search cloud environments..."
                        />
                      </div>
                      <div
                        style={{
                          marginBottom: '12px',
                          fontSize: '12px',
                          color: isEnvironmentSelectionLimitReached ? '#b45309' : '#6b7280',
                        }}
                      >
                        {selectedEnvironmentCount} / {MAX_ENVIRONMENTS_PER_NODE} environments selected
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            filteredEnvironmentOptions.length === 0 ||
                            areAllVisibleEnvironmentsSelected ||
                            remainingEnvironmentSlots === 0
                          }
                          onClick={() => {
                            const selectedAccountIds = new Set(
                              selectedAuthProfiles
                                .map((profile) => profile?.awsAccountId)
                                .filter(Boolean)
                            );
                            const visibleProfilesToAdd = filteredEnvironmentOptions
                              .filter(
                                (opt) =>
                                  opt.authProfile?.awsAccountId &&
                                  !selectedAccountIds.has(opt.authProfile.awsAccountId)
                              )
                              .map((opt) => ({ ...opt.authProfile }));
                            const profilesToAdd = visibleProfilesToAdd.slice(
                              0,
                              remainingEnvironmentSlots
                            );
                            const updatedProfiles = [
                              ...selectedAuthProfiles,
                              ...profilesToAdd,
                            ];
                            updateSelectedEnvironmentProfiles(updatedProfiles);
                            if (
                              visibleProfilesToAdd.length > profilesToAdd.length &&
                              profilesToAdd.length > 0
                            ) {
                              toast.error(
                                `Only ${remainingEnvironmentSlots} more environments can be selected for this node.`
                              );
                            }
                          }}
                        >
                          Select all visible
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            filteredEnvironmentOptions.length === 0 ||
                            !hasVisibleEnvironmentSelections
                          }
                          onClick={() => {
                            const updatedProfiles = selectedAuthProfiles.filter(
                              (profile) =>
                                !visibleEnvironmentAccountIds.has(profile?.awsAccountId)
                            );
                            updateSelectedEnvironmentProfiles(updatedProfiles);
                          }}
                        >
                          Deselect all visible
                        </Button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {filteredEnvironmentOptions.length === 0 ? (
                          <div
                            style={{
                              padding: '16px 12px',
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb',
                              backgroundColor: '#f9fafb',
                              color: '#6b7280',
                              fontSize: '14px',
                              textAlign: 'center',
                            }}
                          >
                            No cloud environments found.
                          </div>
                        ) : filteredEnvironmentOptions.map((opt) => {
                          const isSelected = selectedAuthProfiles.some(
                            (p) => p?.awsAccountId === opt.authProfile?.awsAccountId
                          );
                          const isDisabled =
                            !isSelected && isEnvironmentSelectionLimitReached;
                          const credentialIssue = isLocalRuntime()
                            ? getLocalAwsCredentialIssueMessage(opt.profile)
                            : '';
                          return (
                            <label
                              key={opt.key}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '12px',
                                borderRadius: '8px',
                                border: isSelected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                                backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                transition: 'all 0.15s ease',
                                opacity: isDisabled ? 0.6 : 1,
                              }}
                            >
                              <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '4px',
                                border: isSelected ? '2px solid #3b82f6' : '2px solid #d1d5db',
                                backgroundColor: isSelected ? '#3b82f6' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}>
                                {isSelected && <Check size={14} style={{ color: 'white' }} />}
                              </div>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={isDisabled}
                                onChange={() => {
                                  let updatedProfiles;
                                  if (isSelected) {
                                    updatedProfiles = selectedAuthProfiles.filter(
                                      (p) => p?.awsAccountId !== opt.authProfile?.awsAccountId
                                    );
                                  } else {
                                    updatedProfiles = [...selectedAuthProfiles, { ...opt.authProfile }];
                                  }
                                  updateSelectedEnvironmentProfiles(updatedProfiles);
                                }}
                                style={{ display: 'none' }}
                              />
                              <span style={{ minWidth: 0 }}>
                                <span
                                  style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    color: '#374151',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {opt.label}
                                </span>
                                {credentialIssue ? (
                                  <span
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      marginTop: '3px',
                                      fontSize: '12px',
                                      color: '#b45309',
                                    }}
                                  >
                                    <AlertTriangle size={12} />
                                    Credentials need attention
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          onClick={() => {
                            setEnvironmentSearchQuery('');
                            setIsEnvModalOpen(false);
                          }}
                        >
                          Done
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Popover
                open={isPermissionProfileComboboxOpen}
                onOpenChange={setIsPermissionProfileComboboxOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={isPermissionProfileComboboxOpen}
                    disabled={permissionProfileOptions.length === 0}
                    className="w-full justify-between bg-gray-50 px-3 text-left text-sm font-normal text-gray-900 hover:bg-gray-100"
                    style={{ height: '44px' }}
                  >
                    <span className="truncate">
                      {selectedPermissionProfileOption?.label ||
                        (permissionProfileOptions.length > 0
                          ? 'Select a permission profile'
                          : 'No permission profiles available')}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="z-[9999] w-[var(--radix-popover-trigger-width)] bg-white p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Search AWS accounts..." />
                    <CommandList>
                      <CommandEmpty>No permission profiles found.</CommandEmpty>
                      <CommandGroup>
                        {permissionProfileOptions.map((opt) => {
                          const credentialIssue = isLocalRuntime()
                            ? getLocalAwsCredentialIssueMessage(opt.profile)
                            : '';
                          return (
                            <CommandItem
                              key={opt.key}
                              value={opt.label}
                              onSelect={() => {
                                handleDataChange('permissionProfile', opt.value);
                                const selectedAuthProfile = opt.authProfile || {};
                                handleInputSettingsChange(
                                  'authProfile',
                                  selectedAuthProfile
                                );
                                handleInputSettingsChange('authProfiles', [
                                  selectedAuthProfile,
                                ]);
                                handleInputSettingsChange(
                                  'permissionProfileId',
                                  selectedAuthProfile?.permissionProfileId || ''
                                );
                                if (opt.defaultRegions.length > 0) {
                                  handleInputSettingsChange(
                                    'regions',
                                    opt.defaultRegions
                                  );
                                }
                                setIsPermissionProfileComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  editedData.permissionProfile === opt.value
                                    ? 'opacity-100'
                                    : 'opacity-0'
                                )}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate">{opt.label}</span>
                                {credentialIssue ? (
                                  <span className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
                                    <AlertTriangle className="h-3 w-3 shrink-0" />
                                    <span className="truncate">Credentials need attention</span>
                                  </span>
                                ) : null}
                              </span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
            {!editedData.multiEnvironment && selectedEnvironmentCredentialIssue ? (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{selectedEnvironmentCredentialIssue}</span>
              </div>
            ) : null}
          </div>

          {isTaskNode &&
            (editedData.multiEnvironment || isDynamicTargetsEnabled) && (
            <div style={formGroupStyle}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
                Execution Mode
                <div style={{ position: 'relative', display: 'inline-flex' }} className="group">
                  <HelpCircle size={14} style={{ color: '#9ca3af', cursor: 'help' }} />
                  <div style={{
                    position: 'absolute',
                    left: '50%',
                    bottom: '100%',
                    transform: 'translateX(-50%)',
                    marginBottom: '8px',
                    padding: '10px 12px',
                    backgroundColor: '#1f2937',
                    color: 'white',
                    borderRadius: '8px',
                    fontSize: '12px',
                    width: '220px',
                    lineHeight: '1.4',
                    zIndex: 50,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    display: 'none',
                  }} className="group-hover:!block">
                    <strong style={{ display: 'block', marginBottom: '4px' }}>Wait for all:</strong>
                    The workflow waits until all environments complete before moving to the next node.
                    <strong style={{ display: 'block', marginTop: '8px', marginBottom: '4px' }}>Advance as each completes:</strong>
                    The workflow continues to the next node as soon as each environment finishes independently.
                    <div style={{
                      position: 'absolute',
                      left: '50%',
                      bottom: '-6px',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderTop: '6px solid #1f2937',
                    }} />
                  </div>
                </div>
              </label>
              <select
                value={editedData.advanceMode || 'all'}
                onChange={(e) => handleDataChange('advanceMode', e.target.value)}
                style={inputStyle}
              >
                <option value="all">Wait for all environments</option>
                <option value="each">Advance as each completes</option>
              </select>
            </div>
          )}

          <div style={{ ...formGroupStyle, marginBottom: 0 }}>
            <label style={labelStyle}>
              AWS Regions
              {!isDynamicTargetsEnabled ? (
                <>
                  {' '}
                  <span style={{ color: '#ef4444' }}>*</span>
                </>
              ) : null}
            </label>
            {isDynamicTargetsEnabled ? (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px dashed #cbd5e1',
                  backgroundColor: '#f8fafc',
                  color: '#64748b',
                  fontSize: '12px',
                  lineHeight: '1.5',
                }}
              >
                AWS regions will be resolved dynamically from the previous node
                output. If none are explicit, the resolver can fall back to the
                selected permission profiles&apos; default regions.
              </div>
            ) : (
              <>
                {/* Show selected regions */}
                {(editedData.inputSettings?.regions || []).length > 0 ? (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {(editedData.inputSettings?.regions || []).map((region) => (
                        <div
                          key={region}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 8px',
                            backgroundColor: '#f0f9ff',
                            border: '1px solid #bae6fd',
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: '#0369a1',
                            fontWeight: '500',
                          }}
                        >
                          {region}
                          <button
                            onClick={() => {
                              const updatedRegions = (editedData.inputSettings?.regions || []).filter(r => r !== region);
                              handleInputSettingsChange('regions', updatedRegions);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <X size={12} style={{ color: '#6b7280' }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRegionsModalOpen(true)}
                  className="w-full"
                >
                  <Plus size={14} className="mr-2" />
                  {(editedData.inputSettings?.regions || []).length > 0 ? 'Manage Regions' : 'Select Regions'}
                </Button>

                {/* Regions Selection Modal */}
                {isRegionsModalOpen && (
                  <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100,
                  }}>
                    <div style={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      padding: '20px',
                      width: '90%',
                      maxWidth: '400px',
                      maxHeight: '80vh',
                      overflow: 'auto',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Select AWS Regions</h3>
                        <button
                          onClick={() => setIsRegionsModalOpen(false)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                        >
                          <X size={20} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {getRegionOptions().map((opt) => {
                          const isSelected = (editedData.inputSettings?.regions || []).includes(opt.value);
                          return (
                            <label
                              key={opt.value}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: isSelected ? '2px solid #0ea5e9' : '1px solid #e5e7eb',
                                backgroundColor: isSelected ? '#f0f9ff' : '#ffffff',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <div style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '4px',
                                border: isSelected ? '2px solid #0ea5e9' : '2px solid #d1d5db',
                                backgroundColor: isSelected ? '#0ea5e9' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}>
                                {isSelected && <Check size={12} style={{ color: 'white' }} />}
                              </div>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  const currentRegions = editedData.inputSettings?.regions || [];
                                  let updatedRegions;
                                  if (isSelected) {
                                    updatedRegions = currentRegions.filter(r => r !== opt.value);
                                  } else {
                                    updatedRegions = [...currentRegions, opt.value];
                                  }
                                  handleInputSettingsChange('regions', updatedRegions);
                                }}
                                style={{ display: 'none' }}
                              />
                              <span style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>
                                {opt.text}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                        <Button onClick={() => setIsRegionsModalOpen(false)}>
                          Done
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
            </>
          ) : isAzureProvider ? (
            <>
              <div style={{ marginBottom: '12px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: '#374151',
                    cursor: 'pointer',
                    padding: '8px 12px',
                    backgroundColor: editedData.multiEnvironment ? '#eff6ff' : '#f9fafb',
                    borderRadius: '8px',
                    border: editedData.multiEnvironment ? '1px solid #bfdbfe' : '1px solid #e5e7eb',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(editedData.multiEnvironment)}
                    onChange={(e) =>
                      handleStaticMultiEnvironmentToggle(e.target.checked)
                    }
                    style={{ accentColor: '#3b82f6' }}
                  />
                  <span style={{ fontWeight: '500' }}>
                    Run in multiple cloud environments
                  </span>
                </label>
              </div>

              {editedData.multiEnvironment ? (
                <div style={{ ...formGroupStyle, marginBottom: 0 }}>
                  <label style={labelStyle}>
                    Azure Tenants <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  {azureTenantOptions.length === 0 ? (
                    <div
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #fee2e2',
                        backgroundColor: '#fef2f2',
                        color: '#991b1b',
                        fontSize: '12px',
                      }}
                    >
                      No Azure tenants available.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {azureTenantOptions.map((opt) => {
                        const isSelected = selectedAzureTenantProfiles.some(
                          (profile) => profile?.tenantId === opt.authProfile?.tenantId
                        );
                        const selectedCount = getSelectedAzureSubscriptionsForTenant(
                          opt.authProfile?.tenantId
                        ).length;
                        return (
                          <div
                            key={opt.key}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: isSelected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                              backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                const updatedTenants = isSelected
                                  ? selectedAzureTenantProfiles.filter(
                                      (profile) =>
                                        profile?.tenantId !== opt.authProfile?.tenantId
                                    )
                                  : [
                                      ...selectedAzureTenantProfiles,
                                      { ...opt.authProfile },
                                    ];
                                updateSelectedAzureTenants(updatedTenants);
                              }}
                              style={{ accentColor: '#3b82f6' }}
                            />
                            <span style={{ flex: 1, fontSize: '13px', fontWeight: '500', color: '#374151' }}>
                              {opt.label}
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>
                              {selectedCount} subscription{selectedCount === 1 ? '' : 's'}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!isSelected}
                              onClick={() =>
                                setAzureSubscriptionModalTenantId(
                                  opt.authProfile?.tenantId || null
                                )
                              }
                            >
                              Manage
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>
                      Azure Tenant <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      value={azureTenantOption?.value || ''}
                      onChange={(e) => {
                        const option = azureTenantOptions.find(
                          (opt) => opt.value === e.target.value
                        );
                        selectAzureTenant(option || null);
                      }}
                      style={inputStyle}
                    >
                      <option value="">
                        {azureTenantOptions.length > 0
                          ? 'Select an Azure tenant'
                          : 'No Azure tenants available'}
                      </option>
                      {azureTenantOptions.map((opt) => (
                        <option key={opt.key} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ ...formGroupStyle, marginBottom: 0 }}>
                    <label style={labelStyle}>
                      Azure Subscriptions <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    {!azureTenantOption ? (
                      <div
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px dashed #cbd5e1',
                          backgroundColor: '#f8fafc',
                          color: '#64748b',
                          fontSize: '12px',
                          lineHeight: '1.5',
                        }}
                      >
                        Select an Azure tenant to choose subscriptions under it.
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          setAzureSubscriptionModalTenantId(
                            azureTenantOption.authProfile?.tenantId || null
                          )
                        }
                      >
                        Manage Subscriptions (
                        {getSelectedAzureSubscriptionsForTenant(
                          azureTenantOption.authProfile?.tenantId
                        ).length}
                        )
                      </Button>
                    )}
                  </div>
                </>
              )}

              {azureSubscriptionModalTenantOption && (
                <div style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 100,
                }}>
                  <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    width: '90%',
                    maxWidth: '520px',
                    maxHeight: '80vh',
                    overflow: 'auto',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                          Select Azure Subscriptions
                        </h3>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                          {azureSubscriptionModalTenantOption.label}
                        </p>
                      </div>
                      <button
                        onClick={() => setAzureSubscriptionModalTenantId(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                      >
                        <X size={20} />
                      </button>
                    </div>
                    {(() => {
                      const tenantId = azureSubscriptionModalTenantOption.authProfile?.tenantId;
                      const tenantSubscriptions = getAzureSubscriptionsForTenant(tenantId);
                      const selectedTenantSubscriptions =
                        getSelectedAzureSubscriptionsForTenant(tenantId);
                      const canSelectMultipleSubscriptions =
                        !isCloudTask || Boolean(editedData.multiEnvironment);
                      return (
                        <>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
                            {canSelectMultipleSubscriptions && (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={tenantSubscriptions.length === 0}
                                  onClick={() =>
                                    updateSelectedAzureSubscriptionsForTenant(
                                      tenantId,
                                      tenantSubscriptions.map((opt) => ({ ...opt.authProfile }))
                                    )
                                  }
                                >
                                  Select all
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={selectedTenantSubscriptions.length === 0}
                                  onClick={() =>
                                    updateSelectedAzureSubscriptionsForTenant(tenantId, [])
                                  }
                                >
                                  Deselect all
                                </Button>
                              </>
                            )}
                            <span style={{ alignSelf: 'center', fontSize: '12px', color: '#64748b' }}>
                              {selectedTenantSubscriptions.length} / {tenantSubscriptions.length} selected
                            </span>
                            {!canSelectMultipleSubscriptions && (
                              <span style={{ fontSize: '12px', color: '#64748b' }}>
                                Cloud tasks can use one subscription unless multi-environment is enabled.
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {tenantSubscriptions.length === 0 ? (
                              <div
                                style={{
                                  padding: '12px',
                                  borderRadius: '8px',
                                  border: '1px solid #fee2e2',
                                  backgroundColor: '#fef2f2',
                                  color: '#991b1b',
                                  fontSize: '12px',
                                }}
                              >
                                No Azure subscriptions were found for this tenant.
                              </div>
                            ) : (
                              tenantSubscriptions.map((opt) => {
                                const isSelected = selectedTenantSubscriptions.some(
                                  (profile) =>
                                    profile?.subscriptionId ===
                                    opt.authProfile?.subscriptionId
                                );
                                return (
                                  <label
                                    key={opt.key}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '10px',
                                      padding: '10px 12px',
                                      borderRadius: '8px',
                                      border: isSelected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <input
                                      type={canSelectMultipleSubscriptions ? 'checkbox' : 'radio'}
                                      name={`azure-subscription-${tenantId}`}
                                      checked={isSelected}
                                      onChange={() => {
                                        const updatedSubscriptions =
                                          canSelectMultipleSubscriptions
                                            ? isSelected
                                              ? selectedTenantSubscriptions.filter(
                                                  (profile) =>
                                                    profile?.subscriptionId !==
                                                    opt.authProfile?.subscriptionId
                                                )
                                              : [
                                                  ...selectedTenantSubscriptions,
                                                  { ...opt.authProfile },
                                                ]
                                            : [{ ...opt.authProfile }];
                                        updateSelectedAzureSubscriptionsForTenant(
                                          tenantId,
                                          updatedSubscriptions
                                        );
                                      }}
                                      style={{ accentColor: '#3b82f6' }}
                                    />
                                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>
                                      {opt.label}
                                    </span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </>
                      );
                    })()}
                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                      <Button onClick={() => setAzureSubscriptionModalTenantId(null)}>
                        Done
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {editedData.multiEnvironment && (
                <div style={formGroupStyle}>
                  <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Execution Mode
                    <div style={{ position: 'relative', display: 'inline-flex' }} className="group">
                      <HelpCircle size={14} style={{ color: '#9ca3af', cursor: 'help' }} />
                      <div style={{
                        position: 'absolute',
                        left: '50%',
                        bottom: '100%',
                        transform: 'translateX(-50%)',
                        marginBottom: '8px',
                        padding: '10px 12px',
                        backgroundColor: '#1f2937',
                        color: 'white',
                        borderRadius: '8px',
                        fontSize: '12px',
                        width: '220px',
                        lineHeight: '1.4',
                        zIndex: 50,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        display: 'none',
                      }} className="group-hover:!block">
                        <strong style={{ display: 'block', marginBottom: '4px' }}>Wait for all:</strong>
                        The workflow waits until all environments complete before moving to the next node.
                        <strong style={{ display: 'block', marginTop: '8px', marginBottom: '4px' }}>Advance as each completes:</strong>
                        The workflow continues to the next node as soon as each environment finishes independently.
                      </div>
                    </div>
                  </label>
                  <select
                    value={editedData.advanceMode || 'all'}
                    onChange={(e) => handleDataChange('advanceMode', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="all">Wait for all environments</option>
                    <option value="each">Advance as each completes</option>
                  </select>
                </div>
              )}
            </>
          ) : isGoogleWorkspaceProvider ? (
            <>
              <div style={{ marginBottom: '12px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: '#374151',
                    cursor: 'pointer',
                    padding: '8px 12px',
                    backgroundColor: editedData.multiEnvironment ? '#eff6ff' : '#f9fafb',
                    borderRadius: '8px',
                    border: editedData.multiEnvironment ? '1px solid #bfdbfe' : '1px solid #e5e7eb',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(editedData.multiEnvironment)}
                    onChange={(e) => {
                      const isEnabled = e.target.checked;
                      handleStaticMultiEnvironmentToggle(isEnabled);
                      if (isEnabled) {
                        const currentProfiles = selectedGoogleWorkspaceProfiles.length > 0
                          ? selectedGoogleWorkspaceProfiles
                          : editedData.inputSettings?.authProfile
                          ? [editedData.inputSettings.authProfile]
                          : [];
                        updateSelectedGoogleWorkspaceProfiles(currentProfiles);
                      } else {
                        const selectedSingle = googleWorkspaceOptions.find(
                          (opt) => opt.value === editedData.permissionProfile
                        );
                        const fallbackProfile =
                          selectedSingle?.authProfile ||
                          selectedGoogleWorkspaceProfiles[0] ||
                          null;
                        selectGoogleWorkspaceProfile(
                          fallbackProfile
                            ? googleWorkspaceOptions.find(
                                (opt) =>
                                  opt.authProfile?.domain === fallbackProfile.domain ||
                                  opt.authProfile?.permissionProfileId ===
                                    fallbackProfile.permissionProfileId
                              )
                            : null
                        );
                      }
                    }}
                    style={{ accentColor: '#3b82f6' }}
                  />
                  <span style={{ fontWeight: '500' }}>
                    Run in multiple cloud environments
                  </span>
                </label>
              </div>

              <div style={{ ...formGroupStyle, marginBottom: 0 }}>
                <label style={labelStyle}>
                  Google Workspace Profile{editedData.multiEnvironment ? 's' : ''}{' '}
                  <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {editedData.multiEnvironment ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {googleWorkspaceOptions.length === 0 ? (
                      <div
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px solid #fee2e2',
                          backgroundColor: '#fef2f2',
                          color: '#991b1b',
                          fontSize: '12px',
                        }}
                      >
                        No Google Workspace profiles available.
                      </div>
                    ) : (
                      googleWorkspaceOptions.map((opt) => {
                        const isSelected = selectedGoogleWorkspaceProfiles.some(
                          (profile) =>
                            profile?.domain === opt.authProfile?.domain ||
                            profile?.permissionProfileId ===
                              opt.authProfile?.permissionProfileId
                        );
                        return (
                          <label
                            key={opt.key}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: isSelected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                              backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                const updatedProfiles = isSelected
                                  ? selectedGoogleWorkspaceProfiles.filter(
                                      (profile) =>
                                        profile?.domain !== opt.authProfile?.domain &&
                                        profile?.permissionProfileId !==
                                          opt.authProfile?.permissionProfileId
                                    )
                                  : [
                                      ...selectedGoogleWorkspaceProfiles,
                                      { ...opt.authProfile },
                                    ];
                                updateSelectedGoogleWorkspaceProfiles(updatedProfiles);
                              }}
                              style={{ accentColor: '#3b82f6' }}
                            />
                            <span style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>
                              {opt.label}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <select
                    value={googleWorkspaceOption?.value || ''}
                    onChange={(e) => {
                      const option = googleWorkspaceOptions.find(
                        (opt) => opt.value === e.target.value
                      );
                      selectGoogleWorkspaceProfile(option || null);
                    }}
                    style={inputStyle}
                  >
                    <option value="">
                      {googleWorkspaceOptions.length > 0
                        ? 'Select a Google Workspace profile'
                        : 'No Google Workspace profiles available'}
                    </option>
                    {googleWorkspaceOptions.map((opt) => (
                      <option key={opt.key} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {editedData.multiEnvironment && (
                <div style={formGroupStyle}>
                  <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Execution Mode
                    <div style={{ position: 'relative', display: 'inline-flex' }} className="group">
                      <HelpCircle size={14} style={{ color: '#9ca3af', cursor: 'help' }} />
                      <div style={{
                        position: 'absolute',
                        left: '50%',
                        bottom: '100%',
                        transform: 'translateX(-50%)',
                        marginBottom: '8px',
                        padding: '10px 12px',
                        backgroundColor: '#1f2937',
                        color: 'white',
                        borderRadius: '8px',
                        fontSize: '12px',
                        width: '220px',
                        lineHeight: '1.4',
                        zIndex: 50,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        display: 'none',
                      }} className="group-hover:!block">
                        <strong style={{ display: 'block', marginBottom: '4px' }}>Wait for all:</strong>
                        The workflow waits until all environments complete before moving to the next node.
                        <strong style={{ display: 'block', marginTop: '8px', marginBottom: '4px' }}>Advance as each completes:</strong>
                        The workflow continues to the next node as soon as each environment finishes independently.
                      </div>
                    </div>
                  </label>
                  <select
                    value={editedData.advanceMode || 'all'}
                    onChange={(e) => handleDataChange('advanceMode', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="all">Wait for all environments</option>
                    <option value="each">Advance as each completes</option>
                  </select>
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#64748b',
                fontSize: '12px',
                lineHeight: '1.5',
              }}
            >
              Select a supported AWS, Azure, or Google Workspace blueprint to
              configure cloud environment settings.
            </div>
          )}
        </div>
      )}
      {/* Communication Node Specific Fields */}
      {node.type === NODE_TYPES.COMMUNICATION && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>
            <MessageSquare size={14} /> Communication Settings
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>
              Communication Type <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              value={editedData.communicationType || 'email'}
              onChange={(e) =>
                handleDataChange('communicationType', e.target.value)
              }
              style={inputStyle}
            >
              <option value="email">Email</option>
              <option value="slack" disabled>
                Slack (coming soon)
              </option>
              <option value="sms" disabled>
                SMS (coming soon)
              </option>
            </select>
          </div>
          {editedData.communicationType === 'email' && (
            <div style={{ ...formGroupStyle, marginBottom: 0 }}>
              <label style={labelStyle}>
                Recipients <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                placeholder="Enter email addresses, separated by commas"
                value={editedData.recipients || ''}
                onChange={(e) => handleDataChange('recipients', e.target.value)}
                style={{
                  ...textareaStyle,
                  minHeight: '60px',
                  border: validationErrors.recipients ? '1px solid #ef4444' : textareaStyle.border,
                  boxShadow: validationErrors.recipients
                    ? '0 0 0 3px rgba(239,68,68,0.1)'
                    : undefined,
                }}
              />
            </div>
          )}
        </div>
      )}

      {node.type === NODE_TYPES.END && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>
            <FileText size={14} /> Workflow Summary
          </div>
          <div style={{ ...formGroupStyle, marginBottom: 0 }}>
            <label style={labelStyle}>Summary Instructions</label>
            <textarea
              placeholder='Optional. Example: "Summarize the final results by account, call out failures, and mention whether notifications were sent."'
              value={editedData.summaryInstructions || ''}
              onChange={(e) => handleDataChange('summaryInstructions', e.target.value)}
              style={textareaStyle}
            />
            <small
              style={{
                marginTop: '6px',
                display: 'block',
                color: '#6b7280',
                fontSize: '11px',
                lineHeight: '1.4',
              }}
            >
              When the workflow completes, these instructions guide the generated run summary shown in workflow history.
            </small>
          </div>
        </div>
      )}

      {/* Logic/Description Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <List size={14} /> Notes & Description
        </div>
        <div style={{ ...formGroupStyle, marginBottom: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              marginBottom: '6px',
            }}
          >
            <label style={{ ...labelStyle, marginBottom: 0 }}>
              Logic / Description
            </label>
            <button
              type="button"
              onClick={() =>
                setLogicEditor({
                  kind: 'logic',
                  title: 'Edit Logic / Description',
                  subtitle: editedData.name || node.id,
                  value: editedData.logic || '',
                })
              }
              title="Open in expanded editor"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 6px',
                fontSize: '11px',
                color: '#2563eb',
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              className="hover:bg-blue-50 hover:border-blue-200"
            >
              <Maximize2 size={12} />
              Expand
            </button>
          </div>
          <textarea
            placeholder="Describe what this node does (optional)"
            value={editedData.logic || ''}
            onChange={(e) => handleDataChange('logic', e.target.value)}
            style={textareaStyle}
          />
        </div>
      </div>

      {/* Decision Specific Fields */}
      {isDecision && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>
            <GitBranch size={14} /> Branch Configuration
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Number of Branches</label>
            <input
              type="number"
              value={editedData.branches || 0}
              min="0"
              onChange={(e) =>
                handleDataChange('branches', parseInt(e.target.value, 10) || 0)
              }
              style={{ ...inputStyle, width: '100px' }}
            />
            <small style={{ marginTop: '6px', display: 'block', color: '#6b7280', fontSize: '11px' }}>
              Expected number of outgoing paths
            </small>
          </div>
          
          {(node.data.next || []).length > 0 && (
            <div style={{ ...formGroupStyle, marginBottom: 0 }}>
              <label style={labelStyle}>Branch Logic</label>
              {(node.data.next || []).map((nextId, index) => {
                const nextNodeTitle = nodeMap.get(nextId)?.data?.name || nextId;
                const entry = editedData.branchLogic?.[nextId] || {
                  logic: '',
                  title: nextNodeTitle,
                };
                return (
                  <div 
                    key={nextId} 
                    style={{ 
                      marginBottom: index < (node.data.next || []).length - 1 ? '12px' : 0,
                      padding: '12px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      marginBottom: '8px',
                    }}>
                      <div style={{
                        fontWeight: '600',
                        fontSize: '13px',
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        minWidth: 0,
                      }}>
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: '#8b5cf6',
                          flexShrink: 0,
                        }} />
                        <span style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>{nextNodeTitle}</span>
                      </div>
                      <button
                        type="button"
                        disabled={entry.runAlways}
                        onClick={() =>
                          setLogicEditor({
                            kind: 'branchLogic',
                            branchNextId: nextId,
                            title: 'Edit Branch Logic',
                            subtitle: `Branch to: ${nextNodeTitle}`,
                            value: entry.logic || '',
                          })
                        }
                        title={
                          entry.runAlways
                            ? 'Disable "Run unconditionally" to edit'
                            : 'Open in expanded editor'
                        }
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 6px',
                          fontSize: '11px',
                          color: entry.runAlways ? '#9ca3af' : '#2563eb',
                          background: 'transparent',
                          border: '1px solid transparent',
                          borderRadius: '4px',
                          cursor: entry.runAlways ? 'not-allowed' : 'pointer',
                          flexShrink: 0,
                        }}
                        className={
                          entry.runAlways
                            ? ''
                            : 'hover:bg-blue-50 hover:border-blue-200'
                        }
                      >
                        <Maximize2 size={12} />
                        Expand
                      </button>
                    </div>
                    <label 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: '#6b7280',
                        marginBottom: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={entry.runAlways}
                        onChange={(e) => {
                          handleDataChange('branchLogic', {
                            ...editedData.branchLogic,
                            [nextId]: {
                              ...entry,
                              runAlways: !entry.runAlways,
                            },
                          });
                        }}
                        style={{ accentColor: '#8b5cf6' }}
                      />
                      Run unconditionally
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Enter condition for this branch..."
                      value={entry.logic}
                      disabled={entry.runAlways}
                      onChange={(e) =>
                        handleDataChange('branchLogic', {
                          ...editedData.branchLogic,
                          [nextId]: {
                            ...entry,
                            logic: e.target.value,
                          },
                        })
                      }
                      style={{
                        ...textareaStyle,
                        minHeight: '50px',
                        opacity: entry.runAlways ? 0.5 : 1,
                        backgroundColor: entry.runAlways ? '#f3f4f6' : '#ffffff',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <LogicEditModal
        isOpen={Boolean(logicEditor)}
        title={logicEditor?.title || 'Edit Logic'}
        subtitle={logicEditor?.subtitle}
        initialValue={logicEditor?.value || ''}
        placeholder={
          logicEditor?.kind === 'branchLogic'
            ? 'Enter the condition that should trigger this branch...'
            : 'Describe what this node does (optional)'
        }
        onClose={() => setLogicEditor(null)}
        onSave={(nextValue) => {
          if (!logicEditor) return;
          if (logicEditor.kind === 'branchLogic') {
            const branchId = logicEditor.branchNextId;
            const existingEntry = editedData?.branchLogic?.[branchId] || {
              logic: '',
              title: nodeMap.get(branchId)?.data?.name || branchId,
            };
            handleDataChange('branchLogic', {
              ...(editedData?.branchLogic || {}),
              [branchId]: {
                ...existingEntry,
                logic: nextValue,
              },
            });
          } else {
            handleDataChange('logic', nextValue);
          }
          setLogicEditor(null);
        }}
      />
    </div>
  );
}

const AddNodePane = ({ onSelectType }) => {
  const addableNodeTypes = [
    {
      rfType: NODE_TYPES.CLOUD_TASK,
      label: 'Add Cloud Task',
    },
    {
      rfType: NODE_TYPES.REPORT_TASK,
      label: 'Add Report Task',
    },
    {
      rfType: NODE_TYPES.COMMUNICATION,
      label: 'Add Communication',
    },
    {
      rfType: NODE_TYPES.DECISION,
      label: 'Add Decision/Branch',
    },
    {
      rfType: NODE_TYPES.APPROVAL,
      label: 'Add Approval',
    },
  ];

  return (
    <div className="flex gap-2 justify-center flex-wrap">
      {addableNodeTypes.map(({ rfType, label }) => (
        <Button
          key={rfType}
          size="sm"
          variant="outline"
          className="flex items-center gap-2 bg-white border-gray-800 text-gray-800 hover:bg-gray-50 rounded-full px-4 py-2"
          onClick={() => onSelectType({ rfType })}
        >
          <Plus className="h-4 w-4 bg-gray-800 text-white rounded-full p-0.5" />
          {label}
        </Button>
      ))}
    </div>
  );
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({})); // Default settings for edges

// Function to get layouted elements using Dagre
export const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  // --- Constants ---
  const EDGE_SEPARATION = 30;
  const NODE_SEPARATION = 100; // Increase this value (try 100, 120, 150+) for more horizontal space between branches
  const RANK_SEPARATION = 100;
  // You might need to adjust these based on your baseNodeStyle or measurements
  const NODE_WIDTH = 250;
  const NODE_HEIGHT = 150; // Use average or max height if varied
  const NODE_WIDTH_BUFFER = 40; // Extra horizontal space (pixels)
  const NODE_HEIGHT_BUFFER = 20; // Extra vertical space (pixels)

  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: NODE_SEPARATION,
    ranksep: RANK_SEPARATION,
    edgesep: EDGE_SEPARATION,
  }); // Adjust nodesep/ranksep for spacing

  nodes.forEach((node) => {
    const width = (node.width || NODE_WIDTH) + NODE_WIDTH_BUFFER; // Add buffer
    const height = (node.height || NODE_HEIGHT) + NODE_HEIGHT_BUFFER; // Add buffer
    dagreGraph.setNode(node.id, { width: width, height: height });
  });

  edges.forEach((edge) => {
    const edgeOptions = {};
    if (edge.source === 'decision' && edge.target === 'end') {
      // Force the edge to span at least N ranks (e.g., 2 or 3 more than default)
      // Default length is 1 rank. Adjust based on your graph depth.
      edgeOptions.minlen = 1; // Experiment with this value
    }
    dagreGraph.setEdge(edge.source, edge.target, edgeOptions);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const originalWidth = node.width || NODE_WIDTH; // Use original width
    const originalHeight = node.height || NODE_HEIGHT; // Use original height
    // We need to center the node position based on the node's dimensions
    // dagre sets position to top-left corner, adjust for center if your node anchor is center
    const newPosition = {
      x: nodeWithPosition.x - originalWidth / 2, // Center using original size
      y: nodeWithPosition.y - originalHeight / 2, // Center using original size
    };

    return { ...node, position: newPosition };
  });

  return layoutedNodes; // Return only nodes with updated positions
};

// New function for straight horizontal line layout with parallel branches
export const getLinearLayoutedElements = (nodes, edges) => {
  const NODE_WIDTH = 250;
  const NODE_HEIGHT = 150;
  const HORIZONTAL_SPACING = 300; // Space between main flow nodes
  const BRANCH_SPACING = 200; // Space between parallel branch nodes
  const START_X = 100;
  const CENTER_Y = 200; // Main flow Y coordinate
  const BRANCH_Y_OFFSET = 100; // Vertical offset for branches

  // Build a map of node dependencies
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map(nodes.map((n) => [n.id, 0]));
  const children = new Map(nodes.map((n) => [n.id, []]));
  const parents = new Map(nodes.map((n) => [n.id, []]));

  // Calculate in-degrees, children, and parents
  edges.forEach((edge) => {
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    const sourceChildren = children.get(edge.source) || [];
    sourceChildren.push(edge.target);
    children.set(edge.source, sourceChildren);

    const targetParents = parents.get(edge.target) || [];
    targetParents.push(edge.source);
    parents.set(edge.target, targetParents);
  });

  // Find start nodes (nodes with no incoming edges)
  const startNodes = nodes.filter((node) => inDegree.get(node.id) === 0);

  // Find end nodes (nodes with no outgoing edges)
  const endNodes = nodes.filter(
    (node) => (children.get(node.id) || []).length === 0
  );

  // If no clear start/end, use first node as start
  const startNode = startNodes.length > 0 ? startNodes[0] : nodes[0];
  const endNode = endNodes.length > 0 ? endNodes[0] : nodes[nodes.length - 1];

  // Create a layered ordering with parallel branches
  const visited = new Set();
  const layers = [];
  const nodeLayer = new Map();

  // BFS to create layers
  const queue = [{ nodeId: startNode.id, layer: 0 }];
  visited.add(startNode.id);
  nodeLayer.set(startNode.id, 0);

  while (queue.length > 0) {
    const { nodeId, layer } = queue.shift();

    // Ensure layer exists
    if (!layers[layer]) layers[layer] = [];
    layers[layer].push(nodeId);

    const currentChildren = children.get(nodeId) || [];
    currentChildren.forEach((childId) => {
      if (!visited.has(childId)) {
        visited.add(childId);
        // Check if this is a decision node with multiple children
        const isDecision = currentChildren.length > 1;
        // If it's a decision node, place children in layer + 2 (skip one layer)
        // Otherwise, place in layer + 1
        const childLayer = isDecision ? layer + 2 : layer + 1;
        nodeLayer.set(childId, childLayer);
        queue.push({ nodeId: childId, layer: childLayer });
      }
    });
  }

  // Add any remaining nodes to the last layer
  nodes.forEach((node) => {
    if (!visited.has(node.id)) {
      const lastLayer = layers.length > 0 ? layers.length - 1 : 0;
      if (!layers[lastLayer]) layers[lastLayer] = [];
      layers[lastLayer].push(node.id);
      nodeLayer.set(node.id, lastLayer);
    }
  });

  // First pass: Calculate basic positions for all nodes
  const nodePositions = new Map();

  // Identify decision nodes and their branches
  const decisionNodes = new Set();
  const branchGroups = new Map(); // Maps decision node ID to array of branch node IDs

  nodes.forEach((node) => {
    const nodeChildren = children.get(node.id) || [];
    if (nodeChildren.length > 1) {
      decisionNodes.add(node.id);
      branchGroups.set(node.id, nodeChildren);
    }
  });

  // Calculate positions layer by layer to ensure proper spacing
  layers.forEach((layerNodes, layerIndex) => {
    const layerX = START_X + layerIndex * HORIZONTAL_SPACING;

    layerNodes.forEach((nodeId) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;

      // Check if this node is a branch of a decision node
      let isBranch = false;
      let parentDecision = null;
      for (const [decisionId, branches] of branchGroups.entries()) {
        if (branches.includes(nodeId)) {
          isBranch = true;
          parentDecision = decisionId;
          break;
        }
      }

      let x, y;

      if (isBranch && parentDecision) {
        // Skip branch positioning here - will be handled in the third pass
        // Just set a temporary position to avoid errors
        x = layerX;
        y = CENTER_Y;
      } else if (layerNodes.length > 1 && !decisionNodes.has(nodeId)) {
        // Parallel nodes in same layer (not decision nodes): spread them horizontally
        const totalWidth = (layerNodes.length - 1) * BRANCH_SPACING;
        const startX = layerX - totalWidth / 2;
        const nodeIndexInLayer = layerNodes.indexOf(nodeId);
        x = startX + nodeIndexInLayer * BRANCH_SPACING;
        y = CENTER_Y;
      } else {
        // Single node in layer, decision node, or other: center it
        x = layerX;
        y = CENTER_Y;
      }

      nodePositions.set(nodeId, { x, y });
    });
  });

  // Second pass: Handle merge nodes by positioning them at the center of their parents
  nodes.forEach((node) => {
    const nodeParents = parents.get(node.id) || [];
    const isMergeNode = nodeParents.length > 1;

    if (isMergeNode) {
      const parentPositions = nodeParents.map((parentId) => {
        return nodePositions.get(parentId)?.x || 0;
      });
      const avgParentX =
        parentPositions.reduce((sum, pos) => sum + pos, 0) /
        parentPositions.length;
      nodePositions.set(node.id, { x: avgParentX, y: CENTER_Y });
    }
  });

  // Third pass: Position branches in their correct layers
  branchGroups.forEach((branches, decisionId) => {
    const decisionLayer = nodeLayer.get(decisionId) || 0;
    const decisionX = START_X + decisionLayer * HORIZONTAL_SPACING;
    const branchLayerX = START_X + (decisionLayer + 1) * HORIZONTAL_SPACING;

    branches.forEach((branchId, branchIndex) => {
      const totalBranches = branches.length;

      let x, y;

      if (totalBranches === 1) {
        // Single branch: place in its assigned layer on main line
        x = branchLayerX;
        y = CENTER_Y;
      } else {
        // Multiple branches: distribute them evenly above and below the main line
        x = branchLayerX;

        if (totalBranches === 2) {
          // Two branches: one above, one below
          y =
            branchIndex === 0
              ? CENTER_Y - BRANCH_Y_OFFSET
              : CENTER_Y + BRANCH_Y_OFFSET;
        } else {
          // Three or more branches: distribute evenly
          if (totalBranches === 3) {
            // Special case for 3 branches: one above, one on line, one below
            if (branchIndex === 0) {
              y = CENTER_Y - BRANCH_Y_OFFSET; // Above
            } else if (branchIndex === 1) {
              y = CENTER_Y; // On main line
            } else {
              y = CENTER_Y + BRANCH_Y_OFFSET; // Below
            }
          } else {
            // For 4+ branches: distribute evenly above and below
            const branchesAbove = Math.ceil(totalBranches / 2);
            const branchesBelow = totalBranches - branchesAbove;

            if (branchIndex < branchesAbove) {
              // Position above the main line
              const spacing =
                branchesAbove > 1 ? BRANCH_Y_OFFSET / (branchesAbove - 1) : 0;
              y = CENTER_Y - BRANCH_Y_OFFSET + branchIndex * spacing;
            } else {
              // Position below the main line
              const belowIndex = branchIndex - branchesAbove;
              const spacing =
                branchesBelow > 1 ? BRANCH_Y_OFFSET / (branchesBelow - 1) : 0;
              y = CENTER_Y + belowIndex * spacing;
            }
          }
        }
      }

      nodePositions.set(branchId, { x, y });
    });
  });

  // Create final layouted nodes
  const layoutedNodes = nodes.map((node) => {
    const position = nodePositions.get(node.id) || { x: 0, y: 0 };
    return {
      ...node,
      position,
    };
  });

  return layoutedNodes;
};

// FlowEditor Component
function FlowEditor({ workflowIdParam, isNewWorkflowParam = false }) {
  const reactFlowWrapper = useRef(null);
  const reactFlowInstance = useReactFlow();
  const params = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { userProfile, userProfileLoading } = useSelector(
    (state) => state.auth
  );
  const hasTeams = false;
  const location = useLocation();
  const { workflowName, workflowDescription } = location.state || {};
  const [workflowId, setWorkflowId] = useState(workflowIdParam || '');
  const [isNewWorkflow, setIsNewWorkflow] = useState(
    isNewWorkflowParam ? isNewWorkflowParam : false
  );

  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(true); // Start loading
  const [workflowLoadError, setWorkflowLoadError] = useState(null);
  const [fetchedWorkflowData, setFetchedWorkflowData] = useState(null); // Store fetched data
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);

  const [isWorkflowEditModalOpen, setIsWorkflowEditModalOpen] = useState(false);
  const [allBlueprints, setAllBlueprints] = useState([]);
  const [blueprintLoading, setBlueprintLoading] = useState(false);
  const [blueprintError, setBlueprintError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [workflowMeta, setWorkflowMeta] = useState({
    title: workflowName,
    description: workflowDescription,
  });
  const [nodes, setNodes, onNodesChangeBase] = useNodesState([]);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState([]);
  const [workflowSchedule, setWorkflowSchedule] = useState({});
  const [isNewlySaved, setIsNewlySaved] = useState(false);
  const [isLibrary, setIsLibrary] = useState(!!location?.state?.isLibrary);
  const [currentInputSummary, setCurrentInputSummary] = useState(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsBlueprintId, setSettingsBlueprintId] = useState(null);

  const [defaultSettingsMap, setDefaultSettingsMap] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalWorkflowData, setOriginalWorkflowData] = useState(null);
  const [isNewWorkflowSaved, setIsNewWorkflowSaved] = useState(false);

  // Natural-language workflow assistant state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [nlMessage, setNlMessage] = useState('');
  const [isNlLoading, setIsNlLoading] = useState(false);

  const [isBlueprintPreviewHidden, setIsBlueprintPreviewHidden] = useState(
    readBlueprintPreviewHiddenPreference
  );

  const updateBlueprintPreviewHidden = useCallback((nextValue) => {
    setIsBlueprintPreviewHidden((current) => {
      const resolved =
        typeof nextValue === 'function' ? nextValue(current) : nextValue;
      writeBlueprintPreviewHiddenPreference(Boolean(resolved));
      return Boolean(resolved);
    });
  }, []);

  // Build nodeMap before the useEffect that references it
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // Check for unsaved changes
  const checkForUnsavedChanges = useCallback(() => {
    if (!originalWorkflowData) {
      setHasUnsavedChanges(false);
      return;
    }

    // Create a simplified comparison that focuses on the key data that matters
    const currentNodesData = nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: {
        name: n.data.name,
        logic: n.data.logic,
        inputFrom: n.data.inputFrom,
        condition: n.data.condition,
        blueprintId: n.data.blueprintId,
        permissionProfile: n.data.permissionProfile,
        dynamicTargetsFromInput: Boolean(n.data.dynamicTargetsFromInput),
        multiEnvironment: n.data.multiEnvironment,
        advanceMode: n.data.advanceMode,
        inputSettings: n.data.inputSettings,
        action: n.data.action,
        recipients: n.data.recipients,
        branches: n.data.branches,
        branchLogic: n.data.branchLogic,
        schedule: n.data.schedule,
      },
    }));

    const originalNodesData = originalWorkflowData.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: {
        name: n.data.name,
        logic: n.data.logic,
        inputFrom: n.data.inputFrom,
        condition: n.data.condition,
        blueprintId: n.data.blueprintId,
        permissionProfile: n.data.permissionProfile,
        dynamicTargetsFromInput: Boolean(n.data.dynamicTargetsFromInput),
        multiEnvironment: n.data.multiEnvironment,
        advanceMode: n.data.advanceMode,
        inputSettings: n.data.inputSettings,
        action: n.data.action,
        recipients: n.data.recipients,
        branches: n.data.branches,
        branchLogic: n.data.branchLogic,
        schedule: n.data.schedule,
      },
    }));

    const currentData = {
      nodes: currentNodesData,
      edges: edges,
      workflowMeta: workflowMeta,
      workflowSchedule: workflowSchedule,
    };

    const originalData = {
      nodes: originalNodesData,
      edges: originalWorkflowData.edges,
      workflowMeta: originalWorkflowData.workflowMeta,
      workflowSchedule: originalWorkflowData.workflowSchedule,
    };

    const hasChanges =
      JSON.stringify(currentData) !== JSON.stringify(originalData);
    setHasUnsavedChanges(hasChanges);
  }, [nodes, edges, workflowMeta, workflowSchedule, originalWorkflowData]);

  // Update dirty state when data changes
  useEffect(() => {
    checkForUnsavedChanges();
  }, [checkForUnsavedChanges]);

  // Debug logging for dirty state
  // Keep each node's "next" up-to-date when edges change, and update branchLogic for Decision nodes
  useEffect(() => {
    setNodes((prev) => {
      // Build local nodeMap from prev
      const localMap = new Map(prev.map((n) => [n.id, n]));
      let didUpdate = false;
      const newNodes = prev.map((n) => {
        const nextList = edges
          .filter((e) => e.source === n.id)
          .map((e) => e.target);
        let newBranchLogic = { ...(n.data.branchLogic || {}) };
        if (n.type === NODE_TYPES.DECISION) {
          // Add missing branches
          nextList.forEach((targetId) => {
            if (!newBranchLogic[targetId]) {
              newBranchLogic[targetId] = {
                logic: '',
                title: localMap.get(targetId)?.data?.name || targetId,
              };
            }
          });
          // Remove old branches
          Object.keys(newBranchLogic).forEach((key) => {
            if (!nextList.includes(key)) {
              delete newBranchLogic[key];
            }
          });
        }
        const nextUnchanged =
          Array.isArray(n.data.next) &&
          n.data.next.length === nextList.length &&
          n.data.next.every((id, idx) => id === nextList[idx]);
        const logicKeys = n.data.branchLogic
          ? Object.keys(n.data.branchLogic)
          : [];
        const newKeys = Object.keys(newBranchLogic);
        const branchUnchanged =
          logicKeys.length === newKeys.length &&
          logicKeys.every((key) => newKeys.includes(key));
        if (nextUnchanged && branchUnchanged) {
          return n;
        }
        didUpdate = true;
        return {
          ...n,
          data: {
            ...n.data,
            next: nextList,
            ...(n.type === NODE_TYPES.DECISION && {
              branchLogic: newBranchLogic,
            }),
          },
        };
      });
      return didUpdate ? newNodes : prev;
    });
  }, [edges, setNodes]);
  const selectedNodeInfo = useMemo(() => {
    const node = nodes.find((n) => n.selected);
    if (!node) return { node: null, parentNames: [] };
    const parentIds = ensureInputFromArray(node.data.inputFrom);
    const parentNames = parentIds
      .map((id) => nodeMap.get(id)?.data?.name || `Unknown (${id})`)
      .filter(Boolean);
    return { node, parentNames };
  }, [nodes, nodeMap]);
  const [layoutApplied, setLayoutApplied] = useState(false);

  const mapCustomBlueprintToOption = useCallback((item) => {
    if (!item?.recordId) return null;

    const plan = safeParseJSON(item.plan, null);
    const planSettings = safeParseJSON(item.planSettings, {});

    return {
      id: item.recordId,
      title: item.title || 'Untitled Blueprint',
      description: normalizeBlueprintDescription(item.description),
      category: 'Custom',
      class: 'custom',
      type: 'agent',
      source: 'custom',
      cloudProvider:
        item.cloudProvider ||
        item.cloud_provider ||
        item.provider ||
        plan?.cloudProvider ||
        plan?.provider ||
        planSettings?.cloudProvider ||
        planSettings?.provider,
      status: item.status || null,
      updatedAt: item.updatedAt || null,
      plan,
      planSettings,
    };
  }, []);

  // Fetch both library blueprints and user custom blueprints for workflow task selection.
  const fetchBlueprints = useCallback(async () => {
    setBlueprintLoading(true);
    setBlueprintError(null);

    try {
      const [libraryResult, customResult] = await Promise.allSettled([
        fetchAgentList(),
        (async () => {
          const pageSize = 50;
          const maxPages = 20;
          let nextToken = null;
          let currentPage = 0;
          const allItems = [];

          do {
            const response = await graphQlClient.graphql({
              query: getBlueprintsQuery,
              variables: { count: pageSize, nextToken, hasTeams },
            });
            const payload = response?.data?.getBlueprints || {};
            const items = Array.isArray(payload.items) ? payload.items : [];
            const next = payload.nextToken || null;

            // Workaround for backend pagination behavior where first page can be empty with a nextToken.
            if (
              currentPage === 0 &&
              items.length === 0 &&
              next &&
              !nextToken
            ) {
              nextToken = next;
              currentPage += 1;
              continue;
            }

            allItems.push(...items);
            nextToken = next;
            currentPage += 1;
          } while (nextToken && currentPage < maxPages);

          return allItems;
        })(),
      ]);

      let libraryError = null;
      let customError = null;
      let libraryBlueprints = [];
      let customBlueprints = [];

      if (libraryResult.status === 'fulfilled') {
        try {
          const response = libraryResult.value;
          if (!response.ok) {
            throw new Error(
              `HTTP error! status: ${response.status} - ${response.statusText}`
            );
          }
          const data = await response.json();
          if (!Array.isArray(data)) {
            throw new Error(
              'Invalid data format received from blueprint library URL.'
            );
          }
          libraryBlueprints = data.filter((bp) => bp.active === true);
        } catch (error) {
          libraryError = error;
        }
      } else {
        libraryError = libraryResult.reason;
      }

      if (customResult.status === 'fulfilled') {
        try {
          const customItems = customResult.value || [];
          customBlueprints = customItems
            .map(mapCustomBlueprintToOption)
            .filter(Boolean);
        } catch (error) {
          customError = error;
        }
      } else {
        customError = customResult.reason;
      }

      const merged = [...customBlueprints, ...libraryBlueprints];
      const uniqueById = new Map();
      merged.forEach((bp) => {
        if (!bp?.id || uniqueById.has(bp.id)) return;
        uniqueById.set(bp.id, bp);
      });

      const all = Array.from(uniqueById.values());
      if (!all.length) {
        const errorMessage =
          libraryError?.message ||
          customError?.message ||
          'Failed to load blueprints.';
        throw new Error(errorMessage);
      }

      if (libraryError || customError) {
        console.warn('Partially loaded blueprints', {
          libraryError: libraryError?.message || null,
          customError: customError?.message || null,
        });
      }

      setAllBlueprints(all);
    } catch (e) {
      console.error('Failed to fetch or process blueprints:', e);
      setBlueprintError(e.message || 'Failed to load blueprints.');
    } finally {
      setBlueprintLoading(false);
    }
  }, [hasTeams, mapCustomBlueprintToOption]);

  useEffect(() => {
    fetchBlueprints();
  }, [fetchBlueprints]);

  const handleHeightMeasured = useCallback((nodeId, size) => {}, []);

  const openBlueprintModal = (specificBlueprintId = null) => {
    if (specificBlueprintId) {
      // 2) Preload any existing answers into your map:
      const existingInputs =
        selectedNodeInfo.node.data.inputSettings?.blueprintInputs || {};
      setDefaultSettingsMap(existingInputs);

      openBlueprintSettings(specificBlueprintId);
    } else {
      setIsBlueprintModalOpen(true);
    }
  };

  const fetchBlueprintDetails = useCallback(
    async (bpId) => {
      const selectedBlueprint = allBlueprints.find((bp) => bp.id === bpId);

      if (selectedBlueprint?.source === 'custom') {
        if (selectedBlueprint.plan) {
          return normalizeBlueprintDetails(
            selectedBlueprint.plan,
            selectedBlueprint.planSettings
          );
        }

        const response = await graphQlClient.graphql({
          query: getBlueprintQuery,
          variables: { recordId: bpId, hasTeams },
        });
        const customBlueprint = response?.data?.getBlueprint;
        if (!customBlueprint) {
          throw new Error(`Custom blueprint ${bpId} not found`);
        }

        const details = normalizeBlueprintDetails(
          customBlueprint.plan,
          customBlueprint.planSettings
        );

        setAllBlueprints((prev) =>
          prev.map((bp) =>
            bp.id === bpId
              ? {
                  ...bp,
                  ...details,
                  title: customBlueprint.title || bp.title,
                  description: normalizeBlueprintDescription(
                    customBlueprint.description
                  ),
                  status: customBlueprint.status || bp.status,
                  updatedAt: customBlueprint.updatedAt || bp.updatedAt,
                }
              : bp
          )
        );

        return details;
      }

      const url = `https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/plans/${bpId}.json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load plan for ${bpId}`);
      return await res.json();
    },
    [allBlueprints, hasTeams]
  );

  const openBlueprintSettings = async (blueprintId) => {
    try {
      const plan = await fetchBlueprintDetails(blueprintId);

      setCurrentInputSummary(plan.planSettings?.defaultValues || '');
      setSettingsBlueprintId(blueprintId);
      setIsSettingsModalOpen(true);
    } catch (error) {
      console.error('Failed to fetch blueprint details:', error);
    }
  };

  const closeBlueprintModal = useCallback(
    () => setIsBlueprintModalOpen(false),
    []
  );
  const openWorkflowEditModal = useCallback(
    () => setIsWorkflowEditModalOpen(true),
    []
  );
  const closeWorkflowEditModal = useCallback(
    () => setIsWorkflowEditModalOpen(false),
    []
  );

  /**
   * Handles blueprint selection confirmation.
   * Updates blueprintId for the selected CloudTask or ReportTask node.
   * Also updates the node name to match the blueprint title.
   * For REPORT_TASK: also fetches the blueprint and sets inputSettings.services.
   */
  const handleBlueprintSelectionConfirm = useCallback(
    async (selectedBlueprintIds) => {
      // Limit to single blueprint
      const limitedBlueprintIds = selectedBlueprintIds.slice(0, 1);
      
      const updatedNodes = await Promise.all(
        nodes.map(async (n) => {
          if (
            n.selected &&
            (n.type === NODE_TYPES.CLOUD_TASK ||
              n.type === NODE_TYPES.REPORT_TASK)
          ) {
            const existingInputSettings = n.data.inputSettings || {};
            const existingBlueprintInputs =
              existingInputSettings.blueprintInputs || {};
            const selectedBlueprintInputs = limitedBlueprintIds.reduce(
              (acc, blueprintId) => {
                if (defaultSettingsMap[blueprintId]) {
                  acc[blueprintId] = defaultSettingsMap[blueprintId];
                }
                return acc;
              },
              {}
            );
            const selectedBlueprint = limitedBlueprintIds.length > 0
              ? allBlueprints.find((bp) => bp.id === limitedBlueprintIds[0])
              : null;
            const selectedBlueprintProvider = selectedBlueprint
              ? getBlueprintCloudProvider(selectedBlueprint)
              : 'aws';
            const previousProvider =
              normalizeCloudProvider(existingInputSettings.cloudProvider) ||
              normalizeCloudProvider(n.data.cloudProvider) ||
              'aws';
            const didProviderChange =
              limitedBlueprintIds.length > 0 &&
              selectedBlueprintProvider !== previousProvider;
            const providerResetInputSettings = didProviderChange
              ? {
                  authProfile: null,
                  authProfiles: [],
                  permissionProfileId: '',
                  azureTenantProfile: null,
                  azureTenantProfileId: '',
                  azureSubscriptionProfiles: [],
                  regions: [],
                }
              : selectedBlueprintProvider === 'aws'
              ? {}
              : { regions: [] };
            const updatedData = {
              ...n.data,
              blueprintId: limitedBlueprintIds,
              cloudProvider: selectedBlueprintProvider,
              ...(didProviderChange
                ? {
                    permissionProfile: '',
                    multiEnvironment: false,
                    dynamicTargetsFromInput: false,
                  }
                : {}),
              inputSettings: {
                ...existingInputSettings,
                cloudProvider: selectedBlueprintProvider,
                ...providerResetInputSettings,
                ...(Object.keys(selectedBlueprintInputs).length > 0
                  ? {
                      blueprintInputs: {
                        ...existingBlueprintInputs,
                        ...selectedBlueprintInputs,
                      },
                    }
                  : {}),
              },
            };

            // Update node name to match blueprint title
            if (limitedBlueprintIds.length > 0) {
              if (selectedBlueprint?.title) {
                updatedData.name = selectedBlueprint.title;
              }
            }

            // Fetch and update services for REPORT_TASK
            if (
              n.type === NODE_TYPES.REPORT_TASK &&
              limitedBlueprintIds.length > 0
            ) {
              try {
                const blueprintData = await fetchBlueprintDetails(
                  limitedBlueprintIds[0]
                );
                const services =
                  blueprintData?.plan?.[0]?.tasks?.[0]?.services || [];
                updatedData.inputSettings = {
                  ...(updatedData.inputSettings || {}),
                  services,
                };
              } catch (e) {
                console.error('Failed to fetch blueprint services:', e);
              }
            }

            return { ...n, data: updatedData };
          }
          return n;
        })
      );

      setNodes(updatedNodes);

      closeBlueprintModal();
    },
    [
      nodes,
      setNodes,
      closeBlueprintModal,
      fetchBlueprintDetails,
      allBlueprints,
      defaultSettingsMap,
    ]
  );

  // handleWorkflowMetaSave, handleDeleteNode (unchanged)
  const handleWorkflowMetaSave = useCallback(
    (title, description) => {
      setWorkflowMeta({ title, description });

      closeWorkflowEditModal();
    },
    [closeWorkflowEditModal]
  );
  const handleDeleteNode = useCallback(
    (nodeIdToDelete) => {
      const nodeToDelete = reactFlowInstance.getNode(nodeIdToDelete);
      if (!nodeToDelete) return false;
      const nodeType = nodeToDelete.type;
      const isStartOrEnd =
        nodeType === NODE_TYPES.START || nodeType === NODE_TYPES.END;
      const nodeName = nodeToDelete.data.name || `Node ${nodeIdToDelete}`;
      const message = isStartOrEnd
        ? `Are you sure you want to delete the ${
            nodeType === NODE_TYPES.START ? 'Start' : 'End'
          } node "${nodeName}"? This is not recommended and might break the workflow.`
        : `Are you sure you want to delete node "${nodeName}"? This will also remove its connections.`;
      const confirmed = window.confirm(message);

      return confirmed;
    },
    [reactFlowInstance]
  );
  // applyInteractionCallbacks (unchanged logic, applies to all nodes)
  const applyInteractionCallbacks = useCallback(
    (nodeArr) => {
      return nodeArr.map((n) => {
        const data = {
          ...n.data,
          onHeightMeasured: handleHeightMeasured,
          onDelete: () => {
            if (handleDeleteNode(n.id)) {
              reactFlowInstance.deleteElements({ nodes: [{ id: n.id }] });
            }
          },
        };
        return { ...n, data };
      });
    },
    [handleHeightMeasured, handleDeleteNode, reactFlowInstance]
  );

  // defaultEdgeOptions (unchanged)
  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'smoothstep',
      animated: false,
      style: { strokeWidth: 1.5, stroke: '#888' },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 15,
        height: 15,
        color: '#888',
      },
    }),
    []
  );

  // --- Apply workflow update from backend ---
  const applyWorkflowUpdate = useCallback(
    (backendWorkflow) => {
      try {
        // Update workflow metadata
        setWorkflowMeta({
          title: backendWorkflow.title || 'Untitled Workflow',
          description: backendWorkflow.description || '',
        });
        
        // Update workflow schedule
        if (backendWorkflow.schedule) {
          setWorkflowSchedule(backendWorkflow.schedule);
        }
        
        // Transform backend nodes to React Flow format
        const transformedNodes = backendWorkflow.nodes.map((backendNode) => {
          // Move node properties to data object
          const nodeData = {
            name: backendNode.name || `Node ${backendNode.id}`,
            inputFrom: backendNode.inputFrom || [],
            next: backendNode.next || [],
            blueprintId: backendNode.blueprintId || [],
            permissionProfile: backendNode.permissionProfile || '',
            dynamicTargetsFromInput: Boolean(
              backendNode.dynamicTargetsFromInput
            ),
            multiEnvironment: Boolean(backendNode.multiEnvironment),
            advanceMode: backendNode.advanceMode || 'all',
            inputSettings: backendNode.inputSettings || {},
            action: backendNode.action || '',
            recipients: backendNode.recipients || '',
            branches: backendNode.branches || {},
            branchLogic: backendNode.branchLogic || {},
            condition: backendNode.condition || '',
            logic: Array.isArray(backendNode.logic) ? backendNode.logic : [],
            summaryInstructions: backendNode.summaryInstructions || '',
            schedule: backendNode.schedule || {},
            onHeightMeasured: handleHeightMeasured,
            onDelete: () => {
              if (handleDeleteNode(backendNode.id)) {
                reactFlowInstance.deleteElements({ nodes: [{ id: backendNode.id }] });
              }
            },
            layoutDirection: 'LR',
          };
          
          // Add schedule info to start node
          if (backendNode.type === 'startNode' && backendWorkflow.schedule) {
            nodeData.triggerType = backendWorkflow.schedule.triggerType || 'manual';
            nodeData.schedule = backendWorkflow.schedule;
          }
          
          return {
            id: backendNode.id,
            type: backendNode.type,
            data: nodeData,
            position: backendNode.position || { x: 0, y: 0 }, // Will be set by layout
            selectable: true,
            draggable: true,
          };
        });
        
        // Generate edges from node connections
        const transformedEdges = [];
        transformedNodes.forEach((node) => {
          const inputFrom = node.data.inputFrom || [];
          inputFrom.forEach((parentId) => {
            const edge = {
              id: `e-${parentId}-${node.id}`,
              source: parentId,
              target: node.id,
              type: 'smoothstep',
              animated: false,
              style: { strokeWidth: 1.5, stroke: '#888' },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 15,
                height: 15,
                color: '#888',
              },
            };
            transformedEdges.push(edge);
          });
        });
        
        // Apply layout to get proper positioning
        const layoutedNodes = getLinearLayoutedElements(transformedNodes, transformedEdges);
        
        // Apply interaction callbacks
        const finalNodes = applyInteractionCallbacks(layoutedNodes);
        
        // Update React Flow state
        setNodes(finalNodes);
        setEdges(transformedEdges);
        
        // Update original workflow data for dirty state tracking
        setOriginalWorkflowData({
          nodes: finalNodes,
          edges: transformedEdges,
          workflowMeta: {
            title: backendWorkflow.title || 'Untitled Workflow',
            description: backendWorkflow.description || '',
          },
          workflowSchedule: backendWorkflow.schedule || {},
        });
        
      } catch (error) {
        console.error('Error applying workflow update:', error);
        setChatMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Error applying workflow changes. Please try again.',
          },
        ]);
      }
    },
    [handleHeightMeasured, handleDeleteNode, reactFlowInstance, setNodes, setEdges, applyInteractionCallbacks, setWorkflowMeta, setWorkflowSchedule, setOriginalWorkflowData]
  );

  // --- Natural-language submit handler ---
  const handleNaturalLanguageSubmit = useCallback(
    async (message) => {
      if (!message) return;
      setIsChatOpen(true);
      setChatMessages((prev) => [...prev, { role: 'user', content: message }]);
      setIsNlLoading(true);
      try {
        // Construct current workflow state
        const existingWorkflow = {
          workflowId: workflowId || 'new',
          title: workflowMeta?.title || 'Untitled Workflow',
          description: workflowMeta?.description || '',
          schedule: workflowSchedule,
          nodes: nodes.map(node => ({
            id: node.id,
            type: node.type,
            name: node.data.name || '',
            inputFrom: node.data.inputFrom || [],
            next: node.data.next || [],
            blueprintId: node.data.blueprintId || [],
            permissionProfile: node.data.permissionProfile || '',
            dynamicTargetsFromInput: Boolean(
              node.data.dynamicTargetsFromInput
            ),
            multiEnvironment: Boolean(node.data.multiEnvironment),
            advanceMode: node.data.advanceMode || 'all',
            inputSettings: node.data.inputSettings || {},
            action: node.data.action || '',
            recipients: node.data.recipients || '',
            branches: node.data.branches || {},
            branchLogic: node.data.branchLogic || {},
            condition: node.data.condition || '',
            logic: node.data.logic || '',
            summaryInstructions: node.data.summaryInstructions || '',
            schedule: node.data.schedule || {},
          }))
        };
        const res = await fetch(WORKFLOW_API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            sessionId: userProfile?.userId || 'anonymous',
            userEmail:
              userProfile?.email || userProfile?.signInDetails?.loginId || '',
            existingWorkflow,
          }),
        });
        const data = await res.json();
        
        // Display response content in chat
        if (data?.response && typeof data.response === 'string') {
          setChatMessages((prev) => [
            ...prev,
            { role: 'assistant', content: data.response },
          ]);
        }
        
        // Display warnings in chat if they exist
        if (data?.warnings && Array.isArray(data.warnings) && data.warnings.length > 0) {
          const warningsText = `⚠️ Warnings:\n${data.warnings.map(w => `• ${w}`).join('\n')}`;
          setChatMessages((prev) => [
            ...prev,
            { role: 'assistant', content: warningsText },
          ]);
        }
        
        if (data?.workflow) {
          // Apply the workflow update
          applyWorkflowUpdate(data.workflow);
        }
      } catch (err) {
        console.error('NL update error', err);
        setChatMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Sorry, there was an error updating the workflow.',
          },
        ]);
      } finally {
        setIsNlLoading(false);
      }
    },
    [
      userProfile?.email,
      userProfile?.signInDetails?.loginId,
      userProfile?.userId,
      nodes,
      workflowId,
      workflowMeta,
      workflowSchedule,
    ]
  );

  // In FlowEditor, alongside handleBlueprintSelectionConfirm…
  const handleBlueprintSettingsSubmit = useCallback(
    (blueprintId, answers) => {
      const selectedNodeId = selectedNodeInfo?.node?.id;
      setNodes((nds) =>
        nds.map((n) => {
          if (
            (selectedNodeId ? n.id === selectedNodeId : n.selected) &&
            (n.type === NODE_TYPES.CLOUD_TASK ||
              n.type === NODE_TYPES.REPORT_TASK)
          ) {
            // Ensure inputSettings exists
            const inputSettings = { ...(n.data.inputSettings || {}) };
            // Place the form answers under blueprintInputs
            inputSettings.blueprintInputs = {
              ...(inputSettings.blueprintInputs || {}),
              [blueprintId]: answers,
            };
            return {
              ...n,
              data: {
                ...n.data,
                inputSettings,
              },
            };
          }
          return n;
        })
      );
    },
    [selectedNodeInfo?.node?.id, setNodes]
  );

  // --- Updated Effect for Initial Load & Fetching ---
  useEffect(() => {
    if (isNewWorkflow) {
      setIsLoadingWorkflow(true);

      // Set default workflow metadata
      setWorkflowMeta({
        title: 'New Workflow',
        description: 'A new workflow description',
      });

      // Create initial nodes with start and end
      const initialNodes = createInitialWorkflowNodes();
      const finalNodes = applyInteractionCallbacks(initialNodes);

      setNodes(finalNodes);
      setEdges([]); // No initial edges
      setLayoutApplied(true);
      setIsLoadingWorkflow(false);

      // Set original workflow data for dirty state tracking
      setOriginalWorkflowData({
        nodes: finalNodes,
        edges: [],
        workflowMeta: {
          title: 'New Workflow',
          description: 'A new workflow description',
        },
        workflowSchedule: {},
      });
      setHasUnsavedChanges(false);

      // Fit the view
      setTimeout(() => {
        if (reactFlowInstance) {
          reactFlowInstance.fitView({ padding: 0.5, duration: 500, maxZoom: 1 });
        }
      }, 150);

      return; // Exit early for new workflows
    }

    // Guard: Only run if React Flow instance is ready and workflowId is provided
    if (!reactFlowInstance || !workflowId) {
      return;
    }
    // Reset state for new fetch
    setIsLoadingWorkflow(true);
    setWorkflowLoadError(null);
    setFetchedWorkflowData(null); // Clear previous data if workflowId changed
    setLayoutApplied(false); // Reset layout flag when ID changes
    setNodes([]); // Clear existing nodes/edges on new fetch
    setEdges([]);
    // --- Fetch Workflow Data ---
    const fetchWorkflow = async () => {
      const url = `https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/workflows/${workflowIdParam}.json`;

      try {
        const response = await fetch(url);
        if (!response.ok) {
          // Handle HTTP errors (e.g., 404 Not Found)
          throw new Error(
            `HTTP error ${response.status}: ${response.statusText}`
          );
        }
        const data = await response.json();

        // Basic validation (add more specific checks if needed)
        if (!data || !data.nodes || !Array.isArray(data.nodes)) {
          throw new Error('Invalid workflow data format received.');
        }

        setWorkflowMeta({
          title: data.workflowName,
          description: data.workflowDescription || '',
        });
        setFetchedWorkflowData(data); // Store fetched data
      } catch (error) {
        console.error('Failed to fetch workflow:', error);
        setWorkflowLoadError(error.message || 'Failed to load workflow data.');
      } finally {
        // Ensure loading is set to false regardless of success/failure AFTER data processing attempt
        setIsLoadingWorkflow(false); // Moved later
      }
    };

    if (
      get(userProfile, 'workFlowDefs', [])
        .map((wf) => wf.workflowId)
        .includes(workflowId)
    ) {
      const workflowData = userProfile.workFlowDefs.find(
        (wf) => wf.workflowId === workflowId
      );

      setFetchedWorkflowData({
        title: workflowData.title,
        description: workflowData.description,
        nodes: JSON.parse(workflowData.nodes),
        schedule: workflowData.schedule,
      });

      setIsLoadingWorkflow(false);
    } else if (!userProfileLoading) fetchWorkflow(); // Initiate the fetch
  }, [
    reactFlowInstance,
    workflowId,
    userProfile,
    isNewWorkflow,
    userProfile,
    userProfileLoading,
  ]); // ** CRITICAL: Re-run effect if workflowId changes **

  useEffect(() => {
    if (fetchedWorkflowData?.schedule) {
      if (typeof fetchedWorkflowData.schedule === 'string') {
        setWorkflowSchedule(JSON.parse(fetchedWorkflowData.schedule));
      } else setWorkflowSchedule(fetchedWorkflowData.schedule);
    } else {
      setWorkflowSchedule({});
    }
  }, [fetchedWorkflowData]);

  const createInitialWorkflowNodes = useCallback(() => {
    const startNode = {
      id: 'start',
      type: NODE_TYPES.START,
      position: { x: 100, y: 100 },
      data: {
        name: 'Start',
        logic: [],
        inputFrom: [],
        schedule: {},
        layoutDirection: 'LR',
        onHeightMeasured: handleHeightMeasured,
        onDelete: () => {},
      },
      selected: false,
      selectable: true,
      draggable: true,
    };

    const endNode = {
      id: 'end',
      type: NODE_TYPES.END,
      position: { x: 400, y: 100 },
      data: {
        name: 'End',
        logic: [],
        summaryInstructions: '',
        inputFrom: [],
        layoutDirection: 'LR',
        onHeightMeasured: handleHeightMeasured,
        onDelete: () => {},
      },
      selected: false,
      selectable: true,
      draggable: true,
    };

    return [startNode, endNode];
  }, [handleHeightMeasured]);

  useEffect(() => {
    // Whenever the top-level schedule changes, copy it into the Start node's data
    setNodes((prev) =>
      prev.map((n) =>
        n.type === NODE_TYPES.START
          ? { ...n, data: { ...n.data, schedule: workflowSchedule } }
          : n
      )
    );
  }, [workflowSchedule, setNodes]);

  // --- NEW Effect to Process Fetched Data and Apply Layout (Runs AFTER fetch completes) ---
  useEffect(() => {
    // Guard: Only run if instance is ready, fetch is complete, no error, and data exists
    if (
      !reactFlowInstance ||
      isLoadingWorkflow || // Wait until fetch attempt is done
      workflowLoadError || // Don't run if fetch failed
      !fetchedWorkflowData || // Don't run if no data was fetched
      layoutApplied // Don't re-apply if already done for this data
    ) {
      // If fetch just finished (isLoadingWorkflow was true but now false), update loading state
      if (!isLoadingWorkflow && (workflowLoadError || fetchedWorkflowData)) {
        // This ensures loading state is false *after* the fetch attempt
      } else if (isLoadingWorkflow) {
        // Do nothing if still actively fetching in the *other* effect
      } else {
        // This case handles initial render before fetch or if workflowId was invalid
        setIsLoadingWorkflow(false);
      }
      return;
    }

    // 1. Load Workflow Metadata from fetched data
    setWorkflowMeta({
      title: fetchedWorkflowData.title || `Workflow ${workflowId}`, // Add fallback title
      description: fetchedWorkflowData.description || workflowMeta.description,
    });

    // 2. Transform fetched workflow nodes into React Flow nodes
    const initialNodesRaw = transformWorkflowToNodes(
      fetchedWorkflowData,
      handleHeightMeasured
      // applyInteractionCallbacks will be applied later
    );

    // 3. Build initial edges based on the transformed nodes' `inputFrom` data
    const initialEdges = buildEdgesFromNodes(
      initialNodesRaw,
      defaultEdgeOptions
    );

    // 4. Determine final node positions: Use saved positions OR calculate layout
    const hasSavedPositions =
      fetchedWorkflowData.nodes.length > 0 &&
      fetchedWorkflowData.nodes.every(
        (n) =>
          n.position &&
          typeof n.position.x === 'number' &&
          typeof n.position.y === 'number'
      ); // Added stricter check

    // let finalNodesWithPositions;

    // if (hasSavedPositions) {
    //   finalNodesWithPositions = initialNodesRaw; // Positions were already set during transform
    // } else if (initialNodesRaw.length > 0) {
    //   const layoutPositions = calculateVerticalLayout(
    //     initialNodesRaw,
    //     initialEdges
    //   );
    //   finalNodesWithPositions = initialNodesRaw.map((node) => ({
    //     ...node,
    //     position: layoutPositions[node.id] || { x: START_X, y: START_Y },
    //   }));
    // } else {
    //   finalNodesWithPositions = []; // No nodes to position
    // }
    let finalNodesWithPositions;
    if (initialNodesRaw.length > 0) {
      // Use linear layout for straight horizontal line
      finalNodesWithPositions = getLinearLayoutedElements(
        initialNodesRaw,
        initialEdges
      );
    } else {
      finalNodesWithPositions = []; // No nodes to position
    }

    // Compute the schedule the same way the workflow-schedule sync effect
    // does, so that the original snapshot, the live nodes, and
    // `workflowSchedule` will all match after async state updates settle.
    // Otherwise dirty-state detection incorrectly fires on initial load.
    const resolvedSchedule = fetchedWorkflowData.schedule
      ? typeof fetchedWorkflowData.schedule === 'string'
        ? safeParseJSON(fetchedWorkflowData.schedule, {}) || {}
        : fetchedWorkflowData.schedule
      : {};
    const finalNodesWithSchedule = finalNodesWithPositions.map((n) =>
      n.type === NODE_TYPES.START
        ? { ...n, data: { ...n.data, schedule: resolvedSchedule } }
        : n
    );

    // 5. Apply interaction callbacks (like onDelete) to the nodes *with* final positions
    const finalNodesWithCallbacks = applyInteractionCallbacks(
      finalNodesWithSchedule
    );

    // 6. Set React Flow state
    setNodes(finalNodesWithCallbacks);
    setEdges(initialEdges);
    setLayoutApplied(true); // Mark layout/load as completed for this data
    setIsLoadingWorkflow(false); // Definitively set loading to false *after* processing

    // 7. Set original workflow data for dirty state tracking
    setOriginalWorkflowData({
      nodes: finalNodesWithCallbacks,
      edges: initialEdges,
      workflowMeta: {
        title: fetchedWorkflowData.title || `Workflow ${workflowId}`,
        description:
          fetchedWorkflowData.description || workflowMeta.description,
      },
      workflowSchedule: resolvedSchedule,
    });
    setHasUnsavedChanges(false); // Reset dirty state

    // 8. Fit the view
    setTimeout(() => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ padding: 0.5, duration: 500, maxZoom: 1 });
      }
    }, 150);
  }, [
    reactFlowInstance,
    fetchedWorkflowData, // Re-run when fetched data arrives
    isLoadingWorkflow, // Re-check condition when loading state changes
    workflowLoadError, // Re-check condition when error state changes
    layoutApplied, // Prevent re-running if already applied
    // Include other stable dependencies needed inside this effect:
    handleHeightMeasured,
    defaultEdgeOptions,
    applyInteractionCallbacks,
    setNodes,
    setEdges,
    setWorkflowMeta,
  ]); // Dependencies for the processing effect

  /**
   * Helper function to find a non-overlapping position for a new node
   */
  const findNonOverlappingPosition = useCallback(
    (startPosition, existingNodes) => {
      const OFFSET_STEP = 50; // Pixels to offset when checking for overlap
      const MAX_ATTEMPTS = 20; // Maximum attempts to find a non-overlapping position

      const isOverlapping = (pos, nodeList) => {
        for (const node of nodeList) {
          const nodeX = node.position.x;
          const nodeY = node.position.y;
          const nodeWidth = node.width || NODE_WIDTH;
          const nodeHeight = node.height || NODE_HEIGHT;

          // Check if the new node would overlap with this existing node
          const horizontalOverlap =
            pos.x < nodeX + nodeWidth && pos.x + NODE_WIDTH > nodeX;
          const verticalOverlap =
            pos.y < nodeY + nodeHeight && pos.y + NODE_HEIGHT > nodeY;

          if (horizontalOverlap && verticalOverlap) {
            return true;
          }
        }
        return false;
      };

      let position = { ...startPosition };
      let attempts = 0;

      // Try to find a non-overlapping position by offsetting diagonally
      while (isOverlapping(position, existingNodes) && attempts < MAX_ATTEMPTS) {
        attempts++;
        position = {
          x: startPosition.x + OFFSET_STEP * attempts,
          y: startPosition.y + OFFSET_STEP * attempts,
        };
      }

      return position;
    },
    []
  );

  /**
   * Handles adding a new node based on the selected React Flow type.
   * Updated to handle distinct cloudTask and reportTask.
   */
  const handleAddNewNode = useCallback(
    (nodeInfo) => {
      if (!nodeInfo || !reactFlowInstance) return;

      const { rfType } = nodeInfo; // Only need rfType now
      // Generate a sequential ID based on node type (e.g., approval, approval2, etc.)
      const existingCount = nodes.filter((n) => n.type === rfType).length;

      const newNodeId =
        existingCount === 0 ? rfType : `${rfType}${existingCount + 1}`;

      let defaultData = { logic: [], inputFrom: [], layoutDirection: 'LR' };
      let nodeName = `New Node`;

      // Set defaults based on the specific rfType
      if (rfType === NODE_TYPES.CLOUD_TASK) {
        nodeName = 'New Cloud Task';
        defaultData = {
          ...defaultData,
          blueprintId: [] /* Output logic handled below */,
          dynamicTargetsFromInput: false,
          multiEnvironment: false,
          advanceMode: 'all',
        };
      } else if (rfType === NODE_TYPES.REPORT_TASK) {
        // Handle new type
        nodeName = 'New Report Task';
        defaultData = {
          ...defaultData,
          blueprintId: [] /* Output logic handled below */,
          dynamicTargetsFromInput: false,
          multiEnvironment: false,
          advanceMode: 'all',
        };
      } else if (rfType === NODE_TYPES.COMMUNICATION) {
        nodeName = 'New Communication';
        defaultData = { ...defaultData, action: 'Notify Action' };
      } else if (rfType === NODE_TYPES.APPROVAL) {
        nodeName = 'New Approval';
        defaultData = { ...defaultData, action: 'Request Approval' };
      } else if (rfType === NODE_TYPES.DECISION) {
        nodeName = 'New Decision';
        defaultData = {
          ...defaultData,
          branches: 2,
          conditions: {},
          logic: ['Evaluate condition'],
        };
      } else {
        console.error('Unsupported node type for adding:', rfType);
        return;
      }

      const pane = reactFlowWrapper.current?.getBoundingClientRect();
      const viewWidth = pane?.width ?? window.innerWidth;
      const viewHeight = pane?.height ?? window.innerHeight;
      const centerPosition = reactFlowInstance.project({
        x: viewWidth / 2,
        y: viewHeight / 2,
      });
      centerPosition.x -= NODE_WIDTH / 2;
      centerPosition.y -= NODE_HEIGHT / 2;

      // Find a non-overlapping position for the new node
      const position = findNonOverlappingPosition(centerPosition, nodes);

      const newNodeData = {
        name: nodeName,
        ...defaultData,
        onHeightMeasured: () => {},
        onDelete: () => {},
      };

      const newNodeReactFlow = {
        id: newNodeId,
        type: rfType,
        position,
        data: newNodeData,
        selected: true,
        selectable: true,
        draggable: true,
      };

      const finalNewNode = applyInteractionCallbacks([newNodeReactFlow])[0];

      // Deselect all existing nodes and add the new node
      setNodes((currentNodes) => {
        const deselectedNodes = currentNodes.map((n) => ({
          ...n,
          selected: false,
        }));
        return deselectedNodes.concat(finalNewNode);
      });
    },
    [reactFlowInstance, setNodes, applyInteractionCallbacks, nodes, findNonOverlappingPosition]
  );

  const onNodesChange = useCallback(
    (changes) => {
      onNodesChangeBase(changes);
      // Delete key handling is done via node's data.onDelete
    },
    [onNodesChangeBase]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      const removedEdgesChanges = changes.filter((c) => c.type === 'remove');

      if (removedEdgesChanges.length > 0) {
        const edgesToRemoveIds = new Set(removedEdgesChanges.map((c) => c.id));
        const currentEdges = reactFlowInstance.getEdges();

        setNodes((currentNodes) => {
          let nodesToUpdate = new Map();
          edgesToRemoveIds.forEach((edgeId) => {
            const deletedEdge = currentEdges.find((e) => e.id === edgeId);
            if (deletedEdge) {
              const targetNodeId = deletedEdge.target;
              const sourceNodeId = deletedEdge.source;
              const targetNode = currentNodes.find(
                (n) => n.id === targetNodeId
              );
              if (targetNode) {
                const existingUpdate = nodesToUpdate.get(targetNodeId);
                const baseInputs = existingUpdate
                  ? existingUpdate.inputs
                  : ensureInputFromArray(targetNode.data.inputFrom);
                const finalNewInputs = baseInputs.filter(
                  (inputId) => inputId !== sourceNodeId
                );
                if (finalNewInputs.length !== baseInputs.length) {
                  nodesToUpdate.set(targetNodeId, {
                    inputs: finalNewInputs,
                    node: targetNode,
                  });
                }
              }
            } else {
              console.warn(
                `onEdgesChange: Edge details not found for removed ID ${edgeId}`
              );
            }
          });

          if (nodesToUpdate.size === 0) return currentNodes;

          return currentNodes.map((n) => {
            if (nodesToUpdate.has(n.id)) {
              const updateInfo = nodesToUpdate.get(n.id);
              return {
                ...n,
                data: { ...n.data, inputFrom: updateInfo.inputs },
              };
            }
            return n;
          });
        });
      }
      onEdgesChangeBase(changes);
    },
    [onEdgesChangeBase, setNodes, reactFlowInstance]
  );

  const onConnect = useCallback(
    (params) => {
      const { source, target } = params;
      const sourceNode = reactFlowInstance.getNode(source);
      const targetNode = reactFlowInstance.getNode(target);

      if (!sourceNode || !targetNode) {
        console.warn('Connection failed: Source or target node not found.');
        return;
      }
      if (source === target) {
        console.warn('Connection failed: Cannot connect node to itself.');
        return;
      }
      if (targetNode.type === NODE_TYPES.START) {
        alert('Cannot connect TO a Start node.');
        return;
      }
      if (sourceNode.type === NODE_TYPES.END) {
        alert('Cannot connect FROM an End node.');
        return;
      }

      const currentEdges = reactFlowInstance.getEdges();
      if (
        currentEdges.some((e) => e.source === source && e.target === target)
      ) {
        console.warn('Connection failed: Edge already exists.');
        return;
      }

      if (sourceNode.type !== NODE_TYPES.DECISION) {
        if (currentEdges.some((e) => e.source === source)) {
          alert(
            `${
              sourceNode.data.name || 'Node'
            } can only have one outgoing connection (unless it's a Decision node). Delete the existing connection first.`
          );
          return;
        }
      }

      const newEdge = {
        ...params,
        ...defaultEdgeOptions,
        id: `e-${source}-${target}-${Date.now()}`,
      };

      if (
        sourceNode.type === NODE_TYPES.DECISION &&
        targetNode.data?.condition
      ) {
        const conditionLabel = String(targetNode.data.condition).trim();
        if (conditionLabel !== '') {
          newEdge.label = ` ${conditionLabel} `;
          newEdge.labelStyle = { fill: '#555', fontWeight: 500, fontSize: 11 };
          newEdge.labelBgStyle = { fill: '#ffffff', fillOpacity: 0.7 };
          newEdge.labelBgPadding = [4, 2];
          newEdge.labelBgBorderRadius = 2;
        }
      }

      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === target) {
            const currentInputs = ensureInputFromArray(n.data.inputFrom);
            const newInputs = [...new Set([...currentInputs, source])];

            return { ...n, data: { ...n.data, inputFrom: newInputs } };
          }
          return n;
        })
      );

      setEdges((eds) => addEdge(newEdge, eds));
    },
    [reactFlowInstance, setNodes, setEdges, defaultEdgeOptions]
  );

  const disconnectedNodes = useMemo(() => {
    const problematicNodes = [];
    if (nodes.length <= 1) return [];

    const edgeSources = new Set(edges.map((e) => e.source));
    const edgeTargets = new Set(edges.map((e) => e.target));
    const nodeIds = new Set(nodes.map((n) => n.id));

    nodes.forEach((node) => {
      const hasOutputConnection = edgeSources.has(node.id);
      const hasInputConnection =
        edgeTargets.has(node.id) ||
        ensureInputFromArray(node.data.inputFrom).some((inpId) =>
          nodeIds.has(inpId)
        );

      if (node.type === NODE_TYPES.START && !hasOutputConnection) {
        problematicNodes.push({
          id: node.id,
          name: node.data.name,
          issue: 'no output connection',
        });
      } else if (node.type === NODE_TYPES.END && !hasInputConnection) {
        problematicNodes.push({
          id: node.id,
          name: node.data.name,
          issue: 'no input connection',
        });
      } else if (
        node.type !== NODE_TYPES.START &&
        node.type !== NODE_TYPES.END
      ) {
        if (!hasInputConnection && !hasOutputConnection) {
          problematicNodes.push({
            id: node.id,
            name: node.data.name,
            issue: 'no input or output connections',
          });
        } else if (!hasInputConnection) {
          if (ensureInputFromArray(node.data.inputFrom).length > 0) {
            problematicNodes.push({
              id: node.id,
              name: node.data.name,
              issue: 'no input connection',
            });
          }
        } else if (!hasOutputConnection) {
          problematicNodes.push({
            id: node.id,
            name: node.data.name,
            issue: 'no output connection',
          });
        }
      }
    });
    return problematicNodes;
  }, [nodes, edges]);

  const nodesWithMissingRequiredFields = useMemo(
    () =>
      nodes
        .map((node) => ({
          id: node.id,
          name: node.data?.name || node.id,
          errors: validateNodeData(node.data || {}, node.type),
        }))
        .filter((node) => Object.keys(node.errors).length > 0),
    [nodes]
  );

  const handleMissingRequiredFieldsClick = useCallback(() => {
    if (nodesWithMissingRequiredFields.length === 0) return;

    const invalidNodeIds = new Set(
      nodesWithMissingRequiredFields.map((node) => node.id)
    );

    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        selected: invalidNodeIds.has(node.id),
      }))
    );

    window.setTimeout(() => {
      reactFlowInstance.fitView({
        nodes: nodesWithMissingRequiredFields.map((node) => ({ id: node.id })),
        padding: 0.35,
        duration: 500,
        maxZoom: 1,
      });
    }, 0);
  }, [nodesWithMissingRequiredFields, reactFlowInstance, setNodes]);

  // handleRefreshLayout (unchanged logic)
  const handleRefreshLayout = useCallback(() => {
    if (!reactFlowInstance) return;
    const currentNodes = reactFlowInstance.getNodes();
    const currentEdges = reactFlowInstance.getEdges();
    if (currentNodes.length === 0) return;

    // const layoutPositions = calculateVerticalLayout(currentNodes, currentEdges);
    // const nodesWithNewLayout = currentNodes.map((node) => ({
    //   ...node,
    //   position: layoutPositions[node.id] || node.position,
    // }));
    // const finalNodes = applyInteractionCallbacks(nodesWithNewLayout);
    // setNodes(finalNodes);
    // setTimeout(() => {
    //   reactFlowInstance.fitView({ padding: 0.5, duration: 500, maxZoom: 1 });
    // }, 100);
    const nodesWithNewLayout = getLinearLayoutedElements(
      currentNodes,
      currentEdges
    );

    // 2. IMPORTANT: Re-apply interaction callbacks
    const finalNodes = applyInteractionCallbacks(nodesWithNewLayout);

    // 3. Update the nodes state
    setNodes(finalNodes);

    // 4. Optional: Fit the view
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.5, duration: 500, maxZoom: 1 });
    }, 100);
  }, [reactFlowInstance, setNodes, applyInteractionCallbacks]);

  // --- Save Actions (Updated for new type structure) ---

  /**
   * Constructs workflow data with distinct types and dispatches update.
   */
  const handleSaveChanges = async () => {
    const workflowToSave = {
      title: workflowMeta.title,
      description: workflowMeta.description,
      nodes: nodes.map((n) => ({
        // Core properties
        id: n.id,
        type: n.type, // Use the node's React Flow type (cloudTask, reportTask, etc.)
        name: n.data.name,
        inputFrom: ensureInputFromArray(n.data.inputFrom),
        next: Array.isArray(n.data.next) ? n.data.next : [],
        condition: n.data.condition,
        position: n.position,
        logic: ensureLogicArray(n.data.logic),
        // Type-specific properties
        ...(n.type === NODE_TYPES.START && {
          triggerType: n.data.schedule?.triggerType,
          schedule: n.data.schedule,
        }),
        ...(n.type === NODE_TYPES.END && {
          summaryInstructions: n.data.summaryInstructions || '',
        }),
        // Add blueprintId and outputLogic for BOTH task types
        ...((n.type === NODE_TYPES.CLOUD_TASK ||
          n.type === NODE_TYPES.REPORT_TASK) && {
          blueprintId: ensureInputFromArray(n.data.blueprintId),
          permissionProfile: n.data.permissionProfile || '', // Ensure permissionProfile exists
          dynamicTargetsFromInput: Boolean(n.data.dynamicTargetsFromInput),
          multiEnvironment: Boolean(n.data.multiEnvironment),
          advanceMode: n.data.advanceMode || 'all',

          inputSettings: n.data.inputSettings || {}, // Ensure inputSettings exists
        }),
        // REMOVED: cloudTaskType property
        ...(n.type === NODE_TYPES.DECISION && {
          branches: n.data.branches,
          // conditions: n.data.conditions,
          branchLogic: n.data.branchLogic || {}, // Ensure branchLogic exists
        }),
        ...((n.type === NODE_TYPES.APPROVAL ||
          n.type === NODE_TYPES.COMMUNICATION) && {
          action: n.data.action,
          recipients: n.data.recipients || [], // Ensure recipients exists
        }),
      })),
    };

    const existingWorkflow = userProfile?.workFlowDefs?.find(
      (wf) => wf.workflowId === workflowId
    );
    if (!existingWorkflow) {
      toast.error('Cannot update: workflow not found');
      return;
    }
    try {
      setIsUpdating(true);
      await dispatch(
        updateWorkflow({
          workflowId: existingWorkflow.workflowId,
          nodes: JSON.stringify(workflowToSave.nodes),
          title: workflowToSave.title,
          description: workflowToSave.description,
          schedule: JSON.stringify(workflowSchedule),
        })
      ).unwrap();
      toast.success('Workflow updated successfully!');
      // Update original workflow data and reset dirty state
      setOriginalWorkflowData({
        nodes: nodes,
        edges: edges,
        workflowMeta: workflowMeta,
        workflowSchedule: workflowSchedule,
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error updating workflow:', error);
      toast.error(
        `Failed to update workflow: ${error.message || 'Unknown error'}`
      );
    } finally {
      setIsUpdating(false);
    }
  };

  /**
   * Constructs workflow data with distinct types and dispatches create.
   */
  const handleSaveAsNew = async () => {
    const workflowToSave = {
      title: workflowMeta.title || workflowName,
      description: workflowMeta.description || workflowDescription,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type, // Use the node's React Flow type
        name: n.data.name,
        inputFrom: ensureInputFromArray(n.data.inputFrom),
        next: Array.isArray(n.data.next) ? n.data.next : [],
        condition: n.data.condition,
        position: n.position,
        logic: ensureLogicArray(n.data.logic),
        ...(n.type === NODE_TYPES.START && {
          triggerType: n.data.schedule?.triggerType,
          schedule: n.data.schedule,
        }),
        ...(n.type === NODE_TYPES.END && {
          summaryInstructions: n.data.summaryInstructions || '',
        }),
        ...((n.type === NODE_TYPES.CLOUD_TASK ||
          n.type === NODE_TYPES.REPORT_TASK) && {
          blueprintId: ensureInputFromArray(n.data.blueprintId),
          permissionProfile: n.data.permissionProfile || '',
          dynamicTargetsFromInput: Boolean(n.data.dynamicTargetsFromInput),
          multiEnvironment: Boolean(n.data.multiEnvironment),
          advanceMode: n.data.advanceMode || 'all',
          inputSettings: n.data.inputSettings || {},
        }),
        // REMOVED: cloudTaskType property
        ...(n.type === NODE_TYPES.DECISION && {
          branches: n.data.branches,
          conditions: n.data.conditions,
        }),
        ...((n.type === NODE_TYPES.APPROVAL ||
          n.type === NODE_TYPES.COMMUNICATION) && {
          action: n.data.action,
          recipients: n.data.recipients || [],
        }),
      })),
    };

    try {
      setIsSaving(true);

      const response = await dispatch(
        createWorkflow({
          nodes: JSON.stringify(workflowToSave.nodes),
          workflowId: params.workFlowId,
          title: workflowToSave.title,
          description: workflowToSave.description,
          schedule: JSON.stringify(workflowSchedule),
        })
      ).unwrap();
      analytics.track(ANALYTICS_EVENTS.WORKFLOW_CREATED, {
        route: getAnalyticsRoute(),
      });
      toast.success('Workflow created successfully!');
      setIsNewlySaved(true);
      setIsLibrary(false);
      setWorkflowId(response.workflowId);
      if (isNewWorkflow) {
        setIsNewWorkflowSaved(true);
        setIsNewWorkflow(false);
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
      toast.error(
        'Failed to save workflow: ' + (error.message || 'Unknown error')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const [isEditIconHovered, setIsEditIconHovered] = useState(false);

  // --- RENDER ---
  const warningBannerHeight = disconnectedNodes.length > 0 ? 37 : 0;
  const mainContentHeight = `calc(100% - 50px - ${warningBannerHeight}px)`;
  const sidePanelHeight = `calc(100vh - 50px - ${warningBannerHeight}px)`;
  const bottomInputBarStyle = {
    position: 'absolute',
    bottom: '25px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: '10px 20px',
    borderRadius: '30px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    minWidth: '450px',
    maxWidth: '65%',
    border: '1px solid #eee',
  };
  const bottomInputStyle = {
    flexGrow: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '14px',
    marginLeft: '10px',
    color: '#333',
  };

  // Calculate blueprint filter type based on selected node type
  const blueprintFilterType = useMemo(() => {
    if (selectedNodeInfo.node?.type === NODE_TYPES.REPORT_TASK) {
      return 'report';
    } else if (selectedNodeInfo.node?.type === NODE_TYPES.CLOUD_TASK) {
      return 'build';
    }
    return undefined; // No filter or default if not a task node
  }, [selectedNodeInfo.node]);

  if (isLoadingWorkflow) {
    return (
      <div className="flex justify-center items-center h-screen flex-col gap-2">
        <Loader2 size={32} className="animate-spin" />
        <span>Loading Workflow...</span>
      </div>
    );
  }

  if (workflowLoadError) {
    return (
      <div className="flex justify-center items-center h-screen flex-col gap-2 text-red-500 p-5 text-center">
        <AlertTriangle size={32} />
        <span>Error Loading Workflow</span>
        <pre className="bg-red-50 p-2 rounded max-w-4/5 overflow-x-auto text-xs">
          {workflowLoadError}
        </pre>
      </div>
    );
  }

  const handleSettingsSubmit = (answers) => {
    setDefaultSettingsMap((prev) => ({
      ...prev,
      [settingsBlueprintId]: answers,
    }));
    handleBlueprintSettingsSubmit(settingsBlueprintId, answers);

    setIsSettingsModalOpen(false);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <nav className="bg-white shadow-sm">
        <div className="px-6">
          <div className="flex justify-between items-center py-2">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Button
                  variant="link"
                  onClick={() => {
                    if (window.history.length > 1) {
                      navigate(-1);
                    } else {
                      navigate(
                        isLibrary && IS_PUBLIC_SITE ? '/libraries' : '/dashboard/workflow-def'
                      );
                    }
                  }}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              {(!isLibrary || isNewlySaved || isNewWorkflowSaved) &&
                !(isNewWorkflow && !isNewWorkflowSaved) && (
                  <Button
                    onClick={handleSaveChanges}
                    disabled={isUpdating || isSaving || !hasUnsavedChanges}
                    className="flex items-center"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 size={16} className="mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : isSaving ? (
                      <>
                        <Loader2 size={16} className="mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} className="mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                )}

              {isNewWorkflow && !isNewWorkflowSaved ? (
                <Button
                  onClick={handleSaveAsNew}
                  disabled={isSaving || isUpdating}
                  className="flex items-center"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} className="mr-2" />
                      Save Workflow
                    </>
                  )}
                </Button>
              ) : !isLibrary || isNewlySaved || isNewWorkflowSaved ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      disabled={isUpdating || isSaving}
                      variant="outline"
                      className="p-2"
                    >
                      <ChevronDown size={24} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={handleSaveAsNew}
                      disabled={
                        isSaving ||
                        isUpdating ||
                        userProfile?.workFlowDefs?.some(
                          (workflow) =>
                            workflow.workflowId === params?.workFlowId
                        )
                      }
                    >
                      <Copy size={16} className="mr-2" />
                      Save As New
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  onClick={handleSaveAsNew}
                  disabled={
                    isSaving ||
                    isUpdating ||
                    userProfile?.workFlowDefs?.some(
                      (workflow) => workflow.workflowId === params?.workFlowId
                    )
                  }
                >
                  Save to my library
                </Button>
              )}

              {!(isNewWorkflow && !isNewWorkflowSaved) && (
                <RunWorkflowButton
                  workflowId={workflowId}
                  title={workflowMeta?.title}
                  nodes={nodes}
                  userId={userProfile?.userId}
                  workflowMeta={workflowMeta}
                  userProfile={userProfile}
                  workflowSchedule={workflowSchedule}
                  source={isLibrary && !isNewlySaved ? 'library' : 'saved'}
                />
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="bg-gray-100 h-[100%] p-4 flex gap-4">
        <div className="flex-1 flex flex-col relative p-4 bg-white rounded-[16px]">
          <div>
            <div className="flex p-2 items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="link" className="text-primary-600 p-0">
                  <h2
                    className="text-lg font-medium"
                    title={workflowMeta?.title}
                  >
                    {workflowMeta?.title || 'Untitled Workflow'}
                  </h2>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  title="Edit Workflow Details"
                  className={`p-1 ${isEditIconHovered ? 'bg-gray-100' : ''}`}
                  onMouseEnter={() => setIsEditIconHovered(true)}
                  onMouseLeave={() => setIsEditIconHovered(false)}
                  onClick={openWorkflowEditModal}
                >
                  <Edit2 size={16} />
                </Button>
                {workflowMeta?.description && (
                  <p
                    className="text-sm text-gray-600 ml-2"
                    title={workflowMeta?.description}
                  >
                    {workflowMeta?.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleMissingRequiredFieldsClick}
                disabled={nodesWithMissingRequiredFields.length === 0}
                title={
                  nodesWithMissingRequiredFields.length > 0
                    ? nodesWithMissingRequiredFields
                        .map((node) => {
                          const fields = Object.values(node.errors).join(', ');
                          return `${node.name}: ${fields}`;
                        })
                        .join('\n')
                    : 'All required fields are complete'
                }
                className={cn(
                  'inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  nodesWithMissingRequiredFields.length > 0
                    ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                    : 'cursor-default border-green-200 bg-green-50 text-green-700'
                )}
              >
                {nodesWithMissingRequiredFields.length > 0 ? (
                  <AlertTriangle size={14} className="mr-2" />
                ) : (
                  <CheckCircle2 size={14} className="mr-2" />
                )}
                {nodesWithMissingRequiredFields.length > 0
                  ? `${nodesWithMissingRequiredFields.length} node${
                      nodesWithMissingRequiredFields.length === 1 ? '' : 's'
                    } missing required fields`
                  : 'Required fields complete'}
              </button>
            </div>

            {disconnectedNodes.length > 0 && (
              <div
                className="bg-yellow-50 border-b border-yellow-200 px-5 py-2 flex items-center gap-2 text-yellow-800 text-xs flex-shrink-0"
                style={{ height: `${warningBannerHeight}px` }}
              >
                <AlertTriangle size={16} />
                <span>
                  Warning: {disconnectedNodes.length} node(s) may have
                  connection issues (
                  {disconnectedNodes
                    .map((n) => `"${n.name}": ${n.issue}`)
                    .slice(0, 3)
                    .join(', ')}
                  {disconnectedNodes.length > 3 ? ', ...' : ''}).
                </span>
              </div>
            )}
          </div>
          <WorkflowEditModal
            isOpen={isWorkflowEditModalOpen}
            onClose={closeWorkflowEditModal}
            initialTitle={workflowMeta?.title}
            initialDescription={workflowMeta?.description}
            onSave={handleWorkflowMetaSave}
          />
          <BlueprintSelectionModal
            isOpen={isBlueprintModalOpen}
            onClose={closeBlueprintModal}
            blueprints={allBlueprints}
            fetchBlueprintDetails={fetchBlueprintDetails}
            initialSelectedIds={
              selectedNodeInfo.node &&
              (selectedNodeInfo.node.type === NODE_TYPES.CLOUD_TASK ||
                selectedNodeInfo.node.type === NODE_TYPES.REPORT_TASK)
                ? ensureInputFromArray(selectedNodeInfo.node.data?.blueprintId)
                : []
            }
            selectedNodeInfo={selectedNodeInfo}
            onConfirm={handleBlueprintSelectionConfirm}
            onSettingsSubmit={handleBlueprintSettingsSubmit}
            isLoading={blueprintLoading}
            error={blueprintError}
            filterType={blueprintFilterType}
            currentInputSummary={currentInputSummary}
            setCurrentInputSummary={setCurrentInputSummary}
            isSettingsModalOpen={isSettingsModalOpen}
            setIsSettingsModalOpen={setIsSettingsModalOpen}
            settingsBlueprintId={settingsBlueprintId}
            setSettingsBlueprintId={setSettingsBlueprintId}
            {...{ defaultSettingsMap, setDefaultSettingsMap }}
          />
          <div className="z-[999]">
            <SettingsSummary
              isOpen={isSettingsModalOpen}
              onClose={() => setIsSettingsModalOpen(false)}
              onSubmit={handleSettingsSubmit}
              defaultValues={defaultSettingsMap[settingsBlueprintId] || {}}
              inputSummary={currentInputSummary}
              isWorkflow={true}
              buttonText={'Save Settings'}
              isReconnecting={true}
            />
          </div>
          <div className="flex-1 flex flex-col relative ">
            <div className="flex-1 relative" ref={reactFlowWrapper}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={reactFlowNodeTypes}
                defaultEdgeOptions={defaultEdgeOptions}
                className="bg-gray-50 h-full"
                connectionMode="strict"
                fitViewOptions={{ padding: 0.5, duration: 500, maxZoom: 1 }}
                proOptions={{ hideAttribution: true }}
                selectNodesOnDrag={true}
                multiSelectionKeyCode="Shift"
                nodesDraggable={true}
                nodesConnectable={true}
                elementsSelectable={true}
              >
                <Background variant="dots" gap={15} size={1} color="#ddd" />
                <Controls
                  showInteractive={false}
                >
                  <button
                    onClick={handleRefreshLayout}
                    className="bg-none border-none p-1 cursor-pointer flex items-center justify-center hover:bg-gray-100 rounded"
                    title="Relayout"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <button
                    onClick={() => setIsChatOpen(true)}
                    className="bg-none border-none p-1 cursor-pointer flex items-center justify-center hover:bg-gray-100 rounded"
                    title="Open Workflow Assistant"
                  >
                    <MessageCircle size={16} />
                  </button>
                </Controls>
              </ReactFlow>

              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10 flex items-center bg-white bg-opacity-95 px-5 py-2 rounded-full shadow-lg min-w-[450px] max-w-[65%] border border-gray-200">
                <Wand2 size={18} className="text-gray-500 mr-3" />
                <input
                  type="text"
                  placeholder="Describe how you want to change this workflow..."
                  className="flex-1 border-0 outline-0 bg-transparent text-sm text-gray-700"
                  value={nlMessage}
                  onChange={(e) => setNlMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const msg = nlMessage.trim();
                      if (msg) {
                        setNlMessage('');
                        handleNaturalLanguageSubmit(msg);
                      }
                    }
                  }}
                />
              </div>
            </div>

            <div className="bg-white border-t border-gray-200 p-4 pb-0">
              <AddNodePane onSelectType={handleAddNewNode} />
            </div>
          </div>
        </div>

        {(() => {
          const selectedNode = selectedNodeInfo.node;
          if (!selectedNode) return null;

          const isPreviewableTask =
            selectedNode.type === NODE_TYPES.CLOUD_TASK ||
            selectedNode.type === NODE_TYPES.REPORT_TASK;
          const selectedBlueprintIds = isPreviewableTask
            ? ensureInputFromArray(selectedNode.data?.blueprintId).filter(Boolean)
            : [];
          const selectedBlueprintId = selectedBlueprintIds[0] || null;
          const selectedBlueprint = selectedBlueprintId
            ? allBlueprints.find((bp) => bp.id === selectedBlueprintId)
            : null;
          const canShowPreview = isPreviewableTask && !!selectedBlueprintId;
          const previewVisible = canShowPreview && !isBlueprintPreviewHidden;

          return (
            <>
              <div
                className="w-96 border-l border-gray-200 shadow-lg flex flex-col rounded-[16px] z-[60] relative"
                style={{ height: sidePanelHeight, backgroundColor: '#f8fafc' }}
              >
                {canShowPreview && (
                  <div className="flex items-center justify-end border-b border-gray-200 bg-white/70 px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        updateBlueprintPreviewHidden(!isBlueprintPreviewHidden)
                      }
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      title={
                        isBlueprintPreviewHidden
                          ? 'Show blueprint preview'
                          : 'Hide blueprint preview'
                      }
                    >
                      {isBlueprintPreviewHidden ? (
                        <Eye size={14} />
                      ) : (
                        <EyeOff size={14} />
                      )}
                      {isBlueprintPreviewHidden
                        ? 'Show preview'
                        : 'Hide preview'}
                    </button>
                  </div>
                )}
                <div className="p-4 pb-24 flex-1 overflow-y-auto">
                  <EditNodePane
                    key={selectedNode.id}
                    node={selectedNode}
                    parentNames={selectedNodeInfo.parentNames}
                    setNodes={setNodes}
                    openBlueprintModal={openBlueprintModal}
                    allBlueprints={allBlueprints}
                    onConfirm={handleBlueprintSelectionConfirm}
                    workflowSchedule={workflowSchedule}
                    setWorkflowSchedule={setWorkflowSchedule}
                  />
                </div>
              </div>
              {previewVisible && (
                <BlueprintPreviewPanel
                  blueprintId={selectedBlueprintId}
                  blueprint={selectedBlueprint}
                  fetchBlueprintDetails={fetchBlueprintDetails}
                  onHide={() => updateBlueprintPreviewHidden(true)}
                  onOpenInEditor={() => {
                    if (!selectedBlueprintId) return;
                    if (hasUnsavedChanges) {
                      const confirmed = window.confirm(
                        'You have unsaved changes in this workflow. Leaving will discard them. Continue to blueprint editor?'
                      );
                      if (!confirmed) return;
                    }
                    const target =
                      selectedBlueprint?.source === 'custom'
                        ? `/dashboard/blueprint/edit/${selectedBlueprint?.recordId || selectedBlueprintId}`
                        : `/dashboard/blueprint/edit/library/${selectedBlueprintId}`;
                    navigate(target);
                  }}
                  nodeName={selectedNode.data?.name || selectedNode.id}
                  height={sidePanelHeight}
                />
              )}
            </>
          );
        })()}
      </div>

      {/* Left-side chat sheet */}
      <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
        <SheetContent side="left" className="p-0 w-[420px] max-w-[90vw]">
          <div className="flex flex-col h-full">
            <div className="px-4 py-3 border-b">
              <SheetHeader>
                <SheetTitle>Workflow Assistant</SheetTitle>
              </SheetHeader>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-sm text-gray-500">
                  Ask to create or update workflows in natural language.
                </div>
              ) : (
                chatMessages.map((m, idx) => (
                  <div
                    key={idx}
                    className={
                      m.role === 'user'
                        ? 'self-end max-w-[85%] bg-blue-50 text-blue-900 px-3 py-2 rounded-lg ml-8'
                        : 'self-start max-w-[85%] bg-gray-100 text-gray-900 px-3 py-2 rounded-lg mr-8'
                    }
                  >
                    <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                  </div>
                ))
              )}
              {isNlLoading && (
                <div className="text-xs text-gray-500">Thinking…</div>
              )}
            </div>
            <div className="border-t px-3 py-2">
              <div className="flex items-center bg-white border rounded-md px-3">
                <input
                  className="flex-1 h-9 outline-none text-sm"
                  placeholder="Type a message..."
                  value={nlMessage}
                  onChange={(e) => setNlMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const msg = nlMessage.trim();
                      if (msg) {
                        setNlMessage('');
                        handleNaturalLanguageSubmit(msg);
                      }
                    }
                  }}
                />
                <button
                  className="ml-2 text-sm px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-60"
                  disabled={isNlLoading || !nlMessage.trim()}
                  onClick={() => {
                    const msg = nlMessage.trim();
                    if (msg) {
                      setNlMessage('');
                      handleNaturalLanguageSubmit(msg);
                    }
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const RunWorkflowButton = ({
  workflowId,
  title,
  nodes,
  userId,
  workflowMeta,
  userProfile,
  workflowSchedule,
  source = 'saved',
  minimal = false,
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isQuickRunOpen, setIsQuickRunOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const workflowForQuickRun = useMemo(
    () => ({
      workflowId,
      title: title || workflowMeta?.title || 'Untitled Workflow',
      description: workflowMeta?.description || '',
      schedule: workflowSchedule || {},
      nodes: nodes || [],
    }),
    [nodes, title, workflowId, workflowMeta, workflowSchedule]
  );

  const handleRunWorkflow = async (definition, workflowRunPreferences) => {
    setIsSubmitting(true);
    try {
      await runWorkflow({
        workflowDefinition: definition,
        workflowRunPreferences,
        userId,
        navigate,
      });
      dispatch(refreshUserCredits())
        .unwrap()
        .catch((error) => {
          console.warn('[Workflow] Failed to refresh credits after workflow start:', error);
        });
      setIsQuickRunOpen(false);
    } catch (error) {
      toast.error(error?.message || 'Failed to start workflow.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const minimalStyles =
    'border-blue-500  hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 rounded-md px-2 py-1 h-8 w-8 flex items-center justify-center shadow-sm disabled:opacity-70 disabled:cursor-not-allowed';

  return (
    <>
      <Button
        variant="outline"
        className={
          minimal ? minimalStyles : 'bg-green-400 hover:text-green-400 text-white'
        }
        onClick={() => setIsQuickRunOpen(true)}
        disabled={isSubmitting}
        title="Run Workflow"
      >
        {isSubmitting ? (
          <Loader2
            className={minimal ? 'w-3.5 h-3.5 animate-spin' : 'mr-2 animate-spin'}
            size={minimal ? undefined : 16}
          />
        ) : (
          <Play
            className={minimal ? 'w-3.5 h-3.5' : 'mr-2'}
            size={minimal ? undefined : 16}
          />
        )}
        {!minimal && (isSubmitting ? 'Starting...' : 'Run Workflow')}
      </Button>
      <QuickRunWorkflowModal
        isOpen={isQuickRunOpen}
        onClose={() => {
          if (!isSubmitting) setIsQuickRunOpen(false);
        }}
        workflow={workflowForQuickRun}
        source={source}
        userProfile={userProfile}
        onRun={handleRunWorkflow}
        onReview={() => setIsQuickRunOpen(false)}
        isSubmitting={isSubmitting}
      />
    </>
  );
};

// --- Validation Utility Functions ---
const validateNodeData = (nodeData, nodeType) => {
  const errors = {};

  // Name is required for all nodes except Start and End nodes which have defaults
  if (nodeType !== NODE_TYPES.START && nodeType !== NODE_TYPES.END) {
    if (!nodeData.name || !nodeData.name.trim()) {
      errors.name = 'Name is required';
    }
  }

  // Validate based on node type
  switch (nodeType) {
    case NODE_TYPES.CLOUD_TASK:
      if (!nodeData.blueprintId || nodeData.blueprintId.length === 0) {
        errors.blueprintId = 'At least one blueprint is required';
      }
      const cloudTaskProvider =
        normalizeCloudProvider(nodeData.inputSettings?.cloudProvider) ||
        normalizeCloudProvider(nodeData.cloudProvider) ||
        'aws';
      if (!nodeData.dynamicTargetsFromInput) {
        if (cloudTaskProvider === 'azure') {
          const selectedTenantProfiles = Array.isArray(
            nodeData.inputSettings?.azureTenantProfiles
          )
            ? nodeData.inputSettings.azureTenantProfiles.filter(Boolean)
            : [];
          if (
            !nodeData.inputSettings?.azureTenantProfileId &&
            !nodeData.inputSettings?.azureTenantProfile?.tenantId &&
            !nodeData.inputSettings?.authProfile?.tenantId &&
            selectedTenantProfiles.length === 0
          ) {
            errors.permissionProfile = 'Azure tenant is required';
          }
          const subscriptionCount = Array.isArray(
            nodeData.inputSettings?.azureSubscriptionProfiles
          )
            ? nodeData.inputSettings.azureSubscriptionProfiles.filter(Boolean).length
            : 0;
          if (subscriptionCount === 0) {
            errors.azureSubscriptions =
              'At least one Azure subscription is required';
          }
          if (!nodeData.multiEnvironment && subscriptionCount > 1) {
            errors.azureSubscriptions =
              'Cloud task nodes can use one Azure subscription unless multi-environment is enabled';
          }
          if (nodeData.multiEnvironment && selectedTenantProfiles.length > 0) {
            const subscribedTenantIds = new Set(
              (nodeData.inputSettings?.azureSubscriptionProfiles || [])
                .filter(Boolean)
                .map((profile) => profile?.tenantId)
            );
            if (
              selectedTenantProfiles.some(
                (tenantProfile) => !subscribedTenantIds.has(tenantProfile?.tenantId)
              )
            ) {
              errors.azureSubscriptions =
                'Select at least one subscription for each Azure tenant';
            }
          }
          if (nodeData.multiEnvironment && !['each', 'all'].includes(nodeData.advanceMode)) {
            errors.advanceMode = 'Advance mode is required';
          }
        } else if (cloudTaskProvider === 'google_workspace') {
          if (nodeData.multiEnvironment) {
            const profileCount = Array.isArray(nodeData.inputSettings?.authProfiles)
              ? nodeData.inputSettings.authProfiles.filter(Boolean).length
              : 0;
            if (profileCount === 0) {
              errors.permissionProfile =
                'At least one Google Workspace profile is required';
            }
            if (!['each', 'all'].includes(nodeData.advanceMode)) {
              errors.advanceMode = 'Advance mode is required';
            }
          } else if (!nodeData.permissionProfile) {
            errors.permissionProfile =
              'Google Workspace permission profile is required';
          }
        } else if (nodeData.multiEnvironment) {
          const profileCount = Array.isArray(nodeData.inputSettings?.authProfiles)
            ? nodeData.inputSettings.authProfiles.filter(Boolean).length
            : 0;
          if (profileCount === 0) {
            errors.permissionProfile =
              'At least one cloud environment is required';
          }
          if (!['each', 'all'].includes(nodeData.advanceMode)) {
            errors.advanceMode = 'Advance mode is required';
          }
        } else if (!nodeData.permissionProfile) {
          errors.permissionProfile = 'Permission profile is required';
        }
        if (cloudTaskProvider === 'aws' && !nodeData.inputSettings?.regions?.length) {
          errors.regions = 'At least one region is required';
        }
      } else if (!['each', 'all'].includes(nodeData.advanceMode)) {
        errors.advanceMode = 'Advance mode is required';
      }
      break;

    case NODE_TYPES.REPORT_TASK:
      const reportTaskMode = String(
        nodeData.inputSettings?.reportNodeMode ||
          nodeData.inputSettings?.mode ||
          nodeData.inputSettings?.reportMode ||
          'run_report'
      )
        .trim()
        .toLowerCase();

      // Check for artifact types that don't require blueprints
      const artifactOnlyKinds = ['cost', 'health', 'inventory', 'threat'];
      const explicitReportSourceType = String(
        nodeData.inputSettings?.reportSourceType || ''
      )
        .trim()
        .toLowerCase();
      const normalizedAnalysisArtifacts = Array.isArray(
        nodeData.inputSettings?.analysisArtifacts
      )
        ? nodeData.inputSettings.analysisArtifacts
        : nodeData.inputSettings?.analysisArtifacts
        ? [nodeData.inputSettings.analysisArtifacts]
        : [];
      const hasArtifactOnlySelection =
        artifactOnlyKinds.includes(explicitReportSourceType) ||
        normalizedAnalysisArtifacts.some((a) =>
          artifactOnlyKinds.includes(String(a?.kind || a || '').trim().toLowerCase())
        );
      const hasBlueprintSelection = nodeData.blueprintId && nodeData.blueprintId.length > 0;

      // Determine if this is artifact analysis mode (either by mode flag OR by having artifact selection)
      const isArtifactAnalysisMode = reportTaskMode === 'analyze_existing' || hasArtifactOnlySelection;

      // Validate that either a blueprint OR an artifact type is selected
      if (!hasBlueprintSelection && !hasArtifactOnlySelection) {
        errors.inputSettings = 'Select a report type';
      }

      const reportProvider =
        normalizeCloudProvider(nodeData.inputSettings?.cloudProvider) ||
        normalizeCloudProvider(nodeData.cloudProvider) ||
        'aws';

      if (nodeData.dynamicTargetsFromInput) {
        if (!['each', 'all'].includes(nodeData.advanceMode)) {
          errors.advanceMode = 'Advance mode is required';
        }
      } else if (reportProvider === 'azure') {
        const selectedTenantProfiles = Array.isArray(
          nodeData.inputSettings?.azureTenantProfiles
        )
          ? nodeData.inputSettings.azureTenantProfiles.filter(Boolean)
          : [];
        if (
          !nodeData.inputSettings?.azureTenantProfileId &&
          !nodeData.inputSettings?.azureTenantProfile?.tenantId &&
          !nodeData.inputSettings?.authProfile?.tenantId &&
          selectedTenantProfiles.length === 0
        ) {
          errors.permissionProfile = 'Azure tenant is required';
        }
        const subscriptionCount = Array.isArray(
          nodeData.inputSettings?.azureSubscriptionProfiles
        )
          ? nodeData.inputSettings.azureSubscriptionProfiles.filter(Boolean).length
          : 0;
        if (subscriptionCount === 0) {
          errors.azureSubscriptions =
            'At least one Azure subscription is required';
        }
        if (nodeData.multiEnvironment && selectedTenantProfiles.length > 0) {
          const subscribedTenantIds = new Set(
            (nodeData.inputSettings?.azureSubscriptionProfiles || [])
              .filter(Boolean)
              .map((profile) => profile?.tenantId)
          );
          if (
            selectedTenantProfiles.some(
              (tenantProfile) => !subscribedTenantIds.has(tenantProfile?.tenantId)
            )
          ) {
            errors.azureSubscriptions =
              'Select at least one subscription for each Azure tenant';
          }
        }
        if (nodeData.multiEnvironment && !['each', 'all'].includes(nodeData.advanceMode)) {
          errors.advanceMode = 'Advance mode is required';
        }
      } else if (reportProvider === 'google_workspace') {
        if (nodeData.multiEnvironment) {
          const profileCount = Array.isArray(nodeData.inputSettings?.authProfiles)
            ? nodeData.inputSettings.authProfiles.filter(Boolean).length
            : 0;
          if (profileCount === 0) {
            errors.permissionProfile =
              'At least one Google Workspace profile is required';
          }
          if (!['each', 'all'].includes(nodeData.advanceMode)) {
            errors.advanceMode = 'Advance mode is required';
          }
        } else if (!nodeData.permissionProfile) {
          errors.permissionProfile =
            'Google Workspace permission profile is required';
        }
      } else if (nodeData.multiEnvironment) {
        const profileCount = Array.isArray(nodeData.inputSettings?.authProfiles)
          ? nodeData.inputSettings.authProfiles.filter(Boolean).length
          : 0;
        if (profileCount === 0) {
          errors.permissionProfile =
            'At least one cloud environment is required';
        }
        if (!['each', 'all'].includes(nodeData.advanceMode)) {
          errors.advanceMode = 'Advance mode is required';
        }
      } else if (!nodeData.permissionProfile) {
        errors.permissionProfile = 'Permission profile is required';
      }
      // Regions only required for blueprint-based reports, not artifact analysis
      if (
        reportProvider === 'aws' &&
        !nodeData.dynamicTargetsFromInput &&
        !isArtifactAnalysisMode &&
        !nodeData.inputSettings?.regions?.length
      ) {
        errors.regions = 'At least one region is required';
      }
      break;

    case NODE_TYPES.COMMUNICATION:
      // Use explicit communicationType; default to 'email'
      const communicationType = (nodeData.communicationType || 'email').toLowerCase();
      if (!communicationType) {
        errors.communicationType = 'Communication type is required';
      }
      // Check for recipients if communication type is email or if no communication type is set (defaults to email)
      // Also check if recipients field exists and has content
      // Handle both string and array formats for recipients
      let hasRecipients = false;
      if (nodeData.recipients) {
        if (Array.isArray(nodeData.recipients)) {
          hasRecipients =
            nodeData.recipients.length > 0 &&
            nodeData.recipients.some((r) => r && r.trim());
        } else {
          hasRecipients = nodeData.recipients.trim();
        }
      }
      if (communicationType === 'email' && !hasRecipients) {
        errors.recipients = 'Recipients are required';
      }
      break;

    case NODE_TYPES.APPROVAL:
      // Approval nodes might have specific requirements in the future
      break;

    case NODE_TYPES.DECISION:
      // Decision nodes might have specific requirements in the future
      break;

    case NODE_TYPES.START:
    case NODE_TYPES.END:
      // Start/End nodes typically don't have additional required fields
      break;
  }

  return errors;
};

const hasValidationErrors = (nodeData, nodeType) => {
  const errors = validateNodeData(nodeData, nodeType);
  return Object.keys(errors).length > 0;
};
