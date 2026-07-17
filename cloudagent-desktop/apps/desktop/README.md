# CloudAgent Desktop Shell

`cloudagent-desktop/apps/desktop` is the Electron shell for CloudAgent
Console.

## What it does

`src/main/main.mjs` (the Electron main process):

- Generates the per-launch API auth token and starts the local API
  (`apps/api`) **in the same process**, bound to `127.0.0.1` on a random
  port.
- Creates the main window and loads the UI from the local API server
  (`<baseUrl>/dashboard/cloudagent`), so the renderer is same-origin with
  the API and authenticates via the token cookie the server sets.
- Persists desktop preferences (local data directory, MCP on/off) in
  `desktop-settings.json` under the Electron `userData` path.
- Handles IPC requests from the renderer: runtime info (API base URL,
  data-directory status, MCP state and tokenized MCP URL), changing the
  data directory, opening it in the OS file manager, directory pickers,
  and app restart.
- Opens only `http`/`https` external links in the system browser and compares
  parsed origins before blocking navigation away from the app.

`src/preload/preload.cjs` exposes a minimal `window.cloudAgentRuntime`
bridge (mode, capability flags, and the IPC calls above) with context
isolation and renderer sandboxing enabled and no Node integration in the
renderer.

## Packaging

`scripts/prepare-package.mjs` stages a minimal app directory at
`cloudagent-desktop/release/app` (desktop + API source, built UI assets,
runtime `core/*` packages) so installers do not include the whole
monorepo. `electron-builder.yml` is the electron-builder config; platform
artifacts are built from the repo root with `npm run dist:mac` /
`npm run dist:win` and written to `cloudagent-desktop/release/dist`.

## Development flags

- `CLOUDAGENT_OPEN_DEVTOOLS=1` — open detached devtools on launch.
- `CLOUDAGENT_BACKEND_ENTRY` / `CLOUDAGENT_FRONTEND_DIST_DIR` — override
  the API entry point or UI build directory.

The local data directory is selected only through desktop Preferences. An
environment variable cannot override it at launch.
