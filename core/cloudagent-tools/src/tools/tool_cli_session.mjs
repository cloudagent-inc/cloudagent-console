import { tool } from "@openai/agents";
import { z } from "zod";

import { getDefaultLocalCliSessionManager } from "../cli-session/local-cli-session-manager.mjs";
import { logStart, logEnd } from "../util/logging.mjs";
import { getUserId } from "../util/run-context.mjs";

function resolveAccountId(authProfile = {}, fallback = null) {
  return fallback || authProfile?.awsAccountId || authProfile?.accountId || null;
}

async function resolveAuthProfile({ accountsService, runContext, accountId = null, permissionProfileId = null }) {
  if (!accountsService?.getPermissionProfileDefaults || !accountsService?.getAccountDefaults) {
    throw new Error("accountsService.getPermissionProfileDefaults and accountsService.getAccountDefaults are required");
  }
  const userId = getUserId(runContext);
  const defaults = permissionProfileId
    ? await accountsService.getPermissionProfileDefaults(userId, permissionProfileId)
    : await accountsService.getAccountDefaults(userId, accountId);
  const authProfile = defaults?.authProfile || null;
  if (!authProfile) {
    throw new Error("No local cloud credentials were found for the requested permissionProfileId/accountId.");
  }
  return authProfile;
}

function emitExecutionEvent(runContext, output) {
  const recordContextEvent = runContext?.context?.recordContextEvent;
  if (typeof recordContextEvent !== "function") return;
  recordContextEvent({
    type: "tool_execution",
    sourceTool: "cli_session_execute",
    input: output?.input || {},
    output,
  });
}

export function createCliSessionStartTool({ accountsService, manager = getDefaultLocalCliSessionManager() } = {}) {
  return tool({
    name: "cli_session_start",
    description:
      "Start a local CloudAgent CLI shell session bound to the selected environment. If account/profile/region are omitted, CloudAgent uses the current run context. Use before cli_session_execute when you need explicit session metadata.",
    parameters: z.object({
      accountId: z.string().nullable().optional(),
      permissionProfileId: z.string().nullable().optional(),
      region: z.string().nullable().optional(),
      mode: z.enum(["workspace_shell", "readonly_aws"]).nullable().optional(),
      recordId: z.string().nullable().optional(),
      sessionId: z.string().nullable().optional(),
      ttlSeconds: z.number().int().min(60).max(24 * 60 * 60).nullable().optional(),
    }).strict(),
    async execute({ accountId = null, permissionProfileId = null, region = null, mode = "workspace_shell", recordId = null, ttlSeconds = null }, runContext) {
      logStart("cli_session_start", { accountId, permissionProfileId, region, mode, recordId });
      try {
        const authProfile = await resolveAuthProfile({ accountsService, runContext, accountId, permissionProfileId });
        const session = await manager.createSession({
          authProfile,
          accountId: resolveAccountId(authProfile, accountId),
          permissionProfileId,
          region,
          mode: mode || "workspace_shell",
          recordId,
          ttlSeconds: ttlSeconds || undefined,
        });
        const out = { ok: true, session };
        logEnd("cli_session_start", out);
        return out;
      } catch (error) {
        const out = { ok: false, error: error?.message || String(error) };
        logEnd("cli_session_start", out);
        return out;
      }
    },
  });
}

export function createCliSessionExecuteTool({ accountsService, manager = getDefaultLocalCliSessionManager() } = {}) {
  return tool({
    name: "cli_session_execute",
    description:
      "Execute an arbitrary shell command in a local CloudAgent CLI session. Commands run in the session working directory with selected environment credentials. If no session ID or auth identifiers are supplied, CloudAgent uses the current run context.",
    parameters: z.object({
      cliSessionId: z.string().nullable().optional(),
      sessionId: z.string().nullable().optional(),
      command: z.string().min(1),
      accountId: z.string().nullable().optional(),
      permissionProfileId: z.string().nullable().optional(),
      region: z.string().nullable().optional(),
      mode: z.enum(["workspace_shell", "readonly_aws"]).nullable().optional(),
      recordId: z.string().nullable().optional(),
      timeoutMs: z.number().int().min(1000).max(30 * 60 * 1000).nullable().optional(),
      ttlSeconds: z.number().int().min(60).max(24 * 60 * 60).nullable().optional(),
    }).strict(),
    async execute(args, runContext) {
      const {
        cliSessionId = null,
        sessionId = null,
        command,
        accountId = null,
        permissionProfileId = null,
        region = null,
        mode = "workspace_shell",
        recordId = null,
        timeoutMs = null,
        ttlSeconds = null,
      } = args;
      const requestedSessionId = cliSessionId || sessionId || null;
      logStart("cli_session_execute", {
        cliSessionId: requestedSessionId,
        accountId,
        permissionProfileId,
        region,
        command,
      });
      const input = {
        cliSessionId: requestedSessionId,
        accountId,
        permissionProfileId,
        region,
        command,
      };
      try {
        let activeSession = requestedSessionId ? manager.getSession(requestedSessionId) : null;
        if (!activeSession) {
          const authProfile = await resolveAuthProfile({ accountsService, runContext, accountId, permissionProfileId });
          activeSession = await manager.ensureSession({
            authProfile,
            accountId: resolveAccountId(authProfile, accountId),
            permissionProfileId,
            region,
            mode: mode || "workspace_shell",
            recordId,
            ttlSeconds: ttlSeconds || undefined,
          });
        }
        const result = await manager.execute({
          cliSessionId: activeSession.cliSessionId,
          command,
          timeoutMs: timeoutMs || undefined,
        });
        const out = {
          ok: result.ok,
          input: { ...input, cliSessionId: activeSession.cliSessionId },
          result,
        };
        emitExecutionEvent(runContext, out);
        logEnd("cli_session_execute", out);
        return out;
      } catch (error) {
        const out = {
          ok: false,
          error: error?.message || String(error),
          input,
        };
        emitExecutionEvent(runContext, out);
        logEnd("cli_session_execute", out);
        return out;
      }
    },
  });
}

export function createCliSessionStatusTool({ manager = getDefaultLocalCliSessionManager() } = {}) {
  return tool({
    name: "cli_session_status",
    description: "Get status for a local CloudAgent CLI session.",
    parameters: z.object({
      cliSessionId: z.string().nullable().optional(),
      sessionId: z.string().nullable().optional(),
    }).strict(),
    async execute({ cliSessionId = null, sessionId = null }) {
      const id = cliSessionId || sessionId;
      logStart("cli_session_status", { cliSessionId: id });
      const session = id ? manager.getSession(id) : null;
      const out = session
        ? { ok: true, session }
        : { ok: false, cliSessionId: id || null, status: "not_found" };
      logEnd("cli_session_status", out);
      return out;
    },
  });
}

export function createCliSessionEndTool({ manager = getDefaultLocalCliSessionManager() } = {}) {
  return tool({
    name: "cli_session_end",
    description: "End a local CloudAgent CLI session and clean up its working directory.",
    parameters: z.object({
      cliSessionId: z.string().nullable().optional(),
      sessionId: z.string().nullable().optional(),
      keepWorkDir: z.boolean().nullable().optional(),
    }).strict(),
    async execute({ cliSessionId = null, sessionId = null, keepWorkDir = false }) {
      const id = cliSessionId || sessionId;
      logStart("cli_session_end", { cliSessionId: id, keepWorkDir });
      const out = id
        ? await manager.endSession(id, { keepWorkDir: Boolean(keepWorkDir) })
        : { ok: false, cliSessionId: null, status: "not_found" };
      logEnd("cli_session_end", out);
      return out;
    },
  });
}

export function createCliSessionTools({ accountsService, manager = getDefaultLocalCliSessionManager() } = {}) {
  return [
    createCliSessionStartTool({ accountsService, manager }),
    createCliSessionExecuteTool({ accountsService, manager }),
    createCliSessionStatusTool({ manager }),
    createCliSessionEndTool({ manager }),
  ];
}
