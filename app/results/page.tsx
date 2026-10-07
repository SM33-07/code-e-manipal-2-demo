"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Trophy,
  Award,
  Medal,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Lock,
  Loader2,
  AlertCircle
} from "lucide-react";
import { BorderGlow } from "@/components/ui/BorderGlow";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

interface RankedResult {
  id: string;
  title: string;
  summary: string;
  category: string;
  team_id: string;
  team_name: string;
  computed: {
    total_score: number;
    rank: number;
    avg_innovation: number;
    avg_technical: number;
    avg_presentation: number;
    avg_impact: number;
  };
}

export default function ResultsPage() {
  const [loading, setLoading] = useState(true);
  const [isPublished, setIsPublished] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string>("false");
  const [publishTime, setPublishTime] = useState<string | null>(null);
  const [results, setResults] = useState<RankedResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  useEffect(() => {
    let isMounted = true;
    async function fetchResults() {
      try {
        setLoading(true);
        const res = await fetch("/api/results/public", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Unable to retrieve public results.");
        }
        const json = await res.json();
        if (!isMounted) return;

        if (json.meta && json.meta.published) {
          setIsPublished(true);
          setResults(json.data || []);
        } else {
          setIsPublished(false);
          setPublishStatus(json.meta?.status || "false");
          setPublishTime(json.meta?.publish_time || null);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || "An unexpected error occurred.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchResults();
    return () => {
      isMounted = false;
    };
  }, []);

  const categories = ["ALL", ...Array.from(new Set(results.map((r) => r.category).filter(Boolean)))];

  const filteredResults =
    categoryFilter === "ALL"
      ? results
      : results.filter((r) => r.category === categoryFilter);

  const topThree = filteredResults.filter((r) => r.computed.rank <= 3).sort((a, b) => a.computed.rank - b.computed.rank);

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-6 sm:py-10 px-4 sm:px-6">
      {/* ── Ceremonial Header ── */}
      <header className="surface-panel relative overflow-hidden border-y border-border bg-surface-elevated/90 p-5 sm:p-9 text-left">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 border-b border-secondary/50 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-secondary">
              {isPublished ? <Trophy size={14} className="text-secondary" /> : <Lock size={14} />}
              <span>{isPublished ? "OFFICIAL AWARDS ANNOUNCEMENT" : "RESULTS CEREMONY EMBARGO"}</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-foreground">
              Official Results
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              {isPublished
                ? "Verified standings from the Grand Finale of Code-e-Manipal 2.0. Scores are cryptographically sealed by event evaluators."
                : "The official hackathon standings have not yet been released. Results will be published following the ceremonial adjudication."}
            </p>
          </div>

          {/* Status Badge Box */}
          <div className="min-w-[220px] shrink-0 border-l-2 border-primary bg-background/70 p-4 text-left sm:text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-secondary uppercase tracking-wider mb-1">
              <Calendar size={14} />
              <span>Release Status</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-foreground">
              {isPublished ? "Declared Live" : publishStatus === "publishing" ? "Ceremony Live" : "Pending Release"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {isPublished
                ? `${results.length} Finalists Ranked`
                : publishTime
                ? `Expected: ${new Date(publishTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : "Grand Finale Ceremony"}
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-center gap-1.5 text-[11px] font-semibold text-primary">
              <ShieldCheck size={13} />
              <span>Audited Standings</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Content Body ── */}
      {loading ? (
        <div className="rounded-3xl border border-border bg-card p-12 text-center shadow-sm space-y-3">
          <Loader2 size={32} className="animate-spin text-primary mx-auto" />
          <p className="text-sm font-semibold text-foreground">Checking results publication state...</p>
          <p className="text-xs text-muted-foreground">Connecting to the authoritative results snapshot</p>
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-8 text-center space-y-3">
          <AlertCircle size={28} className="text-destructive mx-auto" />
          <h2 className="text-base font-bold text-foreground">Unable to Load Standings</h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
        </div>
      ) : !isPublished ? (
        /* ── Sealed / Embargoed State ── */
        <div className="rounded-3xl border border-border bg-card p-8 sm:p-12 text-center shadow-sm space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-secondary/15 border border-secondary/30 flex items-center justify-center text-secondary">
            <Lock size={30} />
          </div>
          <div className="space-y-2 max-w-xl mx-auto">
            <h2 className="text-2xl font-bold text-foreground">
              {publishStatus === "publishing" ? "Scores In Final Review" : "Results Embargoed"}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {publishStatus === "publishing"
                ? "The evaluation jury is finalizing aggregate scores. The official rankings will unlock automatically upon ceremonial announcement."
                : "Final evaluations and audit cross-verification are currently underway. Standings will become visible to all participants and judges simultaneously."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto pt-4 text-left">
            <div className="rounded-xl border border-border bg-card p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">Phase 01</span>
              <h3 className="text-sm font-bold text-foreground mt-1">Jury Review</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Independent multi-criteria evaluations</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">Phase 02</span>
              <h3 className="text-sm font-bold text-foreground mt-1">Audit Lock</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Cryptographic integrity check</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">Phase 03</span>
              <h3 className="text-sm font-bold text-foreground mt-1">Live Reveal</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Simultaneous public declaration</p>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="px-5 py-2.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-accent transition-colors"
            >
              Return to Workspace
            </Link>
            <Link
              href="/timeline"
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span>View Ceremony Schedule</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      ) : results.length === 0 ? (
        /* ── Published but Empty State ── */
        <div className="rounded-3xl border border-border bg-card p-12 text-center shadow-sm space-y-4">
          <Trophy size={36} className="text-secondary mx-auto" />
          <h2 className="text-xl font-bold text-foreground">No Published Entries</h2>
          <p className="text-sm text-muted-foreground">The results release contains no finalized submissions.</p>
        </div>
      ) : (
        /* ── Full Ceremonial Results Reveal ── */
        <div className="space-y-8">
          {/* Top 3 Podium (if at least 3 results exist) */}
          {topThree.length >= 3 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-secondary" />
                <h2 className="text-lg font-bold text-foreground uppercase tracking-wider text-xs">
                  Honorary Podium &bull; Grand Champions
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* 2nd Place */}
                <SpotlightCard className="order-2 md:order-1 p-6 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-400/30 text-xs font-bold">
                        <Medal size={14} />
                        <span>1st Runner Up</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-muted-foreground">RANK #2</span>
                    </div>
                    <h3 className="text-lg font-bold text-foreground">{topThree[1].title}</h3>
                    <p className="text-xs text-secondary font-bold uppercase tracking-wider">{topThree[1].team_name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{topThree[1].summary}</p>
                  </div>
                  <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Category: {topThree[1].category || "General"}</span>
                    <span className="font-mono font-bold text-foreground text-sm">{topThree[1].computed.total_score} pts</span>
                  </div>
                </SpotlightCard>

                {/* 1st Place (Grand Champion) */}
                <div className="order-1 md:order-2">
                  <BorderGlow active={true}>
                    <div className="p-6 sm:p-7 flex flex-col justify-between relative bg-card">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground text-[10px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full shadow-sm">
                        Grand Champion
                      </div>
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/20 text-secondary border border-secondary/30 text-xs font-bold">
                            <Trophy size={14} />
                            <span>Winner</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-secondary">RANK #1</span>
                        </div>
                        <h3 className="text-xl font-black text-foreground">{topThree[0].title}</h3>
                        <p className="text-xs text-primary font-bold uppercase tracking-wider">{topThree[0].team_name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{topThree[0].summary}</p>
                      </div>
                      <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Category: {topThree[0].category || "General"}</span>
                        <span className="font-mono font-black text-primary text-base">{topThree[0].computed.total_score} pts</span>
                      </div>
                    </div>
                  </BorderGlow>
                </div>

                {/* 3rd Place */}
                <SpotlightCard className="order-3 p-6 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-600/10 text-amber-700 dark:text-amber-400 border border-amber-600/30 text-xs font-bold">
                        <Award size={14} />
                        <span>2nd Runner Up</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-muted-foreground">RANK #3</span>
                    </div>
                    <h3 className="text-lg font-bold text-foreground">{topThree[2].title}</h3>
                    <p className="text-xs text-secondary font-bold uppercase tracking-wider">{topThree[2].team_name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{topThree[2].summary}</p>
                  </div>
                  <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Category: {topThree[2].category || "General"}</span>
                    <span className="font-mono font-bold text-foreground text-sm">{topThree[2].computed.total_score} pts</span>
                  </div>
                </SpotlightCard>
              </div>
            </section>
          )}

          {/* ── Complete Standings Table ── */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground">Complete Final Standings</h2>
                <p className="text-xs text-muted-foreground">Official adjudicated leaderboard for all ranked submissions.</p>
              </div>

              {/* Category Filter */}
              {categories.length > 2 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        categoryFilter === cat
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-accent/20 text-muted-foreground uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4 font-bold">Rank</th>
                      <th className="py-3 px-4 font-bold">Project &bull; Team</th>
                      <th className="py-3 px-4 font-bold">Track</th>
                      <th className="py-3 px-4 font-bold text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredResults.map((item) => (
                      <tr key={item.id} className="hover:bg-accent/10 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                          {item.computed.rank === 1 ? (
                            <span className="inline-flex items-center gap-1 text-secondary font-black">
                              <Trophy size={14} /> #1
                            </span>
                          ) : item.computed.rank === 2 ? (
                            <span className="inline-flex items-center gap-1 text-slate-500 font-bold">
                              <Medal size={14} /> #2
                            </span>
                          ) : item.computed.rank === 3 ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                              <Award size={14} /> #3
                            </span>
                          ) : (
                            `#${item.computed.rank}`
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-foreground">{item.title}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{item.team_name}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-secondary/10 border border-secondary/20 text-secondary text-[11px] font-semibold">
                            {item.category || "General"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-foreground text-sm">
                          {item.computed.total_score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-border text-xs">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          ← Return to Workspace
        </Link>
      </div>
    </div>
  );
}
