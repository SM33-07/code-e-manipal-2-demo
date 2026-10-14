import Link from "next/link";
import { Metadata } from "next";
import { Calendar, Clock, Lock, Unlock, QrCode, Sparkles, Layers, BookOpen, AlertCircle } from "lucide-react";
import { getPublicProblemStatements } from "@/services/problemStatementService";
import { ProblemStatementsAdminControls } from "./ProblemStatementsAdminControls";
import { ProblemStatementsList } from "./ProblemStatementsList";

export const revalidate = 60; // 60s ISR caching, revalidated automatically upon admin publication

export const metadata: Metadata = {
  title: "Problem Statements — Code-e-Manipal 2.0",
  description: "Official shortlist of 35 challenge briefs across 9 tracks for Code-e-Manipal 2.0. Explore requirements, evaluation criteria, and deliverables.",
};

export default async function ProblemStatementsPage() {
  const { isPublished, release, statements, tracks } = await getPublicProblemStatements();
  const showContent = isPublished && statements.length > 0;
  const trackCount = tracks.length;
  const challengeCount = statements.length;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-10">
      {/* Admin Quick Action Controls */}
      <ProblemStatementsAdminControls published={isPublished} />

      {/* Page Header */}
      <header className="relative overflow-hidden rounded-3xl border border-border bg-card/90 p-6 sm:p-10 shadow-sm">
        {/* Subtle decorative background accent */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-secondary/5 blur-3xl" />

        <div className="relative max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-secondary">
            {showContent ? <Unlock size={13} className="text-secondary" /> : <Lock size={13} className="text-secondary" />}
            {showContent
              ? `OFFICIAL RELEASE V${release?.version || 2} · LIVE`
              : "LOCKED · AWAITING PUBLICATION"}
          </div>

          <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-5xl font-serif">
            Problem Statements
          </h1>

          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {showContent
              ? `The official Code-e-Manipal 2.0 challenge briefs are live (${release?.label || 'Final Event Release'}). Review technical constraints, evaluation protocols, and deliverables across all 9 competition tracks.`
              : "Problem statements will be available shortly. Official challenge briefs will be released by the organizers in accordance with the canonical event timeline."}
          </p>

          {/* Quick Metrics & QR Destination Pill */}
          {showContent && (
            <div className="flex flex-wrap items-center gap-2 pt-2 sm:gap-3">
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                <Sparkles size={13} />
                <span>{challengeCount} Challenges</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-secondary/30 bg-secondary/10 px-3 py-1.5 text-xs font-bold text-secondary">
                <Layers size={13} />
                <span>{trackCount} Official Tracks</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground">
                <QrCode size={13} className="text-primary shrink-0" />
                <span>Auditorium QR: <code className="font-mono text-foreground font-semibold">/problem-statements</code></span>
              </div>
            </div>
          )}
        </div>

        {/* Participant Guidance Notice */}
        {showContent && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-secondary/30 bg-secondary/5 p-4 text-xs text-secondary-foreground/90">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-secondary" />
            <div className="space-y-1">
              <p className="font-bold text-foreground">Participant Selection Notice</p>
              <p className="leading-relaxed text-muted-foreground">
                Review the complete problem statement, implementation guidance, and deliverables before selecting a challenge. Each card provides a concise overview; click any card or &quot;View Full Brief&quot; to inspect all technical constraints and evaluation tests.
              </p>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      {showContent ? (
        <section className="space-y-6">
          <ProblemStatementsList statements={statements} tracks={tracks} />
        </section>
      ) : (
        /* Neutral Holding Page — Never leaks draft titles or held items */
        <section className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/15 text-secondary">
            <Lock size={32} />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-foreground font-serif">
            Problem Statements Will Be Available Shortly
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            The challenge repository is sealed. Official problem statements will be released by the organizers in accordance with the canonical event timeline.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/timeline"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
            >
              <Calendar size={14} />
              View Event Timeline
            </Link>
            <span className="inline-flex items-center gap-2 rounded-xl bg-secondary/15 px-4 py-2 text-xs font-bold text-secondary">
              <Clock size={14} />
              Authoritative Schedule: 15 October 2026
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
