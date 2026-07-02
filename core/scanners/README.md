# CloudAgent Scanners

`core/scanners` contains scanner contracts and scanner support used to collect
cloud environment signals for CloudAgent Console.

Scanner output is intended to become agent-ready context: cost, health, threat,
inventory, and other operational findings that can be viewed in the console or
served to agent tools through CloudAgent APIs and MCP.

## What It Provides

- Scanner package entrypoints.
- Shared scanner contracts and result shapes.
- Integration points for local scanner jobs and adapters.

## Supported Insight Areas

- Cost insights.
- Health signals.
- Threat and security findings.
- Inventory and workload context.

## Related Code

- `src/index.mjs` - package entrypoint.
- `../workloads` - workload records enriched by scanner output.
- `../../cloudagent-desktop/apps/ui/src/pages/Dashboard` - dashboard views that
  display scanner-derived insights.
