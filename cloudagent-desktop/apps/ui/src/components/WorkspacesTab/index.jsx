import React, { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Plus, Layers, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { selectWorkspaces } from '@/features/workspace/workspaceSlice';
import { Icons } from '@/components/icons';
import WorkspaceModal from '@/components/WorkspaceModal';
import {
  filterWorkspaceEligibleEnvironments,
  getEnvironmentAccountId,
  getEnvironmentDomain,
  getEnvironmentProfileId,
  getNormalizedEnvironmentType,
} from '@/features/workspace/workspaceScope';

export default function WorkspacesTab() {
  const workspaces = useSelector(selectWorkspaces);
  const { userProfile } = useSelector((state) => state.auth);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState(null);

  const workspaceEnvironments = useMemo(
    () => filterWorkspaceEligibleEnvironments(userProfile?.agentPermissionProfiles || []),
    [userProfile?.agentPermissionProfiles]
  );

  const envMap = useMemo(() => {
    const map = new Map();
    workspaceEnvironments.forEach((p) => {
      const normalizedType = getNormalizedEnvironmentType(p);
      const provider = normalizedType.startsWith('azure')
        ? 'azure'
        : normalizedType === 'google workspace'
          ? 'gws'
          : 'aws';
      const environmentId = getEnvironmentProfileId(p);
      if (!environmentId) return;
      map.set(environmentId, {
        name: p.name || getEnvironmentAccountId(p) || getEnvironmentDomain(p) || 'Unnamed',
        accountId: getEnvironmentAccountId(p) || getEnvironmentDomain(p) || null,
        provider,
        typeLabel:
          normalizedType === 'aws org'
            ? 'AWS Organization'
            : normalizedType === 'aws account'
              ? 'AWS Account'
              : normalizedType === 'google workspace'
                ? 'Google Workspace'
                : normalizedType === 'azure tenant'
                  ? 'Azure Tenant'
                  : normalizedType === 'azure subscription'
                    ? 'Azure Subscription'
                    : p.type || 'Environment',
      });
    });
    return map;
  }, [workspaceEnvironments]);

  const handleCreate = () => {
    setEditingWorkspace(null);
    setIsModalOpen(true);
  };

  const handleEdit = (workspace) => {
    setEditingWorkspace(workspace);
    setIsModalOpen(true);
  };

  return (
    <>
      <Card className="bg-white">
        <CardHeader className="border-b p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl text-primary-800 font-[500]">Workspaces</h1>
              <p className="text-sm text-gray-500 mt-1">
                Group your cloud environments into workspaces to filter workloads and resources.
              </p>
            </div>
            <Button onClick={handleCreate} className="self-start sm:self-auto order-first sm:order-last">
              <Plus className="mr-2 h-4 w-4" /> New Workspace
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {workspaces.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No workspaces yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Create a workspace to group your cloud environments and filter your workloads.
              </p>
              <Button onClick={handleCreate} variant="outline" className="mt-4">
                <Plus className="mr-2 h-4 w-4" /> Create your first workspace
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Workspace</TableHead>
                  <TableHead>Environments</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaces.map((ws) => (
                  <TableRow key={ws.recordId}>
                    <TableCell>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{ws.name}</div>
                        {ws.description && (
                          <div className="text-xs text-gray-500 mt-0.5">{ws.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {ws.environments.map((envId) => {
                          const env = envMap.get(envId);
                          if (!env) return null;
                          return (
                            <span
                              key={envId}
                              className="inline-flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md"
                            >
                              {env.provider === 'aws' && <Icons.aws className="h-3.5 w-3.5" />}
                              {env.provider === 'gws' && <Icons.googleWorkspace className="h-3.5 w-3.5" />}
                              {env.provider === 'azure' && <Icons.azure className="h-3.5 w-3.5" />}
                              {env.name}
                              <span className="text-gray-500">({env.typeLabel})</span>
                            </span>
                          );
                        })}
                        {ws.environments.length === 0 && (
                          <span className="text-xs text-gray-400">No environments</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(ws)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isModalOpen && (
        <WorkspaceModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingWorkspace(null);
          }}
          workspace={editingWorkspace}
        />
      )}
    </>
  );
}
