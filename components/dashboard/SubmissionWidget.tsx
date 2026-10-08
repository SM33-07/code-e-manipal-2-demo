'use client';

import React from 'react';
import Link from 'next/link';
import {
  FileCode2,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ArrowRight,
  GitBranch,
  Video,
  FileText,
} from 'lucide-react';

interface SubmissionWidgetProps {
  hasTeam: boolean;
  submission: {
    id: string;
    title: string;
    summary?: string;
    category?: string;
    status: string;
    githubUrl?: string;
    demoUrl?: string;
    docsUrl?: string;
    demoVideoUrl?: string;
    submittedAt?: string;
    isLocked?: boolean;
  } | null;
}

export function SubmissionWidget({ hasTeam, submission }: SubmissionWidgetProps) {
  if (!hasTeam) {
    return (
      <div className="bg-card border border-dashed border-border/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full min-h-[300px] transition-all hover:border-primary/50 opacity-90">
        <div>
          <div className="size-12 rounded-xl bg-muted/30 border border-border/40 flex items-center justify-center text-muted-foreground mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">
            Submission Studio Locked
          </h3>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Project submissions are tied directly to hackathon teams. Form a new team or enter a team invite code to unlock the project submission studio.
          </p>
        </div>

        <div className="pt-4 border-t border-border/40">
          <Link
            href="/team"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-sm border border-border/50 transition-colors"
          >
            Go to Team Management →
          </Link>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="bg-card border border-border/70 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full min-h-[300px] transition-all hover:shadow-md">
        <div>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                Action Required
              </span>
              <h3 className="text-xl font-bold text-foreground tracking-tight mt-1">
                No Project Drafted Yet
              </h3>
            </div>
            <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FileCode2 className="w-5 h-5" />
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            Your team has not created a project submission yet. You can start drafting at any time, upload screenshots, attach your GitHub repository, and update your draft iteratively.
          </p>

          <div className="p-3.5 rounded-xl bg-secondary/50 border border-border/40 space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Drafts save automatically without locking</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Cloudinary-signed media uploads enabled</span>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-border/30">
          <Link
            href="/submit"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-95 transition-opacity"
          >
            Start Project Submission
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const isSubmitted = submission.status === 'SUBMITTED' || submission.status === 'LOCKED';
  const isFinalized = submission.isLocked || isSubmitted;

  return (
    <div className="bg-card border border-border/70 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full min-h-[300px] transition-all hover:shadow-md">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isFinalized
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                }`}
              >
                {isFinalized ? 'Submitted & Locked' : 'Draft In Progress'}
              </span>
              {submission.category && (
                <span className="text-xs text-muted-foreground">
                  {submission.category}
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold text-foreground tracking-tight truncate max-w-[280px]">
              {submission.title}
            </h3>
          </div>

          <div
            className={`size-9 rounded-xl flex items-center justify-center border ${
              isFinalized
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
            }`}
            title={isFinalized ? 'Finalization Lock Active' : 'Draft Editable'}
          >
            {isFinalized ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
          </div>
        </div>

        {submission.summary && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
            {submission.summary}
          </p>
        )}

        {/* Deliverables Checklist Grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="p-2.5 rounded-xl bg-secondary/50 border border-border/40 flex items-center gap-2 text-xs">
            <GitBranch className="w-4 h-4 text-primary shrink-0" />
            <div className="flex flex-col truncate">
              <span className="text-[10px] text-muted-foreground">Repository</span>
              <span className="font-medium text-foreground truncate">
                {submission.githubUrl ? 'Linked' : 'Missing'}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-secondary/50 border border-border/40 flex items-center gap-2 text-xs">
            <Video className="w-4 h-4 text-primary shrink-0" />
            <div className="flex flex-col truncate">
              <span className="text-[10px] text-muted-foreground">Demo Video</span>
              <span className="font-medium text-foreground truncate">
                {submission.demoVideoUrl ? 'Attached' : 'Optional'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {submission.submittedAt
            ? `Submitted ${new Date(submission.submittedAt).toLocaleDateString()}`
            : 'Draft saved to cloud'}
        </span>

        <Link
          href="/submit"
          className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:opacity-95 transition-opacity"
        >
          {isFinalized ? 'View Project' : 'Edit Submission'}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
