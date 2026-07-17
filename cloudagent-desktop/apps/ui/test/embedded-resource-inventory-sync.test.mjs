import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getEmbeddedResourceInventorySyncAction,
  getResourceInventorySignature,
} from '../src/lib/embeddedResourceInventorySync.js';

test('embedded resource inventory accepts health-enriched rows from its parent', () => {
  const original = [{ resourceId: 'table/orders' }];
  const enriched = [{
    resourceId: 'table/orders',
    health: { checks: [{ status: 'problem' }] },
  }];
  const originalSignature = getResourceInventorySignature(original);
  const enrichedSignature = getResourceInventorySignature(enriched);

  const result = getEmbeddedResourceInventorySyncAction({
    previous: {
      workloadKey: 'workload-1',
      externalSignature: originalSignature,
      localSignature: originalSignature,
    },
    workloadKey: 'workload-1',
    externalSignature: enrichedSignature,
    localSignature: originalSignature,
  });

  assert.equal(result.direction, 'external-to-local');
  assert.equal(result.next.localSignature, enrichedSignature);
});

test('embedded resource inventory still propagates local row edits to its parent', () => {
  const originalSignature = getResourceInventorySignature([
    { resourceId: 'table/orders' },
  ]);
  const editedSignature = getResourceInventorySignature([]);

  const result = getEmbeddedResourceInventorySyncAction({
    previous: {
      workloadKey: 'workload-1',
      externalSignature: originalSignature,
      localSignature: originalSignature,
    },
    workloadKey: 'workload-1',
    externalSignature: originalSignature,
    localSignature: editedSignature,
  });

  assert.equal(result.direction, 'local-to-external');
  assert.equal(result.next.externalSignature, editedSignature);
});
