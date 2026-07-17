import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDispatch } from 'react-redux';
import { updateAgentPermissionProfile } from '../../features/agent/agentSlice';
import toast from 'react-hot-toast';
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  FileJson, 
  Upload,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Helper to extract domain from email
const getDomainFromEmail = (email) => {
  if (!email || !email.includes('@')) return null;
  return email.split('@')[1];
};

const EditGoogleWorkspaceModal = ({ isOpen, onClose, permission }) => {
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);

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

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    adminEmail: '',
    projectId: '',
    clientEmail: '',
    serviceAccountJson: null,
    serviceAccountFileName: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [jsonError, setJsonError] = useState('');
  const [showServiceAccount, setShowServiceAccount] = useState(false);
  const [inputMethod, setInputMethod] = useState('upload'); // 'upload' or 'manual'
  const [manualJsonText, setManualJsonText] = useState('');

  // Initialize form data when permission changes
  useEffect(() => {
    if (permission) {
      setFormData({
        name: permission.name || '',
        description: permission.description || '',
        adminEmail: authProfile.adminEmail || '',
        projectId: authProfile.projectId || '',
        clientEmail: authProfile.clientEmail || '',
        serviceAccountJson: authProfile.serviceAccountJson || null,
        serviceAccountFileName: 'Service account key (stored)',
      });
    }
  }, [permission, authProfile]);

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
          projectId: json.project_id,
          clientEmail: json.client_email,
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
      // Reset to stored credentials when cleared
      setFormData((prev) => ({
        ...prev,
        serviceAccountJson: authProfile.serviceAccountJson,
        serviceAccountFileName: 'Service account key (stored)',
        projectId: authProfile.projectId,
        clientEmail: authProfile.clientEmail,
      }));
      return;
    }

    try {
      const json = JSON.parse(text);
      const validation = validateServiceAccountJson(json);
      
      if (!validation.valid) {
        setJsonError(validation.error);
        return;
      }

      setFormData((prev) => ({
        ...prev,
        serviceAccountJson: json,
        serviceAccountFileName: 'Manual entry',
        projectId: json.project_id,
        clientEmail: json.client_email,
      }));
      setJsonError('');
    } catch (err) {
      setJsonError('Invalid JSON format. Please check your input.');
    }
  };

  const handleInputMethodChange = (method) => {
    setInputMethod(method);
    setJsonError('');
    setManualJsonText('');
    // Reset to stored credentials when switching methods
    setFormData((prev) => ({
      ...prev,
      serviceAccountJson: authProfile.serviceAccountJson,
      serviceAccountFileName: 'Service account key (stored)',
      projectId: authProfile.projectId,
      clientEmail: authProfile.clientEmail,
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const hasNewServiceAccountKey = formData.serviceAccountFileName !== 'Service account key (stored)';

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    if (!formData.adminEmail.trim()) {
      toast.error('Admin email is required');
      return;
    }

    setIsSaving(true);
    try {
      // Extract domain from admin email
      const domain = getDomainFromEmail(formData.adminEmail);
      
      // Build the updated authProfile
      const updatedAuthProfile = {
        provider: 'google_workspace',
        domain: domain,
        adminEmail: formData.adminEmail,
        projectId: formData.projectId,
        clientEmail: formData.clientEmail,
        serviceAccountJson: formData.serviceAccountJson,
      };

      const updatePayload = {
        recordId: permission.recordId,
        name: formData.name,
        description: formData.description,
        authProfile: JSON.stringify(updatedAuthProfile),
      };

      await dispatch(updateAgentPermissionProfile(updatePayload)).unwrap();
      toast.success('Google Workspace environment updated successfully');
      onClose();
    } catch (error) {
      console.error('Error updating Google Workspace environment:', error);
      toast.error('Failed to update Google Workspace environment');
    } finally {
      setIsSaving(false);
    }
  };

  if (!permission) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white max-h-[95vh] overflow-auto">
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
              <DialogTitle className="text-2xl font-[600] text-primary-800">
                Edit Google Workspace Environment
              </DialogTitle>
              <DialogDescription>
                Update your Google Workspace environment configuration.
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
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Environment Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Description
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Description"
                rows={3}
              />
            </div>
          </div>

          {/* Google Workspace Configuration */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-900">Google Workspace Configuration</h3>
            
            <div className="space-y-2">
              <Label htmlFor="adminEmail" className="text-sm font-medium">
                Super Admin Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="adminEmail"
                type="email"
                value={formData.adminEmail}
                onChange={(e) => handleInputChange('adminEmail', e.target.value)}
                placeholder="admin@yourdomain.com"
              />
              <p className="text-xs text-gray-500">
                Email of a Super Admin in your Google Workspace domain
              </p>
            </div>

            {/* Current Service Account Info */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-medium text-gray-900 mb-3">Current Service Account</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Project ID:</span>
                  <span className="font-medium">{formData.projectId || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Client Email:</span>
                  <span className="font-medium truncate max-w-[300px]">{formData.clientEmail || '-'}</span>
                </div>
              </div>
            </div>

            {/* Update Service Account (collapsible) */}
            <div className="border rounded-lg">
              <button
                type="button"
                onClick={() => setShowServiceAccount(!showServiceAccount)}
                className="flex items-center justify-between w-full p-4 text-left hover:bg-gray-50 transition-colors"
              >
                <h4 className="font-medium text-gray-900">Update Service Account Key</h4>
                {showServiceAccount ? (
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </button>

              {showServiceAccount && (
                <div className="border-t p-4 space-y-4">
                  <Alert className="bg-yellow-50 border-yellow-200">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800 text-sm">
                      Only update the key if you need to rotate or replace the existing service account credentials.
                    </AlertDescription>
                  </Alert>

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

                      {!hasNewServiceAccountKey ? (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className={cn(
                            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                            "hover:border-primary-400 hover:bg-primary-50",
                            jsonError ? "border-red-300 bg-red-50" : "border-gray-300"
                          )}
                        >
                          <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600 mb-1">
                            Click to upload a new service account key
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
                                Project: {formData.projectId}
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
                                serviceAccountJson: authProfile.serviceAccountJson,
                                serviceAccountFileName: 'Service account key (stored)',
                                projectId: authProfile.projectId,
                                clientEmail: authProfile.clientEmail,
                              }));
                              if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                              }
                            }}
                            className="mt-2 text-gray-500 hover:text-gray-700"
                          >
                            Cancel and keep existing key
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
                          "font-mono text-sm min-h-[180px]",
                          jsonError && manualJsonText ? "border-red-300 focus:border-red-400" : "",
                          hasNewServiceAccountKey && inputMethod === 'manual' ? "border-green-300 focus:border-green-400" : ""
                        )}
                      />
                      <p className="text-xs text-gray-500">
                        Paste the entire contents of your service account JSON key file
                      </p>
                      {hasNewServiceAccountKey && inputMethod === 'manual' && (
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
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !formData.name.trim() || !formData.adminEmail.trim()}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditGoogleWorkspaceModal;

