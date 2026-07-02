# CloudAgent Desktop Migration Plan

## Goal

Create a standalone `cloudagent-desktop` codebase under `/Users/abdul/dev/cloudagent/cloudagent-desktop`
that preserves the local-mode functionality currently built across:

- `/Users/abdul/dev/cloud_agent`
- `/Users/abdul/dev/cloudagent_backend`

The desktop app should be local-first, dashboard-focused, and open-source
friendly. Cloud mode should continue to exist separately, with shared contracts
and engines extracted into packages that can be consumed by both desktop and the
hosted cloud product.

## Product Boundary

The desktop app includes:

- Electron desktop shell.
- Local API server.
- Dashboard-only React UI.
- Local file-backed storage, with a future SQLite adapter.
- Local credentials and cloud setup.
- Local CloudAgent chat.
- Local MCP server.
- Local workloads, workload discovery, and diagrams.
- Local blueprints and agents.
- Local workflow library, workflow chat, workflow manager, scheduler, and runner.
- Local health, cost, and threat scanner execution.
- Local executive summaries.
- Extension framework for tools/platforms such as Datadog, Grafana, Prowler, and future providers.
- Optional future CloudAgent account login/sync client, but not the proprietary sync backend.

The desktop app should not include:

- Marketing website pages.
- Hosted SaaS-only dashboards or routes.
- AppSync/DynamoDB/Lambda-specific implementations.
- Billing/Stripe implementation.
- Hosted entitlement service implementation.
- Tenant admin/backend cloud infrastructure.
- Proprietary premium extensions unless explicitly licensed for public release.

## Target Repository Structure

```text
cloudagent/
  apps/
    desktop/
      src/
        main/
        preload/
        packaging/
      package.json

    api/
      src/
        server.ts
        modules/
          cloudagent/
          blueprints/
          workflows/
          workloads/
          cloud-setup/
          executive-summaries/
        platform/
          runtime.ts
          auth.ts
          events.ts
          jobs.ts
          storage.ts
      package.json

    ui/
      src/
        app/
        pages/
        components/
        features/
        runtime/
      package.json

  core/
    core/
      src/
        ids/
        schemas/
        models/
        validation/
        runtime/

    cloudagent/
      src/
        prompts/
        tool-registry/
        chat-runner/
        local-mode/

    blueprints/
      src/
        schema/
        parser/
        review/
        rewrite/
        runner/
        history/

    workflows/
      src/
        schema/
        manager/
        scheduler/
        runner/
        chat/
        history/

    workloads/
      src/
        schema/
        discovery/
        diagrams/
        health/
        resources/

    storage/
      src/
        contracts/
        json-file/
        sqlite/
        migrations/

    mcp/
      src/
        server/
        tools/
        auth/
        resources/

    scanners/
      src/
        contracts/
        runner/
        aws/
          inventory/
          health/
          cost/
          threat/

  docs/
  tools/
    migration/
```

## Shared Package Strategy

Shared packages should contain runtime-agnostic behavior.

Share between cloud and desktop:

- Domain models and schemas.
- Blueprint plan format, validation, review, rewrite, and execution contracts.
- Workflow definition schema and execution history model.
- Workload, environment, resource, scanner artifact, and summary schemas.
- Tool registry contracts.
- Scanner contracts and artifact contracts.
- Integration SDK contracts.
- Reusable dashboard UI primitives where they are product UI, not website UI.

Do not share directly:

- DynamoDB/AppSync adapters.
- Local JSON/SQLite adapters.
- Electron IPC.
- Lambda/container launch wrappers.
- Cloud auth and billing.
- Marketing pages and web-only routes.

Use adapter boundaries:

```text
Core engine -> storage contract -> local JSON adapter
Core engine -> storage contract -> cloud Dynamo/AppSync adapter

Scanner contract -> local process/container adapter
Scanner contract -> cloud ECS/Lambda/Step Functions adapter

Tool registry -> local tool context
Tool registry -> cloud tool context
```

## Current Source Mapping

### Desktop Shell

Move from:

- `cloud_agent/electron/main.mjs`
- `cloud_agent/electron/preload.cjs`
- `cloud_agent/package.json` Electron scripts

Move to:

- `apps/desktop/src/main/main.ts`
- `apps/desktop/src/preload/preload.ts`
- `apps/desktop/package.json`

Preserve:

- Local API bootstrap.
- Local data directory selection through `CLOUDAGENT_LOCAL_DATA_DIR`.
- OpenAI key propagation.
- Local MCP on/off state.
- Open local data folder OS action.
- Default route `/dashboard/cloudagent`.
- Devtools flag.

### Local API Server

Move from:

- `cloudagent_backend/api/index.mjs`
- `cloudagent_backend/api/local/*`
- Local route wiring in `cloudagent_backend/api/routes/*` where reused in local mode.

Move to:

- `apps/api/src/server.ts`
- `apps/api/src/modules/*`
- `apps/api/src/platform/*`

Preserve:

- Local HTTP API behavior.
- Local file store bootstrap.
- Local workflow scheduler startup.
- Local unavailable middleware for unsupported cloud-only routes.
- Local MCP route.
- Local scanner routes.
- Local command center routes.
- Local executive summary routes.
- Local workload discovery routes.
- Local diagram routes.

### UI

Move from:

- `cloud_agent/src/pages/Dashboard/*`
- `cloud_agent/src/pages/Agent/*`
- `cloud_agent/src/pages/Workflow/*`
- `cloud_agent/src/pages/Settings/Permission.jsx`
- `cloud_agent/src/pages/Settings/MyBlueprint.jsx`
- `cloud_agent/src/pages/Settings/WorkflowDetail.jsx`
- `cloud_agent/src/pages/Settings/WorkflowHistory.jsx`
- `cloud_agent/src/components/DashboardSidebar/*`
- Local-mode clients under `cloud_agent/src/api/clients/*`
- Runtime helpers under `cloud_agent/src/runtime/*`
- Local slices and helpers needed by dashboard routes.

Move to:

- `apps/ui/src/app`
- `apps/ui/src/pages`
- `apps/ui/src/components`
- `apps/ui/src/features`
- `apps/ui/src/runtime`

Preserve initial route set:

- CloudAgent.
- Workloads.
- Cost.
- Health.
- Threat Management.
- My Workflows.
- Blueprints & Agents.
- Executive Summaries.
- Cloud Setup.
- Preferences.

Exclude initially:

- Marketing pages.
- Public use-case pages.
- Signup/login web flows, except future desktop account login.
- Billing/credits pages.
- Team/admin pages.
- Hosted-only compliance and Well-Architected pages unless local support is added later.

### CloudAgent Chat

Move from:

- `cloudagent_backend/api/core/cloudagent.mjs`
- `cloudagent_backend/api/local/local-cloudagent-tools.mjs`
- Local chat handling inside `cloudagent_backend/api/local/local-routes.mjs`
- Frontend command center and chat clients.

Move to:

- `core/cloudagent/src/chat-runner`
- `core/cloudagent/src/tool-registry`
- `core/cloudagent/src/prompts`
- `apps/api/src/modules/cloudagent`
- `apps/ui/src/pages/cloudagent`

Preserve:

- Local OpenAI key usage.
- Local `cli_readonly` tool.
- Tool availability based on local mode.
- Local chat history storage.
- CloudAgent tab behavior.
- Blueprint-builder chat support.
- Workflow chat support.
- Scope/context passing.

### Blueprints and Agents

Move from:

- `cloudagent_backend/api/core/blueprint-*`
- Blueprint and local agent routes in `cloudagent_backend/api/local/local-routes.mjs`
- Local runner logic in `cloudagent_backend/api/local/local-runner.mjs`
- Codex runner in `cloudagent_backend/api/local/local-codex-runner.mjs`
- UI pages under `cloud_agent/src/pages/Agent`
- UI library pages under `cloud_agent/src/pages/Libraries`
- Blueprint state slices and clients.

Move to:

- `core/skills/src/schema`
- `core/skills/src/review`
- `core/skills/src/rewrite`
- `core/skills/src/runner`
- `core/skills/src/history`
- `apps/api/src/modules/blueprints`
- `apps/ui/src/pages/blueprints`
- `apps/ui/src/pages/agents`

Preserve:

- Exact blueprint review process from cloud mode:
  - mutating vs read-only analysis
  - execution scope analysis
  - workload/environment target resolution
  - CLI vs CloudFormation vs Codex/local execution mode
  - rewrite/validation flow
  - final run summary generation
- Local runner support for blueprint tasks.
- Agent history records.
- Blueprint/agent library.
- Custom blueprint builder.
- Local credentials format.
- Local credential validity warnings.

### Workflows

Move from:

- `cloudagent_backend/api/local/local-runner.mjs`
- `cloudagent_backend/api/local/local-workflow-scheduler.mjs`
- Workflow manager route in `cloudagent_backend/api/local/local-routes.mjs`
- Frontend workflow pages/components/slices.

Move to:

- `core/workflows/src/schema`
- `core/workflows/src/manager`
- `core/workflows/src/scheduler`
- `core/workflows/src/runner`
- `core/workflows/src/chat`
- `core/workflows/src/history`
- `apps/api/src/modules/workflows`
- `apps/ui/src/pages/workflows`

Preserve:

- Local workflow library.
- Workflow run history.
- Workflow chat.
- Workflow manager event handling.
- Local scheduler that runs only while the desktop app is open.
- Report-task behavior that runs scanners, not generic cloud tasks.
- Cloud-task behavior using local CloudAgent runner.
- Decision-node branch evaluation.
- Communication nodes, including email summary generation when configured.
- Stop-on-failed-node behavior.
- Credential warnings before selecting/running environments.

### Workloads

Move from:

- `cloudagent_backend/api/local/aws-local-discovery.mjs`
- workload routes and store functions in local backend.
- `cloud_agent/src/pages/Dashboard/Workloads.jsx`
- `cloud_agent/src/pages/Dashboard/WorkloadDetails.jsx`
- workload slices and helpers.
- diagram generation routes.

Move to:

- `core/workloads/src/schema`
- `core/workloads/src/discovery`
- `core/workloads/src/resources`
- `core/workloads/src/health`
- `core/workloads/src/diagrams`
- `apps/api/src/modules/workloads`
- `apps/ui/src/pages/workloads`

Preserve:

- Discover workloads.
- Quick add / quick add all.
- Add with wizard with discovered workload name prefilled.
- Local workload create/edit/delete.
- Local workload resource tracking.
- Diagram generation.
- Health status shown on workload list.
- Auto health refresh when workloads are added and on login if stale.

### Cloud Setup

Move from:

- `cloud_agent/src/pages/Settings/Permission.jsx`
- AWS local discovery and credential validation routes.
- workspace components under `cloud_agent/src/components/WorkspacesTab`.

Move to:

- `apps/api/src/modules/cloud-setup`
- `apps/ui/src/pages/cloud-setup`
- `core/platform/src/models/environment`
- `core/storage/src/contracts`

Preserve:

- AWS-only initial local provider support.
- Static temporary credential paste/import.
- AWS config/profile import.
- AWS SSO through CLI profile support.
- Credential validation on app start.
- Credential status persisted on environment record.
- Warning beside invalid environments.
- No scanner startup if credentials are invalid.
- Workspaces under Cloud Setup.
- Launch workload discovery after adding a new environment if credentials are valid.

### Scanners

Move from:

- `cloudagent_backend/api/local/local-scanner-*`
- `cloudagent_backend/scanners/aws/*`
- scanner routes in backend.
- cost/health/threat frontend slices/pages.

Move to:

- `core/scanners/src/contracts`
- `core/scanners/src/runner`
- `core/scanners/src/aws/inventory`
- `core/scanners/src/aws/health`
- `core/scanners/src/aws/cost`
- `core/scanners/src/aws/threat`
- `apps/api/src/modules/*` where module-specific route integration is needed.

Preserve:

- Health dashboard.
- Cost dashboard.
- Threat dashboard.
- Scanner launch/result routes.
- Scanner dependency packaging.
- Local artifacts saved to file storage.
- Report-task scanner execution for workflows.
- Credential gating before scanner launch.
- Refresh preferences for scan, health, cost, and threat data.

### MCP Server

Move from:

- `cloudagent_backend/api/routes/mcp-router.mjs`
- local MCP guards in `cloudagent_backend/api/index.mjs`
- Electron MCP toggle bridge.

Move to:

- `core/mcp/src/server`
- `core/mcp/src/tools`
- `core/mcp/src/resources`
- `apps/api/src/modules/cloudagent/mcp-routes.ts` or `apps/api/src/platform/mcp.ts`
- `apps/desktop/src/main/mcp-toggle.ts`

Preserve:

- Local MCP server enabled by default.
- Top-bar MCP indicator and toggle.
- `/mcp` disabled response when off.
- Local auth bypass for desktop local user.
- Tool exposure from the local tool registry.

### Executive Summaries

Move from:

- `cloudagent_backend/api/local/local-routes.mjs`
- `cloudagent_backend/api/routes/executive-summary-router.mjs` where reusable.
- `cloud_agent/src/pages/Dashboard/ExecutiveSummaries.jsx`
- frontend executive summary API/client/slice.

Move to:

- `apps/api/src/modules/executive-summaries`
- `apps/ui/src/pages/executive-summaries`
- `core/platform/src/models/executive-summary`

Preserve:

- Local OpenAI-backed summary generation.
- Account and workload summary support.
- Local file-backed summary records.
- Dashboard integration.

## Extension Architecture

Extensions are installable provider/tool packages with a manifest. Do not
scaffold placeholder extension packages until a concrete provider is being
implemented.

```text
core/extensions/<name>/
  manifest.ts
  credentials/
  tools/
  scanners/
  workflow-nodes/
  blueprints/
  ui/
  README.md
```

Manifest example:

```ts
export default {
  id: "datadog",
  name: "Datadog",
  version: "0.1.0",
  capabilities: {
    tools: true,
    scanners: true,
    workflowNodes: true,
    uiPanels: true,
  },
  credentials: [
    {
      type: "api-key",
      fields: ["apiKey", "appKey", "site"],
    },
  ],
  artifactTypes: [
    "datadog.monitor",
    "datadog.service",
    "datadog.incident",
  ],
};
```

Extension contracts:

- `ToolProvider`: exposes chat/MCP/workflow callable tools.
- `ScannerProvider`: runs background collection and returns artifacts.
- `CredentialProvider`: validates and normalizes credentials.
- `WorkflowNodeProvider`: contributes node types or node actions.
- `DashboardExtension`: contributes optional dashboard views/panels.
- `BlueprintProvider`: contributes blueprint templates.

Initial built-in extensions:

- `aws`: existing AWS credentials, discovery, scanner, CLI, workload, and blueprint support.
- `prowler`: local security scan integration through scanner contract.
- `datadog`: observability integration through tools/scanners.
- `grafana`: dashboards/metrics integration through tools/scanners.

## Future Login and Sync Boundary

The public desktop repo may include:

- Login UI.
- OAuth/device-flow client.
- Sync client protocol.
- Entitlement client interface.
- Local feature display based on backend capabilities.

The private cloud repo should keep:

- Sync API implementation.
- Billing and Stripe.
- Entitlement service.
- Hosted scanner execution.
- Tenant isolation and cloud data storage.
- Proprietary premium integrations.

Backend enforcement rule:

- The desktop app can show or hide premium features.
- The cloud backend must enforce all premium access.
- Do not rely on client-side gates for anything commercial.

## Migration Phases

### Phase 0: Freeze Current Local Mode Behavior

Purpose: establish a known-good baseline before moving files.

Tasks:

- Record the current launch command.
- Record required environment variables:
  - `CLOUDAGENT_LOCAL_DATA_DIR`
  - `OPENAI_API_KEY` / `OPENAI_TOKEN`
  - any scanner-specific variables
- Capture smoke-test flows:
  - app starts at CloudAgent tab
  - add AWS environment
  - validate credentials
  - discover workloads
  - create workload
  - generate diagram
  - run CloudAgent chat with `cli_readonly`
  - run blueprint interactively
  - run blueprint background
  - create custom blueprint
  - run workflow with report task
  - run health/cost/threat refresh
  - generate executive summary
  - MCP on/off toggle
  - open local data folder

Exit criteria:

- A written smoke-test checklist exists.
- Current local mode is confirmed working before migration starts.

### Phase 1: Repo Bootstrap

Tasks:

- Add workspace package manager config.
- Add root `package.json`.
- Add TypeScript/Vite/Electron build tooling.
- Add lint/build scripts.
- Add shared path aliases.
- Add basic CI commands.
- Add license and contribution docs when public release is ready.

Exit criteria:

- `npm install` or selected package-manager install works.
- Empty apps/packages build or typecheck.

### Phase 2: Move Electron Shell

Tasks:

- Move Electron main/preload into `apps/desktop`.
- Preserve local API startup.
- Preserve local data dir and OpenAI key handling.
- Preserve MCP toggle IPC.
- Preserve open local folder IPC.
- Preserve startup route `/dashboard/cloudagent`.
- Replace hard-coded relative paths with workspace package resolution.

Exit criteria:

- Electron starts and loads a placeholder UI from the new repo.
- Local API starts on random localhost port.
- Local data dir is resolved correctly.

### Phase 3: Move Local API and Storage

Tasks:

- Move `LocalJsonFileStore` to `core/storage/src/json-file`.
- Define storage contracts in `core/storage/src/contracts`.
- Move local API server to `apps/api`.
- Move local route groups into `apps/api/src/modules`.
- Split large local routes by concept:
  - cloud setup
  - workloads
  - cloudagent
  - blueprints
  - workflows
  - executive summaries
- Keep a compatibility route layer for current frontend calls during migration.

Exit criteria:

- `/local/bootstrap` works.
- CRUD works for permission profiles, workloads, blueprints, workflows, agent history, workflow history, settings, and summaries.
- Existing local JSON data can be read without migration.

### Phase 4: Move UI Dashboard

Tasks:

- Create standalone dashboard router in `apps/ui`.
- Move only dashboard/local routes.
- Remove marketing/site pages.
- Remove cloud-only nav items unless locally supported.
- Move local API clients.
- Move required Redux slices or replace with local query/state layer.
- Preserve top bar behavior:
  - CloudAgent default tab
  - MCP indicator/toggle
  - local folder help dropdown
  - no credits in local mode
  - refresh operations panel
- Preserve sidebar local route visibility.

Exit criteria:

- UI builds in new repo.
- Electron loads dashboard from new UI.
- Navigation works for all local-supported tabs.

### Phase 5: Extract Core Contracts

Tasks:

- Define schemas in `core/platform`:
  - environment
  - workspace
  - workload
  - resource
  - blueprint
  - workflow
  - scanner artifact
  - executive summary
  - agent history
  - workflow history
  - credential status
- Replace duplicated ad hoc parsing with schema helpers.
- Keep migration adapters for older local JSON shapes.

Exit criteria:

- API and UI both import shared schemas/models.
- Existing local files continue to load.

### Phase 6: Extract CloudAgent Chat

Tasks:

- Move prompt assembly and local mode controls into `core/cloudagent`.
- Move local tool registry into `core/cloudagent`.
- Move `cli_readonly` into AWS integration or CloudAgent local tools.
- Add tool registration API.
- Port blueprint-builder chat.
- Port workflow chat.
- Port command center chat behavior.

Exit criteria:

- CloudAgent tab responds through LLM.
- `cli_readonly` executes with selected local credentials.
- Blueprint builder chat uses full local implementation.
- Workflow chat uses full local implementation.

### Phase 7: Extract Blueprints and Agents

Tasks:

- Move blueprint schema/parser/review/rewrite/validation to `core/skills`.
- Move local agent runner to `core/skills/src/runner`.
- Preserve exact cloud-mode review process where runtime-agnostic.
- Keep runtime adapters for:
  - local CLI
  - local CloudFormation
  - local Codex
  - local CloudAgent tool execution
- Move history persistence through storage contract.

Exit criteria:

- Existing local blueprints run interactively.
- Existing local blueprints run in background.
- Final summaries match current local behavior.
- Custom blueprint generation and chat work.

### Phase 8: Extract Workflows

Tasks:

- Move workflow schema and normalization.
- Move workflow manager.
- Move local scheduler.
- Move workflow runner.
- Move decision-node evaluator.
- Move communication node support.
- Ensure report tasks dispatch scanner jobs.
- Ensure cloud tasks dispatch local CloudAgent runner.

Exit criteria:

- Workflow library visible.
- Workflow run starts and records history.
- Failed node stops downstream execution.
- Report tasks produce scanner artifacts.
- Decision nodes branch correctly.
- Scheduler runs only while app is open.

### Phase 9: Extract Workloads and Diagrams

Tasks:

- Move workload schema and helpers.
- Move workload discovery.
- Move workload CRUD.
- Move workload health aggregation.
- Move diagram spec generation/persistence.
- Preserve quick add, quick add all, and add with wizard.

Exit criteria:

- Discover workloads works.
- Quick add and quick add all work.
- Wizard pre-fills discovered workload name.
- Diagrams generate for local workloads.
- Workload list shows health status.

### Phase 10: Extract Cloud Setup

Tasks:

- Move AWS credential import/validation.
- Move AWS profile and SSO discovery.
- Move credential status persistence.
- Move workspace management.
- Keep local mode AWS-only initially.
- Launch workload discovery after valid new AWS environment creation.

Exit criteria:

- AWS static credentials paste works.
- AWS SSO/profile import works.
- Credential validation runs on app start.
- Invalid credentials block scanners, agents, and workflows.
- Workspaces under Cloud Setup work.

### Phase 11: Extract Scanners

Tasks:

- Move scanner contracts to `core/scanners`.
- Move AWS scanner local runner.
- Move AWS inventory/health/cost/threat scanner code.
- Move scanner artifact persistence to storage contract.
- Add scanner dependency packaging.
- Connect dashboards to local scanner artifacts.

Exit criteria:

- Health dashboard works.
- Cost dashboard works.
- Threat dashboard works.
- Login auto-refresh follows Preferences freshness rules.
- Workload health auto-refresh works when workloads are added.

### Phase 12: Extract MCP Server

Tasks:

- Move MCP server to `core/mcp`.
- Register tools from CloudAgent/integrations registry.
- Preserve local auth bypass.
- Preserve MCP toggle.
- Expose server status in UI.

Exit criteria:

- `/mcp` works when enabled.
- `/mcp` returns disabled response when turned off.
- MCP tools can call local CloudAgent tools.

### Phase 13: Extension SDK

Tasks:

- Define integration manifest schema.
- Define credential provider contract.
- Define tool provider contract.
- Define scanner provider contract.
- Define workflow node provider contract.
- Define optional dashboard extension contract.
- Convert AWS local functionality into first built-in integration.
- Stub Datadog, Grafana, and Prowler directories with example manifests.

Exit criteria:

- New integration can register tools and scanners without editing core app code.
- AWS integration still powers current local functionality.

### Phase 14: Public Repo Readiness

Tasks:

- Remove secrets and customer-specific config.
- Add `.env.example`.
- Add local development guide.
- Add packaging guide.
- Add extension development guide.
- Add security model document.
- Add license.
- Add contribution policy.
- Add issue templates.

Exit criteria:

- A new developer can clone, install, run local app, and add a simple integration.
- No proprietary backend or premium-only implementation is included.

## Compatibility Strategy

Use a compatibility layer during migration:

```text
current UI call -> compatibility API route -> new module service
current JSON shape -> storage adapter migration shim -> new schema
current scanner output -> artifact normalizer -> new scanner artifact schema
```

Do not rewrite all call sites at once. Move one vertical slice at a time:

1. Cloud setup and storage.
2. Workloads.
3. CloudAgent chat.
4. Blueprints.
5. Workflows.
6. Scanners.
7. MCP.
8. Executive summaries.

## Recommended First Implementation Slice

Start with the smallest runnable desktop app:

1. Electron shell.
2. Local API bootstrap.
3. Local JSON store.
4. Dashboard shell and sidebar.
5. Cloud setup.
6. Credential validation.
7. CloudAgent tab with chat.
8. Workloads list with existing local data.

Then add:

1. Workload discovery.
2. Blueprint library and runner.
3. Workflow library and runner.
4. Scanners/dashboards.
5. MCP.
6. Executive summaries.

## Testing Strategy

Add tests after the migration structure stabilizes, but preserve manual smoke
tests from Phase 0 throughout.

Automated tests to add:

- Schema validation tests in `core/platform`.
- Storage adapter tests in `core/storage`.
- Blueprint review/rewrite tests in `core/skills`.
- Workflow runner tests in `core/workflows`.
- Scanner artifact normalization tests in `core/scanners`.
- API route smoke tests in `apps/api`.
- UI route smoke tests in `apps/ui`.
- Electron IPC tests for:
  - local runtime info
  - MCP toggle
  - open local folder

Manual smoke test checklist:

- App starts.
- CloudAgent tab is default.
- Local data folder opens from Help menu.
- MCP toggle disables/enables `/mcp`.
- Add AWS environment.
- Validate credentials.
- Invalid credentials block agents/workflows/scanners.
- Discover workloads.
- Add discovered workload.
- Generate diagram.
- Run health/cost/threat refresh.
- Run executive summary.
- Create custom blueprint.
- Run blueprint interactively.
- Run blueprint background.
- Run workflow with report task.
- Run workflow with cloud task.
- Scheduler runs while app is open.

## Open Decisions

- Package manager: npm workspaces, pnpm, or turbo/pnpm.
- Runtime language: keep JavaScript first or migrate package-by-package to TypeScript.
- Storage: keep JSON files until parity, then add SQLite.
- Extension loading: static package registry first, dynamic install later.
- Premium extensions: private packages, source-available packages, or SaaS-only features.
- Cloud sync: separate private backend repo with public sync client.

## Migration Rule

Do not move code just because it exists. Move code only when it belongs to a
desktop-supported workflow and has a clear owner module in the target structure.

The long-term maintenance goal is:

```text
local/cloud share contracts and engines
local/cloud do not share infrastructure adapters
desktop repo does not carry website structure
cloud repo does not carry Electron/local-only runtime code
```
