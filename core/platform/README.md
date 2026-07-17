# CloudAgent Platform

`core/platform` (npm: `@cloudagent/platform`) holds cross-cutting basics
shared by every other package. It should stay small and dependency-free.

## Exports

- `@cloudagent/platform` — runtime-mode constants
  (`CLOUDAGENT_RUNTIME_MODES`, `normalizeRuntimeMode`). The desktop product
  runs in `local` mode only; the constants exist so shared code stays
  explicit about that assumption.
- `@cloudagent/platform/global-variables` — process-level defaults:
  `AWS_REGION` (from `AWS_REGION`/`AWS_DEFAULT_REGION`, default
  `us-east-1`) and `OPENAI_MODEL` (from `OPENAI_MODEL`/
  `OPENAI_LOCAL_MODEL`).
- `@cloudagent/platform/utils` — the shared tiny utilities that used to be
  copy-pasted across packages: `safeTrim(value)` and
  `safeJsonParse(value, fallback)`. New cross-package helpers of this kind
  belong here, not in per-package copies.
