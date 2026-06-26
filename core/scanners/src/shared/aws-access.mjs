import AWS from "aws-sdk";

function toExpirationDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function updateAwsSdkV2Credentials(target, credentials) {
  target.accessKeyId = credentials.accessKeyId || credentials.AccessKeyId;
  target.secretAccessKey = credentials.secretAccessKey || credentials.SecretAccessKey;
  target.sessionToken = credentials.sessionToken || credentials.SessionToken;
  target.expireTime = toExpirationDate(credentials.expiration || credentials.Expiration) || undefined;
  target.expired = false;
}

function createAwsSdkV2CredentialAdapter(provider) {
  const credentials = new AWS.Credentials({
    accessKeyId: "pending",
    secretAccessKey: "pending",
    sessionToken: "pending",
  });
  credentials.expired = true;

  credentials.refresh = (callback) => {
    provider
      .refresh()
      .then((refreshed) => {
        updateAwsSdkV2Credentials(credentials, refreshed);
        callback?.();
      })
      .catch((error) => callback?.(error));
  };

  credentials.get = (callback) => {
    provider()
      .then((current) => {
        updateAwsSdkV2Credentials(credentials, current);
        callback?.();
      })
      .catch((error) => callback?.(error));
  };

  return credentials;
}

export function toAwsSdkV2Credentials(credentials) {
  if (typeof credentials === "function" && credentials.awsSdkV2Credentials) {
    return credentials.awsSdkV2Credentials;
  }
  if (typeof credentials === "function") return createAwsSdkV2CredentialAdapter(credentials);
  return credentials;
}

