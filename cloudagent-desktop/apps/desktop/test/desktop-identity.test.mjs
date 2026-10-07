import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { buildCanonicalUserDataDir, loadDesktopSettings } from '../src/main/desktop-identity.mjs';

test('desktop identity uses stable application directories on macOS and Windows', () => {
  assert.equal(buildCanonicalUserDataDir('/Users/test/Library/Application Support', path.posix), '/Users/test/Library/Application Support/CloudAgent Console');
  assert.equal(buildCanonicalUserDataDir('C:\\Users\\Test\\AppData\\Roaming', path.win32), 'C:\\Users\\Test\\AppData\\Roaming\\CloudAgent Console');
});

test('the canonical file supplies only a folder pointer and ignores all old preferences', () => {
  assert.deepEqual(loadDesktopSettings({ pointerPath: '/canonical/desktop-settings.json', readText: () => JSON.stringify({ localDataDir: '/chosen/data', security: { enabled: true }, localMcpEnabled: false, updatedAt: 'old' }) }), { localDataDir: '/chosen/data' });
});

test('a missing canonical pointer reads no fallback paths', () => {
  const reads = [];
  assert.deepEqual(loadDesktopSettings({ pointerPath: '/canonical/desktop-settings.json', readText: (file) => {
    reads.push(file);
    throw Object.assign(new Error('missing'), { code: 'ENOENT' });
  } }), {});
  assert.deepEqual(reads, ['/canonical/desktop-settings.json']);
});
