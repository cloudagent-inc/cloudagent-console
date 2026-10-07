import path from 'node:path';

export const DESKTOP_APP_NAME = 'CloudAgent Console';

export function buildCanonicalUserDataDir(appDataDir, pathApi = path) {
  return pathApi.join(String(appDataDir || ''), DESKTOP_APP_NAME);
}

// Read only the canonical file, and use it only as a local-data pointer.
export function loadDesktopSettings({ pointerPath, readText } = {}) {
  try {
    const parsed = JSON.parse(readText(pointerPath));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Invalid local data directory pointer.');
    }
    return parsed.localDataDir === undefined ? {} : { localDataDir: parsed.localDataDir };
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`Cannot read desktop settings at ${pointerPath}. Restore the file from a backup.`, { cause: error });
  }
}
