import { EventBridgeClient, ListEventBusesCommand, ListRulesCommand, ListTagsForResourceCommand } from "@aws-sdk/client-eventbridge";
import { DEFAULT_REGION, coerceRegions, uniqueTrimmed, normalizeTags } from "./shared.mjs";

const SOURCE_LABEL = "AWS Resource Scan";
const SERVICE_LABEL = "EventBridge";

function createEbClient(region, credentials) {
  const config = {
    region,
    maxAttempts: 5,
    retryMode: "standard",
  };
  if (credentials) config.credentials = credentials;
  return new EventBridgeClient(config);
}

async function listTagsForResource({ client, resourceArn, logger }) {
  if (!resourceArn) return {};
  try {
    const response = await client.send(new ListTagsForResourceCommand({ ResourceARN: resourceArn }));
    return normalizeTags(response?.Tags);
  } catch (error) {
    const code = error?.name || error?.Code;
    if (code !== "ResourceNotFoundException" && code !== "AccessDeniedException") {
      logger?.warn?.("[scanner:eventbridge] ListTagsForResource failed", { resourceArn, error });
    }
  }
  return {};
}

export async function scanEventBridgeEventBuses({ regions, logger, syncedAt, accountId, credentials, eventBusNames } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const names = uniqueTrimmed(eventBusNames);

  for (const region of targetRegions) {
    const client = createEbClient(region, credentials);
    try {
      const response = await client.send(new ListEventBusesCommand({}));
      for (const bus of response?.EventBuses || []) {
        const name = bus?.Name;
        if (names.length > 0 && !names.includes(name)) continue;
        const arn = bus?.Arn || null;
        const tags = await listTagsForResource({ client, resourceArn: arn, logger });
        resources.push({
          displayName: name || "default",
          resourceId: name || "default",
          resourceArn: arn,
          region,
          accountId: accountId || "",
          source: SOURCE_LABEL,
          lastSynced,
          resourceType: "AWS::Events::EventBus",
          service: SERVICE_LABEL,
          details: {
            tags,
          },
        });
      }
    } catch (error) {
      errors.push({ region, message: error?.message || "Failed to list EventBridge event buses" });
      logger?.warn?.("[scanner:eventbridge] listEventBuses failed", { region, error });
    }
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanEventBridgeRules({ regions, logger, syncedAt, accountId, credentials, ruleNames, eventBusName } = {}) {
  const targetRegions = coerceRegions(regions, DEFAULT_REGION);
  const resources = [];
  const errors = [];
  const lastSynced = syncedAt || new Date().toISOString();
  const names = uniqueTrimmed(ruleNames);

  for (const region of targetRegions) {
    const client = createEbClient(region, credentials);
    try {
      const response = await client.send(new ListRulesCommand({ EventBusName: eventBusName }));
      for (const rule of response?.Rules || []) {
        if (names.length > 0 && !names.includes(rule?.Name)) continue;
        const arn = rule?.Arn || null;
        const tags = await listTagsForResource({ client, resourceArn: arn, logger });
        resources.push({
          displayName: rule?.Name || "Rule",
          resourceId: rule?.Name || "Rule",
          resourceArn: arn,
          region,
          accountId: accountId || "",
          source: SOURCE_LABEL,
          lastSynced,
          resourceType: "AWS::Events::Rule",
          service: SERVICE_LABEL,
          details: {
            tags,
          },
        });
      }
    } catch (error) {
      errors.push({ region, message: error?.message || "Failed to list EventBridge rules" });
      logger?.warn?.("[scanner:eventbridge] listRules failed", { region, error });
    }
  }

  return { service: SERVICE_LABEL, regions: targetRegions, resources, errors, lastSynced };
}

export async function scanEventBridgeResources(options = {}) {
  const [buses, rules] = await Promise.all([
    scanEventBridgeEventBuses(options),
    scanEventBridgeRules(options),
  ]);
  return {
    service: SERVICE_LABEL,
    regions: buses?.regions || options?.regions || [DEFAULT_REGION],
    resources: [...(buses?.resources || []), ...(rules?.resources || [])],
    errors: [...(buses?.errors || []), ...(rules?.errors || [])],
    lastSynced: buses?.lastSynced || rules?.lastSynced || new Date().toISOString(),
  };
}


