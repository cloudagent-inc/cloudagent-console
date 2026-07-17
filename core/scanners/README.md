# CloudAgent Scanners

`core/scanners` (npm: `@cloudagent/scanners`) collects cloud environment
signals for CloudAgent Console. Scanner output becomes agent-ready
context: inventory, cost, health, and threat findings that are shown in
the dashboards and served to agent tools through the local API and MCP.

Scanners run locally using the credentials of a selected permission
profile (AWS profile, SSO, or static keys) — no data leaves the machine.

## Structure

- `src/aws/discovery/` — per-service resource discovery (Lambda, RDS,
  EKS, DynamoDB, SQS/SNS, API Gateway, CloudFormation stacks and stack
  resources, IAM, ElastiCache, OpenSearch, Auto Scaling, EFS, Step
  Functions, …). These references to AWS services describe the
  *customer's* resources being scanned.
- `src/aws/cost/` — Cost Explorer-based cost insights.
- `src/aws/resource-health/` — per-service health signals.
- `src/aws/threat/` — security/threat findings (GuardDuty, Inspector,
  Access Analyzer).
- `src/shared/`, `src/util/` — shared contracts and helpers.

Note: `src/index.mjs` still exports `SCANNERS_PACKAGE_STATUS =
'migration-pending'` — scanners are launched through the desktop API's
`modules/scanners/scanner-launcher.mjs`, which imports the scanner modules
directly; a unified package-level entrypoint is still to come.

## Output

Scanner runs and artifacts are persisted through `@cloudagent/storage`
(`scanner-runs/`, `artifacts/` in the local data directory) and consumed
by the Insights dashboards, executive summaries, and agent tools.
