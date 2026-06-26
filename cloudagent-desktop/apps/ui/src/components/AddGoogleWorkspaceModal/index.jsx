import React, { useState, useRef } from 'react';
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
  Upload,
  FileJson,
  CheckCircle,
  ExternalLink,
  AlertCircle,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { useDispatch } from 'react-redux';
import { createAgentPermissionProfile } from '../../features/agent/agentSlice';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const OAUTH_SCOPES = `https://www.googleapis.com/auth/admin.directory.user.readonly,https://www.googleapis.com/auth/admin.directory.rolemanagement.readonly,https://www.googleapis.com/auth/admin.directory.group.readonly,https://www.googleapis.com/auth/admin.reports.audit.readonly,https://www.googleapis.com/auth/admin.reports.usage.readonly,https://www.googleapis.com/auth/gmail.settings.basic,https://www.googleapis.com/auth/gmail.settings.sharing,https://www.googleapis.com/auth/drive.readonly,https://www.googleapis.com/auth/apps.alerts,https://www.googleapis.com/auth/apps.groups.settings`;

// Helper to extract and format domain from email
const getDomainFromEmail = (email) => {
  if (!email || !email.includes('@')) return null;
  const domain = email.split('@')[1];
  return domain;
};

const formatDomainForDisplay = (domain) => {
  if (!domain) return '';
  // Get the company name (first part before any dots)
  const companyName = domain.split('.')[0];
  // Capitalize first letter
  return companyName.charAt(0).toUpperCase() + companyName.slice(1);
};

const REQUIRED_APIS = [
  { name: 'Admin SDK API', searchTerm: 'admin sdk', link: 'https://console.cloud.google.com/apis/library/admin.googleapis.com' },
  { name: 'Gmail API', searchTerm: 'gmail', link: 'https://console.cloud.google.com/apis/library/gmail.googleapis.com' },
  { name: 'Google Drive API', searchTerm: 'drive', link: 'https://console.cloud.google.com/apis/library/drive.googleapis.com' },
  { name: 'Groups Settings API', searchTerm: 'groups settings', link: 'https://console.cloud.google.com/apis/library/groupssettings.googleapis.com' },
  { name: 'Google Workspace Alert Center API', searchTerm: 'alert center', link: 'https://console.cloud.google.com/apis/library/alertcenter.googleapis.com' },
];

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="h-8 px-2"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
};

const CollapsibleSection = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <h4 className="font-medium text-gray-900">{title}</h4>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>
      {isOpen && (
        <div className="border-t p-4 bg-gray-50">
          {children}
        </div>
      )}
    </div>
  );
};

export const AddGoogleWorkspaceModal = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    adminEmail: '',
    serviceAccountJson: null,
    serviceAccountFileName: '',
  });
  const [jsonError, setJsonError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputMethod, setInputMethod] = useState('upload'); // 'upload' or 'manual'
  const [manualJsonText, setManualJsonText] = useState('');

  const stepLabels = [
    'Setup Instructions',
    'Service Account Key',
    'Review & Save',
  ];

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Validate JSON (shared between upload and manual entry)
  const validateServiceAccountJson = (json) => {
    const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id'];
    const missingFields = requiredFields.filter(field => !json[field]);
    
    if (missingFields.length > 0) {
      return { valid: false, error: `Invalid service account JSON. Missing fields: ${missingFields.join(', ')}` };
    }

    if (json.type !== 'service_account') {
      return { valid: false, error: 'Invalid JSON. Expected a service account key file.' };
    }

    return { valid: true, error: null };
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setJsonError('Please upload a valid JSON file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        const validation = validateServiceAccountJson(json);
        
        if (!validation.valid) {
          setJsonError(validation.error);
          return;
        }

        setFormData((prev) => ({
          ...prev,
          serviceAccountJson: json,
          serviceAccountFileName: file.name,
        }));
        setJsonError('');
      } catch (err) {
        setJsonError('Invalid JSON file. Please upload a valid service account key file.');
      }
    };
    reader.readAsText(file);
  };

  const handleManualJsonChange = (text) => {
    setManualJsonText(text);
    setJsonError('');
    
    if (!text.trim()) {
      setFormData((prev) => ({
        ...prev,
        serviceAccountJson: null,
        serviceAccountFileName: '',
      }));
      return;
    }

    try {
      const json = JSON.parse(text);
      const validation = validateServiceAccountJson(json);
      
      if (!validation.valid) {
        setJsonError(validation.error);
        setFormData((prev) => ({
          ...prev,
          serviceAccountJson: null,
          serviceAccountFileName: '',
        }));
        return;
      }

      setFormData((prev) => ({
        ...prev,
        serviceAccountJson: json,
        serviceAccountFileName: 'Manual entry',
      }));
      setJsonError('');
    } catch (err) {
      setJsonError('Invalid JSON format. Please check your input.');
      setFormData((prev) => ({
        ...prev,
        serviceAccountJson: null,
        serviceAccountFileName: '',
      }));
    }
  };

  const handleInputMethodChange = (method) => {
    setInputMethod(method);
    setJsonError('');
    // Clear the form when switching methods
    setFormData((prev) => ({
      ...prev,
      serviceAccountJson: null,
      serviceAccountFileName: '',
    }));
    setManualJsonText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.adminEmail || !formData.serviceAccountJson) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // Extract domain from admin email
      const domain = getDomainFromEmail(formData.adminEmail);
      
      // Create the authProfile for Google Workspace
      const authProfile = {
        provider: 'google_workspace',
        domain: domain,
        adminEmail: formData.adminEmail,
        serviceAccountJson: formData.serviceAccountJson,
        projectId: formData.serviceAccountJson.project_id,
        clientEmail: formData.serviceAccountJson.client_email,
      };

      await dispatch(
        createAgentPermissionProfile({
          name: formData.name,
          description: formData.description,
          type: 'google_workspace',
          authProfile: JSON.stringify(authProfile),
        })
      ).unwrap();

      toast.success(`Google Workspace environment "${formData.name}" added successfully!`);
      onComplete?.({
        name: formData.name,
        type: 'google_workspace',
        authProfile,
        domain,
      });
      onClose();
    } catch (error) {
      console.error('Error saving Google Workspace environment:', error);
      toast.error('Failed to save Google Workspace environment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedToStep2 = true; // Step 1 is just instructions
  const canProceedToStep3 = formData.serviceAccountJson && formData.adminEmail;
  const canSave = formData.name && formData.adminEmail && formData.serviceAccountJson;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[900px] bg-white max-h-[90vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div>
              <DialogTitle className="text-2xl font-semibold text-primary-800 tracking-normal text-left">
                Add Google Workspace Environment
              </DialogTitle>
             
            </div>
          </div>
        </DialogHeader>

        <Stepper steps={stepLabels} activeStep={currentStep} />

        <div className="mt-6">
          {/* Step 1: Setup Instructions */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Follow these steps to set up a service account with domain-wide delegation in your Google Workspace.
                </AlertDescription>
              </Alert>

              <CollapsibleSection title="Step 1: Create a GCP Project" defaultOpen={true}>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                  <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">Google Cloud Console <ExternalLink className="h-3 w-3" /></a></li>
                  <li>Click the project dropdown → <strong>New Project</strong></li>
                  <li>Name it (e.g., <code className="bg-gray-100 px-1 rounded">workspace-scanner</code>) and click <strong>Create</strong></li>
                  <li>Select the new project from the dropdown</li>
                </ol>
              </CollapsibleSection>

              <CollapsibleSection title="Step 2: Enable Required APIs">
                <p className="text-sm text-gray-600 mb-3">
                  Go to <strong>APIs & Services → Library</strong> and enable these APIs:
                </p>
                <div className="space-y-2">
                  {REQUIRED_APIS.map((api) => (
                    <div key={api.name} className="flex items-center justify-between bg-white p-2 rounded border">
                      <span className="text-sm">{api.name}</span>
                      <a
                        href={api.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        Enable <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Step 3: Create a Service Account">
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                  <li>Go to <strong>IAM & Admin → Service Accounts</strong></li>
                  <li>Click <strong>+ Create Service Account</strong></li>
                  <li>Fill in:
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                      <li><strong>Name:</strong> <code className="bg-gray-100 px-1 rounded">workspace-scanner</code></li>
                      <li><strong>Description:</strong> Service account for Google Workspace security scanning</li>
                    </ul>
                  </li>
                  <li>Click <strong>Create and Continue</strong></li>
                  <li>Skip the optional "Grant access" steps → Click <strong>Done</strong></li>
                </ol>
              </CollapsibleSection>

              <CollapsibleSection title="Step 4: Create and Download the JSON Key">
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                  <li>Click on the service account you just created</li>
                  <li>Go to the <strong>Keys</strong> tab</li>
                  <li>Click <strong>Add Key → Create new key</strong></li>
                  <li>Select <strong>JSON</strong> → Click <strong>Create</strong></li>
                  <li>Save the downloaded JSON file</li>
                </ol>
                <Alert className="mt-3 bg-yellow-50 border-yellow-200">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800 text-sm">
                    Keep this file secure! It provides full access to the scopes you authorize.
                  </AlertDescription>
                </Alert>
              </CollapsibleSection>

              <CollapsibleSection title="Step 5: Set Up Domain-Wide Delegation">
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                  <li>Go to <a href="https://admin.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">Google Workspace Admin Console <ExternalLink className="h-3 w-3" /></a></li>
                  <li>Navigate to: <strong>Security → Access and data control → API controls</strong></li>
                  <li>Scroll down to <strong>Domain-wide delegation</strong> → Click <strong>Manage Domain Wide Delegation</strong></li>
                  <li>Click <strong>Add new</strong></li>
                </ol>
              </CollapsibleSection>

              <CollapsibleSection title="Step 6: Configure the Service Account">
                <div className="space-y-3 text-sm text-gray-600">
                  <div>
                    <p className="font-medium mb-1">1. Client ID:</p>
                    <p>Copy the <strong>Unique ID</strong> (numeric) from your service account in GCP. Find it at: GCP Console → IAM & Admin → Service Accounts → Click your service account → Copy the <strong>Unique ID</strong> (NOT the email)</p>
                  </div>
                  <div>
                    <p className="font-medium mb-1">2. OAuth Scopes:</p>
                    <p className="mb-2">Paste ALL of these scopes (comma-separated):</p>
                    <div className="bg-gray-100 p-3 rounded-md relative">
                      <pre className="text-xs whitespace-pre-wrap break-all pr-10">{OAUTH_SCOPES}</pre>
                      <div className="absolute top-2 right-2">
                        <CopyButton text={OAUTH_SCOPES} />
                      </div>
                    </div>
                  </div>
                  <p>3. Click <strong>Authorize</strong></p>
                </div>
              </CollapsibleSection>
            </div>
          )}

          {/* Step 2: Service Account Key */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="adminEmail" className="text-gray-700 flex items-center">
                    Super Admin Email <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={formData.adminEmail}
                    onChange={(e) => handleInputChange('adminEmail', e.target.value)}
                    placeholder="admin@yourdomain.com"
                  />
                  <p className="text-xs text-gray-500">
                    Email of a Super Admin in your Google Workspace domain. This account will be impersonated for scanning.
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="text-gray-700 flex items-center">
                    Service Account JSON Key <span className="text-red-500 ml-1">*</span>
                  </Label>
                  
                  {/* Input Method Toggle */}
                  <div className="flex rounded-lg border border-gray-200 p-1 bg-gray-50 w-fit">
                    <button
                      type="button"
                      onClick={() => handleInputMethodChange('upload')}
                      className={cn(
                        "px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2",
                        inputMethod === 'upload'
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      <Upload className="h-4 w-4" />
                      Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInputMethodChange('manual')}
                      className={cn(
                        "px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2",
                        inputMethod === 'manual'
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      <FileJson className="h-4 w-4" />
                      Paste JSON
                    </button>
                  </div>

                  {/* File Upload Method */}
                  {inputMethod === 'upload' && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        className="hidden"
                      />

                      {!formData.serviceAccountJson ? (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className={cn(
                            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                            "hover:border-primary-400 hover:bg-primary-50",
                            jsonError ? "border-red-300 bg-red-50" : "border-gray-300"
                          )}
                        >
                          <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                          <p className="text-sm text-gray-600 mb-1">
                            Click to upload or drag and drop
                          </p>
                          <p className="text-xs text-gray-500">
                            JSON file (service account key)
                          </p>
                        </div>
                      ) : (
                        <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                              <FileJson className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{formData.serviceAccountFileName}</p>
                              <p className="text-sm text-gray-500">
                                Project: {formData.serviceAccountJson.project_id}
                              </p>
                            </div>
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                serviceAccountJson: null,
                                serviceAccountFileName: '',
                              }));
                              if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                              }
                            }}
                            className="mt-2 text-gray-500 hover:text-gray-700"
                          >
                            Remove and upload different file
                          </Button>
                        </div>
                      )}
                    </>
                  )}

                  {/* Manual JSON Entry Method */}
                  {inputMethod === 'manual' && (
                    <div className="space-y-2">
                      <Textarea
                        value={manualJsonText}
                        onChange={(e) => handleManualJsonChange(e.target.value)}
                        placeholder={`Paste your service account JSON key here...\n\n{\n  "type": "service_account",\n  "project_id": "your-project-id",\n  "private_key_id": "...",\n  ...\n}`}
                        className={cn(
                          "font-mono text-sm min-h-[200px]",
                          jsonError && manualJsonText ? "border-red-300 focus:border-red-400" : "",
                          formData.serviceAccountJson ? "border-green-300 focus:border-green-400" : ""
                        )}
                      />
                      <p className="text-xs text-gray-500">
                        Paste the entire contents of your service account JSON key file
                      </p>
                      {formData.serviceAccountJson && inputMethod === 'manual' && (
                        <div className="flex items-center gap-2 text-green-600 text-sm">
                          <CheckCircle className="h-4 w-4" />
                          <span>Valid service account JSON detected</span>
                        </div>
                      )}
                    </div>
                  )}

                  {jsonError && (
                    <Alert className="bg-red-50 border-red-200">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-700">
                        {jsonError}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              {formData.serviceAccountJson && (
                <Alert className="bg-blue-50 border-blue-200">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Service Account Details:</strong>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li><strong>Project ID:</strong> {formData.serviceAccountJson.project_id}</li>
                      <li><strong>Client Email:</strong> {formData.serviceAccountJson.client_email}</li>
                      <li><strong>Client ID:</strong> {formData.serviceAccountJson.client_id}</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 3: Review & Save */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-gray-700 flex items-center">
                    Environment Name <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g. Acme Workspace"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-gray-700">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="e.g. Google Workspace environment for acme.com"
                    rows={3}
                  />
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-medium text-gray-900 mb-3">Configuration Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Provider:</span>
                    <span className="font-medium">Google Workspace</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Admin Email:</span>
                    <span className="font-medium">{formData.adminEmail || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Project ID:</span>
                    <span className="font-medium">{formData.serviceAccountJson?.project_id || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Service Account:</span>
                    <span className="font-medium truncate max-w-[250px]">
                      {formData.serviceAccountJson?.client_email || '-'}
                    </span>
                  </div>
                </div>
              </div>

              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800 text-sm">
                  <strong>Security Note:</strong> Your service account credentials will be securely stored and encrypted. 
                  Only authorized operations will use these credentials.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex flex-col sm:flex-row justify-between mt-6 gap-4 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              if (currentStep > 0) {
                setCurrentStep(currentStep - 1);
              } else {
                onClose();
              }
            }}
            className="w-full sm:w-auto"
          >
            {currentStep > 0 ? 'Back' : 'Cancel'}
          </Button>
          
          <Button
            onClick={() => {
              if (currentStep < stepLabels.length - 1) {
                // When moving from step 2 to step 3, prefill name and description if empty
                if (currentStep === 1 && formData.adminEmail) {
                  const domain = getDomainFromEmail(formData.adminEmail);
                  const displayName = formatDomainForDisplay(domain);
                  
                  setFormData((prev) => ({
                    ...prev,
                    name: prev.name || `${displayName} Workspace`,
                    description: prev.description || `Google Workspace environment for ${domain}`,
                  }));
                }
                setCurrentStep(currentStep + 1);
              } else {
                handleSave();
              }
            }}
            disabled={
              (currentStep === 1 && !canProceedToStep3) ||
              (currentStep === 2 && !canSave) ||
              isSubmitting
            }
            className="w-full sm:w-auto"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {currentStep < stepLabels.length - 1
              ? `Continue to Step ${currentStep + 2}`
              : 'Save Environment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddGoogleWorkspaceModal;
