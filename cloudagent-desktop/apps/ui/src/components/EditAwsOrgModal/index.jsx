import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
  ExternalLink,
  Loader2,
  RefreshCw,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  createAgentPermissionProfile,
  updateAgentPermissionProfile,
} from '../../features/agent/agentSlice';
import {
  fetchAwsOrganizationAccounts,
  fetchAwsOrganizationStackSetStatus,
} from '../../api/scanner';
import { createPermissionProfileWorkload } from '../../api/ops';
import { getRegionOptions } from '../../helpers/shared';

const normalizeProfileType = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');

const parseJsonSafe = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) || fallback;
  } catch (_) {
    return fallback;
  }
};

const normalizeDiscoveredAccounts = (rawAccounts = []) =>
  (Array.isArray(rawAccounts) ? rawAccounts : [])
    .map((account) => ({
      id: String(account?.id || account?.accountId || '').trim(),
      name: account?.name || account?.accountName || '',
      email: account?.email || '',
      status: account?.status || '',
    }))
    .filter((account) => account.id);

const accountIdFromProfile = (profile) =>
  String(parseJsonSafe(profile?.authProfile)?.awsAccountId || '').trim();

const EditAwsOrgModal = ({ isOpen, onClose, permission }) => {
  const dispatch = useDispatch();
  const { userProfile } = useSelector((state) => state.auth);

  const orgAuthProfile = useMemo(
    () => parseJsonSafe(permission?.authProfile, {}),
    [permission?.authProfile]
  );
  const orgDeploymentPreferences = useMemo(
    () => parseJsonSafe(permission?.deploymentPreferences, {}),
    [permission?.deploymentPreferences]
  );
  const orgRecordId = permission?.recordId || permission?.id || '';
  const managementAccountId = String(orgAuthProfile?.awsAccountId || '').trim();
  const roleName = String(orgAuthProfile?.roleName || '').trim();
  const externalId = String(orgAuthProfile?.externalId || '').trim();
  const memberRoleName = String(
    orgAuthProfile?.memberRoleName || orgAuthProfile?.orgMemberRoleName || roleName
  ).trim();
  const memberExternalId = String(
    orgAuthProfile?.memberExternalId ||
      orgAuthProfile?.orgMemberExternalId ||
      externalId
  ).trim();

  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [stackSetName, setStackSetName] = useState('');
  const [stackSetRegion, setStackSetRegion] = useState('us-east-1');
  const [stackSetOperationId, setStackSetOperationId] = useState('');
  const [orgAccounts, setOrgAccounts] = useState([]);
  const [orgAccountsLoading, setOrgAccountsLoading] = useState(false);
  const [orgAccountsError, setOrgAccountsError] = useState('');
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [stackSetStatus, setStackSetStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [selectedNewAccountIds, setSelectedNewAccountIds] = useState([]);
  const [isApplyingNewAccounts, setIsApplyingNewAccounts] = useState(false);
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setEditedName(permission?.name || '');
    setEditedDescription(permission?.description || '');
    const initialStackSetName =
      String(orgAuthProfile?.stackSetName || '').trim() ||
      String(orgAuthProfile?.orgStackSetName || '').trim() ||
      String(orgDeploymentPreferences?.orgStackSetName || '').trim();
    setStackSetName(initialStackSetName);
    setStackSetRegion(
      String(orgAuthProfile?.stackSetRegion || '').trim() ||
        String(orgAuthProfile?.orgStackSetRegion || '').trim() ||
        String(orgDeploymentPreferences?.orgStackSetRegion || '').trim() ||
        'us-east-1'
    );
    setStackSetOperationId(
      String(orgDeploymentPreferences?.orgStackSetOperationId || '').trim()
    );
    const initialDiscoveredAccounts = normalizeDiscoveredAccounts(
      orgAuthProfile?.memberAccountsDiscovered
    ).filter((account) => account.id !== managementAccountId);
    setOrgAccounts(initialDiscoveredAccounts);
    setStackSetStatus(null);
    setStatusError('');
  }, [
    isOpen,
    managementAccountId,
    orgAuthProfile,
    orgDeploymentPreferences,
    permission?.name,
    permission?.description,
  ]);

  const linkedAwsAccountProfiles = useMemo(() => {
    const profiles = Array.isArray(userProfile?.agentPermissionProfiles)
      ? userProfile.agentPermissionProfiles
      : [];
    return profiles.filter((profile) => {
      if (normalizeProfileType(profile?.type) !== 'aws account') return false;
      const deploymentPreferences = parseJsonSafe(profile?.deploymentPreferences, {});
      const linkedOrgRecordId = deploymentPreferences?.orgPermissionProfileId;
      const linkedManagementId = String(
        deploymentPreferences?.orgManagementAccountId || ''
      ).trim();
      if (linkedOrgRecordId && linkedOrgRecordId === orgRecordId) return true;
      if (linkedManagementId && linkedManagementId === managementAccountId) return true;
      return false;
    });
  }, [managementAccountId, orgRecordId, userProfile?.agentPermissionProfiles]);

  const discoveredMemberAccounts = useMemo(
    () =>
      (Array.isArray(orgAccounts) ? orgAccounts : [])
        .filter(
          (account) => String(account?.id || '').trim() !== managementAccountId
        )
        .map((account) => ({
          id: String(account?.id || '').trim(),
          name: account?.name || '',
          email: account?.email || '',
          status: account?.status || '',
        }))
        .filter((account) => account.id),
    [managementAccountId, orgAccounts]
  );

  const linkedByAccountId = useMemo(() => {
    const map = new Map();
    linkedAwsAccountProfiles.forEach((profile) => {
      const accountId = accountIdFromProfile(profile);
      if (!accountId) return;
      map.set(accountId, profile);
    });
    return map;
  }, [linkedAwsAccountProfiles]);

  const discoveredByAccountId = useMemo(() => {
    const map = new Map();
    discoveredMemberAccounts.forEach((account) => {
      map.set(account.id, account);
    });
    return map;
  }, [discoveredMemberAccounts]);

  const newAccounts = useMemo(
    () =>
      discoveredMemberAccounts.filter((account) => !linkedByAccountId.has(account.id)),
    [discoveredMemberAccounts, linkedByAccountId]
  );

  const existingLinkedAccounts = useMemo(
    () =>
      linkedAwsAccountProfiles.filter((profile) =>
        discoveredByAccountId.has(accountIdFromProfile(profile))
      ),
    [discoveredByAccountId, linkedAwsAccountProfiles]
  );

  useEffect(() => {
    if (!isOpen) return;
    setSelectedNewAccountIds(newAccounts.map((account) => account.id));
  }, [isOpen, newAccounts]);

  const persistOrgProfile = useCallback(
    async ({
      nextStackSetName = stackSetName,
      nextStackSetRegion = stackSetRegion,
      nextOperationId = stackSetOperationId,
      nextDiscoveredAccounts = discoveredMemberAccounts,
    } = {}) => {
      if (!orgRecordId) return;

      const trimmedStackSetName = String(nextStackSetName || '').trim();
      const trimmedStackSetRegion = String(nextStackSetRegion || '').trim() || 'us-east-1';
      const trimmedOperationId = String(nextOperationId || '').trim();
      const mergedAuthProfile = {
        ...orgAuthProfile,
        memberAccountsDiscovered: nextDiscoveredAccounts,
      };
      if (trimmedStackSetName) {
        mergedAuthProfile.stackSetName = trimmedStackSetName;
        mergedAuthProfile.orgStackSetName = trimmedStackSetName;
        mergedAuthProfile.stackSetRegion = trimmedStackSetRegion;
        mergedAuthProfile.orgStackSetRegion = trimmedStackSetRegion;
      }

      const mergedDeploymentPreferences = {
        ...orgDeploymentPreferences,
      };
      if (trimmedStackSetName) {
        mergedDeploymentPreferences.orgStackSetName = trimmedStackSetName;
        mergedDeploymentPreferences.orgStackSetRegion = trimmedStackSetRegion;
      }
      if (trimmedOperationId) {
        mergedDeploymentPreferences.orgStackSetOperationId = trimmedOperationId;
      } else {
        delete mergedDeploymentPreferences.orgStackSetOperationId;
      }

      const trimmedName = String(editedName || '').trim();
      const trimmedDescription = String(editedDescription || '').trim();

      await dispatch(
        updateAgentPermissionProfile({
          recordId: orgRecordId,
          name: trimmedName || permission?.name || `AWS Org ${managementAccountId}`,
          description: trimmedDescription,
          type: 'aws org',
          authProfile: mergedAuthProfile,
          deploymentPreferences: JSON.stringify(mergedDeploymentPreferences),
        })
      ).unwrap();
    },
    [
      discoveredMemberAccounts,
      dispatch,
      editedDescription,
      editedName,
      managementAccountId,
      orgAuthProfile,
      orgDeploymentPreferences,
      orgRecordId,
      permission?.name,
      stackSetName,
      stackSetRegion,
      stackSetOperationId,
    ]
  );

  const refreshOrganizationAccounts = useCallback(async () => {
    if (!orgRecordId) return;
    setOrgAccountsLoading(true);
    setOrgAccountsError('');
    try {
      const response = await fetchAwsOrganizationAccounts({
        permissionProfileId: orgRecordId,
      });
      const accounts = Array.isArray(response?.accounts) ? response.accounts : [];
      const memberAccounts = accounts.filter(
        (account) => String(account?.id || '').trim() !== managementAccountId
      );
      setOrgAccounts(memberAccounts);
      const discoveredForSave = memberAccounts
        .map((account) => ({
          id: String(account?.id || '').trim(),
          name: account?.name || '',
          email: account?.email || '',
          status: account?.status || '',
        }))
        .filter((account) => account.id);
      await persistOrgProfile({ nextDiscoveredAccounts: discoveredForSave });
    } catch (error) {
      const message = error?.message || 'Failed to load organization accounts';
      setOrgAccountsError(message);
      toast.error(message);
    } finally {
      setOrgAccountsLoading(false);
    }
  }, [managementAccountId, orgRecordId, persistOrgProfile]);

  useEffect(() => {
    if (!isOpen || !orgRecordId) return;
    refreshOrganizationAccounts();
  }, [isOpen, orgRecordId]);

  const deployedAccountIdSet = useMemo(() => {
    const ids = Array.isArray(stackSetStatus?.summary?.deployedAccountIds)
      ? stackSetStatus.summary.deployedAccountIds
      : [];
    return new Set(ids.filter(Boolean));
  }, [stackSetStatus]);

  const stackReferenceByAccountId = useMemo(() => {
    const map = new Map();
    (Array.isArray(stackSetStatus?.accounts) ? stackSetStatus.accounts : []).forEach(
      (accountStatus) => {
        const accountId = String(accountStatus?.accountId || '').trim();
        if (!accountId) return;
        const stackId = (Array.isArray(accountStatus?.regions)
          ? accountStatus.regions
          : []
        ).find((region) => String(region?.stackId || '').trim())?.stackId;
        if (stackId) {
          map.set(accountId, String(stackId).trim());
        }
      }
    );
    return map;
  }, [stackSetStatus]);

  const checkStackSetStatus = useCallback(
    async ({ silent = false } = {}) => {
      const trimmedStackSetName = String(stackSetName || '').trim();
      if (!trimmedStackSetName) {
        if (!silent) toast.error('StackSet name is required');
        return;
      }

      setIsCheckingStatus(true);
      setStatusError('');
      try {
        const response = await fetchAwsOrganizationStackSetStatus({
          permissionProfileId: orgRecordId,
          stackSetName: trimmedStackSetName,
          stackSetRegion,
          operationId: String(stackSetOperationId || '').trim() || undefined,
        });
        setStackSetStatus(response);
        if (!silent) {
          await persistOrgProfile();
          toast.success('StackSet status updated');
        }
      } catch (error) {
        const message = error?.message || 'Failed to check StackSet status';
        setStatusError(message);
        if (!silent) toast.error(message);
      } finally {
        setIsCheckingStatus(false);
      }
    },
    [orgRecordId, persistOrgProfile, stackSetName, stackSetRegion, stackSetOperationId]
  );

  const autoCheckedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      autoCheckedRef.current = false;
      return;
    }
    if (autoCheckedRef.current) return;
    if (!orgRecordId) return;
    const trimmedStackSetName = String(stackSetName || '').trim();
    if (!trimmedStackSetName) return;
    autoCheckedRef.current = true;
    checkStackSetStatus({ silent: true });
  }, [isOpen, orgRecordId, stackSetName, stackSetRegion, checkStackSetStatus]);

  const saveOrgSettings = async () => {
    setIsSavingOrg(true);
    try {
      await persistOrgProfile();
      toast.success('AWS Org settings saved');
      onClose?.();
    } catch (error) {
      toast.error(error?.message || 'Failed to save AWS Org settings');
    } finally {
      setIsSavingOrg(false);
    }
  };

  const addSelectedAccounts = async () => {
    if (!roleName || !externalId) {
      toast.error(
        'Management account role name and external ID must exist in the org profile.'
      );
      return;
    }
    if (!memberRoleName || !memberExternalId) {
      toast.error(
        'Member account role name and external ID are required. Re-run org onboarding if missing.'
      );
      return;
    }
    if (!managementAccountId) {
      toast.error('Management account ID is missing in the org profile.');
      return;
    }
    const targetIds = selectedNewAccountIds.filter(Boolean);
    if (targetIds.length === 0) {
      toast.error('No new accounts selected');
      return;
    }

    setIsApplyingNewAccounts(true);
    try {
      const createWorkloadForProfile = async ({
        permissionRecordId,
        accountId,
        stackReference,
      }) => {
        const safeRecordId = String(permissionRecordId || '').trim();
        const safeAccountId = String(accountId || '').trim();
        const safeStackReference = String(stackReference || '').trim();
        if (!safeRecordId || !safeAccountId || !safeStackReference) return false;

        try {
          const { success, workloadId, message } =
            await createPermissionProfileWorkload({
              permissionProfileId: safeRecordId,
              accountId: safeAccountId,
              stackArn: safeStackReference,
            });
          if (success && workloadId) {
            await dispatch(
              updateAgentPermissionProfile({
                recordId: safeRecordId,
                workloadId,
                stackArn: safeStackReference,
              })
            ).unwrap();
            return true;
          }
          if (message) {
            console.warn(
              `Workload creation skipped for account ${safeAccountId}: ${message}`
            );
          }
          return false;
        } catch (error) {
          console.warn(
            `Workload creation failed for account ${safeAccountId}:`,
            error?.message || error
          );
          return false;
        }
      };

      const managementStackReference = String(
        stackReferenceByAccountId.get(managementAccountId) ||
          orgAuthProfile?.stackArn ||
          orgDeploymentPreferences?.cloudformationStackArn ||
          orgDeploymentPreferences?.cloudformationStackName ||
          stackSetName ||
          ''
      ).trim();
      const allProfiles = Array.isArray(userProfile?.agentPermissionProfiles)
        ? userProfile.agentPermissionProfiles
        : [];
      const existingManagementAccountProfile = allProfiles.find(
        (profile) =>
          normalizeProfileType(profile?.type) === 'aws account' &&
          accountIdFromProfile(profile) === managementAccountId
      );
      const baseManagementDeploymentPreferences = {
        ...(Array.isArray(orgDeploymentPreferences?.defaultRegions)
          ? { defaultRegions: orgDeploymentPreferences.defaultRegions }
          : {}),
        cloudformationStackName:
          orgDeploymentPreferences?.cloudformationStackName ||
          orgDeploymentPreferences?.orgStackSetName ||
          String(stackSetName || '').trim() ||
          '',
        cloudformationStackArn: managementStackReference || '',
        orgManagementAccountId: managementAccountId,
        orgPermissionProfileId: orgRecordId || '',
        orgStackSetName: String(stackSetName || '').trim() || '',
        orgStackSetRegion: String(stackSetRegion || '').trim() || 'us-east-1',
        isOrgManagementAccount: true,
      };

      if (existingManagementAccountProfile?.recordId) {
        const existingManagementDeploymentPreferences = parseJsonSafe(
          existingManagementAccountProfile?.deploymentPreferences,
          {}
        );
        await dispatch(
          updateAgentPermissionProfile({
            recordId: existingManagementAccountProfile.recordId,
            name:
              existingManagementAccountProfile?.name ||
              `AWS Org Management ${managementAccountId}`,
            description:
              existingManagementAccountProfile?.description ||
              `AWS Organization management account ${managementAccountId}`,
            type: 'aws account',
            awsAccountId: managementAccountId,
            authType: 'role',
            roleName,
            externalId,
            ...(managementStackReference ? { stackArn: managementStackReference } : {}),
            deploymentPreferences: JSON.stringify({
              ...existingManagementDeploymentPreferences,
              ...baseManagementDeploymentPreferences,
            }),
          })
        ).unwrap();

        const existingManagementAuthProfile = parseJsonSafe(
          existingManagementAccountProfile?.authProfile,
          {}
        );
        if (!existingManagementAuthProfile?.workloadId) {
          await createWorkloadForProfile({
            permissionRecordId: existingManagementAccountProfile.recordId,
            accountId: managementAccountId,
            stackReference: managementStackReference,
          });
        }
      } else {
        const createdManagementProfile = await dispatch(
          createAgentPermissionProfile({
            name: `AWS Org Management ${managementAccountId}`,
            description: `AWS Organization management account ${managementAccountId}`,
            type: 'aws account',
            awsAccountId: managementAccountId,
            authType: 'role',
            roleName,
            externalId,
            ...(managementStackReference ? { stackArn: managementStackReference } : {}),
            deploymentPreferences: JSON.stringify(baseManagementDeploymentPreferences),
          })
        ).unwrap();

        await createWorkloadForProfile({
          permissionRecordId: createdManagementProfile?.recordId,
          accountId: managementAccountId,
          stackReference: managementStackReference,
        });
      }

      for (const accountId of targetIds) {
        const account = newAccounts.find((item) => item.id === accountId);
        if (!account) continue;
        const memberStackReference = String(
          stackReferenceByAccountId.get(account.id) ||
            managementStackReference ||
            String(stackSetName || '').trim()
        ).trim();
        const createdMemberProfile = await dispatch(
          createAgentPermissionProfile({
            name: account.name || `AWS Account ${account.id}`,
            description: account.email
              ? `${account.name || account.id} (${account.email})`
              : account.name || account.id,
            type: 'aws account',
            awsAccountId: account.id,
            authType: 'role',
            roleName: memberRoleName,
            externalId: memberExternalId,
            ...(memberStackReference ? { stackArn: memberStackReference } : {}),
            deploymentPreferences: JSON.stringify({
              ...(Array.isArray(orgDeploymentPreferences?.defaultRegions)
                ? { defaultRegions: orgDeploymentPreferences.defaultRegions }
                : {}),
              cloudformationStackName:
                orgDeploymentPreferences?.cloudformationStackName ||
                orgDeploymentPreferences?.orgStackSetName ||
                String(stackSetName || '').trim() ||
                '',
              cloudformationStackArn: memberStackReference || '',
              orgManagementAccountId: managementAccountId,
              orgPermissionProfileId: orgRecordId,
              orgStackSetName: String(stackSetName || '').trim() || '',
              orgStackSetRegion: String(stackSetRegion || '').trim() || 'us-east-1',
            }),
          })
        ).unwrap();

        await createWorkloadForProfile({
          permissionRecordId: createdMemberProfile?.recordId,
          accountId: account.id,
          stackReference: memberStackReference,
        });
      }
      toast.success('Selected new accounts were added');
    } catch (error) {
      toast.error(error?.message || 'Failed to add one or more accounts');
    } finally {
      setIsApplyingNewAccounts(false);
    }
  };

  if (!permission) return null;

  const summary = stackSetStatus?.summary;
  const refreshing = orgAccountsLoading || isCheckingStatus;
  const allNewSelected =
    newAccounts.length > 0 && selectedNewAccountIds.length === newAccounts.length;

  const handleRefreshAll = async () => {
    await refreshOrganizationAccounts();
    await checkStackSetStatus({ silent: true });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-white max-h-[95vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary-800">
            Edit AWS Organization
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <section className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="org-name" className="text-xs text-gray-600">
                Name
              </Label>
              <Input
                id="org-name"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="AWS Organization name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-description" className="text-xs text-gray-600">
                Description
              </Label>
              <Textarea
                id="org-description"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 pt-1 text-xs">
              <div>
                <span className="text-gray-500">Management Account: </span>
                <span className="font-mono text-gray-900">
                  {managementAccountId || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Role: </span>
                <span className="font-mono text-gray-900">{roleName || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500">External ID: </span>
                <span className="font-mono text-gray-900">{externalId || 'N/A'}</span>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">StackSet Deployment</h3>
              <div className="flex items-center gap-2">
                <a
                  href="https://console.aws.amazon.com/cloudformation/home?#/stacksets"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    AWS Console
                  </Button>
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={handleRefreshAll}
                  disabled={refreshing}
                >
                  {refreshing ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Refresh
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">StackSet Name</Label>
                <Input
                  value={stackSetName}
                  onChange={(e) => {
                    setStackSetName(e.target.value);
                    setStackSetStatus(null);
                  }}
                  placeholder="cloudagent-org-member-role"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">Region</Label>
                <select
                  value={stackSetRegion}
                  onChange={(e) => {
                    setStackSetRegion(e.target.value);
                    setStackSetStatus(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none bg-white text-sm"
                >
                  {getRegionOptions().map((region) => (
                    <option key={region.value} value={region.value}>
                      {region.label || region.text || region.value}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              className="flex items-center gap-1 text-xs text-primary-700 hover:text-primary-800"
              onClick={() => setShowAdvanced((prev) => !prev)}
            >
              {showAdvanced ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              Advanced
            </button>

            {showAdvanced && (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">Operation ID (optional)</Label>
                <Input
                  value={stackSetOperationId}
                  onChange={(e) => setStackSetOperationId(e.target.value)}
                  placeholder="operation-id"
                />
              </div>
            )}

            {(orgAccountsError || statusError) && (
              <div className="rounded border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                {orgAccountsError || statusError}
              </div>
            )}

            {summary && (
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-gray-700">
                  <span className="font-semibold text-gray-900">
                    {summary.accountCount || 0}
                  </span>
                  discovered
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-green-700">
                  <span className="font-semibold">{summary.deployedAccountCount || 0}</span>
                  deployed
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
                  <span className="font-semibold">{summary.failedAccountCount || 0}</span>
                  issues
                </span>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <h3 className="text-sm font-semibold text-gray-900">Member Accounts</h3>
                <span className="text-xs text-gray-500">
                  {newAccounts.length} new · {existingLinkedAccounts.length} linked
                </span>
              </div>
              {newAccounts.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() =>
                    setSelectedNewAccountIds(
                      allNewSelected ? [] : newAccounts.map((account) => account.id)
                    )
                  }
                >
                  {allNewSelected ? 'Deselect all' : 'Select all'}
                </Button>
              )}
            </div>

            {newAccounts.length === 0 ? (
              <div className="rounded border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
                No new organization accounts detected.
              </div>
            ) : (
              <>
                <div className="max-h-[260px] overflow-auto rounded border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0 border-b text-xs text-gray-600">
                      <tr>
                        <th className="text-left px-3 py-2 w-10"></th>
                        <th className="text-left px-3 py-2">Account</th>
                        <th className="text-right px-3 py-2">Deployment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newAccounts.map((account) => {
                        const checked = selectedNewAccountIds.includes(account.id);
                        const deployed = deployedAccountIdSet.has(account.id);
                        return (
                          <tr key={account.id} className="border-b last:border-b-0 hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? Array.from(new Set([...selectedNewAccountIds, account.id]))
                                    : selectedNewAccountIds.filter((id) => id !== account.id);
                                  setSelectedNewAccountIds(next);
                                }}
                                className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-gray-900">
                                {account.name || account.id}
                              </div>
                              <div className="text-xs font-mono text-gray-500">
                                {account.id}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span
                                className={
                                  deployed
                                    ? 'inline-block text-green-700 bg-green-100 px-2 py-0.5 rounded-full text-xs'
                                    : 'inline-block text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-xs'
                                }
                              >
                                {deployed ? 'Deployed' : 'Not confirmed'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={addSelectedAccounts}
                    disabled={isApplyingNewAccounts || selectedNewAccountIds.length === 0}
                  >
                    {isApplyingNewAccounts ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Add {selectedNewAccountIds.length > 0 ? `${selectedNewAccountIds.length} ` : ''}
                    Selected
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={saveOrgSettings} disabled={isSavingOrg}>
            {isSavingOrg && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditAwsOrgModal;
