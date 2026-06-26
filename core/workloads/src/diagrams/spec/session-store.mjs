import { randomUUID } from "node:crypto";

const sessions = new Map(); // token -> { state, ts }
const TTL_MS = Number(process.env.DIAGRAMS_SPEC_SESSION_TTL_MS || 60 * 60 * 1000);

function now() {
  return Date.now();
}

function sweep() {
  const t = now();
  for (const [token, s] of sessions.entries()) {
    if (t - s.ts > TTL_MS) sessions.delete(token);
  }
}

setInterval(sweep, Math.min(30 * 60 * 1000, Math.max(60 * 1000, Math.floor(TTL_MS / 2)))).unref?.();

export function getOrCreateSpecSession(incomingToken) {
  const token = incomingToken || randomUUID();
  const hit = sessions.get(token);
  if (hit) {
    hit.ts = now();
    return { token, state: hit.state };
  }

  const state = {
    provider: "aws",
    history: [],
    lastSpec: null,
  };
  sessions.set(token, { state, ts: now() });
  return { token, state };
}

export function resetSpecSession(token) {
  sessions.delete(String(token || ""));
}

