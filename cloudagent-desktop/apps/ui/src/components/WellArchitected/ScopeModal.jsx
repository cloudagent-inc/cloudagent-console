import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { X, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

// AWS Services that can be scoped
const INVENTORY_SERVICES = {
  IAM: [
    'Root Account',
    'IAM Role',
    'IAM User',
    'IAM Group',
    'IAM Policy',
    'IAM Provider',
  ],
  S3: ['S3 Bucket'],
  VPC: ['VPC', 'Subnet', 'Internet Gateway', 'Transit Gateway'],
  EC2: [
    'EBS Volume',
    'EBS Snapshot',
    'Security Group',
    'EC2 Instance',
    'Elastic IP',
  ],
  CloudTrail: ['CloudTrail Trail'],
  CloudWatch: ['CloudWatch Log Group'],
  KMS: ['Customer Master Key'],
  Lambda: ['Lambda Function'],
  RDS: ['RDS Instance', 'RDS Cluster'],
  EKS: ['EKS Cluster'],
  ECS: ['ECS Cluster', 'ECS Task Definition'],
};

function ScopeModal({
  isOpen,
  onClose,
  onSave,
  existingScopes = [],
  selectedScope = null,
}) {
  const [scopeName, setScopeName] = useState('');
  const [scopeDescription, setScopeDescription] = useState('');
  const [serviceSelections, setServiceSelections] = useState({});
  const [tags, setTags] = useState([{ key: '', value: '' }]);
  const [error, setError] = useState(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (selectedScope) {
        // Editing existing scope
        setScopeName(selectedScope.scopeName || '');
        setScopeDescription(selectedScope.scopeDescription || '');
        setServiceSelections(selectedScope.serviceScopeDefinitions || {});
        setTags(selectedScope.tags || [{ key: '', value: '' }]);
      } else {
        // Creating new scope
        setScopeName('');
        setScopeDescription('');
        setServiceSelections({});
        setTags([{ key: '', value: '' }]);
      }
      setError(null);
    }
  }, [isOpen, selectedScope]);

  // Handle service toggle
  const handleServiceToggle = (service, includeAll) => {
    setServiceSelections((prev) => {
      const newSelections = { ...prev };
      if (includeAll) {
        // Include all resources for this service
        delete newSelections[service];
      } else {
        // Exclude this service
        newSelections[service] = { includeAll: false };
      }
      return newSelections;
    });
  };

  // Handle tag change
  const handleTagChange = (index, field, value) => {
    const newTags = [...tags];
    newTags[index][field] = value;
    setTags(newTags);
  };

  // Add tag
  const handleAddTag = () => {
    setTags([...tags, { key: '', value: '' }]);
  };

  // Remove tag
  const handleRemoveTag = (index) => {
    const newTags = tags.filter((_, i) => i !== index);
    setTags(newTags.length > 0 ? newTags : [{ key: '', value: '' }]);
  };

  // Handle save
  const handleSave = () => {
    if (!scopeName.trim()) {
      setError('Workload name is required');
      return;
    }

    // Check for duplicate name
    const existingNames = existingScopes.map((s) => s.scopeName);
    if (!selectedScope && existingNames.includes(scopeName.trim())) {
      setError('A scope with this name already exists');
      return;
    }

    const scope = {
      scopeName: scopeName.trim(),
      scopeDescription: scopeDescription.trim(),
      serviceScopeDefinitions: serviceSelections,
      tags: tags.filter((t) => t.key.trim() && t.value.trim()),
    };

    if (onSave) {
      onSave(scope);
    }

    toast.success(selectedScope ? 'Scope updated successfully' : 'Scope created successfully');
    onClose();
  };

  const isEditing = !!selectedScope;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white z-[100]">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-semibold">
            {isEditing ? 'Edit Workload Definition' : 'Add Workload Definition'}
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
            <Label htmlFor="scope-name" className="text-sm font-medium">
              Workload Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="scope-name"
              value={scopeName}
              onChange={(e) => setScopeName(e.target.value)}
              placeholder="Enter workload name"
            />
          </div>

          {/* Workload Description */}
          <div className="space-y-2">
            <Label htmlFor="scope-description" className="text-sm font-medium">
              Workload Description
            </Label>
            <Textarea
              id="scope-description"
              value={scopeDescription}
              onChange={(e) => setScopeDescription(e.target.value)}
              placeholder="Enter workload description"
              rows={3}
            />
          </div>

          {/* Tags Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Resource Tags (Optional)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTag}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Tag
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              Filter resources by tags. Resources matching these tags will be included in the scope.
            </p>
            <div className="space-y-2">
              {tags.map((tag, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Input
                    value={tag.key}
                    onChange={(e) => handleTagChange(index, 'key', e.target.value)}
                    placeholder="Tag Key"
                    className="flex-1"
                  />
                  <Input
                    value={tag.value}
                    onChange={(e) => handleTagChange(index, 'value', e.target.value)}
                    placeholder="Tag Value"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveTag(index)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Services Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Service Scope</Label>
            <p className="text-sm text-gray-500">
              Select which services and resource types to include in this workload scope.
              Disabled services will be excluded from the scope.
            </p>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Service</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Resource Types</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 w-24">Include All</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(INVENTORY_SERVICES).map(([service, resourceTypes]) => {
                    const isIncluded = !serviceSelections[service] || serviceSelections[service].includeAll !== false;
                    return (
                      <tr key={service} className="border-b last:border-b-0 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-sm text-gray-900">{service}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {resourceTypes.map((type) => (
                              <span
                                key={type}
                                className={`inline-flex px-2 py-0.5 rounded text-xs ${
                                  isIncluded ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-400'
                                }`}
                              >
                                {type}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Switch
                            checked={isIncluded}
                            onCheckedChange={(checked) => handleServiceToggle(service, checked)}
                            className="data-[state=checked]:bg-primary-600"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!scopeName.trim()}>
            {isEditing ? 'Save Changes' : 'Create Scope'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ScopeModal;
