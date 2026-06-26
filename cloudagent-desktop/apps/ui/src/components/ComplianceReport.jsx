import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { generateClient } from 'aws-amplify/api';
import {
  onUpdateReportHistoryAssessmentResults,
  onUpdateReportHistoryStatus,
  queryGetLatestReportHistoryAssessmentResult,
} from '../api/eventQueries';
// Scan initiation moved to parent component (Report.jsx)

import { processComplianceReport } from '../helpers/report_compliance';
import {
  buildReportDefinitionUrl,
  getReportIdCandidates,
} from '../helpers/reportId';
import { findAccountScan } from '../helpers/accountScans';

import { useSelector, useDispatch } from 'react-redux';
import SimplifiedComplianceDetails from './SimplifiedComplianceDetails';
import { refreshAccountScans } from '../features/auth/authSlice';
import { refreshRecommendationsFromScans } from '../features/operations/operationsSlice';

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

function ComplianceReport({
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
  // connectionId is now passed from parent (Report.jsx) - no longer managed here
  // serviceStatus is now passed from parent (Report.jsx) - WebSocket updates come from parent
  const [messages, setMessages] = useState([]);
  const [overallScanStatus, setOverallScanStatus] = useState(''); // "", "in progress", or "done"
  const [resultsStatus, setResultsStatus] = useState(''); // "", "processing", or "done"
  const [complianceResults, setComplianceResults] = useState(null);
  const [hasStartedScan, setHasStartedScan] = useState(false);
  const { userProfile } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const userId = userProfile?.userId;
  const subscriptionRef = useRef(null);
  const resultsSubscriptionRef = useRef(null);
  const [loading, setLoading] = useState(() => !embeddedView);
  const [hasFetchedReportDef, setHasFetchedReportDef] = useState(false);
  const [controls, setControls] = useState({});
  const [tags, setTags] = useState([]);
  const [reportTitle, setReportTitle] = useState(title || '');
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
        ? (embeddedData.complianceResults || embeddedData.results || embeddedData)
        : null;
      const hasStructuredResults = !!candidate
        && typeof candidate === 'object'
        && Array.isArray(candidate.results)
        && candidate.controls
        && typeof candidate.controls === 'object';

      if (hasStructuredResults) {
        if (!cancelled) {
          setComplianceResults({
            ...candidate,
            title: candidate.title || reportTitle || title || 'Compliance Report',
          });
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
          console.warn('[ComplianceReport] Unable to resolve latest embedded results URL from scanId:', fallbackScanId, error);
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
        const tagsToUse = Array.isArray(reportDef?.tags) ? reportDef.tags : [];
        const controlsToUse = reportDef?.controls && typeof reportDef.controls === 'object'
          ? reportDef.controls
          : {};
        console.log('YYYYYYY controlsToUse', controlsToUse);
        const results = processComplianceReport(scanResults, tagsToUse);
        const nextComplianceResults = {
          title: reportDef?.title || reportTitle || title || 'Compliance Report',
          type: 'compliance-report',
          results,
          controls: controlsToUse,
        };

        for (const control of Object.keys(nextComplianceResults.controls || {})) {
          const controlRules = nextComplianceResults.controls?.[control]?.rules || [];
          nextComplianceResults.controls[control].results = [];
          for (const ruleId of controlRules) {
            nextComplianceResults.controls[control].results =
              nextComplianceResults.controls[control].results.concat(
                nextComplianceResults.results.filter((result) => result.id === ruleId)
              );
          }
        }

        if (!cancelled) {
          setComplianceResults(nextComplianceResults);
          setHasFetchedReportDef(true);
          setOverallScanStatus('done');
          setResultsStatus('done');
          setLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[ComplianceReport] Embedded hydration failed:', error);
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
  }, [effectiveScanId, embeddedData, embeddedView, reportId, reportTitle, title]);

  useEffect(() => {
    if (embeddedView) return;

    const fetchReportDef = async () => {
      if (reportId) {
        const { data } = await fetchReportDefinition(reportId);
        const { tags, controls, title: reportDefTitle } = data;
        setTags(tags);
        setControls(controls);
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
      let scanResults = {};

      const res = await fetch(url);
      const content = await res.json();
      // Merge the content into scanResults under the service key.
      scanResults = content;

      // Ensure tags and controls are loaded before processing
      // This can happen when scan completes before report definition is fetched
      let tagsToUse = tags;
      let controlsToUse = controls;
      
      if ( !controlsToUse || Object.keys(controlsToUse).length === 0) {
        console.warn('Tags or controls not loaded yet, fetching report definition...', { reportId, hasFetchedReportDef, tagsLength: tagsToUse?.length, controlsKeys: Object.keys(controlsToUse || {}) });
        if (reportId) {
          try {
            const { data, reportId: resolvedReportId } = await fetchReportDefinition(reportId);
            const { tags: reportTags, controls: reportControls, title: reportDefTitle } = data;
            if ( reportControls && Object.keys(reportControls).length > 0) {
              // Update state for future use
              setTags(reportTags);
              setControls(reportControls);
              if (reportDefTitle && !title) {
                setReportTitle(reportDefTitle);
              }
              tagsToUse = reportTags;
              controlsToUse = reportControls;
            } else {
              console.error('Report definition fetched but tags or controls are empty', {
                reportId: resolvedReportId,
                data,
              });
            }
          } catch (error) {
            console.error('Error fetching report definition:', error);
            throw new Error(`Failed to load report definition: ${error.message}`);
          }
        } else {
          console.error('Cannot fetch tags/controls: reportId is missing');
          throw new Error('Report ID is missing. Cannot process results.');
        }
      }

      if (!controlsToUse || Object.keys(controlsToUse).length === 0) {
        console.error('Cannot process results: tags or controls are not available', { reportId, hasFetchedReportDef, tagsLength: tagsToUse?.length, controlsKeys: Object.keys(controlsToUse || {}) });
        throw new Error('Report tags or controls not available. Please try reloading the page.');
      }
      
      const results = processComplianceReport(scanResults, tagsToUse);
      console.log('YYYYYYY controlsToUse', controlsToUse);
      const complianceResults = {
        title: reportTitle || title || 'Compliance Report', // Use reportTitle instead of hardcoded 'SOC2'
        type: 'compliance-report',
        results: results,
        controls: controlsToUse,
      };

      for (const control of Object.keys(complianceResults.controls)) {
        const { rules } = complianceResults.controls[control];
        complianceResults.controls[control].results = [];
        for (const ruleId of rules) {
          complianceResults.controls[control].results =
            complianceResults.controls[control].results.concat(
              complianceResults.results.filter((result) => result.id === ruleId)
            );
        }
      }

      setComplianceResults(complianceResults);
      setLoading(false);

      return complianceResults;
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
    if (
      effectiveScanId && 
      hasFetchedReportDef && 
      !hasStartedScan && 
      overallScanStatus !== 'in progress' &&
      scanInitiated !== true && // Not true (can be false or undefined) - don't load if new scan is being initiated
      !connectionId // Don't load results if a scan is in progress
    ) {
      getAssessmentContent(effectiveScanId);
      setResultsStatus('done');
    } else if (scanInitiated === true) {
    } else {
    }
  }, [embeddedView, scanId, hasFetchedReportDef, hasStartedScan, overallScanStatus, scanInitiated, connectionId]);

  // Subscribe to scan completion updates.
  const subscribeToScanStatus = () => {
    const subscriptionName = 'onUpdateReportHistoryStatus';
    console.log('[ComplianceReport] Setting up scan status subscription:', {
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
            console.log('[ComplianceReport] Scan status subscription received data:', {
              subscriptionName,
              rawValue: value,
              data: value?.data,
            });
            const subData = value.data.onUpdateReportHistoryStatus;
            console.log('[ComplianceReport] Scan status subscription parsed:', {
              subscriptionName,
              receivedScanId: subData?.scanId,
              expectedScanId: scanIdConst,
              scanIdMatch: subData?.scanId === scanIdConst,
              status: subData?.status,
            });
            if (subData.scanId === scanIdConst) {
              console.log('[ComplianceReport] Scan status subscription - Scan ID matched! Status:', subData.status);
              setOverallScanStatus('done');
              setMessages((prev) => [
                ...prev,
                {
                  message: `Scan completed: Scan ID ${subData.scanId} - ${subData.status}`,
                },
              ]);
              // Start subscription for assessment results if not already started
              if (!resultsSubscriptionRef.current) {
                console.log('[ComplianceReport] Starting subscribeToResults...');
                subscribeToResults();
              } else {
                console.log('[ComplianceReport] resultsSubscriptionRef already exists, not starting new subscription');
              }
            } else {
              console.log('[ComplianceReport] Scan status subscription - Scan ID did not match, ignoring');
            }
          },
          error: (error) => {
            console.error('[ComplianceReport] Scan status subscription error:', error);
          },
        });
      subscriptionRef.current = subscription;
      console.log('[ComplianceReport] Scan status subscription set up successfully');
    } catch (error) {
      console.error('[ComplianceReport] Error setting up scan status subscription:', error);
    }
  };

  // Subscribe to assessment results updates.
  const subscribeToResults = () => {
    setResultsStatus('processing');
    const subscriptionName = 'onUpdateReportHistoryAssessmentResults';
    console.log('[ComplianceReport] Setting up assessment results subscription:', {
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
            console.log('[ComplianceReport] Assessment results subscription received data:', {
              subscriptionName,
              rawValue: value,
              data: value?.data,
            });
            const subData = value.data.onUpdateReportHistoryAssessmentResults;
            console.log('[ComplianceReport] Subscription data parsed:', {
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
              console.log('[ComplianceReport] Scan ID matched! Processing results...');
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
                  console.error('[ComplianceReport] Error refreshing reportHistory, using existing data:', refreshError);
                  // Continue with existing reportHistory if refresh fails
                }
                
                // Refresh recommendations after scan results are processed.
                if (reportHistory && reportHistory.length > 0) {
                  dispatch(
                    refreshRecommendationsFromScans({ refreshBlueprints: false })
                  ).catch((error) => {
                    console.error('[ComplianceReport] Error ingesting scanner recommendations:', error);
                  });
                }
              } catch (error) {
                console.error('Error loading assessment content:', error);
                setResultsStatus('error');
              }
            } else {
              console.log('[ComplianceReport] Scan ID did not match or no results URL, ignoring update:', {
                receivedScanId: subData?.scanId,
                expectedScanId: scanIdConst,
                hasResultsUrl: !!subData?.assessmentResultsUrl,
              });
            }
          },
          error: (error) => {
            console.error(
              '[ComplianceReport] Assessment results subscription error:',
              error
            );
          },
        });
      resultsSubscriptionRef.current = subscription;
      console.log('[ComplianceReport] Assessment results subscription set up successfully');
    } catch (error) {
      console.error(
        '[ComplianceReport] Error setting up assessment results subscription:',
        error
      );
    }
  };

  // Trigger the scan using initiateAssessmentScan.
  // Scan initiation is now handled by parent component (Report.jsx)
  // Removed handleScan, handleRunAssessment, and handleDisconnect functions

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
  const hasResults = complianceResults && complianceResults.results && Array.isArray(complianceResults.results) && complianceResults.results.length > 0;
  const showScanProgress = resultsStatus !== 'done' && !loading && !hasProcessedResults;
  const showResults = hasResults && resultsStatus === 'done' && !loading;
  const showEmptyResults = resultsStatus === 'done' && hasProcessedResults && !hasResults && !loading;

  return (
    <div className={compact ? 'p-2' : 'p-4'}>
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
              {overallScanStatus === 'done' && resultsStatus && (
                <div className="flex items-center space-x-2 mt-4">
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
          <p className="text-xs text-gray-400 mt-2">Check console logs for details about tags, controls, and scan results.</p>
        </div>
      )}

      {showResults && (
        <SimplifiedComplianceDetails 
          results={complianceResults} 
          accountId={effectiveAccountId}
          authProfile={authProfile}
          scanSummary={scanRecord?.summary}
        />
      )}

      <style jsx>{`
        .spinner {
          border: 2px solid rgba(0, 0, 0, 0.1);
          border-top-color: rgba(0, 0, 0, 0.8);
          border-radius: 50%;
          width: 16px;
          height: 16px;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default ComplianceReport;
