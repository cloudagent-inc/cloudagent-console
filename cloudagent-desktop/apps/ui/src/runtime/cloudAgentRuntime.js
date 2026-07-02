const VITE_ENV =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : {};

const CLOUD_CAPABILITIES = Object.freeze({
  workloads: true,
  cloudSetup: true,
  executiveSummaries: true,
  health: true,
  cost: true,
  reports: false,
  recommendations: false,
  teams: false,
  integrations: true,
  mcp: true,
  commandCenter: true,
  automation: true,
  blueprints: true,
  agents: true,
  threat: true,
  credits: false,
  preferences: true,
});

const LOCAL_CAPABILITIES = Object.freeze({
  workloads: true,
  cloudSetup: true,
  executiveSummaries: true,
  commandCenter: true,
  preferences: true,
  automation: true,
  blueprints: true,
  agents: true,
  health: true,
  cost: true,
  reports: false,
  recommendations: false,
  teams: false,
  integrations: false,
  mcp: true,
  threat: true,
  credits: false,
});

const normalizeMode = (value) =>
  String(value || '').trim().toLowerCase() === 'local' ? 'local' : 'cloud';

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

const getInjectedRuntime = () => {
  if (typeof window === 'undefined') return {};
  return window.cloudAgentRuntime && typeof window.cloudAgentRuntime === 'object'
    ? window.cloudAgentRuntime
    : {};
};

export function getCloudAgentRuntime({ fallbackApiBaseUrl = '' } = {}) {
  const injected = getInjectedRuntime();
  const envMode =
    VITE_ENV.VITE_CLOUDAGENT_RUNTIME ||
    VITE_ENV.VITE_CLOUDAGENT_MODE ||
    VITE_ENV.VITE_RUNTIME_MODE;
  const envApiBaseUrl =
    VITE_ENV.VITE_CLOUDAGENT_API_BASE_URL ||
    VITE_ENV.VITE_BACKEND_API_ENDPOINT;
  const mode = normalizeMode(injected.mode || envMode || 'cloud');
  const localWindowOrigin =
    mode === 'local' && typeof window !== 'undefined'
      ? window.location.origin
      : '';
  const apiBaseUrl = trimTrailingSlash(
    mode === 'local'
      ? injected.apiBaseUrl ||
          (injected.mode ? localWindowOrigin : '') ||
          envApiBaseUrl ||
          fallbackApiBaseUrl ||
          localWindowOrigin
      : injected.apiBaseUrl || envApiBaseUrl || fallbackApiBaseUrl
  );
  const baseCapabilities =
    mode === 'local' ? LOCAL_CAPABILITIES : CLOUD_CAPABILITIES;

  return {
    mode,
    apiBaseUrl,
    capabilities: {
      ...baseCapabilities,
      ...(injected.capabilities || {}),
    },
  };
}

export const isLocalRuntime = () => getCloudAgentRuntime().mode === 'local';

export const hasRuntimeCapability = (capability) =>
  Boolean(getCloudAgentRuntime().capabilities?.[capability]);

export const getDefaultDashboardPath = () => '/dashboard/commandcenter';

export function getRuntimeApiUrl(path, options = {}) {
  const { apiBaseUrl } = getCloudAgentRuntime(options);
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimTrailingSlash(apiBaseUrl)}${normalizedPath}`;
}
