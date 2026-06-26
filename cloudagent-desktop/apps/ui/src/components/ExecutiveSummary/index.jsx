import React, { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { FileText, RefreshCw, Loader2, Cloud, Layers, Maximize2, BookOpen, ExternalLink, ChevronDown, AlertCircle, Play } from 'lucide-react';
import Markdown from 'markdown-to-jsx';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { buildReportRoute, findAccountScan } from '@/helpers/accountScans';
import {
  ensureExecutiveSummary,
  selectExecutiveSummaryForItem,
  selectIsExecutiveSummaryLoading,
} from '@/features/operations/operationsSlice';
import { isSupportedExecutiveSummaryEnvironmentType } from '../../helpers/shared';
import { IS_PUBLIC_SITE } from '../../config/appConfig';

/**
 * Parse summary field from AWSJSON format
 */
export const parseSummary = (summary) => {
  if (!summary) return null;
  if (typeof summary === 'string') {
    try {
      return JSON.parse(summary);
    } catch {
      return null;
    }
  }
  return summary;
};

/**
 * Format report type key into a readable label
 */
const formatReportTypeLabel = (reportType) => {
  if (!reportType) return 'Unknown Report';
  
  // Map of known report types to friendly names
  const reportTypeLabels = {
    'compliance_aws_cis_v3_0_0': 'AWS CIS v3.0.0',
    'compliance_aws_nist_800_53_v5': 'AWS NIST 800-53 v5',
    'report_aws_backup': 'AWS Backup Report',
    'report_aws_unused_resources': 'AWS Unused Resources',
    'compliance_aws_cis_v2_0_0': 'AWS CIS v2.0.0',
    'compliance_aws_cis_v1_4_0': 'AWS CIS v1.4.0',
    'report_aws_cost': 'AWS Cost Report',
  };
  
  if (reportTypeLabels[reportType]) {
    return reportTypeLabels[reportType];
  }
  
  // Fallback: convert snake_case to Title Case
  return reportType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/Aws/g, 'AWS')
    .replace(/Cis/g, 'CIS')
    .replace(/Nist/g, 'NIST');
};

/**
 * Markdown styling for report summaries (smaller/lighter)
 */
const reportSummaryMarkdownOptions = {
  overrides: {
    h1: { props: { className: 'text-sm font-semibold mb-2 mt-3 first:mt-0 text-gray-700' } },
    h2: { props: { className: 'text-sm font-semibold mb-1.5 mt-2 text-gray-700' } },
    h3: { props: { className: 'text-xs font-semibold mb-1 mt-1.5 text-gray-700' } },
    p: { props: { className: 'mb-1.5 text-gray-600 text-xs leading-relaxed' } },
    ul: { props: { className: 'list-disc pl-4 mb-2 space-y-0.5' } },
    ol: { props: { className: 'list-decimal pl-4 mb-2 space-y-0.5' } },
    li: { props: { className: 'text-gray-600 text-xs' } },
    code: { props: { className: 'bg-gray-100 px-1 py-0.5 rounded text-xs font-mono' } },
    pre: { props: { className: 'bg-gray-100 p-2 rounded overflow-x-auto mb-2 text-xs' } },
    blockquote: { props: { className: 'border-l-2 border-gray-300 pl-2 italic mb-2 text-gray-500 text-xs' } },
    strong: { props: { className: 'font-semibold' } },
  }
};

/**
 * Sources List Component - displays the reports used to generate the summary
 * @param {object} sources - Map of reportType to scanId
 * @param {object} reportSummaries - Optional map of scanId to report summary text (from summary.reportSummaries)
 * @param {array} accountScans - Account scans to look up report details
 * @param {boolean} compact - Whether to render in compact mode
 */
function SourcesList({ sources, reportSummaries, accountScans, compact = false }) {
  const navigate = useNavigate();
  
  // Build the list of source reports with details from accountScans
  const sourceReports = useMemo(() => {
    if (!sources || typeof sources !== 'object') return [];
    
    return Object.entries(sources).map(([reportType, scanId]) => {
      // Find the matching scan in accountScans
      const scan = findAccountScan(accountScans, {
        scanId,
        reportId: reportType,
      });
      
      // Get report summary text:
      // 1. First check if reportSummaries has a direct summary for this scanId
      // 2. Fall back to parsing from accountScans
      let summaryText = null;
      
      if (reportSummaries && reportSummaries[scanId]) {
        // Use the summary directly from reportSummaries (already a string)
        summaryText = reportSummaries[scanId];
      } else if (scan?.summary) {
        // Fall back to parsing from accountScans
        let reportSummary = null;
        if (typeof scan.summary === 'string') {
          try {
            reportSummary = JSON.parse(scan.summary);
          } catch {
            reportSummary = null;
          }
        } else {
          reportSummary = scan.summary;
        }
        summaryText = reportSummary?.summaryText || null;
      }
      
      return {
        reportType,
        scanId,
        title: scan?.title || formatReportTypeLabel(reportType),
        date: scan?.lastUpdateTime 
          ? new Date(scan.lastUpdateTime).toLocaleDateString()
          : scan?.latestAssessmentDate
            ? new Date(scan.latestAssessmentDate).toLocaleDateString()
            : null,
        reportId: scan?.reportId,
        summaryText,
      };
    });
  }, [sources, reportSummaries, accountScans]);
  
  if (sourceReports.length === 0) return null;
  
  const handleReportClick = (report) => {
    const reportRoute = buildReportRoute(report);
    if (!reportRoute) return;
    navigate(reportRoute, {
      state: {
        reportId: report.reportId,
      },
    });
  };
  
  if (compact) {
    return (
      <div className="mb-3 pb-2 border-b border-gray-200">
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
          <BookOpen className="w-3 h-3" />
          <span className="font-medium">Sources:</span>
          <span className="text-gray-400">
            {sourceReports.length} report{sourceReports.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="mb-4">
      <Accordion type="single" collapsible className="border border-gray-200 rounded-lg overflow-hidden">
        <AccordionItem value="sources" className="border-0">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 bg-gray-50/50">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <BookOpen className="w-4 h-4 text-primary-600" />
              <span className="font-medium">
                Generated from {sourceReports.length} report{sourceReports.length !== 1 ? 's' : ''}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-3 pt-1">
            <div className="space-y-2">
              {sourceReports.map((report) => (
                <div
                  key={report.scanId}
                  className="border border-gray-200 rounded-lg bg-white overflow-hidden"
                >
                  {/* Report Header - Clickable to navigate */}
                  <button
                    onClick={() => handleReportClick(report)}
                    className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <FileText className="w-4 h-4 text-primary-600 shrink-0" />
                    <div className="flex flex-col items-start min-w-0 flex-1">
                      <span className="text-sm font-medium text-gray-900 truncate w-full">
                        {report.title}
                      </span>
                      {report.date && (
                        <span className="text-xs text-gray-500">
                          {report.date}
                        </span>
                      )}
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>
                  
                  {/* Report Summary - Nested Accordion */}
                  {report.summaryText && (
                    <Accordion type="single" collapsible>
                      <AccordionItem value="summary" className="border-0 border-t border-gray-100">
                        <AccordionTrigger className="px-3 py-2 text-xs text-gray-500 hover:no-underline hover:bg-gray-50">
                          <span className="font-medium">View Report Summary</span>
                        </AccordionTrigger>
                        <AccordionContent className="px-3 pb-3">
                          <div className="bg-gray-50 rounded-md p-3 border border-gray-100">
                            <div className="prose prose-sm max-w-none">
                              <Markdown options={reportSummaryMarkdownOptions}>
                                {report.summaryText}
                              </Markdown>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

/**
 * Helper to parse JSON fields safely
 */
const safeParseJson = (value) => {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const compactIdentifier = (value) => String(value || '').trim();

/**
 * Get identifiers that can link reports/recommendations to an item.
 */
const getEnvironmentIdentifiers = (item, type) => {
  if (!item) return null;
  
  if (type === 'environment') {
    const authProfile = safeParseJson(item.authProfile);
    return [
      item.recordId,
      item.id,
      authProfile?.awsAccountId,
      authProfile?.accountId,
      authProfile?.subscriptionId,
      authProfile?.azureSubscriptionId,
      authProfile?.domain,
    ].map(compactIdentifier).filter(Boolean);
  } else if (type === 'workload') {
    const environments = item.environments || [];
    return environments
      .map(env => {
        if (typeof env === 'string') {
          const parts = env.split(':');
          return [env, parts[0]];
        }
        if (env && typeof env === 'object') {
          return [
            env.permissionProfileId,
            env.environmentProfileId,
            env.recordId,
            env.id,
            env.accountId,
            env.awsAccountId,
            env.subscriptionId,
          ];
        }
        return [];
      })
      .flat()
      .map(compactIdentifier)
      .filter(Boolean);
  }
  return null;
};

const getTargetResourceIdentifiers = (resource) => [
  resource?.permissionProfileId,
  resource?.environmentProfileId,
  resource?.recordId,
  resource?.id,
  resource?.accountId,
  resource?.awsAccountId,
  resource?.subscriptionId,
  resource?.azureSubscriptionId,
  resource?.resourceId,
  resource?.domain,
].map(compactIdentifier).filter(Boolean);

/**
 * Recommended Reports Component - displays report recommendations for the item
 */
function RecommendedReports({ recommendations = [], item, type, compact = false }) {
  const navigate = useNavigate();
  
  const itemIdentifiers = useMemo(() => {
    const identifiers = getEnvironmentIdentifiers(item, type);
    if (!identifiers) return [];
    return Array.isArray(identifiers) ? identifiers : [identifiers];
  }, [item, type]);
  
  // Filter recommendations to show only report recommendations that match this item
  const reportRecommendations = useMemo(() => {
    if (!recommendations || !Array.isArray(recommendations) || itemIdentifiers.length === 0) {
      return [];
    }
    
    return recommendations.filter((rec) => {
      // Check if it's a report recommendation
      const recommendedAction = safeParseJson(rec.recommendedAction) || rec.recommendedAction;
      if (!recommendedAction || recommendedAction.type !== 'report') {
        return false;
      }
      
      // Check if targetResources contains matching accountId
      let targetResources = safeParseJson(rec.targetResources) || rec.targetResources;
      if (!targetResources || !Array.isArray(targetResources)) {
        return false;
      }
      
      // Check if any target resource matches one of the item's environment identifiers.
      return targetResources.some((resource) => {
        const resourceIdentifiers = getTargetResourceIdentifiers(resource);
        return resourceIdentifiers.some((identifier) => itemIdentifiers.includes(identifier));
      });
    });
  }, [recommendations, itemIdentifiers]);
  
  if (reportRecommendations.length === 0) return null;
  
  const handleRunReport = (rec) => {
    // Navigate to the library report page
    const recommendedAction = safeParseJson(rec.recommendedAction) || rec.recommendedAction;
    const reportId = recommendedAction?.reportId || recommendedAction?.sourceBlueprintId;
    
    if (reportId) {
      // Parse targetResources to get additional context
      const targetResources = safeParseJson(rec.targetResources) || rec.targetResources || [];
      
      // Find the matching target resource for this item's environment.
      const matchingResource = targetResources.find((resource) =>
        getTargetResourceIdentifiers(resource).some((identifier) =>
          itemIdentifiers.includes(identifier)
        )
      );
      const matchingIdentifier =
        matchingResource?.accountId ||
        matchingResource?.subscriptionId ||
        matchingResource?.azureSubscriptionId ||
        itemIdentifiers[0] ||
        null;

      const recommendationState = {
        type: 'assessment',
        fromRecommendation: {
          source: 'executive_summary',
          recommendationRecordId:
            rec.recordId ||
            (typeof rec.recordKey === 'string' &&
            rec.recordKey.startsWith('RECOMMENDATION#')
              ? rec.recordKey.split('#', 2)[1] || null
              : null),
          recommendationId: rec.recommendationId || rec.id,
          recordKey: rec.recordKey || null,
          planId: reportId,
          reportId: reportId,
          accountId: matchingIdentifier,
          permissionProfileId: matchingResource?.permissionProfileId || null,
          targetResources,
        },
      };

      navigate('/dashboard');
    } else {
      navigate('/dashboard');
    }
  };
  
  if (compact) {
    return (
      <div className="mb-3 pb-2 border-b border-amber-200 bg-amber-50 -mx-3 -mt-3 px-3 pt-2 rounded-t-lg">
        <div className="flex items-center gap-1 text-xs text-amber-700">
          <AlertCircle className="w-3 h-3" />
          <span className="font-medium">
            {reportRecommendations.length} recommended report{reportRecommendations.length !== 1 ? 's' : ''} to run
          </span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="mb-4">
      <Accordion type="single" collapsible className="border border-amber-200 rounded-lg overflow-hidden bg-amber-50">
        <AccordionItem value="recommendations" className="border-0">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-amber-100/50">
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span className="font-medium">
                {reportRecommendations.length} Recommended Report{reportRecommendations.length !== 1 ? 's' : ''} to Run
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-3 pt-1">
            <div className="space-y-2">
              {reportRecommendations.map((rec) => {
                const recommendedAction = safeParseJson(rec.recommendedAction) || rec.recommendedAction;
                
                return (
                  <div
                    key={rec.recommendationId || rec.id}
                    className="border border-amber-200 rounded-lg bg-white p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900">
                          {rec.title || recommendedAction?.label || 'Run Report'}
                        </h4>
                        {rec.notes && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {rec.notes}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRunReport(rec)}
                        className="shrink-0 text-amber-700 border-amber-300 hover:bg-amber-100"
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Run
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

/**
 * Markdown styling options for full-size display
 */
const fullMarkdownOptions = {
  overrides: {
    h1: { props: { className: 'text-2xl font-bold mb-4 mt-6 first:mt-0' } },
    h2: { props: { className: 'text-xl font-bold mb-3 mt-5' } },
    h3: { props: { className: 'text-lg font-bold mb-2 mt-4' } },
    p: { props: { className: 'mb-3 text-gray-700 leading-relaxed' } },
    ul: { props: { className: 'list-disc pl-6 mb-4 space-y-1' } },
    ol: { props: { className: 'list-decimal pl-6 mb-4 space-y-1' } },
    li: { props: { className: 'text-gray-700' } },
    code: { props: { className: 'bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800' } },
    pre: { props: { className: 'bg-gray-100 p-4 rounded-lg overflow-x-auto mb-4' } },
    blockquote: { props: { className: 'border-l-4 border-primary-500 pl-4 italic mb-4 text-gray-600' } },
    strong: { props: { className: 'font-semibold text-gray-900' } },
    em: { props: { className: 'italic' } },
  }
};

/**
 * Markdown styling options for compact/preview display
 */
const compactMarkdownOptions = {
  overrides: {
    h1: { props: { className: 'text-sm font-bold mb-2 mt-3 first:mt-0' } },
    h2: { props: { className: 'text-sm font-bold mb-1.5 mt-2' } },
    h3: { props: { className: 'text-xs font-bold mb-1 mt-1.5' } },
    p: { props: { className: 'mb-1.5 text-gray-700 text-xs leading-relaxed' } },
    ul: { props: { className: 'list-disc pl-4 mb-2 space-y-0.5' } },
    ol: { props: { className: 'list-decimal pl-4 mb-2 space-y-0.5' } },
    li: { props: { className: 'text-gray-700 text-xs' } },
    code: { props: { className: 'bg-gray-200 px-1 py-0.5 rounded text-xs font-mono' } },
    pre: { props: { className: 'bg-gray-200 p-2 rounded overflow-x-auto mb-2 text-xs' } },
    blockquote: { props: { className: 'border-l-2 border-primary-400 pl-2 italic mb-2 text-gray-600 text-xs' } },
    strong: { props: { className: 'font-semibold' } },
  }
};

/**
 * Executive Summary Content - the actual summary display component
 * Can be used standalone or within a modal
 */
export function ExecutiveSummaryContent({
  summary,
  accountScans = [],
  recommendations = [],
  item = null,
  type = 'environment',
  isGenerating = false,
  onGenerate,
  compact = false,
  showExpandButton = false,
  onExpand,
  emptyStateMessage = 'An executive summary has not been generated yet.',
}) {
  const markdownOptions = compact ? compactMarkdownOptions : fullMarkdownOptions;

  if (summary?.summaryText) {
    return (
      <div className="relative">
        {showExpandButton && onExpand && (
          <button
            onClick={onExpand}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-white border border-gray-200 text-gray-500 hover:text-primary-600 hover:border-primary-300 transition-colors shadow-sm z-10"
            title="Expand summary"
          >
            <Maximize2 className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
          </button>
        )}
        {/* Display recommended reports if available */}
        {item && (
          <RecommendedReports
            recommendations={recommendations}
            item={item}
            type={type}
            compact={compact}
          />
        )}
        {/* Display sources if available */}
        {summary.sources && (
          <SourcesList
            sources={summary.sources}
            reportSummaries={summary.reportSummaries}
            accountScans={accountScans}
            compact={compact}
          />
        )}
        <div className={`prose prose-sm max-w-none ${showExpandButton ? 'pr-8' : ''}`}>
          <Markdown options={markdownOptions}>
            {summary.summaryText}
          </Markdown>
        </div>
        {summary.updatedAt && (
          <p className={`text-gray-400 mt-2 pt-2 border-t border-gray-200 ${compact ? 'text-xs' : 'text-sm'}`}>
            Updated: {new Date(summary.updatedAt).toLocaleString()}
          </p>
        )}
      </div>
    );
  }

  // Empty state
  return (
    <div className={`flex flex-col items-center justify-center text-gray-500 ${compact ? 'py-8' : 'py-12'}`}>
      <FileText className={`mb-2 text-gray-400 ${compact ? 'w-8 h-8' : 'h-12 w-12 mb-4'}`} />
      <p className={`font-medium ${compact ? 'text-sm' : 'text-lg'}`}>No executive summary available</p>
      <p className={`mt-1 text-center ${compact ? 'text-xs' : 'text-sm mt-2'}`}>
        {emptyStateMessage}
      </p>
      {onGenerate && (
        <Button
          variant={compact ? "outline" : "default"}
          size="sm"
          onClick={onGenerate}
          disabled={isGenerating}
          className={compact ? 'mt-3 text-xs' : 'mt-4'}
        >
          {isGenerating ? (
            <Loader2 className={`animate-spin mr-1 ${compact ? 'w-3 h-3' : 'w-4 h-4 mr-2'}`} />
          ) : (
            <RefreshCw className={`mr-1 ${compact ? 'w-3 h-3' : 'w-4 h-4 mr-2'}`} />
          )}
          {isGenerating ? 'Generating...' : 'Generate Summary'}
        </Button>
      )}
    </div>
  );
}

/**
 * Executive Summary Modal - a modal dialog for displaying executive summaries
 */
export function ExecutiveSummaryModal({
  open,
  onOpenChange,
  item,
  summary,
  onSummaryUpdate,
  accountScans = [],
  recommendations = [],
  type = 'environment', // 'environment' or 'workload'
}) {
  const dispatch = useDispatch();
  const summaryId = type === 'workload' ? item?.workloadId : item?.recordId;
  const sharedSummary = useSelector((state) =>
    summaryId ? selectExecutiveSummaryForItem(state, type, summaryId) : null
  );
  const isGenerating = useSelector((state) =>
    summaryId ? selectIsExecutiveSummaryLoading(state, type, summaryId) : false
  );
  const resolvedSummary = sharedSummary || summary;

  const handleGenerate = useCallback(async () => {
    if (!item) return;
    if (type === 'environment' && !isSupportedExecutiveSummaryEnvironmentType(item?.type)) {
      toast.error('Executive summaries are only available for supported cloud environments.');
      return;
    }

    try {
      const action = await dispatch(
        ensureExecutiveSummary({
          type,
          id: summaryId,
          item,
          forceRefresh: true,
        })
      );

      if (!ensureExecutiveSummary.fulfilled.match(action)) {
        throw new Error(
          action.payload || action.error?.message || 'Failed to generate executive summary'
        );
      }

      onSummaryUpdate?.(action.payload?.summary);
      toast.success('Executive summary generated successfully!');
    } catch (error) {
      console.error('Failed to generate executive summary:', error);
      toast.error(error.message || 'Failed to generate executive summary');
    }
  }, [dispatch, item, onSummaryUpdate, summaryId, type]);

  const Icon = type === 'workload' ? Layers : Cloud;
  const itemName = type === 'workload' ? item?.workloadName : item?.name;
  const typeLabel = type === 'workload' ? 'Workload' : 'Environment';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-white">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-gray-900">
                <Icon className="w-5 h-5 text-primary-600" />
                {itemName}
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({typeLabel})
                </span>
              </DialogTitle>
              {resolvedSummary?.updatedAt && (
                <p className="text-xs text-gray-500 mt-1">
                  Last updated: {new Date(resolvedSummary.updatedAt).toLocaleString()}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {isGenerating ? 'Generating...' : 'Refresh Summary'}
            </Button>
          </div>
        </DialogHeader>
        <div className="mt-4 max-h-[70vh] overflow-y-auto">
          <ExecutiveSummaryContent
            summary={resolvedSummary}
            accountScans={accountScans}
            recommendations={recommendations}
            item={item}
            type={type}
            isGenerating={isGenerating}
            onGenerate={handleGenerate}
            emptyStateMessage={`An executive summary has not been generated for this ${typeLabel.toLowerCase()} yet.`}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Executive Summary Tab Content - for use in tabbed interfaces (e.g., WorkloadDetails)
 * Includes a header with title and refresh button
 */
export function ExecutiveSummaryTab({
  item,
  summary,
  onSummaryUpdate,
  accountScans = [],
  recommendations = [],
  type = 'workload', // 'environment' or 'workload'
}) {
  const dispatch = useDispatch();
  const summaryId = type === 'workload' ? item?.workloadId : item?.recordId;
  const sharedSummary = useSelector((state) =>
    summaryId ? selectExecutiveSummaryForItem(state, type, summaryId) : null
  );
  const isGenerating = useSelector((state) =>
    summaryId ? selectIsExecutiveSummaryLoading(state, type, summaryId) : false
  );
  const resolvedSummary = sharedSummary || summary;

  const handleGenerate = useCallback(async () => {
    if (!item) return;
    if (type === 'environment' && !isSupportedExecutiveSummaryEnvironmentType(item?.type)) {
      toast.error('Executive summaries are only available for supported cloud environments.');
      return;
    }

    try {
      const action = await dispatch(
        ensureExecutiveSummary({
          type,
          id: summaryId,
          item,
          forceRefresh: true,
        })
      );

      if (!ensureExecutiveSummary.fulfilled.match(action)) {
        throw new Error(
          action.payload || action.error?.message || 'Failed to generate executive summary'
        );
      }

      onSummaryUpdate?.(action.payload?.summary);
      toast.success('Executive summary generated successfully!');
    } catch (error) {
      console.error('Failed to generate executive summary:', error);
      toast.error(error.message || 'Failed to generate executive summary');
    }
  }, [dispatch, item, onSummaryUpdate, summaryId, type]);

  const Icon = type === 'workload' ? Layers : Cloud;
  const itemName = type === 'workload' ? item?.workloadName : item?.name;
  const typeLabel = type === 'workload' ? 'Workload' : 'Environment';

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            <Icon className="w-5 h-5 text-primary-600" />
            Executive Summary
          </h2>
          
          {resolvedSummary?.updatedAt && (
            <p className="text-xs text-gray-400 mt-1">
              Last updated: {new Date(resolvedSummary.updatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-1.5"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {isGenerating ? 'Generating...' : (resolvedSummary?.summaryText ? 'Refresh Summary' : 'Generate Summary')}
        </Button>
      </div>
      <div className="border border-gray-200 rounded-lg bg-gray-50 p-6">
        <ExecutiveSummaryContent
          summary={resolvedSummary}
          accountScans={accountScans}
          recommendations={recommendations}
          item={item}
          type={type}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
          emptyStateMessage={`An executive summary has not been generated for this ${typeLabel.toLowerCase()} yet.`}
        />
      </div>
    </div>
  );
}

// Default export for backward compatibility
export default ExecutiveSummaryModal;
