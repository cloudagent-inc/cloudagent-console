import OpenAI from "openai";
import { Agent, run, user, extractAllTextOutput } from "@openai/agents";
import {
  OpenAIResponsesModel,
  setDefaultOpenAIKey,
} from "@openai/agents-openai";
import globals from "@cloudagent/core/global-variables";

const OPENAI_MODEL = globals.OPENAI_MODEL;
const OPENAI_TOKEN = process.env.OPENAI_TOKEN || process.env.OPENAI_API_KEY || "";
setDefaultOpenAIKey(OPENAI_TOKEN || "missing-local-openai-key");
const openai = new OpenAI({ apiKey: OPENAI_TOKEN || "missing-local-openai-key" });
const model = new OpenAIResponsesModel(openai, OPENAI_MODEL);

const READ_ONLY_JSON_SCHEMA = {
  name: "blueprint_read_only_classification",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["isReadOnly", "reason", "mutationTaskIds"],
    properties: {
      isReadOnly: { type: "boolean" },
      reason: { type: "string" },
      mutationTaskIds: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
};

const ANALYSIS_JSON_SCHEMA = {
  name: "blueprint_execution_analysis",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["affectedResourceTypes", "workloadScope", "rewriteDirectives", "implementation"],
    properties: {
      affectedResourceTypes: {
        type: "array",
        items: { type: "string" },
      },
      workloadScope: {
        type: "object",
        additionalProperties: false,
        required: ["status", "reason", "suggestSeparateDeployment"],
        properties: {
          status: {
            type: "string",
            enum: ["fits", "partial_fit", "does_not_fit", "unknown"],
          },
          reason: { type: "string" },
          suggestSeparateDeployment: { type: "boolean" },
        },
      },
      implementation: {
        type: "object",
        additionalProperties: false,
        required: ["method", "stackAction", "reason"],
        properties: {
          method: { type: ["string", "null"] },
          stackAction: { type: ["string", "null"] },
          reason: { type: "string" },
        },
      },
      rewriteDirectives: {
        type: "object",
        additionalProperties: false,
        required: ["consolidateConfigTasks", "injectTrackedResources", "preferRepoFlow"],
        properties: {
          consolidateConfigTasks: { type: "boolean" },
          injectTrackedResources: { type: "boolean" },
          preferRepoFlow: { type: "boolean" },
        },
      },
    },
  },
};

const TARGET_RECOMMENDATION_JSON_SCHEMA = {
  name: "blueprint_target_recommendation",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["status", "reason", "candidates", "topCandidate"],
    properties: {
      status: {
        type: "string",
        enum: ["recommended_workload", "environment_scope_recommended", "ambiguous", "unavailable"],
      },
      reason: { type: "string" },
      topCandidate: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            required: ["workloadId", "name", "score", "reasons"],
            properties: {
              workloadId: { type: "string" },
              name: { type: "string" },
              score: { type: "number" },
              reasons: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        ],
      },
      candidates: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["workloadId", "name", "score", "reasons"],
          properties: {
            workloadId: { type: "string" },
            name: { type: "string" },
            score: { type: "number" },
            reasons: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
    },
  },
};

const UPDATE_STRATEGY_JSON_SCHEMA = {
  name: "blueprint_update_strategy",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["method", "changeStrategy", "targetType", "selectedStackId", "reason", "planSummary"],
    properties: {
      method: {
        type: ["string", "null"],
        enum: ["cloudformation", "terraform", "opentofu", "aws_cli", null],
      },
      changeStrategy: {
        type: "string",
        enum: ["create_new", "update_existing", "direct_aws_cli", "not_required"],
      },
      targetType: {
        type: "string",
        enum: ["cloudformation_stack", "github_repo", "direct_aws", "none"],
      },
      selectedStackId: { type: ["string", "null"] },
      reason: { type: "string" },
      planSummary: { type: "string" },
    },
  },
};

function extractJsonStrict(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {}
  const fenced = String(text).match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch (_) {}
  }
  return null;
}

function logUpdateStrategy(stage, payload) {
  try {
    console.log(
      `[BLUEPRINT_UPDATE_STRATEGY_${stage}]`,
      JSON.stringify(payload, null, 2)
    );
  } catch (error) {
    console.log(
      `[BLUEPRINT_UPDATE_STRATEGY_${stage}_LOG_ERROR]`,
      error?.message || String(error)
    );
  }
}

function extractModelTextOutput(result = null) {
  const primary =
    extractAllTextOutput(result?.output || []) ||
    result?.output_text ||
    "";
  if (typeof primary === "string" && primary.trim()) {
    return primary.trim();
  }

  const outputItems = Array.isArray(result?.output) ? result.output : [];
  const chunks = [];
  for (const item of outputItems) {
    if (typeof item?.text === "string" && item.text.trim()) {
      chunks.push(item.text.trim());
    }
    const contentItems = Array.isArray(item?.content) ? item.content : [];
    for (const content of contentItems) {
      if (typeof content?.text === "string" && content.text.trim()) {
        chunks.push(content.text.trim());
      }
      if (typeof content?.value === "string" && content.value.trim()) {
        chunks.push(content.value.trim());
      }
    }
  }

  return chunks.join("\n").trim();
}

function extractBlueprintText(blueprint = {}) {
  const normalized = buildBlueprintAnalysisPayload(blueprint);
  const phases = Array.isArray(normalized?.plan) ? normalized.plan : [];
  const parts = [];
  if (normalized?.title) parts.push(normalized.title);
  if (normalized?.description) parts.push(normalized.description);
  for (const phase of phases) {
    if (phase?.title) parts.push(phase.title);
    for (const task of Array.isArray(phase?.tasks) ? phase.tasks : []) {
      if (task?.title) parts.push(task.title);
      if (task?.description) parts.push(task.description);
      if (task?.type) parts.push(task.type);
      if (Array.isArray(task?.executionPlan)) parts.push(task.executionPlan.join(" "));
      if (Array.isArray(task?.completionCriteria)) parts.push(task.completionCriteria.join(" "));
    }
  }
  return parts.join(" ").toLowerCase();
}

function normalizeTextBlock(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter(Boolean).join("\n");
  return "";
}

function normalizePlanForAnalysis(blueprint = {}) {
  const phases = Array.isArray(blueprint?.plan)
    ? blueprint.plan
    : Array.isArray(blueprint?.plan?.plan)
    ? blueprint.plan.plan
    : Array.isArray(blueprint)
    ? blueprint
    : [];

  return phases.map((phase) => ({
    title: phase?.title || "",
    tasks: Array.isArray(phase?.tasks)
      ? phase.tasks.map((task) => ({
          id: task?.id || null,
          title: task?.title || "",
          description: task?.description || "",
          type: task?.type || null,
          executionPlan: Array.isArray(task?.executionPlan) ? task.executionPlan : [],
          completionCriteria: Array.isArray(task?.completionCriteria)
            ? task.completionCriteria
            : [],
        }))
      : [],
  }));
}

function buildBlueprintAnalysisPayload(blueprint = {}) {
  return {
    title: blueprint?.title || "",
    description: normalizeTextBlock(blueprint?.description),
    plan: normalizePlanForAnalysis(blueprint),
  };
}

function buildMutatingTaskAssessmentPayload(blueprint = {}, mutationTaskIds = []) {
  const normalized = buildBlueprintAnalysisPayload(blueprint);
  const wantedTaskIds = new Set(
    (Array.isArray(mutationTaskIds) ? mutationTaskIds : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );
  const mutatingTasks = [];

  for (const phase of Array.isArray(normalized?.plan) ? normalized.plan : []) {
    for (const task of Array.isArray(phase?.tasks) ? phase.tasks : []) {
      if (!wantedTaskIds.has(String(task?.id || "").trim())) continue;
      mutatingTasks.push({
        id: task?.id || null,
        title: task?.title || "",
        description: task?.description || "",
      });
    }
  }

  return {
    title: normalized?.title || "",
    description: normalized?.description || "",
    mutatingTasks,
  };
}

function normalizeTrackedResourcesForRecommendation(trackedResources = {}) {
  const resources = Array.isArray(trackedResources?.resources)
    ? trackedResources.resources.map((resource) => {
        if (!resource || typeof resource !== "object" || Array.isArray(resource)) return {};
        const { source: _source, ...rest } = resource;
        return rest;
      })
    : [];
  const stacks = Array.isArray(trackedResources?.stacks) ? trackedResources.stacks : [];
  return {
    resourceTypes: Array.from(
      new Set(
        resources
          .map((resource) => String(resource?.resourceType || "").trim())
          .filter(Boolean)
      )
    ),
    resourceIdentifiers: Array.from(
      new Set(
        resources
          .flatMap((resource) => [
            resource?.resourceId,
            resource?.resourceArn,
            resource?.displayName,
            resource?.name,
          ])
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      )
    ).slice(0, 20),
    stacks: stacks
      .map((stack) => ({
        stackId: String(stack?.stackId || "").trim() || null,
        description: String(stack?.description || "").trim() || null,
      }))
      .filter((stack) => stack.stackId),
  };
}

function isSystemWorkload(workload = {}) {
  const name = String(workload?.name || workload?.workloadName || "").trim();
  return name.startsWith("PermissionProfile-");
}

function normalizeEnvironmentReferenceSet(workload = {}) {
  const refs = new Set();
  for (const environment of Array.isArray(workload?.environments) ? workload.environments : []) {
    if (environment == null) continue;
    const value = String(environment).trim();
    if (value) refs.add(value);
  }
  return refs;
}

function buildWorkloadRecommendationCandidates({
  workloads = [],
  accountId = null,
  permissionProfileId = null,
  limit = 12
} = {}) {
  const filtered = (Array.isArray(workloads) ? workloads : []).filter((workload) => {
    if (isSystemWorkload(workload)) return false;
    if (!accountId && !permissionProfileId) return true;
    const environmentRefs = normalizeEnvironmentReferenceSet(workload);
    if (permissionProfileId && environmentRefs.has(String(permissionProfileId))) return true;
    if (accountId && environmentRefs.has(String(accountId))) return true;
    return false;
  });

  return filtered.slice(0, limit).map((workload) => ({
    workloadId: workload?.workloadId || null,
    name: workload?.name || workload?.workloadName || "Unnamed workload",
    description: normalizeTextBlock(workload?.description),
    deploymentSummary: normalizeTextBlock(workload?.deploymentSummary),
    trackedResources: normalizeTrackedResourcesForRecommendation(workload?.trackedResources || {}),
  })).filter((workload) => workload.workloadId);
}

function getMutatingTaskSignal(task = {}) {
  const parts = [
    task?.title || "",
    task?.description || "",
    task?.type || "",
    ...(Array.isArray(task?.executionPlan) ? task.executionPlan : []),
    ...(Array.isArray(task?.completionCriteria) ? task.completionCriteria : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const mutatingHints = [
    "enable",
    "disable",
    "update",
    "modify",
    "delete",
    "create",
    "apply",
    "configure",
    "turn on",
    "turn off",
    "migrate",
    "rotate",
    "remediate",
    "install",
    "deploy",
    "provision",
    "attach",
    "detach",
    "put-",
    "create-",
    "update-",
    "delete-",
  ];
  const readOnlyHints = [
    "review",
    "assess",
    "audit",
    "inspect",
    "check",
    "verify",
    "validate",
    "inventory",
    "discover",
    "identify",
    "determine whether",
    "determine if",
    "report",
    "list",
    "summarize",
    "in use",
    "unused",
    "usage",
  ];

  const type = String(task?.type || "").toLowerCase();
  if (type.includes("write") || type.includes("create") || type.includes("update")) {
    return true;
  }

  const hasMutatingHint = mutatingHints.some((hint) => parts.includes(hint));
  const hasReadOnlyHint = readOnlyHints.some((hint) => parts.includes(hint));
  return hasMutatingHint && !hasReadOnlyHint;
}

function collectHeuristicMutationTaskIds(blueprint = {}) {
  const phases = normalizePlanForAnalysis(blueprint);
  const taskIds = [];
  for (const phase of phases) {
    for (const task of Array.isArray(phase?.tasks) ? phase.tasks : []) {
      if (!task?.id) continue;
      if (getMutatingTaskSignal(task)) {
        taskIds.push(task.id);
      }
    }
  }
  return Array.from(new Set(taskIds));
}

function collectAllTaskIds(blueprint = {}) {
  const phases = normalizePlanForAnalysis(blueprint);
  const taskIds = [];
  for (const phase of phases) {
    for (const task of Array.isArray(phase?.tasks) ? phase.tasks : []) {
      if (task?.id) taskIds.push(task.id);
    }
  }
  return Array.from(new Set(taskIds));
}

function heuristicReadOnlyFallback({ blueprint }) {
  const text = extractBlueprintText(blueprint);
  const mutatingHints = [
    "enable",
    "disable",
    "update",
    "modify",
    "delete",
    "create",
    "apply",
    "configure",
    "turn on",
    "turn off",
    "migrate",
    "rotate",
    "remediate",
    "install",
  ];
  const readOnlyHints = [
    "review",
    "assess",
    "audit",
    "inspect",
    "check",
    "verify",
    "validate",
    "inventory",
    "discover",
    "identify",
    "determine whether",
    "determine if",
    "report",
    "list",
    "summarize",
    "in use",
    "unused",
    "usage",
  ];
  const hasMutatingHint = mutatingHints.some((hint) => text.includes(hint));
  const hasReadOnlyHint = readOnlyHints.some((hint) => text.includes(hint));
  const mutationTaskIds = collectHeuristicMutationTaskIds(blueprint);
  const isReadOnly = mutationTaskIds.length === 0 && hasReadOnlyHint && !hasMutatingHint;
  return {
    isReadOnly,
    reason: isReadOnly
      ? "Skill appears focused on review, inspection, discovery, or reporting rather than implementation."
      : "Skill contains implementation-oriented tasks that imply making changes.",
    mutationTaskIds: isReadOnly ? [] : mutationTaskIds,
  };
}

function buildMutatingSafetyFallback({ blueprint, reason }) {
  const heuristicMutationTaskIds = collectHeuristicMutationTaskIds(blueprint);
  const fallbackTaskIds =
    heuristicMutationTaskIds.length > 0
      ? heuristicMutationTaskIds
      : collectAllTaskIds(blueprint).slice(0, 3);
  return {
    isReadOnly: false,
    reason:
      reason ||
      "Classifier output could not be trusted, so the skill is being treated as mutating for safety.",
    mutationTaskIds: fallbackTaskIds,
  };
}

function heuristicAnalysisFallback({ executionContext, readOnlyResult }) {
  const trackedCount =
    (executionContext?.workload?.trackedResources?.resources?.length || 0) +
    (executionContext?.workload?.trackedResources?.stacks?.length || 0);
  const workloadSelected = Boolean(executionContext?.workload?.selected);
  const isReadOnly = Boolean(readOnlyResult?.isReadOnly);
  const isMutating = !isReadOnly;
  return {
    isMutating,
    affectedResourceTypes: [],
    workloadScope: {
      status: workloadSelected ? (trackedCount > 0 ? "fits" : "unknown") : "does_not_fit",
      reason: workloadSelected
        ? "A workload was selected; use tracked resources when directly relevant."
        : "No workload was selected; default to environment scope unless the user chooses a workload.",
      suggestSeparateDeployment: !workloadSelected,
    },
    implementation: {
      method: isMutating ? executionContext?.deployment?.resolvedMethod || null : "aws_cli",
      stackAction: isMutating ? executionContext?.deployment?.stackAction || null : null,
      reason: isMutating
        ? "Derived from resolved execution context."
        : "Skill appears read-only, so direct read-only CLI access is sufficient.",
    },
    rewriteDirectives: {
      consolidateConfigTasks:
        isMutating && executionContext?.deployment?.resolvedMethod === "cloudformation",
      injectTrackedResources: workloadSelected && trackedCount > 0,
      preferRepoFlow:
        isMutating &&
        (executionContext?.delivery?.target === "workload_git_repo" ||
          executionContext?.delivery?.target === "environment_git_repo" ||
          executionContext?.delivery?.target === "manual_repo_change"),
    },
  };
}

function normalizeReadOnlyResult(parsed, { blueprint }) {
  const fallback = buildMutatingSafetyFallback({
    blueprint,
    reason:
      "Classifier output could not be parsed reliably, so the skill is being treated as mutating for safety.",
  });
  const next = parsed && typeof parsed === "object" ? { ...parsed } : { ...fallback };
  if (typeof next.isReadOnly !== "boolean" && typeof next.readOnly === "boolean") {
    next.isReadOnly = next.readOnly;
  }
  if (typeof next.isReadOnly !== "boolean") {
    next.isReadOnly = fallback.isReadOnly;
  }
  if (typeof next.reason !== "string" || !next.reason.trim()) {
    next.reason = fallback.reason;
  }
  next.mutationTaskIds = Array.isArray(next.mutationTaskIds)
    ? next.mutationTaskIds.filter((value) => typeof value === "string" && value.trim())
    : fallback.mutationTaskIds;
  if (next.isReadOnly) {
    next.mutationTaskIds = [];
  } else if (!next.mutationTaskIds.length && fallback.mutationTaskIds.length) {
    next.mutationTaskIds = fallback.mutationTaskIds;
  }

  if (!next.isReadOnly && !next.mutationTaskIds.length) {
    const safetyFallback = buildMutatingSafetyFallback({
      blueprint,
      reason:
        "No mutating task ids were identified from classifier output, so the skill is being treated as mutating for safety.",
    });
    next.isReadOnly = safetyFallback.isReadOnly;
    next.reason = safetyFallback.reason;
    next.mutationTaskIds = safetyFallback.mutationTaskIds;
  }
  return next;
}

function normalizeAnalysisResult(parsed, { executionContext, readOnlyResult }) {
  const fallback = heuristicAnalysisFallback({ executionContext, readOnlyResult });
  const next = parsed && typeof parsed === "object" ? { ...parsed } : { ...fallback };

  next.isMutating = !Boolean(readOnlyResult?.isReadOnly);

  if (!next.workloadScope || typeof next.workloadScope !== "object") {
    next.workloadScope = fallback.workloadScope;
  }

  if (!next.implementation || typeof next.implementation !== "object") {
    next.implementation = fallback.implementation;
  }

  if (!next.rewriteDirectives || typeof next.rewriteDirectives !== "object") {
    next.rewriteDirectives = fallback.rewriteDirectives;
  }

  if (!next.isMutating) {
    next.implementation = {
      ...(next.implementation || {}),
      method: "aws_cli",
      stackAction: null,
      reason:
        next.implementation?.reason ||
        "Skill is read-only, so deployment method and stack action are not needed.",
    };
    next.rewriteDirectives = {
      ...(next.rewriteDirectives || {}),
      consolidateConfigTasks: false,
      preferRepoFlow: false,
    };
  }

  return next;
}

function normalizeTargetRecommendationResult(parsed, { candidates = [] } = {}) {
  const candidateMap = new Map(
    candidates
      .filter((candidate) => candidate?.workloadId)
      .map((candidate) => [String(candidate.workloadId), candidate])
  );

  const fallback = {
    status: "environment_scope_recommended",
    reason:
      "No workload was strongly identified for this skill, so environment/account scope is recommended.",
    topCandidate: null,
    candidates: [],
  };

  const next = parsed && typeof parsed === "object" ? { ...parsed } : { ...fallback };
  const normalizedCandidates = Array.isArray(next.candidates)
    ? next.candidates
        .map((candidate) => {
          const workloadId = String(candidate?.workloadId || "").trim();
          if (!workloadId || !candidateMap.has(workloadId)) return null;
          const source = candidateMap.get(workloadId);
          return {
            workloadId,
            name: candidate?.name || source?.name || workloadId,
            score: Number(candidate?.score || 0),
            reasons: Array.isArray(candidate?.reasons)
              ? candidate.reasons.filter((reason) => typeof reason === "string" && reason.trim()).slice(0, 3)
              : [],
          };
        })
        .filter(Boolean)
    : [];

  let topCandidate = null;
  if (next.topCandidate && typeof next.topCandidate === "object") {
    const workloadId = String(next.topCandidate.workloadId || "").trim();
    if (workloadId && candidateMap.has(workloadId)) {
      const source = candidateMap.get(workloadId);
      topCandidate = {
        workloadId,
        name: next.topCandidate?.name || source?.name || workloadId,
        score: Number(next.topCandidate?.score || 0),
        reasons: Array.isArray(next.topCandidate?.reasons)
          ? next.topCandidate.reasons.filter((reason) => typeof reason === "string" && reason.trim()).slice(0, 3)
          : [],
      };
    }
  }

  if (!topCandidate && normalizedCandidates.length > 0) {
    topCandidate = [...normalizedCandidates].sort((a, b) => b.score - a.score)[0];
  }

  const status = ["recommended_workload", "environment_scope_recommended", "ambiguous", "unavailable"].includes(next.status)
    ? next.status
    : fallback.status;

  return {
    status,
    reason: typeof next.reason === "string" && next.reason.trim() ? next.reason : fallback.reason,
    topCandidate,
    candidates: normalizedCandidates,
    environmentScopeRecommended: status === "environment_scope_recommended",
  };
}

function normalizeUpdateStrategyResult(parsed, { fallback = null, candidateStackIds = [] } = {}) {
  const base = fallback && typeof fallback === "object"
    ? { ...fallback }
    : {
        method: "aws_cli",
        changeStrategy: "direct_aws_cli",
        targetType: "direct_aws",
        selectedStackId: null,
        reason:
          "No reliable update strategy decision was available, so the change is falling back to direct cloud CLI.",
        planSummary:
          "Apply the change directly with the authenticated cloud CLI because no existing managed template target could be confirmed.",
      };

  const next = parsed && typeof parsed === "object" ? { ...parsed } : { ...base };
  const allowedMethods = new Set(["cloudformation", "terraform", "opentofu", "aws_cli", null]);
  const allowedChangeStrategies = new Set(["create_new", "update_existing", "direct_aws_cli", "not_required"]);
  const allowedTargetTypes = new Set(["cloudformation_stack", "github_repo", "direct_aws", "none"]);

  next.method = allowedMethods.has(next.method) ? next.method : base.method;
  next.changeStrategy = allowedChangeStrategies.has(next.changeStrategy)
    ? next.changeStrategy
    : base.changeStrategy;
  next.targetType = allowedTargetTypes.has(next.targetType)
    ? next.targetType
    : base.targetType;
  next.selectedStackId =
    typeof next.selectedStackId === "string" && next.selectedStackId.trim()
      ? next.selectedStackId.trim()
      : null;
  if (next.selectedStackId && !candidateStackIds.includes(next.selectedStackId)) {
    next.selectedStackId = null;
  }
  next.reason =
    typeof next.reason === "string" && next.reason.trim() ? next.reason : base.reason;
  next.planSummary =
    typeof next.planSummary === "string" && next.planSummary.trim()
      ? next.planSummary
      : base.planSummary;

  if (next.changeStrategy === "update_existing" && next.targetType === "cloudformation_stack" && !next.selectedStackId) {
    next.changeStrategy = base.changeStrategy;
    next.targetType = base.targetType;
    next.method = base.method;
    next.reason = "No valid existing CloudFormation stack was selected, so the fallback update strategy was used.";
    next.planSummary = base.planSummary;
  }

  if (next.changeStrategy === "direct_aws_cli") {
    next.method = "aws_cli";
    next.targetType = "direct_aws";
    next.selectedStackId = null;
  }

  if (next.changeStrategy === "not_required") {
    next.targetType = "none";
    next.selectedStackId = null;
  }

  return next;
}

export async function classifyBlueprintReadOnly({ blueprint } = {}) {
  const blueprintPayload = buildBlueprintAnalysisPayload(blueprint);
  if (!OPENAI_TOKEN) {
    return buildMutatingSafetyFallback({
      blueprint,
      reason:
        "The classifier model was unavailable, so the skill is being treated as mutating for safety.",
    });
  }

  const instructions = `
You are classifying whether a skill that describes tasks to be executed in an AWS environment is read-only or includes tasks that update the environment (create/update/delete/enable/disable/etc.)

Return strict JSON only.
Return exactly one JSON object with exactly these top-level keys:
- isReadOnly
- reason
- mutationTaskIds

Do not use any alternate field names.
Forbidden field names include:
- readOnly
- readonly
- is_read_only
- mutating
- isMutating

Valid example:
{"isReadOnly":false,"reason":"Task create_budget changes the environment.","mutationTaskIds":["create_budget"]}

Invalid example:
{"readOnly":false,"mutationTaskIds":["create_budget"]}

Rule:
- If all tasks are review, discovery, audit, inspection, validation, inventory, or reporting only, the skill is read-only.
- If at least one task requires implementing changes or updates in the environment, the skill is not read-only.
- If the skill is read-only, mutationTaskIds must be an empty array and the execution method should be treated as AWS CLI only because no deployment method is needed.
- If the skill is not read-only, return the exact task ids that require creating, updating, deleting, enabling, disabling, or otherwise changing the environment in mutationTaskIds.
- If the skill is not read-only, mutationTaskIds must contain at least one task id from the provided plan.
- If you are uncertain, prefer classifying the skill as not read-only and include the most likely mutating task ids.

Read-only examples:
- review whether an AWS account is in use
- inspect configuration
- audit resources
- report unused assets
- inventory services

Mutating examples:
- enable or disable a service
- create, update, or delete infrastructure
- apply configuration
- remediate findings
- rotate or modify settings
- create a budget
`;

  try {
    const agent = new Agent({
      name: "BlueprintReadOnlyClassifier",
      instructions,
      model,
      responseFormat: { type: "json_schema", json_schema: READ_ONLY_JSON_SCHEMA },
    });
    const result = await run(agent, [user(JSON.stringify({ blueprint: blueprintPayload }))], {
      maxTurns: 1,
      runConfig: { tracingDisabled: true, reasoning: { effort: "medium" } },
    });
    const raw = extractModelTextOutput(result);
    const parsed = extractJsonStrict(raw);
    return normalizeReadOnlyResult(parsed, { blueprint });
  } catch {
    return normalizeReadOnlyResult(null, { blueprint });
  }
}

export async function analyzeBlueprintExecution({
  blueprint,
  executionContext,
  readOnlyResult,
  recommendation = null,
} = {}) {
  const blueprintPayload = buildBlueprintAnalysisPayload(blueprint);
  const fallback = heuristicAnalysisFallback({ executionContext, readOnlyResult });
  if (!OPENAI_TOKEN) {
    return normalizeAnalysisResult(fallback, { executionContext, readOnlyResult });
  }

  const instructions = `
You are analyzing a skill execution context after mutation classification.

Return strict JSON only.

Inputs:
- readOnlyResult.isReadOnly is already decided and must be treated as final.

Decide:
- whether workload scoping fits the target
- whether tracked resources should be injected
- whether repo-based delivery should be preferred
- whether config tasks should be consolidated
- the best implementation method and stack action consistent with the provided context

Constraints:
- Do not re-decide whether the skill is read-only.
- If readOnlyResult.isReadOnly is true, return implementation.method="aws_cli", implementation.stackAction=null, and preferRepoFlow=false. The aws_cli value represents the authenticated direct cloud CLI path; use Azure CLI commands for Azure targets.
- If readOnlyResult.isReadOnly is true, do not return cloudformation, terraform, or opentofu because read-only skills do not require a deployment mechanism.
- Use executionContext as the source of truth for delivery path, workload selection, tracked resources, and resolved deployment preferences.
- If no workload is selected, do not pretend workload scoping exists.
- If the skill appears environment/account scoped, set workloadScope.status to does_not_fit and suggestSeparateDeployment=true.
`;

  const payload = {
    blueprint: blueprintPayload,
    executionContext,
    readOnlyResult,
    recommendation,
  };

  try {
    const agent = new Agent({
      name: "BlueprintExecutionAnalysisAgent",
      instructions,
      model,
      responseFormat: { type: "json_schema", json_schema: ANALYSIS_JSON_SCHEMA },
    });
    const result = await run(agent, [user(JSON.stringify(payload))], {
      maxTurns: 8,
      runConfig: { tracingDisabled: true, reasoning: { effort: "medium" } },
    });
    const raw = extractModelTextOutput(result);
    const parsed = extractJsonStrict(raw);
    return normalizeAnalysisResult(parsed, { executionContext, readOnlyResult });
  } catch {
    return normalizeAnalysisResult(fallback, { executionContext, readOnlyResult });
  }
}

export async function recommendBlueprintExecutionTargets({
  userId = null,
  accountId = null,
  permissionProfileId = null,
  blueprint = null,
  workloadsService = null,
  limit = 12,
} = {}) {
  const fallback = {
    status: "environment_scope_recommended",
    environmentScopeRecommended: true,
    candidates: [],
    topCandidate: null,
    reason:
      "No workload recommendation was available, so environment/account scope is the safe default.",
  };

  if (!userId || !workloadsService?.listWorkloadsByUser) {
    return {
      ...fallback,
      status: "unavailable",
      reason: "Workload listing is unavailable for this run.",
    };
  }

  const allWorkloads = await workloadsService.listWorkloadsByUser(userId, 200);
  const candidates = buildWorkloadRecommendationCandidates({
    workloads: allWorkloads,
    accountId,
    permissionProfileId,
    limit,
  });

  if (!candidates.length) {
    return {
      ...fallback,
      reason: "No eligible workloads were found in the selected environment.",
    };
  }

  if (!OPENAI_TOKEN) {
    return fallback;
  }

  const instructions = `
You are deciding whether a skill should run at environment/account scope or against one of the provided workloads.

Return strict JSON only.

Decision rules:
- Recommend a workload only when the skill clearly fits that workload's purpose or tracked resources.
- Recommend environment/account scope when the skill is shared, account-wide, platform-wide, or does not clearly map to a single workload.
- Do not invent workloads that were not provided.
- Use workload descriptions and tracked resources/stacks as the primary evidence.
- Exclude weak guesses. If the fit is ambiguous, prefer environment/account scope unless one workload is clearly better.

Scoring:
- score is 0-100 where higher means a stronger fit.
- topCandidate must be null if environment/account scope is recommended.
- candidates may be empty if environment/account scope is the best recommendation.

Output:
- status: "recommended_workload" or "environment_scope_recommended" or "ambiguous"
- reason: concise explanation
- topCandidate: best workload when applicable
- candidates: ranked workload candidates you considered
`;

  const payload = {
    blueprint: buildBlueprintAnalysisPayload(blueprint),
    environment: {
      accountId: accountId || null,
    },
    workloads: candidates,
  };

  try {
    const agent = new Agent({
      name: "BlueprintTargetRecommendationAgent",
      instructions,
      model,
      responseFormat: { type: "json_schema", json_schema: TARGET_RECOMMENDATION_JSON_SCHEMA },
    });
    const result = await run(agent, [user(JSON.stringify(payload))], {
      maxTurns: 8,
      runConfig: { tracingDisabled: true, reasoning: { effort: "medium" } },
    });
    const raw = extractModelTextOutput(result);
    const parsed = extractJsonStrict(raw);
    return normalizeTargetRecommendationResult(parsed, { candidates });
  } catch {
    return fallback;
  }
}

export async function determineBlueprintUpdateStrategy({
  blueprint = null,
  executionContext = null,
  analysis = null,
  candidateStacks = [],
  rewriteConfig = {},
} = {}) {
  const currentMethod =
    executionContext?.deployment?.resolvedMethod || rewriteConfig?.configurationMode || null;
  const repo = executionContext?.delivery?.repo || null;
  const fallback =
    !analysis?.isMutating
      ? {
          method: currentMethod,
          changeStrategy: "not_required",
          targetType: "none",
          selectedStackId: null,
          reason: "Read-only skills do not require an update strategy.",
          planSummary: "No create/update decision is required for a read-only skill.",
        }
      : currentMethod === "terraform" || currentMethod === "opentofu"
      ? repo?.fullName
        ? {
            method: currentMethod,
            changeStrategy: "update_existing",
            targetType: "github_repo",
            selectedStackId: null,
            reason: "Terraform/OpenTofu changes should use the configured source-of-truth repository.",
            planSummary: `Update infrastructure code in ${repo.fullName}${repo?.branch ? ` on branch ${repo.branch}` : ""}.`,
          }
        : {
            method: currentMethod,
            changeStrategy: "create_new",
            targetType: "none",
            selectedStackId: null,
            reason:
              "No Terraform/OpenTofu repository target was confirmed, so the safe fallback is to keep the configured method and treat this as a create-new path.",
            planSummary:
              "Create the required infrastructure with the configured Terraform/OpenTofu method unless later evidence shows this is an unmanaged existing-resource modification.",
          }
      : currentMethod === "cloudformation"
      ? {
          method: "cloudformation",
          changeStrategy: candidateStacks.length > 0 ? "update_existing" : "create_new",
          targetType: "cloudformation_stack",
          selectedStackId: candidateStacks[0]?.stackId || null,
          reason: candidateStacks.length > 0
            ? "A CloudFormation stack candidate was available for update."
            : "No CloudFormation stack candidate was available, so create new is the deterministic fallback.",
          planSummary: candidateStacks.length > 0
            ? `Update CloudFormation stack ${candidateStacks[0]?.stackName || candidateStacks[0]?.stackId}.`
            : "Create a new CloudFormation stack because no matching managed stack was identified.",
        }
      : {
          method: "aws_cli",
          changeStrategy: "direct_aws_cli",
          targetType: "direct_aws",
          selectedStackId: null,
          reason: "The resolved method does not point to a managed template target.",
          planSummary: "Apply the change directly with AWS CLI.",
        };

  if (!analysis?.isMutating) {
    return fallback;
  }

  if (!OPENAI_TOKEN) {
    return fallback;
  }

  const payload = {
    blueprint: buildBlueprintAnalysisPayload(blueprint),
    executionContext: {
      target: executionContext?.target || null,
      deployment: executionContext?.deployment || null,
      delivery: executionContext?.delivery || null,
      workload: executionContext?.workload
        ? {
            selected: Boolean(executionContext.workload.selected),
            id: executionContext.workload.id || null,
            name: executionContext.workload.name || null,
            trackedResources: executionContext.workload.trackedResources || { resources: [], stacks: [] },
          }
        : null,
    },
    analysis: {
      affectedResourceTypes: Array.isArray(analysis?.affectedResourceTypes)
        ? analysis.affectedResourceTypes
        : [],
      implementation: analysis?.implementation || null,
      workloadScope: analysis?.workloadScope || null,
    },
    candidateStacks: Array.isArray(candidateStacks)
      ? candidateStacks.map((candidate) => ({
          stackId: candidate?.stackId || null,
          stackName: candidate?.stackName || null,
          region: candidate?.region || null,
          score: Number(candidate?.score || 0),
          reasons: Array.isArray(candidate?.reasons) ? candidate.reasons : [],
          resourceTypes: Array.isArray(candidate?.resourceTypes) ? candidate.resourceTypes : [],
          description: candidate?.description || null,
        }))
      : [],
    repoTarget: repo
      ? {
          fullName: repo.fullName || null,
          branch: repo.branch || null,
        }
      : null,
  };
  logUpdateStrategy("INPUT", payload);

  const instructions = `
You are deciding how a mutating skill should be applied when the current implementation method is CloudFormation, Terraform/OpenTofu, or direct cloud CLI.

Return strict JSON only.

Decision logic:
- If the resources affected by the skill are already managed by an existing template/repository target, prefer update_existing.
- If the resources are not managed by an existing template/repository target and the skill is creating new infrastructure, prefer create_new and keep the currently resolved template method.
- If the resources are not managed by an existing template/repository target and the skill is modifying existing infrastructure that is assumed to already exist, prefer method="aws_cli" with changeStrategy="direct_aws_cli". For Azure targets, this means Azure CLI even though the legacy method value is aws_cli.
- Example: enabling logging on an existing S3 bucket that is not managed by any CloudFormation stack should not recommend creating a new CloudFormation stack. That should fall back to direct CLI.
- For Terraform/OpenTofu, if a configured repo is the source of truth, use update_existing against the repo.
- Do not choose aws_cli merely because there is no existing stack/template/repo match. Choose aws_cli only when the change targets an already-existing unmanaged resource and a create-new template path would be invalid or misleading.
- If the environment/workload method is cloudformation, terraform, or opentofu and the skill is simply creating new resources, keep that method.
- Only select selectedStackId from the provided candidateStacks. Never invent a stack id.
- If uncertain whether create_new or direct_aws_cli is correct for an existing unmanaged resource, prefer direct_aws_cli.

Required output fields:
- method
- changeStrategy
- targetType
- selectedStackId
- reason
- planSummary
`;

  try {
    const agent = new Agent({
      name: "BlueprintUpdateStrategyAgent",
      instructions,
      model,
      responseFormat: { type: "json_schema", json_schema: UPDATE_STRATEGY_JSON_SCHEMA },
    });
    const result = await run(agent, [user(JSON.stringify(payload))], {
      maxTurns: 1,
      runConfig: { tracingDisabled: true, reasoning: { effort: "medium" } },
    });
    const raw = extractModelTextOutput(result);
    const parsed = extractJsonStrict(raw);
    const normalized = normalizeUpdateStrategyResult(parsed, {
      fallback,
      candidateStackIds: Array.isArray(candidateStacks)
        ? candidateStacks.map((candidate) => candidate?.stackId).filter(Boolean)
        : [],
    });
    logUpdateStrategy("OUTPUT", {
      raw,
      parsed,
      normalized,
    });
    return normalized;
  } catch {
    logUpdateStrategy("FALLBACK", {
      reason: "LLM update-strategy call failed; using fallback decision.",
      fallback,
    });
    return fallback;
  }
}

export const classifySkillReadOnly = classifyBlueprintReadOnly;
export const analyzeSkillExecution = analyzeBlueprintExecution;
export const recommendSkillExecutionTargets = recommendBlueprintExecutionTargets;
export const determineSkillUpdateStrategy = determineBlueprintUpdateStrategy;
