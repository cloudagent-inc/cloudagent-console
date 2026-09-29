import assert from "node:assert/strict";
import http from "node:http";
import { createRequire } from "node:module";
import test from "node:test";

// Resolve Undici from the AI SDK utility that uses it, not from the repo root.
// This catches a missing or incompatible override in the actual dependency path.
const requireFromAi = createRequire(import.meta.resolve("ai"));
const requireFromProviderUtils = createRequire(
  requireFromAi.resolve("@ai-sdk/provider-utils")
);
const { Agent, fetch } = requireFromProviderUtils("undici");
const { version } = requireFromProviderUtils("undici/package.json");

test("AI SDK provider-utils uses patched Undici with its Agent/fetch contract", async () => {
  assert.equal(version, "6.28.1");

  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ok");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const dispatcher = new Agent({
    connect: {
      lookup(_hostname, options, callback) {
        const address = { address: "127.0.0.1", family: 4 };
        if (options.all) callback(null, [address]);
        else callback(null, address.address, address.family);
      },
    },
  });

  try {
    const { port } = server.address();
    const response = await fetch(`http://cloudagent-test.invalid:${port}/`, {
      dispatcher,
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "ok");
  } finally {
    await dispatcher.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
