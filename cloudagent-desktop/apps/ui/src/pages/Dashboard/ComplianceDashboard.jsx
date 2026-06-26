import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Icons } from '@/components/icons';
import { SettingsSummary } from '@/pages/Agent/Agent';
import { refreshAccountScans } from '@/features/auth/authSlice';
import { buildReportRoute } from '@/helpers/accountScans';
import { fetchAgentList } from '@/helpers/agentList';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';
import {
  getEnvironmentAccountId,
  getEnvironmentDomain,
  getEnvironmentProfileId,
  getNormalizedEnvironmentType,
  matchesReportScan,
  selectActiveWorkspaceScope,
  selectWorkspaceScopedEnvironmentProfiles,
} from '@/features/workspace/workspaceScope';
import { IS_PUBLIC_SITE } from '@/config/appConfig';

const PLANS_BASE_URL =
  'https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/plans';

const STATUS_PRIORITY = {
  complete: 4,
  running: 3,
  failed: 2,
  unknown: 1,
  missing: 0,
};

const SUCCESS_STATUS_SET = new Set([
  'successful',
  'partial_success',
  'complete',
  'completed',
  'done',
]);
const RUNNING_STATUS_SET = new Set([
  'running',
  'in_progress',
  'started',
  'processing',
  'pending',
]);
const FAILED_STATUS_SET = new Set(['failed', 'error']);

function safeParseJson(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeMetricNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function normalizeProvider(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (!normalized) return 'aws';
  if (normalized.includes('google')) return 'google_workspace';
  if (normalized.includes('aws')) return 'aws';
  return normalized;
}

function getProviderLabel(value) {
  const provider = normalizeProvider(value);
  if (provider === 'google_workspace') return 'Google Workspace';
  if (provider === 'aws') return 'AWS';
  return provider.replace(/_/g, ' ');
}

function normalizeScanStatus(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function getCoverageStatus(scan) {
  if (!scan) return 'missing';
  const normalized = normalizeScanStatus(scan.status);
  if (SUCCESS_STATUS_SET.has(normalized)) return 'complete';
  if (RUNNING_STATUS_SET.has(normalized)) return 'running';
  if (FAILED_STATUS_SET.has(normalized)) return 'failed';
  return 'unknown';
}

function getCoverageLabel(status) {
  if (status === 'complete') return 'Ready';
  if (status === 'running') return 'Running';
  if (status === 'failed') return 'Failed';
  if (status === 'unknown') return 'Started';
  return 'Missing';
}

function formatTimestamp(value) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toLocaleString();
}

function getScanTimestamp(scan) {
  const parsed = Date.parse(
    scan?.lastUpdateTime || scan?.latestAssessmentDate || scan?.updatedAt || scan?.createdAt || ''
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function isComplianceLibraryReport(report) {
  return (
    report?.type === 'report' &&
    report?.active === true &&
    String(report?.id || '').startsWith('report_compliance_')
  );
}

function buildEnvironmentDisplay(profile) {
  const type = getNormalizedEnvironmentType(profile);
  const provider = normalizeProvider(type || profile?.cloudProvider);
  const accountId = getEnvironmentAccountId(profile);
  const domain = getEnvironmentDomain(profile);
  const profileId = getEnvironmentProfileId(profile);
  const name =
    profile?.name ||
    profile?.permissionProfileName ||
    domain ||
    accountId ||
    profileId ||
    'Cloud environment';

  const subtitle = domain || accountId || (type === 'aws org' ? 'AWS Organization' : null);

  return {
    id: profileId,
    name,
    subtitle,
    provider,
    providerLabel: getProviderLabel(provider),
    profile,
  };
}

function summarizeMissing(items, limit = 3) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'None missing';
  }
  if (items.length <= limit) {
    return items.join(', ');
  }
  return `${items.slice(0, limit).join(', ')} +${items.length - limit} more`;
}

function extractAssessmentStatsForReport(scan, reportId) {
  const assessmentScore = safeParseJson(scan?.assessmentScore, null);
  if (!assessmentScore || typeof assessmentScore !== 'object' || !reportId) {
    return null;
  }

  const candidateKeys = [
    String(reportId || '').trim(),
    String(reportId || '').trim().replace(/^report_/, ''),
  ].filter(Boolean);

  const matchingEntry = candidateKeys
    .map((key) => assessmentScore?.[key])
    .find((entry) => entry && typeof entry === 'object');

  if (!matchingEntry) {
    return null;
  }

  return {
    controlsPassed: normalizeMetricNumber(matchingEntry.controlsPassed),
    controlsFailed: normalizeMetricNumber(matchingEntry.controlsFailed),
    rulesPassed: normalizeMetricNumber(matchingEntry.rulesPassed),
    rulesFailed: normalizeMetricNumber(matchingEntry.rulesFailed),
    overallScore: normalizeMetricNumber(matchingEntry.overallScore),
  };
}

function getRecommendationReportIds(recommendation) {
  const metadata = safeParseJson(recommendation?.metadata, null);
  if (!metadata || typeof metadata !== 'object') {
    return [];
  }

  return Array.from(
    new Set(
      [
        ...(Array.isArray(metadata.reportIds) ? metadata.reportIds : []),
        metadata.reportId,
      ]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );
}

function sumAssessmentStats(items = []) {
  return (Array.isArray(items) ? items : []).reduce(
    (accumulator, item) => {
      const stats = item?.assessmentStats;
      if (!stats) return accumulator;

      accumulator.controlsPassed += normalizeMetricNumber(stats.controlsPassed);
      accumulator.controlsFailed += normalizeMetricNumber(stats.controlsFailed);
      accumulator.rulesPassed += normalizeMetricNumber(stats.rulesPassed);
      accumulator.rulesFailed += normalizeMetricNumber(stats.rulesFailed);
      if (Number.isFinite(Number(stats.overallScore))) {
        accumulator.overallScoreTotal += Number(stats.overallScore);
        accumulator.overallScoreCount += 1;
      }
      return accumulator;
    },
    {
      controlsPassed: 0,
      controlsFailed: 0,
      rulesPassed: 0,
      rulesFailed: 0,
      overallScoreTotal: 0,
      overallScoreCount: 0,
    }
  );
}

function getAverageScore(assessmentSummary) {
  if (!assessmentSummary) return null;
  const count = normalizeMetricNumber(assessmentSummary.overallScoreCount);
  if (count <= 0) return null;
  return Math.round((assessmentSummary.overallScoreTotal / count) * 10) / 10;
}

function calculateControlsScore(assessmentStats) {
  if (!assessmentStats) return null;
  const passed = normalizeMetricNumber(assessmentStats.controlsPassed);
  const failed = normalizeMetricNumber(assessmentStats.controlsFailed);
  const total = passed + failed;
  if (total === 0) return null;
  return Math.round((passed / total) * 100);
}

function calculateAggregateControlsScore(assessmentSummary) {
  if (!assessmentSummary) return null;
  const passed = normalizeMetricNumber(assessmentSummary.controlsPassed);
  const failed = normalizeMetricNumber(assessmentSummary.controlsFailed);
  const total = passed + failed;
  if (total === 0) return null;
  return Math.round((passed / total) * 100);
}

function getScoreColor(score) {
  if (score == null) return { bg: 'bg-gray-100', bar: 'bg-gray-300', text: 'text-gray-500', border: 'border-gray-200' };
  if (score >= 70) return { bg: 'bg-emerald-50', bar: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-200' };
  if (score >= 40) return { bg: 'bg-amber-50', bar: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-200' };
  return { bg: 'bg-red-50', bar: 'bg-red-500', text: 'text-red-700', border: 'border-red-200' };
}

function ScoreProgressBar({ score, showLabel = true }) {
  const colors = getScoreColor(score);
  const displayScore = score != null ? `${score}%` : '--';
  const barWidth = score != null ? Math.max(score, 3) : 0;

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Score</span>
          <span className={`text-lg font-bold ${colors.text}`}>{displayScore}</span>
        </div>
      )}
      <div className={`h-2 w-full overflow-hidden rounded-full ${colors.bg}`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${colors.bar}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}

function CloudProviderIcon({ provider, className = 'h-4 w-4' }) {
  const normalizedProvider = normalizeProvider(provider);
  if (normalizedProvider === 'google_workspace') {
    return <Icons.googleWorkspace className={className} />;
  }
  return <Icons.aws className={className} />;
}

function OverviewSummaryCard({
  title,
  provider,
  covered,
  total,
  assessmentSummary,
  onClick,
  onRun,
  isLoading = false,
  isSelected = false,
}) {
  const controlsScore = calculateAggregateControlsScore(assessmentSummary);

  return (
    <div
      className={`w-full rounded-xl border p-4 text-left transition ${
        isSelected
          ? 'border-primary-300 bg-primary-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-primary-200 hover:shadow-sm'
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <CloudProviderIcon provider={provider} className="h-5 w-5 flex-shrink-0" />
            <div className="truncate text-sm font-semibold text-gray-900">{title}</div>
          </div>
          <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
        </div>

        <div className="mt-3">
          <ScoreProgressBar score={controlsScore} />
        </div>
      </button>

      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500">
            Controls:{' '}
            <span className="font-medium text-emerald-600">
              {assessmentSummary?.controlsPassed || 0}
            </span>
            {' / '}
            <span className="font-medium text-red-600">
              {assessmentSummary?.controlsFailed || 0}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onRun && (
            <button
              type="button"
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation();
                onRun();
              }}
              className="flex items-center gap-1 rounded-md bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              Run
            </button>
          )}
          <span className="text-xs font-medium text-emerald-600">{covered}</span>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-xs text-gray-500">{total}</span>
        </div>
      </div>
    </div>
  );
}

function CoverageStatusBadge({ status }) {
  if (status === 'complete') {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Ready
      </Badge>
    );
  }
  if (status === 'running') {
    return (
      <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-blue-700">
        <Clock3 className="h-3 w-3" />
        Running
      </Badge>
    );
  }
  if (status === 'failed') {
    return (
      <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-red-700">
        <XCircle className="h-3 w-3" />
        Failed
      </Badge>
    );
  }
  if (status === 'unknown') {
    return (
      <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-700">
        <Clock3 className="h-3 w-3" />
        Started
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-gray-200 bg-gray-50 text-gray-600">
      <XCircle className="h-3 w-3" />
      Missing
    </Badge>
  );
}

export default function ComplianceDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const activeWorkspaceScope = useSelector(selectActiveWorkspaceScope);
  const scopedEnvironmentProfiles = useSelector(selectWorkspaceScopedEnvironmentProfiles);
  const accountScans = useSelector((state) => state.auth?.userProfile?.reportHistory || []);

  const [groupBy, setGroupBy] = useState('report');
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [selectedDrilldown, setSelectedDrilldown] = useState(null);
  const [libraryReports, setLibraryReports] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hideEmptyReports, setHideEmptyReports] = useState(true);
  const [hideNoScoreCards, setHideNoScoreCards] = useState(false);
  const [runSettingsLoading, setRunSettingsLoading] = useState(null);
  const [selectedReportPlan, setSelectedReportPlan] = useState(null);
  const [isRunSettingsOpen, setIsRunSettingsOpen] = useState(false);

  const userProfile = useSelector((state) => state.auth?.userProfile);
  const availableCredits =
    (userProfile?.agentCredits?.adhocCredits || 0) +
    (userProfile?.agentCredits?.monthlyBaseCredits || 0);
  const allRecommendations = userProfile?.recommendations?.recommendations || [];

  useEffect(() => {
    let isMounted = true;

    const loadLibraryReports = async () => {
      setLibraryLoading(true);
      try {
        const response = await fetchAgentList();
        if (!response.ok) {
          throw new Error(`Failed to load compliance reports (${response.status})`);
        }
        const data = await response.json();
        if (!isMounted) return;

        const filteredReports = (Array.isArray(data) ? data : [])
          .filter(isComplianceLibraryReport)
          .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));

        setLibraryReports(filteredReports);
      } catch (error) {
        console.error('[ComplianceDashboard] Failed to load library reports:', error);
        if (!isMounted) return;

        const fallbackReports = (accountScans || [])
          .filter((scan) => String(scan?.reportId || '').startsWith('report_compliance_'))
          .map((scan) => ({
            id: scan.reportId,
            title: scan.title || scan.reportId,
            description: '',
            type: 'report',
            active: true,
            cloudProvider: normalizeProvider(scan.cloudProvider),
          }))
          .filter(
            (report, index, allReports) =>
              index === allReports.findIndex((candidate) => candidate.id === report.id)
          )
          .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));

        setLibraryReports(fallbackReports);
      } finally {
        if (isMounted) {
          setLibraryLoading(false);
        }
      }
    };

    loadLibraryReports();

    return () => {
      isMounted = false;
    };
  }, [accountScans]);

  const environments = useMemo(() => {
    return (Array.isArray(scopedEnvironmentProfiles) ? scopedEnvironmentProfiles : [])
      .map(buildEnvironmentDisplay)
      .filter((environment) => environment.id && ['aws', 'google_workspace'].includes(environment.provider))
      .sort((a, b) => {
        if (a.provider !== b.provider) {
          return a.provider.localeCompare(b.provider);
        }
        return a.name.localeCompare(b.name);
      });
  }, [scopedEnvironmentProfiles]);

  const environmentResolver = useMemo(() => {
    const byProfileId = new Map();
    const byAccountId = new Map();
    const byDomain = new Map();

    environments.forEach((environment) => {
      byProfileId.set(environment.id, environment);
      const accountId = String(environment.subtitle || '').trim();
      if (environment.provider === 'aws' && accountId && /^\d{12}$/.test(accountId)) {
        byAccountId.set(accountId, environment);
      }
      const domain = getEnvironmentDomain(environment.profile);
      if (environment.provider === 'google_workspace' && domain) {
        byDomain.set(domain, environment);
      }
      const directAccountId = getEnvironmentAccountId(environment.profile);
      if (environment.provider === 'aws' && directAccountId) {
        byAccountId.set(directAccountId, environment);
      }
    });

    return { byProfileId, byAccountId, byDomain };
  }, [environments]);

  const resolveEnvironmentForScan = useCallback(
    (scan) => {
      const byProfileIdMatch =
        environmentResolver.byProfileId.get(String(scan?.permissionProfileId || '').trim()) ||
        environmentResolver.byProfileId.get(String(scan?.parentId || '').trim());
      if (byProfileIdMatch) return byProfileIdMatch;

      const provider = normalizeProvider(scan?.cloudProvider);
      if (provider === 'google_workspace') {
        const domain = String(scan?.accountId || '').trim().toLowerCase();
        return environmentResolver.byDomain.get(domain) || null;
      }

      const accountId = String(scan?.accountId || '').trim();
      return environmentResolver.byAccountId.get(accountId) || null;
    },
    [environmentResolver]
  );

  const complianceScans = useMemo(() => {
    return (Array.isArray(accountScans) ? accountScans : []).filter((scan) => {
      const reportId = String(scan?.reportId || '').trim();
      return reportId.startsWith('report_compliance_') && matchesReportScan(scan, activeWorkspaceScope);
    });
  }, [accountScans, activeWorkspaceScope]);

  const latestScanByCoverageKey = useMemo(() => {
    const map = new Map();

    complianceScans.forEach((scan) => {
      const environment = resolveEnvironmentForScan(scan);
      if (!environment?.id || !scan?.reportId) return;

      const key = `${environment.id}::${scan.reportId}`;
      const existing = map.get(key);
      if (!existing || getScanTimestamp(scan) > getScanTimestamp(existing)) {
        map.set(key, scan);
      }
    });

    return map;
  }, [complianceScans, resolveEnvironmentForScan]);

  const complianceReports = useMemo(() => {
    return libraryReports.filter((report) => {
      if (providerFilter === 'all') return true;
      return normalizeProvider(report.cloudProvider) === providerFilter;
    });
  }, [libraryReports, providerFilter]);

  const totals = useMemo(() => {
    let applicablePairs = 0;
    let coveredPairs = 0;
    let missingPairs = 0;
    let completePairs = 0;

    complianceReports.forEach((report) => {
      const reportProvider = normalizeProvider(report.cloudProvider);
      environments.forEach((environment) => {
        if (environment.provider !== reportProvider) return;
        applicablePairs += 1;
        const scan = latestScanByCoverageKey.get(`${environment.id}::${report.id}`);
        const status = getCoverageStatus(scan);
        if (status === 'missing') {
          missingPairs += 1;
        } else {
          coveredPairs += 1;
        }
        if (status === 'complete') {
          completePairs += 1;
        }
      });
    });

    return {
      reports: complianceReports.length,
      environments: environments.length,
      applicablePairs,
      coveredPairs,
      missingPairs,
      completePairs,
    };
  }, [complianceReports, environments, latestScanByCoverageKey]);

  const reportRows = useMemo(() => {
    return complianceReports
      .map((report) => {
        const provider = normalizeProvider(report.cloudProvider);
        const cells = environments
          .filter((environment) => environment.provider === provider)
          .map((environment) => {
            const latestScan = latestScanByCoverageKey.get(`${environment.id}::${report.id}`) || null;
            const status = getCoverageStatus(latestScan);
            return {
              id: `${report.id}::${environment.id}`,
              report,
              environment,
              latestScan,
              assessmentStats: extractAssessmentStatsForReport(latestScan, report.id),
              status,
              timestamp: getScanTimestamp(latestScan),
              timestampLabel: formatTimestamp(
                latestScan?.lastUpdateTime ||
                  latestScan?.latestAssessmentDate ||
                  latestScan?.updatedAt ||
                  latestScan?.createdAt
              ),
            };
          })
          .sort((a, b) => {
            const statusDelta = STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status];
            if (statusDelta !== 0) return statusDelta;
            return a.environment.name.localeCompare(b.environment.name);
          });

        const missingNames = cells
          .filter((cell) => cell.status === 'missing')
          .map((cell) => cell.environment.name);
        const latestTimestamp = Math.max(0, ...cells.map((cell) => cell.timestamp || 0));
        const assessmentSummary = sumAssessmentStats(cells);

        return {
          report,
          cells,
          total: cells.length,
          covered: cells.filter((cell) => cell.status !== 'missing').length,
          complete: cells.filter((cell) => cell.status === 'complete').length,
          missing: missingNames.length,
          missingSummary: summarizeMissing(missingNames),
          latestTimestamp,
          latestTimestampLabel: formatTimestamp(latestTimestamp || null),
          assessmentSummary,
          controlsScore: calculateAggregateControlsScore(assessmentSummary),
        };
      })
      .filter((row) => {
        if (hideEmptyReports && row.total === 0) return false;
        if (hideNoScoreCards && row.controlsScore === null) return false;

        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;

        return [
          row.report.title,
          row.report.description,
          row.report.id,
          ...row.cells.map((cell) => cell.environment.name),
          ...row.cells.map((cell) => cell.environment.subtitle),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => {
        if (b.covered !== a.covered) return b.covered - a.covered;
        if (a.missing !== b.missing) return a.missing - b.missing;
        return a.report.title.localeCompare(b.report.title);
      });
  }, [complianceReports, environments, hideEmptyReports, hideNoScoreCards, latestScanByCoverageKey, searchQuery]);

  const environmentRows = useMemo(() => {
    return environments
      .filter((environment) => providerFilter === 'all' || environment.provider === providerFilter)
      .map((environment) => {
        const applicableReports = complianceReports.filter(
          (report) => normalizeProvider(report.cloudProvider) === environment.provider
        );

        const cells = applicableReports
          .map((report) => {
            const latestScan = latestScanByCoverageKey.get(`${environment.id}::${report.id}`) || null;
            const status = getCoverageStatus(latestScan);
            return {
              id: `${environment.id}::${report.id}`,
              report,
              environment,
              latestScan,
              assessmentStats: extractAssessmentStatsForReport(latestScan, report.id),
              status,
              timestamp: getScanTimestamp(latestScan),
              timestampLabel: formatTimestamp(
                latestScan?.lastUpdateTime ||
                  latestScan?.latestAssessmentDate ||
                  latestScan?.updatedAt ||
                  latestScan?.createdAt
              ),
            };
          })
          .sort((a, b) => {
            const statusDelta = STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status];
            if (statusDelta !== 0) return statusDelta;
            return a.report.title.localeCompare(b.report.title);
          });

        const missingNames = cells
          .filter((cell) => cell.status === 'missing')
          .map((cell) => cell.report.title);
        const latestTimestamp = Math.max(0, ...cells.map((cell) => cell.timestamp || 0));
        const assessmentSummary = sumAssessmentStats(cells);

        return {
          environment,
          cells,
          total: cells.length,
          covered: cells.filter((cell) => cell.status !== 'missing').length,
          complete: cells.filter((cell) => cell.status === 'complete').length,
          missing: missingNames.length,
          missingSummary: summarizeMissing(missingNames),
          latestTimestamp,
          latestTimestampLabel: formatTimestamp(latestTimestamp || null),
          assessmentSummary,
          controlsScore: calculateAggregateControlsScore(assessmentSummary),
        };
      })
      .filter((row) => {
        if (hideNoScoreCards && row.controlsScore === null) return false;

        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;

        return [
          row.environment.name,
          row.environment.subtitle,
          row.environment.providerLabel,
          ...row.cells.map((cell) => cell.report.title),
          ...row.cells.map((cell) => cell.report.id),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => {
        if (b.covered !== a.covered) return b.covered - a.covered;
        if (a.missing !== b.missing) return a.missing - b.missing;
        return a.environment.name.localeCompare(b.environment.name);
      });
  }, [complianceReports, environments, hideNoScoreCards, latestScanByCoverageKey, providerFilter, searchQuery]);

  const selectedReportRow = useMemo(() => {
    if (selectedDrilldown?.type !== 'report') return null;
    return reportRows.find((row) => row.report.id === selectedDrilldown.id) || null;
  }, [reportRows, selectedDrilldown]);

  const selectedEnvironmentRow = useMemo(() => {
    if (selectedDrilldown?.type !== 'environment') return null;
    return environmentRows.find((row) => row.environment.id === selectedDrilldown.id) || null;
  }, [environmentRows, selectedDrilldown]);

  const getRecommendationCountForReportAndEnv = useCallback((reportId, environmentSubtitle) => {
    if (!reportId || !allRecommendations.length) return 0;

    const reportIdVariants = [
      reportId,
      reportId.replace(/^report_/, ''),
      `report_${reportId.replace(/^report_/, '')}`,
    ].filter(Boolean);

    const accountId = String(environmentSubtitle || '').trim();

    return allRecommendations.filter((rec) => {
      if (rec.status === 'resolved' || rec.status === 'dismissed') return false;
      
      const recReportIds = getRecommendationReportIds(rec);
      const matchesReport = recReportIds.some((id) => reportIdVariants.includes(id));
      if (!matchesReport) return false;

      if (!accountId) return true;

      const targetResources = Array.isArray(rec.targetResources) ? rec.targetResources : [];
      if (targetResources.length === 0) return true;

      return targetResources.some((resource) => {
        if (typeof resource === 'object' && resource !== null) {
          return String(resource.accountId || '').trim() === accountId;
        }
        return false;
      });
    }).length;
  }, [allRecommendations]);

  const detailTableRows = useMemo(() => {
    if (groupBy === 'report') {
      if (!selectedReportRow) return [];
      return selectedReportRow.cells.map((cell) => ({
        id: cell.id,
        primary: cell.environment.name,
        secondary: cell.environment.subtitle || 'Cloud environment',
        providerLabel: cell.environment.providerLabel,
        assessmentStats: cell.assessmentStats,
        score: calculateControlsScore(cell.assessmentStats),
        status: cell.status,
        timestampLabel: cell.timestampLabel,
        scan: cell.latestScan,
        reportId: selectedReportRow.report.id,
        reportTitle: selectedReportRow.report.title,
        reportProvider: selectedReportRow.report.cloudProvider,
        environmentId: cell.environment.id,
        environmentName: cell.environment.name,
        environmentSubtitle: cell.environment.subtitle,
        recommendationCount: getRecommendationCountForReportAndEnv(
          selectedReportRow.report.id,
          cell.environment.subtitle
        ),
      }));
    }
    if (!selectedEnvironmentRow) return [];
    return selectedEnvironmentRow.cells.map((cell) => ({
      id: cell.id,
      primary: cell.report.title,
      secondary: cell.report.id,
      providerLabel: cell.report.cloudProvider
        ? getProviderLabel(cell.report.cloudProvider)
        : cell.environment.providerLabel,
      assessmentStats: cell.assessmentStats,
      score: calculateControlsScore(cell.assessmentStats),
      status: cell.status,
      timestampLabel: cell.timestampLabel,
      scan: cell.latestScan,
      reportId: cell.report.id,
      reportTitle: cell.report.title,
      reportProvider: cell.report.cloudProvider,
      environmentId: selectedEnvironmentRow.environment.id,
      environmentName: selectedEnvironmentRow.environment.name,
      environmentSubtitle: selectedEnvironmentRow.environment.subtitle,
      recommendationCount: getRecommendationCountForReportAndEnv(
        cell.report.id,
        selectedEnvironmentRow.environment.subtitle
      ),
    }));
  }, [getRecommendationCountForReportAndEnv, groupBy, selectedEnvironmentRow, selectedReportRow]);

  const isDetailView = Boolean(selectedDrilldown);

  const detailTitle = useMemo(() => {
    if (groupBy === 'report') {
      return selectedReportRow?.report.title || 'Compliance report details';
    }
    return selectedEnvironmentRow?.environment.name || 'Cloud environment details';
  }, [groupBy, selectedEnvironmentRow, selectedReportRow]);

  const detailDescription = useMemo(() => {
    if (groupBy === 'report') {
      return selectedReportRow
        ? `Coverage by cloud environment for ${selectedReportRow.report.title}.`
        : 'Coverage by cloud environment.';
    }
    return selectedEnvironmentRow
      ? `Coverage by compliance report for ${selectedEnvironmentRow.environment.name}.`
      : 'Coverage by compliance report.';
  }, [groupBy, selectedEnvironmentRow, selectedReportRow]);

  const selectedAssessmentSummary = useMemo(() => {
    if (groupBy === 'report') {
      return selectedReportRow?.assessmentSummary || null;
    }
    return selectedEnvironmentRow?.assessmentSummary || null;
  }, [groupBy, selectedEnvironmentRow, selectedReportRow]);

  useEffect(() => {
    if (selectedDrilldown?.type === 'report' && !selectedReportRow) {
      setSelectedDrilldown(null);
    }
    if (selectedDrilldown?.type === 'environment' && !selectedEnvironmentRow) {
      setSelectedDrilldown(null);
    }
  }, [selectedDrilldown, selectedReportRow, selectedEnvironmentRow]);

  const handleOpenScan = useCallback(
    (scan) => {
      const reportRoute = buildReportRoute(scan);
      if (!reportRoute) return;
      navigate(reportRoute, {
        state: {
          isReconnecting: true,
          parentId: scan?.parentId || scan?.permissionProfileId || null,
          reportId: scan?.reportId || null,
        },
      });
    },
    [navigate]
  );

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      toast.loading('Refreshing compliance report coverage...', { id: 'refresh-compliance-dashboard' });
      const result = await dispatch(refreshAccountScans()).unwrap();
      toast.success(
        `Refreshed ${result.length} report scan${result.length === 1 ? '' : 's'}`,
        { id: 'refresh-compliance-dashboard' }
      );
    } catch (error) {
      console.error('[ComplianceDashboard] Failed to refresh account scans:', error);
      toast.error(error?.message || 'Failed to refresh report coverage', {
        id: 'refresh-compliance-dashboard',
      });
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, refreshing]);

  const handleOpenRunModal = useCallback(
    async (reportId, reportTitle, reportProvider, prefillEnvironmentId = null, prefillEnvironmentName = null) => {
      const report = libraryReports.find((r) => r.id === reportId);
      if (!report) {
        toast.error('Report not found');
        return;
      }

      setRunSettingsLoading(reportId);
      try {
        const planUrl = `${PLANS_BASE_URL}/${reportId}.json`;
        const response = await fetch(planUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch report plan: ${response.status}`);
        }

        const planData = await response.json();
        const resolvedCloudProvider =
          planData.cloudProvider ||
          planData.plan?.[0]?.tasks?.[0]?.cloudProvider ||
          reportProvider ||
          report.cloudProvider ||
          'aws';

        setSelectedReportPlan({
          id: reportId,
          title: planData.title || reportTitle || report.title,
          credits: planData.credits || report.credits || 0,
          cloudProvider: resolvedCloudProvider,
          inputSummary: planData.planSettings?.defaultValues || '',
          requiredPermissions: planData.requiredPermissions || {},
          prefillPermissionProfileId: prefillEnvironmentId,
          prefillPermissionProfileName: prefillEnvironmentName,
        });
        setIsRunSettingsOpen(true);
      } catch (fetchError) {
        console.error('Failed to prepare compliance report:', fetchError);
        toast.error(fetchError?.message || 'Failed to load report settings.');
      } finally {
        setRunSettingsLoading(null);
      }
    },
    [libraryReports]
  );

  const handleCloseRunSettings = useCallback(() => {
    setIsRunSettingsOpen(false);
    setSelectedReportPlan(null);
  }, []);

  const handleRunReportFromModal = useCallback(
    async (settings, { authProfile, accountId, selectedPermissionProfileId }) => {
      if (!selectedReportPlan?.id) return;

      try {
        const isGoogleWorkspace = authProfile?.provider === 'google_workspace';
        const effectiveAccountId = isGoogleWorkspace
          ? accountId || authProfile?.domain || ''
          : accountId || authProfile?.awsAccountId || authProfile?.accountId || '';
        const generatedScanId = `${effectiveAccountId}-${Date.now()}-${selectedReportPlan.id}`;
        const targetRoute =
          buildReportRoute({
            scanId: generatedScanId,
            reportId: selectedReportPlan.id,
          }) || `/dashboard/reports/${generatedScanId}`;

        handleCloseRunSettings();

        navigate(targetRoute, {
          state: {
            planId: selectedReportPlan.id,
            shouldAutocontinue: true,
            readyToRun: true,
            cloudProvider: selectedReportPlan.cloudProvider,
            authProfile,
            accountId: effectiveAccountId,
            globalSettings: settings,
            parentId: selectedPermissionProfileId,
            returnTo: '/dashboard/compliance',
          },
        });
      } catch (runError) {
        console.error('Error starting compliance report:', runError);
        toast.error(runError?.message || 'Failed to start report');
      }
    },
    [dispatch, handleCloseRunSettings, navigate, selectedReportPlan]
  );

  const emptyMessage = libraryLoading
    ? 'Loading compliance reports...'
    : 'No compliance reports are available for this workspace.';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary-600" />
            <h1 className="text-2xl font-semibold text-gray-900">Compliance Dashboard</h1>
          </div>
          
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh coverage
          </Button>
        </div>
      </div>

      
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              {isDetailView ? (
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDrilldown(null)}
                    className="gap-1.5 px-2 text-gray-600 hover:text-gray-900"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <div className="h-5 w-px bg-gray-200" />
                  <CardTitle className="flex items-center gap-2">
                    <CloudProviderIcon 
                      provider={groupBy === 'report' ? selectedReportRow?.report?.cloudProvider : selectedEnvironmentRow?.environment?.provider} 
                      className="h-5 w-5" 
                    />
                    {detailTitle}
                  </CardTitle>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary-600" />
                    <CardTitle>
                      {groupBy === 'report' ? 'Reports Overview' : 'Environments Overview'}
                    </CardTitle>
                  </div>
                  <CardDescription>
                    {groupBy === 'report'
                      ? 'Coverage by compliance report across matching environments.'
                      : 'Coverage by cloud environment across applicable compliance reports.'}
                  </CardDescription>
                </>
              )}
            </div>
            {!isDetailView ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="text-sm font-medium text-gray-600">Group by:</span>
                <Tabs
                  value={groupBy}
                  onValueChange={(value) => {
                    setGroupBy(value);
                    if (
                      (value === 'report' && selectedDrilldown?.type === 'environment') ||
                      (value === 'environment' && selectedDrilldown?.type === 'report')
                    ) {
                      setSelectedDrilldown(null);
                    }
                  }}
                >
                  <TabsList className="h-auto gap-1 rounded-lg bg-blue-50 p-1">
                    <TabsTrigger
                      value="environment"
                      className="rounded-md px-3 py-1.5 text-sm font-medium text-blue-700 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
                    >
                      Cloud Environment
                    </TabsTrigger>
                    <TabsTrigger
                      value="report"
                      className="rounded-md px-3 py-1.5 text-sm font-medium text-blue-700 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
                    >
                      Compliance Report
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {groupBy === 'report' && selectedReportRow && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (IS_PUBLIC_SITE && !isLocalRuntime()) {
                        navigate(`/library/report/${selectedReportRow.report.id}`);
                      } else {
                        navigate('/dashboard/reports/library', {
                          state: { autoOpenReportId: selectedReportRow.report.id },
                        });
                      }
                    }}
                  >
                    Open report
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!isDetailView ? (
            groupBy === 'report' ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={hideEmptyReports}
                        onChange={(e) => setHideEmptyReports(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      Hide reports with no environments
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={hideNoScoreCards}
                        onChange={(e) => setHideNoScoreCards(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      Hide reports with no scores
                    </label>
                  </div>
                  <span className="text-xs text-gray-500">
                    {reportRows.length} report{reportRows.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {reportRows.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500">
                    No compliance reports match the current filters.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {reportRows.map((row) => (
                      <OverviewSummaryCard
                        key={row.report.id}
                        title={row.report.title}
                        provider={row.report.cloudProvider}
                        covered={row.covered}
                        total={row.total}
                        assessmentSummary={row.assessmentSummary}
                        isSelected={
                          selectedDrilldown?.type === 'report' &&
                          selectedDrilldown?.id === row.report.id
                        }
                        onClick={() => {
                          setSelectedDrilldown({ type: 'report', id: row.report.id });
                        }}
                        onRun={() => handleOpenRunModal(row.report.id, row.report.title, row.report.cloudProvider)}
                        isLoading={runSettingsLoading === row.report.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={hideNoScoreCards}
                      onChange={(e) => setHideNoScoreCards(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    Hide environments with no scores
                  </label>
                  <span className="text-xs text-gray-500">
                    {environmentRows.length} environment{environmentRows.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {environmentRows.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500">
                    No cloud environments match the current filters.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {environmentRows.map((row) => (
                    <OverviewSummaryCard
                      key={row.environment.id}
                      title={row.environment.name}
                      provider={row.environment.provider}
                      covered={row.covered}
                      total={row.total}
                      assessmentSummary={row.assessmentSummary}
                      isSelected={
                        selectedDrilldown?.type === 'environment' &&
                        selectedDrilldown?.id === row.environment.id
                      }
                      onClick={() => {
                        setSelectedDrilldown({ type: 'environment', id: row.environment.id });
                      }}
                    />
                  ))}
                </div>
                )}
              </div>
            )
          ) : (
            <div className="space-y-4">
              {selectedAssessmentSummary ? (
                <div className="flex flex-wrap items-center gap-6 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`text-2xl font-bold ${getScoreColor(calculateAggregateControlsScore(selectedAssessmentSummary)).text}`}>
                      {calculateAggregateControlsScore(selectedAssessmentSummary) ?? '--'}%
                    </div>
                    <div className={`h-8 w-24 overflow-hidden rounded-full ${getScoreColor(calculateAggregateControlsScore(selectedAssessmentSummary)).bg}`}>
                      <div
                        className={`h-full rounded-full ${getScoreColor(calculateAggregateControlsScore(selectedAssessmentSummary)).bar}`}
                        style={{ width: `${calculateAggregateControlsScore(selectedAssessmentSummary) ?? 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="h-8 w-px bg-gray-200" />
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">Controls:</span>
                    <span className="font-semibold text-emerald-600">{selectedAssessmentSummary.controlsPassed} passed</span>
                    <span className="font-semibold text-red-600">{selectedAssessmentSummary.controlsFailed} failed</span>
                  </div>
                  <div className="h-8 w-px bg-gray-200" />
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">Rules:</span>
                    <span className="font-semibold text-emerald-600">{selectedAssessmentSummary.rulesPassed} passed</span>
                    <span className="font-semibold text-red-600">{selectedAssessmentSummary.rulesFailed} failed</span>
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {groupBy === 'report' ? 'Cloud Environment' : 'Compliance Report'}
                      </TableHead>
                      <TableHead className="w-24">Score</TableHead>
                      <TableHead>Controls</TableHead>
                      <TableHead>Rules</TableHead>
                      <TableHead>Recommendations</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Run</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailTableRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="py-12 text-center text-sm text-gray-500"
                        >
                          No coverage details are available for this selection.
                        </TableCell>
                      </TableRow>
                    ) : (
                      detailTableRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <CloudProviderIcon provider={row.providerLabel} className="h-4 w-4 flex-shrink-0" />
                              <div className="min-w-0">
                                <div className="font-medium text-gray-900 truncate">{row.primary}</div>
                                <div className="text-xs text-gray-500 truncate">{row.secondary}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-semibold ${getScoreColor(row.score).text}`}>
                                {row.score != null ? `${row.score}%` : '--'}
                              </span>
                              <div className={`h-1.5 w-12 overflow-hidden rounded-full ${getScoreColor(row.score).bg}`}>
                                <div
                                  className={`h-full rounded-full ${getScoreColor(row.score).bar}`}
                                  style={{ width: `${row.score != null ? Math.max(row.score, 3) : 0}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {row.assessmentStats ? (
                              <span className="text-sm">
                                <span className="text-emerald-600">{row.assessmentStats.controlsPassed}</span>
                                <span className="text-gray-400"> / </span>
                                <span className="text-red-600">{row.assessmentStats.controlsFailed}</span>
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.assessmentStats ? (
                              <span className="text-sm">
                                <span className="text-emerald-600">{row.assessmentStats.rulesPassed}</span>
                                <span className="text-gray-400"> / </span>
                                <span className="text-red-600">{row.assessmentStats.rulesFailed}</span>
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.recommendationCount > 0 ? (
                              <button
                                type="button"
                                onClick={() => navigate('/dashboard/recommendations', {
                                  state: {
                                    filterReportId: row.reportId,
                                    filterAccountId: row.environmentSubtitle,
                                  }
                                })}
                                className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition"
                              >
                                <Sparkles className="h-3 w-3" />
                                {row.recommendationCount}
                              </button>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <CoverageStatusBadge status={row.status} />
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {row.timestampLabel || 'Not run'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {row.scan ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenScan(row.scan)}
                                >
                                  Open
                                </Button>
                              ) : null}
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={runSettingsLoading === row.reportId}
                                onClick={() => handleOpenRunModal(
                                  row.reportId,
                                  row.reportTitle,
                                  row.reportProvider,
                                  row.environmentId,
                                  row.environmentName
                                )}
                                className="gap-1 text-primary-600 hover:text-primary-700 hover:bg-primary-50"
                              >
                                {runSettingsLoading === row.reportId ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                                Run
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedReportPlan && (
        <SettingsSummary
          isOpen={isRunSettingsOpen}
          onClose={handleCloseRunSettings}
          onSubmit={handleRunReportFromModal}
          defaultValues={{}}
          inputSummary={selectedReportPlan.inputSummary}
          isAgent={true}
          isReport={true}
          planId={selectedReportPlan.id}
          buttonText="Run Report"
          cloudProvider={selectedReportPlan.cloudProvider}
          showEnvironmentSelection={true}
          requiredPermissions={selectedReportPlan.requiredPermissions}
          creditsCost={selectedReportPlan.credits}
          availableCredits={availableCredits}
          operationTitle={selectedReportPlan.title || 'Compliance Report'}
          prefillPermissionProfileId={selectedReportPlan.prefillPermissionProfileId}
          prefillPermissionProfileName={selectedReportPlan.prefillPermissionProfileName}
        />
      )}
    </div>
  );
}
