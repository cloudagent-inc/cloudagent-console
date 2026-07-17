import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isAllowedExternalUrl,
  isSameOriginUrl,
} from '../src/main/navigation-security.mjs';

test('same-origin navigation compares parsed origins instead of URL prefixes', () => {
  const localOrigin = 'http://127.0.0.1:43123';

  assert.equal(isSameOriginUrl(`${localOrigin}/dashboard/cost`, localOrigin), true);
  assert.equal(
    isSameOriginUrl('http://127.0.0.1:43123@evil.example/dashboard', localOrigin),
    false
  );
  assert.equal(isSameOriginUrl('http://127.0.0.1:43124/dashboard', localOrigin), false);
  assert.equal(isSameOriginUrl('not-a-url', localOrigin), false);
});

test('external navigation allows browser URLs and rejects executable schemes', () => {
  assert.equal(isAllowedExternalUrl('https://github.com/cloudagent-inc'), true);
  assert.equal(isAllowedExternalUrl('http://localhost/docs'), true);
  assert.equal(isAllowedExternalUrl('file:///tmp/unsafe'), false);
  assert.equal(isAllowedExternalUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedExternalUrl('data:text/html,unsafe'), false);
  assert.equal(isAllowedExternalUrl('not-a-url'), false);
});
