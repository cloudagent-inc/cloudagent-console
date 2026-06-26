import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Search,
  GitBranch,
  Plus,
  Play,
  Edit3,
  Loader2,
  FileText,
  Trash2,
  Calendar,
  DollarSign,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import DeleteModal from '../../components/DeleteModal';
import {
  fetchBlueprints,
  deleteBlueprint,
  clearError,
} from '../../features/blueprint/blueprintSlice';
import MyAgents from './MyAgent';
import { fetchAgentList } from '@/helpers/agentList';
import { Icons } from '../../components/icons';
import { isLocalRuntime } from '../../runtime/cloudAgentRuntime';

const getDashboardBlueprintTab = (pathname = '') => {
  if (pathname.includes('/dashboard/blueprints/library')) return 'library';
  if (pathname.includes('/dashboard/agents')) return 'agents';
  if (pathname.includes('/dashboard/blueprints')) return 'blueprints';
  return 'agents';
};

const normalizeDescriptionText = (description) => {
  if (Array.isArray(description)) {
    return description.filter(Boolean).join(' ');
  }

  if (typeof description === 'string') {
    const trimmed = description.trim();
    if (!trimmed) return '';

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean).join(' ');
      }
    } catch {
      // fall through
    }

    return trimmed;
  }

  return '';
};

const normalizeCloudProvider = (value) => {
  const normalized = String(value || 'aws').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized) return 'aws';
  if (normalized === 'google' || normalized === 'google_cloud') return 'gcp';
  if (normalized === 'gws' || normalized === 'google_workspace') return 'google_workspace';
  if (normalized.includes('azure')) return 'azure';
  if (normalized.includes('gcp')) return 'gcp';
  if (normalized.includes('aws') || normalized.includes('amazon')) return 'aws';
  return normalized;
};

const getBlueprintCloudProvider = (blueprint) => {
  try {
    const planData =
      typeof blueprint?.plan === 'string'
        ? JSON.parse(blueprint.plan)
        : blueprint?.plan;

    return normalizeCloudProvider(
      blueprint?.cloudProvider ||
        planData?.cloudProvider ||
        planData?.plan?.[0]?.cloudProvider ||
        planData?.plan?.[0]?.tasks?.[0]?.cloudProvider ||
        planData?.tasks?.[0]?.cloudProvider ||
        'aws'
    );
  } catch {
    return normalizeCloudProvider(blueprint?.cloudProvider || 'aws');
  }
};

const getCloudProviderLabel = (cloudProvider) => {
  switch (normalizeCloudProvider(cloudProvider)) {
    case 'azure':
      return 'Azure';
    case 'gcp':
      return 'Google Cloud';
    case 'google_workspace':
      return 'Google Workspace';
    case 'aws':
    default:
      return 'AWS';
  }
};

const CloudProviderIcon = ({ cloudProvider }) => {
  const normalizedProvider = normalizeCloudProvider(cloudProvider);
  const label = getCloudProviderLabel(normalizedProvider);
  const iconClassName = 'h-5 w-5';

  const icon =
    normalizedProvider === 'azure' ? (
      <Icons.azure className={iconClassName} style={{ objectFit: 'contain' }} />
    ) : normalizedProvider === 'gcp' ? (
      <Icons.gcp className={iconClassName} style={{ objectFit: 'contain' }} />
    ) : normalizedProvider === 'google_workspace' ? (
      <Icons.googleWorkspace className={iconClassName} />
    ) : (
      <Icons.aws className={iconClassName} />
    );

  return (
    <div className="flex items-center justify-center" title={label} aria-label={label}>
      {icon}
    </div>
  );
};

const MyBlueprints = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [blueprintToDelete, setBlueprintToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [libraryBlueprints, setLibraryBlueprints] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState(null);

  const { userBlueprints, loading, error, hasMore, nextToken } = useSelector(
    (state) => state.blueprint
  );

  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() =>
    getDashboardBlueprintTab(location.pathname)
  );

  useEffect(() => {
    setActiveTab(getDashboardBlueprintTab(location.pathname));
  }, [location.pathname]);

  const loadCustomBlueprints = useCallback(() => {
    dispatch(fetchBlueprints({ count: 50 }));
  }, [dispatch]);

  const loadLibraryBlueprints = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError(null);

    try {
      const response = await fetchAgentList();
      if (!response.ok) {
        throw new Error(
          `Failed to load library blueprints (${response.status} ${response.statusText})`
        );
      }

      const payload = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error('Library blueprint response was not an array.');
      }

      const libraryItems = payload
        .filter((blueprint) => blueprint?.active && blueprint?.type === 'agent')
        .map((blueprint) => ({
          id: blueprint.id,
          title: blueprint.title || 'Untitled Blueprint',
          description: normalizeDescriptionText(blueprint.description),
          category: blueprint.category || 'Uncategorized',
          credits: blueprint.credits || 0,
          cloudProvider: getBlueprintCloudProvider(blueprint),
        }))
        .filter((blueprint) => blueprint.id);

      const deduped = Array.from(
        libraryItems.reduce((accumulator, blueprint) => {
          if (!accumulator.has(blueprint.id)) {
            accumulator.set(blueprint.id, blueprint);
          }
          return accumulator;
        }, new Map()).values()
      ).sort((a, b) => a.title.localeCompare(b.title));

      setLibraryBlueprints(deduped);
    } catch (fetchError) {
      console.error('Failed to load library blueprints:', fetchError);
      setLibraryError(
        fetchError?.message || 'Failed to load library blueprints.'
      );
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  const handleSortChange = useCallback(
    (newSortBy) => {
      let newSortOrder = 'desc';
      if (newSortBy === sortBy) {
        newSortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
      }

      setSortBy(newSortBy);
      setSortOrder(newSortOrder);
    },
    [sortBy, sortOrder]
  );

  const getSortIcon = (field) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortOrder === 'desc' ? (
      <ArrowDown className="h-4 w-4 text-primary-600" />
    ) : (
      <ArrowUp className="h-4 w-4 text-primary-600" />
    );
  };

  const filteredCustomBlueprints = useMemo(() => {
    let filtered = userBlueprints.filter(
      (blueprint) => {
        const normalizedQuery = searchQuery.toLowerCase();
        const descriptionText = normalizeDescriptionText(blueprint?.description);

        return (
          blueprint?.title?.toLowerCase().includes(normalizedQuery) ||
          descriptionText.toLowerCase().includes(normalizedQuery)
        );
      }
    );

    // Sort by updatedAt
    filtered.sort((a, b) => {
      if (sortBy === 'updatedAt') {
        const dateA = new Date(a.updatedAt || 0);
        const dateB = new Date(b.updatedAt || 0);
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      }

      const valueA = String(a?.[sortBy] || '').toLowerCase();
      const valueB = String(b?.[sortBy] || '').toLowerCase();
      return sortOrder === 'desc'
        ? valueB.localeCompare(valueA)
        : valueA.localeCompare(valueB);
    });

    return filtered;
  }, [userBlueprints, searchQuery, sortBy, sortOrder]);

  const filteredLibraryBlueprints = useMemo(() => {
    const normalizedQuery = searchQuery.toLowerCase().trim();
    const filtered = libraryBlueprints.filter((blueprint) => {
      if (!normalizedQuery) return true;

      return (
        blueprint.title.toLowerCase().includes(normalizedQuery) ||
        blueprint.description.toLowerCase().includes(normalizedQuery) ||
        blueprint.category.toLowerCase().includes(normalizedQuery) ||
        blueprint.id.toLowerCase().includes(normalizedQuery)
      );
    });

    return filtered.sort((a, b) => a.title.localeCompare(b.title));
  }, [libraryBlueprints, searchQuery]);

  useEffect(() => {
    loadCustomBlueprints();
    loadLibraryBlueprints();

    return () => {
      dispatch(clearError());
    };
  }, [dispatch, loadCustomBlueprints, loadLibraryBlueprints]);

  const handleEditBlueprint = (blueprint) => {
    navigate(
      isLocalRuntime()
        ? `/dashboard/library/blueprint/${blueprint.recordId}`
        : `/blueprint/${blueprint.recordId}`,
      {}
    );
  };

  const handleEditBlueprintDefinition = (blueprint) => {
    navigate(`/dashboard/blueprint/edit/${blueprint.recordId}`, {});
  };

  const handleDeleteBlueprint = async () => {
    if (blueprintToDelete) {
      setDeletingId(blueprintToDelete.recordId);
      try {
        await dispatch(deleteBlueprint(blueprintToDelete.recordId)).unwrap();
      } catch (error) {
        console.error('Failed to delete blueprint:', error);
      } finally {
        setDeletingId(null);
        setShowDeleteModal(false);
        setBlueprintToDelete(null);
      }
    }
  };

  const formatBlueprintStatus = (status) => {
    const normalized = (status || '').toLowerCase();
    if (!normalized) return 'Processing';
    if (normalized.includes('in_progress')) {
      if (normalized === 'in_progress_skeleton') return 'In Progress (Updating Tasks)';
      if (normalized === 'in_progress_tasks') return 'In Progress (Updating Settings)';
      return 'In Progress';
    }
    return status || 'Processing';
  };

  const formatUpdatedAt = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleRunLibraryBlueprint = useCallback(
    (blueprint) => {
      if (!blueprint?.id) return;
      navigate(`/dashboard/library/blueprint/${blueprint.id}`, {
        state: { fromDashboardLibrary: true },
      });
    },
    [navigate]
  );

  const handleRefresh = useCallback(() => {
    if (activeTab === 'library') {
      loadLibraryBlueprints();
      return;
    }

    loadCustomBlueprints();
  }, [activeTab, loadCustomBlueprints, loadLibraryBlueprints]);

  return (
    <div>
      <div className="bg-white rounded-lg p-6 mt-2">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex justify-between items-center">
            <nav className="flex space-x-8">
              <NavLink
                to="/dashboard/blueprints"
                onClick={() => setActiveTab('blueprints')}
                className={({ isActive }) =>
                  `py-3 px-2 border-b-2 font-semibold text-base transition-colors ${
                    activeTab === 'blueprints'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`
                }
              >
                My Blueprints
              </NavLink>
              <NavLink
                to="/dashboard/blueprints/library"
                onClick={() => setActiveTab('library')}
                className={() =>
                  `py-3 px-2 border-b-2 font-semibold text-base transition-colors ${
                    activeTab === 'library'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`
                }
              >
                Library Blueprints
              </NavLink>
              <NavLink
                to="/dashboard/agents"
                onClick={() => setActiveTab('agents')}
                className={({ isActive }) =>
                  `py-3 px-2 border-b-2 font-semibold text-base transition-colors ${
                    activeTab === 'agents'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`
                }
              >
                Agent Runs
              </NavLink>
            </nav>
            <div className="flex items-center gap-2">
              {/* <Button
                variant="outline"
                onClick={() => navigate('/libraries/cost_and_billing')}
              >
                <Play className="w-4 h-4 mr-1" />
                Run Blueprint
              </Button> */}
              <Button
                className="text-white"
                onClick={() => navigate('/dashboard/blueprintbuilder')}
              >
                <Plus className="w-4 h-4 mr-1" />
                Create Blueprint
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'agents' ? (
          <div className="mt-0">
            <MyAgents />
          </div>
        ) : (
          <>
            <div className="relative mt-4 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder={
                    activeTab === 'library'
                      ? 'Search Library Blueprints'
                      : 'Search Blueprints'
                  }
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={activeTab === 'library' ? libraryLoading : loading}
                title="Refresh blueprints list"
                className="h-10 w-10 p-0"
              >
                <RefreshCw
                  className={`w-4 h-4 ${
                    activeTab === 'library'
                      ? libraryLoading
                        ? 'animate-spin'
                        : ''
                      : loading
                        ? 'animate-spin'
                        : ''
                  }`}
                />
              </Button>
            </div>

            {(activeTab === 'library' ? libraryError : error) && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">
                  {activeTab === 'library' ? libraryError : error}
                </p>
              </div>
            )}

            <div className="rounded-xl border border-primary-100 overflow-hidden mt-4">
              {activeTab === 'library' ? (
                <Table className="border-collapse">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-[92px] text-center">Provider</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-center">Credits</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {libraryLoading && libraryBlueprints.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <div className="flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin mr-2" />
                            Loading library blueprints...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredLibraryBlueprints.length > 0 ? (
                      filteredLibraryBlueprints.map((blueprint) => (
                        <TableRow
                          key={blueprint.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {blueprint.title}
                              </div>
                              {blueprint.description && (
                                <div className="text-sm text-gray-500 mt-1 line-clamp-2">
                                  {blueprint.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <CloudProviderIcon cloudProvider={blueprint.cloudProvider} />
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {blueprint.category}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-medium">
                              {blueprint.credits}
                            </span>
                          </TableCell>
                          <TableCell className="text-right w-24">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                className="border-indigo-500 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200 rounded-md px-2 py-1 h-8 w-8 flex items-center justify-center shadow-sm"
                                onClick={() => handleRunLibraryBlueprint(blueprint)}
                                title="Open blueprint"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                className="border-gray-400 text-gray-600 hover:bg-gray-50 hover:text-gray-700 transition-all duration-200 rounded-md px-2 py-1 h-8 w-8 flex items-center justify-center shadow-sm"
                                onClick={() =>
                                  navigate(`/dashboard/blueprint/edit/library/${blueprint.id}`)
                                }
                                title="Edit and save as new"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-gray-500"
                        >
                          {searchQuery ? (
                            <>
                              <div className="text-lg font-medium">
                                No matching library blueprints found
                              </div>
                              <p className="mt-1">
                                Try a different search term or clear your search
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="text-lg font-medium">
                                No library blueprints available
                              </div>
                              <p className="mt-1">
                                Active library blueprints will appear here when available
                              </p>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              ) : (
                <Table className="border-collapse">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-[92px] text-center">Provider</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead
                        className="text-center cursor-pointer hover:bg-gray-50 select-none"
                        onClick={() => handleSortChange('updatedAt')}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Updated
                          {getSortIcon('updatedAt')}
                        </div>
                      </TableHead>
                      <TableHead className="text-center">Credits</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && userBlueprints.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <div className="flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin mr-2" />
                            Loading blueprints...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredCustomBlueprints.length > 0 ? (
                      filteredCustomBlueprints.map((blueprint) => (
                        <TableRow
                          key={blueprint.recordId}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <TableCell className="flex items-center gap-3">
                            <div>
                              <div className="font-medium">
                                {blueprint?.title || 'Untitled Blueprint'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <CloudProviderIcon cloudProvider={getBlueprintCloudProvider(blueprint)} />
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              {((blueprint?.status || '').toLowerCase() === 'ready') ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : ((blueprint?.status || '').toLowerCase() === 'error') ? (
                                <XCircle className="w-4 h-4 text-red-600" />
                              ) : (
                                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                              )}
                              <span className="font-medium capitalize">
                                {formatBlueprintStatus(blueprint?.status)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1 text-gray-600">
                              <Clock className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-sm">
                                {formatUpdatedAt(blueprint.updatedAt)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className="font-medium">
                                {blueprint.credits || 0}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right w-24">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                className="border-indigo-500 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200 rounded-md px-2 py-1 h-8 w-8 flex items-center justify-center shadow-sm"
                                disabled={(blueprint?.status || '').toLowerCase() !== 'ready'}
                                onClick={() => handleEditBlueprint(blueprint)}
                              >
                                <Play className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                variant="outline"
                                className="border-gray-400 text-gray-600 hover:bg-gray-50 hover:text-gray-700 transition-all duration-200 rounded-md px-2 py-1 h-8 w-8 flex items-center justify-center shadow-sm"
                                onClick={() => handleEditBlueprintDefinition(blueprint)}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                variant="outline"
                                className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-200 rounded-md px-2 py-1 h-8 w-8 flex items-center justify-center shadow-sm"
                                disabled={deletingId === blueprint.recordId || ((blueprint?.status || '').toLowerCase() !== 'ready' && (blueprint?.status || '').toLowerCase() !== 'error')}
                                onClick={() => {
                                  setBlueprintToDelete(blueprint);
                                  setShowDeleteModal(true);
                                }}
                              >
                                {deletingId === blueprint.recordId ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-gray-500"
                        >
                          {searchQuery ? (
                            <>
                              <div className="text-lg font-medium">
                                No matching blueprints found
                              </div>
                              <p className="mt-1">
                                Try a different search term or clear your search
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="text-lg font-medium">
                                No blueprints yet
                              </div>
                              <p className="mt-1">
                                Create your first blueprint to get started
                              </p>
                              <Button
                                className="mt-4 "
                                onClick={() => navigate('/dashboard/blueprintbuilder')}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Create Blueprint
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>

            {activeTab === 'blueprints' && hasMore && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  onClick={() => dispatch(fetchBlueprints({ nextToken }))}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {showDeleteModal && (
        <DeleteModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setBlueprintToDelete(null);
          }}
          onConfirm={handleDeleteBlueprint}
          deleteText="Delete Blueprint"
          deleteDescription={
            blueprintToDelete
              ? `Are you sure you want to delete blueprint "${blueprintToDelete.title}"? This action cannot be undone.`
              : ''
          }
          deleteButtonText="Delete Blueprint"
        />
      )}
    </div>
  );
};

export default MyBlueprints;
