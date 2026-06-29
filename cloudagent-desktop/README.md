# CloudAgent Desktop

This folder is the target home for the standalone CloudAgent desktop app inside
the broader `/Users/abdul/dev/cloudagent` product monorepo.

The goal is to keep the local-first desktop product separate from the hosted
webapp/marketing code while preserving shared contracts and engines that can be
used by both local and cloud modes.

## Structure

- `apps/desktop` - Electron main/preload, packaging, OS integrations.
- `apps/api` - Local HTTP API runtime used by the desktop app.
- `apps/ui` - Dashboard-only React UI for the desktop app.
- `../core/platform` - Shared schemas, domain models, validation, and contracts.
- `../core/cloudagent` - CloudAgent chat orchestration, prompts, and tool registry.
- `../core/blueprints` - Blueprint parser, review, rewrite, and execution engine.
- `../core/workflows` - Workflow schemas, scheduler, manager, and runner.
- `../core/workloads` - Workload models, discovery, and health aggregation.
- `../core/storage` - Local file storage now, SQLite adapter later.
- `../core/mcp` - Local MCP server and MCP tool exposure.
- `../core/scanners` - Scanner contracts, job runner, and scanner adapters.
- `docs` - Migration and architecture plans.
- `tools/migration` - Migration scripts and compatibility helpers.

See `docs/cloudagent-desktop-migration-plan.md` for the migration plan.

## Current Migration Slice

This workspace now has a first runnable scaffold:

- Root npm workspaces at `/Users/abdul/dev/cloudagent`.
- Electron shell in `apps/desktop`.
- Compatibility API bridge in `apps/api`.
- Minimal Vite React UI in `apps/ui`.
- First extracted backend package: `@cloudagent/storage`, containing the local
  JSON file store copied from the current local backend.

The API still bridges to `/Users/abdul/dev/cloudagent_backend/api/index.mjs` by
default. That keeps local mode working while API modules, scanners, CloudAgent
chat, blueprints, workflows, and dashboard UI are migrated in smaller slices.

## Local Run

From `/Users/abdul/dev/cloudagent`:

```bash
npm install
CLOUDAGENT_LOCAL_DATA_DIR=/tmp/cloudagent-local-test OPENAI_API_KEY=... npm run electron:local:build
```

From this folder, the same Electron scripts proxy to the parent workspace root.

Useful overrides:

```bash
CLOUDAGENT_BACKEND_ENTRY=/Users/abdul/dev/cloudagent/cloudagent-desktop/apps/api/src/index.mjs
CLOUDAGENT_FRONTEND_DIST_DIR=/Users/abdul/dev/cloudagent/cloudagent-desktop/apps/ui/dist
CLOUDAGENT_OPEN_DEVTOOLS=1
CLOUDAGENT_LOCAL_MCP_ENABLED=true
```
