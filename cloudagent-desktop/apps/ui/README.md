# CloudAgent Console UI

`cloudagent-desktop/apps/ui` contains the React/Vite dashboard used by
CloudAgent Console.

## Main Areas

- **Command Center** - primary CloudAgent interaction surface.
- **Workloads** - discovered workloads, workload details, diagrams, and
  documentation.
- **Cloud Setup** - local cloud environment onboarding and AWS discovery.
- **Preferences** - OpenAI settings, local data path, MCP settings, and optional
  CLI paths.
- **Insights** - cost, health, threat, and executive summary views.
- **Skills & Agents** - skill management and agent run history.

## Dashboard Data Sources

- Cost dashboard data.
- Health dashboard data.
- Threat/security dashboard data.
- Workload inventory and scanner artifacts.
- Agent and skill run records.

## Related Code

- `src/pages/Dashboard` - dashboard views.
- `src/pages/Settings/MySkills.jsx` - Skills & Agents page.
- `src/runtime/cloudAgentRuntime.js` - local/cloud runtime capability flags.
- `../api` - local API backing the UI in desktop mode.
