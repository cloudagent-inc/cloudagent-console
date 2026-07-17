const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

function parseUrl(value) {
  try {
    return new URL(String(value || ''));
  } catch {
    return null;
  }
}

export function isSameOriginUrl(value, expectedOrigin) {
  const candidate = parseUrl(value);
  const expected = parseUrl(expectedOrigin);
  return Boolean(candidate && expected && candidate.origin === expected.origin);
}

export function isAllowedExternalUrl(value) {
  const candidate = parseUrl(value);
  return Boolean(
    candidate &&
      ALLOWED_EXTERNAL_PROTOCOLS.has(candidate.protocol) &&
      candidate.hostname
  );
}
