import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildCanonicalUserDataDir, loadDesktopSettings } from './desktop-identity.mjs';
import { buildDefaultLocalDataDir } from './local-data-paths.mjs';
import { readWorkspaceSettings, updateWorkspaceSettings, writeSettingsFile } from '@cloudagent/storage/workspace-settings';
import { validatePasswordRecord } from '@cloudagent/platform/password';

export function defaultDesktopSettingsPath({ platform = process.platform, home = os.homedir(), env = process.env, pathApi = path } = {}) {
  const appData = platform === 'darwin'
    ? pathApi.join(home, 'Library', 'Application Support')
    : platform === 'win32'
      ? env.APPDATA || pathApi.join(home, 'AppData', 'Roaming')
      : env.XDG_CONFIG_HOME || pathApi.join(home, '.config');
  return pathApi.join(buildCanonicalUserDataDir(appData, pathApi), 'desktop-settings.json');
}

export function normalizeMcpPreference(value, fallback = true) {
  if (value === true || value === false) return value;
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizeDataDir(value, fallback, home) {
  if (value !== undefined && typeof value !== 'string') throw new Error('Invalid local data directory pointer.');
  const raw = value?.trim() || fallback;
  return path.resolve(raw.replace(/^~(?=$|[\\/])/, home));
}

function validateDesktopPreferences(desktop = {}) {
  if (!desktop || typeof desktop !== 'object' || Array.isArray(desktop)) throw new Error('Invalid desktop preferences in settings.json.');
  if (desktop.security !== undefined) {
    if (!desktop.security || typeof desktop.security.enabled !== 'boolean') throw new Error('Invalid password settings in settings.json.');
    if (desktop.security.enabled) validatePasswordRecord(desktop.security.password);
  }
  return desktop;
}

export function createSecuritySettingsStore(dataDir) {
  if (!dataDir) return createDesktopPreferencesStore().securitySettingsStore;
  return {
    read: () => validateDesktopPreferences(readWorkspaceSettings(dataDir)?.desktop).security,
    write: (security) => updateWorkspaceSettings(dataDir, (record) => ({
      desktop: validateDesktopPreferences({ ...validateDesktopPreferences(record.desktop), security }),
    })),
  };
}

// Resolve the canonical pointer before authentication or workspace services.
// Preferences come exclusively from the selected folder's settings.json.
export function createDesktopPreferencesStore({
  pointerPath = defaultDesktopSettingsPath(),
  defaultDataDir = buildDefaultLocalDataDir(os.homedir()),
  home = os.homedir(),
} = {}) {
  const readPointer = () => loadDesktopSettings({ pointerPath,
    readText: (file) => fs.readFileSync(file, 'utf8') });
  const initial = readPointer();
  const dataDir = normalizeDataDir(initial.localDataDir, defaultDataDir, home);
  const existing = readWorkspaceSettings(dataDir);
  validateDesktopPreferences(existing?.desktop);
  if (!existing) updateWorkspaceSettings(dataDir, { desktop: {} });
  const pointer = { localDataDir: dataDir };
  writeSettingsFile(pointerPath, pointer);
  const configuredDataDir = () => normalizeDataDir(readPointer().localDataDir, defaultDataDir, home);
  const read = () => {
    const record = readWorkspaceSettings(dataDir);
    if (!record) throw new Error('Workspace settings are missing. Restore settings.json from a backup.');
    return validateDesktopPreferences(record.desktop);
  };
  const write = (patch) => {
    if (configuredDataDir() !== dataDir) {
      throw Object.assign(new Error('Restart CloudAgent before changing desktop or security preferences in the new data folder.'), { status: 409 });
    }
    read(); // Never recreate a missing protected workspace through a preference save.
    return updateWorkspaceSettings(dataDir, (record) => ({ desktop: validateDesktopPreferences({
      ...validateDesktopPreferences(record.desktop), ...patch,
    }) })).desktop;
  };
  return {
    dataDir,
    configuredDataDir,
    read,
    write,
    securitySettingsStore: {
      read: () => read().security,
      write: (security) => write({ security }),
      get pendingRestart() { return configuredDataDir() !== dataDir; },
    },
    selectDataDir(value) {
      const destination = normalizeDataDir(value, defaultDataDir, home);
      if (destination !== dataDir) {
        const source = read();
        updateWorkspaceSettings(destination, (record) => {
          const target = validateDesktopPreferences(record.desktop);
          if (target.security?.enabled && JSON.stringify(target.security) !== JSON.stringify(source.security)) {
            throw new Error('The selected folder has different password protection. Choose a different folder or use its existing configuration.');
          }
          return { desktop: validateDesktopPreferences({ ...target, ...source,
            security: source.security || { enabled: false },
          }) };
        });
      }
      writeSettingsFile(pointerPath, { localDataDir: destination });
      return destination;
    },
  };
}
