import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronDown,
  ChevronRight,
  FileDown,
  FileText,
  Filter,
  Loader2,
  Search,
  ServerIcon,
  X,
} from 'lucide-react';
import {
  getPriority,
  sortResultsByFailedFirst,
} from '../helpers/report_compliance';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image as PdfImage,
  Link,
} from '@react-pdf/renderer';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { useSelector, useDispatch } from 'react-redux';
import { loadWorkloadsFromUserProfile } from '../features/workload/workloadSlice';
import { getAwsAccountIdForWorkloadEnvironment } from '../features/workload/workloadEnvironmentUtils';
import ReportScanSummary from './ReportScanSummary';
const LOGO = '/logo.png';
// import { Progress } from '@/components/ui/progress'; // If you want your library's Progress
// import { results } from './data';

// ------------------------------------------------------
// SimpleModal: closes on overlay click or ESC
// ------------------------------------------------------
function SimpleModal({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm transition-opacity duration-200"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden relative animate-in fade-in-50 zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b p-4">
          <div className="text-lg font-semibold">Resource Details</div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
          {children}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------
export default function SimplifiedComplianceDetails({ results, accountId, authProfile, scanSummary }) {
  // The data from your "results" import
  const categoryTitle = results.title;
  const controls = results.controls;
  const location = useLocation();
  const dispatch = useDispatch();
  const { userProfile } = useSelector((state) => state.auth);
  const workloads = useSelector((state) => state.workload.workloads);
  
  const effectiveAccountId = authProfile?.awsAccountId || accountId || '';

  // States
  const [expandedControls, setExpandedControls] = useState([]);
  const [activeRule, setActiveRule] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [resourceSearch, setResourceSearch] = useState('');
  const [resourcePage, setResourcePage] = useState(1);
  const [expandedDescriptions, setExpandedDescriptions] = useState(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);
  const [hideNotApplicableRules, setHideNotApplicableRules] = useState(false);
  const [selectedWorkloadId, setSelectedWorkloadId] = useState('');

  // Load workloads from userProfile if not already loaded
  useEffect(() => {
    if (
      userProfile?.workloads &&
      userProfile.workloads.length > 0 &&
      workloads.length === 0
    ) {
      dispatch(loadWorkloadsFromUserProfile(userProfile.workloads));
    }
  }, [dispatch, userProfile?.workloads, workloads.length]);

  // Read workloadId from URL parameters on mount
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const urlWorkloadId = searchParams.get('workloadId');
    if (urlWorkloadId) {
      setSelectedWorkloadId(urlWorkloadId);
    }
  }, [location.search]);

  // Function to resolve AWS account ID from environment value
  const permissionProfiles = userProfile?.agentPermissionProfiles || [];

  // Filter workloads that are associated with the AWS account ID
  const associatedWorkloads = useMemo(() => {
    if (!effectiveAccountId || !workloads || workloads.length === 0) {
      return [];
    }
    
    return workloads.filter((workload) => {
      if (!Array.isArray(workload.environments) || workload.environments.length === 0) {
        return false;
      }
      
      // Check if any environment includes this AWS account ID
      return workload.environments.some((env) => {
        const accountId = getAwsAccountIdForWorkloadEnvironment(env, permissionProfiles);
        return accountId === effectiveAccountId;
      });
    });
  }, [workloads, effectiveAccountId, permissionProfiles]);

  // Get selected workload's tracked resources
  const selectedWorkload = useMemo(() => {
    if (!selectedWorkloadId || !workloads || workloads.length === 0) {
      return null;
    }
    return workloads.find((w) => w.workloadId === selectedWorkloadId);
  }, [selectedWorkloadId, workloads]);

  // Extract tracked resource IDs and ARNs from selected workload
  const trackedResourceIds = useMemo(() => {
    if (!selectedWorkload) {
      return new Set();
    }
    
    let trackedResourcesObj = selectedWorkload.trackedResources;
    if (typeof trackedResourcesObj === 'string') {
      try {
        trackedResourcesObj = JSON.parse(trackedResourcesObj);
      } catch (error) {
        console.error('Failed to parse trackedResources:', error);
        return new Set();
      }
    }
    
    if (!trackedResourcesObj?.resources || !Array.isArray(trackedResourcesObj.resources)) {
      return new Set();
    }
    
    const ids = new Set();
    trackedResourcesObj.resources.forEach((resource) => {
      if (resource.resourceId) {
        ids.add(resource.resourceId);
      }
      if (resource.resourceArn) {
        ids.add(resource.resourceArn);
      }
    });
    
    return ids;
  }, [selectedWorkload]);

  // Filter controls and rules based on workload selection
  const getFilteredControls = () => {
    if (!controls || Object.keys(controls).length === 0) {
      return controls;
    }

    const hasWorkloadFilter = selectedWorkloadId && trackedResourceIds.size > 0;
    if (!hasWorkloadFilter) {
      return controls;
    }

    const filtered = {};
    
    Object.keys(controls).forEach((controlKey) => {
      const control = controls[controlKey];
      const filteredResults = control.results.map((rule) => {
        const originalPassed = rule.result?.passed || [];
        const originalFailed = rule.result?.failed || [];
        
        // Filter passed/failed arrays based on tracked resources
        const filteredPassed = originalPassed.filter((resource) => {
          return (
            (resource.resourceId && trackedResourceIds.has(resource.resourceId)) ||
            (resource.resourceArn && trackedResourceIds.has(resource.resourceArn))
          );
        });
        
        const filteredFailed = originalFailed.filter((resource) => {
          return (
            (resource.resourceId && trackedResourceIds.has(resource.resourceId)) ||
            (resource.resourceArn && trackedResourceIds.has(resource.resourceArn))
          );
        });
        
        return {
          ...rule,
          result: {
            ...rule.result,
            passed: filteredPassed,
            failed: filteredFailed,
          },
        };
      });
      
      filtered[controlKey] = {
        ...control,
        results: filteredResults,
      };
    });
    
    return filtered;
  };

  const filteredControls = getFilteredControls();

  // Calculate overall stats for controls (using filtered controls)
  const totalControls = Object.keys(filteredControls).length;
  const passedControls = Object.keys(filteredControls).filter((key) => {
    const control = filteredControls[key];
    const hasFailure = control.results.some(
      (rule) => rule.result.failed && rule.result.failed.length > 0
    );
    return !hasFailure;
  }).length;
  const controlPassPercentage = totalControls
    ? (passedControls / totalControls) * 100
    : 0;

  // Calculate overall stats for rules (using filtered controls)
  // Count unique rule IDs from displayed rules (after workload and hideNotApplicable filtering)
  const ruleIdsSet = new Set();
  const passedRuleIdsSet = new Set();
  
  Object.keys(filteredControls).forEach((key) => {
    const control = filteredControls[key];
    
    // Filter rules based on hideNotApplicable toggle
    const visibleRules = control.results.filter((rule) => {
      if (hideNotApplicableRules) {
        const failedCount = rule.result.failed ? rule.result.failed.length : 0;
        const passedCount = rule.result.passed ? rule.result.passed.length : 0;
        return failedCount > 0 || passedCount > 0;
      }
      return true;
    });
    
    visibleRules.forEach((rule) => {
      if (rule.id) {
        ruleIdsSet.add(rule.id);
        // A rule is considered passed if it has no failed resources
        if (!rule.result.failed || rule.result.failed.length === 0) {
          passedRuleIdsSet.add(rule.id);
        }
      }
    });
  });
  
  const totalRules = ruleIdsSet.size;
  const passedRules = passedRuleIdsSet.size;
  const rulePassPercentage = totalRules ? (passedRules / totalRules) * 100 : 0;

  // Render a control/rule description as text or JSX
  function renderDescription(description) {
    return React.isValidElement(description) ? (
      description
    ) : (
      <p className="whitespace-pre-wrap">{description}</p>
    );
  }

  // Expand/collapse a control
  function handleControlClick(controlKey) {
    const isExpanded = expandedControls.includes(controlKey);
    setExpandedControls((prev) =>
      isExpanded ? prev.filter((k) => k !== controlKey) : [...prev, controlKey]
    );
  }

  // Clicking a rule row -> set that rule as active (shows modal)
  function handleRuleClick(rule) {
    setActiveRule(rule);
    setResourcePage(1);
  }

  // Overall pass/fail for a control (using filtered controls)
  function getControlOverallResult(controlKey) {
    const control = filteredControls[controlKey];
    if (!control) return 'passed';
    
    const hasFailure = control.results.some(
      (rule) => rule.result.failed && rule.result.failed.length > 0
    );
    if (hasFailure) {
      return 'failed';
    }
    
    // Check if all rules are not applicable (0 failed and 0 passed)
    const allRulesNotApplicable = control.results.every((rule) => {
      const failedCount = rule.result.failed ? rule.result.failed.length : 0;
      const passedCount = rule.result.passed ? rule.result.passed.length : 0;
      return failedCount === 0 && passedCount === 0;
    });
    
    if (allRulesNotApplicable) {
      return 'not applicable';
    }
    
    return 'passed';
  }

  // Build resource list for the active rule
  let displayedResources = [];
  if (activeRule) {
    const {
      failed = [],
      passed = [],
      error = [],
      notapplicable = [],
    } = activeRule.result || {};
    displayedResources = [
      ...failed.map((r) => ({ ...r, outcome: 'failed' })),
      ...passed.map((r) => ({ ...r, outcome: 'passed' })),
      ...error.map((r) => ({ ...r, outcome: 'error' })),
      ...notapplicable.map((r) => ({ ...r, outcome: 'notapplicable' })),
    ];
    // Filter by outcome
    if (resourceFilter !== 'all') {
      displayedResources = displayedResources.filter(
        (r) => r.outcome === resourceFilter
      );
    }
    // Filter by search
    if (resourceSearch.trim() !== '') {
      const lower = resourceSearch.toLowerCase();
      displayedResources = displayedResources.filter(
        (r) =>
          (r.displayName && r.displayName.toLowerCase().includes(lower)) ||
          (r.resourceId && r.resourceId.toLowerCase().includes(lower)) ||
          (r.region && r.region.toLowerCase().includes(lower))
      );
    }
  }
  // Pagination
  const itemsPerPage = 5;
  const totalPages = Math.ceil(displayedResources.length / itemsPerPage);
  const currentResources = displayedResources.slice(
    (resourcePage - 1) * itemsPerPage,
    resourcePage * itemsPerPage
  );

  const toggleDescription = (id, e) => {
    e.stopPropagation();
    setExpandedDescriptions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center border-b border-blue-500 pb-4 mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-gray-800">
{categoryTitle}
          </h2>
          {associatedWorkloads.length > 0 && (
            <Select value={selectedWorkloadId || 'all'} onValueChange={(value) => setSelectedWorkloadId(value === 'all' ? '' : value)}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select workload" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All workloads</SelectItem>
                {associatedWorkloads.map((workload) => (
                  <SelectItem key={workload.workloadId} value={workload.workloadId}>
                    {workload.workloadName || workload.workloadId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
            onClick={() => setIsModalOpen(true)}
          >
            <FileText className="w-4 h-4" />
            <span>PDF</span>
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
            onClick={() => setIsCSVModalOpen(true)}
          >
            <FileDown className="w-4 h-4" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-base font-medium text-blue-800">Controls</h3>
            <span className="text-sm text-blue-700 font-medium">
              {passedControls} of {totalControls} passed
            </span>
          </div>
          <div className="w-full bg-white rounded-full h-2.5">
            <div
              className="bg-green-500 h-2.5 rounded-full"
              style={{ width: `${(passedControls / totalControls) * 100}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-blue-700 text-right">
            {Math.round((passedControls / totalControls) * 100)}% passed
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-base font-medium text-indigo-800">Rules</h3>
            <span className="text-sm text-indigo-700 font-medium">
              {passedRules} of {totalRules} passed
            </span>
          </div>
          <div className="w-full bg-white rounded-full h-2.5">
            <div
              className="bg-green-500 h-2.5 rounded-full"
              style={{ width: `${(passedRules / totalRules) * 100}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-indigo-700 text-right">
            {Math.round((passedRules / totalRules) * 100)}% passed
          </div>
        </div>
      </div>

      <ReportScanSummary summary={scanSummary} className="mb-6" />

      <div className="flex gap-4 mb-6 items-center">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search controls..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="hide-not-applicable-rules"
              checked={hideNotApplicableRules}
              onCheckedChange={setHideNotApplicableRules}
              className="data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600"
            />
            <Label
              htmlFor="hide-not-applicable-rules"
              className="text-sm text-gray-700 cursor-pointer"
            >
              Hide not applicable
            </Label>
          </div>
          {(() => {
            // Calculate visible controls count (using filtered controls)
            const visibleControlsCount = Object.keys(filteredControls).filter((controlKey) => {
              // Filter by search
              if (!controlKey.toLowerCase().includes(searchValue.toLowerCase())) {
                return false;
              }
              // Filter out not applicable controls when toggle is on
              if (hideNotApplicableRules) {
                const overallResult = getControlOverallResult(controlKey);
                return overallResult !== 'not applicable';
              }
              return true;
            }).length;
            
            return (
              <span className="text-sm text-gray-600">
                {visibleControlsCount} {visibleControlsCount === 1 ? 'control' : 'controls'} showing
              </span>
            );
          })()}
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <ScrollArea className="h-[calc(100vh-20rem)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableCell className="w-[20%] py-3 text-sm font-medium text-gray-700">
                  Result
                </TableCell>
                <TableCell className="py-3 text-sm font-medium text-gray-700">
                  Control
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.keys(filteredControls)
                .filter((controlKey) => {
                  // Filter by search
                  if (!controlKey.toLowerCase().includes(searchValue.toLowerCase())) {
                    return false;
                  }
                  // Filter out not applicable controls when toggle is on
                  if (hideNotApplicableRules) {
                    const overallResult = getControlOverallResult(controlKey);
                    return overallResult !== 'not applicable';
                  }
                  return true;
                })
                .map((controlKey) => {
                  const overallResult = getControlOverallResult(controlKey);
                  const control = filteredControls[controlKey];
                  const isExpanded = expandedControls.includes(controlKey);

                  return (
                    <React.Fragment key={controlKey}>
                      <TableRow
                        className="hover:bg-gray-50 cursor-pointer transition-colors border-t border-gray-200"
                        onClick={() => handleControlClick(controlKey)}
                      >
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-500" />
                            )}
                            <StatusBadge status={overallResult} />
                          </div>
                        </TableCell>
                        <TableCell className="py-3 font-medium text-gray-800">
                          {controlKey}
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow>
                          <TableCell
                            colSpan={2}
                            className="bg-gray-50 border-t border-b border-gray-200"
                          >
                            <div className="p-4">
                              <div className="bg-white p-4 rounded-lg mb-4 text-gray-700">
                                {renderDescription(control.description)}
                              </div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                <Filter className="h-4 w-4 mr-2 text-gray-500" />
                                Assessment Rules
                              </h4>
                              {(() => {
                                // Filter rules based on toggle
                                const visibleRules = control.results.filter((rule) => {
                                  // Filter out rules with 0 failed and 0 passed if toggle is on
                                  if (hideNotApplicableRules) {
                                    const failedCount = rule.result.failed
                                      ? rule.result.failed.length
                                      : 0;
                                    const passedCount = rule.result.passed
                                      ? rule.result.passed.length
                                      : 0;
                                    return failedCount > 0 || passedCount > 0;
                                  }
                                  return true;
                                });

                                // Show message if no applicable rules
                                if (visibleRules.length === 0) {
                                  return (
                                    <div className="border border-gray-200 rounded-lg bg-white p-8 text-center">
                                      <p className="text-gray-500 text-sm">No applicable rules</p>
                                    </div>
                                  );
                                }

                                // Show table if there are visible rules
                                return (
                                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="bg-gray-50">
                                          <TableCell className="w-[12%] py-2 text-xs font-medium text-gray-700">
                                            Result
                                          </TableCell>
                                          <TableCell className="w-[12%] py-2 text-xs font-medium text-gray-700">
                                            Priority
                                          </TableCell>
                                          <TableCell className="py-2 text-xs font-medium text-gray-700">
                                            Rule
                                          </TableCell>
                                          <TableCell className="py-2 text-xs font-medium text-gray-700">
                                            Resources
                                          </TableCell>
                                          <TableCell className="text-center py-2 text-xs font-medium text-gray-700">
                                            Failed
                                          </TableCell>
                                          <TableCell className="text-center py-2 text-xs font-medium text-gray-700">
                                            Passed
                                          </TableCell>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {visibleRules.map((rule, idx) => {
                                        const failedCount = rule.result.failed
                                          ? rule.result.failed.length
                                          : 0;
                                        const passedCount = rule.result.passed
                                          ? rule.result.passed.length
                                          : 0;
                                        const ruleOutcome =
                                          failedCount > 0 
                                            ? 'failed' 
                                            : passedCount > 0 
                                              ? 'passed' 
                                              : 'not applicable';

                                      const priority = getPriority(
                                        rule,
                                        'Production'
                                      );

                                      const allResources = [
                                        ...(rule.result.passed || []),
                                        ...(rule.result.failed || []),
                                      ];

                                      const resourceTypes = Array.from(
                                        new Set(
                                          allResources.map(
                                            (resource) => resource.resourceType
                                          )
                                        )
                                      );

                                      return (
                                        <TableRow
                                          key={idx}
                                          className="hover:bg-gray-50 cursor-pointer transition-colors border-t border-gray-200"
                                          onClick={() => handleRuleClick(rule)}
                                        >
                                          <TableCell className="py-2">
                                            <StatusBadge status={ruleOutcome} />
                                          </TableCell>
                                          <TableCell className="py-2">
                                            <PriorityBadge
                                              priority={priority}
                                            />
                                          </TableCell>
                                          <TableCell className="py-2 text-sm text-gray-800">
                                            <div className="space-y-2">
                                              <div className="font-medium group-hover:text-blue-700 transition-colors flex items-start">
                                                {rule.title}
                                              </div>
                                            </div>
                                          </TableCell>
                                          <TableCell className="py-2 text-sm text-gray-800">
                                            <div className="space-y-2">
                                              {resourceTypes.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                  {resourceTypes.map(
                                                    (type, i) => {
                                                      const regionsForType =
                                                        Array.from(
                                                          new Set(
                                                            allResources
                                                              .filter(
                                                                (resource) =>
                                                                  resource.resourceType ===
                                                                  type
                                                              )
                                                              .map(
                                                                (resource) =>
                                                                  resource.region
                                                              )
                                                              .filter(Boolean)
                                                          )
                                                        );

                                                      return (
                                                        <span
                                                          key={i}
                                                          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800 border border-gray-200"
                                                          title={`${type} in regions: ${regionsForType.join(', ')}`}
                                                        >
                                                          <ServerIcon className="h-3 w-3 mr-1 text-gray-500" />
                                                          {type}
                                                        </span>
                                                      );
                                                    }
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </TableCell>
                                          <TableCell className="text-center py-2 text-sm">
                                            <span
                                              className={`font-medium ${failedCount > 0 ? 'text-red-600' : 'text-gray-500'}`}
                                            >
                                              {failedCount}
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-center py-2 text-sm">
                                            <span
                                              className={`font-medium ${passedCount > 0 ? 'text-green-600' : 'text-gray-500'}`}
                                            >
                                              {passedCount}
                                            </span>
                                          </TableCell>
                                        </TableRow>
                                      );
                                        })}
                                      </TableBody>
                                    </Table>
                                  </div>
                                );
                              })()}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
      {isModalOpen && (
        <PDFExportComponent
          {...{
            isModalOpen,
            setIsModalOpen,
            controls,
            searchValue,
            categoryTitle,
          }}
        />
      )}
      {isCSVModalOpen && (
        <CSVExportModal
          isModalOpen={isCSVModalOpen}
          toggleModal={() => setIsCSVModalOpen(false)}
          {...{ controls, categoryTitle }}
        />
      )}

      <SimpleModal open={!!activeRule} onClose={() => setActiveRule(null)}>
        {activeRule && (
          <div className="max-h-[80vh] overflow-y-auto">
            <div className="bg-gray-50 p-4 rounded-lg mb-5 border-l-4 border-blue-500">
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                {activeRule.title}
              </h3>
              {activeRule.description ? (
                <div className="text-gray-700">
                  {renderDescription(activeRule.description)}
                </div>
              ) : (
                <p className="text-gray-500 italic">
                  No description available for this rule.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-semibold text-gray-800 flex items-center">
                <Filter className="h-4 w-4 mr-2 text-gray-500" />
                Affected Resources
              </h4>
              <div className="text-sm text-gray-600">
                {displayedResources.length} resources
              </div>
            </div>

            <div className="flex gap-3 mb-4 px-2">
              <div className="flex items-center">
                <Select
                  value={resourceFilter}
                  onValueChange={(value) => {
                    setResourceFilter(value);
                    setResourcePage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px] pl-2 pr-2 bg-white border-gray-200 min-h-12">
                    <div className="flex items-center gap-2">
                      <SelectValue placeholder="Filter results" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All results</SelectItem>
                    <SelectItem value="failed">Failed only</SelectItem>
                    <SelectItem value="passed">Passed only</SelectItem>
                    <SelectItem value="error">Errors only</SelectItem>
                    <SelectItem value="notapplicable">
                      Not Applicable
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search resources..."
                  value={resourceSearch}
                  onChange={(e) => {
                    setResourceSearch(e.target.value);
                    setResourcePage(1);
                  }}
                  className="pl-10 border-gray-300"
                />
              </div>
            </div>

            {displayedResources.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                <p>No resources match your filters.</p>
              </div>
            ) : (
              <>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <ScrollArea className="max-h-[300px] overflow-auto">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableCell className="w-[10%] py-2 px-4 text-xs font-medium text-gray-700">
                            Status
                          </TableCell>
                          <TableCell className="w-[15%] py-2 px-4 text-xs font-medium text-gray-700">
                            Resource
                          </TableCell>
                          <TableCell className="w-[15%] py-2 px-4 text-xs font-medium text-gray-700">
                            Region
                          </TableCell>
                          <TableCell className="w-[60%] py-2 px-4 text-xs font-medium text-gray-700">
                            Description
                          </TableCell>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentResources.map((res, idx) => {
                          const resourceId =
                            res.resourceId || `resource-${idx}`;
                          const isExpanded =
                            expandedDescriptions.has(resourceId);

                          return (
                            <React.Fragment key={idx}>
                              <TableRow
                                className={`hover:bg-gray-50 transition-colors border-t border-gray-200 ${isExpanded ? 'bg-gray-50' : ''}`}
                              >
                                <TableCell className="py-3 px-4">
                                  <span
                                    className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                      res.outcome === 'passed'
                                        ? 'bg-green-100 text-green-800'
                                        : res.outcome === 'failed'
                                          ? 'bg-red-100 text-red-800'
                                          : res.outcome === 'error'
                                            ? 'bg-orange-100 text-orange-800'
                                            : 'bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {res.outcome}
                                  </span>
                                </TableCell>

                                <TableCell className="py-3 px-4">
                                  <div className="flex items-center">
                                    <div
                                      className="truncate max-w-xs"
                                      title={res.displayName || res.resourceId}
                                    >
                                      <span className="text-sm font-medium text-gray-800">
                                        {res.displayName || res.resourceId}
                                      </span>
                                    </div>
                                    {res.link && (
                                      <a
                                        href={res.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-2 text-blue-500 hover:text-blue-700"
                                        onClick={(e) => e.stopPropagation()}
                                        title="Open in AWS Console"
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          className="h-4 w-4"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                          />
                                        </svg>
                                      </a>
                                    )}
                                  </div>
                                </TableCell>

                                <TableCell className="py-3 px-4">
                                  <span className="text-sm text-gray-600">
                                    {res.region || 'N/A'}
                                  </span>
                                </TableCell>

                                <TableCell className="py-3 px-4 relative">
                                  {res.description ? (
                                    <div>
                                      {!expandedDescriptions.has(resourceId) &&
                                      res.description.length > 100 ? (
                                        <div className="text-sm text-gray-600">
                                          {res.description.slice(0, 100)}
                                          <span className="text-gray-400">
                                            ...
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="text-sm text-gray-600">
                                          {res.description}
                                        </div>
                                      )}

                                      {res.description.length > 100 && (
                                        <button
                                          type="button"
                                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline focus:outline-none mt-1"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedDescriptions((prev) => {
                                              const newSet = new Set(prev);
                                              if (newSet.has(resourceId)) {
                                                newSet.delete(resourceId);
                                              } else {
                                                newSet.add(resourceId);
                                              }
                                              return newSet;
                                            });
                                          }}
                                        >
                                          {expandedDescriptions.has(resourceId)
                                            ? 'Show less'
                                            : 'Show more'}
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 italic">
                                      No description available
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            </React.Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center mt-4 gap-2">
                    <button
                      onClick={() => setResourcePage(resourcePage - 1)}
                      disabled={resourcePage <= 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {resourcePage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setResourcePage(resourcePage + 1)}
                      disabled={resourcePage >= totalPages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </SimpleModal>
    </div>
  );
}

const StatusBadge = ({ status }) => {
  const getStatusStyles = (status) => {
    switch (status.toLowerCase()) {
      case 'passed':
        return 'bg-green-100 text-green-800 border-green-400';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-400';
      case 'error':
        return 'bg-orange-100 text-orange-800 border-orange-400';
      case 'notapplicable':
      case 'not applicable':
        return 'bg-gray-100 text-gray-800 border-gray-400';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-400';
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyles(status)}`}
    >
      {status}
    </span>
  );
};

const PriorityBadge = ({ priority }) => {
  const getPriorityStyles = (priority) => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-400';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-400';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-400';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-400';
      default:
        return 'bg-teal-100 text-teal-800 border-teal-400';
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityStyles(priority)}`}
    >
      {priority}
    </span>
  );
};

const PDFExportComponent = ({
  isModalOpen,
  setIsModalOpen,
  controls,
  searchValue,
  categoryTitle,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const [pdfOptions, setPdfOptions] = useState({
    includeAssessmentRules: true,
    resourceDetails: 'no',
  });

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  const handleAssessmentRulesToggle = () => {
    setPdfOptions({
      ...pdfOptions,
      includeAssessmentRules: !pdfOptions.includeAssessmentRules,
    });
  };

  const handleResourceDetailsChange = (value) => {
    setPdfOptions({
      ...pdfOptions,
      resourceDetails: value,
    });
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const controlEntries = Object.entries(controls);
      const chunkSize = 5;
      let allResults = [];

      for (let i = 0; i < controlEntries.length; i += chunkSize) {
        const chunk = controlEntries.slice(i, i + chunkSize);

        const chunkResults = chunk.flatMap(([key, control]) =>
          (control.results || []).map((result) => ({
            ...result,
            ...result.result,
          }))
        );

        allResults = allResults.concat(chunkResults);

        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      await new Promise((resolve) => requestAnimationFrame(resolve));

      const controlsStats = Object.keys(controls).reduce(
        (acc, control) => {
          const hasFailed = controls[control]?.results?.some(
            (result) => result.result.failed.length > 0
          );

          if (hasFailed) {
            acc.controlsFailed++;
          } else {
            acc.controlsPassed++;
          }
          acc.totalControls++;

          return acc;
        },
        { controlsPassed: 0, controlsFailed: 0, totalControls: 0 }
      );

      const rulesStats = allResults.reduce(
        (acc, rule) => {
          if (rule.result.failed.length > 0) {
            acc.rulesFailed++;
          } else if (rule.result.passed.length > 0) {
            acc.rulesPassed++;
          }
          acc.totalRules++;

          return acc;
        },
        { rulesPassed: 0, rulesFailed: 0, totalRules: 0 }
      );

      const controlsPassedPercentage =
        Math.round(
          (controlsStats.controlsPassed / controlsStats.totalControls) * 100
        ) || 0;
      const rulesPassedPercentage =
        Math.round((rulesStats.rulesPassed / rulesStats.totalRules) * 100) || 0;

      const overallScore = Math.round(
        (controlsPassedPercentage + rulesPassedPercentage) / 2
      );

      const summary = {
        ...controlsStats,
        ...rulesStats,
        controlsPassedPercentage,
        rulesPassedPercentage,
        overallScore,
      };

      const doc = (
        <PDFReport
          categoryTitle={categoryTitle}
          data={controls}
          searchValue={searchValue}
          includeResource={pdfOptions.resourceDetails}
          includeRules={pdfOptions.includeAssessmentRules}
          results={allResults}
          summary={summary}
        />
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      const asPdf = pdf(doc);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const blob = await asPdf.toBlob();

      await new Promise((resolve) => setTimeout(resolve, 100));

      saveAs(blob, `${categoryTitle}.pdf`);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-4">
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden">
            <div className="border-b px-6 py-4">
              <h2 className="text-xl font-medium text-gray-800">
                PDF Report Customization
              </h2>
            </div>

            <div className="px-6 py-4 space-y-6">
              <div className="flex items-center">
                <div
                  className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${pdfOptions.includeAssessmentRules ? 'bg-blue-500' : 'bg-gray-300'}`}
                  onClick={handleAssessmentRulesToggle}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${pdfOptions.includeAssessmentRules ? 'translate-x-6' : ''}`}
                  />
                </div>
                <span className="ml-3 text-gray-700">
                  Include Assessment Rules Section
                </span>
              </div>

              {pdfOptions.includeAssessmentRules && (
                <div className="mt-4 pl-2">
                  <h3 className="font-medium text-gray-800 mb-3">
                    Assessment Rule Section
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center">
                      <div
                        className={`w-6 h-6 rounded-full border cursor-pointer ${pdfOptions.resourceDetails === 'none' ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`}
                        onClick={() => handleResourceDetailsChange('none')}
                      >
                        {pdfOptions.resourceDetails === 'none' && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-4 h-4 bg-white rounded-full" />
                          </div>
                        )}
                      </div>
                      <span className="ml-3 text-gray-700  flex-1">
                        Do not include resource details (recommended for large
                        environments)
                      </span>
                    </div>

                    <div className="flex items-center">
                      <div
                        className={`w-6 h-6 rounded-full border cursor-pointer ${pdfOptions.resourceDetails === 'failed' ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`}
                        onClick={() => handleResourceDetailsChange('failed')}
                      >
                        {pdfOptions.resourceDetails === 'failed' && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-4 h-4 bg-white rounded-full" />
                          </div>
                        )}
                      </div>
                      <span className="ml-3 text-gray-700  flex-1">
                        Only include failed resource details
                      </span>
                    </div>

                    <div className="flex items-center">
                      <div
                        className={`w-6 h-6 rounded-full border cursor-pointer ${pdfOptions.resourceDetails === 'all' ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`}
                        onClick={() => handleResourceDetailsChange('all')}
                      >
                        {pdfOptions.resourceDetails === 'all' && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-4 h-4 bg-white rounded-full" />
                          </div>
                        )}
                      </div>
                      <span className="ml-3 text-gray-700  flex-1">
                        Include all resource details
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 bg-gray-50">
              <Button
                variant="outline"
                onClick={toggleModal}
                disabled={isExporting}
              >
                Cancel
              </Button>
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  'Export to PDF'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CSVExportModal = ({
  isModalOpen,
  toggleModal,
  controls,
  categoryTitle,
}) => {
  const [csvOptions, setCsvOptions] = useState({
    delimiter: 'comma',
    resourceDetails: 'all',
  });

  const handleDelimiterChange = (e) => {
    setCsvOptions((prev) => ({
      ...prev,
      delimiter: e.target.value,
    }));
  };

  const handleResourceDetailsChange = (option) => {
    setCsvOptions((prev) => ({
      ...prev,
      resourceDetails: option,
    }));
  };

  const handleExport = () => {
    const delimiterMap = {
      comma: ',',
      semicolon: ';',
      tab: '\t',
      space: ' ',
    };
    const delimiter = delimiterMap[csvOptions.delimiter] || ',';

    const fields = [
      'Control',
      'Control Result',
      'Assessment Rule',
      'Resource',
      'Region',
      'Assessment Rule Result',
      'Details',
    ];

    const stringDoubleQuotes = (string) => `"${string}"`;
    let csvRows = [];
    csvRows.push([...fields]);

    for (const control of Object.keys(controls)) {
      let csvRow = [];

      const result =
        controls[control].results.filter(
          (result) => result.result.failed.length > 0
        ).length > 0
          ? 'FAIL'
          : controls[control].results.filter(
                (result) => result.result.passed.length > 0
              ).length > 0
            ? 'PASS'
            : 'NOT APPLICABLE';

      csvRow.push(stringDoubleQuotes(control));
      csvRow.push(stringDoubleQuotes(result));
      csvRows.push(csvRow);

      for (const rule of controls[control]['results']) {
        const { title, id } = rule;
        const { failed, passed, error, notapplicable } = rule['result'];

        if (
          failed.length === 0 &&
          passed.length === 0 &&
          error.length === 0 &&
          notapplicable.length === 0
        ) {
          let csvRow = [];
          csvRow.push(stringDoubleQuotes(''));
          csvRow.push(stringDoubleQuotes(''));
          csvRow.push(stringDoubleQuotes(title));
          csvRow.push(stringDoubleQuotes(''));
          csvRow.push(stringDoubleQuotes(''));
          csvRow.push(stringDoubleQuotes('NO APPLICABLE RESOURCES'));
          csvRow.push(stringDoubleQuotes(''));
          csvRows.push(csvRow);
        }

        if (
          csvOptions.resourceDetails === 'all' ||
          csvOptions.resourceDetails === 'failed'
        ) {
          for (const resource of failed) {
            let csvRow = [];
            csvRow.push(stringDoubleQuotes(''));
            csvRow.push(stringDoubleQuotes(''));
            csvRow.push(stringDoubleQuotes(title));
            csvRow.push(stringDoubleQuotes(resource.displayName));
            csvRow.push(stringDoubleQuotes(resource.region));
            csvRow.push(stringDoubleQuotes('FAILED'));
            csvRow.push(stringDoubleQuotes(resource.description));
            csvRows.push(csvRow);
          }
        }

        if (csvOptions.resourceDetails === 'all') {
          for (const resource of passed) {
            let csvRow = [];
            csvRow.push(stringDoubleQuotes(''));
            csvRow.push(stringDoubleQuotes(''));
            csvRow.push(stringDoubleQuotes(title));
            csvRow.push(stringDoubleQuotes(resource.displayName));
            csvRow.push(stringDoubleQuotes(resource.region));
            csvRow.push(stringDoubleQuotes('PASSED'));
            csvRow.push(stringDoubleQuotes(resource.description));
            csvRows.push(csvRow);
          }

          for (const resource of error) {
            let csvRow = [];
            csvRow.push(stringDoubleQuotes(''));
            csvRow.push(stringDoubleQuotes(''));
            csvRow.push(stringDoubleQuotes(title));
            csvRow.push(stringDoubleQuotes(resource.displayName));
            csvRow.push(stringDoubleQuotes(resource.region));
            csvRow.push(stringDoubleQuotes('ERROR'));
            csvRow.push(stringDoubleQuotes(resource.description));
            csvRows.push(csvRow);
          }

          for (const resource of notapplicable) {
            let csvRow = [];
            csvRow.push(stringDoubleQuotes(''));
            csvRow.push(stringDoubleQuotes(''));
            csvRow.push(stringDoubleQuotes(title));
            csvRow.push(stringDoubleQuotes(resource.displayName));
            csvRow.push(stringDoubleQuotes(resource.region));
            csvRow.push(stringDoubleQuotes('NOT APPLICABLE'));
            csvRow.push(stringDoubleQuotes(resource.description));
            csvRows.push(csvRow);
          }
        } else if (csvOptions.resourceDetails === 'failed') {
          if (passed.length > 0 && failed.length === 0) {
            let csvRow = [];
            csvRow.push(stringDoubleQuotes(''));
            csvRow.push(stringDoubleQuotes(''));
            csvRow.push(stringDoubleQuotes(title));
            csvRow.push(stringDoubleQuotes(''));
            csvRow.push(stringDoubleQuotes(''));
            csvRow.push(stringDoubleQuotes('PASSED'));
            csvRow.push(stringDoubleQuotes(''));
            csvRows.push(csvRow);
          }
        }
      }
    }

    const filename = prompt('Enter CSV file name:', `${categoryTitle}.csv`);
    if (!filename) return;

    const universalBOM = '\uFEFF';
    const csvText = csvRows.map((e) => e.join(delimiter)).join('\n');

    const element = document.createElement('a');
    element.setAttribute(
      'href',
      'data:text/csv;charset=utf-8,' +
        encodeURIComponent(universalBOM + csvText)
    );
    element.setAttribute('download', filename);

    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    toggleModal();
  };

  return (
    <div className="p-4">
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden">
            <div className="border-b px-6 py-4">
              <h2 className="text-xl font-medium text-gray-800">
                Customize CSV Export
              </h2>
            </div>

            <div className="px-6 py-4 space-y-6">
              <div>
                <label
                  htmlFor="delimiter-select"
                  className="block text-gray-700 mb-2"
                >
                  Select CSV column delimiter
                </label>
                <select
                  id="delimiter-select"
                  value={csvOptions.delimiter}
                  onChange={handleDelimiterChange}
                  className="w-full px-3 py-2 border rounded-md text-gray-700"
                >
                  <option value="comma">Comma</option>
                  <option value="semicolon">Semicolon</option>
                  <option value="tab">Tab</option>
                  <option value="space">Space</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-3">
                  Include Resource Details
                </label>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <div
                      className={`w-6 h-6 rounded-full border cursor-pointer ${csvOptions.resourceDetails === 'all' ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`}
                      onClick={() => handleResourceDetailsChange('all')}
                    >
                      {csvOptions.resourceDetails === 'all' && (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-4 h-4 bg-white rounded-full" />
                        </div>
                      )}
                    </div>
                    <span className="ml-3 text-gray-700 flex-1">
                      Include all resources
                    </span>
                  </div>

                  <div className="flex items-center">
                    <div
                      className={`w-6 h-6 rounded-full border cursor-pointer ${csvOptions.resourceDetails === 'failed' ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`}
                      onClick={() => handleResourceDetailsChange('failed')}
                    >
                      {csvOptions.resourceDetails === 'failed' && (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-4 h-4 bg-white rounded-full" />
                        </div>
                      )}
                    </div>
                    <span className="ml-3 text-gray-700 flex-1">
                      Include failed resources only
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 bg-gray-50">
              <Button variant="outline" onClick={toggleModal}>
                Cancel
              </Button>
              <Button onClick={() => handleExport(csvOptions)}>
                Export to CSV
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PDFReport = (props) => {
  const extractTextFromReactElement = (element) => {
    if (!element) return '';

    if (typeof element === 'string') return element;

    if (element && element.props && element.props.children) {
      const children = element.props.children;

      if (Array.isArray(children)) {
        return children
          .map((child) => {
            if (typeof child === 'string') return child;

            if (child && typeof child === 'object') {
              if (child.type === 'ul' || child.type === 'ol') {
                return Array.isArray(child.props.children)
                  ? child.props.children
                      .map((li) => `- ${extractTextFromReactElement(li)}`)
                      .join('\n')
                  : '';
              }

              if (child.type === 'br') return '\n';

              return extractTextFromReactElement(child);
            }

            return '';
          })
          .join('');
      }

      return typeof children === 'string'
        ? children
        : extractTextFromReactElement(children);
    }

    return '';
  };

  const formatText = (element) => {
    const text = extractTextFromReactElement(element);

    if (!text) {
      return [<Text key="empty">No description available</Text>];
    }

    const paragraphs = text.split('\n').filter((p) => p.trim());

    return paragraphs.map((paragraph, index) => {
      const segments = [];
      let segmentIndex = 0;

      let processedText = paragraph.replace(
        /(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\[.*?\]\(.*?\))/g,
        (match) => {
          segments.push(match);
          return `[[SEGMENT${segmentIndex++}]]`;
        }
      );

      const isBullet = paragraph.trim().startsWith('- ');
      if (isBullet) {
        processedText = `  • ${processedText.substring(2)}`;
      }

      const parts = processedText.split(/(\[\[SEGMENT\d+\]\])/);

      return (
        <Text
          key={index}
          style={[
            styles.faqAnswerText,
            isBullet && styles.bulletPoint,
            { marginBottom: 8 },
          ]}
        >
          {parts.map((part, partIndex) => {
            const segmentMatch = part.match(/\[\[SEGMENT(\d+)\]\]/);
            if (!segmentMatch) return part;

            const segment = segments[parseInt(segmentMatch[1])];

            if (segment.startsWith('***') || segment.startsWith('**')) {
              const boldText = segment.replace(/\*\*\*?(.*?)\*\*\*?/g, '$1');
              return (
                <Text key={partIndex} style={{ fontWeight: 'bold' }}>
                  {boldText}
                </Text>
              );
            }

            if (segment.startsWith('[')) {
              const linkMatch = segment.match(/\[(.*?)\]\((.*?)\)/);
              if (linkMatch) {
                return (
                  <Link key={partIndex} src={linkMatch[2]} style={styles.link}>
                    {linkMatch[1]}
                  </Link>
                );
              }
            }

            return part;
          })}
        </Text>
      );
    });
  };

  const getPriorityStyle = (priority) => {
    if (priority === 'critical') {
      return styles.buttonCritical;
    } else if (priority === 'high') {
      return styles.buttonHigh;
    } else if (priority === 'medium') {
      return styles.buttonMedium;
    } else if (priority === 'low') {
      return styles.buttonLow;
    } else return styles.buttonMedium;
  };

  return (
    <Document>
      <Page size="A4" style={styles.body} wrap>
        <View style={styles.logoContainer}>
          <PdfImage
            src={LOGO}
            style={{
              ...styles.logoImage,
              width: 'auto',
              height: 'auto',
            }}
          />
        </View>

        <View style={styles.container}>
          <View style={styles.headerContainer}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>({props.categoryTitle})</Text>
            </View>
          </View>

          <View style={styles.summarySection}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryHeader}>Controls Passed</Text>
              <Text style={[styles.summaryContent, styles.passed]}>
                {props.summary?.controlsPassed || 0}/
                {props.summary?.totalControls || 0}
              </Text>
              <View style={styles.scoreBarWrapper}>
                <View
                  style={[
                    styles.scoreBarContainer,
                    { backgroundColor: '#ffffff' },
                  ]}
                >
                  <View
                    style={[
                      styles.scoreBar,
                      getProgressBarStyle(
                        props.summary?.controlsPassedPercentage || 0
                      ),
                      {
                        width: `${
                          props.summary?.controlsPassedPercentage || 0
                        }%`,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.scorePercentage,
                    getPercentageTextStyle(
                      props.summary?.controlsPassedPercentage || 0
                    ),
                  ]}
                >
                  {props.summary?.controlsPassedPercentage || 0}%
                </Text>
              </View>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryHeader}>Rules Passed</Text>
              <Text style={[styles.summaryContent, styles.passed]}>
                {props.summary?.rulesPassed || 0}/
                {props.summary?.totalRules || 0}
              </Text>
              <View style={styles.scoreBarWrapper}>
                <View
                  style={[
                    styles.scoreBarContainer,
                    { backgroundColor: '#ffffff' },
                  ]}
                >
                  <View
                    style={[
                      styles.scoreBar,
                      getProgressBarStyle(
                        props.summary?.rulesPassedPercentage || 0
                      ),
                      {
                        width: `${props.summary?.rulesPassedPercentage || 0}%`,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.scorePercentage,
                    getPercentageTextStyle(
                      props.summary?.rulesPassedPercentage || 0
                    ),
                  ]}
                >
                  {props.summary?.rulesPassedPercentage || 0}%
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section} break>
          {Object.keys(props.data)
            .filter((control) =>
              control.toLowerCase().includes(props.searchValue.toLowerCase())
            )
            .map((control, index) => (
              <View style={styles.recommendationSection} key={index}>
                <View style={styles.criticalBox}>
                  <View style={styles.infoBox}>
                    <Text style={styles.criticalText}>{control}</Text>
                  </View>
                  <View style={styles.buttonContainer}>
                    {props.data[control].results.filter(
                      (result) => result.result.failed.length > 0
                    ).length > 0 ? (
                      <View style={[styles.button, styles.buttonCritical]}>
                        <Text style={styles.buttonText}>Failed</Text>
                      </View>
                    ) : (
                      <View style={[styles.button, styles.buttonLow]}>
                        <Text style={styles.buttonText}>Passed</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.controlDesc}>
                  <Text style={styles.desTitle}>Control Description</Text>
                  {formatText(props.data[control].description)}
                </View>

                {props.data[control].results.length > 0 && (
                  <View>
                    <Text style={styles.desTitle}>
                      {'AWS'} Assessment Checks
                    </Text>
                    {props.data[control].results.map((result, i) => (
                      <View key={i} style={styles.checkItemContainer}>
                        <View style={styles.checkHeader}>
                          <View
                            style={[
                              styles.button,
                              getPriorityStyle(getPriority(result)),
                              styles.severityButton,
                            ]}
                          >
                            <Text style={styles.buttonText}>
                              {getPriority(result)}
                            </Text>
                          </View>
                          <Text style={styles.checkTitle}>{result.title}</Text>
                        </View>

                        <View style={styles.checkDetails}>
                          <View style={styles.resource}>
                            {result.service &&
                              result.service.map((svc, idx) => (
                                <View style={styles.button} key={idx}>
                                  <Text style={styles.buttonText}>{svc}</Text>
                                </View>
                              ))}
                          </View>

                          <View style={styles.resource}>
                            {result.result.passed.length > 0 && (
                              <View style={[styles.button, styles.buttonLow]}>
                                <Text style={styles.buttonText}>
                                  Passed: {result.result.passed.length}
                                </Text>
                              </View>
                            )}
                            {result.result.failed.length > 0 && (
                              <View
                                style={[styles.button, styles.buttonCritical]}
                              >
                                <Text style={styles.buttonText}>
                                  Failed: {result.result.failed.length}
                                </Text>
                              </View>
                            )}

                            {result.result.passed.length === 0 &&
                              result.result.failed.length === 0 && (
                                <View style={[styles.button, styles.buttonNA]}>
                                  <Text style={styles.buttonText}>
                                    Not Applicable
                                  </Text>
                                </View>
                              )}
                          </View>
                        </View>

                        {result.result.failed.length > 0 && (
                          <View style={styles.linkContainer}>
                            <Link
                              src={`#resource-${result.id}`}
                              style={styles.descriptionText}
                            >
                              Click here to see Affected Resources
                            </Link>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
        </View>
        {props.includeRules && (
          <View style={styles.section} break>
            <Text style={styles.affectedHeader}>Affected Resources</Text>
            {sortResultsByFailedFirst(props.results).map(
              (result, resultIndex) => (
                <View
                  key={resultIndex}
                  id={`resource-${result.id}`}
                  style={styles.resourceContainer}
                >
                  <View style={styles.resourceHeader}>
                    <Text style={styles.resourceTitle}>{result.title}</Text>
                  </View>

                  <View style={styles.resourceRow}>
                    <Text
                      style={[
                        styles.resourceColumn,
                        styles.resourceTableHeader,
                      ]}
                    >
                      Resource
                    </Text>
                    <Text
                      style={[
                        styles.resourceColumn,
                        styles.resourceTableHeader,
                      ]}
                    >
                      Region
                    </Text>
                    <Text
                      style={[
                        styles.resourceColumn,
                        styles.resourceTableHeader,
                      ]}
                    >
                      Resource Type
                    </Text>
                    <Text
                      style={[
                        styles.resourceColumn,
                        styles.resourceTableHeader,
                      ]}
                    >
                      Status
                    </Text>
                  </View>
                  {result.result.failed.map((resource, resourceIndex) => (
                    <View
                      style={styles.resourceRow}
                      key={resourceIndex}
                      wrap={false}
                    >
                      <Text style={styles.resourceColumn}>
                        {resource.displayName || resource.resourceType}
                      </Text>
                      <Text style={styles.resourceColumn}>
                        {resource.region || 'N/A'}
                      </Text>
                      <Text style={styles.resourceColumn}>
                        {resource.resourceType}
                      </Text>
                      <Text style={[styles.resourceColumn, styles.failed]}>
                        Failed
                      </Text>
                    </View>
                  ))}
                </View>
              )
            )}
          </View>
        )}

        <View style={styles.logoContainerFooter} fixed>
          <PdfImage
            src={LOGO}
            style={{ maxWidth: 120, maxHeight: 80, height: 20 }}
          />
        </View>
      </Page>
    </Document>
  );
};

const getProgressBarStyle = (score) => {
  if (score >= 80) {
    return styles.progressSuccess;
  } else if (score >= 50) {
    return styles.progressWarning;
  } else {
    return styles.progressError;
  }
};

const getPercentageTextStyle = (score) => {
  if (score >= 80) {
    return styles.percentageSuccess;
  } else if (score >= 50) {
    return styles.percentageWarning;
  } else {
    return styles.percentageError;
  }
};

Font.register({
  family: 'Open Sans',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/open-sans-all@0.1.3/fonts/open-sans-regular.ttf',
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/open-sans-all@0.1.3/fonts/open-sans-600.ttf',
      fontWeight: 600,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/open-sans-all@0.1.3/fonts/open-sans-700.ttf',
      fontWeight: 700,
    },
  ],
});

const styles = StyleSheet.create({
  body: {
    paddingTop: 35,
    paddingBottom: 65,
    flexDirection: 'column',
    fontFamily: 'Open Sans',
  },
  logoImage: {
    maxWidth: 200,
    marginHorizontal: 120,
    maxHeight: 120,
  },
  logoContainer: {
    backgroundColor: '#f7f7f7',
    padding: 20,
    textAlign: 'center',
    marginTop: -35,
    marginHorizontal: -35,
    marginBottom: 20,
    alignItems: 'center',
    display: 'flex',
  },
  logoContainerFooter: {
    position: 'absolute',
    fontSize: 12,
    bottom: 30,
    right: 30,
    textAlign: 'center',
    color: 'grey',
  },
  header: {
    textAlign: 'center',
    marginBottom: 20,
  },
  checksSubTitle: {
    fontSize: 11,
    paddingLeft: 12,
    color: 'rgba(0,0,0,.4)',
  },
  image: { width: 14 },
  container: {
    padding: 10,
    marginHorizontal: 10,
  },
  controlDesc: {
    marginTop: 10,
    marginBottom: 10,
  },
  wrapper: {
    padding: 10,
    borderStyle: 'solid',
    borderColor: '#bfbfbf',
    borderBottomWidth: 1,
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  desTitle: {
    fontSize: 12,
    fontWeight: 'semibold',
    fontFamily: 'Open Sans',
    marginBottom: 6,
  },
  desPara: {
    fontSize: 12,
    color: '#555555',
  },
  domainContainer: {
    marginTop: 10,
  },
  domainTitle: {
    fontSize: 18,
    textDecoration: 'underline',
    textAlign: 'center',
  },
  singleDomainWrapper: {
    marginTop: 10,
    paddingBottom: 5,
    borderColor: '#bfbfbf',
    borderBottomWidth: 1,
    padding: 5,
    marginBottom: 5,
  },
  negative: {
    backgroundColor: '#fff6f6',
    color: '#9f3a38',
  },
  positive: {
    backgroundColor: '#fcfff5',
    color: '#2c662d',
  },
  domainWrapper: {
    borderStyle: 'solid',
    borderColor: '#bfbfbf',
    borderWidth: 1,
    padding: '10',
    marginBottom: '10',
  },
  failedBoxes: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '5',
  },
  failedBoxGreen: {
    fontSize: 14,
    borderStyle: 'solid',
    borderColor: '#21ba45',
    borderWidth: 1,
    padding: '2 5',
    marginRight: '5',
    color: '#2c662d',
  },
  failedBoxRed: {
    fontSize: 14,
    borderStyle: 'solid',
    borderColor: '#db2828',
    borderWidth: 1,
    padding: '2 5',
    marginRight: '5',
    color: '#9f3a38',
  },
  priorityText: {
    fontSize: 12,
    textAlign: 'justify',
    color: '#fff',
    padding: '5 10',
    borderRadius: 5,
  },
  categoryText: {
    fontSize: 11,
    lineHeight: 1,
    textAlign: 'justify',
    marginLeft: 10,
    color: '#2185d0',
    borderStyle: 'solid',
    borderColor: '#2185d0',
    borderWidth: 1,
    padding: '2 5',
  },
  table: {
    display: 'table',
    width: '100%',
    borderStyle: 'solid',
    borderColor: '#bfbfbf',
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    marginTop: 10,
    marginBottom: 30,
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
  },
  tableColHeaderFirst: {
    width: '50%',
    borderStyle: 'solid',
    borderColor: '#bfbfbf',
    borderBottomColor: '#000',
    borderWidth: 1,
    borderLeftWidth: 1,
    borderTopWidth: 0,
    padding: '10',
    flexWrap: 'wrap',
  },

  tableColHeader: {
    width: '25%',
    borderStyle: 'solid',
    borderColor: '#bfbfbf',
    borderBottomColor: '#000',
    borderWidth: 1,
    borderLeftWidth: 1,
    borderTopWidth: 0,
    padding: '10',
    flexWrap: 'wrap',
  },
  tableColFirst: {
    width: '50%',
    padding: '10',
    borderStyle: 'solid',
    borderColor: '#bfbfbf',
    borderWidth: 1,
    borderLeftWidth: 1,
    borderTopWidth: 0,
    flexWrap: 'wrap',
    display: 'flex',
    flexDirection: 'row',
    overflowWrap: 'break-word',
  },
  tableCol: {
    width: '25%',
    padding: '10',
    borderStyle: 'solid',
    borderColor: '#bfbfbf',
    borderWidth: 1,
    borderLeftWidth: 1,
    borderTopWidth: 0,
    flexWrap: 'wrap',
    display: 'flex',
    flexDirection: 'row',
    overflowWrap: 'break-word',
  },
  tableCellHeader: {
    fontSize: 10,
    textAlign: 'left',
  },
  tableCell: {
    fontSize: 8,
    flexWrap: 'wrap',
    display: 'flex',
    flexDirection: 'row',
    overflowWrap: 'break-word',
    flexGrow: 1,
    textOverflow: 'ellipsis',
  },
  resourceWrapper: { marginTop: 5 },
  titleContainer: {
    width: '100%',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: 10,
  },
  summarySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    marginTop: 10,
  },
  summaryItem: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
  },
  summaryHeader: {
    fontSize: 12,
    color: '#525252',
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryContent: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  totalScore: {
    color: '#007CD6',
  },
  scoreBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  scoreBarContainer: {
    flexGrow: 1,
    backgroundColor: '#F7F8F8',
    borderRadius: 5,
    height: 10,
    marginRight: 5,
  },
  scoreBar: {
    height: 20,
    backgroundColor: '#FF474766',
    borderRadius: 5,
  },
  progressSuccess: {
    backgroundColor: '#f5f9ee',
  },
  progressWarning: {
    backgroundColor: '#fbeee5',
  },
  progressError: {
    backgroundColor: '#fbe5e9',
  },
  scorePercentage: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FF474766',
  },
  resourceDescription: {
    fontSize: 11,
    color: '#bfbfbf',
  },
  chartContainer: {
    textAlign: 'center',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 30,
  },
  chartImageContainer: {
    marginTop: 30,
    textAlign: 'center',
  },
  chartImage: { width: 200, marginHorizontal: 20 },
  chartTitle: {
    fontSize: 12,
    color: '#555555',
    textAlign: 'center',
    marginBottom: 20,
    marginHorizontal: 20,
    width: 200,
  },

  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7E8',
  },

  buttonNA: {
    backgroundColor: '#E9ECEF',
    borderColor: '#8A8A8A',
    color: '#8A8A8A',
  },

  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    color: '#000000',
    gap: 5,
  },
  button: {
    backgroundColor: '#ffffff',
    padding: 4,
    marginRight: 4,
    marginLeft: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7E8',
  },
  buttonText: {
    fontSize: 12,
    textAlign: 'center',
  },
  buttonCritical: {
    backgroundColor: '#FFEDED',
    borderColor: '#FF4747',
    color: '#FF4747',
  },
  buttonHigh: {
    backgroundColor: '#fbeee5',
    color: '#d65a00',
    borderColor: '#d65a00',
  },
  buttonMedium: {
    backgroundColor: '#f4e5fb',
    color: '#9200d6',
    borderColor: '#9200d6',
  },
  buttonLow: {
    backgroundColor: '#eaf4dd',
    color: '#69ae09',
    borderColor: '#69ae09',
  },
  checkItemContainer: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7E8',
  },
  checkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkTitle: {
    fontSize: 12,
    color: '#1F2C35',
    flex: 1,
  },
  checkStatusContainer: {
    marginRight: 8,
  },
  checkDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  severityButton: {
    marginRight: 8,
  },
  criticalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    color: '#000000',
  },
  infoBox: {
    width: '70%',
  },
  criticalText: {
    fontSize: 14,
    fontWeight: 'semibold',
    fontFamily: 'Open Sans',
  },
  recommendationSection: {
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 20,
    backgroundColor: '#F7F8F8',
  },
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#E5E7E8',
  },
  resource: {
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 10,
  },
  headerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: -20,
  },
  title: {
    fontSize: 18,
    color: '#09111B',
    fontWeight: 'bold',
    fontFamily: 'Open Sans',
    textAlign: 'center',
  },
  resourceContainer: {
    padding: 10,
    marginTop: 10,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#E5E7E8',
    borderRadius: 8,
    backgroundColor: '#F7F8F8',
    overflow: 'hidden',
    marginBottom: 16,
  },
  resultResourceContainer: {
    marginTop: 15,
    marginBottom: 10,
  },
  resourceHeader: {
    marginBottom: 10,
  },
  resourceTitle: {
    fontWeight: 'semibold',
    fontFamily: 'Open Sans',
    fontSize: 14,
  },
  resourceSubtitle: {
    fontSize: 12,
    fontWeight: 'semibold',
    fontFamily: 'Open Sans',
    marginBottom: 8,
  },
  resourceTableContainer: {
    marginTop: 15,
    marginBottom: 10,
  },
  resourceTableTitle: {
    fontSize: 12,
    fontWeight: 'semibold',
    fontFamily: 'Open Sans',
    marginBottom: 8,
  },
  resourceRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  resourceTableHeader: {
    fontSize: 12,
    color: '#1F2C35',
    fontWeight: 'normal',
  },
  resourceColumn: {
    flex: 1,
    padding: 6,
    backgroundColor: '#ffffff',
    fontSize: 12,
    fontWeight: 'semibold',
    color: '#1F2C35',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#E5E7E8',
    flexWrap: 'wrap',
    wordWrap: 'break-word',
  },
  passed: {
    fontWeight: 'semibold',
    fontFamily: 'Open Sans',
    color: '#000000',
  },
  failed: {
    fontWeight: 'semibold',
    fontFamily: 'Open Sans',
    color: '#FF4747',
  },
  affectedHeader: {
    fontSize: 18,
    marginVertical: 20,
    fontWeight: 'bold',
    fontFamily: 'Open Sans',
  },
  descriptionText: {
    marginTop: 5,
    fontSize: 12,
    color: '#005C9E',
    textAlign: 'right',
  },
  faqAnswer: {
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 1.5,
    color: '#555',
  },
  faqAnswerText: {
    fontSize: 12,
    color: '#555',
    lineHeight: 1.5,
  },
  paragraph: {
    marginBottom: 8,
  },
  bulletPoint: {
    paddingLeft: 10,
  },
  link: {
    color: '#2196F3',
    textDecoration: 'underline',
  },
});
