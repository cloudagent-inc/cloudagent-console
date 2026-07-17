const parseAuthProfile = (value) => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) || {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object') return value;
  return {};
};

export const getGithubConnections = (userProfile) => {
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
        account: authProfile.account || null,
        installationId: authProfile.installationId || null,
        repositories,
        repoCount: repositories.length,
        displayName:
          profile.name ||
          authProfile.account?.login ||
          profile.description ||
          'GitHub',
      };
    });
};

export const buildGitRepo = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const connectionId = String(raw.connectionId || '').trim();
  if (!connectionId) return null;
  const owner = String(raw.owner || '').trim();
  const repo = String(raw.repo || '').trim();
  const fullName = String(
    raw.fullName || (owner && repo ? `${owner}/${repo}` : '')
  ).trim();
  const branch = String(raw.branch || raw.defaultBranch || '').trim();
  const localPath = String(
    raw.localPath || raw.repoPath || raw.checkoutPath || ''
  ).trim();
  return {
    connectionId,
    owner,
    repo,
    fullName,
    branch,
    localPath,
  };
};

export const cleanGitRepo = (raw) => {
  const gitRepo = buildGitRepo(raw);
  if (!gitRepo) return null;
  if (!gitRepo.owner || !gitRepo.repo || !gitRepo.branch) return null;
  return gitRepo;
};
