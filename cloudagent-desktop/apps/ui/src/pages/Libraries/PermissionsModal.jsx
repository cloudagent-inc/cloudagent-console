import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronDown,
  Loader2,
  Search,
  AlertCircle,
  CheckCircle,
  Copy,
  FileDown,
  XCircle,
  PencilIcon,
  PlayCircle,
  RotateCcw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Icons } from '../../components/icons';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import '@fontsource-variable/roboto-mono';
import { Switch } from '@/components/ui/switch';
import {
  createAgentPermissionProfile,
  setIsRegionModalOpen,
  updateAgentConnection,
  updateAgentPermissionProfile,
} from '../../features/agent/agentSlice';
import { useDispatch, useSelector } from 'react-redux';
import LaunchStack from '../../components/LaunchStack';
import {
  getCfTemplateForIamRole,
  getTfTemplateForIamRole,
} from '../../helpers/iamPermissions';
import { saveToFile, generateRandomString, getRegionOptions } from '../../helpers/shared';
import { toLogObject } from '../../helpers/logUtils';
import { validateCreds, validateAwsCredentialsV2 } from '../../api/apigw';
import toast from 'react-hot-toast';
import { Stepper } from '../../components/Stepper';
import {
  validatePermissionProfile,
  createPermissionProfileWorkload,
  normalizeWorkloadId,
  updatePermissionProfilePermissions,
} from '../../api/ops';
import { analytics, ANALYTICS_EVENTS, getAnalyticsRoute } from '../../hooks/useAnalytics';
import { SCAN_ENGINE_AWS_ACCOUNT_IDS } from '@/config/appConfig';
import { fetchAwsOrganizationAccounts } from '../../api/scanner';
import { autoLaunchCisReport } from '../../helpers/autoLaunchCisReport';

// Ops endpoint managed in helpers/ops.js

const TOOL_NAME_LABELS = {
  list_workloads: 'Getting workload details',
  update_workload: 'Updating workload',
  aws_cli_readonly: 'Reviewing AWS configuration',
  azure_cli_readonly: 'Reviewing Azure configuration',
  aws_cfn_operations: 'Updating AWS configuration (CloudFormation)',
  architecture_templates: 'Architecture templates',
  finalize_operation_result: 'Finalizing',
  permission_profile_list: 'Listing permission profiles',
  list_workflows: 'List workflows',
  create_workflow: 'Create workflow',
  create_and_save_custom_blueprint: 'Custom blueprint creator',
  access_agent_run_history: 'Agent run history',
  access_workflow_run_history: 'Workflow run history',
  get_deployment_preferences_summary: 'Deployment preferences',
  start_blueprint_generation: 'Blueprint generator',
  permission_profile_validation: 'Validating Permissions',
};

const formatToolName = (name) => {
  if (!name) return '';
  const normalized = name.trim();
  if (!normalized) return '';
  const lookupKey = normalized.toLowerCase();
  if (lookupKey === 'tool' || lookupKey === 'tool call') {
    return '';
  }
  if (TOOL_NAME_LABELS[lookupKey]) {
    return TOOL_NAME_LABELS[lookupKey];
  }
  if (TOOL_NAME_LABELS[normalized]) {
    return TOOL_NAME_LABELS[normalized];
  }
  const spaced = normalized.replace(/[_-]+/g, ' ');
  return spaced.replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatStatusLabel = (status, fallback = '') => {
  if (!status) return fallback;
  const cleaned = status.replace(/[_-]+/g, ' ').trim();
  if (!cleaned) return fallback;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const formatValueForDisplay = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
};

const createToolEventUpserter = (setEvents) => (eventType, payload) => {
  if (!payload) return;

  setEvents((prevEvents) => {
    const events = [...prevEvents];

    const pickFirstString = (candidates) => {
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

    const generateLocalId = () => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      return `validation-tool-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
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
    const identifier = pickFirstString(identifierCandidates);

    const nameCandidates = [
      payload.name,
      payload.toolName,
      payload.tool?.name,
      payload.tool_type,
      payload.type,
      payload.action,
    ];
    const candidateRawName = pickFirstString(nameCandidates);

    const fallbackStatus = eventType === 'tool_result' ? 'completed' : 'in_progress';
    const rawStatus = payload.status;
    let statusValue = fallbackStatus;
    if (typeof rawStatus === 'string' && rawStatus.trim()) {
      statusValue = rawStatus.trim();
    } else if (rawStatus !== undefined && rawStatus !== null) {
      statusValue = String(rawStatus);
    }
    const normalizedStatus = statusValue.toLowerCase();

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
      existingIndex = events.findIndex(
        (item) => item.identifier === identifier || item.id === identifier
      );
    }

    if (existingIndex === -1 && !identifier && eventType === 'tool_result' && candidateRawName) {
      for (let i = events.length - 1; i >= 0; i -= 1) {
        const candidate = events[i];
        if (candidate.rawName === candidateRawName && !candidate.isCompleted) {
          existingIndex = i;
          break;
        }
      }
    }
    if (existingIndex === -1 && !identifier && eventType === 'tool_result') {
      for (let i = events.length - 1; i >= 0; i -= 1) {
        const candidate = events[i];
        if (candidate.isPlaceholder && !candidate.isCompleted) {
          existingIndex = i;
          break;
        }
      }
    }

    const existingEntry = existingIndex >= 0 ? events[existingIndex] : null;
    const rawName = candidateRawName ?? existingEntry?.rawName ?? null;

    const nextEntry = {
      id: existingEntry?.id ?? identifier ?? generateLocalId(),
      identifier: identifier ?? existingEntry?.identifier ?? null,
      rawName,
      name: rawName ?? existingEntry?.name ?? null,
      status: statusValue,
      normalizedStatus,
      isCompleted,
      isErrored,
      input:
        payload.input !== undefined
          ? payload.input
          : existingEntry?.input !== undefined
            ? existingEntry.input
            : null,
      output:
        payload.output !== undefined
          ? payload.output
          : existingEntry?.output !== undefined
            ? existingEntry.output
            : null,
      content:
        payload.content !== undefined
          ? payload.content
          : existingEntry?.content !== undefined
            ? existingEntry.content
            : null,
      message:
        payload.message !== undefined
          ? payload.message
          : existingEntry?.message !== undefined
            ? existingEntry.message
            : null,
      error:
        payload.error !== undefined
          ? payload.error
          : existingEntry?.error !== undefined
            ? existingEntry.error
            : null,
      lastEventType: eventType,
      updatedAt: Date.now(),
      isPlaceholder: !rawName,
    };

    if (existingIndex >= 0) {
      events[existingIndex] = nextEntry;
    } else {
      events.push(nextEntry);
    }

    return events;
  });
};

const validateAccountId = (accountId) => {
  const cleanAccountId = accountId.replace(/\s+/g, '');

  if (!cleanAccountId) {
    return 'AWS Account ID is required';
  }

  if (!/^\d{12}$/.test(cleanAccountId)) {
    return 'AWS Account ID must be exactly 12 digits';
  }

  return '';
};

const normalizeProfileType = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');

const parseJsonSafe = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) || fallback;
  } catch (_) {
    return fallback;
  }
};

const isAwsAccountPermissionProfile = (profile) => {
  const profileType = normalizeProfileType(profile?.type);
  const authProfile = parseJsonSafe(profile?.authProfile, {});
  const accountId = String(authProfile?.awsAccountId || '').trim();
  return profileType === 'aws account' || (!profileType && !!accountId);
};

const WELL_ARCHITECTED_UPDATE_POLICY = {
  Version: '2012-10-17',
  Statement: [
    {
      Sid: 'AllowWellArchitectedWorkloadDiscovery',
      Effect: 'Allow',
      Action: ['wellarchitected:ListWorkloads'],
      Resource: '*',
    },
    {
      Sid: 'AllowWellArchitectedWorkloadUpdates',
      Effect: 'Allow',
      Action: [
        'wellarchitected:CreateWorkload',
        'wellarchitected:UpdateAnswer',
        'wellarchitected:CreateMilestone',
        'wellarchitected:ListMilestones',
        'wellarchitected:TagResource',
      ],
      Resource: '*',
    },
  ],
};

export const PermissionsModal = ({
  isOpen,
  state,
  setState,
  onCancel,
  onOpenChange,
  recordId,
  requiredPermissions = {},
  isReconnecting = false,
  isDashboard = false,
  isEditing: initialIsEditing = false,
  editingPermission: initialEditingPermission = null,
  presetDescription: initialPresetDescription = '',
  authType: initialAuthType = 'role',
  onComplete,
  cloudProvider = null, // Filter profiles by cloud provider (e.g., 'aws', 'google_workspace')
  environmentType = null, // Explicit onboarding mode (e.g., 'aws_account' | 'aws_org')
  initialManualStep = 0,
}) => {
  const dispatch = useDispatch();
  const normalizedEnvironmentType = normalizeProfileType(environmentType || cloudProvider);
  const isAwsOrgFlow = normalizedEnvironmentType === 'aws org';
  const [activeTab, setActiveTab] = useState('manual');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLimitedWriteEnabled, setIsLimitedWriteEnabled] = useState(true);
  const [isRestrictedEnabled, setIsRestrictedEnabled] = useState(false);
  const [isWellArchitectedUpdateEnabled, setIsWellArchitectedUpdateEnabled] = useState(false);
  const [isAdminEnabled, setIsAdminEnabled] = useState(false);
  const [accessType, setAccessType] = useState('cloudformation');
  const [savePermissions, setSavePermissions] = useState(
    true
  );
  const [buttonLoading, setButtonLoading] = useState(false);
  const [presetName, setPresetName] = useState(
    state.authProfile && state.authProfile.authProfileName
      ? state.authProfile.authProfileName
      : 'Production'
  );
  const [presetDescription, setPresetDescription] = useState('My production environment');
  const [authType, setAuthType] = useState('role');
  const [selectedPermission, setSelectedPermission] = useState(null);
  const [manualStepsModal, setManualStepsModal] = useState(false);
  const [isValidationSuccessful, setIsValidationSuccessful] = useState(false);
  const { userProfile } = useSelector((state) => state.auth);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPermission, setEditingPermission] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [manualStep, setManualStep] = useState(0);
  const [temporaryAccess, setTemporaryAccess] = useState(
   false
  );
  const [showPermissions, setShowPermissions] = useState(false);
  const [selectedTime, setSelectedTime] = useState(24);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissionsModalMode, setPermissionsModalMode] = useState('required');
  const [accountIdError, setAccountIdError] = useState('');
  const [showAccountIdError, setShowAccountIdError] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImage, setCurrentImage] = useState({ src: '', alt: '', title: '' });
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [editedStackArn, setEditedStackArn] = useState('');
  const [deploymentConfirmed, setDeploymentConfirmed] = useState(false);
  const [orgDeploymentConfirmed, setOrgDeploymentConfirmed] = useState(false);
  const [orgAccessType, setOrgAccessType] = useState('stackset-template');
  const [orgStackSetName, setOrgStackSetName] = useState(
    `cloudagent-org-member-role-${generateRandomString(4).toLowerCase()}`
  );
  const [orgStackSetRegion, setOrgStackSetRegion] = useState('us-east-1');
  const [orgStackSetOperationId, setOrgStackSetOperationId] = useState('');
  const [orgMemberRoleName, setOrgMemberRoleName] = useState('');
  const [orgMemberExternalId, setOrgMemberExternalId] = useState('');
  const [orgMemberRoleOverridesTouched, setOrgMemberRoleOverridesTouched] =
    useState(false);
  const [orgAccounts, setOrgAccounts] = useState([]);
  const [orgAccountsLoading, setOrgAccountsLoading] = useState(false);
  const [orgAccountsError, setOrgAccountsError] = useState('');
  const [selectedOrgAccountIds, setSelectedOrgAccountIds] = useState([]);
  const [orgAccountValidationById, setOrgAccountValidationById] = useState({});
  const [isValidatingOrgAccounts, setIsValidatingOrgAccounts] = useState(false);
  const [isCheckingOrgStackSetStatus, setIsCheckingOrgStackSetStatus] = useState(false);
  const [orgStackSetStatus, setOrgStackSetStatus] = useState(null);
  const [orgStackSetStatusError, setOrgStackSetStatusError] = useState('');
  const [isImportingOrgAccounts, setIsImportingOrgAccounts] = useState(false);
  const [regionsDropdownOpen, setRegionsDropdownOpen] = useState(false);
  const regionsDropdownRef = useRef(null);
  const [isValidatingSaved, setIsValidatingSaved] = useState(false);
  const [validatingPermissionId, setValidatingPermissionId] = useState(null);
  const hasTrackedCloudSetupWizardOpenRef = useRef(false);
  const hasTrackedCloudSetupWizardCloseRef = useRef(false);
  const [validationSummary, setValidationSummary] = useState(null);
  const [isValidationSummaryOpen, setIsValidationSummaryOpen] = useState(false);
  const [showUpdatePermissionsDetails, setShowUpdatePermissionsDetails] = useState(false);
  const [lastValidatedPermission, setLastValidatedPermission] = useState(null);
  const [isUpdatingPermissions, setIsUpdatingPermissions] = useState(false);
  const [validationToolEvents, setValidationToolEvents] = useState([]);
  const liveActionsEndRef = useRef(null);
  const upsertValidationToolEvent = useMemo(
    () => createToolEventUpserter(setValidationToolEvents),
    []
  );
  const [isUpdateProgressOpen, setIsUpdateProgressOpen] = useState(false);
  const [updateSummary, setUpdateSummary] = useState({
    status: 'idle',
    success: null,
    message: '',
    reason: '',
    details: null,
  });
  const [updateToolEvents, setUpdateToolEvents] = useState([]);
  const updateActionsEndRef = useRef(null);
  const upsertUpdateToolEvent = useMemo(
    () => createToolEventUpserter(setUpdateToolEvents),
    []
  );
  const hasValidationSummaryDetails = useMemo(() => {
    if (!validationSummary || validationSummary.status !== 'done') return false;
    if (validationSummary.message) return true;
    if (validationSummary.reason) return true;
    if (
      validationSummary.permissionsValid === false &&
      Array.isArray(validationSummary.missingPermissions) &&
      validationSummary.missingPermissions.length > 0
    ) {
      return true;
    }
    return false;
  }, [validationSummary]);
  const deployedOrgAccountIds = useMemo(() => {
    const deployedIds = Array.isArray(orgStackSetStatus?.summary?.deployedAccountIds)
      ? orgStackSetStatus.summary.deployedAccountIds
      : [];
    return new Set(deployedIds.filter(Boolean));
  }, [orgStackSetStatus]);
  const managementAccountId = useMemo(
    () => String(state.accountId || '').trim(),
    [state.accountId]
  );
  const importableOrgAccounts = useMemo(
    () =>
      (Array.isArray(orgAccounts) ? orgAccounts : []).filter(
        (account) => String(account?.id || '').trim() !== managementAccountId
      ),
    [managementAccountId, orgAccounts]
  );
  const orgMemberRoleNameValue = useMemo(
    () => String(orgMemberRoleName || state.authProfile?.roleName || '').trim(),
    [orgMemberRoleName, state.authProfile?.roleName]
  );
  const orgMemberExternalIdValue = useMemo(
    () => String(orgMemberExternalId || state.authProfile?.externalId || '').trim(),
    [orgMemberExternalId, state.authProfile?.externalId]
  );
  const validationStatus = validationSummary?.status || 'idle';
  const isValidationLoading = validationStatus === 'loading';
  const isValidationSuccess =
    validationStatus === 'done' && validationSummary?.permissionsValid === true;
  const isValidationFailure =
    validationStatus === 'done' && validationSummary?.permissionsValid === false;
  const updateStatusState = updateSummary?.status || 'idle';
  const isUpdateLoading = updateStatusState === 'loading';
  const isUpdateSuccess = updateStatusState === 'done' && updateSummary?.success === true;
  const isUpdateFailure = updateStatusState === 'done' && updateSummary?.success === false;
  const [isCreatingProfileWorkload, setIsCreatingProfileWorkload] = useState(false);

  // Filter permission profiles based on cloudProvider/environmentType prop
  const filteredPermissionProfiles = useMemo(() => {
    const profiles = userProfile?.agentPermissionProfiles || [];
    const providerFilter = normalizeProfileType(environmentType || cloudProvider);
    

    
    // If no provider filter specified, return all profiles
    if (!providerFilter) {
      return profiles;
    }

    const filtered = profiles.filter((profile) => {
      // Use profile.type as the main matching field and normalize formatting.
      const profileType = normalizeProfileType(profile.type);
      const authProfile =
        typeof profile.authProfile === 'string'
          ? (() => {
              try {
                return JSON.parse(profile.authProfile) || {};
              } catch (_) {
                return {};
              }
            })()
          : profile.authProfile || {};

      const isLegacyAws = !profileType && !!authProfile?.awsAccountId;
      const isAwsAccountType = profileType === 'aws account' || isLegacyAws;
      const isAwsOrgType = profileType === 'aws org';
      const isGoogleWorkspaceType = profileType === 'google workspace';

      let matches = false;

      if (providerFilter === 'google workspace') {
        matches = isGoogleWorkspaceType;
      } else if (providerFilter === 'aws org') {
        matches = isAwsOrgType;
      } else if (providerFilter === 'aws' || providerFilter === 'aws account') {
        matches = isAwsAccountType;
      } else {
        matches = profileType === providerFilter;
      }

     

      return matches;
    });

    

    return filtered;
  }, [userProfile?.agentPermissionProfiles, cloudProvider, environmentType]);

  // Handle click outside regions dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        regionsDropdownRef.current &&
        !regionsDropdownRef.current.contains(event.target)
      ) {
        setRegionsDropdownOpen(false);
      }
    };

    if (regionsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [regionsDropdownOpen]);

  const resetModalState = () => {
    setActiveTab('manual');
    setSearchQuery('');
    setIsLimitedWriteEnabled(true);
    setIsRestrictedEnabled(false);
    setIsWellArchitectedUpdateEnabled(false);
    setIsAdminEnabled(false);
    setAccessType('cloudformation');
    setSavePermissions(true);
    setButtonLoading(false);
    setPresetName('Production');
    setPresetDescription('My production environment');
    setAuthType('role');
    setSelectedPermission(null);
    setManualStepsModal(false);
    setIsValidationSuccessful(false);
    setIsValidatingSaved(false);
    setValidatingPermissionId(null);
    setValidationSummary(null);
    setIsValidationSummaryOpen(false);
    setShowUpdatePermissionsDetails(false);
    setLastValidatedPermission(null);
    setIsEditing(false);
    setEditingPermission(null);
    setIsUpdating(false);
    setManualStep(0);
    setTemporaryAccess(false);
    setShowPermissions(false);
    setSelectedTime(24);
    setShowPermissionsModal(false);
    setPermissionsModalMode('required');
    setAccountIdError('');
    setShowAccountIdError(false);
    setShowImageModal(false);
    setCurrentImage({ src: '', alt: '', title: '' });
    setShowVideoModal(false);
    setEditedStackArn('');
    setDeploymentConfirmed(false);
    setOrgDeploymentConfirmed(false);
    setOrgAccessType('stackset-template');
    setOrgStackSetName(`cloudagent-org-member-role-${generateRandomString(4).toLowerCase()}`);
    setOrgStackSetRegion('us-east-1');
    setOrgStackSetOperationId('');
    setOrgMemberRoleName('');
    setOrgMemberExternalId('');
    setOrgMemberRoleOverridesTouched(false);
    setOrgAccounts([]);
    setOrgAccountsLoading(false);
    setOrgAccountsError('');
    setSelectedOrgAccountIds([]);
    setOrgAccountValidationById({});
    setIsValidatingOrgAccounts(false);
    setIsCheckingOrgStackSetStatus(false);
    setOrgStackSetStatus(null);
    setOrgStackSetStatusError('');
    setIsImportingOrgAccounts(false);
    setIsCreatingProfileWorkload(false);
    setIsUpdateProgressOpen(false);
    setUpdateSummary({
      status: 'idle',
      success: null,
      message: '',
      reason: '',
      details: null,
    });
    setUpdateToolEvents([]);
  };

  useEffect(() => {
    if (validationToolEvents.length === 0) return;
    const node = liveActionsEndRef.current;
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [validationToolEvents.length]);

  useEffect(() => {
    if (updateToolEvents.length === 0) return;
    const node = updateActionsEndRef.current;
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [updateToolEvents.length]);

  const parsedEditingAuthProfile = useMemo(() => {
    const sourcePermission = editingPermission || initialEditingPermission;
    if (!sourcePermission?.authProfile) return {};

    if (typeof sourcePermission.authProfile === 'string') {
      try {
        return JSON.parse(sourcePermission.authProfile) || {};
      } catch (_) {
        return {};
      }
    }

    return sourcePermission.authProfile || {};
  }, [editingPermission, initialEditingPermission]);

  const currentStackArn =
    editedStackArn ||
    state.authProfile?.stackArn ||
    parsedEditingAuthProfile.stackArn ||
    '';

  const currentWorkloadId = normalizeWorkloadId(
    state.authProfile?.workloadId || parsedEditingAuthProfile.workloadId || ''
  ) || '';

  const handleClose = () => {
    trackCloudSetupWizardClosed();
    if (state?.authProfile?.validated) {
      if (onOpenChange && typeof onOpenChange === 'function') {
        onOpenChange();
      }
    } else if (onCancel && typeof onCancel === 'function') {
      onCancel();
    } else if (setState) {
      setState((prev) => ({ ...prev, isPermissionsModalOpen: false }));
    }
    resetModalState();
  };

  useEffect(() => {
    if (initialIsEditing && initialEditingPermission) {
      setIsEditing(true);
      setEditingPermission(initialEditingPermission);
      setPresetDescription(initialPresetDescription);
      setPresetName(initialEditingPermission.name || '');
      setActiveTab('manual');
      setManualStep(0);
      
      // Parse authProfile if it's a string
      const authProfile = typeof initialEditingPermission.authProfile === 'string' 
        ? JSON.parse(initialEditingPermission.authProfile) 
        : initialEditingPermission.authProfile || {};

      const authType = authProfile.authType || initialAuthType || 'role';
      setAuthType(authType);
      
      // Prefill state for edit
      if (authType === 'credentials') {
        setState((prev) => ({
          ...prev,
          accountId: authProfile.awsAccountId || '',
          authProfile: {
            ...prev.authProfile,
            accessKeyId: authProfile.accessKeyId || '',
            secretAccessKey: authProfile.secretAccessKey || '',
            sessionToken: authProfile.sessionToken || '',
            stackArn: authProfile.stackArn || '',
            workloadId: authProfile.workloadId || prev.authProfile?.workloadId || '',
          },
        }));
        setEditedStackArn(authProfile.stackArn || '');
      } else {
        setState((prev) => ({
          ...prev,
          accountId: authProfile.awsAccountId || '',
          authProfile: {
            ...prev.authProfile,
            roleName: authProfile.roleName || '',
            externalId: authProfile.externalId || '',
            stackArn: authProfile.stackArn || '',
            workloadId: authProfile.workloadId || prev.authProfile?.workloadId || '',
          },
        }));
        setEditedStackArn(authProfile.stackArn || '');
      }
    }
  }, [initialIsEditing, initialEditingPermission, initialPresetDescription, initialAuthType, setState]);

  // Set default role name and generate random external ID when modal opens
  useEffect(() => {
    if (isOpen && !initialIsEditing) {
      setManualStep(0);
      setState((prev) => ({
        ...prev,
        authProfile: {
          ...prev.authProfile,
          roleName: prev.authProfile.roleName || 'CloudAgentAccess',
          externalId: prev.authProfile.externalId || generateRandomString(8),
        },
      }));
      if (isAwsOrgFlow) {
        setOrgMemberRoleOverridesTouched(false);
        setOrgMemberRoleName(
          String(state.authProfile?.roleName || 'CloudAgentAccess')
        );
        setOrgMemberExternalId(String(state.authProfile?.externalId || ''));
      }
    }
  }, [initialIsEditing, isAwsOrgFlow, isOpen, setState]);

  useEffect(() => {
    if (!isAwsOrgFlow || orgMemberRoleOverridesTouched) return;
    setOrgMemberRoleName(String(state.authProfile?.roleName || 'CloudAgentAccess'));
    setOrgMemberExternalId(String(state.authProfile?.externalId || ''));
  }, [
    isAwsOrgFlow,
    orgMemberRoleOverridesTouched,
    state.authProfile?.externalId,
    state.authProfile?.roleName,
  ]);

  useEffect(() => {
    if (!isAwsOrgFlow) return;
    setOrgAccountValidationById((prev) =>
      Object.keys(prev || {}).length > 0 ? {} : prev
    );
  }, [isAwsOrgFlow, orgMemberExternalIdValue, orgMemberRoleNameValue]);

  useEffect(() => {
    if (!isOpen || initialIsEditing || !isAwsOrgFlow) return;
    setPresetName('My AWS Organization');
    setPresetDescription('AWS Organization management account');
  }, [initialIsEditing, isAwsOrgFlow, isOpen]);

  const handleSaveAndUse = async () => {
    setButtonLoading(true);
    try {
      if (isAwsOrgFlow && !isEditing) {
        const imported = await handleImportAwsOrgAccounts();
        setButtonLoading(false);
        if (imported) {
          setState((prev) => ({
            ...prev,
            isPermissionsModalOpen: false,
            authProfile: {
              ...prev.authProfile,
              validated: true,
              authType,
              awsAccountId: prev.accountId || '',
              accountId: prev.accountId || '',
            },
          }));
          if (onOpenChange && typeof onOpenChange === 'function') {
            onOpenChange();
          }
        }
        return;
      }

      if (isEditing) {
      const updatedProfile = {
          name: presetName,
          awsAccountId: state.accountId,
          authType: authType,
          description: presetDescription,
          recordId: editingPermission.recordId,
          stackArn: (editedStackArn || validationResult?.stackArn || state?.authProfile?.stackArn || ''),
          ...(authType === 'role'
            ? {
                roleName: state.authProfile.roleName,
                externalId: state.authProfile.externalId,
                accessKeyId: '',
                secretAccessKey: '',
                sessionToken: '',
              }
            : {
                accessKeyId: state.authProfile.accessKeyId,
                secretAccessKey: state.authProfile.secretAccessKey,
                sessionToken: state.authProfile.sessionToken,
                roleName: '',
                externalId: '',
              }),
        deploymentPreferences: JSON.stringify({
          cloudformationStackName: state?.authProfile?.stackName || '',
          cloudformationStackArn: (editedStackArn || validationResult?.stack?.arn || state?.authProfile?.stackArn || ''),
          defaultRegions: Array.isArray(selectedRegions) ? selectedRegions : [],
        }),
        };

        await dispatch(updateAgentPermissionProfile(updatedProfile)).unwrap();

        const shouldCreateWorkloadForEdit =
          !currentWorkloadId && isAwsAccountPermissionProfile(editingPermission);

        // After saving profile, kick off workload creation in background when a workload is missing
        if (shouldCreateWorkloadForEdit) {
          try {
            const toastId = toast.loading('Creating workload...');
            const accountIdForWorkload = state.accountId;
            const stackArnForWorkload = (editedStackArn || validationResult?.stackArn || state?.authProfile?.stackArn || '');
            if (accountIdForWorkload && stackArnForWorkload) {
              (async () => {
                try {
                  const { success, workloadId, message } = await createPermissionProfileWorkload({
                    permissionProfileId: editingPermission.recordId,
                    accountId: accountIdForWorkload,
                    stackArn: stackArnForWorkload,
                  });
                  if (success && workloadId) {
                    await dispatch(updateAgentPermissionProfile({
                      recordId: editingPermission.recordId,
                      workloadId,
                    })).unwrap();
                    toast.success(`Workload created: ${workloadId}`, { id: toastId });
                  } else if (!success && message) {
                    console.warn('Workload creation failed:', message);
                    toast.dismiss(toastId);
                    toast.error(message);
                  }
                } catch (e) {
                  console.warn('Workload creation threw error (non-blocking):', e?.message || e);
                  toast.dismiss();
                  toast.error(e?.message || 'Failed to create workload');
                }
              })();
            } else {
              // No stackArn present; dismiss any loading toast
              toast.dismiss();
            }
          } catch (_) {}
        }

        let existingLogs = [];
        const agentData = userProfile?.agentHistory?.find(
          (agent) => agent.recordId === recordId
        );
        if (agentData?.log) {
            const parsedLog = toLogObject(agentData.log);
          existingLogs = parsedLog.logs || [];
        }
        const updatedLogs = existingLogs.map((log) => ({
          ...log,
          authProfileName: updatedProfile.name,
        }));
        const updatedLogsObject = {
          logs: updatedLogs,
          currentPhase: state.currentPhase,
          currentTask: state.currentTask,
          lastUpdated: new Date().toISOString(),
          authProfileName: updatedProfile.name,
        };
        if (!isDashboard) {
          await dispatch(
            updateAgentConnection({
              recordId: recordId,
              status: 'running',
              log: JSON.stringify(updatedLogsObject),
              authProfile: JSON.stringify({
                ...state.authProfile,
                authType: authType,
                awsAccountId: updatedProfile.awsAccountId || '',
                roleName: updatedProfile.roleName || '',
                externalId: updatedProfile.externalId || '',
                accessKeyId: updatedProfile.accessKeyId || '',
                secretAccessKey: updatedProfile.secretAccessKey || '',
                sessionToken: updatedProfile.sessionToken || '',
                authProfileName: updatedProfile.name,
              }),
            })
          );
        }

        toast.success('Permission updated successfully');
        setIsEditing(false);
        setButtonLoading(false);
        setState((prev) => ({
          ...prev,
          isPermissionsModalOpen: false,
          authProfile: { ...prev.authProfile, validated: true, authType },
        }));
        if (onOpenChange && typeof onOpenChange === 'function') onOpenChange();
        return;
      }

      if (savePermissions) {
        const creationPayload = {
            name: presetName,
            description: presetDescription,
            type: 'aws account',
            awsAccountId: state.accountId,
            authType: authType,
            roleName: authType === 'role' ? state.authProfile.roleName : '',
            externalId: authType === 'role' ? state.authProfile.externalId : '',
            accessKeyId:
              authType === 'credentials' ? state.authProfile.accessKeyId : '',
            secretAccessKey:
              authType === 'credentials'
                ? state.authProfile.secretAccessKey
                : '',
            sessionToken:
              authType === 'credentials' ? state.authProfile.sessionToken : '',
            stackArn: (editedStackArn || validationResult?.stack?.arn || ''),
            deploymentPreferences: JSON.stringify({
              cloudformationStackName: state?.authProfile?.stackName || '',
              cloudformationStackArn: (editedStackArn || validationResult?.stack?.arn || ''),
              defaultRegions: Array.isArray(selectedRegions) ? selectedRegions : [],
            }),
        };
        const createdProfile = await dispatch(
          createAgentPermissionProfile(creationPayload)
        ).unwrap();

        analytics.track(ANALYTICS_EVENTS.CLOUD_ENVIRONMENT_CONNECTED, {
          route: getAnalyticsRoute(),
        });

        const createdProfileAuthProfile =
          typeof createdProfile?.authProfile === 'string'
            ? (() => {
                try {
                  return JSON.parse(createdProfile.authProfile) || {};
                } catch (_) {
                  return {};
                }
              })()
            : createdProfile?.authProfile || {};
        const shouldCreateWorkloadForNewProfile = !createdProfileAuthProfile?.workloadId;

        // After creating profile, kick off workload creation in background only when a workload is missing
        if (shouldCreateWorkloadForNewProfile) {
          try {
            const toastId = toast.loading('Creating workload...');
            const accountIdForWorkload = state.accountId;
            const stackArnForWorkload = (editedStackArn || validationResult?.stack?.arn || '');
            const recordIdForUpdate = createdProfile?.recordId;
            if (accountIdForWorkload && stackArnForWorkload && recordIdForUpdate) {
              (async () => {
                try {
                  const { success, workloadId, message } = await createPermissionProfileWorkload({
                    permissionProfileId: recordIdForUpdate,
                    accountId: accountIdForWorkload,
                    stackArn: stackArnForWorkload,
                  });
                  if (success && workloadId) {
                    await dispatch(updateAgentPermissionProfile({
                      recordId: recordIdForUpdate,
                      workloadId,
                    })).unwrap();
                    toast.success(`Workload created: ${workloadId}`, { id: toastId });
                  } else if (!success && message) {
                    console.warn('Workload creation failed:', message);
                    toast.dismiss(toastId);
                    toast.error(message);
                  }
                } catch (e) {
                  console.warn('Workload creation threw error (non-blocking):', e?.message || e);
                  toast.dismiss();
                  toast.error(e?.message || 'Failed to create workload');
                }
              })();
            } else {
              // No stackArn present; dismiss any loading toast
              toast.dismiss();
            }
          } catch (_) {}
        }

        let existingLogs = [];

        const agentData = userProfile?.agentHistory?.find(
          (agent) => agent.recordId === recordId
        );
        if (agentData?.log) {
            const parsedLog = toLogObject(agentData.log);
          existingLogs = parsedLog.logs || [];
        }

        const profileName = savePermissions
          ? presetName
          : state.authProfile.authProfileName || '';

        const updatedLogs = existingLogs.map((log) => ({
          ...log,
          authProfileName: profileName,
        }));

        const updatedLogsObject = {
          logs: updatedLogs,
          currentPhase: state.currentPhase,
          currentTask: state.currentTask,
          lastUpdated: new Date().toISOString(),
          authProfileName: profileName,
        };

        if (!isDashboard) {
          await dispatch(
            updateAgentConnection({
              recordId: recordId,
              status: 'running',
              log: JSON.stringify(updatedLogsObject),
              authProfile: JSON.stringify({
                ...state.authProfile,
                awsAccountId: state.accountId,
                authType: authType,
                roleName: authType === 'role' ? state.authProfile.roleName : '',
                externalId:
                  authType === 'role' ? state.authProfile.externalId : '',
                accessKeyId:
                  authType === 'credentials'
                    ? state.authProfile.accessKeyId
                    : '',
                secretAccessKey:
                  authType === 'credentials'
                    ? state.authProfile.secretAccessKey
                    : '',
                sessionToken:
                  authType === 'credentials'
                    ? state.authProfile.sessionToken
                    : '',
                authProfileName: profileName,
              }),
            })
          );
        }

        dispatch(setIsRegionModalOpen(true));
        setButtonLoading(false);
        setState((prev) => ({
          ...prev,
          isPermissionsModalOpen: false,
          accountId: prev.accountId,
          authProfile: {
            ...prev.authProfile,
            validated: true,
            authType: authType,
            // Ensure awsAccountId is preserved from selected profile
            awsAccountId: prev.authProfile?.awsAccountId || prev.accountId || '',
            accountId: prev.authProfile?.awsAccountId || prev.accountId || '',
          },
        }));
        if (onComplete && typeof onComplete === 'function') {
          onComplete({
            name: presetName,
            description: presetDescription,
            awsAccountId: state.accountId,
            authType: authType,
            roleName: authType === 'role' ? state.authProfile.roleName : '',
            externalId: authType === 'role' ? state.authProfile.externalId : '',
            accessKeyId:
              authType === 'credentials' ? state.authProfile.accessKeyId : '',
            secretAccessKey:
              authType === 'credentials'
                ? state.authProfile.secretAccessKey
                : '',
            sessionToken:
              authType === 'credentials' ? state.authProfile.sessionToken : '',
            recordId: createdProfile?.recordId || recordId,
          });
        }

        if (onOpenChange && typeof onOpenChange === 'function') {
          onOpenChange();
        }
      } else {
        dispatch(setIsRegionModalOpen(true));
        setButtonLoading(false);
        setState((prev) => ({
          ...prev,
          isPermissionsModalOpen: false,
          accountId: prev.accountId,
          authProfile: {
            ...prev.authProfile,
            validated: true,
            // Ensure awsAccountId is preserved from selected profile
            awsAccountId: prev.authProfile?.awsAccountId || prev.accountId || '',
            accountId: prev.authProfile?.awsAccountId || prev.accountId || '',
          },
        }));

        if (onOpenChange && typeof onOpenChange === 'function') {
          onOpenChange();
        }
      }
    } catch (error) {
      setButtonLoading(false);
      console.error('Error saving agent permission profile:', error);
      analytics.track(ANALYTICS_EVENTS.ERR_ENVIRONMENT_CONNECTION_FAILED, {
        route: getAnalyticsRoute(),
        error_message: error?.message || 'Failed to connect cloud environment',
      });
    }
  };

  const handleAccountIdChange = (e) => {
    const value = e.target.value;
    setState((prev) => ({
      ...prev,
      accountId: value,
    }));
    if (isAwsOrgFlow) {
      setIsValidationSuccessful(false);
      setValidationResult(null);
      setOrgStackSetStatus(null);
      setOrgStackSetStatusError('');
      setOrgDeploymentConfirmed(false);
    }

    if (showAccountIdError && value) {
      setShowAccountIdError(false);
      setAccountIdError('');
    }
  };

  const buildAwsOrgAuthPayload = useCallback(() => {
    const accountId = String(state.accountId || '').trim();
    if (authType === 'credentials') {
      const payload = {
        authType: 'credentials',
        accountId,
        accessKeyId: state.authProfile?.accessKeyId || '',
        secretAccessKey: state.authProfile?.secretAccessKey || '',
        sessionToken: state.authProfile?.sessionToken || '',
      };
      if (!payload.sessionToken) delete payload.sessionToken;
      return payload;
    }

    const payload = {
      authType: 'assumeRole',
      accountId,
      roleName: state.authProfile?.roleName || '',
      externalId: state.authProfile?.externalId || '',
    };
    const roleArn = String(state.authProfile?.roleArn || '').trim();
    if (roleArn) payload.roleArn = roleArn;
    if (!payload.roleName) delete payload.roleName;
    if (!payload.externalId) delete payload.externalId;
    return payload;
  }, [authType, state.accountId, state.authProfile]);

  const loadAwsOrgAccounts = useCallback(async () => {
    if (!isAwsOrgFlow) return;

    setOrgAccountsLoading(true);
    setOrgAccountsError('');
    try {
      const response = await fetchAwsOrganizationAccounts({
        authProfile: buildAwsOrgAuthPayload(),
      });
      const accounts = Array.isArray(response?.accounts) ? response.accounts : [];
      setOrgAccounts(accounts);
      setOrgAccountValidationById({});
      const nonManagementAccounts = accounts.filter(
        (account) => String(account?.id || '').trim() !== managementAccountId
      );
      const discoveredMemberAccounts = nonManagementAccounts
        .map((account) => ({
          id: String(account?.id || '').trim(),
          name: account?.name || '',
          email: account?.email || '',
          status: account?.status || '',
        }))
        .filter((account) => account.id);

      const existingProfiles = Array.isArray(userProfile?.agentPermissionProfiles)
        ? userProfile.agentPermissionProfiles
        : [];
      const existingOrgProfile = existingProfiles.find((profile) => {
        const profileType = normalizeProfileType(profile?.type);
        if (profileType !== 'aws org') return false;
        const parsedAuthProfile =
          typeof profile?.authProfile === 'string'
            ? (() => {
                try {
                  return JSON.parse(profile.authProfile) || {};
                } catch (_) {
                  return {};
                }
              })()
            : profile?.authProfile || {};
        return (
          String(parsedAuthProfile?.awsAccountId || '').trim() === managementAccountId
        );
      });
      if (existingOrgProfile?.recordId) {
        const existingOrgAuthProfile =
          typeof existingOrgProfile.authProfile === 'string'
            ? (() => {
                try {
                  return JSON.parse(existingOrgProfile.authProfile) || {};
                } catch (_) {
                  return {};
                }
              })()
            : existingOrgProfile.authProfile || {};
        const mergedOrgAuthProfile = {
          ...existingOrgAuthProfile,
          memberAccountsDiscovered: discoveredMemberAccounts,
        };
        const existingStackSetName = String(existingOrgAuthProfile?.stackSetName || '').trim();
        if (existingStackSetName) {
          mergedOrgAuthProfile.stackSetName = existingStackSetName;
          mergedOrgAuthProfile.orgStackSetName =
            String(existingOrgAuthProfile?.orgStackSetName || '').trim() ||
            existingStackSetName;
        }

        dispatch(
          updateAgentPermissionProfile({
            recordId: existingOrgProfile.recordId,
            name: existingOrgProfile.name,
            description: existingOrgProfile.description,
            type: 'aws org',
            authProfile: mergedOrgAuthProfile,
          })
        ).catch((error) => {
          console.error('Failed to persist discovered org accounts', error);
        });
      }

      if (nonManagementAccounts.length > 0 && deployedOrgAccountIds.size > 0) {
        const selectable = nonManagementAccounts
          .filter((account) => deployedOrgAccountIds.has(account.id))
          .map((account) => account.id);
        setSelectedOrgAccountIds(selectable);
      }
    } catch (error) {
      console.error('Failed to load AWS organization accounts', error);
      setOrgAccountsError(error?.message || 'Failed to load organization accounts');
    } finally {
      setOrgAccountsLoading(false);
    }
  }, [
    buildAwsOrgAuthPayload,
    deployedOrgAccountIds,
    dispatch,
    isAwsOrgFlow,
    managementAccountId,
    userProfile?.agentPermissionProfiles,
  ]);

  const checkAwsOrgStackSetStatus = useCallback(async () => {
    if (!isAwsOrgFlow) return;
    if (!orgStackSetName.trim()) {
      setOrgStackSetStatusError('StackSet name is required');
      return;
    }

    setIsCheckingOrgStackSetStatus(true);
    setOrgStackSetStatusError('');
    try {
      const response = await validateAwsCredentialsV2({
        authProfile: buildAwsOrgAuthPayload(),
        stackSetName: orgStackSetName.trim(),
        stackSetRegion: orgStackSetRegion,
        operationId: orgStackSetOperationId.trim() || undefined,
        validationType: 'stackset',
        validateStackSetOnly: true,
      });
      if (response?.ok === false || Number(response?.code || 0) >= 400) {
        throw new Error(
          response?.message ||
            response?.error ||
            'Failed to check StackSet deployment status'
        );
      }
      setOrgStackSetStatus(response);

      const deployedIds = Array.isArray(response?.summary?.deployedAccountIds)
        ? response.summary.deployedAccountIds
        : [];
      const deployedMemberIds = deployedIds.filter(
        (accountId) => String(accountId || '').trim() !== managementAccountId
      );
      if (deployedMemberIds.length > 0) {
        setSelectedOrgAccountIds((prev) => {
          if (!Array.isArray(prev) || prev.length === 0) return deployedMemberIds;
          const merged = new Set([...prev, ...deployedMemberIds]);
          return Array.from(merged);
        });
      }
      toast.success('StackSet deployment status updated');
    } catch (error) {
      console.error('Failed to check StackSet status', error);
      const message = error?.message || 'Failed to check StackSet deployment status';
      setOrgStackSetStatusError(message);
      toast.error('Failed to fetch StackSet deployment status');
    } finally {
      setIsCheckingOrgStackSetStatus(false);
    }
  }, [
    buildAwsOrgAuthPayload,
    isAwsOrgFlow,
    managementAccountId,
    orgStackSetRegion,
    orgStackSetName,
    orgStackSetOperationId,
  ]);

  const validateSelectedOrgAccounts = useCallback(
    async (accountIds = [], { force = false } = {}) => {
      const targets = Array.isArray(accountIds)
        ? accountIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];
      if (targets.length === 0) {
        return {
          allValid: false,
          resultsById: {},
          failedAccountIds: [],
        };
      }

      const memberRoleName = String(
        orgMemberRoleNameValue || state.authProfile?.roleName || ''
      ).trim();
      const memberExternalId = String(
        orgMemberExternalIdValue || state.authProfile?.externalId || ''
      ).trim();
      if (!memberRoleName || !memberExternalId) {
        toast.error('Member role name and external ID are required before validation.');
        return {
          allValid: false,
          resultsById: {},
          failedAccountIds: targets,
        };
      }

      const nextResults = {};
      const failedAccountIds = [];
      setIsValidatingOrgAccounts(true);
      try {
        for (const accountId of targets) {
          const existing = orgAccountValidationById?.[accountId];
          if (!force && existing?.status === 'success') {
            nextResults[accountId] = existing;
            continue;
          }

          setOrgAccountValidationById((prev) => ({
            ...prev,
            [accountId]: {
              ...(prev?.[accountId] || {}),
              status: 'loading',
              message: 'Validating account credentials...',
              validatedAt: Date.now(),
            },
          }));

          try {
            const response = await validateAwsCredentialsV2({
              authProfile: {
                authType: 'assumeRole',
                accountId,
                roleName: memberRoleName,
                externalId: memberExternalId,
              },
            });

            const isSuccess =
              response?.code === 200 && response?.role?.exists === true;
            const resultEntry = {
              status: isSuccess ? 'success' : 'error',
              message: isSuccess
                ? 'Validated'
                : response?.message || 'Validation failed',
              code: response?.code || 0,
              regionsUsed: Array.isArray(response?.regionsUsed)
                ? response.regionsUsed
                : [],
              spendDetails:
                response?.spendDetails && typeof response.spendDetails === 'object'
                  ? response.spendDetails
                  : {},
              stack: response?.stack || null,
              stackArn:
                String(
                  response?.stack?.arn ||
                    response?.stackArn ||
                    response?.stack?.stackId ||
                    ''
                ).trim() || '',
              validatedAt: Date.now(),
            };

            if (!isSuccess) {
              failedAccountIds.push(accountId);
            }
            nextResults[accountId] = resultEntry;
            setOrgAccountValidationById((prev) => ({
              ...prev,
              [accountId]: resultEntry,
            }));
          } catch (error) {
            const resultEntry = {
              status: 'error',
              message: error?.message || 'Validation failed',
              code: 500,
              regionsUsed: [],
              spendDetails: {},
              stack: null,
              stackArn: '',
              validatedAt: Date.now(),
            };
            failedAccountIds.push(accountId);
            nextResults[accountId] = resultEntry;
            setOrgAccountValidationById((prev) => ({
              ...prev,
              [accountId]: resultEntry,
            }));
          }
        }
      } finally {
        setIsValidatingOrgAccounts(false);
      }

      return {
        allValid: failedAccountIds.length === 0,
        resultsById: nextResults,
        failedAccountIds,
      };
    },
    [
      orgAccountValidationById,
      orgMemberExternalIdValue,
      orgMemberRoleNameValue,
      state.authProfile?.externalId,
      state.authProfile?.roleName,
    ]
  );

  useEffect(() => {
    if (!isAwsOrgFlow) return;
    if (manualStep !== 4) return;
    if (!Array.isArray(selectedOrgAccountIds) || selectedOrgAccountIds.length === 0) {
      return;
    }
    if (isValidatingOrgAccounts) return;

    const pendingAccountIds = selectedOrgAccountIds
      .map((accountId) => String(accountId || '').trim())
      .filter(Boolean)
      .filter((accountId) => {
        const status = orgAccountValidationById?.[accountId]?.status;
        return status !== 'loading' && status !== 'success' && status !== 'error';
      });

    if (pendingAccountIds.length === 0) return;

    void validateSelectedOrgAccounts(pendingAccountIds, { force: false });
  }, [
    isAwsOrgFlow,
    isValidatingOrgAccounts,
    manualStep,
    orgAccountValidationById,
    selectedOrgAccountIds,
    validateSelectedOrgAccounts,
  ]);

  const handleImportAwsOrgAccounts = useCallback(async () => {
    const managementAccountId = String(state.accountId || '').trim();
    if (!managementAccountId) {
      toast.error('Org management account ID is required');
      return false;
    }
    const selectedAccountIds = Array.isArray(selectedOrgAccountIds)
      ? selectedOrgAccountIds.filter(
          (accountId) =>
            accountId && String(accountId).trim() !== managementAccountId
        )
      : [];
    if (selectedAccountIds.length === 0) {
      toast.error('Select at least one organization member account to import');
      return false;
    }

    const managementRoleName = String(state.authProfile?.roleName || '').trim();
    const managementExternalId = String(state.authProfile?.externalId || '').trim();
    const memberRoleName = String(
      orgMemberRoleNameValue || managementRoleName
    ).trim();
    const memberExternalId = String(
      orgMemberExternalIdValue || managementExternalId
    ).trim();
    if (
      !managementRoleName ||
      !managementExternalId ||
      !memberRoleName ||
      !memberExternalId
    ) {
      toast.error('Management and member role name/external ID are required');
      return false;
    }

    const memberValidationSummary = await validateSelectedOrgAccounts(selectedAccountIds, {
      force: false,
    });
    if (!memberValidationSummary?.allValid) {
      const failedCount = Array.isArray(memberValidationSummary?.failedAccountIds)
        ? memberValidationSummary.failedAccountIds.length
        : 0;
      toast.error(
        `Validation failed for ${failedCount || 'one or more'} selected account${
          failedCount === 1 ? '' : 's'
        }. Review validation results and retry.`
      );
      return false;
    }

    const normalizedStackSetName = String(orgStackSetName || '').trim();
    const normalizedStackSetRegion = String(orgStackSetRegion || '').trim() || 'us-east-1';
    const managementStackReference = String(
      editedStackArn ||
        validationResult?.stack?.arn ||
        validationResult?.stackArn ||
        state?.authProfile?.stackArn ||
        state?.authProfile?.stackName ||
        normalizedStackSetName
    ).trim();
    const memberStackReferenceByAccountId = new Map();
    (Array.isArray(orgStackSetStatus?.accounts) ? orgStackSetStatus.accounts : []).forEach(
      (accountStatus) => {
        const accountId = String(accountStatus?.accountId || '').trim();
        if (!accountId || accountId === managementAccountId) return;
        const firstStackId = (Array.isArray(accountStatus?.regions)
          ? accountStatus.regions
          : []
        ).find((region) => String(region?.stackId || '').trim())?.stackId;
        if (firstStackId) {
          memberStackReferenceByAccountId.set(accountId, String(firstStackId).trim());
        }
      }
    );
    const discoveredMemberAccounts = (Array.isArray(orgAccounts) ? orgAccounts : [])
      .filter(
        (account) => String(account?.id || '').trim() !== managementAccountId
      )
      .map((account) => ({
        id: String(account?.id || '').trim(),
        name: account?.name || '',
        email: account?.email || '',
        status: account?.status || '',
      }))
      .filter((account) => account.id);
    const orgAuthProfilePayload = {
      awsAccountId: managementAccountId,
      authType,
      memberRoleName,
      memberExternalId,
      ...(authType === 'role'
        ? {
            roleName: managementRoleName,
            externalId: managementExternalId,
            ...(state.authProfile?.roleArn
              ? { roleArn: String(state.authProfile.roleArn).trim() }
              : {}),
          }
        : {
            accessKeyId: state.authProfile?.accessKeyId || '',
            secretAccessKey: state.authProfile?.secretAccessKey || '',
            ...(state.authProfile?.sessionToken
              ? { sessionToken: state.authProfile.sessionToken }
              : {}),
          }),
    };
    if (normalizedStackSetName) {
      orgAuthProfilePayload.stackSetName = normalizedStackSetName;
      orgAuthProfilePayload.orgStackSetName = normalizedStackSetName;
      orgAuthProfilePayload.stackSetRegion = normalizedStackSetRegion;
      orgAuthProfilePayload.orgStackSetRegion = normalizedStackSetRegion;
    }
    orgAuthProfilePayload.memberAccountsDiscovered = discoveredMemberAccounts;

    setIsImportingOrgAccounts(true);
    try {
      const createWorkloadForProfile = async ({
        permissionRecordId,
        accountId,
        stackReference,
      }) => {
        const safeRecordId = String(permissionRecordId || '').trim();
        const safeAccountId = String(accountId || '').trim();
        const safeStackReference = String(stackReference || '').trim();
        if (!safeRecordId || !safeAccountId || !safeStackReference) return false;

        try {
          const { success, workloadId, message } =
            await createPermissionProfileWorkload({
              permissionProfileId: safeRecordId,
              accountId: safeAccountId,
              stackArn: safeStackReference,
            });
          if (success && workloadId) {
            await dispatch(
              updateAgentPermissionProfile({
                recordId: safeRecordId,
                workloadId,
                stackArn: safeStackReference,
              })
            ).unwrap();
            return true;
          }
          if (message) {
            console.warn(
              `Workload creation skipped for account ${safeAccountId}: ${message}`
            );
          }
          return false;
        } catch (error) {
          console.warn(
            `Workload creation failed for account ${safeAccountId}:`,
            error?.message || error
          );
          return false;
        }
      };

      const existingProfiles = Array.isArray(userProfile?.agentPermissionProfiles)
        ? userProfile.agentPermissionProfiles
        : [];
      const existingAwsAccountIds = new Set();
      let existingOrgProfile = null;
      let existingManagementAccountProfile = null;
      const cisLaunchTargets = [];
      const enqueueAwsCisLaunch = ({
        permissionProfile,
        accountId,
        roleName,
        externalId,
        name,
      }) => {
        const parentId = String(
          permissionProfile?.recordId || permissionProfile?.id || ''
        ).trim();
        const safeAccountId = String(accountId || '').trim();
        if (!parentId || !safeAccountId) return;

        cisLaunchTargets.push({
          parentId,
          accountId: safeAccountId,
          authProfile: {
            authType: 'role',
            roleName,
            externalId,
            awsAccountId: safeAccountId,
            accountId: safeAccountId,
            name,
          },
        });
      };

      existingProfiles.forEach((profile) => {
        const profileType = normalizeProfileType(profile?.type);
        const authProfile =
          typeof profile?.authProfile === 'string'
            ? (() => {
                try {
                  return JSON.parse(profile.authProfile) || {};
                } catch (_) {
                  return {};
                }
              })()
            : profile?.authProfile || {};
        const accountId = String(authProfile?.awsAccountId || '').trim();

        if (
          (profileType === 'aws account' || (!profileType && accountId)) &&
          accountId
        ) {
          existingAwsAccountIds.add(accountId);
          if (accountId === managementAccountId) {
            existingManagementAccountProfile = profile;
          }
        }
        if (profileType === 'aws org' && accountId === managementAccountId) {
          existingOrgProfile = profile;
        }
      });

      let orgProfileRecordId = existingOrgProfile?.recordId || null;
      if (!orgProfileRecordId) {
        const orgProfilePayload = {
          name: presetName || `AWS Org ${managementAccountId}`,
          description:
            presetDescription ||
            `AWS Organization management account ${managementAccountId}`,
          type: 'aws org',
          awsAccountId: managementAccountId,
          authType,
          roleName: authType === 'role' ? managementRoleName : '',
          externalId: authType === 'role' ? managementExternalId : '',
          accessKeyId:
            authType === 'credentials' ? state.authProfile?.accessKeyId || '' : '',
          secretAccessKey:
            authType === 'credentials'
              ? state.authProfile?.secretAccessKey || ''
              : '',
          sessionToken:
            authType === 'credentials' ? state.authProfile?.sessionToken || '' : '',
          authProfile: orgAuthProfilePayload,
          deploymentPreferences: JSON.stringify({
            cloudformationStackName: state?.authProfile?.stackName || '',
            cloudformationStackArn: editedStackArn || validationResult?.stack?.arn || '',
            defaultRegions: Array.isArray(selectedRegions) ? selectedRegions : [],
            orgStackSetName: normalizedStackSetName,
            orgStackSetRegion: normalizedStackSetRegion,
            orgStackSetOperationId: orgStackSetOperationId.trim() || '',
          }),
        };

        const createdOrgProfile = await dispatch(
          createAgentPermissionProfile(orgProfilePayload)
        ).unwrap();
        orgProfileRecordId = createdOrgProfile?.recordId || null;
      } else {
        const existingOrgAuthProfile =
          typeof existingOrgProfile?.authProfile === 'string'
            ? (() => {
                try {
                  return JSON.parse(existingOrgProfile.authProfile) || {};
                } catch (_) {
                  return {};
                }
              })()
            : existingOrgProfile?.authProfile || {};
        const mergedOrgAuthProfile = {
          ...existingOrgAuthProfile,
          ...orgAuthProfilePayload,
        };

        await dispatch(
          updateAgentPermissionProfile({
            recordId: orgProfileRecordId,
            name: existingOrgProfile?.name,
            description: existingOrgProfile?.description,
            type: 'aws org',
            authProfile: mergedOrgAuthProfile,
            deploymentPreferences: JSON.stringify({
              cloudformationStackName: state?.authProfile?.stackName || '',
              cloudformationStackArn: editedStackArn || validationResult?.stack?.arn || '',
              defaultRegions: Array.isArray(selectedRegions) ? selectedRegions : [],
              orgStackSetName: normalizedStackSetName,
              orgStackSetRegion: normalizedStackSetRegion,
              orgStackSetOperationId: orgStackSetOperationId.trim() || '',
            }),
          })
        ).unwrap();
      }

      const baseManagementDeploymentPreferences = {
        defaultRegions: Array.isArray(selectedRegions) ? selectedRegions : [],
        cloudformationStackName: state?.authProfile?.stackName || '',
        cloudformationStackArn: managementStackReference || '',
        orgManagementAccountId: managementAccountId,
        orgPermissionProfileId: orgProfileRecordId || '',
        orgStackSetName: normalizedStackSetName || '',
        orgStackSetRegion: normalizedStackSetRegion,
        isOrgManagementAccount: true,
      };

      if (existingManagementAccountProfile?.recordId) {
        const existingManagementDeploymentPreferences = parseJsonSafe(
          existingManagementAccountProfile?.deploymentPreferences,
          {}
        );
        await dispatch(
          updateAgentPermissionProfile({
            recordId: existingManagementAccountProfile.recordId,
            name:
              existingManagementAccountProfile?.name ||
              `AWS Org Management ${managementAccountId}`,
            description:
              existingManagementAccountProfile?.description ||
              `AWS Organization management account ${managementAccountId}`,
            type: 'aws account',
            awsAccountId: managementAccountId,
            authType: 'role',
            roleName: managementRoleName,
            externalId: managementExternalId,
            ...(managementStackReference ? { stackArn: managementStackReference } : {}),
            deploymentPreferences: JSON.stringify({
              ...existingManagementDeploymentPreferences,
              ...baseManagementDeploymentPreferences,
            }),
          })
        ).unwrap();

        const existingManagementAuthProfile = parseJsonSafe(
          existingManagementAccountProfile?.authProfile,
          {}
        );
        if (!existingManagementAuthProfile?.workloadId) {
          await createWorkloadForProfile({
            permissionRecordId: existingManagementAccountProfile.recordId,
            accountId: managementAccountId,
            stackReference: managementStackReference,
          });
        }
      } else if (!existingAwsAccountIds.has(managementAccountId)) {
        const createdManagementProfile = await dispatch(
          createAgentPermissionProfile({
            name: `AWS Org Management ${managementAccountId}`,
            description: `AWS Organization management account ${managementAccountId}`,
            type: 'aws account',
            awsAccountId: managementAccountId,
            authType: 'role',
            roleName: managementRoleName,
            externalId: managementExternalId,
            ...(managementStackReference ? { stackArn: managementStackReference } : {}),
            deploymentPreferences: JSON.stringify(baseManagementDeploymentPreferences),
          })
        ).unwrap();
        existingAwsAccountIds.add(managementAccountId);

        await createWorkloadForProfile({
          permissionRecordId: createdManagementProfile?.recordId,
          accountId: managementAccountId,
          stackReference: managementStackReference,
        });
        enqueueAwsCisLaunch({
          permissionProfile: createdManagementProfile,
          accountId: managementAccountId,
          roleName: managementRoleName,
          externalId: managementExternalId,
          name: `AWS Org Management ${managementAccountId}`,
        });
      }

      let createdCount = 0;
      let skippedCount = 0;
      for (const accountId of selectedAccountIds) {
        if (existingAwsAccountIds.has(accountId)) {
          skippedCount += 1;
          continue;
        }

        const accountData = orgAccounts.find((account) => account.id === accountId) || {};
        const accountName = accountData?.name || `AWS Account ${accountId}`;
        const accountDescription = accountData?.email
          ? `${accountName} (${accountData.email})`
          : accountName;
        const memberStackReference = String(
          memberValidationSummary?.resultsById?.[accountId]?.stackArn ||
            memberValidationSummary?.resultsById?.[accountId]?.stack?.arn ||
            memberValidationSummary?.resultsById?.[accountId]?.stack?.stackId ||
          memberStackReferenceByAccountId.get(accountId) ||
            managementStackReference ||
            normalizedStackSetName
        ).trim();
        const memberRegions = Array.isArray(
          memberValidationSummary?.resultsById?.[accountId]?.regionsUsed
        )
          ? memberValidationSummary.resultsById[accountId].regionsUsed
          : [];

        const createdMemberProfile = await dispatch(
          createAgentPermissionProfile({
            name: accountName,
            description: accountDescription,
            type: 'aws account',
            awsAccountId: accountId,
            authType: 'role',
            roleName: memberRoleName,
            externalId: memberExternalId,
            ...(memberStackReference ? { stackArn: memberStackReference } : {}),
            deploymentPreferences: JSON.stringify({
              defaultRegions:
                memberRegions.length > 0
                  ? memberRegions
                  : Array.isArray(selectedRegions)
                    ? selectedRegions
                    : [],
              cloudformationStackName:
                state?.authProfile?.stackName || normalizedStackSetName || '',
              cloudformationStackArn: memberStackReference || '',
              orgManagementAccountId: managementAccountId,
              orgPermissionProfileId: orgProfileRecordId || '',
              orgStackSetName: normalizedStackSetName || '',
              orgStackSetRegion: normalizedStackSetRegion,
            }),
          })
        ).unwrap();

        await createWorkloadForProfile({
          permissionRecordId: createdMemberProfile?.recordId,
          accountId,
          stackReference: memberStackReference,
        });
        enqueueAwsCisLaunch({
          permissionProfile: createdMemberProfile,
          accountId,
          roleName: memberRoleName,
          externalId: memberExternalId,
          name: accountName,
        });

        existingAwsAccountIds.add(accountId);
        createdCount += 1;
      }

      if (cisLaunchTargets.length > 0) {
        const availableCredits =
          (userProfile?.agentCredits?.adhocCredits || 0) +
          (userProfile?.agentCredits?.monthlyBaseCredits || 0) || 0;

        void Promise.allSettled(
          cisLaunchTargets.map((target) =>
            autoLaunchCisReport({
              dispatch,
              cloudProvider: 'aws',
              authProfile: target.authProfile,
              accountId: target.accountId,
              parentId: target.parentId,
              availableCredits,
            })
          )
        ).then((results) => {
          const failedCount = results.filter(
            (result) => result.status === 'rejected'
          ).length;
          if (failedCount > 0) {
            console.warn(
              `Failed to auto-launch ${failedCount} AWS org CIS scan${failedCount === 1 ? '' : 's'}`
            );
          }
        });
      }

      toast.success(
        `Imported ${createdCount} account${createdCount === 1 ? '' : 's'}${
          skippedCount > 0 ? ` (${skippedCount} skipped)` : ''
        }.`
      );
      return true;
    } catch (error) {
      console.error('Failed to import AWS organization accounts', error);
      toast.error(error?.message || 'Failed to import organization accounts');
      return false;
    } finally {
      setIsImportingOrgAccounts(false);
    }
  }, [
    authType,
    dispatch,
    editedStackArn,
    orgAccounts,
    orgStackSetName,
    orgStackSetRegion,
    orgStackSetOperationId,
    orgMemberExternalIdValue,
    orgMemberRoleNameValue,
    presetDescription,
    presetName,
    selectedOrgAccountIds,
    selectedRegions,
    state.accountId,
    state.authProfile,
    userProfile?.agentCredits,
    userProfile?.agentPermissionProfiles,
    validateSelectedOrgAccounts,
    orgStackSetStatus?.accounts,
    validationResult?.stackArn,
    validationResult?.stack?.arn,
  ]);

  const handleContinue = () => {
   

    // Check if this is a Google Workspace profile - skip AWS-specific validations
    const isGoogleWorkspaceProfile = selectedPermission?.type === 'google_workspace' || 
                                      state.authProfile?.provider === 'google_workspace';

    // Only validate AWS account ID for non-Google Workspace profiles in manual tab
    if (manualStep === 0 && activeTab !== 'saved' && !isGoogleWorkspaceProfile) {
      const error = validateAccountId(state.accountId);
      if (error) {
        const displayError = isAwsOrgFlow
          ? error
              .replace('AWS Account ID', 'Org Management Account ID')
              .replace('AWS Account ID', 'Org Management Account ID')
          : error;
        setAccountIdError(displayError);
        setShowAccountIdError(true);
        return;
      }
    }

    if (
      activeTab === 'manual' &&
      isAwsOrgFlow &&
      manualStep === 2 &&
      !isValidationSuccessful
    ) {
      toast.error('Validate management account permissions before continuing');
      return;
    }

    if (activeTab === 'manual' && isAwsOrgFlow && manualStep === 3 && !orgDeploymentConfirmed) {
      toast.error('Confirm StackSet deployment before continuing');
      return;
    }

    if (manualStep < stepLabels.length - 1 && activeTab !== 'saved') {
      setManualStep(manualStep + 1);
    } else {
      activeTab === 'saved' ? handleConfirm() : handleSaveAndUse();
    }
  };

  const handleConfirm = () => {
    // Check if the selected permission is a Google Workspace profile
    const isGoogleWorkspace = selectedPermission?.type === 'google_workspace' || 
                              state.authProfile?.provider === 'google_workspace';

    

    if (isGoogleWorkspace) {
      // For Google Workspace, skip the region modal and mark as validated
      setState((prev) => ({
        ...prev,
        isPermissionsModalOpen: false,
        accountId: prev.authProfile?.domain || prev.accountId,
        authProfile: {
          ...prev.authProfile,
          validated: true,
          provider: 'google_workspace',
        },
      }));

      // For Google Workspace, we skip the region modal and call onComplete directly if available
      // The Report.jsx will detect google_workspace and handle it appropriately
      if (onComplete && typeof onComplete === 'function') {
        onComplete({
          cloudProvider: 'google_workspace',
          authProfile: {
            ...state.authProfile,
            validated: true,
            provider: 'google_workspace',
          },
        });
      } else {
        // If no onComplete, still open region modal to let parent component handle the flow
        // but with a flag indicating google_workspace
        dispatch(setIsRegionModalOpen(true));
      }
    } else {
      // For AWS, keep existing behavior
      setState((prev) => ({
        ...prev,
        isPermissionsModalOpen: false,
        accountId: prev.accountId,
        authProfile: {
          ...prev.authProfile,
          validated: true,
          authType: prev.authType || 'role',
          // Ensure awsAccountId is preserved from selected profile
          awsAccountId: prev.authProfile?.awsAccountId || prev.accountId || '',
          accountId: prev.authProfile?.awsAccountId || prev.accountId || '',
        },
      }));

      dispatch(setIsRegionModalOpen(true));
    }

    if (onOpenChange && typeof onOpenChange === 'function') {
      onOpenChange();
    }
  };

  const handleValidateSavedPermissions = async (permission) => {
    if (!permission) return;
    setLastValidatedPermission(permission);
    const authProfile =
      typeof permission.authProfile === 'string'
        ? (() => {
            try {
              return JSON.parse(permission.authProfile) || {};
            } catch (_) {
              return {};
            }
          })()
        : permission.authProfile || {};
    const workloadId = authProfile.workloadId;

    if (!workloadId) {
      toast.error('Workload ID not found for this permission profile.');
      return;
    }

    const permissionId = permission.recordId || permission.name;
    try {
      setValidationSummary({
        status: 'loading',
        permissionsValid: null,
        message: '',
        reason: '',
        missingPermissions: [],
      });
      setShowUpdatePermissionsDetails(false);
      setIsValidationSummaryOpen(true);
      setValidatingPermissionId(permissionId);
      setIsValidatingSaved(true);
      setValidationToolEvents([]);
      const response = await validatePermissionProfile({
        workloadId,
        permissions: requiredPermissions?.policy || {},
      }, {
        onToolEvent: (eventType, data) => {
          upsertValidationToolEvent(eventType, data);
        },
        onOperationFinal: (data) => {
          if (data && typeof data === 'object') {
            const toolStatuses = data.tools || data.toolCalls;
            if (Array.isArray(toolStatuses)) {
              toolStatuses.forEach((tool) => {
                upsertValidationToolEvent('tool_result', {
                  id: tool?.id,
                  name: tool?.name,
                  status: tool?.status,
                  output: tool?.output,
                  error: tool?.error,
                  message: tool?.message,
                });
              });
            }
          }
        },
        onDone: (data) => {
          if (data && typeof data === 'object' && Array.isArray(data?.tools)) {
            data.tools.forEach((tool) => {
              upsertValidationToolEvent('tool_result', {
                id: tool?.id,
                name: tool?.name,
                status: tool?.status,
                output: tool?.output,
                error: tool?.error,
                message: tool?.message,
              });
            });
          }
        },
      });
      const body = response?.body || {};
      const permissionsValidRaw =
        body.permissionsValid !== undefined
          ? body.permissionsValid
          : body.success !== undefined
            ? body.success
            : false;
      const permissionsValid =
        typeof permissionsValidRaw === 'boolean'
          ? permissionsValidRaw
          : !!permissionsValidRaw;
      const message = body.message || '';
      const rawDetails = body.details;
      let parsedDetails = {};

      if (typeof rawDetails === 'string') {
        try {
          parsedDetails = JSON.parse(rawDetails) || {};
        } catch (_) {
          parsedDetails = {};
        }
      } else if (rawDetails && typeof rawDetails === 'object') {
        parsedDetails = rawDetails;
      }

      const summaryPayload = {
        status: 'done',
        permissionsValid,
        message,
        reason: parsedDetails.reason || '',
        missingPermissions: Array.isArray(parsedDetails.missingPermissions)
          ? parsedDetails.missingPermissions
          : [],
      };

      setValidationSummary(summaryPayload);
      setShowUpdatePermissionsDetails(!permissionsValid);
      if (setIsValidationSuccessful) setIsValidationSuccessful(permissionsValid);

      if (permissionsValid) {
        toast.success('Permissions look good.');
      } else {
        toast.error('Permissions are missing. Review the details.');
      }
    } catch (err) {
      console.error('Validate permissions failed', err);
      analytics.track(ANALYTICS_EVENTS.ERR_PERMISSION_VALIDATION_FAILED, {
        route: getAnalyticsRoute(),
        error_message: err?.message || 'Failed to validate permissions',
      });
      setValidationSummary({
        status: 'done',
        permissionsValid: false,
        message: err?.message || 'Failed to validate permissions. Please try again.',
        reason: '',
        missingPermissions: [],
      });
      setShowUpdatePermissionsDetails(true);
      if (setIsValidationSuccessful) setIsValidationSuccessful(false);
      toast.error('Failed to validate permissions');
    } finally {
      setIsValidatingSaved(false);
      setValidatingPermissionId(null);
    }
  };

  const handleValidationSummaryOpenChange = (open) => {
    if (!open && validationSummary?.status === 'loading') {
      return;
    }
    setIsValidationSummaryOpen(open);
    if (!open) {
      setValidationSummary(null);
      setShowUpdatePermissionsDetails(false);
      setValidationToolEvents([]);
    }
  };

  const handleUpdateProgressOpenChange = (open) => {
    if (!open) {
      setIsUpdateProgressOpen(false);
      setUpdateToolEvents([]);
      setUpdateSummary({
        status: 'idle',
        success: null,
        message: '',
        reason: '',
        details: null,
      });
      return;
    }
    setIsUpdateProgressOpen(true);
  };

  const handleRetryValidation = () => {
    if (!isValidationLoading && lastValidatedPermission) {
      handleValidateSavedPermissions(lastValidatedPermission);
    }
  };

  const handleUpdatePermissions = async () => {
    if (!lastValidatedPermission) return;

    const authProfile =
      typeof lastValidatedPermission.authProfile === 'string'
        ? (() => {
            try {
              return JSON.parse(lastValidatedPermission.authProfile) || {};
            } catch (_) {
              return {};
            }
          })()
        : lastValidatedPermission.authProfile || {};

    const workloadId = normalizeWorkloadId(
      authProfile.workloadId || state.authProfile?.workloadId || ''
    ) || '';
    const roleName =
      authProfile.roleName || state.authProfile?.roleName || '';

    if (!workloadId || !roleName) {
      toast.error('Workload ID and role name are required to update permissions.');
      return;
    }

    const policy = requiredPermissions?.policy;
    if (!policy || typeof policy !== 'object') {
      toast.error('No policy found to apply.');
      return;
    }

    try {
      setIsUpdatingPermissions(true);
      setIsUpdateProgressOpen(true);
      setUpdateToolEvents([]);
      setUpdateSummary({
        status: 'loading',
        success: null,
        message: 'Updating permissions. This may take a minute.',
        reason: '',
        details: null,
      });
      const { body } = await updatePermissionProfilePermissions({
        workloadId,
        roleName,
        policy,
        temporaryAccessHours: temporaryAccess ? selectedTime : undefined,
      }, {
        onToolEvent: (eventType, data) => {
          upsertUpdateToolEvent(eventType, data);
        },
        onOperationFinal: (data) => {
          if (data && typeof data === 'object') {
            const toolStatuses = data.tools || data.toolCalls;
            if (Array.isArray(toolStatuses)) {
              toolStatuses.forEach((tool) => {
                upsertUpdateToolEvent('tool_result', {
                  id: tool?.id,
                  name: tool?.name,
                  status: tool?.status,
                  output: tool?.output,
                  error: tool?.error,
                  message: tool?.message,
                });
              });
            }
          }
        },
        onDone: (data) => {
          if (data && typeof data === 'object' && Array.isArray(data?.tools)) {
            data.tools.forEach((tool) => {
              upsertUpdateToolEvent('tool_result', {
                id: tool?.id,
                name: tool?.name,
                status: tool?.status,
                output: tool?.output,
                error: tool?.error,
                message: tool?.message,
              });
            });
          }
        },
      });
      const success = !!body?.success;
      const message =
        body?.message ||
        (success ? 'Permissions update requested.' : 'Permissions update failed.');

      if (success) {
        toast.success(message);
        handleValidationSummaryOpenChange(false);
        setShowUpdatePermissionsDetails(false);
      } else {
        toast.error(message);
      }
      let parsedDetails = body?.details || null;
      if (typeof parsedDetails === 'string') {
        try {
          parsedDetails = JSON.parse(parsedDetails);
        } catch (_) {
          // keep as string
        }
      }
      setUpdateSummary({
        status: 'done',
        success,
        message,
        reason: parsedDetails?.reason || '',
        details: parsedDetails || null,
      });
    } catch (error) {
      console.error('Failed to update permissions', error);
      toast.error(error?.message || 'Failed to update permissions');
      setUpdateSummary({
        status: 'done',
        success: false,
        message: error?.message || 'Failed to update permissions',
        reason: '',
        details: null,
      });
    } finally {
      setIsUpdatingPermissions(false);
    }
  };

  const handleSelect = (permission) => {
    
    setSelectedPermission(permission);

    // Parse authProfile if it's a string
    const authProfile = typeof permission.authProfile === 'string' 
      ? JSON.parse(permission.authProfile) 
      : permission.authProfile || {};

    // Detect if this is a Google Workspace profile
    const isGoogleWorkspace = permission.type === 'google_workspace' || 
                              authProfile.provider === 'google_workspace';

   

    const authType = authProfile.authType || 'role';

    if (isGoogleWorkspace) {
      // Handle Google Workspace profile
      setState((prev) => ({
        ...prev,
        accountId: authProfile.domain || '', // Use domain as the identifier
        authProfile: {
          ...prev.authProfile,
          provider: 'google_workspace',
          domain: authProfile.domain || '',
          adminEmail: authProfile.adminEmail || '',
          serviceAccountJson: authProfile.serviceAccountJson || '',
          projectId: authProfile.projectId || '',
          clientEmail: authProfile.clientEmail || '',
          workloadId: authProfile.workloadId || '',
          authProfileName: permission.name,
          validated: false, // Will be set to true on confirm
        },
      }));
    } else {
      // Handle AWS profile (default)
      setState((prev) => ({
        ...prev,
        accountId: authProfile.awsAccountId || '',
        authProfile: {
          ...prev.authProfile,
          roleName: authProfile.roleName || '',
          externalId: authProfile.externalId || '',
          stackArn: authProfile.stackArn || '',
          workloadId: authProfile.workloadId || '',
          authProfileName: permission.name,
          authType: authType,
          awsAccountId: authProfile.awsAccountId || authProfile.accountId || '', // Ensure awsAccountId is set in authProfile
          accountId: authProfile.awsAccountId || authProfile.accountId || '', // Also set accountId for compatibility
        },
      }));
    }

    let existingLogs = [];

    try {
      const agentData = userProfile?.agentHistory?.find(
        (agent) => agent.recordId === recordId
      );
      if (agentData?.log) {
        const parsedLog = toLogObject(agentData.log);
        existingLogs = parsedLog.logs || [];
      }

      const updatedLogs = existingLogs.map((log) => ({
        ...log,
        authProfileName: permission.name,
      }));

      const updatedLogsObject = {
        logs: updatedLogs,
        currentPhase: state.currentPhase,
        currentTask: state.currentTask,
        lastUpdated: new Date().toISOString(),
        authProfileName: permission.name,
      };

      if (isReconnecting) {
        const reconnectAuthProfile = isGoogleWorkspace
          ? {
              ...state.authProfile,
              provider: 'google_workspace',
              domain: authProfile.domain || '',
              adminEmail: authProfile.adminEmail || '',
              serviceAccountJson: authProfile.serviceAccountJson || '',
              authProfileName: permission.name,
              validated: true,
            }
          : {
              ...state.authProfile,
              authType: authType,
              awsAccountId: authProfile.awsAccountId || '',
              roleName: authProfile.roleName || '',
              externalId: authProfile.externalId || '',
              authProfileName: permission.name,
              validated: true,
            };

        dispatch(
          updateAgentConnection({
            recordId: recordId,
            status: 'running',
            log: JSON.stringify(updatedLogsObject),
            authProfile: JSON.stringify(reconnectAuthProfile),
          })
        );
      }
    } catch (error) {
      console.error('Error updating logs with auth profile:', error);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (!state?.prefillPermissionProfileId) return;

    const permission =
      userProfile?.agentPermissionProfiles?.find(
        (saved) =>
          saved?.recordId === state.prefillPermissionProfileId ||
          saved?.id === state.prefillPermissionProfileId
      ) || null;

    if (!permission) {
      setState((prev) => ({
        ...prev,
        prefillPermissionProfileId: null,
        prefillPermissionProfileName: null,
      }));
      return;
    }

    setActiveTab('saved');
    handleSelect(permission);
    setState((prev) => ({
      ...prev,
      prefillPermissionProfileId: null,
      prefillPermissionProfileName: null,
    }));
  }, [
    handleSelect,
    isOpen,
    setState,
    state?.prefillPermissionProfileId,
    userProfile,
  ]);

  const buildIamRoleTemplate = useCallback((roleName, externalId) => {
    const managedPolicies = isAdminEnabled
      ? ['arn:aws:iam::aws:policy/AdministratorAccess']
      : ['arn:aws:iam::aws:policy/ReadOnlyAccess'];

    const inlinePolicies = [];

    if (!isAdminEnabled && isLimitedWriteEnabled) {
      inlinePolicies.push({
        PolicyName: 'LimitedDeploymentPolicy',
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: '*',
              Resource: '*',
              Condition: {
                "ForAnyValue:StringEquals": {
                  'aws:CalledVia': 'cloudformation.amazonaws.com'
                }
              }
            },
            {
              Effect: 'Allow',
              Action: [
                'cloudformation:CreateStack',
                'cloudformation:UpdateStack',
                'cloudformation:CreateChangeSet'
              ],
              Resource: '*'
            }
          ]
        },
      });
    }

    if (!isAdminEnabled && isRestrictedEnabled && requiredPermissions && Object.keys(requiredPermissions?.policy || {}).length > 0) {
      inlinePolicies.push({
        PolicyName: 'CloudAgentRestrictedAccessPolicy',
        PolicyDocument: requiredPermissions?.policy || {},
      });
    }

    if (!isAdminEnabled && isWellArchitectedUpdateEnabled) {
      inlinePolicies.push({
        PolicyName: 'WellArchitectedUpdatePolicy',
        PolicyDocument: WELL_ARCHITECTED_UPDATE_POLICY,
      });
    }

    return getCfTemplateForIamRole({
      roleName,
      externalId,
      managedPolicies,
      inlinePolicies,
      temporaryAccessHours: temporaryAccess ? selectedTime : 0,
    });
  }, [
    isAdminEnabled,
    isLimitedWriteEnabled,
    isRestrictedEnabled,
    isWellArchitectedUpdateEnabled,
    requiredPermissions,
    selectedTime,
    temporaryAccess,
  ]);

  const cfTemplate = useMemo(
    () =>
      buildIamRoleTemplate(
        state.authProfile.roleName,
        state.authProfile.externalId
      ),
    [
      buildIamRoleTemplate,
      state.authProfile.externalId,
      state.authProfile.roleName,
    ]
  );

  const manualIamPolicyDetails = useMemo(() => {
    const roleResource = Object.values(cfTemplate?.Resources || {}).find(
      (resource) => resource?.Type === 'AWS::IAM::Role'
    );
    const roleProperties = roleResource?.Properties || {};
    const inlinePolicies = Array.isArray(roleProperties.Policies)
      ? roleProperties.Policies
      : [];
    const statements = inlinePolicies.flatMap((policy) => {
      const statement = policy?.PolicyDocument?.Statement;
      if (Array.isArray(statement)) return statement;
      return statement ? [statement] : [];
    });

    return {
      managedPolicyArns: Array.isArray(roleProperties.ManagedPolicyArns)
        ? roleProperties.ManagedPolicyArns
        : [],
      policyDocument: {
        Version: '2012-10-17',
        Statement: statements,
      },
    };
  }, [cfTemplate]);

  const orgMemberRoleTemplate = useMemo(
    () =>
      buildIamRoleTemplate(
        orgMemberRoleNameValue || state.authProfile.roleName,
        orgMemberExternalIdValue || state.authProfile.externalId
      ),
    [
      buildIamRoleTemplate,
      orgMemberExternalIdValue,
      orgMemberRoleNameValue,
      state.authProfile.externalId,
      state.authProfile.roleName,
    ]
  );

  const tfTemplate = getTfTemplateForIamRole(
    state.authProfile.roleName,
    state.authProfile.externalId,
    [],
    ['read-managed'],
    'readwrite',
    0,
    false
  );

  const orgMemberRoleTemplateText = useMemo(
    () => JSON.stringify(orgMemberRoleTemplate, null, 2),
    [orgMemberRoleTemplate]
  );

  const orgStackSetLaunchTemplate = useMemo(
    () => ({
      AWSTemplateFormatVersion: '2010-09-09',
      Description:
        'CloudFormation teemplate to deploy StackSet for Access to AWS Org for CloudAgent',
      Parameters: {
        OrganizationalUnitIds: {
          Type: 'String',
          MinLength: 1,
          Description:
            'Provide one or more root id and/or OU ids, comma-separated (example: r-xxxx,ou-xxxx-yyyyyyyy).',
        },
      },
      Resources: {
        StackSet: {
          Type: 'AWS::CloudFormation::StackSet',
          Properties: {
            StackSetName:
              String(orgStackSetName || '').trim() || 'CloudAgent-Org-Access-Stackset',
            Description:
              'CloudFormation StackSet to provision IAM access for CloudAgent',
            Capabilities: ['CAPABILITY_NAMED_IAM', 'CAPABILITY_IAM'],
            PermissionModel: 'SERVICE_MANAGED',
            AutoDeployment: {
              Enabled: true,
              RetainStacksOnAccountRemoval: false,
            },
            CallAs: 'SELF',
            StackInstancesGroup: [
              {
                Regions: [String(orgStackSetRegion || '').trim() || 'us-east-1'],
              DeploymentTargets: {
                  OrganizationalUnitIds: {
                    'Fn::Split': [',', { Ref: 'OrganizationalUnitIds' }],
                  },
              },
            },
            ],
            TemplateBody: JSON.stringify(orgMemberRoleTemplate),
          },
        },
      },
    }),
    [orgMemberRoleTemplate, orgStackSetName, orgStackSetRegion]
  );

  const orgStackSetLaunchTemplateText = useMemo(
    () => JSON.stringify(orgStackSetLaunchTemplate, null, 2),
    [orgStackSetLaunchTemplate]
  );

  const copyTextToClipboard = useCallback(async (text, label) => {
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
        return;
      }
    } catch (_) {
      // Fallback below.
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success(`${label} copied to clipboard`);
    } catch (_) {
      toast.error('Unable to copy template contents');
    }
  }, []);

  const handleEdit = (permission) => {
    setIsEditing(true);
    setEditingPermission(permission);
    setPresetDescription(permission.description || '');
    setActiveTab('manual');

    // Parse authProfile if it's a string
    const authProfile = typeof permission.authProfile === 'string' 
      ? JSON.parse(permission.authProfile) 
      : permission.authProfile || {};

    const authType = authProfile.authType || 'role';

    if (authType === 'credentials') {
      setState((prev) => ({
        ...prev,
        accountId: authProfile.awsAccountId || '',
        authProfile: {
          ...prev.authProfile,
          accessKeyId: authProfile.accessKeyId || '',
          secretAccessKey: authProfile.secretAccessKey || '',
          sessionToken: authProfile.sessionToken || '',
          stackArn: authProfile.stackArn || '',
          workloadId: authProfile.workloadId || prev.authProfile?.workloadId || '',
        },
      }));
      setAuthType('credentials');
      setEditedStackArn(authProfile.stackArn || '');
    } else {
      setState((prev) => ({
        ...prev,
        accountId: authProfile.awsAccountId || '',
        authProfile: {
          ...prev.authProfile,
          roleName: authProfile.roleName || '',
          externalId: authProfile.externalId || '',
          stackArn: authProfile.stackArn || '',
          workloadId: authProfile.workloadId || prev.authProfile?.workloadId || '',
        },
      }));
      setAuthType('role');
      setEditedStackArn(authProfile.stackArn || '');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingPermission(null);
    setState((prev) => ({
      ...prev,
      accountId: '',
      authProfile: {
        roleName: '',
        externalId: '',
        accessKeyId: '',
        secretAccessKey: '',
        sessionToken: '',
        stackArn: '',
        workloadId: '',
      },
    }));
    setAuthType('role');
  };

  const handleCreateWorkloadForExistingProfile = async () => {
    const sourcePermission = editingPermission || initialEditingPermission;
    if (!isAwsAccountPermissionProfile(sourcePermission)) {
      toast.error('Workloads can only be created for AWS account environments.');
      return;
    }

    const recordIdForUpdate = sourcePermission?.recordId;
    const accountIdForWorkload = `${state.accountId || parsedEditingAuthProfile.awsAccountId || ''}`.replace(
      /\s+/g,
      ''
    );
    const stackArnForWorkload = `${editedStackArn || state.authProfile?.stackArn || parsedEditingAuthProfile.stackArn || ''}`.trim();

    if (!recordIdForUpdate) {
      toast.error('Missing permission profile identifier.');
      return;
    }

    if (!accountIdForWorkload || !stackArnForWorkload) {
      toast.error('Account ID and stack ARN are required to create the workload.');
      return;
    }

    setIsCreatingProfileWorkload(true);
    let toastId;
    try {
      toastId = toast.loading('Creating workload...');
      const result = await createPermissionProfileWorkload({
        permissionProfileId: recordIdForUpdate,
        accountId: accountIdForWorkload,
        stackArn: stackArnForWorkload,
      });

      if (result?.success && result?.workloadId) {
        await dispatch(
          updateAgentPermissionProfile({
            recordId: recordIdForUpdate,
            workloadId: result.workloadId,
            stackArn: stackArnForWorkload,
          })
        ).unwrap();

        setState((prev) => ({
          ...prev,
          authProfile: {
            ...prev.authProfile,
            workloadId: result.workloadId,
            stackArn: stackArnForWorkload,
          },
        }));

        setEditingPermission((prev) => {
          if (!prev) return prev;
          const previousAuthProfile =
            typeof prev.authProfile === 'string'
              ? (() => {
                  try {
                    return JSON.parse(prev.authProfile) || {};
                  } catch (_) {
                    return {};
                  }
                })()
              : prev.authProfile || {};

          const updatedAuthProfile = {
            ...previousAuthProfile,
            workloadId: result.workloadId,
            stackArn: stackArnForWorkload,
            awsAccountId: accountIdForWorkload,
          };

          return {
            ...prev,
            authProfile:
              typeof prev.authProfile === 'string'
                ? JSON.stringify(updatedAuthProfile)
                : updatedAuthProfile,
          };
        });

        toast.success(`Workload created: ${result.workloadId}`, { id: toastId });
      } else {
        if (toastId) {
          toast.dismiss(toastId);
        }
        toast.error(result?.message || 'Failed to create workload');
      }
    } catch (error) {
      console.error('Workload creation failed', error);
      if (toastId) {
        toast.dismiss(toastId);
      } else {
        toast.dismiss();
      }
      toast.error(error?.message || 'Failed to create workload');
    } finally {
      setIsCreatingProfileWorkload(false);
    }
  };

  const handleUpdate = async () => {
    try {
      setIsUpdating(true);

      const updatedProfile = {
        name: editingPermission.name,
        awsAccountId: state.accountId,
        authType: authType,
        description: presetDescription,
        recordId: editingPermission.recordId,
        ...(authType === 'role'
          ? {
              roleName: state.authProfile.roleName,
              externalId: state.authProfile.externalId,
              accessKeyId: '',
              secretAccessKey: '',
              sessionToken: '',
            }
          : {
              accessKeyId: state.authProfile.accessKeyId,
              secretAccessKey: state.authProfile.secretAccessKey,
              sessionToken: state.authProfile.sessionToken,
              roleName: '',
              externalId: '',
            }),
      };

      await dispatch(updateAgentPermissionProfile(updatedProfile)).unwrap();

      let existingLogs = [];

      const agentData = userProfile?.agentHistory?.find(
        (agent) => agent.recordId === recordId
      );
      if (agentData?.log) {
      const parsedLog = toLogObject(agentData.log);
        existingLogs = parsedLog.logs || [];
      }

      const updatedLogs = existingLogs.map((log) => ({
        ...log,
        authProfileName: updatedProfile.name,
      }));

      const updatedLogsObject = {
        logs: updatedLogs,
        currentPhase: state.currentPhase,
        currentTask: state.currentTask,
        lastUpdated: new Date().toISOString(),
        authProfileName: updatedProfile.name,
      };

      await dispatch(
        updateAgentConnection({
          recordId: recordId,
          status: 'running',
          log: JSON.stringify(updatedLogsObject),
          authProfile: JSON.stringify({
            ...state.authProfile,
            authType: authType,
            awsAccountId: updatedProfile.awsAccountId || '',
            roleName: updatedProfile.roleName || '',
            externalId: updatedProfile.externalId || '',
            accessKeyId: updatedProfile.accessKeyId || '',
            secretAccessKey: updatedProfile.secretAccessKey || '',
            sessionToken: updatedProfile.sessionToken || '',
            authProfileName: updatedProfile.name,
          }),
        })
      );

      toast.success('Permission updated successfully');
      setIsEditing(false);
    } catch (error) {
      toast.error('Error updating permission');
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    if (filteredPermissionProfiles?.length > 0 && !isDashboard) {
      setActiveTab('saved');
    }
  }, [filteredPermissionProfiles, isDashboard]);

  useEffect(() => {
    return () => {
      handleCancelEdit();
    };
  }, []);

  useEffect(() => {
    if (
      requiredPermissions &&
      Object.keys(requiredPermissions?.policy || {}).length > 0
    ) {
      setIsRestrictedEnabled(true);
    } else {
      setIsRestrictedEnabled(false);
    }
  }, [requiredPermissions]);

  useEffect(() => {
    if (!isAwsOrgFlow) return;
    if (activeTab !== 'manual' || manualStep !== 4) return;
    if (orgAccountsLoading || orgAccounts.length > 0) return;
    loadAwsOrgAccounts();
  }, [
    activeTab,
    isAwsOrgFlow,
    loadAwsOrgAccounts,
    manualStep,
    orgAccounts.length,
    orgAccountsLoading,
  ]);

  useEffect(() => {
    if (!isAwsOrgFlow) return;
    const allowedIds = new Set(importableOrgAccounts.map((account) => account.id));
    setSelectedOrgAccountIds((prev) =>
      Array.isArray(prev) ? prev.filter((id) => allowedIds.has(id)) : []
    );
  }, [importableOrgAccounts, isAwsOrgFlow]);

  const stepLabels = isAwsOrgFlow
    ? ['Gather Details', 'Deploy', 'Validate', 'Deploy (Org Accounts)', 'Import']
    : ['Gather Details', 'Deploy', 'Validate'];

  function trackCloudSetupWizardClosed() {
    if (getAnalyticsRoute() !== '/dashboard/cloud-setup') return;
    if (!isOpen || hasTrackedCloudSetupWizardCloseRef.current) return;

    hasTrackedCloudSetupWizardCloseRef.current = true;
    analytics.track(ANALYTICS_EVENTS.CLOUD_SETUP_WIZARD_CLOSED, {
      route: getAnalyticsRoute(),
      environment_type: normalizedEnvironmentType || 'aws_account',
      step_index: manualStep,
      step_name: stepLabels[manualStep] || null,
    });
  }

  useEffect(() => {
    if (!isOpen) {
      hasTrackedCloudSetupWizardOpenRef.current = false;
      hasTrackedCloudSetupWizardCloseRef.current = false;
      return;
    }
    if (getAnalyticsRoute() !== '/dashboard/cloud-setup') return;
    if (hasTrackedCloudSetupWizardOpenRef.current) return;

    hasTrackedCloudSetupWizardOpenRef.current = true;
    hasTrackedCloudSetupWizardCloseRef.current = false;
    analytics.track(ANALYTICS_EVENTS.CLOUD_SETUP_WIZARD_OPENED, {
      route: getAnalyticsRoute(),
      environment_type: normalizedEnvironmentType || 'aws_account',
    });
  }, [isOpen, normalizedEnvironmentType]);

  useEffect(() => {
    if (!isOpen || !isAwsOrgFlow || !initialIsEditing) return;
    const normalizedStep = Number(initialManualStep);
    if (!Number.isInteger(normalizedStep)) return;
    if (normalizedStep < 0 || normalizedStep >= stepLabels.length) return;
    setActiveTab('manual');
    setManualStep(normalizedStep);
  }, [initialIsEditing, initialManualStep, isAwsOrgFlow, isOpen, stepLabels.length]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent
        className={cn(
          'max-w-[100%] bg-white p-6 max-h-[90vh] h-[90vh] overflow-hidden',
          activeTab === 'manual' ? 'w-[95%]' : 'w-[55%]'
        )}
      >
        <div className="flex h-full min-h-0">
          <div className="flex-1 flex flex-col h-full min-h-0">
            {!isDashboard && (
              <DialogHeader>
                <div className="flex items-start gap-4">
                  <DialogTitle className="text-2xl font-[600] text-primary-800 tracking-normal text-left">
                    Before we start, we need some permissions
                  </DialogTitle>
                </div>
              </DialogHeader>
            )}

            <div className="flex py-4">
              {!isDashboard && (
                <>
                  <button
                    onClick={() => setActiveTab('saved')}
                    className={cn(
                      'py-2 px-4 text-sm font-medium rounded-[8px]',
                      activeTab === 'saved'
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-primary-300 hover:text-primary-600'
                    )}
                  >
                    Saved Permissions
                  </button>
                  <button
                    onClick={() => setActiveTab('manual')}
                    className={cn(
                      'py-2 px-4 text-sm font-medium rounded-[8px]',
                      activeTab === 'manual'
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-primary-300 hover:text-primary-600'
                    )}
                  >
                    Create New
                  </button>
                </>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 min-h-0">

            {activeTab === 'saved' && (
              <div className="space-y-4">
                {!isDashboard && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search category"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                )}

                <div className="space-y-6">
                 
                  <div className="space-y-4">
                    <h3 className="font-medium text-primary-800">
                      Provide access to the Cloud Environment
                    </h3>
                    <p className="text-sm text-gray-700 !mt-0">
                      Here we can have a small description about how this
                      works and what is the access.
                    </p>

                    {filteredPermissionProfiles?.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-gray-500 mb-2">
                          {cloudProvider 
                            ? `No ${cloudProvider === 'google_workspace' ? 'Google Workspace' : cloudProvider.toUpperCase()} environments found.`
                            : 'No permissions found.'}
                        </p>
                        <p className="text-sm text-gray-400">
                          {cloudProvider 
                            ? `Add a ${cloudProvider === 'google_workspace' ? 'Google Workspace' : cloudProvider.toUpperCase()} environment to get started.`
                            : 'Add a new permission to see it here.'}
                        </p>
                      </div>
                    ) : (
      filteredPermissionProfiles?.map((permission) => {
        const authProfile =
          typeof permission.authProfile === 'string'
            ? (() => {
                try {
                  return JSON.parse(permission.authProfile) || {};
                } catch (_) {
                  return {};
                }
              })()
            : permission.authProfile || {};
        const workloadId = authProfile.workloadId;
        const permissionId = permission.recordId || permission.name;
        const isButtonLoading =
          isValidatingSaved && validatingPermissionId === permissionId;
        const canValidate =
          workloadId &&
          requiredPermissions &&
          !!Object.keys(requiredPermissions?.policy || {}).length;

        return (
          <div key={permissionId || permission.name} className="mb-4 last:mb-0">
            <div
              className={`flex flex-col gap-3 p-4 border rounded-lg cursor-pointer ${
                                selectedPermission?.name === permission.name
                                  ? 'border-primary-500 bg-primary-50'
                                  : 'border-gray-300 bg-white'
                              }`}
                              onClick={() => handleSelect(permission)}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                  <h3 className="font-medium text-lg mb-1">{permission.name}</h3>
                                  <div className="flex flex-wrap gap-6 text-sm text-gray-500">
                                    {permission.description && <span>{permission.description}</span>}
                                    {permission.duration && <span>{permission.duration}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEdit(permission);
                                    }}
                                    className="text-gray-500 hover:text-primary-600"
                                  >
                                    <PencilIcon className="h-4 w-4" />
                                  </Button>
                                  <div className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary-200">
                                    {selectedPermission?.name === permission.name && (
                                      <Icons.check className="h-5 w-5 text-primary-500" />
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex justify-end">
                              {canValidate && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!workloadId || isValidatingSaved}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleValidateSavedPermissions(permission);
                                  }}
                                >
                                  {isButtonLoading && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  Validate Permissions
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'manual' && (
              <>
                <Stepper steps={stepLabels} activeStep={manualStep} />

                {manualStep === 0 && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor="awsAccount"
                          className="text-base font-medium text-gray-900 flex items-center"
                        >
                          {isAwsOrgFlow ? 'Org Management Account Id' : 'AWS Account'}{' '}
                          <span className="text-red-500 ml-1">*</span>
                        </Label>
                        <Input
                          value={state.accountId}
                          onChange={handleAccountIdChange}
                          placeholder={isAwsOrgFlow ? 'Management Account Id' : 'Account Id'}
                          disabled={isEditing}
                          className={cn(
                            showAccountIdError && accountIdError
                              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                              : ''
                          )}
                        />
                        {showAccountIdError && accountIdError && (
                          <p className="text-red-500 text-sm mt-1">
                            {accountIdError}
                          </p>
                        )}
                        <p className="text-sm text-gray-500">
                          {isAwsOrgFlow
                            ? 'Use the 12-digit AWS Organizations management account ID'
                            : 'Use your 12 digit number account'}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-base font-medium text-gray-900">
                        Required Permissions
                      </h3>
                      <div className="flex flex-col space-y-2">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked
                              className="bg-primary-600 data-[state=checked]:bg-primary-600"
                            />
                          <div className="flex items-center gap-2">
                              <Label className="text-gray-600">
                                Read-Only Access
                              </Label>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500">
                            Allows reading configuration <strong className="text-gray-900">(but not data)</strong> for reviewing environment and generating reports. <span className="text-gray-900 font-medium">No access to sensitive data or application content.</span>
                          </p>
                        </div>
                        {requiredPermissions &&
                          Object.keys(requiredPermissions?.policy || {})
                            .length > 0 && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <Switch
                                    checked={isRestrictedEnabled}
                                    onCheckedChange={setIsRestrictedEnabled}
                                    className="bg-primary-600 data-[state=checked]:bg-primary-600"
                                  />
                                  <Label className="text-gray-600">
                                    Blueprint-Specific Permissions (Recommended)
                                  </Label>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setPermissionsModalMode('required');
                                    setShowPermissionsModal(true);
                                  }}
                                >
                                  Show permissions
                                </Button>
                              </div>
                              <p className="text-xs text-gray-500">
                                Deploys just the minimal set of actions this
                                blueprint needs to run successfully.
                              </p>
                            </div>
                          )}
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={isLimitedWriteEnabled}
                              onCheckedChange={setIsLimitedWriteEnabled}
                              className="bg-primary-600 data-[state=checked]:bg-primary-600"
                            />
                            <div className="flex items-center gap-2">
                              <Label className="text-gray-600">
                                Limited Write Access with CloudFormation
                              </Label>
                              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded">
                                Recommended
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500">
                            Allows changes only through AWS CloudFormation; cannot delete or modify existing resources directly.
                          </p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={isWellArchitectedUpdateEnabled}
                              onCheckedChange={setIsWellArchitectedUpdateEnabled}
                              className="bg-primary-600 data-[state=checked]:bg-primary-600"
                            />
                            <Label className="text-gray-600">
                              Update AWS Well-Architected Data
                            </Label>
                          </div>
                          <p className="text-xs text-gray-500">
                            Allows CloudAgent to create Well-Architected workloads, update answers, and create review milestones.
                          </p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={isAdminEnabled}
                              onCheckedChange={setIsAdminEnabled}
                              className="bg-primary-600 data-[state=checked]:bg-primary-600"
                            />
                            <Label className="text-gray-600">
                              Full Administrator Access (Suitable for
                              Sandbox/Dev)
                            </Label>
                          </div>
                          <p className="text-xs text-gray-500">
                            Total access to the environment; not recommended unless this is a sandbox environment.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="py-4 border-t border-b">
                      <div className="flex items-center justify-between space-y-1">
                        <div>
                          <h3 className="font-medium text-gray-900">
                            Temporary Access
                          </h3>
                          <p className="text-sm text-gray-600">
                            You provide to the Agents a custom period of time.
                          </p>
                        </div>
                        <Switch
                          checked={temporaryAccess}
                          onCheckedChange={setTemporaryAccess}
                          className="bg-primary-600 data-[state=checked]:bg-primary-600"
                        />
                      </div>

                      {temporaryAccess && (
                        <div className="space-y-2 mt-4">
                          <Label
                            htmlFor="timeSelection"
                            className="text-sm font-medium text-gray-700"
                          >
                            Select time
                          </Label>
                          <div className="relative">
                            <select
                              id="timeSelection"
                              value={selectedTime}
                              onChange={(e) => setSelectedTime(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none bg-white"
                            >
                              <option value={1}>1 hour</option>
                              <option value={2}>2 hours</option>
                              <option value={4}>4 hours</option>
                              <option value={8}>8 hours</option>
                              <option value={12}>12 hours</option>
                              <option value={24}>1 day</option>
                              <option value={72}>3 days</option>
                              <option value={168}>7 days</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {manualStep === 1 && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-900">
                        {isAwsOrgFlow
                          ? 'Deploy management account permissions'
                          : 'Choose what works the best to deploy your permissions'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {isAwsOrgFlow
                          ? 'Select how to deploy the IAM role in the AWS Organization management account'
                          : 'Select your preferred method for deploying the IAM permissions to your AWS account'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="rounded-lg">
                        <div className="flex items-center p-2">
                          <input
                            type="radio"
                            value="cloudformation"
                            id="cloudformation"
                            checked={accessType === 'cloudformation'}
                            onChange={() => setAccessType('cloudformation')}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                          />
                          <div className="ml-3 flex-1">
                            <div className="flex items-center gap-2">
                              <Label
                                htmlFor="cloudformation"
                                className="font-medium text-primary-600"
                              >
                                Launch CloudFormation Template
                              </Label>
                              <span className="px-2 py-1 text-xs bg-primary-100 text-primary-600 rounded">
                                Most Recommended
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              Prepares and launches the template - just approve the deployment
                            </p>
                          </div>
                          {accessType === 'cloudformation' && (
                            <LaunchStack
                              cfTemplate={JSON.stringify(
                                cfTemplate,
                                null,
                                '    '
                              )}
                              isMissingRequiredConfiguration={false}
                              artifactTitle="asecurecloudaccessrole"
                              label="Launch Template"
                              onStackNameGenerated={(name) => {
                                setState((prev) => ({
                                  ...prev,
                                  authProfile: {
                                    ...prev.authProfile,
                                    stackName: name,
                                  },
                                }));
                              }}
                            />
                          )}
                        </div>
                      </div>

                      {/* <div className="rounded-lg">
                        <div className="flex items-center p-2">
                          <input
                            type="radio"
                            value="terraform"
                            id="terraform"
                            checked={accessType === 'terraform'}
                            onChange={() => setAccessType('terraform')}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                          />
                          <div className="ml-3 flex-1">
                            <Label
                              htmlFor="terraform"
                              className="font-medium text-gray-700"
                            >
                              Download Terraform Template
                            </Label>
                            <p className="text-sm text-gray-600 mt-1">
                              Download the Terraform template and deploy it using your preferred Terraform workflow
                            </p>
                          </div>
                          {accessType === 'terraform' && (
                            <Button
                              size="sm"
                              className="ml-4"
                              variant="outline"
                              onClick={() => {
                                saveToFile(
                                  tfTemplate,
                                  'asecurecloudIamRole.tf'
                                );
                              }}
                            >
                              Download Terraform Template
                            </Button>
                          )}
                        </div>
                      </div> */}

                      <div className="rounded-lg">
                        <div className="flex items-center p-2">
                          <input
                            type="radio"
                            value="download-cf"
                            id="download-cf"
                            checked={accessType === 'download-cf'}
                            onChange={() => setAccessType('download-cf')}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                          />
                          <div className="ml-3 flex-1">
                            <Label
                              htmlFor="download-cf"
                              className="font-medium text-gray-700"
                            >
                              Download CloudFormation Template
                            </Label>
                            <p className="text-sm text-gray-600 mt-1">
                              Download the CloudFormation template and deploy it using AWS CLI, console, or your preferred deployment method
                            </p>
                          </div>
                          {accessType === 'download-cf' && (
                            <Button
                              size="sm"
                              className="ml-4"
                              variant="outline"
                              onClick={() => {
                                saveToFile(
                                  JSON.stringify(cfTemplate, null, '    '),
                                  'asecurecloudIamRole.json'
                                );
                              }}
                            >
                              Download CloudFormation Template
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg">
                        <div className="flex items-center p-2">
                          <input
                            type="radio"
                            value="manual"
                            id="manual-steps"
                            checked={accessType === 'manual'}
                            onChange={() => setAccessType('manual')}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                          />
                          <div className="ml-3 flex-1">
                            <Label
                              htmlFor="manual-steps"
                              className="font-medium text-gray-700"
                            >
                              Manual Steps
                            </Label>
                            <p className="text-sm text-gray-600 mt-1">
                              Follow step-by-step instructions to manually set up the IAM permissions in your AWS console
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-lg">
                      <button
                        onClick={() => setShowPermissions(!showPermissions)}
                        className="flex items-center justify-between w-full p-4 text-left"
                      >
                        <h4 className="font-medium text-gray-900">
                          More Information
                        </h4>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${showPermissions ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {showPermissions && (
                        <div className="border-t p-4 bg-gray-50">
                          <p className="text-sm text-gray-600 mb-4">
                            Here we can have a small description about how this
                            works and what is the access.
                          </p>
                          <div className="space-y-2">
                            <Label
                              htmlFor="roleName"
                              className="text-sm font-medium text-gray-700 flex items-center"
                            >
                              IAM Role Name{' '}
                              <span className="text-red-500 ml-1">*</span>
                            </Label>
                            <Input
                              value={state.authProfile.roleName}
                              onChange={(e) => {
                                if (isAwsOrgFlow) {
                                  setIsValidationSuccessful(false);
                                  setValidationResult(null);
                                  setOrgStackSetStatus(null);
                                  setOrgStackSetStatusError('');
                                  setOrgDeploymentConfirmed(false);
                                }
                                setState((prev) => ({
                                  ...prev,
                                  authProfile: {
                                    ...prev.authProfile,
                                    roleName: e.target.value,
                                  },
                                }));
                              }}
                              placeholder="Role Name"
                            />
                          </div>
                          <div className="space-y-2 mt-4">
                            <Label
                              htmlFor="externalId"
                              className="text-sm font-medium text-gray-700 flex items-center"
                            >
                              External Id
                              <span className="text-red-500 ml-1">*</span>
                            </Label>
                            <Input
                              value={state.authProfile.externalId}
                              onChange={(e) => {
                                if (isAwsOrgFlow) {
                                  setIsValidationSuccessful(false);
                                  setValidationResult(null);
                                  setOrgStackSetStatus(null);
                                  setOrgStackSetStatusError('');
                                  setOrgDeploymentConfirmed(false);
                                }
                                setState((prev) => ({
                                  ...prev,
                                  authProfile: {
                                    ...prev.authProfile,
                                    externalId: e.target.value,
                                  },
                                }));
                              }}
                              placeholder="External Id"
                            />
                          </div>
                          {isEditing && (
                            <div className="space-y-4 mt-4">
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-700 flex items-center">
                                  CloudFormation Stack ARN
                                </Label>
                                <Input
                                  value={editedStackArn}
                                  onChange={(e) => setEditedStackArn(e.target.value)}
                                  placeholder="arn:aws:cloudformation:..."
                                  className="bg-white"
                                />
                                <p className="text-xs text-gray-500">
                                  If you deployed via CloudFormation previously, the stack ARN is stored here.
                                </p>
                              </div>

                              {currentWorkloadId && (
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium text-gray-700">
                                    Workload ID
                                  </Label>
                                  <Input
                                    value={currentWorkloadId}
                                    readOnly
                                    className="bg-gray-100"
                                  />
                                  <p className="text-xs text-gray-500">
                                    The workload associated with this permission profile is ready to manage resources.
                                  </p>
                                </div>
                              )}

                              {!currentWorkloadId && currentStackArn && (
                                <div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCreateWorkloadForExistingProfile}
                                    disabled={isCreatingProfileWorkload}
                                    className="flex items-center gap-2"
                                  >
                                    {isCreatingProfileWorkload && (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    )}
                                    Create workload for managing the permission profile
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Deployment confirmation */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-800">
                            Important: Deploy permissions before continuing
                          </p>
                          <p className="text-sm text-amber-700 mt-1">
                            {isAwsOrgFlow
                              ? 'You must deploy the IAM role to the organization management account before proceeding. The next step validates those permissions.'
                              : 'You must deploy the IAM role to your AWS account using one of the methods above before proceeding to validation. The next step will verify that the permissions were successfully deployed.'}
                          </p>
                          <label className="flex items-center gap-2 mt-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={deploymentConfirmed}
                              onChange={(e) => setDeploymentConfirmed(e.target.checked)}
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                            <span className="text-sm font-medium text-amber-900">
                              {isAwsOrgFlow
                                ? 'I have deployed IAM permissions to the management account'
                                : 'I have deployed the IAM permissions to my AWS account'}
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {manualStep === 2 && (
                  <>
                    <ValidateAwsCredentials
                      authProfile={{ ...state.authProfile }}
                      roleName={state.authProfile.roleName}
                      accountId={state.accountId}
                      authType={authType}
                      onValidated={(result) => {
                        setValidationResult(result);
                        if (Array.isArray(result?.regionsUsed)) {
                          setSelectedRegions(result.regionsUsed);
                        }
                        if (result?.stackArn) {
                          setEditedStackArn(result.stackArn);
                        }
                      }}
                      setIsValidationSuccessful={(success) => {
                        setIsValidationSuccessful(success);
                      }}
                    />
                    {/* Regions summary and selection under validation message */}
                    {validationResult && (
                      <div className="mt-4 space-y-3">
                        <div>
                          <div className="text-gray-700 font-medium">Regions detected (last 3 months)</div>
                          <div className="flex flex-wrap gap-2 mt-1 text-xs">
                            {(validationResult?.regionsUsed || []).length > 0 ? (
                              validationResult.regionsUsed.map((r) => (
                                <span key={r} className="px-2 py-0.5 bg-gray-100 border rounded">
                                  {r}{validationResult?.spendDetails?.[r] !== undefined ? ` ($${Number(validationResult.spendDetails[r]).toFixed(2)})` : ''}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-500">No recent usage detected</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            These regions will be used as default AWS regions when checking configuration, deploying resources, and running reports.
                          </div>
                        </div>
                        <div className="max-w-xl">
                          <Label className="text-gray-600">Default AWS Regions</Label>
                          <div className="relative mt-2" ref={regionsDropdownRef}>
                            <button
                              type="button"
                              onClick={() => setRegionsDropdownOpen(!regionsDropdownOpen)}
                              className="w-full px-3 py-2 text-left border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                            >
                              <span
                                className={selectedRegions.length > 0 ? 'text-gray-900' : 'text-gray-500'}
                              >
                                {selectedRegions.length > 0
                                  ? `${selectedRegions.length} region(s) selected`
                                  : 'Select AWS regions...'}
                              </span>
                              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            </button>

                            {regionsDropdownOpen && (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                <div className="p-2">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700">Select Regions</span>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedRegions([])}
                                      className="text-xs text-red-600 hover:text-red-800"
                                    >
                                      Clear All
                                    </button>
                                  </div>
                                  <div className="space-y-1">
                                    {getRegionOptions().map((region) => (
                                      <label
                                        key={region.value}
                                        className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={selectedRegions.includes(region.value)}
                                          onChange={(e) => {
                                            const newRegions = e.target.checked
                                              ? [...selectedRegions, region.value]
                                              : selectedRegions.filter((r) => r !== region.value);
                                            setSelectedRegions(newRegions);
                                          }}
                                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                        />
                                        <span className="text-sm text-gray-700">{region.text}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-gray-600">CloudFormation Stack ARN (optional)</Label>
                          <Input
                            value={editedStackArn}
                            onChange={(e) => setEditedStackArn(e.target.value)}
                            placeholder={validationResult?.stackArn || 'arn:aws:cloudformation:...'}
                            className="bg-gray-50"
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex items-start justify-between border-t pt-4">
                      <div className="space-y-1">
                        <h3 className="font-medium text-gray-900">
                          {isAwsOrgFlow ? 'Save AWS Organization Profile' : 'Save Cloud Environment'}
                        </h3>
                       
                      </div>
                      <Switch
                        checked
                        disabled
                        className="bg-primary-600 data-[state=checked]:bg-primary-600"
                      />
                    </div>

                    {savePermissions && (
                      <>
                        <div className="space-y-3">
                          <Label className="text-gray-600">
                            {isAwsOrgFlow ? 'AWS Organization Name' : 'Cloud Environment Name'}
                          </Label>
                          
                          {!isAwsOrgFlow && (
                            <div className="grid grid-cols-4 gap-3">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                name="environmentType"
                                value="Production"
                                checked={!isEditing && presetName === 'Production'}
                                onChange={() => {
                                  setPresetName('Production');
                                  setPresetDescription('My production environment');
                                }}
                                className="text-primary-600 focus:ring-primary-500"
                              />
                              <span className="text-sm text-gray-700">Production</span>
                            </label>
                            
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                name="environmentType"
                                value="Development"
                                checked={!isEditing && presetName === 'Development'}
                                onChange={() => {
                                  setPresetName('Development');
                                  setPresetDescription('My development environment');
                                }}
                                className="text-primary-600 focus:ring-primary-500"
                              />
                              <span className="text-sm text-gray-700">Development</span>
                            </label>
                            
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                name="environmentType"
                                value="Sandbox"
                                checked={!isEditing && presetName === 'Sandbox'}
                                onChange={() => {
                                  setPresetName('Sandbox');
                                  setPresetDescription('My sandbox environment');
                                }}
                                className="text-primary-600 focus:ring-primary-500"
                              />
                              <span className="text-sm text-gray-700">Sandbox</span>
                            </label>
                            
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                name="environmentType"
                                value="Custom"
                                checked={isEditing || (presetName !== 'Production' && presetName !== 'Development' && presetName !== 'Sandbox')}
                                onChange={() => {
                                  if (!isEditing && (presetName === 'Production' || presetName === 'Development' || presetName === 'Sandbox')) {
                                    setPresetName('');
                                    setPresetDescription('');
                                  }
                                }}
                                className="text-primary-600 focus:ring-primary-500"
                              />
                              <span className="text-sm text-gray-700">Custom</span>
                            </label>
                            </div>
                          )}
                          
                          <Input
                            id="presetName"
                            value={presetName}
                            onChange={(e) => setPresetName(e.target.value)}
                            placeholder="Enter environment name"
                            className="bg-gray-50"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="description"
                            className="text-gray-600"
                          >
                            Description
                          </Label>
                          <Input
                            id="description"
                            value={presetDescription}
                            onChange={(e) =>
                              setPresetDescription(e.target.value)
                            }
                            placeholder="Description"
                            className="bg-gray-50"
                          />
                        </div>
                        
                      </>
                    )}
                  </>
                )}

                {isAwsOrgFlow && manualStep === 3 && (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h3 className="text-lg font-medium text-gray-900">
                        Deploy role to organization member accounts
                      </h3>
                      <p className="text-sm text-gray-600">
                        Deploy a CloudFormation StackSet that creates the same IAM role in each member account.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-gray-700">StackSet Name</Label>
                        <Input
                          value={orgStackSetName}
                          onChange={(e) => {
                            setOrgStackSetName(e.target.value);
                            setOrgStackSetStatus(null);
                          }}
                          placeholder="cloudagent-org-member-role"
                          className="bg-gray-50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-700">StackSet Region</Label>
                        <select
                          value={orgStackSetRegion}
                          onChange={(e) => {
                            setOrgStackSetRegion(e.target.value);
                            setOrgStackSetStatus(null);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none bg-gray-50"
                        >
                          {getRegionOptions().map((region) => (
                            <option key={region.value} value={region.value}>
                              {region.label || region.text || region.value}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* <div className="space-y-2">
                      <Label className="text-gray-700">
                        StackSet Operation ID (optional)
                      </Label>
                      <Input
                        value={orgStackSetOperationId}
                        onChange={(e) => setOrgStackSetOperationId(e.target.value)}
                        placeholder="operation-identifier"
                        className="bg-gray-50"
                      />
                    </div> */}

                    <Accordion type="single" collapsible className="rounded-lg border border-gray-200 bg-white">
                      <AccordionItem value="member-role-overrides" className="border-b-0">
                        <AccordionTrigger className="px-4 py-3 text-sm font-medium text-gray-900 hover:no-underline">
                          Customize member account IAM role and external ID (optional)
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 pt-0">
                          <p className="text-sm text-gray-600 mb-3">
                            Defaults are copied from Step 2. Update these only if member accounts should use a different IAM role configuration.
                          </p>
                          <div className="flex justify-end mb-3">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setOrgMemberRoleOverridesTouched(false);
                                setOrgMemberRoleName(
                                  String(state.authProfile?.roleName || 'CloudAgentAccess')
                                );
                                setOrgMemberExternalId(
                                  String(state.authProfile?.externalId || '')
                                );
                              }}
                            >
                              Use Step 2 Defaults
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label className="text-gray-700">Member Role Name</Label>
                              <Input
                                value={orgMemberRoleName}
                                onChange={(e) => {
                                  setOrgMemberRoleOverridesTouched(true);
                                  setOrgMemberRoleName(e.target.value);
                                }}
                                placeholder={state.authProfile.roleName || 'CloudAgentAccess'}
                                className="bg-gray-50"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-gray-700">Member External ID</Label>
                              <Input
                                value={orgMemberExternalId}
                                onChange={(e) => {
                                  setOrgMemberRoleOverridesTouched(true);
                                  setOrgMemberExternalId(e.target.value);
                                }}
                                placeholder={state.authProfile.externalId || 'external-id'}
                                className="bg-gray-50"
                              />
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    <div className="space-y-2">
                      <div className="rounded-lg border border-gray-200">
                        <div className="flex items-center p-3">
                          <input
                            type="radio"
                            value="stackset-template"
                            id="stackset-template"
                            checked={orgAccessType === 'stackset-template'}
                            onChange={() => setOrgAccessType('stackset-template')}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                          />
                          <div className="ml-3 flex-1">
                            <Label
                              htmlFor="stackset-template"
                              className="font-medium text-primary-600"
                            >
                              Launch StackSet Template
                            </Label>
                            <p className="text-sm text-gray-600 mt-1">
                              Launch a CloudFormation template that creates the StackSet with customizable root/OU deployment targets.
                            </p>
                          </div>
                        </div>
                        {orgAccessType === 'stackset-template' && (
                          <div className="border-t p-3 space-y-3 bg-gray-50">
                            <div className="flex flex-wrap gap-2">
                              <LaunchStack
                                cfTemplate={orgStackSetLaunchTemplateText}
                                isMissingRequiredConfiguration={false}
                                artifactTitle="cloudagent-org-stackset-launch-template"
                                label="Launch Template"
                                launchRegion={orgStackSetRegion}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  saveToFile(
                                    orgStackSetLaunchTemplateText,
                                    'cloudagent-org-stackset-launch-template.json'
                                  )
                                }
                              >
                                <FileDown className="mr-2 h-4 w-4" />
                                Save To File
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  copyTextToClipboard(
                                    orgStackSetLaunchTemplateText,
                                    'StackSet template'
                                  )
                                }
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Contents
                              </Button>
                            </div>
                            <div className="rounded border bg-white p-3">
                              <p className="text-xs text-gray-600 mb-2">
                                StackSet template preview
                              </p>
                              <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all text-gray-700 max-h-48">
                                {orgStackSetLaunchTemplateText}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg border border-gray-200">
                        <div className="flex items-center p-3">
                          <input
                            type="radio"
                            value="manual-stackset"
                            id="manual-stackset"
                            checked={orgAccessType === 'manual-stackset'}
                            onChange={() => setOrgAccessType('manual-stackset')}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                          />
                          <div className="ml-3 flex-1">
                            <Label
                              htmlFor="manual-stackset"
                              className="font-medium text-gray-700"
                            >
                              Manual StackSet Setup
                            </Label>
                            <p className="text-sm text-gray-600 mt-1">
                              Follow manual instructions and use a downloadable IAM role template for member accounts.
                            </p>
                          </div>
                        </div>
                        {orgAccessType === 'manual-stackset' && (
                          <div className="border-t p-3 bg-gray-50">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                saveToFile(
                                  orgMemberRoleTemplateText,
                                  'cloudagent-org-member-role-template.json'
                                )
                              }
                            >
                              <FileDown className="mr-2 h-4 w-4" />
                              Download IAM Role Template
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-2 border-primary-200 rounded-lg p-4 bg-primary-50 space-y-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">Deployment Status</h4>
                          <p className="text-xs font-medium text-primary-700 mt-1">
                            Required before continuing to Import
                          </p>
                          <p className="text-sm text-gray-600">
                            Check which organization accounts have the member role deployed.
                          </p>
                        </div>
                        <Button
                          size="default"
                          variant="default"
                          className="w-full md:w-auto"
                          disabled={isCheckingOrgStackSetStatus || !orgStackSetName.trim()}
                          onClick={checkAwsOrgStackSetStatus}
                        >
                          {isCheckingOrgStackSetStatus ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="mr-2 h-4 w-4" />
                          )}
                          Check StackSet Status
                        </Button>
                      </div>

                      {orgStackSetStatusError && (
                        <p className="text-sm text-red-600">{orgStackSetStatusError}</p>
                      )}

                      {orgStackSetStatus?.summary && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          <div className="rounded bg-white border p-3">
                            <div className="text-gray-500">Accounts discovered</div>
                            <div className="font-semibold text-gray-900">
                              {orgStackSetStatus.summary.accountCount || 0}
                            </div>
                          </div>
                          <div className="rounded bg-white border p-3">
                            <div className="text-gray-500">Role deployed</div>
                            <div className="font-semibold text-green-700">
                              {orgStackSetStatus.summary.deployedAccountCount || 0}
                            </div>
                          </div>
                          <div className="rounded bg-white border p-3">
                            <div className="text-gray-500">Deployment issues</div>
                            <div className="font-semibold text-amber-700">
                              {orgStackSetStatus.summary.failedAccountCount || 0}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-800">
                            Confirm StackSet deployment before importing accounts
                          </p>
                          <p className="text-sm text-amber-700 mt-1">
                            Continue only after the StackSet has finished deploying member account roles.
                          </p>
                          <label className="flex items-center gap-2 mt-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={orgDeploymentConfirmed}
                              onChange={(e) => setOrgDeploymentConfirmed(e.target.checked)}
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                            <span className="text-sm font-medium text-amber-900">
                              I have deployed the member account StackSet
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isAwsOrgFlow && manualStep === 4 && (
                  <div className="space-y-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          Import Organization Accounts
                        </h3>
                        <p className="text-sm text-gray-600">
                          Select member accounts to import as AWS account environments.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={loadAwsOrgAccounts}
                        disabled={orgAccountsLoading}
                      >
                        {orgAccountsLoading && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Refresh Accounts
                      </Button>
                    </div>

                    {orgAccountsError && (
                      <p className="text-sm text-red-600">{orgAccountsError}</p>
                    )}

                    {!orgAccountsLoading && importableOrgAccounts.length === 0 && (
                      <div className="rounded border border-dashed border-gray-300 p-4 text-sm text-gray-600">
                        No member accounts available to import. The organization management account is excluded from this list.
                      </div>
                    )}

                    {importableOrgAccounts.length > 0 && (
                      <>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setSelectedOrgAccountIds(importableOrgAccounts.map((a) => a.id))
                            }
                          >
                            Select All
                          </Button>
                          {deployedOrgAccountIds.size > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setSelectedOrgAccountIds(
                                  importableOrgAccounts
                                    .filter((account) => deployedOrgAccountIds.has(account.id))
                                    .map((account) => account.id)
                                )
                              }
                            >
                              Select Deployed Only
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedOrgAccountIds([])}
                          >
                            Clear
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            disabled={
                              isValidatingOrgAccounts ||
                              selectedOrgAccountIds.length === 0
                            }
                            onClick={async () => {
                              const selectedIds = selectedOrgAccountIds.filter(Boolean);
                              const result = await validateSelectedOrgAccounts(
                                selectedIds,
                                { force: true }
                              );
                              if (result?.allValid) {
                                toast.success(
                                  `Validated ${selectedIds.length} selected account${
                                    selectedIds.length === 1 ? '' : 's'
                                  }.`
                                );
                              } else {
                                const failedCount = Array.isArray(
                                  result?.failedAccountIds
                                )
                                  ? result.failedAccountIds.length
                                  : 0;
                                toast.error(
                                  `Validation failed for ${failedCount || 'one or more'} account${
                                    failedCount === 1 ? '' : 's'
                                  }.`
                                );
                              }
                            }}
                          >
                            {isValidatingOrgAccounts && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Validate Selected Accounts
                          </Button>
                        </div>

                        <div className="max-h-[300px] overflow-auto border rounded-lg">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                              <tr>
                                <th className="text-left p-2 w-10"> </th>
                                <th className="text-left p-2">Name</th>
                                <th className="text-left p-2">Account ID</th>
                                <th className="text-left p-2">Email</th>
                                <th className="text-left p-2">Role Status</th>
                                <th className="text-left p-2 min-w-[260px]">
                                  Validation (Regions)
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {importableOrgAccounts.map((account) => {
                                const selected = selectedOrgAccountIds.includes(account.id);
                                const roleDeployed = deployedOrgAccountIds.has(account.id);
                                const validation = orgAccountValidationById?.[account.id];
                                const regions = Array.isArray(validation?.regionsUsed)
                                  ? validation.regionsUsed
                                  : [];
                                return (
                                  <tr key={account.id} className="border-b last:border-b-0">
                                    <td className="p-2">
                                      <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={(e) => {
                                          const checked = e.target.checked;
                                          setSelectedOrgAccountIds((prev) =>
                                            checked
                                              ? Array.from(new Set([...(prev || []), account.id]))
                                              : (prev || []).filter((id) => id !== account.id)
                                          );
                                        }}
                                        className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                                      />
                                    </td>
                                    <td className="p-2 text-gray-900">{account.name || '—'}</td>
                                    <td className="p-2 font-mono text-xs text-gray-700">
                                      {account.id || '—'}
                                    </td>
                                    <td className="p-2 text-gray-700">{account.email || '—'}</td>
                                    <td className="p-2">
                                      <span
                                        className={
                                          roleDeployed
                                            ? 'text-green-700 bg-green-100 px-2 py-1 rounded text-xs'
                                            : 'text-amber-700 bg-amber-100 px-2 py-1 rounded text-xs'
                                        }
                                      >
                                        {roleDeployed ? 'Deployed' : 'Unknown / Not confirmed'}
                                      </span>
                                    </td>
                                    <td className="p-2 align-top">
                                      {validation?.status === 'loading' ? (
                                        <div className="inline-flex items-center text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
                                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                          Validating...
                                        </div>
                                      ) : validation?.status === 'success' ? (
                                        <div className="space-y-1">
                                          <div className="inline-flex items-center text-xs text-green-700 bg-green-100 px-2 py-1 rounded">
                                            <CheckCircle className="mr-1 h-3 w-3" />
                                            Validated
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                            {regions.length > 0 ? (
                                              regions.map((region) => (
                                                <span
                                                  key={`${account.id}-${region}`}
                                                  className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-mono"
                                                >
                                                  {region}
                                                </span>
                                              ))
                                            ) : (
                                              <span className="text-xs text-gray-500">
                                                No regions reported
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ) : validation?.status === 'error' ? (
                                        <div className="space-y-1">
                                          <div className="inline-flex items-center text-xs text-red-700 bg-red-100 px-2 py-1 rounded">
                                            <XCircle className="mr-1 h-3 w-3" />
                                            Validation failed
                                          </div>
                                          <div className="text-xs text-red-700 break-words">
                                            {validation?.message || 'Unable to validate credentials'}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-gray-500">
                                          Not validated yet
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="sticky bottom-0 bg-white pt-3">
              <div className="flex justify-between gap-4 border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() =>
                    manualStep > 0 ? setManualStep(manualStep - 1) : handleClose()
                  }
                  className="w-2/4"
                >
                  {manualStep > 0 ? 'Back' : 'Cancel'}
                </Button>
                <Button
                  onClick={() => {
                   
                    handleContinue();
                  }}
                  disabled={
                    (activeTab === 'manual' &&
                      manualStep === stepLabels.length - 1 &&
                      savePermissions &&
                      (!presetName || !presetDescription)) ||
                    buttonLoading ||
                    isImportingOrgAccounts ||
                    isValidatingOrgAccounts ||
                    (activeTab === 'saved' && !selectedPermission) ||
                    // Require deployment confirmation before proceeding from step 2 (Deploy)
                    (activeTab === 'manual' &&
                      manualStep === 1 &&
                      !deploymentConfirmed) ||
                    (activeTab === 'manual' &&
                      isAwsOrgFlow &&
                      manualStep === 2 &&
                      !isValidationSuccessful) ||
                    (activeTab === 'manual' &&
                      isAwsOrgFlow &&
                      manualStep === 3 &&
                      !orgDeploymentConfirmed) ||
                    (activeTab === 'manual' &&
                      isAwsOrgFlow &&
                      manualStep === stepLabels.length - 1 &&
                      selectedOrgAccountIds.length === 0) ||
                    // Allow saving without validation when editing
                    (authType === 'role' &&
                      activeTab !== 'saved' &&
                      manualStep === stepLabels.length - 1 &&
                      !isValidationSuccessful && !isEditing)
                  }
                  className="w-2/4"
                >
                  {buttonLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isImportingOrgAccounts && !buttonLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isValidatingOrgAccounts && !buttonLoading && !isImportingOrgAccounts && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {manualStep < stepLabels.length - 1 && activeTab !== 'saved'
                    ? `Continue to Step ${manualStep + 2}`
                    : activeTab === 'saved'
                      ? 'Confirm'
                      : isAwsOrgFlow
                        ? 'Import Selected Accounts'
                      : savePermissions && !isDashboard
                        ? 'Save and Use Permissions'
                        : isDashboard
                          ? 'Save'
                          : 'Use Permissions'}
                </Button>
              </div>
            </div>
            </div>
          </div>
          {activeTab === 'manual' && (
            <div className="w-[500px] bg-white border-l border-gray-200 p-6 ml-5 h-full overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Help</h2>
                <button
                  type="button"
                  onClick={() => setShowVideoModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary-600 text-white border border-primary-600 hover:bg-primary-700 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 transition-colors text-sm font-semibold"
                  title="Watch how-to video"
                  aria-label="Watch how-to video"
                >
                  <PlayCircle className="h-5 w-5 animate-pulse" />
                  <span className="hidden sm:inline">Watch how-to video</span>
                  <span className="sm:hidden">Watch video</span>
                </button>
              </div>

              <div className="space-y-6 text-sm">
                {manualStep === 0 && (
                  <>
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">
                        {isAwsOrgFlow
                          ? 'Finding Your Org Management Account ID'
                          : 'Finding Your AWS Account ID'}
                      </h3>
                      <p className="text-gray-600 mb-3">
                        Your AWS account ID is a 12 digit number.
                      </p>
                      <p className="text-gray-600 mb-3">
                        {isAwsOrgFlow
                          ? 'Use the AWS Organizations management account ID. In the AWS console, open the account menu at the top-right and copy the account ID.'
                          : 'You can find your AWS account ID by clicking on the top right menu in the AWS account and then copying the AWS Account ID at the top of the menu.'}
                      </p>
                      {isAwsOrgFlow && (
                        <p className="text-xs text-blue-700 mb-3 bg-blue-50 border border-blue-200 rounded p-2">
                          This management account is used to list organization accounts and check StackSet deployment status. Use this account (or a delegated StackSet administrator account) when creating and monitoring the member-account StackSet.
                        </p>
                      )}
                      <div className="bg-gray-100 p-2 rounded">
                        <img
                          src="/how-to-aws-account.png"
                          alt="AWS Account ID location"
                          className="w-full rounded border cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => {
                            setCurrentImage({
                              src: '/how-to-aws-account.png',
                              alt: 'AWS Account ID location',
                              title: 'AWS Account ID Location'
                            });
                            setShowImageModal(true);
                          }}
                          title="Click to view larger image"
                        />
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="text-[10px] uppercase tracking-wide text-blue-700 mb-1">Recommended</div>
                      <p className="text-sm text-blue-700 mb-4">Read-Only + Limited Write Access</p>

                      <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                        <div className="bg-white/70 rounded p-2">
                          <div className="font-medium text-blue-800 mb-1">CloudAgent can</div>
                          <ul className="text-blue-700 space-y-1">
                            <li>• Read all configuration</li>
                            <li>• Deploy via CloudFormation</li>
                            <li>• Create new resources</li>
                          </ul>
                        </div>
                        <div className="bg-white/70 rounded p-2">
                          <div className="font-medium text-blue-800 mb-1">CloudAgent can't</div>
                          <ul className="text-blue-700 space-y-1">
                            <li>• Modify existing resources</li>
                            <li>• Delete existing stacks</li>
                            <li>• <strong className="text-blue-800">No access to data</strong></li>
                          </ul>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 bg-blue-100 border border-blue-300 rounded p-2">
                        <div className="text-blue-700">🛡️</div>
                        <p className="text-xs text-blue-800">
                          CloudAgent only adds new infrastructure through controlled CloudFormation deployments. Existing resources and data remain protected.
                        </p>
                      </div>
                    </div>
                  </>
                )}
                
                {manualStep === 1 && (
                  <div>
                    {accessType === 'cloudformation' && (
                      <div>
                        <h3 className="font-medium text-gray-900 mb-3">
                          {isAwsOrgFlow
                            ? 'Deploy Management Account Role'
                            : 'Launch CloudFormation Template'}
                        </h3>
                        <div className="space-y-4 text-sm">
                          <div>
                            <h4 className="font-medium text-gray-800 mb-2">Step 1: Launch Template</h4>
                            <p className="text-gray-600 mb-2">
                              Click the <strong>"Launch Template"</strong> button. You'll see a loading indicator, and when ready, 
                              the button will change to <strong>"Click to Launch"</strong>.
                            </p>
                          </div>
                          
                          <div>
                            <h4 className="font-medium text-gray-800 mb-2">Step 2: AWS Console</h4>
                            <p className="text-gray-600 mb-2">
                              Clicking "Click to Launch" opens the AWS CloudFormation console. If you're not signed in, 
                              you'll be prompted to sign in first.
                            </p>
                            <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
                              <li>You can switch regions from the top menu if needed</li>
                              <li>Click "View Template" to see exactly what we're deploying</li>
                              <li>Scroll to the bottom and check "I acknowledge that AWS CloudFormation might create IAM resources"</li>
                              <li>Click <strong>"Create Stack"</strong></li>
                            </ul>
                            <div className="bg-gray-100 p-2 rounded mt-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => {
                              setCurrentImage({
                                src: '/how-to-create-stack.png',
                                alt: 'CloudFormation Create Stack',
                                title: 'CloudFormation Create Stack Process'
                              });
                              setShowImageModal(true);
                            }}>
                              <img
                                src="/how-to-create-stack.png"
                                alt="CloudFormation Create Stack"
                                className="w-full rounded border"
                                title="Click to view larger image"
                              />
                              <p className="text-xs text-gray-500 mt-1 text-center">CloudFormation Create Stack - Click to enlarge</p>
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="font-medium text-gray-800 mb-2">Step 3: Wait for Completion</h4>
                            <p className="text-gray-600 mb-2">
                              Wait for the stack to reach <strong>"CREATE_COMPLETE"</strong> status. This typically takes less than 1 minute.
                            </p>
                            <p className="text-gray-600 mb-2">
                              You can click the refresh button to check the status.
                            </p>
                            <div className="bg-gray-100 p-2 rounded cursor-pointer hover:opacity-80 transition-opacity" onClick={() => {
                              setCurrentImage({
                                src: '/how-to-create-stack-complete.png',
                                alt: 'CloudFormation Complete Status',
                                title: 'Stack Creation Complete Status'
                              });
                              setShowImageModal(true);
                            }}>
                              <img
                                src="/how-to-create-stack-complete.png"
                                alt="CloudFormation Complete Status"
                                className="w-full rounded border"
                                title="Click to view larger image"
                              />
                              <p className="text-xs text-gray-500 mt-1 text-center">Stack Creation Complete - Click to enlarge</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* {accessType === 'terraform' && (
                      <div>
                        <h3 className="font-medium text-gray-900 mb-3">
                          Download Terraform Template
                        </h3>
                        <div className="space-y-3 text-sm">
                          <p className="text-gray-600">
                            Click the "Download Terraform Template" button to download the .tf file, 
                            then deploy it using your preferred Terraform workflow.
                          </p>
                          <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800">
                            <strong>Note:</strong> Make sure you have Terraform installed and configured with your AWS credentials.
                          </div>
                        </div>
                      </div>
                    )} */}
                    
                    {accessType === 'download-cf' && (
                      <div>
                        <h3 className="font-medium text-gray-900 mb-3">
                          Download CloudFormation Template
                        </h3>
                        <div className="space-y-3 text-sm">
                          <p className="text-gray-600">
                            Click the "Download CloudFormation Template" button to download the JSON file, 
                            then deploy it using AWS CLI, console, or your preferred deployment method.
                          </p>
                          <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800">
                            <strong>Note:</strong> You can upload this template directly to the CloudFormation console 
                            or use AWS CLI with the downloaded file.
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {accessType === 'manual' && (
                      <div>
                        <h3 className="font-medium text-gray-900 mb-3">
                          Manual Setup Instructions
                        </h3>
                        <p className="text-gray-600 text-sm">
                          Follow the detailed step-by-step instructions below to manually create 
                          the IAM role in your AWS console.
                        </p>
                      </div>
                    )}
                    
                    {!accessType && (
                      <div>
                        <h3 className="font-medium text-gray-900 mb-2">
                          Deployment Methods
                        </h3>
                        <p className="text-gray-600 mb-3">
                          Choose how you'd like to deploy the IAM permissions to your AWS account.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                {manualStep === 2 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">
                      {isAwsOrgFlow
                        ? 'Validate Management Account Access'
                        : 'Validate & Save Permissions'}
                    </h3>
                    <div className="space-y-4 text-sm">
                      <div>
                        <h4 className="font-medium text-gray-800 mb-2">Step 1: Validate Permissions</h4>
                        <p className="text-gray-600 mb-2">
                          Click the <strong>"Validate"</strong> button to verify that your IAM role was deployed correctly and CloudAgent can access your AWS account.
                        </p>
                        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800">
                          <strong>Note:</strong> This step confirms the role exists and has the correct permissions before proceeding.
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-gray-800 mb-2">Step 2: Name Your Environment</h4>
                        <p className="text-gray-600 mb-2">
                          {isAwsOrgFlow
                            ? 'After validation, choose a name for this AWS Organization connection.'
                            : 'Once validation is successful, choose a name for your cloud environment from the dropdown (Production, Development, Sandbox) or select "Custom" to enter your own name.'}
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-gray-800 mb-2">Step 3: Save Configuration</h4>
                        <p className="text-gray-600 mb-2">
                          {isAwsOrgFlow
                            ? 'Continue to deploy the member-account StackSet in the next step.'
                            : 'Click <strong>"Save and Use Permissions"</strong> to complete the setup. Your environment will be ready to use with CloudAgent.'}
                        </p>
                       
                      </div>
                    </div>
                  </div>
                )}

                {isAwsOrgFlow && manualStep === 3 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">
                      Deploy Member Account StackSet
                    </h3>
                    <div className="space-y-3 text-sm">
                      <p className="text-gray-600">
                        Use this StackSet name for deployment and validation:
                        {' '}
                        <span className="font-semibold bg-yellow-100 px-1 rounded">
                          {orgStackSetName || 'cloudagent-org-member-role'}
                        </span>
                      </p>
                      <p className="text-gray-600">
                        <strong>Launch Template</strong> creates a top-level CloudFormation stack that provisions the StackSet resource directly. You can launch it in one click, or use <strong>Save To File</strong> / <strong>Copy Contents</strong> to deploy that same template manually in CloudFormation.
                      </p>
                      <p className="text-gray-600">
                        <strong>Manual StackSet Setup</strong> gives you the member-account IAM role template file. In CloudFormation StackSets, upload that template and create the StackSet yourself. Use the exact StackSet name shown above so <strong>Check Status</strong> can validate the correct deployment.
                      </p>
                    </div>
                  </div>
                )}

                {isAwsOrgFlow && manualStep === 4 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">
                      Import Accounts
                    </h3>
                    <div className="space-y-3 text-sm text-gray-600">
                      <p>
                        Select member accounts to import. Each imported account will be saved as
                        an <strong>AWS Account</strong> permission profile.
                      </p>
                      <p>
                        CloudAgent uses the role name and external ID from this flow for each
                        imported account profile.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {accessType === 'manual' && manualStep === 1 && (
                <div className="mt-4">
                  <ScrollArea className="h-[60vh] pr-4">
                    <div className="space-y-4 text-sm">
                      <ol className="list-decimal space-y-4 pl-8 text-gray-600">
                        <li>Log in to the IAM console</li>

                        <li>
                          Click on Roles, then{' '}
                          <span className="font-semibold">Create Role</span>
                        </li>

                        <li>
                          Select{' '}
                          <span className="font-semibold">
                            Another AWS Account{' '}
                          </span>
                          under the type of trusted entity
                        </li>

                        <li>
                          Enter{' '}
                          <span className="font-semibold">
                            {SCAN_ENGINE_AWS_ACCOUNT_IDS.join(', ')}{' '}
                          </span>
                          for the Account ID{SCAN_ENGINE_AWS_ACCOUNT_IDS.length > 1 ? 's' : ''}
                        </li>

                        <li>
                          Enable{' '}
                          <span className="font-semibold">
                            Require external ID{' '}
                          </span>
                          option, and enter{' '}
                          <span className="font-semibold bg-yellow-100 px-1 rounded">
                            {state.authProfile.externalId || 'your external ID'}
                          </span>
                        </li>

                        <li>
                          Click <span className="font-semibold">Next</span>
                        </li>

                        <li>
                          Follow one of the following two options:
                          <ol className="list-[lower-alpha] pl-6 pt-2 space-y-2">
                            <li>
                              Click{' '}
                              <span className="font-semibold">
                                Create Policy,{' '}
                              </span>
                              select{' '}
                              <span className="font-semibold">JSON </span>
                              and paste the contents from{' '}
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  setPermissionsModalMode('manual');
                                  setShowPermissionsModal(true);
                                }}
                                className="font-semibold text-primary-600 underline hover:text-primary-800"
                              >
                                View generated IAM policy JSON
                              </button>{' '}
                              (after selecting the type of access you would like
                              to grant)
                            </li>
                            <li>
                              Select a predefined managed policy that provides
                              the access that you would like to grant. (For
                              example,{' '}
                              <span className="font-semibold">
                                ReadOnlyAccess
                              </span>
                              )
                            </li>
                          </ol>
                        </li>

                        <li>
                          Click <span className="font-semibold">Next</span>{' '}
                          twice
                        </li>

                        <li>
                          In the final page, enter{' '}
                          <span className="font-semibold bg-yellow-100 px-1 rounded">
                            {state.authProfile.roleName || 'your role name'}
                          </span>{' '}
                          as the Role name and click{' '}
                          <span className="font-semibold">Create</span>
                        </li>
                      </ol>

                      <p className="pt-4">
                        Once the role is created with the role name{' '}
                        <span className="font-semibold bg-yellow-100 px-1 rounded">
                          {state.authProfile.roleName || 'your role name'}
                        </span>{' '}
                        and external ID{' '}
                        <span className="font-semibold bg-yellow-100 px-1 rounded">
                          {state.authProfile.externalId || 'your external ID'}
                        </span>
                        , you can proceed to the next step to validate your credentials.
                      </p>

                      <div className="pt-2">
                        <span className="text-gray-600">
                          Additional Resource:{' '}
                        </span>
                        <a
                          href="https://docs.aws.amazon.com/IAM/latest/UserGuide/tutorial_cross-account-with-roles.html#tutorial_cross-account-with-roles-1"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-800 underline"
                        >
                          AWS Documentation - Delegate Access Across AWS
                          Accounts Using IAM Roles
                        </a>
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              )}
              {isAwsOrgFlow &&
                orgAccessType === 'manual-stackset' &&
                manualStep === 3 && (
                  <div className="mt-4">
                    <ScrollArea className="h-[40vh] pr-4">
                      <div className="space-y-4 text-sm text-gray-600">
                        <ol className="list-decimal space-y-3 pl-6">
                          <li>Download the CloudFormation template.</li>
                          <li>
                            Open the AWS CloudFormation console at{' '}
                            <a
                              href="https://console.aws.amazon.com/cloudformation"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 underline"
                            >
                              https://console.aws.amazon.com/cloudformation
                            </a>{' '}
                            in the management account of the organization (or delegated StackSet administrator account).
                          </li>
                          <li>From the navigation pane, choose StackSets.</li>
                          <li>At the top of the StackSets page, choose Create StackSet.</li>
                          <li>
                            Under Specify Template, select Upload a Template File, and upload the template file. Click Next.
                          </li>
                          <li>
                            On the Specify StackSet details page, provide a name and description for the StackSet, then click Next.
                          </li>
                          <li>
                            Use this StackSet name exactly:
                            {' '}
                            <span className="font-semibold bg-yellow-100 px-1 rounded">
                              {orgStackSetName || 'cloudagent-org-member-role'}
                            </span>
                            . This is the same name used by the deployment status check.
                          </li>
                          <li>
                            On the Configure StackSet Options page, select the appropriate Permissions type.
                          </li>
                          <li>
                            Service-Managed Permissions uses the AWS Organizations trusted role access to provision the StackSet.
                          </li>
                          <li>
                            If you select Self-Service Permissions, enter the appropriate IAM execution role name to be used.
                          </li>
                          <li>On the Set Deployment Options page, select the following options:</li>
                          <li>
                            Accounts to deploy the StackSet (The whole Organization, specific OUs, or specific Accounts).
                          </li>
                          <li>
                            (Service-Managed Permissions Only) Select Automatic Deployment setting to automatically deploy to newly created accounts.
                          </li>
                          <li>
                            (Service-Managed Permissions Only) Select Account Removal Behavior to specify the action when an AWS account is removed from an OU.
                          </li>
                          <li>
                            Specify Regions to deploy this stack (Important: Select only one region).
                          </li>
                          <li>Click Next.</li>
                          <li>On the Review page, review your settings one more time and then click Submit.</li>
                        </ol>
                      </div>
                    </ScrollArea>
                  </div>
                )}
            </div>
          )}
        </div>
      </DialogContent>

      {/* Required Permissions Modal */}
      <Dialog
        open={showPermissionsModal}
        onOpenChange={(open) => setShowPermissionsModal(open)}
      >
        <DialogContent className="max-w-2xl bg-white p-6 rounded-lg shadow-lg max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {permissionsModalMode === 'manual'
                ? 'Generated IAM Policy JSON'
                : 'Required Permissions'}
            </DialogTitle>
          </DialogHeader>
          {permissionsModalMode === 'manual' &&
            manualIamPolicyDetails.managedPolicyArns.length > 0 && (
              <div className="mb-4 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
                Also attach these AWS managed policies to the role:{' '}
                <span className="font-mono text-xs">
                  {manualIamPolicyDetails.managedPolicyArns.join(', ')}
                </span>
              </div>
            )}
          <ScrollArea className="max-h-[52vh] rounded-md border bg-gray-50 p-3">
            <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap">
              {JSON.stringify(
                permissionsModalMode === 'manual'
                  ? manualIamPolicyDetails.policyDocument
                  : requiredPermissions?.policy || {},
                null,
                2
              )}
            </pre>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setShowPermissionsModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Validation Summary Modal */}
      <Dialog open={isValidationSummaryOpen} onOpenChange={handleValidationSummaryOpenChange}>
        {validationSummary && (
          <DialogContent className="max-w-lg bg-white max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {isValidationLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                ) : isValidationSuccess ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                <span>Permissions Validation</span>
              </DialogTitle>
              <DialogDescription
                className={cn(
                  'text-sm',
                  isValidationLoading
                    ? 'text-blue-600'
                    : isValidationSuccess
                      ? 'text-green-600'
                      : 'text-red-600'
                )}
              >
                {isValidationLoading
                  ? 'Validating permissions. This may take 1-2 minutes to complete.'
                  : isValidationSuccess
                    ? 'Permissions are there. You can proceed.'
                    : "Permissions aren't there yet. Review the details below."}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-2">
              <div className="space-y-6 pr-2">
                {isValidationLoading && (
                  <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                      Reviewing Permission Profile
                    </div>
                    <div className="mt-2 space-y-2">
                      {validationToolEvents.length === 0 ? (
                        <p className="text-xs text-blue-600">
                          Waiting for the agent to start tool calls...
                        </p>
                      ) : (
                      <>
                        {validationToolEvents.map((event) => {
                          const friendlyName = formatToolName(event.rawName || event.name);
                          if (!friendlyName) {
                            return null;
                          }

                          const statusText = formatStatusLabel(
                            event.status,
                            event.isErrored
                              ? 'Failed'
                              : event.isCompleted
                                ? 'Completed'
                                : 'In progress'
                          );
                          const statusClass = cn(
                            'text-xs font-medium',
                            event.isErrored
                              ? 'text-red-600'
                              : event.isCompleted
                                ? 'text-green-600'
                                : 'text-blue-600'
                          );
                          const inputText = formatValueForDisplay(event.input);
                          const outputText = formatValueForDisplay(
                            event.output ?? event.content ?? event.message
                          );
                          const errorText = formatValueForDisplay(event.error);
                          const showInput = inputText && inputText.trim().length > 0;
                          const showOutput = outputText && outputText.trim().length > 0;
                          const showError = errorText && errorText.trim().length > 0;

                          return (
                            <div
                              key={event.id}
                              className="flex gap-2 rounded-md border border-blue-100 bg-white/80 p-2"
                            >
                              <div className="mt-0.5">
                                {event.isErrored ? (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                ) : event.isCompleted ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                )}
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-sm font-medium text-gray-900">
                                    {friendlyName}
                                  </div>
                                  <div className={statusClass}>{statusText}</div>
                                </div>
                                {showError && (
                                  <p className="text-xs text-red-600">{errorText}</p>
                                )}
                                {showInput && (
                                  <details className="group">
                                    <summary className="cursor-pointer text-[11px] font-medium text-gray-600 hover:text-gray-800">
                                      View input
                                    </summary>
                                    <pre className="mt-1 whitespace-pre-wrap rounded bg-white p-2 text-[11px] text-gray-700 shadow-inner">
                                      {inputText}
                                    </pre>
                                  </details>
                                )}
                                {showOutput && (
                                  <details className="group">
                                    <summary className="cursor-pointer text-[11px] font-medium text-gray-600 hover:text-gray-800">
                                      View output
                                    </summary>
                                    <pre className="mt-1 whitespace-pre-wrap rounded bg-white p-2 text-[11px] text-gray-700 shadow-inner">
                                      {outputText}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <div ref={liveActionsEndRef} />
                      </>
                      )}
                    </div>
                  </div>
                )}
                {hasValidationSummaryDetails && (
                  <details className="bg-gray-50 rounded-md p-3">
                    <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                      More details
                    </summary>
                    <div className="mt-2 space-y-3 text-sm text-gray-700">
                      {validationSummary.message && (
                        <div>
                          <div className="font-medium text-gray-800">Message</div>
                          <p className="mt-1 whitespace-pre-wrap text-gray-700">
                            {validationSummary.message}
                          </p>
                        </div>
                      )}
                      {validationSummary.reason && (
                        <div>
                          <div className="font-medium text-gray-800">Reason</div>
                          <p className="mt-1 whitespace-pre-wrap text-gray-700">
                            {validationSummary.reason}
                          </p>
                        </div>
                      )}
                      {validationSummary.permissionsValid === false &&
                        validationSummary.missingPermissions.length > 0 && (
                          <div>
                            <div className="font-medium text-gray-800">
                              Missing Permissions
                            </div>
                            <ul className="mt-1 list-disc pl-5 space-y-1 text-gray-700">
                              {validationSummary.missingPermissions.map((perm) => (
                                <li key={perm}>{perm}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </div>
                  </details>
                )}

                {isValidationFailure && (
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">
                          Update Permissions
                        </h4>
                        <p className="text-xs text-gray-600">
                          Update Permission Profile with the required permissions for this blueprint.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowUpdatePermissionsDetails((prev) => !prev)}
                        className="flex items-center justify-center h-8 w-8 rounded-full text-primary-600 hover:text-primary-700 transition-colors"
                      >
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 transition-transform',
                            showUpdatePermissionsDetails ? 'rotate-180' : 'rotate-0'
                          )}
                        />
                      </button>
                    </div>

                    {showUpdatePermissionsDetails && (
                      <div className="mt-4 space-y-4">
                        <div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPermissionsModalMode('required');
                              setShowPermissionsModal(true);
                            }}
                          >
                            Show permissions
                          </Button>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="text-sm font-medium text-gray-900">
                                Temporary Access
                              </h5>
                              <p className="text-xs text-gray-600">
                                Limit these permissions to a short time period.
                              </p>
                            </div>
                            <Switch
                              checked={temporaryAccess}
                              onCheckedChange={setTemporaryAccess}
                              className="bg-primary-600 data-[state=checked]:bg-primary-600"
                            />
                          </div>

                          {temporaryAccess && (
                            <div className="space-y-2">
                              <Label
                                htmlFor="update-time-selection"
                                className="text-sm font-medium text-gray-700"
                              >
                                Select time
                              </Label>
                              <div className="relative">
                                <select
                                  id="update-time-selection"
                                  value={selectedTime}
                                  onChange={(e) => setSelectedTime(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none bg-white"
                                >
                                  <option value={1}>1 hour</option>
                                  <option value={2}>2 hours</option>
                                  <option value={4}>4 hours</option>
                                  <option value={8}>8 hours</option>
                                  <option value={12}>12 hours</option>
                                  <option value={24}>1 day</option>
                                  <option value={72}>3 days</option>
                                  <option value={168}>7 days</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                              </div>
                            </div>
                          )}
                        </div>

                        <Button
                          variant="default"
                          className="w-full"
                          onClick={handleUpdatePermissions}
                          disabled={isUpdatingPermissions}
                        >
                          {isUpdatingPermissions && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Update Permission Profile
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
            <DialogFooter className="mt-6 flex w-full items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {!isValidationLoading && (
                  <Button
                    variant="outline"
                    onClick={handleRetryValidation}
                    disabled={isValidatingSaved}
                    className="flex items-center gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Retry
                  </Button>
                )}
              </div>
              <Button
                onClick={() => handleValidationSummaryOpenChange(false)}
                disabled={isValidationLoading}
                variant="outline"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Update Permissions Progress Modal */}
      <Dialog open={isUpdateProgressOpen} onOpenChange={handleUpdateProgressOpenChange}>
        <DialogContent className="max-w-lg bg-white max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isUpdateLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              ) : isUpdateSuccess ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <span>Updating Permissions</span>
            </DialogTitle>
            <DialogDescription
              className={cn(
                'text-sm',
                isUpdateLoading
                  ? 'text-blue-600'
                  : isUpdateSuccess
                    ? 'text-green-600'
                    : 'text-red-600'
              )}
            >
              {isUpdateLoading
                ? updateSummary.message || 'Applying required permissions. This may take a moment.'
                : updateSummary.message ||
                  (isUpdateSuccess
                    ? 'Permissions update requested.'
                    : 'Permissions update failed. Review the details below.')}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-6 pr-2">
              <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Updating Permission Profile
                </div>
                <div className="mt-2 space-y-2">
                  {updateToolEvents.length === 0 ? (
                    <p className="text-xs text-blue-600">
                      {isUpdateLoading
                        ? 'Waiting for the agent to start tool calls...'
                        : 'No tool activity reported.'}
                    </p>
                  ) : (
                    <>
                      {updateToolEvents.map((event) => {
                        const friendlyName = formatToolName(event.rawName || event.name);
                        if (!friendlyName) {
                          return null;
                        }

                        const statusText = formatStatusLabel(
                          event.status,
                          event.isErrored
                            ? 'Failed'
                            : event.isCompleted
                              ? 'Completed'
                              : 'In progress'
                        );
                        const statusClass = cn(
                          'text-xs font-medium',
                          event.isErrored
                            ? 'text-red-600'
                            : event.isCompleted
                              ? 'text-green-600'
                              : 'text-blue-600'
                        );
                        const inputText = formatValueForDisplay(event.input);
                        const outputText = formatValueForDisplay(
                          event.output ?? event.content ?? event.message
                        );
                        const errorText = formatValueForDisplay(event.error);
                        const showInput = inputText && inputText.trim().length > 0;
                        const showOutput = outputText && outputText.trim().length > 0;
                        const showError = errorText && errorText.trim().length > 0;

                        return (
                          <div
                            key={event.id}
                            className="flex gap-2 rounded-md border border-blue-100 bg-white/80 p-2"
                          >
                            <div className="mt-0.5">
                              {event.isErrored ? (
                                <XCircle className="h-4 w-4 text-red-500" />
                              ) : event.isCompleted ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                              )}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-sm font-medium text-gray-900">
                                  {friendlyName}
                                </div>
                                <div className={statusClass}>{statusText}</div>
                              </div>
                              {showError && (
                                <p className="text-xs text-red-600">{errorText}</p>
                              )}
                              {showInput && (
                                <details className="group">
                                  <summary className="cursor-pointer text-[11px] font-medium text-gray-600 hover:text-gray-800">
                                    View input
                                  </summary>
                                  <pre className="mt-1 whitespace-pre-wrap rounded bg-white p-2 text-[11px] text-gray-700 shadow-inner">
                                    {inputText}
                                  </pre>
                                </details>
                              )}
                              {showOutput && (
                                <details className="group">
                                  <summary className="cursor-pointer text-[11px] font-medium text-gray-600 hover:text-gray-800">
                                    View output
                                  </summary>
                                  <pre className="mt-1 whitespace-pre-wrap rounded bg-white p-2 text-[11px] text-gray-700 shadow-inner">
                                    {outputText}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={updateActionsEndRef} />
                    </>
                  )}
                </div>
              </div>

              {updateSummary.reason && (
                <details className="bg-gray-50 rounded-md p-3">
                  <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                    Update details
                  </summary>
                  <div className="mt-2 space-y-3 text-sm text-gray-700">
                    <div>
                      <div className="font-medium text-gray-800">Reason</div>
                      <p className="mt-1 whitespace-pre-wrap text-gray-700">
                        {updateSummary.reason}
                      </p>
                    </div>
                    {updateSummary.details && (
                      <div>
                        <div className="font-medium text-gray-800">Details</div>
                        <pre className="mt-1 whitespace-pre-wrap rounded bg-white p-2 text-[11px] text-gray-700 shadow-inner">
                          {formatValueForDisplay(updateSummary.details)}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4 flex w-full items-center justify-end gap-2">
            <Button
              onClick={() => handleUpdateProgressOpenChange(false)}
              disabled={isUpdateLoading}
              variant="outline"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Modal */}
      <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
        <DialogContent className="max-w-4xl bg-white p-0">
          <video
            src="/how-to-create-aws-environment.mp4"
            controls
            autoPlay
            className="w-full h-auto rounded"
          />
        </DialogContent>
      </Dialog>

      {/* Image Modal */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-4xl bg-white p-6">
          <DialogHeader>
            <DialogTitle>{currentImage.title}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            <img
              src={currentImage.src}
              alt={`${currentImage.alt} - enlarged view`}
              className="max-w-full h-auto rounded border shadow-lg"
            />
          </div>
          <div className="mt-4 text-sm text-gray-600">
            {currentImage.src === '/how-to-aws-account.png' && (
              <p>
                You can find your AWS account ID by clicking on the top right menu in the AWS console 
                and then copying the AWS Account ID at the top of the menu.
              </p>
            )}
            {currentImage.src === '/how-to-create-stack.png' && (
              <p>
                This shows the CloudFormation console where you can review the template, 
                acknowledge IAM resource creation, and click "Create Stack" to deploy.
              </p>
            )}
            {currentImage.src === '/how-to-create-stack-complete.png' && (
              <p>
                Wait for the stack status to show "CREATE_COMPLETE". You can refresh the page 
                to check the current status. This process typically takes less than 1 minute.
              </p>
            )}
            {currentImage.src === '/validation-success.png' && (
              <p>
                This shows the successful validation result. Once you see the green checkmark and success message, 
                you can proceed to name your environment and save the configuration.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

const ValidateAwsCredentials = ({
  accountId,
  roleName,
  authProfile,
  authType,
  onValidated,
  setIsValidationSuccessful,
}) => {
  const [state, setState] = useState({
    isLoading: false,
    receivedResponse: false,
    code: 0,
    message: '',
    regionsUsed: [],
    stack: null,
  });

  const validateCredsCall = async () => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      receivedResponse: false,
    }));

    try {
      const payload = {
        authProfile: {
          authType: (authType === 'role' ? 'assumeRole' : 'credentials'),
          accountId,
          roleName,
          externalId: authProfile?.externalId,
          accessKeyId: authProfile?.accessKeyId,
          secretAccessKey: authProfile?.secretAccessKey,
          sessionToken: authProfile?.sessionToken,
        },
      };

      const response = await validateAwsCredentialsV2(payload);

      const success = response?.code === 200 && response?.role?.exists === true;
      setState({
        isLoading: false,
        receivedResponse: true,
        code: response?.code || 0,
        message: success
          ? 'Validation successful'
          : (response?.message || 'Validation failed'),
        regionsUsed: response?.regionsUsed || [],
        stack: response?.stack || null,
      });
      if (typeof onValidated === 'function') onValidated(response);
      if (setIsValidationSuccessful) setIsValidationSuccessful(!!success);
    } catch (err) {
      setState({
        isLoading: false,
        receivedResponse: true,
        code: 500,
        message: 'Validation failed',
        regionsUsed: [],
        stack: null,
      });
      if (setIsValidationSuccessful) setIsValidationSuccessful(false);
    }
  };

  const getAlertVariant = () => {
    if (!state.receivedResponse) return 'default';
    return state.code === 200 ? 'success' : 'destructive';
  };

  const getIcon = () => {
    if (!state.receivedResponse) return <AlertCircle className="h-5 w-5" />;
    if (state.code === 200)
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    return <XCircle className="h-5 w-5 text-red-600" />;
  };

  

  return (
    <Alert variant={getAlertVariant()} className="mb-4 bg-primary-50">
      <div className="flex items-start gap-4">
        <div className="mt-1">{getIcon()}</div>

        <div className="flex-1">
          <AlertTitle className="flex items-center justify-between mb-0 ">
            <span>
              {state.receivedResponse
                ? state.message
                : 'Validate that credentials were properly deployed'}
            </span>

            <Button
              variant="default"
              size="sm"
              onClick={validateCredsCall}
              disabled={state.isLoading}
              className="ml-4"
            >
              {state.isLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Validate
            </Button>
          </AlertTitle>

          {state.receivedResponse && state.code !== 200 && (
            <AlertDescription className="text-red-600">
              <div className="font-medium">Validation error</div>
              <div className="mt-1 break-words">
                {state.message || 'Validation failed'}
              </div>
              <div className="mt-2 text-red-700">
                Make sure that the IAM role was successfully deployed to the AWS account
                and the IAM role name and external id match the above settings.
              </div>
            </AlertDescription>
          )}

          {state.receivedResponse && state.code === 200 && (
            <div className="mt-3 text-sm text-green-700">Validation successful.</div>
          )}
        </div>
      </div>
    </Alert>
  );
};
