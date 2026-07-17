import React, { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2 } from 'lucide-react';
import { executeOperation } from '@/api/ops';
import { buildGithubOidcTemplate } from '@/helpers/githubOidc';
import { saveToFile } from '@/helpers/shared';

const DELIVERY_OPTIONS = [
  { value: 'github_actions', label: 'GitHub Actions', requiresRepo: true },
  { value: 'codepipeline', label: 'CodePipeline/CodeBuild', requiresRepo: false },
  {
    value: 'cloudformation_git_sync',
    label: 'CloudFormation Git Sync',
    requiresRepo: true,
    onlyCloudFormation: true,
    isGitSync: true,
  },
];

const TOOL_NAME_LABELS = {
  read_github_file: 'Read GitHub file',
  create_github_branch: 'Create GitHub branch',
  write_github_file: 'Write GitHub file',
  create_github_pull_request: 'Create GitHub pull request',
  cli_session_execute: 'CLI session command',
  azure_cli_readonly: 'Azure CLI (read-only)',
  aws_cfn_operations: 'CloudFormation operations',
  finalize_operation_result: 'Finalize operation',
};

const formatToolName = (name) => {
  if (!name) return 'Tool call';
  const trimmed = String(name).trim();
  if (!trimmed) return 'Tool call';
  const lower = trimmed.toLowerCase();
  if (TOOL_NAME_LABELS[lower]) return TOOL_NAME_LABELS[lower];
  const spaced = trimmed.replace(/[_-]+/g, ' ');
  return spaced.replace(/\b\w/g, (char) => char.toUpperCase());
};

function PipelineStep({
  formData,
  setFormData,
  workloadId,
  workloadName,
  gitRepo,
  environmentOptions,
  branchOptions,
  branchesLoading,
  branchesError,
  pipelineState,
  setPipelineState,
}) {
  const updatePipelineState = (patch) => {
    setPipelineState((prev) => ({ ...prev, ...patch }));
  };

  const repoConfigured = !!gitRepo?.owner && !!gitRepo?.repo;
  const iacMethod = formData?.deploymentPreferences?.method || '';
  const isTerraform = ['terraform', 'opentofu'].includes(iacMethod);
  const isCloudFormation = iacMethod === 'cloudformation';
  const isGitSyncSelection =
    pipelineState.wizardDeliveryMethod === 'cloudformation_git_sync';
  const pipelineBranchLabel = isTerraform
    ? 'Terraform/OpenTofu branch'
    : iacMethod === 'cloudformation'
      ? 'CloudFormation branch'
      : 'Deployment branch';

  const parseRegionFromArn = (arn) => {
    if (!arn) return '';
    const parts = arn.split(':');
    return parts.length > 3 ? parts[3] : '';
  };

  const isValidSyncResourceName = (value) =>
    /^[0-9A-Za-z]+[0-9A-Za-z_-]*$/.test(value || '');

  const sanitizeSyncResourceName = (value) => {
    if (!value) return '';
    const cleaned = String(value)
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^0-9A-Za-z_-]/g, '');
    const normalized = cleaned.replace(/^[^0-9A-Za-z]+/, '');
    return normalized || 'cloudagent-stack';
  };

  const selectedRepoBranch = gitRepo?.branch || '';
  const pipelineBranch = pipelineState.wizardBranch || selectedRepoBranch || '';
  const selectedEnvironmentId = Array.isArray(formData?.environments)
    ? String(formData.environments[0] || '')
    : '';
  const selectedEnvironment = useMemo(
    () => environmentOptions.find((environment) => environment.id === selectedEnvironmentId) || null,
    [environmentOptions, selectedEnvironmentId]
  );
  const accountId = String(selectedEnvironment?.accountId || '');
  const gitSyncConnectionArn = pipelineState.gitSyncConnectionArn.trim();
  const gitSyncAutoCreateConnection = !!pipelineState.gitSyncAutoCreateConnection;
  const gitSyncConnectionName = pipelineState.gitSyncConnectionName.trim();
  const gitSyncAutoCreateRole = !!pipelineState.gitSyncAutoCreateRole;
  const gitSyncRoleName = pipelineState.gitSyncRoleName.trim();
  const gitSyncStackName = pipelineState.gitSyncStackName.trim();
  const gitSyncConfigFile = pipelineState.gitSyncConfigFile.trim();
  const gitSyncRoleArn = pipelineState.gitSyncRoleArn.trim();
  const gitSyncRepositoryLinkId = pipelineState.gitSyncRepositoryLinkId.trim();

  const trimmedAccountId = accountId.trim();
  const accountIdError = trimmedAccountId
    ? !/^\d{12}$/.test(trimmedAccountId)
      ? 'AWS Account ID must be 12 digits.'
      : ''
    : 'Select an AWS environment first.';

  useEffect(() => {
    if (!pipelineState.gitSyncStackName && workloadName) {
      setPipelineState((prev) => (
        prev.gitSyncStackName
          ? prev
          : { ...prev, gitSyncStackName: sanitizeSyncResourceName(workloadName) }
      ));
    }
  }, [pipelineState.gitSyncStackName, workloadName, setPipelineState]);

  useEffect(() => {
    if (!gitSyncAutoCreateConnection) return;
    if (pipelineState.gitSyncConnectionName) return;
    const fallbackName = gitRepo?.owner && gitRepo?.repo
      ? `cloudagent-${gitRepo.owner}-${gitRepo.repo}`
      : workloadName
        ? `cloudagent-${workloadName.replace(/\s+/g, '-').toLowerCase()}`
        : 'cloudagent-connection';
    setPipelineState((prev) => ({
      ...prev,
      gitSyncConnectionName: prev.gitSyncConnectionName || fallbackName,
    }));
  }, [gitSyncAutoCreateConnection, gitRepo?.owner, gitRepo?.repo, workloadName, pipelineState.gitSyncConnectionName, setPipelineState]);

  useEffect(() => {
    if (!gitSyncAutoCreateRole) return;
    if (pipelineState.gitSyncRoleName) return;
    const fallbackName = workloadName
      ? `cloudagent-gitsync-${workloadName.replace(/\s+/g, '-').toLowerCase()}`
      : 'cloudagent-gitsync-role';
    setPipelineState((prev) => ({
      ...prev,
      gitSyncRoleName: prev.gitSyncRoleName || fallbackName,
    }));
  }, [gitSyncAutoCreateRole, pipelineState.gitSyncRoleName, workloadName, setPipelineState]);

  const computedRoleArn =
    trimmedAccountId && pipelineState.wizardRoleName
      ? `arn:aws:iam::${trimmedAccountId}:role/${pipelineState.wizardRoleName}`
      : '';

  const gitSyncDetails = pipelineState.pipelineOpsDetails || null;
  const gitSyncConnectionArnResolved =
    gitSyncDetails?.connectionArn || gitSyncConnectionArn;
  const gitSyncRegionResolved =
    gitSyncDetails?.region ||
    pipelineState.gitSyncRegion ||
    parseRegionFromArn(gitSyncConnectionArnResolved);
  const connectionConsoleUrl = gitSyncConnectionArnResolved
    ? `https://console.aws.amazon.com/codesuite/settings/connections${
        gitSyncRegionResolved ? `?region=${gitSyncRegionResolved}` : ''
      }`
    : '';

  const trimmedStateBucket = pipelineState.wizardStateBucketName.trim();
  const stateBucketRequired = isTerraform && pipelineState.wizardStateBucketMode !== 'none';
  const stateBucketError = stateBucketRequired && !trimmedStateBucket
    ? 'Enter an S3 bucket name for state.'
    : '';

  const oidcTemplate = useMemo(
    () =>
      buildGithubOidcTemplate({
        owner: gitRepo?.owner,
        repo: gitRepo?.repo,
        branch: pipelineBranch || 'main',
        roleName: pipelineState.wizardRoleName || 'cloudagent-github-actions',
        stateBucketName: stateBucketRequired ? trimmedStateBucket : '',
        createStateBucket:
          stateBucketRequired && pipelineState.wizardStateBucketMode === 'create',
      }),
    [
      gitRepo?.owner,
      gitRepo?.repo,
      pipelineBranch,
      pipelineState.wizardRoleName,
      stateBucketRequired,
      trimmedStateBucket,
      pipelineState.wizardStateBucketMode,
    ]
  );

  const oidcTemplateMissing =
    !gitRepo?.owner ||
    !gitRepo?.repo ||
    !pipelineBranch ||
    (stateBucketRequired && !trimmedStateBucket);

  const pipelineChoices = DELIVERY_OPTIONS.filter((option) => {
    if (option.onlyCloudFormation && !isCloudFormation) return false;
    return true;
  }).map((option) => {
    const disabled = option.requiresRepo && !repoConfigured;
    return {
      ...option,
      disabled,
      helper: disabled ? 'Connect a repo in Source first.' : '',
    };
  });

  const existingPipelineChoices = DELIVERY_OPTIONS.filter((option) => {
    if (option.onlyCloudFormation && !isCloudFormation) return false;
    return true;
  }).map((option) => ({ ...option, disabled: false }));

  const resetPipelineSelection = (mode) => {
    updatePipelineState({
      mode,
      pipelineCreated: false,
      existingConfirmed: false,
      existingType: '',
      wizardDeliveryMethod: '',
      error: '',
      pipelineOpsStatus: 'idle',
      pipelineOpsMessage: '',
      pipelineToolEvents: [],
      pipelineOpsDetails: null,
    });
  };

  const handleNoPipelineSelect = () => {
    resetPipelineSelection('none');
    setFormData((prev) => ({
      ...prev,
      deploymentPreferences: {
        ...prev.deploymentPreferences,
        deliveryMethod: null,
        pipelineConfig: {
          ...(prev.deploymentPreferences?.pipelineConfig || {}),
          existingPipeline: false,
        },
      },
    }));
  };

  const handleExistingPipelineConfirm = (checked) => {
    updatePipelineState({ existingConfirmed: checked, mode: 'existing' });
    setFormData((prev) => ({
      ...prev,
      deploymentPreferences: {
        ...prev.deploymentPreferences,
        deliveryMethod: checked && pipelineState.existingType
          ? pipelineState.existingType
          : null,
        pipelineConfig: {
          ...(prev.deploymentPreferences?.pipelineConfig || {}),
          existingPipeline: checked,
        },
      },
    }));
  };

  const handleExistingPipelineType = (value) => {
    updatePipelineState({ existingType: value, mode: 'existing' });
    setFormData((prev) => ({
      ...prev,
      deploymentPreferences: {
        ...prev.deploymentPreferences,
        deliveryMethod: value || null,
        pipelineConfig: {
          ...(prev.deploymentPreferences?.pipelineConfig || {}),
          existingPipeline: pipelineState.existingConfirmed,
        },
      },
    }));
  };

  const handlePipelineModeSelect = (mode) => {
    if (mode === 'none') {
      handleNoPipelineSelect();
      return;
    }

    updatePipelineState({
      mode,
      pipelineCreated: mode === 'create' ? pipelineState.pipelineCreated : false,
      existingConfirmed: mode === 'existing' ? pipelineState.existingConfirmed : false,
      existingType: mode === 'existing' ? pipelineState.existingType : '',
      wizardDeliveryMethod: mode === 'create' ? pipelineState.wizardDeliveryMethod : '',
      error: '',
      pipelineOpsStatus: 'idle',
      pipelineOpsMessage: '',
      pipelineToolEvents: [],
      pipelineOpsDetails: null,
    });
  };

  const handleEnableGitSync = async () => {
    updatePipelineState({ error: '' });
    if (!isCloudFormation) {
      updatePipelineState({ error: 'CloudFormation is required for Git Sync.' });
      return;
    }
    if (!repoConfigured) {
      updatePipelineState({ error: 'Connect a GitHub repository first.' });
      return;
    }
    if (!pipelineBranch) {
      updatePipelineState({ error: 'Select a branch for Git Sync.' });
      return;
    }
    if (accountIdError) {
      updatePipelineState({ error: accountIdError });
      return;
    }
    if (!gitSyncAutoCreateConnection && !gitSyncConnectionArn) {
      updatePipelineState({ error: 'Enter a CodeConnections connection ARN.' });
      return;
    }
    if (gitSyncAutoCreateConnection && !gitSyncConnectionName) {
      updatePipelineState({ error: 'Enter a connection name to create.' });
      return;
    }
    if (!gitSyncStackName) {
      updatePipelineState({ error: 'Enter a CloudFormation stack name.' });
      return;
    }
    if (!isValidSyncResourceName(gitSyncStackName)) {
      updatePipelineState({
        error: 'Stack name must be alphanumeric and may include "-" or "_" only.',
      });
      return;
    }
    if (!gitSyncConfigFile) {
      updatePipelineState({ error: 'Enter the stack deployment file path.' });
      return;
    }
    if (!gitSyncAutoCreateRole && !gitSyncRoleArn) {
      updatePipelineState({ error: 'Enter the IAM role ARN for Git Sync.' });
      return;
    }
    if (gitSyncAutoCreateRole && !gitSyncRoleName) {
      updatePipelineState({ error: 'Enter a role name to create.' });
      return;
    }

    updatePipelineState({
      pipelineOpsStatus: 'loading',
      pipelineOpsMessage: 'Configuring Git Sync...',
      pipelineToolEvents: [],
      pipelineCreated: false,
      error: '',
    });

    try {
      const result = await executeOperation(
        'cloudformation:git-sync:configure',
        {
          accountId: trimmedAccountId,
          connectionArn: gitSyncAutoCreateConnection ? null : gitSyncConnectionArn,
          connectionName: gitSyncAutoCreateConnection ? gitSyncConnectionName : null,
          providerType: 'GitHub',
          ownerId: gitRepo.owner,
          repositoryName: gitRepo.repo,
          branch: pipelineBranch,
          configFile: gitSyncConfigFile,
          stackName: gitSyncStackName,
          roleArn: gitSyncAutoCreateRole ? null : gitSyncRoleArn,
          autoCreateRole: gitSyncAutoCreateRole,
          roleName: gitSyncAutoCreateRole ? gitSyncRoleName : null,
          repositoryLinkId: gitSyncRepositoryLinkId || null,
          publishDeploymentStatus: pipelineState.gitSyncPublishDeploymentStatus,
          triggerResourceUpdateOn: pipelineState.gitSyncTriggerResourceUpdateOn,
          pullRequestComment: pipelineState.gitSyncPullRequestComment,
          region: pipelineState.gitSyncRegion || null,
        },
        {},
        {
          onToolEvent: (eventType, payload) => {
            upsertPipelineToolEvent(eventType, payload);
          },
        }
      );

      const body = result?.body || {};
      let details = null;
      if (typeof body?.details === 'string') {
        try {
          details = JSON.parse(body.details);
        } catch (_) {
          details = null;
        }
      } else if (body?.details && typeof body.details === 'object') {
        details = body.details;
      }

      if (body?.success === false) {
        updatePipelineState({
          pipelineOpsStatus: 'error',
          pipelineOpsMessage: body?.message || 'Failed to configure Git Sync.',
          pipelineOpsDetails: details,
        });
        return;
      }

      updatePipelineState({
        pipelineOpsStatus: 'success',
        pipelineOpsMessage: 'Git Sync configured.',
        pipelineOpsDetails: details,
        pipelineCreated: true,
        mode: 'create',
        wizardDeliveryMethod: 'cloudformation_git_sync',
        gitSyncRepositoryLinkId: details?.repositoryLinkId || gitSyncRepositoryLinkId,
        gitSyncRegion: details?.region || pipelineState.gitSyncRegion,
        gitSyncConnectionArn: details?.connectionArn || gitSyncConnectionArn,
        gitSyncConnectionName: details?.connectionName || gitSyncConnectionName,
        gitSyncRoleArn: details?.roleArn || gitSyncRoleArn,
        gitSyncRoleName: details?.roleName || gitSyncRoleName,
        error: '',
      });

      setFormData((prev) => ({
        ...prev,
        deploymentPreferences: {
          ...prev.deploymentPreferences,
          deliveryMethod: 'cloudformation_git_sync',
          pipelineConfig: {
            ...(prev.deploymentPreferences?.pipelineConfig || {}),
            branch: pipelineBranch,
            connectionArn: details?.connectionArn || gitSyncConnectionArn || null,
            connectionName: details?.connectionName || gitSyncConnectionName || null,
            ownerId: gitRepo.owner,
            repositoryName: gitRepo.repo,
            configFile: gitSyncConfigFile,
            stackName: gitSyncStackName,
            roleArn: details?.roleArn || gitSyncRoleArn || null,
            roleName: details?.roleName || gitSyncRoleName || null,
            repositoryLinkId: details?.repositoryLinkId || gitSyncRepositoryLinkId || null,
            publishDeploymentStatus: pipelineState.gitSyncPublishDeploymentStatus,
            triggerResourceUpdateOn: pipelineState.gitSyncTriggerResourceUpdateOn,
            pullRequestComment: pipelineState.gitSyncPullRequestComment,
            region: details?.region || pipelineState.gitSyncRegion || null,
          },
        },
      }));
    } catch (error) {
      updatePipelineState({
        pipelineOpsStatus: 'error',
        pipelineOpsMessage: error?.message || 'Failed to configure Git Sync.',
      });
    }
  };

  const upsertPipelineToolEvent = (eventType, payload) => {
    if (!payload) return;
    setPipelineState((prev) => {
      const list = Array.isArray(prev.pipelineToolEvents) ? prev.pipelineToolEvents : [];
      const id = payload.toolCallId || payload.tool_call_id || payload.id || `${Date.now()}`;
      const rawName = payload.name || payload.tool_name || payload.action || 'tool';
      const status = payload.status || (eventType === 'tool_result' ? 'completed' : 'in_progress');
      const nextEntry = {
        id,
        name: formatToolName(rawName),
        status,
      };
      const next = list.filter((item) => item.id !== id);
      return { ...prev, pipelineToolEvents: [...next, nextEntry] };
    });
  };

  const handleCreatePipeline = async () => {
    updatePipelineState({ error: '' });

    if (!pipelineState.wizardDeliveryMethod) {
      updatePipelineState({ error: 'Select a pipeline type.' });
      return;
    }

    if (pipelineState.wizardDeliveryMethod === 'cloudformation_git_sync') {
      updatePipelineState({ error: 'Use Enable Git Sync to configure this pipeline.' });
      return;
    }

    if (pipelineState.wizardDeliveryMethod !== 'github_actions') {
      updatePipelineState({
        error: 'Pipeline creation is only available for GitHub Actions right now.',
      });
      return;
    }

    if (!['cloudformation', 'terraform', 'opentofu'].includes(iacMethod)) {
      updatePipelineState({
        error: 'Select CloudFormation or Terraform/OpenTofu before creating a pipeline.',
      });
      return;
    }

    if (!repoConfigured) {
      updatePipelineState({ error: 'Select a GitHub repository first.' });
      return;
    }

    if (!pipelineBranch) {
      updatePipelineState({ error: 'Select a branch for the pipeline.' });
      return;
    }

    if (!pipelineState.wizardOidcReady) {
      updatePipelineState({ error: 'Launch the OIDC template and confirm it is deployed.' });
      return;
    }

    if (accountIdError) {
      updatePipelineState({ error: accountIdError });
      return;
    }

    if (stateBucketError) {
      updatePipelineState({ error: stateBucketError });
      return;
    }

    updatePipelineState({
      pipelineOpsStatus: 'loading',
      pipelineOpsMessage: 'Creating pipeline PR...',
      pipelineToolEvents: [],
      pipelineCreated: false,
    });

    try {
      const result = await executeOperation(
        'github:pipeline:create',
        {
          workloadId,
          workloadName: workloadName || null,
          iacMethod,
          gitRepo: {
            connectionId: gitRepo.connectionId,
            owner: gitRepo.owner,
            repo: gitRepo.repo,
            fullName: gitRepo.fullName || undefined,
            branch: pipelineBranch,
          },
          pipelineConfig: {
            autoDeploy: pipelineState.wizardAutoDeploy,
            requireApproval: pipelineState.wizardRequireApproval,
            branch: pipelineBranch,
            awsAccountId: trimmedAccountId || null,
            awsRoleName: pipelineState.wizardRoleName || null,
            awsRoleArn: computedRoleArn || null,
          },
          stateConfig: stateBucketRequired
            ? { bucket: trimmedStateBucket }
            : null,
        },
        {},
        {
          onToolEvent: (eventType, payload) => {
            upsertPipelineToolEvent(eventType, payload);
          },
        }
      );

      const body = result?.body || {};
      let details = null;
      if (typeof body?.details === 'string') {
        try {
          details = JSON.parse(body.details);
        } catch (_) {
          details = null;
        }
      } else if (body?.details && typeof body.details === 'object') {
        details = body.details;
      }

      if (body?.success === false) {
        updatePipelineState({
          pipelineOpsStatus: 'error',
          pipelineOpsMessage: body?.message || 'Failed to create pipeline PR.',
          pipelineOpsDetails: details,
        });
        return;
      }

      const prUrl = details?.pullRequestUrl || '';
      updatePipelineState({
        pipelineOpsStatus: 'success',
        pipelineOpsMessage: prUrl
          ? `Pipeline PR created: ${prUrl}`
          : 'Pipeline PR created.',
        pipelineOpsDetails: details,
        pipelineCreated: true,
        mode: 'create',
      });

      setFormData((prev) => ({
        ...prev,
        deploymentPreferences: {
          ...prev.deploymentPreferences,
          deliveryMethod: pipelineState.wizardDeliveryMethod,
          ...(stateBucketRequired
            ? {
                stateSource: 's3',
                stateBucket: trimmedStateBucket,
              }
            : {}),
          pipelineConfig: {
            ...(prev.deploymentPreferences?.pipelineConfig || {}),
            autoDeploy: pipelineState.wizardAutoDeploy,
            requireApproval: pipelineState.wizardRequireApproval,
            branch: pipelineBranch,
            awsAccountId: trimmedAccountId || null,
            awsRoleName: pipelineState.wizardRoleName || null,
            awsRoleArn: computedRoleArn || null,
          },
        },
      }));
    } catch (error) {
      updatePipelineState({
        pipelineOpsStatus: 'error',
        pipelineOpsMessage: error?.message || 'Failed to create pipeline PR.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {isCloudFormation && (
          <div className="flex items-center justify-between gap-3">
            <div>
              Recommended: CloudFormation Git Sync for fast, minimal setup.
              {!repoConfigured && (
                <span className="ml-1 text-xs text-amber-700">
                  Connect a GitHub repo to enable it.
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updatePipelineState({
                  mode: 'create',
                  wizardDeliveryMethod: 'cloudformation_git_sync',
                  pipelineCreated: false,
                  pipelineOpsStatus: 'idle',
                  pipelineOpsMessage: '',
                  error: '',
                })
              }
              disabled={!repoConfigured}
            >
              Use Git Sync
            </Button>
          </div>
        )}
        {isTerraform && (
          <div className="flex items-center justify-between gap-3">
            <div>
              Recommended: GitHub Actions for Terraform/OpenTofu deployments.
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updatePipelineState({
                  mode: 'create',
                  wizardDeliveryMethod: 'github_actions',
                  pipelineCreated: false,
                  pipelineOpsStatus: 'idle',
                  pipelineOpsMessage: '',
                  error: '',
                })
              }
            >
              Use GitHub Actions
            </Button>
          </div>
        )}
        {!isCloudFormation && !isTerraform && (
          <div>Choose a pipeline that fits your workflow.</div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => handlePipelineModeSelect('none')}
          className={`rounded-lg border px-4 py-3 text-left transition ${
            pipelineState.mode === 'none'
              ? 'border-primary-400 bg-primary-50'
              : 'border-slate-200 bg-white hover:border-primary-200'
          }`}
        >
          <div className="text-sm font-semibold text-slate-800">No pipeline</div>
          <div className="text-xs text-slate-500">
            Skip pipeline setup for now and manage deployments manually.
          </div>
        </button>
        <button
          type="button"
          onClick={() => handlePipelineModeSelect('existing')}
          className={`rounded-lg border px-4 py-3 text-left transition ${
            pipelineState.mode === 'existing'
              ? 'border-primary-400 bg-primary-50'
              : 'border-slate-200 bg-white hover:border-primary-200'
          }`}
        >
          <div className="text-sm font-semibold text-slate-800">Existing pipeline</div>
          <div className="text-xs text-slate-500">
            I already have a pipeline that deploys this workload.
          </div>
        </button>
        <button
          type="button"
          onClick={() => handlePipelineModeSelect('create')}
          className={`rounded-lg border px-4 py-3 text-left transition ${
            pipelineState.mode === 'create'
              ? 'border-primary-400 bg-primary-50'
              : 'border-slate-200 bg-white hover:border-primary-200'
          }`}
        >
          <div className="text-sm font-semibold text-slate-800">Create new pipeline</div>
          <div className="text-xs text-slate-500">
            Generate a pipeline and workflow automatically.
          </div>
        </button>
      </div>

      {pipelineState.mode === 'none' && (
        <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
          This workload will be created without an automated pipeline. You can add one later.
        </div>
      )}

      {pipelineState.mode === 'existing' && (
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="space-y-3">
            <div>
              <Label className="mb-2 block">Pipeline type</Label>
              <Select
                value={pipelineState.existingType || ''}
                onValueChange={handleExistingPipelineType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select pipeline type" />
                </SelectTrigger>
                <SelectContent>
                  {existingPipelineChoices.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={pipelineState.existingConfirmed}
                onChange={(event) => handleExistingPipelineConfirm(event.target.checked)}
              />
              I confirm an existing pipeline will deploy this workload.
            </label>
          </div>
        </div>
      )}

      {pipelineState.mode === 'create' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select pipeline type</Label>
            <div className="grid gap-2 md:grid-cols-2">
              {pipelineChoices.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  onClick={() =>
                    updatePipelineState({
                      wizardDeliveryMethod: option.value,
                      pipelineCreated: false,
                      pipelineOpsStatus: 'idle',
                      pipelineOpsMessage: '',
                      error: '',
                    })
                  }
                  className={`rounded-md border px-4 py-3 text-left text-sm transition ${
                    pipelineState.wizardDeliveryMethod === option.value
                      ? 'border-primary-400 bg-primary-50'
                      : 'border-slate-200 bg-white hover:border-primary-200'
                  } ${option.disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <div className="font-semibold text-slate-800">{option.label}</div>
                  {option.helper && (
                    <div className="text-xs text-amber-600">{option.helper}</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {!pipelineState.wizardDeliveryMethod ? (
            <div className="text-xs text-slate-500">
              Select a pipeline type to configure the details.
            </div>
          ) : isGitSyncSelection ? (
            <div className="rounded-md border border-slate-200 bg-white p-4 space-y-4">
              <div className="text-sm text-slate-700">
                Git Sync connects CloudFormation to your GitHub repo and branch.
              </div>
              <div className="text-xs text-slate-500">
                Repo: {gitRepo?.fullName || 'Not connected'}
              </div>
              <div className="text-xs text-slate-500">
                Branch: {pipelineBranch || 'Not set'}
              </div>
              {pipelineState.gitSyncRegion && (
                <div className="text-xs text-slate-500">
                  Region: {pipelineState.gitSyncRegion}
                </div>
              )}

              <div className="grid gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300"
                    checked={gitSyncAutoCreateConnection}
                    onChange={(event) =>
                      updatePipelineState({
                        gitSyncAutoCreateConnection: event.target.checked,
                        pipelineCreated: false,
                        pipelineOpsStatus: 'idle',
                        pipelineOpsMessage: '',
                        pipelineToolEvents: [],
                      })
                    }
                  />
                  Create a new CodeConnections connection
                </label>
                <div className="space-y-2">
                  <Label>CodeConnections connection ARN</Label>
                  <Input
                    value={pipelineState.gitSyncConnectionArn}
                    onChange={(event) =>
                      updatePipelineState({
                        gitSyncConnectionArn: event.target.value,
                        pipelineCreated: false,
                        pipelineOpsStatus: 'idle',
                        pipelineOpsMessage: '',
                        pipelineToolEvents: [],
                      })
                    }
                    placeholder="arn:aws:codeconnections:us-east-1:123456789012:connection/abc123"
                    disabled={gitSyncAutoCreateConnection}
                  />
                  <div className="text-xs text-slate-500">
                    Use an existing AWS CodeConnections connection linked to your GitHub org.
                  </div>
                </div>
                {gitSyncAutoCreateConnection && (
                  <div className="space-y-2">
                    <Label>Connection name</Label>
                    <Input
                      value={pipelineState.gitSyncConnectionName}
                      onChange={(event) =>
                        updatePipelineState({
                          gitSyncConnectionName: event.target.value,
                          pipelineCreated: false,
                          pipelineOpsStatus: 'idle',
                          pipelineOpsMessage: '',
                          pipelineToolEvents: [],
                        })
                      }
                      placeholder="cloudagent-github-connection"
                    />
                    <div className="text-xs text-slate-500">
                      You will need to authorize the new connection in AWS Console.
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>CloudFormation stack name</Label>
                  <Input
                    value={pipelineState.gitSyncStackName}
                    onChange={(event) =>
                      updatePipelineState({
                        gitSyncStackName: event.target.value,
                        pipelineCreated: false,
                        pipelineOpsStatus: 'idle',
                        pipelineOpsMessage: '',
                        pipelineToolEvents: [],
                      })
                    }
                    placeholder="my-workload-stack"
                  />
                  <div className="text-xs text-slate-500">
                    Use letters, numbers, hyphens, or underscores only (no spaces).
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Stack deployment file path</Label>
                  <Input
                    value={pipelineState.gitSyncConfigFile}
                    onChange={(event) =>
                      updatePipelineState({
                        gitSyncConfigFile: event.target.value,
                        pipelineCreated: false,
                        pipelineOpsStatus: 'idle',
                        pipelineOpsMessage: '',
                        pipelineToolEvents: [],
                      })
                    }
                    placeholder="cloudformation.yaml"
                  />
                  <div className="text-xs text-slate-500">
                    Path to the stack deployment file in the repo.
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-300"
                      checked={gitSyncAutoCreateRole}
                      onChange={(event) =>
                        updatePipelineState({
                          gitSyncAutoCreateRole: event.target.checked,
                          pipelineCreated: false,
                          pipelineOpsStatus: 'idle',
                          pipelineOpsMessage: '',
                          pipelineToolEvents: [],
                        })
                      }
                    />
                    Create a Git Sync service role
                  </label>
                  <Label>Git Sync service role ARN</Label>
                  <Input
                    value={pipelineState.gitSyncRoleArn}
                    onChange={(event) =>
                      updatePipelineState({
                        gitSyncRoleArn: event.target.value,
                        pipelineCreated: false,
                        pipelineOpsStatus: 'idle',
                        pipelineOpsMessage: '',
                        pipelineToolEvents: [],
                      })
                    }
                    placeholder="arn:aws:iam::123456789012:role/cloudformation-git-sync"
                    disabled={gitSyncAutoCreateRole}
                  />
                  {gitSyncAutoCreateRole && (
                    <div className="space-y-2">
                      <Label>Role name</Label>
                      <Input
                        value={pipelineState.gitSyncRoleName}
                        onChange={(event) =>
                          updatePipelineState({
                            gitSyncRoleName: event.target.value,
                            pipelineCreated: false,
                            pipelineOpsStatus: 'idle',
                            pipelineOpsMessage: '',
                            pipelineToolEvents: [],
                          })
                        }
                        placeholder="cloudagent-gitsync-role"
                      />
                      <div className="text-xs text-slate-500">
                        CloudAgent will create a role with AdministratorAccess by default.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  updatePipelineState({
                    gitSyncShowAdvanced: !pipelineState.gitSyncShowAdvanced,
                  })
                }
                className="text-xs font-medium text-primary-600"
              >
                {pipelineState.gitSyncShowAdvanced ? 'Hide advanced options' : 'Show advanced options'}
              </button>

              {pipelineState.gitSyncShowAdvanced && (
                <div className="grid gap-3">
                  <div className="space-y-2">
                    <Label>Publish deployment status</Label>
                    <Select
                      value={pipelineState.gitSyncPublishDeploymentStatus}
                      onValueChange={(value) =>
                        updatePipelineState({
                          gitSyncPublishDeploymentStatus: value,
                          pipelineCreated: false,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DISABLED">Disabled</SelectItem>
                        <SelectItem value="ENABLED">Enabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Trigger resource updates</Label>
                    <Select
                      value={pipelineState.gitSyncTriggerResourceUpdateOn}
                      onValueChange={(value) =>
                        updatePipelineState({
                          gitSyncTriggerResourceUpdateOn: value,
                          pipelineCreated: false,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FILE_CHANGE">File changes only</SelectItem>
                        <SelectItem value="ANY_CHANGE">Any change</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Pull request comment</Label>
                    <Select
                      value={pipelineState.gitSyncPullRequestComment}
                      onValueChange={(value) =>
                        updatePipelineState({
                          gitSyncPullRequestComment: value,
                          pipelineCreated: false,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DISABLED">Disabled</SelectItem>
                        <SelectItem value="ENABLED">Enabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Repository link ID (optional)</Label>
                    <Input
                      value={pipelineState.gitSyncRepositoryLinkId}
                      onChange={(event) =>
                        updatePipelineState({
                          gitSyncRepositoryLinkId: event.target.value,
                          pipelineCreated: false,
                        })
                      }
                      placeholder="rl-1234567890"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleEnableGitSync}
                  disabled={!repoConfigured || !pipelineBranch || pipelineState.pipelineOpsStatus === 'loading'}
                >
                  Enable Git Sync
                </Button>
                {pipelineState.pipelineOpsStatus === 'loading' && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {pipelineState.pipelineOpsMessage}
                  </div>
                )}
              </div>

              {pipelineState.pipelineOpsStatus !== 'idle' && (
                <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{pipelineState.pipelineOpsStatus}</Badge>
                    <div className="text-xs text-slate-600">
                      {pipelineState.pipelineOpsMessage}
                    </div>
                  </div>
                  {pipelineState.pipelineToolEvents.length > 0 && (
                    <div className="space-y-1">
                      {pipelineState.pipelineToolEvents.map((event) => (
                        <div key={event.id} className="text-xs text-slate-500">
                          {event.name} - {event.status}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {pipelineState.pipelineOpsStatus === 'success' &&
                gitSyncAutoCreateConnection &&
                connectionConsoleUrl && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-2">
                    <div>
                      Authorize the new CodeConnections connection to finish setup.
                    </div>
                    <a
                      href={connectionConsoleUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-900 underline"
                    >
                      Open AWS Connections console
                    </a>
                  </div>
                )}

              {pipelineState.pipelineCreated && (
                <div className="text-xs text-emerald-600">
                  Git Sync enabled for this workload.
                </div>
              )}
              {pipelineState.error && (
                <div className="text-xs text-red-600">{pipelineState.error}</div>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      Automatic deployment
                    </Label>
                    <div className="text-xs text-slate-500">
                      Deploy when changes land on the configured branch.
                    </div>
                  </div>
                  <Switch
                    checked={pipelineState.wizardAutoDeploy}
                    onCheckedChange={(checked) =>
                      updatePipelineState({ wizardAutoDeploy: checked })
                    }
                    className="data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      Require approval step
                    </Label>
                    <div className="text-xs text-slate-500">
                      Pause before deployment for manual review.
                    </div>
                  </div>
                  <Switch
                    checked={pipelineState.wizardRequireApproval}
                    onCheckedChange={(checked) =>
                      updatePipelineState({ wizardRequireApproval: checked })
                    }
                    className="data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">{pipelineBranchLabel}</Label>
                  {repoConfigured && branchOptions.length > 0 ? (
                    <Select
                      value={pipelineBranch || ''}
                      onValueChange={(value) =>
                        updatePipelineState({
                          wizardBranch: value,
                          ...(isGitSyncSelection ? { pipelineCreated: false } : {}),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branchOptions.map((branch) => (
                          <SelectItem key={branch} value={branch}>
                            {branch}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={pipelineBranch}
                      onChange={(event) =>
                        updatePipelineState({
                          wizardBranch: event.target.value,
                          ...(isGitSyncSelection ? { pipelineCreated: false } : {}),
                        })
                      }
                      placeholder={repoConfigured ? 'Enter branch name' : 'Select a repo first'}
                      disabled={!repoConfigured}
                    />
                  )}
                  {branchesLoading && (
                    <div className="text-xs text-slate-500 mt-2">Loading branches...</div>
                  )}
                  {branchesError && (
                    <div className="text-xs text-red-500 mt-2">{branchesError}</div>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-4 space-y-4">
                <div className="text-sm font-semibold text-slate-800">OIDC setup</div>
                <div className="text-xs text-slate-500">
                  Launch the CloudFormation template before creating the pipeline.
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={oidcTemplateMissing}
                  onClick={() =>
                    saveToFile(
                      JSON.stringify(oidcTemplate, null, '    '),
                      'cloudagent-github-oidc.yaml',
                      'text/yaml'
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download OIDC Template
                </Button>
                {oidcTemplateMissing && (
                  <div className="text-xs text-amber-600">
                    Select a repo and branch before launching the template.
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>AWS Account ID</Label>
                    <Input value={accountId} readOnly placeholder="123456789012" />
                    {accountIdError && (
                      <div className="text-xs text-red-500 mt-1">{accountIdError}</div>
                    )}
                  </div>
                  <div>
                    <Label>IAM Role Name</Label>
                    <Input
                      value={pipelineState.wizardRoleName}
                      onChange={(event) =>
                        updatePipelineState({ wizardRoleName: event.target.value })
                      }
                      placeholder="cloudagent-github-actions"
                    />
                  </div>
                </div>
                <div>
                  <Label>IAM Role ARN</Label>
                  <Input
                    value={computedRoleArn}
                    readOnly
                    placeholder="arn:aws:iam::123456789012:role/cloudagent-github-actions"
                  />
                </div>

                {isTerraform && (
                  <div className="space-y-2">
                    <Label>Terraform/OpenTofu state</Label>
                    <Select
                      value={pipelineState.wizardStateBucketMode}
                      onValueChange={(value) =>
                        updatePipelineState({ wizardStateBucketMode: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No change</SelectItem>
                        <SelectItem value="existing">Use existing S3 bucket</SelectItem>
                        <SelectItem value="create">Create S3 bucket with template</SelectItem>
                      </SelectContent>
                    </Select>
                    {pipelineState.wizardStateBucketMode !== 'none' && (
                      <div>
                        <Input
                          value={pipelineState.wizardStateBucketName}
                          onChange={(event) =>
                            updatePipelineState({
                              wizardStateBucketName: event.target.value,
                            })
                          }
                          placeholder="my-terraform-state-bucket"
                        />
                        {stateBucketError && (
                          <div className="text-xs text-red-500 mt-1">
                            {stateBucketError}
                          </div>
                        )}
                        {pipelineState.wizardStateBucketMode === 'create' && (
                          <div className="text-xs text-amber-600 mt-1">
                            Bucket names must be globally unique.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300"
                    checked={pipelineState.wizardOidcReady}
                    onChange={(event) =>
                      updatePipelineState({ wizardOidcReady: event.target.checked })
                    }
                  />
                  I launched the CloudFormation stack and the role is ready.
                </label>
              </div>

              {pipelineState.error && (
                <div className="text-xs text-red-600">{pipelineState.error}</div>
              )}

              <div className="flex items-center gap-3">
                <Button onClick={handleCreatePipeline}>
                  Create pipeline
                </Button>
                {pipelineState.pipelineOpsStatus === 'loading' && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {pipelineState.pipelineOpsMessage}
                  </div>
                )}
              </div>

              {pipelineState.pipelineOpsStatus !== 'idle' && (
                <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{pipelineState.pipelineOpsStatus}</Badge>
                    <div className="text-xs text-slate-600">
                      {pipelineState.pipelineOpsMessage}
                    </div>
                  </div>
                  {pipelineState.pipelineToolEvents.length > 0 && (
                    <div className="space-y-1">
                      {pipelineState.pipelineToolEvents.map((event) => (
                        <div key={event.id} className="text-xs text-slate-500">
                          {event.name} - {event.status}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default PipelineStep;
