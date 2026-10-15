import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  Code,
  Cpu,
  Compass,
  Workflow,
  Layers,
  Activity,
  Landmark,
  ShieldCheck,
  Sparkles,
  Network,
  Gamepad2,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  FileCheck,
  ListChecks,
  ShieldAlert,
  ChevronRight,
  Info,
} from "lucide-react";
import { getPublicProblemStatementBySlugOrId } from "@/services/problemStatementService";
import { ProblemDetailActions } from "./ProblemDetailActions";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

function getTrackIcon(track: string) {
  const t = track.toLowerCase();
  if (t.includes('earth') || t.includes('ai/ml')) return Activity;
  if (t.includes('health')) return Activity;
  if (t.includes('fintech') || t.includes('edtech') || t.includes('legal')) return Landmark;
  if (t.includes('cyber')) return ShieldCheck;
  if (t.includes('generative') || t.includes('llm')) return Sparkles;
  if (t.includes('multi-agent') || t.includes('logistics')) return Network;
  if (t.includes('gaming')) return Gamepad2;
  if (t.includes('smart city') || t.includes('infrastructure')) return Building2;
  if (t.includes('hardware')) return Cpu;
  return Layers;
}

function getBuildTypeIcon(buildType: string) {
  const b = buildType.toLowerCase();
  if (b.includes('hardware')) return Cpu;
  if (b.includes('geospatial')) return Compass;
  if (b.includes('simulation')) return Workflow;
  return Code;
}

function cleanBullet(text: string): string {
  return text.replace(/^[•\-\*\s]+/, '').trim();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicProblemStatementBySlugOrId(slug);

  if (!result) {
    return {
      title: "Problem Statement Not Found — Code-e-Manipal 2.0",
    };
  }

  const { statement } = result;
  return {
    title: `${statement.id}: ${statement.title} — Code-e-Manipal 2.0`,
    description: statement.problem_statement.slice(0, 160),
  };
}

export default async function ProblemStatementDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getPublicProblemStatementBySlugOrId(slug);

  if (!result) {
    notFound();
  }

  const { statement, previousProblem, nextProblem } = result;
  const TrackIcon = getTrackIcon(statement.track);
  const BuildIcon = getBuildTypeIcon(statement.build_type);

  // Extract description bullets
  const descriptionBullets: string[] =
    Array.isArray(statement.description_bullets) && statement.description_bullets.length > 0
      ? statement.description_bullets.map(cleanBullet).filter(Boolean)
      : (statement.description_implementation || '')
          .split('\n')
          .map(cleanBullet)
          .filter((l) => l.length > 0);

  // Extract deliverables bullets
  const deliverablesBullets: string[] =
    Array.isArray(statement.deliverables_bullets) && statement.deliverables_bullets.length > 0
      ? statement.deliverables_bullets.map(cleanBullet).filter(Boolean)
      : (statement.deliverables || '')
          .split('\n')
          .map(cleanBullet)
          .filter((l) => l.length > 0);

  // Identify safety or scope limitation sentences
  const allText = `${statement.problem_statement} ${statement.description_implementation || ''} ${statement.deliverables || ''} ${statement.scope_note || ''}`;
  const safetyKeywords = [
    'not required',
    'prohibited',
    'do not use',
    'without requiring',
    'real welding equipment',
    'live payment',
    'live utility',
    'real clinical',
    'covert surveillance',
    'real personal financial data',
  ];
  const hasSafetyNotice = safetyKeywords.some((k) => allText.toLowerCase().includes(k));

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-10">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/problem-statements"
          className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Problem Statements</span>
        </Link>

        <ProblemDetailActions id={statement.id} title={statement.title} />
      </div>

      {/* Hero Header Card */}
      <header className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-sm space-y-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />

        {/* Metadata Badges */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* PS ID */}
          <span className="inline-flex items-center rounded-xl border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-mono font-black text-primary">
            {statement.id}
          </span>

          {/* Track Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-secondary/30 bg-secondary/10 px-3 py-1.5 text-xs font-bold text-secondary">
            <TrackIcon size={13} className="shrink-0" />
            <span>{statement.track_num} &middot; {statement.track}</span>
          </div>

          {/* Build Type Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/80">
            <BuildIcon size={13} className="text-secondary shrink-0" />
            <span>{statement.build_type}</span>
          </div>

          {/* Official SIH Tag if applicable */}
          {statement.is_official_sih && (
            <span className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
              Official SIH Statement
            </span>
          )}
        </div>

        {/* Challenge Official Title */}
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-4xl font-black text-foreground tracking-tight leading-tight font-serif">
            {statement.title}
          </h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            Code-e-Manipal 2.0 Official Challenge Brief
          </p>
        </div>

        {/* Problem Statement Hero Callout */}
        <div className="relative rounded-2xl border-l-4 border-l-primary border-y border-r border-border bg-surface-elevated/70 p-5 sm:p-6 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <FileCheck size={14} />
            <span>Official Problem Statement</span>
          </div>
          <p className="text-sm sm:text-base leading-relaxed text-foreground font-medium">
            {statement.problem_statement}
          </p>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="space-y-8">
        {/* Section 1: Description & Implementation Guidance */}
        <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <h2 className="text-lg sm:text-xl font-bold text-foreground font-serif flex items-center gap-2">
              <Cpu size={18} className="text-primary" />
              <span>Description &amp; Implementation Guidance</span>
            </h2>
            <span className="text-xs font-mono text-muted-foreground">
              {descriptionBullets.length} Core Requirements
            </span>
          </div>

          {descriptionBullets.length > 0 ? (
            <ul className="space-y-3.5">
              {descriptionBullets.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-foreground/90 leading-relaxed">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    {idx + 1}
                  </span>
                  <div className="flex-1 pt-0.5">
                    {bullet}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
              {statement.description_implementation}
            </p>
          )}
        </section>

        {/* Section 2: Deliverables */}
        <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <h2 className="text-lg sm:text-xl font-bold text-foreground font-serif flex items-center gap-2">
              <ListChecks size={18} className="text-secondary" />
              <span>Required Deliverables</span>
            </h2>
            <span className="text-xs font-mono text-muted-foreground">
              {deliverablesBullets.length} Deliverable Items
            </span>
          </div>

          <div className="space-y-3">
            {deliverablesBullets.map((bullet, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-2xl border border-border/80 bg-surface p-4 text-xs sm:text-sm text-foreground leading-relaxed shadow-xs"
              >
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-secondary">
                  <CheckCircle2 size={14} />
                </div>
                <div className="flex-1">
                  {bullet}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Technical Evaluation & Differentiators (if distinct from main text) */}
        {(statement.evaluation_tests && statement.evaluation_tests !== statement.implementation_challenge && statement.evaluation_tests !== statement.description_implementation) ||
         (statement.stretch_differentiator && statement.stretch_differentiator !== statement.evaluation_tests) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {statement.evaluation_tests && statement.evaluation_tests !== statement.implementation_challenge && (
              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 font-serif">
                  <AlertTriangle size={15} className="text-primary" />
                  <span>Evaluation &amp; Failure Tests</span>
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed text-foreground/90">
                  {statement.evaluation_tests}
                </p>
              </div>
            )}

            {statement.stretch_differentiator && statement.stretch_differentiator !== statement.evaluation_tests && (
              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 font-serif">
                  <Lightbulb size={15} className="text-secondary" />
                  <span>Stretch &amp; Differentiator</span>
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed text-foreground/90">
                  {statement.stretch_differentiator}
                </p>
              </div>
            )}
          </div>
        ) : null}

        {/* Section 4: Public Sector Relevance (if present) */}
        {statement.suggested_public_sector_relevance && (
          <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 font-serif">
              <Building2 size={16} className="text-secondary" />
              <span>Suggested Public-Sector Relevance</span>
            </h3>
            <p className="text-xs sm:text-sm leading-relaxed text-foreground/90">
              {statement.suggested_public_sector_relevance}
            </p>
          </section>
        )}

        {/* Section 5: Scope & Safety Notes */}
        {statement.scope_note && (
          <section className="rounded-2xl border border-secondary/30 bg-secondary/5 p-4 sm:p-5 flex items-start gap-3 text-xs leading-relaxed text-muted-foreground">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-secondary" />
            <div className="space-y-1">
              <span className="font-bold text-foreground">Official Scope &amp; Safety Note</span>
              <p>{statement.scope_note}</p>
            </div>
          </section>
        )}

        {/* Linear Pagination Navigation */}
        <nav className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-6 border-t border-border/80">
          {previousProblem ? (
            <Link
              href={`/problem-statements/${previousProblem.slug}`}
              className="flex-1 rounded-2xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all text-left space-y-1 group"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors">
                <ArrowLeft size={12} />
                <span>Previous Challenge</span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-foreground line-clamp-1">
                <span className="font-mono text-primary mr-1.5">{previousProblem.id}:</span>
                {previousProblem.title}
              </p>
            </Link>
          ) : (
            <div className="flex-1" />
          )}

          <Link
            href="/problem-statements"
            className="self-center px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            All Challenges
          </Link>

          {nextProblem ? (
            <Link
              href={`/problem-statements/${nextProblem.slug}`}
              className="flex-1 rounded-2xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all text-right space-y-1 group"
            >
              <div className="flex items-center justify-end gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors">
                <span>Next Challenge</span>
                <ArrowRight size={12} />
              </div>
              <p className="text-xs sm:text-sm font-bold text-foreground line-clamp-1">
                <span className="font-mono text-primary mr-1.5">{nextProblem.id}:</span>
                {nextProblem.title}
              </p>
            </Link>
          ) : (
            <div className="flex-1" />
          )}
        </nav>
      </div>
    </div>
  );
}
