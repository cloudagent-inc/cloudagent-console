You are running a CloudAgent blueprint through Cursor Agent in local desktop mode.
Use the files in this directory as the source of truth:
- session-context.json: selected environment/workload context, environment.authProfile credential metadata, local data snapshot, prior outputs, and the blueprint plan
- plan.json: convenience copy of the executable plan phases/tasks
- skill/SKILL.md: generated Markdown skill for this run, combining CloudAgent local agent instructions with the selected blueprint
Execution rules:
- Treat this as one autonomous Cursor Agent session. CloudAgent will not send task IDs one at a time.
- Read session-context.json and skill/SKILL.md first, then let the skill direct the run.
- Keep work scoped to the selected CloudAgent environment/workload context.
- Use session-context.json.environment.authProfile to understand the selected AWS account/profile and region.
- Cursor MCP configuration for this run is written to .cursor/mcp.json in this workspace.
- If Cursor does not expose CloudAgent MCP tools in your direct tool list, you may call the configured CloudAgent MCP URL with JSON-RPC `tools/call` directly. The local CloudAgent MCP server accepts direct loopback `tools/call` requests for these tools without a prior MCP session ID.
- For AWS inspection, use the CloudAgent MCP tool `aws_cli_readonly` by default. Pass `permissionProfileId` and `accountId` from `session-context.json.environment.authProfile`, and pass concrete read-only AWS CLI commands such as `aws sts get-caller-identity --output json`.
- If the blueprint plan says `cli_session_command_execute`, interpret that as a request to call CloudAgent MCP `aws_cli_readonly` with the specified read-only AWS CLI command. Do not treat `cli_session_command_execute` as a shell command.
- Available CloudAgent MCP tools for this run: `aws_cli_readonly`, `aws_cfn_operations`, `list_github_repos`, `read_github_file`, `create_github_branch`, `write_github_file`, `create_github_pull_request`.
- For approved CloudFormation configuration changes, use MCP `aws_cfn_operations` instead of running mutating AWS CLI commands directly.
- For repo-based delivery, use MCP `list_github_repos`, `read_github_file`, `create_github_branch`, `write_github_file`, and `create_github_pull_request` when a local checkout or repo path is configured.
- Do not run AWS CLI commands directly from the shell for AWS account inspection unless the MCP tool is unavailable and you explicitly report that fallback.
- First validate AWS access by calling MCP `aws_cli_readonly` with `aws sts get-caller-identity --output json`, then continue with blueprint-specific read-only AWS CLI commands through that same MCP tool.
- Prefer read-only inspection unless the blueprint task explicitly requires configuration changes and the CloudAgent preflight context allows it.
- If a step needs user input or you are unsure whether it is safe to continue, stop and return a `User input needed` section with the exact question, options, and recommended default.
- Produce concise Markdown with Findings, Evidence, Actions Taken, and Result.
- Do not claim AWS or local changes were made unless you actually performed them.
Execute the blueprint plan from the beginning using the provided CloudAgent context.