import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveLoopbackListenHost } from '../src/index.mjs';

test('standalone API accepts only loopback listen hosts', () => {
  assert.equal(resolveLoopbackListenHost('127.0.0.1'), '127.0.0.1');
  assert.equal(resolveLoopbackListenHost('LOCALHOST'), 'localhost');
  assert.equal(resolveLoopbackListenHost('::1'), '::1');

  assert.throws(() => resolveLoopbackListenHost('0.0.0.0'), /loopback host/);
  assert.throws(() => resolveLoopbackListenHost('::'), /loopback host/);
  assert.throws(() => resolveLoopbackListenHost('example.com'), /loopback host/);
});
