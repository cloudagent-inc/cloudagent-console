import {
  S3Client,
  ListBucketsCommand,
  GetBucketLocationCommand,
  GetBucketTaggingCommand,
} from "@aws-sdk/client-s3";
import { DEFAULT_REGION, extractAccountIdFromArn, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "S3";
const BUCKET_RESOURCE_TYPE = "AWS::S3::Bucket";

function createS3Client(region, credentials) {
  const targetRegion = region || DEFAULT_REGION;
  const config = {
    region: targetRegion,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new S3Client(config);
}


function normalizeBucketRegion(locationConstraint) {
  if (!locationConstraint || locationConstraint === "us-east-1") return "us-east-1";
  if (locationConstraint === "EU") return "eu-west-1";
  return locationConstraint;
}

function normalizeRegionsFilter(regions) {
  if (!Array.isArray(regions) || regions.length === 0) return null;
  const cleaned = regions
    .map((region) => (typeof region === "string" ? region.trim() : ""))
    .filter((region) => region.length > 0);
  return cleaned.length > 0 ? new Set(cleaned) : null;
}

async function resolveBucketRegion(baseClient, bucketName) {
  try {
    const response = await baseClient.send(new GetBucketLocationCommand({ Bucket: bucketName }));
    return normalizeBucketRegion(response?.LocationConstraint);
  } catch (error) {
    const headerRegion = error?.$metadata?.httpHeaders?.["x-amz-bucket-region"];
    if (headerRegion) return headerRegion;
    throw error;
  }
}

export async function scanS3Resources(options = {}) {
  return scanS3Buckets({ ...options, resourceType: BUCKET_RESOURCE_TYPE });
}

async function scanS3Buckets({
  logger,
  regions,
  syncedAt,
  accountId,
  credentials,
  bucketNames,
  resourceType,
} = {}) {
  const baseS3 = createS3Client(DEFAULT_REGION, credentials);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const regionFilter = normalizeRegionsFilter(regions);
  const filteredBucketNames = Array.isArray(bucketNames)
    ? [...new Set(bucketNames.map((name) => name?.trim()).filter(Boolean))]
    : null;

  const bucketsToProcess = filteredBucketNames;

  if (bucketsToProcess && bucketsToProcess.length > 0) {
    for (const bucketName of bucketsToProcess) {
      await processBucket({
        bucketName,
        baseS3,
        credentials,
        regionFilter,
        accountId,
        lastSynced,
        resources,
        errors,
        logger,
        resourceType,
      });
    }
  } else {
    try {
      const response = await baseS3.send(new ListBucketsCommand({}));
      for (const bucket of response?.Buckets || []) {
        const bucketName = bucket?.Name;
        if (!bucketName) continue;

        await processBucket({
          bucketName,
          baseS3,
          credentials,
          regionFilter,
          accountId,
          lastSynced,
          resources,
          errors,
          logger,
          resourceType,
        });
      }
    } catch (error) {
      errors.push({
        stage: "listBuckets",
        message: error?.message || "Failed to list S3 buckets",
      });
      logger?.error?.("[scanner:s3] listBuckets failed", { error });
    }
  }

  const regionsCovered = [
    ...new Set(resources.map((resource) => resource.region).filter(Boolean)),
  ];

  return {
    service: SERVICE_LABEL,
    regions: regionsCovered,
    resources,
    errors,
    lastSynced,
  };
}

async function processBucket({
  bucketName,
  baseS3,
  credentials,
  regionFilter,
  accountId,
  lastSynced,
  resources,
  errors,
  logger,
  resourceType,
}) {
  let region = DEFAULT_REGION;
  try {
    region = await resolveBucketRegion(baseS3, bucketName);
  } catch (error) {
    errors.push({
      bucketName,
      stage: "getBucketLocation",
      message: error?.message || "Failed to resolve bucket region",
    });
    logger?.warn?.("[scanner:s3] getBucketLocation failed", { bucketName, error });
  }

  if (regionFilter && region && !regionFilter.has(region)) {
    return;
  }

  const regionalClient = createS3Client(region, credentials);
  const tags = {};
  try {
    const tagResponse = await regionalClient.send(
      new GetBucketTaggingCommand({ Bucket: bucketName })
    );
    Object.assign(tags, normalizeTags(tagResponse?.TagSet));
  } catch (error) {
    const errorCode = error?.name || error?.Code;
    if (errorCode !== "NoSuchTagSet" && errorCode !== "AccessDenied") {
      errors.push({
        bucketName,
        stage: "getBucketTagging",
        message: error?.message || "Failed to fetch bucket tags",
      });
      logger?.warn?.("[scanner:s3] getBucketTagging failed", { bucketName, error });
    }
  }

  resources.push({
    displayName: bucketName,
    resourceId: bucketName,
    resourceArn: `arn:aws:s3:::${bucketName}`,
    region,
    accountId: accountId || extractAccountIdFromArn(`arn:aws:s3:::${bucketName}`),
    source: SOURCE_LABEL,
    lastSynced,
    resourceType,
    service: SERVICE_LABEL,
    details: {
      tags,
    },
  });
}
