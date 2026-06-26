import { createSlice } from '@reduxjs/toolkit';

const normalizeTrackedResources = (trackedResources) => {
  if (!trackedResources) {
    return { resources: [], stacks: [] };
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
  return { resources: [], stacks: [] };
};

const getWorkloadEnvironmentProfileId = (workload) => {
  if (!workload || typeof workload !== 'object') return '';
  const metadata =
    workload.metadata && typeof workload.metadata === 'object' ? workload.metadata : {};
  return (metadata.environmentProfileId || '').trim();
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
          cloudProvider: environmentMeta.cloudProvider || 'aws',
          subscriptionId: environmentMeta.subscriptionId || undefined,
          permissionProfileId: environmentMeta.permissionProfileId || environmentMeta.profileId,
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
    permissionProfileId: environmentMeta.permissionProfileId || environmentMeta.profileId,
    subscriptionId: environmentMeta.subscriptionId || null,
    cloudProvider: environmentMeta.cloudProvider || 'aws',
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

const initialState = {
  activeRun: null,
};

const workloadDiscoverySlice = createSlice({
  name: 'workloadDiscovery',
  initialState,
  reducers: {
    startBackgroundDiscovery: (state, action) => {
      const payload = action.payload || {};
      state.activeRun = {
        jobId: payload.jobId,
        executionState: 'queued',
        reviewPending: false,
        startedAt: payload.startedAt || new Date().toISOString(),
        completedAt: null,
        error: null,
        failedCount: 0,
        selectedPermissionProfileIds: payload.selectedPermissionProfileIds || [],
        selectedServices: payload.selectedServices || [],
        selectedRegions: payload.selectedRegions || [],
        environmentNotes: payload.environmentNotes || '',
        forceInventoryScan: Boolean(payload.forceInventoryScan),
        environments: Array.isArray(payload.environments) ? payload.environments : [],
        sessionIdsByEnvironment: {},
        environmentRuns: payload.environmentRuns || {},
        messages: [],
        workloads: [],
        scanData: null,
      };
    },
    setBackgroundDiscoveryExecutionState: (state, action) => {
      if (!state.activeRun) return;
      state.activeRun.executionState = action.payload;
    },
    setBackgroundDiscoverySessionId: (state, action) => {
      if (!state.activeRun) return;
      const { profileId, sessionId } = action.payload || {};
      if (!profileId || !sessionId) return;
      state.activeRun.sessionIdsByEnvironment[profileId] = sessionId;
    },
    upsertBackgroundEnvironmentRun: (state, action) => {
      if (!state.activeRun) return;
      const { profileId, patch } = action.payload || {};
      if (!profileId) return;
      state.activeRun.environmentRuns[profileId] = {
        ...(state.activeRun.environmentRuns[profileId] || {}),
        ...(patch || {}),
      };
    },
    mergeBackgroundScanData: (state, action) => {
      if (!state.activeRun) return;
      const { scanResults, environmentMeta } = action.payload || {};
      if (!scanResults || !environmentMeta) return;
      state.activeRun.scanData = mergeAggregateScanData(
        state.activeRun.scanData,
        scanResults,
        environmentMeta
      );
    },
    replaceBackgroundEnvironmentWorkloads: (state, action) => {
      if (!state.activeRun) return;
      const { profileId, workloads, environmentMeta } = action.payload || {};
      if (!profileId || !environmentMeta) return;
      const normalized = annotateWorkloadsForEnvironment(workloads, environmentMeta);
      state.activeRun.workloads = [
        ...state.activeRun.workloads.filter(
          (workload) => getWorkloadEnvironmentProfileId(workload) !== profileId
        ),
        ...normalized,
      ];
      state.activeRun.reviewPending = state.activeRun.workloads.length > 0;
    },
    addBackgroundAssistantMessage: (state, action) => {
      if (!state.activeRun) return;
      const { content, environmentMeta } = action.payload || {};
      if (!content) return;
      state.activeRun.messages.push({
        id: Date.now() + Math.random(),
        role: 'assistant',
        content,
        environmentProfileId: environmentMeta?.profileId || null,
        environmentName: environmentMeta?.name || null,
        timestamp: new Date().toISOString(),
      });
    },
    markBackgroundDiscoveryFinished: (state, action) => {
      if (!state.activeRun) return;
      const { executionState, error = null, failedCount = 0 } = action.payload || {};
      state.activeRun.executionState = executionState || 'completed';
      state.activeRun.completedAt = new Date().toISOString();
      state.activeRun.error = error;
      state.activeRun.failedCount = failedCount;
      state.activeRun.reviewPending =
        state.activeRun.executionState === 'completed' && state.activeRun.workloads.length > 0;
    },
    syncBackgroundDiscoverySnapshot: (state, action) => {
      if (!state.activeRun) return;
      Object.assign(state.activeRun, action.payload || {});
    },
    clearBackgroundDiscovery: (state) => {
      state.activeRun = null;
    },
  },
});

export const {
  startBackgroundDiscovery,
  setBackgroundDiscoveryExecutionState,
  setBackgroundDiscoverySessionId,
  upsertBackgroundEnvironmentRun,
  mergeBackgroundScanData,
  replaceBackgroundEnvironmentWorkloads,
  addBackgroundAssistantMessage,
  markBackgroundDiscoveryFinished,
  syncBackgroundDiscoverySnapshot,
  clearBackgroundDiscovery,
} = workloadDiscoverySlice.actions;

export default workloadDiscoverySlice.reducer;
