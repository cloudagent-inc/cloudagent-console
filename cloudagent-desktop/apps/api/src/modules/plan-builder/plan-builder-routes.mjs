import { Router } from "express";
import { localAuth } from "../../lib/http.mjs";
import { localPlanBuilderHistories, localPlanBuilderSessions, runLocalPlanBuilderChatAction, runLocalPlanBuilderGenerate, savePlanBuilderBlueprint } from "./plan-builder-service.mjs";

export function createPlanBuilderRouter({ store }) {
  if (!store) throw new Error("createPlanBuilderRouter requires a store");
  const router = Router();
  router.use(localAuth);

  router.post("/api/plan-builder/save", async (req, res, next) => {
    try {
      res.json(await savePlanBuilderBlueprint(store, req.body || {}));
    } catch (error) {
      next(error);
    }
  });


  router.post("/api/plan-builder/generate", async (req, res, next) => {
    try {
      const result = await runLocalPlanBuilderGenerate(store, req.body || {});
      if (result?.ok === false) return res.status(400).json(result);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });


  router.post("/api/plan-builder/chat", async (req, res, next) => {
    try {
      const result = await runLocalPlanBuilderChatAction(store, req.body || {});
      if (result?.ok === false) return res.status(400).json(result);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });


  router.post("/api/plan-builder/reset", (req, res) => {
    const sessionId = String(req.body?.sessionId || "").trim();
    if (sessionId) {
      localPlanBuilderSessions.delete(sessionId);
      localPlanBuilderHistories.delete(sessionId);
    }
    res.json({ ok: true, cleared: Boolean(sessionId) });
  });

  return router;
}
