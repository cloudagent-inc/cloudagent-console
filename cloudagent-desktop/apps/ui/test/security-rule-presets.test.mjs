import assert from 'node:assert/strict';
import test from 'node:test';

import { securityPresets } from '../src/components/SecurityRules/securityRulePresets.js';
import { DEFAULT_GUARDRAIL_CATALOG } from '@cloudagent/cloudagent-tools/services/default-guardrail-catalog';

const ids = (preset) => new Set(securityPresets[preset].rules);

test('security presets form an intentional progression through production', () => {
  assert.equal(securityPresets.none.rules.length, 0);
  assert.equal(securityPresets.relaxed.rules.length, 5);
  assert.equal(securityPresets.basic.rules.length, 19);
  assert.equal(securityPresets.development.rules.length, 20);
  assert.equal(securityPresets.production.rules.length, 29);
  assert.equal(securityPresets.all.rules, 'all');

  for (const [parent, child] of [
    ['relaxed', 'basic'],
    ['basic', 'development'],
    ['development', 'production'],
  ]) {
    assert.ok([...ids(parent)].every((ruleId) => ids(child).has(ruleId)));
  }
});

test('presets match their user-facing intent', () => {
  const exposure = ids('relaxed');
  const development = ids('development');
  const production = ids('production');

  assert.ok(exposure.has('AUTOSCALING_LAUNCH_CONFIG_PUBLIC_IP_DISABLED'));
  assert.equal(exposure.has('EC2_SECURITY_GROUP_EGRESS_OPEN_TO_WORLD_RULE'), false);

  assert.ok(development.has('ECR_REPO_SCAN_ON_PUSH'));
  assert.ok(development.has('SECURITY_GROUP_DESCRIPTION_RULE'));
  assert.equal(development.has('RDS_INSTANCE_DELETION_PROTECTION_ENABLED'), false);
  assert.equal(development.has('MULTI_REGION_CLOUD_TRAIL_ENABLED'), false);
  assert.equal(development.has('S3_BUCKET_LOGGING_ENABLED'), false);

  for (const ruleId of [
    'API_GW_DOMAIN_DENY_NON_TLS_TRAFFIC',
    'CLOUDFRONT_MINIMUM_PROTOCOL_VERSION_RULE',
    'CLOUDFRONT_VIEWER_POLICY_HTTPS',
    'CLOUDFRONT_ACCESSLOGS_ENABLED',
    'DYNAMODB_PITR_ENABLED',
    'RDS_INSTANCE_DELETION_PROTECTION_ENABLED',
    'S3_BUCKET_VERSIONING_ENABLED',
  ]) {
    assert.ok(production.has(ruleId), `${ruleId} should be enabled for production`);
  }
});

test('preset rule ids are all in the shared 38-policy catalog', () => {
  const supported = new Set(DEFAULT_GUARDRAIL_CATALOG.rules.map((rule) => rule.id));
  assert.equal(supported.size, 38);

  for (const [presetId, preset] of Object.entries(securityPresets)) {
    if (preset.rules === 'all') continue;
    assert.equal(new Set(preset.rules).size, preset.rules.length, `${presetId} contains duplicates`);
    assert.ok(
      preset.rules.every((ruleId) => supported.has(ruleId)),
      `${presetId} contains an unsupported policy`,
    );
  }
});
