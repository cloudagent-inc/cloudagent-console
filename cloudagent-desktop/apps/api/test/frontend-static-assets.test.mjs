import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { createDesktopApiApp } from '../src/index.mjs';

test('serves the current UI shell without caching and returns plain 404s for stale assets', async (t) => {
  const frontendDistDir = await fs.mkdtemp(path.join(process.cwd(), 'cloudagent-ui-assets-test-'));
  await fs.mkdir(path.join(frontendDistDir, 'assets'), { recursive: true });
  await fs.writeFile(
    path.join(frontendDistDir, 'index.html'),
    '<!doctype html><html><body><div id="root"></div></body></html>'
  );
  await fs.writeFile(path.join(frontendDistDir, 'assets', 'current.js'), 'export default true;');

  const app = await createDesktopApiApp({
    frontendDistDir,
    apiToken: 'frontend-assets-test-token',
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(frontendDistDir, { recursive: true, force: true });
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const shellResponse = await fetch(`${baseUrl}/dashboard/cost`);
  assert.equal(shellResponse.status, 200);
  assert.equal(shellResponse.headers.get('cache-control'), 'no-store');
  assert.match(shellResponse.headers.get('set-cookie') || '', /cloudagent_api_token=/);
  assert.match(
    shellResponse.headers.get('content-security-policy') || '',
    /script-src 'self'/
  );
  assert.equal(shellResponse.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(shellResponse.headers.get('x-frame-options'), 'DENY');
  assert.equal(shellResponse.headers.has('x-powered-by'), false);

  const currentAssetResponse = await fetch(`${baseUrl}/assets/current.js`);
  assert.equal(currentAssetResponse.status, 200);
  assert.match(currentAssetResponse.headers.get('content-type') || '', /javascript/);

  const staleAssetResponse = await fetch(`${baseUrl}/assets/CostDashboard-old.js`);
  assert.equal(staleAssetResponse.status, 404);
  assert.equal(staleAssetResponse.headers.get('cache-control'), 'no-store');
  assert.match(staleAssetResponse.headers.get('content-type') || '', /^text\/plain/);
  assert.doesNotMatch(await staleAssetResponse.text(), /<!doctype html>/i);
});
