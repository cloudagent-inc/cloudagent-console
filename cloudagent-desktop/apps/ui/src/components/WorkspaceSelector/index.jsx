import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Layers, Plus, ChevronDown, Check, Settings2 } from 'lucide-react';
import {
  selectWorkspaces,
  selectActiveWorkspaceId,
  setActiveWorkspace,
} from '@/features/workspace/workspaceSlice';
import WorkspaceModal from '@/components/WorkspaceModal';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function WorkspaceSelector({ isCollapsed }) {
  const dispatch = useDispatch();
  const workspaces = useSelector(selectWorkspaces);
  const activeWorkspaceId = useSelector(selectActiveWorkspaceId);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState(null);

  const activeWorkspace = workspaces.find((w) => w.recordId === activeWorkspaceId);
  const displayName = activeWorkspace?.name || 'All Environments';

  // Hide selector if no workspaces exist
  if (workspaces.length === 0) return null;

  const handleSelect = (workspaceId) => {
    dispatch(setActiveWorkspace(workspaceId));
    setIsDropdownOpen(false);
  };

  const handleEdit = (e, workspace) => {
    e.stopPropagation();
    setEditingWorkspace(workspace);
    setIsModalOpen(true);
    setIsDropdownOpen(false);
  };

  const handleCreate = () => {
    setEditingWorkspace(null);
    setIsModalOpen(true);
    setIsDropdownOpen(false);
  };

  if (isCollapsed) {
    return (
      <>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center justify-center p-1.5 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              <Layers className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            {displayName}
          </TooltipContent>
        </Tooltip>
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

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <Layers className="h-4 w-4 flex-shrink-0 text-gray-400" />
          <span className="flex-1 text-left truncate">{displayName}</span>
          <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isDropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsDropdownOpen(false)}
            />
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto">
              {/* All Environments option */}
              <button
                onClick={() => handleSelect(null)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Layers className="h-3.5 w-3.5 text-gray-400" />
                <span className="flex-1 text-left">All Environments</span>
                {!activeWorkspaceId && <Check className="h-3.5 w-3.5 text-primary-600" />}
              </button>

              {workspaces.length > 0 && (
                <div className="border-t border-gray-100 my-1" />
              )}

              {workspaces.map((ws) => (
                <button
                  key={ws.recordId}
                  onClick={() => handleSelect(ws.recordId)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors group"
                >
                  <Layers className="h-3.5 w-3.5 text-gray-400" />
                  <div className="flex-1 text-left min-w-0">
                    <div className="truncate">{ws.name}</div>
                    <div className="text-[11px] text-gray-400">{ws.environments.length} environment{ws.environments.length !== 1 ? 's' : ''}</div>
                  </div>
                  {activeWorkspaceId === ws.recordId && (
                    <Check className="h-3.5 w-3.5 text-primary-600 flex-shrink-0" />
                  )}
                  <Settings2
                    className="h-3.5 w-3.5 text-gray-300 opacity-0 group-hover:opacity-100 flex-shrink-0 hover:text-gray-500"
                    onClick={(e) => handleEdit(e, ws)}
                  />
                </button>
              ))}

              <div className="border-t border-gray-100 my-1" />

              {/* Create new workspace */}
              <button
                onClick={handleCreate}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-primary-600 hover:bg-primary-50 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Workspace</span>
              </button>
            </div>
          </>
        )}
      </div>

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
