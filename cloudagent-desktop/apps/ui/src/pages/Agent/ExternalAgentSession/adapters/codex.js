import {
  EXTERNAL_AGENT_TOOL_NAMES,
  extractExternalAgentText,
  getCommandLabel,
  getSourceLabel,
  getValueByKeys,
  normalizeToolPayload,
} from './shared.js';

function formatCodexCommand(command) {
  const text = String(command || '').trim();
  if (!text) return '';
  const shellPrefix = '/bin/zsh -lc ';
  if (!text.startsWith(shellPrefix)) return text;
  const shellCommand = text.slice(shellPrefix.length).trim();
  if (
    (shellCommand.startsWith("'") && shellCommand.endsWith("'")) ||
    (shellCommand.startsWith('"') && shellCommand.endsWith('"'))
  ) {
    return shellCommand.slice(1, -1);
  }
  return shellCommand;
}

export function getExternalAgentToolName(event) {
  const item = event?.item && typeof event.item === 'object' ? event.item : null;
  const structuredToolNames = [];
  const collectStructuredToolNames = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(collectStructuredToolNames);
      return;
    }
    const direct = [
      value.tool_name,
      value.toolName,
      value.name,
      value.tool,
      value.function?.name,
      value.type === 'function_call' ? value.name : null,
      value.type === 'tool_use' ? value.name : null,
      value.type === 'tool_call' ? value.name : null,
    ];
    direct.forEach((candidate) => {
      const text = String(candidate || '').trim();
      if (EXTERNAL_AGENT_TOOL_NAMES.has(text)) structuredToolNames.push(text);
    });
    ['message', 'content', 'data', 'item', 'function', 'toolCall', 'tool_call'].forEach((key) => {
      collectStructuredToolNames(value[key]);
    });
  };
  collectStructuredToolNames(event);
  const candidates = [
    event?.tool_name,
    event?.toolName,
    event?.name,
    event?.tool,
    event?.data?.tool_name,
    event?.data?.name,
    item?.tool_name,
    item?.toolName,
    item?.name,
    item?.tool,
    item?.type === 'function_call' ? item?.name : null,
    item?.type === 'tool_use' ? item?.name : null,
    ...structuredToolNames,
  ];
  for (const candidate of candidates) {
    const text = String(candidate || '').trim();
    if (EXTERNAL_AGENT_TOOL_NAMES.has(text)) return text;
  }
  return null;
}

export function extractExternalAgentToolInfo(event) {
  if (!event || typeof event !== 'object') return null;
  const item = event.item && typeof event.item === 'object' ? event.item : null;
  const toolName = getExternalAgentToolName(event);
  if (!toolName) return null;

  const rawInput =
    item?.arguments ??
    item?.args ??
    item?.input ??
    item?.params ??
    item?.tool_input ??
    item?.toolInput ??
    item?.data?.input ??
    event.arguments ??
    event.args ??
    event.input ??
    event.params ??
    {};
  const input = normalizeToolPayload(rawInput);
  const outputPayload = normalizeToolPayload(
    item?.output ??
      item?.result ??
      item?.content ??
      item?.structuredContent ??
      item?.data?.output ??
      item?.data?.result ??
      event.output ??
      event.result ??
      event.content ??
      event.structuredContent ??
      {}
  );
  const command =
    getValueByKeys(input, ['command', 'cli_command']) ||
    getValueByKeys(outputPayload, ['command', 'cli_command']) ||
    getValueByKeys(input, ['stackName', 'path', 'repoFullName', 'branch', 'title']) ||
    getValueByKeys(outputPayload, ['stackName', 'path', 'repoFullName', 'branch', 'title']) ||
    toolName;
  const accountId =
    getValueByKeys(input, ['accountId', 'account_id']) ||
    getValueByKeys(outputPayload, ['accountId', 'account_id']) ||
    null;
  const permissionProfileId =
    getValueByKeys(input, ['permissionProfileId', 'permission_profile_id']) ||
    null;
  const resultOutput =
    outputPayload?.output ||
    outputPayload?.result?.output ||
    outputPayload?.data?.result?.output ||
    outputPayload?.data?.output ||
    outputPayload;
  const stdout = String(getValueByKeys(resultOutput, ['stdout']) || '').trim();
  const stderr = String(getValueByKeys(resultOutput, ['stderr']) || '').trim();
  const okValue =
    getValueByKeys(outputPayload, ['ok']) ??
    (getValueByKeys(outputPayload, ['statusCode']) === 200 ? true : undefined);
  const statusText = okValue === false ? 'failed' : okValue === true ? 'completed' : null;

  return {
    command: String(command || 'aws_cli_readonly'),
    accountId: accountId ? String(accountId) : null,
    permissionProfileId: permissionProfileId ? String(permissionProfileId) : null,
    stdout,
    stderr,
    statusText,
    hasOutput: Boolean(stdout || stderr || outputPayload),
    rawOutput: outputPayload,
    toolName,
  };
}

export function formatCodexEventForTerminal(event, { sourceOverride = null } = {}) {
  if (!event || typeof event !== 'object') return null;
  const type = String(event.type || '').trim();
  const item = event.item && typeof event.item === 'object' ? event.item : null;
  const source = sourceOverride || event.runner || 'codex';
  const toolInfo = extractExternalAgentToolInfo(event);
  const isStartedEvent =
    type === 'item.started' ||
    type === 'tool_use' ||
    type === 'tool.started' ||
    /\.started$/.test(type) ||
    String(item?.status || event.status || '').toLowerCase() === 'in_progress';
  const isCompletedEvent =
    type === 'item.completed' ||
    type === 'tool_result' ||
    type === 'tool.completed' ||
    /\.completed$/.test(type) ||
    ['completed', 'failed', 'error', 'success'].includes(String(item?.status || event.status || '').toLowerCase());
  const genericToolResult =
    !toolInfo &&
    (
      type === 'tool_result' ||
      item?.type === 'tool_result' ||
      event?.content?.type === 'tool_result' ||
      (Array.isArray(event?.content) && event.content.some((entry) => entry?.type === 'tool_result')) ||
      (Array.isArray(event?.message?.content) && event.message.content.some((entry) => entry?.type === 'tool_result'))
    );

  if (genericToolResult) {
    const resultText = extractExternalAgentText(event.message ?? event.content ?? event.result ?? event.text).trim();
    return {
      command: 'External tool result',
      source: 'external-tool',
      text: [
        '[completed] External agent tool result',
        resultText ? `Output:\n${resultText}` : null,
      ].filter(Boolean).join('\n') + '\n',
    };
  }

  if (toolInfo && !isStartedEvent && !isCompletedEvent) {
    return {
      command: toolInfo.command,
      source: `mcp:${toolInfo.toolName}`,
      text: `[running] CloudAgent MCP ${toolInfo.toolName}\n`,
    };
  }

  if (toolInfo && isStartedEvent) {
    const metadata = [
      toolInfo.accountId ? `Account: ${toolInfo.accountId}` : null,
      toolInfo.permissionProfileId ? `Permission profile: ${toolInfo.permissionProfileId}` : null,
    ].filter(Boolean);
    return {
      command: toolInfo.command,
      source: `mcp:${toolInfo.toolName}`,
      text: [`[running] CloudAgent MCP ${toolInfo.toolName}`, ...metadata].join('\n') + '\n',
    };
  }

  if (toolInfo && isCompletedEvent) {
    const rawText =
      !toolInfo.stdout && !toolInfo.stderr && toolInfo.rawOutput
        ? JSON.stringify(toolInfo.rawOutput, null, 2)
        : '';
    const output = [
      toolInfo.stdout ? `Output:\n${toolInfo.stdout}` : null,
      toolInfo.stderr ? `Error:\n${toolInfo.stderr}` : null,
      rawText ? `Output:\n${rawText}` : null,
    ].filter(Boolean);
    return {
      command: toolInfo.command,
      source: `mcp:${toolInfo.toolName}`,
      text: [
        `[completed] CloudAgent MCP ${toolInfo.toolName}${toolInfo.statusText ? ` ${toolInfo.statusText}` : ''}`,
        ...output,
      ].filter(Boolean).join('\n') + '\n',
    };
  }

  if (type === 'error') {
    return {
      command: `${source} error`,
      source,
      text: `[error] ${event.message || event.error || JSON.stringify(event)}\n`,
    };
  }

  if (type === 'item.started' && item?.type === 'command_execution') {
    const command = formatCodexCommand(item.command);
    return {
      command: command || 'command',
      source,
      text: '[running] Command\n',
    };
  }

  if (type === 'item.completed' && item?.type === 'command_execution') {
    const command = formatCodexCommand(item.command);
    const status = item.status || 'completed';
    const exitText = item.exit_code == null ? '' : `, exit ${item.exit_code}`;
    const output = String(item.aggregated_output || '').trim();
    return {
      command: command || 'command',
      source,
      text: [
        `[completed] Command ${status}${exitText}`,
        output ? `Output:\n${output}` : null,
      ].filter(Boolean).join('\n') + '\n',
    };
  }

  return null;
}

export function formatLocalMcpToolEventForTerminal(event, { sourceOverride = null } = {}) {
  if (!event || typeof event !== 'object') return null;
  const toolName = String(event.toolName || event.name || 'cloudagent_mcp').trim();
  if (!toolName) return null;
  const lifecycle = String(event.lifecycle || '').toLowerCase();
  const args = event.args && typeof event.args === 'object' ? event.args : {};
  const result = event.result && typeof event.result === 'object' ? event.result : {};
  const source = sourceOverride || event.runner || `mcp:${toolName}`;
  const command =
    args.command ||
    result.command ||
    args.stackName ||
    args.path ||
    args.repoFullName ||
    toolName;
  const isDone = ['completed', 'failed', 'error'].includes(lifecycle);
  const ok = event.ok ?? result.ok ?? (event.statusCode === 200 ? true : undefined);
  const statusLabel = !isDone
    ? 'running'
    : ok === false || lifecycle === 'failed' || lifecycle === 'error'
      ? 'failed'
      : 'completed';
  const metadata = [
    args.accountId ? `Account: ${args.accountId}` : null,
    args.permissionProfileId ? `Permission profile: ${args.permissionProfileId}` : null,
    event.durationMs != null ? `Duration: ${event.durationMs}ms` : null,
    event.stdoutTruncated ? 'Stdout truncated by local MCP output limit' : null,
    event.stderrTruncated ? 'Stderr truncated by local MCP output limit' : null,
  ].filter(Boolean);
  const stdout = String(result.stdout || '').trim();
  const stderr = String(result.stderr || event.error || '').trim();
  const output = [
    `[${statusLabel}] CloudAgent MCP ${toolName}`,
    ...metadata,
    stdout ? `Output:\n${stdout}` : null,
    stderr ? `Error:\n${stderr}` : null,
  ].filter(Boolean).join('\n');

  return {
    command: String(command || toolName),
    source: source.startsWith('mcp:') ? source : `mcp:${toolName}`,
    requestId: event.requestId || null,
    text: `${output}\n`,
  };
}

export function formatCodexEventForChat(event) {
  const item = event?.item && typeof event.item === 'object' ? event.item : null;
  const source = event?.runner || 'codex';
  if (event?.type === 'item.completed' && item?.type === 'agent_message') {
    const text = String(item.text || '').trim();
    return text ? `[${source}]\n${text}\n` : '';
  }
  return '';
}

export function formatCodexEventForSessionInfo(event) {
  if (!event || typeof event !== 'object') return '';
  const type = String(event.type || '').trim();
  const item = event.item && typeof event.item === 'object' ? event.item : null;

  if (type === 'thread.started') {
    return `Codex thread started${event.thread_id ? `\nThread ID: ${event.thread_id}` : ''}`;
  }
  if (type === 'turn.started') return 'Codex turn started';
  if (type === 'turn.completed') return 'Codex turn completed';
  if (type === 'item.started' && item?.type && item.type !== 'command_execution') {
    return `Started: ${item.type}`;
  }
  if (type === 'item.completed' && item?.type && item.type !== 'command_execution' && item.type !== 'agent_message') {
    return `Completed: ${item.type}`;
  }
  if (type && type !== 'error') return `Event: ${type}`;
  return '';
}

export function classifyCodexChunk(chunk, adapter = codexAdapter) {
  const source = chunk?.event?.runner || chunk?.runner || adapter.id;
  const sourceLabel = getSourceLabel(source);
  if (chunk?.type === 'local_mcp_tool_event') {
    const terminalUpdate = formatLocalMcpToolEventForTerminal(chunk.event, {
      sourceOverride: chunk?.event?.runner ? `mcp:${chunk.event.toolName || 'cloudagent_mcp'}` : null,
    });
    if (terminalUpdate?.text?.trim()) {
      return { target: 'terminal', ...terminalUpdate };
    }
    return { target: 'ignore', text: '' };
  }
  if (chunk?.type === 'codex_event') {
    const terminalUpdate = adapter.formatTerminalEvent(chunk.event);
    if (terminalUpdate?.text?.trim()) {
      return { target: 'terminal', ...terminalUpdate, source: terminalUpdate.source || source };
    }

    const chatText = adapter.formatChatEvent(chunk.event);
    if (chatText.trim()) return { target: 'chat', text: chatText, source };

    const sessionText = adapter.formatSessionEvent(chunk.event);
    if (sessionText.trim()) return { target: 'session', text: sessionText, source };

    return { target: 'ignore', text: '' };
  }

  const content = String(chunk?.content || '').trimEnd();
  if (!content.trim()) return { target: 'ignore', text: '' };
  if (/^Reading additional input from stdin\.\.\.$/i.test(content.trim())) {
    return { target: 'ignore', text: '' };
  }
  if (chunk?.type === 'codex_stderr') {
    return { target: 'session', text: `${sourceLabel} stderr\n${content}`, source };
  }
  return { target: 'session', text: content, source };
}

export const codexAdapter = {
  id: 'codex',
  label: 'Codex',
  getCommandLabel,
  formatTerminalEvent: formatCodexEventForTerminal,
  formatChatEvent: formatCodexEventForChat,
  formatSessionEvent: formatCodexEventForSessionInfo,
  classifyChunk(chunk) {
    return classifyCodexChunk(chunk, codexAdapter);
  },
};
