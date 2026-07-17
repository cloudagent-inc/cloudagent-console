function extractPhases(blueprint) {
  if (Array.isArray(blueprint?.plan)) return blueprint.plan;
  if (Array.isArray(blueprint?.plan?.plan)) return blueprint.plan.plan;
  if (Array.isArray(blueprint)) return blueprint;
  return [];
}

function collectTaskErrors(task, phaseIndex, taskIndex) {
  const errors = [];
  if (!task?.id) errors.push(`Missing task id at phase ${phaseIndex} task ${taskIndex}.`);
  if (!task?.title) errors.push(`Missing task title for ${task?.id || `${phaseIndex}.${taskIndex}`}.`);
  if (!task?.description) errors.push(`Missing task description for ${task?.id || `${phaseIndex}.${taskIndex}`}.`);
  if (!Array.isArray(task?.completionCriteria)) {
    errors.push(`Missing completionCriteria array for ${task?.id || `${phaseIndex}.${taskIndex}`}.`);
  }
  if (!Array.isArray(task?.executionPlan)) {
    errors.push(`Missing executionPlan array for ${task?.id || `${phaseIndex}.${taskIndex}`}.`);
  }
  return errors;
}

function taskText(task) {
  return [
    task?.title || "",
    task?.description || "",
    ...(Array.isArray(task?.completionCriteria) ? task.completionCriteria : []),
    ...(Array.isArray(task?.executionPlan) ? task.executionPlan : []),
  ]
    .join(" ")
    .toLowerCase();
}

export function validateRewrittenBlueprint({
  blueprint,
  executionContext = null,
  analysis = null,
} = {}) {
  const phases = extractPhases(blueprint);
  const errors = [];
  const warnings = [];

  if (!Array.isArray(phases) || phases.length === 0) {
    return {
      ok: false,
      errors: ["Rewritten skill does not contain a valid plan array."],
      warnings,
    };
  }

  phases.forEach((phase, phaseIndex) => {
    const tasks = Array.isArray(phase?.tasks) ? phase.tasks : [];
    if (!Array.isArray(phase?.tasks)) {
      errors.push(`Phase ${phaseIndex} is missing a tasks array.`);
      return;
    }
    tasks.forEach((task, taskIndex) => {
      errors.push(...collectTaskErrors(task, phaseIndex, taskIndex));
    });
  });

  const allTasks = phases.flatMap((phase) => (Array.isArray(phase?.tasks) ? phase.tasks : []));
  const allText = allTasks.map(taskText).join(" ");

  if (analysis?.isMutating && !executionContext?.deployment?.resolvedMethod) {
    errors.push("Mutating skill rewrite is missing a resolved deployment method.");
  }

  if (
    executionContext?.delivery?.target &&
    ["workload_git_repo", "environment_git_repo", "manual_repo_change"].includes(executionContext.delivery.target) &&
    !/(repo|pull request|pr|branch|pipeline|manual apply|manual review)/.test(allText)
  ) {
    errors.push("Repo-driven delivery was resolved but the rewritten skill does not mention repo or pipeline flow.");
  }

  if (
    executionContext?.deployment?.resolvedMethod === "cloudformation" &&
    executionContext?.deployment?.stackAction === "update" &&
    !/(existing stack|validate.*stack|current stack|update stack)/.test(allText)
  ) {
    warnings.push("CloudFormation update flow does not clearly mention validating or updating the existing stack.");
  }

  if (
    analysis?.rewriteDirectives?.injectTrackedResources &&
    executionContext?.workload?.selected &&
    (executionContext?.workload?.trackedResources?.resources?.length || executionContext?.workload?.trackedResources?.stacks?.length || 0) > 0 &&
    !/(tracked resource|tracked stack|workload resource|scope to the workload)/.test(allText)
  ) {
    warnings.push("Tracked resource scoping was expected but is not clearly reflected in the rewritten skill.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

export const validateRewrittenSkill = validateRewrittenBlueprint;
