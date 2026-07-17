import { promises as fs } from "node:fs";

const AWS_CATALOG_URL = new URL(
  import.meta.resolve("@cloudagent/diagram-ui-icons/awsIconCatalog.json")
);
const AZURE_CATALOG_URL = new URL(
  import.meta.resolve("@cloudagent/diagram-ui-icons/azureIconCatalog.json")
);
const GCP_CATALOG_URL = new URL(
  import.meta.resolve("@cloudagent/diagram-ui-icons/gcpIconCatalog.json")
);

const cached = {
  aws: null,
  azure: null,
  gcp: null,
};

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

async function loadCatalog(url, provider) {
  if (cached[provider]) return cached[provider];
  const raw = await fs.readFile(url, "utf8");
  const json = JSON.parse(raw);
  const entries = Array.isArray(json?.entries) ? json.entries : [];
  const byId = new Map();
  for (const e of entries) {
    if (!e?.id || !e?.path) continue;
    byId.set(String(e.id), e);
  }
  cached[provider] = {
    provider: json?.provider || provider,
    version: json?.version || 1,
    generatedAt: json?.generatedAt || null,
    entries,
    byId,
  };
  return cached[provider];
}

async function loadAwsCatalog() {
  return loadCatalog(AWS_CATALOG_URL, "aws");
}

async function loadAzureCatalog() {
  return loadCatalog(AZURE_CATALOG_URL, "azure");
}

async function loadGcpCatalog() {
  return loadCatalog(GCP_CATALOG_URL, "gcp");
}

export async function lookupAwsIcon(id) {
  const { byId } = await loadAwsCatalog();
  return byId.get(String(id || "")) || null;
}

export async function lookupAzureIcon(id) {
  const { byId } = await loadAzureCatalog();
  return byId.get(String(id || "")) || null;
}

export async function lookupGcpIcon(id) {
  const { byId } = await loadGcpCatalog();
  return byId.get(String(id || "")) || null;
}

export async function lookupCatalogIcon(provider, id) {
  const p = String(provider || "aws").toLowerCase();
  if (p === "gcp") return lookupGcpIcon(id);
  if (p === "azure") return lookupAzureIcon(id);
  return lookupAwsIcon(id);
}

function preferArch(e) {
  return String(e?.id || "").startsWith("Arch_") ? 1 : 0;
}

export async function searchAwsIcons({ query, type, service, limit = 8 } = {}) {
  const { entries } = await loadAwsCatalog();
  return searchEntries(entries, { query, type, service, limit, prefer: preferArch });
}

export async function searchAzureIcons({ query, type, service, limit = 8 } = {}) {
  const { entries } = await loadAzureCatalog();
  return searchEntries(entries, { query, type, service, limit });
}

export async function searchGcpIcons({ query, type, service, limit = 8 } = {}) {
  const { entries } = await loadGcpCatalog();
  return searchEntries(entries, { query, type, service, limit });
}

export async function searchCatalogIcons({ provider, query, type, service, limit = 8 } = {}) {
  const p = String(provider || "aws").toLowerCase();
  if (p === "gcp") return searchGcpIcons({ query, type, service, limit });
  if (p === "azure") return searchAzureIcons({ query, type, service, limit });
  return searchAwsIcons({ query, type, service, limit });
}

function searchEntries(entries, { query, type, service, limit = 8, prefer } = {}) {
  const q = tokenize(query);
  if (q.length === 0) return [];
  const wantType = type ? String(type) : null;
  const wantService = service ? norm(service) : null;
  const max = Math.max(1, Math.min(25, Number(limit) || 8));

  const scored = [];
  for (const e of entries) {
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

  const pref = typeof prefer === "function" ? prefer : () => 0;
  scored.sort((a, b) => b.score - a.score || pref(b.e) - pref(a.e));

  return scored.slice(0, max).map(({ e, score }) => ({
    id: e.id,
    type: e.type,
    service: e.service ?? null,
    category: e.category ?? null,
    path: e.path,
    score,
  }));
}
