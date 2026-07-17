const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cloudAgentRuntime', {
  mode: 'local',
  apiBaseUrl: window.location.origin,
  capabilities: {
    workloads: true,
    cloudSetup: true,
    executiveSummaries: true,
    commandCenter: true,
    preferences: true,
    health: true,
    cost: true,
    reports: false,
    recommendations: false,
    teams: false,
    integrations: false,
    mcp: true,
    automation: true,
    blueprints: true,
    agents: true,
    wellArchitected: false,
    compliance: false,
    threat: true,
    credits: false,
  },
  getLocalRuntimeInfo: () => ipcRenderer.invoke('cloudagent:get-local-runtime-info'),
  setLocalDataDir: (localDataDir) =>
    ipcRenderer.invoke('cloudagent:set-local-data-dir', localDataDir),
  setLocalMcpEnabled: (enabled) =>
    ipcRenderer.invoke('cloudagent:set-local-mcp-enabled', Boolean(enabled)),
  openLocalDataDir: () => ipcRenderer.invoke('cloudagent:open-local-data-dir'),
  restartApp: () => ipcRenderer.invoke('cloudagent:restart-app'),
  browseDirectory: (options) => ipcRenderer.invoke('cloudagent:browse-directory', options),
});
