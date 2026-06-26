export const INTEGRATION_CAPABILITIES = Object.freeze({
  tools: 'tools',
  scanners: 'scanners',
  workflowNodes: 'workflowNodes',
  uiExtensions: 'uiExtensions',
});

export function defineIntegrationManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('integration manifest must be an object');
  }
  if (!manifest.id || !manifest.name) {
    throw new Error('integration manifest requires id and name');
  }
  return Object.freeze({ ...manifest });
}

