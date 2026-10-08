'use client';

import React, { useState, useEffect } from 'react';
import { Clock, ShieldAlert, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';
import { StatusBadge, EventPhase } from '@/components/ui/StatusBadge';

interface EventStatusBarProps {
  phase: EventPhase | string;
  startTime: string | null;
  endTime: string | null;
  bufferMinutes?: number;
  publishAt?: string | null;
}

const PHASES_ORDER: Array<{ phase: EventPhase; label: string; desc: string }> = [
  { phase: 'NOT_STARTED', label: 'Preparation', desc: 'Pre-event setup' },
  { phase: 'HACKING', label: 'Hacking Active', desc: 'Building phase' },
  { phase: 'SUBMISSION', label: 'Submissions Open', desc: 'Finalizing projects' },
  { phase: 'SUBMISSION_CLOSED', label: 'Buffer & Lock', desc: 'Grace buffer active' },
  { phase: 'JUDGING', label: 'Evaluation', desc: 'Judging panels active' },
  { phase: 'RESULTS', label: 'Ceremony', desc: 'Award reveal' },
  { phase: 'ENDED', label: 'Concluded', desc: 'Event archived' },
];

export function EventStatusBar({
  phase,
  startTime,
  endTime,
  bufferMinutes = 15,
  publishAt,
}: EventStatusBarProps) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: string;
    minutes: string;
    seconds: string;
    label: string;
  }>({ hours: '00', minutes: '00', seconds: '00', label: 'Status' });

  useEffect(() => {
    function calculateCountdown() {
      const now = Date.now();
      let targetTime: number | null = null;
      let label = 'Time Remaining';

      if (phase === 'NOT_STARTED' && startTime) {
        targetTime = new Date(startTime).getTime();
        label = 'Hacking Begins In';
      } else if ((phase === 'HACKING' || phase === 'SUBMISSION') && endTime) {
        targetTime = new Date(endTime).getTime();
        label = 'Deadline Countdown';
      } else if (phase === 'SUBMISSION_CLOSED' && endTime) {
        targetTime = new Date(endTime).getTime() + (bufferMinutes || 15) * 60 * 1000;
        label = 'Buffer Closes In';
      } else if (phase === 'RESULTS' && publishAt) {
        targetTime = new Date(publishAt).getTime();
        label = 'Ceremony Reveal In';
      }

      if (!targetTime) {
        if (phase === 'JUDGING') {
          setTimeLeft({ hours: '--', minutes: '--', seconds: '--', label: 'Judging In Progress' });
        } else if (phase === 'ENDED') {
          setTimeLeft({ hours: '00', minutes: '00', seconds: '00', label: 'Event Concluded' });
        } else {
          setTimeLeft({ hours: '--', minutes: '--', seconds: '--', label: 'Stand By' });
        }
        return;
      }

      const diff = Math.max(0, targetTime - now);
      const hours = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, '0');
      const minutes = String(Math.floor((diff / (1000 * 60)) % 60)).padStart(2, '0');
      const seconds = String(Math.floor((diff / 1000) % 60)).padStart(2, '0');

      setTimeLeft({ hours, minutes, seconds, label });
    }

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);
    return () => clearInterval(interval);
  }, [phase, startTime, endTime, bufferMinutes, publishAt]);

  const currentIdx = PHASES_ORDER.findIndex((p) => p.phase === phase);

  return (
    <div className="w-full bg-card border border-border/70 rounded-2xl p-5 shadow-sm transition-all duration-300">
      {/* Top Bar: Active Status & Countdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <StatusBadge status={phase} variant="phase" pulse />
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Phase {currentIdx >= 0 ? `${currentIdx + 1} of 7` : 'Active'}
          </span>
        </div>

        {/* Live Timer Dock */}
        <div className="flex items-center gap-3 bg-secondary/80 px-4 py-2 rounded-xl border border-border/40">
          <Clock className="w-4 h-4 text-primary animate-pulse" />
          <div className="flex flex-col items-start sm:items-end">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {timeLeft.label}
            </span>
            <div className="flex items-center gap-1 font-mono text-base sm:text-lg font-bold text-foreground">
              <span>{timeLeft.hours}</span>
              <span className="text-primary animate-pulse">:</span>
              <span>{timeLeft.minutes}</span>
              <span className="text-primary animate-pulse">:</span>
              <span>{timeLeft.seconds}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 7-Step Hackathon Progression Bar */}
      <div className="mt-4 pt-1">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {PHASES_ORDER.map((item, idx) => {
            const isCompleted = currentIdx > idx;
            const isCurrent = currentIdx === idx;
            const isUpcoming = currentIdx < idx;

            return (
              <div
                key={item.phase}
                className={`relative flex flex-col p-2.5 rounded-xl border transition-all duration-200 ${
                  isCurrent
                    ? 'bg-primary/10 border-primary/40 shadow-sm shadow-primary/5'
                    : isCompleted
                    ? 'bg-secondary/40 border-border/30 opacity-80'
                    : 'bg-muted/10 border-border/20 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground">
                    0{idx + 1}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : isCurrent ? (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                  ) : null}
                </div>
                <span
                  className={`text-xs font-semibold truncate ${
                    isCurrent ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {item.label}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {item.desc}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
