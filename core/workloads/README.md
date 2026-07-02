# CloudAgent Workloads

`core/workloads` contains workload models and supporting behavior for documenting
and managing cloud environments in CloudAgent Console.

Workloads are the primary place to organize cloud architecture context: accounts,
resources, diagrams, operational notes, scanner output, and agent-generated
artifacts.

## What It Provides

- Workload domain models.
- Discovery and local workload storage behavior.
- Diagram/spec support for documenting cloud architecture.
- Health aggregation patterns used by the desktop experience.

## Managing Cloud Environments

Use **Cloud Setup** in CloudAgent Console to add an AWS environment and run local
discovery. Use **Workloads** to inspect discovered workloads, maintain
documentation, and review architecture artifacts.

## Related Code

- `src/index.mjs` - package entrypoint.
- `../scanners` - scanners that produce workload-related findings.
- `../../cloudagent-desktop/apps/api/src/modules/cloud-setup` - local AWS
  discovery API behavior.
