# CloudAgent MCP

`core/mcp` (npm: `@cloudagent/mcp`) implements the local MCP server
(Model Context Protocol, Streamable HTTP transport) that CloudAgent
Console mounts at `/mcp`. It lets compatible AI agents — including the
Codex/Claude Code/Cursor Agent processes the console itself spawns — query
CloudAgent context and operate on approved local data without direct
access to internal files or APIs.

## How it works

- The desktop API (`cloudagent-desktop/apps/api`) mounts the router from
  this package and supplies the tool factory
  (`apps/api/src/modules/cloudagent/cloudagent-tools.mjs`, built on
  `@cloudagent/cloudagent-tools`).
- Exposed tools are limited to the `CLOUDAGENT_MCP_TOOLS` allowlist
  defined in `@cloudagent/agent-runtime`.
- Tool events are forwarded to the API's event bus so agent-run views can
  stream tool activity live.

## Available tools

### Cloud environments (permission profiles)

| Tool | Purpose |
| --- | --- |
| `permission_profile_list` (alias `list_permission_profiles`) | List onboarded cloud environments of all supported types (AWS accounts, Azure tenants/subscriptions, Google Workspace). Credential values are never returned. |
| `get_permission_profile` | Fetch one profile by ID with deployment summary and available insights. |

### Workloads

| Tool | Purpose |
| --- | --- |
| `list_workloads` | List workloads with top-level info, deployment summary, and available insights. |
| `get_workload` | Full details for one workload by ID. |
| `update_workload` | Create a workload (omit `workloadId`) or update an existing one — how agents record architecture context and documentation. |

### CLI sessions (cloud operations)

Persistent local shell sessions bound to a selected environment's
credentials — how agents run AWS CLI (and other) commands.

| Tool | Purpose |
| --- | --- |
| `cli_session_start` | Start or reuse a run-scoped session bound to an account/profile/region (defaults to the current run context). |
| `cli_session_execute` | Execute a shell command in the session's working directory with the environment's credentials and stream terminal lifecycle/output events. |
| `cli_session_status` | Check a session's status. |
| `cli_session_end` | End the session and clean up its working directory. |

Agents should keep the `cliSessionId` returned by `cli_session_start` and pass
it to later execute/status/end calls. ID-less execution uses the trusted MCP run
scope plus environment/profile/region to reuse an exact session when possible.
The desktop API owns the workspace beneath its selected local data directory;
external-agent run directories remain separate.

### Insights artifacts

| Tool | Purpose |
| --- | --- |
| `list_artifacts` | List available inventory, health, cost, threat, and executive-summary artifacts (metadata + references only). |
| `launch_artifact` | Kick off local generation of a health, cost, or threat artifact. |
| `get_artifact` | Retrieve a generated artifact's content. |

### Deployment

| Tool | Purpose |
| --- | --- |
| `aws_cfn_operations` | Run cfn-lint and the selected mapped CloudFormation Guard rules, then create/update a stack via `aws cloudformation deploy` when validation permits. |
| `get_deployment_preferences_summary` | Human-readable summary of the user's deployment preferences for a target environment. |
| `architecture_templates` | Fetch a standard CloudFormation template by ID (`static_website`, `web_app_ecs_fargate`, `rds_mysql_with_secret`, `vpc_two_az`). |

### Diagrams

| Tool | Purpose |
| --- | --- |
| `diagram_spec` | Generate or update an editable cloud diagram spec (DiagramSpec JSON), with session-based follow-up edits. |

### Workflows, skills, and run history

| Tool | Purpose |
| --- | --- |
| `list_workflow_defs` | List saved workflow definitions. |
| `list_workflow_runs` | List workflow run history (summary fields). |
| `get_workflow_run` | Full details of one workflow run. |
| `list_skills` | List saved custom skills. |
| `list_agent_history` | List agent run history (summary fields). |
| `get_agent_run` | Full details of one agent run. |

### GitHub (local checkouts)

Used for delivery flows against repositories configured in workload or
environment deployment preferences.

| Tool | Purpose |
| --- | --- |
| `list_github_repos` | List configured GitHub repositories. |
| `read_github_file` | Read a file or directory from a local repository checkout. |
| `create_github_branch` | Create/reset a branch from a base ref in a local checkout. |
| `write_github_file` | Create or update a file in a local checkout and commit it. |
| `create_github_pull_request` | Open a PR from a local checkout using the GitHub CLI (`gh`). |

### Terraform/OpenTofu validation

| Tool | Purpose |
| --- | --- |
| `terraform_plan_check` | Run an ephemeral, non-locking plan with workload environment credentials, filter Trivy findings to selected workload guardrails, and return a PR-safe report. It never applies changes. |

## Access

The `/mcp` endpoint requires the console's per-launch API token
(`?token=` query parameter or `Authorization` header). When the console
spawns a CLI agent, it writes an MCP config for it with the tokenized URL
included, so no manual setup is needed. Users can enable or disable the
MCP server from **Preferences**; the tokenized URL shown there can be used
to connect external MCP clients manually.

## Related code

- `src/index.mjs` — MCP server + Express router.
- `../cloudagent-tools` — tool implementations.
- `../agent-runtime` — the MCP tool allowlist and runner contracts.
- `../../cloudagent-desktop/apps/api/src/modules/cloudagent/cloudagent-tools.mjs`
  — binds the tools to the local store and event bus.
