import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { buildDefaultLocalDataDir } from '../src/main/local-data-paths.mjs';

test('default local data directory is durable and home-relative on POSIX', () => {
  assert.equal(
    buildDefaultLocalDataDir('/Users/abdul', path.posix),
    '/Users/abdul/.cloudagent/local-data'
  );
});

test('default local data directory is durable and home-relative on Windows', () => {
  assert.equal(
    buildDefaultLocalDataDir('C:\\Users\\Abdul', path.win32),
    'C:\\Users\\Abdul\\.cloudagent\\local-data'
  );
});
