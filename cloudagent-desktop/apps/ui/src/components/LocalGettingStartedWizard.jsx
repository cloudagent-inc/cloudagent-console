import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  FolderOpen,
  KeyRound,
  Loader2,
  RefreshCw,
  Server,
  TerminalSquare,
  XCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { localSettingsClient } from '@/api/clients/localSettingsClient';
import { localAwsClient } from '@/api/clients/localAwsClient';
import { createAgentPermissionProfile } from '@/features/agent/agentSlice';
import { refreshUserProfile, updateSingleProfileInState } from '@/features/auth/authSlice';
import { getGlobalWorkloadSecurityRules } from '@/components/SecurityCompliance/securityRulesUtils';
import { getGlobalWorkloadDeploymentPreferences } from '@/features/workload/workloadCreationUtils';

const DEFAULT_MODEL = 'gpt-5.4';

const parseAwsCredentialExportBlock = (value = '') => {
  const readValue = (name) => {
    const match = String(value).match(
      new RegExp(`(?:^|[\\r\\n;])\\s*(?:export\\s+)?${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s;]+))`, 'm')
    );
    return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
  };

  return {
    accessKeyId: readValue('AWS_ACCESS_KEY_ID'),
    secretAccessKey: readValue('AWS_SECRET_ACCESS_KEY'),
    sessionToken: readValue('AWS_SESSION_TOKEN'),
  };
};

const hasCredentialIssue = (profile) => {
  const status = profile?.credentialStatus || profile?.localCredentialStatus || profile?._credentialStatus;
  if (!status) return false;
  if (status.lastCheckedValid === false || status.ok === false) return true;
  if (status.lastCheckedValid === true) return false;
  const normalized = String(status.status || '').toLowerCase();
  return Boolean(normalized && !['valid', 'not_applicable', 'unknown'].includes(normalized));
};

function ReadinessIcon({ ok, disabled }) {
  if (disabled) return <CheckCircle2 className="h-4 w-4 text-slate-400" />;
  if (ok) return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  return <XCircle className="h-4 w-4 text-amber-600" />;
}

function ReadinessRow({ label, ok, disabled = false, detail, command, optional = false }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <ReadinessIcon ok={ok} disabled={disabled} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-slate-900">{label}</p>
          {optional && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              Optional
            </span>
          )}
          {disabled && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              Disabled
            </span>
          )}
        </div>
        {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
        {command && <p className="mt-1 truncate font-mono text-xs text-slate-400">{command}</p>}
      </div>
    </div>
  );
}

export default function LocalGettingStartedWizard({
  open,
  onComplete,
  existingProfiles = [],
}) {
  const dispatch = useDispatch();
  const userProfile = useSelector((state) => state.auth?.userProfile);
  const navigate = useNavigate();
  const [step, setStep] = useState('openai');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localAwsProfiles, setLocalAwsProfiles] = useState([]);
  const [openAISettings, setOpenAISettings] = useState(null);
  const [openAIModel, setOpenAIModel] = useState(DEFAULT_MODEL);
  const [openAIKey, setOpenAIKey] = useState('');
  const [environmentName, setEnvironmentName] = useState('Development');
  const [accountId, setAccountId] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [credentialMethod, setCredentialMethod] = useState('profile');
  const [awsProfile, setAwsProfile] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [exportBlock, setExportBlock] = useState('');
  const [runtimeInfo, setRuntimeInfo] = useState(null);
  const [localDataDir, setLocalDataDir] = useState('');
  const [hasSavedDirectoryChange, setHasSavedDirectoryChange] = useState(false);
  const [readinessStatus, setReadinessStatus] = useState(null);
  const [readinessLoading, setReadinessLoading] = useState(false);

  const hasEnvironment = useMemo(
    () => existingProfiles.some((profile) => {
      const type = String(profile?.type || '').trim().toLowerCase().replace(/_/g, ' ');
      return type === 'aws account';
    }),
    [existingProfiles]
  );

  const refreshLocalReadiness = useCallback(async ({ silent = false } = {}) => {
    setReadinessLoading(true);
    try {
      const response = await localSettingsClient.getPreferencesStatus();
      const nextStatus = response?.status || null;
      setReadinessStatus(nextStatus);
      return nextStatus;
    } catch (error) {
      console.warn('[local getting started] failed to load readiness status', error);
      if (!silent) toast.error(error?.message || 'Failed to load local readiness status');
      return null;
    } finally {
      setReadinessLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setIsLoading(true);
    Promise.all([
      localSettingsClient.getOpenAISettings(),
      localAwsClient.listProfiles().catch(() => []),
      typeof window !== 'undefined' && typeof window.cloudAgentRuntime?.getLocalRuntimeInfo === 'function'
        ? window.cloudAgentRuntime.getLocalRuntimeInfo().catch(() => null)
        : Promise.resolve(null),
      localSettingsClient.getPreferencesStatus().catch(() => null),
    ])
      .then(([settingsResponse, awsProfiles, runtimeResponse, readinessResponse]) => {
        if (!mounted) return;
        const settings = settingsResponse?.settings || {};
        setOpenAISettings(settings);
        setOpenAIModel(settings.model || DEFAULT_MODEL);
        setRuntimeInfo(runtimeResponse || null);
        setLocalDataDir(runtimeResponse?.configuredLocalDataDir || runtimeResponse?.localDataDir || '');
        setHasSavedDirectoryChange(Boolean(runtimeResponse?.localDataDirPendingRestart));
        setReadinessStatus(readinessResponse?.status || null);
        const profiles = Array.isArray(awsProfiles) ? awsProfiles : [];
        setLocalAwsProfiles(profiles);
        if (!awsProfile && profiles[0]?.name) setAwsProfile(profiles[0].name);
      })
      .catch((error) => {
        console.warn('[local getting started] failed to load settings', error);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [awsProfile, open]);

  const handleApplyExportBlock = () => {
    const parsed = parseAwsCredentialExportBlock(exportBlock);
    if (!parsed.accessKeyId || !parsed.secretAccessKey) {
      toast.error('Paste AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY exports');
      return;
    }
    setCredentialMethod('static-credentials');
    setAccessKeyId(parsed.accessKeyId);
    setSecretAccessKey(parsed.secretAccessKey);
    setSessionToken(parsed.sessionToken || '');
    setExportBlock('');
    toast.success(parsed.sessionToken ? 'Temporary AWS credentials imported' : 'AWS credentials imported');
  };

  const saveOpenAI = async () => {
    setIsSaving(true);
    try {
      const directoryChanged =
        localDataDir.trim() &&
        localDataDir !== (runtimeInfo?.configuredLocalDataDir || runtimeInfo?.localDataDir || '');
      if (
        directoryChanged &&
        typeof window.cloudAgentRuntime?.setLocalDataDir === 'function'
      ) {
        const runtimeResponse = await window.cloudAgentRuntime.setLocalDataDir(localDataDir.trim());
        if (runtimeResponse?.ok === false) {
          toast.error(runtimeResponse.error || 'Failed to save local data directory');
          return;
        }
        setRuntimeInfo(runtimeResponse || null);
        setLocalDataDir(runtimeResponse?.configuredLocalDataDir || runtimeResponse?.localDataDir || localDataDir);
        setHasSavedDirectoryChange(Boolean(runtimeResponse?.localDataDirPendingRestart));
        window.dispatchEvent(new CustomEvent('cloudagent:local-runtime-settings-updated', {
          detail: runtimeResponse,
        }));
        if (runtimeResponse?.warning) toast(runtimeResponse.warning);
        if (runtimeResponse?.localDataDirPendingRestart) {
          return;
        }
      }
      const response = await localSettingsClient.updateOpenAISettings({
        model: openAIModel || DEFAULT_MODEL,
        ...(openAIKey.trim() ? { apiKey: openAIKey.trim() } : {}),
      });
      const settings = response?.settings || {};
      setOpenAISettings(settings);
      setOpenAIModel(settings.model || openAIModel || DEFAULT_MODEL);
      setOpenAIKey('');
      window.dispatchEvent(new CustomEvent('cloudagent:openai-settings-updated', {
        detail: settings,
      }));
      await refreshLocalReadiness({ silent: true });
      setStep('readiness');
    } catch (error) {
      toast.error(error?.message || 'Failed to save OpenAI settings');
    } finally {
      setIsSaving(false);
    }
  };

  const finish = (result = {}) => {
    onComplete?.(result);
  };

  const saveEnvironment = async () => {
    if (hasEnvironment) {
      finish({ skippedEnvironment: true });
      return;
    }

    const name = environmentName.trim();
    const defaultRegion = region.trim() || 'us-east-1';
    const profileName = awsProfile.trim();
    const credentialAccountId = accountId.trim();
    const accessKey = accessKeyId.trim();
    const secretKey = secretAccessKey.trim();
    const token = sessionToken.trim();

    if (!name) {
      toast.error('Environment name is required');
      return;
    }
    if ((credentialMethod === 'profile' || credentialMethod === 'sso') && !profileName) {
      toast.error('AWS profile is required');
      return;
    }
    if (credentialMethod === 'static-credentials' && (!accessKey || !secretKey)) {
      toast.error('Access key ID and secret access key are required');
      return;
    }

    const authProfile = {
      provider: 'aws',
      authType: credentialMethod === 'sso' ? 'aws-sso' : credentialMethod,
      ...(credentialAccountId ? { awsAccountId: credentialAccountId, accountId: credentialAccountId } : {}),
      ...(credentialMethod === 'profile' || credentialMethod === 'sso'
        ? { awsProfile: profileName }
        : {}),
      ...(credentialMethod === 'static-credentials'
        ? {
            accessKeyId: accessKey,
            secretAccessKey: secretKey,
            ...(token ? { sessionToken: token } : {}),
          }
        : {}),
      region: defaultRegion,
    };

    setIsSaving(true);
    try {
      const savedProfile = await dispatch(createAgentPermissionProfile({
        name,
        type: 'aws account',
        description: 'Created during local getting started.',
        authProfile,
        deploymentPreferences: {
          ...getGlobalWorkloadDeploymentPreferences(userProfile?.settings || {}),
          defaultRegions: [defaultRegion],
        },
        securityRules: getGlobalWorkloadSecurityRules(userProfile?.settings || {}),
      })).unwrap();
      let validatedProfile = savedProfile;
      if (savedProfile?.recordId) {
        validatedProfile = await localAwsClient.validatePermissionProfile(savedProfile.recordId);
        if (validatedProfile?.recordId) {
          dispatch(updateSingleProfileInState(validatedProfile));
        }
      }
      await dispatch(refreshUserProfile()).unwrap().catch(() => null);

      if (validatedProfile?.recordId && !hasCredentialIssue(validatedProfile)) {
        navigate('/dashboard/workloads', {
          state: {
            openDiscoverWorkloadsModal: true,
            permissionProfileId: validatedProfile.recordId,
          },
        });
      }
      finish({ createdProfile: validatedProfile || savedProfile });
    } catch (error) {
      toast.error(error?.message || 'Failed to create local AWS environment');
    } finally {
      setIsSaving(false);
    }
  };

  const isOpenAIReady = openAISettings?.hasApiKey || openAIKey.trim();
  const directoryEdited =
    localDataDir.trim() &&
    localDataDir !== (runtimeInfo?.configuredLocalDataDir || runtimeInfo?.localDataDir || '');
  const restartRequired = Boolean(runtimeInfo?.localDataDirPendingRestart || hasSavedDirectoryChange);
  const canContinueOpenAI = !restartRequired && (directoryEdited || isOpenAIReady);
  const restartApp = async () => {
    if (typeof window.cloudAgentRuntime?.restartApp !== 'function') {
      window.location.reload();
      return;
    }
    await window.cloudAgentRuntime.restartApp();
  };

  return (
    <Dialog open={open}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Local Setup</DialogTitle>
          <DialogDescription>
            Configure local model access and your first AWS environment.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm">
          <div className={`flex items-center gap-2 rounded-md px-3 py-2 ${step === 'openai' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>
            <KeyRound className="h-4 w-4" />
            OpenAI
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400" />
          <div className={`flex items-center gap-2 rounded-md px-3 py-2 ${step === 'readiness' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>
            <Server className="h-4 w-4" />
            Readiness
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400" />
          <div className={`flex items-center gap-2 rounded-md px-3 py-2 ${step === 'environment' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>
            <Cloud className="h-4 w-4" />
            AWS Environment
          </div>
        </div>

        {runtimeInfo && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-800">
              <FolderOpen className="h-4 w-4 text-slate-500" />
              Local data directory
            </div>
            <div className="space-y-2">
              <Input
                value={localDataDir}
                onChange={(event) => setLocalDataDir(event.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-xs text-slate-500">
                CloudAgent stores local settings, environments, workloads, scans, and run history here.
                {runtimeInfo.localDataDirSource === 'environment'
                  ? ' CLOUDAGENT_LOCAL_DATA_DIR is set for this launch; the saved preference applies after restarting without that env var.'
                  : ' Changes apply after restarting the desktop app.'}
              </p>
              {restartRequired && (
                <p className="text-xs font-medium text-amber-700">
                  Restart required to use the saved directory.
                </p>
              )}
              {restartRequired && (
                <Button
                  type="button"
                  size="sm"
                  onClick={restartApp}
                  className="mt-2"
                >
                  Restart CloudAgent
                </Button>
              )}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex min-h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : step === 'openai' ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="getting-started-openai-model">OpenAI model</Label>
                <Input
                  id="getting-started-openai-model"
                  value={openAIModel}
                  onChange={(event) => setOpenAIModel(event.target.value)}
                  placeholder={DEFAULT_MODEL}
                  disabled={directoryEdited || restartRequired}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="getting-started-openai-key">OpenAI API key</Label>
                <Input
                  id="getting-started-openai-key"
                  type="password"
                  value={openAIKey}
                  onChange={(event) => setOpenAIKey(event.target.value)}
                  placeholder={
                    openAISettings?.hasApiKey
                      ? `Saved ${openAISettings.apiKeyMasked || ''}`.trim()
                      : 'sk-...'
                  }
                  autoComplete="off"
                  disabled={directoryEdited || restartRequired}
                />
              </div>
            </div>
            {directoryEdited && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Save the local data directory first, then restart CloudAgent before saving the OpenAI key.
              </div>
            )}
            {openAISettings?.hasApiKey && (
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                <CheckCircle2 className="h-4 w-4" />
                An OpenAI key is already saved locally.
              </div>
            )}
          </div>
        ) : step === 'readiness' ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-white p-2 text-slate-700 shadow-sm">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Local readiness check</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Verify local model access, data storage, and optional command line tools before continuing.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refreshLocalReadiness()}
                disabled={readinessLoading}
                className="md:self-start"
              >
                {readinessLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>

            {!readinessStatus && (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                {readinessLoading ? 'Checking local readiness...' : 'Local readiness has not been checked yet.'}
              </div>
            )}

            {readinessStatus && (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <ReadinessRow
                    label="OpenAI provider"
                    ok={readinessStatus.openai?.ok}
                    detail={
                      readinessStatus.openai?.ok
                        ? `${readinessStatus.openai.model || 'Model configured'} from ${readinessStatus.openai.source || 'preferences'}`
                        : readinessStatus.openai?.message || 'API key is not configured.'
                    }
                  />
                  <ReadinessRow
                    label="Local data directory"
                    ok={readinessStatus.localData?.ok}
                    detail={
                      readinessStatus.localData?.ok
                        ? 'Writable'
                        : readinessStatus.localData?.error || 'Directory is not writable.'
                    }
                    command={readinessStatus.localData?.path}
                  />
                </div>

                {Object.keys(readinessStatus.tools || {}).length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <TerminalSquare className="h-4 w-4 text-slate-500" />
                      <h3 className="text-sm font-semibold text-slate-900">Optional command line tools</h3>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {Object.entries(readinessStatus.tools || {}).map(([key, tool]) => (
                        <ReadinessRow
                          key={key}
                          label={tool.label || key}
                          ok={tool.ok}
                          disabled={tool.disabled || tool.enabled === false}
                          optional={tool.optional !== false}
                          detail={
                            tool.disabled || tool.enabled === false
                              ? 'Disabled in Preferences'
                              : tool.ok
                                ? tool.version || 'Available'
                                : tool.error || 'Not available'
                          }
                          command={tool.command}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {hasEnvironment ? (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                You already have a local AWS environment configured.
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="getting-started-env-name">Environment name</Label>
                    <Input
                      id="getting-started-env-name"
                      value={environmentName}
                      onChange={(event) => setEnvironmentName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="getting-started-account-id">AWS account ID</Label>
                    <Input
                      id="getting-started-account-id"
                      value={accountId}
                      onChange={(event) => setAccountId(event.target.value)}
                      placeholder="123456789012"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="getting-started-region">Default region</Label>
                    <Input
                      id="getting-started-region"
                      value={region}
                      onChange={(event) => setRegion(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="getting-started-credential-method">Credentials</Label>
                    <select
                      id="getting-started-credential-method"
                      value={credentialMethod}
                      onChange={(event) => setCredentialMethod(event.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="profile">AWS profile</option>
                      <option value="sso">AWS SSO profile</option>
                      <option value="static-credentials">Access keys</option>
                    </select>
                  </div>
                </div>
                {(credentialMethod === 'profile' || credentialMethod === 'sso') ? (
                  <div className="space-y-2">
                    <Label htmlFor="getting-started-aws-profile">AWS profile name</Label>
                    <Input
                      id="getting-started-aws-profile"
                      value={awsProfile}
                      onChange={(event) => setAwsProfile(event.target.value)}
                      list="getting-started-aws-profiles"
                      placeholder="default"
                    />
                    <datalist id="getting-started-aws-profiles">
                      {localAwsProfiles.map((profile) => (
                        <option key={profile.name} value={profile.name} />
                      ))}
                    </datalist>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="getting-started-export-block">Paste AWS export block</Label>
                      <Textarea
                        id="getting-started-export-block"
                        value={exportBlock}
                        onChange={(event) => setExportBlock(event.target.value)}
                        placeholder={'export AWS_ACCESS_KEY_ID="..."\nexport AWS_SECRET_ACCESS_KEY="..."\nexport AWS_SESSION_TOKEN="..."'}
                        className="min-h-24 font-mono text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleApplyExportBlock}
                        disabled={!exportBlock.trim()}
                      >
                        Import pasted credentials
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="getting-started-access-key">Access key ID</Label>
                        <Input
                          id="getting-started-access-key"
                          value={accessKeyId}
                          onChange={(event) => setAccessKeyId(event.target.value)}
                          autoComplete="off"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="getting-started-secret-key">Secret access key</Label>
                        <Input
                          id="getting-started-secret-key"
                          type="password"
                          value={secretAccessKey}
                          onChange={(event) => setSecretAccessKey(event.target.value)}
                          autoComplete="off"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="getting-started-session-token">Session token</Label>
                      <Textarea
                        id="getting-started-session-token"
                        value={sessionToken}
                        onChange={(event) => setSessionToken(event.target.value)}
                        className="min-h-20 font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" disabled={isSaving} onClick={() => finish({ skipped: true })}>
            Skip for now
          </Button>
          {step === 'readiness' && (
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => setStep('openai')}>
              Back
            </Button>
          )}
          {step === 'environment' && (
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => setStep('readiness')}>
              Back
            </Button>
          )}
          {step === 'openai' ? (
            <Button type="button" disabled={isSaving || !canContinueOpenAI} onClick={saveOpenAI}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {directoryEdited ? 'Save Directory' : 'Continue'}
            </Button>
          ) : step === 'readiness' ? (
            <Button type="button" disabled={isSaving || readinessLoading} onClick={() => setStep('environment')}>
              {readinessLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue
            </Button>
          ) : (
            <Button type="button" disabled={isSaving} onClick={saveEnvironment}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Finish
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
