# CloudAgent Console

This folder contains the CloudAgent Console desktop app: a local-first
Electron application for onboarding cloud environments (AWS today),
discovering workloads, and running work through AI agents — either the
built-in CloudAgent runner or external CLI agents (Codex, Claude Code,
Cursor Agent).

Everything runs and stores data on the user's machine. There is no hosted
backend; the app was migrated from a SaaS product and the remaining shared
engines live in `../core/*`.

## Structure

- `apps/desktop` — Electron main/preload: window lifecycle, per-launch API
  auth token, desktop preferences, packaging scripts.
- `apps/api` — the local HTTP API (Express). Started in-process by the
  Electron shell; serves the built UI, all domain APIs, and the local MCP
  server. See `apps/api/README.md` for the module map and security model.
- `apps/ui` — the React/Vite dashboard.
- `../core/*` — shared engine packages (storage, scanners, skills, agent
  runtime, MCP, tools, diagrams). See `../core/README.md`.
- `tools/migration` — migration scripts and compatibility helpers.
- `release/` — staged app + installer output (generated, git-ignored).

## Runtime model

- `apps/desktop` starts the API in-process on `127.0.0.1` (random port)
  and loads the UI from it — UI and API are same-origin.
- Requests are authenticated with a per-launch token delivered to the UI
  as an `HttpOnly` cookie; the API also enforces a Host-header allowlist
  and ships with CORS disabled. See `apps/api/README.md`.
- External CLI agents launched by the app connect back over MCP using a
  tokenized URL the app generates for them.

Runtime settings are configured in the desktop **Preferences** page.
Required user setup should not depend on shell environment variables.

## Local run

From the repository root:

```bash
npm install
npm start
```

On first run:

1. Open **Preferences**.
2. Add the OpenAI provider key and model.
3. Confirm the local data directory.
4. Check local readiness for optional tools such as AWS CLI, Codex,
   Claude Code, and Cursor Agent.
5. Add an AWS environment under **Cloud Setup** when you want local
   account discovery, scans, and workload analysis.

Useful developer overrides (development only — the app must remain usable
without any of these):

```bash
CLOUDAGENT_BACKEND_ENTRY=cloudagent-desktop/apps/api/src/index.mjs
CLOUDAGENT_FRONTEND_DIST_DIR=cloudagent-desktop/apps/ui/dist
CLOUDAGENT_OPEN_DEVTOOLS=1
CLOUDAGENT_LOCAL_MCP_ENABLED=true
CLOUDAGENT_API_TOKEN=...        # pin the API auth token for scripting
CLOUDAGENT_DEV_ORIGIN=...       # allow CORS for the Vite dev server
CLOUDAGENT_DEV_NO_AUTH=1        # disable API auth (dev only, loud warning)
```

## Packaging

Packaging uses a staged app directory so the installer does not include
the entire monorepo.

```bash
npm run desktop:package:stage
npm run desktop:package:install
```

The staged app is written to `cloudagent-desktop/release/app` and
contains the Electron main/preload source, the local API source, built UI
assets, runtime `core/*` packages, and production Node dependencies.

Build platform artifacts with:

```bash
npm run dist:mac
npm run dist:win
```

The electron-builder config lives at `apps/desktop/electron-builder.yml`.
Output is written to `cloudagent-desktop/release/dist`.
