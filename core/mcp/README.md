# CloudAgent MCP

`core/mcp` contains the local MCP server and tool exposure used by CloudAgent
Console. The goal is to let compatible AI agents query CloudAgent context and
operate on approved local artifacts without needing direct access to every
internal file or API.

## What It Provides

- Local MCP server entrypoints.
- Tool exposure for CloudAgent data and operations.
- Integration points for readonly cloud tools, scanner artifacts, workloads,
  diagrams, and agent context.

## Current Usage

MCP is configured from **Preferences** in CloudAgent Console. Users can enable or
disable the local MCP server there. Environment variables are developer
overrides only and should not be required for normal use.

## Related Code

- `src/index.mjs` - package entrypoint.
- `../cloudagent-tools` - CloudAgent tools exposed to agent runtimes.
- `../workloads` - workload context that MCP tools can expose.
- `../scanners` - scanner artifacts and findings.
