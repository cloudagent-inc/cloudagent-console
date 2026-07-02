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
  fetchSkills,
  deleteSkill,
  clearError,
} from '../../features/skill/skillSlice';
import { fetchAgentList } from '@/helpers/agentList';
import { Icons } from '../../components/icons';
import { isLocalRuntime } from '../../runtime/cloudAgentRuntime';

const getDashboardSkillTab = (pathname = '') => {
  if (pathname.includes('/dashboard/skills/library')) return 'library';
  if (pathname.includes('/dashboard/skills')) return 'skills';
  return 'skills';
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

const getSkillCloudProvider = (blueprint) => {
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

const MySkills = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [skillToDelete, setSkillToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [librarySkills, setLibrarySkills] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const { userSkills, loading, error, hasMore, nextToken } = useSelector(
    (state) => state.skill
  );

  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() =>
    getDashboardSkillTab(location.pathname)
  );

  useEffect(() => {
    setActiveTab(getDashboardSkillTab(location.pathname));
  }, [location.pathname]);

  const loadCustomSkills = useCallback(() => {
    dispatch(fetchSkills({ count: 50 }));
  }, [dispatch]);

  const loadLibrarySkills = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError(null);

    try {
      const response = await fetchAgentList();
      if (!response.ok) {
        throw new Error(
          `Failed to load library skills (${response.status} ${response.statusText})`
        );
      }

      const payload = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error('Library skill response was not an array.');
      }

      const libraryItems = payload
        .filter((blueprint) => blueprint?.active && blueprint?.type === 'agent')
        .map((blueprint) => ({
          id: blueprint.id,
          title: blueprint.title || 'Untitled Skill',
          description: normalizeDescriptionText(blueprint.description),
          category: blueprint.category || 'Uncategorized',
          cloudProvider: getSkillCloudProvider(blueprint),
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

      setLibrarySkills(deduped);
    } catch (fetchError) {
      console.error('Failed to load library skills:', fetchError);
      setLibraryError(
        fetchError?.message || 'Failed to load library skills.'
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

  const filteredCustomSkills = useMemo(() => {
    let filtered = userSkills.filter(
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
  }, [userSkills, searchQuery, sortBy, sortOrder]);

  const filteredLibrarySkills = useMemo(() => {
    const normalizedQuery = searchQuery.toLowerCase().trim();
    let filtered = librarySkills.filter((blueprint) => {
      if (!normalizedQuery) return true;

      return (
        blueprint.title.toLowerCase().includes(normalizedQuery) ||
        blueprint.description.toLowerCase().includes(normalizedQuery) ||
        blueprint.category.toLowerCase().includes(normalizedQuery) ||
        blueprint.id.toLowerCase().includes(normalizedQuery)
      );
    });

    if (selectedCategory) {
      filtered = filtered.filter((blueprint) => blueprint.category === selectedCategory);
    }

    return filtered.sort((a, b) => a.title.localeCompare(b.title));
  }, [librarySkills, searchQuery, selectedCategory]);

  const libraryCategories = useMemo(() => {
    const categories = new Set();
    librarySkills.forEach((blueprint) => {
      if (blueprint.category) {
        categories.add(blueprint.category);
      }
    });
    return Array.from(categories).sort();
  }, [librarySkills]);

  useEffect(() => {
    loadCustomSkills();
    loadLibrarySkills();

    return () => {
      dispatch(clearError());
    };
  }, [dispatch, loadCustomSkills, loadLibrarySkills]);

  const handleEditSkill = (blueprint) => {
    navigate(
      isLocalRuntime()
        ? `/dashboard/skill/${blueprint.recordId}`
        : `/blueprint/${blueprint.recordId}`,
      {}
    );
  };

  const handleEditSkillDefinition = (blueprint) => {
    navigate(`/dashboard/skill/edit/${blueprint.recordId}`, {});
  };

  const handleDeleteSkill = async () => {
    if (skillToDelete) {
      setDeletingId(skillToDelete.recordId);
      try {
        await dispatch(deleteSkill(skillToDelete.recordId)).unwrap();
      } catch (error) {
        console.error('Failed to delete skill:', error);
      } finally {
        setDeletingId(null);
        setShowDeleteModal(false);
        setSkillToDelete(null);
      }
    }
  };

  const formatSkillStatus = (status) => {
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

  const handleRunLibrarySkill = useCallback(
    (blueprint) => {
      if (!blueprint?.id) return;
      navigate(`/dashboard/library/skill/${blueprint.id}`, {
        state: { fromDashboardLibrary: true },
      });
    },
    [navigate]
  );

  const handleRefresh = useCallback(() => {
    if (activeTab === 'library') {
      loadLibrarySkills();
      return;
    }

    loadCustomSkills();
  }, [activeTab, loadCustomSkills, loadLibrarySkills]);

  return (
    <div>
      <div className="bg-white rounded-lg p-6 mt-2">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex justify-between items-center">
            <nav className="flex space-x-8">
              <NavLink
                to="/dashboard/skills"
                onClick={() => setActiveTab('skills')}
                className={({ isActive }) =>
                  `py-3 px-2 border-b-2 font-semibold text-base transition-colors ${
                    activeTab === 'skills'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`
                }
              >
                My Skills
              </NavLink>
              <NavLink
                to="/dashboard/skills/library"
                onClick={() => setActiveTab('library')}
                className={() =>
                  `py-3 px-2 border-b-2 font-semibold text-base transition-colors ${
                    activeTab === 'library'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`
                }
              >
                Browse Library
              </NavLink>
            </nav>
            <div className="flex items-center gap-2">
              {/* <Button
                variant="outline"
                onClick={() => navigate('/libraries/cost_and_billing')}
              >
                <Play className="w-4 h-4 mr-1" />
                Run Skill
              </Button> */}
              <Button
                className="text-white"
                onClick={() => navigate('/dashboard/skillbuilder')}
              >
                <Plus className="w-4 h-4 mr-1" />
                Create Skill
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="relative mt-4 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder={
                    activeTab === 'library'
                      ? 'Search Skill Library'
                      : 'Search Skills'
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
                title="Refresh skills list"
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
              <div>
                {/* Category Quick Navigation */}
                {libraryCategories.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedCategory(null)}
                        className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                          selectedCategory === null
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        All ({librarySkills.length})
                      </button>
                      {libraryCategories.map((category) => {
                        const count = librarySkills.filter((s) => s.category === category).length;
                        return (
                          <button
                            key={category}
                            type="button"
                            onClick={() => {
                              if (selectedCategory === category) {
                                setSelectedCategory(null);
                              } else {
                                setSelectedCategory(category);
                              }
                            }}
                            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                              selectedCategory === category
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {category} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Skills Table */}
                <Table className="border-collapse">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-[92px] text-center">Provider</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {libraryLoading && librarySkills.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          <div className="flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin mr-2" />
                            Loading library skills...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredLibrarySkills.length > 0 ? (
                      filteredLibrarySkills.map((blueprint) => (
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
                          <TableCell className="text-right w-24">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                className="border-indigo-500 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200 rounded-md px-2 py-1 h-8 w-8 flex items-center justify-center shadow-sm"
                                onClick={() => handleRunLibrarySkill(blueprint)}
                                title="Open skill"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                className="border-gray-400 text-gray-600 hover:bg-gray-50 hover:text-gray-700 transition-all duration-200 rounded-md px-2 py-1 h-8 w-8 flex items-center justify-center shadow-sm"
                                onClick={() =>
                                  navigate(`/dashboard/skill/edit/library/${blueprint.id}`)
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
                          colSpan={4}
                          className="text-center py-8 text-gray-500"
                        >
                          {searchQuery || selectedCategory ? (
                            <>
                              <div className="text-lg font-medium">
                                No matching library skills found
                              </div>
                              <p className="mt-1">
                                Try a different search term or category
                              </p>
                              {selectedCategory && (
                                <Button
                                  variant="outline"
                                  className="mt-4"
                                  onClick={() => setSelectedCategory(null)}
                                >
                                  Clear category filter
                                </Button>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="text-lg font-medium">
                                No library skills available
                              </div>
                              <p className="mt-1">
                                Active library skills will appear here when available
                              </p>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
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
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && userSkills.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <div className="flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin mr-2" />
                            Loading skills...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredCustomSkills.length > 0 ? (
                      filteredCustomSkills.map((blueprint) => (
                        <TableRow
                          key={blueprint.recordId}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <TableCell className="flex items-center gap-3">
                            <div>
                              <div className="font-medium">
                                {blueprint?.title || 'Untitled Skill'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <CloudProviderIcon cloudProvider={getSkillCloudProvider(blueprint)} />
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
                                {formatSkillStatus(blueprint?.status)}
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
                          <TableCell className="text-right w-24">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                className="border-indigo-500 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200 rounded-md px-2 py-1 h-8 w-8 flex items-center justify-center shadow-sm"
                                disabled={(blueprint?.status || '').toLowerCase() !== 'ready'}
                                onClick={() => handleEditSkill(blueprint)}
                              >
                                <Play className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                variant="outline"
                                className="border-gray-400 text-gray-600 hover:bg-gray-50 hover:text-gray-700 transition-all duration-200 rounded-md px-2 py-1 h-8 w-8 flex items-center justify-center shadow-sm"
                                onClick={() => handleEditSkillDefinition(blueprint)}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                variant="outline"
                                className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-200 rounded-md px-2 py-1 h-8 w-8 flex items-center justify-center shadow-sm"
                                disabled={deletingId === blueprint.recordId || ((blueprint?.status || '').toLowerCase() !== 'ready' && (blueprint?.status || '').toLowerCase() !== 'error')}
                                onClick={() => {
                                  setSkillToDelete(blueprint);
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
                          colSpan={5}
                          className="text-center py-8 text-gray-500"
                        >
                          {searchQuery ? (
                            <>
                              <div className="text-lg font-medium">
                                No matching skills found
                              </div>
                              <p className="mt-1">
                                Try a different search term or clear your search
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="text-lg font-medium">
                                No skills yet
                              </div>
                              <p className="mt-1">
                                Create your first skill to get started
                              </p>
                              <Button
                                className="mt-4 "
                                onClick={() => navigate('/dashboard/skillbuilder')}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Create Skill
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

            {activeTab === 'skills' && hasMore && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  onClick={() => dispatch(fetchSkills({ nextToken }))}
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
      </div>

      {showDeleteModal && (
        <DeleteModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSkillToDelete(null);
          }}
          onConfirm={handleDeleteSkill}
          deleteText="Delete Skill"
          deleteDescription={
            skillToDelete
              ? `Are you sure you want to delete skill "${skillToDelete.title}"? This action cannot be undone.`
              : ''
          }
          deleteButtonText="Delete Skill"
        />
      )}
    </div>
  );
};

export default MySkills;
