import React, { useEffect, useState, lazy, Suspense } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useParams,
} from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  setUser,
  setLoading,
  refreshUserProfile,
  updateSingleProfileInState,
} from './features/auth/authSlice';
import { loadWorkloadsFromUserProfile } from './features/workload/workloadSlice';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { Wifi, WifiOff } from 'lucide-react';
import {
  getDefaultDashboardPath,
  hasRuntimeCapability,
  isLocalRuntime,
} from './runtime/cloudAgentRuntime';

// Critical components - loaded immediately
import WorkloadDiscoveryBackgroundRunner from './components/WorkloadDiscoveryBackgroundRunner';
import GettingStartedWizard from './components/GettingStartedWizard';
import { Button } from './components/ui/button';
import { awsClient } from './api/clients/awsClient';
import { settingsClient } from './api/clients/settingsClient';

// Lazy load all other routes
const Library = lazy(() => import('./pages/Libraries/Library'));
const DashboardLayout = lazy(() => import('./pages/Dashboard'));
const CommandCenterPage = lazy(() => import('./pages/Dashboard/CommandCenter'));
const ExecutiveSummariesPage = lazy(() =>
  import('./pages/Dashboard/ExecutiveSummaries')
);
const OverviewPage = lazy(() => import('./pages/Settings/Overview'));
const SkillBuilder = lazy(() => import('./pages/Agent/SkillBuilder'));
const SkillBuilderEdit = lazy(() => import('./pages/Agent/SkillBuilderEdit'));
const WorkflowEditor = lazy(() => import('./pages/Workflow'));
const WorkflowOverview = lazy(() => import('./pages/Workflow/WorkflowOverview'));
const Agent = lazy(() => import('./pages/Agent/Agent'));
const WorkloadDetailsPage = lazy(() => import('./pages/Dashboard/WorkloadDetails'));
const HealthDashboard = lazy(() => import('./pages/Dashboard/HealthDashboard'));
const CostDashboard = lazy(() => import('./pages/Dashboard/CostDashboard'));
const ThreatDashboard = lazy(() => import('./pages/Dashboard/ThreatDashboard'));
const CloudSetupPage = lazy(() => import('./pages/Dashboard/CloudSetup'));
const LocalReadinessPage = lazy(() => import('./pages/Dashboard/LocalReadiness'));
const WorkloadsPage = lazy(() => import('./pages/Dashboard/Workloads'));
const WorkloadStandardsPage = lazy(() =>
  import('./pages/Dashboard/DeploymentSettings')
);
const DashboardPreferencesPage = lazy(() => import('./pages/Dashboard/Preferences'));
const MySkills = lazy(() => import('./pages/Settings/MySkills'));
const MyAgents = lazy(() => import('./pages/Settings/MyAgent'));
const MCPPage = lazy(() => import('./pages/Settings/MCP'));

const DashboardCapabilityRoute = ({ capability, children }) => {
  if (!hasRuntimeCapability(capability)) {
    return <Navigate to={getDefaultDashboardPath()} replace />;
  }

  return children;
};

const LOCAL_GETTING_STARTED_DISMISSED_KEY = 'cloudagent.localGettingStarted.dismissed.v1';

const App = () => {
  const dispatch = useDispatch();
  const { loading: authLoading, userProfile } = useSelector(
    (state) => state.auth
  );
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [localStartupError, setLocalStartupError] = useState(null);
  const [showLocalGettingStarted, setShowLocalGettingStarted] = useState(false);
  const isLocalMode = isLocalRuntime();
  const defaultDashboardPath = getDefaultDashboardPath();

  useEffect(() => {
    const initAuth = async () => {
      dispatch(setLoading(true));

      try {
        setLocalStartupError(null);
        const localUser = {
          username: 'Local User',
          userId: 'local-user',
          signInDetails: {},
          isSignedIn: true,
        };
        const profile = await dispatch(refreshUserProfile()).unwrap();
        dispatch(setUser(localUser));
        dispatch(loadWorkloadsFromUserProfile(profile?.workloads || []));
        try {
          const { profiles = [], invalidCount = 0 } =
            await awsClient.validatePermissionProfiles();
          profiles.forEach((permissionProfile) => {
            dispatch(updateSingleProfileInState(permissionProfile));
          });
          if (invalidCount > 0) {
            toast.error(
              `${invalidCount} local AWS credential ${invalidCount === 1 ? 'profile needs' : 'profiles need'} attention.`
            );
          }
        } catch (validationError) {
          console.warn('[local credentials] validation failed', validationError);
        }
        try {
          const dismissed = localStorage.getItem(LOCAL_GETTING_STARTED_DISMISSED_KEY);
          const openAIResponse = await settingsClient.getOpenAISettings();
          const hasOpenAIKey = Boolean(openAIResponse?.settings?.hasApiKey);
          const hasAwsEnvironment = (profile?.agentPermissionProfiles || []).some((permissionProfile) => {
            const type = String(permissionProfile?.type || '').trim().toLowerCase().replace(/_/g, ' ');
            return type === 'aws account';
          });
          if (!hasOpenAIKey || (!dismissed && !hasAwsEnvironment)) {
            setShowLocalGettingStarted(true);
          }
        } catch (setupCheckError) {
          console.warn('[local getting started] setup check failed', setupCheckError);
        }
      } catch (error) {
        console.error('Error:', error);
        dispatch(setUser(null));
        setLocalStartupError(error?.message || 'Failed to start local CloudAgent.');
        dispatch(setLoading(false));
      } finally {
        dispatch(setLoading(false));
      }
    };

    initAuth();
  }, [dispatch]);

  useEffect(() => {
    const connectionToastId = 'cloudagent-connection-status';

    const handleOnline = () => {
      if (isOnline) return;
      setIsOnline(true);
      toast.dismiss(connectionToastId);
      toast.success(
        () => (
          <div className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-green-500" />
            <span>Back online</span>
          </div>
        ),
        {
          id: connectionToastId,
          duration: 3000,
          style: {
            background: '#F0FDF4',
            border: '1px solid #86EFAC',
            color: '#166534',
          },
        }
      );
    };

    const handleOffline = () => {
      if (!isOnline) return;
      setIsOnline(false);
      toast.error(
        () => (
          <div className="flex items-center gap-2">
            <WifiOff className="h-5 w-5" />
            <span>No internet connection</span>
          </div>
        ),
        {
          id: connectionToastId,
          duration: Infinity,
          style: {
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#991B1B',
          },
        }
      );
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOnline]);

  const WorkflowDetailRedirect = () => {
    const { workflowId } = useParams();
    return (
      <Navigate to={`/dashboard/activity/workflows/${workflowId}`} replace />
    );
  };

  const NavigateToDashboardAgent = () => {
    const { recordId } = useParams();
    return <Navigate to={`/dashboard/agent/${recordId}`} replace />;
  };

  const NavigateToDashboardSkillEdit = () => {
    const { recordId } = useParams();
    return <Navigate to={`/dashboard/skill/edit/${recordId}`} replace />;
  };

  const NavigateToDashboardSkillEditLibrary = () => {
    const { planId } = useParams();
    return <Navigate to={`/dashboard/skill/edit/library/${planId}`} replace />;
  };

  const NavigateToDashboardLibraryItem = () => {
    const { type, planId } = useParams();
    return <Navigate to={`/dashboard/library/${type}/${planId}`} replace />;
  };

  const NavigateToDashboardSkillLibraryItem = () => {
    const { recordId } = useParams();
    return <Navigate to={`/dashboard/skill/${recordId}`} replace />;
  };

  const NavigateToDashboardReport = () => {
    const location = useLocation();
    return <Navigate to={defaultDashboardPath} replace state={location.state} />;
  };

  if (authLoading && !localStartupError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (localStartupError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">
            Local CloudAgent could not start
          </h1>
          <p className="mt-2 text-sm text-gray-600">{localStartupError}</p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <WorkloadDiscoveryBackgroundRunner />
      {isLocalMode && (
        <GettingStartedWizard
          open={showLocalGettingStarted}
          onComplete={() => {
            localStorage.setItem(LOCAL_GETTING_STARTED_DISMISSED_KEY, new Date().toISOString());
            setShowLocalGettingStarted(false);
          }}
        />
      )}
      {!isOnline && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-7xl mx-auto py-2 px-4">
            <div className="flex items-center justify-center gap-2 text-sm text-red-800">
              <WifiOff className="h-4 w-4" />
              <span>
                You are currently offline. Some features may be unavailable.
              </span>
            </div>
          </div>
        </div>
      )}
      <div className="flex-grow">
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>}>
          <Routes>
          <Route
            path="/"
            element={<Navigate to={defaultDashboardPath} replace />}
          />
          <Route
            path="/dashboard/cloudagent"
            element={<Navigate to={defaultDashboardPath} replace />}
          />

          {/* Protected Routes */}
          <Route
            path="/libraries/:categoryName?"
            element={<Navigate to="/dashboard/skills/library" replace />}
          />
          <Route
            path="/library"
            element={<Navigate to="/dashboard/skills/library" replace />}
          />
          <Route
            path="/library/:type/:planId"
            element={<NavigateToDashboardLibraryItem />}
          />
          <Route
            path="/blueprint/:recordId"
            element={<NavigateToDashboardSkillLibraryItem />}
          />
          <Route
            path="/skill/:recordId"
            element={<NavigateToDashboardSkillLibraryItem />}
          />
          {/* Legacy routes - redirect to dashboard versions */}
          <Route
            path="/blueprint/edit/:recordId"
            element={<NavigateToDashboardSkillEdit />}
          />
          <Route
            path="/skill/edit/:recordId"
            element={<NavigateToDashboardSkillEdit />}
          />
          <Route
            path="/blueprint/edit/library/:planId"
            element={<NavigateToDashboardSkillEditLibrary />}
          />
          <Route
            path="/skill/edit/library/:planId"
            element={<NavigateToDashboardSkillEditLibrary />}
          />
          <Route path="/agent/:recordId" element={<NavigateToDashboardAgent />} />
          <Route path="/report/:scanId" element={<NavigateToDashboardReport />} />
          <Route
            path="/package/:packageId"
            element={<Navigate to="/dashboard/skills/library" replace />}
          />

          <Route
            path="/blueprintbuilder"
            element={<Navigate to="/dashboard/skillbuilder" replace />}
          />
          <Route
            path="/skillbuilder"
            element={<Navigate to="/dashboard/skillbuilder" replace />}
          />
          <Route
            path="/library/workflow-template/:workflowId"
            element={<WorkflowOverview />}
          />
          <Route path="/workflow/:workflowId" element={<WorkflowEditor />} />
          <Route
            path="/settings"
            element={<Navigate to="/dashboard/preferences" replace />}
          />
          <Route
            path="/settings/*"
            element={<Navigate to="/dashboard/preferences" replace />}
          />
          <Route
            path="/dashboard"
            element={<DashboardLayout />}
          >
            <Route
              index
              element={<Navigate to={defaultDashboardPath} replace />}
            />
            <Route
              path="commandcenter"
              element={
                <DashboardCapabilityRoute capability="commandCenter">
                  <CommandCenterPage />
                </DashboardCapabilityRoute>
              }
            />
            <Route
              path="cloudagent"
              element={<Navigate to={defaultDashboardPath} replace />}
            />
            <Route
              path="command-center"
              element={<Navigate to={defaultDashboardPath} replace />}
            />
            <Route
              path="overview"
              element={
                <DashboardCapabilityRoute capability="commandCenter">
                  <OverviewPage />
                </DashboardCapabilityRoute>
              }
            />
            <Route path="cloud-setup" element={<CloudSetupPage />} />
            <Route path="local-readiness" element={<LocalReadinessPage />} />
            <Route path="preferences" element={<DashboardPreferencesPage />} />
            <Route path="workloads" element={<WorkloadsPage />} />
            <Route path="workload-standards" element={<WorkloadStandardsPage />} />
            <Route
              path="deployment-settings"
              element={<Navigate to="/dashboard/workload-standards" replace />}
            />
            <Route
              path="cost"
              element={
                <DashboardCapabilityRoute capability="cost">
                  <CostDashboard />
                </DashboardCapabilityRoute>
              }
            />
            <Route
              path="threat"
              element={
                <DashboardCapabilityRoute capability="threat">
                  <ThreatDashboard />
                </DashboardCapabilityRoute>
              }
            />
            <Route
              path="health"
              element={
                <DashboardCapabilityRoute capability="health">
                  <HealthDashboard />
                </DashboardCapabilityRoute>
              }
            />
            <Route
              path="permissions"
              element={<Navigate to="/dashboard/cloud-setup" replace />}
            />
            <Route path="recommendations" element={<Navigate to={defaultDashboardPath} replace />} />
            <Route
              path="executive-summaries"
              element={
                <DashboardCapabilityRoute capability="executiveSummaries">
                  <ExecutiveSummariesPage />
                </DashboardCapabilityRoute>
              }
            />

            {/* Workflow routes - workflow-history and library are tabs within workflow-def */}
            <Route
              path="workflow-def"
              element={<Navigate to={defaultDashboardPath} replace />}
            />
            <Route
              path="workflow-def/library"
              element={<Navigate to={defaultDashboardPath} replace />}
            />
            <Route
              path="workflow-template/:workflowId"
              element={<Navigate to={defaultDashboardPath} replace />}
            />
            <Route
              path="workflow-history"
              element={<Navigate to={defaultDashboardPath} replace />}
            />
            <Route
              path="workflow-history/:workflowId"
              element={<Navigate to={defaultDashboardPath} replace />}
            />

            {/* Skill Library routes */}
            <Route
              path="skills"
              element={<DashboardCapabilityRoute capability="blueprints"><MySkills /></DashboardCapabilityRoute>}
            />
            <Route
              path="skills/library"
              element={<DashboardCapabilityRoute capability="blueprints"><MySkills /></DashboardCapabilityRoute>}
            />
            <Route
              path="blueprints"
              element={<Navigate to={defaultDashboardPath} replace />}
            />
            <Route
              path="blueprints/library"
              element={<Navigate to={defaultDashboardPath} replace />}
            />

            {/* Agent History route */}
            <Route
              path="agents"
              element={<DashboardCapabilityRoute capability="blueprints"><MyAgents /></DashboardCapabilityRoute>}
            />

            <Route path="reports" element={<Navigate to={defaultDashboardPath} replace />} />
            <Route path="reports/library" element={<Navigate to={defaultDashboardPath} replace />} />
            <Route path="reports/:scanId" element={<Navigate to={defaultDashboardPath} replace />} />

            {/* MCP Settings route */}
            <Route
              path="mcp"
              element={<DashboardCapabilityRoute capability="mcp"><MCPPage /></DashboardCapabilityRoute>}
            />
            <Route path="teams" element={<Navigate to={defaultDashboardPath} replace />} />
            <Route path="credits" element={<Navigate to={defaultDashboardPath} replace />} />
            <Route path="workloads/:workloadId" element={<WorkloadDetailsPage />} />

            {/* Agent and Skill routes - render within dashboard layout */}
            <Route
              path="agent/:recordId"
              element={<DashboardCapabilityRoute capability="agents"><Agent /></DashboardCapabilityRoute>}
            />
            <Route
              path="library/:type/:planId"
              element={<DashboardCapabilityRoute capability="blueprints"><Library /></DashboardCapabilityRoute>}
            />
            <Route
              path="skill/:recordId"
              element={<DashboardCapabilityRoute capability="blueprints"><Library isBluePrint /></DashboardCapabilityRoute>}
            />
            <Route
              path="blueprint/:recordId"
              element={<NavigateToDashboardSkillLibraryItem />}
            />
            <Route
              path="skill/edit/:recordId"
              element={<DashboardCapabilityRoute capability="blueprints"><SkillBuilderEdit /></DashboardCapabilityRoute>}
            />
            <Route
              path="blueprint/edit/:recordId"
              element={<NavigateToDashboardSkillEdit />}
            />
            <Route
              path="skill/edit/library/:planId"
              element={<DashboardCapabilityRoute capability="blueprints"><SkillBuilderEdit source="library" /></DashboardCapabilityRoute>}
            />
            <Route
              path="blueprint/edit/library/:planId"
              element={<NavigateToDashboardSkillEditLibrary />}
            />
            <Route
              path="skillbuilder"
              element={<DashboardCapabilityRoute capability="blueprints"><SkillBuilder /></DashboardCapabilityRoute>}
            />
            <Route
              path="blueprintbuilder"
              element={<Navigate to="/dashboard/skillbuilder" replace />}
            />
          </Route>

          <Route
            path="*"
            element={<Navigate to={defaultDashboardPath} replace />}
          />
        </Routes>
        </Suspense>
      </div>
      <Toaster position="bottom-left" reverseOrder={false} />
    </div>
  );
};

export default App;
