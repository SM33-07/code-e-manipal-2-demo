'use client';

import React from 'react';
import { Megaphone, AlertCircle, Info, Bell, Sparkles } from 'lucide-react';

interface Announcement {
  id?: string;
  title?: string;
  content: string;
  type?: string;
  created_at?: string;
}

interface AnnouncementsWidgetProps {
  announcement: Announcement | null;
}

export function AnnouncementsWidget({ announcement }: AnnouncementsWidgetProps) {
  if (!announcement) {
    return (
      <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm flex items-center gap-4">
        <div className="size-11 rounded-xl bg-muted/30 border border-border/30 flex items-center justify-center text-muted-foreground shrink-0">
          <Bell className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-foreground">
            No Active Broadcasts
          </h4>
          <p className="text-xs text-muted-foreground">
            All systems normal. Important announcements, mentor office hours, and deadline alerts will appear here in real time.
          </p>
        </div>
      </div>
    );
  }

  const isUrgent = announcement.type === 'urgent' || announcement.type === 'alert';

  return (
    <div
      className={`relative overflow-hidden bg-card border rounded-2xl p-6 shadow-sm transition-all ${
        isUrgent
          ? 'border-rose-500/40 bg-rose-500/5'
          : 'border-border/70 hover:border-primary/40'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`size-11 rounded-xl flex items-center justify-center shrink-0 border ${
            isUrgent
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-500'
              : 'bg-primary/10 border-primary/20 text-primary'
          }`}
        >
          {isUrgent ? <AlertCircle className="w-5 h-5" /> : <Megaphone className="w-5 h-5" />}
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isUrgent
                    ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                    : 'bg-primary/10 text-primary border-primary/20'
                }`}
              >
                {announcement.type || 'Announcement'}
              </span>
              {announcement.title && (
                <span className="text-sm font-bold text-foreground">
                  {announcement.title}
                </span>
              )}
            </div>

            {announcement.created_at && (
              <span className="text-[10px] text-muted-foreground">
                {new Date(announcement.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>

          <p className="text-sm text-foreground/90 leading-relaxed font-medium">
            {announcement.content}
          </p>
        </div>
      </div>
    </div>
  );
}
