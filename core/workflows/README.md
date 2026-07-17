# CloudAgent Workflows

`core/workflows` (npm: `@cloudagent/workflows`) is the declared home for
the workflow engine: repeatable cloud operations, scheduled checks, and
agent-assisted runbooks.

## Current status

This package is a placeholder (`WORKFLOWS_PACKAGE_STATUS =
'migration-pending'`). The live workflow implementation currently sits in
the desktop API at
`cloudagent-desktop/apps/api/src/modules/workflows/`:

- `workflow-routes.mjs` — workflow and workflow-run CRUD plus the
  `workflowManager` execution endpoint.
- `workflow-scheduler.mjs` — computes and triggers scheduled runs.
- `workflow-jobs.mjs` — background job execution.

Extracting that logic into this package (so it can be tested and reused
outside the API) is the intended direction.

## Related code

- `../skills` — skills that workflow steps invoke.
- `../agent-runtime` — agent runners workflow steps can use.
- `../storage` — workflow/workflow-run/scheduler record persistence.
