import { z } from "zod";

const nodeSchema = z
  .object({
    id: z.string().min(1),
    kind: z.string().min(1),
    label: z.string().optional(),
    parentId: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    w: z.number().optional(),
    h: z.number().optional(),
    style: z.record(z.any()).optional(),
  })
  .passthrough();

const edgeSchema = z
  .object({
    id: z.string().min(1),
    source: z.string().min(1),
    target: z.string().min(1),
    label: z.string().optional(),
    style: z
      .object({
        dashed: z.boolean().optional(),
        arrow: z.boolean().optional(),
        route: z.enum(["straight", "step", "smoothstep"]).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const diagramSpecSchema = z
  .object({
    version: z.literal("1.0"),
    nodes: z.array(nodeSchema).max(200),
    edges: z.array(edgeSchema).max(400),
    groups: z.array(z.any()).optional(),
    layout: z.any().optional(),
  })
  .passthrough();

export function validateDiagramSpec(input) {
  const spec = diagramSpecSchema.parse(input);

  const nodeIds = new Set();
  for (const n of spec.nodes) {
    if (nodeIds.has(n.id)) throw new Error(`Duplicate node id: ${n.id}`);
    nodeIds.add(n.id);
  }

  const edgeIds = new Set();
  for (const e of spec.edges) {
    if (edgeIds.has(e.id)) throw new Error(`Duplicate edge id: ${e.id}`);
    edgeIds.add(e.id);
    if (!nodeIds.has(e.source)) throw new Error(`Edge ${e.id} source not found: ${e.source}`);
    if (!nodeIds.has(e.target)) throw new Error(`Edge ${e.id} target not found: ${e.target}`);
  }

  for (const n of spec.nodes) {
    if (n.parentId && !nodeIds.has(n.parentId)) throw new Error(`Node ${n.id} parentId not found: ${n.parentId}`);
  }

  return spec;
}

