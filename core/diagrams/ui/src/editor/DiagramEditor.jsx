import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  getNodesBounds,
  getViewportForBounds,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { toPng } from "html-to-image";

import { CloudNode } from "./CloudNode";
import { ContainerNode } from "./ContainerNode";
import { assignEdgeHandles, flowToSpec, specToFlow } from "./specAdapter";
import { resolveIcon } from "./icons";
import { autoLayoutDiagramSpec } from "./layout/autoLayout";
import { IconCatalogModal } from "./IconCatalogModal";

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const CLOUD_NODE_W = 160;
const CLOUD_NODE_H = 132;
const CONTAINER_HEADER_H = 42;
const CONTAINER_INNER_PAD = 12;

function centeredChildPos(parentW, parentH) {
  const innerW = Math.max(0, (parentW || 0) - CONTAINER_INNER_PAD * 2);
  const innerH = Math.max(0, (parentH || 0) - CONTAINER_HEADER_H - CONTAINER_INNER_PAD * 2);
  const x = CONTAINER_INNER_PAD + Math.max(0, (innerW - CLOUD_NODE_W) / 2);
  const y = CONTAINER_HEADER_H + CONTAINER_INNER_PAD + Math.max(0, (innerH - CLOUD_NODE_H) / 2);
  return { x: Math.round(x), y: Math.round(y) };
}

function kindFromService(service) {
  const raw = String(service || "").toLowerCase();
  const stripped = raw.replace(/^amazon-/, "").replace(/^aws-/, "");
  const slug = stripped.replace(/[^a-z0-9]+/g, "");
  return slug ? `aws.${slug}` : "aws.resource";
}

function labelFromService(service) {
  const s = String(service || "");
  return s.replace(/^Amazon-/i, "").replace(/^AWS-/i, "").replace(/-/g, " ").trim();
}

function parseAwsCatalogId(id) {
  const base = String(id || "");
  const parts = base.split("_");

  if (parts[0] === "Res") {
    const sizePartIdx = parts.findIndex((p) => /^[0-9]{2,3}$/.test(p));
    if (sizePartIdx > 1) {
      const nameParts = parts.slice(1, sizePartIdx);
      const service = nameParts[0] || "";
      const resource = nameParts.slice(1).join("_") || "";
      return { service, resource };
    }
  }

  if (parts[0] === "Arch") {
    const sizePartIdx = parts.findIndex((p) => /^[0-9]{2,3}$/.test(p));
    if (sizePartIdx > 1) {
      const service = parts.slice(1, sizePartIdx).join("_") || "";
      return { service, resource: "" };
    }
  }

  const withoutSize = base.replace(/_[0-9]{2,3}(_Dark)?$/i, "");
  return { service: "", resource: withoutSize };
}

function labelFromCatalogEntry(entry) {
  if (!entry?.id) return "Resource";
  const parsed = parseAwsCatalogId(entry.id);
  if (parsed.resource) return labelFromContainerIconId(parsed.resource);
  if (parsed.service) return labelFromService(parsed.service || entry.service);
  if (entry.service) return labelFromService(entry.service);
  return labelFromContainerIconId(entry.id);
}

function containerKindFromIconId(iconId) {
  const id = String(iconId || "");
  if (/AWS-Account/i.test(id)) return "aws.account";
  if (/Region/i.test(id)) return "aws.region";
  if (/Virtual-private-cloud-VPC/i.test(id)) return "aws.vpc";
  if (/Public-subnet|Private-subnet/i.test(id)) return "aws.subnet";
  return "aws.container";
}

function labelFromContainerIconId(iconId) {
  const id = String(iconId || "");
  return id
    .replace(/_32.*$/i, "")
    .replace(/_64.*$/i, "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function withContainerResizeConstraints(nodesList) {
  const nodes = Array.isArray(nodesList) ? nodesList : [];
  const byId = new Map(nodes.map((n) => [String(n.id), n]));
  const childrenByParent = new Map();
  for (const n of nodes) {
    if (!n?.parentNode) continue;
    const pid = String(n.parentNode);
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
    childrenByParent.get(pid).push(n);
  }

  const MARGIN = 18;
  const CHILD_PAD = 14;

  return nodes.map((n) => {
    if (n.type !== "containerNode") return n;
    const parentId = n.parentNode ? String(n.parentNode) : null;

    // Minimum size based on children so ReactFlow doesn't clamp children into a pile when a container gets too small.
    const kids = childrenByParent.get(String(n.id)) || [];
    let requiredMinW = 360;
    let requiredMinH = 220;
    if (kids.length > 0) {
      let maxX = 0;
      let maxY = 0;
      for (const k of kids) {
        const kx = Number(k.position?.x || 0);
        const ky = Number(k.position?.y || 0);
        const kw =
          k.type === "containerNode"
            ? Number(k.style?.width ?? k.width ?? 520)
            : CLOUD_NODE_W;
        const kh =
          k.type === "containerNode"
            ? Number(k.style?.height ?? k.height ?? 360)
            : CLOUD_NODE_H;
        if (Number.isFinite(kx) && Number.isFinite(kw)) maxX = Math.max(maxX, kx + kw);
        if (Number.isFinite(ky) && Number.isFinite(kh)) maxY = Math.max(maxY, ky + kh);
      }
      requiredMinW = Math.max(requiredMinW, Math.ceil(maxX + CHILD_PAD));
      requiredMinH = Math.max(requiredMinH, Math.ceil(maxY + CHILD_PAD));
    }

    if (!parentId) {
      const curW = Number(n.style?.width || n.width);
      const curH = Number(n.style?.height || n.height);
      const nextW = Number.isFinite(curW) ? Math.max(curW, requiredMinW) : curW;
      const nextH = Number.isFinite(curH) ? Math.max(curH, requiredMinH) : curH;
      const nextStyle =
        Number.isFinite(nextW) || Number.isFinite(nextH)
          ? {
              ...(n.style || {}),
              ...(Number.isFinite(nextW) ? { width: nextW } : {}),
              ...(Number.isFinite(nextH) ? { height: nextH } : {}),
            }
          : n.style;
      const nextData = { ...(n.data || {}), resizeMaxW: undefined, resizeMaxH: undefined, resizeMinW: requiredMinW, resizeMinH: requiredMinH };
      if (
        nextStyle === n.style &&
        n.data?.resizeMinW === requiredMinW &&
        n.data?.resizeMinH === requiredMinH &&
        n.data?.resizeMaxW === undefined &&
        n.data?.resizeMaxH === undefined
      )
        return n;
      return { ...n, style: nextStyle, data: nextData };
    }

    const parent = byId.get(parentId);
    const parentW = Number(parent?.style?.width || parent?.width);
    const parentH = Number(parent?.style?.height || parent?.height);
    const x0 = Number(n.position?.x || 0);
    const y0 = Number(n.position?.y || 0);

    if (!Number.isFinite(parentW) || !Number.isFinite(parentH)) return n;

    const curW0 = Number(n.style?.width || n.width);
    const curH0 = Number(n.style?.height || n.height);

    let x = x0;
    let y = y0;
    let w = curW0;
    let h = curH0;

    // Keep child containers within their parent bounds on all sides. This prevents "resizing larger than parent"
    // by dragging the left/top resizer handles past x/y=0.
    if (Number.isFinite(x) && x < 0) {
      if (Number.isFinite(w)) w = w + x; // keep right edge constant
      x = 0;
    }
    if (Number.isFinite(y) && y < 0) {
      if (Number.isFinite(h)) h = h + y; // keep bottom edge constant
      y = 0;
    }

    const maxW = Math.max(1, Math.floor(parentW - x - MARGIN));
    const maxH = Math.max(1, Math.floor(parentH - y - MARGIN));
    const minW = Math.min(requiredMinW, maxW);
    const minH = Math.min(requiredMinH, maxH);

    const clampedW = Number.isFinite(w) ? Math.min(maxW, Math.max(minW, w)) : w;
    const clampedH = Number.isFinite(h) ? Math.min(maxH, Math.max(minH, h)) : h;

    const nextStyle =
      Number.isFinite(clampedW) || Number.isFinite(clampedH)
        ? { ...(n.style || {}), ...(Number.isFinite(clampedW) ? { width: clampedW } : {}), ...(Number.isFinite(clampedH) ? { height: clampedH } : {}) }
        : n.style;

    const nextPosition =
      (Number.isFinite(x) && x !== x0) || (Number.isFinite(y) && y !== y0)
        ? { ...(n.position || {}), ...(Number.isFinite(x) ? { x } : {}), ...(Number.isFinite(y) ? { y } : {}) }
        : n.position;

    const nextData = { ...(n.data || {}), resizeMaxW: maxW, resizeMaxH: maxH, resizeMinW: minW, resizeMinH: minH };

    if (
      nextStyle === n.style &&
      nextPosition === n.position &&
      n.data?.resizeMaxW === nextData.resizeMaxW &&
      n.data?.resizeMaxH === nextData.resizeMaxH &&
      n.data?.resizeMinW === nextData.resizeMinW &&
      n.data?.resizeMinH === nextData.resizeMinH
    )
      return n;
    return { ...n, position: nextPosition, style: nextStyle, data: nextData };
  });
}

function applyInteractionModeToNodes(nodesList, { disableResize = false } = {}) {
  return (Array.isArray(nodesList) ? nodesList : []).map((node) => ({
    ...node,
    data: {
      ...(node.data || {}),
      disableResize,
    },
  }));
}

export function DiagramEditor({
  initialSpec,
  onSpecChange,
  layoutHintNonce = 0,
  provider = "aws",
  onToggleFullscreen,
  isFullscreen = false,
  fullscreenEnabled = true,
  interactionMode = "full",
}) {
  const isMoveOnly = interactionMode === "move-only";
  const [spec, setSpec] = useState(() => deepCopy(initialSpec));
  const [catalogModal, setCatalogModal] = useState(null); // { type, purpose }
  const [exportModal, setExportModal] = useState(null); // { dataUrl?: string, error?: string }
  const [exporting, setExporting] = useState(false);
  const reactFlowRef = useRef(null);
  const specRef = useRef(spec);
  const canvasRef = useRef(null);
  const [layoutHintActive, setLayoutHintActive] = useState(false);

  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const applyingHistoryRef = useRef(false);
  const lastUndoPushMsRef = useRef(0);
  const lastUndoKeyRef = useRef("");

  const initialFlow = useMemo(() => specToFlow(initialSpec, { provider }), [initialSpec, provider]);
  const [nodes, setNodes] = useState(
    applyInteractionModeToNodes(withContainerResizeConstraints(initialFlow.nodes), {
      disableResize: isMoveOnly,
    })
  );
  const [edges, setEdges] = useState(initialFlow.edges);
  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);
  const selectedEdges = useMemo(() => edges.filter((e) => e.selected), [edges]);
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const selectedEdge = selectedEdges.length === 1 ? selectedEdges[0] : null;

  const nodeTypes = useMemo(() => ({ cloudNode: CloudNode, containerNode: ContainerNode }), []);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, kind: "node" | "edge", id }
  const [propertiesModalNodeId, setPropertiesModalNodeId] = useState(null);
  const [propertiesModalEdgeId, setPropertiesModalEdgeId] = useState(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addBtnRef = useRef(null);
  const [addMenuPos, setAddMenuPos] = useState(null); // { x, y }

  useEffect(() => {
    specRef.current = spec;
  }, [spec]);

  useEffect(() => {
    const nextSpec = deepCopy(initialSpec);
    const { nodes: nextNodes, edges: nextEdges } = specToFlow(nextSpec, { provider });
    setSpec(nextSpec);
    setNodes(
      applyInteractionModeToNodes(withContainerResizeConstraints(nextNodes), {
        disableResize: isMoveOnly,
      })
    );
    setEdges(nextEdges);
    setCatalogModal(null);
    setAddMenuOpen(false);
    setAddMenuPos(null);

    // Reset undo/redo when a new spec is loaded (generate/update/reset).
    undoRef.current = [];
    redoRef.current = [];
    lastUndoPushMsRef.current = 0;
    lastUndoKeyRef.current = "";
    setContextMenu(null);
    setPropertiesModalEdgeId(null);
  }, [initialSpec, isMoveOnly, provider]);

  useEffect(() => {
    if (!layoutHintNonce) return;
    setLayoutHintActive(true);
    const t = setTimeout(() => setLayoutHintActive(false), 6500);
    return () => clearTimeout(t);
  }, [layoutHintNonce]);

  const pushUndoSnapshot = useCallback(({ coalesceKey, minIntervalMs = 700 } = {}) => {
    if (applyingHistoryRef.current) return;
    const now = Date.now();
    const key = String(coalesceKey || "");
    if (now - lastUndoPushMsRef.current < minIntervalMs && lastUndoKeyRef.current === key) return;
    undoRef.current.push(deepCopy(specRef.current));
    if (undoRef.current.length > 60) undoRef.current.shift();
    redoRef.current = [];
    lastUndoPushMsRef.current = now;
    lastUndoKeyRef.current = key;
  }, []);

  const applySpecSnapshot = useCallback(
    (nextSpec) => {
      const snap = deepCopy(nextSpec || {});
      const { nodes: flowNodes, edges: flowEdges } = specToFlow(snap, { provider });
      const constrained = applyInteractionModeToNodes(
        withContainerResizeConstraints(flowNodes),
        {
          disableResize: isMoveOnly,
        }
      );
      const nextEdges = assignEdgeHandles(constrained, flowEdges);

      applyingHistoryRef.current = true;
      specRef.current = snap;
      setSpec(snap);
      onSpecChange?.(snap);
      setNodes(constrained);
      setEdges(nextEdges);
      setAddMenuOpen(false);
      setAddMenuPos(null);
      applyingHistoryRef.current = false;
    },
    [isMoveOnly, onSpecChange, provider]
  );

  const canUndo = undoRef.current.length > 0;
  const canRedo = redoRef.current.length > 0;

  const doUndo = useCallback(() => {
    if (undoRef.current.length === 0) return;
    const cur = specRef.current;
    const prev = undoRef.current.pop();
    redoRef.current.push(deepCopy(cur));
    if (redoRef.current.length > 60) redoRef.current.shift();
    applySpecSnapshot(prev);
  }, [applySpecSnapshot]);

  const doRedo = useCallback(() => {
    if (redoRef.current.length === 0) return;
    const cur = specRef.current;
    const next = redoRef.current.pop();
    undoRef.current.push(deepCopy(cur));
    if (undoRef.current.length > 60) undoRef.current.shift();
    applySpecSnapshot(next);
  }, [applySpecSnapshot]);

  const resetDiagram = useCallback(() => {
    // Reset should be undoable.
    pushUndoSnapshot({ coalesceKey: "reset", minIntervalMs: 0 });
    const empty = {
      version: "1.0",
      layout: { mode: "manual", engine: "frontend" },
      nodes: [],
      edges: [],
    };
    applySpecSnapshot(empty);
  }, [applySpecSnapshot, pushUndoSnapshot]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = String(e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;
      const key = String(e.key || "").toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        doUndo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        doRedo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [doUndo, doRedo]);

  function commitSpec(nextSpecOrUpdater) {
    setSpec((cur) => {
      pushUndoSnapshot({ coalesceKey: `commit:${selectedNode?.id || selectedEdge?.id || ""}` });
      const next = typeof nextSpecOrUpdater === "function" ? nextSpecOrUpdater(cur) : nextSpecOrUpdater;
      onSpecChange?.(next);
      return next;
    });
  }

  const syncSpecFromFlow = useCallback(
    (nextNodes, nextEdges) => {
      setSpec((cur) => {
        const next = flowToSpec({ spec: cur, nodes: nextNodes, edges: nextEdges });
        onSpecChange?.(next);
        return next;
      });
    },
    [onSpecChange]
  );

  const onNodesChange = useCallback(
    (changes) => {
      const shouldSync =
        changes?.some(
          (c) =>
            c.type === "remove" ||
            c.type === "add" ||
            (c.type === "position" && c.dragging === false) ||
            (c.type === "dimensions" && c.resizing === false)
        ) || false;
      if (
        changes?.some(
          (c) =>
            c.type === "remove" ||
            c.type === "add" ||
            (c.type === "position" && c.dragging === false) ||
            (c.type === "dimensions" && c.resizing === false)
        )
      ) {
        pushUndoSnapshot({ coalesceKey: `flow:${selectedNode?.id || selectedEdge?.id || ""}` });
      }
      setNodes((nds) => {
        const next = applyInteractionModeToNodes(
          withContainerResizeConstraints(applyNodeChanges(changes, nds)),
          {
            disableResize: isMoveOnly,
          }
        );
        // During active dragging, ReactFlow can emit many updates. Avoid syncing the full spec
        // (and re-assigning edge handles) until the drag/resize completes to prevent update storms.
        if (shouldSync) {
          const nextEdges = assignEdgeHandles(next, edges);
          setEdges(nextEdges);
          syncSpecFromFlow(next, nextEdges);
        }
        return next;
      });
    },
    [edges, isMoveOnly, pushUndoSnapshot, selectedEdge?.id, selectedNode?.id, syncSpecFromFlow]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      if (changes?.some((c) => c.type === "remove" || c.type === "add")) {
        pushUndoSnapshot({ coalesceKey: `edgeflow:${selectedNode?.id || selectedEdge?.id || ""}` });
      }
      setEdges((eds) => {
        const next = applyEdgeChanges(changes, eds);
        syncSpecFromFlow(nodes, next);
        return next;
      });
    },
    [nodes, pushUndoSnapshot, selectedEdge?.id, selectedNode?.id, syncSpecFromFlow]
  );

  const onConnect = useCallback(
    (connection) => {
      pushUndoSnapshot({ coalesceKey: "connect", minIntervalMs: 250 });
      const edgeId = newId("e");
      const nextEdge = {
        ...connection,
        id: edgeId,
        type: "straight",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#334155" },
        style: { stroke: "#334155", strokeWidth: 2 },
        interactionWidth: 20,
      };
      setEdges((eds) => {
        const next = addEdge(nextEdge, eds);
        syncSpecFromFlow(nodes, next);
        return next;
      });
    },
    [nodes, pushUndoSnapshot, syncSpecFromFlow]
  );

  function setNodeZOrder(nodeId, mode) {
    const id = String(nodeId);
    const target = nodes.find((n) => String(n.id) === id);
    if (!target) return;
    if (target.type !== "cloudNode") return;

    const leafNodes = nodes.filter((n) => n.type === "cloudNode");
    const curZ = Number(target.zIndex ?? 10);
    const zValues = leafNodes.map((n) => Number(n.zIndex ?? 10)).filter(Number.isFinite);
    const maxZ = zValues.length ? Math.max(...zValues) : 10;
    const minZ = zValues.length ? Math.min(...zValues) : 10;

    let nextZ = curZ;
    if (mode === "front") nextZ = maxZ + 1;
    if (mode === "back") nextZ = Math.max(1, minZ - 1);
    if (!Number.isFinite(nextZ) || nextZ === curZ) return;

    setNodes((cur) => cur.map((n) => (String(n.id) === id ? { ...n, zIndex: nextZ } : n)));
    commitSpec((cur) => ({
      ...cur,
      nodes: (cur.nodes || []).map((n) =>
        String(n.id) === id ? { ...n, style: { ...(n.style || {}), zIndex: nextZ } } : n
      ),
    }));
  }

  function absTopLeftFrom(nodesList, nodeId) {
    const byId = new Map((nodesList || []).map((n) => [String(n.id), n]));
    const key = String(nodeId);
    let cur = byId.get(key);
    if (!cur) return { x: 0, y: 0 };
    let x = Number(cur.position?.x || 0);
    let y = Number(cur.position?.y || 0);
    const seen = new Set([key]);
    while (cur?.parentNode) {
      const pid = String(cur.parentNode);
      if (seen.has(pid)) break;
      seen.add(pid);
      const p = byId.get(pid);
      if (!p) break;
      x += Number(p.position?.x || 0);
      y += Number(p.position?.y || 0);
      cur = p;
    }
    return { x, y };
  }

  function isInSubtree(parentById, nodeId, maybeAncestorId) {
    let cur = String(nodeId || "");
    const target = String(maybeAncestorId || "");
    if (!cur || !target) return false;
    while (cur) {
      const pid = parentById.get(cur);
      if (!pid) return false;
      if (pid === target) return true;
      cur = pid;
    }
    return false;
  }

  function setNodeParent(nodeId, newParentId) {
    setNodes((cur) => {
      const parentById = new Map(cur.map((n) => [String(n.id), n.parentNode ? String(n.parentNode) : null]));
      const abs = absTopLeftFrom(cur, nodeId);
      const parentAbs = newParentId ? absTopLeftFrom(cur, newParentId) : { x: 0, y: 0 };
      const nextPos = { x: abs.x - parentAbs.x, y: abs.y - parentAbs.y };

      const nextNodes = cur.map((n) => {
        if (String(n.id) !== String(nodeId)) return n;
        if (!newParentId) {
          const { parentNode, extent, ...rest } = n;
          return { ...rest, position: nextPos };
        }
        return { ...n, parentNode: String(newParentId), extent: "parent", position: nextPos };
      });
      const constrained = withContainerResizeConstraints(nextNodes);
      const nextEdges = assignEdgeHandles(constrained, edges);
      setEdges(nextEdges);
      syncSpecFromFlow(constrained, nextEdges);
      return constrained;
    });
  }

  function openCatalog({ type, purpose }) {
    setCatalogModal({ type, purpose });
  }

  function addSampleNode() {
    const id = newId("n");
    const kind = "Arch_Amazon-EC2_48";
    const { src, fallbackSrc } = resolveIcon(kind, "Amazon EC2", provider);
    const targetParentId = selectedNode?.type === "containerNode" ? selectedNode.id : null;
    const parent = targetParentId ? nodes.find((n) => n.id === targetParentId) : null;
    const parentW = Number(parent?.style?.width || 0);
    const parentH = Number(parent?.style?.height || 0);
    const basePos = targetParentId ? centeredChildPos(parentW, parentH) : { x: 120, y: 120 };
    const nextNode = {
      id,
      type: "cloudNode",
      position: basePos,
      ...(targetParentId ? { parentNode: targetParentId, extent: "parent" } : {}),
      data: { label: "New node", kind, iconSrc: src, fallbackIconSrc: fallbackSrc },
    };
    const nextNodes = [...nodes, nextNode];
    const nextSpec = {
      ...spec,
      nodes: [
        ...(spec.nodes || []),
        { id, kind, label: "New node", x: basePos.x, y: basePos.y, ...(targetParentId ? { parentId: targetParentId } : {}) },
      ],
    };
    setNodes(withContainerResizeConstraints(nextNodes));
    commitSpec(nextSpec);
    setSelection({ kind: "node", id });
  }

  function updateSelectedNode(patch) {
    if (!selectedNode) return;
    setNodes((cur) =>
      cur.map((n) => {
        if (n.id !== selectedNode.id) return n;
        const nextData = { ...n.data, ...patch.data };
        return { ...n, ...patch, data: nextData };
      })
    );
    commitSpec((cur) => ({
      ...cur,
      nodes: (cur.nodes || []).map((n) => (n.id === selectedNode.id ? { ...n, ...patch.spec } : n)),
    }));
  }

  function updateModalNode(patch) {
    if (!propertiesModalNodeId) return;
    const targetId = String(propertiesModalNodeId);
    setNodes((cur) =>
      cur.map((n) => {
        if (String(n.id) !== targetId) return n;
        const nextData = { ...n.data, ...patch.data };
        return { ...n, ...patch, data: nextData };
      })
    );
    commitSpec((cur) => ({
      ...cur,
      nodes: (cur.nodes || []).map((n) => (String(n.id) === targetId ? { ...n, ...patch.spec } : n)),
    }));
  }

  function setModalNodeParent(newParentId) {
    if (!propertiesModalNodeId) return;
    setNodeParent(propertiesModalNodeId, newParentId);
  }

  function setModalNodeDimensions(dim) {
    if (!propertiesModalNodeId) return;
    const targetId = String(propertiesModalNodeId);
    setNodes((cur) =>
      withContainerResizeConstraints(
        cur.map((n) => (String(n.id) === targetId ? { ...n, style: { ...n.style, ...dim } } : n))
      )
    );
    commitSpec((cur) => ({
      ...cur,
      nodes: (cur.nodes || []).map((n) => (String(n.id) === targetId ? { ...n, ...dim } : n)),
    }));
  }

  function updateSelectedEdge(patch) {
    if (!selectedEdge) return;
    setEdges((cur) =>
      cur.map((e) => {
        if (e.id !== selectedEdge.id) return e;
        return { ...e, ...patch };
      })
    );
    commitSpec((cur) => ({
      ...cur,
      edges: (cur.edges || []).map((e) => {
        if (e.id !== selectedEdge.id) return e;
        const next = { ...e };
        if (patch.label !== undefined) next.label = patch.label;
        if (patch.type !== undefined) next.style = { ...(next.style || {}), route: String(patch.type) };
        if (Object.prototype.hasOwnProperty.call(patch, "markerEnd")) {
          next.style = { ...(next.style || {}), arrow: Boolean(patch.markerEnd) };
        }
        if (
          Object.prototype.hasOwnProperty.call(patch, "style") &&
          patch.style &&
            Object.prototype.hasOwnProperty.call(patch.style, "strokeDasharray")
        ) {
          next.style = { ...(next.style || {}), dashed: Boolean(patch.style.strokeDasharray) };
        }
        return next;
      }),
    }));
  }

  const nodeById = useMemo(() => new Map(nodes.map((n) => [String(n.id), n])), [nodes]);
  const propertiesModalNode = useMemo(
    () => (propertiesModalNodeId ? nodes.find((n) => String(n.id) === String(propertiesModalNodeId)) : null),
    [nodes, propertiesModalNodeId]
  );
  const propertiesModalEdge = useMemo(
    () => (propertiesModalEdgeId ? edges.find((e) => String(e.id) === String(propertiesModalEdgeId)) : null),
    [edges, propertiesModalEdgeId]
  );
  const connectionsFrom = useMemo(() => {
    if (!propertiesModalNode) return [];
    return edges.filter((e) => String(e.source) === String(propertiesModalNode.id));
  }, [edges, propertiesModalNode]);
  const connectionsTo = useMemo(() => {
    if (!propertiesModalNode) return [];
    return edges.filter((e) => String(e.target) === String(propertiesModalNode.id));
  }, [edges, propertiesModalNode]);

  function selectNodeById(id) {
    const nodeId = String(id);
    setNodes((cur) => cur.map((n) => ({ ...n, selected: String(n.id) === nodeId })));
    setEdges((cur) => cur.map((e) => ({ ...e, selected: false })));
    setContextMenu(null);
  }

  function setSelection(selection) {
    if (!selection?.kind || selection?.id === undefined || selection?.id === null) {
      setNodes((cur) => cur.map((n) => ({ ...n, selected: false })));
      setEdges((cur) => cur.map((e) => ({ ...e, selected: false })));
      setContextMenu(null);
      return;
    }

    const targetId = String(selection.id);
    if (selection.kind === "node") {
      setNodes((cur) => cur.map((n) => ({ ...n, selected: String(n.id) === targetId })));
      setEdges((cur) => cur.map((e) => ({ ...e, selected: false })));
      setContextMenu(null);
      return;
    }

    if (selection.kind === "edge") {
      setNodes((cur) => cur.map((n) => ({ ...n, selected: false })));
      setEdges((cur) => cur.map((e) => ({ ...e, selected: String(e.id) === targetId })));
      setContextMenu(null);
    }
  }

  function deleteNodeById(nodeId) {
    const targetId = String(nodeId);
    const parentById = new Map(nodes.map((n) => [String(n.id), n.parentNode ? String(n.parentNode) : null]));

    // Collect node + descendants.
    const toDelete = new Set([targetId]);
    let added = true;
    while (added) {
      added = false;
      for (const n of nodes) {
        const id = String(n.id);
        const pid = parentById.get(id);
        if (pid && toDelete.has(pid) && !toDelete.has(id)) {
          toDelete.add(id);
          added = true;
        }
      }
    }

    pushUndoSnapshot({ coalesceKey: `delete:${targetId}`, minIntervalMs: 0 });
    const nextNodesRaw = nodes.filter((n) => !toDelete.has(String(n.id))).map((n) => ({ ...n, selected: false }));
    const nextNodes = withContainerResizeConstraints(nextNodesRaw);
    const nextEdges = edges
      .filter((e) => !toDelete.has(String(e.source)) && !toDelete.has(String(e.target)))
      .map((e) => ({ ...e, selected: false }));
    setNodes(nextNodes);
    setEdges(nextEdges);
    syncSpecFromFlow(nextNodes, nextEdges);
    setContextMenu(null);
    setPropertiesModalNodeId(null);
    setPropertiesModalEdgeId(null);
  }

  function deleteEdgeById(edgeId) {
    const targetId = String(edgeId);
    pushUndoSnapshot({ coalesceKey: `deleteEdge:${targetId}`, minIntervalMs: 0 });
    const nextEdges = edges.filter((e) => String(e.id) !== targetId).map((e) => ({ ...e, selected: false }));
    const nextNodes = nodes.map((n) => ({ ...n, selected: false }));
    setNodes(nextNodes);
    setEdges(nextEdges);
    syncSpecFromFlow(nextNodes, nextEdges);
    setContextMenu(null);
    setPropertiesModalEdgeId(null);
  }

  function updateEdgeById(edgeId, patch) {
    const id = String(edgeId);
    setEdges((cur) => cur.map((e) => (String(e.id) === id ? { ...e, ...patch } : e)));
    commitSpec((cur) => ({
      ...cur,
      edges: (cur.edges || []).map((e) => {
        if (String(e.id) !== id) return e;
        const next = { ...e };
        if (patch.label !== undefined) next.label = patch.label;
        if (patch.type !== undefined) next.style = { ...(next.style || {}), route: String(patch.type) };
        if (Object.prototype.hasOwnProperty.call(patch, "markerEnd")) {
          next.style = { ...(next.style || {}), arrow: Boolean(patch.markerEnd) };
        }
        if (
          Object.prototype.hasOwnProperty.call(patch, "style") &&
          patch.style &&
          Object.prototype.hasOwnProperty.call(patch.style, "strokeDasharray")
        ) {
          next.style = { ...(next.style || {}), dashed: Boolean(patch.style.strokeDasharray) };
        }
        return next;
      }),
    }));
  }

  function toggleAddMenu() {
    const el = addBtnRef.current;
    if (!el) return setAddMenuOpen((v) => !v);
    const r = el.getBoundingClientRect();
    setAddMenuPos({ x: Math.round(r.left), y: Math.round(r.bottom + 8) });
    setAddMenuOpen((v) => !v);
  }

  useEffect(() => {
    if (!addMenuOpen) return;
    const onDown = () => setAddMenuOpen(false);
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [addMenuOpen]);

  function formatExportError(err) {
    if (!err) return "Export failed.";
    if (typeof err === "string") return err;
    // html-to-image sometimes rejects with an Event when an image fails to load.
    if (typeof Event !== "undefined" && err instanceof Event) {
      const target = err.target;
      const src = target && typeof target === "object" ? target.src || target.currentSrc : null;
      const type = err.type || "error";
      return src ? `Export failed: image load ${type} (${src})` : `Export failed: image load ${type}.`;
    }
    return err?.message || String(err);
  }

  async function waitForImages(container, { timeoutMs = 2200 } = {}) {
    if (!container) return;
    const imgs = Array.from(container.querySelectorAll("img"));
    if (imgs.length === 0) return;

    const failures = [];
    const pending = imgs.map(
      (img) =>
        new Promise((resolve) => {
          try {
            if (img.complete) {
              if (img.naturalWidth === 0) failures.push(img);
              return resolve();
            }
            const onDone = () => {
              if (img.naturalWidth === 0) failures.push(img);
              img.removeEventListener("load", onDone);
              img.removeEventListener("error", onDone);
              resolve();
            };
            img.addEventListener("load", onDone);
            img.addEventListener("error", onDone);
          } catch {
            resolve();
          }
        })
    );

    await Promise.race([
      Promise.all(pending),
      new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(timeoutMs) || 0))),
    ]);

    if (failures.length > 0) {
      const sample = failures
        .slice(0, 3)
        .map((img) => img.currentSrc || img.src || "(unknown)")
        .join(", ");
      throw new Error(
        `Export failed: ${failures.length} image(s) failed to load (${sample}).`
      );
    }
  }

  async function exportPng() {
    const wrap = canvasRef.current;
    if (!wrap) return;
    const viewport = wrap.querySelector(".react-flow__viewport");
    if (!viewport) return;

    const bounds = getNodesBounds(nodes);
    if (!bounds || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) return;

    const padding = 0.18;
    const imageWidth = Math.max(900, Math.ceil(bounds.width + 400));
    const imageHeight = Math.max(700, Math.ceil(bounds.height + 320));
    const viewportTransform = getViewportForBounds(bounds, imageWidth, imageHeight, padding, 2);

    const isEmbedded = typeof window !== "undefined" && Boolean(window.openai);
    setExporting(true);
    setExportModal(null);
    try {
      // Ensure icons/images are loaded before snapshotting; otherwise html-to-image may throw an Event.
      await waitForImages(viewport, { timeoutMs: 2400 });
      const dataUrl = await toPng(viewport, {
        backgroundColor: "#ffffff",
        width: imageWidth,
        height: imageHeight,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${viewportTransform.x}px, ${viewportTransform.y}px) scale(${viewportTransform.zoom})`,
        },
        cacheBust: true,
      });

      // Embedded hosts (e.g. ChatGPT skybridge) often block/ignore programmatic downloads.
      // Show a preview modal so users can open/save the image manually.
      if (isEmbedded) {
        setExportModal({ dataUrl });
        return;
      }

      const a = document.createElement("a");
      a.download = "diagram.png";
      a.href = dataUrl;
      a.click();
    } catch (err) {
      const message = formatExportError(err);
      setExportModal({
        error:
          message ||
          "Failed to export image. This can happen in embedded environments where downloads or canvas rendering are restricted.",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="diagram-editor">
      <div className="diagram-editor__toolbar">
        {!isMoveOnly && (
          <button ref={addBtnRef} className="primary add-btn" type="button" onClick={(e) => { e.stopPropagation(); toggleAddMenu(); }}>
            <span className="add-btn__plus">+</span> Add
          </button>
        )}
        {!isMoveOnly && (
          <button
            className={`secondary ${layoutHintActive ? "layout-btn--nudge" : ""}`}
            type="button"
            onClick={async () => {
              setLayoutHintActive(false);
              const laidOut = autoLayoutDiagramSpec(spec, { force: true, tighten: true });
              const { nodes: nextNodes, edges: nextEdges } = specToFlow(laidOut, { provider });
              const constrained = applyInteractionModeToNodes(
                withContainerResizeConstraints(nextNodes),
                {
                  disableResize: isMoveOnly,
                }
              );
              commitSpec(laidOut);
              setNodes(constrained);
              setEdges(assignEdgeHandles(constrained, nextEdges));
            }}
            disabled={false}
            title={layoutHintActive ? "New changes received — click to refresh layout" : "Compute positions using frontend auto-layout"}
          >
            Refresh layout
          </button>
        )}

        <div className="diagram-editor__toolbarSpacer" />

        <div className="diagram-editor__toolbarRight">
          <button
            className="secondary iconOnly"
            type="button"
            onClick={doUndo}
            disabled={!canUndo}
            title="Undo (Ctrl/Cmd+Z)"
            aria-label="Undo"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="iconSvg">
              <path
                d="M9 14l-4-4 4-4v3h6.1c3.2 0 5.9 2.7 5.9 5.9S18.3 20.8 15.1 20.8H10v-2h5.1c2.1 0 3.9-1.7 3.9-3.9S17.2 11 15.1 11H9v3z"
                fill="currentColor"
              />
            </svg>
          </button>
          <button
            className="secondary iconOnly"
            type="button"
            onClick={doRedo}
            disabled={!canRedo}
            title="Redo (Ctrl/Cmd+Shift+Z)"
            aria-label="Redo"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="iconSvg">
              <path
                d="M15 14v-3H8.9C6.7 11 5 12.7 5 14.9s1.7 3.9 3.9 3.9H14v2H8.9C5.7 20.8 3 18.1 3 14.9S5.7 9 8.9 9H15V6l4 4-4 4z"
                fill="currentColor"
              />
            </svg>
          </button>
          <button
            className="secondary iconOnly"
            type="button"
            onClick={() => onToggleFullscreen?.()}
            disabled={!fullscreenEnabled || !onToggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <svg viewBox="0 0 24 24" aria-hidden="true" className="iconSvg">
                <path
                  d="M9 9H5V5h4V3H3v6h6V9zm12-6h-6v2h4v4h2V3zM5 15H3v6h6v-2H5v-4zm16 0h-2v4h-4v2h6v-6z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true" className="iconSvg">
                <path
                  d="M9 3H3v6h2V5h4V3zm12 0h-6v2h4v4h2V3zM5 15H3v6h6v-2H5v-4zm16 0h-2v4h-4v2h6v-6z"
                  fill="currentColor"
                />
              </svg>
            )}
          </button>
          {!isMoveOnly && (
            <button className="secondary" type="button" onClick={resetDiagram} title="Reset diagram (undoable)">
              Reset
            </button>
          )}
          <button className="secondary exportBtn" type="button" onClick={exportPng} title="Export PNG">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="iconSvg">
              <path
                d="M12 3a1 1 0 0 1 1 1v8.17l2.59-2.58a1 1 0 1 1 1.41 1.41l-4.3 4.3a1 1 0 0 1-1.4 0l-4.3-4.3a1 1 0 1 1 1.41-1.41L11 12.17V4a1 1 0 0 1 1-1zM5 19a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1z"
                fill="currentColor"
              />
            </svg>
            Export PNG
          </button>
        </div>
      </div>

      {exportModal && (
        <div
          className="diagram-editor__modalOverlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setExportModal(null)}
        >
          <div className="diagram-editor__exportModalPanel" onMouseDown={(e) => e.stopPropagation()}>
            <div className="diagram-editor__modalHeader">
              <div className="diagram-editor__modalTitle">PNG for your diagram</div>
              <div className="diagram-editor__modalActions">
                <button type="button" className="secondary small" onClick={() => setExportModal(null)}>
                  Close
                </button>
              </div>
            </div>
            <div className="diagram-editor__exportModalBody">
              {exportModal.error ? (
                <div className="hint">{exportModal.error}</div>
              ) : exportModal.dataUrl ? (
                <>
                  <img
                    className="diagram-editor__exportPreview"
                    src={exportModal.dataUrl}
                    alt="Diagram export preview"
                  />
                  <div className="hint">
                    Right click (or long-press) the image to save it.
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {!isMoveOnly && addMenuOpen && addMenuPos && (
        <div
          className="diagram-editor__addMenu"
          style={{ left: addMenuPos.x, top: addMenuPos.y }}
          role="menu"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={() => { setAddMenuOpen(false); openCatalog({ type: "resource", purpose: "addNode" }); }}>
            Add node
          </button>
          <button type="button" onClick={() => { setAddMenuOpen(false); openCatalog({ type: "container", purpose: "addContainer" }); }}>
            Add container
          </button>
        </div>
      )}

      <div className="diagram-editor__content">
        <div ref={canvasRef} className="diagram-editor__canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={isMoveOnly ? undefined : onConnect}
            onNodeContextMenu={
              isMoveOnly
                ? undefined
                : (event, node) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setNodes((cur) => cur.map((n) => ({ ...n, selected: n.id === node.id })));
                    setEdges((cur) => cur.map((e) => ({ ...e, selected: false })));
                    setContextMenu({ x: event.clientX, y: event.clientY, kind: "node", id: node.id });
                  }
            }
            onEdgeContextMenu={
              isMoveOnly
                ? undefined
                : (event, edge) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setNodes((cur) => cur.map((n) => ({ ...n, selected: false })));
                    setEdges((cur) => cur.map((e) => ({ ...e, selected: e.id === edge.id })));
                    setContextMenu({ x: event.clientX, y: event.clientY, kind: "edge", id: edge.id });
                  }
            }
            onPaneClick={() => {
              setNodes((cur) => cur.map((n) => ({ ...n, selected: false })));
              setEdges((cur) => cur.map((e) => ({ ...e, selected: false })));
              setContextMenu(null);
            }}
            nodeTypes={nodeTypes}
            selectionOnDrag
            nodesConnectable={!isMoveOnly}
            connectOnClick={!isMoveOnly}
            deleteKeyCode={isMoveOnly ? null : ["Backspace", "Delete"]}
            minZoom={0.05}
            maxZoom={6}
            onInit={(instance) => {
              reactFlowRef.current = instance;
            }}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>

          {!isMoveOnly && contextMenu && (
            <div
              className="diagram-editor__contextMenu"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              role="menu"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {contextMenu.kind === "node" ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setPropertiesModalNodeId(contextMenu.id);
                      setContextMenu(null);
                    }}
                  >
                    Properties
                  </button>
                  <button type="button" onClick={() => deleteNodeById(contextMenu.id)}>
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setPropertiesModalEdgeId(contextMenu.id);
                      setContextMenu(null);
                    }}
                  >
                    Properties
                  </button>
                  <button type="button" onClick={() => deleteEdgeById(contextMenu.id)}>
                    Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>

      </div>

      {!isMoveOnly && propertiesModalNode && (
        <div
          className="diagram-editor__modalOverlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setPropertiesModalNodeId(null)}
        >
          <div className="diagram-editor__propsModalPanel" onMouseDown={(e) => e.stopPropagation()}>
            <div className="diagram-editor__modalHeader">
              <div className="diagram-editor__modalTitle">Properties</div>
              <div className="diagram-editor__modalActions">
                <button type="button" className="secondary small" onClick={() => setPropertiesModalNodeId(null)}>
                  Close
                </button>
              </div>
            </div>
            <div className="diagram-editor__propsModalBody">
              <div className="diagram-editor__props">
                <div className="field">
                  <label>Label</label>
                  <input
                    value={propertiesModalNode.data?.label || ""}
                    onChange={(e) =>
                      updateModalNode({ data: { label: e.target.value }, spec: { label: e.target.value } })
                    }
                  />
                </div>
                <div className="field">
                  <label>Kind</label>
                  <div className="row-two">
                    <input
                      value={propertiesModalNode.data?.kind || ""}
                      onChange={(e) => {
                        const kind = e.target.value;
                        const { src, fallbackSrc } = resolveIcon(
                          kind,
                          propertiesModalNode.data?.label,
                          provider
                        );
                        updateModalNode({
                          data: { kind, iconSrc: src, fallbackIconSrc: fallbackSrc },
                          spec: { kind: kind || "" },
                        });
                      }}
                      placeholder="e.g. Res_Amazon-DynamoDB_Table_48"
                    />
                    <button
                      type="button"
                      className="secondary small"
                      onClick={() => openCatalog({ type: propertiesModalNode.type === "containerNode" ? "container" : "resource", purpose: "editKind" })}
                    >
                      Browse…
                    </button>
                  </div>
                </div>
                <div className="field">
                  <label>Parent</label>
                  <select
                    value={propertiesModalNode.parentNode || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setModalNodeParent(v ? v : null);
                    }}
                  >
                    <option value="">(none)</option>
                    {(() => {
                      const parentById = new Map(nodes.map((n) => [String(n.id), n.parentNode ? String(n.parentNode) : null]));
                      const modalNodeIsContainer = propertiesModalNode.type === "containerNode";
                      return nodes
                        .filter((n) => n.type === "containerNode")
                        .filter((n) => n.id !== propertiesModalNode.id)
                        .filter((n) => !(modalNodeIsContainer && isInSubtree(parentById, n.id, propertiesModalNode.id)))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {(c.data?.label || c.id) + ` (${c.id})`}
                          </option>
                        ));
                    })()}
                  </select>
                </div>
                <div className="field">
                  <label>Connections from</label>
                  {connectionsFrom.length === 0 ? (
                    <div className="hint">(none)</div>
                  ) : (
                    <div className="conn-list">
                      {connectionsFrom.map((e) => {
                        const target = nodeById.get(String(e.target));
                        const label = target?.data?.label || target?.data?.kind || String(e.target);
                        return (
                          <button key={e.id} type="button" className="conn-item" onClick={() => { setPropertiesModalNodeId(e.target); }}>
                            <span className="conn-item__label">{label}</span>
                            <span className="conn-item__meta">{e.label || ""}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="field">
                  <label>Connections to</label>
                  {connectionsTo.length === 0 ? (
                    <div className="hint">(none)</div>
                  ) : (
                    <div className="conn-list">
                      {connectionsTo.map((e) => {
                        const source = nodeById.get(String(e.source));
                        const label = source?.data?.label || source?.data?.kind || String(e.source);
                        return (
                          <button key={e.id} type="button" className="conn-item" onClick={() => { setPropertiesModalNodeId(e.source); }}>
                            <span className="conn-item__label">{label}</span>
                            <span className="conn-item__meta">{e.label || ""}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {propertiesModalNode.type === "containerNode" && (
                  <>
                    <div className="field">
                      <label>Width</label>
                      <input
                        type="number"
                        value={Number(propertiesModalNode.style?.width || 520)}
                        onChange={(e) => setModalNodeDimensions({ w: Number(e.target.value), width: Number(e.target.value) })}
                      />
                    </div>
                    <div className="field">
                      <label>Height</label>
                      <input
                        type="number"
                        value={Number(propertiesModalNode.style?.height || 360)}
                        onChange={(e) => setModalNodeDimensions({ h: Number(e.target.value), height: Number(e.target.value) })}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!isMoveOnly && propertiesModalEdge && (
        <div
          className="diagram-editor__modalOverlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setPropertiesModalEdgeId(null)}
        >
          <div className="diagram-editor__propsModalPanel" onMouseDown={(e) => e.stopPropagation()}>
            <div className="diagram-editor__modalHeader">
              <div className="diagram-editor__modalTitle">Edge properties</div>
              <div className="diagram-editor__modalActions">
                <button type="button" className="secondary small" onClick={() => setPropertiesModalEdgeId(null)}>
                  Close
                </button>
              </div>
            </div>
            <div className="diagram-editor__propsModalBody">
              <div className="diagram-editor__props">
                <div className="field">
                  <label>Label</label>
                  <input
                    value={propertiesModalEdge.label || ""}
                    onChange={(e) => updateEdgeById(propertiesModalEdge.id, { label: e.target.value })}
                    placeholder="e.g. HTTPS, Reads, Writes"
                  />
                </div>
                <div className="field">
                  <label>Route</label>
                  <select
                    value={propertiesModalEdge.type || "straight"}
                    onChange={(e) => updateEdgeById(propertiesModalEdge.id, { type: e.target.value })}
                  >
                    <option value="straight">Straight</option>
                    <option value="step">Step</option>
                    <option value="smoothstep">Smooth</option>
                  </select>
                </div>
                <div className="field row">
                  <label>Arrow</label>
                  <input
                    type="checkbox"
                    checked={Boolean(propertiesModalEdge.markerEnd)}
                    onChange={(e) =>
                      updateEdgeById(propertiesModalEdge.id, {
                        markerEnd: e.target.checked ? { type: MarkerType.ArrowClosed, color: "#334155" } : undefined,
                      })
                    }
                  />
                </div>
                <div className="field row">
                  <label>Dashed</label>
                  <input
                    type="checkbox"
                    checked={Boolean(propertiesModalEdge.style?.strokeDasharray)}
                    onChange={(e) =>
                      updateEdgeById(propertiesModalEdge.id, {
                        style: {
                          ...(propertiesModalEdge.style || {}),
                          strokeDasharray: e.target.checked ? "6 4" : undefined,
                        },
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .diagram-editor { display: flex; flex-direction: column; gap: 10px; }
        .diagram-editor__toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .diagram-editor__toolbarSpacer { flex: 1; }
        .diagram-editor__toolbarRight { display: inline-flex; align-items: center; gap: 10px; }
        .diagram-editor__toolbar .iconOnly { padding: 8px 10px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; }
        .diagram-editor__toolbar .iconSvg { width: 18px; height: 18px; display: block; }
        .diagram-editor__toolbar .exportBtn { display: inline-flex; align-items: center; gap: 8px; }
        .add-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 12px; }
        .add-btn__plus { font-size: 18px; line-height: 1; font-weight: 900; }
        .diagram-editor__addMenu { position: fixed; z-index: 10000; background: #ffffff; border: 1px solid rgba(148, 163, 184, 0.65); border-radius: 12px; box-shadow: 0 16px 50px rgba(15, 23, 42, 0.18); padding: 6px; display: flex; flex-direction: column; gap: 6px; min-width: 170px; }
        .diagram-editor__addMenu button { text-align: left; padding: 8px 10px; border-radius: 10px; border: 1px solid #e2e8f0; background: #ffffff; font-weight: 800; color: #0f172a; }
        .diagram-editor__addMenu button:hover { background: #f8fafc; border-color: #94a3b8; }
        .diagram-editor__content { display: grid; gap: 12px; }
        .diagram-editor__canvas { height: 640px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff; }
        .diagram-editor__props input { padding: 8px; font-size: 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; }
        .diagram-editor__props select { padding: 8px; font-size: 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; }
        .diagram-editor__props .row { flex-direction: row; justify-content: space-between; align-items: center; }
        .diagram-editor__props .row input[type="checkbox"] { width: 18px; height: 18px; }
        .diagram-editor__props .hint { color: #64748b; font-size: 12px; margin-top: 6px; line-height: 1.25; }
        .diagram-editor__props button.small { padding: 7px 10px; border-radius: 9px; font-weight: 800; font-size: 12px; }
        .diagram-editor__props .row-two { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; }
        .conn-list { display: flex; flex-direction: column; gap: 6px; }
        .conn-item { display: flex; justify-content: space-between; gap: 10px; text-align: left; padding: 8px 10px; border-radius: 10px; border: 1px solid #e2e8f0; background: #ffffff; cursor: pointer; }
        .conn-item:hover { border-color: #94a3b8; background: #f8fafc; }
        .conn-item__label { font-weight: 800; color: #0f172a; font-size: 12px; }
        .conn-item__meta { font-size: 11px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }

        .diagram-editor__modalOverlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.50); display: flex; align-items: center; justify-content: center; padding: 24px; z-index: 10001; }
        .diagram-editor__propsModalPanel { width: min(420px, 100%); max-height: min(680px, 92vh); background: #ffffff; border-radius: 16px; border: 1px solid rgba(148, 163, 184, 0.55); box-shadow: 0 30px 80px rgba(15, 23, 42, 0.35); display: flex; flex-direction: column; overflow: hidden; }
        .diagram-editor__propsModalBody { padding: 16px; overflow-y: auto; }
        .diagram-editor__modalHeader { padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; }
        .diagram-editor__modalTitle { font-weight: 900; color: #0f172a; }
        .diagram-editor__modalActions { display: flex; gap: 8px; }
        .diagram-editor__exportModalPanel { width: min(980px, 100%); max-height: min(820px, 92vh); background: #ffffff; border-radius: 16px; border: 1px solid rgba(148, 163, 184, 0.55); box-shadow: 0 30px 80px rgba(15, 23, 42, 0.35); display: flex; flex-direction: column; overflow: hidden; }
        .diagram-editor__exportModalBody { padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
        .diagram-editor__exportPreview { width: 100%; height: auto; border-radius: 12px; border: 1px solid rgba(148, 163, 184, 0.55); background: #ffffff; }

        .container-node { width: 100%; height: 100%; border: 1.5px solid rgba(148, 163, 184, 0.70); border-radius: 14px; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06); }
        .container-node__header { padding: 10px 12px 8px; display: flex; flex-direction: column; gap: 2px; }
        .container-node__title { display: flex; align-items: center; gap: 8px; }
        .container-node__titleIcon { width: 18px; height: 18px; border-radius: 6px; background: rgba(255,255,255,0.75); border: 1px solid rgba(148, 163, 184, 0.55); display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .container-node__titleIcon img { width: 100%; height: 100%; object-fit: contain; }
        .container-node__titleIcon span { font-weight: 900; font-size: 10px; color: #0f172a; letter-spacing: 0.3px; }
        .container-node__label { font-weight: 900; font-size: 13px; color: #0f172a; }
        .container-node__body { height: calc(100% - 44px); }

        .cloud-node { width: ${CLOUD_NODE_W}px; background: transparent; border: none; }
        .cloud-node__inner { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 0; }
        .cloud-node__icon { width: 92px; height: 92px; border-radius: 18px; overflow: hidden; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 10px 18px rgba(15, 23, 42, 0.14)); }
        .cloud-node__icon img { width: 100%; height: 100%; object-fit: contain; }
        .cloud-node__glyph { width: 100%; height: 100%; border-radius: 18px; background: #ffffff; border: 1px solid rgba(148, 163, 184, 0.55); display: flex; align-items: center; justify-content: center; font-weight: 900; color: #0f172a; font-size: 12px; letter-spacing: 0.3px; }
        .cloud-node__label { font-weight: 700; color: #0f172a; font-size: 12px; line-height: 1.15; text-align: center; max-width: ${CLOUD_NODE_W}px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

        .react-flow__node-cloudNode.selected .cloud-node__icon { outline: 2px solid #0ea5e9; outline-offset: 3px; border-radius: 18px; }
        .react-flow__node-containerNode.selected .container-node { outline: 2px solid rgba(14, 165, 233, 0.75); outline-offset: 2px; }

        .react-flow__node .react-flow__handle { width: 8px; height: 8px; background: #0f172a; border: 2px solid #ffffff; opacity: 0; transition: opacity 120ms ease-in-out; }
        .react-flow__node:hover .react-flow__handle, .react-flow__node.selected .react-flow__handle { opacity: 0.95; }

        .react-flow__edge-path { stroke: #334155; stroke-width: 2.4; }
        .react-flow__edge.selected .react-flow__edge-path { stroke: #0ea5e9; stroke-width: 2.8; }
        .react-flow__edge.selected marker path { fill: #0ea5e9; }

        .diagram-editor__contextMenu { position: fixed; z-index: 10000; background: #ffffff; border: 1px solid rgba(148, 163, 184, 0.65); border-radius: 12px; box-shadow: 0 16px 50px rgba(15, 23, 42, 0.18); padding: 6px; display: flex; flex-direction: column; gap: 6px; min-width: 170px; }
        .diagram-editor__contextMenu button { text-align: left; padding: 8px 10px; border-radius: 10px; border: 1px solid #e2e8f0; background: #ffffff; font-weight: 800; color: #0f172a; }
        .diagram-editor__contextMenu button:hover { background: #f8fafc; border-color: #94a3b8; }
        .diagram-editor__contextMenuDivider { height: 1px; background: #e2e8f0; margin: 2px 0; }

        .layout-btn--nudge { border: 1px solid rgba(14, 165, 233, 0.75) !important; box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.18); animation: layoutPulse 1.05s ease-in-out infinite; }
        @keyframes layoutPulse {
          0% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.25); }
          60% { box-shadow: 0 0 0 7px rgba(14, 165, 233, 0.08); }
          100% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.00); }
        }
        /* Put edges above containers so they can be clicked/selected through large container areas. */
        .react-flow__nodes { z-index: 10 !important; }
        .react-flow__edges { z-index: 5 !important; }
        .react-flow__edge-interaction { stroke-opacity: 0; }
      `}</style>

      <IconCatalogModal
        open={Boolean(catalogModal)}
        type={catalogModal?.type || "resource"}
        provider={provider}
        onClose={() => setCatalogModal(null)}
        onSelect={(entry) => {
          const modal = catalogModal;
          setCatalogModal(null);
          if (!entry || !modal) return;

          const isContainerPick = String(modal.type) === "container";
          const iconId = entry.id;

          if (modal.purpose === "addNode" && !isContainerPick) {
            const id = newId("n");
            const kind = iconId;
            const label = labelFromCatalogEntry(entry);
            const { src, fallbackSrc } = resolveIcon(kind, label, provider);

            const parentId =
              selectedNode?.type === "containerNode"
                ? selectedNode.id
                : selectedNode?.parentNode
                  ? String(selectedNode.parentNode)
                  : null;
            const parent = parentId ? nodes.find((n) => n.id === parentId) : null;
            const parentW = Number(parent?.style?.width || parent?.width || 0);
            const parentH = Number(parent?.style?.height || parent?.height || 0);
            const basePos = parentId ? centeredChildPos(parentW, parentH) : { x: 120, y: 120 };

            const nextNode = {
              id,
              type: "cloudNode",
              position: basePos,
              ...(parentId ? { parentNode: parentId, extent: "parent" } : {}),
              data: { label, kind, iconSrc: src, fallbackIconSrc: fallbackSrc },
            };

            const nextNodes = [...nodes, nextNode];
            const constrained = withContainerResizeConstraints(nextNodes);
            setNodes(constrained);
            setEdges(assignEdgeHandles(constrained, edges));
            commitSpec((cur) => ({
              ...cur,
              nodes: [
                ...(cur.nodes || []),
                { id, kind, label, x: basePos.x, y: basePos.y, ...(parentId ? { parentId } : {}) },
              ],
            }));
            setSelection({ kind: "node", id });
            return;
          }

          if (modal.purpose === "addContainer" && isContainerPick) {
            const id = newId("c");
            const kind = containerKindFromIconId(iconId);
            const label = labelFromContainerIconId(iconId) || "Container";
            const { src, fallbackSrc } = resolveIcon(kind, label, provider);

            const parentId =
              selectedNode?.type === "containerNode"
                ? selectedNode.id
                : selectedNode?.parentNode
                  ? String(selectedNode.parentNode)
                  : null;

            const basePos = parentId ? { x: 20, y: 60 } : { x: 80, y: 60 };
            const w = kind === "aws.vpc" ? 900 : 520;
            const h = kind === "aws.vpc" ? 680 : 320;

            const nextNode = {
              id,
              type: "containerNode",
              position: basePos,
              ...(parentId ? { parentNode: parentId, extent: "parent" } : {}),
              style: { width: w, height: h },
              data: { label, kind, iconSrc: src, fallbackIconSrc: fallbackSrc },
            };

            const nextNodes = [...nodes, nextNode];
            const constrained = withContainerResizeConstraints(nextNodes);
            setNodes(constrained);
            setEdges(assignEdgeHandles(constrained, edges));
            commitSpec((cur) => ({
              ...cur,
              nodes: [
                ...(cur.nodes || []),
                {
                  id,
                  kind,
                  label,
                  style: { variant: "container" },
                  x: basePos.x,
                  y: basePos.y,
                  w,
                  h,
                  ...(parentId ? { parentId } : {}),
                },
              ],
            }));
            setSelection({ kind: "node", id });
            return;
          }

          if (modal.purpose === "editKind" && propertiesModalNode) {
            const nextKind = propertiesModalNode.type === "containerNode" ? containerKindFromIconId(iconId) : iconId;
            const nextLabel = propertiesModalNode.type === "containerNode" ? labelFromContainerIconId(iconId) || propertiesModalNode.data?.label : propertiesModalNode.data?.label;
            const { src, fallbackSrc } = resolveIcon(nextKind, nextLabel, provider);
            updateModalNode({
              data: { kind: nextKind, ...(nextLabel ? { label: nextLabel } : {}), iconSrc: src, fallbackIconSrc: fallbackSrc },
              spec: { kind: nextKind, ...(nextLabel ? { label: nextLabel } : {}) },
            });
          }
        }}
      />
    </div>
  );
}
