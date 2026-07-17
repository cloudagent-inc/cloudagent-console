# Contributing to CloudAgent Console

CloudAgent Console is an early-preview project for operating cloud environments
with AI agents. Contributions are welcome, especially around local runtime
stability, AWS discovery/scanning, MCP tools, agent integrations, documentation,
and packaging.

## Development Setup

Prerequisites:

- Node.js and npm
- AWS CLI for AWS environment discovery and local scanner workflows
- An OpenAI API key configured in CloudAgent Console Preferences
- Optional agent runtimes such as Claude Code, Codex, or Cursor Agent

Install and run from the repository root:

```bash
npm install
npm run electron:local:build
```

## Before Opening a Pull Request

- Keep changes focused and avoid unrelated refactors.
- Do not commit secrets, credentials, local data directories, generated release
  artifacts, or personal machine paths.
- Update documentation when behavior, setup, or user-facing workflows change.
- Add or update tests when changing shared runtime behavior, scanners, MCP
  tools, workflow execution, or packaging logic.
- Run the most relevant validation commands available for the files you changed.

## Reporting Bugs

Use GitHub issues for reproducible bugs, missing documentation, and enhancement
requests. Include:

- Your operating system and Node.js version.
- The command or workflow you ran.
- Expected behavior and actual behavior.
- Sanitized logs or screenshots when helpful.

Do not include AWS account IDs, access keys, OpenAI keys, customer names, or
other sensitive environment details in public issues.

## Pull Request Guidelines

- Explain the problem and the approach.
- Link related issues when applicable.
- Call out any security, credential, storage, or cloud-permission implications.
- Keep screenshots and test data synthetic or sanitized.

By contributing to this project, you agree that your contribution is licensed
under the Apache License, Version 2.0.
