import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { JsonFileStore } from "../src/json-file/json-file-store.mjs";

test("JsonFileStore does not use CLOUDAGENT_LOCAL_DATA_DIR", () => {
  const previous = process.env.CLOUDAGENT_LOCAL_DATA_DIR;
  process.env.CLOUDAGENT_LOCAL_DATA_DIR = path.join(process.cwd(), "unexpected-env-store");

  try {
    const store = new JsonFileStore();
    assert.equal(store.dataDir, path.resolve(os.homedir(), ".cloudagent", "local-data"));
  } finally {
    if (previous === undefined) {
      delete process.env.CLOUDAGENT_LOCAL_DATA_DIR;
    } else {
      process.env.CLOUDAGENT_LOCAL_DATA_DIR = previous;
    }
  }
});

test("JsonFileStore init preserves an existing local store", async () => {
  const dataDir = await fs.mkdtemp(path.join(process.cwd(), ".cloudagent-storage-test-"));
  const existingSettings = {
    schemaVersion: 1,
    userId: "local-user",
    settings: JSON.stringify({ theme: "existing" }),
    openaiApiKey: "existing-test-key",
  };
  const existingSchema = {
    schemaVersion: 99,
    store: "existing-store",
  };
  const existingWorkload = {
    workloadId: "workload-existing",
    name: "Existing workload",
  };

  try {
    await fs.mkdir(path.join(dataDir, "workloads"), { recursive: true });
    await fs.mkdir(path.join(dataDir, "custom-folder"), { recursive: true });
    await fs.writeFile(path.join(dataDir, "settings.json"), JSON.stringify(existingSettings));
    await fs.writeFile(path.join(dataDir, "schema.json"), JSON.stringify(existingSchema));
    await fs.writeFile(
      path.join(dataDir, "workloads", "workload-existing.json"),
      JSON.stringify(existingWorkload)
    );
    await fs.writeFile(path.join(dataDir, "custom-folder", "sentinel.txt"), "keep me");

    const store = new JsonFileStore({ dataDir });
    await store.init();
    await store.init();

    assert.deepEqual(JSON.parse(await fs.readFile(path.join(dataDir, "settings.json"), "utf8")), existingSettings);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(dataDir, "schema.json"), "utf8")), existingSchema);
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(dataDir, "workloads", "workload-existing.json"), "utf8")),
      existingWorkload
    );
    assert.equal(await fs.readFile(path.join(dataDir, "custom-folder", "sentinel.txt"), "utf8"), "keep me");
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
