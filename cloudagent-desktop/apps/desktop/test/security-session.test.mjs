import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeDesktopRequest } from '../src/main/security-session.mjs';
import { defaultDesktopSettingsPath } from '../src/main/security-settings.mjs';
import { loadDesktopSettings } from '../src/main/desktop-identity.mjs';
import path from 'node:path';

test('desktop IPC checks both the renderer identity and its authenticated session', async () => {
  const baseUrl = 'http://127.0.0.1:1234';
  const webContents = { session: { cookies: { get: async () => [{ name: 'cloudagent_api_token', value: 'valid-session' }] } } };
  const event = { sender: webContents, senderFrame: { url: `${baseUrl}/dashboard/preferences` } };
  const auth = { authenticated: (req) => req.headers.cookie === 'cloudagent_api_token=valid-session' };
  await authorizeDesktopRequest({ event, webContents, baseUrl, auth });
  await assert.rejects(authorizeDesktopRequest({ event, webContents, baseUrl, auth: { authenticated: () => false } }), /Unlock/);
  await assert.rejects(authorizeDesktopRequest({ event: { ...event, sender: {} }, webContents, baseUrl, auth }), /Untrusted/);
  await assert.rejects(authorizeDesktopRequest({ event: { ...event, senderFrame: { url: 'https://evil.example' } }, webContents, baseUrl, auth }), /Untrusted/);
});

test('standalone launches resolve the canonical desktop security settings on each OS', () => {
  assert.equal(defaultDesktopSettingsPath({ platform: 'darwin', home: '/Users/test', env: {}, pathApi: path.posix }), '/Users/test/Library/Application Support/CloudAgent Console/desktop-settings.json');
  assert.equal(defaultDesktopSettingsPath({ platform: 'win32', home: 'C:\\Users\\test', env: { APPDATA: 'C:\\Users\\test\\AppData\\Roaming' }, pathApi: path.win32 }), 'C:\\Users\\test\\AppData\\Roaming\\CloudAgent Console\\desktop-settings.json');
  assert.equal(defaultDesktopSettingsPath({ platform: 'linux', home: '/home/test', env: {}, pathApi: path.posix }), '/home/test/.config/CloudAgent Console/desktop-settings.json');
  assert.equal(defaultDesktopSettingsPath({ platform: 'linux', home: '/home/test', env: { XDG_CONFIG_HOME: '/custom/config' }, pathApi: path.posix }), '/custom/config/CloudAgent Console/desktop-settings.json');
});

test('a corrupted canonical pointer fails closed and a missing pointer uses defaults', () => {
  assert.throws(() => loadDesktopSettings({ pointerPath: 'canonical',
    readText: (file) => file === 'canonical' ? '{broken' : '{"security":{"enabled":false}}' }), /Cannot read desktop settings/);
  assert.deepEqual(loadDesktopSettings({ pointerPath: 'missing',
    readText: () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); } }), {});
});
