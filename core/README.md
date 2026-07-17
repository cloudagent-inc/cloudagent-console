# CloudAgent Core Packages

`core/*` holds the shared engine packages behind CloudAgent Console. The
desktop apps (`cloudagent-desktop/apps/*`) depend on them via `file:`
workspace links. Keeping them separate from the desktop shell keeps domain
logic reusable and testable outside Electron.

## Packages

| Package | npm name | Purpose |
| --- | --- | --- |
| `platform` | `@cloudagent/platform` | Cross-cutting basics: runtime-mode constants, global defaults (AWS region, OpenAI model), shared utilities (`safeTrim`, `safeJsonParse`). |
| `storage` | `@cloudagent/storage` | `JsonFileStore` — the local JSON-file-per-record store for all console data (profiles, workloads, runs, artifacts), with path-safety guards. |
| `cloudagent` | `@cloudagent/cloudagent` | The native CloudAgent orchestrator: OpenAI Agents SDK runner, system prompt building, architecture references. |
| `cloudagent-tools` | `@cloudagent/cloudagent-tools` | Tool implementations exposed to agents (workloads, permission profiles, CLI sessions, diagrams, artifacts) plus supporting services. |
| `agent-runtime` | `@cloudagent/agent-runtime` | Contracts shared by UI/API/runners: coding-agent runner definitions (Codex, Claude Code, Cursor Agent), agent-run event schema, the MCP tool allowlist. |
| `mcp` | `@cloudagent/mcp` | The local MCP server (Streamable HTTP) mounted at `/mcp` by the desktop API so external agents can use CloudAgent tools. |
| `skills` | `@cloudagent/skills` | Skill engine: generation, configuration planning, preflight, execution context, rewrite validation, execution analysis. |
| `scanners` | `@cloudagent/scanners` | AWS scanners: resource discovery, cost, resource health, and threat findings that feed the dashboards and agent context. |
| `workflows` | `@cloudagent/workflows` | Placeholder (`migration-pending`): workflow schema/engine will move here from the desktop API. |
| `workloads` | `@cloudagent/workloads` | Placeholder (`migration-pending`): workload domain models will move here from the desktop API. |
| `diagrams/ui`, `diagrams/icons` | `@cloudagent/diagram-ui-*` | Architecture-diagram editor components and AWS/Azure/GCP icon catalogs used by the UI. |

Some packages export a `*_PACKAGE_STATUS` constant: `active` means the
package is the live implementation; `migration-pending` means it is a
declared home whose logic still lives in `cloudagent-desktop/apps/api`.
