import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Bot, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import Markdown from 'markdown-to-jsx';
import get from 'lodash.get';
import '@fontsource-variable/roboto-mono';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  getAgentConnection,
  refreshUserCredits,
  setIsRegionModalOpen,
} from '../../features/agent/agentSlice';
import { useDispatch, useSelector } from 'react-redux';
import { generateRandomString } from '../../helpers/shared';
import { buildReportRoute, findAccountScan } from '../../helpers/accountScans';
import { toLogObject } from '../../helpers/logUtils';
import {
  buildReportDefinitionUrl,
  normalizeReportId,
} from '../../helpers/reportId';
import { initiateAssessment } from '../../api/assessments';
import { refreshAccountScans } from '../../features/auth/authSlice';
import {
  failReportOperation,
  selectScannerUpdatesConnectionId,
  trackReportOperation,
} from '../../features/operations/operationsSlice';
import { SCAN_UPDATES_WEBSOCKET_ENDPOINT, IS_PUBLIC_SITE } from '../../config/appConfig';
import toast from 'react-hot-toast';

import ComplianceReport from '../../components/ComplianceReport';
import ComplianceSummaryReport from '../../components/ComplianceSummaryReport';
import { PermissionsModal } from '../Libraries/PermissionsModal';
import { SettingsSummary } from '../Agent/Agent';
import { analytics, ANALYTICS_EVENTS, getAnalyticsRoute } from '../../hooks/useAnalytics';
import { isLocalRuntime } from '../../runtime/cloudAgentRuntime';

const parseRecommendationAuthProfile = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }
  if (typeof value === 'object') {
    return value;
  }
  return null;
};

const ONGOING_REPORT_STATUS_SET = new Set([
  'running',
  'in_progress',
  'started',
  'processing',
  'pending',
]);

const normalizeStatusToken = (value) =>
  String(value || '').trim().toLowerCase().replace(/\s+/g, '_');

const toArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (_) {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
};

const resolveReportDefinitionId = (taskReportId, fallbackPlanId = null) => {
  const rawTaskReportId = String(taskReportId || '').trim();
  if (rawTaskReportId) return normalizeReportId(rawTaskReportId);
  return normalizeReportId(fallbackPlanId);
};

const normalizeExecutionCredits = (value, fallback = 1) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getAvailableCredits = (userProfile = {}) =>
  Number(userProfile?.agentCredits?.monthlyBaseCredits || 0) +
  Number(userProfile?.agentCredits?.adhocCredits || 0);

const buildAzureAssessmentConfig = ({ authProfile = {}, services = [], regions = [] }) => {
  const azureRegions = Array.isArray(regions) && regions.length > 0 ? regions : ['all'];
  const tenantId =
    authProfile.tenantId ||
    authProfile.azureTenantId ||
    authProfile.directoryTenantId ||
    authProfile.accountId ||
    '';
  const tenantType =
    authProfile.tenantType ||
    authProfile.azureTenantType ||
    (['m365', 'entra'].includes(authProfile.provider) ? authProfile.provider : 'azure');
  const subscriptionIds =
    toArray(authProfile.subscriptionIds).length > 0
      ? toArray(authProfile.subscriptionIds)
      : toArray(authProfile.azureSubscriptionIds).length > 0
        ? toArray(authProfile.azureSubscriptionIds)
        : Array.isArray(authProfile.subscriptions)
          ? authProfile.subscriptions
              .map((subscription) => subscription?.subscriptionId || subscription?.id)
              .filter(Boolean)
          : tenantType === 'm365' || tenantType === 'entra'
            ? [tenantType]
            : [];
  const authDetails = authProfile.authDetails || (
    authProfile.clientId && authProfile.clientSecret
      ? {
          all: {
            clientId: authProfile.clientId,
            clientSecret: authProfile.clientSecret,
          },
        }
      : {}
  );

  return {
    tenantId,
    subscriptionIds,
    authDetails,
    services,
    regions: azureRegions,
    tenantType,
    tenantEnvironment: authProfile.tenantEnvironment || authProfile.azureEnvironment || 'public',
  };
};

export default function ReportPage() {
  const { scanId: scanIdParam } = useParams();
  const recordId = scanIdParam; // For backward compatibility during migration
  const location = useLocation();
  const dispatch = useDispatch();
  const settingsUpdatedRef = useRef(false);

  const { shouldAutocontinue, readyToRun: navReadyToRun } = location.state || {};

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [agentData, setAgentData] = useState(null);
  const [runAssessment, setRunAssessment] = useState(false);
  const [activeView] = useState('columns');
  
  // Centralized scan initiation state
  const [scanConnectionId, setScanConnectionId] = useState(null);
  const [scanInitiated, setScanInitiated] = useState(false); // false = existing scan, true = new scan being initiated
  const [serviceStatus, setServiceStatus] = useState({}); // Track service status updates from WebSocket
  const [activeReportScanId, setActiveReportScanId] = useState(() =>
    String(location.state?.scanId || '').trim()
  );
  const wsRef = useRef(null);
  const scanInitiatedRef = useRef(false);
  const activeReportScanIdRef = useRef(String(location.state?.scanId || '').trim());
  const readyToRunHandledRef = useRef(false);
  const agentDataFetchedRef = useRef(false); // Track if agentData has been fetched to prevent re-fetching on accountScans updates
  const navigate = useNavigate();
  const { autoplay, isRegionModalOpen } = useSelector((state) => state.agent);
  const { userProfile, userProfileLoading } = useSelector((state) => state.auth);
  const scannerUpdatesConnectionId = useSelector(selectScannerUpdatesConnectionId);

  const defaultAuthProfile = {
    validated: false,
    authType: 'role',
    roleName: `CloudAgentAccessRole-${generateRandomString(6)}`,
    externalId: generateRandomString(6),
    accessKeyId: '',
    secretAccessKey: '',
    sessionToken: '',
    authProfileName: '',
  };

  const [state, setState] = useState({
    plan: [],
    currentPhase: -1,
    currentTask: -1,
    autoContinue: false,
    showTerminal: true,
    queries: [],
    answers: [],
    loading: false,
    actions: [],
    followupPrompt: '',
    showConfigurationPlan: true,
    deploymentMethod: '',
    currentAction: '',
    isPermissionsModalOpen: navReadyToRun ? false : true,
    accountId: navReadyToRun ? (location.state?.accountId || '') : '',
    authProfile: navReadyToRun && location.state?.authProfile
      ? { ...defaultAuthProfile, ...location.state.authProfile, validated: true }
      : defaultAuthProfile,
    globalSettings: navReadyToRun && location.state?.globalSettings
      ? location.state.globalSettings
      : {},
    prefillPermissionProfileId: null,
    prefillPermissionProfileName: null,
  });

  const recommendationContext = location.state?.fromRecommendation || null;

  const reportRunCancelDestination = useMemo(() => {
    if (location.state?.returnTo) return location.state.returnTo;
    const pid = location.state?.planId || agentData?.planId;
    if (location.pathname.startsWith('/dashboard/reports')) {
      return '/dashboard/reports/library';
    }
    return pid ? `/library/report/${pid}` : (IS_PUBLIC_SITE ? '/libraries' : '/dashboard/reports');
  }, [
    agentData?.planId,
    location.pathname,
    location.state?.planId,
    location.state?.returnTo,
  ]);
  const [
    hasAppliedRecommendationContext,
    setHasAppliedRecommendationContext,
  ] = useState(false);

  useEffect(() => {
    if (recommendationContext) {
      setHasAppliedRecommendationContext(false);
    }
  }, [recommendationContext]);
  const {
    plan,
    currentPhase,
    currentTask,
    authProfile,
    isPermissionsModalOpen,
    globalSettings,
  } = state;
  const requestedReportId = useMemo(() => {
    const searchParams = new URLSearchParams(location.search || '');
    return searchParams.get('reportId') || location.state?.reportId || null;
  }, [location.search, location.state?.reportId]);

  const setStableActiveReportScanId = useCallback((value) => {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    activeReportScanIdRef.current = normalized;
    setActiveReportScanId(normalized);
    return normalized;
  }, []);

  useEffect(() => {
    const stateScanId = String(location.state?.scanId || '').trim();
    if (stateScanId && stateScanId !== activeReportScanIdRef.current) {
      setStableActiveReportScanId(stateScanId);
    }
  }, [location.state?.scanId, setStableActiveReportScanId]);

  const effectiveScanId =
    activeReportScanId ||
    location.state?.scanId ||
    agentData?.scanId ||
    (scanIdParam !== 'new' ? scanIdParam : null) ||
    null;
  const scanRecord = useMemo(() => {
    if (!effectiveScanId) return null;
    return findAccountScan(userProfile?.reportHistory || [], {
      scanId: effectiveScanId,
      reportId: requestedReportId,
    });
  }, [effectiveScanId, requestedReportId, userProfile?.reportHistory]);
  const effectiveReportId = useMemo(() => {
    const taskReportId = plan?.[currentPhase]?.tasks?.[currentTask]?.reportId;
    return resolveReportDefinitionId(taskReportId, agentData?.planId);
  }, [agentData?.planId, currentPhase, currentTask, plan]);
  const resolvedPermissionProfileId =
    scanRecord?.permissionProfileId || scanRecord?.parentId || location.state?.parentId || null;
  const reportIdForChat =
    effectiveReportId || normalizeReportId(scanRecord?.reportId) || null;

  const applyServiceStatusUpdate = useCallback((data) => {
    if (!data?.service || !data?.status) {
      return;
    }

    const expectedScanId = activeReportScanIdRef.current || effectiveScanId || '';
    if (data.scanId && expectedScanId && data.scanId !== expectedScanId) {
      console.info('[Report] Ignoring service status for another scan', {
        receivedScanId: data.scanId,
        expectedScanId,
        service: data.service,
        status: data.status,
      });
      return;
    }

    const serviceKey = data.subscriptionId
      ? `${data.service} (${data.subscriptionId})`
      : data.service;
    console.info('[Report] Service status update received', {
      scanId: data.scanId || expectedScanId,
      service: serviceKey,
      status: data.status,
    });
    setServiceStatus((prev) => ({
      ...prev,
      [serviceKey]: data.status,
    }));
  }, [effectiveScanId]);

  useEffect(() => {
    const handleDashboardServiceStatus = (event) => {
      applyServiceStatusUpdate(event.detail);
    };

    window.addEventListener('scan-service-status', handleDashboardServiceStatus);
    return () => {
      window.removeEventListener('scan-service-status', handleDashboardServiceStatus);
    };
  }, [applyServiceStatusUpdate]);

  const handleOpenChatWithReport = useCallback(() => {
    if (!effectiveScanId || !reportIdForChat) return;
    navigate('/dashboard/cloudagent', {
      state: {
        preloadReportContext: {
          scanId: effectiveScanId,
          reportId: reportIdForChat,
          permissionProfileId: resolvedPermissionProfileId || undefined,
          title: agentData?.title || scanRecord?.title || reportIdForChat,
        },
        preloadPrompt: 'Analyze this report.',
      },
    });
  }, [agentData?.title, effectiveScanId, navigate, reportIdForChat, resolvedPermissionProfileId, scanRecord?.title]);

  // Determine the target cloudProvider for filtering permission profiles
  // Priority: 1) navigation state, 2) plan task, 3) first task, 4) default 'aws'
  const targetCloudProvider = useMemo(() => {
    const phaseIndex = currentPhase >= 0 ? currentPhase : 0;
    const taskIndex = currentTask >= 0 ? currentTask : 0;
    
    // First check navigation state (passed from Library.jsx when clicking "Run Report")
    const navCloudProvider = location.state?.cloudProvider;
    
    const cloudProvider = navCloudProvider ||
                          plan?.[phaseIndex]?.tasks?.[taskIndex]?.cloudProvider || 
                          plan?.[0]?.tasks?.[0]?.cloudProvider || 
                          'aws';
    
    console.log('[Report] Derived targetCloudProvider:', {
      cloudProvider,
      navCloudProvider,
      planId: agentData?.planId,
      phaseIndex,
      taskIndex,
      taskCloudProvider: plan?.[phaseIndex]?.tasks?.[taskIndex]?.cloudProvider,
      firstTaskCloudProvider: plan?.[0]?.tasks?.[0]?.cloudProvider,
      planLength: plan?.length,
      firstPhaseTasksLength: plan?.[0]?.tasks?.length,
    });
    
    return cloudProvider;
  }, [location.state?.cloudProvider, plan, currentPhase, currentTask, agentData?.planId]);

  useEffect(() => {
    const normalizedStatus = normalizeStatusToken(scanRecord?.status);
    if (
      !effectiveScanId ||
      !scanRecord ||
      !ONGOING_REPORT_STATUS_SET.has(normalizedStatus) ||
      !userProfile?.userId
    ) {
      return;
    }

    dispatch(
      trackReportOperation({
        accountId:
          scanRecord?.accountId ||
          (authProfile?.provider === 'google_workspace'
            ? authProfile?.domain
            : authProfile?.awsAccountId || state.accountId || ''),
        authProfile,
        cloudProvider:
          scanRecord?.cloudProvider || targetCloudProvider || authProfile?.provider || 'aws',
        latestScanStatus: normalizedStatus,
        operationMode: 'interactive',
        parentId: scanRecord?.parentId || location.state?.parentId || null,
        planId: agentData?.planId || null,
        reportId: reportIdForChat || null,
        scanId: effectiveScanId,
        title: agentData?.title || scanRecord?.title || reportIdForChat || 'Report Run',
        userId: userProfile.userId,
      })
    );
  }, [
    agentData?.planId,
    agentData?.title,
    authProfile,
    dispatch,
    effectiveScanId,
    location.state?.parentId,
    reportIdForChat,
    scanRecord,
    state.accountId,
    targetCloudProvider,
    userProfile?.userId,
  ]);

  // const fetchAgentData = useCallback(async () => {
  //   try {
  //     setLoading(true);

  //     const agentConnectionData = await dispatch(
  //       getAgentConnection(recordId)
  //     ).unwrap();

  //     const extractedPlanId = agentConnectionData.itemId;

  //     const planResponse = await fetch(
  //       `https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/plans/${extractedPlanId}.json`
  //     );
  //     const planData = await planResponse.json();

  //     setAgentData({
  //       planId: extractedPlanId,
  //       planDetails: planData.plan,
  //       title: planData.title,
  //       type: planData.type,
  //       inputSummary: planData.planSettings?.defaultValues || '',
  //       scanId: agentConnectionData.scanId,
  //       recordId,
  //       existingAgentData: agentConnectionData,
  //       requiredPermissions: planData.requiredPermissions,
  //     });
  //   } catch (err) {
  //     setError('Failed to load agent data');
  //   } finally {
  //     setLoading(false);
  //   }
  // }, [recordId, dispatch]);

  // useEffect(() => {
  //   if (recordId) {
  //     fetchAgentData();
  //   }
  // }, [recordId, fetchAgentData]);

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
    
    // Reset the fetched flag if scanId changes
    const currentScanId = scanIdParam || location.state?.scanId;
    if (agentDataFetchedRef.current && agentData?.scanId !== currentScanId) {
      agentDataFetchedRef.current = false;
    }
    
    const fetchAgentData = async () => {
      // Prevent re-fetching if we've already fetched agentData for this scanId
      // This prevents re-initialization when accountScans updates (e.g., from refreshAccountScans)
      if (agentDataFetchedRef.current && agentData?.scanId === currentScanId) {
        console.log('[Report] Skipping fetch - already fetched for scanId:', currentScanId);
        return;
      }
      
      console.log('[Report] fetchAgentData called with:', {
        scanIdParam,
        currentScanId,
        locationStatePlanId: location.state?.planId,
        locationStateScanId: location.state?.scanId,
        userProfileLoading,
        accountScansCount: userProfile?.reportHistory?.length || 0,
      });
      
      try {
        setLoading(true);

        // Check for planId in state first (new report flow)
        if (location.state?.planId) {
          console.log('[Report] New report flow - fetching plan from state:', location.state.planId);
          const planResponse = await fetch(
            `https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/plans/${location.state.planId}.json`
          );
          const planData = await planResponse.json();
          console.log('[Report] Plan data fetched:', {
            planId: location.state.planId,
            title: planData.title,
            type: planData.type,
            viewMode: planData.viewMode,
            planTasksCount: planData.plan?.length || 0,
            topLevelCloudProvider: planData.cloudProvider,
            firstTaskCloudProvider: planData.plan?.[0]?.tasks?.[0]?.cloudProvider,
            navCloudProvider: location.state?.cloudProvider,
          });
              setAgentData({
                planId: location.state.planId,
                planDetails: planData.plan,
                title: planData.title,
                type: planData.type,
                viewMode: planData.viewMode,
                credits: planData.credits ?? planData.creditCost ?? 1,
                inputSummary: planData.planSettings?.defaultValues || '',
                scanId: location.state?.scanId || (scanIdParam && scanIdParam !== 'new' ? scanIdParam : ''), // Use scanId from state first, then URL (if not 'new'), otherwise empty
                recordId,
                existingAgentData: {},
                requiredPermissions: planData.requiredPermissions,
              });
              agentDataFetchedRef.current = true;
        } else if (scanIdParam && scanIdParam !== 'new') {
          // Existing scan - look up from accountScans
          console.log('[Report] Existing scan flow - looking up scanId:', scanIdParam);
          let accountScans = userProfile?.reportHistory || [];
          console.log('[Report] accountScans available:', accountScans.map(s => ({ scanId: s.scanId, reportId: s.reportId, cloudProvider: s.cloudProvider, title: s.title })));
          let scan = findAccountScan(accountScans, {
            scanId: scanIdParam,
            reportId: requestedReportId,
          });
          console.log('[Report] Initial scan lookup result:', scan ? { scanId: scan.scanId, reportId: scan.reportId, cloudProvider: scan.cloudProvider, title: scan.title, accountId: scan.accountId } : 'NOT FOUND');
          
          // If userProfile is still loading, wait for it to complete (effect will re-run when accountScans updates)
          if (userProfileLoading) {
            console.log('[Report] userProfile still loading, waiting...');
            setLoading(true);
            return; // Exit early, effect will re-run when accountScans is populated
          }
          
          // If scan not found and accountScans is empty, try refreshing accountScans first
          if (!scan && !accountScans.length) {
            console.log('[Report] Scan not found and accountScans empty, refreshing...');
            try {
              const refreshedScans = await dispatch(refreshAccountScans()).unwrap();
              accountScans = refreshedScans || [];
              console.log('[Report] Refreshed accountScans:', accountScans.map(s => ({ scanId: s.scanId, reportId: s.reportId, cloudProvider: s.cloudProvider, title: s.title })));
              scan = findAccountScan(accountScans, {
                scanId: scanIdParam,
                reportId: requestedReportId,
              });
              console.log('[Report] Scan lookup after refresh:', scan ? { scanId: scan.scanId, reportId: scan.reportId, cloudProvider: scan.cloudProvider } : 'NOT FOUND');
            } catch (refreshError) {
              console.warn('[Report] Failed to refresh accountScans:', refreshError);
              // Continue with existing accountScans (might be empty)
            }
          }
          
          if (scan && scan.reportId) {
            // Found scan in accountScans, fetch plan using reportId
            const planId = normalizeReportId(scan.reportId);
            console.log('[Report] Fetching plan for existing scan:', { 
              originalReportId: scan.reportId, 
              planId, 
              scanCloudProvider: scan.cloudProvider,
              scanTitle: scan.title 
            });
            try {
              const planResponse = await fetch(
                `https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/plans/${planId}.json`
              );
              const planData = await planResponse.json();
              console.log('[Report] Plan data fetched for existing scan:', {
                planId,
                title: planData.title,
                type: planData.type,
                viewMode: planData.viewMode,
                planLength: planData.plan?.length || 0,
                firstPhaseTaskCount: planData.plan?.[0]?.tasks?.length || 0,
              });
              
              // For existing scans, restore authProfile and accountId from scan data
              // This ensures the permissions modal doesn't show and authProfile is validated
              if (scan.accountId) {
                setState((prev) => ({
                  ...prev,
                  accountId: scan.accountId,
                  authProfile: {
                    ...prev.authProfile,
                    awsAccountId: scan.accountId,
                    accountId: scan.accountId,
                    validated: true, // Mark as validated for existing scans
                  },
                  isPermissionsModalOpen: false, // Close modal for existing scans
                }));
              }
              
              const agentDataToSet = {
                planId: planId, // Use the planId with 'report_' prefix
                planDetails: planData.plan,
                title: scan.title || planData.title,
                type: planData.type,
                viewMode: planData.viewMode,
                credits: planData.credits ?? planData.creditCost ?? 1,
                inputSummary: planData.planSettings?.defaultValues || '',
                scanId: scan.scanId,
                recordId,
                existingAgentData: {},
                requiredPermissions: planData.requiredPermissions,
              };
              console.log('[Report] Setting agentData:', agentDataToSet);
              setAgentData(agentDataToSet);
              agentDataFetchedRef.current = true;
            } catch (error) {
              console.error('[Report] Error fetching plan for report:', error);
              setError('Failed to load report data');
            }
          } else {
            // Try to fetch existing agent connection (for backward compatibility)
            try {
              const agentConnectionData = await dispatch(
                getAgentConnection(recordId)
              ).unwrap();

              const extractedPlanId = agentConnectionData.itemId;

              const planResponse = await fetch(
                `https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/plans/${extractedPlanId}.json`
              );
              const planData = await planResponse.json();

              setAgentData({
                planId: extractedPlanId,
                planDetails: planData.plan,
                title: planData.title,
                type: planData.type,
                inputSummary: planData.planSettings?.defaultValues || '',
                scanId: agentConnectionData.scanId || scanIdParam,
                viewMode: planData.viewMode,
                recordId,
                existingAgentData: agentConnectionData,
                requiredPermissions: planData.requiredPermissions,
              });
              agentDataFetchedRef.current = true;
            } catch (error) {
              console.warn('Could not fetch agent connection or find scan:', error);
              setError('Report not found. Please start a new report from the library.');
            }
          }
        } else {
          // Try to fetch existing agent connection (for backward compatibility)
          try {
            const agentConnectionData = await dispatch(
              getAgentConnection(recordId)
            ).unwrap();

            const extractedPlanId = agentConnectionData.itemId;

            const planResponse = await fetch(
              `https://s3.us-east-1.amazonaws.com/agent-plans-sandbox/plans/${extractedPlanId}.json`
            );
            const planData = await planResponse.json();

            setAgentData({
              planId: extractedPlanId,
              planDetails: planData.plan,
              title: planData.title,
              type: planData.type,
              inputSummary: planData.planSettings?.defaultValues || '',
              scanId: agentConnectionData.scanId || scanIdParam,
              viewMode: planData.viewMode,
              recordId,
              existingAgentData: agentConnectionData,
              requiredPermissions: planData.requiredPermissions,
            });
            agentDataFetchedRef.current = true;
          } catch (error) {
            // If getAgentConnection fails, it might be a new report with scanId in URL
            // Try to find the planId from accountScans
            console.warn('Could not fetch agent connection, might be a new report:', error);
            setError('Report not found. Please start a new report from the library.');
          }
        }
      } catch (error) {
        console.error('Error fetching agent data:', error);
        setError('Failed to load report data');
      } finally {
        setLoading(false);
      }
    };

    if (recordId || location.state?.planId) {
      fetchAgentData();
    }
  }, [recordId, location.state?.planId, requestedReportId, scanIdParam, dispatch, userProfile?.reportHistory, userProfileLoading]);

  useEffect(() => {
    if (!agentData) return;
    if (!recommendationContext) return;
    if (hasAppliedRecommendationContext) return;

    const {
      permissionProfileId,
      permissionProfile,
      accountId: contextAccountId,
      targetRegions = [],
    } = recommendationContext;

    const savedProfile =
      (permissionProfileId &&
        userProfile?.agentPermissionProfiles?.find(
          (perm) =>
            perm?.recordId === permissionProfileId ||
            perm?.id === permissionProfileId
        )) ||
      permissionProfile ||
      null;

    const parsedAuthProfile =
      savedProfile && savedProfile.authProfile
        ? parseRecommendationAuthProfile(savedProfile.authProfile)
        : null;

    setState((prev) => {
      const nextGlobalSettings = {
        ...prev.globalSettings,
      };

      if (Array.isArray(targetRegions) && targetRegions.length > 0) {
        nextGlobalSettings.select_aws_regions = targetRegions;
      }

      return {
        ...prev,
        accountId:
          contextAccountId ||
          parsedAuthProfile?.awsAccountId ||
          parsedAuthProfile?.accountId ||
          prev.accountId,
        prefillPermissionProfileId:
          savedProfile?.recordId ||
          savedProfile?.id ||
          prev.prefillPermissionProfileId,
        prefillPermissionProfileName:
          savedProfile?.name ||
          recommendationContext.permissionProfileName ||
          prev.prefillPermissionProfileName,
        authProfile: parsedAuthProfile
          ? {
              ...prev.authProfile,
              ...parsedAuthProfile,
              authProfileName:
                savedProfile?.name ||
                parsedAuthProfile.authProfileName ||
                prev.authProfile.authProfileName,
              validated: false,
            }
          : prev.authProfile,
        globalSettings: nextGlobalSettings,
      };
    });

    setHasAppliedRecommendationContext(true);
  }, [
    agentData,
    hasAppliedRecommendationContext,
    recommendationContext,
    userProfile,
  ]);

  useEffect(() => {
    if (agentData) {
      const existingAgent = agentData.existingAgentData;
      // Check if this is an existing scan (has scanId and it's not 'new')
      const isExistingScan = agentData.scanId && agentData.scanId !== 'new' && scanIdParam && scanIdParam !== 'new';
      
      // Initialize plan from planDetails for new reports (when no existing log)
      if (!existingAgent?.log && agentData.planDetails) {
        const plan = agentData.planDetails;
        let currentPhase = 0;
        let currentTask = 0;
        
        // Initialize first task if plan exists
        if (plan && Array.isArray(plan) && plan.length > 0 && plan[0].tasks && plan[0].tasks.length > 0) {
          plan[0].tasks[0].status = 'not-run';
          currentPhase = 0;
          currentTask = 0;
        }
        
        setState((prev) => {
          // Restore authProfile and accountId from navigation state if available
          const navAuthProfile = location.state?.authProfile;
          const navAccountId = location.state?.accountId;
          
          return {
            ...prev,
            plan,
            currentPhase,
            currentTask,
            // For existing scans, close permissions modal and mark authProfile as validated
            // For new reports, keep modal open if shouldAutocontinue is false
            isPermissionsModalOpen: isExistingScan ? false : prev.isPermissionsModalOpen,
            // If shouldAutocontinue is true, restore authProfile from navigation state or mark as validated
            authProfile: navAuthProfile ? {
              ...prev.authProfile,
              ...navAuthProfile,
              validated: isExistingScan || shouldAutocontinue || prev.authProfile.validated,
            } : {
              ...prev.authProfile,
              validated: isExistingScan || shouldAutocontinue || prev.authProfile.validated,
            },
            // Ensure accountId is set from navigation state, authProfile, or globalSettings
            accountId: navAccountId || 
                      navAuthProfile?.awsAccountId || 
                      prev.accountId || 
                      (globalSettings?.select_aws_account_id || ''),
          };
        });
        return;
      }
      
      if (existingAgent?.log) {
        try {
          const logData = toLogObject(existingAgent.log);
          const authProfileData = JSON.parse(existingAgent.authProfile);

          if (authProfileData.authProfileName) {
            let plan = agentData.planDetails;
            let currentPhase = 0;
            let currentTask = 0;
            let allQueries = [];
            let allAnswers = [];

            if (
              logData.logs &&
              Array.isArray(logData.logs) &&
              logData.logs.length > 0
            ) {
              logData.logs.forEach((entry) => {
                const phase = plan[entry.phaseIndex];
                const task = phase?.tasks[entry.taskIndex];
                if (task) {
                  task.status = entry.status;
                  task.task_output = entry.task_output;
                  task.cli_command_output = entry.cli_command_output;

                  if (entry.chat_history && Array.isArray(entry.chat_history)) {
                    entry.chat_history.forEach((chat) => {
                      if (chat.query) allQueries.push(chat.query);
                      if (chat.answer) allAnswers.push(chat.answer);
                    });
                  }
                }
              });

              const lastLog = logData.logs[logData.logs.length - 1];
              if (lastLog) {
                if (lastLog.status === 'in-progress') {
                  currentPhase = lastLog.phaseIndex;
                  currentTask = lastLog.taskIndex;
                } else if (lastLog.status === 'complete') {
                  let nextPhase = lastLog.phaseIndex;
                  let nextTask = lastLog.taskIndex + 1;

                  if (nextTask >= plan[nextPhase].tasks.length) {
                    nextPhase++;
                    nextTask = 0;
                  }

                  if (nextPhase < plan.length) {
                    plan[nextPhase].tasks[nextTask].status = 'not-run';
                    currentPhase = nextPhase;
                    currentTask = nextTask;
                  }
                }
              }
            } else {
              if (plan.length > 0 && plan[0].tasks.length > 0) {
                plan[0].tasks[0].status = 'not-run';
                currentPhase = 0;
                currentTask = 0;
              }
            }

            setState((prev) => ({
              ...prev,
              plan,
              currentPhase,
              currentTask,
              queries: allQueries,
              answers: allAnswers,
              accountId:
                authProfileData.awsAccountId || authProfileData.accountId || '',
              isPermissionsModalOpen: false,
              authProfile: {
                ...prev.authProfile,
                roleName: authProfileData.roleName || '',
                externalId: authProfileData.externalId || '',
                authProfileName: authProfileData.authProfileName,
                validated: true,
                authType: 'role',
                awsAccountId:
                  authProfileData.awsAccountId || authProfileData.accountId || '',
              },
              globalSettings: logData.globalSettings || {},
            }));
          }
        } catch (error) {
          console.error('Error parsing log:', error);
        }
      }
    }
  }, [agentData, scanIdParam]);

  useEffect(() => {
    // Restore authProfile and accountId from navigation state when shouldAutocontinue is true
    // This preserves the permission profile data that was selected before navigation
    if (shouldAutocontinue && location.state?.planId && agentData) {
      setState((prev) => {
        const navAuthProfile = location.state?.authProfile;
        const navAccountId = location.state?.accountId;
        const navCloudProvider = location.state?.cloudProvider;
        
        console.log('[Report] Restoring from navigation state:', {
          navAuthProfile,
          navAccountId,
          navCloudProvider,
          hasNavAuthProfile: !!navAuthProfile,
          provider: navAuthProfile?.provider,
          domain: navAuthProfile?.domain,
        });
        
        // If we have authProfile from navigation state, use it
        if (navAuthProfile) {
          // For Google Workspace, use domain as accountId; for AWS, use awsAccountId
          const effectiveAccountId = navAuthProfile?.provider === 'google_workspace'
            ? (navAccountId || navAuthProfile?.domain || prev.accountId || '')
            : (navAccountId || navAuthProfile?.awsAccountId || prev.accountId || '');
          
          return {
            ...prev,
            accountId: effectiveAccountId,
            authProfile: {
              ...prev.authProfile,
              ...navAuthProfile,
              validated: true, // Mark as validated since permissions were confirmed
            },
          };
        }
        
        // Otherwise, just mark as validated
        if (!prev.authProfile.validated) {
          return {
            ...prev,
            accountId: navAccountId || prev.accountId || '',
            authProfile: {
              ...prev.authProfile,
              validated: true,
            },
          };
        }
        return prev;
      });
    }
  }, [shouldAutocontinue, location.state?.planId, location.state?.authProfile, location.state?.accountId, agentData]);

  // Auto-start assessment when arriving from the unified run modal (readyToRun flow)
  useEffect(() => {
    if (
      !navReadyToRun ||
      !agentData ||
      !plan?.length ||
      runAssessment ||
      readyToRunHandledRef.current ||
      scanInitiatedRef.current
    ) {
      return;
    }
    if (!authProfile?.validated) return;

    readyToRunHandledRef.current = true;

    const isGoogleWorkspace = authProfile?.provider === 'google_workspace';
    const effectiveAccountId = isGoogleWorkspace
      ? (authProfile?.domain || state.accountId || '')
      : (authProfile?.awsAccountId || state.accountId || '');
    const generatedScanId = setStableActiveReportScanId(
      `${effectiveAccountId}-${Date.now()}-${agentData.planId}`
    );

    setRunAssessment(true);

    const targetRoute =
      buildReportRoute({
        scanId: generatedScanId,
        reportId: effectiveReportId || location.state?.reportId || agentData.planId,
      }) || `/dashboard/reports/${generatedScanId}`;

    navigate(targetRoute, {
      state: {
        shouldAutocontinue: true,
        planId: agentData.planId,
        parentId: location.state?.parentId,
        scanId: generatedScanId,
        authProfile: authProfile,
        accountId: effectiveAccountId,
        cloudProvider: location.state?.cloudProvider,
      },
      replace: true,
    });
  }, [navReadyToRun, agentData, plan, authProfile, runAssessment, state.accountId, navigate, location.state?.parentId, location.state?.cloudProvider, setStableActiveReportScanId]);

  useEffect(() => {
    if (
      authProfile.validated &&
      Object.keys(globalSettings).length === 0 &&
      !agentData?.scanId &&
      !shouldAutocontinue
    ) {
      const provider = String(authProfile.provider || location.state?.cloudProvider || '').toLowerCase();
      // For non-AWS providers, skip the AWS region modal and directly start the assessment
      if (provider === 'google_workspace' || provider === 'azure') {
        console.log('[Report] Non-AWS profile detected, skipping region modal', {
          authProfile,
          domain: authProfile.domain,
          adminEmail: authProfile.adminEmail,
        });
        // Generate scan ID and navigate to start the assessment
        const effectiveAccountId =
          provider === 'azure'
            ? (authProfile.tenantId || authProfile.azureTenantId || state.accountId || '')
            : authProfile.domain || state.accountId || '';
        const generatedScanId = setStableActiveReportScanId(
          `${effectiveAccountId}-${Date.now()}-${agentData?.planId}`
        );
        
        setRunAssessment(true);
        
        const targetRoute =
          buildReportRoute({
            scanId: generatedScanId,
            reportId: effectiveReportId || location.state?.reportId || agentData?.planId,
          }) || `/dashboard/reports/${generatedScanId}`;

        navigate(targetRoute, {
          state: {
            shouldAutocontinue: true,
            planId: agentData?.planId,
            parentId: location.state?.parentId,
            scanId: generatedScanId,
            authProfile: authProfile,
            accountId: effectiveAccountId,
            cloudProvider: provider,
          },
        });
      } else {
        // For AWS, open the region modal
        dispatch(setIsRegionModalOpen(true));
      }
    }
  }, [authProfile.validated, globalSettings, agentData?.scanId, shouldAutocontinue, authProfile.provider, authProfile.domain, authProfile.tenantId, authProfile.azureTenantId, agentData?.planId, navigate, location.state?.parentId, location.state?.cloudProvider, state.accountId, setStableActiveReportScanId]);

  // Centralized scan initiation logic - only runs once when runAssessment becomes true
  useEffect(() => {
    // Only initiate scan if:
    // 1. runAssessment is true (user clicked "Run Report" button)
    // 2. We have all required data (agentData, authProfile, plan, etc.)
    // 3. We haven't already initiated a scan
    // 4. WebSocket is not already connected
    if (
      !runAssessment ||
      !agentData ||
      !authProfile?.validated ||
      !plan?.length ||
      scanInitiatedRef.current ||
      wsRef.current
    ) {
      return;
    }

    const existingScanId =
      agentData?.scanId ||
      activeReportScanIdRef.current ||
      location.state?.scanId ||
      (scanIdParam !== 'new' ? scanIdParam : '');
    const currentPhase = state.currentPhase >= 0 ? state.currentPhase : 0;
    const currentTask = state.currentTask >= 0 ? state.currentTask : 0;
    const cloudProvider = String(
      location.state?.cloudProvider ||
      plan[currentPhase]?.tasks[currentTask]?.cloudProvider ||
      authProfile?.provider ||
      'aws'
    ).toLowerCase();
    // For Google Workspace, use domain as the identifier; for Azure, use tenantId; for AWS, use awsAccountId
    const isGoogleWorkspace = authProfile?.provider === 'google_workspace';
    const isAzure = cloudProvider === 'azure' || authProfile?.provider === 'azure';
    const effectiveAccountId = isGoogleWorkspace 
      ? (authProfile?.domain || state.accountId || '')
      : isAzure
        ? (authProfile?.tenantId || authProfile?.azureTenantId || state.accountId || '')
        : (authProfile?.awsAccountId || state.accountId || '');
    const scanIdConst =
      existingScanId ||
      setStableActiveReportScanId(`${effectiveAccountId}-${Date.now()}-${agentData.planId}`);
    setStableActiveReportScanId(scanIdConst);
    const requiredCredits = normalizeExecutionCredits(
      agentData?.credits ?? agentData?.creditCost,
      1
    );
    const availableCredits = getAvailableCredits(userProfile);
    if (!isLocalRuntime() && availableCredits < requiredCredits) {
      const message = `Insufficient credits. This operation requires ${requiredCredits} credits, but you have ${availableCredits}.`;
      toast.error(message);
      dispatch(
        failReportOperation({
          scanId: scanIdConst,
          error: message,
        })
      );
      return;
    }
    // Set scanInitiated before async launch so child components show progress
    // and subscribe with the same scanId used by the launcher.
    setScanInitiated(true);
    const reportId = resolveReportDefinitionId(
      plan[currentPhase]?.tasks[currentTask]?.reportId,
      agentData?.planId
    );
    const services = plan[currentPhase]?.tasks[currentTask]?.services || [];
    const selectedRegions = isAzure
      ? (
          Array.isArray(globalSettings?.select_azure_regions) && globalSettings.select_azure_regions.length > 0
            ? globalSettings.select_azure_regions
            : ['all']
        )
      : Array.isArray(globalSettings?.select_aws_regions) && globalSettings.select_aws_regions.length > 0
        ? globalSettings.select_aws_regions
        : ['us-east-1'];

    let effectActive = true;

    const launchAssessmentWithConnection = async (connectionId = '') => {
      if (!effectActive || scanInitiatedRef.current) {
        return;
      }

      const normalizedConnectionId = String(connectionId || '').trim();
      setScanConnectionId(normalizedConnectionId || null);
      scanInitiatedRef.current = true;

      try {
        console.log('[Report] Initiating assessment with cloudProvider:', {
          cloudProvider,
          fromLocationState: location.state?.cloudProvider,
          fromPlanTask: plan[currentPhase]?.tasks[currentTask]?.cloudProvider,
          fromAuthProfile: authProfile?.provider,
          authProfileDomain: authProfile?.domain,
          authProfileAdminEmail: authProfile?.adminEmail,
          websocketConnectionIdPresent: Boolean(normalizedConnectionId),
        });

        dispatch(
          trackReportOperation({
            accountId: effectiveAccountId,
            authProfile,
            cloudProvider,
            latestScanStatus: 'started',
            operationMode: 'interactive',
            parentId: location.state?.parentId || null,
            planId: agentData?.planId || null,
            reportId,
            scanId: scanIdConst,
            title: agentData?.title || reportId || 'Report Run',
            userId: userProfile?.userId,
          })
        );
        
        await initiateAssessment({
          cloudProvider,
          // AWS-specific config
          config: cloudProvider === 'google_workspace' ? {
            // Google Workspace config
            scanId: scanIdConst,
            domain: authProfile?.domain,
            superAdminEmailAddress: authProfile?.adminEmail,
            serviceAccountJson: typeof authProfile?.serviceAccountJson === 'string' 
              ? authProfile.serviceAccountJson 
              : JSON.stringify(authProfile?.serviceAccountJson),
            services: services,
          } : cloudProvider === 'azure' ? buildAzureAssessmentConfig({
            authProfile,
            services,
            regions: selectedRegions,
          }) : {
            // AWS config (default)
            accountId: effectiveAccountId,
            services: services,
            regions: selectedRegions,
            authProfile: {
              ...authProfile,
              accountId: effectiveAccountId,
            },
          },
          // Common parameters
          common: {
            assessmentId: scanIdConst,
            reportId: reportId,
            title: agentData?.title || '',
            parentId: location.state?.parentId,
            licenseType: 'ongoing',
            connectionId: normalizedConnectionId,
          },
          // Callbacks
          callbacks: {
            onError: (error) => console.error('Scan initiation error:', error),
            onSuccess: () => {},
          },
        });
        dispatch(refreshUserCredits())
          .unwrap()
          .catch((error) => {
            console.warn('[Report] Failed to refresh credits after report start:', error);
          });
        
        analytics.track(ANALYTICS_EVENTS.REPORT_RUN, {
          route: getAnalyticsRoute(),
        });
      } catch (error) {
        console.error('Error initiating scan:', error);
        toast.error(error?.message || 'Failed to start report');
        analytics.track(ANALYTICS_EVENTS.ERR_REPORT_FAILED, {
          route: getAnalyticsRoute(),
          error_message: error?.message || 'Failed to start report',
        });
        dispatch(
          failReportOperation({
            scanId: scanIdConst,
            error: error?.message || 'Failed to start report',
          })
        );
        scanInitiatedRef.current = false; // Reset on error so user can retry
      }
    };

    const existingScannerConnectionId = String(scannerUpdatesConnectionId || '').trim();
    const launchWithFallbackConnection = () => {
      launchAssessmentWithConnection(existingScannerConnectionId || '');
    };

    if (existingScannerConnectionId) {
      launchAssessmentWithConnection(existingScannerConnectionId);
      return () => {
        effectActive = false;
      };
    }

    if (!SCAN_UPDATES_WEBSOCKET_ENDPOINT) {
      launchWithFallbackConnection();
      return () => {
        effectActive = false;
      };
    }

    let heartbeatInterval = null;

    // Create a report-local WebSocket so this view receives service-level
    // progress messages when the dashboard-level scanner websocket is not ready.
    const ws = new WebSocket(SCAN_UPDATES_WEBSOCKET_ENDPOINT);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: 'connectionAck' }));
      heartbeatInterval = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'connectionAck' }));
        }
      }, 240000);
    };

    ws.onmessage = async (event) => {
      if (!effectActive) {
        return;
      }
      try {
        const data = JSON.parse(event.data);

        if (data.connectionId) {
          launchAssessmentWithConnection(data.connectionId);
          return;
        }

        // Handle service status updates
        applyServiceStatusUpdate(data);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = (event) => {
      if (heartbeatInterval) {
        window.clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      if (!effectActive) {
        return;
      }
      if (!scanInitiatedRef.current) {
        console.warn('Report WebSocket closed before connection acknowledgement; launching without live service updates.', {
          code: event?.code ?? null,
          reason: event?.reason || '',
          wasClean: event?.wasClean === true,
          fallbackConnectionIdPresent: Boolean(existingScannerConnectionId),
        });
        launchWithFallbackConnection();
      }
    };

    ws.onerror = (error) => {
      if (heartbeatInterval) {
        window.clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      console.error('WebSocket error:', {
        error,
        endpoint: SCAN_UPDATES_WEBSOCKET_ENDPOINT,
        readyState: ws.readyState,
      });
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      if (!effectActive) {
        return;
      }
      if (!scanInitiatedRef.current) {
        launchWithFallbackConnection();
      }
    };

    // Cleanup function
    return () => {
      effectActive = false;
      if (heartbeatInterval) {
        window.clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [
    runAssessment,
    agentData,
    applyServiceStatusUpdate,
    authProfile,
    dispatch,
    globalSettings,
    location.state?.cloudProvider,
    location.state?.parentId,
    location.state?.scanId,
    plan,
    scannerUpdatesConnectionId,
    scanIdParam,
    setStableActiveReportScanId,
    state.accountId,
    state.currentPhase,
    state.currentTask,
    userProfile?.userId,
  ]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/agents')}
            className="bg-primary-600 text-white px-4 py-2 rounded"
          >
            Back to Agents
          </button>
        </div>
      </div>
    );
  }

  if (!agentData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p>Report not found</p>
      </div>
    );
  }

  const handleSettings = async (answers) => {
    settingsUpdatedRef.current = true;

    let existingLogData = {
      logs: [],
      currentPhase: 0,
      currentTask: 0,
      authProfileName: '',
    };
    try {
      const data = agentData?.existingAgentData;
      if (data?.log) {
        existingLogData = toLogObject(data.log);
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
      // For reports, scanId will be created when initiateAssessmentScan is called
      // No need to call recordAgentConnection - accountScans entry created by backend
      if (shouldAutocontinue) {
        // Generate scanId for navigation (will match the one created by initiateAssessmentScan)
        // Use accountId from authProfile if available, otherwise from state
        // Use state.authProfile directly to ensure we have the latest value
        const currentAuthProfile = state.authProfile;
        const effectiveAccountId = currentAuthProfile?.awsAccountId || state.accountId || '';
        const generatedScanId = setStableActiveReportScanId(
          `${effectiveAccountId}-${Date.now()}-${agentData.planId}`
        );
        
        // Set runAssessment to true when user clicks "Run Report" button
        setRunAssessment(true);
        
        const targetRoute =
          buildReportRoute({
            scanId: generatedScanId,
            reportId: effectiveReportId || location.state?.reportId || agentData.planId,
          }) || `/dashboard/reports/${generatedScanId}`;

        navigate(targetRoute, {
          state: {
            shouldAutocontinue: true,
            planId: agentData.planId,
            parentId: location.state?.parentId,
            scanId: generatedScanId, // Pass scanId in state so it's used consistently
            // Pass authProfile and accountId through navigation state so they're preserved
            authProfile: currentAuthProfile,
            accountId: effectiveAccountId,
          },
        });
      }
      // For existing reports, no update needed - status managed by accountScans
      dispatch(setIsRegionModalOpen(false));
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  const totalTasks = plan?.reduce((sum, phase) => sum + phase.tasks.length, 0);
  const completedTasks = plan?.reduce(
    (sum, phase) =>
      sum + phase.tasks.filter((task) => task.status === 'complete').length,
    0
  );

  const progress = (completedTasks / totalTasks) * 100;

  return (
    <div className="bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="px-6">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Button
                  variant="link"
                  onClick={() => {
                    navigate(-1);
                  }}
                  className="text-primary-600"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  {agentData.title || 'Back to Report'}
                </Button>
              </div>
            </div>
            <div className="flex items-center">
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                onClick={handleOpenChatWithReport}
                disabled={!effectiveScanId || !reportIdForChat}
                title={!effectiveScanId || !reportIdForChat ? 'Report not ready for chat' : 'Open in chat'}
              >
                <Bot className="h-4 w-4 mr-2" />
                Open in chat
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <Progress value={progress} className="h-2 bg-primary-200" />

      {(() => {
        // For new reports with shouldAutocontinue, authProfile should be considered validated
        const isAuthValidated = authProfile.validated || (shouldAutocontinue && location.state?.planId);
        const shouldRender = isAuthValidated && (recordId !== 'new' || location.state?.planId);
        return shouldRender;
      })() && (
        <div className="flex flex-col md:flex-row ">
          {/* Left column hidden for compliance reports - they use full width */}
          <div
            className={cn(
              'flex gap-8 p-8 h-[calc(100vh-10rem)] w-full',
              activeView === 'split' ? 'flex-col' : 'flex-row',
              agentData?.scanId ? 'items-start overflow-auto' : ''
            )}
          >
            <div className="flex-1 flex flex-col bg-white rounded-[16px] overflow-hidden pb-6 relative">
              <div
                className={cn(
                  'flex-1 flex flex-col transition-all duration-300'
                )}
                style={{ overflowY: 'scroll' }}
              >
                {(() => {
                  // Determine which component to use based on reportId
                  // If reportId contains "_compliance_", use ComplianceReport, otherwise use ComplianceSummaryReport
                  const reportIdToCheck = plan[currentPhase]?.tasks[currentTask]?.reportId || agentData?.planId || '';
                  const useComplianceReport = reportIdToCheck.includes('_compliance_');
                  
                  // Also check viewMode for backward compatibility
                  const shouldUseComplianceReport = useComplianceReport || agentData?.viewMode !== 'report';
                  
                  console.log('[Report] Component selection:', {
                    reportIdToCheck,
                    useComplianceReport,
                    agentDataViewMode: agentData?.viewMode,
                    agentDataType: agentData?.type,
                    shouldUseComplianceReport,
                    componentToRender: shouldUseComplianceReport ? 'ComplianceReport' : 'ComplianceSummaryReport',
                    scanId: effectiveScanId || '',
                    currentPhase,
                    currentTask,
                    planLength: plan?.length || 0,
                  });
                  
                  // Report definition files use the task reportId. Azure compliance
                  // definitions intentionally omit the plan's report_ prefix.
                  const taskReportId = plan[currentPhase]?.tasks[currentTask]?.reportId;
                  const effectiveReportId = resolveReportDefinitionId(taskReportId, agentData?.planId);
                  
                  console.log('[Report] Effective reportId calculation:', {
                    taskReportId,
                    planId: agentData?.planId,
                    effectiveReportId,
                    expectedUrl: buildReportDefinitionUrl(effectiveReportId),
                  });
                  
                  return shouldUseComplianceReport ? (
                    <ComplianceReport
                      planId={agentData?.planId}
                      accountId={authProfile?.awsAccountId || state.accountId || ''}
                      recordId={recordId}
                      scanId={effectiveScanId || ''}
                      reportId={effectiveReportId}
                      services={plan[currentPhase]?.tasks[currentTask]?.services}
                      authProfile={authProfile}
                      regions={globalSettings?.select_aws_regions}
                      runAssessment={false}
                      connectionId={scanConnectionId}
                      scanInitiated={scanInitiated}
                      serviceStatus={serviceStatus}
                      title={agentData?.title}
                      parentId={location.state?.parentId}
                      cloudProvider={targetCloudProvider}
                    />
                  ) : (
                    <ComplianceSummaryReport
                      planId={agentData?.planId}
                      accountId={authProfile?.awsAccountId || state.accountId || ''}
                      recordId={recordId}
                      scanId={effectiveScanId || ''}
                      reportId={effectiveReportId}
                      services={plan[currentPhase]?.tasks[currentTask]?.services}
                      authProfile={authProfile}
                      regions={globalSettings?.select_aws_regions}
                      runAssessment={false}
                      connectionId={scanConnectionId}
                      scanInitiated={scanInitiated}
                      serviceStatus={serviceStatus}
                      title={agentData?.title}
                      parentId={location.state?.parentId}
                      cloudProvider={targetCloudProvider}
                    />
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
      <PermissionsModal
        isOpen={isPermissionsModalOpen}
        setState={setState}
        state={state}
        onCancel={() => {
          if (!location.state?.isReconnecting) {
            navigate(reportRunCancelDestination);
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
        requiredPermissions={agentData?.requiredPermissions}
        existingAgentData={agentData?.existingAgentData}
        isReconnecting={location.state?.isReconnecting}
        cloudProvider={targetCloudProvider}
      />
      <SettingsSummary
        isOpen={isRegionModalOpen}
        onClose={() => dispatch(setIsRegionModalOpen(false))}
        onSubmit={(answers) => {
          handleSettings(answers);
        }}
        defaultValues={globalSettings}
        inputSummary={agentData.inputSummary}
        isAgent={true}
        isReport={true}
        onCancel={() => navigate(reportRunCancelDestination)}
        planId={agentData?.planId}
        buttonText="Run Report"
        isReconnecting={location.state?.isReconnecting}
        cloudProvider={targetCloudProvider}
        creditsCost={agentData?.credits || 0}
        availableCredits={
          (userProfile?.agentCredits?.adhocCredits || 0) +
          (userProfile?.agentCredits?.monthlyBaseCredits || 0)
        }
        operationTitle={agentData?.title || 'Report Run'}
        parentId={location.state?.parentId || null}
        recommendationTarget={recommendationContext?.recommendationRunTarget || null}
        prefillPermissionProfileId={state.prefillPermissionProfileId}
        prefillPermissionProfileName={state.prefillPermissionProfileName}
      />
    </div>
  );
}

const PhaseSelect = ({ plan, currentTask, currentPhase }) => {
  const title = plan[currentPhase]?.tasks[currentTask]?.title || '';
  const task = plan[currentPhase]?.tasks[currentTask];
  const userExplanation = Array.isArray(task?.userExplanation)
    ? task.userExplanation.join('\n\n')
    : task?.userExplanation;
  const description = Array.isArray(task?.description)
    ? task.description.join('\n\n')
    : task?.description;
  const rawExplanation = userExplanation || description || '';

  // Remove a leading markdown heading that exactly matches the task title
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingPattern = new RegExp(
    `^\\n?\\s*#{1,6}\\s*${escapeRegex(title)}\\s*$\\n?`,
    'mi'
  );
  const processedExplanation = rawExplanation.replace(headingPattern, '');

  return (
    <div className="space-y-4">
      <div key={currentPhase} className="py-2 bg-white fade-in">
        {/* <h3 className="text-lg font-medium mb-2 text-primary-800">
          {title}
        </h3> */}

        <Markdown
          className="space-y-4"
          options={{
            overrides: {
              h1: {
                props: {
                  className: 'text-2xl font-bold my-6 text-primary-800',
                },
              },
              h2: {
                props: {
                  className: 'text-xl font-medium my-5 text-primary-800',
                },
              },
              h3: {
                props: {
                  className: 'text-lg font-medium my-4 text-primary-800',
                },
              },
              h4: {
                props: {
                  className: 'text-base font-medium my-3 text-primary-800',
                },
              },
              h5: {
                props: {
                  className: 'text-sm font-medium my-2 text-primary-800',
                },
              },
              h6: {
                props: {
                  className: 'text-xs font-medium my-2 text-primary-800',
                },
              },
              p: {
                props: {
                  className: 'text-gray-600',
                },
              },
              div: {
                props: {
                  className: 'space-y-4',
                },
              },
              ul: {
                props: {
                  className: 'list-disc pl-6 space-y-2 text-gray-600',
                },
              },
              code: {
                props: {
                  className:
                    'font-mono bg-gray-100 rounded px-1 letterSpacing[1px]',
                  style: { whiteSpace: 'pre-line' },
                },
              },
              a: {
                props: {
                  className: 'text-primary-600 hover:underline',
                  target: '_blank',
                },
              },
            },
          }}
        >
          {processedExplanation}
        </Markdown>
      </div>
    </div>
  );
};
