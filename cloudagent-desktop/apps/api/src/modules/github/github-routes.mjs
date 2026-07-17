import { Router } from "express";

import { createGithubService } from "./github-service.mjs";

export function createGithubRouter({ store, service = null }) {
  if (!store) throw new Error("createGithubRouter requires a store");
  const githubService = service || createGithubService({ store });
  const router = Router();

  router.get("/github/governance/effective", async (req, res, next) => {
    try {
      const repoFullName = String(req.query.repoFullName || "").trim();
      const workloadId = String(req.query.workloadId || "").trim() || null;
      if (!repoFullName) {
        return res.status(400).json({ ok: false, error: "repoFullName is required." });
      }
      const result = await githubService.getEffectiveGovernance({ repoFullName, workloadId });
      if (result.ok === false) {
        return res.status(result.statusCode || 400).json(result);
      }
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/github/branch-protection/verify", async (req, res, next) => {
    try {
      const repoFullName = String(req.body?.repoFullName || "").trim();
      const workloadId = String(req.body?.workloadId || "").trim() || null;
      if (!repoFullName) {
        return res.status(400).json({ ok: false, error: "repoFullName is required." });
      }
      const result = await githubService.verifyBranchProtection({ repoFullName, workloadId });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/github/branch-protection/status", async (req, res, next) => {
    try {
      const repoFullName = String(req.query.repoFullName || "").trim();
      if (!repoFullName) {
        return res.status(400).json({ ok: false, error: "repoFullName is required." });
      }
      const result = githubService.getBranchProtectionStatus({ repoFullName });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
