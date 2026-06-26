import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Icons } from '../../components/icons';
import { confirmSignUp, resendSignUpCode, signIn } from '@aws-amplify/auth';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDispatch, useSelector } from 'react-redux';
import { setError, setUser } from '../../features/auth/authSlice';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const ConfirmAccount = ({
  username,
  password,
  onBack,
  flow = 'signup',
}) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [confirmationCode, setConfirmationCode] = useState('');
  const [confirmationError, setConfirmationError] = useState('');
  const [loading, setLoading] = useState(false);
  const { checkAuthStatus } = useAuth();

  const handleConfirmSignUp = async (e) => {
    e.preventDefault();

    if (!confirmationCode) {
      setConfirmationError('Please enter the verification code');
      return;
    }

    setLoading(true);

    try {
      await confirmSignUp({
        username,
        confirmationCode,
      });

      const response = await signIn({
        username,
        password,
      });

      const { isSignedIn, nextStep } = response;

      if (isSignedIn) {
        dispatch(setUser({ isSignedIn, nextStep }));
        dispatch(setError(null));
        await checkAuthStatus();
      }
    } catch (error) {
      setConfirmationError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      setLoading(true);
      await resendSignUpCode({
        username,
      });
      setConfirmationError('');
    } catch (error) {
      setConfirmationError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md bg-white">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center items-center space-x-2 mb-4">
          <Icons.logo />
        </div>
        <h2 className="text-2xl text-primary-800 font-semibold tracking-tight">
          Verify Your Email
        </h2>
        <p className="text-sm text-gray-400">
          Please check your email for the verification code
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {confirmationError && (
          <Alert variant="destructive">
            <AlertDescription>{confirmationError}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleConfirmSignUp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              disabled
              className="bg-gray-50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Verification Code</Label>
            <Input
              id="code"
              placeholder="Enter verification code"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify Account
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleResendCode}
              disabled={loading}
            >
              Resend Code
            </Button>
            {onBack && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={onBack}
                disabled={loading}
              >
                Back to {flow === 'signup' ? 'Sign Up' : 'Sign In'}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
