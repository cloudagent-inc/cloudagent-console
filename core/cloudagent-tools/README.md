# CloudAgent Tools

`core/cloudagent-tools` (npm: `@cloudagent/cloudagent-tools`) implements
the tools that agents can call — both the native CloudAgent runner
(`core/cloudagent`) and external CLI agents connecting through the local
MCP server (`core/mcp`).

## Tool families (`src/tools/`)

- **Workloads** — list/get/update workload records and their context.
- **Permission profiles** — list/get cloud credential profiles (values are
  redacted for tool output).
- **CLI sessions** — start/reuse/execute/status/end logical shell sessions
  (`src/cli-session/local-cli-session-manager.mjs`), used for AWS CLI
  operations under a selected permission profile. A run-scoped session keeps
  its ID, credentials, working directory, files, and command ordering while
  each command runs as a separate non-interactive process. Desktop API wiring
  places session directories under `<localDataDir>/tmp/cli-sessions/`.
- **Scanner artifacts** — fetch scanner output for agent context.
- **Diagrams / architecture** — diagram-spec tools and architecture
  template retrieval.
- **Deployment preferences** — summarized deployment settings.

## Services (`src/services/`)

Read-model helpers behind the tools: workload summaries, permission-profile
views, deployment preferences, and insights availability.

## Related code

- `../agent-runtime` — `CLOUDAGENT_MCP_TOOLS`, the allowlist of tool names
  exposed over MCP.
- `../mcp` — the MCP server that surfaces these tools to external agents.
- `../../cloudagent-desktop/apps/api/src/modules/cloudagent` — wires these
  tools to the desktop API's store and event bus.
