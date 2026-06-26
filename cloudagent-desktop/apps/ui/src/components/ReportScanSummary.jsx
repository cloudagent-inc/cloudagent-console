import React from 'react';
import Markdown from 'markdown-to-jsx';

const summaryMarkdownOptions = {
  overrides: {
    h1: { props: { className: 'text-sm font-semibold mb-2 mt-3 first:mt-0 text-slate-800' } },
    h2: { props: { className: 'text-sm font-semibold mb-1.5 mt-2 first:mt-0 text-slate-800' } },
    h3: { props: { className: 'text-xs font-semibold mb-1 mt-2 first:mt-0 text-slate-800' } },
    p: { props: { className: 'mb-2 last:mb-0 text-sm leading-6 text-slate-700' } },
    ul: { props: { className: 'list-disc pl-5 mb-2 space-y-1 text-sm text-slate-700' } },
    ol: { props: { className: 'list-decimal pl-5 mb-2 space-y-1 text-sm text-slate-700' } },
    li: { props: { className: 'leading-6' } },
    strong: { props: { className: 'font-semibold text-slate-900' } },
    a: { props: { className: 'text-blue-600 hover:text-blue-700 underline', target: '_blank', rel: 'noreferrer' } },
    blockquote: { props: { className: 'border-l-2 border-slate-300 pl-3 italic text-slate-600 my-2' } },
    code: { props: { className: 'rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-800' } },
    pre: { props: { className: 'overflow-x-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100 my-2' } },
  },
};

function normalizeReportSummary(summary) {
  if (!summary) return null;

  if (typeof summary === 'string') {
    try {
      const parsed = JSON.parse(summary);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return { summaryText: summary, updatedAt: null };
    }
  }

  if (typeof summary === 'object' && !Array.isArray(summary)) {
    return summary;
  }

  return null;
}

export default function ReportScanSummary({ summary, className = '' }) {
  const resolvedSummary = normalizeReportSummary(summary);

  if (!resolvedSummary?.summaryText) {
    return null;
  }

  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50 p-4 ${className}`.trim()}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Scan Summary</h3>
        {resolvedSummary.updatedAt ? (
          <span className="text-xs text-slate-500">
            Updated {new Date(resolvedSummary.updatedAt).toLocaleString()}
          </span>
        ) : null}
      </div>
      <div className="prose prose-sm max-w-none text-slate-700">
        <Markdown options={summaryMarkdownOptions}>
          {resolvedSummary.summaryText}
        </Markdown>
      </div>
    </div>
  );
}
