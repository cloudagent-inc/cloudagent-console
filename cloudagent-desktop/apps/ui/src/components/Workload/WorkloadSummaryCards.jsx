import React from 'react';
import { Badge } from '@/components/ui/badge';

/**
 * WorkloadSummaryCards component displays summary statistics for a workload
 * @param {Object} props
 * @param {number} props.totalResourceCount - Total number of tracked resources
 * @param {number} props.trackedStacksCount - Total number of tracked CloudFormation stacks
 * @param {Array<{type: string, count: number}>} props.resourceSummary - Array of resource type summaries
 * @param {Array<{accountId: string, label: string, count: number}>} props.environmentSummary - Array of environment summaries
 * @param {number} props.reportsCount - Number of reports that affect the workload's environments
 * @param {number} props.workloadRecommendationsCount - Number of workload-specific recommendations
 * @param {number} props.environmentRecommendationsCount - Number of environment recommendations (all environments)
 * @param {Function} props.onNavigateToTab - Callback to navigate to a specific tab (e.g., 'resources')
 * @param {React.RefObject} props.reportsSectionRef - Ref to the reports table section for scrolling
 * @param {React.RefObject} props.recommendationsSectionRef - Ref to the recommendations table section for scrolling
 */
function WorkloadSummaryCards({
  totalResourceCount = 0,
  trackedStacksCount = 0,
  resourceSummary = [],
  environmentSummary = [],
  reportsCount = 0,
  workloadRecommendationsCount = 0,
  environmentRecommendationsCount = 0,
  onNavigateToTab = () => {},
  reportsSectionRef = null,
  recommendationsSectionRef = null,
}) {

  const handleResourcesClick = () => {
    if (totalResourceCount > 0) {
      onNavigateToTab('resources');
    }
  };

  const handleStacksClick = () => {
    if (trackedStacksCount > 0) {
      onNavigateToTab('resources');
    }
  };

  const handleReportsClick = () => {
    if (reportsCount > 0 && reportsSectionRef?.current) {
      reportsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleRecommendationsClick = () => {
    if (recommendationsCount > 0 && recommendationsSectionRef?.current) {
      recommendationsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      {/* Tracked Resources, Stacks & Environments Combined Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">Resources</div>
            <button
              type="button"
              onClick={handleResourcesClick}
              disabled={totalResourceCount === 0}
              className={`text-xl font-semibold transition-colors ${
                totalResourceCount > 0
                  ? 'text-gray-900 hover:text-primary-600 cursor-pointer underline decoration-2 underline-offset-2 decoration-transparent hover:decoration-primary-600'
                  : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              {totalResourceCount}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">Stacks</div>
            <button
              type="button"
              onClick={handleStacksClick}
              disabled={trackedStacksCount === 0}
              className={`text-xl font-semibold transition-colors ${
                trackedStacksCount > 0
                  ? 'text-gray-900 hover:text-primary-600 cursor-pointer underline decoration-2 underline-offset-2 decoration-transparent hover:decoration-primary-600'
                  : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              {trackedStacksCount}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">Environments</div>
            <div className="text-xl font-semibold text-gray-900">
              {environmentSummary.length}
            </div>
          </div>
          {environmentSummary.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <div className="space-y-1.5">
                {environmentSummary.slice(0, 3).map((item) => (
                  <div
                    key={item.accountId}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-gray-600 truncate">{item.label}</span>
                    <span className="font-medium text-gray-900 ml-2">
                      {item.count}
                    </span>
                  </div>
                ))}
                {environmentSummary.length > 3 && (
                  <div className="text-xs text-gray-400">
                    +{environmentSummary.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Health Section - Coming Soon */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm text-gray-400 flex items-center gap-2">
                <span>Health</span>
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  Coming Soon
                </Badge>
              </div>
              <div className="text-xl font-semibold text-gray-400">
                —
              </div>
            </div>
          </div>

          {/* Resources Needing Attention Section - Coming Soon */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400 flex items-center gap-2">
                <span>Needs Attention</span>
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  Coming Soon
                </Badge>
              </div>
              <div className="text-xl font-semibold text-gray-400">
                —
              </div>
            </div>
          </div>

          {/* Reports Section */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">Reports</div>
              <button
                type="button"
                onClick={handleReportsClick}
                disabled={reportsCount === 0}
                className={`text-xl font-semibold transition-colors ${
                  reportsCount > 0
                    ? 'text-gray-900 hover:text-primary-600 cursor-pointer underline decoration-2 underline-offset-2 decoration-transparent hover:decoration-primary-600'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                {reportsCount}
              </button>
            </div>
          </div>

          {/* Recommendations Section */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">Recommendations</div>
              <button
                type="button"
                onClick={handleRecommendationsClick}
                disabled={workloadRecommendationsCount === 0 && environmentRecommendationsCount === 0}
                className={`text-xl font-semibold transition-colors ${
                  (workloadRecommendationsCount > 0 || environmentRecommendationsCount > 0)
                    ? 'text-gray-900 hover:text-primary-600 cursor-pointer underline decoration-2 underline-offset-2 decoration-transparent hover:decoration-primary-600'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                {workloadRecommendationsCount}
              </button>
            </div>
            {environmentRecommendationsCount > 0 && (
              <div className="flex items-center justify-between mt-1">
                <div className="text-xs text-gray-500">Environment</div>
                <div className="text-sm font-medium text-gray-700">
                  {environmentRecommendationsCount}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default WorkloadSummaryCards;
