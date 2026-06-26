import React from 'react';
import { cn } from '@/lib/utils';

export default function StatusIndicator({ status, className }) {
  const statusConfig = {
    available: {
      dotColor: 'bg-green-500',
      bgColor: 'bg-green-100',
      textColor: 'text-green-500',
      label: 'Available',
    },
    active: {
      dotColor: 'bg-green-500',
      bgColor: 'bg-green-100',
      textColor: 'text-green-500',
      label: 'Active',
    },
    unavailable: {
      dotColor: 'bg-red-500',
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
      label: 'Unavailable',
    },
    busy: {
      dotColor: 'bg-yellow-500',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-700',
      label: 'Busy',
    },
    used: {
      dotColor: 'bg-yellow-500',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-700',
      label: 'Busy',
    },
    running: {
      dotColor: 'bg-yellow-500',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-700',
      label: 'Running',
    },
    'in-progress': {
      dotColor: 'bg-yellow-500',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-700',
      label: 'In Progress',
    },
    in_progress: {
      dotColor: 'bg-yellow-500',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-700',
      label: 'In Progress',
    },
    task_in_progress: {
      dotColor: 'bg-yellow-500',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-700',
      label: 'In Progress',
    },
    complete: {
      dotColor: 'bg-green-500',
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
      label: 'Completed',
    },
    failed: {
      dotColor: 'bg-red-500',
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
      label: 'Failed',
    },
    cancelled: {
      dotColor: 'bg-slate-500',
      bgColor: 'bg-slate-100',
      textColor: 'text-slate-700',
      label: 'Cancelled',
    },
    waiting_on_user_input: {
      dotColor: 'bg-blue-500',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
      label: 'Waiting on user input',
    },
    agent_waiting_on_user_input: {
      dotColor: 'bg-blue-500',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
      label: 'Waiting on user input',
    },
  };

  const normalizedStatus =
    typeof status === 'string' ? status.toLowerCase() : 'available';
  const config =
    statusConfig?.[normalizedStatus] || statusConfig?.['available'];

  return (
    <div
      className={cn(
        'inline-flex items-center max-w-full px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap',
        config?.bgColor,
        config?.textColor,
        className
      )}
    >
      <span
        className={cn('w-2 h-2 mr-1.5 rounded-full shrink-0', config?.dotColor)}
      ></span>
      <span className="truncate">{config?.label}</span>
    </div>
  );
}
