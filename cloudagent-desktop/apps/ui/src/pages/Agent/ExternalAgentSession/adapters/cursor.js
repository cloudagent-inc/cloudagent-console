import { formatCodexEventForTerminal, classifyCodexChunk } from './codex.js';
import { extractExternalAgentText, getCommandLabel, getSourceLabel } from './shared.js';

function findCursorToolCallPayload(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.tool_call && typeof value.tool_call === 'object') return value.tool_call;
  if (value.toolCall && typeof value.toolCall === 'object') return value.toolCall;
  if (value.readToolCall || value.writeToolCall || value.runTerminalCmdToolCall || value.listDirToolCall) return value;
  for (const entry of Object.values(value)) {
    if (!entry || typeof entry !== 'object') continue;
    const nested = findCursorToolCallPayload(entry);
    if (nested) return nested;
  }
  return null;
}

function formatCursorToolCallEvent(event) {
  const payload = findCursorToolCallPayload(event);
  if (!payload) return null;
  const toolEntry = Object.entries(payload).find(
    ([key, value]) => /toolcall$/i.test(key) && value && typeof value === 'object'
  );
  if (!toolEntry) return null;

  const [rawToolName, toolCall] = toolEntry;
  const toolName = rawToolName.replace(/ToolCall$/i, '');
  const args = toolCall.args && typeof toolCall.args === 'object' ? toolCall.args : {};
  const result = toolCall.result && typeof toolCall.result === 'object' ? toolCall.result : {};
  const success = result.success && typeof result.success === 'object' ? result.success : null;
  const error = result.error || result.failure || null;
  const content = success?.content ?? result.content ?? result.output ?? result.stdout ?? '';
  const command =
    args.command ||
    args.cmd ||
    args.path ||
    args.url ||
    args.query ||
    toolName ||
    'cursor tool';
  const status = event.subtype || event.status || (error ? 'failed' : success ? 'completed' : 'event');
  const metadata = [
    args.path ? `Path: ${args.path}` : null,
    args.limit ? `Limit: ${args.limit}` : null,
    success?.totalLines ? `Total lines: ${success.totalLines}` : null,
    success?.fileSize ? `File size: ${success.fileSize}` : null,
    success?.exceededLimit ? 'Output exceeded display limit' : null,
  ].filter(Boolean);
  const outputText = typeof content === 'string' ? content : JSON.stringify(content || result, null, 2);

  return {
    command: String(command),
    source: 'cursor',
    text: [
      `[${status}] Cursor ${toolName}`,
      ...metadata,
      outputText?.trim() ? `Output:\n${outputText.trim()}` : null,
      error ? `Error:\n${typeof error === 'string' ? error : JSON.stringify(error, null, 2)}` : null,
    ].filter(Boolean).join('\n') + '\n',
  };
}

function formatCursorTerminalEvent(event) {
  if (event?.type === 'tool_call') {
    const cursorTool = formatCursorToolCallEvent(event);
    if (cursorTool) return cursorTool;
  }

  const codexTool = formatCodexEventForTerminal(event, { sourceOverride: 'cursor' });
  if (codexTool) return codexTool;

  const type = String(event?.type || '').trim();
  if (/tool|command|shell|mcp/i.test(type)) {
    const command =
      event.command ||
      event.name ||
      event.tool_name ||
      event.toolName ||
      type ||
      getCommandLabel('cursor');
    const text = extractExternalAgentText(event.message ?? event.content ?? event.result ?? event.text).trim();
    return {
      command: String(command),
      source: 'cursor',
      text: [
        `[event] ${getSourceLabel('cursor')} ${type || 'tool'}`,
        text ? `Output:\n${text}` : `Raw event:\n${JSON.stringify(event, null, 2)}`,
      ].join('\n') + '\n',
    };
  }
  return null;
}

function formatCursorChatEvent(event) {
  const eventType = String(event?.type || '').toLowerCase();
  const text =
    eventType === 'assistant' ||
    eventType === 'message' ||
    eventType === 'result'
      ? extractExternalAgentText(event?.message ?? event?.content ?? event?.result ?? event?.text)
      : '';
  return text.trim() ? `${text.trim()}\n` : '';
}

function isCursorIgnoredTextEvent(event) {
  const eventType = String(event?.type || '').toLowerCase();
  return ['output', 'text', 'stdout'].includes(eventType);
}

function isCursorMessageBoundaryEvent(event) {
  const eventType = String(event?.type || '').toLowerCase();
  return ['assistant', 'message'].includes(eventType);
}

function isCursorFinalResultEvent(event) {
  return String(event?.type || '').toLowerCase() === 'result';
}

function formatCursorSessionEvent(event) {
  if (!event || typeof event !== 'object') return '';
  const type = String(event.type || '').trim();
  if (!type) return '';
  const summary = extractExternalAgentText(event.message ?? event.content ?? event.result ?? event.text).trim();
  return summary ? `${getSourceLabel('cursor')} ${type}\n${summary}` : `${getSourceLabel('cursor')} event: ${type}`;
}

export const cursorAdapter = {
  id: 'cursor',
  label: 'Cursor Agent',
  getCommandLabel,
  formatTerminalEvent: formatCursorTerminalEvent,
  formatChatEvent: formatCursorChatEvent,
  formatSessionEvent: formatCursorSessionEvent,
  classifyChunk(chunk) {
    if (chunk?.type === 'codex_event' && isCursorIgnoredTextEvent(chunk.event)) {
      return { target: 'ignore', source: 'cursor', text: '' };
    }
    const update = classifyCodexChunk(chunk, cursorAdapter);
    if (update?.target === 'chat') {
      return {
        ...update,
        source: 'cursor',
        streamUpdate: false,
        messageBoundary: isCursorMessageBoundaryEvent(chunk?.event),
        finalResult: isCursorFinalResultEvent(chunk?.event),
      };
    }
    if (update?.target === 'ignore' && chunk?.type === 'codex_event') {
      return {
        target: 'session',
        source: 'cursor',
        text: `${getSourceLabel('cursor')} raw event\n${JSON.stringify(chunk.event, null, 2)}`,
      };
    }
    return update;
  },
};
