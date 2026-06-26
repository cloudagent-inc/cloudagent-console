import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { LocalJsonFileStore } from '@cloudagent/storage';
import healthRouter from './routes/health-router.mjs';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const defaultFrontendDistDir = path.resolve(currentDir, '../../ui/dist');

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

function configureCommonMiddleware(app) {
  app.use(
    cors({
      origin: '*',
      exposedHeaders: ['Mcp-Session-Id'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Mcp-Session-Id',
        'CloudAgent-Token',
        'X-CloudAgent-Client',
        'x-cloudagent-client',
        'ngrok-skip-browser-warning',
      ],
    })
  );
  app.use(express.json({ limit: '2mb' }));
}

async function loadLegacyApp(options = {}) {
  const entry = options.backendEntry || process.env.CLOUDAGENT_LEGACY_BACKEND_ENTRY;
  if (!entry) {
    throw new Error(
      'Legacy backend bridge requested, but CLOUDAGENT_LEGACY_BACKEND_ENTRY was not set.'
    );
  }
  const backendModule = await import(pathToFileURL(entry).href);
  const createLegacyApp = backendModule.createApp || backendModule.default;

  if (typeof createLegacyApp !== 'function') {
    throw new Error(`Backend entry did not export createApp: ${entry}`);
  }

  return createLegacyApp({
    ...options,
    runtime: options.runtime || process.env.CLOUDAGENT_RUNTIME || 'local',
  });
}

async function buildLocalRouter(app, { localDataDir, frontendDistDir } = {}) {
  const store = new LocalJsonFileStore({ dataDir: localDataDir });
  await store.init();
  const { applyLocalOpenAISettingsFromStore } = await import('./platform/local-openai.mjs');
  await applyLocalOpenAISettingsFromStore(store);

  const [
    {
      createLocalCommandCenterRouter,
      createLocalExecutiveSummaryRouter,
      createLocalRouter,
      createLocalUnavailableMiddleware,
    },
    { createLocalWorkloadDiscoveryRouter },
    { createLocalDiagramRouter },
    { createLocalScannerRouter },
    { startLocalWorkflowScheduler },
    { createLocalMcpRouter },
    {
      createLocalCloudAgentTools,
      executeLocalAwsCliCommand,
    },
  ] = await Promise.all([
    import('./modules/local/local-routes.mjs'),
    import('./modules/cloud-setup/aws-local-discovery.mjs'),
    import('./modules/workloads/local-diagram-routes.mjs'),
    import('./modules/scanners/local-scanner-routes.mjs'),
    import('./modules/workflows/local-workflow-scheduler.mjs'),
    import('@cloudagent/mcp'),
    import('./modules/cloudagent/local-cloudagent-tools.mjs'),
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
    app.locals.localWorkflowScheduler = startLocalWorkflowScheduler({ store });
  }

  router.use('/', healthRouter);
  router.use('/local', createLocalRouter({ store }));
  router.use('/', createLocalExecutiveSummaryRouter({ store }));
  router.use('/', createLocalWorkloadDiscoveryRouter({ store }));
  router.use('/', createLocalDiagramRouter({ store }));
  router.use('/', createLocalScannerRouter({ store }));
  router.use('/', createLocalCommandCenterRouter({ store }));

  if (frontendDistDir) {
    const distDir = path.resolve(frontendDistDir);
    const indexPath = path.join(distDir, 'index.html');
    router.use(express.static(distDir));
    router.get(/^\/dashboard(?:\/.*)?$/, (_req, res) => {
      res.sendFile(indexPath);
    });
    router.get('/', (_req, res) => {
      res.sendFile(indexPath);
    });
  }

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
      createLocalCloudAgentTools,
      executeLocalAwsCliCommand,
    })
  );
  router.use(createLocalUnavailableMiddleware());

  return router;
}

function mountLocalRoutes(app, options = {}) {
  let localRouterPromise = null;

  app.use(async (req, res, next) => {
    try {
      localRouterPromise ||= buildLocalRouter(app, options);
      const router = await localRouterPromise;
      return router(req, res, next);
    } catch (error) {
      return next(error);
    }
  });
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
    res.status(err?.status || 500).json({
      ok: false,
      error: err?.message || 'Internal server error',
    });
  });
}

export async function createDesktopApiApp(options = {}) {
  if (process.env.CLOUDAGENT_USE_LEGACY_API_BRIDGE === '1') {
    return loadLegacyApp(options);
  }

  const runtime = options.runtime || process.env.CLOUDAGENT_RUNTIME || 'local';
  if (runtime !== 'local') {
    return loadLegacyApp(options);
  }

  const app = express();
  app.set('runtime', 'local');
  configureCommonMiddleware(app);
  mountLocalRoutes(app, {
    localDataDir: options.localDataDir,
    frontendDistDir: options.frontendDistDir || process.env.CLOUDAGENT_FRONTEND_DIST_DIR || defaultFrontendDistDir,
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
  const app = await createDesktopApiApp({
    runtime: process.env.CLOUDAGENT_RUNTIME || 'local',
    localDataDir: process.env.CLOUDAGENT_LOCAL_DATA_DIR,
    frontendDistDir: process.env.CLOUDAGENT_FRONTEND_DIST_DIR || defaultFrontendDistDir,
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      configureServerTimeouts(server);
      const address = server.address();
      const resolvedPort = typeof address === 'object' && address ? address.port : port;
      console.log(`CloudAgent desktop API listening on http://${host}:${resolvedPort}`);
      resolve({ app, server, host, port: resolvedPort });
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
