import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createDesktopPreferencesStore, normalizeMcpPreference } from '../src/main/security-settings.mjs';
import { JsonFileStore } from '@cloudagent/storage';
import { hashPassword } from '@cloudagent/platform/password';

const writeJson = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)); };
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const security = { enabled: true, password: { version: 1, algorithm: 'scrypt', N: 131072, r: 8, p: 1, salt: 'a'.repeat(64), hash: 'b'.repeat(64) } };

function fixture(t) {
  const root = fs.mkdtempSync(path.join(process.cwd(), 'cloudagent-preferences-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const pointer = path.join(root, 'app', 'desktop-settings.json');
  const dataDir = path.join(root, 'data');
  const settingsFile = path.join(dataDir, 'settings.json');
  const options = { pointerPath: pointer, defaultDataDir: dataDir };
  return { root, pointer, dataDir, settingsFile, options };
}

test('settings.json alone supplies desktop preferences and existing workspace fields remain unchanged', async (t) => {
  const { pointer, dataDir, settingsFile, options } = fixture(t);
  const desktop = { localMcpEnabled: false, security, customDesktopPreference: 'preserve' };
  const workspace = { schemaVersion: 41, settings: '{"theme":"existing"}', llmApiKey: 'existing-test-key', customField: { keep: true }, desktop };
  writeJson(settingsFile, workspace);
  writeJson(pointer, { localDataDir: dataDir, localMcpEnabled: true, security: { enabled: false } });
  const snapshot = fs.readFileSync(settingsFile, 'utf8');
  assert.deepEqual(createDesktopPreferencesStore(options).read(), desktop);
  assert.deepEqual(readJson(pointer), { localDataDir: dataDir });
  await new JsonFileStore({ dataDir }).init();
  assert.equal(fs.readFileSync(settingsFile, 'utf8'), snapshot);
});

test('old canonical preferences are ignored when settings.json has no desktop section', (t) => {
  const { pointer, dataDir, settingsFile, options } = fixture(t);
  writeJson(pointer, { localDataDir: dataDir, localMcpEnabled: false, security: { enabled: true } });
  const workspace = { settings: '{"theme":"existing"}', customField: 'keep' };
  writeJson(settingsFile, workspace);
  const preferences = createDesktopPreferencesStore(options);
  assert.deepEqual(preferences.read(), {});
  assert.equal(preferences.securitySettingsStore.read(), undefined);
  assert.equal(normalizeMcpPreference(preferences.read().localMcpEnabled), true);
  assert.deepEqual(readJson(settingsFile), workspace);
});

test('old Electron and package paths are ignored and a fresh installation uses defaults', (t) => {
  const { root, pointer, dataDir, settingsFile, options } = fixture(t);
  for (const directory of ['Electron', '@cloudagent/desktop-shell']) {
    const file = path.join(root, directory, 'desktop-settings.json');
    const original = { localDataDir: path.join(root, 'old-data'), localMcpEnabled: false, security };
    writeJson(file, original);
  }
  const preferences = createDesktopPreferencesStore(options);
  assert.equal(preferences.dataDir, dataDir);
  assert.equal(preferences.securitySettingsStore.read(), undefined);
  assert.equal(normalizeMcpPreference(preferences.read().localMcpEnabled), true);
  assert.deepEqual(readJson(pointer), { localDataDir: dataDir });
  assert.deepEqual(readJson(settingsFile).desktop, {});
  assert.equal(readJson(settingsFile).userId, 'local-user');
});

test('damaged destination settings fail closed without stripping the original password or changing its pointer', (t) => {
  const { pointer, dataDir, settingsFile, options } = fixture(t);
  const original = { localDataDir: dataDir, localMcpEnabled: false, security };
  writeJson(pointer, original);
  fs.mkdirSync(dataDir);
  fs.writeFileSync(settingsFile, '{damaged');
  assert.throws(() => createDesktopPreferencesStore(options), /Cannot read workspace settings/);
  assert.deepEqual(readJson(pointer), original);
  writeJson(settingsFile, { desktop: { security: { enabled: true } } });
  assert.throws(() => createDesktopPreferencesStore(options), /damaged/);
  assert.deepEqual(readJson(pointer), original);
});

test('missing settings.json at startup creates default preferences even when the pointer previously had a password', (t) => {
  const { pointer, dataDir, settingsFile, options } = fixture(t);
  writeJson(pointer, { localDataDir: dataDir, localMcpEnabled: false, security });
  const preferences = createDesktopPreferencesStore(options);
  assert.deepEqual(preferences.read(), {});
  fs.rmSync(settingsFile);
  assert.throws(() => preferences.write({ localMcpEnabled: false }), /missing/);
  const restarted = createDesktopPreferencesStore(options);
  assert.equal(restarted.securitySettingsStore.read(), undefined);
  assert.equal(normalizeMcpPreference(restarted.read().localMcpEnabled), true);
});

test('directory changes carry protection and MCP preferences while preserving destination workspace configuration', (t) => {
  const { root, pointer, dataDir, settingsFile, options } = fixture(t);
  writeJson(pointer, { localDataDir: dataDir });
  writeJson(settingsFile, { settings: '{}', desktop: { localMcpEnabled: false, security } });
  const preferences = createDesktopPreferencesStore(options);
  const destination = path.join(root, 'other-data');
  const targetSettings = path.join(destination, 'settings.json');
  writeJson(targetSettings, { settings: '{"theme":"target"}', llmApiKey: 'target-test-key', desktop: { extra: 'keep' } });
  preferences.selectDataDir(destination);
  assert.deepEqual(readJson(pointer), { localDataDir: destination });
  assert.equal(preferences.dataDir, dataDir);
  assert.equal(preferences.configuredDataDir(), destination);
  assert.deepEqual(readJson(targetSettings).desktop, { extra: 'keep', localMcpEnabled: false, security });
  assert.equal(readJson(targetSettings).llmApiKey, 'target-test-key');
  assert.equal(readJson(targetSettings).settings, '{"theme":"target"}');
  assert.deepEqual(readJson(settingsFile).desktop.security, security);
  assert.equal(preferences.securitySettingsStore.pendingRestart, true);
  assert.throws(() => preferences.securitySettingsStore.write({ enabled: false }), /Restart/);
  assert.throws(() => preferences.write({ localMcpEnabled: true }), /Restart/);
  const relaunched = createDesktopPreferencesStore(options);
  assert.equal(relaunched.dataDir, destination);
  assert.deepEqual(relaunched.securitySettingsStore.read(), security);
  assert.equal(relaunched.read().localMcpEnabled, false);
  // Cancelling a pending change returns to the original folder without a restart.
  preferences.selectDataDir(dataDir);
  assert.equal(preferences.securitySettingsStore.pendingRestart, false);
});

test('failed folder changes preserve the pointer and never overwrite another workspace password', (t) => {
  const { root, pointer, dataDir, options } = fixture(t);
  const preferences = createDesktopPreferencesStore(options);
  const destination = path.join(root, 'protected');
  writeJson(path.join(destination, 'settings.json'), { desktop: { security } });
  assert.throws(() => preferences.selectDataDir(destination), /different password/);
  assert.deepEqual(readJson(pointer), { localDataDir: dataDir });
  assert.deepEqual(readJson(path.join(destination, 'settings.json')).desktop.security, security);
  fs.writeFileSync(path.join(destination, 'settings.json'), '{corrupt');
  assert.throws(() => preferences.selectDataDir(destination), /Cannot read workspace settings/);
  assert.deepEqual(readJson(pointer), { localDataDir: dataDir });
});

test('API settings saves and desktop/security saves preserve each other in their shared process', async (t) => {
  const { pointer, dataDir, settingsFile, options } = fixture(t);
  writeJson(pointer, { localDataDir: dataDir });
  writeJson(settingsFile, { settings: '{}', desktop: { localMcpEnabled: false, security } });
  const preferences = createDesktopPreferencesStore(options);
  const store = await new JsonFileStore({ dataDir }).init();
  const apiSave = store.updateSettings({ llmApiKey: 'updated-test-key', settings: '{"theme":"updated"}' });
  preferences.write({ localMcpEnabled: true });
  await apiSave;
  const record = readJson(settingsFile);
  assert.equal(record.llmApiKey, 'updated-test-key');
  assert.equal(record.settings, '{"theme":"updated"}');
  assert.equal(record.desktop.localMcpEnabled, true);
  assert.deepEqual(record.desktop.security, security);
  const password = await hashPassword('a local password');
  await Promise.all([store.updateSettings({ llmModel: 'test-model' }), preferences.securitySettingsStore.write({ enabled: true, password })]);
  assert.equal(readJson(settingsFile).llmModel, 'test-model');
  assert.deepEqual(readJson(settingsFile).desktop.security.password, password);
});
