import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_TTL_SECONDS = Number(process.env.CLOUDAGENT_CLI_SESSION_TTL_SECONDS || 30 * 60);
const DEFAULT_TIMEOUT_MS = Number(process.env.CLOUDAGENT_CLI_SESSION_TIMEOUT_MS || 5 * 60 * 1000);
const MAX_TIMEOUT_MS = Number(process.env.CLOUDAGENT_CLI_SESSION_MAX_TIMEOUT_MS || 30 * 60 * 1000);
const MAX_OUTPUT_CHARS = Number(process.env.CLOUDAGENT_CLI_SESSION_MAX_OUTPUT_CHARS || 200_000);
const CLEANUP_INTERVAL_MS = Number(process.env.CLOUDAGENT_CLI_SESSION_CLEANUP_INTERVAL_MS || 60_000);
const DEBUG_ENABLED = String(process.env.CLOUDAGENT_CLI_SESSION_DEBUG ?? "true").toLowerCase() !== "false";

function safeTrim(value) {
  return value == null ? "" : String(value).trim();
}

function cliSessionDebug(event, details = {}) {
  if (!DEBUG_ENABLED) return;
  console.log(`[cli-session] ${event}`, details);
}

function defaultSessionRoot() {
  const configured = safeTrim(process.env.CLOUDAGENT_CLI_SESSION_DIR);
  if (configured) return path.resolve(configured.replace(/^~(?=$|\/)/, process.env.HOME || ""));
  return path.join(os.tmpdir(), "cloudagent-cli-sessions");
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
    expired: Date.now() > session.lastActivityAt + session.ttlMs && !session.commandInProgress,
  };
}

export class LocalCliSessionManager {
  constructor({ rootDir = defaultSessionRoot(), cleanupIntervalMs = CLEANUP_INTERVAL_MS } = {}) {
    this.rootDir = rootDir;
    this.sessions = new Map();
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
    const sessionRoot = path.resolve(this.rootDir);
    const workDir = path.join(sessionRoot, cliSessionId);
    await fs.mkdir(workDir, { recursive: true });

    const resolvedRegion = safeTrim(region || authProfile?.region || authProfile?.defaultRegion) || null;
    const resolvedAccountId = safeTrim(accountId || authProfile?.awsAccountId || authProfile?.accountId) || null;
    const resolvedPermissionProfileId =
      safeTrim(permissionProfileId || authProfile?.permissionProfileId || authProfile?.recordId || authProfile?.id) || null;
    const ttlMs = Math.max(60, Number(ttlSeconds) || DEFAULT_TTL_SECONDS) * 1000;
    const session = {
      cliSessionId,
      recordId: recordId || null,
      accountId: resolvedAccountId,
      permissionProfileId: resolvedPermissionProfileId,
      region: resolvedRegion,
      mode: mode || "workspace_shell",
      workDir,
      createdAt: now,
      lastActivityAt: now,
      ttlMs,
      authProfile,
      profileKey: buildProfileKey({
        authProfile,
        accountId: resolvedAccountId,
        permissionProfileId: resolvedPermissionProfileId,
        region: resolvedRegion,
        mode,
      }),
      env: buildSessionEnv({ authProfile, region: resolvedRegion, workDir }),
      commandInProgress: false,
      commandCount: 0,
    };
    this.sessions.set(cliSessionId, session);
    cliSessionDebug("session_created", publicSession(session));
    return publicSession(session);
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
  } = {}) {
    if (cliSessionId) {
      const existing = this.sessions.get(cliSessionId);
      if (existing && !this.isExpired(existing)) {
        return publicSession(existing);
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

  async execute({ cliSessionId, command, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
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
        const timer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, effectiveTimeoutMs);
        child.stdout?.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
        child.stderr?.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
        child.on("error", (error) => {
          clearTimeout(timer);
          resolve({
            statusCode: 400,
            exitCode: null,
            stdout: "",
            stderr: error?.code === "ENOENT" ? "bash is not installed or not available on PATH." : error?.message || String(error),
            timedOut,
          });
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          resolve({
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

let defaultManager = null;

export function getDefaultLocalCliSessionManager(options = {}) {
  if (!defaultManager) {
    defaultManager = new LocalCliSessionManager(options);
  }
  return defaultManager;
}
