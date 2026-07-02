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
- `../core/skills` - Blueprint parser, review, rewrite, and execution engine.
- `../core/workflows` - Workflow schemas, scheduler, manager, and runner.
- `../core/workloads` - Workload models, discovery, and health aggregation.
- `../core/storage` - Local file storage now, SQLite adapter later.
- `../core/mcp` - Local MCP server and MCP tool exposure.
- `../core/scanners` - Scanner contracts, job runner, and scanner adapters.
- `docs` - Migration and architecture plans.
- `tools/migration` - Migration scripts and compatibility helpers.

See `docs/cloudagent-desktop-migration-plan.md` for the migration plan.

## Current Runtime

The desktop app runs as a local-first Electron application:

- `apps/desktop` starts Electron and launches the local API in-process.
- `apps/api` serves the local HTTP API and the built Vite UI.
- `apps/ui` provides the dashboard experience.
- `../core/*` packages provide shared local runtime behavior.

Runtime settings are configured in the desktop **Preferences** page. Required
user setup should not depend on shell environment variables.

## Local Run

From `/Users/abdul/dev/cloudagent`:

```bash
npm install
npm run electron:local:build
```

On first run:

1. Open **Preferences**.
2. Add the OpenAI provider key and model.
3. Confirm the local data directory.
4. Check local readiness for optional tools such as AWS CLI, Codex, Claude Code,
   and Cursor Agent.
5. Add an AWS environment under **Cloud Setup** when you want local account
   discovery, scans, and workload analysis.

Useful developer overrides:

```bash
CLOUDAGENT_BACKEND_ENTRY=/Users/abdul/dev/cloudagent/cloudagent-desktop/apps/api/src/index.mjs
CLOUDAGENT_FRONTEND_DIST_DIR=/Users/abdul/dev/cloudagent/cloudagent-desktop/apps/ui/dist
CLOUDAGENT_OPEN_DEVTOOLS=1
CLOUDAGENT_LOCAL_MCP_ENABLED=true
```

These overrides are for development only. The app should remain usable when
launched without terminal-provided environment variables.

## Packaging

Packaging uses a staged app directory so the installer does not include the
entire monorepo.

```bash
npm run desktop:package:stage
npm run desktop:package:install
```

The staged app is written to:

```text
cloudagent-desktop/release/app
```

It contains:

- Electron main/preload source from `apps/desktop/src`
- local API source from `apps/api/src`
- built UI assets from `apps/ui/dist`
- runtime `core/*` packages
- production Node dependencies installed into the staged app

Build platform artifacts with:

```bash
npm run dist:mac
npm run dist:win
```

The electron-builder config lives at
`apps/desktop/electron-builder.yml`. Output is written to
`cloudagent-desktop/release/dist`.
