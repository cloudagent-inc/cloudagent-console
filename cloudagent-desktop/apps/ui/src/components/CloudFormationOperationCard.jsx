/* eslint-disable react/prop-types */
import React from 'react';

export function CloudFormationOperationCard({
  payload = {},
  actions = [],
  onAction,
  disabled = false,
  surface = 'tinted',
}) {
  const statusKind = String(payload?.statusKind || '').toLowerCase();
  const operation = String(payload?.operation || payload?.action || '').toLowerCase();
  const operationLabel =
    operation === 'create' ? 'Create' : operation === 'update' ? 'Update' : 'Deploy';
  const containerClass =
    surface === 'panel'
      ? 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm'
      : 'rounded-lg border border-blue-200 bg-blue-50/40 p-3';
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
      : statusKind === 'change_request_created'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : statusKind === 'deployment_complete'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : statusKind === 'deployment_in_progress'
            ? 'border-blue-200 bg-blue-50 text-blue-800'
            : statusKind === 'no_changes'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-slate-200 bg-slate-50 text-slate-700';

  const statusText =
    payload?.statusLabel ||
    (payload?.changeRequestCreated ? 'Change request created' : `${operationLabel} started`);
  const stackTitle = payload?.stackName || payload?.stackId || 'CloudFormation stack';
  const notificationSentTo = Array.isArray(payload?.notificationSentTo) ? payload.notificationSentTo : [];
  const events = Array.isArray(payload?.events) ? payload.events.slice(0, 5) : [];

  return (
    <div className={containerClass}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold text-slate-900">
          {payload?.title || 'CloudFormation Operation'}
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass}`}>
          {statusText}
        </span>
      </div>
      {payload?.summary ? <p className="mt-1 text-xs text-slate-700">{payload.summary}</p> : null}

      <div className={detailsClass}>
        <div className="font-semibold text-slate-900">{stackTitle}</div>
        {payload?.stackId ? (
          <div className="mt-1 break-all font-mono text-[11px] leading-5 text-slate-500">
            {payload.stackId}
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {payload?.stackUrl ? (
            <a
              href={payload.stackUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              Open stack
            </a>
          ) : null}
          {payload?.reviewUrl ? (
            <a
              href={payload.reviewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
            >
              Open change request
            </a>
          ) : null}
          {Array.isArray(actions) && actions.length > 0
            ? actions.map((action) => (
                <button
                  key={`${payload?.cardId || stackTitle}-${action.intent || action.label}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => onAction?.(action)}
                  className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {action.label || 'Open'}
                </button>
              ))
            : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-700">
        {payload?.region ? <span className={chipClass}>Region: {payload.region}</span> : null}
        {payload?.accountId ? <span className={chipClass}>Account: {payload.accountId}</span> : null}
        <span className={chipClass}>Operation: {operationLabel}</span>
        {payload?.status ? <span className={chipClass}>Status: {payload.status}</span> : null}
        {payload?.autoRefreshLabel ? <span className={chipClass}>{payload.autoRefreshLabel}</span> : null}
        {payload?.lastUpdatedTime ? (
          <span className={chipClass}>
            Updated: {new Date(payload.lastUpdatedTime).toLocaleString()}
          </span>
        ) : null}
      </div>

      {payload?.changeRequestCreated && payload?.changeSetId ? (
        <div className="mt-2 text-[11px] text-slate-600">
          Change set: {payload.changeSetName || payload.changeSetId}
        </div>
      ) : null}
      {notificationSentTo.length > 0 ? (
        <div className="mt-1 text-[11px] text-slate-600">Notified: {notificationSentTo.join(', ')}</div>
      ) : null}
      {payload?.message && payload?.message !== payload?.summary ? (
        <div className="mt-1 text-[11px] text-slate-600">{payload.message}</div>
      ) : null}
      {events.length > 0 ? (
        <div className="mt-2 rounded border border-slate-200 bg-white p-2">
          <div className="text-[11px] font-semibold text-slate-800">Recent stack events</div>
          <div className="mt-1 space-y-1">
            {events.map((event, index) => (
              <div key={`${event?.eventId || index}`} className="text-[11px] text-slate-600">
                <span className="font-medium text-slate-700">{event?.resourceStatus || 'EVENT'}</span>
                {event?.logicalResourceId ? <span>{` • ${event.logicalResourceId}`}</span> : null}
                {event?.resourceStatusReason ? <span>{` • ${event.resourceStatusReason}`}</span> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CloudFormationOperationCard;
