import assert from "node:assert/strict";
import test from "node:test";

import { normalizeExternalCommandCenterEvent } from "../src/modules/command-center/command-center-service.mjs";

function createState() {
  return {
    streamedText: "",
    toolExecutions: [],
    contextEvents: [],
  };
}

test("forwards normalized external command execution events to the terminal", () => {
  const terminalEvents = [];
  normalizeExternalCommandCenterEvent(
    {
      type: "item.started",
      runner: "codex",
      item: {
        id: "command-1",
        type: "command_execution",
        command: "aws sts get-caller-identity --output json",
        status: "in_progress",
      },
    },
    {
      runner: "codex",
      recordId: "command-center-chat-1",
      onTerminalEvent: (event) => terminalEvents.push(event),
      state: createState(),
    }
  );

  assert.equal(terminalEvents.length, 1);
  assert.equal(terminalEvents[0].commandId, "command-1");
  assert.equal(terminalEvents[0].command, "aws sts get-caller-identity --output json");
  assert.equal(terminalEvents[0].runner, "codex");
});

test("does not expose raw external-agent stdout as terminal commands", () => {
  const terminalEvents = [];
  normalizeExternalCommandCenterEvent(
    { type: "codex_stdout", runner: "codex", content: '{"type":"turn.started"}\n' },
    {
      runner: "codex",
      recordId: "command-center-chat-1",
      onTerminalEvent: (event) => terminalEvents.push(event),
      state: createState(),
    }
  );

  assert.deepEqual(terminalEvents, []);
});
