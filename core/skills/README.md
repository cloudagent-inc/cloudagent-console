# CloudAgent Skills

`core/skills` contains the skill generation, planning, review, and execution
support used by CloudAgent Console.

Skills are intended to turn cloud operations knowledge into reusable agent-ready
units. A skill can describe what context is needed, how work should be planned,
what tools or targets are involved, and how results should be reviewed.

## What It Provides

- Skill creation and rewrite helpers.
- Skill configuration planning.
- Skill preflight and validation support.
- Skill execution analysis.
- Local skill service behavior used by the desktop app.

## Managing Skills

In CloudAgent Console, use **Skills & Agents** to browse, create, edit, and run
skills. Optional local agent runtimes such as Codex CLI, Cursor Agent, and
Claude Code can be configured in **Preferences** and used as execution targets
where supported.

## Related Code

- `src/core/skill-service-local.mjs` - local skill service behavior.
- `src/core/skill-builder-functions.mjs` - skill generation helpers.
- `src/core/skill-preflight.mjs` - preflight checks.
- `src/core/skill-execution-analysis.mjs` - execution review and analysis.
