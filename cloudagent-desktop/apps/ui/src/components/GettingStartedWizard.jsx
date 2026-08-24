import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  FolderOpen,
  KeyRound,
  Loader2,
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CUSTOM_PRESET_ID,
  MODEL_PRESET_GROUPS,
  applyPreset,
  describeBedrockEndpoint,
  findMatchingPreset,
  getPresetById,
} from '@/lib/modelPresets';
import BedrockKeyHelp from '@/components/BedrockKeyHelp';
import { settingsClient } from '@/api/clients/settingsClient';

const DEFAULT_MODEL = 'gpt-5.4';
const LLM_PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'bedrock', label: 'Amazon Bedrock' },
  { value: 'custom', label: 'Custom endpoint' },
];
function normalizeLLMProvider(value) {
  const provider = String(value || '').trim().toLowerCase();
  return LLM_PROVIDER_OPTIONS.some((option) => option.value === provider)
    ? provider
    : 'openai';
}

function defaultModelForProvider(provider) {
  return provider === 'openai' ? DEFAULT_MODEL : '';
}

export default function GettingStartedWizard({ open, onComplete }) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [llmSettings, setLlmSettings] = useState(null);
  const [llmProvider, setLlmProvider] = useState('openai');
  const [llmProtocol, setLlmProtocol] = useState(undefined);
  const [llmPresetOverridden, setLlmPresetOverridden] = useState(false);
  const [llmModel, setLlmModel] = useState(DEFAULT_MODEL);
  const [llmBaseUrl, setLlmBaseUrl] = useState('');
  const [llmRegion, setLlmRegion] = useState('');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [runtimeInfo, setRuntimeInfo] = useState(null);
  const [localDataDir, setLocalDataDir] = useState('');
  const [hasSavedDirectoryChange, setHasSavedDirectoryChange] = useState(false);

  const applyLLMSettings = (settings) => {
    const nextSettings = settings || {};
    const provider = normalizeLLMProvider(nextSettings.provider);
    setLlmSettings(nextSettings);
    setLlmProvider(provider);
    // Only bedrock keeps a user-visible protocol; custom is auto-detected on
    // save and openai/anthropic are forced by the server.
    setLlmProtocol(provider === 'bedrock' ? nextSettings.protocol || undefined : undefined);
    setLlmPresetOverridden(false);
    setLlmModel(nextSettings.model || defaultModelForProvider(provider));
    // Bedrock base URLs are derived from region + protocol server-side.
    setLlmBaseUrl(provider === 'bedrock' ? '' : nextSettings.baseUrl || '');
    setLlmRegion(nextSettings.region || '');
  };

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setIsLoading(true);

    Promise.all([
      settingsClient.getLLMSettings(),
      typeof window !== 'undefined' && typeof window.cloudAgentRuntime?.getLocalRuntimeInfo === 'function'
        ? window.cloudAgentRuntime.getLocalRuntimeInfo().catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([settingsResponse, runtimeResponse]) => {
        if (!mounted) return;
        applyLLMSettings(settingsResponse?.settings || {});
        setRuntimeInfo(runtimeResponse || null);
        setLocalDataDir(runtimeResponse?.configuredLocalDataDir || runtimeResponse?.localDataDir || '');
        setHasSavedDirectoryChange(Boolean(runtimeResponse?.localDataDirPendingRestart));
      })
      .catch((error) => {
        console.warn('[local getting started] failed to load settings', error);
        toast.error(error?.message || 'Failed to load local setup');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [open]);

  const configuredLocalDataDir =
    runtimeInfo?.configuredLocalDataDir || runtimeInfo?.localDataDir || '';
  const directoryEdited = Boolean(
    localDataDir.trim() && localDataDir.trim() !== configuredLocalDataDir
  );
  const restartRequired = Boolean(
    runtimeInfo?.localDataDirPendingRestart || hasSavedDirectoryChange
  );
  const hasLlmApiKey = Boolean(llmSettings?.hasApiKey || llmApiKey.trim());
  const bedrockKeyOptional = llmProvider === 'bedrock' && llmProtocol === 'bedrock-converse';
  const isProviderConfigured = (() => {
    if (llmProvider === 'bedrock') {
      return Boolean(llmRegion.trim() && llmModel.trim() && (hasLlmApiKey || bedrockKeyOptional));
    }
    if (llmProvider === 'anthropic') {
      return Boolean(llmModel.trim() && hasLlmApiKey);
    }
    if (llmProvider === 'custom') {
      return Boolean(llmBaseUrl.trim() && llmModel.trim());
    }
    return hasLlmApiKey;
  })();
  const activeLlmPreset = findMatchingPreset({
    provider: llmProvider,
    protocol: llmProtocol,
    model: llmModel,
  });
  const selectedLlmPresetId =
    llmPresetOverridden || !activeLlmPreset ? CUSTOM_PRESET_ID : activeLlmPreset.id;
  const bedrockEndpointLabel =
    llmProvider === 'bedrock' ? describeBedrockEndpoint(llmProtocol) : '';
  const llmKeyLabel = bedrockKeyOptional
    ? 'Bedrock API key (optional)'
    : llmProvider === 'bedrock'
      ? 'Bedrock API key'
      : llmProvider === 'anthropic'
        ? 'Anthropic API key'
        : llmProvider === 'custom'
          ? 'API key (optional)'
          : 'OpenAI API key';
  const llmKeyHint = bedrockKeyOptional
    ? 'Optional — leave empty to use your AWS credentials (profile/SSO)'
    : selectedLlmPresetId === CUSTOM_PRESET_ID
      ? ''
      : activeLlmPreset?.keyHint || '';
  const canSaveDirectory = Boolean(localDataDir.trim());
  const canGoToCloudSetup = Boolean(
    localDataDir.trim() && isProviderConfigured && !directoryEdited && !restartRequired
  );

  const handlePresetChange = (value) => {
    const patch = applyPreset(getPresetById(value));
    if (!patch) {
      setLlmPresetOverridden(true);
      return;
    }
    setLlmPresetOverridden(false);
    setLlmProvider(patch.provider);
    setLlmProtocol(patch.protocol);
    setLlmModel(patch.model);
    setLlmBaseUrl(patch.baseUrl);
    setLlmRegion(patch.region);
  };

  const handleProviderChange = (value) => {
    const nextProvider = normalizeLLMProvider(value);
    setLlmProvider(nextProvider);
    const keepsSavedValues = nextProvider === normalizeLLMProvider(llmSettings?.provider);
    setLlmProtocol(
      keepsSavedValues && nextProvider === 'bedrock' ? llmSettings?.protocol || undefined : undefined
    );
    setLlmModel(
      (keepsSavedValues && llmSettings?.model) || defaultModelForProvider(nextProvider)
    );
    setLlmBaseUrl(keepsSavedValues && nextProvider !== 'bedrock' ? llmSettings?.baseUrl || '' : '');
    setLlmRegion(keepsSavedValues ? llmSettings?.region || '' : '');
  };

  const restartApp = async () => {
    if (typeof window.cloudAgentRuntime?.restartApp !== 'function') {
      window.location.reload();
      return;
    }
    await window.cloudAgentRuntime.restartApp();
  };

  const saveAndGoToCloudSetup = async () => {
    setIsSaving(true);
    try {
      if (directoryEdited && typeof window.cloudAgentRuntime?.setLocalDataDir === 'function') {
        const runtimeResponse = await window.cloudAgentRuntime.setLocalDataDir(localDataDir.trim());
        if (runtimeResponse?.ok === false) {
          toast.error(runtimeResponse.error || 'Failed to save local data directory');
          return;
        }
        setRuntimeInfo(runtimeResponse || null);
        setLocalDataDir(
          runtimeResponse?.configuredLocalDataDir || runtimeResponse?.localDataDir || localDataDir
        );
        setHasSavedDirectoryChange(Boolean(runtimeResponse?.localDataDirPendingRestart));
        window.dispatchEvent(new CustomEvent('cloudagent:local-runtime-settings-updated', {
          detail: runtimeResponse,
        }));
        if (runtimeResponse?.localDataDirPendingRestart) return;
      }

      if (!localDataDir.trim()) {
        toast.error('Local data directory is required');
        return;
      }
      if (llmProvider === 'bedrock') {
        if (!llmRegion.trim()) {
          toast.error('An AWS region is required for Amazon Bedrock');
          return;
        }
        if (!llmModel.trim()) {
          toast.error('A Bedrock model or inference profile ID is required');
          return;
        }
        if (!hasLlmApiKey && !bedrockKeyOptional) {
          toast.error('A Bedrock API key is required');
          return;
        }
      } else if (llmProvider === 'anthropic') {
        if (!llmModel.trim()) {
          toast.error('A model is required for Anthropic');
          return;
        }
        if (!hasLlmApiKey) {
          toast.error('An Anthropic API key is required');
          return;
        }
      } else if (llmProvider === 'custom') {
        if (!llmBaseUrl.trim()) {
          toast.error('A base URL is required for a custom endpoint');
          return;
        }
        if (!llmModel.trim()) {
          toast.error('A model is required for a custom endpoint');
          return;
        }
      } else if (!hasLlmApiKey) {
        toast.error('An OpenAI API key is required');
        return;
      }

      const response = await settingsClient.updateLLMSettings({
        provider: llmProvider,
        ...(llmProtocol ? { protocol: llmProtocol } : {}),
        model: llmModel.trim() || defaultModelForProvider(llmProvider),
        // Bedrock derives its base URL from region + protocol server-side.
        baseUrl: llmProvider === 'bedrock' ? '' : llmBaseUrl.trim(),
        region: llmRegion.trim(),
        ...(llmApiKey.trim() ? { apiKey: llmApiKey.trim() } : {}),
      });
      const settings = response?.settings || {};
      applyLLMSettings(settings);
      setLlmApiKey('');
      window.dispatchEvent(new CustomEvent('cloudagent:llm-settings-updated', {
        detail: settings,
      }));

      onComplete?.({ llmConfigured: true });
      navigate('/dashboard/cloud-setup');
    } catch (error) {
      toast.error(error?.message || 'Failed to save local setup');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle>Local Setup</DialogTitle>
          <DialogDescription>
            Choose where CloudAgent stores its data and configure your model provider. You will add cloud environments next in Cloud Setup.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex min-h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-800">
                <FolderOpen className="h-4 w-4 text-slate-500" />
                Local data directory
              </div>
              <Input
                value={localDataDir}
                onChange={(event) => setLocalDataDir(event.target.value)}
                className="font-mono text-xs"
                placeholder="/path/to/cloudagent-local-data"
              />
              <p className="mt-2 text-xs text-slate-500">
                Existing CloudAgent workspace files are reused in place and are not cleared. Directory changes apply after restarting the desktop app.
              </p>
              {restartRequired && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-medium text-amber-700">
                    Restart CloudAgent to use the saved directory.
                  </p>
                  <Button type="button" size="sm" onClick={restartApp}>
                    Restart CloudAgent
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-slate-500" />
                <Label htmlFor="getting-started-llm-preset">Model</Label>
              </div>
              <Select
                value={selectedLlmPresetId}
                onValueChange={handlePresetChange}
                disabled={directoryEdited || restartRequired}
              >
                <SelectTrigger id="getting-started-llm-preset">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_PRESET_GROUPS.map((group) => (
                    <SelectGroup key={group.label}>
                      <SelectLabel className="text-xs text-slate-500">{group.label}</SelectLabel>
                      {group.presets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {selectedLlmPresetId !== CUSTOM_PRESET_ID && activeLlmPreset?.note && (
                <p className="text-xs text-slate-500">{activeLlmPreset.note}</p>
              )}

              <Label htmlFor="getting-started-llm-provider">Model provider</Label>
              <Select
                value={llmProvider}
                onValueChange={handleProviderChange}
                disabled={directoryEdited || restartRequired}
              >
                <SelectTrigger id="getting-started-llm-provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {LLM_PROVIDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid gap-3 md:grid-cols-2">
                {llmProvider === 'bedrock' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="getting-started-llm-region">AWS region</Label>
                    <Input
                      id="getting-started-llm-region"
                      value={llmRegion}
                      onChange={(event) => setLlmRegion(event.target.value)}
                      placeholder="us-east-1"
                      disabled={directoryEdited || restartRequired}
                    />
                  </div>
                )}
                {(llmProvider === 'custom' || llmProvider === 'anthropic') && (
                  <div className="space-y-1.5">
                    <Label htmlFor="getting-started-llm-base-url">
                      {llmProvider === 'anthropic'
                        ? 'Base URL (optional — leave empty for api.anthropic.com)'
                        : 'Base URL'}
                    </Label>
                    <Input
                      id="getting-started-llm-base-url"
                      value={llmBaseUrl}
                      onChange={(event) => setLlmBaseUrl(event.target.value)}
                      placeholder={
                        llmProvider === 'anthropic'
                          ? 'https://api.anthropic.com'
                          : 'https://your-gateway/v1'
                      }
                      className="font-mono text-xs"
                      disabled={directoryEdited || restartRequired}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="getting-started-llm-model">
                    {llmProvider === 'bedrock' ? 'Model or inference profile ID' : 'Model'}
                  </Label>
                  <Input
                    id="getting-started-llm-model"
                    value={llmModel}
                    onChange={(event) => setLlmModel(event.target.value)}
                    placeholder={
                      llmProvider === 'bedrock'
                        ? 'e.g. openai.gpt-oss-120b-1:0'
                        : llmProvider === 'anthropic'
                          ? 'claude-sonnet-5'
                          : llmProvider === 'custom'
                            ? 'Model name served by the endpoint'
                            : 'gpt-5.4'
                    }
                    disabled={directoryEdited || restartRequired}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="getting-started-llm-key">{llmKeyLabel}</Label>
                    {(llmProvider === 'bedrock' || /\.api\.aws\b/.test(llmBaseUrl)) && <BedrockKeyHelp />}
                  </div>
                  <Input
                    id="getting-started-llm-key"
                    type="password"
                    value={llmApiKey}
                    onChange={(event) => setLlmApiKey(event.target.value)}
                    placeholder={
                      llmSettings?.hasApiKey
                        ? `Saved ${llmSettings.apiKeyMasked || ''}`.trim()
                        : llmProvider === 'openai'
                          ? 'sk-...'
                          : llmProvider === 'anthropic'
                            ? 'sk-ant-...'
                            : llmProvider === 'custom' || bedrockKeyOptional
                              ? 'Optional'
                              : 'Bedrock API key'
                    }
                    autoComplete="off"
                    disabled={directoryEdited || restartRequired}
                  />
                  {llmKeyHint && <p className="text-xs text-slate-500">{llmKeyHint}</p>}
                </div>
              </div>
              {llmProvider === 'bedrock' && bedrockEndpointLabel && (
                <p className="text-xs text-slate-500">
                  Uses {bedrockEndpointLabel}. The model must support tool calling for agent
                  features.
                </p>
              )}
              {directoryEdited && (
                <p className="text-xs font-medium text-amber-700">
                  Save the local data directory and restart CloudAgent before entering provider
                  details.
                </p>
              )}
              {(llmSettings?.configured || llmSettings?.hasApiKey) && (
                <div className="flex items-center gap-2 text-xs text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  A model provider is already configured in this workspace.
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            disabled={
              isLoading ||
              isSaving ||
              (directoryEdited ? !canSaveDirectory : !canGoToCloudSetup)
            }
            onClick={saveAndGoToCloudSetup}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {directoryEdited ? 'Save Directory' : 'Go to Cloud Setup'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
