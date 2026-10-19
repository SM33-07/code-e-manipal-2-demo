"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Award,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Search,
  Filter,
  ExternalLink,
  ChevronRight,
  Sliders,
  FileText,
  ShieldCheck,
  Check,
} from "lucide-react";
import { DemoRoleSwitcher } from "@/components/demo/DemoRoleSwitcher";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { DEMO_JUDGE_DATA, type DemoJudgeSubmissionItem } from "@/lib/demo/demoFixtures";

export default function DemoJudgePage() {
  const [data] = useState(DEMO_JUDGE_DATA);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<string>("all");

  const tracks = useMemo(() => {
    return Array.from(new Set(data.assignedSubmissions.map((s) => s.track)));
  }, [data.assignedSubmissions]);

  const filteredSubmissions = useMemo(() => {
    return data.assignedSubmissions.filter((sub) => {
      const matchesStatus =
        filterStatus === "all" ? true : sub.reviewStatus === filterStatus;
      const matchesSearch =
        searchQuery === ""
          ? true
          : sub.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sub.teamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sub.track.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTrack =
        selectedTrack === "all" ? true : sub.track === selectedTrack;

      return matchesStatus && matchesSearch && matchesTrack;
    });
  }, [data.assignedSubmissions, filterStatus, searchQuery, selectedTrack]);

  const totalAssigned = data.assignedSubmissions.length;
  const completedCount = data.assignedSubmissions.filter((s) => s.reviewStatus === "completed").length;
  const pendingCount = totalAssigned - completedCount;
  const progressPercent = Math.round((completedCount / totalAssigned) * 100);

  return (
    <div className="min-h-screen bg-transparent pb-24">
      <DemoRoleSwitcher currentRole="judge" />

      <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 space-y-8">
        {/* Welcome Header */}
        <div className="relative overflow-hidden rounded-2xl border border-border border-l-4 border-l-secondary bg-surface-elevated p-6 sm:p-8 shadow-sm">
          {/* Subtle architectural backdrop */}
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden opacity-18 dark:opacity-12 bg-cover bg-center bg-[url('/images/heritage/light/15-city-palace-hall-arches.webp')] dark:bg-[url('/images/heritage/dark/01-jantar-mantar-arch.webp')]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 pointer-events-none bg-gradient-to-r from-surface-elevated/96 via-surface-elevated/90 to-surface-elevated/75 dark:from-surface-elevated/98 dark:via-surface-elevated/92 dark:to-surface-elevated/80"
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-secondary/40 bg-secondary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-secondary">
                  <Award size={12} />
                  Jury Evaluation Workspace
                </span>
                <span className="text-muted-foreground text-xs font-mono">·</span>
                <span className="text-xs font-mono text-muted-foreground">
                  Badge: {data.judgeProfile.badgeId}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                Welcome back, {data.judgeProfile.name}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {data.judgeProfile.title} · {data.judgeProfile.organization}
              </p>
            </div>

            {/* Quick Stats Pill */}
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-border bg-surface/90 backdrop-blur-xs p-3 text-right shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">Evaluation Progress</p>
                <p className="text-lg font-black text-foreground">
                  {completedCount} <span className="text-xs font-normal text-muted-foreground">/ {totalAssigned} completed</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar & KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SpotlightCard className="p-4 rounded-xl border border-border bg-surface-elevated flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Assigned</p>
              <p className="text-2xl font-black text-foreground mt-0.5">{totalAssigned}</p>
            </div>
            <FileText size={24} className="text-secondary/60" />
          </SpotlightCard>

          <SpotlightCard className="p-4 rounded-xl border border-border bg-surface-elevated flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pending Evaluation</p>
              <p className="text-2xl font-black text-foreground mt-0.5">{pendingCount}</p>
            </div>
            <Clock size={24} className="text-primary/60" />
          </SpotlightCard>

          <SpotlightCard className="p-4 rounded-xl border border-border bg-surface-elevated flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Evaluated & Verified</p>
              <p className="text-2xl font-black text-emerald-400 mt-0.5">{completedCount}</p>
            </div>
            <CheckCircle2 size={24} className="text-emerald-400/60" />
          </SpotlightCard>
        </div>

        {/* Evaluation Queue & Filter Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface border border-border">
              <button
                type="button"
                onClick={() => setFilterStatus("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterStatus === "all"
                    ? "bg-secondary text-secondary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All Assigned ({totalAssigned})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("pending")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterStatus === "pending"
                    ? "bg-secondary text-secondary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("completed")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterStatus === "completed"
                    ? "bg-secondary text-secondary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Graded ({completedCount})
              </button>
            </div>

            {/* Search & Track Filters */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search project or team..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 pr-3 text-xs bg-surface border border-border rounded-xl text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-secondary transition-all w-48 sm:w-56"
                />
              </div>

              <select
                value={selectedTrack}
                onChange={(e) => setSelectedTrack(e.target.value)}
                className="h-9 px-3 text-xs bg-surface border border-border rounded-xl text-foreground outline-none focus:border-secondary cursor-pointer"
              >
                <option value="all">All Tracks</option>
                {tracks.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Submissions List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredSubmissions.map((sub) => {
              const isGraded = sub.reviewStatus === "completed";

              return (
                <SpotlightCard
                  key={sub.id}
                  className="rounded-2xl border border-border bg-surface-elevated p-6 flex flex-col justify-between space-y-4 hover:border-secondary/40 transition-all shadow-sm"
                >
                  <div className="space-y-3">
                    {/* Top Row: Track & Review Status Pill */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-secondary/15 border border-secondary/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary">
                        {sub.track}
                      </span>

                      {isGraded ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                          <CheckCircle2 size={11} />
                          Score: {sub.scores.total}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          <Clock size={11} />
                          Pending Evaluation
                        </span>
                      )}
                    </div>

                    {/* Title & Team */}
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug">
                        {sub.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                        Submitted by <span className="text-foreground font-semibold">{sub.teamName}</span>
                      </p>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {sub.summary}
                    </p>

                    {/* Rubric Breakdown Pill if graded */}
                    {isGraded && (
                      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/70 text-center font-mono">
                        <div className="p-1 rounded bg-surface border border-border/50 text-[10px]">
                          <span className="text-muted-foreground block text-[9px]">INNOV</span>
                          <span className="font-bold text-foreground">{sub.scores.innovation}</span>
                        </div>
                        <div className="p-1 rounded bg-surface border border-border/50 text-[10px]">
                          <span className="text-muted-foreground block text-[9px]">TECH</span>
                          <span className="font-bold text-foreground">{sub.scores.technical}</span>
                        </div>
                        <div className="p-1 rounded bg-surface border border-border/50 text-[10px]">
                          <span className="text-muted-foreground block text-[9px]">UI/UX</span>
                          <span className="font-bold text-foreground">{sub.scores.presentation}</span>
                        </div>
                        <div className="p-1 rounded bg-surface border border-border/50 text-[10px]">
                          <span className="text-muted-foreground block text-[9px]">IMPACT</span>
                          <span className="font-bold text-foreground">{sub.scores.impact}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom CTA */}
                  <div className="pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-[11px] font-mono text-muted-foreground">
                      Ref: {sub.problemStatementId}
                    </span>
                    <Link
                      href={`/demo/judge/evaluate/${sub.id}`}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                        isGraded
                          ? "border border-border bg-surface hover:bg-accent text-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/90"
                      }`}
                    >
                      <Sliders size={13} />
                      <span>{isGraded ? "Adjust Evaluation" : "Evaluate Rubric"}</span>
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                </SpotlightCard>
              );
            })}
          </div>

          {filteredSubmissions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
              <p className="text-sm font-semibold">No submissions match the selected filters.</p>
              <button
                type="button"
                onClick={() => {
                  setFilterStatus("all");
                  setSearchQuery("");
                  setSelectedTrack("all");
                }}
                className="mt-3 text-xs text-secondary hover:underline font-semibold"
              >
                Reset all filters
              </button>
            </div>
          )}
        </div>

        {/* Rubric Criteria Explanation Footer */}
        <section className="rounded-2xl border border-border bg-surface-elevated/70 p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Sliders size={16} className="text-secondary" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Official 4-Criteria Evaluation Rubric Standards
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {data.rubricCriteria.map((c) => (
              <div key={c.key} className="p-3 rounded-xl border border-border bg-surface/60 space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`font-bold ${c.color}`}>{c.title}</span>
                  <span className="font-mono font-bold text-[10px] text-muted-foreground">{c.weight}</span>
                </div>
                <p className="text-muted-foreground leading-relaxed text-[11px]">{c.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
