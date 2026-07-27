import path from 'node:path';

export function buildDefaultLocalDataDir(homeDir, pathApi = path) {
  return pathApi.join(String(homeDir || ''), '.cloudagent', 'local-data');
}
