// Pure mapping from backend GitHub guardrail error codes to short, human
// readable run-surface messages. NEVER surfaces a matched secret value — only
// the pattern name is ever shown.

export const GITHUB_GUARDRAIL_TAG = 'GitHub guardrail';

const CODE_MAP = {
  protected_branch: {
    title: 'Protected branch',
    message: (d) =>
      `${d.branch ? `"${d.branch}"` : 'The target branch'} is protected — create a branch with create_github_branch first.`,
  },
  branch_prefix_required: {
    title: 'Branch prefix required',
    message: (d) =>
      `Branch names must start with ${d.branchPrefix ? `"${d.branchPrefix}"` : 'the required prefix'}.`,
    suggestion: (d) => (d.suggestedBranch ? `Use ${d.suggestedBranch}` : null),
  },
  branch_exists: {
    title: 'Branch already exists',
    message: (d) =>
      `${d.branch ? `"${d.branch}"` : 'That branch'} already exists and branch reset is not permitted here.`,
  },
  path_denied: {
    title: 'Path not allowed',
    message: (d) =>
      `${d.path ? `"${d.path}"` : 'That path'} is outside the allowed write scope.`,
    suggestion: (d) =>
      Array.isArray(d.allowedRoots) && d.allowedRoots.length > 0
        ? `Allowed roots: ${d.allowedRoots.join(', ')}`
        : null,
  },
  secret_detected: {
    title: 'Secret detected',
    // pattern is a rule NAME (e.g. "aws_access_key"), never the matched value.
    message: (d) =>
      `A potential secret (${d.pattern || 'credential pattern'}) was detected and the write was blocked.`,
  },
  diff_too_large: {
    title: 'Diff too large',
    message: (d) => {
      const parts = [];
      if (d.fileCount != null) parts.push(`${d.fileCount} files`);
      if (d.diffKb != null) parts.push(`${d.diffKb} KB`);
      return parts.length > 0
        ? `The change (${parts.join(', ')}) exceeds the configured pull-request limits.`
        : 'The change exceeds the configured pull-request limits.';
    },
  },
  invalid_base_branch: {
    title: 'Invalid base branch',
    message: (d) =>
      `${d.baseBranch ? `"${d.baseBranch}"` : 'The base branch'} is not the repository default branch.`,
  },
  repo_not_configured: {
    title: 'Repository not configured',
    message: (d) =>
      `${d.repoFullName || d.localPath || 'This repository'} is not a configured workload repository.`,
  },
  ambiguous_workload_for_repo: {
    title: 'Ambiguous workload',
    message: (d) =>
      `${d.repoFullName || 'This repository'} maps to more than one workload — specify workloadId.`,
  },
};

export const GITHUB_GUARDRAIL_CODES = Object.keys(CODE_MAP);

export function isGithubGuardrailCode(code) {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(CODE_MAP, code);
}

const callOrValue = (fn, details) => {
  if (typeof fn === 'function') {
    try {
      return fn(details);
    } catch {
      return null;
    }
  }
  return fn || null;
};

// Map a code + details into { code, title, message, suggestion, tag, actor,
// retryable }. Unknown codes get a generic friendly fallback so the card never
// renders an opaque failure.
export function mapGithubGuardrailError(code, details = {}) {
  const normalizedCode = typeof code === 'string' ? code : '';
  const entry = CODE_MAP[normalizedCode];
  const safeDetails = details && typeof details === 'object' ? details : {};

  if (!entry) {
    return {
      code: normalizedCode || 'github_guardrail',
      title: 'GitHub guardrail',
      message:
        typeof safeDetails.message === 'string' && safeDetails.message.trim()
          ? safeDetails.message.trim()
          : 'The GitHub guardrails blocked this action.',
      suggestion: null,
      tag: GITHUB_GUARDRAIL_TAG,
      actor: safeDetails.actor || null,
      retryable: typeof safeDetails.retryable === 'boolean' ? safeDetails.retryable : null,
    };
  }

  return {
    code: normalizedCode,
    title: entry.title,
    message: callOrValue(entry.message, safeDetails) || 'The GitHub guardrails blocked this action.',
    suggestion: callOrValue(entry.suggestion, safeDetails),
    tag: GITHUB_GUARDRAIL_TAG,
    actor: safeDetails.actor || null,
    retryable: typeof safeDetails.retryable === 'boolean' ? safeDetails.retryable : null,
  };
}

// Fields we are willing to copy out of a tool error into details. Deliberately
// excludes anything that could carry a matched secret value.
const SAFE_DETAIL_KEYS = [
  'branch',
  'branchPrefix',
  'suggestedBranch',
  'path',
  'allowedRoots',
  'pattern',
  'fileCount',
  'diffKb',
  'baseBranch',
  'repoFullName',
  'localPath',
  'message',
  'actor',
  'retryable',
];

// Detect a GitHub guardrail rejection inside a normalized tool result object and
// return { ...mappedError } or null. Accepts either a top-level `code` or an
// `error: { code, ... }` shape.
export function extractGithubGuardrailRejection(toolOutput) {
  if (!toolOutput || typeof toolOutput !== 'object') return null;
  const errorObj =
    toolOutput.error && typeof toolOutput.error === 'object' ? toolOutput.error : toolOutput;
  const code = errorObj.code || toolOutput.code;
  if (!isGithubGuardrailCode(code)) return null;

  const details = {};
  SAFE_DETAIL_KEYS.forEach((key) => {
    if (errorObj[key] !== undefined) details[key] = errorObj[key];
    else if (toolOutput[key] !== undefined) details[key] = toolOutput[key];
  });

  return mapGithubGuardrailError(code, details);
}
