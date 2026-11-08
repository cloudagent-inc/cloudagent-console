import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function readWorkspaceSettings(dataDir) {
  const file = path.join(dataDir, 'settings.json');
  try {
    const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('Expected an object.');
    return settings;
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw new Error(`Cannot read workspace settings at ${file}. Restore the file from a backup.`, { cause: error });
  }
}

export function writeSettingsFile(file, settings) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporaryPath = `${file}.${process.pid}.${randomUUID()}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(settings, null, 2)}\n`);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporaryPath, file);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(temporaryPath, { force: true });
  }
}

export function defaultWorkspaceSettings() {
  const timestamp = new Date().toISOString();
  return { schemaVersion: 1, userId: 'local-user', email: 'local@cloudagent',
    name: 'Local User', settings: '{}', createdAt: timestamp, updatedAt: timestamp };
}

// A synchronous read/merge/atomic-write keeps API and Electron writes from
// interleaving within their shared process. Never await between read and write.
export function updateWorkspaceSettings(dataDir, patch) {
  const existing = readWorkspaceSettings(dataDir) || defaultWorkspaceSettings();
  const next = { ...existing, ...(typeof patch === 'function' ? patch(existing) : patch), updatedAt: new Date().toISOString() };
  writeSettingsFile(path.join(dataDir, 'settings.json'), next);
  return next;
}
