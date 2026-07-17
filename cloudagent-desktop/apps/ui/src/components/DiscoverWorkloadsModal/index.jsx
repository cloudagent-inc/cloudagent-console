import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Send, Loader2, Trash2, Edit2, Database, Layers, MessageSquare, Plus, Minimize2, Maximize2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Icons } from '@/components/icons';
import Markdown from 'markdown-to-jsx';
import { sendWorkloadDiscoveryChat } from '@/api/workloadDiscoveryApi';

const chatMarkdownOptions = {
  overrides: {
    h1: { props: { className: 'text-base font-semibold mb-2 mt-3 first:mt-0 text-gray-800' } },
    h2: { props: { className: 'text-sm font-semibold mb-1.5 mt-2.5 first:mt-0 text-gray-800' } },
    h3: { props: { className: 'text-sm font-semibold mb-1 mt-2 first:mt-0 text-gray-800' } },
    p: { props: { className: 'mb-2 last:mb-0 leading-relaxed' } },
    ul: { props: { className: 'list-disc pl-5 mb-2 space-y-1' } },
    ol: { props: { className: 'list-decimal pl-5 mb-2 space-y-1' } },
    li: { props: { className: 'leading-relaxed' } },
    strong: { props: { className: 'font-semibold text-gray-900' } },
    em: { props: { className: 'italic' } },
    a: { props: { className: 'text-blue-600 hover:text-blue-700 underline', target: '_blank', rel: 'noreferrer' } },
    blockquote: { props: { className: 'border-l-2 border-gray-300 pl-3 italic text-gray-600 my-2' } },
    code: { props: { className: 'rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-800' } },
    pre: { props: { className: 'overflow-x-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100 my-2' } },
    hr: { props: { className: 'my-3 border-gray-200' } },
  },
};
import toast from 'react-hot-toast';
import { Textarea } from '@/components/ui/textarea';
import { getRegionOptions, filterCloudEnvironments } from '@/helpers/shared';
import WorkloadCreateWizard from '@/components/WorkloadCreateWizard';
import { analytics, ANALYTICS_EVENTS, getAnalyticsRoute } from '@/hooks/useAnalytics';
import { createWorkloadDefinition } from '@/features/workload/workloadSlice';
import {
  startBackgroundDiscovery,
  syncBackgroundDiscoverySnapshot,
} from '@/features/workload/workloadDiscoverySlice';
import {
  buildDiscoveredWorkloadCreatePayload,
  runPostCreateWorkloadSync,
} from '@/features/workload/workloadCreationUtils';
import { getCloudAgentCreationLimits } from '@/lib/subscription';

const SERVICE_OPTIONS = [
  { value: 's3', label: 'S3' },
  { value: 'dynamodb', label: 'DynamoDB' },
  { value: 'lambda', label: 'Lambda' },
  { value: 'iam', label: 'IAM' },
  { value: 'ec2', label: 'EC2' },
  { value: 'elbv2', label: 'Elastic Load Balancing V2' },
  { value: 'ecs', label: 'ECS' },
  { value: 'logs', label: 'Logs' },
  { value: 'autoscaling', label: 'Auto Scaling' },
  { value: 'ecr', label: 'ECR' },
  { value: 'eks', label: 'EKS' },
  { value: 'rds', label: 'RDS' },
  { value: 'elasticache', label: 'ElastiCache' },
  { value: 'opensearch', label: 'OpenSearch Service' },
  { value: 'efs', label: 'EFS' },
  { value: 'sqs', label: 'SQS' },
  { value: 'sns', label: 'SNS' },
  { value: 'apigateway', label: 'API Gateway' },
  { value: 'apigatewayv2', label: 'API Gateway V2' },
  { value: 'cloudfront', label: 'CloudFront' },
  { value: 'sfn', label: 'Step Functions' },
];

const EMPTY_SELECTION = [];
const DEFAULT_REGIONS = ['us-east-1'];
const ALL_SERVICE_VALUES = SERVICE_OPTIONS.map((service) => service.value);
const REGION_OPTIONS = getRegionOptions();

const DiscoverWorkloadsModal = ({
  isOpen,
  onClose,
  permissionProfileId: initialPermissionProfileId,
  services: initialServices = EMPTY_SELECTION,
  regions: initialRegions = EMPTY_SELECTION,
  userProfile,
}) => {
  const dispatch = useDispatch();
  const activeDiscoveryRun = useSelector((state) => state.workloadDiscovery.activeRun);
  // Filter to only include cloud environments (AWS account, Google Workspace), exclude integrations like Jira
  const permissionProfiles = useMemo(
    () => filterCloudEnvironments(userProfile?.agentPermissionProfiles || EMPTY_SELECTION),
    [userProfile?.agentPermissionProfiles]
  );
  function parseAuthProfile(profile) {
    if (!profile) return {};
    try {
      return typeof profile.authProfile === 'string'
        ? JSON.parse(profile.authProfile)
        : profile.authProfile || {};
    } catch (_) {
      return {};
    }
  }

  const environmentOptions = useMemo(() => {
    const options = [];
    permissionProfiles.forEach((profile) => {
      const authProfile = parseAuthProfile(profile);
      const permissionProfileId = profile.id || profile.recordId;
      const profileType = String(profile?.type || authProfile?.provider || '').trim().toLowerCase();
      const normalizedProfileType = profileType.replace(/_/g, ' ');
      if (normalizedProfileType === 'azure tenant') {
        return;
      }
      if (normalizedProfileType === 'azure subscription' || authProfile?.provider === 'azure') {
        const subscriptionId = authProfile.subscriptionId || '';
        options.push({
          selectionId: permissionProfileId,
          permissionProfileId,
          subscriptionId,
          cloudProvider: 'azure',
          name: profile.name || authProfile.subscriptionName || permissionProfileId || 'Azure Subscription',
          accountId: subscriptionId,
          profile,
          authProfile,
        });
        return;
      }
      options.push({
        selectionId: permissionProfileId,
        permissionProfileId,
        subscriptionId: '',
        cloudProvider: 'aws',
        name: profile.name || permissionProfileId || 'Environment',
        accountId: authProfile.awsAccountId || '',
        profile,
        authProfile,
      });
    });
    return options;
  }, [permissionProfiles]);
  const firstProfileId = environmentOptions.length > 0
    ? environmentOptions[0].selectionId
    : '';

  // Get default regions from selected permission profile
  const getDefaultRegions = (profileId) => {
    if (!profileId) return DEFAULT_REGIONS;
    const option = environmentOptions.find((entry) => entry.selectionId === profileId);
    const profile = option?.profile || permissionProfiles.find((p) => (p.id || p.recordId) === profileId);
    if (!profile) return DEFAULT_REGIONS;
    
    try {
      const deploymentPreferences = typeof profile.deploymentPreferences === 'string'
        ? JSON.parse(profile.deploymentPreferences)
        : profile.deploymentPreferences || {};
      
      const defaultRegions = deploymentPreferences.defaultRegions;
      if (Array.isArray(defaultRegions) && defaultRegions.length > 0) {
        return defaultRegions.filter(Boolean);
      }
    } catch (e) {
      console.warn('Failed to parse deploymentPreferences', e);
    }
    return DEFAULT_REGIONS;
  };

  const getPermissionProfileMeta = (profileId) => {
    const option = environmentOptions.find((entry) => entry.selectionId === profileId);
    if (option) {
      return {
        profileId: option.selectionId,
        permissionProfileId: option.permissionProfileId,
        subscriptionId: option.subscriptionId || '',
        name: option.name,
        accountId: option.accountId || '',
        cloudProvider: option.cloudProvider,
        defaultRegions: getDefaultRegions(profileId),
      };
    }
    const profile = permissionProfiles.find((p) => (p.id || p.recordId) === profileId);
    const authProfile = parseAuthProfile(profile);
    return {
      profileId,
      permissionProfileId: profileId,
      subscriptionId: '',
      name: profile?.name || profileId || 'Environment',
      accountId: authProfile.tenantId || authProfile.awsAccountId || '',
      cloudProvider: 'aws',
      defaultRegions: getDefaultRegions(profileId),
    };
  };

  const getRegionsForSelectedEnvironments = (profileIds = []) => {
    const unique = new Set();
    profileIds.forEach((profileId) => {
      getDefaultRegions(profileId).forEach((region) => {
        if (region) unique.add(region);
      });
    });
    if (unique.size === 0) unique.add('us-east-1');
    return Array.from(unique);
  };

  const initialSelectedProfileIds = useMemo(() => {
    if (initialPermissionProfileId) {
      const direct = environmentOptions.find((entry) => entry.selectionId === initialPermissionProfileId);
      if (direct) return [direct.selectionId];
      const firstMatchingProfile = environmentOptions.find(
        (entry) => entry.permissionProfileId === initialPermissionProfileId
      );
      return [firstMatchingProfile?.selectionId || initialPermissionProfileId];
    }
    if (firstProfileId) return [firstProfileId];
    return EMPTY_SELECTION;
  }, [initialPermissionProfileId, firstProfileId, environmentOptions]);

  const initialSelectedServices = useMemo(
    () => (initialServices.length > 0 ? initialServices : ALL_SERVICE_VALUES),
    [initialServices]
  );

  const initialSelectedRegions = useMemo(() => {
    if (initialRegions.length > 0) return initialRegions;
    return getRegionsForSelectedEnvironments(initialSelectedProfileIds);
  }, [initialRegions, initialSelectedProfileIds, permissionProfiles]);

  const [selectedPermissionProfileIds, setSelectedPermissionProfileIds] = useState(initialSelectedProfileIds);
  const [serviceMode, setServiceMode] = useState('all'); // 'all' or 'custom'
  const [selectedServices, setSelectedServices] = useState(initialSelectedServices);
  const [selectedRegions, setSelectedRegions] = useState(initialSelectedRegions);
  const [forceInventoryScan, setForceInventoryScan] = useState(false);
  const [environmentNotes, setEnvironmentNotes] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [isRegionsModalOpen, setIsRegionsModalOpen] = useState(false);
  const [sessionIdsByEnvironment, setSessionIdsByEnvironment] = useState({});
  const [environmentRuns, setEnvironmentRuns] = useState({});
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [workloads, setWorkloads] = useState([]);
  const [editedWorkloads, setEditedWorkloads] = useState([]);
  const [scanData, setScanData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [workloadWizardOpen, setWorkloadWizardOpen] = useState(false);
  const [wizardPrefill, setWizardPrefill] = useState(null);
  const [wizardWorkloadIndex, setWizardWorkloadIndex] = useState(null);
  const [editingWorkload, setEditingWorkload] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [selectedWorkloadIndex, setSelectedWorkloadIndex] = useState(null);
  const [isRawScanModalOpen, setIsRawScanModalOpen] = useState(false);
  const [selectedResources, setSelectedResources] = useState(new Set()); // Set of resource IDs
  const [resourceFilter, setResourceFilter] = useState('');
  const [environmentFilter, setEnvironmentFilter] = useState('');
  const [reviewResourceFilter, setReviewResourceFilter] = useState('');
  const [createdInSessionCount, setCreatedInSessionCount] = useState(0);
  const [showAddToWorkloadDropdown, setShowAddToWorkloadDropdown] = useState(false);
  const [maximizedSection, setMaximizedSection] = useState(null); // 'chat' | 'workloads' | null
  const [isStacksModalOpen, setIsStacksModalOpen] = useState(false);
  const [showAvailableResources, setShowAvailableResources] = useState(true);
  const [stackFilter, setStackFilter] = useState('');
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const [tagViewer, setTagViewer] = useState({ open: false, title: '', tags: {} });
  const primaryPermissionProfileId = selectedPermissionProfileIds[0] || '';
  const hasAnySession = Object.values(sessionIdsByEnvironment || {}).some(Boolean);
  const creationLimits = useMemo(
    () => getCloudAgentCreationLimits(userProfile),
    [userProfile]
  );
  const remainingWorkloadSlots = creationLimits.shouldRestrict
    ? Math.max(0, creationLimits.remainingWorkloadSlots - createdInSessionCount)
    : Infinity;
  const canCreateWorkloadFromDiscovery = remainingWorkloadSlots > 0;
  const canCreateDraftWorkload =
    !creationLimits.shouldRestrict || editedWorkloads.length < remainingWorkloadSlots;
  const filteredEnvironmentOptions = useMemo(() => {
    const filter = environmentFilter.trim().toLowerCase();
    if (!filter) return environmentOptions;

    return environmentOptions.filter((environmentOption) => {
      const { name, profile, authProfile, accountId, subscriptionId, selectionId } = environmentOption;
      const searchableValues = [
        name,
        profile?.name,
        authProfile?.displayName,
        authProfile?.adminEmail,
        authProfile?.projectId,
        accountId,
        subscriptionId,
        selectionId,
      ];
      return searchableValues
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(filter));
    });
  }, [environmentFilter, environmentOptions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowAddToWorkloadDropdown(false);
      }
    };
    if (showAddToWorkloadDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAddToWorkloadDropdown]);

  const getWorkloadEnvironmentProfileId = (workload) => {
    if (!workload || typeof workload !== 'object') return '';
    const metadata =
      workload.metadata && typeof workload.metadata === 'object' ? workload.metadata : {};
    return (metadata.environmentProfileId || '').trim();
  };

  const getDiscoveredWorkloadName = (workload, fallback = '') => (
    workload?.name ||
    workload?.workloadName ||
    fallback
  );

  const buildEnvironmentProgressText = (runsMap = {}) => {
    const runs = Object.values(runsMap || {});
    if (!runs.length) return '';
    const completed = runs.filter((run) => run.status === 'completed').length;
    const failed = runs.filter((run) => run.status === 'error').length;
    const inProgress = runs.filter((run) =>
      ['queued', 'scanning', 'analyzing', 'processing'].includes(run.status)
    ).length;

    if (inProgress > 0) {
      return `Discovery in progress: ${completed}/${runs.length} done`;
    }
    if (failed > 0) {
      return `Discovery finished with errors: ${completed} done, ${failed} failed`;
    }
    return `Discovery completed: ${completed}/${runs.length} environments`;
  };

  const upsertEnvironmentRun = (profileId, patch = {}) => {
    setEnvironmentRuns((prev) => ({
      ...prev,
      [profileId]: {
        ...(prev[profileId] || {}),
        ...patch,
      },
    }));
  };

  const mergeAggregateScanData = (previous, scanResults, environmentMeta) => {
    const safeScanResults = scanResults && typeof scanResults === 'object' ? scanResults : {};
    const next = {
      accountId: previous?.accountId || '',
      requestedServices: Array.isArray(previous?.requestedServices) ? [...previous.requestedServices] : [],
      services: previous?.services && typeof previous.services === 'object' ? { ...previous.services } : {},
      syncedAt: safeScanResults.syncedAt || previous?.syncedAt || null,
      inventory: previous?.inventory || null,
      cloudformation: {
        stacks: Array.isArray(previous?.cloudformation?.stacks) ? [...previous.cloudformation.stacks] : [],
        errors: Array.isArray(previous?.cloudformation?.errors) ? [...previous.cloudformation.errors] : [],
      },
      environments:
        previous?.environments && typeof previous.environments === 'object'
          ? { ...previous.environments }
          : {},
    };

    const requestedServices = Array.isArray(safeScanResults.requestedServices)
      ? safeScanResults.requestedServices
      : [];
    next.requestedServices = Array.from(
      new Set([...(next.requestedServices || []), ...requestedServices].filter(Boolean))
    );

    const sourceServices =
      safeScanResults.services && typeof safeScanResults.services === 'object'
        ? safeScanResults.services
        : {};

    Object.entries(sourceServices).forEach(([serviceKey, serviceData]) => {
      const existing = next.services[serviceKey] || {
        service: serviceData?.service || serviceKey,
        regions: [],
        resources: [],
        errors: [],
        lastSynced: null,
      };
      const existingRegions = Array.isArray(existing.regions) ? existing.regions : [];
      const incomingRegions = Array.isArray(serviceData?.regions) ? serviceData.regions : [];
      const incomingResources = Array.isArray(serviceData?.resources) ? serviceData.resources : [];
      const incomingErrors = Array.isArray(serviceData?.errors) ? serviceData.errors : [];

      next.services[serviceKey] = {
        ...existing,
        service: serviceData?.service || existing.service || serviceKey,
        regions: Array.from(new Set([...existingRegions, ...incomingRegions].filter(Boolean))),
        resources: [
          ...(Array.isArray(existing.resources) ? existing.resources : []),
          ...incomingResources.map((resource) => ({
            ...resource,
            environmentProfileId: environmentMeta.profileId,
            environmentName: environmentMeta.name,
            environmentAccountId: environmentMeta.accountId,
          })),
        ],
        errors: [
          ...(Array.isArray(existing.errors) ? existing.errors : []),
          ...incomingErrors.map((error) => ({
            ...error,
            environmentProfileId: environmentMeta.profileId,
            environmentName: environmentMeta.name,
          })),
        ],
        lastSynced: serviceData?.lastSynced || existing.lastSynced || safeScanResults.syncedAt || null,
      };
    });

    const incomingStacks = Array.isArray(safeScanResults?.cloudformation?.stacks)
      ? safeScanResults.cloudformation.stacks
      : [];
    const incomingStackErrors = Array.isArray(safeScanResults?.cloudformation?.errors)
      ? safeScanResults.cloudformation.errors
      : [];
    next.cloudformation.stacks = [
      ...next.cloudformation.stacks,
      ...incomingStacks.map((stack) => ({
        ...stack,
        environmentProfileId: environmentMeta.profileId,
        environmentName: environmentMeta.name,
        environmentAccountId: environmentMeta.accountId,
      })),
    ];
    next.cloudformation.errors = [
      ...next.cloudformation.errors,
      ...incomingStackErrors.map((error) => ({
        ...error,
        environmentProfileId: environmentMeta.profileId,
        environmentName: environmentMeta.name,
      })),
    ];

    next.environments[environmentMeta.profileId] = {
      profileId: environmentMeta.profileId,
      name: environmentMeta.name,
      accountId: environmentMeta.accountId,
      regions: environmentMeta.defaultRegions,
      syncedAt: safeScanResults.syncedAt || null,
    };

    const accountIds = Object.values(next.environments)
      .map((entry) => entry?.accountId)
      .filter(Boolean);
    if (accountIds.length === 1) {
      next.accountId = accountIds[0];
    } else if (accountIds.length > 1) {
      next.accountId = 'multiple';
    }

    return next;
  };

  const replaceEnvironmentWorkloads = (profileId, nextWorkloads) => {
    setWorkloads((previous) => [
      ...previous.filter((workload) => getWorkloadEnvironmentProfileId(workload) !== profileId),
      ...nextWorkloads,
    ]);
    setEditedWorkloads((previous) => [
      ...previous.filter((workload) => getWorkloadEnvironmentProfileId(workload) !== profileId),
      ...nextWorkloads,
    ]);
  };

  const annotateWorkloadsForEnvironment = (rawWorkloads, environmentMeta) => {
    if (!Array.isArray(rawWorkloads)) return [];
    return rawWorkloads.map((workload) => {
      const metadata =
        workload?.metadata && typeof workload.metadata === 'object' ? workload.metadata : {};
      return {
        ...workload,
        trackedResources: normalizeTrackedResources(workload?.trackedResources),
        metadata: {
          ...metadata,
          environmentProfileId: environmentMeta.profileId,
          environmentName: environmentMeta.name,
          environmentAccountId: environmentMeta.accountId,
          cloudProvider: environmentMeta.cloudProvider || 'aws',
          permissionProfileId: environmentMeta.permissionProfileId || environmentMeta.profileId,
          subscriptionId: environmentMeta.subscriptionId || undefined,
        },
      };
    });
  };

  const addAssistantMessage = (content, environmentMeta) => {
    if (!content) return;
    setMessages((previous) => [
      ...previous,
      {
        id: Date.now() + Math.random(),
        role: 'assistant',
        content,
        environmentProfileId: environmentMeta?.profileId || null,
        environmentName: environmentMeta?.name || null,
        timestamp: new Date(),
      },
    ]);
  };

  const summarizeWorkloadsForDebug = (rawWorkloads) => {
    if (!Array.isArray(rawWorkloads)) return [];
    return rawWorkloads.map((workload) => ({
      name: workload?.name || '',
      resourceCount: Array.isArray(workload?.trackedResources?.resources)
        ? workload.trackedResources.resources.length
        : 0,
      stackCount: Array.isArray(workload?.trackedResources?.stacks)
        ? workload.trackedResources.stacks.length
        : 0,
      environmentProfileId: getWorkloadEnvironmentProfileId(workload) || '',
    }));
  };

  // Initialize defaults when modal opens (only if no profile selected)
  useEffect(() => {
    if (isOpen && !isConfigured && environmentOptions.length > 0 && selectedPermissionProfileIds.length === 0) {
      const firstProfileId = environmentOptions[0].selectionId;
      setSelectedPermissionProfileIds([firstProfileId]);
      setSelectedRegions(getRegionsForSelectedEnvironments([firstProfileId]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, environmentOptions]);

  // Update regions when selected environments change
  useEffect(() => {
    if (selectedPermissionProfileIds.length > 0 && isOpen && !isConfigured) {
      setSelectedRegions(getRegionsForSelectedEnvironments(selectedPermissionProfileIds));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPermissionProfileIds, isOpen, isConfigured]);

  useEffect(() => {
    if (!isOpen || !activeDiscoveryRun) return;

    setSelectedPermissionProfileIds(activeDiscoveryRun.selectedPermissionProfileIds || EMPTY_SELECTION);
    setSelectedServices(activeDiscoveryRun.selectedServices || ALL_SERVICE_VALUES);
    setSelectedRegions(activeDiscoveryRun.selectedRegions || DEFAULT_REGIONS);
    setForceInventoryScan(Boolean(activeDiscoveryRun.forceInventoryScan));
    setEnvironmentNotes(activeDiscoveryRun.environmentNotes || '');
    setSessionIdsByEnvironment(activeDiscoveryRun.sessionIdsByEnvironment || {});
    setEnvironmentRuns(activeDiscoveryRun.environmentRuns || {});
    setMessages(activeDiscoveryRun.messages || []);
    setWorkloads(activeDiscoveryRun.workloads || []);
    setEditedWorkloads(activeDiscoveryRun.workloads || []);
    setScanData(activeDiscoveryRun.scanData || null);
    setIsConfigured(true);
    setIsLoading(
      activeDiscoveryRun.executionState === 'queued' ||
      activeDiscoveryRun.executionState === 'running'
    );
    setIsScanning(
      Object.values(activeDiscoveryRun.environmentRuns || {}).some((run) =>
        ['queued', 'scanning'].includes(run?.status)
      )
    );
    setIsAnalyzing(
      Object.values(activeDiscoveryRun.environmentRuns || {}).some((run) =>
        ['analyzing', 'processing'].includes(run?.status)
      )
    );
  }, [isOpen, activeDiscoveryRun]);

  useEffect(() => {
    // Reset state when modal closes
    if (!isOpen) {
      setSelectedPermissionProfileIds(initialSelectedProfileIds);
      setServiceMode('all');
      setSelectedServices(initialSelectedServices);
      setSelectedRegions(initialSelectedRegions);
      setForceInventoryScan(false);
      setIsConfigured(false);
      setSessionIdsByEnvironment({});
      setEnvironmentRuns({});
      setMessages([]);
      setInputMessage('');
      setWorkloads([]);
      setEditedWorkloads([]);
      setEnvironmentNotes('');
      setScanData(null);
      setIsLoading(false);
      setIsScanning(false);
      setScanProgress('');
      setIsAnalyzing(false);
      setWorkloadWizardOpen(false);
      setWizardPrefill(null);
      setWizardWorkloadIndex(null);
      setEditingWorkload(null);
      setEditingField(null);
      setSelectedWorkloadIndex(null);
      setEnvironmentFilter('');
      setCreatedInSessionCount(0);
    }
  }, [isOpen, initialSelectedProfileIds, initialSelectedServices, initialSelectedRegions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isConfigured) return;
    setScanProgress(buildEnvironmentProgressText(environmentRuns));
  }, [environmentRuns, isConfigured]);

  useEffect(() => {
    if (isConfigured && hasAnySession && chatInputRef.current) {
      const timer = setTimeout(() => {
        chatInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isConfigured, hasAnySession]);

  const togglePermissionProfile = (profileId) => {
    setSelectedPermissionProfileIds((previous) => {
      if (previous.includes(profileId)) {
        const next = previous.filter((id) => id !== profileId);
        return next;
      }
      return [...previous, profileId];
    });
  };

  const toggleRegion = (regionValue) => {
    setSelectedRegions((previous) =>
      previous.includes(regionValue)
        ? previous.filter((region) => region !== regionValue)
        : [...previous, regionValue]
    );
  };

  const resetRegionsToDefaults = () => {
    setSelectedRegions(getRegionsForSelectedEnvironments(selectedPermissionProfileIds));
  };

  const selectAllRegions = () => {
    setSelectedRegions(REGION_OPTIONS.map((region) => region.value));
  };

  const deselectAllRegions = () => {
    setSelectedRegions([]);
  };

  const handleStartDiscovery = () => {
    if (!selectedPermissionProfileIds.length || !selectedServices.length || !selectedRegions.length) {
      toast.error('At least one environment, services, and regions are required');
      return;
    }
    const environments = selectedPermissionProfileIds.map((profileId) => {
      const environmentMeta = getPermissionProfileMeta(profileId);
      return {
        ...environmentMeta,
        defaultRegions: environmentMeta.defaultRegions,
      };
    });
    const initialRuns = selectedPermissionProfileIds.reduce((acc, profileId) => {
      const environmentMeta = getPermissionProfileMeta(profileId);
      acc[profileId] = {
        ...environmentMeta,
        status: 'queued',
        progress: 'Queued',
      };
      return acc;
    }, {});

    dispatch(
      startBackgroundDiscovery({
        jobId: `workload-discovery-${Date.now()}`,
        startedAt: new Date().toISOString(),
        selectedPermissionProfileIds,
        selectedServices,
        selectedRegions,
        environmentNotes,
        forceInventoryScan,
        environments,
        environmentRuns: initialRuns,
      })
    );
    analytics.track(ANALYTICS_EVENTS.WORKLOAD_DISCOVERY_STARTED, {
      route: getAnalyticsRoute(),
    });
    toast.success('Workload discovery started in the background.');
    onClose();
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() && editedWorkloads.length === 0) return;
    const sessionEntries = Object.entries(sessionIdsByEnvironment || {}).filter(([, value]) => Boolean(value));
    if (sessionEntries.length === 0) {
      toast.error('Session not initialized');
      return;
    }

    const userMessage = inputMessage.trim();
    if (userMessage) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: 'user',
          content: userMessage,
          timestamp: new Date(),
        },
      ]);
      setInputMessage('');
    }

    setIsLoading(true);
    setIsAnalyzing(true);

    try {
      const followUpRuns = sessionEntries.map(async ([profileId, environmentSessionId]) => {
        const environmentMeta = getPermissionProfileMeta(profileId);
        const workloadsForEnvironment = editedWorkloads.filter(
          (workload) => getWorkloadEnvironmentProfileId(workload) === profileId
        );

        await sendWorkloadDiscoveryChat(
          {
            sessionId: environmentSessionId,
            message: userMessage || undefined,
            cloudProvider: environmentMeta.cloudProvider || 'aws',
            permissionProfileId: environmentMeta.permissionProfileId || profileId,
            subscriptionId: environmentMeta.subscriptionId || undefined,
            workloads: workloadsForEnvironment.length > 0 ? workloadsForEnvironment : undefined,
          },
          {
            onAgentStart: () => {
              upsertEnvironmentRun(profileId, {
                status: 'processing',
                progress: 'Processing follow-up',
              });
            },
            onToolCall: (data) => {
              const toolName = data.name || data.tool_name || 'tool';
              const formattedName = toolName
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (letter) => letter.toUpperCase());
              upsertEnvironmentRun(profileId, {
                status: 'processing',
                progress: `${formattedName}...`,
              });
            },
            onDiscoveryComplete: (data) => {
              if (Array.isArray(data?.workloads)) {
                const normalizedWorkloads = annotateWorkloadsForEnvironment(
                  data.workloads,
                  environmentMeta
                );
                console.info('[DiscoverWorkloadsModal] Applying structured workload discovery update', {
                  environmentProfileId: profileId,
                  workloads: summarizeWorkloadsForDebug(normalizedWorkloads),
                });
                replaceEnvironmentWorkloads(profileId, normalizedWorkloads);
              }
            },
            onFinal: (data) => {
              if (data?.text) {
                addAssistantMessage(data.text, environmentMeta);
              }
              if (!data?.structuredUpdateApplied) {
                console.warn(
                  '[DiscoverWorkloadsModal] Agent final response did not include a structured workload update. The workload cards will remain unchanged.',
                  {
                    environmentProfileId: profileId,
                    environmentName: environmentMeta?.name || '',
                    currentWorkloads: summarizeWorkloadsForDebug(workloadsForEnvironment),
                    finalTextPreview:
                      typeof data?.text === 'string' ? data.text.slice(0, 500) : '',
                  }
                );
              }
              if (Array.isArray(data?.discovery?.workloads)) {
                const normalizedWorkloads = annotateWorkloadsForEnvironment(
                  data.discovery.workloads,
                  environmentMeta
                );
                console.info('[DiscoverWorkloadsModal] Received final workload discovery payload', {
                  environmentProfileId: profileId,
                  workloads: summarizeWorkloadsForDebug(normalizedWorkloads),
                });
                replaceEnvironmentWorkloads(profileId, normalizedWorkloads);
              }
            },
            onDone: () => {
              upsertEnvironmentRun(profileId, {
                status: 'completed',
                progress: 'Completed',
              });
            },
            onError: (data) => {
              upsertEnvironmentRun(profileId, {
                status: 'error',
                progress: data?.error || 'Failed',
                error: data?.error || 'Failed',
              });
              toast.error(`${environmentMeta.name}: ${data?.error || 'An error occurred'}`);
            },
          }
        );
      });

      await Promise.allSettled(followUpRuns);
    } catch (error) {
      toast.error(error.message || 'Failed to send message');
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  };

  const getAccountIdFromProfileId = (profileId) => {
    const option = environmentOptions.find((entry) => entry.selectionId === profileId);
    if (option) return option.accountId || '';
    const selectedProfile = permissionProfiles.find(
      (p) => (p.id || p.recordId) === profileId
    );
    if (!selectedProfile) return '';
    try {
      const authProfile =
        typeof selectedProfile.authProfile === 'string'
          ? JSON.parse(selectedProfile.authProfile)
          : selectedProfile.authProfile || {};
      return authProfile.tenantId || authProfile.awsAccountId || '';
    } catch (_) {
      return '';
    }
  };

  const removeDiscoveredWorkloadAtIndex = (workloadIndex) => {
    setEditedWorkloads((previous) => previous.filter((_, idx) => idx !== workloadIndex));
    setSelectedWorkloadIndex((previous) => {
      if (previous === workloadIndex) return null;
      if (previous !== null && previous > workloadIndex) return previous - 1;
      return previous;
    });
  };

  const handleOpenWorkloadWizard = (workload, workloadIndex = null) => {
    if (!workload) {
      toast.error('No workload selected');
      return;
    }
    if (!canCreateWorkloadFromDiscovery) {
      toast.error(creationLimits.workloadLimitMessage);
      return;
    }
    const workloadProfileId = getWorkloadEnvironmentProfileId(workload) || primaryPermissionProfileId;
    setWizardPrefill({
      workloadName: getDiscoveredWorkloadName(workload),
      description: workload?.description || '',
      trackedResources: normalizeTrackedResources(workload?.trackedResources),
      environments: workloadProfileId ? [workloadProfileId] : [],
    });
    setWizardWorkloadIndex(workloadIndex);
    setWorkloadWizardOpen(true);
  };

  const handleOpenWorkloadResourcesReview = (workloadIndex) => {
    setReviewResourceFilter('');
    setSelectedWorkloadIndex(workloadIndex);
  };

  const handleQuickAddWorkloads = async (targetIndexes) => {
    const normalizedIndexes = Array.isArray(targetIndexes)
      ? Array.from(new Set(targetIndexes.filter((index) => Number.isInteger(index))))
      : [];
    if (normalizedIndexes.length === 0) {
      toast.error('No discovered workloads are ready to create.');
      return;
    }

    const workloadsToCreate = normalizedIndexes
      .map((index) => ({
        index,
        workload: editedWorkloads[index],
      }))
      .filter((entry) => entry.workload);

    if (workloadsToCreate.length === 0) {
      toast.error('No discovered workloads are ready to create.');
      return;
    }
    if (creationLimits.shouldRestrict) {
      if (remainingWorkloadSlots <= 0) {
        toast.error(creationLimits.workloadLimitMessage);
        return;
      }
      if (workloadsToCreate.length > remainingWorkloadSlots) {
        toast.error(
          'Free plan includes 1 workload. Select a single workload or upgrade to Individual or Teams.'
        );
        return;
      }
    }

    setIsQuickAdding(true);
    const createdEntries = [];
    const failedEntries = [];

    try {
      for (const { index, workload } of workloadsToCreate) {
        const workloadMetadata =
          workload?.metadata && typeof workload.metadata === 'object' ? workload.metadata : {};
        const workloadProfileId =
          getWorkloadEnvironmentProfileId(workload) || primaryPermissionProfileId;
        const permissionProfileId =
          workloadMetadata.permissionProfileId || workloadProfileId;
        const accountId = getAccountIdFromProfileId(workloadProfileId);
        const payload = buildDiscoveredWorkloadCreatePayload({
          userProfile,
          workload,
          permissionProfileId,
          accountId,
        });

        if (
          !payload.workloadName.trim() ||
          !payload.description.trim() ||
          !Array.isArray(payload.environments) ||
          payload.environments.length === 0
        ) {
          failedEntries.push({
            index,
            name: getDiscoveredWorkloadName(workload, `Workload ${index + 1}`),
            error: 'Missing required workload details or environment.',
          });
          continue;
        }

        try {
          const createdWorkload = await dispatch(createWorkloadDefinition(payload)).unwrap();
          createdEntries.push({ index, workload: createdWorkload });
        } catch (error) {
          failedEntries.push({
            index,
            name: getDiscoveredWorkloadName(workload, `Workload ${index + 1}`),
            error: error?.message || 'Failed to create workload.',
          });
        }
      }

      if (createdEntries.length > 0) {
        setCreatedInSessionCount((previous) => previous + createdEntries.length);
        const createdIndexSet = new Set(createdEntries.map((entry) => entry.index));
        setEditedWorkloads((previous) =>
          previous.filter((_, index) => !createdIndexSet.has(index))
        );
        setSelectedWorkloadIndex((previous) => {
          if (previous === null) return null;
          if (createdIndexSet.has(previous)) return null;
          const removedBefore = createdEntries.filter((entry) => entry.index < previous).length;
          return previous - removedBefore;
        });

        const successLabel =
          createdEntries.length === 1 ? 'Quick added workload.' : `Quick added ${createdEntries.length} workloads.`;
        toast.success(successLabel);
        setIsQuickAdding(false);

        const syncResult = await runPostCreateWorkloadSync({
          dispatch,
          workloads: createdEntries.map((entry) => entry.workload),
        });
        const healthFailures = syncResult.healthResults.filter((item) => !item.success);
        const summaryFailures = syncResult.summaryResults.filter((item) => !item.success);

        if (
          healthFailures.length > 0 ||
          summaryFailures.length > 0
        ) {
          console.warn('[DiscoverWorkloadsModal] Quick add completed with warnings', {
            healthFailures,
            summaryFailures,
          });
          toast.error(
            'Some health or summary data could not be refreshed after quick add.'
          );
        }
      }

      if (failedEntries.length > 0) {
        console.warn('[DiscoverWorkloadsModal] Quick add failures', failedEntries);
        toast.error(
          `Failed to quick add ${failedEntries.length} workload${failedEntries.length === 1 ? '' : 's'}.`
        );
      } else if (createdEntries.length === 0) {
        toast.error('No workloads were created.');
      }
    } finally {
      setIsQuickAdding(false);
    }
  };

  const handleQuickAddSingleWorkload = async (workloadIndex) => {
    await handleQuickAddWorkloads([workloadIndex]);
  };

  const handleQuickAddAllWorkloads = async () => {
    await handleQuickAddWorkloads(editedWorkloads.map((_, index) => index));
  };

  const handleWorkloadEdit = (index, field, value) => {
    const updated = [...editedWorkloads];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setEditedWorkloads(updated);
  };

  const handleResourceRemove = (workloadIndex, type, index) => {
    const updated = [...editedWorkloads];
    const workload = updated[workloadIndex];
    const trackedResources = workload.trackedResources || {};
    
    if (type === 'resource') {
      const resources = trackedResources.resources || [];
      updated[workloadIndex] = {
        ...workload,
        trackedResources: {
          ...trackedResources,
          resources: resources.filter((_, idx) => idx !== index),
        },
      };
    } else if (type === 'stack') {
      const stacks = trackedResources.stacks || [];
      updated[workloadIndex] = {
        ...workload,
        trackedResources: {
          ...trackedResources,
          stacks: stacks.filter((_, idx) => idx !== index),
        },
      };
    }
    
    setEditedWorkloads(updated);
  };

  const getTotalTrackedResourcesCount = (trackedResources) => {
    if (!trackedResources) return 0;
    // Handle new format: { resources: [], stacks: [] }
    if (trackedResources.resources || trackedResources.stacks) {
      const resources = Array.isArray(trackedResources.resources) ? trackedResources.resources.length : 0;
      const stacks = Array.isArray(trackedResources.stacks) ? trackedResources.stacks.length : 0;
      return resources + stacks;
    }
    // Handle old format: array (for backward compatibility)
    if (Array.isArray(trackedResources)) {
      return trackedResources.length;
    }
    return 0;
  };

  // Normalize trackedResources to new format
  const normalizeTrackedResources = (trackedResources) => {
    if (!trackedResources) {
      return { resources: [], stacks: [] };
    }
    // Already in new format
    if (trackedResources.resources || trackedResources.stacks) {
      return {
        resources: Array.isArray(trackedResources.resources) ? trackedResources.resources : [],
        stacks: Array.isArray(trackedResources.stacks) ? trackedResources.stacks : [],
      };
    }
    // Old format: array of resources
    if (Array.isArray(trackedResources)) {
      return {
        resources: trackedResources,
        stacks: [],
      };
    }
    return { resources: [], stacks: [] };
  };

  const hasUnsavedChanges = () => {
    return JSON.stringify(workloads) !== JSON.stringify(editedWorkloads);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleService = (serviceValue) => {
    setSelectedServices((prev) =>
      prev.includes(serviceValue)
        ? prev.filter((s) => s !== serviceValue)
        : [...prev, serviceValue]
    );
  };

  const handleServiceModeChange = (mode) => {
    setServiceMode(mode);
    if (mode === 'all') {
      setSelectedServices(SERVICE_OPTIONS.map((s) => s.value));
    }
  };

  const getResourceIdentifier = (resource = {}) =>
    String(
      resource?.resourceId ||
        resource?.resourceArn ||
        resource?.physicalResourceId ||
        resource?.logicalResourceId ||
        resource?.displayName ||
        ''
    ).trim();

  const getResourceSelectionKey = (resource = {}) => {
    const resourceId = getResourceIdentifier(resource);
    const region = String(resource?.region || '').trim();
    const environmentProfileId = String(resource?.environmentProfileId || '').trim();
    return `${environmentProfileId}::${resourceId}::${region}`;
  };

  const resourceExistsInWorkload = (workload, resource) => {
    const resources = workload?.trackedResources?.resources || [];
    const workloadEnvironmentId = getWorkloadEnvironmentProfileId(workload);
    const resourceEnvironmentId = String(resource?.environmentProfileId || '').trim();
    if (workloadEnvironmentId && resourceEnvironmentId && workloadEnvironmentId !== resourceEnvironmentId) {
      return false;
    }
    const resourceIdentifier = getResourceIdentifier(resource);
    return resources.some((tracked) => {
      if (getResourceIdentifier(tracked) !== resourceIdentifier) return false;
      const trackedRegion = String(tracked?.region || '');
      const resourceRegion = String(resource?.region || '');
      if (trackedRegion && resourceRegion && trackedRegion !== resourceRegion) return false;
      return true;
    });
  };

  // Check if a resource is already in any workload
  const isResourceInWorkload = (resource) => {
    return editedWorkloads.some((workload) => resourceExistsInWorkload(workload, resource));
  };

  // Check if a CloudFormation stack is already in any workload
  const isStackInWorkload = (stackId, environmentProfileId = '') => {
    const normalizedId = stackId ? String(stackId) : '';
    const normalizedEnvironmentId = environmentProfileId ? String(environmentProfileId) : '';
    if (!normalizedId) return false;
    return editedWorkloads.some((workload) => {
      const workloadEnvironmentId = getWorkloadEnvironmentProfileId(workload);
      if (
        normalizedEnvironmentId &&
        workloadEnvironmentId &&
        normalizedEnvironmentId !== workloadEnvironmentId
      ) {
        return false;
      }
      const stacks = workload.trackedResources?.stacks || [];
      return stacks.some((s) => String(s?.stackId || '') === normalizedId);
    });
  };

  // Get which workload(s) contain a stack
  const getWorkloadsContainingStack = (stackId, environmentProfileId = '') => {
    const normalizedId = stackId ? String(stackId) : '';
    const normalizedEnvironmentId = environmentProfileId ? String(environmentProfileId) : '';
    if (!normalizedId) return [];
    return editedWorkloads
      .map((workload, idx) => {
        const workloadEnvironmentId = getWorkloadEnvironmentProfileId(workload);
        if (
          normalizedEnvironmentId &&
          workloadEnvironmentId &&
          normalizedEnvironmentId !== workloadEnvironmentId
        ) {
          return null;
        }
        const stacks = workload.trackedResources?.stacks || [];
        const contains = stacks.some((s) => String(s?.stackId || '') === normalizedId);
        return contains ? idx : null;
      })
      .filter((idx) => idx !== null);
  };

  // Get which workload(s) contain a resource
  const getWorkloadsContainingResource = (resource) => {
    return editedWorkloads
      .map((workload, idx) => (resourceExistsInWorkload(workload, resource) ? idx : null))
      .filter((idx) => idx !== null);
  };

  // Create a new empty workload
  const handleCreateNewWorkload = (environmentMeta = null) => {
    if (!canCreateDraftWorkload) {
      toast.error(creationLimits.workloadLimitMessage);
      return;
    }
    const fallbackEnvironment =
      environmentMeta && typeof environmentMeta === 'object'
        ? environmentMeta
        : primaryPermissionProfileId
        ? {
            profileId: primaryPermissionProfileId,
            name: getPermissionProfileMeta(primaryPermissionProfileId).name,
            accountId: getPermissionProfileMeta(primaryPermissionProfileId).accountId,
          }
        : null;
    const newWorkload = {
      name: `New Workload ${editedWorkloads.length + 1}`,
      description: '',
      trackedResources: {
        resources: [],
        stacks: [],
      },
      metadata: {
        phase: 'user_created',
        ...(fallbackEnvironment?.profileId
          ? {
              environmentProfileId: fallbackEnvironment.profileId,
              environmentName: fallbackEnvironment.name || '',
              environmentAccountId: fallbackEnvironment.accountId || '',
            }
          : {}),
      },
    };
    setEditedWorkloads([...editedWorkloads, newWorkload]);
    toast.success('New workload created');
  };

  // Delete a workload
  const handleDeleteWorkload = (workloadIndex) => {
    if (window.confirm(`Are you sure you want to delete "${editedWorkloads[workloadIndex].name}"?`)) {
      const updated = editedWorkloads.filter((_, idx) => idx !== workloadIndex);
      setEditedWorkloads(updated);
      if (selectedWorkloadIndex === workloadIndex) {
        setSelectedWorkloadIndex(null);
      } else if (selectedWorkloadIndex > workloadIndex) {
        setSelectedWorkloadIndex(selectedWorkloadIndex - 1);
      }
      toast.success('Workload deleted');
    }
  };

  // Add a resource to a workload
  const buildTrackedResourceEntry = (resource) => {
    const accountId =
      resource?.accountId || resource?.environmentAccountId || resource?.accountID || '';
    const resourceId = getResourceIdentifier(resource);

    return {
      resourceId,
      resourceType: resource?.resourceType || '',
      region: resource?.region || '',
      resourceArn: resource?.resourceArn || '',
      ...(resource?.displayName ? { displayName: String(resource.displayName) } : {}),
      ...(accountId ? { accountId: String(accountId) } : {}),
      ...(resource?.environmentProfileId
        ? { environmentProfileId: String(resource.environmentProfileId) }
        : {}),
      ...(resource?.environmentName ? { environmentName: String(resource.environmentName) } : {}),
      ...(resource?.environmentAccountId
        ? { environmentAccountId: String(resource.environmentAccountId) }
        : {}),
    };
  };

  const handleAddResourceToWorkload = (workloadIndex, resource) => {
    const resourceIdentifier = getResourceIdentifier(resource);
    if (!resourceIdentifier) {
      toast.error('Resource is missing an identifier');
      return;
    }

    let addedWorkloadName = '';
    let addError = '';
    setEditedWorkloads((previous) => {
      if (!Number.isInteger(workloadIndex) || !previous[workloadIndex]) {
        addError = 'No workload selected';
        return previous;
      }

      const updated = [...previous];
      const workload = { ...updated[workloadIndex] };
      const trackedResources = normalizeTrackedResources(workload.trackedResources);
      const workloadMetadata =
        workload?.metadata && typeof workload.metadata === 'object' ? { ...workload.metadata } : {};
      const workloadEnvironmentId = String(workloadMetadata.environmentProfileId || '').trim();
      const resourceEnvironmentId = String(resource?.environmentProfileId || '').trim();
      if (workloadEnvironmentId && resourceEnvironmentId && workloadEnvironmentId !== resourceEnvironmentId) {
        addError = 'This workload belongs to a different environment';
        return previous;
      }
      if (!workloadEnvironmentId && resourceEnvironmentId) {
        workloadMetadata.environmentProfileId = resourceEnvironmentId;
        workloadMetadata.environmentName = resource.environmentName || workloadMetadata.environmentName;
        workloadMetadata.environmentAccountId =
          resource.environmentAccountId || workloadMetadata.environmentAccountId;
      }

      const exists = trackedResources.resources.some(
        (r) =>
          getResourceIdentifier(r) === resourceIdentifier &&
          String(r.region || '') === String(resource.region || '')
      );
      if (exists) {
        addError = 'Resource already in this workload';
        return previous;
      }

      workload.trackedResources = {
        ...trackedResources,
        resources: [...trackedResources.resources, buildTrackedResourceEntry(resource)],
      };
      workload.metadata = workloadMetadata;
      updated[workloadIndex] = workload;
      addedWorkloadName = workload.name;
      return updated;
    });

    if (addError) {
      toast.error(addError);
      return;
    }
    if (addedWorkloadName) {
      toast.success(`Resource added to "${addedWorkloadName}"`);
    }
  };

  const normalizeStackEntry = (stack) => {
    const stackId = stack?.stackId ?? stack?.StackId ?? stack?.id ?? stack?.stackID;
    const name = stack?.name ?? stack?.stackName ?? stack?.StackName ?? '';
    const description = stack?.description ?? stack?.stackDescription ?? '';
    const region = stack?.region ?? stack?.stackRegion ?? stack?.awsRegion ?? '';
    const accountId = stack?.accountId ?? scanData?.accountId ?? '';
    const environmentProfileId =
      stack?.environmentProfileId ?? stack?.environmentId ?? stack?.profileId ?? '';
    const environmentName = stack?.environmentName ?? '';
    const environmentAccountId = stack?.environmentAccountId ?? accountId ?? '';
    const stackArn = stack?.stackArn ?? stack?.StackArn ?? stack?.arn ?? stack?.Arn ?? '';

    return {
      stackId: stackId ? String(stackId).trim() : '',
      name: name ? String(name) : '',
      description: description ? String(description) : '',
      region: region ? String(region) : '',
      accountId: accountId ? String(accountId) : '',
      environmentProfileId: environmentProfileId ? String(environmentProfileId) : '',
      environmentName: environmentName ? String(environmentName) : '',
      environmentAccountId: environmentAccountId ? String(environmentAccountId) : '',
      ...(stackArn ? { stackArn: String(stackArn) } : {}),
    };
  };

  const handleAddStackToWorkload = (workloadIndex, stack) => {
    const normalized = normalizeStackEntry(stack);
    if (!normalized.stackId) {
      toast.error('Stack is missing a stackId');
      return;
    }

    const updated = [...editedWorkloads];
    const workload = { ...updated[workloadIndex] };
    const trackedResources = normalizeTrackedResources(workload.trackedResources);
    const workloadMetadata =
      workload?.metadata && typeof workload.metadata === 'object' ? { ...workload.metadata } : {};

    const workloadEnvironmentId = String(workloadMetadata.environmentProfileId || '').trim();
    const stackEnvironmentId = String(normalized.environmentProfileId || '').trim();
    if (workloadEnvironmentId && stackEnvironmentId && workloadEnvironmentId !== stackEnvironmentId) {
      toast.error('This workload belongs to a different environment');
      return;
    }
    if (!workloadEnvironmentId && stackEnvironmentId) {
      workloadMetadata.environmentProfileId = stackEnvironmentId;
      workloadMetadata.environmentName = normalized.environmentName || workloadMetadata.environmentName;
      workloadMetadata.environmentAccountId =
        normalized.environmentAccountId || workloadMetadata.environmentAccountId;
    }

    const stacks = Array.isArray(trackedResources.stacks) ? trackedResources.stacks : [];
    const exists = stacks.some((s) => String(s?.stackId || '') === normalized.stackId);
    if (exists) {
      toast.error('Stack already in this workload');
      return;
    }

    trackedResources.stacks = [...stacks, normalized];
    workload.trackedResources = trackedResources;
    workload.metadata = workloadMetadata;
    updated[workloadIndex] = workload;
    setEditedWorkloads(updated);
    toast.success(`Stack added to "${workload.name}"`);
  };

  // Add selected resources to a workload
  const handleAddSelectedResourcesToWorkload = (workloadIndex) => {
    if (!scanData || !scanData.services) return;
    
    // Flatten all resources
    const allResources = [];
    Object.entries(scanData.services).forEach(([serviceKey, serviceData]) => {
      const resources = serviceData.resources || [];
      resources.forEach((resource) => {
        allResources.push({
          ...resource,
          serviceName: serviceData.service || serviceKey,
          serviceKey,
        });
      });
    });

    // Get selected resources
    const resourcesToAdd = allResources.filter((resource) =>
      selectedResources.has(getResourceSelectionKey(resource))
    );
    
    if (resourcesToAdd.length === 0) {
      toast.error('No resources selected');
      return;
    }

    const updated = [...editedWorkloads];
    const workload = { ...updated[workloadIndex] };
    const trackedResources = normalizeTrackedResources(workload.trackedResources);
    const workloadMetadata =
      workload?.metadata && typeof workload.metadata === 'object' ? { ...workload.metadata } : {};
    let workloadEnvironmentId = String(workloadMetadata.environmentProfileId || '').trim();

    let addedCount = 0;
    resourcesToAdd.forEach((resource) => {
      const resourceEnvironmentId = String(resource?.environmentProfileId || '').trim();
      if (
        workloadEnvironmentId &&
        resourceEnvironmentId &&
        workloadEnvironmentId !== resourceEnvironmentId
      ) {
        return;
      }
      if (!workloadEnvironmentId && resourceEnvironmentId) {
        workloadMetadata.environmentProfileId = resourceEnvironmentId;
        workloadMetadata.environmentName = resource.environmentName || workloadMetadata.environmentName;
        workloadMetadata.environmentAccountId =
          resource.environmentAccountId || workloadMetadata.environmentAccountId;
        workloadEnvironmentId = resourceEnvironmentId;
      }

      const resourceIdentifier = getResourceIdentifier(resource);
      const exists = trackedResources.resources.some(
        (tracked) =>
          getResourceIdentifier(tracked) === resourceIdentifier &&
          String(tracked.region || '') === String(resource.region || '')
      );
      if (!exists) {
        trackedResources.resources.push(buildTrackedResourceEntry(resource));
        addedCount++;
      }
    });

    workload.trackedResources = trackedResources;
    workload.metadata = workloadMetadata;
    updated[workloadIndex] = workload;
    setEditedWorkloads(updated);
    setSelectedResources(new Set());
    setShowAddToWorkloadDropdown(false);
    if (addedCount === 0) {
      toast.error('No compatible resources were added to this workload');
      return;
    }
    toast.success(`${addedCount} resource(s) added to "${workload.name}"`);
  };

  // Toggle resource selection
  const handleToggleResourceSelection = (resource) => {
    const resourceKey = getResourceSelectionKey(resource);
    const newSelected = new Set(selectedResources);
    if (newSelected.has(resourceKey)) {
      newSelected.delete(resourceKey);
    } else {
      newSelected.add(resourceKey);
    }
    setSelectedResources(newSelected);
  };

  // Toggle all filtered resources selection
  const handleToggleAllResources = (filteredResources) => {
    const resourceKeys = filteredResources.map((resource) => getResourceSelectionKey(resource));
    const allFilteredSelected = resourceKeys.every((id) => selectedResources.has(id));
    
    const newSelected = new Set(selectedResources);
    if (allFilteredSelected) {
      // Deselect all filtered
      resourceKeys.forEach((id) => newSelected.delete(id));
    } else {
      // Select all filtered (only those not already in workloads)
      filteredResources.forEach((resource) => {
        const resourceKey = getResourceSelectionKey(resource);
        if (!isResourceInWorkload(resource)) {
          newSelected.add(resourceKey);
        }
      });
    }
    setSelectedResources(newSelected);
  };

  const handleToggleAllServices = () => {
    if (selectedServices.length === SERVICE_OPTIONS.length) {
      setSelectedServices([]);
    } else {
      setSelectedServices(SERVICE_OPTIONS.map((s) => s.value));
    }
  };

  const allServicesSelected = selectedServices.length === SERVICE_OPTIONS.length;

  const getAllScannedResources = () => {
    if (!scanData?.services) return [];
    const allResources = [];
    Object.entries(scanData.services).forEach(([serviceKey, serviceData]) => {
      const resources = Array.isArray(serviceData?.resources) ? serviceData.resources : [];
      resources.forEach((resource) => {
        allResources.push({
          ...resource,
          serviceName: serviceData.service || serviceKey,
          serviceKey,
        });
      });
    });
    return allResources;
  };

  const getScannedResourcesForWorkload = (workload) => {
    const workloadEnvironmentId = getWorkloadEnvironmentProfileId(workload);
    const allResources = getAllScannedResources();
    return allResources.filter((resource) => {
      if (!workloadEnvironmentId) return true;
      return String(resource.environmentProfileId || '') === workloadEnvironmentId;
    });
  };

  const selectedWorkload =
    selectedWorkloadIndex !== null ? editedWorkloads[selectedWorkloadIndex] || null : null;
  const selectedWorkloadTrackedResources = selectedWorkload
    ? normalizeTrackedResources(selectedWorkload.trackedResources)
    : { resources: [], stacks: [] };
  const scannedResourcesForSelectedWorkload = selectedWorkload
    ? getScannedResourcesForWorkload(selectedWorkload)
    : [];
  const filteredScannedResourcesForSelectedWorkload = reviewResourceFilter
    ? scannedResourcesForSelectedWorkload.filter((resource) => {
        const filterLower = reviewResourceFilter.toLowerCase();
        return (
          (resource.displayName || resource.resourceId || '').toLowerCase().includes(filterLower) ||
          (resource.resourceId || '').toLowerCase().includes(filterLower) ||
          (resource.resourceArn || '').toLowerCase().includes(filterLower) ||
          (resource.serviceName || '').toLowerCase().includes(filterLower) ||
          (resource.resourceType || '').toLowerCase().includes(filterLower) ||
          (resource.region || '').toLowerCase().includes(filterLower)
        );
      })
    : scannedResourcesForSelectedWorkload;

  const handleModalClose = () => {
    if (activeDiscoveryRun?.jobId) {
      dispatch(
        syncBackgroundDiscoverySnapshot({
          sessionIdsByEnvironment,
          environmentRuns,
          messages,
          workloads: editedWorkloads,
          scanData,
          reviewPending: editedWorkloads.length > 0,
        })
      );
    }
    onClose();
  };

  // Configuration step
  if (!isConfigured) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleModalClose()}>
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] bg-white max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-5 border-b bg-white flex-shrink-0">
            <DialogTitle className="text-xl font-semibold">Workload Discovery</DialogTitle>
          </DialogHeader>
          <Dialog open={isRegionsModalOpen} onOpenChange={setIsRegionsModalOpen}>
            <DialogContent className="max-w-xl bg-white max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">Select AWS Regions</DialogTitle>
                <DialogDescription>
                  Choose which regions to include in workload discovery.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-between gap-3 pb-3">
                <div className="text-sm text-gray-500">
                  {selectedRegions.length} region(s) selected
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllRegions}>
                    Select all
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAllRegions}
                    disabled={selectedRegions.length === 0}
                  >
                    Deselect all
                  </Button>
                  <Button variant="outline" size="sm" onClick={resetRegionsToDefaults}>
                    Reset to defaults
                  </Button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto border rounded-md p-3 bg-gray-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {REGION_OPTIONS.map((region) => (
                    <label
                      key={region.value}
                      className="flex items-start gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRegions.includes(region.value)}
                        onChange={() => toggleRegion(region.value)}
                        className="mt-0.5 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{region.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                <Button variant="outline" onClick={() => setIsRegionsModalOpen(false)}>
                  Close
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              This will discover your applications, group related resources into workloads, and create diagrams, documentation, and operational context for them.
            </div>

            {/* Environment Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Environments <span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                placeholder="Search environments..."
                value={environmentFilter}
                onChange={(e) => setEnvironmentFilter(e.target.value)}
                className="h-9 bg-white text-sm"
              />
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3 max-h-56 overflow-y-auto space-y-2">
                {environmentOptions.length === 0 && (
                  <p className="text-sm text-gray-500">No cloud environments available.</p>
                )}
                {environmentOptions.length > 0 && filteredEnvironmentOptions.length === 0 && (
                  <p className="text-sm text-gray-500">No environments match your search.</p>
                )}
                {filteredEnvironmentOptions.map((environmentOption) => {
                  const { selectionId, profile, authProfile, cloudProvider, subscriptionId } = environmentOption;
                  const isAzure = cloudProvider === 'azure';
                  const isGoogleWorkspace = authProfile.provider === 'google_workspace' || profile?.type === 'google_workspace';
                  const displayId = isGoogleWorkspace
                    ? (authProfile.adminEmail?.split('@')[1] || authProfile.projectId || 'N/A')
                    : isAzure
                      ? (subscriptionId || 'No subscription')
                      : (authProfile.awsAccountId || 'N/A');
                  const checked = selectedPermissionProfileIds.includes(selectionId);
                  return (
                    <label
                      key={selectionId}
                      className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePermissionProfile(selectionId)}
                        className="rounded border-gray-300"
                      />
                      <span className="flex-shrink-0">
                        {isGoogleWorkspace ? (
                          <Icons.googleWorkspace className="h-4 w-4" />
                        ) : isAzure ? (
                          <Icons.azure className="h-4 w-4" />
                        ) : (
                          <Icons.aws className="h-4 w-4" />
                        )}
                      </span>
                      <span className="text-sm text-gray-700">
                        <span className="font-medium">{isAzure ? environmentOption.name : profile.name}</span>{' '}
                        <span className="text-gray-500">({displayId})</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500">
                {selectedPermissionProfileIds.length} environment(s) selected
                {environmentFilter.trim() && (
                  <> • showing {filteredEnvironmentOptions.length} of {environmentOptions.length}</>
                )}
              </p>
            </div>

            {/* Environment Notes (Optional) */}
            <Accordion type="single" collapsible className="border rounded-lg">
              <AccordionItem value="environment-notes" className="border-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-700">
                    Environment notes <span className="text-gray-400">(optional)</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-2">
                    <Label htmlFor="environment-notes" className="sr-only">
                      Environment notes
                    </Label>
                    <Textarea
                      id="environment-notes"
                      value={environmentNotes}
                      onChange={(e) => setEnvironmentNotes(e.target.value)}
                      placeholder={
                        "Help us discover workloads faster by providing a description of the environment and its purpose."
                      }
                      className="min-h-[120px] resize-y"
                    />
                    
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Advanced Settings Accordion */}
            <Accordion type="single" collapsible className="border rounded-lg">
              <AccordionItem value="advanced" className="border-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    Advanced Settings
                    <span className="text-xs font-normal text-gray-500">
                      (Services, Regions, Scan options)
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-5">
                    {/* Services Selection */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">
                          AWS Services <span className="text-red-500">*</span>
                        </Label>
                        <div className="flex items-center gap-2">
                          <Select value={serviceMode} onValueChange={handleServiceModeChange}>
                            <SelectTrigger className="w-[220px] bg-white">
                              <SelectValue placeholder="Select services" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All supported services</SelectItem>
                              <SelectItem value="custom">Select specific services</SelectItem>
                            </SelectContent>
                          </Select>
                          {serviceMode === 'custom' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleToggleAllServices}
                            >
                              {allServicesSelected ? 'Clear all' : 'Select all'}
                            </Button>
                          )}
                        </div>
                      </div>
                      {serviceMode === 'custom' && (
                        <div className="border rounded-md p-3 max-h-48 overflow-y-auto bg-gray-50">
                          <div className="grid grid-cols-2 gap-2">
                            {SERVICE_OPTIONS.map((service) => (
                              <label
                                key={service.value}
                                className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-2 rounded"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedServices.includes(service.value)}
                                  onChange={() => toggleService(service.value)}
                                  className="rounded border-gray-300"
                                />
                                <span className="text-sm">{service.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedServices.length > 0 && (
                        <p className="text-xs text-gray-500">
                          {selectedServices.length} service(s) selected
                        </p>
                      )}
                    </div>

                    {/* Regions Summary */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-sm font-medium">
                          AWS Regions
                        </Label>
                        <Button variant="outline" size="sm" onClick={() => setIsRegionsModalOpen(true)}>
                          Edit regions
                        </Button>
                      </div>
                      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <span className="font-semibold text-gray-700">{selectedRegions.length}</span>{' '}
                            region(s) selected
                          </div>
                          {selectedRegions.length > 0 && (
                            <div className="text-xs text-gray-500 text-right">
                              {selectedRegions.slice(0, 2).map((regionValue) => {
                                const regionOption = REGION_OPTIONS.find((r) => r.value === regionValue);
                                return regionOption ? regionOption.label : regionValue;
                              }).join(', ')}
                              {selectedRegions.length > 2 ? ` +${selectedRegions.length - 2} more` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Force scan option */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Inventory scan</Label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={forceInventoryScan}
                          onChange={(e) => setForceInventoryScan(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        Force a new inventory scan (ignore cached inventory from last 24 hours)
                      </label>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

          </div>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t bg-white flex-shrink-0">
            <Button variant="outline" onClick={handleModalClose}>
              Cancel
            </Button>
            <Button
              onClick={handleStartDiscovery}
              disabled={
                selectedPermissionProfileIds.length === 0 ||
                selectedServices.length === 0 ||
                selectedRegions.length === 0
              }
            >
              Start Discovery
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Main discovery UI
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleModalClose()}>
      <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] m-0 p-0 gap-0 flex flex-col bg-white rounded-none">
        {/* CloudFormation stacks modal (from raw scan results) */}
        <Dialog open={isStacksModalOpen} onOpenChange={setIsStacksModalOpen}>
          <DialogContent className="max-w-3xl bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">CloudFormation stacks</DialogTitle>
              <DialogDescription>
                Review detected stacks from the scan and associate them with a workload.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Input
                  type="text"
                  placeholder="Filter stacks..."
                  value={stackFilter}
                  onChange={(e) => setStackFilter(e.target.value)}
                  className="h-9"
                />
                <div className="text-xs text-gray-500 whitespace-nowrap">
                  {(scanData?.cloudformation?.stacks?.length || 0)} total
                </div>
              </div>

              <div className="max-h-[60vh] overflow-auto border border-gray-200 rounded-lg">
                {(() => {
                  const stacks = Array.isArray(scanData?.cloudformation?.stacks)
                    ? scanData.cloudformation.stacks
                    : [];

                  const filtered = stackFilter
                    ? stacks.filter((s) => {
                        const n = normalizeStackEntry(s);
                        const filterLower = stackFilter.toLowerCase();
                        return (
                          (n.name || '').toLowerCase().includes(filterLower) ||
                          (n.stackId || '').toLowerCase().includes(filterLower) ||
                          (n.description || '').toLowerCase().includes(filterLower) ||
                          (n.region || '').toLowerCase().includes(filterLower) ||
                          (n.environmentName || '').toLowerCase().includes(filterLower)
                        );
                      })
                    : stacks;

                  if (stacks.length === 0) {
                    return (
                      <div className="p-6 text-sm text-gray-500">
                        No CloudFormation stacks were returned in the scan results.
                      </div>
                    );
                  }

                  if (filtered.length === 0) {
                    return (
                      <div className="p-6 text-sm text-gray-500">
                        No stacks match your filter.
                      </div>
                    );
                  }

                  return (
                    <div className="divide-y divide-gray-200">
                      {filtered.map((stack, idx) => {
                        const normalized = normalizeStackEntry(stack);
                        const workloadIndexes = getWorkloadsContainingStack(
                          normalized.stackId,
                          normalized.environmentProfileId
                        );
                        const alreadyAssigned = workloadIndexes.length > 0;

                        return (
                          <div key={`${normalized.stackId || 'stack'}-${idx}`} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="font-medium text-gray-900 break-words">
                                    {normalized.name || 'Unnamed stack'}
                                  </div>
                                  {alreadyAssigned && (
                                    <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">
                                      In workload
                                    </Badge>
                                  )}
                                </div>
                                {normalized.description && (
                                  <div className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
                                    {normalized.description}
                                  </div>
                                )}
                                <div className="text-xs text-gray-500 mt-2 space-y-1">
                                  {normalized.environmentName && (
                                    <div>
                                      <span className="font-medium text-gray-600">Environment:</span>{' '}
                                      {normalized.environmentName}
                                    </div>
                                  )}
                                  {normalized.region && (
                                    <div>
                                      <span className="font-medium text-gray-600">Region:</span> {normalized.region}
                                    </div>
                                  )}
                                  {normalized.stackId && (
                                    <div className="break-all">
                                      <span className="font-medium text-gray-600">StackId:</span> {normalized.stackId}
                                    </div>
                                  )}
                                </div>
                                {alreadyAssigned && (
                                  <div className="text-xs text-gray-500 mt-2">
                                    Assigned to:{' '}
                                    {workloadIndexes
                                      .map((i) => editedWorkloads[i]?.name)
                                      .filter(Boolean)
                                      .join(', ')}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Select
                                  onValueChange={(value) => {
                                    if (value === '__create__') {
                                      handleCreateNewWorkload({
                                        profileId: normalized.environmentProfileId || '',
                                        name: normalized.environmentName || '',
                                        accountId: normalized.environmentAccountId || '',
                                      });
                                      setTimeout(() => {
                                        const newIdx = editedWorkloads.length;
                                        handleAddStackToWorkload(newIdx, stack);
                                      }, 100);
                                      return;
                                    }
                                    const idxNum = Number(value);
                                    if (!Number.isNaN(idxNum)) {
                                      handleAddStackToWorkload(idxNum, stack);
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-[220px] h-9">
                                    <SelectValue placeholder="Associate to workload" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {editedWorkloads.map((w, wIdx) => {
                                      const workloadEnvironmentId = getWorkloadEnvironmentProfileId(w);
                                      const stackEnvironmentId = normalized.environmentProfileId || '';
                                      const isCompatible =
                                        !workloadEnvironmentId ||
                                        !stackEnvironmentId ||
                                        workloadEnvironmentId === stackEnvironmentId;
                                      if (!isCompatible) return null;
                                      const workloadMetadata =
                                        w?.metadata && typeof w.metadata === 'object' ? w.metadata : {};
                                      return (
                                        <SelectItem key={wIdx} value={String(wIdx)}>
                                          {w.name}
                                          {workloadMetadata.environmentName
                                            ? ` (${workloadMetadata.environmentName})`
                                            : ''}
                                        </SelectItem>
                                      );
                                    })}
                                    <SelectItem value="__create__">Create new workload</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setIsStacksModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isRawScanModalOpen} onOpenChange={setIsRawScanModalOpen}>
          <DialogContent className="max-w-6xl w-[calc(100vw-2rem)] h-[85vh] bg-white overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Raw Scan Results</DialogTitle>
              <DialogDescription>
                Review scanned resources and optionally add them to discovered workloads.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-hidden bg-white">
              {scanData && scanData.services ? (() => {
                const allResources = getAllScannedResources();
                const filteredResources = resourceFilter
                  ? allResources.filter((resource) => {
                      const filterLower = resourceFilter.toLowerCase();
                      return (
                        (resource.displayName || resource.resourceId || '').toLowerCase().includes(filterLower) ||
                        (resource.resourceId || '').toLowerCase().includes(filterLower) ||
                        (resource.resourceArn || '').toLowerCase().includes(filterLower) ||
                        (resource.serviceName || '').toLowerCase().includes(filterLower) ||
                        (resource.resourceType || '').toLowerCase().includes(filterLower) ||
                        (resource.region || '').toLowerCase().includes(filterLower) ||
                        (resource.environmentName || '').toLowerCase().includes(filterLower)
                      );
                    })
                  : allResources;

                const filteredResourceKeys = filteredResources.map((resource) =>
                  getResourceSelectionKey(resource)
                );
                const allSelected =
                  filteredResources.length > 0 &&
                  filteredResourceKeys.every((key) => selectedResources.has(key));
                const someSelected = filteredResourceKeys.some((key) => selectedResources.has(key));

                return (
                  <div className="h-full min-h-0 flex flex-col">
                    <div className="px-1 pb-3 flex items-center justify-between gap-3 flex-shrink-0">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-700">
                          <span className="text-gray-500">Total:</span> {allResources.length} resources
                          {resourceFilter && (
                            <span className="ml-2 text-gray-500">({filteredResources.length} filtered)</span>
                          )}
                        </div>
                        <Input
                          type="text"
                          placeholder="Filter resources..."
                          value={resourceFilter}
                          onChange={(e) => setResourceFilter(e.target.value)}
                          className="max-w-xs h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsStacksModalOpen(true)}
                          disabled={
                            !scanData?.cloudformation?.stacks ||
                            scanData.cloudformation.stacks.length === 0
                          }
                          className="h-8 text-xs"
                        >
                          <Layers className="h-3 w-3 mr-1" />
                          Stacks ({scanData?.cloudformation?.stacks?.length || 0})
                        </Button>

                        <div className="relative" ref={dropdownRef}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAddToWorkloadDropdown(!showAddToWorkloadDropdown)}
                            disabled={selectedResources.size === 0}
                            className="h-8 text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add to Workload ({selectedResources.size})
                          </Button>
                          {showAddToWorkloadDropdown && editedWorkloads.length > 0 && (
                            <div className="absolute right-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
                              <div className="p-2">
                                {editedWorkloads.map((workload, workloadIdx) => (
                                  <button
                                    key={workloadIdx}
                                    onClick={() => handleAddSelectedResourcesToWorkload(workloadIdx)}
                                    className="w-full text-left px-3 py-2.5 text-sm rounded hover:bg-gray-100 transition-colors text-gray-700"
                                  >
                                    <div className="font-medium break-words">
                                      {workload.name}
                                      {workload?.metadata?.environmentName
                                        ? ` (${workload.metadata.environmentName})`
                                        : ''}
                                    </div>
                                    {workload.description && (
                                      <div className="text-xs text-gray-500 mt-1 line-clamp-2">{workload.description}</div>
                                    )}
                                  </button>
                                ))}
                                <div className="border-t border-gray-200 mt-2 pt-2">
                                  <button
                                    onClick={() => {
                                      const firstSelectedResource = allResources.find((resource) =>
                                        selectedResources.has(getResourceSelectionKey(resource))
                                      );
                                      handleCreateNewWorkload(
                                        firstSelectedResource
                                          ? {
                                              profileId: firstSelectedResource.environmentProfileId || '',
                                              name: firstSelectedResource.environmentName || '',
                                              accountId: firstSelectedResource.environmentAccountId || '',
                                            }
                                          : null
                                      );
                                      setTimeout(() => {
                                        const newIdx = editedWorkloads.length;
                                        handleAddSelectedResourcesToWorkload(newIdx);
                                      }, 100);
                                    }}
                                    className="w-full text-left px-3 py-2.5 text-sm rounded hover:bg-blue-50 text-blue-600 font-medium"
                                  >
                                    <Plus className="h-3 w-3 inline mr-1" />
                                    Create New Workload
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                          {showAddToWorkloadDropdown && editedWorkloads.length === 0 && (
                            <div className="absolute right-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                              <div className="p-2">
                                <button
                                  onClick={() => {
                                    const firstSelectedResource = allResources.find((resource) =>
                                      selectedResources.has(getResourceSelectionKey(resource))
                                    );
                                    handleCreateNewWorkload(
                                      firstSelectedResource
                                        ? {
                                            profileId: firstSelectedResource.environmentProfileId || '',
                                            name: firstSelectedResource.environmentName || '',
                                            accountId: firstSelectedResource.environmentAccountId || '',
                                          }
                                        : null
                                    );
                                    setTimeout(() => {
                                      const newIdx = editedWorkloads.length;
                                      handleAddSelectedResourcesToWorkload(newIdx);
                                    }, 100);
                                  }}
                                  className="w-full text-left px-3 py-2.5 text-sm rounded hover:bg-blue-50 text-blue-600 font-medium"
                                >
                                  <Plus className="h-3 w-3 inline mr-1" />
                                  Create New Workload
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto border border-gray-200 rounded-lg">
                      <div className="inline-block min-w-full">
                        <table className="min-w-full divide-y divide-gray-200 text-sm" style={{ minWidth: '1000px' }}>
                          <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                              <th className="w-12 px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  ref={(el) => {
                                    if (el) el.indeterminate = someSelected && !allSelected;
                                  }}
                                  onChange={() => handleToggleAllResources(filteredResources)}
                                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                                Environment
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                                Resource
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                                Service
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                                Resource Type
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                                Tags
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                                Region
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                            {filteredResources.map((resource, idx) => {
                              const isInWorkload = isResourceInWorkload(resource);
                              const resourceKey = getResourceSelectionKey(resource);
                              const isSelected = selectedResources.has(resourceKey);
                              return (
                                <tr
                                  key={`${resource.serviceKey}-${resource.environmentProfileId || 'env'}-${idx}`}
                                  className={`hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${isInWorkload ? 'bg-green-50/30' : ''} ${isSelected ? 'bg-blue-100/50' : ''}`}
                                >
                                  <td className="px-4 py-3">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => handleToggleResourceSelection(resource)}
                                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                      disabled={isInWorkload}
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                                    {resource.environmentName || '—'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1">
                                        <div className="font-medium text-gray-900 max-w-[280px] whitespace-nowrap overflow-hidden text-ellipsis">
                                          {resource.displayName || resource.resourceId}
                                        </div>
                                        <div className="text-xs text-gray-500 break-all mt-0.5">
                                          {resource.resourceId}
                                        </div>
                                        {resource.resourceArn && (
                                          <div className="text-xs text-gray-400 break-all mt-0.5 font-mono">
                                            {resource.resourceArn}
                                          </div>
                                        )}
                                      </div>
                                      {isInWorkload && (
                                        <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">
                                          In Workload
                                        </Badge>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                      {resource.serviceName}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                                    <span className="text-xs font-mono">{resource.resourceType || '—'}</span>
                                  </td>
                                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                                    {(() => {
                                      const tags = (resource.details && resource.details.tags) || {};
                                      const tagCount = Object.keys(tags).length;
                                      if (tagCount === 0) return '—';
                                      return (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="px-2 py-1"
                                          onClick={() =>
                                            setTagViewer({
                                              open: true,
                                              title:
                                                resource.displayName ||
                                                resource.resourceId ||
                                                'Resource',
                                              tags,
                                            })
                                          }
                                        >
                                          {tagCount}
                                        </Button>
                                      );
                                    })()}
                                  </td>
                                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                                    {resource.region || '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div className="text-center text-gray-500 py-8">
                  <p className="text-sm">No scan data available yet.</p>
                  <p className="text-xs mt-2">Scan data will appear here once the scan completes.</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <DialogHeader className="px-6 py-4 border-b bg-white">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">Discover Workloads</DialogTitle>
            <Button variant="ghost" size="sm" onClick={handleModalClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {Object.keys(environmentRuns || {}).length > 0 && (
          <div className="px-6 py-3 border-b bg-gray-50">
            <div className="text-xs font-medium text-gray-700 mb-2">
              Environment Progress
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.values(environmentRuns).map((run) => (
                <Badge
                  key={run.profileId}
                  variant="outline"
                  className={
                    run.status === 'completed'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : run.status === 'error'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }
                >
                  {run.name}:{' '}
                  {run.status === 'completed'
                    ? `Done${run.inventorySource === 'cached' ? ' (cached inventory)' : ''}`
                    : run.status === 'error'
                    ? 'Failed'
                    : 'In progress'}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="px-6 py-3 border-b bg-white">
          <Button
            variant="link"
            size="sm"
            onClick={() => setIsRawScanModalOpen(true)}
            className="h-auto p-0 text-sm"
            disabled={!scanData}
          >
            View raw scan results
            {scanData?.services
              ? ` (${getAllScannedResources().length} resources)`
              : ''}
          </Button>
        </div>

        <div className="flex-1 flex overflow-hidden bg-gray-50">
          {/* Chat Column */}
          {maximizedSection === null || maximizedSection === 'chat' ? (
            <div className={`${maximizedSection === 'chat' ? 'w-full' : 'w-[48%]'} border-r border-gray-200 flex flex-col bg-white shadow-sm transition-all`}>
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-700">Chat</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMaximizedSection(maximizedSection === 'chat' ? null : 'chat')}
                  className="h-7 w-7 p-0"
                >
                  {maximizedSection === 'chat' ? (
                    <Minimize2 className="h-3 w-3" />
                  ) : (
                    <Maximize2 className="h-3 w-3" />
                  )}
                </Button>
              </div>
            <ScrollArea className="flex-1 p-4 bg-white">
              <div className="space-y-3">
                {messages.length === 0 && !isLoading && (
                  <div className="text-center text-gray-400 py-12">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">Start by discovering workloads from your AWS resources.</p>
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2.5 shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-50 text-gray-900 border border-gray-200'
                      }`}
                    >
                      {msg.role !== 'user' && msg.environmentName && (
                        <div className="mb-1">
                          <Badge variant="outline" className="text-[10px] bg-white">
                            {msg.environmentName}
                          </Badge>
                        </div>
                      )}
                      {msg.role === 'user' ? (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
                      ) : (
                        <div className="text-sm prose prose-sm max-w-none">
                          <Markdown options={chatMarkdownOptions}>{msg.content}</Markdown>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {(isScanning || isAnalyzing || isLoading) && scanProgress && (
                  <div className="flex justify-start">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 text-sm text-blue-700">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{scanProgress}</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            <div className="border-t border-gray-200 p-4 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
              <div className="flex gap-2 items-stretch">
                <Textarea
                  ref={chatInputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Provide feedback or ask questions..."
                  className="min-h-[60px] resize-none bg-white border-2 border-gray-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
                  disabled={isLoading || !hasAnySession}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={isLoading || !hasAnySession || (!inputMessage.trim() && !hasUnsavedChanges())}
                  className="h-auto min-h-[60px] px-4"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {!hasAnySession && (
                <p className="text-xs text-gray-400 mt-2">Start a discovery scan to enable chat</p>
              )}
            </div>
            </div>
          ) : null}

          {maximizedSection === null || maximizedSection === 'workloads' ? (
            <div className={`${maximizedSection === 'workloads' ? 'w-full' : 'w-[52%]'} flex flex-col bg-white shadow-sm transition-all`}>
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-700">
                    Discovered Workloads
                    {editedWorkloads.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs font-medium">
                        {editedWorkloads.length}
                      </span>
                    )}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {hasUnsavedChanges() && (
                    <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                      Unsaved changes
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCreateNewWorkload}
                    disabled={!canCreateDraftWorkload}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    New Workload
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMaximizedSection(maximizedSection === 'workloads' ? null : 'workloads')}
                    className="h-7 w-7 p-0"
                  >
                    {maximizedSection === 'workloads' ? (
                      <Minimize2 className="h-3 w-3" />
                    ) : (
                      <Maximize2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1 p-4 bg-gray-50">
                {!canCreateWorkloadFromDiscovery && (
                  <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {creationLimits.workloadLimitMessage}{' '}
                    <a href="/pricing" className="font-medium underline">
                      View plans
                    </a>
                  </div>
                )}
                {editedWorkloads.length === 0 && !isLoading && (
                  <div className="text-center text-gray-400 py-12">
                    <Layers className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No workloads discovered yet.</p>
                  </div>
                )}
                <div className="space-y-3">
                  {editedWorkloads.map((workload, workloadIndex) => {
                    const resourceCount = workload.trackedResources?.resources?.length || 0;
                    const stackCount = workload.trackedResources?.stacks?.length || 0;
                    const totalCount = resourceCount + stackCount;

                    return (
                      <Card
                        key={workloadIndex}
                        className="relative bg-white border border-gray-200 hover:border-primary-300 transition-all"
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start gap-3 pr-8">
                            <div className="flex-1 min-w-0">
                              {workload?.metadata?.environmentName && (
                                <Badge variant="outline" className="mb-2 text-[10px] bg-gray-50">
                                  {workload.metadata.environmentName}
                                </Badge>
                              )}
                              <CardTitle className="text-base font-semibold text-gray-900 mb-2">
                                {workload.name}
                              </CardTitle>
                              <CardDescription className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                                {workload.description || 'No description'}
                              </CardDescription>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteWorkload(workloadIndex);
                            }}
                            className="absolute top-3 right-3 h-6 w-6 p-0 delete-button text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex items-center gap-4 text-sm">
                            {stackCount > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenWorkloadResourcesReview(workloadIndex)}
                                className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded transition-colors hover:bg-blue-100"
                              >
                                <Layers className="h-3 w-3" />
                                <span className="font-medium">{stackCount}</span>
                                <span>stack{stackCount !== 1 ? 's' : ''}</span>
                              </button>
                            )}
                            {resourceCount > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenWorkloadResourcesReview(workloadIndex)}
                                className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 rounded transition-colors hover:bg-green-100"
                              >
                                <Database className="h-3 w-3" />
                                <span className="font-medium">{resourceCount}</span>
                                <span>resource{resourceCount !== 1 ? 's' : ''}</span>
                              </button>
                            )}
                            {totalCount === 0 && (
                              <span className="text-gray-400 text-xs">No resources</span>
                            )}
                          </div>
                          <div className="mt-3 flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenWorkloadWizard(workload, workloadIndex)}
                              disabled={isQuickAdding || !canCreateWorkloadFromDiscovery}
                            >
                              Add with Wizard
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleQuickAddSingleWorkload(workloadIndex)}
                              disabled={isQuickAdding || !canCreateWorkloadFromDiscovery}
                            >
                              Quick add
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="border-t border-gray-200 p-4 flex justify-end gap-2 bg-white">
                <Button
                  onClick={handleQuickAddAllWorkloads}
                  disabled={
                    isLoading ||
                    isQuickAdding ||
                    editedWorkloads.length === 0 ||
                    !canCreateWorkloadFromDiscovery ||
                    (creationLimits.shouldRestrict &&
                      editedWorkloads.length > remainingWorkloadSlots)
                  }
                >
                  {isQuickAdding ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Quick adding...
                    </>
                  ) : (
                    'Quick Add all workloads'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleModalClose}
                  disabled={isLoading || isQuickAdding}
                >
                  Exit
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <Dialog open={tagViewer.open} onOpenChange={(open) => setTagViewer((prev) => ({ ...prev, open }))}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Tags</DialogTitle>
              <DialogDescription className="truncate">{tagViewer.title}</DialogDescription>
            </DialogHeader>
            <div className="max-h-[320px] overflow-y-auto rounded border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Key</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.keys(tagViewer.tags || {}).length === 0 ? (
                    <tr>
                      <td className="px-4 py-3 text-gray-500" colSpan={2}>No tags</td>
                    </tr>
                  ) : (
                    Object.entries(tagViewer.tags).map(([key, value]) => (
                      <tr key={key}>
                        <td className="px-4 py-3 text-gray-700 break-all">{key}</td>
                        <td className="px-4 py-3 text-gray-700 break-all">{String(value)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setTagViewer({ open: false, title: '', tags: {} })}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>

      {/* Workload Detail Modal */}
      {selectedWorkload && (
        <Dialog
          open={selectedWorkloadIndex !== null}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedWorkloadIndex(null);
              setReviewResourceFilter('');
            }
          }}
        >
          <DialogContent className="max-w-[90vw] w-[1400px] max-h-[85vh] min-h-[600px] bg-white overflow-hidden flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  {selectedWorkload?.metadata?.environmentName && (
                    <Badge variant="outline" className="mb-2 text-[10px] bg-gray-50">
                      {selectedWorkload.metadata.environmentName}
                    </Badge>
                  )}
                  <DialogTitle className="text-xl font-semibold">
                    {selectedWorkload.name}
                  </DialogTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedWorkloadIndex(null);
                    setReviewResourceFilter('');
                  }}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>
            <div className="border-b pb-3 mb-3">
              <div
                className={`flex ${
                  editingWorkload === selectedWorkloadIndex && editingField === 'description'
                    ? 'flex-col items-stretch gap-2'
                    : 'items-center gap-3'
                }`}
              >
                {editingWorkload === selectedWorkloadIndex && editingField === 'name' ? (
                  <Input
                    value={selectedWorkload.name}
                    onChange={(e) => handleWorkloadEdit(selectedWorkloadIndex, 'name', e.target.value)}
                    onBlur={() => {
                      setEditingWorkload(null);
                      setEditingField(null);
                    }}
                    className="h-8 text-sm font-medium max-w-xs"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-left hover:text-primary-600 group"
                    onClick={() => {
                      setEditingWorkload(selectedWorkloadIndex);
                      setEditingField('name');
                    }}
                  >
                    <span className="text-sm font-medium text-gray-900">{selectedWorkload.name}</span>
                    <Edit2 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
                {!(editingWorkload === selectedWorkloadIndex && editingField === 'description') && (
                  <span className="text-gray-300">|</span>
                )}
                {editingWorkload === selectedWorkloadIndex && editingField === 'description' ? (
                  <Textarea
                    value={selectedWorkload.description || ''}
                    onChange={(e) =>
                      handleWorkloadEdit(selectedWorkloadIndex, 'description', e.target.value)
                    }
                    onBlur={() => {
                      setEditingWorkload(null);
                      setEditingField(null);
                    }}
                    className="min-h-[96px] w-full resize-none text-sm leading-6"
                    placeholder="Add description..."
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-left hover:text-primary-600 group flex-1 min-w-0"
                    onClick={() => {
                      setEditingWorkload(selectedWorkloadIndex);
                      setEditingField('description');
                    }}
                  >
                    <span className="text-sm text-gray-500 truncate">
                      {selectedWorkload.description || 'No description'}
                    </span>
                    <Edit2 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </button>
                )}
              </div>
            </div>
            <div className={`flex-1 min-h-0 grid gap-5 overflow-hidden ${showAvailableResources ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : 'grid-cols-[auto_minmax(0,1fr)]'}`}>
              <div className={`min-h-0 min-w-0 border rounded-lg bg-white flex flex-col overflow-hidden transition-all duration-200 ${showAvailableResources ? '' : 'w-9'}`}>
                {!showAvailableResources ? (
                  <div className="flex flex-col items-center py-3 h-full">
                    <button
                      type="button"
                      onClick={() => setShowAvailableResources(true)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                      title="Show available resources"
                    >
                      <PanelLeftOpen className="h-4 w-4" />
                    </button>
                    <div className="mt-4 flex-1 flex items-center justify-center">
                      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-widest" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                        Available resources
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                <div className="px-3 py-2.5 border-b bg-gray-50/50 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900">Available scanned resources</div>
                    <div className="text-xs text-gray-500">
                      {selectedWorkload?.metadata?.environmentName || 'Current environment'}
                      {' '}• {scannedResourcesForSelectedWorkload.length} resource(s)
                    </div>
                  </div>
                  <Input
                    type="text"
                    placeholder="Filter..."
                    value={reviewResourceFilter}
                    onChange={(e) => setReviewResourceFilter(e.target.value)}
                    className="h-8 w-36 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAvailableResources(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                    title="Hide available resources"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                </div>
                <ScrollArea className="flex-1 min-h-0 max-w-full">
                  <div className="w-full max-w-full min-w-0 overflow-hidden p-3 space-y-1.5">
                    {filteredScannedResourcesForSelectedWorkload.length === 0 ? (
                      <div className="text-sm text-gray-500 text-center py-6">
                        {scanData
                          ? 'No scanned resources match this filter.'
                          : 'Raw scan results are not available yet.'}
                      </div>
                    ) : (
                      filteredScannedResourcesForSelectedWorkload.map((resource, resourceIndex) => {
                        const alreadyIncluded = resourceExistsInWorkload(selectedWorkload, resource);
                        const displayName =
                          resource.displayName ||
                          resource.resourceId ||
                          resource.resourceArn ||
                          getResourceIdentifier(resource) ||
                          'Unknown resource';
                        const typeInfo = [resource.serviceName, resource.resourceType, resource.region]
                          .filter(Boolean)
                          .join(' • ');
                        const tags = (resource.details && resource.details.tags) || {};
                        const tagCount = Object.keys(tags).length;
                        return (
                          <div
                            key={`${getResourceSelectionKey(resource)}-${resourceIndex}`}
                            className={`rounded-md border px-3 py-2 ${
                              alreadyIncluded
                                ? 'border-green-200 bg-green-50/50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium leading-5 text-gray-900 break-words">
                                  {displayName}
                                </div>
                              </div>
                              {alreadyIncluded ? (
                                <span className="inline-flex flex-shrink-0 items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
                                  Included
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    handleAddResourceToWorkload(selectedWorkloadIndex, resource);
                                  }}
                                  className="inline-flex flex-shrink-0 items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                                  title={`Add ${displayName} to workload`}
                                >
                                  + Add
                                </button>
                              )}
                            </div>
                            <div className="mt-1 min-w-0 flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1 text-xs text-gray-400 truncate" title={typeInfo}>
                                {typeInfo}
                              </div>
                              {tagCount > 0 && (
                                <button
                                  type="button"
                                  className="inline-flex flex-shrink-0 items-center rounded-full border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50"
                                  onClick={() =>
                                    setTagViewer({
                                      open: true,
                                      title: displayName,
                                      tags,
                                    })
                                  }
                                >
                                  {tagCount} tag{tagCount === 1 ? '' : 's'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
                  </>
                )}
              </div>

              <div className="min-h-0 min-w-0 border rounded-lg bg-gray-50 flex flex-col overflow-hidden">
                <div className="px-3 py-2.5 border-b bg-white">
                  <div className="text-sm font-semibold text-gray-900">Included in workload</div>
                  <div className="text-xs text-gray-500">
                    {selectedWorkloadTrackedResources.stacks.length} stack(s) •{' '}
                    {selectedWorkloadTrackedResources.resources.length} resource(s)
                  </div>
                </div>
                <ScrollArea className="flex-1 min-h-0 max-w-full">
                  <div className="w-full max-w-full min-w-0 overflow-hidden space-y-4 p-3">
                    {selectedWorkloadTrackedResources.stacks.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-600 mb-2">
                            <Layers className="h-3.5 w-3.5" />
                            Stacks ({selectedWorkloadTrackedResources.stacks.length})
                          </div>
                          {selectedWorkloadTrackedResources.stacks.map((stack, stackIndex) => (
                            <div
                              key={`stack-${stackIndex}`}
                              className="grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)_2rem] items-center gap-2 overflow-hidden rounded-md border-l-2 border-l-blue-400 bg-blue-50/50 pl-2.5 pr-2 py-1.5"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-gray-900 truncate" title={stack.name || 'Unnamed Stack'}>
                                  {stack.name || 'Unnamed Stack'}
                                </div>
                                {stack.stackId && (
                                  <div className="text-[11px] text-gray-400 truncate" title={stack.stackId}>
                                    {stack.stackId}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                className="ml-auto inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-transparent text-gray-400 hover:border-red-100 hover:bg-red-50 hover:text-red-500 transition-colors"
                                onClick={() => handleResourceRemove(selectedWorkloadIndex, 'stack', stackIndex)}
                                title={`Remove ${stack.name || 'stack'} from workload`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                    {selectedWorkloadTrackedResources.resources.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            <Database className="h-3.5 w-3.5" />
                            Resources ({selectedWorkloadTrackedResources.resources.length})
                          </div>
                          {selectedWorkloadTrackedResources.resources.map((resource, resourceIndex) => (
                            <div
                              key={`resource-${resourceIndex}`}
                              className="grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)_2rem] items-center gap-2 overflow-hidden rounded-md border-l-2 border-l-gray-300 bg-white pl-2.5 pr-2 py-1.5"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-gray-900 truncate" title={resource.displayName || resource.resourceId || resource.resourceArn || 'Unknown resource'}>
                                  {resource.displayName || resource.resourceId || resource.resourceArn || 'Unknown resource'}
                                </div>
                                <div className="text-[11px] text-gray-400 truncate">
                                  {[resource.resourceType, resource.region].filter(Boolean).join(' • ') || 'No metadata'}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="ml-auto inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-transparent text-gray-400 hover:border-red-100 hover:bg-red-50 hover:text-red-500 transition-colors"
                                onClick={() =>
                                  handleResourceRemove(selectedWorkloadIndex, 'resource', resourceIndex)
                                }
                                title={`Remove ${resource.displayName || resource.resourceId || 'resource'} from workload`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                    {selectedWorkloadTrackedResources.resources.length === 0 &&
                      selectedWorkloadTrackedResources.stacks.length === 0 && (
                        <div className="text-center text-gray-400 py-8">
                          No resources or stacks in this workload yet.
                        </div>
                      )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {workloadWizardOpen && (
        <WorkloadCreateWizard
          isOpen={workloadWizardOpen}
          onClose={() => {
            setWorkloadWizardOpen(false);
            setWizardPrefill(null);
            setWizardWorkloadIndex(null);
          }}
          onFinalizeSuccess={() => {
            setCreatedInSessionCount((previous) => previous + 1);
            if (wizardWorkloadIndex !== null) {
              removeDiscoveredWorkloadAtIndex(wizardWorkloadIndex);
            }
          }}
          navigateOnFinalize={false}
          userProfile={userProfile}
          initialPrefill={wizardPrefill}
        />
      )}
    </Dialog>
  );
};

export default DiscoverWorkloadsModal;
