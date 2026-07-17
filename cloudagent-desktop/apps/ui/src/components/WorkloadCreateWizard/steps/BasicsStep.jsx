import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';

function BasicsStep({
  formData,
  setFormData,
  environmentOptions,
  includeImport,
  setIncludeImport,
  workloadExists,
  setWorkloadExists,
}) {
  const accessMode = formData?.deploymentPreferences?.accessMode || 'managed';
  const selectedEnvironments = Array.isArray(formData.environments)
    ? formData.environments
    : [];

  const toggleEnvironment = (permissionProfileId) => {
    setFormData((prev) => {
      const current = Array.isArray(prev.environments) ? prev.environments : [];
      const exists = current.includes(permissionProfileId);
      const next = exists
        ? current.filter((id) => id !== permissionProfileId)
        : [...current, permissionProfileId];
      return { ...prev, environments: next };
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-2 block">How should CloudAgent manage this workload?</Label>
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() =>
              setFormData((prev) => ({
                ...prev,
                deploymentPreferences: {
                  ...prev.deploymentPreferences,
                  accessMode: 'managed',
                },
              }))
            }
            className={`rounded-lg border px-4 py-3 text-left transition ${
              accessMode === 'managed'
                ? 'border-primary-400 bg-primary-50'
                : 'border-slate-200 bg-white hover:border-primary-200'
            }`}
          >
            <div className="text-sm font-semibold text-slate-800">
              Managed (recommended)
            </div>
            <div className="text-xs text-slate-500">
              Allow CloudAgent to configure pipelines and make changes.
            </div>
          </button>
          <button
            type="button"
            onClick={() =>
              setFormData((prev) => ({
                ...prev,
                deploymentPreferences: {
                  ...prev.deploymentPreferences,
                  accessMode: 'readonly',
                },
              }))
            }
            className={`rounded-lg border px-4 py-3 text-left transition ${
              accessMode === 'readonly'
                ? 'border-primary-400 bg-primary-50'
                : 'border-slate-200 bg-white hover:border-primary-200'
            }`}
          >
            <div className="text-sm font-semibold text-slate-800">Read-only</div>
            <div className="text-xs text-slate-500">
              Reports, reviews, and insights without deployment changes.
            </div>
          </button>
        </div>
      </div>

      <div>
        <Label htmlFor="workload-name" className="mb-2 block">
          Workload name
        </Label>
        <Input
          id="workload-name"
          value={formData.workloadName}
          onChange={(event) =>
            setFormData((prev) => ({ ...prev, workloadName: event.target.value }))
          }
          placeholder="e.g. customer-api"
        />
      </div>

      <div>
        <Label htmlFor="workload-description" className="mb-2 block">
          Description
        </Label>
        <Input
          id="workload-description"
          value={formData.description}
          onChange={(event) =>
            setFormData((prev) => ({ ...prev, description: event.target.value }))
          }
          placeholder="Short description of the workload"
        />
      </div>

      <div>
        <Label className="mb-2 block">Destination environments</Label>
        {environmentOptions.length === 0 ? (
          <div className="text-sm text-slate-500">
            No cloud environments connected yet. Add an environment to continue.
          </div>
        ) : (
          <ScrollArea className="h-40 rounded-md border border-slate-200 bg-white">
            <div className="divide-y divide-slate-100">
              {environmentOptions.map((env) => {
                const checked = selectedEnvironments.includes(env.id);
                return (
                  <label
                    key={env.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={checked}
                      onChange={() => toggleEnvironment(env.id)}
                    />
                    <span className="flex-1">
                      {env.name}
                      {(env.accountId || env.domain) && (
                        <span className="ml-2 text-xs text-slate-400">
                          {env.accountId || env.domain}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <div className="text-sm font-medium text-slate-800">
            Does this workload already exist?
          </div>
          <div className="text-xs text-slate-500">
            If it exists, we can scan the cloud environment and attach discovered resources.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setWorkloadExists(true);
              setIncludeImport(true);
            }}
            className={`rounded-md border px-3 py-1 text-xs ${
              workloadExists
                ? 'border-primary-400 bg-primary-50 text-primary-700'
                : 'border-slate-200 text-slate-600'
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => {
              setWorkloadExists(false);
              setIncludeImport(false);
            }}
            className={`rounded-md border px-3 py-1 text-xs ${
              !workloadExists
                ? 'border-primary-400 bg-primary-50 text-primary-700'
                : 'border-slate-200 text-slate-600'
            }`}
          >
            No
          </button>
        </div>
      </div>

      {workloadExists && (
        <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3">
          <div>
            <div className="text-sm font-medium text-slate-800">
              Import resources from cloud
            </div>
            <div className="text-xs text-slate-500">
              Optional. You can skip this and continue the setup.
            </div>
          </div>
          <Switch
            checked={includeImport}
            onCheckedChange={(checked) => setIncludeImport(checked)}
            className="data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600"
          />
        </div>
      )}
    </div>
  );
}

export default BasicsStep;
