import { claudeAdapter } from './claude.js';
import { codexAdapter } from './codex.js';
import { cursorAdapter } from './cursor.js';
import {
  appendLiveMessage,
  appendTerminalHistoryEntry,
  getCommandLabel,
  normalizeTranscriptText,
  parseJsonMaybe,
} from './shared.js';

const adapters = {
  codex: codexAdapter,
  claude: claudeAdapter,
  cursor: cursorAdapter,
};

export function getExternalAgentAdapter(value = 'codex') {
  const runner = String(value || 'codex').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (runner.includes('claude')) return claudeAdapter;
  if (runner.includes('cursor')) return cursorAdapter;
  if (runner.includes('codex')) return codexAdapter;
  return adapters[runner] || codexAdapter;
}

export function getExternalAgentCommandLabel(source) {
  return getCommandLabel(source);
}

export function normalizeExternalAgentTranscriptText(value) {
  return normalizeTranscriptText(value);
}

export function appendExternalAgentLiveMessage(messages, message) {
  return appendLiveMessage(messages, message);
}

export function appendExternalAgentTerminalHistoryEntry(entries, update, adapter = null) {
  return appendTerminalHistoryEntry(entries, update, adapter || getExternalAgentAdapter(update?.source));
}

export function classifyExternalAgentStreamChunk(chunk, runner = null) {
  const adapter = getExternalAgentAdapter(runner || chunk?.event?.runner || chunk?.runner || 'codex');
  return adapter.classifyChunk(chunk);
}

export function getExternalAgentEventsFromLogEntry(entry) {
  const rawEvents = entry?.codex?.events ?? entry?.codexEvents ?? [];
  const parsed = parseJsonMaybe(rawEvents, rawEvents);
  return Array.isArray(parsed) ? parsed : [];
}

export function isExternalAgentLogEntry(entry) {
  return Boolean(
    entry?.executionMode === 'codex' ||
      entry?.executionMode === 'claude' ||
      entry?.executionMode === 'cursor' ||
      entry?.runner === 'codex' ||
      entry?.runner === 'claude' ||
      entry?.runner === 'cursor' ||
      entry?.codex ||
      entry?.taskId === 'codex_blueprint_run'
  );
}

export function buildExternalAgentHistoryRestore(logData, { title = '', status = '' } = {}) {
  const logs = Array.isArray(logData?.logs) ? logData.logs : [];
  const externalEntries = logs.filter(isExternalAgentLogEntry);
  const terminalCommands = [];
  const sessionInfo = [];
  const liveMessages = [];

  externalEntries.forEach((entry, entryIndex) => {
    const runner = entry.runner || entry.executionMode || 'codex';
    const adapter = getExternalAgentAdapter(runner);
    getExternalAgentEventsFromLogEntry(entry).forEach((event, eventIndex) => {
      const update = adapter.classifyChunk({ type: 'codex_event', event: { ...event, runner: event?.runner || runner } });
      if (!update?.text?.trim()) return;

      if (update.target === 'terminal') {
        const nextTerminal = appendExternalAgentTerminalHistoryEntry(terminalCommands, update, adapter);
        terminalCommands.splice(0, terminalCommands.length, ...nextTerminal);
        return;
      }

      if (update.target === 'session') {
        sessionInfo.push({
          timestamp: entry.timestamp || new Date().toISOString(),
          message: update.text.trim(),
        });
        return;
      }

      if (update.target === 'chat') {
        const nextLiveMessages = appendExternalAgentLiveMessage(liveMessages, {
          id: `external-agent-history-${entryIndex}-${eventIndex}`,
          answerIndex: entryIndex,
          source: update.source || runner,
          streamUpdate: update.streamUpdate === true,
          messageBoundary: update.messageBoundary === true,
          finalResult: update.finalResult === true,
          timestamp: entry.timestamp || new Date().toISOString(),
          content: update.text.trim(),
        });
        liveMessages.splice(0, liveMessages.length, ...nextLiveMessages);
      }
    });
  });

  const queries = externalEntries.map((entry, index) => {
    if (entry?.input) return entry.input;
    if (index > 0) return entry?.taskTitle || `External agent follow-up ${index}`;
    return `Run external agent blueprint${title ? `: ${title}` : ''}`;
  });
  const answers = externalEntries.map((entry) =>
    String(entry?.task_output || entry?.output || '').trim()
  );
  const lastEntry = externalEntries[externalEntries.length - 1] || null;

  return {
    codexEntries: externalEntries,
    terminalCommands,
    sessionInfo,
    liveMessages,
    queries,
    answers,
    status: lastEntry?.status || status || logData?.runSummary?.status || '',
    output: String(lastEntry?.task_output || lastEntry?.output || '').trim(),
  };
}
