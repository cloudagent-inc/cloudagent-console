import { z } from "zod";
import { DEFAULT_AUTH } from "@cloudagent/storage";

export const AnyObjectSchema = z.record(z.any()).default({});

export const PermissionProfileCreateSchema = AnyObjectSchema.refine(
  (value) => value && typeof value === "object" && !Array.isArray(value),
  "body must be an object"
);
export const PermissionProfilePatchSchema = PermissionProfileCreateSchema;
export const WorkloadCreateSchema = PermissionProfileCreateSchema;
export const WorkloadPatchSchema = PermissionProfileCreateSchema;
export const WorkflowCreateSchema = PermissionProfileCreateSchema;
export const WorkflowPatchSchema = PermissionProfileCreateSchema;
export const BlueprintCreateSchema = PermissionProfileCreateSchema;
export const BlueprintPatchSchema = PermissionProfileCreateSchema;
export const AgentHistoryCreateSchema = PermissionProfileCreateSchema;
export const AgentHistoryPatchSchema = PermissionProfileCreateSchema;

export function parseBody(schema, req, res) {
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Invalid request body", issues: parsed.error.issues });
    return null;
  }
  return parsed.data;
}

export function localAuth(req, _res, next) {
  req.auth = { ...DEFAULT_AUTH };
  next();
}

export function localArray(value) {
  return Array.isArray(value) ? value : [];
}

export function toPositiveInt(value, fallback = 50, max = 200) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export function getTimestamp(item) {
  return item?.updatedAt || item?.createdAt || item?.purchaseDate || item?.startedAt || "";
}

export function sortLocalItems(items = [], sortBy = "updatedAt", sortOrder = "desc") {
  const direction = String(sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = sortBy ? a?.[sortBy] : getTimestamp(a);
    const bv = sortBy ? b?.[sortBy] : getTimestamp(b);
    return direction * String(av || "").localeCompare(String(bv || ""));
  });
}

export function filterByDateWindow(items = [], { startDate, endDate } = {}) {
  const startMs = startDate ? Date.parse(startDate) : null;
  const endMs = endDate ? Date.parse(endDate) : null;
  return items.filter((item) => {
    const timestamp = getTimestamp(item);
    const itemMs = timestamp ? Date.parse(timestamp) : null;
    if (!Number.isFinite(itemMs)) return true;
    if (Number.isFinite(startMs) && itemMs < startMs) return false;
    if (Number.isFinite(endMs) && itemMs > endMs) return false;
    return true;
  });
}

export function paginateLocalItems(items = [], query = {}) {
  const pageSize = toPositiveInt(query.count ?? query.limit, 50);
  const start = Math.max(0, Number.parseInt(String(query.nextToken ?? query.cursor ?? "0"), 10) || 0);
  const pageItems = items.slice(start, start + pageSize);
  const nextOffset = start + pageItems.length;
  const nextToken = nextOffset < items.length ? String(nextOffset) : null;
  return {
    items: pageItems,
    count: pageItems.length,
    nextToken,
    nextCursor: nextToken,
  };
}

export function compactLocalJson(value, maxLength = 12_000) {
  const text = JSON.stringify(value ?? null, null, 2);
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n...[truncated]` : text;
}

export function localAuthSummary(authProfile = {}) {
  return {
    provider: authProfile.provider || "aws",
    authType: authProfile.authType || null,
    permissionProfileId: authProfile.permissionProfileId || authProfile.recordId || authProfile.id || null,
    accountId: authProfile.awsAccountId || authProfile.accountId || null,
    awsProfile: authProfile.awsProfile || authProfile.profileName || authProfile.profile || null,
    region: authProfile.region || authProfile.defaultRegion || null,
  };
}

export function appendQueryParams(url, params = {}) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    Object.entries(params).forEach(([key, value]) => {
      if (value != null && value !== "") parsed.searchParams.set(key, String(value));
    });
    return parsed.toString();
  } catch {
    const entries = Object.entries(params).filter(([, value]) => value != null && value !== "");
    if (!entries.length) return url;
    const query = entries
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join("&");
    return `${url}${url.includes("?") ? "&" : "?"}${query}`;
  }
}

export function firstLocalNonEmpty(...values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const nested = firstLocalNonEmpty(...value);
      if (nested != null && nested !== "") return nested;
      continue;
    }
    if (value == null) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
      continue;
    }
    if (value !== "") return value;
  }
  return null;
}

export function uniqueLocalStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : [values]).map((value) => String(value || "").trim()).filter(Boolean))];
}
