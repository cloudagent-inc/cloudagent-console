import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isStaleAssetError,
  reloadForFreshAssets,
} from '../src/lib/staleAssetRecovery.js';

test('recognizes stale Vite chunks and failed asset elements', () => {
  assert.equal(
    isStaleAssetError({
      payload: new TypeError(
        'Failed to fetch dynamically imported module: http://127.0.0.1/assets/CostDashboard-old.js'
      ),
    }),
    true
  );
  assert.equal(
    isStaleAssetError({ target: { href: 'http://127.0.0.1/assets/index-old.css' } }),
    true
  );
  assert.equal(isStaleAssetError(new Error('Cost API request failed')), false);
});

test('reloads only once inside the stale-asset recovery window', () => {
  const values = new Map();
  let reloadCount = 0;
  const windowObject = {
    location: {
      reload() {
        reloadCount += 1;
      },
    },
    sessionStorage: {
      getItem(key) {
        return values.get(key) || null;
      },
      setItem(key, value) {
        values.set(key, value);
      },
    },
  };

  assert.equal(reloadForFreshAssets(windowObject, 100_000), true);
  assert.equal(reloadForFreshAssets(windowObject, 100_100), false);
  assert.equal(reloadCount, 1);
  assert.equal(reloadForFreshAssets(windowObject, 116_000), true);
  assert.equal(reloadCount, 2);
});

