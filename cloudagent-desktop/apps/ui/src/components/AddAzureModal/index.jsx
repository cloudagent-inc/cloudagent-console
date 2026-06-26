import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Stepper } from '../Stepper';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  CheckCircle,
  Download,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useDispatch } from 'react-redux';
import { createAgentPermissionProfile } from '../../features/agent/agentSlice';
import { azureAccountFunctions } from '../../api/apigw';
import { getAzureOnboardingTemplate } from '../../helpers/azureOnboardingTemplates';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

// --- Constants ---

const PROVIDER_NAME = 'CloudAgent';

const ENVIRONMENT_OPTIONS = [
  { value: 'public', label: 'Azure Public' },
  { value: 'usgovernment', label: 'Azure US Government' },
];

const RESOURCE_TYPE_OPTIONS = [
  { value: 'subscription', label: 'Manually Enter Subscription IDs' },
  { value: 'mg', label: 'Fetch Automatically with Management Group ID' },
];

const ONBOARDING_METHODS = [
  { value: 'terraform', label: 'Terraform', description: 'Download a Terraform template to create the service principal and assign permissions' },
  { value: 'powershell', label: 'PowerShell', description: 'Download a PowerShell script to create the service principal and assign permissions' },
  { value: 'manual', label: 'Manual Steps', description: 'Follow step-by-step instructions to manually create the service principal in Azure Portal' },
];

/** Graph API permissions needed for the service principal */
const GRAPH_PERMISSIONS = [
  'Directory.Read.All',
  'Policy.Read.All',
  'User.Read.All',
  'AuditLog.Read.All',
  'IdentityRiskyUser.Read.All',
  'IdentityRiskyServicePrincipal.Read.All',
  'IdentityRiskEvent.Read.All',
  'UserAuthenticationMethod.Read',
];

const MANUAL_STEPS = [
  {
    id: 'createServicePrincipal',
    title: 'Create App Registration',
    instructions: [
      'Go to Azure Portal → Azure Active Directory → App registrations',
      'Click "New registration"',
      `Name it "${PROVIDER_NAME}-SP"`,
      'Select "Accounts in this organizational directory only"',
      'Click "Register"',
      'Copy the Application (client) ID and Directory (tenant) ID',
    ],
  },
  {
    id: 'setClientSecret',
    title: 'Create Client Secret',
    instructions: [
      'In your App Registration, go to "Certificates & secrets"',
      'Click "New client secret"',
      'Add a description and select an expiry (recommended: 12 months)',
      'Click "Add"',
      'Copy the secret Value immediately (it won\'t be shown again)',
    ],
  },
  {
    id: 'assignGraphPermissions',
    title: 'Assign Graph API Permissions',
    instructions: [
      'Go to "API permissions" in your App Registration',
      'Click "Add a permission" → "Microsoft Graph" → "Application permissions"',
      ...GRAPH_PERMISSIONS.map((p) => `Add: ${p}`),
      'Click "Grant admin consent" to activate all permissions',
    ],
  },
  {
    id: 'assignSubscriptionPermissions',
    title: 'Assign Subscription Permissions',
    instructions: [
      'Go to the Azure Subscription (or Management Group) in the portal',
      'Navigate to "Access control (IAM)"',
      'Click "Add" → "Add role assignment"',
      'Select "Reader" role',
      'Under "Members", select your App Registration',
      'Also assign "Backup Reader" role using the same steps',
      'Click "Review + assign"',
    ],
  },
];

// --- Small Reusable Components ---

/** Copy-to-clipboard button */
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('Failed to copy'); }
  };
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 px-2">
      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
};

/** Collapsible section used throughout the wizard */
const CollapsibleSection = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg">
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center justify-between w-full p-4 text-left hover:bg-gray-50 transition-colors">
        <h4 className="font-medium text-gray-900">{title}</h4>
        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>
      {isOpen && <div className="border-t p-4 bg-gray-50">{children}</div>}
    </div>
  );
};

// --- Step Components ---

/**
 * Step 1 – Tenant setup: tenant ID, description, environment type
 */
const TenantSetupStep = ({ formData, onChange, errors }) => (
  <div className="space-y-6">
    <div className="space-y-2">
      <Label htmlFor="tenantId" className="text-gray-700 flex items-center">
        Azure Tenant ID <span className="text-red-500 ml-1">*</span>
      </Label>
      <Input
        id="tenantId"
        value={formData.tenantId}
        onChange={(e) => onChange('tenantId', e.target.value.trim())}
        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        className={errors.tenantId ? 'border-red-300' : ''}
      />
      {errors.tenantId && <p className="text-xs text-red-500">{errors.tenantId}</p>}
      <p className="text-xs text-gray-500">
        Find this in Azure Portal → Azure Active Directory → Overview → "Tenant ID"
      </p>
    </div>

    <div className="space-y-2">
      <Label className="text-gray-700">Environment Type</Label>
      <div className="flex gap-6">
        {ENVIRONMENT_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-2 cursor-pointer"
          >
            <input
              type="radio"
              name="tenantEnvironment"
              value={opt.value}
              checked={formData.tenantEnvironment === opt.value}
              onChange={() => onChange('tenantEnvironment', opt.value)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-gray-700">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  </div>
);

/**
 * Step 2 – Subscription access: manual IDs or management group
 */
const SubscriptionAccessStep = ({ formData, onChange, errors }) => {
  /** Add a blank subscription row */
  const addSubscription = () => {
    onChange('subscriptions', [
      ...formData.subscriptions,
      { subscriptionId: '', subscriptionDescription: '', environmentType: '' },
    ]);
  };

  /** Remove a subscription by index */
  const removeSubscription = (idx) => {
    onChange('subscriptions', formData.subscriptions.filter((_, i) => i !== idx));
  };

  /** Update one subscription field by index */
  const updateSubscription = (idx, field, value) => {
    const updated = formData.subscriptions.map((sub, i) =>
      i === idx ? { ...sub, [field]: value } : sub,
    );
    onChange('subscriptions', updated);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-gray-700">How will you provide subscription access?</Label>
        <div className="space-y-2">
          {RESOURCE_TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                formData.resourceType === opt.value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300',
              )}
            >
              <input
                type="radio"
                name="resourceType"
                value={opt.value}
                checked={formData.resourceType === opt.value}
                onChange={() => onChange('resourceType', opt.value)}
                className="h-4 w-4 text-primary-600"
              />
              <span className="text-sm font-medium text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Manual subscription IDs */}
      {formData.resourceType === 'subscription' && (
        <div className="space-y-3">
          <Label className="text-gray-700">Subscription IDs</Label>
          {formData.subscriptions.map((sub, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="grid grid-cols-2 gap-2 flex-1">
                <Input
                  value={sub.subscriptionId}
                  onChange={(e) => updateSubscription(idx, 'subscriptionId', e.target.value.trim())}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
                <Input
                  value={sub.subscriptionDescription}
                  onChange={(e) => updateSubscription(idx, 'subscriptionDescription', e.target.value)}
                  placeholder="Description (optional)"
                />
              </div>
              {formData.subscriptions.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => removeSubscription(idx)} className="text-red-500 hover:text-red-700 shrink-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addSubscription} className="mt-1">
            <Plus className="h-4 w-4 mr-1" /> Add Subscription
          </Button>
          {errors.subscriptions && <p className="text-xs text-red-500">{errors.subscriptions}</p>}
        </div>
      )}

      {/* Management group */}
      {formData.resourceType === 'mg' && (
        <div className="space-y-2">
          <Label htmlFor="managementGroupId" className="text-gray-700 flex items-center">
            Management Group ID <span className="text-red-500 ml-1">*</span>
          </Label>
          <Input
            id="managementGroupId"
            value={formData.managementGroupId}
            onChange={(e) => onChange('managementGroupId', e.target.value.trim())}
            placeholder="my-management-group"
            className={errors.managementGroupId ? 'border-red-300' : ''}
          />
          {errors.managementGroupId && <p className="text-xs text-red-500">{errors.managementGroupId}</p>}
          <p className="text-xs text-gray-500">
            Subscriptions under this management group will be fetched automatically after validation.
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * Step 3 – Service principal onboarding method + credentials
 */
const ServicePrincipalStep = ({
  formData,
  onChange,
  errors,
  onboardingMethod,
  setOnboardingMethod,
}) => {
  /** Generate and download the appropriate template file */
  const downloadTemplate = (format) => {
    const isMg = formData.resourceType === 'mg';
    const templateName = isMg ? `MgtGrp-SP.${format}` : `Subs-SP.${format}`;

    const content = getAzureOnboardingTemplate({
      templateName,
      managementGroupId: formData.managementGroupId,
      subscriptionIds: formData.subscriptions
        .map((s) => s.subscriptionId)
        .filter(Boolean),
      providerName: PROVIDER_NAME,
    });

    const ext = format === 'tf' ? 'tf' : 'ps1';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${PROVIDER_NAME}-azure-sp.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left column - Credentials */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Service Principal Credentials</h4>

        <div className="space-y-2">
          <Label htmlFor="clientId" className="text-gray-700 flex items-center">
            Application (Client) ID <span className="text-red-500 ml-1">*</span>
          </Label>
          <Input
            id="clientId"
            value={formData.clientId}
            onChange={(e) => onChange('clientId', e.target.value.trim())}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className={errors.clientId ? 'border-red-300' : ''}
          />
          {errors.clientId && <p className="text-xs text-red-500">{errors.clientId}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="clientSecret" className="text-gray-700 flex items-center">
            Client Secret <span className="text-red-500 ml-1">*</span>
          </Label>
          <Input
            id="clientSecret"
            type="password"
            value={formData.clientSecret}
            onChange={(e) => onChange('clientSecret', e.target.value)}
            placeholder="Enter client secret value"
            className={errors.clientSecret ? 'border-red-300' : ''}
          />
          {errors.clientSecret && <p className="text-xs text-red-500">{errors.clientSecret}</p>}
        </div>
      </div>

      {/* Right column - Onboarding method */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Setup Instructions</h4>
        
        {/* Method selector in a row */}
        <div className="flex gap-2">
          {ONBOARDING_METHODS.map((method) => (
            <button
              key={method.value}
              type="button"
              onClick={() => setOnboardingMethod(method.value)}
              className={cn(
                'flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
                onboardingMethod === method.value
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {method.label}
            </button>
          ))}
        </div>

        {/* Terraform download */}
        {onboardingMethod === 'terraform' && (
          <div className="border rounded-lg p-4 bg-blue-50 border-blue-200 space-y-3">
            <p className="text-sm text-blue-800">
              Download the Terraform template, run <code className="bg-blue-100 px-1 rounded">terraform init && terraform apply</code>,
              then enter the output values.
            </p>
            <Button variant="outline" size="sm" onClick={() => downloadTemplate('tf')}>
              <Download className="h-4 w-4 mr-1" /> Download Terraform Template
            </Button>
          </div>
        )}

        {/* PowerShell download */}
        {onboardingMethod === 'powershell' && (
          <div className="border rounded-lg p-4 bg-blue-50 border-blue-200 space-y-3">
            <p className="text-sm text-blue-800">
              Download the PowerShell script, run it in Azure Cloud Shell or locally with Azure CLI,
              then enter the output values.
            </p>
            <Button variant="outline" size="sm" onClick={() => downloadTemplate('ps1')}>
              <Download className="h-4 w-4 mr-1" /> Download PowerShell Script
            </Button>
          </div>
        )}

        {/* Manual steps */}
        {onboardingMethod === 'manual' && (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {MANUAL_STEPS.map((step, idx) => (
              <CollapsibleSection key={step.id} title={`${idx + 1}. ${step.title}`} defaultOpen={idx === 0}>
                <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-600">
                  {step.instructions.map((inst, i) => (
                    <li key={i}>{inst}</li>
                  ))}
                </ol>
              </CollapsibleSection>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Step 4 – Validate connection and save
 */
const ValidateAndSaveStep = ({
  formData,
  onChange,
  errors,
  connectionStatus,
  connectionLoading,
  onTestConnection,
  fetchedSubscriptions,
}) => {
  /** Map status to visual treatment */
  const getStatusDisplay = () => {
    if (connectionLoading) return { variant: 'default', icon: <Loader2 className="h-5 w-5 animate-spin text-blue-600" />, message: 'Validating connection...' };
    if (connectionStatus === 'success') return { variant: 'success', icon: <CheckCircle className="h-5 w-5 text-green-600" />, message: 'Connection validated successfully!' };
    if (connectionStatus && connectionStatus !== 'success') return { variant: 'destructive', icon: <XCircle className="h-5 w-5 text-red-600" />, message: typeof connectionStatus === 'string' ? connectionStatus : 'Connection failed. Please verify your credentials.' };
    return null;
  };

  const status = getStatusDisplay();

  return (
    <div className="space-y-6">
      {/* Environment name — required for save */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-gray-700 flex items-center">
          Environment Name <span className="text-red-500 ml-1">*</span>
        </Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="e.g. Production Azure"
          className={errors.name ? 'border-red-300' : ''}
        />
        {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
      </div>

      {/* Description — required */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-gray-700 flex items-center">
          Description <span className="text-red-500 ml-1">*</span>
        </Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="e.g. My Azure tenant"
          className={errors.description ? 'border-red-300' : ''}
        />
        {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
      </div>

      {/* Configuration summary */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h4 className="font-medium text-gray-900 mb-3">Configuration Summary</h4>
        <div className="space-y-2 text-sm">
          <SummaryRow label="Provider" value="Microsoft Azure" />
          <SummaryRow label="Tenant ID" value={formData.tenantId} />
          <SummaryRow label="Client ID" value={formData.clientId} />
          <SummaryRow label="Environment" value={formData.tenantEnvironment === 'public' ? 'Azure Public' : 'Azure US Government'} />
          <SummaryRow
            label="Subscriptions"
            value={
              formData.resourceType === 'mg'
                ? `Management Group: ${formData.managementGroupId}`
                : `${formData.subscriptions.filter((s) => s.subscriptionId).length} subscription(s)`
            }
          />
        </div>
      </div>

      {/* Test connection */}
      <div className="space-y-3">
        <Button onClick={onTestConnection} disabled={connectionLoading} className="w-full">
          {connectionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Test Connection
        </Button>

        {status && (
          <Alert className={cn(
            connectionStatus === 'success' ? 'bg-green-50 border-green-200' : connectionStatus ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200',
          )}>
            <div className="flex items-center gap-3">
              {status.icon}
              <AlertDescription className={cn(
                connectionStatus === 'success' ? 'text-green-800' : connectionStatus ? 'text-red-800' : 'text-blue-800',
              )}>
                {status.message}
              </AlertDescription>
            </div>
          </Alert>
        )}
      </div>

      {/* Fetched subscriptions for management group mode */}
      {fetchedSubscriptions.length > 0 && (
        <div className="border rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">
            Discovered Subscriptions ({fetchedSubscriptions.length})
          </h4>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {fetchedSubscriptions.map((sub) => (
              <div key={sub.subscriptionId} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-gray-50">
                <span className="font-mono text-xs text-gray-600">{sub.subscriptionId}</span>
                <span className="text-gray-500 text-xs">{sub.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

/** Small helper for key-value display rows */
const SummaryRow = ({ label, value }) => (
  <div className="flex justify-between">
    <span className="text-gray-500">{label}:</span>
    <span className="font-medium truncate max-w-[280px]">{value || '—'}</span>
  </div>
);

// --- Main Modal ---

export const AddAzureModal = ({ isOpen, onClose, onComplete }) => {
  const dispatch = useDispatch();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [onboardingMethod, setOnboardingMethod] = useState('terraform');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Connection validation state
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [connectionLoading, setConnectionLoading] = useState(false);
  const [fetchedSubscriptions, setFetchedSubscriptions] = useState([]);

  // Form data — mirrors asecurecloud's Azure data model
  const [formData, setFormData] = useState({
    name: '',
    description: 'My Azure tenant',
    tenantId: '',
    clientId: '',
    clientSecret: '',
    tenantEnvironment: 'public',
    resourceType: 'subscription', // 'subscription' | 'mg'
    managementGroupId: '',
    subscriptions: [{ subscriptionId: '', subscriptionDescription: '', environmentType: '' }],
  });

  const stepLabels = [
    'Tenant Setup',
    'Subscriptions',
    'Service Principal',
    'Validate & Save',
  ];

  /** Generic field updater */
  const handleChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field-level error when user edits
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  // --- Validation helpers ---

  const isValidUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  /** Validate fields for the current step and return true if valid */
  const validateStep = (step) => {
    const next = {};

    if (step === 0) {
      if (!formData.tenantId) next.tenantId = 'Tenant ID is required';
      else if (!isValidUuid(formData.tenantId)) next.tenantId = 'Invalid UUID format';
    }

    if (step === 1) {
      if (formData.resourceType === 'subscription') {
        const validSubs = formData.subscriptions.filter((s) => s.subscriptionId);
        if (validSubs.length === 0) next.subscriptions = 'At least one subscription ID is required';
      }
      if (formData.resourceType === 'mg' && !formData.managementGroupId) {
        next.managementGroupId = 'Management Group ID is required';
      }
    }

    if (step === 2) {
      if (!formData.clientId) next.clientId = 'Client ID is required';
      else if (!isValidUuid(formData.clientId)) next.clientId = 'Invalid UUID format';
      if (!formData.clientSecret) next.clientSecret = 'Client Secret is required';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // --- Connection test ---

  const handleTestConnection = async () => {
    setConnectionLoading(true);
    setConnectionStatus(null);

    try {
      const subscriptionIds = formData.resourceType === 'subscription'
        ? formData.subscriptions.map((s) => s.subscriptionId).filter(Boolean)
        : [];

      const params = {
        eventType: 'validate_creds',
        subscriptionIds,
        tenantId: formData.tenantId,
        clientId: formData.clientId,
        clientSecret: formData.clientSecret,
        tenantEnvironment: formData.tenantEnvironment || 'public',
      };

      const result = await azureAccountFunctions(params);
      setConnectionStatus(result?.status === 200 ? 'success' : (result?.error || 'error'));

      // If management group mode, also fetch subscriptions
      if (result?.status === 200 && formData.resourceType === 'mg') {
        await fetchMgSubscriptions();
      }
    } catch (error) {
      setConnectionStatus('error');
      console.error('Azure connection test error:', error);
    } finally {
      setConnectionLoading(false);
    }
  };

  /** Fetch subscriptions under the management group */
  const fetchMgSubscriptions = async () => {
    try {
      const res = await azureAccountFunctions({
        eventType: 'list_subscriptions',
        managementGroupNameOrId: formData.managementGroupId,
        tenantId: formData.tenantId,
        clientId: formData.clientId,
        clientSecret: formData.clientSecret,
      });

      if (res?.status === 200 && res.subscriptionIds) {
        const subs = res.subscriptionIds.map((item) => ({
          subscriptionId: item.name,
          name: item.displayName || item.name,
          subscriptionDescription: item.displayName || item.name,
          environmentType: '',
        }));
        setFetchedSubscriptions(subs);
      }
    } catch (error) {
      console.error('Failed to fetch management group subscriptions:', error);
    }
  };

  // --- Save ---

  const handleSave = async () => {
    const saveErrors = {};
    if (!formData.name) saveErrors.name = 'Name is required';
    if (!formData.description) saveErrors.description = 'Description is required';
    if (Object.keys(saveErrors).length > 0) {
      setErrors(saveErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      // Build subscription list (manual entries or fetched from MG)
      const subscriptions = formData.resourceType === 'mg'
        ? fetchedSubscriptions
        : formData.subscriptions.filter((s) => s.subscriptionId);

      const subscriptionIds = subscriptions
        .map((subscription) => subscription.subscriptionId)
        .filter(Boolean);

      const tenantAuthProfile = {
        provider: 'azure',
        tenantId: formData.tenantId,
        clientId: formData.clientId,
        clientSecret: formData.clientSecret,
        tenantEnvironment: formData.tenantEnvironment,
        subscriptionIds,
      };

      const tenantProfile = await dispatch(
        createAgentPermissionProfile({
          name: formData.name,
          description: formData.description,
          type: 'azure tenant',
          authProfile: JSON.stringify(tenantAuthProfile),
        }),
      ).unwrap();

      const subscriptionProfiles = await Promise.all(
        subscriptions.map((subscription) => {
          const subscriptionId = subscription.subscriptionId;
          const subscriptionName =
            subscription.name ||
            subscription.subscriptionDescription ||
            subscriptionId;
          return dispatch(
            createAgentPermissionProfile({
              name: `${formData.name} / ${subscriptionName}`,
              description:
                subscription.subscriptionDescription ||
                `Azure subscription under ${formData.name}`,
              type: 'azure subscription',
              authProfile: JSON.stringify({
                provider: 'azure',
                tenantId: formData.tenantId,
                clientId: formData.clientId,
                clientSecret: formData.clientSecret,
                tenantEnvironment: formData.tenantEnvironment,
                subscriptionId,
                subscriptionName,
              }),
            }),
          ).unwrap();
        }),
      );

      toast.success(`Azure tenant and ${subscriptions.length} subscription(s) added successfully!`);
      onComplete?.({
        tenantId: formData.tenantId,
        subscriptionIds,
        authProfile: tenantAuthProfile,
        tenantProfile,
        subscriptionProfiles,
      });
      onClose();
    } catch (error) {
      console.error('Error saving Azure environment:', error);
      toast.error('Failed to save Azure environment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Navigation ---

  const goNext = () => {
    if (!validateStep(currentStep)) return;

    // Auto-fill name on entering last step
    if (currentStep === 2 && !formData.name) {
      const shortTenant = formData.tenantId.split('-')[0];
      handleChange('name', `Azure ${shortTenant}`);
    }

    setCurrentStep((s) => Math.min(s + 1, stepLabels.length - 1));
  };

  const goBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
    else onClose();
  };

  const isLastStep = currentStep === stepLabels.length - 1;
  const canSave = formData.name && formData.description && connectionStatus === 'success';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[900px] bg-white max-h-[90vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <img src="/logo-azure.png" alt="Azure" className="w-6 h-6" />
            </div>
            <DialogTitle className="text-2xl font-semibold text-primary-800 tracking-normal text-left">
              Add Azure Environment
            </DialogTitle>
          </div>
        </DialogHeader>

        <Stepper steps={stepLabels} activeStep={currentStep} />

        <div className="mt-6">
          {currentStep === 0 && <TenantSetupStep formData={formData} onChange={handleChange} errors={errors} />}
          {currentStep === 1 && <SubscriptionAccessStep formData={formData} onChange={handleChange} errors={errors} />}
          {currentStep === 2 && (
            <ServicePrincipalStep
              formData={formData}
              onChange={handleChange}
              errors={errors}
              onboardingMethod={onboardingMethod}
              setOnboardingMethod={setOnboardingMethod}
            />
          )}
          {currentStep === 3 && (
            <ValidateAndSaveStep
              formData={formData}
              onChange={handleChange}
              errors={errors}
              connectionStatus={connectionStatus}
              connectionLoading={connectionLoading}
              onTestConnection={handleTestConnection}
              fetchedSubscriptions={fetchedSubscriptions}
            />
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex flex-col sm:flex-row justify-between mt-6 gap-4 pt-4 border-t">
          <Button variant="outline" onClick={goBack} className="w-full sm:w-auto">
            {currentStep > 0 ? 'Back' : 'Cancel'}
          </Button>

          <Button
            onClick={isLastStep ? handleSave : goNext}
            disabled={isLastStep ? (!canSave || isSubmitting) : false}
            className="w-full sm:w-auto"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLastStep ? 'Save Environment' : `Continue to Step ${currentStep + 2}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddAzureModal;
