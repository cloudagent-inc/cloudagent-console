import { defineIntegrationManifest } from '@cloudagent/integration-sdk';

export const prowlerIntegrationManifest = defineIntegrationManifest({
  id: 'prowler',
  name: 'Prowler',
  capabilities: ['scanners', 'tools', 'workflowNodes'],
});

