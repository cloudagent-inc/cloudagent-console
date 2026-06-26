import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';
import { useState } from 'react';
import { userProfileClient } from '@/api/clients/userProfileClient';
import {
  setUserProfileLoading,
  setUserProfile,
} from '../features/auth/authSlice';
import { useDispatch, useStore } from 'react-redux';
import {
  refreshExecutiveSummariesOnLogin,
} from '../features/operations/operationsSlice';
import { analytics } from './useAnalytics';
import { resolveUserSettings, shouldRefreshExecutiveSummariesOnLogin } from '@/lib/userSettings';

export const useAuth = () => {
  const dispatch = useDispatch();
  const store = useStore();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkAuthStatus = async () => {
    try {
      dispatch(setUserProfileLoading(true));

      const { username, userId, signInDetails } = await getCurrentUser();
      const session = await fetchAuthSession();

      if (session.tokens) {
        const baseUser = {
          username,
          userId,
          signInDetails,
          isSignedIn: true,
        };

        setUser(baseUser);

        try {
          const hasTeams = false;
          const userData = await userProfileClient.getCurrentProfile({ hasTeams });

          const fullUser = {
            ...baseUser,
            ...userData,
            settings: resolveUserSettings(userData?.settings),
          };

          setUser(fullUser);

          dispatch(setUserProfile(fullUser));
          dispatch(setUserProfileLoading(false));

          // Identify user for analytics tracking
          analytics.identify(fullUser);

          if (shouldRefreshExecutiveSummariesOnLogin(fullUser.settings)) {
            dispatch(refreshExecutiveSummariesOnLogin()).catch((error) => {
              console.error('[useAuth] Error refreshing executive summaries on login:', error);
            });
          }

          return fullUser;
        } catch (graphqlError) {
          dispatch(setUserProfileLoading(false));
          console.log('GraphQL query failed:', graphqlError);

          dispatch(setUserProfile(baseUser));
          return baseUser;
        }
      } else {
        setUser(null);
        dispatch(setUserProfile(null));
        dispatch(setUserProfileLoading(false));
        return null;
      }
    } catch (err) {
      console.log('Auth check failed:', err);
      setError(err instanceof Error ? err : new Error('Authentication failed'));
      setUser(null);
      dispatch(setUserProfile(null));
      dispatch(setUserProfileLoading(false));
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { user, loading, error, checkAuthStatus };
};
