import { SFNClient, ListStateMachinesCommand, DescribeStateMachineCommand, ListTagsForResourceCommand } from "@aws-sdk/client-sfn";
import { DEFAULT_REGION, coerceRegions, uniqueTrimmed, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "StepFunctions";

function createSfnClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new SFNClient(config);
}

async function listTagsForResource({ client, resourceArn, logger }) {
  if (!resourceArn) return {};
  try {
    const response = await client.send(new ListTagsForResourceCommand({ resourceArn }));
    return normalizeTags(response?.tags);
  } catch (error) {
    const code = error?.name || error?.Code;
    if (code !== "ResourceNotFoundException" && code !== "AccessDeniedException") {
      logger?.warn?.("[scanner:sfn] ListTagsForResource failed", { resourceArn, error });
    }
  }
  return {};
}

export async function scanSfnStateMachines({ regions, logger, syncedAt, accountId, credentials, stateMachineArns } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const arns = uniqueTrimmed(stateMachineArns);

  for (const region of targetRegions) {
    const client = createSfnClient(region, credentials);
    if (arns.length > 0) {
      for (const arn of arns) {
        try {
          const response = await client.send(new DescribeStateMachineCommand({ stateMachineArn: arn }));
          const name = response?.name || arn;
          const tags = await listTagsForResource({ client, resourceArn: arn, logger });
          resources.push({
            displayName: name,
            resourceId: arn,
            resourceArn: arn,
            region,
            accountId: accountId || "",
            source: SOURCE_LABEL,
            lastSynced,
            resourceType: "AWS::StepFunctions::StateMachine",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        } catch (error) {
          errors.push({ region, message: error?.message || "Failed to describe state machine" });
          logger?.warn?.("[scanner:sfn] describeStateMachine failed", { region, arn, error });
        }
      }
      continue;
    }

    let nextToken = undefined;
    do {
      try {
        const response = await client.send(new ListStateMachinesCommand({ nextToken }));
        for (const sm of response?.stateMachines || []) {
          const arn = sm?.stateMachineArn;
          const tags = await listTagsForResource({ client, resourceArn: arn, logger });
          resources.push({
            displayName: sm?.name || arn,
            resourceId: arn,
            resourceArn: arn,
            region,
            accountId: accountId || "",
            source: SOURCE_LABEL,
            lastSynced,
            resourceType: "AWS::StepFunctions::StateMachine",
            service: SERVICE_LABEL,
            details: {
              tags,
            },
          });
        }
        nextToken = response?.nextToken;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list state machines" });
        logger?.warn?.("[scanner:sfn] listStateMachines failed", { region, error });
        break;
      }
    } while (nextToken);
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanSfnResources(options = {}) {
  return scanSfnStateMachines(options);
}


