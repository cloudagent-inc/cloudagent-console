import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Brain, Clock3, FileText, FolderOpen, Loader2, Settings2, TerminalSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { updateUserSettings } from '@/features/auth/authSlice';
import {
  getDashboardAutoRefreshOnLogin,
  buildUserSettingsWithDashboardPreferences,
  getDashboardRefreshPeriodsHours,
  MAX_REFRESH_PERIOD_HOURS,
  MIN_REFRESH_PERIOD_HOURS,
  resolveUserSettings,
  shouldRefreshExecutiveSummariesOnLogin,
} from '@/lib/userSettings';
import { codexClient } from '@/api/clients/codexClient';
import { localSettingsClient } from '@/api/clients/localSettingsClient';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';

function coerceRefreshPeriodInput(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.floor(numeric);
  if (rounded < MIN_REFRESH_PERIOD_HOURS) return fallback;
  if (rounded > MAX_REFRESH_PERIOD_HOURS) return MAX_REFRESH_PERIOD_HOURS;
  return rounded;
}

export default function PreferencesPage() {
  const dispatch = useDispatch();
  const userSettings = useSelector((state) => state.auth?.userProfile?.settings);
  const [isSaving, setIsSaving] = useState(false);

  const resolvedSettings = useMemo(
    () => resolveUserSettings(userSettings),
    [userSettings]
  );
  const refreshPeriods = useMemo(
    () => getDashboardRefreshPeriodsHours(resolvedSettings),
    [resolvedSettings]
  );
  const autoRefreshOnLogin = useMemo(
    () => getDashboardAutoRefreshOnLogin(resolvedSettings),
    [resolvedSettings]
  );
  const executiveSummariesOnLogin = useMemo(
    () => shouldRefreshExecutiveSummariesOnLogin(resolvedSettings),
    [resolvedSettings]
  );

  const [healthHours, setHealthHours] = useState(String(refreshPeriods.health));
  const [costHours, setCostHours] = useState(String(refreshPeriods.cost));
  const [threatHours, setThreatHours] = useState(String(refreshPeriods.threat));
  const [healthAutoRefreshEnabled, setHealthAutoRefreshEnabled] = useState(autoRefreshOnLogin.health);
  const [costAutoRefreshEnabled, setCostAutoRefreshEnabled] = useState(autoRefreshOnLogin.cost);
  const [threatAutoRefreshEnabled, setThreatAutoRefreshEnabled] = useState(autoRefreshOnLogin.threat);
  const [refreshExecutiveSummaries, setRefreshExecutiveSummaries] = useState(
    executiveSummariesOnLogin
  );
  const [codexSettings, setCodexSettings] = useState(null);
  const [codexSkillsDir, setCodexSkillsDir] = useState('');
  const [codexWorkspaceDir, setCodexWorkspaceDir] = useState('');
  const [openAISettings, setOpenAISettings] = useState(null);
  const [openAIModel, setOpenAIModel] = useState('gpt-5.4');
  const [openAIKey, setOpenAIKey] = useState('');
  const [clearOpenAIKey, setClearOpenAIKey] = useState(false);
  const [localRuntimeInfo, setLocalRuntimeInfo] = useState(null);
  const [localDataDir, setLocalDataDir] = useState('');
  const [hasSavedDirectoryChange, setHasSavedDirectoryChange] = useState(false);
  const isLocalMode = isLocalRuntime();

  useEffect(() => {
    setHealthHours(String(refreshPeriods.health));
    setCostHours(String(refreshPeriods.cost));
    setThreatHours(String(refreshPeriods.threat));
    setHealthAutoRefreshEnabled(autoRefreshOnLogin.health);
    setCostAutoRefreshEnabled(autoRefreshOnLogin.cost);
    setThreatAutoRefreshEnabled(autoRefreshOnLogin.threat);
    setRefreshExecutiveSummaries(executiveSummariesOnLogin);
  }, [
    autoRefreshOnLogin.cost,
    autoRefreshOnLogin.health,
    autoRefreshOnLogin.threat,
    executiveSummariesOnLogin,
    refreshPeriods.cost,
    refreshPeriods.health,
    refreshPeriods.threat,
  ]);

  useEffect(() => {
    if (!isLocalMode) return;
    let mounted = true;
    Promise.all([
      codexClient.getSettings(),
      localSettingsClient.getOpenAISettings(),
      typeof window !== 'undefined' && typeof window.cloudAgentRuntime?.getLocalRuntimeInfo === 'function'
        ? window.cloudAgentRuntime.getLocalRuntimeInfo().catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([codexResponse, openAIResponse, runtimeResponse]) => {
        if (!mounted) return;
        const settings = codexResponse?.settings || {};
        setCodexSettings(settings);
        setCodexSkillsDir(settings.skillsDir || '');
        setCodexWorkspaceDir(settings.workspaceDir || '');
        const nextOpenAISettings = openAIResponse?.settings || {};
        setOpenAISettings(nextOpenAISettings);
        setOpenAIModel(nextOpenAISettings.model || 'gpt-5.4');
        setLocalRuntimeInfo(runtimeResponse || null);
        setLocalDataDir(runtimeResponse?.configuredLocalDataDir || runtimeResponse?.localDataDir || '');
        setHasSavedDirectoryChange(Boolean(runtimeResponse?.localDataDirPendingRestart));
      })
      .catch((error) => {
        console.warn('Failed to load local settings', error);
      });
    return () => {
      mounted = false;
    };
  }, [isLocalMode]);

  const localDataDirectoryEdited = Boolean(
    isLocalMode &&
    localRuntimeInfo &&
    localDataDir.trim() &&
    localDataDir !== (localRuntimeInfo.configuredLocalDataDir || localRuntimeInfo.localDataDir || '')
  );
  const restartRequired = Boolean(localRuntimeInfo?.localDataDirPendingRestart || hasSavedDirectoryChange);

  const hasChanges =
    Number(healthHours) !== refreshPeriods.health ||
    Number(costHours) !== refreshPeriods.cost ||
    Number(threatHours) !== refreshPeriods.threat ||
    healthAutoRefreshEnabled !== autoRefreshOnLogin.health ||
    costAutoRefreshEnabled !== autoRefreshOnLogin.cost ||
    threatAutoRefreshEnabled !== autoRefreshOnLogin.threat ||
    refreshExecutiveSummaries !== executiveSummariesOnLogin ||
    (isLocalMode && openAISettings && (
      openAIModel !== (openAISettings.model || 'gpt-5.4') ||
      openAIKey.trim().length > 0 ||
      clearOpenAIKey
    )) ||
    localDataDirectoryEdited ||
    (isLocalMode && codexSettings && (
      codexSkillsDir !== (codexSettings.skillsDir || '') ||
      codexWorkspaceDir !== (codexSettings.workspaceDir || '')
    ));

  const handleSave = async () => {
    const nextHealth = coerceRefreshPeriodInput(healthHours, refreshPeriods.health);
    const nextCost = coerceRefreshPeriodInput(costHours, refreshPeriods.cost);
    const nextThreat = coerceRefreshPeriodInput(threatHours, refreshPeriods.threat);

    setIsSaving(true);
    try {
      const nextSettings = buildUserSettingsWithDashboardPreferences(resolvedSettings, {
        refreshPeriodsHours: {
          health: nextHealth,
          cost: nextCost,
          threat: nextThreat,
        },
        autoRefreshOnLogin: {
          health: healthAutoRefreshEnabled,
          cost: costAutoRefreshEnabled,
          threat: threatAutoRefreshEnabled,
        },
        refreshExecutiveSummariesOnLogin: refreshExecutiveSummaries,
      });

      await dispatch(updateUserSettings({ settings: nextSettings })).unwrap();
      if (isLocalMode) {
        const localDataDirectoryChanged =
          localDataDir.trim() &&
          localDataDir !== (localRuntimeInfo?.configuredLocalDataDir || localRuntimeInfo?.localDataDir || '');
        if (
          localDataDirectoryChanged &&
          typeof window.cloudAgentRuntime?.setLocalDataDir === 'function'
        ) {
          const runtimeResponse = await window.cloudAgentRuntime.setLocalDataDir(localDataDir.trim());
          if (runtimeResponse?.ok === false) {
            throw new Error(runtimeResponse.error || 'Failed to save local data directory');
          }
          setLocalRuntimeInfo(runtimeResponse || null);
          setLocalDataDir(runtimeResponse?.configuredLocalDataDir || runtimeResponse?.localDataDir || localDataDir);
          setHasSavedDirectoryChange(Boolean(runtimeResponse?.localDataDirPendingRestart));
          window.dispatchEvent(new CustomEvent('cloudagent:local-runtime-settings-updated', {
            detail: runtimeResponse,
          }));
          if (runtimeResponse?.warning) toast(runtimeResponse.warning);
          if (runtimeResponse?.localDataDirPendingRestart) {
            toast.success('Local data directory saved. Restart CloudAgent to use it.');
            return;
          }
        }

        const openAIResponse = await localSettingsClient.updateOpenAISettings({
          model: openAIModel,
          ...(openAIKey.trim() ? { apiKey: openAIKey.trim() } : {}),
          clearApiKey: clearOpenAIKey,
        });
        const nextOpenAISettings = openAIResponse?.settings || {};
        setOpenAISettings(nextOpenAISettings);
        setOpenAIModel(nextOpenAISettings.model || openAIModel || 'gpt-5.4');
        setOpenAIKey('');
        setClearOpenAIKey(false);
        window.dispatchEvent(new CustomEvent('cloudagent:openai-settings-updated', {
          detail: nextOpenAISettings,
        }));

        const response = await codexClient.updateSettings({
          skillsDir: codexSkillsDir,
          workspaceDir: codexWorkspaceDir,
        });
        const nextCodexSettings = response?.settings || {};
        setCodexSettings(nextCodexSettings);
        setCodexSkillsDir(nextCodexSettings.skillsDir || codexSkillsDir);
        setCodexWorkspaceDir(nextCodexSettings.workspaceDir || codexWorkspaceDir);
      }
      toast.success('Preferences saved');
      setHealthHours(String(nextHealth));
      setCostHours(String(nextCost));
      setThreatHours(String(nextThreat));
    } catch (error) {
      toast.error(error?.message || 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const restartApp = async () => {
    if (typeof window.cloudAgentRuntime?.restartApp !== 'function') {
      window.location.reload();
      return;
    }
    await window.cloudAgentRuntime.restartApp();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
          <Settings2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Preferences</h1>
          <p className="mt-1 text-sm text-gray-600">
            Control when dashboard data refreshes are requested on login and whether executive
            summaries are loaded automatically.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-slate-600" />
            <CardTitle>Data Refresh Interval</CardTitle>
          </div>
          <CardDescription>
            Control whether each report type refreshes automatically on login and how old the
            stored data can be before a refresh is requested.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <Label htmlFor="health-refresh-hours">Health refresh threshold (hours)</Label>
                <Input
                  id="health-refresh-hours"
                  type="number"
                  min={MIN_REFRESH_PERIOD_HOURS}
                  max={MAX_REFRESH_PERIOD_HOURS}
                  step="1"
                  value={healthHours}
                  disabled={!healthAutoRefreshEnabled}
                  onChange={(event) => setHealthHours(event.target.value)}
                  className="md:w-48"
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 md:min-w-80">
                <Label htmlFor="disable-health-auto-refresh" className="text-sm font-medium">
                  Disable auto-refresh on login
                </Label>
                <Switch
                  id="disable-health-auto-refresh"
                  checked={!healthAutoRefreshEnabled}
                  onCheckedChange={(checked) => setHealthAutoRefreshEnabled(!checked)}
                  className="data-[state=checked]:!bg-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <Label htmlFor="cost-refresh-hours">Cost refresh threshold (hours)</Label>
                <Input
                  id="cost-refresh-hours"
                  type="number"
                  min={MIN_REFRESH_PERIOD_HOURS}
                  max={MAX_REFRESH_PERIOD_HOURS}
                  step="1"
                  value={costHours}
                  disabled={!costAutoRefreshEnabled}
                  onChange={(event) => setCostHours(event.target.value)}
                  className="md:w-48"
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 md:min-w-80">
                <Label htmlFor="disable-cost-auto-refresh" className="text-sm font-medium">
                  Disable auto-refresh on login
                </Label>
                <Switch
                  id="disable-cost-auto-refresh"
                  checked={!costAutoRefreshEnabled}
                  onCheckedChange={(checked) => setCostAutoRefreshEnabled(!checked)}
                  className="data-[state=checked]:!bg-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <Label htmlFor="threat-refresh-hours">Threat refresh threshold (hours)</Label>
                <Input
                  id="threat-refresh-hours"
                  type="number"
                  min={MIN_REFRESH_PERIOD_HOURS}
                  max={MAX_REFRESH_PERIOD_HOURS}
                  step="1"
                  value={threatHours}
                  disabled={!threatAutoRefreshEnabled}
                  onChange={(event) => setThreatHours(event.target.value)}
                  className="md:w-48"
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 md:min-w-80">
                <Label htmlFor="disable-threat-auto-refresh" className="text-sm font-medium">
                  Disable auto-refresh on login
                </Label>
                <Switch
                  id="disable-threat-auto-refresh"
                  checked={!threatAutoRefreshEnabled}
                  onCheckedChange={(checked) => setThreatAutoRefreshEnabled(!checked)}
                  className="data-[state=checked]:!bg-blue-500"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-600" />
            <CardTitle>Executive Summaries</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="refresh-executive-summaries" className="text-sm font-medium">
              Auto-refresh when new data is available
            </Label>
            <Switch
              id="refresh-executive-summaries"
              checked={refreshExecutiveSummaries}
              onCheckedChange={setRefreshExecutiveSummaries}
              className="data-[state=checked]:!bg-blue-500"
            />
          </div>
        </CardContent>
      </Card>

      {isLocalMode && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-slate-600" />
                <CardTitle>Local Data</CardTitle>
              </div>
              <CardDescription>
                Choose where CloudAgent stores local environments, workloads, scans, run history,
                and settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="local-data-dir">Local data directory</Label>
                <Input
                  id="local-data-dir"
                  value={localDataDir}
                  onChange={(event) => setLocalDataDir(event.target.value)}
                  placeholder="/path/to/cloudagent-local-data"
                  className="font-mono text-sm"
                />
              </div>
              <p className="text-xs text-slate-500">
                {localRuntimeInfo?.localDataDirSource === 'environment'
                  ? 'CLOUDAGENT_LOCAL_DATA_DIR is set for this launch. The saved preference applies after restarting without that env var.'
                  : 'Changes apply after restarting the desktop app.'}
              </p>
              {restartRequired && (
                <p className="text-xs font-medium text-amber-700">
                  Restart required to use the saved directory.
                </p>
              )}
              {restartRequired && (
                <Button type="button" size="sm" onClick={restartApp}>
                  Restart CloudAgent
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-slate-600" />
                <CardTitle>OpenAI</CardTitle>
              </div>
              <CardDescription>
                Used by local CloudAgent chat, blueprint review, workload discovery, diagrams, and
                executive summaries.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="openai-model">Model</Label>
                  <Input
                    id="openai-model"
                    value={openAIModel}
                    onChange={(event) => setOpenAIModel(event.target.value)}
                    placeholder="gpt-5.4"
                    disabled={localDataDirectoryEdited || restartRequired}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openai-api-key">API key</Label>
                  <Input
                    id="openai-api-key"
                    type="password"
                    value={openAIKey}
                    onChange={(event) => {
                      setOpenAIKey(event.target.value);
                      if (event.target.value.trim()) setClearOpenAIKey(false);
                    }}
                    placeholder={
                      openAISettings?.hasApiKey
                        ? `Saved ${openAISettings.apiKeyMasked || ''}`.trim()
                        : 'sk-...'
                    }
                    autoComplete="off"
                    disabled={localDataDirectoryEdited || restartRequired}
                  />
                </div>
              </div>
              {localDataDirectoryEdited && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Save the local data directory first, then restart CloudAgent before saving OpenAI settings.
                </div>
              )}
              {openAISettings?.hasApiKey && (
                <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <Label htmlFor="clear-openai-key" className="text-sm font-medium">
                      Remove saved OpenAI key on save
                    </Label>
                    <p className="mt-1 text-xs text-slate-500">
                      Leave this off to keep the existing saved key.
                    </p>
                  </div>
                  <Switch
                    id="clear-openai-key"
                    checked={clearOpenAIKey}
                    onCheckedChange={(checked) => {
                      setClearOpenAIKey(checked);
                      if (checked) setOpenAIKey('');
                    }}
                    disabled={localDataDirectoryEdited || restartRequired}
                    className="data-[state=checked]:!bg-blue-500"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TerminalSquare className="h-5 w-5 text-slate-600" />
                <CardTitle>Codex</CardTitle>
              </div>
              <CardDescription>
                Choose where CloudAgent stores Codex skill files and where Codex runs blueprint
                workspaces locally.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="codex-skills-dir" className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Codex skills directory
                </Label>
                <Input
                  id="codex-skills-dir"
                  value={codexSkillsDir}
                  onChange={(event) => setCodexSkillsDir(event.target.value)}
                  placeholder="/path/to/codex-skills"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codex-workspace-dir" className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Codex run workspace directory
                </Label>
                <Input
                  id="codex-workspace-dir"
                  value={codexWorkspaceDir}
                  onChange={(event) => setCodexWorkspaceDir(event.target.value)}
                  placeholder="/path/to/run-workspaces"
                  className="font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={isSaving || !hasChanges}
          onClick={() => {
            setHealthHours(String(refreshPeriods.health));
            setCostHours(String(refreshPeriods.cost));
            setThreatHours(String(refreshPeriods.threat));
            setHealthAutoRefreshEnabled(autoRefreshOnLogin.health);
            setCostAutoRefreshEnabled(autoRefreshOnLogin.cost);
            setThreatAutoRefreshEnabled(autoRefreshOnLogin.threat);
            setRefreshExecutiveSummaries(executiveSummariesOnLogin);
            if (codexSettings) {
              setCodexSkillsDir(codexSettings.skillsDir || '');
              setCodexWorkspaceDir(codexSettings.workspaceDir || '');
            }
            if (openAISettings) {
              setOpenAIModel(openAISettings.model || 'gpt-5.4');
              setOpenAIKey('');
              setClearOpenAIKey(false);
            }
            if (localRuntimeInfo) {
              setLocalDataDir(localRuntimeInfo.configuredLocalDataDir || localRuntimeInfo.localDataDir || '');
            }
          }}
        >
          Reset
        </Button>
        <Button type="button" disabled={isSaving || !hasChanges} onClick={handleSave}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving
            </>
          ) : (
            localDataDirectoryEdited ? 'Save Directory' : 'Save Preferences'
          )}
        </Button>
      </div>
    </div>
  );
}
