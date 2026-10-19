"use client";

import React from "react";
import Link from "next/link";
import {
  Users,
  Award,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Lock,
  Database,
  Cpu,
  Layers,
  FileCode2,
  Sliders,
  History,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { DemoRoleSwitcher } from "@/components/demo/DemoRoleSwitcher";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { SpecularButton } from "@/components/ui/SpecularButton";

export default function DemoHubPage() {
  const roleCards = [
    {
      id: "participant",
      title: "Participant Demo",
      roleLabel: "Team Leader / Builder",
      badge: "Team Workspace",
      color: "border-primary",
      accentBg: "bg-primary/10",
      accentText: "text-primary",
      bgClass: "bg-[url('/images/heritage/light/03-city-palace-courtyard.webp')] dark:bg-[url('/images/heritage/dark/04-nahargarh-sunset-city.webp')]",
      href: "/demo/participant",
      icon: Users,
      description:
        "Step into the shoes of Team 39 (NeuralPulse). Inspect selected technical challenge briefs, submitted code repositories, live demo links, and sprint milestones.",
      highlights: [
        "Synthetic team info & invite code copy simulation",
        "Selected Problem Statement (PS 05: ArcSense)",
        "Submitted project artifacts (GitHub, Demo, Video, Docs)",
        "Chronological hackathon sprint milestones",
        "Safe mutation blocking with explanatory notices",
      ],
      sampleData: "Team NeuralPulse · PS 05 · AI/ML Track",
    },
    {
      id: "judge",
      title: "Judge Demo",
      roleLabel: "Jury Panelist / Evaluator",
      badge: "Rubric Scoring Simulator",
      color: "border-secondary",
      accentBg: "bg-secondary/10",
      accentText: "text-secondary",
      bgClass: "bg-[url('/images/heritage/light/15-city-palace-hall-arches.webp')] dark:bg-[url('/images/heritage/dark/01-jantar-mantar-arch.webp')]",
      href: "/demo/judge",
      icon: Award,
      description:
        "Experience the official jury grading console as Dr. Sarah Jenkins. Filter assigned submissions, test rubric sliders, and simulate live score calculation.",
      highlights: [
        "Assigned evaluation queue across 4 technical tracks",
        "4-criteria rubric: Innovation 30%, Tech 30%, UI 20%, Impact 20%",
        "Live interactive weighted score recalculation",
        "Client-side feedback notes and review history",
        "Zero backend persistence · isolated React state",
      ],
      sampleData: "Dr. Sarah Jenkins · 4 Assigned Submissions",
    },
    {
      id: "admin",
      title: "Admin Demo",
      roleLabel: "Operations Center / Lead",
      badge: "Operations Console",
      color: "border-jaipur-pink",
      accentBg: "bg-jaipur-pink/10",
      accentText: "text-jaipur-pink",
      bgClass: "bg-[url('/images/heritage/light/04-city-palace-exterior.webp')] dark:bg-[url('/images/heritage/dark/09-albert-hall-night.webp')]",
      href: "/demo/admin",
      icon: ShieldAlert,
      description:
        "Take command of the hackathon operations snapshot. Search user rosters, inspect team dossiers, preview judge allocations, and browse audit logs.",
      highlights: [
        "Real-time event metrics (86 teams, 78 submissions, 74 reviewed)",
        "Interactive User & Role roster with role filtering",
        "Teams & Submissions table with detail inspection modals",
        "Judge Allocation Matrix with completion progress bars",
        "12 chronological system & security audit logs",
      ],
      sampleData: "Event Snapshot · 86 Teams · 342 Users",
    },
  ];

  return (
    <div className="min-h-screen bg-transparent pb-20">
      <DemoRoleSwitcher currentRole="hub" />

      <main className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14 space-y-16">
        {/* Header Hero */}
        <section className="relative text-center max-w-3xl mx-auto space-y-5 py-8 px-6 sm:px-10 rounded-3xl border border-border bg-surface-elevated shadow-sm overflow-hidden">
          {/* Subtle architectural atmosphere veil */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-12 bg-cover bg-center bg-[url('/images/heritage/light/01-hawa-mahal-landscape.webp')] dark:bg-[url('/images/heritage/dark/08-pink-city-night.webp')]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 pointer-events-none bg-gradient-to-b from-surface-elevated/96 via-surface-elevated/90 to-surface-elevated/85 dark:from-surface-elevated/98 dark:via-surface-elevated/94 dark:to-surface-elevated/90"
            aria-hidden="true"
          />

          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <Sparkles size={14} className="animate-pulse" />
              <span>Interactive Portfolio Showcase</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
              Explore the <span className="text-primary">Portal Demo</span>
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Experience the authentic Participant, Judge, and Administrator dashboards used during the Code-e-Manipal 36-hour hackathon. Test real workflows, scoring rubrics, and operational consoles in a safe, synthetic sandbox.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <CheckCircle2 size={14} className="text-emerald-400" />
                No Registration or Password Required
              </span>
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <CheckCircle2 size={14} className="text-emerald-400" />
                Zero Database Connections
              </span>
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <CheckCircle2 size={14} className="text-emerald-400" />
                100% Synthetic Isolated Fixtures
              </span>
            </div>
          </div>
        </section>

        {/* 3 Role Choices Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {roleCards.map((card) => {
            const Icon = card.icon;
            return (
              <SpotlightCard
                key={card.id}
                className={`relative flex flex-col justify-between rounded-2xl border-2 ${card.color} bg-surface-elevated p-6 sm:p-7 shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-xl overflow-hidden`}
              >
                {/* Subtle top architectural accent watermark */}
                <div
                  className="absolute inset-x-0 top-0 h-36 pointer-events-none overflow-hidden opacity-18 dark:opacity-12"
                  aria-hidden="true"
                >
                  <div className={`absolute inset-0 bg-cover bg-center ${card.bgClass}`} />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface-elevated/70 to-surface-elevated" />
                </div>

                <div className="relative z-10 space-y-5">
                  {/* Top Bar with Icon & Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className={`p-3 rounded-xl ${card.accentBg} ${card.accentText} border border-border/40 shadow-xs`}>
                      <Icon size={24} />
                    </div>
                    <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                      {card.badge}
                    </span>
                  </div>

                  {/* Role Title & Description */}
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {card.roleLabel}
                    </span>
                    <h2 className="text-2xl font-black text-foreground tracking-tight mt-0.5">
                      {card.title}
                    </h2>
                    <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">
                      {card.description}
                    </p>
                  </div>

                  {/* Highlights List */}
                  <div className="space-y-2 border-t border-border pt-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                      Included Workflows:
                    </p>
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      {card.highlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Card Footer & Action */}
                <div className="mt-6 pt-4 border-t border-border space-y-3">
                  <div className="text-[11px] font-mono text-muted-foreground truncate">
                    <span className="text-foreground font-semibold">Fixture: </span>
                    {card.sampleData}
                  </div>
                  <Link
                    href={card.href}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition-all hover:bg-primary/90 shadow-sm"
                  >
                    <span>Launch {card.title}</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </SpotlightCard>
            );
          })}
        </section>

        {/* Security & Architectural Isolation Card */}
        <section className="rounded-2xl border border-border bg-surface-elevated/80 p-6 sm:p-8 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-border pb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Security, Isolation & Production Invariance Guarantees
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Engineered to showcase genuine portal functionality without compromising production integrity.
                </p>
              </div>
            </div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-mono font-medium text-emerald-300 shrink-0">
              FAIL-CLOSED GUARD ACTIVE
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Database size={15} className="text-primary" />
                <span>Zero Database Queries</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Demo routes strictly consume sanitized in-memory TypeScript fixtures. Production Azure PostgreSQL and Supabase connections are completely bypassed.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Lock size={15} className="text-secondary" />
                <span>Write-Blocking Enforced</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Server-side middleware strictly blocks state-changing requests (POST, PUT, PATCH, DELETE) with 403 Forbidden across all authenticated endpoints.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Sliders size={15} className="text-jaipur-pink" />
                <span>Client-Side Simulations</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Interactive features like rubric sliders and search filters operate purely in local React state. No changes persist or alter backend state.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Layers size={15} className="text-primary" />
                <span>True Component Reuse</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Reuses the actual production dashboard layouts, tables, scoring algorithms, and typography rather than superficial non-functional mockups.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
