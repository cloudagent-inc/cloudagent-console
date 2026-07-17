import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCommandCenterNewSessionRunner,
  isCommandCenterAgentRunnerSelectionLocked,
} from '../src/lib/commandCenterAgentSelection.js';

test('new Command Center sessions use the configured local default immediately', () => {
  assert.equal(getCommandCenterNewSessionRunner('codex'), 'codex');
  assert.equal(getCommandCenterNewSessionRunner('claude'), 'claude');
  assert.equal(getCommandCenterNewSessionRunner('cursor'), 'cursor');
  assert.equal(
    getCommandCenterNewSessionRunner('codex', { isLocalMode: false }),
    'cloudagent'
  );
});

test('agent selection locks as soon as a chat has started', () => {
  assert.equal(isCommandCenterAgentRunnerSelectionLocked(), false);
  assert.equal(
    isCommandCenterAgentRunnerSelectionLocked({
      messages: [{ role: 'assistant', text: 'How can I help?' }],
    }),
    false
  );
  assert.equal(
    isCommandCenterAgentRunnerSelectionLocked({
      messages: [{ role: 'user', text: 'Inspect this workload' }],
    }),
    true
  );
  assert.equal(
    isCommandCenterAgentRunnerSelectionLocked({
      lockedSessionAgentRunner: 'codex',
      messages: [],
    }),
    true
  );
});
