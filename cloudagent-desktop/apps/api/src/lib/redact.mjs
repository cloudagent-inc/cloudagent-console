

export function redactLocalSensitiveValue(value) {
  if (Array.isArray(value)) return value.map(redactLocalSensitiveValue);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/secret|token|password|private|accessKeyId|sessionToken|apiKey/i.test(key)) {
      out[key] = "[redacted]";
    } else {
      out[key] = redactLocalSensitiveValue(entry);
    }
  }
  return out;
}
