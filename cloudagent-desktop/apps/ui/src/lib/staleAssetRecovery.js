const STALE_ASSET_RELOAD_KEY = 'cloudagent.staleAssetReloadAt';
const STALE_ASSET_RELOAD_WINDOW_MS = 15_000;

const STALE_ASSET_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /loading chunk [\w-]+ failed/i,
  /css_chunk_load_failed/i,
];

function errorMessage(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(
    value?.payload?.message ||
      value?.reason?.message ||
      value?.error?.message ||
      value?.message ||
      ''
  );
}

function assetUrl(value) {
  const target = value?.target;
  return String(target?.src || target?.href || '');
}

export function isStaleAssetError(value) {
  const message = errorMessage(value);
  if (STALE_ASSET_ERROR_PATTERNS.some((pattern) => pattern.test(message))) return true;

  const url = assetUrl(value);
  return /\/assets\/[^?#]+\.(?:css|js)(?:[?#]|$)/i.test(url);
}

export function reloadForFreshAssets(windowObject, now = Date.now()) {
  if (!windowObject?.location?.reload) return false;

  try {
    const lastReloadAt = Number(
      windowObject.sessionStorage?.getItem(STALE_ASSET_RELOAD_KEY) || 0
    );
    if (lastReloadAt && now - lastReloadAt < STALE_ASSET_RELOAD_WINDOW_MS) {
      return false;
    }
    windowObject.sessionStorage?.setItem(STALE_ASSET_RELOAD_KEY, String(now));
  } catch {
    // Session storage can be unavailable in hardened renderers. Reloading is
    // still preferable to leaving a route on a blank screen.
  }

  windowObject.location.reload();
  return true;
}

export function installStaleAssetRecovery(windowObject) {
  if (!windowObject?.addEventListener) return () => {};

  const recover = (event) => {
    if (!isStaleAssetError(event)) return;
    event?.preventDefault?.();
    reloadForFreshAssets(windowObject);
  };

  windowObject.addEventListener('vite:preloadError', recover);
  windowObject.addEventListener('unhandledrejection', recover);
  windowObject.addEventListener('error', recover, true);

  const clearReloadGuard = windowObject.setTimeout?.(() => {
    try {
      windowObject.sessionStorage?.removeItem(STALE_ASSET_RELOAD_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
  }, STALE_ASSET_RELOAD_WINDOW_MS);

  return () => {
    windowObject.removeEventListener?.('vite:preloadError', recover);
    windowObject.removeEventListener?.('unhandledrejection', recover);
    windowObject.removeEventListener?.('error', recover, true);
    if (clearReloadGuard !== undefined) windowObject.clearTimeout?.(clearReloadGuard);
  };
}

