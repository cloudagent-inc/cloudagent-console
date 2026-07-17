import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { sendWorkloadDiscoveryChat } from '@/api/workloadDiscoveryApi';
import { filterCloudEnvironments, getRegionOptions } from '@/helpers/shared';
import toast from 'react-hot-toast';

export const SERVICE_OPTIONS = [
  { value: 's3', label: 'S3' },
  { value: 'dynamodb', label: 'DynamoDB' },
  { value: 'lambda', label: 'Lambda' },
  { value: 'iam', label: 'IAM' },
  { value: 'ec2', label: 'EC2' },
  { value: 'elbv2', label: 'Elastic Load Balancing V2' },
  { value: 'ecs', label: 'ECS' },
  { value: 'logs', label: 'Logs' },
  { value: 'autoscaling', label: 'Auto Scaling' },
  { value: 'ecr', label: 'ECR' },
  { value: 'eks', label: 'EKS' },
  { value: 'rds', label: 'RDS' },
  { value: 'elasticache', label: 'ElastiCache' },
  { value: 'opensearch', label: 'OpenSearch Service' },
  { value: 'efs', label: 'EFS' },
  { value: 'sqs', label: 'SQS' },
  { value: 'sns', label: 'SNS' },
  { value: 'apigateway', label: 'API Gateway' },
  { value: 'apigatewayv2', label: 'API Gateway V2' },
  { value: 'cloudfront', label: 'CloudFront' },
  { value: 'sfn', label: 'Step Functions' },
];

const REGION_OPTIONS = getRegionOptions();

const normalizeTrackedResources = (trackedResources) => {
  if (!trackedResources) {
    return { resources: [], stacks: [] };
  }
  if (trackedResources.resources || trackedResources.stacks) {
    return {
      resources: Array.isArray(trackedResources.resources)
        ? trackedResources.resources
        : [],
      stacks: Array.isArray(trackedResources.stacks) ? trackedResources.stacks : [],
    };
  }
  if (Array.isArray(trackedResources)) {
    return { resources: trackedResources, stacks: [] };
  }
  return { resources: [], stacks: [] };
};

const getResourceLabel = (resource) => {
  if (!resource) return 'Resource';
  return (
    resource.resourceId ||
    resource.arn ||
    resource.name ||
    resource.resourceName ||
    resource.id ||
    'Resource'
  );
};

const getStackLabel = (stack) => {
  if (!stack) return 'Stack';
  return stack.stackId || stack.name || stack.id || 'Stack';
};

function ImportStep({
  userProfile,
  importState,
  setImportState,
  onSkip,
}) {
  const permissionProfiles = useMemo(
    () => filterCloudEnvironments(userProfile?.agentPermissionProfiles || []).filter((profile) => {
      const type = String(profile?.type || '').trim().toLowerCase().replace(/_/g, ' ');
      return type !== 'azure tenant';
    }),
    [userProfile]
  );

  const updateImportState = (patch) => {
    setImportState((prev) => ({ ...prev, ...patch }));
  };

  const getSelectedCloudProvider = () => {
    const profile = permissionProfiles.find(
      (item) => (item.id || item.recordId) === importState.selectedPermissionProfileId
    );
    let authProfile = {};
    try {
      authProfile =
        typeof profile?.authProfile === 'string'
          ? JSON.parse(profile.authProfile || '{}')
          : profile?.authProfile || {};
    } catch (_) {
      authProfile = {};
    }
    const profileType = String(profile?.type || authProfile?.provider || '').trim().toLowerCase().replace(/_/g, ' ');
    return profileType === 'azure subscription' || authProfile?.provider === 'azure' ? 'azure' : 'aws';
  };

  const toggleService = (serviceValue) => {
    updateImportState({
      selectedServices: importState.selectedServices.includes(serviceValue)
        ? importState.selectedServices.filter((service) => service !== serviceValue)
        : [...importState.selectedServices, serviceValue],
      servicesTouched: true,
    });
  };

  const toggleRegion = (region) => {
    updateImportState({
      selectedRegions: importState.selectedRegions.includes(region)
        ? importState.selectedRegions.filter((item) => item !== region)
        : [...importState.selectedRegions, region],
      regionsTouched: true,
    });
  };

  const handleServiceModeChange = (mode) => {
    if (mode === 'all') {
      updateImportState({
        serviceMode: mode,
        selectedServices: SERVICE_OPTIONS.map((service) => service.value),
      });
    } else {
      updateImportState({ serviceMode: mode });
    }
  };

  const buildEnvironmentNotes = () => {
    const directive =
      'IMPORTANT: Return exactly one workload. If multiple are possible, pick the best match and merge resources into a single workload.';
    const notes = (importState.notes || '').trim();
    if (!notes) return directive;
    return `${notes}\n\n${directive}`;
  };

  const handleStartDiscovery = async () => {
    if (!importState.selectedPermissionProfileId) {
      toast.error('Select an environment to scan.');
      return;
    }
    if (!importState.selectedServices.length) {
      toast.error('Select at least one service.');
      return;
    }
    if (!importState.selectedRegions.length) {
      toast.error('Select at least one region.');
      return;
    }

    updateImportState({
      isLoading: true,
      isScanning: true,
      scanProgress: 'Starting scan...',
      discoveredWorkloads: [],
      selectedWorkloadIndex: 0,
      approved: false,
    });

    try {
      await sendWorkloadDiscoveryChat(
        {
          cloudProvider: getSelectedCloudProvider(),
          permissionProfileId: importState.selectedPermissionProfileId,
          services: importState.selectedServices,
          regions: importState.selectedRegions,
          environmentNotes: buildEnvironmentNotes(),
        },
        {
          onScanStart: () => {
            updateImportState({ isScanning: true, scanProgress: 'Scanning resources...' });
          },
          onInventorySaved: (data) => {
            const path = data?.inventory?.path;
            if (path) {
              console.log('[ImportStep] inventory saved:', path);
            }
          },
          onScanData: () => {
            updateImportState({ scanProgress: 'Scanning resources...' });
          },
          onScanComplete: () => {
            updateImportState({ isScanning: false, scanProgress: 'Analyzing...' });
          },
          onAgentStart: () => {
            updateImportState({ scanProgress: 'Analyzing...' });
          },
          onToolCall: (data) => {
            const toolName = data.name || data.tool_name || 'Tool';
            const formatted = toolName
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (letter) => letter.toUpperCase());
            updateImportState({ scanProgress: `${formatted}...` });
          },
          onDiscoveryComplete: (data) => {
            if (data.workloads) {
              const normalized = data.workloads.map((workload) => ({
                ...workload,
                trackedResources: normalizeTrackedResources(workload.trackedResources),
              }));
              updateImportState({
                discoveredWorkloads: normalized,
                selectedWorkloadIndex: 0,
              });
            }
          },
          onFinal: (data) => {
            if (data.discovery?.workloads) {
              const normalized = data.discovery.workloads.map((workload) => ({
                ...workload,
                trackedResources: normalizeTrackedResources(workload.trackedResources),
              }));
              updateImportState({
                discoveredWorkloads: normalized,
                selectedWorkloadIndex: 0,
              });
            }
          },
          onDone: () => {
            updateImportState({ isLoading: false, isScanning: false, scanProgress: '' });
          },
          onError: (data) => {
            updateImportState({ isLoading: false, isScanning: false, scanProgress: '' });
            toast.error(data.error || 'Failed to scan workloads.');
          },
        }
      );
    } catch (error) {
      updateImportState({ isLoading: false, isScanning: false, scanProgress: '' });
      toast.error(error?.message || 'Failed to start discovery.');
    }
  };

  const workloads = importState.discoveredWorkloads || [];
  const hasDiscoveredWorkloads = workloads.length > 0;
  const selectedWorkload = workloads[importState.selectedWorkloadIndex] || null;
  const selectedResources =
    selectedWorkload?.trackedResources?.resources || [];
  const selectedStacks = selectedWorkload?.trackedResources?.stacks || [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label className="mb-2 block">Environment to scan</Label>
          <Select
            value={importState.selectedPermissionProfileId || ''}
            onValueChange={(value) =>
              updateImportState({
                selectedPermissionProfileId: value,
                approved: false,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select environment" />
            </SelectTrigger>
            <SelectContent>
              {permissionProfiles.map((profile) => {
                let accountId = '';
                try {
                  const authProfile =
                    typeof profile.authProfile === 'string'
                      ? JSON.parse(profile.authProfile)
                      : profile.authProfile || {};
                  accountId = authProfile.awsAccountId || authProfile.subscriptionId || '';
                } catch (_) {
                  accountId = '';
                }
                return (
                  <SelectItem key={profile.recordId} value={profile.recordId}>
                    {profile.name} {accountId ? `(${accountId})` : ''}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-2 block">Regions</Label>
          <ScrollArea className="h-32 rounded-md border border-slate-200">
            <div className="grid grid-cols-2 gap-2 p-2">
              {REGION_OPTIONS.map((region) => (
                <label
                  key={region.value}
                  className="flex items-center gap-2 text-xs text-slate-600"
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300"
                    checked={importState.selectedRegions.includes(region.value)}
                    onChange={() => toggleRegion(region.value)}
                  />
                  {region.label}
                </label>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Services</Label>
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="serviceMode"
              checked={importState.serviceMode === 'all'}
              onChange={() => handleServiceModeChange('all')}
            />
            All services
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="serviceMode"
              checked={importState.serviceMode === 'custom'}
              onChange={() => handleServiceModeChange('custom')}
            />
            Choose services
          </label>
        </div>
        {importState.serviceMode === 'custom' && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
            {SERVICE_OPTIONS.map((service) => (
              <label
                key={service.value}
                className="flex items-center gap-2"
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300"
                  checked={importState.selectedServices.includes(service.value)}
                  onChange={() => toggleService(service.value)}
                />
                {service.label}
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="import-notes" className="mb-2 block">
          Workload description for discovery
        </Label>
        <Textarea
          id="import-notes"
          value={importState.notes}
          onChange={(event) => updateImportState({ notes: event.target.value })}
          placeholder="Describe what this workload is and what it uses..."
          rows={4}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleStartDiscovery} disabled={importState.isLoading}>
          {importState.isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scanning...
            </>
          ) : (
            hasDiscoveredWorkloads ? 'Re-run scan' : 'Run scan'
          )}
        </Button>
        <Button variant="outline" onClick={onSkip}>
          Skip import
        </Button>
        {importState.scanProgress && (
          <div className="text-xs text-slate-500">{importState.scanProgress}</div>
        )}
      </div>

      {workloads.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-800">
                Discovered workload
              </div>
              <div className="text-xs text-slate-500">
                Review resources before attaching them to this workload.
              </div>
            </div>
            {workloads.length > 1 && (
              <Select
                value={String(importState.selectedWorkloadIndex)}
                onValueChange={(value) =>
                  updateImportState({ selectedWorkloadIndex: Number(value) })
                }
              >
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select workload" />
                </SelectTrigger>
                <SelectContent>
                  {workloads.map((workload, index) => (
                    <SelectItem key={`${workload.name || 'workload'}-${index}`} value={String(index)}>
                      {workload.name || `Workload ${index + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedWorkload && (
            <div className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {selectedWorkload.name || 'Untitled workload'}
                </div>
                <div className="text-xs text-slate-500">
                  {selectedWorkload.description || 'No description returned.'}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {selectedResources.length} resources
                </Badge>
                <Badge variant="secondary">{selectedStacks.length} stacks</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-slate-600 mb-2">
                    Resources
                  </div>
                  <ScrollArea className="h-32 rounded-md border border-slate-100">
                    <div className="space-y-2 p-2">
                      {selectedResources.length === 0 && (
                        <div className="text-xs text-slate-400">
                          No resources detected.
                        </div>
                      )}
                      {selectedResources.map((resource, idx) => (
                        <div key={`${getResourceLabel(resource)}-${idx}`} className="text-xs text-slate-600">
                          {getResourceLabel(resource)}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600 mb-2">
                    Stacks
                  </div>
                  <ScrollArea className="h-32 rounded-md border border-slate-100">
                    <div className="space-y-2 p-2">
                      {selectedStacks.length === 0 && (
                        <div className="text-xs text-slate-400">
                          No stacks detected.
                        </div>
                      )}
                      {selectedStacks.map((stack, idx) => (
                        <div key={`${getStackLabel(stack)}-${idx}`} className="text-xs text-slate-600">
                          {getStackLabel(stack)}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300"
                  checked={importState.useDiscoveredDetails}
                  onChange={(event) =>
                    updateImportState({ useDiscoveredDetails: event.target.checked })
                  }
                />
                Use discovered name and description for this workload
              </label>
              <div className="text-xs text-slate-500">
                Continue to the next step to attach these resources.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ImportStep;
