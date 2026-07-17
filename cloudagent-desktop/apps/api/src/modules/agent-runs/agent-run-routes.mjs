import { Router } from "express";
import { codingAgentRunnerLabel } from "@cloudagent/agent-runtime";
import { parseStoredJsonValue, parseStoredObject } from "@cloudagent/storage";
import { isLocalOpenAIConfigured } from "../../platform/openai.mjs";
import { executeAgentPlan, executeLocalAgentPlanWithCloudAgent } from "../runners/plan-runner.mjs";
import { runLocalExternalAgentBlueprint } from "../skills/codex-runner.mjs";
import { AgentHistoryCreateSchema, AgentHistoryPatchSchema, compactLocalJson, localAuth, parseBody } from "../../lib/http.mjs";
import { EXTERNAL_AGENT_RUN_TASK_ID, attachAgentRunEventRecorder, buildAgentRuntimeDebug, buildCodexLocalDataSnapshot, buildExternalAgentRunSummary, buildLocalBackgroundPreflightAnswer, buildLocalBackgroundPreflightLog, buildLocalMcpUrl, compactCodexHistoryEvents, createAgentRunEventRecorder, createAgentRunLog, extractLocalPlanForSummary, getBlueprintExecutionMode, getLocalCodingAgentSettings, inferStoredCodingAgentRunner, isLocalCodingAgentExecutionMode, listAgentHistoryForQuery, localAgentRunEventSubscribers, normalizeLocalBackgroundRunSettings, recordAgentMessageEvent, recordAgentRunStatusEvent, recordAgentTaskStatusEvent, recordAgentTerminalOutputEvent, recordNormalizedAgentRawEvents, resolveLocalBackgroundBlueprint, resumeLocalExternalAgentRun, runLocalBlueprintPreflight, runLocalCloudAgentBlueprintTask, runLocalCloudAgentChat, runLocalExternalAgentBlueprintSession, sendAgentChunk, sendAgentMessageEvent, sendAgentRunStatus, sendAgentRuntimeDebug, sendAgentTaskStatusEvent, sendAgentTerminalOutputEvent, sendNormalizedAgentRawEvents, subscribeToLocalMcpRunEvents, summarizeLocalAgentRequest } from "./agent-run-service.mjs";
import { findPermissionProfileForAuthProfile, getLocalCredentialRunBlocker } from "../permission-profiles/permission-profile-service.mjs";
import { getLocalCodexSettings } from "../settings/settings-service.mjs";
import { buildRuntimeExternalAgentSkillFilesForRun } from "../skills/skill-service.mjs";

export function createAgentRunRouter({ store }) {
  if (!store) throw new Error("createAgentRunRouter requires a store");
  const router = Router();

  router.get("/agent-history", async (req, res, next) => {
    try {
      const page = await listAgentHistoryForQuery(store, req.query);
      res.json({ ok: true, agentHistory: page.items, ...page });
    } catch (error) {
      next(error);
    }
  });


  router.get("/agent-history/:recordId", async (req, res, next) => {
    try {
      const run = await store.getAgentHistoryRecord(req.params.recordId);
      if (!run) return res.status(404).json({ ok: false, error: "Agent run not found" });
      res.json({ ok: true, recordId: req.params.recordId, agentRun: run, record: run, item: run });
    } catch (error) {
      next(error);
    }
  });


  router.get("/agent-runs", async (req, res, next) => {
    try {
      const page = await listAgentHistoryForQuery(store, req.query);
      res.json({ ok: true, agentRuns: page.items, ...page });
    } catch (error) {
      next(error);
    }
  });


  router.post("/agent-runs", async (req, res, next) => {
    const body = parseBody(AgentHistoryCreateSchema, req, res);
    if (!body) return;
    try {
      const run = await store.createAgentHistoryRecord(body);
      res.status(201).json({ ok: true, agentRun: run, record: run, item: run });
    } catch (error) {
      next(error);
    }
  });


  router.get("/agent-runs/:recordId", async (req, res, next) => {
    try {
      const run = await store.getAgentHistoryRecord(req.params.recordId);
      if (!run) return res.status(404).json({ ok: false, error: "Agent run not found" });
      res.json({ ok: true, recordId: req.params.recordId, agentRun: run, record: run, item: run });
    } catch (error) {
      next(error);
    }
  });


  router.get("/agent-runs/:recordId/events", async (req, res, next) => {
    try {
      const recordId = req.params.recordId;
      const run = await store.getAgentHistoryRecord(recordId);
      if (!run) return res.status(404).json({ ok: false, error: "Agent run not found" });
      const page = await store.listAgentRunEvents(recordId, {
        afterSeq: req.query?.afterSeq ?? req.query?.after ?? 0,
        limit: req.query?.limit ?? 1000,
      });
      res.json({ ok: true, ...page });
    } catch (error) {
      next(error);
    }
  });


  router.get("/agent-runs/:recordId/events/stream", async (req, res, next) => {
    const recordId = req.params.recordId;
    try {
      const run = await store.getAgentHistoryRecord(recordId);
      if (!run) return res.status(404).json({ ok: false, error: "Agent run not found" });

      res.status(200);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();
      sendAgentChunk(res, { type: "message_start", recordId, replay: true });

      const page = await store.listAgentRunEvents(recordId, {
        afterSeq: req.query?.afterSeq ?? req.query?.after ?? 0,
        limit: req.query?.limit ?? 5000,
      });
      for (const event of page.events) {
        sendAgentChunk(res, { type: "agent_event", event });
      }

      const latestRun = await store.getAgentHistoryRecord(recordId).catch(() => run);
      const terminalStatus = ["complete", "completed", "success", "failed", "cancelled", "canceled"].includes(
        String(latestRun?.status || run.status || "").toLowerCase()
      );
      if (terminalStatus) {
        sendAgentChunk(res, { type: "completed", recordId, replay: true });
        return res.end();
      }

      const subscriber = (event) => {
        const wrote = sendAgentChunk(res, { type: "agent_event", event });
        if (!wrote) {
          const subscribers = localAgentRunEventSubscribers.get(recordId);
          subscribers?.delete(subscriber);
          if (subscribers?.size === 0) localAgentRunEventSubscribers.delete(recordId);
        }
      };
      const subscribers = localAgentRunEventSubscribers.get(recordId) || new Set();
      subscribers.add(subscriber);
      localAgentRunEventSubscribers.set(recordId, subscribers);

      const heartbeat = setInterval(() => {
        sendAgentChunk(res, { type: "heartbeat", recordId });
      }, 15000);

      req.on("close", () => {
        clearInterval(heartbeat);
        subscribers.delete(subscriber);
        if (subscribers.size === 0) localAgentRunEventSubscribers.delete(recordId);
      });
    } catch (error) {
      if (res.headersSent) {
        sendAgentChunk(res, {
          type: "error",
          error_code: error?.status || "AGENT_RUN_EVENTS_STREAM_FAILED",
          message: error?.message || "Failed to stream agent run events.",
        });
        return res.end();
      }
      next(error);
    }
  });


  router.patch("/agent-runs/:recordId", async (req, res, next) => {
    const body = parseBody(AgentHistoryPatchSchema, req, res);
    if (!body) return;
    try {
      const run = await store.updateAgentHistoryRecord(req.params.recordId, body);
      if (!run) return res.status(404).json({ ok: false, error: "Agent run not found" });
      res.json({ ok: true, agentRun: run, record: run, item: run });
    } catch (error) {
      next(error);
    }
  });


  router.post("/codex/agent-runs/:recordId/resume", async (req, res, next) => {
    try {
      const prompt = String(req.body?.prompt || req.body?.message || "").trim();
      if (!prompt) {
        return res.status(400).json({ ok: false, error: "Prompt is required" });
      }
      const existing = await store.getAgentHistoryRecord(req.params.recordId);
      if (!existing) return res.status(404).json({ ok: false, error: "Agent run not found" });
      const existingLog = parseStoredJsonValue(existing?.log, {}) || {};
      const existingPreflight =
        existingLog?.preflight && typeof existingLog.preflight === "object"
          ? existingLog.preflight
          : null;
      const runner = inferStoredCodingAgentRunner(existing, existingLog);
      const runnerLabel = codingAgentRunnerLabel(runner);

      res.status(200);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.flushHeaders?.();
      attachAgentRunEventRecorder(res, { store, recordId: req.params.recordId });
      sendAgentChunk(res, { type: "message_start", recordId: req.params.recordId });
      sendAgentTaskStatusEvent(res, {
        recordId: req.params.recordId,
        runner,
        taskId: EXTERNAL_AGENT_RUN_TASK_ID,
        status: "in-progress",
        output: `Resuming ${runnerLabel} session with your reply.`,
      });

      await store.updateAgentHistoryRecord(req.params.recordId, {
        status: "running",
        executionMode: runner,
        runner,
      });

      const forwardExternalAgentEvent = (event) => {
        sendNormalizedAgentRawEvents(res, { event }, {
          recordId: req.params.recordId,
          runner,
          task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
          phaseIndex: 0,
          taskIndex: 0,
        });
      };
      const mcpForwarder = subscribeToLocalMcpRunEvents({
        req,
        recordId: req.params.recordId,
        runner,
        onEvent: forwardExternalAgentEvent,
        onMcpEvent: (event) => {
          sendNormalizedAgentRawEvents(res, { event }, {
            recordId: req.params.recordId,
            runner,
            task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
            phaseIndex: 0,
            taskIndex: 0,
          });
        },
      });
      let result;
      try {
        result = await resumeLocalExternalAgentRun({
          store,
          recordId: req.params.recordId,
          runner,
          prompt,
          mcpUrl: buildLocalMcpUrl(req, {
            recordId: req.params.recordId,
            runner,
            authProfile: parseStoredObject(existing.authProfile, existing.authProfile || {}),
            executionContext: existingPreflight?.executionContext || null,
            preflightResult: existingPreflight,
          }),
          onCodexEvent: forwardExternalAgentEvent,
          onCodexStderr: (content) => {
            sendNormalizedAgentRawEvents(res, { type: "codex_stderr", content }, {
              recordId: req.params.recordId,
              runner,
              task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
              phaseIndex: 0,
              taskIndex: 0,
            });
          },
        });
      } finally {
        mcpForwarder.cleanup();
      }

      sendAgentTaskStatusEvent(res, {
        recordId: result.recordId || req.params.recordId,
        runner,
        taskId: EXTERNAL_AGENT_RUN_TASK_ID,
        status: result.status,
        output: result.logEntry?.task_output || result.summary,
        runSummary: result.runSummary,
      });
      sendAgentRunStatus(res, {
        recordId: result.recordId || req.params.recordId,
        runner,
        completed: true,
        status: result.recordStatus || result.status,
        summary: result.summary,
        runSummary: result.runSummary,
      });
      sendAgentChunk(res, {
        type: "message_end",
        recordId: result.recordId,
        status: result.recordStatus || result.status,
      });
      sendAgentChunk(res, { type: "completed" });
      return res.end();
    } catch (error) {
      if (res.headersSent) {
        sendAgentChunk(res, {
          type: "error",
          error_code: error?.status || "EXTERNAL_AGENT_RESUME_FAILED",
          message: error?.message || "Failed to resume external agent session.",
        });
        sendAgentChunk(res, { type: "completed" });
        return res.end();
      }
      next(error);
    }
  });


  router.get("/blueprint-runs", async (req, res, next) => {
    try {
      const blueprintId = req.query.blueprintId ? String(req.query.blueprintId) : null;
      const page = await listAgentHistoryForQuery(store, {
        ...req.query,
        agentType: req.query.agentType || "agent",
      });
      const items = blueprintId
        ? page.items.filter((item) => item?.itemId === blueprintId)
        : page.items;
      res.json({
        ok: true,
        blueprintRuns: items,
        items,
        count: items.length,
        nextToken: page.nextToken,
        nextCursor: page.nextCursor,
      });
    } catch (error) {
      next(error);
    }
  });


  router.post("/agent-runs/:recordId/cancel", async (req, res, next) => {
    try {
      const existing = await store.getAgentHistoryRecord(req.params.recordId);
      if (!existing) return res.status(404).json({ ok: false, error: "Agent run not found" });
      const run = await store.updateAgentHistoryRecord(req.params.recordId, {
        status: "cancelled",
        log: req.body?.log || createAgentRunLog({
          title: existing.title,
          status: "cancelled",
          blueprintId: existing.itemId,
          summary: "This local agent run was cancelled.",
        }),
      });
      res.json({ ok: true, recordId: run.recordId, agentRun: run, record: run, item: run, message: "Agent run cancelled." });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function createAgentRunRootRouter({ store }) {
  if (!store) throw new Error("createAgentRunRootRouter requires a store");
  const router = Router();
  router.use(localAuth);

  router.post("/runAgentBackground", async (req, res, next) => {
    try {
      console.log("[local /runAgentBackground] request", summarizeLocalAgentRequest({
        ...(req.body || {}),
        authProfile: req.body?.inputSettings?.authProfile || req.body?.authProfile || null,
      }));
      const eventType = req.body?.eventType || "runAgent";

      if (eventType === "taskFollowUp") {
        const recordId = req.body?.followUp?.recordId || req.body?.agentRunId;
        if (!recordId) return res.status(400).json({ ok: false, error: "recordId is required" });
        const existing = await store.getAgentHistoryRecord(recordId);
        if (!existing) return res.status(404).json({ ok: false, error: "Agent run not found" });
        const message = String(req.body?.followUp?.followUpMessage || req.body?.followUpMessage || "").trim();
        if (!message) return res.status(400).json({ ok: false, error: "followUpMessage is required" });
        const existingLog = parseStoredJsonValue(existing.log, {}) || {};
        const logs = Array.isArray(existingLog.logs) ? existingLog.logs : [];
        const prompt = [
          `A user sent a follow-up message for local agent run "${recordId}".`,
          "Use get_agent_run if you need the run details. Answer the user's follow-up based on the local agent run state.",
          "If local execution cannot resume automatically, say that clearly and suggest the next local action.",
          "",
          `User follow-up: ${message}`,
        ].join("\n");
        const agentResult = isLocalOpenAIConfigured()
          ? await runLocalCloudAgentChat({
              store,
              message: prompt,
            }).catch((error) => {
              console.warn("[local /runAgentBackground] follow-up chat failed", {
                recordId,
                error: error?.message || String(error),
              });
              return null;
            })
          : null;
        const assistantText = agentResult?.text || [
          `Local follow-up recorded for agent run ${recordId}.`,
          isLocalOpenAIConfigured()
            ? "The model call failed; check the backend terminal for details."
            : "Set an OpenAI API key in Preferences, or set OPENAI_TOKEN or OPENAI_API_KEY, to enable model-backed local agent follow-up chat.",
        ].join(" ");
        const run = await store.updateAgentHistoryRecord(recordId, {
          log: {
            ...existingLog,
            logs: [
              ...logs,
              {
                taskId: "local_follow_up",
                status: "complete",
                input: message,
                output: assistantText,
                task_output: assistantText,
                responseId: agentResult?.responseId || null,
                timestamp: new Date().toISOString(),
              },
            ],
          },
        });
        return res.json({
          ok: true,
          recordId: run.recordId,
          record: run,
          agentRun: run,
          responseId: agentResult?.responseId || null,
          message: "Local agent follow-up answered.",
        });
      }

      const planId = req.body?.planId || req.body?.blueprintId || req.body?.recordId || "local-agent";
      const inputSettings = req.body?.inputSettings || {};
      const runSettings = normalizeLocalBackgroundRunSettings(inputSettings);
      const authProfile = runSettings.authProfile && Object.keys(runSettings.authProfile).length
        ? runSettings.authProfile
        : parseStoredObject(req.body?.authProfile, {});
      const selectedPermissionProfile = await findPermissionProfileForAuthProfile(store, authProfile);
      const credentialBlocker = getLocalCredentialRunBlocker(selectedPermissionProfile, authProfile);
      if (credentialBlocker) {
        console.warn("[local /runAgentBackground] blocked by credential status", {
          planId,
          permissionProfileId:
            selectedPermissionProfile?.recordId ||
            authProfile?.permissionProfileId ||
            authProfile?.recordId ||
            authProfile?.id ||
            null,
          code: credentialBlocker.code,
          status: credentialBlocker.status,
        });
        return res.status(412).json({
          ok: false,
          error: credentialBlocker.message,
          code: credentialBlocker.code,
          credentialStatus: credentialBlocker.credentialStatus,
        });
      }
      const blueprint = await resolveLocalBackgroundBlueprint(store, planId);
      if (!blueprint && !req.body?.plan) {
        return res.status(404).json({
          ok: false,
          error: "Skill not found",
          planId,
        });
      }
      const title = blueprint?.title || req.body?.title || planId;
      const requestedExecutionMode = getBlueprintExecutionMode(blueprint, req.body?.plan || null, req.body || {});
      const skipBlueprintRewrite = isLocalCodingAgentExecutionMode(requestedExecutionMode);
      const requestedRunnerLabel = codingAgentRunnerLabel(requestedExecutionMode);
      const startedAt = new Date().toISOString();
      let preflightRecord = await store.createAgentHistoryRecord({
        itemId: planId,
        agentType: "agent",
        status: "running",
        title,
        parentId: req.body?.parentId || null,
        authProfile,
        executionMode: requestedExecutionMode,
        runner: requestedExecutionMode,
        settings: {
          ...inputSettings,
          executionMode: requestedExecutionMode,
          runner: requestedExecutionMode,
          localBackgroundPreflight: {
            status: "starting",
            autoConfirmed: true,
          },
        },
        log: {
          logs: [],
          currentPhase: 0,
          currentTask: 0,
          lastUpdated: startedAt,
          blueprintId: planId,
          isBluePrint: true,
          executionMode: requestedExecutionMode,
          runner: requestedExecutionMode,
          runSummary: {
            summary: `Preparing local ${requestedRunnerLabel} run for "${title}".`,
            finalSummary: `Preparing local ${requestedRunnerLabel} run for "${title}".`,
            generatedAt: startedAt,
            status: "running",
          },
        },
      });
      console.log("[local /runAgentBackground] preflight starting", {
        planId,
        title,
        recordId: preflightRecord.recordId,
        hasBlueprint: Boolean(blueprint),
        hasPlanPayload: Boolean(req.body?.plan),
        openAIConfigured: isLocalOpenAIConfigured(),
        requestedExecutionMode,
        skipBlueprintRewrite,
        configurationMode: runSettings.configurationMode,
        selectedWorkloadOrStack: runSettings.selectedWorkloadOrStack,
        regionCount: runSettings.regions.length,
      });
      let preflightResult;
      try {
        preflightResult = await runLocalBlueprintPreflight({
          store,
          blueprintId: planId,
          blueprint,
          planPayload: req.body?.plan || null,
          title,
          authProfile,
          regions: runSettings.regions,
          defaultValues: runSettings.defaultValues,
          executionPreferences: runSettings.executionPreferences,
          selectedWorkloadOrStack: runSettings.selectedWorkloadOrStack,
          configurationMode: runSettings.configurationMode,
          stackAction: runSettings.stackAction,
          existingStack: runSettings.existingStack,
          existingStacks: runSettings.existingStacks,
          additionalInstructions: runSettings.additionalInstructions,
          preflightAnswer: buildLocalBackgroundPreflightAnswer(),
          skipBlueprintRewrite,
          onPrepEvent: (type, payload = {}) => {
            console.log("[local /runAgentBackground] preflight event", {
              type,
              phase: payload.phase || null,
              message: payload.message || null,
            });
          },
        });
      } catch (error) {
        const failedAt = new Date().toISOString();
        const errorMessage = error?.message || String(error);
        await store.updateAgentHistoryRecord(preflightRecord.recordId, {
          status: "failed",
          executionMode: requestedExecutionMode,
          runner: requestedExecutionMode,
          log: {
            logs: [
              {
                taskId: "local_background_preflight",
                phaseIndex: 0,
                taskIndex: 0,
                status: "failed",
                output: errorMessage,
                task_output: errorMessage,
                cli_command_output: [],
                timestamp: failedAt,
              },
            ],
            currentPhase: 0,
            currentTask: 0,
            lastUpdated: failedAt,
            blueprintId: planId,
            isBluePrint: true,
            executionMode: requestedExecutionMode,
            runner: requestedExecutionMode,
            runSummary: {
              summary: `Local ${requestedRunnerLabel} preflight failed for "${title}".`,
              finalSummary: `Local ${requestedRunnerLabel} preflight failed for "${title}".`,
              generatedAt: failedAt,
              status: "failed",
            },
          },
        });
        throw error;
      }
      const effectivePlanPayload = skipBlueprintRewrite
        ? req.body?.plan || null
        : preflightResult?.updatedBlueprint || req.body?.plan || null;
      const permissionProfileId =
        preflightResult?.rewriteConfig?.permissionProfileId ||
        authProfile?.permissionProfileId ||
        authProfile?.recordId ||
        authProfile?.id ||
        null;
      preflightRecord = await store.updateAgentHistoryRecord(preflightRecord.recordId, {
        status: "running",
        executionMode: requestedExecutionMode,
        runner: requestedExecutionMode,
        authProfile,
        settings: {
          ...inputSettings,
          executionMode: requestedExecutionMode,
          runner: requestedExecutionMode,
          localBackgroundPreflight: {
            status: preflightResult?.status || null,
            autoConfirmed: true,
            updatedBlueprint: !skipBlueprintRewrite && Boolean(preflightResult?.updatedBlueprint),
            updatedBlueprintFile: !skipBlueprintRewrite ? preflightResult?.updatedBlueprintDebugFile || null : null,
            validationOk: preflightResult?.validation?.ok ?? null,
          },
        },
        updatedBlueprint: !skipBlueprintRewrite ? preflightResult?.updatedBlueprint || null : null,
        log: buildLocalBackgroundPreflightLog({
          blueprintId: planId,
          preflightResult,
          defaultValues: runSettings.defaultValues,
          regions: runSettings.regions,
          permissionProfileId,
          executionMode: requestedExecutionMode,
        }),
      });
      console.log("[local /runAgentBackground] preflight complete", {
        planId,
        recordId: preflightRecord.recordId,
        status: preflightResult?.status || null,
        isReadOnly: preflightResult?.readOnlyResult?.isReadOnly ?? null,
        isMutating: preflightResult?.analysis?.isMutating ?? null,
        updatedBlueprint: !skipBlueprintRewrite && Boolean(preflightResult?.updatedBlueprint),
        updatedBlueprintFile: !skipBlueprintRewrite ? preflightResult?.updatedBlueprintDebugFile || null : null,
        validationOk: preflightResult?.validation?.ok ?? null,
      });
      const recordRunEvent = createAgentRunEventRecorder({
        store,
        recordId: preflightRecord.recordId,
      });
      const executionMode = getBlueprintExecutionMode(blueprint, effectivePlanPayload, req.body || {});
      if (isLocalCodingAgentExecutionMode(executionMode)) {
        const runnerLabel = codingAgentRunnerLabel(executionMode);
        const phases = extractLocalPlanForSummary({ blueprint, planPayload: effectivePlanPayload }).phases;
        const localDataSnapshot = await buildCodexLocalDataSnapshot(store, {
          authProfile,
          selectedWorkloadOrStack: runSettings.selectedWorkloadOrStack,
        });
        const codexSettings = await getLocalCodexSettings(store);
        const agentSettings = getLocalCodingAgentSettings(codexSettings, executionMode);
        const { skillFiles: codexSkillFiles, executionContext: skillExecutionContext } =
          await buildRuntimeExternalAgentSkillFilesForRun({
            title,
            runner: executionMode,
            blueprint,
            planPayload: effectivePlanPayload,
            preflightResult,
            authProfile,
            regions: runSettings.regions,
            defaultValues: runSettings.defaultValues,
            executionPreferences: runSettings.executionPreferences,
            localDataSnapshot,
          });
        console.log(`[local /runAgentBackground] ${runnerLabel} skill context ready`, {
          planId,
          recordId: preflightRecord.recordId,
          generatedBy: skillExecutionContext.generatedBy,
          contextChars: String(skillExecutionContext.markdown || "").length,
        });
        recordAgentTaskStatusEvent(recordRunEvent, {
          recordId: preflightRecord.recordId,
          runner: executionMode,
          taskId: EXTERNAL_AGENT_RUN_TASK_ID,
          status: "in-progress",
          output: `Starting ${runnerLabel} session for "${title}".`,
        });
        const forwardCodingAgentEvent = (event) => {
          recordNormalizedAgentRawEvents(recordRunEvent, { event }, {
            req,
            recordId: preflightRecord.recordId,
            runner: executionMode,
            task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
            phaseIndex: 0,
            taskIndex: 0,
          });
        };
        const mcpForwarder = subscribeToLocalMcpRunEvents({
          req,
          recordId: preflightRecord.recordId,
          runner: executionMode,
          onEvent: forwardCodingAgentEvent,
          onMcpEvent: forwardCodingAgentEvent,
        });
        let codexResult;
        try {
          codexResult = await runLocalExternalAgentBlueprint({
            runner: executionMode,
            blueprintId: planId,
            title,
            blueprint,
            planPayload: effectivePlanPayload,
            phases,
            priorLogs: [],
            authProfile,
            executionContext: preflightResult?.executionContext || null,
            regions: runSettings.regions,
            defaultValues: runSettings.defaultValues,
            executionPreferences: runSettings.executionPreferences,
            localDataSnapshot,
            mcpUrl: buildLocalMcpUrl(req, {
              recordId: preflightRecord.recordId,
              runner: executionMode,
              authProfile,
              regions: runSettings.regions,
              executionContext: preflightResult?.executionContext || null,
              preflightResult,
              permissionProfileId,
            }),
            recordId: preflightRecord.recordId,
            workspaceDir: agentSettings.workspaceDir,
            agentBinary: agentSettings.agentBinary,
            skillFiles: codexSkillFiles,
            onEvent: forwardCodingAgentEvent,
            onStderr: (content) => {
              recordNormalizedAgentRawEvents(recordRunEvent, { type: "codex_stderr", content }, {
                req,
                recordId: preflightRecord.recordId,
                runner: executionMode,
                task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
                phaseIndex: 0,
                taskIndex: 0,
              });
            },
          });
        } finally {
          mcpForwarder.cleanup();
        }
        codexResult.events = [
          ...(Array.isArray(codexResult.events) ? codexResult.events : []),
          ...mcpForwarder.events,
        ];
        const now = new Date().toISOString();
        const logEntry = {
          taskId: EXTERNAL_AGENT_RUN_TASK_ID,
          status: codexResult.status,
          output: codexResult.output,
          task_output: codexResult.output,
          executionMode,
          runner: executionMode,
          codex: {
            runDir: codexResult.runDir,
            threadId: codexResult.threadId || null,
            exitCode: codexResult.exitCode,
            timedOut: Boolean(codexResult.timedOut),
            eventCount: Array.isArray(codexResult.events) ? codexResult.events.length : 0,
            events: compactCodexHistoryEvents(codexResult.events),
            stderr: compactLocalJson(codexResult.stderr || "", 4000),
          },
          timestamp: now,
        };
        const runSummary = await buildExternalAgentRunSummary({
          title,
          runnerLabel,
          runner: executionMode,
          status: codexResult.status,
          output: codexResult.output,
          events: codexResult.events,
        });
        recordAgentTaskStatusEvent(recordRunEvent, {
          recordId: preflightRecord.recordId,
          runner: executionMode,
          taskId: EXTERNAL_AGENT_RUN_TASK_ID,
          status: codexResult.status,
          output: logEntry.task_output || runSummary.summary,
          runSummary,
        });
        recordAgentRunStatusEvent(recordRunEvent, {
          recordId: preflightRecord.recordId,
          runner: executionMode,
          completed: true,
          status: codexResult.status,
          summary: runSummary.summary,
          runSummary,
        });
        const record = await store.updateAgentHistoryRecord(preflightRecord.recordId, {
          status: codexResult.status,
          executionMode,
          runner: executionMode,
          log: {
            ...parseStoredJsonValue(preflightRecord.log, {}),
            executionMode,
            runner: executionMode,
            logs: [logEntry],
            lastUpdated: now,
            runSummary,
          },
        });
        return res.status(201).json({
          ok: codexResult.status === "complete",
          status: codexResult.status,
          recordId: record?.recordId || preflightRecord.recordId,
          record,
          agentRun: record,
          summary: runSummary.summary,
          runSummary,
          logs: [logEntry],
          preflight: preflightResult,
          runner: executionMode,
          executionMode,
          message: runSummary.summary || `Local ${runnerLabel} finished "${title}" with status ${codexResult.status}.`,
        });
      }
      recordAgentRunStatusEvent(recordRunEvent, {
        recordId: preflightRecord.recordId,
        runner: "cloudagent",
        status: "running",
        summary: `Local CloudAgent started "${title}".`,
      });
      const recordCloudAgentTaskStart = async ({ task, phaseIndex, taskIndex }) => {
        recordAgentTaskStatusEvent(recordRunEvent, {
          recordId: preflightRecord.recordId,
          runner: "cloudagent",
          task,
          phaseIndex,
          taskIndex,
          status: "in-progress",
          output: `Running ${task?.title || task?.name || task?.id || "task"}.`,
        });
      };
      const recordCloudAgentTaskResult = async ({ task, logEntry, runSummary }) => {
        for (const commandOutput of Array.isArray(logEntry?.cli_command_output)
          ? logEntry.cli_command_output
          : []) {
          recordAgentTerminalOutputEvent(recordRunEvent, {
            recordId: preflightRecord.recordId,
            runner: "cloudagent",
            task,
            phaseIndex: logEntry.phaseIndex,
            taskIndex: logEntry.taskIndex,
            command: commandOutput.command || commandOutput.cli_command,
            output: commandOutput.output || "",
            raw: commandOutput,
          });
        }
        recordAgentTaskStatusEvent(recordRunEvent, {
          recordId: preflightRecord.recordId,
          runner: "cloudagent",
          task,
          phaseIndex: logEntry?.phaseIndex,
          taskIndex: logEntry?.taskIndex,
          status: logEntry?.status,
          output: logEntry?.task_output || logEntry?.output || "",
          runSummary,
          raw: logEntry,
        });
      };
      const cloudAgentResult = await executeLocalAgentPlanWithCloudAgent({
        store,
        planId,
        blueprint,
        planPayload: effectivePlanPayload,
        inputSettings: {
          ...inputSettings,
          authProfile,
          regions: runSettings.regions,
          defaultValues: runSettings.defaultValues,
          executionPreferences: runSettings.executionPreferences,
          selectedWorkloadOrStack: runSettings.selectedWorkloadOrStack,
          preflight: preflightResult,
        },
        authProfile,
        recordId: preflightRecord.recordId,
        parentId: req.body?.parentId || null,
        title,
        onTaskStart: recordCloudAgentTaskStart,
        onTaskToken: ({ token, task, phaseIndex, taskIndex }) => {
          recordAgentMessageEvent(recordRunEvent, {
            recordId: preflightRecord.recordId,
            runner: "cloudagent",
            task,
            phaseIndex,
            taskIndex,
            text: token,
          });
        },
        onContextEvent: ({ payload, task, phaseIndex, taskIndex }) => {
          recordNormalizedAgentRawEvents(recordRunEvent, { event: payload }, {
            recordId: preflightRecord.recordId,
            runner: "cloudagent",
            task,
            phaseIndex,
            taskIndex,
          });
        },
        onTaskResult: recordCloudAgentTaskResult,
      });
      if (!cloudAgentResult) {
        console.log("[local /runAgentBackground] falling back to CLI executor", {
          planId,
          recordId: preflightRecord.recordId,
          reason: "local_openai_not_configured",
        });
      }
      const result = cloudAgentResult || await executeAgentPlan({
        store,
        planId,
        blueprint,
        planPayload: effectivePlanPayload,
        inputSettings: {
          ...inputSettings,
          authProfile,
          regions: runSettings.regions,
          defaultValues: runSettings.defaultValues,
          executionPreferences: runSettings.executionPreferences,
          selectedWorkloadOrStack: runSettings.selectedWorkloadOrStack,
          preflight: preflightResult,
        },
        authProfile,
        recordId: preflightRecord.recordId,
        parentId: req.body?.parentId || null,
        title,
        onTaskStart: recordCloudAgentTaskStart,
        onTaskResult: recordCloudAgentTaskResult,
      });
      recordAgentRunStatusEvent(recordRunEvent, {
        recordId: result.recordId || preflightRecord.recordId,
        runner: "cloudagent",
        completed: true,
        status: result.status,
        summary: result.summary,
        runSummary: result.runSummary,
      });
      res.status(201).json({
        ...result,
        preflight: preflightResult,
        message: result.summary || "Agent run completed in local mode.",
      });
    } catch (error) {
      next(error);
    }
  });


  router.get("/agent/connections/:recordId", async (req, res, next) => {
    try {
      const record = await store.getAgentHistoryRecord(req.params.recordId);
      if (!record) return res.status(404).json({ ok: false, error: "Agent run not found" });
      res.json({ ok: true, record, agentRun: record, item: record });
    } catch (error) {
      next(error);
    }
  });


  router.post("/agent/connections", async (req, res, next) => {
    try {
      const record = await store.createAgentHistoryRecord(req.body || {});
      res.status(201).json({ ok: true, record, agentRun: record, item: record });
    } catch (error) {
      next(error);
    }
  });


  router.post("/agent", async (req, res, next) => {
    try {
      console.log("[local /agent] request", summarizeLocalAgentRequest(req.body || {}));
      const recordId = req.body?.recordId || req.body?.agentRunId || null;
      const blueprintId = req.body?.blueprintId || req.body?.planId || req.body?.plan?.recordId || null;
      const blueprint = blueprintId ? await store.getSkill(blueprintId) : null;
      const planPayload = req.body?.plan || null;
      const title = req.body?.plan?.title || req.body?.plan?.planTitle || blueprint?.title || blueprintId || "Local Agent";

      res.status(200);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.flushHeaders?.();
      attachAgentRunEventRecorder(res, { store, recordId });
      sendAgentChunk(res, { type: "message_start", sessionId: req.body?.sessionId || null });
      if (blueprint || planPayload) {
        const blueprintPayload = blueprint
          ? {
              recordId: blueprint.recordId,
              title: blueprint.title,
              cloudProvider: blueprint.cloudProvider,
              plan: parseStoredJsonValue(blueprint.plan, {}),
              planSettings: parseStoredJsonValue(blueprint.planSettings, {}),
            }
          : planPayload;
        sendAgentChunk(res, { type: "blueprint_updated", blueprint: blueprintPayload });
      }
      if (!req.body?.task) {
        const authProfileForRun = parseStoredObject(req.body?.authProfile, {});
        const requestedExecutionMode = getBlueprintExecutionMode(blueprint, planPayload, req.body || {});
        const skipBlueprintRewrite = isLocalCodingAgentExecutionMode(requestedExecutionMode);
        sendAgentChunk(res, {
          type: "prep_started",
          phase: "analyze_skill_intent",
          message: "Preparing skill execution context.",
        });
        const preflightResult = await runLocalBlueprintPreflight({
          store,
          recordId,
          blueprintId,
          blueprint,
          planPayload,
          title,
          authProfile: authProfileForRun,
          regions: Array.isArray(req.body?.regions) ? req.body.regions : [],
          defaultValues: req.body?.defaultValues || {},
          executionPreferences: req.body?.executionPreferences || {},
          selectedWorkloadOrStack: req.body?.selectedWorkloadOrStack || null,
          configurationMode: req.body?.configurationMode || req.body?.configurationMethod || null,
          stackAction: req.body?.stackAction || null,
          existingStack: req.body?.existingStack || null,
          existingStacks: Array.isArray(req.body?.existingStacks) ? req.body.existingStacks : [],
          additionalInstructions: req.body?.additionalInstructions || null,
          preflightAnswer: req.body?.preflightAnswer || null,
          skipBlueprintRewrite,
          onPrepEvent: (type, payload) => sendAgentChunk(res, { type, ...payload }),
        });

        if (!req.body?.preflightAnswer) {
          sendAgentChunk(res, {
            type: "prep_question",
            phase: "confirm_analysis",
            message: "Review the analysis outcomes before continuing.",
            question: preflightResult.question,
          });
          sendAgentChunk(res, {
            type: "message_end",
            recordId,
            status: "waiting_on_user_input",
          });
          sendAgentChunk(res, { type: "completed" });
          console.log("[local /agent] preflight review requested", {
            recordId,
            blueprintId,
            hasPlanPayload: Boolean(planPayload),
          });
          return res.end();
        }

        const existing = recordId ? await store.getAgentHistoryRecord(recordId) : null;
        const rewrittenBlueprintPayload = skipBlueprintRewrite ? null : preflightResult.updatedBlueprint || null;
        if (rewrittenBlueprintPayload) {
          sendAgentChunk(res, { type: "blueprint_updated", blueprint: rewrittenBlueprintPayload });
        }
        sendAgentChunk(res, {
          type: "prep_ready",
          phase: preflightResult.validation ? "validate_rewrite" : "confirm_analysis",
          analysis: preflightResult.analysis || null,
          validation: preflightResult.validation || null,
          updatedBlueprintFile: preflightResult.updatedBlueprintDebugFile || null,
        });
        if (existing) {
          const existingLog = parseStoredJsonValue(existing.log, {}) || {};
          await store.updateAgentHistoryRecord(recordId, {
            status: "running",
            authProfile: req.body?.authProfile || existing.authProfile || {},
            updatedBlueprint: skipBlueprintRewrite ? null : rewrittenBlueprintPayload || existing.updatedBlueprint || null,
            log: {
              ...existingLog,
              currentPhase: existingLog.currentPhase || 0,
              currentTask: existingLog.currentTask || 0,
              lastUpdated: new Date().toISOString(),
              blueprintId: blueprintId || existingLog.blueprintId || existing.itemId,
              isBluePrint: existingLog.isBluePrint ?? Boolean(blueprintId),
              executionMode: getBlueprintExecutionMode(blueprint, planPayload, req.body || {}),
              runner: getBlueprintExecutionMode(blueprint, planPayload, req.body || {}),
              preflight: {
                status: preflightResult.status || null,
                readOnlyResult: preflightResult.readOnlyResult || null,
                executionContext: preflightResult.executionContext || null,
                analysis: preflightResult.analysis || null,
                recommendation: preflightResult.recommendation || null,
                updateStrategy: preflightResult.updateStrategy || null,
                rewriteConfig: preflightResult.rewriteConfig || null,
                validation: preflightResult.validation || null,
                debugArtifacts: preflightResult.debugArtifacts || null,
                updatedBlueprintDebugFile: preflightResult.updatedBlueprintDebugFile || null,
              },
              globalSettings: {
                ...(existingLog.globalSettings || {}),
                ...(req.body?.defaultValues ? { defaultValues: req.body.defaultValues } : {}),
                ...(Array.isArray(req.body?.regions) ? { select_aws_regions: req.body.regions } : {}),
                ...(req.body?.permissionProfileId ? { permissionProfileId: req.body.permissionProfileId } : {}),
              },
            },
          });
        }
        const executionMode = getBlueprintExecutionMode(blueprint, rewrittenBlueprintPayload || planPayload, req.body || {});
        const externalAgentPlanPayload = isLocalCodingAgentExecutionMode(executionMode)
          ? planPayload
          : rewrittenBlueprintPayload || planPayload;
        sendAgentRuntimeDebug(res, buildAgentRuntimeDebug({
          stage: "route_selection_after_preflight",
          requestBody: req.body || {},
          blueprint,
          planPayload: externalAgentPlanPayload,
          executionMode,
        }));
        if (isLocalCodingAgentExecutionMode(executionMode)) {
          const runnerLabel = codingAgentRunnerLabel(executionMode);
          sendAgentTaskStatusEvent(res, {
            req,
            recordId,
            runner: executionMode,
            taskId: EXTERNAL_AGENT_RUN_TASK_ID,
            status: "in-progress",
            output: `Starting ${runnerLabel} session for "${title}".`,
          });
          const codexSettings = await getLocalCodexSettings(store);
          const agentSettings = getLocalCodingAgentSettings(codexSettings, executionMode);
          sendAgentRuntimeDebug(res, buildAgentRuntimeDebug({
            stage: "external_agent_settings",
            requestBody: req.body || {},
            blueprint,
            planPayload: externalAgentPlanPayload,
            executionMode,
            agentSettings,
          }));
          const codexSessionResult = await runLocalExternalAgentBlueprintSession({
            runner: executionMode,
            req,
            store,
            recordId,
            blueprintId: blueprintId || req.body?.planId || recordId || "local-agent",
            blueprint,
            planPayload: externalAgentPlanPayload,
            title,
            authProfile: authProfileForRun,
            regions: Array.isArray(req.body?.regions) ? req.body.regions : [],
            defaultValues: req.body?.defaultValues || {},
            executionPreferences: req.body?.executionPreferences || {},
            selectedWorkloadOrStack: req.body?.selectedWorkloadOrStack || null,
            preflightResult,
            onCodexEvent: (event) => {
              sendNormalizedAgentRawEvents(res, { event }, {
                req,
                recordId,
                runner: executionMode,
                task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
                phaseIndex: 0,
                taskIndex: 0,
              });
            },
            onMcpEvent: (event) => {
              sendNormalizedAgentRawEvents(res, { event }, {
                req,
                recordId,
                runner: executionMode,
                task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
                phaseIndex: 0,
                taskIndex: 0,
              });
            },
            onCodexStderr: (content) => {
              sendNormalizedAgentRawEvents(res, { type: "codex_stderr", content }, {
                req,
                recordId,
                runner: executionMode,
                task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
                phaseIndex: 0,
                taskIndex: 0,
              });
            },
          });
          sendAgentTaskStatusEvent(res, {
            req,
            recordId: codexSessionResult.recordId || recordId,
            runner: executionMode,
            taskId: EXTERNAL_AGENT_RUN_TASK_ID,
            status: codexSessionResult.status,
            output: codexSessionResult.logEntry?.task_output || codexSessionResult.summary,
            runSummary: codexSessionResult.runSummary,
          });
          console.log("[local /agent] external run summary event", {
            recordId: codexSessionResult.recordId || recordId,
            runner: executionMode,
            status: codexSessionResult.recordStatus || codexSessionResult.status,
            summaryChars: String(codexSessionResult.summary || "").length,
            runSummarySummaryChars: String(codexSessionResult.runSummary?.summary || "").length,
            runSummaryFinalChars: String(codexSessionResult.runSummary?.finalSummary || "").length,
            rawFinalSummaryChars: String(codexSessionResult.runSummary?.rawFinalSummary || "").length,
            generatedBy: codexSessionResult.runSummary?.generatedBy || null,
          });
          sendAgentRunStatus(res, {
            req,
            recordId: codexSessionResult.recordId || recordId,
            runner: executionMode,
            completed: true,
            status: codexSessionResult.recordStatus || codexSessionResult.status,
            summary: codexSessionResult.summary,
            runSummary: codexSessionResult.runSummary,
          });
          sendAgentChunk(res, {
            type: "message_end",
            recordId: codexSessionResult.recordId || recordId,
            status: codexSessionResult.recordStatus || codexSessionResult.status,
          });
          sendAgentChunk(res, { type: "completed" });
          return res.end();
        }
        sendAgentRuntimeDebug(res, buildAgentRuntimeDebug({
          stage: "cloudagent_fallback",
          requestBody: req.body || {},
          blueprint,
          planPayload: rewrittenBlueprintPayload || planPayload,
          executionMode,
          reason: "normalized execution mode is not a local coding-agent mode; running CloudAgent plan on the backend",
        }));
        const runPlanId = blueprintId || req.body?.planId || recordId || "local-agent";
        const runInputSettings = {
          ...(req.body?.permissionProfileId ? { permissionProfileId: req.body.permissionProfileId } : {}),
          ...(req.body?.defaultValues ? { defaultValues: req.body.defaultValues } : {}),
          ...(Array.isArray(req.body?.regions) ? { regions: req.body.regions } : {}),
          ...(req.body?.executionPreferences ? { executionPreferences: req.body.executionPreferences } : {}),
          ...(req.body?.selectedWorkloadOrStack ? { selectedWorkloadOrStack: req.body.selectedWorkloadOrStack } : {}),
          preflight: preflightResult,
        };
        sendAgentRunStatus(res, {
          req,
          recordId,
          runner: "cloudagent",
          status: "running",
          summary: `Local CloudAgent started "${title}".`,
        });
        const streamTaskStart = async ({ task, phaseIndex, taskIndex }) => {
          sendAgentTaskStatusEvent(res, {
            req,
            recordId,
            runner: "cloudagent",
            task,
            phaseIndex,
            taskIndex,
            status: "in-progress",
            output: `Running ${task?.title || task?.name || task?.id || "task"}.`,
          });
        };
        const streamTaskResult = async ({ task, logEntry, runSummary }) => {
          for (const commandOutput of Array.isArray(logEntry?.cli_command_output)
            ? logEntry.cli_command_output
            : []) {
            sendAgentTerminalOutputEvent(res, {
              req,
              recordId,
              runner: "cloudagent",
              task,
              phaseIndex: logEntry.phaseIndex,
              taskIndex: logEntry.taskIndex,
              command: commandOutput.command || commandOutput.cli_command,
              output: commandOutput.output || "",
              raw: commandOutput,
            });
          }
          sendAgentTaskStatusEvent(res, {
            req,
            recordId,
            runner: "cloudagent",
            task,
            phaseIndex: logEntry?.phaseIndex,
            taskIndex: logEntry?.taskIndex,
            status: logEntry?.status,
            output: logEntry?.task_output || logEntry?.output || "",
            runSummary,
            raw: logEntry,
          });
        };
        const cloudAgentPlanResult = await executeLocalAgentPlanWithCloudAgent({
          store,
          planId: runPlanId,
          blueprint,
          planPayload: rewrittenBlueprintPayload || planPayload,
          inputSettings: runInputSettings,
          authProfile: authProfileForRun,
          recordId,
          parentId: req.body?.parentId || null,
          title,
          onTaskStart: streamTaskStart,
          onTaskToken: ({ token, task, phaseIndex, taskIndex }) => {
            sendAgentMessageEvent(res, {
              req,
              recordId,
              runner: "cloudagent",
              task,
              phaseIndex,
              taskIndex,
              text: token,
            });
          },
          onContextEvent: ({ payload, task, phaseIndex, taskIndex }) => {
            sendNormalizedAgentRawEvents(res, { event: payload }, {
              req,
              recordId,
              runner: "cloudagent",
              task,
              phaseIndex,
              taskIndex,
            });
          },
          onTaskResult: streamTaskResult,
        });
        const result = cloudAgentPlanResult || await executeAgentPlan({
          store,
          planId: runPlanId,
          blueprint,
          planPayload: rewrittenBlueprintPayload || planPayload,
          inputSettings: runInputSettings,
          authProfile: authProfileForRun,
          recordId,
          parentId: req.body?.parentId || null,
          title,
          onTaskStart: streamTaskStart,
          onTaskResult: streamTaskResult,
        });
        console.log("[local /agent] backend CloudAgent run summary event", {
          recordId: result.recordId || recordId,
          status: result.status,
          summaryChars: String(result.summary || "").length,
          runSummarySummaryChars: String(result.runSummary?.summary || "").length,
          runSummaryFinalChars: String(result.runSummary?.finalSummary || "").length,
          generatedBy: result.runSummary?.generatedBy || null,
        });
        sendAgentRunStatus(res, {
          req,
          recordId: result.recordId || recordId,
          runner: "cloudagent",
          completed: true,
          status: result.status,
          summary: result.summary,
          runSummary: result.runSummary,
        });
        sendAgentChunk(res, {
          type: "message_end",
          recordId: result.recordId || recordId,
          status: result.status,
        });
        sendAgentChunk(res, { type: "completed" });
        console.log("[local /agent] backend CloudAgent run complete", {
          recordId: result.recordId || recordId,
          blueprintId,
          status: result.status,
        });
        return res.end();
      }
      const executionMode = getBlueprintExecutionMode(blueprint, planPayload, req.body || {});
      sendAgentRuntimeDebug(res, buildAgentRuntimeDebug({
        stage: "route_selection",
        requestBody: req.body || {},
        blueprint,
        planPayload,
        executionMode,
      }));
      if (isLocalCodingAgentExecutionMode(executionMode)) {
        const runnerLabel = codingAgentRunnerLabel(executionMode);
        const authProfileForRun = parseStoredObject(req.body?.authProfile, {});
        const existingRunForPlan = recordId ? await store.getAgentHistoryRecord(recordId) : null;
        const storedUpdatedBlueprint = parseStoredJsonValue(existingRunForPlan?.updatedBlueprint, null);
        const effectivePlanPayload = planPayload || storedUpdatedBlueprint;
        sendAgentTaskStatusEvent(res, {
          req,
          recordId,
          runner: executionMode,
          taskId: EXTERNAL_AGENT_RUN_TASK_ID,
          status: "in-progress",
          output: `Starting ${runnerLabel} session for "${title}".`,
        });
        const codexSettings = await getLocalCodexSettings(store);
        const agentSettings = getLocalCodingAgentSettings(codexSettings, executionMode);
        sendAgentRuntimeDebug(res, buildAgentRuntimeDebug({
          stage: "external_agent_settings",
          requestBody: req.body || {},
          blueprint,
          planPayload: effectivePlanPayload,
          executionMode,
          agentSettings,
        }));
        const codexTaskResult = await runLocalExternalAgentBlueprintSession({
          runner: executionMode,
          req,
          store,
          recordId,
          blueprintId: blueprintId || req.body?.planId || recordId || "local-agent",
          blueprint,
          planPayload: effectivePlanPayload,
          title,
          authProfile: authProfileForRun,
          regions: Array.isArray(req.body?.regions) ? req.body.regions : [],
          defaultValues: req.body?.defaultValues || {},
          executionPreferences: req.body?.executionPreferences || {},
          selectedWorkloadOrStack: req.body?.selectedWorkloadOrStack || null,
          onCodexEvent: (event) => {
            sendNormalizedAgentRawEvents(res, { event }, {
              req,
              recordId,
              runner: executionMode,
              task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
              phaseIndex: 0,
              taskIndex: 0,
            });
          },
          onMcpEvent: (event) => {
            sendNormalizedAgentRawEvents(res, { event }, {
              req,
              recordId,
              runner: executionMode,
              task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
              phaseIndex: 0,
              taskIndex: 0,
            });
          },
          onCodexStderr: (content) => {
            sendNormalizedAgentRawEvents(res, { type: "codex_stderr", content }, {
              req,
              recordId,
              runner: executionMode,
              task: { id: EXTERNAL_AGENT_RUN_TASK_ID },
              phaseIndex: 0,
              taskIndex: 0,
            });
          },
        });
        sendAgentTaskStatusEvent(res, {
          req,
          recordId: codexTaskResult.recordId || recordId,
          runner: executionMode,
          taskId: EXTERNAL_AGENT_RUN_TASK_ID,
          status: codexTaskResult.status,
          output: codexTaskResult.logEntry?.task_output || codexTaskResult.summary,
          runSummary: codexTaskResult.runSummary,
        });
        sendAgentRunStatus(res, {
          req,
          recordId: codexTaskResult.recordId || recordId,
          runner: executionMode,
          completed: true,
          status: codexTaskResult.recordStatus || codexTaskResult.status,
          summary: codexTaskResult.summary,
          runSummary: codexTaskResult.runSummary,
        });
        sendAgentChunk(res, {
          type: "message_end",
          recordId: codexTaskResult.recordId,
          status: codexTaskResult.recordStatus || codexTaskResult.status,
        });
        sendAgentChunk(res, { type: "completed" });
        return res.end();
      }
      if (isLocalOpenAIConfigured()) {
        const authProfileForRun = parseStoredObject(req.body?.authProfile, {});
        const existingRunForPlan = recordId ? await store.getAgentHistoryRecord(recordId) : null;
        const storedUpdatedBlueprint = parseStoredJsonValue(existingRunForPlan?.updatedBlueprint, null);
        const effectivePlanPayload = storedUpdatedBlueprint || planPayload;
        const requestTask = req.body?.task || {
          id: req.body?.task?.id || req.body?.task?.task_id || "cloudagent_task",
        };
        sendAgentTaskStatusEvent(res, {
          req,
          recordId,
          runner: "cloudagent",
          task: requestTask,
          status: "in-progress",
          output: `Running ${requestTask?.title || requestTask?.name || requestTask?.id || "task"}.`,
        });
        const llmResult = await runLocalCloudAgentBlueprintTask({
          store,
          recordId,
          blueprintId: blueprintId || req.body?.planId || recordId || "local-agent",
          blueprint,
          planPayload: effectivePlanPayload,
          title,
          taskId: req.body?.task?.id || req.body?.task?.task_id || null,
          authProfile: authProfileForRun,
          regions: Array.isArray(req.body?.regions) ? req.body.regions : [],
          defaultValues: req.body?.defaultValues || {},
          executionPreferences: req.body?.executionPreferences || {},
          selectedWorkloadOrStack: req.body?.selectedWorkloadOrStack || null,
          onToken: (token) => {
            sendAgentMessageEvent(res, {
              req,
              recordId,
              runner: "cloudagent",
              task: requestTask,
              text: token,
            });
          },
        });
        if (llmResult) {
          for (const commandOutput of Array.isArray(llmResult.cliOutputs)
            ? llmResult.cliOutputs
            : []) {
            sendAgentTerminalOutputEvent(res, {
              req,
              recordId: llmResult.recordId || recordId,
              runner: "cloudagent",
              task: requestTask,
              command: commandOutput.command || commandOutput.cli_command,
              output: commandOutput.output || "",
              raw: commandOutput,
            });
          }
          const failedCommands = (Array.isArray(llmResult.cliOutputs) ? llmResult.cliOutputs : [])
            .filter((commandOutput) => commandOutput.statusCode !== 200)
            .map((commandOutput) => ({
              taskId: llmResult.logEntry?.taskId || null,
              command: commandOutput.command || commandOutput.cli_command || null,
              statusCode: commandOutput.statusCode || 400,
              error: String(commandOutput.output || "").split(/\r?\n/).slice(0, 3).join(" "),
            }));
          if (failedCommands.length > 0) {
            console.warn("[local /agent] command failures", failedCommands);
          }
          sendAgentTaskStatusEvent(res, {
            req,
            recordId: llmResult.recordId || recordId,
            runner: "cloudagent",
            task: requestTask,
            taskId: llmResult.logEntry?.taskId || req.body?.task?.id || req.body?.task?.task_id,
            phaseIndex: llmResult.logEntry?.phaseIndex,
            taskIndex: llmResult.logEntry?.taskIndex,
            status: llmResult.status,
            output: llmResult.logEntry?.task_output || llmResult.summary,
            runSummary: llmResult.runSummary,
            raw: llmResult.logEntry,
          });
          sendAgentRunStatus(res, {
            req,
            recordId: llmResult.recordId || recordId,
            runner: "cloudagent",
            completed: true,
            status: llmResult.recordStatus || llmResult.status,
            summary: llmResult.summary,
            runSummary: llmResult.runSummary,
          });
          sendAgentChunk(res, {
            type: "message_end",
            recordId: llmResult.recordId,
            status: llmResult.recordStatus || llmResult.status,
          });
          sendAgentChunk(res, { type: "completed" });
          console.log("[local /agent] llm run complete", {
            recordId: llmResult.recordId,
            blueprintId,
            taskId: llmResult.logEntry?.taskId || req.body?.task?.id || req.body?.task?.task_id || null,
            status: llmResult.status,
          });
          return res.end();
        }
      }
      const result = await executeAgentPlan({
        store,
        planId: blueprintId || req.body?.planId || recordId || "local-agent",
        blueprint,
        planPayload,
        inputSettings: {
          targetTaskId: req.body?.task?.id || req.body?.task?.task_id || null,
          task: req.body?.task || null,
          ...(req.body?.permissionProfileId ? { permissionProfileId: req.body.permissionProfileId } : {}),
          ...(req.body?.defaultValues ? { defaultValues: req.body.defaultValues } : {}),
          ...(Array.isArray(req.body?.regions) ? { regions: req.body.regions } : {}),
          ...(req.body?.executionPreferences ? { executionPreferences: req.body.executionPreferences } : {}),
          ...(req.body?.selectedWorkloadOrStack ? { selectedWorkloadOrStack: req.body.selectedWorkloadOrStack } : {}),
        },
        authProfile: req.body?.authProfile || null,
        recordId,
        title,
        onTaskStart: async ({ task, phaseIndex, taskIndex }) => {
          sendAgentTaskStatusEvent(res, {
            req,
            recordId,
            runner: "cloudagent",
            task,
            phaseIndex,
            taskIndex,
            status: "in-progress",
            output: `Running ${task?.title || task?.name || task?.id || "task"}.`,
          });
        },
        onTaskResult: async ({ task, logEntry, runSummary }) => {
          for (const commandOutput of Array.isArray(logEntry.cli_command_output)
            ? logEntry.cli_command_output
            : []) {
            sendAgentTerminalOutputEvent(res, {
              req,
              recordId,
              runner: "cloudagent",
              task,
              phaseIndex: logEntry.phaseIndex,
              taskIndex: logEntry.taskIndex,
              command: commandOutput.command || commandOutput.cli_command,
              output: commandOutput.output || "",
              raw: commandOutput,
            });
          }
          sendAgentTaskStatusEvent(res, {
            req,
            recordId,
            runner: "cloudagent",
            task,
            phaseIndex: logEntry.phaseIndex,
            taskIndex: logEntry.taskIndex,
            status: logEntry.status,
            output: logEntry.task_output,
            runSummary,
            raw: logEntry,
          });
        },
      });
      const failedCommands = (Array.isArray(result.logs) ? result.logs : [])
        .flatMap((entry) =>
          (Array.isArray(entry.cli_command_output) ? entry.cli_command_output : [])
            .filter((commandOutput) => commandOutput.statusCode !== 200)
            .map((commandOutput) => ({
              taskId: entry.taskId || null,
              command: commandOutput.command || commandOutput.cli_command || null,
              statusCode: commandOutput.statusCode || 400,
              error: String(commandOutput.output || "").split(/\r?\n/).slice(0, 3).join(" "),
            }))
        );
      if (failedCommands.length > 0) {
        console.warn("[local /agent] command failures", failedCommands);
      }
      sendAgentRunStatus(res, {
        req,
        recordId: result.recordId || recordId,
        runner: "cloudagent",
        completed: true,
        status: result.status,
        summary: result.summary,
        runSummary: result.runSummary,
      });
      sendAgentChunk(res, {
        type: "message_end",
        recordId: result.recordId,
        status: result.status,
      });
      sendAgentChunk(res, { type: "completed" });
      console.log("[local /agent] run complete", {
        recordId: result.recordId,
        blueprintId,
        taskId: req.body?.task?.id || req.body?.task?.task_id || null,
        status: result.status,
      });
      res.end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
