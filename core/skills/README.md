# CloudAgent Skills

`core/skills` (npm: `@cloudagent/skills`) contains the skill generation,
planning, review, and execution support used by CloudAgent Console.

Skills turn cloud-operations knowledge into reusable agent-ready units: a
skill describes what context is needed, how work should be planned, what
tools or targets are involved, and how results should be reviewed. Skills
can be executed by the native CloudAgent runner or handed off to external
CLI agents (Codex, Claude Code, Cursor Agent).

## What it provides

- Skill creation and rewrite helpers, with rewrite validation.
- Skill configuration planning.
- Skill preflight checks (`@cloudagent/skills/preflight`) run before
  execution.
- Skill execution context resolution
  (`@cloudagent/skills/execution-context`) — assembles the context passed
  to whichever runner executes the skill.
- Execution analysis — post-run review of what the agent did.

## Managing skills

In CloudAgent Console, use **Skills & Agents** to browse, create, edit,
and run skills. Optional local agent runtimes are configured in
**Preferences** and used as execution targets where supported.

## Related code

- `src/core/skill-service-local.mjs` — skill service behavior used by the
  desktop API.
- `src/core/skill-builder-functions.mjs` — skill generation helpers.
- `src/core/skill-preflight.mjs` — preflight checks.
- `src/core/skill-execution-analysis.mjs` — execution review and analysis.
- `../../cloudagent-desktop/apps/api/src/modules/skills/` — skill routes
  and the external agent runners.
