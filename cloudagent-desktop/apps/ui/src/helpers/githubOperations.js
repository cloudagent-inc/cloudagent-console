function parseToolPayload(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') return value;
  return null;
}

function normalizeString(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeBranch(value) {
  const normalized = normalizeString(value);
  return normalized ? normalized.replace(/^refs\/heads\//, '') : null;
}

function buildRepoFullName({ owner, repo, repoFullName }) {
  const normalizedFullName = normalizeString(repoFullName);
  if (normalizedFullName) return normalizedFullName;
  const normalizedOwner = normalizeString(owner);
  const normalizedRepo = normalizeString(repo);
  return normalizedOwner && normalizedRepo ? `${normalizedOwner}/${normalizedRepo}` : null;
}

function buildRepositoryUrl(repoFullName) {
  return repoFullName ? `https://github.com/${repoFullName}` : null;
}

function buildBranchUrl(repoFullName, branch) {
  const normalizedBranch = normalizeBranch(branch);
  return repoFullName && normalizedBranch
    ? `https://github.com/${repoFullName}/tree/${encodeURIComponent(normalizedBranch)}`
    : null;
}

function buildFileUrl(repoFullName, ref, path, contentType) {
  const normalizedRef = normalizeBranch(ref);
  const normalizedPath = normalizeString(path);
  if (!repoFullName || !normalizedRef || !normalizedPath) return null;
  const encodedPath = normalizedPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const view = contentType === 'dir' ? 'tree' : 'blob';
  return `https://github.com/${repoFullName}/${view}/${encodeURIComponent(normalizedRef)}/${encodedPath}`;
}

function defaultTitleForTool(sourceTool) {
  switch (sourceTool) {
    case 'create_github_branch':
      return 'GitHub Branch';
    case 'create_github_pull_request':
      return 'GitHub Pull Request';
    case 'write_github_file':
      return 'GitHub File Update';
    case 'read_github_file':
      return 'GitHub File Read';
    case 'list_github_repos':
      return 'GitHub Repositories';
    default:
      return 'GitHub Operation';
  }
}

export function normalizeGithubOperation({ output, input = null }) {
  const toolOutput = parseToolPayload(output);
  if (!toolOutput || typeof toolOutput !== 'object') return null;

  const sourceTool = normalizeString(toolOutput.sourceTool || input?.sourceTool) || null;
  const owner = normalizeString(toolOutput.owner || input?.owner) || null;
  const repo = normalizeString(toolOutput.repo || input?.repo) || null;
  const repoFullName = buildRepoFullName({
    owner,
    repo,
    repoFullName: toolOutput.repoFullName || input?.repoFullName,
  });
  const branch = normalizeBranch(toolOutput.branch || input?.branch) || null;
  const ref = normalizeBranch(toolOutput.ref || input?.ref || branch) || null;
  const baseBranch = normalizeBranch(toolOutput.baseBranch || input?.baseBranch) || null;
  const headBranch = normalizeBranch(toolOutput.headBranch || input?.headBranch) || null;
  const path = normalizeString(toolOutput.path || input?.path) || null;
  const fileType = normalizeString(toolOutput.fileType) || null;
  const statusKind =
    normalizeString(toolOutput.statusKind) ||
    (toolOutput.ok === false ? 'failed' : 'completed');
  const repositories = Array.isArray(toolOutput.repositories) ? toolOutput.repositories : [];

  return {
    cardId: normalizeString(toolOutput.cardId) || null,
    sourceTool,
    title: normalizeString(toolOutput.title) || defaultTitleForTool(sourceTool),
    statusKind,
    statusLabel:
      normalizeString(toolOutput.statusLabel) ||
      (statusKind === 'failed'
        ? 'Operation failed'
        : statusKind === 'in_progress'
          ? 'In progress'
          : 'Completed'),
    summary: normalizeString(toolOutput.summary || toolOutput.message) || null,
    message: normalizeString(toolOutput.message) || null,
    ok: typeof toolOutput.ok === 'boolean' ? toolOutput.ok : null,
    timestamp: normalizeString(toolOutput.timestamp) || null,
    connectionId: normalizeString(toolOutput.connectionId || input?.connectionId) || null,
    owner,
    repo,
    repoFullName,
    repositoryUrl: normalizeString(toolOutput.repositoryUrl) || buildRepositoryUrl(repoFullName),
    branch,
    ref,
    baseBranch,
    headBranch,
    branchUrl: normalizeString(toolOutput.branchUrl) || buildBranchUrl(repoFullName, branch),
    baseBranchUrl:
      normalizeString(toolOutput.baseBranchUrl) || buildBranchUrl(repoFullName, baseBranch),
    headBranchUrl:
      normalizeString(toolOutput.headBranchUrl) || buildBranchUrl(repoFullName, headBranch),
    path,
    fileUrl:
      normalizeString(toolOutput.fileUrl) || buildFileUrl(repoFullName, ref || branch, path, fileType),
    fileType,
    fileSha: normalizeString(toolOutput.fileSha) || null,
    fileSize: Number.isFinite(Number(toolOutput.fileSize)) ? Number(toolOutput.fileSize) : null,
    commitSha: normalizeString(toolOutput.commitSha) || null,
    commitUrl: normalizeString(toolOutput.commitUrl) || null,
    commitMessage: normalizeString(toolOutput.commitMessage) || null,
    sha: normalizeString(toolOutput.sha) || null,
    pullRequestTitle: normalizeString(toolOutput.pullRequestTitle) || null,
    pullRequestNumber:
      Number.isFinite(Number(toolOutput.pullRequestNumber)) ? Number(toolOutput.pullRequestNumber) : null,
    pullRequestState: normalizeString(toolOutput.pullRequestState) || null,
    pullRequestUrl: normalizeString(toolOutput.pullRequestUrl) || null,
    count: Number.isFinite(Number(toolOutput.count)) ? Number(toolOutput.count) : null,
    entryCount: Number.isFinite(Number(toolOutput.entryCount)) ? Number(toolOutput.entryCount) : null,
    repositories: repositories
      .map((repository) => {
        const normalizedRepoFullName = buildRepoFullName({
          owner: repository?.owner,
          repo: repository?.repo,
          repoFullName: repository?.fullName || repository?.repoFullName,
        });
        if (!normalizedRepoFullName) return null;
        return {
          ...repository,
          repoFullName: normalizedRepoFullName,
          repositoryUrl: repository?.repositoryUrl || buildRepositoryUrl(normalizedRepoFullName),
        };
      })
      .filter(Boolean),
  };
}

export function dedupeGithubOperations(operations = []) {
  const merged = [];
  const seen = new Map();

  (Array.isArray(operations) ? operations : []).forEach((operation) => {
    if (!operation || typeof operation !== 'object') return;
    const dedupeKey =
      operation.cardId ||
      [
        operation.sourceTool || '',
        operation.repoFullName || '',
        operation.path || '',
        operation.branch || operation.ref || '',
        operation.baseBranch || '',
        operation.headBranch || '',
        operation.pullRequestNumber || operation.pullRequestTitle || '',
      ].join('::');
    const existingIndex = seen.get(dedupeKey);
    if (typeof existingIndex === 'number') {
      merged[existingIndex] = operation;
      return;
    }
    seen.set(dedupeKey, merged.length);
    merged.push(operation);
  });

  return merged;
}
