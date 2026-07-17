import { ECRClient, DescribeRepositoriesCommand, ListTagsForResourceCommand } from "@aws-sdk/client-ecr";
import { DEFAULT_REGION, coerceRegions, uniqueTrimmed, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "ECR";

// ECR repository name constraints (matches error message from AWS)
const ECR_REPOSITORY_NAME_REGEX =
  /^(?:[a-z0-9]+(?:[._-][a-z0-9]+)*\/)*[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

function createEcrClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new ECRClient(config);
}

async function listTagsForResource({ client, resourceArn, logger }) {
  if (!resourceArn) return {};
  try {
    const response = await client.send(new ListTagsForResourceCommand({ resourceArn }));
    return normalizeTags(response?.tags);
  } catch (error) {
    const code = error?.name || error?.Code;
    if (code !== "ResourceNotFoundException" && code !== "AccessDeniedException") {
      logger?.warn?.("[scanner:ecr] ListTagsForResource failed", { resourceArn, error });
    }
  }
  return {};
}

function normalizeRepositoryName(input) {
  if (!input) return null;
  let s = String(input).trim();
  if (!s) return null;

  // ARN: arn:aws:ecr:region:acct:repository/path/name
  const arnRepoMarker = ":repository/";
  const arnIdx = s.indexOf(arnRepoMarker);
  if (arnIdx !== -1) {
    s = s.slice(arnIdx + arnRepoMarker.length).trim();
  }

  // Repository URI: 123456789012.dkr.ecr.us-east-1.amazonaws.com/path/name[:tag|@digest]
  if (s.includes(".amazonaws.com/")) {
    s = s.split(".amazonaws.com/").pop()?.trim() || s;
    // strip :tag or @digest suffix if present
    if (s.includes("@")) s = s.split("@")[0].trim();
    if (s.includes(":")) s = s.split(":")[0].trim();
  }

  // Some callers may pass "repository/name" or similar; keep only portion after "repository/"
  if (s.includes("repository/")) {
    s = s.split("repository/").pop()?.trim() || s;
  }

  return s || null;
}

function normalizeRepositoryNames(repositoryNames, logger) {
  const raw = uniqueTrimmed(repositoryNames);
  const valid = [];
  const invalid = [];

  for (const item of raw) {
    const name = normalizeRepositoryName(item);
    if (name && ECR_REPOSITORY_NAME_REGEX.test(name)) valid.push(name);
    else if (item) invalid.push(item);
  }

  if (invalid.length) {
    logger?.warn?.("[scanner:ecr] ignoring invalid repositoryNames", {
      invalid: invalid.slice(0, 25),
      invalidCount: invalid.length,
    });
  }

  return uniqueTrimmed(valid);
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

export async function scanEcrRepositories({ regions, logger, syncedAt, accountId, credentials, repositoryNames } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const names = normalizeRepositoryNames(repositoryNames, logger);

  for (const region of targetRegions) {
    const client = createEcrClient(region, credentials);
    if (names.length > 0) {
      // DescribeRepositories has a max of 100 repositoryNames per call
      for (const batch of chunkArray(names, 100)) {
        try {
          const response = await client.send(
            new DescribeRepositoriesCommand({ repositoryNames: batch })
          );
          await collectRepos({ response, region, accountId, lastSynced, resources, client, logger });
        } catch (error) {
          errors.push({ region, message: error?.message || "Failed to describe ECR repositories" });
          logger?.warn?.("[scanner:ecr] describeRepositories filtered failed", {
            region,
            error,
            repositoryNamesCount: batch.length,
          });
        }
      }
      continue;
    }

    let nextToken = undefined;
    do {
      try {
        const response = await client.send(new DescribeRepositoriesCommand({ nextToken: nextToken }));
        await collectRepos({ response, region, accountId, lastSynced, resources, client, logger });
        nextToken = response?.nextToken;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to describe ECR repositories" });
        logger?.warn?.("[scanner:ecr] describeRepositories failed", { region, error });
        break;
      }
    } while (nextToken);
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanEcrResources(options = {}) {
  return scanEcrRepositories(options);
}

async function collectRepos({ response, region, accountId, lastSynced, resources, client, logger }) {
  for (const repo of response?.repositories || []) {
    const arn = repo?.repositoryArn || null;
    const name = repo?.repositoryName || normalizeRepositoryName(arn) || arn || "Repository";
    const tags = await listTagsForResource({ client, resourceArn: arn, logger });
    resources.push({
      displayName: name,
      // Use repositoryName as the stable id for ECR repository detail scans (stack enrichment filters by name)
      resourceId: name,
      resourceArn: arn,
      region,
      accountId: accountId || "",
      source: SOURCE_LABEL,
      lastSynced,
      resourceType: "AWS::ECR::Repository",
      service: SERVICE_LABEL,
      details: {
        tags,
      },
    });
  }
}


