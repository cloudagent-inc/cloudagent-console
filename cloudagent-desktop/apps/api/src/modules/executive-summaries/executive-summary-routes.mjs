import { Router } from "express";
import { localAuth, parseBody } from "../../lib/http.mjs";
import { ExecutiveSummaryBodySchema, generateLocalExecutiveSummary } from "./executive-summary-service.mjs";

export function createExecutiveSummaryRouter({ store }) {
  if (!store) throw new Error("createExecutiveSummaryRouter requires a store");
  const router = Router();
  router.use(localAuth);

  router.post("/executive-summary", async (req, res, next) => {
    const body = parseBody(ExecutiveSummaryBodySchema, req, res);
    if (!body) return;
    try {
      const result = await generateLocalExecutiveSummary({ store, body });
      res.status(result.status).json(result.payload);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
