export const DEFAULT_TRACKED_RESOURCES = () => ({ resources: [], stacks: [] });

export function deepMerge(base, patch) {
  if (
    Array.isArray(base) ||
    Array.isArray(patch) ||
    typeof base !== "object" ||
    typeof patch !== "object" ||
    !base ||
    !patch
  ) {
    return patch ?? base;
  }
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = deepMerge(base[key], value);
  }
  return out;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function sanitizePatch(input, { allowClear = false } = {}) {
  if (!isPlainObject(input)) return input;
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) {
      if (allowClear) out[key] = value;
      continue;
    }
    if (typeof value === "string") {
      if (value.trim().length === 0 && !allowClear) continue;
      out[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length === 0 && !allowClear) continue;
      out[key] = value;
      continue;
    }
    if (isPlainObject(value)) {
      const nested = sanitizePatch(value, { allowClear });
      if (isPlainObject(nested) && Object.keys(nested).length === 0) continue;
      out[key] = nested;
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function deleteByPath(target, pathStr) {
  if (!target || typeof target !== "object" || !pathStr) return;
  const parts = String(pathStr).split(".").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return;
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (!cursor || typeof cursor !== "object") return;
    cursor = cursor[part];
  }
  if (cursor && typeof cursor === "object") {
    delete cursor[parts[parts.length - 1]];
  }
}
