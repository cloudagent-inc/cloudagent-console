const DEFAULT_REFRESH_PERIOD_HOURS = 72;
const MIN_REFRESH_PERIOD_HOURS = 1;
const MAX_REFRESH_PERIOD_HOURS = 24 * 30;
const DEFAULT_AUTO_REFRESH_ON_LOGIN = true;
const DEFAULT_COMMAND_CENTER_AGENT_RUNNER = 'cloudagent';
const COMMAND_CENTER_AGENT_RUNNERS = ['cloudagent', 'codex', 'claude', 'cursor'];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeParseSettings(value) {
  if (!value) return {};
  if (isPlainObject(value)) return value;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeRefreshHours(value, fallback = DEFAULT_REFRESH_PERIOD_HOURS) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.floor(numeric);
  if (rounded < MIN_REFRESH_PERIOD_HOURS) return fallback;
  if (rounded > MAX_REFRESH_PERIOD_HOURS) return MAX_REFRESH_PERIOD_HOURS;
  return rounded;
}

function normalizeAutoRefreshEnabled(value, fallback = DEFAULT_AUTO_REFRESH_ON_LOGIN) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

export function normalizeCommandCenterAgentRunner(value, fallback = DEFAULT_COMMAND_CENTER_AGENT_RUNNER) {
  const normalized = String(value || '').trim().toLowerCase();
  if (COMMAND_CENTER_AGENT_RUNNERS.includes(normalized)) return normalized;
  const normalizedFallback = String(fallback || '').trim().toLowerCase();
  if (COMMAND_CENTER_AGENT_RUNNERS.includes(normalizedFallback)) return normalizedFallback;
  return DEFAULT_COMMAND_CENTER_AGENT_RUNNER;
}

export function resolveUserSettings(rawSettings) {
  const parsed = safeParseSettings(rawSettings);
  const dashboardPreferences = isPlainObject(parsed.dashboardPreferences)
    ? parsed.dashboardPreferences
    : {};
  const refreshPeriodsHours = isPlainObject(dashboardPreferences.refreshPeriodsHours)
    ? dashboardPreferences.refreshPeriodsHours
    : {};
  const autoRefreshOnLogin = isPlainObject(dashboardPreferences.autoRefreshOnLogin)
    ? dashboardPreferences.autoRefreshOnLogin
    : {};

  return {
    ...parsed,
    dashboardPreferences: {
      ...dashboardPreferences,
      refreshPeriodsHours: {
        health: normalizeRefreshHours(refreshPeriodsHours.health),
        cost: normalizeRefreshHours(refreshPeriodsHours.cost),
        threat: normalizeRefreshHours(refreshPeriodsHours.threat),
      },
      autoRefreshOnLogin: {
        health: normalizeAutoRefreshEnabled(autoRefreshOnLogin.health),
        cost: normalizeAutoRefreshEnabled(autoRefreshOnLogin.cost),
        threat: normalizeAutoRefreshEnabled(autoRefreshOnLogin.threat),
      },
      defaultCommandCenterAgentRunner: normalizeCommandCenterAgentRunner(
        dashboardPreferences.defaultCommandCenterAgentRunner
      ),
      refreshExecutiveSummariesOnLogin:
        dashboardPreferences.refreshExecutiveSummariesOnLogin === true,
    },
  };
}

export function buildUserSettingsWithDashboardPreferences(rawSettings, dashboardPreferenceUpdates = {}) {
  const resolved = resolveUserSettings(rawSettings);
  const existingDashboardPreferences = resolved.dashboardPreferences || {};
  const existingRefreshPeriods = existingDashboardPreferences.refreshPeriodsHours || {};
  const existingAutoRefreshOnLogin = existingDashboardPreferences.autoRefreshOnLogin || {};
  const nextRefreshPeriodsInput = isPlainObject(dashboardPreferenceUpdates.refreshPeriodsHours)
    ? dashboardPreferenceUpdates.refreshPeriodsHours
    : {};
  const nextAutoRefreshInput = isPlainObject(dashboardPreferenceUpdates.autoRefreshOnLogin)
    ? dashboardPreferenceUpdates.autoRefreshOnLogin
    : {};

  return {
    ...resolved,
    dashboardPreferences: {
      ...existingDashboardPreferences,
      ...dashboardPreferenceUpdates,
      refreshPeriodsHours: {
        ...existingRefreshPeriods,
        ...(Object.prototype.hasOwnProperty.call(nextRefreshPeriodsInput, 'health')
          ? { health: normalizeRefreshHours(nextRefreshPeriodsInput.health) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(nextRefreshPeriodsInput, 'cost')
          ? { cost: normalizeRefreshHours(nextRefreshPeriodsInput.cost) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(nextRefreshPeriodsInput, 'threat')
          ? { threat: normalizeRefreshHours(nextRefreshPeriodsInput.threat) }
          : {}),
      },
      autoRefreshOnLogin: {
        ...existingAutoRefreshOnLogin,
        ...(Object.prototype.hasOwnProperty.call(nextAutoRefreshInput, 'health')
          ? { health: normalizeAutoRefreshEnabled(nextAutoRefreshInput.health) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(nextAutoRefreshInput, 'cost')
          ? { cost: normalizeAutoRefreshEnabled(nextAutoRefreshInput.cost) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(nextAutoRefreshInput, 'threat')
          ? { threat: normalizeAutoRefreshEnabled(nextAutoRefreshInput.threat) }
          : {}),
      },
      ...(Object.prototype.hasOwnProperty.call(
        dashboardPreferenceUpdates,
        'refreshExecutiveSummariesOnLogin'
      )
        ? {
            refreshExecutiveSummariesOnLogin:
              dashboardPreferenceUpdates.refreshExecutiveSummariesOnLogin === true,
          }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(
        dashboardPreferenceUpdates,
        'defaultCommandCenterAgentRunner'
      )
        ? {
            defaultCommandCenterAgentRunner: normalizeCommandCenterAgentRunner(
              dashboardPreferenceUpdates.defaultCommandCenterAgentRunner,
              existingDashboardPreferences.defaultCommandCenterAgentRunner
            ),
          }
        : {}),
    },
  };
}

export function getDashboardRefreshPeriodsHours(rawSettings) {
  return resolveUserSettings(rawSettings).dashboardPreferences.refreshPeriodsHours;
}

export function getDashboardAutoRefreshOnLogin(rawSettings) {
  return resolveUserSettings(rawSettings).dashboardPreferences.autoRefreshOnLogin;
}

export function getDashboardRefreshPeriodHours(rawSettings, reportType) {
  const refreshPeriods = getDashboardRefreshPeriodsHours(rawSettings);
  const normalizedReportType = String(reportType || '').trim().toLowerCase();

  if (normalizedReportType === 'health') return refreshPeriods.health;
  if (normalizedReportType === 'cost') return refreshPeriods.cost;
  if (normalizedReportType === 'threat') return refreshPeriods.threat;
  return DEFAULT_REFRESH_PERIOD_HOURS;
}

export function shouldRefreshExecutiveSummariesOnLogin(rawSettings) {
  return resolveUserSettings(rawSettings).dashboardPreferences.refreshExecutiveSummariesOnLogin;
}

export function getDefaultCommandCenterAgentRunner(rawSettings) {
  return resolveUserSettings(rawSettings).dashboardPreferences.defaultCommandCenterAgentRunner;
}

export {
  DEFAULT_AUTO_REFRESH_ON_LOGIN,
  DEFAULT_COMMAND_CENTER_AGENT_RUNNER,
  DEFAULT_REFRESH_PERIOD_HOURS,
  MAX_REFRESH_PERIOD_HOURS,
  MIN_REFRESH_PERIOD_HOURS,
};
