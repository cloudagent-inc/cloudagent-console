import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import DeleteModal from '../../components/DeleteModal';
import { ChangePasswordComponent } from './ChangePassword';
import {
  updatePassword,
  setUpTOTP,
  updateMFAPreference,
  fetchMFAPreference,
  verifyTOTPSetup,
} from '@aws-amplify/auth';
import { toast } from 'react-hot-toast';
import { useSelector } from 'react-redux';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  MessageSquare,
  Copy,
  Download,
  CheckCircle2,
  AlertCircle,
  Key,
  Loader2,
  Eye,
  EyeOff,
  ChevronLeft,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const MFAStatusCard = ({ isEnabled, mfaType, onEnable, onManage }) => {
  return (
    <div className="bg-white rounded-[8px]">
      <div className="flex justify-between items-center border-b p-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl text-primary-800 font-[500]">
            Two-Factor Authentication
          </h1>
          {isEnabled ? (
            <Badge className="bg-green-100 text-green-800 border-green-300">
              <ShieldCheck className="w-3 h-3 mr-1" />
              Protected
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-300 text-amber-700"
            >
              <ShieldAlert className="w-3 h-3 mr-1" />
              Not Protected
            </Badge>
          )}
        </div>
        {isEnabled ? (
          <Button
            onClick={onManage}
            variant="outline"
            className="hidden md:flex"
          >
            Manage 2FA
          </Button>
        ) : (
          <Button onClick={onEnable} className="hidden md:flex">
            Enable 2FA
          </Button>
        )}
      </div>

      <div className="p-6 pb-8">
        {isEnabled ? (
          <div className="space-y-4">
            <p className="text-gray-600">
              Your account is secured with two-factor authentication
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Shield className="w-4 h-4 text-green-600" />
              <span className="text-gray-700">
                Method:{' '}
                <strong>
                  {mfaType === 'TOTP'
                    ? 'Authenticator App'
                    : 'SMS Text Message'}
                </strong>
              </span>
            </div>
            <Button
              onClick={onManage}
              variant="outline"
              className="w-full md:hidden"
            >
              Manage 2FA Settings
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">
              Add an extra layer of security to your account
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="text-amber-900 font-medium">
                    Your account is currently protected only by your password
                  </p>
                  <ul className="text-amber-700 space-y-1 mt-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Protects against unauthorized access
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Secures your sensitive data
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Prevents account takeover
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <Button onClick={onEnable} className="w-full md:hidden">
              Enable Two-Factor Authentication
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const BackupCodesDisplay = ({ codes, onDownload, onCopy }) => {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [showCodes, setShowCodes] = useState(false);

  const handleCopyCode = (code, index) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyAll = () => {
    const allCodes = codes.join('\n');
    navigator.clipboard.writeText(allCodes);
    toast.success('All backup codes copied to clipboard');
  };

  const handleDownload = () => {
    const content = `Two-Factor Authentication Backup Codes
Generated: ${new Date().toLocaleDateString()}

Keep these codes safe. Each code can only be used once.

${codes.join('\n')}

If you lose access to your authentication device, you can use one of these codes to sign in to your account.`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-codes.txt';
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Backup codes downloaded');
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">Backup Codes</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCodes(!showCodes)}
          >
            {showCodes ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyAll}>
            <Copy className="w-4 h-4 mr-1" />
            Copy All
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-1" />
            Download
          </Button>
        </div>
      </div>

      <Alert>
        <Key className="h-4 w-4" />
        <AlertDescription>
          Save these codes in a secure place. Each code can only be used once.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-2">
        {codes.map((code, index) => (
          <div
            key={index}
            className="relative group bg-gray-50 hover:bg-gray-100 border rounded-md p-2 font-mono text-sm cursor-pointer transition-colors"
            onClick={() => handleCopyCode(code, index)}
          >
            <span className={showCodes ? '' : 'blur-sm select-none'}>
              {showCodes ? code : '••••••••'}
            </span>
            {copiedIndex === index && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-600">
                Copied!
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const EnableMFAModal = ({ isOpen, onClose, onComplete }) => {
  const [step, setStep] = useState('method');
  const [method, setMethod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [totpSetupData, setTotpSetupData] = useState(null);
  const [codesSaved, setCodesSaved] = useState(false);

  const handleBack = () => {
    if (step === 'setup') {
      setStep('method');
      setMethod(null);
      setTotpSetupData(null);
    } else if (step === 'verify') {
      setStep('setup');
      setVerificationCode('');
    } else if (step === 'backup') {
      return;
    }
  };

  const handleMethodSelect = (selectedMethod) => {
    setMethod(selectedMethod);
    if (selectedMethod === 'TOTP') {
      setupTOTP();
    } else {
      setStep('setup');
    }
  };

  const setupTOTP = async () => {
    setLoading(true);
    try {
      const totpSetupDetails = await setUpTOTP();
      const appName = 'CloudAgent';
      const setupUri = totpSetupDetails.getSetupUri(appName);

      setTotpSetupData({
        qrCode: setupUri.href,
        secret: totpSetupDetails.sharedSecret,
      });
      setStep('setup');
    } catch (error) {
      toast.error('Failed to setup authenticator');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    try {
      if (method === 'TOTP') {
        await verifyTOTPSetup({ code: verificationCode });
        await updateMFAPreference({ totp: 'PREFERRED' });
      }

      const mockCodes = Array.from({ length: 8 }, () =>
        Math.random().toString(36).substring(2, 10).toUpperCase()
      );
      setBackupCodes(mockCodes);
      setStep('backup');
      toast.success('Two-factor authentication enabled successfully!');
    } catch (error) {
      toast.error('Invalid verification code. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    if (!codesSaved) {
      toast.error('Please confirm you have saved your backup codes');
      return;
    }
    onComplete(method);
    onClose();
    setStep('method');
    setMethod(null);
    setVerificationCode('');
    setBackupCodes([]);
    setCodesSaved(false);
  };

  const handleClose = () => {
    if (step === 'backup') {
      toast.error(
        'Please complete the setup process and save your backup codes'
      );
      return;
    }
    onClose();
    setStep('method');
    setMethod(null);
    setVerificationCode('');
    setTotpSetupData(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl bg-white">
        <DialogHeader>
          <div className="relative flex items-center mb-2">
            {(step === 'setup' || step === 'verify') && (
              <Button
                variant="ghost"
                size="icon"
                className="mr-2"
                onClick={handleBack}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle className="text-left">
              {step === 'method' && 'Choose Authentication Method'}
              {step === 'setup' &&
                `Set Up ${method === 'TOTP' ? 'Authenticator App' : 'SMS Authentication'}`}
              {step === 'verify' && 'Verify Setup'}
              {step === 'backup' && 'Save Backup Codes'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {step === 'method' &&
              'Select how you want to receive your authentication codes'}
            {step === 'setup' &&
              method === 'TOTP' &&
              'Scan the QR code with your authenticator app'}
            {step === 'setup' &&
              method === 'SMS' &&
              'Enter your phone number to receive codes'}
            {step === 'verify' && 'Enter the code from your authenticator app'}
            {step === 'backup' &&
              'Save these backup codes in a secure location'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 'method' && (
            <div className="space-y-3">
              <button
                onClick={() => handleMethodSelect('TOTP')}
                className="w-full p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left group"
                disabled={loading}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                      <Smartphone className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium">Authenticator App</p>
                      <p className="text-sm text-gray-500">
                        Google Authenticator, Authy, etc.
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )}

          {step === 'setup' && method === 'TOTP' && totpSetupData && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-6 rounded-lg flex justify-center">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  {totpSetupData.qrCode ? (
                    <QRCodeSVG
                      value={totpSetupData.qrCode}
                      size={200}
                      level="M"
                      includeMargin={true}
                    />
                  ) : (
                    <div className="w-[200px] h-[200px] flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Can't scan? Enter this code manually:
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    value={totpSetupData.secret}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(totpSetupData.secret);
                      toast.success('Secret copied to clipboard');
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Instructions:</strong> Open your authenticator app and
                  scan the QR code above, or manually enter the secret key.
                </p>
              </div>

              <Button className="w-full" onClick={() => setStep('verify')}>
                Next: Verify Setup
              </Button>
            </div>
          )}

          {step === 'setup' && method === 'SMS' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" type="tel" placeholder="+1 (555) 123-4567" />
              </div>

              <Button className="w-full" onClick={() => setStep('verify')}>
                Send Verification Code
              </Button>
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) =>
                    setVerificationCode(e.target.value.replace(/\D/g, ''))
                  }
                  className="text-center text-lg font-mono"
                  autoComplete="one-time-code"
                  autoFocus
                />
                <p className="text-xs text-gray-500 text-center">
                  Enter the 6-digit code from your{' '}
                  {method === 'TOTP' ? 'authenticator app' : 'SMS message'}
                </p>
              </div>

              <Button
                className="w-full"
                onClick={handleVerifyCode}
                disabled={loading || verificationCode.length !== 6}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Verify and Enable 2FA
              </Button>
            </div>
          )}

          {step === 'backup' && (
            <div className="space-y-4">
              <BackupCodesDisplay codes={backupCodes} />

              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900">Important:</p>
                  <p className="text-amber-700">
                    These codes are shown only once. Make sure to save them in a
                    secure location.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="codes-saved"
                  checked={codesSaved}
                  onChange={(e) => setCodesSaved(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="codes-saved" className="text-sm cursor-pointer">
                  I have saved my backup codes in a secure location
                </Label>
              </div>

              <Button
                className="w-full"
                onClick={handleComplete}
                disabled={!codesSaved}
              >
                Complete Setup
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ManageMFAModal = ({ isOpen, onClose, currentMethod, onDisable }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDisableMFA = async () => {
    setLoading(true);
    try {
      await updateMFAPreference({ totp: 'DISABLED' });
      toast.success('Two-factor authentication has been disabled');
      onDisable();
      onClose();
    } catch (error) {
      toast.error('Failed to disable 2FA. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
      setShowDisableConfirm(false);
      setPassword('');
    }
  };

  const mockBackupCodes = [
    'ABC123DE',
    'FGH456IJ',
    'KLM789NO',
    'PQR012ST',
    'UVW345XY',
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle>Manage Two-Factor Authentication</DialogTitle>
          <DialogDescription>
            Configure your two-factor authentication settings
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="backup">Backup Codes</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {currentMethod === 'TOTP' ? (
                    <Smartphone className="w-5 h-5 text-primary-600" />
                  ) : (
                    <MessageSquare className="w-5 h-5 text-primary-600" />
                  )}
                  <div>
                    <p className="font-medium">
                      {currentMethod === 'TOTP'
                        ? 'Authenticator App'
                        : 'SMS Text Message'}
                    </p>
                    <p className="text-sm text-gray-500">Currently active</p>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-700 border-0">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Your account is protected with two-factor authentication.
                  You'll need to enter a verification code when signing in.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>

          <TabsContent value="backup" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Backup Codes</p>
                  <p className="text-sm text-gray-500">
                    {mockBackupCodes.length} codes remaining
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Regenerate Codes
                </Button>
              </div>

              <Alert>
                <Key className="h-4 w-4" />
                <AlertDescription>
                  Use backup codes to sign in if you lose access to your
                  authentication device.
                </AlertDescription>
              </Alert>

              <BackupCodesDisplay codes={mockBackupCodes} />
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div className="space-y-4">
              <div className="border-t" />

              <div className="space-y-2">
                <h3 className="font-medium text-red-600">
                  Disable Two-Factor Authentication
                </h3>
                <p className="text-sm text-gray-500">
                  Remove the extra security layer from your account
                </p>

                {!showDisableConfirm ? (
                  <Button
                    variant="outline"
                    className="w-full border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => setShowDisableConfirm(true)}
                  >
                    Disable 2FA
                  </Button>
                ) : (
                  <div className="space-y-3 p-4 border border-red-200 rounded-lg bg-red-50">
                    <Alert className="border-red-200 bg-white">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        Disabling 2FA will make your account less secure. Are
                        you sure you want to continue?
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">
                        Confirm your password
                      </Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={handleDisableMFA}
                        disabled={!password || loading}
                      >
                        {loading && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        Confirm Disable
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setShowDisableConfirm(false);
                          setPassword('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default function MyAccountPage() {
  const [isChangePasswordView, setIsChangePasswordView] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaType, setMfaType] = useState(null);
  const [showEnableMFA, setShowEnableMFA] = useState(false);
  const [showManageMFA, setShowManageMFA] = useState(false);

  const { userProfile } = useSelector((state) => state.auth);

  useEffect(() => {
    checkMFAStatus();
  }, []);

  const checkMFAStatus = async () => {
    try {
      const preference = await fetchMFAPreference();
      if (
        preference?.preferred === 'TOTP' ||
        preference?.enabled?.includes('TOTP')
      ) {
        setMfaEnabled(true);
        setMfaType('TOTP');
      } else if (
        preference?.preferred === 'SMS' ||
        preference?.enabled?.includes('SMS')
      ) {
        setMfaEnabled(true);
        setMfaType('SMS');
      }
    } catch (error) {
      console.error('Error checking MFA status:', error);
    }
  };

  const handleDelete = () => {
    setIsModalOpen(false);
  };

  const handleChangePassword = async (currentPassword, newPassword) => {
    try {
      await updatePassword({ oldPassword: currentPassword, newPassword });
      toast.success('Password changed successfully');
      setIsChangePasswordView(false);
    } catch (error) {
      toast.error(error.message ? error.message : 'An unknown error occurred');
    }
  };

  const handleMFAEnabled = (method) => {
    setMfaEnabled(true);
    setMfaType(method);
    setShowEnableMFA(false);
  };

  const handleMFADisabled = () => {
    setMfaEnabled(false);
    setMfaType(null);
    setShowManageMFA(false);
  };

  if (isChangePasswordView) {
    return (
      <ChangePasswordComponent
        onBack={() => setIsChangePasswordView(false)}
        onChangePassword={handleChangePassword}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[8px]">
        <div className="flex justify-between items-center border-b p-6 py-4">
          <h1 className="text-2xl text-primary-800 font-[500]">
            Personal Information
          </h1>
        </div>

        <div className="space-y-4 p-6 pb-8">
          <div className="pb-2">
            <Label htmlFor="name">Username</Label>
            <Input id="name" value={userProfile?.username} disabled />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={userProfile?.email}
              disabled
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[8px]">
        <div className="flex justify-between items-center border-b p-6 py-4">
          <h1 className="text-2xl text-primary-800 font-[500]">Password</h1>
          <Button
            onClick={() => setIsChangePasswordView(true)}
            variant="outline"
            className="hidden md:flex"
          >
            Change Password
          </Button>
        </div>
        <div className="p-6 pb-8 mt-0">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value="********" readOnly />
          <Button
            onClick={() => setIsChangePasswordView(true)}
            variant="outline"
            className="flex mt-4 w-[100%] md:hidden"
          >
            Change Password
          </Button>
        </div>
      </div>

      <MFAStatusCard
        isEnabled={mfaEnabled}
        mfaType={mfaType}
        onEnable={() => setShowEnableMFA(true)}
        onManage={() => setShowManageMFA(true)}
      />

      <EnableMFAModal
        isOpen={showEnableMFA}
        onClose={() => setShowEnableMFA(false)}
        onComplete={handleMFAEnabled}
      />

      <ManageMFAModal
        isOpen={showManageMFA}
        onClose={() => setShowManageMFA(false)}
        currentMethod={mfaType}
        onDisable={handleMFADisabled}
      />

      <DeleteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleDelete}
        packageCost={100}
        newBalance={500}
        deleteDescription="Are you sure you want to delete your account? This action cannot be undone."
      />
    </div>
  );
}
