const LEAF_W = 160;
const LEAF_H = 132;
const HEADER_H = 44;
const PAD = 22;
const GAP_X = 44;
const GAP_Y = 32;

function isContainer(n) {
  return String(n?.style?.variant || "").toLowerCase() === "container";
}

function num(v, fallback) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function mapById(nodes) {
  const m = new Map();
  for (const n of nodes || []) m.set(String(n.id), n);
  return m;
}

function childrenByParent(nodes) {
  const m = new Map(); // parentId|null -> nodes[]
  for (const n of nodes || []) {
    const pid = n.parentId ? String(n.parentId) : null;
    if (!m.has(pid)) m.set(pid, []);
    m.get(pid).push(n);
  }
  return m;
}

function layoutLeafGrid(leaves, innerW, innerH, { force, originX = 0, originY = 0 } = {}) {
  const count = leaves.length;
  if (count === 0) return;

  const cols =
    count <= 1 ? 1 : count <= 2 ? 2 : count <= 4 ? 2 : count <= 6 ? 3 : 4;
  const rows = Math.ceil(count / cols);

  const totalW = cols * LEAF_W + (cols - 1) * GAP_X;
  const totalH = rows * LEAF_H + (rows - 1) * GAP_Y;

  const startX = Math.round(Math.max(0, (innerW - totalW) / 2));
  const startY = Math.round(Math.max(0, (innerH - totalH) / 2));

  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i];
    if (!force && typeof leaf.x === "number" && typeof leaf.y === "number") continue;
    const col = i % cols;
    const row = Math.floor(i / cols);
    leaf.x = originX + startX + col * (LEAF_W + GAP_X);
    leaf.y = originY + startY + row * (LEAF_H + GAP_Y);
  }
}

function ensureContainerSize(container, defaultW, defaultH, { force }) {
  if (force) {
    container.w = num(container.w, defaultW);
    container.h = num(container.h, defaultH);
    return;
  }
  container.w = num(container.w, defaultW);
  container.h = num(container.h, defaultH);
}

function minContainerSize(kind) {
  const k = String(kind || "");
  if (k === "aws.account") return { w: 780, h: 520 };
  if (k === "aws.vpc") return { w: 720, h: 520 };
  if (k === "aws.az") return { w: 440, h: 320 };
  if (k === "aws.subnet") return { w: 420, h: 220 };
  return { w: 420, h: 220 };
}

function applyContainerFit(container, neededW, neededH, defaultW, defaultH, opts) {
  const min = minContainerSize(container.kind);
  const extra = 12;
  const targetW = Math.max(min.w, neededW + extra);
  const targetH = Math.max(min.h, neededH + extra);

  if (opts.tighten) {
    container.w = Math.max(targetW, 0);
    container.h = Math.max(targetH, 0);
    return;
  }

  if (opts.force || container.w == null) container.w = Math.max(num(container.w, defaultW), targetW);
  if (opts.force || container.h == null) container.h = Math.max(num(container.h, defaultH), targetH);
}

function containerColumns(containerKind, childContainerCount) {
  const kind = String(containerKind || "");
  if (kind === "aws.vpc") return 2;
  if (kind === "aws.account") return 1;
  if (kind === "aws.region") return 1;
  if (kind === "aws.az") return 1;
  if (kind === "aws.subnet") return 1;
  if (childContainerCount <= 1) return 1;
  if (childContainerCount === 2) return 2;
  return 2;
}

function computeBounds(nodes, { includeSize = false } = {}) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of nodes || []) {
    const x = num(n.x, null);
    const y = num(n.y, null);
    if (x == null || y == null) continue;
    const w = includeSize ? num(n.w, isContainer(n) ? 520 : LEAF_W) : 0;
    const h = includeSize ? num(n.h, isContainer(n) ? 360 : LEAF_H) : 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function layoutContainer(container, childrenMap, opts) {
  const kids = childrenMap.get(String(container.id)) || [];
  const childContainers = kids.filter(isContainer);
  const childLeaves = kids.filter((n) => !isContainer(n));

  // Default sizing baseline
  const defaultW =
    container.kind === "aws.account"
      ? 1260
      : container.kind === "aws.vpc"
        ? 1120
        : container.kind === "aws.az"
          ? 560
          : 520;
  const defaultH =
    container.kind === "aws.account"
      ? 860
      : container.kind === "aws.vpc"
        ? 820
        : container.kind === "aws.az"
          ? 720
          : 260;
  ensureContainerSize(container, defaultW, defaultH, opts);

  // If no child containers, just place leaves in a centered grid.
  if (childContainers.length === 0) {
    const innerW = num(container.w, defaultW) - PAD * 2;
    const innerH = num(container.h, defaultH) - HEADER_H - PAD * 2;
    layoutLeafGrid(childLeaves, innerW, innerH, { ...opts, originX: PAD, originY: HEADER_H + PAD });
    const bounds = computeBounds(childLeaves, { includeSize: true });
    if (bounds) {
      const neededW = bounds.w + PAD * 2;
      const neededH = bounds.h + HEADER_H + PAD * 2;
      applyContainerFit(container, neededW, neededH, defaultW, defaultH, opts);
    }
    return;
  }

  // Layout child containers first (their children already laid out by recursion).
  const cols = containerColumns(container.kind, childContainers.length);
  const rows = Math.ceil(childContainers.length / cols);

  // Determine cell size from children (or defaults).
  let cellW = 0;
  let cellH = 0;
  for (const c of childContainers) {
    cellW = Math.max(cellW, num(c.w, 460));
    cellH = Math.max(cellH, num(c.h, 240));
  }
  cellW = Math.max(cellW, 420);
  cellH = Math.max(cellH, 200);

  for (let i = 0; i < childContainers.length; i++) {
    const c = childContainers[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    if (opts.force || c.x == null) c.x = PAD + col * (cellW + GAP_X);
    if (opts.force || c.y == null) c.y = HEADER_H + PAD + row * (cellH + GAP_Y);
    c.w = num(c.w, cellW);
    c.h = num(c.h, cellH);
  }

  // Place leaves (if any) below child-container grid.
  if (childLeaves.length > 0) {
    const childBounds = computeBounds(childContainers, { includeSize: true });
    const yStart = (childBounds ? childBounds.maxY : HEADER_H + PAD) + GAP_Y;
    const innerW = num(container.w, defaultW) - PAD * 2;
    const innerH = Math.max(LEAF_H, num(container.h, defaultH) - yStart - PAD);
    layoutLeafGrid(childLeaves, innerW, innerH, { ...opts, originX: PAD, originY: yStart });
  }

  // Expand this container to fit all children (containers + leaves).
  const bounds = computeBounds(kids, { includeSize: true });
  if (bounds) {
    const neededW = bounds.w + PAD * 2;
    const neededH = bounds.h + HEADER_H + PAD * 2;
    applyContainerFit(container, neededW, neededH, defaultW, defaultH, opts);
  }
}

function topoByDepth(nodes, byId) {
  const depth = (id, seen = new Set()) => {
    const n = byId.get(String(id));
    if (!n?.parentId) return 0;
    if (seen.has(String(id))) return 0;
    seen.add(String(id));
    return 1 + depth(n.parentId, seen);
  };
  return [...nodes].sort((a, b) => depth(a.id) - depth(b.id));
}

function findPrimaryRootContainer(nodes, childrenMap) {
  const roots = (childrenMap.get(null) || []).filter(isContainer);
  if (roots.length === 0) return null;
  const vpc = roots.find((n) => n.kind === "aws.vpc");
  if (vpc) return vpc;

  const score = (n) => (childrenMap.get(String(n.id)) || []).length;
  return [...roots].sort((a, b) => score(b) - score(a))[0];
}

export function autoLayoutDiagramSpec(inputSpec, { force = true, tighten = true } = {}) {
  const spec = deepCopy(inputSpec || {});
  const nodes = Array.isArray(spec.nodes) ? spec.nodes : [];
  const edges = Array.isArray(spec.edges) ? spec.edges : [];

  const byId = mapById(nodes);
  const childrenMap = childrenByParent(nodes);

  // Layout containers from deep to shallow so parents can size to children.
  for (const n of topoByDepth(nodes, byId).reverse()) {
    if (!isContainer(n)) continue;
    layoutContainer(n, childrenMap, { force, tighten });
  }

  // Place root nodes: keep VPC-ish containers to the right, misc leaves to the left.
  const rootContainers = (childrenMap.get(null) || []).filter(isContainer);
  const rootLeaves = (childrenMap.get(null) || []).filter((n) => !isContainer(n));

  const primary = findPrimaryRootContainer(nodes, childrenMap);
  const baseY = 80;

  // Left column: roots that are not in any container.
  for (let i = 0; i < rootLeaves.length; i++) {
    const n = rootLeaves[i];
    if (!force && n.x != null && n.y != null) continue;
    n.x = 80;
    n.y = baseY + i * 180;
  }

  // Primary container.
  let nextX = 420;
  let nextY = baseY;
  if (primary) {
    if (force || primary.x == null) primary.x = nextX;
    if (force || primary.y == null) primary.y = nextY;
    nextX += num(primary.w, 900) + 140;
  }

  // Any other root containers
  for (const c of rootContainers) {
    if (primary && c.id === primary.id) continue;
    if (force || c.x == null) c.x = nextX;
    if (force || c.y == null) c.y = nextY;
    nextX += num(c.w, 520) + 140;
  }

  return {
    ...spec,
    version: spec.version || "1.0",
    layout: { ...(spec.layout || {}), mode: "manual", engine: "frontend" },
    nodes,
    edges,
  };
}
