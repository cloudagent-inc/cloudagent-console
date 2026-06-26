/**
 * Cloud Diagrammer API wrapper
 * Hardcoded API paths as per requirements
 */

import { BACKEND_API_ENDPOINT } from '../config/appConfig';

const SPEC_API_BASE = BACKEND_API_ENDPOINT;
const SPEC_MCP_PATH = "/diagrams-app-mcp";
const MCP_ACCEPT = "application/json, text/event-stream";
const DIAGRAMS_CLIENT_ID = "diagrams-webapp";

function jsonRpcRequest(method, params) {
  return {
    jsonrpc: "2.0",
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    method,
    params,
  };
}

function unwrapMcpToolCall(json) {
  const result = json?.result;
  if (result?.structuredContent) return result.structuredContent;
  if (result?.data) return result.data;
  return result || json;
}

function compact(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue;
    out[k] = v;
  }
  return out;
}

async function mcpToolCall({ name, args, mcpSessionId }) {
  const resp = await fetch(`${SPEC_API_BASE}${SPEC_MCP_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CloudAgent-Client": DIAGRAMS_CLIENT_ID,
      ...(mcpSessionId ? { "Mcp-Session-Id": mcpSessionId } : {}),
      Accept: MCP_ACCEPT,
    },
    body: JSON.stringify(
      jsonRpcRequest("tools/call", {
        name,
        arguments: compact(args || {}),
      })
    ),
  });

  const nextMcpSessionId = resp.headers.get("Mcp-Session-Id") || mcpSessionId || null;
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    const msg = body?.error?.message || body?.error || `HTTP ${resp.status}`;
    const err = new Error(msg);
    err.mcpSessionId = nextMcpSessionId;
    throw err;
  }

  const json = await resp.json();
  const data = unwrapMcpToolCall(json);
  return { data, mcpSessionId: nextMcpSessionId };
}

export async function createDiagramSpec({ provider, message, sessionId, mcpSessionId }) {
  const { data, mcpSessionId: next } = await mcpToolCall({
    name: "diagram_spec",
    args: { provider, prompt: message, sessionId: sessionId || null },
    mcpSessionId,
  });
  return { ...data, mcpSessionId: next };
}

export async function updateDiagramSpec({ provider, instruction, spec, sessionId, mcpSessionId }) {
  const { data, mcpSessionId: next } = await mcpToolCall({
    name: "diagram_spec",
    args: { provider, prompt: instruction, spec, sessionId: sessionId || null },
    mcpSessionId,
  });
  return { ...data, mcpSessionId: next };
}



