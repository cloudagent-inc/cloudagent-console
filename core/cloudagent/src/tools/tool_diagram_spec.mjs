import { tool } from "@openai/agents";
import { z } from "zod";
import { createDiagramSpec, updateDiagramSpec } from "@cloudagent/workloads/diagrams/spec-service";
import { diagramSpecHandler } from "./diagram-spec-tools.mjs";

function parseJsonObject(text, fieldName) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error(`${fieldName} must be a JSON string`);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`${fieldName} is not valid JSON: ${e.message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${fieldName} must be a JSON object`);
  }
  return parsed;
}

export function createDiagramSpecTool() {
  return tool({
    name: "diagram_spec",
    description:
      "Generate or update an editable cloud diagram spec (DiagramSpec JSON). Supports session-based follow-up edits.",
    parameters: z
      .object({
        action: z.enum(["create", "update"]),
        provider: z.enum(["aws", "azure", "gcp"]).nullable(),
        message: z.string().nullable(),
        instruction: z.string().nullable(),
        // Keep spec as a JSON string to satisfy structured output schema constraints.
        specJson: z.string().nullable(),
        sessionId: z.string().nullable(),
      })
      .strict(),
    async execute({ action, provider, message, instruction, specJson, sessionId }) {
      const effectiveProvider = provider || "aws";
      if (action === "create") {
        if (!message || !String(message).trim()) throw new Error("message is required for action=create");
        const result = await diagramSpecHandler({
          input: { provider: effectiveProvider, prompt: message },
        });
        return { ok: true, provider: effectiveProvider, action, spec: result.spec, sessionId: result.sessionId };
      }

      if (!instruction || !String(instruction).trim()) throw new Error("instruction is required for action=update");
      if (sessionId) {
        const spec = specJson ? parseJsonObject(specJson, "specJson") : undefined;
        const result = await diagramSpecHandler({
          input: { provider: effectiveProvider, prompt: instruction, sessionId, ...(spec ? { spec } : {}) },
        });
        return { ok: true, provider: effectiveProvider, action, spec: result.spec, sessionId: result.sessionId };
      }
      if (!specJson) throw new Error("specJson is required for action=update when sessionId is not provided");
      const spec = parseJsonObject(specJson, "specJson");
      const result = await updateDiagramSpec({
        provider: effectiveProvider,
        instruction,
        priorSpec: spec,
        history: [],
        log: false,
      });
      return { ok: true, provider: effectiveProvider, action, spec: result.spec };
    },
  });
}
