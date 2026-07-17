import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import WorkloadResources from '@/components/Workload/WorkloadResources';
import WorkloadDeliveryCard from '@/components/Workload/WorkloadDeliveryCard';
import WorkloadDiagramCard from '@/components/Workload/WorkloadDiagramCard';
import WorkloadExportModal from '@/components/Workload/WorkloadExportModal';
import DeploymentSettings from '@/components/Workload/DeploymentSettings';
import Govenance from '@/components/Workload/Govenance';
import Architecture from '@/components/Workload/Architecture';
import General from '@/components/Workload/General';
import { ExecutiveSummaryTab, parseSummary } from '@/components/ExecutiveSummary';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Cloud, HeartPulse, CheckCircle2, AlertTriangle, Layers, ChevronDown, RefreshCw, Download } from 'lucide-react';
import { filterCloudEnvironments, getRegionOptions } from '@/helpers/shared';
import toast from 'react-hot-toast';
import {
  createWorkloadDefinition,
  updateWorkloadDefinition,
  updateWorkloadInState,
} from '@/features/workload/workloadSlice';
import { updateSingleWorkloadInUserProfile } from '@/features/auth/authSlice';
import { runPostCreateWorkloadSync } from '@/features/workload/workloadCreationUtils';
import {
  refreshWorkloadHealth,
  selectWorkloadHealthResultsById,
} from '@/features/health/healthSlice';
import SecurityRulesTab from '@/components/SecurityRules/SecurityRulesTab';
import {
  createWorkloadDiagram,
  getWorkloadDiagramSpec,
  saveWorkloadDiagramSpec,
  updateWorkloadDiagramSpecFromInstruction,
} from '@/api/diagrams';
import { buildGitRepo, cleanGitRepo, getGithubConnections } from '@/helpers/github';
import {
  buildWorkloadEnvironmentOptions,
  getAwsAccountIdForWorkloadEnvironment,
  normalizeWorkloadEnvironmentIds,
  resolveWorkloadEnvironmentRef,
} from '@/features/workload/workloadEnvironmentUtils';
import {
  securityPresets,
  securityRulesConfig,
  securityRulesConfigByService,
  createSecurityRulesStructure,
  applySecurityPreset,
  getCategoryRules,
  countUniqueEnabledRules,
  areAllUniqueRulesEnabled,
  allUniqueRuleIds,
} from '@/components/SecurityRules/securityRulesUtils';

const awsRegionOptions = getRegionOptions();

const safeParseJson = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

function WorkloadDetailsPage() {
  const navigate = useNavigate();
  const { workloadId } = useParams();
  const dispatch = useDispatch();
  const userProfile = useSelector((state) => state.auth.userProfile);
  const workloads = useSelector((state) => state.workload.workloads);
  const workloadHealthResultsById = useSelector(selectWorkloadHealthResultsById);
  const [activeTab, setActiveTab] = useState('overview');
  const generalSettingsRef = useRef(null);
  const deploymentConfigRef = useRef(null);
  const deploymentSettingsRef = useRef(null);
  const governanceRef = useRef(null);
  const architecturePrefsRef = useRef(null);
  const securityRulesRef = useRef(null);
  const trackedResourcesRef = useRef(null);
  const workloadHealthHydrationRef = useRef('');

  const workload = useMemo(
    () => workloads.find((w) => w.workloadId === workloadId),
    [workloads, workloadId]
  );
  const githubConnections = useMemo(
    () => getGithubConnections(userProfile),
    [userProfile]
  );
  const permissionProfiles = useMemo(
    () => filterCloudEnvironments(userProfile?.agentPermissionProfiles || []),
    [userProfile]
  );

  const [formData, setFormData] = useState({
    workloadName: workload?.workloadName || '',
    description: workload?.description || '',
    environments: Array.isArray(workload?.environments) ? workload.environments : [],
    deploymentPreferences: {
      method: 'cloudformation',
      changeSet: false,
      changeSetNotifications: {
        email: { enabled: false, address: '' },
        slack: { enabled: false },
      },
      defaultRegions: [],
      requiredTags: [],
      useExistingVPCs: false,
      specifiedVPCs: [],
      resourceRules: {
        allowedResources: {
          allowAll: true,
          allowedList: [],
          deniedList: [],
        },
      },
      gitRepo: null,
      deliveryMethod: null,
      stateSource: null,
      stateBucket: '',
      pipelineConfig: {
        autoDeploy: true,
        requireApproval: false,
        branch: '',
      },
      architecturePreferences: {
        instanceSize: 'No Preference',
        databasePreference: 'No Preference',
        nosqlPreference: 'No Preference',
        staticWebsite: 'No Preference',
        dynamicWebsite: 'No Preference',
      },
    },
    trackedResources: {
      resources: [],
      stacks: [],
    },
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);
  const [isLoadingDiagramSpec, setIsLoadingDiagramSpec] = useState(false);
  const [isUpdatingDiagramFromInstruction, setIsUpdatingDiagramFromInstruction] = useState(false);
  const [diagramSaveInFlight, setDiagramSaveInFlight] = useState(0);
  const [diagramSpec, setDiagramSpec] = useState(null);
  const [diagramGeneratedAtOverride, setDiagramGeneratedAtOverride] = useState(null);
  const [diagramUpdatedAtOverride, setDiagramUpdatedAtOverride] = useState(null);
  const autoGenerateDiagramRef = useRef(null);
  const diagramFetchRequestIdRef = useRef(0);
  const [securityRulesState, setSecurityRulesState] = useState(() =>
    createSecurityRulesStructure()
  );
  const [securityGroupBy, setSecurityGroupBy] = useState('category');
  const [localSummary, setLocalSummary] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const canUseWorkloadDiagramBackend = true;
  
  // Parse workload summary
  const workloadSummary = useMemo(() => {
    if (localSummary) return localSummary;
    return parseSummary(workload?.summary);
  }, [workload?.summary, localSummary]);
  const storedWorkloadHealth = useMemo(() => {
    const analysis =
      workloadSummary?.analysis && typeof workloadSummary.analysis === 'object'
        ? workloadSummary.analysis
        : {};
    return analysis?.health && typeof analysis.health === 'object' ? analysis.health : {};
  }, [workloadSummary]);
  
  const diagramData = useMemo(
    () => safeParseJson(workload?.diagram, workload?.diagram || null),
    [workload?.diagram]
  );
  const diagramGeneratedAt = diagramData?.generatedAt;
  const diagramUpdatedAt = diagramData?.updatedAt;
  const effectiveDiagramGeneratedAt = diagramGeneratedAtOverride || diagramGeneratedAt;
  const effectiveDiagramUpdatedAt = diagramUpdatedAtOverride || diagramUpdatedAt;
  const resolvedWorkloadId = workload?.workloadId || workloadId;
  const workloadHealthResult = workloadHealthResultsById?.[resolvedWorkloadId] || null;
  useEffect(() => {
    const cachedResources = Array.isArray(workloadHealthResult?.resources)
      ? workloadHealthResult.resources
      : [];
    const storedGeneratedAt =
      storedWorkloadHealth?.generatedAt ||
      storedWorkloadHealth?.createdAt ||
      storedWorkloadHealth?.timestamp ||
      '';
    const storedEvaluatedCount = Number(
      storedWorkloadHealth?.summary?.resourceCounts?.evaluated
    );
    const hasStoredHealth =
      Boolean(storedGeneratedAt) ||
      (Number.isFinite(storedEvaluatedCount) && storedEvaluatedCount > 0);

    if (!resolvedWorkloadId || !workload || !hasStoredHealth || cachedResources.length > 0) {
      return;
    }

    const hydrationKey = `${resolvedWorkloadId}:${storedGeneratedAt || storedEvaluatedCount}`;
    if (workloadHealthHydrationRef.current === hydrationKey) return;
    workloadHealthHydrationRef.current = hydrationKey;

    dispatch(
      refreshWorkloadHealth({
        workloadId: resolvedWorkloadId,
        forceRefresh: false,
        bypassLocalCache: true,
      })
    );
  }, [
    dispatch,
    resolvedWorkloadId,
    storedWorkloadHealth,
    workload,
    workloadHealthResult?.resources,
  ]);
  const syncDiagramMetaIntoStore = useCallback(
    (diagramMeta) => {
      const targetWorkloadId = workload?.workloadId || workloadId;
      if (!targetWorkloadId || !diagramMeta) return;
      const nextWorkload = {
        ...(workload || {}),
        workloadId: targetWorkloadId,
        diagram: diagramMeta,
      };
      dispatch(updateWorkloadInState(nextWorkload));
      dispatch(updateSingleWorkloadInUserProfile(nextWorkload));
    },
    [dispatch, workload, workloadId]
  );
  const parseTrackedResources = (
    rawTrackedResources,
    fallback = { resources: [], stacks: [] }
  ) => {
    const parsed = safeParseJson(rawTrackedResources, fallback);
    if (!parsed || typeof parsed !== 'object') {
      return { ...(fallback || {}), resources: [], stacks: [] };
    }
    const normalized = { ...(fallback || {}), ...parsed };
    if (
      Array.isArray(normalized.trackedResources) &&
      !Array.isArray(normalized.resources)
    ) {
      normalized.resources = normalized.trackedResources;
    }
    if (!Array.isArray(normalized.resources)) {
      normalized.resources = [];
    }
    if (!Array.isArray(normalized.stacks)) {
      normalized.stacks = [];
    }
    return normalized;
  };

  const hasTrackedResourceData = (tracked) =>
    (Array.isArray(tracked?.resources) && tracked.resources.length > 0) ||
    (Array.isArray(tracked?.stacks) && tracked.stacks.length > 0);

  const getTrackedResourcesForProviderDetection = useCallback(() => {
    const formTracked = parseTrackedResources(formData?.trackedResources, {
      resources: [],
      stacks: [],
    });
    if (hasTrackedResourceData(formTracked)) {
      return formTracked;
    }
    return parseTrackedResources(workload?.trackedResources, {
      resources: [],
      stacks: [],
    });
  }, [formData?.trackedResources, workload?.trackedResources]);

  const normalizeDiagramCloudProvider = (provider) => {
    const normalized = String(provider || '').trim().toLowerCase();
    if (['aws', 'azure', 'gcp'].includes(normalized)) return normalized;
    return null;
  };

  const detectDiagramCloudProvider = (tracked) => {
    const resources = Array.isArray(tracked?.resources) ? tracked.resources : [];
    const stacks = Array.isArray(tracked?.stacks) ? tracked.stacks : [];
    const explicitProvider = [...resources, ...stacks]
      .map((item) => normalizeDiagramCloudProvider(item?.provider || item?.cloudProvider))
      .find(Boolean);
    if (explicitProvider) return explicitProvider;

    const hasAzureResource = resources.some(
      (resource) =>
        resource?.subscriptionId ||
        String(resource?.resourceId || resource?.id || '')
          .toLowerCase()
          .includes('/subscriptions/')
    );
    const hasAzureStack = stacks.some(
      (stack) =>
        stack?.subscriptionId ||
        String(stack?.resourceId || stack?.id || '')
          .toLowerCase()
          .includes('/subscriptions/')
    );
    if (hasAzureResource || hasAzureStack) return 'azure';

    const hasAwsResource = resources.some(
      (resource) =>
        String(resource?.arn || resource?.resourceId || resource?.id || '')
          .toLowerCase()
          .startsWith('arn:aws:') ||
        String(resource?.type || '').startsWith('AWS::') ||
        Boolean(resource?.accountId)
    );
    const hasAwsStack = stacks.some(
      (stack) =>
        String(stack?.arn || stack?.stackId || stack?.resourceId || stack?.id || '')
          .toLowerCase()
          .startsWith('arn:aws:') ||
        Boolean(stack?.accountId)
    );
    if (hasAwsResource || hasAwsStack) return 'aws';

    return null;
  };

  const getDiagramCloudProvider = useCallback(() => {
    return detectDiagramCloudProvider(getTrackedResourcesForProviderDetection());
  }, [getTrackedResourcesForProviderDetection]);

  const isAzureWorkload = useMemo(() => {
    return detectDiagramCloudProvider(getTrackedResourcesForProviderDetection()) === 'azure';
  }, [getTrackedResourcesForProviderDetection]);

  useEffect(() => {
    if (isAzureWorkload && activeTab === 'configuration') {
      setActiveTab('overview');
    }
  }, [activeTab, isAzureWorkload]);

  const sanitizeStackEntries = (stacksInput) => {
    if (!Array.isArray(stacksInput)) return [];
    return stacksInput
      .filter(
        (stack) => stack && stack.stackId && String(stack.stackId).trim() !== ''
      )
      .map((stack) => ({
        stackId: String(stack.stackId).trim(),
        name: stack.name || '',
        description: stack.description || '',
        region: stack.region || '',
        accountId: stack.accountId || '',
      }));
  };

  const getTrackedStacks = (
    trackedResourcesObj,
    deploymentPreferencesObj = {}
  ) => {
    if (
      Array.isArray(trackedResourcesObj?.stacks) &&
      trackedResourcesObj.stacks.length > 0
    ) {
      return trackedResourcesObj.stacks;
    }
    if (Array.isArray(deploymentPreferencesObj?.stacks)) {
      return deploymentPreferencesObj.stacks;
    }
    return [];
  };

  const normalizeDeploymentPreferences = (raw, trackedResourcesRaw) => {
    // Defaults
    const defaults = {
      method: 'cloudformation',
      changeSet: false,
      changeSetNotifications: {
        email: { enabled: false, address: '' },
        slack: { enabled: false },
      },
      defaultRegions: [],
      requiredTags: [],
      useExistingVPCs: false,
      specifiedVPCs: [],
      resourceRules: {
        allowedResources: {
          allowAll: true,
          allowedList: [],
          deniedList: [],
        },
      },
      gitRepo: null,
      pipelineConfig: {
        autoDeploy: true,
        requireApproval: false,
        branch: '',
      },
      architecturePreferences: {
        instanceSize: 'No Preference',
        databasePreference: 'No Preference',
        nosqlPreference: 'No Preference',
        staticWebsite: 'No Preference',
        dynamicWebsite: 'No Preference',
      },
    };

    const pref = { ...(raw || {}) };
    const trackedResources = parseTrackedResources(trackedResourcesRaw, {
      resources: [],
      stacks: [],
    });

    // Backward compat
    if (pref.deploymentType !== undefined && pref.changeSet === undefined) {
      pref.changeSet = pref.deploymentType === 'changeset';
      delete pref.deploymentType;
    }
    if (typeof pref.changeSet === 'string') {
      pref.changeSet = pref.changeSet === 'changeset';
    }
    if (pref.notifications && !pref.changeSetNotifications) {
      pref.changeSetNotifications = pref.notifications;
      delete pref.notifications;
    }
 
    // Ensure shapes
    const stacks = getTrackedStacks(trackedResources, pref);
    const defaultRegions = Array.isArray(pref.defaultRegions) ? pref.defaultRegions : [];
    const requiredTags = Array.isArray(pref.requiredTags) ? pref.requiredTags : [];
    const specifiedVPCs = Array.isArray(pref.specifiedVPCs) ? pref.specifiedVPCs : [];
    const resourceRules = pref.resourceRules || defaults.resourceRules;
    const architecturePreferences = {
      ...defaults.architecturePreferences,
      ...(pref.architecturePreferences || {}),
    };

    return {
      method: pref.method || defaults.method,
      changeSet: pref.changeSet !== undefined ? pref.changeSet : defaults.changeSet,
      changeSetNotifications: {
        email: {
          enabled: !!pref.changeSetNotifications?.email?.enabled,
          address: pref.changeSetNotifications?.email?.address || '',
        },
        slack: {
          enabled: !!pref.changeSetNotifications?.slack?.enabled,
        },
      },
      defaultRegions,
      requiredTags,
      useExistingVPCs: !!pref.useExistingVPCs,
      specifiedVPCs,
      resourceRules,
      gitRepo: buildGitRepo(pref.gitRepo),
      deliveryMethod: pref.deliveryMethod || null,
      stateSource: pref.stateSource || null,
      stateBucket: pref.stateBucket || '',
      pipelineConfig: pref.pipelineConfig || {
        autoDeploy: true,
        requireApproval: false,
        branch: '',
      },
      architecturePreferences,
    };
  };

  useEffect(() => {
    if (!workload) {
      setSecurityRulesState(createSecurityRulesStructure());
      return;
    }
    const parsedPrefs = safeParseJson(workload.deploymentPreferences, {});
    const parsedTrackedResources = parseTrackedResources(
      workload.trackedResources,
      { resources: [], stacks: [] }
    );
    const normalizedTrackedResources = {
      ...parsedTrackedResources,
      stacks: sanitizeStackEntries(
        getTrackedStacks(parsedTrackedResources, parsedPrefs)
      ),
    };
    const normalizedPrefs = normalizeDeploymentPreferences(
      parsedPrefs,
      normalizedTrackedResources
    );

    setFormData({
      workloadName: workload.workloadName || '',
      description: workload.description || '',
      environments: Array.isArray(workload.environments) ? workload.environments : [],
      deploymentPreferences: normalizedPrefs,
      trackedResources: normalizedTrackedResources,
    });
    const parsedSecurity = safeParseJson(workload.securityRules, {});
    setSecurityRulesState(createSecurityRulesStructure(parsedSecurity));
    setSecurityGroupBy('category');
  }, [workload]);

  useEffect(() => {
    diagramFetchRequestIdRef.current += 1;
    setDiagramSpec(null);
    setDiagramGeneratedAtOverride(null);
    setDiagramUpdatedAtOverride(null);
    setDiagramSaveInFlight(0);
    autoGenerateDiagramRef.current = null;
  }, [resolvedWorkloadId]);

  const fetchDiagramSpec = useCallback(
    async ({ silent, maxAttempts = 4 } = {}) => {
      if (!canUseWorkloadDiagramBackend) {
        return;
      }
      if (
        (!effectiveDiagramGeneratedAt && !effectiveDiagramUpdatedAt) ||
        !resolvedWorkloadId
      ) {
        return;
      }
      const requestId = diagramFetchRequestIdRef.current + 1;
      diagramFetchRequestIdRef.current = requestId;
      setIsLoadingDiagramSpec(true);
      let lastError = null;
      try {
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          try {
            const response = await getWorkloadDiagramSpec(resolvedWorkloadId);
            const nextSpec =
              response && typeof response === 'object' ? response.spec || null : null;

            if (diagramFetchRequestIdRef.current !== requestId) {
              return;
            }

            if (nextSpec) {
              setDiagramSpec(nextSpec);
              if (response?.diagram) {
                syncDiagramMetaIntoStore(response.diagram);
              }
              const nextGeneratedAt =
                response?.diagram?.generatedAt ||
                response?.generatedAt ||
                null;
              const nextUpdatedAt =
                response?.diagram?.updatedAt ||
                response?.updatedAt ||
                null;
              if (nextGeneratedAt) {
                setDiagramGeneratedAtOverride(nextGeneratedAt);
              }
              if (nextUpdatedAt) {
                setDiagramUpdatedAtOverride(nextUpdatedAt);
              }
              return;
            }

            lastError = new Error('Diagram spec response did not include a spec payload.');
            console.warn('Diagram spec fetch returned no spec payload', {
              workloadId: resolvedWorkloadId,
              attempt: attempt + 1,
              response,
            });
          } catch (error) {
            lastError = error;
            console.error('Failed to fetch diagram spec', {
              workloadId: resolvedWorkloadId,
              attempt: attempt + 1,
              error,
            });
          }

          if (attempt < maxAttempts - 1) {
            await new Promise((resolve) => {
              window.setTimeout(resolve, 600 * (attempt + 1));
            });
          }
        }
        if (diagramFetchRequestIdRef.current !== requestId) {
          return;
        }
        setDiagramSpec((prev) => prev);
        if (!silent) {
          toast.error(lastError?.message || 'Failed to load diagram.');
        }
      } finally {
        if (diagramFetchRequestIdRef.current === requestId) {
          setIsLoadingDiagramSpec(false);
        }
      }
    },
    [
      effectiveDiagramGeneratedAt,
      effectiveDiagramUpdatedAt,
      canUseWorkloadDiagramBackend,
      resolvedWorkloadId,
      syncDiagramMetaIntoStore,
    ]
  );

  useEffect(() => {
    if (!canUseWorkloadDiagramBackend) {
      return;
    }
    if (!effectiveDiagramGeneratedAt && !effectiveDiagramUpdatedAt) {
      return;
    }
    if (diagramSpec) {
      return;
    }
    fetchDiagramSpec({ silent: true });
  }, [
    canUseWorkloadDiagramBackend,
    diagramSpec,
    effectiveDiagramGeneratedAt,
    effectiveDiagramUpdatedAt,
    fetchDiagramSpec,
  ]);

  const prepareWorkloadData = (data) => {
    const deploymentPreferences = data?.deploymentPreferences || {};
    // Preserve tracked resources already saved on workload so Save doesn't clear it
    const persistedTrackedResources = parseTrackedResources(
      workload?.trackedResources,
      { resources: [], stacks: [] }
    );
    const trackedResourcesInput = parseTrackedResources(
      data?.trackedResources,
      persistedTrackedResources
    );
    const cleanStacks = sanitizeStackEntries(
      getTrackedStacks(trackedResourcesInput, deploymentPreferences)
    );
    const cleanRequiredTags = Array.isArray(deploymentPreferences.requiredTags)
      ? deploymentPreferences.requiredTags
          .filter((t) => t && typeof t === 'object' && (t.key || '').trim() !== '')
          .map((t) => ({
            key: (t.key || '').trim(),
            value: (t.value || '').trim(),
            notes: (t.notes || '').trim(),
          }))
      : [];

    const result = {
      workloadName: data.workloadName || '',
      description: data.description || '',
      environments: normalizeWorkloadEnvironmentIds(
        Array.isArray(data.environments) ? data.environments : [],
        permissionProfiles
      ),
      deploymentPreferences: {
        method: deploymentPreferences.method || 'cloudformation',
        changeSet: deploymentPreferences.changeSet,
        changeSetNotifications:
          deploymentPreferences.changeSetNotifications || {
            email: { enabled: false, address: '' },
            slack: { enabled: false },
          },
        defaultRegions: deploymentPreferences.defaultRegions || [],
        requiredTags: cleanRequiredTags,
        useExistingVPCs: !!deploymentPreferences.useExistingVPCs,
        specifiedVPCs: deploymentPreferences.specifiedVPCs || [],
        resourceRules:
          deploymentPreferences.resourceRules || {
            allowedResources: {
              allowAll: true,
              allowedList: [],
              deniedList: [],
            },
          },
        gitRepo: cleanGitRepo(deploymentPreferences.gitRepo),
        deliveryMethod: deploymentPreferences.deliveryMethod || null,
        stateSource: deploymentPreferences.stateSource || null,
        stateBucket: deploymentPreferences.stateBucket || '',
        pipelineConfig: deploymentPreferences.pipelineConfig || {
          autoDeploy: true,
          requireApproval: false,
          branch: '',
        },
        architecturePreferences: {
          instanceSize: deploymentPreferences.architecturePreferences?.instanceSize || 'No Preference',
          databasePreference: deploymentPreferences.architecturePreferences?.databasePreference || 'No Preference',
          nosqlPreference: deploymentPreferences.architecturePreferences?.nosqlPreference || 'No Preference',
          staticWebsite: deploymentPreferences.architecturePreferences?.staticWebsite || 'No Preference',
          dynamicWebsite: deploymentPreferences.architecturePreferences?.dynamicWebsite || 'No Preference',
        },
      },
      securityRules: securityRulesState || createSecurityRulesStructure(),
      trackedResources: {
        ...trackedResourcesInput,
        stacks: cleanStacks,
      },
    };
    return result;
  };

  const saveWorkloadData = async (data, { silent = false } = {}) => {
    if (!data?.workloadName || data.workloadName.trim() === '') {
      if (!silent) toast.error('Workload name is required');
      throw new Error('Workload name is required');
    }
    if (!data.description || data.description.trim() === '') {
      if (!silent) toast.error('Description is required');
      throw new Error('Description is required');
    }
    if (!Array.isArray(data.environments) || data.environments.length === 0) {
      if (!silent) toast.error('Please select at least one environment');
      throw new Error('At least one environment is required');
    }
    setIsSaving(true);
    try {
      const cleanData = prepareWorkloadData(data);
      if (workload && workload.workloadId) {
        try {
          const resourcesCount = Array.isArray(cleanData?.trackedResources?.resources)
            ? cleanData.trackedResources.resources.length
            : 0;
          const stacksCount = Array.isArray(cleanData?.trackedResources?.stacks)
            ? cleanData.trackedResources.stacks.length
            : 0;
          console.info('[WorkloadDetails.saveWorkloadData] Saving workload via updateWorkloadDefinition', {
            workloadId: workload.workloadId,
            resourcesCount,
            stacksCount,
          });
        } catch (_) {
          // ignore logging failures
        }
        await dispatch(updateWorkloadDefinition({ workloadId: workload.workloadId, ...cleanData })).unwrap();
        if (!silent) {
          toast.success(`Workload "${data.workloadName}" updated successfully!`);
        }
      } else {
        const createdWorkload = await dispatch(createWorkloadDefinition(cleanData)).unwrap();
        const syncResult = await runPostCreateWorkloadSync({
          dispatch,
          workloads: [createdWorkload],
        });
        if (!silent) {
          toast.success(`Workload "${data.workloadName}" created successfully!`);
          if (
            syncResult.healthResults.some((item) => !item.success) ||
            syncResult.summaryResults.some((item) => !item.success)
          ) {
            toast.error(
              'Workload was created, but some health or summary data could not be refreshed.'
            );
          }
        }
        navigate(-1);
      }
    } catch (e) {
      if (!silent) {
        toast.error(e?.message || 'Failed to save workload. Please try again.');
      }
      throw e;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    await saveWorkloadData(formData);
  };

  const handleAutoSave = async (nextData) => {
    await saveWorkloadData(nextData, { silent: true });
  };

  const handleGenerateDiagram = useCallback(
    async ({ forceRefresh, silent = false } = {}) => {
      if (!canUseWorkloadDiagramBackend) {
        if (!silent) {
          toast.error('Diagram generation is not available.');
        }
        return;
      }
      const targetWorkloadId = workload?.workloadId || workloadId;
      if (!targetWorkloadId) {
        if (!silent) {
          toast.error('Workload ID is required to generate a diagram.');
        }
        return;
      }

      setIsGeneratingDiagram(true);
      try {
        const response = await createWorkloadDiagram({
          workloadId: targetWorkloadId,
          cloudProvider: getDiagramCloudProvider(),
          excludeTypes: ['AWS::IAM::Role'],
          stylePreset: 'dark-minimal',
          forceRefresh: typeof forceRefresh === 'boolean' ? forceRefresh : false,
        });

        const responseMessage =
          (response && (response.message || response.status)) ||
          (response && response.diagramId
            ? `Diagram request submitted (${response.diagramId})`
            : null);
        if (!silent) {
          toast.success(
            typeof responseMessage === 'string' && responseMessage.trim() !== ''
              ? responseMessage
              : 'Diagram generation started'
          );
        }
        if (response?.spec) {
          setDiagramSpec(response.spec);
        }
        if (response?.diagram) {
          syncDiagramMetaIntoStore(response.diagram);
        }
        const nextGeneratedAt =
          response?.diagram?.generatedAt ||
          response?.generatedAt ||
          response?.generated_at ||
          response?.updatedAt ||
          response?.createdAt ||
          new Date().toISOString();
        const nextUpdatedAt =
          response?.diagram?.updatedAt ||
          response?.updatedAt ||
          nextGeneratedAt;
        setDiagramGeneratedAtOverride(nextGeneratedAt);
        setDiagramUpdatedAtOverride(nextUpdatedAt);

        try {
          const persistedResponse = await getWorkloadDiagramSpec(targetWorkloadId);
          if (persistedResponse?.spec) {
            setDiagramSpec(persistedResponse.spec);
          }
          if (persistedResponse?.diagram) {
            syncDiagramMetaIntoStore(persistedResponse.diagram);
            if (persistedResponse.diagram.generatedAt) {
              setDiagramGeneratedAtOverride(persistedResponse.diagram.generatedAt);
            }
            if (persistedResponse.diagram.updatedAt) {
              setDiagramUpdatedAtOverride(persistedResponse.diagram.updatedAt);
            }
          }
        } catch (persistedError) {
          console.warn('Failed to reload persisted diagram spec after generation', persistedError);
        }
      } catch (error) {
        console.error('Failed to generate diagram', error);
        if (!silent) {
          toast.error(error?.message || 'Failed to generate diagram.');
        }
      } finally {
        setIsGeneratingDiagram(false);
      }
    },
    [
      canUseWorkloadDiagramBackend,
      getDiagramCloudProvider,
      syncDiagramMetaIntoStore,
      workload?.workloadId,
      workloadId,
    ]
  );

  const handleRefreshDiagram = async () => {
    await handleGenerateDiagram({ forceRefresh: true });
  };

  const handleApplyDiagramInstruction = useCallback(
    async (instruction) => {
      if (!canUseWorkloadDiagramBackend) {
        toast.error('AI diagram updates are not available.');
        return;
      }
      const targetWorkloadId = workload?.workloadId || workloadId;
      if (!targetWorkloadId) {
        toast.error('Workload ID is required to update a diagram.');
        return;
      }
      if (!instruction || instruction.trim() === '') {
        toast.error('Describe the diagram update you want.');
        return;
      }

      setIsUpdatingDiagramFromInstruction(true);
      try {
        const response = await updateWorkloadDiagramSpecFromInstruction(
          targetWorkloadId,
          instruction
        );
        if (response?.spec) {
          setDiagramSpec(response.spec);
        }
        if (response?.diagram) {
          syncDiagramMetaIntoStore(response.diagram);
          if (response.diagram.generatedAt) {
            setDiagramGeneratedAtOverride(response.diagram.generatedAt);
          }
          if (response.diagram.updatedAt) {
            setDiagramUpdatedAtOverride(response.diagram.updatedAt);
          }
        }
        toast.success(response?.message || 'Diagram updated.');
      } catch (error) {
        console.error('Failed to update diagram from instruction', error);
        toast.error(error?.message || 'Failed to update diagram.');
        throw error;
      } finally {
        setIsUpdatingDiagramFromInstruction(false);
      }
    },
    [
      canUseWorkloadDiagramBackend,
      syncDiagramMetaIntoStore,
      workload?.workloadId,
      workloadId,
    ]
  );

  useEffect(() => {
    if (!canUseWorkloadDiagramBackend) return;
    const targetWorkloadId = workload?.workloadId || workloadId;
    if (!targetWorkloadId || !workload) return;
    if (diagramSpec || effectiveDiagramGeneratedAt || effectiveDiagramUpdatedAt) return;
    if (isGeneratingDiagram || isLoadingDiagramSpec) return;
    if (autoGenerateDiagramRef.current === targetWorkloadId) return;

    autoGenerateDiagramRef.current = targetWorkloadId;
    handleGenerateDiagram({ silent: true });
  }, [
    diagramSpec,
    effectiveDiagramGeneratedAt,
    effectiveDiagramUpdatedAt,
    handleGenerateDiagram,
    canUseWorkloadDiagramBackend,
    isGeneratingDiagram,
    isLoadingDiagramSpec,
    workload,
    workloadId,
  ]);

  const handleSaveDiagramLayout = useCallback(
    async (nextSpec) => {
      if (!canUseWorkloadDiagramBackend) {
        return;
      }
      const targetWorkloadId = workload?.workloadId || workloadId;
      if (!targetWorkloadId || !nextSpec) return;

      setDiagramSaveInFlight((count) => count + 1);
      try {
        const response = await saveWorkloadDiagramSpec(targetWorkloadId, nextSpec);
        if (response?.diagram) {
          syncDiagramMetaIntoStore(response.diagram);
        }
        const nextUpdatedAt =
          response?.diagram?.updatedAt ||
          response?.updatedAt ||
          new Date().toISOString();
        setDiagramUpdatedAtOverride(nextUpdatedAt);
      } catch (error) {
        console.error('Failed to save diagram layout', error);
        toast.error(error?.message || 'Failed to save diagram layout.');
        throw error;
      } finally {
        setDiagramSaveInFlight((count) => Math.max(0, count - 1));
      }
    },
    [
      canUseWorkloadDiagramBackend,
      syncDiagramMetaIntoStore,
      workload?.workloadId,
      workloadId,
    ]
  );

  const applyPreset = (presetName) => {
    const presets = {
      'Production App/Environment': {
        instanceSize: 'Large',
        databasePreference: 'Aurora',
        nosqlPreference: 'DynamoDB',
        staticWebsite: 'Cloudfront + S3',
        dynamicWebsite: 'ECS + ALB',
      },
      'Sandbox/Testing': {
        instanceSize: 'Small',
        databasePreference: 'MySQL',
        nosqlPreference: 'No Preference',
        staticWebsite: 'Amplify',
        dynamicWebsite: 'EC2 + ALB',
      },
    };
    const preset = presets[presetName];
    if (preset) {
      setFormData((prev) => ({
        ...prev,
        deploymentPreferences: {
          ...prev.deploymentPreferences,
          architecturePreferences: {
            ...prev.deploymentPreferences.architecturePreferences,
            ...preset,
          },
        },
      }));
    }
  };

  const totalSecurityRuleCount = allUniqueRuleIds.size;
  const enabledSecurityRuleCount = countUniqueEnabledRules(securityRulesState || {});
  const allSecurityRulesEnabled = areAllUniqueRulesEnabled(securityRulesState || {});

  const handleApplySecurityPreset = (presetKey) => {
    setSecurityRulesState((prev) =>
      applySecurityPreset(presetKey, prev || createSecurityRulesStructure())
    );
  };

  const handleSecurityGroupByChange = (value) => {
    setSecurityGroupBy(value);
  };

  const handleToggleAllSecurityRules = () => {
    setSecurityRulesState((prev) => {
      if (!prev) return prev;
      const shouldEnable = !areAllUniqueRulesEnabled(prev);
      const next = {
        categories: { ...prev.categories },
        rules: { ...prev.rules },
      };
      Object.keys(next.rules).forEach((id) => {
        next.rules[id] = { ...(next.rules[id] || {}), enabled: shouldEnable };
      });
      Object.keys(next.categories).forEach((categoryKey) => {
        const ids = getCategoryRules(categoryKey);
        const all = ids.length > 0 && ids.every((id) => next.rules[id]?.enabled === true);
        next.categories[categoryKey] = {
          ...(next.categories[categoryKey] || {}),
          enable_all: all,
        };
      });
      return next;
    });
  };

  const handleToggleSecurityCategory = (categoryKey, checked) => {
    setSecurityRulesState((prev) => {
      if (!prev) return prev;
      const next = {
        categories: { ...prev.categories },
        rules: { ...prev.rules },
      };
      const ids = getCategoryRules(categoryKey);
      ids.forEach((id) => {
        next.rules[id] = { ...(next.rules[id] || {}), enabled: checked };
      });
      if (next.categories[categoryKey]) {
        next.categories[categoryKey] = {
          ...next.categories[categoryKey],
          enable_all: checked,
        };
      }
      return next;
    });
  };

  const handleToggleSecurityCategoryExpand = (categoryKey) => {
    setSecurityRulesState((prev) => {
      if (!prev) return prev;
      const next = {
        categories: { ...prev.categories },
        rules: { ...prev.rules },
      };
      if (next.categories[categoryKey]) {
        next.categories[categoryKey] = {
          ...next.categories[categoryKey],
          _expanded: !next.categories[categoryKey]._expanded,
        };
      }
      return next;
    });
  };

  const handleToggleSecurityRule = (categoryKey, ruleKey, checked) => {
    setSecurityRulesState((prev) => {
      if (!prev) return prev;
      const next = {
        categories: { ...prev.categories },
        rules: {
          ...prev.rules,
          [ruleKey]: { ...(prev.rules?.[ruleKey] || {}), enabled: checked },
        },
      };
      const ids = getCategoryRules(categoryKey);
      const all = ids.length > 0 && ids.every((id) =>
        id === ruleKey ? checked : next.rules[id]?.enabled === true
      );
      if (next.categories[categoryKey]) {
        next.categories[categoryKey] = {
          ...next.categories[categoryKey],
          enable_all: all,
        };
      }
      return next;
    });
  };

  const onClose = () => navigate(-1);

  // Compute summary data for overview cards
  const getEnvironmentDisplay = useCallback(
    (accountId) => {
      if (!accountId || accountId === 'unassigned') return 'Unassigned';
      const permission = permissionProfiles.find(
        (profile) => getAwsAccountIdForWorkloadEnvironment(profile?.recordId, permissionProfiles) === accountId
      );

      if (permission) {
        return `${permission.name} (${accountId})`;
      }

      return accountId;
    },
    [permissionProfiles]
  );

  const environmentOptions = useMemo(() => {
    return buildWorkloadEnvironmentOptions(permissionProfiles);
  }, [permissionProfiles]);

  const resourceInventory = useMemo(() => {
    return Array.isArray(formData.trackedResources?.resources)
      ? formData.trackedResources.resources
      : [];
  }, [formData.trackedResources?.resources]);

  const hasEvaluatedResourceHealth = useCallback((resources = []) => (
    (Array.isArray(resources) ? resources : []).some((resource) => {
      const health = resource?.health || resource;
      const checks = Array.isArray(health?.checks) ? health.checks : [];
      const errors = Array.isArray(health?.errors) ? health.errors : [];
      return checks.length > 0 || errors.length > 0;
    })
  ), []);

  const normalizeResourceHealthForDisplay = useCallback((resource) => {
    if (!resource || typeof resource !== 'object') {
      return resource;
    }

    const existingHealth =
      resource.health && typeof resource.health === 'object'
        ? resource.health
        : {};
    const topLevelChecks = Array.isArray(resource.checks) ? resource.checks : [];
    const topLevelErrors = Array.isArray(resource.errors) ? resource.errors : [];
    const nestedChecks = Array.isArray(existingHealth.checks) ? existingHealth.checks : [];
    const nestedErrors = Array.isArray(existingHealth.errors) ? existingHealth.errors : [];
    const hasNestedHealth = Object.keys(existingHealth).length > 0;

    if (!hasNestedHealth && topLevelChecks.length === 0 && topLevelErrors.length === 0) {
      return resource;
    }

    return {
      ...resource,
      health: {
        ...existingHealth,
        checks: nestedChecks.length > 0 || topLevelChecks.length === 0
          ? nestedChecks
          : topLevelChecks,
        errors: nestedErrors.length > 0 || topLevelErrors.length === 0
          ? nestedErrors
          : topLevelErrors,
        generatedAt:
          existingHealth.generatedAt ||
          resource.generatedAt ||
          workloadHealthResult?.generatedAt ||
          workloadHealthResult?.updatedAt ||
          '',
        permissionProfileId:
          existingHealth.permissionProfileId ||
          resource.permissionProfileId ||
          resource.environmentProfileId ||
          '',
        targetKey:
          existingHealth.targetKey ||
          resource.targetKey ||
          resource.resourceArn ||
          resource.resourceId ||
          resource.id ||
          '',
      },
    };
  }, [workloadHealthResult?.generatedAt, workloadHealthResult?.updatedAt]);

  const effectiveResourceInventory = useMemo(() => {
    const normalizedInventory = resourceInventory.map(normalizeResourceHealthForDisplay);

    if (hasEvaluatedResourceHealth(normalizedInventory)) {
      return normalizedInventory;
    }

    const cachedResources = Array.isArray(workloadHealthResult?.resources)
      ? workloadHealthResult.resources
      : [];
    const normalizedCachedResources = cachedResources.map(normalizeResourceHealthForDisplay);

    return hasEvaluatedResourceHealth(normalizedCachedResources)
      ? normalizedCachedResources
      : normalizedInventory;
  }, [
    hasEvaluatedResourceHealth,
    normalizeResourceHealthForDisplay,
    resourceInventory,
    workloadHealthResult?.resources,
  ]);

  const effectiveFormData = useMemo(() => {
    return {
      ...formData,
      trackedResources: {
        ...(formData.trackedResources || {}),
        resources: effectiveResourceInventory,
      },
    };
  }, [effectiveResourceInventory, formData]);

  const resourceSummary = useMemo(() => {
    const counts = effectiveResourceInventory.reduce((acc, resource) => {
      const key = resource.resourceType || 'Other';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).map(([type, count]) => ({
      type,
      count,
    }));
  }, [effectiveResourceInventory]);

  const environmentSummary = useMemo(() => {
    const map = new Map();

    effectiveResourceInventory.forEach((resource) => {
      const accountKey = resource.accountId || 'unassigned';
      const entry = map.get(accountKey) || {
        accountId: accountKey,
        label: getEnvironmentDisplay(resource.accountId),
        count: 0,
      };
      entry.count += 1;
      map.set(accountKey, entry);
    });

    return Array.from(map.values());
  }, [effectiveResourceInventory, getEnvironmentDisplay]);

  const totalResourceCount = effectiveResourceInventory.length;
  const trackedStacksCount = useMemo(
    () =>
      Array.isArray(formData.trackedResources?.stacks)
        ? formData.trackedResources.stacks.length
        : 0,
    [formData.trackedResources?.stacks]
  );

  const resourceTypeCount = resourceSummary.length;

  const resourceHealthTotals = useMemo(() => {
    const normalizeHealthStatus = (status) =>
      typeof status === 'string'
        ? status.toLowerCase() === 'healthy'
          ? 'healthy'
          : status.toLowerCase() === 'not_applicable'
            ? 'not_applicable'
          : status.toLowerCase() === 'problem' || status.toLowerCase() === 'error'
            ? 'unhealthy'
            : 'unknown'
        : 'unknown';
    const isNotApplicableHealthMessage = (errorText) =>
      typeof errorText === 'string' &&
      errorText.trim().toLowerCase() === 'no health checks were returned for this resource.';
    const isSkippedError = (errorText) => {
      if (typeof errorText !== 'string') return false;
      const lower = errorText.toLowerCase();
      return lower.includes('not implemented') || lower.includes('not supported');
    };
    const isResourceHealthNotApplicable = (resource) => {
      const health = resource?.health || {};
      if (health?.notApplicable === true) return true;
      const errors = Array.isArray(health?.errors) ? health.errors : [];
      return errors.some((errorText) => isNotApplicableHealthMessage(errorText));
    };

    const totals = effectiveResourceInventory.reduce(
      (acc, resource) => {
        const checks = Array.isArray(resource?.health?.checks)
          ? resource.health.checks
          : [];
        const resourceErrors = Array.isArray(resource?.health?.errors)
          ? resource.health.errors
          : [];
        const isNotApplicable = isResourceHealthNotApplicable(resource);
        const skippedErrors = resourceErrors.filter(isSkippedError);
        const realErrors = resourceErrors.filter(
          (errorText) =>
            !isSkippedError(errorText) && !isNotApplicableHealthMessage(errorText)
        );

        if (isNotApplicable) {
          acc.resourcesNotApplicable += 1;
          return acc;
        }

        if (checks.length === 0 && skippedErrors.length > 0 && realErrors.length === 0) {
          acc.resourcesSkipped += 1;
          return acc;
        }

        if (checks.length === 0 && resourceErrors.length === 0) {
          return acc;
        }

        const checkStatuses = checks.map((check) => normalizeHealthStatus(check?.status));
        const healthyChecks = checkStatuses.filter((status) => status === 'healthy').length;
        const unhealthyChecks = checkStatuses.filter((status) => status === 'unhealthy').length;
        const notApplicableChecks = checkStatuses.filter(
          (status) => status === 'not_applicable'
        ).length;
        const hasEvaluatedCheck = healthyChecks > 0 || unhealthyChecks > 0;
        const hasIssue = unhealthyChecks > 0 || realErrors.length > 0;

        if (!hasEvaluatedCheck && realErrors.length === 0) {
          if (notApplicableChecks > 0 && notApplicableChecks === checks.length) {
            acc.resourcesNotApplicable += 1;
          }
          return acc;
        }

        acc.resourcesWithChecks += 1;
        acc.passedChecks += healthyChecks;
        acc.failedChecks += unhealthyChecks + realErrors.length;

        if (hasIssue) {
          acc.resourcesWithIssues += 1;
        }

        return acc;
      },
      {
        passedChecks: 0,
        failedChecks: 0,
        resourcesWithChecks: 0,
        resourcesWithIssues: 0,
        resourcesNotApplicable: 0,
        resourcesSkipped: 0,
      }
    );

    if (totals.resourcesWithChecks > 0) {
      return totals;
    }

    const summaryCounts =
      storedWorkloadHealth?.summary?.resourceCounts &&
      typeof storedWorkloadHealth.summary.resourceCounts === 'object'
        ? storedWorkloadHealth.summary.resourceCounts
        : null;
    const evaluated = Number(summaryCounts?.evaluated);
    if (Number.isFinite(evaluated) && evaluated > 0) {
      const issues = Number(summaryCounts?.issues);
      const healthy = Number(summaryCounts?.healthy);
      return {
        ...totals,
        resourcesWithChecks: evaluated,
        resourcesWithIssues: Number.isFinite(issues) ? issues : 0,
        passedChecks: Number.isFinite(healthy) ? healthy : Math.max(evaluated - (issues || 0), 0),
        failedChecks: Number.isFinite(issues) ? issues : 0,
      };
    }

    return totals;
  }, [effectiveResourceInventory, storedWorkloadHealth?.summary?.resourceCounts]);

  const lastHealthCheckTime = useMemo(() => {
    let latestGeneratedAt = '';
    effectiveResourceInventory.forEach((resource) => {
      const health = resource?.health;
      if (!health) return;
      const generatedAt = health.generatedAt || health.result?.generatedAt || '';
      if (generatedAt && (!latestGeneratedAt || new Date(generatedAt) > new Date(latestGeneratedAt))) {
        latestGeneratedAt = generatedAt;
      }
    });
    return (
      latestGeneratedAt ||
      workloadHealthResult?.generatedAt ||
      workloadHealthResult?.updatedAt ||
      storedWorkloadHealth?.generatedAt ||
      storedWorkloadHealth?.createdAt ||
      storedWorkloadHealth?.timestamp ||
      ''
    );
  }, [effectiveResourceInventory, storedWorkloadHealth, workloadHealthResult]);

  const formatRelativeTime = useCallback((timestamp) => {
    if (!timestamp) return null;
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }, []);

  const handleNavigateToResources = useCallback(() => {
    setActiveTab('resources-health');
    setTimeout(() => {
      trackedResourcesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  if (!workload) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-sm text-yellow-800">
          Workload not found.{' '}
          <button type="button" onClick={onClose} className="underline font-medium">
            Go back
          </button>
          .
        </div>
      </div>
    );
  }

  const handleNavigateToTab = (tabValue) => {
    setActiveTab(tabValue);
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      {/* Header Row with Title and Save */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard/workloads')}
            className="h-8 w-8"
            aria-label="Go back to Workloads"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold text-gray-900">{formData.workloadName || 'Untitled Workload'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={
              isSaving ||
              !formData.workloadName ||
              formData.workloadName.trim() === '' ||
              !formData.description ||
              formData.description.trim() === '' ||
              (formData.environments?.length || 0) === 0
            }
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
      {/* Tabs Row */}
      <div className="flex items-center border-b">
        <TabsList className="inline-flex h-auto items-center justify-start bg-transparent p-0 text-muted-foreground">
          <TabsTrigger
            value="overview"
            className="rounded-none bg-transparent px-4 py-2 text-sm font-medium border-b-2 transition-colors data-[state=active]:border-primary-500 data-[state=active]:text-primary-600 data-[state=active]:shadow-none data-[state=active]:bg-transparent border-transparent text-gray-500 hover:text-gray-700"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="resources-health"
            className="rounded-none bg-transparent px-4 py-2 text-sm font-medium border-b-2 transition-colors data-[state=active]:border-primary-500 data-[state=active]:text-primary-600 data-[state=active]:shadow-none data-[state=active]:bg-transparent border-transparent text-gray-500 hover:text-gray-700"
          >
            Resources & Health
          </TabsTrigger>
          <TabsTrigger
            value="executive-summary"
            className="rounded-none bg-transparent px-4 py-2 text-sm font-medium border-b-2 transition-colors data-[state=active]:border-primary-500 data-[state=active]:text-primary-600 data-[state=active]:shadow-none data-[state=active]:bg-transparent border-transparent text-gray-500 hover:text-gray-700"
          >
            <FileText className="w-4 h-4 mr-1.5" />
            Executive Summary
          </TabsTrigger>
          {!isAzureWorkload && (
            <TabsTrigger
              value="configuration"
              className="rounded-none bg-transparent px-4 py-2 text-sm font-medium border-b-2 transition-colors data-[state=active]:border-primary-500 data-[state=active]:text-primary-600 data-[state=active]:shadow-none data-[state=active]:bg-transparent border-transparent text-gray-500 hover:text-gray-700"
            >
              Configuration
            </TabsTrigger>
          )}
        </TabsList>
      </div>

      <TabsContent value="overview">
        <div className="space-y-6">
          {/* Compact Stats Bar */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center divide-x divide-gray-200">
              {/* Resources */}
              <button
                type="button"
                onClick={() => handleNavigateToTab('resources-health')}
                className="flex-1 flex items-center justify-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <Cloud className="h-5 w-5 text-blue-500" />
                <div className="text-left">
                  <div className="text-lg font-semibold text-gray-900">{totalResourceCount}</div>
                  <div className="text-xs text-gray-500">Resources</div>
                </div>
              </button>

              {/* Health */}
              {(() => {
                const healthyResources = resourceHealthTotals.resourcesWithChecks - resourceHealthTotals.resourcesWithIssues;
                const unhealthyResources = resourceHealthTotals.resourcesWithIssues;
                const totalEvaluated = resourceHealthTotals.resourcesWithChecks;
                const healthPercent = totalEvaluated > 0 ? Math.round((healthyResources / totalEvaluated) * 100) : null;
                const healthColor = unhealthyResources === 0 ? 'text-green-600' : healthyResources === 0 ? 'text-red-600' : 'text-amber-600';
                const healthIcon = unhealthyResources === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                );
                const lastCheckedLabel = formatRelativeTime(lastHealthCheckTime);
                
                return (
                  <div className="flex-1 flex items-center justify-center gap-3 px-4 py-3 relative group">
                    <button
                      type="button"
                      onClick={handleNavigateToResources}
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                      {healthIcon}
                      <div className="text-left">
                        <div className={`text-lg font-semibold ${healthColor}`}>
                          {healthPercent !== null ? `${healthPercent}%` : '—'}
                        </div>
                        <div className="text-xs text-gray-500">
                          Health
                          {lastCheckedLabel && (
                            <span className="text-gray-400 ml-1">· {lastCheckedLabel}</span>
                          )}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={handleNavigateToResources}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Run health check"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })()}

            </div>
          </div>

          {/* Architecture Diagram - Main Feature */}
          <WorkloadDiagramCard
            diagramSpec={diagramSpec}
            diagramGeneratedAt={effectiveDiagramGeneratedAt}
            diagramUpdatedAt={effectiveDiagramUpdatedAt}
            onRefreshDiagram={handleRefreshDiagram}
            onSaveDiagramSpec={handleSaveDiagramLayout}
            onApplyDiagramInstruction={handleApplyDiagramInstruction}
            isRefreshingDiagram={isLoadingDiagramSpec || isGeneratingDiagram}
            isSavingDiagram={diagramSaveInFlight > 0}
            isApplyingDiagramInstruction={isUpdatingDiagramFromInstruction}
          />

          {/* Deployment Status - Simplified (hidden for Azure workloads) */}
          {!isAzureWorkload && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-gray-900">Deployment Pipeline</div>
                <button
                  type="button"
                  onClick={() => handleNavigateToTab('configuration')}
                  className="text-xs text-primary-600 hover:text-primary-700 hover:underline flex items-center gap-1"
                >
                  Configure
                  <ArrowLeft className="h-3 w-3 rotate-180" />
                </button>
              </div>
              {(() => {
                const deploymentPreferences = formData?.deploymentPreferences || {};
                const gitRepo = deploymentPreferences.gitRepo;
                const iacMethod = deploymentPreferences.method;
                const deliveryMethod = deploymentPreferences.deliveryMethod;
                const environments = formData?.environments || [];
                
                const sourceConfigured = !!gitRepo?.fullName || deploymentPreferences.sourceMode === 'none';
                const toolingConfigured = !!iacMethod;
                const pipelineConfigured = !!deliveryMethod && deliveryMethod !== 'manual';
                const destinationConfigured = environments.length > 0;
                
                const configuredCount = [sourceConfigured, toolingConfigured, pipelineConfigured, destinationConfigured].filter(Boolean).length;
                
                const stages = [
                  { key: 'source', label: 'Source', configured: sourceConfigured },
                  { key: 'tooling', label: 'Tooling', configured: toolingConfigured },
                  { key: 'pipeline', label: 'Pipeline', configured: pipelineConfigured },
                  { key: 'destination', label: 'Destination', configured: destinationConfigured },
                ];
                
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {stages.map((stage, index) => (
                        <React.Fragment key={stage.key}>
                          <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              stage.configured 
                                ? 'bg-green-100 text-green-600' 
                                : 'bg-gray-100 text-gray-400'
                            }`}>
                              {stage.configured ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-current" />
                              )}
                            </div>
                            <span className="text-xs text-gray-500 mt-1">{stage.label}</span>
                          </div>
                          {index < stages.length - 1 && (
                            <div className={`flex-1 h-0.5 ${
                              stage.configured ? 'bg-green-200' : 'bg-gray-200'
                            }`} />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500">
                      {configuredCount}/4 stages configured
                      {!pipelineConfigured && (
                        <span className="ml-2 text-amber-600">• No automated pipeline</span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </TabsContent>

      {/* Resources & Health Tab - Focus on resource inventory and health status */}
      <TabsContent value="resources-health">
        <div className="space-y-6">
          {/* Compact Infrastructure Summary Cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {/* Infrastructure Card - Clickable to scroll to resources */}
            <button
              type="button"
              onClick={() => trackedResourcesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm text-left hover:border-primary-300 hover:bg-gray-50 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <Cloud className="h-3.5 w-3.5" />
                  Resources
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-gray-400 group-hover:text-primary-500 transition-colors" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-xl font-bold text-gray-900">{totalResourceCount}</span>
                <span className="text-xs text-gray-500">{resourceTypeCount} types</span>
              </div>
            </button>

            {/* Stacks Card */}
            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <Layers className="h-3.5 w-3.5" />
                Stacks
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-xl font-bold text-gray-900">{trackedStacksCount}</span>
                <span className="text-xs text-gray-500">{environmentSummary.length} env</span>
              </div>
            </div>

            {/* Resource Health Card - Clickable */}
            {(() => {
              const healthyResources = resourceHealthTotals.resourcesWithChecks - resourceHealthTotals.resourcesWithIssues;
              const unhealthyResources = resourceHealthTotals.resourcesWithIssues;
              const totalEvaluated = resourceHealthTotals.resourcesWithChecks;
              const healthPercent = totalEvaluated > 0 ? Math.round((healthyResources / totalEvaluated) * 100) : 0;
              const lastCheckedLabel = formatRelativeTime(lastHealthCheckTime);
              
              return (
                <button
                  type="button"
                  onClick={() => trackedResourcesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm text-left hover:border-primary-300 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <HeartPulse className="h-3.5 w-3.5" />
                      Health
                    </div>
                    <RefreshCw className="h-3 w-3 text-gray-400 group-hover:text-primary-500 transition-colors" />
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className={`text-xl font-bold ${unhealthyResources === 0 ? 'text-green-600' : unhealthyResources > 0 && healthyResources > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                      {totalEvaluated > 0 ? `${healthPercent}%` : '—'}
                    </span>
                    {totalEvaluated > 0 && (
                      <span className="text-xs text-gray-500">
                        {healthyResources} ok / {unhealthyResources} issues
                      </span>
                    )}
                  </div>
                  {lastCheckedLabel && (
                    <div className="mt-1 text-xs text-gray-400">
                      Checked {lastCheckedLabel}
                    </div>
                  )}
                </button>
              );
            })()}

            {/* Top Resource Types Card */}
            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <Cloud className="h-3.5 w-3.5" />
                Top Types
              </div>
              <div className="mt-1.5 text-xs text-gray-600 truncate">
                {resourceSummary.length > 0 ? (
                  resourceSummary
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 3)
                    .map((item, idx) => (
                      <span key={item.type}>
                        {idx > 0 && ', '}
                        {item.type.replace('AWS::', '').replace('::', ' ')}
                      </span>
                    ))
                ) : (
                  <span className="text-gray-400">None tracked</span>
                )}
              </div>
            </div>
          </div>

          {/* Tracked Resources and Stacks */}
          <div ref={trackedResourcesRef} className="rounded-lg border border-gray-200 bg-white shadow-sm scroll-mt-4">
            <WorkloadResources
              embedded
              hideSummaryCards
              formData={effectiveFormData}
              setFormData={setFormData}
            />
          </div>
        </div>
      </TabsContent>

      {/* Executive Summary Tab */}
      <TabsContent value="executive-summary">
        <ExecutiveSummaryTab
          item={workload}
          summary={workloadSummary}
          onSummaryUpdate={setLocalSummary}
          accountScans={userProfile?.reportHistory || []}
          recommendations={[]}
          type="workload"
        />
      </TabsContent>

      {/* Configuration Tab - Consolidated settings (hidden for Azure workloads) */}
      {!isAzureWorkload && (
        <TabsContent value="configuration">
          <div className="space-y-6">
          {/* Section Navigation */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-3">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-gray-500 mr-2">Jump to:</span>
              {[
                { ref: generalSettingsRef, label: 'General' },
                { ref: deploymentConfigRef, label: 'Pipeline' },
                { ref: deploymentSettingsRef, label: 'Delivery' },
                { ref: governanceRef, label: 'Governance' },
                { ref: architecturePrefsRef, label: 'Architecture' },
                { ref: securityRulesRef, label: 'Security Policies' },
              ].map((section) => (
                <button
                  key={section.label}
                  type="button"
                  onClick={() => section.ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 hover:text-gray-900 rounded-md transition-colors border border-transparent hover:border-gray-200"
                >
                  {section.label}
                </button>
              ))}
            </div>
          </div>

          {/* General Settings */}
          <div ref={generalSettingsRef} className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 scroll-mt-4">
            <General
              formData={formData}
              setFormData={setFormData}
              userProfile={userProfile}
              workload={workload}
              awsRegionOptions={awsRegionOptions}
              showDiagram={false}
            />
          </div>

          {/* Deployment Configuration */}
          <div ref={deploymentConfigRef} className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 scroll-mt-4">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Deployment Configuration</h3>
            <WorkloadDeliveryCard
              formData={formData}
              setFormData={setFormData}
              githubConnections={githubConnections}
              environmentOptions={environmentOptions}
              getEnvironmentDisplay={getEnvironmentDisplay}
              workloadId={workloadId}
              workloadName={formData?.workloadName}
              allowPipelineWizard
              onAutoSave={handleAutoSave}
            />
          </div>

          {/* Delivery */}
          <div ref={deploymentSettingsRef} className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 scroll-mt-4">
            <DeploymentSettings
              formData={formData}
              setFormData={setFormData}
              awsRegionOptions={awsRegionOptions}
              githubConnections={githubConnections}
            />
          </div>

          {/* Governance */}
          <div ref={governanceRef} className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 scroll-mt-4">
            <Govenance formData={formData} setFormData={setFormData} />
          </div>

          {/* Architecture Preferences */}
          <div ref={architecturePrefsRef} className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 scroll-mt-4">
            <Architecture
              formData={formData}
              setFormData={setFormData}
              applyPreset={applyPreset}
            />
          </div>

          {/* Security Policies */}
          <div ref={securityRulesRef} className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 scroll-mt-4">
            <SecurityRulesTab
              securityPresets={securityPresets}
              totalRuleCount={totalSecurityRuleCount}
              securityRules={securityRulesState}
              onApplyPreset={handleApplySecurityPreset}
              countEnabled={enabledSecurityRuleCount}
              currentGroupBy={securityGroupBy}
              onToggleGroupBy={handleSecurityGroupByChange}
              allEnabled={allSecurityRulesEnabled}
              onToggleEnableAll={handleToggleAllSecurityRules}
              securityRulesConfig={securityRulesConfig}
              securityRulesConfigByService={securityRulesConfigByService}
              getCategoryRules={getCategoryRules}
              onToggleCategoryEnable={handleToggleSecurityCategory}
              onToggleCategoryExpand={handleToggleSecurityCategoryExpand}
              onToggleRule={handleToggleSecurityRule}
            />
          </div>
        </div>
      </TabsContent>
      )}

      {/* Export Modal */}
      <WorkloadExportModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
        workload={workload}
        executiveSummary={workloadSummary}
        diagramSpec={diagramSpec}
        accountScans={userProfile?.reportHistory || []}
        reports={[]}
        permissionProfiles={userProfile?.agentPermissionProfiles || []}
        recommendations={[]}
      />
    </Tabs>
  );
}

export default WorkloadDetailsPage;
