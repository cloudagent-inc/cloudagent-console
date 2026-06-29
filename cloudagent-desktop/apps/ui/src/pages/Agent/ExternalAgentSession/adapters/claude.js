import { formatCodexEventForTerminal, classifyCodexChunk } from './codex.js';
import { extractExternalAgentText, getCommandLabel, getSourceLabel } from './shared.js';

function formatClaudeTerminalEvent(event) {
  const codexTool = formatCodexEventForTerminal(event, { sourceOverride: 'claude' });
  if (codexTool) return codexTool;

  const type = String(event?.type || '').trim();
  if (/tool|command|shell|mcp/i.test(type)) {
    const command =
      event.command ||
      event.name ||
      event.tool_name ||
      event.toolName ||
      type ||
      getCommandLabel('claude');
    const text = extractExternalAgentText(event.message ?? event.content ?? event.result ?? event.text).trim();
    return {
      command: String(command),
      source: 'claude',
      text: [
        `[event] ${getSourceLabel('claude')} ${type || 'tool'}`,
        text ? `Output:\n${text}` : `Raw event:\n${JSON.stringify(event, null, 2)}`,
      ].join('\n') + '\n',
    };
  }
  return null;
}

function formatClaudeChatEvent(event) {
  const eventType = String(event?.type || '').toLowerCase();
  const text =
    eventType === 'assistant' ||
    eventType === 'message' ||
    eventType === 'result' ||
    eventType === 'output' ||
    eventType === 'text'
      ? extractExternalAgentText(event?.message ?? event?.content ?? event?.result ?? event?.text)
      : '';
  return text.trim() ? `${text.trim()}\n` : '';
}

function formatClaudeSessionEvent(event) {
  if (!event || typeof event !== 'object') return '';
  const type = String(event.type || '').trim();
  if (!type) return '';
  const summary = extractExternalAgentText(event.message ?? event.content ?? event.result ?? event.text).trim();
  return summary ? `${getSourceLabel('claude')} ${type}\n${summary}` : `${getSourceLabel('claude')} event: ${type}`;
}

export const claudeAdapter = {
  id: 'claude',
  label: 'Claude Code',
  getCommandLabel,
  formatTerminalEvent: formatClaudeTerminalEvent,
  formatChatEvent: formatClaudeChatEvent,
  formatSessionEvent: formatClaudeSessionEvent,
  classifyChunk(chunk) {
    const update = classifyCodexChunk(chunk, claudeAdapter);
    if (update?.target === 'ignore' && chunk?.type === 'codex_event') {
      return {
        target: 'session',
        source: 'claude',
        text: `${getSourceLabel('claude')} raw event\n${JSON.stringify(chunk.event, null, 2)}`,
      };
    }
    return update;
  },
};

