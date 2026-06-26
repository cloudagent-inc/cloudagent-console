import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { generateClient } from 'aws-amplify/api';
import {
  onUpdateReportHistoryAssessmentResults,
  onUpdateReportHistoryStatus,
  queryGetLatestReportHistoryAssessmentResult,
} from '../api/eventQueries';
// Scan initiation moved to parent component (Report.jsx)
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { processReport } from '../helpers/report_compliance';
import {
  buildReportDefinitionUrl,
  getReportIdCandidates,
} from '../helpers/reportId';
import { findAccountScan } from '../helpers/accountScans';
import ReportScanSummary from './ReportScanSummary';

import { useSelector, useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileText, Search } from 'lucide-react';
import { refreshAccountScans } from '../features/auth/authSlice';
import { refreshRecommendationsFromScans } from '../features/operations/operationsSlice';
import { loadWorkloadsFromUserProfile } from '../features/workload/workloadSlice';
import { getAwsAccountIdForWorkloadEnvironment } from '../features/workload/workloadEnvironmentUtils';
import { CompliancePDFDocument } from './CompliancePDFDocument';
import { pdf } from '@react-pdf/renderer';

// Use authenticated user's id from Redux auth state
// Note: userId is resolved dynamically from userProfile below
const client = generateClient();

const fetchReportDefinition = async (rawReportId) => {
  for (const candidateId of getReportIdCandidates(rawReportId)) {
    const response = await fetch(buildReportDefinitionUrl(candidateId));
    if (!response.ok) continue;
    const data = await response.json();
    return { data, reportId: candidateId };
  }

  throw new Error(`Unable to load report definition for ${rawReportId}`);
};

function isSummaryResultsShape(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const firstGroup = Object.values(value)[0];
  return !!firstGroup
    && typeof firstGroup === 'object'
    && !Array.isArray(firstGroup)
    && firstGroup.checks
    && firstGroup.resources;
}

function renderReportValue(value, context = {}) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => renderReportValue(item, context)).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    console.warn('[ComplianceSummaryReport] Rendering non-scalar report value', {
      value,
      context,
    });
    if ('Key' in value && 'Value' in value) {
      return `${renderReportValue(value.Key, context)}: ${renderReportValue(value.Value, context)}`;
    }
    if ('key' in value && 'value' in value) {
      return `${renderReportValue(value.key, context)}: ${renderReportValue(value.value, context)}`;
    }
    if ('name' in value) return renderReportValue(value.name, context);
    if ('id' in value) return renderReportValue(value.id, context);
    return JSON.stringify(value);
  }
  return String(value);
}

function ComplianceSummaryReport({
  planId,
  accountId,
  recordId,
  scanId,
  reportId,
  services,
  authProfile,
  runAssessment,
  regions,
  title,
  parentId,
  cloudProvider,
  connectionId, // Passed from parent (Report.jsx)
  scanInitiated, // Passed from parent (Report.jsx)
  serviceStatus: parentServiceStatus, // Passed from parent (Report.jsx) - WebSocket updates
  embeddedView = false,
  embeddedData = null,
  compact = false,
}) {
  console.log('[ComplianceSummaryReport] Rendered with props:', {
    planId,
    accountId,
    scanId,
    reportId,
    title,
    scanInitiated,
    connectionId,
    services,
    regions,
  });
  const effectiveAccountId = authProfile?.awsAccountId || accountId;
  const selectedRegions =
    Array.isArray(regions) && regions.length > 0 ? regions : ['us-east-1'];
  // Treat "new" as empty so we generate a proper scanId
  const effectiveScanId = scanId && scanId !== 'new' ? scanId : '';
  const scanIdConst = effectiveScanId
    ? effectiveScanId
    : `${effectiveAccountId}-${Date.now()}-${planId}`;
  const effectiveAuthProfile = {
    ...(authProfile || {}),
    accountId: effectiveAccountId,
  };
  const location = useLocation();
  // connectionId is now passed from parent (Report.jsx) - no longer managed here
  // serviceStatus is now passed from parent (Report.jsx) - WebSocket updates come from parent
  const [messages, setMessages] = useState([]);
  const [overallScanStatus, setOverallScanStatus] = useState(''); // "", "in progress", or "done"
  const [resultsStatus, setResultsStatus] = useState(''); // "", "processing", or "done"
  const [complianceResults, setComplianceResults] = useState({});
  const [hasStartedScan, setHasStartedScan] = useState(false);
  const { userProfile } = useSelector((state) => state.auth);
  const workloads = useSelector((state) => state.workload.workloads);
  const dispatch = useDispatch();
  const userId = userProfile?.userId;
  const subscriptionRef = useRef(null);
  const resultsSubscriptionRef = useRef(null);
  const [loading, setLoading] = useState(() => !embeddedView);
  const [hasFetchedReportDef, setHasFetchedReportDef] = useState(false);
  const [controls, setControls] = useState({});
  const [rules, setRules] = useState({}); // Changed from tags to rules for clarity
  const [searchQueries, setSearchQueries] = useState({});
  const [activePages, setActivePages] = useState({});
  const [reportTitle, setReportTitle] = useState(title || '');
  const [hideNotApplicable, setHideNotApplicable] = useState(false);
  const [selectedWorkloadId, setSelectedWorkloadId] = useState('');
  const scanRecord = useMemo(() => {
    if (!effectiveScanId) return null;
    return findAccountScan(userProfile?.reportHistory || [], {
      scanId: effectiveScanId,
      reportId,
    });
  }, [effectiveScanId, reportId, userProfile?.reportHistory]);

  useEffect(() => {
    if (!embeddedView) return;
    let cancelled = false;

    const hydrateEmbedded = async () => {
      const candidate = embeddedData && typeof embeddedData === 'object'
        ? (embeddedData.summaryResults || embeddedData.results || embeddedData)
        : null;
      const hasStructuredResults = isSummaryResultsShape(candidate);

      if (hasStructuredResults) {
        if (!cancelled) {
          setComplianceResults(candidate);
          setHasFetchedReportDef(true);
          setOverallScanStatus('done');
          setResultsStatus('done');
          setLoading(false);
        }
        return;
      }

      const fallbackReportId = embeddedData?.reportDefinitionId || embeddedData?.reportId || reportId;
      const fallbackScanId = embeddedData?.scanId || effectiveScanId || null;
      let latestResultsUrl = null;
      if (fallbackScanId) {
        try {
          const latestResponse = await client.graphql({
            query: queryGetLatestReportHistoryAssessmentResult,
            variables: { scanId: fallbackScanId, userId },
          });
          latestResultsUrl = latestResponse?.data?.__getLatestReportHistoryAssessmentResult || null;
        } catch (error) {
          console.warn('[ComplianceSummaryReport] Unable to resolve latest embedded results URL from scanId:', fallbackScanId, error);
        }
      }
      const fallbackResultsUrl = latestResultsUrl || embeddedData?.assessmentResultsUrl || null;
      if (!fallbackReportId || !fallbackResultsUrl) {
        if (!cancelled) {
          setComplianceResults({});
          setHasFetchedReportDef(true);
          setOverallScanStatus('done');
          setResultsStatus('done');
          setLoading(false);
        }
        return;
      }

      if (!cancelled) setLoading(true);
      try {
        const [reportDefResp, scanResultsResp] = await Promise.all([
          fetchReportDefinition(fallbackReportId),
          fetch(fallbackResultsUrl),
        ]);
        const reportDef = reportDefResp.data;
        const scanResults = await scanResultsResp.json();
        const rulesToUse = reportDef?.rules && typeof reportDef.rules === 'object'
          ? reportDef.rules
          : {};

        const results = processReport(scanResults, rulesToUse);

        if (!cancelled) {
          setComplianceResults(results || {});
          setHasFetchedReportDef(true);
          setOverallScanStatus('done');
          setResultsStatus('done');
          setLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[ComplianceSummaryReport] Embedded hydration failed:', error);
          setComplianceResults({});
          setHasFetchedReportDef(true);
          setOverallScanStatus('done');
          setResultsStatus('done');
          setLoading(false);
        }
      }
    };

    hydrateEmbedded();
    return () => {
      cancelled = true;
    };
  }, [effectiveScanId, embeddedData, embeddedView, reportId]);

  // Function to resolve AWS account ID from environment value
  const permissionProfiles = userProfile?.agentPermissionProfiles || [];

  // Filter workloads that are associated with the AWS account ID
  const associatedWorkloads = useMemo(() => {
    if (!effectiveAccountId || !workloads || workloads.length === 0) {
      return [];
    }
    
    return workloads.filter((workload) => {
      if (!Array.isArray(workload.environments) || workload.environments.length === 0) {
        return false;
      }
      
      // Check if any environment includes this AWS account ID
      return workload.environments.some((env) => {
        const accountId = getAwsAccountIdForWorkloadEnvironment(env, permissionProfiles);
        return accountId === effectiveAccountId;
      });
    });
  }, [workloads, effectiveAccountId, permissionProfiles]);

  // Load workloads from userProfile if not already loaded
  useEffect(() => {
    if (
      userProfile?.workloads &&
      userProfile.workloads.length > 0 &&
      workloads.length === 0
    ) {
      dispatch(loadWorkloadsFromUserProfile(userProfile.workloads));
    }
  }, [dispatch, userProfile?.workloads, workloads.length]);

  // Read workloadId from URL parameters on mount
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const urlWorkloadId = searchParams.get('workloadId');
    if (urlWorkloadId) {
      setSelectedWorkloadId(urlWorkloadId);
    }
  }, [location.search]);

  useEffect(() => {
    if (embeddedView) return;

    const fetchReportDef = async () => {
      if (reportId) {
        const reportUrl = buildReportDefinitionUrl(reportId);
        console.log('[ComplianceSummaryReport] Fetching report definition:', {
          reportId,
          url: reportUrl,
        });
        const { data, reportId: resolvedReportId } = await fetchReportDefinition(reportId);
        console.log('[ComplianceSummaryReport] Report definition fetched:', {
          reportId: resolvedReportId,
          hasRules: !!data.rules,
          rulesCount: data.rules ? Object.keys(data.rules).length : 0,
          hasControls: !!data.controls,
          controlsCount: data.controls ? Object.keys(data.controls).length : 0,
          title: data.title,
        });
        const { rules: reportRules, controls, title: reportDefTitle } = data;
        setRules(reportRules || {}); // Store rules properly
        setControls(controls || {});
        if (reportDefTitle && !title) {
          setReportTitle(reportDefTitle);
        }
        setHasFetchedReportDef(true);
        setLoading(false);
      }
    };

    fetchReportDef();
  }, [embeddedView, reportId, title]);

  // Scan initiation is now handled by parent component (Report.jsx)
  // This component only displays scan status and results
  // When scanInitiated becomes true, show scan progress UI and subscribe to updates
  useEffect(() => {
    if (embeddedView) return;
    if (scanInitiated && !hasStartedScan) {
      setHasStartedScan(true);
      setOverallScanStatus('in progress');
      setLoading(false);
      // Subscribe to scan status updates (AppSync subscription, not WebSocket)
      subscribeToScanStatus();
    }
  }, [embeddedView, scanInitiated, hasStartedScan]);

  // Function to retrieve assessment content via GraphQL.
  const getAssessmentContent = async (scanId) => {
    console.log('[ComplianceSummaryReport] getAssessmentContent called with scanId:', scanId);
    setLoading(true);
    try {
      // Execute the GraphQL query using the v6 API client.
      const response = await client.graphql({
        query: queryGetLatestReportHistoryAssessmentResult,
        variables: { scanId, userId },
      });
      const data = response.data;

      // Assume data.getAssessmentContent is a JSON string mapping service names to URLs.
      const url = data['__getLatestReportHistoryAssessmentResult'];
      console.log('[ComplianceSummaryReport] Assessment results URL:', url);
      let scanResults = {};

      const res = await fetch(url);
      const content = await res.json();
      console.log('[ComplianceSummaryReport] Scan results fetched:', {
        scanId,
        contentKeys: Object.keys(content),
        contentSample: JSON.stringify(content).substring(0, 500),
      });
      // Merge the content into scanResults under the service key.
      scanResults = content;

      // Ensure rules are loaded before processing
      // This can happen when scan completes before report definition is fetched
      let rulesToUse = rules;
      
      if (!rulesToUse || Object.keys(rulesToUse).length === 0) {
        console.warn('Rules not loaded yet, fetching report definition...', { reportId, hasFetchedReportDef });
        if (reportId) {
          try {
            const { data, reportId: resolvedReportId } = await fetchReportDefinition(reportId);
            const { rules: reportRules } = data;
            if (reportRules && Object.keys(reportRules).length > 0) {
              // Update rules state for future use
              setRules(reportRules);
              rulesToUse = reportRules;
            } else {
              console.error('Report definition fetched but rules are empty', {
                reportId: resolvedReportId,
                data,
              });
            }
          } catch (error) {
            console.error('Error fetching report definition:', error);
            throw new Error(`Failed to load report definition: ${error.message}`);
          }
        } else {
          console.error('Cannot fetch rules: reportId is missing');
          throw new Error('Report ID is missing. Cannot process results.');
        }
      }

      if (!rulesToUse || Object.keys(rulesToUse).length === 0) {
        console.error('[ComplianceSummaryReport] Cannot process results: rules are not available', { reportId, hasFetchedReportDef });
        throw new Error('Report rules not available. Please try reloading the page.');
      }
      console.log('[ComplianceSummaryReport] Processing report with rules:', {
        rulesCount: Object.keys(rulesToUse).length,
        ruleKeys: Object.keys(rulesToUse),
      });
      const results = processReport(scanResults, rulesToUse);
      console.log('[ComplianceSummaryReport] processReport results:', {
        resultsKeys: Object.keys(results),
        resultsCount: Object.keys(results).length,
        resultsSample: JSON.stringify(results).substring(0, 500),
      });
      setComplianceResults(results);
      setLoading(false);

      return results;
    } catch (error) {
      setLoading(false);
      console.error('Error in getting assessment content:', error);
      // Optionally, fire an error event:
      // fireErrorEvent('userSession-loadUserProfile', error);
      throw error;
    }
  };

  // Only fetch results for existing scans (when scanId is set and scan hasn't started)
  // For new scans, wait for subscription to notify when results are ready
  useEffect(() => {
    if (embeddedView) return;

    // Only fetch if:
    // 1. scanId exists and is not empty/not "new"
    // 2. Report definition is fetched
    // 3. Scan hasn't been started (hasStartedScan is false) - meaning this is an existing scan
    // 4. overallScanStatus is not 'in progress' - meaning scan is not currently running
    // 5. scanInitiated is false - meaning this is NOT a new scan being initiated (it's an existing scan)
    // 6. connectionId is null - meaning no scan is currently in progress
    // IMPORTANT: scanInitiated must be false or undefined (not true) to load existing results
    // false = existing scan, undefined = initial render (existing scan), true = new scan being initiated
    const effectiveScanId = scanId && scanId !== 'new' ? scanId : '';
    console.log('[ComplianceSummaryReport] Checking whether to fetch existing results:', {
      scanId,
      effectiveScanId,
      hasFetchedReportDef,
      hasStartedScan,
      overallScanStatus,
      scanInitiated,
      connectionId,
      willFetch: effectiveScanId && hasFetchedReportDef && !hasStartedScan && overallScanStatus !== 'in progress' && scanInitiated !== true && !connectionId,
    });
    if (
      effectiveScanId && 
      hasFetchedReportDef && 
      !hasStartedScan && 
      overallScanStatus !== 'in progress' &&
      scanInitiated !== true && // Not true (can be false or undefined) - don't load if new scan is being initiated
      !connectionId // Don't load results if a scan is in progress
    ) {
      console.log('[ComplianceSummaryReport] Fetching existing results for scanId:', effectiveScanId);
      getAssessmentContent(effectiveScanId);
      setResultsStatus('done');
    } else if (scanInitiated === true) {
      console.log('[ComplianceSummaryReport] Skipping fetch - new scan is being initiated');
    } else {
      console.log('[ComplianceSummaryReport] Skipping fetch - conditions not met');
    }
  }, [embeddedView, scanId, hasFetchedReportDef, hasStartedScan, overallScanStatus, scanInitiated, connectionId]);

  // Subscribe to scan completion updates.
  const subscribeToScanStatus = () => {
    const subscriptionName = 'onUpdateReportHistoryStatus';
    console.log('[ComplianceSummaryReport] Setting up scan status subscription:', {
      subscriptionName,
      userId,
      scanIdConst,
    });
    try {
      const subscription = client
        .graphql({
          query: onUpdateReportHistoryStatus,
          variables: { userId },
        })
        .subscribe({
          next: (value) => {
            console.log('[ComplianceSummaryReport] Scan status subscription received data:', {
              subscriptionName,
              rawValue: value,
              data: value?.data,
            });
            const subData = value.data.onUpdateReportHistoryStatus;
            console.log('[ComplianceSummaryReport] Scan status subscription parsed:', {
              subscriptionName,
              receivedScanId: subData?.scanId,
              expectedScanId: scanIdConst,
              scanIdMatch: subData?.scanId === scanIdConst,
              status: subData?.status,
            });
            if (subData.scanId === scanIdConst) {
              console.log('[ComplianceSummaryReport] Scan status subscription - Scan ID matched! Status:', subData.status);
              setOverallScanStatus('done');
              setMessages((prev) => [
                ...prev,
                {
                  message: `Scan completed: Scan ID ${subData.scanId} - ${subData.status}`,
                },
              ]);
              // Start subscription for assessment results if not already started
              if (!resultsSubscriptionRef.current) {
                console.log('[ComplianceSummaryReport] Starting subscribeToResults...');
                subscribeToResults();
              } else {
                console.log('[ComplianceSummaryReport] resultsSubscriptionRef already exists, not starting new subscription');
              }
            } else {
              console.log('[ComplianceSummaryReport] Scan status subscription - Scan ID did not match, ignoring');
            }
          },
          error: (error) => {
            console.error('[ComplianceSummaryReport] Scan status subscription error:', error);
          },
        });
      subscriptionRef.current = subscription;
      console.log('[ComplianceSummaryReport] Scan status subscription set up successfully');
    } catch (error) {
      console.error('[ComplianceSummaryReport] Error setting up scan status subscription:', error);
    }
  };

  // Subscribe to assessment results updates.
  const subscribeToResults = () => {
    setResultsStatus('processing');
    const subscriptionName = 'onUpdateReportHistoryAssessmentResults';
    console.log('[ComplianceSummaryReport] Setting up assessment results subscription:', {
      subscriptionName,
      userId,
      scanIdConst,
      reportId,
    });
    try {
      const subscription = client
        .graphql({
          query: onUpdateReportHistoryAssessmentResults,
          variables: { userId },
        })
        .subscribe({
          next: async (value) => {
            console.log('[ComplianceSummaryReport] Assessment results subscription received data:', {
              subscriptionName,
              rawValue: value,
              data: value?.data,
            });
            const subData = value.data.onUpdateReportHistoryAssessmentResults;
            console.log('[ComplianceSummaryReport] Subscription data parsed:', {
              receivedScanId: subData?.scanId,
              expectedScanId: scanIdConst,
              scanIdMatch: subData?.scanId === scanIdConst,
              hasResultsUrl: !!subData?.assessmentResultsUrl,
              assessmentResultsUrl: subData?.assessmentResultsUrl,
            });
            if (
              subData.scanId === scanIdConst &&
              subData.assessmentResultsUrl
            ) {
              console.log('[ComplianceSummaryReport] Scan ID matched! Processing results...');
              setMessages((prev) => [
                ...prev,
                {
                  message: `Processing scan results complete: Scan ID ${subData.scanId}`,
                },
              ]);
              // Now retrieve the full assessment content
              // Set resultsStatus to 'done' AFTER getAssessmentContent completes successfully
              try {
                await getAssessmentContent(scanIdConst);
                setResultsStatus('done');
                // Refresh reportHistory before ingesting recommendations.
                let reportHistory = userProfile?.reportHistory || [];
                try {
                  const result = await dispatch(refreshAccountScans()).unwrap();
                  reportHistory = result;
                } catch (refreshError) {
                  console.error('[ComplianceSummaryReport] Error refreshing reportHistory, using existing data:', refreshError);
                  // Continue with existing reportHistory if refresh fails
                }
                
                // Refresh recommendations after scan results are processed.
                if (reportHistory && reportHistory.length > 0) {
                  dispatch(
                    refreshRecommendationsFromScans({ refreshBlueprints: false })
                  ).catch((error) => {
                    console.error('[ComplianceSummaryReport] Error ingesting scanner recommendations:', error);
                  });
                }
              } catch (error) {
                console.error('Error loading assessment content:', error);
                setResultsStatus('error');
              }
            } else {
              console.log('[ComplianceSummaryReport] Scan ID did not match or no results URL, ignoring update:', {
                receivedScanId: subData?.scanId,
                expectedScanId: scanIdConst,
                hasResultsUrl: !!subData?.assessmentResultsUrl,
              });
            }
          },
          error: (error) => {
            console.error(
              '[ComplianceSummaryReport] Assessment results subscription error:',
              error
            );
          },
        });
      resultsSubscriptionRef.current = subscription;
      console.log('[ComplianceSummaryReport] Assessment results subscription set up successfully');
    } catch (error) {
      console.error(
        '[ComplianceSummaryReport] Error setting up assessment results subscription:',
        error
      );
    }
  };

  // Scan initiation is now handled by parent component (Report.jsx)
  // Removed handleScan and handleRunAssessment functions

  const StatusBadge = ({ status }) => {
    return (
      <span
        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
          status === 'passed' || status === 'Passed'
            ? 'bg-green-100 text-green-800'
            : status === 'failed' || status === 'Failed'
              ? 'bg-red-100 text-red-800'
              : 'bg-gray-100 text-gray-800'
        }`}
      >
        {status}
      </span>
    );
  };

  // Handle search input for a specific service
  const handleSearch = (service, value) => {
    setSearchQueries((prev) => ({
      ...prev,
      [service]: value,
    }));
    // Reset page when searching
    setActivePages((prev) => ({
      ...prev,
      [service]: 1,
    }));
  };

  // Handle page change for a specific service
  const changePage = (service, page) => {
    setActivePages((prev) => ({
      ...prev,
      [service]: page,
    }));
  };

  const handleExportPDF = async () => {
    try {
      const blob = await pdf(
        <CompliancePDFDocument complianceResults={complianceResults} />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `compliance-report-${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  // Determine what to show:
  // 1. If loading results (fetching from API) - show loading spinner
  // 2. If scan is in progress or results are processing - show scan progress UI
  // 3. If results are ready - show results
  // 4. If resultsStatus is 'done' but results are empty, show error/empty state instead of reverting to scan progress
  const showLoadingSpinner = loading;
  // Only show scan progress if:
  // - resultsStatus is not 'done' (scan still in progress), OR
  // - resultsStatus is 'done' but we haven't set complianceResults yet (still processing)
  // BUT don't show scan progress if resultsStatus is 'done' and we've already processed results (even if empty)
  const hasProcessedResults = resultsStatus === 'done' && complianceResults !== null && complianceResults !== undefined;
  // Check if results exist and have data (for ComplianceSummaryReport, results is an object with keys)
  const hasResults = complianceResults && typeof complianceResults === 'object' && Object.keys(complianceResults).length > 0;
  const showScanProgress = resultsStatus !== 'done' && !loading && !hasProcessedResults;
  const showResults = hasResults && resultsStatus === 'done' && !loading;
  const showEmptyResults = resultsStatus === 'done' && hasProcessedResults && !hasResults && !loading;

  // Get selected workload's tracked resources
  const selectedWorkload = useMemo(() => {
    if (!selectedWorkloadId || !workloads || workloads.length === 0) {
      return null;
    }
    return workloads.find((w) => w.workloadId === selectedWorkloadId);
  }, [selectedWorkloadId, workloads]);

  // Extract tracked resource IDs and ARNs from selected workload
  const trackedResourceIds = useMemo(() => {
    if (!selectedWorkload) {
      return new Set();
    }
    
    let trackedResourcesObj = selectedWorkload.trackedResources;
    if (typeof trackedResourcesObj === 'string') {
      try {
        trackedResourcesObj = JSON.parse(trackedResourcesObj);
      } catch (error) {
        console.error('Failed to parse trackedResources:', error);
        return new Set();
      }
    }
    
    if (!trackedResourcesObj?.resources || !Array.isArray(trackedResourcesObj.resources)) {
      return new Set();
    }
    
    const ids = new Set();
    trackedResourcesObj.resources.forEach((resource) => {
      if (resource.resourceId) {
        ids.add(resource.resourceId);
      }
      if (resource.resourceArn) {
        ids.add(resource.resourceArn);
      }
    });
    
    return ids;
  }, [selectedWorkload]);

  // Filter compliance results based on hideNotApplicable toggle and workload selection
  const getFilteredComplianceResults = () => {
    if (!complianceResults || Object.keys(complianceResults).length === 0) {
      return complianceResults;
    }

    const filtered = {};
    const hasWorkloadFilter = selectedWorkloadId && trackedResourceIds.size > 0;
    
    Object.keys(complianceResults).forEach((group) => {
      const groupData = complianceResults[group];
      const filteredChecks = {};
      
      // Filter resources if workload is selected
      let filteredResources = groupData.resources || [];
      if (hasWorkloadFilter) {
        filteredResources = filteredResources.filter((resource) => {
          return (
            (resource.resourceId && trackedResourceIds.has(resource.resourceId)) ||
            (resource.resourceArn && trackedResourceIds.has(resource.resourceArn))
          );
        });
      }
      
      // Create a Set of displayNames from filtered resources for quick lookup
      const allowedDisplayNames = new Set(filteredResources.map((r) => r.displayName));
      
      // Filter features
      Object.keys(groupData.checks || {}).forEach((feature) => {
        const check = groupData.checks[feature];
        const originalPassed = check.passed || [];
        const originalFailed = check.failed || [];
        
        // Filter passed/failed arrays based on workload if selected
        // This only filters the arrays, doesn't remove the feature
        let passed = originalPassed;
        let failed = originalFailed;
        if (hasWorkloadFilter) {
          passed = passed.filter((displayName) => allowedDisplayNames.has(displayName));
          failed = failed.filter((displayName) => allowedDisplayNames.has(displayName));
        }
        
        // Apply hideNotApplicable filter based on FILTERED counts (after workload filtering if applicable)
        // When workload is selected, check filtered counts; when "all workloads", check original counts
        const passedCount = passed.length;
        const failedCount = failed.length;
        
        if (hideNotApplicable && passedCount === 0 && failedCount === 0) {
          return; // Skip this feature when hideNotApplicable is enabled and counts are 0 (after workload filtering if applicable)
        }
        
        // Always include the feature (workload filter only filters the arrays, doesn't remove the feature)
        filteredChecks[feature] = {
          ...check,
          passed,
          failed,
        };
      });
      
      // Only include groups that have at least one visible feature
      if (Object.keys(filteredChecks).length > 0) {
        filtered[group] = {
          ...groupData,
          checks: filteredChecks,
          resources: filteredResources,
        };
      }
    });
    
    return filtered;
  };

  const filteredComplianceResults = getFilteredComplianceResults();

  return (
    <div className={`bg-white rounded-lg ${compact ? '' : 'shadow-sm'}`}>
      {showLoadingSpinner && (
        <div className="flex justify-center items-center p-6 flex-col">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
          <div>loading report results...</div>
        </div>
      )}

      {showScanProgress && (
        <>
          <Card>
            <CardContent>
              {/* Overall scan progress display */}
              {overallScanStatus && (
                <div className="mb-4 flex flex-col space-y-2">
                  <div className="flex items-center space-x-2 mt-5">
                    {overallScanStatus === 'in progress' ? (
                      <>
                        <div className="spinner w-4 h-4 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin"></div>
                        <span>Scan in progress</span>
                      </>
                    ) : overallScanStatus === 'done' ? (
                      <span>Scan Done ✅</span>
                    ) : null}
                  </div>
                </div>
              )}
              <ul className="list-disc pl-5 mt-5">
                {/* {Object.keys(parentServiceStatus || {}).length === 0 && (
                  <li>No updates yet.</li>
                )} */}
                {Object.entries(parentServiceStatus || {}).map(([service, status]) => (
                  <li key={service} className="flex items-center space-x-2">
                    <span className="font-bold">{service}:</span>
                    {status === 'started' ? (
                      <>
                        <div className="spinner w-4 h-4 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin"></div>
                        <span>Collecting resource details...</span>
                      </>
                    ) : status === 'done' ? (
                      <span>✅ Done</span>
                    ) : (
                      <span>{status}</span>
                    )}
                  </li>
                ))}
              </ul>
              {overallScanStatus &&
                overallScanStatus === 'done' &&
                resultsStatus && (
                  <div className="flex items-center space-x-2">
                    {resultsStatus === 'processing' ? (
                      <>
                        <div className="spinner w-4 h-4 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin"></div>
                        <span>Processing scan results...</span>
                      </>
                    ) : resultsStatus === 'done' ? (
                      <span>Processing scan results: ✅ Done</span>
                    ) : null}
                  </div>
                )}
            </CardContent>
          </Card>
        </>
      )}

      {showEmptyResults && (
        <div className="flex justify-center items-center p-6 flex-col">
          <p className="text-gray-600 mb-2">No results found for this scan.</p>
          <p className="text-sm text-gray-500">The scan completed successfully but no matching results were found based on the report rules.</p>
          <p className="text-xs text-gray-400 mt-2">Check console logs for details about rules and scan results.</p>
        </div>
      )}

      {showResults && (
            <>
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <h1 className="text-xl font-semibold text-gray-800">
                      Summary{effectiveAccountId ? ` (${effectiveAccountId})` : ''}
                    </h1>
                    {associatedWorkloads.length > 0 && (
                      <Select value={selectedWorkloadId || 'all'} onValueChange={(value) => setSelectedWorkloadId(value === 'all' ? '' : value)}>
                        <SelectTrigger className="w-[250px]">
                          <SelectValue placeholder="Select workload" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All workloads</SelectItem>
                          {associatedWorkloads.map((workload) => (
                            <SelectItem key={workload.workloadId} value={workload.workloadId}>
                              {workload.workloadName || workload.workloadId}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="hide-not-applicable"
                        checked={hideNotApplicable}
                        onCheckedChange={setHideNotApplicable}
                        className="data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600"
                      />
                      <Label
                        htmlFor="hide-not-applicable"
                        className="text-sm text-gray-700 cursor-pointer"
                      >
                        Hide not applicable
                      </Label>
                    </div>
                    <button
                      onClick={handleExportPDF}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4">
                <ReportScanSummary
                  summary={scanRecord?.summary}
                  className="mb-4"
                />
                <div className="overflow-hidden border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4"
                        >
                          AWS Service
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/4"
                        >
                          Feature
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8"
                        >
                          Pass
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8"
                        >
                          Fail
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Object.keys(filteredComplianceResults)?.map((group) => {
                        const visibleFeatures = Object.keys(filteredComplianceResults[group]['checks']);
                        return (
                          <React.Fragment key={group}>
                            {visibleFeatures.map(
                              (feature, featureIdx) => {
                                const isFirstFeature = featureIdx === 0;
                                const bgColor =
                                  filteredComplianceResults[group]['checks'][feature]
                                    .failed.length > 0
                                    ? 'bg-red-50'
                                    : filteredComplianceResults[group]['checks'][feature]
                                          .passed.length > 0
                                      ? 'bg-green-50'
                                      : '';
                                return (
                                  <tr key={`${group}-${feature}`}>
                                    {isFirstFeature ? (
                                      <td
                                        className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                                        rowSpan={visibleFeatures.length}
                                      >
                                        {renderReportValue(filteredComplianceResults[group]['title'], {
                                          section: 'summary-table',
                                          group,
                                          field: 'title',
                                        })}
                                      </td>
                                    ) : null}

                                    <td
                                      className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${bgColor}`}
                                    >
                                      {renderReportValue(feature, {
                                        section: 'summary-table',
                                        group,
                                        field: 'feature',
                                      })}
                                    </td>

                                    <td
                                      className={`px-6 py-4 whitespace-nowrap text-sm text-right ${bgColor}`}
                                    >
                                      <span
                                        className={
                                          filteredComplianceResults[group]['checks'][
                                            feature
                                          ].passed.length > 0
                                            ? 'text-green-600 font-medium'
                                            : 'text-gray-500'
                                        }
                                      >
                                        {
                                          filteredComplianceResults[group]['checks'][
                                            feature
                                          ].passed.length
                                        }
                                      </span>
                                    </td>

                                    <td
                                      className={`px-6 py-4 whitespace-nowrap text-sm text-right ${bgColor}`}
                                    >
                                      <span
                                        className={
                                          filteredComplianceResults[group]['checks'][
                                            feature
                                          ].failed.length > 0
                                            ? 'text-red-600 font-medium'
                                            : 'text-gray-500'
                                        }
                                      >
                                        {
                                          filteredComplianceResults[group]['checks'][
                                            feature
                                          ].failed.length
                                        }
                                      </span>
                                    </td>
                                  </tr>
                                );
                              }
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {Object.keys(filteredComplianceResults).map((group, groupIdx) => (
                <div key={`details-${groupIdx}`} className="px-6 mb-8 mt-8">
                  <div className="border border-gray-200 rounded-lg"></div>
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 rounded-t-lg">
                    <div className="flex justify-between items-center">
                      <h2 className="text-base font-medium text-gray-800">
                        Resource Details: {filteredComplianceResults[group].title}
                      </h2>
                      <div className="w-64">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                          <Input
                            placeholder="Search..."
                            className="pl-8 h-8 text-sm"
                            value={searchQueries[group] || ''}
                            onChange={(e) =>
                              handleSearch(group, e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr className="bg-gray-50">
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Resource
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Region
                          </th>
                          {Object.keys(filteredComplianceResults[group]['checks'])?.map(
                            (column, idx) => (
                              <th
                                key={idx}
                                scope="col"
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                             >
                                {renderReportValue(column, {
                                  section: 'resource-details-header',
                                  group,
                                  field: 'column',
                                })}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredComplianceResults[group].resources
                          ?.filter((row) => {
                            const searchQuery = searchQueries[group];
                            if (!searchQuery) return true;
                            return Object.values(row).some((val) =>
                              String(val)
                                .toLowerCase()
                                .includes(searchQuery.toLowerCase())
                            );
                          })
                          .map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                <span className="text-gray-800">
                                  {renderReportValue(row['displayName'], {
                                    section: 'resource-details',
                                    group,
                                    rowIndex: idx,
                                    field: 'displayName',
                                    row,
                                  })}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                <span className="text-gray-800">
                                  {renderReportValue(row['region'], {
                                    section: 'resource-details',
                                    group,
                                    rowIndex: idx,
                                    field: 'region',
                                    row,
                                  })}
                                </span>
                              </td>

                              {Object.keys(
                                filteredComplianceResults[group]['checks']
                              ).map((rule, ruleIdx) => (
                                <td
                                  key={ruleIdx}
                                  className="px-4 py-3 whitespace-nowrap text-sm"
                                >
                                  {/* {results[group]['checks'][rule].passed.includes(
                                 row['displayName']
                               )
                                 ? 'x'
                                 : 'y'} */}
                                  <StatusBadge
                                    status={
                                      filteredComplianceResults[group]['checks'][
                                        rule
                                      ].passed.includes(row['displayName'])
                                        ? 'passed'
                                        : filteredComplianceResults[group]['checks'][
                                              rule
                                            ].failed.includes(
                                              row['displayName']
                                            )
                                          ? 'failed'
                                          : '—'
                                    }
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                      </tbody>
                    </table>

                    {filteredComplianceResults[group].resources &&
                      filteredComplianceResults[group].resources.length > 10 && (
                        <div className="flex items-center justify-center py-3 bg-white border-t border-gray-200">
                          <nav className="flex items-center space-x-1">
                            <button
                              className="h-8 w-8 p-0 flex items-center justify-center rounded bg-white text-gray-500 disabled:opacity-50"
                              disabled={
                                !activePages[group] || activePages[group] === 1
                              }
                              onClick={() => changePage(group, 1)}
                            >
                              <span className="sr-only">First</span>
                              <ChevronLeft className="h-4 w-4" />
                              <ChevronLeft className="h-4 w-4 -ml-2" />
                            </button>

                            <button className="h-8 w-8 p-0 flex items-center justify-center rounded bg-blue-50 text-blue-600 font-medium">
                              1
                            </button>

                            <button className="h-8 w-8 p-0 flex items-center justify-center rounded text-gray-700">
                              2
                            </button>

                            <button
                              className="h-8 w-8 p-0 flex items-center justify-center rounded bg-white text-gray-500"
                              onClick={() =>
                                changePage(group, activePages[group] + 1)
                              }
                            >
                              <span className="sr-only">Next</span>
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </nav>
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </>
          )}
    </div>
  );
}

export default ComplianceSummaryReport;
