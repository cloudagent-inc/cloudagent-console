import React from 'react';
import { Badge } from '@/components/ui/badge';

function ReviewStep({
  formData,
  environmentLabels,
  gitRepo,
  pipelineSummary,
  importSummary,
}) {
  const deploymentPreferences = formData?.deploymentPreferences || {};

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
        <div className="text-sm font-semibold text-slate-800">Workload</div>
        <div>
          <div className="text-sm font-medium text-slate-700">
            {formData.workloadName || 'Untitled'}
          </div>
          <div className="text-xs text-slate-500">
            {formData.description || 'No description'}
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Mode: {deploymentPreferences.accessMode === 'readonly' ? 'Read-only' : 'Managed'}
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-600">Environments</div>
          <div className="flex flex-wrap gap-2">
            {environmentLabels.length > 0 ? (
              environmentLabels.map((env) => (
                <Badge key={env.accountId} variant="secondary">
                  {env.label}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-slate-400">No environments selected</span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
        <div className="text-sm font-semibold text-slate-800">Source & IaC</div>
        {deploymentPreferences.accessMode === 'readonly' ? (
          <div className="text-xs text-slate-500">
            Not required for read-only workloads.
          </div>
        ) : (
          <>
            <div className="text-xs text-slate-500">
              Source: {deploymentPreferences.sourceMode === 'none' ? 'None' : 'GitHub'}
            </div>
            {deploymentPreferences.sourceMode !== 'none' && (
              <div className="text-xs text-slate-500">
                GitHub repo: {gitRepo?.fullName || 'Not connected'}
              </div>
            )}
            {deploymentPreferences.sourceMode !== 'none' && (
              <div className="text-xs text-slate-500">
                Branch: {gitRepo?.branch || 'Not set'}
              </div>
            )}
            <div className="text-xs text-slate-500">
              IaC method: {deploymentPreferences.method || 'Not set'}
            </div>
          </>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
        <div className="text-sm font-semibold text-slate-800">Pipeline</div>
        <div className="text-xs text-slate-500">{pipelineSummary}</div>
      </div>

      {importSummary && (
        <div className="rounded-md border border-slate-200 bg-white p-4 space-y-2">
          <div className="text-sm font-semibold text-slate-800">Imported resources</div>
          <div className="text-xs text-slate-500">{importSummary}</div>
        </div>
      )}
    </div>
  );
}

export default ReviewStep;
