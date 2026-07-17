function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export function sanitizeTerminalText(value) {
  return String(value || '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001A\u001C-\u001F\u007F]/g, '');
}

export function formatTerminalOutput(value) {
  const sanitized = sanitizeTerminalText(value);
  const parsed = parseMaybeJson(sanitized);
  if (parsed && typeof parsed === 'object') {
    return JSON.stringify(parsed, null, 2);
  }
  return sanitized;
}

function inferLifecycle(value = {}) {
  const explicit = String(value.lifecycle || value.status || '').trim().toLowerCase();
  if (explicit) return explicit;
  const output = String(value.output || '').trim().toLowerCase();
  if (output.startsWith('[running]')) return 'started';
  if (output.startsWith('[completed]')) return 'completed';
  if (output.startsWith('[failed]') || output.startsWith('[error]')) return 'failed';
  return 'started';
}

export function normalizeTerminalEvent(value = {}, fallbackIndex = 0) {
  const payload = value?.payload && typeof value.payload === 'object' ? value.payload : value;
  const command = sanitizeTerminalText(payload.command || value.command || 'command');
  const lifecycle = inferLifecycle(payload);
  const stream = String(payload.stream || '').toLowerCase();
  const chunk = sanitizeTerminalText(payload.chunk || '');
  const output = sanitizeTerminalText(payload.output || '');
  const commandId = String(
    payload.commandId || value.commandId || value.callId || value.requestId || value.id || ''
  ).trim();
  const id = commandId || `${payload.cliSessionId || value.cliSessionId || 'terminal'}:${command}:${fallbackIndex}`;
  const failed = ['failed', 'error'].includes(lifecycle);
  const completed = failed || ['completed', 'complete', 'success'].includes(lifecycle);
  return {
    id,
    commandId: commandId || null,
    cliSessionId: payload.cliSessionId || value.cliSessionId || null,
    command,
    source: payload.source || value.source || value.runner || 'cloudagent',
    runner: value.runner || payload.runner || null,
    status: completed ? (failed ? 'failed' : 'completed') : 'running',
    stdout: sanitizeTerminalText(payload.stdout || (stream === 'stdout' ? chunk : '')),
    stderr: sanitizeTerminalText(payload.stderr || (stream === 'stderr' ? chunk : '')),
    output: !chunk ? output : '',
    cwd: payload.cwd || null,
    exitCode: payload.exitCode ?? null,
    durationMs: payload.durationMs ?? null,
    timedOut: Boolean(payload.timedOut),
    stdoutTruncated: Boolean(payload.stdoutTruncated),
    stderrTruncated: Boolean(payload.stderrTruncated),
    sequence: Number.isFinite(Number(payload.sequence)) ? Number(payload.sequence) : null,
    timestamp: value.timestamp || payload.timestamp || null,
  };
}

export function upsertTerminalEvent(entries = [], rawEvent = {}) {
  const event = normalizeTerminalEvent(rawEvent, entries.length);
  const next = [...entries];
  let index = next.findIndex((entry) => entry.id === event.id);
  if (index === -1 && !event.commandId) {
    index = next.findIndex((entry) => entry.status === 'running' && entry.command === event.command);
  }
  if (index === -1) {
    next.push(event);
    return next;
  }
  const current = next[index];
  next[index] = {
    ...current,
    ...event,
    stdout: `${current.stdout || ''}${event.stdout || ''}`,
    stderr: `${current.stderr || ''}${event.stderr || ''}`,
    output: event.output || current.output || '',
    source: event.source || current.source,
    status: event.status === 'running' && current.status !== 'running' ? current.status : event.status,
  };
  return next;
}

function terminalEntryFromToolExecution(execution = {}, index = 0) {
  if (String(execution?.name || '') !== 'cli_session_execute') return null;
  const input = parseMaybeJson(execution.input) || {};
  const rawOutput = parseMaybeJson(execution.output) || {};
  const toolOutput = rawOutput?.output && typeof rawOutput.output === 'object'
    ? rawOutput.output
    : rawOutput;
  const result = toolOutput?.result && typeof toolOutput.result === 'object'
    ? toolOutput.result
    : toolOutput;
  return {
    id: result.commandId || execution.id || `cli-session-history-${index}`,
    commandId: result.commandId || null,
    cliSessionId: result.cliSessionId || toolOutput?.input?.cliSessionId || input.cliSessionId || null,
    command: sanitizeTerminalText(result.command || toolOutput?.input?.command || input.command || 'command'),
    source: 'mcp:cli_session_execute',
    status: result.ok === false || toolOutput.ok === false || execution.status === 'failed' ? 'failed' : 'completed',
    stdout: sanitizeTerminalText(result.stdout || ''),
    stderr: sanitizeTerminalText(result.stderr || toolOutput.error || ''),
    output: '',
    cwd: result.cwd || null,
    exitCode: result.exitCode ?? null,
    durationMs: result.durationMs ?? null,
    timedOut: Boolean(result.timedOut),
    stdoutTruncated: Boolean(result.stdoutTruncated),
    stderrTruncated: Boolean(result.stderrTruncated),
    timestamp: null,
  };
}

export function terminalEntriesFromMessages(messages = []) {
  const entries = [];
  for (const message of Array.isArray(messages) ? messages : []) {
    if (Array.isArray(message?.terminalEntries) && message.terminalEntries.length > 0) {
      for (const entry of message.terminalEntries) {
        const normalized = normalizeTerminalEvent(entry, entries.length);
        const existingIndex = entries.findIndex((candidate) => candidate.id === normalized.id);
        if (existingIndex === -1) entries.push(normalized);
        else entries[existingIndex] = { ...entries[existingIndex], ...normalized };
      }
      continue;
    }
    for (const execution of Array.isArray(message?.toolExecutions) ? message.toolExecutions : []) {
      const entry = terminalEntryFromToolExecution(execution, entries.length);
      if (entry) entries.push(entry);
    }
  }
  return entries;
}
