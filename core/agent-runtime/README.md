# CloudAgent Agent Runtime

`core/agent-runtime` (npm: `@cloudagent/agent-runtime`) defines the
contracts shared by the UI, the desktop API, and the runners: which agent
runtimes exist and how agent-run activity is represented.

The runtime layer lets CloudAgent run work directly through the native
CloudAgent runner or hand off skill execution to supported local
coding-agent CLIs.

## Supported runners

- CloudAgent native runner (OpenAI Agents SDK, see `../cloudagent`).
- Codex CLI.
- Claude Code.
- Cursor Agent.

## External CLI launch flags

The desktop API builds these commands in
`../../cloudagent-desktop/apps/api/src/modules/skills/coding-agent-runner.mjs`.
The examples below use placeholders for the generated prompt, run directory,
session identifier, and run-scoped MCP configuration.

### Codex CLI

New runs use this command shape:

```text
codex exec -c shell_environment_policy.inherit=all --ignore-user-config [MCP -c overrides] [--sandbox <mode>] --json --skip-git-repo-check --cd <run-dir> <prompt>
```

Resumed runs use the same configuration flags followed by:

```text
resume --json --skip-git-repo-check <thread-id|--last> <prompt>
```

- `--ignore-user-config` is enabled by default. It prevents the run from
  loading `$CODEX_HOME/config.toml` while leaving Codex authentication in the
  same `CODEX_HOME`. Set `CLOUDAGENT_CODEX_IGNORE_USER_CONFIG=false` to disable
  the flag for development or compatibility testing.
- When CloudAgent MCP is available, `-c` overrides configure the run-scoped
  server URL, enabled-tool allowlist, a 120-second tool timeout, and approval
  mode for each exposed CloudAgent tool.
- Set `CLOUDAGENT_CODEX_SANDBOX` to pass an explicit `--sandbox <mode>` value.
- This does not isolate inherited process environment variables or Codex
  exec-policy rule files.

### Claude Code

New runs use this command shape:

```text
claude -p <prompt> --output-format stream-json --verbose [--strict-mcp-config --mcp-config <run-config>] [--permission-mode bypassPermissions]
```

Resumed runs add `--continue`.

- CloudAgent intentionally does not pass `--setting-sources`, `--safe-mode`,
  or `--bare`. Claude user configuration remains available so existing OAuth,
  API, Amazon Bedrock, Vertex AI, proxy, model, and provider configuration can
  continue to work.
- With CloudAgent MCP enabled, `--strict-mcp-config` is enabled by default so
  only the run-scoped MCP configuration is loaded. This flag affects MCP
  configuration only; it does not disable other Claude user settings.
- The MCP-backed non-interactive run defaults to
  `--permission-mode bypassPermissions` so CloudAgent tools do not block on an
  interactive approval prompt.
- `CLOUDAGENT_CLAUDE_OUTPUT_FORMAT`, `CLOUDAGENT_CLAUDE_VERBOSE`,
  `CLOUDAGENT_CLAUDE_STRICT_MCP_CONFIG`, and
  `CLOUDAGENT_CLAUDE_PERMISSION_MODE` override these defaults.

### Cursor Agent

New runs use this command shape:

```text
cursor-agent -p <prompt> --output-format stream-json --workspace <run-dir> --approve-mcps --trust --force
```

Resumed runs add `--continue`.

- Before an MCP-backed launch, CloudAgent also runs
  `cursor-agent mcp enable cloudagent`. The run-scoped MCP definition is
  written to both `.cursor/mcp.json` and `.mcp.json` in the run directory.
- Cursor Agent does not currently expose a supported equivalent of Codex's
  `--ignore-user-config`, so Cursor user configuration remains active.
- `CLOUDAGENT_CURSOR_OUTPUT_FORMAT`, `CLOUDAGENT_CURSOR_APPROVE_MCPS`,
  `CLOUDAGENT_CURSOR_STREAM_PARTIAL_OUTPUT`,
  `CLOUDAGENT_CURSOR_TRUST_WORKSPACE`, and `CLOUDAGENT_CURSOR_FORCE` override
  these defaults. Set `CLOUDAGENT_CURSOR_FORCE=yolo` to use `--yolo` instead of
  `--force`.

All external runners inherit the desktop API process environment, with the
selected CloudAgent AWS credentials and region overlaid for the run.

## What it provides

- `BUILT_IN_CODING_AGENT_RUNNERS` — runner definitions: ids, aliases,
  labels, default binary names, and settings paths shared by the UI and
  API.
- `CLOUDAGENT_MCP_TOOLS` — the allowlist of tool names exposed to external
  agents over the local MCP server.
- Agent-run event schema and event types (status, message, task, raw
  stream chunks, tool lifecycle, and terminal output) plus normalization
  helpers shared by native and external-agent UI surfaces.
- MCP instruction-line builders injected into spawned agents' prompts.

## Related code

- `src/index.mjs` — runner definitions and event contracts.
- `../../cloudagent-desktop/apps/api/src/modules/runners/plan-runner.mjs`
  — native plan execution.
- `../../cloudagent-desktop/apps/api/src/modules/skills/coding-agent-runner.mjs`
  — spawning and streaming external CLI agents.
