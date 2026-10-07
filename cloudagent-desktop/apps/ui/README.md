# CloudAgent Console UI

`cloudagent-desktop/apps/ui` contains the React/Vite dashboard used by
CloudAgent Console. In the desktop app it is served by the local API
(`../api`), so it is same-origin with the API and authenticates
through an HttpOnly session cookie. With optional password protection enabled,
`LocalAuthGate` shows the shared desktop/browser unlock screen before mounting
the app or making workspace requests. UI code does not handle session tokens.

## Main areas

- **Command Center** — primary CloudAgent interaction surface, including a
  toggleable live terminal for native and external-agent CLI activity.
- **Workloads** — discovered workloads, workload details, diagrams, and
  documentation.
- **Cloud Setup** — cloud environment onboarding and AWS discovery.
- **Preferences** — OpenAI settings, local data path, MCP settings, and
  optional CLI agent paths. **Security** enables, changes, or disables the app
  password through a separate save action. These desktop preferences are stored
  alongside user/model settings in the selected data folder's `settings.json`.
- **Insights** — cost, health, threat, and executive summary dashboards.
- **Skills & Agents** — skill management and agent run history.

## Source layout

- `src/pages/` — routed views (Dashboard, Agent, Workflow, Settings,
  Libraries).
- `src/components/` — shared components (workload views, wizards, modals).
- `src/features/` — Redux Toolkit slices per domain (auth = the local user
  profile store, workloads, health, cost, threat, chat, …).
- `src/api/` — API clients over `fetch` (`api/clients/httpClient.js` is
  the shared request helper).
- `src/runtime/cloudAgentRuntime.js` — reads the `window.cloudAgentRuntime`
  bridge injected by the Electron preload (API base URL, capability
  flags); falls back to `window.location.origin`.
- `src/helpers/`, `src/hooks/`, `src/lib/` — domain helpers (IAM/CFN
  templates for onboarding, GitHub integration, readiness checks).

## Development

`npm run dev:desktop-ui` (repo root) starts Vite. The dev server runs on
a different origin than the API, so start the API with
`CLOUDAGENT_DEV_ORIGIN=http://localhost:5173` (CORS) and either
`CLOUDAGENT_DEV_NO_AUTH=1` or a pinned `CLOUDAGENT_API_TOKEN`. Point the
UI at the API with `VITE_CLOUDAGENT_API_BASE_URL`. The packaged app needs
none of this.
