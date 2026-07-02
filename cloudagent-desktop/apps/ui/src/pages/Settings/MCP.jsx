import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  Download,
  Info,
  Loader2,
  Server,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ACTIVE_CUSTOMER_KEY,
  APP_NAME,
  MCP_SERVER_URL,
} from '../../config/appConfig';
import { getRuntimeApiUrl, hasRuntimeCapability, isLocalRuntime } from '@/runtime/cloudAgentRuntime';

const TABS = ['General', 'Cursor', 'ChatGPT', 'Claude'];

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function buildMcpServerUrl(apiBaseUrl) {
  if (!apiBaseUrl) return getRuntimeApiUrl(MCP_SERVER_URL);
  const normalizedPath = MCP_SERVER_URL.startsWith('/') ? MCP_SERVER_URL : `/${MCP_SERVER_URL}`;
  return `${trimTrailingSlash(apiBaseUrl)}${normalizedPath}`;
}

function buildConfigContent(mcpServerUrl) {
  return JSON.stringify(
    {
      mcpServers: {
        [ACTIVE_CUSTOMER_KEY]: {
          url: mcpServerUrl,
          enabled: true,
        },
      },
    },
    null,
    2
  );
}

function InstructionStep({ title, children }) {
  return (
    <div className="space-y-2">
      <h4 className="font-medium text-primary-800">{title}</h4>
      <div className="text-sm text-gray-600">{children}</div>
    </div>
  );
}

function InlineCode({ children }) {
  return (
    <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800">
      {children}
    </code>
  );
}

export default function MCPPage() {
  const [activeTab, setActiveTab] = useState('General');
  const [isEnabled, setIsEnabled] = useState(hasRuntimeCapability('mcp'));
  const [isLoadingRuntime, setIsLoadingRuntime] = useState(isLocalRuntime());
  const [isTogglePending, setIsTogglePending] = useState(false);
  const [mcpServerUrl, setMcpServerUrl] = useState(() => getRuntimeApiUrl(MCP_SERVER_URL));

  const localRuntimeBridge =
    typeof window !== 'undefined' && window.cloudAgentRuntime
      ? window.cloudAgentRuntime
      : null;

  const configContent = useMemo(() => buildConfigContent(mcpServerUrl), [mcpServerUrl]);
  const canToggle = isLocalRuntime() && typeof localRuntimeBridge?.setLocalMcpEnabled === 'function';

  const applyRuntimeInfo = useCallback((info) => {
    if (!info || typeof info !== 'object') return;
    if (info.apiBaseUrl) {
      setMcpServerUrl(buildMcpServerUrl(info.apiBaseUrl));
    }
    if (typeof info.mcpEnabled === 'boolean') {
      setIsEnabled(info.mcpEnabled);
    } else if (typeof info.configuredMcpEnabled === 'boolean') {
      setIsEnabled(info.configuredMcpEnabled);
    }
  }, []);

  useEffect(() => {
    if (!isLocalRuntime() || typeof localRuntimeBridge?.getLocalRuntimeInfo !== 'function') {
      setIsLoadingRuntime(false);
      return undefined;
    }

    let isMounted = true;
    localRuntimeBridge
      .getLocalRuntimeInfo()
      .then((info) => {
        if (!isMounted) return;
        applyRuntimeInfo(info);
      })
      .catch((error) => {
        console.warn('Failed to load local MCP runtime info:', error);
        toast.error('Failed to load local MCP settings');
      })
      .finally(() => {
        if (isMounted) setIsLoadingRuntime(false);
      });

    return () => {
      isMounted = false;
    };
  }, [applyRuntimeInfo, localRuntimeBridge]);

  useEffect(() => {
    const handleLocalRuntimeSettingsUpdated = (event) => {
      applyRuntimeInfo(event?.detail || {});
    };
    window.addEventListener('cloudagent:local-runtime-settings-updated', handleLocalRuntimeSettingsUpdated);
    return () => {
      window.removeEventListener('cloudagent:local-runtime-settings-updated', handleLocalRuntimeSettingsUpdated);
    };
  }, [applyRuntimeInfo]);

  const handleToggleMcp = async (checked) => {
    if (!canToggle) return;

    const previousEnabled = isEnabled;
    setIsEnabled(checked);
    setIsTogglePending(true);
    try {
      const result = await localRuntimeBridge.setLocalMcpEnabled(checked);
      if (result?.ok === false) {
        throw new Error(result.error || 'Failed to update local MCP setting');
      }
      const nextEnabled = typeof result?.mcpEnabled === 'boolean' ? result.mcpEnabled : checked;
      const nextRuntimeInfo = {
        ...(result || {}),
        mcpEnabled: nextEnabled,
      };
      setIsEnabled(nextEnabled);
      window.dispatchEvent(new CustomEvent('cloudagent:local-runtime-settings-updated', {
        detail: nextRuntimeInfo,
      }));
      toast.success(nextEnabled ? 'Local MCP server enabled' : 'Local MCP server disabled');
    } catch (error) {
      console.error('Failed to update local MCP setting:', error);
      setIsEnabled(previousEnabled);
      toast.error(error?.message || 'Failed to update local MCP setting');
    } finally {
      setIsTogglePending(false);
    }
  };

  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(configContent);
      toast.success('Configuration copied to clipboard');
    } catch {
      toast.error('Failed to copy configuration');
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(mcpServerUrl);
      toast.success('MCP URL copied to clipboard');
    } catch {
      toast.error('Failed to copy MCP URL');
    }
  };

  const handleDownloadConfig = () => {
    const blob = new Blob([configContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mcp.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Configuration file downloaded');
  };

  const renderInstructions = () => {
    if (activeTab === 'Cursor') {
      return (
        <>
          <InstructionStep title="1. Open MCP settings">
            In Cursor, open <strong>Settings</strong>, then <strong>Tools & MCP</strong>.
          </InstructionStep>
          <InstructionStep title="2. Add CloudAgent">
            Add a new MCP server and paste the JSON from the configuration panel. For workspace-scoped setup, save it as <InlineCode>.cursor/mcp.json</InlineCode> in that workspace.
          </InstructionStep>
          <InstructionStep title="3. Keep CloudAgent running">
            CloudAgent Desktop hosts this server locally at <InlineCode>{mcpServerUrl}</InlineCode>. Cursor can only connect while this app is open and the MCP switch is on.
          </InstructionStep>
          <InstructionStep title="4. Verify tools">
            Ask Cursor to list CloudAgent tools or inspect your CloudAgent environments. If tools do not appear, reload Cursor's MCP servers after saving the config.
          </InstructionStep>
        </>
      );
    }

    if (activeTab === 'ChatGPT') {
      return (
        <>
          <InstructionStep title="1. Open connectors">
            In ChatGPT, open <strong>Settings</strong>, then <strong>Connectors</strong>. Enable developer or custom MCP connector mode if your ChatGPT build requires it.
          </InstructionStep>
          <InstructionStep title="2. Add a local MCP connector">
            Create a connector named <strong>{APP_NAME}</strong> and use <InlineCode>{mcpServerUrl}</InlineCode> as the MCP server URL.
          </InstructionStep>
          <InstructionStep title="3. Allow local access">
            The server runs on loopback only. Keep CloudAgent Desktop open and make sure the MCP switch on this page or the top bar is on.
          </InstructionStep>
          <InstructionStep title="4. Verify tools">
            Start a new chat and ask ChatGPT to list CloudAgent tools or retrieve local CloudAgent context.
          </InstructionStep>
        </>
      );
    }

    if (activeTab === 'Claude') {
      return (
        <>
          <InstructionStep title="1. Open connectors">
            In Claude, open <strong>Settings</strong>, then <strong>Connectors</strong>.
          </InstructionStep>
          <InstructionStep title="2. Add CloudAgent">
            Add a custom connector named <strong>{APP_NAME}</strong> with URL <InlineCode>{mcpServerUrl}</InlineCode>. If your Claude client uses JSON instead, paste the configuration from the left panel.
          </InstructionStep>
          <InstructionStep title="3. Keep the local server on">
            CloudAgent Desktop serves MCP from this machine. Claude can only reach it while CloudAgent is running and the MCP switch is enabled.
          </InstructionStep>
          <InstructionStep title="4. Verify tools">
            Ask Claude to list available CloudAgent tools or summarize your local CloudAgent environments.
          </InstructionStep>
        </>
      );
    }

    return (
      <>
        <InstructionStep title="1. Turn on local MCP">
          Use the switch on this page or the top-bar MCP control. Both controls use the same saved local setting.
        </InstructionStep>
        <InstructionStep title="2. Use the local server URL">
          Configure your MCP client with <InlineCode>{mcpServerUrl}</InlineCode>. The URL is local to this computer and changes if the local API port changes.
        </InstructionStep>
        <InstructionStep title="3. Add configuration">
          Paste the JSON shown in the configuration panel into clients that support <InlineCode>mcpServers</InlineCode> configuration, or enter the URL directly in clients with a connector UI.
        </InstructionStep>
        <InstructionStep title="4. Verify connection">
          Ask the client to list CloudAgent tools. Requests are rejected while the local MCP switch is off.
        </InstructionStep>
      </>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={`mt-1 flex h-9 w-9 items-center justify-center rounded-lg ${
                  isEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
                }`}
              >
                <Server className="h-5 w-5" />
              </div>
              <div>
                <Label
                  htmlFor="mcp-toggle"
                  className="text-lg font-semibold text-primary-800"
                >
                  MCP Settings
                </Label>
                <p className="mt-1 text-sm text-gray-600">
                  Control the local CloudAgent MCP server used by Cursor, ChatGPT, Claude, and other MCP clients.
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Server URL: <InlineCode>{mcpServerUrl}</InlineCode>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isLoadingRuntime || isTogglePending ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              ) : isEnabled ? (
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
              <Switch
                id="mcp-toggle"
                checked={isEnabled}
                disabled={!canToggle || isLoadingRuntime || isTogglePending}
                onCheckedChange={handleToggleMcp}
                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=unchecked]:bg-gray-200 data-[state=unchecked]:border-gray-300"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="secondary">Config</Badge>
              Local MCP Configuration
            </CardTitle>
            <CardDescription>
              Copy the loopback URL or JSON config for local MCP clients.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={handleCopyUrl}
                disabled={!mcpServerUrl}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy URL
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyConfig}
                disabled={!configContent}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Config
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadConfig}
                disabled={!configContent}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <pre className="overflow-x-auto text-sm font-mono text-gray-700">
                {configContent}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Setup Instructions
            </CardTitle>
            <CardDescription>
              Connect local MCP clients to {APP_NAME}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex border-b">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {renderInstructions()}

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Local-only:</strong> CloudAgent Desktop MCP does not use hosted OAuth. It accepts loopback requests from this machine while the local MCP server is enabled.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
