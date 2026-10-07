'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import {
  Award,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  RefreshCw,
  AlertCircle,
  FileText,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface JudgeSubmission {
  id: string;
  title: string;
  description: string;
  judged: boolean;
}

export function JudgeDashboardOverview() {
  const router = useRouter();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<JudgeSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssignments = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/judging/assignments');
      if (!res.ok) throw new Error('Failed to load assignments');
      const json = await res.json();
      const data = Array.isArray(json.data) ? json.data : [];

      const mapped: JudgeSubmission[] = data.map((a: any, idx: number) => {
        const sub = a.submissions ?? {};
        const label = `Project ${String.fromCharCode(65 + idx)}`;
        return {
          id: sub.id ?? a.submission_id,
          title: label,
          description: sub.description ?? sub.summary ?? '',
          judged: a.reviewed ?? false,
        };
      });

      setSubmissions(mapped);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching judge assignments:', err);
      setError(err.message || 'Unable to fetch assigned submissions');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  const totalAssigned = submissions.length;
  const completedCount = submissions.filter((s) => s.judged).length;
  const pendingCount = totalAssigned - completedCount;
  const progressPercent = totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;
  const nextPending = submissions.find((s) => !s.judged);

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Judge';

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              Judge Evaluation Workspace
            </span>
            <span className="text-xs text-muted-foreground">&bull;</span>
            <span className="text-xs font-mono text-muted-foreground">
              {user?.email || 'JUDGE-EVALUATOR'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Welcome back, {displayName}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Review your assigned submissions, evaluate technical rubrics, and record feedback.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadAssignments(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent hover:bg-muted border border-border text-foreground text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            title="Sync evaluation assignments"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Syncing...' : 'Sync Queue'}
          </button>

          <Link
            href="/judge"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors shadow-sm"
          >
            <span>Evaluation Console</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Assigned</span>
            <Award className="w-4 h-4 text-secondary" />
          </div>
          <div className="text-3xl font-extrabold text-foreground font-mono">
            {loading ? '-' : totalAssigned}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Submissions allocated</p>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-success" />
          </div>
          <div className="text-3xl font-extrabold text-success font-mono">
            {loading ? '-' : completedCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Rubrics submitted</p>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending</span>
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div className="text-3xl font-extrabold text-warning font-mono">
            {loading ? '-' : pendingCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Awaiting evaluation</p>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Progress</span>
            <SlidersHorizontal className="w-4 h-4 text-primary" />
          </div>
          <div className="text-3xl font-extrabold text-primary font-mono">
            {loading ? '-' : `${progressPercent}%`}
          </div>
          <div className="w-full bg-accent/60 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content Grid: Evaluation Queue + Guidance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Next Up & Queue */}
        <div className="lg:col-span-2 space-y-6">
          {/* Next Up Spotlight */}
          {nextPending ? (
            <div className="p-6 rounded-2xl border border-secondary/30 bg-secondary/10 shadow-sm relative overflow-hidden">
              <div className="flex items-center gap-2 text-secondary text-xs font-bold uppercase tracking-wider mb-2">
                <Sparkles size={14} />
                <span>Next Project in Your Queue</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-1">
                {nextPending.title}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                {nextPending.description || 'No detailed summary provided. Open evaluation rubric to review code, links, and presentation.'}
              </p>
              <Link
                href={`/judge/evaluate/${nextPending.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors shadow-sm"
              >
                <span>Evaluate This Project</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : totalAssigned > 0 ? (
            <div className="p-6 rounded-2xl border border-success/30 bg-success/10 text-center">
              <CheckCircle2 size={36} className="text-success mx-auto mb-2" />
              <h3 className="text-lg font-bold text-foreground">All Assigned Submissions Evaluated!</h3>
              <p className="text-xs text-muted-foreground mt-1">
                You have completed rubrics for all assigned teams. You can review scores or check the leaderboard in the console.
              </p>
              <Link
                href="/judge"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-foreground font-semibold text-xs hover:bg-accent"
              >
                <span>View Evaluation Leaderboard</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : null}

          {/* Assigned Submissions Table/List */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-foreground">Assigned Submissions</h3>
              <Link
                href="/judge"
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <span>Open Full Queue</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
                Loading assigned evaluations...
              </div>
            ) : submissions.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No submissions assigned yet. Check back when organizers distribute evaluation rounds.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {submissions.slice(0, 6).map((sub) => (
                  <div key={sub.id} className="py-3.5 flex items-center justify-between gap-4 group">
                    <Link href={`/judge/evaluate/${sub.id}`} className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {sub.title}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate max-w-sm mt-0.5">
                        {sub.description || 'Evaluation assignment'}
                      </p>
                    </Link>
                    <div className="flex items-center gap-3 shrink-0">
                      {sub.judged ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-success/15 text-success text-[10px] font-bold uppercase tracking-wider border border-success/30">
                          Evaluated
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-warning/15 text-warning text-[10px] font-bold uppercase tracking-wider border border-warning/30">
                          Pending
                        </span>
                      )}
                      <Link
                        href={`/judge/evaluate/${sub.id}`}
                        className="p-2 rounded-lg bg-accent/60 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                        title="Evaluate Project"
                      >
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Scoring Criteria & Resources */}
        <div className="space-y-6">
          {/* Scoring Rubric Summary */}
          <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <FileText size={16} className="text-secondary" />
              <span>Judging Criteria Breakdown</span>
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="font-semibold text-foreground">Innovation & Creativity</span>
                <span className="font-mono font-bold text-primary">30%</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="font-semibold text-foreground">Technical Execution & Code</span>
                <span className="font-mono font-bold text-primary">30%</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="font-semibold text-foreground">Presentation & Demo</span>
                <span className="font-mono font-bold text-primary">20%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-foreground">Impact & Feasibility</span>
                <span className="font-mono font-bold text-primary">20%</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground pt-2">
              All criteria are scored from 1 to 10. The scoring engine automatically calculates weighted aggregates.
            </p>
          </div>

          {/* Quick Links */}
          <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Workspace Shortcuts
            </h3>
            <div className="flex flex-col gap-2">
              <Link
                href="/guidelines"
                className="flex items-center justify-between p-2.5 rounded-xl border border-border hover:bg-accent text-xs font-semibold text-foreground transition-colors"
              >
                <span>Judging Rules & Guidelines</span>
                <ChevronRight size={14} className="text-muted-foreground" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
