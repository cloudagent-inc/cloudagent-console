import { tool } from "@openai/agents";
import { z } from "zod";
import { getUserId } from "../util/run-context.mjs";
import { logStart, logEnd } from "../util/logging.mjs";
import { toPermissionProfileView } from "../services/permission-profile-views.mjs";

function isSamePermissionProfileId(profile = {}, permissionProfileId = "") {
  const target = String(permissionProfileId || "").trim();
  if (!target) return false;
  return (
    String(profile?.recordId || "").trim() === target ||
    String(profile?.id || "").trim() === target ||
    String(profile?.permissionProfileId || "").trim() === target
  );
}

function accountToProfileLike(account = {}) {
  return {
    recordId: account?.permissionProfileId || account?.recordId || null,
    permissionProfileId: account?.permissionProfileId || account?.recordId || null,
    name: account?.alias ?? null,
    type: account?.type ?? "aws account",
    createdAt: account?.createdAt ?? null,
    updatedAt: account?.updatedAt ?? null,
    authProfile: account?.authProfile ?? {},
    deploymentPreferences: account?.accountDefaults?.deploymentPreferences ?? {},
    securityRules: account?.accountDefaults?.securityRules ?? {},
    summary: account?.summary ?? null
  };
}

export function createGetPermissionProfileTool({ accountsService }) {
  if (!accountsService?.loadAccountsForUser) {
    throw new Error("accountsService.loadAccountsForUser is required");
  }
  if (!accountsService?.fetchPermissionProfiles) {
    throw new Error("accountsService.fetchPermissionProfiles is required");
  }

  return tool({
    name: "get_permission_profile",
    description:
      "Fetch a single permission profile by ID. Returns full permission profile details plus deploymentSummary and availableInsights.",
    parameters: z.object({
      permissionProfileId: z.string().min(1),
      forceRefresh: z.boolean().nullable().optional()
    }).strict(),

    async execute({ permissionProfileId, forceRefresh }, runContext) {
      const userId = getUserId(runContext);
      const wantFresh = !!forceRefresh;
      logStart("get_permission_profile", {
        userId,
        permissionProfileId,
        forceRefresh: wantFresh
      });

      try {
        if (!wantFresh) {
          const payload = await accountsService.loadAccountsForUser({
            userId,
            forceRefresh: false
          });
          const match = Array.isArray(payload?.accounts)
            ? payload.accounts.find((account) =>
              isSamePermissionProfileId(
                {
                  recordId: account?.permissionProfileId || account?.recordId,
                  permissionProfileId: account?.permissionProfileId || account?.recordId
                },
                permissionProfileId
              )
            )
            : null;

          if (match) {
            const out = {
              ok: true,
              source: payload?.source || "cache",
              permissionProfile: toPermissionProfileView(accountToProfileLike(match), { includeDetails: true })
            };
            logEnd("get_permission_profile", out);
            return out;
          }
        }

        const profiles = await accountsService.fetchPermissionProfiles(userId);
        const match = Array.isArray(profiles)
          ? profiles.find((profile) => {
            if (profile?.type === "jira" || profile?.type === "github") return false;
            return isSamePermissionProfileId(profile, permissionProfileId);
          })
          : null;

        if (!match) {
          const out = {
            ok: false,
            error: "Permission profile not found",
            permissionProfileId
          };
          logEnd("get_permission_profile", out);
          return out;
        }

        const out = {
          ok: true,
          source: "accounts_service",
          permissionProfile: toPermissionProfileView(match, { includeDetails: true })
        };
        logEnd("get_permission_profile", out);
        return out;
      } catch (error) {
        const out = { ok: false, error: error?.message || String(error) };
        logEnd("get_permission_profile", out);
        throw error;
      }
    }
  });
}
