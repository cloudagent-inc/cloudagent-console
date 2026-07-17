# CloudAgent Workloads

`core/workloads` (npm: `@cloudagent/workloads`) is the declared home for
workload domain models — the console's primary unit for organizing cloud
architecture context: accounts, resources, diagrams, operational notes,
scanner output, and agent-generated artifacts.

## Current status

This package is a placeholder (`WORKLOADS_PACKAGE_STATUS =
'migration-pending'`). The live workload behavior currently lives in:

- `cloudagent-desktop/apps/api/src/modules/workloads/` — workload CRUD
  and diagram routes.
- `cloudagent-desktop/apps/api/src/modules/cloud-setup/` — AWS profile
  discovery and credential validation used during onboarding.
- `core/cloudagent-tools/src/services/` — workload summaries and views
  served to agents.

Extracting the domain models and discovery logic into this package is the
intended direction.

## Using workloads in the console

Use **Cloud Setup** to add an AWS environment and run local discovery;
use **Workloads** to inspect discovered workloads, maintain
documentation, and review architecture artifacts.
