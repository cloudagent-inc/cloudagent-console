import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { hashPassword, validateNewPassword, validatePasswordRecord, verifyPassword } from '@cloudagent/platform/password';

export const SESSION_COOKIE = 'cloudagent_api_token';
const digest = (value) => createHash('sha256').update(String(value)).digest('hex');
const unauthorized = () => Object.assign(new Error('Incorrect password.'), { status: 401 });

export function cookieSession(req) {
  for (const cookie of String(req.headers.cookie || '').split(';')) {
    const [name, ...parts] = cookie.trim().split('=');
    if (name === SESSION_COOKIE) return parts.join('=');
  }
  return '';
}

export function equalToken(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a.length === b.length &&
    timingSafeEqual(Buffer.from(digest(a)), Buffer.from(digest(b)));
}

export function createLocalAuth({ settingsStore, now = Date.now }) {
  let security = settingsStore.read();
  if (security !== undefined && (!security || typeof security.enabled !== 'boolean')) {
    throw new Error('Invalid password settings. Restore settings.json in your local data folder from a backup.');
  }
  security ||= { enabled: false };
  if (security.enabled) validatePasswordRecord(security.password);
  let unlocked = !security.enabled;
  const sessions = new Set();
  let busy = false;
  let failures = 0;
  let nextAttemptAt = 0;

  function authenticated(req) {
    const token = cookieSession(req);
    return Boolean(token && sessions.has(digest(token)));
  }

  function issueSession(res) {
    if (sessions.size >= 256) sessions.delete(sessions.values().next().value);
    const token = randomBytes(32).toString('hex');
    sessions.add(digest(token));
    res.append('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/`);
  }

  async function passwordOperation(operation) {
    if (busy || now() < nextAttemptAt) {
      throw Object.assign(new Error('Please wait before trying again.'), {
        status: 429, retryAfter: Math.max(1, Math.ceil((nextAttemptAt - now()) / 1000)),
      });
    }
    busy = true;
    try {
      return await operation();
    } finally {
      busy = false;
    }
  }

  async function checkPassword(password) {
    if (!await verifyPassword(password, security.password)) {
      failures += 1;
      nextAttemptAt = now() + Math.min(30_000, 1000 * 2 ** Math.min(failures - 1, 5));
      throw unauthorized();
    }
    failures = 0;
    nextAttemptAt = 0;
  }

  return {
    get enabled() { return security.enabled; },
    get unlocked() { return unlocked; },
    get preferencesPendingRestart() { return Boolean(settingsStore.pendingRestart); },
    authenticated,
    issueSession,
    status(req) { return { enabled: security.enabled, authenticated: authenticated(req) }; },
    async login(password, res, initializeRuntime) {
      await passwordOperation(async () => {
        if (security.enabled) await checkPassword(password);
        // Runtime startup is allowed only after verification succeeds.
        await initializeRuntime();
        unlocked = true;
        issueSession(res);
      });
    },
    async update({ enabled, currentPassword, password }, res) {
      if (typeof enabled !== 'boolean') throw Object.assign(new Error('Choose whether password protection is enabled.'), { status: 400 });
      if (enabled) validateNewPassword(password);
      await passwordOperation(async () => {
        if (security.enabled) await checkPassword(currentPassword);
        const next = enabled ? { enabled: true, password: await hashPassword(password) } : { enabled: false };
        await settingsStore.write(next);
        security = next;
        unlocked = true;
        // Other browser sessions must log in again after a security change.
        sessions.clear();
        issueSession(res);
      });
    },
  };
}

// Stop cross-site login/settings requests and cookie-authenticated mutations.
// Non-browser clients can omit Origin; browser fetch metadata still rejects them.
export function sameOriginRequest(req, res, next) {
  const origin = req.headers.origin;
  const allowedOrigin = `${req.protocol}://${req.get('host')}`;
  if (req.headers['sec-fetch-site'] === 'cross-site' ||
      (origin && origin !== allowedOrigin && origin !== process.env.CLOUDAGENT_DEV_ORIGIN)) {
    return res.status(403).json({ ok: false, error: 'Cross-origin authentication request rejected.' });
  }
  next();
}
