import React, { useEffect, useMemo, useState, useCallback } from 'react';
import ReactFlow, { ReactFlowProvider, Background, useReactFlow } from 'reactflow';
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit,
  Loader2,
  Play,
  Save,
  Sparkles,
  TerminalSquare,
  X,
} from 'lucide-react';
import 'reactflow/dist/style.css';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getRegionOptions } from '@/helpers/shared';
import { normalizeWorkflowRunNodes } from '@/helpers/workflowRunNormalization';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';
import { getLocalAwsCredentialIssueMessage } from '@/features/workspace/credentialStatus';
import {
  BUILT_IN_CODING_AGENT_RUNNERS,
  CLOUDAGENT_RUNNER_DEFINITION,
} from '@cloudagent/agent-runtime';
import {
  transformWorkflowToNodes,
  buildEdgesFromNodes,
  getLayoutedElements,
  reactFlowNodeTypes,
} from '@/pages/Workflow';

const NODE_TYPES = {
  CLOUD_TASK: 'cloudTask',
  REPORT_TASK: 'reportTask',
  COMMUNICATION: 'communication',
};

const EMPTY_VALUE = '__empty__';

const RUNNER_ICON_BY_ID = {
  cloudagent: Sparkles,
  codex: TerminalSquare,
  claude: Bot,
  cursor: TerminalSquare,
};

const CLOUD_TASK_RUNNER_OPTIONS = [
  CLOUDAGENT_RUNNER_DEFINITION,
  ...BUILT_IN_CODING_AGENT_RUNNERS,
].map((runner) => ({
  value: runner.id,
  label: runner.label,
  icon: RUNNER_ICON_BY_ID[runner.id] || TerminalSquare,
}));

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

const deepClone = (value) => safeParseJSON(JSON.stringify(value), value);

const ensureArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const normalizeProvider = (value) => {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (!normalized) return '';
  if (['amazon', 'amazon_web_services', 'aws', 'aws_account', 'aws_org'].includes(normalized)) {
    return 'aws';
  }
  if (['azure', 'microsoft_azure', 'azure_tenant', 'azure_subscription'].includes(normalized)) {
    return 'azure';
  }
  if (['google_workspace', 'google_workspace_account', 'gws'].includes(normalized)) {
    return 'google_workspace';
  }
  if (['google_cloud', 'google_cloud_platform', 'gcp'].includes(normalized)) {
    return 'gcp';
  }
  return normalized;
};

const getProviderLabel = (provider) => {
  switch (normalizeProvider(provider) || 'aws') {
    case 'azure':
      return 'Azure';
    case 'google_workspace':
      return 'Google Workspace';
    case 'gcp':
      return 'Google Cloud';
    case 'aws':
    default:
      return 'AWS';
  }
};

const parseAuthProfile = (profile) => {
  if (!profile) return {};
  const parsed = safeParseJSON(profile.authProfile, profile.authProfile || {});
  return parsed && typeof parsed === 'object' ? parsed : {};
};

const getProfileType = (profile) => {
  const authProfile = parseAuthProfile(profile);
  const explicitType = String(
    profile?.type || profile?.profileType || profile?.environmentType || ''
  )
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ');

  if (explicitType) return explicitType;
  if (authProfile?.provider === 'azure') {
    return authProfile?.subscriptionId ? 'azure subscription' : 'azure tenant';
  }
  if (authProfile?.provider === 'google_workspace') return 'google workspace';
  if (authProfile?.awsAccountId || authProfile?.accountId) return 'aws account';
  return '';
};

const getProfileValue = (profile) => {
  const authProfile = parseAuthProfile(profile);
  const profileId = profile?.recordId || profile?.id || profile?.permissionProfileId;
  if (profileId) return profileId;
  return `${profile?.name || 'profile'}-${
    authProfile.awsAccountId ||
    authProfile.accountId ||
    authProfile.subscriptionId ||
    authProfile.tenantId ||
    authProfile.domain ||
    'unknown'
  }`;
};

const getProfileLabel = (profile) => {
  const authProfile = parseAuthProfile(profile);
  const identifier =
    authProfile.awsAccountId ||
    authProfile.accountId ||
    authProfile.subscriptionName ||
    authProfile.subscriptionId ||
    authProfile.tenantId ||
    authProfile.domain ||
    '';
  return identifier
    ? `${profile?.name || 'Profile'} - ${identifier}`
    : profile?.name || 'Profile';
};

const getDefaultRegions = (profile) => {
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

const buildProfileOption = (profile) => {
  const authProfile = parseAuthProfile(profile);
  return {
    value: getProfileValue(profile),
    label: getProfileLabel(profile),
    profile,
    defaultRegions: getDefaultRegions(profile),
    authProfile: {
      ...authProfile,
      name: profile?.name,
      permissionProfileId:
        profile?.recordId || profile?.id || profile?.permissionProfileId || null,
    },
  };
};

const getOptionCredentialIssue = (option) =>
  isLocalRuntime() ? getLocalAwsCredentialIssueMessage(option?.profile) : '';

const getWorkflowTitle = (workflow) =>
  workflow?.title || workflow?.workflowName || 'Untitled Workflow';

const getWorkflowDescription = (workflow) =>
  workflow?.description || workflow?.workflowDescription || '';

const getWorkflowId = (workflow) =>
  workflow?.workflowId || workflow?.id || workflow?.sourceWorkflowId || '';

const looksLikeEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const getSignedInUserEmail = (userProfile) => {
  const candidates = [
    userProfile?.email,
    userProfile?.signInDetails?.loginId,
    userProfile?.attributes?.email,
    userProfile?.user?.email,
    userProfile?.user?.signInDetails?.loginId,
    userProfile?.username,
  ];
  return (
    candidates
      .map((candidate) => String(candidate || '').trim())
      .find(looksLikeEmail) || ''
  );
};

const normalizeWorkflowNodes = (workflow) => {
  const rawNodes = Array.isArray(workflow?.nodes)
    ? workflow.nodes
    : safeParseJSON(workflow?.nodes, []);
  return normalizeWorkflowRunNodes(rawNodes).map((node) => {
    const data = node?.data && typeof node.data === 'object' ? node.data : node;
    const blueprintIds = ensureArray(data?.blueprintId);
    return {
      ...deepClone(data),
      id: data?.id || node?.id,
      type: data?.type || node?.type,
      name: data?.name || node?.name || data?.id || node?.id || 'Node',
      inputFrom: ensureArray(data?.inputFrom),
      next: ensureArray(data?.next),
      logic: ensureArray(data?.logic),
      blueprintId: blueprintIds.length > 0 ? blueprintIds : ensureArray(data?.reportId),
      inputSettings: {
        ...(data?.inputSettings || {}),
      },
    };
  });
};

const isRunnableTaskNode = (node) =>
  node?.type === NODE_TYPES.CLOUD_TASK || node?.type === NODE_TYPES.REPORT_TASK;

const isCommunicationNode = (node) => node?.type === NODE_TYPES.COMMUNICATION;

const getTaskProvider = (node) =>
  normalizeProvider(node?.inputSettings?.cloudProvider) ||
  normalizeProvider(node?.cloudProvider) ||
  'aws';

const findOptionByValueOrAuth = (options, value, matcher) =>
  options.find((option) => option.value === value || matcher?.(option)) || null;

// Equality helper that ignores nullish values so AWS options (which have no
// tenantId/domain) don't all collide on `undefined === undefined`.
const valuesEqual = (a, b) => Boolean(a && b && a === b);

const getComparableProfileValues = (profile = {}) =>
  [
    profile.permissionProfileId,
    profile.recordId,
    profile.id,
    profile.awsAccountId,
    profile.accountId,
    profile.subscriptionId,
    profile.azureSubscriptionId,
    profile.tenantId,
    profile.azureTenantId,
    profile.domain,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

const authProfilesMatch = (left = {}, right = {}) => {
  const leftValues = getComparableProfileValues(left);
  const rightValues = getComparableProfileValues(right);
  if (leftValues.length === 0 || rightValues.length === 0) return false;
  const rightValueSet = new Set(rightValues);
  return leftValues.some((value) => rightValueSet.has(value));
};

const buildTargetEnvironment = (
  authProfile = null,
  existingTargetEnvironment = null,
  provider = ''
) => {
  if (!authProfile || typeof authProfile !== 'object') return null;

  const {
    permissionProfileId: _existingPermissionProfileId,
    recordId: _existingRecordId,
    id: _existingId,
    accountId: _existingAccountId,
    awsAccountId: _existingAwsAccountId,
    tenantId: _existingTenantId,
    azureTenantId: _existingAzureTenantId,
    subscriptionId: _existingSubscriptionId,
    azureSubscriptionId: _existingAzureSubscriptionId,
    subscriptionIds: _existingSubscriptionIds,
    domain: _existingDomain,
    name: _existingName,
    cloudProvider: _existingCloudProvider,
    provider: _existingProvider,
    ...rest
  } =
    existingTargetEnvironment && typeof existingTargetEnvironment === 'object'
      ? existingTargetEnvironment
      : {};

  const subscriptionIds = Array.from(
    new Set(
      [
        authProfile.subscriptionId,
        authProfile.azureSubscriptionId,
        ...(Array.isArray(authProfile.subscriptionIds)
          ? authProfile.subscriptionIds
          : []),
        ...(Array.isArray(authProfile.azureSubscriptionIds)
          ? authProfile.azureSubscriptionIds
          : []),
        ...(Array.isArray(authProfile.subscriptions)
          ? authProfile.subscriptions.map(
              (subscription) => subscription?.subscriptionId || subscription?.id
            )
          : []),
      ]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );
  const cloudProvider =
    normalizeProvider(provider) ||
    normalizeProvider(authProfile.provider) ||
    normalizeProvider(authProfile.cloudProvider);
  const accountId =
    authProfile.awsAccountId ||
    authProfile.accountId ||
    subscriptionIds[0] ||
    authProfile.tenantId ||
    authProfile.azureTenantId ||
    authProfile.domain ||
    '';

  return {
    ...rest,
    ...(cloudProvider ? { cloudProvider } : {}),
    ...(authProfile.permissionProfileId
      ? { permissionProfileId: authProfile.permissionProfileId }
      : {}),
    ...(accountId ? { accountId } : {}),
    ...(authProfile.awsAccountId ? { awsAccountId: authProfile.awsAccountId } : {}),
    ...(authProfile.tenantId || authProfile.azureTenantId
      ? { tenantId: authProfile.tenantId || authProfile.azureTenantId }
      : {}),
    ...(subscriptionIds.length > 0
      ? {
          subscriptionId: subscriptionIds[0],
          subscriptionIds,
        }
      : {}),
    ...(authProfile.domain ? { domain: authProfile.domain } : {}),
    ...(authProfile.name ? { name: authProfile.name } : {}),
  };
};

const getDefaultRegionsForProfiles = (profiles = [], options = []) => {
  const regions = profiles.flatMap((profile) => {
    const option = options.find((item) => authProfilesMatch(item.authProfile, profile));
    return option?.defaultRegions || [];
  });
  return Array.from(new Set(regions.filter(Boolean)));
};

const formatRegionSummary = (regions = []) => {
  const selected = ensureArray(regions).filter(Boolean);
  if (selected.length === 0) return 'No regions selected';
  if (selected.length <= 3) return selected.join(', ');
  return `${selected.slice(0, 3).join(', ')} +${selected.length - 3} more`;
};

const applyProfileSelection = (node, option, provider, allOptions = {}) => {
  const selectedAuthProfile = option?.authProfile || null;
  const next = {
    ...node,
    permissionProfile: option?.value || '',
    inputSettings: {
      ...(node.inputSettings || {}),
      cloudProvider: provider,
      authProfile: selectedAuthProfile,
      permissionProfileId: selectedAuthProfile?.permissionProfileId || '',
      targetEnvironment: buildTargetEnvironment(
        selectedAuthProfile,
        node.inputSettings?.targetEnvironment,
        provider
      ),
    },
  };

  if (provider === 'aws') {
    next.inputSettings.authProfiles = selectedAuthProfile ? [selectedAuthProfile] : [];
    if (option?.defaultRegions?.length) {
      next.inputSettings.regions = option.defaultRegions;
    }
  }

  if (provider === 'google_workspace') {
    next.inputSettings.authProfiles = selectedAuthProfile ? [selectedAuthProfile] : [];
    next.inputSettings.regions = [];
  }

  if (provider === 'azure') {
    const tenantOption = option || null;
    const existingSubscriptions = Array.isArray(
      node.inputSettings?.azureSubscriptionProfiles
    )
      ? node.inputSettings.azureSubscriptionProfiles
      : [];
    const tenantId = tenantOption?.authProfile?.tenantId;
    const filteredSubscriptions = tenantId
      ? existingSubscriptions.filter((profile) => profile?.tenantId === tenantId)
      : [];

    next.inputSettings.authProfile = selectedAuthProfile;
    next.inputSettings.azureTenantProfile = selectedAuthProfile;
    next.inputSettings.azureTenantProfileId = tenantOption?.value || '';
    next.inputSettings.azureTenantProfiles = selectedAuthProfile
      ? [selectedAuthProfile]
      : [];
    next.inputSettings.authProfiles = filteredSubscriptions;
    next.inputSettings.azureSubscriptionProfiles = filteredSubscriptions;
    next.inputSettings.regions = [];

    const subscriptionOptions = allOptions.azureSubscriptions || [];
    if (tenantId && filteredSubscriptions.length === 0) {
      const firstSubscription = subscriptionOptions.find(
        (subOption) => subOption.authProfile?.tenantId === tenantId
      );
      if (firstSubscription && subscriptionOptions.filter((subOption) => subOption.authProfile?.tenantId === tenantId).length === 1) {
        next.inputSettings.authProfiles = [firstSubscription.authProfile];
        next.inputSettings.azureSubscriptionProfiles = [firstSubscription.authProfile];
      }
    }
  }

  return next;
};

const createInitialDraftNodes = (workflow, profileOptions) => {
  const nodes = normalizeWorkflowNodes(workflow);

  return nodes.map((node) => {
    if (!isRunnableTaskNode(node)) return node;

    const provider = getTaskProvider(node);
    let next = {
      ...node,
      inputSettings: {
        ...(node.inputSettings || {}),
        cloudProvider: provider,
      },
      advanceMode: node.advanceMode || 'all',
    };

    if (node.dynamicTargetsFromInput) return next;

    const options =
      provider === 'azure'
        ? profileOptions.azureTenants
        : provider === 'google_workspace'
        ? profileOptions.googleWorkspace
        : profileOptions.aws;

    const existingOption = findOptionByValueOrAuth(
      options,
      next.permissionProfile,
      (option) =>
        valuesEqual(
          option.authProfile?.permissionProfileId,
          next.inputSettings?.permissionProfileId
        ) ||
        valuesEqual(
          option.authProfile?.permissionProfileId,
          next.inputSettings?.authProfile?.permissionProfileId
        ) ||
        authProfilesMatch(option.authProfile, next.inputSettings?.targetEnvironment) ||
        valuesEqual(
          option.authProfile?.tenantId,
          next.inputSettings?.authProfile?.tenantId
        ) ||
        valuesEqual(
          option.authProfile?.domain,
          next.inputSettings?.authProfile?.domain
        )
    );

    if (existingOption) {
      next = applyProfileSelection(next, existingOption, provider, profileOptions);
    } else if (!next.permissionProfile && options.length === 1) {
      next = applyProfileSelection(next, options[0], provider, profileOptions);
    }

    return next;
  });
};

const selectedAuthProfileCount = (node) =>
  Array.isArray(node?.inputSettings?.authProfiles)
    ? node.inputSettings.authProfiles.filter(Boolean).length
    : 0;

const hasRecipients = (node) => {
  const recipients = node?.recipients;
  if (Array.isArray(recipients)) return recipients.some((recipient) => String(recipient || '').trim());
  return Boolean(String(recipients || '').trim());
};

const defaultMissingCommunicationRecipients = (nodes = [], email = '') => {
  const defaultEmail = String(email || '').trim();
  if (!looksLikeEmail(defaultEmail)) return nodes;

  return nodes.map((node) => {
    if (!isCommunicationNode(node) || hasRecipients(node)) return node;

    const communicationType = String(
      node.communicationType || node.action || 'email'
    ).toLowerCase();
    if (!communicationType.includes('email') && communicationType !== 'notify action') {
      return node;
    }

    return {
      ...node,
      action: node.action || 'email',
      communicationType: node.communicationType || 'email',
      recipients: defaultEmail,
    };
  });
};

const isArtifactAnalysisReport = (node) => {
  const mode = String(
    node?.inputSettings?.reportNodeMode ||
      node?.inputSettings?.mode ||
      node?.inputSettings?.reportMode ||
      'run_report'
  )
    .trim()
    .toLowerCase();
  const sourceType = String(node?.inputSettings?.reportSourceType || '')
    .trim()
    .toLowerCase();
  const artifactKinds = ['cost', 'health', 'inventory', 'threat'];
  const artifacts = Array.isArray(node?.inputSettings?.analysisArtifacts)
    ? node.inputSettings.analysisArtifacts
    : node?.inputSettings?.analysisArtifacts
    ? [node.inputSettings.analysisArtifacts]
    : [];
  return (
    mode === 'analyze_existing' ||
    artifactKinds.includes(sourceType) ||
    artifacts.some((artifact) =>
      artifactKinds.includes(String(artifact?.kind || artifact || '').trim().toLowerCase())
    )
  );
};

const getNodeMissingFields = (node) => {
  const missing = [];

  if (isRunnableTaskNode(node)) {
    if (!ensureArray(node.blueprintId).length && !isArtifactAnalysisReport(node)) {
      missing.push({ key: 'blueprintId', label: 'Task or report type' });
    }

    const provider = getTaskProvider(node);
    if (node.dynamicTargetsFromInput) {
      if (!['each', 'all'].includes(node.advanceMode)) {
        missing.push({ key: 'advanceMode', label: 'Advance mode' });
      }
      return missing;
    }

    if (provider === 'azure') {
      const tenantCount = Array.isArray(node.inputSettings?.azureTenantProfiles)
        ? node.inputSettings.azureTenantProfiles.filter(Boolean).length
        : 0;
      const hasTenant =
        node.inputSettings?.azureTenantProfileId ||
        node.inputSettings?.azureTenantProfile?.tenantId ||
        node.inputSettings?.authProfile?.tenantId ||
        tenantCount > 0;
      if (!hasTenant) missing.push({ key: 'azureTenant', label: 'Azure tenant' });

      const subscriptionCount = Array.isArray(
        node.inputSettings?.azureSubscriptionProfiles
      )
        ? node.inputSettings.azureSubscriptionProfiles.filter(Boolean).length
        : 0;
      if (subscriptionCount === 0) {
        missing.push({ key: 'azureSubscriptions', label: 'Azure subscription' });
      }
    } else if (provider === 'google_workspace') {
      if (node.multiEnvironment) {
        if (selectedAuthProfileCount(node) === 0) {
          missing.push({
            key: 'permissionProfile',
            label: 'Google Workspace profile',
          });
        }
      } else if (!node.permissionProfile) {
        missing.push({
          key: 'permissionProfile',
          label: 'Google Workspace profile',
        });
      }
    } else if (node.multiEnvironment) {
      if (selectedAuthProfileCount(node) === 0) {
        missing.push({ key: 'permissionProfile', label: 'Cloud environment' });
      }
    } else if (!node.permissionProfile) {
      missing.push({ key: 'permissionProfile', label: 'Cloud environment' });
    }

    if (node.multiEnvironment && !['each', 'all'].includes(node.advanceMode)) {
      missing.push({ key: 'advanceMode', label: 'Advance mode' });
    }

    if (
      provider === 'aws' &&
      (node.type === NODE_TYPES.CLOUD_TASK ||
        (node.type === NODE_TYPES.REPORT_TASK && !isArtifactAnalysisReport(node))) &&
      !ensureArray(node.inputSettings?.regions).length
    ) {
      missing.push({ key: 'regions', label: 'AWS regions' });
    }
  }

  if (isCommunicationNode(node)) {
    const communicationType = String(node.communicationType || node.action || 'email').toLowerCase();
    if (communicationType.includes('email') || communicationType === 'notify action') {
      if (!hasRecipients(node)) {
        missing.push({ key: 'recipients', label: 'Email recipients' });
      }
    }
  }

  return missing;
};

const TARGET_MODES = [
  { value: 'single', label: 'Signle environment' },
  { value: 'multiple', label: 'Multiple environments' },
  { value: 'dynamic', label: 'From previous node' },
];

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /mac/i.test(navigator.platform || navigator.userAgent || '');

const getNodeSelectionSummary = (node) => {
  if (isCommunicationNode(node)) {
    const recipients = Array.isArray(node.recipients)
      ? node.recipients.filter(Boolean).join(', ')
      : String(node.recipients || '').trim();
    return recipients || null;
  }

  if (!isRunnableTaskNode(node)) return null;

  if (node.dynamicTargetsFromInput) {
    return 'Targets resolved from previous node';
  }

  const provider = getTaskProvider(node);
  const parts = [];

  if (node.multiEnvironment) {
    const profiles = Array.isArray(node.inputSettings?.authProfiles)
      ? node.inputSettings.authProfiles.filter(Boolean)
      : [];
    if (profiles.length > 0) {
      parts.push(
        `${profiles.length} environment${profiles.length === 1 ? '' : 's'}`
      );
    }
  } else if (provider === 'azure') {
    const tenantName =
      node.inputSettings?.azureTenantProfile?.name ||
      node.inputSettings?.authProfile?.name;
    if (tenantName) parts.push(tenantName);
    const subs = Array.isArray(node.inputSettings?.azureSubscriptionProfiles)
      ? node.inputSettings.azureSubscriptionProfiles.filter(Boolean)
      : [];
    if (subs.length > 0) {
      parts.push(`${subs.length} sub${subs.length === 1 ? '' : 's'}`);
    }
  } else {
    const profileName = node.inputSettings?.authProfile?.name;
    if (profileName) parts.push(profileName);
  }

  if (provider === 'aws') {
    const regions = ensureArray(node.inputSettings?.regions);
    if (regions.length > 0) {
      parts.push(`${regions.length} region${regions.length === 1 ? '' : 's'}`);
    }
  }

  return parts.length > 0 ? parts.join(' · ') : null;
};

const getOptionsForNodeProvider = (profileOptions, provider) =>
  provider === 'azure'
    ? profileOptions.azureTenants
    : provider === 'google_workspace'
      ? profileOptions.googleWorkspace
      : profileOptions.aws;

const getSelectedProfileOptionsForNode = (node, profileOptions) => {
  if (!isRunnableTaskNode(node) || node.dynamicTargetsFromInput) return [];
  const provider = getTaskProvider(node);
  const options = getOptionsForNodeProvider(profileOptions, provider);
  if (node.multiEnvironment) {
    const selectedProfiles = Array.isArray(node.inputSettings?.authProfiles)
      ? node.inputSettings.authProfiles.filter(Boolean)
      : [];
    return selectedProfiles
      .map((profile) =>
        options.find((option) => authProfilesMatch(option.authProfile, profile))
      )
      .filter(Boolean);
  }
  const selectedOption = findOptionByValueOrAuth(
    options,
    node.permissionProfile,
    (option) =>
      valuesEqual(option.authProfile?.permissionProfileId, node.inputSettings?.permissionProfileId) ||
      authProfilesMatch(option.authProfile, node.inputSettings?.targetEnvironment) ||
      valuesEqual(option.authProfile?.tenantId, node.inputSettings?.authProfile?.tenantId) ||
      valuesEqual(option.authProfile?.domain, node.inputSettings?.authProfile?.domain)
  );
  return selectedOption ? [selectedOption] : [];
};

const getCredentialIssuesForNode = (node, profileOptions) =>
  getSelectedProfileOptionsForNode(node, profileOptions)
    .map((option) => ({
      option,
      message: getOptionCredentialIssue(option),
    }))
    .filter((entry) => entry.message);

const buildRunDefinition = (workflow, draftNodes, source, runTitle) => ({
  workflowId: getWorkflowId(workflow),
  sourceWorkflowId: workflow?.sourceWorkflowId || getWorkflowId(workflow),
  workflowSource: source,
  title: String(runTitle || '').trim() || getWorkflowTitle(workflow),
  description: getWorkflowDescription(workflow),
  schedule: workflow?.schedule,
  source,
  nodes: draftNodes,
});

function CompactFlowPreviewInner({ workflow }) {
  const reactFlowInstance = useReactFlow();
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isLayoutApplied, setIsLayoutApplied] = useState(false);

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'smoothstep',
      animated: false,
      style: { strokeWidth: 1, stroke: '#94a3b8' },
      markerEnd: { type: 'arrowclosed', width: 12, height: 12, color: '#94a3b8' },
    }),
    []
  );

  useEffect(() => {
    if (!reactFlowInstance || !workflow || isLayoutApplied) return;

    const rawNodes = Array.isArray(workflow?.nodes)
      ? workflow.nodes
      : safeParseJSON(workflow?.nodes, []);

    if (!Array.isArray(rawNodes) || rawNodes.length === 0) {
      setIsLayoutApplied(true);
      return;
    }

    const initialNodes = transformWorkflowToNodes(workflow, () => {}, 'TB');
    const initialEdges = buildEdgesFromNodes(initialNodes, defaultEdgeOptions);

    const layoutedNodes =
      initialNodes.length > 0
        ? getLayoutedElements(initialNodes, initialEdges, 'TB')
        : [];

    const readOnlyNodes = layoutedNodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        onHeightMeasured: () => {},
        onDelete: undefined,
        layoutDirection: 'TB',
      },
    }));

    setNodes(readOnlyNodes);
    setEdges(initialEdges);
    setIsLayoutApplied(true);

    setTimeout(() => {
      reactFlowInstance?.fitView({ padding: 0.05, duration: 200, maxZoom: 0.5 });
    }, 50);
  }, [reactFlowInstance, workflow, isLayoutApplied, defaultEdgeOptions]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={reactFlowNodeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      style={{ background: '#f8fafc' }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag={false}
      zoomOnScroll={false}
      zoomOnDoubleClick={false}
      minZoom={0.1}
      maxZoom={0.5}
      fitView
      fitViewOptions={{ padding: 0.05, maxZoom: 0.5 }}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant="dots" gap={12} size={1} color="#e2e8f0" />
    </ReactFlow>
  );
}

function CompactFlowPreview({ workflow }) {
  return (
    <div className="h-full w-full">
      <ReactFlowProvider>
        <CompactFlowPreviewInner workflow={workflow} />
      </ReactFlowProvider>
    </div>
  );
}

function EnvironmentCombobox({
  options,
  selectedOption,
  placeholder,
  searchPlaceholder,
  emptyText,
  hasError,
  onSelect,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        disabled={options.length === 0}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'h-9 w-full justify-between bg-white px-3 text-left text-sm font-normal',
          hasError && 'border-red-400'
        )}
      >
        <span className="truncate">
          {selectedOption?.label ||
            (options.length > 0 ? placeholder : 'No environments available')}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[95] rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="border-b p-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder || 'Search environments...'}
              autoFocus
              className="h-9"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const credentialIssue = getOptionCredentialIssue(option);
                return (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => {
                      onSelect(option);
                      setOpen(false);
                      setQuery('');
                    }}
                    className="flex w-full items-start rounded-sm px-2 py-2 text-left text-sm hover:bg-gray-100"
                  >
                    <Check
                      className={cn(
                        'mr-2 mt-0.5 h-4 w-4 shrink-0',
                        selectedOption?.value === option.value
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{option.label}</span>
                      {credentialIssue ? (
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          <span className="truncate">Credentials need attention</span>
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-6 text-center text-sm text-gray-500">
                {emptyText || 'No environments found.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MultiEnvironmentPicker({
  options,
  selectedProfiles,
  provider,
  hasError,
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedCount = selectedProfiles.length;
  const summary =
    selectedCount === 0
      ? 'No environments selected'
      : `${selectedCount} environment${selectedCount === 1 ? '' : 's'} selected`;
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  const toggleOption = (option) => {
    const isSelected = selectedProfiles.some((profile) =>
      authProfilesMatch(profile, option.authProfile)
    );
    const nextProfiles = isSelected
      ? selectedProfiles.filter(
          (profile) => !authProfilesMatch(profile, option.authProfile)
        )
      : [...selectedProfiles, option.authProfile];
    onChange(nextProfiles);
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        className={cn(
          'h-9 w-full justify-between bg-white px-3 text-left text-sm font-normal',
          hasError && 'border-red-400'
        )}
        disabled={options.length === 0}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{options.length > 0 ? summary : 'No environments available'}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[95] rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="border-b p-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${getProviderLabel(provider)} environments...`}
              autoFocus
              className="h-9"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const checked = selectedProfiles.some((profile) =>
                  authProfilesMatch(profile, option.authProfile)
                );
                const credentialIssue = getOptionCredentialIssue(option);
                return (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => toggleOption(option)}
                    className="flex w-full items-start rounded-sm px-2 py-2 text-left text-sm hover:bg-gray-100"
                  >
                    <Checkbox checked={checked} className="mr-2 mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{option.label}</span>
                      {credentialIssue ? (
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          <span className="truncate">Credentials need attention</span>
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-6 text-center text-sm text-gray-500">
                No environments found.
              </div>
            )}
          </div>
          <div className="flex justify-end border-t p-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setOpen(false);
                setQuery('');
              }}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuickRunWorkflowModal({
  isOpen,
  onClose,
  workflow,
  source = 'saved',
  userProfile,
  onRun,
  onSaveAndRun,
  onReview,
  isSubmitting = false,
}) {
  const canSaveAndRun = typeof onSaveAndRun === 'function';
  const permissionProfiles = userProfile?.agentPermissionProfiles || [];
  const [draftNodes, setDraftNodes] = useState([]);
  const [runTitle, setRunTitle] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [regionPickerNodeId, setRegionPickerNodeId] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [cloudTaskRunner, setCloudTaskRunner] = useState('cloudagent');

  const toggleNodeExpanded = useCallback((nodeId) => {
    setExpandedNodes((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const profileOptions = useMemo(() => {
    const options = permissionProfiles.map(buildProfileOption);
    return {
      aws: options.filter((option) => getProfileType(option.profile) === 'aws account'),
      azureTenants: options.filter(
        (option) => getProfileType(option.profile) === 'azure tenant'
      ),
      azureSubscriptions: options.filter(
        (option) => getProfileType(option.profile) === 'azure subscription'
      ),
      googleWorkspace: options.filter((option) =>
        ['google workspace', 'google_workspace'].includes(getProfileType(option.profile))
      ),
    };
  }, [permissionProfiles]);

  const signedInUserEmail = useMemo(
    () => getSignedInUserEmail(userProfile),
    [userProfile]
  );

  useEffect(() => {
    if (!isOpen || !workflow) return;
    const initialNodes = defaultMissingCommunicationRecipients(
      createInitialDraftNodes(workflow, profileOptions),
      signedInUserEmail
    );
    setDraftNodes(initialNodes);
    setRunTitle(getWorkflowTitle(workflow));
    setAttemptedSubmit(false);
    setCloudTaskRunner('cloudagent');

    const firstMissing = initialNodes.find((node) => {
      if (!isRunnableTaskNode(node) && !isCommunicationNode(node)) return false;
      return getNodeMissingFields(node).length > 0;
    });
    setExpandedNodes(firstMissing ? new Set([firstMissing.id]) : new Set());
  }, [isOpen, workflow, profileOptions, signedInUserEmail]);

  const runnableNodes = useMemo(
    () =>
      draftNodes.filter(
        (node) => isRunnableTaskNode(node) || isCommunicationNode(node)
      ),
    [draftNodes]
  );

  const missingByNode = useMemo(() => {
    return runnableNodes.reduce((acc, node) => {
      acc[node.id] = getNodeMissingFields(node);
      return acc;
    }, {});
  }, [runnableNodes]);

  const missingCount = Object.values(missingByNode).reduce(
    (count, missing) => count + missing.length,
    0
  );
  const credentialIssuesByNode = useMemo(() => {
    if (!isLocalRuntime()) return {};
    return runnableNodes.reduce((acc, node) => {
      const issues = getCredentialIssuesForNode(node, profileOptions);
      if (issues.length > 0) acc[node.id] = issues;
      return acc;
    }, {});
  }, [runnableNodes, profileOptions]);
  const credentialIssueCount = Object.values(credentialIssuesByNode).reduce(
    (count, issues) => count + issues.length,
    0
  );
  const hasCloudTaskNodes = useMemo(
    () => draftNodes.some((node) => node.type === NODE_TYPES.CLOUD_TASK),
    [draftNodes]
  );

  const updateNode = (nodeId, updater) => {
    setDraftNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? typeof updater === 'function'
            ? updater(node)
            : { ...node, ...updater }
          : node
      )
    );
  };

  const updateInputSettings = (nodeId, patch) => {
    updateNode(nodeId, (node) => ({
      ...node,
      inputSettings: {
        ...(node.inputSettings || {}),
        ...patch,
      },
    }));
  };

  const regionPickerNode = draftNodes.find((node) => node.id === regionPickerNodeId);
  const regionPickerRegions = ensureArray(regionPickerNode?.inputSettings?.regions);

  const updateTargetMode = (nodeId, mode) => {
    updateNode(nodeId, (node) => {
      const provider = getTaskProvider(node);
      const authProfiles = Array.isArray(node.inputSettings?.authProfiles)
        ? node.inputSettings.authProfiles.filter(Boolean)
        : [];

      if (mode === 'dynamic') {
        return {
          ...node,
          dynamicTargetsFromInput: true,
          multiEnvironment: false,
          advanceMode: node.advanceMode || 'all',
        };
      }

      if (mode === 'multiple') {
        return {
          ...node,
          dynamicTargetsFromInput: false,
          multiEnvironment: true,
          advanceMode: node.advanceMode || 'all',
        };
      }

      const firstProfile = authProfiles[0] || node.inputSettings?.authProfile || null;
      const matchingOption = firstProfile
        ? [
            ...profileOptions.aws,
            ...profileOptions.azureTenants,
            ...profileOptions.googleWorkspace,
          ].find((option) => authProfilesMatch(option.authProfile, firstProfile))
        : null;

      return {
        ...node,
        dynamicTargetsFromInput: false,
        multiEnvironment: false,
        permissionProfile: matchingOption?.value || node.permissionProfile || '',
        inputSettings: {
          ...(node.inputSettings || {}),
          cloudProvider: provider,
          authProfile: firstProfile,
          authProfiles: firstProfile ? [firstProfile] : [],
          permissionProfileId: firstProfile?.permissionProfileId || '',
          targetEnvironment: buildTargetEnvironment(
            firstProfile,
            node.inputSettings?.targetEnvironment,
            provider
          ),
          ...(provider === 'aws' && matchingOption?.defaultRegions?.length
            ? { regions: matchingOption.defaultRegions }
            : {}),
        },
      };
    });
  };

  const handleRun = useCallback(
    async (saveFirst = false) => {
      setAttemptedSubmit(true);
      if (missingCount > 0) return;
      const firstCredentialIssue = Object.values(credentialIssuesByNode)
        .flat()
        .find(Boolean);
      if (firstCredentialIssue) {
        toast.error(firstCredentialIssue.message);
        return;
      }

      const definition = buildRunDefinition(workflow, draftNodes, source, runTitle);
      const workflowRunPreferences = {
        cloudTaskRunner,
      };
      if (saveFirst) {
        await onSaveAndRun?.(definition, workflowRunPreferences);
      } else {
        await onRun?.(definition, workflowRunPreferences);
      }
    },
    [
      credentialIssuesByNode,
      missingCount,
      workflow,
      draftNodes,
      source,
      runTitle,
      cloudTaskRunner,
      onRun,
      onSaveAndRun,
    ]
  );

  const expandAllNodes = useCallback(() => {
    setExpandedNodes(new Set(runnableNodes.map((node) => node.id)));
  }, [runnableNodes]);

  const collapseAllNodes = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Enter') return;
      if (!(event.metaKey || event.ctrlKey)) return;
      const target = event.target;
      if (target && target.tagName === 'TEXTAREA') return;
      event.preventDefault();
      handleRun(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleRun]);

  const renderTaskSettings = (node) => {
    const provider = getTaskProvider(node);
    const options =
      provider === 'azure'
        ? profileOptions.azureTenants
        : provider === 'google_workspace'
        ? profileOptions.googleWorkspace
        : profileOptions.aws;
    const selectedOption = findOptionByValueOrAuth(
      options,
      node.permissionProfile,
      (option) =>
        valuesEqual(
          option.authProfile?.permissionProfileId,
          node.inputSettings?.permissionProfileId
        ) ||
        authProfilesMatch(option.authProfile, node.inputSettings?.targetEnvironment) ||
        valuesEqual(
          option.authProfile?.tenantId,
          node.inputSettings?.authProfile?.tenantId
        ) ||
        valuesEqual(
          option.authProfile?.domain,
          node.inputSettings?.authProfile?.domain
        )
    );
    const selectedRegions = ensureArray(node.inputSettings?.regions);
    const tenantId =
      node.inputSettings?.azureTenantProfile?.tenantId ||
      node.inputSettings?.authProfile?.tenantId ||
      selectedOption?.authProfile?.tenantId ||
      '';
    const azureSubscriptions = profileOptions.azureSubscriptions.filter(
      (option) => !tenantId || option.authProfile?.tenantId === tenantId
    );
    const selectedAzureSubscriptions = Array.isArray(
      node.inputSettings?.azureSubscriptionProfiles
    )
      ? node.inputSettings.azureSubscriptionProfiles.filter(Boolean)
      : [];
    const selectedAuthProfiles = Array.isArray(node.inputSettings?.authProfiles)
      ? node.inputSettings.authProfiles.filter(Boolean)
      : [];
    const targetMode = node.dynamicTargetsFromInput
      ? 'dynamic'
      : node.multiEnvironment
      ? 'multiple'
      : 'single';
    const hasEnvironmentError =
      attemptedSubmit &&
      missingByNode[node.id]?.some((m) =>
        ['permissionProfile', 'azureTenant'].includes(m.key)
      );
    const hasRegionError =
      attemptedSubmit && missingByNode[node.id]?.some((m) => m.key === 'regions');

    const environmentLabel =
      provider === 'azure'
        ? 'Azure tenant'
        : provider === 'google_workspace'
          ? 'Google Workspace'
          : 'Cloud environment';
    const hasAzureSubError =
      attemptedSubmit &&
      missingByNode[node.id]?.some((m) => m.key === 'azureSubscriptions');
    const credentialIssues = credentialIssuesByNode[node.id] || [];

    const renderEnvironmentField = () =>
      targetMode === 'multiple' && provider !== 'azure' ? (
        <MultiEnvironmentPicker
          options={options}
          selectedProfiles={selectedAuthProfiles}
          provider={provider}
          hasError={hasEnvironmentError}
          onChange={(nextProfiles) => {
            const firstProfile = nextProfiles[0] || null;
            const firstOption = firstProfile
              ? options.find((option) =>
                  authProfilesMatch(option.authProfile, firstProfile)
                )
              : null;
            const defaultRegions =
              provider === 'aws'
                ? getDefaultRegionsForProfiles(nextProfiles, options)
                : [];
            updateNode(node.id, (current) => ({
              ...current,
              permissionProfile: firstOption?.value || '',
              inputSettings: {
                ...(current.inputSettings || {}),
                cloudProvider: provider,
                authProfiles: nextProfiles,
                authProfile: firstProfile,
                permissionProfileId: firstProfile?.permissionProfileId || '',
                targetEnvironment: buildTargetEnvironment(
                  firstProfile,
                  current.inputSettings?.targetEnvironment,
                  provider
                ),
                targetEnvironments: nextProfiles
                  .map((profile) =>
                    buildTargetEnvironment(profile, null, provider)
                  )
                  .filter(Boolean),
                ...(defaultRegions.length > 0
                  ? { regions: defaultRegions }
                  : {}),
              },
            }));
          }}
        />
      ) : (
        <EnvironmentCombobox
          options={options}
          selectedOption={selectedOption}
          placeholder={`Select ${getProviderLabel(provider)} environment`}
          searchPlaceholder={`Search ${getProviderLabel(provider)} environments...`}
          emptyText="No environments found."
          hasError={hasEnvironmentError}
          onSelect={(option) => {
            updateNode(node.id, (current) =>
              applyProfileSelection(current, option, provider, profileOptions)
            );
          }}
        />
      );

    return (
      <div className="mt-2 space-y-4">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-gray-800">
            Where should this run?
          </h4>
          <div
            role="radiogroup"
            aria-label="Target mode"
            className="flex flex-wrap items-center gap-x-6 gap-y-2"
          >
            {TARGET_MODES.map(({ value, label }) => {
              const selected = targetMode === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => updateTargetMode(node.id, value)}
                  className="group inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                      selected
                        ? 'border-primary-600'
                        : 'border-gray-300 group-hover:border-gray-400'
                    )}
                  >
                    {selected && (
                      <span className="h-2 w-2 rounded-full bg-primary-600" />
                    )}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {targetMode === 'dynamic' ? (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Targets resolved from previous node output
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                {environmentLabel}
              </label>
              {renderEnvironmentField()}
              {credentialIssues.length > 0 ? (
                <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{credentialIssues[0].message}</span>
                </div>
              ) : null}
            </div>

            {provider === 'aws' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Regions
                </label>
                <button
                  type="button"
                  onClick={() => setRegionPickerNodeId(node.id)}
                  className={cn(
                    'flex h-9 w-full items-center justify-between rounded-md border bg-white px-3 text-left text-sm hover:bg-gray-50',
                    hasRegionError ? 'border-red-400' : 'border-gray-200'
                  )}
                >
                  <span className="truncate">
                    {formatRegionSummary(selectedRegions)}
                  </span>
                  <span className="ml-3 shrink-0 text-xs text-blue-600">
                    Edit
                  </span>
                </button>
              </div>
            )}

            {provider === 'azure' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Subscriptions
                </label>
                <div
                  className={cn(
                    'max-h-32 space-y-2 overflow-auto rounded-md border bg-white p-3',
                    hasAzureSubError ? 'border-red-400' : 'border-gray-200'
                  )}
                >
                  {azureSubscriptions.length > 0 ? (
                    azureSubscriptions.map((option) => {
                      const checked = selectedAzureSubscriptions.some(
                        (profile) =>
                          authProfilesMatch(profile, option.authProfile)
                      );
                      return (
                        <label
                          key={option.value}
                          className="flex items-start gap-2 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => {
                              const nextSubscriptions = value
                                ? [
                                    ...selectedAzureSubscriptions,
                                    option.authProfile,
                                  ]
                                : selectedAzureSubscriptions.filter(
                                    (profile) =>
                                      !authProfilesMatch(
                                        profile,
                                        option.authProfile
                                      )
                                  );
                              updateInputSettings(node.id, {
                                authProfiles: nextSubscriptions,
                                azureSubscriptionProfiles: nextSubscriptions,
                                targetEnvironments: nextSubscriptions
                                  .map((profile) =>
                                    buildTargetEnvironment(
                                      profile,
                                      null,
                                      provider
                                    )
                                  )
                                  .filter(Boolean),
                              });
                            }}
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-sm text-gray-500">
                      Select an Azure tenant with subscriptions.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {targetMode !== 'single' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Advance mode
            </label>
            <Select
              value={node.advanceMode || EMPTY_VALUE}
              onValueChange={(value) =>
                updateNode(node.id, { advanceMode: value })
              }
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select advance mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wait for all environments</SelectItem>
                <SelectItem value="each">Advance per environment</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  };

  const renderCommunicationSettings = (node) => (
    <div className="mt-2">
      <h4 className="mb-2 text-sm font-semibold text-gray-800">
        Who should be notified?
      </h4>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        Email recipients
      </label>
      <Input
        value={Array.isArray(node.recipients) ? node.recipients.join(', ') : node.recipients || ''}
        onChange={(event) =>
          updateNode(node.id, {
            recipients: event.target.value,
            communicationType: node.communicationType || 'email',
          })
        }
        placeholder="team@example.com, ops@example.com"
        className={cn(
          'bg-white',
          attemptedSubmit && missingByNode[node.id]?.some((m) => m.key === 'recipients') && 'border-red-400'
        )}
      />
    </div>
  );

  if (!workflow) return null;

  const completeCount = runnableNodes.filter(
    (node) => (missingByNode[node.id] || []).length === 0
  ).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="flex h-[80vh] max-h-[80vh] max-w-4xl flex-col overflow-visible p-0">
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <DialogTitle className="sr-only">Run workflow: {getWorkflowTitle(workflow)}</DialogTitle>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Input
                value={runTitle}
                onChange={(event) => setRunTitle(event.target.value)}
                placeholder={getWorkflowTitle(workflow)}
                className="h-8 w-[75%] border-transparent bg-transparent px-0 text-base font-semibold text-gray-900 placeholder:text-gray-400 hover:border-gray-300 focus:border-gray-300 focus:bg-white focus:px-2"
              />
              {getWorkflowDescription(workflow) && (
                <p
                  className="mt-1 text-xs text-gray-500 line-clamp-1"
                  title={getWorkflowDescription(workflow)}
                >
                  {getWorkflowDescription(workflow)}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close (Esc)"
              className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          <div className="flex w-52 shrink-0 flex-col border-r bg-slate-50">
            <div className="flex items-center justify-between border-b bg-white px-3 py-2">
              <span className="text-xs font-medium uppercase text-gray-500">Preview</span>
              {onReview && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onReview}
                  disabled={isSubmitting}
                  className="h-6 px-2 text-xs text-gray-600 hover:text-gray-900"
                >
                  <Edit className="mr-1 h-3 w-3" />
                  Edit
                </Button>
              )}
            </div>

            <div className="flex-1 p-2">
              <div className="h-full overflow-hidden rounded-md border border-gray-200 bg-white">
                <CompactFlowPreview workflow={workflow} />
              </div>
            </div>

            <div className="border-t bg-white px-3 py-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{runnableNodes.length} nodes</span>
                <span>{completeCount} ready</span>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b bg-gray-50 px-4 py-2">
              <span className="text-xs font-medium uppercase text-gray-500">
                Configure nodes
              </span>
              {runnableNodes.length > 1 && (
                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={expandAllNodes}
                    className="rounded px-2 py-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                  >
                    Expand all
                  </button>
                  <span className="text-gray-300">·</span>
                  <button
                    type="button"
                    onClick={collapseAllNodes}
                    className="rounded px-2 py-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                  >
                    Collapse all
                  </button>
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="divide-y">
                {runnableNodes.map((node, index) => {
                  const missing = missingByNode[node.id] || [];
                  const credentialIssues = credentialIssuesByNode[node.id] || [];
                  const hasReadinessIssue = missing.length > 0 || credentialIssues.length > 0;
                  const provider = isRunnableTaskNode(node) ? getTaskProvider(node) : null;
                  const isExpanded = expandedNodes.has(node.id);
                  const summary =
                    !hasReadinessIssue ? getNodeSelectionSummary(node) : null;

                  return (
                    <div key={node.id} className="bg-white">
                      <button
                        type="button"
                        onClick={() => toggleNodeExpanded(node.id)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50',
                          hasReadinessIssue && 'bg-amber-50/50'
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-medium',
                            hasReadinessIssue
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700'
                          )}
                        >
                          {hasReadinessIssue ? (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-gray-900">
                              {index + 1}. {node.name || node.id}
                            </span>
                            {provider && (
                              <Badge variant="outline" className="shrink-0 text-xs px-1.5 py-0">
                                {getProviderLabel(provider)}
                              </Badge>
                            )}
                          </div>
                          {missing.length > 0 ? (
                            <p className="truncate text-xs text-amber-700">
                              Missing: {missing.map((m) => m.label).join(', ')}
                            </p>
                          ) : credentialIssues.length > 0 ? (
                            <p className="truncate text-xs text-amber-700">
                              Credentials need attention
                            </p>
                          ) : summary ? (
                            <p className="truncate text-xs text-gray-500">
                              {summary}
                            </p>
                          ) : null}
                        </div>

                        <ChevronRight
                          className={cn(
                            'h-4 w-4 shrink-0 text-gray-400 transition-transform',
                            isExpanded && 'rotate-90'
                          )}
                        />
                      </button>

                      {isExpanded && (
                        <div className="border-t bg-gray-50/50 px-4 pb-4 pt-3">
                          {isRunnableTaskNode(node) && renderTaskSettings(node)}
                          {isCommunicationNode(node) && renderCommunicationSettings(node)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {regionPickerNode && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4">
            <div className="max-h-[70vh] w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-xl">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Select AWS regions
                  </h3>
                  <p className="text-xs text-gray-500">
                    {regionPickerNode.name || regionPickerNode.id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRegionPickerNodeId(null)}
                  className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[50vh] overflow-y-auto p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-gray-600">
                    {regionPickerRegions.length} selected
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      updateInputSettings(regionPickerNode.id, {
                        regions:
                          regionPickerRegions.length === getRegionOptions().length
                            ? []
                            : getRegionOptions().map((region) => region.value),
                      })
                    }
                  >
                    {regionPickerRegions.length === getRegionOptions().length
                      ? 'Clear all'
                      : 'Select all'}
                  </Button>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {getRegionOptions().map((region) => {
                    const checked = regionPickerRegions.includes(region.value);
                    return (
                      <label
                        key={region.value}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded border px-2.5 py-1.5 text-xs',
                          checked
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => {
                            const nextRegions = value
                              ? [...regionPickerRegions, region.value]
                              : regionPickerRegions.filter(
                                  (item) => item !== region.value
                                );
                            updateInputSettings(regionPickerNode.id, {
                              regions: nextRegions,
                            });
                          }}
                          className="h-3.5 w-3.5"
                        />
                        <span>{region.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end border-t px-4 py-3">
                <Button size="sm" onClick={() => setRegionPickerNodeId(null)}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0 border-t bg-white px-4 py-3">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {missingCount > 0 ? (
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs px-2 py-0.5">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {missingCount} missing field{missingCount === 1 ? '' : 's'}
                </Badge>
              ) : credentialIssueCount > 0 ? (
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs px-2 py-0.5">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {credentialIssueCount} credential issue{credentialIssueCount === 1 ? '' : 's'}
                </Badge>
              ) : (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs px-2 py-0.5">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Ready to run
                </Badge>
              )}
            </div>
            {isLocalRuntime() && hasCloudTaskNodes && (
              <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
                {CLOUD_TASK_RUNNER_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setCloudTaskRunner(option.value)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                        cloudTaskRunner === option.value
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-gray-600 hover:bg-white/70'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2">
              {canSaveAndRun && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRun(true)}
                  disabled={isSubmitting || credentialIssueCount > 0}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Save & run
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => handleRun(false)}
                disabled={isSubmitting || credentialIssueCount > 0}
                title={`Run (${IS_MAC ? '\u2318' : 'Ctrl'}\u23ce)`}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                )}
                Run
                <kbd className="ml-2 hidden items-center rounded border border-white/30 bg-white/15 px-1.5 py-0 text-[10px] font-medium leading-none text-white/90 sm:inline-flex">
                  {`${IS_MAC ? '\u2318' : 'Ctrl'}\u23ce`}
                </kbd>
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
