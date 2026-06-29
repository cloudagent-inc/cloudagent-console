import { tool } from "@openai/agents";
import { z } from "zod";

import { getUserId } from "../util/run-context.mjs";
import { logStart, logEnd } from "../util/logging.mjs";
import { toPermissionProfileView } from "../services/permission-profile-views.mjs";

function normalizeType(value) {
  return String(value || "").trim().toLowerCase().replace(/_/g, " ");
}

export function createListPermissionProfilesTool({ accountsService }) {
  if (!accountsService?.loadAccountsForUser) {
    throw new Error("accountsService.loadAccountsForUser is required");
  }

  return tool({
    name: "permission_profile_list",
    description:
      "List onboarded cloud environments of all supported types. Returns permission profiles for AWS accounts, Azure tenants, Azure subscriptions, Google Workspace environments, and other connected environment types. Use the type field to filter by provider/environment type.",
    parameters: z
      .object({
        type: z
          .string()
          .nullable()
          .optional()
          .describe("Optional onboarded cloud environment type filter, e.g. 'aws account', 'azure subscription', 'azure tenant', 'google_workspace'."),
        forceRefresh: z.boolean().nullable().optional(),
      })
      .strict(),

    async execute({ type, forceRefresh }, runContext) {
      const userId = getUserId(runContext);
      const wantFresh = !!forceRefresh;
      const typeFilter = normalizeType(type);
      logStart("permission_profile_list", { userId, type: typeFilter || null, forceRefresh: wantFresh });

      try {
        const payload = await accountsService.loadAccountsForUser({
          userId,
          forceRefresh: wantFresh,
        });
        const permissionProfiles = (Array.isArray(payload?.accounts) ? payload.accounts : [])
          .filter((account) => {
            if (!typeFilter) return true;
            return normalizeType(account?.type) === typeFilter;
          })
          .map((account) => {
            const profileLike = {
              recordId: account?.permissionProfileId || account?.recordId || null,
              name: account?.alias ?? null,
              type: account?.type ?? null,
              createdAt: account?.createdAt ?? null,
              updatedAt: account?.updatedAt ?? null,
              authProfile: account?.authProfile ?? {},
              deploymentPreferences: account?.accountDefaults?.deploymentPreferences ?? {},
              securityRules: account?.accountDefaults?.securityRules ?? {},
              summary: account?.summary ?? null,
            };
            return toPermissionProfileView(profileLike, { includeDetails: false });
          });

        const out = {
          userId,
          source: payload?.source || "unknown",
          count: permissionProfiles.length,
          permissionProfiles,
        };
        logEnd("permission_profile_list", out);
        return out;
      } catch (error) {
        const out = { ok: false, error: error?.message || String(error) };
        logEnd("permission_profile_list", out);
        throw error;
      }
    },
  });
}
