"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Users,
  Copy,
  Check,
  CheckCircle2,
  ExternalLink,
  Github,
  Globe,
  Video,
  FileText,
  Clock,
  ShieldCheck,
  AlertCircle,
  Lock,
  ArrowRight,
  Sparkles,
  BookOpen,
  Calendar,
  Radio,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { DemoRoleSwitcher } from "@/components/demo/DemoRoleSwitcher";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { DEMO_PARTICIPANT_SUMMARY } from "@/lib/demo/demoFixtures";

export default function DemoParticipantPage() {
  const [data] = useState(DEMO_PARTICIPANT_SUMMARY);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showEditNotice, setShowEditNotice] = useState(false);

  const handleCopyInviteCode = () => {
    if (!data.team.inviteCode) return;
    navigator.clipboard.writeText(data.team.inviteCode);
    setCopiedCode(true);
    toast.success("Team invite code copied to clipboard! (Synthetic Simulation)");
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleBlockedAction = (actionName: string) => {
    toast.error(`Demo Mode: ${actionName} is disabled in this public read-only showcase.`);
  };

  return (
    <div className="min-h-screen bg-transparent pb-24">
      <DemoRoleSwitcher currentRole="participant" />

      <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 space-y-8">
        {/* Welcome Header */}
        <div className="relative overflow-hidden rounded-2xl border border-border border-l-4 border-l-primary bg-surface-elevated p-6 sm:p-8 shadow-sm">
          {/* Subtle architectural backdrop */}
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 dark:opacity-14 bg-cover bg-center bg-[url('/images/heritage/light/03-city-palace-courtyard.webp')] dark:bg-[url('/images/heritage/dark/04-nahargarh-sunset-city.webp')]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 pointer-events-none bg-gradient-to-r from-surface-elevated/96 via-surface-elevated/90 to-surface-elevated/75 dark:from-surface-elevated/98 dark:via-surface-elevated/92 dark:to-surface-elevated/80"
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                  <Users size={12} />
                  Participant Dashboard
                </span>
                <span className="text-muted-foreground text-xs font-mono">·</span>
                <span className="text-xs font-mono text-muted-foreground">
                  ID: {data.profile.identifier}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                Welcome back, {data.profile.name}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Team Leader of <span className="font-semibold text-foreground">{data.team.name}</span> · Track:{" "}
                <span className="font-semibold text-foreground">{data.team.track}</span>
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                <CheckCircle2 size={14} />
                Grand Finale Concluded
              </span>
              <Link
                href="/results"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors shadow-xs"
              >
                <span>View Leaderboard</span>
                <ExternalLink size={13} />
              </Link>
            </div>
          </div>
        </div>

        {/* Top Announcements Banner */}
        {data.announcements.length > 0 && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-emerald-200">
                    {data.announcements[0].title}
                  </h3>
                  <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-300 px-2 py-0.2 rounded-full">
                    Official Notice
                  </span>
                </div>
                <p className="text-xs text-emerald-300/90 leading-relaxed">
                  {data.announcements[0].content}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Grid: Left Column (Submission & Challenge) + Right Column (Team & Schedule) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column (2 Cols on lg) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Project Submission Card */}
            <SpotlightCard className="rounded-2xl border border-border bg-surface-elevated p-6 sm:p-7 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-secondary">
                      <CheckCircle2 size={13} />
                      Final Project Submission
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">·</span>
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      {data.submission.status}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                    {data.submission.title}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => handleBlockedAction("Submission Modification")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                >
                  <Lock size={12} />
                  <span>Edit Submission (Locked)</span>
                </button>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {data.submission.summary}
              </p>

              {/* Submitted Artifacts Grid */}
              <div className="space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                  Submitted Project Artifacts:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href={data.submission.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 text-xs font-semibold text-foreground hover:border-primary/50 hover:bg-accent transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Github size={16} className="text-primary" />
                      <div>
                        <p className="font-bold">Source Code Repository</p>
                        <p className="text-[10px] text-muted-foreground font-mono">GitHub · Public Repo</p>
                      </div>
                    </div>
                    <ExternalLink size={13} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  </a>

                  <a
                    href={data.submission.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 text-xs font-semibold text-foreground hover:border-secondary/50 hover:bg-accent transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Globe size={16} className="text-secondary" />
                      <div>
                        <p className="font-bold">Live Cloud Deployment</p>
                        <p className="text-[10px] text-muted-foreground font-mono">Web Prototype Interface</p>
                      </div>
                    </div>
                    <ExternalLink size={13} className="text-muted-foreground group-hover:text-secondary transition-colors" />
                  </a>

                  <a
                    href={data.submission.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 text-xs font-semibold text-foreground hover:border-jaipur-pink/50 hover:bg-accent transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText size={16} className="text-jaipur-pink" />
                      <div>
                        <p className="font-bold">System Architecture Docs</p>
                        <p className="text-[10px] text-muted-foreground font-mono">API & Hardware Schematics</p>
                      </div>
                    </div>
                    <ExternalLink size={13} className="text-muted-foreground group-hover:text-jaipur-pink transition-colors" />
                  </a>

                  <a
                    href={data.submission.demoVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 text-xs font-semibold text-foreground hover:border-jaipur-terracotta/50 hover:bg-accent transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Video size={16} className="text-jaipur-terracotta" />
                      <div>
                        <p className="font-bold">Demonstration Video</p>
                        <p className="text-[10px] text-muted-foreground font-mono">3-Minute Technical Walkthrough</p>
                      </div>
                    </div>
                    <ExternalLink size={13} className="text-muted-foreground group-hover:text-jaipur-terracotta transition-colors" />
                  </a>
                </div>
              </div>

              {/* Read-Only Notice Box */}
              <div className="rounded-xl border border-border/80 bg-surface/60 p-3 text-[11px] text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock size={12} className="text-muted-foreground" />
                  Submitted at Oct 15, 2026 · Immutable snapshot
                </span>
                <span className="font-mono text-emerald-400">Status: Verified for Jury Review</span>
              </div>
            </SpotlightCard>

            {/* Selected Challenge Card */}
            <SpotlightCard className="rounded-2xl border border-border bg-surface-elevated p-6 sm:p-7 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                      Selected Challenge Brief
                    </span>
                    <span className="text-muted-foreground text-xs">·</span>
                    <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono font-bold text-foreground">
                      {data.selectedProblemStatement.id}
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-foreground mt-1">
                    {data.selectedProblemStatement.title}
                  </h3>
                </div>

                <Link
                  href="/problem-statements"
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  <span>Browse 35 Challenges</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <p className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Scope & Problem Context</p>
                  <p className="mt-1 text-muted-foreground leading-relaxed">{data.selectedProblemStatement.scopeNote}</p>
                </div>

                <div>
                  <p className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Minimum Deliverable</p>
                  <p className="mt-1 text-muted-foreground leading-relaxed">{data.selectedProblemStatement.deliverables}</p>
                </div>

                <div>
                  <p className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Evaluation Criteria & Tests</p>
                  <p className="mt-1 text-muted-foreground leading-relaxed">{data.selectedProblemStatement.evaluationTests}</p>
                </div>
              </div>
            </SpotlightCard>
          </div>

          {/* Right Column: Team Roster & Sprint Milestones */}
          <div className="space-y-8">
            {/* Team Roster Card */}
            <SpotlightCard className="rounded-2xl border border-border bg-surface-elevated p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-primary" />
                  <h3 className="text-base font-bold text-foreground">Team Roster</h3>
                </div>
                <span className="text-xs font-mono text-muted-foreground">4/4 Members</span>
              </div>

              {/* Team Invite Code */}
              <div className="rounded-xl border border-border bg-surface p-3 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground font-semibold">Team Invite Code:</span>
                  <span className="text-[10px] font-mono text-primary">Single-Use Code</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-foreground tracking-wider">
                    {data.team.inviteCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyInviteCode}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-elevated px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-accent transition-colors cursor-pointer"
                  >
                    {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedCode ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>

              {/* Members List */}
              <div className="space-y-2">
                {data.team.members.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-surface/50 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-[11px] text-primary shrink-0">
                        {member.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{member.name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground truncate">{member.email}</p>
                      </div>
                    </div>
                    {member.role === "lead" ? (
                      <span className="rounded bg-primary/15 border border-primary/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary shrink-0">
                        Lead
                      </span>
                    ) : (
                      <span className="rounded bg-surface px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground shrink-0">
                        Member
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Disabled Team Management Actions */}
              <div className="pt-2 border-t border-border flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleBlockedAction("Team Invitation Creation")}
                  className="w-full text-center py-2 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                >
                  + Add Member (Demo: Read-Only)
                </button>
              </div>
            </SpotlightCard>

            {/* Event Sprint Milestones */}
            <SpotlightCard className="rounded-2xl border border-border bg-surface-elevated p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-secondary" />
                  <h3 className="text-base font-bold text-foreground">Sprint Milestones</h3>
                </div>
                <Link href="/timeline" className="text-xs text-secondary hover:underline font-semibold">
                  Full Schedule →
                </Link>
              </div>

              <div className="space-y-3">
                {data.milestones.map((m, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-xs">
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-foreground">{m.title}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{m.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SpotlightCard>
          </div>
        </div>
      </main>
    </div>
  );
}
