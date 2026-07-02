import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Icons } from '../../components/icons';
import {
  confirmResetPassword,
  resetPassword,
  signIn,
  confirmSignIn,
} from '@aws-amplify/auth';
import { setUser, setLoading, setError } from '../../features/auth/authSlice';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfirmAccount } from '../SignUp/ConfirmAccount';
import { Loader2, Smartphone, Shield } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { analytics, ANALYTICS_EVENTS, getAnalyticsRoute } from '../../hooks/useAnalytics';
import { BACKEND_API_ENDPOINT, IS_PUBLIC_SITE } from '../../config/appConfig';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [view, setView] = useState('login');
  const [buttonLoading, setButtonLoading] = useState(false);
  const [oauthState, setOauthState] = useState('');
  const [oauthRedirectUri, setOauthRedirectUri] = useState('');
  const [oauthScope, setOauthScope] = useState('');
  const [isOAuthFlow, setIsOAuthFlow] = useState(false);
  const [forcedNewPassword, setForcedNewPassword] = useState('');
  const [forcedNewPasswordConfirm, setForcedNewPasswordConfirm] = useState('');

  const [mfaCode, setMfaCode] = useState('');
  const [mfaType, setMfaType] = useState(null);
  const [tempUser, setTempUser] = useState(null);

  const { checkAuthStatus } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { error, isAuthenticated } = useSelector((state) => state.auth);
  const loginPlan = new URLSearchParams(location.search).get('plan');
  const postAuthPath =
    loginPlan === 'individual' || loginPlan === 'teams'
      ? `/pricing?plan=${loginPlan}&checkout=1`
      : '/dashboard/commandcenter';

  useEffect(() => {
    if (isAuthenticated && !isOAuthFlow) {
      navigate(postAuthPath, { replace: true });
    }
  }, [isAuthenticated, isOAuthFlow, navigate, postAuthPath]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasOAuthState = params.has('oauth_state');

    if (!hasOAuthState) {
      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('oauth_redirect_uri');
      sessionStorage.removeItem('oauth_scope');
    }

    const stateParam = params.get('oauth_state') || '';
    const redirectParam = params.get('redirect_uri') || '';
    const scopeParam = params.get('scope') || '';

    if (stateParam) {
      sessionStorage.setItem('oauth_state', stateParam);
    }
    if (redirectParam) {
      sessionStorage.setItem('oauth_redirect_uri', redirectParam);
    }
    if (scopeParam) {
      sessionStorage.setItem('oauth_scope', scopeParam);
    }

    setOauthState(stateParam || sessionStorage.getItem('oauth_state') || '');
    setOauthRedirectUri(
      redirectParam || sessionStorage.getItem('oauth_redirect_uri') || ''
    );
    setOauthScope(scopeParam || sessionStorage.getItem('oauth_scope') || '');
    setIsOAuthFlow(hasOAuthState);
  }, []);

  const oauthAppName = useMemo(() => {
    if (!oauthRedirectUri) {
      return 'your app';
    }
    try {
      return new URL(oauthRedirectUri).hostname;
    } catch {
      return 'your app';
    }
  }, [oauthRedirectUri]);

  const oauthScopes = useMemo(() => {
    if (!oauthScope) {
      return [];
    }
    return oauthScope.split(' ').filter(Boolean);
  }, [oauthScope]);

  const completeOAuthFlow = async ({ passwordOverride } = {}) => {
    const params = new URLSearchParams(window.location.search);
    const oauthStateParam = params.get('oauth_state') || oauthState;

    if (!oauthStateParam) {
      dispatch(setError('Session expired, please try again.'));
      return;
    }

    const response = await fetch(
      `${BACKEND_API_ENDPOINT}/oauth/authenticate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: email,
          password: passwordOverride || password,
          oauth_state: oauthStateParam,
        }),
      }
    );

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      const errorMap = {
        invalid_credentials: 'Invalid email or password.',
        user_not_found: 'Account not found.',
        invalid_state: 'Session expired, please try again.',
        NEW_PASSWORD_REQUIRED: 'Password update required before continuing.',
      };

      const message =
        errorMap[data.error] ||
        data.error_description ||
        data.error ||
        'Login failed.';
      dispatch(setError(message));
      return;
    }

    if (data.redirect_url) {
      window.location.href = data.redirect_url;
      return;
    }

    dispatch(setError('Login completed, but no redirect was provided.'));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    dispatch(setLoading(true));
    setButtonLoading(true);
    dispatch(setError(null));

    try {
      const response = await signIn({
        username: email,
        password,
      });

      const { isSignedIn, nextStep } = response;

      if (isSignedIn) {
        dispatch(setUser({ isSignedIn, nextStep }));
        dispatch(setError(null));
        await checkAuthStatus();
        analytics.track(ANALYTICS_EVENTS.USER_SIGNED_IN, {
          route: getAnalyticsRoute(),
        });
        if (isOAuthFlow) {
          await completeOAuthFlow({ passwordOverride: password });
        }
      } else if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
        setNeedsConfirmation(true);
      } else if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
        setMfaType('TOTP');
        setView('mfa');
        setTempUser(response);
        dispatch(setError(null));
      } else if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_SMS_CODE') {
        setMfaType('SMS');
        setView('mfa');
        setTempUser(response);
        dispatch(setError(null));
      } else if (
        nextStep.signInStep === 'CONTINUE_SIGN_IN_WITH_MFA_SELECTION'
      ) {
        setView('mfaSelection');
        setTempUser(response);
        dispatch(setError(null));
      } else if (nextStep.signInStep === 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP') {
        setView('totpSetup');
        setTempUser(response);
        dispatch(setError(null));
      } else if (
        nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED'
      ) {
        setView('newPasswordRequired');
        setTempUser(response);
        dispatch(setError(null));
      } else {
        dispatch(setError('Sign-in not completed'));
      }
      setButtonLoading(false);
    } catch (error) {
      dispatch(setError(error.message));
      analytics.track(ANALYTICS_EVENTS.ERR_SIGN_IN, {
        route: getAnalyticsRoute(),
        error_message: error?.message || 'Sign in failed',
      });
      setButtonLoading(false);
    } finally {
      setButtonLoading(false);
      dispatch(setLoading(false));
    }
  };

  const handleCancelOAuth = () => {
    if (!oauthRedirectUri) {
      dispatch(setError('Unable to cancel: missing redirect URI.'));
      return;
    }
    try {
      const redirectUrl = new URL(oauthRedirectUri);
      redirectUrl.searchParams.set('error', 'access_denied');
      redirectUrl.searchParams.set('error_description', 'User cancelled');
      window.location.href = redirectUrl.toString();
    } catch {
      const separator = oauthRedirectUri.includes('?') ? '&' : '?';
      window.location.href = `${oauthRedirectUri}${separator}error=access_denied&error_description=User%20cancelled`;
    }
  };

  const handleNewPasswordRequired = async (e) => {
    e.preventDefault();
    dispatch(setError(null));

    if (forcedNewPassword !== forcedNewPasswordConfirm) {
      dispatch(setError('Passwords do not match.'));
      return;
    }

    setButtonLoading(true);
    dispatch(setLoading(true));

    try {
      const response = await confirmSignIn({
        challengeResponse: forcedNewPassword,
      });

      const { isSignedIn, nextStep } = response;

      if (isSignedIn) {
        dispatch(setUser({ isSignedIn, nextStep }));
        dispatch(setError(null));
        await checkAuthStatus();
        analytics.track(ANALYTICS_EVENTS.USER_SIGNED_IN, {
          route: getAnalyticsRoute(),
        });
        if (isOAuthFlow) {
          await completeOAuthFlow({ passwordOverride: forcedNewPassword });
        }
        return;
      }

      if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
        setMfaType('TOTP');
        setView('mfa');
        setTempUser(response);
        return;
      }

      if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_SMS_CODE') {
        setMfaType('SMS');
        setView('mfa');
        setTempUser(response);
        return;
      }

      if (nextStep.signInStep === 'CONTINUE_SIGN_IN_WITH_MFA_SELECTION') {
        setView('mfaSelection');
        setTempUser(response);
        return;
      }

      dispatch(setError('Password updated, but sign-in was not completed.'));
    } catch (error) {
      dispatch(setError(error.message));
      analytics.track(ANALYTICS_EVENTS.ERR_SIGN_IN, {
        route: getAnalyticsRoute(),
        error_message: error?.message || 'Sign in failed',
      });
    } finally {
      setButtonLoading(false);
      dispatch(setLoading(false));
    }
  };

  const handleMFAVerification = async (e) => {
    e.preventDefault();
    setButtonLoading(true);

    try {
      const response = await confirmSignIn({
        challengeResponse: mfaCode,
      });

      const { isSignedIn, nextStep } = response;

      if (isSignedIn) {
        dispatch(setUser({ isSignedIn, nextStep }));
        dispatch(setError(null));
        await checkAuthStatus();
        analytics.track(ANALYTICS_EVENTS.USER_SIGNED_IN, {
          route: getAnalyticsRoute(),
        });
        if (isOAuthFlow) {
          await completeOAuthFlow({ passwordOverride: password });
        }
      } else {
        dispatch(setError('MFA verification failed'));
      }
    } catch (error) {
      const errorMessage = error.name === 'NotAuthorizedException'
        ? 'Invalid verification code. Please try again.'
        : (error.message || 'Sign in failed');
      if (error.name === 'NotAuthorizedException') {
        dispatch(setError('Invalid verification code. Please try again.'));
      } else {
        dispatch(setError(error.message));
      }
      analytics.track(ANALYTICS_EVENTS.ERR_SIGN_IN, {
        route: getAnalyticsRoute(),
        error_message: errorMessage,
      });
    } finally {
      setButtonLoading(false);
    }
  };

  const handleMFASelection = async (selectedType) => {
    setButtonLoading(true);
    try {
      const response = await confirmSignIn({
        challengeResponse: selectedType,
      });

      const { isSignedIn, nextStep } = response;

      if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
        setMfaType('TOTP');
        setView('mfa');
      } else if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_SMS_CODE') {
        setMfaType('SMS');
        setView('mfa');
      } else if (isSignedIn) {
        dispatch(setUser({ isSignedIn, nextStep }));
        await checkAuthStatus();
        if (isOAuthFlow) {
          await completeOAuthFlow({ passwordOverride: password });
        }
      }
    } catch (error) {
      dispatch(setError(error.message));
    } finally {
      setButtonLoading(false);
    }
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    setButtonLoading(true);

    try {
      await resetPassword({ username: email });
      setView('resetPassword');
      dispatch(setError(null));
    } catch (error) {
      dispatch(setError(error.message));
    } finally {
      setButtonLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setButtonLoading(true);

    try {
      await confirmResetPassword({
        username: email,
        confirmationCode: resetCode,
        newPassword,
      });
      dispatch(setError(null));

      try {
        const response = await signIn({
          username: email,
          password: newPassword,
        });

        const { isSignedIn, nextStep } = response;

        if (isSignedIn) {
          dispatch(setUser({ isSignedIn, nextStep }));
          if (isOAuthFlow) {
            await completeOAuthFlow({ passwordOverride: newPassword });
          }
        } else if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
          setNeedsConfirmation(true);
        } else {
          dispatch(setError('Sign-in not completed after password reset'));
        }
      } catch (e) {
        dispatch(
          setError(
            'Password reset successful, but automatic login failed. Please try logging in manually.'
          )
        );
        setView('login');
      }
    } catch (error) {
      dispatch(setError(error.message));
    } finally {
      setButtonLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {};

  if (needsConfirmation) {
    return (
      <div className="min-h-[87vh] flex items-center justify-center bg-gray-100">
        <ConfirmAccount
          username={email}
          password={password}
          onBack={() => setNeedsConfirmation(false)}
          flow="signin"
        />
      </div>
    );
  }

  return (
    <div className="min-h-full md:min-h-[87vh] flex items-center justify-center bg-gray-100 p-2 md:p-0">
      <Card className="w-full max-w-md bg-white">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center items-center space-x-2 mb-4">
            <Icons.logo />
          </div>
          {view === 'login' && (
            <>
              <h2 className="text-2xl text-primary-800 font-semibold tracking-tight">
                {isOAuthFlow
                  ? `Sign in to connect with ${oauthAppName}`
                  : 'Log in to your account'}
              </h2>
              <p className="text-sm text-gray-400">
                {isOAuthFlow
                  ? 'Continue to authorize access to your account.'
                  : 'Welcome back! Please enter your details.'}
              </p>
            </>
          )}
          {view === 'sendCode' && (
            <h2 className="text-2xl text-primary-800 font-semibold tracking-tight">
              Reset your password
            </h2>
          )}
          {view === 'resetPassword' && (
            <h2 className="text-2xl text-primary-800 font-semibold tracking-tight">
              Set New password
            </h2>
          )}
          {view === 'mfa' && (
            <>
              <div className="flex justify-center mb-2">
                <Shield className="h-12 w-12 text-primary-600" />
              </div>
              <h2 className="text-2xl text-primary-800 font-semibold tracking-tight">
                Two-Factor Authentication
              </h2>
              <p className="text-sm text-gray-400">
                {mfaType === 'TOTP'
                  ? 'Enter the 6-digit code from your authenticator app'
                  : 'Enter the verification code sent to your device'}
              </p>
            </>
          )}
          {view === 'mfaSelection' && (
            <>
              <div className="flex justify-center mb-2">
                <Shield className="h-12 w-12 text-primary-600" />
              </div>
              <h2 className="text-2xl text-primary-800 font-semibold tracking-tight">
                Choose Verification Method
              </h2>
              <p className="text-sm text-gray-400">
                Select how you'd like to verify your identity
              </p>
            </>
          )}
          {view === 'totpSetup' && (
            <>
              <div className="flex justify-center mb-2">
                <Smartphone className="h-12 w-12 text-primary-600" />
              </div>
              <h2 className="text-2xl text-primary-800 font-semibold tracking-tight">
                Set Up Authenticator
              </h2>
              <p className="text-sm text-gray-400">
                Scan the QR code with your authenticator app
              </p>
            </>
          )}
          {view === 'newPasswordRequired' && (
            <>
              <h2 className="text-2xl text-primary-800 font-semibold tracking-tight">
                Update your password
              </h2>
              <p className="text-sm text-gray-400">
                Your admin requires a new password before you can sign in.
              </p>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {view === 'login' && (
            <>
              {isOAuthFlow && (oauthRedirectUri || oauthScopes.length > 0) && (
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                  {oauthRedirectUri && (
                    <p className="mb-1">
                      Redirecting to:{' '}
                      <span className="font-medium text-gray-700">
                        {oauthRedirectUri}
                      </span>
                    </p>
                  )}
                  {oauthScopes.length > 0 && (
                    <p className="text-xs text-gray-500">
                      Requested scopes: {oauthScopes.join(', ')}
                    </p>
                  )}
                </div>
              )}
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Username</Label>{' '}
                  <Input
                    id="email"
                    placeholder="Enter your username"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={buttonLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    placeholder="Enter your password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={buttonLoading}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <a
                    href="#"
                    className="text-sm text-primary-600 hover:underline"
                    onClick={() => setView('sendCode')}
                  >
                    Forgot password
                  </a>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={buttonLoading}
                >
                  {buttonLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {'Log in'}
                </Button>
              </form>
              {isOAuthFlow && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleCancelOAuth}
                  disabled={buttonLoading}
                >
                  Cancel
                </Button>
              )}
              <Button variant="outline" className="w-full" disabled>
                <Icons.google className="h-5 w-5 mr-2" />
                Sign in with Google
              </Button>
              {IS_PUBLIC_SITE && (
                <div className="text-center text-sm text-gray-600 mt-4">
                  Don't have an account?{' '}
                  <Link
                    to={
                      loginPlan === 'individual' || loginPlan === 'teams'
                        ? `/signup?plan=${loginPlan}`
                        : '/signup'
                    }
                    className="text-primary-600 hover:underline font-medium"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </>
          )}

          {view === 'newPasswordRequired' && (
            <form onSubmit={handleNewPasswordRequired} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forced-password">New Password</Label>
                <Input
                  id="forced-password"
                  placeholder="Enter new password"
                  type="password"
                  value={forcedNewPassword}
                  onChange={(e) => setForcedNewPassword(e.target.value)}
                  required
                  disabled={buttonLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="forced-password-confirm">
                  Confirm New Password
                </Label>
                <Input
                  id="forced-password-confirm"
                  placeholder="Re-enter new password"
                  type="password"
                  value={forcedNewPasswordConfirm}
                  onChange={(e) => setForcedNewPasswordConfirm(e.target.value)}
                  required
                  disabled={buttonLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={buttonLoading}>
                {buttonLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Update Password
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setView('login');
                  setForcedNewPassword('');
                  setForcedNewPasswordConfirm('');
                }}
                disabled={buttonLoading}
              >
                Back to Login
              </Button>
            </form>
          )}

          {view === 'mfa' && (
            <form onSubmit={handleMFAVerification} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mfa-code">Verification Code</Label>
                <Input
                  id="mfa-code"
                  placeholder="000000"
                  type="text"
                  maxLength="6"
                  pattern="[0-9]{6}"
                  value={mfaCode}
                  onChange={(e) =>
                    setMfaCode(e.target.value.replace(/\D/g, ''))
                  }
                  required
                  disabled={buttonLoading}
                  className="text-center text-lg font-mono"
                  autoComplete="one-time-code"
                  autoFocus
                />
                <p className="text-xs text-gray-500 text-center">
                  {mfaType === 'TOTP'
                    ? 'Open your authenticator app to view your code'
                    : 'Check your registered device for the code'}
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={buttonLoading}>
                {buttonLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Verify
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setView('login');
                  setMfaCode('');
                  setMfaType(null);
                  setTempUser(null);
                }}
              >
                Back to Login
              </Button>
            </form>
          )}

          {view === 'mfaSelection' && (
            <div className="space-y-4">
              <Button
                onClick={() => handleMFASelection('TOTP')}
                className="w-full justify-start"
                variant="outline"
                disabled={buttonLoading}
              >
                <Smartphone className="mr-2 h-5 w-5" />
                Authenticator App
              </Button>
              <Button
                onClick={() => handleMFASelection('SMS')}
                className="w-full justify-start"
                variant="outline"
                disabled={buttonLoading}
              >
                <Icons.phone className="mr-2 h-5 w-5" />
                Text Message (SMS)
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setView('login');
                  setTempUser(null);
                }}
              >
                Cancel
              </Button>
            </div>
          )}

          {view === 'totpSetup' && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  To complete setup, you'll need to configure your authenticator
                  app. This typically involves scanning a QR code or entering a
                  secret key. Please follow the setup instructions provided by
                  your administrator.
                </AlertDescription>
              </Alert>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setView('login');
                  setTempUser(null);
                }}
              >
                Back to Login
              </Button>
            </div>
          )}

          {view === 'sendCode' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Username</Label>
                <Input
                  id="reset-email"
                  placeholder="Enter your username"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={buttonLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={buttonLoading}>
                {buttonLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send Code
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setView('login')}
              >
                Back To Login
              </Button>
            </form>
          )}

          {view === 'resetPassword' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Enter Code</Label>
                <Input
                  id="code"
                  placeholder="Enter the code"
                  type="text"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  required
                  disabled={buttonLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Password</Label>
                <Input
                  id="new-password"
                  placeholder="Enter new password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={buttonLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={buttonLoading}>
                {buttonLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Set New Password
              </Button>
            </form>
          )}
        </CardContent>
        {/* <CardFooter>
          <div className="w-full p-4 bg-primary-50 rounded-lg space-y-2">
            <h3 className="font-semibold text-primary-800">
              Get Extra Credits
            </h3>
            <p className="text-sm text-gray-700">
              You will won 3 Credits by creating an account
            </p>
            <p className="text-sm text-primary-800">
              Don&apos;t have an account?
              <Link
                to="/signup"
                className="text-md font-bold text-primary-600 hover:underline ml-1"
              >
                Sign up
              </Link>
            </p>
          </div>
        </CardFooter> */}
      </Card>
    </div>
  );
}
