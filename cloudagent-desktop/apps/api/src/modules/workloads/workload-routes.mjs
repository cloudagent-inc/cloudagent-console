import { Router } from "express";
import { WorkloadCreateSchema, WorkloadPatchSchema, parseBody } from "../../lib/http.mjs";

export function createWorkloadRouter({ store }) {
  if (!store) throw new Error("createWorkloadRouter requires a store");
  const router = Router();

  router.get("/workloads", async (_req, res, next) => {
    try {
      const workloads = await store.listWorkloads();
      res.json({ ok: true, workloads, items: workloads });
    } catch (error) {
      next(error);
    }
  });


  router.post("/workloads", async (req, res, next) => {
    const body = parseBody(WorkloadCreateSchema, req, res);
    if (!body) return;
    try {
      const workload = await store.createWorkload(body);
      res.status(201).json({ ok: true, workload, item: workload });
    } catch (error) {
      next(error);
    }
  });


  router.get("/workloads/:workloadId", async (req, res, next) => {
    try {
      const workload = await store.getWorkload(req.params.workloadId);
      if (!workload) return res.status(404).json({ ok: false, error: "Workload not found" });
      res.json({ ok: true, workload, item: workload });
    } catch (error) {
      next(error);
    }
  });


  router.patch("/workloads/:workloadId", async (req, res, next) => {
    const body = parseBody(WorkloadPatchSchema, req, res);
    if (!body) return;
    try {
      const workload = await store.updateWorkload(req.params.workloadId, body);
      if (!workload) return res.status(404).json({ ok: false, error: "Workload not found" });
      res.json({ ok: true, workload, item: workload });
    } catch (error) {
      next(error);
    }
  });


  router.delete("/workloads/:workloadId", async (req, res, next) => {
    try {
      const deleted = await store.deleteWorkload(req.params.workloadId);
      res.status(deleted ? 200 : 404).json({
        ok: deleted,
        deleted,
        workloadId: req.params.workloadId,
        ...(deleted ? {} : { error: "Workload not found" }),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
