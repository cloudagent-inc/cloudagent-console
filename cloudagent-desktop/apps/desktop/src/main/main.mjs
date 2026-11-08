import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  DESKTOP_APP_NAME,
  buildCanonicalUserDataDir,
} from './desktop-identity.mjs';
import { buildDefaultLocalDataDir } from './local-data-paths.mjs';
import { createDesktopPreferencesStore, normalizeMcpPreference } from './security-settings.mjs';
import { isAllowedExternalUrl, isSameOriginUrl } from './navigation-security.mjs';
import { authorizeDesktopRequest } from './security-session.mjs';

const appDataDir = app.getPath('appData');
const canonicalUserDataDir = buildCanonicalUserDataDir(appDataDir);
app.setName(DESKTOP_APP_NAME);
app.setPath('userData', canonicalUserDataDir);

const desktopSettingsPointerPath = path.join(canonicalUserDataDir, 'desktop-settings.json');

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, '../../../..');
const defaultBackendEntry = path.resolve(workspaceRoot, 'apps/api/src/index.mjs');
const defaultFrontendDistDir = path.resolve(workspaceRoot, 'apps/ui/dist');

let mainWindow = null;
let localApiServer = null;
let localApiBaseUrl = null;
let localApiApp = null;
let localApiToken = null;
let localDataDir = null;
let localMcpEnabled = true;

let desktopPreferences = null;

function getDesktopPreferences() {
  desktopPreferences ||= createDesktopPreferencesStore({
    pointerPath: desktopSettingsPointerPath,
    defaultDataDir: buildDefaultLocalDataDir(app.getPath('home')),
    home: app.getPath('home'),
  });
  return desktopPreferences;
}

function readDesktopSettings() {
  return getDesktopPreferences().read();
}

function writeDesktopSettings(patch = {}) {
  return getDesktopPreferences().write(patch);
}

function resolveSavedLocalDataDir() {
  return getDesktopPreferences().configuredDataDir();
}

function resolveSavedLocalMcpEnabled() {
  const settings = readDesktopSettings();
  return normalizeMcpPreference(settings.localMcpEnabled, true);
}

function resolveConfiguredLocalMcpEnabled() {
  if (process.env.CLOUDAGENT_LOCAL_MCP_ENABLED !== undefined) {
    return normalizeMcpPreference(process.env.CLOUDAGENT_LOCAL_MCP_ENABLED, true);
  }
  return resolveSavedLocalMcpEnabled();
}

function buildLocalDirectoryInfo() {
  const configuredLocalDataDir = resolveSavedLocalDataDir();
  const activeLocalDataDir = localDataDir || configuredLocalDataDir;
  if (!localDataDir) {
    return {
      localDataDir: activeLocalDataDir,
      configuredLocalDataDir,
      activeLocalDataDir: '',
      localDataDirPendingRestart: false,
      localDataDirSource: 'preferences',
    };
  }
  return {
    localDataDir,
    configuredLocalDataDir,
    activeLocalDataDir: localDataDir,
    localDataDirPendingRestart: configuredLocalDataDir !== localDataDir,
    localDataDirSource: 'preferences',
  };
}

async function startLocalApi() {
  localMcpEnabled = resolveConfiguredLocalMcpEnabled();
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

  const dataDir = resolveSavedLocalDataDir();
  localDataDir = dataDir;

  // Retain the API scripting token for unprotected development launches.
  // Dashboard sessions and the MCP token are independently issued by the API.
  localApiToken = process.env.CLOUDAGENT_API_TOKEN || crypto.randomBytes(32).toString('hex');

  const expressApp = await createApp({
    runtime: 'local',
    localDataDir: dataDir,
    frontendDistDir,
    apiToken: localApiToken,
    desktopPreferencesStore: getDesktopPreferences(),
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

function buildDisplayMcpUrl() {
  if (!localApiBaseUrl) return null;
  const base = `${localApiBaseUrl}/mcp`;
  const mcpToken = localApiApp?.get('mcpToken');
  return mcpToken ? `${base}?token=${encodeURIComponent(mcpToken)}` : base;
}

// A locked renderer must not obtain credentials or mutate preferences through IPC.
function authenticatedHandle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    await authorizeDesktopRequest({ event, webContents: mainWindow?.webContents,
      baseUrl: localApiBaseUrl, auth: localApiApp?.locals.localAuth });
    return handler(event, ...args);
  });
}

ipcMain.handle('cloudagent:quit-app', (event) => {
  if (event.sender === mainWindow?.webContents && isSameOriginUrl(event.senderFrame?.url, localApiBaseUrl)) app.quit();
});

authenticatedHandle('cloudagent:get-local-runtime-info', async () => ({
  mode: 'local',
  apiBaseUrl: localApiBaseUrl,
  mcpUrl: buildDisplayMcpUrl(),
  ...buildLocalDirectoryInfo(),
  mcpEnabled: localMcpEnabled,
  configuredMcpEnabled: resolveSavedLocalMcpEnabled(),
  mcpEnabledSource: process.env.CLOUDAGENT_LOCAL_MCP_ENABLED ? 'environment' : 'preferences',
}));

authenticatedHandle('cloudagent:set-local-mcp-enabled', async (_event, enabled) => {
  writeDesktopSettings({ localMcpEnabled: Boolean(enabled) });
  localMcpEnabled = Boolean(enabled);
  localApiApp?.set?.('localMcpEnabled', localMcpEnabled);
  return {
    ok: true,
    mcpEnabled: localMcpEnabled,
    configuredMcpEnabled: resolveSavedLocalMcpEnabled(),
    mcpEnabledSource: process.env.CLOUDAGENT_LOCAL_MCP_ENABLED ? 'environment' : 'preferences',
  };
});

authenticatedHandle('cloudagent:set-local-data-dir', async (_event, requestedDir) => {
  getDesktopPreferences().selectDataDir(requestedDir);
  return {
    ok: true,
    ...buildLocalDirectoryInfo(),
  };
});

authenticatedHandle('cloudagent:open-local-data-dir', async () => {
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

authenticatedHandle('cloudagent:restart-app', async () => {
  app.relaunch();
  app.exit(0);
  return { ok: true };
});

authenticatedHandle('cloudagent:browse-directory', async (_event, options = {}) => {
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
  const iconPath = path.resolve(workspaceRoot, 'apps/desktop/build/icon.png');
  
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    title: DESKTOP_APP_NAME,
    icon: iconPath,
    webPreferences: {
      preload: path.join(currentDir, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
    mainWindow?.setTitle(DESKTOP_APP_NAME);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isSameOriginUrl(url, localApiBaseUrl) && isAllowedExternalUrl(url)) {
      void shell.openExternal(url).catch((error) => {
        console.error('[EXTERNAL_LINK_ERROR]', error);
      });
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isSameOriginUrl(url, localApiBaseUrl)) {
      event.preventDefault();
      if (isAllowedExternalUrl(url)) {
        void shell.openExternal(url).catch((error) => {
          console.error('[EXTERNAL_LINK_ERROR]', error);
        });
      }
    }
  });

  mainWindow.loadURL(`${localApiBaseUrl}/dashboard/cloudagent`);

  if (process.env.CLOUDAGENT_OPEN_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

async function boot() {
  // Set dock icon on macOS
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = path.resolve(workspaceRoot, 'apps/desktop/build/icon.png');
    if (fs.existsSync(iconPath)) {
      app.dock.setIcon(iconPath);
    }
  }
  
  try {
    localMcpEnabled = resolveConfiguredLocalMcpEnabled();
    const localApi = await startLocalApi();
    localApiServer = localApi.server;
    localApiBaseUrl = localApi.baseUrl;
    createWindow();
  } catch (error) {
    dialog.showErrorBox(
      'CloudAgent Console failed to start',
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
