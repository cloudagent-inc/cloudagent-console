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

Requests are authenticated with a per-launch token:

- The Electron shell generates a random token and passes it to the app
  factory; standalone runs generate their own (or use `CLOUDAGENT_API_TOKEN`).
- Serving the app shell sets the token as an `HttpOnly; SameSite=Strict`
  cookie, so the same-origin UI authenticates transparently.
- API clients may also send `Authorization: Bearer <token>` or
  `X-CloudAgent-Token`. `/mcp` and SSE stream routes additionally accept
  `?token=` (spawned CLI agents receive their MCP URL with the token
  embedded).
- A Host-header allowlist (`127.0.0.1`, `localhost`, `::1`) blocks DNS
  rebinding; CORS is disabled by default.
- Standalone launches reject non-loopback listen hosts.
- The app shell uses a restrictive Content Security Policy and other browser
  hardening headers.
- Only `/healthz`, static assets, and the app shell are unauthenticated.

## Environment variables (development only)

- `CLOUDAGENT_API_TOKEN` — pin the auth token (useful for curl/scripts).
- `CLOUDAGENT_DEV_ORIGIN` — allow CORS for one origin (Vite dev server).
- `CLOUDAGENT_DEV_NO_AUTH=1` — disable the auth gate (logs a warning).
- `CLOUDAGENT_LOCAL_MCP_ENABLED` — enable/disable the MCP server.

The desktop shell passes its saved local-data-directory preference directly to
the API. Standalone API launches use the storage package's default local data
directory; no environment variable overrides either path.

## Run standalone

```bash
npm --workspace @cloudagent/desktop-api run start:local
```
