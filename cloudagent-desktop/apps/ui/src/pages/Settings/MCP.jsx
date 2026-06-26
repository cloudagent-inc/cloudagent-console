import React, { useState, useEffect } from 'react';
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
  Copy,
  Download,
  CheckCircle,
  Info,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ACTIVE_CUSTOMER_KEY,
  APP_NAME,
  MCP_SERVER_URL,
} from '../../config/appConfig';

export default function MCPPage() {
  const [configContent, setConfigContent] = useState('');
  const [activeTab, setActiveTab] = useState('General');
  const isEnabled = true; // MCP extension is always enabled

  // Generate configuration file content (without headers for OAuth)
  const generateConfigContent = () => {
    return `{
  "mcpServers": {
    "${ACTIVE_CUSTOMER_KEY}": {
      "url": "${MCP_SERVER_URL}",
      "enabled": true
    }
  }
}`;
  };
  
  useEffect(() => {
    // Always generate config content since MCP is always enabled
    setConfigContent(generateConfigContent());
  }, []);

  // Handle copy config
  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(configContent);
      toast.success('Configuration copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy configuration');
    }
  };

  // Handle download config
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

  return (
    <div className="space-y-6">
      {/* MCP Extension Status */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <Label
                htmlFor="mcp-toggle"
                className="text-lg font-semibold text-primary-800"
              >
                MCP Extension
              </Label>
              <p className="text-sm text-gray-600 mt-1">
                MCP extension is always enabled. Generate a configuration file for MCP integration. Authentication uses OAuth.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="mcp-toggle"
                checked={isEnabled}
                disabled={true}
                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=unchecked]:bg-gray-200 data-[state=unchecked]:border-gray-300"
              />
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration File and Instructions Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration File Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="secondary">Config</Badge>
                Configuration File
              </CardTitle>
              <CardDescription>
                Download or copy the configuration file to set up MCP
                integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleCopyConfig}
                  disabled={!configContent}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Configuration
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadConfig}
                  disabled={!configContent}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Config
                </Button>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="text-sm font-mono text-gray-700 overflow-x-auto">
                  {configContent}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Instructions Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Setup Instructions
              </CardTitle>
              <CardDescription>
                Follow these steps to integrate {APP_NAME} with your
                MCP-compatible tools
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Tab Navigation */}
              <div className="flex border-b mb-4">
                {['General', 'Cursor', 'ChatGPT', 'Claude'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="space-y-4">
                {activeTab === 'General' && (
                  <>
                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        1. Configure MCP Server URL
                      </h4>
                      <p className="text-sm text-gray-600">
                        Point your MCP-compatible tool to the {APP_NAME} MCP server:
                      </p>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <code className="text-sm font-mono">
                          {MCP_SERVER_URL}
                        </code>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        2. Configuration File Format
                      </h4>
                      <p className="text-sm text-gray-600">
                        If your tool requires a configuration file, use the format shown in the configuration file section on the left. The configuration typically includes the server URL and enabled status.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        3. Authenticate with OAuth
                      </h4>
                      <p className="text-sm text-gray-600">
                        Follow your tool's OAuth authentication instructions when prompted. You'll be asked to authenticate when first connecting to the MCP server.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        4. Verify Connection
                      </h4>
                      <p className="text-sm text-gray-600">
                        Test the connection by asking your AI tool to access {APP_NAME} resources. You should see {APP_NAME} tools available in your tool's interface.
                      </p>
                    </div>
                  </>
                )}

                {activeTab === 'Cursor' && (
                  <>
                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        1. Open Cursor Settings
                      </h4>
                      <p className="text-sm text-gray-600">
                        Go to Cursor → Settings → Cursor Settings
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        2. Navigate to Tools & MCP
                      </h4>
                      <p className="text-sm text-gray-600">
                        In the settings sidebar, click on "Tools & MCP"
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        3. Add MCP Configuration
                      </h4>
                      <p className="text-sm text-gray-600">
                        Click "Add MCP Server" and paste the configuration from
                        the left panel.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        4. Restart Cursor
                      </h4>
                      <p className="text-sm text-gray-600">
                        Restart Cursor to load the new MCP configuration.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        5. Authenticate with OAuth
                      </h4>
                      <p className="text-sm text-gray-600">
                        When you first use the MCP server, Cursor will prompt you to authenticate using OAuth. Follow the authentication flow to complete setup.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        6. Test Integration
                      </h4>
                      <p className="text-sm text-gray-600">
                        Ask Cursor to access your {APP_NAME} resources or list
                        your cloud environments.
                      </p>
                    </div>
                  </>
                )}

                {activeTab === 'ChatGPT' && (
                  <>
                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        1. Install ChatGPT Desktop
                      </h4>
                      <p className="text-sm text-gray-600">
                        Download and install ChatGPT Desktop from the official
                        website.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        2. Open Settings
                      </h4>
                      <p className="text-sm text-gray-600">
                        In ChatGPT Desktop, go to Settings → Plugins
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        3. Configure MCP
                      </h4>
                      <p className="text-sm text-gray-600">
                        Add the MCP configuration to your ChatGPT Desktop
                        settings file:
                      </p>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <code className="text-sm font-mono">
                          ~/.config/chatgpt-desktop/mcp-servers.json
                        </code>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        4. Restart ChatGPT
                      </h4>
                      <p className="text-sm text-gray-600">
                        Restart ChatGPT Desktop to load the new configuration.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        5. Verify Connection
                      </h4>
                      <p className="text-sm text-gray-600">
                        Ask ChatGPT to access your {APP_NAME} resources or list
                        your cloud environments.
                      </p>
                    </div>
                  </>
                )}

                {activeTab === 'Claude' && (
                  <>
                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        1. Open Claude Desktop
                      </h4>
                      <p className="text-sm text-gray-600">
                        Launch Claude Desktop application
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        2. Access Settings
                      </h4>
                      <p className="text-sm text-gray-600">
                        Go to Claude → Settings (or press Cmd/Ctrl + ,)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        3. Navigate to Connectors
                      </h4>
                      <p className="text-sm text-gray-600">
                        In the settings sidebar, click on "Connectors"
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        4. Add Custom Connector
                      </h4>
                      <p className="text-sm text-gray-600">
                        Click "Add Custom Connector" and enter the following:
                      </p>
                      <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 ml-4">
                        <li>
                          <strong>Name:</strong> {APP_NAME} (or any name you prefer)
                        </li>
                        <li>
                          <strong>URL:</strong>{' '}
                          <code className="font-mono">
                            {MCP_SERVER_URL}
                          </code>
                        </li>
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        5. Follow Authentication Instructions
                      </h4>
                      <p className="text-sm text-gray-600">
                        Follow the OAuth authentication instructions that appear to complete the setup.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-primary-800">
                        6. Test Integration
                      </h4>
                      <p className="text-sm text-gray-600">
                        Ask Claude to access your {APP_NAME} resources or list
                        your cloud environments.
                      </p>
                    </div>
                  </>
                )}

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Authentication:</strong> MCP authentication uses OAuth. 
                    You'll be prompted to authenticate when connecting to the MCP server.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
