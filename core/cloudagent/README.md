# CloudAgent Orchestration

`core/cloudagent` (npm: `@cloudagent/cloudagent`) contains the native
CloudAgent orchestration layer: the OpenAI Agents SDK-backed runner, tool
registration, system-prompt construction, and response handling used when
work executes through the built-in CloudAgent path (as opposed to being
handed off to an external CLI agent).

## What it provides

- `makeCloudAgent` — constructs the agent with its tool registry
  (imported by the local MCP server and the API's plan runner).
- `buildCloudAgentSystemPrompt` — the system prompt used for CloudAgent
  runs.
- Architecture references (`src/architecture_references.mjs`) and
  operational context helpers.

## Related code

- `src/core/cloudagent.mjs` — native CloudAgent runner.
- `../cloudagent-tools` — the tools registered with the agent.
- `../agent-runtime` — shared runner definitions and event contracts.
- `../../cloudagent-desktop/apps/api/src/modules/runners/plan-runner.mjs`
  — where the API executes plans through this runner.
