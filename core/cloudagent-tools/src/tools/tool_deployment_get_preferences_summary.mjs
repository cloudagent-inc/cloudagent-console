import { tool } from "@openai/agents";
import { z } from "zod";

import {
  formatDeploymentPreferencesSummary,
  formatGithubGovernanceSummaryLines,
} from "../services/deployment-preferences.mjs";
import { resolveGithubGovernanceConfig } from "../services/github-governance.mjs";
import { logStart, logEnd } from "../util/logging.mjs";

export function createGetDeploymentPreferencesSummaryTool({ accountsService }) {
  if (!accountsService?.getPermissionProfileDefaults || !accountsService?.getAccountDefaults) {
    throw new Error(
      "accountsService.getPermissionProfileDefaults and accountsService.getAccountDefaults are required"
    );
  }

  return tool({
    name: "get_deployment_preferences_summary",
    description:
      "Return a concise, human-readable summary of user deployment preferences for a target environment. Prefer permissionProfileId; AWS account ID is only needed when directly targeting an AWS account.",
    parameters: z.object({
      userId: z.string(),
      accountId: z.string().nullable().optional(),
      permissionProfileId: z.string().nullable().optional()
    }).strict(),

    async execute({ userId, accountId, permissionProfileId }) {
      logStart("get_deployment_preferences_summary", { userId, accountId, permissionProfileId });
      try {
        const defaults = permissionProfileId
          ? await accountsService.getPermissionProfileDefaults(userId, permissionProfileId)
          : await accountsService.getAccountDefaults(userId, accountId);
        const { deploymentPreferences = {}, authProfile = null } = defaults;
        const { github, source: githubGovernanceSource } = resolveGithubGovernanceConfig({
          environmentGithub: deploymentPreferences?.github || null,
        });
        const summaryParts = [formatDeploymentPreferencesSummary(deploymentPreferences)];
        const githubLines = formatGithubGovernanceSummaryLines(github, githubGovernanceSource);
        if (githubLines.length) summaryParts.push(githubLines.join("\n"));
        const summary = summaryParts.join("\n");
        const out = {
          userId,
          accountId: accountId || authProfile?.awsAccountId || null,
          permissionProfileId: permissionProfileId || authProfile?.permissionProfileId || null,
          summary,
          deploymentPreferences,
          github,
          githubGovernanceSource
        };
        logEnd("get_deployment_preferences_summary", out);
        return out;
      } catch (error) {
        const out = { ok: false, error: error?.message || String(error) };
        logEnd("get_deployment_preferences_summary", out);
        throw error;
      }
    }
  });
}
