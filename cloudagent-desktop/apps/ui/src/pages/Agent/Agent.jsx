import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Download,
  ChevronLeft,
  Eye,
  Circle,
  CheckIcon,
  ChevronUp,
  ChevronDown,
  Loader2,
  ArrowLeft,
  ArrowRight,
  X,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  XCircle,
  Maximize2,
  Minimize2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Shield,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import CloudFormationOperationCard from '@/components/CloudFormationOperationCard';
import GithubOperationCard from '@/components/GithubOperationCard';
import { Icons } from '../../components/icons';
import { cn } from '@/lib/utils';
import Markdown from 'markdown-to-jsx';
import toast from 'react-hot-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import get from 'lodash.get';
import { Label } from '@/components/ui/label';
import '@fontsource-variable/roboto-mono';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  getAgentConnection,
  refreshUserCredits,
  recordAgentConnection,
  setIsRegionModalOpen,
  updateAgentConnection,
  updateUserCredits,
} from '../../features/agent/agentSlice';
import { useDispatch, useSelector } from 'react-redux';
import { generateRandomString, getRegionOptions } from '../../helpers/shared';
import { filterCloudEnvironments } from '../../helpers/shared';
import {
  toLogObject,
  getRunSummaryFromLog,
  logAgentChunk,
  logAgentLoadingState,
  logAgentStateSummary,
  logBlueprintUpdate,
} from '../../helpers/logUtils';
import {
  dedupeCloudFormationOperations,
  normalizeCloudFormationOperation,
} from '../../helpers/cloudformationOperations';
import {
  dedupeGithubOperations,
  normalizeGithubOperation,
} from '../../helpers/githubOperations';
import { runBackgroundAgent } from '../../api/apigw';
import { ActionButtons } from '../Libraries/Library';
import { CommandList } from '../../components/ui/command';
import { PermissionsModal } from '../Libraries/PermissionsModal';
import { fetchBlueprintById } from '../../features/blueprint/blueprintSlice';
import { useAgentSetup } from '../../hooks/useAgentSetup';
import { streamAgentCall, streamCodexAgentRunResume } from '../../api/agent';
import { sendCommandCenterIntent } from '../../api/commandCenterApi';
import { loadWorkloadsFromUserProfile } from '../../features/workload/workloadSlice';
import { startBackgroundReportOperation } from '../../features/operations/operationsSlice';
import { analytics, ANALYTICS_EVENTS, getAnalyticsRoute } from '../../hooks/useAnalytics';
import { validatePermissionProfile, updatePermissionProfilePermissions } from '../../api/ops';
import { AddGoogleWorkspaceModal } from '../../components/AddGoogleWorkspaceModal';
import AddAzureModal from '../../components/AddAzureModal';
import { buildRecommendationExecutionContext } from '../../helpers/recommendations/remediationTargets';
import { isLocalRuntime } from '../../runtime/cloudAgentRuntime';
import { getLocalAwsCredentialIssueMessage } from '../../features/workspace/credentialStatus';

function textForCodexInputDetection(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function containsCodexUserInputRequest(value) {
  return /user\s+input\s+needed/i.test(
    textForCodexInputDetection(value).replace(/[*_`>#-]/g, ' ')
  );
}

/**
 * Safety function to validate and clean depends_on fields in a plan.
 * Removes any task IDs from depends_on that reference tasks appearing later
 * than the current task being evaluated. This prevents crashes in processing logic.
 * 
 * @param {Array} plan - Array of phases, each containing tasks
 * @returns {Array} - Plan with cleaned depends_on fields
 */
function validateAndCleanDependsOn(plan) {
  if (!Array.isArray(plan)) return plan;

  // Create a map of task IDs to their positions (phaseIndex, taskIndex)
  const taskPositionMap = new Map();
  plan.forEach((phase, phaseIndex) => {
    if (Array.isArray(phase.tasks)) {
      phase.tasks.forEach((task, taskIndex) => {
        if (task && task.id) {
          taskPositionMap.set(task.id, { phaseIndex, taskIndex });
        }
      });
    }
  });

  // Clean depends_on for each task
  const cleanedPlan = plan.map((phase, phaseIndex) => {
    if (!Array.isArray(phase.tasks)) return phase;

    const cleanedTasks = phase.tasks.map((task, taskIndex) => {
      if (!task || !task.depends_on || !Array.isArray(task.depends_on)) {
        return task;
      }

      // Filter out task IDs that reference tasks appearing later
      const cleanedDependsOn = task.depends_on.filter((depTaskId) => {
        const depPosition = taskPositionMap.get(depTaskId);
        
        // If the dependent task doesn't exist, remove it
        if (!depPosition) {
          console.warn(
            `Task ${task.id} references non-existent task ${depTaskId} in depends_on. Removing.`
          );
          return false;
        }

        // If the dependent task appears later (higher phase or same phase but later task), remove it
        if (
          depPosition.phaseIndex > phaseIndex ||
          (depPosition.phaseIndex === phaseIndex && depPosition.taskIndex > taskIndex)
        ) {
          console.warn(
            `Task ${task.id} (phase ${phaseIndex}, task ${taskIndex}) references later task ${depTaskId} ` +
            `(phase ${depPosition.phaseIndex}, task ${depPosition.taskIndex}) in depends_on. Removing.`
          );
          return false;
        }

        return true;
      });

      return {
        ...task,
        depends_on: cleanedDependsOn,
      };
    });

    return {
      ...phase,
      tasks: cleanedTasks,
    };
  });

  return cleanedPlan;
}

function parseMaybeJson(value, fallback = {}) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  if (typeof value === 'object') return value;
  return fallback;
}

function extractBlueprintPlan(blueprint) {
  if (Array.isArray(blueprint?.plan)) return blueprint.plan;
  if (Array.isArray(blueprint?.plan?.plan)) return blueprint.plan.plan;
  if (Array.isArray(blueprint)) return blueprint;
  return null;
}

function normalizeBlueprintPlanStatuses(plan) {
  if (!Array.isArray(plan)) return [];
  return plan.map((phase) => ({
    ...phase,
    tasks: (phase.tasks || []).map((task) => ({
      ...task,
      status: task.status || 'not-run',
    })),
  }));
}

function getTaskRuntimeMergeKey(task, phaseIndex, taskIndex) {
  return String(
    task?.id ||
      task?.task_id ||
      task?.title ||
      task?.name ||
      `${phaseIndex}:${taskIndex}`
  );
}

function mergeRuntimeTaskState(nextPlan = [], previousPlan = []) {
  const previousByKey = new Map();
  previousPlan.forEach((phase, phaseIndex) => {
    (phase?.tasks || []).forEach((task, taskIndex) => {
      previousByKey.set(getTaskRuntimeMergeKey(task, phaseIndex, taskIndex), task);
    });
  });

  return nextPlan.map((phase, phaseIndex) => ({
    ...phase,
    tasks: (phase.tasks || []).map((task, taskIndex) => {
      const previousTask = previousByKey.get(getTaskRuntimeMergeKey(task, phaseIndex, taskIndex));
      if (!previousTask) return task;
      return {
        ...task,
        status: previousTask.status || task.status,
        task_output: previousTask.task_output || task.task_output,
        cli_command_output: Array.isArray(previousTask.cli_command_output)
          ? previousTask.cli_command_output
          : task.cli_command_output,
        cloudformation_operations: Array.isArray(previousTask.cloudformation_operations)
          ? previousTask.cloudformation_operations
          : task.cloudformation_operations,
        github_operations: Array.isArray(previousTask.github_operations)
          ? previousTask.github_operations
          : task.github_operations,
        codex_session_info: Array.isArray(previousTask.codex_session_info)
          ? previousTask.codex_session_info
          : task.codex_session_info,
      };
    }),
  }));
}

const GITHUB_TOOL_NAMES = new Set([
  'list_github_repos',
  'read_github_file',
  'write_github_file',
  'create_github_branch',
  'create_github_pull_request',
]);

function getCloudFormationOperationTimestamp(operation) {
  const candidates = [
    operation?.lastUpdatedTime,
    operation?.createdTime,
    operation?.timestamp,
  ];
  for (const value of candidates) {
    if (!value) continue;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function getLatestCloudFormationOperation(operations = []) {
  return (Array.isArray(operations) ? operations : []).reduce((latest, operation) => {
    if (!operation || typeof operation !== 'object') return latest;
    if (!latest) return operation;
    return getCloudFormationOperationTimestamp(operation) >= getCloudFormationOperationTimestamp(latest)
      ? operation
      : latest;
  }, null);
}

function getCloudFormationOperationKey(operation) {
  if (!operation || typeof operation !== 'object') return 'stack';
  return (
    operation?.cardId ||
    operation?.stackId ||
    `${operation?.stackName || 'stack'}:${operation?.region || 'region'}`
  );
}

function isCloudFormationTerminal(operation) {
  if (!operation || typeof operation !== 'object') return false;
  if (typeof operation.terminal === 'boolean') return operation.terminal;
  return ['deployment_complete', 'failed', 'no_changes'].includes(
    String(operation.statusKind || '').toLowerCase()
  );
}

function isCloudFormationRefreshable(operation) {
  if (!operation || typeof operation !== 'object') return false;
  return (
    !isCloudFormationTerminal(operation) &&
    String(operation.statusKind || '').toLowerCase() === 'deployment_in_progress'
  );
}

function buildCloudFormationRelevantOutput(operation) {
  if (!operation || typeof operation !== 'object') return '';
  const details = [
    `Live CloudFormation status update for the current task.`,
    operation?.stackName ? `Stack: ${operation.stackName}.` : null,
    operation?.status ? `Current status: ${operation.status}.` : null,
    operation?.summary ? `Summary: ${operation.summary}` : null,
    operation?.message && operation?.message !== operation?.summary
      ? `Message: ${operation.message}`
      : null,
  ].filter(Boolean);

  const events = Array.isArray(operation?.events) ? operation.events.slice(0, 3) : [];
  if (events.length > 0) {
    details.push(
      `Recent events: ${events
        .map((event) =>
          [event?.resourceStatus || 'EVENT', event?.logicalResourceId, event?.resourceStatusReason]
            .filter(Boolean)
            .join(' - ')
        )
        .join(' | ')}`
    );
  }

  details.push(
    'This came from a live status refresh. Do not create or update the same stack again unless a new infrastructure change is explicitly required.'
  );

  return details.join('\n');
}

function buildCloudFormationAutoMessage(operation) {
  if (!operation || typeof operation !== 'object') return '';
  const stackLabel = operation?.stackName || operation?.stackId || 'the CloudFormation stack';
  const statusLabel = operation?.status || operation?.statusLabel || 'a terminal state';
  const outcomeText =
    String(operation?.statusKind || '').toLowerCase() === 'failed'
      ? 'failed'
      : String(operation?.statusKind || '').toLowerCase() === 'no_changes'
        ? 'completed with no changes'
        : 'completed successfully';

  return `CloudFormation status update: ${stackLabel} ${outcomeText} (${statusLabel}). Please continue from this result and do not create or update the same stack again unless a new change is required.`;
}

function getGithubOperationTimestamp(operation) {
  const value = operation?.timestamp;
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getLatestGithubOperation(operations = []) {
  return (Array.isArray(operations) ? operations : []).reduce((latest, operation) => {
    if (!operation || typeof operation !== 'object') return latest;
    if (!latest) return operation;
    return getGithubOperationTimestamp(operation) >= getGithubOperationTimestamp(latest)
      ? operation
      : latest;
  }, null);
}

function buildGithubRelevantOutput(operation) {
  if (!operation || typeof operation !== 'object') return '';
  const details = [
    'Live GitHub status update for the current task.',
    operation?.repoFullName ? `Repository: ${operation.repoFullName}.` : null,
    operation?.pullRequestNumber ? `Pull request: #${operation.pullRequestNumber}.` : null,
    operation?.pullRequestTitle ? `Title: ${operation.pullRequestTitle}.` : null,
    operation?.summary ? `Summary: ${operation.summary}` : null,
    operation?.message && operation?.message !== operation?.summary
      ? `Message: ${operation.message}`
      : null,
  ].filter(Boolean);

  details.push(
    'Use this live GitHub status when deciding the next step. Do not create a duplicate branch or pull request unless a new change is actually required.'
  );

  return details.join('\n');
}

function buildGithubMergeConfirmationMessage(operation) {
  if (!operation || typeof operation !== 'object') return '';
  const repoLabel = operation?.repoFullName || 'the repository';
  const prLabel = operation?.pullRequestNumber ? `#${operation.pullRequestNumber}` : 'the pull request';
  return `GitHub update: ${prLabel} in ${repoLabel} was merged successfully. Continue from that result and update the run accordingly.`;
}

function buildGithubIssueReportMessage(operation, issueText) {
  if (!operation || typeof operation !== 'object') return String(issueText || '').trim();
  const repoLabel = operation?.repoFullName || 'the repository';
  const prLabel = operation?.pullRequestNumber ? `#${operation.pullRequestNumber}` : 'the pull request';
  return `GitHub update: ${prLabel} in ${repoLabel} did not merge successfully.\n\nReported issue:\n${String(
    issueText || ''
  ).trim()}\n\nPlease use this to adjust the next step and avoid opening a duplicate PR unless it is necessary.`;
}

function normalizeExecutionCredits(value, fallback = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeBlueprintExecutionMode(value) {
  const normalized = String(value || 'cloudagent').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ['codex', 'codex_cli', 'openai_codex'].includes(normalized) ? 'codex' : 'cloudagent';
}

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

function parseCodexJsonMaybe(value, fallback = null) {
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

function getCodexValueByKeys(value, keys = []) {
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

function normalizeCodexToolPayload(value) {
  const parsed = parseCodexJsonMaybe(value, value);
  if (Array.isArray(parsed)) {
    const text = parsed
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry?.type === 'text' && typeof entry.text === 'string') return entry.text;
        return '';
      })
      .filter(Boolean)
      .join('\n');
    return parseCodexJsonMaybe(text, text || parsed);
  }
  if (parsed?.content && Array.isArray(parsed.content)) {
    return normalizeCodexToolPayload(parsed.content);
  }
  return parsed;
}

function extractAwsCliReadonlyToolInfo(event) {
  if (!event || typeof event !== 'object') return null;
  const item = event.item && typeof event.item === 'object' ? event.item : null;
  let haystack = '';
  try {
    haystack = JSON.stringify(item || event).toLowerCase();
  } catch {
    haystack = String(item?.type || event.type || '').toLowerCase();
  }
  if (!haystack.includes('aws_cli_readonly')) return null;

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
  const input = normalizeCodexToolPayload(rawInput);
  const outputPayload = normalizeCodexToolPayload(
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
    getCodexValueByKeys(input, ['command', 'cli_command']) ||
    getCodexValueByKeys(outputPayload, ['command', 'cli_command']) ||
    'aws_cli_readonly';
  const accountId =
    getCodexValueByKeys(input, ['accountId', 'account_id']) ||
    getCodexValueByKeys(outputPayload, ['accountId', 'account_id']) ||
    null;
  const permissionProfileId =
    getCodexValueByKeys(input, ['permissionProfileId', 'permission_profile_id']) ||
    null;
  const resultOutput =
    outputPayload?.output ||
    outputPayload?.result?.output ||
    outputPayload?.data?.result?.output ||
    outputPayload?.data?.output ||
    outputPayload;
  const stdout = String(getCodexValueByKeys(resultOutput, ['stdout']) || '').trim();
  const stderr = String(getCodexValueByKeys(resultOutput, ['stderr']) || '').trim();
  const okValue =
    getCodexValueByKeys(outputPayload, ['ok']) ??
    (getCodexValueByKeys(outputPayload, ['statusCode']) === 200 ? true : undefined);
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
  };
}

function formatCodexEventForTerminal(event) {
  if (!event || typeof event !== 'object') return null;
  const type = String(event.type || '').trim();
  const item = event.item && typeof event.item === 'object' ? event.item : null;
  const awsCliReadonly = extractAwsCliReadonlyToolInfo(event);
  const isStartedEvent =
    type === 'item.started' ||
    /\.started$/.test(type) ||
    String(item?.status || '').toLowerCase() === 'in_progress';
  const isCompletedEvent =
    type === 'item.completed' ||
    /\.completed$/.test(type) ||
    ['completed', 'failed', 'error'].includes(String(item?.status || '').toLowerCase());

  if (awsCliReadonly && isStartedEvent) {
    const metadata = [
      awsCliReadonly.accountId ? `Account: ${awsCliReadonly.accountId}` : null,
      awsCliReadonly.permissionProfileId ? `Permission profile: ${awsCliReadonly.permissionProfileId}` : null,
    ].filter(Boolean);
    return {
      command: awsCliReadonly.command,
      source: 'mcp:aws_cli_readonly',
      text: ['[running] CloudAgent MCP aws_cli_readonly', ...metadata].join('\n') + '\n',
    };
  }

  if (awsCliReadonly && isCompletedEvent) {
    const rawText =
      !awsCliReadonly.stdout && !awsCliReadonly.stderr && awsCliReadonly.rawOutput
        ? JSON.stringify(awsCliReadonly.rawOutput, null, 2)
        : '';
    const output = [
      awsCliReadonly.stdout ? `Output:\n${awsCliReadonly.stdout}` : null,
      awsCliReadonly.stderr ? `Error:\n${awsCliReadonly.stderr}` : null,
      rawText ? `Output:\n${rawText}` : null,
    ].filter(Boolean);
    return {
      command: awsCliReadonly.command,
      source: 'mcp:aws_cli_readonly',
      text: [
        `[completed] CloudAgent MCP aws_cli_readonly${awsCliReadonly.statusText ? ` ${awsCliReadonly.statusText}` : ''}`,
        ...output,
      ].filter(Boolean).join('\n') + '\n',
    };
  }

  if (type === 'error') {
    return {
      command: 'codex error',
      source: 'codex',
      text: `[error] ${event.message || event.error || JSON.stringify(event)}\n`,
    };
  }

  if (type === 'item.started' && item?.type === 'command_execution') {
    const command = formatCodexCommand(item.command);
    return {
      command: command || 'command',
      source: 'codex',
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
      source: 'codex',
      text: [
        `[completed] Command ${status}${exitText}`,
        output ? `Output:\n${output}` : null,
      ].filter(Boolean).join('\n') + '\n',
    };
  }

  if (type === 'item.completed' && item?.type === 'agent_message') {
    return null;
  }

  return null;
}

function formatCodexEventForChat(event) {
  const item = event?.item && typeof event.item === 'object' ? event.item : null;
  if (event?.type === 'item.completed' && item?.type === 'agent_message') {
    const text = String(item.text || '').trim();
    return text ? `[codex]\n${text}\n` : '';
  }
  return '';
}

function formatCodexEventForSessionInfo(event) {
  if (!event || typeof event !== 'object') return '';
  const type = String(event.type || '').trim();
  const item = event.item && typeof event.item === 'object' ? event.item : null;

  if (type === 'thread.started') {
    return `Codex thread started${event.thread_id ? `\nThread ID: ${event.thread_id}` : ''}`;
  }
  if (type === 'turn.started') {
    return 'Codex turn started';
  }
  if (type === 'turn.completed') {
    return 'Codex turn completed';
  }
  if (type === 'item.started' && item?.type && item.type !== 'command_execution') {
    return `Started: ${item.type}`;
  }
  if (type === 'item.completed' && item?.type && item.type !== 'command_execution' && item.type !== 'agent_message') {
    return `Completed: ${item.type}`;
  }
  if (type && type !== 'error') {
    return `Event: ${type}`;
  }
  return '';
}

function classifyCodexStreamChunk(chunk) {
  if (chunk?.type === 'codex_event') {
    const terminalUpdate = formatCodexEventForTerminal(chunk.event);
    if (terminalUpdate?.text?.trim()) {
      return { target: 'terminal', ...terminalUpdate };
    }

    const chatText = formatCodexEventForChat(chunk.event);
    if (chatText.trim()) return { target: 'chat', text: chatText };

    const sessionText = formatCodexEventForSessionInfo(chunk.event);
    if (sessionText.trim()) return { target: 'session', text: sessionText };

    return { target: 'ignore', text: '' };
  }

  const content = String(chunk?.content || '').trimEnd();
  if (!content.trim()) return { target: 'ignore', text: '' };
  if (/^Reading additional input from stdin\.\.\.$/i.test(content.trim())) {
    return { target: 'ignore', text: '' };
  }
  if (chunk?.type === 'codex_stderr') {
    return { target: 'session', text: `Codex stderr\n${content}` };
  }
  return { target: 'session', text: content };
}

function appendCodexTerminalHistoryEntry(entries, update) {
  if (!update?.text?.trim()) return entries;
  const commandLabel = update.command || 'codex exec';
  const commandSource = update.source || 'codex';
  const nextEntries = [...entries];
  const lastEntry = nextEntries[nextEntries.length - 1];
  if (lastEntry?.command === commandLabel && lastEntry?.source === commandSource) {
    nextEntries[nextEntries.length - 1] = {
      ...lastEntry,
      output: `${lastEntry.output || ''}${update.text}`,
    };
  } else {
    nextEntries.push({
      command: commandLabel,
      output: update.text,
      source: commandSource,
    });
  }
  return nextEntries;
}

function getCodexEventsFromLogEntry(entry) {
  const rawEvents = entry?.codex?.events ?? entry?.codexEvents ?? [];
  const parsed = parseCodexJsonMaybe(rawEvents, rawEvents);
  return Array.isArray(parsed) ? parsed : [];
}

function isCodexLogEntry(entry) {
  return Boolean(
    entry?.executionMode === 'codex' ||
      entry?.runner === 'codex' ||
      entry?.codex ||
      entry?.taskId === 'codex_blueprint_run'
  );
}

function buildCodexHistoryRestore(logData, { title = '', status = '' } = {}) {
  const logs = Array.isArray(logData?.logs) ? logData.logs : [];
  const codexEntries = logs.filter(isCodexLogEntry);
  const terminalCommands = [];
  const sessionInfo = [];
  const liveMessages = [];

  codexEntries.forEach((entry, entryIndex) => {
    getCodexEventsFromLogEntry(entry).forEach((event, eventIndex) => {
      const update = classifyCodexStreamChunk({ type: 'codex_event', event });
      if (!update?.text?.trim()) return;

      if (update.target === 'terminal') {
        const nextTerminal = appendCodexTerminalHistoryEntry(terminalCommands, update);
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
        liveMessages.push({
          id: `codex-history-${entryIndex}-${eventIndex}`,
          answerIndex: entryIndex,
          timestamp: entry.timestamp || new Date().toISOString(),
          content: update.text.trim(),
        });
      }
    });
  });

  const queries = codexEntries.map((entry, index) => {
    if (entry?.input) return entry.input;
    if (index > 0) return entry?.taskTitle || `Codex follow-up ${index}`;
    return `Run Codex blueprint${title ? `: ${title}` : ''}`;
  });
  const answers = codexEntries.map((entry) =>
    String(entry?.task_output || entry?.output || '').trim()
  );
  const lastEntry = codexEntries[codexEntries.length - 1] || null;

  return {
    codexEntries,
    terminalCommands,
    sessionInfo,
    liveMessages,
    queries,
    answers,
    status: lastEntry?.status || status || logData?.runSummary?.status || '',
    output: String(lastEntry?.task_output || lastEntry?.output || '').trim(),
  };
}

function restoreCodexRunPlan(plan, restore, fallbackStatus = '') {
  const sourcePlan =
    Array.isArray(plan) && plan.length > 0
      ? plan
      : [
          {
            phase: 'Codex',
            tasks: [
              {
                id: 'codex_blueprint_run',
                title: 'Codex blueprint session',
                status: 'not-run',
              },
            ],
          },
        ];
  const nextPlan = sourcePlan.map((phase) => ({
    ...phase,
    tasks: Array.isArray(phase.tasks) ? phase.tasks.map((task) => ({ ...task })) : [],
  }));
  const firstTask = nextPlan[0]?.tasks?.[0];
  if (firstTask) {
    firstTask.status = restore.status || fallbackStatus || 'complete';
    firstTask.task_output = restore.output || firstTask.task_output || '';
    firstTask.cli_command_output = restore.terminalCommands;
    firstTask.codex_session_info = restore.sessionInfo;
  }
  return nextPlan;
}

function normalizeCodexTranscriptText(value) {
  return String(value || '')
    .replace(/^\s*\[codex\]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function Agent() {
  const dispatch = useDispatch();
  const { recordId } = useParams();
  const location = useLocation();
  const { shouldAutocontinue, initialGlobalSettings, recordId: blueprintRecordId } = location.state || {};
  const recommendationExecutionContext = useMemo(
    () => buildRecommendationExecutionContext(location.state?.fromRecommendation || null),
    [location.state?.fromRecommendation]
  );
  
  const chatRefs = useRef({});
  const scrollRef = useRef(null);
  const lastMessageRef = useRef(null);
  const settingsUpdatedRef = useRef(false);
  const activeTaskStreamRef = useRef(new Set());
  const reviewAutoContinueSentRef = useRef(false);
  const cloudFormationRefreshInFlightRef = useRef(new Set());
  const cloudFormationTerminalNotifiedRef = useRef(new Set());

  const [activeView, setActiveView] = useState('columns');
  const [activityTab, setActivityTab] = useState('terminal');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCodexSessionInfoOpen, setIsCodexSessionInfoOpen] = useState(false);
  const [isTaskPanelMinimized, setIsTaskPanelMinimized] = useState(true);
  const [cloudFormationRefreshSchedule, setCloudFormationRefreshSchedule] = useState({});
  const [cloudFormationRefreshTick, setCloudFormationRefreshTick] = useState(Date.now());
  const [githubIssueDialog, setGithubIssueDialog] = useState({
    open: false,
    operation: null,
    issueText: '',
  });
  const navigate = useNavigate();
  const [initialLoading, setInitialLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reviewCountdown, setReviewCountdown] = useState(null);
  const [reviewCountdownPaused, setReviewCountdownPaused] = useState(false);
  const { autoplay, isRegionModalOpen } = useSelector((state) => state.agent);
  const [hasStarted, setHasStarted] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(
    location.state?.isReconnecting || false
  );
  const navigationIsBluePrint = location.state?.isBluePrint || false;
  const {
    setupState,
    initializeFromExistingData,
    setSetupState,
    handleSettingsComplete,
    handlePermissionsComplete,
  } = useAgentSetup();

  const sessionStorageKey = useMemo(
    () => (recordId ? `agent-session-${recordId}` : null),
    [recordId]
  );

  const readStoredSessionId = useCallback(() => {
    if (!sessionStorageKey || typeof window === 'undefined') {
      return null;
    }
    try {
      return window.localStorage.getItem(sessionStorageKey);
    } catch (error) {
      console.warn('[Agent] Unable to read stored sessionId:', error);
      return null;
    }
  }, [sessionStorageKey]);

  const persistSessionId = useCallback(
    (value) => {
      if (!sessionStorageKey || !value || typeof window === 'undefined') {
        return;
      }
      try {
        window.localStorage.setItem(sessionStorageKey, value);
      } catch (error) {
        console.warn('[Agent] Unable to persist sessionId:', error);
      }
    },
    [sessionStorageKey]
  );

  const [state, setState] = useState({
    plan: [],
    planDetails: null,
    planId: '',
    blueprintId: blueprintRecordId || recordId || '',
    executionMode: normalizeBlueprintExecutionMode(location.state?.executionMode),
    title: '',
    existingAgentData: {},
    inputSummary: '',
    currentPhase: -1,
    currentTask: -1,
    autoContinue: false,
    showTerminal: true,
    hasShownTerminal: false, // Track if terminal has ever been shown
    queries: [],
    answers: [],
    codexLiveMessages: [],
    loading: false,
    actions: [],
    followupPrompt: '',
    showConfigurationPlan: true,
    deploymentMethod: '',
    currentAction: '',
    finalRunSummary: '',
    accountId: '',
    sessionId: '',
    responseError: null,
    responseErrorMessage: '',
    preflight: {
      phase: '',
      message: '',
      recommendation: null,
      question: null,
      selections: {},
      decision: null,
      validation: null,
      steps: [],
    },
  });

  const {
    plan,
    currentPhase,
    currentTask,
    autoContinue,
    planId,
    planDetails,
    title,
    existingAgentData,
    sessionId,
    blueprintId,
    finalRunSummary,
  } = state;
  const existingAgentLog = useMemo(
    () => toLogObject(existingAgentData?.log),
    [existingAgentData?.log]
  );
  const isBluePrint =
    navigationIsBluePrint ||
    existingAgentLog?.isBluePrint === true ||
    Boolean(existingAgentData?.updatedBlueprint);
  const isCodexExecution =
    normalizeBlueprintExecutionMode(
      state.executionMode ||
      existingAgentLog?.executionMode ||
      existingAgentLog?.runner ||
      existingAgentData?.executionMode ||
      existingAgentData?.runner
    ) === 'codex';
  const activeTaskStatus = plan?.[currentPhase]?.tasks?.[currentTask]?.status;
  const latestAnswer = Array.isArray(state.answers) && state.answers.length > 0
    ? state.answers[state.answers.length - 1]
    : '';
  const latestAnswerRequestsCodexInput =
    isCodexExecution && containsCodexUserInputRequest(latestAnswer);
  const isCodexWaitingForInput =
    isCodexExecution &&
    (activeTaskStatus === 'waiting_on_user_input' ||
      existingAgentData?.status === 'waiting_on_user_input' ||
      latestAnswerRequestsCodexInput);
  const shouldShowAgentChatInput =
    isCodexExecution || isCodexWaitingForInput || activeTaskStatus !== 'not-run';
  const preflightActivityRef = useRef(null);

  useEffect(() => {
    const node = preflightActivityRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [state.preflight?.steps?.length]);

  useEffect(() => {
    const questionId = state.preflight?.question?.id || null;
    if (questionId === 'analysis_review') {
      reviewAutoContinueSentRef.current = false;
      setReviewCountdown(30);
      setReviewCountdownPaused(false);
      return;
    }
    reviewAutoContinueSentRef.current = false;
    setReviewCountdown(null);
    setReviewCountdownPaused(false);
  }, [state.preflight?.question?.id]);

  useEffect(() => {
    if (
      state.preflight?.question?.id !== 'analysis_review' ||
      reviewCountdown == null ||
      reviewCountdownPaused
    ) {
      return undefined;
    }
    if (reviewCountdown <= 0) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setReviewCountdown((prev) => (prev == null ? prev : Math.max(prev - 1, 0)));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [state.preflight?.question?.id, reviewCountdown, reviewCountdownPaused]);

  useEffect(() => {
    if (
      state.preflight?.question?.id !== 'analysis_review' ||
      reviewCountdown !== 0 ||
      reviewCountdownPaused ||
      reviewAutoContinueSentRef.current
    ) {
      return;
    }
    reviewAutoContinueSentRef.current = true;
    handlePreflightAnswer(
      'analysis_review',
      'continue',
      state.preflight?.selections || {}
    );
  }, [
    state.preflight?.question?.id,
    state.preflight?.selections,
    reviewCountdown,
    reviewCountdownPaused,
  ]);

  const { authProfile, accountId } = setupState;

  // Determine the target cloudProvider for filtering permission profiles
  // Priority: 1) navigation state, 2) plan task, 3) first task, 4) default 'aws'
  const targetCloudProvider = useMemo(() => {
    const phaseIndex = currentPhase >= 0 ? currentPhase : 0;
    const taskIndex = currentTask >= 0 ? currentTask : 0;
    
    // First check navigation state (passed from Library.jsx when clicking "Run Agent")
    const navCloudProvider = location.state?.cloudProvider;
    
    const cloudProvider = navCloudProvider ||
                          plan?.[phaseIndex]?.tasks?.[taskIndex]?.cloudProvider || 
                          plan?.[0]?.tasks?.[0]?.cloudProvider || 
                          'aws';
    
    console.log('[Agent] Derived targetCloudProvider:', {
      cloudProvider,
      navCloudProvider,
      planId,
      blueprintId,
      phaseIndex,
      taskIndex,
      taskCloudProvider: plan?.[phaseIndex]?.tasks?.[taskIndex]?.cloudProvider,
      firstTaskCloudProvider: plan?.[0]?.tasks?.[0]?.cloudProvider,
      planLength: plan?.length,
      firstPhaseTasksLength: plan?.[0]?.tasks?.length,
    });
    
    return cloudProvider;
  }, [location.state?.cloudProvider, plan, currentPhase, currentTask, planId, blueprintId]);

  useEffect(() => {
    const fetchAgentData = async () => {
      try {
        setLoading(true);

        // First, always fetch the agent connection to check if it's a blueprint
        const agentConnectionData = await dispatch(
          getAgentConnection(recordId)
        ).unwrap();

        const parsedAuthProfile = parseMaybeJson(
          agentConnectionData.authProfile,
          {}
        );
        const parsedLog = toLogObject(agentConnectionData.log);

        // Determine if this is a user-created blueprint or a system plan
        // User blueprints have UUID recordIds, system plans have string IDs like "guardduty_config"
        const isUUID = (str) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            str
          );

        const blueprintId =
          location.state?.recordId ||
          parsedLog?.blueprintId ||
          agentConnectionData.itemId;

        const updatedBlueprintPayload =
          parseMaybeJson(agentConnectionData.updatedBlueprint, null);
        const updatedBlueprintPlan = extractBlueprintPlan(updatedBlueprintPayload);
        const navigationBlueprintPayload = location.state?.plan || null;

        if (Array.isArray(updatedBlueprintPlan)) {
          const cleanedPlan = validateAndCleanDependsOn(
            normalizeBlueprintPlanStatuses(updatedBlueprintPlan)
          );
          const parsedPermissions = parseMaybeJson(
            updatedBlueprintPayload?.requiredPermissions,
            {}
          );
          const parsedSettings = parseMaybeJson(
            updatedBlueprintPayload?.planSettings,
            {}
          );

          setState((prev) => ({
            ...prev,
            planId: blueprintId || agentConnectionData.itemId || prev.planId,
            blueprintId:
              updatedBlueprintPayload?.recordId ||
              blueprintId ||
              agentConnectionData.itemId ||
              prev.blueprintId,
            planDetails: cleanedPlan,
            title: updatedBlueprintPayload?.title || prev.title,
            type: updatedBlueprintPayload?.type || 'blueprint',
            inputSummary: parsedSettings?.defaultValues || '',
            requiredPermissions: parsedPermissions,
            credits: updatedBlueprintPayload?.credits ?? updatedBlueprintPayload?.creditCost ?? 1,
            executionMode: normalizeBlueprintExecutionMode(
              updatedBlueprintPayload?.executionMode ||
              updatedBlueprintPayload?.runner ||
              parsedLog?.executionMode ||
              parsedLog?.runner ||
              agentConnectionData?.executionMode ||
              agentConnectionData?.runner
            ),
            existingAgentData: agentConnectionData,
          }));

          initializeFromExistingData({
            ...agentConnectionData,
            parsedAuthProfile,
            parsedLog,
          });
          return;
        }

        if (isLocalRuntime() && (location.state?.isBluePrint || parsedLog?.isBluePrint === true || blueprintId)) {
          let blueprintData = null;
          let blueprintFetchError = null;

          if (blueprintId) {
            try {
              blueprintData = await dispatch(fetchBlueprintById(blueprintId)).unwrap();
            } catch (error) {
              blueprintFetchError = error;
            }
          }

          const sourceBlueprint = blueprintData || navigationBlueprintPayload;
          const sourcePlanValue =
            sourceBlueprint?.plan !== undefined
              ? parseMaybeJson(sourceBlueprint.plan, sourceBlueprint.plan)
              : sourceBlueprint;
          const parsedPlan =
            extractBlueprintPlan(sourcePlanValue) ||
            extractBlueprintPlan(sourceBlueprint) ||
            [];

          if (!Array.isArray(parsedPlan) || parsedPlan.length === 0) {
            const message =
              blueprintFetchError?.message ||
              'Unable to load this local blueprint plan. Reopen the blueprint from the library and try again.';
            throw new Error(message);
          }

          const cleanedPlan = validateAndCleanDependsOn(
            normalizeBlueprintPlanStatuses(parsedPlan)
          );
          const parsedPermissions = parseMaybeJson(
            sourceBlueprint?.requiredPermissions,
            {}
          );
          const parsedSettings = parseMaybeJson(
            sourceBlueprint?.planSettings,
            {}
          );
          const localBlueprintId =
            sourceBlueprint?.recordId ||
            sourceBlueprint?.planId ||
            blueprintId ||
            agentConnectionData.itemId;

          setState((prev) => ({
            ...prev,
            planId: localBlueprintId,
            blueprintId: localBlueprintId,
            planDetails: cleanedPlan,
            title: sourceBlueprint?.title || agentConnectionData.title || prev.title,
            type: sourceBlueprint?.type || 'blueprint',
            inputSummary: parsedSettings?.defaultValues || '',
            requiredPermissions: parsedPermissions,
            credits: sourceBlueprint?.credits ?? sourceBlueprint?.creditCost ?? 1,
            executionMode: normalizeBlueprintExecutionMode(
              sourceBlueprint?.executionMode ||
              sourceBlueprint?.runner ||
              sourcePlanValue?.executionMode ||
              sourcePlanValue?.runner ||
              parsedLog?.executionMode ||
              parsedLog?.runner ||
              agentConnectionData?.executionMode ||
              agentConnectionData?.runner
            ),
            existingAgentData: agentConnectionData,
          }));

          initializeFromExistingData({
            ...agentConnectionData,
            parsedAuthProfile,
            parsedLog,
          });
          return;
        }

        // Only treat as a user blueprint if explicitly flagged AND the blueprintId is a UUID
        // (user-created blueprints use UUID recordIds in the configured blueprint store)
        const isUserBlueprint =
          (location.state?.isBluePrint || parsedLog?.isBluePrint === true) &&
          isUUID(blueprintId);

        // Fallback: if blueprintId is a UUID but isBluePrint flag is not set, try the configured blueprint store first.
        const shouldTryBlueprintStore = isUUID(blueprintId) && !isUserBlueprint;

        if (isUserBlueprint) {
          // Fetch user-created blueprint data from the configured blueprint store.
          const blueprintData = await dispatch(
            fetchBlueprintById(blueprintId)
          ).unwrap();

          const parsedPlan = extractBlueprintPlan(
            parseMaybeJson(blueprintData.plan, [])
          ) || [];
          // Validate and clean depends_on fields
          const cleanedPlan = validateAndCleanDependsOn(parsedPlan);
          const parsedPermissions = parseMaybeJson(
            blueprintData.requiredPermissions,
            {}
          );
          const parsedSettings = parseMaybeJson(blueprintData.planSettings, {});

          setState((prev) => ({
            ...prev,
            planId: blueprintData.recordId,
            blueprintId: blueprintData.recordId,
            planDetails: cleanedPlan,
            title: blueprintData.title,
            type: 'blueprint',
            inputSummary: parsedSettings?.defaultValues || '',
            requiredPermissions: parsedPermissions,
            credits: blueprintData.credits ?? blueprintData.creditCost ?? 1,
            executionMode: normalizeBlueprintExecutionMode(
              blueprintData.executionMode ||
              blueprintData.runner ||
              parsedLog?.executionMode ||
              parsedLog?.runner ||
              agentConnectionData?.executionMode ||
              agentConnectionData?.runner
            ),
            existingAgentData: agentConnectionData,
          }));

          initializeFromExistingData({
            ...agentConnectionData,
            parsedAuthProfile,
            parsedLog,
          });
        } else if (shouldTryBlueprintStore) {
          // Try the configured blueprint store first as fallback for UUID blueprintIds.
          try {
            const blueprintData = await dispatch(
              fetchBlueprintById(blueprintId)
            ).unwrap();

            const parsedPlan = extractBlueprintPlan(
              parseMaybeJson(blueprintData.plan, [])
            ) || [];
            // Validate and clean depends_on fields
            const cleanedPlan = validateAndCleanDependsOn(parsedPlan);
            const parsedPermissions = parseMaybeJson(
              blueprintData.requiredPermissions,
              {}
            );
            const parsedSettings = parseMaybeJson(blueprintData.planSettings, {});

            setState((prev) => ({
              ...prev,
              planId: blueprintData.recordId,
              blueprintId: blueprintData.recordId,
              planDetails: cleanedPlan,
              title: blueprintData.title,
              type: 'blueprint',
              inputSummary: parsedSettings?.defaultValues || '',
              requiredPermissions: parsedPermissions,
              credits: blueprintData.credits ?? blueprintData.creditCost ?? 1,
              executionMode: normalizeBlueprintExecutionMode(
                blueprintData.executionMode ||
                blueprintData.runner ||
                parsedLog?.executionMode ||
                parsedLog?.runner ||
                agentConnectionData?.executionMode ||
                agentConnectionData?.runner
              ),
              existingAgentData: agentConnectionData,
            }));

            initializeFromExistingData({
              ...agentConnectionData,
              parsedAuthProfile,
              parsedLog,
            });
          } catch (blueprintStoreError) {
            // If the configured blueprint store fetch fails, fall back to the packaged plan definition URL.
            console.warn('Failed to fetch from blueprint store, trying plan definition URL:', blueprintStoreError);
            const extractedPlanId = agentConnectionData.itemId;
            const planResponse = await fetch(
              `https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/plans/${extractedPlanId}.json`
            );
            const planData = await planResponse.json();
            // Validate and clean depends_on fields
            const cleanedPlan = validateAndCleanDependsOn(planData.plan);

            setState((prev) => ({
              ...prev,
              planId: extractedPlanId,
              blueprintId: extractedPlanId,
              planDetails: cleanedPlan,
              title: planData.title,
              type: planData.type,
              inputSummary: planData.planSettings?.defaultValues || '',
              existingAgentData: agentConnectionData,
              requiredPermissions: planData.requiredPermissions || {},
              credits: planData.credits ?? planData.creditCost ?? 1,
              executionMode: normalizeBlueprintExecutionMode(
                planData.executionMode ||
                planData.runner ||
                parsedLog?.executionMode ||
                parsedLog?.runner ||
                agentConnectionData?.executionMode ||
                agentConnectionData?.runner
              ),
            }));

            initializeFromExistingData({
              ...agentConnectionData,
              parsedAuthProfile,
              parsedLog,
            });
          }
        } else {
          // Standard plan - fetch from S3
          const extractedPlanId = agentConnectionData.itemId;
          const planResponse = await fetch(
            `https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/plans/${extractedPlanId}.json`
          );
          const planData = await planResponse.json();
          // Validate and clean depends_on fields
          const cleanedPlan = validateAndCleanDependsOn(planData.plan);

          setState((prev) => ({
            ...prev,
            planId: extractedPlanId,
            blueprintId: extractedPlanId,
            planDetails: cleanedPlan,
            title: planData.title,
            type: planData.type,
            inputSummary: planData.planSettings?.defaultValues || '',
            existingAgentData: agentConnectionData,
            requiredPermissions: planData.requiredPermissions || {},
            credits: planData.credits ?? planData.creditCost ?? 1,
            executionMode: normalizeBlueprintExecutionMode(
              planData.executionMode ||
              planData.runner ||
              parsedLog?.executionMode ||
              parsedLog?.runner ||
              agentConnectionData?.executionMode ||
              agentConnectionData?.runner
            ),
          }));

          initializeFromExistingData({
            ...agentConnectionData,
            parsedAuthProfile,
            parsedLog,
          });
        }
      } catch (error) {
        console.error('Error fetching agent data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (recordId) {
      fetchAgentData();
    }
  }, [recordId, location.state?.isBluePrint]);

  useEffect(() => {
    if (isRegionModalOpen) {
      // Settings modal opened
    }
  }, [
    isRegionModalOpen,
    blueprintId,
    planId,
    recordId,
    existingAgentData?.itemId,
    location.state?.isBluePrint,
  ]);

  useEffect(() => {
    if (
      initialGlobalSettings &&
      Object.keys(initialGlobalSettings).length > 0 &&
      Object.keys(setupState.globalSettings || {}).length === 0
    ) {
      setSetupState((prev) => ({
        ...prev,
        globalSettings: initialGlobalSettings,
      }));
    }
  }, [initialGlobalSettings, setupState.globalSettings, setSetupState]);

  // Update state.blueprintId when blueprintRecordId from location.state is available
  useEffect(() => {
    if (blueprintRecordId && !state.blueprintId) {
      setState((prev) => ({
        ...prev,
        blueprintId: blueprintRecordId,
      }));
    }
  }, [blueprintRecordId, state.blueprintId]);

  useEffect(() => {
    if (!sessionStorageKey) return;
    if (sessionId) return;
    const storedSessionId = readStoredSessionId();
    if (storedSessionId) {
      setState((prev) => ({
        ...prev,
        sessionId: storedSessionId,
      }));
    }
  }, [sessionStorageKey, sessionId, readStoredSessionId]);

  useEffect(() => {
    if (setupState.authProfile.validated) {
      const fetchPlan = async () => {
        // Validate and clean depends_on fields before processing
        let plan = validateAndCleanDependsOn(planDetails);

        if (existingAgentData && Object.keys(existingAgentData).length > 0) {
          const restoredRunSummary = getRunSummaryFromLog(existingAgentData.log);
          setState((prev) => ({
            ...prev,
            finalRunSummary: restoredRunSummary || prev.finalRunSummary,
          }));

          const logData = toLogObject(existingAgentData.log);
          const shouldRestoreCodexHistory =
            normalizeBlueprintExecutionMode(
              state.executionMode ||
                logData?.executionMode ||
                logData?.runner ||
                existingAgentData?.executionMode ||
                existingAgentData?.runner
            ) === 'codex';

          if (shouldRestoreCodexHistory) {
            const restore = buildCodexHistoryRestore(logData, {
              title: existingAgentData.title || title,
              status: existingAgentData.status,
            });
            if (restore.codexEntries.length > 0) {
              const restoredPlan = restoreCodexRunPlan(
                plan,
                restore,
                existingAgentData.status
              );
              setState((prev) => ({
                ...prev,
                currentPhase: 0,
                currentTask: 0,
                queries: restore.queries,
                answers: restore.answers,
                codexLiveMessages: restore.liveMessages,
                plan: restoredPlan,
                hasShownTerminal: restore.terminalCommands.length > 0,
                autoContinue: false,
                loading: false,
                currentAction: '',
              }));
              if (restore.terminalCommands.length > 0) {
                setActivityTab('terminal');
              }
              return;
            }
            if (currentPhase >= 0) {
              return;
            }
          }

          if (
            existingAgentData.log &&
            Array.isArray(logData.logs) &&
            logData.logs.length > 0
          ) {
            const allQueries = [];
            const allAnswers = [];

            let hasCliCommands = false;
            logData.logs.forEach((entry) => {
              const phase = plan[entry.phaseIndex];
              const task = phase?.tasks[entry.taskIndex];
              if (task) {
                task.status = entry.status;
                task.task_output = entry.task_output;
                // Normalize cli_command_output: backend may use cli_command instead of command
                task.cli_command_output = Array.isArray(entry.cli_command_output)
                  ? entry.cli_command_output.map((cmd) => ({
                      command: cmd.command || cmd.cli_command,
                      output: cmd.output,
                    }))
                  : entry.cli_command_output;
                task.cloudformation_operations = dedupeCloudFormationOperations(
                  (Array.isArray(entry.cloudformation_operations)
                    ? entry.cloudformation_operations
                    : []
                  )
                    .map((operation) =>
                      normalizeCloudFormationOperation({ output: operation, input: null }) || operation
                    )
                    .filter(Boolean)
                );
                task.github_operations = dedupeGithubOperations(
                  (Array.isArray(entry.github_operations) ? entry.github_operations : [])
                    .map((operation) =>
                      normalizeGithubOperation({ output: operation, input: null }) || operation
                    )
                    .filter(Boolean)
                );
                
                // Check if this task has CLI commands
                if (entry.cli_command_output && entry.cli_command_output.length > 0) {
                  hasCliCommands = true;
                }

                if (entry.chat_history && Array.isArray(entry.chat_history)) {
                  entry.chat_history.forEach((chat) => {
                    if (chat.query) allQueries.push(chat.query);
                    if (chat.answer) allAnswers.push(chat.answer);
                  });
                }
              }
            });

            const lastLog = logData.logs[logData.logs.length - 1];
            if (lastLog && lastLog.status === 'complete') {
              let nextPhase = lastLog.phaseIndex;
              let nextTask = lastLog.taskIndex + 1;

              if (nextTask >= plan[nextPhase].tasks.length) {
                nextPhase++;
                nextTask = 0;
              }
              if (nextPhase >= plan.length) {
                setState((prev) => ({
                  ...prev,
                  currentPhase: 0,
                  currentTask: 0,
                  queries: allQueries,
                  answers: allAnswers,
                  plan: plan,
                  hasShownTerminal: hasCliCommands,
                }));
              } else {
                if (plan[nextPhase].tasks[nextTask]) {
                  plan[nextPhase].tasks[nextTask].status = 'not-run';
                }

                setState((prev) => ({
                  ...prev,
                  currentPhase: nextPhase,
                  currentTask: nextTask,
                  queries: allQueries,
                  answers: allAnswers,
                  plan: plan,
                  hasShownTerminal: hasCliCommands,
                }));
              }
            } else if (lastLog && lastLog.status === 'in-progress') {
              setState((prev) => ({
                ...prev,
                currentPhase: lastLog.phaseIndex,
                currentTask: lastLog.taskIndex,
                queries: allQueries,
                answers: allAnswers,
                plan: plan,
                hasShownTerminal: hasCliCommands,
              }));
            } else if (lastLog) {
              // Handle other statuses like waiting_on_user_input
              setState((prev) => ({
                ...prev,
                currentPhase: lastLog.phaseIndex,
                currentTask: lastLog.taskIndex,
                queries: allQueries,
                answers: allAnswers,
                plan: plan,
                hasShownTerminal: hasCliCommands,
              }));
            }
          } else {
            plan.forEach((phase) => {
              phase.tasks.forEach((task) => {
                task.status = 'not-run';
              });
            });

            setState((prev) => ({
              ...prev,
              plan: plan,
              currentPhase: 0,
              currentTask: 0,
            }));
          }
        }
      };

      fetchPlan();
    }
  }, [setupState.authProfile.validated, existingAgentData, state.executionMode, title]);

  useEffect(() => {
    if (plan.length > 0 && !hasStarted) {
      const initialLogObject = toLogObject(existingAgentData?.log);
      const hasExistingLogs =
        existingAgentData?.log &&
        Array.isArray(initialLogObject.logs) &&
        initialLogObject.logs.length > 0;

      // For reconnecting sessions with existing logs, we don't need globalSettings to render
      // For new sessions, we wait for globalSettings before starting the workflow
      if (hasExistingLogs) {
        setHasStarted(true);
        // Don't call startWorkflow - we're resuming an existing session
      } else if (Object.keys(setupState.globalSettings).length > 0) {
        setHasStarted(true);
        startWorkflow();
      }
    }
  }, [plan, setupState.globalSettings, existingAgentData]);

  useEffect(() => {
    if (autoContinue) {
      checkAutoContinue();
    }
  }, [plan, currentPhase, currentTask, autoContinue]);

  // Track UI loading indicator state changes
  const prevLoadingRef = useRef(state.loading);
  useEffect(() => {
    const taskStatus = plan[currentPhase]?.tasks[currentTask]?.status;
    const actionName = state.currentAction || 'none';
    
    if (prevLoadingRef.current !== state.loading) {
      if (state.loading) {
        logAgentLoadingState(true, `UI indicators ON (status spinner + chat "...")`);
      } else {
        logAgentLoadingState(false, `UI indicators OFF (status=${taskStatus}, action=${actionName})`);
      }
      prevLoadingRef.current = state.loading;
    }
  }, [state.loading, plan, currentPhase, currentTask, state.currentAction]);

  const checkAutoContinue = () => {
    const taskStatus = plan[currentPhase]?.tasks[currentTask]?.status;
    // Log autoContinue check - note: this logs autoContinue flag, not state.loading
    if (autoContinue) {
      logAgentLoadingState(true, `autoContinue=true, checking task (phase=${currentPhase}, task=${currentTask}, status=${taskStatus})`);
    }
    if (
      autoContinue &&
      taskStatus === 'not-run'
    ) {
      logAgentLoadingState(true, `autoContinue: starting task ${currentPhase}.${currentTask}`);
      selectNextTask();
    }
  };

  const selectNextTask = () => {
    executeTask();
  };

  const formatAgentError = (error) => {
    if (!error) return 'Something went wrong while running the agent.';
    if (typeof error === 'string') {
      return error;
    }

    const details = error.details;

    if (typeof details === 'string' && details.trim().length > 0) {
      return details;
    }

    if (details && typeof details === 'object') {
      return details.message || details.error || error.message || 'Something went wrong while running the agent.';
    }

    if (error.message) {
      return error.message;
    }

    return 'Something went wrong while running the agent.';
  };

  const executeTask = async () => {
    if (settingsUpdatedRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      settingsUpdatedRef.current = false;
    }

    const task = state.plan[state.currentPhase]?.tasks?.[state.currentTask];
    if (!task) return;

    const streamKey = `${state.currentPhase}:${state.currentTask}:${task.id || task.task_id || task.title || 'task'}`;
    if (activeTaskStreamRef.current.has(streamKey)) {
      console.warn('[Agent] Ignoring duplicate task stream start:', streamKey);
      return;
    }
    activeTaskStreamRef.current.add(streamKey);

    const answerIndex = state.queries.length;
    const query = `Execute Task Plan for: ${task.title}`;

    setState((currentState) => {
      // let relevantOutput = '';

      // // Use globalSettings from hook instead of currentState
      // if (Object.keys(setupState.globalSettings).length > 0) {
      //   relevantOutput += `## User Preferences (When requesting information from the user, consider these settings first before executing the task)\n`;
      //   Object.keys(setupState.globalSettings).forEach((key) => {
      //     if (key === 'default_values') return; // handle below in its own section

      //     const value = setupState.globalSettings[key];
      //     // Skip empty values: undefined/null, empty string, empty array, empty object
      //     if (
      //       value === undefined ||
      //       value === null ||
      //       (typeof value === 'string' && value.trim() === '') ||
      //       (Array.isArray(value) && value.length === 0) ||
      //       (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)
      //     ) {
      //       return;
      //     }
      //     if (key === 'select_aws_regions') {
      //       const regions = Array.isArray(value) ? value.join(', ') : value;
      //       relevantOutput += `### AWS Regions: ${regions}\n`;
      //       return;
      //     }

      //     if (key === 'proceed_with_default_values_without_prompt') {
      //       const val = String(value).toLowerCase();
      //       if (val === 'yes') {
      //         relevantOutput += `### Use the values under "Blueprint Default Values" section without confirmation from the user\n`;
      //       } else {
      //         relevantOutput += `### Require user confirmation before using values under "Blueprint Default Values" section\n`;
      //       }
      //       return;
      //     }

      //     if (key === 'proceed_with_changes_without_confirmation') {
      //       const val = String(value).toLowerCase();
      //       if (val === 'yes') {
      //         relevantOutput += `### Do not request confirmation from the user before making changes\n`;
      //       } else {
      //         relevantOutput += `### Request confirmation from the user before making changes\n`;
      //       }
      //       return;
      //     }

      //     // Default rendering for any other keys
      //     relevantOutput += `### ${key}: ${
      //       typeof value === 'object' ? JSON.stringify(value, null, 2) : value
      //     }\n`;
      //   });

      //   const dv = setupState.globalSettings?.default_values;
      //   if (dv && Object.keys(dv).length > 0) {
      //     relevantOutput += `\n## Blueprint Default Values\n`;
      //     Object.keys(dv).forEach((k) => {
      //       const v = dv[k];
      //       relevantOutput += `### ${k}: ${
      //         typeof v === 'object' ? JSON.stringify(v, null, 2) : v
      //       }\n`;
      //     });
      //   }
      // }

      // currentState.plan.forEach((phase) => {
      //   phase.tasks.forEach((t) => {
      //     if (task.depends_on?.includes(t.id)) {
      //       relevantOutput += `## Output from task ${t.id} - ${t.title}\n### Summary: \n${t.task_output}\n`;
      //       if (get(t, 'cli_command_output', []).length > 0)
      //         relevantOutput += `### Terminal Output:\n ${t.cli_command_output.map((c) => `${c.command}\n\`\`\`\n${c.output}\n\`\`\``).join('\n')}\n`;
      //       relevantOutput += '\n\n';
      //     }
      //   });
      // });

      const newPlan = [...currentState.plan];
      newPlan[currentState.currentPhase].tasks[
        currentState.currentTask
      ].status = 'in-progress';
      // newPlan[currentState.currentPhase].tasks[
      //   currentState.currentTask
      // ].relevantOutput = relevantOutput;

      return {
        ...currentState,
        plan: newPlan,
        queries: [
          ...currentState.queries,
          query,
        ],
        codexLiveMessages: isCodexExecution ? [] : currentState.codexLiveMessages,
        followupPrompt: '',
        actions: [],
      };
    });

    streamData({
      answerIndex,
      query,
      task: {
        id: task.id,
        status: 'in-progress',
      },
      streamKey,
    });
  };

  const streamData = async ({
    query,
    task,
    answerIndex,
    initial,
    sessionIdOverride,
    preflightAnswer,
    streamKey,
  }) => {
    const shouldSendInlinePlan =
      isBluePrint ||
      (isLocalRuntime() && Array.isArray(state.planDetails) && state.planDetails.length > 0);
    const planPayload = shouldSendInlinePlan
      ? state.planDetails
        ? {
            plan: {
              title: state.title,
              credits: normalizeExecutionCredits(state.credits, 1),
              plan: state.planDetails,
            },
          }
        : null
      : state.planId
        ? { planId: state.planId }
        : null;

    if (!planPayload) {
      if (streamKey) activeTaskStreamRef.current.delete(streamKey);
      const validationMessage = isBluePrint
        ? 'Blueprint plan details are still loading. Please wait and try again.'
        : 'Plan ID is required before running the agent. Please refresh and try again.';
      setInitialLoading(false);
      setState((prev) => ({
        ...prev,
        loading: false,
        responseError: 'PLAN_ID_OR_PLAN_REQUIRED',
        responseErrorMessage: validationMessage,
      }));
      return;
    }

    setInitialLoading(initial ? true : false);

    const existingSessionId = state.sessionId || readStoredSessionId();
    const effectiveSessionId =
      sessionIdOverride || existingSessionId || generateRandomString(16);

    persistSessionId(effectiveSessionId);

    if (state.sessionId !== effectiveSessionId) {
      setState((prev) => ({
        ...prev,
        sessionId: effectiveSessionId,
      }));
    }

    setState((prev) => ({
      ...prev,
      loading: true,
      answers: (() => {
        const updatedAnswers = [...prev.answers];
        updatedAnswers[answerIndex] = '';
        return updatedAnswers;
      })(),
      responseError: null,
      responseErrorMessage: '',
      preflight: initial
        ? {
            phase: '',
            message: '',
            recommendation: null,
            question: null,
            decision: null,
            validation: null,
            steps: [],
          }
        : prev.preflight,
    }));

    // Build settings payload from globalSettings (from useAgentSetup hook)
    const globalSettings = setupState.globalSettings || {};
    const configurationModeValue =
      globalSettings.configuration_mode === 'aws-cli'
        ? 'cli'
        : globalSettings.configuration_mode === 'cloudformation'
        ? 'cloudformation'
        : globalSettings.configuration_mode === 'terraform'
        ? 'terraform'
        : undefined;

    // Extract existing stack from selected workload/stack
    let stackAction;
    let existingStack = null;
    let existingStacks = [];
    const selectedWorkloadOrStack =
      globalSettings.selected_workload_or_stack &&
      globalSettings.selected_workload_or_stack !== AUTO_WORKLOAD_VALUE
        ? globalSettings.selected_workload_or_stack
        : null;
    if (selectedWorkloadOrStack) {
      if (selectedWorkloadOrStack.startsWith('stack-')) {
        const stackId = selectedWorkloadOrStack.replace('stack-', '');
        existingStack = stackId;
        existingStacks = [stackId];
        stackAction = 'update';
      }
    }

    // Build execution preferences - only include true values
    const executionPreferencesRaw = {
      useDefaultValuesWithoutConfirmation:
        globalSettings.proceed_with_default_values_without_prompt === 'Yes',
      applyChangesWithoutConfirmation:
        globalSettings.proceed_with_changes_without_confirmation === 'Yes',
    };
    const executionPreferences = Object.fromEntries(
      Object.entries(executionPreferencesRaw).filter(([, value]) => value === true)
    );

    // Filter defaultValues to remove empty/null/undefined values
    const rawDefaultValues = globalSettings.default_values || {};
    const filteredDefaultValues = Object.fromEntries(
      Object.entries(rawDefaultValues).filter(([, value]) => 
        value !== null && value !== undefined && value !== ''
      )
    );

    // Debug: Log what we're sending to the backend
    logAgentLoadingState(true, `streamData payload: defaultValues=${JSON.stringify(filteredDefaultValues)}, execPrefs=${JSON.stringify(executionPreferences)}, regions=${JSON.stringify(globalSettings.select_aws_regions)}`);

    // Call API with handlers
    try {
      const permissionProfileId =
        globalSettings.permissionProfileId ||
        authProfile?.permissionProfileId ||
        authProfile?.recordId ||
        authProfile?.id ||
        null;
      const creditResourceId =
        state.blueprintId || state.planId || blueprintRecordId || 'inline';
      const creditRunId = recordId || effectiveSessionId;
      const creditIdempotencyKey = `agent:start:${creditRunId}:${creditResourceId}`;

      if (!isLocalRuntime()) {
        try {
          await dispatch(
            updateUserCredits({
              credits: normalizeExecutionCredits(state.credits, 1),
              idempotencyKey: creditIdempotencyKey,
              source: 'agent',
              resourceType: String(creditResourceId).startsWith('report_')
                ? 'report'
                : 'blueprint',
              resourceId: creditResourceId,
              runId: creditRunId,
              metadata: {
                route: 'Agent.streamData',
                recordId: recordId || null,
                sessionId: effectiveSessionId,
                planId: state.planId || null,
                blueprintId: state.blueprintId || null,
                title: state.title || null,
              },
            })
          ).unwrap();
        } catch (creditError) {
          if (streamKey) activeTaskStreamRef.current.delete(streamKey);
          setInitialLoading(false);
          const errorMessage =
            creditError ||
            'Insufficient credits to start this blueprint run.';
          setState((prev) =>
            buildAgentErrorState(prev, {
              code: 'CREDIT_CONSUME_FAILED',
              message: errorMessage,
            })
          );
          return;
        }
      }

      await streamAgentCall(
        {
          query,
          task,
          sessionId: effectiveSessionId,
          recordId,
          authProfile,
          accountId,
          answerIndex,
          blueprintId: state.blueprintId || state.planId || blueprintRecordId || undefined,
          executionMode: normalizeBlueprintExecutionMode(state.executionMode),
          runner: normalizeBlueprintExecutionMode(state.executionMode),
          ...planPayload,
          configurationMode: configurationModeValue,
          stackAction,
          executionPreferences: Object.keys(executionPreferences).length > 0 ? executionPreferences : undefined,
          defaultValues: Object.keys(filteredDefaultValues).length > 0 ? filteredDefaultValues : undefined,
          regions: globalSettings.select_aws_regions || [],
          additionalInstructions: globalSettings.additional_instructions || undefined,
          existingStack: existingStack || undefined,
          existingStacks: existingStacks.length ? existingStacks : undefined,
          permissionProfileId: permissionProfileId || undefined,
          selectedWorkloadOrStack: selectedWorkloadOrStack || undefined,
          recommendationContext: recommendationExecutionContext || undefined,
          preflightAnswer: preflightAnswer || undefined,
        },
        {
          onChunk: (chunk, answerIndex) => {
            handleChunk(chunk, answerIndex);
          },
          onLoadingChange: (loading) => {
            logAgentLoadingState(loading, 'streamAgentCall');
            setState((prev) => ({ ...prev, loading }));
          },
          onError: (error) => {
            if (streamKey) activeTaskStreamRef.current.delete(streamKey);
            setInitialLoading(false);
            const errorCode = error?.errorCode || error?.code || 'API_ERROR';
            const errorMessage = formatAgentError(error);
            setState((prev) =>
              buildAgentErrorState(prev, {
                code: errorCode,
                message: errorMessage,
              })
            );
          },
          onStarted: () => {
            dispatch(refreshUserCredits())
              .unwrap()
              .catch((error) => {
                console.warn('[Agent] Failed to refresh credits after run start:', error);
              });
          },
          onComplete: () => {
            if (streamKey) activeTaskStreamRef.current.delete(streamKey);
            setState((prev) => ({ ...prev, loading: false }));
          },
        }
      );
    } catch (error) {
      if (streamKey) activeTaskStreamRef.current.delete(streamKey);
      setInitialLoading(false);
      const errorCode = error?.errorCode || error?.code || 'API_ERROR';
      const errorMessage = formatAgentError(error);
      setState((prev) =>
        buildAgentErrorState(prev, {
          code: errorCode,
          message: errorMessage,
        })
      );
      console.error('[Agent] Stream error:', error);
    }
  };

  const handleChunk = (chunk, answerIndex) => {
    // Concise logging of all chunks from backend
    logAgentChunk(chunk, { answerIndex });

    setState((prev) => {
      if (chunk.type === 'error') {
        return buildAgentErrorState(prev, {
          code: chunk.error_code || 'API_ERROR',
          message:
            chunk.message ||
            chunk.error_message ||
            'The agent reported an error while processing your request.',
        });
      }

      const newState = { ...prev };
      const previousSteps = prev.preflight?.steps || [];
      switch (chunk.type) {
        case 'prep_started':
        case 'prep_phase_started':
        case 'prep_phase_completed':
        case 'prep_progress':
          newState.preflight = {
            ...prev.preflight,
            phase: chunk.phase || prev.preflight?.phase || '',
            message: chunk.message || prev.preflight?.message || '',
            validation: chunk.validation || prev.preflight?.validation || null,
            steps: upsertPreflightPhaseStep(previousSteps, {
              phase: chunk.phase || prev.preflight?.phase || 'preparation',
              status:
                chunk.type === 'prep_phase_completed' || chunk.type === 'prep_ready'
                  ? 'complete'
                  : chunk.type === 'prep_progress'
                  ? 'info'
                  : 'running',
              detail: chunk.message || '',
            }),
          };
          break;

        case 'prep_recommendation':
          newState.preflight = {
            ...prev.preflight,
            phase: chunk.phase || prev.preflight?.phase || '',
            message:
              prev.preflight?.message ||
              'Preparation checks completed. Reviewing target recommendations.',
            recommendation: chunk.recommendation || null,
            steps: appendPreflightStep(previousSteps, {
              kind: 'event',
              status: 'info',
              title: 'Recommendation',
              detail: summarizePreflightRecommendation(chunk.recommendation),
            }),
          };
          break;

        case 'prep_scope_warning':
          newState.preflight = {
            ...prev.preflight,
            phase: chunk.phase || prev.preflight?.phase || '',
            message:
              chunk.scope?.reason ||
              'The selected workload may only partially match this blueprint.',
            steps: appendPreflightStep(previousSteps, {
              kind: 'event',
              status: 'warning',
              title: 'Scope warning',
              detail:
                chunk.scope?.reason ||
                'The selected workload may only partially match this blueprint.',
            }),
          };
          break;

        case 'prep_question':
          const questionSelections = Object.entries(
            chunk.question?.overrides || {}
          ).reduce((acc, [key, config]) => {
            if (Array.isArray(config?.value)) {
              acc[key] = config.value;
            } else if (config?.value) {
              acc[key] = config.value;
            }
            return acc;
          }, {});
          newState.preflight = {
            ...prev.preflight,
            phase: chunk.phase || prev.preflight?.phase || '',
            message:
              chunk.message ||
              'We need one decision before we can continue preparing this blueprint.',
            question: chunk.question || null,
            selections: questionSelections,
            steps: appendPreflightStep(previousSteps, {
              kind: 'event',
              status: 'question',
              title: 'Input needed',
              detail:
                chunk.question?.title ||
                chunk.message ||
                'We need one decision before we can continue preparing this blueprint.',
            }),
          };
          break;

        case 'prep_decision':
          newState.preflight = {
            ...prev.preflight,
            decision: chunk.decision || null,
            question: null,
            selections: {},
            steps: appendPreflightStep(previousSteps, {
              kind: 'event',
              status: 'complete',
              title: 'Decision applied',
              detail: summarizePreflightDecision(chunk.decision),
            }),
          };
          break;

        case 'prep_ready':
          newState.preflight = {
            ...prev.preflight,
            phase: chunk.phase || prev.preflight?.phase || '',
            validation: chunk.validation || prev.preflight?.validation || null,
            question: null,
            steps: upsertPreflightPhaseStep(previousSteps, {
              phase: chunk.phase || prev.preflight?.phase || 'preparation',
              status: 'complete',
              detail: 'Preparation complete. Blueprint is ready.',
            }),
          };
          break;

        case 'message_start':
          break;
          
        case 'blueprint_updated': {
          const blueprintPayload =
            chunk.blueprint ||
            (typeof chunk.content === 'object' && chunk.content?.blueprint) ||
            (typeof chunk.content === 'object' && chunk.content?.plan ? chunk.content : null);

          const updatedPlan = extractBlueprintPlan(blueprintPayload);

          console.log('[Agent][blueprint_updated]', blueprintPayload);
          
          // Log what we received
          const totalTasks = updatedPlan?.reduce((sum, phase) => sum + (phase.tasks?.length || 0), 0) || 0;
          logBlueprintUpdate('received', {
            title: blueprintPayload?.title,
            phases: updatedPlan?.length || 0,
            tasks: totalTasks,
          });
          
          if (!Array.isArray(updatedPlan)) {
            logBlueprintUpdate('skipped', { reason: 'plan is not an array' });
            break;
          }

          // Initialize task status to 'not-run' if not already set
          // Backend blueprint doesn't include status field, frontend expects 'not-run'
          const normalizedPlan = mergeRuntimeTaskState(
            normalizeBlueprintPlanStatuses(updatedPlan),
            prev.plan
          );

          newState.planDetails = normalizedPlan;
          newState.plan = normalizedPlan;
          newState.title = blueprintPayload.title || newState.title;
          
          // Log confirmation of state update
          logBlueprintUpdate('applied', {
            title: newState.title,
            phases: normalizedPlan.length,
            tasks: totalTasks,
          });
          break;
        }

        case 'action_start':
          newState.actions = [...chunk.actions, ...prev.actions];
          newState.currentAction = chunk.actions[0]?.name || '';
          if (
            Array.isArray(chunk.actions) &&
            chunk.actions.some((action) => String(action?.name || '').toLowerCase() === 'cli_session_command_execute')
          ) {
            setActivityTab('terminal');
          } else if (
            Array.isArray(chunk.actions) &&
            chunk.actions.some((action) => GITHUB_TOOL_NAMES.has(String(action?.name || '').toLowerCase()))
          ) {
            setActivityTab('github');
          } else if (
            Array.isArray(chunk.actions) &&
            chunk.actions.some((action) => String(action?.name || '').toLowerCase() === 'aws_cfn_operations')
          ) {
            setActivityTab('cloudformation');
          }
          break;

        case 'action_end':
          newState.actions = prev.actions.map((action) =>
            action.id === chunk.actionId
              ? { ...action, completed: true }
              : action
          );
          break;

        case 'cloudformation_operation': {
          const normalizedOperation = normalizeCloudFormationOperation({
            output: chunk,
            input: null,
          });
          const newPlan = [...prev.plan];
          const task = newPlan[prev.currentPhase]?.tasks[prev.currentTask];

          if (normalizedOperation && task) {
            task.cloudformation_operations = dedupeCloudFormationOperations([
              ...(Array.isArray(task.cloudformation_operations) ? task.cloudformation_operations : []),
              normalizedOperation,
            ]);
            newState.plan = newPlan;
            setActivityTab('cloudformation');
          }
          break;
        }

        case 'github_operation': {
          const normalizedOperation = normalizeGithubOperation({
            output: chunk,
            input: null,
          });
          const newPlan = [...prev.plan];
          const task = newPlan[prev.currentPhase]?.tasks[prev.currentTask];

          if (normalizedOperation && task) {
            task.github_operations = dedupeGithubOperations([
              ...(Array.isArray(task.github_operations) ? task.github_operations : []),
              normalizedOperation,
            ]);
            newState.plan = newPlan;
            setActivityTab('github');
          }
          break;
        }

        case 'message_in_progress': {
          const updatedAnswers = [...prev.answers];
          if (!updatedAnswers[answerIndex]) {
            updatedAnswers[answerIndex] = '';
          }
          updatedAnswers[answerIndex] += chunk.content;
          newState.answers = updatedAnswers;
          break;
        }

        case 'task_status_update': {
          let taskStatus;
          try {
            taskStatus = typeof chunk.content === 'string' 
              ? JSON.parse(chunk.content) 
              : chunk.content;
          } catch (e) {
            // If parsing fails, try to use chunk directly if it has task_id
            if (chunk.task_id) {
              taskStatus = chunk;
            } else {
              // Fall through to message_in_progress handling
              const updatedAnswers = [...prev.answers];
              if (!updatedAnswers[answerIndex]) {
                updatedAnswers[answerIndex] = '';
              }
              updatedAnswers[answerIndex] += typeof chunk.content === 'string' 
                ? chunk.content 
                : JSON.stringify(chunk.content);
              newState.answers = updatedAnswers;
              return newState;
            }
          }
          const newPlan = [...prev.plan];
          const task = newPlan[prev.currentPhase]?.tasks[prev.currentTask];
          const runSummaryFromChunk = getRunSummaryFromLog({
            runSummary: taskStatus?.run_summary,
          });
          if (runSummaryFromChunk) {
            newState.finalRunSummary = runSummaryFromChunk;
          }
          if (taskStatus.task_id === 'codex_blueprint_run') {
            const normalizedStatus =
              taskStatus.status === 'in-progress' ? 'in-progress' : taskStatus.status;
            const firstTask = newPlan[0]?.tasks?.[0];
            if (firstTask) {
              firstTask.status = normalizedStatus;
              firstTask.task_output = taskStatus.task_output_summary_message;
            }
            newState.plan = newPlan;
            newState.currentPhase = 0;
            newState.currentTask = 0;
            newState.autoContinue = false;
            newState.currentAction =
              taskStatus.status === 'in-progress' ? 'codex exec' : '';
            setInitialLoading(false);
            if (taskStatus.status && taskStatus.status !== 'in-progress') {
              newState.loading = false;
              newState.existingAgentData = {
                ...prev.existingAgentData,
                status: taskStatus.status,
              };
            }
            break;
          }
          if (task?.id === taskStatus.task_id) {
            task.status = taskStatus.status;
            task.task_output = taskStatus.task_output_summary_message;
            newState.plan = newPlan;

            if (taskStatus.status === 'complete') {
              let existingLogs = [];
              let existingAuthProfileName = '';
              let existingGlobalSettings = {};
              let existingIsBluePrint = false;
              let existingBlueprintId = null;
              let existingRunSummary = null;

              try {
                const agentData = prev.existingAgentData;

                if (agentData?.log) {
                  const parsedLog = toLogObject(agentData.log);
                  existingLogs = parsedLog.logs || [];
                  existingAuthProfileName = parsedLog.authProfileName || '';
                  existingGlobalSettings = parsedLog.globalSettings || {};
                  existingIsBluePrint = parsedLog.isBluePrint || false;
                  existingBlueprintId = parsedLog.blueprintId || null;
                  existingRunSummary = parsedLog.runSummary || null;
                }
              } catch (error) {
                console.error('Error parsing existing logs:', error);
              }
              const filteredLogs = existingLogs.filter(
                (log) => log.taskId !== task.id
              );

              const taskChats = [];
              prev.queries.forEach((query) => {
                if (
                  query?.startsWith('Execute Task Plan for:') &&
                  query.includes(task.title)
                ) {
                  taskChats.push({
                    query,
                    answer: taskStatus.task_output_summary_message,
                    isAction: true,
                  });
                }
              });

              const newLogEntry = {
                taskId: task.id,
                phaseIndex: prev.currentPhase,
                taskIndex: prev.currentTask,
                status: taskStatus.status,
                output: taskStatus.task_output_summary_message,
                task_output: task.task_output,
                cli_command_output: task.cli_command_output || [],
                cloudformation_operations: task.cloudformation_operations || [],
                github_operations: task.github_operations || [],
                ...(taskChats.length > 0 && { chat_history: taskChats }),
                timestamp: new Date().toISOString(),
              };

              const updatedLogs = {
                logs: [...filteredLogs, newLogEntry],
                currentPhase: prev.currentPhase,
                currentTask: prev.currentTask,
                lastUpdated: new Date().toISOString(),
                authProfileName: existingAuthProfileName,
                globalSettings: {
                  ...setupState.globalSettings,
                  ...existingGlobalSettings,
                },
                isBluePrint: existingIsBluePrint,
                blueprintId: existingBlueprintId,
                runSummary: taskStatus?.run_summary || existingRunSummary || undefined,
              };

              const isLastTask =
                prev.currentPhase === newPlan.length - 1 &&
                prev.currentTask ===
                  newPlan[prev.currentPhase].tasks.length - 1;

              // dispatch(
              //   updateAgentConnection({
              //     recordId: recordId,
              //     status:
              //       isLastTask && taskStatus.status === 'complete'
              //         ? 'complete'
              //         : 'running',
              //     log: JSON.stringify(updatedLogs),
              //     authProfile: JSON.stringify({
              //       ...setupState.authProfile,
              //       validated: true,
              //       authType: setupState.authProfile.authType,
              //     }),
              //   })
              // );

              newState.existingAgentData = {
                ...prev.existingAgentData,
                log: JSON.stringify(updatedLogs),
                status:
                  isLastTask && taskStatus.status === 'complete'
                    ? 'complete'
                    : 'running',
              };
            }

            if (autoplay && taskStatus.status === 'complete') {
              newState.autoContinue = true;

              if (
                prev.currentPhase === newPlan.length - 1 &&
                prev.currentTask === newPlan[prev.currentPhase].tasks.length - 1
              ) {
                // We're at the last task, don't update phase/task
              } else if (
                prev.currentTask ===
                newPlan[prev.currentPhase].tasks.length - 1
              ) {
                newState.currentPhase = prev.currentPhase + 1;
                newState.currentTask = 0;
                newState.currentAction = '';
              } else {
                newState.currentTask = prev.currentTask + 1;
                newState.currentAction = '';
              }
            } else {
              newState.autoContinue = false;
            }
          } else if (taskStatus.task_id === 'agent_start') {
            // Set phase/task in same state update as autoContinue to avoid race condition
            newState.currentPhase = 0;
            newState.currentTask = 0;
            newState.currentAction = '';
            setInitialLoading(false);
            newState.autoContinue = true;
            let existingAuthProfileName = '';
            let existingLogs = [];
            let existingGlobalSettings = {};
            let existingIsBluePrint = false;
            let existingBlueprintId = null;

            try {
              const agentData = existingAgentData;
              if (agentData?.log) {
                const parsedLog = toLogObject(agentData.log);
                existingLogs = parsedLog.logs || [];
                existingAuthProfileName = parsedLog.authProfileName || '';
                existingGlobalSettings = parsedLog.globalSettings || {};
                existingIsBluePrint = parsedLog.isBluePrint || false;
                existingBlueprintId = parsedLog.blueprintId || null;
              }
            } catch (error) {
              console.error('Error parsing log:', error);
            }
            const updatedLogs = existingLogs.map((log) => ({
              ...log,
            }));

            const updatedLogsObject = {
              logs: updatedLogs,
              currentPhase: 0,
              currentTask: 0,
              lastUpdated: new Date().toISOString(),
              globalSettings: {
                ...setupState.globalSettings,
                ...existingGlobalSettings,
              },
              authProfileName:
                setupState.authProfile.authProfileName ||
                existingAuthProfileName,
              isBluePrint: existingIsBluePrint,
              blueprintId: existingBlueprintId,
            };

            // dispatch(
            //   updateAgentConnection({
            //     recordId: recordId,
            //     status: 'running',
            //     log: JSON.stringify(updatedLogsObject),
            //     authProfile: JSON.stringify({
            //       ...setupState.authProfile,
            //       validated: true,
            //       authType: setupState.authProfile.authType,
            //     }),
            //   })
            // );
          }
          break;
        }

        case 'cli_command_output': {
          // Helper function to normalize output format
          const normalizeCliOutput = (output) => {
            // If it's already a string, return it
            if (typeof output === 'string') {
              return output;
            }

            // If it's an object with {statusCode, output} structure
            if (typeof output === 'object' && output !== null) {
              // Check if it has the expected structure {statusCode, output}
              if ('output' in output && 'statusCode' in output) {
                // Extract the actual output string
                const actualOutput = typeof output.output === 'string' 
                  ? output.output 
                  : JSON.stringify(output.output, null, 2);
                // Optionally prepend status code if non-zero
                if (output.statusCode !== undefined && output.statusCode !== 0) {
                  return `[Exit code: ${output.statusCode}]\n${actualOutput}`;
                }
                return actualOutput;
              }
              
              // If it has stdout/stderr structure
              if ('stdout' in output || 'stderr' in output) {
                let result = '';
                if (output.stdout) result += output.stdout;
                if (output.stderr) result += (result ? '\n' : '') + output.stderr;
                if (output.exitCode !== undefined && output.exitCode !== 0) {
                  result += (result ? '\n' : '') + `[Exit code: ${output.exitCode}]`;
                }
                return result || '[No output]';
              }

              // Fallback: stringify the object
              console.warn('[Agent] Unexpected CLI output object format, stringifying:', output);
              return JSON.stringify(output, null, 2);
            }

            // Fallback for other types
            return String(output || '[No output]');
          };

          const newPlan = [...prev.plan];
          const task = newPlan[prev.currentPhase]?.tasks[prev.currentTask];

          if (task) {
            if (!task.cli_command_output) task.cli_command_output = [];
            
            // Normalize the output before storing
            const normalizedOutput = normalizeCliOutput(chunk.cli_command_output);
            
            const commandEntry = {
              command: chunk.cli_command,
              output: normalizedOutput,
            };
            task.cli_command_output.push(commandEntry);
            newState.plan = newPlan;
            newState.hasShownTerminal = true; // Mark that terminal has been shown
            setActivityTab('terminal');
          } else {
            console.warn('[Agent] No task found for cli_command_output:', {
              currentPhase: prev.currentPhase,
              currentTask: prev.currentTask,
              planLength: newPlan.length,
              phaseExists: !!newPlan[prev.currentPhase],
              tasksLength: newPlan[prev.currentPhase]?.tasks?.length,
            });
          }
          break;
        }

        case 'codex_event':
        case 'codex_stdout':
        case 'codex_stderr': {
          const newPlan = [...prev.plan];
          const task = newPlan[prev.currentPhase]?.tasks[prev.currentTask];
          if (!task) break;

          const codexUpdate = classifyCodexStreamChunk(chunk);
          if (!codexUpdate?.text?.trim()) break;

          if (codexUpdate.target === 'chat') {
            newState.codexLiveMessages = [
              ...(Array.isArray(prev.codexLiveMessages) ? prev.codexLiveMessages : []),
              {
                id: `codex-live-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                answerIndex,
                timestamp: new Date().toISOString(),
                content: codexUpdate.text.trim(),
              },
            ];
            break;
          }

          if (codexUpdate.target === 'session') {
            task.codex_session_info = [
              ...(Array.isArray(task.codex_session_info) ? task.codex_session_info : []),
              {
                timestamp: new Date().toISOString(),
                message: codexUpdate.text.trim(),
              },
            ];
            newState.plan = newPlan;
            break;
          }

          if (codexUpdate.target === 'terminal') {
            if (!task.cli_command_output) task.cli_command_output = [];

            const commandLabel = codexUpdate.command || 'codex exec';
            const commandSource = codexUpdate.source || 'codex';
            const lastEntry = task.cli_command_output[task.cli_command_output.length - 1];
            if (lastEntry?.command === commandLabel && lastEntry?.source === commandSource) {
              lastEntry.output = `${lastEntry.output || ''}${codexUpdate.text}`;
            } else {
              task.cli_command_output.push({
                command: commandLabel,
                output: codexUpdate.text,
                source: commandSource,
              });
            }
            newState.plan = newPlan;
            newState.hasShownTerminal = true;
            setActivityTab('terminal');
          }
          break;
        }

      }
      return newState;
    });
  };

  const startWorkflow = () => {
    const existingSessionId = sessionId || readStoredSessionId();
    const nextSessionId = existingSessionId || generateRandomString(16);
    persistSessionId(nextSessionId);
    streamData({
      answerIndex: 0,
      query: `Your current job is to guide the user with the executing the plan for '${title}' in their environmnet. This will include reviewing their existing AWS account, gathering input from the user and finally once all information is gathered, applying the configuration in their environment. If you are ready, reply with task_id "agent_start", status "complete"`,
      task: null,
      initial: true,
      sessionIdOverride: nextSessionId,
    });

    analytics.track(ANALYTICS_EVENTS.AGENT_RUN, {
      route: getAnalyticsRoute(),
    });

    setState((prev) => ({
      ...prev,
      currentPhase: 0,
      currentTask: 0,
      sessionId: nextSessionId,
    }));
  };

  const handlePreflightAnswer = (questionId, selectedOptionId, overrides = null) => {
    const currentSessionId = state.sessionId || readStoredSessionId();
    if (!currentSessionId || !questionId || !selectedOptionId) {
      return;
    }
    if (questionId === 'analysis_review') {
      reviewAutoContinueSentRef.current = true;
      setReviewCountdown(null);
      setReviewCountdownPaused(true);
    }

    setInitialLoading(true);
    setState((prev) => ({
      ...prev,
      preflight: {
        ...prev.preflight,
        message: 'Applying your selection and continuing preparation.',
        decision: { questionId, selectedOptionId, overrides },
      },
    }));

    streamData({
      answerIndex: 0,
      query: `Preflight answer: ${questionId}=${selectedOptionId}`,
      task: null,
      initial: true,
      sessionIdOverride: currentSessionId,
      preflightAnswer: {
        questionId,
        selectedOptionId,
        ...(overrides ? { overrides } : {}),
      },
    });
  };

  const handlePreflightSelectionChange = (selectionId, value) => {
    if (!selectionId) return;
    setReviewCountdownPaused(true);
    setReviewCountdown(null);
    setState((prev) => ({
      ...prev,
      preflight: {
        ...prev.preflight,
        selections: {
          ...(prev.preflight?.selections || {}),
          [selectionId]: value,
        },
      },
    }));
  };

  const handlePreflightMultiSelectionToggle = (selectionId, optionId, checked) => {
    if (!selectionId || !optionId) return;
    setReviewCountdownPaused(true);
    setReviewCountdown(null);
    setState((prev) => {
      const currentValues = Array.isArray(prev.preflight?.selections?.[selectionId])
        ? prev.preflight.selections[selectionId]
        : [];
      const nextValues = checked
        ? Array.from(new Set([...currentValues, optionId]))
        : currentValues.filter((value) => value !== optionId);
      return {
        ...prev,
        preflight: {
          ...prev.preflight,
          selections: {
            ...(prev.preflight?.selections || {}),
            [selectionId]: nextValues,
          },
        },
      };
    });
  };

  const handlePauseReviewCountdown = () => {
    setReviewCountdownPaused(true);
    setReviewCountdown(null);
  };

  const handleViewChange = (view) => {
    setActiveView(view);
  };

  const getCurrentTaskWithRelevantOutput = useCallback(
    ({ cloudFormationOperation = null, githubOperation = null } = {}) => {
      const activeTask = state.plan?.[state.currentPhase]?.tasks?.[state.currentTask];
      if (!activeTask) return null;

      const relevantCloudFormationOperation =
        cloudFormationOperation ||
        getLatestCloudFormationOperation(activeTask.cloudformation_operations || []);
      const relevantGithubOperation =
        githubOperation ||
        getLatestGithubOperation(activeTask.github_operations || []);
      const relevantOutput = [
        buildCloudFormationRelevantOutput(relevantCloudFormationOperation),
        buildGithubRelevantOutput(relevantGithubOperation),
      ]
        .filter(Boolean)
        .join('\n\n');

      if (!relevantOutput) {
        return activeTask;
      }

      return {
        ...activeTask,
        relevantOutput,
      };
    },
    [state.currentPhase, state.currentTask, state.plan]
  );

  const sendAgentFollowupMessage = useCallback(
    (
      query,
      {
        cloudFormationOperation = null,
        githubOperation = null,
        clearPrompt = false,
      } = {}
    ) => {
      const trimmedQuery = String(query || '').trim();
      if (!trimmedQuery) return;

      const answerIndex = state.queries.length;
      const taskContext = getCurrentTaskWithRelevantOutput({
        cloudFormationOperation,
        githubOperation,
      });
      const effectiveRecordId =
        recordId ||
        existingAgentData?.recordId ||
        existingAgentData?.id ||
        state.existingAgentData?.recordId ||
        '';
      const shouldResumeCodex =
        isLocalRuntime() &&
        isCodexExecution &&
        Boolean(effectiveRecordId);

      if (shouldResumeCodex) {
        setState((prev) => ({
          ...prev,
          loading: true,
          queries: [...prev.queries, trimmedQuery],
          ...(clearPrompt
            ? {
                followupPrompt: '',
                actions: [],
                characterCount: 0,
              }
            : {}),
        }));

        streamCodexAgentRunResume(
          {
            recordId: effectiveRecordId,
            prompt: trimmedQuery,
            answerIndex,
          },
          {
            onChunk: (chunk, chunkAnswerIndex) => {
              handleChunk(chunk, chunkAnswerIndex);
            },
            onLoadingChange: (loading) => {
              logAgentLoadingState(loading, 'streamCodexAgentRunResume');
              setState((prev) => ({ ...prev, loading }));
            },
            onError: (error) => {
              setInitialLoading(false);
              const errorCode = error?.errorCode || error?.code || 'CODEX_RESUME_FAILED';
              const errorMessage = formatAgentError(error);
              setState((prev) =>
                buildAgentErrorState(prev, {
                  code: errorCode,
                  message: errorMessage,
                })
              );
            },
            onComplete: () => {
              setState((prev) => ({ ...prev, loading: false }));
            },
          }
        ).catch((error) => {
          console.error('[Agent] Codex resume stream error:', error);
        });
        return;
      }

      streamData({
        answerIndex,
        query: trimmedQuery,
        task: taskContext,
      });

      setState((prev) => ({
        ...prev,
        queries: [...prev.queries, trimmedQuery],
        ...(clearPrompt
          ? {
              followupPrompt: '',
              actions: [],
              characterCount: 0,
            }
          : {}),
      }));
    },
    [
      existingAgentData,
      getCurrentTaskWithRelevantOutput,
      isCodexExecution,
      isCodexWaitingForInput,
      recordId,
      state.currentPhase,
      state.currentTask,
      state.existingAgentData,
      state.plan,
      state.queries.length,
    ]
  );

  const handleRefreshCloudFormationStatus = useCallback(
    async (operation, options = {}) => {
      const { silent = false, source = 'manual' } = options;
      if (!operation?.stackId && !operation?.stackName) {
        if (!silent) {
          toast.error('No CloudFormation stack was found for this card.');
        }
        return;
      }

      const requestedOperationKey = getCloudFormationOperationKey(operation);
      if (cloudFormationRefreshInFlightRef.current.has(requestedOperationKey)) {
        return null;
      }

      cloudFormationRefreshInFlightRef.current.add(requestedOperationKey);

      try {
        const response = await sendCommandCenterIntent({
          chatId: `agent-cfn-status-${recordId || planId || sessionId || 'session'}`,
          intent: 'check_cloudformation_status',
          payload: {
            cardId: operation?.cardId || null,
            accountId: operation?.accountId || null,
            permissionProfileId: operation?.permissionProfileId || null,
            region: operation?.region || null,
            stackId: operation?.stackId || null,
            stackName: operation?.stackName || null,
            operation: operation?.operation || null,
            action: operation?.action || null,
            changeSetId: operation?.changeSetId || null,
            changeSetName: operation?.changeSetName || null,
            changeSetType: operation?.changeSetType || null,
            reviewUrl: operation?.reviewUrl || null,
            includeEvents: true,
            eventLimit: 15,
          },
        });

        const refreshedOperationPayload = response?.assistantMessage?.blocks?.find(
          (block) => block?.type === 'cloudformation_operation_card'
        )?.payload;

        const refreshedOperation =
          normalizeCloudFormationOperation({
            output: refreshedOperationPayload,
            input: null,
          }) || refreshedOperationPayload;

        if (!refreshedOperation) {
          if (!silent) {
            toast.error('Unable to refresh CloudFormation status.');
          }
          return;
        }

        const operationKey = getCloudFormationOperationKey(refreshedOperation);
        const shouldKeepRefreshing = isCloudFormationRefreshable(refreshedOperation);
        const nextAutoRefreshAt = shouldKeepRefreshing ? Date.now() + 30000 : null;

        setState((prev) => {
          const nextPlan = prev.plan.map((phase) => ({
            ...phase,
            tasks: (phase.tasks || []).map((task) => ({
              ...task,
              cloudformation_operations: dedupeCloudFormationOperations(
                (Array.isArray(task.cloudformation_operations)
                  ? task.cloudformation_operations
                  : []
                ).map((item) => {
                  const sameOperation =
                    (item?.cardId && refreshedOperation?.cardId && item.cardId === refreshedOperation.cardId) ||
                    (item?.stackId && refreshedOperation?.stackId && item.stackId === refreshedOperation.stackId) ||
                    (
                      item?.stackName &&
                      refreshedOperation?.stackName &&
                      item.stackName === refreshedOperation.stackName &&
                      item?.region === refreshedOperation?.region
                    );

                  return sameOperation ? { ...item, ...refreshedOperation } : item;
                })
              ),
            })),
          }));

          return {
            ...prev,
            plan: nextPlan,
          };
        });

        setCloudFormationRefreshSchedule((prev) => {
          if (!shouldKeepRefreshing) {
            if (!Object.prototype.hasOwnProperty.call(prev, operationKey)) {
              return prev;
            }
            const next = { ...prev };
            delete next[operationKey];
            return next;
          }
          return {
            ...prev,
            [operationKey]: nextAutoRefreshAt,
          };
        });

        if (
          source === 'auto' &&
          isCloudFormationTerminal(refreshedOperation) &&
          !cloudFormationTerminalNotifiedRef.current.has(operationKey)
        ) {
          cloudFormationTerminalNotifiedRef.current.add(operationKey);
          sendAgentFollowupMessage(buildCloudFormationAutoMessage(refreshedOperation), {
            cloudFormationOperation: refreshedOperation,
          });
        }
        return refreshedOperation;
      } catch (error) {
        if (!silent) {
          toast.error(error?.message || 'Failed to refresh CloudFormation status.');
        }
        return null;
      } finally {
        cloudFormationRefreshInFlightRef.current.delete(requestedOperationKey);
      }
    },
    [planId, recordId, sendAgentFollowupMessage, sessionId]
  );

  const handleAgentChat = () => {
    const query = state.followupPrompt;
    sendAgentFollowupMessage(query, { clearPrompt: true });
  };

  const handleGithubMergeConfirmed = useCallback(
    (operation) => {
      sendAgentFollowupMessage(buildGithubMergeConfirmationMessage(operation), {
        githubOperation: operation,
      });
    },
    [sendAgentFollowupMessage]
  );

  const handleOpenGithubIssueDialog = useCallback((operation) => {
    setGithubIssueDialog({
      open: true,
      operation,
      issueText: '',
    });
  }, []);

  const handleSubmitGithubIssue = useCallback(() => {
    const issueText = String(githubIssueDialog.issueText || '').trim();
    if (!issueText) {
      toast.error('Add the merge error or describe what went wrong.');
      return;
    }

    sendAgentFollowupMessage(
      buildGithubIssueReportMessage(githubIssueDialog.operation, issueText),
      {
        githubOperation: githubIssueDialog.operation,
      }
    );
    setGithubIssueDialog({
      open: false,
      operation: null,
      issueText: '',
    });
  }, [githubIssueDialog, sendAgentFollowupMessage]);

  const handleSubmitFormAnswers = (formAnswers) => {
    let answer = 'User Selection:\n';
    Object.keys(formAnswers).forEach((key) => {
      answer += `${key}: ${typeof formAnswers[key] === 'object' ? JSON.stringify(formAnswers[key]) : formAnswers[key]}\n`;
    });

    sendAgentFollowupMessage(answer, { clearPrompt: true });
  };

  const selectTask = (phaseIndex, taskIndex) => {
    setState((prev) => ({
      ...prev,
      currentPhase: phaseIndex,
      currentTask: taskIndex,
      currentAction: '',
    }));
  };

  const goToNextTask = () => {
    if (
      currentPhase === plan.length - 1 &&
      currentTask === plan[currentPhase].tasks.length - 1
    ) {
      return;
    }

    let nextPhase = currentPhase;
    let nextTask = currentTask + 1;

    if (nextTask >= plan[currentPhase].tasks.length) {
      nextPhase = currentPhase + 1;
      nextTask = 0;
    }

    setState((prev) => {
      const updatedPlan = [...prev.plan];

      if (updatedPlan[nextPhase]?.tasks[nextTask]) {
        updatedPlan[nextPhase].tasks[nextTask].status = 'not-run';
      }

      return {
        ...prev,
        currentPhase: nextPhase,
        currentTask: nextTask,
        currentAction: '',
        plan: updatedPlan,
      };
    });
  };

  const totalTasks = plan?.reduce((sum, phase) => sum + phase.tasks.length, 0);
  const completedTasks = plan?.reduce(
    (sum, phase) =>
      sum + phase.tasks.filter((task) => task.status === 'complete').length,
    0
  );

  const progress = (completedTasks / totalTasks) * 100;

  const cli_command_output = get(
    plan,
    [currentPhase, 'tasks', currentTask, 'cli_command_output'],
    []
  );

  // Aggregate all CLI commands from all tasks to show full history
  const allCliCommands = plan?.reduce((acc, phase) => {
    phase.tasks?.forEach((task) => {
      if (task.cli_command_output && Array.isArray(task.cli_command_output) && task.cli_command_output.length > 0) {
        acc.push(...task.cli_command_output);
      }
    });
    return acc;
  }, []) || [];

  const allCodexSessionInfo = plan?.reduce((acc, phase) => {
    phase.tasks?.forEach((task) => {
      if (Array.isArray(task.codex_session_info) && task.codex_session_info.length > 0) {
        acc.push(
          ...task.codex_session_info.map((entry) => ({
            ...entry,
            taskTitle: task.title || task.name || 'Codex session',
          }))
        );
      }
    });
    return acc;
  }, []) || [];

  const allCloudFormationOperations = dedupeCloudFormationOperations(
    plan?.reduce((acc, phase) => {
      phase.tasks?.forEach((task) => {
        if (
          task.cloudformation_operations &&
          Array.isArray(task.cloudformation_operations) &&
          task.cloudformation_operations.length > 0
        ) {
          acc.push(...task.cloudformation_operations);
        }
      });
      return acc;
    }, []) || []
  );
  const allGithubOperations = dedupeGithubOperations(
    plan?.reduce((acc, phase) => {
      phase.tasks?.forEach((task) => {
        if (
          task.github_operations &&
          Array.isArray(task.github_operations) &&
          task.github_operations.length > 0
        ) {
          acc.push(...task.github_operations);
        }
      });
      return acc;
    }, []) || []
  );
  const hasCloudFormationOperations = allCloudFormationOperations.length > 0;
  const hasGithubOperations = allGithubOperations.length > 0;
  const hasCodexSessionInfo = allCodexSessionInfo.length > 0;
  const hasTerminalOutput = (allCliCommands.length > 0 || state.hasShownTerminal) && state.showTerminal;

  useEffect(() => {
    const availableTabs = [
      hasTerminalOutput ? 'terminal' : null,
      hasCloudFormationOperations ? 'cloudformation' : null,
      hasGithubOperations ? 'github' : null,
    ].filter(Boolean);

    if (availableTabs.length === 0) {
      if (activityTab !== 'terminal') {
        setActivityTab('terminal');
      }
      return;
    }

    if (!availableTabs.includes(activityTab)) {
      setActivityTab(availableTabs[0]);
    }
  }, [activityTab, hasCloudFormationOperations, hasGithubOperations, hasTerminalOutput]);

  useEffect(() => {
    cloudFormationRefreshInFlightRef.current.clear();
    cloudFormationTerminalNotifiedRef.current.clear();
    setCloudFormationRefreshSchedule({});
  }, [recordId, sessionId, planId]);

  useEffect(() => {
    const refreshableOperations = allCloudFormationOperations.filter((operation) =>
      isCloudFormationRefreshable(operation)
    );

    setCloudFormationRefreshSchedule((prev) => {
      const now = Date.now();
      const next = {};
      refreshableOperations.forEach((operation) => {
        const key = getCloudFormationOperationKey(operation);
        next[key] =
          typeof prev[key] === 'number' && prev[key] > now ? prev[key] : now + 30000;
      });
      const sameKeys =
        Object.keys(prev).length === Object.keys(next).length &&
        Object.keys(next).every((key) => prev[key] === next[key]);
      return sameKeys ? prev : next;
    });
  }, [allCloudFormationOperations]);

  useEffect(() => {
    const refreshableOperations = allCloudFormationOperations.filter((operation) =>
      isCloudFormationRefreshable(operation)
    );

    if (refreshableOperations.length === 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setCloudFormationRefreshTick(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [allCloudFormationOperations]);

  useEffect(() => {
    const dueOperations = allCloudFormationOperations.filter((operation) => {
      if (!isCloudFormationRefreshable(operation)) {
        return false;
      }
      const refreshKey = getCloudFormationOperationKey(operation);
      const nextRefreshAt = cloudFormationRefreshSchedule?.[refreshKey];
      return typeof nextRefreshAt === 'number' && nextRefreshAt <= cloudFormationRefreshTick;
    });

    if (dueOperations.length === 0) {
      return;
    }

    dueOperations.forEach((operation) => {
      handleRefreshCloudFormationStatus(operation, {
        silent: true,
        source: 'auto',
      });
    });
  }, [
    allCloudFormationOperations,
    cloudFormationRefreshSchedule,
    cloudFormationRefreshTick,
    handleRefreshCloudFormationStatus,
  ]);

  useEffect(() => {
    const scrollToBottom = () => {
      if (lastMessageRef.current) {
        lastMessageRef.current.scrollIntoView({
          behavior: 'auto',
          block: 'end',
        });
      }
    };

    setTimeout(scrollToBottom, 0);
    setTimeout(scrollToBottom, 100);
    setTimeout(scrollToBottom, 300);
  }, [state.queries, state.answers]);

  const resetPlan = () => {
    const updatedPlan = [...state.plan];
    const currentTaskData = updatedPlan[currentPhase].tasks[currentTask];

    updatedPlan[currentPhase].tasks[currentTask] = {
      ...currentTaskData,
      status: 'not-run',
      cli_command_output: '',
      task_output: '',
    };

    setState((prev) => {
      const newQueries = [...prev.queries];
      const newAnswers = [...prev.answers];

      const currentIndex =
        currentPhase * plan[currentPhase].tasks.length + currentTask;
      newQueries[currentIndex] = null;
      newAnswers[currentIndex] = null;

      return {
        ...prev,
        plan: updatedPlan,
        queries: newQueries,
        answers: newAnswers,
      };
    });
  };

  const handleSettings = async (answers, executionContext = null) => {
    settingsUpdatedRef.current = true;

    let existingLogData = {
      logs: [],
      currentPhase: 0,
      currentTask: 0,
      authProfileName: '',
    };
    try {
      const agentData = existingAgentData;
      if (agentData?.log) {
        existingLogData = toLogObject(agentData.log);
      }
    } catch (error) {
      console.error('Error parsing existing logs:', error);
    }

    const updatedLogsObject = {
      ...existingLogData,
      lastUpdated: new Date().toISOString(),
      globalSettings: {
        ...existingLogData.globalSettings,
        ...answers,
      },
    };

    try {
      if (executionContext?.authProfile || executionContext?.accountId) {
        setSetupState((prev) => ({
          ...prev,
          authProfile: executionContext?.authProfile
            ? {
                ...prev.authProfile,
                ...executionContext.authProfile,
                permissionProfileId:
                  executionContext?.selectedPermissionProfileId ||
                  executionContext?.authProfile?.permissionProfileId ||
                  executionContext?.authProfile?.recordId ||
                  executionContext?.authProfile?.id ||
                  prev.authProfile?.permissionProfileId ||
                  null,
                validated: true,
              }
            : prev.authProfile,
          accountId: executionContext?.accountId || prev.accountId,
          globalSettings: {
            ...prev.globalSettings,
            ...answers,
            permissionProfileId:
              executionContext?.selectedPermissionProfileId ||
              prev.globalSettings?.permissionProfileId ||
              null,
          },
        }));
      }
      setState((prev) => ({
        ...prev,
        globalSettings: {
          ...prev.globalSettings,
          ...answers,
          ...(executionContext?.selectedPermissionProfileId
            ? { permissionProfileId: executionContext.selectedPermissionProfileId }
            : {}),
        },
      }));
      // await dispatch(
      //   updateAgentConnection({
      //     recordId: recordId,
      //     status: 'running',
      //     log: JSON.stringify(updatedLogsObject),
      //     authProfile: JSON.stringify({
      //       ...setupState.authProfile,
      //       validated: true,
      //       awsAccountId: accountId,
      //       authType: 'role',
      //     }),
      //   })
      // ).unwrap();

      dispatch(setIsRegionModalOpen(false));
    } catch (error) {
      console.error('Failed to update agent connection:', error);
    }
  };

  const isAllTasksCompleted = useMemo(() => {
    if (!plan || plan.length === 0) return false;

    return plan.every((phase) =>
      phase.tasks.every((task) => task.status === 'complete')
    );
  }, [plan]);
  const showCompletionScreen = isAllTasksCompleted && !isCodexExecution;

  const runSummaryText = useMemo(() => {
    const fromState = typeof finalRunSummary === 'string' ? finalRunSummary.trim() : '';
    if (fromState) return fromState;
    return getRunSummaryFromLog(existingAgentData?.log);
  }, [finalRunSummary, existingAgentData?.log]);

  const preflightQuestion = state.preflight?.question || null;
  const preflightQuestionOptions = Array.isArray(preflightQuestion?.options)
    ? preflightQuestion.options
    : [];
  const preflightQuestionSummary = Array.isArray(preflightQuestion?.summary)
    ? preflightQuestion.summary
    : [];
  const preflightQuestionOverrides =
    preflightQuestion?.overrides && typeof preflightQuestion.overrides === 'object'
      ? preflightQuestion.overrides
      : {};
  const hasPreflightQuestion = Boolean(
    preflightQuestion?.id ||
      preflightQuestion?.title ||
      preflightQuestionOptions.length > 0 ||
      preflightQuestionSummary.length > 0 ||
      Object.keys(preflightQuestionOverrides).length > 0
  );
  const showPreflightScreen = Boolean(initialLoading || hasPreflightQuestion);
  const isAwaitingPreflightInput = hasPreflightQuestion;
  const preflightDecisionSummary = summarizePreflightDecision(
    state.preflight?.decision
  );
  const preflightHeading = isAwaitingPreflightInput
    ? preflightQuestion?.id === 'analysis_review'
      ? 'Review blueprint analysis'
      : 'Input needed before continuing'
    : 'Connecting to agent';
  const preflightBody =
    state.preflight?.message ||
    (isAwaitingPreflightInput
      ? 'Review the execution analysis below and continue when ready.'
      : "We're preparing your agent's environment. This might take a few moments...");
  const headerTitle =
    title ||
    existingAgentData?.title ||
    location.state?.title ||
    location.state?.plan?.title ||
    '';

  const handleNavigateBack = useCallback(() => {
    const explicitReturnTo = location.state?.returnTo;
    if (
      typeof explicitReturnTo === 'string' &&
      explicitReturnTo.startsWith('/dashboard/')
    ) {
      navigate(explicitReturnTo);
      return;
    }

    if (isLocalRuntime()) {
      navigate('/dashboard/blueprints/library');
      return;
    }

    if (typeof window !== 'undefined' && (window.history.state?.idx || 0) > 0) {
      navigate(-1);
      return;
    }

    navigate('/dashboard/agents');
  }, [location.state?.returnTo, navigate]);

  return (
    <div className="bg-gray-100 flex flex-col h-full">
      <nav className="bg-white shadow-sm shrink-0">
        <div className="px-6">
          <div className="flex justify-between h-16">
            <div className="flex flex-1 min-w-0">
              <div className="flex items-center min-w-0">
                <Button
                  variant="link"
                  onClick={handleNavigateBack}
                  className="text-primary-600 shrink-0"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
                {headerTitle ? (
                  <>
                    <span className="mx-2 text-gray-300 shrink-0">|</span>
                    <span
                      className="text-sm font-medium text-gray-700 truncate max-w-[420px] lg:max-w-[640px]"
                      title={headerTitle}
                    >
                      {headerTitle}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            <div className="flex items-center">
              <ActionButtons
                autoplay={autoplay}
                setPermissionModal={() => {
                  setState((prev) => ({
                    ...prev,
                    isPermissionsModalOpen: true,
                  }));
                }}
              />
            </div>
          </div>
        </div>
      </nav>

      <Progress value={progress} className="h-2 bg-primary-200" />

      {authProfile.validated && !isRegionModalOpen && currentPhase !== -1 ? (
        isCodexExecution && !showPreflightScreen ? (
          <CodexRunView
            activeView={activeView}
            activityTab={activityTab}
            allCliCommands={allCliCommands}
            allCloudFormationOperations={allCloudFormationOperations}
            allCodexSessionInfo={allCodexSessionInfo}
            allGithubOperations={allGithubOperations}
            cloudFormationRefreshSchedule={cloudFormationRefreshSchedule}
            cloudFormationRefreshTick={cloudFormationRefreshTick}
            handleAgentChat={handleAgentChat}
            handleOpenGithubIssueDialog={handleOpenGithubIssueDialog}
            handleRefreshCloudFormationStatus={handleRefreshCloudFormationStatus}
            handleViewChange={handleViewChange}
            hasCloudFormationOperations={hasCloudFormationOperations}
            hasCodexSessionInfo={hasCodexSessionInfo}
            hasGithubOperations={hasGithubOperations}
            hasTerminalOutput={hasTerminalOutput}
            isCollapsed={isCollapsed}
            onConfirmGithubMerge={handleGithubMergeConfirmed}
            setActivityTab={setActivityTab}
            setIsCodexSessionInfoOpen={setIsCodexSessionInfoOpen}
            setIsCollapsed={setIsCollapsed}
            setState={setState}
            state={state}
          />
        ) : (
        <div className="flex flex-1 min-h-0 flex-col md:flex-row">
          {/* Task Details Panel - First Column */}
          {!isCodexExecution && !isTaskPanelMinimized && (
            <div
              className={cn(
                'border-r bg-white w-full md:w-1/4 h-full min-h-0 flex flex-col'
              )}
            >
              {/* Panel Header with Minimize Button */}
              <div className="flex items-center justify-between p-4 border-b">
                <span className="text-sm font-medium text-gray-600">Task Details</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500 hover:text-gray-700"
                  onClick={() => setIsTaskPanelMinimized(true)}
                  title="Minimize panel"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4">
                  {state.plan.length > 0 && (
                    <PhaseSelect
                      plan={state.plan}
                      currentPhase={state.currentPhase}
                      currentTask={state.currentTask}
                      onTaskSelect={(phaseIndex, taskIndex) => {
                        selectTask(phaseIndex, taskIndex);
                        const selectedTask =
                          state.plan[phaseIndex]?.tasks[taskIndex];
                        if (selectedTask) {
                          const chatIndex = state.queries.findIndex(
                            (query) =>
                              query?.startsWith('Execute Task Plan for:') &&
                              query.includes(selectedTask.title)
                          );

                          if (chatIndex !== -1 && chatRefs.current[chatIndex]) {
                            chatRefs.current[chatIndex].scrollIntoView({
                              behavior: 'smooth',
                              block: 'start',
                            });
                          }
                        }
                      }}
                    />
                  )}
                </div>
              </ScrollArea>
            {plan[currentPhase]?.tasks[currentTask]?.type !== 'assessment' && (
              <div className="border-t p-4 mt-auto">
                <div className="flex items-center justify-end gap-2">
                  {plan[currentPhase]?.tasks[currentTask]?.status !==
                    'not-run' && (
                    <div
                      className={`flex-1 flex items-center gap-2 p-3 rounded-[8px] ${
                        state.loading ||
                        plan[currentPhase]?.tasks[currentTask]?.status ===
                          'not-run'
                          ? 'bg-primary-50'
                          : plan[currentPhase]?.tasks[currentTask]?.status ===
                              'not-run'
                            ? 'bg-green-50'
                            : 'bg-primary-50'
                      }`}
                    >
                      <>
                        {state.loading ||
                        plan[currentPhase]?.tasks[currentTask]?.status ===
                          'not-run' ? (
                          <>
                            {state.loading && (
                              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                            )}
                            <span className="text-primary-600">
                              {plan[currentPhase]?.tasks[currentTask]
                                ?.status === 'not-run' && !state.loading
                                ? 'Not Started'
                                : formatText(
                                    plan[currentPhase]?.tasks[currentTask]
                                      ?.status
                                  )}
                            </span>
                          </>
                        ) : plan[currentPhase]?.tasks[currentTask]?.status ===
                          'complete' ? (
                          <>
                            <Icons.checkCircle className="h-6 w-6 text-green-600" />
                            <span className="text-green-600">
                              {formatText(
                                plan[currentPhase]?.tasks[currentTask]?.status
                              )}
                            </span>
                          </>
                        ) : (
                          <span className="text-primary-600">
                            {formatText(
                              plan[currentPhase]?.tasks[currentTask]?.status
                            )}
                          </span>
                        )}
                      </>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="p-3 rounded-[8px]"
                      onClick={() => {
                        if (currentPhase === 0 && currentTask === 0) return;
                        if (currentTask === 0) {
                          selectTask(
                            currentPhase - 1,
                            plan[currentPhase - 1].tasks.length - 1
                          );
                        } else {
                          selectTask(currentPhase, currentTask - 1);
                        }
                      }}
                    >
                      <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="p-3 rounded-[8px]"
                      onClick={() => {
                        if (
                          currentPhase === plan.length - 1 &&
                          currentTask === plan[currentPhase].tasks.length - 1
                        )
                          return;
                        if (currentTask === plan[currentPhase].tasks.length - 1)
                          selectTask(currentPhase + 1, 0);
                        else selectTask(currentPhase, currentTask + 1);
                      }}
                    >
                      <ArrowRight className="h-6 w-6" />
                    </Button>
                  </div>
                  {plan[currentPhase]?.tasks[currentTask]?.status !==
                    'not-run' && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="p-3 rounded-[8px] text-primary-600 hover:text-primary-700 hover:bg-primary-50"
                      onClick={resetPlan}
                    >
                      <RotateCcw className="h-6 w-6" />
                    </Button>
                  )}
                  {plan[currentPhase]?.tasks[currentTask]?.status ===
                    'not-run' && (
                    <Button
                      size="lg"
                      onClick={executeTask}
                      className="min-w-[180px]"
                      disabled={initialLoading}
                    >
                      Start Task
                    </Button>
                  )}
                </div>
              </div>
            )}
            </div>
          )}

          {/* Main Content Area - Chat + Terminal */}
          <div
            className={cn(
              'w-full flex flex-1 flex-col gap-0 min-h-0 overflow-hidden',
              !isTaskPanelMinimized && 'md:w-3/4',
              isTaskPanelMinimized && 'md:w-full'
            )}
          >
            {/* Compact Header Bar - Shows when task panel is minimized */}
            {!isCodexExecution && isTaskPanelMinimized && plan[currentPhase]?.tasks[currentTask]?.type !== 'assessment' && (
              <CompactHeaderBar
                plan={plan}
                state={state}
                currentPhase={currentPhase}
                currentTask={currentTask}
                selectTask={selectTask}
                chatRefs={chatRefs}
                setIsTaskPanelMinimized={setIsTaskPanelMinimized}
                formatText={formatText}
                resetPlan={resetPlan}
                executeTask={executeTask}
                initialLoading={initialLoading}
              />
            )}

            {/* Chat + Terminal Container */}
            <div
              className={cn(
                'flex-1 flex gap-4 p-4 min-h-0 overflow-hidden',
                activeView === 'split' ? 'flex-col' : 'flex-row',
                showCompletionScreen ? 'justify-center items-center' : ''
              )}
            >
            {showPreflightScreen ? (
              <Card className="w-full flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-white to-primary-50">
                <div className="w-full max-w-4xl mx-auto flex-1 overflow-y-auto px-6 py-8">
                <div className="text-center space-y-6">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary-100">
                    {isAwaitingPreflightInput ? (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                        <CheckCircle className="h-7 w-7 text-primary-600" />
                      </div>
                    ) : (
                      <div className="relative w-14 h-14">
                        <div className="absolute inset-0 rounded-full border-4 border-primary-200 opacity-75"></div>
                        <div className="absolute inset-0 rounded-full border-t-4 border-primary-500 animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <MessageSquare className="h-6 w-6 text-primary-600" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xl font-medium text-gray-800">
                      {preflightHeading}
                    </h3>
                    {!isAwaitingPreflightInput ? (
                      <div className="flex items-center justify-center space-x-1">
                        <span
                          className="h-2 w-2 bg-primary-500 rounded-full animate-bounce"
                          style={{ animationDelay: '0ms' }}
                        ></span>
                        <span
                          className="h-2 w-2 bg-primary-500 rounded-full animate-bounce"
                          style={{ animationDelay: '150ms' }}
                        ></span>
                        <span
                          className="h-2 w-2 bg-primary-500 rounded-full animate-bounce"
                          style={{ animationDelay: '300ms' }}
                        ></span>
                      </div>
                    ) : null}
                    <p className="text-sm text-gray-500 max-w-xs mx-auto">
                      {preflightBody}
                    </p>
                    {(isAwaitingPreflightInput || preflightDecisionSummary) && (
                      <div className="max-w-md mx-auto rounded-lg border border-primary-100 bg-white/90 px-4 py-3 text-left">
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
                          Current status
                        </p>
                        <p className="mt-1 text-sm font-medium text-gray-800">
                          {isAwaitingPreflightInput
                            ? 'Preparation is complete and waiting on your review.'
                            : 'Preparation is still in progress.'}
                        </p>
                        {preflightDecisionSummary ? (
                          <p className="mt-1 text-xs text-gray-600">
                            {preflightDecisionSummary}
                          </p>
                        ) : null}
                      </div>
                    )}
                    {state.preflight?.steps?.length ? (
                      <div className="max-w-md mx-auto rounded-lg border border-gray-200 bg-white/90 px-4 py-3 text-left">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Preparation Activity
                        </p>
                        <div
                          ref={preflightActivityRef}
                          className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1"
                        >
                          {state.preflight.steps.map((step, index) => (
                            <div
                              key={`${step.kind || 'step'}-${step.phase || step.title || 'item'}-${index}`}
                              className="flex items-start gap-2"
                            >
                              <div className="mt-0.5">
                                {step.status === 'complete' ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : step.status === 'running' ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
                                ) : step.status === 'warning' ? (
                                  <Circle className="h-4 w-4 fill-amber-500 text-amber-500" />
                                ) : step.status === 'question' ? (
                                  <Circle className="h-4 w-4 fill-primary-500 text-primary-500" />
                                ) : (
                                  <Circle className="h-4 w-4 fill-gray-400 text-gray-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800">
                                  {step.title}
                                </p>
                                {step.detail ? (
                                  <p className="text-xs text-gray-600">
                                    {step.detail}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {state.preflight?.recommendation?.status === 'recommended_workload' &&
                    state.preflight?.recommendation?.topCandidate?.name ? (
                      <div className="max-w-md mx-auto rounded-lg border border-primary-100 bg-white/80 px-4 py-3 text-left">
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
                          Suggested Target
                        </p>
                        <p className="mt-1 text-sm font-medium text-gray-800">
                          {state.preflight.recommendation.topCandidate.name}
                        </p>
                        {state.preflight.recommendation.topCandidate.reasons?.[0] ? (
                          <p className="mt-1 text-xs text-gray-600">
                            {state.preflight.recommendation.topCandidate.reasons[0]}
                          </p>
                        ) : null}
                      </div>
                    ) : state.preflight?.recommendation?.status ===
                        'environment_scope_recommended' ? (
                      <div className="max-w-md mx-auto rounded-lg border border-primary-100 bg-white/80 px-4 py-3 text-left">
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
                          Suggested Scope
                        </p>
                        <p className="mt-1 text-sm font-medium text-gray-800">
                          Environment-wide
                        </p>
                        {state.preflight?.recommendation?.reason ? (
                          <p className="mt-1 text-xs text-gray-600">
                            {state.preflight.recommendation.reason}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {hasPreflightQuestion ? (
                      <div className="max-w-md mx-auto rounded-lg border border-gray-200 bg-white/90 px-4 py-4 text-left space-y-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Input Needed
                          </p>
                          <p className="mt-1 text-sm font-medium text-gray-800">
                            {preflightQuestion?.title || 'Review before continuing'}
                          </p>
                          {preflightQuestion?.id === 'analysis_review' ? (
                            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-primary-100 bg-primary-50 px-3 py-2">
                              <p className="text-xs text-primary-800">
                                {reviewCountdown != null && !reviewCountdownPaused
                                  ? `Continuing automatically in ${reviewCountdown}s unless you change a setting or pause.`
                                  : 'Automatic continue is paused.'}
                              </p>
                              {!reviewCountdownPaused ? (
                                <button
                                  type="button"
                                  onClick={handlePauseReviewCountdown}
                                  className="rounded-md border border-primary-200 bg-white px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100"
                                >
                                  Pause
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        {preflightQuestionSummary.length ? (
                          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 space-y-2">
                            {preflightQuestionSummary.map((item, index) => (
                              <div
                                key={`${item.label || 'summary'}-${index}`}
                                className="flex items-start justify-between gap-3"
                              >
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  {item.label}
                                </span>
                                <span className="text-sm text-gray-800 text-right">
                                  {item.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {Object.keys(preflightQuestionOverrides).length ? (
                          <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
                            {Object.entries(preflightQuestionOverrides).map(
                              ([overrideId, overrideConfig]) => (
                                <div
                                  key={overrideId}
                                  className="block space-y-1"
                                >
                                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    {overrideConfig?.title || overrideId}
                                  </span>
                                  {overrideConfig?.kind === 'multi_select' ? (
                                    <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
                                      {(overrideConfig?.options || []).map((option) => {
                                        const selectedValues = Array.isArray(
                                          state.preflight?.selections?.[overrideId]
                                        )
                                          ? state.preflight.selections[overrideId]
                                          : Array.isArray(overrideConfig?.value)
                                          ? overrideConfig.value
                                          : [];
                                        const isChecked = selectedValues.includes(option.id);
                                        return (
                                          <label
                                            key={option.id}
                                            className="flex items-start gap-2 text-sm text-gray-800"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={(event) =>
                                                handlePreflightMultiSelectionToggle(
                                                  overrideId,
                                                  option.id,
                                                  event.target.checked
                                                )
                                              }
                                              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                            />
                                            <span className="min-w-0">
                                              <span className="block font-medium">
                                                {option.label}
                                              </span>
                                              {option.description ? (
                                                <span className="block text-xs text-gray-500">
                                                  {option.description}
                                                </span>
                                              ) : null}
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <select
                                      value={
                                        state.preflight?.selections?.[overrideId] ||
                                        overrideConfig?.value ||
                                        ''
                                      }
                                      onChange={(event) =>
                                        handlePreflightSelectionChange(
                                          overrideId,
                                          event.target.value
                                        )
                                      }
                                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-primary-400 focus:outline-none"
                                    >
                                      {(overrideConfig?.options || []).map((option) => (
                                        <option key={option.id} value={option.id}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        ) : null}
                        {preflightQuestionOptions.length ? (
                          <div className="space-y-2">
                            {preflightQuestionOptions.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() =>
                                  handlePreflightAnswer(
                                    preflightQuestion?.id,
                                    option.id,
                                    preflightQuestion?.id === 'analysis_review'
                                      ? state.preflight.selections || {}
                                      : null
                                  )
                                }
                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-3 text-left hover:border-primary-300 hover:bg-primary-50 transition-colors"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-sm font-medium text-gray-800">
                                    {option.label}
                                  </span>
                                  {option.recommended ? (
                                    <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-semibold text-primary-700">
                                      Recommended
                                    </span>
                                  ) : null}
                                </div>
                                {option.description ? (
                                  <p className="mt-1 text-xs text-gray-600">
                                    {option.description}
                                  </p>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        ) : preflightQuestion?.id === 'analysis_review' ? (
                          <button
                            type="button"
                            onClick={() =>
                              handlePreflightAnswer(
                                'analysis_review',
                                'continue',
                                state.preflight.selections || {}
                              )
                            }
                            className="w-full rounded-lg border border-primary-200 bg-primary-50 px-3 py-3 text-sm font-medium text-primary-800 hover:border-primary-300 hover:bg-primary-100 transition-colors"
                          >
                            Continue
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                </div>
              </Card>
            ) : showCompletionScreen ? (
              <div className="text-center space-y-6 max-w-xl px-4 flex items-center justify-center flex-col">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-2">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-3">
                    All Tasks Completed
                  </h2>
                  <p className="text-base text-gray-600">
                    {title} has successfully completed all tasks in your plan.
                  </p>
                  {runSummaryText && (
                    <div className="mt-4 rounded-lg border border-gray-200 bg-white/80 p-4 text-left">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Run Summary
                      </p>
                      <div className="mt-2 max-h-[320px] overflow-y-auto pr-2 text-sm text-gray-700">
                        <AgentMarkdown variant="compact">
                          {runSummaryText}
                        </AgentMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col bg-white rounded-[16px] overflow-hidden pb-4 relative min-h-0">
                <>
                  <div className="px-4 py-3 shrink-0">
                    <h2 className="font-medium text-[18px] text-black">Chat</h2>
                  </div>
                  {state.responseErrorMessage && (
                    <div className="px-4 shrink-0">
                      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {state.responseErrorMessage}
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto min-h-0">
                    <div className="py-2">
                      {(state.queries.length > 0
                        ? state.queries
                        : state.answers
                      )
                        .map((item, index) => {
                          const query = state.queries[index];
                          const answer = state.answers[index];

                          const actionMessage = getActionMessage(
                            state.currentAction
                          );
                          const isAction = query?.startsWith(
                            'Execute Task Plan for:'
                          );
                          const currentTaskCompleted =
                            plan[currentPhase]?.tasks[currentTask]?.status ===
                            'complete';

                          // Determine if this is the last item (for showing loading indicator)
                          const totalItems = state.queries.length > 0 ? state.queries.length : state.answers.length;
                          const isLastIndex = index === totalItems - 1;
                          
                          // Skip rendering if no answer, unless:
                          // - It's the last index (so loading indicator can show)
                          // - Or loading is active and it's the last index
                          if (!answer && !isLastIndex)
                            return null;

                          return (
                            <div
                              key={index}
                              className="space-y-4 pb-8"
                              ref={(el) => {
                                if (isAction) {
                                  chatRefs.current[index] = el;
                                }
                                if (
                                  index ===
                                  (state.queries.length > 0
                                    ? state.queries
                                    : state.answers
                                  ).length -
                                    1
                                ) {
                                  lastMessageRef.current = el;
                                }
                              }}
                            >
                              {query && (
                                <div className="bg-primary-100 p-4 rounded-lg text-right flex ml-auto w-fit ">
                                  <p className="text-primary-800">{query}</p>
                                </div>
                              )}
                              {state.loading && isLastIndex && !isCodexExecution ? (
                                <div className="gap-2 bg-primary-200 rounded-[8px] p-2 inline-flex">
                                  <Icons.book className="h-6 w-6 text-primary-600" />
                                  <p>
                                    {state.currentAction &&
                                    state.loading &&
                                    isAction ? (
                                      <>
                                        {actionMessage}
                                        <LoadingDots />
                                      </>
                                    ) : (
                                      <LoadingDots />
                                    )}
                                  </p>
                                </div>
                              ) : (
                                <>
                                  {state.currentAction && isAction && (
                                    <div className="gap-2 bg-primary-200 rounded-[8px] p-2 inline-flex">
                                      <Icons.book className="h-6 w-6 text-primary-600" />
                                      <p>{actionMessage}</p>
                                    </div>
                                  )}
                                  {answer && (
                                    <DynamicFormWithModal
                                      answer={answer}
                                      handleSubmitFormAnswers={
                                        handleSubmitFormAnswers
                                      }
                                      index={index}
                                      state={state}
                                      taskType={
                                        plan[currentPhase]?.tasks[currentTask]
                                          ?.type
                                      }
                                      taskStatus={
                                        plan[currentPhase]?.tasks[currentTask]
                                          ?.status
                                      }
                                      handleAgentChat={handleAgentChat}
                                      setState={setState}
                                    />
                                  )}
                                  {currentTaskCompleted &&
                                    index === state.answers.length - 1 && (
                                      <div className="flex flex-row gap-2 bg-primary-200 rounded-[8px] p-4 w-fit">
                                        <div className="flex items-center gap-2">
                                          <Icons.checkCircle className="h-6 w-6 text-primary-600" />
                                          <p className="text-primary-600">
                                            Task completed
                                          </p>
                                        </div>
                                        <Button
                                          variant="link"
                                          onClick={goToNextTask}
                                        >
                                          Go to Next Task
                                        </Button>
                                      </div>
                                    )}
                                </>
                              )}
                              {index < state.queries.length - 1 &&
                                (() => {
                                  const nextQuery = state.queries[index + 1];
                                  let taskInfo = null;
                                  let isTaskComplete = false;

                                  plan.forEach((phase, phaseIndex) => {
                                    phase.tasks.forEach((task, taskIndex) => {
                                      if (nextQuery?.includes(task.title)) {
                                        taskInfo = `Task ${phaseIndex + 1}.${taskIndex + 1}`;
                                        const previousTask =
                                          phase.tasks[taskIndex - 1] ||
                                          (phaseIndex > 0
                                            ? plan[phaseIndex - 1]?.tasks[
                                                plan[phaseIndex - 1]?.tasks
                                                  .length - 1
                                              ]
                                            : null);
                                        isTaskComplete =
                                          previousTask?.status === 'complete';
                                      }
                                    });
                                  });

                                  return isTaskComplete && taskInfo ? (
                                    <div className="flex items-center gap-3 my-8">
                                      <div className="h-[1px] flex-1 bg-gray-200" />
                                      <div className="text-sm text-gray-500 px-4 bg-white">
                                        {taskInfo || 'Task'}
                                      </div>
                                      <div className="h-[1px] flex-1 bg-gray-200" />
                                    </div>
                                  ) : null;
                                })()}
                            </div>
                          );
                        })
                        .filter(Boolean)}
                      {Array.isArray(state.codexLiveMessages) &&
                        state.codexLiveMessages.map((message) => (
                          <div
                            key={message.id || `${message.timestamp}-${message.answerIndex}`}
                            className="space-y-2 pb-4"
                            ref={(el) => {
                              lastMessageRef.current = el;
                            }}
                          >
                            <div className="rounded-lg border border-primary-100 bg-primary-50 p-4 text-left">
                              <AgentMarkdown variant="compact">
                                {message.content}
                              </AgentMarkdown>
                            </div>
                          </div>
                        ))}
                      {state.loading && isCodexExecution ? (
                        <div className="gap-2 bg-primary-200 rounded-[8px] p-2 inline-flex">
                          <Icons.book className="h-6 w-6 text-primary-600" />
                          <p>
                            <LoadingDots />
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="px-4">
                    {!shouldShowAgentChatInput ? null : (
                      <>
                        {!isCodexExecution && activeTaskStatus === 'not-run' && !isCodexWaitingForInput ? (
                          <Button onClick={executeTask} className="w-full">
                            Start Task
                          </Button>
                        ) : (
                          <div className="flex border rounded-lg overflow-hidden p-2">
                            <div className="flex-1">
                              <Input
                                value={state.followupPrompt}
                                onChange={(e) =>
                                  setState((prev) => ({
                                    ...prev,
                                    followupPrompt: e.target.value,
                                  }))
                                }
                                placeholder={
                                  isCodexExecution
                                    ? 'Message Codex...'
                                    : isCodexWaitingForInput
                                      ? 'Reply to Codex...'
                                      : 'Chat with agent...'
                                }
                                onKeyDown={(e) =>
                                  e.key === 'Enter' && handleAgentChat()
                                }
                                className="border-0 focus-visible:ring-0"
                                disabled={
                                  !isCodexExecution &&
                                  !isCodexWaitingForInput &&
                                  isReconnecting &&
                                  plan[currentPhase]?.tasks[currentTask]
                                    ?.status === 'complete'
                                }
                              />
                            </div>
                            <Button
                              onClick={() => handleAgentChat()}
                              disabled={
                                (!isCodexExecution &&
                                  !isCodexWaitingForInput &&
                                  isReconnecting &&
                                  plan[currentPhase]?.tasks[currentTask]
                                    ?.status === 'complete') ||
                                state.loading ||
                                state.followupPrompt === ''
                              }
                            >
                              Send
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              </div>
            )}
            {(hasTerminalOutput || hasCloudFormationOperations || hasGithubOperations) &&
              plan[currentPhase]?.tasks[currentTask]?.type !== 'assessment' &&
              !showCompletionScreen && (
                <RunActivityPanel
                  activeView={activeView}
                  activityTab={activityTab}
                  allCliCommands={allCliCommands}
                  allCloudFormationOperations={allCloudFormationOperations}
                  allGithubOperations={allGithubOperations}
                  cloudFormationRefreshSchedule={cloudFormationRefreshSchedule}
                  cloudFormationRefreshTick={cloudFormationRefreshTick}
                  handleOpenGithubIssueDialog={handleOpenGithubIssueDialog}
                  handleRefreshCloudFormationStatus={handleRefreshCloudFormationStatus}
                  handleViewChange={handleViewChange}
                  hasCloudFormationOperations={hasCloudFormationOperations}
                  hasCodexSessionInfo={hasCodexSessionInfo}
                  hasGithubOperations={hasGithubOperations}
                  hasTerminalOutput={hasTerminalOutput}
                  isCollapsed={isCollapsed}
                  onConfirmGithubMerge={handleGithubMergeConfirmed}
                  setActivityTab={setActivityTab}
                  setIsCodexSessionInfoOpen={setIsCodexSessionInfoOpen}
                  setIsCollapsed={setIsCollapsed}
                />
              )}
            </div>
          </div>
        </div>
        )
      ) : (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary-600"></div>
        </div>
      )}
      {/* Permissions Modal */}
      {/* <PermissionsModal
        isOpen={isPermissionsModalOpen}
        setState={setState}
        state={state}
        onCancel={() => {
          if (!isReconnecting) {
            navigate(`/library/blueprint/${planId}`);
          } else {
            setState((prev) => ({ ...prev, isPermissionsModalOpen: false }));
          }
        }}
        onOpenChange={() =>
          setState((prev) => ({
            ...prev,
            isPermissionsModalOpen: false,
          }))
        }
        recordId={recordId}
        requiredPermissions={requiredPermissions}
        existingAgentData={existingAgentData}
        isReconnecting={isReconnecting}
      />
      <SettingsSummary
        isOpen={isRegionModalOpen}
        onClose={() => dispatch(setIsRegionModalOpen(false))}
        onSubmit={(answers) => {
          handleSettings(answers);
        }}
        defaultValues={globalSettings}
        inputSummary={inputSummary}
        isAgent={true}
        planId={planId}
        buttonText={isReconnecting ? 'Save Settings' : 'Run Agent'}
        isReconnecting={isReconnecting || !shouldAutocontinue}
      /> */}

      <PermissionsModal
        isOpen={setupState.isPermissionsModalOpen}
        setState={setSetupState}
        state={setupState}
        authProfile={setupState.authProfile}
        requiredPermissions={setupState.requiredPermissions}
        onComplete={handlePermissionsComplete}
        onCancel={() => {
          () => {
            if (!isReconnecting) {
              navigate(`/library/blueprint/${planId}`);
            } else {
              setState((prev) => ({ ...prev, isPermissionsModalOpen: false }));
            }
          };
        }}
        recordId={setupState.recordId || ''}
        existingAgentData={setupState.existingAgentData || {}}
        isReconnecting={setupState.isReconnecting}
        cloudProvider={targetCloudProvider}
      />

      {isRegionModalOpen && (() => {
        const effectiveRecordId = blueprintRecordId || recordId || '';
        const effectivePlanId = planId || existingAgentData?.itemId || blueprintRecordId || recordId || '';
        const effectiveBlueprintId = blueprintId || planId || existingAgentData?.itemId || blueprintRecordId || recordId || setupState?.recordId || '';
        
        return (
          <SettingsSummary
            isOpen={isRegionModalOpen}
            defaultValues={setupState.globalSettings}
            inputSummary={setupState.inputSummary}
            onSubmit={(settings, runContext) => {
              const completeData = handleSettingsComplete(settings);
              handleSettings(completeData, {
                authProfile: runContext?.authProfile || null,
                accountId: runContext?.accountId || null,
                selectedPermissionProfileId:
                  runContext?.selectedPermissionProfileId || null,
                selectedPermissionProfile: runContext?.selectedPermissionProfile || null,
              });
            }}
            isReconnecting={false}
            onClose={() => dispatch(setIsRegionModalOpen(false))}
            isAgent={true}
            planId={effectivePlanId}
            blueprintId={effectiveBlueprintId}
            recordId={effectiveRecordId}
            recommendationExecutionContext={recommendationExecutionContext}
          />
        );
      })()}
      <Dialog
        open={isCodexSessionInfoOpen}
        onOpenChange={setIsCodexSessionInfoOpen}
      >
        <DialogContent className="max-w-2xl bg-white max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Codex Session Info</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto pr-2 space-y-3">
            {allCodexSessionInfo.length === 0 ? (
              <p className="text-sm text-gray-500">No Codex session details recorded yet.</p>
            ) : (
              allCodexSessionInfo.map((entry, index) => (
                <div
                  key={`${entry.timestamp || 'session'}-${index}`}
                  className="rounded-md border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{entry.taskTitle || 'Codex session'}</span>
                    {entry.timestamp ? (
                      <span>{new Date(entry.timestamp).toLocaleString()}</span>
                    ) : null}
                  </div>
                  <pre className="whitespace-pre-wrap break-words font-mono text-xs text-gray-700">
                    {entry.message}
                  </pre>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const RunActivityPanel = ({
  activeView,
  activityTab,
  allCliCommands,
  allCloudFormationOperations,
  allGithubOperations,
  cloudFormationRefreshSchedule,
  cloudFormationRefreshTick,
  handleOpenGithubIssueDialog,
  handleRefreshCloudFormationStatus,
  handleViewChange,
  hasCloudFormationOperations,
  hasCodexSessionInfo,
  hasGithubOperations,
  hasTerminalOutput,
  isCollapsed,
  onConfirmGithubMerge,
  setActivityTab,
  setIsCodexSessionInfoOpen,
  setIsCollapsed,
}) => (
  <div
    className={cn(
      'flex-1 bg-primary-900 text-white rounded-[16px] flex flex-col transition-all duration-300 terminal-scrollbar min-h-0 overflow-hidden',
      isCollapsed && 'bg-white flex-none w-24'
    )}
  >
    {isCollapsed ? (
      <div className="p-4 border-gray-800 flex items-center justify-center">
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex items-center justify-center w-1/2 transition-colors"
        >
          <Icons.collapse className="h-6 w-6 text-primary-600" />
        </button>
      </div>
    ) : (
      <>
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">
              {activityTab === 'cloudformation'
                ? '_CloudFormation'
                : activityTab === 'github'
                  ? '_GitHub'
                  : '_Terminal'}
            </span>
            <div className="flex items-center rounded-md bg-[#3A3F4B] p-1">
              {hasTerminalOutput ? (
                <button
                  type="button"
                  onClick={() => setActivityTab('terminal')}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    activityTab === 'terminal'
                      ? 'bg-[#5B9BD9] text-primary-900'
                      : 'text-primary-250 hover:text-white'
                  )}
                >
                  Terminal
                </button>
              ) : null}
              {hasCloudFormationOperations ? (
                <button
                  type="button"
                  onClick={() => setActivityTab('cloudformation')}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    activityTab === 'cloudformation'
                      ? 'bg-[#5B9BD9] text-primary-900'
                      : 'text-primary-250 hover:text-white'
                  )}
                >
                  CloudFormation
                </button>
              ) : null}
              {hasGithubOperations ? (
                <button
                  type="button"
                  onClick={() => setActivityTab('github')}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    activityTab === 'github'
                      ? 'bg-[#5B9BD9] text-primary-900'
                      : 'text-primary-250 hover:text-white'
                  )}
                >
                  GitHub
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasCodexSessionInfo ? (
              <button
                type="button"
                onClick={() => setIsCodexSessionInfoOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#3A3F4B] px-2.5 text-xs font-medium text-primary-250 hover:text-white"
              >
                <Info className="h-3.5 w-3.5" />
                Session info
              </button>
            ) : null}
            <div className="flex rounded-md overflow-hidden w-[120px] h-8">
              <button
                onClick={() => handleViewChange('columns')}
                className={`flex items-center justify-center w-1/2 transition-colors ${
                  activeView === 'columns'
                    ? 'bg-[#5B9BD9] text-white'
                    : 'bg-[#3A3F4B] text-gray-400 hover:text-white'
                }`}
                aria-label="Column view"
                aria-pressed={activeView === 'columns'}
              >
                <Icons.view
                  className={`h-4 w-4 ${
                    activeView === 'columns'
                      ? 'text-primary-900'
                      : 'text-primary-250'
                  }`}
                />
              </button>
              <button
                onClick={() => handleViewChange('split')}
                className={`flex items-center justify-center w-1/2 transition-colors ${
                  activeView === 'split'
                    ? 'bg-[#5B9BD9] text-white'
                    : 'bg-[#3A3F4B] text-gray-400 hover:text-white'
                }`}
                aria-label="Split view"
                aria-pressed={activeView === 'split'}
              >
                <Icons.split
                  className={`h-4 w-4 ${
                    activeView === 'columns'
                      ? 'text-primary-250'
                      : 'text-primary-900'
                  }`}
                />
              </button>{' '}
              <button
                onClick={() => setIsCollapsed((collapsed) => !collapsed)}
                className="flex items-center justify-center w-1/2 transition-colors"
              >
                <Icons.collapse className="h-6 w-6 text-white" />
              </button>
            </div>
          </div>
        </div>
        {activityTab === 'terminal' && hasTerminalOutput && (
          <TerminalComponent commands={allCliCommands} />
        )}
        {activityTab === 'cloudformation' && hasCloudFormationOperations && (
          <CloudFormationOperationsPanel
            operations={allCloudFormationOperations}
            onRefresh={handleRefreshCloudFormationStatus}
            refreshSchedule={cloudFormationRefreshSchedule}
            refreshTick={cloudFormationRefreshTick}
          />
        )}
        {activityTab === 'github' && hasGithubOperations && (
          <GithubOperationsPanel
            operations={allGithubOperations}
            onConfirmMerge={onConfirmGithubMerge}
            onReportIssue={handleOpenGithubIssueDialog}
          />
        )}
      </>
    )}
  </div>
);

const CodexRunView = ({
  activeView,
  activityTab,
  allCliCommands,
  allCloudFormationOperations,
  allCodexSessionInfo,
  allGithubOperations,
  cloudFormationRefreshSchedule,
  cloudFormationRefreshTick,
  handleAgentChat,
  handleOpenGithubIssueDialog,
  handleRefreshCloudFormationStatus,
  handleViewChange,
  hasCloudFormationOperations,
  hasCodexSessionInfo,
  hasGithubOperations,
  hasTerminalOutput,
  isCollapsed,
  setActivityTab,
  setIsCodexSessionInfoOpen,
  setIsCollapsed,
  setState,
  state,
  onConfirmGithubMerge,
}) => {
  const codexMessages = Array.isArray(state.codexLiveMessages)
    ? state.codexLiveMessages
    : [];
  const renderedMessageIds = new Set();
  const queryCount = Math.max(
    Array.isArray(state.queries) ? state.queries.length : 0,
    Array.isArray(state.answers) ? state.answers.length : 0
  );

  const renderCodexAssistantBubble = (message) => {
    const key = message.id || `${message.timestamp}-${message.answerIndex}`;
    renderedMessageIds.add(key);
    return (
      <div key={key} className="space-y-2 pb-4">
        <div className="rounded-lg border border-primary-100 bg-primary-50 p-4 text-left">
          <AgentMarkdown variant="compact">
            {message.content}
          </AgentMarkdown>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        'flex-1 flex gap-4 p-4 min-h-0 overflow-hidden',
        activeView === 'split' ? 'flex-col' : 'flex-row'
      )}
    >
      <div className="flex-1 flex flex-col bg-white rounded-[16px] overflow-hidden pb-4 relative min-h-0">
        <div className="px-4 py-3 shrink-0">
          <h2 className="font-medium text-[18px] text-black">Codex Chat</h2>
        </div>
        {state.responseErrorMessage ? (
          <div className="px-4 shrink-0">
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {state.responseErrorMessage}
            </div>
          </div>
        ) : null}
        <div className="flex-1 p-4 overflow-y-auto min-h-0">
          <div className="py-2">
            {Array.from({ length: queryCount }).map((_, index) => {
              const query = state.queries[index];
              const answer = state.answers[index];
              const messagesForTurn = codexMessages.filter(
                (message) => Number(message.answerIndex || 0) === index
              );
              const normalizedAnswer = normalizeCodexTranscriptText(answer);
              const hasDuplicateStreamedAnswer =
                Boolean(normalizedAnswer) &&
                messagesForTurn.some(
                  (message) =>
                    normalizeCodexTranscriptText(message.content) === normalizedAnswer
                );
              const shouldShowSavedAnswer =
                Boolean(answer) && !hasDuplicateStreamedAnswer;

              return (
                <div key={`${query || 'codex-turn'}-${index}`} className="space-y-4 pb-8">
                  {query ? (
                    <div className="bg-primary-100 p-4 rounded-lg text-right flex ml-auto w-fit">
                      <p className="text-primary-800">{query}</p>
                    </div>
                  ) : null}
                  {messagesForTurn.map(renderCodexAssistantBubble)}
                  {shouldShowSavedAnswer ? (
                    <div className="rounded-lg border border-primary-100 bg-primary-50 p-4 text-left">
                      <AgentMarkdown variant="compact">{answer}</AgentMarkdown>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {codexMessages
              .filter((message) => {
                const key = message.id || `${message.timestamp}-${message.answerIndex}`;
                return !renderedMessageIds.has(key);
              })
              .map(renderCodexAssistantBubble)}
            {state.loading ? (
              <div className="gap-2 bg-primary-200 rounded-[8px] p-2 inline-flex">
                <Icons.book className="h-6 w-6 text-primary-600" />
                <p>
                  <LoadingDots />
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="px-4">
          <div className="flex border rounded-lg overflow-hidden p-2">
            <div className="flex-1">
              <Input
                value={state.followupPrompt}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    followupPrompt: event.target.value,
                  }))
                }
                placeholder="Message Codex..."
                onKeyDown={(event) =>
                  event.key === 'Enter' && handleAgentChat()
                }
                className="border-0 focus-visible:ring-0"
              />
            </div>
            <Button
              onClick={() => handleAgentChat()}
              disabled={state.loading || state.followupPrompt === ''}
            >
              Send
            </Button>
          </div>
        </div>
      </div>
      {(hasTerminalOutput || hasCloudFormationOperations || hasGithubOperations) ? (
        <RunActivityPanel
          activeView={activeView}
          activityTab={activityTab}
          allCliCommands={allCliCommands}
          allCloudFormationOperations={allCloudFormationOperations}
          allGithubOperations={allGithubOperations}
          cloudFormationRefreshSchedule={cloudFormationRefreshSchedule}
          cloudFormationRefreshTick={cloudFormationRefreshTick}
          handleOpenGithubIssueDialog={handleOpenGithubIssueDialog}
          handleRefreshCloudFormationStatus={handleRefreshCloudFormationStatus}
          handleViewChange={handleViewChange}
          hasCloudFormationOperations={hasCloudFormationOperations}
          hasCodexSessionInfo={hasCodexSessionInfo}
          hasGithubOperations={hasGithubOperations}
          hasTerminalOutput={hasTerminalOutput}
          isCollapsed={isCollapsed}
          onConfirmGithubMerge={onConfirmGithubMerge}
          setActivityTab={setActivityTab}
          setIsCodexSessionInfoOpen={setIsCodexSessionInfoOpen}
          setIsCollapsed={setIsCollapsed}
        />
      ) : null}
    </div>
  );
};

const PhaseSelect = ({ plan, onTaskSelect, currentTask, currentPhase }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [initialTab, setInitialTab] = useState('output');

  const [isExpanded, setIsExpanded] = useState(() => {
    const currentPhaseObj = plan[currentPhase];
    if (currentPhaseObj) {
      return currentPhaseObj.tasks.every((task) => task.status === 'complete');
    }
    return false;
  });

  useEffect(() => {
    const currentPhaseObj = plan[currentPhase];
    if (currentPhaseObj) {
      const isPhaseComplete = currentPhaseObj.tasks.every(
        (task) => task.status === 'complete'
      );
      setIsExpanded(isPhaseComplete);
    }
  }, [currentPhase, plan]);

  const isTaskComplete = (phaseIndex, taskIndex) => {
    return plan[phaseIndex]?.tasks[taskIndex]?.status === 'complete';
  };

  const isTaskDisabled = (phaseIndex, taskIndex) => {
    const task = plan[phaseIndex]?.tasks[taskIndex];
    if (!task) return true;

    if (task.depends_on && task.depends_on.length > 0) {
      return task.depends_on.some((taskId) => {
        for (let p = 0; p <= phaseIndex; p++) {
          const dependentTaskIndex = plan[p].tasks.findIndex(
            (t) => t.id === taskId
          );
          if (dependentTaskIndex !== -1) {
            if (
              isTaskDisabled(p, dependentTaskIndex) ||
              !isTaskComplete(p, dependentTaskIndex)
            ) {
              return true;
            }
          }
        }
        return false;
      });
    }

    return false;
  };

  const handleTaskClick = (phaseIndex, taskIndex) => {
    if (!isTaskDisabled(phaseIndex, taskIndex)) {
      onTaskSelect?.(phaseIndex, taskIndex);
      setIsExpanded(false);
    }
  };

  const handleViewDetails = (e, phaseIndex, taskIndex) => {
    e.stopPropagation();
    setSelectedTask({ phase: phaseIndex, task: taskIndex });
    setInitialTab('output');
    setModalOpen(true);
  };

  const handleDownload = (e, phaseIndex, taskIndex) => {
    e.stopPropagation();
    setSelectedTask({ phase: phaseIndex, task: taskIndex });
    setInitialTab('terminal');
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {plan[currentPhase]?.tasks[currentTask]?.type !== 'assessment' && (
        <div className="w-full max-w-4xl mx-auto border rounded-lg bg-white overflow-hidden">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between p-2 hover:bg-gray-50 border-b "
          >
            <h2 className="text-lg text-primary-900 font-medium">
              {currentPhase + 1}.{currentTask + 1}.{' '}
              {plan[currentPhase]?.tasks[currentTask]?.title}
            </h2>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            )}
          </button>

          {isExpanded && (
            <div key={currentPhase} className="p-2 bg-white fade-in">
              <h3 className="text-lg text-primary-900 mb-4 font-medium">
                1. {plan[0].title}
              </h3>
              <div className="space-y-4">
                {plan.map((phase, phaseIndex) => (
                  <div key={phaseIndex}>
                    {phaseIndex !== 0 && (
                      <h4 className="text-lg text-primary-900 mt-6 mb-4 font-medium">
                        {phaseIndex + 1}. {phase.title}
                      </h4>
                    )}
                    {phase.tasks.map((task, taskIndex) => {
                      const disabled = isTaskDisabled(phaseIndex, taskIndex);

                      return (
                        <div
                          key={taskIndex}
                          onClick={() => handleTaskClick(phaseIndex, taskIndex)}
                          className={cn(
                            'flex items-start justify-between gap-3 py-2 px-2 rounded-md',
                            !disabled && 'cursor-pointer hover:bg-gray-50',
                            disabled && 'opacity-50 cursor-not-allowed',
                            currentPhase === phaseIndex &&
                              currentTask === taskIndex &&
                              'bg-primary-50'
                          )}
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div
                              className={cn(
                                'rounded-full w-6 h-6 flex items-center justify-center shrink-0',
                                task.status === 'complete' && !disabled
                                  ? 'border-green-500 border-2'
                                  : ''
                              )}
                            >
                              {task.status === 'complete' && !disabled ? (
                                <CheckIcon className="h-4 w-4 text-green-500 stroke-3" />
                              ) : (
                                <Circle className="h-6 w-6 text-primary-700" />
                              )}
                            </div>
                            <span
                              className={cn(
                                'text-sm flex-1 min-w-0 whitespace-normal break-words leading-5',
                                task.status === 'complete' && !disabled
                                  ? 'text-green-600'
                                  : phaseIndex === 0 && taskIndex === 0
                                    ? 'text-[#1e40af]'
                                    : 'text-gray-600'
                              )}
                            >
                              {phaseIndex + 1}.{taskIndex + 1}. {task.title}
                            </span>
                          </div>
                          {task.status === 'complete' && !disabled && (
                            <div className="ml-2 flex shrink-0 items-center gap-2 self-start">
                              {task['task_output'] ? (
                                <button
                                  className="p-2 text-primary-600 hover:bg-gray-100 rounded-full"
                                  aria-label="View details"
                                  onClick={(e) =>
                                    handleViewDetails(e, phaseIndex, taskIndex)
                                  }
                                >
                                  <Eye className="h-5 w-5" />
                                </button>
                              ) : null}

                              {get(task, 'cli_command_output', []).length >
                              0 ? (
                                <button
                                  className="p-2 text-primary-600 hover:bg-gray-100 rounded-full"
                                  aria-label="Download"
                                  onClick={(e) =>
                                    handleDownload(e, phaseIndex, taskIndex)
                                  }
                                >
                                  <Download className="h-5 w-5" />
                                </button>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedTask && (
        <TaskModal
          isOpen={modalOpen}
          onOpenChange={setModalOpen}
          task={{
            title: plan[selectedTask.phase].tasks[selectedTask.task].title,
            output:
              plan[selectedTask.phase]?.tasks[selectedTask.task]?.task_output,
            terminal:
              plan[selectedTask.phase]?.tasks[selectedTask.task]
                ?.cli_command_output,
          }}
          initialTab={initialTab}
        />
      )}

      <div key={currentPhase} className="py-2 bg-white fade-in">
        <h3 className="text-lg font-medium mb-2 text-primary-800">
          {plan[currentPhase]?.tasks[currentTask]?.title}
        </h3>
        {/* <p className="text-gray-600">
          {plan[currentPhase]?.tasks[currentTask]?.description}
        </p> */}
        <AgentMarkdown className="space-y-4">
          {/* {plan[currentPhase]?.tasks[currentTask]?.userExplanation.join('\n')}
           */}
          {(() => {
            const task = plan[currentPhase]?.tasks[currentTask];
            const userExplanation = Array.isArray(task?.userExplanation)
              ? task.userExplanation.join('\n\n')
              : task?.userExplanation;
            const description = Array.isArray(task?.description)
              ? task.description.join('\n\n')
              : task?.description;
            return userExplanation || description || '';
          })()}
        </AgentMarkdown>
      </div>
    </div>
  );
};

// Compact Header Bar component for minimized state
const CompactHeaderBar = ({
  plan,
  state,
  currentPhase,
  currentTask,
  selectTask,
  chatRefs,
  setIsTaskPanelMinimized,
  formatText,
  resetPlan,
  executeTask,
  initialLoading,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const handleViewDetails = (phaseIndex, taskIndex) => {
    setSelectedTask({ phase: phaseIndex, task: taskIndex });
    setModalOpen(true);
  };

  return (
    <>
      <div className="bg-white border-b px-4 py-2 flex items-center gap-2 shrink-0">
        {/* Expand Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-500 hover:text-gray-700 shrink-0"
          onClick={() => setIsTaskPanelMinimized(false)}
          title="Expand panel"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>

        {/* Task Dropdown */}
        <CompactPhaseSelect
          plan={state.plan}
          currentPhase={state.currentPhase}
          currentTask={state.currentTask}
          onTaskSelect={(phaseIndex, taskIndex) => {
            selectTask(phaseIndex, taskIndex);
            const selectedTaskItem = state.plan[phaseIndex]?.tasks[taskIndex];
            if (selectedTaskItem) {
              const chatIndex = state.queries.findIndex(
                (query) =>
                  query?.startsWith('Execute Task Plan for:') &&
                  query.includes(selectedTaskItem.title)
              );
              if (chatIndex !== -1 && chatRefs.current[chatIndex]) {
                chatRefs.current[chatIndex].scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                });
              }
            }
          }}
          onViewDetails={handleViewDetails}
        />

        {/* Navigation + Status + Actions - pushed to right */}
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-[8px]"
            onClick={() => {
              if (currentPhase === 0 && currentTask === 0) return;
              if (currentTask === 0) {
                selectTask(currentPhase - 1, plan[currentPhase - 1].tasks.length - 1);
              } else {
                selectTask(currentPhase, currentTask - 1);
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-[8px]"
            onClick={() => {
              if (currentPhase === plan.length - 1 && currentTask === plan[currentPhase].tasks.length - 1) return;
              if (currentTask === plan[currentPhase].tasks.length - 1) {
                selectTask(currentPhase + 1, 0);
              } else {
                selectTask(currentPhase, currentTask + 1);
              }
            }}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>

          {/* Status Indicator - next to arrows */}
          {plan[currentPhase]?.tasks[currentTask]?.status !== 'not-run' && (
            <div
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-sm',
                state.loading ? 'bg-primary-50' : 
                plan[currentPhase]?.tasks[currentTask]?.status === 'complete' ? 'bg-green-50' : 'bg-primary-50'
              )}
            >
              {state.loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-600" />
                  <span className="text-primary-600">
                    {formatText(plan[currentPhase]?.tasks[currentTask]?.status)}
                  </span>
                </>
              ) : plan[currentPhase]?.tasks[currentTask]?.status === 'complete' ? (
                <>
                  <Icons.checkCircle className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-green-600">Complete</span>
                </>
              ) : (
                <span className="text-primary-600">
                  {formatText(plan[currentPhase]?.tasks[currentTask]?.status)}
                </span>
              )}
            </div>
          )}

          {plan[currentPhase]?.tasks[currentTask]?.status !== 'not-run' && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-[8px] text-primary-600 hover:text-primary-700 hover:bg-primary-50"
              onClick={resetPlan}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          {plan[currentPhase]?.tasks[currentTask]?.status === 'not-run' && (
            <Button
              size="sm"
              onClick={executeTask}
              disabled={initialLoading}
            >
              Start Task
            </Button>
          )}
        </div>
      </div>

      {/* Task Details Modal */}
      {selectedTask && (
        <TaskModal
          isOpen={modalOpen}
          onOpenChange={setModalOpen}
          task={{
            title: plan[selectedTask.phase]?.tasks[selectedTask.task]?.title,
            output: plan[selectedTask.phase]?.tasks[selectedTask.task]?.task_output,
            terminal: plan[selectedTask.phase]?.tasks[selectedTask.task]?.cli_command_output,
          }}
          initialTab="output"
        />
      )}
    </>
  );
};

// Compact version of PhaseSelect for the minimized header bar
const CompactPhaseSelect = ({ plan, onTaskSelect, currentTask, currentPhase, onViewDetails }) => {
  const [isOpen, setIsOpen] = useState(false);

  const isTaskComplete = (phaseIndex, taskIndex) => {
    return plan[phaseIndex]?.tasks[taskIndex]?.status === 'complete';
  };

  const isTaskDisabled = (phaseIndex, taskIndex) => {
    const task = plan[phaseIndex]?.tasks[taskIndex];
    if (!task) return true;

    if (task.depends_on && task.depends_on.length > 0) {
      return task.depends_on.some((taskId) => {
        for (let p = 0; p <= phaseIndex; p++) {
          const dependentTaskIndex = plan[p].tasks.findIndex((t) => t.id === taskId);
          if (dependentTaskIndex !== -1) {
            if (isTaskDisabled(p, dependentTaskIndex) || !isTaskComplete(p, dependentTaskIndex)) {
              return true;
            }
          }
        }
        return false;
      });
    }
    return false;
  };

  const handleTaskClick = (phaseIndex, taskIndex) => {
    if (!isTaskDisabled(phaseIndex, taskIndex)) {
      onTaskSelect?.(phaseIndex, taskIndex);
      setIsOpen(false);
    }
  };

  const handleViewDetails = (e, phaseIndex, taskIndex) => {
    e.stopPropagation();
    onViewDetails?.(phaseIndex, taskIndex);
  };

  const currentTaskTitle = plan[currentPhase]?.tasks[currentTask]?.title;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="min-w-[200px] max-w-[400px] justify-between text-left font-normal h-9"
        >
          <span className="truncate">
            {currentPhase + 1}.{currentTask + 1}. {currentTaskTitle}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto min-w-[500px] max-w-[700px] p-0 bg-white" align="start">
        <ScrollArea className="h-[300px]">
          <div className="p-2">
            {plan.map((phase, phaseIndex) => (
              <div key={phaseIndex} className="mb-2">
                <div className="text-sm font-medium text-gray-500 px-2 py-1">
                  {phaseIndex + 1}. {phase.title}
                </div>
                {phase.tasks.map((task, taskIndex) => {
                  const disabled = isTaskDisabled(phaseIndex, taskIndex);
                  const isSelected = currentPhase === phaseIndex && currentTask === taskIndex;

                  return (
                    <div
                      key={taskIndex}
                      onClick={() => handleTaskClick(phaseIndex, taskIndex)}
                      className={cn(
                        'flex items-start gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer',
                        !disabled && 'hover:bg-gray-100',
                        disabled && 'opacity-50 cursor-not-allowed',
                        isSelected && 'bg-primary-50'
                      )}
                    >
                      {task.status === 'complete' && !disabled ? (
                        <CheckIcon className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-gray-400 shrink-0" />
                      )}
                      <span
                        className={cn(
                          'flex-1 min-w-0 whitespace-normal break-words leading-5',
                          task.status === 'complete' && !disabled
                            ? 'text-green-600'
                            : 'text-gray-700'
                        )}
                      >
                        {phaseIndex + 1}.{taskIndex + 1}. {task.title}
                      </span>
                      <div className="ml-2 flex shrink-0 items-center gap-1 self-start">
                        {task.status === 'complete' && !disabled && task['task_output'] && (
                          <button
                            className="p-1 text-primary-600 hover:bg-gray-100 rounded-full shrink-0"
                            aria-label="View details"
                            onClick={(e) => handleViewDetails(e, phaseIndex, taskIndex)}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary-600 shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

const TaskModal = ({ isOpen, onOpenChange, task, initialTab = 'output' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px] p-0 bg-white">
        <DialogHeader className="p-6 pb-0 flex-row justify-between items-center">
          <DialogTitle>Details</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="w-fit mt-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        <div className="w-full">
          <div className="flex px-6">
            {task.output ? (
              <button
                onClick={() => setActiveTab('output')}
                className={cn(
                  'py-2 px-4 text-sm font-medium rounded-[8px]',
                  activeTab === 'output'
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-primary-300 hover:text-primary-600'
                )}
              >
                Task Output
              </button>
            ) : null}
            {task?.terminal && task?.terminal.length > 0 ? (
              <button
                onClick={() => setActiveTab('terminal')}
                className={cn(
                  'py-2 px-4 text-sm font-medium',
                  activeTab === 'terminal'
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-primary-300 hover:text-primary-600'
                )}
              >
                Terminal
              </button>
            ) : null}
          </div>
          {activeTab === 'output' && (
            <ScrollArea className="h-[400px] p-6">
              <div className="space-y-4 border rounded-[8px] p-3">
                <h3 className="font-medium text-lg">Task Output</h3>
                <div className="text-gray-600">
                  <AgentMarkdown variant="compact">
                    {task.output || ''}
                  </AgentMarkdown>
                </div>
              </div>
            </ScrollArea>
          )}
          {activeTab === 'terminal' && (
            <div className="flex flex-col h-[500px] px-6 pb-6">
              <div className="flex-1 min-h-0 bg-primary-900 text-white rounded-lg overflow-hidden">
                <div className="h-full overflow-y-auto terminal-scrollbar p-4">
                  <div className="font-mono text-sm border border-gray-800 rounded-[8px] p-2">
                    {task.terminal.map((cmd, index) => {
                      const formatCommand = (command) => {
                        if (!command || typeof command !== 'string') {
                          return <span className="text-red-400">[Invalid command]</span>;
                        }
                        return command.split(' ').map((part, i) => (
                          <span
                            key={i}
                            className={
                              part.startsWith('aws')
                                ? 'text-primary-400'
                                : part.startsWith('--')
                                  ? 'text-yellow-400'
                                  : ''
                            }
                          >
                            {part}{' '}
                          </span>
                        ));
                      };

                      const normalizeOutput = (output) => {
                        if (typeof output === 'string') {
                          return output;
                        }
                        if (typeof output === 'object' && output !== null) {
                          if ('output' in output) {
                            const normalized = normalizeOutput(output.output);
                            if (output.statusCode !== undefined && output.statusCode !== 0) {
                              return `[Exit code: ${output.statusCode}]\n${normalized}`;
                            }
                            return normalized;
                          }
                          if ('stdout' in output || 'stderr' in output) {
                            let result = '';
                            if (output.stdout) result += output.stdout;
                            if (output.stderr) result += (result ? '\n' : '') + output.stderr;
                            if (output.exitCode !== undefined && output.exitCode !== 0) {
                              result += (result ? '\n' : '') + `[Exit code: ${output.exitCode}]`;
                            }
                            return result || '[No output]';
                          }
                          return JSON.stringify(output, null, 2);
                        }
                        return String(output || '[No output]');
                      };

                      const normalizedOutput = normalizeOutput(cmd.output);

                      return (
                        <React.Fragment key={index}>
                          <p className="flex items-start">
                            <span className="text-green-400 mr-2">$</span>
                            <span>{formatCommand(cmd.command)}</span>
                          </p>
                          <pre className="whitespace-pre-wrap break-words text-[#b0b0b0] pl-4">
                            {normalizedOutput}
                          </pre>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const LoadingDots = () => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return <span style={{ marginLeft: '5px' }}>{dots}</span>;
};

const getActionMessage = (actionName) => {
  const messageMap = {
    aws_knoweldge_base: 'Looking up AWS knowledge base',
    aws_environment_connector: 'Searching AWS environment details',
    cli_documentation: 'Looking up AWS CLI documentation',
    cfn_template: 'Looking up AWS CloudFormation documentation',
    platform_help: 'Looking up platform documentation',
    execute_cli_command: 'Running cloud CLI command',
    cli_session_command_execute: 'Running cloud CLI command',
    aws_cfn_operations: 'Calling AWS CloudFormation',
    answer: '',
  };

  return messageMap[actionName] || actionName;
};

const DynamicFormComponent = ({
  inputString,
  mostRecentBlock,
  taskStatus,
  handleSubmitFormAnswers,
  isFullScreen,
  toggleFullscreen,
  setMainState,
  mainState,
  handleAgentChat,
  onFormChange,
  hideSubmitButton,
}) => {
  const [state, setState] = useState(() => {
    const inputFieldRegex = /__input_field__(.*?)__input_field_end__/gs;
    let initialState = {
      activeFields: [],
    };

    if (!inputString) return initialState;

    let inputFieldMatches = [...inputString.matchAll(inputFieldRegex)];
    inputFieldMatches.forEach((match) => {
      const jsonContent = match[1].trim();
      try {
        const fieldProps = JSON.parse(jsonContent);
        const { label, fieldType, default_value } = fieldProps;
        const stateName = label.replace(/\s+/g, '_').toLowerCase();

        initialState[stateName] = default_value ? default_value : '';

        if (default_value) {
          initialState['activeFields'].push(stateName);
        } else if (fieldType === 'checkbox') {
          initialState['activeFields'].push(stateName);
          initialState[stateName] = default_value ? default_value : false;
        }
      } catch (error) {
        console.error('Invalid JSON:', jsonContent);
      }
    });

    return initialState;
  });

  const formatLabelToStateName = (label) => {
    return label.replace(/\s+/g, '_').toLowerCase();
  };

  const handleInputChange = (e) => {
    const name = e.target.name;
    const value = e.target.value;
    setState((prev) => {
      const newState = {
        ...prev,
        [name]: value,
        activeFields:
          value !== ''
            ? [...new Set([...prev.activeFields, name])]
            : prev.activeFields.filter((f) => f !== name),
      };

      if (onFormChange) {
        const answers = Object.fromEntries(
          Object.entries(newState).filter(([key]) =>
            newState.activeFields.includes(key)
          )
        );
        onFormChange(answers);
      }

      return newState;
    });
  };

  const handleCheckboxChange = (checked, name) => {
    setState((prev) => {
      const newState = {
        ...prev,
        [name]: checked,
        activeFields: [...new Set([...prev.activeFields, name])],
      };

      if (onFormChange) {
        const answers = Object.fromEntries(
          Object.entries(newState).filter(([key]) =>
            newState.activeFields.includes(key)
          )
        );
        onFormChange(answers);
      }

      return newState;
    });
  };

  const handleRadioChange = (value, name) => {
    setState((prev) => {
      const newState = {
        ...prev,
        [name]: value,
        activeFields: [...new Set([...prev.activeFields, name])],
      };

      if (onFormChange) {
        const answers = Object.fromEntries(
          Object.entries(newState).filter(([key]) =>
            newState.activeFields.includes(key)
          )
        );
        onFormChange(answers);
      }

      return newState;
    });
  };

  if (!inputString || inputString.length === 0) return null;

  const inputFieldRegex = /__input_field__(.*?)__input_field_end__/gs;
  let lastIndex = 0;
  let finalOutput = [];
  let inputFieldMatches = inputString
    ? [...inputString.matchAll(inputFieldRegex)]
    : [];

  inputFieldMatches.forEach((match, matchIndex) => {
    finalOutput.push(
      <AgentMarkdown key={`before-input-${matchIndex}`}>
        {inputString.substring(lastIndex, match.index)}
      </AgentMarkdown>
    );

    const jsonContent = match[1].trim();
    let fieldProps;

    try {
      fieldProps = JSON.parse(jsonContent);
    } catch (error) {
      console.error('Invalid JSON:', jsonContent);
      finalOutput.push(
        <div key={`error-${matchIndex}`}>Invalid field configuration</div>
      );
      lastIndex = match.index + match[0].length;
      return;
    }

    const {
      fieldType,
      label,
      options,
      default_value,
      allow_multiple_selection,
    } = fieldProps;
    const stateName = formatLabelToStateName(label);

    let control;
    switch (fieldType) {
      case 'input':
        control = (
          <div key={`field-${matchIndex}`} className="flex flex-col space-y-2">
            <Label htmlFor={stateName}>{label}</Label>
            <Input
              id={stateName}
              name={stateName}
              defaultValue={default_value}
              onChange={handleInputChange}
              className="font-bold text-lg"
            />
          </div>
        );
        break;

      case 'input_select':
        if (allow_multiple_selection) {
          let selectedValues = [];
          try {
            if (state[stateName]) {
              selectedValues = state[stateName].split(',').filter(Boolean);
            }
          } catch (error) {
            console.error('Error parsing selected values:', error);
          }
          control = (
            <div
              key={`field-${matchIndex}`}
              className="flex flex-col space-y-2"
            >
              <Label>{label}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {!selectedValues || selectedValues.length === 0
                      ? label
                      : `${selectedValues.length} selected`}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-white z-[9999]">
                  <Command>
                    <CommandInput
                      placeholder={`Search ${label.toLowerCase()}...`}
                    />
                    <CommandList>
                      <CommandEmpty>
                        No {label.toLowerCase()} found.
                      </CommandEmpty>
                      <CommandGroup>
                        {(options || []).map((option) => (
                          <CommandItem
                            key={option.label}
                            onSelect={() => {
                              const value = option.label;
                              const newValues = selectedValues.includes(value)
                                ? selectedValues.filter((v) => v !== value)
                                : [...(selectedValues || []), value];

                              handleInputChange({
                                target: {
                                  name: stateName,
                                  value: newValues.join(','),
                                },
                              });
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedValues?.includes(option.label)
                                  ? 'opacity-100'
                                  : 'opacity-0'
                              )}
                            />
                            {option.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedValues && selectedValues.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {selectedValues.map((value) => (
                    <Badge
                      key={value}
                      variant="secondary"
                      className="mr-1 mb-1"
                    >
                      {value}
                      <button
                        className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          const newValues = selectedValues.filter(
                            (v) => v !== value
                          );
                          handleInputChange({
                            target: {
                              name: stateName,
                              value: newValues.join(','),
                            },
                          });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          );
        } else {
          control = (
            <div
              key={`field-${matchIndex}`}
              className="flex flex-col space-y-2"
            >
              <Label>{label}</Label>
              <Select
                onValueChange={(value) =>
                  handleInputChange({ target: { name: stateName, value } })
                }
                defaultValue={default_value}
              >
                <SelectTrigger>
                  <SelectValue placeholder={label} />
                </SelectTrigger>
                <SelectContent className="bg-white z-[200]">
                  {options.map((option) => (
                    <SelectItem key={option.label} value={option.label}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }
        break;

      case 'checkbox':
        control = (
          <div
            key={`field-${matchIndex}`}
            className="flex items-center space-x-2"
          >
            <Checkbox
              id={stateName}
              defaultChecked={default_value}
              onCheckedChange={(checked) =>
                handleCheckboxChange(checked, stateName)
              }
            />
            <Label htmlFor={stateName}>{label}</Label>
          </div>
        );
        break;

      case 'radio_group':
        control = (
          <div key={`field-${matchIndex}`} className="flex flex-col space-y-2">
            <Label className="font-bold">{label}</Label>
            <RadioGroup
              onValueChange={(value) => handleRadioChange(value, stateName)}
              defaultValue={state[stateName]}
              className="flex flex-col space-y-2"
            >
              {options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={option.label}
                    id={`${stateName}-${index}`}
                  />
                  <Label htmlFor={`${stateName}-${index}`}>
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
        break;

      default:
        control = (
          <Input
            key={`field-${matchIndex}`}
            name={stateName}
            label={label}
            defaultValue={default_value}
            onChange={handleInputChange}
            className="font-bold text-lg"
          />
        );
    }

    finalOutput.push(control);
    lastIndex = match.index + match[0].length;
  });

  finalOutput.push(
    <AgentMarkdown key="remaining-text">
      {inputString.substring(lastIndex)}
    </AgentMarkdown>
  );

  // Show submit button if:
  // 1. Has input fields AND
  // 2. Not explicitly hidden AND
  // 3. Either: it's the most recent block OR the task is waiting on user input
  const shouldShowSubmitButton = 
    inputFieldMatches.length > 0 && 
    !hideSubmitButton && 
    (mostRecentBlock || taskStatus === 'waiting_on_user_input');
  
  const submitButton =
    shouldShowSubmitButton ? (
      <div
        className="sticky bottom-0 bg-white p-4 border-t mt-4"
        key="submit-button"
      >
        <Button
          onClick={() => {
            const answers = Object.fromEntries(
              Object.entries(state).filter(([key]) =>
                state.activeFields.includes(key)
              )
            );
            handleSubmitFormAnswers(answers);
            if (isFullScreen && toggleFullscreen) toggleFullscreen();
          }}
          className="w-full text-lg"
        >
          Submit Answers
        </Button>
      </div>
    ) : null;

  return inputFieldMatches.length > 0 ? (
    <div
      className={`flex flex-col h-full ${
        isFullScreen ? 'max-h-full' : 'max-h-[calc(100vh-30rem)]'
      }`}
    >
      <div className="flex-1 overflow-y-auto pr-4">
        {/* <div className="flex-1 pr-4"> */}
        <form className="text-lg space-y-4">{finalOutput}</form>
      </div>
      {submitButton}
      {mainState && isFullScreen && (
        <div className="flex border rounded-lg overflow-hidden p-2 mt-8">
          <div className="flex-1">
            <Input
              value={mainState.followupPrompt}
              onChange={(e) =>
                setMainState((prev) => ({
                  ...prev,
                  followupPrompt: e.target.value,
                }))
              }
              placeholder="Chat with agent..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAgentChat();
                  toggleFullscreen();
                }
              }}
              className="border-0 focus-visible:ring-0"
            />
          </div>
          <Button
            onClick={() => {
              handleAgentChat();
              toggleFullscreen();
            }}
          >
            Send
          </Button>
        </div>
      )}
    </div>
  ) : (
    <div className="text-[16px] text-primary-800 pr-6">{finalOutput}</div>
  );
};

const TerminalComponent = ({ commands }) => {
  const scrollToBottom = () => {
    const container = document.getElementById('terminal-scroll-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [commands]);

  const formatCommand = (command) => {
    if (!command || typeof command !== 'string') {
      console.warn('[TerminalComponent] Invalid command format:', command);
      return <span className="text-red-400">[Invalid command]</span>;
    }
    return command.split(' ').map((part, i) => (
      <span
        key={i}
        className={
          part.startsWith('aws')
            ? 'text-primary-400'
            : part.startsWith('--')
              ? 'text-yellow-400'
              : ''
        }
      >
        {part}{' '}
      </span>
    ));
  };

  const renderStatusLines = (text) => {
    const lines = String(text || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return null;
    return (
      <div className="space-y-1">
        {lines.map((line, index) => {
          const lower = line.toLowerCase();
          const isRunning = lower.startsWith('[running]');
          const isCompleted = lower.startsWith('[completed]');
          const isError = lower.startsWith('[error]') || lower.startsWith('error:');
          return (
            <div
              key={`${line}-${index}`}
              className={cn(
                'inline-flex w-fit rounded px-2 py-0.5 text-xs font-semibold',
                isRunning && 'bg-blue-500/15 text-blue-200',
                isCompleted && 'bg-emerald-500/15 text-emerald-200',
                isError && 'bg-red-500/15 text-red-200',
                !isRunning && !isCompleted && !isError && 'bg-gray-700 text-gray-200'
              )}
            >
              {line}
            </div>
          );
        })}
      </div>
    );
  };

  const splitTerminalOutput = (output) => {
    const text = String(output || '').trim();
    if (!text) return { status: '', output: '', error: '' };
    const outputIndex = text.indexOf('\nOutput:\n');
    const errorIndex = text.indexOf('\nError:\n');
    const firstSectionIndex = [outputIndex, errorIndex]
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0];

    if (firstSectionIndex == null) {
      if (/^\[(running|completed|error)\]/i.test(text)) {
        return { status: text, output: '', error: '' };
      }
      return { status: '', output: text, error: '' };
    }

    const status = text.slice(0, firstSectionIndex).trim();
    const body = text.slice(firstSectionIndex + 1);
    const outputMarker = 'Output:\n';
    const errorMarker = 'Error:\n';
    const outputStart = body.indexOf(outputMarker);
    const errorStart = body.indexOf(errorMarker);
    let outputText = '';
    let errorText = '';

    if (outputStart >= 0) {
      const start = outputStart + outputMarker.length;
      const end = errorStart > outputStart ? errorStart : body.length;
      outputText = body.slice(start, end).trim();
    }
    if (errorStart >= 0) {
      const start = errorStart + errorMarker.length;
      const end = outputStart > errorStart ? outputStart : body.length;
      errorText = body.slice(start, end).trim();
    }

    return { status, output: outputText, error: errorText };
  };

  const renderOutputBlock = (label, value, tone = 'neutral') => {
    if (!value) return null;
    return (
      <div
        className={cn(
          'mt-2 rounded-md border p-3',
          tone === 'error'
            ? 'border-red-500/30 bg-red-950/30'
            : 'border-gray-700 bg-gray-950/60'
        )}
      >
        <div
          className={cn(
            'mb-2 text-[10px] font-semibold uppercase tracking-wide',
            tone === 'error' ? 'text-red-300' : 'text-primary-250'
          )}
        >
          {label}
        </div>
        <pre
          className={cn(
            'whitespace-pre-wrap break-words text-xs leading-relaxed',
            tone === 'error' ? 'text-red-100' : 'text-[#d6d6d6]'
          )}
        >
          {value}
        </pre>
      </div>
    );
  };

  // Normalize output format - handle both string and object formats
  const normalizeOutput = (output) => {
    // If it's already a string, return it
    if (typeof output === 'string') {
      return output;
    }

    // If it's an object with {statusCode, output} structure
    if (typeof output === 'object' && output !== null) {
      // Check if it has the expected structure
      if ('output' in output) {
        // Recursively normalize in case output itself is nested
        const normalized = normalizeOutput(output.output);
        // Optionally prepend status code if non-zero
        if (output.statusCode !== undefined && output.statusCode !== 0) {
          return `[Exit code: ${output.statusCode}]\n${normalized}`;
        }
        return normalized;
      }
      
      // If it has stdout/stderr structure
      if ('stdout' in output || 'stderr' in output) {
        let result = '';
        if (output.stdout) result += output.stdout;
        if (output.stderr) result += (result ? '\n' : '') + output.stderr;
        if (output.exitCode !== undefined && output.exitCode !== 0) {
          result += (result ? '\n' : '') + `[Exit code: ${output.exitCode}]`;
        }
        return result || '[No output]';
      }

      // Fallback: stringify the object
      console.warn('[TerminalComponent] Unexpected output object format, stringifying:', output);
      return JSON.stringify(output, null, 2);
    }

    // Fallback for other types
    console.warn('[TerminalComponent] Unexpected output type:', typeof output, output);
    return String(output || '[No output]');
  };

  return (
    <div
      id="terminal-scroll-container"
      className="flex-1 p-4 overflow-y-auto max-h-[calc(100vh-7.5rem)] terminal-scrollbar"
    >
      <div className="font-mono text-sm border border-gray-800 rounded-[8px] p-2">
        {commands.map((cmd, index) => {
          const normalizedOutput = normalizeOutput(cmd.output);
          const { status, output, error } = splitTerminalOutput(normalizedOutput);
          const sourceLabel = String(cmd.source || '').startsWith('mcp')
            ? 'CloudAgent MCP'
            : cmd.source === 'codex'
              ? 'Codex'
              : 'Command';
          return (
            <div key={index} className="mb-4 rounded-lg border border-gray-800 bg-primary-950/30 p-3 last:mb-0">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="rounded bg-gray-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-300">
                  {sourceLabel}
                </span>
              </div>
              <div className="rounded-md border border-emerald-500/25 bg-emerald-950/20 p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                  Command
                </div>
                <p className="flex items-start text-sm">
                  <span className="text-green-400 mr-2">$</span>
                  <span>{formatCommand(cmd.command)}</span>
                </p>
              </div>
              <div className="mt-2">{renderStatusLines(status)}</div>
              {renderOutputBlock('Output', output)}
              {renderOutputBlock('Error', error, 'error')}
              {!output && !error && !status ? renderOutputBlock('Output', '[No output]') : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CloudFormationOperationsPanel = ({ operations, onRefresh, refreshSchedule, refreshTick }) => (
  <div className="flex-1 p-4 overflow-y-auto max-h-[calc(100vh-7.5rem)] terminal-scrollbar">
    <div className="space-y-3">
      {operations.map((operation, index) => {
        const operationKey = getCloudFormationOperationKey(operation);
        const nextRefreshAt = refreshSchedule?.[operationKey] || null;
        const remainingSeconds = nextRefreshAt
          ? Math.max(0, Math.ceil((nextRefreshAt - refreshTick) / 1000))
          : null;

        return (
          <CloudFormationOperationCard
            key={
              operation?.cardId ||
              [
                operation?.stackId || operation?.stackName || 'stack',
                operation?.changeSetId || 'no-change-set',
                operation?.status || operation?.statusKind || index,
              ].join('::')
            }
            payload={{
              ...operation,
              title: operation?.title || 'CloudFormation Deployment',
              autoRefreshLabel:
                isCloudFormationRefreshable(operation) && remainingSeconds != null
                  ? `Auto-refresh in ${remainingSeconds}s`
                  : null,
            }}
            surface="panel"
            actions={
              operation?.stackId || operation?.stackName
                ? [
                    {
                      label: 'Refresh now',
                      intent: 'check_cloudformation_status',
                      payload: operation,
                    },
                  ]
                : []
            }
            onAction={(action) => onRefresh?.(action?.payload || operation, { source: 'manual' })}
          />
        );
      })}
    </div>
  </div>
);

const GithubOperationsPanel = ({ operations, onConfirmMerge, onReportIssue }) => (
  <div className="flex-1 p-4 overflow-y-auto max-h-[calc(100vh-7.5rem)] terminal-scrollbar">
    <div className="space-y-3">
      {operations.map((operation, index) => (
        <GithubOperationCard
          key={
            operation?.cardId ||
            [
              operation?.sourceTool || 'github',
              operation?.repoFullName || 'repo',
              operation?.path || operation?.branch || operation?.pullRequestNumber || index,
            ].join('::')
          }
          payload={operation}
          surface="panel"
          actions={
            operation?.sourceTool === 'create_github_pull_request' &&
            String(operation?.statusKind || '').toLowerCase() === 'completed'
              ? [
                  {
                    label: 'Confirm merged',
                    intent: 'confirm_github_pr_merged',
                  },
                  {
                    label: 'Report issue',
                    intent: 'report_github_pr_issue',
                  },
                ]
              : []
          }
          onAction={(action) => {
            if (action?.intent === 'confirm_github_pr_merged') {
              onConfirmMerge?.(operation);
              return;
            }
            if (action?.intent === 'report_github_pr_issue') {
              onReportIssue?.(operation);
            }
          }}
        />
      ))}
    </div>
  </div>
);

const formatText = (text) => {
  return text
    ? text
        .split(/[-_]/)
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(' ')
    : '';
};

function normalizeMarkdownContent(value) {
  if (value == null) return '';

  let normalized = String(value).replace(/\r\n?/g, '\n');
  const shouldDecodeEscapes =
    /\\[nrt]/.test(normalized) &&
    (!normalized.includes('\n') || /```[^\n`]*\\n/.test(normalized));

  if (shouldDecodeEscapes) {
    normalized = normalized
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
  }

  return normalized;
}

const AgentMarkdownCode = ({ className, children, ...props }) => {
  const isBlockCode = typeof className === 'string' && className.includes('lang-');

  return (
    <code
      {...props}
      className={cn(
        'font-mono text-[13px] text-gray-800',
        isBlockCode
          ? 'block whitespace-pre-wrap break-words bg-transparent px-0 py-0'
          : 'rounded bg-gray-100 px-1 py-0.5',
        className
      )}
    >
      {children}
    </code>
  );
};

const AgentMarkdownPre = ({ className, children, ...props }) => (
  <pre
    {...props}
    className={cn(
      'mb-3 overflow-x-auto rounded-md border border-gray-200 bg-gray-50 p-3 whitespace-pre-wrap break-words',
      className
    )}
  >
    {children}
  </pre>
);

function getAgentMarkdownOptions(variant = 'default') {
  if (variant === 'compact') {
    return {
      overrides: {
        h1: { props: { className: 'text-xl font-semibold my-3 text-gray-900' } },
        h2: { props: { className: 'text-lg font-semibold my-3 text-gray-900' } },
        h3: { props: { className: 'text-base font-semibold my-2 text-gray-800' } },
        p: { props: { className: 'text-sm text-gray-700 mb-2 whitespace-pre-wrap' } },
        ul: { props: { className: 'list-disc pl-5 space-y-1 text-gray-700 mb-2' } },
        ol: { props: { className: 'list-decimal pl-5 space-y-1 text-gray-700 mb-2' } },
        li: { props: { className: 'text-sm text-gray-700' } },
        code: { component: AgentMarkdownCode },
        pre: { component: AgentMarkdownPre },
        a: { props: { className: 'text-primary-600 hover:underline', target: '_blank' } },
      },
    };
  }

  return {
    overrides: {
      h1: { props: { className: 'text-2xl font-bold my-6 text-primary-800' } },
      h2: { props: { className: 'text-xl font-medium my-5 text-primary-800' } },
      h3: { props: { className: 'text-lg font-medium my-4 text-primary-800' } },
      h4: { props: { className: 'text-base font-medium my-3 text-primary-800' } },
      h5: { props: { className: 'text-sm font-medium my-2 text-primary-800' } },
      h6: { props: { className: 'text-xs font-medium my-2 text-primary-800' } },
      p: { props: { className: 'text-gray-600 pb-1 whitespace-pre-wrap' } },
      div: { props: { className: 'space-y-4' } },
      ul: { props: { className: 'list-disc pl-6 space-y-2 text-gray-600' } },
      ol: { props: { className: 'list-decimal pl-6 space-y-2 text-gray-600' } },
      li: { props: { className: 'text-gray-600' } },
      code: { component: AgentMarkdownCode },
      pre: { component: AgentMarkdownPre },
      a: { props: { className: 'text-primary-600 hover:underline', target: '_blank' } },
    },
  };
}

const AgentMarkdown = ({ children, className, variant = 'default' }) => (
  <Markdown className={className} options={getAgentMarkdownOptions(variant)}>
    {normalizeMarkdownContent(children)}
  </Markdown>
);

const updateTaskStatusAtIndex = (plan, phaseIndex, taskIndex, status) => {
  if (
    !Array.isArray(plan) ||
    phaseIndex === undefined ||
    taskIndex === undefined ||
    phaseIndex < 0 ||
    taskIndex < 0
  ) {
    return plan;
  }

  const phase = plan[phaseIndex];
  if (!phase || !Array.isArray(phase.tasks) || !phase.tasks[taskIndex]) {
    return plan;
  }

  const updatedPlan = [...plan];
  const updatedTasks = [...phase.tasks];
  updatedTasks[taskIndex] = {
    ...updatedTasks[taskIndex],
    status,
  };

  updatedPlan[phaseIndex] = {
    ...phase,
    tasks: updatedTasks,
  };

  return updatedPlan;
};

const buildAgentErrorState = (prevState, { code, message }) => {
  const updatedPlan = updateTaskStatusAtIndex(
    prevState.plan,
    prevState.currentPhase,
    prevState.currentTask,
    'error'
  );

  return {
    ...prevState,
    plan: updatedPlan,
    loading: false,
    responseError: code || 'API_ERROR',
    responseErrorMessage:
      message || 'The agent reported an error while processing your request.',
  };
};

const PREP_PHASE_LABELS = {
  review_environment_settings: 'Reviewing environment settings',
  analyze_blueprint_intent: 'Analyzing blueprint intent',
  match_target_scope: 'Matching target scope',
  resolve_delivery_path: 'Resolving delivery path',
  resolve_update_strategy: 'Resolving update strategy',
  resolve_create_vs_update: 'Resolving create vs update',
  confirm_analysis: 'Reviewing analysis outcomes',
  rewrite_blueprint: 'Rewriting blueprint',
  validate_rewrite: 'Validating rewritten blueprint',
};

const getPreflightPhaseLabel = (phase) =>
  PREP_PHASE_LABELS[phase] ||
  String(phase || 'Preparation')
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const upsertPreflightPhaseStep = (steps, { phase, status, detail }) => {
  const nextSteps = Array.isArray(steps) ? [...steps] : [];
  const index = nextSteps.findIndex(
    (step) => step.kind === 'phase' && step.phase === phase
  );

  const step = {
    kind: 'phase',
    phase,
    title: getPreflightPhaseLabel(phase),
    status,
    detail: detail || '',
  };

  if (index >= 0) {
    nextSteps[index] = {
      ...nextSteps[index],
      ...step,
    };
    return nextSteps;
  }

  return [...nextSteps, step].slice(-10);
};

const appendPreflightStep = (steps, step) =>
  [...(Array.isArray(steps) ? steps : []), step].slice(-10);

const summarizePreflightRecommendation = (recommendation) => {
  if (!recommendation) return '';
  if (
    recommendation.status === 'recommended_workload' &&
    recommendation.topCandidate?.name
  ) {
    return `Suggested workload: ${recommendation.topCandidate.name}`;
  }
  if (recommendation.status === 'environment_scope_recommended') {
    return recommendation.reason || 'Environment-wide scope is recommended.';
  }
  return 'Preparation recommendation updated.';
};

const summarizePreflightDecision = (decision) => {
  if (!decision) return '';
  if (decision.label) return `Selected: ${decision.label}`;
  if (decision.selectedOptionId) return `Selected: ${decision.selectedOptionId}`;
  return 'Preparation decision applied.';
};

const DynamicFormWithModal = ({
  answer,
  handleSubmitFormAnswers,
  index,
  state,
  taskType,
  taskStatus,
  handleAgentChat,
  setState,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  const outerContainerClass = isFullscreen
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'
    : '';

  const innerContainerClass = isFullscreen
    ? 'relative bg-white p-4 rounded-lg w-1/2 h-[75vh] '
    : 'bg-white border shadow-[0px_4px_32px_0px_rgba(29,109,173,0.1)] rounded-tr-[8px] rounded-tl-[8px] rounded-br-[8px] p-4 w-fit border-primary-200 relative';

  return (
    <>
      <div className={outerContainerClass}>
        <div className={innerContainerClass}>
          <div className="absolute top-2 right-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
          {answer && (
            <DynamicFormComponent
              inputString={answer}
              resourceTables={null}
              handleSubmitFormAnswers={handleSubmitFormAnswers}
              mostRecentBlock={index === state.answers.length - 1}
              taskStatus={taskStatus}
              loading={
                state.loading &&
                state.actions.length > 0 &&
                state.actions.every((a) => a.completed)
              }
              isFullScreen={isFullscreen}
              toggleFullscreen={toggleFullscreen}
              handleAgentChat={handleAgentChat}
              setMainState={setState}
              mainState={state}
            />
          )}
        </div>
      </div>
    </>
  );
};

const TOOL_NAME_LABELS = {
  list_workloads: 'Getting workload details',
  update_workload: 'Updating workload',
  aws_cli_readonly: 'Reviewing AWS configuration',
  azure_cli_readonly: 'Reviewing Azure configuration',
  get_cloudformation_stacks: 'Reviewing CloudFormation stacks',
  get_cloudformation_stack_resources: 'Reviewing CloudFormation stack resources',
  aws_cfn_operations: 'Updating AWS configuration (CloudFormation)',
  architecture_templates: 'Architecture templates',
  finalize_operation_result: 'Finalizing',
  permission_profile_list: 'Listing permission profiles',
  permission_profile_validation: 'Validating permissions',
};

const parsePermissionAuthProfile = (value) => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) || {};
    } catch (_) {
      return {};
    }
  }
  return typeof value === 'object' ? value : {};
};

const parsePermissionDeploymentPreferences = (value) => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) || {};
    } catch (_) {
      return {};
    }
  }
  return typeof value === 'object' ? value : {};
};

const getDefaultRegionsForPermissionProfile = (profile) => {
  const deploymentPreferences = parsePermissionDeploymentPreferences(
    profile?.deploymentPreferences
  );
  const defaultRegions = Array.isArray(deploymentPreferences.defaultRegions)
    ? deploymentPreferences.defaultRegions
    : [];

  return Array.from(
    new Set(
      defaultRegions
        .map((region) =>
          typeof region === 'string' ? region.trim() : String(region || '').trim()
        )
        .filter(Boolean)
    )
  );
};

const matchesEnvironmentProvider = (profile, cloudProvider) => {
  if (!profile) return false;
  if (!cloudProvider) return true;

  const profileType = String(profile.type || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');
  const targetProvider = String(cloudProvider || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');

  if (targetProvider === 'aws') {
    return profileType === 'aws account' || !profileType;
  }

  if (targetProvider === 'azure') {
    return profileType === 'azure tenant' || profileType === 'azure subscription';
  }

  if (targetProvider === 'google workspace') {
    return profileType === 'google workspace';
  }

  return profileType === targetProvider;
};

const getAzureTenantIdFromAuthProfile = (authProfile = {}) =>
  authProfile.tenantId ||
  authProfile.azureTenantId ||
  authProfile.directoryTenantId ||
  authProfile.accountId ||
  '';

const getAzureSubscriptionIdFromAuthProfile = (authProfile = {}) =>
  authProfile.subscriptionId ||
  authProfile.azureSubscriptionId ||
  (Array.isArray(authProfile.subscriptionIds) ? authProfile.subscriptionIds[0] : authProfile.subscriptionIds) ||
  '';

const formatToolName = (name) => {
  if (!name) return '';
  const normalized = String(name).trim();
  if (!normalized) return '';
  const lookupKey = normalized.toLowerCase();
  if (TOOL_NAME_LABELS[lookupKey]) {
    return TOOL_NAME_LABELS[lookupKey];
  }
  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatStatusLabel = (status, fallback = '') => {
  if (!status) return fallback;
  const cleaned = String(status).replace(/[_-]+/g, ' ').trim();
  if (!cleaned) return fallback;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const formatValueForDisplay = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (_) {
    return String(value);
  }
};

const createToolEventUpserter = (setEvents) => (eventType, payload) => {
  if (!payload) return;

  setEvents((prevEvents) => {
    const events = [...prevEvents];
    const generateLocalId = () =>
      `tool-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    const identifier =
      payload.toolCallId ||
      payload.tool_call_id ||
      payload.callId ||
      payload.call_id ||
      payload.id ||
      payload.tool?.id ||
      generateLocalId();

    const rawName =
      payload.name ||
      payload.toolName ||
      payload.tool?.name ||
      payload.tool_type ||
      payload.type ||
      payload.action ||
      '';
    const rawStatus =
      payload.status || (eventType === 'tool_result' ? 'completed' : 'in_progress');
    const normalizedStatus = String(rawStatus).toLowerCase();
    const isErrored =
      ['failed', 'error', 'errored', 'rejected'].includes(normalizedStatus) ||
      !!payload.error;
    const isCompleted =
      (!isErrored &&
        ['completed', 'complete', 'success', 'succeeded', 'done', 'resolved'].includes(
          normalizedStatus
        )) ||
      eventType === 'tool_result';

    const nextEvent = {
      id: identifier,
      rawName,
      status: rawStatus,
      input: payload.input ?? null,
      output: payload.output ?? payload.content ?? payload.message ?? null,
      error: payload.error ?? null,
      isErrored,
      isCompleted,
    };

    const existingIndex = events.findIndex((event) => event.id === identifier);
    if (existingIndex >= 0) {
      events[existingIndex] = {
        ...events[existingIndex],
        ...nextEvent,
      };
    } else {
      events.push(nextEvent);
    }

    return events;
  });
};

const createEnvironmentSetupState = () => ({
  isPermissionsModalOpen: false,
  authProfile: {
    validated: false,
    authType: 'role',
    roleName: `CloudAgentAccessRole-${generateRandomString(6)}`,
    externalId: generateRandomString(6),
    accessKeyId: '',
    secretAccessKey: '',
    sessionToken: '',
    authProfileName: '',
  },
  accountId: '',
  globalSettings: {},
  planId: '',
  recordId: '',
  planDetails: null,
  title: '',
  inputSummary: '',
  requiredPermissions: {},
  prefillPermissionProfileId: null,
  prefillPermissionProfileName: null,
  isReconnecting: false,
  shouldAutocontinue: false,
});

const AUTO_WORKLOAD_VALUE = 'auto';

export const SettingsSummary = ({
  isOpen,
  onClose,
  onSubmit,
  defaultValues,
  inputSummary,
  isAgent = false,
  isWorkflow = false,
  isReport = false,
  planId,
  buttonText,
  isReconnecting = false,
  blueprintId = null,
  recordId = '',
  cloudProvider = 'aws', // Cloud provider type - 'aws', 'google_workspace', etc.
  showEnvironmentSelection = false,
  prefillPermissionProfileId = null,
  prefillPermissionProfileName = null,
  parentId = null,
  operationTitle = '',
  requiredPermissions = {},
  creditsCost = null,
  availableCredits = null,
  recommendationTarget = null,
  recommendationExecutionContext = null,
  externalRunHandler = false,
  children = null,
}) => {
  const dispatch = useDispatch();
  const location = useLocation();
  // Get blueprintRecordId from location.state as a fallback
  const blueprintRecordIdFromState = location.state?.recordId || '';
  const effectiveBlueprintId = blueprintId || planId || recordId || blueprintRecordIdFromState || '';

  const [runMode, setRunMode] = useState(
    isAgent || externalRunHandler ? 'interactive' : 'background'
  );
  const [formData, setFormData] = useState({
    select_aws_regions: defaultValues?.select_aws_regions || ['us-east-1'],
    proceed_with_default_values_without_prompt:
      defaultValues?.proceed_with_default_values_without_prompt || 'Yes',
    proceed_with_changes_without_confirmation:
      defaultValues?.proceed_with_changes_without_confirmation || 'No',
    additional_instructions: defaultValues?.additional_instructions || '',
    default_values: defaultValues?.default_values || {},
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [configurationMode, setConfigurationMode] = useState(
    defaultValues?.configuration_mode || 'auto-detect'
  );
  const [selectedWorkloadOrStack, setSelectedWorkloadOrStack] = useState(
    defaultValues?.selected_workload_or_stack || AUTO_WORKLOAD_VALUE
  );
  const [selectedPermissionProfileId, setSelectedPermissionProfileId] = useState('');
  const [validationStates, setValidationStates] = useState({});
  const [isValidatingPermissions, setIsValidatingPermissions] = useState(false);
  const [validationToolEvents, setValidationToolEvents] = useState([]);
  const [isValidationSummaryOpen, setIsValidationSummaryOpen] = useState(false);
  const [showUpdatePermissionsDetails, setShowUpdatePermissionsDetails] = useState(false);
  const [lastValidatedPermissionId, setLastValidatedPermissionId] = useState(null);
  const [temporaryAccess, setTemporaryAccess] = useState(false);
  const [selectedTime, setSelectedTime] = useState(24);
  const [isUpdatingPermissions, setIsUpdatingPermissions] = useState(false);
  const [updateSummary, setUpdateSummary] = useState({
    status: 'idle',
    success: null,
    message: '',
    reason: '',
    details: null,
  });
  const [updateToolEvents, setUpdateToolEvents] = useState([]);
  const [isUpdateProgressOpen, setIsUpdateProgressOpen] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [envDropdownOpen, setEnvDropdownOpen] = useState(false);
  const [selectedAzureSubscriptionIds, setSelectedAzureSubscriptionIds] = useState([]);
  const [createEnvironmentState, setCreateEnvironmentState] = useState(
    createEnvironmentSetupState
  );
  const [isGoogleWorkspaceModalOpen, setIsGoogleWorkspaceModalOpen] =
    useState(false);
  const [isAzureModalOpen, setIsAzureModalOpen] = useState(false);
  const [pendingCreatedEnvironment, setPendingCreatedEnvironment] = useState(null);
  const navigate = useNavigate();
  const { userProfile } = useSelector((state) => state.auth);
  const storeWorkloads = useSelector((state) => state.workload.workloads);
  const normalizedCloudProvider = String(cloudProvider || 'aws')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');
  const isAzureEnvironmentSelection = normalizedCloudProvider === 'azure';
  const allowsMultipleAzureSubscriptions = Boolean(isReport);
  const supportsAwsConfiguration = normalizedCloudProvider === 'aws';
  const validationActionsEndRef = useRef(null);
  const updateActionsEndRef = useRef(null);
  const upsertValidationToolEvent = useMemo(
    () => createToolEventUpserter(setValidationToolEvents),
    []
  );
  const upsertUpdateToolEvent = useMemo(
    () => createToolEventUpserter(setUpdateToolEvents),
    []
  );

  const matchingEnvironmentProfiles = useMemo(
    () =>
      filterCloudEnvironments(userProfile?.agentPermissionProfiles || []).filter(
      (profile) => matchesEnvironmentProvider(profile, cloudProvider)
      ),
    [cloudProvider, userProfile?.agentPermissionProfiles]
  );

  const availableEnvironments = useMemo(() => {
    if (!showEnvironmentSelection) return [];
    const matchingEnvironments = matchingEnvironmentProfiles;
    if (!isAzureEnvironmentSelection) {
      return matchingEnvironments;
    }

    const tenantProfiles = matchingEnvironments.filter((profile) => {
      const type = String(profile.type || '').trim().toLowerCase().replace(/_/g, ' ');
      return type === 'azure tenant';
    });

    return tenantProfiles.length > 0 ? tenantProfiles : matchingEnvironments;
  }, [isAzureEnvironmentSelection, matchingEnvironmentProfiles, showEnvironmentSelection]);

  const selectedPermissionProfile = useMemo(() => {
    if (!selectedPermissionProfileId) return null;
    return (
      availableEnvironments.find((profile) => {
        const profileId = profile.recordId || profile.id;
        return profileId === selectedPermissionProfileId;
      }) || null
    );
  }, [availableEnvironments, selectedPermissionProfileId]);

  const selectedEnvironmentAuthProfile = useMemo(
    () => parsePermissionAuthProfile(selectedPermissionProfile?.authProfile),
    [selectedPermissionProfile]
  );
  const regionSourcePermissionProfile = useMemo(() => {
    if (!supportsAwsConfiguration) return null;
    if (selectedPermissionProfile) return selectedPermissionProfile;

    return (
      matchingEnvironmentProfiles.find((profile) => {
        const profileId = profile.recordId || profile.id;
        return profileId && profileId === prefillPermissionProfileId;
      }) ||
      matchingEnvironmentProfiles.find(
        (profile) =>
          prefillPermissionProfileName &&
          profile.name === prefillPermissionProfileName
      ) ||
      null
    );
  }, [
    matchingEnvironmentProfiles,
    prefillPermissionProfileId,
    prefillPermissionProfileName,
    selectedPermissionProfile,
    supportsAwsConfiguration,
  ]);
  const regionSourceProfileId =
    regionSourcePermissionProfile?.recordId || regionSourcePermissionProfile?.id || '';
  const defaultRegionsForEnvironment = useMemo(
    () => getDefaultRegionsForPermissionProfile(regionSourcePermissionProfile),
    [regionSourcePermissionProfile]
  );
  const defaultRegionsForEnvironmentKey = defaultRegionsForEnvironment.join('|');
  const azureSubscriptionsForSelectedTenant = useMemo(() => {
    if (!isAzureEnvironmentSelection || !selectedPermissionProfile) return [];

    const selectedTenantId = getAzureTenantIdFromAuthProfile(selectedEnvironmentAuthProfile);
    const selectedTenantProfileId =
      selectedPermissionProfile.recordId || selectedPermissionProfile.id || '';

    return filterCloudEnvironments(userProfile?.agentPermissionProfiles || [])
      .filter((profile) => {
        const type = String(profile.type || '').trim().toLowerCase().replace(/_/g, ' ');
        if (type !== 'azure subscription') return false;

        const authProfile = parsePermissionAuthProfile(profile.authProfile);
        const tenantId = getAzureTenantIdFromAuthProfile(authProfile);
        return (
          (selectedTenantId && tenantId === selectedTenantId) ||
          authProfile.tenantPermissionProfileId === selectedTenantProfileId
        );
      })
      .map((profile) => {
        const authProfile = parsePermissionAuthProfile(profile.authProfile);
        const subscriptionId = getAzureSubscriptionIdFromAuthProfile(authProfile);
        return {
          profile,
          authProfile,
          subscriptionId,
          subscriptionName:
            authProfile.subscriptionName ||
            profile.name ||
            subscriptionId,
        };
      })
      .filter((subscription) => subscription.subscriptionId);
  }, [
    isAzureEnvironmentSelection,
    selectedEnvironmentAuthProfile,
    selectedPermissionProfile,
    userProfile?.agentPermissionProfiles,
  ]);
  const selectedAuthProfileForRun = useMemo(() => {
    if (!isAzureEnvironmentSelection) return selectedEnvironmentAuthProfile;

    const selectedSubscriptionDetails = azureSubscriptionsForSelectedTenant.filter((subscription) =>
      selectedAzureSubscriptionIds.includes(subscription.subscriptionId)
    );

    return {
      ...selectedEnvironmentAuthProfile,
      provider: 'azure',
      subscriptionIds: selectedAzureSubscriptionIds,
      azureSubscriptionIds: selectedAzureSubscriptionIds,
      subscriptions: selectedSubscriptionDetails.map((subscription) => ({
        subscriptionId: subscription.subscriptionId,
        subscriptionName: subscription.subscriptionName,
      })),
    };
  }, [
    azureSubscriptionsForSelectedTenant,
    isAzureEnvironmentSelection,
    selectedAzureSubscriptionIds,
    selectedEnvironmentAuthProfile,
  ]);
  const selectedEnvironmentAccountId = useMemo(() => {
    if (!selectedPermissionProfile) return '';
    if (isAzureEnvironmentSelection) {
      return allowsMultipleAzureSubscriptions
        ? getAzureTenantIdFromAuthProfile(selectedAuthProfileForRun)
        : selectedAzureSubscriptionIds[0] ||
            getAzureSubscriptionIdFromAuthProfile(selectedAuthProfileForRun) ||
            getAzureTenantIdFromAuthProfile(selectedAuthProfileForRun);
    }
    if (
      selectedPermissionProfile?.type === 'google_workspace' ||
      selectedEnvironmentAuthProfile?.provider === 'google_workspace'
    ) {
      return selectedEnvironmentAuthProfile?.domain || '';
    }
    return (
      selectedEnvironmentAuthProfile?.awsAccountId ||
      selectedEnvironmentAuthProfile?.accountId ||
      ''
    );
  }, [
    isAzureEnvironmentSelection,
    allowsMultipleAzureSubscriptions,
    selectedAuthProfileForRun,
    selectedEnvironmentAuthProfile,
    selectedAzureSubscriptionIds,
    selectedPermissionProfile,
  ]);
  const selectedEnvironmentCredentialIssue = useMemo(
    () =>
      isLocalRuntime() && selectedPermissionProfile
        ? getLocalAwsCredentialIssueMessage(selectedPermissionProfile)
        : '',
    [selectedPermissionProfile]
  );
  const resolveWorkloadEnvironmentAccountId = useCallback(
    (value) => {
      if (!value) return null;

      if (typeof value === 'object') {
        const directAccountId = value.accountId || value.awsAccountId;
        if (directAccountId) {
          return String(directAccountId).includes(':')
            ? String(directAccountId).split(':')[0]
            : String(directAccountId);
        }

        const permissionProfileId = value.permissionProfileId || value.recordId || value.id;
        if (permissionProfileId) {
          const profile = (userProfile?.agentPermissionProfiles || []).find(
            (item) =>
              item.recordId === permissionProfileId ||
              item.id === permissionProfileId ||
              item.permissionProfileId === permissionProfileId
          );
          if (profile) {
            const authProfile = parsePermissionAuthProfile(profile.authProfile);
            return authProfile.awsAccountId || authProfile.accountId || String(permissionProfileId);
          }
          return String(permissionProfileId);
        }

        return null;
      }

      const rawValue = String(value);
      const normalizedValue = rawValue.includes(':') ? rawValue.split(':')[0] : rawValue;

      if (/^\d{12}$/.test(normalizedValue)) {
        return normalizedValue;
      }

      const profile = (userProfile?.agentPermissionProfiles || []).find(
        (item) =>
          item.recordId === normalizedValue ||
          item.id === normalizedValue ||
          item.permissionProfileId === normalizedValue
      );
      if (!profile) {
        return normalizedValue;
      }

      const authProfile = parsePermissionAuthProfile(profile.authProfile);
      return authProfile.awsAccountId || authProfile.accountId || normalizedValue;
    },
    [userProfile?.agentPermissionProfiles]
  );
  const availableWorkloads = useMemo(() => {
    if (!supportsAwsConfiguration || !selectedEnvironmentAccountId) {
      return [];
    }

    return (storeWorkloads || []).filter((workload) => {
      const workloadId = workload?.workloadId || workload?.recordId || workload?.id;
      if (!workloadId) return false;

      const environments = Array.isArray(workload?.environments)
        ? workload.environments
        : [];
      if (environments.length === 0) return false;

      return environments.some(
        (environmentValue) =>
          resolveWorkloadEnvironmentAccountId(environmentValue) ===
          selectedEnvironmentAccountId
      );
    });
  }, [
    resolveWorkloadEnvironmentAccountId,
    selectedEnvironmentAccountId,
    storeWorkloads,
    supportsAwsConfiguration,
  ]);
  const selectedValidationState = selectedPermissionProfileId
    ? validationStates[selectedPermissionProfileId] || null
    : null;
  const hasRequiredPolicy =
    !!requiredPermissions?.policy &&
    Object.keys(requiredPermissions.policy).length > 0;

  // Load workloads from user profile when modal opens
  useEffect(() => {
    if (
      isOpen &&
      userProfile?.workloads &&
      userProfile.workloads.length > 0 &&
      storeWorkloads.length === 0
    ) {
      dispatch(loadWorkloadsFromUserProfile(userProfile.workloads));
    }
  }, [isOpen, userProfile?.workloads, storeWorkloads.length, dispatch]);

  useEffect(() => {
    if (!showEnvironmentSelection || !isOpen) return;
    if (availableEnvironments.length === 0) {
      setSelectedPermissionProfileId('');
      return;
    }

    const currentExists = availableEnvironments.some((profile) => {
      const profileId = profile.recordId || profile.id;
      return profileId === selectedPermissionProfileId;
    });
    if (currentExists) return;

    const preferredProfile =
      availableEnvironments.find((profile) => {
        const profileId = profile.recordId || profile.id;
        return profileId === prefillPermissionProfileId;
      }) ||
      availableEnvironments.find(
        (profile) =>
          prefillPermissionProfileName &&
          profile.name === prefillPermissionProfileName
      ) ||
      availableEnvironments[0];

    if (preferredProfile) {
      setSelectedPermissionProfileId(
        preferredProfile.recordId || preferredProfile.id || ''
      );
    }
  }, [
    availableEnvironments,
    isOpen,
    prefillPermissionProfileId,
    prefillPermissionProfileName,
    selectedPermissionProfileId,
    showEnvironmentSelection,
  ]);

  useEffect(() => {
    if (!pendingCreatedEnvironment || availableEnvironments.length === 0) return;

    const match = [...availableEnvironments]
      .reverse()
      .find((profile) => {
        if (pendingCreatedEnvironment.type && profile.type !== pendingCreatedEnvironment.type) {
          return false;
        }
        return profile.name === pendingCreatedEnvironment.name;
      });

    if (match) {
      setSelectedPermissionProfileId(match.recordId || match.id || '');
      setPendingCreatedEnvironment(null);
    }
  }, [availableEnvironments, pendingCreatedEnvironment]);

  useEffect(() => {
    if (!isAzureEnvironmentSelection || !selectedPermissionProfile) {
      setSelectedAzureSubscriptionIds([]);
      return;
    }

    const availableSubscriptionIds = azureSubscriptionsForSelectedTenant.map(
      (subscription) => subscription.subscriptionId
    );

    setSelectedAzureSubscriptionIds((current) => {
      const retained = current.filter((subscriptionId) =>
        availableSubscriptionIds.includes(subscriptionId)
      );
      if (retained.length > 0) {
        return allowsMultipleAzureSubscriptions ? retained : [retained[0]];
      }
      return allowsMultipleAzureSubscriptions
        ? availableSubscriptionIds
        : availableSubscriptionIds.slice(0, 1);
    });
  }, [
    allowsMultipleAzureSubscriptions,
    azureSubscriptionsForSelectedTenant,
    isAzureEnvironmentSelection,
    selectedPermissionProfile,
  ]);

  useEffect(() => {
    if (
      selectedWorkloadOrStack !== AUTO_WORKLOAD_VALUE &&
      !availableWorkloads.some((workload) => {
        const workloadId = workload?.workloadId || workload?.recordId || workload?.id;
        return workloadId && `workload-${workloadId}` === selectedWorkloadOrStack;
      })
    ) {
      setSelectedWorkloadOrStack(AUTO_WORKLOAD_VALUE);
    }
  }, [availableWorkloads, selectedWorkloadOrStack]);

  useEffect(() => {
    if (validationToolEvents.length === 0) return;
    validationActionsEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [validationToolEvents]);

  useEffect(() => {
    if (updateToolEvents.length === 0) return;
    updateActionsEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [updateToolEvents]);

  useEffect(() => {
    if (defaultValues) {
      setFormData((prev) => ({
        ...prev,
        select_aws_regions: defaultValues.select_aws_regions || ['us-east-1'],
        proceed_with_default_values_without_prompt:
          defaultValues.proceed_with_default_values_without_prompt || 'Yes',
        proceed_with_changes_without_confirmation:
          defaultValues.proceed_with_changes_without_confirmation || 'No',
        additional_instructions: defaultValues.additional_instructions || '',
        default_values: defaultValues?.default_values || {},
      }));
    }
  }, [defaultValues]);

  useEffect(() => {
    if (!isOpen || !supportsAwsConfiguration || !regionSourcePermissionProfile) {
      return;
    }

    const nextRegions =
      defaultRegionsForEnvironment.length > 0
        ? defaultRegionsForEnvironment
        : ['us-east-1'];

    setFormData((prev) => {
      const currentRegions = Array.isArray(prev.select_aws_regions)
        ? prev.select_aws_regions
        : [];
      const unchanged =
        currentRegions.length === nextRegions.length &&
        currentRegions.every((region, index) => region === nextRegions[index]);

      if (unchanged) return prev;

      return {
        ...prev,
        select_aws_regions: nextRegions,
      };
    });
  }, [
    defaultRegionsForEnvironmentKey,
    isOpen,
    regionSourcePermissionProfile,
    regionSourceProfileId,
    supportsAwsConfiguration,
  ]);

  useEffect(() => {
    if (!defaultValues) return;

    setConfigurationMode(defaultValues.configuration_mode || 'auto-detect');
    setSelectedWorkloadOrStack(
      defaultValues.selected_workload_or_stack || AUTO_WORKLOAD_VALUE
    );
  }, [
    defaultValues,
    defaultValues?.configuration_mode,
    defaultValues?.selected_workload_or_stack,
  ]);

  useEffect(() => {
    if (runMode === 'background') {
      setFormData((prev) => ({
        ...prev,
        proceed_with_default_values_without_prompt: 'Yes',
      }));
    }
  }, [runMode]);

  const awsRegions = useMemo(() => getRegionOptions(), []);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRegionChange = (selectedRegions) => {
    setFormData((prev) => ({
      ...prev,
      select_aws_regions: selectedRegions,
    }));
  };

  const handleSubmit = async (additionalAnswers = {}) => {
    const requiredCredits =
      creditsCost == null ? 0 : normalizeExecutionCredits(creditsCost, 0);
    const currentCredits = Number(availableCredits);
    if (
      !isLocalRuntime() &&
      requiredCredits > 0 &&
      Number.isFinite(currentCredits) &&
      currentCredits < requiredCredits
    ) {
      toast.error(
        `Insufficient credits. This operation requires ${requiredCredits} credits, but you have ${currentCredits}.`
      );
      return;
    }

    if (showEnvironmentSelection && !selectedPermissionProfile) {
      toast.error('Select an environment before running this blueprint.');
      return;
    }
    if (showEnvironmentSelection && selectedEnvironmentCredentialIssue) {
      toast.error(selectedEnvironmentCredentialIssue);
      return;
    }
    if (
      showEnvironmentSelection &&
      isAzureEnvironmentSelection &&
      selectedAzureSubscriptionIds.length === 0
    ) {
      toast.error(
        allowsMultipleAzureSubscriptions
          ? 'Select at least one Azure subscription before running this report.'
          : 'Select one Azure subscription before running this blueprint.'
      );
      return;
    }
    if (
      showEnvironmentSelection &&
      isAzureEnvironmentSelection &&
      !allowsMultipleAzureSubscriptions &&
      selectedAzureSubscriptionIds.length > 1
    ) {
      toast.error('Select only one Azure subscription before running this blueprint.');
      return;
    }

    const combinedAnswers = {
      ...formData,
      ...additionalAnswers,
      default_values:
        additionalAnswers.default_values || formData.default_values || {},
      configuration_mode: configurationMode,
      selected_workload_or_stack:
        selectedWorkloadOrStack && selectedWorkloadOrStack !== AUTO_WORKLOAD_VALUE
          ? selectedWorkloadOrStack
          : null,
      ...(isAzureEnvironmentSelection
        ? {
            azure_subscription_ids: selectedAzureSubscriptionIds,
            subscriptionId: selectedAzureSubscriptionIds[0] || null,
          }
        : {}),
    };

    if (externalRunHandler) {
      setIsSubmitting(true);
      try {
        await onSubmit(combinedAnswers, {
          selectedPermissionProfileId,
          selectedPermissionProfile,
          authProfile: selectedAuthProfileForRun,
          accountId: selectedEnvironmentAccountId,
          runMode,
        });
        dispatch(setIsRegionModalOpen(false));
      } finally {
        setIsSubmitting(false);
      }
    } else if (isWorkflow) {
      onSubmit(combinedAnswers, {
        selectedPermissionProfileId,
        selectedPermissionProfile,
        authProfile: selectedAuthProfileForRun,
        accountId: selectedEnvironmentAccountId,
        runMode,
      });
      dispatch(setIsRegionModalOpen(false));
    } else if (runMode === 'background') {
      setIsSubmitting(true);
      try {
        const resolvedAuthProfile = showEnvironmentSelection
          ? selectedAuthProfileForRun
          : (() => {
              const firstProfile = userProfile?.agentPermissionProfiles?.[0];
              if (!firstProfile) return {};
              try {
                return typeof firstProfile.authProfile === 'string'
                  ? JSON.parse(firstProfile.authProfile)
                  : firstProfile.authProfile || {};
              } catch {
                return {};
              }
            })();
        const resolvedAccountId =
          showEnvironmentSelection && selectedEnvironmentAccountId
            ? selectedEnvironmentAccountId
            : cloudProvider === 'google_workspace'
              ? resolvedAuthProfile?.domain || ''
              : isAzureEnvironmentSelection
                ? selectedAzureSubscriptionIds[0] ||
                  resolvedAuthProfile?.subscriptionId ||
                  resolvedAuthProfile?.accountId ||
                  ''
                : resolvedAuthProfile?.awsAccountId || resolvedAuthProfile?.accountId || '';

        if (isReport) {
          await dispatch(
            startBackgroundReportOperation({
              accountId: resolvedAccountId,
              authProfile: resolvedAuthProfile,
              cloudProvider,
              credits: creditsCost,
              parentId: selectedPermissionProfileId || parentId || null,
              planId,
              regions: combinedAnswers.select_aws_regions || ['us-east-1'],
              title: operationTitle || buttonText || 'Report Run',
              userId: userProfile?.userId,
            })
          ).unwrap();
          setShowSuccessMessage(true);
          return;
        }

        const inputSettings = {
          authProfile: resolvedAuthProfile,
          regions: combinedAnswers.select_aws_regions || ['us-east-1'],
          proceed_with_default_values_without_prompt:
            combinedAnswers.proceed_with_default_values_without_prompt,
          proceed_with_changes_without_confirmation:
            combinedAnswers.proceed_with_changes_without_confirmation,
          additional_instructions: combinedAnswers.additional_instructions,
          select_aws_regions: combinedAnswers.select_aws_regions,
          default_values: combinedAnswers.default_values,
          configuration_mode: combinedAnswers.configuration_mode,
          selected_workload_or_stack: combinedAnswers.selected_workload_or_stack,
          ...(isAzureEnvironmentSelection
            ? {
                azure_subscription_ids: selectedAzureSubscriptionIds,
                subscriptionId: selectedAzureSubscriptionIds[0] || null,
              }
            : {}),
          ...(recommendationExecutionContext
            ? { recommendationContext: recommendationExecutionContext }
            : {}),
        };

        await runBackgroundAgent({
          userId: userProfile?.userId,
          planId,
          inputSettings,
          onSuccess: (response) => {
            dispatch(refreshUserCredits())
              .unwrap()
              .catch((error) => {
                console.warn('[Agent] Failed to refresh credits after background run start:', error);
              });
            setShowSuccessMessage(true);
          },
          onError: (error) => {
            console.error('Failed to start background agent:', error);
          },
        });
      } catch (error) {
        console.error('Error starting background agent:', error);
        toast.error(
          typeof error === 'string'
            ? error
            : error?.message || 'Failed to start operation'
        );
      } finally {
        setIsSubmitting(false);
      }
    } else {
      onSubmit(combinedAnswers, {
        selectedPermissionProfileId,
        selectedPermissionProfile,
        authProfile: selectedAuthProfileForRun,
        accountId: selectedEnvironmentAccountId,
      });
      dispatch(setIsRegionModalOpen(false));
    }
  };

  const handleCreateEnvironment = () => {
    if (cloudProvider === 'google_workspace') {
      setIsGoogleWorkspaceModalOpen(true);
      return;
    }
    if (isAzureEnvironmentSelection) {
      setIsAzureModalOpen(true);
      return;
    }

    setCreateEnvironmentState(createEnvironmentSetupState());
    setCreateEnvironmentState((prev) => ({
      ...prev,
      isPermissionsModalOpen: true,
    }));
  };

  const handleAwsEnvironmentCreated = (createdPermission) => {
    setPendingCreatedEnvironment({
      name: createdPermission?.name || '',
      type: 'aws account',
    });
    setCreateEnvironmentState(createEnvironmentSetupState());
  };

  const handleGoogleWorkspaceCreated = (createdPermission) => {
    setPendingCreatedEnvironment({
      name: createdPermission?.name || '',
      type: 'google_workspace',
    });
    setIsGoogleWorkspaceModalOpen(false);
  };

  const handleAzureEnvironmentCreated = (createdPermission) => {
    setPendingCreatedEnvironment({
      name: createdPermission?.name || '',
      type: 'azure tenant',
    });
    setIsAzureModalOpen(false);
  };

  const handleValidateSelectedPermissions = async () => {
    if (!selectedPermissionProfile) return;

    const authProfile = parsePermissionAuthProfile(selectedPermissionProfile.authProfile);
    const workloadId = authProfile.workloadId;
    const permissionId =
      selectedPermissionProfile.recordId || selectedPermissionProfile.id || '';

    if (!workloadId) {
      toast.error('This environment is still syncing. Validation is unavailable until a workload is attached.');
      return;
    }

    setLastValidatedPermissionId(permissionId);
    setIsValidatingPermissions(true);
    setValidationToolEvents([]);
    setShowUpdatePermissionsDetails(false);
    setIsValidationSummaryOpen(true);

    try {
      const response = await validatePermissionProfile(
        {
          workloadId,
          permissions: requiredPermissions?.policy || {},
        },
        {
          onToolEvent: (eventType, data) => {
            upsertValidationToolEvent(eventType, data);
          },
          onOperationFinal: (data) => {
            if (data && typeof data === 'object' && Array.isArray(data.tools || data.toolCalls)) {
              (data.tools || data.toolCalls).forEach((tool) => {
                upsertValidationToolEvent('tool_result', {
                  id: tool?.id,
                  name: tool?.name,
                  status: tool?.status,
                  output: tool?.output,
                  error: tool?.error,
                  message: tool?.message,
                });
              });
            }
          },
          onDone: (data) => {
            if (data && typeof data === 'object' && Array.isArray(data.tools)) {
              data.tools.forEach((tool) => {
                upsertValidationToolEvent('tool_result', {
                  id: tool?.id,
                  name: tool?.name,
                  status: tool?.status,
                  output: tool?.output,
                  error: tool?.error,
                  message: tool?.message,
                });
              });
            }
          },
        }
      );

      const body = response?.body || {};
      let parsedDetails = {};
      if (typeof body.details === 'string') {
        try {
          parsedDetails = JSON.parse(body.details) || {};
        } catch (_) {
          parsedDetails = {};
        }
      } else if (body.details && typeof body.details === 'object') {
        parsedDetails = body.details;
      }

      const nextValidationState = {
        status: 'done',
        permissionsValid:
          body.permissionsValid !== undefined
            ? !!body.permissionsValid
            : !!body.success,
        message: body.message || '',
        reason: parsedDetails.reason || '',
        missingPermissions: Array.isArray(parsedDetails.missingPermissions)
          ? parsedDetails.missingPermissions
          : [],
      };

      setValidationStates((prev) => ({
        ...prev,
        [permissionId]: nextValidationState,
      }));
      setShowUpdatePermissionsDetails(!nextValidationState.permissionsValid);

      if (nextValidationState.permissionsValid) {
        toast.success('Permissions look good.');
      } else {
        toast.error('Permissions are missing. Review the details.');
      }
    } catch (error) {
      const nextValidationState = {
        status: 'done',
        permissionsValid: false,
        message:
          error?.message || 'Failed to validate permissions. Please try again.',
        reason: '',
        missingPermissions: [],
      };
      setValidationStates((prev) => ({
        ...prev,
        [permissionId]: nextValidationState,
      }));
      setShowUpdatePermissionsDetails(true);
      toast.error('Failed to validate permissions');
    } finally {
      setIsValidatingPermissions(false);
    }
  };

  const handleValidationSummaryOpenChange = (open) => {
    if (!open && isValidatingPermissions) return;
    setIsValidationSummaryOpen(open);
    if (!open) {
      setValidationToolEvents([]);
      setShowUpdatePermissionsDetails(false);
    }
  };

  const handleUpdateProgressOpenChange = (open) => {
    if (!open) {
      setIsUpdateProgressOpen(false);
      setUpdateToolEvents([]);
      setUpdateSummary({
        status: 'idle',
        success: null,
        message: '',
        reason: '',
        details: null,
      });
      return;
    }
    setIsUpdateProgressOpen(true);
  };

  const handleRetryValidation = () => {
    if (!lastValidatedPermissionId || isValidatingPermissions) return;
    if (
      selectedPermissionProfile &&
      (selectedPermissionProfile.recordId || selectedPermissionProfile.id) ===
        lastValidatedPermissionId
    ) {
      handleValidateSelectedPermissions();
    }
  };

  const handleUpdatePermissions = async () => {
    if (!selectedPermissionProfile) return;

    const authProfile = parsePermissionAuthProfile(selectedPermissionProfile.authProfile);
    const workloadId = authProfile.workloadId || selectedEnvironmentAuthProfile?.workloadId;
    const roleName = authProfile.roleName || selectedEnvironmentAuthProfile?.roleName;

    if (!workloadId || !roleName) {
      toast.error('Workload ID and role name are required to update permissions.');
      return;
    }

    try {
      setIsUpdatingPermissions(true);
      setIsUpdateProgressOpen(true);
      setUpdateToolEvents([]);
      setUpdateSummary({
        status: 'loading',
        success: null,
        message: 'Updating permissions. This may take a minute.',
        reason: '',
        details: null,
      });

      const { body } = await updatePermissionProfilePermissions(
        {
          workloadId,
          roleName,
          policy: requiredPermissions?.policy || {},
          temporaryAccessHours: temporaryAccess ? selectedTime : undefined,
        },
        {
          onToolEvent: (eventType, data) => {
            upsertUpdateToolEvent(eventType, data);
          },
          onOperationFinal: (data) => {
            if (data && typeof data === 'object' && Array.isArray(data.tools || data.toolCalls)) {
              (data.tools || data.toolCalls).forEach((tool) => {
                upsertUpdateToolEvent('tool_result', {
                  id: tool?.id,
                  name: tool?.name,
                  status: tool?.status,
                  output: tool?.output,
                  error: tool?.error,
                  message: tool?.message,
                });
              });
            }
          },
          onDone: (data) => {
            if (data && typeof data === 'object' && Array.isArray(data.tools)) {
              data.tools.forEach((tool) => {
                upsertUpdateToolEvent('tool_result', {
                  id: tool?.id,
                  name: tool?.name,
                  status: tool?.status,
                  output: tool?.output,
                  error: tool?.error,
                  message: tool?.message,
                });
              });
            }
          },
        }
      );

      let parsedDetails = body?.details || null;
      if (typeof parsedDetails === 'string') {
        try {
          parsedDetails = JSON.parse(parsedDetails);
        } catch (_) {
          parsedDetails = null;
        }
      }

      const success = !!body?.success;
      const message =
        body?.message ||
        (success ? 'Permissions update requested.' : 'Permissions update failed.');

      setUpdateSummary({
        status: 'done',
        success,
        message,
        reason: parsedDetails?.reason || '',
        details: parsedDetails,
      });

      if (success) {
        toast.success(message);
      } else {
        toast.error(message);
      }
    } catch (error) {
      setUpdateSummary({
        status: 'done',
        success: false,
        message: error?.message || 'Failed to update permissions',
        reason: '',
        details: null,
      });
      toast.error(error?.message || 'Failed to update permissions');
    } finally {
      setIsUpdatingPermissions(false);
    }
  };

  const applyDefaultValues = (summary) => {
    if (!summary) return summary;

    const regex = /__input_field__(.*?)__input_field_end__/gs;

    return summary?.replace(regex, (match, jsonStr) => {
      try {
        const fieldConfig = JSON.parse(jsonStr.trim());
        const stateName = fieldConfig.label.replace(/\s+/g, '_').toLowerCase();

        if (
          defaultValues?.default_values &&
          Object.prototype.hasOwnProperty.call(
            defaultValues.default_values,
            stateName
          )
        ) {
          fieldConfig.default_value = defaultValues.default_values[stateName];
        }

        return `__input_field__ ${JSON.stringify(fieldConfig)} __input_field_end__`;
      } catch (error) {
        console.error('Error processing input field:', error, jsonStr);
        return match;
      }
    });
  };

  const processedInputSummary = inputSummary
    ? applyDefaultValues(inputSummary)
    : null;

  // Ensure initial default_values include defaults from the Blueprint Default Values form
  useEffect(() => {
    if (!processedInputSummary) return;
    const allFields = getAllFieldConfigs(processedInputSummary);
    if (!allFields || allFields.length === 0) return;

    setFormData((prev) => {
      const missingDefaults = {};
      let hasMissing = false;
      allFields.forEach(({ stateName, default_value }) => {
        const isMissing = prev.default_values?.[stateName] === undefined;
        if (isMissing && default_value !== undefined) {
          missingDefaults[stateName] = default_value;
          hasMissing = true;
        }
      });

      if (!hasMissing) return prev;

      return {
        ...prev,
        default_values: {
          ...prev.default_values,
          ...missingDefaults,
        },
      };
    });
  }, [processedInputSummary]);

  const defaultFormContents =
    processedInputSummary ||
    `## AWS Regions Selection
    Please select the applicable AWS regions from the list below that you would like to use for later tasks:
    __input_field__ {"fieldType": "input_select", "label": "Select AWS Regions", "default_value": "${defaultValues.default_values?.select_aws_regions || ''}", "options": [{"label": "us-east-1"}, {"label": "us-east-2"}, {"label": "us-west-1"}, {"label": "us-west-2"},{"label": "ap-south-1"}, {"label": "eu-north-1"}, {"label": "eu-west-3"}, {"label": "eu-west-2"}, {"label": "eu-west-1"}, {"label": "ap-northeast-3"}, {"label": "ap-northeast-2"}, {"label": "ap-northeast-1"}, {"label": "ca-central-1"}, {"label": "sa-east-1"}, {"label": "ap-southeast-1"}, {"label": "ap-southeast-2"}, {"label": "eu-central-1"}], "allow_multiple_selection": true} __input_field_end__`;

  const processFormAnswers = (answers) => {
    const processed = { ...answers };

    const arrayFields = ['select_aws_regions'];

    arrayFields.forEach((field) => {
      if (processed[field] && typeof processed[field] === 'string') {
        processed[field] = processed[field]
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
      }
    });

    return processed;
  };

  function getAllFieldConfigs(inputString) {
    const inputFieldRegex = /__input_field__(.*?)__input_field_end__/gs;
    let fields = [];
    if (!inputString) return fields;
    let matches = [...inputString.matchAll(inputFieldRegex)];
    matches.forEach((match) => {
      try {
        const fieldProps = JSON.parse(match[1].trim());
        const stateName = fieldProps.label.replace(/\s+/g, '_').toLowerCase();
        fields.push({ stateName, ...fieldProps });
      } catch (e) {}
    });
    return fields;
  }

  const { emptyCount, totalCount } = useMemo(() => {
    const allFields = getAllFieldConfigs(processedInputSummary);
    let empty = 0,
      total = allFields.length;

    allFields.forEach(({ stateName, default_value }) => {
      const value =
        formData.default_values?.[stateName] !== undefined
          ? formData.default_values?.[stateName]
          : default_value;
      if (
        value === undefined ||
        value === null ||
        (Array.isArray(value) && value.length === 0) ||
        value === ''
      ) {
        empty++;
      }
    });

    return { emptyCount: empty, totalCount: total };
  }, [formData.default_values, processedInputSummary]);

  if (!isOpen) return null;

  const handleDefaultValuesChange = (answers) => {
    const processedAnswers = processFormAnswers(answers);
    setFormData((prev) => ({
      ...prev,
      default_values: {
        ...processedAnswers,
      },
    }));
  };

  const isBackgroundDisabled = runMode === 'background';
  const canValidateSelectedEnvironment =
    hasRequiredPolicy &&
    !!selectedPermissionProfile &&
    !!selectedEnvironmentAuthProfile?.workloadId;
  const selectedEnvironmentValidationState = selectedValidationState || {
    status: 'idle',
    permissionsValid: null,
    message: '',
    reason: '',
    missingPermissions: [],
  };
  const canSubmit =
    !isSubmitting &&
    (!showEnvironmentSelection || !!selectedPermissionProfile) &&
    (!isAzureEnvironmentSelection || selectedAzureSubscriptionIds.length > 0) &&
    !selectedEnvironmentCredentialIssue;

  const handleGoToAgents = () => {
    navigate('/dashboard/agents');
  };

  const handleGoToReports = () => {
    navigate('/dashboard');
  };

  const handleCloseSuccessMessage = () => {
    setShowSuccessMessage(false);
    if (onClose) {
      onClose();
    } else {
      dispatch(setIsRegionModalOpen(false));
    }
  };

  const handleBackToLibrary = () => {
    if (isReport) {
      navigate('/dashboard');
      return;
    }
    if (isLocalRuntime()) {
      navigate(`/dashboard/library/blueprint/${effectiveBlueprintId}`);
      return;
    }
    if (location.pathname.startsWith('/library/blueprint/')) {
      navigate(`/library/blueprint/${effectiveBlueprintId}`);
      return;
    }
    if (location.pathname.startsWith('/blueprint/')) {
      navigate(`/blueprint/${effectiveBlueprintId}`);
      return;
    }
    navigate(`/dashboard/agent/${planId}`);
  };

  if (showSuccessMessage) {
    return (
      <>
        <div className="fixed inset-0 bg-black/50 z-[51]" />
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[52] bg-white rounded-lg shadow-xl flex flex-col w-[90%] max-w-md overflow-hidden">
          <div className="p-6 text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {isReport ? 'Report Started Successfully!' : 'Agent Started Successfully!'}
            </h3>
            <p className="text-gray-600 mb-6">
              {isReport
                ? 'Your report started in the background.'
                : 'Your agent is now running in the background. You can check its progress in Agent History, but the new run may take a couple of minutes to appear in the table.'}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  if (isReport) {
                    if (onClose) {
                      onClose();
                    } else {
                      setShowSuccessMessage(false);
                    }
                  } else {
                    handleCloseSuccessMessage();
                  }
                  dispatch(setIsRegionModalOpen(false));
                }}
                className="flex-1"
              >
                {isReport ? 'Exit' : 'Close'}
              </Button>
              <Button
                onClick={() => {
                  if (isReport) {
                    handleGoToReports();
                  } else {
                    handleGoToAgents();
                  }
                  dispatch(setIsRegionModalOpen(false));
                }}
                className="flex-1"
              >
                {isReport ? 'Go to CloudAgent' : 'Agent History'}
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-[51]"
        onClick={() => {
          if (onClose) {
            onClose();
          } else if (isWorkflow) {
            onClose();
          } else if (isAgent) {
            navigate(isLocalRuntime() ? `/dashboard/library/blueprint/${planId}` : `/library/blueprint/${planId}`);
          } else {
            navigate('/dashboard');
          }
        }}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[52] bg-white rounded-xl shadow-2xl flex flex-col w-[90%] max-w-xl max-h-[90vh] overflow-hidden">
        <div className="border-b px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-base font-semibold text-gray-900 shrink-0">
              Run Settings
            </h2>
            {!isLocalRuntime() && showEnvironmentSelection && creditsCost !== null && (
              <span className="inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-0.5 shrink-0">
                <Shield className="h-3 w-3 text-blue-500" />
                {creditsCost} credit{creditsCost !== 1 ? 's' : ''}
                {availableCredits !== null ? ` · ${availableCredits} available` : ''}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {recommendationTarget && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-slate-900">
                  Recommended Target
                </p>
                <Badge variant="secondary">
                  {recommendationTarget?.type === 'workload' ? 'Workload' : 'Environment'}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {recommendationTarget?.label || recommendationTarget?.workloadName || recommendationTarget?.environmentName || 'Target'}
                </p>
                {recommendationTarget?.subtitle || recommendationTarget?.accountId ? (
                  <p className="text-xs text-slate-600 mt-1">
                    {recommendationTarget?.subtitle || recommendationTarget?.accountId}
                  </p>
                ) : null}
              </div>
              {Array.isArray(recommendationTarget?.resources) &&
              recommendationTarget.resources.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Target Resources
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {recommendationTarget.resources.slice(0, 4).map((resource, index) => {
                      const label =
                        resource?.displayName ||
                        resource?.resourceId ||
                        resource?.resourceArn ||
                        resource?.resourceType ||
                        `Resource ${index + 1}`;
                      return (
                        <span
                          key={`recommendation-target-resource-${index}`}
                          className="inline-flex items-center rounded-md bg-white px-2 py-1 text-xs text-slate-700 border border-blue-100"
                          title={label}
                        >
                          {label}
                        </span>
                      );
                    })}
                    {recommendationTarget.resources.length > 4 ? (
                      <span className="inline-flex items-center rounded-md bg-white px-2 py-1 text-xs text-slate-500 border border-blue-100">
                        +{recommendationTarget.resources.length - 4} more
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : recommendationTarget?.resourceSummary ? (
                <p className="text-xs text-slate-600">{recommendationTarget.resourceSummary}</p>
              ) : null}
            </div>
          )}
          {runMode === 'background' && emptyCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-amber-600 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-amber-800 mb-1">
                    Missing Default Values
                  </h4>
                  <p className="text-sm text-amber-700">
                    {emptyCount} out of {totalCount} blueprint input
                    {totalCount !== 1 ? 's' : ''}{' '}
                    {emptyCount === 1 ? 'has' : 'have'} no default value
                    {emptyCount !== 1 ? 's' : ''}. The agent will use system
                    defaults for these fields when running in background mode.
                  </p>
                </div>
              </div>
            </div>
          )}
          {showEnvironmentSelection && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium text-gray-700">
                  Cloud Environment
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-primary-600 hover:text-primary-700 px-2"
                  onClick={handleCreateEnvironment}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  New
                </Button>
              </div>

              {availableEnvironments.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Popover open={envDropdownOpen} onOpenChange={setEnvDropdownOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={envDropdownOpen}
                          className="w-full justify-between font-normal h-10"
                        >
                          <span className="truncate">
                            {selectedPermissionProfileId
                              ? (() => {
                                  const selected = availableEnvironments.find(
                                    (p) =>
                                      (p.recordId || p.id) ===
                                      selectedPermissionProfileId
                                  );
                                  if (!selected) return 'Select an environment';
                                  const auth = parsePermissionAuthProfile(selected.authProfile);
                                  const type = String(selected.type || '').trim().toLowerCase().replace(/_/g, ' ');
                                  const sub =
                                    type === 'google workspace'
                                      ? auth.domain || 'Google Workspace'
                                      : type === 'azure tenant' || type === 'azure subscription'
                                        ? getAzureTenantIdFromAuthProfile(auth) || 'Azure tenant'
                                        : auth.awsAccountId || auth.accountId || 'AWS account';
                                  return `${selected.name} (${sub})`;
                                })()
                              : 'Select an environment'}
                          </span>
                          {selectedEnvironmentCredentialIssue ? (
                            <AlertTriangle className="ml-2 h-4 w-4 shrink-0 text-amber-500" />
                          ) : null}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-white z-[9999]">
                        <Command>
                          <CommandInput placeholder="Search environments..." />
                          <CommandList>
                            <CommandEmpty>No environments found.</CommandEmpty>
                            <CommandGroup>
                              {availableEnvironments.map((profile) => {
                                const profileId = profile.recordId || profile.id;
                                const authProfile = parsePermissionAuthProfile(profile.authProfile);
                                const type = String(profile.type || '').trim().toLowerCase().replace(/_/g, ' ');
                                const subtitle =
                                  type === 'google workspace'
                                    ? authProfile.domain || 'Google Workspace'
                                    : type === 'azure tenant' || type === 'azure subscription'
                                      ? getAzureTenantIdFromAuthProfile(authProfile) || 'Azure tenant'
                                    : authProfile.awsAccountId || authProfile.accountId || 'AWS account';
                                const credentialIssue = isLocalRuntime()
                                  ? getLocalAwsCredentialIssueMessage(profile)
                                  : '';

                                return (
                                  <CommandItem
                                    key={profileId}
                                    value={`${profile.name} ${subtitle}`}
                                    onSelect={() => {
                                      setSelectedPermissionProfileId(profileId);
                                      setEnvDropdownOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        selectedPermissionProfileId === profileId
                                          ? 'opacity-100'
                                          : 'opacity-0'
                                      )}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate">
                                        {profile.name} {subtitle ? `(${subtitle})` : ''}
                                      </div>
                                      {credentialIssue ? (
                                        <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
                                          <AlertTriangle className="h-3 w-3 shrink-0" />
                                          <span className="truncate">Credentials need attention</span>
                                        </div>
                                      ) : null}
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {hasRequiredPolicy && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 shrink-0"
                          onClick={handleValidateSelectedPermissions}
                          disabled={!canValidateSelectedEnvironment || isValidatingPermissions}
                          title="Validate permissions"
                        >
                          {isValidatingPermissions ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 shrink-0"
                          onClick={() => setShowPermissionsModal(true)}
                          title="Show required permissions"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  {selectedEnvironmentCredentialIssue ? (
                    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{selectedEnvironmentCredentialIssue}</span>
                    </div>
                  ) : null}

                  {isAzureEnvironmentSelection && selectedPermissionProfile && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            Azure Subscriptions
                          </p>
                          <p className="text-xs text-gray-500">
                            {allowsMultipleAzureSubscriptions
                              ? `${selectedAzureSubscriptionIds.length} of ${azureSubscriptionsForSelectedTenant.length} selected`
                              : selectedAzureSubscriptionIds[0] || 'Select one subscription'}
                          </p>
                        </div>
                        {allowsMultipleAzureSubscriptions && azureSubscriptionsForSelectedTenant.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              const allIds = azureSubscriptionsForSelectedTenant.map(
                                (subscription) => subscription.subscriptionId
                              );
                              setSelectedAzureSubscriptionIds((current) =>
                                current.length === allIds.length ? [] : allIds
                              );
                            }}
                          >
                            {selectedAzureSubscriptionIds.length === azureSubscriptionsForSelectedTenant.length
                              ? 'Clear'
                              : 'All'}
                          </Button>
                        )}
                      </div>

                      {azureSubscriptionsForSelectedTenant.length > 0 ? (
                        <div className="max-h-44 overflow-y-auto rounded-md border border-gray-200 bg-white">
                          {allowsMultipleAzureSubscriptions ? (
                            azureSubscriptionsForSelectedTenant.map((subscription) => {
                              const checked = selectedAzureSubscriptionIds.includes(
                                subscription.subscriptionId
                              );
                              return (
                                <label
                                  key={subscription.subscriptionId}
                                  className="flex items-start gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0 cursor-pointer hover:bg-gray-50"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(nextChecked) => {
                                      setSelectedAzureSubscriptionIds((current) =>
                                        nextChecked
                                          ? [...new Set([...current, subscription.subscriptionId])]
                                          : current.filter((id) => id !== subscription.subscriptionId)
                                      );
                                    }}
                                    className="mt-0.5"
                                  />
                                  <span className="min-w-0">
                                    <span className="block text-sm font-medium text-gray-800 truncate">
                                      {subscription.subscriptionName}
                                    </span>
                                    <span className="block text-xs text-gray-500 font-mono truncate">
                                      {subscription.subscriptionId}
                                    </span>
                                  </span>
                                </label>
                              );
                            })
                          ) : (
                            <RadioGroup
                              value={selectedAzureSubscriptionIds[0] || ''}
                              onValueChange={(subscriptionId) => {
                                setSelectedAzureSubscriptionIds(subscriptionId ? [subscriptionId] : []);
                              }}
                            >
                              {azureSubscriptionsForSelectedTenant.map((subscription) => (
                                <label
                                  key={subscription.subscriptionId}
                                  className="flex items-start gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0 cursor-pointer hover:bg-gray-50"
                                >
                                  <RadioGroupItem
                                    value={subscription.subscriptionId}
                                    className="mt-0.5"
                                  />
                                  <span className="min-w-0">
                                    <span className="block text-sm font-medium text-gray-800 truncate">
                                      {subscription.subscriptionName}
                                    </span>
                                    <span className="block text-xs text-gray-500 font-mono truncate">
                                      {subscription.subscriptionId}
                                    </span>
                                  </span>
                                </label>
                              ))}
                            </RadioGroup>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed border-gray-300 bg-white p-3 text-sm text-gray-600">
                          No subscriptions found for this tenant.
                        </div>
                      )}
                    </div>
                  )}

                  {supportsAwsConfiguration && (
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-700">
                        AWS Regions
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="h-9 w-full justify-between font-normal"
                          >
                            {!formData.select_aws_regions ||
                            formData.select_aws_regions.length === 0
                              ? 'Select regions'
                              : `${formData.select_aws_regions.length} selected`}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-white z-[9999]">
                          <Command>
                            <CommandInput placeholder="Search regions..." />
                            <CommandList>
                              <CommandEmpty>No regions found.</CommandEmpty>
                              <CommandGroup>
                                {awsRegions.map((region) => (
                                  <CommandItem
                                    key={region.value}
                                    onSelect={() => {
                                      const value = region.value;
                                      const currentValues =
                                        formData.select_aws_regions || [];
                                      const newValues = currentValues.includes(value)
                                        ? currentValues.filter((v) => v !== value)
                                        : [...currentValues, value];
                                      handleRegionChange(newValues);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        formData.select_aws_regions?.includes(region.value)
                                          ? 'opacity-100'
                                          : 'opacity-0'
                                      )}
                                    />
                                    {region.label}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {formData.select_aws_regions &&
                        formData.select_aws_regions.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-1.5">
                            {formData.select_aws_regions?.map((value) => (
                              <Badge
                                key={value}
                                variant="secondary"
                                className="text-xs"
                              >
                                {value}
                                <button
                                  className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newValues =
                                      formData.select_aws_regions?.filter(
                                        (v) => v !== value
                                      );
                                    handleRegionChange(newValues);
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                  No matching environments found for this blueprint yet.
                </div>
              )}
            </div>
          )}
          {showEnvironmentSelection && <hr className="border-gray-100" />}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Execution Mode
            </label>
            <ToggleGroup
              type="single"
              value={runMode}
              onValueChange={(value) => value && setRunMode(value)}
              className="w-full grid grid-cols-2 gap-2"
            >
              <ToggleGroupItem
                value="interactive"
                disabled={isWorkflow && !externalRunHandler}
                className={cn(
                  'h-9 text-sm font-medium border-2 rounded-lg transition-all',
                  runMode === 'interactive'
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100',
                  isWorkflow && !externalRunHandler && 'opacity-50 cursor-not-allowed'
                )}
              >
                Interactive
              </ToggleGroupItem>
              <ToggleGroupItem
                value="background"
                className={cn(
                  'h-9 text-sm font-medium border-2 rounded-lg transition-all',
                  runMode === 'background'
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                )}
              >
                Background
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {!isReport && supportsAwsConfiguration && <hr className="border-gray-100" />}
          {/* Configuration block - mode and workload only */}
          {!isReport && supportsAwsConfiguration && (
            <div className="grid gap-3 grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Config Mode
                </label>
                <Select
                  value={configurationMode}
                  onValueChange={(value) => value && setConfigurationMode(value)}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto-detect">Auto</SelectItem>
                    <SelectItem value="cloudformation">CloudFormation</SelectItem>
                    <SelectItem value="aws-cli">AWS CLI</SelectItem>
                    <SelectItem value="terraform" disabled>Terraform (soon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Workload
                </label>
                <Select
                  value={selectedWorkloadOrStack}
                  onValueChange={setSelectedWorkloadOrStack}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO_WORKLOAD_VALUE}>Auto</SelectItem>
                    {availableWorkloads.map((workload) => {
                      const workloadId =
                        workload?.workloadId || workload?.recordId || workload?.id;
                      if (!workloadId) return null;

                      return (
                        <SelectItem
                          key={`workload-${workloadId}`}
                          value={`workload-${workloadId}`}
                        >
                          {workload.name || workload.workloadName || 'Unnamed Workload'}
                        </SelectItem>
                      );
                    })}
                    {availableWorkloads.length === 0 && (
                      <div className="px-2 py-2 text-xs text-gray-500">
                        No workloads found for this environment
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {!isReport && <hr className="border-gray-100" />}
          {!isReport && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Auto-confirm defaults</p>
                    <p className="text-xs text-gray-500">Skip confirmation for default values</p>
                  </div>
                  <Switch
                    checked={formData.proceed_with_default_values_without_prompt === 'Yes'}
                    onCheckedChange={(checked) =>
                      handleInputChange('proceed_with_default_values_without_prompt', checked ? 'Yes' : 'No')
                    }
                    disabled={isBackgroundDisabled}
                    className="data-[state=checked]:bg-primary-600"
                  />
                </div>
                <div className="border-t border-gray-200" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Auto-confirm changes</p>
                    <p className="text-xs text-gray-500">Apply changes without prompting</p>
                  </div>
                  <Switch
                    checked={formData.proceed_with_changes_without_confirmation === 'Yes'}
                    onCheckedChange={(checked) =>
                      handleInputChange('proceed_with_changes_without_confirmation', checked ? 'Yes' : 'No')
                    }
                    className="data-[state=checked]:bg-primary-600"
                  />
                </div>
              </div>
            )}

            {!isReport && (
              <div>
                <button
                  type="button"
                  className="flex items-center justify-between w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onClick={() => setShowInstructions((prev) => !prev)}
                >
                  <span className="text-sm font-medium text-gray-700">
                    Describe any other instructions
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showInstructions ? 'rotate-180' : ''}`}
                  />
                </button>
                {showInstructions && (
                  <textarea
                    value={formData.additional_instructions}
                    onChange={(e) =>
                      handleInputChange(
                        'additional_instructions',
                        e.target.value
                      )
                    }
                    placeholder="Enter any additional instructions or requirements..."
                    rows={4}
                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-vertical"
                  />
                )}
              </div>
            )}

          {!isReport && (
            <div className="border-t border-gray-200 space-y-3 pt-3">
              <div className="">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Blueprint Default Values
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <DynamicFormComponent
                    inputString={defaultFormContents}
                    resourceTables={null}
                    handleSubmitFormAnswers={handleDefaultValuesChange}
                    mostRecentBlock={false}
                    loading={false}
                    isFullScreen={false}
                    hideSubmitButton={true}
                    onFormChange={handleDefaultValuesChange}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {children ? <div className="border-t px-5 py-4">{children}</div> : null}

        <div className="border-t px-5 py-3 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (onClose) {
                onClose();
              } else if (isAgent) {
                if (isReconnecting) {
                  dispatch(setIsRegionModalOpen(false));
                } else {
                  navigate(isLocalRuntime() ? `/dashboard/library/blueprint/${planId}` : `/library/blueprint/${planId}`);
                }
              } else if (isWorkflow) {
                onClose();
              } else {
                navigate('/dashboard');
              }
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={() => handleSubmit()} disabled={!canSubmit}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting Agent...
                </>
              ) : (
                <>
                  {runMode === 'background'
                    ? buttonText
                      ? buttonText
                      : 'Start in Background'
                    : isAgent
                      ? buttonText
                        ? buttonText
                        : 'Run Agent'
                      : 'Save Settings'}
                </>
              )}
            </Button>
        </div>
      </div>

      <PermissionsModal
        isOpen={createEnvironmentState.isPermissionsModalOpen}
        setState={setCreateEnvironmentState}
        state={createEnvironmentState}
        authProfile={createEnvironmentState.authProfile}
        requiredPermissions={{}}
        onComplete={handleAwsEnvironmentCreated}
        onCancel={() => {
          setCreateEnvironmentState(createEnvironmentSetupState());
        }}
        recordId=""
        existingAgentData={{}}
        isReconnecting={false}
        isDashboard={true}
      />

      <AddGoogleWorkspaceModal
        isOpen={isGoogleWorkspaceModalOpen}
        onClose={() => setIsGoogleWorkspaceModalOpen(false)}
        onComplete={handleGoogleWorkspaceCreated}
      />

      <AddAzureModal
        isOpen={isAzureModalOpen}
        onClose={() => setIsAzureModalOpen(false)}
        onComplete={handleAzureEnvironmentCreated}
      />

      <Dialog open={showPermissionsModal} onOpenChange={setShowPermissionsModal}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle>Required Permissions</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700">
            {JSON.stringify(requiredPermissions?.policy || {}, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isValidationSummaryOpen}
        onOpenChange={handleValidationSummaryOpenChange}
      >
        <DialogContent className="max-w-lg bg-white max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isValidatingPermissions ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              ) : selectedEnvironmentValidationState.permissionsValid ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              <span>Permissions Validation</span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-4 pr-2">
              <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Reviewing Permission Profile
                </div>
                <div className="mt-2 space-y-2">
                  {validationToolEvents.length === 0 ? (
                    <p className="text-xs text-blue-600">
                      {isValidatingPermissions
                        ? 'Waiting for the agent to start tool calls...'
                        : selectedEnvironmentValidationState.message || 'No validation activity recorded.'}
                    </p>
                  ) : (
                    <>
                      {validationToolEvents.map((event) => {
                        const friendlyName = formatToolName(event.rawName);
                        if (!friendlyName) return null;
                        const statusText = formatStatusLabel(
                          event.status,
                          event.isErrored
                            ? 'Failed'
                            : event.isCompleted
                              ? 'Completed'
                              : 'In progress'
                        );
                        const outputText = formatValueForDisplay(event.output);
                        const errorText = formatValueForDisplay(event.error);
                        return (
                          <div
                            key={event.id}
                            className="flex gap-2 rounded-md border border-blue-100 bg-white/80 p-2"
                          >
                            <div className="mt-0.5">
                              {event.isErrored ? (
                                <XCircle className="h-4 w-4 text-red-500" />
                              ) : event.isCompleted ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-sm font-medium text-gray-900">
                                  {friendlyName}
                                </div>
                                <div className="text-xs text-gray-600">{statusText}</div>
                              </div>
                              {errorText && (
                                <p className="mt-1 text-xs text-red-600">{errorText}</p>
                              )}
                              {outputText && (
                                <details className="mt-1">
                                  <summary className="cursor-pointer text-[11px] font-medium text-gray-600">
                                    View output
                                  </summary>
                                  <pre className="mt-1 whitespace-pre-wrap rounded bg-white p-2 text-[11px] text-gray-700 shadow-inner">
                                    {outputText}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={validationActionsEndRef} />
                    </>
                  )}
                </div>
              </div>

              {!isValidatingPermissions &&
                selectedEnvironmentValidationState.permissionsValid === false && (
                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">
                          Update Permissions
                        </h4>
                        <p className="text-xs text-gray-600">
                          Apply the required permissions for this blueprint to the selected environment.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowUpdatePermissionsDetails((prev) => !prev)}
                      >
                        {showUpdatePermissionsDetails ? 'Hide' : 'Show'}
                      </Button>
                    </div>

                    {showUpdatePermissionsDetails && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Temporary Access
                            </p>
                            <p className="text-xs text-gray-600">
                              Limit these permissions to a short time period.
                            </p>
                          </div>
                          <Switch
                            checked={temporaryAccess}
                            onCheckedChange={setTemporaryAccess}
                            className="data-[state=checked]:bg-primary-600"
                          />
                        </div>

                        {temporaryAccess && (
                          <div className="space-y-2">
                            <Label
                              htmlFor="update-time-selection"
                              className="text-sm font-medium text-gray-700"
                            >
                              Select time
                            </Label>
                            <select
                              id="update-time-selection"
                              value={selectedTime}
                              onChange={(e) => setSelectedTime(e.target.value)}
                              className="w-full rounded-md border border-gray-300 px-3 py-2"
                            >
                              <option value={1}>1 hour</option>
                              <option value={2}>2 hours</option>
                              <option value={4}>4 hours</option>
                              <option value={8}>8 hours</option>
                              <option value={12}>12 hours</option>
                              <option value={24}>1 day</option>
                              <option value={72}>3 days</option>
                              <option value={168}>7 days</option>
                            </select>
                          </div>
                        )}

                        <Button
                          type="button"
                          className="w-full"
                          onClick={handleUpdatePermissions}
                          disabled={isUpdatingPermissions}
                        >
                          {isUpdatingPermissions && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Update Permission Profile
                        </Button>
                      </div>
                    )}
                  </div>
                )}
            </div>
          </ScrollArea>
          <div className="mt-4 flex justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleRetryValidation}
              disabled={isValidatingPermissions}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Retry
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleValidationSummaryOpenChange(false)}
              disabled={isValidatingPermissions}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isUpdateProgressOpen}
        onOpenChange={handleUpdateProgressOpenChange}
      >
        <DialogContent className="max-w-lg bg-white max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isUpdatingPermissions ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              ) : updateSummary.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              <span>Updating Permissions</span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-4 pr-2">
              <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Updating Permission Profile
                </div>
                <div className="mt-2 space-y-2">
                  {updateToolEvents.length === 0 ? (
                    <p className="text-xs text-blue-600">
                      {isUpdatingPermissions
                        ? 'Waiting for the agent to start tool calls...'
                        : updateSummary.message || 'No update activity recorded.'}
                    </p>
                  ) : (
                    <>
                      {updateToolEvents.map((event) => {
                        const friendlyName = formatToolName(event.rawName);
                        if (!friendlyName) return null;
                        const statusText = formatStatusLabel(
                          event.status,
                          event.isErrored
                            ? 'Failed'
                            : event.isCompleted
                              ? 'Completed'
                              : 'In progress'
                        );
                        const outputText = formatValueForDisplay(event.output);
                        const errorText = formatValueForDisplay(event.error);
                        return (
                          <div
                            key={event.id}
                            className="flex gap-2 rounded-md border border-blue-100 bg-white/80 p-2"
                          >
                            <div className="mt-0.5">
                              {event.isErrored ? (
                                <XCircle className="h-4 w-4 text-red-500" />
                              ) : event.isCompleted ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-sm font-medium text-gray-900">
                                  {friendlyName}
                                </div>
                                <div className="text-xs text-gray-600">{statusText}</div>
                              </div>
                              {errorText && (
                                <p className="mt-1 text-xs text-red-600">{errorText}</p>
                              )}
                              {outputText && (
                                <details className="mt-1">
                                  <summary className="cursor-pointer text-[11px] font-medium text-gray-600">
                                    View output
                                  </summary>
                                  <pre className="mt-1 whitespace-pre-wrap rounded bg-white p-2 text-[11px] text-gray-700 shadow-inner">
                                    {outputText}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={updateActionsEndRef} />
                    </>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleUpdateProgressOpenChange(false)}
              disabled={isUpdatingPermissions}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
};
