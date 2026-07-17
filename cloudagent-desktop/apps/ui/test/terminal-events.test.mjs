import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatTerminalOutput,
  sanitizeTerminalText,
  terminalEntriesFromMessages,
  upsertTerminalEvent,
} from '../src/lib/terminalEvents.js';

test('reconciles terminal lifecycle chunks into one command entry', () => {
  let entries = [];
  entries = upsertTerminalEvent(entries, {
    type: 'terminal_output',
    lifecycle: 'started',
    cliSessionId: 'session-1',
    commandId: 'command-1',
    command: 'printf hello',
  });
  entries = upsertTerminalEvent(entries, {
    type: 'terminal_output',
    lifecycle: 'stdout',
    cliSessionId: 'session-1',
    commandId: 'command-1',
    command: 'printf hello',
    stream: 'stdout',
    chunk: 'hello',
  });
  entries = upsertTerminalEvent(entries, {
    type: 'terminal_output',
    lifecycle: 'completed',
    cliSessionId: 'session-1',
    commandId: 'command-1',
    command: 'printf hello',
    exitCode: 0,
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].stdout, 'hello');
  assert.equal(entries[0].status, 'completed');
  assert.equal(entries[0].exitCode, 0);
});

test('reconstructs CLI terminal entries from stored tool executions', () => {
  const entries = terminalEntriesFromMessages([
    {
      role: 'assistant',
      toolExecutions: [
        {
          id: 'tool-1',
          name: 'cli_session_execute',
          input: { command: 'aws sts get-caller-identity' },
          output: {
            ok: true,
            input: { cliSessionId: 'session-1', command: 'aws sts get-caller-identity' },
            result: { cliSessionId: 'session-1', stdout: '{"Account":"123"}', exitCode: 0 },
          },
        },
      ],
    },
  ]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].cliSessionId, 'session-1');
  assert.equal(entries[0].stdout, '{"Account":"123"}');
  assert.equal(entries[0].status, 'completed');
});

test('removes ANSI and unsafe terminal control characters', () => {
  assert.equal(sanitizeTerminalText('\u001b[31mred\u001b[0m\u0007'), 'red');
});

test('pretty prints JSON terminal output without changing plain text', () => {
  assert.equal(formatTerminalOutput('{"ok":true,"items":[1]}'), '{\n  "ok": true,\n  "items": [\n    1\n  ]\n}');
  assert.equal(formatTerminalOutput('plain output'), 'plain output');
});
