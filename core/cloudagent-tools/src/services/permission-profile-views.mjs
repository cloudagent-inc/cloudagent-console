import { buildSummaryInsights, sanitizeSummaryForAgent } from "./insights-availability.mjs";
import { summarizeWorkloadDeployment } from "./workload-summaries.mjs";

export const PERMISSION_PROFILE_ADDITIONAL_DETAIL_FIELDS = Object.freeze([
  "authProfile",
  "deploymentPreferences",
  "securityRules",
  "summary"
]);

function safeTrim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseAuthProfile(raw) {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return { ...raw };
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeId(profile = {}) {
  return profile.recordId || profile.id || profile.permissionProfileId || null;
}

export function toPermissionProfileView(
  profile,
  { includeDetails = false } = {}
) {
  if (!profile || typeof profile !== "object") return profile;

  const authProfile = parseAuthProfile(profile.authProfile);
  const permissionProfileId = normalizeId(profile);
  const accountId =
    safeTrim(authProfile.awsAccountId) ||
    safeTrim(authProfile.subscriptionId) ||
    safeTrim(authProfile.accountId) ||
    null;
  const provider = safeTrim(authProfile.provider) || null;
  const deploymentSummary = summarizeWorkloadDeployment({
    deploymentPreferences: profile.deploymentPreferences
  })?.summary;

  const out = {
    permissionProfileId,
    recordId: profile.recordId ?? null,
    name: profile.name ?? null,
    type: profile.type ?? null,
    accountId,
    provider,
    createdAt: profile.createdAt ?? null,
    updatedAt: profile.updatedAt ?? null,
    deploymentSummary: deploymentSummary || null,
    availableDetails: [...PERMISSION_PROFILE_ADDITIONAL_DETAIL_FIELDS],
    authProfileSummary: {
      awsAccountId: safeTrim(authProfile.awsAccountId) || null,
      subscriptionId: safeTrim(authProfile.subscriptionId) || null,
      tenantId: safeTrim(authProfile.tenantId) || null,
      provider,
      hasClientSecret: Boolean(authProfile.clientSecret)
    },
    availableInsights: buildSummaryInsights(profile.summary),
    detailHints: {
      permissionProfile:
        "Use get_permission_profile to fetch full permission profile details."
    }
  };

  if (includeDetails) {
    out.authProfile = authProfile;
    out.deploymentPreferences = profile.deploymentPreferences ?? {};
    out.securityRules = profile.securityRules ?? {};
    out.summary = sanitizeSummaryForAgent(profile.summary);
  }

  return out;
}
