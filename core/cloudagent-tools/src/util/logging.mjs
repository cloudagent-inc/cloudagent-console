export function safeJson(obj, limit = 3000) {
  try {
    const s = JSON.stringify(obj, null, 2);
    return s.length > limit ? s.slice(0, limit) + " …(truncated)" : s;
  } catch (e) {
    return String(obj);
  }
}

export function logStart(name, args) {
  console.log(`\n[tool:${name}] ▶ call\n${safeJson(args)}\n`);
}

function summarizeToolResult(out) {
  if (out == null) return out;
  if (typeof out !== "object") {
    if (typeof out === "string") {
      return out.length > 300 ? `${out.slice(0, 300)} …(truncated)` : out;
    }
    return out;
  }

  const summary = {};
  const passthroughKeys = [
    "ok",
    "status",
    "statusCode",
    "durationMs",
    "duration_ms",
    "error",
    "message",
    "cli_command",
    "action",
    "workloadId",
    "workloadName",
    "recordId",
    "itemId"
  ];
  const payloadKeys = ["output", "summary", "data", "result", "results", "items", "body", "stdout", "stderr", "content", "workload"];

  for (const key of passthroughKeys) {
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      summary[key] = out[key];
    }
  }

  for (const key of payloadKeys) {
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      const value = out[key];
      if (typeof value === "string") {
        summary[`${key}_length`] = value.length;
      } else if (Array.isArray(value)) {
        summary[`${key}_count`] = value.length;
      } else if (value && typeof value === "object") {
        summary[`${key}_keys`] = Object.keys(value).slice(0, 15);
      } else if (value != null) {
        summary[`${key}_type`] = typeof value;
      }
    }
  }

  if (!Object.keys(summary).length) {
    summary.keys = Object.keys(out).slice(0, 20);
  }

  return summary;
}

export function logEnd(name, out) {
  console.log(`[tool:${name}] ◀ result\n${safeJson(summarizeToolResult(out))}\n`);
}

function extractUserId(req) {
  return req?.auth?.userId || req?.context?.userId || req?.headers?.["x-user-id"] || "anonymous";
}

function formatMeta(meta) {
  if (!meta || (typeof meta === "object" && !Object.keys(meta).length)) return "";
  return `\n${safeJson(meta)}`;
}

export function logRouteEvent(label, phase, req, meta = null) {
  const userId = extractUserId(req);
  console.log(`[route:${label}] ${phase} user=${userId}${formatMeta(meta)}`);
}

export function createRouteLogger(label, metaFn = null) {
  return function routeLoggerMiddleware(req, res, next) {
    const startMeta = metaFn ? metaFn(req) : null;
    const startedAt = Date.now();
    logRouteEvent(label, "▶ start", req, startMeta);
    res.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      logRouteEvent(label, "◀ end", req, {
        status: res.statusCode,
        durationMs
      });
    });
    next();
  };
}
