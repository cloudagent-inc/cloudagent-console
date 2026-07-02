# CloudAgent Orchestration

`core/cloudagent` contains the native CloudAgent orchestration layer.

This package provides the OpenAI-backed CloudAgent runner, tool registration,
prompting, and response handling used by the console when work is executed
through the built-in CloudAgent path.

## What It Provides

- CloudAgent runner logic.
- OpenAI Agents SDK integration.
- Tool registry and orchestration.
- Architecture references and operational context helpers.

## Related Code

- `src/core/cloudagent.mjs` - native CloudAgent runner.
- `../cloudagent-tools` - tools available to CloudAgent.
- `../agent-runtime` - shared runner definitions and event contracts.
- `../skills` - skill execution and analysis support.
