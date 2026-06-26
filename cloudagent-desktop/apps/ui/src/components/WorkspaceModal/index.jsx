import React, { useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  createAgentPermissionProfile,
  updateAgentPermissionProfile,
  deleteAgentPermissionProfile,
} from '@/features/agent/agentSlice';
import { setActiveWorkspace } from '@/features/workspace/workspaceSlice';
import {
  filterWorkspaceEligibleEnvironments,
  getEnvironmentAccountId,
  getEnvironmentDomain,
  getEnvironmentProfileId,
  getNormalizedEnvironmentType,
} from '@/features/workspace/workspaceScope';
import { Icons } from '@/components/icons';
import toast from 'react-hot-toast';

export default function WorkspaceModal({ isOpen, onClose, workspace }) {
  const dispatch = useDispatch();
  const { userProfile } = useSelector((state) => state.auth);

  const workspaceEnvironments = useMemo(
    () => filterWorkspaceEligibleEnvironments(userProfile?.agentPermissionProfiles || []),
    [userProfile?.agentPermissionProfiles]
  );

  const [name, setName] = useState(workspace?.name || '');
  const [description, setDescription] = useState(workspace?.description || '');
  const [selectedEnvs, setSelectedEnvs] = useState(
    () => new Set(workspace?.environments || [])
  );
  const [environmentFilter, setEnvironmentFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEditing = !!workspace;

  useEffect(() => {
    setName(workspace?.name || '');
    setDescription(workspace?.description || '');
    setSelectedEnvs(new Set(workspace?.environments || []));
    setEnvironmentFilter('');
  }, [workspace, isOpen]);

  const formatEnvironmentType = (profile) => {
    const normalizedType = getNormalizedEnvironmentType(profile);
    if (normalizedType === 'aws org') return 'AWS Organization';
    if (normalizedType === 'aws account') return 'AWS Account';
    if (normalizedType === 'google workspace') return 'Google Workspace';
    if (normalizedType === 'azure tenant') return 'Azure Tenant';
    if (normalizedType === 'azure subscription') return 'Azure Subscription';
    return profile?.type || 'Environment';
  };

  const getEnvironmentProviderKey = (profile) => {
    const type = getNormalizedEnvironmentType(profile);
    if (type.startsWith('azure')) return 'azure';
    if (type === 'google workspace') return 'gws';
    return 'aws';
  };

  const getEnvDisplayInfo = (profile) => {
    const accountId = getEnvironmentAccountId(profile);
    const domain = getEnvironmentDomain(profile);
    return {
      recordId: getEnvironmentProfileId(profile),
      name: profile.name || accountId || domain || 'Unnamed',
      accountId: accountId || null,
      domain: domain || null,
      provider: getEnvironmentProviderKey(profile),
      typeLabel: formatEnvironmentType(profile),
      searchText: [
        profile.name,
        accountId,
        domain,
        profile.description,
        formatEnvironmentType(profile),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    };
  };

  const filteredEnvironments = useMemo(() => {
    const query = environmentFilter.trim().toLowerCase();
    const next = workspaceEnvironments.map(getEnvDisplayInfo).filter((environment) => environment.recordId);
    if (!query) return next;
    return next.filter((environment) => environment.searchText.includes(query));
  }, [environmentFilter, workspaceEnvironments]);

  const allFilteredSelected =
    filteredEnvironments.length > 0 &&
    filteredEnvironments.every((environment) => selectedEnvs.has(environment.recordId));

  const selectVisibleEnvironments = () => {
    setSelectedEnvs((prev) => {
      const next = new Set(prev);
      filteredEnvironments.forEach((environment) => next.add(environment.recordId));
      return next;
    });
  };

  const deselectVisibleEnvironments = () => {
    setSelectedEnvs((prev) => {
      const next = new Set(prev);
      filteredEnvironments.forEach((environment) => next.delete(environment.recordId));
      return next;
    });
  };

  const toggleEnv = (recordId) => {
    setSelectedEnvs((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Workspace name is required');
      return;
    }
    if (selectedEnvs.size === 0) {
      toast.error('Select at least one environment');
      return;
    }

    setSaving(true);
    try {
      const authProfile = JSON.stringify({
        environments: Array.from(selectedEnvs),
      });

      if (isEditing) {
        await dispatch(
          updateAgentPermissionProfile({
            recordId: workspace.recordId,
            name: name.trim(),
            description: description.trim(),
            type: 'workspace',
            authProfile,
          })
        ).unwrap();
        toast.success('Workspace updated');
      } else {
        await dispatch(
          createAgentPermissionProfile({
            name: name.trim(),
            description: description.trim(),
            type: 'workspace',
            authProfile,
          })
        ).unwrap();
        toast.success('Workspace created');
      }
      onClose();
    } catch (err) {
      toast.error(isEditing ? 'Failed to update workspace' : 'Failed to create workspace');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!workspace?.recordId) return;
    setDeleting(true);
    try {
      await dispatch(
        deleteAgentPermissionProfile({ recordId: workspace.recordId })
      ).unwrap();
      dispatch(setActiveWorkspace(null));
      toast.success('Workspace deleted');
      onClose();
    } catch {
      toast.error('Failed to delete workspace');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[min(92vw,640px)] max-w-[640px] overflow-x-hidden sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Workspace' : 'Create Workspace'}</DialogTitle>
        </DialogHeader>

        <div className="min-w-0 space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ws-name">Name</Label>
            <Input
              id="ws-name"
              placeholder="e.g. Production, Staging"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ws-desc">Description (optional)</Label>
            <Input
              id="ws-desc"
              placeholder="What this workspace is for"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Environments</Label>
            {workspaceEnvironments.length === 0 ? (
              <p className="text-sm text-gray-400">No cloud environments connected yet.</p>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder="Filter environments by name or type"
                  value={environmentFilter}
                  onChange={(e) => setEnvironmentFilter(e.target.value)}
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-500">
                    {filteredEnvironments.length} visible
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectVisibleEnvironments}
                      disabled={filteredEnvironments.length === 0 || allFilteredSelected}
                    >
                      Select All Visible
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={deselectVisibleEnvironments}
                      disabled={filteredEnvironments.length === 0}
                    >
                      Deselect All Visible
                    </Button>
                  </div>
                </div>
                <div className="w-full overflow-hidden rounded-lg border border-gray-200">
                <div className="max-h-60 overflow-y-auto overflow-x-hidden">
                <Table>
                  <TableHeader className="sticky top-0 bg-gray-50 z-10">
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectVisibleEnvironments();
                            } else {
                              deselectVisibleEnvironments();
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Environment</TableHead>
                      <TableHead className="w-[150px]">Type</TableHead>
                      <TableHead className="w-[170px]">Identifier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEnvironments.map((info) => {
                      const checked = selectedEnvs.has(info.recordId);
                      return (
                        <TableRow
                          key={info.recordId}
                          className="cursor-pointer"
                          onClick={() => toggleEnv(info.recordId)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleEnv(info.recordId)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex min-w-0 items-center gap-2">
                              {info.provider === 'aws' && <Icons.aws className="h-5 w-5 flex-shrink-0" />}
                              {info.provider === 'gws' && <Icons.googleWorkspace className="h-5 w-5 flex-shrink-0" />}
                              {info.provider === 'azure' && <Icons.azure className="h-5 w-5 flex-shrink-0" />}
                              <div className="min-w-0 truncate text-sm text-gray-900">
                                {info.name}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">
                              {info.typeLabel}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {info.accountId || info.domain || '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {filteredEnvironments.length === 0 && (
                  <div className="px-3 py-6 text-sm text-gray-400 text-center">
                    No environments match that filter.
                  </div>
                )}
                </div>
                </div>
              </div>
            )}
            <p className="text-[11px] text-gray-400">
              {selectedEnvs.size} environment{selectedEnvs.size !== 1 ? 's' : ''} selected
            </p>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {isEditing ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving || deleting}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || deleting || workspaceEnvironments.length === 0}>
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Workspace'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
