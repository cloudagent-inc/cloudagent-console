# CloudAgent Monorepo

This folder is the parent workspace for CloudAgent product codebases and shared
packages.

## Structure

- `cloudagent-desktop` - local-first Electron desktop app suite.
- `packages` - shared CloudAgent engines, contracts, UI modules, integrations,
  scanners, and storage adapters intended to be reused by desktop and future
  web/cloud apps.
- `cloudagent-cloud` - reserved for the future hosted/cloud product split.

The npm workspace root is this folder. Run installs and workspace commands from
here so desktop and future website apps resolve the same shared packages.

## Local Desktop Run

```bash
npm install
CLOUDAGENT_LOCAL_DATA_DIR=/tmp/cloudagent-local-test OPENAI_API_KEY=... npm run electron:local:build
```

Convenience scripts in `cloudagent-desktop/package.json` proxy to this root, so
running the same Electron commands from `cloudagent-desktop` still works.
