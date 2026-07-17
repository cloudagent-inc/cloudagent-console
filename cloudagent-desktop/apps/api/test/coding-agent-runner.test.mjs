import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  resolveCodexCodeModeHostPath,
  resumeLocalCodexBlueprint,
  runLocalCodexBlueprint,
} from "../src/modules/skills/coding-agent-runner.mjs";

test("resolves the Codex code-mode host beside the real binary behind a PATH symlink", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cloudagent-codex-host-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const appDir = path.join(root, "Codex.app", "Contents", "Resources");
  const binDir = path.join(root, "bin");
  await fs.mkdir(appDir, { recursive: true });
  await fs.mkdir(binDir, { recursive: true });
  const codexPath = path.join(appDir, "codex");
  const hostPath = path.join(appDir, "codex-code-mode-host");
  await fs.writeFile(codexPath, "#!/bin/sh\n");
  await fs.writeFile(hostPath, "#!/bin/sh\n");
  await fs.chmod(codexPath, 0o755);
  await fs.chmod(hostPath, 0o755);
  await fs.symlink(codexPath, path.join(binDir, "codex"));

  assert.equal(
    resolveCodexCodeModeHostPath("codex", { PATH: binDir }),
    await fs.realpath(hostPath)
  );
});

test("honors an explicitly configured Codex code-mode host", () => {
  assert.equal(
    resolveCodexCodeModeHostPath("codex", {
      PATH: "",
      CODEX_CODE_MODE_HOST_PATH: "/custom/codex-code-mode-host",
    }),
    "/custom/codex-code-mode-host"
  );
});

test("injects the resolved code-mode host into a Codex launch", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cloudagent-codex-launch-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const appDir = path.join(root, "Codex.app", "Contents", "Resources");
  const binDir = path.join(root, "bin");
  await fs.mkdir(appDir, { recursive: true });
  await fs.mkdir(binDir, { recursive: true });
  const codexPath = path.join(appDir, "codex");
  const hostPath = path.join(appDir, "codex-code-mode-host");
  const linkedCodexPath = path.join(binDir, "codex");
  await fs.writeFile(
    codexPath,
    '#!/usr/bin/env node\nprocess.stdout.write(`${JSON.stringify({ type: "item.completed", text: process.env.CODEX_CODE_MODE_HOST_PATH || "" })}\\n`);\n'
  );
  await fs.writeFile(hostPath, "#!/bin/sh\n");
  await fs.chmod(codexPath, 0o755);
  await fs.chmod(hostPath, 0o755);
  await fs.symlink(codexPath, linkedCodexPath);

  const result = await runLocalCodexBlueprint({
    blueprintId: "codex-host-test",
    title: "Codex host test",
    blueprint: { title: "Codex host test" },
    planPayload: { title: "Codex host test" },
    task: "Report the configured host.",
    workspaceDir: root,
    agentBinary: linkedCodexPath,
  });

  assert.equal(result.output, await fs.realpath(hostPath));
  assert.equal(result.exitCode, 0);

  const resumedResult = await resumeLocalCodexBlueprint({
    runDir: result.runDir,
    prompt: "Report the configured host again.",
    agentBinary: linkedCodexPath,
  });
  assert.equal(resumedResult.output, await fs.realpath(hostPath));
  assert.equal(resumedResult.exitCode, 0);
});
