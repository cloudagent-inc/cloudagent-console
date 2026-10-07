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
  the API and authenticates via a browser session cookie. The optional app
  password uses the same login screen as browser access.
- Keeps only a `{ "localDataDir": "…" }` pointer in `desktop-settings.json`
  under the stable `CloudAgent Console` Electron `userData` path. All desktop
  preferences, including MCP on/off and the password record, live in the
  local data folder's `settings.json` under `desktop`. Old preference fields
  in the pointer and files in older Electron locations are ignored. Missing
  settings or desktop preferences use defaults: MCP on and password off.
- Establishes the `CloudAgent Console` application identity before Electron
  becomes ready, so the native application menu and window title use the
  product name. The macOS Dock tooltip is owned by the OS application bundle;
  it uses `CloudAgent Console` in packaged builds, while source runs still use
  Electron's development bundle.
- Defaults new local workspaces to `.cloudagent/local-data` under the current
  user's home directory on macOS, Windows, and other supported development
  platforms. Existing saved directory choices continue to take precedence.
- Checks the renderer origin and authenticated session before handling IPC
  requests: runtime info (API base URL,
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

## Optional app password

Enable **Preferences → Security → Require password at launch** to protect
the desktop UI, browser sessions, and local MCP startup. Protection is off by
default. Security settings store a salted scrypt hash in
`settings.json` under `desktop.security` in the selected local data folder;
passwords are verified in the in-process API, outside the renderer. The HTTP
server remains available for login while workspace services and MCP are locked.
Unlock lasts until the process fully quits. On macOS, closing the window keeps
the process running; use Quit to end the unlocked launch.

Changing or disabling protection requires the current password. This does not
encrypt workspace files. See the API README for session behavior and manual
recovery when a password is forgotten.

## Data folder changes

Selecting a new folder copies desktop preferences into that folder's existing
`settings.json` before updating the pointer. The destination's model settings,
UI settings, and workspace records remain intact. Protection follows the app;
a destination with a different enabled password is rejected rather than
overwriting its lock. The active workspace remains in use until restart, and
MCP/security preference edits are blocked while that restart is pending.

Damaged existing settings fail closed. Missing `settings.json` at startup
creates default settings with MCP on and password protection off; passwords
and preferences from older application-data files are never imported.
