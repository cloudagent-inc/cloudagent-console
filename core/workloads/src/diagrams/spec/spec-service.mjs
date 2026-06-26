import { lookupCatalogIcon, searchCatalogIcons } from "./icon-catalog.mjs";
import { runDiagramSpecAgent } from "./spec-agent.mjs";
import { validateDiagramSpec } from "./validate-spec.mjs";

function isContainerNode(n) {
  return String(n?.style?.variant || "").toLowerCase() === "container";
}

function isGenericKind(kind) {
  return String(kind || "").startsWith("generic.");
}

function extractJsonObject(text) {
  const s = String(text || "");
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function normLabel(s) {
  return String(s || "")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapById(nodes) {
  const m = new Map();
  for (const n of nodes || []) m.set(String(n.id), n);
  return m;
}

function enforceContainerParenting(spec) {
  const byId = mapById(spec.nodes || []);
  const nextNodes = (spec.nodes || []).map((n) => {
    if (!n?.parentId) return n;
    const parent = byId.get(String(n.parentId));
    if (!parent) return { ...n, parentId: undefined };
    if (!isContainerNode(parent)) return { ...n, parentId: undefined };
    return n;
  });
  return { ...spec, nodes: nextNodes };
}

async function normalizeResourceKindsToCatalog(spec, { provider = "aws", log = false } = {}) {
  const out = { ...spec, nodes: [...(spec.nodes || [])] };
  let changed = 0;

  for (let i = 0; i < out.nodes.length; i++) {
    const node = out.nodes[i];
    if (!node || typeof node !== "object") continue;
    if (isContainerNode(node)) {
      if (String(provider || "").toLowerCase() === "aws") continue;
      if (isGenericKind(node.kind)) continue;
    }

    const kind = String(node.kind || "").trim();
    if (!kind || isGenericKind(kind)) continue;

    const existing = await lookupCatalogIcon(provider, kind);
    if (existing) continue; // already a catalog id

    const label = normLabel(node.label || "");
    const fallbackQuery = kind.startsWith("aws.") ? kind.slice(4) : kind;
    const query = label || fallbackQuery || kind;

    const matches = await searchCatalogIcons({ provider, query, type: "resource", limit: 1 });
    const pick = matches?.[0]?.id || null;
    if (!pick) continue;

    if (log) {
      console.log("[diagram_spec_kind_normalize]", {
        nodeId: node.id,
        from: kind,
        to: pick,
        query,
      });
    }

    out.nodes[i] = { ...node, kind: pick };
    changed += 1;
  }

  return { spec: out, changed };
}

function compactDiagramSpecForPrompt(spec) {
  const nodes = (spec?.nodes || []).map((n) => ({
    id: n.id,
    kind: n.kind,
    label: n.label,
    parentId: n.parentId,
    style: n.style?.variant ? { variant: n.style.variant } : n.style,
  }));
  const edges = (spec?.edges || []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    style: e.style,
  }));
  return { version: spec?.version || "1.0", nodes, edges, layout: spec?.layout || { mode: "manual" } };
}

export function mergePriorPositions(prior, next) {
  const priorById = mapById(prior.nodes || []);
  const mergedNodes = (next.nodes || []).map((n) => {
    const p = priorById.get(String(n.id));
    if (!p) return n;
    return {
      ...n,
      x: n.x ?? p.x,
      y: n.y ?? p.y,
      w: n.w ?? p.w,
      h: n.h ?? p.h,
      parentId: n.parentId ?? p.parentId,
    };
  });
  return { ...next, nodes: mergedNodes };
}

async function parseAndValidateSpecFromModel(text) {
  const rawJson = extractJsonObject(text);
  if (!rawJson) throw new Error("Model did not return JSON");
  let spec;
  try {
    spec = JSON.parse(rawJson);
  } catch (e) {
    throw new Error(`Failed to parse JSON: ${e.message}`);
  }
  return validateDiagramSpec(spec);
}

export async function createDiagramSpec({ provider, message, history, log = false } = {}) {
  const result = await runDiagramSpecAgent({
    history,
    maxTurns: 8,
    message: `Provider: ${provider}\nCreate a diagram spec for:\n${message}`,
  });

  let spec = await parseAndValidateSpecFromModel(result.text);
  spec = enforceContainerParenting(spec);
  const normalized = await normalizeResourceKindsToCatalog(spec, { provider, log });
  return { history: result.history, spec: normalized.spec, normalizedKinds: normalized.changed };
}

export async function updateDiagramSpec({ provider, instruction, priorSpec, history, log = false } = {}) {
  const result = await runDiagramSpecAgent({
    history,
    maxTurns: 10,
    message: `Provider: ${provider}\nUpdate request: ${instruction}\n\nCurrent spec:\n${JSON.stringify(compactDiagramSpecForPrompt(priorSpec), null, 2)}\n\nReturn the full updated DiagramSpec JSON (no markdown).`,
  });

  let spec = await parseAndValidateSpecFromModel(result.text);
  spec = enforceContainerParenting(spec);
  spec = mergePriorPositions(priorSpec, spec);
  const normalized = await normalizeResourceKindsToCatalog(spec, { provider, log });
  return { history: result.history, spec: normalized.spec, normalizedKinds: normalized.changed };
}
