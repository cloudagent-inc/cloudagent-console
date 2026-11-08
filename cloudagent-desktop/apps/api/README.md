# CloudAgent Desktop API

`cloudagent-desktop/apps/api` is the local HTTP API that powers CloudAgent
Console. The Electron shell (`apps/desktop`) starts it **in-process** on
`127.0.0.1` with a random port and loads the built UI from it, so the UI and
API are always same-origin. It can also run standalone for development.

All state lives on the user's machine: records are stored as JSON files
through `@cloudagent/storage` (`JsonFileStore`) under the local data
directory. There is no hosted backend.

## Responsibilities

- CRUD APIs for the console's domain records: permission profiles (cloud
  credentials/auth config), workloads, workflows and workflow runs, skills,
  chat records, agent runs and their event streams.
- Launching work: the native CloudAgent runner (OpenAI Agents SDK), external
  coding-agent CLIs (Codex, Claude Code, Cursor Agent), AWS scanners, and
  scheduled workflow jobs.
- Owning run-scoped CLI sessions beneath
  `<localDataDir>/tmp/cli-sessions/` and streaming their terminal activity to
  Command Center for both native and MCP-backed external-agent runs.
- Serving the built UI (`apps/ui/dist`) and the local MCP server (`/mcp`)
  that spawned CLI agents connect back to.

## Module layout

```text
src/
  index.mjs                    App factory: middleware order, auth, mounting
  routes/api-router.mjs        Composes the /local CRUD routers
  lib/                         Shared helpers (request parsing, redaction,
                               CLI status probes)
  platform/
    openai.mjs                 OpenAI settings + local model calls
    container-runner.mjs       Container-based execution support
  modules/
    settings/                  Bootstrap, app/OpenAI/Codex settings
    permission-profiles/       Cloud credential profiles + validation
    cloud-setup/               AWS profile discovery and credential checks
    workloads/                 Workload CRUD + diagram routes
    workflows/                 Workflow CRUD, scheduler, background jobs
    skills/                    Skill CRUD + external agent runners
    chat/                      Chat records and chat endpoints
    agent-runs/                Agent run lifecycle, SSE event streams, MCP
                               URL construction for spawned agents
    command-center/            Command Center session state
    executive-summaries/       Account/workload executive summaries
    plan-builder/              Plan builder sessions
    runners/                   Native CloudAgent plan execution
    scanners/                  Scanner launch + artifact routes
    cloudagent/                CloudAgent tool wiring for the MCP server
```

Route paths (including the `/local` prefix and a few legacy paths) are kept
stable for UI compatibility; the module names above are the source of truth
for where behavior lives.

## Security model

Password protection is optional and disabled by default. Enable it in
**Preferences → Security** in Electron or a browser on the same machine.

- `/auth/status` checks the browser session. `/auth/login` verifies the password
  and issues an independent `HttpOnly; SameSite=Strict` session cookie.
- When protection is enabled, serving the dashboard does not issue credentials.
  Each browser session must authenticate; sessions live only for this server
  launch. Changing or disabling protection requires the current password and
  invalidates other browser sessions.
- The password record contains a random salt and a scrypt hash (`N=131072`,
  `r=8`, `p=1`); the plaintext password is never persisted. Failed verification
  has an increasing retry delay, capped at 30 seconds.
- While locked at startup, workspace initialization, the workflow scheduler,
  and MCP access are deferred until successful login. Afterward background work
  continues until the process quits; closing the macOS window does not quit it.
- MCP accepts a separate random per-launch credential through
  `Authorization: Bearer <token>`, `X-CloudAgent-Token`, or the existing
  `?token=` URLs used by spawned agents. Dashboard cookies and API scripting
  tokens do not authorize MCP. MCP credentials do not authorize dashboard APIs.
  Tokenized URLs remain a local compatibility mechanism, not the MCP OAuth flow.
- With protection disabled, dashboard/status requests intentionally establish
  sessions without a password. `CLOUDAGENT_API_TOKEN` also authenticates API
  scripts in this mode; it cannot bypass enabled password protection.
- Host-header checks block DNS rebinding, CORS is disabled by default, and all
  listeners remain loopback-only. Login/security routes and cookie-authenticated
  mutations reject cross-origin browser requests.
- The UI shell, assets, health check, and login/status endpoints are public;
  workspace APIs are authenticated. Electron preference IPC also checks the
  requesting renderer's origin and session.

Desktop preferences are stored in the selected local data folder's
`settings.json`, under `desktop`; the password record is `desktop.security` and
MCP preference is `desktop.localMcpEnabled`. The canonical `CloudAgent Console`
`desktop-settings.json` in the OS application-data directory contains only the
`localDataDir` pointer. Standalone API launches follow the same canonical pointer
and read preferences only from the selected folder's `settings.json`. Old
application-data preference fields and older paths are ignored. Missing settings
or desktop preferences use defaults: MCP on and password off. Invalid existing
settings fail closed.
This feature locks application access; it does **not** encrypt workspace files
or protect against someone who can edit the settings or application code.
There is no password recovery service. If you forget the password, quit all
console processes and manually remove `desktop.security` from the local data
folder's `settings.json`
(or restore an unprotected backup), then restart. Other preferences and
workspace data should be preserved.

## Environment variables (development only)

- `CLOUDAGENT_API_TOKEN` — pin the auth token (useful for curl/scripts).
- `CLOUDAGENT_DEV_ORIGIN` — allow CORS for one origin (Vite dev server).
- `CLOUDAGENT_DEV_NO_AUTH=1` — bypass API token checks only when password protection is off (logs a warning); MCP still requires its token.
- `CLOUDAGENT_LOCAL_MCP_ENABLED` — enable/disable the MCP server.

The desktop shell and standalone API follow the saved local-data-directory
pointer. If no pointer has ever been saved, they default to
`~/.cloudagent/local-data`. No environment variable overrides this path.

## Run standalone

```bash
npm --workspace @cloudagent/desktop-api run start:local
```
