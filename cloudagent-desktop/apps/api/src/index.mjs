import cors from 'cors';
import express from 'express';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { JsonFileStore } from '@cloudagent/storage';
import { createDesktopPreferencesStore, normalizeMcpPreference } from '../../desktop/src/main/security-settings.mjs';
import { createLocalAuth, equalToken, sameOriginRequest } from './lib/local-auth.mjs';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const defaultFrontendDistDir = path.resolve(currentDir, '../../ui/dist');

const LOOPBACK_LISTEN_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https:",
  "media-src 'self' data: blob: https:",
  "worker-src 'self' blob:",
].join('; ');

// ---------------------------------------------------------------------------
// Auth / hardening helpers
//
// The desktop app runs this Express API in-process and loads the UI from it, so
// the UI is same-origin with the API. Two env vars tune the auth behaviour:
//   CLOUDAGENT_DEV_ORIGIN  - when set (e.g. http://localhost:5173) enables CORS
//                            for exactly that origin (Vite dev server).
//   CLOUDAGENT_DEV_NO_AUTH - when "1" the auth gate is skipped entirely so the
//                            cross-origin/cookieless dev UI keeps working. Logs
//                            a loud warning at startup. NEVER set in production.
//   CLOUDAGENT_API_TOKEN   - fixes the per-launch token (else it is random).
// ---------------------------------------------------------------------------

function resolveApiToken(options = {}) {
  const configured = options.apiToken || process.env.CLOUDAGENT_API_TOKEN;
  if (configured) return String(configured);
  return crypto.randomBytes(32).toString('hex');
}

function parseHostname(hostHeader) {
  const raw = String(hostHeader || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']');
    return end === -1 ? raw : raw.slice(0, end + 1);
  }
  const colonCount = (raw.match(/:/g) || []).length;
  if (colonCount === 1) return raw.slice(0, raw.indexOf(':')); // host:port
  return raw; // bare hostname/ipv4, or bracketless ipv6 compared whole
}

const ALLOWED_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

function hostHeaderGuard(req, res, next) {
  const hostname = parseHostname(req.headers.host);
  if (ALLOWED_HOSTNAMES.has(hostname)) return next();
  return res.status(403).json({ ok: false, error: 'forbidden host' });
}

function securityHeaders(_req, res, next) {
  res.set({
    'Content-Security-Policy': CONTENT_SECURITY_POLICY,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
  next();
}

export function resolveLoopbackListenHost(value) {
  const host = String(value || '').trim().toLowerCase();
  if (LOOPBACK_LISTEN_HOSTS.has(host)) return host;
  throw new Error(
    `CloudAgent desktop API must listen on a loopback host; received ${value || '(empty)'}.`
  );
}

function isTokenQueryAllowed(req) {
  if (isMcpRequest(req)) return true;
  if (req.method === 'GET' && /\/events\/stream$/.test(req.path)) return true;
  return false;
}

function extractPresentedToken(req) {
  const authz = req.headers.authorization || '';
  const bearer = /^Bearer\s+(.+)$/i.exec(authz);
  if (bearer) return bearer[1].trim();

  const headerToken = req.headers['x-cloudagent-token'];
  if (headerToken) return String(headerToken).trim();

  if (isTokenQueryAllowed(req)) {
    const queryToken = req.query?.token;
    if (queryToken) return String(queryToken).trim();
  }
  return null;
}

function isMcpRequest(req) {
  // Express routes are case-insensitive by default; match that at the gate too.
  const pathname = req.path.toLowerCase();
  return pathname === '/mcp' || pathname.startsWith('/mcp/');
}

function createAuthGate(app, auth) {
  return function authGate(req, res, next) {
    // Development overrides cannot bypass an enabled password or startup lock.
    if (!auth.unlocked) return res.status(401).json({ ok: false, error: 'Console is locked.' });
    const presented = extractPresentedToken(req);
    if (isMcpRequest(req)) {
      if (equalToken(presented, app.get('mcpToken'))) return next();
    } else if (auth.authenticated(req)) {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return sameOriginRequest(req, res, next);
      return next();
    } else if (!auth.enabled && (process.env.CLOUDAGENT_DEV_NO_AUTH === '1' ||
        equalToken(presented, app.get('apiToken')))) {
      return next();
    }
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  };
}

function mountAuthRoutes(app, auth, initializeRuntime) {
  app.use('/auth', sameOriginRequest, (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/auth/status', (req, res) => {
    if (!auth.enabled && !auth.authenticated(req)) auth.issueSession(res);
    res.json({ ok: true, ...auth.status(req), authenticated: !auth.enabled || auth.authenticated(req) });
  });
  const jsonOnly = (req, res, next) => req.is('application/json')
    ? next() : res.status(415).json({ ok: false, error: 'Use application/json.' });
  app.post('/auth/login', jsonOnly, async (req, res) => {
    await auth.login(req.body?.password, res, initializeRuntime);
    res.json({ ok: true, enabled: auth.enabled, authenticated: true });
  });
  const sessionOnly = (req, res, next) => auth.authenticated(req)
    ? next() : res.status(401).json({ ok: false, error: 'unauthorized' });
  app.get('/auth/security', sessionOnly, (_req, res) => res.json({ ok: true, enabled: auth.enabled, pendingRestart: auth.preferencesPendingRestart }));
  app.put('/auth/security', sessionOnly, jsonOnly, async (req, res) => {
    await auth.update(req.body || {}, res);
    res.json({ ok: true, enabled: auth.enabled });
  });
  app.get('/auth/mcp', sessionOnly, (req, res) => res.json({
    ok: true,
    mcpEnabled: app.get('localMcpEnabled') !== false,
    mcpUrl: `${req.protocol}://${req.get('host')}/mcp?token=${encodeURIComponent(app.get('mcpToken'))}`,
  }));
}

function configureHardeningMiddleware(app) {
  // (a) Host-header allowlist (DNS-rebinding defense) runs first, even for static.
  app.use(hostHeaderGuard);

  // Security headers apply to the app shell, assets, and authenticated APIs.
  app.use(securityHeaders);

  // (b) CORS. Default: none (same-origin app). Opt-in for a single dev origin.
  const devOrigin = process.env.CLOUDAGENT_DEV_ORIGIN;
  if (devOrigin) {
    app.use(
      cors({
        origin: devOrigin,
        credentials: true,
        exposedHeaders: ['Mcp-Session-Id'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'Mcp-Session-Id',
          'X-CloudAgent-Token',
          'CloudAgent-Token',
          'X-CloudAgent-Client',
          'x-cloudagent-client',
        ],
      })
    );
  }

  // (c) JSON body parsing.
  app.use(express.json({ limit: '2mb' }));
}

function mountPublicRoutes(app, { frontendDistDir, auth }) {
  // (d) UNAUTHENTICATED routes: healthz, static assets, and the app shell
  // Authenticated sessions are established by login (or explicitly when protection is off).
  app.get('/healthz', (_req, res) => res.json({ ok: true }));

  if (frontendDistDir) {
    const distDir = path.resolve(frontendDistDir);
    const indexPath = path.join(distDir, 'index.html');
    // index:false so `/` falls through to the cookie-setting shell handler below.
    app.use(express.static(distDir, { index: false }));
    app.use('/assets', (_req, res) => {
      res.set('Cache-Control', 'no-store');
      res
        .status(404)
        .type('text/plain')
        .send('CloudAgent UI asset not found. Reload the app to use the current UI build.');
    });
    app.get(/^\/dashboard(?:\/.*)?$/, (_req, res) => {
      if (!auth.enabled && !auth.authenticated(_req)) auth.issueSession(res);
      res.set('Cache-Control', 'no-store');
      res.sendFile(indexPath);
    });
    app.get('/', (_req, res) => {
      if (!auth.enabled && !auth.authenticated(_req)) auth.issueSession(res);
      res.set('Cache-Control', 'no-store');
      res.sendFile(indexPath);
    });
  }
}

function lazyRouter(importer) {
  let routerPromise = null;

  return async function lazyRouterMiddleware(req, res, next) {
    try {
      routerPromise ||= importer().then((module) => module.default || module);
      const router = await routerPromise;
      return router(req, res, next);
    } catch (error) {
      return next(error);
    }
  };
}

async function buildLocalRouter(app, { localDataDir } = {}) {
  const store = new JsonFileStore({ dataDir: localDataDir });
  await store.init();
  const { applyLocalLLMSettingsFromStore } = await import('./platform/llm.mjs');
  await applyLocalLLMSettingsFromStore(store);

  const [
    { createApiRouter, createUnavailableMiddleware },
    { createExecutiveSummaryRouter },
    { createCommandCenterRouter },
    { createChatRootRouter },
    { createPermissionProfileRootRouter },
    { createWorkflowRootRouter },
    { createAgentRunRootRouter },
    { createSkillRootRouter },
    { createPlanBuilderRouter },
    { createLocalWorkloadDiscoveryRouter },
    { createLocalDiagramRouter },
    { createLocalScannerRouter },
    { startWorkflowScheduler },
    { createLocalMcpRouter },
    { createCloudAgentTools },
  ] = await Promise.all([
    import('./routes/api-router.mjs'),
    import('./modules/executive-summaries/executive-summary-routes.mjs'),
    import('./modules/command-center/command-center-routes.mjs'),
    import('./modules/chat/chat-routes.mjs'),
    import('./modules/permission-profiles/permission-profile-routes.mjs'),
    import('./modules/workflows/workflow-routes.mjs'),
    import('./modules/agent-runs/agent-run-routes.mjs'),
    import('./modules/skills/skill-routes.mjs'),
    import('./modules/plan-builder/plan-builder-routes.mjs'),
    import('./modules/cloud-setup/aws-discovery.mjs'),
    import('./modules/workloads/diagram-routes.mjs'),
    import('./modules/scanners/scanner-routes.mjs'),
    import('./modules/workflows/workflow-scheduler.mjs'),
    import('@cloudagent/mcp'),
    import('./modules/cloudagent/cloudagent-tools.mjs'),
  ]);

  const router = express.Router();

  app.set('localStore', store);
  app.set('runtime', 'local');
  if (app.get('localMcpEnabled') === undefined) {
    app.set(
      'localMcpEnabled',
      String(process.env.CLOUDAGENT_LOCAL_MCP_ENABLED ?? 'true').toLowerCase() !== 'false'
    );
  }
  if (!app.locals.localWorkflowScheduler) {
    app.locals.localWorkflowScheduler = startWorkflowScheduler({ store });
  }
  if (!app.locals.localMcpEventBus) {
    app.locals.localMcpEventBus = new EventEmitter();
    app.locals.localMcpEventBus.setMaxListeners(100);
  }

  router.use('/local', createApiRouter({ store }));
  router.use('/', createExecutiveSummaryRouter({ store }));
  router.use('/', createLocalWorkloadDiscoveryRouter({ store }));
  router.use('/', createLocalDiagramRouter({ store }));
  router.use('/', createLocalScannerRouter({ store }));
  router.use('/', createCommandCenterRouter({ store }));
  router.use('/', createChatRootRouter({ store }));
  router.use('/', createPermissionProfileRootRouter({ store }));
  router.use('/', createWorkflowRootRouter({ store }));
  router.use('/', createAgentRunRootRouter({ store }));
  router.use('/', createSkillRootRouter({ store }));
  router.use('/', createPlanBuilderRouter({ store }));

  router.use('/mcp', (req, res, next) => {
    if (app.get('localMcpEnabled') === false) {
      return res.status(503).json({
        ok: false,
        error: 'Local MCP server is turned off.',
      });
    }
    return next();
  });
  router.use(
    '/',
    createLocalMcpRouter({
      createCloudAgentTools,
      onToolEvent: (event) => {
        const recordId = event?.recordId || event?.cloudagentRunId || null;
        if (!recordId) return;
        app.locals.localMcpEventBus.emit(`run:${recordId}`, event);
      },
    })
  );
  router.use(createUnavailableMiddleware());

  return router;
}

function mountLocalRoutes(app, options = {}) {
  let localRouterPromise = null;

  const initializeRuntime = () => {
    localRouterPromise ||= buildLocalRouter(app, options);
    return localRouterPromise;
  };
  app.use(async (req, res, next) => {
    try {
      const router = await initializeRuntime();
      return router(req, res, next);
    } catch (error) {
      return next(error);
    }
  });
  return initializeRuntime;
}

function mountPayloadErrorHandler(app) {
  app.use((err, req, res, next) => {
    if (err?.type === 'entity.too.large' || err?.status === 413) {
      console.error(
        '[HTTP_413_PAYLOAD_TOO_LARGE]',
        JSON.stringify(
          {
            method: req?.method || null,
            url: req?.originalUrl || req?.url || null,
            contentLengthHeader: req?.headers?.['content-length'] || null,
            contentType: req?.headers?.['content-type'] || null,
            userAgent: req?.headers?.['user-agent'] || null,
            message: err?.message || String(err),
            limit: err?.limit || null,
            length: err?.length || null,
          },
          null,
          2
        )
      );
      return res.status(413).json({
        error: 'PAYLOAD_TOO_LARGE',
        message: 'Request entity too large',
      });
    }

    return next(err);
  });
}

function mountErrorHandler(app) {
  app.use((err, _req, res, _next) => {
    console.error('[HTTP_ERROR]', err);
    if (res.headersSent) return;
    if (err?.retryAfter) res.set('Retry-After', String(err.retryAfter));
    res.status(err?.status || 500).json({
      ok: false,
      error: err?.message || 'Internal server error',
    });
  });
}

export async function createDesktopApiApp(options = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('runtime', 'local');

  const token = resolveApiToken(options);
  // The API scripting token and MCP credential have separate scopes.
  app.set('apiToken', token);
  app.set('mcpToken', crypto.randomBytes(32).toString('hex'));
  const desktopPreferences = options.desktopPreferencesStore || (!options.securitySettingsStore && createDesktopPreferencesStore());
  const auth = createLocalAuth({ settingsStore: options.securitySettingsStore || desktopPreferences.securitySettingsStore });
  if (desktopPreferences) {
    const saved = desktopPreferences.read().localMcpEnabled;
    app.set('localMcpEnabled', process.env.CLOUDAGENT_LOCAL_MCP_ENABLED !== undefined
      ? normalizeMcpPreference(process.env.CLOUDAGENT_LOCAL_MCP_ENABLED)
      : normalizeMcpPreference(saved));
  }
  app.locals.localAuth = auth;

  if (process.env.CLOUDAGENT_DEV_NO_AUTH === '1') {
    console.warn(
      '[SECURITY] CLOUDAGENT_DEV_NO_AUTH=1 bypasses API token checks only when password protection is disabled. MCP still requires its token.'
    );
  }

  const frontendDistDir =
    options.frontendDistDir ||
    process.env.CLOUDAGENT_FRONTEND_DIST_DIR ||
    defaultFrontendDistDir;

  // Middleware order:
  //   (a) host-header guard -> (b) CORS -> (c) express.json
  configureHardeningMiddleware(app);
  //   (d) public login/status, health, assets, and UI shell; no workspace access
  let initializeRuntime;
  mountAuthRoutes(app, auth, () => initializeRuntime());
  mountPublicRoutes(app, { frontendDistDir, auth });
  //   (e) auth gate
  app.use(createAuthGate(app, auth));
  //   (f) every API router (behind the gate)
  initializeRuntime = mountLocalRoutes(app, {
    localDataDir: options.localDataDir || desktopPreferences?.dataDir,
  });

  mountPayloadErrorHandler(app);
  mountErrorHandler(app);
  return app;
}

export const createApp = createDesktopApiApp;
export default createDesktopApiApp;

function configureServerTimeouts(server) {
  server.keepAliveTimeout = 120_000;
  server.headersTimeout = 130_000;
  server.requestTimeout = 0;
}

export async function startServer({
  port = Number(process.env.PORT || 0),
  host = process.env.HOST || '127.0.0.1',
} = {}) {
  const listenHost = resolveLoopbackListenHost(host);
  const app = await createDesktopApiApp({
    runtime: process.env.CLOUDAGENT_RUNTIME || 'local',
    frontendDistDir: process.env.CLOUDAGENT_FRONTEND_DIST_DIR || defaultFrontendDistDir,
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(port, listenHost, () => {
      configureServerTimeouts(server);
      const address = server.address();
      const resolvedPort = typeof address === 'object' && address ? address.port : port;
      console.log(`CloudAgent desktop API listening on http://${listenHost}:${resolvedPort}`);
      console.log(
        '[SECURITY] Browser access uses session cookies and the optional app password. MCP requires its separate per-launch token (available in the authenticated MCP settings).'
      );
      resolve({ app, server, host: listenHost, port: resolvedPort });
    });
    server.once('error', reject);
  });
}

function isExecutedDirectly() {
  if (!process.argv[1]) return false;
  return fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
}

if (isExecutedDirectly()) {
  await startServer();
}
