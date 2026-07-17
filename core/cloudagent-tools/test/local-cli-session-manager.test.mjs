import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { LocalCliSessionManager } from "../src/cli-session/local-cli-session-manager.mjs";

async function withManager(fn) {
  const rootDir = await fs.mkdtemp(path.join(process.cwd(), ".cloudagent-cli-session-test-"));
  const manager = new LocalCliSessionManager({ rootDir, cleanupIntervalMs: 0 });
  try {
    await fn({ manager, rootDir });
  } finally {
    for (const session of manager.listSessions()) {
      await manager.endSession(session.cliSessionId).catch(() => {});
    }
    await fs.rm(rootDir, { recursive: true, force: true });
  }
}

const authProfile = {
  awsProfile: "test-profile",
  awsAccountId: "123456789012",
  region: "us-east-1",
};

test("reuses an exact scoped environment session", async () => {
  await withManager(async ({ manager }) => {
    const first = await manager.ensureSession({
      authProfile,
      permissionProfileId: "profile-1",
      recordId: "command-center-chat-1",
    });
    const second = await manager.ensureSession({
      authProfile,
      permissionProfileId: "profile-1",
      recordId: "command-center-chat-1",
    });

    assert.equal(first.reused, false);
    assert.equal(second.reused, true);
    assert.equal(second.cliSessionId, first.cliSessionId);
  });
});

test("keeps chats and regions in separate sessions", async () => {
  await withManager(async ({ manager }) => {
    const first = await manager.ensureSession({ authProfile, recordId: "chat-1", region: "us-east-1" });
    const secondChat = await manager.ensureSession({ authProfile, recordId: "chat-2", region: "us-east-1" });
    const secondRegion = await manager.ensureSession({ authProfile, recordId: "chat-1", region: "us-west-2" });

    assert.notEqual(secondChat.cliSessionId, first.cliSessionId);
    assert.notEqual(secondRegion.cliSessionId, first.cliSessionId);
  });
});

test("uses the configured root and preserves files between commands", async () => {
  await withManager(async ({ manager, rootDir }) => {
    const session = await manager.ensureSession({ authProfile, recordId: "chat-files" });
    assert.ok(session.workDir.startsWith(`${rootDir}${path.sep}`));

    const events = [];
    const write = await manager.execute({
      cliSessionId: session.cliSessionId,
      command: "printf session-data > evidence.txt",
      onEvent: (event) => events.push(event),
    });
    const read = await manager.execute({
      cliSessionId: session.cliSessionId,
      command: "cat evidence.txt",
      onEvent: (event) => events.push(event),
    });

    assert.equal(write.ok, true);
    assert.equal(read.stdout, "session-data");
    assert.ok(events.some((event) => event.lifecycle === "started"));
    assert.ok(events.some((event) => event.lifecycle === "stdout" && event.chunk === "session-data"));
    assert.ok(events.some((event) => event.lifecycle === "completed"));

    const ended = await manager.endSession(session.cliSessionId);
    assert.equal(ended.ok, true);
    await assert.rejects(fs.access(session.workDir));
  });
});

test("forceNew creates a distinct scoped session", async () => {
  await withManager(async ({ manager }) => {
    const first = await manager.ensureSession({ authProfile, recordId: "chat-force" });
    const second = await manager.ensureSession({ authProfile, recordId: "chat-force", forceNew: true });
    assert.notEqual(second.cliSessionId, first.cliSessionId);
    assert.equal(second.reused, false);
  });
});
