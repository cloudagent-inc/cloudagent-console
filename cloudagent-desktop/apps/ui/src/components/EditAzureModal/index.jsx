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
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useDispatch, useSelector } from 'react-redux';
import { 
  updateAgentPermissionProfile, 
  createAgentPermissionProfile,
  deleteAgentPermissionProfile,
} from '../../features/agent/agentSlice';
import { azureAccountFunctions } from '../../api/apigw';
import toast from 'react-hot-toast';
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
} from 'lucide-react';

const ENVIRONMENT_OPTIONS = [
  { value: 'public', label: 'Azure Public' },
  { value: 'usgovernment', label: 'Azure US Government' },
];

const parseAuthProfileSafe = (rawAuthProfile) => {
  if (!rawAuthProfile) return {};
  if (typeof rawAuthProfile === 'object') return rawAuthProfile;
  if (typeof rawAuthProfile === 'string') {
    try { return JSON.parse(rawAuthProfile) || {}; }
    catch { return {}; }
  }
  return {};
};

const normalizeProfileType = (value) =>
  String(value || '').trim().toLowerCase().replace(/_/g, ' ');

const EditAzureModal = ({ isOpen, onClose, permission }) => {
  const dispatch = useDispatch();
  const userProfile = useSelector((state) => state.auth.userProfile);

  // Parse authProfile from the permission record
  const authProfile = useMemo(() => {
    if (!permission?.authProfile) return {};
    if (typeof permission.authProfile === 'string') {
      try { return JSON.parse(permission.authProfile) || {}; }
      catch { return {}; }
    }
    return permission.authProfile || {};
  }, [permission]);

  // Find all subscriptions that belong to this tenant
  const tenantSubscriptions = useMemo(() => {
    if (!permission || !userProfile?.agentPermissionProfiles) return [];
    const tenantRecordId = permission.recordId || permission.id;
    const tenantId = authProfile.tenantId;
    
    return userProfile.agentPermissionProfiles.filter((profile) => {
      const profileType = normalizeProfileType(profile.type);
      if (profileType !== 'azure subscription') return false;
      
      const profileAuth = parseAuthProfileSafe(profile.authProfile);
      const parentId = profileAuth?.tenantPermissionProfileId || profileAuth?.tenantProfileId;
      
      if (parentId && parentId === tenantRecordId) return true;
      if (tenantId && profileAuth?.tenantId === tenantId) return true;
      
      return false;
    });
  }, [permission, userProfile, authProfile]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
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

  // Subscription management state
  const [newSubscriptionId, setNewSubscriptionId] = useState('');
  const [newSubscriptionDesc, setNewSubscriptionDesc] = useState('');
  const [isAddingSubscription, setIsAddingSubscription] = useState(false);
  const [deletingSubscriptionId, setDeletingSubscriptionId] = useState(null);
  
  // Credential propagation confirmation
  const [showPropagateDialog, setShowPropagateDialog] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState(null);

  // Populate form when permission data arrives
  useEffect(() => {
    if (permission) {
      setFormData({
        name: permission.name || '',
        description: permission.description || '',
        tenantId: authProfile.tenantId || '',
        clientId: authProfile.clientId || '',
        clientSecret: authProfile.clientSecret || '',
        tenantEnvironment: authProfile.tenantEnvironment || 'public',
      });
    }
  }, [permission, authProfile]);

  // Fields that affect connectivity — changing any of these invalidates prior validation
  const credentialFields = new Set(['clientId', 'clientSecret', 'tenantEnvironment']);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (credentialFields.has(field) && validationState.receivedResponse) {
      setValidationState({ isLoading: false, receivedResponse: false, status: null, message: '' });
    }
  };

  // Check if credentials have changed
  const credentialsChanged =
    formData.clientId !== (authProfile.clientId || '') ||
    formData.clientSecret !== (authProfile.clientSecret || '') ||
    formData.tenantEnvironment !== (authProfile.tenantEnvironment || 'public');

  // --- Validation ---

  const handleValidate = async () => {
    setValidationState({ isLoading: true, receivedResponse: false, status: null, message: '' });

    try {
      const params = {
        eventType: 'validate_creds',
        subscriptionIds: [],
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

  // --- Save ---

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('Description is required');
      return;
    }

    // If credentials changed and there are subscriptions, ask about propagation
    if (credentialsChanged && tenantSubscriptions.length > 0) {
      setPendingSaveData({ propagate: false });
      setShowPropagateDialog(true);
      return;
    }

    await executeSave(false);
  };

  const executeSave = async (propagateToSubscriptions) => {
    setIsSaving(true);
    try {
      const updatedAuthProfile = {
        provider: 'azure',
        tenantId: formData.tenantId,
        clientId: formData.clientId,
        clientSecret: formData.clientSecret,
        tenantEnvironment: formData.tenantEnvironment,
      };

      await dispatch(
        updateAgentPermissionProfile({
          recordId: permission.recordId,
          name: formData.name,
          type: 'azure tenant',
          description: formData.description,
          authProfile: JSON.stringify(updatedAuthProfile),
        }),
      ).unwrap();

      // Propagate credentials to subscriptions if requested
      if (propagateToSubscriptions && tenantSubscriptions.length > 0) {
        await Promise.all(
          tenantSubscriptions.map((sub) => {
            const subAuth = parseAuthProfileSafe(sub.authProfile);
            const updatedSubAuth = {
              ...subAuth,
              clientId: formData.clientId,
              clientSecret: formData.clientSecret,
              tenantEnvironment: formData.tenantEnvironment,
            };
            return dispatch(
              updateAgentPermissionProfile({
                recordId: sub.recordId || sub.id,
                name: sub.name,
                type: 'azure subscription',
                description: sub.description,
                authProfile: JSON.stringify(updatedSubAuth),
              }),
            ).unwrap();
          }),
        );
        toast.success(`Tenant and ${tenantSubscriptions.length} subscription(s) updated`);
      } else {
        toast.success('Azure environment updated');
      }
      
      onClose();
    } catch (error) {
      console.error('Error updating Azure environment:', error);
      toast.error('Failed to update Azure environment');
    } finally {
      setIsSaving(false);
      setShowPropagateDialog(false);
      setPendingSaveData(null);
    }
  };

  // --- Subscription Management ---

  const handleAddSubscription = async () => {
    if (!newSubscriptionId.trim()) {
      toast.error('Subscription ID is required');
      return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(newSubscriptionId.trim())) {
      toast.error('Invalid subscription ID format');
      return;
    }

    setIsAddingSubscription(true);
    try {
      const subscriptionAuth = {
        provider: 'azure',
        tenantId: formData.tenantId,
        clientId: formData.clientId,
        clientSecret: formData.clientSecret,
        tenantEnvironment: formData.tenantEnvironment,
        subscriptionId: newSubscriptionId.trim(),
        subscriptionName: newSubscriptionDesc.trim() || newSubscriptionId.trim(),
        tenantPermissionProfileId: permission.recordId,
      };

      await dispatch(
        createAgentPermissionProfile({
          name: `${formData.name} / ${newSubscriptionDesc.trim() || newSubscriptionId.trim()}`,
          description: newSubscriptionDesc.trim() || `Azure subscription under ${formData.name}`,
          type: 'azure subscription',
          authProfile: JSON.stringify(subscriptionAuth),
        }),
      ).unwrap();

      toast.success('Subscription added');
      setNewSubscriptionId('');
      setNewSubscriptionDesc('');
    } catch (error) {
      console.error('Error adding subscription:', error);
      toast.error('Failed to add subscription');
    } finally {
      setIsAddingSubscription(false);
    }
  };

  const handleDeleteSubscription = async (subscription) => {
    const subId = subscription.recordId || subscription.id;
    setDeletingSubscriptionId(subId);
    try {
      await dispatch(deleteAgentPermissionProfile({ recordId: subId })).unwrap();
      toast.success('Subscription removed');
    } catch (error) {
      console.error('Error removing subscription:', error);
      toast.error('Failed to remove subscription');
    } finally {
      setDeletingSubscriptionId(null);
    }
  };

  const needsRevalidation = credentialsChanged && validationState.status !== 'success';

  // --- Validation UI helpers ---

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
                Edit Azure Environment
              </DialogTitle>
              <DialogDescription>
                Update your Azure service principal credentials and subscription access.
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
                placeholder="Environment Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Description"
              />
            </div>
          </div>

          {/* Validate Connection */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-900">Validate Connection</h3>
            <p className="text-sm text-gray-600">
              Verify that the service principal credentials are valid and can access the configured subscriptions.
            </p>
            <Alert className={getAlertClass()}>
              <div className="flex items-start gap-4">
                <div className="mt-1">{getIcon()}</div>
                <div className="flex-1">
                  <AlertTitle className="flex items-center justify-between mb-0">
                    <span>
                      {validationState.receivedResponse
                        ? validationState.message
                        : 'Validate that credentials are properly configured'}
                    </span>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleValidate}
                      disabled={validationState.isLoading || !formData.tenantId || !formData.clientId || !formData.clientSecret}
                      className="ml-4"
                    >
                      {validationState.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Validate
                    </Button>
                  </AlertTitle>
                  {validationState.status === 'error' && (
                    <AlertDescription className="text-red-600 mt-2">
                      Check that the Tenant ID, Client ID, and Client Secret are correct and that the service principal has the required permissions.
                    </AlertDescription>
                  )}
                </div>
              </div>
            </Alert>
          </div>

          {/* Azure Configuration */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-900">Azure Configuration</h3>

            <div className="space-y-2">
              <Label htmlFor="tenantId" className="text-sm font-medium text-gray-500">Tenant ID</Label>
              <Input
                id="tenantId"
                value={formData.tenantId}
                disabled
                className="bg-gray-100 text-gray-600 cursor-not-allowed font-mono text-sm"
              />
            </div>

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
              <p className="text-xs text-gray-500">Leave unchanged unless you need to rotate the secret.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Environment Type</Label>
              <div className="flex gap-3">
                {ENVIRONMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleChange('tenantEnvironment', opt.value)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      formData.tenantEnvironment === opt.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Subscriptions Management */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Subscriptions ({tenantSubscriptions.length})
            </h3>
            <p className="text-sm text-gray-600">
              Manage the Azure subscriptions associated with this tenant.
            </p>

            {/* Existing subscriptions */}
            {tenantSubscriptions.length > 0 && (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {tenantSubscriptions.map((sub) => {
                  const subAuth = parseAuthProfileSafe(sub.authProfile);
                  const subId = sub.recordId || sub.id;
                  const isDeleting = deletingSubscriptionId === subId;
                  
                  return (
                    <div
                      key={subId}
                      className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{sub.name}</p>
                        <p className="text-xs text-gray-500 font-mono truncate">
                          {subAuth.subscriptionId}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSubscription(sub)}
                        disabled={isDeleting}
                        className="text-red-500 hover:text-red-700 ml-3"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add new subscription */}
            <div className="p-3 border rounded-lg border-dashed space-y-3">
              <p className="text-sm font-medium text-gray-700">Add Subscription</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={newSubscriptionId}
                  onChange={(e) => setNewSubscriptionId(e.target.value.trim())}
                  placeholder="Subscription ID"
                  className="font-mono text-sm"
                />
                <Input
                  value={newSubscriptionDesc}
                  onChange={(e) => setNewSubscriptionDesc(e.target.value)}
                  placeholder="Description (optional)"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddSubscription}
                disabled={isAddingSubscription || !newSubscriptionId.trim()}
              >
                {isAddingSubscription ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add Subscription
              </Button>
            </div>
          </div>

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

      {/* Credential Propagation Confirmation Dialog */}
      <Dialog open={showPropagateDialog} onOpenChange={setShowPropagateDialog}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Update Subscription Credentials?</DialogTitle>
            <DialogDescription>
              You've updated the service principal credentials for this tenant. 
              Would you like to apply these changes to all {tenantSubscriptions.length} subscription(s) under this tenant as well?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowPropagateDialog(false);
                executeSave(false);
              }}
              disabled={isSaving}
            >
              Tenant Only
            </Button>
            <Button
              onClick={() => executeSave(true)}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Dialog>
  );
};

export default EditAzureModal;
