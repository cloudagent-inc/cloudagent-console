import { buildSummaryInsights, buildTrackedResourcesInsight, sanitizeSummaryForAgent } from "./insights-availability.mjs";

export const WORKLOAD_ADDITIONAL_DETAIL_FIELDS = Object.freeze([
  "deploymentPreferences",
  "securityRules",
  "trackedResources",
  "summary"
]);

function safeParseJson(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value !== "string") return {};
  try {
    return JSON.parse(value) || {};
  } catch {
    return {};
  }
}

function formatMethodLabel(method) {
  switch (method) {
    case "cloudformation":
      return "CloudFormation";
    case "terraform":
      return "Terraform";
    case "opentofu":
      return "OpenTofu";
    case "aws_cli":
      return "AWS CLI";
    default:
      return null;
  }
}

function summarizeDeploymentPreferences(workload) {
  const dp = safeParseJson(workload?.deploymentPreferences);
  const lines = [];

  const methodLabel = formatMethodLabel(dp?.method);
  if (methodLabel) {
    lines.push(`Use ${methodLabel} for infrastructure updates.`);
  } else {
    lines.push("Infrastructure update method is not set.");
  }

  const gitRepo = dp?.gitRepo || {};
  if (gitRepo?.fullName) {
    const branchText = gitRepo?.branch ? ` (base ${gitRepo.branch})` : "";
    lines.push(`Update via GitHub PRs in ${gitRepo.fullName}${branchText}.`);
  } else {
    lines.push("Update directly in the cloud environment (no repo linked).");
  }

  const isTerraform = dp?.method === "terraform" || dp?.method === "opentofu";
  if (isTerraform) {
    if (dp?.stateSource === "s3") {
      const bucket = dp?.stateBucket ? dp.stateBucket : "(bucket not set)";
      lines.push(`State source: S3 bucket ${bucket}.`);
    } else {
      lines.push("State source is not set.");
    }
  }

  switch (dp?.deliveryMethod) {
    case "github_actions":
      lines.push("Deployment flow is not set.");
      break;
    case "manual":
      lines.push("Deployment flow: manual execution required.");
      break;
    default:
      lines.push("Deployment flow: pipeline is configured to automatically push the change, ask user to check their pipeline status.");
      break;
  }

  if (dp?.deliveryMethod && dp.deliveryMethod !== "manual") {
    const pipeline = dp?.pipelineConfig || {};
    const autoDeploy =
      pipeline?.autoDeploy !== undefined ? !!pipeline.autoDeploy : true;
    const requireApproval = !!pipeline?.requireApproval;
    const pipelineBranch = pipeline?.branch;
    lines.push(
      `Pipeline trigger: ${autoDeploy ? "automatic" : "manual"} execution.`
    );
    if (requireApproval) {
      lines.push("Pipeline requires an approval step before deployment.");
    }
    if (pipelineBranch) {
      lines.push(`Pipeline watches branch ${pipelineBranch}.`);
    }
  }

  if (dp?.method === "cloudformation") {
    if (dp?.changeSet === true) {
      lines.push("CloudFormation updates require a change set review.");
    } else if (dp?.changeSet === false) {
      lines.push("CloudFormation updates can be applied directly.");
    }
  }

  if (dp?.method === "aws_cli") {
    lines.push("Infrastructure updates are executed via direct cloud CLI commands.");
  }

  return {
    summary: lines.join(" "),
    lines,
  };
}

export function summarizeWorkloadDeployment(workload) {
  return summarizeDeploymentPreferences(workload);
}

export function stripWorkloadDetails(workload, { includeDetails = false } = {}) {
  if (!workload) return workload;
  const {
    deploymentPreferences,
    securityRules,
    trackedResources,
    summary: workloadSummary,
    ...rest
  } = workload;
  const summary = summarizeDeploymentPreferences(workload);
  const out = {
    ...rest,
    deploymentSummary: summary.summary,
    availableDetails: [...WORKLOAD_ADDITIONAL_DETAIL_FIELDS],
    availableInsights: {
      ...buildSummaryInsights(workloadSummary),
      trackedResources: buildTrackedResourcesInsight(trackedResources)
    },
    detailHints: {
      workload:
        "Use get_workload to fetch full workload details."
    }
  };
  if (includeDetails) {
    out.deploymentPreferences = deploymentPreferences;
    out.securityRules = securityRules;
    out.trackedResources = trackedResources;
    out.summary = sanitizeSummaryForAgent(workloadSummary);
  }
  return out;
}
