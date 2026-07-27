import path from 'node:path';

export const DESKTOP_APP_NAME = 'CloudAgent Console';

export function buildCanonicalUserDataDir(appDataDir, pathApi = path) {
  return pathApi.join(String(appDataDir || ''), DESKTOP_APP_NAME);
}

export function buildDesktopSettingsCandidatePaths({
  canonicalUserDataDir,
  legacyUserDataDir,
  legacyUserDataDirs = [],
  pathApi = path,
} = {}) {
  const canonicalPath = pathApi.join(
    String(canonicalUserDataDir || ''),
    'desktop-settings.json',
  );
  const candidates = [canonicalPath];
  for (const legacyDir of [legacyUserDataDir, ...legacyUserDataDirs]) {
    if (!legacyDir) continue;
    const legacyPath = pathApi.join(String(legacyDir), 'desktop-settings.json');
    if (!candidates.includes(legacyPath)) candidates.push(legacyPath);
  }
  return candidates;
}

export function loadDesktopSettings({
  candidatePaths = [],
  readText,
  migrateText = null,
} = {}) {
  for (const [index, candidatePath] of candidatePaths.entries()) {
    try {
      const raw = readText(candidatePath);
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      if (index > 0 && typeof migrateText === 'function') {
        migrateText(raw, candidatePath, candidatePaths[0]);
      }
      return parsed;
    } catch {}
  }
  return {};
}
