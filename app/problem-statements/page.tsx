import Link from "next/link";
import { Calendar, Clock, Lock, Unlock } from "lucide-react";
import { pool } from "@/lib/db";
import { ProblemStatementsAdminControls } from "./ProblemStatementsAdminControls";
import { ProblemStatementsList, ProblemStatementItem } from "./ProblemStatementsList";

export const revalidate = 60; // 60s ISR caching, revalidated automatically on admin publish

async function getProblemStatementsData() {
  try {
    const { rows: configRows } = await pool.query(`
      SELECT problem_statements_published, problem_selection_start, problem_selection_end
      FROM public.event_config
      WHERE id = 1;
    `);

    const isPublished = configRows.length > 0 ? configRows[0].problem_statements_published : false;
    const selectionStart = configRows[0]?.problem_selection_start;
    const selectionEnd = configRows[0]?.problem_selection_end;

    if (!isPublished) {
      return { isPublished: false, selectionStart, selectionEnd, statements: [], tracks: [] };
    }

    const { rows: statements } = await pool.query(`
      SELECT id, title, track, description, requirements, deliverables,
             constraints, attachment_url, attachment_name, display_order
      FROM public.problem_statements
      WHERE is_published = true
      ORDER BY display_order ASC, id ASC;
    `);

    const tracks = Array.from(new Set(statements.map((s) => s.track))).filter(Boolean);

    return {
      isPublished: true,
      selectionStart,
      selectionEnd,
      statements: statements as ProblemStatementItem[],
      tracks,
    };
  } catch (err) {
    console.error("Error fetching problem statements:", err);
    return { isPublished: false, selectionStart: null, selectionEnd: null, statements: [], tracks: [] };
  }
}

export default async function ProblemStatementsPage() {
  const { isPublished, statements, tracks } = await getProblemStatementsData();
  const showContent = isPublished && statements.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-4 sm:px-6 sm:py-8">
      {/* Admin Quick Action Controls */}
      <ProblemStatementsAdminControls published={isPublished} />

      {/* Page Header */}
      <header className="surface-panel border-y border-border bg-surface-elevated/90 px-5 py-8 sm:px-10 sm:py-12 rounded-3xl">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 border-b border-secondary/50 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-secondary">
            {showContent ? <Unlock size={13} /> : <Lock size={13} />}
            {showContent ? "PROBLEM STATEMENTS LIVE" : "LOCKED · AWAITING PUBLICATION"}
          </div>

          <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-6xl">
            Problem Statements
          </h1>

          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {showContent
              ? "The official Code-e-Manipal 2.0 problem statements are live. Review the challenge briefs, deliverables, and guidelines."
              : "Coming Soon. Official problem statements will be released by the organizers on 15 October 2026."}
          </p>
        </div>
      </header>

      {/* Main Content Area */}
      {showContent ? (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">
              Official Challenge Briefs
            </h2>
            <span className="rounded-full border border-secondary/30 bg-secondary/15 px-3 py-1 text-xs font-bold text-secondary">
              {statements.length} Active Challenges
            </span>
          </div>

          <ProblemStatementsList statements={statements} tracks={tracks} />
        </section>
      ) : (
        /* Sealed Vault / Awaiting Publication State */
        <section className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/15 text-secondary">
            <Lock size={32} />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-foreground">Awaiting Official Publication</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            The challenge vault is sealed. Check the event timeline and return when the organizers release the official briefs at 12:45 PM on 15 October 2026.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/timeline"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
            >
              <Calendar size={14} />
              View Timeline
            </Link>
            <span className="inline-flex items-center gap-2 rounded-xl bg-secondary/15 px-4 py-2 text-xs font-bold text-secondary">
              <Clock size={14} />
              Release Window: 12:45 PM &ndash; 4:00 PM
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
