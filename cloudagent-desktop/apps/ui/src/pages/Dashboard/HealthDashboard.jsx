import React, { useMemo, useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { loadWorkloadsFromUserProfile } from '@/features/workload/workloadSlice';
import {
  launchHealthScans,
  refreshEnvironmentHealth,
  refreshWorkloadHealth,
  selectEnvironmentHealthRequestsById,
  selectEnvironmentHealthResultsById,
  selectWorkloadHealthRequestsById,
  selectWorkloadHealthResultsById,
} from '@/features/health/healthSlice';
import { DEFAULT_HEALTH_MAX_AGE_HOURS } from '@/features/health/healthUtils';
import {
  HeartPulse,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  Box,
  Search,
  Filter,
  ExternalLink,
  Loader2,
  ChevronsUpDown,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  matchesEnvironmentProfile,
  matchesWorkload,
  selectActiveWorkspaceScope,
} from '@/features/workspace/workspaceScope';
import { isSystemWorkload } from '@/features/workload/workloadEnvironmentUtils';
import { Icons } from '@/components/icons';

const safeParseJson = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeHealthStatus = (status) => {
  const normalized = typeof status === 'string' ? status.toLowerCase().trim() : '';
  if (normalized === 'healthy') return 'healthy';
  if (normalized === 'problem' || normalized === 'error') return 'unhealthy';
  if (normalized === 'not_applicable') return 'not_applicable';
  return 'unknown';
};

const isSkippedError = (errorText) => {
  if (typeof errorText !== 'string') return false;
  const lower = errorText.toLowerCase();
  return lower.includes('not implemented') || lower.includes('not supported');
};

const isNotApplicableHealthMessage = (errorText) =>
  typeof errorText === 'string' &&
  errorText.trim().toLowerCase() === 'no health checks were returned for this resource.';

const isUnsupportedPresencePlaceholderCheck = (check) => {
  if (!check || typeof check !== 'object') return false;
  const summary = String(check?.summary || '').trim().toLowerCase();
  const checkName = String(check?.checkName || '').trim().toLowerCase();
  return (
    checkName === 'resource presence (not deleted)' &&
    summary.includes('presence check is unavailable') &&
    summary.includes('not implemented yet')
  );
};

const hasOnlyUnsupportedHealthPlaceholder = (checks = [], errors = []) => {
  const safeChecks = Array.isArray(checks) ? checks : [];
  const safeErrors = Array.isArray(errors) ? errors : [];
  const realErrors = safeErrors.filter((errorText) => !isSkippedError(errorText));
  const skippedErrors = safeErrors.filter(isSkippedError);

  if (realErrors.length > 0) return false;
  if (safeChecks.length === 0) return skippedErrors.length > 0;

  return (
    skippedErrors.length === safeErrors.length &&
    safeChecks.every((check) => isUnsupportedPresencePlaceholderCheck(check))
  );
};

const getResourceHealthStatus = (resource) => {
  const checks = Array.isArray(resource?.health?.checks)
    ? resource.health.checks
    : [];
  const allErrors = Array.isArray(resource?.health?.errors)
    ? resource.health.errors
    : [];
  const notApplicable = resource?.health?.notApplicable === true;
  const notApplicableErrors = allErrors.filter(isNotApplicableHealthMessage);
  const realErrors = allErrors.filter((e) => !isSkippedError(e));
  const skippedErrors = allErrors.filter(isSkippedError);

  if (notApplicable || (checks.length === 0 && notApplicableErrors.length > 0)) {
    return 'not_applicable';
  }
  if (checks.length === 0 && skippedErrors.length > 0 && realErrors.length === 0) {
    return 'skipped';
  }
  if (checks.length === 0 && allErrors.length === 0) {
    return 'not_checked';
  }

  if (realErrors.length > 0) {
    return 'unhealthy';
  }

  const checkStatuses = checks.map((check) => normalizeHealthStatus(check?.status));
  if (checkStatuses.includes('unhealthy')) {
    return 'unhealthy';
  }
  if (checkStatuses.includes('healthy')) {
    return 'healthy';
  }
  if (checkStatuses.includes('unknown')) {
    return 'unknown';
  }
  if (checkStatuses.includes('not_applicable')) {
    return 'not_applicable';
  }

  return 'healthy';
};

const getResourceHealthCounts = (resource) => {
  const checks = Array.isArray(resource?.health?.checks)
    ? resource.health.checks
    : [];
  const errors = Array.isArray(resource?.health?.errors)
    ? resource.health.errors
    : [];

  let healthy = 0;
  let unhealthy = 0;
  let unknown = 0;
  let notApplicable = 0;

  checks.forEach((check) => {
    const status = normalizeHealthStatus(check?.status);
    if (status === 'healthy') {
      healthy += 1;
    } else if (status === 'unhealthy') {
      unhealthy += 1;
    } else if (status === 'not_applicable') {
      notApplicable += 1;
    } else {
      unknown += 1;
    }
  });

  return { healthy, unhealthy, unknown, notApplicable, errors: errors.length, total: checks.length };
};

const getRealHealthErrors = (resource) => {
  const allErrors = Array.isArray(resource?.health?.errors)
    ? resource.health.errors
    : [];
  return allErrors.filter(
    (errorText) => !isSkippedError(errorText) && !isNotApplicableHealthMessage(errorText)
  );
};

const getResourceIssueLabels = (resource) => {
  const issueLabels = new Set();
  const checks = Array.isArray(resource?.health?.checks)
    ? resource.health.checks
    : [];

  checks.forEach((check) => {
    if (normalizeHealthStatus(check?.status) !== 'unhealthy') return;
    const label =
      String(check?.checkName || check?.checkId || check?.summary || 'Unknown issue').trim();
    if (label) issueLabels.add(label);
  });

  getRealHealthErrors(resource).forEach((errorText) => {
    const label = String(errorText || '').trim();
    if (label) issueLabels.add(label);
  });

  return Array.from(issueLabels);
};

const resourceMatchesIssueLabel = (resource, issueLabel) => {
  const normalizedIssueLabel = String(issueLabel || '').trim().toLowerCase();
  if (!normalizedIssueLabel) return false;
  return getResourceIssueLabels(resource).some(
    (label) => String(label || '').trim().toLowerCase() === normalizedIssueLabel
  );
};

const buildResourceSearchIndex = (resource) => {
  if (!resource || typeof resource !== 'object') return '';

  const checks = Array.isArray(resource?.health?.checks)
    ? resource.health.checks
    : [];
  const errors = Array.isArray(resource?.health?.errors)
    ? resource.health.errors
    : [];

  const checkSearchText = checks
    .flatMap((check) => [
      check?.checkName,
      check?.checkId,
      check?.summary,
      typeof check?.details === 'object' && check.details
        ? JSON.stringify(check.details)
        : '',
    ])
    .filter(Boolean)
    .join(' ');

  return [
    resource?.displayName,
    resource?.resourceType,
    resource?.resourceArn,
    resource?.identifier,
    resource?.resourceId,
    checkSearchText,
    errors.join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
};

const normalizeTrackedResourceForDashboard = (resource) => {
  if (!resource || typeof resource !== 'object') return null;
  return normalizeDashboardResource({
    ...resource,
    resourceType: resource?.canonicalResourceType || resource?.resourceType || resource?.type || '',
    identifier:
      resource?.identifier ||
      resource?.resourceArn ||
      resource?.resourceId ||
      resource?.displayName ||
      '',
  });
};

const formatInsightLabel = (value, maxLength = 88) => {
  const label = String(value || '').trim();
  if (!label) return 'Unknown';
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}...` : label;
};

const formatRelativeTime = (dateString) => {
  if (!dateString) return 'Never';
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const parseSummaryObject = (summary) => {
  if (!summary) return {};
  if (typeof summary === 'object') return summary;
  if (typeof summary !== 'string') return {};
  try {
    const parsed = JSON.parse(summary);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const toTimestampMs = (value) => {
  if (!value) return null;
  const ts = Date.parse(String(value));
  return Number.isFinite(ts) && ts > 0 ? ts : null;
};

const isFreshTimestamp = (value, maxAgeHours = DEFAULT_HEALTH_MAX_AGE_HOURS) => {
  const ts = toTimestampMs(value);
  if (!ts) return false;
  return Date.now() - ts < maxAgeHours * 60 * 60 * 1000;
};

const getHealthGeneratedAt = (healthMeta = {}) =>
  healthMeta?.generatedAt || healthMeta?.createdAt || healthMeta?.timestamp || '';

const getWorkloadEnvironmentProfileId = (workload) =>
  String(parseSummaryObject(workload?.metadata)?.environmentProfileId || '').trim();

const getWorkloadEnvironmentProfileIds = (workload) => {
  const ids = new Set();
  const add = (value) => {
    const id = String(value || '').trim();
    if (id) ids.add(id);
  };
  const visit = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'string') {
      add(value);
      return;
    }
    if (typeof value !== 'object') return;
    add(value.profileId);
    add(value.environmentProfileId);
    add(value.permissionProfileId);
    add(value.recordId);
    add(value.id);
  };

  const metadata = parseSummaryObject(workload?.metadata);
  visit(metadata?.environmentProfileId);
  visit(metadata?.environment);
  visit(workload?.environmentProfileId);
  visit(workload?.environment);
  visit(workload?.environments);
  return Array.from(ids);
};

const isAwsAccountProfile = (profile) => {
  const normalizedType = String(profile?.type || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');
  return normalizedType === 'aws account';
};

const isAzureSubscriptionProfile = (profile) => {
  const normalizedType = String(profile?.type || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');
  return normalizedType === 'azure subscription';
};

const getProfileCloudProvider = (profile) =>
  isAzureSubscriptionProfile(profile) ? 'azure' : 'aws';

const getCloudProviderIcon = (provider, className = 'h-3.5 w-3.5 shrink-0') => {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  if (normalizedProvider === 'azure') {
    return <Icons.azure className={className} />;
  }
  return <Icons.aws className={className} />;
};

const isAzureTrackedResource = (resource) => {
  const resourceType = String(
    resource?.canonicalResourceType || resource?.resourceType || resource?.type || ''
  ).toLowerCase();
  const resourceId = String(resource?.resourceId || resource?.identifier || '').toLowerCase();
  return resourceType.startsWith('microsoft.') || resourceId.startsWith('/subscriptions/');
};

const extractAccountIdFromArn = (value) => {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed.startsWith('arn:')) return '';
  const parts = trimmed.split(':');
  return parts.length >= 5 ? parts[4] : '';
};

const resolveResourceAccountId = (resource) =>
  resource?.accountId ||
  extractAccountIdFromArn(resource?.resourceArn) ||
  extractAccountIdFromArn(resource?.identifier) ||
  '';

const resolveResourcePermissionProfileId = (resource) =>
  String(
    resource?.permissionProfileId ||
      resource?.health?.permissionProfileId ||
      resource?.health?.result?.permissionProfileId ||
      ''
  ).trim();

const buildResourceIdentityKey = (resource) => {
  const normalized = resource || {};
  const scopeKey =
    resolveResourcePermissionProfileId(normalized) ||
    resolveResourceAccountId(normalized) ||
    'unscoped';
  return [
    normalized?.resourceType || '',
    normalized?.resourceArn ||
      normalized?.identifier ||
      normalized?.resourceId ||
      normalized?.displayName ||
      '',
    normalized?.region || '',
    scopeKey,
  ].join('|');
};

const formatResourceTypeForDisplay = (resourceType) => {
  if (!resourceType || typeof resourceType !== 'string') return '—';
  const parts = resourceType.split('::').filter(Boolean);
  if (parts.length >= 2) return parts.slice(-2).join('::');
  return resourceType;
};

const extractHealthResources = (payload) => {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload?.resources)) return payload.resources;
  if (Array.isArray(payload?.result?.resources)) return payload.result.resources;
  if (Array.isArray(payload?.output?.resources)) return payload.output.resources;
  if (Array.isArray(payload?.data?.resources)) return payload.data.resources;
  if (Array.isArray(payload?.health?.resources)) return payload.health.resources;
  if (Array.isArray(payload?.analysis?.resources)) return payload.analysis.resources;
  if (Array.isArray(payload?.input?.resources)) return payload.input.resources;

  if (payload?.resources && typeof payload.resources === 'object') {
    return Object.values(payload.resources).filter(Boolean);
  }

  return [];
};

const normalizeHealthResponseShape = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  const resources = extractHealthResources(payload);
  if (Array.isArray(payload.resources)) return payload;
  return {
    ...payload,
    resources,
  };
};

const normalizeDashboardResource = (resource, fallbackGeneratedAt = '') => {
  if (!resource || typeof resource !== 'object') return null;

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
  const shouldSuppressUnsupportedPlaceholder = hasOnlyUnsupportedHealthPlaceholder(checks, errors);

  const generatedAt =
    resourceHealth?.generatedAt || resource?.generatedAt || fallbackGeneratedAt || '';

  const base = { ...resource };
  delete base.checks;
  delete base.errors;

  return {
    ...base,
    health: {
      ...(resourceHealth || {}),
      checks: shouldSuppressUnsupportedPlaceholder ? [] : checks,
      errors: shouldSuppressUnsupportedPlaceholder ? [] : errors,
      generatedAt,
      result: {
        resourceType: resource?.resourceType || '',
        identifier:
          resource?.identifier ||
          resource?.resourceArn ||
          resource?.resourceId ||
          resource?.displayName ||
          '',
        resourceArn: resource?.resourceArn || '',
        resourceId: resource?.resourceId || '',
        region: resource?.region || '',
        accountId: resource?.accountId || '',
        displayName: resource?.displayName || '',
        ...(resourceHealth?.result && typeof resourceHealth.result === 'object'
          ? resourceHealth.result
          : {}),
      },
    },
  };
};

const toFiniteCount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
};

const normalizeCountMap = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, count]) => [String(key || '').trim(), toFiniteCount(count)])
      .filter(([key, count]) => key && count > 0)
  );
};

const buildEmptyHealthSummary = () => ({
  resourceCounts: {
    total: 0,
    evaluated: 0,
    healthy: 0,
    issues: 0,
    notChecked: 0,
    skipped: 0,
  },
  healthScore: 0,
  issueCounts: {},
  resourceTypeCounts: {},
});

const normalizeHealthSummary = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return buildEmptyHealthSummary();
  }

  const resourceCounts =
    value.resourceCounts && typeof value.resourceCounts === 'object'
      ? value.resourceCounts
      : {};
  const normalized = buildEmptyHealthSummary();
  normalized.resourceCounts = {
    total: toFiniteCount(resourceCounts.total),
    evaluated: toFiniteCount(resourceCounts.evaluated),
    healthy: toFiniteCount(resourceCounts.healthy),
    issues: toFiniteCount(resourceCounts.issues),
    notChecked: toFiniteCount(resourceCounts.notChecked),
    skipped: toFiniteCount(resourceCounts.skipped),
  };
  normalized.issueCounts = normalizeCountMap(value.issueCounts);
  normalized.resourceTypeCounts = normalizeCountMap(value.resourceTypeCounts);
  normalized.healthScore =
    normalized.resourceCounts.evaluated > 0
      ? Math.round(
          (normalized.resourceCounts.healthy / normalized.resourceCounts.evaluated) * 100
        )
      : 0;
  return normalized;
};

const extractStoredHealthSummary = (value) => {
  const summary = parseSummaryObject(value);
  const analysis =
    summary?.analysis && typeof summary.analysis === 'object' ? summary.analysis : {};
  const health =
    analysis?.health && typeof analysis.health === 'object' ? analysis.health : {};
  return normalizeHealthSummary(health?.summary);
};

const mergeHealthSummaries = (summaries = []) => {
  const merged = buildEmptyHealthSummary();

  (summaries || []).forEach((summary) => {
    const normalized = normalizeHealthSummary(summary);
    Object.keys(merged.resourceCounts).forEach((key) => {
      merged.resourceCounts[key] += toFiniteCount(normalized.resourceCounts[key]);
    });
    Object.entries(normalized.issueCounts).forEach(([key, count]) => {
      merged.issueCounts[key] = (merged.issueCounts[key] || 0) + toFiniteCount(count);
    });
    Object.entries(normalized.resourceTypeCounts).forEach(([key, count]) => {
      merged.resourceTypeCounts[key] =
        (merged.resourceTypeCounts[key] || 0) + toFiniteCount(count);
    });
  });

  merged.healthScore =
    merged.resourceCounts.evaluated > 0
      ? Math.round(
          (merged.resourceCounts.healthy / merged.resourceCounts.evaluated) * 100
        )
      : 0;

  return merged;
};

const buildHealthSummaryFromTrackedResources = (resources = []) => {
  const summary = buildEmptyHealthSummary();

  (Array.isArray(resources) ? resources : []).forEach((resource) => {
    const normalizedResource = normalizeDashboardResource(resource);
    if (!normalizedResource) return;

    summary.resourceCounts.total += 1;
    const status = getResourceHealthStatus(normalizedResource);

    if (status === 'healthy') {
      summary.resourceCounts.evaluated += 1;
      summary.resourceCounts.healthy += 1;
      return;
    }

    if (status === 'unhealthy') {
      summary.resourceCounts.evaluated += 1;
      summary.resourceCounts.issues += 1;

      getResourceIssueLabels(normalizedResource).forEach((label) => {
        summary.issueCounts[label] = (summary.issueCounts[label] || 0) + 1;
      });

      const resourceType = String(normalizedResource?.resourceType || '').trim();
      if (resourceType) {
        summary.resourceTypeCounts[resourceType] =
          (summary.resourceTypeCounts[resourceType] || 0) + 1;
      }
      return;
    }

    if (status === 'skipped') {
      summary.resourceCounts.skipped += 1;
      return;
    }

    summary.resourceCounts.notChecked += 1;
  });

  summary.healthScore =
    summary.resourceCounts.evaluated > 0
      ? Math.round(
          (summary.resourceCounts.healthy / summary.resourceCounts.evaluated) * 100
        )
      : 0;

  return summary;
};

const toTopCountEntries = (value, keyName, limit = null) => {
  const sorted = Object.entries(normalizeCountMap(value))
    .map(([key, count]) => ({
      [keyName]: key,
      resourceCount: count,
    }))
    .sort((a, b) => {
      if (b.resourceCount !== a.resourceCount) return b.resourceCount - a.resourceCount;
      return String(a[keyName] || '').localeCompare(String(b[keyName] || ''));
    });
  return limit ? sorted.slice(0, limit) : sorted;
};

const getSummaryIssueCount = (summary, issueLabel) =>
  toFiniteCount(normalizeCountMap(summary?.issueCounts)[String(issueLabel || '').trim()]);

const getSummaryResourceTypeCount = (summary, resourceTypeDisplay) =>
  Object.entries(normalizeCountMap(summary?.resourceTypeCounts)).reduce((sum, [resourceType, count]) => {
    return formatResourceTypeForDisplay(resourceType) === resourceTypeDisplay
      ? sum + toFiniteCount(count)
      : sum;
  }, 0);

export default function HealthDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { workloads } = useSelector((state) => state.workload);
  const { userProfile } = useSelector((state) => state.auth);
  const activeWorkspaceScope = useSelector(selectActiveWorkspaceScope);
  const workloadHealthRequestMap = useSelector(selectWorkloadHealthRequestsById);
  const environmentHealthRequestMap = useSelector(selectEnvironmentHealthRequestsById);
  const workloadHealthResults = useSelector(selectWorkloadHealthResultsById);
  const environmentHealthResultRecords = useSelector(selectEnvironmentHealthResultsById);

  const dashboardWorkloads = useMemo(() => {
    const byId = new Map();

    (workloads || []).forEach((workload) => {
      if (!workload?.workloadId) return;
      byId.set(workload.workloadId, workload);
    });

    (userProfile?.workloads || []).forEach((workload) => {
      if (!workload?.workloadId) return;
      const current = byId.get(workload.workloadId) || {};
      byId.set(workload.workloadId, {
        ...current,
        ...workload,
      });
    });

    return Array.from(byId.values())
      .filter((workload) => !isSystemWorkload(workload))
      .filter((workload) => matchesWorkload(workload, activeWorkspaceScope));
  }, [activeWorkspaceScope, workloads, userProfile?.workloads]);

  const dashboardWorkloadsById = useMemo(() => {
    const map = new Map();
    (dashboardWorkloads || []).forEach((workload) => {
      if (!workload?.workloadId) return;
      map.set(workload.workloadId, workload);
    });
    return map;
  }, [dashboardWorkloads]);

  // Load workloads from userProfile if not already in store
  useEffect(() => {
    if (
      userProfile?.workloads &&
      userProfile.workloads.length > 0 &&
      workloads.length === 0
    ) {
      dispatch(loadWorkloadsFromUserProfile(userProfile.workloads));
    }
  }, [userProfile?.workloads, workloads.length, dispatch]);
  
  const [filterText, setFilterText] = useState('');
  const [activeIssueFilter, setActiveIssueFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [scopeComboOpen, setScopeComboOpen] = useState(false);
  const [expandedResourceKey, setExpandedResourceKey] = useState('');
  const [healthDetailsModal, setHealthDetailsModal] = useState({ open: false, resource: null });
  const [dataFreshnessModalOpen, setDataFreshnessModalOpen] = useState(false);
  
  const [healthCheckOptionsModal, setHealthCheckOptionsModal] = useState({
    open: false,
    workloadId: null,
    isAllWorkloads: false,
    permissionProfileId: null,
    isAllEnvironments: false,
  });
  const [healthCheckLookbackDays, setHealthCheckLookbackDays] = useState(5);
  const [includeCloudWatchLogChecks, setIncludeCloudWatchLogChecks] = useState(false);
  const [forceRegenerateHealthReport, setForceRegenerateHealthReport] = useState(true);

  useEffect(() => {
    const nextScopeFilter = location.state?.scopeFilter;
    if (!nextScopeFilter || typeof nextScopeFilter !== 'string') return;

    setScopeFilter(nextScopeFilter);
    setFilterText('');
    setActiveIssueFilter('');
    setStatusFilter('unhealthy');

    navigate(location.pathname, {
      replace: true,
      state: null,
    });
  }, [location.pathname, location.state, navigate]);

  const refreshingWorkloadIds = useMemo(() => {
    const next = new Set();
    Object.entries(workloadHealthRequestMap || {}).forEach(([workloadId, request]) => {
      if (request?.status === 'loading') {
        next.add(workloadId);
      }
    });
    return next;
  }, [workloadHealthRequestMap]);

  const refreshingEnvironmentIds = useMemo(() => {
    const next = new Set();
    Object.entries(environmentHealthRequestMap || {}).forEach(([permissionProfileId, request]) => {
      if (request?.status === 'loading') {
        next.add(permissionProfileId);
      }
    });
    return next;
  }, [environmentHealthRequestMap]);

  const environmentHealthResults = useMemo(() => {
    const next = {};
    Object.entries(environmentHealthResultRecords || {}).forEach(([permissionProfileId, record]) => {
      next[permissionProfileId] = record?.payload || null;
    });
    return next;
  }, [environmentHealthResultRecords]);

  const environmentProfiles = useMemo(() => {
    return (userProfile?.agentPermissionProfiles || [])
      .filter((profile) => isAwsAccountProfile(profile) || isAzureSubscriptionProfile(profile))
      .filter((profile) => matchesEnvironmentProfile(profile, activeWorkspaceScope))
      .map((profile) => {
        const permissionProfileId = profile.recordId || profile.id || profile.permissionProfileId;
        if (!permissionProfileId) return null;
        const authProfile = safeParseJson(profile.authProfile, {});
        const cloudProvider = getProfileCloudProvider(profile);
        const accountId =
          cloudProvider === 'azure'
            ? authProfile?.subscriptionId || authProfile?.accountId || ''
            : authProfile?.awsAccountId || authProfile?.aws_account_id || authProfile?.accountId || '';
        const summary = parseSummaryObject(profile.summary);
        const analysis =
          summary?.analysis && typeof summary.analysis === 'object' ? summary.analysis : {};
        const storedHealthMeta =
          analysis?.health && typeof analysis.health === 'object' ? analysis.health : {};
        const livePayload = environmentHealthResults[permissionProfileId];
        const liveAnalysis =
          livePayload?.analysis && typeof livePayload.analysis === 'object'
            ? livePayload.analysis
            : {};
        const liveHealthMeta =
          liveAnalysis?.health && typeof liveAnalysis.health === 'object'
            ? liveAnalysis.health
            : null;
        const healthMeta = liveHealthMeta || storedHealthMeta;
        const inventoryMeta =
          analysis?.inventory && typeof analysis.inventory === 'object' ? analysis.inventory : {};
        const healthGeneratedAt =
          livePayload?.generatedAt || getHealthGeneratedAt(healthMeta);
        const storedHealthSummary = normalizeHealthSummary(healthMeta?.summary);
        const liveResourceSummary = buildHealthSummaryFromTrackedResources(
          extractHealthResources(normalizeHealthResponseShape(livePayload))
        );
        const healthSummary =
          liveResourceSummary.resourceCounts.total > 0
            ? liveResourceSummary
            : storedHealthSummary;

        return {
          permissionProfileId: String(permissionProfileId),
          profileName: profile.name || 'Cloud Environment',
          cloudProvider,
          accountId: accountId ? String(accountId) : '',
          healthSummary,
          hasHealthData:
            Boolean(healthGeneratedAt) ||
            Boolean(healthMeta?.objectKey || healthMeta?.path || healthMeta?.fileName),
          healthGeneratedAt,
          hasFreshHealthData: isFreshTimestamp(
            healthGeneratedAt,
            DEFAULT_HEALTH_MAX_AGE_HOURS
          ),
          inventoryGeneratedAt:
            inventoryMeta?.generatedAt || inventoryMeta?.createdAt || inventoryMeta?.timestamp || '',
        };
      })
      .filter(Boolean);
  }, [activeWorkspaceScope, userProfile?.agentPermissionProfiles, environmentHealthResults]);

  const workloadHealthInfo = useMemo(
    () =>
      (dashboardWorkloads || []).map((workload) => {
        const storedHealthSummary = extractStoredHealthSummary(workload?.summary);
        const summary = parseSummaryObject(workload?.summary);
        const analysis =
          summary?.analysis && typeof summary.analysis === 'object' ? summary.analysis : {};
        const healthMeta =
          analysis?.health && typeof analysis.health === 'object' ? analysis.health : {};
        const trackedResources = safeParseJson(workload?.trackedResources, { resources: [] });
        const trackedResourceItems = Array.isArray(trackedResources?.resources)
          ? trackedResources.resources
          : [];
        const trackedResourceCount = trackedResourceItems.length;
        const trackedHealthSummary = buildHealthSummaryFromTrackedResources(trackedResourceItems);
        const healthSummary =
          trackedResourceCount > 0
            ? trackedHealthSummary
            : storedHealthSummary.resourceCounts.evaluated > 0 ||
                storedHealthSummary.resourceCounts.total > 0
              ? storedHealthSummary
              : trackedHealthSummary;
        const totalResources =
          toFiniteCount(healthSummary?.resourceCounts?.total) || trackedResourceCount;

        return {
          workloadId: workload.workloadId,
          workloadName: workload.workloadName,
          healthSummary,
          resourceCount: totalResources,
          lastHealthCheck:
            workloadHealthResults?.[workload.workloadId]?.generatedAt ||
            getHealthGeneratedAt(healthMeta) ||
            '',
          hasHealthData:
            Boolean(getHealthGeneratedAt(healthMeta)) ||
            Boolean(workloadHealthResults?.[workload.workloadId]?.generatedAt),
        };
      }),
    [dashboardWorkloads, workloadHealthResults]
  );

  const environmentHealthInfo = useMemo(
    () =>
      environmentProfiles.map((environment) => ({
        permissionProfileId: environment.permissionProfileId,
        profileName: environment.profileName,
        environmentName: environment.profileName,
        cloudProvider: environment.cloudProvider,
        accountId: environment.accountId,
        healthSummary: environment.healthSummary,
        resourceCount: toFiniteCount(environment.healthSummary?.resourceCounts?.total),
        lastHealthCheck: environment.healthGeneratedAt || '',
        hasHealthData: environment.hasHealthData,
      })),
    [environmentProfiles]
  );

  const environmentByProfileId = useMemo(() => {
    const map = new Map();
    environmentProfiles.forEach((environment) => {
      map.set(environment.permissionProfileId, environment);
    });
    return map;
  }, [environmentProfiles]);

  const environmentByAccountId = useMemo(() => {
    const map = new Map();
    environmentProfiles.forEach((environment) => {
      if (environment.accountId && !map.has(environment.accountId)) {
        map.set(environment.accountId, environment);
      }
    });
    return map;
  }, [environmentProfiles]);

  const workloadProviderById = useMemo(() => {
    const map = new Map();
    (dashboardWorkloads || []).forEach((workload) => {
      const profileProviders = getWorkloadEnvironmentProfileIds(workload)
        .map((profileId) => environmentByProfileId.get(profileId)?.cloudProvider)
        .filter(Boolean);
      if (profileProviders.includes('azure')) {
        map.set(workload.workloadId, 'azure');
        return;
      }

      const trackedResources = safeParseJson(workload?.trackedResources, { resources: [] });
      const resources = Array.isArray(trackedResources?.resources) ? trackedResources.resources : [];
      if (resources.some(isAzureTrackedResource)) {
        map.set(workload.workloadId, 'azure');
        return;
      }

      map.set(workload.workloadId, 'aws');
    });
    return map;
  }, [dashboardWorkloads, environmentByProfileId]);

  const workloadRefsByResourceIdentity = useMemo(() => {
    const map = new Map();
    (dashboardWorkloads || []).forEach((workload) => {
      if (!workload?.workloadId) return;
      const trackedResources = safeParseJson(workload?.trackedResources, { resources: [] });
      const resources = Array.isArray(trackedResources?.resources) ? trackedResources.resources : [];
      resources.forEach((resource) => {
        const normalized = normalizeTrackedResourceForDashboard(resource);
        if (!normalized) return;
        const key = buildResourceIdentityKey(normalized);
        if (!map.has(key)) {
          map.set(key, []);
        }
        if (!map.get(key).some((item) => item.workloadId === workload.workloadId)) {
          map.get(key).push({
            workloadId: workload.workloadId,
            workloadName: workload.workloadName,
          });
        }
      });
    });
    return map;
  }, [dashboardWorkloads]);

  const selectedWorkloadId = scopeFilter.startsWith('workload:')
    ? scopeFilter.slice('workload:'.length)
    : null;
  const selectedEnvironmentId = scopeFilter.startsWith('environment:')
    ? scopeFilter.slice('environment:'.length)
    : null;
  const selectedWorkload = selectedWorkloadId
    ? workloadHealthInfo.find((w) => w.workloadId === selectedWorkloadId)
    : null;
  const selectedEnvironment = selectedEnvironmentId
    ? environmentHealthInfo.find((e) => e.permissionProfileId === selectedEnvironmentId)
    : null;
  const isAllScopesSelected = scopeFilter === 'all';

  const scopeTriggerLabel = useMemo(() => {
    if (scopeFilter === 'all') {
      return 'All Workloads & Environments';
    }
    if (selectedWorkload) {
      return `Workload: ${selectedWorkload.workloadName || 'Untitled'}`;
    }
    if (selectedEnvironment) {
      return `Environment: ${
        selectedEnvironment.profileName ||
        selectedEnvironment.environmentName ||
        selectedEnvironment.accountId ||
        'Cloud Environment'
      }`;
    }
    return 'All Workloads & Environments';
  }, [scopeFilter, selectedWorkload, selectedEnvironment]);

  const selectedScopeHeader = useMemo(() => {
    if (selectedWorkload) {
      return {
        typeLabel: 'Workload',
        title: selectedWorkload.workloadName || 'Untitled Workload',
        lastRefreshedAt: selectedWorkload.lastHealthCheck || '',
      };
    }
    if (selectedEnvironment) {
      return {
        typeLabel: 'Environment',
        title:
          selectedEnvironment.profileName ||
          selectedEnvironment.environmentName ||
          selectedEnvironment.accountId ||
          'Cloud Environment',
        lastRefreshedAt: selectedEnvironment.lastHealthCheck || '',
      };
    }
    return null;
  }, [selectedWorkload, selectedEnvironment]);

  const selectedScopeCloudProvider = useMemo(() => {
    if (selectedWorkloadId) {
      return workloadProviderById.get(selectedWorkloadId) || 'aws';
    }
    if (selectedEnvironmentId) {
      return (
        environmentByProfileId.get(selectedEnvironmentId)?.cloudProvider ||
        selectedEnvironment?.cloudProvider ||
        'aws'
      );
    }
    return '';
  }, [
    environmentByProfileId,
    selectedEnvironment,
    selectedEnvironmentId,
    selectedWorkloadId,
    workloadProviderById,
  ]);

  useEffect(() => {
    if (scopeFilter === 'all') return;
    if (selectedWorkloadId && !selectedWorkload) {
      setScopeFilter('all');
      return;
    }
    if (selectedEnvironmentId && !selectedEnvironment) {
      setScopeFilter('all');
    }
  }, [
    scopeFilter,
    selectedEnvironment,
    selectedEnvironmentId,
    selectedWorkload,
    selectedWorkloadId,
  ]);

  const allEnvironmentSummary = useMemo(
    () => mergeHealthSummaries(environmentHealthInfo.map((item) => item.healthSummary)),
    [environmentHealthInfo]
  );

  const dashboardSummary = useMemo(() => {
    if (selectedWorkload) {
      return normalizeHealthSummary(selectedWorkload.healthSummary);
    }
    if (selectedEnvironment) {
      return normalizeHealthSummary(selectedEnvironment.healthSummary);
    }
    return allEnvironmentSummary;
  }, [selectedWorkload, selectedEnvironment, allEnvironmentSummary]);

  const totals = dashboardSummary.resourceCounts;

  const topIssueInsights = useMemo(
    () => toTopCountEntries(dashboardSummary.issueCounts, 'issueLabel', isAllScopesSelected ? null : 5),
    [dashboardSummary, isAllScopesSelected]
  );

  const topIssueResourceTypes = useMemo(
    () =>
      toTopCountEntries(dashboardSummary.resourceTypeCounts, 'resourceType', isAllScopesSelected ? null : 5).map((item) => ({
        ...item,
        resourceType: formatResourceTypeForDisplay(item.resourceType),
      })),
    [dashboardSummary, isAllScopesSelected]
  );

  const topWorkloadsWithIssues = useMemo(
    () =>
      (workloadHealthInfo || [])
        .map((workload) => {
          const issues = toFiniteCount(workload?.healthSummary?.resourceCounts?.issues);
          const evaluated = toFiniteCount(workload?.healthSummary?.resourceCounts?.evaluated);
          const total = toFiniteCount(workload?.healthSummary?.resourceCounts?.total);
          return {
            workloadId: workload.workloadId,
            workloadName: workload.workloadName || 'Untitled Workload',
            issues,
            evaluated,
            total,
            healthScore: toFiniteCount(workload?.healthSummary?.healthScore),
          };
        })
        .filter((workload) => workload.issues > 0)
        .sort((a, b) => {
          if (b.issues !== a.issues) return b.issues - a.issues;
          return a.workloadName.localeCompare(b.workloadName);
        })
        .slice(0, 5),
    [workloadHealthInfo]
  );

  const topEnvironmentsWithIssues = useMemo(
    () =>
      (environmentHealthInfo || [])
        .map((environment) => {
          const issues = toFiniteCount(environment?.healthSummary?.resourceCounts?.issues);
          const evaluated = toFiniteCount(environment?.healthSummary?.resourceCounts?.evaluated);
          const total = toFiniteCount(environment?.healthSummary?.resourceCounts?.total);
          return {
            permissionProfileId: environment.permissionProfileId,
            environmentName: environment.environmentName || 'Cloud Environment',
            accountId: environment.accountId || '',
            issues,
            evaluated,
            total,
            healthScore: toFiniteCount(environment?.healthSummary?.healthScore),
          };
        })
        .filter((environment) => environment.issues > 0)
        .sort((a, b) => {
          if (b.issues !== a.issues) return b.issues - a.issues;
          return a.environmentName.localeCompare(b.environmentName);
        })
        .slice(0, 5),
    [environmentHealthInfo]
  );

  const allScopeInsightMatches = useMemo(() => {
    if (!isAllScopesSelected) {
      return {
        title: '',
        workloads: [],
        environments: [],
      };
    }

    const selectedIssueLabel = String(activeIssueFilter || '').trim();
    const selectedResourceType = typeFilter !== 'all' ? String(typeFilter || '').trim() : '';
    if (!selectedIssueLabel && !selectedResourceType) {
      return {
        title: '',
        workloads: [],
        environments: [],
      };
    }

    const getCountForSummary = (summary) => {
      if (selectedIssueLabel) {
        return getSummaryIssueCount(summary, selectedIssueLabel);
      }
      if (selectedResourceType) {
        return getSummaryResourceTypeCount(summary, selectedResourceType);
      }
      return 0;
    };

    const workloads = (workloadHealthInfo || [])
      .map((workload) => ({
        workloadId: workload.workloadId,
        workloadName: workload.workloadName || 'Untitled Workload',
        resourceCount: getCountForSummary(workload.healthSummary),
      }))
      .filter((workload) => workload.resourceCount > 0)
      .sort((a, b) => {
        if (b.resourceCount !== a.resourceCount) return b.resourceCount - a.resourceCount;
        return a.workloadName.localeCompare(b.workloadName);
      })
      .slice(0, 8);

    const environments = (environmentHealthInfo || [])
      .map((environment) => ({
        permissionProfileId: environment.permissionProfileId,
        environmentName: environment.environmentName || 'Cloud Environment',
        accountId: environment.accountId || '',
        resourceCount: getCountForSummary(environment.healthSummary),
      }))
      .filter((environment) => environment.resourceCount > 0)
      .sort((a, b) => {
        if (b.resourceCount !== a.resourceCount) return b.resourceCount - a.resourceCount;
        return a.environmentName.localeCompare(b.environmentName);
      })
      .slice(0, 8);

    return {
      title: selectedIssueLabel
        ? `Issue: ${selectedIssueLabel}`
        : `Resource type: ${selectedResourceType}`,
      workloads,
      environments,
    };
  }, [
    isAllScopesSelected,
    activeIssueFilter,
    typeFilter,
    workloadHealthInfo,
    environmentHealthInfo,
  ]);
  const showAllScopeInsightMatches =
    isAllScopesSelected && (Boolean(activeIssueFilter) || typeFilter !== 'all');

  const currentScopeDetailPayload = useMemo(() => {
    if (selectedWorkloadId) {
      const workload = dashboardWorkloadsById.get(selectedWorkloadId);
      const trackedResources = safeParseJson(workload?.trackedResources, { resources: [] });
      const trackedResourceItems = Array.isArray(trackedResources?.resources)
        ? trackedResources.resources
        : [];
      const result = workloadHealthResults?.[selectedWorkloadId];
      if (!workload && !result) return null;
      const summary = parseSummaryObject(workload?.summary);
      const analysis =
        summary?.analysis && typeof summary.analysis === 'object' ? summary.analysis : {};
      const healthMeta =
        analysis?.health && typeof analysis.health === 'object' ? analysis.health : {};
      return {
        scopeType: 'workload',
        generatedAt:
          result?.generatedAt ||
          result?.updatedAt ||
          getHealthGeneratedAt(healthMeta) ||
          '',
        resources:
          Array.isArray(result?.resources) && result.resources.length > 0
            ? result.resources
            : trackedResourceItems,
      };
    }

    if (selectedEnvironmentId) {
      const payload = normalizeHealthResponseShape(environmentHealthResults[selectedEnvironmentId]);
      if (!payload) return null;
      return {
        scopeType: 'environment',
        generatedAt:
          payload?.generatedAt || payload?.analysis?.health?.generatedAt || '',
        resources: extractHealthResources(payload),
      };
    }

    return null;
  }, [
    selectedWorkloadId,
    selectedEnvironmentId,
    workloadHealthResults,
    environmentHealthResults,
    dashboardWorkloadsById,
  ]);

  const detailResources = useMemo(() => {
    if (!currentScopeDetailPayload) return [];

    const resolveEnvironmentForResource = (resource) => {
      const profileId = String(resolveResourcePermissionProfileId(resource) || '').trim();
      if (profileId && environmentByProfileId.has(profileId)) {
        const environment = environmentByProfileId.get(profileId);
        return {
          permissionProfileId: environment.permissionProfileId,
          environmentName: environment.profileName,
          accountId: environment.accountId,
        };
      }

      const accountId = String(resolveResourceAccountId(resource) || '').trim();
      if (accountId && environmentByAccountId.has(accountId)) {
        const environment = environmentByAccountId.get(accountId);
        return {
          permissionProfileId: environment.permissionProfileId,
          environmentName: environment.profileName,
          accountId: environment.accountId,
        };
      }

      return null;
    };

    return (currentScopeDetailPayload.resources || [])
      .map((resource) =>
        normalizeDashboardResource(resource, currentScopeDetailPayload.generatedAt)
      )
      .filter(Boolean)
      .map((resource) => {
        const resourceKey = buildResourceIdentityKey(resource);
        const selectedWorkloadEnvironmentProfileId = selectedWorkloadId
          ? getWorkloadEnvironmentProfileId(
              dashboardWorkloadsById.get(selectedWorkloadId)
            )
          : '';
        const environmentRef =
          selectedEnvironmentId && selectedEnvironment
            ? {
                permissionProfileId: selectedEnvironment.permissionProfileId,
                environmentName: selectedEnvironment.environmentName,
                accountId: selectedEnvironment.accountId,
              }
            : resolveEnvironmentForResource(resource) ||
              (selectedWorkloadEnvironmentProfileId &&
              environmentByProfileId.has(selectedWorkloadEnvironmentProfileId)
                ? {
                    permissionProfileId: selectedWorkloadEnvironmentProfileId,
                    environmentName:
                      environmentByProfileId.get(selectedWorkloadEnvironmentProfileId)
                        ?.profileName || '',
                    accountId:
                      environmentByProfileId.get(selectedWorkloadEnvironmentProfileId)
                        ?.accountId || '',
                  }
                : null);

        const workloadRefs =
          selectedWorkloadId && selectedWorkload
            ? [
                {
                  workloadId: selectedWorkload.workloadId,
                  workloadName: selectedWorkload.workloadName,
                },
              ]
            : workloadRefsByResourceIdentity.get(resourceKey) || [];

        return {
          resourceKey,
          resource,
          workloads: workloadRefs,
          environments: environmentRef ? [environmentRef] : [],
        };
      });
  }, [
    currentScopeDetailPayload,
    selectedEnvironment,
    selectedEnvironmentId,
    selectedWorkload,
    selectedWorkloadId,
    dashboardWorkloadsById,
    workloadRefsByResourceIdentity,
    environmentByProfileId,
    environmentByAccountId,
  ]);

  const filteredResources = useMemo(() => {
    let result = detailResources;

    if (filterText.trim()) {
      const searchLower = filterText.toLowerCase().trim();
      result = result.filter(({ resource, workloads: resourceWorkloads, environments }) => {
        const resourceSearchIndex = buildResourceSearchIndex(resource);
        const workloadNames = resourceWorkloads
          .map((w) => (w.workloadName || '').toLowerCase())
          .join(' ');
        const environmentNames = (environments || [])
          .map((e) => `${e.environmentName || ''} ${e.accountId || ''}`.toLowerCase())
          .join(' ');
        return (
          resourceSearchIndex.includes(searchLower) ||
          workloadNames.includes(searchLower) ||
          environmentNames.includes(searchLower)
        );
      });
    }

    if (typeFilter !== 'all') {
      result = result.filter(({ resource }) => {
        const type = formatResourceTypeForDisplay(resource?.resourceType);
        return type === typeFilter;
      });
    }

    if (activeIssueFilter) {
      result = result.filter(({ resource }) =>
        resourceMatchesIssueLabel(resource, activeIssueFilter)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(({ resource }) => getResourceHealthStatus(resource) === statusFilter);
    }

    return result;
  }, [detailResources, filterText, typeFilter, activeIssueFilter, statusFilter]);

  const availableTypeOptions = useMemo(() => {
    const set = new Set();
    detailResources.forEach(({ resource }) => {
      const type = formatResourceTypeForDisplay(resource?.resourceType);
      if (type && type !== '—') set.add(type);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [detailResources]);

  const availableStatusOptions = useMemo(() => {
    const set = new Set();
    detailResources.forEach(({ resource }) => {
      set.add(getResourceHealthStatus(resource));
    });
    const order = ['healthy', 'unhealthy', 'unknown', 'not_applicable', 'not_checked', 'skipped'];
    return order.filter((status) => set.has(status));
  }, [detailResources]);

  const statusLabelMap = {
    healthy: 'Healthy',
    unhealthy: 'Issues',
    unknown: 'Unknown',
    not_applicable: 'Not Applicable',
    not_checked: 'Not Checked',
    skipped: 'Skipped',
  };

  const handleIssueInsightClick = useCallback((issueLabel) => {
    setFilterText('');
    setTypeFilter('all');
    setStatusFilter('unhealthy');
    setActiveIssueFilter((current) => (current === issueLabel ? '' : issueLabel));
  }, []);

  const handleResourceTypeInsightClick = useCallback((resourceType) => {
    setTypeFilter(resourceType);
    setFilterText('');
    setStatusFilter('unhealthy');
    setActiveIssueFilter('');
  }, []);

  const handleRefreshWorkloadHealth = useCallback(
    async (workloadId, { includeLogs = false, lookbackHours = 120, forceRefresh = true } = {}) => {
      const workload = dashboardWorkloads.find((w) => w.workloadId === workloadId);
      if (!workload) {
        toast.error('Workload not found');
        return;
      }

      const trackedResources = safeParseJson(workload.trackedResources, { resources: [] });
      const resources = Array.isArray(trackedResources?.resources)
        ? trackedResources.resources
        : [];

      if (resources.length === 0) {
        toast.error('No resources to check in this workload');
        return;
      }

      try {
        await dispatch(
          launchHealthScans({
            workloadId,
            cloudProvider: workloadProviderById.get(workloadId) || 'aws',
            forceRefresh,
            enableCloudWatchLogChecks: includeLogs,
            lookbackHours,
          })
        ).unwrap();
        toast.success('Workload health check started.');
      } catch (error) {
        console.error('Failed to refresh health:', error);
        toast.error(error?.message || 'Failed to start health checks');
      }
    },
    [dashboardWorkloads, dispatch, workloadProviderById]
  );

  const handleRefreshAll = useCallback(
    async ({ includeLogs = false, lookbackHours = 120, forceRefresh = true } = {}) => {
      const workloadsWithResources = workloadHealthInfo.filter((w) => w.resourceCount > 0);

      if (workloadsWithResources.length === 0) {
        toast.error('No workloads with resources to check');
        return;
      }

      try {
        const workloadsByProvider = workloadsWithResources.reduce((acc, workloadInfo) => {
          const provider = workloadProviderById.get(workloadInfo.workloadId) || 'aws';
          acc[provider] = acc[provider] || [];
          acc[provider].push(workloadInfo);
          return acc;
        }, {});
        await Promise.all(
          Object.entries(workloadsByProvider).map(([cloudProvider, workloads]) =>
            dispatch(
              launchHealthScans({
                cloudProvider,
                targets: workloads.map((workloadInfo) => ({
                  workloadId: workloadInfo.workloadId,
                })),
                forceRefresh,
                enableCloudWatchLogChecks: includeLogs,
                lookbackHours,
              })
            ).unwrap()
          )
        );
        toast.success(
          `Workload health checks started for ${workloadsWithResources.length} workload${
            workloadsWithResources.length === 1 ? '' : 's'
          }.`
        );
      } catch (error) {
        console.error('Failed to refresh workloads:', error);
        toast.error(error?.message || 'Failed to start workload health checks');
      }
    },
    [dispatch, workloadHealthInfo, workloadProviderById]
  );

  const handleRefreshEnvironmentHealth = useCallback(
    async (
      permissionProfileId,
      { includeLogs = false, lookbackHours = 120, forceRefresh = true } = {}
    ) => {
      if (!permissionProfileId) {
        toast.error('Environment not found');
        return;
      }

      const environment = environmentProfiles.find(
        (item) => item.permissionProfileId === permissionProfileId
      );

      try {
        await dispatch(
          launchHealthScans({
            permissionProfileId,
            cloudProvider: environment?.cloudProvider || 'aws',
            forceRefresh,
            enableCloudWatchLogChecks: includeLogs,
            lookbackHours,
          })
        ).unwrap();
        toast.success(
          `Environment health check started for ${environment?.profileName || 'cloud environment'}.`
        );
      } catch (error) {
        console.error('Failed to refresh environment health:', error);
        toast.error(error?.message || 'Failed to start health checks for environment');
      }
    },
    [dispatch, environmentProfiles]
  );

  const handleRefreshAllEnvironments = useCallback(
    async ({ includeLogs = false, lookbackHours = 120, forceRefresh = true } = {}) => {
      if (environmentProfiles.length === 0) {
        toast.error('No cloud environments found');
        return;
      }

      try {
        const profilesByProvider = environmentProfiles.reduce((acc, environment) => {
          const provider = environment.cloudProvider || 'aws';
          acc[provider] = acc[provider] || [];
          acc[provider].push(environment);
          return acc;
        }, {});
        await Promise.all(
          Object.entries(profilesByProvider).map(([cloudProvider, profiles]) =>
            dispatch(
              launchHealthScans({
                cloudProvider,
                targets: profiles.map((environment) => ({
                  permissionProfileId: environment.permissionProfileId,
                })),
                forceRefresh,
                enableCloudWatchLogChecks: includeLogs,
                lookbackHours,
              })
            ).unwrap()
          )
        );
        toast.success(
          `Environment health checks started for ${environmentProfiles.length} environment${
            environmentProfiles.length === 1 ? '' : 's'
          }.`
        );
      } catch (error) {
        console.error('Failed to refresh environments:', error);
        toast.error(error?.message || 'Failed to start environment health checks');
      }
    },
    [dispatch, environmentProfiles]
  );

  const openHealthCheckOptionsModal = useCallback(
    (
      workloadId = null,
      isAllWorkloads = false,
      permissionProfileId = null,
      isAllEnvironments = false
    ) => {
      setHealthCheckLookbackDays(5);
      setIncludeCloudWatchLogChecks(false);
      setForceRegenerateHealthReport(true);
      setHealthCheckOptionsModal({
        open: true,
        workloadId,
        isAllWorkloads,
        permissionProfileId,
        isAllEnvironments,
      });
    },
    []
  );

  const handleRunHealthChecks = useCallback(async () => {
    const { workloadId, isAllWorkloads, permissionProfileId, isAllEnvironments } =
      healthCheckOptionsModal;
    const options = {
      includeLogs: includeCloudWatchLogChecks,
      lookbackHours: healthCheckLookbackDays * 24,
      forceRefresh: forceRegenerateHealthReport,
    };

    setHealthCheckOptionsModal({
      open: false,
      workloadId: null,
      isAllWorkloads: false,
      permissionProfileId: null,
      isAllEnvironments: false,
    });

    if (isAllWorkloads) {
      await handleRefreshAll(options);
    } else if (isAllEnvironments) {
      await handleRefreshAllEnvironments(options);
    } else if (workloadId) {
      await handleRefreshWorkloadHealth(workloadId, options);
    } else if (permissionProfileId) {
      await handleRefreshEnvironmentHealth(permissionProfileId, options);
    }
  }, [
    healthCheckOptionsModal,
    includeCloudWatchLogChecks,
    healthCheckLookbackDays,
    forceRegenerateHealthReport,
    handleRefreshAll,
    handleRefreshAllEnvironments,
    handleRefreshEnvironmentHealth,
    handleRefreshWorkloadHealth,
  ]);

  const openResourceDetails = (resourceData) => {
    setHealthDetailsModal({ open: true, resource: resourceData });
  };

  const isSelectedWorkloadRefreshing = selectedWorkloadId
    ? refreshingWorkloadIds.has(selectedWorkloadId)
    : false;
  const isSelectedEnvironmentRefreshing = selectedEnvironmentId
    ? refreshingEnvironmentIds.has(selectedEnvironmentId)
    : false;
  const loadedEnvironmentCount = environmentHealthInfo.filter((environment) => environment.hasHealthData)
    .length;
  const totalEnvironmentCount = environmentProfiles.length;
  const rawEnvironmentResourceCount = environmentHealthInfo.reduce(
    (sum, environment) => sum + (environment?.resourceCount || 0),
    0
  );
  const isAnyRefreshRunning =
    refreshingWorkloadIds.size > 0 || refreshingEnvironmentIds.size > 0;
  const healthPercent = toFiniteCount(dashboardSummary.healthScore);
  const evaluatedCount = toFiniteCount(totals.evaluated);
  const issueCount = toFiniteCount(totals.issues);
  const hasLoadedIssueFreeResources =
    evaluatedCount === 0 && toFiniteCount(totals.total) > 0 && issueCount === 0;
  const hasDisplayableHealthScore = evaluatedCount > 0 || hasLoadedIssueFreeResources;
  const displayedHealthPercent = hasLoadedIssueFreeResources ? 100 : healthPercent;
  const showScopeComparisonCards = isAllScopesSelected;
  const totalResourcesScopeLabel = selectedWorkload
    ? 'In selected workload'
    : selectedEnvironment
      ? 'In selected environment'
      : `Across ${workloadHealthInfo.length} workload${workloadHealthInfo.length !== 1 ? 's' : ''} and ${environmentHealthInfo.length} environment${environmentHealthInfo.length !== 1 ? 's' : ''}`;
  const miniTopWorkloadsWithIssues = topWorkloadsWithIssues.slice(0, 2);
  const miniTopEnvironmentsWithIssues = topEnvironmentsWithIssues.slice(0, 2);
  const isDetailLoaded =
    selectedWorkloadId
      ? Boolean(
          workloadHealthResults?.[selectedWorkloadId] ||
            safeParseJson(
              dashboardWorkloadsById.get(selectedWorkloadId)?.trackedResources,
              { resources: [] }
            )?.resources?.length
        )
      : selectedEnvironmentId
        ? Boolean(environmentHealthResults?.[selectedEnvironmentId])
        : false;

  const handleLoadScopeDetails = useCallback(async () => {
    if (selectedWorkloadId) {
      try {
        await dispatch(
          refreshWorkloadHealth({
            workloadId: selectedWorkloadId,
            forceRefresh: false,
            allowWhileLoading: true,
          })
        ).unwrap();
      } catch (error) {
        console.error('Failed to load workload health details:', error);
        toast.error(error?.message || 'Failed to load health details');
      }
      return;
    }
    if (selectedEnvironmentId) {
      try {
        await dispatch(
          refreshEnvironmentHealth({
            permissionProfileId: selectedEnvironmentId,
            forceRefresh: false,
            allowWhileLoading: true,
          })
        ).unwrap();
      } catch (error) {
        console.error('Failed to load environment health details:', error);
        toast.error(error?.message || 'Failed to load health details');
      }
      return;
    }
    toast.error('Select a workload or environment to load resource details');
  }, [
    dispatch,
    selectedWorkloadId,
    selectedEnvironmentId,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline">
            <h1 className="shrink-0 text-2xl font-semibold text-gray-900">
              Health Dashboard
            </h1>
            {selectedScopeHeader && (
              <span
                className="min-w-0 truncate text-lg font-medium text-gray-700"
                title={`${selectedScopeHeader.typeLabel}: ${selectedScopeHeader.title}`}
              >
                <span className="text-gray-300">/</span> {selectedScopeHeader.title}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {selectedScopeHeader
              ? null
              : 'Aggregated health status across workloads and cloud environments'}
          </p>
          {selectedScopeHeader && (
            <p className="text-xs text-gray-500 mt-1">
              Last refreshed:{' '}
              {selectedScopeHeader.lastRefreshedAt
                ? formatRelativeTime(selectedScopeHeader.lastRefreshedAt)
                : 'Never'}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Environment health loaded: {loadedEnvironmentCount}/{totalEnvironmentCount}
            {refreshingEnvironmentIds.size > 0
              ? ` • Loading ${refreshingEnvironmentIds.size}`
              : ''}
            {rawEnvironmentResourceCount > 0
              ? ` • Env resources: ${rawEnvironmentResourceCount}`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Popover open={scopeComboOpen} onOpenChange={setScopeComboOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={scopeComboOpen}
                className="h-10 w-full justify-between px-3 font-normal sm:w-[28rem] xl:w-[34rem]"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  {isAllScopesSelected ? (
                    <Box className="h-4 w-4 shrink-0" />
                  ) : (
                    getCloudProviderIcon(selectedScopeCloudProvider, 'h-4 w-4 shrink-0')
                  )}
                  <span className="truncate">{scopeTriggerLabel}</span>
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] min-w-80 p-0 bg-white"
              align="start"
            >
              <Command>
                <CommandInput placeholder="Search workloads & environments…" />
                <CommandList>
                  <CommandEmpty>No matching workload or environment.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all workloads environments"
                      onSelect={() => {
                        setScopeFilter('all');
                        setScopeComboOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 shrink-0',
                          scopeFilter !== 'all' && 'opacity-0'
                        )}
                      />
                      All Workloads & Environments
                    </CommandItem>
                  </CommandGroup>
                  {workloadHealthInfo.length > 0 ? (
                    <CommandGroup heading="Workloads">
                      {workloadHealthInfo.map((info) => {
                        const value = `workload ${info.workloadId} ${info.workloadName || 'untitled'}`.toLowerCase();
                        const selected = scopeFilter === `workload:${info.workloadId}`;
                        return (
                          <CommandItem
                            key={info.workloadId}
                            value={value}
                            onSelect={() => {
                              setScopeFilter(`workload:${info.workloadId}`);
                              setScopeComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn('mr-2 h-4 w-4 shrink-0', !selected && 'opacity-0')}
                            />
                            {getCloudProviderIcon(workloadProviderById.get(info.workloadId))}
                            <span
                              className="min-w-0 flex-1 truncate"
                              title={`Workload: ${info.workloadName || 'Untitled'}`}
                            >
                              {`Workload: ${info.workloadName || 'Untitled'}`}
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  ) : null}
                  {environmentProfiles.length > 0 ? (
                    <CommandGroup heading="Environments">
                      {environmentProfiles.map((info) => {
                        const displayName =
                          info.profileName || info.accountId || 'Cloud Environment';
                        const value = `environment ${info.permissionProfileId} ${displayName} ${info.accountId || ''}`.toLowerCase();
                        const selected =
                          scopeFilter === `environment:${info.permissionProfileId}`;
                        return (
                          <CommandItem
                            key={info.permissionProfileId}
                            value={value}
                            onSelect={() => {
                              setScopeFilter(`environment:${info.permissionProfileId}`);
                              setScopeComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn('mr-2 h-4 w-4 shrink-0', !selected && 'opacity-0')}
                            />
                            {getCloudProviderIcon(info.cloudProvider)}
                            <span
                              className="min-w-0 flex-1 truncate"
                              title={`Environment: ${displayName}`}
                            >
                              {`Environment: ${displayName}`}
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  ) : null}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {isAllScopesSelected && (
            <>
              <Button
                onClick={() => openHealthCheckOptionsModal(null, true)}
                disabled={isAnyRefreshRunning}
                variant="outline"
                size="sm"
                className="h-10 px-3 text-sm"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${isAnyRefreshRunning ? 'animate-spin' : ''}`}
                />
                Refresh Workloads
              </Button>
              <Button
                onClick={() => openHealthCheckOptionsModal(null, false, null, true)}
                disabled={isAnyRefreshRunning}
                variant="outline"
                size="sm"
                className="h-10 px-3 text-sm"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${isAnyRefreshRunning ? 'animate-spin' : ''}`}
                />
                Refresh Environments
              </Button>
            </>
          )}
          {!isAllScopesSelected && selectedWorkload && (
            <Button
              onClick={() => openHealthCheckOptionsModal(selectedWorkload.workloadId, false)}
              disabled={isAnyRefreshRunning}
              variant="outline"
              size="sm"
              className="h-10 px-3 text-sm"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isSelectedWorkloadRefreshing ? 'animate-spin' : ''}`}
              />
              Refresh Workload
            </Button>
          )}
          {!isAllScopesSelected && selectedEnvironment && (
            <Button
              onClick={() =>
                openHealthCheckOptionsModal(
                  null,
                  false,
                  selectedEnvironment.permissionProfileId,
                  false
                )
              }
              disabled={isAnyRefreshRunning}
              variant="outline"
              size="sm"
              className="h-10 px-3 text-sm"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isSelectedEnvironmentRefreshing ? 'animate-spin' : ''}`}
              />
              Refresh Environment
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
          showScopeComparisonCards ? 'lg:grid-cols-5' : 'lg:grid-cols-3'
        }`}
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Box className="h-4 w-4" />
              Total Resources
            </div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{totals.total}</div>
            <div className="text-xs text-gray-500 mt-1">
              {totalResourcesScopeLabel}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Issues
            </div>
            <div className="mt-2 text-3xl font-bold text-red-600">{issueCount}</div>
            <div className="text-xs text-gray-500 mt-1">
              {issueCount > 0 && evaluatedCount > 0
                ? `${100 - healthPercent}% of evaluated`
                : 'No issues detected'}
            </div>
          </CardContent>
        </Card>

        {showScopeComparisonCards && (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Top Workloads
                </div>
                <div className="mt-3 space-y-2">
                  {miniTopWorkloadsWithIssues.length === 0 ? (
                    <div className="text-xs text-gray-500">No workload issues found</div>
                  ) : (
                    miniTopWorkloadsWithIssues.map((workload) => (
                      <button
                        type="button"
                        key={workload.workloadId}
                        onClick={() => setScopeFilter(`workload:${workload.workloadId}`)}
                        className="flex w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-left hover:bg-red-50"
                      >
                        <span className="truncate text-xs font-medium text-gray-900">
                          {workload.workloadName}
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-red-600">
                          {workload.issues}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Top Environments
                </div>
                <div className="mt-3 space-y-2">
                  {miniTopEnvironmentsWithIssues.length === 0 ? (
                    <div className="text-xs text-gray-500">No environment issues found</div>
                  ) : (
                    miniTopEnvironmentsWithIssues.map((environment) => (
                      <button
                        type="button"
                        key={environment.permissionProfileId}
                        onClick={() =>
                          setScopeFilter(`environment:${environment.permissionProfileId}`)
                        }
                        className="flex w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-left hover:bg-red-50"
                      >
                        <span className="truncate text-xs font-medium text-gray-900">
                          {environment.environmentName}
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-red-600">
                          {environment.issues}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
              <HeartPulse className="h-4 w-4" />
              Health Score
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-gray-900">
                {hasDisplayableHealthScore ? displayedHealthPercent : '—'}
              </span>
              {hasDisplayableHealthScore && (
                <span className="text-lg text-gray-500">%</span>
              )}
            </div>
            <div className="mt-2 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  displayedHealthPercent >= 80
                    ? 'bg-green-500'
                    : displayedHealthPercent >= 50
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{
                  width: `${hasDisplayableHealthScore ? displayedHealthPercent : 0}%`,
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setDataFreshnessModalOpen(true)}
              className="text-xs text-primary-600 hover:text-primary-700 hover:underline mt-2"
            >
              View data freshness
            </button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-medium">
                  Top Issues By Resources Affected
                </CardTitle>
                <p className="mt-1 text-xs text-gray-500">
                  Click an issue to filter the table below.
                </p>
              </div>
            </div>
            {topIssueInsights.length === 0 ? (
              <p className="text-sm text-gray-500">No active issues found for the current scope.</p>
            ) : (
              <div className={`space-y-2 ${topIssueInsights.length > 5 ? 'max-h-[400px] overflow-y-auto pr-1' : ''}`}>
                {topIssueInsights.map((issue, index) => (
                  <button
                    type="button"
                    key={issue.issueLabel}
                    onClick={() => handleIssueInsightClick(issue.issueLabel)}
                    className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:bg-red-50 ${
                      activeIssueFilter === issue.issueLabel
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-400">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatInsightLabel(issue.issueLabel)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-semibold text-red-600">
                        {issue.resourceCount}
                      </div>
                      <div className="text-xs text-gray-500">
                        resource{issue.resourceCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-medium">
                  Top Resource Types With Issues
                </CardTitle>
                <p className="mt-1 text-xs text-gray-500">
                  Click a resource type to apply the type filter.
                </p>
              </div>
            </div>
            {topIssueResourceTypes.length === 0 ? (
              <p className="text-sm text-gray-500">
                No unhealthy resource types found for the current scope.
              </p>
            ) : (
              <div className={`space-y-2 ${topIssueResourceTypes.length > 5 ? 'max-h-[400px] overflow-y-auto pr-1' : ''}`}>
                {topIssueResourceTypes.map((typeEntry, index) => (
                  <button
                    type="button"
                    key={typeEntry.resourceType}
                    onClick={() => handleResourceTypeInsightClick(typeEntry.resourceType)}
                    className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:bg-amber-50 ${
                      typeFilter === typeEntry.resourceType && statusFilter === 'unhealthy'
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-400">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {typeEntry.resourceType}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-semibold text-amber-600">
                        {typeEntry.resourceCount}
                      </div>
                      <div className="text-xs text-gray-500">
                        resource{typeEntry.resourceCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resources Table */}
      {showAllScopeInsightMatches ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <div className="mb-3">
                <CardTitle className="text-base font-medium">Matching Workloads</CardTitle>
              </div>
              {allScopeInsightMatches.workloads.length === 0 ? (
                <p className="text-sm text-gray-500">No workload summaries match this selection.</p>
              ) : (
                <div className="space-y-2">
                  {allScopeInsightMatches.workloads.map((workload) => (
                    <button
                      type="button"
                      key={workload.workloadId}
                      onClick={() => setScopeFilter(`workload:${workload.workloadId}`)}
                      className="flex w-full items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-left hover:bg-gray-100"
                    >
                      <span className="truncate text-sm font-medium text-gray-900">
                        {workload.workloadName}
                      </span>
                      <span className="shrink-0 text-xs text-gray-500">
                        {workload.resourceCount} resource{workload.resourceCount !== 1 ? 's' : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="mb-3">
                <CardTitle className="text-base font-medium">Matching Environments</CardTitle>
              </div>
              {allScopeInsightMatches.environments.length === 0 ? (
                <p className="text-sm text-gray-500">No environment summaries match this selection.</p>
              ) : (
                <div className="space-y-2">
                  {allScopeInsightMatches.environments.map((environment) => (
                    <button
                      type="button"
                      key={environment.permissionProfileId}
                      onClick={() => setScopeFilter(`environment:${environment.permissionProfileId}`)}
                      className="flex w-full items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-left hover:bg-gray-100"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900">
                          {environment.environmentName}
                        </div>
                        {environment.accountId && (
                          <div className="truncate text-xs text-gray-500">
                            {environment.accountId}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-gray-500">
                        {environment.resourceCount} resource{environment.resourceCount !== 1 ? 's' : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-base font-medium">All Resources</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search resources..."
                    value={filterText}
                    onChange={(e) => {
                      setFilterText(e.target.value);
                      setActiveIssueFilter('');
                    }}
                    className="pl-9 w-64"
                  />
                </div>
                {activeIssueFilter && (
                  <button
                    type="button"
                    onClick={() => setActiveIssueFilter('')}
                    className="inline-flex h-10 items-center rounded-md border border-red-200 bg-red-50 px-3 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    {`Issue: ${formatInsightLabel(activeIssueFilter, 36)}`}
                  </button>
                )}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {availableStatusOptions.map((statusValue) => (
                      <SelectItem key={statusValue} value={statusValue}>
                        {statusLabelMap[statusValue] || statusValue}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-48">
                    <Box className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {availableTypeOptions.map((typeValue) => (
                      <SelectItem key={typeValue} value={typeValue}>
                        {typeValue}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isAllScopesSelected ? (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  Select a workload or environment to load resource-level health details.
                </p>
              </div>
            ) : !isDetailLoaded ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-gray-500">
                Resource-level health details are loaded on demand for the selected scope.
              </p>
              <Button
                onClick={handleLoadScopeDetails}
                disabled={isSelectedWorkloadRefreshing || isSelectedEnvironmentRefreshing}
                variant="outline"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${
                    isSelectedWorkloadRefreshing || isSelectedEnvironmentRefreshing
                      ? 'animate-spin'
                      : ''
                  }`}
                />
                Load Resource Details
              </Button>
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No resources found matching your criteria.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Resource</TableHead>
                    <TableHead className="w-[150px]">Type</TableHead>
                    <TableHead className="w-[220px]">Environments</TableHead>
                    <TableHead className="w-[220px]">Workloads</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[140px]">Health Checks</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResources.map(
                    ({ resourceKey, resource, workloads: resourceWorkloads, environments }) => {
                    const status = getResourceHealthStatus(resource);
                    const counts = getResourceHealthCounts(resource);
                    const isExpanded = expandedResourceKey === resourceKey;

                    return (
                      <React.Fragment key={resourceKey}>
                        <TableRow
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() =>
                            openResourceDetails({
                              resourceKey,
                              resource,
                              workloads: resourceWorkloads,
                              environments,
                            })
                          }
                        >
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900 truncate max-w-[280px]">
                                {resource.displayName || resource.resourceId || 'Unknown'}
                              </span>
                              {resource.resourceArn && (
                                <span className="text-xs text-gray-500 truncate max-w-[280px]">
                                  {resource.resourceArn}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">
                              {formatResourceTypeForDisplay(resource?.resourceType)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(environments || []).slice(0, 2).map((environment) => (
                                <Badge
                                  key={environment.permissionProfileId}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {environment.environmentName || environment.accountId || 'Environment'}
                                </Badge>
                              ))}
                              {(environments || []).length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{(environments || []).length - 2}
                                </Badge>
                              )}
                              {(!environments || environments.length === 0) && (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {resourceWorkloads.slice(0, 2).map((w) => (
                                <Badge
                                  key={w.workloadId}
                                  variant="secondary"
                                  className="text-xs cursor-pointer hover:bg-gray-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/dashboard/workloads/${w.workloadId}`);
                                  }}
                                >
                                  {w.workloadName || 'Untitled'}
                                </Badge>
                              ))}
                              {resourceWorkloads.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{resourceWorkloads.length - 2}
                                </Badge>
                              )}
                              {resourceWorkloads.length === 0 && (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {status === 'healthy' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                                <CheckCircle2 className="h-3 w-3" />
                                Healthy
                              </span>
                            )}
                            {status === 'unhealthy' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                                <AlertTriangle className="h-3 w-3" />
                                Issues
                              </span>
                            )}
                            {status === 'unknown' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                <Clock className="h-3 w-3" />
                                Unknown
                              </span>
                            )}
                            {status === 'not_applicable' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                Not applicable
                              </span>
                            )}
                            {status === 'not_checked' && (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                <Clock className="h-3 w-3" />
                                Not checked
                              </span>
                            )}
                            {status === 'skipped' && (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                Skipped
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {counts.total > 0 ? (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-green-600">{counts.healthy} passed</span>
                                {counts.unhealthy > 0 && (
                                  <span className="text-red-600">{counts.unhealthy} failed</span>
                                )}
                                {counts.unknown > 0 && (
                                  <span className="text-amber-600">{counts.unknown} unknown</span>
                                )}
                                {counts.notApplicable > 0 && (
                                  <span className="text-slate-500">{counts.notApplicable} n/a</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedResourceKey(isExpanded ? '' : resourceKey);
                              }}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-gray-50 p-4">
                              <ExpandedResourceDetails
                                resource={resource}
                                workloads={resourceWorkloads}
                                environments={environments}
                                navigate={navigate}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  }
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          </CardContent>
        </Card>
      )}

      {/* Health Details Modal */}
      <Dialog
        open={healthDetailsModal.open}
        onOpenChange={(open) => setHealthDetailsModal({ open, resource: null })}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>
              {healthDetailsModal.resource?.resource?.displayName || 'Resource Details'}
            </DialogTitle>
            <DialogDescription>
              {healthDetailsModal.resource?.resource?.resourceArn ||
                healthDetailsModal.resource?.resource?.resourceId ||
                ''}
            </DialogDescription>
          </DialogHeader>
          {healthDetailsModal.resource && (
            <HealthDetailsContent
              resourceData={healthDetailsModal.resource}
              navigate={navigate}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Data Freshness Modal */}
      <Dialog open={dataFreshnessModalOpen} onOpenChange={setDataFreshnessModalOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Data Freshness
            </DialogTitle>
            <DialogDescription>
              Last health check time for workloads and cloud environments
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Workloads</h4>
              <div className="space-y-2">
                {workloadHealthInfo.length === 0 ? (
                  <p className="text-sm text-gray-500">No workloads found.</p>
                ) : (
                  workloadHealthInfo.map((info) => (
                    <div
                      key={info.workloadId}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50"
                    >
                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => {
                            setDataFreshnessModalOpen(false);
                            navigate(`/dashboard/workloads/${info.workloadId}`);
                          }}
                          className="text-sm font-medium text-gray-900 hover:text-primary-600 truncate block text-left"
                        >
                          {info.workloadName || 'Untitled Workload'}
                        </button>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {info.resourceCount} resource{info.resourceCount !== 1 ? 's' : ''} •{' '}
                          {info.lastHealthCheck
                            ? `Checked ${formatRelativeTime(info.lastHealthCheck)}`
                            : 'Never checked'}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDataFreshnessModalOpen(false);
                          openHealthCheckOptionsModal(info.workloadId, false);
                        }}
                        disabled={refreshingWorkloadIds.has(info.workloadId)}
                        className="ml-2 flex-shrink-0"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${
                            refreshingWorkloadIds.has(info.workloadId) ? 'animate-spin' : ''
                          }`}
                        />
                      </Button>
                    </div>
                  ))
                )}
              </div>
              {workloadHealthInfo.length > 0 && (
                <div className="mt-3">
                  <Button
                    onClick={() => {
                      setDataFreshnessModalOpen(false);
                      openHealthCheckOptionsModal(null, true);
                    }}
                    disabled={isAnyRefreshRunning}
                    variant="outline"
                    className="w-full"
                  >
                    <RefreshCw
                      className={`h-4 w-4 mr-2 ${isAnyRefreshRunning ? 'animate-spin' : ''}`}
                    />
                    Refresh All Workloads
                  </Button>
                </div>
              )}
            </div>

            <div className="pt-2 border-t">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Cloud Environments</h4>
              <div className="space-y-2">
                {environmentHealthInfo.length === 0 ? (
                  <p className="text-sm text-gray-500">No cloud environments found.</p>
                ) : (
                  environmentHealthInfo.map((info) => (
                    <div
                      key={info.permissionProfileId}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate block text-left">
                          {info.environmentName || 'Cloud Environment'}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {info.accountId ? `${info.accountId} • ` : ''}
                          {info.resourceCount > 0
                            ? `${info.resourceCount} resource${info.resourceCount !== 1 ? 's' : ''} • `
                            : ''}
                          {info.lastHealthCheck
                            ? `Checked ${formatRelativeTime(info.lastHealthCheck)}`
                            : info.hasHealthData
                              ? 'Health check available'
                              : 'Never checked'}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDataFreshnessModalOpen(false);
                          openHealthCheckOptionsModal(
                            null,
                            false,
                            info.permissionProfileId,
                            false
                          );
                        }}
                        disabled={refreshingEnvironmentIds.has(info.permissionProfileId)}
                        className="ml-2 flex-shrink-0"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${
                            refreshingEnvironmentIds.has(info.permissionProfileId)
                              ? 'animate-spin'
                              : ''
                          }`}
                        />
                      </Button>
                    </div>
                  ))
                )}
              </div>
              {environmentHealthInfo.length > 0 && (
                <div className="mt-3">
                  <Button
                    onClick={() => {
                      setDataFreshnessModalOpen(false);
                      openHealthCheckOptionsModal(null, false, null, true);
                    }}
                    disabled={isAnyRefreshRunning}
                    variant="outline"
                    className="w-full"
                  >
                    <RefreshCw
                      className={`h-4 w-4 mr-2 ${isAnyRefreshRunning ? 'animate-spin' : ''}`}
                    />
                    Refresh All Environments
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Health Check Options Modal */}
      <Dialog
        open={healthCheckOptionsModal.open}
        onOpenChange={(open) =>
          setHealthCheckOptionsModal({
            open,
            workloadId: null,
            isAllWorkloads: false,
            permissionProfileId: null,
            isAllEnvironments: false,
          })
        }
      >
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>Run resource health checks</DialogTitle>
            <DialogDescription>
              {healthCheckOptionsModal.isAllWorkloads
                ? 'Configure health check options for all workloads.'
                : healthCheckOptionsModal.isAllEnvironments
                  ? 'Configure health check options for all cloud environments.'
                  : healthCheckOptionsModal.permissionProfileId
                    ? 'Configure health check options for this cloud environment.'
                    : 'Configure health check options for your tracked resources.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3">
              <Label
                htmlFor="health-check-lookback-days"
                className="text-sm font-medium text-gray-900"
              >
                Lookback period
              </Label>
              <p className="mt-1 text-xs text-gray-600 mb-2">
                How far back to analyze CloudWatch metrics and alarms for health evaluation.
              </p>
              <select
                id="health-check-lookback-days"
                value={healthCheckLookbackDays}
                onChange={(e) => setHealthCheckLookbackDays(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
              >
                <option value={1}>Last 1 day</option>
                <option value={3}>Last 3 days</option>
                <option value={5}>Last 5 days (default)</option>
              </select>
            </div>
            <div className="flex items-start justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-3">
              <div>
                <Label
                  htmlFor="include-cloudwatch-log-checks"
                  className="text-sm font-medium text-gray-900"
                >
                  Include CloudWatch log checks
                </Label>
                <p className="mt-1 text-xs text-gray-600">
                  Searches CloudWatch logs for keywords like &quot;error&quot;, &quot;fail&quot;,
                  &quot;exception&quot;, etc. to detect potential issues in your resources.
                </p>
              </div>
              <Switch
                id="include-cloudwatch-log-checks"
                checked={includeCloudWatchLogChecks}
                onCheckedChange={setIncludeCloudWatchLogChecks}
                className="data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600"
              />
            </div>
            <div className="flex items-start justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-3">
              <div>
                <Label
                  htmlFor="force-regenerate-health-report"
                  className="text-sm font-medium text-gray-900"
                >
                  Generate a new report
                </Label>
                <p className="mt-1 text-xs text-gray-600">
                  When off, CloudAgent reuses the latest report if it was generated in the last 24
                  hours.
                </p>
              </div>
              <Switch
                id="force-regenerate-health-report"
                checked={forceRegenerateHealthReport}
                onCheckedChange={setForceRegenerateHealthReport}
                className="data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600"
              />
            </div>
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Cost note: longer lookback periods and enabling log checks may increase API costs for
              workloads with large CloudWatch log volumes.
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() =>
                setHealthCheckOptionsModal({
                  open: false,
                  workloadId: null,
                  isAllWorkloads: false,
                  permissionProfileId: null,
                  isAllEnvironments: false,
                })
              }
            >
              Cancel
            </Button>
            <Button onClick={handleRunHealthChecks} disabled={isAnyRefreshRunning}>
              {isAnyRefreshRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running checks...
                </>
              ) : (
                'Run checks'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExpandedResourceDetails({ resource, workloads, environments, navigate }) {
  const checks = Array.isArray(resource?.health?.checks) ? resource.health.checks : [];
  const errors = Array.isArray(resource?.health?.errors) ? resource.health.errors : [];
  const generatedAt = resource?.health?.generatedAt || '';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Resource Type:</span>
          <span className="ml-2 text-gray-900">{resource.resourceType || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">Region:</span>
          <span className="ml-2 text-gray-900">{resource.region || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">Account ID:</span>
          <span className="ml-2 text-gray-900">{resource.accountId || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">Last Checked:</span>
          <span className="ml-2 text-gray-900">
            {generatedAt ? formatRelativeTime(generatedAt) : 'Never'}
          </span>
        </div>
      </div>

      <div>
        <span className="text-sm text-gray-500">Scopes:</span>
        <div className="flex flex-wrap gap-1 mt-1">
          {(workloads || []).map((w) => (
            <Badge
              key={w.workloadId}
              variant="secondary"
              className="cursor-pointer hover:bg-gray-200"
              onClick={() => navigate(`/dashboard/workloads/${w.workloadId}`)}
            >
              {w.workloadName || 'Untitled'}
              <ExternalLink className="h-3 w-3 ml-1" />
            </Badge>
          ))}
          {(environments || []).map((environment) => (
            <Badge
              key={environment.permissionProfileId}
              variant="outline"
            >
              {environment.environmentName || environment.accountId || 'Environment'}
            </Badge>
          ))}
          {(workloads || []).length === 0 && (environments || []).length === 0 && (
            <span className="text-xs text-gray-400">—</span>
          )}
        </div>
      </div>

      {checks.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Health Checks ({checks.length})</h4>
          <div className="space-y-2">
            {checks.map((check, idx) => (
              <div
                key={check.checkId || idx}
                className={`p-3 rounded-lg border ${
                  normalizeHealthStatus(check.status) === 'healthy'
                    ? 'border-green-200 bg-green-50'
                    : normalizeHealthStatus(check.status) === 'unhealthy'
                      ? 'border-red-200 bg-red-50'
                      : normalizeHealthStatus(check.status) === 'not_applicable'
                        ? 'border-slate-200 bg-slate-50'
                        : 'border-amber-200 bg-amber-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {check.checkName || check.checkId || 'Check'}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      normalizeHealthStatus(check.status) === 'healthy'
                        ? 'text-green-700'
                        : normalizeHealthStatus(check.status) === 'unhealthy'
                          ? 'text-red-700'
                          : normalizeHealthStatus(check.status) === 'not_applicable'
                            ? 'text-slate-700'
                            : 'text-amber-700'
                    }`}
                  >
                    {check.status}
                  </span>
                </div>
                {check.summary && (
                  <p className="text-xs text-gray-600 mt-1">{check.summary}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Errors ({errors.length})</h4>
          <div className="space-y-1">
            {errors.map((error, idx) => (
              <div key={idx} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                {error}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

ExpandedResourceDetails.propTypes = {
  resource: PropTypes.object.isRequired,
  workloads: PropTypes.array,
  environments: PropTypes.array,
  navigate: PropTypes.func.isRequired,
};

ExpandedResourceDetails.defaultProps = {
  workloads: [],
  environments: [],
};

function HealthDetailsContent({ resourceData, navigate }) {
  const { resource, workloads, environments } = resourceData;
  const checks = Array.isArray(resource?.health?.checks) ? resource.health.checks : [];
  const errors = Array.isArray(resource?.health?.errors) ? resource.health.errors : [];
  const generatedAt = resource?.health?.generatedAt || '';
  const isNotApplicable =
    resource?.health?.notApplicable === true ||
    errors.some((errorText) => isNotApplicableHealthMessage(errorText));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Resource Type:</span>
          <span className="ml-2 text-gray-900">{resource.resourceType || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">Region:</span>
          <span className="ml-2 text-gray-900">{resource.region || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">Account ID:</span>
          <span className="ml-2 text-gray-900">{resource.accountId || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">Last Checked:</span>
          <span className="ml-2 text-gray-900">
            {generatedAt ? formatRelativeTime(generatedAt) : 'Never'}
          </span>
        </div>
      </div>

      <div>
        <span className="text-sm text-gray-500">Appears in:</span>
        <div className="flex flex-wrap gap-1 mt-1">
          {(workloads || []).map((w) => (
            <Badge
              key={w.workloadId}
              variant="secondary"
              className="cursor-pointer hover:bg-gray-200"
              onClick={() => navigate(`/dashboard/workloads/${w.workloadId}`)}
            >
              {w.workloadName || 'Untitled'}
              <ExternalLink className="h-3 w-3 ml-1" />
            </Badge>
          ))}
          {(environments || []).map((environment) => (
            <Badge
              key={environment.permissionProfileId}
              variant="outline"
            >
              {environment.environmentName || environment.accountId || 'Environment'}
            </Badge>
          ))}
          {(workloads || []).length === 0 && (environments || []).length === 0 && (
            <span className="text-xs text-gray-400">—</span>
          )}
        </div>
      </div>

      {checks.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Health Checks ({checks.length})</h4>
          <div className="space-y-2">
            {checks.map((check, idx) => (
              <div
                key={check.checkId || idx}
                className={`p-3 rounded-lg border ${
                  normalizeHealthStatus(check.status) === 'healthy'
                    ? 'border-green-200 bg-green-50'
                    : normalizeHealthStatus(check.status) === 'unhealthy'
                      ? 'border-red-200 bg-red-50'
                      : normalizeHealthStatus(check.status) === 'not_applicable'
                        ? 'border-slate-200 bg-slate-50'
                        : 'border-amber-200 bg-amber-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {check.checkName || check.checkId || 'Check'}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      normalizeHealthStatus(check.status) === 'healthy'
                        ? 'text-green-700'
                        : normalizeHealthStatus(check.status) === 'unhealthy'
                          ? 'text-red-700'
                          : normalizeHealthStatus(check.status) === 'not_applicable'
                            ? 'text-slate-700'
                            : 'text-amber-700'
                    }`}
                  >
                    {check.status}
                  </span>
                </div>
                {check.summary && (
                  <p className="text-xs text-gray-600 mt-1">{check.summary}</p>
                )}
                {check.details && Object.keys(check.details).length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer">
                      View details
                    </summary>
                    <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                      {JSON.stringify(check.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Errors ({errors.length})</h4>
          <div className="space-y-1">
            {errors.map((error, idx) => (
              <div key={idx} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                {error}
              </div>
            ))}
          </div>
        </div>
      )}

      {checks.length === 0 && errors.length === 0 && (
        <p className="text-sm text-gray-500">
          {isNotApplicable
            ? resource?.health?.notApplicableReason || 'Health checks are not applicable for this resource.'
            : 'No health checks have been run for this resource.'}
        </p>
      )}
    </div>
  );
}

HealthDetailsContent.propTypes = {
  resourceData: PropTypes.shape({
    resource: PropTypes.object,
    workloads: PropTypes.array,
    environments: PropTypes.array,
  }).isRequired,
  navigate: PropTypes.func.isRequired,
};
