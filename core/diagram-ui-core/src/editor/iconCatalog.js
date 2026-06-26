import { awsCatalog, azureCatalog, gcpCatalog } from "@cloudagent/diagram-ui-icons";

const BUNDLED_ICON_ASSETS = import.meta.glob(
  "../../../diagram-ui-icons/assets/icons/**/*.{svg,png,jpg,jpeg,webp}",
  {
    eager: true,
    import: "default",
    query: "?url",
  }
);

const BUNDLED_ASSET_PATHS = Object.fromEntries(
  Object.entries(BUNDLED_ICON_ASSETS)
    .map(([sourcePath, assetUrl]) => {
      const match = sourcePath.match(/\/assets(\/icons\/.+)$/);
      if (!match?.[1] || typeof assetUrl !== "string") return null;
      return [match[1], assetUrl];
    })
    .filter(Boolean)
);

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(s) {
  const n = norm(s);
  if (!n) return [];
  return n.split(/\s+/g).filter(Boolean);
}

const DEFAULT_PROVIDER = "aws";
const CATALOGS = {
  aws: awsCatalog,
  azure: azureCatalog,
  gcp: gcpCatalog,
};

const INDEX_BY_PROVIDER = {};
let ASSET_PATHS = {};
let manifestLoaded = false;
let manifestLoading = null;
let manifestError = null;
let manifestSource = "bundled";

function normalizeProvider(provider) {
  const key = String(provider || "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(CATALOGS, key) ? key : DEFAULT_PROVIDER;
}

function rebuildIndex(provider, nextCatalog) {
  if (!nextCatalog) return;
  const providerKey = normalizeProvider(provider || nextCatalog.provider);
  const next = new Map();
  for (const e of nextCatalog?.entries || []) {
    if (!e?.id || !e?.path) continue;
    next.set(String(e.id), {
      ...e,
      path: BUNDLED_ASSET_PATHS[String(e.path)] || String(e.path),
    });
  }
  INDEX_BY_PROVIDER[providerKey] = next;
  CATALOGS[providerKey] = {
    ...nextCatalog,
    provider: nextCatalog.provider || providerKey,
    entries: Array.isArray(nextCatalog?.entries)
      ? nextCatalog.entries.map((entry) => ({
          ...entry,
          path: BUNDLED_ASSET_PATHS[String(entry?.path)] || String(entry?.path || ""),
        }))
      : [],
  };
}

for (const [provider, catalog] of Object.entries(CATALOGS)) {
  rebuildIndex(provider, catalog);
}

export function getCatalogEntries(provider) {
  const providerKey = normalizeProvider(provider);
  const catalog = CATALOGS[providerKey];
  return Array.isArray(catalog?.entries) ? catalog.entries : [];
}

export function getAwsCatalogEntries() {
  return getCatalogEntries("aws");
}

export function getAzureCatalogEntries() {
  return getCatalogEntries("azure");
}

export function getGcpCatalogEntries() {
  return getCatalogEntries("gcp");
}
export async function preloadIconManifest() {
  if (manifestLoaded) return CATALOGS;
  if (manifestLoading) return manifestLoading;

  if (typeof window !== "undefined" && window.__DIAGRAMS_ICON_MANIFEST__) {
    const manifest = window.__DIAGRAMS_ICON_MANIFEST__;
    if (manifest?.paths) ASSET_PATHS = manifest.paths;
    if (manifest?.catalogs && typeof manifest.catalogs === "object") {
      for (const [provider, catalog] of Object.entries(manifest.catalogs)) {
        rebuildIndex(provider, catalog);
      }
    } else if (manifest?.entries) {
      rebuildIndex(manifest.provider || DEFAULT_PROVIDER, manifest);
    }
    manifestSource = "window";
    manifestLoaded = true;
    return CATALOGS;
  }

  if (typeof window === "undefined" || typeof window.fetch !== "function") {
    if (Object.keys(BUNDLED_ASSET_PATHS).length > 0) {
      ASSET_PATHS = { ...BUNDLED_ASSET_PATHS, ...ASSET_PATHS };
    }
    manifestLoaded = true;
    return CATALOGS;
  }

  const uri = window.__DIAGRAMS_ICON_MANIFEST_URI__ || "ui://assets/icons.json";
  if (
    Object.keys(BUNDLED_ASSET_PATHS).length > 0 &&
    (!window.__DIAGRAMS_ICON_MANIFEST_URI__ || String(uri).startsWith("ui://"))
  ) {
    ASSET_PATHS = { ...BUNDLED_ASSET_PATHS, ...ASSET_PATHS };
    manifestSource = "bundled-assets";
    manifestLoaded = true;
    return CATALOGS;
  }
  manifestLoading = window
    .fetch(uri)
    .then((resp) => (resp.ok ? resp.json() : null))
    .then((data) => {
      if (data?.paths) ASSET_PATHS = data.paths;
      if (data?.catalogs && typeof data.catalogs === "object") {
        for (const [provider, catalog] of Object.entries(data.catalogs)) {
          rebuildIndex(provider, catalog);
        }
        manifestSource = "fetch";
      } else if (data?.entries) {
        rebuildIndex(data.provider || DEFAULT_PROVIDER, data);
        manifestSource = "fetch";
      }
      manifestLoaded = true;
      return CATALOGS;
    })
    .catch((err) => {
      manifestError = err?.message || String(err);
      manifestSource = "fallback";
      manifestLoaded = true;
      return CATALOGS;
    });

  return manifestLoading;
}

export function resolveAssetPath(assetPath) {
  void preloadIconManifest();
  const key = String(assetPath || "");
  if (!key) return assetPath;
  return ASSET_PATHS[key] || BUNDLED_ASSET_PATHS[key] || assetPath;
}

export function getManifestStatus() {
  return {
    loaded: manifestLoaded,
    source: manifestSource,
    error: manifestError,
    entries: Array.isArray(CATALOGS?.[DEFAULT_PROVIDER]?.entries) ? CATALOGS[DEFAULT_PROVIDER].entries.length : 0,
    paths: Object.keys(ASSET_PATHS || {}).length,
  };
}

export function lookupCatalogIcon(provider, id) {
  void preloadIconManifest();
  const providerKey = normalizeProvider(provider);
  const map = INDEX_BY_PROVIDER[providerKey];
  return map?.get(String(id || "")) || null;
}

export function lookupAwsIcon(id) {
  return lookupCatalogIcon("aws", id);
}

export function lookupAzureIcon(id) {
  return lookupCatalogIcon("azure", id);
}

export function lookupGcpIcon(id) {
  return lookupCatalogIcon("gcp", id);
}
export function searchCatalogIcons({ provider, query, type, service, limit = 8 } = {}) {
  void preloadIconManifest();
  const q = tokenize(query);
  if (q.length === 0) return [];
  const providerKey = normalizeProvider(provider);
  const catalog = CATALOGS[providerKey];
  const wantType = type ? String(type) : null;
  const wantService = service ? norm(service) : null;
  const max = Math.max(1, Math.min(25, Number(limit) || 8));

  const scored = [];
  for (const e of catalog?.entries || []) {
    if (!e?.id || !e?.path) continue;
    if (wantType && String(e.type) !== wantType) continue;
    if (wantService) {
      const serviceMatch = norm(e.service) === wantService;
      const categoryMatch = norm(e.category) === wantService;
      if (!serviceMatch && !categoryMatch) continue;
    }

    const hay = [e.id, e.service, e.category, ...(Array.isArray(e.aliases) ? e.aliases : [])]
      .filter(Boolean)
      .join(" ");
    const tokens = tokenize(hay);
    if (tokens.length === 0) continue;
    const tokenSet = new Set(tokens);

    let score = 0;
    for (const qt of q) {
      if (tokenSet.has(qt)) score += 4;
      else if (tokens.some((t) => t.startsWith(qt))) score += 2;
    }
    if (score === 0) continue;
    if (String(e.id).toLowerCase().includes(norm(query))) score += 2;

    scored.push({ e, score });
  }

  const preferArch = (e) => (String(e?.id || "").startsWith("Arch_") ? 1 : 0);
  scored.sort((a, b) => b.score - a.score || preferArch(b.e) - preferArch(a.e));
  return scored.slice(0, max).map(({ e, score }) => ({ ...e, score }));
}

export function searchAwsIcons({ query, type, service, limit = 8 } = {}) {
  return searchCatalogIcons({ provider: "aws", query, type, service, limit });
}

export function searchAzureIcons({ query, type, service, limit = 8 } = {}) {
  return searchCatalogIcons({ provider: "azure", query, type, service, limit });
}

export function searchGcpIcons({ query, type, service, limit = 8 } = {}) {
  return searchCatalogIcons({ provider: "gcp", query, type, service, limit });
}
