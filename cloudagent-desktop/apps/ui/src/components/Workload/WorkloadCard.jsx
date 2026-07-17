import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import {
  getAwsAccountIdForWorkloadEnvironment,
  resolveWorkloadEnvironmentRef,
} from '@/features/workload/workloadEnvironmentUtils';

const WorkloadCard = ({ workload, userProfile, onDelete, onOpen }) => {
  const permissionProfiles = userProfile?.agentPermissionProfiles || [];

  const environments = Array.isArray(workload?.environments)
    ? workload.environments
    : [];

  return (
    <div
      className="flex flex-col p-4 bg-white border rounded-lg cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onOpen?.(workload)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen?.(workload);
        }
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-2 capitalize">
            {workload?.workloadName || 'Untitled workload'}
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            {workload?.description || 'No description'}
          </p>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Environment:
            </h4>
            <div className="space-y-1">
              {environments.map((environmentRef, index) => {
                const resolved = resolveWorkloadEnvironmentRef(
                  environmentRef,
                  permissionProfiles
                );
                const awsAccountId = getAwsAccountIdForWorkloadEnvironment(
                  environmentRef,
                  permissionProfiles
                );
                const displayName = resolved?.name || String(environmentRef || '');

                return (
                  <div
                    key={`${resolved?.permissionProfileId || environmentRef}-${index}`}
                    className="flex items-center gap-2"
                  >
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                      {displayName}
                    </span>
                    {awsAccountId ? (
                      <span className="text-xs text-gray-500">{awsAccountId}</span>
                    ) : null}
                  </div>
                );
              })}
              {environments.length === 0 && (
                <span className="text-xs text-gray-400">No environments set</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={(event) => {
              event.stopPropagation();
              onDelete?.(workload);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WorkloadCard;
