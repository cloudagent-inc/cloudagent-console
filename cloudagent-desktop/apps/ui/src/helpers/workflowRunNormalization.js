const safeParseJSON = (value, fallback = null) => {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const deepClone = (value) => safeParseJSON(JSON.stringify(value), value);

const ensureArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const getNodeData = (node) =>
  node?.data && typeof node.data === 'object' ? node.data : node || {};

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const getNodeRefs = (node, key) =>
  ensureArray(getNodeData(node)?.[key] ?? node?.[key])
    .map((item) => String(item || '').trim())
    .filter(Boolean);

const getExplicitNodeId = (node) =>
  String(getNodeData(node)?.id || node?.id || '').trim();

const inferNodeId = (nodes, index, data) => {
  const explicitId = String(data?.id || '').trim();
  if (explicitId) return explicitId;

  const previousNext = index > 0 ? getNodeRefs(nodes[index - 1], 'next') : [];
  const nextInputFrom =
    index < nodes.length - 1 ? getNodeRefs(nodes[index + 1], 'inputFrom') : [];
  const connectingRefs = previousNext.filter((ref) => nextInputFrom.includes(ref));
  if (connectingRefs.length === 1) return connectingRefs[0];

  const nameSlug = slugify(data?.name);
  if (nameSlug === 'start') return 'start';
  if (nameSlug === 'end') return 'end';

  const existingIds = new Set(nodes.map(getExplicitNodeId).filter(Boolean));
  const referencedIds = Array.from(
    new Set(nodes.flatMap((node) => [...getNodeRefs(node, 'inputFrom'), ...getNodeRefs(node, 'next')]))
  ).filter((ref) => !existingIds.has(ref));
  const matchingRef = referencedIds.find(
    (ref) => slugify(ref) === nameSlug || nameSlug.startsWith(slugify(ref))
  );
  if (matchingRef) return matchingRef;

  return nameSlug || `node-${index + 1}`;
};

const normalizeNodeType = (value) => {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase();
  if (['start', 'startnode'].includes(normalized)) return 'startNode';
  if (['end', 'endnode'].includes(normalized)) return 'endNode';
  if (normalized === 'cloudtask') return 'cloudTask';
  if (normalized === 'reporttask') return 'reportTask';
  if (normalized === 'communication') return 'communication';
  if (normalized === 'approval') return 'approval';
  if (normalized === 'decision') return 'decision';
  return raw;
};

const hasObjectEntries = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;

const inferNodeType = (data, id) => {
  const explicitType = normalizeNodeType(data?.type);
  if (explicitType) return explicitType;

  const idSlug = slugify(id);
  const nameSlug = slugify(data?.name);
  if (idSlug === 'start' || nameSlug === 'start') return 'startNode';
  if (idSlug === 'end' || nameSlug === 'end') return 'endNode';
  if (Number(data?.branches) > 0 || hasObjectEntries(data?.branchLogic)) {
    return 'decision';
  }
  if (data?.action || ensureArray(data?.recipients).length > 0) {
    return 'communication';
  }

  const inputSettings = data?.inputSettings || {};
  if (
    inputSettings.reportNodeMode ||
    inputSettings.reportMode ||
    inputSettings.reportSourceType ||
    inputSettings.analysisArtifacts
  ) {
    return 'reportTask';
  }
  if (
    ensureArray(data?.blueprintId).length > 0 ||
    data?.permissionProfile ||
    hasObjectEntries(inputSettings) ||
    ensureArray(data?.logic).length > 0
  ) {
    return 'cloudTask';
  }

  return 'cloudTask';
};

export const normalizeWorkflowRunNodes = (nodes = []) => {
  const rawNodes = Array.isArray(nodes) ? nodes : [];
  return rawNodes.map((node, index) => {
    const data = deepClone(getNodeData(node));
    const id = String(data?.id || node?.id || inferNodeId(rawNodes, index, data)).trim();
    const type = inferNodeType({ ...data, type: data?.type || node?.type }, id);

    return {
      ...data,
      id,
      type,
      name: data?.name || node?.name || id,
      inputFrom: getNodeRefs({ ...node, data }, 'inputFrom'),
      next: getNodeRefs({ ...node, data }, 'next'),
    };
  });
};

