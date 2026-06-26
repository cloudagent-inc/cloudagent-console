import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { generateClient } from 'aws-amplify/api';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, PlusCircle, RefreshCw, Settings2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Icons } from '@/components/icons';
import {
  exchangeJiraOAuth,
  listJiraIssueTypes,
  listJiraProjects,
  refreshJiraOAuthToken,
  startJiraOAuth,
} from '@/api/integrations/jira';
import {
  exchangeGithubInstallation,
  listGithubRepositories,
  refreshGithubInstallationToken,
  startGithubInstallation,
} from '@/api/integrations/github';
import {
  createAgentPermissionProfileMutation,
  updateAgentPermissionProfileMutation,
  deleteAgentPermissionProfileMutation,
} from '@/api/eventQueries';
import {
  addProfileToState,
  updateSingleProfileInState,
  removeProfileFromState,
} from '@/features/auth/authSlice';

const client = generateClient();

const IntegrationsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { userProfile, userProfileLoading } = useSelector((state) => state.auth);
  const [connectOpen, setConnectOpen] = useState(false);
  const [oauthSession, setOauthSession] = useState({
    loading: false,
    resources: [],
    tokens: null,
    selectedCloudId: '',
    siteUrl: '',
    displayName: '',
  });
  const [oauthCompleteOpen, setOauthCompleteOpen] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const [defaultsSubmitting, setDefaultsSubmitting] = useState(false);
  const [testingConnectionId, setTestingConnectionId] = useState(null);
  const [jiraReconnectNotice, setJiraReconnectNotice] = useState(null);
  const [jiraRefreshingConnectionId, setJiraRefreshingConnectionId] = useState(null);
  const [defaultsForm, setDefaultsForm] = useState({
    connectionId: '',
    projectKey: '',
    issueTypeId: '',
  });
  const [projects, setProjects] = useState([]);
  const [issueTypes, setIssueTypes] = useState([]);
  const [defaultsLoading, setDefaultsLoading] = useState(false);
  const [githubConnectOpen, setGithubConnectOpen] = useState(false);
  const [githubOauthSession, setGithubOauthSession] = useState({
    loading: false,
    installationId: null,
    accountId: null,
    accountLogin: '',
    accountType: '',
    accountAvatarUrl: '',
    displayName: '',
    permissions: null,
  });
  const [githubCompleteOpen, setGithubCompleteOpen] = useState(false);
  const [githubSubmitting, setGithubSubmitting] = useState(false);
  const [githubReposOpen, setGithubReposOpen] = useState(false);
  const [githubReposLoading, setGithubReposLoading] = useState(false);
  const [githubReposSaving, setGithubReposSaving] = useState(false);
  const [githubRepos, setGithubRepos] = useState([]);
  const [githubRepoSelections, setGithubRepoSelections] = useState({});
  const [githubConfigureConnectionId, setGithubConfigureConnectionId] = useState('');
  const [githubRepoFilter, setGithubRepoFilter] = useState('');
  const [githubTestingConnectionId, setGithubTestingConnectionId] = useState(null);
  const [githubRefreshingConnectionId, setGithubRefreshingConnectionId] = useState(null);

  const parseAuthProfile = (value) => {
    if (!value) return {};
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) || {};
      } catch (_) {
        return {};
      }
    }
    if (typeof value === 'object') return value;
    return {};
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const installationId = searchParams.get('installation_id');
    if (!state) {
      return;
    }

    let isMounted = true;
    const finishJiraOAuth = async () => {
      setOauthSession((prev) => ({ ...prev, loading: true }));
      try {
        const redirectUri = `${window.location.origin}${location.pathname}`;
        const data = await exchangeJiraOAuth({ code, state, redirectUri });
        if (!isMounted) return;
        const resources = (data?.resources || []).map((resource) => ({
          ...resource,
          cloudId: resource?.cloudId || resource?.id || '',
        }));
        const first = resources[0] || {};
        setOauthSession({
          loading: false,
          resources,
          tokens: data?.tokens || null,
          selectedCloudId: first.cloudId || '',
          siteUrl: first.url || '',
          displayName: first.name || first.url || '',
        });
        setOauthCompleteOpen(true);
      } catch (error) {
        console.error('[Integrations] OAuth exchange failed:', error);
        toast.error(error?.message || 'Jira authorization failed.');
        setOauthSession({
          loading: false,
          oauthSessionId: '',
          resources: [],
          selectedCloudId: '',
          siteUrl: '',
          displayName: '',
        });
      } finally {
        navigate(location.pathname, { replace: true });
      }
    };

    const finishGithubInstall = async () => {
      setGithubOauthSession((prev) => ({ ...prev, loading: true }));
      try {
        const data = await exchangeGithubInstallation({
          installationId,
          state,
        });
        if (!isMounted) return;
        setGithubOauthSession({
          loading: false,
          installationId: data?.installationId || null,
          accountId: data?.account?.id || null,
          accountLogin: data?.account?.login || '',
          accountType: data?.account?.type || '',
          accountAvatarUrl: data?.account?.avatarUrl || '',
          displayName: data?.account?.login || 'GitHub',
          permissions: data?.permissions || null,
        });
        setGithubCompleteOpen(true);
      } catch (error) {
        console.error('[Integrations] GitHub install exchange failed:', error);
        toast.error(error?.message || 'GitHub authorization failed.');
        setGithubOauthSession({
          loading: false,
          installationId: null,
          accountId: null,
          accountLogin: '',
          accountType: '',
          accountAvatarUrl: '',
          displayName: '',
          permissions: null,
        });
      } finally {
        navigate(location.pathname, { replace: true });
      }
    };

    if (code) {
      finishJiraOAuth();
      return () => {
        isMounted = false;
      };
    }

    if (installationId) {
      finishGithubInstall();
    }
    return () => {
      isMounted = false;
    };
  }, [location.pathname, location.search, navigate]);

  const jiraConnections = useMemo(() => {
    const profiles = userProfile?.agentPermissionProfiles || [];
    return profiles
      .filter((profile) => profile?.type === 'jira')
      .map((profile) => {
        const authProfile = parseAuthProfile(profile.authProfile);
        return {
          ...profile,
          id: profile.recordId,
          authProfile,
          authType: authProfile.authType || null,
          siteUrl: authProfile.siteUrl || null,
          cloudId: authProfile.cloudId || null,
          accountEmail: authProfile.accountEmail || null,
          accountId: authProfile.accountId || null,
          defaultProjectKey: authProfile.defaultProjectKey || null,
          defaultIssueTypeId: authProfile.defaultIssueTypeId || null,
          defaultIssueTypeName: authProfile.defaultIssueTypeName || null,
          displayName:
            profile.name || authProfile.displayName || profile.description || 'Jira Cloud',
        };
      });
  }, [userProfile]);

  const hasConnections = jiraConnections.length > 0;

  const githubConnections = useMemo(() => {
    const profiles = userProfile?.agentPermissionProfiles || [];
    return profiles
      .filter((profile) => profile?.type === 'github')
      .map((profile) => {
        const authProfile = parseAuthProfile(profile.authProfile);
        const repositories = Array.isArray(authProfile.repositories)
          ? authProfile.repositories
          : [];
        return {
          ...profile,
          id: profile.recordId,
          authProfile,
          installationId: authProfile.installationId || null,
          account: authProfile.account || null,
          repositories,
          repoCount: repositories.length,
          displayName:
            profile.name ||
            authProfile.account?.login ||
            profile.description ||
            'GitHub',
        };
      });
  }, [userProfile]);

  const hasGithubConnections = githubConnections.length > 0;

  const filteredGithubRepos = useMemo(() => {
    const query = githubRepoFilter.trim().toLowerCase();
    if (!query) return githubRepos;
    return (githubRepos || []).filter((repo) => {
      const name = String(repo?.name || '').toLowerCase();
      const fullName = String(repo?.fullName || '').toLowerCase();
      return name.includes(query) || fullName.includes(query);
    });
  }, [githubRepos, githubRepoFilter]);

  const handleStartOAuth = async () => {
    try {
      const redirectUri = `${window.location.origin}${location.pathname}`;
      const data = await startJiraOAuth({ redirectUri });
      if (!data?.authUrl) {
        throw new Error('Missing Jira authorization URL.');
      }
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('[Integrations] OAuth start failed:', error);
      toast.error(error?.message || 'Failed to start Jira authorization.');
    }
  };

  const handleStartGithubInstall = async () => {
    try {
      const redirectUri = `${window.location.origin}${location.pathname}`;
      const data = await startGithubInstallation({ redirectUri });
      if (!data?.authUrl) {
        throw new Error('Missing GitHub installation URL.');
      }
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('[Integrations] GitHub install start failed:', error);
      toast.error(error?.message || 'Failed to start GitHub installation.');
    }
  };

  const buildGithubSelections = (repositories) => {
    const selections = {};
    (repositories || []).forEach((repo) => {
      const key = String(repo?.id || repo?.fullName || '');
      if (!key) return;
      const allowedBranches = Array.isArray(repo?.allowedBranches)
        ? repo.allowedBranches
        : [];
      selections[key] = {
        id: repo?.id || null,
        name: repo?.name || null,
        fullName: repo?.fullName || null,
        owner: repo?.owner || (repo?.fullName ? repo.fullName.split('/')[0] : null),
        defaultBranch: repo?.defaultBranch || null,
        access: repo?.access || 'read',
        allowedBranchesText: allowedBranches.join(', '),
        cloudAgentBranchesOnly: Boolean(repo?.cloudAgentBranchesOnly),
        isPrivate: Boolean(repo?.isPrivate),
      };
    });
    return selections;
  };

  const updateGithubSelection = (repoId, patch) => {
    setGithubRepoSelections((prev) => {
      if (!repoId) return prev;
      const key = String(repoId);
      const current = prev[key];
      if (!current) return prev;
      return {
        ...prev,
        [key]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const toggleGithubRepoSelection = (repo, checked) => {
    const key = String(repo?.id || '');
    if (!key) return;
    setGithubRepoSelections((prev) => {
      const next = { ...prev };
      const isSelected = Boolean(next[key]);
      const shouldSelect = typeof checked === 'boolean' ? checked : !isSelected;
      if (!shouldSelect) {
        delete next[key];
        return next;
      }
      if (isSelected) {
        return prev;
      }
      next[key] = {
        id: repo?.id || null,
        name: repo?.name || null,
        fullName: repo?.fullName || null,
        owner: repo?.owner || null,
        defaultBranch: repo?.defaultBranch || null,
        access: 'read',
        allowedBranchesText: '',
        cloudAgentBranchesOnly: false,
        isPrivate: Boolean(repo?.isPrivate),
      };
      return next;
    });
  };

  const openGithubReposModal = async (connection) => {
    if (!connection?.id) return;
    setGithubConfigureConnectionId(connection.id);
    setGithubReposOpen(true);
    setGithubRepoFilter('');
    setGithubRepoSelections(buildGithubSelections(connection.repositories));
    setGithubReposLoading(true);
    try {
      const data = await listGithubRepositories(connection.id);
      setGithubRepos(data?.repositories || []);
    } catch (error) {
      console.error('[Integrations] Failed to load GitHub repos:', error);
      toast.error(error?.message || 'Failed to load GitHub repositories.');
    } finally {
      setGithubReposLoading(false);
    }
  };

  const handleGithubConnect = async () => {
    if (!githubOauthSession.installationId) {
      toast.error('Missing GitHub installation.');
      return;
    }
    setGithubSubmitting(true);
    try {
      const existing = githubConnections.find(
        (connection) =>
          connection?.installationId === githubOauthSession.installationId
      );
      const existingAuthProfile = existing?.authProfile || {};
      const authProfile = {
        ...existingAuthProfile,
        authType: 'github_app',
        installationId: githubOauthSession.installationId,
        account: {
          id: githubOauthSession.accountId,
          login: githubOauthSession.accountLogin || null,
          type: githubOauthSession.accountType || null,
          avatarUrl: githubOauthSession.accountAvatarUrl || null,
        },
        permissions: githubOauthSession.permissions || null,
      };

      let response;
      if (existing?.id) {
        response = await client.graphql({
          query: updateAgentPermissionProfileMutation,
          variables: {
            recordId: existing.id,
            name:
              githubOauthSession.displayName ||
              existing?.name ||
              existing?.displayName ||
              'GitHub',
            type: existing?.type || 'github',
            description:
              existing?.description || githubOauthSession.accountLogin || '',
            authProfile: JSON.stringify(authProfile),
          },
        });
      } else {
        response = await client.graphql({
          query: createAgentPermissionProfileMutation,
          variables: {
            name: githubOauthSession.displayName || 'GitHub',
            type: 'github',
            description: githubOauthSession.accountLogin || '',
            authProfile: JSON.stringify(authProfile),
          },
        });
      }

      const connection =
        response?.data?.updateAgentPermissionProfile ||
        response?.data?.createAgentPermissionProfile ||
        null;
      if (!connection) {
        throw new Error('Failed to save GitHub connection.');
      }

      if (existing?.id) {
        dispatch(updateSingleProfileInState(connection));
      } else {
        dispatch(addProfileToState(connection));
      }

      setGithubCompleteOpen(false);
      await openGithubReposModal({
        ...connection,
        id: connection.recordId,
        authProfile,
        repositories: authProfile.repositories || [],
      });
    } catch (error) {
      console.error('[Integrations] GitHub connect failed:', error);
      toast.error(error?.message || 'Failed to save GitHub connection.');
    } finally {
      setGithubSubmitting(false);
    }
  };

  const handleGithubSaveRepos = async () => {
    if (!githubConfigureConnectionId) {
      toast.error('Missing GitHub connection.');
      return;
    }
    setGithubReposSaving(true);
    try {
      const targetConnection = githubConnections.find(
        (connection) => connection.id === githubConfigureConnectionId
      );
      if (!targetConnection) {
        throw new Error('GitHub connection not found.');
      }
      const currentAuthProfile = targetConnection?.authProfile || {};
      const selections = Object.values(githubRepoSelections || {}).map((item) => {
        const allowedBranches = String(item.allowedBranchesText || '')
          .split(',')
          .map((branch) => branch.trim())
          .filter(Boolean);
        return {
          id: item?.id || null,
          name: item?.name || null,
          fullName: item?.fullName || null,
          owner: item?.owner || null,
          defaultBranch: item?.defaultBranch || null,
          access: item?.access || 'read',
          allowedBranches: item?.cloudAgentBranchesOnly ? [] : allowedBranches,
          cloudAgentBranchesOnly: Boolean(item?.cloudAgentBranchesOnly),
          isPrivate: Boolean(item?.isPrivate),
        };
      });

      const nextAuthProfile = {
        ...currentAuthProfile,
        repositories: selections,
      };

      const response = await client.graphql({
        query: updateAgentPermissionProfileMutation,
        variables: {
          recordId: githubConfigureConnectionId,
          name:
            targetConnection?.name ||
            targetConnection?.displayName ||
            'GitHub',
          type: targetConnection?.type || 'github',
          description:
            targetConnection?.description ||
            targetConnection?.account?.login ||
            '',
          authProfile: JSON.stringify(nextAuthProfile),
        },
      });

      const updatedProfile =
        response?.data?.updateAgentPermissionProfile || null;
      if (updatedProfile) {
        dispatch(updateSingleProfileInState(updatedProfile));
      }
      toast.success('GitHub repositories saved.');
      setGithubReposOpen(false);
    } catch (error) {
      console.error('[Integrations] Failed to save GitHub repos:', error);
      toast.error(error?.message || 'Failed to save GitHub repositories.');
    } finally {
      setGithubReposSaving(false);
    }
  };

  const handleGithubDisconnect = async (connectionId) => {
    if (!connectionId) return;
    const confirmed = window.confirm('Disconnect this GitHub connection?');
    if (!confirmed) return;
    try {
      await client.graphql({
        query: deleteAgentPermissionProfileMutation,
        variables: { recordId: connectionId },
      });
      dispatch(removeProfileFromState(connectionId));
      toast.success('GitHub connection removed.');
    } catch (error) {
      console.error('[Integrations] Failed to disconnect GitHub:', error);
      toast.error(error?.message || 'Failed to disconnect GitHub.');
    }
  };

  const handleGithubTestConnection = async (connectionId) => {
    if (!connectionId) return;
    setGithubTestingConnectionId(connectionId);
    try {
      const data = await listGithubRepositories(connectionId);
      const count = data?.repositories?.length || 0;
      toast.success(
        count
          ? `GitHub connection verified (${count} repos).`
          : 'GitHub connection verified.'
      );
    } catch (error) {
      console.error('[Integrations] GitHub test connection failed:', error);
      toast.error(error?.message || 'Failed to verify GitHub connection.');
    } finally {
      setGithubTestingConnectionId(null);
    }
  };

  const handleGithubRefreshConnection = async (connectionId) => {
    if (!connectionId) {
      toast.error('Missing GitHub connection.');
      return;
    }
    setGithubRefreshingConnectionId(connectionId);
    try {
      const result = await refreshGithubInstallationToken(connectionId);
      const expiresAt = result?.expiresAt ? ` (expires ${result.expiresAt})` : '';
      toast.success(`GitHub access refreshed${expiresAt}`);
    } catch (error) {
      console.error('[Integrations] GitHub refresh failed:', error);
      toast.error(error?.message || 'Failed to refresh GitHub access.');
    } finally {
      setGithubRefreshingConnectionId(null);
    }
  };

  const handleJiraRefreshConnection = async (connectionId) => {
    if (!connectionId) {
      toast.error('Missing Jira connection.');
      return;
    }
    setJiraRefreshingConnectionId(connectionId);
    try {
      const result = await refreshJiraOAuthToken(connectionId);
      const expiresAt = result?.expiresAt ? ` (expires ${result.expiresAt})` : '';
      toast.success(`Jira access refreshed${expiresAt}`);
    } catch (error) {
      console.error('[Integrations] Jira refresh failed:', error);
      toast.error(error?.message || 'Failed to refresh Jira access.');
    } finally {
      setJiraRefreshingConnectionId(null);
    }
  };


  const handleOAuthResourceChange = (cloudId) => {
    const selected = oauthSession.resources.find((item) => item.cloudId === cloudId);
    setOauthSession((prev) => ({
      ...prev,
      selectedCloudId: cloudId,
      siteUrl: selected?.url || '',
      displayName: selected?.name || '',
    }));
  };

  const handleOAuthConnect = async () => {
    if (!oauthSession.selectedCloudId || !oauthSession.tokens) {
      toast.error('Select a Jira site to continue.');
      return;
    }

    setOauthSubmitting(true);
    try {
      const selected = oauthSession.resources.find(
        (item) => item.cloudId === oauthSession.selectedCloudId
      );
      const authProfile = {
        authType: 'oauth',
        siteUrl: selected?.url || '',
        cloudId: selected?.cloudId || '',
        auth: {
          accessToken: oauthSession.tokens?.accessToken || null,
          refreshToken: oauthSession.tokens?.refreshToken || null,
          expiresAt: oauthSession.tokens?.expiresAt || null,
        },
        defaultProjectKey: null,
        defaultIssueTypeId: null,
      };
      const response = await client.graphql({
        query: createAgentPermissionProfileMutation,
        variables: {
          name: oauthSession.displayName || selected?.name || selected?.url,
          type: 'jira',
          description: selected?.url || '',
          authProfile: JSON.stringify(authProfile),
        },
      });
      const connection = response?.data?.createAgentPermissionProfile || null;
      if (!connection) {
        throw new Error('Failed to create Jira connection.');
      }
      dispatch(addProfileToState(connection));
      setOauthCompleteOpen(false);
      openDefaultsModal({
        ...connection,
        id: connection.recordId,
        authProfile,
        defaultProjectKey: authProfile.defaultProjectKey,
        defaultIssueTypeId: authProfile.defaultIssueTypeId,
      });
    } catch (error) {
      console.error('[Integrations] OAuth connect failed:', error);
      toast.error(error?.message || 'Failed to save Jira connection.');
    } finally {
      setOauthSubmitting(false);
    }
  };

  const openDefaultsModal = async (connection) => {
    if (!connection?.id) return;
    setDefaultsForm({
      connectionId: connection.id,
      projectKey: connection.defaultProjectKey || '',
      issueTypeId: connection.defaultIssueTypeId || '',
    });
    setProjects([]);
    setIssueTypes([]);
    setDefaultsOpen(true);
    await loadProjects(connection.id, connection.defaultProjectKey, connection.defaultIssueTypeId);
  };

  const loadProjects = async (connectionId, preferredProjectKey, preferredIssueTypeId) => {
    setDefaultsLoading(true);
    try {
      const data = await listJiraProjects(connectionId);
      const projectList = data?.projects || [];
      setProjects(projectList);
      const nextProjectKey =
        preferredProjectKey || projectList[0]?.key || '';
      if (nextProjectKey) {
        setDefaultsForm((prev) => ({
          ...prev,
          projectKey: prev.projectKey || nextProjectKey,
        }));
        await loadIssueTypes(connectionId, nextProjectKey, preferredIssueTypeId);
      }
    } catch (error) {
      console.error('[Integrations] Failed to load Jira projects:', error);
      toast.error(error?.message || 'Failed to load Jira projects.');
    } finally {
      setDefaultsLoading(false);
    }
  };

  const loadIssueTypes = async (connectionId, projectKey, preferredIssueTypeId) => {
    if (!connectionId || !projectKey) {
      setIssueTypes([]);
      return;
    }
    setDefaultsLoading(true);
    try {
      const data = await listJiraIssueTypes(connectionId, projectKey);
      const issueTypeList = data?.issueTypes || [];
      setIssueTypes(issueTypeList);
      const nextIssueTypeId =
        preferredIssueTypeId || issueTypeList[0]?.id || '';
      if (nextIssueTypeId) {
        setDefaultsForm((prev) => ({
          ...prev,
          issueTypeId: prev.issueTypeId || nextIssueTypeId,
        }));
      }
    } catch (error) {
      console.error('[Integrations] Failed to load Jira issue types:', error);
      toast.error(error?.message || 'Failed to load Jira issue types.');
    } finally {
      setDefaultsLoading(false);
    }
  };

  const handleDefaultsSave = async () => {
    if (!defaultsForm.connectionId) {
      toast.error('Missing connection.');
      return;
    }
    if (!defaultsForm.projectKey || !defaultsForm.issueTypeId) {
      toast.error('Select a Jira project and issue type.');
      return;
    }
    setDefaultsSubmitting(true);
    try {
      const targetConnection = jiraConnections.find(
        (connection) => connection.id === defaultsForm.connectionId
      );
      const currentAuthProfile = targetConnection?.authProfile || {};
      const selectedIssueType = issueTypes.find(
        (issueType) => issueType.id === defaultsForm.issueTypeId
      );
      const nextAuthProfile = {
        ...currentAuthProfile,
        defaultProjectKey: defaultsForm.projectKey,
        defaultIssueTypeId: defaultsForm.issueTypeId,
        defaultIssueTypeName:
          selectedIssueType?.name ||
          currentAuthProfile.defaultIssueTypeName ||
          null,
      };
      const response = await client.graphql({
        query: updateAgentPermissionProfileMutation,
        variables: {
          recordId: defaultsForm.connectionId,
          name:
            targetConnection?.name ||
            targetConnection?.displayName ||
            'Jira Cloud',
          type: targetConnection?.type || 'jira',
          description:
            targetConnection?.description ||
            targetConnection?.siteUrl ||
            '',
          authProfile: JSON.stringify(nextAuthProfile),
        },
      });
      const updatedProfile = response?.data?.updateAgentPermissionProfile || null;
      if (updatedProfile) {
        dispatch(updateSingleProfileInState(updatedProfile));
      }
      toast.success('Jira defaults saved.');
      setDefaultsOpen(false);
    } catch (error) {
      console.error('[Integrations] Failed to save defaults:', error);
      toast.error(error?.message || 'Failed to save Jira defaults.');
    } finally {
      setDefaultsSubmitting(false);
    }
  };

  const handleDisconnect = async (connectionId) => {
    if (!connectionId) return;
    const confirmed = window.confirm('Disconnect this Jira connection?');
    if (!confirmed) return;
    try {
      await client.graphql({
        query: deleteAgentPermissionProfileMutation,
        variables: { recordId: connectionId },
      });
      dispatch(removeProfileFromState(connectionId));
      toast.success('Jira connection removed.');
    } catch (error) {
      console.error('[Integrations] Failed to disconnect Jira:', error);
      toast.error(error?.message || 'Failed to disconnect Jira.');
    }
  };

  const handleTestConnection = async (connectionId) => {
    if (!connectionId) return;
    setTestingConnectionId(connectionId);
    setJiraReconnectNotice(null);
    try {
      const data = await listJiraProjects(connectionId);
      const count = data?.projects?.length || 0;
      toast.success(
        count
          ? `Jira connection verified (${count} projects).`
          : 'Jira connection verified.'
      );
      setJiraReconnectNotice(null);
    } catch (error) {
      console.error('[Integrations] Jira test connection failed:', error);
      const message = parseJiraErrorMessage(
        error,
        'Failed to verify Jira connection.'
      );
      if (isJiraReconnectError(message)) {
        setJiraReconnectNotice({
          message,
          connectionId,
        });
      }
      toast.error(message);
    } finally {
      setTestingConnectionId(null);
    }
  };

  const parseJiraErrorMessage = (error, fallback) => {
    if (!error?.message) return fallback;
    if (typeof error.message === 'string') {
      try {
        const parsed = JSON.parse(error.message);
        return parsed?.message || parsed?.error || error.message;
      } catch {
        return error.message;
      }
    }
    return String(error.message || fallback);
  };

  const isJiraReconnectError = (message) => {
    const normalized = String(message || '').toLowerCase();
    return (
      normalized.includes('reconnect') ||
      normalized.includes('base url is not configured') ||
      normalized.includes('refresh token') ||
      normalized.includes('token expired') ||
      normalized.includes('unauthorized')
    );
  };

  const jiraAuthDescription = useMemo(
    () => (
      <ul className="list-disc pl-4 text-sm text-gray-600 space-y-1">
        <li>Requires permission to create issues in the target Jira project.</li>
        <li>We will ask you to pick a default project and issue type.</li>
        <li>Connections can be updated or removed at any time.</li>
      </ul>
    ),
    []
  );

  const githubAuthDescription = useMemo(
    () => (
      <ul className="list-disc pl-4 text-sm text-gray-600 space-y-1">
        <li>Installs the CloudAgent GitHub App for your account or org.</li>
        <li>Select which repositories CloudAgent can access.</li>
        <li>Configure branch limits and PR-only vs full push access.</li>
      </ul>
    ),
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Integrations</h1>
          <p className="text-sm text-gray-600">
            Connect external tools to send CloudAgent recommendations where your team works.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available integrations</CardTitle>
          <CardDescription>
            GitHub and Jira Cloud are ready to connect. Slack and ServiceNow are coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex h-full flex-col justify-between rounded-xl border border-gray-200 bg-white p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
                    <Icons.gitHub className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">GitHub</p>
                    <p className="text-xs text-gray-500">GitHub App</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  Connect repositories to let CloudAgent open PRs or push changes.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Badge variant="secondary">
                  {hasGithubConnections ? 'Connected' : 'Enabled'}
                </Badge>
                <Button size="sm" onClick={() => setGithubConnectOpen(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Connect
                </Button>
              </div>
            </div>

            <div className="flex h-full flex-col justify-between rounded-xl border border-gray-200 bg-white p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
                    <Icons.jiraIcon className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Jira Cloud</p>
                    <p className="text-xs text-gray-500">OAuth only</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  Send recommendations as Jira issues with your default project and issue type.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Badge variant="secondary">Enabled</Badge>
                <Button size="sm" onClick={() => setConnectOpen(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Connect
                </Button>
              </div>
            </div>

            <div className="flex h-full flex-col justify-between rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-400">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
                    <Icons.slackIcon className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Slack</p>
                    <p className="text-xs">Coming soon</p>
                  </div>
                </div>
                <p className="text-sm">
                  Route recommendations to channels or direct messages.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Badge variant="outline">Coming soon</Badge>
                <Button size="sm" variant="outline" disabled>
                  Connect
                </Button>
              </div>
            </div>

            <div className="flex h-full flex-col justify-between rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-400">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
                    <Icons.serviceNowIcon className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">ServiceNow</p>
                    <p className="text-xs">Coming soon</p>
                  </div>
                </div>
                <p className="text-sm">
                  Create incidents and tasks directly from recommendations.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Badge variant="outline">Coming soon</Badge>
                <Button size="sm" variant="outline" disabled>
                  Connect
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Connected GitHub installations
          </h2>
          {userProfileLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          )}
        </div>

        {!userProfileLoading && !hasGithubConnections && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-gray-500">
              No GitHub connections yet. Connect GitHub to start managing repositories.
            </CardContent>
          </Card>
        )}

        {hasGithubConnections && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Connection</TableHead>
                    <TableHead>Repositories</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {githubConnections.map((connection) => {
                    const repoCount = connection.repoCount || 0;
                    const accessLevels = new Set(
                      (connection.repositories || [])
                        .map((repo) => repo?.access || 'read')
                        .filter(Boolean)
                    );
                    const accessLabel =
                      accessLevels.size === 0
                        ? 'Not set'
                        : accessLevels.size === 1
                        ? Array.from(accessLevels)[0] === 'write'
                          ? 'Full push'
                          : Array.from(accessLevels)[0] === 'pr'
                          ? 'PR only'
                          : 'Read only'
                        : 'Mixed';
                    return (
                      <TableRow key={connection.id}>
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-900">
                              {connection.displayName || 'GitHub'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {connection.account?.login
                                ? `@${connection.account.login}`
                                : 'GitHub App'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-1 text-sm text-gray-600">
                            <p className={repoCount ? '' : 'text-red-600'}>
                              {repoCount
                                ? `${repoCount} repo${repoCount === 1 ? '' : 's'} selected`
                                : 'No repositories selected'}
                            </p>
                            {!repoCount && (
                              <Badge variant="destructive">Selection required</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge
                            variant={accessLabel === 'Not set' ? 'destructive' : 'secondary'}
                            className="capitalize"
                          >
                            {accessLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openGithubReposModal(connection)}
                            >
                              <Settings2 className="mr-2 h-4 w-4" />
                              Configure repos
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleGithubTestConnection(connection.id)}
                              disabled={githubTestingConnectionId === connection.id}
                            >
                              {githubTestingConnectionId === connection.id && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Test connection
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleGithubRefreshConnection(connection.id)}
                              disabled={githubRefreshingConnectionId === connection.id}
                            >
                              {githubRefreshingConnectionId === connection.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="mr-2 h-4 w-4" />
                              )}
                              Renew access
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleGithubDisconnect(connection.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Disconnect
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Connected Jira sites</h2>
          {userProfileLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          )}
        </div>

        {!userProfileLoading && !hasConnections && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-gray-500">
              No Jira connections yet. Connect Jira to start sending recommendations.
            </CardContent>
          </Card>
        )}

        {jiraReconnectNotice && (
          <Alert variant="destructive">
            <AlertTitle>Reconnect Jira</AlertTitle>
            <AlertDescription className="mt-2 flex flex-col gap-3">
              <span>{jiraReconnectNotice.message}</span>
              <span>
                Reconnect to refresh access, then disconnect the old connection if needed.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConnectOpen(true)}
                className="w-fit"
              >
                Reconnect Jira
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {hasConnections && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Connection</TableHead>
                    <TableHead>Defaults</TableHead>
                    <TableHead>Auth</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jiraConnections.map((connection) => {
                    const defaultsReady =
                      connection.defaultProjectKey &&
                      connection.defaultIssueTypeId;
                    return (
                      <TableRow key={connection.id}>
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-900">
                              {connection.displayName ||
                                connection.siteUrl ||
                                'Jira Cloud'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {connection.siteUrl || 'Jira Cloud'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-1 text-sm text-gray-600">
                            <p className={connection.defaultProjectKey ? '' : 'text-red-600'}>
                              {connection.defaultProjectKey || 'Project not set'}
                            </p>
                            <p className={connection.defaultIssueTypeId ? '' : 'text-red-600'}>
                              {connection.defaultIssueTypeName ||
                                connection.defaultIssueTypeId ||
                                'Issue type not set'}
                            </p>
                            {!defaultsReady && (
                              <Badge variant="destructive">Defaults required</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="secondary" className="capitalize">
                            {connection.authType === 'token' ? 'API Token' : 'OAuth'}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDefaultsModal(connection)}
                            >
                              <Settings2 className="mr-2 h-4 w-4" />
                              Edit defaults
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTestConnection(connection.id)}
                              disabled={testingConnectionId === connection.id}
                            >
                              {testingConnectionId === connection.id && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Test connection
                            </Button>
                            {connection.authType === 'oauth' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleJiraRefreshConnection(connection.id)}
                                disabled={jiraRefreshingConnectionId === connection.id}
                              >
                                {jiraRefreshingConnectionId === connection.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                )}
                                Renew access
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDisconnect(connection.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Disconnect
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={githubConnectOpen} onOpenChange={setGithubConnectOpen}>
        <DialogContent className="bg-white max-w-xl">
          <DialogHeader>
            <DialogTitle>Connect GitHub</DialogTitle>
            <DialogDescription>
              Authorize CloudAgent by installing the GitHub App.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  You will be redirected to GitHub to install the CloudAgent App.
                  After approval, we will ask you to select repositories and access.
                </p>
                {githubAuthDescription}
              </div>
              <Button onClick={handleStartGithubInstall}>Continue to GitHub</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={githubCompleteOpen} onOpenChange={setGithubCompleteOpen}>
        <DialogContent className="bg-white max-w-xl">
          <DialogHeader>
            <DialogTitle>Finish GitHub connection</DialogTitle>
            <DialogDescription>
              Confirm the installation and name this connection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {githubOauthSession.loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading GitHub installation...
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="github-display-name">Connection name</Label>
                  <Input
                    id="github-display-name"
                    value={githubOauthSession.displayName}
                    onChange={(event) =>
                      setGithubOauthSession((prev) => ({
                        ...prev,
                        displayName: event.target.value,
                      }))
                    }
                  />
                </div>
                {githubOauthSession.accountLogin && (
                  <p className="text-xs text-gray-500">
                    Connected account: @{githubOauthSession.accountLogin}
                  </p>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGithubCompleteOpen(false)}
              disabled={githubSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleGithubConnect} disabled={githubSubmitting}>
              {githubSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={githubReposOpen} onOpenChange={setGithubReposOpen}>
        <DialogContent className="bg-white max-w-4xl">
          <DialogHeader>
            <DialogTitle>Configure GitHub repositories</DialogTitle>
            <DialogDescription>
              Select repositories and set access and branch policies.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Filter repositories"
              value={githubRepoFilter}
              onChange={(event) => setGithubRepoFilter(event.target.value)}
            />
            <div className="rounded-lg border border-gray-200">
              {githubReposLoading ? (
                <div className="flex items-center gap-2 p-4 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading GitHub repositories...
                </div>
              ) : filteredGithubRepos.length ? (
                <div className="max-h-[420px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Repository</TableHead>
                        <TableHead>Access</TableHead>
                        <TableHead>Branch policy</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredGithubRepos.map((repo) => {
                        const key = String(repo?.id || '');
                        const selection = githubRepoSelections[key];
                        const isSelected = Boolean(selection);
                        return (
                          <TableRow key={repo.id}>
                            <TableCell className="align-top">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) =>
                                  toggleGithubRepoSelection(repo, checked)
                                }
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {repo.fullName || repo.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Default: {repo.defaultBranch || 'unknown'}
                                  {repo.isPrivate ? ' - Private' : ' - Public'}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="align-top">
                              <Select
                                value={selection?.access || 'read'}
                                onValueChange={(value) =>
                                  updateGithubSelection(key, { access: value })
                                }
                                disabled={!isSelected}
                              >
                                <SelectTrigger disabled={!isSelected}>
                                  <SelectValue placeholder="Select access" />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                  <SelectItem value="read">Read only</SelectItem>
                                  <SelectItem value="pr">PR only</SelectItem>
                                  <SelectItem value="write">Full push</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={Boolean(
                                      selection?.cloudAgentBranchesOnly
                                    )}
                                    onCheckedChange={(checked) =>
                                      updateGithubSelection(key, {
                                        cloudAgentBranchesOnly: checked,
                                      })
                                    }
                                    className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-200"
                                    disabled={!isSelected}
                                  />
                                  <span className="text-xs text-gray-600">
                                    CloudAgent-only branches
                                  </span>
                                </div>
                                <Input
                                  placeholder="Allowed branches (comma-separated)"
                                  value={selection?.allowedBranchesText || ''}
                                  onChange={(event) =>
                                    updateGithubSelection(key, {
                                      allowedBranchesText: event.target.value,
                                    })
                                  }
                                  disabled={
                                    !isSelected ||
                                    Boolean(selection?.cloudAgentBranchesOnly)
                                  }
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-4 text-sm text-gray-500">
                  No repositories found for this installation.
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Tip: For CloudAgent-only branches, we will only create branches that
              start with <span className="font-medium">cloudagent/</span>.
            </p>
            <p className="text-xs text-gray-500">
              Note: PR-only access includes read access to the repository.
            </p>
            <Alert>
              <AlertTitle>Recommended: branch protection</AlertTitle>
              <AlertDescription>
                <div className="text-xs text-gray-600 space-y-2">
                  <p>
                    In GitHub: Settings -&gt; Branches -&gt; Add branch protection rule.
                  </p>
                  <p>
                    Example: Protect your default branch (like main) with
                    "Require a pull request before merging" and "Restrict who can push".
                  </p>
                  <p>
                    Optional: Add a rule for <span className="font-medium">cloudagent/*</span> and
                    allow the CloudAgent GitHub App to push to those branches.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGithubReposOpen(false)}
              disabled={githubReposSaving}
            >
              Close
            </Button>
            <Button onClick={handleGithubSaveRepos} disabled={githubReposSaving}>
              {githubReposSaving && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save repositories
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="bg-white max-w-xl">
          <DialogHeader>
            <DialogTitle>Connect Jira Cloud</DialogTitle>
            <DialogDescription>
              Authorize CloudAgent to access your Jira Cloud site.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  You will be redirected to Jira to authorize CloudAgent. After approval,
                  we will ask you to select the Jira site, project, and issue type.
                </p>
                {jiraAuthDescription}
              </div>
              <Button onClick={handleStartOAuth}>
                Continue to Jira
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={oauthCompleteOpen} onOpenChange={setOauthCompleteOpen}>
        <DialogContent className="bg-white max-w-xl">
          <DialogHeader>
            <DialogTitle>Finish Jira connection</DialogTitle>
            <DialogDescription>
              Select the Jira site and name this connection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {oauthSession.loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading Jira sites...
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Jira site</Label>
                  <Select
                    value={oauthSession.selectedCloudId}
                    onValueChange={handleOAuthResourceChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a Jira site" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {oauthSession.resources.map((resource) => (
                        <SelectItem key={resource.cloudId} value={resource.cloudId}>
                          {resource.name || resource.url}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="oauth-display-name">Connection name</Label>
                  <Input
                    id="oauth-display-name"
                    value={oauthSession.displayName}
                    onChange={(event) =>
                      setOauthSession((prev) => ({
                        ...prev,
                        displayName: event.target.value,
                      }))
                    }
                  />
                </div>
                {oauthSession.siteUrl && (
                  <p className="text-xs text-gray-500">
                    Site URL: {oauthSession.siteUrl}
                  </p>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOauthCompleteOpen(false)}
              disabled={oauthSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleOAuthConnect} disabled={oauthSubmitting}>
              {oauthSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={defaultsOpen} onOpenChange={setDefaultsOpen}>
        <DialogContent className="bg-white max-w-xl">
          <DialogHeader>
            <DialogTitle>Set Jira defaults</DialogTitle>
            <DialogDescription>
              Choose the default project and issue type for this connection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select
                value={defaultsForm.projectKey}
                onValueChange={(value) => {
                  setDefaultsForm((prev) => ({
                    ...prev,
                    projectKey: value,
                    issueTypeId: '',
                  }));
                  loadIssueTypes(defaultsForm.connectionId, value, '');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {projects.map((project) => (
                    <SelectItem key={project.key} value={project.key}>
                      {project.name} ({project.key})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Issue type</Label>
              <Select
                value={defaultsForm.issueTypeId}
                onValueChange={(value) =>
                  setDefaultsForm((prev) => ({
                    ...prev,
                    issueTypeId: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an issue type" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {issueTypes.map((issueType) => (
                    <SelectItem key={issueType.id} value={issueType.id}>
                      {issueType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {defaultsLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading Jira metadata...
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDefaultsOpen(false)}
              disabled={defaultsSubmitting}
            >
              Close
            </Button>
            <Button onClick={handleDefaultsSave} disabled={defaultsSubmitting}>
              {defaultsSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save defaults
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IntegrationsPage;
