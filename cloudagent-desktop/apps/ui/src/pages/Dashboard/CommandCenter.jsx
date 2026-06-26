import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'markdown-to-jsx';
import toast from 'react-hot-toast';
import {
  Bot,
  Cloud,
  Layers,
  FileText,
  Loader2,
  Play,
  AlertTriangle,
  X,
  Send,
  Shield,
  ShieldAlert,
  DollarSign,
  Trash2,
  ClipboardCheck,
  Network,
  Lock,
  BarChart3,
  Sparkles,
  FileBarChart,
  ChevronRight,
  ChevronDown,
  Menu,
  Plus,
  Wrench,
  Hammer,
  Activity,
  PlusCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  Maximize2,
  Zap,
  FileSearch,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CloudFormationOperationCard from '@/components/CloudFormationOperationCard';
import { ExecutiveSummaryContent } from '@/components/ExecutiveSummary';
import { IS_PUBLIC_SITE } from '@/config/appConfig';
import RecommendationBlueprintRunFlow from '@/components/recommendations/RecommendationBlueprintRunFlow';
import { buildReportEntryKey } from '@/helpers/accountScans';
import { fetchAllRecommendations, refreshUserProfile } from '@/features/auth/authSlice';
import { getOverviewData } from '@/features/overview/overviewSlice';
import { getAgentHistory } from '@/features/agent/agentSlice';
import { getWorkflows } from '@/features/workflow/workflowSlice';
import {
  appendChatMessages as appendChatMessagesThunk,
  getChatRecord,
  listRecentChats,
  setCurrentChatId,
  startChat as startChatThunk,
} from '@/features/chat/chatSlice';
import {
  setBriefing as setReduxBriefing,
  setSuggestionCards as setReduxSuggestionCards,
  setSuggestionPageAction as setReduxSuggestionPage,
} from '@/features/commandCenter/commandCenterSlice';
import {
  launchHealthScans,
  refreshEnvironmentHealth,
  selectEnvironmentHealthRequestsById,
  selectEnvironmentHealthResultsById,
  refreshWorkloadHealth,
  selectWorkloadHealthRequestsById,
  selectWorkloadHealthResultsById,
} from '@/features/health/healthSlice';
import {
  DEFAULT_HEALTH_MAX_AGE_HOURS,
  extractHealthResources,
  isFreshTimestamp,
} from '@/features/health/healthUtils';
import {
  launchEnvironmentCostScans,
  refreshEnvironmentCostAnalysis,
  selectEnvironmentCostRequestsById,
  selectEnvironmentCostResultsById,
} from '@/features/cost/costSlice';
import {
  ensureExecutiveSummary,
  refreshCommandCenterSuggestions,
  refreshRecommendationsFromScans,
  selectExecutiveSummaryRequestsByKey,
  selectExecutiveSummariesByKey,
  selectIsRecommendationsRefreshLoading,
  selectScannerUpdatesConnectionId,
  selectSuggestionRequestsByKey,
} from '@/features/operations/operationsSlice';
import {
  getCommandCenterBootstrap,
  getCommandCenterState,
  sendCommandCenterIntent,
  sendCommandCenterMessage,
  updateCommandCenterScope,
} from '@/api/commandCenterApi';
import { prepareHealthFindingsFile, prepareReportFile, sendChatMessage } from '@/api/chatApi';
import { analytics, ANALYTICS_EVENTS, getAnalyticsRoute } from '@/hooks/useAnalytics';
import {
  buildPermissionProfileLookup,
  matchesAgentRun,
  matchesRecommendationRecord,
  matchesReportScan,
  matchesWorkflowRun,
  matchesWorkload,
  selectActiveWorkspaceScope,
  selectWorkspaceScopedEnvironmentProfiles,
} from '@/features/workspace/workspaceScope';
import { hasRuntimeCapability, isLocalRuntime } from '@/runtime/cloudAgentRuntime';
import {
  canRunLocalAwsScannersForProfile,
  isAwsCredentialBackedProfile,
} from '@/features/workspace/credentialStatus';

const SCOPE_LIMITS_DEFAULT = {
  environments: { max: 3, used: 0 },
  workloads: { max: 5, used: 0 },
  reports: { max: 3, used: 0 },
};

const EMPTY_SCOPE = {
  environments: [],
  workloads: [],
  reports: [],
};

function areJsonSnapshotsEqual(left, right) {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

const STARTUP_CATEGORY_BATCH_SIZE = 4;
const STARTUP_RECOMMENDATIONS_PER_CATEGORY = 4;
const EXCLUDED_STARTUP_CATEGORY_IDS = new Set(['reports-to-run']);

const COMMAND_CENTER_SMART_GROUPS = [
  {
    id: 'critical-security',
    label: 'Critical Security',
    filter: { priorities: ['Critical'], domains: ['Security'] },
  },
  {
    id: 'health',
    label: 'Health',
    filter: { sourceType: 'health' },
  },
  {
    id: 'reports-to-run',
    label: 'Reports to Run',
    filter: { sourceType: 'local_rule', actionType: 'report' },
  },
  {
    id: 'platform-insights',
    label: 'Platform Recommendations',
    filter: { sourceType: 'local_rule', excludeActionType: 'report' },
  },
  {
    id: 'cost-savings',
    label: 'Cost Savings',
    filter: {
      domains: ['Cost and Usage'],
      categories: ['Cost Optimization', 'Commitment Savings', 'Cost Monitoring', 'Resource Cleanup'],
    },
  },
  {
    id: 'resource-cleanup',
    label: 'Resource Cleanup',
    filter: { categories: ['Resource Cleanup', 'Cost Optimization'] },
  },
  {
    id: 'compliance',
    label: 'Compliance',
    filter: { categories: ['Compliance', 'Audit Trail'] },
  },
  {
    id: 'network-security',
    label: 'Network Security',
    filter: { categories: ['Network Security', 'Access Control'] },
  },
  {
    id: 'data-protection',
    label: 'Data Protection',
    filter: { categories: ['Data Protection'] },
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    filter: { categories: ['Cost Monitoring', 'Audit Trail', 'Commitment Savings'] },
  },
];

const RUNNING_STATUS_SET = new Set(['running', 'in_progress', 'started', 'processing']);
const WAITING_STATUS_SET = new Set([
  'waiting',
  'waiting_on_user_input',
  'agent_waiting_on_user_input',
  'waiting_on_user',
  'pending',
  'paused',
  'pending_approval',
  'approval_required',
]);
const FAILED_STATUS_SET = new Set(['failed', 'error']);
const COMPLETED_STATUS_SET = new Set([
  'successful',
  'partial_success',
  'complete',
  'completed',
  'done',
  'success',
  'succeeded',
]);
const REPORT_SUCCESS_STATUS_SET = new Set([
  'successful',
  'partial_success',
  'complete',
  'completed',
  'done',
]);
const COMMAND_CENTER_CHAT_SOURCE = 'CommandCenter';

const COMMAND_PATH_SUGGESTED = 'suggested';
const COMMAND_PATH_CUSTOM = 'custom';
const COMMAND_PATHS = [
  {
    id: COMMAND_PATH_SUGGESTED,
    label: 'Recommended By CloudAgent',
    icon: Sparkles,
    shortDesc: 'Review recommendations personalized for your environment',
    description: 'View prioritized recommendations and review insights curated for your environments.',
    inputHint: 'Select a suggestion card above, or type your question below.',
  },
  {
    id: COMMAND_PATH_CUSTOM,
    label: 'Type a question or task',
    icon: Send,
    shortDesc: 'Build configuration, review infrastructure, or ask anything',
    description: 'Describe what you want to accomplish and CloudAgent will help you get there.',
    // inputHint: 'Describe what you want to accomplish. Add scope for precision, or leave blank and CloudAgent will ask follow-ups.',
  },
];
const DEFAULT_PATH_INPUT_HINT = '' // 'Use a suggested action, or tell CloudAgent what to do in your own words.';

const MAX_VISIBLE_CARDS = 8;
const MAX_HEALTH_FINDINGS_MESSAGE_CHARS = 24000;


function getToolStatusLabel(toolName) {
  switch (toolName) {
    case 'permission_profile_list':
      return 'Fetched permission profile context';
    case 'aws_cli_readonly':
      return 'Ran AWS CLI read-only checks';
    case 'azure_cli_readonly':
      return 'Ran Azure CLI read-only checks';
    case 'list_workloads':
      return 'Loaded workloads';
    case 'list_recommendations':
      return 'Loaded recommendations';
    case 'list_report_history':
      return 'Loaded reports';
    case 'prepare_report_file':
      return 'Prepared report context';
    case 'session_context_update':
    case 'update_session_context':
      return 'Updated session context';
    default:
      return `Used ${toolName}`;
  }
}

function normalizeToolExecution(run, fallbackName = 'tool') {
  if (!run || typeof run !== 'object') return null;
  const name = String(run.name || fallbackName || 'tool').trim() || 'tool';
  return {
    id: run.id || `tool_run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    status: String(run.status || 'completed').trim().toLowerCase() || 'completed',
    input: run.input ?? null,
    output: run.output ?? null,
  };
}

function getToolRunPrimaryDetail(run) {
  const command = typeof run?.input?.command === 'string' ? run.input.command.trim() : '';
  if (command) return command;
  const accountId = typeof run?.input?.accountId === 'string' ? run.input.accountId.trim() : '';
  if (accountId) return `Account ${accountId}`;
  return '';
}

function groupToolRuns(toolNames = [], toolExecutions = []) {
  const grouped = [];
  const byName = new Map();

  for (const rawExecution of Array.isArray(toolExecutions) ? toolExecutions : []) {
    const execution = normalizeToolExecution(rawExecution);
    if (!execution) continue;
    if (!byName.has(execution.name)) {
      const entry = { name: execution.name, count: 0, runs: [] };
      byName.set(execution.name, entry);
      grouped.push(entry);
    }
    const group = byName.get(execution.name);
    group.count += 1;
    group.runs.push(execution);
  }

  for (const toolName of Array.isArray(toolNames) ? toolNames : []) {
    const normalizedName = String(toolName || '').trim();
    if (!normalizedName) continue;
    if (!byName.has(normalizedName)) {
      const entry = { name: normalizedName, count: 0, runs: [] };
      byName.set(normalizedName, entry);
      grouped.push(entry);
    }
    const group = byName.get(normalizedName);
    if (group.count === 0) {
      group.count = 1;
    }
  }

  return grouped;
}

function formatToolPayload(value) {
  if (value == null) return 'No data captured.';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getToolEventName(event) {
  if (typeof event === 'string') return event;
  if (event && typeof event === 'object') return String(event.name || event.toolName || 'tool').trim() || 'tool';
  return 'tool';
}

function normalizeLiveToolEvent(event, fallbackStatus = 'in_progress') {
  if (typeof event === 'string') {
    return {
      id: `tool_live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: getToolEventName(event),
      status: fallbackStatus,
      input: null,
      output: null,
    };
  }
  if (!event || typeof event !== 'object') return null;
  return normalizeToolExecution({
    id: event.id || event.callId || event.itemId || null,
    name: getToolEventName(event),
    status: event.status || fallbackStatus,
    input: event.input ?? null,
    output: event.output ?? event.content ?? null,
  });
}

function upsertLiveToolExecution(previousRuns = [], event, fallbackStatus = 'in_progress') {
  const normalized = normalizeLiveToolEvent(event, fallbackStatus);
  if (!normalized) return previousRuns;
  const next = [...previousRuns];
  let existingIndex = next.findIndex((run) => run.id && normalized.id && run.id === normalized.id);
  const normalizedCommand = typeof normalized.input?.command === 'string' ? normalized.input.command.trim() : '';
  if (existingIndex === -1 && normalizedCommand) {
    existingIndex = next.findIndex((run) => (
      run.name === normalized.name
      && typeof run.input?.command === 'string'
      && run.input.command.trim() === normalizedCommand
    ));
  }
  if (existingIndex === -1) {
    next.push(normalized);
    return next;
  }
  const existing = next[existingIndex];
  next[existingIndex] = {
    ...existing,
    ...normalized,
    input: normalized.input ?? existing.input ?? null,
    output: normalized.output ?? existing.output ?? null,
  };
  return next;
}

function parseAuthProfile(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw;
  return {};
}

function parseJsonObject(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') return raw;
  return null;
}

function isAwsAccountProfile(profile) {
  const normalizedType = String(profile?.type || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');
  return normalizedType === 'aws account';
}

function isAwsOrgProfile(profile) {
  const normalizedType = String(profile?.type || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');
  return normalizedType === 'aws org';
}

function isAzureTenantProfile(profile) {
  const authProfile = safeParseJson(profile?.authProfile, {});
  const normalizedType = String(profile?.type || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');
  return normalizedType === 'azure tenant' || (authProfile?.provider === 'azure' && !authProfile?.subscriptionId);
}

function isAzureSubscriptionProfile(profile) {
  const authProfile = safeParseJson(profile?.authProfile, {});
  const normalizedType = String(profile?.type || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');
  return normalizedType === 'azure subscription' || (authProfile?.provider === 'azure' && Boolean(authProfile?.subscriptionId));
}

function getCostCloudProvider(profile) {
  return isAzureTenantProfile(profile) || isAzureSubscriptionProfile(profile) ? 'azure' : 'aws';
}

function getAzureCostRefreshTargets(profile, allProfiles = []) {
  const permissionProfileId = getProfileRecordId(profile);
  if (!permissionProfileId) return [];
  if (!isAzureTenantProfile(profile)) {
    return [{ permissionProfileId, cloudProvider: getCostCloudProvider(profile) }];
  }

  const authProfile = safeParseJson(profile?.authProfile, {});
  const tenantId = String(authProfile?.tenantId || '').trim();
  const subscriptionTargets = (Array.isArray(allProfiles) ? allProfiles : [])
    .filter((candidate) => {
      if (!isAzureSubscriptionProfile(candidate)) return false;
      const candidateAuth = safeParseJson(candidate?.authProfile, {});
      return String(candidateAuth?.tenantId || '').trim() === tenantId;
    })
    .map((candidate) => ({
      permissionProfileId: getProfileRecordId(candidate),
      cloudProvider: 'azure',
    }))
    .filter((target) => target.permissionProfileId);

  const seen = new Set();
  return [{ permissionProfileId, cloudProvider: 'azure' }, ...subscriptionTargets].filter((target) => {
    if (seen.has(target.permissionProfileId)) return false;
    seen.add(target.permissionProfileId);
    return true;
  });
}

function getAnalysisArtifactMetadataFromProfile(profile, analysisType = 'cost') {
  const summary = parseJsonObject(profile?.summary);
  const analysis = summary?.analysis;
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) return null;
  const artifact = analysis?.[analysisType];
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) return null;
  return artifact;
}

function getAnalysisSummaryFromProfile(profile, analysisType = 'cost') {
  const artifact = getAnalysisArtifactMetadataFromProfile(profile, analysisType);
  const summary = artifact?.summary;
  return summary && typeof summary === 'object' && !Array.isArray(summary) ? summary : null;
}

function getProfileRecordId(profile) {
  return String(profile?.recordId || profile?.id || profile?.permissionProfileId || '').trim();
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeParseJson(raw, fallback = null) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  if (typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeHealthStatus(status) {
  return typeof status === 'string' && status.toLowerCase() === 'healthy'
    ? 'healthy'
    : 'not_healthy';
}

function isSkippedHealthError(errorText) {
  if (typeof errorText !== 'string') return false;
  const lower = errorText.toLowerCase();
  return lower.includes('not implemented') || lower.includes('not supported');
}

function getResourceHealthParts(resource) {
  const resourceHealth =
    resource?.health && typeof resource.health === 'object' ? resource.health : null;
  const checks = Array.isArray(resourceHealth?.checks)
    ? resourceHealth.checks
    : Array.isArray(resource?.checks)
      ? resource.checks
      : [];
  const errors = Array.isArray(resourceHealth?.errors)
    ? resourceHealth.errors
    : Array.isArray(resource?.errors)
      ? resource.errors
      : [];
  const generatedAt =
    resourceHealth?.generatedAt || resource?.generatedAt || resourceHealth?.result?.generatedAt || '';
  const result =
    resourceHealth?.result && typeof resourceHealth.result === 'object'
      ? resourceHealth.result
      : {};

  return { checks, errors, generatedAt, result };
}

function summarizeHealthResources(resources = []) {
  const normalized = Array.isArray(resources) ? resources : [];
  let resourcesWithChecks = 0;
  let resourcesWithIssues = 0;
  let resourcesSkipped = 0;
  let latestGeneratedAt = '';

  normalized.forEach((resource) => {
    const { checks, errors, generatedAt } = getResourceHealthParts(resource);
    const realErrors = errors.filter((entry) => !isSkippedHealthError(entry));
    const skippedErrors = errors.filter(isSkippedHealthError);

    if (checks.length === 0 && skippedErrors.length > 0 && realErrors.length === 0) {
      resourcesSkipped += 1;
      return;
    }
    if (checks.length === 0 && errors.length === 0) {
      return;
    }

    resourcesWithChecks += 1;
    const hasIssue =
      realErrors.length > 0 ||
      checks.some((check) => normalizeHealthStatus(check?.status) !== 'healthy');
    if (hasIssue) {
      resourcesWithIssues += 1;
    }

    if (generatedAt && (!latestGeneratedAt || new Date(generatedAt) > new Date(latestGeneratedAt))) {
      latestGeneratedAt = generatedAt;
    }
  });

  return {
    total: normalized.length,
    evaluated: resourcesWithChecks,
    healthy: resourcesWithChecks - resourcesWithIssues,
    issues: resourcesWithIssues,
    skipped: resourcesSkipped,
    latestGeneratedAt,
  };
}

function summarizeCostChecks(checks = [], statusCounts = null) {
  const computed = {
    total: 0,
    healthy: 0,
    problem: 0,
    unknown: 0,
    error: 0,
  };

  const list = Array.isArray(checks) ? checks : [];
  list.forEach((check) => {
    if (!check || typeof check !== 'object') return;
    computed.total += 1;
    const status = String(check.status || '').trim().toLowerCase();
    if (status === 'healthy') computed.healthy += 1;
    else if (status === 'problem') computed.problem += 1;
    else if (status === 'error') computed.error += 1;
    else computed.unknown += 1;
  });

  if (!statusCounts || typeof statusCounts !== 'object') {
    return computed;
  }

  const asNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const merged = {
    total: asNumber(statusCounts.total) || computed.total,
    healthy: asNumber(statusCounts.healthy) || computed.healthy,
    problem: asNumber(statusCounts.problem) || computed.problem,
    unknown: asNumber(statusCounts.unknown) || computed.unknown,
    error: asNumber(statusCounts.error) || computed.error,
  };
  if (!merged.total) {
    merged.total = merged.healthy + merged.problem + merged.unknown + merged.error;
  }
  return merged;
}

function pickAmountFromCostEntry(entry) {
  if (typeof entry === 'number') return Number.isFinite(entry) ? entry : null;
  if (!entry || typeof entry !== 'object') return null;

  const candidates = [
    entry.amount,
    entry.cost,
    entry.total,
    entry.totalCost,
    entry.unblendedCost,
    entry.blendedCost,
    entry.value,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function pickDateFromCostEntry(entry) {
  if (!entry || typeof entry !== 'object') return '';
  return entry.date || entry.timePeriod?.Start || entry.start || '';
}

function processCostDailyTotalData(dailyTotal) {
  if (!Array.isArray(dailyTotal)) return [];
  return dailyTotal
    .map((entry) => {
      if (typeof entry === 'number') {
        return { amount: entry };
      }
      if (!entry || typeof entry !== 'object') return null;
      const amount = pickAmountFromCostEntry(entry);
      const date = pickDateFromCostEntry(entry);
      return {
        date,
        amount: amount || 0,
      };
    })
    .filter(Boolean);
}

function calculateSpendMetrics(dailyData) {
  if (!Array.isArray(dailyData) || dailyData.length === 0) {
    return { total: 0, average: 0, trend: 0, latest: 0 };
  }

  const total = dailyData.reduce((sum, entry) => sum + (entry.amount || 0), 0);
  const average = total / dailyData.length;
  const latest = dailyData[dailyData.length - 1]?.amount || 0;

  const midpoint = Math.floor(dailyData.length / 2);
  const firstHalf = dailyData.slice(0, midpoint);
  const secondHalf = dailyData.slice(midpoint);
  const firstHalfAvg = firstHalf.length > 0
    ? firstHalf.reduce((sum, entry) => sum + (entry.amount || 0), 0) / firstHalf.length
    : 0;
  const secondHalfAvg = secondHalf.length > 0
    ? secondHalf.reduce((sum, entry) => sum + (entry.amount || 0), 0) / secondHalf.length
    : 0;
  const trend = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;

  return { total, average, trend, latest };
}

function formatCurrencyCompact(amount, currency = 'USD') {
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: Math.abs(safeAmount) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(safeAmount) >= 1000 ? 1 : 0,
  }).format(safeAmount);
}

function formatRelativeAge(value) {
  if (!value) return 'Never';
  const timestamp = Date.parse(String(value));
  if (!Number.isFinite(timestamp)) return 'Unknown';

  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatCountLabel(count, singular, plural = `${singular}s`) {
  const value = Number(count || 0);
  return `${value} ${value === 1 ? singular : plural}`;
}

function buildSpendSummary(healthCheckEnvironments = [], environmentCostById = {}) {
  const now = new Date();
  const rollingWindowStart = new Date(now);
  rollingWindowStart.setDate(rollingWindowStart.getDate() - 29);
  rollingWindowStart.setHours(0, 0, 0, 0);

  const environmentRows = (healthCheckEnvironments || []).map((environment) => {
    const environmentId = getProfileRecordId(environment);
    const findings = unwrapScannerRecord(environmentCostById?.[environmentId]?.findings) || null;
    const costArtifact = getAnalysisArtifactMetadataFromProfile(environment, 'cost');
    const profileSummary = getAnalysisSummaryFromProfile(environment, 'cost');
    const dailyTotalData = processCostDailyTotalData(
      Array.isArray(findings?.data?.spend?.dailyTotal) ? findings.data.spend.dailyTotal : []
    );
    const rolling30DayData = dailyTotalData.filter((entry) => {
      const parsed = Date.parse(entry?.date || '');
      if (!Number.isFinite(parsed)) return false;
      const entryDate = new Date(parsed);
      return entryDate >= rollingWindowStart && entryDate <= now;
    });
    const spendMetrics = calculateSpendMetrics(rolling30DayData);
    const summarySpend = toFiniteNumber(
      profileSummary?.rolling30DaySpend ?? profileSummary?.totalSpend ?? profileSummary?.total,
      0
    );
    const summaryAverage = toFiniteNumber(profileSummary?.averageDailySpend, 0);
    const summaryLatest = toFiniteNumber(profileSummary?.latestDailySpend, 0);
    const generatedAt =
      findings?.generatedAt ||
      findings?.updatedAt ||
      costArtifact?.generatedAt ||
      costArtifact?.createdAt ||
      costArtifact?.timestamp ||
      null;
    const hasFullSpendData = rolling30DayData.length > 0;
    const hasSummarySpendData = Boolean(profileSummary) && (
      toFiniteNumber(profileSummary?.dailyDataPoints, 0) > 0 ||
      summarySpend > 0 ||
      summaryAverage > 0 ||
      summaryLatest > 0
    );

    return {
      id: environmentId,
      name: environment?.name || environmentId || 'Environment',
      totalSpend: hasFullSpendData ? spendMetrics.total : summarySpend,
      averageDailySpend: hasFullSpendData ? spendMetrics.average : summaryAverage,
      latestDailySpend: hasFullSpendData ? spendMetrics.latest : summaryLatest,
      generatedAt,
      issueCount: toFiniteNumber(profileSummary?.issueCount, 0),
      anomalyCount: toFiniteNumber(profileSummary?.anomalyCount, 0),
      optimizationCount:
        toFiniteNumber(profileSummary?.rightsizingRecommendationCount, 0) +
        toFiniteNumber(profileSummary?.costOptimizationRecommendationCount, 0) +
        toFiniteNumber(profileSummary?.computeOptimizerRecommendationCount, 0),
      hasData: hasFullSpendData || hasSummarySpendData,
      source: hasFullSpendData ? 'artifact' : hasSummarySpendData ? 'summary' : null,
    };
  }).filter((row) => row.id);

  const rowsWithData = environmentRows.filter((row) => row.hasData);
  const totalSpend = rowsWithData.reduce((sum, row) => sum + (row.totalSpend || 0), 0);
  const freshestGeneratedAt = rowsWithData.reduce((latest, row) => {
    if (!row.generatedAt) return latest;
    if (!latest) return row.generatedAt;
    return new Date(row.generatedAt) > new Date(latest) ? row.generatedAt : latest;
  }, null);

  return {
    totalSpend,
    environmentCountWithData: rowsWithData.length,
    environmentCount: environmentRows.length,
    generatedAt: freshestGeneratedAt,
    periodLabel: 'Last 30 Days',
    rows: rowsWithData.sort((a, b) => (b.totalSpend || 0) - (a.totalSpend || 0)),
  };
}

function unwrapScannerRecord(record) {
  if (!record || typeof record !== 'object') return null;
  return record.payload && typeof record.payload === 'object' ? record.payload : record;
}

function normalizeWorkflowRunContext(value) {
  if (!value || typeof value !== 'object') return null;
  const workflowRunId = String(value.workflowRunId || '').trim();
  if (!workflowRunId) return null;
  return {
    workflowRunId,
    workflowId: value.workflowId ? String(value.workflowId).trim() : null,
    title: value.title ? String(value.title).trim() : null,
    status: value.status || value.workflowStatus ? String(value.status || value.workflowStatus).trim() : null,
    startedAt: value.startedAt || null,
    completedAt: value.completedAt || null,
    updatedAt: value.updatedAt || null,
  };
}

function normalizeThreatSummary(profile) {
  const artifact = getAnalysisArtifactMetadataFromProfile(profile, 'threat');
  const summary = getAnalysisSummaryFromProfile(profile, 'threat');
  if (!summary) return null;

  const findings = summary.findings && typeof summary.findings === 'object' ? summary.findings : {};
  const severity = findings.severity && typeof findings.severity === 'object' ? findings.severity : {};
  const generatedAt = artifact?.generatedAt || artifact?.createdAt || artifact?.timestamp || null;
  const totalFindings = toFiniteNumber(findings.total, 0);
  const criticalHighCount =
    toFiniteNumber(severity.critical ?? severity.CRITICAL, 0) +
    toFiniteNumber(severity.high ?? severity.HIGH, 0);

  return {
    id: getProfileRecordId(profile),
    name: profile?.name || getProfileRecordId(profile) || 'Environment',
    generatedAt,
    totalFindings,
    criticalHighCount,
    guardDutyFindings: toFiniteNumber(findings.guardDuty, 0),
    inspectorFindings: toFiniteNumber(findings.inspector, 0),
    accessAnalyzerFindings: toFiniteNumber(findings.accessAnalyzer, 0),
    publicFindings: toFiniteNumber(summary.accessAnalyzer?.publicFindings, 0),
    nonCompliantManagedInstances: toFiniteNumber(summary.patchCompliance?.nonCompliantManagedInstances, 0),
    unmanagedEc2Instances: toFiniteNumber(summary.patchCompliance?.unmanagedEc2Instances, 0),
    guardDutyEnabled: summary.guardDuty?.enabled === true,
    analyzerCount: toFiniteNumber(summary.accessAnalyzer?.analyzerCount, 0),
  };
}

function buildThreatSnapshot(environments = []) {
  const rows = (environments || [])
    .map(normalizeThreatSummary)
    .filter((row) => row?.id);
  const rowsWithData = rows.filter((row) =>
    row.generatedAt ||
    row.totalFindings > 0 ||
    row.guardDutyFindings > 0 ||
    row.inspectorFindings > 0 ||
    row.accessAnalyzerFindings > 0 ||
    row.nonCompliantManagedInstances > 0 ||
    row.unmanagedEc2Instances > 0
  );
  const freshestGeneratedAt = rowsWithData.reduce((latest, row) => {
    if (!row.generatedAt) return latest;
    if (!latest) return row.generatedAt;
    return new Date(row.generatedAt) > new Date(latest) ? row.generatedAt : latest;
  }, null);

  return {
    totalFindings: rowsWithData.reduce((sum, row) => sum + row.totalFindings, 0),
    criticalHighCount: rowsWithData.reduce((sum, row) => sum + row.criticalHighCount, 0),
    publicFindings: rowsWithData.reduce((sum, row) => sum + row.publicFindings, 0),
    nonCompliantManagedInstances: rowsWithData.reduce(
      (sum, row) => sum + row.nonCompliantManagedInstances,
      0
    ),
    environmentsWithData: rowsWithData.length,
    environmentCount: rows.length,
    generatedAt: freshestGeneratedAt,
    rows: rowsWithData.sort((a, b) => (b.totalFindings || 0) - (a.totalFindings || 0)),
  };
}

function buildHealthInsightFromProfileSummary(environment) {
  const environmentId = getProfileRecordId(environment);
  if (!environmentId) return null;

  const artifact = getAnalysisArtifactMetadataFromProfile(environment, 'health');
  const summary = getAnalysisSummaryFromProfile(environment, 'health');
  const resourceCounts =
    summary?.resourceCounts && typeof summary.resourceCounts === 'object'
      ? summary.resourceCounts
      : {};
  const generatedAt = artifact?.generatedAt || artifact?.createdAt || artifact?.timestamp || null;
  const hasSummary = Boolean(summary) || Boolean(generatedAt);
  if (!hasSummary) return null;

  const stats = {
    total: toFiniteNumber(resourceCounts.total, 0),
    evaluated: toFiniteNumber(resourceCounts.evaluated, 0),
    healthy: toFiniteNumber(resourceCounts.healthy, 0),
    issues: toFiniteNumber(resourceCounts.issues, 0),
    skipped: toFiniteNumber(resourceCounts.skipped, 0),
    latestGeneratedAt: generatedAt,
  };

  return {
    stats,
    findings: {
      type: 'environment',
      permissionProfileId: environmentId,
      environmentName: environment?.name || environmentId,
      generatedAt,
      version: artifact?.version || null,
      cache: null,
      resources: [],
      summaryOnly: true,
    },
  };
}

function buildBriefingHealthSnapshot({
  availableWorkloads = [],
  healthCheckEnvironments = [],
  workloadHealthById = {},
  environmentHealthById = {},
} = {}) {
  const workloadItems = (availableWorkloads || [])
    .filter((workload) => !String(workload?.workloadName || workload?.workloadId || '').startsWith('PermissionProfile-'))
    .map((workload) => {
      const workloadId = String(workload?.workloadId || '').trim();
      const insight = workloadHealthById?.[workloadId] || null;
      const stats = insight?.stats || {};
      const lastCheckedAt = stats?.latestGeneratedAt || null;
      const isStale = lastCheckedAt ? !isFreshTimestamp(lastCheckedAt, DEFAULT_HEALTH_MAX_AGE_HOURS) : true;
      const issueCount = Number(stats?.issues || 0);
      const evaluated = Number(stats?.evaluated || 0);
      const healthyResources = Number(stats?.healthy || 0);
      return {
        id: workloadId,
        type: 'workload',
        name: workload?.workloadName || workloadId || 'Workload',
        issueCount,
        evaluated,
        healthyResources,
        lastCheckedAt,
        isStale,
        hasAttention: issueCount > 0,
      };
    })
    .filter((item) => item.id);

  const environmentItems = (healthCheckEnvironments || [])
    .map((environment) => {
      const environmentId = String(environment?.recordId || '').trim();
      const insight = environmentHealthById?.[environmentId] || null;
      const stats = insight?.stats || {};
      const lastCheckedAt = insight?.findings?.generatedAt || stats?.latestGeneratedAt || null;
      const isStale = lastCheckedAt ? !isFreshTimestamp(lastCheckedAt, DEFAULT_HEALTH_MAX_AGE_HOURS) : true;
      const issueCount = Number(stats?.issues || 0);
      const evaluated = Number(stats?.evaluated || 0);
      const healthyResources = Number(stats?.healthy || 0);
      return {
        id: environmentId,
        type: 'environment',
        name: environment?.name || environmentId || 'Environment',
        issueCount,
        evaluated,
        healthyResources,
        lastCheckedAt,
        isStale,
        hasAttention: issueCount > 0,
      };
    })
    .filter((item) => item.id);

  const combined = [...workloadItems, ...environmentItems];
  const healthyResourceTotal = combined.reduce((sum, item) => sum + (item.healthyResources || 0), 0);
  const evaluatedResourceTotal = combined.reduce((sum, item) => sum + (item.evaluated || 0), 0);

  return {
    totalTargets: combined.length,
    workloadCount: workloadItems.length,
    environmentCount: environmentItems.length,
    unhealthyWorkloads: workloadItems.filter((item) => item.hasAttention).length,
    issueCountTotal: combined.reduce((sum, item) => sum + (item.issueCount || 0), 0),
    staleCount: combined.filter((item) => item.isStale).length,
    healthyResourcePercentage: evaluatedResourceTotal > 0
      ? Math.round((healthyResourceTotal / evaluatedResourceTotal) * 100)
      : null,
    highlights: combined
      .filter((item) => item.hasAttention || item.isStale)
      .sort((a, b) => {
        if ((b.issueCount || 0) !== (a.issueCount || 0)) {
          return (b.issueCount || 0) - (a.issueCount || 0);
        }
        const dateA = Date.parse(a.lastCheckedAt || '') || 0;
        const dateB = Date.parse(b.lastCheckedAt || '') || 0;
        return dateA - dateB;
      })
      .slice(0, 4)
      .map((item) => ({
        type: item.type,
        name: item.name,
        issueCount: item.issueCount,
        isStale: item.isStale,
      })),
  };
}

function buildRecentActivityItems({
  workflows = [],
  agents = [],
  reports = [],
} = {}) {
  const items = [];
  const toTimestamp = (...candidates) => {
    for (const value of candidates) {
      if (!value) continue;
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  };

  (workflows || []).forEach((workflow) => {
    const queueStatus = classifyQueueStatus(workflow?.workflowStatus);
    if (queueStatus !== 'completed' && queueStatus !== 'failed') return;
    const runId = workflow?.workflowRunId || workflow?.workflowId || null;
    items.push({
      id: `workflow:${runId || getWorkflowTitle(workflow)}:${workflow?.updatedAt || workflow?.lastUpdateTime || workflow?.createdAt || 'unknown'}`,
      type: 'workflow',
      title: getWorkflowTitle(workflow),
      outcome: queueStatus,
      status: workflow?.workflowStatus || null,
      updatedAt: workflow?.updatedAt || workflow?.lastUpdateTime || workflow?.createdAt || null,
      path: runId ? `/dashboard/workflow-history/${runId}` : '/dashboard/workflow-history',
      sortKey: toTimestamp(workflow?.updatedAt, workflow?.lastUpdateTime, workflow?.createdAt),
    });
  });

  (agents || []).forEach((agent) => {
    const queueStatus = classifyQueueStatus(agent?.status);
    if (queueStatus !== 'completed' && queueStatus !== 'failed') return;
    const runId = agent?.recordId || agent?.itemId || null;
    items.push({
      id: `agent:${runId || extractAgentTitle(agent)}:${agent?.purchaseDate || agent?.updatedAt || agent?.createdAt || 'unknown'}`,
      type: 'agent',
      title: extractAgentTitle(agent),
      outcome: queueStatus,
      status: agent?.status || null,
      updatedAt: agent?.purchaseDate || agent?.updatedAt || agent?.createdAt || null,
      path: runId ? `/dashboard/agent/${runId}` : '/dashboard/agents',
      sortKey: toTimestamp(agent?.purchaseDate, agent?.updatedAt, agent?.createdAt),
    });
  });

  (reports || []).forEach((scan) => {
    const queueStatus = classifyReportQueueStatus(scan?.status);
    if (queueStatus !== 'completed' && queueStatus !== 'failed') return;
    const runId = buildReportEntryKey(scan) || scan?.scanId || scan?.reportId || null;
    items.push({
      id: `report:${runId || scan?.title || scan?.reportId || 'unknown'}:${scan?.lastUpdateTime || scan?.latestAssessmentDate || scan?.updatedAt || scan?.createdAt || 'unknown'}`,
      type: 'report',
      title: scan?.title || scan?.reportId || scan?.scanId || 'Report Run',
      outcome: queueStatus,
      status: scan?.status || null,
      updatedAt: scan?.lastUpdateTime || scan?.latestAssessmentDate || scan?.updatedAt || scan?.createdAt || null,
      path: '/dashboard',
      sortKey: toTimestamp(scan?.lastUpdateTime, scan?.latestAssessmentDate, scan?.updatedAt, scan?.createdAt),
    });
  });

  return items
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 8);
}

function buildRecommendationSummary(recommendations = []) {
  const counts = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  };

  (recommendations || []).forEach((recommendation) => {
    const priorityLabel = getPriorityLabel(getRecommendationPriorityValue(recommendation)) || 'Low';
    counts[priorityLabel] = (counts[priorityLabel] || 0) + 1;
  });

  return {
    total: (recommendations || []).length,
    counts,
  };
}

function buildScopedRecommendationSummary(recommendations = [], scopeType = 'environment') {
  const filtered = (recommendations || []).filter((recommendation) => {
    const resources = Array.isArray(recommendation?.targetResources) ? recommendation.targetResources : [];
    if (resources.length === 0) return false;
    if (scopeType === 'workload') {
      return resources.some((resource) => resource?.workloadId || resource?.workloadName);
    }
    return resources.some(
      (resource) => resource?.environmentId || resource?.environmentName || resource?.accountId
    );
  });

  return buildRecommendationSummary(filtered);
}

function serializeHealthCheck(check) {
  if (!check || typeof check !== 'object') return null;
  return {
    checkId: check.checkId || null,
    checkName: check.checkName || null,
    category: check.category || null,
    status: check.status || null,
    summary: check.summary || null,
    details: check.details ?? null,
    checkedAt: check.checkedAt || null,
  };
}

function serializeHealthResource(resource) {
  if (!resource || typeof resource !== 'object') return null;
  const { checks, errors, generatedAt, result } = getResourceHealthParts(resource);

  return {
    targetKey: resource.targetKey || null,
    resourceType: resource.resourceType || result.resourceType || null,
    identifier:
      resource.identifier
      || result.identifier
      || resource.resourceArn
      || resource.resourceId
      || resource.displayName
      || null,
    resourceArn: resource.resourceArn || result.resourceArn || null,
    resourceId: resource.resourceId || result.resourceId || null,
    region: resource.region || result.region || null,
    accountId: resource.accountId || result.accountId || null,
    displayName: resource.displayName || result.displayName || null,
    checks: checks.map(serializeHealthCheck).filter(Boolean),
    errors,
    generatedAt: generatedAt || null,
  };
}

function resolvePermissionProfileForScan(scan, permissionProfiles = []) {
  if (!scan || !Array.isArray(permissionProfiles)) {
    return { permissionProfileId: null, name: null };
  }

  const directPermissionProfileId = scan.permissionProfileId || scan.parentId || null;
  if (directPermissionProfileId) {
    const directProfile = permissionProfiles.find((profile) => profile.recordId === directPermissionProfileId);
    return {
      permissionProfileId: directPermissionProfileId,
      name: directProfile?.name || null,
    };
  }

  if (!scan.accountId) {
    return { permissionProfileId: null, name: null };
  }

  const scanAccountId = String(scan.accountId);
  const scanCloudProvider = scan.cloudProvider || 'aws';

  for (const profile of permissionProfiles) {
    const authProfile = parseAuthProfile(profile.authProfile);

    if (scanCloudProvider === 'google_workspace' && authProfile.provider === 'google_workspace') {
      if (authProfile.domain && String(authProfile.domain) === scanAccountId) {
        return {
          permissionProfileId: profile.recordId || profile.id || profile.permissionProfileId || null,
          name: profile.name || null,
        };
      }
    }

    const profileAccountId = authProfile.awsAccountId || authProfile.accountId;
    if (profileAccountId && String(profileAccountId) === scanAccountId) {
      return {
        permissionProfileId: profile.recordId || profile.id || profile.permissionProfileId || null,
        name: profile.name || null,
      };
    }
  }

  return { permissionProfileId: null, name: scanAccountId };
}

function isSummaryResultsShape(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const firstGroup = Object.values(value)[0];
  return !!firstGroup
    && typeof firstGroup === 'object'
    && !Array.isArray(firstGroup)
    && firstGroup.checks
    && firstGroup.resources;
}

function extractEmbeddedReportPayload(report) {
  const parsedDetails = parseJsonObject(report?.details);
  const parsedSummary = parseJsonObject(report?.summary);

  const complianceResults = parsedDetails?.complianceResults
    || parsedDetails?.complianceReport
    || parsedDetails?.results
    || parsedSummary?.complianceResults
    || parsedSummary?.complianceReport
    || null;

  const summaryResults = parsedDetails?.summaryResults
    || parsedDetails?.complianceSummary
    || parsedSummary?.summaryResults
    || parsedSummary?.complianceSummary
    || null;

  const summaryText = parsedSummary?.summaryText || parsedDetails?.summaryText || null;
  const embeddedAssessmentResultsUrl = report?.assessmentResultsUrl
    || parsedDetails?.assessmentResultsUrl
    || parsedDetails?.latestAssessmentResultUrl
    || parsedDetails?.latestAssessmentResultsUrl
    || parsedDetails?.assessment?.resultsUrl
    || parsedDetails?.assessmentResults?.url
    || parsedSummary?.assessmentResultsUrl
    || null;
  const embeddedScanId = report?.scanId
    || parsedDetails?.scanId
    || parsedSummary?.scanId
    || null;
  const embeddedReportId = report?.reportId
    || parsedDetails?.reportId
    || parsedSummary?.reportId
    || null;
  const embeddedReportDefinitionId = report?.reportDefinitionId
    || parsedDetails?.reportDefinitionId
    || parsedSummary?.reportDefinitionId
    || null;
  const embeddedReportPlanId = report?.reportPlanId
    || parsedDetails?.reportPlanId
    || parsedSummary?.reportPlanId
    || null;

  return {
    complianceResults,
    summaryResults,
    summaryText,
    assessmentResultsUrl: embeddedAssessmentResultsUrl,
    scanId: embeddedScanId,
    reportId: embeddedReportId,
    reportDefinitionId: embeddedReportDefinitionId,
    reportPlanId: embeddedReportPlanId,
  };
}

function resolveEmbeddedReportRenderer(report, payload) {
  const reportId = String(report?.reportId || '').toLowerCase();
  const explicitSummaryData = isSummaryResultsShape(payload?.summaryResults)
    || isSummaryResultsShape(payload?.complianceResults);
  if (explicitSummaryData) return 'summary';

  const explicitComplianceData = !!payload?.complianceResults
    && typeof payload.complianceResults === 'object'
    && !Array.isArray(payload.complianceResults)
    && Array.isArray(payload.complianceResults.results)
    && payload.complianceResults.controls
    && typeof payload.complianceResults.controls === 'object';
  if (explicitComplianceData) return 'compliance';

  if (reportId.includes('_compliance_')) return 'compliance';
  return 'summary';
}

function getReportPreviewKey(report) {
  if (!report || typeof report !== 'object') return null;
  return buildReportEntryKey(report) || report.id || report.scanId || report.reportId || null;
}

function reportPreviewMatchesScopeItem(preview, scopeItem) {
  if (!preview || !scopeItem) return false;
  if (scopeItem.id && preview.id && scopeItem.id === preview.id) return true;
  if (scopeItem.scanId && preview.scanId && scopeItem.scanId === preview.scanId) {
    if (scopeItem.reportId && preview.reportId) {
      return scopeItem.reportId === preview.reportId;
    }
    return !scopeItem.reportId && !preview.reportId;
  }
  if (scopeItem.reportId && preview.reportId && scopeItem.reportId === preview.reportId) {
    return !scopeItem.scanId && !preview.scanId;
  }
  return false;
}

function buildScopePayload(scope) {
  return {
    environments: (scope.environments || []).map((env) => env.id),
    workloads: (scope.workloads || []).map((workload) => workload.id),
    reports: (scope.reports || []).map((report) => report.id),
  };
}

function hasScopeSelections(scope) {
  const environmentsCount = Array.isArray(scope?.environments) ? scope.environments.length : 0;
  const workloadsCount = Array.isArray(scope?.workloads) ? scope.workloads.length : 0;
  const reportsCount = Array.isArray(scope?.reports) ? scope.reports.length : 0;
  return environmentsCount + workloadsCount + reportsCount > 0;
}

function hasStartBriefCardsInMessages(messages = []) {
  return (messages || []).some((message) => {
    const blocks = Array.isArray(message?.blocks) ? message.blocks : [];
    return blocks.some((block) => {
      if (block?.type !== 'start_brief') return false;
      const cards = Array.isArray(block?.payload?.cards) ? block.payload.cards : [];
      return cards.length > 0;
    });
  });
}

function looksLikeOpenAIFileId(value) {
  return typeof value === 'string' && /^file-[A-Za-z0-9]/.test(value);
}

function getReportScopeKey(report) {
  if (!report || typeof report !== 'object') return null;
  return (
    buildReportEntryKey(report)
    || (looksLikeOpenAIFileId(report.id) ? null : report.id)
    || report.scanId
    || report.reportId
    || null
  );
}

function getSessionReportContextKey(report) {
  if (!report || typeof report !== 'object') return null;
  return getReportScopeKey(report) || report.fileId || null;
}

function getExecutiveSummaryContextKey(summary) {
  if (!summary || typeof summary !== 'object' || !summary.id) return null;
  return `${summary.type || 'environment'}:${summary.id}`;
}

function getHealthFindingContextKey(finding) {
  if (!finding || typeof finding !== 'object') return null;
  return (
    finding.id
    || [
      finding.reviewKind || 'health',
      finding.type || '',
      finding.targetId || finding.workloadId || finding.permissionProfileId || finding.fileId || '',
    ].join(':')
  );
}

function buildCommandCenterSessionContext(
  scope,
  notes = '',
  fetched = [],
  reportContextByKey = {},
  executiveSummaryContextByKey = {},
  healthFindingsContextByKey = {},
  environmentContextById = {},
  workflowRunContextById = {}
) {
  const scopedReports = (scope?.reports || []).map((report) => {
    const reportKey = getReportScopeKey(report);
    const contextEntry = reportKey ? reportContextByKey?.[reportKey] : null;
    const fallbackFileId = looksLikeOpenAIFileId(report.id) ? report.id : null;
    const title = contextEntry?.title || report.name || report.title || report.reportId || report.scanId || report.id;
    return {
      id: reportKey || report.id || null,
      scanId: report.scanId || contextEntry?.scanId || null,
      reportId: report.reportId || contextEntry?.reportId || null,
      title,
      permissionProfileId: report.permissionProfileId || contextEntry?.permissionProfileId || null,
      fileId: report.fileId || contextEntry?.fileId || fallbackFileId || null,
      reportDefinitionId: report.reportDefinitionId || contextEntry?.reportDefinitionId || null,
      reportPlanId: report.reportPlanId || contextEntry?.reportPlanId || null,
    };
  });
  const scopedReportKeys = new Set(
    scopedReports
      .map((report) => getSessionReportContextKey(report))
      .filter(Boolean)
      .map((key) => String(key))
  );
  const contextOnlyReports = Object.entries(reportContextByKey || {})
    .map(([key, entry]) => ({
      id: key || null,
      scanId: entry?.scanId || null,
      reportId: entry?.reportId || null,
      title: entry?.title || entry?.name || key || 'Report',
      permissionProfileId: entry?.permissionProfileId || null,
      fileId: entry?.fileId || null,
      reportDefinitionId: entry?.reportDefinitionId || null,
      reportPlanId: entry?.reportPlanId || null,
    }))
    .filter((report) => {
      const reportKey = getSessionReportContextKey(report);
      return reportKey && !scopedReportKeys.has(String(reportKey));
    });

  return {
    environments: (scope?.environments || []).map((env) => ({
      permissionProfileId: env.id,
      name: env.name,
      cloudProvider: env.cloudProvider || null,
      ...(environmentContextById?.[env.id] || {}),
    })),
    workloads: (scope?.workloads || []).map((workload) => ({
      workloadId: workload.id,
      workloadName: workload.name,
    })),
    reports: [...scopedReports, ...contextOnlyReports],
    executiveSummaries: Object.entries(executiveSummaryContextByKey || {}).map(([key, entry]) => {
      const [type, id] = key.split(':');
      return {
        type: type || 'environment',
        id: id || entry?.id || null,
        name: entry?.name || null,
        summaryText: entry?.summaryText || null,
        updatedAt: entry?.updatedAt || null,
        sources: entry?.sources || null,
      };
    }),
    healthFindings: Object.entries(healthFindingsContextByKey || {}).map(([key, entry]) => ({
      id: entry?.id || key,
      reviewKind: entry?.reviewKind || 'health',
      type: entry?.type || null,
      targetId: entry?.targetId || null,
      targetName: entry?.targetName || null,
      permissionProfileId: entry?.permissionProfileId || null,
      workloadId: entry?.workloadId || null,
      title: entry?.title || null,
      fileId: entry?.fileId || null,
      loadedAt: entry?.loadedAt || entry?.uploadedAt || null,
    })),
    workflowRuns: Object.values(workflowRunContextById || {})
      .map((entry) => normalizeWorkflowRunContext(entry))
      .filter(Boolean),
    notes: typeof notes === 'string' ? notes : '',
    fetched: Array.isArray(fetched) ? fetched.slice(-50) : [],
  };
}

function normalizeScopeFromApi(scope, maps) {
  const out = { environments: [], workloads: [], reports: [] };

  for (const env of scope?.environments || []) {
    const id = env?.id || env?.permissionProfileId;
    if (!id) continue;
    const fromMap = maps.envById.get(id);
    out.environments.push({
      id,
      name: env?.name || fromMap?.name || id,
      cloudProvider: fromMap?.cloudProvider || null,
    });
  }

  for (const workload of scope?.workloads || []) {
    const id = workload?.id || workload?.workloadId;
    if (!id) continue;
    const fromMap = maps.workloadById.get(id);
    out.workloads.push({
      id,
      name: workload?.name || workload?.workloadName || fromMap?.name || id,
    });
  }

  for (const report of scope?.reports || []) {
    const id = buildReportEntryKey(report) || report?.id || report?.fileId || null;
    if (!id) continue;
    const fromMap = maps.reportById.get(id);
    out.reports.push({
      id,
      name: report?.name || report?.title || fromMap?.name || report?.reportId || report?.scanId || id,
      scanId: fromMap?.scanId || report?.scanId || null,
      reportId: fromMap?.reportId || report?.reportId || null,
      permissionProfileId: fromMap?.permissionProfileId || report?.permissionProfileId || null,
      fileId: report?.fileId || null,
      reportDefinitionId: report?.reportDefinitionId || null,
      reportPlanId: report?.reportPlanId || null,
    });
  }

  return out;
}

function normalizeScopeFromSessionContext(sessionContext, maps) {
  const context = safeJsonParse(sessionContext, null);
  if (!context || typeof context !== 'object') return { ...EMPTY_SCOPE };

  return normalizeScopeFromApi({
    environments: (context.environments || []).map((env) => ({
      id: env?.permissionProfileId || env?.id,
      name: env?.name || null,
    })),
    workloads: (context.workloads || []).map((workload) => ({
      id: workload?.workloadId || workload?.id,
      name: workload?.workloadName || workload?.name || null,
    })),
    reports: (context.reports || []).map((report) => ({
      id: buildReportEntryKey(report) || report?.id || report?.fileId,
      scanId: report?.scanId || null,
      reportId: report?.reportId || null,
      permissionProfileId: report?.permissionProfileId || null,
      name: report?.title || report?.name || null,
      fileId: report?.fileId || null,
      reportDefinitionId: report?.reportDefinitionId || null,
      reportPlanId: report?.reportPlanId || null,
    })),
  }, maps);
}

function normalizeContextEventPayload(rawEvent) {
  const payload = safeJsonParse(rawEvent, null);
  if (!payload || typeof payload !== 'object') return null;
  const patchRaw = payload.patch || payload.context || payload;
  const patch = patchRaw && typeof patchRaw === 'object' ? patchRaw : null;
  return {
    mode: normalizeSmartToken(payload.mode || 'apply') || 'apply',
    notice: payload.notice || null,
    patch,
    raw: payload,
  };
}

function normalizeFetchedEntry(entry, fallbackLabel = 'Fetched data') {
  if (typeof entry === 'string') {
    return {
      id: `fetched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'fetched',
      label: entry,
      timestamp: new Date().toISOString(),
    };
  }
  if (entry && typeof entry === 'object') {
    return {
      id: entry.id || `fetched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: entry.type || 'fetched',
      label: entry.label || entry.title || fallbackLabel,
      timestamp: entry.timestamp || entry.loadedAt || new Date().toISOString(),
      ...entry,
    };
  }
  return {
    id: `fetched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'fetched',
    label: fallbackLabel,
    timestamp: new Date().toISOString(),
  };
}

function parseChatMetadata(rawMetadata) {
  return safeJsonParse(rawMetadata, {}) || {};
}

function isCommandCenterChatRecord(chat) {
  if (!chat) return false;
  const metadata = parseChatMetadata(chat.metadata);
  const source = normalizeSmartToken(metadata?.source);
  if (source === 'commandcenter' || source === 'command_center') return true;
  return String(chat.sessionId || '').startsWith('chat_');
}

function safeJsonParse(value, fallback = null) {
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

function normalizeRecommendationForPersonalization(rec) {
  if (!rec || typeof rec !== 'object') return null;
  const metadata = safeJsonParse(rec.metadata, {});
  const source = safeJsonParse(rec.source, []);
  const targetResourcesRaw = safeJsonParse(rec.targetResources, []);
  const targetResources = Array.isArray(targetResourcesRaw)
    ? targetResourcesRaw
      .filter((resource) => resource && typeof resource === 'object')
      .map((resource) => ({
        accountId: resource.accountId || null,
        cloudProvider: resource.cloudProvider || null,
        resourceType: resource.resourceType || null,
        resourceId: resource.resourceId || null,
        resourceArn: resource.resourceArn || null,
        displayName: resource.displayName || null,
        workloadId: resource.workloadId || null,
        workloadName: resource.workloadName || null,
        environmentId: resource.environmentId || resource.permissionProfileId || null,
        environmentName: resource.environmentName || null,
      }))
    : [];

  return {
    id: rec.recommendationId || rec.id || rec.recordId || null,
    recommendationId: rec.recommendationId || rec.id || rec.recordId || null,
    title: rec.title || rec.recommendationTitle || rec.recommendationId || 'Recommendation',
    status: rec.status || 'open',
    metadata,
    source,
    targetResources,
    recommendedAction: safeJsonParse(rec.recommendedAction, rec.recommendedAction || null),
    action: safeJsonParse(rec.action, rec.action || null),
  };
}

function normalizeStatusToken(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function classifyQueueStatus(value) {
  const normalized = normalizeStatusToken(value);
  if (RUNNING_STATUS_SET.has(normalized)) return 'running';
  if (WAITING_STATUS_SET.has(normalized)) return 'waiting';
  if (FAILED_STATUS_SET.has(normalized)) return 'failed';
  if (COMPLETED_STATUS_SET.has(normalized)) return 'completed';
  return null;
}

function classifyReportQueueStatus(value) {
  const normalized = normalizeStatusToken(value);
  if (REPORT_SUCCESS_STATUS_SET.has(normalized)) return 'completed';
  return classifyQueueStatus(value);
}

function normalizeSmartToken(value) {
  return String(value || '').trim().toLowerCase();
}

function getPriorityLabel(priority) {
  const value = Number(priority);
  if (!Number.isFinite(value)) return null;
  if (value >= 90) return 'Critical';
  if (value >= 70) return 'High';
  if (value >= 40) return 'Medium';
  return 'Low';
}

function getRecommendationPriorityValue(recommendation) {
  const value = Number(recommendation?.metadata?.priority ?? recommendation?.priority ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function filterToTopPriorityTier(recommendations) {
  if (!recommendations || recommendations.length === 0) return [];
  const hasCriticalOrHigh = recommendations.some((r) => getRecommendationPriorityValue(r) >= 70);
  if (hasCriticalOrHigh) {
    return recommendations.filter((r) => getRecommendationPriorityValue(r) >= 70);
  }
  const hasMedium = recommendations.some((r) => getRecommendationPriorityValue(r) >= 40);
  if (hasMedium) {
    return recommendations.filter((r) => getRecommendationPriorityValue(r) >= 40);
  }
  return recommendations;
}

function recommendationMatchesSmartGroup(recommendation, group) {
  const filter = group?.filter || {};
  const metadata = recommendation?.metadata || {};
  const normalizedDomain = normalizeSmartToken(metadata?.domain);
  const categoriesRaw = metadata?.category ?? metadata?.categories;
  const normalizedCategories = (Array.isArray(categoriesRaw) ? categoriesRaw : categoriesRaw ? [categoriesRaw] : [])
    .map((value) => normalizeSmartToken(value))
    .filter(Boolean);
  const recommendedActionType = normalizeSmartToken(
    recommendation?.recommendedAction?.type || recommendation?.action?.type || ''
  );
  const sourceArrayRaw = Array.isArray(recommendation?.source)
    ? recommendation.source
    : recommendation?.source
    ? [recommendation.source]
    : [];
  const sourceArray = sourceArrayRaw.filter((entry) => entry && typeof entry === 'object');

  if (Array.isArray(filter.priorities) && filter.priorities.length > 0) {
    const priorityLabel = getPriorityLabel(getRecommendationPriorityValue(recommendation));
    if (!priorityLabel || !filter.priorities.includes(priorityLabel)) return false;
  }

  if (Array.isArray(filter.domains) && filter.domains.length > 0) {
    const normalizedDomains = filter.domains.map((domain) => normalizeSmartToken(domain));
    if (!normalizedDomains.includes(normalizedDomain)) return false;
  }

  if (Array.isArray(filter.categories) && filter.categories.length > 0) {
    const normalizedFilterCategories = filter.categories.map((category) => normalizeSmartToken(category));
    const hasCategoryMatch = normalizedCategories.some((category) => normalizedFilterCategories.includes(category));
    if (!hasCategoryMatch) return false;
  }

  if (filter.actionType) {
    if (recommendedActionType !== normalizeSmartToken(filter.actionType)) return false;
  }

  if (filter.excludeActionType) {
    if (recommendedActionType === normalizeSmartToken(filter.excludeActionType)) return false;
  }

  if (filter.sourceType) {
    const hasSourceType = sourceArray.some((entry) => normalizeSmartToken(entry?.type) === normalizeSmartToken(filter.sourceType));
    if (!hasSourceType) return false;
  }

  return true;
}

function deriveStartupCategory(recommendation) {
  const metadata = recommendation?.metadata || {};
  const title = String(recommendation?.title || '').trim();
  const lowerTitle = title.toLowerCase();
  const domain = String(metadata?.domain || '').trim();
  const domainLower = domain.toLowerCase();
  const sourceRaw = recommendation?.source;
  const sourceArray = Array.isArray(sourceRaw)
    ? sourceRaw
    : sourceRaw && typeof sourceRaw === 'object'
      ? [sourceRaw]
      : [];
  const sourceTypes = sourceArray
    .map((entry) => normalizeSmartToken(entry?.type))
    .filter(Boolean);
  const categoryRaw = metadata?.category || metadata?.categories || '';
  const category = Array.isArray(categoryRaw)
    ? String(categoryRaw[0] || '').trim()
    : String(categoryRaw || '').trim();
  const categoryLower = category.toLowerCase();
  const actionType = String(recommendation?.recommendedAction?.type || recommendation?.action?.type || '').toLowerCase();

  if (
    sourceTypes.includes('health')
    || /(health|runtime|availability|throttl|status checks?)/.test(lowerTitle)
  ) {
    return { id: 'health', label: 'Health' };
  }

  if (
    domainLower === 'cost and usage'
    || categoryLower === 'resource cleanup'
    || /(cost|cleanup|unused|idle|savings|optimization)/.test(lowerTitle)
  ) {
    return { id: 'cost_cleanup', label: 'Cost & Cleanup' };
  }

  if (
    /(report|baseline|assessment)/.test(lowerTitle)
    || categoryLower.includes('report')
    || actionType === 'report'
  ) {
    return { id: 'reports_to_run', label: 'Reports to Run' };
  }

  const fallbackLabel = category || domain || 'General';
  const fallbackId = fallbackLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'general';

  return { id: fallbackId, label: fallbackLabel };
}

function workloadHasDiagram(workload) {
  if (!workload || typeof workload !== 'object') return false;
  if (typeof workload.hasDiagram === 'boolean') return workload.hasDiagram;

  const parsed = safeJsonParse(workload.diagram, workload.diagram || null);
  if (!parsed) return false;
  if (typeof parsed === 'string') return parsed.trim().length > 0;
  if (Array.isArray(parsed)) return parsed.length > 0;
  if (typeof parsed !== 'object') return false;

  return Boolean(
    parsed.generatedAt
    || parsed.updatedAt
    || parsed.key
    || parsed.url
    || parsed.spec
    || parsed.contentType
    || parsed.format
    || Object.keys(parsed).length > 0
  );
}

function buildDiagramStartupCategory(workloads = []) {
  const diagramlessWorkloads = (Array.isArray(workloads) ? workloads : [])
    .map((workload) => {
      if (!workload || typeof workload !== 'object') return null;
      const id = workload.id || workload.workloadId || null;
      const name = workload.name || workload.workloadName || id || null;
      if (!id || !name || workloadHasDiagram(workload)) return null;
      return { id: String(id), name: String(name) };
    })
    .filter(Boolean);

  if (diagramlessWorkloads.length === 0) return null;

  const workloadItems = diagramlessWorkloads
    .slice(0, STARTUP_RECOMMENDATIONS_PER_CATEGORY)
    .map((workload) => ({
      id: workload.id,
      name: workload.name,
    }));
  const workloadNames = workloadItems.map((workload) => workload.name);
  const primaryWorkload = workloadItems[0];
  const workloadCount = diagramlessWorkloads.length;
  const summary = workloadCount === 1
    ? `Generate an architecture diagram for ${primaryWorkload.name}.`
    : `${workloadCount} workloads are missing architecture diagrams. Start with ${primaryWorkload.name}.`;

  return {
    id: 'diagram-generation',
    label: 'Architecture Diagrams',
    card: {
      id: 'brief_diagram_generation',
      title: 'Architecture Diagrams',
      summary,
      whyNow: summary,
      whatFor: workloadCount === 1
        ? `Generate architecture diagram for ${primaryWorkload.name}`
        : `Generate architecture diagrams for ${workloadCount} workloads`,
      applicableScope: {
        environments: [],
        workloads: workloadItems,
      },
      applicableScopeNames: {
        environments: [],
        workloads: workloadNames,
      },
      sourceIds: [],
      recommendationIds: [],
      cta: {
        label: workloadCount === 1 ? 'Open Workload' : 'Open Workloads',
        intent: 'navigate',
        payload: {
          path: workloadCount === 1
            ? `/dashboard/workloads/${primaryWorkload.id}`
            : '/dashboard/workloads',
        },
      },
    },
  };
}

function buildStartupSuggestionWindow({
  recommendations = [],
  workloads = [],
  scans = [],
  page = 0,
  categoriesPerPage = STARTUP_CATEGORY_BATCH_SIZE,
  recommendationsPerCategory = STARTUP_RECOMMENDATIONS_PER_CATEGORY,
}) {
  const activeRecommendations = (recommendations || []).filter((recommendation) => {
    if (!recommendation?.id) return false;
    const status = String(recommendation?.status || '').toLowerCase();
    return !['archived', 'closed', 'completed', 'resolved', 'snoozed'].includes(status);
  });

  const groupCandidates = COMMAND_CENTER_SMART_GROUPS
    .filter((group) => !EXCLUDED_STARTUP_CATEGORY_IDS.has(group.id))
    .map((group) => {
      const matchedRecommendations = activeRecommendations
        .filter((recommendation) => recommendationMatchesSmartGroup(recommendation, group))
        .sort((a, b) => getRecommendationPriorityValue(b) - getRecommendationPriorityValue(a));

      if (matchedRecommendations.length === 0) return null;
      return {
        id: group.id,
        label: group.label,
        recommendations: matchedRecommendations,
        topPriority: getRecommendationPriorityValue(matchedRecommendations[0]),
      };
    })
    .filter(Boolean);

  const orderedGroups = [];
  const usedGroupIds = new Set();
  const SECURITY_GROUP_IDS = ['critical-security', 'network-security', 'data-protection', 'compliance'];
  const pickBestFromIds = (ids) => {
    const candidates = groupCandidates
      .filter((group) => ids.includes(group.id) && !usedGroupIds.has(group.id))
      .sort((a, b) => {
        if (b.topPriority !== a.topPriority) return b.topPriority - a.topPriority;
        return b.recommendations.length - a.recommendations.length;
      });
    return candidates[0] || null;
  };

  const firstMandatory = pickBestFromIds(['cost-savings', 'resource-cleanup']);
  if (firstMandatory) {
    orderedGroups.push(firstMandatory);
    usedGroupIds.add(firstMandatory.id);
  }

  const secondMandatory = pickBestFromIds(['health']);
  if (secondMandatory) {
    orderedGroups.push(secondMandatory);
    usedGroupIds.add(secondMandatory.id);
  }

  const diagramCategory = buildDiagramStartupCategory(workloads);
  if (diagramCategory && !usedGroupIds.has(diagramCategory.id)) {
    orderedGroups.push({
      id: diagramCategory.id,
      label: diagramCategory.label,
      recommendations: [],
      topPriority: -1,
      card: diagramCategory.card,
    });
    usedGroupIds.add(diagramCategory.id);
  }

  const preferredSecurityGroups = groupCandidates
    .filter((group) => SECURITY_GROUP_IDS.includes(group.id) && !usedGroupIds.has(group.id))
    .sort((a, b) => {
      if (b.topPriority !== a.topPriority) return b.topPriority - a.topPriority;
      return b.recommendations.length - a.recommendations.length;
    });
  orderedGroups.push(...preferredSecurityGroups);
  preferredSecurityGroups.forEach((group) => usedGroupIds.add(group.id));

  const remainingGroups = groupCandidates
    .filter((group) => !usedGroupIds.has(group.id))
    .sort((a, b) => {
      if (b.topPriority !== a.topPriority) return b.topPriority - a.topPriority;
      return b.recommendations.length - a.recommendations.length;
    });
  orderedGroups.push(...remainingGroups);

  let groups = orderedGroups;
  if (groups.length === 0 && activeRecommendations.length > 0) {
    const groupsById = new Map();
    for (const recommendation of activeRecommendations) {
      const category = deriveStartupCategory(recommendation);
      if (category?.id === 'reports_to_run') continue;
      if (!groupsById.has(category.id)) {
        groupsById.set(category.id, {
          id: category.id,
          label: category.label,
          recommendations: [],
        });
      }
      groupsById.get(category.id).recommendations.push(recommendation);
    }

    groups = [...groupsById.values()]
      .map((group) => ({
        ...group,
        recommendations: group.recommendations
          .slice()
          .sort((a, b) => getRecommendationPriorityValue(b) - getRecommendationPriorityValue(a)),
      }))
      .sort((a, b) => {
        const topA = getRecommendationPriorityValue(a.recommendations?.[0]);
        const topB = getRecommendationPriorityValue(b.recommendations?.[0]);
        if (topB !== topA) return topB - topA;
        return b.recommendations.length - a.recommendations.length;
      });
  }

  const start = Math.max(0, page) * categoriesPerPage;
  const selectedGroups = groups.slice(start, start + categoriesPerPage);
  const recommendationById = new Map(activeRecommendations.map((entry) => [String(entry.id), entry]));

  const startupCategories = selectedGroups.map((group) => {
    const filtered = filterToTopPriorityTier(group.recommendations);
    const recommendationIds = filtered
      .slice(0, recommendationsPerCategory)
      .map((entry) => String(entry.id));
    const category = {
      id: group.id,
      label: group.label,
      recommendationIds,
    };
    if (group.card) {
      category.card = group.card;
    }
    return category;
  });

  const selectedRecommendations = startupCategories
    .flatMap((category) => category.recommendationIds.map((id) => recommendationById.get(id)).filter(Boolean));

  return {
    startupCategories,
    selectedRecommendations,
    hasMore: start + categoriesPerPage < groups.length,
    totalCategories: groups.length,
  };
}

function getWorkflowTitle(workflow) {
  try {
    if (workflow.workflowDefinition) {
      const definition = JSON.parse(workflow.workflowDefinition);
      return definition.workflowName || definition.title || `Workflow ${workflow.workflowRunId}`;
    }
    return workflow.workflowName || workflow.title || `Workflow ${workflow.workflowRunId}`;
  } catch {
    return workflow.workflowName || workflow.title || `Workflow ${workflow.workflowRunId}`;
  }
}

function extractAgentTitle(agent) {
  return agent?.title || agent?.agentType || agent?.itemId || agent?.recordId || 'Agent Run';
}

function buildLocalFallbackBootstrap({ availableEnvironments, availableWorkloads, accountScans, recommendations, workflows, agentHistory }) {
  // First, filter to only active recommendations (same as Overview.jsx)
  const activeRecommendations = recommendations.filter((rec) => {
    const status = rec?.status?.toLowerCase();
    return (
      status !== 'archived' &&
      status !== 'resolved' &&
      status !== 'snoozed'
    );
  });
  
  // Parse and enrich ALL active recommendations with metadata (don't slice early - we need to categorize first)
  const enrichedRecommendations = [...activeRecommendations]
    .map((rec) => {
      const metadata = typeof rec?.metadata === 'string'
        ? (() => {
            try {
              return JSON.parse(rec.metadata);
            } catch {
              return {};
            }
          })()
        : (rec?.metadata || {});

      const title = rec?.title || rec?.recommendationTitle || rec?.recommendationId || 'Recommendation';
      const lowerTitle = title.toLowerCase();
      const source = safeJsonParse(rec?.source, []);
      const sourceTypes = (Array.isArray(source) ? source : [source])
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => normalizeSmartToken(entry?.type))
        .filter(Boolean);
      
      // Handle category that might be a string or array
      const categoryRaw = metadata?.category || rec?.category || '';
      const category = Array.isArray(categoryRaw) ? categoryRaw[0] : String(categoryRaw);
      const categoryForMatch = category.toLowerCase().trim();
      
      // Domain for matching
      const domain = metadata?.domain || rec?.domain || '';
      const domainForMatch = domain.toLowerCase().trim();
      
      // Get recommended action type
      const recommendedAction = typeof rec?.recommendedAction === 'string'
        ? (() => { try { return JSON.parse(rec.recommendedAction); } catch { return {}; } })()
        : (rec?.recommendedAction || {});
      const actionType = recommendedAction?.type || '';
      
      // Determine card type based on exact category/domain match (like Overview.jsx does)
      let cardType = 'other';
      
      // Check for cost/cleanup type - exact match on domain or category
      const isCostDomain = domainForMatch === 'cost and usage';
      const isCleanupCategory = categoryForMatch === 'resource cleanup';
      const hasCostKeywords = lowerTitle.includes('cost') || lowerTitle.includes('cleanup') || 
                              lowerTitle.includes('unused') || lowerTitle.includes('idle') || 
                              lowerTitle.includes('savings') || lowerTitle.includes('optimization');
      
      if (isCostDomain || isCleanupCategory || hasCostKeywords) {
        cardType = 'cost_cleanup';
      }
      else if (
        sourceTypes.includes('health')
        || /(health|runtime|availability|throttl|status checks?)/.test(lowerTitle)
      ) {
        cardType = 'health';
      }
      // Check for reports type
      else if (lowerTitle.includes('report') || lowerTitle.includes('baseline') || lowerTitle.includes('assessment') ||
               categoryForMatch.includes('report') || actionType === 'report') {
        cardType = 'reports';
      }

      return {
        id: rec?.recommendationId || rec?.id || rec?.recordId,
        title,
        priority: Number(metadata?.priority || rec?.priority || 0),
        cardType,
        category,
        domain,
        isCostDomain,
        isCleanupCategory,
        whatFor: metadata?.whatFor || metadata?.outcome || metadata?.goal || null,
        summary: metadata?.summary || metadata?.description || rec?.description || null,
        applicableScope: metadata?.applicableScope || null,
      };
    })
    .filter((rec) => rec.id)
    .sort((a, b) => b.priority - a.priority);
  
  // Separate into categories
  const costCleanupRecs = enrichedRecommendations.filter((r) => r.cardType === 'cost_cleanup');
  const healthRecs = enrichedRecommendations.filter((r) => r.cardType === 'health');
  const securityRecs = enrichedRecommendations.filter((r) => r.cardType === 'other');

  // Build startup brief cards: prioritize cost/cleanup, then fill with others by priority.
  const startupCards = [];
  
  // Add cost/cleanup card if available
  if (costCleanupRecs.length > 0) {
    const selected = costCleanupRecs.slice(0, STARTUP_RECOMMENDATIONS_PER_CATEGORY);
    const rec = selected[0];
    const recommendationIds = selected.map((entry) => entry.id).filter(Boolean);
    startupCards.push({
      id: `brief_cost_${rec.id}`,
      title: 'Resource Cleanup',
      whatFor: rec.whatFor || rec.title,
      whyNow: rec.summary || 'Identify unused resources and reduce costs.',
      sourceIds: recommendationIds,
      cta: {
        label: 'Review Recommendations',
        intent: 'apply_scope_and_plan',
        payload: { recommendationIds },
      },
    });
  }

  if (healthRecs.length > 0 && startupCards.length < STARTUP_CATEGORY_BATCH_SIZE) {
    const selected = healthRecs.slice(0, STARTUP_RECOMMENDATIONS_PER_CATEGORY);
    const rec = selected[0];
    const recommendationIds = selected.map((entry) => entry.id).filter(Boolean);
    startupCards.push({
      id: `brief_health_${rec.id}`,
      title: 'Health',
      whatFor: rec.whatFor || rec.title,
      whyNow: rec.summary || 'Address current operational health issues before they grow.',
      sourceIds: recommendationIds,
      applicableScope: rec.applicableScope,
      cta: {
        label: 'Review Recommendations',
        intent: 'apply_scope_and_plan',
        payload: { recommendationIds },
      },
    });
  }

  const diagramCategory = buildDiagramStartupCategory(availableWorkloads);
  if (diagramCategory?.card && startupCards.length < STARTUP_CATEGORY_BATCH_SIZE) {
    startupCards.push(diagramCategory.card);
  }

  const refreshRecommendationsCategory = buildRecommendationsRefreshStartupCategory(accountScans);
  if (refreshRecommendationsCategory?.card && startupCards.length < STARTUP_CATEGORY_BATCH_SIZE) {
    startupCards.push(refreshRecommendationsCategory.card);
  }

  // Fill remaining slots (up to startup batch size) with security-first recommendations.
  const remainingSlots = Math.max(0, STARTUP_CATEGORY_BATCH_SIZE - startupCards.length);
  securityRecs.slice(0, remainingSlots).forEach((rec, index) => {
    // Determine a nice category title based on the recommendation
    let categoryTitle = 'Security Review';
    const lowerTitle = rec.title.toLowerCase();
    if (lowerTitle.includes('security') || lowerTitle.includes('critical')) {
      categoryTitle = 'Critical Security';
    } else if (lowerTitle.includes('network')) {
      categoryTitle = 'Network Security';
    } else if (lowerTitle.includes('data') || lowerTitle.includes('encryption')) {
      categoryTitle = 'Data Protection';
    } else if (lowerTitle.includes('compliance') || lowerTitle.includes('audit')) {
      categoryTitle = 'Compliance';
    } else if (lowerTitle.includes('monitoring') || lowerTitle.includes('observability')) {
      categoryTitle = 'Monitoring';
    }
    
    startupCards.push({
      id: `brief_other_${index}_${rec.id}`,
      title: categoryTitle,
      whatFor: rec.whatFor || rec.title,
      whyNow: rec.summary || 'High-priority recommendation from your current dataset.',
      sourceIds: [rec.id],
      applicableScope: rec.applicableScope,
      cta: {
        label: 'Review Recommendations',
        intent: 'apply_scope_and_plan',
        payload: { recommendationIds: [rec.id] },
      },
    });
  });

  // For the right rail, use the sorted top 5
  const sortedRecommendations = enrichedRecommendations.slice(0, 5);

  const reports = (accountScans || [])
    .filter((scan) => scan?.reportId)
    .slice(0, 5)
    .map((scan) => ({
      id: buildReportEntryKey(scan) || scan?.scanId || scan?.reportId,
      title: scan?.title || scan?.reportId || scan?.scanId,
      updatedAt: scan?.lastUpdateTime || scan?.updatedAt || scan?.latestAssessmentDate || null,
      scanId: scan?.scanId || null,
      reportId: scan?.reportId || null,
      permissionProfileId: scan?.permissionProfileId || scan?.parentId || null,
    }));

  // Build waiting items from workflows and agentHistory
  const waitingItems = [];
  
  // Add workflows that are waiting on user input
  (workflows || []).forEach((workflow) => {
    const status = (workflow.workflowStatus || '').toLowerCase();
    if (status === 'waiting on user' || status === 'waiting' || status === 'pending' || status === 'paused') {
      waitingItems.push({
        id: `workflow-${workflow.workflowRunId || workflow.workflowId}`,
        title: getWorkflowTitle(workflow),
        subtitle: 'Review required',
        reason: workflow.lastMessage || workflow.statusMessage || `Workflow is ${workflow.workflowStatus}`,
        priority: status === 'waiting on user' ? 'high' : 'medium',
        type: 'workflow',
        updatedAt: workflow.updatedAt,
        cta: {
          label: 'Review in Chat',
          intent: 'review_workflow',
          payload: { workflowId: workflow.workflowRunId || workflow.workflowId },
        },
      });
    }
  });
  
  // Add agents that are waiting on user input
  (agentHistory || []).forEach((agent) => {
    const status = (agent.status || '').toLowerCase();
    if (status === 'waiting_on_user_input' || status === 'waiting' || status === 'pending' || status === 'paused') {
      waitingItems.push({
        id: `agent-${agent.recordId || agent.itemId}`,
        title: agent.title || agent.itemId || `Agent ${agent.recordId}`,
        subtitle: 'Review required',
        reason: agent.lastMessage || agent.statusMessage || `Agent is waiting for your input`,
        priority: 'high',
        type: 'agent',
        updatedAt: agent.purchaseDate,
        cta: {
          label: 'Review in Chat',
          intent: 'review_agent',
          payload: { agentId: agent.recordId || agent.itemId },
        },
      });
    }
  });
  
  // Sort by updatedAt (most recent first)
  waitingItems.sort((a, b) => {
    const dateA = new Date(a.updatedAt || 0);
    const dateB = new Date(b.updatedAt || 0);
    return dateB - dateA;
  });

  // Count running and failed items for queue
  const runningCount = (workflows || []).filter((w) => (w.workflowStatus || '').toLowerCase() === 'running').length;
  const failedCount = (workflows || []).filter((w) => (w.workflowStatus || '').toLowerCase() === 'failed').length;

  return {
    goal: {
      goalId: `goal_${Date.now()}`,
      title: 'Reduce cloud costs with low-risk actions',
      status: 'active',
    },
    topRail: {
      queue: {
        running: runningCount,
        waitingOnInput: waitingItems.length,
        failed: failedCount,
      },
    },
    rightRail: {
      cards: [
        {
          type: 'waiting_on_you',
          title: 'Waiting on You',
          items: waitingItems,
        },
        {
          type: 'high_impact_recommendations',
          title: 'High Impact Recommendations',
          items: sortedRecommendations.slice(0, 5).map((rec) => ({
            id: rec.id,
            title: rec.title,
            subtitle: `Priority score ${rec.priority || 0}`,
            priority: 'medium',
            cta: {
              label: 'Review in Chat',
              intent: 'review_recommendation',
              payload: { recommendationId: rec.id },
            },
          })),
        },
        {
          type: 'active_runs',
          title: 'Active Runs',
          items: [],
        },
        {
          type: 'recent_outcomes',
          title: 'Recent Outcomes',
          items: reports.map((report) => ({
            id: report.id,
            title: report.title,
            subtitle: report.updatedAt ? `Updated ${new Date(report.updatedAt).toLocaleString()}` : 'Recent report',
            priority: 'low',
            cta: {
              label: 'Review in Chat',
              intent: 'review_report',
              payload: {
                scanId: report.scanId,
                reportId: report.reportId,
              },
            },
          })),
        },
      ],
    },
    chatStartBrief: {
      cards: startupCards,
    },
    activeScope: {
      environments: availableEnvironments.slice(0, 0).map((env) => ({ id: env.recordId, name: env.name })),
      workloads: availableWorkloads.slice(0, 0).map((workload) => ({ id: workload.workloadId, name: workload.workloadName || workload.workloadId })),
      reports: [],
    },
    limits: SCOPE_LIMITS_DEFAULT,
  };
}

function BlockActions({ actions = [], onAction, disabled = false, noMargin = false }) {
  if (!Array.isArray(actions) || actions.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${noMargin ? '' : 'mt-3'}`}>
      {actions.map((action, index) => (
        <Button
          key={`${action.intent || 'action'}-${index}`}
          size="sm"
          variant={index === 0 ? 'default' : 'outline'}
          disabled={disabled}
          onClick={() => onAction(action)}
        >
          {action.label || action.intent || 'Run'}
        </Button>
      ))}
    </div>
  );
}

// Category icon and color mapping for cards
const CATEGORY_STYLES = {
  'critical-security': { icon: ShieldAlert, bgColor: 'bg-red-100', iconColor: 'text-red-600' },
  'security': { icon: Shield, bgColor: 'bg-red-100', iconColor: 'text-red-600' },
  'health': { icon: Activity, bgColor: 'bg-orange-100', iconColor: 'text-orange-600' },
  'network-security': { icon: Network, bgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
  'network': { icon: Network, bgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
  'data-protection': { icon: Lock, bgColor: 'bg-indigo-100', iconColor: 'text-indigo-600' },
  'data': { icon: Lock, bgColor: 'bg-indigo-100', iconColor: 'text-indigo-600' },
  'encryption': { icon: Lock, bgColor: 'bg-indigo-100', iconColor: 'text-indigo-600' },
  'cost': { icon: DollarSign, bgColor: 'bg-emerald-100', iconColor: 'text-emerald-600' },
  'savings': { icon: DollarSign, bgColor: 'bg-emerald-100', iconColor: 'text-emerald-600' },
  'cleanup': { icon: Trash2, bgColor: 'bg-amber-100', iconColor: 'text-amber-600' },
  'resource': { icon: Trash2, bgColor: 'bg-amber-100', iconColor: 'text-amber-600' },
  'compliance': { icon: ClipboardCheck, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
  'audit': { icon: ClipboardCheck, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
  'monitoring': { icon: BarChart3, bgColor: 'bg-cyan-100', iconColor: 'text-cyan-600' },
  'refresh': { icon: RefreshCw, bgColor: 'bg-teal-100', iconColor: 'text-teal-600' },
  'reports': { icon: FileBarChart, bgColor: 'bg-teal-100', iconColor: 'text-teal-600' },
  'diagram': { icon: Layers, bgColor: 'bg-sky-100', iconColor: 'text-sky-600' },
  'architecture': { icon: Layers, bgColor: 'bg-sky-100', iconColor: 'text-sky-600' },
  'platform': { icon: Sparkles, bgColor: 'bg-violet-100', iconColor: 'text-violet-600' },
  'insights': { icon: Sparkles, bgColor: 'bg-violet-100', iconColor: 'text-violet-600' },
  'workflow': { icon: Play, bgColor: 'bg-amber-100', iconColor: 'text-amber-600' },
  'review': { icon: ClipboardCheck, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
};

function getCategoryStyle(title) {
  const lowerTitle = (title || '').toLowerCase();
  for (const [keyword, style] of Object.entries(CATEGORY_STYLES)) {
    if (lowerTitle.includes(keyword)) {
      return style;
    }
  }
  // Default style
  return { icon: Sparkles, bgColor: 'bg-slate-100', iconColor: 'text-slate-600' };
}

function StartBriefBlock({ block, onAction, disabled }) {
  const cards = block?.payload?.cards || [];
  if (cards.length === 0) return null;

  const toScopeLabel = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      return value.name || value.title || value.id || value.accountId || null;
    }
    return null;
  };

  const compactListPreview = (items, limit = 2) => {
    const list = Array.isArray(items) ? items.map(toScopeLabel).filter(Boolean) : [];
    if (list.length === 0) return null;
    if (list.length <= limit) return list.join(', ');
    return `${list.slice(0, limit).join(', ')} +${list.length - limit}`;
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
        {cards.map((card) => {
          const environmentPreview = compactListPreview(card.applicableScope?.environments, 2);
          const workloadPreview = compactListPreview(card.applicableScope?.workloads, 2);
          const categoryStyle = getCategoryStyle(card.title);
          const IconComponent = categoryStyle.icon;
          const rawHeader = card.whatFor || card.title;
          const mainHeader = String(rawHeader || '').replace(/\.\s*$/, '').trim() || String(rawHeader || '');
          const secondaryLine = card.summary || card.whyNow || null;
          const categoryLabel = card.title;
          const recommendationCount = card.sourceIds?.length || card.recommendationIds?.length || 0;

          return (
            <button
              key={card.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                analytics.track(ANALYTICS_EVENTS.COMMAND_CENTER_SUGGESTION_CARD_CLICKED, {
                  route: getAnalyticsRoute(),
                  card_id: card.id || null,
                  card_title: card.title || card.whatFor || null,
                });
                if (card.cta) onAction(card.cta);
              }}
              className="group flex flex-col rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition-all hover:border-primary-300 hover:shadow-md hover:bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900 leading-snug flex-1">
                  {mainHeader}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {recommendationCount > 0 && (
                    <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-primary-100 px-1.5 text-[10px] font-semibold text-primary-700">
                      {recommendationCount}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primary-500 transition-colors" />
                </div>
              </div>

                    {secondaryLine ? (
                      <p className="mt-1.5 text-xs leading-5 text-slate-500 line-clamp-3">{secondaryLine}</p>
                    ) : null}

              <div className="mt-auto pt-2.5 flex items-end justify-between gap-2">
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  {environmentPreview && (
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                      <Cloud className="h-2.5 w-2.5" />
                      Env: {environmentPreview}
                    </span>
                  )}
                  {workloadPreview && (
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                      <Layers className="h-2.5 w-2.5" />
                      Workload: {workloadPreview}
                    </span>
                  )}
                </div>

                <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 flex-shrink-0 ${categoryStyle.bgColor}`}>
                  <IconComponent className={`h-3 w-3 ${categoryStyle.iconColor}`} />
                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${categoryStyle.iconColor}`}>
                    {categoryLabel}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <BlockActions actions={block?.actions} onAction={onAction} disabled={disabled} />
    </div>
  );
}

function RecommendationsBlock({ block, onAction, disabled }) {
  const items = block?.payload?.items || [];
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">{item.title}</div>
              {item.impact?.value ? (
                <div className="mt-1 text-xs text-gray-600">Estimated ${item.impact.value}/{item.impact.period || 'month'} impact</div>
              ) : null}
            </div>
            <span className="rounded bg-gray-100 px-2 py-1 text-[11px] uppercase text-gray-600">{item.priority || 'unknown'}</span>
          </div>
        </div>
      ))}
      <BlockActions actions={block?.actions} onAction={onAction} disabled={disabled} />
    </div>
  );
}

function normalizeRecommendationAction(rawAction) {
  if (!rawAction) return {};
  if (typeof rawAction === 'string') {
    try {
      const parsed = JSON.parse(rawAction);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof rawAction === 'object') return rawAction;
  return {};
}

function estimateRiskFromPriorityValue(priority) {
  if (priority >= 90) return 'Medium';
  if (priority >= 70) return 'Low-Medium';
  return 'Low';
}

function estimateEffortFromPriorityValue(priority) {
  if (priority >= 90) return 'Medium';
  if (priority >= 70) return 'Low-Medium';
  return 'Low';
}

function buildRecommendationRemediationFromState(rec) {
  const recommendedAction = normalizeRecommendationAction(rec?.recommendedAction);
  const fallbackAction = normalizeRecommendationAction(rec?.action);
  const action = Object.keys(recommendedAction).length > 0 ? recommendedAction : fallbackAction;
  const actionType = normalizeSmartToken(action?.type || '');

  if (actionType === 'blueprint') {
    const blueprintId = action?.blueprintId || null;
    return {
      type: 'blueprint',
      label: 'Run Blueprint',
      path: blueprintId ? `/dashboard/library/blueprint/${blueprintId}` : '/dashboard/recommendations',
    };
  }

  if (actionType === 'report') {
    return {
      type: 'report',
      label: 'Run Report',
      path: '/dashboard',
    };
  }

  if (actionType === 'platform' || actionType === 'plaform') {
    return {
      type: 'platform',
      label: 'Go to Platform',
      path: action?.path || action?.platformPath || '/dashboard/recommendations',
    };
  }

  return {
    type: actionType || 'manual',
    label: 'Manual Review',
    path: '/dashboard/recommendations',
  };
}

function buildRecommendationRefsWorkbenchBlock(block, recommendationLookup) {
  const payload = block?.payload || {};
  const ids = [...new Set(
    (Array.isArray(payload?.recommendationIds) ? payload.recommendationIds : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  )];
  const resolved = ids
    .map((id) => recommendationLookup?.get?.(id))
    .filter(Boolean);

  const items = resolved.map((rec) => {
    const priorityValue = getRecommendationPriorityValue(rec);
    const metadata = rec?.metadata || {};
    const affectedResources = (Array.isArray(rec?.targetResources) ? rec.targetResources : [])
      .map((resource, index) => ({
        id: resource?.resourceId || resource?.resourceArn || resource?.displayName || `resource_${index + 1}`,
        displayName: resource?.displayName || resource?.resourceId || resource?.resourceArn || `Resource ${index + 1}`,
        resourceType: resource?.resourceType || null,
        region: resource?.region || null,
        accountId: resource?.accountId || null,
        environmentName: resource?.environmentName || null,
        workloadName: resource?.workloadName || null,
      }));
    const remediation = buildRecommendationRemediationFromState(rec);

    return {
      id: rec.id,
      title: rec.title || 'Recommendation',
      priority: getPriorityLabel(priorityValue) || null,
      whyRecommended: metadata?.summary
        || metadata?.description
        || (metadata?.domain ? `Relevant to ${metadata.domain}.` : 'Relevant to your current cloud posture.'),
      whatToExpect: remediation?.type === 'report'
        ? 'Runs the report flow and prepares output you can review.'
        : remediation?.type === 'blueprint'
        ? 'Launches a guided blueprint flow with execution steps.'
        : remediation?.type === 'platform'
        ? 'Routes to the platform remediation flow for this recommendation.'
        : 'Opens remediation guidance and lets you apply from chat.',
      risk: metadata?.risk || estimateRiskFromPriorityValue(priorityValue),
      effort: metadata?.effort || estimateEffortFromPriorityValue(priorityValue),
      remediation,
      affectedResourcesCount: affectedResources.length,
      affectedResources: affectedResources.slice(0, 200),
      applyAction: {
        label: 'Apply',
        intent: 'apply_recommendation',
        payload: {
          recommendationId: rec.id,
          actionType: remediation?.type || null,
          path: remediation?.path || null,
        },
      },
    };
  });

  const highestPriority = resolved.reduce((max, rec) => Math.max(max, getRecommendationPriorityValue(rec)), 0);
  const defaultActions = [
    items.length > 1
      ? {
          label: 'Apply All',
          intent: 'apply_all_recommendations',
          payload: { recommendationIds: items.map((item) => item.id) },
        }
      : null,
    {
      label: 'Open Full View',
      intent: 'navigate',
      payload: { path: '/dashboard/recommendations' },
    },
  ].filter(Boolean);
  const actions = Array.isArray(block?.actions) && block.actions.length > 0
    ? block.actions
    : defaultActions;

  return {
    type: 'recommendation_workbench',
    payload: {
      title: payload?.title || 'Recommendation Workbench',
      summary: items.length > 0
        ? `Showing ${items.length} recommendation${items.length === 1 ? '' : 's'} from your request.`
        : 'No matching recommendations found in local state.',
      whyRecommended: items.length > 0
        ? 'These were pulled from the latest recommendation query in this chat.'
        : null,
      whatToExpect: items.length > 0
        ? 'Review affected resources, then apply individual fixes or all at once.'
        : null,
      riskLevel: items.length > 0 ? estimateRiskFromPriorityValue(highestPriority) : null,
      effortLevel: items.length > 0 ? estimateEffortFromPriorityValue(highestPriority) : null,
      items,
    },
    actions,
  };
}

function GenericObjectBlock({ block, onAction, disabled }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <pre className="whitespace-pre-wrap text-xs text-gray-700">{JSON.stringify(block?.payload || {}, null, 2)}</pre>
      <BlockActions actions={block?.actions} onAction={onAction} disabled={disabled} />
    </div>
  );
}

function GuardrailBlock({ block, onAction, disabled }) {
  const checks = block?.payload?.checks || [];
  const status = block?.payload?.status || 'unknown';

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
        Plan Readiness: {status}
      </div>
      {block?.payload?.summary ? <p className="mt-1 text-xs text-emerald-800">{block.payload.summary}</p> : null}
      {checks.length > 0 ? (
        <div className="mt-3 space-y-2">
          {checks.map((check) => (
            <div key={check.id} className="rounded border border-emerald-200 bg-white px-2 py-1.5 text-xs text-gray-700">
              <div className="font-medium">{check.id}</div>
              <div>{check.message}</div>
            </div>
          ))}
        </div>
      ) : null}
      <BlockActions actions={block?.actions} onAction={onAction} disabled={disabled} />
    </div>
  );
}

function RunPlanBlock({ block, onAction, disabled }) {
  const steps = block?.payload?.steps || [];
  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
      <div className="text-sm font-semibold text-indigo-900">Approval-Ready Plan</div>
      {block?.payload?.estimatedImpact ? (
        <div className="mt-1 text-xs text-indigo-800">{block.payload.estimatedImpact}</div>
      ) : null}
      {steps.length > 0 ? (
        <ol className="mt-3 list-decimal pl-5 text-xs text-gray-700 space-y-1">
          {steps.map((step, index) => (
            <li key={`${step}-${index}`}>{step}</li>
          ))}
        </ol>
      ) : null}
      <BlockActions actions={block?.actions} onAction={onAction} disabled={disabled} />
    </div>
  );
}

function ApprovalCardBlock({ block, onAction, disabled }) {
  const payload = block?.payload || {};
  const affectedScope = payload?.affectedScope || {};
  const envCount = Array.isArray(affectedScope.environments) ? affectedScope.environments.length : 0;
  const workloadCount = Array.isArray(affectedScope.workloads) ? affectedScope.workloads.length : 0;
  const reportCount = Array.isArray(affectedScope.reports) ? affectedScope.reports.length : 0;

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <div className="text-sm font-semibold text-emerald-900">{payload?.title || 'Approval Required'}</div>
      {payload?.summary ? <p className="mt-1 text-xs text-emerald-800">{payload.summary}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-emerald-800">
        <span className="rounded bg-white px-2 py-1">Environments: {envCount}</span>
        <span className="rounded bg-white px-2 py-1">Workloads: {workloadCount}</span>
        <span className="rounded bg-white px-2 py-1">Reports: {reportCount}</span>
      </div>
      <BlockActions actions={block?.actions} onAction={onAction} disabled={disabled} />
    </div>
  );
}

function RunStatusBlock({ block, onAction, disabled }) {
  const payload = block?.payload || {};
  const status = String(payload?.status || payload?.state || 'unknown');
  const statusClass = status.toLowerCase().includes('fail')
    ? 'border-red-200 bg-red-50 text-red-800'
    : status.toLowerCase().includes('wait')
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : status.toLowerCase().includes('run')
    ? 'border-blue-200 bg-blue-50 text-blue-800'
    : 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <div className={`rounded-lg border p-3 ${statusClass}`}>
      <div className="text-sm font-semibold">Run Status: {status}</div>
      {payload?.summary ? <p className="mt-1 text-xs">{payload.summary}</p> : null}
      {payload?.runId ? <p className="mt-1 text-[11px]">Run ID: {payload.runId}</p> : null}
      <BlockActions actions={block?.actions} onAction={onAction} disabled={disabled} />
    </div>
  );
}

function WorkloadResourcesPreviewBlock({ block, onAction, disabled }) {
  const payload = block?.payload || {};
  const resources = Array.isArray(payload?.resources) ? payload.resources : [];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-sm font-semibold text-slate-900">{payload?.title || 'Resource Preview'}</div>
      {payload?.summary ? <p className="mt-1 text-xs text-slate-700">{payload.summary}</p> : null}
      {resources.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          {resources.slice(0, 6).map((resource, index) => (
            <div key={`${resource?.resourceId || resource?.id || 'resource'}-${index}`} className="rounded bg-white px-2 py-1.5 text-xs text-slate-700">
              <span className="font-medium text-slate-800">{resource?.displayName || resource?.resourceId || resource?.id || 'Resource'}</span>
              {resource?.resourceType ? <span className="ml-2 text-slate-500">({resource.resourceType})</span> : null}
            </div>
          ))}
        </div>
      ) : null}
      <BlockActions actions={block?.actions} onAction={onAction} disabled={disabled} />
    </div>
  );
}

function ArtifactCardBlock({ block, onAction, disabled }) {
  const payload = block?.payload || {};
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-sm font-semibold text-slate-900">{payload?.title || 'Artifact'}</div>
      {payload?.summary ? <p className="mt-1 text-xs text-slate-700">{payload.summary}</p> : null}
      {payload?.type ? <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">{payload.type}</p> : null}
      {payload?.url ? (
        <a
          href={payload.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs font-medium text-blue-700 underline"
        >
          Open artifact
        </a>
      ) : null}
      <BlockActions actions={block?.actions} onAction={onAction} disabled={disabled} />
    </div>
  );
}

function CloudFormationOperationCardBlock({ block, onAction, disabled }) {
  return (
    <CloudFormationOperationCard
      payload={block?.payload}
      actions={block?.actions}
      onAction={onAction}
      disabled={disabled}
    />
  );
}

function WaitingInputsListBlock({ block, onAction, disabled }) {
  const items = block?.payload?.items || [];
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="text-sm font-semibold text-amber-900">Waiting on Your Input</div>
      {items.length > 0 ? (
        <div className="mt-2 space-y-2">
          {items.slice(0, 5).map((item) => (
            <div key={item.id} className="rounded border border-amber-200 bg-white p-2 text-xs text-slate-700">
              <div className="font-semibold text-slate-900">{item.title || 'Pending item'}</div>
              {item.reason ? <div className="mt-0.5">{item.reason}</div> : null}
              {item.requiredInput ? <div className="mt-0.5 text-slate-600">Needed: {item.requiredInput}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
      <BlockActions actions={block?.actions} onAction={onAction} disabled={disabled} />
    </div>
  );
}

function RecommendationWorkbenchBlock({ block, onAction, onShowResources, disabled }) {
  const payload = block?.payload || {};
  const items = Array.isArray(payload?.items) ? payload.items : [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900">{payload?.title || 'Recommendation Workbench'}</div>
            {payload?.summary ? <p className="mt-0.5 text-xs text-slate-600">{payload.summary}</p> : null}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {payload?.riskLevel ? (
              <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
                Risk: {payload.riskLevel}
              </span>
            ) : null}
            {payload?.effortLevel ? (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                Effort: {payload.effortLevel}
              </span>
            ) : null}
          </div>
        </div>

        {(payload?.whyRecommended || payload?.whatToExpect) ? (
          <div className="mt-2 space-y-1 text-xs text-slate-600">
            {payload?.whyRecommended ? (
              <p><span className="font-medium text-slate-700">Why recommended:</span> {payload.whyRecommended}</p>
            ) : null}
            {payload?.whatToExpect ? (
              <p><span className="font-medium text-slate-700">What to expect:</span> {payload.whatToExpect}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Items */}
      {items.length > 0 ? (
        <div className="divide-y divide-slate-100">
          {items.map((item) => (
            <div key={item.id} className="px-4 py-3 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-start gap-3">
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{item.title || 'Recommendation'}</span>
                    {item.remediation?.label ? (
                      <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        {item.remediation.label}
                      </span>
                    ) : null}
                  </div>
                  {item.whyRecommended ? (
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2">{item.whyRecommended}</p>
                  ) : null}
                  {item.whatToExpect ? (
                    <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">{item.whatToExpect}</p>
                  ) : null}
                </div>

                {/* Badges + Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={disabled || !onShowResources}
                      onClick={() => onShowResources?.(item)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-600">
                        {Number(item?.affectedResourcesCount || 0)}
                      </span>
                      <span className="hidden sm:inline">Resources</span>
                    </button>
                    {item.applyAction ? (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onAction(item.applyAction)}
                        className="inline-flex items-center rounded-md bg-primary-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {item.applyAction.label || 'Apply'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Footer actions */}
      {Array.isArray(block?.actions) && block.actions.length > 0 ? (
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2.5">
          <BlockActions actions={block.actions} onAction={onAction} disabled={disabled} noMargin />
        </div>
      ) : null}
    </div>
  );
}

function WaitingRunDetailBlock({ block, onAction, disabled }) {
  const payload = block?.payload || {};
  const typeLabel = payload?.runType === 'workflow'
    ? 'Workflow'
    : payload?.runType === 'agent'
    ? 'Agent'
    : payload?.runType === 'report'
    ? 'Report'
    : 'Run';

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="text-sm font-semibold text-amber-900">{payload?.title || 'Waiting Item'}</div>
      <p className="mt-1 text-xs text-amber-800">
        {payload?.explanation || payload?.reason || 'This run is waiting for your input before it can continue.'}
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-amber-900">
        {payload?.status ? <span className="rounded bg-white px-2 py-1">Status: {payload.status}</span> : null}
        <span className="rounded bg-white px-2 py-1">Type: {typeLabel}</span>
      </div>
      <BlockActions actions={block?.actions} onAction={onAction} disabled={disabled} />
    </div>
  );
}

// Custom Path Panel - for "Describe What You Need" with session context options
function CustomPathPanel({
  availableReports = [],
  availableWorkloads = [],
  availableEnvironments = [],
  healthCheckEnvironments = [],
  costAnalysisEnvironments = [],
  workloadHealthById = {},
  environmentHealthById = {},
  loadingEnvironmentHealthIds = new Set(),
  loadingWorkloadHealthIds = new Set(),
  environmentCostById = {},
  loadingEnvironmentCostIds = new Set(),
  loadingReportKey = null,
  executiveSummaryRequestsByKey = {},
  activeScope = {},
  enableHealthContext = true,
  enableCostContext = true,
  onAddReport,
  onRunHealthCheck,
  onOpenHealthDrilldown,
  onViewExecutiveSummary,
  formatDate,
  disabled = false,
}) {
  const [expandedSection, setExpandedSection] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const drilldownScrollRef = useRef(null);

  const toggleSection = (section) => {
    setExpandedSection((prev) => prev === section ? null : section);
    setSearchQuery('');
  };

  useEffect(() => {
    if (drilldownScrollRef.current) {
      drilldownScrollRef.current.scrollTop = 0;
    }
  }, [expandedSection, searchQuery]);

  const scopedReportIds = new Set(
    (activeScope.reports || [])
      .flatMap((report) => [report.id, report.scanId, report.reportId])
      .filter(Boolean)
  );

  const filteredReports = availableReports.filter(r => {
    const name = (r.title || r.reportId || '').toLowerCase();
    const env = (r.environmentName || '').toLowerCase();
    return name.includes(searchQuery.toLowerCase()) || env.includes(searchQuery.toLowerCase());
  });

  const loadingEnvironmentIds = useMemo(() => (
    loadingEnvironmentHealthIds instanceof Set
      ? loadingEnvironmentHealthIds
      : new Set(Array.isArray(loadingEnvironmentHealthIds) ? loadingEnvironmentHealthIds : [])
  ), [loadingEnvironmentHealthIds]);
  const loadingCostEnvironmentIds = useMemo(() => (
    loadingEnvironmentCostIds instanceof Set
      ? loadingEnvironmentCostIds
      : new Set(Array.isArray(loadingEnvironmentCostIds) ? loadingEnvironmentCostIds : [])
  ), [loadingEnvironmentCostIds]);

  const reviewTargets = useMemo(() => {
    const workloads = enableHealthContext
      ? availableWorkloads
        .filter((w) => !String(w.workloadName || w.workloadId || '').startsWith('PermissionProfile-'))
        .map((workload) => {
          const workloadId = String(workload.workloadId || '').trim();
          const insight = workloadHealthById?.[workloadId] || null;
          return {
            key: `workload:${workloadId}`,
            targetType: 'workload',
            targetId: workloadId,
            name: workload.workloadName || workload.name || workloadId,
            subtitle: 'Workload',
            supportsHealth: true,
            supportsCost: false,
            reviews: { health: insight },
          };
        })
      : [];
    const environments = costAnalysisEnvironments.map((env) => {
      const environmentId = String(env.recordId || '').trim();
      const healthInsight = environmentHealthById?.[environmentId] || null;
      const costInsight = environmentCostById?.[environmentId] || null;
      const supportsHealth = enableHealthContext && isAwsAccountProfile(env);
      const supportsCost = enableCostContext;
      return {
        key: `environment:${environmentId}`,
        targetType: 'environment',
        targetId: environmentId,
        name: env.name || environmentId,
        subtitle: env.type || 'Environment',
        supportsHealth,
        supportsCost,
        reviews: {
          ...(supportsHealth ? { health: healthInsight } : {}),
          ...(supportsCost ? { cost: costInsight } : {}),
        },
      };
    }).filter((item) => item.targetId && (item.supportsHealth || item.supportsCost));
    return [...workloads, ...environments];
  }, [
    availableWorkloads,
    costAnalysisEnvironments,
    enableCostContext,
    enableHealthContext,
    environmentCostById,
    environmentHealthById,
    workloadHealthById,
  ]);

  const filteredHealthTargets = useMemo(() => (
    reviewTargets.filter((target) => {
      const text = `${target.name} ${target.subtitle}`.toLowerCase();
      return text.includes(searchQuery.toLowerCase());
    })
  ), [searchQuery, reviewTargets]);

  useEffect(() => {
    if (expandedSection === 'health') {
      onOpenHealthDrilldown?.();
    }
  }, [expandedSection, onOpenHealthDrilldown]);

  const nonProfileWorkloadCount = availableWorkloads.filter(w => !String(w.workloadName || w.workloadId || '').startsWith('PermissionProfile-')).length;
  const summaryItemCount = availableEnvironments.length + nonProfileWorkloadCount;

  const canReviewHealthCost = enableHealthContext || enableCostContext;
  const contextCards = [
    {
      id: 'reports',
      label: 'Report Findings',
      icon: FileBarChart,
      color: 'blue',
      count: availableReports.length,
      subtitle: `${availableReports.length} report${availableReports.length !== 1 ? 's' : ''}`,
    },
    ...(canReviewHealthCost
      ? [{
          id: 'health',
          label: enableHealthContext && enableCostContext
            ? 'Health & Cost'
            : enableHealthContext
              ? 'Health'
              : 'Cost',
          icon: Activity,
          color: 'emerald',
          count: reviewTargets.length,
          subtitle: `${reviewTargets.length} target${reviewTargets.length !== 1 ? 's' : ''}`,
        }]
      : []),
    {
      id: 'summary',
      label: 'Exec Summaries',
      icon: BarChart3,
      color: 'violet',
      count: summaryItemCount,
      subtitle: `${summaryItemCount} item${summaryItemCount !== 1 ? 's' : ''}`,
    },
  ];

  useEffect(() => {
    if (!canReviewHealthCost && expandedSection === 'health') {
      setExpandedSection(null);
    }
  }, [canReviewHealthCost, expandedSection]);

  const colorMap = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-500', activeBorder: 'border-blue-300 bg-blue-50/50', hoverBorder: 'hover:border-blue-200' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-500', activeBorder: 'border-emerald-300 bg-emerald-50/50', hoverBorder: 'hover:border-emerald-200' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-500', activeBorder: 'border-violet-300 bg-violet-50/50', hoverBorder: 'hover:border-violet-200' },
  };

  return (
    <div className="space-y-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Add to session context (Optional)</div>

      {/* Three cards side by side */}
      <div className={`grid gap-2 ${contextCards.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {contextCards.map((card) => {
          const CardIcon = card.icon;
          const colors = colorMap[card.color];
          const isActive = expandedSection === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => toggleSection(card.id)}
              disabled={disabled || card.count === 0}
              className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center transition disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive
                  ? colors.activeBorder + ' ring-1 ring-offset-0 ring-' + card.color + '-200'
                  : 'border-slate-200 bg-white ' + colors.hoverBorder
              }`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors.bg}`}>
                <CardIcon className={`h-4 w-4 ${colors.text}`} />
              </div>
              <div className="text-[11px] font-medium text-slate-700">{card.label}</div>
              <div className="text-[10px] text-slate-400">{card.subtitle}</div>
            </button>
          );
        })}
      </div>

      {/* Expanded drilldown */}
      {expandedSection && (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          {/* Search */}
          <div className="relative border-b border-slate-100">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full h-8 pl-8 pr-3 text-xs border-0 focus:outline-none focus:ring-0"
            />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div ref={drilldownScrollRef} className="max-h-[200px] overflow-y-auto">
            {/* Reports drilldown */}
            {expandedSection === 'reports' && (
              filteredReports.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {filteredReports.map((report) => {
                    const reportKey = buildReportEntryKey(report) || report.id || report.scanId || report.reportId;
                    const isAdded = scopedReportIds.has(reportKey);
                    const isLoading = loadingReportKey === reportKey;
                    const dateLabel = formatDate?.(report.updatedAt || report.lastUpdateTime || report.latestAssessmentDate) || '';
                    return (
                      <button
                        key={reportKey}
                        type="button"
                        disabled={disabled || isAdded || isLoading}
                        onClick={() => onAddReport?.(reportKey)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left transition ${
                          isAdded ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                        } disabled:opacity-60`}
                      >
                        <FileBarChart className={`h-3.5 w-3.5 flex-shrink-0 ${isAdded ? 'text-blue-500' : 'text-slate-400'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate-700 truncate">{report.title || report.reportId}</div>
                          <div className="text-[10px] text-slate-400 truncate">{report.environmentName || '—'}{dateLabel ? ` • ${dateLabel}` : ''}</div>
                        </div>
                        {isLoading ? (
                          <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin flex-shrink-0" />
                        ) : isAdded ? (
                          <Check className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                        ) : (
                          <Plus className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-4 text-xs text-slate-400 text-center">
                  {searchQuery ? 'No matches' : 'No reports available'}
                </div>
              )
            )}

            {/* Health & Cost drilldown */}
            {expandedSection === 'health' && (
              filteredHealthTargets.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {filteredHealthTargets.map((target) => {
                    const isEnvironment = target.targetType === 'environment';
                    const TargetIcon = isEnvironment ? Cloud : Layers;
                    const healthInsight = target.reviews?.health;
                    const costInsight = target.reviews?.cost;
                    const healthStats = healthInsight?.stats || {};
                    const costStats = costInsight?.stats || {};
                    const healthLoading = isEnvironment && loadingEnvironmentIds.has(target.targetId);
                    const costLoading = isEnvironment && loadingCostEnvironmentIds.has(target.targetId);
                    return (
                      <div key={target.key} className="flex items-center gap-3 px-3 py-2.5">
                        <TargetIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-700 truncate">{target.name}</div>
                          <div className="text-[10px] text-slate-400">{target.subtitle}</div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {target.supportsHealth !== false && (
                            <button
                              type="button"
                              disabled={disabled || healthLoading}
                              onClick={() => onRunHealthCheck?.({ type: target.targetType, id: target.targetId, reviewKind: 'health' })}
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50"
                            >
                              {healthLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />}
                              Health
                            </button>
                          )}
                          {isEnvironment && target.supportsCost !== false && (
                            <button
                              type="button"
                              disabled={disabled || costLoading}
                              onClick={() => onRunHealthCheck?.({ type: target.targetType, id: target.targetId, reviewKind: 'cost' })}
                              className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-100 transition disabled:opacity-50"
                            >
                              {costLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3" />}
                              Cost
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-4 text-xs text-slate-400 text-center">
                  {searchQuery ? 'No matches' : 'No workloads or environments available'}
                </div>
              )
            )}

            {/* Executive Summaries drilldown */}
            {expandedSection === 'summary' && (() => {
              const summaryItems = [
                ...availableEnvironments.map(env => ({
                  key: `env:${env.recordId}`,
                  type: 'environment',
                  id: env.recordId,
                  name: env.name || env.recordId,
                  subtitle: env.type || 'Environment',
                  icon: Cloud,
                })),
                ...availableWorkloads
                  .filter(w => !String(w.workloadName || w.workloadId || '').startsWith('PermissionProfile-'))
                  .map(w => ({
                    key: `workload:${w.workloadId}`,
                    type: 'workload',
                    id: w.workloadId,
                    name: w.workloadName || w.workloadId,
                    subtitle: 'Workload',
                    icon: Layers,
                  })),
              ].filter(item => {
                const text = `${item.name} ${item.subtitle}`.toLowerCase();
                return text.includes(searchQuery.toLowerCase());
              });

              return summaryItems.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {summaryItems.map((item) => {
                    const ItemIcon = item.icon;
                    const isLoading =
                      executiveSummaryRequestsByKey?.[`${item.type}:${item.id}`]?.status ===
                      'loading';
                    return (
                      <button
                        key={item.key}
                        type="button"
                        disabled={disabled || isLoading}
                        onClick={() => onViewExecutiveSummary?.(item.type, item.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 transition disabled:opacity-60"
                      >
                        <ItemIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate-700 truncate">{item.name}</div>
                          <div className="text-[10px] text-slate-400">{item.subtitle}</div>
                        </div>
                        {isLoading ? (
                          <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin flex-shrink-0" />
                        ) : (
                          <Plus className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-4 text-xs text-slate-400 text-center">
                  {searchQuery ? 'No matches' : 'No items available'}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// Suggested Path Panel - two-column layout: suggestions (left) + review insights (right)
function SuggestedPathPanel({
  suggestionCards = [],
  reportsToRun = [],
  availableReports = [],
  availableWorkloads = [],
  availableEnvironments = [],
  healthCheckEnvironments = [],
  costAnalysisEnvironments = [],
  workloadHealthById = {},
  environmentHealthById = {},
  loadingEnvironmentHealthIds = new Set(),
  loadingWorkloadHealthIds = new Set(),
  environmentCostById = {},
  loadingEnvironmentCostIds = new Set(),
  onCardAction,
  onAddReport,
  onRunHealthCheck,
  onRefreshHealthCheck,
  onOpenHealthDrilldown,
  onRunSuggestedReport,
  onViewExecutiveSummary,
  onLoadMore,
  onRefreshSuggestions,
  hasMoreSuggestions = false,
  isLoading = false,
  isRefreshingSuggestions = false,
  formatDate,
  loadingReportKey = null,
  executiveSummaryRequestsByKey = {},
  enableHealthContext = true,
  enableCostContext = true,
  disabled = false,
}) {
  return null;

  const [drilldownView, setDrilldownView] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [carouselPage, setCarouselPage] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const pageSizeRef = useRef(0);
  const pageBreaksRef = useRef([0]);

  useEffect(() => {
    if (pageSizeRef.current === 0 && suggestionCards.length > 0) {
      pageSizeRef.current = suggestionCards.length;
      pageBreaksRef.current = [0];
    }
  }, [suggestionCards.length]);

  const pages = useMemo(() => {
    if (suggestionCards.length === 0) return [];
    const size = pageSizeRef.current || suggestionCards.length;
    const result = [];
    for (let i = 0; i < suggestionCards.length; i += size) {
      result.push(suggestionCards.slice(i, i + size));
    }
    return result;
  }, [suggestionCards]);

  const totalPages = pages.length;
  const currentPageCards = pages[carouselPage] || [];

  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      await onLoadMore?.();
      setCarouselPage((prev) => prev + 1);
    } finally {
      setIsLoadingMore(false);
    }
  }, [onLoadMore]);

  useEffect(() => {
    if (totalPages === 0) {
      if (carouselPage !== 0) setCarouselPage(0);
      return;
    }
    if (carouselPage > totalPages - 1) {
      setCarouselPage(totalPages - 1);
    }
  }, [carouselPage, totalPages]);

  const filteredReports = availableReports.filter(r => {
    const name = (r.title || r.reportId || '').toLowerCase();
    const env = (r.environmentName || '').toLowerCase();
    return name.includes(searchQuery.toLowerCase()) || env.includes(searchQuery.toLowerCase());
  });

  const filteredWorkloads = availableWorkloads.filter(w => {
    const name = (w.workloadName || w.workloadId || '').toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const filteredEnvs = availableEnvironments.filter(env => {
    const name = (env.name || env.recordId || '').toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });
  const healthSearch = searchQuery.toLowerCase();
  const loadingEnvironmentIds = useMemo(() => (
    loadingEnvironmentHealthIds instanceof Set
      ? loadingEnvironmentHealthIds
      : new Set(Array.isArray(loadingEnvironmentHealthIds) ? loadingEnvironmentHealthIds : [])
  ), [loadingEnvironmentHealthIds]);
  const loadingCostEnvironmentIds = useMemo(() => (
    loadingEnvironmentCostIds instanceof Set
      ? loadingEnvironmentCostIds
      : new Set(Array.isArray(loadingEnvironmentCostIds) ? loadingEnvironmentCostIds : [])
  ), [loadingEnvironmentCostIds]);
  const reviewTargets = useMemo(() => {
    const workloads = enableHealthContext
      ? availableWorkloads.map((workload) => {
        const workloadId = String(workload.workloadId || '').trim();
        const insight = workloadHealthById?.[workloadId] || null;
        return {
          key: `workload:${workloadId}`,
          targetType: 'workload',
          targetId: workloadId,
          label: workload.workloadName || workloadId,
          subtitle: 'Workload',
          supportsHealth: true,
          supportsCost: false,
          reviews: {
            health: {
              stats: insight?.stats || {
                total: 0,
                evaluated: 0,
                healthy: 0,
                issues: 0,
                skipped: 0,
              },
            },
          },
        };
      }).filter((item) => item.targetId)
      : [];

    const environments = costAnalysisEnvironments.map((env) => {
      const environmentId = String(env.recordId || '').trim();
      const healthInsight = environmentHealthById?.[environmentId] || null;
      const costInsight = environmentCostById?.[environmentId] || null;
      const supportsHealth = enableHealthContext && isAwsAccountProfile(env);
      const supportsCost = enableCostContext;
      return {
        key: `environment:${environmentId}`,
        targetType: 'environment',
        targetId: environmentId,
        label: env.name || environmentId,
        subtitle: 'Environment',
        supportsHealth,
        supportsCost,
        reviews: {
          ...(supportsHealth
            ? {
                health: {
                  stats: healthInsight?.stats || {
                    total: 0,
                    evaluated: 0,
                    healthy: 0,
                    issues: 0,
                    skipped: 0,
                  },
                },
              }
            : {}),
          ...(supportsCost
            ? {
                cost: {
                  stats: costInsight?.stats || {
                    total: 0,
                    healthy: 0,
                    problem: 0,
                    unknown: 0,
                    error: 0,
                  },
                },
              }
            : {}),
        },
      };
    }).filter((item) => item.targetId && (item.supportsHealth || item.supportsCost));

    return [...workloads, ...environments];
  }, [
    availableWorkloads,
    costAnalysisEnvironments,
    enableCostContext,
    enableHealthContext,
    environmentCostById,
    environmentHealthById,
    workloadHealthById,
  ]);
  const filteredHealthTargets = useMemo(() => (
    reviewTargets.filter((target) => {
      const reviewLabels = Object.keys(target.reviews || {}).join(' ');
      const searchText = `${target.label || ''} ${target.subtitle || ''} ${reviewLabels}`.toLowerCase();
      return searchText.includes(healthSearch);
    })
  ), [healthSearch, reviewTargets]);
  const totalHealthTargets = reviewTargets.length;

  useEffect(() => {
    if (drilldownView === 'health') {
      onOpenHealthDrilldown?.();
    }
  }, [drilldownView, onOpenHealthDrilldown]);

  const handleBackToSuggestions = () => {
    setDrilldownView(null);
    setSearchQuery('');
  };

  const toScopeLabel = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      return value.name || value.title || value.id || value.accountId || null;
    }
    return null;
  };

  const compactListPreview = (items, limit = 2) => {
    const list = Array.isArray(items) ? items.map(toScopeLabel).filter(Boolean) : [];
    if (list.length === 0) return null;
    if (list.length <= limit) return list.join(', ');
    return `${list.slice(0, limit).join(', ')} +${list.length - limit}`;
  };

  if (drilldownView) {
    const drilldownConfig = {
      'suggested-reports': {
        title: 'Reports to Run',
        icon: Play,
        emptyText: 'No suggested reports available',
      },
      reports: {
        title: 'Report Findings',
        icon: FileBarChart,
        emptyText: 'No reports available',
      },
      health: {
        title: 'Health & Cost Reviews',
        icon: Activity,
        emptyText: 'No workloads or environments available',
      },
      summary: {
        title: 'Executive Summaries',
        icon: BarChart3,
        emptyText: 'No items available',
      },
    };

    const config = drilldownConfig[drilldownView] || drilldownConfig.reports;
    const DrilldownIcon = config.icon;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackToSuggestions}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <div className="flex-1 h-px bg-slate-200" />
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <DrilldownIcon className="h-3.5 w-3.5" />
            {config.title}
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${config.title.toLowerCase()}...`}
            className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="rounded-lg border border-slate-200 overflow-hidden max-h-[280px] overflow-y-auto">
          {drilldownView === 'suggested-reports' && (() => {
            const filtered = reportsToRun.filter((r) => {
              const name = (r.title || '').toLowerCase();
              const env = (r.environmentName || '').toLowerCase();
              return name.includes(searchQuery.toLowerCase()) || env.includes(searchQuery.toLowerCase());
            });
            return filtered.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {filtered.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-teal-50/50 transition"
                  >
                    <FileBarChart className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-700 truncate">{report.title}</div>
                      {report.environmentName && (
                        <div className="text-[10px] text-slate-400 truncate">{report.environmentName}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={disabled || !report.reportPlanId}
                      onClick={() => onRunSuggestedReport?.(report)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100 transition disabled:opacity-50 flex-shrink-0"
                    >
                      <Play className="h-3 w-3" />
                      Run Report
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-xs text-slate-400 text-center">{searchQuery ? 'No matches' : config.emptyText}</div>
            );
          })()}

          {drilldownView === 'reports' && (
            filteredReports.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {filteredReports.map((report) => {
                  const statusToken = String(report.status || '').trim().toLowerCase().replace(/\s+/g, '_');
                  let statusMeta = { label: report.status || '—', className: 'bg-slate-50 text-slate-600' };
                  if (['successful', 'partial_success', 'complete', 'completed', 'done'].includes(statusToken)) {
                    statusMeta = { label: 'Complete', className: 'bg-emerald-50 text-emerald-700' };
                  } else if (['failed', 'error'].includes(statusToken)) {
                    statusMeta = { label: 'Failed', className: 'bg-red-50 text-red-700' };
                  } else if (['running', 'in_progress', 'started', 'processing'].includes(statusToken)) {
                    statusMeta = { label: 'Running', className: 'bg-blue-50 text-blue-700' };
                  } else if (['waiting', 'pending', 'queued'].includes(statusToken)) {
                    statusMeta = { label: 'Queued', className: 'bg-amber-50 text-amber-700' };
                  }
                  return (
                    <button
                      key={buildReportEntryKey(report) || report.scanId || report.reportId}
                      type="button"
                      disabled={disabled}
                      onClick={() => onAddReport?.(buildReportEntryKey(report) || report.scanId || report.reportId)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-blue-50 transition disabled:opacity-50 group"
                    >
                      <div className="flex-shrink-0">
                        {loadingReportKey === (buildReportEntryKey(report) || report.scanId || report.reportId) ? (
                          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                        ) : (
                          <FileBarChart className="h-4 w-4 text-slate-400 group-hover:text-blue-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-700 truncate">{report.title || 'Untitled Report'}</div>
                        <div className="text-[10px] text-slate-400">{report.environmentName || '—'} • {formatDate?.(report.updatedAt || report.lastUpdateTime) || '—'}</div>
                      </div>
                      <span className={`text-[10px] font-medium rounded px-2 py-0.5 flex-shrink-0 ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                      <Plus className="h-4 w-4 text-slate-300 group-hover:text-blue-500 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-8 text-xs text-slate-400 text-center">{searchQuery ? 'No matches' : config.emptyText}</div>
            )
          )}

          {drilldownView === 'health' && (
            filteredHealthTargets.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {filteredHealthTargets.map((target) => {
                  const isEnvironment = target.targetType === 'environment';
                  const TargetIcon = isEnvironment ? Cloud : Layers;
                  const healthStats = target?.reviews?.health?.stats || {
                    total: 0,
                    evaluated: 0,
                    healthy: 0,
                    issues: 0,
                    skipped: 0,
                  };
                  const costStats = target?.reviews?.cost?.stats || {
                    total: 0,
                    healthy: 0,
                    problem: 0,
                    unknown: 0,
                    error: 0,
                  };
                  const healthIssueCount = Number(healthStats.issues || 0);
                  const healthHasChecks = Number(healthStats.evaluated || 0) > 0;
                  const costIssueCount = Number(costStats.problem || 0) + Number(costStats.error || 0);
                  const costHasChecks = Number(costStats.total || 0) > 0;
                  const healthStatusLabel = healthHasChecks
                    ? (healthIssueCount > 0 ? `${healthIssueCount} issue${healthIssueCount === 1 ? '' : 's'}` : 'Healthy')
                    : 'No checks';
                  const costStatusLabel = costHasChecks
                    ? (costIssueCount > 0 ? `${costIssueCount} issue${costIssueCount === 1 ? '' : 's'}` : 'Healthy')
                    : 'Data';
                  const healthLoading = isEnvironment && loadingEnvironmentIds.has(target.targetId);
                  const costLoading = isEnvironment && loadingCostEnvironmentIds.has(target.targetId);

                  return (
                    <div
                      key={target.key}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition"
                    >
                      <TargetIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-700 truncate">{target.label}</div>
                      <div className="text-[10px] text-slate-400">
                        {target.subtitle}
                        {isEnvironment
                          ? target.supportsHealth && target.supportsCost
                            ? ' • Health + Cost available'
                            : target.supportsHealth
                              ? ' • Health available'
                              : ' • Cost available'
                          : ' • Health available'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {target.supportsHealth !== false ? (
                          <button
                            type="button"
                            disabled={disabled || healthLoading}
                            onClick={() => onRunHealthCheck?.({ type: target.targetType, id: target.targetId, reviewKind: 'health' })}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50"
                          >
                            {healthLoading ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Loading
                              </>
                            ) : (
                              <>
                                <Activity className="h-3 w-3" />
                                Health
                                <span className="text-emerald-800/90">{healthStatusLabel}</span>
                              </>
                            )}
                          </button>
                        ) : null}
                        {isEnvironment && target.supportsCost !== false ? (
                          <button
                            type="button"
                            disabled={disabled || costLoading}
                            onClick={() => onRunHealthCheck?.({ type: target.targetType, id: target.targetId, reviewKind: 'cost' })}
                            className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-100 transition disabled:opacity-50"
                          >
                            {costLoading ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Loading
                              </>
                            ) : (
                              <>
                                <DollarSign className="h-3 w-3" />
                                Cost
                                <span className="text-amber-800/90">{costStatusLabel}</span>
                              </>
                            )}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-8 text-xs text-slate-400 text-center">{searchQuery ? 'No matches' : config.emptyText}</div>
            )
          )}

          {drilldownView === 'summary' && (
            (filteredEnvs.length > 0 || filteredWorkloads.length > 0) ? (
              <div className="divide-y divide-slate-100">
                {filteredEnvs.map((env) => {
                  const isLoading =
                    executiveSummaryRequestsByKey?.[`environment:${env.recordId}`]?.status ===
                    'loading';
                  return (
                    <button
                      key={env.recordId}
                      type="button"
                      disabled={disabled || isLoading}
                      onClick={() => onViewExecutiveSummary?.('environment', env.recordId)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition disabled:opacity-50 group"
                    >
                      <Cloud className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-700 truncate">{env.name || env.recordId}</div>
                        <div className="text-[10px] text-slate-400">Environment</div>
                      </div>
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 text-primary-500 animate-spin flex-shrink-0" />
                      ) : (
                        <Plus className="h-4 w-4 text-slate-300 group-hover:text-violet-500 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
                {filteredWorkloads.map((workload) => {
                  const isLoading =
                    executiveSummaryRequestsByKey?.[`workload:${workload.workloadId}`]?.status ===
                    'loading';
                  return (
                    <button
                      key={workload.workloadId}
                      type="button"
                      disabled={disabled || isLoading}
                      onClick={() => onViewExecutiveSummary?.('workload', workload.workloadId)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition disabled:opacity-50 group"
                    >
                      <Layers className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-700 truncate">{workload.workloadName || workload.workloadId}</div>
                        <div className="text-[10px] text-slate-400">Workload</div>
                      </div>
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 text-primary-500 animate-spin flex-shrink-0" />
                      ) : (
                        <Plus className="h-4 w-4 text-slate-300 group-hover:text-violet-500 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-8 text-xs text-slate-400 text-center">{searchQuery ? 'No matches' : config.emptyText}</div>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-3">
      {/* Full width: Do Now - Suggestion Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <h4 className="text-sm font-semibold text-slate-700" />
          </div>
          {!isLoading && suggestionCards.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onRefreshSuggestions?.()}
                disabled={disabled || isLoadingMore || isRefreshingSuggestions}
                title="Refresh suggestions"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
              >
                {isRefreshingSuggestions ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </button>
              {hasMoreSuggestions && (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={disabled || isLoadingMore || isRefreshingSuggestions}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:text-primary-700 transition disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  More suggestions
                </button>
              )}
            </div>
          )}
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading suggestions...</span>
          </div>
        ) : suggestionCards.length > 0 ? (
          <div>
            <div className="space-y-2.5">
              {currentPageCards.map((card) => {
                const environmentPreview = compactListPreview(card.applicableScope?.environments, 2);
                const workloadPreview = compactListPreview(card.applicableScope?.workloads, 2);
                const categoryStyle = getCategoryStyle(card.title);
                const IconComponent = categoryStyle.icon;
                const rawHeader = card.whatFor || card.title;
                const mainHeader = String(rawHeader || '').replace(/\.\s*$/, '').trim() || String(rawHeader || '');
                const secondaryLine = card.summary || card.whyNow || null;
                const categoryLabel = card.title;
                const recommendationCount = card.sourceIds?.length || card.recommendationIds?.length || 0;

                return (
                  <button
                    key={card.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      analytics.track(ANALYTICS_EVENTS.COMMAND_CENTER_SUGGESTION_CARD_CLICKED, {
                        route: getAnalyticsRoute(),
                        card_id: card.id || null,
                        card_title: card.title || card.whatFor || null,
                      });
                      if (card.cta) onCardAction?.(card.cta);
                    }}
                    className="group w-full flex flex-col rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-all hover:border-primary-300 hover:shadow-md hover:bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900 leading-snug flex-1">
                        {mainHeader}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {recommendationCount > 0 && (
                          <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-primary-100 px-1.5 text-[10px] font-semibold text-primary-700">
                            {recommendationCount}
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primary-500 transition-colors" />
                      </div>
                    </div>

                    {secondaryLine ? (
                      <p className="mt-1 text-xs leading-5 text-slate-500 line-clamp-3">{secondaryLine}</p>
                    ) : null}

                    <div className="mt-auto pt-2 flex items-end justify-between gap-2">
                      <div className="flex flex-wrap gap-1 text-[11px]">
                        {environmentPreview && (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                            <Cloud className="h-3 w-3" />
                            {environmentPreview}
                          </span>
                        )}
                        {workloadPreview && (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                            <Layers className="h-3 w-3" />
                            {workloadPreview}
                          </span>
                        )}
                      </div>

                      <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 flex-shrink-0 ${categoryStyle.bgColor}`}>
                        <IconComponent className={`h-3 w-3 ${categoryStyle.iconColor}`} />
                        <span className={`text-[11px] font-semibold uppercase tracking-wide ${categoryStyle.iconColor}`}>
                          {categoryLabel}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Carousel controls: dots + load more (bottom) */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-3">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCarouselPage(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === carouselPage
                        ? 'w-5 bg-primary-500'
                        : 'w-2 bg-slate-300 hover:bg-slate-400'
                    }`}
                    aria-label={`Page ${i + 1}`}
                  />
                ))}
                <span className="ml-1.5 text-[10px] text-slate-400">
                  {carouselPage + 1}/{totalPages}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center">
            <div className="text-xs font-medium text-slate-600">
              No recommendations available
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Run reports to get more insights on what to do next
            </div>
            <div className="mt-3">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setDrilldownView(reportsToRun.length > 0 ? 'suggested-reports' : 'reports')}
                className="inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 transition hover:bg-teal-100 disabled:opacity-50"
              >
                <Play className="h-3 w-3" />
                Run Reports
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EnvironmentTodayBrief({
  briefing = null,
  recommendations = [],
  suggestionCards = [],
  reportsToRun = [],
  availableReports = [],
  availableWorkloads = [],
  availableEnvironments = [],
  healthCheckEnvironments = [],
  costAnalysisEnvironments = [],
  workloadHealthById = {},
  environmentHealthById = {},
  loadingEnvironmentHealthIds = new Set(),
  loadingWorkloadHealthIds = new Set(),
  environmentCostById = {},
  loadingEnvironmentCostIds = new Set(),
  workflowRuns = [],
  agentRuns = [],
  reportRuns = [],
  onCardAction,
  onAddReport,
  onRunHealthCheck,
  onRefreshHealthCheck,
  onOpenHealthDrilldown,
  onRunSuggestedReport,
  onViewExecutiveSummary,
  onLoadMore,
  onRefreshSuggestions,
  onSkipToChat,
  hasMoreSuggestions = false,
  isLoading = false,
  isRefreshingSuggestions = false,
  formatDate,
  loadingReportKey = null,
  executiveSummaryRequestsByKey = {},
  enableHealthContext = true,
  enableCostContext = true,
  disabled = false,
}) {
  const navigate = useNavigate();

  const workloadSummary = useMemo(() => {
    if (!enableHealthContext) {
      return {
        total: 0,
        healthy: 0,
        attention: 0,
        unhealthyWorkloads: 0,
        issueCountTotal: 0,
        healthyResourceTotal: 0,
        evaluatedResourceTotal: 0,
        stale: 0,
        notChecked: 0,
        attentionItems: [],
        staleItems: [],
      };
    }
    const items = (availableWorkloads || [])
      .filter((workload) => !String(workload?.workloadName || workload?.workloadId || '').startsWith('PermissionProfile-'))
      .map((workload) => {
        const workloadId = String(workload?.workloadId || '').trim();
        const insight = workloadHealthById?.[workloadId] || null;
        const stats = insight?.stats || {};
        const lastCheckedAt = stats?.latestGeneratedAt || null;
        const isStale = lastCheckedAt ? !isFreshTimestamp(lastCheckedAt, DEFAULT_HEALTH_MAX_AGE_HOURS) : true;
        const issueCount = Number(stats?.issues || 0);
        const evaluated = Number(stats?.evaluated || 0);
        const healthyResources = Number(stats?.healthy || 0);
        return {
          id: workloadId,
          name: workload?.workloadName || workloadId || 'Workload',
          issueCount,
          evaluated,
          healthyResources,
          lastCheckedAt,
          isStale,
          isHealthy: evaluated > 0 && issueCount === 0 && !isStale,
          hasAttention: issueCount > 0,
        };
      })
      .filter((item) => item.id);

    return {
      total: items.length,
      healthy: items.filter((item) => item.isHealthy).length,
      attention: items.filter((item) => item.hasAttention).length,
      unhealthyWorkloads: items.filter((item) => item.hasAttention).length,
      issueCountTotal: items.reduce((sum, item) => sum + (item.issueCount || 0), 0),
      healthyResourceTotal: items.reduce((sum, item) => sum + (item.healthyResources || 0), 0),
      evaluatedResourceTotal: items.reduce((sum, item) => sum + (item.evaluated || 0), 0),
      stale: items.filter((item) => item.isStale).length,
      notChecked: items.filter((item) => !item.lastCheckedAt).length,
      attentionItems: items
        .filter((item) => item.hasAttention)
        .sort((a, b) => {
          if ((b.issueCount || 0) !== (a.issueCount || 0)) {
            return (b.issueCount || 0) - (a.issueCount || 0);
          }
          const dateA = Date.parse(a.lastCheckedAt || '') || 0;
          const dateB = Date.parse(b.lastCheckedAt || '') || 0;
          return dateA - dateB;
        })
        .slice(0, 3),
      staleItems: items
        .filter((item) => item.isStale)
        .sort((a, b) => {
          const dateA = Date.parse(a.lastCheckedAt || '') || 0;
          const dateB = Date.parse(b.lastCheckedAt || '') || 0;
          return dateA - dateB;
        })
        .slice(0, 3),
    };
  }, [availableWorkloads, enableHealthContext, workloadHealthById]);

  const environmentSummary = useMemo(() => {
    if (!enableHealthContext) {
      return {
        total: 0,
        healthy: 0,
        attention: 0,
        issueCountTotal: 0,
        healthyResourceTotal: 0,
        evaluatedResourceTotal: 0,
        stale: 0,
        notChecked: 0,
        attentionItems: [],
        staleItems: [],
      };
    }
    const items = (healthCheckEnvironments || []).map((environment) => {
      const environmentId = String(environment?.recordId || '').trim();
      const insight = environmentHealthById?.[environmentId] || null;
      const stats = insight?.stats || {};
      const lastCheckedAt = insight?.findings?.generatedAt || stats?.latestGeneratedAt || null;
      const isStale = lastCheckedAt ? !isFreshTimestamp(lastCheckedAt, DEFAULT_HEALTH_MAX_AGE_HOURS) : true;
      const issueCount = Number(stats?.issues || 0);
      const evaluated = Number(stats?.evaluated || 0);
      const healthyResources = Number(stats?.healthy || 0);
      return {
        id: environmentId,
        name: environment?.name || environmentId || 'Environment',
        issueCount,
        evaluated,
        healthyResources,
        lastCheckedAt,
        isStale,
        isHealthy: evaluated > 0 && issueCount === 0 && !isStale,
        hasAttention: issueCount > 0,
      };
    }).filter((item) => item.id);

    return {
      total: items.length,
      healthy: items.filter((item) => item.isHealthy).length,
      attention: items.filter((item) => item.hasAttention).length,
      issueCountTotal: items.reduce((sum, item) => sum + (item.issueCount || 0), 0),
      healthyResourceTotal: items.reduce((sum, item) => sum + (item.healthyResources || 0), 0),
      evaluatedResourceTotal: items.reduce((sum, item) => sum + (item.evaluated || 0), 0),
      stale: items.filter((item) => item.isStale).length,
      notChecked: items.filter((item) => !item.lastCheckedAt).length,
      attentionItems: items
        .filter((item) => item.hasAttention)
        .sort((a, b) => {
          if ((b.issueCount || 0) !== (a.issueCount || 0)) {
            return (b.issueCount || 0) - (a.issueCount || 0);
          }
          const dateA = Date.parse(a.lastCheckedAt || '') || 0;
          const dateB = Date.parse(b.lastCheckedAt || '') || 0;
          return dateA - dateB;
        })
        .slice(0, 3),
      staleItems: items
        .filter((item) => item.isStale)
        .sort((a, b) => {
          const dateA = Date.parse(a.lastCheckedAt || '') || 0;
          const dateB = Date.parse(b.lastCheckedAt || '') || 0;
          return dateA - dateB;
        })
        .slice(0, 3),
    };
  }, [enableHealthContext, environmentHealthById, healthCheckEnvironments]);

  const spendSummary = useMemo(
    () => (enableCostContext
      ? buildSpendSummary(costAnalysisEnvironments, environmentCostById)
      : buildSpendSummary([], {})),
    [costAnalysisEnvironments, enableCostContext, environmentCostById]
  );

  const threatSnapshot = useMemo(
    () => (enableCostContext ? buildThreatSnapshot(costAnalysisEnvironments) : buildThreatSnapshot([])),
    [costAnalysisEnvironments, enableCostContext]
  );

  const recentActivityItems = useMemo(
    () => buildRecentActivityItems({
      workflows: workflowRuns,
      agents: agentRuns,
      reports: reportRuns,
    }),
    [agentRuns, reportRuns, workflowRuns]
  );

  const workloadRecommendationSummary = useMemo(
    () => buildScopedRecommendationSummary(recommendations, 'workload'),
    [recommendations]
  );
  const environmentRecommendationSummary = useMemo(
    () => buildScopedRecommendationSummary(recommendations, 'environment'),
    [recommendations]
  );

  const loadingEnvironmentHealthSet = useMemo(() => (
    loadingEnvironmentHealthIds instanceof Set
      ? loadingEnvironmentHealthIds
      : new Set(Array.isArray(loadingEnvironmentHealthIds) ? loadingEnvironmentHealthIds : [])
  ), [loadingEnvironmentHealthIds]);
  const loadingWorkloadHealthSet = useMemo(() => (
    loadingWorkloadHealthIds instanceof Set
      ? loadingWorkloadHealthIds
      : new Set(Array.isArray(loadingWorkloadHealthIds) ? loadingWorkloadHealthIds : [])
  ), [loadingWorkloadHealthIds]);

  const loadingEnvironmentCostSet = useMemo(() => (
    loadingEnvironmentCostIds instanceof Set
      ? loadingEnvironmentCostIds
      : new Set(Array.isArray(loadingEnvironmentCostIds) ? loadingEnvironmentCostIds : [])
  ), [loadingEnvironmentCostIds]);

  const healthSummary = useMemo(() => {
    const issueCountTotal = workloadSummary.issueCountTotal + environmentSummary.issueCountTotal;
    const attentionCount = workloadSummary.attention + environmentSummary.attention;
    const staleCount = workloadSummary.stale + environmentSummary.stale;
    const totalCount = workloadSummary.total + environmentSummary.total;
    const healthyResourceTotal = workloadSummary.healthyResourceTotal + environmentSummary.healthyResourceTotal;
    const evaluatedResourceTotal = workloadSummary.evaluatedResourceTotal + environmentSummary.evaluatedResourceTotal;
    const healthyResourcePercentage = evaluatedResourceTotal > 0
      ? Math.round((healthyResourceTotal / evaluatedResourceTotal) * 100)
      : null;

    return {
      totalCount,
      attentionCount,
      staleCount,
      issueCountTotal,
      unhealthyWorkloads: workloadSummary.unhealthyWorkloads,
      healthyResourceTotal,
      evaluatedResourceTotal,
      healthyResourcePercentage,
      recommendationTotal: workloadRecommendationSummary.total + environmentRecommendationSummary.total,
      recommendationCounts: {
        Critical: (workloadRecommendationSummary.counts.Critical || 0) + (environmentRecommendationSummary.counts.Critical || 0),
        High: (workloadRecommendationSummary.counts.High || 0) + (environmentRecommendationSummary.counts.High || 0),
      },
      highlights: [
        ...(workloadSummary.attentionItems || []).map((item) => ({ ...item, scopeLabel: 'Workload', reviewType: 'workload' })),
        ...(environmentSummary.attentionItems || []).map((item) => ({ ...item, scopeLabel: 'Environment', reviewType: 'environment' })),
      ]
        .sort((a, b) => {
          if ((b.issueCount || 0) !== (a.issueCount || 0)) {
            return (b.issueCount || 0) - (a.issueCount || 0);
          }
          const dateA = Date.parse(a.lastCheckedAt || '') || 0;
          const dateB = Date.parse(b.lastCheckedAt || '') || 0;
          return dateA - dateB;
        })
        .slice(0, 4),
      staleItems: [
        ...(workloadSummary.staleItems || []).map((item) => ({ ...item, scopeLabel: 'Workload', reviewType: 'workload' })),
        ...(environmentSummary.staleItems || []).map((item) => ({ ...item, scopeLabel: 'Environment', reviewType: 'environment' })),
      ]
        .sort((a, b) => {
          const dateA = Date.parse(a.lastCheckedAt || '') || 0;
          const dateB = Date.parse(b.lastCheckedAt || '') || 0;
          return dateA - dateB;
        })
        .slice(0, 4),
    };
  }, [
    environmentRecommendationSummary,
    environmentSummary,
    workloadRecommendationSummary,
    workloadSummary,
  ]);

  const recentActivitySummary = useMemo(() => {
    const byOutcome = { completed: 0, failed: 0 };
    const byType = { workflow: 0, agent: 0, report: 0 };
    recentActivityItems.forEach((item) => {
      if (item.outcome === 'completed') byOutcome.completed += 1;
      else if (item.outcome === 'failed') byOutcome.failed += 1;
      if (item.type === 'workflow') byType.workflow += 1;
      else if (item.type === 'agent') byType.agent += 1;
      else if (item.type === 'report') byType.report += 1;
    });
    return {
      total: recentActivityItems.length,
      ...byOutcome,
      ...byType,
      latestUpdatedAt: recentActivityItems[0]?.updatedAt || null,
    };
  }, [recentActivityItems]);
  const briefingSentence = useMemo(() => {
    return typeof briefing?.sentence === 'string' ? briefing.sentence.trim() : '';
  }, [briefing?.sentence]);
  const hasBackendBriefing = briefing?.source === 'llm' && Boolean(briefingSentence);
  const [expandedOverviewPanel, setExpandedOverviewPanel] = useState(null);
  const [showReportsToRunInActivity, setShowReportsToRunInActivity] = useState(false);

  const handleRefreshItem = useCallback((type, id) => {
    if (!id) return;
    onRefreshHealthCheck?.({
      type,
      id,
      reviewKind: 'health',
    });
  }, [onRefreshHealthCheck]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-600">
            <Bot className="h-3.5 w-3.5" />
            Here&apos;s your environment today
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={onSkipToChat}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary-300 bg-white px-3.5 py-1.5 text-xs font-medium text-primary-700 shadow-sm transition hover:bg-primary-50 hover:shadow disabled:opacity-50"
          >
            Skip to chat
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className={`mt-3 grid grid-cols-1 gap-2 ${enableHealthContext && enableCostContext ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {enableHealthContext ? (
          <button
            type="button"
            onClick={() => {
              analytics.track(ANALYTICS_EVENTS.COMMAND_CENTER_SUMMARY_CARD_CLICKED, {
                route: getAnalyticsRoute(),
                card_name: 'health',
              });
              setExpandedOverviewPanel((prev) => (prev === 'health' ? null : 'health'));
            }}
            className={`rounded-lg border bg-white p-3 text-left transition hover:shadow-sm ${
              expandedOverviewPanel === 'health' ? 'ring-2 ring-primary-200 border-emerald-300' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-semibold text-slate-700">Health</span>
              {expandedOverviewPanel === 'health' ? (
                <ChevronDown className="ml-auto h-3.5 w-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="ml-auto h-3.5 w-3.5 text-slate-300" />
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <div
                  className={`text-xl font-bold ${
                    workloadSummary.total > 0 && workloadSummary.healthy === workloadSummary.total
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                  }`}
                >
                  {workloadSummary.total > 0 ? `${workloadSummary.healthy}/${workloadSummary.total}` : '--'}
                </div>
                <div className="text-[10px] text-slate-500">
                  {workloadSummary.total === 1 ? 'workload healthy' : 'workloads healthy'}
                </div>
              </div>
              <div className="min-w-0 border-l border-slate-200 pl-3">
                <div className="text-xl font-bold text-slate-700">
                  {healthSummary.healthyResourcePercentage !== null ? `${healthSummary.healthyResourcePercentage}%` : '--'}
                </div>
                <div className="text-[10px] text-slate-500">resources healthy</div>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {healthSummary.issueCountTotal > 0 && (
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
                  {healthSummary.issueCountTotal} issues flagged
                </span>
              )}
              {healthSummary.staleCount > 0 && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
                  {healthSummary.staleCount} stale
                </span>
              )}
            </div>
          </button>
          ) : null}

          {enableCostContext ? (
          <button
            type="button"
            onClick={() => {
              analytics.track(ANALYTICS_EVENTS.COMMAND_CENTER_SUMMARY_CARD_CLICKED, {
                route: getAnalyticsRoute(),
                card_name: 'spend',
              });
              setExpandedOverviewPanel((prev) => (prev === 'spend' ? null : 'spend'));
            }}
            className={`rounded-lg border bg-white p-3 text-left transition hover:shadow-sm ${
              expandedOverviewPanel === 'spend' ? 'ring-2 ring-primary-200 border-violet-300' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-violet-600" />
              <span className="text-xs font-semibold text-slate-700">Spend &amp; Threat</span>
              {expandedOverviewPanel === 'spend' ? (
                <ChevronDown className="ml-auto h-3.5 w-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="ml-auto h-3.5 w-3.5 text-slate-300" />
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <div className="text-xl font-bold text-slate-800">
                  {formatCurrencyCompact(spendSummary.totalSpend)}
                </div>
                <div className="text-[10px] text-slate-500">{spendSummary.periodLabel}</div>
              </div>
              <div className="min-w-0 border-l border-slate-200 pl-3">
                <div className={`text-xl font-bold ${
                  threatSnapshot.criticalHighCount > 0
                    ? 'text-rose-600'
                    : threatSnapshot.totalFindings > 0
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                }`}>
                  {threatSnapshot.environmentsWithData > 0 ? threatSnapshot.totalFindings : '--'}
                </div>
                <div className="text-[10px] text-slate-500">threat findings</div>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {spendSummary.environmentCountWithData > 0 ? (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                  {spendSummary.environmentCountWithData} cost environments
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">No cost data yet</span>
              )}
              {threatSnapshot.environmentsWithData > 0 && (
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                  threatSnapshot.criticalHighCount > 0
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {threatSnapshot.criticalHighCount > 0
                    ? `${threatSnapshot.criticalHighCount} critical/high`
                    : 'No critical/high'}
                </span>
              )}
              {spendSummary.generatedAt && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">
                  {formatRelativeAge(spendSummary.generatedAt)}
                </span>
              )}
            </div>
          </button>
          ) : null}

          <button
            type="button"
            onClick={() => {
              analytics.track(ANALYTICS_EVENTS.COMMAND_CENTER_SUMMARY_CARD_CLICKED, {
                route: getAnalyticsRoute(),
                card_name: 'activity',
              });
              setExpandedOverviewPanel((prev) => (prev === 'activity' ? null : 'activity'));
            }}
            className={`rounded-lg border bg-white p-3 text-left transition hover:shadow-sm ${
              expandedOverviewPanel === 'activity' ? 'ring-2 ring-primary-200 border-blue-300' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-semibold text-slate-700">Recent Work</span>
              {expandedOverviewPanel === 'activity' ? (
                <ChevronDown className="ml-auto h-3.5 w-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="ml-auto h-3.5 w-3.5 text-slate-300" />
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <div>
                <span className="text-sm font-semibold text-emerald-600">{recentActivitySummary.completed}</span>
                <span className="ml-1 text-[10px] text-slate-500">completed</span>
              </div>
              {recentActivitySummary.failed > 0 && (
                <>
                  <div className="text-[10px] text-slate-400">|</div>
                  <div>
                    <span className="text-sm font-semibold text-rose-600">{recentActivitySummary.failed}</span>
                    <span className="ml-1 text-[10px] text-slate-500">failed</span>
                  </div>
                </>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {recentActivitySummary.workflow > 0 && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                  {recentActivitySummary.workflow} workflows
                </span>
              )}
              {recentActivitySummary.report > 0 && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                  {recentActivitySummary.report} reports
                </span>
              )}
              {recentActivitySummary.agent > 0 && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                  {recentActivitySummary.agent} agents
                </span>
              )}
              {reportsToRun.length > 0 && (
                <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-medium text-teal-700">
                  {reportsToRun.length} recommended to run
                </span>
              )}
              {recentActivitySummary.total === 0 && (
                <span className="text-[10px] text-slate-400">No recent runs</span>
              )}
            </div>
          </button>
        </div>

        {hasBackendBriefing && (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {briefingSentence}
          </p>
        )}

        {expandedOverviewPanel ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            {enableHealthContext && expandedOverviewPanel === 'health' && (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Health details</div>
                    <div className="text-xs text-slate-500">Combined workload and environment health, with issue highlights and stale checks.</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() => navigate('/dashboard/workloads')}
                      className="h-7 px-2 text-[11px]"
                    >
                      Open workloads
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() => navigate('/dashboard/health')}
                      className="h-7 px-2 text-[11px]"
                    >
                      Open health dashboard
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Issue highlights</div>
                    {healthSummary.highlights.length > 0 ? healthSummary.highlights.map((item) => (
                      <button
                        key={`health-issue-${item.scopeLabel}-${item.id}`}
                        type="button"
                        onClick={() => navigate('/dashboard/health', {
                          state: {
                            scopeFilter: item.reviewType === 'workload'
                              ? `workload:${item.id}`
                              : `environment:${item.id}`,
                          },
                        })}
                        className="w-full rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-left transition hover:border-amber-300 hover:bg-amber-50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium text-slate-800">{item.name}</div>
                            <div className="mt-0.5 text-[10px] text-slate-500">
                              {item.scopeLabel} with {item.issueCount} {item.issueCount === 1 ? 'issue' : 'issues'}
                            </div>
                          </div>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            {item.issueCount} issues
                          </span>
                        </div>
                      </button>
                    )) : (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                        No active health issues right now.
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Needs refresh</div>
                    {healthSummary.staleItems.length > 0 ? healthSummary.staleItems.map((item) => (
                      <div key={`stale-health-${item.scopeLabel}-${item.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-rose-50/60 px-2.5 py-2">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-slate-800">{item.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {item.scopeLabel} {item.lastCheckedAt ? `checked ${formatRelativeAge(item.lastCheckedAt)}` : 'has not been checked yet'}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={disabled || (
                            item.reviewType === 'environment'
                              ? loadingEnvironmentHealthSet.has(item.id)
                              : loadingWorkloadHealthSet.has(item.id)
                          )}
                          onClick={() => handleRefreshItem(item.reviewType, item.id)}
                          className="h-7 px-2 text-[10px]"
                        >
                          {(item.reviewType === 'environment'
                            ? loadingEnvironmentHealthSet.has(item.id)
                            : loadingWorkloadHealthSet.has(item.id)) ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-1 h-3 w-3" />
                          )}
                          Refresh
                        </Button>
                      </div>
                    )) : (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                        No refreshes needed right now.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {expandedOverviewPanel === 'activity' && (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Recent work</div>
                    <div className="text-xs text-slate-500">Most recent completed and failed workflows, agents, and reports.</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {reportsToRun.length > 0 ? (
                      <Button
                        type="button"
                        variant={showReportsToRunInActivity ? 'default' : 'outline'}
                        size="sm"
                        disabled={disabled}
                        onClick={() => setShowReportsToRunInActivity((prev) => !prev)}
                        className="h-7 px-2 text-[11px]"
                      >
                        {reportsToRun.length} recommended to run
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() => navigate('/dashboard/workflow-history')}
                      className="h-7 px-2 text-[11px]"
                    >
                      Open history
                    </Button>
                  </div>
                </div>
                {recentActivityItems.length > 0 || reportsToRun.length > 0 ? (
                  <div className={`mt-3 grid grid-cols-1 gap-3 ${showReportsToRunInActivity && reportsToRun.length > 0 ? 'xl:grid-cols-2' : ''}`}>
                    <div className="space-y-2">
                      {recentActivityItems.length > 0 ? recentActivityItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => navigate(item.path)}
                          className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                            item.outcome === 'failed' ? 'bg-rose-100' : 'bg-slate-100'
                          }`}>
                            {item.type === 'workflow' ? (
                              <Zap className={`h-4 w-4 ${item.outcome === 'failed' ? 'text-rose-600' : 'text-slate-600'}`} />
                            ) : item.type === 'agent' ? (
                              <Bot className={`h-4 w-4 ${item.outcome === 'failed' ? 'text-rose-600' : 'text-slate-600'}`} />
                            ) : (
                              <FileBarChart className={`h-4 w-4 ${item.outcome === 'failed' ? 'text-rose-600' : 'text-slate-600'}`} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium text-slate-800">{item.title}</div>
                            <div className="mt-0.5 text-[10px] text-slate-500">
                              {item.type.charAt(0).toUpperCase() + item.type.slice(1)} {item.outcome} {formatRelativeAge(item.updatedAt)}
                            </div>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            item.outcome === 'failed' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {item.outcome === 'failed' ? 'Failed' : 'Completed'}
                          </span>
                        </button>
                      )) : (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-xs text-slate-500">
                          No recent run activity yet.
                        </div>
                      )}
                    </div>

                    {showReportsToRunInActivity && reportsToRun.length > 0 ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <Play className="h-4 w-4 text-teal-500" />
                          <div className="text-xs font-semibold text-slate-700">Reports to run</div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={disabled}
                            onClick={() => navigate('/dashboard')}
                            className="ml-auto h-7 px-2 text-[11px]"
                          >
                            Open CloudAgent
                          </Button>
                        </div>
                        <div className="space-y-1.5">
                          {reportsToRun.map((report) => (
                            <div
                              key={report.id}
                              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                            >
                              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 flex-shrink-0">
                                <FileBarChart className="h-3.5 w-3.5 text-teal-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-slate-700 truncate">{report.title}</div>
                                {report.environmentName ? (
                                  <div className="text-[10px] text-slate-400 truncate">{report.environmentName}</div>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => onRunSuggestedReport?.(report)}
                                className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-[10px] font-medium text-teal-700 hover:bg-teal-100 transition whitespace-nowrap disabled:opacity-50"
                              >
                                <Play className="h-3 w-3" />
                                Run
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-xs text-slate-500">
                    No recent run activity yet.
                  </div>
                )}
              </div>
            )}

            {enableCostContext && expandedOverviewPanel === 'spend' && (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Spend and threat details</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Top environments by spend, plus a compact threat snapshot from stored scanner summaries.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() => navigate('/dashboard/cost')}
                      className="h-7 px-2 text-[11px]"
                    >
                      Open cost dashboard
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() => navigate('/dashboard/threat')}
                      className="h-7 px-2 text-[11px]"
                    >
                      Open threat dashboard
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Top spend
                    </div>
                    {spendSummary.rows.length > 0 ? spendSummary.rows.slice(0, 5).map((row) => (
                      <div key={row.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-slate-800">{row.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {row.generatedAt ? `Updated ${formatRelativeAge(row.generatedAt)}` : 'Cost data available'}
                            {row.source === 'summary' ? ' from summary' : ''}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-slate-900">{formatCurrencyCompact(row.totalSpend)}</div>
                      </div>
                    )) : (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                        {loadingEnvironmentCostSet.size > 0 ? 'Loading cost analyses...' : 'Cost data will appear here once analyses are available.'}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Threat snapshot
                    </div>
                    {threatSnapshot.environmentsWithData > 0 ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-rose-50/70 px-3 py-2">
                            <div className="text-lg font-semibold text-rose-700">
                              {threatSnapshot.criticalHighCount}
                            </div>
                            <div className="text-[10px] text-rose-700/80">critical/high findings</div>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-3 py-2">
                            <div className="text-lg font-semibold text-slate-800">
                              {threatSnapshot.publicFindings}
                            </div>
                            <div className="text-[10px] text-slate-500">public access findings</div>
                          </div>
                        </div>
                        {threatSnapshot.rows.slice(0, 3).map((row) => (
                          <div key={`threat-summary-${row.id}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                            <div className="min-w-0">
                              <div className="truncate text-xs font-medium text-slate-800">{row.name}</div>
                              <div className="text-[10px] text-slate-500">
                                {row.generatedAt ? `Updated ${formatRelativeAge(row.generatedAt)}` : 'Threat summary available'}
                              </div>
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              row.criticalHighCount > 0
                                ? 'bg-rose-50 text-rose-700'
                                : row.totalFindings > 0
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {row.totalFindings} findings
                            </span>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                        Threat summary data will appear here once scans are available.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        ) : null}
      </div>

    </div>
  );
}

// Session Starter - shown at the beginning of a chat session to help user pick their path
function SessionStarter({
  briefing = null,
  recommendations = [],
  suggestionCards = [],
  reportsToRun = [],
  isSuggestionsLoading = false,
  availableEnvironments = [],
  availableWorkloads = [],
  healthCheckEnvironments = [],
  costAnalysisEnvironments = [],
  workloadHealthById = {},
  environmentHealthById = {},
  loadingEnvironmentHealthIds = new Set(),
  loadingWorkloadHealthIds = new Set(),
  environmentCostById = {},
  loadingEnvironmentCostIds = new Set(),
  workflowRuns = [],
  agentRuns = [],
  reportRuns = [],
  availableReports = [],
  loadingReportKey = null,
  executiveSummaryRequestsByKey = {},
  activeScope = {},
  onAddEnvironment,
  onAddWorkload,
  onAddReport,
  onCreateWorkload,
  onRunHealthCheck,
  onRefreshHealthCheck,
  onOpenHealthDrilldown,
  onRunSuggestedReport,
  onViewExecutiveSummary,
  onCardAction,
  onLoadMoreSuggestions,
  onRefreshSuggestions,
  onSkipToChat,
  hasMoreSuggestions = false,
  isRefreshingSuggestions = false,
  enableHealthContext = true,
  enableCostContext = true,
  disabled = false,
}) {
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const scopedReportIds = new Set(
    (activeScope.reports || [])
      .flatMap((report) => [report.id, report.scanId, report.reportId])
      .filter(Boolean)
  );
  const unscopedReports = availableReports
    .filter(r => !scopedReportIds.has(r.scanId || r.reportId || r.id))
    .sort((a, b) => new Date(b.updatedAt || b.lastUpdateTime || b.latestAssessmentDate || 0) - new Date(a.updatedAt || a.lastUpdateTime || a.latestAssessmentDate || 0));

  const totalRecommendationCount = suggestionCards.reduce((sum, card) => {
    return sum + (card.sourceIds?.length || card.recommendationIds?.length || 0);
  }, 0);
  return (
    <EnvironmentTodayBrief
      briefing={briefing}
      recommendations={recommendations}
      suggestionCards={suggestionCards}
      reportsToRun={reportsToRun}
      availableReports={unscopedReports}
      availableWorkloads={availableWorkloads}
      availableEnvironments={availableEnvironments}
      healthCheckEnvironments={healthCheckEnvironments}
      costAnalysisEnvironments={costAnalysisEnvironments}
      workloadHealthById={workloadHealthById}
      environmentHealthById={environmentHealthById}
      loadingEnvironmentHealthIds={loadingEnvironmentHealthIds}
      loadingWorkloadHealthIds={loadingWorkloadHealthIds}
      environmentCostById={environmentCostById}
      loadingEnvironmentCostIds={loadingEnvironmentCostIds}
      workflowRuns={workflowRuns}
      agentRuns={agentRuns}
      reportRuns={reportRuns}
      onCardAction={onCardAction}
      onAddReport={onAddReport}
      onRunHealthCheck={onRunHealthCheck}
      onRefreshHealthCheck={onRefreshHealthCheck}
      onOpenHealthDrilldown={onOpenHealthDrilldown}
      onRunSuggestedReport={onRunSuggestedReport}
      onViewExecutiveSummary={onViewExecutiveSummary}
      onLoadMore={onLoadMoreSuggestions}
      onRefreshSuggestions={onRefreshSuggestions}
      onSkipToChat={onSkipToChat}
      hasMoreSuggestions={hasMoreSuggestions}
      isLoading={isSuggestionsLoading}
      isRefreshingSuggestions={isRefreshingSuggestions}
      formatDate={formatDate}
      loadingReportKey={loadingReportKey}
      executiveSummaryRequestsByKey={executiveSummaryRequestsByKey}
      enableHealthContext={enableHealthContext}
      enableCostContext={enableCostContext}
      disabled={disabled}
    />
  );
}

function CommandCenterEmbeddedReportPreview({ report, compact = false }) {
  const embeddedPayload = useMemo(() => extractEmbeddedReportPayload(report), [report]);
  const heuristicRendererType = useMemo(
    () => resolveEmbeddedReportRenderer(report, embeddedPayload),
    [embeddedPayload, report]
  );
  const [resolvedRendererType, setResolvedRendererType] = useState(heuristicRendererType);
  const hasExplicitEmbeddedResults = useMemo(() => {
    const summaryCandidate = embeddedPayload?.summaryResults;
    const complianceCandidate = embeddedPayload?.complianceResults;
    const hasSummaryShape = isSummaryResultsShape(summaryCandidate) || isSummaryResultsShape(complianceCandidate);
    const hasComplianceShape = !!complianceCandidate
      && typeof complianceCandidate === 'object'
      && !Array.isArray(complianceCandidate)
      && Array.isArray(complianceCandidate.results)
      && complianceCandidate.controls
      && typeof complianceCandidate.controls === 'object';
    return hasSummaryShape || hasComplianceShape;
  }, [embeddedPayload?.complianceResults, embeddedPayload?.summaryResults]);

  useEffect(() => {
    setResolvedRendererType(heuristicRendererType);
  }, [heuristicRendererType]);

  useEffect(() => {
    if (hasExplicitEmbeddedResults) return;
    let cancelled = false;

    const resolveRendererFromDefinition = async () => {
      const rawReportId = report?.reportDefinitionId
        || embeddedPayload?.reportDefinitionId
        || report?.reportId
        || embeddedPayload?.reportId
        || null;
      if (!rawReportId) return;

      const normalizedIds = [...new Set([
        String(rawReportId || '').trim(),
        String(rawReportId || '').trim().replace(/^report_/, ''),
      ].filter(Boolean))];

      for (const candidateId of normalizedIds) {
        try {
          const response = await fetch(`https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/reports/${candidateId}.json`);
          if (!response.ok) continue;
          const definition = await response.json();
          const hasComplianceDefinition = (
            definition?.controls
            && typeof definition.controls === 'object'
            && Object.keys(definition.controls).length > 0
          ) || (Array.isArray(definition?.tags) && definition.tags.length > 0);
          if (hasComplianceDefinition) {
            if (!cancelled) setResolvedRendererType('compliance');
            return;
          }
          const hasSummaryDefinition = definition?.rules
            && typeof definition.rules === 'object'
            && Object.keys(definition.rules).length > 0;
          if (hasSummaryDefinition) {
            if (!cancelled) setResolvedRendererType('summary');
            return;
          }
        } catch {
          // no-op, try next candidate
        }
      }
    };

    resolveRendererFromDefinition();
    return () => {
      cancelled = true;
    };
  }, [
    embeddedPayload?.reportDefinitionId,
    embeddedPayload?.reportId,
    hasExplicitEmbeddedResults,
    report?.reportDefinitionId,
    report?.reportId,
  ]);

  const rendererType = resolvedRendererType;
  const fallbackEmbeddedInput = useMemo(() => ({
    reportId: report?.reportId || embeddedPayload?.reportId || null,
    reportDefinitionId: report?.reportDefinitionId || embeddedPayload?.reportDefinitionId || null,
    reportPlanId: report?.reportPlanId || embeddedPayload?.reportPlanId || null,
    scanId: report?.scanId || embeddedPayload?.scanId || null,
    assessmentResultsUrl: report?.assessmentResultsUrl || embeddedPayload?.assessmentResultsUrl || null,
    title: report?.title || report?.name || null,
  }), [
    embeddedPayload?.assessmentResultsUrl,
    embeddedPayload?.reportDefinitionId,
    embeddedPayload?.reportId,
    embeddedPayload?.reportPlanId,
    embeddedPayload?.scanId,
    report?.assessmentResultsUrl,
    report?.name,
    report?.reportDefinitionId,
    report?.reportId,
    report?.reportPlanId,
    report?.scanId,
    report?.title,
  ]);

  const summaryData = useMemo(() => {
    const explicitSummary = embeddedPayload.summaryResults;
    if (isSummaryResultsShape(explicitSummary)) return explicitSummary;
    if (isSummaryResultsShape(embeddedPayload.complianceResults)) return embeddedPayload.complianceResults;
    return {};
  }, [embeddedPayload.complianceResults, embeddedPayload.summaryResults]);

  const complianceData = useMemo(() => {
    const candidate = embeddedPayload.complianceResults;
    const hasStructuredData = !!candidate
      && typeof candidate === 'object'
      && Array.isArray(candidate.results)
      && candidate.controls
      && typeof candidate.controls === 'object';
    return hasStructuredData ? candidate : {};
  }, [embeddedPayload.complianceResults]);

  const hasSummaryData = Object.keys(summaryData || {}).length > 0;
  const hasComplianceData = Array.isArray(complianceData?.results) && complianceData.results.length > 0;
  return (
    <div className="space-y-2">
      {embeddedPayload.summaryText ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {embeddedPayload.summaryText}
        </div>
      ) : (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Report previews are not available in the desktop app.
        </div>
      )}
    </div>
  );
}

function CommandCenterEmbeddedExecutiveSummary({ summary, item, type = 'environment', compact = false }) {
  const Icon = type === 'workload' ? Layers : Cloud;
  const itemName = type === 'workload' ? (item?.workloadName || item?.name) : (item?.name || item?.recordId);
  const typeLabel = type === 'workload' ? 'Workload' : 'Environment';

  if (!summary?.summaryText) {
    return (
      <div className={`flex flex-col items-center justify-center text-gray-500 ${compact ? 'py-4' : 'py-8'}`}>
        <FileText className={`mb-2 text-gray-400 ${compact ? 'w-6 h-6' : 'w-8 h-8'}`} />
        <p className={`font-medium ${compact ? 'text-xs' : 'text-sm'}`}>No executive summary available</p>
        <p className={`mt-1 text-center ${compact ? 'text-[10px]' : 'text-xs'}`}>
          An executive summary has not been generated for this {typeLabel.toLowerCase()} yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!compact && (
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
          <Icon className="w-3.5 h-3.5 text-primary-600" />
          <span className="font-medium">{itemName}</span>
          <span className="text-slate-400">({typeLabel})</span>
        </div>
      )}
      <ExecutiveSummaryContent
        summary={summary}
        compact={compact}
        item={item}
        type={type}
      />
    </div>
  );
}

function renderBlock(block, onAction, disabled, onShowResources, recommendationLookup) {
  if (!block?.type) return null;

  switch (block.type) {
    case 'start_brief':
      return <StartBriefBlock block={block} onAction={onAction} disabled={disabled} />;
    case 'recommendations_list':
      return <RecommendationsBlock block={block} onAction={onAction} disabled={disabled} />;
    case 'approval_card':
      return <ApprovalCardBlock block={block} onAction={onAction} disabled={disabled} />;
    case 'run_status':
      return <RunStatusBlock block={block} onAction={onAction} disabled={disabled} />;
    case 'workload_resources_preview':
      return <WorkloadResourcesPreviewBlock block={block} onAction={onAction} disabled={disabled} />;
    case 'artifact_card':
      return <ArtifactCardBlock block={block} onAction={onAction} disabled={disabled} />;
    case 'cloudformation_operation_card':
      return <CloudFormationOperationCardBlock block={block} onAction={onAction} disabled={disabled} />;
    case 'waiting_inputs_list':
      return <WaitingInputsListBlock block={block} onAction={onAction} disabled={disabled} />;
    case 'recommendation_workbench':
      return <RecommendationWorkbenchBlock block={block} onAction={onAction} onShowResources={onShowResources} disabled={disabled} />;
    case 'recommendation_refs': {
      const mapped = buildRecommendationRefsWorkbenchBlock(block, recommendationLookup);
      return <RecommendationWorkbenchBlock block={mapped} onAction={onAction} onShowResources={onShowResources} disabled={disabled} />;
    }
    case 'waiting_run_detail':
      return <WaitingRunDetailBlock block={block} onAction={onAction} disabled={disabled} />;
    case 'guardrail_result':
      return <GuardrailBlock block={block} onAction={onAction} disabled={disabled} />;
    case 'run_plan':
      return <RunPlanBlock block={block} onAction={onAction} disabled={disabled} />;
    default:
      return <GenericObjectBlock block={block} onAction={onAction} disabled={disabled} />;
  }
}

function ScopeChipGroup({ label, items, max, emptyText, onRemove, removeType }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <span className="text-[10px] text-slate-400">
          {items.length}/{max}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="text-[11px] text-slate-400">{emptyText}</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.map((item) => (
            <span key={item.id} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
              <span className="max-w-[120px] truncate">{item.name}</span>
              <button
                type="button"
                className="text-slate-400 transition hover:text-red-500"
                onClick={() => onRemove(removeType, item.id)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommandCenter() {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const { userProfile, userProfileLoading } = useSelector((state) => state.auth);
  const { workflows: overviewWorkflows, agentHistory: overviewAgentHistory, stats: overviewStats } = useSelector((state) => state.overview);
  const { userWorkflows } = useSelector((state) => state.workflow);
  const { agentHistory: agentHistoryFromTab } = useSelector((state) => state.agent);
  const recentChatIds = useSelector((state) => state.chat?.recentChatIds || []);
  const chatsById = useSelector((state) => state.chat?.chatsById || {});
  const environmentHealthRequestRecords = useSelector(selectEnvironmentHealthRequestsById);
  const workloadHealthRequestRecords = useSelector(selectWorkloadHealthRequestsById);
  const environmentHealthResultRecords = useSelector(selectEnvironmentHealthResultsById);
  const workloadHealthResultRecords = useSelector(selectWorkloadHealthResultsById);
  const environmentCostRequestRecords = useSelector(selectEnvironmentCostRequestsById);
  const environmentCostResultRecords = useSelector(selectEnvironmentCostResultsById);
  const scannerUpdatesConnectionId = useSelector(selectScannerUpdatesConnectionId);
  const executiveSummaryRequestRecords = useSelector(selectExecutiveSummaryRequestsByKey);
  const executiveSummaryRecordsByKey = useSelector(selectExecutiveSummariesByKey);
  const suggestionRequestRecords = useSelector(selectSuggestionRequestsByKey);
  const refreshingRecommendations = useSelector(selectIsRecommendationsRefreshLoading);
  const activeWorkspaceScope = useSelector(selectActiveWorkspaceScope);
  const scopedEnvironmentProfiles = useSelector(selectWorkspaceScopedEnvironmentProfiles);
  const permissionProfiles = userProfile?.agentPermissionProfiles || [];
  const permissionProfileLookup = useMemo(
    () => buildPermissionProfileLookup(permissionProfiles),
    [permissionProfiles]
  );
  const isLocalMode = isLocalRuntime();
  const enableHealthContext = hasRuntimeCapability('health');
  const enableCostContext = hasRuntimeCapability('cost');

  const availableEnvironments = useMemo(
    () => scopedEnvironmentProfiles || [],
    [scopedEnvironmentProfiles]
  );
  const healthCheckEnvironments = useMemo(
    () => enableHealthContext
      ? (availableEnvironments || []).filter((environment) => isAwsAccountProfile(environment))
      : [],
    [availableEnvironments, enableHealthContext]
  );
  const costAnalysisEnvironments = useMemo(
    () => enableCostContext
      ? (availableEnvironments || []).filter((environment) => (
          isAwsAccountProfile(environment) ||
          isAwsOrgProfile(environment) ||
          isAzureTenantProfile(environment) ||
          isAzureSubscriptionProfile(environment)
        ))
      : [],
    [availableEnvironments, enableCostContext]
  );
  const availableWorkloads = useMemo(
    () => (userProfile?.workloads || []).filter((workload) => matchesWorkload(workload, activeWorkspaceScope)),
    [activeWorkspaceScope, userProfile?.workloads]
  );
  const workloadsById = useMemo(() => {
    const map = new Map();
    (availableWorkloads || []).forEach((workload) => {
      const workloadId = String(workload?.workloadId || '').trim();
      if (!workloadId) return;
      map.set(workloadId, workload);
    });
    return map;
  }, [availableWorkloads]);
  const availableScans = useMemo(
    () => (userProfile?.reportHistory || []).filter((scan) => matchesReportScan(scan, activeWorkspaceScope)),
    [activeWorkspaceScope, userProfile?.reportHistory]
  );
  const workflowRunsForCounters = useMemo(() => {
    const source = Array.isArray(userWorkflows) && userWorkflows.length > 0
      ? userWorkflows
      : (overviewWorkflows || []);
    return source.filter((workflow) =>
      matchesWorkflowRun(workflow, activeWorkspaceScope, { workloadById: workloadsById })
    );
  }, [activeWorkspaceScope, overviewWorkflows, userWorkflows, workloadsById]);
  const agentRunsForCounters = useMemo(() => {
    const source = (Array.isArray(agentHistoryFromTab) && agentHistoryFromTab.length > 0)
      ? agentHistoryFromTab
      : (overviewAgentHistory || []);
    return source.filter((agent) => {
      const type = normalizeStatusToken(agent?.agentType);
      return (
        type !== 'report' &&
        type !== 'assessment' &&
        matchesAgentRun(agent, activeWorkspaceScope, {
          permissionProfileLookup,
          workloadById: workloadsById,
        })
      );
    });
  }, [activeWorkspaceScope, agentHistoryFromTab, overviewAgentHistory, permissionProfileLookup, workloadsById]);
  const reportRunsForCounters = useMemo(
    () => (availableScans || []).filter((scan) => scan?.reportId),
    [availableScans]
  );
  const availableRecommendations = useMemo(
    () => {
      if (isLocalMode) return [];
      return (userProfile?.recommendations?.recommendations || []).filter((recommendation) =>
        matchesRecommendationRecord(recommendation, activeWorkspaceScope, {
          workloadById: workloadsById,
        })
      );
    },
    [activeWorkspaceScope, isLocalMode, userProfile?.recommendations?.recommendations, workloadsById]
  );
  const rawBackendSuggestionCards = useSelector((state) => state.commandCenter?.suggestionCards || []);
  const backendSuggestionCards = isLocalMode ? [] : rawBackendSuggestionCards;
  const suggestionPage = useSelector((state) => state.commandCenter?.suggestionPage || 0);
  const environmentBriefing = useSelector((state) => state.commandCenter?.briefing || null);

  const setBackendSuggestionCards = useCallback((cards) => dispatch(setReduxSuggestionCards(cards)), [dispatch]);
  const setSuggestionPage = useCallback((page) => dispatch(setReduxSuggestionPage(page)), [dispatch]);
  const setEnvironmentBriefing = useCallback((briefing) => dispatch(setReduxBriefing(briefing)), [dispatch]);

  const permissionProfileCount = userProfile?.agentPermissionProfiles?.length || 0;
  const userWorkflowCount = Array.isArray(userWorkflows) ? userWorkflows.length : 0;
  const agentHistoryCount = Array.isArray(agentHistoryFromTab) ? agentHistoryFromTab.length : 0;

  const [chatId, setChatId] = useState(() => `chat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
  const [goal, setGoal] = useState({ goalId: null, title: 'Command Center', status: 'active' });
  const [scopeLimits, setScopeLimits] = useState(SCOPE_LIMITS_DEFAULT);
  const [activeScope, setActiveScope] = useState(EMPTY_SCOPE);
  const [scopeNotes, setScopeNotes] = useState('');
  const [fetchedThisSession, setFetchedThisSession] = useState([]);
  const [scopeSuggestions, setScopeSuggestions] = useState([]);
  const [rightRailCards, setRightRailCards] = useState([]);
  const [messages, setMessages] = useState([]);
  const [streamingAssistantText, setStreamingAssistantText] = useState('');
  const [showStreamingAssistantBubble, setShowStreamingAssistantBubble] = useState(false);
  const [input, setInput] = useState('');
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);
  const [isHydratingStartup, setIsHydratingStartup] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasInitializedSession, setHasInitializedSession] = useState(false);
  const [scopeInlineNotice, setScopeInlineNotice] = useState('');
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState('');
  const [selectedWorkloadId, setSelectedWorkloadId] = useState('');
  const [selectedReportId, setSelectedReportId] = useState('');
  const [loadingReportSelection, setLoadingReportSelection] = useState(null);
  const [reportContextByKey, setReportContextByKey] = useState({});
  const [reportPreviews, setReportPreviews] = useState([]);
  const [lastResponseId, setLastResponseId] = useState(null);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [activePath, setActivePath] = useState(COMMAND_PATH_SUGGESTED);
  const [isScopePanelVisible, setIsScopePanelVisible] = useState(false);
  const [isEnvironmentModalOpen, setIsEnvironmentModalOpen] = useState(false);
  const [isWorkloadModalOpen, setIsWorkloadModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeToolCalls, setActiveToolCalls] = useState([]);
  const [completedToolCalls, setCompletedToolCalls] = useState([]);
  const [liveToolExecutions, setLiveToolExecutions] = useState([]);
  const [activeReportPreview, setActiveReportPreview] = useState(null);
  const [isReportPreviewModalOpen, setIsReportPreviewModalOpen] = useState(false);
  const [executiveSummaryPreviews, setExecutiveSummaryPreviews] = useState([]);
  const [activeExecutiveSummaryPreview, setActiveExecutiveSummaryPreview] = useState(null);
  const [isExecutiveSummaryPreviewModalOpen, setIsExecutiveSummaryPreviewModalOpen] = useState(false);
  const [executiveSummaryContextByKey, setExecutiveSummaryContextByKey] = useState({});
  const [healthFindingsContextByKey, setHealthFindingsContextByKey] = useState({});
  const [workflowRunContextById, setWorkflowRunContextById] = useState({});
  const [pendingRoutePrompt, setPendingRoutePrompt] = useState(null);
  const [queuedRoutePromptPreview, setQueuedRoutePromptPreview] = useState(null);
  const [currentRecordId, setCurrentRecordId] = useState(null);
  const [resourcesModal, setResourcesModal] = useState({
    open: false,
    title: '',
    resources: [],
  });
  const [recommendationBlueprintFlow, setRecommendationBlueprintFlow] = useState({
    open: false,
    recommendation: null,
  });
  const [toolInspectorModal, setToolInspectorModal] = useState({
    open: false,
    title: '',
    toolName: '',
    runs: [],
  });

  const initialBriefRenderedRef = useRef(false);
  const hasInitializedSessionRef = useRef(false);
  const isBootstrappingSessionRef = useRef(false);
  const isComponentMountedRef = useRef(false);
  const isHydratingStartupRef = useRef(false);
  const chatIdRef = useRef(chatId);
  const currentRecordIdRef = useRef(currentRecordId);
  const activeScopeRef = useRef(activeScope);
  const scopeNotesRef = useRef(scopeNotes);
  const persistTimerRef = useRef(null);
  const lastPersistedContextRef = useRef('');
  const handledRoutePreloadKeyRef = useRef('');
  const suggestionsPrefetchKeyRef = useRef('');
  const suggestionsPrefetchAttemptAtRef = useRef(0);
  const loadedSuggestionsOnceRef = useRef(backendSuggestionCards.length > 0);
  const autoStartedCostScanIdsRef = useRef(new Set());
  const bootstrapUnauthorizedRef = useRef(false);
  const hasRequestedProfileRefreshRef = useRef(false);
  const hasRequestedOverviewRef = useRef(false);
  const hasRequestedWorkflowHistoryRef = useRef(false);
  const hasRequestedAgentHistoryRef = useRef(false);
  const commandCenterMessageCountRef = useRef(0);
  const chatScrollAreaRef = useRef(null);
  const isChatNearBottomRef = useRef(true);
  const pendingStreamingScrollMessageIdRef = useRef(null);
  const hasPositionedStreamingReplyRef = useRef(false);
  const messagesEndRef = useRef(null);
  const messagesRef = useRef(messages);
  const inputRef = useRef(null);

  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, []);

  const isUnauthorizedCommandCenterError = useCallback(
    (error) => Number(error?.status) === 401,
    []
  );

  useEffect(() => () => {
    if (commandCenterMessageCountRef.current > 0) return;
    analytics.track(ANALYTICS_EVENTS.ERR_COMMAND_CENTER_OPENED_BUT_NO_MESSAGE, {
      route: getAnalyticsRoute(),
    });
  }, []);

  const getBootstrapSafe = useCallback(
    async ({ chatId: targetChatId, personalization }) => {
      if (bootstrapUnauthorizedRef.current) {
        const error = new Error('Command Center bootstrap is unauthorized');
        error.status = 401;
        throw error;
      }
      try {
        return await getCommandCenterBootstrap({
          chatId: targetChatId,
          personalization,
        });
      } catch (error) {
        if (isUnauthorizedCommandCenterError(error)) {
          bootstrapUnauthorizedRef.current = true;
        }
        throw error;
      }
    },
    [isUnauthorizedCommandCenterError]
  );

  // Focus input when response completes
  useEffect(() => {
    if (!isSending) {
      inputRef.current?.focus();
    }
  }, [isSending]);

  const upsertReportPreview = useCallback((nextPreview) => {
    const previewKey = getReportPreviewKey(nextPreview);
    if (!previewKey || !nextPreview) return;
    setReportPreviews((previous) => {
      const existingIndex = previous.findIndex((item) => {
        if (!item) return false;
        if (item.id && nextPreview.id && item.id === nextPreview.id) return true;
        if (item.scanId && nextPreview.scanId && item.scanId === nextPreview.scanId) return true;
        if (item.reportId && nextPreview.reportId && item.reportId === nextPreview.reportId) return true;
        return false;
      });
      const merged = existingIndex >= 0
        ? { ...previous[existingIndex], ...nextPreview }
        : nextPreview;
      if (existingIndex < 0) return [merged, ...previous];
      const next = previous.slice();
      next.splice(existingIndex, 1);
      return [merged, ...next];
    });
  }, []);

  const getExecutiveSummaryPreviewKey = useCallback((preview) => {
    if (!preview || typeof preview !== 'object') return null;
    if (preview.type === 'workload') {
      return `workload:${preview.workloadId || preview.id}`;
    }
    return `environment:${preview.recordId || preview.id}`;
  }, []);

  const upsertExecutiveSummaryPreview = useCallback((nextPreview) => {
    const previewKey = getExecutiveSummaryPreviewKey(nextPreview);
    if (!previewKey || !nextPreview) return;
    setExecutiveSummaryPreviews((previous) => {
      const existingIndex = previous.findIndex((item) => {
        if (!item) return false;
        return getExecutiveSummaryPreviewKey(item) === previewKey;
      });
      const merged = existingIndex >= 0
        ? { ...previous[existingIndex], ...nextPreview }
        : nextPreview;
      if (existingIndex < 0) return [merged, ...previous];
      const next = previous.slice();
      next.splice(existingIndex, 1);
      return [merged, ...next];
    });
  }, [getExecutiveSummaryPreviewKey]);

  const maps = useMemo(() => {
    const envById = new Map(
      availableEnvironments.map((env) => [
        env.recordId,
        {
          id: env.recordId,
          name: env.name || env.recordId,
          cloudProvider: env.type || env.cloudProvider || null,
          authProfile: parseAuthProfile(env.authProfile),
        },
      ])
    );

    const workloadById = new Map(
      availableWorkloads.map((workload) => [
        workload.workloadId,
        {
          id: workload.workloadId,
          name: workload.workloadName || workload.name || workload.workloadId,
          environments: Array.isArray(workload.environments) ? workload.environments : [],
        },
      ])
    );

    const reportById = new Map(
      availableScans
        .filter((scan) => scan?.reportId)
        .map((scan) => [
          buildReportEntryKey(scan) || scan.scanId || scan.reportId,
          {
            id: buildReportEntryKey(scan) || scan.scanId || scan.reportId,
            name: scan.title || scan.reportId || scan.scanId,
            reportId: scan.reportId || null,
            scanId: scan.scanId || null,
            permissionProfileId: scan.permissionProfileId || scan.parentId || null,
          },
        ])
    );

    return {
      envById,
      workloadById,
      reportById,
    };
  }, [availableEnvironments, availableScans, availableWorkloads]);

  const workloadHealthById = useMemo(() => {
    const next = {};
    (availableWorkloads || []).forEach((workload) => {
      const workloadId = String(workload?.workloadId || '').trim();
      if (!workloadId) return;
      const scannedRecord = workloadHealthResultRecords?.[workloadId] || null;
      const scannedPayload = unwrapScannerRecord(scannedRecord) || null;
      const scannedResources = extractHealthResources(scannedPayload);
      if (scannedResources.length > 0) {
        const stats = summarizeHealthResources(scannedResources);
        next[workloadId] = {
          stats,
          findings: {
            type: 'workload',
            workloadId,
            workloadName: workload.workloadName || workload.name || workloadId,
            generatedAt:
              scannedRecord?.generatedAt ||
              scannedPayload?.generatedAt ||
              scannedPayload?.analysis?.health?.generatedAt ||
              stats.latestGeneratedAt ||
              null,
            version: scannedPayload?.version || null,
            cache: scannedPayload?.output?.cache || null,
            resources: scannedResources.map(serializeHealthResource).filter(Boolean),
          },
        };
        return;
      }
      const trackedResources = safeParseJson(workload?.trackedResources, { resources: [] });
      const resources = Array.isArray(trackedResources?.resources) ? trackedResources.resources : [];
      const stats = summarizeHealthResources(resources);
      next[workloadId] = {
        stats,
        findings: {
          type: 'workload',
          workloadId,
          workloadName: workload.workloadName || workload.name || workloadId,
          generatedAt: stats.latestGeneratedAt || null,
          resources: resources.map(serializeHealthResource).filter(Boolean),
        },
      };
    });
    return next;
  }, [availableWorkloads, workloadHealthResultRecords]);

  const environmentHealthResultsById = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(environmentHealthResultRecords || {}).map(([permissionProfileId, record]) => [
          permissionProfileId,
          record?.payload || null,
        ])
      ),
    [environmentHealthResultRecords]
  );

  const loadingEnvironmentHealthIds = useMemo(
    () =>
      new Set(
        Object.entries(environmentHealthRequestRecords || {})
          .filter(([, request]) => request?.status === 'loading')
          .map(([permissionProfileId]) => permissionProfileId)
      ),
    [environmentHealthRequestRecords]
  );

  const loadingWorkloadHealthIds = useMemo(
    () =>
      new Set(
        Object.entries(workloadHealthRequestRecords || {})
          .filter(([, request]) => request?.status === 'loading')
          .map(([workloadId]) => workloadId)
      ),
    [workloadHealthRequestRecords]
  );

  const environmentCostResultsById = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(environmentCostResultRecords || {}).map(([permissionProfileId, record]) => [
          permissionProfileId,
          record?.payload || null,
        ])
      ),
    [environmentCostResultRecords]
  );

  const loadingEnvironmentCostIds = useMemo(
    () =>
      new Set(
        Object.entries(environmentCostRequestRecords || {})
          .filter(([, request]) => request?.status === 'loading')
          .map(([permissionProfileId]) => permissionProfileId)
      ),
    [environmentCostRequestRecords]
  );

  const isRefreshingSuggestions = useMemo(
    () =>
      Object.values(suggestionRequestRecords || {}).some(
        (request) => request?.status === 'loading'
      ),
    [suggestionRequestRecords]
  );

  const environmentHealthById = useMemo(() => {
    const next = {};
    (healthCheckEnvironments || []).forEach((environment) => {
      const envId = getProfileRecordId(environment);
      if (!envId) return;
      const result = environmentHealthResultsById?.[envId] || null;
      const resources = Array.isArray(result?.resources) ? result.resources : [];
      if (resources.length === 0) {
        const summaryInsight = buildHealthInsightFromProfileSummary(environment);
        if (summaryInsight) {
          next[envId] = summaryInsight;
          return;
        }
      }
      const stats = summarizeHealthResources(resources);
      next[envId] = {
        stats,
        findings: {
          type: 'environment',
          permissionProfileId: envId,
          environmentName: environment?.name || envId,
          generatedAt: result?.generatedAt || stats.latestGeneratedAt || null,
          version: result?.version || null,
          cache: result?.output?.cache || null,
          resources: resources.map(serializeHealthResource).filter(Boolean),
        },
      };
    });
    return next;
  }, [environmentHealthResultsById, healthCheckEnvironments]);

  const environmentCostById = useMemo(() => {
    const next = {};
    (costAnalysisEnvironments || []).forEach((environment) => {
      const envId = String(environment?.recordId || '').trim();
      if (!envId) return;
      const result = environmentCostResultsById?.[envId] || null;
      const checks = Array.isArray(result?.checks) ? result.checks : [];
      const stats = summarizeCostChecks(checks, result?.statusCounts || null);
      next[envId] = {
        stats,
        findings: result,
      };
    });
    return next;
  }, [costAnalysisEnvironments, environmentCostResultsById]);
  const environmentSessionContextById = useMemo(() => {
    const next = {};
    (availableEnvironments || []).forEach((environment) => {
      const envId = String(environment?.recordId || '').trim();
      if (!envId) return;
      const cachedCost = environmentCostResultsById?.[envId] || null;
      const cachedGeneratedAt = cachedCost?.generatedAt || cachedCost?.analysis?.cost?.generatedAt || null;
      const profileArtifact = getAnalysisArtifactMetadataFromProfile(environment, 'cost');
      const metadataGeneratedAt = profileArtifact?.generatedAt || null;
      const costAnalysisAvailable = Boolean(cachedGeneratedAt || metadataGeneratedAt);

      next[envId] = {
        type: environment?.type || null,
        accountId: safeParseJson(environment?.authProfile, {})?.awsAccountId
          || safeParseJson(environment?.authProfile, {})?.accountId
          || null,
        costAnalysis: {
          available: costAnalysisAvailable,
          generatedAt: cachedGeneratedAt || metadataGeneratedAt || null,
          source: cachedGeneratedAt ? 'cached' : metadataGeneratedAt ? 'metadata' : null,
        },
      };
    });
    return next;
  }, [availableEnvironments, environmentCostResultsById]);

  const fetchEnvironmentHealth = useCallback(async (permissionProfileId) => {
    const normalizedProfileId = String(permissionProfileId || '').trim();
    if (!normalizedProfileId) return null;
    if (environmentHealthResultsById?.[normalizedProfileId]) {
      return environmentHealthResultsById[normalizedProfileId];
    }
    if (loadingEnvironmentHealthIds.has(normalizedProfileId)) {
      return null;
    }

    try {
      const action = await dispatch(refreshEnvironmentHealth({
        permissionProfileId: normalizedProfileId,
        forceRefresh: false,
      }));
      if (refreshEnvironmentHealth.fulfilled.match(action)) {
        return action.payload?.payload || null;
      }
      if (action.meta?.condition) {
        return environmentHealthResultsById?.[normalizedProfileId] || null;
      }
      return null;
    } catch (error) {
      console.error(`Failed to load cached health findings for environment ${normalizedProfileId}:`, error);
      return null;
    }
  }, [dispatch, environmentHealthResultsById, loadingEnvironmentHealthIds]);

  const fetchEnvironmentCostAnalysis = useCallback(async (permissionProfileId, cloudProvider = 'aws') => {
    const normalizedProfileId = String(permissionProfileId || '').trim();
    if (!normalizedProfileId) return null;
    if (environmentCostResultsById?.[normalizedProfileId]) {
      return environmentCostResultsById[normalizedProfileId];
    }
    if (loadingEnvironmentCostIds.has(normalizedProfileId)) {
      return null;
    }

    try {
      const action = await dispatch(refreshEnvironmentCostAnalysis({
        agentPermissionProfileId: normalizedProfileId,
        cloudProvider,
        forceRefresh: false,
        allowWhileLoading: true,
      }));
      if (refreshEnvironmentCostAnalysis.fulfilled.match(action)) {
        return action.payload?.payload || null;
      }
      if (action.meta?.condition) {
        return environmentCostResultsById?.[normalizedProfileId] || null;
      }
      return null;
    } catch (error) {
      console.error(`Failed to load cached cost analysis for environment ${normalizedProfileId}:`, error);
      return null;
    }
  }, [dispatch, environmentCostResultsById, loadingEnvironmentCostIds]);

  useEffect(() => {
    if (!scannerUpdatesConnectionId || costAnalysisEnvironments.length === 0) return;

    costAnalysisEnvironments.forEach((environment) => {
      if (!isAzureTenantProfile(environment) && !isAzureSubscriptionProfile(environment)) return;

      const permissionProfileId = getProfileRecordId(environment);
      if (!permissionProfileId) return;
      if (environmentCostResultsById?.[permissionProfileId]) return;
      const request = environmentCostRequestRecords?.[permissionProfileId];
      if (loadingEnvironmentCostIds.has(permissionProfileId) && request?.params?.forceRefresh) return;

      const launchKey = `azure:${permissionProfileId}`;
      if (autoStartedCostScanIdsRef.current.has(launchKey)) return;

      autoStartedCostScanIdsRef.current.add(launchKey);
      fetchEnvironmentCostAnalysis(permissionProfileId, 'azure').then((payload) => {
        if (payload || environmentCostResultsById?.[permissionProfileId]) return;

        dispatch(
          launchEnvironmentCostScans({
            targets: [{ permissionProfileId, cloudProvider: 'azure' }],
            forceRefresh: true,
            allowWhileLoading: true,
          })
        );
      });
    });
  }, [
    costAnalysisEnvironments,
    dispatch,
    environmentCostRequestRecords,
    environmentCostResultsById,
    fetchEnvironmentCostAnalysis,
    loadingEnvironmentCostIds,
    scannerUpdatesConnectionId,
  ]);

  useEffect(() => {
    if (!isLocalMode || !enableCostContext || costAnalysisEnvironments.length === 0) return;

    costAnalysisEnvironments.forEach((environment) => {
      if (!isAwsAccountProfile(environment) && !isAwsOrgProfile(environment)) return;
      if (!isAwsCredentialBackedProfile(environment)) return;
      if (!canRunLocalAwsScannersForProfile(environment)) return;

      const permissionProfileId = getProfileRecordId(environment);
      if (!permissionProfileId) return;
      if (environmentCostResultsById?.[permissionProfileId]) return;

      const request = environmentCostRequestRecords?.[permissionProfileId];
      if (loadingEnvironmentCostIds.has(permissionProfileId) || request?.status === 'loading') return;

      const launchKey = `local:aws:${permissionProfileId}`;
      if (autoStartedCostScanIdsRef.current.has(launchKey)) return;
      autoStartedCostScanIdsRef.current.add(launchKey);

      dispatch(
        launchEnvironmentCostScans({
          targets: [{ permissionProfileId, cloudProvider: 'aws' }],
          forceRefresh: true,
          allowWhileLoading: true,
        })
      );
    });
  }, [
    costAnalysisEnvironments,
    dispatch,
    enableCostContext,
    environmentCostRequestRecords,
    environmentCostResultsById,
    isLocalMode,
    loadingEnvironmentCostIds,
  ]);

  const hydrateHealthDrilldown = useCallback(async () => {
    // Keep CloudAgent drilldowns summary-first. Full health payloads are loaded
    // only from explicit detail actions or the Health dashboard.
  }, []);

  const buildConversationTitle = useCallback(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const year = now.getFullYear();
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${month}-${day}-${year} ${hours}:${minutes}`;
  }, []);

  const commandCenterHistory = useMemo(
    () => (recentChatIds || [])
      .map((id) => chatsById[id])
      .filter((chat) => isCommandCenterChatRecord(chat)),
    [chatsById, recentChatIds]
  );

  const buildChatMetadataPatch = useCallback((overrides = {}) => ({
    source: COMMAND_CENTER_CHAT_SOURCE,
    commandCenter: true,
    goalId: goal?.goalId || null,
    goalTitle: goal?.title || 'Command Center',
    responseId: overrides.responseId ?? lastResponseId ?? null,
    sessionContext: buildCommandCenterSessionContext(
      activeScope,
      scopeNotesRef.current,
      fetchedThisSession,
      reportContextByKey,
      executiveSummaryContextByKey,
      healthFindingsContextByKey,
      environmentSessionContextById,
      workflowRunContextById
    ),
    ...overrides,
  }), [activeScope, environmentSessionContextById, fetchedThisSession, goal?.goalId, goal?.title, lastResponseId, reportContextByKey, executiveSummaryContextByKey, healthFindingsContextByKey, workflowRunContextById]);

  const ensureChatRecord = useCallback(async ({ sessionId = null, metadataOverrides = {}, title = null } = {}) => {
    const stableSessionId = sessionId || chatIdRef.current || chatId;
    let recordId = currentRecordIdRef.current;

    const existingMetadata = recordId ? parseChatMetadata(chatsById[recordId]?.metadata) : {};
    const metadata = {
      ...existingMetadata,
      ...buildChatMetadataPatch(metadataOverrides),
    };

    const started = await dispatch(startChatThunk({
      recordId: recordId || undefined,
      sessionId: stableSessionId,
      title: title || chatsById[recordId]?.title || buildConversationTitle(),
      metadata,
    })).unwrap();

    recordId = started?.recordId || recordId;
    if (recordId) {
      currentRecordIdRef.current = recordId;
      setCurrentRecordId(recordId);
      dispatch(setCurrentChatId(recordId));
    }
    return recordId;
  }, [buildChatMetadataPatch, buildConversationTitle, chatId, chatsById, dispatch]);

  const getStartupAssistantTextForHistory = useCallback(() => {
    const startupMessage = (messagesRef.current || []).find((message) => (
      message?.role === 'assistant'
      && Array.isArray(message?.blocks)
      && message.blocks.some((block) => block?.type === 'start_brief')
      && typeof message?.text === 'string'
      && message.text.trim()
    ));
    return startupMessage?.text?.trim() || null;
  }, []);

  const persistMessagesToHistory = useCallback(async ({
    userText = null,
    assistantText = null,
    assistantMessageMeta = null,
    actionLabel = null,
    responseId = null,
  } = {}) => {
    try {
      const recordId = await ensureChatRecord({
        metadataOverrides: {
          ...(responseId ? { responseId } : {}),
        },
      });
      if (!recordId) return;

      const existingMetadata = parseChatMetadata(chatsById[recordId]?.metadata);
      const existingMessages = Array.isArray(chatsById[recordId]?.messages) ? chatsById[recordId].messages : [];
      const existingMessageMeta = Array.isArray(existingMetadata?.messageMeta) ? existingMetadata.messageMeta : [];
      const metadata = {
        ...existingMetadata,
        ...buildChatMetadataPatch({
          responseId: responseId ?? lastResponseId ?? null,
        }),
      };

      const toPersist = [];
      const startupAssistantText = existingMessages.length === 0
        ? getStartupAssistantTextForHistory()
        : null;
      if (startupAssistantText) {
        toPersist.push({ role: 'assistant', content: startupAssistantText });
      }
      if (userText && userText.trim()) {
        toPersist.push({ role: 'user', content: userText.trim() });
      } else if (actionLabel && actionLabel.trim()) {
        toPersist.push({ role: 'user', content: `[Action] ${actionLabel.trim()}` });
      }
      if (typeof assistantText === 'string' && assistantText.trim()) {
        toPersist.push({ role: 'assistant', content: assistantText.trim() });
      }
      if (toPersist.length === 0) return;

      const nextMessageMeta = [...existingMessageMeta];
      if (assistantText && assistantText.trim()) {
        const assistantIndex = existingMessages.length + toPersist.length - 1;
        nextMessageMeta.push({
          index: assistantIndex,
          role: 'assistant',
          toolExecutions: (Array.isArray(assistantMessageMeta?.toolExecutions) ? assistantMessageMeta.toolExecutions : [])
            .map((entry) => normalizeToolExecution(entry))
            .filter(Boolean),
          tools: Array.isArray(assistantMessageMeta?.tools) ? assistantMessageMeta.tools : [],
        });
      }
      metadata.messageMeta = nextMessageMeta;

      await dispatch(appendChatMessagesThunk({
        recordId,
        messages: toPersist,
        metadata,
      })).unwrap();
    } catch (error) {
      console.error('Failed to persist Command Center chat history:', error);
    }
  }, [buildChatMetadataPatch, chatsById, dispatch, ensureChatRecord, getStartupAssistantTextForHistory, lastResponseId]);

  const personalizationBase = useMemo(() => {
    const environments = (availableEnvironments || []).map((env) => {
      const authProfile = parseAuthProfile(env.authProfile);
      return {
        id: env.recordId,
        name: env.name || env.recordId,
        cloudProvider: env.type || env.cloudProvider || null,
        accountId: authProfile.awsAccountId || authProfile.accountId || authProfile.domain || null,
      };
    });
    const environmentNameByAccountId = new Map(
      environments
        .filter((env) => env.accountId)
        .map((env) => [String(env.accountId), env.name])
    );
    const workloadNameById = new Map(
      (availableWorkloads || [])
        .filter((workload) => workload?.workloadId)
        .map((workload) => [String(workload.workloadId), workload.workloadName || workload.name || workload.workloadId])
    );

    const allRecommendations = (availableRecommendations || [])
      .map(normalizeRecommendationForPersonalization)
      .filter((recommendation) => recommendation?.id)
      .map((recommendation) => ({
        ...recommendation,
        targetResources: (recommendation.targetResources || []).map((resource) => ({
          ...resource,
          environmentName: resource.environmentName
            || (resource.accountId ? environmentNameByAccountId.get(String(resource.accountId)) : null)
            || null,
          workloadName: resource.workloadName
            || (resource.workloadId ? workloadNameById.get(String(resource.workloadId)) : null)
            || null,
        })),
      }));

    const workloads = (availableWorkloads || []).map((workload) => ({
      id: workload.workloadId,
      name: workload.workloadName || workload.name || workload.workloadId,
      environments: Array.isArray(workload.environments) ? workload.environments : [],
      hasDiagram: workloadHasDiagram(workload),
    }));

    return {
      recommendations: allRecommendations,
      environments,
      workloads,
    };
  }, [availableEnvironments, availableRecommendations, availableWorkloads]);

  const recommendationLookup = useMemo(() => {
    const byId = new Map();
    for (const recommendation of personalizationBase.recommendations || []) {
      if (!recommendation?.id) continue;
      byId.set(String(recommendation.id), recommendation);
    }
    return byId;
  }, [personalizationBase.recommendations]);

  const briefingHealthSnapshot = useMemo(
    () => buildBriefingHealthSnapshot({
      availableWorkloads,
      healthCheckEnvironments,
      workloadHealthById,
      environmentHealthById,
    }),
    [availableWorkloads, environmentHealthById, healthCheckEnvironments, workloadHealthById]
  );

  const startupSuggestionWindow = useMemo(
    () => buildStartupSuggestionWindow({
      recommendations: personalizationBase.recommendations || [],
      workloads: personalizationBase.workloads || [],
      scans: availableScans || [],
      page: suggestionPage,
      categoriesPerPage: STARTUP_CATEGORY_BATCH_SIZE,
      recommendationsPerCategory: STARTUP_RECOMMENDATIONS_PER_CATEGORY,
    }),
    [availableScans, personalizationBase.recommendations, personalizationBase.workloads, suggestionPage]
  );

  const bootstrapPersonalization = useMemo(() => ({
    recommendations: startupSuggestionWindow.selectedRecommendations || [],
    environments: personalizationBase.environments || [],
    workloads: personalizationBase.workloads || [],
    healthSummary: briefingHealthSnapshot,
    startupCategories: startupSuggestionWindow.startupCategories || [],
    maxCards: Math.max(1, Math.min(8, (startupSuggestionWindow.startupCategories || []).length || STARTUP_CATEGORY_BATCH_SIZE)),
  }), [briefingHealthSnapshot, personalizationBase.environments, personalizationBase.workloads, startupSuggestionWindow.selectedRecommendations, startupSuggestionWindow.startupCategories]);

  const getBootstrapPersonalizationForPage = useCallback((page) => {
    const window = buildStartupSuggestionWindow({
      recommendations: personalizationBase.recommendations || [],
      workloads: personalizationBase.workloads || [],
      scans: availableScans || [],
      page,
      categoriesPerPage: STARTUP_CATEGORY_BATCH_SIZE,
      recommendationsPerCategory: STARTUP_RECOMMENDATIONS_PER_CATEGORY,
    });

    return {
      window,
      personalization: {
        recommendations: window.selectedRecommendations || [],
        environments: personalizationBase.environments || [],
        workloads: personalizationBase.workloads || [],
        healthSummary: briefingHealthSnapshot,
        startupCategories: window.startupCategories || [],
        maxCards: Math.max(1, Math.min(8, (window.startupCategories || []).length || STARTUP_CATEGORY_BATCH_SIZE)),
      },
    };
  }, [availableScans, briefingHealthSnapshot, personalizationBase.environments, personalizationBase.recommendations, personalizationBase.workloads]);

  const availableReports = useMemo(() => {
    const selectedEnvIds = new Set((activeScope.environments || []).map((env) => env.id));

    return (availableScans || [])
      .filter((scan) => scan?.reportId)
      .map((scan) => {
        const resolvedProfile = resolvePermissionProfileForScan(scan, permissionProfiles);
        const parsedDetails = parseJsonObject(scan?.details);
        const parsedSummary = parseJsonObject(scan?.summary);
        const assessmentResultsUrl = scan.assessmentResultsUrl
          || parsedDetails?.assessmentResultsUrl
          || parsedDetails?.latestAssessmentResultUrl
          || parsedDetails?.latestAssessmentResultsUrl
          || parsedDetails?.assessment?.resultsUrl
          || parsedDetails?.assessmentResults?.url
          || parsedSummary?.assessmentResultsUrl
          || null;
        return {
          ...scan,
          permissionProfileId: scan.permissionProfileId || scan.parentId || resolvedProfile.permissionProfileId || null,
          environmentName: resolvedProfile.name || '—',
          updatedAt: scan.lastUpdateTime || scan.latestAssessmentDate || scan.updatedAt || null,
          assessmentResultsUrl,
        };
      })
      .filter((scan) => {
        if (selectedEnvIds.size === 0) return true;

        if (scan.permissionProfileId && selectedEnvIds.has(scan.permissionProfileId)) return true;

        if (!scan.accountId) return false;
        const scanAccountId = String(scan.accountId);

        for (const env of activeScope.environments || []) {
          const mapped = maps.envById.get(env.id);
          const accountId = mapped?.authProfile?.awsAccountId || mapped?.authProfile?.accountId || mapped?.authProfile?.domain;
          if (accountId && String(accountId) === scanAccountId) {
            return true;
          }
        }

        return false;
      })
      .sort((a, b) => {
        const aTime = Date.parse(a?.updatedAt || a?.lastUpdateTime || a?.latestAssessmentDate || '') || 0;
        const bTime = Date.parse(b?.updatedAt || b?.lastUpdateTime || b?.latestAssessmentDate || '') || 0;
        return bTime - aTime;
      });
  }, [activeScope.environments, availableScans, maps.envById, permissionProfiles]);

  useEffect(() => {
    const scopedReports = activeScope.reports || [];
    setReportPreviews((previous) => previous.filter((preview) => (
      scopedReports.some((item) => reportPreviewMatchesScopeItem(preview, item))
    )));

    if (!activeReportPreview) return;
    const reportInScope = scopedReports.some((item) => reportPreviewMatchesScopeItem(activeReportPreview, item));
    if (!reportInScope) {
      setActiveReportPreview(null);
      setIsReportPreviewModalOpen(false);
    }
  }, [activeReportPreview, activeScope.reports]);

  useEffect(() => {
    isComponentMountedRef.current = true;
    return () => {
      isComponentMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  useEffect(() => {
    currentRecordIdRef.current = currentRecordId;
  }, [currentRecordId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    activeScopeRef.current = activeScope;
  }, [activeScope]);

  const environmentBriefingRef = useRef(environmentBriefing);
  const mapsRef = useRef(maps);

  useEffect(() => {
    environmentBriefingRef.current = environmentBriefing;
  }, [environmentBriefing]);

  useEffect(() => {
    mapsRef.current = maps;
  }, [maps]);

  useEffect(() => {
    scopeNotesRef.current = scopeNotes;
  }, [scopeNotes]);

  useEffect(() => {
    if (backendSuggestionCards.length > 0) {
      loadedSuggestionsOnceRef.current = true;
    }
  }, [backendSuggestionCards.length]);

  const applyServerSessionState = useCallback(
    (response, options = {}) => {
      const { allowGoal = false, allowScope = true, allowChatId = false } = options;
      let hasRailUpdates = false;
      const scopeSync = response?.scopeSync || {};

      if (allowChatId && response?.chatId) {
        const nextChatId = String(response.chatId);
        if (nextChatId && nextChatId !== chatIdRef.current) {
          chatIdRef.current = nextChatId;
          setChatId(nextChatId);
        }
      }

      if (allowGoal && response?.goal) {
        setGoal(response.goal);
      }

      if (response?.briefing && typeof response.briefing === 'object') {
        const incomingBriefing = response.briefing;
        const currentBriefing = environmentBriefingRef.current && typeof environmentBriefingRef.current === 'object'
          ? environmentBriefingRef.current
          : null;
        const shouldPreserveCurrent =
          currentBriefing?.source === 'llm' && incomingBriefing?.source && incomingBriefing.source !== 'llm';
        if (!shouldPreserveCurrent) {
          const nextBriefing = {
            ...(currentBriefing || {}),
            ...incomingBriefing,
          };
          if (!areJsonSnapshotsEqual(currentBriefing, nextBriefing)) {
            environmentBriefingRef.current = nextBriefing;
            setEnvironmentBriefing(nextBriefing);
          }
        }
      }

      if (response?.rightRail?.cards) {
        setRightRailCards(response.rightRail.cards || []);
        hasRailUpdates = true;
      }

      if (response?.limits || scopeSync?.limits) {
        setScopeLimits(response?.limits || scopeSync?.limits);
      }

      if (allowScope && (response?.activeScope || scopeSync?.activeScope)) {
        setActiveScope(normalizeScopeFromApi(response?.activeScope || scopeSync?.activeScope, mapsRef.current));
      }

      return hasRailUpdates;
    },
    [setEnvironmentBriefing]
  );

  const refreshCommandCenterState = useCallback(
    async ({ quiet = true } = {}) => {
      if (!chatIdRef.current) return false;
      try {
        const state = await getCommandCenterState({ chatId: chatIdRef.current });
        applyServerSessionState(state, { allowGoal: false, allowScope: true, allowChatId: false });
        return true;
      } catch (error) {
        if (!quiet) {
          toast.error(error.message || 'Failed to refresh command center state');
        }
        return false;
      }
    },
    [applyServerSessionState]
  );

  const syncScope = useCallback(
    async (nextScope, operation = 'replace') => {
      const stableChatId = chatIdRef.current || chatId;
      if (!stableChatId) return;

      try {
        const response = await updateCommandCenterScope({
          chatId: stableChatId,
          operation,
          scope: buildScopePayload(nextScope),
        });

        if (response?.activeScope) {
          const normalizedScope = normalizeScopeFromApi(response.activeScope, maps);
          activeScopeRef.current = normalizedScope;
          setActiveScope(normalizedScope);
        } else {
          activeScopeRef.current = nextScope;
          setActiveScope(nextScope);
        }

        const hadRails = applyServerSessionState(response, { allowGoal: false, allowScope: false, allowChatId: false });
        if (!hadRails) {
          await refreshCommandCenterState({ quiet: true });
        }
        setScopeInlineNotice('');
      } catch (error) {
        activeScopeRef.current = nextScope;
        setActiveScope(nextScope);
        if (error?.body?.limits) {
          setScopeLimits(error.body.limits);
        }
        toast.error(error.message || 'Failed to sync scope');
      }
    },
    [applyServerSessionState, chatId, maps, refreshCommandCenterState]
  );

  useEffect(() => {
    const preloadReport = location.state?.preloadReportContext;
    if (!preloadReport || typeof preloadReport !== 'object') return;

    const reportKey = getSessionReportContextKey(preloadReport);
    if (!reportKey) return;
    const preloadPrompt = typeof location.state?.preloadPrompt === 'string'
      ? location.state.preloadPrompt.trim()
      : '';
    const preloadKey = `${reportKey}::${preloadPrompt}`;
    if (handledRoutePreloadKeyRef.current === preloadKey) {
      navigate(`${location.pathname}${location.search || ''}`, {
        replace: true,
        state: null,
      });
      return;
    }
    handledRoutePreloadKeyRef.current = preloadKey;

    const reportTitle = preloadReport.title || preloadReport.name || preloadReport.reportId || preloadReport.scanId || reportKey;
    const nextReportContextByKey = {
      ...(reportContextByKey || {}),
      [reportKey]: {
        ...(reportContextByKey?.[reportKey] || {}),
        scanId: preloadReport.scanId || reportContextByKey?.[reportKey]?.scanId || null,
        reportId: preloadReport.reportId || reportContextByKey?.[reportKey]?.reportId || null,
        title: reportTitle,
        permissionProfileId: preloadReport.permissionProfileId || reportContextByKey?.[reportKey]?.permissionProfileId || null,
        fileId: preloadReport.fileId || reportContextByKey?.[reportKey]?.fileId || null,
        reportDefinitionId: preloadReport.reportDefinitionId || reportContextByKey?.[reportKey]?.reportDefinitionId || null,
        reportPlanId: preloadReport.reportPlanId || reportContextByKey?.[reportKey]?.reportPlanId || null,
      },
    };
    setReportContextByKey((prev) => ({
      ...nextReportContextByKey,
    }));

    const currentScope = activeScopeRef.current || EMPTY_SCOPE;
    const existingReports = Array.isArray(currentScope.reports) ? currentScope.reports : [];
    const nextScope = {
      ...currentScope,
      reports: existingReports.some((entry) => entry?.id === reportKey)
        ? existingReports
        : [
            ...existingReports,
            {
              id: reportKey,
              name: reportTitle,
              scanId: preloadReport.scanId || null,
              reportId: preloadReport.reportId || null,
              permissionProfileId: preloadReport.permissionProfileId || null,
              fileId: preloadReport.fileId || null,
              reportDefinitionId: preloadReport.reportDefinitionId || null,
              reportPlanId: preloadReport.reportPlanId || null,
            },
          ],
    };

    activeScopeRef.current = nextScope;
    setActivePath(COMMAND_PATH_CUSTOM);
    setScopeInlineNotice('');
    syncScope(nextScope, 'replace');
    if (preloadPrompt) {
      setQueuedRoutePromptPreview({
        key: preloadKey,
        text: preloadPrompt,
      });
      setPendingRoutePrompt({
        key: preloadKey,
        prompt: preloadPrompt,
        visibleUserText: preloadPrompt,
        activeScopeOverride: nextScope,
        sessionContextOverride: buildCommandCenterSessionContext(
          nextScope,
          scopeNotesRef.current,
          fetchedThisSession,
          nextReportContextByKey,
          executiveSummaryContextByKey,
          healthFindingsContextByKey,
          environmentSessionContextById,
          workflowRunContextById
        ),
      });
    }

    navigate(`${location.pathname}${location.search || ''}`, {
      replace: true,
      state: null,
    });
  }, [
    executiveSummaryContextByKey,
    fetchedThisSession,
    healthFindingsContextByKey,
    location.pathname,
    location.search,
    location.state,
    navigate,
    reportContextByKey,
    syncScope,
    workflowRunContextById,
  ]);

  useEffect(() => {
    const preloadReport = location.state?.preloadReportContext;
    if (preloadReport && typeof preloadReport === 'object') return;

    const preloadPrompt = typeof location.state?.preloadPrompt === 'string'
      ? location.state.preloadPrompt.trim()
      : '';
    if (!preloadPrompt) return;

    const preloadKey = typeof location.state?.preloadPromptKey === 'string' && location.state.preloadPromptKey.trim()
      ? location.state.preloadPromptKey.trim()
      : `prompt::${preloadPrompt}`;
    const visibleUserText = typeof location.state?.preloadVisibleUserText === 'string' && location.state.preloadVisibleUserText.trim()
      ? location.state.preloadVisibleUserText.trim()
      : preloadPrompt;
    const workflowRunContext = normalizeWorkflowRunContext(location.state?.workflowContext);
    const nextWorkflowRunContextById = workflowRunContext
      ? {
          ...(workflowRunContextById || {}),
          [workflowRunContext.workflowRunId]: workflowRunContext,
        }
      : workflowRunContextById;

    if (handledRoutePreloadKeyRef.current === preloadKey) {
      navigate(`${location.pathname}${location.search || ''}`, {
        replace: true,
        state: null,
      });
      return;
    }
    handledRoutePreloadKeyRef.current = preloadKey;
    if (workflowRunContext) {
      setWorkflowRunContextById(nextWorkflowRunContextById);
    }

    setActivePath(COMMAND_PATH_CUSTOM);
    setScopeInlineNotice('');
    setQueuedRoutePromptPreview({
      key: preloadKey,
      text: visibleUserText,
    });
    setPendingRoutePrompt({
      key: preloadKey,
      prompt: preloadPrompt,
      visibleUserText,
      sessionContextOverride: workflowRunContext
        ? buildCommandCenterSessionContext(
            activeScopeRef.current || activeScope,
            scopeNotesRef.current,
            fetchedThisSession,
            reportContextByKey,
            executiveSummaryContextByKey,
            healthFindingsContextByKey,
            environmentSessionContextById,
            nextWorkflowRunContextById
          )
        : null,
    });

    navigate(`${location.pathname}${location.search || ''}`, {
      replace: true,
      state: null,
    });
  }, [
    activeScope,
    environmentSessionContextById,
    executiveSummaryContextByKey,
    fetchedThisSession,
    healthFindingsContextByKey,
    location.pathname,
    location.search,
    location.state,
    navigate,
    reportContextByKey,
    workflowRunContextById,
  ]);

  const appendAssistantMessage = useCallback((assistantMessage) => {
    if (!assistantMessage) return;

    const normalizedMessage = {
      id: assistantMessage.id || `assistant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: 'assistant',
      text: assistantMessage.text || '',
      blocks: Array.isArray(assistantMessage.blocks) ? assistantMessage.blocks : [],
      tools: Array.isArray(assistantMessage.tools) ? assistantMessage.tools : [],
      toolExecutions: (Array.isArray(assistantMessage.toolExecutions) ? assistantMessage.toolExecutions : [])
        .map((entry) => normalizeToolExecution(entry))
        .filter(Boolean),
      contextEvents: Array.isArray(assistantMessage.contextEvents) ? assistantMessage.contextEvents : [],
      suggestedScopePatch: assistantMessage.suggestedScopePatch || null,
      createdAt: Date.now(),
    };

    setMessages((prev) => [
      ...prev,
      normalizedMessage,
    ]);
    return normalizedMessage;
  }, []);

  const openToolInspector = useCallback((toolGroup) => {
    if (!toolGroup?.name) return;
    setToolInspectorModal({
      open: true,
      title: getToolStatusLabel(toolGroup.name),
      toolName: toolGroup.name,
      runs: Array.isArray(toolGroup.runs) ? toolGroup.runs : [],
    });
  }, []);

  const commandCenterSessionContext = useMemo(
    () => buildCommandCenterSessionContext(
      activeScope,
      scopeNotes,
      fetchedThisSession,
      reportContextByKey,
      executiveSummaryContextByKey,
      healthFindingsContextByKey,
      environmentSessionContextById,
      workflowRunContextById
    ),
    [activeScope, environmentSessionContextById, fetchedThisSession, reportContextByKey, executiveSummaryContextByKey, healthFindingsContextByKey, scopeNotes, workflowRunContextById]
  );

  const hydrateStartupBrief = useCallback(async ({ skipMessages = false } = {}) => {
    if (isHydratingStartupRef.current) return false;
    isHydratingStartupRef.current = true;
    setIsHydratingStartup(true);
    try {
      const stableChatId = chatIdRef.current || chatId;
      const response = await getBootstrapSafe({
        chatId: stableChatId,
        personalization: bootstrapPersonalization,
      });
      applyServerSessionState(response, { allowGoal: true, allowScope: false, allowChatId: true });
      const cards = response?.chatStartBrief?.cards || [];
      setBackendSuggestionCards(cards);
      loadedSuggestionsOnceRef.current = true;
      if (!skipMessages) {
        setMessages([]);
        initialBriefRenderedRef.current = true;
        isChatNearBottomRef.current = true;
      }
      return true;
    } catch (error) {
      if (isUnauthorizedCommandCenterError(error)) {
        loadedSuggestionsOnceRef.current = true;
        suggestionsPrefetchKeyRef.current = '__unauthorized__';
        suggestionsPrefetchAttemptAtRef.current = Date.now();
      }
      if (!skipMessages) {
        setMessages([]);
        initialBriefRenderedRef.current = true;
        isChatNearBottomRef.current = true;
      }
      return false;
    } finally {
      isHydratingStartupRef.current = false;
      setIsHydratingStartup(false);
    }
  }, [
    applyServerSessionState,
    bootstrapPersonalization,
    chatId,
    getBootstrapSafe,
    isUnauthorizedCommandCenterError,
  ]);

  const openResourcesModal = useCallback((item) => {
    const resources = Array.isArray(item?.affectedResources) ? item.affectedResources : [];
    setResourcesModal({
      open: true,
      title: item?.title || 'Affected Resources',
      resources,
    });
  }, []);

  const closeResourcesModal = useCallback(() => {
    setResourcesModal((prev) => ({ ...prev, open: false }));
  }, []);

  const loadMoreSuggestions = useCallback(async () => {
    const stableChatId = chatIdRef.current || chatId;
    if (!stableChatId) return;

    const nextPage = suggestionPage + 1;
    const { window, personalization } = getBootstrapPersonalizationForPage(nextPage);
    if (!window.startupCategories?.length) {
      toast('No more suggestions available.');
      return;
    }

    setIsSending(true);
    try {
      const action = await dispatch(
        refreshCommandCenterSuggestions({
          chatId: stableChatId,
          personalization,
          mode: 'append',
          page: nextPage,
        })
      );

      if (!refreshCommandCenterSuggestions.fulfilled.match(action)) {
        const errorPayload = action.payload || {};
        if (isUnauthorizedCommandCenterError(errorPayload)) {
          loadedSuggestionsOnceRef.current = true;
          suggestionsPrefetchKeyRef.current = '__unauthorized__';
          suggestionsPrefetchAttemptAtRef.current = Date.now();
          return;
        }
        toast.error(errorPayload.message || action.error?.message || 'Failed to load more suggestions');
        return;
      }

      const response = action.payload?.response;
      applyServerSessionState(response, { allowGoal: false, allowScope: false, allowChatId: false });
    } finally {
      setIsSending(false);
    }
  }, [
    applyServerSessionState,
    chatId,
    dispatch,
    getBootstrapPersonalizationForPage,
    isUnauthorizedCommandCenterError,
    suggestionPage,
  ]);

  const refreshStartupSuggestions = useCallback(async () => {
    const stableChatId = chatIdRef.current || chatId;
    if (!stableChatId || isRefreshingSuggestions) return;

    try {
      const { personalization } = getBootstrapPersonalizationForPage(0);
      const action = await dispatch(
        refreshCommandCenterSuggestions({
          chatId: stableChatId,
          personalization,
          mode: 'replace',
          page: 0,
        })
      );

      if (!refreshCommandCenterSuggestions.fulfilled.match(action)) {
        const errorPayload = action.payload || {};
        if (isUnauthorizedCommandCenterError(errorPayload)) {
          loadedSuggestionsOnceRef.current = true;
          suggestionsPrefetchKeyRef.current = '__unauthorized__';
          suggestionsPrefetchAttemptAtRef.current = Date.now();
          return;
        }
        toast.error(errorPayload.message || action.error?.message || 'Failed to refresh suggestions');
        return;
      }

      const response = action.payload?.response;
      applyServerSessionState(response, { allowGoal: false, allowScope: false, allowChatId: false });
      loadedSuggestionsOnceRef.current = true;
      suggestionsPrefetchKeyRef.current = '';
      suggestionsPrefetchAttemptAtRef.current = 0;
    } catch (error) {
      toast.error(error.message || 'Failed to refresh suggestions');
    }
  }, [
    applyServerSessionState,
    chatId,
    dispatch,
    getBootstrapPersonalizationForPage,
    isUnauthorizedCommandCenterError,
    isRefreshingSuggestions,
  ]);

  const handleAction = useCallback(
    async (action) => {
      if (!action?.intent || isSending) return;

      if (action.intent === 'load_more_suggestions') {
        await loadMoreSuggestions();
        return;
      }

      if (action.intent === 'review_waiting_item') {
        const payload = action.payload || {};
        const path = payload.path || '/dashboard/workflow-history';
        const appended = appendAssistantMessage({
          id: `assistant_waiting_${Date.now()}`,
          text: payload?.explanation
            ? `This run is waiting because ${payload.explanation}`
            : 'This run is waiting for your input before it can continue.',
          blocks: [{
            type: 'waiting_run_detail',
            payload: {
              title: payload.title || 'Waiting item',
              status: payload.status || null,
              runType: payload.runType || null,
              runId: payload.runId || null,
              reason: payload.reason || payload.explanation || null,
              explanation: payload.explanation || payload.reason || null,
            },
            actions: [{ label: 'Open Run', intent: 'navigate', payload: { path } }],
          }],
        });
        await persistMessagesToHistory({
          actionLabel: action.label || 'Review waiting item',
          assistantText: appended?.text || null,
        });
        return;
      }

      if (action.intent === 'navigate' && action?.payload?.path) {
        navigate(action.payload.path);
        return;
      }

      if (action.intent === 'refresh_recommendations') {
        if (refreshingRecommendations) return;

        setIsSending(true);
        try {
          const result = await dispatch(refreshRecommendationsFromScans()).unwrap();
          const successful = result?.successful || 0;
          const failed = result?.failed || 0;

          if (successful > 0) {
            toast.success(`Successfully processed ${successful} scan${successful !== 1 ? 's' : ''}`, { id: 'refresh-recommendations' });
          } else if (failed > 0) {
            toast.error(`Failed to process ${failed} scan${failed !== 1 ? 's' : ''}`, { id: 'refresh-recommendations' });
          } else {
            toast.success('No new scans to process', { id: 'refresh-recommendations' });
          }

          await dispatch(fetchAllRecommendations());
          await refreshStartupSuggestions();
          await refreshCommandCenterState({ quiet: true });
        } catch (error) {
          toast.error(`Error refreshing recommendations: ${error.message || 'Unknown error'}`, {
            id: 'refresh-recommendations',
          });
        } finally {
          setIsSending(false);
        }
        return;
      }

      if (action.intent === 'apply_recommendation') {
        const payload = action.payload || {};
        const recommendationId = payload?.recommendationId ? String(payload.recommendationId) : null;
        const recommendation = recommendationId ? recommendationLookup.get(recommendationId) : null;
        const recommendedAction = normalizeRecommendationAction(recommendation?.recommendedAction);
        const fallbackAction = normalizeRecommendationAction(recommendation?.action);
        const resolvedAction = Object.keys(recommendedAction).length > 0 ? recommendedAction : fallbackAction;
        const actionType = normalizeSmartToken(payload?.actionType || resolvedAction?.type || '');
        const platformPath = payload?.path || resolvedAction?.path || resolvedAction?.platformPath || null;

        // Match Recommendations page behavior:
        // platform actions route directly; other actions open recommendation action modal.
        if ((actionType === 'platform' || actionType === 'plaform') && platformPath) {
          navigate(platformPath);
          return;
        }

        if (actionType === 'blueprint' && recommendation) {
          setRecommendationBlueprintFlow({
            open: true,
            recommendation,
          });
          return;
        }

        navigate('/dashboard/recommendations', {
          state: recommendationId
            ? { openRecommendationId: recommendationId, openActionModal: true }
            : undefined,
        });
        return;
      }

      setIsSending(true);
      try {
        const stableChatId = chatIdRef.current || chatId;
        const payload = action.payload || {};
        const scopePayload = buildScopePayload(activeScope);
        const response = await sendCommandCenterIntent({
          chatId: stableChatId,
          intent: action.intent,
          payload,
          activeScope: scopePayload,
          sessionContext: commandCenterSessionContext,
        });

        const appended = appendAssistantMessage(response?.assistantMessage);
        if (response?.responseId) {
          setLastResponseId(response.responseId);
        }
        applyAssistantContextEffects(appended || response?.assistantMessage);
        const hadRails = applyServerSessionState(response, { allowGoal: false, allowScope: true, allowChatId: false });
        if (!hadRails) {
          await refreshCommandCenterState({ quiet: true });
        }
        await persistMessagesToHistory({
          actionLabel: action.label || action.intent,
          assistantText: appended?.text || null,
          assistantMessageMeta: appended || response?.assistantMessage || null,
          responseId: response?.responseId || null,
        });
      } catch (error) {
        toast.error(error.message || 'Failed to execute action');
      } finally {
        setIsSending(false);
      }
    },
    [activeScope, appendAssistantMessage, applyAssistantContextEffects, applyServerSessionState, chatId, commandCenterSessionContext, dispatch, isSending, loadMoreSuggestions, navigate, persistMessagesToHistory, recommendationLookup, refreshCommandCenterState, refreshStartupSuggestions, refreshingRecommendations]
  );

  useEffect(() => {
    if (permissionProfileCount > 0) {
      hasRequestedProfileRefreshRef.current = false;
      return;
    }

    if (!userProfileLoading && !hasRequestedProfileRefreshRef.current) {
      hasRequestedProfileRefreshRef.current = true;
      dispatch(refreshUserProfile());
    }
  }, [dispatch, permissionProfileCount, userProfileLoading]);

  useEffect(() => {
    if (hasRequestedOverviewRef.current) return;
    hasRequestedOverviewRef.current = true;
    dispatch(getOverviewData());
  }, [dispatch]);

  useEffect(() => {
    if (userWorkflowCount > 0) {
      hasRequestedWorkflowHistoryRef.current = false;
      return;
    }
    if (hasRequestedWorkflowHistoryRef.current) return;

    hasRequestedWorkflowHistoryRef.current = true;
    dispatch(
      getWorkflows({
        count: 50,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        monthsOffset: 0,
      })
    );
  }, [dispatch, userWorkflowCount]);

  useEffect(() => {
    if (agentHistoryCount > 0) {
      hasRequestedAgentHistoryRef.current = false;
      return;
    }
    if (hasRequestedAgentHistoryRef.current) return;

    hasRequestedAgentHistoryRef.current = true;
    dispatch(
      getAgentHistory({
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        agentType: 'agent',
        monthsOffset: 0,
      })
    );
  }, [agentHistoryCount, dispatch]);

  const handleStartNewSession = useCallback(() => {
    const nextChatId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    chatIdRef.current = nextChatId;
    currentRecordIdRef.current = null;
    lastPersistedContextRef.current = '';
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }

    setChatId(nextChatId);
    setCurrentRecordId(null);
    dispatch(setCurrentChatId(null));
    setGoal({ goalId: null, title: 'Command Center', status: 'active' });
    setScopeLimits(SCOPE_LIMITS_DEFAULT);
    setActiveScope(EMPTY_SCOPE);
    setScopeNotes('');
    setFetchedThisSession([]);
    setScopeSuggestions([]);
    setRightRailCards([]);
    setMessages([]);
    setStreamingAssistantText('');
    setShowStreamingAssistantBubble(false);
    pendingStreamingScrollMessageIdRef.current = null;
    hasPositionedStreamingReplyRef.current = false;
    setActiveToolCalls([]);
    setCompletedToolCalls([]);
    setLiveToolExecutions([]);
    setInput('');
    setLastResponseId(null);
    setSelectedEnvironmentId('');
    setSelectedWorkloadId('');
    setSelectedReportId('');
    setReportContextByKey({});
    setHealthFindingsContextByKey({});
    setWorkflowRunContextById({});
    setScopeInlineNotice('');
    setLoadingBootstrap(true);
    hasInitializedSessionRef.current = false;
    initialBriefRenderedRef.current = false;
    suggestionsPrefetchKeyRef.current = '';
    suggestionsPrefetchAttemptAtRef.current = 0;
    setActivePath(COMMAND_PATH_SUGGESTED);
    loadedSuggestionsOnceRef.current = backendSuggestionCards.length > 0;
    setHasInitializedSession(false);
  }, [backendSuggestionCards.length, dispatch]);

  const handleOpenHistorySession = useCallback(async (recordId) => {
    if (!recordId) return;
    try {
      let fetched = chatsById[recordId];
      if (!fetched?.messages || fetched.messages.length === 0) {
        fetched = await dispatch(getChatRecord({ recordId })).unwrap();
      }
      if (!fetched) return;

      const metadata = parseChatMetadata(fetched?.metadata);
      const nextChatId = fetched?.sessionId || metadata?.chatId || `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const restoredScope = normalizeScopeFromSessionContext(metadata?.sessionContext, maps);
      const restoredNotes = typeof metadata?.sessionContext?.notes === 'string'
        ? metadata.sessionContext.notes
        : '';
      const restoredFetched = Array.isArray(metadata?.sessionContext?.fetched)
        ? metadata.sessionContext.fetched.map((entry) => normalizeFetchedEntry(entry))
        : [];
      const restoredReportContext = {};
      const restoredReports = Array.isArray(metadata?.sessionContext?.reports)
        ? metadata.sessionContext.reports
        : [];
      for (const report of restoredReports) {
        const key = report?.scanId || report?.reportId || report?.id || null;
        if (!key) continue;
        restoredReportContext[key] = {
          scanId: report?.scanId || null,
          reportId: report?.reportId || null,
          title: report?.title || report?.name || null,
          permissionProfileId: report?.permissionProfileId || null,
          fileId: report?.fileId || null,
          reportDefinitionId: report?.reportDefinitionId || null,
          reportPlanId: report?.reportPlanId || null,
        };
      }
      const restoredExecutiveSummaryContext = {};
      const restoredExecutiveSummaries = Array.isArray(metadata?.sessionContext?.executiveSummaries)
        ? metadata.sessionContext.executiveSummaries
        : [];
      for (const summary of restoredExecutiveSummaries) {
        const key = `${summary?.type || 'environment'}:${summary?.id}`;
        if (!summary?.id) continue;
        restoredExecutiveSummaryContext[key] = {
          id: summary?.id || null,
          name: summary?.name || null,
          type: summary?.type || 'environment',
          summaryText: summary?.summaryText || null,
          updatedAt: summary?.updatedAt || null,
          sources: summary?.sources || null,
        };
      }
      const restoredHealthFindingsContext = {};
      const restoredHealthFindings = Array.isArray(metadata?.sessionContext?.healthFindings)
        ? metadata.sessionContext.healthFindings
        : [];
      for (const artifact of restoredHealthFindings) {
        const key = artifact?.id
          || `${artifact?.type || 'health'}:${artifact?.targetId || artifact?.workloadId || artifact?.permissionProfileId || artifact?.fileId || ''}`;
        if (!key) continue;
        restoredHealthFindingsContext[key] = {
          id: artifact?.id || key,
          reviewKind: artifact?.reviewKind || 'health',
          type: artifact?.type || null,
          targetId: artifact?.targetId || null,
          targetName: artifact?.targetName || null,
          permissionProfileId: artifact?.permissionProfileId || null,
          workloadId: artifact?.workloadId || null,
          title: artifact?.title || null,
          fileId: artifact?.fileId || null,
          loadedAt: artifact?.loadedAt || artifact?.uploadedAt || null,
        };
      }
      const restoredWorkflowRunContext = {};
      const restoredWorkflowRuns = Array.isArray(metadata?.sessionContext?.workflowRuns)
        ? metadata.sessionContext.workflowRuns
        : [];
      for (const workflowRun of restoredWorkflowRuns) {
        const normalizedWorkflowRun = normalizeWorkflowRunContext(workflowRun);
        if (!normalizedWorkflowRun?.workflowRunId) continue;
        restoredWorkflowRunContext[normalizedWorkflowRun.workflowRunId] = normalizedWorkflowRun;
      }
      const restoredMessageMeta = Array.isArray(metadata?.messageMeta) ? metadata.messageMeta : [];
      const restoredMessageMetaByIndex = new Map(
        restoredMessageMeta
          .filter((entry) => entry && typeof entry === 'object' && Number.isInteger(entry.index))
          .map((entry) => [entry.index, entry])
      );
      const restoredMessages = (fetched?.messages || []).map((entry, index) => {
        const messageMeta = restoredMessageMetaByIndex.get(index) || {};
        return {
          id: `${recordId}_${index + 1}`,
          role: entry?.role === 'user' ? 'user' : 'assistant',
          text: entry?.content || '',
          blocks: [],
          tools: Array.isArray(messageMeta?.tools) ? messageMeta.tools : [],
          toolExecutions: (Array.isArray(messageMeta?.toolExecutions) ? messageMeta.toolExecutions : [])
            .map((item) => normalizeToolExecution(item))
            .filter(Boolean),
          createdAt: Date.parse(entry?.createdAt || '') || Date.now(),
        };
      });

      chatIdRef.current = nextChatId;
      currentRecordIdRef.current = recordId;
      setChatId(nextChatId);
      setCurrentRecordId(recordId);
      dispatch(setCurrentChatId(recordId));
      setScopeInlineNotice('');
      setScopeLimits((prev) => prev || SCOPE_LIMITS_DEFAULT);
      setActiveScope(restoredScope);
      setScopeNotes(restoredNotes);
      setFetchedThisSession(restoredFetched);
      setReportContextByKey(restoredReportContext);
      setExecutiveSummaryContextByKey(restoredExecutiveSummaryContext);
      setHealthFindingsContextByKey(restoredHealthFindingsContext);
      setWorkflowRunContextById(restoredWorkflowRunContext);
      setScopeSuggestions([]);
      const hydratedMessages = restoredMessages.length > 0 ? restoredMessages : [];
      setMessages(hydratedMessages);
      setLastResponseId(metadata?.responseId || null);
      setGoal((prev) => ({
        ...prev,
        goalId: metadata?.goalId || prev.goalId,
        title: metadata?.goalTitle || prev.title,
      }));
      lastPersistedContextRef.current = JSON.stringify(
        buildCommandCenterSessionContext(
          restoredScope,
          restoredNotes,
          restoredFetched,
          restoredReportContext,
          restoredExecutiveSummaryContext,
          restoredHealthFindingsContext,
          environmentSessionContextById,
          restoredWorkflowRunContext
        )
      );

      hasInitializedSessionRef.current = true;
      initialBriefRenderedRef.current = hydratedMessages.length > 0;
      setHasInitializedSession(true);
      await refreshCommandCenterState({ quiet: true });
      if (!isLocalMode && !loadedSuggestionsOnceRef.current && backendSuggestionCards.length === 0) {
        await hydrateStartupBrief({ skipMessages: hydratedMessages.length > 0 });
      }
      setLoadingBootstrap(false);
    } catch (error) {
      setLoadingBootstrap(false);
      toast.error(error?.message || 'Failed to load chat session');
    }
  }, [backendSuggestionCards.length, chatsById, dispatch, hydrateStartupBrief, isLocalMode, maps, refreshCommandCenterState]);

  useEffect(() => {
    dispatch(listRecentChats({ limit: 20 }));
  }, [dispatch]);

  useEffect(() => {
    if (!isHistoryVisible) return;
    dispatch(listRecentChats({ limit: 50 }));
  }, [dispatch, isHistoryVisible]);

  useEffect(() => {
    if (!hasInitializedSession || !chatIdRef.current || !currentRecordIdRef.current) return;
    const serialized = JSON.stringify(commandCenterSessionContext);
    if (!serialized || serialized === lastPersistedContextRef.current) return;

    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(async () => {
      try {
        await ensureChatRecord();
        lastPersistedContextRef.current = serialized;
      } catch (error) {
        console.error('Failed to persist Command Center session context:', error);
      }
    }, 450);

    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, [commandCenterSessionContext, hasInitializedSession]);

  useEffect(() => {
    if (hasInitializedSessionRef.current || isBootstrappingSessionRef.current) return;
    isBootstrappingSessionRef.current = true;

    const initializeSession = async () => {
      try {
        const response = await getBootstrapSafe({
          chatId: chatIdRef.current,
          personalization: bootstrapPersonalization,
        });
        if (!isComponentMountedRef.current) return;

        applyServerSessionState(response, {
          allowGoal: true,
          allowScope: !hasScopeSelections(activeScopeRef.current),
          allowChatId: true,
        });

        if (!initialBriefRenderedRef.current) {
          const cachedCards = backendSuggestionCards;
          const responseCards = response?.chatStartBrief?.cards || [];
          if (!isLocalMode && cachedCards.length === 0) {
            setBackendSuggestionCards(responseCards);
          }
          loadedSuggestionsOnceRef.current = true;
          setMessages([]);
          initialBriefRenderedRef.current = true;
          isChatNearBottomRef.current = true;
        }

        hasInitializedSessionRef.current = true;
        setHasInitializedSession(true);
      } catch (error) {
        if (!isComponentMountedRef.current) return;
        if (isUnauthorizedCommandCenterError(error)) {
          loadedSuggestionsOnceRef.current = true;
          suggestionsPrefetchKeyRef.current = '__unauthorized__';
          suggestionsPrefetchAttemptAtRef.current = Date.now();
        }

        const localData = buildLocalFallbackBootstrap({
          availableEnvironments,
          availableWorkloads,
          accountScans: availableScans,
          recommendations: availableRecommendations,
          workflows: workflowRunsForCounters,
          agentHistory: agentRunsForCounters,
        });

        setGoal(localData.goal);
        setScopeLimits(localData.limits || SCOPE_LIMITS_DEFAULT);
        if (!hasScopeSelections(activeScopeRef.current)) {
          setActiveScope(normalizeScopeFromApi(localData.activeScope, maps));
        }
        setRightRailCards(localData.rightRail.cards || []);

        if (!initialBriefRenderedRef.current) {
          const cachedCards = backendSuggestionCards;
          const fallbackCards = localData.chatStartBrief?.cards || [];
          const cardsForMessage = isLocalMode ? [] : cachedCards.length > 0 ? cachedCards : fallbackCards;
          if (!isLocalMode && cardsForMessage.length > 0) {
            setBackendSuggestionCards(cardsForMessage);
          }
          setMessages([]);
          initialBriefRenderedRef.current = true;
          isChatNearBottomRef.current = true;
        }

        hasInitializedSessionRef.current = true;
        setHasInitializedSession(true);
      } finally {
        isBootstrappingSessionRef.current = false;
        if (isComponentMountedRef.current) {
          setLoadingBootstrap(false);
        }
        if (import.meta.env.DEV) {
          console.debug('[CommandCenter] initializeSession complete', {
            chatId: chatIdRef.current,
            hasInitializedSession: hasInitializedSessionRef.current,
          });
        }
      }
    };

    initializeSession();

    return undefined;
  }, [
    agentRunsForCounters,
    applyServerSessionState,
    availableEnvironments,
    availableRecommendations,
    availableScans,
    availableWorkloads,
    bootstrapPersonalization,
    getBootstrapSafe,
    isUnauthorizedCommandCenterError,
    isLocalMode,
    maps,
    workflowRunsForCounters,
  ]);

  useEffect(() => {
    if (!hasInitializedSession) return;
    refreshCommandCenterState({ quiet: true });
  }, [chatId, hasInitializedSession, refreshCommandCenterState]);

  useEffect(() => {
    if (isLocalMode) return;
    if (loadingBootstrap) return;
    if (isHydratingStartupRef.current) return;
    if (loadedSuggestionsOnceRef.current) return;
    if (backendSuggestionCards.length > 0) return;

    const sessionKey = currentRecordId || chatId || chatIdRef.current;
    if (!sessionKey) return;

    const categoryCount = (startupSuggestionWindow.startupCategories || []).length;
    const recCount = (startupSuggestionWindow.selectedRecommendations || []).length;
    if (categoryCount === 0 && recCount === 0) return;

    const categoryKey = (startupSuggestionWindow.startupCategories || []).join('|');
    const recommendationKey = (startupSuggestionWindow.selectedRecommendations || [])
      .map((item) => (typeof item === 'string' ? item : item?.id))
      .filter(Boolean)
      .join('|');
    const prefetchKey = `${sessionKey}::${categoryKey}::${recommendationKey}`;

    if (suggestionsPrefetchKeyRef.current === prefetchKey) return;
    const now = Date.now();
    if (now - suggestionsPrefetchAttemptAtRef.current < 800) return;
    suggestionsPrefetchAttemptAtRef.current = now;
    (async () => {
      const hydrated = await hydrateStartupBrief({ skipMessages: true });
      if (hydrated) {
        suggestionsPrefetchKeyRef.current = prefetchKey;
      } else {
        suggestionsPrefetchKeyRef.current = '';
      }
    })();
  }, [
    backendSuggestionCards.length,
    chatId,
    currentRecordId,
    hydrateStartupBrief,
    isLocalMode,
    loadingBootstrap,
    startupSuggestionWindow.selectedRecommendations,
    startupSuggestionWindow.startupCategories,
  ]);

  useEffect(() => {
    const root = chatScrollAreaRef.current;
    if (!root) return undefined;
    const viewport = root.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return undefined;

    const updateNearBottom = () => {
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      isChatNearBottomRef.current = distanceFromBottom <= 120;
    };

    updateNearBottom();
    viewport.addEventListener('scroll', updateNearBottom, { passive: true });
    return () => {
      viewport.removeEventListener('scroll', updateNearBottom);
    };
  }, []);

  useEffect(() => {
    if (!isChatNearBottomRef.current) return;
    const root = chatScrollAreaRef.current;
    const viewport = root?.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) {
      messagesEndRef.current?.scrollIntoView({ behavior: isSending ? 'auto' : 'smooth' });
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.id) {
      const lastNode = viewport.querySelector(`[data-message-id="${lastMessage.id}"]`);
      if (lastNode) {
        const viewportRect = viewport.getBoundingClientRect();
        const nodeRect = lastNode.getBoundingClientRect();
        const nodeTop = viewport.scrollTop + (nodeRect.top - viewportRect.top);
        viewport.scrollTo({
          top: Math.max(0, nodeTop - 16),
          behavior: isSending ? 'auto' : 'smooth',
        });
        return;
      }
    }

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: isSending ? 'auto' : 'smooth',
    });
  }, [messages, isSending]);

  useEffect(() => {
    if (!isSending || !showStreamingAssistantBubble) return;
    if (hasPositionedStreamingReplyRef.current) return;
    const messageId = pendingStreamingScrollMessageIdRef.current;
    if (!messageId) return;

    const root = chatScrollAreaRef.current;
    const viewport = root?.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    const userMessageNode = viewport.querySelector(`[data-message-id="${messageId}"]`);
    const streamingNode = viewport.querySelector('[data-streaming-assistant="true"]');
    if (!userMessageNode || !streamingNode) return;

    const viewportRect = viewport.getBoundingClientRect();
    const userRect = userMessageNode.getBoundingClientRect();
    const userTop = viewport.scrollTop + (userRect.top - viewportRect.top);
    const targetTop = Math.max(0, userTop - 16);

    viewport.scrollTo({
      top: targetTop,
      behavior: 'auto',
    });
    isChatNearBottomRef.current = false;
    hasPositionedStreamingReplyRef.current = true;
  }, [isSending, messages, showStreamingAssistantBubble]);

  const addEnvironmentById = useCallback(async (environmentId, { resetSidebarSelection = true } = {}) => {
    if (!environmentId) return false;
    const envMax = scopeLimits?.environments?.max || 3;
    if ((activeScope.environments || []).length >= envMax) {
      setScopeInlineNotice(`Environment limit reached (${envMax}). Remove one before adding another.`);
      return false;
    }

    const environment = maps.envById.get(environmentId);
    if (!environment) return false;

    const alreadyAdded = (activeScope.environments || []).some((env) => env.id === environment.id);
    if (alreadyAdded) {
      if (resetSidebarSelection) setSelectedEnvironmentId('');
      setScopeInlineNotice('Environment is already in scope.');
      return false;
    }

    const nextScope = {
      ...activeScope,
      environments: [...(activeScope.environments || []), environment],
    };

    if (resetSidebarSelection) setSelectedEnvironmentId('');
    await syncScope(nextScope, 'replace');
    return true;
  }, [activeScope, maps.envById, scopeLimits?.environments?.max, syncScope]);

  const addWorkloadById = useCallback(async (workloadId, { resetSidebarSelection = true } = {}) => {
    if (!workloadId) return false;
    const workloadMax = scopeLimits?.workloads?.max || 5;
    if ((activeScope.workloads || []).length >= workloadMax) {
      setScopeInlineNotice(`Workload limit reached (${workloadMax}). Remove one before adding another.`);
      return false;
    }

    const workload = maps.workloadById.get(workloadId);
    if (!workload) return false;

    const alreadyAdded = (activeScope.workloads || []).some((item) => item.id === workload.id);
    if (alreadyAdded) {
      if (resetSidebarSelection) setSelectedWorkloadId('');
      setScopeInlineNotice('Workload is already in scope.');
      return false;
    }

    const nextWorkloads = [...(activeScope.workloads || []), { id: workload.id, name: workload.name }];
    const nextEnvironments = [...(activeScope.environments || [])];
    const envSeen = new Set(nextEnvironments.map((env) => env.id));

    for (const envRef of workload.environments || []) {
      let envId = null;
      if (typeof envRef === 'string') {
        envId = envRef;
      } else if (envRef && typeof envRef === 'object') {
        envId = envRef.permissionProfileId || envRef.recordId || envRef.accountId || null;
      }

      if (!envId) continue;

      for (const env of availableEnvironments) {
        const matches = env.recordId === envId;
        if (!matches) continue;
        if (!envSeen.has(env.recordId)) {
          nextEnvironments.push({
            id: env.recordId,
            name: env.name || env.recordId,
            cloudProvider: env.type || env.cloudProvider || null,
          });
          envSeen.add(env.recordId);
        }
      }
    }

    const envMax = scopeLimits?.environments?.max || 3;
    if (nextEnvironments.length > envMax) {
      setScopeInlineNotice(`Adding this workload would exceed environment limit (${envMax}). Remove an environment first.`);
      return false;
    }

    const nextScope = {
      ...activeScope,
      workloads: nextWorkloads,
      environments: nextEnvironments,
    };

    if (resetSidebarSelection) setSelectedWorkloadId('');
    await syncScope(nextScope, 'replace');
    return true;
  }, [activeScope, availableEnvironments, maps.workloadById, scopeLimits?.environments?.max, scopeLimits?.workloads?.max, syncScope]);

  const addReportById = useCallback(async (reportLookupId, { resetSidebarSelection = true } = {}) => {
    if (!reportLookupId) return false;
    const reportMax = scopeLimits?.reports?.max || 3;
    if ((activeScope.reports || []).length >= reportMax) {
      setScopeInlineNotice(`Report limit reached (${reportMax}). Remove one before adding another.`);
      return false;
    }

    const report = availableReports.find(
      (item) => (buildReportEntryKey(item) || item.scanId || item.reportId) === reportLookupId
    );
    if (!report) return false;

    const reportScopeKey = buildReportEntryKey(report) || report.scanId || report.reportId;
    const alreadyAdded = (activeScope.reports || []).some((item) => {
      if (item.id && item.id === reportScopeKey) return true;
      if (
        item.scanId
        && report.scanId
        && item.scanId === report.scanId
        && item.reportId
        && report.reportId
        && item.reportId === report.reportId
      ) {
        return true;
      }
      return false;
    });
    if (alreadyAdded) {
      if (resetSidebarSelection) setSelectedReportId('');
      upsertReportPreview({
        ...report,
        id: reportScopeKey,
        name: report.title || report.reportId || report.scanId,
      });
      setScopeInlineNotice('Report is already in scope.');
      return false;
    }

    const resolvedProfile = resolvePermissionProfileForScan(report, permissionProfiles);
    const resolvedPermissionProfileId = report.permissionProfileId || resolvedProfile.permissionProfileId || null;
    const shouldAddEnvironment = !!resolvedPermissionProfileId
      && !(activeScope.environments || []).some((env) => env.id === resolvedPermissionProfileId);
    const envMax = scopeLimits?.environments?.max || 3;
    if (shouldAddEnvironment && (activeScope.environments || []).length >= envMax) {
      setScopeInlineNotice(`Adding this report would exceed environment limit (${envMax}). Remove an environment first.`);
      return false;
    }

    setLoadingReportSelection({
      key: reportScopeKey,
      name: report.title || report.reportId || report.scanId || 'Report',
    });
    try {
      const selectedEnv = (activeScope.environments || [])[0] || null;
      const prepared = await prepareReportFile({
        scanId: report.scanId,
        reportId: report.reportId,
        permissionProfileId: resolvedPermissionProfileId || selectedEnv?.id || undefined,
      });

      const resolvedEnvironment = resolvedPermissionProfileId ? maps.envById.get(resolvedPermissionProfileId) : null;
      const nextEnvironments = shouldAddEnvironment && resolvedEnvironment
        ? [
          ...(activeScope.environments || []),
          {
            id: resolvedEnvironment.id,
            name: resolvedEnvironment.name,
            cloudProvider: resolvedEnvironment.cloudProvider || null,
          },
        ]
        : (activeScope.environments || []);
      const resolvedEnvironmentName = resolvedEnvironment?.name || report.environmentName || resolvedProfile.name || '—';
      const previewReport = {
        ...report,
        id: reportScopeKey,
        name: prepared?.title || report.title || report.reportId || report.scanId,
        scanId: prepared?.scanId || report.scanId || null,
        reportId: prepared?.reportId || report.reportId || null,
        permissionProfileId: prepared?.permissionProfileId || resolvedPermissionProfileId || null,
        fileId: prepared?.fileId || null,
        reportDefinitionId: prepared?.reportDefinitionId || null,
        reportPlanId: prepared?.reportPlanId || null,
        environmentName: resolvedEnvironmentName,
        updatedAt: report.updatedAt || report.lastUpdateTime || report.latestAssessmentDate || null,
        assessmentResultsUrl: prepared?.assessmentResultsUrl || report.assessmentResultsUrl || null,
        details: prepared?.details || report.details || null,
        summary: prepared?.summary || report.summary || null,
      };
      const nextScope = {
        ...activeScope,
        environments: nextEnvironments,
        reports: [
          ...(activeScope.reports || []),
          {
            id: reportScopeKey,
            name: previewReport.name,
            scanId: previewReport.scanId,
            reportId: previewReport.reportId,
            permissionProfileId: previewReport.permissionProfileId,
            fileId: previewReport.fileId || null,
            reportDefinitionId: previewReport.reportDefinitionId || null,
            reportPlanId: previewReport.reportPlanId || null,
          },
        ],
      };

      if (resetSidebarSelection) setSelectedReportId('');
      await syncScope(nextScope, 'replace');
      setReportContextByKey((prev) => ({
        ...prev,
        [reportScopeKey]: {
          scanId: previewReport.scanId,
          reportId: previewReport.reportId,
          title: previewReport.name,
          permissionProfileId: previewReport.permissionProfileId,
          fileId: previewReport.fileId || null,
          reportDefinitionId: previewReport.reportDefinitionId || null,
          reportPlanId: previewReport.reportPlanId || null,
        },
      }));
      upsertReportPreview(previewReport);
      setScopeInlineNotice('');
      addFetchedEntries([{
        type: 'report_loaded',
        label: `Loaded report ${prepared?.title || report.title || report.reportId || report.scanId}`,
        timestamp: new Date().toISOString(),
      }]);
      toast.success('Report added to scope');
      return true;
    } catch (error) {
      toast.error(error.message || 'Failed to load report context');
      return false;
    } finally {
      setLoadingReportSelection((previous) => {
        if (!previous) return null;
        return previous.key === reportScopeKey ? null : previous;
      });
    }
  }, [activeScope, addFetchedEntries, availableReports, maps.envById, permissionProfiles, scopeLimits?.environments?.max, scopeLimits?.reports?.max, syncScope, upsertReportPreview]);

  const addEnvironment = useCallback(async () => {
    await addEnvironmentById(selectedEnvironmentId, { resetSidebarSelection: true });
  }, [addEnvironmentById, selectedEnvironmentId]);

  const addWorkload = useCallback(async () => {
    await addWorkloadById(selectedWorkloadId, { resetSidebarSelection: true });
  }, [addWorkloadById, selectedWorkloadId]);

  const addReport = useCallback(async () => {
    await addReportById(selectedReportId, { resetSidebarSelection: true });
  }, [addReportById, selectedReportId]);

  const removeScopeItem = useCallback(
    async (type, id) => {
      if (type === 'reports') {
        setReportContextByKey((prev) => {
          const next = { ...(prev || {}) };
          delete next[id];
          return next;
        });
      }
      const nextScope = {
        ...activeScope,
        [type]: (activeScope[type] || []).filter((item) => item.id !== id),
      };
      setScopeInlineNotice('');
      await syncScope(nextScope, 'replace');
    },
    [activeScope, syncScope]
  );

  const mergeScopeById = useCallback((base = [], incoming = []) => {
    const out = [...base];
    const seen = new Set(out.map((item) => item.id));
    for (const item of incoming) {
      if (!item?.id || seen.has(item.id)) continue;
      out.push(item);
      seen.add(item.id);
    }
    return out;
  }, []);

  function addFetchedEntries(entries = []) {
    if (!Array.isArray(entries) || entries.length === 0) return;
    setFetchedThisSession((prev) => {
      const next = [...(prev || [])];
      const seen = new Set(next.map((entry) => `${entry.type || 'fetched'}::${entry.label || ''}`));
      for (const rawEntry of entries) {
        const entry = normalizeFetchedEntry(rawEntry);
        const dedupeKey = `${entry.type || 'fetched'}::${entry.label || ''}`;
        if (seen.has(dedupeKey)) continue;
        next.push(entry);
        seen.add(dedupeKey);
      }
      return next.slice(-50);
    });
  }

  function addFetchedFromTools(tools = []) {
    const mappedEntries = (Array.isArray(tools) ? tools : [])
      .filter(Boolean)
      .map((toolName) => ({
        type: 'tool',
        label: getToolStatusLabel(toolName),
        timestamp: new Date().toISOString(),
      }));
    addFetchedEntries(mappedEntries);
  }

  const buildScopeSuggestion = useCallback((patch, notice = null) => {
    const patchScope = normalizeScopeFromSessionContext(patch, maps);
    const envCount = (patchScope.environments || []).length;
    const workloadCount = (patchScope.workloads || []).length;
    const reportCount = (patchScope.reports || []).length;
    if (!envCount && !workloadCount && !reportCount) return null;

    const signature = JSON.stringify({
      environments: (patchScope.environments || []).map((item) => item.id).sort(),
      workloads: (patchScope.workloads || []).map((item) => item.id).sort(),
      reports: (patchScope.reports || []).map((item) => item.id).sort(),
    });
    const summaryParts = [];
    if (envCount) summaryParts.push(`${envCount} environment${envCount === 1 ? '' : 's'}`);
    if (workloadCount) summaryParts.push(`${workloadCount} workload${workloadCount === 1 ? '' : 's'}`);
    if (reportCount) summaryParts.push(`${reportCount} report${reportCount === 1 ? '' : 's'}`);

    return {
      id: `scope_suggestion_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      signature,
      patch,
      patchScope,
      notice: notice || 'CloudAgent suggested a scope update.',
      summary: summaryParts.join(', '),
      createdAt: Date.now(),
    };
  }, [maps]);

  const queueScopeSuggestion = useCallback((suggestion) => {
    if (!suggestion) return;
    setScopeSuggestions((prev) => {
      if ((prev || []).some((item) => item.signature === suggestion.signature)) return prev;
      return [suggestion, ...(prev || [])].slice(0, 8);
    });
  }, []);

  const applyScopeSuggestion = useCallback(async (suggestionId) => {
    const suggestion = (scopeSuggestions || []).find((item) => item.id === suggestionId);
    if (!suggestion) return;

    const mergedScope = {
      environments: mergeScopeById(activeScope.environments || [], suggestion.patchScope.environments || []),
      workloads: mergeScopeById(activeScope.workloads || [], suggestion.patchScope.workloads || []),
      reports: mergeScopeById(activeScope.reports || [], suggestion.patchScope.reports || []),
    };

    try {
      await syncScope(mergedScope, 'replace');
      setScopeSuggestions((prev) => (prev || []).filter((item) => item.id !== suggestionId));
      setScopeInlineNotice('Suggested scope update applied.');
    } catch (error) {
      toast.error(error?.message || 'Failed to apply suggested scope update');
    }
  }, [activeScope.environments, activeScope.reports, activeScope.workloads, mergeScopeById, scopeSuggestions, syncScope]);

  const dismissScopeSuggestion = useCallback((suggestionId) => {
    setScopeSuggestions((prev) => (prev || []).filter((item) => item.id !== suggestionId));
  }, []);

  function applyAssistantContextEffects(assistantMessage) {
    if (!assistantMessage || typeof assistantMessage !== 'object') return;
    const rawEvents = Array.isArray(assistantMessage.contextEvents) ? assistantMessage.contextEvents : [];
    const fallbackSuggestion = assistantMessage?.suggestedScopePatch
      ? [{ mode: 'suggest', patch: assistantMessage.suggestedScopePatch }]
      : [];
    const events = rawEvents.length > 0 ? rawEvents : fallbackSuggestion;

    if (events.length === 0) {
      addFetchedFromTools(assistantMessage.tools || []);
      return;
    }

    for (const rawEvent of events) {
      const normalized = normalizeContextEventPayload(rawEvent);
      if (!normalized?.patch) continue;

      if (typeof normalized.patch.notes === 'string' && normalized.mode === 'apply') {
        setScopeNotes(normalized.patch.notes);
      }

      if (Array.isArray(normalized.patch.fetched) && normalized.patch.fetched.length > 0) {
        addFetchedEntries(normalized.patch.fetched);
      }

      if (normalized.mode === 'apply' && Array.isArray(normalized.patch.reports) && normalized.patch.reports.length > 0) {
        setReportContextByKey((prev) => {
          const next = { ...(prev || {}) };
          for (const report of normalized.patch.reports) {
            const key = getSessionReportContextKey(report);
            if (!key) continue;
            next[key] = {
              ...(next[key] || {}),
              scanId: report?.scanId || next[key]?.scanId || null,
              reportId: report?.reportId || next[key]?.reportId || null,
              title: report?.title || report?.name || next[key]?.title || null,
              permissionProfileId: report?.permissionProfileId || next[key]?.permissionProfileId || null,
              fileId: report?.fileId || next[key]?.fileId || null,
              reportDefinitionId: report?.reportDefinitionId || next[key]?.reportDefinitionId || null,
              reportPlanId: report?.reportPlanId || next[key]?.reportPlanId || null,
            };
          }
          return next;
        });
      }

      if (normalized.mode === 'apply' && Array.isArray(normalized.patch.executiveSummaries) && normalized.patch.executiveSummaries.length > 0) {
        setExecutiveSummaryContextByKey((prev) => {
          const next = { ...(prev || {}) };
          for (const summary of normalized.patch.executiveSummaries) {
            const key = getExecutiveSummaryContextKey(summary);
            if (!key) continue;
            next[key] = {
              ...(next[key] || {}),
              type: summary?.type || next[key]?.type || 'environment',
              id: summary?.id || next[key]?.id || null,
              name: summary?.name || next[key]?.name || null,
              summaryText: summary?.summaryText || next[key]?.summaryText || null,
              updatedAt: summary?.updatedAt || next[key]?.updatedAt || null,
              sources: summary?.sources || next[key]?.sources || null,
            };
          }
          return next;
        });
      }

      if (normalized.mode === 'apply' && Array.isArray(normalized.patch.healthFindings) && normalized.patch.healthFindings.length > 0) {
        setHealthFindingsContextByKey((prev) => {
          const next = { ...(prev || {}) };
          for (const finding of normalized.patch.healthFindings) {
            const key = getHealthFindingContextKey(finding);
            if (!key) continue;
            next[key] = {
              ...(next[key] || {}),
              id: finding?.id || next[key]?.id || key,
              reviewKind: finding?.reviewKind || next[key]?.reviewKind || 'health',
              type: finding?.type || next[key]?.type || null,
              targetId: finding?.targetId || next[key]?.targetId || null,
              targetName: finding?.targetName || next[key]?.targetName || null,
              permissionProfileId: finding?.permissionProfileId || next[key]?.permissionProfileId || null,
              workloadId: finding?.workloadId || next[key]?.workloadId || null,
              title: finding?.title || next[key]?.title || null,
              fileId: finding?.fileId || next[key]?.fileId || null,
              loadedAt: finding?.loadedAt || finding?.uploadedAt || next[key]?.loadedAt || null,
            };
          }
          return next;
        });
      }

      const suggestion = buildScopeSuggestion(normalized.patch, normalized.notice);
      if (suggestion) {
        queueScopeSuggestion(suggestion);
      }
    }

    addFetchedFromTools(assistantMessage.tools || []);
  }

  const sendMessageText = useCallback(async (rawText, options = {}) => {
    const text = typeof rawText === 'string' ? rawText.trim() : '';
    const {
      clearComposer = false,
      sessionContextOverride = null,
      visibleUserText = null,
      activeScopeOverride = null,
    } = options;
    if (!text || isSending) return;
    const stableChatId = chatIdRef.current || chatId;
    const effectiveScope = activeScopeOverride && typeof activeScopeOverride === 'object'
      ? activeScopeOverride
      : (activeScopeRef.current || activeScope);
    const baseSessionContext = activeScopeOverride && typeof activeScopeOverride === 'object'
      ? buildCommandCenterSessionContext(
          effectiveScope,
          scopeNotesRef.current,
          fetchedThisSession,
          reportContextByKey,
          executiveSummaryContextByKey,
          healthFindingsContextByKey,
          environmentSessionContextById,
          workflowRunContextById
        )
      : commandCenterSessionContext;
    const effectiveSessionContext = sessionContextOverride && typeof sessionContextOverride === 'object'
      ? { ...baseSessionContext, ...sessionContextOverride }
      : baseSessionContext;
    const renderedUserText = typeof visibleUserText === 'string' && visibleUserText.trim()
      ? visibleUserText.trim()
      : text;

    analytics.track(ANALYTICS_EVENTS.COMMAND_CENTER_MESSAGE_SENT, {
      route: getAnalyticsRoute(),
    });
    commandCenterMessageCountRef.current += 1;

    const userMessage = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      text: renderedUserText,
      blocks: [],
      tools: [],
      createdAt: Date.now(),
    };

    pendingStreamingScrollMessageIdRef.current = userMessage.id;
    hasPositionedStreamingReplyRef.current = false;
    isChatNearBottomRef.current = false;
    setQueuedRoutePromptPreview(null);
    setMessages((prev) => [...prev, userMessage]);
    if (clearComposer) {
      setInput('');
    }
    setStreamingAssistantText('');
    setShowStreamingAssistantBubble(true);
    setActiveToolCalls([]);
    setCompletedToolCalls([]);
    setLiveToolExecutions([]);
    setIsSending(true);

    const scopePayload = buildScopePayload(effectiveScope);

    try {
      const response = await sendCommandCenterMessage(
        {
          chatId: stableChatId,
          goalId: goal?.goalId || undefined,
          message: text,
          activeScope: scopePayload,
          previousResponseId: lastResponseId || undefined,
          sessionContext: effectiveSessionContext,
        },
        {
          onToken: (nextText) => {
            setStreamingAssistantText(typeof nextText === 'string' ? nextText : '');
          },
          onContextUpdate: (event) => {
            if (!event || typeof event !== 'object') return;
            if (String(event.type || event.eventType || '').trim().toLowerCase() !== 'tool_execution') return;
            setLiveToolExecutions((prev) => upsertLiveToolExecution(prev, {
              name: event.sourceTool || event.tool || event.name || 'tool',
              input: event.input ?? null,
              output: event.output ?? event.result ?? null,
              status: 'completed',
            }, 'completed'));
          },
          onToolCall: (toolEvent) => {
            const toolName = getToolEventName(toolEvent);
            setActiveToolCalls((prev) => [...prev, toolName]);
            setLiveToolExecutions((prev) => upsertLiveToolExecution(prev, toolEvent, 'in_progress'));
          },
          onToolResult: (toolEvent) => {
            const toolName = getToolEventName(toolEvent);
            setActiveToolCalls((prev) => {
              const index = prev.indexOf(toolName);
              if (index === -1) return prev;
              return prev.filter((_, itemIndex) => itemIndex !== index);
            });
            setCompletedToolCalls((prev) => [...prev, toolName]);
            setLiveToolExecutions((prev) => upsertLiveToolExecution(prev, toolEvent, 'completed'));
          },
        }
      );

      if (response?.responseId) {
        setLastResponseId(response.responseId);
      }
      const appended = appendAssistantMessage(response?.assistantMessage);
      setShowStreamingAssistantBubble(false);
      setStreamingAssistantText('');
      pendingStreamingScrollMessageIdRef.current = null;
      hasPositionedStreamingReplyRef.current = false;
      applyAssistantContextEffects(appended || response?.assistantMessage);
      const hadRails = applyServerSessionState(response, { allowGoal: false, allowScope: true, allowChatId: false });
      if (!hadRails) {
        await refreshCommandCenterState({ quiet: true });
      }
      await persistMessagesToHistory({
        userText: renderedUserText,
        assistantText: appended?.text || null,
        assistantMessageMeta: appended || response?.assistantMessage || null,
        responseId: response?.responseId || null,
      });
    } catch (error) {
      try {
        const fallback = await sendChatMessage(
          {
            sessionId: stableChatId,
            message: text,
            previousResponseId: lastResponseId,
            sessionContext: effectiveSessionContext,
          },
          {
            onToken: (nextText) => {
              setStreamingAssistantText(typeof nextText === 'string' ? nextText : '');
            },
            onContextUpdate: (event) => {
              if (!event || typeof event !== 'object') return;
              if (String(event.type || event.eventType || '').trim().toLowerCase() !== 'tool_execution') return;
              setLiveToolExecutions((prev) => upsertLiveToolExecution(prev, {
                name: event.sourceTool || event.tool || event.name || 'tool',
                input: event.input ?? null,
                output: event.output ?? event.result ?? null,
                status: 'completed',
              }, 'completed'));
            },
            onToolCall: (toolEvent) => {
              const toolName = getToolEventName(toolEvent);
              setActiveToolCalls((prev) => [...prev, toolName]);
              setLiveToolExecutions((prev) => upsertLiveToolExecution(prev, toolEvent, 'in_progress'));
            },
            onToolResult: (toolEvent) => {
              const toolName = getToolEventName(toolEvent);
              setActiveToolCalls((prev) => {
                const index = prev.indexOf(toolName);
                if (index === -1) return prev;
                return prev.filter((_, itemIndex) => itemIndex !== index);
              });
              setCompletedToolCalls((prev) => [...prev, toolName]);
              setLiveToolExecutions((prev) => upsertLiveToolExecution(prev, toolEvent, 'completed'));
            },
          }
        );

        if (fallback?.responseId) {
          setLastResponseId(fallback.responseId);
        }

        const appended = appendAssistantMessage({
          id: `assistant_fallback_${Date.now()}`,
          text: fallback?.message || 'Request completed via fallback chat endpoint.',
          blocks: [],
        });
        setShowStreamingAssistantBubble(false);
        setStreamingAssistantText('');
        pendingStreamingScrollMessageIdRef.current = null;
        hasPositionedStreamingReplyRef.current = false;
        await refreshCommandCenterState({ quiet: true });
        await persistMessagesToHistory({
          userText: renderedUserText,
          assistantText: appended?.text || null,
          responseId: fallback?.responseId || null,
        });
      } catch (fallbackError) {
        const appended = appendAssistantMessage({
          id: `assistant_error_${Date.now()}`,
          text: fallbackError?.message || error?.message || 'Failed to process message.',
          blocks: [],
        });
        setShowStreamingAssistantBubble(false);
        setStreamingAssistantText('');
        pendingStreamingScrollMessageIdRef.current = null;
        hasPositionedStreamingReplyRef.current = false;
        await persistMessagesToHistory({
          userText: renderedUserText,
          assistantText: appended?.text || null,
        });
      }
    } finally {
      setShowStreamingAssistantBubble(false);
      setStreamingAssistantText('');
      pendingStreamingScrollMessageIdRef.current = null;
      hasPositionedStreamingReplyRef.current = false;
      setActiveToolCalls([]);
      setCompletedToolCalls([]);
      setLiveToolExecutions([]);
      setIsSending(false);
    }
  }, [activeScope, appendAssistantMessage, applyAssistantContextEffects, applyServerSessionState, chatId, commandCenterSessionContext, executiveSummaryContextByKey, fetchedThisSession, healthFindingsContextByKey, isSending, lastResponseId, persistMessagesToHistory, refreshCommandCenterState, reportContextByKey, workflowRunContextById]);

  useEffect(() => {
    if (!pendingRoutePrompt) return;
    if (loadingBootstrap || !hasInitializedSession || isSending) return;

    const promptToSend = pendingRoutePrompt;
    setPendingRoutePrompt((current) => (
      current?.key === promptToSend.key ? null : current
    ));

    const run = async () => {
      try {
        await sendMessageText(promptToSend.prompt, {
          clearComposer: false,
          visibleUserText: promptToSend.visibleUserText,
          activeScopeOverride: promptToSend.activeScopeOverride,
          sessionContextOverride: promptToSend.sessionContextOverride,
        });
      } catch (error) {
        console.error('Failed to send preloaded Command Center prompt:', error);
      }
    };

    run();
  }, [hasInitializedSession, isSending, loadingBootstrap, pendingRoutePrompt, sendMessageText]);

  const handleSend = useCallback(async () => {
    await sendMessageText(input, { clearComposer: true });
  }, [input, sendMessageText]);

  const handlePathChange = useCallback((nextPath) => {
    setActivePath(nextPath);
    if (nextPath !== COMMAND_PATH_SUGGESTED) return;
    if (loadingBootstrap || isHydratingStartupRef.current) return;
    if (loadedSuggestionsOnceRef.current) return;
    if (backendSuggestionCards.length > 0) return;
    hydrateStartupBrief({ skipMessages: true });
  }, [backendSuggestionCards.length, hydrateStartupBrief, loadingBootstrap]);

  const handleSkipToChat = useCallback(() => {
    setActivePath(COMMAND_PATH_CUSTOM);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ block: 'nearest' });
    });
  }, []);

  // Path panel handlers - accept ID directly for clickable chips
  const handleModeAddEnvironment = useCallback(async (envId) => {
    if (!envId) return;
    await addEnvironmentById(envId, { resetSidebarSelection: false });
  }, [addEnvironmentById]);

  const handleModeAddWorkload = useCallback(async (workloadId) => {
    if (!workloadId) return;
    await addWorkloadById(workloadId, { resetSidebarSelection: false });
  }, [addWorkloadById]);

  const handleModeAddReport = useCallback(async (reportId) => {
    if (!reportId) return;
    await addReportById(reportId, { resetSidebarSelection: false });
  }, [addReportById]);

  const handleModeCreateWorkload = useCallback(() => {
    navigate('/dashboard/workloads', { state: { openWorkloadWizard: true } });
  }, [navigate]);

  const handleModeCreateEnvironment = useCallback(() => {
    navigate('/settings/environments');
  }, [navigate]);

  const handleRunSuggestedReport = useCallback((report) => {
    if (!report?.reportPlanId) {
      toast.error('No report plan found for this recommendation.');
      return;
    }
    const recommendationState = {
      fromRecommendation: {
        source: 'command_center',
        recommendationRecordId: report.recordId || null,
        recommendationId: report.id,
        recordKey:
          report.recordId ? `RECOMMENDATION#${report.recordId}` : null,
        planId: report.reportPlanId,
        reportId: report.reportPlanId,
        sourceBlueprintId: report.reportPlanId,
      },
    };
    if (IS_PUBLIC_SITE && !isLocalRuntime()) {
      navigate(`/library/report/${report.reportPlanId}`, { state: recommendationState });
    } else {
      navigate('/dashboard/reports/library', {
        state: {
          ...recommendationState,
          autoOpenReportId: report.reportPlanId,
        },
      });
    }
  }, [navigate]);

  const handleDirectRefreshCheck = useCallback(async (selection) => {
    if (!selection || isSending) return;

    const reviewKind = selection.reviewKind === 'cost' ? 'cost' : 'health';
    const type = selection.type === 'environment' ? 'environment' : 'workload';
    const id = String(selection.id || '').trim();
    if (!id) return;

    const getErrorMessage = (error, fallback) => (
      typeof error === 'string' ? error : error?.message || fallback
    );

    try {
      if (reviewKind === 'cost') {
        if (type !== 'environment') {
          toast.error('Cost refresh is available for environments only.');
          return;
        }
        const environment = maps.envById.get(id);
        const permissionProfile = permissionProfiles.find((profile) => getProfileRecordId(profile) === id);
        const targets = getAzureCostRefreshTargets(environment || permissionProfile, permissionProfiles);
        await dispatch(
          launchEnvironmentCostScans({
            targets: targets.length > 0
              ? targets
              : [{ permissionProfileId: id, cloudProvider: getCostCloudProvider(environment || permissionProfile) }],
            forceRefresh: true,
          })
        ).unwrap();
        toast.success('Cost analysis started.');
        return;
      }

      await dispatch(
        launchHealthScans({
          ...(type === 'environment' ? { permissionProfileId: id } : { workloadId: id }),
          forceRefresh: true,
        })
      ).unwrap();

      toast.success('Health check started.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to run refresh.'));
    }
  }, [dispatch, isSending, maps.envById, permissionProfiles]);

  const handleModeRunHealthCheck = useCallback(async (selection) => {
    if (!selection || isSending) return;
    const reviewKind = selection.reviewKind === 'cost' ? 'cost' : 'health';
    const type = selection.type === 'environment' ? 'environment' : 'workload';
    const id = String(selection.id || '').trim();
    if (!id) return;
    if (reviewKind === 'cost' && type !== 'environment') {
      toast.error('Cost reviews are available for environments only.');
      return;
    }

    let targetName = id;
    let findings = null;
    let permissionProfileId = null;
    let workloadId = null;
    let activeScopeOverride = null;

    if (type === 'workload') {
      const workload = maps.workloadById.get(id);
      if (!workload) return;
      targetName = workload.name || id;
      workloadId = id;

      const alreadyInScope = (activeScope.workloads || []).some((item) => item.id === workload.id);
      if (!alreadyInScope) {
        const added = await addWorkloadById(id, { resetSidebarSelection: false });
        if (!added) return;
      }

      findings = workloadHealthById?.[id]?.findings || null;
    } else {
      const environment = maps.envById.get(id);
      const permissionProfile = permissionProfiles.find((profile) => profile.recordId === id);
      if (!environment && !permissionProfile) return;
      targetName = environment?.name || id;
      permissionProfileId = id;
      const scopedEnvironment = {
        id,
        name: environment?.name || permissionProfile?.name || id,
        cloudProvider: environment?.cloudProvider || permissionProfile?.type || null,
      };

      const scopeSnapshot = activeScopeRef.current || activeScope;
      const alreadyInScope = (scopeSnapshot.environments || []).some((item) => item.id === id);
      if (!alreadyInScope) {
        const added = await addEnvironmentById(id, { resetSidebarSelection: false });
        if (!added) return;
      }
      const refreshedScope = activeScopeRef.current || scopeSnapshot;
      const currentScopedEnvironments = Array.isArray(refreshedScope.environments) ? refreshedScope.environments : [];
      const hasScopedEnvironment = currentScopedEnvironments.some((item) => item.id === id);
      activeScopeOverride = hasScopedEnvironment
        ? { ...refreshedScope }
        : {
            ...refreshedScope,
            environments: [...currentScopedEnvironments, scopedEnvironment],
          };

      if (reviewKind !== 'cost') {
        const cachedResponse = environmentHealthResultsById?.[id] || await fetchEnvironmentHealth(id);
        if (cachedResponse && typeof cachedResponse === 'object') {
          const resources = Array.isArray(cachedResponse.resources) ? cachedResponse.resources : [];
          const stats = summarizeHealthResources(resources);
          findings = {
            type: 'environment',
            permissionProfileId: id,
            environmentName: targetName,
            generatedAt: cachedResponse.generatedAt || stats.latestGeneratedAt || null,
            version: cachedResponse.version || null,
            cache: cachedResponse?.output?.cache || null,
            resources: resources.map(serializeHealthResource).filter(Boolean),
          };
        } else {
          findings = environmentHealthById?.[id]?.findings || null;
        }
      }
    }

    const findingsForUpload = reviewKind === 'cost'
      ? undefined
      : findings || {
          type,
          id,
          name: targetName,
          resources: [],
        };

    try {
      const prepared = await prepareHealthFindingsFile({
        findings: findingsForUpload,
        reviewKind,
        targetType: type,
        targetId: id,
        targetName,
        permissionProfileId: permissionProfileId || undefined,
        workloadId: workloadId || undefined,
      });

      if (!prepared?.fileId) {
        throw new Error('Review data upload succeeded but no fileId was returned');
      }

      const contextKey = `${reviewKind}:${type}:${id}`;
      const reviewEntry = {
        id: prepared.id || contextKey,
        reviewKind,
        type,
        targetId: id,
        targetName,
        permissionProfileId: permissionProfileId || null,
        workloadId: workloadId || null,
        title: prepared.title || (reviewKind === 'cost' ? `Cost data for ${targetName}` : `Health findings for ${targetName}`),
        fileId: prepared.fileId,
        loadedAt: prepared.uploadedAt || new Date().toISOString(),
      };

      const nextHealthFindingsContextByKey = {
        ...(healthFindingsContextByKey || {}),
        [contextKey]: reviewEntry,
      };
      setHealthFindingsContextByKey(nextHealthFindingsContextByKey);

      addFetchedEntries([{
        type: reviewKind === 'cost' ? 'cost_review_loaded' : 'health_findings_loaded',
        label: reviewKind === 'cost'
          ? `Loaded cost data for ${targetName}`
          : `Loaded health findings for ${targetName}`,
        timestamp: new Date().toISOString(),
      }]);

      const analysisPrompt = reviewKind === 'cost'
        ? [
            `The user uploaded AWS cost data for "${targetName}".`,
            'Use code_interpreter when analysis is requested.',
            'File structure note: root has { artifactType, reviewKind, createdAt, target, findings }.',
            'Navigate with data["findings"] first, then use findings.statusCounts, findings.checks, and findings.data.',
            'For check drill-down, each check.details.dataPath points to a section inside findings.data.',
            'Do NOT summarize yet. Briefly confirm upload and ask what the user wants to review (e.g., spend trends, anomalies, or optimization opportunities).',
          ].join('\n')
        : [
            `The user uploaded ${type} health findings for "${targetName}".`,
            'Use code_interpreter when analysis is requested.',
            'File structure note: root has { artifactType, reviewKind, createdAt, target, findings }.',
            'Navigate with data["findings"] first, then data["findings"]["resources"] (array).',
            'Each resource includes checks[] and errors[]; each check includes status, checkName, summary, and details.',
            'Do NOT summarize yet. Briefly confirm upload and ask what the user wants to focus on.',
          ].join('\n');

      const visibleUserText = reviewKind === 'cost'
        ? `Uploaded cost data for analysis: ${targetName}. Ask me anything about spend, anomalies, checks, or optimization opportunities.`
        : `Uploaded health checks data for analysis: ${targetName}. Ask me anything about the findings.`;

      await sendMessageText(
        analysisPrompt,
        {
          clearComposer: false,
          sessionContextOverride: {
            healthFindings: Object.values(nextHealthFindingsContextByKey),
          },
          visibleUserText,
          activeScopeOverride: activeScopeOverride || undefined,
        }
      );
    } catch (error) {
      console.error('Failed to prepare review data file for chat:', error);
      if (reviewKind === 'cost') {
        toast.error(error?.message || 'Failed to upload cost data file.');
        return;
      }

      const findingsJson = JSON.stringify(findingsForUpload, null, 2);
      const shouldTruncate = findingsJson.length > MAX_HEALTH_FINDINGS_MESSAGE_CHARS;
      const findingsPayloadForChat = shouldTruncate
        ? `${findingsJson.slice(0, MAX_HEALTH_FINDINGS_MESSAGE_CHARS)}\n... (truncated)`
        : findingsJson;

      toast.error(error?.message || 'Failed to upload health findings file; using inline fallback.');
      await sendMessageText(
        [
          `Please summarize these ${type} health findings for "${targetName}".`,
          'Call out the highest-risk issues first, explain likely impact, and suggest the next actions.',
          '',
          '```json',
          findingsPayloadForChat,
          '```',
          shouldTruncate ? 'Note: The findings JSON was truncated because upload failed.' : '',
        ].filter(Boolean).join('\n'),
        { clearComposer: false }
      );
    }
  }, [
    activeScope.environments,
    activeScope.workloads,
    addFetchedEntries,
    addEnvironmentById,
    addWorkloadById,
    environmentHealthById,
    environmentHealthResultsById,
    fetchEnvironmentHealth,
    healthFindingsContextByKey,
    isSending,
    maps.envById,
    maps.workloadById,
    permissionProfiles,
    sendMessageText,
    workloadHealthById,
  ]);

  const handleModeViewExecutiveSummary = useCallback(async (type, id) => {
    if (!id || isSending) return;
    
    const contextKey = `${type}:${id}`;
    
    if (type === 'environment') {
      const env = maps.envById.get(id);
      const fullEnvData = permissionProfiles.find((p) => p.recordId === id);
      if (!env && !fullEnvData) return;
      
      const envName = env?.name || fullEnvData?.name || id;
      
      const alreadyInScope = (activeScope.environments || []).some((item) => item.id === id);
      if (!alreadyInScope) {
        const added = await addEnvironmentById(id, { resetSidebarSelection: false });
        if (!added) return;
      }

      try {
        const action = await dispatch(
          ensureExecutiveSummary({
            type: 'environment',
            id,
            item: fullEnvData || env,
          })
        );

        if (!ensureExecutiveSummary.fulfilled.match(action)) {
          throw new Error(
            action.payload || action.error?.message || 'Failed to load executive summary'
          );
        }

        const summaryData =
          action.payload?.summary ||
          executiveSummaryRecordsByKey?.[contextKey]?.summary ||
          null;

        if (summaryData?.summaryText) {
          const previewData = {
            type: 'environment',
            id,
            recordId: id,
            name: envName,
            summary: summaryData,
            item: fullEnvData || env,
          };
          
          upsertExecutiveSummaryPreview(previewData);
          
          setExecutiveSummaryContextByKey((prev) => ({
            ...prev,
            [contextKey]: {
              id,
              name: envName,
              type: 'environment',
              summaryText: summaryData.summaryText,
              updatedAt: summaryData.updatedAt || null,
              sources: summaryData.sources || null,
            },
          }));
          
          addFetchedEntries([{
            type: 'executive_summary_loaded',
            label: `Loaded executive summary for ${envName}`,
            timestamp: new Date().toISOString(),
          }]);
          
          toast.success(`Executive summary loaded for ${envName}`);
        } else {
          toast.error('No executive summary available for this environment');
        }
      } catch (error) {
        console.error('Failed to load executive summary:', error);
        toast.error(error.message || 'Failed to load executive summary');
      }
    } else if (type === 'workload') {
      const workload = maps.workloadById.get(id);
      const fullWorkloadData = availableWorkloads.find((w) => w.workloadId === id);
      if (!workload && !fullWorkloadData) return;
      
      const workloadName = workload?.name || fullWorkloadData?.workloadName || id;
      
      const alreadyInScope = (activeScope.workloads || []).some((item) => item.id === id);
      if (!alreadyInScope) {
        const added = await addWorkloadById(id, { resetSidebarSelection: false });
        if (!added) return;
      }

      try {
        const action = await dispatch(
          ensureExecutiveSummary({
            type: 'workload',
            id,
            item: fullWorkloadData || workload,
          })
        );

        if (!ensureExecutiveSummary.fulfilled.match(action)) {
          throw new Error(
            action.payload || action.error?.message || 'Failed to load executive summary'
          );
        }

        const summaryData =
          action.payload?.summary ||
          executiveSummaryRecordsByKey?.[contextKey]?.summary ||
          null;

        if (summaryData?.summaryText) {
          const previewData = {
            type: 'workload',
            id,
            workloadId: id,
            name: workloadName,
            workloadName,
            summary: summaryData,
            item: fullWorkloadData || workload,
          };
          
          upsertExecutiveSummaryPreview(previewData);
          
          setExecutiveSummaryContextByKey((prev) => ({
            ...prev,
            [contextKey]: {
              id,
              name: workloadName,
              type: 'workload',
              summaryText: summaryData.summaryText,
              updatedAt: summaryData.updatedAt || null,
              sources: summaryData.sources || null,
            },
          }));
          
          addFetchedEntries([{
            type: 'executive_summary_loaded',
            label: `Loaded executive summary for ${workloadName}`,
            timestamp: new Date().toISOString(),
          }]);
          
          toast.success(`Executive summary loaded for ${workloadName}`);
        } else {
          toast.error('No executive summary available for this workload');
        }
      } catch (error) {
        console.error('Failed to load executive summary:', error);
        toast.error(error.message || 'Failed to load executive summary');
      }
    }
  }, [
    activeScope.environments,
    activeScope.workloads,
    addEnvironmentById,
    addWorkloadById,
    addFetchedEntries,
    availableWorkloads,
    dispatch,
    executiveSummaryRecordsByKey,
    isSending,
    maps.envById,
    maps.workloadById,
    permissionProfiles,
    upsertExecutiveSummaryPreview,
  ]);

  // Helper to extract workflow title
  const extractWorkflowTitle = useCallback((workflow) => {
    // Try workflowDefinition first (most reliable)
    if (workflow.workflowDefinition) {
      try {
        const definition = JSON.parse(workflow.workflowDefinition);
        if (definition.title) return definition.title;
        if (definition.workflowName) return definition.workflowName;
        if (definition.name) return definition.name;
      } catch {
        // JSON parse failed, try other fields
      }
    }
    // Try direct fields on workflow object
    if (workflow.title) return workflow.title;
    if (workflow.workflowName) return workflow.workflowName;
    if (workflow.name) return workflow.name;
    // Fallback to a readable ID
    return `Workflow Run`;
  }, []);

  // Helper to extract agent title
  const extractAgentTitle = useCallback((agent) => {
    // Try title field first
    if (agent.title) return agent.title;
    // Try to get a friendly name from itemId (might be like "security_review" -> "Security Review")
    if (agent.itemId) {
      const friendlyName = agent.itemId
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      // If the result looks like a title (not a UUID), use it
      if (!agent.itemId.includes('-') || agent.itemId.length < 36) {
        return friendlyName;
      }
    }
    // Try agentType as fallback
    if (agent.agentType && agent.agentType !== 'agent') {
      return agent.agentType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return 'Agent Run';
  }, []);

  const queueSummary = useMemo(() => {
    const lookbackMs = 30 * 24 * 60 * 60 * 1000;
    const cutoffTimestamp = Date.now() - lookbackMs;
    const toTimestamp = (...candidates) => {
      for (const value of candidates) {
        if (!value) continue;
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      return null;
    };

    const counts = {
      running: { workflow: 0, agent: 0, report: 0 },
      waiting: { workflow: 0, agent: 0, report: 0 },
      failed: { workflow: 0, agent: 0, report: 0 },
      completed: { workflow: 0, agent: 0, report: 0 },
    };
    const waitingItems = [];
    const workflowInputs = [];
    const agentInputs = [];
    const reportInputs = [];

    (workflowRunsForCounters || []).forEach((workflow) => {
      const updatedAtTimestamp = toTimestamp(
        workflow?.updatedAt,
        workflow?.lastUpdateTime,
        workflow?.createdAt
      );
      if (!updatedAtTimestamp || updatedAtTimestamp < cutoffTimestamp) return;

      const queueStatus = classifyQueueStatus(workflow?.workflowStatus);
      if (!queueStatus) return;

      workflowInputs.push({
        id: workflow.workflowRunId || workflow.workflowId || null,
        title: extractWorkflowTitle(workflow),
        rawStatus: workflow?.workflowStatus || null,
        queueStatus,
        updatedAt: workflow?.updatedAt || workflow?.lastUpdateTime || workflow?.createdAt || null,
      });
      counts[queueStatus].workflow += 1;

      if (queueStatus === 'waiting') {
        const workflowId = workflow.workflowRunId || workflow.workflowId;
        const reason = workflow.lastMessage || workflow.statusMessage || `Workflow is ${workflow.workflowStatus}`;
        waitingItems.push({
          id: `workflow-${workflowId}`,
          title: extractWorkflowTitle(workflow),
          subtitle: 'Review required',
          reason,
          priority: normalizeStatusToken(workflow.workflowStatus) === 'waiting_on_user' ? 'high' : 'medium',
          type: 'workflow',
          updatedAt: workflow.updatedAt,
          cta: {
            label: 'Open Run',
            intent: 'review_waiting_item',
            payload: {
              runType: 'workflow',
              runId: workflowId ? String(workflowId) : null,
              title: extractWorkflowTitle(workflow),
              status: workflow.workflowStatus || workflow.status || null,
              reason,
              explanation: reason,
              path: workflowId ? `/dashboard/workflow-history/${workflowId}` : '/dashboard/workflow-history',
            },
          },
        });
      }
    });

    (agentRunsForCounters || []).forEach((agent) => {
      const updatedAtTimestamp = toTimestamp(
        agent?.purchaseDate,
        agent?.updatedAt,
        agent?.createdAt
      );
      if (!updatedAtTimestamp || updatedAtTimestamp < cutoffTimestamp) return;

      const queueStatus = classifyQueueStatus(agent?.status);
      if (!queueStatus) return;

      const normalizedEntry = {
        id: agent.recordId || agent.itemId || null,
        title: extractAgentTitle(agent),
        rawStatus: agent?.status || null,
        queueStatus,
        rawType: agent?.agentType || null,
        counterType: 'agent',
        updatedAt: agent?.purchaseDate || agent?.updatedAt || agent?.createdAt || null,
      };
      agentInputs.push(normalizedEntry);
      counts[queueStatus].agent += 1;

      if (queueStatus === 'waiting') {
        const reason = agent.lastMessage || agent.statusMessage || 'Agent is waiting for your input';
        const runId = agent.recordId || agent.itemId || null;
        waitingItems.push({
          id: `agent-${runId || `pending_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`}`,
          title: extractAgentTitle(agent),
          subtitle: 'Review required',
          reason,
          priority: 'high',
          type: 'agent',
          updatedAt: agent.purchaseDate || agent.updatedAt,
          cta: {
            label: 'Open Run',
            intent: 'review_waiting_item',
            payload: {
              runType: 'agent',
              runId: runId ? String(runId) : null,
              title: extractAgentTitle(agent),
              status: agent.status || null,
              reason,
              explanation: reason,
              path: runId ? `/dashboard/agent/${runId}` : '/dashboard/agents',
            },
          },
        });
      }
    });

    (reportRunsForCounters || []).forEach((scan) => {
      const updatedAtTimestamp = toTimestamp(
        scan?.lastUpdateTime,
        scan?.latestAssessmentDate,
        scan?.updatedAt,
        scan?.createdAt
      );
      if (!updatedAtTimestamp || updatedAtTimestamp < cutoffTimestamp) return;

      const queueStatus = classifyReportQueueStatus(scan?.status);
      if (!queueStatus) return;

      const normalizedEntry = {
        id: buildReportEntryKey(scan) || scan.scanId || scan.reportId || null,
        title: scan.title || scan.reportId || scan.scanId || 'Report Run',
        rawStatus: scan?.status || null,
        queueStatus,
        rawType: 'report_scan',
        counterType: 'report',
        updatedAt: scan?.lastUpdateTime || scan?.latestAssessmentDate || null,
      };
      reportInputs.push(normalizedEntry);
      counts[queueStatus].report += 1;

      if (queueStatus === 'waiting') {
        const reason = scan?.statusMessage || 'Report is waiting for your input';
        const runId = buildReportEntryKey(scan) || scan.scanId || scan.reportId || null;
        waitingItems.push({
          id: `report-${runId || `pending_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`}`,
          title: scan.title || scan.reportId || 'Report Run',
          subtitle: 'Review required',
          reason,
          priority: 'high',
          type: 'report',
          updatedAt: scan.lastUpdateTime || scan.latestAssessmentDate || scan.updatedAt,
          cta: {
            label: 'Open Run',
            intent: 'review_waiting_item',
            payload: {
              runType: 'report',
              runId: runId ? String(runId) : null,
              title: scan.title || scan.reportId || 'Report Run',
              status: scan.status || null,
              reason,
              explanation: reason,
              path: '/dashboard/reports',
            },
          },
        });
      }
    });

    waitingItems.sort((a, b) => {
      const dateA = new Date(a.updatedAt || 0);
      const dateB = new Date(b.updatedAt || 0);
      return dateB - dateA;
    });

    const totals = {
      running: counts.running.workflow + counts.running.agent + counts.running.report,
      waiting: counts.waiting.workflow + counts.waiting.agent + counts.waiting.report,
      failed: counts.failed.workflow + counts.failed.agent + counts.failed.report,
      completed: counts.completed.workflow + counts.completed.agent + counts.completed.report,
    };

    return {
      counts,
      totals,
      waitingItems,
      inputs: {
        cutoffTimestamp,
        sourceSummary: {
          workflowsSource: Array.isArray(userWorkflows) && userWorkflows.length > 0
            ? 'state.workflow.userWorkflows'
            : 'state.overview.workflows (fallback)',
          agentsSource: Array.isArray(agentHistoryFromTab) && agentHistoryFromTab.length > 0
            ? 'state.agent.agentHistory'
            : 'state.overview.agentHistory (fallback)',
          reportsSource: 'state.auth.userProfile.reportHistory (reportId only)',
          sourceCounts: {
            workflows: Array.isArray(workflowRunsForCounters) ? workflowRunsForCounters.length : 0,
            agents: Array.isArray(agentRunsForCounters) ? agentRunsForCounters.length : 0,
            reports: Array.isArray(reportRunsForCounters) ? reportRunsForCounters.length : 0,
          },
        },
        workflows: workflowInputs,
        agents: agentInputs,
        reports: reportInputs,
      },
    };
  }, [
    agentHistoryFromTab,
    agentRunsForCounters,
    extractAgentTitle,
    extractWorkflowTitle,
    reportRunsForCounters,
    userWorkflows,
    workflowRunsForCounters,
  ]);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    if (window.localStorage?.getItem('DEBUG_COMMAND_CENTER_QUEUE') !== '1') {
      return;
    }
    console.groupCollapsed('[CommandCenter] Queue inputs (past 30 days)');
    console.log('cutoffTimestamp', new Date(queueSummary.inputs.cutoffTimestamp).toISOString());
    console.log('sourceSummary', queueSummary.inputs.sourceSummary);
    console.log('workflows30d', queueSummary.inputs.workflows);
    console.log('agents30d', queueSummary.inputs.agents);
    console.log('reports30d', queueSummary.inputs.reports);
    console.log('counterTotals', queueSummary.totals);
    console.log('counterBreakdown', queueSummary.counts);
    console.groupEnd();
  }, [queueSummary]);

  const waitingItems = queueSummary.waitingItems;

  const envLimitReached = (activeScope.environments || []).length >= (scopeLimits?.environments?.max || 3);
  const workloadLimitReached = (activeScope.workloads || []).length >= (scopeLimits?.workloads?.max || 5);
  const reportLimitReached = (activeScope.reports || []).length >= (scopeLimits?.reports?.max || 3);
  const scopeCount = (activeScope.environments?.length || 0) + (activeScope.workloads?.length || 0) + (activeScope.reports?.length || 0);
  const hasScope = scopeCount > 0;
  const currentPathConfig = COMMAND_PATHS.find((path) => path.id === activePath);
  const isSuggestedPath = activePath === COMMAND_PATH_SUGGESTED;
  const isCustomPath = activePath === COMMAND_PATH_CUSTOM;
  const isSuggestionsLoading = backendSuggestionCards.length === 0
    && !isLocalMode
    && (loadingBootstrap || isHydratingStartup || !loadedSuggestionsOnceRef.current);

  const shouldShowStartBriefBlocks = false;
  
  const suggestionCards = isLocalMode ? [] : backendSuggestionCards;

  const reportsToRunGroup = COMMAND_CENTER_SMART_GROUPS.find((g) => g.id === 'reports-to-run');
  const reportsToRun = useMemo(() => {
    if (!reportsToRunGroup) return [];
    return (personalizationBase.recommendations || [])
      .filter((rec) => recommendationMatchesSmartGroup(rec, reportsToRunGroup))
      .map((rec) => {
        const envNames = (rec.targetResources || [])
          .map((r) => r.environmentName)
          .filter(Boolean);
        const uniqueEnvs = [...new Set(envNames)];
        const action = normalizeRecommendationAction(rec.recommendedAction);
        const fallbackAction = normalizeRecommendationAction(rec.action);
        const resolvedAction = Object.keys(action).length > 0 ? action : fallbackAction;
        const reportPlanId = resolvedAction?.sourceBlueprintId || resolvedAction?.reportId || null;
        return {
          id: rec.id || rec.recommendationId,
          title: rec.title || 'Untitled Report',
          environmentName: uniqueEnvs.length > 0 ? uniqueEnvs.join(', ') : null,
          reportPlanId,
          action: resolvedAction,
          targetResources: rec.targetResources || [],
        };
      });
  }, [personalizationBase.recommendations, reportsToRunGroup]);

  const chatPlaceholder = hasScope
    ? (
        isCustomPath
          ? 'Describe what you want to accomplish...'
          : 'Ask CloudAgent to plan, review, or execute...'
      )
    : (
        isCustomPath
          ? 'Describe what you need. Add scope for precision, or CloudAgent will ask follow-ups.'
          : currentPathConfig?.inputHint || DEFAULT_PATH_INPUT_HINT
      );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Compact Top Bar */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Scope Summary */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsHistoryVisible((prev) => !prev)}
                title={isHistoryVisible ? 'Hide chat history' : 'Show chat history'}
              >
                <Menu className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleStartNewSession}
                title="Start new session"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="h-4 w-px bg-slate-200" />

            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary-600" />
              <span className="text-sm font-semibold text-slate-900">CloudAgent</span>
              {activePath === COMMAND_PATH_CUSTOM ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs text-primary-700 hover:bg-primary-50 hover:text-primary-800"
                  onClick={() => handlePathChange(COMMAND_PATH_SUGGESTED)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Briefing
                </Button>
              ) : null}
            </div>
          </div>

          {/* Right: Context Indicator */}
          <button
            type="button"
            onClick={() => setIsScopePanelVisible((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition hover:bg-slate-50 ${
              isScopePanelVisible ? 'border-primary-200 bg-primary-50 text-primary-700' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {(activeScope.environments?.length || 0) > 0 && (
              <span className="inline-flex items-center gap-1">
                <Cloud className="h-3 w-3" />
                <span className="font-medium">{activeScope.environments.length}</span>
              </span>
            )}
            {(activeScope.workloads?.length || 0) > 0 && (
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3 w-3" />
                <span className="font-medium">{activeScope.workloads.length}</span>
              </span>
            )}
            {(activeScope.reports?.length || 0) > 0 && (
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span className="font-medium">{activeScope.reports.length}</span>
              </span>
            )}
            {!hasScope && (
              <span className="text-slate-400">No context</span>
            )}
          </button>
        </div>

      </div>

      {/* Main Content: Chat-Centric Layout */}
      <div className="flex min-h-0 flex-1">
        {isHistoryVisible ? (
          <div className="hidden w-72 flex-shrink-0 border-r border-slate-200 bg-white md:block">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">History</div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleStartNewSession}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                New
              </Button>
            </div>
            <ScrollArea className="h-[calc(100%-45px)]">
              <div className="space-y-1 p-2">
                {commandCenterHistory.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-2 text-xs text-slate-500">
                    No Command Center sessions yet.
                  </div>
                ) : (
                  commandCenterHistory.map((chat) => (
                    <button
                      key={chat.recordId}
                      type="button"
                      onClick={() => handleOpenHistorySession(chat.recordId)}
                      className={`w-full rounded-md border px-2.5 py-2 text-left transition ${
                        currentRecordId === chat.recordId
                          ? 'border-primary-200 bg-primary-50'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="truncate text-sm font-medium text-slate-800">
                        {chat.title || 'Command Center Session'}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {chat.updatedAt
                          ? new Date(chat.updatedAt).toLocaleString()
                          : 'Recently updated'}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1">
        {/* Chat Panel - Primary */}
        <div className="flex min-h-0 flex-1 flex-col">
          <ScrollArea ref={chatScrollAreaRef} className="flex-1">
            <div className="mx-auto max-w-5xl px-4 py-6">
              <div className="space-y-4">

                {/* Session Starter - keep visible to support loading multiple items */}
                {activePath === COMMAND_PATH_SUGGESTED && (messages.length <= 1 || reportPreviews.length > 0 || executiveSummaryPreviews.length > 0) && (
                  <SessionStarter
                    recommendations={personalizationBase.recommendations}
                    suggestionCards={suggestionCards}
                    reportsToRun={reportsToRun}
                    isSuggestionsLoading={isSuggestionsLoading}
                    availableEnvironments={availableEnvironments}
                    availableWorkloads={availableWorkloads}
                    healthCheckEnvironments={healthCheckEnvironments}
                    costAnalysisEnvironments={costAnalysisEnvironments}
                    workloadHealthById={workloadHealthById}
                    environmentHealthById={environmentHealthById}
                    loadingEnvironmentHealthIds={loadingEnvironmentHealthIds}
                    loadingWorkloadHealthIds={loadingWorkloadHealthIds}
                    environmentCostById={environmentCostById}
                    loadingEnvironmentCostIds={loadingEnvironmentCostIds}
                    briefing={environmentBriefing}
                    workflowRuns={workflowRunsForCounters}
                    agentRuns={agentRunsForCounters}
                    reportRuns={reportRunsForCounters}
                    availableReports={availableReports}
                    loadingReportKey={loadingReportSelection?.key || null}
                    executiveSummaryRequestsByKey={executiveSummaryRequestRecords}
                    activeScope={activeScope}
                    onAddEnvironment={handleModeAddEnvironment}
                    onAddWorkload={handleModeAddWorkload}
                    onAddReport={handleModeAddReport}
                    onCreateWorkload={handleModeCreateWorkload}
                    onRunHealthCheck={handleModeRunHealthCheck}
                    onRefreshHealthCheck={handleDirectRefreshCheck}
                    onOpenHealthDrilldown={hydrateHealthDrilldown}
                    onRunSuggestedReport={handleRunSuggestedReport}
                    onViewExecutiveSummary={handleModeViewExecutiveSummary}
                    onCardAction={handleAction}
                    onLoadMoreSuggestions={loadMoreSuggestions}
                    onRefreshSuggestions={refreshStartupSuggestions}
                    onSkipToChat={handleSkipToChat}
                    hasMoreSuggestions={startupSuggestionWindow?.hasMore || false}
                    isRefreshingSuggestions={isRefreshingSuggestions}
                    enableHealthContext={enableHealthContext}
                    enableCostContext={enableCostContext}
                    disabled={isSending}
                  />
                )}

                {/* Persistent session context - stays visible after SessionStarter hides */}
                {activePath === COMMAND_PATH_CUSTOM && !(reportPreviews.length > 0 || executiveSummaryPreviews.length > 0) && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <CustomPathPanel
                      availableReports={availableReports}
                      availableWorkloads={availableWorkloads}
                      availableEnvironments={availableEnvironments}
                      healthCheckEnvironments={healthCheckEnvironments}
                      costAnalysisEnvironments={costAnalysisEnvironments}
                      workloadHealthById={workloadHealthById}
                      environmentHealthById={environmentHealthById}
                      loadingEnvironmentHealthIds={loadingEnvironmentHealthIds}
                      loadingWorkloadHealthIds={loadingWorkloadHealthIds}
                      environmentCostById={environmentCostById}
                      loadingEnvironmentCostIds={loadingEnvironmentCostIds}
                      loadingReportKey={loadingReportSelection?.key || null}
                      executiveSummaryRequestsByKey={executiveSummaryRequestRecords}
                      activeScope={activeScope}
                      enableHealthContext={enableHealthContext}
                      enableCostContext={enableCostContext}
                      onAddReport={handleModeAddReport}
                      onRunHealthCheck={handleModeRunHealthCheck}
                      onOpenHealthDrilldown={hydrateHealthDrilldown}
                      onViewExecutiveSummary={handleModeViewExecutiveSummary}
                      formatDate={formatDate}
                      disabled={isSending}
                    />
                  </div>
                )}

                {reportPreviews.map((preview) => {
                  const previewKey = getReportPreviewKey(preview);
                  if (!previewKey) return null;
                  return (
                    <div key={previewKey} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {preview.title || preview.name || preview.reportId || preview.scanId}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5">
                              Env: {preview.environmentName || '—'}
                            </span>
                            {preview.updatedAt ? (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5">
                                Updated {new Date(preview.updatedAt).toLocaleString()}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            onClick={() => {
                              setActiveReportPreview(preview);
                              setIsReportPreviewModalOpen(true);
                            }}
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setReportPreviews((previous) => previous.filter((item) => (
                                !reportPreviewMatchesScopeItem(item, preview)
                              )));
                              if (reportPreviewMatchesScopeItem(activeReportPreview, preview)) {
                                setActiveReportPreview(null);
                                setIsReportPreviewModalOpen(false);
                              }
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="max-h-[180px] overflow-y-auto border-t border-slate-100 bg-slate-50/40 p-2">
                        <CommandCenterEmbeddedReportPreview key={previewKey} report={preview} compact />
                      </div>
                    </div>
                  );
                })}

                {executiveSummaryPreviews.map((preview) => {
                  const previewKey = getExecutiveSummaryPreviewKey(preview);
                  if (!previewKey) return null;
                  const Icon = preview.type === 'workload' ? Layers : Cloud;
                  const itemName = preview.name || preview.workloadName || preview.recordId || preview.id;
                  const typeLabel = preview.type === 'workload' ? 'Workload' : 'Environment';
                  return (
                    <div key={previewKey} className="rounded-xl border border-primary-200 bg-white shadow-sm">
                      <div className="flex items-start justify-between gap-3 px-4 py-3 bg-primary-50/30">
                        <div className="min-w-0 flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary-600 shrink-0" />
                          <div>
                            <div className="text-sm font-semibold text-slate-900 truncate">
                              {itemName}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                              <span className="rounded bg-primary-100 px-1.5 py-0.5 text-primary-700">
                                Executive Summary
                              </span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5">
                                {typeLabel}
                              </span>
                              {preview.summary?.updatedAt ? (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5">
                                  Updated {new Date(preview.summary.updatedAt).toLocaleString()}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            onClick={() => {
                              setActiveExecutiveSummaryPreview(preview);
                              setIsExecutiveSummaryPreviewModalOpen(true);
                            }}
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              const removeKey = getExecutiveSummaryPreviewKey(preview);
                              setExecutiveSummaryPreviews((previous) => previous.filter((item) => (
                                getExecutiveSummaryPreviewKey(item) !== removeKey
                              )));
                              setExecutiveSummaryContextByKey((prev) => {
                                const next = { ...prev };
                                delete next[removeKey];
                                return next;
                              });
                              if (getExecutiveSummaryPreviewKey(activeExecutiveSummaryPreview) === removeKey) {
                                setActiveExecutiveSummaryPreview(null);
                                setIsExecutiveSummaryPreviewModalOpen(false);
                              }
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto border-t border-primary-100 bg-slate-50/40 p-3">
                        <CommandCenterEmbeddedExecutiveSummary
                          summary={preview.summary}
                          item={preview.item}
                          type={preview.type}
                          compact
                        />
                      </div>
                    </div>
                  );
                })}

                {messages.map((message) => {
                  const rawBlocks = Array.isArray(message.blocks) ? message.blocks : [];
                  const visibleBlocks = (message.blocks || []).filter((block) => {
                    if (!block?.type) return false;
                    if (!shouldShowStartBriefBlocks && block.type === 'start_brief') return false;
                    return true;
                  });
                  const isHiddenStartBriefOnlyMessage = !shouldShowStartBriefBlocks
                    && rawBlocks.length > 0
                    && visibleBlocks.length === 0
                    && rawBlocks.every((block) => block?.type === 'start_brief');
                  if (isHiddenStartBriefOnlyMessage) return null;
                  const hasBlocks = visibleBlocks.length > 0;
                  const isAssistant = message.role === 'assistant';
                  const messageTools = Array.isArray(message.tools) ? message.tools : [];
                  const messageToolExecutions = Array.isArray(message.toolExecutions) ? message.toolExecutions : [];
                  const messageToolGroups = groupToolRuns(messageTools, messageToolExecutions);
                  const normalizedMessageText = typeof message.text === 'string'
                    ? message.text
                      .replace(/\\r\\n/g, '\n')
                      .replace(/\\n/g, '\n')
                      .replace(/\r\n/g, '\n')
                    : '';
                  
                  return (
                    <div
                      key={message.id}
                      data-message-id={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`${
                          message.role === 'user'
                            ? 'max-w-[80%] rounded-xl bg-primary-600 px-3 py-1.5 text-white'
                            : hasBlocks 
                              ? 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm' 
                              : 'max-w-[85%] rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm'
                        }`}
                      >
                        {isAssistant && (
                          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                            <Bot className="h-3.5 w-3.5" />
                            CloudAgent
                          </div>
                        )}
                        {isAssistant && messageToolGroups.length > 0 ? (
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {messageToolGroups.map((toolGroup) => {
                              const isInspectable = toolGroup.runs.length > 0;
                              return (
                                <button
                                  key={`${message.id}-tool-${toolGroup.name}`}
                                  type="button"
                                  disabled={!isInspectable}
                                  onClick={() => {
                                    if (!isInspectable) return;
                                    openToolInspector(toolGroup);
                                  }}
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                                    isInspectable
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100'
                                      : 'cursor-default border-emerald-200 bg-emerald-50 text-emerald-700'
                                  }`}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  {getToolStatusLabel(toolGroup.name)}
                                  {toolGroup.count > 1 ? (
                                    <span className="rounded-full bg-emerald-100 px-1.5 py-0 text-[10px] font-semibold text-emerald-800">
                                      {toolGroup.count}
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                        {normalizedMessageText ? (
                          <div className={`max-w-none ${message.role === 'user' ? 'text-sm text-white' : 'text-[15px] leading-relaxed text-slate-900'}`}>
                            <Markdown
                              options={{
                                forceBlock: true,
                                overrides: {
                                  h1: {
                                    props: {
                                      className: message.role === 'user'
                                        ? 'mt-6 mb-4 text-2xl font-semibold tracking-tight text-white'
                                        : 'mt-6 mb-4 text-2xl font-semibold tracking-tight text-slate-900',
                                    },
                                  },
                                  h2: {
                                    props: {
                                      className: message.role === 'user'
                                        ? 'mt-6 mb-4 text-xl font-semibold tracking-tight text-white'
                                        : 'mt-6 mb-4 text-xl font-semibold tracking-tight text-slate-900',
                                    },
                                  },
                                  h3: {
                                    props: {
                                      className: message.role === 'user'
                                        ? 'mt-6 mb-3 text-lg font-semibold tracking-tight text-white'
                                        : 'mt-6 mb-3 text-lg font-semibold tracking-tight text-slate-900',
                                    },
                                  },
                                  p: {
                                    props: {
                                      className: message.role === 'user'
                                        ? 'whitespace-pre-wrap text-white'
                                        : 'my-4 whitespace-pre-wrap leading-8 text-slate-900',
                                    },
                                  },
                                  strong: {
                                    props: {
                                      className: message.role === 'user'
                                        ? 'font-semibold text-white'
                                        : 'font-semibold text-slate-900',
                                    },
                                  },
                                  ul: {
                                    props: {
                                      className: 'my-4 list-disc pl-6 space-y-1',
                                    },
                                  },
                                  ol: {
                                    props: {
                                      className: 'my-4 list-decimal pl-6 space-y-1',
                                    },
                                  },
                                  li: {
                                    props: {
                                      className: message.role === 'user' ? 'leading-7 text-white' : 'leading-7 text-slate-900',
                                    },
                                  },
                                },
                              }}
                            >
                              {normalizedMessageText}
                            </Markdown>
                          </div>
                        ) : null}

                        {hasBlocks ? (
                          <div className="mt-3 space-y-3">
                            {visibleBlocks.map((block, index) => (
                              <div key={`${message.id}-block-${index}`}>
                                {renderBlock(block, handleAction, isSending, openResourcesModal, recommendationLookup)}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {queuedRoutePromptPreview && !isSending ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl bg-primary-600 px-4 py-3 text-white shadow-sm">
                      <div className="mb-2 flex items-center justify-end gap-1.5 text-[11px] font-medium text-primary-100">
                        <span>Preparing request...</span>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-white">
                        {queuedRoutePromptPreview.text}
                      </p>
                    </div>
                  </div>
                ) : null}

                {!loadingBootstrap && hasInitializedSession && messages.length === 0 && !queuedRoutePromptPreview && isHydratingStartup ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {'Loading startup suggestions...'}
                    </div>
                  </div>
                ) : null}

                {isSending && showStreamingAssistantBubble ? (
                  <div data-streaming-assistant="true" className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <Bot className="h-3.5 w-3.5" />
                        CloudAgent
                        {!streamingAssistantText ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      </div>
                      {(activeToolCalls.length > 0 || completedToolCalls.length > 0) ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {groupToolRuns(
                            activeToolCalls,
                            liveToolExecutions.filter((run) => run.status !== 'completed' && run.status !== 'failed')
                          ).map((toolGroup) => {
                            const isInspectable = toolGroup.runs.length > 0;
                            return (
                              <button
                                key={`thinking-active-${toolGroup.name}`}
                                type="button"
                                disabled={!isInspectable}
                                onClick={() => {
                                  if (!isInspectable) return;
                                  openToolInspector(toolGroup);
                                }}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                                  isInspectable
                                    ? 'border-blue-200 bg-blue-50 text-blue-700 transition hover:border-blue-300 hover:bg-blue-100'
                                    : 'cursor-default border-blue-200 bg-blue-50 text-blue-700'
                                }`}
                              >
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                                {getToolStatusLabel(toolGroup.name)}
                                {toolGroup.count > 1 ? (
                                  <span className="rounded-full bg-blue-100 px-1.5 py-0 text-[10px] font-semibold text-blue-800">
                                    {toolGroup.count}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                          {groupToolRuns(
                            completedToolCalls,
                            liveToolExecutions.filter((run) => run.status === 'completed' || run.status === 'failed')
                          ).map((toolGroup) => {
                            const isInspectable = toolGroup.runs.length > 0;
                            return (
                              <button
                                key={`thinking-done-${toolGroup.name}`}
                                type="button"
                                disabled={!isInspectable}
                                onClick={() => {
                                  if (!isInspectable) return;
                                  openToolInspector(toolGroup);
                                }}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                                  isInspectable
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100'
                                    : 'cursor-default border-emerald-200 bg-emerald-50 text-emerald-700'
                                }`}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                {getToolStatusLabel(toolGroup.name)}
                                {toolGroup.count > 1 ? (
                                  <span className="rounded-full bg-emerald-100 px-1.5 py-0 text-[10px] font-semibold text-emerald-800">
                                    {toolGroup.count}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                      {streamingAssistantText ? (
                        <div className="mt-3 max-w-none text-[15px] leading-relaxed text-slate-900">
                          <Markdown
                            options={{
                              forceBlock: true,
                              overrides: {
                                h1: {
                                  props: {
                                    className: 'mt-6 mb-4 text-2xl font-semibold tracking-tight text-slate-900',
                                  },
                                },
                                h2: {
                                  props: {
                                    className: 'mt-6 mb-4 text-xl font-semibold tracking-tight text-slate-900',
                                  },
                                },
                                h3: {
                                  props: {
                                    className: 'mt-6 mb-3 text-lg font-semibold tracking-tight text-slate-900',
                                  },
                                },
                                p: {
                                  props: {
                                    className: 'my-4 whitespace-pre-wrap leading-8 text-slate-900',
                                  },
                                },
                                strong: {
                                  props: {
                                    className: 'font-semibold text-slate-900',
                                  },
                                },
                                ul: {
                                  props: {
                                    className: 'my-4 list-disc pl-6 space-y-1',
                                  },
                                },
                                ol: {
                                  props: {
                                    className: 'my-4 list-decimal pl-6 space-y-1',
                                  },
                                },
                                li: {
                                  props: {
                                    className: 'leading-7 text-slate-900',
                                  },
                                },
                              },
                            }}
                          >
                            {streamingAssistantText
                              .replace(/\\r\\n/g, '\n')
                              .replace(/\\n/g, '\n')
                              .replace(/\r\n/g, '\n')}
                          </Markdown>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                          Thinking...
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <div ref={messagesEndRef} />
              </div>
            </div>
          </ScrollArea>

          {/* Chat Input */}
          <div className="border-t border-slate-100 px-4 py-3">
            <div className="mx-auto max-w-5xl">
              <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm focus-within:border-primary-300 focus-within:ring-1 focus-within:ring-primary-100">
                <textarea
                  ref={inputRef}
                  autoFocus
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={currentPathConfig?.inputHint || chatPlaceholder}
                  rows={1}
                  className="min-h-[36px] max-h-[120px] flex-1 resize-none border-0 bg-transparent py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                  disabled={isSending}
                  style={{ height: 'auto' }}
                  onInput={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSending || !input.trim()}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Session Context */}
        {isScopePanelVisible ? (
        <div className="hidden w-72 sm:w-80 flex-shrink-0 border-l border-gray-200 bg-gray-50/40 lg:flex lg:flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">Session Context</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsScopePanelVisible(false)}
              className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
              title="Hide context"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {/* Environments */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Cloud className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Environments</span>
                </div>
                {(activeScope.environments || []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-3 text-center mb-2">
                    <p className="text-xs text-gray-400">No environments added</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 mb-2">
                    {(activeScope.environments || []).map((env) => (
                      <div
                        key={env.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                          <span className="text-xs text-gray-700 truncate">{env.name || env.id}</span>
                        </div>
                        <button
                          type="button"
                          className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeScopeItem('environments', env.id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 hover:underline transition-colors"
                  onClick={() => setIsEnvironmentModalOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                  Add environment
                </button>
                <button
                  type="button"
                  className="mt-1.5 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={() => navigate('/dashboard/cloud-setup')}
                >
                  <ExternalLink className="h-3 w-3" />
                  Set up new environment
                </button>
              </div>

              {/* Workloads */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Layers className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Workloads</span>
                </div>
                {(activeScope.workloads || []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-3 text-center mb-2">
                    <p className="text-xs text-gray-400">No workloads added</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 mb-2">
                    {(activeScope.workloads || []).map((w) => (
                      <div
                        key={w.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
                          <span className="text-xs text-gray-700 truncate">{w.name || w.id}</span>
                        </div>
                        <button
                          type="button"
                          className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeScopeItem('workloads', w.id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 hover:underline transition-colors"
                  onClick={() => setIsWorkloadModalOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                  Add workload
                </button>
                <button
                  type="button"
                  className="mt-1.5 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={() => navigate('/dashboard/workloads')}
                >
                  <ExternalLink className="h-3 w-3" />
                  Create new workload
                </button>
              </div>

              {/* Suggested Scope Updates */}
              {scopeSuggestions.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500">Suggested Context</div>
                  <div className="mt-2 space-y-2">
                    {scopeSuggestions.slice(0, 4).map((suggestion) => (
                      <div
                        key={suggestion.id}
                        className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                      >
                        <div className="font-medium">{suggestion.notice || 'Suggested update'}</div>
                        {suggestion.summary && <div className="mt-0.5 text-[11px]">{suggestion.summary}</div>}
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => applyScopeSuggestion(suggestion.id)}
                            disabled={isSending}
                          >
                            Apply
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => dismissScopeSuggestion(suggestion.id)}
                            disabled={isSending}
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reports */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reports</span>
                </div>
                {(activeScope.reports || []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-3 text-center mb-2">
                    <p className="text-xs text-gray-400">No reports loaded</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 mb-2">
                    {(activeScope.reports || []).map((report) => (
                      <div
                        key={report.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="text-xs text-gray-700 truncate">{report.name || report.id}</span>
                        </div>
                        <button
                          type="button"
                          className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeScopeItem('reports', report.id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 hover:underline transition-colors"
                  onClick={() => setIsReportModalOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                  Add report
                </button>
              </div>

              {/* Fetched This Session */}
              <div>
                <div className="text-xs font-medium text-gray-500">Fetched This Session</div>
                <div className="flex flex-col gap-1 mt-2">
                  {(fetchedThisSession || []).length === 0 && (
                    <span className="text-xs text-gray-400">No fetched items yet</span>
                  )}
                  {(fetchedThisSession || []).slice(-6).map((entry, index) => (
                    <div key={`${entry.type || 'event'}-${index}`} className="text-xs text-gray-600">
                      {entry.label || entry.title || entry.type || 'Fetched item'}
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <div className="text-xs font-medium text-gray-500">Notes</div>
                <textarea
                  className="mt-2 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
                  rows={2}
                  value={scopeNotes}
                  onChange={(event) => setScopeNotes(event.target.value)}
                  placeholder="Optional notes for this session"
                  disabled={isSending}
                />
              </div>

              {scopeInlineNotice && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                  {scopeInlineNotice}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        ) : null}

        {/* Add Environment Modal */}
        {isEnvironmentModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">Add Environment to Context</h3>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={() => {
                    setIsEnvironmentModalOpen(false);
                    setSelectedEnvironmentId('');
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-5 pt-3 pb-1">
                {availableEnvironments.length === 0 ? (
                  <div className="text-center py-8">
                    <Cloud className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No environments available</p>
                    <p className="text-xs text-gray-400 mt-1">Set up a cloud environment to get started.</p>
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 hover:underline"
                      onClick={() => {
                        setIsEnvironmentModalOpen(false);
                        navigate('/dashboard/cloud-setup');
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Go to Cloud Setup
                    </button>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-left sticky top-0">
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availableEnvironments.map((env) => {
                          const isSelected = selectedEnvironmentId === env.recordId;
                          const alreadyAdded = (activeScope.environments || []).some(e => e.id === env.recordId);
                          return (
                            <tr
                              key={env.recordId}
                              className={`border-t border-gray-100 transition-colors ${
                                alreadyAdded
                                  ? 'opacity-40 cursor-default'
                                  : isSelected
                                  ? 'bg-primary-50 cursor-pointer'
                                  : 'hover:bg-gray-50 cursor-pointer'
                              }`}
                              onClick={() => {
                                if (!alreadyAdded) setSelectedEnvironmentId(env.recordId);
                              }}
                            >
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  {isSelected && !alreadyAdded && <div className="h-1.5 w-1.5 rounded-full bg-primary-500 shrink-0" />}
                                  <span className={`truncate ${isSelected && !alreadyAdded ? 'text-primary-700 font-medium' : 'text-gray-700'}`}>
                                    {env.name || env.recordId}
                                  </span>
                                  {alreadyAdded && <span className="text-[10px] text-gray-400 ml-1">(added)</span>}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-gray-500 capitalize">
                                {env.type || 'AWS'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/50 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEnvironmentModalOpen(false);
                    setSelectedEnvironmentId('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    addEnvironment();
                    setIsEnvironmentModalOpen(false);
                  }}
                  disabled={!selectedEnvironmentId}
                >
                  Add Environment
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Add Workload Modal */}
        {isWorkloadModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">Add Workload to Context</h3>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={() => {
                    setIsWorkloadModalOpen(false);
                    setSelectedWorkloadId('');
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-5 pt-3 pb-1">
                {availableWorkloads.length === 0 ? (
                  <div className="text-center py-8">
                    <Layers className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No workloads available</p>
                    <p className="text-xs text-gray-400 mt-1">Create a workload to get started.</p>
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 hover:underline"
                      onClick={() => {
                        setIsWorkloadModalOpen(false);
                        navigate('/dashboard/workloads');
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Go to Workloads
                    </button>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-left sticky top-0">
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availableWorkloads.map((workload) => {
                          const isSelected = selectedWorkloadId === workload.workloadId;
                          const alreadyAdded = (activeScope.workloads || []).some(w => w.id === workload.workloadId);
                          return (
                            <tr
                              key={workload.workloadId}
                              className={`border-t border-gray-100 transition-colors ${
                                alreadyAdded
                                  ? 'opacity-40 cursor-default'
                                  : isSelected
                                  ? 'bg-primary-50 cursor-pointer'
                                  : 'hover:bg-gray-50 cursor-pointer'
                              }`}
                              onClick={() => {
                                if (!alreadyAdded) setSelectedWorkloadId(workload.workloadId);
                              }}
                            >
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  {isSelected && !alreadyAdded && <div className="h-1.5 w-1.5 rounded-full bg-primary-500 shrink-0" />}
                                  <span className={`truncate ${isSelected && !alreadyAdded ? 'text-primary-700 font-medium' : 'text-gray-700'}`}>
                                    {workload.workloadName || workload.workloadId}
                                  </span>
                                  {alreadyAdded && <span className="text-[10px] text-gray-400 ml-1">(added)</span>}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-gray-500 truncate max-w-[180px]">
                                {workload.description || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/50 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsWorkloadModalOpen(false);
                    setSelectedWorkloadId('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    addWorkload();
                    setIsWorkloadModalOpen(false);
                  }}
                  disabled={!selectedWorkloadId}
                >
                  Add Workload
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Add Report Modal */}
        {isReportModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">Add Report to Context</h3>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={() => {
                    setIsReportModalOpen(false);
                    setSelectedReportId('');
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-5 pt-3 pb-1">
                {availableReports.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No reports available</p>
                    <p className="text-xs text-gray-400 mt-1">Run a scan to generate reports.</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-left sticky top-0">
                          <th className="px-3 py-2 font-medium">Report</th>
                          <th className="px-3 py-2 font-medium">Environment</th>
                          <th className="px-3 py-2 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availableReports.map((report) => {
                          const reportKey = buildReportEntryKey(report) || report.scanId || report.reportId;
                          const isSelected = selectedReportId === reportKey;
                          const alreadyAdded = (activeScope.reports || []).some(r => r.id === reportKey);
                          const dateRaw = report.lastUpdateTime || report.latestAssessmentDate || report.updatedAt;
                          const dateLabel = dateRaw
                            ? new Date(dateRaw).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                            : '—';
                          return (
                            <tr
                              key={reportKey}
                              className={`border-t border-gray-100 transition-colors ${
                                alreadyAdded
                                  ? 'opacity-40 cursor-default'
                                  : isSelected
                                  ? 'bg-primary-50 cursor-pointer'
                                  : 'hover:bg-gray-50 cursor-pointer'
                              }`}
                              onClick={() => {
                                if (!alreadyAdded) setSelectedReportId(reportKey);
                              }}
                            >
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  {isSelected && !alreadyAdded && <div className="h-1.5 w-1.5 rounded-full bg-primary-500 shrink-0" />}
                                  <span className={`truncate ${isSelected && !alreadyAdded ? 'text-primary-700 font-medium' : 'text-gray-700'}`}>
                                    {report.title || report.reportId || report.scanId}
                                  </span>
                                  {alreadyAdded && <span className="text-[10px] text-gray-400 ml-1">(added)</span>}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-gray-500 truncate max-w-[120px]">
                                {report.environmentName || '—'}
                              </td>
                              <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                                {dateLabel}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/50 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsReportModalOpen(false);
                    setSelectedReportId('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    addReport();
                    setIsReportModalOpen(false);
                  }}
                  disabled={!selectedReportId || loadingReportSelection}
                >
                  {loadingReportSelection ? (
                    <>
                      <span className="inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                      Loading...
                    </>
                  ) : (
                    'Add Report'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      <Dialog
        open={isReportPreviewModalOpen}
        onOpenChange={(open) => setIsReportPreviewModalOpen(open)}
      >
        <DialogContent className="max-w-7xl h-[92vh] p-0">
          <DialogHeader className="border-b border-slate-200 px-4 py-3">
            <DialogTitle>
              {activeReportPreview?.title || activeReportPreview?.name || activeReportPreview?.reportId || activeReportPreview?.scanId || 'Report Preview'}
            </DialogTitle>
          </DialogHeader>
          <div className="h-[calc(92vh-62px)] overflow-y-auto bg-slate-50/40 p-4">
            {activeReportPreview ? (
              <CommandCenterEmbeddedReportPreview report={activeReportPreview} />
            ) : (
              <div className="rounded border border-slate-200 bg-white p-3 text-sm text-slate-600">
                No report selected for preview.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isExecutiveSummaryPreviewModalOpen}
        onOpenChange={(open) => setIsExecutiveSummaryPreviewModalOpen(open)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="border-b border-slate-200 px-4 py-3">
            <DialogTitle className="flex items-center gap-2">
              {activeExecutiveSummaryPreview?.type === 'workload' ? (
                <Layers className="h-5 w-5 text-primary-600" />
              ) : (
                <Cloud className="h-5 w-5 text-primary-600" />
              )}
              {activeExecutiveSummaryPreview?.name || activeExecutiveSummaryPreview?.workloadName || activeExecutiveSummaryPreview?.recordId || 'Executive Summary'}
              <span className="ml-2 text-sm font-normal text-slate-500">
                ({activeExecutiveSummaryPreview?.type === 'workload' ? 'Workload' : 'Environment'})
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-62px)] overflow-y-auto bg-slate-50/40 p-4">
            {activeExecutiveSummaryPreview ? (
              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <CommandCenterEmbeddedExecutiveSummary
                  summary={activeExecutiveSummaryPreview.summary}
                  item={activeExecutiveSummaryPreview.item}
                  type={activeExecutiveSummaryPreview.type}
                />
              </div>
            ) : (
              <div className="rounded border border-slate-200 bg-white p-3 text-sm text-slate-600">
                No executive summary selected for preview.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={toolInspectorModal.open}
        onOpenChange={(open) => {
          setToolInspectorModal((prev) => ({
            ...prev,
            open,
          }));
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] border border-slate-200 bg-white p-0 shadow-2xl">
          <DialogHeader className="border-b border-slate-200 px-4 py-3">
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-emerald-600" />
              {toolInspectorModal.title || 'Tool Run Details'}
              {toolInspectorModal.runs.length > 1 ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  {toolInspectorModal.runs.length} runs
                </span>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-62px)] space-y-3 overflow-y-auto bg-slate-50/40 p-4">
            {toolInspectorModal.runs.length === 0 ? (
              <div className="rounded border border-slate-200 bg-white p-3 text-sm text-slate-600">
                No tool run details were captured for this message.
              </div>
            ) : (
              toolInspectorModal.runs.map((run, index) => {
                const primaryDetail = getToolRunPrimaryDetail(run);
                return (
                  <div
                    key={run.id || `${toolInspectorModal.toolName || 'tool'}-${index + 1}`}
                    className="rounded-xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
                      <span className="text-sm font-semibold text-slate-900">
                        Run {index + 1}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        run.status === 'failed'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {run.status === 'failed' ? 'Failed' : 'Completed'}
                      </span>
                      {primaryDetail ? (
                        <code className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                          {primaryDetail}
                        </code>
                      ) : null}
                    </div>
                    <div className="space-y-3 p-4">
                      <div>
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Input
                        </div>
                        <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                          {formatToolPayload(run.input)}
                        </pre>
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Output
                        </div>
                        <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                          {formatToolPayload(run.output)}
                        </pre>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resourcesModal.open} onOpenChange={(open) => {
        if (!open) closeResourcesModal();
      }}>
        <DialogContent className="max-w-3xl border border-slate-200 bg-white shadow-2xl">
          <DialogHeader>
            <DialogTitle>{resourcesModal.title || 'Affected Resources'}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {resourcesModal.resources.length === 0 ? (
              <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                No affected resources were provided for this recommendation.
              </div>
            ) : (
              <div className="space-y-2">
                {resourcesModal.resources.map((resource, index) => (
                  <div
                    key={`${resource?.id || resource?.resourceId || 'resource'}-${index}`}
                    className="rounded border border-slate-200 bg-white p-3"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {resource?.displayName || resource?.id || `Resource ${index + 1}`}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-slate-600">
                      {resource?.resourceType ? <span className="rounded bg-slate-100 px-2 py-0.5">{resource.resourceType}</span> : null}
                      {resource?.environmentName ? <span className="rounded bg-slate-100 px-2 py-0.5">Env: {resource.environmentName}</span> : null}
                      {resource?.workloadName ? <span className="rounded bg-slate-100 px-2 py-0.5">Workload: {resource.workloadName}</span> : null}
                      {resource?.accountId ? <span className="rounded bg-slate-100 px-2 py-0.5">Account: {resource.accountId}</span> : null}
                      {resource?.region ? <span className="rounded bg-slate-100 px-2 py-0.5">Region: {resource.region}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <RecommendationBlueprintRunFlow
        open={recommendationBlueprintFlow.open}
        recommendation={recommendationBlueprintFlow.recommendation}
        onClose={() =>
          setRecommendationBlueprintFlow({
            open: false,
            recommendation: null,
          })
        }
      />
    </div>
  );
}
