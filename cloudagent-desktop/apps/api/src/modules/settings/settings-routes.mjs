import fs from "node:fs/promises";
import { Router } from "express";
import { DEFAULT_AUTH } from "@cloudagent/storage";
import { publicLocalOpenAISettings, updateLocalOpenAISettings } from "../../platform/openai.mjs";
import { listAwsProfiles } from "../cloud-setup/aws-discovery.mjs";
import { PermissionProfilePatchSchema, parseBody } from "../../lib/http.mjs";
import { buildLocalPreferencesStatus, getLocalCodexSettings, getLocalIacToolSettings, publicLocalCodexSettings, updateLocalCodexSettings, updateLocalIacToolSettings } from "./settings-service.mjs";

export function createSettingsRouter({ store }) {
  if (!store) throw new Error("createSettingsRouter requires a store");
  const router = Router();

  router.get("/bootstrap", async (_req, res, next) => {
    try {
      const [settings, profiles, workloads, workFlowDefs, workflowHistory, agentHistory] = await Promise.all([
        store.getSettings(),
        store.listPermissionProfiles(),
        store.listWorkloads(),
        store.listWorkflowDefinitions(),
        store.listWorkflowRuns(),
        store.listAgentHistory(),
      ]);
      res.json({
        userId: DEFAULT_AUTH.userId,
        email: settings?.email || "local@cloudagent",
        name: settings?.name || "Local User",
        settings: settings?.settings || "{}",
        agentPermissionProfiles: profiles,
        workloads,
        workFlowDefs,
        workflowHistory,
        agentHistory,
        reportHistory: [],
        recommendations: {
          recommendations: [],
          exceptions: [],
          history: [],
          loadingRecommendations: false,
          loadingExceptions: false,
          loadingHistory: false,
        },
        agentCredits: {
          adhocCredits: 0,
          monthlyBaseCredits: Number.MAX_SAFE_INTEGER,
        },
        subscription: {
          tier: "local",
          status: "local",
        },
      });
    } catch (error) {
      next(error);
    }
  });


  router.patch("/settings", async (req, res, next) => {
    const body = parseBody(PermissionProfilePatchSchema, req, res);
    if (!body) return;
    try {
      const nextSettingsValue =
        body.settings !== undefined && typeof body.settings !== "string"
          ? JSON.stringify(body.settings || {})
          : body.settings;
      const settings = await store.updateSettings({
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.settings !== undefined ? { settings: nextSettingsValue } : {}),
      });
      res.json({ ok: true, userId: DEFAULT_AUTH.userId, settings: settings.settings });
    } catch (error) {
      next(error);
    }
  });


  router.get("/codex/settings", async (_req, res, next) => {
    try {
      const settings = await getLocalCodexSettings(store);
      await fs.mkdir(settings.workspaceDir, { recursive: true });
      await fs.mkdir(settings.claude.workspaceDir, { recursive: true });
      await fs.mkdir(settings.cursor.workspaceDir, { recursive: true });
      res.json({ ok: true, settings: publicLocalCodexSettings(settings) });
    } catch (error) {
      next(error);
    }
  });


  router.patch("/codex/settings", async (req, res, next) => {
    const body = parseBody(PermissionProfilePatchSchema, req, res);
    if (!body) return;
    try {
      const settings = await updateLocalCodexSettings(store, {
        enabled: body.enabled,
        binary: body.binary,
        workspaceDir: body.workspaceDir,
        claude: body.claude,
        cursor: body.cursor,
      });
      res.json({ ok: true, settings: publicLocalCodexSettings(settings) });
    } catch (error) {
      next(error);
    }
  });


  router.get("/openai/settings", async (_req, res, next) => {
    try {
      res.json({ ok: true, settings: publicLocalOpenAISettings() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/iac-tools/settings", async (_req, res, next) => {
    try {
      res.json({ ok: true, settings: await getLocalIacToolSettings(store) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/iac-tools/settings", async (req, res, next) => {
    const body = parseBody(PermissionProfilePatchSchema, req, res);
    if (!body) return;
    try {
      res.json({ ok: true, settings: await updateLocalIacToolSettings(store, body) });
    } catch (error) {
      next(error);
    }
  });


  router.patch("/openai/settings", async (req, res, next) => {
    const body = parseBody(PermissionProfilePatchSchema, req, res);
    if (!body) return;
    try {
      const patch = {
        ...(Object.prototype.hasOwnProperty.call(body, "apiKey") ? { apiKey: body.apiKey } : {}),
        ...(Object.prototype.hasOwnProperty.call(body, "model") ? { model: body.model } : {}),
        ...(Object.prototype.hasOwnProperty.call(body, "clearApiKey")
          ? { clearApiKey: body.clearApiKey }
          : {}),
      };
      const settings = await updateLocalOpenAISettings(store, patch);
      res.json({ ok: true, settings });
    } catch (error) {
      next(error);
    }
  });


  router.get("/preferences/status", async (req, res, next) => {
    try {
      res.json(await buildLocalPreferencesStatus({ store, app: req.app }));
    } catch (error) {
      next(error);
    }
  });


  router.get("/aws/profiles", async (_req, res, next) => {
    try {
      const profiles = await listAwsProfiles();
      res.json({ ok: true, profiles });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
