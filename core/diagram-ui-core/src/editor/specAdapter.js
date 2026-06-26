import { MarkerType } from "reactflow";
import { resolveIcon } from "./icons";

const LEAF_W = 160;
const LEAF_H = 132;
const DEFAULT_CONTAINER_W = 520;
const DEFAULT_CONTAINER_H = 360;

function clampNumber(v, fallback) {
  if (typeof v !== "number" || Number.isNaN(v)) return fallback;
  return v;
}

function isContainerNode(n) {
  return String(n?.style?.variant || "").toLowerCase() === "container";
}

function isContainerSpecNode(n) {
  return String(n?.style?.variant || "").toLowerCase() === "container";
}

function edgeRouteToFlowType(route) {
  const r = String(route || "").toLowerCase();
  if (r === "step" || r === "straight" || r === "smoothstep") return r;
  return "straight";
}

function flowTypeToEdgeRoute(type) {
  const t = String(type || "").toLowerCase();
  if (t === "step" || t === "straight" || t === "smoothstep") return t;
  return "straight";
}

function nodeSizeForFlowNode(n) {
  if (n?.type === "containerNode") {
    const w = Number(n?.style?.width || DEFAULT_CONTAINER_W);
    const h = Number(n?.style?.height || DEFAULT_CONTAINER_H);
    return { w: Number.isFinite(w) ? w : DEFAULT_CONTAINER_W, h: Number.isFinite(h) ? h : DEFAULT_CONTAINER_H };
  }
  return { w: LEAF_W, h: LEAF_H };
}

function chooseHandleIds(sourceRect, targetRect) {
  const dx = targetRect.cx - sourceRect.cx;
  const dy = targetRect.cy - sourceRect.cy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { sourceHandle: "r", targetHandle: "l" } : { sourceHandle: "l", targetHandle: "r" };
  }
  return dy >= 0 ? { sourceHandle: "b", targetHandle: "t" } : { sourceHandle: "t", targetHandle: "b" };
}

export function assignEdgeHandles(flowNodes, flowEdges) {
  const byId = new Map((flowNodes || []).map((n) => [String(n.id), n]));
  const absCache = new Map();

  function absTopLeft(id, seen = new Set()) {
    const key = String(id);
    if (absCache.has(key)) return absCache.get(key);
    const n = byId.get(key);
    if (!n) return null;
    if (seen.has(key)) return { x: n.position?.x || 0, y: n.position?.y || 0 };
    seen.add(key);
    const localX = Number(n.position?.x || 0);
    const localY = Number(n.position?.y || 0);
    if (n.parentNode) {
      const parent = absTopLeft(n.parentNode, seen);
      const out = parent ? { x: parent.x + localX, y: parent.y + localY } : { x: localX, y: localY };
      absCache.set(key, out);
      return out;
    }
    const out = { x: localX, y: localY };
    absCache.set(key, out);
    return out;
  }

  function rectFor(id) {
    const n = byId.get(String(id));
    if (!n) return null;
    const pos = absTopLeft(n.id);
    if (!pos) return null;
    const { w, h } = nodeSizeForFlowNode(n);
    return { x: pos.x, y: pos.y, w, h, cx: pos.x + w / 2, cy: pos.y + h / 2 };
  }

  return (flowEdges || []).map((e) => {
    const s = rectFor(e.source);
    const t = rectFor(e.target);
    if (!s || !t) return e;
    const { sourceHandle, targetHandle } = chooseHandleIds(s, t);
    return { ...e, sourceHandle, targetHandle };
  });
}

const CONTAINER_TINTS = [
  { bg: "rgba(238, 242, 255, 0.14)", border: "rgba(129, 140, 248, 0.55)" }, // indigo
  { bg: "rgba(236, 253, 245, 0.12)", border: "rgba(16, 185, 129, 0.45)" }, // green
  { bg: "rgba(239, 246, 255, 0.14)", border: "rgba(59, 130, 246, 0.40)" }, // blue
  { bg: "rgba(250, 245, 255, 0.12)", border: "rgba(168, 85, 247, 0.40)" }, // purple
  { bg: "rgba(255, 251, 235, 0.12)", border: "rgba(245, 158, 11, 0.40)" }, // amber
];

function containerTintByDepth(depth) {
  const d = Math.max(0, Number.isFinite(depth) ? depth : 0);
  return CONTAINER_TINTS[d % CONTAINER_TINTS.length];
}

export function specToFlow(spec, { provider = "aws" } = {}) {
  const nodes = [];
  const edges = [];

  const specNodes = Array.isArray(spec?.nodes) ? spec.nodes : [];
  const specEdges = Array.isArray(spec?.edges) ? spec.edges : [];

  const specNodeById = new Map();
  for (const n of specNodes) specNodeById.set(String(n.id), n);

  function findContainerAncestor(id) {
    let cur = specNodeById.get(String(id));
    const seen = new Set();
    while (cur) {
      if (isContainerSpecNode(cur)) return String(cur.id);
      const pid = cur.parentId ? String(cur.parentId) : null;
      if (!pid) return null;
      if (seen.has(pid)) return null;
      seen.add(pid);
      cur = specNodeById.get(pid);
    }
    return null;
  }

  function absPosWithinContainer(nodeId, containerId) {
    const target = String(containerId || "");
    let cur = specNodeById.get(String(nodeId));
    const seen = new Set();
    let x = 0;
    let y = 0;
    while (cur) {
      if (String(cur.id) === target) return { ok: true, x, y };
      x += typeof cur.x === "number" && Number.isFinite(cur.x) ? cur.x : 0;
      y += typeof cur.y === "number" && Number.isFinite(cur.y) ? cur.y : 0;
      const pid = cur.parentId ? String(cur.parentId) : null;
      if (!pid) break;
      if (seen.has(pid)) break;
      seen.add(pid);
      cur = specNodeById.get(pid);
    }
    return { ok: false, x, y };
  }

  // Some specs may incorrectly set parentId to a non-container node. Treat those as "soft groups":
  // re-parent them to the nearest container ancestor and auto-place them near the parent resource.
  const softGroups = new Map(); // resourceParentId -> childIds[]
  for (const n of specNodes) {
    if (!n?.parentId) continue;
    const parent = specNodeById.get(String(n.parentId));
    if (!parent) continue;
    if (isContainerSpecNode(parent)) continue;
    const key = String(n.parentId);
    if (!softGroups.has(key)) softGroups.set(key, []);
    softGroups.get(key).push(String(n.id));
  }
  for (const [k, arr] of softGroups) {
    arr.sort();
    softGroups.set(k, arr);
  }
  const softIndex = new Map(); // childId -> { parentId, index }
  for (const [parentId, arr] of softGroups) {
    for (let i = 0; i < arr.length; i++) softIndex.set(arr[i], { parentId, index: i });
  }

  function parentDepth(id) {
    let depth = 0;
    const visited = new Set();
    let cur = specNodeById.get(String(id));
    while (cur?.parentId) {
      const pid = String(cur.parentId);
      if (visited.has(pid)) break;
      visited.add(pid);
      depth += 1;
      cur = specNodeById.get(pid);
    }
    return depth;
  }

  const sorted = [...specNodes].sort((a, b) => parentDepth(a.id) - parentDepth(b.id));

  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i];
    const isContainer = isContainerNode(n);
    const depth = parentDepth(n.id);
    const effectiveKind = !isContainer && n?.iconKey ? String(n.iconKey) : String(n?.kind || "");
    const { src, fallbackSrc } = resolveIcon(effectiveKind, n?.label, provider);
    const zFromSpec = Number(n?.style?.zIndex);
    const leafZ = Number.isFinite(zFromSpec) ? zFromSpec : 10;
    const fallbackW = isContainer ? 520 : undefined;
    const fallbackH = isContainer ? 360 : undefined;
    const tint = isContainer ? containerTintByDepth(depth) : null;

    let flowParentNode = null;
    let softGroupPos = null;
    if (n.parentId) {
      const directParent = specNodeById.get(String(n.parentId));
      if (directParent && isContainerSpecNode(directParent)) {
        flowParentNode = String(n.parentId);
      } else if (directParent && !isContainer) {
        const containerId = findContainerAncestor(n.parentId);
        if (containerId) {
          flowParentNode = containerId;
          const idx = softIndex.get(String(n.id));
          const groupIndex = idx?.index ?? 0;
          const parentAbs = absPosWithinContainer(String(n.parentId), containerId);
          const shouldAutoPlace =
            !(typeof n.x === "number" && Number.isFinite(n.x) && typeof n.y === "number" && Number.isFinite(n.y)) ||
            (Math.abs(Number(n.x || 0)) < 1 && Math.abs(Number(n.y || 0)) < 1) ||
            Number(n.y) < 0;
          const cols = 2;
          const col = groupIndex % cols;
          const row = Math.floor(groupIndex / cols);
          const dx = LEAF_W + 28 + col * (LEAF_W + 24);
          const dy = row * (LEAF_H + 22);
          if (shouldAutoPlace && parentAbs.ok) {
            softGroupPos = { x: parentAbs.x + dx, y: parentAbs.y + dy };
          } else if (parentAbs.ok) {
            softGroupPos = { x: parentAbs.x + Number(n.x || 0), y: parentAbs.y + Number(n.y || 0) };
          }
        }
      }
    }

    nodes.push({
      id: String(n.id),
      type: isContainer ? "containerNode" : "cloudNode",
      zIndex: isContainer ? 0 : leafZ,
      position: {
        x: clampNumber(softGroupPos?.x ?? n.x, 40 + (i % 4) * 220),
        y: clampNumber(softGroupPos?.y ?? n.y, 40 + Math.floor(i / 4) * 160),
      },
      ...(flowParentNode ? { parentNode: String(flowParentNode), extent: "parent" } : {}),
      ...(isContainer
        ? {
            style: {
              width: clampNumber(n.w, fallbackW),
              height: clampNumber(n.h, fallbackH),
            },
          }
        : {}),
      data: {
        label: n.label || "",
        kind: effectiveKind,
        iconSrc: src,
        fallbackIconSrc: fallbackSrc,
        ...(isContainer ? { containerDepth: depth, containerBg: tint?.bg, containerBorder: tint?.border } : {}),
      },
    });
  }

  for (const e of specEdges) {
    const arrow = e.style?.arrow !== false;
    const stroke = "#334155";
    edges.push({
      id: String(e.id),
      source: String(e.source),
      target: String(e.target),
      type: edgeRouteToFlowType(e.style?.route),
      label: e.label || "",
      markerEnd: arrow ? { type: MarkerType.ArrowClosed, color: stroke } : undefined,
      zIndex: 5,
      style: {
        stroke,
        strokeWidth: 2.4,
        ...(e.style?.dashed ? { strokeDasharray: "6 4" } : {}),
      },
      interactionWidth: 20,
    });
  }

  return { nodes, edges: assignEdgeHandles(nodes, edges) };
}

export function flowToSpec({ spec, nodes, edges }) {
  const nodeById = new Map((nodes || []).map((n) => [n.id, n]));

  const nextNodes = (spec?.nodes || []).map((n) => {
    const flow = nodeById.get(n.id);
    if (!flow?.position) return n;
    const parentId = flow.parentNode ? String(flow.parentNode) : undefined;
    const next = { ...n, x: flow.position.x, y: flow.position.y, ...(parentId ? { parentId } : { parentId: undefined }) };
    if (flow.type === "containerNode") {
      const w = Number(flow.style?.width ?? flow.width);
      const h = Number(flow.style?.height ?? flow.height);
      if (Number.isFinite(w)) next.w = w;
      if (Number.isFinite(h)) next.h = h;
      if (!next.style || typeof next.style !== "object") next.style = { variant: "container" };
    } else {
      const z = Number(flow.zIndex);
      if (Number.isFinite(z)) {
        if (!next.style || typeof next.style !== "object") next.style = {};
        next.style = { ...(next.style || {}), zIndex: z };
      }
    }
    // Drop legacy iconKey: `kind` is the single icon identifier for resources going forward.
    // (Containers still use semantic kinds like aws.vpc/aws.subnet and resolve their icons via mapping.)
    const { iconKey: _iconKey, ...rest } = next;
    return rest;
  });

  const nextEdges = (edges || []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    ...(e.label ? { label: String(e.label) } : {}),
    style: {
      route: flowTypeToEdgeRoute(e.type),
      ...(e.style?.strokeDasharray ? { dashed: true } : {}),
      ...(e.markerEnd ? { arrow: true } : { arrow: false }),
    },
  }));

  return {
    version: spec?.version || "1.0",
    layout: spec?.layout || { mode: "manual" },
    nodes: nextNodes,
    edges: nextEdges,
    ...(spec?.groups ? { groups: spec.groups } : {}),
  };
}
