import { EFSClient, DescribeFileSystemsCommand, DescribeMountTargetsCommand, DescribeTagsCommand } from "@aws-sdk/client-efs";
import { DEFAULT_REGION, coerceRegions, uniqueTrimmed, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "EFS";

function createEfsClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new EFSClient(config);
}

async function listTagsForResource({ client, fileSystemId, logger }) {
  if (!fileSystemId) return {};
  try {
    const response = await client.send(new DescribeTagsCommand({ FileSystemId: fileSystemId }));
    return normalizeTags(response?.Tags);
  } catch (error) {
    const code = error?.name || error?.Code;
    if (code !== "FileSystemNotFound" && code !== "AccessDeniedException") {
      logger?.warn?.("[scanner:efs] DescribeTags failed", { fileSystemId, error });
    }
  }
  return {};
}

export async function scanEfsFileSystems({ regions, logger, syncedAt, accountId, credentials, fileSystemIds } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const ids = uniqueTrimmed(fileSystemIds);

  for (const region of targetRegions) {
    const client = createEfsClient(region, credentials);
    if (ids.length > 0) {
      try {
        const response = await client.send(new DescribeFileSystemsCommand({ FileSystemId: ids[0] }));
        for (const fs of response?.FileSystems || []) {
          const id = fs?.FileSystemId;
          const tags = await listTagsForResource({ client, fileSystemId: id, logger });
          resources.push({
            displayName: id || "FileSystem",
            resourceId: id || "FileSystem",
            resourceArn: fs?.FileSystemArn || null,
            region,
            accountId: accountId || "",
            source: SOURCE_LABEL,
            lastSynced,
            resourceType: "AWS::EFS::FileSystem",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        }
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe EFS file systems" });
        logger?.warn?.("[scanner:efs] describeFileSystems filtered failed", { region, error });
      }
      continue;
    }

    let marker = undefined;
    do {
      try {
        const response = await client.send(new DescribeFileSystemsCommand({ Marker: marker }));
        for (const fs of response?.FileSystems || []) {
          const id = fs?.FileSystemId;
          const tags = await listTagsForResource({ client, fileSystemId: id, logger });
          resources.push({
            displayName: id || "FileSystem",
            resourceId: id || "FileSystem",
            resourceArn: fs?.FileSystemArn || null,
            region,
            accountId: accountId || "",
            source: SOURCE_LABEL,
            lastSynced,
            resourceType: "AWS::EFS::FileSystem",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        }
        marker = response?.NextMarker;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list EFS file systems" });
        logger?.warn?.("[scanner:efs] describeFileSystems failed", { region, error });
        break;
      }
    } while (marker);
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanEfsMountTargets({ regions, logger, syncedAt, accountId, credentials, mountTargetIds, fileSystemIds } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const mtIds = uniqueTrimmed(mountTargetIds);
  const fsIds = uniqueTrimmed(fileSystemIds);

  for (const region of targetRegions) {
    const client = createEfsClient(region, credentials);
    if (mtIds.length > 0) {
      for (const id of mtIds) {
        try {
          const response = await client.send(new DescribeMountTargetsCommand({ MountTargetId: id }));
          for (const mt of response?.MountTargets || []) {
            const mtid = mt?.MountTargetId;
            resources.push({
              displayName: mtid || "MountTarget",
              resourceId: mtid || "MountTarget",
              resourceArn: null,
              region,
              accountId: accountId || "",
              source: SOURCE_LABEL,
              lastSynced,
              resourceType: "AWS::EFS::MountTarget",
              service: SERVICE_LABEL,
              details: {
                tags: {},
              },
            });
          }
        } catch (error) {
          errors.push({ region, message: error?.message || "Failed to describe EFS mount target" });
          logger?.warn?.("[scanner:efs] describeMountTargets by id failed", { region, id, error });
        }
      }
      continue;
    }

    // If file system ids given, enumerate mount targets for each
    for (const fsId of fsIds) {
      try {
        const response = await client.send(new DescribeMountTargetsCommand({ FileSystemId: fsId }));
        for (const mt of response?.MountTargets || []) {
          const mtid = mt?.MountTargetId;
          resources.push({
            displayName: mtid || "MountTarget",
            resourceId: mtid || "MountTarget",
            resourceArn: null,
            region,
            accountId: accountId || "",
            source: SOURCE_LABEL,
            lastSynced,
            resourceType: "AWS::EFS::MountTarget",
            service: SERVICE_LABEL,
          });
        }
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list EFS mount targets" });
        logger?.warn?.("[scanner:efs] describeMountTargets by fs failed", { region, fsId, error });
      }
    }
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanEfsResources(options = {}) {
  const [fs, mt] = await Promise.all([
    scanEfsFileSystems(options),
    scanEfsMountTargets(options),
  ]);
  return {
    service: SERVICE_LABEL,
    regions: fs?.regions || options?.regions || [DEFAULT_REGION],
    resources: [...(fs?.resources || []), ...(mt?.resources || [])],
    errors: [...(fs?.errors || []), ...(mt?.errors || [])],
    lastSynced: fs?.lastSynced || mt?.lastSynced || new Date().toISOString(),
  };
}


