# CloudAgent Console

**An open source desktop workspace that centralizes your cloud infra context and puts AI agents to work with it.**

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.19-brightgreen.svg)](#quick-start)
[![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Windows-lightgrey.svg)](#status-and-roadmap)

CloudAgent Console discovers your AWS accounts and workloads, maps architecture, cost, health, and security signals to them, and makes that context available to AI agents — through its own desktop UI or over a local MCP server. It works with **Claude Code**, **Codex CLI**, **Cursor Agent**, and the native CloudAgent runner.

![CloudAgent Console Overview](docs/assets/cloudagent-console-overview.png)

> **Early-stage project.** Feedback and contributions are welcome — [open an issue](https://github.com/cloudagent-inc/cloudagent-console/issues) if something breaks or you want a feature that isn't here yet.

## Why

AI agents are only as useful as the context they have. Without shared cloud context, every session starts cold: architecture notes are pasted manually, resources are rediscovered repeatedly, and cost, health, or compliance signals get missed entirely.

CloudAgent Console keeps that context in one persistent local workspace, so any agent you point at it starts warm.

## What you can do

<table>
  <tr>
    <td width="25%">
      <img src="docs/assets/workload-diagram.png" alt="Workload Diagram Example" width="100%" />
      <br />
      <strong>Workload diagrams</strong>
    </td>
    <td width="25%">
      <img src="docs/assets/cost-dashboard.png" alt="Cost Dashboard" width="100%" />
      <br />
      <strong>Dashboards and insights</strong>
    </td>
    <td width="25%">
      <img src="docs/assets/command-center.png" alt="Command Center" width="100%" />
      <br />
      <strong>Command center</strong>
    </td>
    <td width="25%">
      <img src="docs/assets/agent-codex-example.png" alt="Agent Running Example" width="100%" />
      <br />
      <strong>Agent runs and history</strong>
    </td>
  </tr>
</table>

- **Document your cloud:** discover accounts and workloads, generate diagrams, and keep architecture notes attached to the resources they describe.
- **Run agents with guardrails:** create skills, run them with any supported agent, compare results across runtimes, and review full run history — with scoped permissions and approval controls.
- **Serve context over MCP:** expose approved workload, environment, and cloud data to any MCP-compatible agent or tool on your machine.
- **Investigate signals:** cost, health, threat, inventory, and scanner data collected per workload, ready for analysis.
- **Make it repeatable:** turn one-off sessions into skills and workflows your future self (or team) can run again.

## How it works

There are two ways to use it, backed by one shared local workspace:

- **Desktop console** — configure cloud environments, run discovery, browse dashboards, manage diagrams and notes, and create and run agent skills from the UI.
- **Local MCP server** — let external agents (Claude Code, Cursor, or any MCP client) pull workload context, documentation, diagrams, and scanner output directly, without rediscovering it themselves.

Everything runs on your machine: model inference uses your API keys, cloud discovery uses your existing cloud credentials, and all data stays in a local workspace.

## Quick start

**You'll need:**

- Node.js `20.19.0` or newer, and npm
- An **OpenAI API key** — used by the native CloudAgent runner, skill generation, and AI-assisted analysis (Claude Code, Codex, and Cursor use their own auth)
- **AWS CLI** installed and configured, if you want account discovery and cloud insights
- macOS or Windows

There's no packaged installer yet — running from source is the supported path for now:

```bash
git clone https://github.com/cloudagent-inc/cloudagent-console.git
cd cloudagent-console
npm install
npm start
```

This builds the desktop UI and launches the app. (Alternatively, `npm run setup:local` does the same in one command and checks your Node version first.)

**Then, in the app:**

1. Open **Preferences** — add your OpenAI key, confirm the local data directory, and optionally set CLI paths for AWS CLI, Claude Code, Codex, or Cursor. Agents whose CLIs aren't installed simply won't be used.
2. Open **Cloud Setup** — add an AWS account or organization and run discovery.
3. Open **Workloads** — review what was discovered and start documenting.

## Status and roadmap

**Supported today:** AWS · macOS and Windows (from source) · Claude Code, Codex CLI, Cursor Agent, and the native CloudAgent runner.

**Planned:**

- Azure and Google Cloud support
- GitHub and GitLab context integrations
- A hardened packaged installer for public desktop downloads
- More scanner, cost, health, threat, and compliance data sources
- Repeatable workflows and agent-assisted runbooks
- More flexible MCP and agent-runtime attachment points

## Contributing

Contributions are welcome — especially bug reports with clear reproduction steps, documentation improvements, new cloud providers or data-source integrations, and focused pull requests scoped to one feature or fix. See [CONTRIBUTING.md](CONTRIBUTING.md).

Before opening a pull request, run the relevant local checks for the area you changed. For UI or desktop changes, start with:

```bash
npm --workspace @cloudagent/desktop-ui run build
```

## Documentation

- [Changelog](CHANGELOG.md)
- [Desktop app architecture and packaging](cloudagent-desktop/README.md)
- [MCP server and tools](core/mcp/README.md)
- [Skills: building, creating, and managing skills](core/skills/README.md)
- [Managing cloud environments and workloads](core/workloads/README.md)
- [Dashboards and insights: cost, health, and threat](cloudagent-desktop/apps/ui/README.md)
- [Scanners and data collection](core/scanners/README.md)
- [Supported agent runtimes](core/agent-runtime/README.md)
- [CloudAgent orchestration](core/cloudagent/README.md)
- [Workflows](core/workflows/README.md)

## License

[Apache 2.0](LICENSE)
