export function safeTrim(value) {
  return value == null ? "" : String(value).trim();
}

export function safeJsonParse(value, fallback = {}) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
