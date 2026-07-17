import {
  normalizeExecutionMethod,
  normalizeExecutionStackAction,
  resolveBlueprintExecutionContext,
} from "./skill-execution-context.mjs";
import {
  applyBlueprintRuntimeSettings,
  rewriteBlueprintForExecution,
} from "./skill-configuration-planning.mjs";
import {
  analyzeBlueprintExecution,
  classifyBlueprintReadOnly,
  determineBlueprintUpdateStrategy,
  recommendBlueprintExecutionTargets,
} from "./skill-execution-analysis.mjs";
import { validateRewrittenBlueprint } from "./skill-rewrite-validation.mjs";

function uniqueStrings(values = []) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [values])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    ),
  ];
}

function normalizeTarget(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || raw === "auto" || raw === "auto-detect") return null;
  return raw;
}

function stackIdFrom(value) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  return String(
    value.stackId ||
      value.stackArn ||
      value.arn ||
      value.resourceArn ||
      value.resourceId ||
      value.id ||
      ""
  ).trim();
}

function stackNameFrom(value, stackId = "") {
  if (!value || typeof value !== "object") {
    const arnMatch = String(stackId || "").match(/:stack\/([^/]+)\//);
    return arnMatch?.[1] || "";
  }
  return String(value.stackName || value.name || value.displayName || "").trim();
}

function stackRegionFrom(value) {
  if (!value || typeof value !== "object") return "";
  return String(value.region || value.awsRegion || value.location || "").trim();
}

function stackDescriptionFrom(value) {
  if (!value || typeof value !== "object") return "";
  return String(value.description || value.reason || "").trim();
}

function buildStackCandidate(value, source = "unknown") {
  const stackId = stackIdFrom(value);
  if (!stackId) return null;
  return {
    stackId,
    stackName: stackNameFrom(value, stackId) || null,
    region: stackRegionFrom(value) || null,
    score: source === "workload_tracked_resources" ? 100 : 80,
    reasons: [`Referenced by ${source.replace(/_/g, " ")}.`],
    resourceTypes: Array.isArray(value?.resourceTypes) ? value.resourceTypes : [],
    description: stackDescriptionFrom(value) || null,
    source,
  };
}

function collectCandidateStacks(executionContext = {}, rewriteConfig = {}) {
  const candidates = [];
  const seen = new Set();
  const push = (value, source) => {
    const candidate = buildStackCandidate(value, source);
    if (!candidate || seen.has(candidate.stackId)) return;
    seen.add(candidate.stackId);
    candidates.push(candidate);
  };

  const trackedStacks = executionContext?.workload?.trackedResources?.stacks;
  const deploymentStacks = executionContext?.workload?.deploymentPreferences?.stacks;
  const resolvedExistingStacks = executionContext?.deployment?.existingStacks;
  const configuredExistingStacks = rewriteConfig?.existingStacks;

  (Array.isArray(trackedStacks) ? trackedStacks : []).forEach((stack) =>
    push(stack, "workload_tracked_resources")
  );
  (Array.isArray(deploymentStacks) ? deploymentStacks : []).forEach((stack) =>
    push(stack, "workload_deployment_preferences")
  );
  (Array.isArray(resolvedExistingStacks) ? resolvedExistingStacks : []).forEach((stack) =>
    push(stack, "resolved_existing_stacks")
  );
  (Array.isArray(configuredExistingStacks) ? configuredExistingStacks : []).forEach((stack) =>
    push(stack, "requested_existing_stacks")
  );
  if (rewriteConfig?.existingStack) {
    push(rewriteConfig.existingStack, "requested_existing_stack");
  }

  return candidates;
}

function buildReadOnlyExecutionContext(executionContext) {
  return {
    ...(executionContext || {}),
    deployment: {
      ...(executionContext?.deployment || {}),
      requestedMethod:
        executionContext?.deployment?.requestedMethod ||
        executionContext?.deployment?.workloadMethod ||
        executionContext?.deployment?.environmentMethod ||
        null,
      resolvedMethod: "aws_cli",
      methodSource: "read_only_skill",
      stackAction: null,
    },
    delivery: {
      source: "none",
      sourceOfTruth: "live_environment",
      target: "direct_cloud",
      deliveryMethod: null,
      repo: null,
      pipelineConfig: null,
      hasRepoConflict: false,
      availableTargets: ["direct_cloud"],
    },
  };
}

function buildEnvironmentScopeRecommendation(reason) {
  return {
    status: "environment_scope_recommended",
    environmentScopeRecommended: true,
    candidates: [],
    topCandidate: null,
    reason:
      reason ||
      "The skill appears to fit better at the environment/account scope than any tracked workload.",
  };
}

function summarizeUpdateStrategy(updateStrategy = null) {
  if (!updateStrategy) return null;
  return {
    method: updateStrategy.method || null,
    changeStrategy: updateStrategy.changeStrategy || null,
    targetType: updateStrategy.targetType || null,
    selectedStackId: updateStrategy.selectedStackId || updateStrategy.stackId || null,
    reason: updateStrategy.reason || null,
    planSummary: updateStrategy.planSummary || null,
  };
}

function buildTargetScopeQuestion(recommendation, executionContext = null) {
  const options = [];
  const pushOption = (option) => {
    if (!option?.id || options.some((existing) => existing.id === option.id)) return;
    options.push(option);
  };

  if (executionContext?.workload?.selected && executionContext?.workload?.id) {
    pushOption({
      id: `workload:${executionContext.workload.id}`,
      label: executionContext.workload.name || executionContext.workload.id,
      description: "Currently selected workload target.",
      recommended: false,
    });
  }
  if (recommendation?.topCandidate?.workloadId) {
    pushOption({
      id: `workload:${recommendation.topCandidate.workloadId}`,
      label: recommendation.topCandidate.name,
      description: recommendation.topCandidate.reasons?.[0] || "Recommended workload target.",
      recommended: true,
    });
  }
  pushOption({
    id: "environment",
    label: "Environment-wide",
    description: recommendation?.reason || "Run this skill at the environment/account scope.",
    recommended: !recommendation?.topCandidate?.workloadId,
  });
  for (const candidate of recommendation?.candidates || []) {
    if (!candidate?.workloadId || candidate.workloadId === recommendation?.topCandidate?.workloadId) continue;
    pushOption({
      id: `workload:${candidate.workloadId}`,
      label: candidate.name,
      description: candidate.reasons?.[0] || "Alternative workload target.",
      recommended: false,
    });
  }

  return {
    id: "target_scope",
    kind: "single_select",
    title: "Choose where to run this skill",
    options,
  };
}

function buildStackActionQuestion() {
  return {
    id: "stack_action",
    kind: "single_select",
    title: "Should this create new infrastructure or update existing infrastructure?",
    options: [
      {
        id: "create",
        label: "Create new",
        description: "Use this when the skill should create a new stack or template deployment.",
        recommended: true,
      },
      {
        id: "update",
        label: "Update existing",
        description: "Use this when the skill should change an existing stack or template deployment.",
        recommended: false,
      },
    ],
  };
}

function buildFinalReviewQuestion({
  executionContext,
  analysis,
  recommendation,
  updateStrategy,
  rewriteConfig = {},
} = {}) {
  const targetQuestion = buildTargetScopeQuestion(recommendation, executionContext);
  const stackActionQuestion = buildStackActionQuestion();
  const currentTargetValue = executionContext?.workload?.selected
    ? `workload:${executionContext.workload.id}`
    : "environment";
  const scopeLabel = executionContext?.workload?.selected ? "Workload" : "Environment-wide";
  const targetLabel = executionContext?.workload?.selected
    ? executionContext?.workload?.name || executionContext?.workload?.id || "Selected workload"
    : executionContext?.target?.accountId || "Environment-wide";
  const methodLabel = analysis?.isMutating
    ? updateStrategy?.method || executionContext?.deployment?.resolvedMethod || "undetermined"
    : "aws_cli (read-only)";
  const stackActionLabel = analysis?.isMutating
    ? updateStrategy?.changeStrategy === "update_existing"
      ? "update"
      : updateStrategy?.changeStrategy === "create_new"
        ? "create"
        : updateStrategy?.changeStrategy === "direct_aws_cli"
          ? "not template-managed"
          : executionContext?.deployment?.stackAction || "undetermined"
    : "not required";
  const existingStacks = uniqueStrings([
    ...(Array.isArray(rewriteConfig?.existingStacks) ? rewriteConfig.existingStacks : []),
    updateStrategy?.selectedStackId || null,
    ...(Array.isArray(executionContext?.deployment?.existingStacks)
      ? executionContext.deployment.existingStacks
      : []),
  ]);
  const changeTargetLabel =
    !analysis?.isMutating
      ? "not required"
      : updateStrategy?.targetType === "cloudformation_stack"
        ? existingStacks.length > 1
          ? `${existingStacks.length} CloudFormation stacks selected`
          : updateStrategy?.selectedStackId || "CloudFormation stack"
        : updateStrategy?.targetType === "github_repo"
          ? executionContext?.delivery?.repo?.fullName || "GitHub repo"
          : "direct AWS environment";
  const changePlanLabel = !analysis?.isMutating
    ? "Read-only skill; no deployment plan is required."
    : updateStrategy?.planSummary || "Execution strategy not yet determined.";
  const deliveryLabel = executionContext?.delivery?.repo?.fullName
    ? `${executionContext.delivery.target} via ${executionContext.delivery.repo.fullName}`
    : executionContext?.delivery?.target || "direct_cloud";

  return {
    id: "analysis_review",
    kind: "single_select",
    title: "Review the execution analysis before continuing",
    summary: [
      { label: "Skill type", value: analysis?.isMutating ? "Mutating" : "Read-only" },
      { label: "Scope", value: scopeLabel },
      { label: "Target", value: String(targetLabel || "Not determined") },
      { label: "Deployment method", value: String(methodLabel) },
      { label: "Create or update", value: String(stackActionLabel) },
      { label: "Change target", value: String(changeTargetLabel) },
      ...(analysis?.isMutating && existingStacks.length
        ? [{ label: "Associated stacks", value: existingStacks.join(", ") }]
        : []),
      { label: "Planned change", value: String(changePlanLabel) },
      { label: "Delivery path", value: String(deliveryLabel) },
    ],
    overrides: {
      target_scope: {
        title: "Target",
        value: currentTargetValue,
        options: targetQuestion.options,
      },
      ...(analysis?.isMutating && updateStrategy?.changeStrategy !== "direct_aws_cli"
        ? {
            stack_action: {
              title: "Create or update",
              value:
                updateStrategy?.changeStrategy === "update_existing"
                  ? "update"
                  : updateStrategy?.changeStrategy === "create_new"
                    ? "create"
                    : executionContext?.deployment?.stackAction || "create",
              options: stackActionQuestion.options,
            },
          }
        : {}),
    },
    options: [
      {
        id: "continue",
        label: "Continue",
        description: "Proceed with the skill rewrite using these determinations.",
        recommended: true,
      },
    ],
  };
}

function applyPreflightAnswer(rewriteConfig = {}, preflightAnswer = null) {
  const next = { ...rewriteConfig };
  const answerId = preflightAnswer?.questionId || null;
  const selectedOptionId = preflightAnswer?.selectedOptionId || preflightAnswer?.value || null;

  const applyTargetScope = (value) => {
    if (!value) return;
    if (value === "environment") {
      next.selectedTarget = null;
      next.selectedWorkloadOrStack = null;
    } else if (String(value).startsWith("workload:")) {
      const selectedTarget = `workload-${String(value).slice("workload:".length)}`;
      next.selectedTarget = selectedTarget;
      next.selectedWorkloadOrStack = selectedTarget;
    }
  };

  if (answerId === "target_scope") {
    applyTargetScope(selectedOptionId);
  } else if (answerId === "stack_action") {
    next.stackAction = normalizeExecutionStackAction(selectedOptionId);
    if (next.stackAction !== "update") {
      next.existingStack = null;
      next.existingStacks = [];
    }
  } else if (answerId === "implementation_method") {
    next.configurationMode = normalizeExecutionMethod(selectedOptionId);
  } else if (answerId === "analysis_review" && preflightAnswer?.overrides) {
    applyTargetScope(preflightAnswer.overrides.target_scope);
    if (preflightAnswer.overrides.stack_action) {
      next.stackAction = normalizeExecutionStackAction(preflightAnswer.overrides.stack_action);
      if (next.stackAction !== "update") {
        next.existingStack = null;
        next.existingStacks = [];
      }
    }
  }

  return next;
}

async function resolveContextForConfig({
  userId,
  accountId,
  rewriteConfig,
  accountsService,
  workloadsService,
}) {
  return resolveBlueprintExecutionContext({
    userId,
    accountId,
    permissionProfileId: rewriteConfig.permissionProfileId,
    selectedTarget: rewriteConfig.selectedTarget || rewriteConfig.selectedWorkloadOrStack,
    configurationMode: rewriteConfig.configurationMode,
    stackAction: rewriteConfig.stackAction,
    existingStack: rewriteConfig.existingStack,
    existingStacks: rewriteConfig.existingStacks,
    regions: rewriteConfig.regions,
    defaultValues: rewriteConfig.defaultValues,
    additionalInstructions: rewriteConfig.additionalInstructions,
    executionPreferences: rewriteConfig.executionPreferences,
    deliveryTargetOverride: rewriteConfig.deliveryTargetOverride,
    accountsService,
    workloadsService,
  });
}

async function resolveUpdateStrategy({
  blueprint,
  executionContext,
  analysis,
  rewriteConfig,
}) {
  return determineBlueprintUpdateStrategy({
    blueprint,
    executionContext,
    analysis,
    candidateStacks: collectCandidateStacks(executionContext, rewriteConfig),
    rewriteConfig,
  });
}

function buildRewriteStackInputs(executionContext, rewriteConfig = {}) {
  const existingStacks = uniqueStrings([
    ...(Array.isArray(executionContext?.deployment?.existingStacks)
      ? executionContext.deployment.existingStacks
      : []),
    ...(Array.isArray(rewriteConfig.existingStacks) ? rewriteConfig.existingStacks : []),
    rewriteConfig.existingStack || null,
  ]);
  return {
    existingStack: existingStacks[0] || null,
    existingStacks,
  };
}

export async function runBlueprintPreflight({
  userId,
  accountId = null,
  permissionProfileId = null,
  blueprint,
  accountsService,
  workloadsService,
  regions = [],
  defaultValues = {},
  executionPreferences = {},
  selectedTarget = null,
  selectedWorkloadOrStack = null,
  configurationMode = null,
  stackAction = null,
  existingStack = null,
  existingStacks = [],
  additionalInstructions = null,
  preflightAnswer = null,
  canRewrite = false,
  onPrepEvent = null,
} = {}) {
  const emit = (type, payload = {}) => {
    if (typeof onPrepEvent === "function") onPrepEvent(type, payload);
  };
  const normalizedTarget = normalizeTarget(selectedTarget || selectedWorkloadOrStack);
  let rewriteConfig = {
    permissionProfileId,
    selectedTarget: normalizedTarget,
    selectedWorkloadOrStack: normalizedTarget,
    configurationMode: normalizeExecutionMethod(configurationMode),
    stackAction: normalizeExecutionStackAction(stackAction),
    existingStack: existingStack || null,
    existingStacks: uniqueStrings(existingStacks),
    regions: Array.isArray(regions) ? regions : [],
    defaultValues: defaultValues || {},
    additionalInstructions,
    executionPreferences: executionPreferences || {},
    deliveryTargetOverride: null,
  };

  emit("prep_phase_started", {
    phase: "review_environment_settings",
    message: "Reviewing environment settings and execution target.",
  });
  let executionContext = await resolveContextForConfig({
    userId,
    accountId,
    rewriteConfig,
    accountsService,
    workloadsService,
  });
  emit("prep_phase_completed", {
    phase: "review_environment_settings",
    message: "Environment settings resolved.",
  });

  emit("prep_phase_started", {
    phase: "analyze_blueprint_intent",
    message: "Analyzing skill scope and rewrite directives.",
  });
  const readOnlyResult = await classifyBlueprintReadOnly({ blueprint });
  emit("prep_progress", {
    phase: "analyze_blueprint_intent",
    message: readOnlyResult?.isReadOnly
      ? "Skill classified as read-only because no task requires implementing changes."
      : "Skill classified as mutating because at least one task requires implementing changes.",
    readOnlyResult,
  });
  let analysis = await analyzeBlueprintExecution({
    blueprint,
    executionContext,
    readOnlyResult,
    recommendation: null,
  });
  emit("prep_phase_completed", {
    phase: "analyze_blueprint_intent",
    message: "Skill analysis completed.",
  });

  let recommendation = null;
  if (readOnlyResult?.isReadOnly) {
    rewriteConfig.configurationMode = "aws_cli";
    rewriteConfig.stackAction = null;
    rewriteConfig.deliveryTargetOverride = null;
    executionContext = buildReadOnlyExecutionContext(executionContext);
    recommendation = buildEnvironmentScopeRecommendation(
      "Skill is read-only, so environment/account scope is the default recommendation."
    );
    emit("prep_phase_started", {
      phase: "match_target_scope",
      message: "Checking whether this skill should run against a workload or the environment.",
    });
    emit("prep_recommendation", {
      phase: "match_target_scope",
      recommendation,
    });
    emit("prep_phase_completed", {
      phase: "match_target_scope",
      message: "Environment-wide execution is the recommended fit for this read-only skill.",
    });
    emit("prep_decision", {
      phase: "match_target_scope",
      decision: {
        questionId: "target_scope",
        selectedOptionId: "environment",
        source: "read_only_default",
        label: "Environment-wide",
      },
    });
    emit("prep_progress", {
      phase: "analyze_blueprint_intent",
      message: "Skill is read-only. Using AWS CLI and skipping deployment configuration checks.",
    });
  } else if (!executionContext?.workload?.selected) {
    emit("prep_phase_started", {
      phase: "match_target_scope",
      message: "Checking existing workloads to recommend the best target scope.",
    });
    recommendation = await recommendBlueprintExecutionTargets({
      userId,
      accountId,
      permissionProfileId,
      blueprint,
      workloadsService,
    });
    emit("prep_recommendation", {
      phase: "match_target_scope",
      recommendation,
    });
    emit("prep_phase_completed", {
      phase: "match_target_scope",
      message:
        recommendation?.status === "recommended_workload"
          ? "A likely workload target was found."
          : "Environment-wide execution is likely the better fit.",
    });
  }

  let updateStrategy = await resolveUpdateStrategy({
    blueprint,
    executionContext,
    analysis,
    rewriteConfig,
  });
  if (!readOnlyResult?.isReadOnly) {
    emit("prep_phase_started", {
      phase: "resolve_update_strategy",
      message: "Resolving whether this change should update an existing target or create a new one.",
    });
    emit("prep_phase_completed", {
      phase: "resolve_update_strategy",
      message: updateStrategy?.planSummary || "Update strategy resolved.",
      updateStrategy: summarizeUpdateStrategy(updateStrategy),
    });
  }

  const question = buildFinalReviewQuestion({
    executionContext,
    analysis,
    recommendation,
    updateStrategy,
    rewriteConfig,
  });

  if (!preflightAnswer) {
    return {
      status: "waiting_for_input",
      question,
      executionContext,
      analysis,
      recommendation,
      updateStrategy,
      rewriteConfig,
      readOnlyResult,
      updatedBlueprint: null,
      validation: null,
    };
  }

  emit("prep_decision", {
    phase: "confirm_analysis",
    decision: {
      questionId: preflightAnswer.questionId || "analysis_review",
      selectedOptionId: preflightAnswer.selectedOptionId || preflightAnswer.value || "continue",
      overrides: preflightAnswer.overrides || {},
    },
  });

  rewriteConfig = applyPreflightAnswer(rewriteConfig, preflightAnswer);
  executionContext = await resolveContextForConfig({
    userId,
    accountId,
    rewriteConfig,
    accountsService,
    workloadsService,
  });
  analysis = await analyzeBlueprintExecution({
    blueprint,
    executionContext,
    readOnlyResult,
    recommendation,
  });
  updateStrategy = await resolveUpdateStrategy({
    blueprint,
    executionContext,
    analysis,
    rewriteConfig,
  });
  emit("prep_progress", {
    phase: "confirm_analysis",
    message: executionContext?.workload?.selected
      ? `Using workload target ${executionContext.workload.name || executionContext.workload.id}.`
      : "Using environment/account target.",
    executionContext: {
      target: executionContext?.target || null,
      workload: executionContext?.workload
        ? {
            selected: executionContext.workload.selected,
            id: executionContext.workload.id,
            name: executionContext.workload.name,
            foundIn: executionContext.workload.foundIn,
            trackedResourceCount:
              (executionContext.workload.trackedResources?.resources?.length || 0) +
              (executionContext.workload.trackedResources?.stacks?.length || 0),
          }
        : null,
    },
  });

  const resolvedRewriteMethod =
    executionContext?.deployment?.resolvedMethod || rewriteConfig.configurationMode;
  let updatedBlueprint = null;
  let validation = null;
  if (typeof resolvedRewriteMethod === "string" && canRewrite) {
    emit("prep_phase_started", {
      phase: "rewrite_blueprint",
      message: "Rewriting the skill for the resolved target and delivery path.",
    });
    const stackInputs = buildRewriteStackInputs(executionContext, rewriteConfig);
    const rewriteResult = await rewriteBlueprintForExecution({
      blueprint: blueprint?.plan ? { plan: blueprint.plan } : blueprint,
      configurationMode: resolvedRewriteMethod,
      stackAction: executionContext?.deployment?.stackAction || rewriteConfig.stackAction,
      executionPreferences: rewriteConfig.executionPreferences,
      defaultValues: rewriteConfig.defaultValues,
      regions: rewriteConfig.regions,
      additionalInstructions: rewriteConfig.additionalInstructions,
      existingStack: stackInputs.existingStack,
      existingStacks: stackInputs.existingStacks,
      executionContext,
      analysis,
    });
    updatedBlueprint = rewriteResult?.blueprint || null;
    emit("prep_phase_completed", {
      phase: "rewrite_blueprint",
      message: updatedBlueprint ? "Skill rewrite completed." : "Skill rewrite did not produce changes.",
    });
    if (updatedBlueprint) {
      emit("prep_phase_started", {
        phase: "validate_rewrite",
        message: "Validating the rewritten skill.",
      });
      validation = validateRewrittenBlueprint({
        blueprint: updatedBlueprint,
        executionContext,
        analysis,
      });
      if (!validation?.ok) {
        emit("prep_progress", {
          phase: "validate_rewrite",
          message: "Retrying skill rewrite with validation feedback.",
          validation,
        });
        const retryRewriteResult = await rewriteBlueprintForExecution({
          blueprint: blueprint?.plan ? { plan: blueprint.plan } : blueprint,
          configurationMode: resolvedRewriteMethod,
          stackAction: executionContext?.deployment?.stackAction || rewriteConfig.stackAction,
          executionPreferences: rewriteConfig.executionPreferences,
          defaultValues: rewriteConfig.defaultValues,
          regions: rewriteConfig.regions,
          additionalInstructions: rewriteConfig.additionalInstructions,
          existingStack: stackInputs.existingStack,
          existingStacks: stackInputs.existingStacks,
          executionContext,
          analysis,
          validationFeedback: validation,
        });
        if (retryRewriteResult?.blueprint) {
          updatedBlueprint = retryRewriteResult.blueprint;
          validation = validateRewrittenBlueprint({
            blueprint: updatedBlueprint,
            executionContext,
            analysis,
          });
        }
      }
      emit("prep_phase_completed", {
        phase: "validate_rewrite",
        message: validation?.ok
          ? "Skill validation completed."
          : "Skill validation completed with remaining warnings.",
        validation,
      });
    }
  } else if (typeof resolvedRewriteMethod === "string" && !canRewrite) {
    emit("prep_scope_warning", {
      phase: "rewrite_blueprint",
      message: "OpenAI is not configured for local mode, so the skill rewrite step was skipped.",
      scope: {
        reason: "Set an OpenAI API key in Preferences, or set OPENAI_API_KEY or OPENAI_TOKEN, to enable local skill rewrite.",
      },
    });
  } else if (
    !readOnlyResult?.isReadOnly &&
    (Object.keys(defaultValues || {}).length ||
      regions.length ||
      additionalInstructions ||
      Object.keys(executionPreferences || {}).length)
  ) {
    emit("prep_phase_started", {
      phase: "rewrite_blueprint",
      message: "Applying runtime settings to the skill while preserving the original implementation path.",
    });
    const runtimeSettingsResult = applyBlueprintRuntimeSettings({
      blueprint: blueprint?.plan ? { plan: blueprint.plan } : blueprint,
      executionPreferences,
      defaultValues,
      regions,
      additionalInstructions,
      executionContext,
    });
    updatedBlueprint = runtimeSettingsResult?.blueprint || null;
    emit("prep_phase_completed", {
      phase: "rewrite_blueprint",
      message: updatedBlueprint
        ? "Runtime settings were applied to the skill."
        : "No deterministic runtime-setting updates were needed.",
    });
  }

  return {
    status: "ready",
    question,
    executionContext,
    analysis,
    recommendation,
    updateStrategy,
    rewriteConfig,
    readOnlyResult,
    updatedBlueprint,
    validation,
  };
}

export const runSkillPreflight = runBlueprintPreflight;
