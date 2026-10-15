import Link from "next/link";
import { Metadata } from "next";
import { Sparkles, Layers, QrCode, AlertCircle, AlertTriangle, Clock } from "lucide-react";
import { getPublicProblemStatements } from "@/services/problemStatementService";
import { ProblemStatementsList } from "./ProblemStatementsList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Problem Statements — Code-e-Manipal 2.0",
  description: "Official shortlist of 35 challenge briefs across 9 tracks for Code-e-Manipal 2.0. Explore requirements, evaluation criteria, and deliverables.",
};

export default async function ProblemStatementsPage() {
  let isPublished = false;
  let release: any = null;
  let statements: any[] = [];
  let tracks: string[] = [];
  let fetchFailed = false;

  try {
    const data = await getPublicProblemStatements();
    isPublished = data.isPublished;
    release = data.release;
    statements = data.statements;
    tracks = data.tracks;
  } catch (err) {
    console.error("Failed to load problem statements in page:", err);
    fetchFailed = true;
  }

  const showContent = isPublished && statements.length > 0;
  const trackCount = tracks.length;
  const challengeCount = statements.length;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-10">
      {/* Page Header */}
      <header className="relative overflow-hidden rounded-3xl border border-border bg-card/90 p-6 sm:p-10 shadow-sm">
        {/* Subtle decorative background accent */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-secondary/5 blur-3xl" />

        <div className="relative max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-secondary">
            {showContent
              ? `OFFICIAL RELEASE V${release?.version || 2} · LIVE`
              : 'CATALOGUE RELEASE · SCHEDULED'}
          </div>

          <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-5xl font-serif">
            Problem Statements
          </h1>

          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {showContent
              ? `The official Code-e-Manipal 2.0 challenge briefs are live (${release?.label || 'Final Event Release'}). Review technical constraints, evaluation protocols, and deliverables across all 9 competition tracks.`
              : 'The official Code-e-Manipal 2.0 challenge briefs are scheduled for release by the organizing committee. Review technical constraints, evaluation protocols, and deliverables across all 9 competition tracks once officially unlocked.'}
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
      ) : fetchFailed ? (
        <section className="rounded-3xl border border-destructive/30 bg-card p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
            <AlertTriangle size={32} />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-foreground font-serif">
            Unable to Load Problem Statements
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            A temporary connection issue prevented loading the challenge catalogue. Please refresh this page or contact technical support if the issue persists.
          </p>
        </section>
      ) : (
        <section className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/15 text-secondary">
            <Clock size={32} />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-foreground font-serif">
            Problem Statements Scheduled for Release
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            The official problem statement catalogue is scheduled for publication by the event committee. All 35 challenge briefs across 9 competition tracks will be unlocked here at the designated competition release time.
          </p>
        </section>
      )}
    </div>
  );
}
