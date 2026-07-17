import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { safeTrim } from "@cloudagent/platform/utils";

const DEFAULT_TTL_SECONDS = Number(process.env.CLOUDAGENT_CLI_SESSION_TTL_SECONDS || 30 * 60);
const DEFAULT_TIMEOUT_MS = Number(process.env.CLOUDAGENT_CLI_SESSION_TIMEOUT_MS || 5 * 60 * 1000);
const MAX_TIMEOUT_MS = Number(process.env.CLOUDAGENT_CLI_SESSION_MAX_TIMEOUT_MS || 30 * 60 * 1000);
const MAX_OUTPUT_CHARS = Number(process.env.CLOUDAGENT_CLI_SESSION_MAX_OUTPUT_CHARS || 200_000);
const CLEANUP_INTERVAL_MS = Number(process.env.CLOUDAGENT_CLI_SESSION_CLEANUP_INTERVAL_MS || 60_000);
const DEBUG_ENABLED = String(process.env.CLOUDAGENT_CLI_SESSION_DEBUG ?? "true").toLowerCase() !== "false";

function cliSessionDebug(event, details = {}) {
  if (!DEBUG_ENABLED) return;
  console.log(`[cli-session] ${event}`, details);
}

function defaultSessionRoot() {
  const configured = safeTrim(process.env.CLOUDAGENT_CLI_SESSION_DIR);
  if (configured) return path.resolve(configured.replace(/^~(?=$|\/)/, process.env.HOME || ""));
  return path.join(os.tmpdir(), "cloudagent-cli-sessions");
}

function normalizeScopeId(value) {
  return safeTrim(value) || null;
}

function scopeDirectoryName(scopeId) {
  if (!scopeId) return "unscoped";
  return createHash("sha256").update(scopeId).digest("hex").slice(0, 20);
}

function buildProfileKey({ authProfile = {}, accountId = null, permissionProfileId = null, region = null, mode = "workspace_shell" } = {}) {
  return [
    mode,
    permissionProfileId || authProfile?.permissionProfileId || authProfile?.recordId || authProfile?.id || "",
    accountId || authProfile?.awsAccountId || authProfile?.accountId || "",
    authProfile?.roleArn || authProfile?.roleName || authProfile?.awsProfile || authProfile?.profileName || authProfile?.profile || "",
    region || authProfile?.region || authProfile?.defaultRegion || "",
  ].map((part) => safeTrim(part)).join(":");
}

function compactOutput(value = "") {
  const text = String(value || "");
  if (text.length <= MAX_OUTPUT_CHARS) {
    return { text, truncated: false, chars: text.length };
  }
  return {
    text: `${text.slice(0, MAX_OUTPUT_CHARS)}\n[truncated]`,
    truncated: true,
    chars: text.length,
  };
}

function buildSessionEnv({ authProfile = {}, region = null, workDir }) {
  const env = {
    PATH: process.env.PATH || "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
    LANG: process.env.LANG || "en_US.UTF-8",
    LC_ALL: process.env.LC_ALL || process.env.LANG || "en_US.UTF-8",
    TERM: process.env.TERM || "xterm-256color",
    SHELL: process.env.SHELL || "/bin/bash",
    CLOUDAGENT_CLI_SESSION_WORKDIR: workDir,
    AWS_EC2_METADATA_DISABLED: process.env.AWS_EC2_METADATA_DISABLED || "true",
  };

  const profile = safeTrim(authProfile.awsProfile || authProfile.profileName || authProfile.profile);
  const accessKeyId = safeTrim(authProfile.accessKeyId);
  const secretAccessKey = safeTrim(authProfile.secretAccessKey);
  const sessionToken = safeTrim(authProfile.sessionToken || authProfile.refreshKey);
  const resolvedRegion = safeTrim(region || authProfile.region || authProfile.defaultRegion);

  if (profile) {
    env.HOME = process.env.HOME || os.homedir();
    env.AWS_PROFILE = profile;
  } else {
    env.HOME = workDir;
  }

  if (accessKeyId && secretAccessKey) {
    env.AWS_ACCESS_KEY_ID = accessKeyId;
    env.AWS_SECRET_ACCESS_KEY = secretAccessKey;
    if (sessionToken) env.AWS_SESSION_TOKEN = sessionToken;
  }

  if (resolvedRegion) {
    env.AWS_REGION = resolvedRegion;
    env.AWS_DEFAULT_REGION = resolvedRegion;
  }

  return env;
}

function publicSession(session = {}) {
  if (!session) return null;
  return {
    cliSessionId: session.cliSessionId,
    scopeId: session.scopeId || null,
    recordId: session.recordId || null,
    accountId: session.accountId || null,
    permissionProfileId: session.permissionProfileId || null,
    region: session.region || null,
    mode: session.mode,
    workDir: session.workDir,
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
    ttlSeconds: Math.round(session.ttlMs / 1000),
    commandInProgress: Boolean(session.commandInProgress),
    commandCount: Number(session.commandCount || 0),
    expired: Date.now() > session.lastActivityAt + session.ttlMs && !session.commandInProgress,
  };
}

function emitTerminalEvent(onEvent, payload = {}) {
  if (typeof onEvent !== "function") return;
  try {
    onEvent({
      type: "terminal_output",
      timestamp: new Date().toISOString(),
      ...payload,
    });
  } catch (error) {
    cliSessionDebug("terminal_event_failed", { error: error?.message || String(error) });
  }
}

export class LocalCliSessionManager {
  constructor({ rootDir = defaultSessionRoot(), cleanupIntervalMs = CLEANUP_INTERVAL_MS } = {}) {
    this.rootDir = path.resolve(rootDir);
    this.sessions = new Map();
    this.sessionsByScopeProfile = new Map();
    this.locks = new Map();
    this.cleanupIntervalMs = cleanupIntervalMs;
    this.cleanupTimer = null;
    this.startCleanupTimer();
  }

  startCleanupTimer() {
    if (this.cleanupTimer || !this.cleanupIntervalMs) return;
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions().catch((error) => {
        cliSessionDebug("cleanup_failed", { error: error?.message || String(error) });
      });
    }, this.cleanupIntervalMs);
    this.cleanupTimer.unref?.();
  }

  async createSession({
    authProfile = {},
    accountId = null,
    permissionProfileId = null,
    region = null,
    mode = "workspace_shell",
    recordId = null,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  } = {}) {
    const cliSessionId = randomUUID();
    const now = Date.now();
    const scopeId = normalizeScopeId(recordId);
    const sessionRoot = this.rootDir;
    const workDir = path.join(sessionRoot, scopeDirectoryName(scopeId), cliSessionId);
    await fs.mkdir(workDir, { recursive: true });

    const resolvedRegion = safeTrim(region || authProfile?.region || authProfile?.defaultRegion) || null;
    const resolvedAccountId = safeTrim(accountId || authProfile?.awsAccountId || authProfile?.accountId) || null;
    const resolvedPermissionProfileId =
      safeTrim(permissionProfileId || authProfile?.permissionProfileId || authProfile?.recordId || authProfile?.id) || null;
    const ttlMs = Math.max(60, Number(ttlSeconds) || DEFAULT_TTL_SECONDS) * 1000;
    const profileKey = buildProfileKey({
      authProfile,
      accountId: resolvedAccountId,
      permissionProfileId: resolvedPermissionProfileId,
      region: resolvedRegion,
      mode,
    });
    const reuseKey = scopeId ? `${scopeId}::${profileKey}` : null;
    const session = {
      cliSessionId,
      scopeId,
      recordId: scopeId,
      accountId: resolvedAccountId,
      permissionProfileId: resolvedPermissionProfileId,
      region: resolvedRegion,
      mode: mode || "workspace_shell",
      workDir,
      createdAt: now,
      lastActivityAt: now,
      ttlMs,
      authProfile,
      profileKey,
      reuseKey,
      env: buildSessionEnv({ authProfile, region: resolvedRegion, workDir }),
      commandInProgress: false,
      commandCount: 0,
    };
    this.sessions.set(cliSessionId, session);
    if (reuseKey) this.sessionsByScopeProfile.set(reuseKey, cliSessionId);
    cliSessionDebug("session_created", publicSession(session));
    return { ...publicSession(session), reused: false };
  }

  async ensureSession({
    cliSessionId = null,
    authProfile = {},
    accountId = null,
    permissionProfileId = null,
    region = null,
    mode = "workspace_shell",
    recordId = null,
    ttlSeconds = DEFAULT_TTL_SECONDS,
    forceNew = false,
  } = {}) {
    if (cliSessionId) {
      const existing = this.sessions.get(cliSessionId);
      if (existing && !this.isExpired(existing)) {
        return { ...publicSession(existing), reused: true };
      }
    }
    const scopeId = normalizeScopeId(recordId);
    if (!forceNew && scopeId) {
      const profileKey = buildProfileKey({ authProfile, accountId, permissionProfileId, region, mode });
      const reusableId = this.sessionsByScopeProfile.get(`${scopeId}::${profileKey}`);
      const reusable = reusableId ? this.sessions.get(reusableId) : null;
      if (reusable && !this.isExpired(reusable)) {
        return { ...publicSession(reusable), reused: true };
      }
      if (reusable && this.isExpired(reusable)) {
        await this.endSession(reusable.cliSessionId);
      }
    }
    return this.createSession({ authProfile, accountId, permissionProfileId, region, mode, recordId, ttlSeconds });
  }

  getSession(cliSessionId) {
    const session = this.sessions.get(cliSessionId);
    if (!session) return null;
    return publicSession(session);
  }

  isExpired(session) {
    return !session?.commandInProgress && Date.now() > session.lastActivityAt + session.ttlMs;
  }

  async withLock(cliSessionId, fn) {
    const previous = this.locks.get(cliSessionId);
    let release;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    this.locks.set(cliSessionId, current);
    if (previous) {
      try {
        await previous;
      } catch {
        // Prior command errors are returned to their caller.
      }
    }
    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(cliSessionId) === current) {
        this.locks.delete(cliSessionId);
      }
    }
  }

  async execute({ cliSessionId, command, timeoutMs = DEFAULT_TIMEOUT_MS, onEvent = null } = {}) {
    const session = this.sessions.get(cliSessionId);
    if (!session) {
      throw new Error(`CLI session not found: ${cliSessionId}`);
    }
    if (this.isExpired(session)) {
      throw new Error(`CLI session expired: ${cliSessionId}`);
    }
    if (!safeTrim(command)) {
      throw new Error("Command is required.");
    }

    return this.withLock(cliSessionId, async () => {
      const startedAt = Date.now();
      const commandId = randomUUID();
      let sequence = 0;
      const effectiveTimeoutMs = Math.max(1_000, Math.min(Number(timeoutMs) || DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS));
      session.commandInProgress = true;
      session.lastActivityAt = startedAt;
      this.sessions.set(cliSessionId, session);
      cliSessionDebug("command_start", {
        cliSessionId,
        command: safeTrim(command).slice(0, 500),
        timeoutMs: effectiveTimeoutMs,
        workDir: session.workDir,
      });
      emitTerminalEvent(onEvent, {
        lifecycle: "started",
        cliSessionId,
        commandId,
        sequence: sequence++,
        command: String(command),
        cwd: session.workDir,
      });

      const result = await new Promise((resolve) => {
        const child = spawn("bash", ["-lc", String(command)], {
          cwd: session.workDir,
          env: session.env,
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
        });
        const stdout = [];
        const stderr = [];
        let timedOut = false;
        let settled = false;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        const timer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, effectiveTimeoutMs);
        child.stdout?.on("data", (chunk) => {
          const buffer = Buffer.from(chunk);
          stdout.push(buffer);
          emitTerminalEvent(onEvent, {
            lifecycle: "stdout",
            cliSessionId,
            commandId,
            sequence: sequence++,
            command: String(command),
            stream: "stdout",
            chunk: buffer.toString("utf8"),
          });
        });
        child.stderr?.on("data", (chunk) => {
          const buffer = Buffer.from(chunk);
          stderr.push(buffer);
          emitTerminalEvent(onEvent, {
            lifecycle: "stderr",
            cliSessionId,
            commandId,
            sequence: sequence++,
            command: String(command),
            stream: "stderr",
            chunk: buffer.toString("utf8"),
          });
        });
        child.on("error", (error) => {
          clearTimeout(timer);
          finish({
            statusCode: 400,
            exitCode: null,
            stdout: "",
            stderr: error?.code === "ENOENT" ? "bash is not installed or not available on PATH." : error?.message || String(error),
            timedOut,
          });
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          finish({
            statusCode: code === 0 && !timedOut ? 200 : 400,
            exitCode: code,
            stdout: Buffer.concat(stdout).toString("utf8"),
            stderr: timedOut ? `Command timed out after ${effectiveTimeoutMs}ms.` : Buffer.concat(stderr).toString("utf8"),
            timedOut,
          });
        });
      });

      const stdout = compactOutput(result.stdout);
      const stderr = compactOutput(result.stderr);
      session.commandInProgress = false;
      session.lastActivityAt = Date.now();
      session.commandCount += 1;
      this.sessions.set(cliSessionId, session);
      const response = {
        ok: result.statusCode === 200,
        cliSessionId,
        commandId,
        cwd: session.workDir,
        command,
        statusCode: result.statusCode,
        exitCode: result.exitCode,
        stdout: stdout.text,
        stderr: stderr.text,
        timedOut: Boolean(result.timedOut),
        stdoutTruncated: stdout.truncated,
        stderrTruncated: stderr.truncated,
        stdoutChars: stdout.chars,
        stderrChars: stderr.chars,
        durationMs: Date.now() - startedAt,
      };
      cliSessionDebug("command_end", {
        cliSessionId,
        statusCode: response.statusCode,
        durationMs: response.durationMs,
        stdoutChars: response.stdoutChars,
        stderrChars: response.stderrChars,
        timedOut: response.timedOut,
      });
      emitTerminalEvent(onEvent, {
        lifecycle: response.ok ? "completed" : "failed",
        cliSessionId,
        commandId,
        sequence: sequence++,
        command: String(command),
        cwd: session.workDir,
        exitCode: response.exitCode,
        statusCode: response.statusCode,
        timedOut: response.timedOut,
        durationMs: response.durationMs,
        stdoutTruncated: response.stdoutTruncated,
        stderrTruncated: response.stderrTruncated,
      });
      return response;
    });
  }

  listSessions() {
    return [...this.sessions.values()].map(publicSession);
  }

  async endSession(cliSessionId, { keepWorkDir = false } = {}) {
    const session = this.sessions.get(cliSessionId);
    if (!session) return { ok: false, cliSessionId, status: "not_found" };
    this.sessions.delete(cliSessionId);
    this.locks.delete(cliSessionId);
    if (session.reuseKey && this.sessionsByScopeProfile.get(session.reuseKey) === cliSessionId) {
      this.sessionsByScopeProfile.delete(session.reuseKey);
    }
    if (!keepWorkDir && String(process.env.CLOUDAGENT_KEEP_CLI_SESSIONS ?? "false").toLowerCase() !== "true") {
      await fs.rm(session.workDir, { recursive: true, force: true });
    }
    cliSessionDebug("session_ended", { cliSessionId, keepWorkDir });
    return { ok: true, cliSessionId, status: "ended", workDir: session.workDir };
  }

  async cleanupExpiredSessions() {
    const ended = [];
    for (const session of this.sessions.values()) {
      if (!this.isExpired(session)) continue;
      const result = await this.endSession(session.cliSessionId);
      ended.push(result.cliSessionId);
    }
    return { ok: true, ended };
  }
}

const defaultManagers = new Map();

export function getDefaultLocalCliSessionManager(options = {}) {
  const rootDir = path.resolve(options.rootDir || defaultSessionRoot());
  if (!defaultManagers.has(rootDir)) {
    defaultManagers.set(rootDir, new LocalCliSessionManager({ ...options, rootDir }));
  }
  return defaultManagers.get(rootDir);
}
