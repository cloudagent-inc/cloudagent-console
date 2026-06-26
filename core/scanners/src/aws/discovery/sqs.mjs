import { SQSClient, ListQueuesCommand, GetQueueAttributesCommand, ListQueueTagsCommand } from "@aws-sdk/client-sqs";
import { DEFAULT_REGION, coerceRegions, uniqueTrimmed, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "SQS";

function createSqsClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new SQSClient(config);
}

export async function scanSqsQueues({ regions, logger, syncedAt, accountId, credentials, queueUrls } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const urls = uniqueTrimmed(queueUrls);

  for (const region of targetRegions) {
    const client = createSqsClient(region, credentials);
    const processUrl = async (url) => {
      try {
        const resp = await client.send(
          new GetQueueAttributesCommand({ QueueUrl: url, AttributeNames: ["QueueArn"] })
        );
        const arn = resp?.Attributes?.QueueArn || null;
        const name = url?.split("/")?.pop();
        
        const tags = {};
        if (arn) {
          try {
            const tagResp = await client.send(new ListQueueTagsCommand({ QueueUrl: url }));
            Object.assign(tags, normalizeTags(tagResp?.Tags));
          } catch (tagError) {
            const code = tagError?.name || tagError?.Code;
            if (code !== "ResourceNotFoundException" && code !== "AccessDeniedException") {
              logger?.warn?.("[scanner:sqs] ListQueueTags failed", { region, url, error: tagError });
            }
          }
        }
        
        resources.push({
          displayName: name || url,
          resourceId: url,
          resourceArn: arn,
          region,
          accountId: accountId || "",
          source: SOURCE_LABEL,
          lastSynced,
          resourceType: "AWS::SQS::Queue",
          service: SERVICE_LABEL,
          details: {
            tags,
          },
        });
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to get SQS queue attributes" });
        logger?.warn?.("[scanner:sqs] getQueueAttributes failed", { region, url, error });
      }
    };

    if (urls.length > 0) {
      for (const url of urls) await processUrl(url);
      continue;
    }

    try {
      const list = await client.send(new ListQueuesCommand({}));
      for (const url of list?.QueueUrls || []) await processUrl(url);
    } catch (error) {
      errors.push({ region, message: error?.message || "Failed to list SQS queues" });
      logger?.warn?.("[scanner:sqs] listQueues failed", { region, error });
    }
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanSqsResources(options = {}) {
  return scanSqsQueues(options);
}


