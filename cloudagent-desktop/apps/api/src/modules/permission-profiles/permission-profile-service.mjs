import { parseStoredObject } from "@cloudagent/storage";
import { validateAwsCredentials } from "../cloud-setup/aws-discovery.mjs";

export function getCredentialType(authProfile = {}) {
  const authType = String(authProfile.authType || authProfile.credentialMode || "").trim();
  if (authType === "aws-sso") return "aws-sso";
  if (authType === "static-credentials") return "static-credentials";
  if (authProfile.accessKeyId && authProfile.secretAccessKey) return "static-credentials";
  if (authProfile.awsProfile || authProfile.profileName || authProfile.profile) return "profile";
  return "unknown";
}

export function credentialRemediation({ authProfile = {}, code } = {}) {
  const profile = String(authProfile.awsProfile || authProfile.profileName || authProfile.profile || "").trim();
  if (code === "AWS_SSO_LOGIN_REQUIRED") {
    return profile
      ? `Run: aws sso login --profile ${profile}`
      : "Run aws sso login for the selected AWS SSO profile.";
  }
  if (code === "AWS_PROFILE_NOT_FOUND") {
    return "Choose an existing AWS profile from ~/.aws/config or ~/.aws/credentials, or update this environment to use access keys.";
  }
  if (code === "AWS_TOKEN_EXPIRED") {
    return profile
      ? `Refresh the session for profile ${profile}, then recheck credentials.`
      : "Refresh the AWS session token, then recheck credentials.";
  }
  if (code === "AWS_STATIC_CREDENTIALS_INVALID") {
    return "Update the access key ID, secret access key, and session token if one is required.";
  }
  if (code === "AWS_ACCOUNT_MISMATCH") {
    return "Update the configured AWS account ID or choose credentials for the configured account.";
  }
  return "Open Cloud Setup, update the credentials, then recheck this environment.";
}

export function classifyCredentialError(error, authProfile = {}) {
  const rawMessage = error?.message || String(error || "Failed to validate AWS credentials.");
  let code = "AWS_CREDENTIALS_INVALID";
  let message = rawMessage;

  if (/resolved to account .* configured for/i.test(rawMessage)) {
    code = "AWS_ACCOUNT_MISMATCH";
    message = rawMessage;
  } else if (/sso|token.*expired|session.*expired|login/i.test(rawMessage)) {
    code = "AWS_SSO_LOGIN_REQUIRED";
    message = "AWS SSO session needs login or refresh.";
  } else if (/profile .*not.*found|could not.*profile|config profile.*not.*found/i.test(rawMessage)) {
    code = "AWS_PROFILE_NOT_FOUND";
    message = "AWS profile was not found in the local AWS config files.";
  } else if (/expiredtoken|security token.*expired|token.*expired|expired/i.test(rawMessage)) {
    code = "AWS_TOKEN_EXPIRED";
    message = "AWS session token is expired.";
  } else if (/invalidclienttokenid|signaturedoesnotmatch|invalid.*access|unrecognizedclient|access key/i.test(rawMessage)) {
    code = "AWS_STATIC_CREDENTIALS_INVALID";
    message = "AWS access keys or session token are invalid.";
  } else if (/could not be loaded from any providers|credential/i.test(rawMessage)) {
    code = "AWS_CREDENTIALS_UNAVAILABLE";
    message = "AWS credentials could not be resolved.";
  }

  return {
    ok: false,
    lastCheckedValid: false,
    status: "invalid",
    code,
    message,
    remediation: credentialRemediation({ authProfile, code }),
    checkedAt: new Date().toISOString(),
    lastCheckedAt: new Date().toISOString(),
    credentialType: getCredentialType(authProfile),
  };
}

export async function validatePermissionProfileCredentials({ store, profile }) {
  const authProfile = parseStoredObject(profile?.authProfile, {});
  const normalizedType = String(profile?.type || "").trim().toLowerCase().replace(/_/g, " ");
  const provider = String(authProfile.provider || "").trim().toLowerCase();

  if (normalizedType !== "aws account" && provider !== "aws") {
    const status = {
      ok: true,
      lastCheckedValid: true,
      status: "not_applicable",
      code: "NOT_APPLICABLE",
      message: "Credential validation is only enabled for local AWS accounts.",
      checkedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      credentialType: getCredentialType(authProfile),
    };
    return store.updatePermissionProfile(profile.recordId, { credentialStatus: status });
  }

  try {
    const result = await validateAwsCredentials({
      authProfile,
      region: authProfile.region || authProfile.defaultRegion,
    });
    const expectedAccountId = String(authProfile.awsAccountId || authProfile.accountId || "").trim();
    if (expectedAccountId && result.accountId && expectedAccountId !== result.accountId) {
      throw new Error(`AWS credentials resolved to account ${result.accountId}, but this environment is configured for ${expectedAccountId}.`);
    }
    const status = {
      ok: true,
      lastCheckedValid: true,
      status: "valid",
      code: result.code || "SUCCESS",
      message: result.message || "AWS credentials are valid.",
      accountId: result.accountId || null,
      arn: result.arn || null,
      checkedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      credentialType: getCredentialType(authProfile),
    };
    return store.updatePermissionProfile(profile.recordId, { credentialStatus: status });
  } catch (error) {
    const status = classifyCredentialError(error, authProfile);
    return store.updatePermissionProfile(profile.recordId, { credentialStatus: status });
  }
}

export async function validateStoredPermissionProfiles({ store, recordId = null } = {}) {
  const profiles = recordId
    ? [await store.getPermissionProfile(recordId)].filter(Boolean)
    : await store.listPermissionProfiles();
  const results = await Promise.all(
    profiles.map((profile) => validatePermissionProfileCredentials({ store, profile }))
  );
  return results.filter(Boolean);
}

export function isAwsCredentialBackedLocalProfile(profile, authProfile = null) {
  const parsedAuthProfile = authProfile || parseStoredObject(profile?.authProfile, {});
  const normalizedType = String(profile?.type || "").trim().toLowerCase().replace(/_/g, " ");
  const provider = String(parsedAuthProfile?.provider || "").trim().toLowerCase();
  return normalizedType === "aws account" || provider === "aws";
}

export function getLocalCredentialRunBlocker(profile, authProfile = null) {
  if (!profile || !isAwsCredentialBackedLocalProfile(profile, authProfile)) return null;
  const status = profile.credentialStatus || profile.localCredentialStatus || null;
  const isValid =
    status?.lastCheckedValid === true ||
    status?.ok === true ||
    String(status?.status || "").trim().toLowerCase() === "valid";
  if (isValid) return null;
  const message =
    [status?.message, status?.remediation].filter(Boolean).join(" ") ||
    "AWS credentials have not been checked or are invalid. Recheck this environment in Cloud Setup.";
  return {
    code: status?.code || "AWS_CREDENTIALS_NOT_VALIDATED",
    message,
    status: status?.status || "invalid",
    credentialStatus: status,
  };
}

export async function findPermissionProfileForAuthProfile(store, authProfile = {}) {
  const permissionProfileId =
    authProfile?.permissionProfileId ||
    authProfile?.recordId ||
    authProfile?.id ||
    null;
  if (permissionProfileId) {
    const profile = await store.getPermissionProfile(permissionProfileId);
    if (profile) return profile;
  }
  const accountId = String(authProfile?.awsAccountId || authProfile?.accountId || "").trim();
  if (!accountId) return null;
  const profiles = await store.listPermissionProfiles();
  return profiles.find((profile) => {
    const parsed = parseStoredObject(profile?.authProfile, {});
    return String(parsed.awsAccountId || parsed.accountId || "").trim() === accountId;
  }) || null;
}
