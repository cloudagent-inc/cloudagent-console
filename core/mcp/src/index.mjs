import { Router } from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { user, run, extractAllTextOutput } from "@openai/agents";
import { z } from "zod";

import { makeCloudAgent } from "@cloudagent/cloudagent/core";

const LOCAL_MCP_USER_ID = process.env.CLOUDAGENT_LOCAL_USER_ID || "local-user";

function getHeader(req, name) {
  if (!req) return null;
  if (typeof req.get === "function") {
    const value = req.get(name);
    if (value) return value;
  }
  if (req.headers) {
    const key = Object.keys(req.headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
    if (key) return req.headers[key];
  }
  if (req.requestInfo?.headers) {
    const key = Object.keys(req.requestInfo.headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
    if (key) return req.requestInfo.headers[key];
  }
  return null;
}

export function getHeaderAny(req, name) {
  const value = getHeader(req, name);
  return Array.isArray(value) ? value[0] : value ?? null;
}

function isLoopbackAddress(address = "") {
  const value = String(address || "").trim().toLowerCase();
  if (!value) return false;
  if (value === "localhost") return true;
  if (value === "::1" || value === "0:0:0:0:0:0:0:1") return true;
  if (value.startsWith("::ffff:")) return isLoopbackAddress(value.slice("::ffff:".length));
  return value.startsWith("127.");
}

function isLocalRuntimeRequest(req) {
  return req?.app?.get?.("runtime") === "local" || process.env.CLOUDAGENT_RUNTIME === "local";
}

function isLocalMcpAuthBypassAllowed(req) {
  const enabled = String(process.env.CLOUDAGENT_LOCAL_MCP_AUTH_BYPASS ?? "true").toLowerCase() !== "false";
  if (!enabled || !isLocalRuntimeRequest(req)) return false;
  const remoteAddress = req?.socket?.remoteAddress || req?.connection?.remoteAddress || req?.ip || "";
  return isLoopbackAddress(remoteAddress);
}

function getBaseUrl(req) {
  if (process.env.MCP_BASE_URL) return process.env.MCP_BASE_URL.replace(/\/$/, "");
  const protocol = req.get?.("x-forwarded-proto") || req.protocol || "http";
  const host = req.get?.("x-forwarded-host") || req.get?.("host") || "localhost";
  return `${protocol}://${host}`;
}

function createLocalMcpServer({
  getStore,
  createLocalCloudAgentTools,
  executeLocalAwsCliCommand,
}) {
  const sessions = new Map();

  function buildTools(sessionId, req) {
    const store = getStore?.({ sessionId, req });
    if (!store) return null;
    return createLocalCloudAgentTools({ store }).tools;
  }

  function getSession({ sessionId, userId, clientId, toolsOverride }) {
    let session = sessions.get(sessionId);
    if (!session) {
      const agent = makeCloudAgent({
        mode: "local",
        authLevel: "user",
        clientId,
        toolsOverride,
      });
      session = {
        agent,
        history: [user(`Session userId: ${userId}`)],
        userId,
        clientId,
      };
      sessions.set(sessionId, session);
    }
    return session;
  }

  function createServer() {
    const mcpServer = new McpServer({ name: "cloudagent-desktop-mcp-http", version: "1.0.0" });

    mcpServer.registerTool(
      "cloudagent_chat",
      {
        title: "CloudAgent Chat",
        description: "Send a message to the local CloudAgent desktop assistant.",
        inputSchema: {
          sessionId: z.string(),
          message: z.string(),
        },
      },
      async ({ sessionId, message }, req) => {
        const toolsOverride = buildTools(sessionId, req);
        if (!Array.isArray(toolsOverride)) {
          return {
            content: [{ type: "text", text: "Local CloudAgent MCP tools are unavailable because the local file store is not initialized." }],
            isError: true,
          };
        }
        const clientId =
          getHeaderAny(req, "X-CloudAgent-Client") ||
          getHeaderAny(req, "x-cloudagent-client") ||
          "local-mcp";
        const session = getSession({
          sessionId,
          userId: LOCAL_MCP_USER_ID,
          clientId,
          toolsOverride,
        });
        session.history.push(user(String(message || "")));
        const result = await run(session.agent, session.history, {
          maxTurns: 30,
          runConfig: { tracingDisabled: true },
          context: { userId: LOCAL_MCP_USER_ID },
        });
        session.history = result.history;
        const text = result.finalOutput ?? extractAllTextOutput(result.history) ?? "";
        return {
          content: [{ type: "text", text }],
          data: { items: result.history?.length ?? 0 },
        };
      }
    );

    mcpServer.registerTool(
      "cloudagent_reset",
      {
        title: "Reset Session",
        description: "Clear a local CloudAgent MCP session.",
        inputSchema: { sessionId: z.string() },
      },
      async ({ sessionId }) => {
        sessions.delete(sessionId);
        return { content: [{ type: "text", text: `Session ${sessionId} cleared.` }] };
      }
    );

    mcpServer.registerTool(
      "aws_cli_readonly",
      {
        title: "AWS CLI Read Only",
        description: "Execute a read-only AWS CLI command using selected local CloudAgent environment credentials.",
        inputSchema: {
          command: z.string().describe("An AWS CLI command starting with aws and a read-only operation."),
          accountId: z.string().nullable().optional(),
          permissionProfileId: z.string().nullable().optional(),
          sessionId: z.string().nullable().optional(),
        },
      },
      async ({ command, accountId = null, permissionProfileId = null, sessionId = null }, req) => {
        const effectiveSessionId = sessionId || getHeaderAny(req, "Mcp-Session-Id") || req?.body?.sessionId || null;
        const store = getStore?.({ sessionId: effectiveSessionId, req });
        if (!store) {
          return {
            content: [{ type: "text", text: "Local CloudAgent MCP tools are unavailable because the local file store is not initialized." }],
            isError: true,
          };
        }

        const { accountsService } = createLocalCloudAgentTools({ store });
        const defaults = permissionProfileId
          ? await accountsService.getPermissionProfileDefaults(LOCAL_MCP_USER_ID, permissionProfileId)
          : await accountsService.getAccountDefaults(LOCAL_MCP_USER_ID, accountId);
        const authProfile = defaults?.authProfile || null;
        if (!authProfile) {
          return {
            content: [{ type: "text", text: "No local AWS credentials were found for the requested permissionProfileId/accountId." }],
            isError: true,
          };
        }

        try {
          const resolvedAccountId = accountId || authProfile.awsAccountId || authProfile.accountId || null;
          const result = await executeLocalAwsCliCommand({
            command,
            accountId: resolvedAccountId,
            authProfile,
          });
          const structuredContent = {
            ok: result.statusCode === 200,
            accountId: resolvedAccountId,
            command,
            statusCode: result.statusCode,
            stdout: result.output?.stdout || "",
            stderr: result.output?.stderr || "",
          };
          return {
            content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
            structuredContent,
            data: { ok: result.statusCode === 200, accountId: resolvedAccountId, command, result },
            isError: result.statusCode !== 200,
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: String(error?.message || error) }],
            isError: true,
          };
        }
      }
    );

    return mcpServer;
  }

  return { createServer, sessions };
}

export function createLocalMcpRouter({
  createLocalCloudAgentTools,
  executeLocalAwsCliCommand,
} = {}) {
  if (typeof createLocalCloudAgentTools !== "function") {
    throw new Error("createLocalMcpRouter requires createLocalCloudAgentTools");
  }
  if (typeof executeLocalAwsCliCommand !== "function") {
    throw new Error("createLocalMcpRouter requires executeLocalAwsCliCommand");
  }

  const router = Router();
  const transports = new Map();
  const requestContextBySession = new Map();

  function getStore({ sessionId, req } = {}) {
    const context = requestContextBySession.get(sessionId) || {};
    return context.store || req?.app?.get?.("localStore") || null;
  }

  const { createServer } = createLocalMcpServer({
    getStore,
    createLocalCloudAgentTools,
    executeLocalAwsCliCommand,
  });

  router.get("/.well-known/oauth-protected-resource", (req, res) => {
    const baseUrl = getBaseUrl(req);
    res.json({
      resource: `${baseUrl}/mcp`,
      authorization_servers: [],
      bearer_methods_supported: ["header"],
      local: true,
    });
  });

  router.get("/.well-known/oauth-authorization-server", (_req, res) => {
    res.status(404).json({
      error: "oauth_unavailable",
      error_description: "CloudAgent Desktop local MCP uses loopback local authorization, not hosted OAuth.",
    });
  });

  router.options("/mcp", (req, res) => {
    const requestedHeaders = req.get("access-control-request-headers");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Headers",
      requestedHeaders ||
        "Content-Type, Mcp-Session-Id, Authorization, Accept, X-CloudAgent-Client, x-cloudagent-client, CloudAgent-Token, cloudagent-token"
    );
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
    res.setHeader("Vary", "Origin, Access-Control-Request-Headers");
    res.status(204).end();
  });

  router.all("/mcp", async (req, res) => {
    if (req.method === "POST" && !isLocalMcpAuthBypassAllowed(req)) {
      return res.status(401).json({
        error: "local_mcp_auth_required",
        error_description: "Local MCP tool calls are only accepted from loopback in local runtime.",
      });
    }

    const clientId =
      String(
        getHeaderAny(req, "X-CloudAgent-Client") ||
          getHeaderAny(req, "x-cloudagent-client") ||
          req.body?.clientId ||
          req.query?.clientId ||
          "local-mcp"
      ).toLowerCase() || "local-mcp";
    const requestedSessionId =
      getHeaderAny(req, "Mcp-Session-Id") ||
      req.query?.sessionId ||
      req.body?.sessionId ||
      null;

    let transport = requestedSessionId ? transports.get(requestedSessionId) : null;
    if (!transport && req.method === "POST" && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        enableDnsRebindingProtection: true,
        onsessioninitialized: (sessionId) => {
          transports.set(sessionId, transport);
        },
      });
      transport.onclose = () => {
        const sessionId = transport.sessionId;
        if (sessionId) {
          transports.delete(sessionId);
          requestContextBySession.delete(sessionId);
        }
      };
      await createServer().connect(transport);
    } else if (!transport) {
      return res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid MCP session ID provided",
        },
        id: null,
      });
    }

    const sessionId = requestedSessionId || transport.sessionId || null;
    if (sessionId) res.setHeader("Mcp-Session-Id", sessionId);
    req.auth = { userId: LOCAL_MCP_USER_ID, local: true };
    if (sessionId) {
      requestContextBySession.set(sessionId, {
        clientId,
        runtime: req.app?.get?.("runtime") || null,
        localAuthBypass: true,
        store: req.app?.get?.("localStore") || null,
        ts: Date.now(),
      });
    }

    try {
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("[local MCP] transport.handleRequest failed", {
        sessionId,
        clientId,
        error: error?.message || String(error),
      });
      return res.status(500).json({ ok: false, error: error?.message || "MCP transport error" });
    }
  });

  return router;
}

export default createLocalMcpRouter;
