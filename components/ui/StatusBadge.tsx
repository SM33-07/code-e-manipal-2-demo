import React from 'react';

export type EventPhase =
  | 'NOT_STARTED'
  | 'HACKING'
  | 'SUBMISSION'
  | 'SUBMISSION_CLOSED'
  | 'JUDGING'
  | 'RESULTS'
  | 'ENDED';

export type ResultsReleaseState = 'DRAFT' | 'PUBLISHING' | 'PUBLISHED';

interface StatusBadgeProps {
  status: EventPhase | ResultsReleaseState | string;
  variant?: 'phase' | 'release' | 'generic';
  pulse?: boolean;
  className?: string;
}

const PHASE_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dot: string; pulse?: boolean }
> = {
  NOT_STARTED: {
    label: 'Not Started',
    bg: 'bg-zinc-500/10 border-zinc-500/20',
    text: 'text-zinc-700 dark:text-zinc-400',
    dot: 'bg-zinc-600 dark:bg-zinc-400',
  },
  HACKING: {
    label: 'Hacking Active',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    text: 'text-emerald-800 dark:text-emerald-400',
    dot: 'bg-emerald-700 dark:bg-emerald-400',
    pulse: true,
  },
  SUBMISSION: {
    label: 'Submissions Open',
    bg: 'bg-amber-500/10 border-amber-500/30',
    text: 'text-amber-800 dark:text-amber-400',
    dot: 'bg-amber-700 dark:bg-amber-400',
    pulse: true,
  },
  SUBMISSION_CLOSED: {
    label: 'Submissions Closed',
    bg: 'bg-rose-500/10 border-rose-500/30',
    text: 'text-rose-800 dark:text-rose-400',
    dot: 'bg-rose-700 dark:bg-rose-400',
  },
  JUDGING: {
    label: 'Judging Underway',
    bg: 'bg-purple-500/10 border-purple-500/30',
    text: 'text-purple-800 dark:text-purple-400',
    dot: 'bg-purple-700 dark:bg-purple-400',
    pulse: true,
  },
  RESULTS: {
    label: 'Results Phase',
    bg: 'bg-amber-400/15 border-amber-400/40',
    text: 'text-amber-800 dark:text-amber-300',
    dot: 'bg-amber-400',
    pulse: true,
  },
  ENDED: {
    label: 'Event Concluded',
    bg: 'bg-zinc-600/10 border-zinc-600/20',
    text: 'text-zinc-700 dark:text-zinc-500',
    dot: 'bg-zinc-600 dark:bg-zinc-500',
  },
  // Results Release states
  DRAFT: {
    label: 'Results: Draft',
    bg: 'bg-zinc-500/10 border-zinc-500/20',
    text: 'text-zinc-700 dark:text-zinc-400',
    dot: 'bg-zinc-600 dark:bg-zinc-400',
  },
  PUBLISHING: {
    label: 'Results: In Buffer',
    bg: 'bg-amber-500/15 border-amber-500/40',
    text: 'text-amber-800 dark:text-amber-400',
    dot: 'bg-amber-400',
    pulse: true,
  },
  PUBLISHED: {
    label: 'Results: Published',
    bg: 'bg-emerald-500/15 border-emerald-500/40',
    text: 'text-emerald-800 dark:text-emerald-400',
    dot: 'bg-emerald-400',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  pulse,
  className = '',
}) => {
  const config = PHASE_CONFIG[status] || {
    label: status.replace(/_/g, ' '),
    bg: 'bg-zinc-500/10 border-zinc-500/20',
    text: 'text-zinc-700 dark:text-zinc-400',
    dot: 'bg-zinc-400',
  };

  const shouldPulse = pulse !== undefined ? pulse : config.pulse;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border tracking-wide ${config.bg} ${config.text} ${className}`}
    >
      <span className="relative flex h-2 w-2">
        {shouldPulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dot}`}
          />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`}
        />
      </span>
      {config.label}
    </span>
  );
};

export default StatusBadge;
