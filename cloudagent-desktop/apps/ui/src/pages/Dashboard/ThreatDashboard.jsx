import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  launchEnvironmentThreatScans,
  refreshEnvironmentThreatDetection,
  selectEnvironmentThreatRequestsById,
  selectEnvironmentThreatResultsById,
} from '@/features/threat/threatSlice';
import { DEFAULT_HEALTH_MAX_AGE_HOURS } from '@/features/health/healthUtils';
import { selectWorkspaceScopedEnvironmentProfiles } from '@/features/workspace/workspaceScope';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

const ALL_ENVIRONMENTS_SCOPE = 'all-environments';
const FEATURE_LABELS = [
  ['s3ProtectionEnabled', 'S3 Protection'],
  ['eksProtectionEnabled', 'EKS Protection'],
  ['rdsProtectionEnabled', 'RDS Protection'],
  ['ec2MalwareProtectionEnabled', 'EC2 Malware Protection'],
  ['lambdaProtectionEnabled', 'Lambda Protection'],
  ['ec2EcsRuntimeProtectionEnabled', 'EC2/ECS Runtime Protection'],
  ['eksRuntimeProtectionEnabled', 'EKS Runtime Protection'],
];

const normalizeType = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');

const isAwsAccountProfile = (profile) => normalizeType(profile?.type) === 'aws account';

const safeParseJson = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const isFreshTimestamp = (value, maxAgeHours = DEFAULT_HEALTH_MAX_AGE_HOURS) => {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed) || parsed <= 0) return false;
  return Date.now() - parsed < maxAgeHours * 60 * 60 * 1000;
};

const hasFreshThreatMetadata = (profile, maxAgeHours = DEFAULT_HEALTH_MAX_AGE_HOURS) => {
  const summary = safeParseJson(profile?.summary, {});
  const analysis =
    summary?.analysis && typeof summary.analysis === 'object' ? summary.analysis : {};
  const artifact = analysis?.threat && typeof analysis.threat === 'object' ? analysis.threat : {};
  const generatedAt = artifact.generatedAt || artifact.createdAt || artifact.timestamp || '';
  return isFreshTimestamp(generatedAt, maxAgeHours);
};

const hasStoredThreatMetadata = (profile) => {
  const summary = safeParseJson(profile?.summary, {});
  const analysis =
    summary?.analysis && typeof summary.analysis === 'object' ? summary.analysis : {};
  const artifact = analysis?.threat && typeof analysis.threat === 'object' ? analysis.threat : {};
  return Boolean(
    artifact.generatedAt ||
      artifact.createdAt ||
      artifact.timestamp ||
      artifact.objectKey ||
      artifact.path ||
      artifact.fileName
  );
};

const getPermissionProfileId = (profile) =>
  String(profile?.recordId || profile?.id || profile?.permissionProfileId || '').trim();

const getAccountId = (profile) => {
  const authProfile = safeParseJson(profile?.authProfile, {});
  return String(
    authProfile?.awsAccountId || authProfile?.aws_account_id || authProfile?.accountId || ''
  ).trim();
};

const getEnvironmentLabel = (profile) =>
  profile?.name || getAccountId(profile) || getPermissionProfileId(profile) || 'AWS Environment';

const getEnvironmentProviderIcon = (className = 'h-3.5 w-3.5 shrink-0') => (
  <Icons.aws className={className} />
);

const getThreatPayload = (record) => record?.payload || null;

const formatTimestamp = (value) => {
  const parsed = Date.parse(value || '');
  if (!Number.isFinite(parsed)) return 'Unknown';
  return new Date(parsed).toLocaleString();
};

const countEnabledFeatures = (featureSummary = {}) =>
  FEATURE_LABELS.reduce(
    (count, [key]) => count + (featureSummary?.[key] === true ? 1 : 0),
    0
  );

const getStatusVariant = (status) => {
  if (status === 'healthy') {
    return {
      icon: ShieldCheck,
      iconBoxClass: 'bg-emerald-50 text-emerald-600',
      labelClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      text: 'Healthy',
    };
  }
  if (status === 'problem') {
    return {
      icon: ShieldAlert,
      iconBoxClass: 'bg-rose-50 text-rose-600',
      labelClass: 'border-rose-200 bg-rose-50 text-rose-700',
      text: 'Action Needed',
    };
  }
  return {
    icon: AlertTriangle,
    iconBoxClass: 'bg-slate-100 text-slate-500',
    labelClass: 'border-slate-200 bg-slate-50 text-slate-600',
    text: 'Unknown',
  };
};

const getConfigBadgeVariant = (count) => {
  if (Number(count || 0) === 0) {
    return 'border-emerald-200 bg-gradient-to-br from-emerald-100 via-emerald-50 to-teal-100 text-emerald-700';
  }
  return 'border-amber-200 bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-200 text-amber-800';
};

const getMetricToneClass = (tone) => {
  if (tone === 'success') return 'text-emerald-600';
  if (tone === 'warning') return 'text-amber-700';
  if (tone === 'danger') return 'text-red-600';
  return 'text-slate-900';
};

const formatMetricValue = (value) => {
  if (typeof value === 'number') return String(value);
  return String(value || '0');
};

const coerceMetricToNumber = (value) => {
  if (typeof value === 'number') return value;
  const normalized = String(value || '').trim();
  if (!normalized) return 0;
  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) return numeric;
  if (normalized.includes('/')) {
    const [left] = normalized.split('/');
    const fractionValue = Number(left);
    if (Number.isFinite(fractionValue)) return fractionValue;
  }
  return 0;
};

const extractSeverityLabel = (finding) => {
  const explicit = String(
    finding?.severityLabel ||
      finding?.severity ||
      finding?.inspectorScoreLabel ||
      ''
  )
    .trim()
    .toLowerCase();
  if (explicit) return explicit;

  const numericSeverity = Number(finding?.severity);
  if (Number.isFinite(numericSeverity)) {
    if (numericSeverity >= 8.9) return 'critical';
    if (numericSeverity >= 7) return 'high';
    if (numericSeverity >= 4) return 'medium';
    return 'low';
  }
  return '';
};

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4, unknown: 5 };

const sortBySeverity = (findings) =>
  [...findings].sort((a, b) => {
    const sevA = extractSeverityLabel(a) || 'unknown';
    const sevB = extractSeverityLabel(b) || 'unknown';
    return (SEVERITY_ORDER[sevA] ?? 5) - (SEVERITY_ORDER[sevB] ?? 5);
  });

const getSeverityBadgeClass = (severity) => {
  const sev = String(severity).toLowerCase();
  if (sev === 'critical') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (sev === 'high') return 'bg-orange-100 text-orange-700 border-orange-200';
  if (sev === 'medium') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (sev === 'low') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-slate-50 text-slate-500 border-slate-200';
};

const countCriticalHighFindings = (findings = []) =>
  findings.reduce((count, finding) => {
    const label = extractSeverityLabel(finding);
    return label === 'critical' || label === 'high' ? count + 1 : count;
  }, 0);

const getFindingDateValue = (finding) =>
  finding?.createdAt ||
  finding?.firstObservedAt ||
  finding?.timestamp ||
  finding?.updatedAt ||
  finding?.executionTime ||
  finding?.lastObservedAt ||
  null;

const getFindingResourceLabel = (finding) =>
  finding?.resource || finding?.resourceId || finding?.instanceId || finding?.resourceType || 'n/a';

const getFindingContextLabel = (finding) =>
  (finding?.environmentName || '').replace(/^Environment\s*/i, '') || finding?.accountId || 'Unknown';

const getFindingSubtext = (finding) =>
  finding?.type || finding?.status || finding?.resourceType || '';

const stringifyFindingDetails = (details) => {
  if (!details || typeof details !== 'object') return '';
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return '';
  }
};

const mergeInspectorCoverage = (rows) =>
  rows.reduce(
    (accumulator, row) => {
      ['ec2', 'ecr', 'lambda'].forEach((type) => {
        const current = row?.inspectorCoverage?.[type] || {};
        accumulator[type].total += Number(current.total || 0);
        accumulator[type].active += Number(current.active || 0);
        accumulator[type].inactive += Number(current.inactive || 0);
        accumulator[type].managed += Number(current.managed || 0);
        accumulator[type].unmanaged += Number(current.unmanaged || 0);
      });
      return accumulator;
    },
    {
      ec2: { total: 0, active: 0, inactive: 0, managed: 0, unmanaged: 0 },
      ecr: { total: 0, active: 0, inactive: 0, managed: 0, unmanaged: 0 },
      lambda: { total: 0, active: 0, inactive: 0, managed: 0, unmanaged: 0 },
    }
  );

const buildMergedFindings = (payload, context = {}) => {
  const data = payload?.data || {};
  const shared = {
    environmentName: context.environmentName || null,
    accountId: context.accountId || null,
    permissionProfileId: context.permissionProfileId || null,
  };

  const guardDutyFindings = Array.isArray(data?.guardDuty?.findings)
    ? data.guardDuty.findings.map((finding) => ({
        ...finding,
        ...shared,
        source: 'GuardDuty',
        primaryId: finding?.id,
        title: finding?.title || finding?.type || 'GuardDuty finding',
        timestamp: finding?.updatedAt,
      }))
    : [];

  const inspectorFindings = Array.isArray(data?.inspector?.findings)
    ? data.inspector.findings.map((finding) => ({
        ...finding,
        ...shared,
        source: 'Inspector',
        primaryId: finding?.findingArn || finding?.resourceId,
        title: finding?.title || finding?.type || 'Inspector finding',
        timestamp: finding?.updatedAt,
      }))
    : [];

  const accessAnalyzerFindings = Array.isArray(data?.accessAnalyzer?.findings)
    ? data.accessAnalyzer.findings.map((finding) => ({
        ...finding,
        ...shared,
        source: 'Access Analyzer',
        accountId: finding?.accountId || shared.accountId,
        severity: finding?.severity || (finding?.isPublic ? 'high' : 'medium'),
        primaryId: finding?.id,
        title: finding?.resource || finding?.resourceType || 'Access Analyzer finding',
        timestamp: finding?.updatedAt || finding?.createdAt,
      }))
    : [];

  const patchFindings = Array.isArray(data?.patchCompliance?.nonCompliantInstances)
    ? data.patchCompliance.nonCompliantInstances.map((finding) => ({
        ...finding,
        ...shared,
        source: 'Patch Compliance',
        accountId: finding?.accountId || shared.accountId,
        severity:
          String(finding?.overallSeverity || '').toLowerCase() ||
          (finding?.status === 'COMPLIANT' ? 'info' : 'medium'),
        primaryId: finding?.instanceId,
        title: finding?.instanceId || 'Non-compliant managed instance',
        timestamp: finding?.executionTime,
      }))
    : [];

  return [
    ...guardDutyFindings,
    ...inspectorFindings,
    ...accessAnalyzerFindings,
    ...patchFindings,
  ].sort((left, right) => Date.parse(right.timestamp || 0) - Date.parse(left.timestamp || 0));
};

const buildEnvironmentRows = (profiles, threatResultsById, threatRequestsById) =>
  profiles.map((profile) => {
    const permissionProfileId = getPermissionProfileId(profile);
    const record = threatResultsById?.[permissionProfileId] || null;
    const payload = getThreatPayload(record);
    const summary = payload?.summary || {};
    const request = threatRequestsById?.[permissionProfileId] || null;
    const guardDutyFeatureSummary = summary?.guardDuty?.featureSummary || {};
    const inspectorCoverage = summary?.inspector?.coverageByType || {};
    const name = getEnvironmentLabel(profile);
    const accountId = getAccountId(profile);
    const mergedFindings = buildMergedFindings(payload, {
      environmentName: name,
      accountId,
      permissionProfileId,
    });
    const guardDutyFindings = mergedFindings.filter((finding) => finding.source === 'GuardDuty');
    const inspectorFindings = mergedFindings.filter((finding) => finding.source === 'Inspector');
    const accessAnalyzerFindings = mergedFindings.filter(
      (finding) => finding.source === 'Access Analyzer'
    );
    const nonCompliantInstances = mergedFindings.filter(
      (finding) => finding.source === 'Patch Compliance'
    );

    return {
      permissionProfileId,
      name,
      accountId,
      payload,
      summary,
      hasData: Boolean(payload),
      requestStatus: request?.status || 'idle',
      requestError: request?.error || null,
      lastUpdatedAt:
        payload?.analysis?.threat?.generatedAt || record?.updatedAt || request?.finishedAt || null,
      totalFindings: Number(summary?.findings?.total || 0),
      guardDutyEnabled: summary?.guardDuty?.enabled === true,
      enabledGuardDutyRegions: Number(summary?.guardDuty?.enabledRegions || 0),
      totalRegions: Number(summary?.totalRegions || 0),
      guardDutyFeatureSummary,
      enabledGuardDutyFeatureCount: countEnabledFeatures(guardDutyFeatureSummary),
      guardDutyFindings,
      inspectorFindings,
      accessAnalyzerFindings,
      nonCompliantInstances,
      guardDutyFindingsCount: Number(summary?.findings?.guardDuty || 0),
      inspectorFindingsCount: Number(summary?.findings?.inspector || 0),
      accessAnalyzerFindingsCount: Number(summary?.findings?.accessAnalyzer || 0),
      managedEc2Instances: Number(summary?.patchCompliance?.managedEc2Instances || 0),
      compliantManagedInstances: Number(summary?.patchCompliance?.compliantManagedInstances || 0),
      unmanagedEc2Instances: Number(summary?.patchCompliance?.unmanagedEc2Instances || 0),
      nonCompliantManagedInstances: Number(
        summary?.patchCompliance?.nonCompliantManagedInstances || 0
      ),
      analyzerCount: Number(summary?.accessAnalyzer?.analyzerCount || 0),
      publicAccessAnalyzerFindings: accessAnalyzerFindings.reduce(
        (count, finding) => count + (finding?.isPublic ? 1 : 0),
        0
      ),
      inspectorCoverage,
      inspectorCoverageTotal:
        Number(inspectorCoverage?.ec2?.total || 0) +
        Number(inspectorCoverage?.ecr?.total || 0) +
        Number(inspectorCoverage?.lambda?.total || 0),
      inspectorInactiveCoverageTotal:
        Number(inspectorCoverage?.ec2?.inactive || 0) +
        Number(inspectorCoverage?.ecr?.inactive || 0) +
        Number(inspectorCoverage?.lambda?.inactive || 0),
    };
  });

const buildAggregateSummary = (environmentRows) => {
  const loadedRows = environmentRows.filter((row) => row.hasData);
  const mergedFindings = loadedRows
    .flatMap((row) =>
      buildMergedFindings(row.payload, {
        environmentName: row.name,
        accountId: row.accountId,
        permissionProfileId: row.permissionProfileId,
      })
    )
    .sort((left, right) => Date.parse(right.timestamp || 0) - Date.parse(left.timestamp || 0));

  const mostRecentUpdate = loadedRows.reduce((latest, row) => {
    const latestTimestamp = Date.parse(latest || '') || 0;
    const rowTimestamp = Date.parse(row.lastUpdatedAt || '') || 0;
    return rowTimestamp > latestTimestamp ? row.lastUpdatedAt : latest;
  }, null);

  const guardDutyFindings = loadedRows.flatMap((row) => row.guardDutyFindings || []);
  const inspectorFindings = loadedRows.flatMap((row) => row.inspectorFindings || []);
  const accessAnalyzerFindings = loadedRows.flatMap((row) => row.accessAnalyzerFindings || []);
  const nonCompliantInstances = loadedRows.flatMap((row) => row.nonCompliantInstances || []);
  const inspectorCoverageByType = mergeInspectorCoverage(loadedRows);

  const featureCoverage = FEATURE_LABELS.reduce((accumulator, [key]) => {
    accumulator[key] = loadedRows.reduce(
      (count, row) => count + (row.guardDutyFeatureSummary?.[key] === true ? 1 : 0),
      0
    );
    return accumulator;
  }, {});

  return {
    loadedEnvironmentCount: loadedRows.length,
    totalEnvironmentCount: environmentRows.length,
    guardDutyEnabledCount: loadedRows.filter((row) => row.guardDutyEnabled).length,
    totalFindings: loadedRows.reduce((sum, row) => sum + row.totalFindings, 0),
    managedEc2Instances: loadedRows.reduce((sum, row) => sum + row.managedEc2Instances, 0),
    compliantManagedInstances: loadedRows.reduce(
      (sum, row) => sum + row.compliantManagedInstances,
      0
    ),
    unmanagedEc2Instances: loadedRows.reduce((sum, row) => sum + row.unmanagedEc2Instances, 0),
    nonCompliantManagedInstances: loadedRows.reduce(
      (sum, row) => sum + row.nonCompliantManagedInstances,
      0
    ),
    analyzerCount: loadedRows.reduce((sum, row) => sum + row.analyzerCount, 0),
    inspectorCoverageTotal: loadedRows.reduce((sum, row) => sum + row.inspectorCoverageTotal, 0),
    inspectorInactiveCoverageTotal: loadedRows.reduce(
      (sum, row) => sum + row.inspectorInactiveCoverageTotal,
      0
    ),
    inspectorCoverageByType,
    guardDutyFindings,
    inspectorFindings,
    accessAnalyzerFindings,
    nonCompliantInstances,
    mergedFindings,
    featureCoverage,
    lastUpdatedAt: mostRecentUpdate,
    environmentsWithoutGuardDuty: loadedRows.filter((row) => !row.guardDutyEnabled).length,
    environmentsWithoutAnalyzer: loadedRows.filter((row) => row.analyzerCount === 0).length,
  };
};

function ThreatServiceTable({
  rows,
  onSelectService,
}) {
  const sortedRows = [...rows].sort((left, right) => {
    const getSortValue = (row) => {
      const findingsMetric =
        row.metrics.find((metric) => metric.category === 'findings' && metric.label === 'findings') ||
        row.metrics.find((metric) => metric.category === 'findings' && metric.label === 'non-compliant') ||
        row.metrics.find((metric) => metric.category === 'findings');
      return coerceMetricToNumber(findingsMetric?.value);
    };

    const leftFindings = getSortValue(left);
    const rightFindings = getSortValue(right);

    if (rightFindings !== leftFindings) {
      return rightFindings - leftFindings;
    }

    return left.title.localeCompare(right.title);
  });

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <div className="grid grid-cols-[minmax(220px,1.3fr)_minmax(140px,0.8fr)_minmax(180px,1fr)_70px] gap-2 border-b border-slate-200 bg-slate-50/80 px-5 py-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Service</div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Configuration</div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Findings</div>
        <div></div>
      </div>
      <div className="divide-y divide-slate-100">
        {sortedRows.map((row) => {
          const statusVariant = getStatusVariant(row.status);
          const StatusIcon = statusVariant.icon;
          const hasIssues = row.status === 'problem';
          const configMetrics = row.metrics.filter(m => m.category === 'config');
          const findingMetrics = row.metrics.filter(m => m.category === 'findings');

          return (
            <div
              key={row.key}
              className="group grid grid-cols-[minmax(220px,1.3fr)_minmax(140px,0.8fr)_minmax(180px,1fr)_70px] items-center gap-2 px-5 py-3 transition-all hover:bg-slate-50/70"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  hasIssues 
                    ? 'bg-gradient-to-br from-rose-50 to-red-100 text-rose-500' 
                    : row.status === 'healthy'
                      ? 'bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-500'
                      : 'bg-gradient-to-br from-slate-50 to-slate-100 text-slate-400'
                }`}>
                  <StatusIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold text-slate-800">{row.title}</span>
                    <span className={`inline-flex h-2 w-2 rounded-full ${
                      hasIssues ? 'bg-rose-400' : row.status === 'healthy' ? 'bg-emerald-400' : 'bg-slate-300'
                    }`} />
                  </div>
                  <div className="text-[13px] text-slate-500">{row.subtitle}</div>
                </div>
              </div>

              <div className="flex items-center gap-5">
                {configMetrics.slice(0, 2).map((metric) => (
                  <div key={`${row.key}:config:${metric.label}`} className="min-w-0">
                    <div className={`text-[15px] font-semibold tabular-nums ${getMetricToneClass(metric.tone)}`}>
                      {formatMetricValue(metric.value)}
                    </div>
                    <div className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {metric.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-5">
                {findingMetrics.slice(0, 2).map((metric) => (
                  <div key={`${row.key}:finding:${metric.label}`} className="min-w-0">
                    <div className={`text-[15px] font-semibold tabular-nums ${getMetricToneClass(metric.tone)}`}>
                      {formatMetricValue(metric.value)}
                    </div>
                    <div className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {metric.label}
                    </div>
                  </div>
                ))}
                {row.configCount > 0 && (
                  <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    <AlertTriangle className="h-3 w-3" />
                    <span>{row.configCount}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2.5 text-[13px] text-slate-500 opacity-0 transition-all group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-700"
                  onClick={() => onSelectService(row.key)}
                >
                  Details
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailMetricCard({ label, value, sublabel, tone = 'neutral', clickable = false }) {
  return (
    <div className={`rounded-xl border bg-white px-4 py-3 ${
      clickable 
        ? 'border-slate-300 shadow-sm hover:border-slate-400 hover:shadow' 
        : 'border-slate-200'
    }`}>
      <div className={`text-xl font-semibold tabular-nums ${getMetricToneClass(tone)}`}>{formatMetricValue(value)}</div>
      <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
      {sublabel ? (
        <div className={`mt-1 text-xs ${clickable ? 'text-blue-500' : 'text-slate-400'}`}>
          {sublabel}
        </div>
      ) : null}
    </div>
  );
}

function TopFindingsPreview({ findings, title = 'Top Findings', maxPerSource = 3 }) {
  const [expandedIds, setExpandedIds] = useState({});
  const sources = ['GuardDuty', 'Inspector', 'Access Analyzer', 'Patch Compliance'];
  
  const topFromEachSource = sources.flatMap((source) => {
    const sourceFindings = findings.filter((f) => f.source === source);
    return sortBySeverity(sourceFindings).slice(0, maxPerSource);
  });
  
  const displayFindings = sortBySeverity(topFromEachSource);
  
  if (!displayFindings.length) return null;

  const toggleFinding = (key) => {
    setExpandedIds((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <h3 className="text-[13px] font-semibold text-slate-800">{title}</h3>
        <span className="text-[11px] text-slate-400">{findings.length} total</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="w-[28px] px-2 py-2"></th>
              <th className="whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Severity</th>
              <th className="whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Source</th>
              <th className="whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Account</th>
              <th className="whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Finding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {displayFindings.map((finding, idx) => {
              const severity = extractSeverityLabel(finding) || 'unknown';
              const envName = getFindingContextLabel(finding);
              const findingKey = `preview:${finding.permissionProfileId || 'f'}:${finding.primaryId || finding.title}:${idx}`;
              const isExpanded = expandedIds[findingKey] === true;
              const dateLabel = formatTimestamp(getFindingDateValue(finding));
              const detailJson = stringifyFindingDetails(finding.details);

              return (
                <React.Fragment key={findingKey}>
                  <tr
                    className="cursor-pointer hover:bg-slate-50/50"
                    onClick={() => toggleFinding(findingKey)}
                  >
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        className="rounded-sm p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        onClick={(e) => { e.stopPropagation(); toggleFinding(findingKey); }}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize ${getSeverityBadgeClass(severity)}`}>
                        {severity}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className="text-[12px] font-medium text-slate-600">{finding.source || '—'}</span>
                    </td>
                    <td className="max-w-[100px] px-3 py-2">
                      <div className="truncate text-[12px] text-slate-600" title={envName}>{envName || '—'}</div>
                    </td>
                    <td className="max-w-[280px] px-3 py-2">
                      <div className="truncate text-[12px] font-medium text-slate-700" title={finding.title}>{finding.title}</div>
                      <div className="text-[11px] text-slate-400">{dateLabel}</div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-slate-50/40">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="space-y-3">
                          {finding.description && (
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Description</div>
                              <p className="mt-1 text-[12px] text-slate-700">{finding.description}</p>
                            </div>
                          )}
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Date</div>
                              <div className="mt-1 text-[12px] text-slate-700">{dateLabel}</div>
                            </div>
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Account</div>
                              <div className="mt-1 text-[12px] text-slate-700">{finding.accountId || envName || '—'}</div>
                            </div>
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Region</div>
                              <div className="mt-1 text-[12px] text-slate-700">{finding.region || 'Unknown'}</div>
                            </div>
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Resource</div>
                              <div className="mt-1 break-all text-[12px] text-slate-700">{getFindingResourceLabel(finding)}</div>
                            </div>
                          </div>
                          {finding.consoleUrl && (
                            <a
                              href={finding.consoleUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:text-blue-700"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open in AWS Console
                            </a>
                          )}
                          {detailJson && (
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Details</div>
                              <pre className="mt-1 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-700">
                                {detailJson}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FindingsTable({ findings, showEnvironment = false }) {
  const [expandedIds, setExpandedIds] = useState({});

  if (!findings.length) {
    return <div className="py-8 text-center text-sm text-slate-500">No findings returned.</div>;
  }

  const sortedFindings = sortBySeverity(findings);
  const toggleFinding = (findingKey) =>
    setExpandedIds((current) => ({
      ...current,
      [findingKey]: !current[findingKey],
    }));

  return (
    <div className="max-h-[360px] overflow-auto rounded-xl border border-slate-200">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80">
            {showEnvironment && <TableHead className="w-[160px]">Account</TableHead>}
            <TableHead>Finding</TableHead>
            <TableHead className="w-[90px]">Severity</TableHead>
            <TableHead className="w-[180px]">Resource</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedFindings.slice(0, 150).map((finding, idx) => {
            const severity = extractSeverityLabel(finding) || 'unknown';
            const findingKey = `${finding.permissionProfileId || 'env'}:${finding.primaryId || finding.title || idx}`;
            const isExpanded = expandedIds[findingKey] === true;
            const detailJson = stringifyFindingDetails(finding.details);
            const contextLabel = getFindingContextLabel(finding);
            const dateLabel = formatTimestamp(getFindingDateValue(finding));
            return (
              <React.Fragment key={findingKey}>
                <TableRow
                  className="cursor-pointer hover:bg-slate-50/60"
                  onClick={() => toggleFinding(findingKey)}
                >
                  {showEnvironment && (
                    <TableCell>
                      <div className="font-medium text-slate-800">{contextLabel}</div>
                      {finding.accountId && finding.environmentName && (
                        <div className="truncate text-xs text-slate-400">{finding.accountId}</div>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        className="mt-0.5 rounded-sm p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleFinding(findingKey);
                        }}
                        aria-label={isExpanded ? 'Collapse finding' : 'Expand finding'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800">{finding.title}</div>
                        <div className="truncate text-xs text-slate-400">
                          {getFindingSubtext(finding) || '—'}
                        </div>
                        <div className="text-xs text-slate-400">Date: {dateLabel}</div>
                        {finding.consoleUrl ? (
                          <a
                            href={finding.consoleUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-800"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open in AWS
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${getSeverityBadgeClass(severity)}`}>
                      {severity}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[180px]">
                    <div className="truncate text-sm text-slate-600">{getFindingResourceLabel(finding)}</div>
                  </TableCell>
                </TableRow>
                {isExpanded ? (
                  <TableRow className="bg-slate-50/40">
                    <TableCell colSpan={showEnvironment ? 4 : 3}>
                      <div className="space-y-3 px-1 py-3">
                        {finding.description ? (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Description
                            </div>
                            <p className="mt-1 text-sm text-slate-700">{finding.description}</p>
                          </div>
                        ) : null}
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</div>
                            <div className="mt-1 text-sm text-slate-700">{dateLabel}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account</div>
                            <div className="mt-1 text-sm text-slate-700">{finding.accountId || contextLabel}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Region</div>
                            <div className="mt-1 text-sm text-slate-700">{finding.region || 'Unknown'}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resource</div>
                            <div className="mt-1 break-all text-sm text-slate-700">{getFindingResourceLabel(finding)}</div>
                          </div>
                        </div>
                        {detailJson ? (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Captured Details
                            </div>
                            <pre className="mt-1 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
                              {detailJson}
                            </pre>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function InspectorCoverageBreakdownTable({ coverageByType = {} }) {
  const rows = [
    ['EC2', coverageByType?.ec2 || {}],
    ['ECR', coverageByType?.ecr || {}],
    ['Lambda', coverageByType?.lambda || {}],
  ];

  return (
    <div className="rounded-xl border border-slate-200">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80">
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Active</TableHead>
            <TableHead className="text-right">Inactive</TableHead>
            <TableHead className="text-right">Managed</TableHead>
            <TableHead className="text-right">Unmanaged</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(([label, coverage]) => (
            <TableRow key={label}>
              <TableCell className="font-medium text-slate-800">{label}</TableCell>
              <TableCell className="text-right tabular-nums text-slate-700">{Number(coverage?.total || 0)}</TableCell>
              <TableCell className="text-right tabular-nums text-emerald-700">{Number(coverage?.active || 0)}</TableCell>
              <TableCell className="text-right tabular-nums text-rose-600">{Number(coverage?.inactive || 0)}</TableCell>
              <TableCell className="text-right tabular-nums text-slate-700">{Number(coverage?.managed || 0)}</TableCell>
              <TableCell className="text-right tabular-nums text-slate-700">{Number(coverage?.unmanaged || 0)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EnvironmentFeatureCoverageTable({
  rows,
  featureLabels,
  getFeatureEnabled,
  getFindingCount,
  onSelectEnvironment,
}) {
  const sortedRows = [...rows].sort((left, right) => {
    const leftFindings = Number(
      typeof getFindingCount === 'function' ? getFindingCount(left) : left.totalFindings || 0
    );
    const rightFindings = Number(
      typeof getFindingCount === 'function' ? getFindingCount(right) : right.totalFindings || 0
    );

    if (rightFindings !== leftFindings) {
      return rightFindings - leftFindings;
    }

    return String(left.name || left.accountId || '').localeCompare(
      String(right.name || right.accountId || '')
    );
  });

  return (
    <div className="max-h-[400px] overflow-auto rounded-xl border border-slate-200">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80">
            <TableHead className="sticky left-0 z-10 min-w-[140px] bg-slate-50/80">Account</TableHead>
            <TableHead className="w-[80px] text-center">Findings</TableHead>
            {featureLabels.map(([key, label]) => (
              <TableHead key={key} className="w-[100px] text-center text-xs">
                {label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow
              key={row.permissionProfileId}
              className="cursor-pointer hover:bg-slate-50/70"
              onClick={() => onSelectEnvironment?.(row.permissionProfileId)}
            >
              <TableCell className="sticky left-0 z-10 bg-white">
                <div className="font-medium text-slate-800">{row.name}</div>
                <div className="text-xs text-slate-400">{row.accountId || ''}</div>
              </TableCell>
              <TableCell className="text-center">
                {(() => {
                  const findingCount = Number(
                    typeof getFindingCount === 'function'
                      ? getFindingCount(row)
                      : row.totalFindings || 0
                  );
                  return (
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        findingCount > 0 ? 'text-rose-600' : 'text-slate-400'
                      }`}
                    >
                      {findingCount}
                    </span>
                  );
                })()}
              </TableCell>
              {featureLabels.map(([key]) => {
                const enabled = getFeatureEnabled(row, key);
                return (
                  <TableCell key={key} className="text-center">
                    {enabled ? (
                      <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="mx-auto h-4 w-4 text-slate-300" />
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ServiceDetailsDialog({
  open,
  onOpenChange,
  service,
  isAggregateScope,
}) {
  const scrollContainerRef = React.useRef(null);
  const [activeSection, setActiveSection] = React.useState(0);

  const scrollToSection = (index) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const sectionEl = container.querySelector(`[data-section-index="${index}"]`);
    if (sectionEl) {
      sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(index);
    }
  };

  const isFindingsMetric = (label) => {
    const lower = label.toLowerCase();
    return lower.includes('finding') || lower.includes('critical') || lower.includes('non-compliant') || lower.includes('public');
  };

  const findingsIndex = service?.detailSections?.findIndex(s => 
    s.title.toLowerCase().includes('finding')
  ) ?? -1;

  if (!service) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-[1200px] flex-col overflow-hidden bg-white p-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl text-slate-900">{service.title}</DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                {service.subtitle}
                {isAggregateScope ? ' — aggregated across all environments' : ''}
              </DialogDescription>
            </div>
          </div>
          
          {service.detailSections.length > 1 && (
            <div className="mt-3 flex items-center gap-1">
              {service.detailSections.map((section, idx) => (
                <button
                  key={`nav-${section.title}`}
                  onClick={() => scrollToSection(idx)}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    activeSection === idx
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  }`}
                >
                  {section.title}
                </button>
              ))}
            </div>
          )}
        </DialogHeader>

        <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {service.detailMetrics.map((metric) => {
                const clickable = isFindingsMetric(metric.label) && findingsIndex >= 0;
                return (
                  <div
                    key={`${service.key}:${metric.label}`}
                    onClick={clickable ? () => scrollToSection(findingsIndex) : undefined}
                    className={clickable ? 'cursor-pointer transition-transform hover:scale-[1.02]' : ''}
                  >
                    <DetailMetricCard
                      label={metric.label}
                      value={metric.value}
                      sublabel={clickable ? `${metric.sublabel || ''} — Click to view` : metric.sublabel}
                      tone={metric.tone}
                      clickable={clickable}
                    />
                  </div>
                );
              })}
            </div>

            {service.detailSections.map((section, idx) => (
              <Card 
                key={`${service.key}:${section.title}`} 
                data-section-index={idx}
                className="border-slate-200 shadow-sm scroll-mt-4"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-800">{section.title}</CardTitle>
                </CardHeader>
                <CardContent>{section.content}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ThreatDashboard() {
  const dispatch = useDispatch();
  const environmentProfiles = useSelector(selectWorkspaceScopedEnvironmentProfiles);
  const threatRequestsById = useSelector(selectEnvironmentThreatRequestsById);
  const threatResultsById = useSelector(selectEnvironmentThreatResultsById);
  const inflightThreatFetchIdsRef = useRef(new Set());

  const awsAccountProfiles = useMemo(
    () => (Array.isArray(environmentProfiles) ? environmentProfiles : []).filter(isAwsAccountProfile),
    [environmentProfiles]
  );

  const [selectedScope, setSelectedScope] = useState(ALL_ENVIRONMENTS_SCOPE);
  const [selectedServiceKey, setSelectedServiceKey] = useState('guardduty');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [scopeComboOpen, setScopeComboOpen] = useState(false);

  const isAggregateScope = selectedScope === ALL_ENVIRONMENTS_SCOPE;
  const selectedPermissionProfileId = isAggregateScope ? '' : selectedScope;

  useEffect(() => {
    if (!awsAccountProfiles.length) {
      setSelectedScope(ALL_ENVIRONMENTS_SCOPE);
      return;
    }

    // Single environment: we don't render a matching "all" option (see Select below), so
    // keep scope on the real profile id — otherwise Radix shows an empty trigger while data loads.
    if (awsAccountProfiles.length === 1) {
      const onlyId = getPermissionProfileId(awsAccountProfiles[0]);
      if (onlyId && selectedScope !== onlyId) {
        setSelectedScope(onlyId);
      }
      return;
    }

    if (selectedScope === ALL_ENVIRONMENTS_SCOPE) return;

    const hasSelectedEnvironment = awsAccountProfiles.some(
      (profile) => getPermissionProfileId(profile) === selectedScope
    );

    if (hasSelectedEnvironment) return;
    setSelectedScope(ALL_ENVIRONMENTS_SCOPE);
  }, [awsAccountProfiles, selectedScope]);

  const refreshThreatTargets = useCallback(
    async (permissionProfileIds, forceRefresh = false) => {
      await dispatch(
        launchEnvironmentThreatScans({
          targets: permissionProfileIds.map((permissionProfileId) => ({ permissionProfileId })),
          forceRefresh,
        })
      ).unwrap();

      return {
        succeeded: permissionProfileIds.length,
        failed: 0,
      };
    },
    [dispatch]
  );

  const loadThreatResult = useCallback(
    async (permissionProfileId, profile) => {
      const normalizedProfileId = String(permissionProfileId || '').trim();
      if (!normalizedProfileId) return null;

      if (threatResultsById?.[normalizedProfileId]) {
        return threatResultsById[normalizedProfileId];
      }

      if (!hasStoredThreatMetadata(profile)) {
        return null;
      }

      if (inflightThreatFetchIdsRef.current.has(normalizedProfileId)) {
        return null;
      }

      inflightThreatFetchIdsRef.current.add(normalizedProfileId);
      try {
        const action = await dispatch(
          refreshEnvironmentThreatDetection({
            permissionProfileId: normalizedProfileId,
            forceRefresh: false,
            allowWhileLoading: true,
          })
        );

        if (refreshEnvironmentThreatDetection.fulfilled.match(action)) {
          return action.payload?.payload || null;
        }

        if (action.meta?.condition) {
          return threatResultsById?.[normalizedProfileId] || null;
        }

        return null;
      } finally {
        inflightThreatFetchIdsRef.current.delete(normalizedProfileId);
      }
    },
    [dispatch, threatResultsById]
  );

  useEffect(() => {
    if (!selectedScope) return;

    if (selectedScope === ALL_ENVIRONMENTS_SCOPE) {
      awsAccountProfiles.forEach((profile) => {
        const permissionProfileId = getPermissionProfileId(profile);
        if (!permissionProfileId) return;
        void loadThreatResult(permissionProfileId, profile);
      });
      return;
    }

    const selectedProfile = awsAccountProfiles.find(
      (profile) => getPermissionProfileId(profile) === selectedScope
    );
    void loadThreatResult(selectedScope, selectedProfile);
  }, [awsAccountProfiles, loadThreatResult, selectedScope]);

  const selectedProfile = useMemo(
    () =>
      awsAccountProfiles.find(
        (profile) => getPermissionProfileId(profile) === selectedPermissionProfileId
      ) || null,
    [awsAccountProfiles, selectedPermissionProfileId]
  );
  const selectedScopeLabel = isAggregateScope
    ? 'All Environments'
    : selectedProfile
      ? getEnvironmentLabel(selectedProfile)
      : 'Select environment';

  const selectedRequest = threatRequestsById?.[selectedPermissionProfileId] || null;
  const selectedRecord = threatResultsById?.[selectedPermissionProfileId] || null;
  const selectedPayload = getThreatPayload(selectedRecord);
  const selectedSummary = selectedPayload?.summary || {};
  const selectedChecks = Array.isArray(selectedPayload?.checks) ? selectedPayload.checks : [];

  const environmentRows = useMemo(
    () => buildEnvironmentRows(awsAccountProfiles, threatResultsById, threatRequestsById),
    [awsAccountProfiles, threatRequestsById, threatResultsById]
  );

  const aggregateSummary = useMemo(
    () => buildAggregateSummary(environmentRows),
    [environmentRows]
  );

  const selectedMergedFindings = useMemo(
    () =>
      buildMergedFindings(selectedPayload, {
        environmentName: selectedProfile ? getEnvironmentLabel(selectedProfile) : null,
        accountId: selectedProfile ? getAccountId(selectedProfile) : null,
        permissionProfileId: selectedPermissionProfileId,
      }),
    [selectedPayload, selectedProfile, selectedPermissionProfileId]
  );

  const handleRefresh = async (forceRefresh = false) => {
    const permissionProfileIds = isAggregateScope
      ? awsAccountProfiles.map(getPermissionProfileId).filter(Boolean)
      : selectedPermissionProfileId
        ? [selectedPermissionProfileId]
        : [];

    if (!permissionProfileIds.length) return;

    const result = await refreshThreatTargets(permissionProfileIds, forceRefresh);
    if (result.failed > 0 && result.succeeded === 0) {
      toast.error(
        isAggregateScope
          ? 'Failed to refresh threat data for all environments.'
          : 'Failed to refresh threat data.'
      );
      return;
    }

    if (result.failed > 0) {
      toast.success(`Refreshed ${result.succeeded} environment${result.succeeded === 1 ? '' : 's'}.`);
      return;
    }

    toast.success(
      isAggregateScope
        ? 'Threat detection started for all environments.'
        : 'Threat detection started.'
    );
  };

  const openServiceDetails = useCallback((serviceKey) => {
    setSelectedServiceKey(serviceKey);
    setIsDetailOpen(true);
  }, []);

  const currentServiceRows = useMemo(() => {
    const guardDutyFeatureSummary = selectedSummary?.guardDuty?.featureSummary || {};
    const guardDutyFindings = selectedMergedFindings.filter(
      (finding) => finding.source === 'GuardDuty'
    );
    const inspectorFindings = selectedMergedFindings.filter(
      (finding) => finding.source === 'Inspector'
    );
    const accessAnalyzerFindings = selectedMergedFindings.filter(
      (finding) => finding.source === 'Access Analyzer'
    );
    const nonCompliantInstances = selectedMergedFindings.filter(
      (finding) => finding.source === 'Patch Compliance'
    );
    const inspectorCoverage = selectedSummary?.inspector?.coverageByType || {};

    const aggregateGuardDutyHighCritical = countCriticalHighFindings(
      aggregateSummary.guardDutyFindings
    );
    const singleGuardDutyHighCritical = countCriticalHighFindings(guardDutyFindings);
    const aggregateInspectorHighCritical = countCriticalHighFindings(
      aggregateSummary.inspectorFindings
    );
    const singleInspectorHighCritical = countCriticalHighFindings(inspectorFindings);

    const serviceRows = [
      {
        key: 'guardduty',
        title: 'Threat Detection',
        subtitle: 'AWS GuardDuty',
        status: isAggregateScope
          ? aggregateSummary.loadedEnvironmentCount === 0
            ? 'unknown'
            : aggregateSummary.totalFindings > 0 || aggregateSummary.environmentsWithoutGuardDuty > 0
              ? 'problem'
              : 'healthy'
          : selectedPayload
            ? Number(selectedSummary?.findings?.guardDuty || 0) > 0 || !selectedSummary?.guardDuty?.enabled
              ? 'problem'
              : 'healthy'
            : 'unknown',
        configCount: isAggregateScope
          ? aggregateSummary.environmentsWithoutGuardDuty +
            FEATURE_LABELS.reduce((count, [key]) => {
              const enabledCount = aggregateSummary.featureCoverage?.[key] || 0;
              return count + Math.max(0, aggregateSummary.loadedEnvironmentCount - enabledCount);
            }, 0)
          : (selectedSummary?.guardDuty?.enabled ? 0 : 1) +
            FEATURE_LABELS.reduce(
              (count, [key]) => count + (guardDutyFeatureSummary?.[key] === true ? 0 : 1),
              0
            ),
        metrics: isAggregateScope
          ? [
              {
                label: 'enabled',
                value: `${aggregateSummary.guardDutyEnabledCount}/${aggregateSummary.loadedEnvironmentCount}`,
                tone:
                  aggregateSummary.guardDutyEnabledCount === aggregateSummary.loadedEnvironmentCount &&
                  aggregateSummary.loadedEnvironmentCount > 0
                    ? 'success'
                    : 'danger',
                category: 'config',
              },
              {
                label: 'features',
                value: FEATURE_LABELS.reduce(
                  (count, [key]) => count + (aggregateSummary.featureCoverage?.[key] || 0),
                  0
                ),
                tone: 'neutral',
                category: 'config',
              },
              {
                label: 'findings',
                value: aggregateSummary.guardDutyFindings.length,
                tone: aggregateSummary.guardDutyFindings.length > 0 ? 'danger' : 'success',
                category: 'findings',
              },
              {
                label: 'critical',
                value: aggregateGuardDutyHighCritical,
                tone: aggregateGuardDutyHighCritical > 0 ? 'danger' : 'success',
                category: 'findings',
              },
            ]
          : [
              {
                label: 'enabled',
                value: `${Number(selectedSummary?.guardDuty?.enabledRegions || 0)}/${Number(selectedSummary?.totalRegions || 0)}`,
                tone: selectedSummary?.guardDuty?.enabled ? 'success' : 'danger',
                category: 'config',
              },
              {
                label: 'features',
                value: `${countEnabledFeatures(guardDutyFeatureSummary)}/${FEATURE_LABELS.length}`,
                tone:
                  countEnabledFeatures(guardDutyFeatureSummary) === FEATURE_LABELS.length
                    ? 'success'
                    : 'warning',
                category: 'config',
              },
              {
                label: 'findings',
                value: Number(selectedSummary?.findings?.guardDuty || 0),
                tone: Number(selectedSummary?.findings?.guardDuty || 0) > 0 ? 'danger' : 'success',
                category: 'findings',
              },
              {
                label: 'critical',
                value: singleGuardDutyHighCritical,
                tone: singleGuardDutyHighCritical > 0 ? 'danger' : 'success',
                category: 'findings',
              },
            ],
        detailMetrics: isAggregateScope
          ? [
              {
                label: 'Environments Loaded',
                value: `${aggregateSummary.loadedEnvironmentCount}/${aggregateSummary.totalEnvironmentCount}`,
                sublabel: 'Loaded into the aggregated threat view',
                tone: 'neutral',
              },
              {
                label: 'GuardDuty Enabled',
                value: aggregateSummary.guardDutyEnabledCount,
                sublabel: 'Environments with GuardDuty enabled',
                tone:
                  aggregateSummary.guardDutyEnabledCount === aggregateSummary.loadedEnvironmentCount &&
                  aggregateSummary.loadedEnvironmentCount > 0
                    ? 'success'
                    : 'warning',
              },
              {
                label: 'Active Findings',
                value: aggregateSummary.guardDutyFindings.length,
                sublabel: 'All GuardDuty findings across loaded environments',
                tone: aggregateSummary.guardDutyFindings.length > 0 ? 'danger' : 'success',
              },
              {
                label: 'Critical & High',
                value: aggregateGuardDutyHighCritical,
                sublabel: 'Severity filtered from GuardDuty findings',
                tone: aggregateGuardDutyHighCritical > 0 ? 'danger' : 'success',
              },
            ]
          : [
              {
                label: 'Enabled Regions',
                value: `${Number(selectedSummary?.guardDuty?.enabledRegions || 0)}/${Number(selectedSummary?.totalRegions || 0)}`,
                sublabel: 'GuardDuty enabled regions',
                tone: selectedSummary?.guardDuty?.enabled ? 'success' : 'warning',
              },
              {
                label: 'Features Enabled',
                value: `${countEnabledFeatures(guardDutyFeatureSummary)}/${FEATURE_LABELS.length}`,
                sublabel: 'Feature coverage for this environment',
                tone:
                  countEnabledFeatures(guardDutyFeatureSummary) === FEATURE_LABELS.length
                    ? 'success'
                    : 'warning',
              },
              {
                label: 'Active Findings',
                value: Number(selectedSummary?.findings?.guardDuty || 0),
                sublabel: 'GuardDuty findings',
                tone: Number(selectedSummary?.findings?.guardDuty || 0) > 0 ? 'danger' : 'success',
              },
              {
                label: 'Critical & High',
                value: singleGuardDutyHighCritical,
                sublabel: 'Severity filtered from findings',
                tone: singleGuardDutyHighCritical > 0 ? 'danger' : 'success',
              },
            ],
        detailSections: isAggregateScope
          ? [
              {
                title: 'Environment & Feature Coverage',
                content: (
                  <EnvironmentFeatureCoverageTable
                    rows={environmentRows.filter((row) => row.hasData)}
                    featureLabels={FEATURE_LABELS}
                    getFindingCount={(row) => row.guardDutyFindingsCount}
                    getFeatureEnabled={(row, key) => row.guardDutyFeatureSummary?.[key] === true}
                  />
                ),
              },
              {
                title: 'GuardDuty Findings',
                content: (
                  <FindingsTable findings={aggregateSummary.guardDutyFindings} showEnvironment />
                ),
              },
            ]
          : [
              {
                title: 'Feature Coverage',
                content: (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {FEATURE_LABELS.map(([key, label]) => {
                      const enabled = guardDutyFeatureSummary?.[key] === true;
                      return (
                        <div
                          key={key}
                          className={`rounded-2xl border px-4 py-4 ${
                            enabled ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {enabled ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-slate-400" />
                            )}
                            <span className="text-sm font-medium text-slate-900">{label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ),
              },
              {
                title: 'GuardDuty Findings',
                content: <FindingsTable findings={guardDutyFindings} />,
              },
            ],
        showEnvironmentCoverage: false,
        environmentRows: [],
      },
      {
        key: 'inspector',
        title: 'Vulnerability Management',
        subtitle: 'Amazon Inspector',
        status: isAggregateScope
          ? aggregateSummary.loadedEnvironmentCount === 0
            ? 'unknown'
            : aggregateSummary.inspectorFindings.length > 0 ||
                aggregateSummary.inspectorInactiveCoverageTotal > 0
              ? 'problem'
              : 'healthy'
          : selectedPayload
            ? Number(selectedSummary?.findings?.inspector || 0) > 0 ||
              Number(
                (selectedSummary?.inspector?.coverageByType?.ec2?.inactive || 0) +
                  (selectedSummary?.inspector?.coverageByType?.ecr?.inactive || 0) +
                  (selectedSummary?.inspector?.coverageByType?.lambda?.inactive || 0)
              ) > 0
              ? 'problem'
              : 'healthy'
            : 'unknown',
        configCount: isAggregateScope
          ? aggregateSummary.inspectorInactiveCoverageTotal
          : Number(inspectorCoverage?.ec2?.inactive || 0) +
            Number(inspectorCoverage?.ecr?.inactive || 0) +
            Number(inspectorCoverage?.lambda?.inactive || 0),
        metrics: isAggregateScope
          ? [
              {
                label: 'inactive',
                value: aggregateSummary.inspectorInactiveCoverageTotal,
                tone: aggregateSummary.inspectorInactiveCoverageTotal > 0 ? 'danger' : 'success',
                category: 'config',
              },
              {
                label: 'coverage',
                value: aggregateSummary.inspectorCoverageTotal,
                tone: 'neutral',
                category: 'config',
              },
              {
                label: 'findings',
                value: aggregateSummary.inspectorFindings.length,
                tone: aggregateSummary.inspectorFindings.length > 0 ? 'danger' : 'success',
                category: 'findings',
              },
              {
                label: 'critical',
                value: aggregateInspectorHighCritical,
                tone: aggregateInspectorHighCritical > 0 ? 'danger' : 'success',
                category: 'findings',
              },
            ]
          : [
              {
                label: 'inactive',
                value:
                  Number(inspectorCoverage?.ec2?.inactive || 0) +
                  Number(inspectorCoverage?.ecr?.inactive || 0) +
                  Number(inspectorCoverage?.lambda?.inactive || 0),
                tone:
                  Number(inspectorCoverage?.ec2?.inactive || 0) +
                    Number(inspectorCoverage?.ecr?.inactive || 0) +
                    Number(inspectorCoverage?.lambda?.inactive || 0) >
                  0
                    ? 'danger'
                    : 'success',
                category: 'config',
              },
              {
                label: 'coverage',
                value:
                  Number(inspectorCoverage?.ec2?.total || 0) +
                  Number(inspectorCoverage?.ecr?.total || 0) +
                  Number(inspectorCoverage?.lambda?.total || 0),
                tone: 'neutral',
                category: 'config',
              },
              {
                label: 'findings',
                value: Number(selectedSummary?.findings?.inspector || 0),
                tone: Number(selectedSummary?.findings?.inspector || 0) > 0 ? 'danger' : 'success',
                category: 'findings',
              },
              {
                label: 'critical',
                value: singleInspectorHighCritical,
                tone: singleInspectorHighCritical > 0 ? 'danger' : 'success',
                category: 'findings',
              },
            ],
        detailMetrics: isAggregateScope
          ? [
              {
                label: 'Coverage Total',
                value: aggregateSummary.inspectorCoverageTotal,
                sublabel: 'EC2, ECR, and Lambda coverage items',
                tone: 'neutral',
              },
              {
                label: 'Inactive Coverage',
                value: aggregateSummary.inspectorInactiveCoverageTotal,
                sublabel: 'Coverage rows still inactive',
                tone: aggregateSummary.inspectorInactiveCoverageTotal > 0 ? 'danger' : 'success',
              },
              {
                label: 'Active Findings',
                value: aggregateSummary.inspectorFindings.length,
                sublabel: 'Inspector findings across environments',
                tone: aggregateSummary.inspectorFindings.length > 0 ? 'danger' : 'success',
              },
              {
                label: 'Critical & High',
                value: aggregateInspectorHighCritical,
                sublabel: 'Severity filtered from Inspector findings',
                tone: aggregateInspectorHighCritical > 0 ? 'danger' : 'success',
              },
            ]
          : [
              {
                label: 'Coverage Total',
                value:
                  Number(inspectorCoverage?.ec2?.total || 0) +
                  Number(inspectorCoverage?.ecr?.total || 0) +
                  Number(inspectorCoverage?.lambda?.total || 0),
                sublabel: 'EC2, ECR, and Lambda coverage items',
                tone: 'neutral',
              },
              {
                label: 'Inactive Coverage',
                value:
                  Number(inspectorCoverage?.ec2?.inactive || 0) +
                  Number(inspectorCoverage?.ecr?.inactive || 0) +
                  Number(inspectorCoverage?.lambda?.inactive || 0),
                sublabel: 'Coverage rows still inactive',
                tone:
                  Number(inspectorCoverage?.ec2?.inactive || 0) +
                    Number(inspectorCoverage?.ecr?.inactive || 0) +
                    Number(inspectorCoverage?.lambda?.inactive || 0) >
                  0
                    ? 'danger'
                    : 'success',
              },
              {
                label: 'Active Findings',
                value: Number(selectedSummary?.findings?.inspector || 0),
                sublabel: 'Inspector findings',
                tone: Number(selectedSummary?.findings?.inspector || 0) > 0 ? 'danger' : 'success',
              },
              {
                label: 'Critical & High',
                value: singleInspectorHighCritical,
                sublabel: 'Severity filtered from Inspector findings',
                tone: singleInspectorHighCritical > 0 ? 'danger' : 'success',
              },
            ],
        detailSections: isAggregateScope
          ? [
              {
                title: 'Environment Coverage',
                content: (
                  <EnvironmentFeatureCoverageTable
                    rows={environmentRows.filter((row) => row.hasData)}
                    featureLabels={[
                      ['ec2_active', 'EC2 Active'],
                      ['ecr_active', 'ECR Active'],
                      ['lambda_active', 'Lambda Active'],
                    ]}
                    getFindingCount={(row) => row.inspectorFindingsCount}
                    getFeatureEnabled={(row, key) => {
                      const [type] = key.split('_');
                      return Number(row.inspectorCoverage?.[type]?.active || 0) > 0;
                    }}
                  />
                ),
              },
              {
                title: 'Coverage Breakdown',
                content: (
                  <InspectorCoverageBreakdownTable
                    coverageByType={aggregateSummary.inspectorCoverageByType}
                  />
                ),
              },
              {
                title: 'Inspector Findings',
                content: <FindingsTable findings={aggregateSummary.inspectorFindings} showEnvironment />,
              },
            ]
          : [
              {
                title: 'Coverage Breakdown',
                content: <InspectorCoverageBreakdownTable coverageByType={inspectorCoverage} />,
              },
              {
                title: 'Inspector Findings',
                content: <FindingsTable findings={inspectorFindings} />,
              },
            ],
        showEnvironmentCoverage: false,
        environmentRows: [],
      },
      {
        key: 'patch',
        title: 'Patch Compliance',
        subtitle: 'AWS Systems Manager',
        status: isAggregateScope
          ? aggregateSummary.loadedEnvironmentCount === 0
            ? 'unknown'
            : aggregateSummary.nonCompliantManagedInstances > 0 ||
                aggregateSummary.unmanagedEc2Instances > 0
              ? 'problem'
              : 'healthy'
          : selectedPayload
            ? Number(selectedSummary?.patchCompliance?.nonCompliantManagedInstances || 0) > 0 ||
              Number(selectedSummary?.patchCompliance?.unmanagedEc2Instances || 0) > 0
              ? 'problem'
              : 'healthy'
            : 'unknown',
        configCount: isAggregateScope
          ? aggregateSummary.unmanagedEc2Instances
          : Number(selectedSummary?.patchCompliance?.unmanagedEc2Instances || 0),
        metrics: isAggregateScope
          ? [
              {
                label: 'managed',
                value: aggregateSummary.managedEc2Instances,
                tone: 'neutral',
                category: 'config',
              },
              {
                label: 'unmanaged',
                value: aggregateSummary.unmanagedEc2Instances,
                tone: aggregateSummary.unmanagedEc2Instances > 0 ? 'danger' : 'success',
                category: 'config',
              },
              {
                label: 'compliant',
                value: aggregateSummary.compliantManagedInstances,
                tone: aggregateSummary.nonCompliantManagedInstances === 0 ? 'success' : 'warning',
                category: 'findings',
              },
              {
                label: 'non-compliant',
                value: aggregateSummary.nonCompliantManagedInstances,
                tone: aggregateSummary.nonCompliantManagedInstances > 0 ? 'danger' : 'success',
                category: 'findings',
              },
            ]
          : [
              {
                label: 'managed',
                value: Number(selectedSummary?.patchCompliance?.managedEc2Instances || 0),
                tone: 'neutral',
                category: 'config',
              },
              {
                label: 'unmanaged',
                value: Number(selectedSummary?.patchCompliance?.unmanagedEc2Instances || 0),
                tone:
                  Number(selectedSummary?.patchCompliance?.unmanagedEc2Instances || 0) > 0
                    ? 'danger'
                    : 'success',
                category: 'config',
              },
              {
                label: 'compliant',
                value: Number(selectedSummary?.patchCompliance?.compliantManagedInstances || 0),
                tone:
                  Number(selectedSummary?.patchCompliance?.nonCompliantManagedInstances || 0) === 0
                    ? 'success'
                    : 'warning',
                category: 'findings',
              },
              {
                label: 'non-compliant',
                value: Number(selectedSummary?.patchCompliance?.nonCompliantManagedInstances || 0),
                tone:
                  Number(selectedSummary?.patchCompliance?.nonCompliantManagedInstances || 0) > 0
                    ? 'danger'
                    : 'success',
                category: 'findings',
              },
            ],
        detailMetrics: isAggregateScope
          ? [
              {
                label: 'Managed EC2',
                value: aggregateSummary.managedEc2Instances,
                sublabel: 'Systems Manager managed instances',
                tone: 'neutral',
              },
              {
                label: 'Compliant',
                value: aggregateSummary.compliantManagedInstances,
                sublabel: 'Managed instances in compliance',
                tone: aggregateSummary.nonCompliantManagedInstances === 0 ? 'success' : 'warning',
              },
              {
                label: 'Non-Compliant',
                value: aggregateSummary.nonCompliantManagedInstances,
                sublabel: 'Managed instances needing patching',
                tone: aggregateSummary.nonCompliantManagedInstances > 0 ? 'danger' : 'success',
              },
              {
                label: 'Unmanaged EC2',
                value: aggregateSummary.unmanagedEc2Instances,
                sublabel: 'Instances not managed by Systems Manager',
                tone: aggregateSummary.unmanagedEc2Instances > 0 ? 'danger' : 'success',
              },
            ]
          : [
              {
                label: 'Managed EC2',
                value: Number(selectedSummary?.patchCompliance?.managedEc2Instances || 0),
                sublabel: 'Systems Manager managed instances',
                tone: 'neutral',
              },
              {
                label: 'Compliant',
                value: Number(selectedSummary?.patchCompliance?.compliantManagedInstances || 0),
                sublabel: 'Managed instances in compliance',
                tone:
                  Number(selectedSummary?.patchCompliance?.nonCompliantManagedInstances || 0) === 0
                    ? 'success'
                    : 'warning',
              },
              {
                label: 'Non-Compliant',
                value: Number(selectedSummary?.patchCompliance?.nonCompliantManagedInstances || 0),
                sublabel: 'Managed instances needing patching',
                tone:
                  Number(selectedSummary?.patchCompliance?.nonCompliantManagedInstances || 0) > 0
                    ? 'danger'
                    : 'success',
              },
              {
                label: 'Unmanaged EC2',
                value: Number(selectedSummary?.patchCompliance?.unmanagedEc2Instances || 0),
                sublabel: 'Instances not managed by Systems Manager',
                tone:
                  Number(selectedSummary?.patchCompliance?.unmanagedEc2Instances || 0) > 0
                    ? 'danger'
                    : 'success',
              },
            ],
        detailSections: isAggregateScope
          ? [
              {
                title: 'Environment Coverage',
                content: (
                  <EnvironmentFeatureCoverageTable
                    rows={environmentRows.filter((row) => row.hasData)}
                    featureLabels={[
                      ['managed', 'Managed'],
                      ['compliant', 'Compliant'],
                      ['no_unmanaged', 'No Unmanaged'],
                    ]}
                    getFindingCount={(row) => row.nonCompliantManagedInstances}
                    getFeatureEnabled={(row, key) => {
                      if (key === 'managed') return row.managedEc2Instances > 0;
                      if (key === 'compliant') return row.nonCompliantManagedInstances === 0;
                      if (key === 'no_unmanaged') return row.unmanagedEc2Instances === 0;
                      return false;
                    }}
                  />
                ),
              },
              {
                title: 'Non-Compliant Instances',
                content: aggregateSummary.nonCompliantInstances.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">
                    No non-compliant managed instances were returned.
                  </div>
                ) : (
                  <FindingsTable findings={aggregateSummary.nonCompliantInstances} showEnvironment />
                ),
              },
            ]
          : [
              {
                title: 'Non-Compliant Instances',
                content: nonCompliantInstances.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">
                    No non-compliant managed instances were returned.
                  </div>
                ) : (
                  <FindingsTable findings={nonCompliantInstances} />
                ),
              },
            ],
        showEnvironmentCoverage: false,
        environmentRows: environmentRows.filter(
          (row) => row.hasData || row.requestStatus === 'loading'
        ),
      },
      {
        key: 'access-analyzer',
        title: 'Cross-Account/Public Access',
        subtitle: 'AWS Access Analyzer',
        status: isAggregateScope
          ? aggregateSummary.loadedEnvironmentCount === 0
            ? 'unknown'
            : aggregateSummary.accessAnalyzerFindings.length > 0 ||
                aggregateSummary.environmentsWithoutAnalyzer > 0
              ? 'problem'
              : 'healthy'
          : selectedPayload
            ? Number(selectedSummary?.findings?.accessAnalyzer || 0) > 0 ||
              Number(selectedSummary?.accessAnalyzer?.analyzerCount || 0) === 0
              ? 'problem'
              : 'healthy'
            : 'unknown',
        configCount: isAggregateScope
          ? aggregateSummary.environmentsWithoutAnalyzer
          : Number(selectedSummary?.accessAnalyzer?.analyzerCount || 0) === 0
            ? 1
            : 0,
        metrics: isAggregateScope
          ? [
              {
                label: 'enabled',
                value: `${aggregateSummary.loadedEnvironmentCount - aggregateSummary.environmentsWithoutAnalyzer}/${aggregateSummary.loadedEnvironmentCount}`,
                tone:
                  aggregateSummary.environmentsWithoutAnalyzer === 0 &&
                  aggregateSummary.loadedEnvironmentCount > 0
                    ? 'success'
                    : 'danger',
                category: 'config',
              },
              {
                label: 'analyzers',
                value: aggregateSummary.analyzerCount,
                tone: 'neutral',
                category: 'config',
              },
              {
                label: 'findings',
                value: aggregateSummary.accessAnalyzerFindings.length,
                tone: aggregateSummary.accessAnalyzerFindings.length > 0 ? 'danger' : 'success',
                category: 'findings',
              },
              {
                label: 'public',
                value: aggregateSummary.accessAnalyzerFindings.reduce(
                  (count, finding) => count + (finding?.isPublic ? 1 : 0),
                  0
                ),
                tone:
                  aggregateSummary.accessAnalyzerFindings.reduce(
                    (count, finding) => count + (finding?.isPublic ? 1 : 0),
                    0
                  ) > 0
                    ? 'danger'
                    : 'success',
                category: 'findings',
              },
            ]
          : [
              {
                label: 'enabled',
                value: Number(selectedSummary?.accessAnalyzer?.analyzerCount || 0) > 0 ? '1/1' : '0/1',
                tone: Number(selectedSummary?.accessAnalyzer?.analyzerCount || 0) > 0 ? 'success' : 'danger',
                category: 'config',
              },
              {
                label: 'analyzers',
                value: Number(selectedSummary?.accessAnalyzer?.analyzerCount || 0),
                tone: 'neutral',
                category: 'config',
              },
              {
                label: 'findings',
                value: Number(selectedSummary?.findings?.accessAnalyzer || 0),
                tone:
                  Number(selectedSummary?.findings?.accessAnalyzer || 0) > 0 ? 'danger' : 'success',
                category: 'findings',
              },
              {
                label: 'public',
                value: accessAnalyzerFindings.reduce(
                  (count, finding) => count + (finding?.isPublic ? 1 : 0),
                  0
                ),
                tone:
                  accessAnalyzerFindings.reduce(
                    (count, finding) => count + (finding?.isPublic ? 1 : 0),
                    0
                  ) > 0
                    ? 'danger'
                    : 'success',
                category: 'findings',
              },
            ],
        detailMetrics: isAggregateScope
          ? [
              {
                label: 'Analyzer Count',
                value: aggregateSummary.analyzerCount,
                sublabel: 'All analyzers across loaded environments',
                tone: 'neutral',
              },
              {
                label: 'Envs Without Analyzer',
                value: aggregateSummary.environmentsWithoutAnalyzer,
                sublabel: 'Loaded environments missing analyzer coverage',
                tone: aggregateSummary.environmentsWithoutAnalyzer > 0 ? 'danger' : 'success',
              },
              {
                label: 'Findings',
                value: aggregateSummary.accessAnalyzerFindings.length,
                sublabel: 'Access Analyzer findings',
                tone: aggregateSummary.accessAnalyzerFindings.length > 0 ? 'danger' : 'success',
              },
              {
                label: 'Public',
                value: aggregateSummary.accessAnalyzerFindings.reduce(
                  (count, finding) => count + (finding?.isPublic ? 1 : 0),
                  0
                ),
                sublabel: 'Public access findings',
                tone:
                  aggregateSummary.accessAnalyzerFindings.reduce(
                    (count, finding) => count + (finding?.isPublic ? 1 : 0),
                    0
                  ) > 0
                    ? 'danger'
                    : 'success',
              },
            ]
          : [
              {
                label: 'Analyzer Count',
                value: Number(selectedSummary?.accessAnalyzer?.analyzerCount || 0),
                sublabel: 'Analyzers in this environment',
                tone: 'neutral',
              },
              {
                label: 'Findings',
                value: Number(selectedSummary?.findings?.accessAnalyzer || 0),
                sublabel: 'Access Analyzer findings',
                tone:
                  Number(selectedSummary?.findings?.accessAnalyzer || 0) > 0 ? 'danger' : 'success',
              },
              {
                label: 'Public',
                value: accessAnalyzerFindings.reduce(
                  (count, finding) => count + (finding?.isPublic ? 1 : 0),
                  0
                ),
                sublabel: 'Public access findings',
                tone:
                  accessAnalyzerFindings.reduce(
                    (count, finding) => count + (finding?.isPublic ? 1 : 0),
                    0
                  ) > 0
                    ? 'danger'
                    : 'success',
              },
              {
                label: 'Cross Account',
                value: accessAnalyzerFindings.reduce(
                  (count, finding) => count + (!finding?.isPublic ? 1 : 0),
                  0
                ),
                sublabel: 'Cross-account access findings',
                tone:
                  accessAnalyzerFindings.reduce(
                    (count, finding) => count + (!finding?.isPublic ? 1 : 0),
                    0
                  ) > 0
                    ? 'warning'
                    : 'success',
              },
            ],
        detailSections: isAggregateScope
          ? [
              {
                title: 'Environment Coverage',
                content: (
                  <EnvironmentFeatureCoverageTable
                    rows={environmentRows.filter((row) => row.hasData)}
                    featureLabels={[
                      ['has_analyzer', 'Analyzer Enabled'],
                      ['no_public', 'No Public Access'],
                    ]}
                    getFindingCount={(row) => row.accessAnalyzerFindingsCount}
                    getFeatureEnabled={(row, key) => {
                      if (key === 'has_analyzer') return row.analyzerCount > 0;
                      if (key === 'no_public') return row.publicAccessAnalyzerFindings === 0;
                      return false;
                    }}
                  />
                ),
              },
              {
                title: 'Access Analyzer Findings',
                content: (
                  <FindingsTable
                    findings={aggregateSummary.accessAnalyzerFindings}
                    showEnvironment
                  />
                ),
              },
            ]
          : [
              {
                title: 'Access Analyzer Findings',
                content: <FindingsTable findings={accessAnalyzerFindings} />,
              },
            ],
        showEnvironmentCoverage: false,
        environmentRows: [],
      },
    ];

    return serviceRows;
  }, [
    aggregateSummary,
    environmentRows,
    isAggregateScope,
    selectedChecks,
    selectedMergedFindings,
    selectedPayload,
    selectedSummary,
  ]);

  const selectedService = useMemo(
    () => currentServiceRows.find((row) => row.key === selectedServiceKey) || currentServiceRows[0] || null,
    [currentServiceRows, selectedServiceKey]
  );

  const isAnyEnvironmentRefreshing = environmentRows.some((row) => row.requestStatus === 'loading');
  const failedEnvironmentRows = environmentRows.filter((row) => row.requestStatus === 'failed');
  const aggregateFailureCount = failedEnvironmentRows.length;

  if (!awsAccountProfiles.length) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-600">
            No AWS account permission profiles are available in the current workspace.
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = isAggregateScope ? isAnyEnvironmentRefreshing : selectedRequest?.status === 'loading';

  return (
    <div className="space-y-6 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline">
            <h1 className="shrink-0 text-2xl font-semibold text-gray-900">
              Threat Dashboard
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Monitor threat detection, vulnerability findings, and security services across cloud environments.
          </p>
          {isLoading && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Scanning...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Popover open={scopeComboOpen} onOpenChange={setScopeComboOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={scopeComboOpen}
                className="h-8 w-full justify-between rounded-lg border-slate-200 bg-white px-3 text-sm font-normal shadow-sm hover:bg-slate-50 sm:w-[360px] xl:w-[440px]"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  {isAggregateScope ? (
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  ) : (
                    getEnvironmentProviderIcon()
                  )}
                  <span className="truncate">{selectedScopeLabel}</span>
                </span>
                <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-slate-500" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0 bg-white"
              align="end"
            >
              <Command>
                <CommandInput placeholder="Search environments..." />
                <CommandList>
                  <CommandEmpty>No matching environment.</CommandEmpty>
                  <CommandGroup>
                    {awsAccountProfiles.length > 1 && (
                      <CommandItem
                        value="all environments"
                        onSelect={() => {
                          setSelectedScope(ALL_ENVIRONMENTS_SCOPE);
                          setScopeComboOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4 shrink-0',
                            !isAggregateScope && 'opacity-0'
                          )}
                        />
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                        <span className="truncate">All Environments</span>
                      </CommandItem>
                    )}
                    {awsAccountProfiles.map((profile) => {
                      const permissionProfileId = getPermissionProfileId(profile);
                      const environmentLabel = getEnvironmentLabel(profile);
                      const accountId = getAccountId(profile);
                      const selected = selectedScope === permissionProfileId;
                      const value = `environment ${permissionProfileId} ${environmentLabel} ${accountId}`.toLowerCase();

                      return (
                        <CommandItem
                          key={permissionProfileId}
                          value={value}
                          onSelect={() => {
                            setSelectedScope(permissionProfileId);
                            setScopeComboOpen(false);
                          }}
                        >
                          <Check
                            className={cn('mr-2 h-4 w-4 shrink-0', !selected && 'opacity-0')}
                          />
                          {getEnvironmentProviderIcon()}
                          <span className="min-w-0 flex-1 truncate" title={environmentLabel}>
                            {environmentLabel}
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-lg border-slate-200 px-3 shadow-sm hover:bg-slate-50"
            onClick={() => handleRefresh(true)}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {aggregateFailureCount > 0 && isAggregateScope && (
        <div className="rounded-lg border border-rose-200/80 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="space-y-1">
              <div>
                {aggregateFailureCount} environment{aggregateFailureCount === 1 ? '' : 's'} failed to load.
              </div>
              <div className="flex flex-wrap gap-1.5">
                {failedEnvironmentRows.slice(0, 6).map((row) => (
                  <button
                    key={row.permissionProfileId}
                    type="button"
                    className="rounded-md border border-rose-200 bg-white px-2 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
                    onClick={() => setSelectedScope(row.permissionProfileId)}
                    title={row.requestError || row.name}
                  >
                    {row.name}
                  </button>
                ))}
                {failedEnvironmentRows.length > 6 ? (
                  <span className="self-center text-[11px] text-rose-600">
                    +{failedEnvironmentRows.length - 6} more
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedRequest?.status === 'failed' && !isAggregateScope && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200/80 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          {selectedRequest?.error || 'Threat detection request failed.'}
        </div>
      )}

      <ThreatServiceTable
        rows={currentServiceRows}
        onSelectService={openServiceDetails}
      />

      {(isAggregateScope ? aggregateSummary.mergedFindings : selectedMergedFindings).length > 0 && (
        <TopFindingsPreview
          findings={isAggregateScope ? aggregateSummary.mergedFindings : selectedMergedFindings}
          title="Top Findings"
          maxPerSource={3}
        />
      )}

      <ServiceDetailsDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        service={selectedService}
        isAggregateScope={isAggregateScope}
        onSelectEnvironment={(permissionProfileId) => {
          setSelectedScope(permissionProfileId);
          setIsDetailOpen(false);
        }}
      />
    </div>
  );
}
