import { z } from "zod";
import { getOrCreateSpecSession, resetSpecSession } from "@cloudagent/workloads/diagrams/session-store";
import { createDiagramSpec, updateDiagramSpec } from "@cloudagent/workloads/diagrams/spec-service";
import { searchCatalogIcons } from "@cloudagent/workloads/diagrams/icon-catalog";

const diagramSpecSchema = z
  .object({
    provider: z.enum(["aws", "azure", "gcp"]),
    prompt: z.string().min(1),
    sessionId: z.string().nullable().optional(),
    spec: z.any().optional(),
  })
  .strict();

const iconSearchInputSchema = z
  .object({
    provider: z.enum(["aws", "azure", "gcp"]),
    query: z.string().min(1),
    type: z.enum(["resource", "container"]).optional(),
    service: z.string().optional(),
    limit: z.number().int().min(1).max(25).optional(),
  })
  .strict();

export function getDiagramSpecSchema() {
  return diagramSpecSchema.shape;
}

export function getDiagramIconSearchSchema() {
  return iconSearchInputSchema.shape;
}

export async function diagramSpecHandler({ input, logger } = {}) {
  const parsed = diagramSpecSchema.parse(input || {});
  const hasIncomingSession = Boolean(parsed.sessionId);
  const { token, state } = getOrCreateSpecSession(parsed.sessionId || null);
  const provider = parsed.provider || state.provider || "aws";
  state.provider = provider;

  if (!hasIncomingSession) {
    const result = await createDiagramSpec({
      provider,
      message: parsed.prompt,
      history: state.history,
      log: Boolean(process.env.DIAGRAMS_ICON_LOG === "1"),
    });
    state.history = result.history;
    state.lastSpec = result.spec;

    logger?.info?.("[diagram_spec]", {
      action: "create",
      provider,
      sessionToken: token,
      historyItems: Array.isArray(state.history) ? state.history.length : 0,
      normalizedKinds: result.normalizedKinds || 0,
    });

    return {
      sessionId: token,
      provider,
      spec: result.spec,
      summary: `Spec created for ${provider.toUpperCase()}`,
    };
  }

  const prior = parsed.spec || state.lastSpec;
  if (!prior) throw new Error("No prior spec for this session; start a new diagram without sessionId.");

  const result = await updateDiagramSpec({
    provider,
    instruction: parsed.prompt,
    priorSpec: prior,
    history: state.history,
    log: Boolean(process.env.DIAGRAMS_ICON_LOG === "1"),
  });
  state.history = result.history;
  state.lastSpec = result.spec;

  logger?.info?.("[diagram_spec]", {
    action: "update",
    provider,
    sessionToken: token,
    historyItems: Array.isArray(state.history) ? state.history.length : 0,
    normalizedKinds: result.normalizedKinds || 0,
  });

  return {
    sessionId: token,
    provider,
    spec: result.spec,
    summary: `Spec updated for ${provider.toUpperCase()}`,
  };
}

export function diagramSpecResetHandler({ sessionId, logger } = {}) {
  if (!sessionId) throw new Error("sessionId is required");
  resetSpecSession(sessionId);
  logger?.info?.("[diagram_spec_reset]", { sessionToken: sessionId });
  return { ok: true };
}

export async function diagramIconSearchHandler({ input } = {}) {
  const parsed = iconSearchInputSchema.parse(input || {});
  const matches = await searchCatalogIcons({
    provider: parsed.provider,
    query: parsed.query,
    type: parsed.type,
    service: parsed.service,
    limit: parsed.limit,
  });
  return { matches };
}
