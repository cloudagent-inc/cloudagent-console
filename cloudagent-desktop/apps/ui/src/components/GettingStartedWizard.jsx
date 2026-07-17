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
import { settingsClient } from '@/api/clients/settingsClient';

const DEFAULT_MODEL = 'gpt-5.4';

export default function GettingStartedWizard({ open, onComplete }) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [openAISettings, setOpenAISettings] = useState(null);
  const [openAIKey, setOpenAIKey] = useState('');
  const [runtimeInfo, setRuntimeInfo] = useState(null);
  const [localDataDir, setLocalDataDir] = useState('');
  const [hasSavedDirectoryChange, setHasSavedDirectoryChange] = useState(false);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setIsLoading(true);

    Promise.all([
      settingsClient.getOpenAISettings(),
      typeof window !== 'undefined' && typeof window.cloudAgentRuntime?.getLocalRuntimeInfo === 'function'
        ? window.cloudAgentRuntime.getLocalRuntimeInfo().catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([settingsResponse, runtimeResponse]) => {
        if (!mounted) return;
        setOpenAISettings(settingsResponse?.settings || {});
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
  const hasOpenAIKey = Boolean(openAISettings?.hasApiKey || openAIKey.trim());
  const canSaveDirectory = Boolean(localDataDir.trim());
  const canGoToCloudSetup = Boolean(
    localDataDir.trim() && hasOpenAIKey && !directoryEdited && !restartRequired
  );

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
      if (!openAISettings?.hasApiKey && !openAIKey.trim()) {
        toast.error('OpenAI API key is required');
        return;
      }

      const response = await settingsClient.updateOpenAISettings({
        model: openAISettings?.model || DEFAULT_MODEL,
        ...(openAIKey.trim() ? { apiKey: openAIKey.trim() } : {}),
      });
      const settings = response?.settings || {};
      setOpenAISettings(settings);
      setOpenAIKey('');
      window.dispatchEvent(new CustomEvent('cloudagent:openai-settings-updated', {
        detail: settings,
      }));

      onComplete?.({ openAIConfigured: true });
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
            Choose where CloudAgent stores its data and configure OpenAI. You will add cloud environments next in Cloud Setup.
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

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-slate-500" />
                <Label htmlFor="getting-started-openai-key">OpenAI API key</Label>
              </div>
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
              {directoryEdited && (
                <p className="text-xs font-medium text-amber-700">
                  Save the local data directory and restart CloudAgent before entering the key.
                </p>
              )}
              {openAISettings?.hasApiKey && (
                <div className="flex items-center gap-2 text-xs text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  An OpenAI key is already saved in this workspace.
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
