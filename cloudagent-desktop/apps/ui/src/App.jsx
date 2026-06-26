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
import { useAuth } from './hooks/useAuth';
import { useSEO } from './hooks/useSEO';
import toast from 'react-hot-toast';
import { Wifi, WifiOff } from 'lucide-react';
import {
  getDefaultDashboardPath,
  hasRuntimeCapability,
  isLocalRuntime,
} from './runtime/cloudAgentRuntime';

// Critical components - loaded immediately
import ProtectedRoute from './components/ProtectedRoute';
import WorkloadDiscoveryBackgroundRunner from './components/WorkloadDiscoveryBackgroundRunner';
import LocalGettingStartedWizard from './components/LocalGettingStartedWizard';
import { Button } from './components/ui/button';
import { localAwsClient } from './api/clients/localAwsClient';
import { localSettingsClient } from './api/clients/localSettingsClient';

// Lazy load all other routes
const Library = lazy(() => import('./pages/Libraries/Library'));
const LoginPage = lazy(() => import('./pages/Login'));
const DashboardLayout = lazy(() => import('./pages/Dashboard'));
const CommandCenterPage = lazy(() => import('./pages/Dashboard/CommandCenter'));
const ExecutiveSummariesPage = lazy(() =>
  import('./pages/Dashboard/ExecutiveSummaries')
);
const OverviewPage = lazy(() => import('./pages/Settings/Overview'));
const BlueprintBuilder = lazy(() => import('./pages/Agent/BlueprintBuilder'));
const BlueprintBuilderEdit = lazy(() => import('./pages/Agent/BlueprintBuilderEdit'));
const WorkflowDetailPage = lazy(() => import('./pages/Settings/WorkflowDetail'));
const WorkFlowDef = lazy(() => import('./pages/Settings/WorkFlowDef'));
const WorkflowEditor = lazy(() => import('./pages/Workflow'));
const WorkflowOverview = lazy(() => import('./pages/Workflow/WorkflowOverview'));
const Agent = lazy(() => import('./pages/Agent/Agent'));
const WorkloadDetailsPage = lazy(() => import('./pages/Dashboard/WorkloadDetails'));
const HealthDashboard = lazy(() => import('./pages/Dashboard/HealthDashboard'));
const CostDashboard = lazy(() => import('./pages/Dashboard/CostDashboard'));
const ThreatDashboard = lazy(() => import('./pages/Dashboard/ThreatDashboard'));
const CloudSetupPage = lazy(() => import('./pages/Dashboard/CloudSetup'));
const WorkloadsPage = lazy(() => import('./pages/Dashboard/Workloads'));
const DeploymentSettingsPage = lazy(() => import('./pages/Dashboard/DeploymentSettings'));
const DashboardPreferencesPage = lazy(() => import('./pages/Dashboard/Preferences'));
const MyBlueprints = lazy(() => import('./pages/Settings/MyBlueprint'));
const MCPPage = lazy(() => import('./pages/Settings/MCP'));
const IntegrationsPage = lazy(() => import('./pages/Settings/Integrations'));

const DashboardCapabilityRoute = ({ capability, children }) => {
  if (!hasRuntimeCapability(capability)) {
    return <Navigate to={getDefaultDashboardPath()} replace />;
  }

  return children;
};

const LOCAL_GETTING_STARTED_DISMISSED_KEY = 'cloudagent.localGettingStarted.dismissed.v1';

const App = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, loading: authLoading, userProfile } = useSelector(
    (state) => state.auth
  );
  const { checkAuthStatus } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [localStartupError, setLocalStartupError] = useState(null);
  const [showLocalGettingStarted, setShowLocalGettingStarted] = useState(false);
  const location = useLocation();
  const isLocalMode = isLocalRuntime();
  const defaultDashboardPath = getDefaultDashboardPath();

  // Ensure canonical + basic meta always track the current SPA route,
  // even for pages that don't call useSEO themselves.
  useSEO({});

  useEffect(() => {
    const initAuth = async () => {
      dispatch(setLoading(true));

      try {
        if (isLocalRuntime()) {
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
              await localAwsClient.validatePermissionProfiles();
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
            const openAIResponse = await localSettingsClient.getOpenAISettings();
            const hasOpenAIKey = Boolean(openAIResponse?.settings?.hasApiKey);
            const hasAwsEnvironment = (profile?.agentPermissionProfiles || []).some((permissionProfile) => {
              const type = String(permissionProfile?.type || '').trim().toLowerCase().replace(/_/g, ' ');
              return type === 'aws account';
            });
            if (!dismissed && (!hasOpenAIKey || !hasAwsEnvironment)) {
              setShowLocalGettingStarted(true);
            }
          } catch (setupCheckError) {
            console.warn('[local getting started] setup check failed', setupCheckError);
          }
          return;
        }

        const userData = await checkAuthStatus();

        if (userData) {
          dispatch(
            setUser({
              username: userData.username,
              userId: userData.userId,
              signInDetails: userData.signInDetails,
              isSignedIn: userData.isSignedIn,
            })
          );
        }
      } catch (error) {
        console.error('Error:', error);
        if (isLocalRuntime()) {
          dispatch(setUser(null));
          setLocalStartupError(error?.message || 'Failed to start local CloudAgent.');
          dispatch(setLoading(false));
        } else {
          dispatch(setUser(null));
        }
      } finally {
        dispatch(setLoading(false));
      }
    };

    initAuth();
  }, [dispatch]);

  useEffect(() => {
    let timeoutId;
    let toastId;

    const checkConnection = async () => {
      try {
        await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache',
        });

        if (!isOnline) {
          setIsOnline(true);
          toast.dismiss(toastId);
          toast.success(
            (t) => (
              <div className="flex items-center gap-2">
                <Wifi className="h-5 w-5 text-green-500" />
                <span>Back online</span>
              </div>
            ),
            {
              duration: 3000,
              style: {
                background: '#F0FDF4',
                border: '1px solid #86EFAC',
                color: '#166534',
              },
            }
          );
        }
      } catch {
        if (isOnline) {
          setIsOnline(false);
          toast.dismiss(toastId);
          toastId = toast.error(
            (t) => (
              <div className="flex items-center gap-2">
                <WifiOff className="h-5 w-5" />
                <span>No internet connection</span>
              </div>
            ),
            {
              duration: Infinity,
              style: {
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#991B1B',
              },
            }
          );
        }
      }
    };

    const debouncedCheck = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(checkConnection, 2000);
    };

    window.addEventListener('online', debouncedCheck);
    window.addEventListener('offline', debouncedCheck);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('online', debouncedCheck);
      window.removeEventListener('offline', debouncedCheck);
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

  const NavigateToDashboardBlueprintEdit = () => {
    const { recordId } = useParams();
    return <Navigate to={`/dashboard/blueprint/edit/${recordId}`} replace />;
  };

  const NavigateToDashboardBlueprintEditLibrary = () => {
    const { planId } = useParams();
    return <Navigate to={`/dashboard/blueprint/edit/library/${planId}`} replace />;
  };

  const NavigateToDashboardLibraryItem = () => {
    const { type, planId } = useParams();
    return <Navigate to={`/dashboard/library/${type}/${planId}`} replace />;
  };

  const NavigateToDashboardBlueprintLibraryItem = () => {
    const { recordId } = useParams();
    return <Navigate to={`/dashboard/library/blueprint/${recordId}`} replace />;
  };

  const NavigateToDashboardReport = () => {
    const location = useLocation();
    return <Navigate to={defaultDashboardPath} replace state={location.state} />;
  };

  if (
    !isLocalMode &&
    location.pathname !== '/login'
  ) {
    if (authLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      );
    }

    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }
  }

  if (isLocalMode && authLoading && !localStartupError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (isLocalMode && localStartupError) {
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
        <LocalGettingStartedWizard
          open={showLocalGettingStarted}
          existingProfiles={userProfile?.agentPermissionProfiles || []}
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
            path="/login"
            element={
              authLoading && !isAuthenticated && !isLocalMode ? (
                <div className="flex items-center justify-center min-h-screen">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
                </div>
              ) : (
                <LoginPage />
              )
            }
          />
          <Route
            path="/"
            element={
              isLocalMode ? (
                <Navigate to={defaultDashboardPath} replace />
              ) : authLoading ? (
                <div className="flex items-center justify-center min-h-screen">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
                </div>
              ) : isAuthenticated ? (
                <Navigate to={defaultDashboardPath} replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/dashbaord/cloudagent"
            element={<Navigate to={defaultDashboardPath} replace />}
          />

          {/* Protected Routes */}
          <Route
            path="/libraries/:categoryName?"
            element={<Navigate to="/dashboard/blueprints/library" replace />}
          />
          <Route
            path="/library"
            element={<Navigate to="/dashboard/blueprints/library" replace />}
          />
          <Route
            path="/library/:type/:planId"
            element={<NavigateToDashboardLibraryItem />}
          />
          <Route
            path="/blueprint/:recordId"
            element={<NavigateToDashboardBlueprintLibraryItem />}
          />
          {/* Legacy routes - redirect to dashboard versions */}
          <Route
            path="/blueprint/edit/:recordId"
            element={<NavigateToDashboardBlueprintEdit />}
          />
          <Route
            path="/blueprint/edit/library/:planId"
            element={<NavigateToDashboardBlueprintEditLibrary />}
          />
          <Route path="/agent/:recordId" element={<NavigateToDashboardAgent />} />
          <Route path="/report/:scanId" element={<NavigateToDashboardReport />} />
          <Route
            path="/package/:packageId"
            element={<Navigate to="/dashboard/blueprints/library" replace />}
          />

          <Route
            path="/blueprintbuilder"
            element={<Navigate to="/dashboard/blueprintbuilder" replace />}
          />
          <Route path="/compliance" element={<Navigate to={defaultDashboardPath} replace />} />
          <Route
            path="/library/workflow-template/:workflowId"
            element={<WorkflowOverview />}
          />
          <Route path="/workflow/:workflowId" element={<WorkflowEditor />} />
          <Route path="/compliance-summary" element={<Navigate to={defaultDashboardPath} replace />} />
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
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={<Navigate to={defaultDashboardPath} replace />}
            />
            <Route
              path="cloudagent"
              element={
                <DashboardCapabilityRoute capability="commandCenter">
                  <CommandCenterPage />
                </DashboardCapabilityRoute>
              }
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
            <Route path="preferences" element={<DashboardPreferencesPage />} />
            <Route path="workloads" element={<WorkloadsPage />} />
            <Route path="deployment-settings" element={<DeploymentSettingsPage />} />
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
            <Route path="compliance" element={<Navigate to={defaultDashboardPath} replace />} />
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
              element={<DashboardCapabilityRoute capability="automation"><WorkFlowDef /></DashboardCapabilityRoute>}
            />
            <Route
              path="workflow-def/library"
              element={<DashboardCapabilityRoute capability="automation"><WorkFlowDef /></DashboardCapabilityRoute>}
            />
            <Route
              path="workflow-template/:workflowId"
              element={<DashboardCapabilityRoute capability="automation"><WorkflowOverview /></DashboardCapabilityRoute>}
            />
            <Route
              path="workflow-history"
              element={<DashboardCapabilityRoute capability="automation"><WorkFlowDef /></DashboardCapabilityRoute>}
            />
            <Route
              path="workflow-history/:workflowId"
              element={<DashboardCapabilityRoute capability="automation"><WorkflowDetailPage /></DashboardCapabilityRoute>}
            />

            {/* Blueprints & Agents routes - agents is now a tab within blueprints */}
            <Route
              path="blueprints"
              element={<DashboardCapabilityRoute capability="blueprints"><MyBlueprints /></DashboardCapabilityRoute>}
            />
            <Route
              path="blueprints/library"
              element={<DashboardCapabilityRoute capability="blueprints"><MyBlueprints /></DashboardCapabilityRoute>}
            />
            <Route
              path="agents"
              element={<DashboardCapabilityRoute capability="agents"><MyBlueprints /></DashboardCapabilityRoute>}
            />

            <Route path="reports" element={<Navigate to={defaultDashboardPath} replace />} />
            <Route path="reports/library" element={<Navigate to={defaultDashboardPath} replace />} />
            <Route path="reports/:scanId" element={<Navigate to={defaultDashboardPath} replace />} />

            {/* Integrations route */}
            <Route
              path="integrations"
              element={<DashboardCapabilityRoute capability="integrations"><IntegrationsPage /></DashboardCapabilityRoute>}
            />

            {/* MCP Extension route */}
            <Route
              path="mcp"
              element={<DashboardCapabilityRoute capability="mcp"><MCPPage /></DashboardCapabilityRoute>}
            />
            <Route path="teams" element={<Navigate to={defaultDashboardPath} replace />} />
            <Route path="credits" element={<Navigate to={defaultDashboardPath} replace />} />
            <Route path="workloads/:workloadId" element={<WorkloadDetailsPage />} />

            {/* Agent and Blueprint routes - render within dashboard layout */}
            <Route
              path="agent/:recordId"
              element={<DashboardCapabilityRoute capability="agents"><Agent /></DashboardCapabilityRoute>}
            />
            <Route
              path="library/:type/:planId"
              element={<DashboardCapabilityRoute capability="blueprints"><Library /></DashboardCapabilityRoute>}
            />
            <Route
              path="blueprint/edit/:recordId"
              element={<DashboardCapabilityRoute capability="blueprints"><BlueprintBuilderEdit /></DashboardCapabilityRoute>}
            />
            <Route
              path="blueprint/edit/library/:planId"
              element={<DashboardCapabilityRoute capability="blueprints"><BlueprintBuilderEdit source="library" /></DashboardCapabilityRoute>}
            />
            <Route
              path="blueprintbuilder"
              element={<DashboardCapabilityRoute capability="blueprints"><BlueprintBuilder /></DashboardCapabilityRoute>}
            />
          </Route>

          <Route
            path="*"
            element={
              authLoading ? (
                <div className="flex items-center justify-center min-h-screen">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
                </div>
              ) : (
                <Navigate
                  to={isAuthenticated || isLocalMode ? defaultDashboardPath : '/login'}
                  replace
                />
              )
            }
          />
        </Routes>
        </Suspense>
      </div>
      <Toaster position="bottom-left" reverseOrder={false} />
    </div>
  );
};

export default App;
