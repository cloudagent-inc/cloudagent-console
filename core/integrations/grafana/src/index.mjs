import { defineIntegrationManifest } from '@cloudagent/integration-sdk';

export const grafanaIntegrationManifest = defineIntegrationManifest({
  id: 'grafana',
  name: 'Grafana',
  capabilities: ['tools', 'workflowNodes', 'uiExtensions'],
});

