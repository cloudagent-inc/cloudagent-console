import {
  IAMClient,
  ListRolesCommand,
  GetRoleCommand,
  ListRoleTagsCommand,
} from "@aws-sdk/client-iam";
import { DEFAULT_REGION, extractAccountIdFromArn, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "IAM";
const ROLE_RESOURCE_TYPE = "AWS::IAM::Role";

function createIamClient(credentials) {
  const config = {
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new IAMClient(config);
}

export async function scanIamResources(options = {}) {
  return scanIamRoles({ ...options, resourceType: ROLE_RESOURCE_TYPE });
}

async function scanIamRoles({
  logger,
  syncedAt,
  accountId,
  credentials,
  roleNames,
  resourceType,
} = {}) {
  const client = createIamClient(credentials);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const filteredRoleNames = Array.isArray(roleNames)
    ? [...new Set(roleNames.map((name) => name?.trim()).filter(Boolean))]
    : [];
  const hasFilter = filteredRoleNames.length > 0;

  if (hasFilter) {
    for (const roleName of filteredRoleNames) {
      await describeRole({
        client,
        roleName,
        logger,
        accountId,
        lastSynced,
        resources,
        errors,
        resourceType,
      });
    }

    return {
      service: SERVICE_LABEL,
      regions: [DEFAULT_REGION],
      resources,
      errors,
      lastSynced,
    };
  }

  let Marker = undefined;
  do {
    try {
      const response = await client.send(new ListRolesCommand({ Marker }));
      const roles = response?.Roles || [];
      for (const role of roles) {
        const tags = await listRoleTags({ client, roleName: role.RoleName, logger });
        pushRoleResource({ role, tags, accountId, lastSynced, resources, resourceType });
      }
      Marker = response?.Marker;
    } catch (error) {
      errors.push({
        message: error?.message || "Failed to list IAM roles",
      });
      logger?.warn?.("[scanner:iam] ListRoles failed", { error });
      break;
    }
  } while (Marker);

  return {
    service: SERVICE_LABEL,
    regions: [DEFAULT_REGION],
    resources,
    errors,
    lastSynced,
  };
}

async function describeRole({
  client,
  roleName,
  logger,
  accountId,
  lastSynced,
  resources,
  errors,
  resourceType,
}) {
  try {
    const response = await client.send(new GetRoleCommand({ RoleName: roleName }));
    const role = response?.Role;
    if (!role) return;
    const tags = await listRoleTags({ client, roleName, logger });
    pushRoleResource({ role, tags, accountId, lastSynced, resources, resourceType });
  } catch (error) {
    errors.push({
      roleName,
      message: error?.message || "Failed to retrieve IAM role",
    });
    logger?.warn?.("[scanner:iam] GetRole failed", { roleName, error });
  }
}

async function listRoleTags({ client, roleName, logger }) {
  if (!roleName) return {};
  try {
    const response = await client.send(new ListRoleTagsCommand({ RoleName: roleName }));
    return normalizeTags(response?.Tags);
  } catch (error) {
    const code = error?.name || error?.Code;
    if (code !== "NoSuchEntityException" && code !== "AccessDeniedException") {
      logger?.warn?.("[scanner:iam] ListRoleTags failed", { roleName, error });
    }
  }
  return {};
}

function pushRoleResource({ role, tags, accountId, lastSynced, resources, resourceType }) {
  if (!role?.RoleName) return;
  const arn = role.Arn || null;
  const resolvedAccountId = arn ? extractAccountIdFromArn(arn) : accountId || "";

  resources.push({
    displayName: role.RoleName,
    resourceId: role.RoleName,
    resourceArn: arn,
    region: DEFAULT_REGION,
    accountId: resolvedAccountId,
    source: SOURCE_LABEL,
    lastSynced,
    resourceType,
    service: SERVICE_LABEL,
    details: {
      tags,
    },
  });
}
