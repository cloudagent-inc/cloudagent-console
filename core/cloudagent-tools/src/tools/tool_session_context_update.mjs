import { tool } from "@openai/agents";
import { z } from "zod";
import { logStart, logEnd } from "../util/logging.mjs";

const EnvironmentSchema = z
  .object({
    permissionProfileId: z.string().min(1),
    name: z.string().nullable().optional(),
    cloudProvider: z.string().nullable().optional()
  })
  .strict();

const WorkloadSchema = z
  .object({
    workloadId: z.string().min(1),
    workloadName: z.string().nullable().optional()
  })
  .strict();

const ReportSchema = z
  .object({
    reportId: z.string().nullable().optional(),
    scanId: z.string().nullable().optional(),
    permissionProfileId: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    fileId: z.string().nullable().optional(),
    loadedAt: z.string().nullable().optional()
  })
  .strict();

const FetchedSchema = z
  .object({
    type: z.string().nullable().optional(),
    label: z.string().nullable().optional(),
    timestamp: z.string().nullable().optional()
  })
  .strict();

const PatchSchema = z
  .object({
    environments: z.array(EnvironmentSchema).nullable().optional(),
    workloads: z.array(WorkloadSchema).nullable().optional(),
    reports: z.array(ReportSchema).nullable().optional(),
    fetched: z.array(FetchedSchema).nullable().optional(),
    notes: z.string().nullable().optional()
  })
  .strict();

export function createSessionContextUpdateTool() {
  return tool({
    name: "update_session_context",
    description:
      "Update or suggest updates to the chat session context (environments, workloads, reports, notes). Use mode='suggest' if ambiguous.",
    parameters: z
      .object({
        mode: z.enum(["apply", "suggest"]).nullable().optional(),
        notice: z.string().nullable().optional(),
        patch: PatchSchema
      })
      .strict(),

    async execute({ mode, notice, patch }, runContext) {
      const recordContextEvent = runContext?.context?.recordContextEvent;
      const payload = {
        mode: mode || "apply",
        notice: notice || null,
        patch
      };
      logStart("update_session_context", payload);
      if (typeof recordContextEvent === "function") {
        recordContextEvent(payload);
      }
      const out = { ok: true };
      logEnd("update_session_context", out);
      return out;
    }
  });
}
