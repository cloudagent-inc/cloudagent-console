import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown } from 'lucide-react';
import { listGithubBranches } from '@/api/integrations/github';
import { buildGitRepo } from '@/helpers/github';
import { getRegionOptions } from '@/helpers/shared';

function DeploymentSettings({
  formData,
  setFormData,
  awsRegionOptions = [],
  githubConnections = [],
}) {
  const [branchOptions, setBranchOptions] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesError, setBranchesError] = useState('');
  const [regionsDropdownOpen, setRegionsDropdownOpen] = useState(false);
  const regionsDropdownRef = useRef(null);
  const isTerraform = ['terraform', 'opentofu'].includes(
    formData?.deploymentPreferences?.method
  );
  const selectedDefaultRegions = Array.isArray(
    formData?.deploymentPreferences?.defaultRegions
  )
    ? formData.deploymentPreferences.defaultRegions
    : [];
  const regionOptions = useMemo(
    () => (awsRegionOptions.length > 0 ? awsRegionOptions : getRegionOptions()),
    [awsRegionOptions]
  );
  const pipelineConfig = formData?.deploymentPreferences?.pipelineConfig || {};
  const pipelineAutoDeploy =
    pipelineConfig.autoDeploy !== undefined ? !!pipelineConfig.autoDeploy : true;
  const pipelineRequireApproval = !!pipelineConfig.requireApproval;
  const pipelineBranch = pipelineConfig.branch || '';
  const pipelineBranchLabel = isTerraform
    ? 'Terraform/OpenTofu branch'
    : formData?.deploymentPreferences?.method === 'cloudformation'
      ? 'CloudFormation branch'
      : 'Deployment branch';

  const gitRepo = buildGitRepo(formData?.deploymentPreferences?.gitRepo);
  const sourceMode =
    formData?.deploymentPreferences?.sourceMode || (gitRepo?.fullName ? 'github' : '');
  const selectedConnectionId = gitRepo?.connectionId || '';

  const selectedConnection = useMemo(
    () => githubConnections.find((connection) => connection.id === selectedConnectionId) || null,
    [githubConnections, selectedConnectionId]
  );

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

  const repoOptions = useMemo(() => {
    if (!selectedConnection?.repositories) return [];
    return selectedConnection.repositories
      .map((repo) => ({
        ...repo,
        fullName:
          repo?.fullName || (repo?.owner && repo?.name ? `${repo.owner}/${repo.name}` : ''),
      }))
      .filter((repo) => repo.fullName);
  }, [selectedConnection]);

  const selectedRepoKey = useMemo(() => {
    if (gitRepo?.fullName) return gitRepo.fullName;
    if (gitRepo?.owner && gitRepo?.repo) return `${gitRepo.owner}/${gitRepo.repo}`;
    return '';
  }, [gitRepo]);

  const selectedRepo = useMemo(
    () => repoOptions.find((repo) => repo.fullName === selectedRepoKey) || null,
    [repoOptions, selectedRepoKey]
  );

  const allowedBranches = useMemo(() => {
    if (!selectedRepo?.allowedBranches) return [];
    return selectedRepo.allowedBranches.filter(Boolean);
  }, [selectedRepo]);

  useEffect(() => {
    let isMounted = true;
    const loadBranches = async () => {
      if (sourceMode === 'none') {
        if (isMounted) {
          setBranchOptions([]);
          setBranchesError('');
          setBranchesLoading(false);
        }
        return;
      }
      if (!selectedConnectionId || !selectedRepo?.owner || !selectedRepo?.name) {
        if (isMounted) {
          setBranchOptions([]);
          setBranchesError('');
          setBranchesLoading(false);
        }
        return;
      }
      if (allowedBranches.length > 0) {
        if (isMounted) {
          setBranchOptions(allowedBranches);
          setBranchesError('');
          setBranchesLoading(false);
        }
        return;
      }
      setBranchesLoading(true);
      setBranchesError('');
      try {
        const data = await listGithubBranches(
          selectedConnectionId,
          selectedRepo.owner,
          selectedRepo.name
        );
        const branches = Array.isArray(data?.branches)
          ? data.branches.map((branch) => branch?.name).filter(Boolean)
          : [];
        if (isMounted) {
          setBranchOptions(branches);
        }
      } catch (error) {
        if (isMounted) {
          setBranchOptions([]);
          setBranchesError(error?.message || 'Failed to load branches.');
        }
      } finally {
        if (isMounted) {
          setBranchesLoading(false);
        }
      }
    };

    loadBranches();
    return () => {
      isMounted = false;
    };
  }, [selectedConnectionId, selectedRepo, allowedBranches, sourceMode]);

  const updateGitRepo = (patch) => {
    setFormData((prev) => ({
      ...prev,
      deploymentPreferences: {
        ...prev.deploymentPreferences,
        sourceMode: patch ? 'github' : prev.deploymentPreferences.sourceMode,
        gitRepo: patch ? { ...(prev.deploymentPreferences.gitRepo || {}), ...patch } : null,
      },
    }));
  };

  const updateSourceMode = (nextMode) => {
    setFormData((prev) => ({
      ...prev,
      deploymentPreferences: {
        ...prev.deploymentPreferences,
        sourceMode: nextMode,
        gitRepo: nextMode === 'none' ? null : prev.deploymentPreferences.gitRepo,
      },
    }));
  };

  const updatePipelineConfig = (patch) => {
    setFormData((prev) => {
      const current = prev.deploymentPreferences?.pipelineConfig || {};
      return {
        ...prev,
        deploymentPreferences: {
          ...prev.deploymentPreferences,
          pipelineConfig: patch ? { ...current, ...patch } : null,
        },
      };
    });
  };

  useEffect(() => {
    if (!gitRepo?.branch) return;
    setFormData((prev) => {
      const current = prev.deploymentPreferences?.pipelineConfig || {};
      if (current.branch) return prev;
      return {
        ...prev,
        deploymentPreferences: {
          ...prev.deploymentPreferences,
          pipelineConfig: {
            ...current,
            branch: gitRepo.branch,
          },
        },
      };
    });
  }, [gitRepo?.branch, setFormData]);

  const handleResourceRuleChange = (rule, value) => {
    setFormData((prev) => ({
      ...prev,
      deploymentPreferences: {
        ...prev.deploymentPreferences,
        resourceRules: {
          ...prev.deploymentPreferences.resourceRules,
          [rule]: value,
        },
      },
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Default Regions
        </h3>
        <div>
          <div className="relative" ref={regionsDropdownRef}>
            <button
              type="button"
              onClick={() => setRegionsDropdownOpen(!regionsDropdownOpen)}
              className="w-full px-3 py-2 text-left border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            >
              <span
                className={
                  selectedDefaultRegions.length > 0
                    ? 'text-gray-900'
                    : 'text-gray-500'
                }
              >
                {selectedDefaultRegions.length > 0
                  ? `${selectedDefaultRegions.length} region(s) selected`
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
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
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
                  {regionOptions.map((region) => {
                    const isSelected = selectedDefaultRegions.includes(
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
                              const current = Array.isArray(
                                prev.deploymentPreferences?.defaultRegions
                              )
                                ? prev.deploymentPreferences.defaultRegions
                                : [];
                              const isCurrentlySelected = current.includes(
                                region.value
                              );
                              const next = isCurrentlySelected
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

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">General</h3>
        <div className="space-y-4">
          <div>
            <Label className="mb-3 block">Deployment Method</Label>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="cloudformation"
                  name="deploymentMethod"
                  value="cloudformation"
                  checked={
                    formData.deploymentPreferences.method === 'cloudformation'
                  }
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      deploymentPreferences: {
                        ...prev.deploymentPreferences,
                        method: e.target.value,
                      },
                    }))
                  }
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <Label
                  htmlFor="cloudformation"
                  className="font-medium text-primary-600"
                >
                  CloudFormation
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="terraform"
                  name="deploymentMethod"
                  value="terraform"
                  checked={formData.deploymentPreferences.method === 'terraform'}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      deploymentPreferences: {
                        ...prev.deploymentPreferences,
                        method: e.target.value,
                      },
                    }))
                  }
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <Label
                  htmlFor="terraform"
                  className="font-medium text-primary-600"
                >
                  Terraform
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="opentofu"
                  name="deploymentMethod"
                  value="opentofu"
                  checked={formData.deploymentPreferences.method === 'opentofu'}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      deploymentPreferences: {
                        ...prev.deploymentPreferences,
                        method: e.target.value,
                      },
                    }))
                  }
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <Label htmlFor="opentofu" className="font-medium text-primary-600">
                  OpenTofu
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="aws_cli"
                  name="deploymentMethod"
                  value="aws_cli"
                  checked={formData.deploymentPreferences.method === 'aws_cli'}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      deploymentPreferences: {
                        ...prev.deploymentPreferences,
                        method: e.target.value,
                      },
                    }))
                  }
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <Label htmlFor="aws_cli" className="font-medium text-primary-600">
                  AWS CLI
                </Label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Source code</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="deploymentSourceMode"
                value="github"
                checked={sourceMode !== 'none'}
                onChange={() => updateSourceMode('github')}
              />
              GitHub repository
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="deploymentSourceMode"
                value="none"
                checked={sourceMode === 'none'}
                onChange={() => updateSourceMode('none')}
              />
              No source code
            </label>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Git Repository
        </h3>
        <div className="space-y-4">
          {sourceMode === 'none' ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              This workload does not require a source repository.
            </div>
          ) : githubConnections.length === 0 ? (
            <div className="text-sm text-gray-500">
              No GitHub connections configured yet.
            </div>
          ) : (
            <>
              <div>
                <Label className="mb-2 block">GitHub Connection</Label>
                <Select
                  value={selectedConnectionId || ''}
                  onValueChange={(value) => {
                    if (!value) {
                      updateGitRepo(null);
                      return;
                    }
                    updateGitRepo({
                      connectionId: value,
                      owner: '',
                      repo: '',
                      fullName: '',
                      branch: '',
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a connection" />
                  </SelectTrigger>
                  <SelectContent>
                    {githubConnections.map((connection) => (
                      <SelectItem key={connection.id} value={connection.id}>
                        {connection.displayName || 'GitHub'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-2 block">Repository</Label>
                <Select
                  value={selectedRepoKey || ''}
                  onValueChange={(value) => {
                    const repo = repoOptions.find((item) => item.fullName === value);
                    if (!repo) {
                      updateGitRepo({
                        owner: '',
                        repo: '',
                        fullName: '',
                        branch: '',
                      });
                      return;
                    }
                    const defaultBranch =
                      gitRepo?.branch ||
                      repo.defaultBranch ||
                      (Array.isArray(repo.allowedBranches) && repo.allowedBranches[0]) ||
                      '';
                    updateGitRepo({
                      owner: repo.owner || '',
                      repo: repo.name || '',
                      fullName: repo.fullName || '',
                      branch: defaultBranch,
                    });
                  }}
                  disabled={!selectedConnectionId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selectedConnectionId
                          ? 'Select a repository'
                          : 'Select a connection first'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {repoOptions.map((repo) => (
                      <SelectItem key={repo.fullName} value={repo.fullName}>
                        {repo.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-2 block">Base Branch</Label>
                <Select
                  value={gitRepo?.branch || ''}
                  onValueChange={(value) => updateGitRepo({ branch: value })}
                  disabled={!selectedRepo}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selectedRepo ? 'Select a branch' : 'Select a repository first'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {branchOptions.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {branchesLoading && (
                  <div className="text-xs text-gray-500 mt-2">Loading branches…</div>
                )}
                {branchesError && (
                  <div className="text-xs text-red-500 mt-2">{branchesError}</div>
                )}
                {!branchesLoading && selectedRepo && branchOptions.length === 0 && (
                  <div className="text-xs text-gray-500 mt-2">
                    No branches available for this repository.
                  </div>
                )}
              </div>

              {isTerraform && (
                <div>
                  <Label className="mb-2 block">State source</Label>
                  <Select
                    value={formData.deploymentPreferences.stateSource || 'not_set'}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        deploymentPreferences: {
                          ...prev.deploymentPreferences,
                          stateSource: value === 'not_set' ? null : value,
                          stateBucket:
                            value === 's3'
                              ? prev.deploymentPreferences.stateBucket || ''
                              : '',
                        },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Not set" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_set">Not set</SelectItem>
                      <SelectItem value="s3">S3 bucket</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.deploymentPreferences.stateSource === 's3' && (
                    <Input
                      value={formData.deploymentPreferences.stateBucket || ''}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          deploymentPreferences: {
                            ...prev.deploymentPreferences,
                            stateBucket: event.target.value,
                          },
                        }))
                      }
                      placeholder="State bucket name"
                      className="mt-2"
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Deployment Flow
        </h3>
        <div className="space-y-2">
          <Label className="mb-2 block">Automation</Label>
          <Select
            value={formData.deploymentPreferences.deliveryMethod || ''}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                deploymentPreferences: {
                  ...prev.deploymentPreferences,
                  deliveryMethod: value || null,
                },
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select deployment flow" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="github_actions" disabled={!gitRepo?.fullName}>
                {gitRepo?.fullName
                  ? 'Automatic: GitHub Actions'
                  : 'Automatic: GitHub Actions (requires repo)'}
              </SelectItem>
              <SelectItem value="codepipeline">
                Automatic: CodePipeline/CodeBuild
              </SelectItem>
            </SelectContent>
          </Select>
          <div className="text-xs text-gray-500">
            This controls how CloudAgent should coordinate updates to your workload.
          </div>
        </div>
        {formData.deploymentPreferences.deliveryMethod &&
          formData.deploymentPreferences.deliveryMethod !== 'manual' && (
            <div className="mt-4 space-y-4 rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="pipeline-auto-deploy" className="text-sm font-medium text-slate-700">
                    Automatic deployment
                  </Label>
                  <div className="text-xs text-slate-500">
                    Deploy when changes land on the configured branch.
                  </div>
                </div>
                <Switch
                  id="pipeline-auto-deploy"
                  checked={pipelineAutoDeploy}
                  onCheckedChange={(checked) =>
                    updatePipelineConfig({ autoDeploy: checked })
                  }
                  className="data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="pipeline-approval" className="text-sm font-medium text-slate-700">
                    Require approval step
                  </Label>
                  <div className="text-xs text-slate-500">
                    Pause before deployment for manual review.
                  </div>
                </div>
                <Switch
                  id="pipeline-approval"
                  checked={pipelineRequireApproval}
                  onCheckedChange={(checked) =>
                    updatePipelineConfig({ requireApproval: checked })
                  }
                  className="data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600"
                />
              </div>

              <div>
                <Label className="mb-2 block">{pipelineBranchLabel}</Label>
                <Select
                  value={pipelineBranch || gitRepo?.branch || ''}
                  onValueChange={(value) => updatePipelineConfig({ branch: value })}
                  disabled={!selectedRepo}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selectedRepo
                          ? 'Select a branch'
                          : 'Select a repository first'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {branchOptions.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {branchesLoading && (
                  <div className="text-xs text-gray-500 mt-2">
                    Loading branches…
                  </div>
                )}
                {branchesError && (
                  <div className="text-xs text-red-500 mt-2">{branchesError}</div>
                )}
                {!branchesLoading && selectedRepo && branchOptions.length === 0 && (
                  <div className="text-xs text-gray-500 mt-2">
                    No branches available for this repository.
                  </div>
                )}
              </div>
            </div>
          )}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Networking</h3>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="useExistingVPCs"
              checked={formData.deploymentPreferences.useExistingVPCs || false}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  deploymentPreferences: {
                    ...prev.deploymentPreferences,
                    useExistingVPCs: checked,
                  },
                }))
              }
              className="data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600"
            />
            <Label htmlFor="useExistingVPCs">
              Use existing VPCs for new resources
            </Label>
          </div>

          {formData.deploymentPreferences.useExistingVPCs && (
            <div className="space-y-3">
              <div>
                <Label className="mb-2 block">Specify VPCs</Label>
                <div className="space-y-2">
                  {Array.isArray(formData.deploymentPreferences.specifiedVPCs) &&
                  formData.deploymentPreferences.specifiedVPCs.length > 0 ? (
                    formData.deploymentPreferences.specifiedVPCs.map(
                      (vpc, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <span className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded border flex-1">
                            {vpc}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newVPCs =
                                formData.deploymentPreferences.specifiedVPCs.filter(
                                  (_, i) => i !== index
                                );
                              setFormData((prev) => ({
                                ...prev,
                                deploymentPreferences: {
                                  ...prev.deploymentPreferences,
                                  specifiedVPCs: newVPCs,
                                },
                              }));
                            }}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            Remove
                          </Button>
                        </div>
                      )
                    )
                  ) : (
                    <div className="text-sm text-gray-500">No VPCs specified</div>
                  )}

                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter VPC ID (e.g., vpc-12345678)"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          const vpcId = e.target.value.trim();
                          if (vpcId) {
                            const currentVPCs =
                              formData.deploymentPreferences.specifiedVPCs || [];
                            if (!currentVPCs.includes(vpcId)) {
                              setFormData((prev) => ({
                                ...prev,
                                deploymentPreferences: {
                                  ...prev.deploymentPreferences,
                                  specifiedVPCs: [...currentVPCs, vpcId],
                                },
                              }));
                            }
                            e.target.value = '';
                          }
                        }
                      }}
                      className="flex-1 h-12 text-base"
                    />
                    <Button variant="outline" size="sm" onClick={() => {}}>
                      Fetch VPCs
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Types</h3>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="allowAllResources"
              checked={
                formData.deploymentPreferences.resourceRules.allowedResources
                  .allowAll
              }
              onCheckedChange={(checked) =>
                handleResourceRuleChange('allowedResources', {
                  ...formData.deploymentPreferences.resourceRules
                    .allowedResources,
                  allowAll: checked,
                })
              }
              disabled
              className="data-[state=checked]:bg-gray-400 data-[state=checked]:border-gray-400 opacity-50 cursor-not-allowed"
            />
            <Label
              htmlFor="allowAllResources"
              className="text-gray-400 cursor-not-allowed"
            >
              Allow all resources
            </Label>
          </div>

          <div>
            <Label htmlFor="allowedResources">Allowed Resources</Label>
            <Input
              id="allowedResources"
              value={formData.deploymentPreferences.resourceRules.allowedResources.allowedList.join(
                ', '
              )}
              onChange={(e) =>
                handleResourceRuleChange('allowedResources', {
                  ...formData.deploymentPreferences.resourceRules.allowedResources,
                  allowedList: e.target.value
                    .split(',')
                    .map((item) => item.trim())
                    .filter((item) => item),
                })
              }
              placeholder="Enter allowed resources (comma-separated)"
              disabled={
                formData.deploymentPreferences.resourceRules.allowedResources
                  .allowAll
              }
            />
          </div>

          <div>
            <Label htmlFor="deniedResources" className="text-gray-400">
              Denied Resources
            </Label>
            <Input
              id="deniedResources"
              value={formData.deploymentPreferences.resourceRules.allowedResources.deniedList.join(
                ', '
              )}
              onChange={(e) =>
                handleResourceRuleChange('allowedResources', {
                  ...formData.deploymentPreferences.resourceRules.allowedResources,
                  deniedList: e.target.value
                    .split(',')
                    .map((item) => item.trim())
                    .filter((item) => item),
                })
              }
              placeholder="Enter denied resources (comma-separated)"
              disabled
              className="bg-gray-100 text-gray-400 cursor-not-allowed"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeploymentSettings;
