import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { hashPassword, verifyPassword } from '@cloudagent/platform/password';
import { createDesktopApiApp } from '../src/index.mjs';
import { createLocalAuth } from '../src/lib/local-auth.mjs';
import { createSecuritySettingsStore, createDesktopPreferencesStore } from '../../desktop/src/main/security-settings.mjs';
import { buildLocalMcpUrl } from '../src/modules/agent-runs/agent-run-service.mjs';

const PASSWORD = 'a long local password';
const cookieFrom = (response) => response.headers.get('set-cookie')?.split(';')[0];
function memorySettings(initial) {
  let security = initial;
  return { read: () => security, write: (next) => { security = next; } };
}

async function launch(t, securitySettingsStore, extraOptions = {}) {
  const directory = await fs.mkdtemp(path.join(process.cwd(), 'cloudagent-auth-test-'));
  const frontendDistDir = path.join(directory, 'ui');
  await fs.mkdir(frontendDistDir);
  await fs.writeFile(path.join(frontendDistDir, 'index.html'), '<!doctype html><div id="root"></div>');
  const app = await createDesktopApiApp({ securitySettingsStore, frontendDistDir, localDataDir: path.join(directory, 'data'), apiToken: 'script-token', ...extraOptions });
  const server = app.listen(0, '127.0.0.1');
  t.after(async () => {
    app.locals.localWorkflowScheduler?.stop();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  });
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (url, { cookie, body, method, headers = {} } = {}) => fetch(`${base}${url}`, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { app, request, base };
}

test('password records use salted scrypt and reject damaged or unsupported records', async () => {
  const first = await hashPassword(PASSWORD);
  const second = await hashPassword(PASSWORD);
  assert.notEqual(first.hash, second.hash);
  assert.notEqual(first.salt, second.salt);
  assert.equal(await verifyPassword(PASSWORD, first), true);
  assert.equal(await verifyPassword('wrong', first), false);
  await assert.rejects(hashPassword('short'), /12 characters/);
  await assert.rejects(verifyPassword(PASSWORD, { ...first, N: 1 }), /damaged/);
  assert.throws(() => createLocalAuth({ settingsStore: memorySettings({ enabled: true }) }), /damaged/);
  assert.throws(() => createLocalAuth({ settingsStore: memorySettings(null) }), /Invalid password/);
});

test('locked launch protects API and MCP; each browser must unlock and credentials stay separate', async (t) => {
  const settings = memorySettings({ enabled: true, password: await hashPassword(PASSWORD) });
  const { app, request, base } = await launch(t, settings);
  assert.equal(app.get('localStore'), undefined);
  const shell = await request('/dashboard/preferences');
  assert.equal(shell.status, 200);
  assert.equal(shell.headers.get('set-cookie'), null);
  const status = await request('/auth/status');
  assert.deepEqual(await status.json(), { ok: true, enabled: true, authenticated: false });
  assert.equal(status.headers.get('set-cookie'), null);
  for (const url of ['/local/llm/settings', `/mcp?token=${app.get('mcpToken')}`]) {
    assert.equal((await request(url, { headers: { Authorization: 'Bearer script-token' } })).status, 401);
  }
  const priorDevNoAuth = process.env.CLOUDAGENT_DEV_NO_AUTH;
  process.env.CLOUDAGENT_DEV_NO_AUTH = '1';
  assert.equal((await request('/local/llm/settings')).status, 401);
  if (priorDevNoAuth === undefined) delete process.env.CLOUDAGENT_DEV_NO_AUTH;
  else process.env.CLOUDAGENT_DEV_NO_AUTH = priorDevNoAuth;
  assert.equal((await request('/auth/login', { body: { password: PASSWORD }, headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal(app.locals.localWorkflowScheduler, undefined);
  const login = await request('/auth/login', { body: { password: PASSWORD }, headers: { Origin: base } });
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  const firstCookie = cookieFrom(login);
  assert.ok(app.get('localStore'));
  assert.ok(app.locals.localWorkflowScheduler);
  assert.equal((await request('/local/llm/settings', { cookie: firstCookie })).status, 200);
  assert.equal((await request('/local/llm/settings')).status, 401);
  assert.equal((await request('/local/llm/settings', { headers: { Authorization: 'Bearer script-token' } })).status, 401);
  assert.equal((await request('/local/llm/settings', { headers: { Authorization: `Bearer ${app.get('mcpToken')}` } })).status, 401);
  assert.equal((await request('/mcp', { cookie: firstCookie })).status, 401);
  assert.equal((await request('/MCP', { cookie: firstCookie })).status, 401);
  app.set('localMcpEnabled', false);
  assert.equal((await request('/mcp', { headers: { Authorization: `Bearer ${app.get('mcpToken')}` } })).status, 503);
  assert.equal((await request(`/mcp?token=${app.get('mcpToken')}`)).status, 503);
  assert.equal((await request(`/MCP?token=${app.get('mcpToken')}`)).status, 503);
  const mcpInfo = await request('/auth/mcp', { cookie: firstCookie });
  assert.equal((await mcpInfo.json()).mcpUrl, `${base}/mcp?token=${app.get('mcpToken')}`);
  const secondLogin = await request('/auth/login', { body: { password: PASSWORD } });
  assert.equal(secondLogin.status, 200);
  const secondCookie = cookieFrom(secondLogin);
  assert.notEqual(firstCookie, secondCookie);
  assert.equal((await request('/auth/security', { cookie: secondCookie })).status, 200);
  assert.equal((await request('/auth/security', { method: 'PUT', cookie: firstCookie, body: { enabled: false, currentPassword: PASSWORD }, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  const change = await request('/auth/security', { method: 'PUT', cookie: firstCookie, body: { enabled: true, currentPassword: PASSWORD, password: 'a changed local password' } });
  assert.equal(change.status, 200);
  assert.equal((await request('/auth/security', { cookie: secondCookie })).status, 401);
  assert.equal((await request('/auth/security', { cookie: firstCookie })).status, 401);
  const currentCookie = cookieFrom(change);
  const disable = await request('/auth/security', { method: 'PUT', cookie: currentCookie, body: { enabled: false, currentPassword: 'a changed local password' } });
  assert.equal(disable.status, 200);
  assert.deepEqual(settings.read(), { enabled: false });
});

test('disabled default supports browser sessions and enabling protection persists a hash', async (t) => {
  const settings = memorySettings();
  const { request } = await launch(t, settings);
  const status = await request('/auth/status');
  assert.deepEqual(await status.json(), { ok: true, enabled: false, authenticated: true });
  const cookie = cookieFrom(status);
  assert.ok(cookie);
  assert.equal((await request('/auth/security', { method: 'PUT', body: { enabled: true, password: PASSWORD } })).status, 401);
  const enabled = await request('/auth/security', { method: 'PUT', cookie, body: { enabled: true, password: PASSWORD } });
  assert.equal(enabled.status, 200);
  assert.equal(settings.read().enabled, true);
  assert.equal(JSON.stringify(settings.read()).includes(PASSWORD), false);
  assert.equal((await request('/dashboard/cloudagent')).headers.get('set-cookie'), null);
  assert.equal((await request('/auth/status')).headers.get('set-cookie'), null);
  const relaunched = await launch(t, settings);
  assert.equal(relaunched.app.locals.localAuth.unlocked, false);
  assert.equal((await relaunched.request('/auth/security', { cookie: cookieFrom(enabled) })).status, 401);
});

test('wrong passwords are throttled, including security changes', async () => {
  let time = 0;
  const auth = createLocalAuth({ settingsStore: memorySettings({ enabled: true, password: await hashPassword(PASSWORD) }), now: () => time });
  const res = { append() {} };
  let starts = 0;
  const initialize = async () => { starts++; };
  await assert.rejects(auth.login('wrong', res, initialize), { status: 401 });
  await assert.rejects(auth.login(PASSWORD, res, initialize), { status: 429 });
  assert.equal(auth.unlocked, false);
  assert.equal(starts, 0);
  time += 1000;
  await auth.login(PASSWORD, res, initialize);
  assert.equal(starts, 1);
  await assert.rejects(auth.update({ enabled: false, currentPassword: 'wrong' }, res), { status: 401 });
  assert.equal(auth.enabled, true);
  await assert.rejects(auth.update({ enabled: false, currentPassword: PASSWORD }, res), { status: 429 });
});

test('security persistence preserves preferences, rejects corrupt files, and survives reload', async (t) => {
  const directory = await fs.mkdtemp(path.join(process.cwd(), '.cloudagent-security-settings-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const settingsPath = path.join(directory, 'settings.json');
  const store = createSecuritySettingsStore(directory);
  assert.equal(store.read(), undefined);
  await fs.writeFile(settingsPath, JSON.stringify({ settings: '{"theme":"existing"}', desktop: { localMcpEnabled: false } }));
  store.write({ enabled: true, password: await hashPassword(PASSWORD) });
  const persisted = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
  assert.equal(persisted.settings, '{"theme":"existing"}');
  assert.equal(persisted.desktop.localMcpEnabled, false);
  assert.equal(createSecuritySettingsStore(directory).read().enabled, true);
  await fs.writeFile(settingsPath, '{broken');
  assert.throws(() => store.read(), /Cannot read workspace settings/);
});

test('spawned-agent MCP URLs use the MCP credential instead of the dashboard API token', () => {
  const req = { app: { get: (key) => ({ apiToken: 'api-secret', mcpToken: 'mcp-secret' })[key] }, protocol: 'http', get: () => '127.0.0.1:1234' };
  const url = new URL(buildLocalMcpUrl(req));
  assert.equal(url.searchParams.get('token'), 'mcp-secret');
});

test('browser/standalone startup follows the folder pointer and preserves auth through API preference saves', async (t) => {
  const root = await fs.mkdtemp(path.join(process.cwd(), 'cloudagent-settings-auth-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const dataDir = path.join(root, 'chosen-data');
  const pointerPath = path.join(root, 'desktop-settings.json');
  const password = await hashPassword(PASSWORD);
  await fs.mkdir(dataDir);
  await fs.writeFile(path.join(dataDir, 'settings.json'), JSON.stringify({ settings: '{"theme":"keep"}', openaiModel: 'saved-model', desktop: { localMcpEnabled: false, security: { enabled: true, password } } }));
  await fs.writeFile(pointerPath, JSON.stringify({ localDataDir: dataDir }));
  const preferences = createDesktopPreferencesStore({ pointerPath, defaultDataDir: path.join(root, 'unused-default') });
  const { app, request } = await launch(t, undefined, { desktopPreferencesStore: preferences, localDataDir: undefined });
  assert.deepEqual(JSON.parse(await fs.readFile(pointerPath, 'utf8')), { localDataDir: dataDir });
  assert.equal(app.get('localMcpEnabled'), false);
  assert.equal((await request('/local/bootstrap')).status, 401);
  const login = await request('/auth/login', { body: { password: PASSWORD } });
  assert.equal(login.status, 200);
  const cookie = cookieFrom(login);
  assert.equal(app.get('localStore').dataDir, dataDir);
  const bootstrap = await request('/local/bootstrap', { cookie });
  const profile = await bootstrap.json();
  assert.equal(profile.settings, '{"theme":"keep"}');
  assert.equal(JSON.stringify(profile).includes(password.hash), false);
  const save = await request('/local/settings', { method: 'PATCH', cookie, body: { settings: { theme: 'changed' } } });
  assert.equal(save.status, 200);
  const persisted = JSON.parse(await fs.readFile(path.join(dataDir, 'settings.json'), 'utf8'));
  assert.equal(persisted.settings, '{"theme":"changed"}');
  assert.deepEqual(persisted.desktop.security, { enabled: true, password });
  assert.equal(persisted.desktop.localMcpEnabled, false);
  assert.equal((await request(`/mcp?token=${app.get('mcpToken')}`)).status, 503);
  const destination = path.join(root, 'next-data');
  preferences.selectDataDir(destination);
  const securityInfo = await request('/auth/security', { cookie });
  assert.equal((await securityInfo.json()).pendingRestart, true);
  const change = await request('/auth/security', { method: 'PUT', cookie, body: { enabled: false, currentPassword: PASSWORD } });
  assert.equal(change.status, 409);
  assert.equal(app.locals.localAuth.enabled, true);
  const nextPreferences = createDesktopPreferencesStore({ pointerPath });
  const relaunched = await launch(t, undefined, { desktopPreferencesStore: nextPreferences, localDataDir: undefined });
  assert.equal(relaunched.app.locals.localAuth.unlocked, false);
  assert.equal((await relaunched.request('/auth/login', { body: { password: PASSWORD } })).status, 200);
  assert.equal(relaunched.app.get('localStore').dataDir, destination);
});


test('browser/standalone startup defaults to MCP on and password off without workspace desktop preferences', async (t) => {
  const root = await fs.mkdtemp(path.join(process.cwd(), 'cloudagent-default-auth-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const dataDir = path.join(root, 'chosen-data');
  const pointerPath = path.join(root, 'desktop-settings.json');
  await fs.writeFile(pointerPath, JSON.stringify({ localDataDir: dataDir, localMcpEnabled: false, security: { enabled: true, password: 'obsolete' } }));
  const preferences = createDesktopPreferencesStore({ pointerPath });
  const { app, request } = await launch(t, undefined, { desktopPreferencesStore: preferences, localDataDir: undefined });
  assert.equal(app.get('localMcpEnabled'), true);
  assert.equal(app.locals.localAuth.enabled, false);
  assert.equal(app.locals.localAuth.unlocked, true);
  const status = await request('/auth/status');
  assert.deepEqual(await status.json(), { ok: true, enabled: false, authenticated: true });
  assert.equal((await request('/local/bootstrap', { cookie: cookieFrom(status) })).status, 200);
  const saved = JSON.parse(await fs.readFile(path.join(dataDir, 'settings.json'), 'utf8'));
  assert.deepEqual(saved.desktop, {});
});
