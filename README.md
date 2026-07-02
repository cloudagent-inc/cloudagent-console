# CloudAgent Console

CloudAgent Console is a local-first desktop console for operating cloud
environments with AI agents. It helps organize cloud data, workload context,
diagrams, scanner artifacts, and agent runs in one place so teams can reason
about cloud environments safely and securely. The long-term goal is to make this
more extensible: more data sources, more agent runtimes, and safer ways to give
agents the context they need without scattering cloud artifacts across tools.

This repository contains the desktop app plus shared CloudAgent runtime packages
used by the console today and intended to be reused by future hosted/cloud
experiences.

## Prerequisites

Required for running CloudAgent Console from source:

- Node.js `20.19.0` or newer
- npm
- Git, if you are cloning the repository locally
- An OpenAI API key available for first-run setup
- An AWS cloud environment to onboard if you want workload discovery, scans, and
  cloud insights
- AWS CLI installed and configured for the AWS accounts you want CloudAgent
  Console to inspect

The OpenAI key is entered in **Preferences** after the app starts. You do not
need to export it as an environment variable for normal local use.

## Supported AI Agents

CloudAgent Console supports the built-in CloudAgent runner and can hand off
skill runs to local coding-agent CLIs when they are installed and configured:

- CloudAgent native runner, backed by OpenAI and the OpenAI Agents SDK
- Codex CLI
- Cursor Agent
- Claude Code

Install optional agent CLIs separately, then set their paths in **Preferences**.
CloudAgent Console can run without every optional runtime installed; unavailable
tools simply will not be used.

## Install And Getting Started

### Install From Source

For a checked-out copy of the repository, run the local setup script from the
repository root:

```bash
npm run setup:local
```

The setup script installs npm dependencies, builds the desktop UI, and starts the
local Electron app. It is a source-checkout bootstrap script, not the final
downloadable desktop installer.

To install dependencies without launching the app:

```bash
npm run setup:local -- --no-launch
```

To start the app without reinstalling dependencies:

```bash
npm run setup:local -- --skip-install
```

After setup, you can also start the built local app directly with:

```bash
npm run electron:local:build
```

### First-Run Setup

1. Open **Preferences**.
2. Add your OpenAI provider key and model.
3. Confirm the local data directory.
4. Enable or disable the local MCP server.
5. Configure optional CLI paths for AWS CLI, Codex CLI, Cursor Agent, and Claude
   Code.
6. Open **Cloud Setup** and add an AWS environment.
7. Run account discovery to inventory accounts and discover workloads.

CloudAgent Console persists these settings locally. Environment variables are
developer overrides, not required setup.

## What Can You Do?

### Document Cloud Workloads

- Discover AWS accounts and workloads.
- Build workload records that centralize architecture context.
- Generate and maintain diagrams and workload documentation.
- Keep cloud architecture context available to humans and agents.

### Centralize Agent-Ready Data Artifacts

CloudAgent Console brings together data that agents need when helping operate
cloud environments:

- Cost insights
- Health signals
- Threat/security findings
- Workload inventory
- Scanner outputs
- Diagrams and architecture artifacts
- Agent run history and generated artifacts

These artifacts can be used from within CloudAgent Console and exposed through
the local MCP server for compatible agent tools.

### Generate And Manage Skills

- Create and manage CloudAgent skills.
- Use AI assistance to generate or refine skill definitions.
- Run skills with CloudAgent or supported local agent runtimes.
- Review agent output and keep run artifacts tied to the relevant cloud context.

## What Is Next?

Near-term product areas:

- Workflows for repeatable cloud operations and agent-assisted runbooks
- Broader Azure and Google Cloud support
- More external data sources and integrations
- More flexible MCP and agent-runtime attachment points
- Hardening the packaged desktop installer flow for public downloads

## More Documentation

- [Desktop app architecture and packaging](cloudagent-desktop/README.md)
- [MCP server and tools](core/mcp/README.md)
- [Skills: building, creating, and managing skills](core/skills/README.md)
- [Managing cloud environments and workloads](core/workloads/README.md)
- [Dashboards and insights: cost, health, and threat](cloudagent-desktop/apps/ui/README.md)
- [Scanners and data collection](core/scanners/README.md)
- [Supported agent runtimes](core/agent-runtime/README.md)
- [CloudAgent orchestration](core/cloudagent/README.md)
- [Workflows](core/workflows/README.md)

## Repository Structure

- `cloudagent-desktop` - local-first Electron desktop app suite.
- `cloudagent-desktop/apps/desktop` - Electron main/preload, packaging, and OS
  integrations.
- `cloudagent-desktop/apps/api` - local HTTP API runtime used by the desktop
  app.
- `cloudagent-desktop/apps/ui` - React/Vite dashboard UI.
- `core` - shared CloudAgent engines, MCP tools, scanners, workflow/workload
  modules, storage adapters, and agent tooling.
- `core/cloudagent` - CloudAgent chat orchestration and tool registry.
- `core/skills` - skill generation, planning, execution, review, and local skill
  services.
- `core/workloads` - workload models, discovery, diagrams, and health
  aggregation.
- `core/scanners` - scanner contracts, job runners, and scanner adapters.
- `core/mcp` - local MCP server and MCP tool exposure.
- `core/agent-runtime` - built-in agent runner definitions and event contracts.

The npm workspace root is this folder. Run installs and workspace commands from
here so desktop and future website apps resolve the same shared packages.

## Package CloudAgent Console

Current status: packaging configuration and staging scripts are in place, but
the distributable installer flow still needs full artifact verification plus
platform signing/notarization before it is ready for public downloads.

The packaging flow stages a minimal runtime app before invoking
`electron-builder`. The staged app includes the Electron shell, local API source,
built UI, selected `core/*` runtime packages, and production Node dependencies.

```bash
npm run desktop:package:stage
npm run desktop:package:install
```

Then build platform artifacts:

```bash
npm run dist:mac
npm run dist:win
```

macOS produces `.dmg` and `.zip` targets. Windows produces an NSIS `.exe`
installer. Public macOS distribution still requires Developer ID signing and
notarization; Windows distribution should use Authenticode signing.

Generated packaging output is written under `cloudagent-desktop/release/` and is
ignored by git.
