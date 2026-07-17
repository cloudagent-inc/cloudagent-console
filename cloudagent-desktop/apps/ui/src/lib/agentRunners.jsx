import { Bot, Sparkles } from 'lucide-react';
import { Icons } from '@/components/icons';
import {
  DEFAULT_COMMAND_CENTER_AGENT_RUNNER,
  normalizeCommandCenterAgentRunner,
} from '@/lib/userSettings';

export const COMMAND_CENTER_AGENT_RUNNERS = [
  { id: 'cloudagent', label: 'CloudAgent', icon: Sparkles },
  { id: 'codex', label: 'Codex', icon: Icons.openai },
  { id: 'claude', label: 'Claude', icon: Icons.anthropic },
  { id: 'cursor', label: 'Cursor', icon: Icons.cursor },
];

export const COMMAND_CENTER_EXTERNAL_RUNNER_IDS = new Set(
  COMMAND_CENTER_AGENT_RUNNERS
    .map((runner) => runner.id)
    .filter((id) => id !== DEFAULT_COMMAND_CENTER_AGENT_RUNNER)
);

export function normalizeCommandCenterRunnerId(value, fallback = DEFAULT_COMMAND_CENTER_AGENT_RUNNER) {
  return normalizeCommandCenterAgentRunner(value, fallback);
}

export function isExternalCommandCenterRunner(value) {
  return COMMAND_CENTER_EXTERNAL_RUNNER_IDS.has(
    normalizeCommandCenterRunnerId(value)
  );
}

export function getCommandCenterRunner(value, fallback = DEFAULT_COMMAND_CENTER_AGENT_RUNNER) {
  const runnerId = normalizeCommandCenterRunnerId(value, fallback);
  return (
    COMMAND_CENTER_AGENT_RUNNERS.find((runner) => runner.id === runnerId) ||
    COMMAND_CENTER_AGENT_RUNNERS[0]
  );
}

export function getCommandCenterRunnerLabel(value, fallback = DEFAULT_COMMAND_CENTER_AGENT_RUNNER) {
  return getCommandCenterRunner(value, fallback).label;
}

export function getCommandCenterRunnerIcon(value, fallback = DEFAULT_COMMAND_CENTER_AGENT_RUNNER) {
  return getCommandCenterRunner(value, fallback).icon || Bot;
}

function normalizeReadinessStatus(readinessStatus) {
  if (!readinessStatus || typeof readinessStatus !== 'object') return null;
  return readinessStatus.status && typeof readinessStatus.status === 'object'
    ? readinessStatus.status
    : readinessStatus;
}

export function getCommandCenterAgentReadiness(
  value,
  readinessStatus,
  { isLocalMode = true, isLoading = false } = {}
) {
  const runnerId = normalizeCommandCenterRunnerId(value);
  const runner = getCommandCenterRunner(runnerId);
  const status = normalizeReadinessStatus(readinessStatus);

  if (!isLocalMode) {
    return runnerId === 'cloudagent'
      ? { ready: true, disabled: false, reason: '' }
      : {
          ready: false,
          disabled: true,
          reason: `${runner.label} is available only in local mode.`,
        };
  }

  if (runnerId === 'cloudagent') {
    const openai = status?.openai || null;
    if (openai && openai.ok === false) {
      return {
        ready: false,
        disabled: true,
        reason: openai.message || 'OpenAI API key is not configured.',
      };
    }
    return { ready: true, disabled: false, reason: '' };
  }

  if (isLoading && !status) {
    return {
      ready: false,
      disabled: true,
      reason: `Checking ${runner.label} readiness...`,
    };
  }

  const mcp = status?.mcp || null;
  if (mcp && (mcp.enabled === false || mcp.ok === false)) {
    return {
      ready: false,
      disabled: true,
      reason: mcp.message || 'Local MCP server is not ready.',
    };
  }

  const tool = status?.tools?.[runnerId] || null;
  if (!tool) {
    return {
      ready: false,
      disabled: true,
      reason: `${runner.label} readiness has not been verified yet.`,
    };
  }

  if (tool.enabled === false || tool.disabled === true) {
    return {
      ready: false,
      disabled: true,
      reason: `${runner.label} is disabled in Preferences.`,
    };
  }

  if (tool.ok !== true) {
    return {
      ready: false,
      disabled: true,
      reason:
        tool.message ||
        tool.error ||
        `${runner.label} CLI was not found. Check Preferences.`,
    };
  }

  return { ready: true, disabled: false, reason: '' };
}

export function getFirstReadyCommandCenterRunner(
  preferredRunner,
  readinessStatus,
  options = {}
) {
  const normalizedPreferred = normalizeCommandCenterRunnerId(preferredRunner);
  const preferredReadiness = getCommandCenterAgentReadiness(
    normalizedPreferred,
    readinessStatus,
    options
  );
  if (!preferredReadiness.disabled) return normalizedPreferred;

  return (
    COMMAND_CENTER_AGENT_RUNNERS.find((runner) => (
      !getCommandCenterAgentReadiness(runner.id, readinessStatus, options).disabled
    ))?.id || DEFAULT_COMMAND_CENTER_AGENT_RUNNER
  );
}
