import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle,
  GitBranch,
  Layers,
  Loader2,
  PlayCircle,
} from 'lucide-react';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Stepper } from '@/components/Stepper';
import LaunchStack from '@/components/LaunchStack';
import { listGithubBranches } from '@/api/integrations/github';
import { executeOperation } from '@/api/ops';
import { buildGitRepo } from '@/helpers/github';
import { buildGithubOidcTemplate } from '@/helpers/githubOidc';

const IAC_METHODS = [
  { value: 'cloudformation', label: 'CloudFormation' },
  { value: 'terraform', label: 'Terraform' },
  { value: 'opentofu', label: 'OpenTofu' },
  { value: 'aws_cli', label: 'AWS CLI' },
];

const DELIVERY_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'github_actions', label: 'GitHub Actions', requiresRepo: true },
  {
    value: 'cloudformation_git_sync',
    label: 'CloudFormation Git Sync',
    requiresRepo: true,
    onlyCloudFormation: true,
  },
  { value: 'codepipeline', label: 'CodePipeline/CodeBuild' },
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

function WorkloadDeliveryCard({
  formData,
  setFormData,
  githubConnections = [],
  environmentOptions = [],
  getEnvironmentDisplay = () => '',
  workloadId,
  workloadName,
  allowPipelineWizard = false,
  onAutoSave,
}) {
  const [branchOptions, setBranchOptions] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesError, setBranchesError] = useState('');
  const [environmentSelectValue, setEnvironmentSelectValue] = useState('');
  const [iacModalOpen, setIacModalOpen] = useState(false);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [flowModalOpen, setFlowModalOpen] = useState(false);
  const [destinationModalOpen, setDestinationModalOpen] = useState(false);
  const [pipelineWizardOpen, setPipelineWizardOpen] = useState(false);
  const [pipelineWizardStep, setPipelineWizardStep] = useState(0);
  const [wizardDeliveryMethod, setWizardDeliveryMethod] = useState('');
  const [wizardAutoDeploy, setWizardAutoDeploy] = useState(true);
  const [wizardRequireApproval, setWizardRequireApproval] = useState(false);
  const [wizardBranch, setWizardBranch] = useState('');
  const [wizardAccountId, setWizardAccountId] = useState('');
  const [wizardRoleName, setWizardRoleName] = useState('cloudagent-github-actions');
  const [wizardStateBucketMode, setWizardStateBucketMode] = useState('none');
  const [wizardStateBucketName, setWizardStateBucketName] = useState('');
  const [wizardOidcReady, setWizardOidcReady] = useState(false);
  const [wizardGitSyncAutoCreateConnection, setWizardGitSyncAutoCreateConnection] = useState(true);
  const [wizardGitSyncConnectionArn, setWizardGitSyncConnectionArn] = useState('');
  const [wizardGitSyncConnectionName, setWizardGitSyncConnectionName] = useState('');
  const [wizardGitSyncAutoCreateRole, setWizardGitSyncAutoCreateRole] = useState(true);
  const [wizardGitSyncRoleName, setWizardGitSyncRoleName] = useState('');
  const [wizardGitSyncStackName, setWizardGitSyncStackName] = useState('');
  const [wizardGitSyncConfigFile, setWizardGitSyncConfigFile] = useState('cloudformation.yaml');
  const [wizardGitSyncRoleArn, setWizardGitSyncRoleArn] = useState('');
  const [wizardGitSyncRepositoryLinkId, setWizardGitSyncRepositoryLinkId] = useState('');
  const [pipelineWizardError, setPipelineWizardError] = useState('');
  const [pipelineSubmitting, setPipelineSubmitting] = useState(false);
  const [pipelineOpsOpen, setPipelineOpsOpen] = useState(false);
  const [pipelineOpsStatus, setPipelineOpsStatus] = useState('idle');
  const [pipelineOpsMessage, setPipelineOpsMessage] = useState('');
  const [pipelineOpsDetails, setPipelineOpsDetails] = useState(null);
  const [pipelineToolEvents, setPipelineToolEvents] = useState([]);
  const [expandedToolIds, setExpandedToolIds] = useState(new Set());

  const deploymentPreferences = formData?.deploymentPreferences || {};
  const iacMethod = deploymentPreferences.method || '';
  const deliveryMethod = deploymentPreferences.deliveryMethod || '';
  const gitRepo = buildGitRepo(deploymentPreferences.gitRepo);
  const sourceMode =
    deploymentPreferences.sourceMode || (gitRepo?.fullName ? 'github' : '');
  const stateSource = deploymentPreferences.stateSource || '';
  const stateBucket = deploymentPreferences.stateBucket || '';
  const stateSourceValue = stateSource || 'not_set';
  const pipelineConfig = deploymentPreferences.pipelineConfig || {};
  const pipelineAutoDeploy =
    pipelineConfig.autoDeploy !== undefined ? !!pipelineConfig.autoDeploy : true;
  const pipelineRequireApproval = !!pipelineConfig.requireApproval;
  const pipelineBranch = pipelineConfig.branch || '';
  const pipelineAccountId = pipelineConfig.awsAccountId || '';
  const pipelineRoleName = pipelineConfig.awsRoleName || 'cloudagent-github-actions';
  const pipelineRoleArn = pipelineConfig.awsRoleArn || '';
  const firstEnvironmentAccountId = Array.isArray(formData?.environments)
    ? String(formData.environments[0] || '')
    : '';

  const iacSupportsSettings = ['cloudformation', 'terraform', 'opentofu'].includes(
    iacMethod
  );
  const isTerraform = ['terraform', 'opentofu'].includes(iacMethod);
  const pipelineBranchLabel = isTerraform
    ? 'Terraform/OpenTofu branch'
    : iacMethod === 'cloudformation'
      ? 'CloudFormation branch'
      : 'Deployment branch';
  const showOidcStep = wizardDeliveryMethod === 'github_actions';
  const showGitSyncStep = wizardDeliveryMethod === 'cloudformation_git_sync';

  const isValidSyncResourceName = (value) =>
    /^[0-9A-Za-z]+[0-9A-Za-z_-]*$/.test(value || '');

  const parseRegionFromArn = (arn) => {
    if (!arn) return '';
    const parts = String(arn).split(':');
    return parts.length > 3 ? parts[3] : '';
  };

  const sanitizeSyncResourceName = (value) => {
    if (!value) return '';
    const cleaned = String(value)
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^0-9A-Za-z_-]/g, '');
    const normalized = cleaned.replace(/^[^0-9A-Za-z]+/, '');
    return normalized || 'cloudagent-stack';
  };
  const pipelineWizardSteps = useMemo(
    () =>
      showOidcStep
        ? ['Select pipeline', 'Configure', 'AWS Access', 'Review']
        : ['Select pipeline', 'Configure', 'Review'],
    [showOidcStep]
  );
  const oidcStepIndex = showOidcStep ? 2 : -1;
  const reviewStepIndex = showOidcStep ? 3 : 2;
  const pipelineWizardEnabled = allowPipelineWizard && !!workloadId;

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

  const gitSyncDetails = pipelineOpsDetails || {};
  const gitSyncStackNameFollowup = (gitSyncDetails.stackName || wizardGitSyncStackName || '').trim();
  const gitSyncRepoLabel =
    gitRepo?.fullName || (gitRepo?.owner && gitRepo?.repo ? `${gitRepo.owner}/${gitRepo.repo}` : '');
  const gitSyncBranchFollowup = gitSyncDetails.branch || wizardBranch || gitRepo?.branch || '';
  const gitSyncConfigFileFollowup = gitSyncDetails.configFile || wizardGitSyncConfigFile || '';
  const gitSyncConnectionArnFollowup = gitSyncDetails.connectionArn || wizardGitSyncConnectionArn || '';
  const gitSyncConnectionNameFollowup = gitSyncDetails.connectionName || wizardGitSyncConnectionName || '';
  const gitSyncRegionFollowup =
    gitSyncDetails.region || parseRegionFromArn(gitSyncConnectionArnFollowup);
  const gitSyncRoleArnFollowup = gitSyncDetails.roleArn || wizardGitSyncRoleArn || '';
  const showGitSyncFollowup =
    pipelineOpsStatus === 'success' && wizardDeliveryMethod === 'cloudformation_git_sync';

  const allowedBranches = useMemo(() => {
    if (!selectedRepo?.allowedBranches) return [];
    return selectedRepo.allowedBranches.filter(Boolean);
  }, [selectedRepo]);

  useEffect(() => {
    let isMounted = true;
    const loadBranches = async () => {
      if (sourceMode === 'none') {
        if (isMounted) {
          setBranchOptions([]);
          setBranchesError('');
          setBranchesLoading(false);
        }
        return;
      }
      if (!sourceModalOpen && !flowModalOpen && !pipelineWizardOpen) {
        if (isMounted) {
          setBranchOptions([]);
          setBranchesError('');
          setBranchesLoading(false);
        }
        return;
      }
      if (!iacSupportsSettings) {
        if (isMounted) {
          setBranchOptions([]);
          setBranchesError('');
          setBranchesLoading(false);
        }
        return;
      }
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
  }, [
    selectedConnectionId,
    selectedRepo,
    allowedBranches,
    iacSupportsSettings,
    sourceMode,
    sourceModalOpen,
    flowModalOpen,
    pipelineWizardOpen,
  ]);

  const updateDeploymentPreferences = (patch) => {
    setFormData((prev) => ({
      ...prev,
      deploymentPreferences: {
        ...prev.deploymentPreferences,
        ...patch,
      },
    }));
  };

  const updatePipelineConfig = (patch) => {
    setFormData((prev) => {
      const current = prev.deploymentPreferences?.pipelineConfig || {};
      return {
        ...prev,
        deploymentPreferences: {
          ...prev.deploymentPreferences,
          pipelineConfig: patch ? { ...current, ...patch } : null,
        },
      };
    });
  };

  const updateGitRepo = (patch) => {
    setFormData((prev) => ({
      ...prev,
      deploymentPreferences: {
        ...prev.deploymentPreferences,
        sourceMode: patch ? 'github' : prev.deploymentPreferences.sourceMode,
        gitRepo: patch ? { ...(prev.deploymentPreferences.gitRepo || {}), ...patch } : null,
      },
    }));
  };

  const updateSourceMode = (nextMode) => {
    setFormData((prev) => ({
      ...prev,
      deploymentPreferences: {
        ...prev.deploymentPreferences,
        sourceMode: nextMode,
        gitRepo: nextMode === 'none' ? null : prev.deploymentPreferences.gitRepo,
      },
    }));
  };

  const environmentLabels = useMemo(() => {
    if (!Array.isArray(formData?.environments)) return [];
    return formData.environments
      .map((env) => ({
        value: env,
        label: getEnvironmentDisplay(env),
      }))
      .filter((item) => item.label);
  }, [formData?.environments, getEnvironmentDisplay]);

  // Derive display values and states
  const iacLabel =
    IAC_METHODS.find((option) => option.value === iacMethod)?.label || null;
  const iacConfigured = !!iacMethod;
  const iacIsSuboptimal = iacMethod === 'aws_cli';

  const repoConfigured = !!gitRepo?.fullName;
  const sourceExplicitNone = sourceMode === 'none';
  const repoShortName = gitRepo?.fullName
    ? gitRepo.fullName.split('/').pop()
    : null;
  const repoBranch = gitRepo?.branch || null;
  // Source is required for Terraform/OpenTofu
  const sourceRequired = isTerraform;
  const stateSourceMissing = isTerraform && repoConfigured && stateSourceValue === 'not_set';
  const sourceIsWarning = sourceRequired && !repoConfigured && !sourceExplicitNone;
  const sourceValue = sourceExplicitNone ? 'No source' : repoShortName;

  const flowLabel =
    DELIVERY_OPTIONS.find((option) => option.value === deliveryMethod)?.label || null;
  const flowConfigured = !!deliveryMethod;
  const flowIsSuboptimal = deliveryMethod === 'manual';
  const flowRequiresRepo = deliveryMethod === 'github_actions' && !repoConfigured;
  const flowStatus = flowConfigured
    ? flowRequiresRepo
      ? 'warning'
      : flowIsSuboptimal
        ? 'suboptimal'
        : 'configured'
    : 'unconfigured';
  const pipelineBranchDisplay = pipelineBranch || gitRepo?.branch || '';
  const pipelineSummaryParts = [];
  if (deliveryMethod && deliveryMethod !== 'manual') {
    pipelineSummaryParts.push(pipelineAutoDeploy ? 'Auto deploy' : 'Manual trigger');
    if (pipelineRequireApproval) {
      pipelineSummaryParts.push('Approval step');
    }
    if (pipelineBranchDisplay) {
      pipelineSummaryParts.push(`Branch ${pipelineBranchDisplay}`);
    }
  }
  const flowSubValue = pipelineSummaryParts.length
    ? pipelineSummaryParts.join(' · ')
    : null;

  const destinationCount = environmentLabels.length;
  const destinationConfigured = destinationCount > 0;

  // Pipeline stage component
  // status: 'configured' | 'suboptimal' | 'warning' | 'unconfigured'
  const PipelineStage = ({
    icon: Icon,
    label,
    value,
    subValue,
    status = 'unconfigured',
    onClick,
    disabled = false,
    customContent,
    warningMessage,
  }) => {
    const baseClasses = `
      relative flex flex-col items-center justify-center p-3 rounded-lg
      min-w-[100px] flex-1 cursor-pointer transition-all duration-200
      hover:shadow-md group
    `;
    
    const statusClasses = {
      configured: 'bg-gradient-to-b from-emerald-50 to-white border-2 border-emerald-200 hover:border-emerald-300',
      suboptimal: 'bg-gradient-to-b from-amber-50 to-white border-2 border-amber-200 hover:border-amber-300',
      warning: 'bg-gradient-to-b from-orange-50 to-white border-2 border-dashed border-orange-300 hover:border-orange-400',
      unconfigured: 'bg-gradient-to-b from-slate-50 to-white border-2 border-dashed border-slate-200 hover:border-slate-300',
    };

    const iconBgClasses = {
      configured: 'bg-emerald-100 text-emerald-600',
      suboptimal: 'bg-amber-100 text-amber-600',
      warning: 'bg-orange-100 text-orange-500',
      unconfigured: 'bg-slate-100 text-slate-400',
    };

    const badgeClasses = {
      configured: 'bg-emerald-500',
      suboptimal: 'bg-amber-500',
      warning: 'bg-orange-500',
      unconfigured: '',
    };

    const disabledClasses = disabled
      ? 'opacity-50 cursor-not-allowed hover:shadow-none'
      : '';

    const showBadge = status !== 'unconfigured';
    const BadgeIcon = status === 'warning' ? AlertTriangle : (status === 'suboptimal' ? AlertTriangle : Check);

    return (
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        className={`${baseClasses} ${statusClasses[status]} ${disabledClasses}`}
        disabled={disabled}
      >
        {/* Status badge */}
        {showBadge && (
          <div className={`absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-white shadow-sm ${badgeClasses[status]}`}>
            <BadgeIcon className="h-3 w-3" />
          </div>
        )}

        {/* Icon */}
        <div className={`flex h-10 w-10 items-center justify-center rounded-full mb-2 ${iconBgClasses[status]}`}>
          <Icon className="h-5 w-5" />
        </div>

        {/* Label */}
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">
          {label}
        </div>

        {/* Custom content or default value display */}
        {customContent || (
          <>
            {/* Value */}
            <div
              className={`text-sm font-semibold truncate max-w-full px-1 ${
                status !== 'unconfigured' ? 'text-slate-800' : 'text-slate-400'
              }`}
              title={value || 'Not set'}
            >
              {value || 'Not set'}
            </div>

            {/* Sub-value */}
            {subValue && (
              <div className="text-[11px] text-slate-500 truncate max-w-full px-1" title={subValue}>
                {subValue}
              </div>
            )}
          </>
        )}

        {/* Disabled tooltip */}
        {disabled && (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-2 py-1 rounded shadow-sm border">
            Configure IaC first
          </div>
        )}

        {/* Warning tooltip for suboptimal/warning states */}
        {!disabled && (status === 'suboptimal' || status === 'warning') && (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-2 py-1 rounded shadow-sm border border-amber-200">
            {status === 'warning'
              ? warningMessage || 'Required for IaC type'
              : 'Consider automation'}
          </div>
        )}
      </button>
    );
  };

  // Connector arrow component
  const PipelineConnector = () => (
    <div className="flex items-center justify-center px-1 flex-shrink-0">
      <div className="flex items-center">
        <div className="w-6 h-0.5 bg-gradient-to-r from-slate-200 to-slate-300" />
        <ArrowRight className="h-4 w-4 text-slate-300 -ml-1" />
      </div>
    </div>
  );

  // Helper to get cloud provider icon
  const getCloudIcon = (envLabel) => {
    const label = (envLabel || '').toLowerCase();
    if (label.includes('azure') || label.includes('microsoft')) {
      return <Icons.azure className="h-4 w-4" style={{ objectFit: 'contain' }} />;
    }
    if (label.includes('gcp') || label.includes('google')) {
      return <Icons.gcp className="h-4 w-4" style={{ objectFit: 'contain' }} />;
    }
    // Default to AWS icon (most common case)
    return <Icons.aws className="h-4 w-4" />;
  };

  // Extract environment name without account ID
  const getEnvDisplayName = (label) => {
    if (!label) return '';
    // If format is "Name (123456789012)", extract just the name
    const match = label.match(/^(.+?)\s*\(\d{12}\)$/);
    return match ? match[1].trim() : label;
  };

  // Determine statuses
  const iacStatus = iacConfigured ? (iacIsSuboptimal ? 'suboptimal' : 'configured') : 'unconfigured';
  const sourceStatus = sourceExplicitNone
    ? sourceRequired
      ? 'warning'
      : 'configured'
    : repoConfigured && !stateSourceMissing
      ? 'configured'
      : sourceIsWarning || stateSourceMissing
        ? 'warning'
        : 'unconfigured';
  const destinationStatus = destinationConfigured ? 'configured' : 'unconfigured';

  // Count properly configured stages (not suboptimal/warning)
  const fullyConfiguredCount = [
    iacConfigured && !iacIsSuboptimal,
    sourceStatus === 'configured',
    flowConfigured && !flowIsSuboptimal && !flowRequiresRepo,
    destinationConfigured,
  ].filter(Boolean).length;

  const totalConfiguredCount = [
    iacConfigured,
    sourceExplicitNone ? !sourceRequired : repoConfigured,
    flowConfigured,
    destinationConfigured,
  ].filter(Boolean).length;

  const sourceWarningMessage = sourceExplicitNone && sourceRequired
    ? 'Source required for Terraform/OpenTofu'
    : sourceIsWarning
      ? 'Repository required for IaC type'
      : stateSourceMissing
        ? 'State source required for Terraform/OpenTofu'
        : null;
  const sourceSubValue = (() => {
    if (sourceExplicitNone) return null;
    if (!repoConfigured) return repoBranch ? `${repoBranch}` : null;
    if (!isTerraform) return repoBranch ? `${repoBranch}` : null;
    const stateLabel =
      stateSourceValue === 's3'
        ? `State: ${stateBucket || 'S3'}`
        : 'State: Not set';
    if (repoBranch) return `${repoBranch} · ${stateLabel}`;
    return stateLabel;
  })();

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
  }, [gitRepo?.branch, setFormData]);

  useEffect(() => {
    if (!pipelineWizardOpen) return;
    const defaultMethod =
      deliveryMethod && deliveryMethod !== 'manual'
        ? deliveryMethod
        : repoConfigured
          ? 'github_actions'
          : '';
    setPipelineWizardStep(0);
    setWizardDeliveryMethod(defaultMethod);
    setWizardAutoDeploy(pipelineAutoDeploy);
    setWizardRequireApproval(pipelineRequireApproval);
    setWizardBranch(pipelineBranch || gitRepo?.branch || '');
    setWizardAccountId(firstEnvironmentAccountId || pipelineAccountId || '');
    setWizardRoleName(pipelineRoleName || 'cloudagent-github-actions');
    const defaultStateMode = stateSource === 's3' ? 'existing' : 'none';
    setWizardStateBucketMode(isTerraform ? defaultStateMode : 'none');
    setWizardStateBucketName(isTerraform ? stateBucket || '' : '');
    setWizardOidcReady(!!pipelineRoleArn);
    setWizardGitSyncAutoCreateConnection(!pipelineConfig.connectionArn);
    setWizardGitSyncConnectionArn(pipelineConfig.connectionArn || '');
    setWizardGitSyncConnectionName(pipelineConfig.connectionName || '');
    setWizardGitSyncAutoCreateRole(!pipelineConfig.roleArn);
    setWizardGitSyncRoleName(pipelineConfig.roleName || '');
    const defaultStackName = pipelineConfig.stackName
      || (workloadName ? sanitizeSyncResourceName(workloadName) : '');
    setWizardGitSyncStackName(defaultStackName);
    setWizardGitSyncConfigFile(pipelineConfig.configFile || 'cloudformation.yaml');
    setWizardGitSyncRoleArn(pipelineConfig.roleArn || '');
    setWizardGitSyncRepositoryLinkId(pipelineConfig.repositoryLinkId || '');
    setPipelineWizardError('');
  }, [
    pipelineWizardOpen,
    deliveryMethod,
    repoConfigured,
    pipelineAutoDeploy,
    pipelineRequireApproval,
    pipelineBranch,
    firstEnvironmentAccountId,
    pipelineAccountId,
    pipelineRoleName,
    pipelineRoleArn,
    isTerraform,
    stateSource,
    stateBucket,
    gitRepo?.branch,
    pipelineConfig.connectionArn,
    pipelineConfig.connectionName,
    pipelineConfig.roleName,
    pipelineConfig.stackName,
    pipelineConfig.configFile,
    pipelineConfig.roleArn,
    pipelineConfig.repositoryLinkId,
    workloadName,
  ]);

  useEffect(() => {
    if (!firstEnvironmentAccountId) {
      setWizardAccountId('');
      return;
    }
    setWizardAccountId(firstEnvironmentAccountId);
  }, [firstEnvironmentAccountId]);

  useEffect(() => {
    if (wizardDeliveryMethod !== 'cloudformation_git_sync') return;
    if (wizardGitSyncStackName) return;
    if (workloadName) {
      setWizardGitSyncStackName(sanitizeSyncResourceName(workloadName));
    }
  }, [wizardDeliveryMethod, wizardGitSyncStackName, workloadName]);

  useEffect(() => {
    if (!wizardGitSyncAutoCreateConnection) return;
    if (wizardGitSyncConnectionName) return;
    const fallbackName = gitRepo?.owner && gitRepo?.repo
      ? `cloudagent-${gitRepo.owner}-${gitRepo.repo}`
      : workloadName
        ? `cloudagent-${workloadName.replace(/\s+/g, '-').toLowerCase()}`
        : 'cloudagent-connection';
    setWizardGitSyncConnectionName(fallbackName);
  }, [wizardGitSyncAutoCreateConnection, wizardGitSyncConnectionName, gitRepo?.owner, gitRepo?.repo, workloadName]);

  useEffect(() => {
    if (!wizardGitSyncAutoCreateRole) return;
    if (wizardGitSyncRoleName) return;
    const fallbackName = workloadName
      ? `cloudagent-gitsync-${workloadName.replace(/\s+/g, '-').toLowerCase()}`
      : 'cloudagent-gitsync-role';
    setWizardGitSyncRoleName(fallbackName);
  }, [wizardGitSyncAutoCreateRole, wizardGitSyncRoleName, workloadName]);

  useEffect(() => {
    setPipelineWizardStep((prev) => Math.min(prev, pipelineWizardSteps.length - 1));
  }, [pipelineWizardSteps.length]);

  useEffect(() => {
    if (pipelineToolEvents.length === 0) return;
    setExpandedToolIds((prev) => {
      const next = new Set(prev);
      pipelineToolEvents.forEach((event) => {
        if (event.isErrored && event.id) {
          next.add(event.id);
        }
      });
      return next;
    });
  }, [pipelineToolEvents]);

  const upsertPipelineToolEvent = (eventType, payload) => {
    if (!payload) return;
    setPipelineToolEvents((prev) => {
      const pickFirst = (candidates) => {
        for (const candidate of candidates) {
          if (typeof candidate === 'string') {
            const trimmed = candidate.trim();
            if (trimmed) return trimmed;
          } else if (typeof candidate === 'number' && !Number.isNaN(candidate)) {
            return String(candidate);
          }
        }
        return null;
      };

      const identifierCandidates = [
        payload.toolCallId,
        payload.tool_call_id,
        payload.callId,
        payload.call_id,
        payload.id,
        payload.tool?.id,
        payload.toolId,
      ];
      const identifier = pickFirst(identifierCandidates);

      const nameCandidates = [
        payload.name,
        payload.toolName,
        payload.tool?.name,
        payload.tool_type,
        payload.type,
        payload.action,
      ];
      const rawName = pickFirst(nameCandidates);

      const statusDefault = eventType === 'tool_result' ? 'completed' : 'in_progress';
      const rawStatus =
        typeof payload.status === 'string' && payload.status.trim()
          ? payload.status.trim()
          : statusDefault;
      const normalizedStatus = String(rawStatus).toLowerCase();

      const isErrored =
        ['failed', 'error', 'errored', 'rejected'].includes(normalizedStatus) ||
        (!!payload.error && payload.error !== '');
      const isCompleted =
        (!isErrored &&
          ['completed', 'complete', 'success', 'succeeded', 'done', 'resolved'].includes(
            normalizedStatus
          )) ||
        (eventType === 'tool_result' && !isErrored);

      let existingIndex = -1;
      if (identifier) {
        existingIndex = prev.findIndex(
          (item) => item.identifier === identifier || item.id === identifier
        );
      }
      if (existingIndex === -1 && !identifier && rawName) {
        for (let i = prev.length - 1; i >= 0; i -= 1) {
          const candidate = prev[i];
          if (candidate.rawName === rawName && !candidate.isCompleted) {
            existingIndex = i;
            break;
          }
        }
      }

      const generateLocalId = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          return crypto.randomUUID();
        }
        return `pipeline-tool-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
      };

      const nextEntry = {
        id: (existingIndex >= 0 && prev[existingIndex]?.id) || identifier || generateLocalId(),
        identifier: identifier || null,
        rawName,
        name: formatToolName(rawName),
        status: rawStatus,
        normalizedStatus,
        isCompleted,
        isErrored,
        message: payload.message ?? null,
        error: payload.error ?? null,
        input: payload.input ?? null,
        output: payload.output ?? null,
        content: payload.content ?? null,
        updatedAt: Date.now(),
      };

      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = nextEntry;
        return next;
      }
      return [...prev, nextEntry];
    });
  };

  const formatPayloadValue = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch (_) {
      return String(value);
    }
  };

  const toggleToolDetails = (id) => {
    if (!id) return;
    setExpandedToolIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const trimmedAccountId = wizardAccountId.trim();
  const accountIdError = trimmedAccountId
    ? !/^\d{12}$/.test(trimmedAccountId)
      ? 'AWS Account ID must be 12 digits.'
      : ''
    : 'Select an AWS environment first.';
  const computedRoleArn =
    trimmedAccountId && wizardRoleName
      ? `arn:aws:iam::${trimmedAccountId}:role/${wizardRoleName}`
      : '';
  const effectiveRoleArn = computedRoleArn;
  const trimmedStateBucket = wizardStateBucketName.trim();
  const stateBucketRequired = isTerraform && wizardStateBucketMode !== 'none';
  const stateBucketError = stateBucketRequired && !trimmedStateBucket
    ? 'Enter an S3 bucket name for state.'
    : '';
  const oidcBranch = wizardBranch || gitRepo?.branch || '';
  const oidcTemplate = useMemo(
    () =>
      buildGithubOidcTemplate({
        owner: gitRepo?.owner,
        repo: gitRepo?.repo,
        branch: oidcBranch || 'main',
        roleName: wizardRoleName || 'cloudagent-github-actions',
        stateBucketName: stateBucketRequired ? trimmedStateBucket : '',
        createStateBucket: stateBucketRequired && wizardStateBucketMode === 'create',
      }),
    [
      gitRepo?.owner,
      gitRepo?.repo,
      oidcBranch,
      wizardRoleName,
      trimmedStateBucket,
      wizardStateBucketMode,
    ]
  );
  const oidcTemplateMissing =
    !gitRepo?.owner || !gitRepo?.repo || !oidcBranch || (stateBucketRequired && !trimmedStateBucket);

  const pipelineChoices = [
    {
      value: 'cloudformation_git_sync',
      label: 'CloudFormation Git Sync',
      description: 'Connect CloudFormation directly to your GitHub repo.',
      disabled: !repoConfigured || iacMethod !== 'cloudformation',
      helper:
        iacMethod !== 'cloudformation'
          ? 'Select CloudFormation as your IaC method.'
          : 'Connect a repo in Source first.',
    },
    {
      value: 'github_actions',
      label: 'GitHub Actions',
      description: 'Generate a workflow in the linked GitHub repository.',
      disabled: !repoConfigured,
      helper: 'Connect a repo in Source first.',
    },
    {
      value: 'codepipeline',
      label: 'CodePipeline/CodeBuild',
      description: 'Create a managed pipeline inside AWS.',
      disabled: true,
      helper: 'Not available in the wizard yet.',
    },
  ];

  const handlePipelineWizardNext = () => {
    setPipelineWizardStep((prev) => Math.min(prev + 1, pipelineWizardSteps.length - 1));
  };

  const handlePipelineWizardBack = () => {
    setPipelineWizardStep((prev) => Math.max(prev - 1, 0));
  };

  const handlePipelineWizardSubmit = async () => {
    if (!wizardDeliveryMethod) return;
    const targetBranch = (wizardBranch || gitRepo?.branch || '').trim();

    if (!pipelineWizardEnabled) {
      setPipelineWizardError('Save this workload to enable pipeline setup.');
      return;
    }

    if (
      wizardDeliveryMethod !== 'github_actions' &&
      wizardDeliveryMethod !== 'cloudformation_git_sync'
    ) {
      setPipelineWizardError(
        'Pipeline creation is only available for GitHub Actions or CloudFormation Git Sync right now.'
      );
      return;
    }

    if (
      wizardDeliveryMethod === 'github_actions' &&
      !['cloudformation', 'terraform', 'opentofu'].includes(iacMethod)
    ) {
      setPipelineWizardError(
        'Select CloudFormation or Terraform/OpenTofu before creating a pipeline.'
      );
      return;
    }

    if (wizardDeliveryMethod === 'cloudformation_git_sync' && iacMethod !== 'cloudformation') {
      setPipelineWizardError('Select CloudFormation as the IaC method to enable Git Sync.');
      return;
    }

    if (!gitRepo?.connectionId || !gitRepo?.owner || !gitRepo?.repo) {
      setPipelineWizardError(
        'Select a GitHub repository before creating a pipeline.'
      );
      return;
    }

    if (!targetBranch) {
      setPipelineWizardError('Select a branch for the pipeline.');
      return;
    }

    if (showOidcStep) {
      if (!wizardOidcReady) {
        setPipelineWizardError('Launch the OIDC template and confirm it is deployed.');
        return;
      }
      if (accountIdError) {
        setPipelineWizardError(accountIdError);
        return;
      }
      if (!effectiveRoleArn) {
        setPipelineWizardError('Provide the IAM role details from the OIDC setup.');
        return;
      }
      if (stateBucketError) {
        setPipelineWizardError(stateBucketError);
        return;
      }
    }

    if (wizardDeliveryMethod === 'cloudformation_git_sync') {
      if (!wizardGitSyncAutoCreateConnection && !wizardGitSyncConnectionArn.trim()) {
        setPipelineWizardError('Enter a CodeConnections connection ARN or choose to create one.');
        return;
      }
      if (wizardGitSyncAutoCreateConnection && !wizardGitSyncConnectionName.trim()) {
        setPipelineWizardError('Enter a connection name to create.');
        return;
      }
      if (!wizardGitSyncStackName.trim()) {
        setPipelineWizardError('Enter a CloudFormation stack name.');
        return;
      }
      if (!isValidSyncResourceName(wizardGitSyncStackName.trim())) {
        setPipelineWizardError(
          'Stack name must be alphanumeric and may include "-" or "_" only.'
        );
        return;
      }
      if (!wizardGitSyncConfigFile.trim()) {
        setPipelineWizardError('Enter the stack deployment file path.');
        return;
      }
      if (!wizardGitSyncAutoCreateRole && !wizardGitSyncRoleArn.trim()) {
        setPipelineWizardError('Enter the Git Sync IAM role ARN.');
        return;
      }
      if (wizardGitSyncAutoCreateRole && !wizardGitSyncRoleName.trim()) {
        setPipelineWizardError('Enter a role name to create.');
        return;
      }
    }

    if (pipelineSubmitting) return;
    setPipelineWizardError('');

    setPipelineSubmitting(true);
    setPipelineWizardOpen(false);
    setFlowModalOpen(false);
    setPipelineOpsOpen(true);
    setPipelineOpsStatus('loading');
    setPipelineOpsMessage(
      wizardDeliveryMethod === 'cloudformation_git_sync'
        ? 'Configuring Git Sync...'
        : 'Creating pipeline PR...'
    );
    setPipelineOpsDetails(null);
    setPipelineToolEvents([]);
    setExpandedToolIds(new Set());

    try {
      const result =
        wizardDeliveryMethod === 'cloudformation_git_sync'
          ? await executeOperation(
              'cloudformation:git-sync:configure',
              {
                accountId: wizardAccountId || '',
                connectionArn: wizardGitSyncAutoCreateConnection
                  ? null
                  : wizardGitSyncConnectionArn.trim(),
                connectionName: wizardGitSyncAutoCreateConnection
                  ? wizardGitSyncConnectionName.trim()
                  : null,
                providerType: 'GitHub',
                ownerId: gitRepo.owner,
                repositoryName: gitRepo.repo,
                branch: targetBranch,
                configFile: wizardGitSyncConfigFile.trim(),
                stackName: wizardGitSyncStackName.trim(),
                roleArn: wizardGitSyncAutoCreateRole ? null : wizardGitSyncRoleArn.trim(),
                autoCreateRole: wizardGitSyncAutoCreateRole,
                roleName: wizardGitSyncAutoCreateRole ? wizardGitSyncRoleName.trim() : null,
                repositoryLinkId: wizardGitSyncRepositoryLinkId.trim() || null,
              },
              {},
              {
                onToolEvent: (eventType, payload) => {
                  upsertPipelineToolEvent(eventType, payload);
                },
              }
            )
          : await executeOperation(
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
                  branch: targetBranch,
                },
                pipelineConfig: {
                  autoDeploy: wizardAutoDeploy,
                  requireApproval: wizardRequireApproval,
                  branch: targetBranch,
                  awsAccountId: wizardAccountId || null,
                  awsRoleName: wizardRoleName || null,
                  awsRoleArn: effectiveRoleArn || null,
                },
                stateConfig: stateBucketRequired
                  ? {
                      bucket: trimmedStateBucket,
                    }
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
        setPipelineOpsDetails(details);
        setPipelineOpsStatus('error');
        setPipelineOpsMessage(
          body?.message ||
            (wizardDeliveryMethod === 'cloudformation_git_sync'
              ? 'Failed to configure Git Sync.'
              : 'Failed to create pipeline PR.')
        );
        return;
      }

      const prUrl = details?.pullRequestUrl || '';
      setPipelineOpsDetails(details);
      setPipelineOpsStatus('success');
      setPipelineOpsMessage(
        wizardDeliveryMethod === 'cloudformation_git_sync'
          ? 'Git Sync configured.'
          : prUrl
            ? `Pipeline PR created: ${prUrl}`
            : 'Pipeline PR created.'
      );

      const nextFormData = {
        ...formData,
        deploymentPreferences: {
          ...(formData?.deploymentPreferences || {}),
          deliveryMethod: wizardDeliveryMethod,
          ...(wizardDeliveryMethod === 'cloudformation_git_sync'
            ? {
                pipelineConfig: {
                  ...(formData?.deploymentPreferences?.pipelineConfig || {}),
                  branch: targetBranch,
                  connectionArn:
                    details?.connectionArn ||
                    wizardGitSyncConnectionArn.trim() ||
                    null,
                  connectionName:
                    details?.connectionName ||
                    wizardGitSyncConnectionName.trim() ||
                    null,
                  ownerId: gitRepo.owner,
                  repositoryName: gitRepo.repo,
                  configFile: wizardGitSyncConfigFile.trim(),
                  stackName: wizardGitSyncStackName.trim(),
                  roleArn:
                    details?.roleArn ||
                    wizardGitSyncRoleArn.trim() ||
                    null,
                  roleName:
                    details?.roleName ||
                    wizardGitSyncRoleName.trim() ||
                    null,
                  repositoryLinkId:
                    details?.repositoryLinkId ||
                    wizardGitSyncRepositoryLinkId.trim() ||
                    null,
                },
              }
            : {}),
          ...(stateBucketRequired && wizardDeliveryMethod === 'github_actions'
            ? {
                stateSource: 's3',
                stateBucket: trimmedStateBucket,
              }
            : {}),
          ...(wizardDeliveryMethod === 'github_actions'
            ? {
                pipelineConfig: {
                  ...(formData?.deploymentPreferences?.pipelineConfig || {}),
                  autoDeploy: wizardAutoDeploy,
                  requireApproval: wizardRequireApproval,
                  branch: targetBranch,
                  awsAccountId: wizardAccountId || null,
                  awsRoleName: wizardRoleName || null,
                  awsRoleArn: effectiveRoleArn || null,
                },
              }
            : {}),
        },
      };

      setFormData(nextFormData);

      if (typeof onAutoSave === 'function') {
        try {
          await onAutoSave(nextFormData);
        } catch (saveError) {
          setPipelineOpsMessage(
            `${
              wizardDeliveryMethod === 'cloudformation_git_sync'
                ? 'Git Sync configured.'
                : prUrl
                  ? `Pipeline PR created: ${prUrl}`
                  : 'Pipeline PR created.'
            } Auto-save failed.`
          );
        }
      }
    } catch (error) {
      setPipelineOpsStatus('error');
      setPipelineOpsMessage(
        error?.message ||
          (wizardDeliveryMethod === 'cloudformation_git_sync'
            ? 'Failed to configure Git Sync.'
            : 'Failed to create pipeline PR.')
      );
    } finally {
      setPipelineSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-gray-900">
          Deployment Configuration
        </div>
        <div className="text-xs text-slate-400">
          {totalConfiguredCount}/4 configured
          {fullyConfiguredCount !== totalConfiguredCount && (
            <span className="text-amber-500 ml-1">
              ({totalConfiguredCount - fullyConfiguredCount} needs attention)
            </span>
          )}
        </div>
      </div>

      {/* Horizontal pipeline */}
      <div className="flex items-stretch justify-between gap-1">
        <PipelineStage
          icon={GitBranch}
          label="Source"
          value={sourceValue}
          subValue={sourceSubValue}
          status={sourceStatus}
          warningMessage={sourceWarningMessage}
          onClick={() => setSourceModalOpen(true)}
        />

        <PipelineConnector />

        <PipelineStage
          icon={Layers}
          label="Tooling"
          value={iacLabel}
          status={iacStatus}
          onClick={() => setIacModalOpen(true)}
        />

        <PipelineConnector />

        <PipelineStage
          icon={PlayCircle}
          label="Pipeline"
          value={flowLabel}
          subValue={flowSubValue}
          status={flowStatus}
          onClick={() => setFlowModalOpen(true)}
        />

        <PipelineConnector />

        <PipelineStage
          icon={Layers}
          label="Destination"
          status={destinationStatus}
          onClick={() => setDestinationModalOpen(true)}
          customContent={
            destinationConfigured ? (
              <div className="flex flex-col items-center gap-1 w-full px-1">
                <div className="text-sm font-semibold text-slate-800">
                  {destinationCount} env{destinationCount > 1 ? 's' : ''}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-full">
                  {environmentLabels.slice(0, 2).map((env, idx) => (
                    <div 
                      key={env.value || idx} 
                      className="flex items-center gap-1 bg-slate-100 rounded px-1.5 py-0.5"
                      title={env.label}
                    >
                      {getCloudIcon(env.label)}
                      <span className="text-[10px] text-slate-600 truncate max-w-[60px]">
                        {getEnvDisplayName(env.label)}
                      </span>
                    </div>
                  ))}
                  {environmentLabels.length > 2 && (
                    <span className="text-[10px] text-slate-500">
                      +{environmentLabels.length - 2}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm font-semibold text-slate-400">Not set</div>
            )
          }
        />
      </div>

      {(!deliveryMethod || deliveryMethod === 'manual') && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2">
          <div className="text-xs text-slate-500">
            <span className="font-medium text-slate-600">
              {deliveryMethod === 'manual' ? 'Manual deployment selected.' : 'No pipeline configured.'}
            </span>{' '}
            {pipelineWizardEnabled
              ? 'Use the wizard to set up an automated pipeline.'
              : 'Save this workload to enable pipeline setup.'}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setPipelineWizardOpen(true)}
            className="shrink-0 text-xs"
            disabled={!pipelineWizardEnabled || pipelineSubmitting}
          >
            Launch wizard
          </Button>
        </div>
      )}

      <Dialog open={iacModalOpen} onOpenChange={setIacModalOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>Infrastructure Tooling</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 -mt-2 mb-4">
            Choose the Infrastructure as Code (IaC) framework used to define and manage your cloud resources. 
            This determines how your infrastructure templates are processed and deployed.
          </p>
          <div className="space-y-2">
            <Label>Select tooling method</Label>
            <Select
              value={iacMethod || ''}
              onValueChange={(value) => updateDeploymentPreferences({ method: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select tooling" />
              </SelectTrigger>
              <SelectContent>
                {IAC_METHODS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIacModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sourceModalOpen} onOpenChange={setSourceModalOpen}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Source Code</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 -mt-2 mb-4">
            Connect this workload to a Git repository containing your infrastructure code. 
            Select the branch that represents your source of truth for deployments.
          </p>
          <div className="space-y-3">
            <div>
              <Label className="mb-2 block">Source mode</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="sourceMode"
                    value="github"
                    checked={sourceMode !== 'none'}
                    onChange={() => updateSourceMode('github')}
                  />
                  GitHub repository
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="sourceMode"
                    value="none"
                    checked={sourceMode === 'none'}
                    onChange={() => updateSourceMode('none')}
                  />
                  No source code
                </label>
              </div>
            </div>
            {sourceMode === 'none' ? (
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                This workload does not require a source repository.
              </div>
            ) : githubConnections.length === 0 ? (
              <div className="text-sm text-gray-500">
                No GitHub connections configured yet.
              </div>
            ) : (
              <>
                <div>
                  <Label>GitHub Connection</Label>
                  <Select
                    value={selectedConnectionId || ''}
                    onValueChange={(value) => {
                      if (!value) {
                        updateGitRepo(null);
                        return;
                      }
                      updateGitRepo({
                        connectionId: value,
                        owner: '',
                        repo: '',
                        fullName: '',
                        branch: '',
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select connection" />
                    </SelectTrigger>
                    <SelectContent>
                      {githubConnections.map((connection) => (
                        <SelectItem key={connection.id} value={connection.id}>
                          {connection.displayName || 'GitHub'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Repository</Label>
                  <Select
                    value={selectedRepoKey || ''}
                    onValueChange={(value) => {
                      const repo = repoOptions.find((item) => item.fullName === value);
                      if (!repo) {
                        updateGitRepo({
                          owner: '',
                          repo: '',
                          fullName: '',
                          branch: '',
                        });
                        return;
                      }
                      const defaultBranch =
                        gitRepo?.branch ||
                        repo.defaultBranch ||
                        (Array.isArray(repo.allowedBranches) && repo.allowedBranches[0]) ||
                        '';
                      updateGitRepo({
                        owner: repo.owner || '',
                        repo: repo.name || '',
                        fullName: repo.fullName || '',
                        branch: defaultBranch,
                      });
                    }}
                    disabled={!selectedConnectionId}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          selectedConnectionId
                            ? 'Select repository'
                            : 'Select connection first'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {repoOptions.map((repo) => (
                        <SelectItem key={repo.fullName} value={repo.fullName}>
                          {repo.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Base Branch</Label>
                  <Select
                    value={gitRepo?.branch || ''}
                    onValueChange={(value) => updateGitRepo({ branch: value })}
                    disabled={!selectedRepo}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          selectedRepo ? 'Select branch' : 'Select repository first'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {branchOptions.map((branch) => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {branchesLoading && (
                    <div className="text-xs text-gray-500">Loading branches…</div>
                  )}
                  {branchesError && (
                    <div className="text-xs text-red-500">{branchesError}</div>
                  )}
                </div>
                {isTerraform && (
                  <div className="space-y-2">
                    <Label>State source</Label>
                    <Select
                      value={stateSourceValue}
                      onValueChange={(value) =>
                        updateDeploymentPreferences({
                          stateSource: value === 'not_set' ? null : value,
                          stateBucket: value === 's3' ? stateBucket : '',
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Not set" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_set">Not set</SelectItem>
                        <SelectItem value="s3">S3 bucket</SelectItem>
                      </SelectContent>
                    </Select>
                    {stateSource === 's3' && (
                      <Input
                        value={stateBucket || ''}
                        onChange={(event) =>
                          updateDeploymentPreferences({
                            stateBucket: event.target.value,
                          })
                        }
                        placeholder="State bucket name"
                      />
                    )}
                    {stateSourceValue === 'not_set' && repoConfigured && (
                      <div className="text-xs text-amber-600">
                        State source is required for Terraform/OpenTofu. Select an S3
                        bucket.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSourceModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={flowModalOpen} onOpenChange={setFlowModalOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>Deployment Pipeline</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 -mt-2 mb-4">
            Define how infrastructure changes are delivered to your environments. 
            Automated pipelines (GitHub Actions, CodePipeline) provide consistency and auditability, 
            while manual deployments offer more control.
          </p>
          <div className="space-y-2">
            <Label>Select deployment method</Label>
            <Select
              value={deliveryMethod || ''}
              onValueChange={(value) =>
                updateDeploymentPreferences({
                  deliveryMethod: value || null,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select pipeline type" />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_OPTIONS.map((option) => {
                  const disabled =
                    (option.requiresRepo && !repoConfigured) ||
                    (option.onlyCloudFormation && iacMethod !== 'cloudformation');
                  return (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      disabled={disabled}
                    >
                      {disabled
                        ? option.onlyCloudFormation && iacMethod !== 'cloudformation'
                          ? `${option.label} (CloudFormation only)`
                          : option.requiresRepo && !repoConfigured
                            ? `${option.label} (requires repo)`
                            : option.label
                        : option.label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          {deliveryMethod && deliveryMethod !== 'manual' && (
            <div className="mt-4 space-y-4 rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-deploy" className="text-sm font-medium text-slate-700">
                    Automatic deployment
                  </Label>
                  <div className="text-xs text-slate-500">
                    Deploy when changes land on the configured branch.
                  </div>
                </div>
                <Switch
                  id="auto-deploy"
                  checked={pipelineAutoDeploy}
                  onCheckedChange={(checked) =>
                    updatePipelineConfig({ autoDeploy: checked })
                  }
                  className="data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="require-approval" className="text-sm font-medium text-slate-700">
                    Require approval step
                  </Label>
                  <div className="text-xs text-slate-500">
                    Pause before deployment for manual review.
                  </div>
                </div>
                <Switch
                  id="require-approval"
                  checked={pipelineRequireApproval}
                  onCheckedChange={(checked) =>
                    updatePipelineConfig({ requireApproval: checked })
                  }
                  className="data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600"
                />
              </div>

              <div>
                <Label className="mb-2 block">{pipelineBranchLabel}</Label>
                <Select
                  value={pipelineBranchDisplay || ''}
                  onValueChange={(value) => updatePipelineConfig({ branch: value })}
                  disabled={!selectedRepo}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selectedRepo
                          ? 'Select a branch'
                          : 'Select a repository first'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {branchOptions.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {branchesLoading && (
                  <div className="text-xs text-slate-500 mt-2">
                    Loading branches…
                  </div>
                )}
                {branchesError && (
                  <div className="text-xs text-red-500 mt-2">{branchesError}</div>
                )}
                {!branchesLoading && selectedRepo && branchOptions.length === 0 && (
                  <div className="text-xs text-slate-500 mt-2">
                    No branches available for this repository.
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlowModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pipelineWizardOpen} onOpenChange={setPipelineWizardOpen}>
        <DialogContent className="bg-white max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pipeline Setup Wizard</DialogTitle>
          </DialogHeader>
          <Stepper steps={pipelineWizardSteps} activeStep={pipelineWizardStep} />

          {pipelineWizardStep === 0 && (
            <div className="space-y-3">
              <div className="text-sm text-slate-500">
                Choose the pipeline you want CloudAgent to create for this workload.
              </div>
              {pipelineChoices.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => setWizardDeliveryMethod(option.value)}
                  className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                    wizardDeliveryMethod === option.value
                      ? 'border-primary-400 bg-primary-50'
                      : 'border-slate-200 bg-white hover:border-primary-200'
                  } ${option.disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <div className="text-sm font-semibold text-slate-800">
                    {option.label}
                  </div>
                  <div className="text-xs text-slate-500">
                    {option.description}
                  </div>
                  {option.disabled && option.helper && (
                    <div className="text-xs text-amber-600 mt-1">
                      {option.helper}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {pipelineWizardStep === 1 && (
            <div className="space-y-4">
              {showGitSyncStep ? (
                <>
                  <div className="text-sm text-slate-500">
                    Connect CloudFormation to your GitHub repo and choose the stack
                    definition file to sync.
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300"
                        checked={wizardGitSyncAutoCreateConnection}
                        onChange={(event) =>
                          setWizardGitSyncAutoCreateConnection(event.target.checked)
                        }
                      />
                      Create a new CodeConnections connection
                    </label>
                    <div className="space-y-2">
                      <Label>CodeConnections connection ARN</Label>
                      <Input
                        value={wizardGitSyncConnectionArn}
                        onChange={(event) =>
                          setWizardGitSyncConnectionArn(event.target.value)
                        }
                        placeholder="arn:aws:codeconnections:us-east-1:123456789012:connection/abc123"
                        disabled={wizardGitSyncAutoCreateConnection}
                      />
                      <div className="text-xs text-slate-500">
                        Use an existing CodeConnections connection or create one.
                      </div>
                    </div>
                    {wizardGitSyncAutoCreateConnection && (
                      <div className="space-y-2">
                        <Label>Connection name</Label>
                        <Input
                          value={wizardGitSyncConnectionName}
                          onChange={(event) =>
                            setWizardGitSyncConnectionName(event.target.value)
                          }
                          placeholder="cloudagent-github-connection"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>CloudFormation stack name</Label>
                      <Input
                        value={wizardGitSyncStackName}
                        onChange={(event) => setWizardGitSyncStackName(event.target.value)}
                        placeholder="my-workload-stack"
                      />
                      <div className="text-xs text-slate-500">
                        Use letters, numbers, hyphens, or underscores only (no spaces).
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Stack deployment file path</Label>
                      <Input
                        value={wizardGitSyncConfigFile}
                        onChange={(event) => setWizardGitSyncConfigFile(event.target.value)}
                        placeholder="cloudformation.yaml"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-slate-300"
                          checked={wizardGitSyncAutoCreateRole}
                          onChange={(event) =>
                            setWizardGitSyncAutoCreateRole(event.target.checked)
                          }
                        />
                        Create a Git Sync service role
                      </label>
                      <Label>Git Sync service role ARN</Label>
                      <Input
                        value={wizardGitSyncRoleArn}
                        onChange={(event) => setWizardGitSyncRoleArn(event.target.value)}
                        placeholder="arn:aws:iam::123456789012:role/cloudformation-git-sync"
                        disabled={wizardGitSyncAutoCreateRole}
                      />
                      {wizardGitSyncAutoCreateRole && (
                        <div className="space-y-2">
                          <Label>Role name</Label>
                          <Input
                            value={wizardGitSyncRoleName}
                            onChange={(event) =>
                              setWizardGitSyncRoleName(event.target.value)
                            }
                            placeholder="cloudagent-gitsync-role"
                          />
                          <div className="text-xs text-slate-500">
                            CloudAgent will create a role with AdministratorAccess by default.
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Repository link ID (optional)</Label>
                      <Input
                        value={wizardGitSyncRepositoryLinkId}
                        onChange={(event) =>
                          setWizardGitSyncRepositoryLinkId(event.target.value)
                        }
                        placeholder="rl-1234567890"
                      />
                    </div>
                    <div>
                      <Label className="mb-2 block">{pipelineBranchLabel}</Label>
                      {selectedRepo && branchOptions.length > 0 ? (
                        <Select
                          value={wizardBranch || gitRepo?.branch || ''}
                          onValueChange={(value) => setWizardBranch(value)}
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
                          value={wizardBranch}
                          onChange={(event) => setWizardBranch(event.target.value)}
                          placeholder={
                            selectedRepo
                              ? 'Enter branch name'
                              : 'Select a repository first'
                          }
                          disabled={!selectedRepo}
                        />
                      )}
                      {branchesLoading && (
                        <div className="text-xs text-slate-500 mt-2">
                          Loading branches…
                        </div>
                      )}
                      {branchesError && (
                        <div className="text-xs text-red-500 mt-2">{branchesError}</div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm text-slate-500">
                    Configure how the pipeline should run and which branch it follows.
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">
                        Automatic deployment
                      </Label>
                      <div className="text-xs text-slate-500">
                        Deploy when changes land on the configured branch.
                      </div>
                    </div>
                    <Switch
                      checked={wizardAutoDeploy}
                      onCheckedChange={(checked) => setWizardAutoDeploy(checked)}
                      className="data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">
                        Require approval step
                      </Label>
                      <div className="text-xs text-slate-500">
                        Pause before deployment for manual review.
                      </div>
                    </div>
                    <Switch
                      checked={wizardRequireApproval}
                      onCheckedChange={(checked) => setWizardRequireApproval(checked)}
                      className="data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600"
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">{pipelineBranchLabel}</Label>
                    {selectedRepo && branchOptions.length > 0 ? (
                      <Select
                        value={wizardBranch || gitRepo?.branch || ''}
                        onValueChange={(value) => setWizardBranch(value)}
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
                        value={wizardBranch}
                        onChange={(event) => setWizardBranch(event.target.value)}
                        placeholder={
                          selectedRepo
                            ? 'Enter branch name'
                            : 'Select a repository first'
                        }
                        disabled={!selectedRepo}
                      />
                    )}
                    {branchesLoading && (
                      <div className="text-xs text-slate-500 mt-2">
                        Loading branches…
                      </div>
                    )}
                    {branchesError && (
                      <div className="text-xs text-red-500 mt-2">{branchesError}</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {showOidcStep && pipelineWizardStep === oidcStepIndex && (
            <div className="space-y-4">
              <div className="text-sm text-slate-500">
                Set up AWS OIDC so GitHub Actions can assume an IAM role before we
                create the workflow PR.
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-3">
                <div className="text-xs text-slate-600">
                  This CloudFormation template creates an OIDC provider and IAM
                  role scoped to {gitRepo?.fullName || 'your repository'} on
                  branch {oidcBranch || 'main'}.
                </div>
                <div className="text-xs text-amber-600">
                  Note: The template defaults to AdministratorAccess. Adjust the
                  managed policy in the CloudFormation console if you want least
                  privilege.
                </div>
                <LaunchStack
                  cfTemplate={JSON.stringify(oidcTemplate, null, '    ')}
                  isMissingRequiredConfiguration={oidcTemplateMissing}
                  artifactTitle="cloudagent-github-oidc"
                  label="Launch OIDC Template"
                />
                {oidcTemplateMissing && (
                  <div className="text-xs text-amber-600">
                    Select a repo and branch before launching the template.
                  </div>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>AWS Account ID</Label>
                  <Input
                    value={wizardAccountId}
                    placeholder="123456789012"
                    readOnly
                  />
                  {accountIdError && (
                    <div className="text-xs text-red-500 mt-1">
                      {accountIdError}
                    </div>
                  )}
                </div>
                <div>
                  <Label>IAM Role Name</Label>
                  <Input
                    value={wizardRoleName}
                    onChange={(event) => setWizardRoleName(event.target.value)}
                    placeholder="cloudagent-github-actions"
                  />
                </div>
              </div>
              <div>
                <Label>IAM Role ARN</Label>
                <Input
                  value={computedRoleArn}
                  placeholder="arn:aws:iam::123456789012:role/cloudagent-github-actions"
                  readOnly
                />
                <div className="text-xs text-slate-500 mt-1">
                  This value is derived from the account and role name.
                </div>
              </div>
              {isTerraform && (
                <div className="space-y-2">
                  <Label>Terraform/OpenTofu state</Label>
                  <Select
                    value={wizardStateBucketMode}
                    onValueChange={(value) => setWizardStateBucketMode(value)}
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
                  {wizardStateBucketMode !== 'none' && (
                    <div>
                      <Input
                        value={wizardStateBucketName}
                        onChange={(event) =>
                          setWizardStateBucketName(event.target.value)
                        }
                        placeholder="my-terraform-state-bucket"
                      />
                      {stateBucketError && (
                        <div className="text-xs text-red-500 mt-1">
                          {stateBucketError}
                        </div>
                      )}
                      {wizardStateBucketMode === 'create' && (
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
                  className="h-3.5 w-3.5 border border-slate-300"
                  checked={wizardOidcReady}
                  onChange={(event) => setWizardOidcReady(event.target.checked)}
                />
                I launched the CloudFormation stack and the role is ready.
              </label>
            </div>
          )}

          {pipelineWizardStep === reviewStepIndex && (
            <div className="space-y-4">
              <div className="text-sm text-slate-500">
                Review the pipeline settings CloudAgent will use to set up your
                deployment flow.
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 space-y-2">
                <div>
                  <span className="font-medium">Pipeline:</span>{' '}
                  {DELIVERY_OPTIONS.find((option) => option.value === wizardDeliveryMethod)?.label ||
                    'Not set'}
                </div>
                <div>
                  <span className="font-medium">Trigger:</span>{' '}
                  {wizardAutoDeploy ? 'Automatic' : 'Manual'}
                </div>
                <div>
                  <span className="font-medium">Approval:</span>{' '}
                  {wizardRequireApproval ? 'Required' : 'None'}
                </div>
                <div>
                  <span className="font-medium">Branch:</span>{' '}
                  {wizardBranch || gitRepo?.branch || 'Not set'}
                </div>
                {showGitSyncStep && (
                  <>
                    <div>
                      <span className="font-medium">Stack:</span>{' '}
                      {wizardGitSyncStackName || 'Not set'}
                    </div>
                    <div>
                      <span className="font-medium">Config file:</span>{' '}
                      {wizardGitSyncConfigFile || 'Not set'}
                    </div>
                    <div>
                      <span className="font-medium">Role ARN:</span>{' '}
                      {wizardGitSyncRoleArn || 'Not set'}
                    </div>
                    <div>
                      <span className="font-medium">Connection:</span>{' '}
                      {wizardGitSyncConnectionArn || wizardGitSyncConnectionName || 'Not set'}
                    </div>
                  </>
                )}
                {isTerraform && wizardStateBucketMode !== 'none' && (
                  <div>
                    <span className="font-medium">State:</span>{' '}
                    S3 bucket {trimmedStateBucket || 'Not set'}
                  </div>
                )}
                {showOidcStep && (
                  <div>
                    <span className="font-medium">IAM Role:</span>{' '}
                    {effectiveRoleArn || 'Not set'}
                  </div>
                )}
              </div>
              <div className="text-xs text-slate-500">
                CloudAgent will open a PR in your repo to add the workflow file.
              </div>
            </div>
          )}
          {pipelineWizardError && (
            <div className="text-xs text-red-600">{pipelineWizardError}</div>
          )}

          <DialogFooter>
            <div className="flex w-full items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setPipelineWizardOpen(false)}
              >
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                {pipelineWizardStep > 0 && (
                  <Button variant="outline" onClick={handlePipelineWizardBack}>
                    Back
                  </Button>
                )}
                {pipelineWizardStep < pipelineWizardSteps.length - 1 && (
                  <Button
                    onClick={handlePipelineWizardNext}
                    disabled={
                      (!wizardDeliveryMethod && pipelineWizardStep === 0) || pipelineSubmitting
                    }
                  >
                    Next
                  </Button>
                )}
                {pipelineWizardStep === pipelineWizardSteps.length - 1 && (
                  <Button onClick={handlePipelineWizardSubmit} disabled={pipelineSubmitting}>
                    {pipelineSubmitting ? 'Creating...' : 'Create pipeline'}
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pipelineOpsOpen} onOpenChange={setPipelineOpsOpen}>
        <DialogContent className="bg-white max-w-xl">
          <DialogHeader>
            <DialogTitle>Pipeline Setup Progress</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              {pipelineOpsStatus === 'loading' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                  <span>Running operations…</span>
                </>
              )}
                {pipelineOpsStatus === 'success' && (
                  <>
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span>
                      {wizardDeliveryMethod === 'cloudformation_git_sync'
                        ? 'Git Sync configured.'
                        : 'Pipeline PR created.'}
                    </span>
                  </>
                )}
              {pipelineOpsStatus === 'error' && (
                <>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span>Pipeline setup failed.</span>
                </>
              )}
            </div>
            {pipelineOpsMessage && (
              <div className="text-xs text-slate-500 break-words">
                {pipelineOpsMessage}
              </div>
            )}
            {pipelineOpsStatus === 'error' && pipelineOpsDetails && (
              <div className="rounded-md border border-red-200 bg-red-50/60 p-3 text-xs text-red-700">
                <div className="font-semibold mb-1">Failure details</div>
                <pre className="whitespace-pre-wrap break-words">
                  {formatPayloadValue(pipelineOpsDetails)}
                </pre>
              </div>
            )}
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-600 mb-2">
                Operations
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {pipelineToolEvents.length === 0 && (
                  <div className="text-xs text-slate-500">
                    Waiting for tool activity...
                  </div>
                )}
                {pipelineToolEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-md bg-white px-3 py-2 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        {event.isErrored ? (
                          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                        ) : event.isCompleted ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400 mt-0.5" />
                        )}
                        <div>
                          <div className="text-xs font-medium text-slate-700">
                            {event.name || 'Tool call'}
                          </div>
                          {event.isErrored && event.error && (
                            <div className="text-[11px] text-red-600 break-words">
                              {String(event.error)}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleToolDetails(event.id)}
                        className="text-[10px] uppercase tracking-wide text-slate-400"
                      >
                        {expandedToolIds.has(event.id) ? 'Hide' : 'Details'}
                      </button>
                    </div>
                    {expandedToolIds.has(event.id) && (
                      <div className="mt-2 space-y-2 text-[11px] text-slate-600">
                        {event.input !== null && (
                          <div>
                            <div className="font-semibold text-slate-500">Input</div>
                            <pre className="whitespace-pre-wrap break-words bg-slate-50 p-2 rounded border border-slate-100">
                              {formatPayloadValue(event.input)}
                            </pre>
                          </div>
                        )}
                        {event.output !== null && (
                          <div>
                            <div className="font-semibold text-slate-500">Output</div>
                            <pre className="whitespace-pre-wrap break-words bg-slate-50 p-2 rounded border border-slate-100">
                              {formatPayloadValue(event.output)}
                            </pre>
                          </div>
                        )}
                        {event.content !== null && (
                          <div>
                            <div className="font-semibold text-slate-500">Content</div>
                            <pre className="whitespace-pre-wrap break-words bg-slate-50 p-2 rounded border border-slate-100">
                              {formatPayloadValue(event.content)}
                            </pre>
                          </div>
                        )}
                        {event.message && (
                          <div className="text-slate-500">
                            {formatPayloadValue(event.message)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {showGitSyncFollowup && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900">
                <div className="font-semibold mb-2">
                  Finish Git Sync in CloudFormation
                </div>
                <ol className="list-decimal ml-4 space-y-1 text-emerald-900">
                  <li>Open CloudFormation and choose “Create stack” → “Sync from Git”.</li>
                  <li>
                    Select the connection{gitSyncConnectionNameFollowup ? ` "${gitSyncConnectionNameFollowup}"` : ''}.
                    {gitSyncConnectionArnFollowup && (
                      <span className="block text-[11px] text-emerald-800 break-words">
                        Connection ARN: {gitSyncConnectionArnFollowup}
                      </span>
                    )}
                  </li>
                  <li>
                    Pick repo <span className="font-medium">{gitSyncRepoLabel || 'your repo'}</span> and branch{' '}
                    <span className="font-medium">{gitSyncBranchFollowup || 'main'}</span>.
                  </li>
                  <li>
                    Set stack name to{' '}
                    <span className="font-medium">
                      {gitSyncStackNameFollowup || 'your stack name'}
                    </span>{' '}
                    (must match the Sync Configuration resource name).
                  </li>
                  <li>
                    Set deployment file path to{' '}
                    <span className="font-medium">
                      {gitSyncConfigFileFollowup || 'cloudformation.yaml'}
                    </span>.
                  </li>
                  <li>Complete the wizard to create the stack and enable sync.</li>
                </ol>
                {(gitSyncRoleArnFollowup || gitSyncRegionFollowup) && (
                  <div className="mt-2 text-[11px] text-emerald-800">
                    {gitSyncRegionFollowup && (
                      <div>Region: {gitSyncRegionFollowup}</div>
                    )}
                    {gitSyncRoleArnFollowup && (
                      <div className="break-words">Sync role: {gitSyncRoleArnFollowup}</div>
                    )}
                  </div>
                )}
              </div>
            )}
            {pipelineOpsDetails?.pullRequestUrl && (
              <div className="flex flex-col gap-2 text-xs text-slate-600">
                <div>
                  PR:{' '}
                  <a
                    href={pipelineOpsDetails.pullRequestUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary-600 underline"
                  >
                    {pipelineOpsDetails.pullRequestUrl}
                  </a>
                </div>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => {
                      if (pipelineOpsDetails?.pullRequestUrl) {
                        window.open(
                          pipelineOpsDetails.pullRequestUrl,
                          '_blank',
                          'noopener,noreferrer'
                        );
                      }
                    }}
                  >
                    Review in GitHub
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPipelineOpsOpen(false)}
              disabled={pipelineOpsStatus === 'loading'}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={destinationModalOpen} onOpenChange={setDestinationModalOpen}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Destination Environments</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 -mt-2 mb-4">
            Select the cloud environments where this workload's infrastructure will be deployed. 
            These are the AWS accounts or cloud environments that will receive changes when deployments are triggered.
          </p>
          <div className="space-y-3">
            {environmentLabels.length > 0 ? (
              environmentLabels.map((env) => (
                <div
                  key={env.value}
                  className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-2 py-2"
                >
                  <span className="text-sm text-gray-700 truncate">
                    {env.label}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        environments: (prev.environments || []).filter(
                          (item) => item !== env.value
                        ),
                      }))
                    }
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500">
                No environments selected.
              </div>
            )}
            {environmentOptions.length === 0 ? (
              <div className="text-sm text-gray-500">
                No environments available to add.
              </div>
            ) : (
              <div>
                <Label>Add environment</Label>
                <Select
                  value={environmentSelectValue}
                  onValueChange={(value) => {
                    if (!value) return;
                    setFormData((prev) => {
                      const current = Array.isArray(prev.environments)
                        ? prev.environments
                        : [];
                      if (current.includes(value)) return prev;
                      return {
                        ...prev,
                        environments: [...current, value],
                      };
                    });
                    setEnvironmentSelectValue('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    {environmentOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDestinationModalOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default WorkloadDeliveryCard;
