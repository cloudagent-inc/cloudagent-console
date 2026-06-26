import { createSecurityRulesStructure } from '@/components/SecurityCompliance/securityRulesUtils';
import { filterCloudEnvironments } from '@/helpers/shared';
import { updateSingleWorkloadInUserProfile } from '@/features/auth/authSlice';
import { launchHealthScans } from '@/features/health/healthSlice';
import {
  getPermissionProfileAwsAccountId,
  getPermissionProfileId,
} from '@/features/workload/workloadEnvironmentUtils';

export const buildDefaultDeploymentPreferences = () => ({
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
  sourceMode: 'none',
  gitRepo: null,
  deliveryMethod: null,
  stateSource: null,
  stateBucket: '',
  pipelineConfig: {
    autoDeploy: true,
    requireApproval: false,
    branch: '',
  },
  accessMode: 'managed',
  architecturePreferences: {
    instanceSize: 'No Preference',
    databasePreference: 'No Preference',
    nosqlPreference: 'No Preference',
    staticWebsite: 'No Preference',
    dynamicWebsite: 'No Preference',
  },
});

export const buildDefaultTrackedResources = () => ({
  resources: [],
  stacks: [],
});

export const normalizeTrackedResources = (trackedResources) => {
  if (!trackedResources) {
    return buildDefaultTrackedResources();
  }
  if (trackedResources.resources || trackedResources.stacks) {
    return {
      resources: Array.isArray(trackedResources.resources) ? trackedResources.resources : [],
      stacks: Array.isArray(trackedResources.stacks) ? trackedResources.stacks : [],
    };
  }
  if (Array.isArray(trackedResources)) {
    return {
      resources: trackedResources,
      stacks: [],
    };
  }
  return buildDefaultTrackedResources();
};

export const getDefaultRegionsForProfile = (profileId, profiles = []) => {
  if (!profileId) return ['us-east-1'];
  const profile = profiles.find((item) => item?.recordId === profileId || item?.id === profileId);
  if (!profile) return ['us-east-1'];
  try {
    const deploymentPreferences =
      typeof profile.deploymentPreferences === 'string'
        ? JSON.parse(profile.deploymentPreferences)
        : profile.deploymentPreferences || {};
    const defaultRegions = deploymentPreferences.defaultRegions;
    if (Array.isArray(defaultRegions) && defaultRegions.length > 0) {
      return defaultRegions.filter(Boolean);
    }
  } catch (_) {
    return ['us-east-1'];
  }
  return ['us-east-1'];
};

export const buildInitialWorkloadFormData = () => ({
  workloadName: '',
  description: '',
  environments: [],
  deploymentPreferences: buildDefaultDeploymentPreferences(),
  trackedResources: buildDefaultTrackedResources(),
  securityRules: createSecurityRulesStructure(),
});

export const buildDiscoveredWorkloadCreatePayload = ({
  userProfile,
  workload,
  permissionProfileId = '',
}) => {
  const permissionProfiles = filterCloudEnvironments(userProfile?.agentPermissionProfiles || []);
  const resolvedPermissionProfileId = permissionProfileId
    ? String(permissionProfileId).trim()
    : '';
  const defaultRegions = getDefaultRegionsForProfile(
    resolvedPermissionProfileId,
    permissionProfiles
  );
  const selectedProfile = permissionProfiles.find(
    (profile) => getPermissionProfileId(profile) === resolvedPermissionProfileId
  );
  const selectedAccountId = getPermissionProfileAwsAccountId(selectedProfile);

  return {
    ...buildInitialWorkloadFormData(),
    workloadName: workload?.name || workload?.workloadName || '',
    description: workload?.description || '',
    environments: resolvedPermissionProfileId ? [resolvedPermissionProfileId] : [],
    deploymentPreferences: {
      ...buildDefaultDeploymentPreferences(),
      defaultRegions,
      pipelineConfig: {
        autoDeploy: true,
        requireApproval: false,
        branch: '',
        ...(selectedAccountId ? { awsAccountId: selectedAccountId } : {}),
      },
    },
    trackedResources: normalizeTrackedResources(workload?.trackedResources),
  };
};

const normalizeErrorMessage = (error, fallbackMessage) => {
  if (!error) return fallbackMessage;
  if (typeof error === 'string') return error;
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }
  return fallbackMessage;
};

export const runPostCreateWorkloadSync = async ({ dispatch, workloads }) => {
  const createdWorkloads = (Array.isArray(workloads) ? workloads : [workloads]).filter(
    (workload) => workload?.workloadId
  );

  createdWorkloads.forEach((workload) => {
    dispatch(updateSingleWorkloadInUserProfile(workload));
  });

  const batchHealthResult = createdWorkloads.length
    ? await Promise.allSettled([
        dispatch(
          launchHealthScans({
            targets: createdWorkloads.map((workload) => ({
              workloadId: workload.workloadId,
            })),
            forceRefresh: true,
          })
        ).unwrap(),
      ])
    : [];

  const resolvedHealthSettled = createdWorkloads.map(() => batchHealthResult[0]);

  return {
    healthResults: resolvedHealthSettled.map((result, index) => ({
      workloadId: createdWorkloads[index]?.workloadId || '',
      success: result.status === 'fulfilled',
      error:
        result.status === 'rejected'
          ? normalizeErrorMessage(result.reason, 'Failed to start workload health')
          : null,
    })),
    summaryResults: [],
    recommendationsRefreshError: null,
    recommendationsLoadError: null,
  };
};
