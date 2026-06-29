export const EXTERNAL_AGENT_TOOL_NAMES = new Set([
  'aws_cli_readonly',
  'aws_cfn_operations',
  'list_github_repos',
  'read_github_file',
  'create_github_branch',
  'write_github_file',
  'create_github_pull_request',
]);

export function parseJsonMaybe(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch {
    return fallback;
  }
}

export function getValueByKeys(value, keys = []) {
  if (!value || typeof value !== 'object') return undefined;
  const keySet = new Set(keys);
  const stack = [value];
  const seen = new Set();
  while (stack.length > 0) {
    const current = stack.shift();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    for (const [key, child] of Object.entries(current)) {
      if (keySet.has(key) && child != null && child !== '') return child;
      if (child && typeof child === 'object') stack.push(child);
    }
  }
  return undefined;
}

export function normalizeToolPayload(value) {
  const parsed = parseJsonMaybe(value, value);
  if (Array.isArray(parsed)) {
    const text = parsed
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry?.type === 'text' && typeof entry.text === 'string') return entry.text;
        return '';
      })
      .filter(Boolean)
      .join('\n');
    return parseJsonMaybe(text, text || parsed);
  }
  if (parsed?.content && Array.isArray(parsed.content)) {
    return normalizeToolPayload(parsed.content);
  }
  return parsed;
}

export function extractExternalAgentText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((entry) => extractExternalAgentText(entry))
      .filter(Boolean)
      .join('\n');
  }
  if (!value || typeof value !== 'object') return '';
  if (typeof value.text === 'string') return value.text;
  if (typeof value.content === 'string') return value.content;
  if (Array.isArray(value.content)) return extractExternalAgentText(value.content);
  if (typeof value.message === 'string') return value.message;
  return '';
}

export function getSourceLabel(source) {
  if (source === 'claude') return 'Claude Code';
  if (source === 'cursor') return 'Cursor Agent';
  return 'Codex';
}

export function getCommandLabel(source) {
  if (source === 'claude') return 'claude';
  if (source === 'cursor') return 'cursor-agent';
  return 'codex exec';
}

export function normalizeTranscriptText(value) {
  return String(value || '')
    .replace(/^\s*\[(codex|claude|cursor)\]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function mergeExternalAgentText(currentValue, nextValue) {
  const current = String(currentValue || '').trimEnd();
  const next = String(nextValue || '').trim();
  if (!next) return current;
  if (!current) return next;
  if (next.startsWith(current)) return next;
  if (current.endsWith(next) || current.includes(next)) return current;
  if (shouldJoinExternalAgentFragments(current, next) || current.endsWith('\n') || next.startsWith('\n')) {
    return `${current}${next}`;
  }
  return `${current} ${next}`;
}

function normalizeExternalAgentTextForCompare(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getExternalAgentTailOverlap(currentValue, nextValue) {
  const current = String(currentValue || '');
  const next = String(nextValue || '');
  const maxLength = Math.min(current.length, next.length);
  for (let length = maxLength; length > 24; length -= 1) {
    if (current.slice(-length) === next.slice(0, length)) return length;
  }
  return 0;
}

function appendWithOverlap(currentValue, nextValue) {
  const current = String(currentValue || '').trimEnd();
  const next = String(nextValue || '').trim();
  const overlap = getExternalAgentTailOverlap(current, next);
  if (overlap > 0) return `${current}${next.slice(overlap)}`;
  return mergeExternalAgentText(current, next);
}

function isLikelyStreamingFragment(value) {
  const text = String(value || '').trim();
  if (isPunctuationOnlyFragment(text)) return true;
  return Boolean(text) && text.length < 80 && !/[.!?:\]\)`]$/.test(text);
}

function isPunctuationOnlyFragment(value) {
  return /^[,.;:!?)]$/.test(String(value || '').trim());
}

function shouldJoinExternalAgentFragments(currentValue, nextValue) {
  const current = String(currentValue || '').trimEnd();
  const next = String(nextValue || '').trim();
  if (!current || !next) return false;
  if (isPunctuationOnlyFragment(next)) return true;
  if (current.endsWith('-') || next.startsWith('-')) return true;
  if (/\d$/.test(current) && /^\d/.test(next)) return true;
  if (/[A-Za-z]$/.test(current) && /^(ed|ing|ings|ly|s)$/i.test(next)) return true;
  return false;
}

export function appendLiveMessage(messages, message) {
  const nextMessages = Array.isArray(messages) ? [...messages] : [];
  const source = message?.source || 'codex';
  if (source !== 'cursor' && source !== 'claude') {
    nextMessages.push(message);
    return nextMessages;
  }

  const answerIndex = Number(message?.answerIndex || 0);
  const lastIndex = nextMessages.length - 1;
  const last = nextMessages[lastIndex];
  if (last && Number(last.answerIndex || 0) === answerIndex && (last.source || source) === source) {
    const current = String(last.content || '');
    const next = String(message.content || '');
    const normalizedCurrent = normalizeExternalAgentTextForCompare(current);
    const normalizedNext = normalizeExternalAgentTextForCompare(next);
    const isStreamUpdate = message.streamUpdate === true;
    const isMessageBoundary = message.messageBoundary === true;
    const isFinalResult = message.finalResult === true;
    const hasPriorMessagesForTurn = nextMessages.some(
      (entry) => Number(entry?.answerIndex || 0) === answerIndex && (entry?.source || source) === source
    );
    if (
      source === 'cursor' &&
      isFinalResult &&
      hasPriorMessagesForTurn &&
      normalizedCurrent &&
      normalizedNext &&
      (normalizedNext.includes(normalizedCurrent) || normalizedCurrent.includes(normalizedNext))
    ) {
      return nextMessages;
    }
    if (normalizedNext && normalizedCurrent && normalizedNext.startsWith(normalizedCurrent)) {
      if (source === 'cursor' && isFinalResult && hasPriorMessagesForTurn) {
        return nextMessages;
      }
      nextMessages[lastIndex] = {
        ...last,
        timestamp: message.timestamp || last.timestamp,
        content: next,
      };
      return nextMessages;
    }
    if (normalizedCurrent && normalizedNext && normalizedCurrent.includes(normalizedNext)) {
      return nextMessages;
    }
    if (source === 'cursor' && isMessageBoundary) {
      nextMessages.push(message);
      return nextMessages;
    }
    if (isStreamUpdate && source === 'cursor') {
      nextMessages[lastIndex] = {
        ...last,
        timestamp: message.timestamp || last.timestamp,
        content: appendWithOverlap(last.content, message.content),
      };
      return nextMessages;
    }
    if (
      !isLikelyStreamingFragment(current) &&
      !isLikelyStreamingFragment(next) &&
      !shouldJoinExternalAgentFragments(current, next)
    ) {
      nextMessages.push(message);
      return nextMessages;
    }
    nextMessages[lastIndex] = {
      ...last,
      timestamp: message.timestamp || last.timestamp,
      content: mergeExternalAgentText(last.content, message.content),
    };
  } else {
    nextMessages.push(message);
  }
  return nextMessages;
}

export function appendTerminalHistoryEntry(entries, update, adapter) {
  if (!update?.text?.trim()) return entries;
  const commandSource = update.source || adapter?.id || 'codex';
  const commandLabel = update.command || adapter?.getCommandLabel?.(commandSource) || getCommandLabel(commandSource);
  const nextEntries = [...entries];
  const lastEntry = nextEntries[nextEntries.length - 1];
  const updateRequestId = update.requestId || null;
  const lastRequestId = lastEntry?.requestId || null;
  const sameTerminalEntry =
    lastEntry?.command === commandLabel &&
    lastEntry?.source === commandSource &&
    (!updateRequestId || !lastRequestId || updateRequestId === lastRequestId);
  if (sameTerminalEntry) {
    nextEntries[nextEntries.length - 1] = {
      ...lastEntry,
      requestId: lastEntry.requestId || updateRequestId || undefined,
      output: `${lastEntry.output || ''}${update.text}`,
    };
  } else {
    nextEntries.push({
      command: commandLabel,
      output: update.text,
      source: commandSource,
      requestId: updateRequestId || undefined,
    });
  }
  return nextEntries;
}
