import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Plus,
  MoreHorizontal,
  Pencil,
  ExternalLink,
  Loader2,
  RefreshCw,
  ChevronsUpDown,
  LayoutGrid,
  ClipboardList,
  Zap,
  CloudUpload,
  Layers,
} from 'lucide-react';
import { listWellArchitectedWorkloads } from '@/api/wellArchitected';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import WellArchitectedWorkloadModal from '@/components/WellArchitectedModal';
import {
  setSelectedAccount,
} from '@/features/wellArchitected/wellArchitectedSlice';
import toast from 'react-hot-toast';

const EXPLAINER_TILES = [
  {
    icon: LayoutGrid,
    title: 'Official AWS reviews',
    blurb: 'Same Well-Architected workloads & questionnaires you use in AWS.',
    accent: 'bg-sky-100 text-sky-700',
  },
  {
    icon: ClipboardList,
    title: 'Resource-aware answers',
    blurb: 'Automated assessment of your stack to inform the review.',
    accent: 'bg-violet-100 text-violet-700',
  },
  {
    icon: Zap,
    title: 'Faster questionnaires',
    blurb: 'Less manual work while you stay in control.',
    accent: 'bg-amber-100 text-amber-800',
  },
  {
    icon: CloudUpload,
    title: 'Sync to your account',
    blurb: 'Updates write back to the workload in AWS.',
    accent: 'bg-emerald-100 text-emerald-800',
  },
  {
    icon: Layers,
    title: 'All lenses',
    blurb: 'Core + specialized (Serverless, ML, GenAI, DevOps, and more).',
    accent: 'bg-slate-100 text-slate-700',
  },
];

export default function WellArchitectedPage() {
  const { userProfile } = useSelector((state) => state.auth);
  const { workloads: waWorkloads, selectedAccountId } = useSelector(
    (state) => state.wellArchitected
  );
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Filter AWS accounts from permission profiles (memoized to prevent infinite useEffect loops)
  const awsAccounts = useMemo(
    () =>
      userProfile?.agentPermissionProfiles?.filter(
        (p) => p.type === 'aws account'
      ) || [],
    [userProfile?.agentPermissionProfiles]
  );

  // Parse auth profile (same shape as permission profile storage)
  const parseProfileAuth = (profile) => {
    if (!profile) return {};
    return typeof profile.authProfile === 'string'
      ? JSON.parse(profile.authProfile)
      : profile.authProfile || {};
  };

  // Helper to get account display name
  const getAccountDisplay = (profile) => {
    if (!profile) return '';
    const auth = parseProfileAuth(profile);
    const accountId = auth.awsAccountId || '';
    return accountId ? `${profile.name} (${accountId})` : profile.name;
  };

  // Searchable string: name, 12-digit id, description
  const getAccountSearchValue = (profile) => {
    if (!profile) return '';
    const auth = parseProfileAuth(profile);
    const accountId = String(auth.awsAccountId || '').trim();
    const name = String(profile.name || '').trim();
    const desc = String(profile.description || '').trim();
    return [profile.recordId, name, accountId, desc].filter(Boolean).join(' ');
  };

  // Filter local workloads by selected account
  const localWorkloads = selectedAccountId
    ? waWorkloads.filter((w) => w.environments?.includes(selectedAccountId))
    : [];

  // Handle account selection change
  const handleAccountChange = (accountId) => {
    dispatch(setSelectedAccount(accountId));
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorkload, setEditingWorkload] = useState(null);
  const [accountComboOpen, setAccountComboOpen] = useState(false);

  // AWS Well-Architected workloads state
  const [awsWorkloads, setAwsWorkloads] = useState([]);
  const [loadingWorkloads, setLoadingWorkloads] = useState(false);
  const [workloadsError, setWorkloadsError] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState('us-east-1');

  // AWS regions for Well-Architected
  const awsRegions = [
    { value: 'us-east-1', label: 'US East (N. Virginia)' },
    { value: 'us-east-2', label: 'US East (Ohio)' },
    { value: 'us-west-1', label: 'US West (N. California)' },
    { value: 'us-west-2', label: 'US West (Oregon)' },
    { value: 'eu-west-1', label: 'EU (Ireland)' },
    { value: 'eu-west-2', label: 'EU (London)' },
    { value: 'eu-central-1', label: 'EU (Frankfurt)' },
    { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
    { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
    { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  ];

  // Combine local and AWS workloads for display
  // Local workloads are shown first (newly created), then AWS workloads
  const allWorkloads = useMemo(() => {
    const combined = [...localWorkloads];
    // Add AWS workloads, avoiding duplicates by workloadId
    const localIds = new Set(localWorkloads.map((w) => w.workloadId));
    awsWorkloads.forEach((w) => {
      const id = w.WorkloadId || w.workloadId;
      if (!localIds.has(id)) {
        combined.push(w);
      }
    });
    return combined;
  }, [localWorkloads, awsWorkloads]);

  // Fetch AWS Well-Architected workloads when account or region changes
  useEffect(() => {
    if (!selectedAccountId) {
      setAwsWorkloads([]);
      return;
    }

    const selectedProfile = awsAccounts.find(
      (a) => a.recordId === selectedAccountId
    );
    if (!selectedProfile) return;

    const authProfile =
      typeof selectedProfile.authProfile === 'string'
        ? JSON.parse(selectedProfile.authProfile)
        : selectedProfile.authProfile || {};

    const fetchWorkloads = async () => {
      setLoadingWorkloads(true);
      setWorkloadsError(null);
      try {
        const result = await listWellArchitectedWorkloads({
          accountId: authProfile.awsAccountId,
          authProfile,
          regions: [selectedRegion],
        });
        console.log('[WellArchitected] API response:', result);
        // Parse the response - handle multiple response structures
        let workloads = [];
        if (result?.WellArchitected) {
          // Structure: {WellArchitected: {"us-east-1": {code: 200, data: [...]}}}
          Object.values(result.WellArchitected).forEach((regionData) => {
            if (regionData.code === 200 && Array.isArray(regionData.data)) {
              workloads = workloads.concat(regionData.data);
            }
          });
        } else if (result?.code === 200 && result?.data?.WellArchitected) {
          // Structure: {code: 200, data: {WellArchitected: {"us-east-1": {code: 200, data: [...]}}}}
          Object.values(result.data.WellArchitected).forEach((regionData) => {
            if (regionData.code === 200 && Array.isArray(regionData.data)) {
              workloads = workloads.concat(regionData.data);
            }
          });
        } else if (result?.code === 200 && Array.isArray(result?.data)) {
          // Structure: {code: 200, data: [...]}
          workloads = result.data;
        }
        console.log('[WellArchitected] Parsed workloads:', workloads);
        setAwsWorkloads(workloads);
      } catch (error) {
        console.error('Error fetching workloads:', error);
        setWorkloadsError(error.message);
        setAwsWorkloads([]);
      } finally {
        setLoadingWorkloads(false);
      }
    };

    fetchWorkloads();
  }, [selectedAccountId, selectedRegion, awsAccounts]);

  // Refresh workloads
  const refreshWorkloads = () => {
    if (!selectedAccountId) return;
    const selectedProfile = awsAccounts.find(
      (a) => a.recordId === selectedAccountId
    );
    if (!selectedProfile) return;

    const authProfile =
      typeof selectedProfile.authProfile === 'string'
        ? JSON.parse(selectedProfile.authProfile)
        : selectedProfile.authProfile || {};

    setLoadingWorkloads(true);
    setWorkloadsError(null);
    listWellArchitectedWorkloads({
      accountId: authProfile.awsAccountId,
      authProfile,
      regions: [selectedRegion],
    })
      .then((result) => {
        console.log('[WellArchitected] Refresh response:', result);
        // Parse the response - handle multiple response structures
        let workloads = [];
        if (result?.WellArchitected) {
          // Structure: {WellArchitected: {"us-east-1": {code: 200, data: [...]}}}
          Object.values(result.WellArchitected).forEach((regionData) => {
            if (regionData.code === 200 && Array.isArray(regionData.data)) {
              workloads = workloads.concat(regionData.data);
            }
          });
        } else if (result?.code === 200 && result?.data?.WellArchitected) {
          // Structure: {code: 200, data: {WellArchitected: {"us-east-1": {code: 200, data: [...]}}}}
          Object.values(result.data.WellArchitected).forEach((regionData) => {
            if (regionData.code === 200 && Array.isArray(regionData.data)) {
              workloads = workloads.concat(regionData.data);
            }
          });
        } else if (result?.code === 200 && Array.isArray(result?.data)) {
          // Structure: {code: 200, data: [...]}
          workloads = result.data;
        }
        console.log('[WellArchitected] Refresh parsed workloads:', workloads);
        setAwsWorkloads(workloads);
      })
      .catch((error) => {
        console.error('Error fetching workloads:', error);
        setWorkloadsError(error.message);
        setAwsWorkloads([]);
      })
      .finally(() => {
        setLoadingWorkloads(false);
      });
  };

  const editWorkload = (workload) => {
    setEditingWorkload(workload);
    setIsModalOpen(true);
  };

  const openWorkload = (workload) => {
    if (workload?.workloadId) {
      // Pass region as query param for AWS workloads
      navigate(`/dashboard/well-architected/${workload.workloadId}?region=${selectedRegion}`);
    }
  };

  return (
    <>
      <Card className="bg-white">
        <CardHeader className="border-b p-6 space-y-5">
          {/* Title — AWS logo matches home page so scope is obvious */}
          <div className="flex items-start gap-4">
            <div className="shrink-0 pt-0.5" title="Amazon Web Services">
              <Icons.aws className="h-12 w-12 rounded-lg border border-gray-100 bg-white shadow-sm transition-all duration-200 hover:scale-105" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 gap-y-1">
                <h1 className="text-2xl text-primary-800 font-[500]">
                  Well-Architected Review
                </h1>
                
              </div>
              
              <a
                href="https://aws.amazon.com/architecture/well-architected/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 mt-2"
              >
                About the framework on AWS
                <ExternalLink className="h-3 w-3 opacity-70" />
              </a>
            </div>
          </div>

          {/* Visual explainer — scannable tiles */}
          {!selectedAccountId && (
            <div className="rounded-xl border border-gray-100 bg-gradient-to-b from-gray-50/90 to-white p-4 sm:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                How CloudAgent fits in
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                {EXPLAINER_TILES.map(({ icon: TileIcon, title, blurb, accent }) => (
                  <div
                    key={title}
                    className="flex gap-3 rounded-lg border border-gray-100 bg-white p-3 shadow-sm"
                  >
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                        accent
                      )}
                    >
                      <TileIcon className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 leading-tight">
                        {title}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 leading-snug">
                        {blurb}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Account / region / actions — wrap so nothing is squished */}
          <div className="flex flex-col gap-3 pt-1 border-t border-gray-100 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 min-w-0 sm:flex-row sm:flex-wrap sm:items-center sm:flex-1">
              <Popover open={accountComboOpen} onOpenChange={setAccountComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={accountComboOpen}
                    className={cn(
                      'h-10 w-full sm:w-[min(100%,320px)] sm:min-w-[220px] justify-between font-normal px-3',
                      !selectedAccountId && 'text-muted-foreground'
                    )}
                  >
                    <span className="truncate text-left">
                      {selectedAccountId
                        ? getAccountDisplay(
                            awsAccounts.find((a) => a.recordId === selectedAccountId)
                          )
                        : 'Select AWS Account'}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0 bg-white"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Search name, account ID, or description…" />
                    <CommandList>
                      <CommandEmpty>No AWS account found.</CommandEmpty>
                      <CommandGroup>
                        {awsAccounts.map((account) => {
                          const desc = String(account.description || '').trim();
                          return (
                            <CommandItem
                              key={account.recordId}
                              value={getAccountSearchValue(account)}
                              onSelect={() => {
                                handleAccountChange(account.recordId);
                                setAccountComboOpen(false);
                              }}
                            >
                              <div className="flex flex-col gap-0.5 min-w-0 py-0.5">
                                <span className="truncate font-medium text-gray-900">
                                  {getAccountDisplay(account)}
                                </span>
                                {desc ? (
                                  <span className="text-xs text-gray-500 truncate">
                                    {desc}
                                  </span>
                                ) : null}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger className="h-10 w-full sm:w-[min(100%,240px)] sm:min-w-[200px]">
                  <SelectValue placeholder="Select Region" />
                </SelectTrigger>
                <SelectContent>
                  {awsRegions.map((region) => (
                    <SelectItem key={region.value} value={region.value}>
                      {region.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
              <Button
                variant="outline"
                className="h-10 w-10 shrink-0 p-0"
                title="Refresh workloads"
                onClick={refreshWorkloads}
                disabled={!selectedAccountId || loadingWorkloads}
              >
                <RefreshCw
                  className={`h-4 w-4 ${loadingWorkloads ? 'animate-spin' : ''}`}
                />
              </Button>
              <Button
                className="h-10 px-4 whitespace-nowrap"
                onClick={() => {
                  setEditingWorkload(null);
                  setIsModalOpen(true);
                }}
                disabled={!selectedAccountId}
              >
                <Plus className="mr-2 h-4 w-4 shrink-0" />
                New Review
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {!selectedAccountId ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select an AWS Account
              </h3>
              <p className="text-gray-500">
                Please select an AWS account from the dropdown above to view or create Well-Architected reviews.
              </p>
            </div>
          ) : loadingWorkloads && allWorkloads.length === 0 ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 text-blue-600 mx-auto mb-4 animate-spin" />
              <p className="text-gray-500">Loading workloads...</p>
            </div>
          ) : allWorkloads.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Well-Architected workloads
              </h3>
              <p className="text-gray-500 mb-4">
                Create a Well-Architected workload to review your architecture against AWS best practices.
              </p>
              <Button
                onClick={() => {
                  setEditingWorkload(null);
                  setIsModalOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> New Review
              </Button>
            </div>
          ) : (
            <>
              {/* Show error banner if API failed but we have local workloads */}
              {workloadsError && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                  <p className="text-sm text-amber-800">
                    Could not load AWS workloads: {workloadsError}
                  </p>
                  <Button variant="ghost" size="sm" onClick={refreshWorkloads}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Retry
                  </Button>
                </div>
              )}
              {loadingWorkloads && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                  <p className="text-sm text-blue-800">Loading AWS workloads...</p>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Workload Name</TableHead>
                    <TableHead className="w-[280px] max-w-[280px]">Lenses</TableHead>
                    <TableHead>Risk Counts</TableHead>
                    <TableHead>Answers</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allWorkloads.map((workload) => {
                    // Handle both local workloads and AWS API workloads
                    const workloadId = workload.WorkloadId || workload.workloadId;
                    const workloadName = workload.WorkloadName || workload.workloadName;
                    // For local workloads, parse lenses from deploymentPreferences
                    let lenses = workload.Lenses || [];
                    if (lenses.length === 0 && workload.deploymentPreferences) {
                      const prefs =
                        typeof workload.deploymentPreferences === 'string'
                          ? JSON.parse(workload.deploymentPreferences)
                          : workload.deploymentPreferences;
                      lenses = prefs.lenses || [];
                    }
                    const riskCounts = workload.RiskCounts || {};
                    const updatedAt = workload.UpdatedAt || workload.updatedAt || workload.createdAt;
                    const answeredCount =
                      (riskCounts.HIGH || 0) +
                      (riskCounts.MEDIUM || 0) +
                      (riskCounts.NONE || 0);
                    const unansweredCount = riskCounts.UNANSWERED || 0;
                    const hasRiskCounts =
                      (riskCounts.HIGH || 0) > 0 ||
                      (riskCounts.MEDIUM || 0) > 0 ||
                      (riskCounts.NONE || 0) > 0;

                  return (
                    <TableRow
                      key={workloadId}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => openWorkload({ workloadId, workloadName })}
                    >
                      <TableCell className="font-medium">
                        {workloadName}
                      </TableCell>
                      <TableCell className="w-[280px] max-w-[280px]">
                        <div className="flex flex-wrap gap-1">
                          {lenses.slice(0, 3).map((lens) => (
                            <Badge
                              key={lens}
                              variant="secondary"
                              className="max-w-full truncate text-xs"
                              title={lens}
                            >
                              {lens.replace('arn:aws:wellarchitected::aws:lens/', '')}
                            </Badge>
                          ))}
                          {lenses.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{lenses.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 text-xs flex-wrap">
                          {riskCounts.HIGH > 0 && (
                            <Badge className="border border-red-200 bg-red-100 text-red-700 text-xs hover:bg-red-100">
                              {riskCounts.HIGH} High
                            </Badge>
                          )}
                          {riskCounts.MEDIUM > 0 && (
                            <Badge className="border border-yellow-200 bg-yellow-100 text-yellow-800 text-xs hover:bg-yellow-100">
                              {riskCounts.MEDIUM} Medium
                            </Badge>
                          )}
                          {riskCounts.NONE > 0 && (
                            <Badge className="border border-green-200 bg-green-50 text-green-700 text-xs hover:bg-green-50">
                              {riskCounts.NONE} None
                            </Badge>
                          )}
                          {!hasRiskCounts && (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 text-xs flex-wrap">
                          {answeredCount > 0 && (
                            <Badge className="border border-blue-200 bg-blue-50 text-blue-700 text-xs hover:bg-blue-50">
                              {answeredCount} Answered
                            </Badge>
                          )}
                          {unansweredCount > 0 && (
                            <Badge className="border border-gray-200 bg-gray-50 text-gray-600 text-xs hover:bg-gray-50">
                              {unansweredCount} Unanswered
                            </Badge>
                          )}
                          {answeredCount === 0 && unansweredCount === 0 && (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {updatedAt
                          ? new Date(updatedAt).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                openWorkload({ workloadId, workloadName });
                              }}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                // Pass full workload object with normalized properties
                                editWorkload({
                                  ...workload,
                                  workloadId,
                                  workloadName,
                                  lenses,
                                  Lenses: lenses,
                                });
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Well-Architected Workload Modal */}
      {isModalOpen && (
        <WellArchitectedWorkloadModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingWorkload(null);
          }}
          userProfile={userProfile}
          existingWorkloads={localWorkloads}
          editWorkload={editingWorkload}
          selectedAccountId={selectedAccountId}
          onWorkloadCreated={(createdWorkload) => {
            setIsModalOpen(false);
            setEditingWorkload(null);
            navigate(
              `/dashboard/well-architected/${createdWorkload.workloadId}?region=${selectedRegion}`
            );
          }}
          onWorkloadUpdated={(updatedWorkload) => {
            // Update AWS workloads list if the edited workload is from AWS
            setAwsWorkloads((prev) =>
              prev.map((w) =>
                (w.WorkloadId || w.workloadId) === updatedWorkload.workloadId
                  ? { ...w, ...updatedWorkload, Lenses: updatedWorkload.Lenses }
                  : w
              )
            );
          }}
        />
      )}

    </>
  );
}
