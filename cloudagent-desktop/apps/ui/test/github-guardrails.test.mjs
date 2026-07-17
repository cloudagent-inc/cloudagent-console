import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GITHUB_GUARDRAIL_CODES,
  GITHUB_GUARDRAIL_TAG,
  extractGithubGuardrailRejection,
  isGithubGuardrailCode,
  mapGithubGuardrailError,
} from '../src/lib/githubGuardrails.js';

test('every known code maps to a titled, tagged, non-empty message', () => {
  for (const code of GITHUB_GUARDRAIL_CODES) {
    const mapped = mapGithubGuardrailError(code, {});
    assert.equal(mapped.code, code);
    assert.equal(mapped.tag, GITHUB_GUARDRAIL_TAG);
    assert.ok(mapped.title && mapped.title.length > 0, `title for ${code}`);
    assert.ok(mapped.message && mapped.message.length > 0, `message for ${code}`);
  }
});

test('branch_prefix_required surfaces the suggested branch', () => {
  const mapped = mapGithubGuardrailError('branch_prefix_required', {
    branchPrefix: 'cloudagent/',
    suggestedBranch: 'cloudagent/fix-typo',
  });
  assert.match(mapped.message, /cloudagent\//);
  assert.equal(mapped.suggestion, 'Use cloudagent/fix-typo');
});

test('protected_branch names the branch and guides to create a branch', () => {
  const mapped = mapGithubGuardrailError('protected_branch', { branch: 'main' });
  assert.match(mapped.message, /main/);
  assert.match(mapped.message, /create_github_branch/);
});

test('secret_detected reports the pattern name and never the value', () => {
  const mapped = mapGithubGuardrailError('secret_detected', {
    pattern: 'aws_access_key',
    match: 'AKIAIOSFODNN7EXAMPLE',
  });
  assert.match(mapped.message, /aws_access_key/);
  assert.doesNotMatch(mapped.message, /AKIA/);
});

test('unknown codes fall back to a generic friendly message', () => {
  const mapped = mapGithubGuardrailError('totally_unknown', {});
  assert.equal(mapped.tag, GITHUB_GUARDRAIL_TAG);
  assert.ok(mapped.message.length > 0);
});

test('isGithubGuardrailCode only accepts known codes', () => {
  assert.equal(isGithubGuardrailCode('protected_branch'), true);
  assert.equal(isGithubGuardrailCode('nope'), false);
  assert.equal(isGithubGuardrailCode(null), false);
});

test('extract detects a guardrail rejection from error object shape', () => {
  const rejection = extractGithubGuardrailRejection({
    ok: false,
    error: { code: 'diff_too_large', fileCount: 80, diffKb: 900 },
  });
  assert.equal(rejection.code, 'diff_too_large');
  assert.match(rejection.message, /80 files/);
  assert.match(rejection.message, /900 KB/);
});

test('extract detects a guardrail rejection from top-level code shape', () => {
  const rejection = extractGithubGuardrailRejection({
    ok: false,
    code: 'invalid_base_branch',
    baseBranch: 'feature/x',
  });
  assert.equal(rejection.code, 'invalid_base_branch');
  assert.match(rejection.message, /feature\/x/);
});

test('extract never copies a matched secret value into details', () => {
  const rejection = extractGithubGuardrailRejection({
    ok: false,
    error: { code: 'secret_detected', pattern: 'github_pat', match: 'ghp_SECRETVALUE123' },
  });
  assert.match(rejection.message, /github_pat/);
  const serialized = JSON.stringify(rejection);
  assert.doesNotMatch(serialized, /ghp_SECRETVALUE123/);
});

test('extract returns null for non-guardrail results', () => {
  assert.equal(extractGithubGuardrailRejection({ ok: true, statusKind: 'completed' }), null);
  assert.equal(extractGithubGuardrailRejection(null), null);
  assert.equal(extractGithubGuardrailRejection({ error: { code: 'some_other_error' } }), null);
});
