import { tool } from "@openai/agents";
import { z } from "zod";
import { getUserId } from "../util/run-context.mjs";
import { logStart, logEnd } from "../util/logging.mjs";
import { stripWorkloadDetails } from "../services/workload-summaries.mjs";

export function createGetWorkloadTool({ cache, workloadsService }) {
  if (!cache) throw new Error("createGetWorkloadTool requires a cache instance");
  if (!workloadsService?.getWorkload) throw new Error("workloadsService.getWorkload is required");

  return tool({
    name: "get_workload",
    description:
      "Fetch a single workload by ID from cache or the configured workload service. Returns full workload details plus deploymentSummary and availableInsights.",
    parameters: z.object({
      workloadId: z.string().min(1),
      forceRefresh: z.boolean().nullable().optional()
    }).strict(),

    async execute({ workloadId, forceRefresh }, runContext) {
      const userId = getUserId(runContext);
      const cacheKey = `${userId}:shared`;
      const wantFresh = !!forceRefresh;
      logStart("get_workload", {
        userId,
        workloadId,
        forceRefresh: wantFresh
      });
      try {
        if (!wantFresh) {
          const cached = cache.getWorkloads(cacheKey);
          if (Array.isArray(cached)) {
            const hit = cached.find(w => w?.workloadId === workloadId) || null;
            if (hit) {
              const out = {
                ok: true,
                source: "cache",
                workload: stripWorkloadDetails(hit, { includeDetails: true })
              };
              logEnd("get_workload", out);
              return out;
            }
          }
        }

        const workload = await workloadsService.getWorkload(userId, workloadId);
        if (!workload) {
          const out = { ok: false, error: "Workload not found", workloadId };
          logEnd("get_workload", out);
          return out;
        }

        const snapshot = cache.getWorkloadsSnapshot(cacheKey) || [];
        const idx = snapshot.findIndex(w => w?.workloadId === workloadId);
        if (idx >= 0) snapshot[idx] = workload;
        else snapshot.unshift(workload);
        cache.setWorkloads(cacheKey, snapshot);

        const out = {
          ok: true,
          source: "workload_service",
          workload: stripWorkloadDetails(workload, { includeDetails: true })
        };
        logEnd("get_workload", out);
        return out;
      } catch (error) {
        const out = { ok: false, error: error?.message || String(error) };
        logEnd("get_workload", out);
        throw error;
      }
    }
  });
}
