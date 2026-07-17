import React, { useEffect, useRef } from 'react';
import { codingAgentRunnerLabel, normalizeCodingAgentRunner } from '@cloudagent/agent-runtime';

import { cn } from '@/lib/utils';
import { formatTerminalOutput, sanitizeTerminalText } from '@/lib/terminalEvents';

function sourceLabel(entry = {}) {
  const source = String(entry.source || entry.runner || '').trim();
  if (source.startsWith('mcp')) return 'CloudAgent MCP';
  const runner = normalizeCodingAgentRunner(source);
  return runner !== 'cloudagent' ? codingAgentRunnerLabel(runner) : 'CloudAgent';
}

function statusClasses(status) {
  if (status === 'failed') return 'bg-red-400/10 text-red-300 ring-red-400/20';
  if (status === 'completed') return 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/20';
  return 'bg-sky-400/10 text-sky-300 ring-sky-400/20';
}

function OutputBlock({ label, value, error = false }) {
  if (!value) return null;
  return (
    <div className={cn('mt-2 overflow-hidden rounded-md border', error ? 'border-red-400/25 bg-[#1c0d13]' : 'border-slate-700/80 bg-[#070b14]')}>
      <div className={cn('border-b px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]', error ? 'border-red-400/20 text-red-300' : 'border-slate-800 text-sky-300')}>
        {label}
      </div>
      <pre className={cn('max-w-full overflow-x-auto whitespace-pre px-3 py-2.5 text-[11px] leading-5', error ? 'text-red-100' : 'text-slate-200')}>
        {formatTerminalOutput(value)}
      </pre>
    </div>
  );
}

export default function TerminalPanel({ entries = [], className = '' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [entries]);

  return (
    <div ref={containerRef} className={cn('flex-1 overflow-y-auto bg-[#0b1120] p-3 terminal-scrollbar', className)}>
      <div className="space-y-2.5 font-mono">
        {entries.map((entry, index) => {
          const stdout = entry.stdout || entry.output || '';
          return (
            <section key={entry.id || index} className="rounded-lg border border-slate-700/80 bg-[#111827] p-3 shadow-sm shadow-black/20">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="rounded bg-slate-700/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-200">
                  {sourceLabel(entry)}
                </span>
                <div className="flex items-center gap-2">
                  {entry.cliSessionId ? (
                    <span className="text-[10px] text-slate-400" title={entry.cliSessionId}>
                      Session {String(entry.cliSessionId).slice(0, 8)}
                    </span>
                  ) : null}
                  <span className={cn('rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ring-1 ring-inset', statusClasses(entry.status))}>
                    {entry.status || 'running'}
                  </span>
                </div>
              </div>
              <div className="rounded-md border border-emerald-400/20 bg-[#0a1f18] px-3 py-2.5">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">Command</div>
                <div className="flex items-start text-[12px] leading-5 text-slate-100">
                  <span className="mr-2 shrink-0 select-none text-emerald-400">$</span>
                  <code className="min-w-0 whitespace-pre-wrap break-words">{sanitizeTerminalText(entry.command || 'command')}</code>
                </div>
              </div>
              {entry.cwd ? (
                <div className="mt-2 flex min-w-0 items-center gap-2 text-[10px] text-slate-500" title={entry.cwd}>
                  <span className="shrink-0 uppercase tracking-[0.1em] text-slate-600">cwd</span>
                  <span className="truncate text-slate-400">{entry.cwd}</span>
                </div>
              ) : null}
              <OutputBlock label="Output" value={stdout} />
              <OutputBlock label="Error" value={entry.stderr} error />
              <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-500">
                {entry.exitCode != null ? <span>Exit {entry.exitCode}</span> : null}
                {entry.durationMs != null ? <span>{entry.durationMs}ms</span> : null}
                {entry.timedOut ? <span className="text-red-300">Timed out</span> : null}
                {entry.stdoutTruncated || entry.stderrTruncated ? <span className="text-yellow-300">Output truncated</span> : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
