import { Router } from "express";
import { parseStoredJsonValue } from "@cloudagent/storage";
import { isLocalOpenAIConfigured } from "../../platform/openai.mjs";
import { createLocalWorkflowRun } from "../runners/plan-runner.mjs";
import { startLocalWorkflowJob } from "./workflow-jobs.mjs";
import { getNextScheduledRunAt } from "./workflow-scheduler.mjs";
import { WorkflowCreateSchema, WorkflowPatchSchema, localAuth, paginateLocalItems, parseBody, sortLocalItems } from "../../lib/http.mjs";
import { appendWorkflowTaskChatEntry, buildLocalMcpUrl, runLocalCloudAgentChat } from "../agent-runs/agent-run-service.mjs";
import { createWorkflowRunSummary, listWorkflowRunsForQuery } from "./workflow-service.mjs";

export function createWorkflowRouter({ store }) {
  if (!store) throw new Error("createWorkflowRouter requires a store");
  const router = Router();

  router.get("/workflows", async (req, res, next) => {
    try {
      const items = sortLocalItems(
        await store.listWorkflowDefinitions(),
        req.query.sortBy || "updatedAt",
        req.query.sortOrder || "desc"
      );
      const page = paginateLocalItems(items, req.query);
      res.json({ ok: true, workflows: page.items, ...page });
    } catch (error) {
      next(error);
    }
  });


  router.post("/workflows", async (req, res, next) => {
    const body = parseBody(WorkflowCreateSchema, req, res);
    if (!body) return;
    try {
      const workflow = await store.createWorkflowDefinition(body);
      res.status(201).json({ ok: true, workflow, item: workflow });
    } catch (error) {
      next(error);
    }
  });


  router.get("/workflows/:workflowId", async (req, res, next) => {
    try {
      const workflow = await store.getWorkflowDefinition(req.params.workflowId);
      if (!workflow) return res.status(404).json({ ok: false, error: "Workflow not found" });
      res.json({ ok: true, workflow, item: workflow });
    } catch (error) {
      next(error);
    }
  });


  router.patch("/workflows/:workflowId", async (req, res, next) => {
    const body = parseBody(WorkflowPatchSchema, req, res);
    if (!body) return;
    try {
      const workflow = await store.updateWorkflowDefinition(req.params.workflowId, body);
      if (!workflow) return res.status(404).json({ ok: false, error: "Workflow not found" });
      res.json({ ok: true, workflow, item: workflow });
    } catch (error) {
      next(error);
    }
  });


  router.delete("/workflows/:workflowId", async (req, res, next) => {
    try {
      const deleted = await store.deleteWorkflowDefinition(req.params.workflowId);
      res.status(deleted ? 200 : 404).json({
        ok: deleted,
        deleted,
        workflowId: req.params.workflowId,
        ...(deleted ? {} : { error: "Workflow not found" }),
      });
    } catch (error) {
      next(error);
    }
  });


  router.get("/scheduler/workflows", async (_req, res, next) => {
    try {
      const states = await store.listWorkflowScheduleStates();
      res.json({ ok: true, items: states, schedulerStates: states });
    } catch (error) {
      next(error);
    }
  });


  router.get("/scheduler/workflows/:workflowId", async (req, res, next) => {
    try {
      const state = await store.getWorkflowScheduleState(req.params.workflowId);
      if (!state) return res.status(404).json({ ok: false, error: "Workflow schedule state not found" });
      res.json({ ok: true, state, item: state });
    } catch (error) {
      next(error);
    }
  });


  router.post("/scheduler/workflows/:workflowId/recalculate", async (req, res, next) => {
    try {
      const workflow = await store.getWorkflowDefinition(req.params.workflowId);
      if (!workflow) return res.status(404).json({ ok: false, error: "Workflow not found" });
      const schedule = parseStoredJsonValue(workflow.schedule, workflow.schedule || {});
      const nextRunAt = getNextScheduledRunAt(schedule, req.body?.after ? new Date(req.body.after) : new Date());
      const state = await store.updateWorkflowScheduleState(req.params.workflowId, {
        enabled: true,
        nextRunAt,
      });
      res.json({ ok: true, nextRunAt, state });
    } catch (error) {
      next(error);
    }
  });


  router.get("/workflow-runs", async (req, res, next) => {
    try {
      const page = await listWorkflowRunsForQuery(store, req.query);
      res.json({ ok: true, workflowRuns: page.items, ...page });
    } catch (error) {
      next(error);
    }
  });


  router.post("/workflow-runs", async (req, res, next) => {
    const body = parseBody(WorkflowCreateSchema, req, res);
    if (!body) return;
    try {
      const run = await store.createWorkflowRun(body);
      res.status(201).json({ ok: true, workflowRun: run, item: run });
    } catch (error) {
      next(error);
    }
  });


  router.get("/workflow-runs/:workflowRunId", async (req, res, next) => {
    try {
      const run = await store.getWorkflowRun(req.params.workflowRunId);
      if (!run) return res.status(404).json({ ok: false, error: "Workflow run not found" });
      res.json({ ok: true, workflowRunId: req.params.workflowRunId, workflowRun: run, item: run });
    } catch (error) {
      next(error);
    }
  });


  router.patch("/workflow-runs/:workflowRunId", async (req, res, next) => {
    const body = parseBody(WorkflowPatchSchema, req, res);
    if (!body) return;
    try {
      const run = await store.updateWorkflowRun(req.params.workflowRunId, body);
      if (!run) return res.status(404).json({ ok: false, error: "Workflow run not found" });
      res.json({ ok: true, workflowRun: run, item: run });
    } catch (error) {
      next(error);
    }
  });


  router.post("/workflow-runs/:workflowRunId/cancel", async (req, res, next) => {
    try {
      const existing = await store.getWorkflowRun(req.params.workflowRunId);
      if (!existing) return res.status(404).json({ ok: false, error: "Workflow run not found" });
      const definition = parseStoredJsonValue(existing.workflowDefinition, {});
      const cancelledDefinition = createWorkflowRunSummary(definition, "cancelled");
      const run = await store.updateWorkflowRun(req.params.workflowRunId, {
        workflowStatus: "cancelled",
        workflowDefinition: cancelledDefinition,
        currentExecutions: [],
        statusMessage: req.body?.message || "Workflow cancelled in local mode.",
      });
      res.json({ ok: true, workflowRunId: run.workflowRunId, workflowStatus: run.workflowStatus, workflowRun: run, item: run, message: "Workflow cancelled." });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function createWorkflowRootRouter({ store }) {
  if (!store) throw new Error("createWorkflowRootRouter requires a store");
  const router = Router();
  router.use(localAuth);

  router.post("/workflowManager", async (req, res, next) => {
    try {
      const eventType = req.body?.eventType || "workflowStart";
      const workflowRunId = req.body?.workflowRunId;
      console.log("[local workflow] request", {
        eventType,
        workflowRunId: workflowRunId || null,
        workflowId: req.body?.workflowId || req.body?.workflowDefinition?.workflowId || null,
        title: req.body?.title || req.body?.workflowDefinition?.title || null,
        hasWorkflowDefinition: Boolean(req.body?.workflowDefinition),
      });

      if (eventType === "workflowStart") {
        const rawDefinition = req.body?.workflowDefinition || {};
        const workflowDefinition =
          typeof rawDefinition === "string"
            ? parseStoredJsonValue(rawDefinition, {})
            : rawDefinition;
        const result = await createLocalWorkflowRun({
          store,
          workflowRunPreferences:
            req.body?.workflowRunPreferences ||
            workflowDefinition.workflowRunPreferences ||
            workflowDefinition.runPreferences ||
            {},
          mcpUrl: buildLocalMcpUrl(req),
          workflowDefinition: {
            workflowId: workflowDefinition.workflowId || req.body?.workflowId || null,
            title: workflowDefinition.title || req.body?.title || "Untitled Workflow",
            ...workflowDefinition,
          },
        });
        const job = startLocalWorkflowJob({
          store,
          workflowRunId: result.workflowRunId,
          mcpUrl: buildLocalMcpUrl(req),
        });
        console.log("[local workflow] workflowStart accepted", {
          workflowRunId: result.workflowRunId || null,
          workflowStatus: result.workflowStatus || null,
          backgroundJobStartedAt: job.startedAt,
          alreadyRunning: job.alreadyRunning === true,
          message: result.message || null,
        });
        return res.status(202).json({
          ...result,
          ok: true,
          background: true,
          message: result.message || "Workflow run started in local mode.",
        });
      }

      if (!workflowRunId) {
        console.warn("[local workflow] missing workflowRunId", { eventType });
        return res.status(400).json({ ok: false, error: "workflowRunId is required" });
      }

      const existing = await store.getWorkflowRun(workflowRunId);
      if (!existing) {
        console.warn("[local workflow] workflow run not found", {
          eventType,
          workflowRunId,
        });
        return res.status(404).json({ ok: false, error: "Workflow run not found" });
      }

      if (eventType === "workflowCancel") {
        const definition = parseStoredJsonValue(existing.workflowDefinition, {});
        const run = await store.updateWorkflowRun(workflowRunId, {
          workflowStatus: "cancelled",
          workflowDefinition: createWorkflowRunSummary(definition, "cancelled"),
          currentExecutions: [],
          statusMessage: "Workflow cancelled in local mode.",
        });
        console.log("[local workflow] workflowCancel completed", {
          workflowRunId,
          workflowStatus: run.workflowStatus,
        });
        return res.json({
          ok: true,
          workflowRunId: run.workflowRunId,
          workflowStatus: run.workflowStatus,
          workflowRun: run,
          message: "Workflow cancelled.",
        });
      }

      if (eventType === "taskFollowUp") {
        const followUpMessage = String(req.body?.followUpMessage || "").trim();
        if (!followUpMessage) {
          return res.status(400).json({ ok: false, error: "followUpMessage is required" });
        }
        const branchId = req.body?.branchId || null;
        const taskId = req.body?.taskId || null;
        const lastResponseId = req.body?.lastResponseId || null;
        const timestamp = new Date().toISOString();
        const prompt = [
          `A user sent a follow-up message for local workflow run "${workflowRunId}".`,
          branchId ? `Target branch/node id: ${branchId}.` : null,
          taskId ? `Target task id: ${taskId}.` : null,
          lastResponseId ? `Previous response id: ${lastResponseId}.` : null,
          "Use get_workflow_run if you need workflow execution details. Answer the user's follow-up for this workflow task.",
          "If the user is trying to resume execution, explain what can be handled locally and whether a manual rerun is needed.",
          "",
          `User follow-up: ${followUpMessage}`,
        ].filter(Boolean).join("\n");
        const agentResult = isLocalOpenAIConfigured()
          ? await runLocalCloudAgentChat({
              store,
              message: prompt,
            }).catch((error) => {
              console.warn("[local workflow] follow-up chat failed", {
                workflowRunId,
                branchId,
                taskId,
                error: error?.message || String(error),
              });
              return null;
            })
          : null;
        const assistantText = agentResult?.text || [
          `Local follow-up recorded for workflow run ${workflowRunId}.`,
          isLocalOpenAIConfigured()
            ? "The model call failed; check the backend terminal for details."
            : "Set an OpenAI API key in Preferences, or set OPENAI_TOKEN or OPENAI_API_KEY, to enable model-backed local workflow chat.",
        ].join(" ");
        const executionHistory = parseStoredJsonValue(existing.executionHistory, []);
        const currentExecutions = parseStoredJsonValue(existing.currentExecutions, []);
        const historyUpdate = appendWorkflowTaskChatEntry(executionHistory, {
          branchId,
          taskId,
          followUpMessage,
          assistantText,
          responseId: agentResult?.responseId || null,
          timestamp,
        });
        const currentUpdate = appendWorkflowTaskChatEntry(currentExecutions, {
          branchId,
          taskId,
          followUpMessage,
          assistantText,
          responseId: agentResult?.responseId || null,
          timestamp,
        });
        const run = await store.updateWorkflowRun(workflowRunId, {
          executionHistory: historyUpdate.updated,
          currentExecutions: currentUpdate.updated,
          lastMessage: followUpMessage,
          statusMessage: currentUpdate.matched || historyUpdate.matched
            ? "Local workflow follow-up answered."
            : "Local workflow follow-up answered, but the target task was not found in stored execution history.",
        });
        console.log("[local workflow] follow-up answered", {
          workflowRunId,
          branchId,
          taskId,
          matchedExecutionHistory: historyUpdate.matched,
          matchedCurrentExecutions: currentUpdate.matched,
          responseId: agentResult?.responseId || null,
        });
        return res.json({
          ok: true,
          workflowRunId: run.workflowRunId,
          workflowStatus: run.workflowStatus,
          workflowRun: run,
          responseId: agentResult?.responseId || null,
          message: run.statusMessage,
        });
      }

      const run = await store.updateWorkflowRun(workflowRunId, {
        statusMessage:
          eventType === "workflowReconcile"
            ? "Local workflow reconciliation recorded."
            : eventType === "taskRetry"
              ? "Local task retry recorded."
              : `Local workflow event recorded: ${eventType}`,
      });
      console.log("[local workflow] event recorded", {
        eventType,
        workflowRunId,
        workflowStatus: run.workflowStatus,
        statusMessage: run.statusMessage,
      });
      return res.json({
        ok: true,
        workflowRunId: run.workflowRunId,
        workflowStatus: run.workflowStatus,
        workflowRun: run,
        requeuedTaskCount: 0,
        message: run.statusMessage,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
