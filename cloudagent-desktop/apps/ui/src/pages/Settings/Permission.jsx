import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MoreVertical,
  Plus,
  Trash2,
  PencilIcon,
  AlertTriangle,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useDispatch, useSelector } from 'react-redux';
import { Skeleton } from '@/components/ui/skeleton';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  deleteAgentPermissionProfile,
  createAgentPermissionProfile,
  updateAgentPermissionProfile,
} from '../../features/agent/agentSlice';
import { updateSingleProfileInState } from '../../features/auth/authSlice';
import { getCfTemplateForIamRole } from '../../helpers/iamPermissions';
import { validateCreds } from '../../api/credentials';
import DeleteModal from '../../components/DeleteModal';
import {
  filterCloudEnvironments,
} from '../../helpers/shared';
import toast from 'react-hot-toast';
import { useAgentSetup } from '../../hooks/useAgentSetup';
import { Icons } from '../../components/icons';
import { PermissionsModal } from '../Libraries/PermissionsModal';
import WorkloadModal from '../../components/WorkloadModal';
import {
  getGlobalWorkloadSecurityRules,
} from '../../components/SecurityRules/securityRulesUtils';
import { getGlobalWorkloadDeploymentPreferences } from '../../features/workload/workloadCreationUtils';
import EditPermissionProfileModal from '../../components/EditPermissionProfileModal';
import CloudProviderSelector from '../../components/CloudProviderSelector';
import AddGoogleWorkspaceModal from '../../components/AddGoogleWorkspaceModal';
import EditGoogleWorkspaceModal from '../../components/EditGoogleWorkspaceModal';
import EditAwsOrgModal from '../../components/EditAwsOrgModal';
import { getCloudAgentCreationLimits } from '@/lib/subscription';
import { isLocalRuntime } from '@/runtime/cloudAgentRuntime';
import { awsClient } from '@/api/clients/awsClient';

const normalizeProfileType = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');

const parseAuthProfileSafe = (rawAuthProfile) => {
  if (!rawAuthProfile) return {};
  if (typeof rawAuthProfile === 'object') return rawAuthProfile;
  if (typeof rawAuthProfile === 'string') {
    try {
      return JSON.parse(rawAuthProfile) || {};
    } catch (_) {
      return {};
    }
  }
  return {};
};

const LOCAL_ENVIRONMENT_TYPES = [
  { value: 'aws account', label: 'AWS Account', idLabel: 'AWS Account ID', authKey: 'awsAccountId' },
];

const LOCAL_AWS_CREDENTIAL_METHODS = [
  { value: 'profile', label: 'AWS profile' },
  { value: 'sso', label: 'AWS SSO profile' },
  { value: 'static-credentials', label: 'Access keys' },
];

const parseAwsCredentialExportBlock = (value = '') => {
  const readValue = (name) => {
    const match = String(value).match(
      new RegExp(`(?:^|[\\r\\n;])\\s*(?:export\\s+)?${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s;]+))`, 'm')
    );
    return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
  };

  return {
    accessKeyId: readValue('AWS_ACCESS_KEY_ID'),
    secretAccessKey: readValue('AWS_SECRET_ACCESS_KEY'),
    sessionToken: readValue('AWS_SESSION_TOKEN'),
  };
};

const createLocalEnvironmentForm = (permission = null) => {
  const authProfile = parseAuthProfileSafe(permission?.authProfile);
  const type = normalizeProfileType(permission?.type) || 'aws account';
  const typeConfig =
    LOCAL_ENVIRONMENT_TYPES.find((item) => normalizeProfileType(item.value) === type) ||
    LOCAL_ENVIRONMENT_TYPES[0];

  return {
    name: permission?.name || '',
    description: permission?.description || '',
    type: typeConfig.value,
    identifier:
      authProfile.awsAccountId ||
      authProfile.accountId ||
      '',
    credentialMethod:
      authProfile.authType === 'aws-sso'
        ? 'sso'
        : authProfile.authType === 'static-credentials'
          ? 'static-credentials'
          : 'profile',
    awsProfile: authProfile.awsProfile || authProfile.profileName || '',
    accessKeyId: authProfile.accessKeyId || '',
    secretAccessKey: authProfile.secretAccessKey || '',
    sessionToken: authProfile.sessionToken || authProfile.refreshKey || '',
    defaultRegion:
      parseAuthProfileSafe(permission?.deploymentPreferences)?.defaultRegions?.[0] ||
      authProfile.region ||
      'us-east-1',
  };
};

const getCredentialStatus = (permission) =>
  permission?.credentialStatus ||
  permission?.localCredentialStatus ||
  permission?._credentialStatus ||
  null;

const hasCredentialIssue = (permission) => {
  const status = getCredentialStatus(permission);
  if (!status) return false;
  if (status.lastCheckedValid === false) return true;
  if (status.lastCheckedValid === true) return false;
  if (status.ok === false) return true;
  const normalized = String(status.status || '').toLowerCase();
  return Boolean(normalized && !['valid', 'not_applicable', 'unknown'].includes(normalized));
};

const getCredentialIssueMessage = (permission) => {
  const status = getCredentialStatus(permission);
  if (!status) return null;
  return [status.message, status.remediation].filter(Boolean).join(' ');
};


// const ValidateAwsCredentials = ({
//   accountId,
//   authProfile,
//   setIsValidationSuccessful,
// }) => {
//   const [state, setState] = useState({
//     isLoading: false,
//     receivedResponse: false,
//     code: 0,
//     message: '',
//   });

//   const validateCredsCall = async () => {
//     setState((prev) => ({
//       ...prev,
//       isLoading: true,
//       receivedResponse: false,
//     }));

//     const handleResponse = (code, message) => {
//       setState({
//         isLoading: false,
//         receivedResponse: true,
//         code,
//         message,
//       });

//       if (code === 200 && setIsValidationSuccessful) {
//         setIsValidationSuccessful(true);
//       } else {
//         setIsValidationSuccessful(false);
//       }
//     };

//     validateCreds({ ...authProfile, accountId }, handleResponse);
//   };

//   const getAlertVariant = () => {
//     if (!state.receivedResponse) return 'default';
//     return state.code === 200 ? 'success' : 'destructive';
//   };

//   const getIcon = () => {
//     if (!state.receivedResponse) return <AlertCircle className="h-5 w-5" />;
//     if (state.code === 200)
//       return <CheckCircle className="h-5 w-5 text-green-600" />;
//     return <XCircle className="h-5 w-5 text-red-600" />;
//   };

//   return (
//     <Alert variant={getAlertVariant()} className="mb-4 bg-primary-50">
//       <div className="flex items-start gap-4">
//         <div className="mt-1">{getIcon()}</div>
//         <div className="flex-1">
//           <AlertTitle className="flex items-center justify-between mb-0">
//             <span>
//               {state.receivedResponse
//                 ? state.message
//                 : 'Validate that credentials were properly deployed'}
//             </span>
//             <Button
//               variant="default"
//               size="sm"
//               onClick={validateCredsCall}
//               disabled={state.isLoading}
//               className="ml-4"
//             >
//               {state.isLoading && (
//                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//               )}
//               Validate
//             </Button>
//           </AlertTitle>
//           {state.receivedResponse && state.code === 400 && (
//             <AlertDescription className="text-red-600">
//               Make sure that the IAM role was successfully deployed to the AWS
//               account and the IAM role name and external id match the above
//               settings
//             </AlertDescription>
//           )}
//         </div>
//       </div>
//     </Alert>
//   );
// };

// export const AddEditPermissionModal = ({
//   isOpen,
//   onClose,
//   editingPermission = null,
// }) => {
//   const dispatch = useDispatch();
//   const { userProfile } = useSelector((state) => state.auth);

//   const [currentStep, setCurrentStep] = useState(0);
//   const [formData, setFormData] = useState({
//     accountId: editingPermission?.awsAccountId || '',
//     roleName: editingPermission?.roleName || '',
//     externalId: editingPermission?.externalId || generateRandomString(6),
//     accessKeyId: editingPermission?.accessKeyId || '',
//     secretAccessKey: editingPermission?.secretAccessKey || '',
//     sessionToken: editingPermission?.sessionToken || '',
//     name: editingPermission?.name || '',
//     description: editingPermission?.description || '',
//   });

//   const [authType, setAuthType] = useState(
//     editingPermission?.authType || 'role'
//   );
//   const [accessType, setAccessType] = useState('cloudformation');
//   const [temporaryAccess, setTemporaryAccess] = useState(false);
//   const [selectedTime, setSelectedTime] = useState('2 hours');
//   const [showPermissions, setShowPermissions] = useState(false);
//   const [isValidationSuccessful, setIsValidationSuccessful] = useState(false);
//   const [buttonLoading, setButtonLoading] = useState(false);

//   const stepLabels = [
//     'Enter Account',
//     'Deploy Permissions',
//     'Validate Permissions',
//   ];

//   const isEditing = !!editingPermission;

//   const handleInputChange = (field, value) => {
//     setFormData((prev) => ({ ...prev, [field]: value }));
//   };

//   const handleSave = async () => {
//     setButtonLoading(true);
//     try {
//       if (isEditing) {
//         const updatedProfile = {
//           ...editingPermission,
//           awsAccountId: formData.accountId,
//           authType: authType,
//           description: formData.description,
//           ...(authType === 'role'
//             ? {
//                 roleName: formData.roleName,
//                 externalId: formData.externalId,
//                 accessKeyId: '',
//                 secretAccessKey: '',
//                 sessionToken: '',
//               }
//             : {
//                 accessKeyId: formData.accessKeyId,
//                 secretAccessKey: formData.secretAccessKey,
//                 sessionToken: formData.sessionToken,
//                 roleName: '',
//                 externalId: '',
//               }),
//           deploymentPreferences:
//             editingPermission.deploymentPreferences ||
//             JSON.stringify({
//               method: 'cloudformation',
//               stacks: [],
//               instanceSize: 'No Preference',
//               databasePreference: 'No Preference',
//               nosqlPreference: 'No Preference',
//               staticWebsite: 'No Preference',
//               dynamicWebsite: 'No Preference',
//               defaultRegions: [],
//               requiredTags: [],
//               useExistingVPCs: false,
//               specifiedVPCs: [],
//               resourceRules: {
//                 allowedResources: {
//                   allowAll: true,
//                   allowedList: [],
//                   deniedList: [],
//                 },
//               },
//             }),
//             securityRules:
//               editingPermission.securityRules ||
//               JSON.stringify({}),
//         };

//         await dispatch(updateAgentPermissionProfile(updatedProfile)).unwrap();
//         toast.success(`Permission "${formData.name}" updated successfully!`);
//       } else {
//         await dispatch(
//           createAgentPermissionProfile({
//             name: formData.name,
//             description: formData.description,
//             awsAccountId: formData.accountId,
//             authType: authType,
//             roleName: authType === 'role' ? formData.roleName : '',
//             externalId: authType === 'role' ? formData.externalId : '',
//             accessKeyId: authType === 'credentials' ? formData.accessKeyId : '',
//             secretAccessKey:
//               authType === 'credentials' ? formData.secretAccessKey : '',
//             sessionToken:
//               authType === 'credentials' ? formData.sessionToken : '',
//             deploymentPreferences: JSON.stringify({
//               method: 'cloudformation',
//               stacks: [],
//               instanceSize: 'No Preference',
//               databasePreference: 'No Preference',
//               nosqlPreference: 'No Preference',
//               staticWebsite: 'No Preference',
//               dynamicWebsite: 'No Preference',
//               defaultRegions: [],
//               requiredTags: [],
//               useExistingVPCs: false,
//               specifiedVPCs: [],
//               resourceRules: {
//                 allowedResources: {
//                   allowAll: true,
//                   allowedList: [],
//                   deniedList: [],
//                 },
//               },
//             }),
//             securityRules: JSON.stringify({}),
//           })
//         ).unwrap();
//       }

//       onClose();
//     } catch (error) {
//       console.error('Error saving permission:', error);
//     } finally {
//       setButtonLoading(false);
//     }
//   };

//   const permissionsJson = `{
//     "Version": "2012-10-17",
//     "Statement": [
//       {
//         "Effect": "Allow",
//         "Action": [
//           "iam:ListPolicies",
//           "iam:ListUsers",
//           "iam:GetUser",
//           "iam:ListAttachedUserPolicies",
//           "iam:ListUserPolicies"
//         ],
//         "Resource": "*"
//       }
//     ]
//   }`;

//   const cfTemplate =
//     authType === 'role'
//       ? getCfTemplateForIamRole(
//           formData.roleName,
//           formData.externalId,
//           [],
//           ['read-managed'],
//           'readwrite',
//           0,
//           false
//         )
//       : { Resources: {} };

//   return (
//     <Dialog open={isOpen} onOpenChange={onClose}>
//       <DialogContent className="max-w-[1200px] bg-white max-h-[95vh] overflow-auto">
//         <DialogHeader>
//           <div className="w-fit bg-yellow-100 p-2 border-[8px] border-yellow-50 rounded-full mb-2">
//             <AlertTriangle className="w-4 h-4 text-orange-500" />
//           </div>
//           <DialogTitle className="text-2xl font-[600] text-primary-800 tracking-normal text-left">
//             {isEditing ? 'Edit Permission' : 'Add New Permission'}
//           </DialogTitle>
//         </DialogHeader>

//         <Stepper steps={stepLabels} activeStep={currentStep} />

//         {currentStep === 0 && (
//           <div className="space-y-6">
//             <div className="space-y-4">
//               <h3 className="text-lg font-medium text-gray-900">
//                 Your AWS Account
//               </h3>
//               <div className="space-y-2">
//                 <Label
//                   htmlFor="awsAccount"
//                   className="text-gray-600 flex items-center"
//                 >
//                   AWS Account <span className="text-red-500 ml-1">*</span>
//                 </Label>
//                 <Input
//                   value={formData.accountId}
//                   onChange={(e) =>
//                     handleInputChange('accountId', e.target.value)
//                   }
//                   placeholder="Account Id"
//                 />
//                 <p className="text-sm text-gray-500">
//                   Use your 12 digit number account
//                 </p>
//               </div>
//             </div>

//             <div className="py-4 border-t border-b">
//               <div className="flex items-center justify-between space-y-1">
//                 <div>
//                   <h3 className="font-medium text-gray-900">
//                     Temporary Access
//                   </h3>
//                   <p className="text-sm text-gray-600">
//                     You provide to the Agents a custom period of time.
//                   </p>
//                 </div>
//                 <Switch
//                   checked={temporaryAccess}
//                   onCheckedChange={setTemporaryAccess}
//                   className="bg-primary-600 data-[state=checked]:bg-primary-600"
//                 />
//               </div>

//               {temporaryAccess && (
//                 <div className="space-y-2 mt-4">
//                   <Label
//                     htmlFor="timeSelection"
//                     className="text-sm font-medium text-gray-700"
//                   >
//                     Select time
//                   </Label>
//                   <div className="relative">
//                     <select
//                       id="timeSelection"
//                       value={selectedTime}
//                       onChange={(e) => setSelectedTime(e.target.value)}
//                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none bg-white"
//                     >
//                       <option value="1 hour">1 hour</option>
//                       <option value="2 hours">2 hours</option>
//                       <option value="4 hours">4 hours</option>
//                       <option value="8 hours">8 hours</option>
//                       <option value="12 hours">12 hours</option>
//                       <option value="1 day">1 day</option>
//                       <option value="3 days">3 days</option>
//                       <option value="7 days">7 days</option>
//                     </select>
//                     <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
//                   </div>
//                 </div>
//               )}
//             </div>

//             <div className="space-y-4">
//               <h3 className="font-medium text-gray-900">
//                 Permissions Description
//               </h3>
//               <p className="text-sm text-gray-600">
//                 This example shows how you might create a policy that allows IAM
//                 users to view the inline and managed policies that are attached
//                 to their user identity.
//               </p>

//               <div className="relative">
//                 <div className="bg-primary-50 rounded-md p-4 border">
//                   <div className="flex items-center justify-between">
//                     <span className="text-sm font-mono text-gray-700">
//                       "Version": "2012-10-17"
//                     </span>
//                     <button
//                       onClick={() => setShowPermissions(!showPermissions)}
//                       className="flex items-center text-gray-500 hover:text-gray-700"
//                     >
//                       <ChevronDown
//                         className={`w-4 h-4 transition-transform ${showPermissions ? 'rotate-180' : ''}`}
//                       />
//                     </button>
//                   </div>
//                   {showPermissions && (
//                     <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap">
//                       {permissionsJson}
//                     </pre>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}

//         {currentStep === 1 && (
//           <div className="space-y-6">
//             <div className="space-y-4">
//               <h3 className="text-lg font-medium text-gray-900">
//                 Choose what works the best to deploy your permissions
//               </h3>
//               <p className="text-sm text-gray-600">
//                 Select your preferred method for deploying the IAM permissions to your AWS account
//               </p>
//             </div>

//             <div className="space-y-2">
//               <div className="rounded-lg">
//                 <div className="flex items-center p-2">
//                   <input
//                     type="radio"
//                     value="cloudformation"
//                     id="cloudformation"
//                     checked={accessType === 'cloudformation'}
//                     onChange={() => setAccessType('cloudformation')}
//                     className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
//                   />
//                   <div className="ml-3 flex-1">
//                     <div className="flex items-center gap-2">
//                       <Label
//                         htmlFor="cloudformation"
//                         className="font-medium text-primary-600"
//                       >
//                         Launch CloudFormation Template
//                       </Label>
//                       <span className="px-2 py-1 text-xs bg-primary-100 text-primary-600 rounded">
//                         Most Recommended
//                       </span>
//                     </div>
//                     <p className="text-sm text-gray-600 mt-1">
//                       Automatically prepares and launches the template in your AWS account - you just need to approve the deployment
//                     </p>
//                   </div>
//                 </div>
//               </div>

//               {/* <div className="rounded-lg">
//                 <div className="flex items-center p-2">
//                   <input
//                     type="radio"
//                     value="terraform"
//                     id="terraform"
//                     checked={accessType === 'terraform'}
//                     onChange={() => setAccessType('terraform')}
//                     className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
//                   />
//                   <div className="ml-3 flex-1">
//                     <Label
//                       htmlFor="terraform"
//                       className="font-medium text-gray-700"
//                     >
//                       Download Terraform Template
//                     </Label>
//                     <p className="text-sm text-gray-600 mt-1">
//                       Download the Terraform template and deploy it using your preferred Terraform workflow
//                     </p>
//                   </div>
//                   {accessType === 'terraform' && (
//                     <Button size="sm" className="ml-4" variant="outline">
//                       Download Terraform Template
//                     </Button>
//                   )}
//                 </div>
//               </div> */}

//               <div className="rounded-lg">
//                 <div className="flex items-center p-2">
//                   <input
//                     type="radio"
//                     value="download-cf"
//                     id="download-cf"
//                     checked={accessType === 'download-cf'}
//                     onChange={() => setAccessType('download-cf')}
//                     className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
//                   />
//                   <div className="ml-3 flex-1">
//                     <Label
//                       htmlFor="download-cf"
//                       className="font-medium text-gray-700"
//                     >
//                       Download CloudFormation Template
//                     </Label>
//                     <p className="text-sm text-gray-600 mt-1">
//                       Download the CloudFormation template and deploy it using AWS CLI, console, or your preferred deployment method
//                     </p>
//                   </div>
//                   {accessType === 'download-cf' && (
//                     <Button size="sm" className="ml-4" variant="outline">
//                       Download CloudFormation Template
//                     </Button>
//                   )}
//                 </div>
//               </div>

//               <div className="rounded-lg">
//                 <div className="flex items-center p-2">
//                   <input
//                     type="radio"
//                     value="manual"
//                     id="manual-steps"
//                     checked={accessType === 'manual'}
//                     onChange={() => setAccessType('manual')}
//                     className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
//                   />
//                   <div className="ml-3 flex-1">
//                     <Label
//                       htmlFor="manual-steps"
//                       className="font-medium text-gray-700"
//                     >
//                       Manual Steps
//                     </Label>
//                     <p className="text-sm text-gray-600 mt-1">
//                       Follow step-by-step instructions to manually set up the IAM permissions in your AWS console
//                     </p>
//                   </div>
//                 </div>
//               </div>
//             </div>

//             <div className="border rounded-lg">
//               <button
//                 onClick={() => setShowPermissions(!showPermissions)}
//                 className="flex items-center justify-between w-full p-4 text-left"
//               >
//                 <h4 className="font-medium text-gray-900">More Information</h4>
//                 <ChevronDown
//                   className={`w-4 h-4 transition-transform ${showPermissions ? 'rotate-180' : ''}`}
//                 />
//               </button>

//               {showPermissions && (
//                 <div className="border-t p-4 bg-gray-50">
//                   <p className="text-sm text-gray-600 mb-4">
//                     Configure the IAM role details that will be used for accessing your AWS account. The role name and external ID should match what you deploy.
//                   </p>

//                   {authType === 'role' ? (
//                     <>
//                       <div className="space-y-2">
//                         <Label
//                           htmlFor="roleName"
//                           className="text-sm font-medium text-gray-700 flex items-center"
//                         >
//                           IAM Role Name{' '}
//                           <span className="text-red-500 ml-1">*</span>
//                         </Label>
//                         <Input
//                           value={formData.roleName}
//                           onChange={(e) =>
//                             handleInputChange('roleName', e.target.value)
//                           }
//                           placeholder="Role Name"
//                         />
//                       </div>
//                       <div className="space-y-2 mt-4">
//                         <Label
//                           htmlFor="externalId"
//                           className="text-sm font-medium text-gray-700"
//                         >
//                           External Id
//                         </Label>
//                         <Input
//                           value={formData.externalId}
//                           onChange={(e) =>
//                             handleInputChange('externalId', e.target.value)
//                           }
//                           placeholder="External Id"
//                         />
//                       </div>
//                     </>
//                   ) : (
//                     <>
//                       <div className="space-y-2">
//                         <Label
//                           htmlFor="accessKeyId"
//                           className="text-sm font-medium text-gray-700 flex items-center"
//                         >
//                           Access Key ID{' '}
//                           <span className="text-red-500 ml-1">*</span>
//                         </Label>
//                         <Input
//                           value={formData.accessKeyId}
//                           onChange={(e) =>
//                             handleInputChange('accessKeyId', e.target.value)
//                           }
//                           placeholder="Access Key ID"
//                         />
//                       </div>
//                       <div className="space-y-2 mt-4">
//                         <Label
//                           htmlFor="secretAccessKey"
//                           className="text-sm font-medium text-gray-700 flex items-center"
//                         >
//                           Secret Access Key{' '}
//                           <span className="text-red-500 ml-1">*</span>
//                         </Label>
//                         <Input
//                           value={formData.secretAccessKey}
//                           onChange={(e) =>
//                             handleInputChange('secretAccessKey', e.target.value)
//                           }
//                           placeholder="Secret Access Key"
//                         />
//                       </div>
//                       <div className="space-y-2 mt-4">
//                         <Label
//                           htmlFor="sessionToken"
//                           className="text-sm font-medium text-gray-700"
//                         >
//                           Session Token
//                         </Label>
//                         <Input
//                           value={formData.sessionToken}
//                           onChange={(e) =>
//                             handleInputChange('sessionToken', e.target.value)
//                           }
//                           placeholder="Session Token"
//                         />
//                       </div>
//                     </>
//                   )}
//                 </div>
//               )}
//             </div>
//           </div>
//         )}

//         {currentStep === 2 && (
//           <div className="space-y-6">
//             <ValidateAwsCredentials
//               authProfile={formData}
//               accountId={formData.accountId}
//               setIsValidationSuccessful={setIsValidationSuccessful}
//             />

//             <div className="space-y-4 border-t pt-4">
//               <h3 className="font-medium text-gray-900">Permission Details</h3>
//               <div className="space-y-2">
//                 <Label htmlFor="presetName" className="text-gray-600">
//                   Name <span className="text-red-500 ml-1">*</span>
//                 </Label>
//                 <Input
//                   id="presetName"
//                   value={formData.name}
//                   onChange={(e) => handleInputChange('name', e.target.value)}
//                   placeholder="Permission Name"
//                   disabled={isEditing}
//                   className={
//                     isEditing
//                       ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
//                       : ''
//                   }
//                 />
//               </div>
//               <div className="space-y-2">
//                 <Label htmlFor="description" className="text-gray-600">
//                   Description
//                 </Label>
//                 <Input
//                   id="description"
//                   value={formData.description}
//                   onChange={(e) =>
//                     handleInputChange('description', e.target.value)
//                   }
//                   placeholder="Description"
//                 />
//               </div>
//             </div>
//           </div>
//         )}

//         <div className="flex flex-col md:flex-row justify-between mt-6 gap-4">
//           <Button
//             variant="outline"
//             onClick={() =>
//               currentStep > 0 ? setCurrentStep(currentStep - 1) : onClose()
//             }
//             className="w-[100%] md:w-2/4"
//           >
//             {currentStep > 0 ? 'Back' : 'Cancel'}
//           </Button>
//           <Button
//             onClick={() => {
//               if (currentStep < stepLabels.length - 1) {
//                 setCurrentStep(currentStep + 1);
//               } else {
//                 handleSave();
//               }
//             }}
//             disabled={
//               buttonLoading ||
//               (currentStep === stepLabels.length - 1 &&
//                 (!formData.name ||
//                   !formData.accountId ||
//                   (authType === 'role' && !isValidationSuccessful)))
//             }
//             className="w-[100%] md:w-2/4"
//           >
//             {buttonLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
//             {currentStep < stepLabels.length - 1
//               ? `Continue to Step ${currentStep + 2}`
//               : isEditing
//                 ? 'Update Permission'
//                 : 'Save Permission'}
//           </Button>
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// };

export default function PermissionPage() {
  const { userProfile } = useSelector((state) => state.auth);
  const { deleteLoading } = useSelector((state) => state.agent);
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const isLocalMode = isLocalRuntime();
  const userSettings = userProfile?.settings || {};

  const launchWorkloadDiscoveryForEnvironment = (permissionProfileId) => {
    if (!permissionProfileId) return;
    navigate('/dashboard/workloads', {
      state: {
        openDiscoverWorkloadsModal: true,
        permissionProfileId,
      },
    });
  };

  const validateAndLaunchWorkloadDiscoveryForEnvironment = async (permissionProfileId) => {
    if (!permissionProfileId) return;
    if (!isLocalMode) {
      launchWorkloadDiscoveryForEnvironment(permissionProfileId);
      return;
    }

    try {
      const validatedProfile = await awsClient.validatePermissionProfile(permissionProfileId);
      if (validatedProfile?.recordId) {
        dispatch(updateSingleProfileInState(validatedProfile));
      }
      if (hasCredentialIssue(validatedProfile)) {
        toast.error(getCredentialIssueMessage(validatedProfile) || 'Local AWS credentials need attention.');
        return;
      }
      launchWorkloadDiscoveryForEnvironment(validatedProfile?.recordId || permissionProfileId);
    } catch (error) {
      console.warn('[local credentials] profile validation failed', error);
      toast.error(error?.message || 'Unable to validate local AWS credentials.');
    }
  };

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState(null);
  const [isEditPermissionModalOpen, setIsEditPermissionModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingPermission, setDeletingPermission] = useState(null);
  const [isWorkloadModalOpen, setIsWorkloadModalOpen] = useState(false);
  const [editingWorkload, setEditingWorkload] = useState(null);
  const [isLocalEnvironmentModalOpen, setIsLocalEnvironmentModalOpen] = useState(false);
  const [localEnvironmentForm, setLocalEnvironmentForm] = useState(() =>
    createLocalEnvironmentForm()
  );
  const [isSavingLocalEnvironment, setIsSavingLocalEnvironment] = useState(false);
  const [isValidatingLocalCredentials, setIsValidatingLocalCredentials] = useState(false);
  const [localAwsProfiles, setLocalAwsProfiles] = useState([]);
  const [isLoadingLocalAwsProfiles, setIsLoadingLocalAwsProfiles] = useState(false);
  const [showAwsCredentialPaste, setShowAwsCredentialPaste] = useState(false);
  const [awsCredentialPasteText, setAwsCredentialPasteText] = useState('');

  const [openMenuId, setOpenMenuId] = useState(null);
  
  // Provider selection state
  const [isProviderSelectorOpen, setIsProviderSelectorOpen] = useState(false);
  const [selectedEnvironmentType, setSelectedEnvironmentType] = useState('aws_account');
  const [isGoogleWorkspaceModalOpen, setIsGoogleWorkspaceModalOpen] = useState(false);
  const [isEditGoogleWorkspaceModalOpen, setIsEditGoogleWorkspaceModalOpen] = useState(false);
  const [editingGoogleWorkspacePermission, setEditingGoogleWorkspacePermission] = useState(null);
  const [isEditAwsOrgModalOpen, setIsEditAwsOrgModalOpen] = useState(false);
  const [editingAwsOrgPermission, setEditingAwsOrgPermission] = useState(null);

  const { setupState, handlePermissionsComplete, cancelSetup, resetSetup, setSetupState } =
    useAgentSetup();

  const creationLimits = useMemo(
    () => getCloudAgentCreationLimits(userProfile),
    [userProfile]
  );

  // Handle navigation state for opening modals (from Overview page quick actions)
  useEffect(() => {
    if (!userProfile) return;
    if (location.state?.openNewEnvironmentModal) {
      if (!creationLimits.canCreatePermissionProfile) {
        toast.error(creationLimits.permissionProfileLimitMessage);
        window.history.replaceState({}, document.title);
        return;
      }
      if (isLocalMode) {
        setEditingPermission(null);
        setLocalEnvironmentForm(createLocalEnvironmentForm());
        resetAwsCredentialPaste();
        setIsLocalEnvironmentModalOpen(true);
      } else {
        // Open provider selector first (same as clicking "Add Environment" button)
        setIsProviderSelectorOpen(true);
      }
      // Clear the state to prevent re-opening on subsequent renders
      window.history.replaceState({}, document.title);
    }
  }, [creationLimits, isLocalMode, location.state, userProfile]);

  useEffect(() => {
    if (!isLocalMode || !isLocalEnvironmentModalOpen) return;
    let cancelled = false;
    setIsLoadingLocalAwsProfiles(true);
    awsClient.listProfiles()
      .then((profiles) => {
        if (!cancelled) setLocalAwsProfiles(profiles);
      })
      .catch((error) => {
        if (!cancelled) {
          setLocalAwsProfiles([]);
          toast.error(error?.message || 'Failed to load AWS profiles');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingLocalAwsProfiles(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLocalEnvironmentModalOpen, isLocalMode]);

  const addPermission = () => {
    if (!creationLimits.canCreatePermissionProfile) {
      toast.error(creationLimits.permissionProfileLimitMessage);
      return;
    }
    if (isLocalMode) {
      setEditingPermission(null);
      setLocalEnvironmentForm(createLocalEnvironmentForm());
      resetAwsCredentialPaste();
      setIsLocalEnvironmentModalOpen(true);
      return;
    }
    // Open provider selector first instead of directly opening AWS modal
    setIsProviderSelectorOpen(true);
  };

  const handleProviderSelect = (providerId) => {
    if (!creationLimits.canCreatePermissionProfile) {
      toast.error(creationLimits.permissionProfileLimitMessage);
      setIsProviderSelectorOpen(false);
      return;
    }

    setIsProviderSelectorOpen(false);
    
    if (providerId === 'aws' || providerId === 'aws_org') {
      // Open AWS permissions modal
      resetSetup();
      setSelectedEnvironmentType(providerId === 'aws_org' ? 'aws_org' : 'aws_account');
      setSetupState((prev) => ({
        ...prev,
        isPermissionsModalOpen: true,
        isEditing: false,
        editingPermission: null,
        initialManualStep: 0,
      }));
      setEditingPermission(null);
      setIsAddModalOpen(true);
    } else if (providerId === 'google_workspace') {
      // Open Google Workspace modal
      setSelectedEnvironmentType('aws_account');
      setIsGoogleWorkspaceModalOpen(true);
    }
  };

  // Helper function to safely parse JSON or return default (shared across functions)
  const safeParseJson = (jsonString, defaultValue) => {
    if (!jsonString) return defaultValue;
    if (typeof jsonString === 'object') return jsonString; // Already parsed
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Error parsing JSON:', error);
      return defaultValue;
    }
  };

  const editPermissionRules = (permission) => {
    // Parse authProfile if it's a string
    const authProfile = typeof permission.authProfile === 'string' 
      ? JSON.parse(permission.authProfile) 
      : permission.authProfile || {};

    // Create a workload-like object from the permission for the modal
    const workloadFromPermission = {
      workloadId: `permission_${permission.recordId}`,
      workloadName: permission.name,
      description: permission.description || '',
      environments: [permission.recordId],
      deploymentPreferences: safeParseJson(permission.deploymentPreferences, {
        method: 'cloudformation',
        stacks: [],
        instanceSize: 'No Preference',
        databasePreference: 'No Preference',
        nosqlPreference: 'No Preference',
        staticWebsite: 'No Preference',
        dynamicWebsite: 'No Preference',
        defaultRegions: [],
        requiredTags: [],
        useExistingVPCs: false,
        specifiedVPCs: [],
        resourceRules: {
          allowedResources: {
            allowAll: true,
            allowedList: [],
            deniedList: [],
          },
        },
      }),
      securityRules: safeParseJson(permission.securityRules, {}),
    };

    setEditingWorkload(workloadFromPermission);
    setIsWorkloadModalOpen(true);
  };

  const editPermission = (permission, closeMenu) => {
    if (closeMenu) closeMenu();
    if (isLocalMode) {
      setEditingPermission(permission);
      setLocalEnvironmentForm(createLocalEnvironmentForm(permission));
      resetAwsCredentialPaste();
      setIsLocalEnvironmentModalOpen(true);
      return;
    }
    
    // Determine provider type from type field or authProfile
    const authProfile = parseAuthProfileSafe(permission?.authProfile);
    const normalizedType = normalizeProfileType(permission?.type);
    
    const isGoogleWorkspace = authProfile.provider === 'google_workspace' || permission?.type === 'google_workspace';
    if (isGoogleWorkspace) {
      setEditingGoogleWorkspacePermission(permission);
      setIsEditGoogleWorkspaceModalOpen(true);
    } else if (normalizedType === 'aws org') {
      setEditingAwsOrgPermission(permission);
      setIsEditAwsOrgModalOpen(true);
    } else {
      setEditingPermission(permission);
      setIsEditPermissionModalOpen(true);
    }
  };

  const handleModalClose = () => {
    setIsAddModalOpen(false);
    setSelectedEnvironmentType('aws_account');
    setEditingPermission(null);
    setOpenMenuId(null);
  };

  const updateLocalEnvironmentForm = (field, value) => {
    setLocalEnvironmentForm((prev) => ({ ...prev, [field]: value }));
  };

  function resetAwsCredentialPaste() {
    setShowAwsCredentialPaste(false);
    setAwsCredentialPasteText('');
  }

  function applyAwsCredentialPaste() {
    const parsed = parseAwsCredentialExportBlock(awsCredentialPasteText);
    if (!parsed.accessKeyId || !parsed.secretAccessKey) {
      toast.error('Paste AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY exports');
      return;
    }

    setLocalEnvironmentForm((prev) => ({
      ...prev,
      credentialMethod: 'static-credentials',
      accessKeyId: parsed.accessKeyId,
      secretAccessKey: parsed.secretAccessKey,
      sessionToken: parsed.sessionToken || '',
    }));
    setAwsCredentialPasteText('');
    setShowAwsCredentialPaste(false);
    toast.success(parsed.sessionToken ? 'Temporary AWS credentials imported' : 'AWS credentials imported');
  }

  const recheckLocalCredentials = async () => {
    if (!isLocalMode) return;
    setIsValidatingLocalCredentials(true);
    try {
      const { profiles = [], invalidCount = 0 } = await awsClient.validatePermissionProfiles();
      profiles.forEach((profile) => {
        dispatch(updateSingleProfileInState(profile));
      });
      if (invalidCount > 0) {
        toast.error(`${invalidCount} local AWS credential ${invalidCount === 1 ? 'profile needs' : 'profiles need'} attention.`);
      } else {
        toast.success('Local AWS credentials validated');
      }
    } catch (error) {
      toast.error(error?.message || 'Failed to validate local AWS credentials');
    } finally {
      setIsValidatingLocalCredentials(false);
    }
  };

  const closeLocalEnvironmentModal = () => {
    if (isSavingLocalEnvironment) return;
    setIsLocalEnvironmentModalOpen(false);
    setEditingPermission(null);
    setLocalEnvironmentForm(createLocalEnvironmentForm());
    resetAwsCredentialPaste();
  };

  const saveLocalEnvironment = async () => {
    const name = localEnvironmentForm.name.trim();
    if (!name) {
      toast.error('Environment name is required');
      return;
    }

    const identifier = localEnvironmentForm.identifier.trim();
    const credentialMethod = localEnvironmentForm.credentialMethod || 'profile';
    const awsProfile = localEnvironmentForm.awsProfile.trim();
    const accessKeyId = localEnvironmentForm.accessKeyId.trim();
    const secretAccessKey = localEnvironmentForm.secretAccessKey.trim();
    const sessionToken = localEnvironmentForm.sessionToken.trim();
    const defaultRegion = localEnvironmentForm.defaultRegion.trim() || 'us-east-1';

    if ((credentialMethod === 'profile' || credentialMethod === 'sso') && !awsProfile) {
      toast.error('AWS profile is required');
      return;
    }
    if (credentialMethod === 'static-credentials' && (!accessKeyId || !secretAccessKey)) {
      toast.error('Access key ID and secret access key are required');
      return;
    }

    const authProfile = {
      provider: 'aws',
      authType: credentialMethod === 'sso' ? 'aws-sso' : credentialMethod,
      ...(identifier ? { awsAccountId: identifier, accountId: identifier } : {}),
      ...(credentialMethod === 'profile' || credentialMethod === 'sso'
        ? { awsProfile }
        : {}),
      ...(credentialMethod === 'static-credentials'
        ? {
            accessKeyId,
            secretAccessKey,
            ...(sessionToken ? { sessionToken } : {}),
          }
        : {}),
      region: defaultRegion,
    };
    const globalDeploymentPreferences = getGlobalWorkloadDeploymentPreferences(userSettings);
    const existingDeploymentPreferences = editingPermission?.recordId
      ? parseAuthProfileSafe(editingPermission?.deploymentPreferences)
      : globalDeploymentPreferences;
    const existingSecurityRules = parseAuthProfileSafe(editingPermission?.securityRules);
    const payload = {
      name,
      type: 'aws account',
      description: localEnvironmentForm.description.trim(),
      authProfile,
      deploymentPreferences: {
        ...existingDeploymentPreferences,
        defaultRegions: [defaultRegion],
      },
      securityRules: editingPermission?.recordId
        ? existingSecurityRules
        : getGlobalWorkloadSecurityRules(userSettings),
    };

    setIsSavingLocalEnvironment(true);
    try {
      let savedProfile = null;
      if (editingPermission?.recordId) {
        savedProfile = await dispatch(
          updateAgentPermissionProfile({
            recordId: editingPermission.recordId,
            ...payload,
          })
        ).unwrap();
        toast.success('Environment updated');
      } else {
        savedProfile = await dispatch(createAgentPermissionProfile(payload)).unwrap();
        toast.success('Environment created');
      }
      let validatedProfile = null;
      if (savedProfile?.recordId) {
        try {
          validatedProfile = await awsClient.validatePermissionProfile(savedProfile.recordId);
          if (validatedProfile?.recordId) {
            dispatch(updateSingleProfileInState(validatedProfile));
            if (hasCredentialIssue(validatedProfile)) {
              toast.error(getCredentialIssueMessage(validatedProfile) || 'Local AWS credentials need attention.');
            }
          }
        } catch (error) {
          console.warn('[local credentials] profile validation failed', error);
        }
      }
      setIsLocalEnvironmentModalOpen(false);
      setEditingPermission(null);
      setLocalEnvironmentForm(createLocalEnvironmentForm());
      resetAwsCredentialPaste();
      if (
        !editingPermission?.recordId &&
        validatedProfile?.recordId &&
        !hasCredentialIssue(validatedProfile)
      ) {
        launchWorkloadDiscoveryForEnvironment(savedProfile.recordId);
      }
    } catch (error) {
      toast.error(error?.message || 'Failed to save environment');
    } finally {
      setIsSavingLocalEnvironment(false);
    }
  };

  const availableCredits =
    (userProfile?.agentCredits?.adhocCredits || 0) +
    (userProfile?.agentCredits?.monthlyBaseCredits || 0) || 0;

  const triggerCisReportForNewEnvironment = (
    cloudProvider,
    authProfileData,
    envAccountId,
    parentIdOverride = null
  ) => {
    if (isLocalMode) return;
    const profiles = userProfile?.agentPermissionProfiles || [];
    const matchedProfile = profiles.find((p) => {
      if (cloudProvider === 'google_workspace') {
        const parsed = parseAuthProfileSafe(p.authProfile);
        return parsed?.provider === 'google_workspace' && parsed?.domain === authProfileData?.domain;
      }
      if (cloudProvider === 'azure') {
        const parsed = parseAuthProfileSafe(p.authProfile);
        return (
          normalizeProfileType(p.type) === 'azure tenant' &&
          parsed?.provider === 'azure' &&
          parsed?.tenantId === authProfileData?.tenantId
        );
      }
      const parsed = parseAuthProfileSafe(p.authProfile);
      return parsed?.awsAccountId === envAccountId || p.name === authProfileData?.name;
    });

  };

  if (!userProfile) {
    return <PermissionPageSkeleton />;
  }


  return (
    <>
      {/* MCP Recommendation */}
      {/* <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 mb-8">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Configure Local MCP Access
              </h3>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => (window.location.href = '/dashboard/mcp')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Open MCP Settings
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open('https://modelcontextprotocol.io/', '_blank')
                  }
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  Learn More About MCP
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card> */}

      <Card className="bg-white">
        <CardHeader className="border-b p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2 self-start sm:self-auto order-first sm:order-last">
              <Button
                onClick={addPermission}
                disabled={!creationLimits.canCreatePermissionProfile}
                className="self-start sm:self-auto order-first sm:order-last"
              >
                <Plus className="mr-2 h-4 w-4" /> Add Cloud Environment
              </Button>
            </div>
            <div>
              <h1 className="text-2xl text-primary-800 font-[500]">
                Cloud Environments
              </h1>
              
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!creationLimits.canCreatePermissionProfile && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {creationLimits.permissionProfileLimitMessage}{' '}
              <a href="/pricing" className="font-medium underline">
                View plans
              </a>
            </div>
          )}
          {(() => {
            const cloudEnvironments = (userProfile?.agentPermissionProfiles || []).filter(
              (profile) => {
                if (!profile) return false;
                const profileType = normalizeProfileType(profile?.type);
                if (profileType === 'aws org') return true;
                return filterCloudEnvironments([profile]).length > 0;
              }
            );
            const normalizedProfiles = cloudEnvironments.map((profile) => ({
              ...profile,
              _normalizedType: normalizeProfileType(profile?.type),
              _authProfile: parseAuthProfileSafe(profile?.authProfile),
              _deploymentPreferences: safeParseJson(profile?.deploymentPreferences, {}),
            }));
            const invalidCredentialProfiles = isLocalMode
              ? normalizedProfiles.filter(hasCredentialIssue)
              : [];
            const orgProfiles = normalizedProfiles.filter(
              (profile) => profile._normalizedType === 'aws org'
            );
            const azureTenantProfiles = normalizedProfiles.filter(
              (profile) => profile._normalizedType === 'azure tenant'
            );
            const orgByRecordId = new Map(
              orgProfiles
                .map((profile) => [profile?.recordId || profile?.id, profile])
                .filter(([id]) => Boolean(id))
            );
            const orgByManagementAccountId = new Map(
              orgProfiles
                .map((profile) => [
                  String(profile?._authProfile?.awsAccountId || '').trim(),
                  profile,
                ])
                .filter(([accountId]) => Boolean(accountId))
            );
            const orgByDiscoveredAccountId = new Map();

            orgProfiles.forEach((orgProfile) => {
              const orgId = orgProfile?.recordId || orgProfile?.id;
              if (!orgId) return;
              const discoveredAccounts = Array.isArray(
                orgProfile?._authProfile?.memberAccountsDiscovered
              )
                ? orgProfile._authProfile.memberAccountsDiscovered
                : [];
              discoveredAccounts.forEach((account) => {
                const accountId = String(account?.id || '').trim();
                if (accountId && !orgByDiscoveredAccountId.has(accountId)) {
                  orgByDiscoveredAccountId.set(accountId, orgProfile);
                }
              });
            });

            const getParentOrgForProfile = (profile) => {
              if (profile?._normalizedType !== 'aws account') return null;
              const accountId = String(profile?._authProfile?.awsAccountId || '').trim();
              if (!accountId) return null;

              const directOrgRecordId = profile?._deploymentPreferences?.orgPermissionProfileId;
              if (directOrgRecordId && orgByRecordId.has(directOrgRecordId)) {
                return orgByRecordId.get(directOrgRecordId);
              }

              const managementAccountId = String(
                profile?._deploymentPreferences?.orgManagementAccountId || ''
              ).trim();
              if (managementAccountId && orgByManagementAccountId.has(managementAccountId)) {
                return orgByManagementAccountId.get(managementAccountId);
              }

              if (orgByDiscoveredAccountId.has(accountId)) {
                return orgByDiscoveredAccountId.get(accountId);
              }

              return null;
            };

            const childProfilesByOrgId = new Map();
            const azureTenantByRecordId = new Map(
              azureTenantProfiles
                .map((profile) => [profile?.recordId || profile?.id, profile])
                .filter(([id]) => Boolean(id))
            );
            const azureTenantByTenantId = new Map(
              azureTenantProfiles
                .map((profile) => [String(profile?._authProfile?.tenantId || '').trim(), profile])
                .filter(([tenantId]) => Boolean(tenantId))
            );
            const childProfilesByAzureTenantId = new Map();

            normalizedProfiles.forEach((profile) => {
              const parentOrg = getParentOrgForProfile(profile);
              if (!parentOrg) return;
              const parentOrgId = parentOrg?.recordId || parentOrg?.id;
              if (!parentOrgId) return;
              if (!childProfilesByOrgId.has(parentOrgId)) {
                childProfilesByOrgId.set(parentOrgId, []);
              }
              childProfilesByOrgId.get(parentOrgId).push(profile);
            });

            normalizedProfiles.forEach((profile) => {
              if (profile?._normalizedType !== 'azure subscription') return;
              const parentId = String(
                profile?._authProfile?.tenantPermissionProfileId ||
                profile?._authProfile?.tenantProfileId ||
                ''
              ).trim();
              const parentTenant = parentId
                ? azureTenantByRecordId.get(parentId)
                : azureTenantByTenantId.get(String(profile?._authProfile?.tenantId || '').trim());
              if (!parentTenant) return;
              const parentTenantId = parentTenant?.recordId || parentTenant?.id;
              if (!parentTenantId) return;
              if (!childProfilesByAzureTenantId.has(parentTenantId)) {
                childProfilesByAzureTenantId.set(parentTenantId, []);
              }
              childProfilesByAzureTenantId.get(parentTenantId).push(profile);
            });

            const displayedRows = [];
            normalizedProfiles.forEach((profile) => {
              if (profile._normalizedType === 'aws org') {
                const orgId = profile?.recordId || profile?.id;
                displayedRows.push({
                  permission: profile,
                  isOrgChild: false,
                  orgParentName: null,
                });
                const children = (childProfilesByOrgId.get(orgId) || []).sort((a, b) =>
                  String(a?.name || '').localeCompare(String(b?.name || ''))
                );
                children.forEach((child) => {
                  displayedRows.push({
                    permission: child,
                    isOrgChild: true,
                    orgParentName: profile?.name || 'AWS Org',
                  });
                });
                return;
              }

              const parentOrg = getParentOrgForProfile(profile);
              if (parentOrg) return;
              if (profile._normalizedType === 'azure subscription') {
                const parentId = String(
                  profile?._authProfile?.tenantPermissionProfileId ||
                  profile?._authProfile?.tenantProfileId ||
                  ''
                ).trim();
                const parentTenant = parentId
                  ? azureTenantByRecordId.get(parentId)
                  : azureTenantByTenantId.get(String(profile?._authProfile?.tenantId || '').trim());
                if (parentTenant) return;
              }

              displayedRows.push({
                permission: profile,
                isOrgChild: false,
                orgParentName: null,
              });

              if (profile._normalizedType === 'azure tenant') {
                const tenantId = profile?.recordId || profile?.id;
                const subscriptions = (childProfilesByAzureTenantId.get(tenantId) || []).sort((a, b) =>
                  String(a?.name || '').localeCompare(String(b?.name || ''))
                );
                subscriptions.forEach((subscriptionProfile) => {
                  displayedRows.push({
                    permission: subscriptionProfile,
                    isOrgChild: false,
                    isAzureSubscription: true,
                    azureParentName: profile?.name || 'Azure Tenant',
                  });
                });
              }
            });
            
            if (cloudEnvironments.length === 0) {
              return (
                <div className="text-center py-8">
                  <p className="text-gray-500">No cloud environments found.</p>
                  <p className="text-gray-500">
                    Click 'Add Cloud Environment' to create a new environment.
                  </p>
                </div>
              );
            }
            
            if (deleteLoading) {
              return (
                <div className="text-center py-8">
                  <p className="text-gray-500">Processing your request...</p>
                </div>
              );
            }
            
            return (
              <>
                {invalidCredentialProfiles.length > 0 && (
                  <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Local AWS credentials need attention</AlertTitle>
                    <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        {invalidCredentialProfiles.length} environment{invalidCredentialProfiles.length === 1 ? '' : 's'} cannot currently authenticate.
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={recheckLocalCredentials}
                        disabled={isValidatingLocalCredentials}
                        className="self-start border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                      >
                        {isValidatingLocalCredentials ? 'Checking...' : 'Recheck'}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[240px] max-w-[240px]">Name</TableHead>
                      <TableHead className="w-[50px]">Type</TableHead>
                      <TableHead className="w-[140px]">Id</TableHead>
                      <TableHead className="max-w-[300px]">Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedRows.map((entry, idx) => (
                      <PermissionRow
                        key={`${entry.permission?.recordId || entry.permission?.id || entry.permission?.name || 'unknown'}-${entry.isOrgChild ? 'child' : entry.isAzureSubscription ? `azure-sub-${entry.permission?._subscriptionId || idx}` : 'root'}`}
                        permission={entry.permission}
                        isOrgChild={entry.isOrgChild}
                        orgParentName={entry.orgParentName}
                        isAzureSubscription={entry.isAzureSubscription}
                        azureParentName={entry.azureParentName}
                        editPermission={editPermission}
                        editPermissionRules={editPermissionRules}
                        openDeleteModal={(perm) => {
                          setDeletingPermission(perm);
                          setDeleteModalOpen(true);
                        }}
                        deleteLoading={deleteLoading}
                      />
                    ))}
                  </TableBody>
                </Table>
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* <AddEditPermissionModal
          isOpen={isAddModalOpen}
          onClose={handleModalClose}
          editingPermission={editingPermission}
        /> */}
      {isAddModalOpen && (
        <PermissionsModal
          isOpen={setupState.isPermissionsModalOpen}
          setState={setSetupState}
          state={setupState}
          authProfile={setupState.authProfile}
          requiredPermissions={setupState.requiredPermissions}
          defaultDeploymentPreferences={getGlobalWorkloadDeploymentPreferences(userSettings)}
          defaultSecurityRules={getGlobalWorkloadSecurityRules(userSettings)}
          onComplete={async (p) => {
            handlePermissionsComplete(p);
            handleModalClose();

            triggerCisReportForNewEnvironment('aws', {
              authType: p.authType,
              roleName: p.roleName,
              externalId: p.externalId,
              awsAccountId: p.awsAccountId,
              accessKeyId: p.accessKeyId,
              secretAccessKey: p.secretAccessKey,
              sessionToken: p.sessionToken,
              accountId: p.awsAccountId,
              name: p.name,
            }, p.awsAccountId);

            if (!setupState.isEditing && !setupState.isReconnecting && p?.recordId) {
              await validateAndLaunchWorkloadDiscoveryForEnvironment(p.recordId);
            }
          }}
          recordId={setupState.recordId || ''}
          existingAgentData={setupState.existingAgentData || {}}
          isReconnecting={setupState.isReconnecting}
          isDashboard={true}
          isEditing={setupState.isEditing}
          editingPermission={setupState.editingPermission}
          presetDescription={setupState.presetDescription}
          authType={setupState.authType}
          environmentType={selectedEnvironmentType}
          initialManualStep={setupState.initialManualStep || 0}
          onOpenChange={handleModalClose}
          onCancel={() => {
            cancelSetup();
            handleModalClose();
          }}
        />
      )}

      {isWorkloadModalOpen && (
        <WorkloadModal
          isOpen={isWorkloadModalOpen}
          onClose={() => {
            setIsWorkloadModalOpen(false);
            setEditingWorkload(null);
          }}
          workload={editingWorkload}
          userProfile={userProfile}
          hideGeneralTab={
            editingWorkload &&
            editingWorkload.workloadId &&
            editingWorkload.workloadId.startsWith('permission_')
          }
        />
      )}

      {isEditPermissionModalOpen && (
        <EditPermissionProfileModal
          isOpen={isEditPermissionModalOpen}
          onClose={() => {
            setIsEditPermissionModalOpen(false);
            setEditingPermission(null);
          }}
          permission={editingPermission}
        />
      )}

      <Dialog
        open={isLocalEnvironmentModalOpen}
        onOpenChange={(open) => {
          if (!open) closeLocalEnvironmentModal();
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col bg-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPermission ? 'Edit Local Environment' : 'Add Local Environment'}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2 pr-1">
            <div className="space-y-2">
              <Label htmlFor="local-environment-name">Name</Label>
              <Input
                id="local-environment-name"
                value={localEnvironmentForm.name}
                onChange={(event) => updateLocalEnvironmentForm('name', event.target.value)}
                placeholder="Production AWS account"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="local-environment-description">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="local-environment-description"
                value={localEnvironmentForm.description}
                onChange={(event) =>
                  updateLocalEnvironmentForm('description', event.target.value)
                }
                placeholder="e.g., My sandbox account for testing"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="local-environment-identifier">
                AWS Account ID <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="local-environment-identifier"
                value={localEnvironmentForm.identifier}
                onChange={(event) =>
                  updateLocalEnvironmentForm('identifier', event.target.value)
                }
                placeholder="123456789012"
              />
              <p className="text-xs text-muted-foreground">
                Will be auto-detected from credentials if not provided
              </p>
            </div>

            <div className="border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="local-credential-method">Credentials</Label>
                <select
                  id="local-credential-method"
                  value={localEnvironmentForm.credentialMethod}
                  onChange={(event) =>
                    updateLocalEnvironmentForm('credentialMethod', event.target.value)
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {LOCAL_AWS_CREDENTIAL_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {(localEnvironmentForm.credentialMethod === 'profile' ||
              localEnvironmentForm.credentialMethod === 'sso') && (
              <div className="space-y-2">
                <Label htmlFor="local-aws-profile">AWS Profile</Label>
                <Input
                  id="local-aws-profile"
                  list="local-aws-profile-options"
                  value={localEnvironmentForm.awsProfile}
                  onChange={(event) =>
                    updateLocalEnvironmentForm('awsProfile', event.target.value)
                  }
                  placeholder={isLoadingLocalAwsProfiles ? 'Loading profiles...' : 'default'}
                />
                <datalist id="local-aws-profile-options">
                  {localAwsProfiles.map((profile) => (
                    <option key={profile.name} value={profile.name}>
                      {profile.hasSso ? 'SSO' : profile.hasStaticCredentials ? 'credentials' : 'config'}
                    </option>
                  ))}
                </datalist>
              </div>
            )}
            {localEnvironmentForm.credentialMethod === 'static-credentials' && (
              <>
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium text-blue-900">Quick import from AWS console</p>
                      <p className="text-sm text-blue-700">
                        Copy the credential export block from the AWS SSO portal and paste it here to auto-fill all fields.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant={showAwsCredentialPaste ? 'secondary' : 'default'}
                      size="sm"
                      onClick={() => setShowAwsCredentialPaste((value) => !value)}
                      className="w-full sm:w-auto"
                    >
                      {showAwsCredentialPaste ? 'Hide paste area' : 'Paste credentials block'}
                    </Button>
                  </div>
                  {showAwsCredentialPaste && (
                    <div className="mt-3 space-y-3 border-t border-blue-200 pt-3">
                      <Textarea
                        value={awsCredentialPasteText}
                        onChange={(event) => setAwsCredentialPasteText(event.target.value)}
                        className="min-h-[120px] font-mono text-xs bg-white"
                        placeholder={'export AWS_ACCESS_KEY_ID="..."\nexport AWS_SECRET_ACCESS_KEY="..."\nexport AWS_SESSION_TOKEN="..."'}
                        spellCheck={false}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAwsCredentialPasteText('')}
                          disabled={!awsCredentialPasteText}
                        >
                          Clear
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={applyAwsCredentialPaste}
                          disabled={!awsCredentialPasteText.trim()}
                        >
                          Apply credentials
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-muted-foreground">or enter manually</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="local-access-key-id">Access Key ID</Label>
                  <Input
                    id="local-access-key-id"
                    value={localEnvironmentForm.accessKeyId}
                    onChange={(event) =>
                      updateLocalEnvironmentForm('accessKeyId', event.target.value)
                    }
                    placeholder="AKIA..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="local-secret-access-key">Secret Access Key</Label>
                  <Input
                    id="local-secret-access-key"
                    type="password"
                    value={localEnvironmentForm.secretAccessKey}
                    onChange={(event) =>
                      updateLocalEnvironmentForm('secretAccessKey', event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="local-session-token">
                    Session Token <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="local-session-token"
                    type="password"
                    value={localEnvironmentForm.sessionToken}
                    onChange={(event) =>
                      updateLocalEnvironmentForm('sessionToken', event.target.value)
                    }
                    placeholder="Required for temporary credentials"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="local-default-region">Default Region</Label>
              <Input
                id="local-default-region"
                value={localEnvironmentForm.defaultRegion}
                onChange={(event) =>
                  updateLocalEnvironmentForm('defaultRegion', event.target.value)
                }
                placeholder="us-east-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeLocalEnvironmentModal}
              disabled={isSavingLocalEnvironment}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={saveLocalEnvironment}
              disabled={isSavingLocalEnvironment || !localEnvironmentForm.name.trim()}
            >
              {isSavingLocalEnvironment ? 'Saving...' : 'Save Environment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingPermission(null);
        }}
        onConfirm={async () => {
          if (deletingPermission) {
            const normalizedType = normalizeProfileType(deletingPermission.type);
            
            if (normalizedType === 'azure tenant') {
              const tenantRecordId = deletingPermission.recordId || deletingPermission.id;
              const tenantId = parseAuthProfileSafe(deletingPermission.authProfile)?.tenantId;
              const allProfiles = userProfile?.agentPermissionProfiles || [];
              
              const subscriptionsToDelete = allProfiles.filter((profile) => {
                const profileType = normalizeProfileType(profile.type);
                if (profileType !== 'azure subscription') return false;
                
                const authProfile = parseAuthProfileSafe(profile.authProfile);
                const parentId = authProfile?.tenantPermissionProfileId || authProfile?.tenantProfileId;
                
                if (parentId && parentId === tenantRecordId) return true;
                if (tenantId && authProfile?.tenantId === tenantId) return true;
                
                return false;
              });
              
              for (const sub of subscriptionsToDelete) {
                await dispatch(
                  deleteAgentPermissionProfile({
                    recordId: sub.recordId || sub.id,
                  })
                ).unwrap();
              }
              
              await dispatch(
                deleteAgentPermissionProfile({
                  recordId: tenantRecordId,
                })
              ).unwrap();
              
              const subCount = subscriptionsToDelete.length;
              toast.success(
                subCount > 0
                  ? `Tenant and ${subCount} subscription${subCount > 1 ? 's' : ''} deleted successfully`
                  : 'Tenant deleted successfully'
              );
            } else {
              dispatch(
                deleteAgentPermissionProfile({
                  recordId: deletingPermission.recordId,
                })
              );
              toast.success('Permission deleted successfully');
            }
          }
          setDeleteModalOpen(false);
          setDeletingPermission(null);
        }}
        deleteText="Delete Permission"
        deleteDescription={`Are you sure you want to delete "${deletingPermission?.name}"?${
          normalizeProfileType(deletingPermission?.type) === 'azure tenant'
            ? ' This will also delete all subscriptions under this tenant.'
            : ''
        }`}
        deleteButtonText="Delete Permission"
      />

      {/* Cloud Provider Selector */}
      <CloudProviderSelector
        isOpen={isProviderSelectorOpen}
        onClose={() => setIsProviderSelectorOpen(false)}
        onSelectProvider={handleProviderSelect}
      />

      {/* Google Workspace Modal (Add) */}
      {isGoogleWorkspaceModalOpen && (
        <AddGoogleWorkspaceModal
          isOpen={isGoogleWorkspaceModalOpen}
          onClose={() => setIsGoogleWorkspaceModalOpen(false)}
          onComplete={(data) => {
            setIsGoogleWorkspaceModalOpen(false);

            if (data?.authProfile) {
              triggerCisReportForNewEnvironment(
                'google_workspace',
                data.authProfile,
                data.domain
              );
            }
          }}
        />
      )}

      {/* Google Workspace Modal (Edit) */}
      {isEditGoogleWorkspaceModalOpen && (
        <EditGoogleWorkspaceModal
          isOpen={isEditGoogleWorkspaceModalOpen}
          onClose={() => {
            setIsEditGoogleWorkspaceModalOpen(false);
            setEditingGoogleWorkspacePermission(null);
          }}
          permission={editingGoogleWorkspacePermission}
        />
      )}

      {/* AWS Org Modal (Edit) */}
      {isEditAwsOrgModalOpen && (
        <EditAwsOrgModal
          isOpen={isEditAwsOrgModalOpen}
          onClose={() => {
            setIsEditAwsOrgModalOpen(false);
            setEditingAwsOrgPermission(null);
          }}
          permission={editingAwsOrgPermission}
        />
      )}

    </>
  );
}

function PermissionRow({
  permission,
  isOrgChild = false,
  orgParentName = null,
  isAzureSubscription = false,
  azureParentName = null,
  editPermission,
  editPermissionRules,
  openDeleteModal,
  deleteLoading,
}) {
  if (!permission) return null;

  const authProfile = parseAuthProfileSafe(permission?.authProfile);
  
  const normalizedType = normalizeProfileType(permission?.type);
  // Check if this is an Azure subscription row
  const isAzureSubRow = isAzureSubscription || normalizedType === 'azure subscription';
  const subscriptionId = permission._subscriptionId || authProfile.subscriptionId;
  const parentTenantName = permission._parentTenantName || azureParentName;
  
  // Determine provider type from type field or authProfile
  const isGoogleWorkspace = authProfile.provider === 'google_workspace' || permission?.type === 'google_workspace';
  const isAzure = (normalizedType === 'azure tenant' || authProfile.provider === 'azure') && !isAzureSubRow;
  const isAwsOrg = normalizedType === 'aws org';
  const awsAccountId = authProfile.awsAccountId || 'N/A';
  const googleDomain = authProfile.adminEmail?.split('@')[1] || authProfile.projectId || 'N/A';
  const azureTenantId = authProfile.tenantId || 'N/A';

  // Truncate Azure tenant ID for display (show first 8 chars)
  const truncateTenantId = (tenantId) => {
    if (!tenantId || tenantId === 'N/A') return tenantId;
    if (tenantId.length <= 12) return tenantId;
    return `${tenantId.substring(0, 8)}...`;
  };

  // Truncate subscription ID for display
  const truncateSubscriptionId = (subId) => {
    if (!subId) return 'N/A';
    if (subId.length <= 12) return subId;
    return `${subId.substring(0, 8)}...`;
  };

  // Determine the display ID based on provider type
  const displayId = isAzureSubRow 
    ? truncateSubscriptionId(subscriptionId)
    : isGoogleWorkspace 
      ? googleDomain 
      : isAzure 
        ? truncateTenantId(azureTenantId) 
        : awsAccountId;
  
  // Full ID for tooltip
  const fullDisplayId = isAzureSubRow 
    ? subscriptionId
    : isGoogleWorkspace 
      ? googleDomain 
      : isAzure 
        ? azureTenantId 
        : awsAccountId;

  const hasValidId = displayId && displayId !== 'N/A';
  const needsTooltip = (isAzure || isAzureSubRow) && fullDisplayId && fullDisplayId.length > 12;
  
  const descriptionText = isAzureSubRow
    ? (permission.description || `Subscription under ${parentTenantName}`)
    : permission.description ||
      (isOrgChild && orgParentName ? `Part of ${orgParentName}` : '—');
  const credentialIssueMessage = getCredentialIssueMessage(permission);
  const credentialHasIssue = hasCredentialIssue(permission);
  const credentialStatus = getCredentialStatus(permission);
  const credentialCheckedAt = credentialStatus?.checkedAt
    ? new Date(credentialStatus.checkedAt).toLocaleString()
    : null;
  const credentialWarning = credentialHasIssue ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <div className="space-y-1">
            <p className="text-sm font-medium">Credential issue</p>
            <p className="text-xs">{credentialIssueMessage || 'Local AWS credentials need attention.'}</p>
            {credentialCheckedAt && (
              <p className="text-[11px] text-gray-500">Checked {credentialCheckedAt}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : null;

  // For Azure subscription rows, show limited actions
  if (isAzureSubRow) {
    return (
      <TableRow className="bg-sky-50/50">
        <TableCell className="font-medium w-[240px] max-w-[240px]">
          <div className="flex items-start gap-2 pl-5">
            <span className="text-gray-300 font-mono leading-5">└</span>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm text-gray-700">
                  {permission.name || authProfile.subscriptionName || 'Subscription'}
                </span>
                {credentialWarning}
              </div>
              <div className="text-[11px] text-gray-500 truncate">
                Member of {parentTenantName}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell className="w-[50px]">
          <Icons.azure className="h-4 w-4 text-sky-500" />
        </TableCell>
        <TableCell className="w-[140px]">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs px-2 py-1 rounded font-mono bg-sky-100 text-sky-800 cursor-default">
                  {displayId}
                </span>
              </TooltipTrigger>
              {needsTooltip && (
                <TooltipContent>
                  <p className="font-mono text-xs">{fullDisplayId}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </TableCell>
        <TableCell className="text-gray-600 max-w-[300px] truncate text-sm">
          {descriptionText}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-gray-900"
              onClick={() => editPermission(permission)}
            >
              Settings
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={() => openDeleteModal(permission)}
              disabled={deleteLoading}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className={isOrgChild ? 'bg-slate-50/70' : ''}>
      <TableCell className="font-medium w-[240px] max-w-[240px]">
        {isOrgChild ? (
          <div className="flex items-start gap-2 pl-5">
            <span className="text-gray-300 font-mono leading-5">└</span>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate">{permission.name}</span>
                {credentialWarning}
              </div>
              {orgParentName && (
                <div className="text-[11px] text-gray-500 truncate">
                  Member of {orgParentName}
                </div>
              )}
            </div>
          </div>
        ) : (
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate block">{permission.name}</span>
            {credentialWarning}
          </span>
        )}
      </TableCell>
      <TableCell className="w-[50px]">
        {isGoogleWorkspace ? (
          <Icons.googleWorkspace className="h-5 w-5" />
        ) : isAzure ? (
          <Icons.azure className="h-5 w-5" />
        ) : (
          hasValidId && <Icons.aws className="h-5 w-5" />
        )}
      </TableCell>
      <TableCell className="w-[140px]">
        {needsTooltip ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`text-xs px-2 py-1 rounded font-mono cursor-default ${
                  isGoogleWorkspace 
                    ? 'bg-blue-100 text-blue-800' 
                    : isAzure
                      ? 'bg-sky-100 text-sky-800'
                    : isOrgChild
                      ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {displayId}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-mono text-xs">{fullDisplayId}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className={`text-xs px-2 py-1 rounded font-mono ${
            isGoogleWorkspace 
              ? 'bg-blue-100 text-blue-800' 
              : isAzure
                ? 'bg-sky-100 text-sky-800'
              : isOrgChild
                ? 'bg-emerald-100 text-emerald-800'
              : 'bg-purple-100 text-purple-800'
          }`}>
            {displayId}
          </span>
        )}
      </TableCell>
      <TableCell className="text-gray-600 max-w-[300px] truncate">
        {descriptionText}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            onClick={() => editPermission(permission)}
          >
            Settings
          </Button>
          {!isGoogleWorkspace && !isAzure && !isAwsOrg && (
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              onClick={() => editPermissionRules(permission)}
              title="Workload Standards"
            >
              Workload Standards
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={() => openDeleteModal(permission)}
            disabled={deleteLoading}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

const PermissionPageSkeleton = () => {
  return (
    <Card className="bg-white">
      <CardHeader className="flex flex-row items-center justify-between border-b p-6 mb-8">
        <div className="">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36" />
      </CardHeader>
      <CardContent>
        {[1, 2, 3].map((index) => (
          <div key={index} className="mb-4 last:mb-0">
            <div className="flex items-center justify-between p-4 bg-white border rounded-lg">
              <div>
                <Skeleton className="h-6 w-40 mb-2" />
                <div className="flex gap-6">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
