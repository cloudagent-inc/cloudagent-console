import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  buildCanonicalUserDataDir,
  buildDesktopSettingsCandidatePaths,
  loadDesktopSettings,
} from '../src/main/desktop-identity.mjs';

test('desktop identity uses a stable CloudAgent Console user-data directory', () => {
  const canonicalUserDataDir = buildCanonicalUserDataDir(
    '/Users/abdul/Library/Application Support',
    path.posix,
  );
  assert.equal(
    canonicalUserDataDir,
    '/Users/abdul/Library/Application Support/CloudAgent Console',
  );
  assert.deepEqual(
    buildDesktopSettingsCandidatePaths({
      canonicalUserDataDir,
      legacyUserDataDir: '/Users/abdul/Library/Application Support/Electron',
      pathApi: path.posix,
    }),
    [
      '/Users/abdul/Library/Application Support/CloudAgent Console/desktop-settings.json',
      '/Users/abdul/Library/Application Support/Electron/desktop-settings.json',
    ],
  );
});

test('desktop identity builds the same stable directory on Windows', () => {
  assert.equal(
    buildCanonicalUserDataDir('C:\\Users\\Abdul\\AppData\\Roaming', path.win32),
    'C:\\Users\\Abdul\\AppData\\Roaming\\CloudAgent Console',
  );
});

test('desktop settings retain explicit Electron migration fallback when package metadata is already canonical', () => {
  const canonicalUserDataDir = '/Users/abdul/Library/Application Support/CloudAgent Console';
  assert.deepEqual(
    buildDesktopSettingsCandidatePaths({
      canonicalUserDataDir,
      legacyUserDataDirs: [
        canonicalUserDataDir,
        '/Users/abdul/Library/Application Support/Electron',
      ],
      pathApi: path.posix,
    }),
    [
      '/Users/abdul/Library/Application Support/CloudAgent Console/desktop-settings.json',
      '/Users/abdul/Library/Application Support/Electron/desktop-settings.json',
    ],
  );
});

test('desktop settings fall back to the legacy Electron path and migrate without deleting it', () => {
  const candidates = ['/canonical/desktop-settings.json', '/legacy/desktop-settings.json'];
  const migrated = [];
  const settings = loadDesktopSettings({
    candidatePaths: candidates,
    readText(candidatePath) {
      if (candidatePath === candidates[0]) throw new Error('not found');
      return JSON.stringify({ localDataDir: '/existing/data' });
    },
    migrateText(raw, sourcePath, destinationPath) {
      migrated.push({ raw, sourcePath, destinationPath });
    },
  });

  assert.deepEqual(settings, { localDataDir: '/existing/data' });
  assert.deepEqual(migrated, [{
    raw: JSON.stringify({ localDataDir: '/existing/data' }),
    sourcePath: candidates[1],
    destinationPath: candidates[0],
  }]);
});
