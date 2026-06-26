import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Box,
  Loader2,
  Play,
  Package,
  Search,
  AlertCircle,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Workflow,
  ExternalLink,
  RefreshCw,
  Plus,
  Sparkles,
  Bot,
} from 'lucide-react';
import StatusIndicator from '../../components/ui/status-indicator';
import { Icons } from '../../components/icons';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { SettingsSummary } from '../Agent/Agent';
import { refreshAccountScans } from '../../features/auth/authSlice';
import { buildReportRoute } from '../../helpers/accountScans';
import toast from 'react-hot-toast';
import {
  buildPermissionProfileLookup,
  getEnvironmentAuthProfile,
  getEnvironmentProfileId,
  matchesReportScan,
  resolvePermissionProfileFromLookup,
  selectActiveWorkspaceScope,
} from '@/features/workspace/workspaceScope';
import { fetchAgentList } from '@/helpers/agentList';

const PLANS_BASE_URL =
  'https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/plans';

const getDashboardReportTab = (pathname = '') => {
  if (pathname.includes('/dashboard/reports/library')) return 'library';
  if (pathname.includes('/dashboard/reports')) return 'history';
  return 'history';
};

const normalizeDescriptionText = (description) => {
  if (Array.isArray(description)) {
    return description.filter(Boolean).join(' ');
  }

  if (typeof description === 'string') {
    const trimmed = description.trim();
    if (!trimmed) return '';

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean).join(' ');
      }
    } catch {
      // fall through
    }

    return trimmed;
  }

  return '';
};

const formatProviderLabel = (provider) => {
  switch (String(provider || 'aws').toLowerCase()) {
    case 'google_workspace':
      return 'Google Workspace';
    case 'aws':
      return 'AWS';
    case 'gcp':
      return 'GCP';
    case 'azure':
      return 'Azure';
    case 'platform':
      return 'Platform';
    default:
      return provider || 'AWS';
  }
};

const getLibraryReportType = (report) => {
  const searchableText = [
    report?.id,
    report?.title,
    report?.category,
    report?.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return /\b(compliance|benchmark|cis|cmmc|controls?|guardrail|governance|well-architected)\b/.test(searchableText)
    ? 'compliance'
    : 'summary';
};

const parseMaybeJson = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const normalizeProfileType = (value) =>
  String(value || '').trim().toLowerCase().replace(/_/g, ' ');

const normalizeLookupKey = (value) =>
  String(value || '').trim().toLowerCase();

const getProfileAuthTenantId = (profile) =>
  String(getEnvironmentAuthProfile(profile)?.tenantId || '').trim();

const getProfileAuthSubscriptionId = (profile) =>
  String(getEnvironmentAuthProfile(profile)?.subscriptionId || '').trim();

const toTokenArray = (value) => {
  if (Array.isArray(value)) return value.flatMap(toTokenArray);
  if (value && typeof value === 'object') {
    return [
      value.id,
      value.recordId,
      value.permissionProfileId,
      value.tenantId,
      value.azureTenantId,
      value.accountId,
      value.awsAccountId,
      value.subscriptionId,
      value.azureSubscriptionId,
      value.domain,
    ].filter(Boolean);
  }
  return value ? [value] : [];
};

const getScanEnvironmentCandidates = (scan) =>
  [
    scan?.permissionProfileId,
    scan?.parentId,
    scan?.environmentId,
    scan?.targetDetails,
    parseMaybeJson(scan?.targetDetails, {})?.tenantId,
    parseMaybeJson(scan?.targetDetails, {})?.azureTenantId,
    scan?.accountId,
    scan?.subscriptionId,
    scan?.azureSubscriptionId,
    scan?.subscriptionIds,
    scan?.azureSubscriptionIds,
    scan?.subscriptions,
    scan?.domain,
  ].flatMap(toTokenArray);

const collectPermissionProfileTokens = (profile) => {
  const authProfile = getEnvironmentAuthProfile(profile);
  return [
    getEnvironmentProfileId(profile),
    profile?.name,
    profile?.permissionProfileId,
    authProfile.recordId,
    authProfile.profileId,
    authProfile.permissionProfileId,
    authProfile.authProfileName,
    authProfile.name,
    authProfile.tenantId,
    authProfile.azureTenantId,
    authProfile.awsAccountId,
    authProfile.accountId,
    authProfile.subscriptionId,
    authProfile.azureSubscriptionId,
    authProfile.subscriptionIds,
    authProfile.azureSubscriptionIds,
    authProfile.subscriptions,
    authProfile.domain,
  ].flatMap(toTokenArray);
};

const resolvePermissionProfileForScan = (lookup, profiles, scan) => {
  const candidates = getScanEnvironmentCandidates(scan);
  const lookupMatch = resolvePermissionProfileFromLookup(lookup, candidates);
  if (lookupMatch) return lookupMatch;

  const candidateSet = new Set(
    candidates.map((candidate) => String(candidate || '').trim().toLowerCase()).filter(Boolean)
  );

  return (Array.isArray(profiles) ? profiles : []).find((profile) =>
    collectPermissionProfileTokens(profile).some((token) =>
      candidateSet.has(String(token || '').trim().toLowerCase())
    )
  ) || null;
};

const getPermissionProfileDisplayText = (profile) => {
  if (!profile) return null;

  const authProfile = getEnvironmentAuthProfile(profile);
  return (
    profile.name ||
    authProfile.subscriptionName ||
    authProfile.accountName ||
    authProfile.authProfileName ||
    authProfile.name ||
    getEnvironmentProfileId(profile) ||
    null
  );
};

const getScanTargetDetails = (scan) => parseMaybeJson(scan?.targetDetails, {});

const getAzureTenantIdForScan = (scan) => {
  const targetDetails = getScanTargetDetails(scan);
  return String(
    targetDetails?.tenantId ||
      targetDetails?.azureTenantId ||
      scan?.tenantId ||
      scan?.azureTenantId ||
      scan?.accountId ||
      ''
  ).trim();
};

const getAzureSubscriptionIdsForScan = (scan) => {
  const targetDetails = getScanTargetDetails(scan);
  return [
    targetDetails?.subscriptionIds,
    targetDetails?.azureSubscriptionIds,
    targetDetails?.subscriptions,
    scan?.subscriptionIds,
    scan?.azureSubscriptionIds,
    scan?.subscriptions,
    scan?.subscriptionId,
    scan?.azureSubscriptionId,
  ]
    .flatMap(toTokenArray)
    .map((subscriptionId) => String(subscriptionId || '').trim())
    .filter(Boolean);
};

export default function MyReports() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [libraryReports, setLibraryReports] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState(null);
  const [libraryProviderFilter, setLibraryProviderFilter] = useState('all');
  const [libraryCategoryFilter, setLibraryCategoryFilter] = useState('all');
  const [libraryReportTypeFilter, setLibraryReportTypeFilter] = useState('all');
  const [startingLibraryReportId, setStartingLibraryReportId] = useState(null);
  const [selectedAzureSubscriptionDetails, setSelectedAzureSubscriptionDetails] = useState(null);
  const [selectedLibraryReportPlan, setSelectedLibraryReportPlan] = useState(null);
  const [isRunSettingsOpen, setIsRunSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() =>
    getDashboardReportTab(location.pathname)
  );
  const autoOpenReportIdRef = useRef(null);

  const { userProfile } = useSelector((state) => state.auth);
  const activeWorkspaceScope = useSelector(selectActiveWorkspaceScope);
  const permissionProfiles = userProfile?.agentPermissionProfiles || [];
  const permissionProfileLookup = useMemo(
    () => buildPermissionProfileLookup(permissionProfiles),
    [permissionProfiles]
  );
  // Filter accountScans to only include scans with reportId (reports only)
  const accountScans = (userProfile?.reportHistory || [])
    .filter((scan) => scan.reportId)
    .filter((scan) => matchesReportScan(scan, activeWorkspaceScope));
  const loading = false; // accountScans come from userProfile, no separate loading state

  useEffect(() => {
    setActiveTab(getDashboardReportTab(location.pathname));
  }, [location.pathname]);

  // Get permission profile name matching the scan's accountId
  const getPermissionProfileName = useCallback((scan) => {
    if (!scan) return null;

    const profile = resolvePermissionProfileForScan(
      permissionProfileLookup,
      permissionProfiles,
      scan
    );

    return (
      getPermissionProfileDisplayText(profile) ||
      scan.accountId ||
      scan.subscriptionId ||
      scan.azureSubscriptionId ||
      null
    );
  }, [permissionProfileLookup, permissionProfiles]);

  const getAzureReportEnvironmentDetails = useCallback(
    (scan) => {
      const tenantId = getAzureTenantIdForScan(scan);
      const subscriptionIds = Array.from(new Set(getAzureSubscriptionIdsForScan(scan)));

      const tenantProfile = permissionProfiles.find((profile) => {
        const type = normalizeProfileType(profile?.type);
        return type === 'azure tenant' && getProfileAuthTenantId(profile) === tenantId;
      });

      const subscriptionsById = new Map();
      permissionProfiles.forEach((profile) => {
        const type = normalizeProfileType(profile?.type);
        if (type !== 'azure subscription') return;
        const authProfile = getEnvironmentAuthProfile(profile);
        if (tenantId && String(authProfile?.tenantId || '').trim() !== tenantId) return;

        const subscriptionId = getProfileAuthSubscriptionId(profile);
        if (!subscriptionId) return;
        subscriptionsById.set(normalizeLookupKey(subscriptionId), {
          id: subscriptionId,
          name:
            authProfile.subscriptionName ||
            profile.name ||
            profile.description ||
            subscriptionId,
        });
      });

      const subscriptions = subscriptionIds.map((subscriptionId) => {
        const match = subscriptionsById.get(normalizeLookupKey(subscriptionId));
        return {
          id: subscriptionId,
          name: match?.name || subscriptionId,
        };
      });

      return {
        tenantId,
        tenantName:
          tenantProfile?.name ||
          getEnvironmentAuthProfile(tenantProfile)?.tenantName ||
          getEnvironmentAuthProfile(tenantProfile)?.name ||
          tenantId ||
          'Azure Tenant',
        subscriptions,
      };
    },
    [permissionProfiles]
  );

  const getPermissionProfileIdForScan = useCallback((scan) => {
    if (!scan) return null;
    if (scan.permissionProfileId) return scan.permissionProfileId;
    const profile = resolvePermissionProfileForScan(
      permissionProfileLookup,
      permissionProfiles,
      scan
    );

    return getEnvironmentProfileId(profile) || scan.parentId || null;
  }, [permissionProfileLookup, permissionProfiles]);

  // Get cloud provider for a scan
  const getCloudProviderForScan = useCallback((scan) => {
    // First check the scan's cloudProvider field
    if (scan?.cloudProvider) {
      return scan.cloudProvider;
    }
    
    const profile = resolvePermissionProfileForScan(
      permissionProfileLookup,
      permissionProfiles,
      scan
    );
    const authProfile = getEnvironmentAuthProfile(profile);
    if (authProfile.provider) return authProfile.provider;
    if (profile?.cloudProvider) return profile.cloudProvider;
    if (profile?.type) {
      const normalizedType = String(profile.type).toLowerCase();
      if (normalizedType.includes('azure')) return 'azure';
      if (normalizedType.includes('google')) return 'google_workspace';
      if (normalizedType.includes('gcp')) return 'gcp';
      if (normalizedType.includes('aws')) return 'aws';
    }

    return 'aws';
  }, [permissionProfileLookup, permissionProfiles]);

  const renderCloudEnvironmentDisplay = useCallback(
    (scan) => {
      const provider = getCloudProviderForScan(scan);

      if (String(provider || '').toLowerCase() === 'azure') {
        const { tenantId, tenantName, subscriptions } = getAzureReportEnvironmentDetails(scan);
        const subscriptionCount = subscriptions.length;
        const label = `${tenantName} (${subscriptionCount} subscription${subscriptionCount === 1 ? '' : 's'})`;

        if (subscriptionCount === 0) {
          return <span className="text-sm text-gray-700 truncate">{label}</span>;
        }

        return (
          <button
            type="button"
            className="min-w-0 text-left text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedAzureSubscriptionDetails({
                tenantId,
                tenantName,
                subscriptions,
              });
            }}
          >
            {label}
          </button>
        );
      }

      return (
        <span className="text-sm text-gray-600">
          {getPermissionProfileName(scan) || 'N/A'}
        </span>
      );
    },
    [
      getAzureReportEnvironmentDetails,
      getCloudProviderForScan,
      getPermissionProfileName,
    ]
  );

  // Render cloud provider icon
  const renderCloudProviderIcon = useCallback((provider, isLarge = false) => {
    const iconClassName = isLarge ? 'h-5 w-5' : 'h-4 w-4';

    switch (provider?.toLowerCase()) {
      case 'google_workspace':
        return <Icons.googleWorkspace className={iconClassName} />;
      case 'gcp':
        return <Icons.gcp className={iconClassName} />;
      case 'azure':
        return <Icons.azure className={iconClassName} />;
      case 'platform':
        return (
          <div className={`inline-flex items-center justify-center ${isLarge ? 'w-6 h-6' : 'w-5 h-5'} rounded-full bg-gradient-to-r from-purple-500 to-blue-500 shadow-sm`}>
            <Sparkles className={`${isLarge ? 'h-3.5 w-3.5' : 'h-3 w-3'} text-white`} />
          </div>
        );
      case 'aws':
      default:
        return <Icons.aws className={iconClassName} />;
    }
  }, []);

  const loadLibraryReports = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError(null);

    try {
      const response = await fetchAgentList();
      if (!response.ok) {
        throw new Error(
          `Failed to load library reports (${response.status} ${response.statusText})`
        );
      }

      const payload = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error('Library report response was not an array.');
      }

      const reportItems = payload
        .filter((report) => report?.active && report?.type === 'report')
        .map((report) => ({
          id: report.id,
          title: report.title || 'Untitled Report',
          description: normalizeDescriptionText(report.description),
          category: report.category || 'Uncategorized',
          credits: report.credits || 0,
          cloudProvider: report.cloudProvider || 'aws',
        }))
        .filter((report) => report.id);

      const deduped = Array.from(
        reportItems.reduce((accumulator, report) => {
          if (!accumulator.has(report.id)) {
            accumulator.set(report.id, report);
          }
          return accumulator;
        }, new Map()).values()
      ).sort((a, b) => {
        const providerCompare = a.cloudProvider.localeCompare(b.cloudProvider);
        return providerCompare || a.title.localeCompare(b.title);
      });

      setLibraryReports(deduped);
    } catch (fetchError) {
      console.error('Failed to load library reports:', fetchError);
      setLibraryError(
        fetchError?.message || 'Failed to load library reports.'
      );
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLibraryReports();
  }, [loadLibraryReports]);

  const handleSortChange = useCallback(
    (newSortBy) => {
      let newSortOrder = 'desc';
      if (newSortBy === sortBy) {
        newSortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
      }

      setSortBy(newSortBy);
      setSortOrder(newSortOrder);
    },
    [sortBy, sortOrder]
  );

  // Pagination handled by backend - all accountScans come from userProfile
  // No separate load more needed for now

  const filteredScans = useMemo(() => {
    if (!accountScans || !Array.isArray(accountScans)) {
      return [];
    }

    // Sort accountScans by lastUpdateTime
    const sorted = [...accountScans].sort((a, b) => {
      const dateA = new Date(a.lastUpdateTime || 0);
      const dateB = new Date(b.lastUpdateTime || 0);
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    if (!searchQuery.trim()) {
      return sorted;
    }

    const q = searchQuery.toLowerCase();
    return sorted.filter((scan) => {
      const titleOrId = (scan.title || scan.reportId || scan.scanId || '').toLowerCase();
      const environmentName = (getPermissionProfileName(scan) || '').toString().toLowerCase();
      return titleOrId.includes(q) || environmentName.includes(q);
    });
  }, [accountScans, searchQuery, sortOrder, getPermissionProfileName]);

  const handleConnectScan = useCallback(
    (scan) => {
      if (!scan) return;

      const reportRoute = buildReportRoute(scan);
      if (!reportRoute) return;

      navigate(reportRoute, {
        state: {
          isReconnecting: true,
          parentId: scan.parentId,
          reportId: scan.reportId,
        },
      });
    },
    [navigate]
  );

  const handleRefresh = useCallback(async () => {
    if (activeTab === 'library') {
      loadLibraryReports();
      return;
    }

    if (refreshing) return; // Prevent multiple simultaneous calls
    
    setRefreshing(true);
    setError(null);
    
    try {
      toast.loading('Refreshing report history...', { id: 'refresh-reports' });
      
      const result = await dispatch(refreshAccountScans()).unwrap();
      
      toast.success(`Refreshed ${result.length} scan${result.length !== 1 ? 's' : ''}`, { id: 'refresh-reports' });
    } catch (err) {
      console.error('[MyReports] Error refreshing account scans:', err);
      const errorMessage = err.message || 'Failed to refresh report history';
      setError(errorMessage);
      toast.error(errorMessage, { id: 'refresh-reports' });
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, dispatch, loadLibraryReports, refreshing]);

  const formatTimestamp = useCallback((timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (error) {
      return 'Invalid Date';
    }
  }, []);

  const getScanNameDisplay = useCallback(
    (scan) => {
      if (!scan) return null;
      return (
        <div className="flex flex-col">
          <span className="font-medium">{scan.title || scan.reportId || scan.scanId}</span>
        </div>
      );
    },
    []
  );

  // Map accountScans status to UI status
  // SUCCESSFUL or PARTIAL_SUCCESS → "complete" (success)
  // FAILED → "failed" 
  // Anything else → "in-progress"
  const mapScanStatusToUI = useCallback((status) => {
    if (!status) return 'in-progress';
    
    const upperStatus = status.toUpperCase();
    if (upperStatus === 'SUCCESSFUL' || upperStatus === 'PARTIAL_SUCCESS') {
      return 'complete';
    }
    if (upperStatus === 'FAILED') {
      return 'failed';
    }
    return 'in-progress';
  }, []);

  // Check if scan is completed (successful or partial success) to show action button
  const isScanCompleted = useCallback((status) => {
    if (!status) return false;
    const upperStatus = status.toUpperCase();
    return upperStatus === 'SUCCESSFUL' || upperStatus === 'PARTIAL_SUCCESS';
  }, []);

  const getSortIcon = (field) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortOrder === 'desc' ? (
      <ArrowDown className="h-4 w-4 text-primary" />
    ) : (
      <ArrowUp className="h-4 w-4 text-primary" />
    );
  };

  const getTimeWindowDescription = () => {
    return `Showing ${filteredScans.length} report${filteredScans.length !== 1 ? 's' : ''}`;
  };

  const handleRunReport = useCallback(() => {
    navigate('/dashboard/reports/library');
  }, [navigate]);

  const libraryProviderOptions = useMemo(
    () =>
      Array.from(
        new Set(libraryReports.map((report) => report.cloudProvider).filter(Boolean))
      ).sort((a, b) => formatProviderLabel(a).localeCompare(formatProviderLabel(b))),
    [libraryReports]
  );

  const libraryCategoryOptions = useMemo(
    () =>
      Array.from(
        new Set(libraryReports.map((report) => report.category).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [libraryReports]
  );

  const filteredLibraryReports = useMemo(() => {
    const normalizedQuery = searchQuery.toLowerCase().trim();
    const filtered = libraryReports.filter((report) => {
      const matchesProvider =
        libraryProviderFilter === 'all' ||
        report.cloudProvider === libraryProviderFilter;
      const matchesCategory =
        libraryCategoryFilter === 'all' ||
        report.category === libraryCategoryFilter;
      const matchesReportType =
        libraryReportTypeFilter === 'all' ||
        getLibraryReportType(report) === libraryReportTypeFilter;

      if (!matchesProvider || !matchesCategory || !matchesReportType) {
        return false;
      }

      if (!normalizedQuery) return true;

      return (
        report.title.toLowerCase().includes(normalizedQuery) ||
        report.description.toLowerCase().includes(normalizedQuery) ||
        report.category.toLowerCase().includes(normalizedQuery) ||
        report.id.toLowerCase().includes(normalizedQuery)
      );
    });

    return filtered.sort((a, b) => {
      const providerCompare = a.cloudProvider.localeCompare(b.cloudProvider);
      return providerCompare || a.title.localeCompare(b.title);
    });
  }, [
    libraryCategoryFilter,
    libraryProviderFilter,
    libraryReportTypeFilter,
    libraryReports,
    searchQuery,
  ]);

  const handleOpenLibraryReport = useCallback(
    async (report) => {
      if (!report?.id) return;

      setStartingLibraryReportId(report.id);
      try {
        const response = await fetch(`${PLANS_BASE_URL}/${report.id}.json`);
        if (!response.ok) {
          throw new Error(
            `Failed to load report settings (${response.status} ${response.statusText})`
          );
        }

        const planData = await response.json();
        const resolvedCloudProvider =
          planData.cloudProvider ||
          planData.plan?.[0]?.tasks?.[0]?.cloudProvider ||
          report.cloudProvider ||
          'aws';

        setSelectedLibraryReportPlan({
          id: report.id,
          title: planData.title || report.title,
          credits: planData.credits || report.credits || 0,
          cloudProvider: resolvedCloudProvider,
          inputSummary: planData.planSettings?.defaultValues || '',
          requiredPermissions: planData.requiredPermissions || {},
        });
        setIsRunSettingsOpen(true);
      } catch (fetchError) {
        console.error('Failed to prepare library report:', fetchError);
        toast.error(fetchError?.message || 'Failed to load report settings.');
      } finally {
        setStartingLibraryReportId(null);
      }
    },
    []
  );

  // Auto-open run settings modal if autoOpenReportId is passed in location state
  useEffect(() => {
    const autoOpenReportId = location.state?.autoOpenReportId;
    if (
      autoOpenReportId &&
      !libraryLoading &&
      libraryReports.length > 0 &&
      autoOpenReportIdRef.current !== autoOpenReportId
    ) {
      autoOpenReportIdRef.current = autoOpenReportId;
      const reportToOpen = libraryReports.find((r) => r.id === autoOpenReportId);
      if (reportToOpen) {
        handleOpenLibraryReport(reportToOpen);
      }
    }
  }, [location.state?.autoOpenReportId, libraryLoading, libraryReports, handleOpenLibraryReport]);

  const handleCloseRunSettings = useCallback(() => {
    setIsRunSettingsOpen(false);
    setSelectedLibraryReportPlan(null);
  }, []);

  const handleRunLibraryReportFromModal = useCallback(
    async (settings, { authProfile, accountId, selectedPermissionProfileId }) => {
      if (!selectedLibraryReportPlan?.id) return;

      try {
        const isGoogleWorkspace = authProfile?.provider === 'google_workspace';
        const effectiveAccountId = isGoogleWorkspace
          ? accountId || authProfile?.domain || ''
          : accountId || authProfile?.awsAccountId || authProfile?.accountId || '';
        const generatedScanId = `${effectiveAccountId}-${Date.now()}-${selectedLibraryReportPlan.id}`;
        const targetRoute =
          buildReportRoute({
            scanId: generatedScanId,
            reportId: selectedLibraryReportPlan.id,
          }) || `/dashboard/reports/${generatedScanId}`;

        handleCloseRunSettings();

        navigate(targetRoute, {
          state: {
            planId: selectedLibraryReportPlan.id,
            shouldAutocontinue: true,
            readyToRun: true,
            cloudProvider: selectedLibraryReportPlan.cloudProvider,
            authProfile,
            accountId: effectiveAccountId,
            globalSettings: settings,
            parentId: selectedPermissionProfileId,
            returnTo: '/dashboard/reports/library',
          },
        });
      } catch (runError) {
        console.error('Error starting report:', runError);
        toast.error(runError?.message || 'Failed to start report');
      }
    },
    [dispatch, handleCloseRunSettings, navigate, selectedLibraryReportPlan]
  );

  const handleOpenChatWithReport = useCallback((scan) => {
    if (!scan) return;
    const permissionProfileId = getPermissionProfileIdForScan(scan);
    navigate('/dashboard/cloudagent', {
      state: {
        preloadReportContext: {
          scanId: scan.scanId || null,
          reportId: scan.reportId || null,
          permissionProfileId: permissionProfileId || undefined,
          title: scan.title || scan.reportId || scan.scanId,
        },
        preloadPrompt: 'Analyze this report.',
      },
    });
  }, [getPermissionProfileIdForScan, navigate]);

  return (
    <div className="bg-white rounded-lg p-6">
      <div className="border-b border-gray-200 mb-6">
        <div className="flex justify-between items-center">
          <nav className="flex space-x-8">
            <NavLink
              to="/dashboard/reports/library"
              onClick={() => setActiveTab('library')}
              className={() =>
                `py-3 px-2 border-b-2 font-semibold text-base transition-colors ${
                  activeTab === 'library'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`
              }
            >
              Library Reports
            </NavLink>
            <NavLink
              to="/dashboard/reports"
              onClick={() => setActiveTab('history')}
              className={() =>
                `py-3 px-2 border-b-2 font-semibold text-base transition-colors ${
                  activeTab === 'history'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`
              }
            >
              Report History
            </NavLink>
            
          </nav>
          <div className="flex items-center gap-4">
            {activeTab === 'history' && (
              <Button className="text-white" onClick={handleRunReport}>
                <Plus className="w-4 h-4 mr-1" />
                Run Report
              </Button>
            )}
            <div className="flex items-center justify-between bg-primary-50 text-primary-600 px-3 py-2 rounded-full border border-primary-50">
              <div className="flex items-center gap-2">
                <Icons.toll className="w-6 h-6" />
                <span className="font-medium">
                  {activeTab === 'library'
                    ? `Showing ${filteredLibraryReports.length} library report${filteredLibraryReports.length !== 1 ? 's' : ''}`
                    : getTimeWindowDescription()}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={activeTab === 'library' ? libraryLoading : refreshing}
              title={
                activeTab === 'library'
                  ? 'Refresh library reports'
                  : 'Refresh report history'
              }
              className="flex items-center justify-center"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  activeTab === 'library'
                    ? libraryLoading
                      ? 'animate-spin'
                      : ''
                    : refreshing
                      ? 'animate-spin'
                      : ''
                }`}
              />
            </Button>
          </div>
        </div>
      </div>

      <h1 className="text-2xl text-primary-800 font-medium">
        {activeTab === 'library' ? 'Report Library' : 'Report History'}
      </h1>
      <p className="text-sm text-gray-600 mt-1">
        {activeTab === 'library'
          ? 'Browse report starters and open a report to begin a new run.'
          : 'Your available reports'}
      </p>

      <div className="flex gap-4 mt-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={
              activeTab === 'library'
                ? 'Search Library Reports'
                : 'Search Reports'
            }
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={activeTab === 'library' ? libraryLoading : loading}
          />
        </div>
        {activeTab === 'library' && (
          <>
            <Select
              value={libraryProviderFilter}
              onValueChange={setLibraryProviderFilter}
              disabled={libraryLoading}
            >
              <SelectTrigger className="w-[150px] bg-white">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                {libraryProviderOptions.map((provider) => (
                  <SelectItem key={provider} value={provider}>
                    {formatProviderLabel(provider)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={libraryCategoryFilter}
              onValueChange={setLibraryCategoryFilter}
              disabled={libraryLoading}
            >
              <SelectTrigger className="w-[210px] bg-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {libraryCategoryOptions.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={libraryReportTypeFilter}
              onValueChange={setLibraryReportTypeFilter}
              disabled={libraryLoading}
            >
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="Report Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Report Types</SelectItem>
                <SelectItem value="compliance">Compliance</SelectItem>
                <SelectItem value="summary">Summary / Other</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {(activeTab === 'library' ? libraryError : error) && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 mt-4">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">
            Failed to load reports:{' '}
            {activeTab === 'library' ? libraryError : error}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="ml-auto"
          >
            Retry
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-primary-100 overflow-hidden mt-4">
        {activeTab === 'library' ? (
          <Table className="border-collapse">
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Provider</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {libraryLoading && libraryReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <div className="text-gray-500">Loading library reports...</div>
                  </TableCell>
                </TableRow>
              ) : filteredLibraryReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <div className="text-gray-500">
                      {searchQuery
                        ? `No library reports found matching "${searchQuery}"`
                        : 'No library reports found'}
                    </div>
                    {!searchQuery && !libraryError && (
                      <div className="mt-2 text-sm text-gray-400">
                        Available report starters will appear here
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredLibraryReports.map((report) => (
                  <TableRow key={report.id} className="hover:bg-gray-50">
                    <TableCell className="w-28">
                      <div className="flex items-center gap-2">
                        <span className="flex-shrink-0">
                          {renderCloudProviderIcon(report.cloudProvider, true)}
                        </span>
                        <span className="text-sm text-gray-600">
                          {formatProviderLabel(report.cloudProvider)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{report.title}</div>
                        {report.description && (
                          <div className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {report.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {report.category}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        className="border-indigo-500 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200"
                        disabled={startingLibraryReportId === report.id}
                        onClick={() => handleOpenLibraryReport(report)}
                      >
                        {startingLibraryReportId === report.id ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5 mr-1" />
                        )}
                        Start
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        ) : (
          <Table className="border-collapse">
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-gray-50 select-none"
                  onClick={() => handleSortChange('name')}
                >
                  <div className="flex items-center gap-2">
                    Name
                    {getSortIcon('name')}
                  </div>
                </TableHead>
                <TableHead>Cloud Environment</TableHead>
                <TableHead>Workflow</TableHead>
                <TableHead className="cursor-pointer hover:bg-gray-50 select-none">
                  <div className="flex items-center gap-2">Status</div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-gray-50 select-none"
                  onClick={() => handleSortChange('updatedAt')}
                >
                  <div className="flex items-center gap-2">
                    Updated
                    {getSortIcon('updatedAt')}
                  </div>
                </TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredScans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="text-gray-500">
                      {searchQuery
                        ? `No reports found matching "${searchQuery}"`
                        : 'No reports found'}
                    </div>
                    {!searchQuery && !error && (
                      <div className="mt-2 text-sm text-gray-400">
                        Run your first report to get started
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredScans.map((scan, index) => {
                  if (!scan) return null;

                  const uniqueKey = `${scan.scanId}-${index}`;

                  return (
                    <TableRow key={uniqueKey} className="hover:bg-gray-50">
                      <TableCell className="flex items-center gap-3">
                        <Package className="h-10 w-10 p-1.5 bg-blue-50 text-blue-500 rounded-lg" />
                        {getScanNameDisplay(scan)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="flex-shrink-0">
                            {renderCloudProviderIcon(getCloudProviderForScan(scan))}
                          </span>
                          {renderCloudEnvironmentDisplay(scan)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <WorkflowIndicator parentId={scan.parentId} />
                      </TableCell>
                      <TableCell>
                        <StatusIndicator status={mapScanStatusToUI(scan.status)} />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {formatTimestamp(scan.lastUpdateTime)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-3">
                          {isScanCompleted(scan.status) && (
                            <>
                              <Button
                                variant="outline"
                                className="border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 rounded-md px-2 py-0.5 h-7 text-[11px] font-medium flex items-center shadow-sm"
                                onClick={() => handleConnectScan(scan)}
                              >
                                <Box className="w-3 h-3 mr-1" />
                                View
                              </Button>
                              <Button
                                variant="outline"
                                className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 transition-all duration-200 rounded-md px-2 py-0.5 h-7 text-[11px] font-medium flex items-center shadow-sm"
                                onClick={() => handleOpenChatWithReport(scan)}
                              >
                                <Bot className="w-3 h-3 mr-1" />
                                Chat
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>
      <Dialog
        open={Boolean(selectedAzureSubscriptionDetails)}
        onOpenChange={(open) => {
          if (!open) setSelectedAzureSubscriptionDetails(null);
        }}
      >
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle>
              {selectedAzureSubscriptionDetails?.tenantName || 'Azure Tenant'} Subscriptions
            </DialogTitle>
            <DialogDescription>
              {selectedAzureSubscriptionDetails?.subscriptions?.length || 0} subscription
              {(selectedAzureSubscriptionDetails?.subscriptions?.length || 0) === 1 ? '' : 's'} included
              {selectedAzureSubscriptionDetails?.tenantId
                ? ` for tenant ${selectedAzureSubscriptionDetails.tenantId}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[420px] overflow-y-auto rounded-lg border border-gray-100">
            {(selectedAzureSubscriptionDetails?.subscriptions || []).map((subscription) => (
              <div
                key={subscription.id}
                className="border-b border-gray-100 px-4 py-3 last:border-b-0"
              >
                <div className="text-sm font-medium text-gray-800">
                  {subscription.name}
                </div>
                <div className="mt-1 font-mono text-xs text-gray-500 break-all">
                  {subscription.id}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      {selectedLibraryReportPlan && (
        <SettingsSummary
          isOpen={isRunSettingsOpen}
          onClose={handleCloseRunSettings}
          onSubmit={handleRunLibraryReportFromModal}
          defaultValues={{}}
          inputSummary={selectedLibraryReportPlan.inputSummary}
          isAgent={true}
          isReport={true}
          planId={selectedLibraryReportPlan.id}
          buttonText="Run Report"
          cloudProvider={selectedLibraryReportPlan.cloudProvider}
          showEnvironmentSelection={true}
          requiredPermissions={selectedLibraryReportPlan.requiredPermissions}
          creditsCost={selectedLibraryReportPlan.credits}
          availableCredits={
            (userProfile?.agentCredits?.adhocCredits || 0) +
            (userProfile?.agentCredits?.monthlyBaseCredits || 0)
          }
          operationTitle={selectedLibraryReportPlan.title || 'Report Run'}
        />
      )}
    </div>
  );
}

const WorkflowIndicator = ({ parentId }) => {
  const navigate = useNavigate();

  const getWorkflowInfo = (parentId) => {
    if (!parentId) return null;

    try {
      const parsed = JSON.parse(parentId);
      return parsed.workflowRunId
        ? {
            workflowRunId: parsed.workflowRunId,
            taskId: parsed.taskId,
            branchId: parsed.branchId,
          }
        : null;
    } catch (error) {
      console.error('Failed to parse parentId:', error);
      return null;
    }
  };

  const workflowInfo = getWorkflowInfo(parentId);

  if (!workflowInfo) {
    return <span className="text-xs text-gray-400">Manual</span>;
  }

  const handleWorkflowClick = () => {
    navigate(`/dashboard/workflow-history/${workflowInfo.workflowRunId}`);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
      onClick={handleWorkflowClick}
    >
      <div className="flex items-center gap-1.5">
        <Workflow className="w-3 h-3" />
        <span className="truncate max-w-[80px]">View Workflow</span>
        <ExternalLink className="w-3 h-3" />
      </div>
    </Button>
  );
};
