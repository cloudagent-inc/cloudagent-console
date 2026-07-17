export function formatDeploymentPreferencesSummary(dp = {}) {
  const lines = [];

  const deployMethod = dp.method || dp.deploymentMethod;
  if (deployMethod) {
    lines.push(`• Preferred deployment method: ${deployMethod}`);
  }

  if (Array.isArray(dp.defaultStacks) && dp.defaultStacks.length) {
    const stacks = dp.defaultStacks.map(s => s?.name || s?.stackName || s).filter(Boolean).join(", ");
    lines.push(`• Preferred stacks for deployment: ${stacks}`);
  }

  if (Array.isArray(dp.regions) && dp.regions.length) {
    lines.push(`• Preferred AWS regions: ${dp.regions.join(", ")}`);
  }

  const vpcPref = dp.vpcPreference || dp.vpcPreferences;
  if (vpcPref?.useExisting) {
    const preferred = Array.isArray(vpcPref.preferredVpcIds) ? vpcPref.preferredVpcIds.join(", ") : "(not specified)";
    lines.push(`• Use existing VPCs instead of creating new VPCs. Preferred VPCs: ${preferred}`);
  }

  if (Array.isArray(dp.requiredTags) && dp.requiredTags.length) {
    lines.push(`• Use the following Tags for new resources created: ${JSON.stringify(dp.requiredTags)}`);
  }

  const archPrefs = dp.architecturePreferences || dp.architectedPreferences || null;
  if (archPrefs && typeof archPrefs === "object") {
    const entries = Object.entries(archPrefs)
      .filter(([, v]) => String(v).toLowerCase() !== "no preference");
    if (entries.length) {
      lines.push("• Architecture Preferences (when relevant):");
      for (const [k, v] of entries) {
        lines.push(`  - ${k}: ${v}`);
      }
    }
  }

  if (!lines.length) return "• No specific deployment preferences found for this account.";
  return lines.join("\n");
}

// Render the effective GitHub governance so external CLI agents understand
// the deterministic guardrails enforced by the github tools.
export function formatGithubGovernanceSummaryLines(github = {}, source = null) {
  if (!github || typeof github !== "object") return [];
  const lines = [`• GitHub governance${source ? ` (source: ${source})` : ""}:`];
  lines.push(`  - Delivery mode: ${github.mode || "pr_only"} (open pull requests; never push directly to protected branches)`);
  if (Array.isArray(github.protectedBranches) && github.protectedBranches.length) {
    lines.push(`  - Protected branches: ${github.protectedBranches.join(", ")}`);
  }
  if (github.branchPrefix) {
    lines.push(`  - Required branch prefix: ${github.branchPrefix}`);
  }
  if (github.draftPrs) {
    lines.push("  - Pull requests are created as drafts.");
  }
  return lines;
}
