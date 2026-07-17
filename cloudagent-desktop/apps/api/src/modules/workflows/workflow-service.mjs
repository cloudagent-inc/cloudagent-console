import { parseStoredJsonValue } from "@cloudagent/storage";
import { filterByDateWindow, paginateLocalItems, sortLocalItems } from "../../lib/http.mjs";

export function workflowRunMatchesWorkflowId(run, workflowId) {
  if (!workflowId) return true;
  if (run?.workflowId === workflowId) return true;
  const definition = parseStoredJsonValue(run?.workflowDefinition, {});
  return definition?.workflowId === workflowId || definition?.id === workflowId;
}

export function createWorkflowRunSummary(workflowDefinition = {}, status = "completed") {
  const title = workflowDefinition?.title || workflowDefinition?.workflowName || "Untitled Workflow";
  const now = new Date().toISOString();
  return {
    ...workflowDefinition,
    title,
    workflowRunSummary: {
      ...(workflowDefinition?.workflowRunSummary || {}),
      summary:
        workflowDefinition?.workflowRunSummary?.summary ||
        `Local mode recorded a run for "${title}". Full local workflow execution is not implemented yet.`,
      finalSummary:
        workflowDefinition?.workflowRunSummary?.finalSummary ||
        `Local mode recorded a run for "${title}". Full local workflow execution is not implemented yet.`,
      generatedAt: workflowDefinition?.workflowRunSummary?.generatedAt || now,
      status,
    },
  };
}

export async function listWorkflowRunsForQuery(store, query = {}) {
  const runs = await store.listWorkflowRuns();
  const filtered = filterByDateWindow(
    runs.filter((run) => workflowRunMatchesWorkflowId(run, query.workflowId)),
    { startDate: query.startDate, endDate: query.endDate }
  );
  return paginateLocalItems(
    sortLocalItems(filtered, query.sortBy || "updatedAt", query.sortOrder || "desc"),
    query
  );
}
