import { tool } from "@openai/agents";
import { z } from "zod";
import { getUserId } from "../util/run-context.mjs";
import { logStart, logEnd } from "../util/logging.mjs";
import { stripWorkloadDetails } from "../services/workload-summaries.mjs";

export function createListWorkloadsTool({ cache, workloadsService }) {
  if (!cache) throw new Error("createListWorkloadsTool requires a cache instance");
  if (!workloadsService?.listWorkloadsByUser) throw new Error("workloadsService.listWorkloadsByUser is required");

  return tool({
    name: "list_workloads",
    description:
      "List workloads for a user from cache or the configured workload service. Returns top-level workload info, deploymentSummary, and availableInsights.",
    parameters: z.object({
      limit: z.number().int().min(1).max(500).nullable().optional(),
      forceRefresh: z.boolean().nullable().optional()
    }).strict(),

    async execute({ limit, forceRefresh }, runContext) {
      const userId = getUserId(runContext);
      const cacheKey = `${userId}:shared`;
      const wantFresh = !!forceRefresh;
      logStart("list_workloads", {
        userId,
        limit,
        forceRefresh: wantFresh
      });
      try {
        if (!wantFresh) {
          const cached = cache.getWorkloads(cacheKey);
          if (cached) {
            const result = limit ? cached.slice(0, limit) : cached;
            const sanitized = result.map((workload) =>
              stripWorkloadDetails(workload, { includeDetails: false })
            );
            const out = {
              userId,
              source: "cache",
              count: sanitized.length,
              workloads: sanitized
            };
            // logEnd("list_workloads", out);
            return out;
          }
        }

        const items = await workloadsService.listWorkloadsByUser(userId, limit ?? 100);
        cache.setWorkloads(cacheKey, items);
        const sanitized = items.map((workload) =>
          stripWorkloadDetails(workload, { includeDetails: false })
        );
        const out = {
          userId,
          source: "workload_service",
          count: sanitized.length,
          workloads: sanitized
        };
        // logEnd("list_workloads", out);
        return out;
      } catch (error) {
        const out = { ok: false, error: error?.message || String(error) };
        // logEnd("list_workloads", out);
        throw error;
      }
    }
  });
}
