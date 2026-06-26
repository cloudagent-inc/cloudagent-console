import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Square, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createWellArchitectedWorkload,
  updateWellArchitectedWorkload,
} from '@/features/wellArchitected/wellArchitectedSlice';
import {
  findPermissionProfileByAwsAccountId,
  findPermissionProfileById,
  getPermissionProfileId,
} from '@/features/workload/workloadEnvironmentUtils';

// Lens options for Well-Architected framework (same as asecurecloud)
const LENS_OPTIONS = [
  {
    key: 'wellarchitected',
    text: 'AWS Well-Architected',
    value: 'wellarchitected',
    required: true,
  },
  { key: 'serverless', text: 'Serverless Lens', value: 'serverless' },
  { key: 'saas', text: 'SaaS Lens', value: 'softwareasaservice' },
  {
    key: 'containerbuild',
    text: 'Container Build Lens',
    value: 'arn:aws:wellarchitected::aws:lens/containerbuild',
  },
  {
    key: 'machinelearning',
    text: 'Machine Learning Lens',
    value: 'arn:aws:wellarchitected::aws:lens/machinelearning',
  },
  {
    key: 'devops',
    text: 'DevOps Lens',
    value: 'arn:aws:wellarchitected::aws:lens/devops',
  },
  {
    key: 'healthcare',
    text: 'Healthcare Lens',
    value: 'arn:aws:wellarchitected::aws:lens/healthcare',
  },
  {
    key: 'genai',
    text: 'Generative AI Lens',
    value: 'arn:aws:wellarchitected::aws:lens/genai',
  },
];

function WellArchitectedWorkloadModal({
  isOpen,
  onClose,
  userProfile,
  existingWorkloads = [],
  onWorkloadCreated,
  onWorkloadUpdated,
  editWorkload = null,
  selectedAccountId = null,
}) {
  const dispatch = useDispatch();
  const { createLoading, updateLoading } = useSelector(
    (state) => state.wellArchitected
  );

  // Form state
  const [workloadName, setWorkloadName] = useState('');
  const [selectedLenses, setSelectedLenses] = useState(['wellarchitected']);

  // Error state
  const [error, setError] = useState(null);

  // Parse existing workload data for editing
  const parseDeploymentPreferences = (workload) => {
    if (!workload?.deploymentPreferences) return {};
    return typeof workload.deploymentPreferences === 'string'
      ? JSON.parse(workload.deploymentPreferences)
      : workload.deploymentPreferences;
  };

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (editWorkload && editWorkload.workloadId) {
        // Editing existing workload
        const prefs = parseDeploymentPreferences(editWorkload);
        setWorkloadName(editWorkload.workloadName || '');
        // Handle lenses from both deploymentPreferences (local) and direct property (AWS API)
        const lenses = prefs.lenses || editWorkload.lenses || editWorkload.Lenses || ['wellarchitected'];
        setSelectedLenses(lenses);
      } else {
        // Creating new workload
        setWorkloadName('');
        setSelectedLenses(['wellarchitected']);
      }
      setError(null);
    }
  }, [isOpen, editWorkload]);

  // Handle lens selection
  const handleLensChange = (lensValue, checked) => {
    // wellarchitected lens is required
    if (lensValue === 'wellarchitected' && !checked) {
      return;
    }

    if (checked) {
      setSelectedLenses((prev) => [...prev, lensValue]);
    } else {
      setSelectedLenses((prev) => prev.filter((l) => l !== lensValue));
    }
  };

  // Handle save
  const handleSave = () => {
    // Validation
    if (!workloadName.trim()) {
      setError('Workload name is required');
      return;
    }

    // Check for duplicate name (only for new workloads)
    if (!editWorkload?.workloadId) {
      const existingNames = existingWorkloads.map(
        (w) => w.workloadName || w.name
      );
      if (existingNames.includes(workloadName.trim())) {
        setError(
          'Workload name already exists. Please choose a different name.'
        );
        return;
      }
    }

    setError(null);

    const workloadData = {
      workloadName: workloadName.trim(),
      lenses: selectedLenses,
    };

    if (editWorkload?.workloadId) {
      // Update existing workload
      const updatedData = {
        workloadId: editWorkload.workloadId,
        workloadName: workloadData.workloadName,
        deploymentPreferences: JSON.stringify({
          type: 'well-architected',
          lenses: selectedLenses,
        }),
      };

      // Dispatch to Redux for local workloads
      dispatch(updateWellArchitectedWorkload(updatedData));

      // Call callback for parent component to update local state (e.g., AWS workloads)
      if (onWorkloadUpdated) {
        onWorkloadUpdated({
          ...editWorkload,
          ...updatedData,
          Lenses: selectedLenses, // Also update Lenses for AWS format
        });
      }

      toast.success(`Workload "${workloadName}" updated successfully!`);
    } else {
      // Create new workload with selected account
      const permissionProfiles = userProfile?.agentPermissionProfiles || [];
      const selectedPermissionProfile =
        findPermissionProfileById(permissionProfiles, selectedAccountId) ||
        findPermissionProfileByAwsAccountId(permissionProfiles, selectedAccountId);
      const environmentId =
        getPermissionProfileId(selectedPermissionProfile) || selectedAccountId;
      const workloadId = uuidv4();
      const createdWorkload = {
        ...workloadData,
        workloadId,
        environments: environmentId ? [environmentId] : [],
      };
      dispatch(
        createWellArchitectedWorkload(createdWorkload)
      );
      toast.success(`Workload "${workloadName}" created successfully!`);

      if (onWorkloadCreated) {
        onWorkloadCreated(createdWorkload);
      }
    }

    onClose();
  };

  const isLoading = createLoading || updateLoading;
  const isEditing = !!editWorkload?.workloadId;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-semibold">
            Workload Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Workload Name */}
          <div className="space-y-2">
            <Label htmlFor="workload-name" className="text-sm font-medium">
              Well-Architected Workload Name{' '}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="workload-name"
              value={workloadName}
              onChange={(e) => setWorkloadName(e.target.value)}
              placeholder="Workload Name"
              disabled={isEditing}
            />
          </div>

          {/* Lenses Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Lenses</Label>
            <p className="text-sm text-gray-500">
              Select all the lenses that apply.
            </p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {/* First column - first 5 lenses */}
              <div className="space-y-2">
                {LENS_OPTIONS.slice(0, 5).map((lens) => (
                  <div
                    key={lens.key}
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() =>
                      handleLensChange(
                        lens.value,
                        !selectedLenses.includes(lens.value)
                      )
                    }
                  >
                    {selectedLenses.includes(lens.value) ? (
                      <CheckSquare className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-400" />
                    )}
                    <span
                      className={`text-sm ${
                        selectedLenses.includes(lens.value)
                          ? 'text-blue-600 font-medium'
                          : 'text-gray-700'
                      }`}
                    >
                      {lens.text}
                    </span>
                  </div>
                ))}
              </div>
              {/* Second column - remaining lenses */}
              <div className="space-y-2">
                {LENS_OPTIONS.slice(5).map((lens) => (
                  <div
                    key={lens.key}
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() =>
                      handleLensChange(
                        lens.value,
                        !selectedLenses.includes(lens.value)
                      )
                    }
                  >
                    {selectedLenses.includes(lens.value) ? (
                      <CheckSquare className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-400" />
                    )}
                    <span
                      className={`text-sm ${
                        selectedLenses.includes(lens.value)
                          ? 'text-blue-600 font-medium'
                          : 'text-gray-700'
                      }`}
                    >
                      {lens.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || !workloadName.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditing ? 'Saving...' : 'Creating...'}
              </>
            ) : isEditing ? (
              'Save'
            ) : (
              'Create'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WellArchitectedWorkloadModal;
