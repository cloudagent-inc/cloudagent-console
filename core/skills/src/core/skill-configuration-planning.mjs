// Helpers for evaluating and preparing skill execution strategies
// - rewriteSkillForExecution: adjust skill tasks to honor execution preferences and defaults

import OpenAI from "openai";
import { Agent, run, user, extractAllTextOutput } from "@openai/agents";
import {
  OpenAIResponsesModel,
  setDefaultOpenAIKey,
  webSearchTool,
} from "@openai/agents-openai";
import {
  normalizeExecutionMethod,
  normalizeExecutionStackAction,
} from "./skill-execution-context.mjs";
import globals from "@cloudagent/core/global-variables";

const OPENAI_MODEL = globals.OPENAI_MODEL;
const OPENAI_TOKEN = process.env.OPENAI_TOKEN || process.env.OPENAI_API_KEY || "";
if (!OPENAI_TOKEN) {
  console.warn("⚠️ OPENAI_TOKEN is not set – set it in your environment.");
}
setDefaultOpenAIKey(OPENAI_TOKEN || "missing-local-openai-key");
const openai = new OpenAI({ apiKey: OPENAI_TOKEN || "missing-local-openai-key" });
const model = new OpenAIResponsesModel(openai, OPENAI_MODEL);

const DEFAULT_TASK_MAX_TURNS = 50;
const MAX_TASK_MAX_TURNS = 150;


const REWRITE_JSON_SCHEMA = {
  name: "blueprint_execution_rewrite",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["blueprint"],
    properties: {
      blueprint: { type: "object" },
      meta: {
        type: "object",
        additionalProperties: true,
      },
    },
  },
};

function deepClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj ?? {}));
  } catch {
    return {};
  }
}

function extractPhases(blueprint) {
  if (Array.isArray(blueprint?.plan)) return blueprint.plan;
  if (Array.isArray(blueprint?.phases)) return blueprint.phases;
  if (Array.isArray(blueprint?.plan?.plan)) return blueprint.plan.plan;
  if (Array.isArray(blueprint)) return blueprint;
  return [];
}

function summarizeBlueprint(blueprint) {
  const phases = extractPhases(blueprint);
  let tasks = 0;
  for (const phase of phases) {
    if (Array.isArray(phase?.tasks)) {
      tasks += phase.tasks.length;
    }
  }
  return {
    phases: phases.length,
    tasks,
  };
}

function normalizeTaskMaxTurns(value, fallback = DEFAULT_TASK_MAX_TURNS) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_TASK_MAX_TURNS, Math.max(1, parsed));
}

function createTaskMaxTurnsMap(blueprint) {
  const phases = extractPhases(blueprint);
  const taskMaxTurns = new Map();

  for (const phase of phases) {
    if (!Array.isArray(phase?.tasks)) continue;
    for (const task of phase.tasks) {
      if (!task?.id) continue;
      taskMaxTurns.set(task.id, normalizeTaskMaxTurns(task.maxTurns));
    }
  }

  return taskMaxTurns;
}

function normalizeBlueprintTaskMaxTurns(blueprint, fallbackBlueprint = null) {
  const cloned = deepClone(blueprint || {});
  const fallbackTaskMaxTurns = createTaskMaxTurnsMap(fallbackBlueprint);
  const phases = extractPhases(cloned);

  for (const phase of phases) {
    if (!Array.isArray(phase?.tasks)) continue;
    for (const task of phase.tasks) {
      if (!task || typeof task !== "object") continue;
      const fallback =
        task?.id && fallbackTaskMaxTurns.has(task.id)
          ? fallbackTaskMaxTurns.get(task.id)
          : DEFAULT_TASK_MAX_TURNS;
      task.maxTurns = normalizeTaskMaxTurns(task.maxTurns, fallback);
    }
  }

  return cloned;
}

function stripTaskFieldsForRewrite(blueprint) {
  const cloned = normalizeBlueprintTaskMaxTurns(blueprint);
  const phases = extractPhases(cloned);
  for (const phase of phases) {
    if (!Array.isArray(phase?.tasks)) continue;
    for (const task of phase.tasks) {
      if (task && typeof task === "object") {
        delete task.skip_conditions;
        delete task.depends_on;
        delete task.executionPlan;
      }
    }
  }
  return cloned;
}

function stringifyRuntimeValue(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return '""';
    return JSON.stringify(trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed);
  }
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized === "string" && serialized.length > 180) {
      return `${serialized.slice(0, 177)}...`;
    }
    return serialized ?? String(value);
  } catch {
    return String(value);
  }
}

function mergeUniqueLines(existing = [], additions = [], { prepend = false } = {}) {
  const out = [];
  const seen = new Set();
  const push = (line) => {
    if (typeof line !== "string") return;
    const trimmed = line.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(trimmed);
  };

  const normalizedExisting = Array.isArray(existing) ? existing : [];
  const normalizedAdditions = Array.isArray(additions) ? additions : [];

  if (prepend) {
    normalizedAdditions.forEach(push);
    normalizedExisting.forEach(push);
    return out;
  }

  normalizedExisting.forEach(push);
  normalizedAdditions.forEach(push);
  return out;
}

function buildRuntimeOverrideLines({
  executionPreferences = {},
  defaultValues = {},
  regions = [],
  additionalInstructions = null,
  executionContext = null,
} = {}) {
  const lines = [];
  const defaultEntries = Object.entries(defaultValues || {}).filter(
    ([key]) => typeof key === "string" && key.trim()
  );

  if (executionPreferences.useDefaultValuesWithoutConfirmation) {
    lines.push(
      "Runtime override: use supplied default_values without prompting again when this plan needs matching operator input."
    );
  } else if (defaultEntries.length > 0) {
    lines.push(
      "Runtime override: treat supplied default_values as prefilled inputs and use them before asking the user for values that match."
    );
  }

  if (executionPreferences.applyChangesWithoutConfirmation) {
    lines.push(
      "Runtime override: do not stop for an additional final apply/change confirmation unless execution becomes ambiguous or unsafe."
    );
  }

  if (defaultEntries.length > 0) {
    const summarizedDefaults = defaultEntries
      .slice(0, 12)
      .map(([key, value]) => `${key}=${stringifyRuntimeValue(value)}`)
      .join("; ");
    const suffix = defaultEntries.length > 12 ? " ..." : "";
    lines.push(`Runtime override: prefilled values are ${summarizedDefaults}${suffix}.`);
  }

  const normalizedRegions = Array.isArray(regions)
    ? regions.map((region) => String(region || "").trim()).filter(Boolean)
    : [];
  if (normalizedRegions.length > 0) {
    lines.push(
      `Runtime override: keep AWS actions scoped to the selected regions when relevant: ${normalizedRegions.join(", ")}.`
    );
  }

  if (executionContext?.workload?.selected) {
    const workloadLabel = executionContext?.workload?.name || executionContext?.workload?.id || "selected workload";
    lines.push(`Runtime override: keep execution scoped to the selected workload: ${workloadLabel}.`);
  } else if (executionContext?.target?.stackId) {
    lines.push(
      `Runtime override: keep execution scoped to the selected existing stack: ${executionContext.target.stackId}.`
    );
  }

  if (
    executionContext?.delivery?.target &&
    executionContext.delivery.target !== "direct_cloud"
  ) {
    const repoName = executionContext?.delivery?.repo?.fullName || null;
    lines.push(
      repoName
        ? `Runtime override: follow the resolved delivery path ${executionContext.delivery.target} via ${repoName}.`
        : `Runtime override: follow the resolved delivery path ${executionContext.delivery.target}.`
    );
  }

  if (typeof additionalInstructions === "string" && additionalInstructions.trim()) {
    lines.push(
      `Runtime override: follow these additional instructions while executing the plan: ${additionalInstructions.trim()}.`
    );
  }

  return lines;
}

function buildPerTaskRuntimeHint({
  executionPreferences = {},
  defaultValues = {},
  additionalInstructions = null,
  executionContext = null,
} = {}) {
  const hints = [];
  if (executionPreferences.useDefaultValuesWithoutConfirmation || Object.keys(defaultValues || {}).length > 0) {
    hints.push("use supplied default_values before prompting");
  }
  if (executionPreferences.applyChangesWithoutConfirmation) {
    hints.push("skip extra final confirmations that were already waived");
  }
  if (typeof additionalInstructions === "string" && additionalInstructions.trim()) {
    hints.push("honor the additional run instructions");
  }
  if (executionContext?.workload?.selected) {
    hints.push("stay within the selected workload scope");
  } else if (executionContext?.target?.stackId) {
    hints.push("stay within the selected stack scope");
  }
  if (
    executionContext?.delivery?.target &&
    executionContext.delivery.target !== "direct_cloud"
  ) {
    hints.push("follow the resolved delivery path");
  }

  if (!hints.length) return null;
  return `Runtime override: for this task, ${hints.join(", ")}.`;
}

export function applyBlueprintRuntimeSettings({
  blueprint,
  executionPreferences = {},
  defaultValues = {},
  regions = [],
  additionalInstructions = null,
  executionContext = null,
} = {}) {
  const normalizedBlueprint = normalizeBlueprintTaskMaxTurns(blueprint, blueprint);
  const phases = extractPhases(normalizedBlueprint);
  const runtimeOverrideLines = buildRuntimeOverrideLines({
    executionPreferences,
    defaultValues,
    regions,
    additionalInstructions,
    executionContext,
  });
  const perTaskHint = buildPerTaskRuntimeHint({
    executionPreferences,
    defaultValues,
    additionalInstructions,
    executionContext,
  });

  if (!runtimeOverrideLines.length && !perTaskHint) {
    return {
      blueprint: normalizedBlueprint,
      applied: false,
      directives: [],
      taskHint: null,
    };
  }

  let seededPrimaryTask = false;
  for (const phase of phases) {
    if (!Array.isArray(phase?.tasks)) continue;
    for (const task of phase.tasks) {
      if (!task || typeof task !== "object") continue;
      task.executionPlan = Array.isArray(task.executionPlan) ? task.executionPlan : [];
      task.completionCriteria = Array.isArray(task.completionCriteria)
        ? task.completionCriteria
        : [];

      if (perTaskHint) {
        task.executionPlan = mergeUniqueLines(task.executionPlan, [perTaskHint], {
          prepend: true,
        });
      }

      if (!seededPrimaryTask && runtimeOverrideLines.length > 0) {
        task.executionPlan = mergeUniqueLines(task.executionPlan, runtimeOverrideLines, {
          prepend: true,
        });
        task.completionCriteria = mergeUniqueLines(
          task.completionCriteria,
          ["Runtime settings from the run configuration are reflected in this task plan."],
          { prepend: false }
        );
        seededPrimaryTask = true;
      }
    }
  }

  return {
    blueprint: normalizedBlueprint,
    applied: Boolean(seededPrimaryTask || perTaskHint),
    directives: runtimeOverrideLines,
    taskHint: perTaskHint,
  };
}

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

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    try {
      return JSON.parse(text.slice(first, last + 1));
    } catch (_) {}
  }
  return null;
}

export async function rewriteBlueprintForExecution({
  blueprint,
  configurationMode,
  stackAction,
  executionPreferences = {},
  defaultValues = {},
  regions = [],
  additionalInstructions = null,
  existingStack = null,
  existingStacks = [],
  executionContext = null,
  analysis = null,
  validationFeedback = null,
} = {}) {
  const normalizedMode = normalizeExecutionMethod(configurationMode);
  const normalizedStackAction = normalizeExecutionStackAction(stackAction);
  const prefs = {
    useDefaultValuesWithoutConfirmation: Boolean(
      executionPreferences.useDefaultValuesWithoutConfirmation
    ),
    applyChangesWithoutConfirmation: Boolean(
      executionPreferences.applyChangesWithoutConfirmation
    ),
  };

  try {
    const sanitizedBlueprint = stripTaskFieldsForRewrite(blueprint);
    console.log("[REWRITE_INPUT]", {
      configurationMode: normalizedMode,
      stackAction: normalizedStackAction,
      regions: Array.isArray(regions) ? regions : [],
      defaultValuesKeys: defaultValues ? Object.keys(defaultValues) : [],
      prefs,
      blueprintSummary: summarizeBlueprint(sanitizedBlueprint),
      hasAdditionalInstructions: Boolean(additionalInstructions),
      existingStackCount: [
        ...(Array.isArray(existingStacks) ? existingStacks : []),
        ...(existingStack ? [existingStack] : []),
      ].filter(Boolean).length,
      executionContextSummary: executionContext
        ? {
            target: executionContext?.target || null,
            deployment: executionContext?.deployment || null,
            delivery: executionContext?.delivery || null,
            workloadSelected: executionContext?.workload?.selected || false,
          }
        : null,
      hasAnalysis: Boolean(analysis),
      hasValidationFeedback: Boolean(validationFeedback),
    });
  } catch (e) {
    console.warn("[REWRITE_INPUT_LOG_ERROR]", e?.message || e);
  }

  const sanitizedBlueprint = stripTaskFieldsForRewrite(blueprint);

  try {
    console.log("[REWRITE_INPUT_SANITIZED_SUMMARY]", summarizeBlueprint(sanitizedBlueprint));
  } catch (e) {
    console.warn("[REWRITE_INPUT_LOG_ERROR]", e?.message || e);
  }

  const payload = {
    blueprint: sanitizedBlueprint,
    configuration_mode: normalizedMode,
    stack_action: normalizedStackAction,
    regions: Array.isArray(regions) ? regions : [],
    default_values: defaultValues || {},
    execution_preferences: prefs,
    additional_instructions: additionalInstructions,
    existing_stack: existingStack,
    existing_stacks: Array.isArray(existingStacks)
      ? existingStacks.filter((value, index, arr) => value && arr.indexOf(value) === index)
      : [],
    execution_context: executionContext,
    analysis,
    validation_feedback: validationFeedback,
  };

  const instructions = `
You are rewriting a skill to align it with execution preferences, resolved target context, and the chosen configuration method. The agent has these tools:
- aws_cfn_operations: create/update CloudFormation stacks.
- cli_session_command_execute: execute provider CLI commands in the authenticated session (aws for AWS, az for Azure).
- list_github_repos: list GitHub repositories configured for the user.
- read_github_file: read files from a configured GitHub repository.
- write_github_file: create or update files in a configured GitHub repository.
- create_github_branch: create a branch in a configured GitHub repository.
- create_github_pull_request: open a pull request in a configured GitHub repository.
- update_workload: update workload tracked resources, stacks, deployment settings, or other workload metadata after successful changes.

The payload includes execution_context with:
- target selection and scope
- environment deployment preferences
- workload deployment preferences
- workload tracked resources
- resolved delivery path (live environment vs workload repo vs environment repo)
- provider-specific authentication context. For Azure targets, use Azure CLI commands with az and include subscription scope when needed.

The payload may include:
- analysis: the preflight analysis result with rewrite directives
- validation_feedback: deterministic validator findings from a prior rewrite attempt

Goals:
1) For every task, add/update an executionPlan (array of strings):
   - Specify the tool per step:
     • cli_session_command_execute for reading data and for direct cloud CLI configuration changes ONLY when configuration_mode is aws_cli/cloud_cli/azure_cli. Use aws commands for AWS targets and az commands for Azure targets.
     • aws_cfn_operations for configuration changes when configuration_mode is cloudformation.
     • If configuration_mode is terraform or opentofu, do not use aws_cfn_operations for the main implementation path. Use the GitHub tools when execution_context.delivery points to a GitHub-backed repo flow:
       - list_github_repos to confirm the available repository/connection when needed
       - read_github_file to inspect the current Terraform/OpenTofu module, variables, or environment files
       - create_github_branch before making repo changes when a branch/PR workflow is appropriate
       - write_github_file to update Terraform/OpenTofu files
       - create_github_pull_request to submit the change for review
       If the delivery path is repo-based but the specific repo details are already present in execution_context.delivery, use those details directly in the executionPlan instead of adding unnecessary discovery steps.
     • No tool when only prompting the user.   
   - Note execution_preferences flags if they are set to true (useDefaultValuesWithoutConfirmation, applyChangesWithoutConfirmation) when they affect confirmations.
   - If the task is using aws_cfn_operations, include a line to wait for the CloudFormation stack to be created or updated before proceeding to the next task. 
     >> Add a line in the completionCriteria that the stack is created or updated successfully (not only the changeset but the actual stack is created or updated). 
     >> Add a line in the executionPlan to wait for the stack to be created or updated before proceeding to the next task. During this wait period, print a message to the user that the stack is being created or updated and to wait before checking the stack status. (set the status to waiting_on_user_input)
2) For every default_values provided, insert that value into the executionPlan in the relevant task so that the user is not prompted for the value.
3) If configuration_mode is cloudformation, consolidate configuration tasks that can be handled by one template into as few tasks as practical (ideally one). Update ids/titles/descriptions accordingly. Keep separate tasks only when CLI is required or separation is necessary. When consolidating, adjust completionCriteria and executionPlan to reflect the CFN path and reference existing_stack or existing_stacks when provided.
   4) Use execution_context.workload.trackedResources when the selected workload is directly relevant to the skill. General rule: if the skill operates on a resource type or service that is already represented by the selected workload's tracked resources, scope the skill to only those tracked resources. Replace broad environment-wide discovery, listing, filtering, validation, and mutation steps with workload-scoped steps that reference only the tracked resource ids, arns, names, stack ids, or repo paths supplied in execution_context. If the context suggests the skill is environment/account scope instead, do not force workload-tracked scoping into unrelated tasks.
   5) CloudFormation-specific rules:
   - If stack_action is "create", plan for creating a new stack. Do NOT include actions that search for or validate existing stacks for this operation.
   - If stack_action is "update", assume one or more stack ARNs may be provided in existing_stacks. Add explicit executionPlan steps to validate that those stacks currently manage the resources being updated before applying changes. If multiple stacks are provided, plan against the relevant stack or stacks rather than collapsing them into one. Any changes that cannot be performed via CloudFormation must be handled with cli_session_command_execute as separate steps.
   6) When default_values, execution_context, or additional_instructions include details about resources being updated, rewrite assessment tasks to use that provided information. Remove redundant tasks that would otherwise search the full environment for those resources, and instead update completionCriteria and executionPlan to verify the provided resources exist. When workload scoping applies, convert generic "list all", "discover all", or "find all matching" tasks into workload-scoped verification steps against the tracked resources only.
   7) Respect execution_context.delivery:
   - If delivery.target is workload_git_repo or environment_git_repo, the implementation plan should prefer repo changes, PR creation, and pipeline/manual apply steps instead of direct infrastructure mutation.
   - If delivery.deliveryMethod is manual, include a manual review/apply step.
   - If delivery.pipelineConfig.requireApproval is true, include an approval checkpoint in completionCriteria and executionPlan.
   - If configuration_mode is terraform or opentofu and delivery.target is workload_git_repo, environment_git_repo, or manual_repo_change, the executionPlan should explicitly use the GitHub tools for file updates and PR creation when the repo is GitHub-backed, rather than only describing repo work in prose.
   8) If validation_feedback is present, fix the specific validator errors and warnings in the new rewrite.
   9) If analysis.rewriteDirectives is present, follow it. In particular:
      - consolidateConfigTasks
      - injectTrackedResources
      - preferRepoFlow
      - If injectTrackedResources is true and workloadScope.status is fits or partial_fit, explicitly bind relevant tasks to the tracked resources instead of the broader environment.
   10) If execution_context.workload.selected is true and the skill is mutating, add a final task at the end to reconcile workload metadata only when needed:
      - If the run creates, deletes, replaces, attaches, detaches, or materially changes workload-owned resources, stacks, tracked resource identifiers, repo/module locations, deployment settings, or other workload details, add a final task that uses update_workload to persist those changes.
      - If the run does not change any workload-tracked resources, stack information, deployment settings, or workload metadata, do not add this final task.
      - Make the final task conditional on successful prior changes and describe exactly which workload fields need to be updated.
      - For read-only skills, never add a workload update task.
   11) Preserve each task's maxTurns value when the task remains substantially the same. Every rewritten task must include maxTurns as an integer between 1 and 150. Use 50 when no custom value is needed.

Structure requirements:
- Each task must have: id, title, description, completionCriteria (array of strings), executionPlan (array of strings), maxTurns (integer between 1 and 150).
- Keep non-configuration tasks/phases intact unless consolidation is needed for CFN.

Important:
- Always return valid JSON matching the schema: { "blueprint": <rewritten skill>, "meta": { ... } }
- Use web_search when uncertain about CloudFormation support for an action.`;

  const tools = [
    webSearchTool({
      name: "web_search",
      description: "Search the web for AWS/CloudFormation support and behaviors",
    }),
  ];

  // try {
  //   console.log("[REWRITE_PROMPT_INSTRUCTIONS]", instructions);
  //   console.log("[REWRITE_PROMPT_PAYLOAD]", JSON.stringify(payload));
  // } catch (err) {
  //   console.warn("[REWRITE_PROMPT_LOG_ERROR]", err?.message || err);
  // }

  const agent = new Agent({
    name: "BlueprintRewriteAgent",
    instructions,
    model,
    tools,
    responseFormat: { type: "json_schema", json_schema: REWRITE_JSON_SCHEMA },
  });

  try {
    const result = await run(agent, [user(JSON.stringify(payload))], {
      maxTurns: 12,
      runConfig: { tracingDisabled: true, reasoning: { effort: "high" } },
    });

    const textCandidates = [];
    const pushText = (val) => {
      if (typeof val === "string" && val.trim()) textCandidates.push(val);
    };
    const tryBlocks = (blocks) => {
      if (!blocks || !Array.isArray(blocks) || !blocks.length) return;
      try {
        const txt = extractAllTextOutput(blocks);
        pushText(txt);
      } catch (e) {
        console.warn("[REWRITE_PARSE_BLOCKS_WARN]", e?.message || e);
      }
    };

    tryBlocks(result?.output);
    tryBlocks(result?.history);
    tryBlocks(result?.state?._lastTurnResponse?.output);
    tryBlocks(result?.state?._generatedItems);
    pushText(result?.state?._currentStep?.output);
    pushText(result?.output_text);

    const raw = textCandidates.find((s) => s.trim().length) || "";
    const parsed =
      extractJsonStrict(raw) ||
      result?.output?.[0]?.content?.[0]?.json ||
      result?.output?.[0]?.content?.[0]?.text ||
      extractJsonStrict(result?.state?._currentStep?.output || "") ||
      {};

    const rewrittenBlueprint = normalizeBlueprintTaskMaxTurns(
      parsed?.blueprint && typeof parsed.blueprint === "object"
        ? parsed.blueprint
        : blueprint,
      blueprint
    );

    return {
      blueprint: rewrittenBlueprint,
      meta: parsed?.meta || { note: "rewrite agent fallback" },
      raw,
    };
  } catch (err) {
    try {
      console.error("[REWRITE_RUN_ERROR]", err?.message || err, err?.stack);
    } catch (_) {}
    return {
      blueprint: normalizeBlueprintTaskMaxTurns(blueprint),
      meta: {
        error: err?.message || "Rewrite failed",
        appliedMode: normalizedMode,
        appliedStackAction: normalizedStackAction,
        appliedPreferences: prefs,
        regions: Array.isArray(regions) ? regions : [],
        defaultValuesProvided: !!defaultValues && Object.keys(defaultValues).length > 0,
        additionalInstructions: additionalInstructions || null,
        existingStack,
      },
    };
  }
}

export const applySkillRuntimeSettings = applyBlueprintRuntimeSettings;
export const rewriteSkillForExecution = rewriteBlueprintForExecution;
