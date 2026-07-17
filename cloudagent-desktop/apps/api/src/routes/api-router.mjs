import { Router } from "express";
import { JsonFileStore } from "@cloudagent/storage";
import { localAuth } from "../lib/http.mjs";
import { createSettingsRouter } from "../modules/settings/settings-routes.mjs";
import { createPermissionProfileRouter } from "../modules/permission-profiles/permission-profile-routes.mjs";
import { createWorkloadRouter } from "../modules/workloads/workload-routes.mjs";
import { createGithubRouter } from "../modules/github/github-routes.mjs";
import { createWorkflowRouter } from "../modules/workflows/workflow-routes.mjs";
import { createSkillRouter } from "../modules/skills/skill-routes.mjs";
import { createChatRouter } from "../modules/chat/chat-routes.mjs";
import { createAgentRunRouter } from "../modules/agent-runs/agent-run-routes.mjs";

export function createApiRouter({ store }) {
  if (!store) throw new Error("createApiRouter requires a store");
  const router = Router();
  router.use(localAuth);
  router.use(createSettingsRouter({ store }));
  router.use(createPermissionProfileRouter({ store }));
  router.use(createWorkloadRouter({ store }));
  router.use(createGithubRouter({ store }));
  router.use(createWorkflowRouter({ store }));
  router.use(createSkillRouter({ store }));
  router.use(createChatRouter({ store }));
  router.use(createAgentRunRouter({ store }));
  return router;
}

export async function createLocalStore(options = {}) {
  return new JsonFileStore({ dataDir: options.localDataDir }).init();
}

export function createUnavailableMiddleware() {
  const localApiPrefixes = [
    "/api",
    "/agent",
    "/ops",
    "/diagrams-app-mcp",
    "/recommendations",
    "/diagrams",
    "/v1",
    "/executive-summary",
  ];

  return function localUnavailable(req, res, next) {
    if (localApiPrefixes.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
      return res.status(501).json({
        ok: false,
        error: "This feature is not available in local mode.",
      });
    }
    return next();
  };
}
