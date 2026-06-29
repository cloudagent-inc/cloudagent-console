import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const iconsRoot = path.join(packageRoot, "assets");
const resourcesDir = path.join(iconsRoot, "icons/aws/Resource-Icons_07312025");
const groupsDir = path.join(iconsRoot, "icons/aws/Architecture-Group-Icons_07312025");
const archServicesDir = path.join(iconsRoot, "icons/aws/Architecture-Service-Icons_07312025");
const awsOutFile = path.join(packageRoot, "src/awsIconCatalog.json");

const azureIconsDir = path.join(iconsRoot, "icons/azure/Azure_Public_Service_Icons/Icons");
const azureOutFile = path.join(packageRoot, "src/azureIconCatalog.json");

const gcpCategoryDir = path.join(iconsRoot, "icons/gcp/Category Icons");
const gcpUniqueDir = path.join(iconsRoot, "icons/gcp/Unique Icons");
const gcpPngDir = path.join(iconsRoot, "icons/gcp/png-512");
const gcpOutFile = path.join(packageRoot, "src/gcpIconCatalog.json");

const SIZE_PREFERENCE = [48, 64, 32, 24, 16];

function toPublicPath(absPath) {
  const rel = path.relative(iconsRoot, absPath).split(path.sep).join("/");
  return `/${rel}`;
}

async function listFilesRecursive(dir, pred) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = await fs.readdir(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const abs = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(abs);
      else if (ent.isFile() && (!pred || pred(abs))) out.push(abs);
    }
  }
  out.sort();
  return out;
}

function tokenizeForAliases(str) {
  return String(str || "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\bRes_/g, "")
    .replace(/_[0-9]{2,3}(?=$|_|\s)/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function unique(arr) {
  const out = [];
  const seen = new Set();
  for (const v of arr || []) {
    const s = String(v || "").trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function parseResourceId(id) {
  const base = String(id || "");
  const parts = base.split("_");
  if (parts.length < 3 || parts[0] !== "Res") return null;
  const sizePartIdx = parts.findIndex((p) => /^[0-9]{2,3}$/.test(p));
  if (sizePartIdx < 0) return null;
  const size = Number(parts[sizePartIdx]);
  const nameParts = parts.slice(1, sizePartIdx);
  const service = nameParts[0] || "";
  const resource = nameParts.slice(1).join("_") || null;
  const variant = parts.slice(sizePartIdx + 1).join("_") || null;
  if (!service || !Number.isFinite(size)) return null;
  return { service, resource, size, variant };
}

function parseGroupId(id) {
  const parts = String(id || "").split("_");
  const sizePartIdx = parts.findIndex((p) => /^[0-9]{2,3}$/.test(p));
  const size = sizePartIdx >= 0 ? Number(parts[sizePartIdx]) : null;
  const base = parts.filter((p, idx) => idx !== sizePartIdx).join("_").trim();
  return { base: base || id, size: Number.isFinite(size) ? size : undefined };
}

function parseArchServiceId(id) {
  const base = String(id || "");
  const parts = base.split("_");
  if (parts.length < 3 || parts[0] !== "Arch") return null;
  const sizePartIdx = parts.findIndex((p) => /^[0-9]{2,3}$/.test(p));
  if (sizePartIdx < 0) return null;
  const size = Number(parts[sizePartIdx]);
  const service = parts.slice(1, sizePartIdx).join("_") || "";
  const variant = parts.slice(sizePartIdx + 1).join("_") || null;
  if (!service || !Number.isFinite(size)) return null;
  return { service, size, variant };
}

function buildAliases({ id, service, resource }) {
  const idLabel = tokenizeForAliases(id);
  const srLabel = tokenizeForAliases([service, resource].filter(Boolean).join(" "));
  const base = unique([idLabel, srLabel]);
  const extras = [];
  const s = tokenizeForAliases(service);
  const r = tokenizeForAliases(resource);

  if (r.includes("internet gateway") || id.toLowerCase().includes("internet-gateway")) extras.push("igw");
  if (r.includes("application load balancer") || id.toLowerCase().includes("application-load-balancer")) extras.push("alb");
  if (r.includes("network load balancer") || id.toLowerCase().includes("network-load-balancer")) extras.push("nlb");
  if (r.includes("nat gateway") || id.toLowerCase().includes("nat-gateway")) extras.push("nat");
  if (r.includes("availability zone") || id.toLowerCase().includes("availability-zone")) extras.push("az");
  if (s.includes("api gateway") || r.includes("api gateway")) extras.push("apigw", "api-gateway", "apigateway");
  if (s.includes("appsync") || r.includes("appsync")) extras.push("appsync");
  if (s.includes("dynamodb") || r.includes("dynamodb")) extras.push("dynamodb");
  if (s.includes("simple queue service") || r.includes("simple queue service")) extras.push("sqs", "queue");
  if (s.includes("simple notification service") || r.includes("simple notification service")) extras.push("sns", "topic");
  if (s.includes("amazon ec2") || s === "amazon-ec2") extras.push("ec2", "instance", "vm");
  if (s.includes("amazon vpc") || s === "amazon-vpc") extras.push("vpc");
  if (s.includes("amazon rds") || s === "amazon-rds") extras.push("rds", "database");
  if (s.includes("key management service") || s === "aws-key-management-service") extras.push("kms");
  if (s.includes("identity and access management") || s === "aws-identity-and-access-management") extras.push("iam");
  if (s.includes("simple storage service") || s === "amazon-s3") extras.push("s3", "bucket");
  if (s.includes("cloudfront") || s === "amazon-cloudfront") extras.push("cloudfront", "cdn");
  if (s.includes("route 53") || s === "amazon-route-53") extras.push("route53", "dns");
  if (s.includes("cloudwatch")) extras.push("cloudwatch", "cw");
  if (s.includes("elastic load balancing")) extras.push("elb", "loadbalancer");
  if (s.includes("elastic kubernetes service") || s === "amazon-eks") extras.push("eks", "kubernetes");
  if (s.includes("elastic container service") || s === "amazon-ecs") extras.push("ecs");
  if (s.includes("elastic container registry") || s === "amazon-ecr") extras.push("ecr");
  if (s.includes("kinesis")) extras.push("kinesis");

  return unique([...base, ...extras]);
}

function sizeRank(size) {
  const n = Number(size);
  const idx = SIZE_PREFERENCE.indexOf(n);
  if (idx >= 0) return idx;
  return SIZE_PREFERENCE.length + Math.abs(48 - n);
}

function upsertBest(map, key, cand) {
  const prev = map.get(key);
  if (!prev) {
    map.set(key, cand);
    return;
  }
  const prevRank = sizeRank(prev.size);
  const nextRank = sizeRank(cand.size);
  if (nextRank < prevRank) map.set(key, cand);
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

function normalizeAzureCategory(category) {
  return String(category || "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeGcpLabel(label) {
  return String(label || "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripAzureName(baseName) {
  let name = String(baseName || "").replace(/\.[^.]+$/i, "");
  name = name.replace(/^[0-9]+\s*-?/, "");
  name = name.replace(/^icon-service-/i, "");
  name = name.replace(/^icon-/i, "");
  return name.trim();
}

function labelFromAzureName(baseName) {
  return String(baseName || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildAzureAliases({ id, label, category }) {
  return unique([
    tokenizeForAliases(label),
    tokenizeForAliases(category),
    tokenizeForAliases(id),
  ]);
}

function buildGcpAliases({ id, label }) {
  return unique([tokenizeForAliases(label), tokenizeForAliases(id)]);
}

async function generateAwsCatalog() {
  const resourceSvgs = await listFilesRecursive(resourcesDir, (p) => p.toLowerCase().endsWith(".svg"));
  const groupSvgs = await listFilesRecursive(groupsDir, (p) => p.toLowerCase().endsWith(".svg"));
  const archServiceSvgs = await listFilesRecursive(archServicesDir, (p) => p.toLowerCase().endsWith(".svg"));

  const bestResources = new Map(); // baseKey -> {id,size,service,aliases,abs}
  const bestGroups = new Map(); // baseKey -> {id,size,abs}
  const bestArchServices = new Map(); // baseKey -> {id,size,service,aliases,abs}

  for (const abs of resourceSvgs) {
    const id = path.basename(abs, path.extname(abs));
    const parsed = parseResourceId(id);
    if (!parsed) continue;
    const baseKey = ["Res", parsed.service, parsed.resource, parsed.variant].filter(Boolean).join("_");
    upsertBest(bestResources, baseKey, {
      id,
      size: parsed.size,
      service: parsed.service,
      aliases: buildAliases({ id, service: parsed.service, resource: parsed.resource || parsed.variant }),
      abs,
    });
  }

  for (const abs of groupSvgs) {
    const id = path.basename(abs, path.extname(abs));
    const parsed = parseGroupId(id);
    const baseKey = parsed.base;
    upsertBest(bestGroups, baseKey, { id, size: parsed.size || 0, abs });
  }

  for (const abs of archServiceSvgs) {
    const id = path.basename(abs, path.extname(abs));
    const parsed = parseArchServiceId(id);
    if (!parsed) continue;
    if (parsed.variant && String(parsed.variant).toLowerCase().includes("dark")) continue;
    const baseKey = ["Arch", parsed.service, parsed.variant].filter(Boolean).join("_");
    upsertBest(bestArchServices, baseKey, {
      id,
      size: parsed.size,
      service: parsed.service,
      aliases: buildAliases({ id, service: parsed.service, resource: parsed.variant }),
      abs,
    });
  }

  const entries = [];

  for (const { id, service, abs, aliases } of bestResources.values()) {
    entries.push({
      id,
      type: "resource",
      service,
      path: toPublicPath(abs),
      aliases,
    });
  }

  for (const { id, abs } of bestGroups.values()) {
    entries.push({
      id,
      type: "container",
      service: null,
      path: toPublicPath(abs),
      aliases: buildAliases({ id, service: "", resource: id }),
    });
  }

  for (const { id, service, abs, aliases } of bestArchServices.values()) {
    entries.push({
      id,
      type: "resource",
      service,
      path: toPublicPath(abs),
      aliases,
    });
  }

  entries.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const payload = {
    provider: "aws",
    version: 1,
    generatedAt: new Date().toISOString(),
    entries,
  };

  await fs.mkdir(path.dirname(awsOutFile), { recursive: true });
  await fs.writeFile(awsOutFile, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`Wrote ${entries.length} entries to ${path.relative(packageRoot, awsOutFile)}`);
}

async function generateAzureCatalog() {
  const iconFiles = await listFilesRecursive(azureIconsDir, (p) => p.toLowerCase().endsWith(".svg"));
  const entries = [];

  for (const abs of iconFiles) {
    const rel = path.relative(azureIconsDir, abs);
    const [rawCategory, fileName] = rel.split(path.sep);
    if (!fileName) continue;

    const base = stripAzureName(fileName);
    const label = labelFromAzureName(base);
    if (!label) continue;

    const category = normalizeAzureCategory(rawCategory);
    const idParts = ["Azure", slugify(category), slugify(label)].filter(Boolean);
    const id = idParts.join("_");

    entries.push({
      id,
      type: "resource",
      service: label,
      category: category || null,
      path: toPublicPath(abs),
      aliases: buildAzureAliases({ id, label, category }),
    });
  }

  entries.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const payload = {
    provider: "azure",
    version: 1,
    generatedAt: new Date().toISOString(),
    entries,
  };

  await fs.mkdir(path.dirname(azureOutFile), { recursive: true });
  await fs.writeFile(azureOutFile, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`Wrote ${entries.length} entries to ${path.relative(packageRoot, azureOutFile)}`);
}

async function generateGcpCatalog() {
  const categorySvgs = await listFilesRecursive(gcpCategoryDir, (p) => p.toLowerCase().endsWith(".svg"));
  const uniqueSvgs = await listFilesRecursive(gcpUniqueDir, (p) => p.toLowerCase().endsWith(".svg"));
  const pngSvgs = await listFilesRecursive(gcpPngDir, (p) => p.toLowerCase().endsWith(".png"));

  const byId = new Map();

  for (const abs of categorySvgs) {
    const rel = path.relative(gcpCategoryDir, abs);
    const parts = rel.split(path.sep);
    if (parts.length < 3) continue;
    if (String(parts[1]).toLowerCase() !== "svg") continue;
    const category = normalizeGcpLabel(parts[0]);
    if (!category) continue;
    const id = `GCP_category_${slugify(category)}`;
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      type: "container",
      service: category,
      category: null,
      path: toPublicPath(abs),
      aliases: buildGcpAliases({ id, label: category }),
    });
  }

  for (const abs of uniqueSvgs) {
    const rel = path.relative(gcpUniqueDir, abs);
    const parts = rel.split(path.sep);
    if (parts.length < 3) continue;
    if (String(parts[1]).toLowerCase() !== "svg") continue;
    const service = normalizeGcpLabel(parts[0]);
    if (!service) continue;
    const id = `GCP_${slugify(service)}`;
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      type: "resource",
      service,
      category: null,
      path: toPublicPath(abs),
      aliases: buildGcpAliases({ id, label: service }),
    });
  }

  for (const abs of pngSvgs) {
    const base = path.basename(abs, path.extname(abs));
    const service = normalizeGcpLabel(base);
    if (!service) continue;
    const id = `GCP_${slugify(service)}`;
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      type: "resource",
      service,
      category: null,
      path: toPublicPath(abs),
      aliases: buildGcpAliases({ id, label: service }),
    });
  }

  const entries = [...byId.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const payload = {
    provider: "gcp",
    version: 1,
    generatedAt: new Date().toISOString(),
    entries,
  };

  await fs.mkdir(path.dirname(gcpOutFile), { recursive: true });
  await fs.writeFile(gcpOutFile, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`Wrote ${entries.length} entries to ${path.relative(packageRoot, gcpOutFile)}`);
}

async function main() {
  await generateAwsCatalog();
  await generateAzureCatalog();
  await generateGcpCatalog();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
