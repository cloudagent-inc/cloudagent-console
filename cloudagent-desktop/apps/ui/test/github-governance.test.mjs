import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_GITHUB_GOVERNANCE,
  describeGithubDelivery,
  getGithubFieldOverrideState,
  isGithubFieldOverridden,
  mergeGithubGovernance,
  resolveEffectiveGithubGovernance,
  revertGithubOverrideField,
  sanitizeGithubGovernance,
  sanitizeGithubGovernanceOverride,
  setGithubOverrideField,
  withDetectedDefaultBranch,
} from '../src/components/SourceControlGovernance/githubGovernance.js';

test('sanitize returns secure defaults for empty input', () => {
  const config = sanitizeGithubGovernance({});
  assert.equal(config.mode, 'pr_only');
  assert.deepEqual(config.protectedBranches, ['main', 'master']);
  assert.equal(config.branchPrefix, 'cloudagent/');
  assert.equal(config.allowBranchReset, 'prefix_only');
  assert.equal(config.draftPrs, true);
  assert.equal(config.secretScan, true);
  assert.equal(config.strictReads, false);
  assert.deepEqual(config.pathScope.deny, DEFAULT_GITHUB_GOVERNANCE.pathScope.deny);
  assert.equal(config.limits.maxFilesPerPr, 50);
  assert.equal(config.attribution.prLabel, 'cloudagent');
});

test('sanitize coerces invalid enum values back to secure defaults', () => {
  const config = sanitizeGithubGovernance({
    mode: 'yolo',
    allowBranchReset: 'whenever',
    pathScope: { mode: 'everywhere' },
    limits: { maxFilesPerPr: -3 },
  });
  assert.equal(config.mode, 'pr_only');
  assert.equal(config.allowBranchReset, 'prefix_only');
  assert.equal(config.pathScope.mode, 'iac_roots');
  assert.equal(config.limits.maxFilesPerPr, 50);
});

test('sanitize dedupes and trims protected branches', () => {
  const config = sanitizeGithubGovernance({ protectedBranches: [' main ', 'main', 'release', ''] });
  assert.deepEqual(config.protectedBranches, ['main', 'release']);
});

test('override sanitizer keeps only present top-level fields', () => {
  const override = sanitizeGithubGovernanceOverride({ mode: 'unrestricted', draftPrs: false });
  assert.deepEqual(Object.keys(override).sort(), ['draftPrs', 'mode']);
  assert.equal(override.mode, 'unrestricted');
  assert.equal(override.draftPrs, false);
});

test('merge lets later layers override earlier ones per field', () => {
  const merged = mergeGithubGovernance(
    DEFAULT_GITHUB_GOVERNANCE,
    { branchPrefix: 'team/' },
    { draftPrs: false }
  );
  assert.equal(merged.branchPrefix, 'team/');
  assert.equal(merged.draftPrs, false);
  assert.equal(merged.mode, 'pr_only'); // untouched inherited value
});

test('effective resolution merges inherited with partial override', () => {
  const inherited = sanitizeGithubGovernance({ branchPrefix: 'global/' });
  const effective = resolveEffectiveGithubGovernance(inherited, { branchPrefix: 'wl/' });
  assert.equal(effective.branchPrefix, 'wl/');
  assert.equal(effective.mode, 'pr_only');
});

test('override state reflects presence of the field at non-global levels', () => {
  const override = { mode: 'unrestricted' };
  assert.equal(getGithubFieldOverrideState(override, 'mode', 'workload'), 'overridden');
  assert.equal(getGithubFieldOverrideState(override, 'draftPrs', 'workload'), 'inherited');
  assert.equal(isGithubFieldOverridden(override, 'mode', 'workload'), true);
  assert.equal(isGithubFieldOverridden(override, 'draftPrs', 'workload'), false);
});

test('global level always reports overridden (it is the base)', () => {
  assert.equal(getGithubFieldOverrideState({}, 'mode', 'global'), 'overridden');
});

test('set and revert override fields immutably', () => {
  const base = { mode: 'unrestricted' };
  const withPrefix = setGithubOverrideField(base, 'branchPrefix', 'x/');
  assert.deepEqual(base, { mode: 'unrestricted' }); // unchanged
  assert.equal(withPrefix.branchPrefix, 'x/');
  const reverted = revertGithubOverrideField(withPrefix, 'branchPrefix');
  assert.equal('branchPrefix' in reverted, false);
  assert.equal(reverted.mode, 'unrestricted');
});

test('withDetectedDefaultBranch unions the detected branch', () => {
  assert.deepEqual(
    withDetectedDefaultBranch({ protectedBranches: ['main'] }, 'develop'),
    ['main', 'develop']
  );
  assert.deepEqual(
    withDetectedDefaultBranch({ protectedBranches: ['main'] }, 'main'),
    ['main']
  );
});

test('describeGithubDelivery renders a PR delivery line under pr_only', () => {
  const line = describeGithubDelivery(sanitizeGithubGovernance({}), {
    repoFullName: 'acme/app',
    slug: 'Add Feature!',
  });
  assert.equal(line, 'PR to acme/app from cloudagent/add-feature (draft)');
});

test('describeGithubDelivery reflects unrestricted mode', () => {
  const line = describeGithubDelivery(
    sanitizeGithubGovernance({ mode: 'unrestricted' }),
    { repoFullName: 'acme/app' }
  );
  assert.equal(line, 'Direct commits to acme/app (unrestricted)');
});
