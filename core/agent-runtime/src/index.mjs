export const CLOUDAGENT_MCP_TOOLS = Object.freeze([
  "aws_cli_readonly",
  "aws_cfn_operations",
  "list_github_repos",
  "read_github_file",
  "create_github_branch",
  "write_github_file",
  "create_github_pull_request",
]);

export function normalizeCodingAgentRunner(value) {
  const runner = String(value || "cloudagent").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["codex", "codex_cli", "openai_codex"].includes(runner)) return "codex";
  if (["claude", "claude_code", "claude_cli", "anthropic_claude"].includes(runner)) return "claude";
  if (["cursor", "cursor_agent", "cursor_cli", "cursor_ai"].includes(runner)) return "cursor";
  return "cloudagent";
}

export function codingAgentRunnerLabel(value) {
  const runner = normalizeCodingAgentRunner(value);
  if (runner === "claude") return "Claude Code";
  if (runner === "cursor") return "Cursor Agent";
  if (runner === "cloudagent") return "CloudAgent";
  return "Codex CLI";
}

export function buildCodexTomlString(value) {
  return JSON.stringify(String(value || ""));
}

export function buildCodexCloudAgentMcpConfigToml(mcpUrl) {
  return [
    "[mcp_servers.cloudagent]",
    `url = "${String(mcpUrl || "").replace(/"/g, '\\"')}"`,
    `enabled_tools = ${JSON.stringify(CLOUDAGENT_MCP_TOOLS)}`,
    'default_tools_approval_mode = "approve"',
    "tool_timeout_sec = 120",
    "",
    ...CLOUDAGENT_MCP_TOOLS.flatMap((toolName) => [
      `[mcp_servers.cloudagent.tools.${toolName}]`,
      'approval_mode = "approve"',
      "",
    ]),
    "",
  ].join("\n");
}

export function buildCloudAgentMcpJsonConfig(mcpUrl) {
  return {
    mcpServers: {
      cloudagent: {
        type: "http",
        url: String(mcpUrl || ""),
        alwaysLoad: true,
        timeout: 120_000,
        enabledTools: CLOUDAGENT_MCP_TOOLS,
      },
    },
  };
}

export function buildCursorCloudAgentMcpJsonConfig(mcpUrl) {
  return {
    mcpServers: {
      cloudagent: {
        url: String(mcpUrl || ""),
      },
    },
  };
}

export function formatCloudAgentMcpToolsList() {
  return CLOUDAGENT_MCP_TOOLS.map((toolName) => `\`${toolName}\``).join(", ");
}

export function buildCloudAgentMcpInstructionLines({ runner = "codex", mcpEnabled = true } = {}) {
  const normalizedRunner = normalizeCodingAgentRunner(runner);
  if (!mcpEnabled) {
    return [
      "- Use the AWS CLI for AWS inspection or execution. CloudAgent already passed the AWS credential values to this process through the environment variables listed at session-context.json.credentialAccess.availableEnvVars and session-context.json.environment.authProfile.credentialEnvVars.",
      "- For approved CloudFormation configuration changes, use AWS CLI/CloudFormation commands directly with the injected environment credentials.",
      "- For repo-based delivery, use local git commands only when a local checkout path is present in the execution context.",
      "- Do not ask the user where credentials are stored. Do not rely on ~/.aws/config, ~/.aws/credentials, or `aws configure list` to find credentials. The process environment is the credential source of truth.",
      "- First validate AWS access with `aws sts get-caller-identity --output json`, then continue with the blueprint-specific read-only AWS CLI commands.",
    ];
  }

  return [
    normalizedRunner === "cursor"
      ? "- Cursor MCP configuration for this run is written to .cursor/mcp.json in this workspace."
      : null,
    normalizedRunner === "cursor"
      ? "- If Cursor does not expose CloudAgent MCP tools in your direct tool list, you may call the configured CloudAgent MCP URL with JSON-RPC `tools/call` directly. The local CloudAgent MCP server accepts direct loopback `tools/call` requests for these tools without a prior MCP session ID."
      : null,
    "- For AWS inspection, use the CloudAgent MCP tool `aws_cli_readonly` by default. Pass `permissionProfileId` and `accountId` from `session-context.json.environment.authProfile`, and pass concrete read-only AWS CLI commands such as `aws sts get-caller-identity --output json`.",
    "- If the blueprint plan says `cli_session_command_execute`, interpret that as a request to call CloudAgent MCP `aws_cli_readonly` with the specified read-only AWS CLI command. Do not treat `cli_session_command_execute` as a shell command.",
    `- Available CloudAgent MCP tools for this run: ${formatCloudAgentMcpToolsList()}.`,
    "- For approved CloudFormation configuration changes, use MCP `aws_cfn_operations` instead of running mutating AWS CLI commands directly.",
    "- For repo-based delivery, use MCP `list_github_repos`, `read_github_file`, `create_github_branch`, `write_github_file`, and `create_github_pull_request` when a local checkout or repo path is configured.",
    "- Do not run AWS CLI commands directly from the shell for AWS account inspection unless the MCP tool is unavailable and you explicitly report that fallback.",
    "- First validate AWS access by calling MCP `aws_cli_readonly` with `aws sts get-caller-identity --output json`, then continue with blueprint-specific read-only AWS CLI commands through that same MCP tool.",
  ].filter(Boolean);
}
