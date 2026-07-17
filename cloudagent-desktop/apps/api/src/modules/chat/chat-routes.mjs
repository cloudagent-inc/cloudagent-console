import { Router } from "express";
import { codingAgentRunnerLabel } from "@cloudagent/agent-runtime";
import { safeTrim } from "@cloudagent/platform/utils";
import { generateChatReply, isLocalOpenAIConfigured } from "../../platform/openai.mjs";
import { localAuth } from "../../lib/http.mjs";
import { isLocalCodingAgentExecutionMode, runLocalCloudAgentChat } from "../agent-runs/agent-run-service.mjs";
import { buildLocalCommandCenterState, normalizeCommandCenterAgentRunner, runLocalExternalAgentCommandCenterChat, sendSse } from "../command-center/command-center-service.mjs";

export function createChatRouter({ store }) {
  if (!store) throw new Error("createChatRouter requires a store");
  const router = Router();

  router.get("/chat-records", async (req, res, next) => {
    try {
      const limit = Math.max(1, Math.min(200, Number(req.query?.limit || 20) || 20));
      const records = (await store.listChatRecords()).slice(0, limit);
      res.json({ ok: true, chatRecords: records, items: records });
    } catch (error) {
      next(error);
    }
  });


  router.get("/chat-records/:recordId", async (req, res, next) => {
    try {
      const record = await store.getChatRecord(req.params.recordId);
      if (!record) return res.status(404).json({ ok: false, error: "Chat record not found" });
      res.json({ ok: true, chatRecord: record, record, item: record });
    } catch (error) {
      next(error);
    }
  });


  router.post("/chat-records", async (req, res, next) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      if (!body.sessionId) return res.status(400).json({ ok: false, error: "sessionId is required" });
      const record = await store.upsertChatRecord(body);
      res.json({ ok: true, chatRecord: record, record, item: record });
    } catch (error) {
      next(error);
    }
  });


  router.post("/chat-records/:recordId/messages", async (req, res, next) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const record = await store.appendChatMessages(req.params.recordId, body.messages || [], {
        metadata: body.metadata,
      });
      if (!record) return res.status(404).json({ ok: false, error: "Chat record not found" });
      res.json({ ok: true, chatRecord: record, record, item: record });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function createChatRootRouter({ store }) {
  if (!store) throw new Error("createChatRootRouter requires a store");
  const router = Router();
  router.use(localAuth);

  const sendCommandCenterContextEvent = (res, payload) => {
    if (!payload) return;
    if (payload.type === "terminal_output") {
      sendSse(res, "terminal", payload);
      return;
    }
    sendSse(res, payload.status === "running" ? "tool_call" : "tool_result", payload);
  };

  router.post("/v1/chat/send", async (req, res, next) => {
    try {
      const state = await buildLocalCommandCenterState({ store, chatId: req.body?.chatId });
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.flushHeaders?.();

      let agentResult = null;
      const requestedRunner = normalizeCommandCenterAgentRunner(
        req.body?.agentRunner || req.body?.runner || req.body?.executionMode || "cloudagent"
      );
      if (isLocalCodingAgentExecutionMode(requestedRunner)) {
        agentResult = await runLocalExternalAgentCommandCenterChat({
          req,
          store,
          runner: requestedRunner,
          chatId: req.body?.chatId,
          message: req.body?.message || "",
          externalAgentSession: req.body?.externalAgentSession || null,
          onToken: (token) => sendSse(res, "token", { token }),
          onContextEvent: (payload) => sendCommandCenterContextEvent(res, payload),
          onTerminalEvent: (payload) => sendSse(res, "terminal", payload),
        }).catch((error) => {
          console.warn("[local external Command Center] chat failed", {
            runner: requestedRunner,
            message: error?.message || String(error),
          });
          return {
            text: error?.message || `${codingAgentRunnerLabel(requestedRunner)} failed to process the message.`,
            responseId: null,
            toolExecutions: [],
            contextEvents: [],
            status: "failed",
            externalAgent: {
              runner: requestedRunner,
              runnerLabel: codingAgentRunnerLabel(requestedRunner),
              chatId: safeTrim(req.body?.chatId) || null,
              status: "failed",
              updatedAt: new Date().toISOString(),
            },
          };
        });
      } else if (isLocalOpenAIConfigured()) {
        agentResult = await runLocalCloudAgentChat({
          store,
          message: req.body?.message || "",
          previousResponseId: req.body?.previousResponseId || null,
          cliSessionScopeId: `command-center-${safeTrim(req.body?.chatId) || "local-command-center"}`,
          onToken: (token) => sendSse(res, "token", { token }),
          onContextEvent: (payload) => sendCommandCenterContextEvent(res, payload),
        }).catch((error) => {
          console.warn("[local CloudAgent] tool-backed chat failed", error?.message || error);
          return null;
        });
      }

      let text = agentResult?.text || "";
      if (!text) {
        state.store = store;
        const llmText = await generateChatReply({
          message: req.body?.message || "",
          state,
        }).catch((error) => {
          console.warn("[local chat] OpenAI generation failed", error?.message || error);
          return null;
        });
        delete state.store;
        text = llmText || [
          "Local CloudAgent is running against files on this machine.",
          `I can see ${state.limits.environments.count} environment(s) and ${state.limits.workloads.count} workload(s).`,
          isLocalOpenAIConfigured()
            ? "OpenAI is configured, but the model call failed. Check the backend terminal for details."
            : "Set an OpenAI API key in Preferences, or set OPENAI_TOKEN or OPENAI_API_KEY, to enable model-backed local chat.",
        ].join(" ");
        sendSse(res, "token", { token: text });
      }

      sendSse(res, "final", {
        assistantMessage: {
          id: `local-message-${Date.now()}`,
          text,
          blocks: [],
          tools: [],
          toolExecutions: agentResult?.toolExecutions || [],
          contextEvents: agentResult?.contextEvents || [],
        },
        responseId: agentResult?.responseId || (isLocalOpenAIConfigured() ? `local-openai-${Date.now()}` : null),
        externalAgent: agentResult?.externalAgent || null,
        ...state,
      });
      sendSse(res, "done", { ok: true });
      res.end();
    } catch (error) {
      next(error);
    }
  });


  router.post("/api/chat", async (req, res) => {
    const state = await buildLocalCommandCenterState({ store, chatId: req.body?.sessionId });
    const agentResult = isLocalOpenAIConfigured()
      ? await runLocalCloudAgentChat({
          store,
          message: req.body?.message || "",
          previousResponseId: req.body?.previousResponseId || null,
          cliSessionScopeId: `command-center-${safeTrim(req.body?.sessionId) || "local-command-center"}`,
        }).catch((error) => {
          console.warn("[local /api/chat] tool-backed chat failed", error?.message || error);
          return null;
        })
      : null;
    let llmText = agentResult?.text || "";
    if (!llmText) {
      state.store = store;
      llmText = await generateChatReply({
        message: req.body?.message || "",
        state,
      }).catch((error) => {
        console.warn("[local /api/chat] OpenAI generation failed", error?.message || error);
        return null;
      });
      delete state.store;
    }
    res.json({
      message:
        llmText ||
        `Local CloudAgent is available. ${state.limits.environments.count} environment(s), ${state.limits.workloads.count} workload(s). Set an OpenAI API key in Preferences, or set OPENAI_TOKEN or OPENAI_API_KEY, to enable model-backed local chat.`,
      responseId: agentResult?.responseId || (llmText ? `local-openai-${Date.now()}` : null),
    });
  });

  return router;
}
