import { defineIntegrationManifest } from '@cloudagent/integration-sdk';

export const awsIntegrationManifest = defineIntegrationManifest({
  id: 'aws',
  name: 'AWS',
  capabilities: ['credentials', 'tools', 'scanners', 'workflowNodes'],
});

