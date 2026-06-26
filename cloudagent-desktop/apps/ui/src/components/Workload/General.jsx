import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { XCircle, ChevronDown, ChevronUp, Plus, RefreshCw } from 'lucide-react';
import { filterCloudEnvironments } from '@/helpers/shared';
import {
  getAwsAccountIdForWorkloadEnvironment,
  resolveWorkloadEnvironmentRef,
} from '@/features/workload/workloadEnvironmentUtils';

function General({
  formData,
  setFormData,
  userProfile,
  workload,
  onEnvironmentAddedFromPermission,
  awsRegionOptions = [],
  diagramUrl,
  diagramGeneratedAt,
  onRefreshDiagram,
  isRefreshingDiagram,
  showDiagram = true,
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [regionsDropdownOpen, setRegionsDropdownOpen] = useState(false);
  const [environmentModalOpen, setEnvironmentModalOpen] = useState(false);
  const [diagramModalOpen, setDiagramModalOpen] = useState(false);
  const [diagramImageError, setDiagramImageError] = useState(false);
  const regionsDropdownRef = useRef(null);

  useEffect(() => {
    setDiagramImageError(false);
  }, [diagramUrl]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        regionsDropdownRef.current &&
        !regionsDropdownRef.current.contains(event.target)
      ) {
        setRegionsDropdownOpen(false);
      }
    };
    if (regionsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [regionsDropdownOpen]);
  const permissionProfiles = userProfile?.agentPermissionProfiles || [];

  const environmentsWithLabels = useMemo(() => {
    if (!Array.isArray(formData.environments)) return [];
    return formData.environments.map((envValue) => {
      const resolved = resolveWorkloadEnvironmentRef(envValue, permissionProfiles);
      const awsAccountId =
        getAwsAccountIdForWorkloadEnvironment(envValue, permissionProfiles) || '';
      return {
        accountId: awsAccountId,
        displayName: resolved?.name || awsAccountId || String(envValue || ''),
      };
    });
  }, [formData.environments, permissionProfiles]);

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full text-left mb-4"
        >
          <h3 className="text-lg font-semibold text-gray-900">Workload Settings</h3>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </button>
        {isExpanded && (
          <div className="space-y-4">
            <div
              className={
                showDiagram ? 'grid grid-cols-1 lg:grid-cols-5 gap-6' : 'space-y-4'
              }
            >
              <div className={showDiagram ? 'lg:col-span-3 space-y-4' : 'space-y-4'}>
                <div>
                  <Label htmlFor="wl-name" className="block mb-2 text-sm">
                    Workload Name <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="wl-name"
                    value={formData.workloadName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, workloadName: e.target.value }))}
                    placeholder="Enter workload name"
                    className={`text-sm h-9 ${
                      !formData.workloadName || formData.workloadName.trim() === ''
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : ''
                    }`}
                  />
                </div>

                <div>
                  <Label htmlFor="wl-description" className="block mb-2 text-sm">
                    Description <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="wl-description"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter workload description"
                    className={`text-sm h-9 ${
                      !formData.description || formData.description.trim() === ''
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : ''
                    }`}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="block text-sm">
                        Environments <span className="text-red-500 ml-1">*</span>
                      </Label>
                      <button
                        type="button"
                        onClick={() => setEnvironmentModalOpen(true)}
                        className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1.5 font-medium"
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </button>
                    </div>
                    <div
                      className={`space-y-2 ${
                        (formData.environments?.length || 0) === 0
                          ? 'border border-red-300 rounded-md p-3 bg-red-50'
                          : ''
                      }`}
                    >
                      {Array.isArray(formData.environments) && formData.environments.length > 0 ? (
                        environmentsWithLabels.map((env, index) => (
                          <div key={`${env.accountId}-${index}`} className="flex gap-2 items-center">
                            <span className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded border flex-1">
                              {env.displayName} ({env.accountId})
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newEnvs = formData.environments.filter((_, i) => i !== index);
                                setFormData((prev) => ({ ...prev, environments: newEnvs }));
                              }}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                      ) : (
                        <div
                          className={`text-sm ${
                            (formData.environments?.length || 0) === 0 ? 'text-red-500' : 'text-gray-500'
                          }`}
                        >
                          {(formData.environments?.length || 0) === 0
                            ? 'Please select at least one environment'
                            : 'No environments configured'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="mb-2 block text-sm">Default AWS Regions</Label>
                    <div className="relative" ref={regionsDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setRegionsDropdownOpen(!regionsDropdownOpen)}
                        className="w-full px-3 py-2 text-left border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                      >
                        <span
                          className={
                            formData.deploymentPreferences?.defaultRegions?.length > 0
                              ? 'text-gray-900'
                              : 'text-gray-500'
                          }
                        >
                          {formData.deploymentPreferences?.defaultRegions?.length > 0
                            ? `${formData.deploymentPreferences.defaultRegions.length} region(s) selected`
                            : 'Select AWS regions...'}
                        </span>
                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      </button>

                      {regionsDropdownOpen && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          <div className="p-2">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">
                                Select Regions
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    deploymentPreferences: {
                                      ...prev.deploymentPreferences,
                                      defaultRegions: [],
                                    },
                                  }));
                                  setRegionsDropdownOpen(false);
                                }}
                                className="text-xs text-primary-600 hover:text-primary-700"
                              >
                                Clear
                              </button>
                            </div>
                            {awsRegionOptions.map((region) => {
                              const isSelected = formData.deploymentPreferences?.defaultRegions?.includes(
                                region.value
                              );
                              return (
                                <label
                                  key={region.value}
                                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    className="form-checkbox h-4 w-4 text-primary-600 rounded"
                                    checked={isSelected}
                                    onChange={() => {
                                      setFormData((prev) => {
                                        const current = prev.deploymentPreferences?.defaultRegions || [];
                                        const next = isSelected
                                          ? current.filter((r) => r !== region.value)
                                          : [...current, region.value];
                                        return {
                                          ...prev,
                                          deploymentPreferences: {
                                            ...prev.deploymentPreferences,
                                            defaultRegions: next,
                                          },
                                        };
                                      });
                                    }}
                                  />
                                  <span className="text-sm text-gray-700">
                                    {region.label} ({region.value})
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {showDiagram && (
                <div className="lg:col-span-2">
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-3 h-full flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-800">Diagram Preview</div>
                        {diagramGeneratedAt && (
                          <div className="text-xs text-gray-500">
                            Generated {new Date(diagramGeneratedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRefreshDiagram && onRefreshDiagram()}
                          disabled={isRefreshingDiagram}
                          title={diagramUrl ? 'Refresh diagram link' : 'Generate diagram'}
                        >
                          <RefreshCw className={`h-4 w-4 ${isRefreshingDiagram ? 'animate-spin' : ''}`} />
                        </Button>
                        {diagramUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDiagramModalOpen(true)}
                          >
                            Expand
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center bg-white border border-gray-200 rounded">
                      {diagramUrl ? (
                        <button
                          type="button"
                          onClick={() => setDiagramModalOpen(true)}
                          className="w-full h-full flex items-center justify-center p-2"
                          aria-label="Open diagram preview"
                        >
                          {!diagramImageError ? (
                            <img
                              src={diagramUrl}
                              alt="Workload diagram preview"
                              className="max-h-48 w-full object-contain rounded"
                              onError={() => setDiagramImageError(true)}
                            />
                          ) : (
                            <span className="text-xs text-red-600">
                              Failed to load preview. Click to open full diagram.
                            </span>
                          )}
                        </button>
                      ) : (
                        <div className="text-xs text-gray-500 py-6 text-center px-4">
                          Click refresh to request and load a diagram preview.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>


          {/* Add Environment Modal */}
          <Dialog open={environmentModalOpen} onOpenChange={setEnvironmentModalOpen}>
            <DialogContent className="sm:max-w-[500px] bg-white">
              <DialogHeader>
                <DialogTitle>Add Environment</DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                <Label className="block mb-2">Select an environment</Label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const cloudEnvironments = filterCloudEnvironments(userProfile?.agentPermissionProfiles || []);
                    const selectedPermission = cloudEnvironments.find(
                      (p) => p.recordId === e.target.value
                    );
                    if (!selectedPermission) {
                      e.target.value = '';
                      return;
                    }
                    const authProfile =
                      typeof selectedPermission.authProfile === 'string'
                        ? JSON.parse(selectedPermission.authProfile)
                        : selectedPermission.authProfile || {};
                    const newEnv = selectedPermission.recordId || authProfile.awsAccountId || authProfile.subscriptionId;
                    const exists = (formData.environments || []).some((env) => env === newEnv);
                    if (!exists && newEnv) {
                      setFormData((prev) => ({
                        ...prev,
                        environments: [...(prev.environments || []), newEnv],
                      }));
                      if (typeof onEnvironmentAddedFromPermission === 'function') {
                        onEnvironmentAddedFromPermission(selectedPermission);
                      }
                      setEnvironmentModalOpen(false);
                    }
                    e.target.value = '';
                  }}
                  defaultValue=""
                >
                  <option value="">Select an environment to add...</option>
                  {filterCloudEnvironments(userProfile?.agentPermissionProfiles || [])
                    .filter((permission) => {
                      const type = String(permission?.type || '').trim().toLowerCase().replace(/_/g, ' ');
                      return type !== 'azure tenant';
                    })
                    .map((permission) => {
                    const authProfile =
                      typeof permission.authProfile === 'string'
                        ? JSON.parse(permission.authProfile)
                        : permission.authProfile || {};
                    const identifier = authProfile.awsAccountId || authProfile.subscriptionId || 'N/A';
                    return (
                      <option key={permission.recordId} value={permission.recordId}>
                        {permission.name} ({identifier})
                      </option>
                    );
                  })}
                </select>
              </div>
            </DialogContent>
          </Dialog>

          {/* Diagram modal */}
          {showDiagram && diagramUrl && (
            <Dialog open={diagramModalOpen} onOpenChange={setDiagramModalOpen}>
              <DialogContent className="max-w-5xl w-full h-[80vh] bg-white">
                <DialogHeader>
                  <DialogTitle>Workload Diagram</DialogTitle>
                </DialogHeader>
                <div className="w-full h-[70vh] overflow-auto flex items-center justify-center bg-gray-50 rounded border border-gray-200">
                  <img
                    src={diagramUrl}
                    alt="Full workload diagram"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </DialogContent>
            </Dialog>
          )}

        </div>
        )}
      </div>
    </div>
  );
}

export default General;
