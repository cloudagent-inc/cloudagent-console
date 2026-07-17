# CloudAgent Diagrams

`core/diagrams` contains the architecture-diagram support used by the
console's Workloads experience.

## Subpackages

- `ui` (npm: `@cloudagent/diagram-ui-core`) — the diagram editor building
  blocks: spec-to-canvas adapter, automatic layout (dagre-based), and icon
  mapping used to render workload architecture diagrams in the UI.
- `icons` (npm: `@cloudagent/diagram-ui-icons`) — generated icon catalogs
  for AWS, Azure, and GCP services (`scripts/generate-icon-catalogs.mjs`
  regenerates them).

## Related code

- `../../cloudagent-desktop/apps/ui` — imports both packages for diagram
  rendering and editing.
- `../../cloudagent-desktop/apps/api/src/modules/workloads/diagram-routes.mjs`
  — server-side diagram spec endpoints.
- `../cloudagent-tools` — diagram-spec tools that let agents create and
  update diagrams.
