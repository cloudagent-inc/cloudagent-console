# CloudAgent Agent Runtime

`core/agent-runtime` defines the agent runtimes and event contracts used by
CloudAgent Console.

The runtime layer lets CloudAgent run work directly through the native
CloudAgent runner or hand off skill execution to supported local coding-agent
CLIs.

## Supported Runners

- CloudAgent native runner.
- Codex CLI.
- Claude Code.
- Cursor Agent.

## What It Provides

- Runner definitions and aliases.
- Default binary names and settings paths.
- Agent run event schema and event types.
- Shared labels used by the UI and local API.

## Related Code

- `src/index.mjs` - runner definitions and event contracts.
- `../skills` - skills that can be executed through these runtimes.
- `../../cloudagent-desktop/apps/api/src/modules/runners` - local runner API
  behavior.
