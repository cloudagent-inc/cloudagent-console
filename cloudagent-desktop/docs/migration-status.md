# CloudAgent Desktop Migration Status

## Current Slice

The new `/Users/abdul/dev/cloudagent` monorepo now has desktop-specific apps
under `/Users/abdul/dev/cloudagent/cloudagent-desktop` and shared core modules
under `/Users/abdul/dev/cloudagent/core`.

The current desktop slice includes:

- Root npm workspaces at `/Users/abdul/dev/cloudagent`.
- Electron shell under `apps/desktop`.
- Native local API wiring under `apps/api`.
- Dashboard React UI copied into `apps/ui`.
- Extracted local JSON storage under `/Users/abdul/dev/cloudagent/core/storage`.
- Extracted diagram UI packages under `/Users/abdul/dev/cloudagent/core/diagrams/ui` and
  `/Users/abdul/dev/cloudagent/core/diagrams/icons`.
- Extracted diagram spec helpers under `/Users/abdul/dev/cloudagent/core/workloads`.
- Extracted blueprint planning, rewrite validation, execution context, and
  blueprint-builder helpers under `/Users/abdul/dev/cloudagent/core/skills`.
- Extracted local CloudAgent tool factories and local utility helpers under
  `/Users/abdul/dev/cloudagent/core/cloudagent-tools`, with the local
  CloudAgent core runner under `/Users/abdul/dev/cloudagent/core/cloudagent`.
- Extracted AWS discovery, health, threat, and cost scanner engines under
  `/Users/abdul/dev/cloudagent/core/scanners`.
- Extracted the local MCP streamable HTTP router under `/Users/abdul/dev/cloudagent/core/mcp`.
- Local scanner route and launcher copied into `apps/api/src/modules/scanners`.
- Local API route orchestration and support modules copied into `apps/api/src/modules/*`.

The API now boots a native local Express app by default. The old backend bridge
is no longer hardcoded; if it is explicitly needed during migration, set both
`CLOUDAGENT_USE_LEGACY_API_BRIDGE=1` and `CLOUDAGENT_LEGACY_BACKEND_ENTRY`.

The native local API now owns:

- `/healthz`
- `/local/*`
- executive summaries
- workload discovery
- diagrams
- scanner launch/result routes
- command center routes
- local workflow scheduler startup
- local MCP router
- static dashboard serving

The native API no longer imports runtime modules from
`/Users/abdul/dev/cloudagent_backend` or `/Users/abdul/dev/cloud_agent` in local
mode. External source-tree references should only appear as documentation,
comments, or explicit user-provided legacy bridge configuration.

The UI is no longer the placeholder migration screen. It now builds from the
current dashboard source copied from `/Users/abdul/dev/cloud_agent/src`, with
public assets copied into `apps/ui/public`. This is intentionally broad for the
first migration pass; later passes should remove hosted-web routes and cloud-only
dependencies from the desktop UI package.

## Run Command

From `/Users/abdul/dev/cloudagent`:

```bash
npm install
CLOUDAGENT_LOCAL_DATA_DIR=/tmp/cloudagent-local-test OPENAI_API_KEY=... npm run electron:local:build
```

The same Electron scripts can also be run from
`/Users/abdul/dev/cloudagent/cloudagent-desktop`; they proxy to the parent
workspace root.

During migration you can override the backend explicitly:

```bash
CLOUDAGENT_BACKEND_ENTRY=/Users/abdul/dev/cloudagent/cloudagent-desktop/apps/api/src/index.mjs npm run electron:local:build
```

## Next Migration Steps

1. Trim desktop UI routes to dashboard-only and remove hosted-only dependencies.
2. Split scanner cloud-persistence wrappers from local scanner execution so S3
   and DynamoDB cache helpers are clearly cloud-only.
3. Replace remaining AWS SDK v2 health-check helpers with AWS SDK v3 equivalents
   where practical.
4. Add focused regression tests for local API routes, scanner package imports,
   MCP loopback auth behavior, blueprint runs, and workflow execution.
5. Revisit package boundaries after UI trimming to move app-specific adapters
   out of `apps/api` only when they become shared.
