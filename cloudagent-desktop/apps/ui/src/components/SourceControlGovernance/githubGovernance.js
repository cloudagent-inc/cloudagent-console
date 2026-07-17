// Pure helpers for the GitHub source-control governance schema stored under
// deploymentPreferences.github. Resolution chain: workload -> environment
// (permission profile) -> global -> hardcoded secure defaults.
//
// The defaults below are the SECURE values — guardrails are on even before any
// UI or stored config exists. Kept in sync with the backend governance schema
// (docs/internal/github-guardrails-todo.md).

export const DEFAULT_GITHUB_GOVERNANCE = Object.freeze({
  mode: 'pr_only',
  protectedBranches: ['main', 'master'],
  branchPrefix: 'cloudagent/',
  allowBranchReset: 'prefix_only',
  draftPrs: true,
  pathScope: {
    mode: 'iac_roots',
    additionalAllow: [],
    deny: ['.github/workflows/**', '**/*.tfstate', '**/.env*'],
  },
  secretScan: true,
  strictReads: false,
  limits: { maxFilesPerPr: 50, maxDiffKb: 512, allowBinary: false },
  attribution: { coAuthorTrailer: true, prLabel: 'cloudagent' },
});

// Top-level fields that can be independently overridden at each level. Object
// fields (pathScope/limits/attribution) override as a whole object.
export const GITHUB_GOVERNANCE_FIELDS = Object.freeze([
  'mode',
  'protectedBranches',
  'branchPrefix',
  'allowBranchReset',
  'draftPrs',
  'pathScope',
  'secretScan',
  'strictReads',
  'limits',
  'attribution',
]);

export const GITHUB_MODE_OPTIONS = Object.freeze([
  {
    value: 'pr_only',
    label: 'PR only',
    description: 'Agents must branch and open a pull request — never commit to a protected branch.',
  },
  {
    value: 'unrestricted',
    label: 'Unrestricted',
    description: 'Allow direct commits. Path, secret, and diff guardrails still apply.',
  },
]);

export const GITHUB_BRANCH_RESET_OPTIONS = Object.freeze([
  {
    value: 'prefix_only',
    label: 'Prefix branches only',
    description: 'Reset an existing branch only when it carries the required prefix.',
  },
  { value: 'never', label: 'Never', description: 'Never reset an existing branch.' },
  { value: 'always', label: 'Always', description: 'Reset any existing branch (not recommended).' },
]);

export const GITHUB_PATH_SCOPE_MODE_OPTIONS = Object.freeze([
  {
    value: 'iac_roots',
    label: 'IaC roots only',
    description: 'Writes allowed only under declared IaC roots plus any additional allow globs.',
  },
  {
    value: 'any',
    label: 'Any path',
    description: 'Allow writes anywhere except the deny globs below.',
  },
]);

const VALID_MODES = new Set(['pr_only', 'unrestricted']);
const VALID_RESET = new Set(['prefix_only', 'never', 'always']);
const VALID_PATH_MODES = new Set(['iac_roots', 'any']);

const toStringArray = (value, fallback) => {
  if (!Array.isArray(value)) return [...fallback];
  const seen = new Set();
  const result = [];
  value.forEach((entry) => {
    const normalized = typeof entry === 'string' ? entry.trim() : '';
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  });
  return result;
};

const toBool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
};

const sanitizePathScope = (source) => {
  const base = DEFAULT_GITHUB_GOVERNANCE.pathScope;
  const src = source && typeof source === 'object' ? source : {};
  return {
    mode: VALID_PATH_MODES.has(src.mode) ? src.mode : base.mode,
    additionalAllow: toStringArray(src.additionalAllow, base.additionalAllow),
    deny: toStringArray(src.deny, base.deny),
  };
};

const sanitizeLimits = (source) => {
  const base = DEFAULT_GITHUB_GOVERNANCE.limits;
  const src = source && typeof source === 'object' ? source : {};
  return {
    maxFilesPerPr: toPositiveInt(src.maxFilesPerPr, base.maxFilesPerPr),
    maxDiffKb: toPositiveInt(src.maxDiffKb, base.maxDiffKb),
    allowBinary: toBool(src.allowBinary, base.allowBinary),
  };
};

const sanitizeAttribution = (source) => {
  const base = DEFAULT_GITHUB_GOVERNANCE.attribution;
  const src = source && typeof source === 'object' ? source : {};
  return {
    coAuthorTrailer: toBool(src.coAuthorTrailer, base.coAuthorTrailer),
    prLabel: typeof src.prLabel === 'string' ? src.prLabel.trim() : base.prLabel,
  };
};

// Produce a fully-populated, type-coerced github governance object. Any missing
// or invalid field falls back to the secure default. Use this for the global
// (base) layer and for rendering an effective config.
export function sanitizeGithubGovernance(source = {}) {
  const src = source && typeof source === 'object' ? source : {};
  return {
    mode: VALID_MODES.has(src.mode) ? src.mode : DEFAULT_GITHUB_GOVERNANCE.mode,
    protectedBranches: toStringArray(
      src.protectedBranches,
      DEFAULT_GITHUB_GOVERNANCE.protectedBranches
    ),
    branchPrefix:
      typeof src.branchPrefix === 'string'
        ? src.branchPrefix.trim()
        : DEFAULT_GITHUB_GOVERNANCE.branchPrefix,
    allowBranchReset: VALID_RESET.has(src.allowBranchReset)
      ? src.allowBranchReset
      : DEFAULT_GITHUB_GOVERNANCE.allowBranchReset,
    draftPrs: toBool(src.draftPrs, DEFAULT_GITHUB_GOVERNANCE.draftPrs),
    pathScope: sanitizePathScope(src.pathScope),
    secretScan: toBool(src.secretScan, DEFAULT_GITHUB_GOVERNANCE.secretScan),
    strictReads: toBool(src.strictReads, DEFAULT_GITHUB_GOVERNANCE.strictReads),
    limits: sanitizeLimits(src.limits),
    attribution: sanitizeAttribution(src.attribution),
  };
}

// Keep only the top-level fields that are present in `source` as overrides.
// Used to persist a per-workload / per-environment override (partial) object.
export function sanitizeGithubGovernanceOverride(source = {}) {
  const src = source && typeof source === 'object' ? source : {};
  const override = {};
  const full = sanitizeGithubGovernance(src);
  GITHUB_GOVERNANCE_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(src, field)) {
      override[field] = full[field];
    }
  });
  return override;
}

// Merge partial override layers over a resolved base. Earlier layers are lower
// priority (base first), later layers win. Every layer's present top-level key
// overrides the whole value for that key.
export function mergeGithubGovernance(...layers) {
  const result = sanitizeGithubGovernance(layers[0] || {});
  for (let index = 1; index < layers.length; index += 1) {
    const layer = layers[index];
    if (!layer || typeof layer !== 'object') continue;
    const sanitizedLayer = sanitizeGithubGovernance(layer);
    GITHUB_GOVERNANCE_FIELDS.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(layer, field)) {
        result[field] = sanitizedLayer[field];
      }
    });
  }
  return result;
}

// Effective config given a fully-resolved inherited config and this level's
// partial override object.
export function resolveEffectiveGithubGovernance(inherited, override) {
  const base = sanitizeGithubGovernance(inherited || {});
  return mergeGithubGovernance(base, override || {});
}

// 'overridden' when the field is present in this level's override object,
// otherwise 'inherited'. Global level always reports 'overridden' (it is the base).
export function getGithubFieldOverrideState(override, field, level = 'workload') {
  if (level === 'global') return 'overridden';
  return override && Object.prototype.hasOwnProperty.call(override, field)
    ? 'overridden'
    : 'inherited';
}

export function isGithubFieldOverridden(override, field, level = 'workload') {
  return getGithubFieldOverrideState(override, field, level) === 'overridden';
}

// Return a new override object with `field` set to `value`.
export function setGithubOverrideField(override, field, value) {
  const next = { ...(override && typeof override === 'object' ? override : {}) };
  next[field] = value;
  return next;
}

// Return a new override object with `field` removed (revert to inherited).
export function revertGithubOverrideField(override, field) {
  const next = { ...(override && typeof override === 'object' ? override : {}) };
  delete next[field];
  return next;
}

// Union the configured protected branches with a detected default branch, as
// the backend does when enforcing.
export function withDetectedDefaultBranch(config, defaultBranch) {
  const branch = typeof defaultBranch === 'string' ? defaultBranch.trim() : '';
  const protectedBranches = Array.isArray(config?.protectedBranches)
    ? [...config.protectedBranches]
    : [];
  if (branch && !protectedBranches.includes(branch)) protectedBranches.push(branch);
  return protectedBranches;
}

// Human-friendly one-line delivery summary derived from an effective config,
// used by preflight/flight-plan surfaces.
// e.g. "PR to owner/repo from cloudagent/<slug> (draft)".
export function describeGithubDelivery(config, { repoFullName, slug = 'change' } = {}) {
  const effective = sanitizeGithubGovernance(config || {});
  if (effective.mode !== 'pr_only') {
    return repoFullName
      ? `Direct commits to ${repoFullName} (unrestricted)`
      : 'Direct commits (unrestricted)';
  }
  const prefix = effective.branchPrefix || '';
  const safeSlug = String(slug || 'change')
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'change';
  const branch = `${prefix}${safeSlug}`;
  const target = repoFullName || 'the repository';
  return `PR to ${target} from ${branch}${effective.draftPrs ? ' (draft)' : ''}`;
}
