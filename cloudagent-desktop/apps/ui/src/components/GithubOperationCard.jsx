/* eslint-disable react/prop-types */
import React from 'react';

export function GithubOperationCard({
  payload = {},
  actions = [],
  onAction,
  disabled = false,
  surface = 'panel',
}) {
  const statusKind = String(payload?.statusKind || '').toLowerCase();
  const containerClass =
    surface === 'panel'
      ? 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm'
      : 'rounded-lg border border-slate-200 bg-slate-50 p-3';
  const detailsClass =
    surface === 'panel'
      ? 'mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700'
      : 'mt-2 rounded border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700';
  const chipClass =
    surface === 'panel'
      ? 'rounded-md bg-slate-100 px-2.5 py-1'
      : 'rounded bg-white px-2 py-0.5';

  const statusClass =
    statusKind === 'failed'
      ? 'border-red-200 bg-red-50 text-red-800'
      : statusKind === 'completed'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-blue-200 bg-blue-50 text-blue-800';

  const repositories = Array.isArray(payload?.repositories) ? payload.repositories.slice(0, 6) : [];
  const actionButtons = [
    payload?.pullRequestUrl ? { label: 'Open pull request', href: payload.pullRequestUrl } : null,
    payload?.fileUrl ? { label: payload?.fileType === 'dir' ? 'Open directory' : 'Open file', href: payload.fileUrl } : null,
    payload?.branchUrl ? { label: 'Open branch', href: payload.branchUrl } : null,
    payload?.repositoryUrl ? { label: 'Open repository', href: payload.repositoryUrl } : null,
    ...(Array.isArray(actions) ? actions : []),
  ].filter(Boolean);

  return (
    <div className={containerClass}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold text-slate-900">
          {payload?.title || 'GitHub Operation'}
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass}`}>
          {payload?.statusLabel || 'Updated'}
        </span>
      </div>
      {payload?.summary ? <p className="mt-1 text-xs text-slate-700">{payload.summary}</p> : null}

      {payload?.guardrail ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              {payload.guardrail.tag || 'GitHub guardrail'}
            </span>
            <span className="font-semibold text-amber-900">{payload.guardrail.title}</span>
            {payload.guardrail.code ? (
              <span className="font-mono text-[10px] text-amber-700">{payload.guardrail.code}</span>
            ) : null}
          </div>
          <p className="mt-1.5 leading-5">{payload.guardrail.message}</p>
          {payload.guardrail.suggestion ? (
            <p className="mt-1 font-medium text-amber-800">{payload.guardrail.suggestion}</p>
          ) : null}
        </div>
      ) : null}

      {(payload?.repoFullName || payload?.path || repositories.length > 0) ? (
        <div className={detailsClass}>
          {payload?.repoFullName ? (
            <div className="font-semibold text-slate-900">{payload.repoFullName}</div>
          ) : payload?.title ? (
            <div className="font-semibold text-slate-900">{payload.title}</div>
          ) : null}
          {payload?.path ? (
            <div className="mt-1 break-all font-mono text-[11px] leading-5 text-slate-500">
              {payload.path}
            </div>
          ) : null}
          {repositories.length > 0 ? (
            <div className="mt-2 space-y-1">
              {repositories.map((repository) => (
                <div key={repository?.repoFullName} className="text-[11px] text-slate-600">
                  <span className="font-medium text-slate-700">{repository?.repoFullName}</span>
                  {repository?.defaultBranch ? <span>{` • ${repository.defaultBranch}`}</span> : null}
                  {repository?.access ? <span>{` • ${repository.access}`}</span> : null}
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {actionButtons.map((action) =>
              action?.href ? (
                <a
                  key={`${payload?.cardId || payload?.repoFullName || payload?.title}-${action.href}-${action.label}`}
                  href={action.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                >
                  {action.label}
                </a>
              ) : (
                <button
                  key={`${payload?.cardId || payload?.repoFullName || payload?.title}-${action.intent || action.label}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => onAction?.(action)}
                  className="inline-flex items-center rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {action.label || 'Open'}
                </button>
              )
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-700">
        {payload?.sourceTool ? <span className={chipClass}>Tool: {payload.sourceTool}</span> : null}
        {payload?.branch ? <span className={chipClass}>Branch: {payload.branch}</span> : null}
        {payload?.baseBranch ? <span className={chipClass}>Base: {payload.baseBranch}</span> : null}
        {payload?.headBranch ? <span className={chipClass}>Head: {payload.headBranch}</span> : null}
        {payload?.ref ? <span className={chipClass}>Ref: {payload.ref}</span> : null}
        {payload?.pullRequestNumber ? (
          <span className={chipClass}>PR: #{payload.pullRequestNumber}</span>
        ) : null}
        {payload?.pullRequestState ? (
          <span className={chipClass}>State: {payload.pullRequestState}</span>
        ) : null}
        {payload?.count != null ? <span className={chipClass}>Count: {payload.count}</span> : null}
        {payload?.entryCount != null ? <span className={chipClass}>Entries: {payload.entryCount}</span> : null}
        {payload?.timestamp ? (
          <span className={chipClass}>
            Updated: {new Date(payload.timestamp).toLocaleString()}
          </span>
        ) : null}
      </div>

      {payload?.commitMessage ? (
        <div className="mt-2 text-[11px] text-slate-600">Commit: {payload.commitMessage}</div>
      ) : null}
      {payload?.commitSha ? (
        <div className="mt-1 break-all font-mono text-[11px] text-slate-500">{payload.commitSha}</div>
      ) : null}
      {payload?.message && payload?.message !== payload?.summary ? (
        <div className="mt-1 text-[11px] text-slate-600">{payload.message}</div>
      ) : null}
    </div>
  );
}

export default GithubOperationCard;
