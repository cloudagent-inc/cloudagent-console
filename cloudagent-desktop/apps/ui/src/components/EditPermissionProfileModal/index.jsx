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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useDispatch, useSelector } from 'react-redux';
import { updateAgentPermissionProfile } from '../../features/agent/agentSlice';
import { createPermissionProfileWorkload, normalizeWorkloadId } from '../../api/ops';
import { getCfTemplateForIamRole } from '../../helpers/iamPermissions';
import LaunchStack from '../LaunchStack';
import { saveToFile, generateRandomString } from '../../helpers/shared';
import { validateAwsCredentialsV2 } from '../../api/apigw';
import toast from 'react-hot-toast';
import { Loader2, Plus, RefreshCw, AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { SCAN_ENGINE_AWS_ACCOUNT_IDS } from '@/config/appConfig';

const EditPermissionProfileModal = ({ isOpen, onClose, permission }) => {
  const dispatch = useDispatch();
  const { workloads: storeWorkloads } = useSelector((state) => state.workload);
  const { userProfile } = useSelector((state) => state.auth);

  // Parse authProfile
  const authProfile = useMemo(() => {
    if (!permission?.authProfile) return {};
    if (typeof permission.authProfile === 'string') {
      try {
        return JSON.parse(permission.authProfile) || {};
      } catch {
        return {};
      }
    }
    return permission.authProfile || {};
  }, [permission]);
  const isAwsAccountPermission = useMemo(() => {
    const profileType = String(permission?.type || '')
      .trim()
      .toLowerCase()
      .replace(/_/g, ' ');
    return profileType === 'aws account' || (!profileType && !!authProfile?.awsAccountId);
  }, [authProfile?.awsAccountId, permission?.type]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    awsAccountId: '',
    roleName: '',
    externalId: '',
    stackArn: '',
    workloadId: '',
  });

  const [redeploymentMethod, setRedeploymentMethod] = useState('cloudformation');
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingWorkload, setIsCreatingWorkload] = useState(false);
  const [showRedeployment, setShowRedeployment] = useState(false);
  const [showWorkloadDetails, setShowWorkloadDetails] = useState(false);
  const [validationState, setValidationState] = useState({
    isLoading: false,
    receivedResponse: false,
    code: 0,
    message: '',
    regionsUsed: [],
    stack: null,
  });

  // Initialize form data when permission changes
  useEffect(() => {
    if (permission) {
      setFormData({
        name: permission.name || '',
        description: permission.description || '',
        awsAccountId: authProfile.awsAccountId || '',
        roleName: authProfile.roleName || '',
        externalId: authProfile.externalId || '',
        stackArn: authProfile.stackArn || '',
        workloadId: normalizeWorkloadId(authProfile.workloadId) || '',
      });
    }
  }, [permission, authProfile]);

  // Get available workloads
  const availableWorkloads = useMemo(() => {
    return storeWorkloads || [];
  }, [storeWorkloads]);

  // CloudFormation template for redeployment
  const cfTemplate = useMemo(() => {
    if (!formData.roleName || !formData.externalId) return null;
    return getCfTemplateForIamRole({
      roleName: formData.roleName,
      externalId: formData.externalId,
      managedPolicies: [],
      inlinePolicies: [],
      temporaryAccessHours: 0,
    });
  }, [formData.roleName, formData.externalId]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateWorkload = async () => {
    if (!isAwsAccountPermission) {
      toast.error('Workloads can only be created for AWS account environments.');
      return;
    }

    if (!formData.awsAccountId || !formData.stackArn) {
      toast.error('AWS Account ID and Stack ARN are required to create a workload');
      return;
    }

    setIsCreatingWorkload(true);
    let toastId;
    try {
      toastId = toast.loading('Creating workload...');
      const result = await createPermissionProfileWorkload({
        permissionProfileId: permission?.recordId || permission?.id,
        accountId: formData.awsAccountId,
        stackArn: formData.stackArn,
      });

      if (result?.success && result?.workloadId) {
        handleInputChange('workloadId', result.workloadId);
        toast.success(`Workload created: ${result.workloadId}`, { id: toastId });
      } else {
        toast.error(result?.message || 'Failed to create workload', { id: toastId });
      }
    } catch (error) {
      console.error('Workload creation failed', error);
      toast.error('Failed to create workload', { id: toastId });
    } finally {
      setIsCreatingWorkload(false);
    }
  };

  const handleDownloadCloudFormation = () => {
    if (!cfTemplate) {
      toast.error('CloudFormation template not available');
      return;
    }
    const templateJson = JSON.stringify(cfTemplate, null, 2);
    saveToFile(templateJson, 'cloudformation-template.json', 'application/json');
    toast.success('CloudFormation template downloaded');
  };

  const handleValidate = async () => {
    setValidationState((prev) => ({
      ...prev,
      isLoading: true,
      receivedResponse: false,
    }));

    try {
      const payload = {
        authProfile: {
          authType: 'assumeRole',
          accountId: formData.awsAccountId,
          roleName: formData.roleName,
          externalId: formData.externalId,
        },
      };

      const response = await validateAwsCredentialsV2(payload);

      const success = response?.code === 200 && response?.role?.exists === true;
      setValidationState({
        isLoading: false,
        receivedResponse: true,
        code: response?.code || 0,
        message: success
          ? 'Validation successful'
          : (response?.message || 'Validation failed'),
        regionsUsed: response?.regionsUsed || [],
        stack: response?.stack || null,
      });

      if (success) {
        toast.success('Validation successful');
        // Update stack ARN if provided in response
        if (response?.stack?.arn && !formData.stackArn) {
          handleInputChange('stackArn', response.stack.arn);
        }
      } else {
        toast.error(response?.message || 'Validation failed');
      }
    } catch (err) {
      console.error('Validation error:', err);
      setValidationState({
        isLoading: false,
        receivedResponse: true,
        code: 500,
        message: 'Validation failed',
        regionsUsed: [],
        stack: null,
      });
      toast.error('Validation failed');
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setIsSaving(true);
    try {
      const updatePayload = {
        recordId: permission.recordId,
        name: formData.name,
        description: formData.description,
        roleName: formData.roleName || undefined,
        externalId: formData.externalId || undefined,
        stackArn: formData.stackArn || undefined,
        workloadId: formData.workloadId || undefined,
      };

      await dispatch(updateAgentPermissionProfile(updatePayload)).unwrap();
      toast.success('Permission profile updated successfully');
      onClose();
    } catch (error) {
      console.error('Error updating permission profile:', error);
      toast.error('Failed to update permission profile');
    } finally {
      setIsSaving(false);
    }
  };

  const getValidationAlertVariant = () => {
    if (!validationState.receivedResponse) return 'default';
    return validationState.code === 200 ? 'default' : 'destructive';
  };

  const getValidationIcon = () => {
    if (!validationState.receivedResponse) return <AlertCircle className="h-5 w-5" />;
    if (validationState.code === 200)
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    return <XCircle className="h-5 w-5 text-red-600" />;
  };

  if (!permission) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white max-h-[95vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-[600] text-primary-800">
            Edit Permission Profile
          </DialogTitle>
          <DialogDescription>
            Update your permission profile details and redeploy permissions if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Name and Description */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Permission Profile Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Description
              </Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Description"
              />
            </div>
          </div>

          {/* Validation Section */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-900">Validate Permissions</h3>
            <p className="text-sm text-gray-600">
              Validate that the IAM role and credentials are properly configured in your AWS account
            </p>
            <Alert 
              variant={getValidationAlertVariant()} 
              className={validationState.receivedResponse && validationState.code === 200 
                ? "bg-green-50 border-green-200" 
                : "bg-primary-50"
              }
            >
              <div className="flex items-start gap-4">
                <div className="mt-1">{getValidationIcon()}</div>
                <div className="flex-1">
                  <AlertTitle className="flex items-center justify-between mb-0">
                    <span>
                      {validationState.receivedResponse
                        ? validationState.message
                        : 'Validate that credentials were properly deployed'}
                    </span>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleValidate}
                      disabled={validationState.isLoading || !formData.awsAccountId || !formData.roleName || !formData.externalId}
                      className="ml-4"
                    >
                      {validationState.isLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Validate
                    </Button>
                  </AlertTitle>
                  {validationState.receivedResponse && validationState.code !== 200 && (
                    <AlertDescription className="text-red-600 mt-2">
                      <div className="font-medium">Validation error</div>
                      <div className="mt-1 break-words">
                        {validationState.message || 'Validation failed'}
                      </div>
                      <div className="mt-2 text-red-700">
                        Make sure that the IAM role was successfully deployed to the AWS account
                        and the IAM role name and external id match the above settings.
                      </div>
                    </AlertDescription>
                  )}
                  {validationState.receivedResponse && validationState.code === 200 && (
                    <AlertDescription className="text-green-700 mt-2">
                      Validation successful. The IAM role is properly configured.
                    </AlertDescription>
                  )}
                </div>
              </div>
            </Alert>
          </div>

          {/* AWS Account Configuration */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-900">AWS Account Configuration</h3>
            <div className="space-y-2">
              <Label htmlFor="awsAccountId" className="text-sm font-medium text-gray-500">
                AWS Account ID
              </Label>
              <Input
                id="awsAccountId"
                value={formData.awsAccountId}
                disabled
                className="bg-gray-100 text-gray-600 cursor-not-allowed"
              />
            </div>

            {/* IAM Role Name (editable) */}
            <div className="space-y-2">
              <Label htmlFor="roleName" className="text-sm font-medium">
                IAM Role Name
              </Label>
              <Input
                id="roleName"
                value={formData.roleName}
                onChange={(e) => handleInputChange('roleName', e.target.value)}
                placeholder="IAM Role Name"
              />
            </div>

            {/* External ID (read-only with regenerate button) */}
            <div className="space-y-2">
              <Label htmlFor="externalId" className="text-sm font-medium">
                External ID
              </Label>
              <div className="flex gap-2">
                <Input
                  id="externalId"
                  value={formData.externalId}
                  disabled
                  className="bg-gray-100 text-gray-600 cursor-not-allowed flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleInputChange('externalId', generateRandomString(6))}
                  className="whitespace-nowrap"
                  title="Generate new External ID"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              </div>
            </div>
          </div>

          {/* Workload Details (collapsible) */}
          <div className="space-y-4 border-t pt-4">
            <button
              type="button"
              onClick={() => setShowWorkloadDetails(!showWorkloadDetails)}
              className="flex items-center justify-between w-full text-left"
            >
              <h3 className="text-lg font-semibold text-gray-900">Workload Details</h3>
              {showWorkloadDetails ? (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </button>

            {showWorkloadDetails && (
              <div className="space-y-4 pl-4 border-l-2 border-gray-200">
                <div className="space-y-2">
                  <Label htmlFor="stackArn" className="text-sm font-medium">
                    CloudFormation Stack ARN
                  </Label>
                  <Input
                    id="stackArn"
                    value={formData.stackArn}
                    onChange={(e) => handleInputChange('stackArn', e.target.value)}
                    placeholder="arn:aws:cloudformation:region:account:stack/stack-name/id"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workloadId" className="text-sm font-medium">
                    Workload
                  </Label>
                  {formData.workloadId ? (
                    <div className="flex items-center gap-2">
                      <Input
                        id="workloadId"
                        value={
                          availableWorkloads.find((w) => w.workloadId === formData.workloadId)
                            ?.workloadName || formData.workloadId
                        }
                        disabled
                        className="bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="flex-1 text-sm text-gray-500 py-2 px-3 border border-gray-200 rounded-md bg-gray-50">
                        No workload associated
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCreateWorkload}
                        disabled={isCreatingWorkload || !formData.awsAccountId || !formData.stackArn}
                        className="whitespace-nowrap"
                      >
                        {isCreatingWorkload ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Workload
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    {formData.workloadId
                      ? 'Workload is associated with this permission profile'
                      : 'Create a workload to associate with this permission profile'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Redeployment Section */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Redeploy Permissions</h3>
                <p className="text-sm text-gray-600">
                  Choose a method to redeploy IAM permissions to your AWS account
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowRedeployment(!showRedeployment)}
              >
                {showRedeployment ? 'Hide' : 'Show'} Options
              </Button>
            </div>

            {showRedeployment && (
              <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                {(!formData.roleName || !formData.externalId) && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> IAM Role Name and External ID are required to generate the CloudFormation template. 
                      These fields cannot be edited as they are tied to your existing AWS configuration.
                    </p>
                  </div>
                )}
                <RadioGroup
                  value={redeploymentMethod}
                  onValueChange={setRedeploymentMethod}
                  className="space-y-3"
                >
                  {/* Launch CloudFormation */}
                  <div className="flex items-start space-x-3 p-3 border rounded-lg bg-white">
                    <RadioGroupItem value="cloudformation" id="cloudformation" className="mt-1" />
                    <div className="flex-1">
                      <Label
                        htmlFor="cloudformation"
                        className="font-medium text-primary-600 cursor-pointer"
                      >
                        Launch CloudFormation Template
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Automatically prepares and launches the template in your AWS account
                      </p>
                      {redeploymentMethod === 'cloudformation' && (
                        <div className="mt-3">
                          {cfTemplate ? (
                            <LaunchStack
                              cfTemplate={JSON.stringify(cfTemplate, null, 2)}
                              isMissingRequiredConfiguration={false}
                              artifactTitle="cloudagent-iam-role"
                              label="Launch Template"
                            />
                          ) : (
                            <p className="text-sm text-gray-500 italic">
                              CloudFormation template unavailable. IAM Role Name and External ID are required.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Download CloudFormation */}
                  <div className="flex items-start space-x-3 p-3 border rounded-lg bg-white">
                    <RadioGroupItem value="download-cf" id="download-cf" className="mt-1" />
                    <div className="flex-1">
                      <Label
                        htmlFor="download-cf"
                        className="font-medium text-gray-700 cursor-pointer"
                      >
                        Download CloudFormation Template
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Download the CloudFormation template and deploy it using AWS CLI, console,
                        or your preferred deployment method
                      </p>
                      {redeploymentMethod === 'download-cf' && (
                        <div className="mt-3">
                          {cfTemplate ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleDownloadCloudFormation}
                            >
                              Download CloudFormation Template
                            </Button>
                          ) : (
                            <p className="text-sm text-gray-500 italic">
                              CloudFormation template unavailable. IAM Role Name and External ID are required.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Manual Steps */}
                  <div className="flex items-start space-x-3 p-3 border rounded-lg bg-white">
                    <RadioGroupItem value="manual" id="manual" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="manual" className="font-medium text-gray-700 cursor-pointer">
                        Manual Steps
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        Follow step-by-step instructions to manually set up the IAM permissions in
                        your AWS console
                      </p>
                      {redeploymentMethod === 'manual' && (
                        <div className="mt-3 p-3 bg-gray-50 rounded border">
                          <p className="text-sm text-gray-700 font-medium mb-2">
                            Manual Setup Instructions:
                          </p>
                          <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                            <li>Log in to your AWS Console</li>
                            <li>Navigate to IAM → Roles</li>
                            <li>Create a new role with the following trust policy:</li>
                          </ol>
                          <div className="mt-2 mb-2">
                            <pre className="bg-white p-3 rounded text-xs overflow-x-auto border">
                              {JSON.stringify(
                                {
                                  Version: '2012-10-17',
                                  Statement: [
                                    {
                                      Effect: 'Allow',
                                      Principal: {
                                        AWS: SCAN_ENGINE_AWS_ACCOUNT_IDS,
                                      },
                                      Action: 'sts:AssumeRole',
                                      Condition: {
                                        StringEquals: {
                                          'sts:ExternalId': formData.externalId || 'YOUR_EXTERNAL_ID',
                                        },
                                      },
                                    },
                                  ],
                                },
                                null,
                                2
                              )}
                            </pre>
                          </div>
                          <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside" start={4}>
                            <li>Attach the necessary IAM policies</li>
                            <li>Ensure the role name matches: <strong>{formData.roleName || 'YOUR_ROLE_NAME'}</strong></li>
                            <li>Ensure the External ID matches: <strong>{formData.externalId || 'YOUR_EXTERNAL_ID'}</strong></li>
                          </ol>
                        </div>
                      )}
                    </div>
                  </div>
                </RadioGroup>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !formData.name.trim()}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditPermissionProfileModal;
