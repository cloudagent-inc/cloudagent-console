import { normalizeCommandCenterAgentRunner } from './userSettings.js';

export function getCommandCenterNewSessionRunner(
  defaultAgentRunner,
  { isLocalMode = true } = {}
) {
  return isLocalMode
    ? normalizeCommandCenterAgentRunner(defaultAgentRunner)
    : 'cloudagent';
}

export function isCommandCenterAgentRunnerSelectionLocked({
  lockedSessionAgentRunner,
  messages = [],
} = {}) {
  if (String(lockedSessionAgentRunner || '').trim()) return true;
  return Array.isArray(messages)
    && messages.some((message) => message?.role === 'user');
}
