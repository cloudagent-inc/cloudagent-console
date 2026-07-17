import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const IAC_METHODS = [
  { value: 'cloudformation', label: 'CloudFormation' },
  { value: 'terraform', label: 'Terraform' },
  { value: 'opentofu', label: 'OpenTofu' },
  { value: 'aws_cli', label: 'AWS CLI' },
];

function SourceIacStep({
  formData,
  updateGitRepo,
  updateDeploymentPreferences,
  githubConnections,
  repoOptions,
  selectedConnectionId,
  selectedRepoKey,
  selectedRepo,
  branchOptions,
  branchesLoading,
  branchesError,
}) {
  const gitRepo = formData?.deploymentPreferences?.gitRepo || null;
  const iacMethod = formData?.deploymentPreferences?.method || '';
  const isTerraform = ['terraform', 'opentofu'].includes(iacMethod);
  const isAwsCli = iacMethod === 'aws_cli';
  const stateSource = formData?.deploymentPreferences?.stateSource || '';
  const stateBucket = formData?.deploymentPreferences?.stateBucket || '';
  const stateSourceValue = stateSource || 'not_set';
  const repoConfigured = !!selectedRepo;
  const sourceMode =
    formData?.deploymentPreferences?.sourceMode ||
    (gitRepo ? 'github' : 'none');

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        {!iacMethod && (
          <div className="space-y-2">
            <div className="font-semibold text-slate-800">Not sure where to start?</div>
            <div>
              We recommend CloudFormation + GitHub for most teams. You can enable
              CloudFormation Git Sync as a lightweight pipeline.
            </div>
            <button
              type="button"
              onClick={() => updateDeploymentPreferences({ method: 'cloudformation' })}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              Use CloudFormation
            </button>
          </div>
        )}
        {iacMethod === 'cloudformation' && repoConfigured && (
          <div className="text-xs text-slate-500">
            Tip: CloudFormation Git Sync is a great lightweight pipeline when you
            already have a Git repo connected.
          </div>
        )}
        {isTerraform && (
          <div className="text-xs text-slate-500">
            Tip: Terraform/OpenTofu workflows pair well with GitHub Actions for
            automated plans and applies.
          </div>
        )}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Source</Label>
            {isAwsCli ? (
              <div className="text-xs text-slate-500">
                AWS CLI deployments do not require a source repository.
              </div>
            ) : (
              <div className="space-y-2 text-sm text-slate-600">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="source-mode"
                    className="h-4 w-4 border-slate-300"
                    checked={sourceMode === 'github'}
                    onChange={() =>
                      updateDeploymentPreferences({ sourceMode: 'github' })
                    }
                  />
                  GitHub repository
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="source-mode"
                    className="h-4 w-4 border-slate-300"
                    checked={sourceMode === 'none'}
                    onChange={() => {
                      updateDeploymentPreferences({ sourceMode: 'none' });
                      updateGitRepo(null);
                    }}
                  />
                  No source
                </label>
              </div>
            )}
            {isTerraform && sourceMode === 'none' && (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Terraform/OpenTofu workflows usually require a Git repository. Add a source
                when you are ready to automate deployments.
              </div>
            )}
          </div>
          {isAwsCli || sourceMode === 'none' ? (
            <div className="text-sm text-slate-500">
              Source selection is disabled.
            </div>
          ) : (
            <>
              <div>
                <Label className="mb-2 block">GitHub connection</Label>
                {githubConnections.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    No GitHub connections found.
                  </div>
                ) : (
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
                      <SelectValue placeholder="Select connection" />
                    </SelectTrigger>
                    <SelectContent>
                      {githubConnections.map((connection) => (
                        <SelectItem key={connection.id} value={connection.id}>
                          {connection.displayName || 'GitHub'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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
                          ? 'Select repository'
                          : 'Select connection first'
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
                <Label className="mb-2 block">Base branch</Label>
                <Select
                  value={gitRepo?.branch || ''}
                  onValueChange={(value) => updateGitRepo({ branch: value })}
                  disabled={!selectedRepo}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selectedRepo ? 'Select branch' : 'Select repository first'
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
                  <div className="text-xs text-slate-500 mt-2">
                    Loading branches...
                  </div>
                )}
                {branchesError && (
                  <div className="text-xs text-red-500 mt-2">{branchesError}</div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Infrastructure as Code</Label>
            <div className="space-y-2">
              {IAC_METHODS.map((method) => (
                <label key={method.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="iac-method"
                    className="h-4 w-4 border-slate-300"
                    value={method.value}
                    checked={iacMethod === method.value}
                    onChange={(event) =>
                      updateDeploymentPreferences({ method: event.target.value })
                    }
                  />
                  {method.label}
                </label>
              ))}
            </div>
          </div>

          {isTerraform && (
            <div className="space-y-2">
              <Label>State source</Label>
              <Select
                value={stateSourceValue}
                onValueChange={(value) =>
                  updateDeploymentPreferences({
                    stateSource: value === 'not_set' ? null : value,
                    stateBucket: value === 's3' ? stateBucket : '',
                  })
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
              {stateSource === 's3' && (
                <Input
                  value={stateBucket}
                  onChange={(event) =>
                    updateDeploymentPreferences({ stateBucket: event.target.value })
                  }
                  placeholder="State bucket name"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SourceIacStep;
