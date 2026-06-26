import { defineIntegrationManifest } from '@cloudagent/integration-sdk';

export const datadogIntegrationManifest = defineIntegrationManifest({
  id: 'datadog',
  name: 'Datadog',
  capabilities: ['tools', 'workflowNodes', 'uiExtensions'],
});

