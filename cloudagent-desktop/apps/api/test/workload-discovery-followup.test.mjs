import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import express from "express";

import { createLocalWorkloadDiscoveryRouter } from "../src/modules/cloud-setup/aws-discovery.mjs";
import { buildLocalWorkloadDiscoveryRefinementRequest } from "../src/platform/llm.mjs";

const LLM_ENV_NAMES = [
  "ANTHROPIC_API_KEY",
  "CLOUDAGENT_LLM_PROVIDER",
  "CLOUDAGENT_LLM_API_KEY",
  "CLOUDAGENT_LLM_MODEL",
  "CLOUDAGENT_LLM_BASE_URL",
  "CLOUDAGENT_LLM_REGION",
  "CLOUDAGENT_LLM_PROTOCOL",
  "OPENAI_TOKEN",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_LOCAL_MODEL",
];

function isolateEnvironment(t) {
  const previous = {};
  for (const name of LLM_ENV_NAMES) {
    previous[name] = process.env[name];
    delete process.env[name];
  }
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}

const PROFILE = {
  recordId: "profile-1",
  name: "Development",
  type: "aws_account",
  authProfile: JSON.stringify({ provider: "aws", awsAccountId: "111122223333" }),
  deploymentPreferences: JSON.stringify({ defaultRegions: ["us-east-1"] }),
};

const CURRENT_WORKLOADS = [
  { name: "Checkout stack", description: "CloudFormation stack checkout." },
  { name: "Checkout workers", description: "Lambda functions for checkout." },
];

function createStoreStub() {
  return {
    getPermissionProfile: async (id) => (id === PROFILE.recordId ? PROFILE : null),
  };
}

// Minimal OpenAI-compatible Chat Completions endpoint. `reply` returns either a
// status code or the assistant message content for the captured request body.
async function createChatStub(t, reply) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      requests.push(body);
      const result = reply(body);
      if (typeof result === "number") {
        res.writeHead(result, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: "stub failure" } }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: "chatcmpl-stub",
          object: "chat.completion",
          choices: [{ index: 0, message: { role: "assistant", content: result }, finish_reason: "stop" }],
        })
      );
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  return { baseUrl: `http://127.0.0.1:${server.address().port}/v1`, requests };
}

async function startDiscoveryApi(t) {
  const app = express();
  app.use(express.json());
  app.use(createLocalWorkloadDiscoveryRouter({ store: createStoreStub() }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

function parseSseEvents(text) {
  return text
    .replace(/\r/g, "")
    .split("\n\n")
    .map((frame) => frame.trim())
    .filter((frame) => frame && !frame.startsWith(":"))
    .map((frame) => {
      let event = "message";
      const dataLines = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5));
      }
      return { event, data: JSON.parse(dataLines.join("\n") || "null") };
    });
}

async function sendFollowUp(baseUrl, payload) {
  const response = await fetch(`${baseUrl}/ops/workload-discovery/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({
      sessionId: "local-discovery-1",
      message: "Split the checkout workload into API and workers.",
      permissionProfileId: PROFILE.recordId,
      workloads: CURRENT_WORKLOADS,
      ...payload,
    }),
  });
  assert.equal(response.status, 200);
  return parseSseEvents(await response.text());
}

test("a follow-up turn refines the current workload cards from a stubbed model", async (t) => {
  isolateEnvironment(t);
  const chat = await createChatStub(t, () =>
    JSON.stringify({
      workloads: [
        { name: "Checkout API", description: "Public checkout API.", confidence: 0.9 },
        { name: "Checkout workers", description: "Async checkout processing.", confidence: 0.6 },
      ],
      summary: "Split checkout into an API workload and a workers workload.",
    })
  );
  process.env.CLOUDAGENT_LLM_PROVIDER = "custom";
  process.env.CLOUDAGENT_LLM_PROTOCOL = "openai-chat";
  process.env.CLOUDAGENT_LLM_BASE_URL = chat.baseUrl;
  process.env.CLOUDAGENT_LLM_MODEL = "stub-model";

  const baseUrl = await startDiscoveryApi(t);
  const events = await sendFollowUp(baseUrl, {});

  assert.deepEqual(events.map((entry) => entry.event), ["final", "done"]);
  const final = events[0].data;
  assert.equal(final.structuredUpdateApplied, true);
  assert.equal(final.responseId, null);
  assert.equal(final.text, "Split checkout into an API workload and a workers workload.");
  assert.deepEqual(
    final.discovery.workloads.map((workload) => workload.name),
    ["Checkout API", "Checkout workers"]
  );
  assert.deepEqual(events[1].data, { ok: true });

  // The turn must reach the model as a follow-up over the current proposal, and
  // it must not have re-scanned AWS to get there.
  assert.equal(chat.requests.length, 1);
  const [system, user] = chat.requests[0].messages;
  assert.match(system.content, /follow-up chat turn/);
  const context = JSON.parse(user.content);
  assert.equal(context.followUpInstruction, "Split the checkout workload into API and workers.");
  assert.deepEqual(
    context.initialWorkloads.map((workload) => workload.name),
    ["Checkout stack", "Checkout workers"]
  );
});

test("a follow-up turn without a configured provider points at Preferences", async (t) => {
  isolateEnvironment(t);
  const baseUrl = await startDiscoveryApi(t);

  const events = await sendFollowUp(baseUrl, {});
  assert.deepEqual(events.map((entry) => entry.event), ["final", "done"]);
  assert.equal(
    events[0].data.text,
    "Configure a model provider in Preferences to chat about discovery results."
  );
  assert.equal(events[0].data.structuredUpdateApplied, false);
  assert.equal(events[0].data.discovery, undefined);
});

test("a failed follow-up model call keeps the current cards intact", async (t) => {
  isolateEnvironment(t);
  // 400 is not retried by the OpenAI client, so the failure path stays fast.
  const chat = await createChatStub(t, () => 400);
  process.env.CLOUDAGENT_LLM_PROVIDER = "custom";
  process.env.CLOUDAGENT_LLM_PROTOCOL = "openai-chat";
  process.env.CLOUDAGENT_LLM_BASE_URL = chat.baseUrl;
  process.env.CLOUDAGENT_LLM_MODEL = "stub-model";

  const baseUrl = await startDiscoveryApi(t);
  const events = await sendFollowUp(baseUrl, {});

  assert.deepEqual(events.map((entry) => entry.event), ["final", "done"]);
  assert.equal(events[0].data.text, "The model call failed — try again in a moment.");
  assert.equal(events[0].data.structuredUpdateApplied, false);
  assert.equal(events[0].data.discovery, undefined);
});

test("the refinement request only asks for a follow-up when an instruction is given", () => {
  const initial = buildLocalWorkloadDiscoveryRefinementRequest({
    profile: PROFILE,
    accountId: "111122223333",
    scanResults: { services: {} },
    workloads: CURRENT_WORKLOADS,
  });
  assert.doesNotMatch(initial.instructions, /follow-up chat turn/);
  assert.equal(JSON.parse(initial.input).followUpInstruction, undefined);

  const followUp = buildLocalWorkloadDiscoveryRefinementRequest({
    profile: PROFILE,
    accountId: "111122223333",
    scanResults: {},
    workloads: [{ name: "Checkout stack", confidence: 0.4, reasoning: "Single stack." }],
    followUpInstruction: "  Merge the two checkout groups.  ",
  });
  assert.match(followUp.instructions, /follow-up chat turn/);
  // Both passes keep the shared JSON contract and grouping rules.
  assert.match(followUp.instructions, /Return ONLY JSON with shape/);
  assert.match(followUp.instructions, /top 3 to 5 coherent workload candidates/);
  assert.match(followUp.instructions, /Do not invent resources/);

  const context = JSON.parse(followUp.input);
  assert.equal(context.followUpInstruction, "Merge the two checkout groups.");
  assert.equal(context.initialWorkloads[0].confidence, 0.4);
  assert.equal(context.initialWorkloads[0].reasoning, "Single stack.");
});
