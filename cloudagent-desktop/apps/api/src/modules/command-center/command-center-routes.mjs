import { Router } from "express";
import { generateLocalCommandCenterTitle, isLocalOpenAIConfigured } from "../../platform/openai.mjs";
import { localAuth } from "../../lib/http.mjs";
import { buildLocalCommandCenterState } from "./command-center-service.mjs";

export function createCommandCenterRouter({ store }) {
  if (!store) throw new Error("createCommandCenterRouter requires a store");
  const router = Router();
  router.use(localAuth);

  router.get("/v1/command-center/bootstrap", async (req, res, next) => {
    try {
      res.json(await buildLocalCommandCenterState({ store, chatId: req.query.chatId }));
    } catch (error) {
      next(error);
    }
  });


  router.post("/v1/command-center/bootstrap", async (req, res, next) => {
    try {
      res.json(await buildLocalCommandCenterState({ store, chatId: req.body?.chatId }));
    } catch (error) {
      next(error);
    }
  });


  router.get("/v1/command-center/state", async (req, res, next) => {
    try {
      res.json(await buildLocalCommandCenterState({ store, chatId: req.query.chatId }));
    } catch (error) {
      next(error);
    }
  });


  router.post("/v1/command-center/title", async (req, res, next) => {
    try {
      if (!isLocalOpenAIConfigured()) {
        return res.json({
          ok: true,
          title: null,
          reason: "local_openai_not_configured",
        });
      }
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const title = await generateLocalCommandCenterTitle({
        messages: Array.isArray(body.messages) ? body.messages : [],
        currentTitle: body.currentTitle || "",
        milestone: body.milestone || null,
        agentRunner: body.agentRunner || "cloudagent",
      });
      res.json({ ok: true, title: title || null });
    } catch (error) {
      next(error);
    }
  });


  router.post("/v1/command-center/intent", async (req, res, next) => {
    try {
      const state = await buildLocalCommandCenterState({ store, chatId: req.body?.chatId });
      res.json({
        ...state,
        assistantMessage: {
          id: `local-intent-${Date.now()}`,
          text: "This action opens the relevant local dashboard area. Advanced CloudAgent tool execution is not available in local mode yet.",
          blocks: [],
          tools: [],
          toolExecutions: [],
          contextEvents: [],
        },
        responseId: null,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
