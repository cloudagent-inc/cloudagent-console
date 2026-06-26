import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import { Icons } from '../../components/icons';
import { ReloadIcon } from '@radix-ui/react-icons';
import InfoModal from '../../components/InfoModal';

export function ChangePasswordComponent({ onBack, onChangePassword }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const hasChanges = currentPassword || newPassword || confirmPassword;

  const handleBack = () => {
    if (hasChanges) {
      setShowConfirmModal(true);
    } else {
      onBack();
    }
  };

  const handleConfirmBack = () => {
    setShowConfirmModal(false);
    onBack();
  };

  const handleKeepEditing = () => {
    setShowConfirmModal(false);
  };

  const validatePassword = (password) => {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasMinLength = password.length >= 8;
    return hasUpperCase && hasNumber && hasMinLength;
  };

  const handleNewPasswordChange = (e) => {
    const password = e.target.value;
    setNewPassword(password);
    if (password && !validatePassword(password)) {
      setErrors((prev) => ({
        ...prev,
        newPassword:
          'Your password must contain at least 1 uppercase, 1 number, and 8 characters',
      }));
    } else {
      setErrors((prev) => ({ ...prev, newPassword: undefined }));
    }

    if (confirmPassword && password !== confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: "Your passwords don't match",
      }));
    } else {
      setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
    }
  };

  const handleConfirmPasswordChange = (e) => {
    const confirmPwd = e.target.value;
    setConfirmPassword(confirmPwd);
    if (confirmPwd && confirmPwd !== newPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: "Your passwords don't match",
      }));
    } else {
      setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
    }
  };

  const handleChangePassword = async () => {
    if (!validatePassword(newPassword) || newPassword !== confirmPassword) {
      return;
    }

    setIsLoading(true);
    try {
      await onChangePassword(currentPassword, newPassword);
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[8px]">
        <div className="flex justify-between items-center border-b p-6 py-4">
          <div className="flex items-center space-x-2">
            <Button onClick={handleBack} variant="link">
              <ArrowLeft className="h-4 w-4 mr-2" /> Personal Information
            </Button>
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={
              isLoading || Object.values(errors).filter(Boolean).length > 0
            }
            className="hidden md:block"
          >
            {isLoading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
            {'Change Password'}
          </Button>
        </div>

        <div className="space-y-4 p-6 pb-8">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <div
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? (
                  <Icons.visibility className="h-6 w-6" />
                ) : (
                  <Icons.visibilityHidden className="h-6 w-6" />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={handleNewPasswordChange}
              />
              <div
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? (
                  <Icons.visibility className="h-6 w-6" />
                ) : (
                  <Icons.visibilityHidden className="h-6 w-6" />
                )}
              </div>
            </div>
            {validatePassword(newPassword) && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <Icons.checkCircle className="text-green-600" />
                Your password must contain at least 1 uppercase, 1 number, and 8
                characters
              </p>
            )}
            {errors.newPassword && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <Icons.errorCircle />
                {errors.newPassword}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
              />
              <div
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <Icons.visibility className="h-6 w-6" />
                ) : (
                  <Icons.visibilityHidden className="h-6 w-6" />
                )}
              </div>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-red-600 flex items-center gap-1 mt-1">
                <Icons.errorCircle />
                {errors.confirmPassword}
              </p>
            )}
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={
              isLoading || Object.values(errors).filter(Boolean).length > 0
            }
            className="blockx md:block w-[100%]"
          >
            {isLoading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
            {'Change Password'}
          </Button>
        </div>
      </div>
      <InfoModal
        title="Password Changes"
        description="Are you sure you want to return without changing your password? This action cannot be undone."
        cancelText="Return to My Account"
        okText="Keep Editing"
        isOpen={showConfirmModal}
        onConfirm={handleKeepEditing}
        onClose={handleConfirmBack}
        type="warning"
        icon={<Icons.warning className="h-6 w-6 text-red-500" />}
      />
    </div>
  );
}
