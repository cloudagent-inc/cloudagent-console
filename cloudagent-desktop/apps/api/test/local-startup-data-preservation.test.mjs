import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { JsonFileStore } from "@cloudagent/storage";
import { updateLocalOpenAISettings } from "../src/platform/openai.mjs";

test("startup setup reuses a populated workspace without clearing it", async (t) => {
  const dataDir = await fs.mkdtemp(path.join(process.cwd(), ".cloudagent-startup-test-"));
  const previousEnvironment = {
    OPENAI_TOKEN: process.env.OPENAI_TOKEN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_LOCAL_MODEL: process.env.OPENAI_LOCAL_MODEL,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  };

  t.after(async () => {
    for (const [name, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const existingSettings = {
    schemaVersion: 1,
    userId: "local-user",
    settings: JSON.stringify({ theme: "existing", customPreference: true }),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  const existingSchema = {
    schemaVersion: 41,
    store: "existing-cloudagent-store",
  };
  const existingWorkload = {
    workloadId: "existing-workload",
    name: "Existing workload",
  };

  await fs.mkdir(path.join(dataDir, "workloads"), { recursive: true });
  await fs.mkdir(path.join(dataDir, "custom-folder"), { recursive: true });
  await fs.writeFile(path.join(dataDir, "settings.json"), JSON.stringify(existingSettings));
  await fs.writeFile(path.join(dataDir, "schema.json"), JSON.stringify(existingSchema));
  await fs.writeFile(
    path.join(dataDir, "workloads", "existing-workload.json"),
    JSON.stringify(existingWorkload)
  );
  await fs.writeFile(path.join(dataDir, "custom-folder", "sentinel.txt"), "preserve me");

  // This is the same store initialization performed after the desktop saves a
  // selected directory and restarts into it.
  const store = await new JsonFileStore({ dataDir }).init();

  // This is the next setup action: saving the key/model into that selected store.
  await updateLocalOpenAISettings(store, {
    apiKey: "test-startup-openai-key",
    model: "gpt-startup-test",
  });

  assert.deepEqual(
    JSON.parse(await fs.readFile(path.join(dataDir, "schema.json"), "utf8")),
    existingSchema
  );
  assert.deepEqual(
    JSON.parse(await fs.readFile(path.join(dataDir, "workloads", "existing-workload.json"), "utf8")),
    existingWorkload
  );
  assert.equal(
    await fs.readFile(path.join(dataDir, "custom-folder", "sentinel.txt"), "utf8"),
    "preserve me"
  );

  const updatedSettings = JSON.parse(
    await fs.readFile(path.join(dataDir, "settings.json"), "utf8")
  );
  const userSettings = JSON.parse(updatedSettings.settings);
  assert.equal(userSettings.theme, "existing");
  assert.equal(userSettings.customPreference, true);
  assert.equal(userSettings.openai.model, "gpt-startup-test");
  assert.equal(updatedSettings.openaiApiKey, "test-startup-openai-key");
});
