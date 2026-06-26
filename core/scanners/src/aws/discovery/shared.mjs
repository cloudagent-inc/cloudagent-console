import globals from "@cloudagent/core/global-variables";

export const DEFAULT_REGION = globals.AWS_REGION;

export function coerceRegions(regions, fallbackRegion = DEFAULT_REGION) {
  if (!Array.isArray(regions) || regions.length === 0) return [fallbackRegion];
  const cleaned = regions
    .map((region) => (typeof region === "string" ? region.trim() : ""))
    .filter((region) => region.length > 0);
  return cleaned.length > 0 ? cleaned : [fallbackRegion];
}

export function extractAccountIdFromArn(arn) {
  if (typeof arn !== "string") return "";
  const parts = arn.split(":");
  return parts.length >= 5 ? parts[4] || "" : "";
}

export function uniqueTrimmed(items) {
  return Array.isArray(items)
    ? [...new Set(items.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean))]
    : [];
}

/**
 * Normalizes AWS service tag formats to a consistent {key: value} object format.
 * Handles various AWS service tag response formats:
 * - Array format with Key/Value: [{Key: "key", Value: "value"}]
 * - Array format with lowercase key/value: [{key: "key", value: "value"}]
 * - Object format: {key: "value"} or {Key: "Value"}
 * - Nested Tags.Items: {Tags: {Items: [{Key: "key", Value: "value"}]}}
 * - TagList format: {TagList: [{Key: "key", Value: "value"}]}
 * 
 * @param {any} tags - Raw tags from AWS API response (can be array, object, or undefined)
 * @returns {Object} Normalized tag object in format {key: value}
 */
export function normalizeTags(tags) {
  if (!tags) return {};
  
  // Already a plain object (e.g., Lambda, SQS, SNS, API Gateway)
  if (typeof tags === "object" && !Array.isArray(tags) && tags.constructor === Object) {
    const normalized = {};
    for (const [key, value] of Object.entries(tags)) {
      if (key && typeof key === "string") {
        normalized[key] = value ?? null;
      }
    }
    return normalized;
  }
  
  // Array format
  if (Array.isArray(tags)) {
    const normalized = {};
    for (const tag of tags) {
      if (!tag || typeof tag !== "object") continue;
      
      // Handle {Key: "key", Value: "value"} format (EC2, RDS, ElastiCache, EFS, OpenSearch, EventBridge, CloudFront)
      if (tag.Key !== undefined) {
        const key = tag.Key;
        if (key && typeof key === "string") {
          normalized[key] = tag.Value ?? null;
        }
      }
      // Handle {key: "key", value: "value"} format (ECS, ECR, EKS, Step Functions)
      else if (tag.key !== undefined) {
        const key = tag.key;
        if (key && typeof key === "string") {
          normalized[key] = tag.value ?? null;
        }
      }
    }
    return normalized;
  }
  
  // Handle nested structures like {Tags: {Items: [...]}} or {TagList: [...]}
  if (typeof tags === "object") {
    // Try Tags.Items (CloudFront)
    if (tags.Tags?.Items && Array.isArray(tags.Tags.Items)) {
      return normalizeTags(tags.Tags.Items);
    }
    // Try TagList (ElastiCache, RDS, OpenSearch)
    if (tags.TagList && Array.isArray(tags.TagList)) {
      return normalizeTags(tags.TagList);
    }
    // Try Tags array
    if (tags.Tags && Array.isArray(tags.Tags)) {
      return normalizeTags(tags.Tags);
    }
    // Try tags array (lowercase)
    if (tags.tags && Array.isArray(tags.tags)) {
      return normalizeTags(tags.tags);
    }
  }
  
  return {};
}
