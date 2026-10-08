import React from 'react';

export function EventStatusBarSkeleton() {
  return (
    <div className="w-full bg-card border border-border/50 rounded-2xl p-5 shadow-sm animate-pulse mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-28 h-8 bg-muted/60 rounded-full" />
          <div className="w-40 h-5 bg-muted/50 rounded-md" />
        </div>
        <div className="flex items-center gap-4">
          <div className="w-24 h-4 bg-muted/40 rounded" />
          <div className="w-32 h-9 bg-muted/60 rounded-xl" />
        </div>
      </div>
      <div className="mt-5 pt-4 border-t border-border/40 flex items-center justify-between gap-2 overflow-x-hidden">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full h-1.5 bg-muted/50 rounded-full" />
            <div className="w-12 h-3 bg-muted/40 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamCardSkeleton() {
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm animate-pulse flex flex-col justify-between h-full min-h-[280px]">
      <div>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="w-36 h-6 bg-muted/70 rounded-md mb-2" />
            <div className="w-20 h-4 bg-muted/40 rounded" />
          </div>
          <div className="w-24 h-7 bg-muted/50 rounded-lg" />
        </div>
        <div className="w-full h-12 bg-muted/40 rounded-xl mb-5" />
        <div className="space-y-3">
          <div className="w-28 h-4 bg-muted/40 rounded" />
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-muted/60" />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 pt-4 border-t border-border/30 flex items-center justify-between">
        <div className="w-24 h-4 bg-muted/40 rounded" />
        <div className="w-28 h-9 bg-muted/60 rounded-lg" />
      </div>
    </div>
  );
}

export function SubmissionWidgetSkeleton() {
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm animate-pulse flex flex-col justify-between h-full min-h-[280px]">
      <div>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="w-40 h-6 bg-muted/70 rounded-md mb-2" />
            <div className="w-28 h-4 bg-muted/40 rounded" />
          </div>
          <div className="w-24 h-7 bg-muted/50 rounded-lg" />
        </div>
        <div className="space-y-2 mb-5">
          <div className="w-full h-4 bg-muted/50 rounded" />
          <div className="w-3/4 h-4 bg-muted/40 rounded" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 bg-muted/40 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="mt-6 pt-4 border-t border-border/30 flex items-center justify-between">
        <div className="w-32 h-4 bg-muted/40 rounded" />
        <div className="w-32 h-9 bg-muted/60 rounded-lg" />
      </div>
    </div>
  );
}

export function AnnouncementsWidgetSkeleton() {
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="w-36 h-6 bg-muted/70 rounded-md" />
        <div className="w-16 h-5 bg-muted/40 rounded" />
      </div>
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="p-3 bg-muted/30 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-20 h-4 bg-muted/60 rounded" />
              <div className="w-16 h-3 bg-muted/40 rounded" />
            </div>
            <div className="w-full h-4 bg-muted/50 rounded" />
            <div className="w-4/5 h-4 bg-muted/40 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function QuickLinksSkeleton() {
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm animate-pulse">
      <div className="w-32 h-6 bg-muted/70 rounded-md mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-muted/30 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <EventStatusBarSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TeamCardSkeleton />
        <SubmissionWidgetSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AnnouncementsWidgetSkeleton />
        </div>
        <div>
          <QuickLinksSkeleton />
        </div>
      </div>
    </div>
  );
}
