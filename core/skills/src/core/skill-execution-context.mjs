const CANONICAL_METHODS = new Set([
  "cloudformation",
  "terraform",
  "opentofu",
  "aws_cli",
]);

export function normalizeExecutionMethod(value) {
  if (value === undefined || value === null || value === "") return null;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return null;
  if (raw === "cfn") return "cloudformation";
  if (
    raw === "cli" ||
    raw === "cloud-cli" ||
    raw === "cloud_cli" ||
    raw === "aws-cli" ||
    raw === "aws_cli" ||
    raw === "azure-cli" ||
    raw === "azure_cli"
  ) {
    return "aws_cli";
  }
  if (CANONICAL_METHODS.has(raw)) return raw;
  return null;
}

export function normalizeExecutionStackAction(value) {
  if (value === undefined || value === null || value === "") return null;
  const raw = String(value).trim().toLowerCase();
  if (raw === "create" || raw === "update") return raw;
  return null;
}

export function parseSelectedExecutionTarget(value) {
  if (!value || typeof value !== "string") {
    return {
      raw: null,
      selectionType: "none",
      workloadId: null,
      stackId: null,
    };
  }

  const raw = value.trim();
  if (!raw) {
    return {
      raw: null,
      selectionType: "none",
      workloadId: null,
      stackId: null,
    };
  }

  if (raw === "auto" || raw === "auto-detect") {
    return {
      raw: null,
      selectionType: "none",
      workloadId: null,
      stackId: null,
    };
  }

  if (raw.startsWith("workload-")) {
    return {
      raw,
      selectionType: "workload",
      workloadId: raw.slice("workload-".length) || null,
      stackId: null,
    };
  }

  return {
    raw,
    selectionType: "unknown",
    workloadId: null,
    stackId: null,
  };
}

function normalizeTrackedResources(trackedResources = {}, deploymentPreferences = {}) {
  const sanitizeTrackedResourceEntries = (resources = []) =>
    Array.isArray(resources)
      ? resources
          .filter((resource) => resource && typeof resource === "object" && !Array.isArray(resource))
          .map((resource) => {
            const { source: _source, ...rest } = resource;
            return rest;
          })
      : [];
  const sanitizeStackEntries = (...stackSources) => {
    const seen = new Set();
    const stacks = [];
    for (const source of stackSources) {
      for (const stack of Array.isArray(source) ? source : []) {
        if (!stack || typeof stack !== "object" || Array.isArray(stack)) continue;
        const stackId = String(
          stack.stackId ||
            stack.stackArn ||
            stack.arn ||
            stack.resourceArn ||
            stack.resourceId ||
            stack.id ||
            ""
        ).trim();
        if (!stackId || seen.has(stackId)) continue;
        seen.add(stackId);
        stacks.push({
          ...stack,
          stackId,
          stackName: stack.stackName || stack.name || stack.displayName || null,
          region: stack.region || stack.awsRegion || stack.location || null,
        });
      }
    }
    return stacks;
  };

  return {
    resources: sanitizeTrackedResourceEntries(trackedResources?.resources),
    stacks: sanitizeStackEntries(trackedResources?.stacks, deploymentPreferences?.stacks),
  };
}

function pickMethod({ requestedMethod, workloadMethod, environmentMethod }) {
  if (requestedMethod) {
    return { resolvedMethod: requestedMethod, methodSource: "user_selection" };
  }
  if (workloadMethod) {
    return { resolvedMethod: workloadMethod, methodSource: "workload" };
  }
  if (environmentMethod) {
    return { resolvedMethod: environmentMethod, methodSource: "environment" };
  }
  return { resolvedMethod: null, methodSource: "none" };
}

function buildDeliveryContext({
  workloadDp = {},
  environmentDp = {},
  workloadSelected = false,
  deliveryTargetOverride = null,
}) {
  const workloadRepo = workloadDp?.gitRepo && typeof workloadDp.gitRepo === "object" ? workloadDp.gitRepo : null;
  const environmentRepo =
    environmentDp?.gitRepo && typeof environmentDp.gitRepo === "object" ? environmentDp.gitRepo : null;

  const hasWorkloadRepo = Boolean(workloadRepo?.fullName);
  const hasEnvironmentRepo = Boolean(environmentRepo?.fullName);
  const hasRepoConflict = workloadSelected && hasWorkloadRepo && hasEnvironmentRepo;

  if (deliveryTargetOverride === "workload_git_repo" && hasWorkloadRepo) {
    return {
      source: "workload",
      sourceOfTruth: "workload_repo",
      target: workloadDp?.deliveryMethod === "manual" ? "manual_repo_change" : "workload_git_repo",
      deliveryMethod: workloadDp?.deliveryMethod || null,
      repo: {
        fullName: workloadRepo.fullName || null,
        branch: workloadRepo.branch || null,
      },
      pipelineConfig: workloadDp?.pipelineConfig || null,
      hasRepoConflict,
      availableTargets: hasRepoConflict ? ["workload_git_repo", "environment_git_repo"] : ["workload_git_repo"],
    };
  }

  if (deliveryTargetOverride === "environment_git_repo" && hasEnvironmentRepo) {
    return {
      source: "environment",
      sourceOfTruth: "environment_repo",
      target: environmentDp?.deliveryMethod === "manual" ? "manual_repo_change" : "environment_git_repo",
      deliveryMethod: environmentDp?.deliveryMethod || null,
      repo: {
        fullName: environmentRepo.fullName || null,
        branch: environmentRepo.branch || null,
      },
      pipelineConfig: environmentDp?.pipelineConfig || null,
      hasRepoConflict,
      availableTargets: hasRepoConflict ? ["workload_git_repo", "environment_git_repo"] : ["environment_git_repo"],
    };
  }

  if (workloadSelected && workloadRepo?.fullName) {
    const deliveryMethod = workloadDp?.deliveryMethod || null;
    return {
      source: "workload",
      sourceOfTruth: "workload_repo",
      target:
        deliveryMethod === "manual" ? "manual_repo_change" : "workload_git_repo",
      deliveryMethod,
      repo: {
        fullName: workloadRepo.fullName || null,
        branch: workloadRepo.branch || null,
      },
      pipelineConfig: workloadDp?.pipelineConfig || null,
      hasRepoConflict,
      availableTargets: hasRepoConflict ? ["workload_git_repo", "environment_git_repo"] : ["workload_git_repo"],
    };
  }

  if (environmentRepo?.fullName) {
    const deliveryMethod = environmentDp?.deliveryMethod || null;
    return {
      source: "environment",
      sourceOfTruth: "environment_repo",
      target:
        deliveryMethod === "manual" ? "manual_repo_change" : "environment_git_repo",
      deliveryMethod,
      repo: {
        fullName: environmentRepo.fullName || null,
        branch: environmentRepo.branch || null,
      },
      pipelineConfig: environmentDp?.pipelineConfig || null,
      hasRepoConflict: false,
      availableTargets: ["environment_git_repo"],
    };
  }

  return {
    source: "none",
    sourceOfTruth: "live_environment",
    target: "direct_cloud",
    deliveryMethod: null,
    repo: null,
    pipelineConfig: null,
    hasRepoConflict: false,
    availableTargets: ["direct_cloud"],
  };
}

function inferStackAction({
  requestedStackAction,
  trackedStacks,
  resolvedMethod,
  existingStack,
  existingStacks = [],
}) {
  if (requestedStackAction) return requestedStackAction;
  if (existingStack) return "update";
  if (Array.isArray(existingStacks) && existingStacks.length > 0) return "update";

  const usesIac =
    resolvedMethod === "cloudformation" ||
    resolvedMethod === "terraform" ||
    resolvedMethod === "opentofu";

  if (usesIac && Array.isArray(trackedStacks) && trackedStacks.length > 0) {
    return "update";
  }

  return null;
}

export async function resolveBlueprintExecutionContext({
  userId = null,
  accountId = null,
  permissionProfileId = null,
  selectedTarget = null,
  configurationMode = null,
  stackAction = null,
  existingStack = null,
  existingStacks = [],
  regions = [],
  defaultValues = {},
  additionalInstructions = null,
  executionPreferences = {},
  deliveryTargetOverride = null,
  accountsService = null,
  workloadsService = null,
} = {}) {
  const parsedTarget =
    selectedTarget && typeof selectedTarget === "object"
      ? selectedTarget
      : parseSelectedExecutionTarget(selectedTarget);

  let accountDefaults = { authProfile: null, deploymentPreferences: {}, securityRules: {} };
  if (userId && permissionProfileId && accountsService?.getPermissionProfileDefaults) {
    try {
      accountDefaults =
        (await accountsService.getPermissionProfileDefaults(userId, permissionProfileId, { includeShared: false })) ||
        accountDefaults;
    } catch (error) {
      accountDefaults = {
        ...accountDefaults,
        lookupError: error?.message || String(error),
      };
    }
  } else if (userId && accountId && accountsService?.getAccountDefaults) {
    try {
      accountDefaults = (await accountsService.getAccountDefaults(userId, accountId, { includeShared: false })) || accountDefaults;
    } catch (error) {
      accountDefaults = {
        ...accountDefaults,
        lookupError: error?.message || String(error),
      };
    }
  }

  let workloadDefaults = {
    deploymentPreferences: {},
    securityRules: {},
    trackedResources: { resources: [], stacks: [] },
    workload: null,
    foundIn: "none",
  };
  if (userId && parsedTarget.workloadId && workloadsService?.getWorkloadDefaults) {
    try {
      workloadDefaults =
        (await workloadsService.getWorkloadDefaults(userId, parsedTarget.workloadId, { includeShared: false })) || workloadDefaults;
    } catch (error) {
      workloadDefaults = {
        ...workloadDefaults,
        foundIn: "error",
        lookupError: error?.message || String(error),
      };
    }
  }

  const requestedMethod = normalizeExecutionMethod(configurationMode);
  const workloadMethod = normalizeExecutionMethod(workloadDefaults?.deploymentPreferences?.method);
  const environmentMethod = normalizeExecutionMethod(accountDefaults?.deploymentPreferences?.method);
  const methodResolution = pickMethod({
    requestedMethod,
    workloadMethod,
    environmentMethod,
  });

  const normalizedTrackedResources = normalizeTrackedResources(
    workloadDefaults?.trackedResources,
    workloadDefaults?.deploymentPreferences
  );
  const explicitExistingStacks = [
    ...(Array.isArray(existingStacks) ? existingStacks : []),
    ...(typeof existingStack === "string" && existingStack.trim() ? [existingStack.trim()] : []),
  ].filter((value, index, arr) => value && arr.indexOf(value) === index);
  const explicitExistingStack = explicitExistingStacks[0] || null;
  const resolvedStackAction = inferStackAction({
    requestedStackAction: normalizeExecutionStackAction(stackAction),
    trackedStacks: normalizedTrackedResources.stacks,
    resolvedMethod: methodResolution.resolvedMethod,
    existingStack: explicitExistingStack,
    existingStacks: explicitExistingStacks,
  });

  const delivery = buildDeliveryContext({
    workloadDp: workloadDefaults?.deploymentPreferences || {},
    environmentDp: accountDefaults?.deploymentPreferences || {},
    workloadSelected: parsedTarget.selectionType === "workload" && !!parsedTarget.workloadId,
    deliveryTargetOverride,
  });

  const resolvedExistingStacks = [
    ...explicitExistingStacks,
    ...normalizedTrackedResources.stacks
      .map((stack) => (typeof stack?.stackId === "string" ? stack.stackId.trim() : null))
      .filter(Boolean),
  ].filter((value, index, arr) => arr.indexOf(value) === index);
  const environmentAuthProfile = accountDefaults?.authProfile || null;
  const provider = String(
    environmentAuthProfile?.provider ||
      environmentAuthProfile?.cloudProvider ||
      environmentAuthProfile?.type ||
      ""
  )
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");
  const isAzure = provider.includes("azure") || Boolean(environmentAuthProfile?.tenantId && environmentAuthProfile?.clientId);
  const resolvedEnvironmentAccountId =
    accountId ||
    (isAzure
      ? environmentAuthProfile?.subscriptionId ||
        (Array.isArray(environmentAuthProfile?.subscriptionIds) ? environmentAuthProfile.subscriptionIds[0] : null) ||
        environmentAuthProfile?.tenantId ||
        null
      : environmentAuthProfile?.awsAccountId || null);

  return {
    target: {
      rawSelection: parsedTarget.raw,
      selectionType: parsedTarget.selectionType,
      scope: parsedTarget.selectionType === "workload" ? "workload" : "environment",
      accountId: resolvedEnvironmentAccountId,
      permissionProfileId:
        permissionProfileId ||
        accountDefaults?.authProfile?.permissionProfileId ||
        null,
      workloadId: parsedTarget.workloadId,
      stackId: explicitExistingStack,
      regions: Array.isArray(regions) ? regions : [],
    },
    inputs: {
      defaultValues: defaultValues || {},
      additionalInstructions: additionalInstructions || null,
      executionPreferences: executionPreferences || {},
    },
    deployment: {
      requestedMethod,
      workloadMethod,
      environmentMethod,
      resolvedMethod: methodResolution.resolvedMethod,
      methodSource: methodResolution.methodSource,
      stackAction: resolvedStackAction,
      existingStacks: resolvedExistingStacks,
    },
    delivery,
    environment: {
      authProfile: environmentAuthProfile,
      permissionProfileId:
        permissionProfileId ||
        accountDefaults?.authProfile?.permissionProfileId ||
        null,
      accountId: resolvedEnvironmentAccountId,
      deploymentPreferences: accountDefaults?.deploymentPreferences || {},
      securityRules: accountDefaults?.securityRules || {},
      lookupError: accountDefaults?.lookupError || null,
    },
    workload: {
      selected: parsedTarget.selectionType === "workload" && !!parsedTarget.workloadId,
      foundIn: workloadDefaults?.foundIn || "none",
      id: parsedTarget.workloadId,
      name:
        workloadDefaults?.workload?.name ||
        workloadDefaults?.workload?.workloadName ||
        null,
      deploymentPreferences: workloadDefaults?.deploymentPreferences || {},
      trackedResources: normalizedTrackedResources,
      securityRules: workloadDefaults?.securityRules || {},
      lookupError: workloadDefaults?.lookupError || null,
    },
  };
}

export const resolveSkillExecutionContext = resolveBlueprintExecutionContext;
