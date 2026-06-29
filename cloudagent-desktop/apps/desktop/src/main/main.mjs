import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, '../../../..');
const defaultBackendEntry = path.resolve(workspaceRoot, 'apps/api/src/index.mjs');
const defaultFrontendDistDir = path.resolve(workspaceRoot, 'apps/ui/dist');

let mainWindow = null;
let localApiServer = null;
let localApiBaseUrl = null;
let localApiApp = null;
let localDataDir = null;
let localMcpEnabled =
  String(process.env.CLOUDAGENT_LOCAL_MCP_ENABLED ?? 'true').toLowerCase() !== 'false';

function desktopSettingsPath() {
  return path.join(app.getPath('userData'), 'desktop-settings.json');
}

function defaultLocalDataDir() {
  return path.join(app.getPath('userData'), 'local-data');
}

function normalizeLocalDataDir(value) {
  const raw = String(value || '').trim();
  if (!raw) return defaultLocalDataDir();
  return path.resolve(raw.replace(/^~(?=$|\/)/, app.getPath('home')));
}

function readDesktopSettings() {
  try {
    const raw = fs.readFileSync(desktopSettingsPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeDesktopSettings(patch = {}) {
  const settings = {
    ...readDesktopSettings(),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(desktopSettingsPath()), { recursive: true });
  fs.writeFileSync(desktopSettingsPath(), JSON.stringify(settings, null, 2));
  return settings;
}

function resolveSavedLocalDataDir() {
  const settings = readDesktopSettings();
  return normalizeLocalDataDir(settings.localDataDir);
}

function resolveConfiguredLocalDataDir() {
  if (process.env.CLOUDAGENT_LOCAL_DATA_DIR) {
    return normalizeLocalDataDir(process.env.CLOUDAGENT_LOCAL_DATA_DIR);
  }
  return resolveSavedLocalDataDir();
}

function buildLocalDirectoryInfo() {
  const configuredLocalDataDir = resolveSavedLocalDataDir();
  const activeLocalDataDir = localDataDir || resolveConfiguredLocalDataDir();
  if (!localDataDir) {
    return {
      localDataDir: activeLocalDataDir,
      configuredLocalDataDir,
      activeLocalDataDir: '',
      localDataDirPendingRestart: false,
      localDataDirSource: process.env.CLOUDAGENT_LOCAL_DATA_DIR ? 'environment' : 'preferences',
    };
  }
  return {
    localDataDir,
    configuredLocalDataDir,
    activeLocalDataDir: localDataDir,
    localDataDirPendingRestart: configuredLocalDataDir !== localDataDir,
    localDataDirSource: process.env.CLOUDAGENT_LOCAL_DATA_DIR ? 'environment' : 'preferences',
  };
}

async function startLocalApi() {
  const backendEntry = process.env.CLOUDAGENT_BACKEND_ENTRY || defaultBackendEntry;
  const frontendDistDir = process.env.CLOUDAGENT_FRONTEND_DIST_DIR || defaultFrontendDistDir;
  const indexPath = path.join(frontendDistDir, 'index.html');

  if (!fs.existsSync(indexPath)) {
    throw new Error(`Frontend build not found at ${indexPath}. Run npm run build:ui first.`);
  }

  if (!process.env.OPENAI_TOKEN && process.env.OPENAI_API_KEY) {
    process.env.OPENAI_TOKEN = process.env.OPENAI_API_KEY;
  }
  if (!process.env.OPENAI_API_KEY && process.env.OPENAI_TOKEN) {
    process.env.OPENAI_API_KEY = process.env.OPENAI_TOKEN;
  }

  const backendModule = await import(pathToFileURL(backendEntry).href);
  const createApp =
    backendModule.createApp || backendModule.createDesktopApiApp || backendModule.default;
  if (typeof createApp !== 'function') {
    throw new Error(`Backend entry did not export createApp: ${backendEntry}`);
  }

  const dataDir = resolveConfiguredLocalDataDir();
  localDataDir = dataDir;

  const expressApp = await createApp({
    runtime: 'local',
    localDataDir: dataDir,
    frontendDistDir,
  });
  expressApp.set('localMcpEnabled', localMcpEnabled);
  localApiApp = expressApp;

  return new Promise((resolve, reject) => {
    const server = expressApp.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      if (!port) {
        reject(new Error('Local API did not return a listening port.'));
        return;
      }
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`,
      });
    });
    server.once('error', reject);
  });
}

ipcMain.handle('cloudagent:get-local-runtime-info', async () => ({
  mode: 'local',
  apiBaseUrl: localApiBaseUrl,
  ...buildLocalDirectoryInfo(),
  mcpEnabled: localMcpEnabled,
}));

ipcMain.handle('cloudagent:set-local-mcp-enabled', async (_event, enabled) => {
  localMcpEnabled = Boolean(enabled);
  localApiApp?.set?.('localMcpEnabled', localMcpEnabled);
  return {
    ok: true,
    mcpEnabled: localMcpEnabled,
  };
});

ipcMain.handle('cloudagent:set-local-data-dir', async (_event, requestedDir) => {
  const nextLocalDataDir = normalizeLocalDataDir(requestedDir);
  writeDesktopSettings({ localDataDir: nextLocalDataDir });
  fs.mkdirSync(nextLocalDataDir, { recursive: true });
  return {
    ok: true,
    warning: process.env.CLOUDAGENT_LOCAL_DATA_DIR
      ? 'CLOUDAGENT_LOCAL_DATA_DIR is set for this launch and overrides the saved preference until you restart without it.'
      : null,
    ...buildLocalDirectoryInfo(),
  };
});

ipcMain.handle('cloudagent:open-local-data-dir', async () => {
  if (!localDataDir) {
    return { ok: false, error: 'Local data folder is not available yet.' };
  }
  fs.mkdirSync(localDataDir, { recursive: true });
  const errorMessage = await shell.openPath(localDataDir);
  return {
    ok: !errorMessage,
    error: errorMessage || null,
    ...buildLocalDirectoryInfo(),
  };
});

ipcMain.handle('cloudagent:restart-app', async () => {
  delete process.env.CLOUDAGENT_LOCAL_DATA_DIR;
  app.relaunch();
  app.exit(0);
  return { ok: true };
});

ipcMain.handle('cloudagent:browse-directory', async (_event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: options.title || 'Select Directory',
    defaultPath: options.defaultPath || app.getPath('home'),
    buttonLabel: options.buttonLabel || 'Select',
  });
  if (result.canceled || !result.filePaths?.length) {
    return { ok: false, canceled: true };
  }
  return { ok: true, path: result.filePaths[0] };
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    title: 'CloudAgent',
    webPreferences: {
      preload: path.join(currentDir, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (localApiBaseUrl && !url.startsWith(localApiBaseUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.loadURL(`${localApiBaseUrl}/dashboard/cloudagent`);

  if (process.env.CLOUDAGENT_OPEN_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

async function boot() {
  try {
    const localApi = await startLocalApi();
    localApiServer = localApi.server;
    localApiBaseUrl = localApi.baseUrl;
    createWindow();
  } catch (error) {
    dialog.showErrorBox(
      'CloudAgent failed to start',
      error?.message || 'The local runtime could not be started.'
    );
    app.quit();
  }
}

app.whenReady().then(boot);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && localApiBaseUrl) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (localApiApp?.locals?.localWorkflowScheduler) {
    localApiApp.locals.localWorkflowScheduler.stop();
    localApiApp.locals.localWorkflowScheduler = null;
  }
  if (localApiServer) {
    localApiServer.close();
    localApiServer = null;
  }
});
