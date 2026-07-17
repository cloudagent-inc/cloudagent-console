import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Server,
  TerminalSquare,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { settingsClient } from '@/api/clients/settingsClient';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';

function StatusIcon({ ok, disabled }) {
  if (disabled) return <CheckCircle2 className="h-4 w-4 text-slate-400" />;
  if (ok) return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  return <XCircle className="h-4 w-4 text-amber-600" />;
}

function StatusRow({ label, ok, disabled = false, detail, command, optional = false }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <StatusIcon ok={ok} disabled={disabled} />
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
    </div>
  );
}

export default function LocalReadinessPage() {
  const isLocalMode = isLocalRuntime();
  const [runtimeInfo, setRuntimeInfo] = useState(null);
  const [localMcpEnabled, setLocalMcpEnabled] = useState(true);
  const [readinessStatus, setReadinessStatus] = useState(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [isSavingMcp, setIsSavingMcp] = useState(false);

  const refreshLocalReadiness = useCallback(async () => {
    if (!isLocalMode) return null;
    setReadinessLoading(true);
    try {
      const response = await settingsClient.getPreferencesStatus();
      const nextStatus = response?.status || null;
      setReadinessStatus(nextStatus);
      return nextStatus;
    } catch (error) {
      console.warn('Failed to load local readiness status', error);
      toast.error(error?.message || 'Failed to load local readiness status');
      return null;
    } finally {
      setReadinessLoading(false);
    }
  }, [isLocalMode]);

  useEffect(() => {
    if (!isLocalMode) return;
    let mounted = true;
    Promise.all([
      settingsClient.getPreferencesStatus().catch(() => null),
      typeof window !== 'undefined' && typeof window.cloudAgentRuntime?.getLocalRuntimeInfo === 'function'
        ? window.cloudAgentRuntime.getLocalRuntimeInfo().catch(() => null)
        : Promise.resolve(null),
    ]).then(([readinessResponse, runtimeResponse]) => {
      if (!mounted) return;
      setReadinessStatus(readinessResponse?.status || null);
      setRuntimeInfo(runtimeResponse || null);
      setLocalMcpEnabled(runtimeResponse?.configuredMcpEnabled ?? runtimeResponse?.mcpEnabled ?? true);
    });
    return () => {
      mounted = false;
    };
  }, [isLocalMode]);

  const localMcpChanged = useMemo(
    () => localMcpEnabled !== (runtimeInfo?.configuredMcpEnabled ?? runtimeInfo?.mcpEnabled ?? true),
    [localMcpEnabled, runtimeInfo]
  );

  const saveLocalMcpPreference = useCallback(async () => {
    if (!localMcpChanged) return;
    if (typeof window.cloudAgentRuntime?.setLocalMcpEnabled !== 'function') {
      toast.error('Local MCP settings are not available in this environment');
      return;
    }
    setIsSavingMcp(true);
    try {
      const runtimeResponse = await window.cloudAgentRuntime.setLocalMcpEnabled(localMcpEnabled);
      if (runtimeResponse?.ok === false) {
        throw new Error(runtimeResponse.error || 'Failed to save local MCP preference');
      }
      setRuntimeInfo((current) => ({
        ...(current || {}),
        ...(runtimeResponse || {}),
      }));
      setLocalMcpEnabled(runtimeResponse?.configuredMcpEnabled ?? runtimeResponse?.mcpEnabled ?? localMcpEnabled);
      window.dispatchEvent(new CustomEvent('cloudagent:local-runtime-settings-updated', {
        detail: runtimeResponse,
      }));
      toast.success('Local MCP preference saved');
      await refreshLocalReadiness();
    } catch (error) {
      toast.error(error?.message || 'Failed to save local MCP preference');
    } finally {
      setIsSavingMcp(false);
    }
  }, [localMcpChanged, localMcpEnabled, refreshLocalReadiness]);

  if (!isLocalMode) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Local Readiness</CardTitle>
            <CardDescription>
              Local readiness checks are only available in the desktop local runtime.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
            <Server className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Local Readiness</h1>
            <p className="mt-1 text-sm text-gray-600">
              Check the local configuration CloudAgent needs at startup and the optional command
              line tools used by local workflows.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={refreshLocalReadiness}
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

      <Card>
        <CardHeader>
          <CardTitle>Readiness Checks</CardTitle>
          <CardDescription>
            Verify required local settings and optional tools for local CloudAgent workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!readinessStatus && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {readinessLoading ? 'Checking local readiness...' : 'Local readiness has not been checked yet.'}
            </div>
          )}

          {readinessStatus && (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <StatusRow
                  label="OpenAI provider"
                  ok={readinessStatus.openai?.ok}
                  detail={
                    readinessStatus.openai?.ok
                      ? `${readinessStatus.openai.model || 'Model configured'} from ${readinessStatus.openai.source || 'preferences'}`
                      : readinessStatus.openai?.message || 'API key is not configured.'
                  }
                />
                <StatusRow
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

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    {localMcpEnabled ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                    )}
                    <div>
                      <Label htmlFor="local-mcp-enabled" className="text-sm font-medium text-slate-900">
                        Local MCP server
                      </Label>
                      <p className="mt-1 text-xs text-slate-500">
                        {localMcpEnabled
                          ? 'Enabled for local agent and CLI tool access.'
                          : 'Disabled. Agent workflows that depend on MCP tools will use fallback behavior where available.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <Switch
                      id="local-mcp-enabled"
                      checked={localMcpEnabled}
                      onCheckedChange={setLocalMcpEnabled}
                      className="data-[state=checked]:!bg-blue-500"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={saveLocalMcpPreference}
                      disabled={!localMcpChanged || isSavingMcp}
                    >
                      {isSavingMcp ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Save
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TerminalSquare className="h-4 w-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-900">Optional command line tools</h3>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {Object.entries(readinessStatus.tools || {}).map(([key, tool]) => (
                    <StatusRow
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
