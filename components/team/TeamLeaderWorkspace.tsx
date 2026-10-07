"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  Users,
  Shield,
  Copy,
  Check,
  Clock,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Github,
  Globe,
  Video,
  FileCheck,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Lock,
  Unlock,
  Radio,
  Share2,
} from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  name: string;
  email: string;
  role: "leader" | "member";
  joinedAt: string;
}

interface TeamData {
  id: string;
  name: string;
  leaderName: string;
  leaderEmail: string;
  track: string;
  inviteCode: string;
  isLocked: boolean;
  members: Member[];
  deadlineExtension?: string | null;
}

export function TeamLeaderWorkspace() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<TeamData | null>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [eventConfig, setEventConfig] = useState<any>(null);
  const [announcement, setAnnouncement] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadAllTeamContext();
  }, []);

  const loadAllTeamContext = async () => {
    setLoading(true);
    try {
      const [teamRes, subRes, cfgRes, annRes] = await Promise.all([
        fetch("/api/teams"),
        fetch("/api/submissions"),
        fetch("/api/event-config"),
        fetch("/api/announcements"),
      ]);

      if (teamRes.ok) {
        const teamJson = await teamRes.json();
        const t = teamJson.data;
        if (t) {
          const members: Member[] = (t.team_members || []).map((m: any) => ({
            id: m.user_id || m.id,
            name: m.profiles?.name || m.name || (m.role === "leader" ? t.leader_name || "Leader" : "Team Member"),
            email: m.profiles?.email || m.email || "",
            role: m.role === "leader" ? "leader" : "member",
            joinedAt: m.joined_at || new Date().toISOString(),
          }));

          setTeam({
            id: t.id,
            name: t.name || "Code-e-Manipal Team",
            leaderName: t.leader_name || (user?.email?.split("@")[0] ?? "Leader"),
            leaderEmail: user?.email || "",
            track: t.track || "AI & Intelligent Systems",
            inviteCode: t.invite_code || "CM2026",
            isLocked: t.is_locked || false,
            members,
            deadlineExtension: t.deadline_extension,
          });
        }
      }

      if (subRes.ok) {
        const subJson = await subRes.json();
        const s = Array.isArray(subJson.data) ? subJson.data[0] : subJson.data;
        setSubmission(s || null);
      }

      if (cfgRes.ok) {
        const cfgJson = await cfgRes.json();
        setEventConfig(cfgJson.data || null);
      }

      if (annRes.ok) {
        const annJson = await annRes.json();
        setAnnouncement(annJson.data || null);
      }
    } catch (err) {
      console.error("Failed to load team workspace context:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!team?.inviteCode) return;
    navigator.clipboard.writeText(team.inviteCode);
    setCopied(true);
    toast.success("Team invite code copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center animate-pulse">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 mx-auto mb-4 flex items-center justify-center text-primary">
          <Users size={24} />
        </div>
        <h2 className="text-lg font-bold text-foreground">Loading Team Command Center...</h2>
        <p className="text-xs text-muted-foreground mt-1">Retrieving team roster, submission status, and event phase.</p>
      </div>
    );
  }

  // Fallback if team data isn't provisioned yet
  const teamInfo = team || {
    id: "TEAM-001",
    name: "Hackathon Squad",
    leaderName: user?.email?.split("@")[0] || "Team Leader",
    leaderEmail: user?.email || "leader@code-e-manipal.org",
    track: "AI & Intelligent Systems",
    inviteCode: "CEM-2026-ALPHA",
    isLocked: false,
    members: [
      {
        id: "1",
        name: user?.email?.split("@")[0] || "Team Leader",
        email: user?.email || "leader@code-e-manipal.org",
        role: "leader" as const,
        joinedAt: new Date().toISOString(),
      },
    ],
  };

  const submissionState = submission?.is_finalized
    ? "finalized"
    : submission?.id
    ? "draft"
    : "not_started";

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-4 pb-16 sm:px-6">
      {/* 1. Command Center Hero & Identity */}
      <div className="relative overflow-hidden border-y border-border bg-surface-elevated p-5 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Shield size={13} />
                Team Leader Command Center
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-secondary/15 border border-secondary/30 text-secondary text-xs font-mono font-bold">
                {teamInfo.id.startsWith("TEAM-") ? teamInfo.id : `ID: ${teamInfo.id.slice(0, 8)}`}
              </span>
              {teamInfo.isLocked ? (
                <span className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold flex items-center gap-1 border border-border">
                  <Lock size={12} /> Locked Roster
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-success/15 text-success border border-success/30 text-xs font-semibold flex items-center gap-1">
                  <Unlock size={12} /> Active Roster
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-foreground tracking-tight">
              {teamInfo.name}
            </h1>

            <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
              <span>Domain Track: <strong className="text-foreground">{teamInfo.track}</strong></span>
              <span>&bull;</span>
              <span>Leader: <strong className="text-foreground">{teamInfo.leaderName}</strong></span>
            </p>
          </div>

          {/* Quick Invite Code & Share Box */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="px-4 py-2.5 rounded-2xl bg-accent/50 border border-border flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Team Invite Code
                </div>
                <div className="font-mono text-sm font-bold text-foreground">
                  {teamInfo.inviteCode}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="p-2 rounded-xl bg-card border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all cursor-pointer shadow-xs"
                title="Copy Invite Code"
              >
                {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
              </button>
            </div>

            <Link
              href="/submit"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-xs sm:text-sm shadow-md hover:bg-primary/90 transition-all cursor-pointer active:scale-98"
            >
              <span>{submissionState === "finalized" ? "View Submission" : "Submission Portal"}</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>

        {/* Live Announcement Banner if exists */}
        {announcement && (
          <div className="mt-6 pt-5 border-t border-border flex items-center gap-3 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
            <span className="font-semibold text-foreground uppercase tracking-wider text-[11px]">Notice:</span>
            <span className="truncate">{announcement.content}</span>
          </div>
        )}
      </div>

      {/* 2. Top Metric Cards: Status, Phase, Roster */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Phase Card */}
        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Event Phase</span>
            <Clock size={16} className="text-secondary" />
          </div>
          <div className="text-lg font-bold text-foreground">
            Phase 1: Hacking
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            36-Hour coding & prototyping window active.
          </p>
        </div>

        {/* Submission State Card */}
        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Project State</span>
            <FileCheck size={16} className="text-primary" />
          </div>
          <div>
            {submissionState === "finalized" ? (
              <span className="inline-flex items-center gap-1.5 text-success font-bold text-base">
                <CheckCircle2 size={16} /> Finalized
              </span>
            ) : submissionState === "draft" ? (
              <span className="inline-flex items-center gap-1.5 text-warning font-bold text-base">
                <Sparkles size={16} /> Draft in Progress
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground font-bold text-base">
                <AlertCircle size={16} /> Not Started
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {submissionState === "finalized"
              ? "Locked and ready for jury evaluation."
              : "Complete all fields prior to deadline."}
          </p>
        </div>

        {/* Team Members Card */}
        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Team Capacity</span>
            <Users size={16} className="text-secondary" />
          </div>
          <div className="text-xl font-black font-mono text-foreground">
            {teamInfo.members.length} <span className="text-xs font-normal text-muted-foreground">/ 6 Members</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {teamInfo.members.length >= 6 ? "Team is at full limit." : "Slots available for collaborators."}
          </p>
        </div>

        {/* Next Action Card */}
        <div className="p-5 rounded-2xl border border-secondary/30 bg-secondary/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Next Step</span>
            <Sparkles size={16} />
          </div>
          <div className="text-sm font-bold text-foreground">
            {submissionState === "finalized"
              ? "Prepare Demo Pitch"
              : submissionState === "draft"
              ? "Finalize Project Submission"
              : "Review Problem Statements"}
          </div>
          <Link
            href={submissionState === "not_started" ? "/problem-statements" : "/submit"}
            className="text-[11px] font-semibold text-secondary hover:underline inline-flex items-center gap-1 mt-1"
          >
            <span>Proceed now</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* 3. Main Workspace: Team Roster & Submission Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Team Roster (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Users size={18} className="text-primary" />
                  Official Team Roster
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Authorized participants assigned to this team workspace.
                </p>
              </div>
              <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-accent text-accent-foreground border border-border">
                {teamInfo.members.length} Members
              </span>
            </div>

            <div className="divide-y divide-border/60">
              {teamInfo.members.map((member, idx) => (
                <div key={member.id || idx} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-accent text-foreground font-bold text-xs flex items-center justify-center border border-border shrink-0">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{member.name}</span>
                        {member.role === "leader" && (
                          <span className="px-2 py-0.2 rounded bg-secondary/15 text-secondary border border-secondary/30 text-[10px] font-bold uppercase tracking-wider">
                            Leader
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{member.email || "Registered Student"}</span>
                    </div>
                  </div>

                  <span className="text-xs text-muted-foreground font-mono hidden sm:inline-block">
                    Verified
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Submission Details & Material Links */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <FileCheck size={18} className="text-primary" />
                  Submission Workspace Status
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Track repository links, deployment URLs, and required artifacts.
                </p>
              </div>

              <Link
                href="/submit"
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <span>Edit Submission</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            {submission ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground">{submission.title || "Untitled Project"}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {submission.description || "No project overview written yet."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-2">
                  {submission.github_url ? (
                    <a
                      href={submission.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent text-accent-foreground border border-border text-xs font-semibold hover:border-secondary"
                    >
                      <Github size={14} />
                      <span>Repository Linked</span>
                      <ExternalLink size={11} className="opacity-70" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-muted-foreground text-xs font-medium border border-border">
                      <AlertCircle size={14} /> No GitHub URL
                    </span>
                  )}

                  {submission.demo_url ? (
                    <a
                      href={submission.demo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent text-accent-foreground border border-border text-xs font-semibold hover:border-secondary"
                    >
                      <Globe size={14} />
                      <span>Live Demo Linked</span>
                      <ExternalLink size={11} className="opacity-70" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-muted-foreground text-xs font-medium border border-border">
                      <AlertCircle size={14} /> No Live URL
                    </span>
                  )}

                  {submission.video_url ? (
                    <a
                      href={submission.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent text-accent-foreground border border-border text-xs font-semibold hover:border-secondary"
                    >
                      <Video size={14} />
                      <span>Pitch Video Linked</span>
                      <ExternalLink size={11} className="opacity-70" />
                    </a>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-muted-foreground">
                  Your team has not created a submission draft yet.
                </p>
                <Link
                  href="/submit"
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 shadow-sm"
                >
                  <span>Start Submission Draft</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right: Upcoming Timeline & Resources */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
              <Calendar size={16} className="text-secondary" />
              Key Team Milestones
            </h3>

            <div className="space-y-4">
              <div className="relative pl-6 pb-4 border-l-2 border-primary/40 last:border-0 last:pb-0">
                <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-primary" />
                <div className="text-xs font-bold text-foreground">Phase 1: Code-e-Manipal Kickoff</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">15 Oct 2026, 09:00 AM</div>
                <span className="inline-block mt-1 text-[10px] font-bold uppercase text-success">Completed</span>
              </div>

              <div className="relative pl-6 pb-4 border-l-2 border-secondary/40 last:border-0 last:pb-0">
                <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-secondary" />
                <div className="text-xs font-bold text-foreground">Mentorship & Architecture Check</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">15 Oct 2026, 04:00 PM</div>
                <span className="inline-block mt-1 text-[10px] font-bold uppercase text-primary">In Progress</span>
              </div>

              <div className="relative pl-6 pb-4 border-l-2 border-border last:border-0 last:pb-0">
                <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-muted-foreground/40" />
                <div className="text-xs font-bold text-foreground">Code Freeze & Final Submission</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">16 Oct 2026, 09:00 AM</div>
                <span className="inline-block mt-1 text-[10px] font-bold uppercase text-muted-foreground">Upcoming</span>
              </div>

              <div className="relative pl-6 last:border-0">
                <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-muted-foreground/40" />
                <div className="text-xs font-bold text-foreground">Jury Pitch & Evaluation</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">16 Oct 2026, 11:30 AM</div>
                <span className="inline-block mt-1 text-[10px] font-bold uppercase text-muted-foreground">Upcoming</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              <Link
                href="/timeline"
                className="text-xs font-semibold text-primary hover:underline flex items-center justify-between"
              >
                <span>View Full Schedule</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Quick Participant Shortcuts */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Participant Resources
            </h3>
            <Link
              href="/problem-statements"
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-accent text-xs font-medium text-foreground transition-colors"
            >
              <span>Problem Statements</span>
              <ArrowRight size={14} className="text-muted-foreground" />
            </Link>
            <Link
              href="/guidelines"
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-accent text-xs font-medium text-foreground transition-colors"
            >
              <span>Submission Guidelines</span>
              <ArrowRight size={14} className="text-muted-foreground" />
            </Link>
            <Link
              href="/faq"
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-accent text-xs font-medium text-foreground transition-colors"
            >
              <span>Frequently Asked Questions</span>
              <ArrowRight size={14} className="text-muted-foreground" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
