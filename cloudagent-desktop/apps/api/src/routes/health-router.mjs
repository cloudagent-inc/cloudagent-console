// server/routes/health-router.mjs
import { Router } from "express";
const router = Router();

router.get("/healthz", (_req, res) => res.json({ ok: true }));

// ChatGPT Apps store domain verification challenge.
// Serve the raw token at: /.well-known/openai-apps-challenge
router.get("/.well-known/openai-apps-challenge", (_req, res) => {
  const token =
    process.env.OPENAI_APPS_CHALLENGE_TOKEN ||
    "Cz4xV0SUTmsna640gt_st194lIwRfGwy7LqDBFL803I";
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.status(200).send(token);
});
export default router;
