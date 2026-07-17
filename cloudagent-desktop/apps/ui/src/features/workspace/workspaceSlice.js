import { createSlice } from '@reduxjs/toolkit';

const ACTIVE_WORKSPACE_KEY = 'active-workspace-id';

const normalizeProfileType = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState: {
    activeWorkspaceId: localStorage.getItem(ACTIVE_WORKSPACE_KEY) || null,
  },
  reducers: {
    setActiveWorkspace: (state, action) => {
      const id = action.payload || null;
      state.activeWorkspaceId = id;
      if (id) {
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
      } else {
        localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
      }
    },
  },
});

export const { setActiveWorkspace } = workspaceSlice.actions;

// Selectors
export const selectActiveWorkspaceId = (state) => state.workspace.activeWorkspaceId;

export const selectWorkspaces = (state) => {
  const profiles = state.auth?.userProfile?.agentPermissionProfiles || [];
  return profiles
    .filter((p) => normalizeProfileType(p?.type) === 'workspace')
    .map((p) => {
      let authProfile = {};
      if (typeof p.authProfile === 'string') {
        try { authProfile = JSON.parse(p.authProfile); } catch { authProfile = {}; }
      } else if (p.authProfile && typeof p.authProfile === 'object') {
        authProfile = p.authProfile;
      }
      return {
        recordId: p.recordId,
        name: p.name,
        description: p.description,
        environments: Array.isArray(authProfile.environments) ? authProfile.environments : [],
      };
    });
};

export const selectActiveWorkspace = (state) => {
  const id = state.workspace.activeWorkspaceId;
  if (!id) return null;
  const workspaces = selectWorkspaces(state);
  return workspaces.find((w) => w.recordId === id) || null;
};

export const selectActiveEnvironmentIds = (state) => {
  const workspace = selectActiveWorkspace(state);
  if (!workspace) return null; // null means "all environments"
  return workspace.environments;
};

/**
 * Returns the AWS account IDs for the active workspace's environments.
 * Workloads store account IDs in their environments[], while workspaces store recordIds.
 * This selector resolves recordIds to account IDs for matching.
 */
export const selectActiveWorkspaceAccountIds = (state) => {
  const envRecordIds = selectActiveEnvironmentIds(state);
  if (!envRecordIds) return null;
  const profiles = state.auth?.userProfile?.agentPermissionProfiles || [];
  const accountIds = [];
  envRecordIds.forEach((recordId) => {
    const profile = profiles.find((p) => p.recordId === recordId);
    if (!profile) return;
    let authProfile = {};
    if (typeof profile.authProfile === 'string') {
      try { authProfile = JSON.parse(profile.authProfile); } catch { return; }
    } else {
      authProfile = profile.authProfile || {};
    }
    if (authProfile.awsAccountId) {
      accountIds.push(authProfile.awsAccountId);
    }
  });
  return accountIds;
};

export default workspaceSlice.reducer;
