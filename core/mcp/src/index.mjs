import { Router } from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { user, run, extractAllTextOutput } from "@openai/agents";
import { z } from "zod";

import { makeCloudAgent } from "@cloudagent/cloudagent/core";

const LOCAL_MCP_USER_ID = process.env.CLOUDAGENT_LOCAL_USER_ID || "local-user";
const LOCAL_MCP_DEBUG_ENABLED = String(process.env.CLOUDAGENT_LOCAL_MCP_DEBUG ?? "true").toLowerCase() !== "false";
const MAX_DEBUG_COMMAND_CHARS = 500;

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

function mcpDebug(event, details = {}) {
  if (!LOCAL_MCP_DEBUG_ENABLED) return;
  console.log(`[local MCP] ${event}`, details);
}

function getMcpRequestId(req) {
  return getHeaderAny(req, "X-CloudAgent-Mcp-Request-Id") || req?.localMcpRequestId || null;
}

function summarizeCommand(command) {
  const text = String(command || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > MAX_DEBUG_COMMAND_CHARS
    ? `${text.slice(0, MAX_DEBUG_COMMAND_CHARS)}... [${text.length} chars]`
    : text;
}

function summarizeMcpBody(body) {
  const first = Array.isArray(body) ? body[0] : body;
  const params = first?.params || {};
  const args = params.arguments || params.args || {};
  return {
    batched: Array.isArray(body),
    method: first?.method || null,
    id: first?.id ?? null,
    toolName: params.name || params.toolName || params.tool_name || null,
    sessionId: args.sessionId || body?.sessionId || null,
    argumentKeys: args && typeof args === "object" ? Object.keys(args).sort() : [],
    command: args?.command ? summarizeCommand(args.command) : undefined,
  };
}

function getDirectToolCallRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (body.method !== "tools/call") return null;
  const params = body.params && typeof body.params === "object" ? body.params : {};
  const toolName = String(params.name || params.toolName || params.tool_name || "").trim();
  if (!toolName) {
    return { id: body.id ?? null, error: { code: -32602, message: "Missing tools/call params.name" } };
  }
  const args = params.arguments && typeof params.arguments === "object"
    ? params.arguments
    : params.args && typeof params.args === "object"
      ? params.args
      : {};
  return { id: body.id ?? null, toolName, args };
}

function toDirectJsonRpcToolResponse(id, toolResult = {}) {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: Array.isArray(toolResult.content)
        ? toolResult.content
        : [{ type: "text", text: JSON.stringify(toolResult, null, 2) }],
      ...(toolResult.structuredContent ? { structuredContent: toolResult.structuredContent } : {}),
      ...(toolResult.data ? { data: toolResult.data } : {}),
      isError: Boolean(toolResult.isError),
    },
  };
}

function toDirectJsonRpcError(id, code, message) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  };
}

function summarizeToolArgs(args = {}) {
  return {
    keys: args && typeof args === "object" ? Object.keys(args).sort() : [],
    accountId: args?.accountId || null,
    permissionProfileId: args?.permissionProfileId || null,
    sessionId: args?.sessionId || null,
    command: args?.command ? summarizeCommand(args.command) : undefined,
    region: args?.region || undefined,
    stackName: args?.stackName || undefined,
    repoFullName: args?.repoFullName || undefined,
    path: args?.path || args?.localPath || args?.repoPath || undefined,
  };
}

function getRunContext(req) {
  const recordId =
    getHeaderAny(req, "X-CloudAgent-Run-Id") ||
    req?.query?.cloudagentRunId ||
    req?.body?.cloudagentRunId ||
    null;
  const runner =
    getHeaderAny(req, "X-CloudAgent-Runner") ||
    req?.query?.cloudagentRunner ||
    req?.body?.cloudagentRunner ||
    null;
  return {
    recordId: recordId ? String(recordId) : null,
    runner: runner ? String(runner) : null,
  };
}

function createLocalMcpServer({
  getStore,
  createLocalCloudAgentTools,
  executeLocalAwsCliCommand,
  onToolEvent,
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

  function emitLocalToolEvent(req, payload = {}) {
    if (typeof onToolEvent !== "function") return;
    const runContext = getRunContext(req);
    if (!runContext.recordId) return;
    try {
      onToolEvent({
        type: "mcp_tool_event",
        timestamp: new Date().toISOString(),
        ...runContext,
        ...payload,
      });
    } catch (error) {
      mcpDebug("tool_event_emit_error", {
        requestId: getMcpRequestId(req),
        toolName: payload.toolName || null,
        error: error?.message || String(error),
      });
    }
  }

  async function invokeLocalToolDirect(toolName, args, req) {
    const requestId = getMcpRequestId(req) || randomUUID();
    const effectiveSessionId = args?.sessionId || getHeaderAny(req, "Mcp-Session-Id") || req?.body?.sessionId || null;
    const startedAt = Date.now();
    mcpDebug("direct_tool_call_start", {
      requestId,
      toolName,
      sessionId: effectiveSessionId,
      args: summarizeToolArgs(args),
    });
    emitLocalToolEvent(req, {
      lifecycle: "started",
      requestId,
      toolName,
      sessionId: effectiveSessionId,
      args: summarizeToolArgs(args),
    });

    if (toolName === "aws_cli_readonly") {
      const { command, accountId = null, permissionProfileId = null } = args || {};
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
        emitLocalToolEvent(req, {
          lifecycle: result.statusCode === 200 ? "completed" : "failed",
          requestId,
          toolName,
          sessionId: effectiveSessionId,
          args: {
            accountId: resolvedAccountId,
            permissionProfileId,
            sessionId: effectiveSessionId,
            command: summarizeCommand(command),
          },
          result: structuredContent,
          ok: result.statusCode === 200,
          statusCode: result.statusCode,
          durationMs: Date.now() - startedAt,
          stdoutTruncated: Boolean(result.stdoutTruncated),
          stderrTruncated: Boolean(result.stderrTruncated),
        });
        mcpDebug("direct_tool_call_end", {
          requestId,
          toolName,
          sessionId: effectiveSessionId,
          ok: result.statusCode === 200,
          statusCode: result.statusCode,
          durationMs: Date.now() - startedAt,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
          structuredContent,
          data: { ok: result.statusCode === 200, accountId: resolvedAccountId, command, result },
          isError: result.statusCode !== 200,
        };
      } catch (error) {
        emitLocalToolEvent(req, {
          lifecycle: "failed",
          requestId,
          toolName,
          sessionId: effectiveSessionId,
          args: summarizeToolArgs(args),
          error: error?.message || String(error),
          ok: false,
          durationMs: Date.now() - startedAt,
        });
        return {
          content: [{ type: "text", text: String(error?.message || error) }],
          isError: true,
        };
      }
    }

    const toolsOverride = buildTools(effectiveSessionId, req);
    if (!Array.isArray(toolsOverride)) {
      return {
        content: [{ type: "text", text: "Local CloudAgent MCP tools are unavailable because the local file store is not initialized." }],
        isError: true,
      };
    }
    const localTool = toolsOverride.find((tool) => tool?.name === toolName);
    if (!localTool?.invoke) {
      return {
        content: [{ type: "text", text: `Local CloudAgent tool is not available: ${toolName}` }],
        isError: true,
      };
    }
    try {
      const result = await localTool.invoke({ context: { userId: LOCAL_MCP_USER_ID } }, JSON.stringify(args || {}), {});
      emitLocalToolEvent(req, {
        lifecycle: result?.ok === false ? "failed" : "completed",
        requestId,
        toolName,
        sessionId: effectiveSessionId,
        args: summarizeToolArgs(args),
        result,
        ok: result?.ok !== false,
        durationMs: Date.now() - startedAt,
      });
      mcpDebug("direct_tool_call_end", {
        requestId,
        toolName,
        sessionId: effectiveSessionId,
        ok: result?.ok !== false,
        durationMs: Date.now() - startedAt,
      });
      return {
        content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
        structuredContent: result && typeof result === "object" ? result : undefined,
        data: result,
        isError: result?.ok === false,
      };
    } catch (error) {
      emitLocalToolEvent(req, {
        lifecycle: "failed",
        requestId,
        toolName,
        sessionId: effectiveSessionId,
        args: summarizeToolArgs(args),
        error: error?.message || String(error),
        ok: false,
        durationMs: Date.now() - startedAt,
      });
      mcpDebug("direct_tool_call_error", {
        requestId,
        toolName,
        sessionId: effectiveSessionId,
        durationMs: Date.now() - startedAt,
        error: error?.message || String(error),
      });
      return {
        content: [{ type: "text", text: String(error?.message || error) }],
        isError: true,
      };
    }
  }

  function createServer() {
    const mcpServer = new McpServer({ name: "cloudagent-desktop-mcp-http", version: "1.0.0" });

    function emitToolEvent(req, payload = {}) {
      if (typeof onToolEvent !== "function") return;
      const runContext = getRunContext(req);
      if (!runContext.recordId) return;
      try {
        emitLocalToolEvent(req, payload);
      } catch (error) {
        mcpDebug("tool_event_emit_error", {
          requestId: getMcpRequestId(req),
          toolName: payload.toolName || null,
          error: error?.message || String(error),
        });
      }
    }

    async function invokeLocalTool(toolName, args, req) {
      const requestId = getMcpRequestId(req) || randomUUID();
      const effectiveSessionId = args?.sessionId || getHeaderAny(req, "Mcp-Session-Id") || req?.body?.sessionId || null;
      const startedAt = Date.now();
      mcpDebug("tool_call_start", {
        requestId,
        toolName,
        sessionId: effectiveSessionId,
        args: summarizeToolArgs(args),
      });
      emitToolEvent(req, {
        lifecycle: "started",
        requestId,
        toolName,
        sessionId: effectiveSessionId,
        args: summarizeToolArgs(args),
      });
      const toolsOverride = buildTools(effectiveSessionId, req);
      if (!Array.isArray(toolsOverride)) {
        mcpDebug("tool_call_unavailable", {
          requestId,
          toolName,
          sessionId: effectiveSessionId,
          reason: "local_store_unavailable",
        });
        return {
          content: [{ type: "text", text: "Local CloudAgent MCP tools are unavailable because the local file store is not initialized." }],
          isError: true,
        };
      }
      const localTool = toolsOverride.find((tool) => tool?.name === toolName);
      if (!localTool?.invoke) {
        mcpDebug("tool_call_unavailable", {
          requestId,
          toolName,
          sessionId: effectiveSessionId,
          reason: "tool_not_found",
        });
        return {
          content: [{ type: "text", text: `Local CloudAgent tool is not available: ${toolName}` }],
          isError: true,
        };
      }
      try {
        const result = await localTool.invoke({ context: { userId: LOCAL_MCP_USER_ID } }, JSON.stringify(args || {}), {});
        mcpDebug("tool_call_end", {
          requestId,
          toolName,
          sessionId: effectiveSessionId,
          ok: result?.ok !== false,
          durationMs: Date.now() - startedAt,
          resultKeys: result && typeof result === "object" ? Object.keys(result).sort() : [],
        });
        emitToolEvent(req, {
          lifecycle: result?.ok === false ? "failed" : "completed",
          requestId,
          toolName,
          sessionId: effectiveSessionId,
          args: summarizeToolArgs(args),
          result,
          ok: result?.ok !== false,
          durationMs: Date.now() - startedAt,
        });
        return {
          content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
          structuredContent: result && typeof result === "object" ? result : undefined,
          data: result,
          isError: result?.ok === false,
        };
      } catch (error) {
        mcpDebug("tool_call_error", {
          requestId,
          toolName,
          sessionId: effectiveSessionId,
          durationMs: Date.now() - startedAt,
          error: error?.message || String(error),
        });
        emitToolEvent(req, {
          lifecycle: "failed",
          requestId,
          toolName,
          sessionId: effectiveSessionId,
          args: summarizeToolArgs(args),
          error: error?.message || String(error),
          ok: false,
          durationMs: Date.now() - startedAt,
        });
        return {
          content: [{ type: "text", text: String(error?.message || error) }],
          isError: true,
        };
      }
    }

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
        const requestId = getMcpRequestId(req) || randomUUID();
        const startedAt = Date.now();
        const effectiveSessionId = sessionId || getHeaderAny(req, "Mcp-Session-Id") || req?.body?.sessionId || null;
        mcpDebug("tool_call_start", {
          requestId,
          toolName: "aws_cli_readonly",
          sessionId: effectiveSessionId,
          accountId,
          permissionProfileId,
          command: summarizeCommand(command),
        });
        emitToolEvent(req, {
          lifecycle: "started",
          requestId,
          toolName: "aws_cli_readonly",
          sessionId: effectiveSessionId,
          args: {
            accountId,
            permissionProfileId,
            sessionId: effectiveSessionId,
            command: summarizeCommand(command),
          },
        });
        const store = getStore?.({ sessionId: effectiveSessionId, req });
        if (!store) {
          mcpDebug("tool_call_unavailable", {
            requestId,
            toolName: "aws_cli_readonly",
            sessionId: effectiveSessionId,
            reason: "local_store_unavailable",
          });
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
          mcpDebug("tool_call_unavailable", {
            requestId,
            toolName: "aws_cli_readonly",
            sessionId: effectiveSessionId,
            accountId,
            permissionProfileId,
            reason: "auth_profile_unavailable",
          });
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
          mcpDebug("tool_call_end", {
            requestId,
            toolName: "aws_cli_readonly",
            sessionId: effectiveSessionId,
            accountId: resolvedAccountId,
            statusCode: result.statusCode,
            ok: result.statusCode === 200,
            stdoutChars: result.output?.stdout?.length || 0,
            stderrChars: result.output?.stderr?.length || 0,
            timedOut: Boolean(result.timedOut),
            stdoutTruncated: Boolean(result.stdoutTruncated),
            stderrTruncated: Boolean(result.stderrTruncated),
            durationMs: Date.now() - startedAt,
          });
          const structuredContent = {
            ok: result.statusCode === 200,
            accountId: resolvedAccountId,
            command,
            statusCode: result.statusCode,
            stdout: result.output?.stdout || "",
            stderr: result.output?.stderr || "",
          };
          emitToolEvent(req, {
            lifecycle: result.statusCode === 200 ? "completed" : "failed",
            requestId,
            toolName: "aws_cli_readonly",
            sessionId: effectiveSessionId,
            args: {
              accountId: resolvedAccountId,
              permissionProfileId,
              sessionId: effectiveSessionId,
              command: summarizeCommand(command),
            },
            result: structuredContent,
            ok: result.statusCode === 200,
            statusCode: result.statusCode,
            durationMs: Date.now() - startedAt,
            stdoutTruncated: Boolean(result.stdoutTruncated),
            stderrTruncated: Boolean(result.stderrTruncated),
          });
          return {
            content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
            structuredContent,
            data: { ok: result.statusCode === 200, accountId: resolvedAccountId, command, result },
            isError: result.statusCode !== 200,
          };
        } catch (error) {
          mcpDebug("tool_call_error", {
            requestId,
            toolName: "aws_cli_readonly",
            sessionId: effectiveSessionId,
            durationMs: Date.now() - startedAt,
            error: error?.message || String(error),
          });
          emitToolEvent(req, {
            lifecycle: "failed",
            requestId,
            toolName: "aws_cli_readonly",
            sessionId: effectiveSessionId,
            args: {
              accountId,
              permissionProfileId,
              sessionId: effectiveSessionId,
              command: summarizeCommand(command),
            },
            error: error?.message || String(error),
            ok: false,
            durationMs: Date.now() - startedAt,
          });
          return {
            content: [{ type: "text", text: String(error?.message || error) }],
            isError: true,
          };
        }
      }
    );

    mcpServer.registerTool(
      "aws_cfn_operations",
      {
        title: "AWS CloudFormation Operations",
        description: "Create or update a CloudFormation stack using selected local CloudAgent environment credentials.",
        inputSchema: {
          operation: z.enum(["create", "update", "deploy"]).nullable().optional(),
          accountId: z.string().nullable().optional(),
          permissionProfileId: z.string().nullable().optional(),
          region: z.string(),
          stackName: z.string(),
          templateBody: z.string(),
          workloadId: z.string().nullable().optional(),
          parameters: z.array(z.object({ ParameterKey: z.string(), ParameterValue: z.string() }).strict()).nullable().optional(),
          capabilities: z.array(z.string()).nullable().optional(),
          sessionId: z.string().nullable().optional(),
        },
      },
      (args, req) => invokeLocalTool("aws_cfn_operations", args, req)
    );

    mcpServer.registerTool(
      "list_github_repos",
      {
        title: "List GitHub Repositories",
        description: "List GitHub repositories configured in local CloudAgent workload or environment deployment preferences.",
        inputSchema: {
          connectionId: z.string().nullable().optional(),
          sessionId: z.string().nullable().optional(),
        },
      },
      (args, req) => invokeLocalTool("list_github_repos", args, req)
    );

    mcpServer.registerTool(
      "read_github_file",
      {
        title: "Read GitHub File",
        description: "Read a file or directory from a local Git repository checkout.",
        inputSchema: {
          localPath: z.string().nullable().optional(),
          repoPath: z.string().nullable().optional(),
          owner: z.string().nullable().optional(),
          repo: z.string().nullable().optional(),
          repoFullName: z.string().nullable().optional(),
          path: z.string(),
          ref: z.string().nullable().optional(),
          sessionId: z.string().nullable().optional(),
        },
      },
      (args, req) => invokeLocalTool("read_github_file", args, req)
    );

    mcpServer.registerTool(
      "create_github_branch",
      {
        title: "Create GitHub Branch",
        description: "Create or reset a branch in a local Git repository checkout from a base branch/ref.",
        inputSchema: {
          localPath: z.string().nullable().optional(),
          repoPath: z.string().nullable().optional(),
          owner: z.string().nullable().optional(),
          repo: z.string().nullable().optional(),
          repoFullName: z.string().nullable().optional(),
          base: z.string(),
          branch: z.string(),
          sessionId: z.string().nullable().optional(),
        },
      },
      (args, req) => invokeLocalTool("create_github_branch", args, req)
    );

    mcpServer.registerTool(
      "write_github_file",
      {
        title: "Write GitHub File",
        description: "Create or update a file in a local Git repository checkout and commit the change.",
        inputSchema: {
          localPath: z.string().nullable().optional(),
          repoPath: z.string().nullable().optional(),
          owner: z.string().nullable().optional(),
          repo: z.string().nullable().optional(),
          repoFullName: z.string().nullable().optional(),
          path: z.string(),
          content: z.string(),
          message: z.string(),
          branch: z.string().nullable().optional(),
          sessionId: z.string().nullable().optional(),
        },
      },
      (args, req) => invokeLocalTool("write_github_file", args, req)
    );

    mcpServer.registerTool(
      "create_github_pull_request",
      {
        title: "Create GitHub Pull Request",
        description: "Create a GitHub pull request from a local checkout using the GitHub CLI.",
        inputSchema: {
          localPath: z.string().nullable().optional(),
          repoPath: z.string().nullable().optional(),
          owner: z.string().nullable().optional(),
          repo: z.string().nullable().optional(),
          repoFullName: z.string().nullable().optional(),
          title: z.string(),
          head: z.string(),
          base: z.string(),
          body: z.string().nullable().optional(),
          push: z.boolean().nullable().optional(),
          sessionId: z.string().nullable().optional(),
        },
      },
      (args, req) => invokeLocalTool("create_github_pull_request", args, req)
    );

    return mcpServer;
  }

  return { createServer, invokeLocalToolDirect, sessions };
}

export function createLocalMcpRouter({
  createLocalCloudAgentTools,
  executeLocalAwsCliCommand,
  onToolEvent,
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

  const { createServer, invokeLocalToolDirect } = createLocalMcpServer({
    getStore,
    createLocalCloudAgentTools,
    executeLocalAwsCliCommand,
    onToolEvent,
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
        "Content-Type, Mcp-Session-Id, Authorization, Accept, X-CloudAgent-Client, x-cloudagent-client, X-CloudAgent-Mcp-Request-Id, CloudAgent-Token, cloudagent-token"
    );
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, X-CloudAgent-Mcp-Request-Id");
    res.setHeader("Vary", "Origin, Access-Control-Request-Headers");
    res.status(204).end();
  });

  router.all("/mcp", async (req, res) => {
    const requestId = randomUUID();
    const requestStartedAt = Date.now();
    req.localMcpRequestId = requestId;
    req.headers = {
      ...(req.headers || {}),
      "x-cloudagent-mcp-request-id": requestId,
      ...(req.query?.cloudagentRunId ? { "x-cloudagent-run-id": String(req.query.cloudagentRunId) } : {}),
      ...(req.query?.cloudagentRunner ? { "x-cloudagent-runner": String(req.query.cloudagentRunner) } : {}),
    };
    res.setHeader("X-CloudAgent-Mcp-Request-Id", requestId);
    const bodySummary = summarizeMcpBody(req.body);
    mcpDebug("http_request", {
      requestId,
      method: req.method,
      body: bodySummary,
      requestedSessionId:
        getHeaderAny(req, "Mcp-Session-Id") ||
        req.query?.sessionId ||
        req.body?.sessionId ||
        null,
      clientId:
        getHeaderAny(req, "X-CloudAgent-Client") ||
        getHeaderAny(req, "x-cloudagent-client") ||
        req.body?.clientId ||
        req.query?.clientId ||
        null,
      contentType: getHeaderAny(req, "content-type"),
      accept: getHeaderAny(req, "accept"),
      remoteAddress: req?.socket?.remoteAddress || req?.connection?.remoteAddress || req?.ip || null,
    });

    if (req.method === "POST" && !isLocalMcpAuthBypassAllowed(req)) {
      mcpDebug("http_rejected", {
        requestId,
        reason: "auth_required",
        durationMs: Date.now() - requestStartedAt,
      });
      return res.status(401).json({
        error: "local_mcp_auth_required",
        error_description: "Local MCP tool calls are only accepted from loopback in local runtime.",
      });
    }

    const directToolCall = req.method === "POST" ? getDirectToolCallRequest(req.body) : null;
    if (directToolCall) {
      if (directToolCall.error) {
        mcpDebug("direct_tool_call_rejected", {
          requestId,
          reason: directToolCall.error.message,
          durationMs: Date.now() - requestStartedAt,
        });
        return res.status(400).json(toDirectJsonRpcError(directToolCall.id, directToolCall.error.code, directToolCall.error.message));
      }
      try {
        mcpDebug("direct_tool_call_route", {
          requestId,
          toolName: directToolCall.toolName,
          args: summarizeToolArgs(directToolCall.args),
        });
        const result = await invokeLocalToolDirect(directToolCall.toolName, directToolCall.args, req);
        mcpDebug("direct_tool_call_response", {
          requestId,
          toolName: directToolCall.toolName,
          isError: Boolean(result?.isError),
          durationMs: Date.now() - requestStartedAt,
        });
        return res.json(toDirectJsonRpcToolResponse(directToolCall.id, result));
      } catch (error) {
        mcpDebug("direct_tool_call_failed", {
          requestId,
          toolName: directToolCall.toolName,
          durationMs: Date.now() - requestStartedAt,
          error: error?.message || String(error),
        });
        return res
          .status(500)
          .json(toDirectJsonRpcError(directToolCall.id, -32000, error?.message || "Local MCP direct tool call failed"));
      }
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
      mcpDebug("transport_create_start", {
        requestId,
        clientId,
      });
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        enableDnsRebindingProtection: true,
        onsessioninitialized: (sessionId) => {
          transports.set(sessionId, transport);
          mcpDebug("transport_session_initialized", {
            requestId,
            sessionId,
            clientId,
          });
        },
      });
      transport.onclose = () => {
        const sessionId = transport.sessionId;
        if (sessionId) {
          transports.delete(sessionId);
          requestContextBySession.delete(sessionId);
          mcpDebug("transport_session_closed", {
            requestId,
            sessionId,
            clientId,
          });
        }
      };
      await createServer().connect(transport);
    } else if (!transport) {
      mcpDebug("http_rejected", {
        requestId,
        reason: "missing_or_unknown_session",
        requestedSessionId,
        body: bodySummary,
        durationMs: Date.now() - requestStartedAt,
      });
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
      mcpDebug("http_response", {
        requestId,
        sessionId,
        clientId,
        statusCode: res.statusCode,
        durationMs: Date.now() - requestStartedAt,
      });
    } catch (error) {
      console.error("[local MCP] transport.handleRequest failed", {
        requestId,
        sessionId,
        clientId,
        body: bodySummary,
        durationMs: Date.now() - requestStartedAt,
        error: error?.message || String(error),
      });
      return res.status(500).json({ ok: false, error: error?.message || "MCP transport error" });
    }
  });

  return router;
}

export default createLocalMcpRouter;
