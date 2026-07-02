import { parseStoredJsonValue } from "@cloudagent/storage";
import { executeLocalWorkflow } from "../runners/local-runner.mjs";

const activeWorkflowJobs = new Map();

function nowIso() {
  return new Date().toISOString();
}

function summarizeError(error) {
  return error?.stack || error?.message || String(error);
}

async function markWorkflowRunFailed({ store, workflowRunId, error }) {
  const existing = await store.getWorkflowRun(workflowRunId);
  if (!existing) return null;

  const definition = parseStoredJsonValue(existing.workflowDefinition, {});
  const summary = `Local workflow background runner failed: ${error?.message || String(error)}`;
  return store.updateWorkflowRun(workflowRunId, {
    workflowStatus: "failed",
    workflowDefinition: {
      ...definition,
      workflowRunSummary: {
        ...(definition.workflowRunSummary || {}),
        summary,
        finalSummary: summary,
        generatedAt: nowIso(),
        status: "failed",
      },
    },
    currentExecutions: [],
    statusMessage: summary,
    completedAt: nowIso(),
  });
}

export function getLocalWorkflowJob(workflowRunId) {
  return activeWorkflowJobs.get(workflowRunId) || null;
}

export function listLocalWorkflowJobs() {
  return Array.from(activeWorkflowJobs.values()).map((job) => ({
    workflowRunId: job.workflowRunId,
    startedAt: job.startedAt,
  }));
}

export function startLocalWorkflowJob({ store, workflowRunId, mcpUrl = null }) {
  if (!workflowRunId) {
    throw new Error("workflowRunId is required");
  }

  const existing = activeWorkflowJobs.get(workflowRunId);
  if (existing) {
    return { workflowRunId, startedAt: existing.startedAt, alreadyRunning: true };
  }

  const job = {
    workflowRunId,
    startedAt: nowIso(),
    promise: null,
  };
  activeWorkflowJobs.set(workflowRunId, job);

  job.promise = new Promise((resolve) => setImmediate(resolve))
    .then(() => executeLocalWorkflow({ store, workflowRunId, mcpUrl }))
    .then((result) => {
      console.log("[local workflow] background workflow completed", {
        workflowRunId,
        workflowStatus: result?.workflowStatus || null,
        ok: result?.ok === true,
      });
      return result;
    })
    .catch(async (error) => {
      console.error("[local workflow] background workflow failed", {
        workflowRunId,
        error: summarizeError(error),
      });
      await markWorkflowRunFailed({ store, workflowRunId, error }).catch((updateError) => {
        console.error("[local workflow] failed to mark background workflow failed", {
          workflowRunId,
          error: summarizeError(updateError),
        });
      });
      return null;
    })
    .finally(() => {
      activeWorkflowJobs.delete(workflowRunId);
    });

  return { workflowRunId, startedAt: job.startedAt, alreadyRunning: false };
}
