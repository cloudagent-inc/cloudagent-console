import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useDispatch } from 'react-redux';
import { updateAgentPermissionProfile } from '../../features/agent/agentSlice';
import { azureAccountFunctions } from '../../api/apigw';
import toast from 'react-hot-toast';
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';

const EditAzureSubscriptionModal = ({ isOpen, onClose, permission }) => {
  const dispatch = useDispatch();

  const authProfile = useMemo(() => {
    if (!permission?.authProfile) return {};
    if (typeof permission.authProfile === 'string') {
      try { return JSON.parse(permission.authProfile) || {}; }
      catch { return {}; }
    }
    return permission.authProfile || {};
  }, [permission]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    subscriptionId: '',
    tenantId: '',
    clientId: '',
    clientSecret: '',
    tenantEnvironment: 'public',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [validationState, setValidationState] = useState({
    isLoading: false,
    receivedResponse: false,
    status: null,
    message: '',
  });

  useEffect(() => {
    if (permission) {
      setFormData({
        name: permission.name || '',
        description: permission.description || '',
        subscriptionId: authProfile.subscriptionId || '',
        tenantId: authProfile.tenantId || '',
        clientId: authProfile.clientId || '',
        clientSecret: authProfile.clientSecret || '',
        tenantEnvironment: authProfile.tenantEnvironment || 'public',
      });
    }
  }, [permission, authProfile]);

  const credentialFields = new Set(['clientId', 'clientSecret']);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (credentialFields.has(field) && validationState.receivedResponse) {
      setValidationState({ isLoading: false, receivedResponse: false, status: null, message: '' });
    }
  };

  const handleValidate = async () => {
    setValidationState({ isLoading: true, receivedResponse: false, status: null, message: '' });

    try {
      const params = {
        eventType: 'validate_creds',
        subscriptionIds: [formData.subscriptionId],
        tenantId: formData.tenantId,
        clientId: formData.clientId,
        clientSecret: formData.clientSecret,
        tenantEnvironment: formData.tenantEnvironment || 'public',
      };

      const result = await azureAccountFunctions(params);
      const success = result?.status === 200;
      setValidationState({
        isLoading: false,
        receivedResponse: true,
        status: success ? 'success' : 'error',
        message: success ? 'Connection validated successfully' : (result?.error || 'Validation failed'),
      });

      if (success) toast.success('Azure connection validated');
      else toast.error(result?.error || 'Validation failed');
    } catch (error) {
      console.error('Azure validation error:', error);
      setValidationState({
        isLoading: false,
        receivedResponse: true,
        status: 'error',
        message: 'Validation failed — check credentials',
      });
      toast.error('Validation failed');
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('Description is required');
      return;
    }

    setIsSaving(true);
    try {
      const updatedAuthProfile = {
        provider: 'azure',
        tenantId: formData.tenantId,
        clientId: formData.clientId,
        clientSecret: formData.clientSecret,
        tenantEnvironment: formData.tenantEnvironment,
        subscriptionId: formData.subscriptionId,
        subscriptionName: formData.name,
      };

      await dispatch(
        updateAgentPermissionProfile({
          recordId: permission.recordId,
          name: formData.name,
          type: 'azure subscription',
          description: formData.description,
          authProfile: JSON.stringify(updatedAuthProfile),
        }),
      ).unwrap();

      toast.success('Subscription updated');
      onClose();
    } catch (error) {
      console.error('Error updating Azure subscription:', error);
      toast.error('Failed to update subscription');
    } finally {
      setIsSaving(false);
    }
  };

  const credentialsChanged =
    formData.clientId !== (authProfile.clientId || '') ||
    formData.clientSecret !== (authProfile.clientSecret || '');
  const needsRevalidation = credentialsChanged && validationState.status !== 'success';

  const getAlertClass = () => {
    if (validationState.status === 'success') return 'bg-green-50 border-green-200';
    if (validationState.status === 'error') return 'bg-red-50 border-red-200';
    return 'bg-primary-50';
  };

  const getIcon = () => {
    if (validationState.status === 'success') return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (validationState.status === 'error') return <XCircle className="h-5 w-5 text-red-600" />;
    return <AlertCircle className="h-5 w-5" />;
  };

  if (!permission) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white max-h-[95vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <img src="/logo-azure.png" alt="Azure" className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-[600] text-primary-800">
                Edit Azure Subscription
              </DialogTitle>
              <DialogDescription>
                Update your Azure subscription settings and credentials.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Subscription Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Description <span className="text-red-500">*</span>
              </Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Description"
              />
            </div>
          </div>

          {/* Subscription Info (read-only) */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-900">Subscription Details</h3>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-500">Subscription ID</Label>
              <Input
                value={formData.subscriptionId}
                disabled
                className="bg-gray-100 text-gray-600 cursor-not-allowed font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-500">Tenant ID</Label>
              <Input
                value={formData.tenantId}
                disabled
                className="bg-gray-100 text-gray-600 cursor-not-allowed font-mono text-sm"
              />
            </div>
          </div>

          {/* Credentials */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-900">Service Principal Credentials</h3>
            <p className="text-sm text-gray-600">
              Override credentials for this subscription, or leave unchanged to use the tenant's credentials.
            </p>

            <div className="space-y-2">
              <Label htmlFor="clientId" className="text-sm font-medium">Application (Client) ID</Label>
              <Input
                id="clientId"
                value={formData.clientId}
                onChange={(e) => handleChange('clientId', e.target.value.trim())}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientSecret" className="text-sm font-medium">Client Secret</Label>
              <Input
                id="clientSecret"
                type="password"
                value={formData.clientSecret}
                onChange={(e) => handleChange('clientSecret', e.target.value)}
                placeholder="Enter new client secret to update"
              />
            </div>
          </div>

          {/* Validate Connection */}
          {credentialsChanged && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900">Validate Connection</h3>
              <Alert className={getAlertClass()}>
                <div className="flex items-start gap-4">
                  <div className="mt-1">{getIcon()}</div>
                  <div className="flex-1">
                    <AlertTitle className="flex items-center justify-between mb-0">
                      <span>
                        {validationState.receivedResponse
                          ? validationState.message
                          : 'Validate the updated credentials'}
                      </span>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleValidate}
                        disabled={validationState.isLoading || !formData.clientId || !formData.clientSecret}
                        className="ml-4"
                      >
                        {validationState.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Validate
                      </Button>
                    </AlertTitle>
                    {validationState.status === 'error' && (
                      <AlertDescription className="text-red-600 mt-2">
                        Check that the Client ID and Client Secret are correct.
                      </AlertDescription>
                    )}
                  </div>
                </div>
              </Alert>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !formData.name.trim() || !formData.description.trim() || needsRevalidation}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {needsRevalidation ? 'Validate First' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditAzureSubscriptionModal;
