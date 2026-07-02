import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { formatRecommendationResourceLabel } from '@/helpers/recommendations/remediationTargets';

function RecommendationBlueprintRunTargets({
  targets = [],
  canRun = false,
  isBlueprintReady = false,
  isLibraryBlueprint = false,
  blueprintExists = true,
  blueprintStatus = '',
  loadingTargetKey = null,
  onRun,
}) {
  if (!Array.isArray(targets) || targets.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-2">
        No matching cloud environments found for this recommendation.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {targets.map((target) => {
        const targetKey = target?.key || `${target?.type || 'target'}-${target?.accountId || 'unknown'}`;
        const isLoading = loadingTargetKey === targetKey;
        const resourcePreview = Array.isArray(target?.resources) ? target.resources.slice(0, 3) : [];
        const extraCount = Math.max((target?.resources?.length || 0) - resourcePreview.length, 0);
        const disabled =
          !canRun ||
          !target?.profile ||
          !(target?.profile?.recordId || target?.profile?.id) ||
          (!isLibraryBlueprint && !blueprintExists) ||
          (!isLibraryBlueprint && !isBlueprintReady) ||
          isLoading;

        const buttonLabel = (() => {
          if (!isLibraryBlueprint && !blueprintExists) return 'Skill Not Found';
          if (!isLibraryBlueprint && !isBlueprintReady) {
            return `Generating... (${blueprintStatus || 'Processing'})`;
          }
          return 'Run Skill';
        })();

        return (
          <div
            key={targetKey}
            className="rounded-md border border-gray-200 bg-white p-3 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {target?.label || 'Target'}
                  </p>
                  <Badge variant={target?.type === 'workload' ? 'default' : 'secondary'}>
                    {target?.type === 'workload' ? 'Workload' : 'Environment'}
                  </Badge>
                </div>
                {target?.subtitle && (
                  <p className="text-xs text-gray-500 mt-1">{target.subtitle}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {target?.resources?.length || 0} targeted resource
                  {(target?.resources?.length || 0) === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Button
                  onClick={() => onRun?.(target)}
                  size="sm"
                  disabled={disabled}
                  variant={disabled ? 'outline' : 'default'}
                  className="flex-shrink-0"
                  title={
                    !isLibraryBlueprint && !blueprintExists
                      ? 'Skill not found. Please regenerate the skill.'
                      : !isLibraryBlueprint && !isBlueprintReady
                        ? `Skill is not ready. Status: ${blueprintStatus || 'unknown'}`
                        : undefined
                  }
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    buttonLabel
                  )}
                </Button>
                {isLoading && (
                  <p className="text-xs text-gray-500 text-right">
                    Compiling recommendation specific resource information...
                  </p>
                )}
              </div>
            </div>

            {resourcePreview.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  Target Resources
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {resourcePreview.map((resource, index) => (
                    <span
                      key={`${targetKey}-resource-${index}`}
                      className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
                      title={formatRecommendationResourceLabel(resource)}
                    >
                      {formatRecommendationResourceLabel(resource)}
                    </span>
                  ))}
                  {extraCount > 0 && (
                    <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-500">
                      +{extraCount} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default RecommendationBlueprintRunTargets;
