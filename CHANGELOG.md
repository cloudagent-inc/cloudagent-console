# Changelog

All notable changes to CloudAgent Console will be documented in this file.

This project follows Semantic Versioning. While CloudAgent Console is below
`1.0.0`, APIs, local data formats, workflows, packaging, and extension points may
change between minor versions.

## [Unreleased]

No unreleased changes yet.

## [0.5.0] - 2026-08-06

### Added

- Added Amazon Bedrock and Bedrock Mantle support for the AI endpoint, as an
  alternative to the OpenAI API, with curated model presets and guided setup
  in Preferences and the Getting Started wizard.
- Added support for models beyond OpenAI through those endpoints — including
  Anthropic Claude, DeepSeek, and Meta Llama — as well as the Anthropic API
  and any OpenAI-compatible custom endpoint.

## [0.4.0] - 2026-07-27

### Added

- Added a rerunnable source installer for macOS, Linux, and Git Bash on
  Windows with prerequisite validation, shallow branch or tag installation,
  locked dependency setup, UI compilation, and an optional first launch.

### Changed

- Update to a stable Electron user-data directory and a
  durable default local workspace under `~/.cloudagent/local-data`.
- Updated native CloudAgent and model-backed skill operations to resolve the
  current OpenAI key and model when each operation starts, so Preferences
  changes made after desktop startup take effect immediately.


### Fixed

- Preserved existing desktop settings by copying valid settings from legacy
  Electron user-data locations into the canonical application directory
  without deleting the original file.
- Replaced import-time placeholder OpenAI clients with actionable missing-key
  errors or existing safe analysis fallbacks.

## [0.3.0] - 2026-07-16

### Added

- Added Trivy support for Terraform/OpenTofu plan evaluation and
  CloudFormation Guard enforcement for CloudFormation templates.
- Included a shared catalog of 38 selectable infrastructure-as-code security
  checks with bundled Guard rules, audited Trivy mappings, normalized
  findings, and fail-closed CloudFormation deployment enforcement.

## [0.2.0] - 2026-07-13

### Added

- Authenticated, same-origin local API and MCP serving with per-launch tokens,
  Host-header validation, restricted CORS, and Preferences-based MCP control.
- Modular agent-run, command-center, settings, skills, workflow, scanner,
  workload, diagram, and executive-summary services backed by the local JSON
  workspace.
- Scoped CLI sessions and streaming terminal events for native CloudAgent,
  Codex CLI, Claude Code, and Cursor Agent runs.
- GitHub and infrastructure-as-code governance with protected-branch checks,
  PR-only defaults, path scopes, secret scanning, and configurable attribution.
- CloudFormation Guard validation, normalized guardrail coverage, and
  non-locking Terraform/OpenTofu plan checks.
- Source-control governance, deployment settings, readiness, error recovery,
  and stale-asset recovery surfaces in the desktop UI.
- Focused regression coverage for API authentication and assets, agent
  selection, terminal events, local-data preservation, GitHub guardrails,
  CloudFormation operations, Terraform planning, storage, and scanners.

### Changed

- Split the original monolithic local routes into domain modules and reusable
  `core/` packages while preserving the local-first desktop architecture.
- Standardized runtime, service, client, and route composition names and
  removed legacy hosted and migration-only surfaces.
- Improved first-run setup, Preferences, workload discovery, skill-library
  navigation, and embedded resource inventory behavior.
- Aligned all private workspace package metadata on version `0.2.0` and the
  Apache-2.0 license.

### Security

- Enforced loopback-only API listeners and kept API, UI, and MCP access behind
  the local token boundary.
- Enabled Electron renderer sandboxing, exact-origin navigation checks, and
  `http`/`https`-only external link handling.
- Added a restrictive script Content Security Policy and browser hardening
  headers to local responses.
- Removed the renderer's third-party connectivity probe and now rely on native
  online/offline events.
- Hardened local path handling, GitHub write guardrails, secret redaction, and
  preservation of existing user data during startup.

### Fixed

- Corrected workload discovery grouping, agent/runtime selection, terminal
  reconstruction, scanner readiness, and stale UI asset recovery edge cases.
- Replaced a registry-pinned internal diagram package dependency with its local
  workspace link so offline lockfile generation succeeds.

## [0.1.0] - 2026-07-06

### Early Preview

Initial early preview release of CloudAgent Console.

### Added

- Local-first CloudAgent Console desktop app.
- Source-checkout setup flow with `npm run setup:local`.
- Preferences-based setup for OpenAI provider settings, local data path, MCP,
  AWS CLI, Codex CLI, Cursor Agent, and Claude Code.
- AWS environment onboarding and account discovery support.
- Workload discovery, workload documentation, and architecture context support.
- Cost, health, and threat insight surfaces for cloud environment operations.
- Native CloudAgent runner backed by OpenAI and the OpenAI Agents SDK.
- External agent runtime support for Claude Code, Codex CLI, and Cursor Agent.
- Local MCP server support for exposing CloudAgent context to compatible tools.
- CloudAgent skills management and agent run history surfaces.

### Notes

- This is a pre-`1.0.0` early preview. Some workflows and extension points are
  still evolving.
- Downloadable installer packaging is in progress; running from source is the
  recommended path for this release.
