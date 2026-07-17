import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_SKILL_BUILDER_CLOUD_PROVIDER,
  SKILL_BUILDER_PLAN_TYPES,
} from '../src/pages/Agent/skillBuilderPlanTypes.js';

test('new Skill Builder plans default to AWS', () => {
  assert.equal(DEFAULT_SKILL_BUILDER_CLOUD_PROVIDER, 'aws');
});

test('Skill Builder plan types communicate their change behavior', () => {
  assert.deepEqual(
    SKILL_BUILDER_PLAN_TYPES.map(({ value, safetyLabel }) => ({ value, safetyLabel })),
    [
      { value: 'Review', safetyLabel: 'Read-Only' },
      { value: 'Configuration', safetyLabel: 'Changes Configuration' },
    ]
  );
  assert.match(SKILL_BUILDER_PLAN_TYPES[0].description, /without applying changes/i);
  assert.match(SKILL_BUILDER_PLAN_TYPES[1].description, /modify AWS configuration/i);
});

