/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  DEFAULT_GITHUB_GOVERNANCE,
  GITHUB_BRANCH_RESET_OPTIONS,
  GITHUB_MODE_OPTIONS,
  GITHUB_PATH_SCOPE_MODE_OPTIONS,
  describeGithubDelivery,
  isGithubFieldOverridden,
  resolveEffectiveGithubGovernance,
  revertGithubOverrideField,
  sanitizeGithubGovernance,
  setGithubOverrideField,
} from './githubGovernance';
import {
  fetchBranchProtectionStatus,
  fetchEffectiveGithubGovernance,
  verifyBranchProtection,
} from '@/api/githubGovernanceApi';

const LEVEL_INHERITS = {
  workload: 'environment or global',
  environment: 'global',
  global: null,
};

function InheritanceBadge({ level, overridden }) {
  if (level === 'global') return null;
  if (overridden) {
    return (
      <span className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-700">
        Overridden
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-500">
      Inherited from {LEVEL_INHERITS[level]}
    </span>
  );
}

function FieldRow({ level, field, label, description, overridden, onRevert, children }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label className="font-medium text-gray-700">{label}</Label>
          <InheritanceBadge level={level} overridden={overridden} />
        </div>
        {level !== 'global' && overridden ? (
          <button
            type="button"
            onClick={() => onRevert(field)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-primary-600"
          >
            <RotateCcw className="h-3 w-3" />
            Revert to inherited
          </button>
        ) : null}
      </div>
      {description ? <p className="mt-0.5 text-xs text-gray-500">{description}</p> : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ChipsInput({ values, placeholder, onAdd, onRemove }) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const parts = draft
      .split(/[,\s]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) onAdd(parts);
    setDraft('');
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {(values || []).map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[12px] text-gray-700"
          >
            <span className="font-mono">{value}</span>
            <button
              type="button"
              className="text-gray-400 transition hover:text-red-500"
              onClick={() => onRemove(value)}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {(!values || values.length === 0) && (
          <span className="text-xs text-gray-400">None configured</span>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
          placeholder={placeholder}
          className="text-sm"
        />
      </div>
    </div>
  );
}

function repoStatusChip(status) {
  if (!status || status.checked === false || status.unavailable) {
    return {
      className: 'border-gray-200 bg-gray-50 text-gray-500',
      icon: null,
      label: 'Not verified yet',
    };
  }
  if (status.protected === true && status.requiresPullRequest !== false) {
    return {
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      icon: ShieldCheck,
      label: 'Default branch protected',
    };
  }
  if (status.protected === false) {
    return {
      className: 'border-amber-200 bg-amber-50 text-amber-800',
      icon: ShieldAlert,
      label: `${status.defaultBranch || 'main'} is not protected — agents could bypass PR-only locally`,
    };
  }
  return {
    className: 'border-gray-200 bg-gray-50 text-gray-500',
    icon: null,
    label: 'Protection status unknown',
  };
}

export default function SourceControlGovernanceCard({
  level = 'workload',
  value,
  inheritedGithub,
  onChange,
  repoFullName = null,
  workloadId = null,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [repoStatus, setRepoStatus] = useState(null);
  const [detectedDefaultBranch, setDetectedDefaultBranch] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const override = value && typeof value === 'object' ? value : {};
  const inherited = useMemo(
    () => sanitizeGithubGovernance(level === 'global' ? DEFAULT_GITHUB_GOVERNANCE : inheritedGithub || {}),
    [inheritedGithub, level]
  );
  const effective = useMemo(
    () => resolveEffectiveGithubGovernance(inherited, override),
    [inherited, override]
  );

  const getField = useCallback((field) => effective[field], [effective]);
  const overridden = useCallback(
    (field) => isGithubFieldOverridden(override, field, level),
    [override, level]
  );
  const setField = useCallback(
    (field, fieldValue) => onChange?.(setGithubOverrideField(override, field, fieldValue)),
    [onChange, override]
  );
  const revert = useCallback(
    (field) => onChange?.(revertGithubOverrideField(override, field)),
    [onChange, override]
  );

  // Load cached branch-protection status + detected default branch for the repo.
  useEffect(() => {
    let cancelled = false;
    if (level === 'global' || !repoFullName) {
      setRepoStatus(null);
      setDetectedDefaultBranch(null);
      return () => {};
    }
    (async () => {
      const [status, governance] = await Promise.all([
        fetchBranchProtectionStatus({ repoFullName }),
        fetchEffectiveGithubGovernance({ workloadId, repoFullName }),
      ]);
      if (cancelled) return;
      setRepoStatus(status);
      const branch = status?.defaultBranch || governance?.defaultBranch || null;
      if (branch) setDetectedDefaultBranch(branch);
    })();
    return () => {
      cancelled = true;
    };
  }, [level, repoFullName, workloadId]);

  const handleVerify = useCallback(async () => {
    if (!repoFullName) return;
    setIsVerifying(true);
    try {
      const result = await verifyBranchProtection({ repoFullName, workloadId });
      setRepoStatus({ ...result, checked: true });
      if (result?.defaultBranch) setDetectedDefaultBranch(result.defaultBranch);
    } finally {
      setIsVerifying(false);
    }
  }, [repoFullName, workloadId]);

  const chip = repoStatusChip(repoStatus);
  const ChipIcon = chip.icon;
  const deliveryLine = describeGithubDelivery(effective, {
    repoFullName,
    slug: 'change',
  });

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Source Control (GitHub)</h3>

      {/* Effective delivery preview */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <span className="font-medium text-gray-700">Delivery:</span> {deliveryLine}
      </div>

      {/* Repo status row (per-workload / per-environment only) */}
      {level !== 'global' && repoFullName ? (
        <div className="mb-5 rounded-lg border border-gray-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium text-gray-700">{repoFullName}</div>
            <button
              type="button"
              onClick={handleVerify}
              disabled={isVerifying}
              className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-3 w-3 ${isVerifying ? 'animate-spin' : ''}`} />
              Verify now
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
            <span>
              Default branch:{' '}
              <span className="font-mono text-gray-700">{detectedDefaultBranch || 'unknown'}</span>
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${chip.className}`}
            >
              {ChipIcon ? <ChipIcon className="h-3 w-3" /> : null}
              {chip.label}
            </span>
            {repoStatus?.checkedAt ? (
              <span>Last verified: {new Date(repoStatus.checkedAt).toLocaleString()}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-5">
        {/* PR-only mode */}
        <FieldRow
          level={level}
          field="mode"
          label="Pull-request policy"
          overridden={overridden('mode')}
          onRevert={revert}
        >
          <div className="space-y-2">
            {GITHUB_MODE_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-start gap-2">
                <input
                  type="radio"
                  name={`github-mode-${level}`}
                  value={option.value}
                  checked={getField('mode') === option.value}
                  onChange={() => setField('mode', option.value)}
                  className="mt-1 h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-700">{option.label}</span>
                  <span className="block text-xs text-gray-500">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </FieldRow>

        {/* Protected branches */}
        <FieldRow
          level={level}
          field="protectedBranches"
          label="Protected branches"
          description="Agents may never commit or push directly to these branches (union with the detected default branch)."
          overridden={overridden('protectedBranches')}
          onRevert={revert}
        >
          <ChipsInput
            values={getField('protectedBranches')}
            placeholder="Add branch (e.g. main) and press Enter"
            onAdd={(parts) => {
              const current = getField('protectedBranches') || [];
              const next = [...current];
              parts.forEach((part) => {
                if (!next.includes(part)) next.push(part);
              });
              setField('protectedBranches', next);
            }}
            onRemove={(branch) =>
              setField(
                'protectedBranches',
                (getField('protectedBranches') || []).filter((entry) => entry !== branch)
              )
            }
          />
        </FieldRow>

        {/* Branch prefix */}
        <FieldRow
          level={level}
          field="branchPrefix"
          label="Branch prefix"
          description='Required prefix for agent-created branches. Leave empty to disable the requirement.'
          overridden={overridden('branchPrefix')}
          onRevert={revert}
        >
          <Input
            value={getField('branchPrefix')}
            onChange={(event) => setField('branchPrefix', event.target.value)}
            placeholder="cloudagent/"
            className="max-w-xs text-sm"
          />
        </FieldRow>

        {/* Draft PRs */}
        <FieldRow
          level={level}
          field="draftPrs"
          label="Open pull requests as drafts"
          overridden={overridden('draftPrs')}
          onRevert={revert}
        >
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(getField('draftPrs'))}
              onChange={(event) => setField('draftPrs', event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Create pull requests in draft state</span>
          </label>
        </FieldRow>

        {/* Branch reset policy */}
        <FieldRow
          level={level}
          field="allowBranchReset"
          label="Branch reset policy"
          overridden={overridden('allowBranchReset')}
          onRevert={revert}
        >
          <select
            value={getField('allowBranchReset')}
            onChange={(event) => setField('allowBranchReset', event.target.value)}
            className="w-full max-w-sm rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {GITHUB_BRANCH_RESET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} — {option.description}
              </option>
            ))}
          </select>
        </FieldRow>
      </div>

      {/* Advanced section */}
      <div className="mt-5 border-t pt-4">
        <button
          type="button"
          onClick={() => setAdvancedOpen((prev) => !prev)}
          className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-primary-600"
        >
          {advancedOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Advanced
        </button>

        {advancedOpen ? (
          <div className="mt-4 space-y-5">
            {/* Path scope mode */}
            <FieldRow
              level={level}
              field="pathScope"
              label="Path scope"
              description="Restrict which paths agents may write. .github/workflows/** stays denied unless explicitly removed."
              overridden={overridden('pathScope')}
              onRevert={revert}
            >
              <select
                value={getField('pathScope').mode}
                onChange={(event) =>
                  setField('pathScope', { ...getField('pathScope'), mode: event.target.value })
                }
                className="mb-3 w-full max-w-sm rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {GITHUB_PATH_SCOPE_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} — {option.description}
                  </option>
                ))}
              </select>
              <Label className="mb-1 block text-xs text-gray-600">Deny globs</Label>
              <ChipsInput
                values={getField('pathScope').deny}
                placeholder="Add deny glob (e.g. **/*.tfstate)"
                onAdd={(parts) => {
                  const scope = getField('pathScope');
                  const next = [...(scope.deny || [])];
                  parts.forEach((part) => {
                    if (!next.includes(part)) next.push(part);
                  });
                  setField('pathScope', { ...scope, deny: next });
                }}
                onRemove={(glob) => {
                  const scope = getField('pathScope');
                  setField('pathScope', {
                    ...scope,
                    deny: (scope.deny || []).filter((entry) => entry !== glob),
                  });
                }}
              />
            </FieldRow>

            {/* Secret scan */}
            <FieldRow
              level={level}
              field="secretScan"
              label="Secret scanning"
              overridden={overridden('secretScan')}
              onRevert={revert}
            >
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(getField('secretScan'))}
                  onChange={(event) => setField('secretScan', event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">
                  Block writes when a credential pattern is detected
                </span>
              </label>
            </FieldRow>

            {/* Strict reads */}
            <FieldRow
              level={level}
              field="strictReads"
              label="Strict repository reads"
              overridden={overridden('strictReads')}
              onRevert={revert}
            >
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(getField('strictReads'))}
                  onChange={(event) => setField('strictReads', event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">
                  Refuse reads outside configured repositories
                </span>
              </label>
            </FieldRow>

            {/* Limits */}
            <FieldRow
              level={level}
              field="limits"
              label="Pull-request limits"
              overridden={overridden('limits')}
              onRevert={revert}
            >
              <div className="flex flex-wrap gap-4">
                <label className="text-xs text-gray-600">
                  <span className="mb-1 block">Max files per PR</span>
                  <Input
                    type="number"
                    min={1}
                    value={getField('limits').maxFilesPerPr}
                    onChange={(event) =>
                      setField('limits', {
                        ...getField('limits'),
                        maxFilesPerPr: Number(event.target.value),
                      })
                    }
                    className="w-28 text-sm"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  <span className="mb-1 block">Max diff (KB)</span>
                  <Input
                    type="number"
                    min={1}
                    value={getField('limits').maxDiffKb}
                    onChange={(event) =>
                      setField('limits', {
                        ...getField('limits'),
                        maxDiffKb: Number(event.target.value),
                      })
                    }
                    className="w-28 text-sm"
                  />
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={Boolean(getField('limits').allowBinary)}
                    onChange={(event) =>
                      setField('limits', {
                        ...getField('limits'),
                        allowBinary: event.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Allow binary files
                </label>
              </div>
            </FieldRow>

            {/* Attribution */}
            <FieldRow
              level={level}
              field="attribution"
              label="Attribution"
              overridden={overridden('attribution')}
              onRevert={revert}
            >
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(getField('attribution').coAuthorTrailer)}
                    onChange={(event) =>
                      setField('attribution', {
                        ...getField('attribution'),
                        coAuthorTrailer: event.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Add co-author trailer to commits</span>
                </label>
                <div>
                  <Label className="mb-1 block text-xs text-gray-600">Pull-request label</Label>
                  <Input
                    value={getField('attribution').prLabel}
                    onChange={(event) =>
                      setField('attribution', {
                        ...getField('attribution'),
                        prLabel: event.target.value,
                      })
                    }
                    placeholder="cloudagent"
                    className="max-w-xs text-sm"
                  />
                </div>
              </div>
            </FieldRow>
          </div>
        ) : null}
      </div>
    </div>
  );
}
