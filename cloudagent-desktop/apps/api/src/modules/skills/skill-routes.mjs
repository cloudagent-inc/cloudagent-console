import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { parseStoredJsonValue } from "@cloudagent/storage";
import { BlueprintCreateSchema, BlueprintPatchSchema, PermissionProfilePatchSchema, localAuth, paginateLocalItems, parseBody, sortLocalItems } from "../../lib/http.mjs";
import { ensureCodexSkillForBlueprint, listEditableSkillFiles, resolveSkillFilePath } from "./skill-service.mjs";

export function createSkillRouter({ store }) {
  if (!store) throw new Error("createSkillRouter requires a store");
  const router = Router();

  router.get("/codex/skills/:recordId/skill", async (req, res, next) => {
    try {
      const result = await ensureCodexSkillForBlueprint(store, req.params.recordId);
      if (!result) return res.status(404).json({ ok: false, error: "Skill not found" });
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  });


  router.put("/codex/skills/:recordId/skill/files", async (req, res, next) => {
    const body = parseBody(PermissionProfilePatchSchema, req, res);
    if (!body) return;
    try {
      const result = await ensureCodexSkillForBlueprint(store, req.params.recordId);
      if (!result) return res.status(404).json({ ok: false, error: "Skill not found" });
      const { fullPath, relativePath } = resolveSkillFilePath(result.skillDir, body.relativePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, String(body.content ?? ""));
      const files = await listEditableSkillFiles(result.skillDir);
      res.json({ ok: true, skillDir: result.skillDir, relativePath, files });
    } catch (error) {
      next(error);
    }
  });


  router.get("/skills", async (req, res, next) => {
    try {
      const items = sortLocalItems(
        await store.listSkills(),
        req.query.sortBy || "updatedAt",
        req.query.sortOrder || "desc"
      );
      const page = paginateLocalItems(items, req.query);
      res.json({
        ok: true,
        skills: page.items,
        blueprints: page.items,
        items: page.items,
        count: page.count,
        nextToken: page.nextToken,
        nextCursor: page.nextCursor,
        summary: {
          total: items.length,
          custom: items.length,
          library: 0,
          agents: items.length,
          reports: 0,
        },
      });
    } catch (error) {
      next(error);
    }
  });


  router.post("/skills", async (req, res, next) => {
    const body = parseBody(BlueprintCreateSchema, req, res);
    if (!body) return;
    try {
      const skill = await store.createSkill(body);
      res.status(201).json({ ok: true, skill, blueprint: skill, item: skill });
    } catch (error) {
      next(error);
    }
  });


  router.get("/skills/:recordId", async (req, res, next) => {
    try {
      const skill = await store.getSkill(req.params.recordId);
      if (!skill) return res.status(404).json({ ok: false, error: "Skill not found" });
      res.json({ ok: true, skill, blueprint: skill, item: skill });
    } catch (error) {
      next(error);
    }
  });


  router.patch("/skills/:recordId", async (req, res, next) => {
    const body = parseBody(BlueprintPatchSchema, req, res);
    if (!body) return;
    try {
      const skill = await store.updateSkill(req.params.recordId, body);
      if (!skill) return res.status(404).json({ ok: false, error: "Skill not found" });
      res.json({ ok: true, skill, blueprint: skill, item: skill });
    } catch (error) {
      next(error);
    }
  });


  router.delete("/skills/:recordId", async (req, res, next) => {
    try {
      const deleted = await store.deleteSkill(req.params.recordId);
      res.status(deleted ? 200 : 404).json({
        ok: deleted,
        deleted,
        recordId: req.params.recordId,
        ...(deleted ? {} : { error: "Skill not found" }),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function createSkillRootRouter({ store }) {
  if (!store) throw new Error("createSkillRootRouter requires a store");
  const router = Router();
  router.use(localAuth);

  router.post(["/agent/skill-evaluation", "/agent/blueprint-evaluation"], (_req, res) => {
    res.json({
      method_valid: true,
      message: {
        summary: "Local mode accepts this skill configuration method for tracking, but full execution validation is not implemented yet.",
        details: [],
      },
      raw: null,
      runtime: "local",
    });
  });


  router.post(["/agent/skill-rewrite", "/agent/blueprint-rewrite"], async (req, res, next) => {
    try {
      const blueprintId = req.body?.blueprintId || req.body?.recordId || null;
      const blueprint = blueprintId ? await store.getSkill(blueprintId) : null;
      res.json({
        ok: true,
        runtime: "local",
        blueprintId,
        configurationMode: req.body?.configurationMode || "cli",
        plan: blueprint ? parseStoredJsonValue(blueprint.plan, {}) : null,
        message: "Local mode returned the saved skill without hosted rewrite.",
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
