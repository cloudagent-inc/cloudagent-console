import { SNSClient, ListTopicsCommand, GetTopicAttributesCommand, ListSubscriptionsCommand, ListTagsForResourceCommand } from "@aws-sdk/client-sns";
import { DEFAULT_REGION, coerceRegions, uniqueTrimmed, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "SNS";

function createSnsClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new SNSClient(config);
}

export async function scanSnsTopics({ regions, logger, syncedAt, accountId, credentials, topicArns } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const arns = uniqueTrimmed(topicArns);

  for (const region of targetRegions) {
    const client = createSnsClient(region, credentials);
    const processArn = async (arn) => {
      try {
        const resp = await client.send(new GetTopicAttributesCommand({ TopicArn: arn }));
        const name = arn?.split(":")?.pop();
        
        const tags = {};
        try {
          const tagResp = await client.send(new ListTagsForResourceCommand({ ResourceArn: arn }));
          Object.assign(tags, normalizeTags(tagResp?.Tags));
        } catch (tagError) {
          const code = tagError?.name || tagError?.Code;
          if (code !== "ResourceNotFoundException" && code !== "AccessDeniedException") {
            logger?.warn?.("[scanner:sns] ListTagsForResource failed", { region, arn, error: tagError });
          }
        }
        
        resources.push({
          displayName: name || arn,
          resourceId: arn,
          resourceArn: arn,
          region,
          accountId: accountId || "",
          source: SOURCE_LABEL,
          lastSynced,
          resourceType: "AWS::SNS::Topic",
          service: SERVICE_LABEL,
          details: {
            tags,
          },
        });
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to get SNS topic attributes" });
        logger?.warn?.("[scanner:sns] getTopicAttributes failed", { region, arn, error });
      }
    };

    if (arns.length > 0) {
      for (const arn of arns) await processArn(arn);
      continue;
    }

    let nextToken = undefined;
    do {
      try {
        const list = await client.send(new ListTopicsCommand({ NextToken: nextToken }));
        for (const t of list?.Topics || []) if (t?.TopicArn) await processArn(t.TopicArn);
        nextToken = list?.NextToken;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list SNS topics" });
        logger?.warn?.("[scanner:sns] listTopics failed", { region, error });
        break;
      }
    } while (nextToken);
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanSnsSubscriptions({ regions, logger, syncedAt, accountId, credentials, subscriptionArns } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const arns = uniqueTrimmed(subscriptionArns);

  for (const region of targetRegions) {
    const client = createSnsClient(region, credentials);
    if (arns.length > 0) {
      for (const arn of arns) {
        // No direct describe; best-effort add
        resources.push({
          displayName: arn,
          resourceId: arn,
          resourceArn: arn,
          region,
          accountId: accountId || "",
          source: SOURCE_LABEL,
          lastSynced,
          resourceType: "AWS::SNS::Subscription",
          service: SERVICE_LABEL,
          details: {
            tags: {},
          },
        });
      }
      continue;
    }

    let nextToken = undefined;
    do {
      try {
        const list = await client.send(new ListSubscriptionsCommand({ NextToken: nextToken }));
        for (const s of list?.Subscriptions || []) {
          const arn = s?.SubscriptionArn;
          if (!arn || arn === "PendingConfirmation") continue;
          resources.push({
            displayName: arn,
            resourceId: arn,
            resourceArn: arn,
            region,
            accountId: accountId || "",
            source: SOURCE_LABEL,
            lastSynced,
            resourceType: "AWS::SNS::Subscription",
            service: SERVICE_LABEL,
          });
        }
        nextToken = list?.NextToken;
      } catch (error) {
        errors.push({ region, message: error?.message || "Failed to list SNS subscriptions" });
        logger?.warn?.("[scanner:sns] listSubscriptions failed", { region, error });
        break;
      }
    } while (nextToken);
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanSnsResources(options = {}) {
  const [topics, subs] = await Promise.all([
    scanSnsTopics(options),
    scanSnsSubscriptions(options),
  ]);
  return {
    service: SERVICE_LABEL,
    regions: topics?.regions || options?.regions || [DEFAULT_REGION],
    resources: [...(topics?.resources || []), ...(subs?.resources || [])],
    errors: [...(topics?.errors || []), ...(subs?.errors || [])],
    lastSynced: topics?.lastSynced || subs?.lastSynced || new Date().toISOString(),
  };
}


