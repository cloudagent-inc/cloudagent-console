import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Shield,
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { resolveWorkloadEnvironmentRef } from '@/features/workload/workloadEnvironmentUtils';

// Lens display names
const LENS_NAMES = {
  wellarchitected: 'Well-Architected',
  serverless: 'Serverless',
  softwareasaservice: 'SaaS',
  'arn:aws:wellarchitected::aws:lens/containerbuild': 'Container Build',
  'arn:aws:wellarchitected::aws:lens/machinelearning': 'Machine Learning',
  'arn:aws:wellarchitected::aws:lens/devops': 'DevOps',
  'arn:aws:wellarchitected::aws:lens/healthcare': 'Healthcare',
  'arn:aws:wellarchitected::aws:lens/genai': 'Generative AI',
};

function WellArchitectedWorkloadCard({
  workload,
  userProfile,
  onEdit,
  onDelete,
  onOpen,
}) {
  // Parse deployment preferences
  const deploymentPreferences = useMemo(() => {
    if (!workload?.deploymentPreferences) return {};
    return typeof workload.deploymentPreferences === 'string'
      ? JSON.parse(workload.deploymentPreferences)
      : workload.deploymentPreferences;
  }, [workload]);

  const lenses = deploymentPreferences.lenses || ['wellarchitected'];
  const environment = deploymentPreferences.environment || 'PRODUCTION';
  const awsRegion = deploymentPreferences.awsRegions?.[0] || 'us-east-1';
  const reviewOwner = deploymentPreferences.reviewOwner || '';
  const workloadScope = deploymentPreferences.workloadScope || 'all';

  // Get environment display name
  const getEnvironmentName = (envId) => {
    if (!envId) return 'No environment';
    const resolved = resolveWorkloadEnvironmentRef(
      envId,
      userProfile?.agentPermissionProfiles || []
    );
    if (!resolved) return envId;
    return `${resolved.name}${resolved.accountId ? ` (${resolved.accountId})` : ''}`;
  };

  return (
    <Card className="bg-white hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-base">
                {workload.workloadName}
              </h3>
              <p className="text-xs text-gray-500">
                {environment === 'PRODUCTION' ? 'Production' : 'Pre-Production'}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(workload)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpen?.(workload)}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete?.(workload)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Description */}
        {workload.description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            {workload.description}
          </p>
        )}

        {/* Lenses */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Lenses</p>
          <div className="flex flex-wrap gap-1">
            {lenses.slice(0, 3).map((lens) => (
              <Badge
                key={lens}
                variant="secondary"
                className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100"
              >
                {LENS_NAMES[lens] || lens}
              </Badge>
            ))}
            {lenses.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{lenses.length - 3} more
              </Badge>
            )}
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-500">Region</p>
            <p className="font-medium text-gray-700">{awsRegion}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Scope</p>
            <p className="font-medium text-gray-700 capitalize">
              {workloadScope === 'all' ? 'All Resources' : workloadScope}
            </p>
          </div>
        </div>

        {/* Environment */}
        {workload.environments?.[0] && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-gray-500">Cloud Environment</p>
            <p className="text-sm font-medium text-gray-700">
              {getEnvironmentName(workload.environments[0])}
            </p>
          </div>
        )}

        {/* Review Owner */}
        {reviewOwner && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-gray-500">Review Owner</p>
            <p className="text-sm text-gray-700">{reviewOwner}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default WellArchitectedWorkloadCard;
