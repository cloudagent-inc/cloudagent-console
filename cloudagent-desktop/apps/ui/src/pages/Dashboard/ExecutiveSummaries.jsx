import React, { useMemo, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Cloud,
  Layers,
  FileText,
  RefreshCw,
  Loader2,
  ChevronRight,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Input } from '@/components/ui/input';
import { Icons } from '@/components/icons';
import {
  ExecutiveSummaryModal,
  parseSummary,
} from '@/components/ExecutiveSummary';
import {
  ensureExecutiveSummary,
  selectExecutiveSummaryRequestsByKey,
  selectExecutiveSummariesByKey,
} from '@/features/operations/operationsSlice';
import { isSupportedExecutiveSummaryEnvironmentType } from '@/helpers/shared';
import {
  matchesEnvironmentProfile,
  matchesWorkload,
  selectActiveWorkspaceScope,
} from '@/features/workspace/workspaceScope';
import {
  isSystemWorkload,
  resolveWorkloadEnvironmentRef,
} from '@/features/workload/workloadEnvironmentUtils';

const formatSummaryDate = (dateString) => {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  } catch {
    return null;
  }
};

const inferWorkloadProvider = (workload, environmentRefs = []) => {
  if (workload?.cloudProvider) return workload.cloudProvider;

  const environmentTypes = environmentRefs.map((environment) =>
    String(environment?.type || '').toLowerCase()
  );
  if (environmentTypes.some((type) => type.includes('azure'))) return 'azure';
  if (environmentTypes.some((type) => type.includes('google'))) return 'google_workspace';
  if (environmentTypes.some((type) => type.includes('gcp'))) return 'gcp';

  const trackedResources =
    typeof workload?.trackedResources === 'string'
      ? (() => {
          try {
            return JSON.parse(workload.trackedResources);
          } catch {
            return {};
          }
        })()
      : workload?.trackedResources || {};
  const resources = Array.isArray(trackedResources?.resources)
    ? trackedResources.resources
    : [];
  if (
    resources.some((resource) => {
      const resourceType = String(resource?.resourceType || resource?.type || '').toLowerCase();
      const resourceId = String(resource?.resourceId || resource?.identifier || '').toLowerCase();
      return resourceType.startsWith('microsoft.') || resourceId.startsWith('/subscriptions/');
    })
  ) {
    return 'azure';
  }

  return 'aws';
};

export default function ExecutiveSummariesPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { userProfile, userProfileLoading } = useSelector((state) => state.auth);
  const executiveSummaryRequestRecords = useSelector(selectExecutiveSummaryRequestsByKey);
  const executiveSummaryRecordsByKey = useSelector(selectExecutiveSummariesByKey);
  const activeWorkspaceScope = useSelector(selectActiveWorkspaceScope);
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Get cloud environments (permission profiles)
  const cloudEnvironments = useMemo(() => {
    const profiles = userProfile?.agentPermissionProfiles || [];
    return profiles
      .filter((profile) => isSupportedExecutiveSummaryEnvironmentType(profile?.type))
      .filter((profile) => matchesEnvironmentProfile(profile, activeWorkspaceScope))
      .map((profile) => {
        const summaryRecord = executiveSummaryRecordsByKey?.[`environment:${profile.recordId}`];
        const summary = summaryRecord?.summary || parseSummary(profile.summary);
        const summaryUpdatedAt = summary?.updatedAt || summaryRecord?.updatedAt;
        return {
          ...profile,
          id: profile.recordId,
          summary,
          hasSummary: !!summary?.summaryText,
          summaryUpdatedAt,
        };
      });
  }, [activeWorkspaceScope, executiveSummaryRecordsByKey, userProfile]);

  // Get workloads
  const workloads = useMemo(() => {
    const permissionProfiles = userProfile?.agentPermissionProfiles || [];
    const workloadList = (userProfile?.workloads || [])
      .filter((workload) => !isSystemWorkload(workload))
      .filter((workload) => matchesWorkload(workload, activeWorkspaceScope));
    return workloadList.map((workload) => {
      const summaryRecord = executiveSummaryRecordsByKey?.[`workload:${workload.workloadId}`];
      const summary = summaryRecord?.summary || parseSummary(workload.summary);
      const summaryUpdatedAt = summary?.updatedAt || summaryRecord?.updatedAt;
      const environmentRefs = (Array.isArray(workload.environments) ? workload.environments : [])
        .map((environment) => resolveWorkloadEnvironmentRef(environment, permissionProfiles))
        .filter(Boolean);
      return {
        ...workload,
        id: workload.workloadId,
        provider: inferWorkloadProvider(workload, environmentRefs),
        summary,
        hasSummary: !!summary?.summaryText,
        summaryUpdatedAt,
      };
    });
  }, [activeWorkspaceScope, executiveSummaryRecordsByKey, userProfile]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const matchesSearch = useCallback(
    (...values) => {
      if (!normalizedSearchQuery) return true;
      return values
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearchQuery));
    },
    [normalizedSearchQuery]
  );

  const filteredCloudEnvironments = useMemo(
    () =>
      cloudEnvironments.filter((env) =>
        matchesSearch(
          env.name,
          env.description,
          env.type,
          env.id,
          env.summary?.summaryText
        )
      ),
    [cloudEnvironments, matchesSearch]
  );

  const filteredWorkloads = useMemo(
    () =>
      workloads.filter((workload) =>
        matchesSearch(
          workload.workloadName,
          workload.description,
          workload.provider,
          workload.id,
          workload.summary?.summaryText
        )
      ),
    [matchesSearch, workloads]
  );

  const handleOpenModal = (item, type) => {
    setSelectedItem(item);
    setSelectedType(type);
    setModalOpen(true);
  };

  const handleGenerateSummary = async (item, type) => {
    const itemId = type === 'workload' ? item.workloadId : item.recordId;
    
    try {
      const action = await dispatch(
        ensureExecutiveSummary({
          type,
          id: itemId,
          item,
          forceRefresh: true,
        })
      );

      if (!ensureExecutiveSummary.fulfilled.match(action)) {
        throw new Error(
          action.payload || action.error?.message || 'Failed to generate executive summary'
        );
      }

      toast.success('Executive summary generated successfully!');
    } catch (error) {
      console.error('Failed to generate executive summary:', error);
      toast.error(error.message || 'Failed to generate executive summary');
    }
  };

  const handleViewWorkload = (workloadId) => {
    navigate(`/dashboard/workloads/${workloadId}`);
  };

  const getEnvironmentIcon = (type) => {
    const normalizedType = String(type || '').trim().toLowerCase().replace(/_/g, ' ');
    switch (normalizedType) {
      case 'aws account':
      case 'aws':
        return <Icons.aws className="h-5 w-5 flex-shrink-0" />;
      case 'azure tenant':
      case 'azure subscription':
      case 'azure':
        return <Icons.azure className="h-5 w-5 flex-shrink-0" />;
      case 'gcp':
      case 'google cloud':
        return <Icons.gcp className="h-5 w-5 flex-shrink-0" />;
      case 'google workspace':
      case 'google_workspace':
        return <Icons.googleWorkspace className="h-5 w-5 flex-shrink-0" />;
      default:
        return <Cloud className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Executive Summaries</h1>
        <p className="text-sm text-gray-600 mt-1">
          View and generate executive summaries for your cloud environments and workloads.
        </p>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search workloads or cloud environments"
          className="pl-10"
        />
      </div>

      {/* Cloud Environments Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary-600" />
            Cloud Environments
          </CardTitle>
          <CardDescription>
            Executive summaries for your connected cloud accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userProfileLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : filteredCloudEnvironments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Cloud className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">
                {searchQuery ? 'No matching cloud environments' : 'No cloud environments connected'}
              </p>
              <p className="text-sm mt-1">
                {searchQuery
                  ? 'Try a different search term.'
                  : 'Connect a cloud account in Setup to get started.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredCloudEnvironments.map((env) => (
                <div
                  key={env.id}
                  className="flex items-center gap-4 py-3 px-2 hover:bg-gray-50 transition-colors rounded-lg group"
                >
                  <div className="flex-shrink-0">
                    {getEnvironmentIcon(env.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 truncate" title={env.name}>
                        {env.name || 'Unnamed Environment'}
                      </h3>
                      {env.hasSummary && formatSummaryDate(env.summaryUpdatedAt) && (
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatSummaryDate(env.summaryUpdatedAt)}
                        </span>
                      )}
                    </div>
                    {env.hasSummary ? (
                      <p className="text-sm text-gray-600 line-clamp-1 mt-0.5">
                        {env.summary?.summaryText?.replace(/[#*_`]/g, '').substring(0, 150) || ''}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 italic mt-0.5">
                        No summary available
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleOpenModal(env, 'environment')}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button
                      variant={env.hasSummary ? 'ghost' : 'default'}
                      size="sm"
                      className="text-xs"
                      onClick={() => handleGenerateSummary(env, 'environment')}
                      disabled={
                        executiveSummaryRequestRecords?.[`environment:${env.id}`]?.status ===
                        'loading'
                      }
                    >
                      {executiveSummaryRequestRecords?.[`environment:${env.id}`]?.status ===
                      'loading' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workloads Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary-600" />
            Workloads
          </CardTitle>
          <CardDescription>
            Executive summaries for your defined workloads
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userProfileLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : filteredWorkloads.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Layers className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">
                {searchQuery ? 'No matching workloads' : 'No workloads defined'}
              </p>
              <p className="text-sm mt-1">
                {searchQuery
                  ? 'Try a different search term.'
                  : 'Create a workload to organize your resources.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredWorkloads.map((workload) => (
                <div
                  key={workload.id}
                  className="flex items-center gap-4 py-3 px-2 hover:bg-gray-50 transition-colors rounded-lg group"
                >
                  <div className="flex-shrink-0">
                    {getEnvironmentIcon(workload.provider)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 truncate" title={workload.workloadName}>
                        {workload.workloadName || 'Unnamed Workload'}
                      </h3>
                      {workload.hasSummary && formatSummaryDate(workload.summaryUpdatedAt) && (
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatSummaryDate(workload.summaryUpdatedAt)}
                        </span>
                      )}
                    </div>
                    {workload.hasSummary ? (
                      <p className="text-sm text-gray-600 line-clamp-1 mt-0.5">
                        {workload.summary?.summaryText?.replace(/[#*_`]/g, '').substring(0, 150) || ''}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 italic mt-0.5">
                        No summary available
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleOpenModal(workload, 'workload')}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleViewWorkload(workload.id)}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                    <Button
                      variant={workload.hasSummary ? 'ghost' : 'default'}
                      size="sm"
                      className="text-xs"
                      onClick={() => handleGenerateSummary(workload, 'workload')}
                      disabled={
                        executiveSummaryRequestRecords?.[`workload:${workload.id}`]?.status ===
                        'loading'
                      }
                    >
                      {executiveSummaryRequestRecords?.[`workload:${workload.id}`]?.status ===
                      'loading' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Executive Summary Modal */}
      {selectedItem && (
        <ExecutiveSummaryModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          item={selectedItem}
          summary={selectedItem.summary}
          accountScans={userProfile?.reportHistory || []}
          recommendations={userProfile?.recommendations?.recommendations || []}
          type={selectedType}
        />
      )}
    </div>
  );
}
