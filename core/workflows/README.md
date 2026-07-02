# CloudAgent Workflows

`core/workflows` is the home for workflow definitions and local workflow runner
support.

Workflows are currently a forward-looking product area for repeatable cloud
operations, scheduled checks, and agent-assisted runbooks. The UI routes are
temporarily disabled while the workflow experience is being prepared.

## Intended Scope

- Workflow definitions.
- Local workflow manager and runner support.
- Repeatable cloud operations.
- Agent-assisted runbooks.
- Future scheduling and history views.

## Related Code

- `src/index.mjs` - package entrypoint.
- `../skills` - skills that workflows may invoke.
- `../agent-runtime` - agent runtimes that workflow steps may use.
