import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
  Bot,
  Brain,
  Clock3,
  FileText,
  FolderOpen,
  FolderSearch,
  Loader2,
  Settings2,
  TerminalSquare,
} from 'lucide-react';
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
  getDefaultCommandCenterAgentRunner,
  MAX_REFRESH_PERIOD_HOURS,
  MIN_REFRESH_PERIOD_HOURS,
  resolveUserSettings,
  shouldRefreshExecutiveSummariesOnLogin,
} from '@/lib/userSettings';
import {
  COMMAND_CENTER_AGENT_RUNNERS,
  getCommandCenterAgentReadiness,
  getCommandCenterRunnerIcon,
} from '@/lib/agentRunners';
import { useAgentReadiness } from '@/hooks/useAgentReadiness';
import { codexClient } from '@/api/clients/codexClient';
import { settingsClient } from '@/api/clients/settingsClient';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';

const DEFAULT_CURSOR_AGENT_BINARY = 'cursor-agent';
const DEFAULT_CODEX_BINARY = 'codex';
const DEFAULT_IAC_TOOL_SETTINGS = {
  terraformBinary: 'terraform',
  opentofuBinary: 'tofu',
  trivyBinary: 'trivy',
  cfnGuardBinary: 'cfn-guard',
  cfnLintBinary: 'cfn-lint',
  githubBinary: 'gh',
};

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
  const persistedDefaultCommandCenterAgent = useMemo(
    () => getDefaultCommandCenterAgentRunner(resolvedSettings),
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
  const [defaultCommandCenterAgent, setDefaultCommandCenterAgent] = useState(
    persistedDefaultCommandCenterAgent
  );
  const [codexSettings, setCodexSettings] = useState(null);
  const [codexEnabled, setCodexEnabled] = useState(true);
  const [codexWorkspaceDir, setCodexWorkspaceDir] = useState('');
  const [codexBinary, setCodexBinary] = useState(DEFAULT_CODEX_BINARY);
  const [claudeEnabled, setClaudeEnabled] = useState(true);
  const [claudeWorkspaceDir, setClaudeWorkspaceDir] = useState('');
  const [claudeBinary, setClaudeBinary] = useState('claude');
  const [cursorEnabled, setCursorEnabled] = useState(true);
  const [cursorWorkspaceDir, setCursorWorkspaceDir] = useState('');
  const [cursorBinary, setCursorBinary] = useState(DEFAULT_CURSOR_AGENT_BINARY);
  const [iacToolSettings, setIacToolSettings] = useState(null);
  const [terraformBinary, setTerraformBinary] = useState(DEFAULT_IAC_TOOL_SETTINGS.terraformBinary);
  const [opentofuBinary, setOpentofuBinary] = useState(DEFAULT_IAC_TOOL_SETTINGS.opentofuBinary);
  const [trivyBinary, setTrivyBinary] = useState(DEFAULT_IAC_TOOL_SETTINGS.trivyBinary);
  const [cfnGuardBinary, setCfnGuardBinary] = useState(DEFAULT_IAC_TOOL_SETTINGS.cfnGuardBinary);
  const [cfnLintBinary, setCfnLintBinary] = useState(DEFAULT_IAC_TOOL_SETTINGS.cfnLintBinary);
  const [githubBinary, setGithubBinary] = useState(DEFAULT_IAC_TOOL_SETTINGS.githubBinary);
  const [openAISettings, setOpenAISettings] = useState(null);
  const [openAIModel, setOpenAIModel] = useState('gpt-5.4');
  const [openAIKey, setOpenAIKey] = useState('');
  const [clearOpenAIKey, setClearOpenAIKey] = useState(false);
  const [localRuntimeInfo, setLocalRuntimeInfo] = useState(null);
  const [localDataDir, setLocalDataDir] = useState('');
  const [hasSavedDirectoryChange, setHasSavedDirectoryChange] = useState(false);
  const isLocalMode = isLocalRuntime();
  const {
    readinessStatus: localAgentReadinessStatus,
    isReadinessLoading: isLocalAgentReadinessLoading,
  } = useAgentReadiness({ enabled: isLocalMode });

  useEffect(() => {
    setHealthHours(String(refreshPeriods.health));
    setCostHours(String(refreshPeriods.cost));
    setThreatHours(String(refreshPeriods.threat));
    setHealthAutoRefreshEnabled(autoRefreshOnLogin.health);
    setCostAutoRefreshEnabled(autoRefreshOnLogin.cost);
    setThreatAutoRefreshEnabled(autoRefreshOnLogin.threat);
    setRefreshExecutiveSummaries(executiveSummariesOnLogin);
    setDefaultCommandCenterAgent(persistedDefaultCommandCenterAgent);
  }, [
    autoRefreshOnLogin.cost,
    autoRefreshOnLogin.health,
    autoRefreshOnLogin.threat,
    executiveSummariesOnLogin,
    persistedDefaultCommandCenterAgent,
    refreshPeriods.cost,
    refreshPeriods.health,
    refreshPeriods.threat,
  ]);

  useEffect(() => {
    if (!isLocalMode) return;
    let mounted = true;
    Promise.all([
      codexClient.getSettings(),
      settingsClient.getOpenAISettings(),
      settingsClient.getIacToolSettings(),
      typeof window !== 'undefined' && typeof window.cloudAgentRuntime?.getLocalRuntimeInfo === 'function'
        ? window.cloudAgentRuntime.getLocalRuntimeInfo().catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([codexResponse, openAIResponse, iacToolsResponse, runtimeResponse]) => {
        if (!mounted) return;
        const settings = codexResponse?.settings || {};
        setCodexSettings(settings);
        setCodexEnabled(settings.enabled !== false);
        setCodexWorkspaceDir(settings.workspaceDir || '');
        setCodexBinary(settings.binary || DEFAULT_CODEX_BINARY);
        setClaudeEnabled(settings.claude?.enabled !== false);
        setClaudeWorkspaceDir(settings.claude?.workspaceDir || '');
        setClaudeBinary(settings.claude?.binary || 'claude');
        setCursorEnabled(settings.cursor?.enabled !== false);
        setCursorWorkspaceDir(settings.cursor?.workspaceDir || '');
        setCursorBinary(settings.cursor?.binary || DEFAULT_CURSOR_AGENT_BINARY);
        const nextIacToolSettings = iacToolsResponse?.settings || DEFAULT_IAC_TOOL_SETTINGS;
        setIacToolSettings(nextIacToolSettings);
        setTerraformBinary(nextIacToolSettings.terraformBinary || DEFAULT_IAC_TOOL_SETTINGS.terraformBinary);
        setOpentofuBinary(nextIacToolSettings.opentofuBinary || DEFAULT_IAC_TOOL_SETTINGS.opentofuBinary);
        setTrivyBinary(nextIacToolSettings.trivyBinary || DEFAULT_IAC_TOOL_SETTINGS.trivyBinary);
        setCfnGuardBinary(nextIacToolSettings.cfnGuardBinary || DEFAULT_IAC_TOOL_SETTINGS.cfnGuardBinary);
        setCfnLintBinary(nextIacToolSettings.cfnLintBinary || DEFAULT_IAC_TOOL_SETTINGS.cfnLintBinary);
        setGithubBinary(nextIacToolSettings.githubBinary || DEFAULT_IAC_TOOL_SETTINGS.githubBinary);
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
    defaultCommandCenterAgent !== persistedDefaultCommandCenterAgent ||
    (isLocalMode && openAISettings && (
      openAIModel !== (openAISettings.model || 'gpt-5.4') ||
      openAIKey.trim().length > 0 ||
      clearOpenAIKey
    )) ||
    localDataDirectoryEdited ||
    (isLocalMode && codexSettings && (
      codexEnabled !== (codexSettings.enabled !== false) ||
      codexWorkspaceDir !== (codexSettings.workspaceDir || '') ||
      codexBinary !== (codexSettings.binary || DEFAULT_CODEX_BINARY) ||
      claudeEnabled !== (codexSettings.claude?.enabled !== false) ||
      claudeWorkspaceDir !== (codexSettings.claude?.workspaceDir || '') ||
      claudeBinary !== (codexSettings.claude?.binary || 'claude') ||
      cursorEnabled !== (codexSettings.cursor?.enabled !== false) ||
      cursorWorkspaceDir !== (codexSettings.cursor?.workspaceDir || '') ||
      cursorBinary !== (codexSettings.cursor?.binary || DEFAULT_CURSOR_AGENT_BINARY)
    )) ||
    (isLocalMode && iacToolSettings && (
      terraformBinary !== (iacToolSettings.terraformBinary || DEFAULT_IAC_TOOL_SETTINGS.terraformBinary) ||
      opentofuBinary !== (iacToolSettings.opentofuBinary || DEFAULT_IAC_TOOL_SETTINGS.opentofuBinary) ||
      trivyBinary !== (iacToolSettings.trivyBinary || DEFAULT_IAC_TOOL_SETTINGS.trivyBinary) ||
      cfnGuardBinary !== (iacToolSettings.cfnGuardBinary || DEFAULT_IAC_TOOL_SETTINGS.cfnGuardBinary) ||
      cfnLintBinary !== (iacToolSettings.cfnLintBinary || DEFAULT_IAC_TOOL_SETTINGS.cfnLintBinary) ||
      githubBinary !== (iacToolSettings.githubBinary || DEFAULT_IAC_TOOL_SETTINGS.githubBinary)
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
        defaultCommandCenterAgentRunner: defaultCommandCenterAgent,
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
        const openAIResponse = await settingsClient.updateOpenAISettings({
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
          enabled: codexEnabled,
          workspaceDir: codexWorkspaceDir,
          binary: codexBinary,
          claude: {
            enabled: claudeEnabled,
            workspaceDir: claudeWorkspaceDir,
            binary: claudeBinary,
          },
          cursor: {
            enabled: cursorEnabled,
            workspaceDir: cursorWorkspaceDir,
            binary: cursorBinary,
          },
        });
        const nextCodexSettings = response?.settings || {};
        setCodexSettings(nextCodexSettings);
        setCodexEnabled(nextCodexSettings.enabled !== false);
        setCodexWorkspaceDir(nextCodexSettings.workspaceDir || codexWorkspaceDir);
        setCodexBinary(nextCodexSettings.binary || codexBinary || DEFAULT_CODEX_BINARY);
        setClaudeEnabled(nextCodexSettings.claude?.enabled !== false);
        setClaudeWorkspaceDir(nextCodexSettings.claude?.workspaceDir || claudeWorkspaceDir);
        setClaudeBinary(nextCodexSettings.claude?.binary || claudeBinary || 'claude');
        setCursorEnabled(nextCodexSettings.cursor?.enabled !== false);
        setCursorWorkspaceDir(nextCodexSettings.cursor?.workspaceDir || cursorWorkspaceDir);
        setCursorBinary(nextCodexSettings.cursor?.binary || cursorBinary || DEFAULT_CURSOR_AGENT_BINARY);

        const iacToolsResponse = await settingsClient.updateIacToolSettings({
          terraformBinary,
          opentofuBinary,
          trivyBinary,
          cfnGuardBinary,
          cfnLintBinary,
          githubBinary,
        });
        const nextIacToolSettings = iacToolsResponse?.settings || {};
        setIacToolSettings(nextIacToolSettings);
        setTerraformBinary(nextIacToolSettings.terraformBinary || terraformBinary);
        setOpentofuBinary(nextIacToolSettings.opentofuBinary || opentofuBinary);
        setTrivyBinary(nextIacToolSettings.trivyBinary || trivyBinary);
        setCfnGuardBinary(nextIacToolSettings.cfnGuardBinary || cfnGuardBinary);
        setCfnLintBinary(nextIacToolSettings.cfnLintBinary || cfnLintBinary);
        setGithubBinary(nextIacToolSettings.githubBinary || githubBinary);
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

  const browseDirectory = async (currentValue, setter, title) => {
    if (typeof window.cloudAgentRuntime?.browseDirectory !== 'function') {
      toast.error('Directory browsing is not available in this environment');
      return;
    }
    const result = await window.cloudAgentRuntime.browseDirectory({
      title: title || 'Select Directory',
      defaultPath: currentValue || undefined,
    });
    if (result?.ok && result.path) {
      setter(result.path);
    }
  };

  const preferenceSections = [
    ...(isLocalMode
      ? [
          { id: 'api-keys-settings', label: 'API Keys' },
          { id: 'infrastructure-tools-settings', label: 'Infrastructure Tools' },
          { id: 'supported-agents-settings', label: 'Supported Agents' },
          { id: 'local-data-settings', label: 'Local Data' },
        ]
      : []),
    { id: 'data-refresh-settings', label: 'Data Refresh' },
    { id: 'executive-summary-settings', label: 'Executive Summaries' },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
            <Settings2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Preferences</h1>
            
          </div>
        </div>
        <Button type="button" disabled={isSaving || !hasChanges} onClick={handleSave} className="md:self-start">
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

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">
        {preferenceSections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            {section.label}
          </a>
        ))}
      </div>

      {isLocalMode && (
        <>
          <Card id="api-keys-settings" className="scroll-mt-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-slate-600" />
                <CardTitle>API Keys</CardTitle>
              </div>
              <CardDescription>
                Configure provider keys used by local CloudAgent chat, blueprint review, workload
                discovery, diagrams, and executive summaries.
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
                        ? `${openAISettings.source === 'environment' ? 'Environment' : 'Saved'} ${openAISettings.apiKeyMasked || ''}`.trim()
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

          <Card id="infrastructure-tools-settings" className="scroll-mt-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <TerminalSquare className="h-5 w-5 text-slate-600" />
                <CardTitle>Infrastructure Tools</CardTitle>
              </div>
              <CardDescription>
                Configure the local executables used for CloudFormation validation, Terraform plan validation, and GitHub pull requests.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="terraform-binary">Terraform binary</Label>
                  <Input
                    id="terraform-binary"
                    value={terraformBinary}
                    onChange={(event) => setTerraformBinary(event.target.value)}
                    placeholder="terraform"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="opentofu-binary">OpenTofu binary</Label>
                  <Input
                    id="opentofu-binary"
                    value={opentofuBinary}
                    onChange={(event) => setOpentofuBinary(event.target.value)}
                    placeholder="tofu"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trivy-binary">Trivy binary</Label>
                  <Input
                    id="trivy-binary"
                    value={trivyBinary}
                    onChange={(event) => setTrivyBinary(event.target.value)}
                    placeholder="trivy"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cfn-guard-binary">CloudFormation Guard binary</Label>
                  <Input
                    id="cfn-guard-binary"
                    value={cfnGuardBinary}
                    onChange={(event) => setCfnGuardBinary(event.target.value)}
                    placeholder="cfn-guard"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cfn-lint-binary">CloudFormation Linter binary</Label>
                  <Input
                    id="cfn-lint-binary"
                    value={cfnLintBinary}
                    onChange={(event) => setCfnLintBinary(event.target.value)}
                    placeholder="cfn-lint"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="github-binary">GitHub CLI binary</Label>
                  <Input
                    id="github-binary"
                    value={githubBinary}
                    onChange={(event) => setGithubBinary(event.target.value)}
                    placeholder="gh"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                The Local Readiness page verifies these paths. CloudAgent never invokes Terraform apply from this validation flow.
              </p>
            </CardContent>
          </Card>

          <Card id="supported-agents-settings" className="scroll-mt-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-slate-600" />
                <CardTitle>Supported Agents</CardTitle>
              </div>
              <CardDescription>
                Choose which local agent runtimes CloudAgent can use for skill and workflow
                execution.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Command Center default agent</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      New Command Center sessions start with this agent selected. Saved history sessions keep their own agent.
                    </p>
                  </div>
                  <div className="inline-flex flex-wrap gap-2">
                    {COMMAND_CENTER_AGENT_RUNNERS.map((option) => {
                      const OptionIcon = getCommandCenterRunnerIcon(option.id);
                      const isSelected = defaultCommandCenterAgent === option.id;
                      const readiness = getCommandCenterAgentReadiness(option.id, localAgentReadinessStatus, {
                        isLocalMode,
                        isLoading: isLocalAgentReadinessLoading,
                      });
                      const isDisabled =
                        readiness.disabled ||
                        (option.id === 'codex' && !codexEnabled) ||
                        (option.id === 'claude' && !claudeEnabled) ||
                        (option.id === 'cursor' && !cursorEnabled);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => setDefaultCommandCenterAgent(option.id)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            isSelected
                              ? 'border-primary-600 bg-primary-600 text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                          title={isDisabled ? readiness.reason || `${option.label} is disabled in Preferences.` : `Use ${option.label} by default`}
                        >
                          <OptionIcon className="h-3.5 w-3.5" />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      {React.createElement(getCommandCenterRunnerIcon('codex'), {
                        className: 'h-4 w-4 text-slate-600',
                      })}
                      <h3 className="text-sm font-semibold text-slate-900">Codex</h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Enabled for local CloudAgent skill and workflow execution.
                    </p>
                  </div>
                  <Switch
                    id="codex-agent-enabled"
                    checked={codexEnabled}
                    onCheckedChange={(checked) => {
                      setCodexEnabled(checked);
                      if (!checked && defaultCommandCenterAgent === 'codex') {
                        setDefaultCommandCenterAgent('cloudagent');
                      }
                    }}
                    className="data-[state=checked]:!bg-blue-500"
                  />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="codex-workspace-dir" className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      Codex run workspace directory
                    </Label>
                    <div className="relative">
                      <Input
                        id="codex-workspace-dir"
                        value={codexWorkspaceDir}
                        onChange={(event) => setCodexWorkspaceDir(event.target.value)}
                        placeholder="/path/to/run-workspaces"
                        className="font-mono text-sm pr-10"
                        disabled={!codexEnabled}
                      />
                      <button
                        type="button"
                        disabled={!codexEnabled}
                        onClick={() => browseDirectory(codexWorkspaceDir, setCodexWorkspaceDir, 'Select Codex Workspace Directory')}
                        title="Browse for directory"
                        className="absolute right-0 top-0 h-full px-3 text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <FolderSearch className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codex-binary" className="flex items-center gap-2">
                      <TerminalSquare className="h-4 w-4" />
                      Codex binary
                    </Label>
                    <Input
                      id="codex-binary"
                      value={codexBinary}
                      onChange={(event) => setCodexBinary(event.target.value)}
                      placeholder={DEFAULT_CODEX_BINARY}
                      className="font-mono text-sm"
                      disabled={!codexEnabled}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      {React.createElement(getCommandCenterRunnerIcon('claude'), {
                        className: 'h-4 w-4 text-slate-600',
                      })}
                      <h3 className="text-sm font-semibold text-slate-900">Claude Code</h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Enabled for local CloudAgent skill and workflow execution through Claude Code.
                    </p>
                  </div>
                  <Switch
                    id="claude-code-agent-enabled"
                    checked={claudeEnabled}
                    onCheckedChange={(checked) => {
                      setClaudeEnabled(checked);
                      if (!checked && defaultCommandCenterAgent === 'claude') {
                        setDefaultCommandCenterAgent('cloudagent');
                      }
                    }}
                    className="data-[state=checked]:!bg-blue-500"
                  />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="claude-workspace-dir" className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      Claude run workspace directory
                    </Label>
                    <div className="relative">
                      <Input
                        id="claude-workspace-dir"
                        value={claudeWorkspaceDir}
                        onChange={(event) => setClaudeWorkspaceDir(event.target.value)}
                        placeholder="/path/to/run-workspaces"
                        className="font-mono text-sm pr-10"
                        disabled={!claudeEnabled}
                      />
                      <button
                        type="button"
                        disabled={!claudeEnabled}
                        onClick={() => browseDirectory(claudeWorkspaceDir, setClaudeWorkspaceDir, 'Select Claude Workspace Directory')}
                        title="Browse for directory"
                        className="absolute right-0 top-0 h-full px-3 text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <FolderSearch className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="claude-binary" className="flex items-center gap-2">
                      <TerminalSquare className="h-4 w-4" />
                      Claude Code binary
                    </Label>
                    <Input
                      id="claude-binary"
                      value={claudeBinary}
                      onChange={(event) => setClaudeBinary(event.target.value)}
                      placeholder="claude"
                      className="font-mono text-sm"
                      disabled={!claudeEnabled}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      {React.createElement(getCommandCenterRunnerIcon('cursor'), {
                        className: 'h-4 w-4 text-slate-600',
                      })}
                      <h3 className="text-sm font-semibold text-slate-900">Cursor Agent</h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Enabled for local CloudAgent skill and workflow execution through Cursor's headless agent.
                    </p>
                  </div>
                  <Switch
                    id="cursor-agent-enabled"
                    checked={cursorEnabled}
                    onCheckedChange={(checked) => {
                      setCursorEnabled(checked);
                      if (!checked && defaultCommandCenterAgent === 'cursor') {
                        setDefaultCommandCenterAgent('cloudagent');
                      }
                    }}
                    className="data-[state=checked]:!bg-blue-500"
                  />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cursor-workspace-dir" className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      Cursor run workspace directory
                    </Label>
                    <div className="relative">
                      <Input
                        id="cursor-workspace-dir"
                        value={cursorWorkspaceDir}
                        onChange={(event) => setCursorWorkspaceDir(event.target.value)}
                        placeholder="/path/to/run-workspaces"
                        className="font-mono text-sm pr-10"
                        disabled={!cursorEnabled}
                      />
                      <button
                        type="button"
                        disabled={!cursorEnabled}
                        onClick={() => browseDirectory(cursorWorkspaceDir, setCursorWorkspaceDir, 'Select Cursor Workspace Directory')}
                        title="Browse for directory"
                        className="absolute right-0 top-0 h-full px-3 text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <FolderSearch className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cursor-binary" className="flex items-center gap-2">
                      <TerminalSquare className="h-4 w-4" />
                      Cursor agent binary
                    </Label>
                    <Input
                      id="cursor-binary"
                      value={cursorBinary}
                      onChange={(event) => setCursorBinary(event.target.value)}
                      placeholder={DEFAULT_CURSOR_AGENT_BINARY}
                      className="font-mono text-sm"
                      disabled={!cursorEnabled}
                    />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  CloudAgent writes a project .mcp.json into each Cursor run directory for the local MCP server. To use the
                  same server manually in Cursor, add or enable the CloudAgent local MCP server in Cursor's MCP settings.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card id="local-data-settings" className="scroll-mt-6">
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
                <div className="relative">
                  <Input
                    id="local-data-dir"
                    value={localDataDir}
                    onChange={(event) => setLocalDataDir(event.target.value)}
                    placeholder="/path/to/cloudagent-local-data"
                    className="font-mono text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => browseDirectory(localDataDir, setLocalDataDir, 'Select Local Data Directory')}
                    title="Browse for directory"
                    className="absolute right-0 top-0 h-full px-3 text-slate-500 hover:text-slate-700"
                  >
                    <FolderSearch className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Changes apply after restarting the desktop app.
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
        </>
      )}

      <Card id="data-refresh-settings" className="scroll-mt-6">
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

      <Card id="executive-summary-settings" className="scroll-mt-6">
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
            setDefaultCommandCenterAgent(persistedDefaultCommandCenterAgent);
            if (codexSettings) {
              setCodexEnabled(codexSettings.enabled !== false);
              setCodexWorkspaceDir(codexSettings.workspaceDir || '');
              setCodexBinary(codexSettings.binary || DEFAULT_CODEX_BINARY);
              setClaudeEnabled(codexSettings.claude?.enabled !== false);
              setClaudeWorkspaceDir(codexSettings.claude?.workspaceDir || '');
              setClaudeBinary(codexSettings.claude?.binary || 'claude');
              setCursorEnabled(codexSettings.cursor?.enabled !== false);
              setCursorWorkspaceDir(codexSettings.cursor?.workspaceDir || '');
              setCursorBinary(codexSettings.cursor?.binary || DEFAULT_CURSOR_AGENT_BINARY);
            }
            if (iacToolSettings) {
              setTerraformBinary(iacToolSettings.terraformBinary || DEFAULT_IAC_TOOL_SETTINGS.terraformBinary);
              setOpentofuBinary(iacToolSettings.opentofuBinary || DEFAULT_IAC_TOOL_SETTINGS.opentofuBinary);
              setTrivyBinary(iacToolSettings.trivyBinary || DEFAULT_IAC_TOOL_SETTINGS.trivyBinary);
              setCfnGuardBinary(iacToolSettings.cfnGuardBinary || DEFAULT_IAC_TOOL_SETTINGS.cfnGuardBinary);
              setCfnLintBinary(iacToolSettings.cfnLintBinary || DEFAULT_IAC_TOOL_SETTINGS.cfnLintBinary);
              setGithubBinary(iacToolSettings.githubBinary || DEFAULT_IAC_TOOL_SETTINGS.githubBinary);
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
