import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Stepper } from '@/components/Stepper';
import { createWorkloadDefinition, updateWorkloadDefinition, deleteWorkloadDefinition } from '@/features/workload/workloadSlice';
import { buildGitRepo, cleanGitRepo, getGithubConnections } from '@/helpers/github';
import { filterCloudEnvironments } from '@/helpers/shared';
import { listGithubBranches } from '@/api/integrations/github';
import {
  buildInitialWorkloadFormData,
  getDefaultRegionsForProfile,
  normalizeTrackedResources,
  runPostCreateWorkloadSync,
} from '@/features/workload/workloadCreationUtils';
import {
  buildWorkloadEnvironmentOptions,
  getAwsAccountIdForWorkloadEnvironment,
  normalizeWorkloadEnvironmentIds,
  resolveWorkloadEnvironmentRef,
} from '@/features/workload/workloadEnvironmentUtils';
import BasicsStep from './steps/BasicsStep';
import ImportStep, { SERVICE_OPTIONS } from './steps/ImportStep';
import SourceIacStep from './steps/SourceIacStep';
import PipelineStep from './steps/PipelineStep';
import SettingsStep from './steps/SettingsStep';
import ReviewStep from './steps/ReviewStep';
import toast from 'react-hot-toast';
import { analytics, ANALYTICS_EVENTS, getAnalyticsRoute } from '@/hooks/useAnalytics';

function WorkloadCreateWizard({
  isOpen,
  onClose,
  userProfile,
  initialMode = 'create',
  initialPrefill = null,
  navigateOnFinalize = true,
  onFinalizeSuccess,
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const permissionProfiles = useMemo(
    () => filterCloudEnvironments(userProfile?.agentPermissionProfiles || []),
    [userProfile]
  );

  const environmentOptions = useMemo(
    () => buildWorkloadEnvironmentOptions(permissionProfiles),
    [permissionProfiles]
  );

  const githubConnections = useMemo(
    () => getGithubConnections(userProfile),
    [userProfile]
  );

  const [formData, setFormData] = useState(buildInitialWorkloadFormData);
  const [workloadExists, setWorkloadExists] = useState(initialMode === 'import');
  const [includeImport, setIncludeImport] = useState(initialMode === 'import');
  const [activeStep, setActiveStep] = useState(0);
  const [draftWorkloadId, setDraftWorkloadId] = useState(null);
  const [hasFinalized, setHasFinalized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [importState, setImportState] = useState(() => {
    const defaultProfileId = permissionProfiles[0]?.recordId || '';
    return {
      selectedPermissionProfileId: initialMode === 'import' ? defaultProfileId : '',
      serviceMode: 'all',
      selectedServices: SERVICE_OPTIONS.map((service) => service.value),
      selectedRegions: getDefaultRegionsForProfile(defaultProfileId, permissionProfiles),
      notes: '',
      isLoading: false,
      isScanning: false,
      scanProgress: '',
      discoveredWorkloads: [],
      selectedWorkloadIndex: 0,
      approved: false,
      skipped: false,
      useDiscoveredDetails: initialMode === 'import',
    };
  });

  const [pipelineState, setPipelineState] = useState({
    mode: 'none',
    existingConfirmed: false,
    existingType: '',
    wizardDeliveryMethod: '',
    wizardAutoDeploy: true,
    wizardRequireApproval: false,
    wizardBranch: '',
    wizardRoleName: 'cloudagent-github-actions',
    wizardStateBucketMode: 'none',
    wizardStateBucketName: '',
    wizardOidcReady: false,
    gitSyncConnectionArn: '',
    gitSyncAutoCreateConnection: true,
    gitSyncConnectionName: '',
    gitSyncAutoCreateRole: true,
    gitSyncRoleName: '',
    gitSyncStackName: '',
    gitSyncConfigFile: 'cloudformation.yaml',
    gitSyncRoleArn: '',
    gitSyncRepositoryLinkId: '',
    gitSyncPublishDeploymentStatus: 'DISABLED',
    gitSyncTriggerResourceUpdateOn: 'FILE_CHANGE',
    gitSyncPullRequestComment: 'DISABLED',
    gitSyncShowAdvanced: false,
    gitSyncRegion: '',
    pipelineOpsStatus: 'idle',
    pipelineOpsMessage: '',
    pipelineToolEvents: [],
    pipelineCreated: false,
    error: '',
  });

  const steps = useMemo(() => {
    const accessMode = formData?.deploymentPreferences?.accessMode || 'managed';
    const base = [{ id: 'basics', label: 'Basics' }];
    if (includeImport) {
      base.push({ id: 'import', label: 'Import' });
    }
    if (accessMode !== 'readonly') {
      base.push({ id: 'source', label: 'Source & IaC' });
      base.push({ id: 'pipeline', label: 'Pipeline' });
      base.push({ id: 'settings', label: 'Settings' });
    }
    base.push({ id: 'review', label: 'Review' });
    return base;
  }, [includeImport, formData?.deploymentPreferences?.accessMode]);

  const activeStepKey = steps[activeStep]?.id;

  const gitRepo = useMemo(
    () => buildGitRepo(formData?.deploymentPreferences?.gitRepo),
    [formData?.deploymentPreferences?.gitRepo]
  );

  const selectedConnectionId = gitRepo?.connectionId || '';
  const selectedConnection = useMemo(
    () => githubConnections.find((connection) => connection.id === selectedConnectionId) || null,
    [githubConnections, selectedConnectionId]
  );

  const repoOptions = useMemo(() => {
    if (!selectedConnection?.repositories) return [];
    return selectedConnection.repositories
      .map((repo) => ({
        ...repo,
        fullName:
          repo?.fullName || (repo?.owner && repo?.name ? `${repo.owner}/${repo.name}` : ''),
      }))
      .filter((repo) => repo.fullName);
  }, [selectedConnection]);

  const selectedRepoKey = useMemo(() => {
    if (gitRepo?.fullName) return gitRepo.fullName;
    if (gitRepo?.owner && gitRepo?.repo) return `${gitRepo.owner}/${gitRepo.repo}`;
    return '';
  }, [gitRepo]);

  const selectedRepo = useMemo(
    () => repoOptions.find((repo) => repo.fullName === selectedRepoKey) || null,
    [repoOptions, selectedRepoKey]
  );

  const allowedBranches = useMemo(() => {
    if (!selectedRepo?.allowedBranches) return [];
    return selectedRepo.allowedBranches.filter(Boolean);
  }, [selectedRepo]);

  const [branchOptions, setBranchOptions] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesError, setBranchesError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const loadBranches = async () => {
      if (!selectedConnectionId || !selectedRepo?.owner || !selectedRepo?.name) {
        if (isMounted) {
          setBranchOptions([]);
          setBranchesError('');
          setBranchesLoading(false);
        }
        return;
      }
      if (allowedBranches.length > 0) {
        if (isMounted) {
          setBranchOptions(allowedBranches);
          setBranchesError('');
          setBranchesLoading(false);
        }
        return;
      }
      setBranchesLoading(true);
      setBranchesError('');
      try {
        const data = await listGithubBranches(
          selectedConnectionId,
          selectedRepo.owner,
          selectedRepo.name
        );
        const branches = Array.isArray(data?.branches)
          ? data.branches.map((branch) => branch?.name).filter(Boolean)
          : [];
        if (isMounted) {
          setBranchOptions(branches);
        }
      } catch (error) {
        if (isMounted) {
          setBranchOptions([]);
          setBranchesError(error?.message || 'Failed to load branches.');
        }
      } finally {
        if (isMounted) {
          setBranchesLoading(false);
        }
      }
    };

    loadBranches();
    return () => {
      isMounted = false;
    };
  }, [selectedConnectionId, selectedRepo, allowedBranches]);

  useEffect(() => {
    if (!gitRepo?.branch) return;
    setFormData((prev) => {
      const current = prev.deploymentPreferences?.pipelineConfig || {};
      if (current.branch) return prev;
      return {
        ...prev,
        deploymentPreferences: {
          ...prev.deploymentPreferences,
          pipelineConfig: {
            ...current,
            branch: gitRepo.branch,
          },
        },
      };
    });
  }, [gitRepo?.branch]);

  useEffect(() => {
    if (!pipelineState.wizardBranch && gitRepo?.branch) {
      setPipelineState((prev) => ({ ...prev, wizardBranch: gitRepo.branch }));
    }
  }, [gitRepo?.branch, pipelineState.wizardBranch]);

  useEffect(() => {
    const accessMode = formData?.deploymentPreferences?.accessMode || 'managed';
    if (accessMode === 'readonly') {
      setPipelineState((prev) => ({
        ...prev,
        mode: 'none',
        existingConfirmed: false,
        existingType: '',
        pipelineCreated: false,
        error: '',
      }));
      setFormData((prev) => ({
        ...prev,
        deploymentPreferences: {
          ...prev.deploymentPreferences,
          deliveryMethod: null,
        },
      }));
    }
  }, [formData?.deploymentPreferences?.accessMode]);

  useEffect(() => {
    const isTerraform = ['terraform', 'opentofu'].includes(
      formData?.deploymentPreferences?.method
    );
    if (!isTerraform) return;
    const stateSource = formData?.deploymentPreferences?.stateSource || '';
    const stateBucket = formData?.deploymentPreferences?.stateBucket || '';
    setPipelineState((prev) => {
      if (prev.wizardStateBucketMode !== 'none') {
        if (!prev.wizardStateBucketName && stateBucket) {
          return { ...prev, wizardStateBucketName: stateBucket };
        }
        return prev;
      }
      if (stateSource === 's3') {
        return {
          ...prev,
          wizardStateBucketMode: 'existing',
          wizardStateBucketName: stateBucket || prev.wizardStateBucketName,
        };
      }
      return prev;
    });
  }, [formData?.deploymentPreferences?.method, formData?.deploymentPreferences?.stateSource, formData?.deploymentPreferences?.stateBucket]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveStep(0);
    const shouldPrefill = !!initialPrefill;
    setWorkloadExists(shouldPrefill || initialMode === 'import');
    setIncludeImport(shouldPrefill || initialMode === 'import');
    const baseForm = buildInitialWorkloadFormData();
    if (shouldPrefill) {
      setFormData({
        ...baseForm,
        workloadName: initialPrefill.workloadName || '',
        description: initialPrefill.description || '',
        environments: normalizeWorkloadEnvironmentIds(
          Array.isArray(initialPrefill.environments) ? initialPrefill.environments : [],
          permissionProfiles
        ),
        trackedResources: normalizeTrackedResources(
          initialPrefill.trackedResources
        ),
      });
    } else {
      setFormData(baseForm);
    }
    setDraftWorkloadId(null);
    setHasFinalized(false);
    setIsSaving(false);
    setPipelineState({
      mode: 'none',
      existingConfirmed: false,
      existingType: '',
      wizardDeliveryMethod: '',
      wizardAutoDeploy: true,
      wizardRequireApproval: false,
      wizardBranch: '',
      wizardRoleName: 'cloudagent-github-actions',
      wizardStateBucketMode: 'none',
      wizardStateBucketName: '',
      wizardOidcReady: false,
      gitSyncConnectionArn: '',
      gitSyncAutoCreateConnection: true,
      gitSyncConnectionName: '',
      gitSyncAutoCreateRole: true,
      gitSyncRoleName: '',
      gitSyncStackName: '',
      gitSyncConfigFile: 'cloudformation.yaml',
      gitSyncRoleArn: '',
      gitSyncRepositoryLinkId: '',
      gitSyncPublishDeploymentStatus: 'DISABLED',
      gitSyncTriggerResourceUpdateOn: 'FILE_CHANGE',
      gitSyncPullRequestComment: 'DISABLED',
      gitSyncShowAdvanced: false,
      gitSyncRegion: '',
      pipelineOpsStatus: 'idle',
      pipelineOpsMessage: '',
      pipelineToolEvents: [],
      pipelineCreated: false,
      error: '',
    });
    const defaultProfileId = permissionProfiles[0]?.recordId || '';
    const prefillEnvironmentId =
      shouldPrefill && Array.isArray(initialPrefill?.environments)
        ? initialPrefill.environments[0] || ''
        : '';
    const prefillProfileId = shouldPrefill
      ? resolveWorkloadEnvironmentRef(prefillEnvironmentId, permissionProfiles)?.permissionProfileId || ''
      : '';
    const importProfileId = shouldPrefill
      ? prefillProfileId || defaultProfileId
      : initialMode === 'import'
        ? defaultProfileId
        : '';
    const prefillWorkload = shouldPrefill
      ? {
          name: initialPrefill.workloadName || '',
          description: initialPrefill.description || '',
          trackedResources: normalizeTrackedResources(initialPrefill.trackedResources),
        }
      : null;
    setImportState({
      selectedPermissionProfileId: importProfileId,
      serviceMode: 'all',
      selectedServices: SERVICE_OPTIONS.map((service) => service.value),
      selectedRegions: getDefaultRegionsForProfile(
        importProfileId || defaultProfileId,
        permissionProfiles
      ),
      notes: '',
      isLoading: false,
      isScanning: false,
      scanProgress: '',
      discoveredWorkloads: prefillWorkload ? [prefillWorkload] : [],
      selectedWorkloadIndex: 0,
      approved: shouldPrefill ? true : false,
      skipped: false,
      useDiscoveredDetails: shouldPrefill || initialMode === 'import',
    });
  }, [isOpen, initialMode, initialPrefill, permissionProfiles]);

  useEffect(() => {
    if (!workloadExists && includeImport) {
      setIncludeImport(false);
    }
  }, [workloadExists, includeImport]);

  useEffect(() => {
    if (!steps.length) return;
    setActiveStep((prev) => Math.min(prev, steps.length - 1));
  }, [steps.length]);

  useEffect(() => {
    if (!importState.selectedPermissionProfileId) {
      const firstEnvironmentId = formData.environments?.[0];
      const profileId = firstEnvironmentId
        ? resolveWorkloadEnvironmentRef(firstEnvironmentId, permissionProfiles)?.permissionProfileId || ''
        : '';
      if (profileId) {
        setImportState((prev) => ({
          ...prev,
          selectedPermissionProfileId: profileId,
          selectedRegions: getDefaultRegionsForProfile(profileId, permissionProfiles),
        }));
      }
    }
  }, [formData.environments, importState.selectedPermissionProfileId, permissionProfiles]);

  const updateDeploymentPreferences = (patch) => {
    setFormData((prev) => ({
      ...prev,
      deploymentPreferences: (() => {
        const next = {
          ...prev.deploymentPreferences,
          ...patch,
        };
        if (patch?.method === 'aws_cli') {
          next.sourceMode = 'none';
          next.gitRepo = null;
        }
        if (patch?.sourceMode === 'none') {
          next.gitRepo = null;
        }
        return next;
      })(),
    }));
  };

  const updateGitRepo = (patch) => {
    setFormData((prev) => ({
      ...prev,
      deploymentPreferences: {
        ...prev.deploymentPreferences,
        gitRepo: patch ? { ...(prev.deploymentPreferences.gitRepo || {}), ...patch } : null,
      },
    }));
  };

  const environmentLabels = useMemo(() => {
    return (formData.environments || []).map((permissionProfileId) => {
      const match = environmentOptions.find((env) => env.id === permissionProfileId);
      const accountId = getAwsAccountIdForWorkloadEnvironment(permissionProfileId, permissionProfiles);
      return {
        accountId: accountId || '',
        permissionProfileId,
        label: match?.label || permissionProfileId,
      };
    });
  }, [environmentOptions, formData.environments, permissionProfiles]);

  const prepareWorkloadPayload = (includeId, override = null) => {
    const gitRepoClean = cleanGitRepo(formData.deploymentPreferences.gitRepo);
    const deploymentPreferences = {
      ...formData.deploymentPreferences,
      gitRepo: gitRepoClean,
    };

    let payload = {
      workloadName: formData.workloadName.trim(),
      description: formData.description.trim(),
      environments: normalizeWorkloadEnvironmentIds(formData.environments || [], permissionProfiles),
      deploymentPreferences,
      securityRules: formData.securityRules,
      trackedResources: normalizeTrackedResources(formData.trackedResources),
    };

    if (override && typeof override === 'object') {
      payload = {
        ...payload,
        ...override,
        deploymentPreferences: override.deploymentPreferences
          ? { ...payload.deploymentPreferences, ...override.deploymentPreferences }
          : payload.deploymentPreferences,
        trackedResources: override.trackedResources
          ? normalizeTrackedResources(override.trackedResources)
          : payload.trackedResources,
      };
    }

    if (includeId && draftWorkloadId) {
      payload.workloadId = draftWorkloadId;
    }

    return payload;
  };

  const ensureDraftWorkload = async () => {
    if (draftWorkloadId) return draftWorkloadId;
    setIsSaving(true);
    try {
      const result = await dispatch(
        createWorkloadDefinition(prepareWorkloadPayload(false))
      ).unwrap();
      setDraftWorkloadId(result.workloadId);
      return result.workloadId;
    } finally {
      setIsSaving(false);
    }
  };

  const persistDraft = async (workloadIdOverride, override = null) => {
    const workloadId = workloadIdOverride || draftWorkloadId;
    if (!workloadId) return;
    await dispatch(
      updateWorkloadDefinition({
        ...prepareWorkloadPayload(true, override),
        workloadId
      })
    ).unwrap();
  };

  const handleApproveImport = (workload, useDetails) => {
    if (!workload) return;
    const trackedResources = normalizeTrackedResources(workload.trackedResources);
    setFormData((prev) => ({
      ...prev,
      workloadName: useDetails ? workload.name || prev.workloadName : prev.workloadName,
      description: useDetails ? workload.description || prev.description : prev.description,
      trackedResources,
    }));
    setImportState((prev) => ({ ...prev, approved: true, skipped: false }));
  };

  const handleSkipImport = () => {
    setImportState((prev) => ({ ...prev, approved: true, skipped: true }));
    setFormData((prev) => ({
      ...prev,
      trackedResources: { resources: [], stacks: [] },
    }));
  };

  const handleNext = async () => {
    try {
      let ensuredId = draftWorkloadId;
      let importOverride = null;
      if (activeStepKey === 'import' && includeImport) {
        if (!importState.approved && !importState.skipped) {
          const selected =
            importState.discoveredWorkloads?.[importState.selectedWorkloadIndex] || null;
          if (!selected) {
            toast.error('Run a scan or skip import to continue.');
            return;
          }
          const trackedResources = normalizeTrackedResources(selected.trackedResources);
          const nextWorkloadName = importState.useDiscoveredDetails
            ? selected.name || formData.workloadName
            : formData.workloadName;
          const nextDescription = importState.useDiscoveredDetails
            ? selected.description || formData.description
            : formData.description;
          handleApproveImport(selected, importState.useDiscoveredDetails);
          importOverride = {
            workloadName: nextWorkloadName,
            description: nextDescription,
            trackedResources,
          };
        }
      }
      if (activeStepKey === 'basics') {
        ensuredId = await ensureDraftWorkload();
      }
      if (ensuredId && activeStepKey !== 'review') {
        await persistDraft(ensuredId, importOverride);
      }
      setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
    } catch (error) {
      toast.error(error?.message || 'Failed to save workload step.');
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const handleFinalize = async () => {
    let ensuredId = draftWorkloadId;
    setIsSaving(true);
    try {
      if (!ensuredId) {
        ensuredId = await ensureDraftWorkload();
      }
      const result = await dispatch(
        updateWorkloadDefinition({ ...prepareWorkloadPayload(true), workloadId: ensuredId })
      ).unwrap();
      const syncResult = await runPostCreateWorkloadSync({
        dispatch,
        workloads: [result],
      });
      const healthFailures = syncResult.healthResults.filter((item) => !item.success);
      const summaryFailures = syncResult.summaryResults.filter((item) => !item.success);
      setHasFinalized(true);
      onFinalizeSuccess?.(result);
      onClose?.();
      analytics.track(ANALYTICS_EVENTS.WORKLOAD_ADDED, {
        route: getAnalyticsRoute(),
      });
      if (navigateOnFinalize && result?.workloadId) {
        navigate(`/dashboard/workloads/${result.workloadId}`);
      }
      toast.success('Workload created successfully.');
      if (
        healthFailures.length > 0 ||
        summaryFailures.length > 0 ||
        syncResult.recommendationsRefreshError ||
        syncResult.recommendationsLoadError
      ) {
        console.warn('[WorkloadCreateWizard] Post-create refresh completed with warnings', {
          healthFailures,
          summaryFailures,
          recommendationsRefreshError: syncResult.recommendationsRefreshError,
          recommendationsLoadError: syncResult.recommendationsLoadError,
        });
        toast.error(
          'Workload was created, but some health, summary, or recommendation data could not be refreshed.'
        );
      }
    } catch (error) {
      toast.error(error?.message || 'Failed to create workload.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = async () => {
    if (draftWorkloadId && !hasFinalized) {
      const confirmDiscard = window.confirm(
        'Cancel setup and delete this draft workload? Pipelines created will not be removed.'
      );
      if (!confirmDiscard) return;
      try {
        await dispatch(deleteWorkloadDefinition({ workloadId: draftWorkloadId })).unwrap();
      } catch (_) {
        // Ignore delete failures on cancel
      }
    }
    onClose?.();
  };

  const basicValid =
    formData.workloadName.trim() !== '' &&
    formData.description.trim() !== '' &&
    (formData.environments?.length || 0) > 0;

  const importValid = includeImport
    ? importState.approved ||
      importState.skipped ||
      (importState.discoveredWorkloads?.length || 0) > 0
    : true;

  const pipelineValid = (() => {
    if (pipelineState.mode === 'none') {
      return true;
    }
    if (pipelineState.mode === 'existing') {
      return pipelineState.existingConfirmed && !!pipelineState.existingType;
    }
    if (pipelineState.mode === 'create') {
      return pipelineState.pipelineCreated;
    }
    return false;
  })();

  const canProceed = {
    basics: basicValid,
    import: importValid,
    source: !!formData.deploymentPreferences.method,
    pipeline: pipelineValid,
    settings: true,
    review: true,
  };

  const pipelineSummary = (() => {
    const pipelineTypeLabel = (value) => {
      switch (value) {
        case 'github_actions':
          return 'GitHub Actions';
        case 'codepipeline':
          return 'CodePipeline/CodeBuild';
        case 'cloudformation_git_sync':
          return 'CloudFormation Git Sync';
        default:
          return value || 'Pipeline';
      }
    };
    const accessMode = formData?.deploymentPreferences?.accessMode || 'managed';
    if (accessMode === 'readonly') {
      return 'Read-only mode: pipeline not required.';
    }
    if (pipelineState.mode === 'none' || !pipelineState.mode) {
      return 'No pipeline selected.';
    }
    if (pipelineState.mode === 'existing') {
      const label = pipelineState.existingType
        ? `Existing ${pipelineTypeLabel(pipelineState.existingType)} pipeline.`
        : 'Existing pipeline selected.';
      return pipelineState.existingConfirmed ? label : `${label} (not confirmed)`;
    }
    if (pipelineState.mode === 'create') {
      return pipelineState.pipelineCreated
        ? `Pipeline created (${pipelineTypeLabel(pipelineState.wizardDeliveryMethod) || 'GitHub Actions'}).`
        : 'Pipeline creation pending.';
    }
    return 'Pipeline not configured.';
  })();

  const trackedSummary =
    (formData.trackedResources.resources?.length || 0) +
      (formData.trackedResources.stacks?.length || 0) >
    0
      ? `${formData.trackedResources.resources?.length || 0} resources, ${
          formData.trackedResources.stacks?.length || 0
        } stacks attached.`
      : null;

  const importSummary =
    (includeImport && importState.approved && !importState.skipped) || trackedSummary
      ? trackedSummary
      : null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
        }
      }}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Create workload</DialogTitle>
          <DialogDescription>
            Step through the setup to create or import a workload with pipelines and IaC.
          </DialogDescription>
        </DialogHeader>

        <Stepper steps={steps.map((step) => step.label)} activeStep={activeStep} />

        <div className="py-2">
          {activeStepKey === 'basics' && (
            <BasicsStep
              formData={formData}
              setFormData={setFormData}
              environmentOptions={environmentOptions}
              includeImport={includeImport}
              setIncludeImport={setIncludeImport}
              workloadExists={workloadExists}
              setWorkloadExists={setWorkloadExists}
            />
          )}

          {activeStepKey === 'import' && (
            <ImportStep
              userProfile={userProfile}
              importState={importState}
              setImportState={setImportState}
              onSkip={handleSkipImport}
            />
          )}

          {activeStepKey === 'source' && (
            <SourceIacStep
              formData={formData}
              updateGitRepo={updateGitRepo}
              updateDeploymentPreferences={updateDeploymentPreferences}
              githubConnections={githubConnections}
              repoOptions={repoOptions}
              selectedConnectionId={selectedConnectionId}
              selectedRepoKey={selectedRepoKey}
              selectedRepo={selectedRepo}
              branchOptions={branchOptions}
              branchesLoading={branchesLoading}
              branchesError={branchesError}
            />
          )}

          {activeStepKey === 'pipeline' && (
            <PipelineStep
              formData={formData}
              setFormData={setFormData}
              workloadId={draftWorkloadId}
              workloadName={formData.workloadName}
              gitRepo={gitRepo}
              environmentOptions={environmentOptions}
              branchOptions={branchOptions}
              branchesLoading={branchesLoading}
              branchesError={branchesError}
              pipelineState={pipelineState}
              setPipelineState={setPipelineState}
            />
          )}

          {activeStepKey === 'settings' && (
            <SettingsStep formData={formData} setFormData={setFormData} />
          )}

          {activeStepKey === 'review' && (
            <ReviewStep
              formData={formData}
              environmentLabels={environmentLabels}
              gitRepo={gitRepo}
              pipelineSummary={pipelineSummary}
              importSummary={importSummary}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            {activeStep > 0 && (
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
            )}
            {activeStepKey !== 'review' && (
              <Button
                onClick={handleNext}
                disabled={isSaving || !canProceed[activeStepKey]}
              >
                {isSaving ? 'Saving...' : 'Next'}
              </Button>
            )}
            {activeStepKey === 'review' && (
              <Button onClick={handleFinalize} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Create workload'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WorkloadCreateWizard;
