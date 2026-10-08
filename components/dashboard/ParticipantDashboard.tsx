"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  Sparkles,
  RefreshCw,
  AlertCircle,
  Shield,
  Copy,
  Check,
  Clock,
  ArrowRight,
  ExternalLink,
  Users,
  Lock,
  Unlock,
  Radio,
  FileCheck,
  Github,
  Globe,
  Video,
  Calendar,
  CheckCircle2,
  Flame,
  HelpCircle,
  FileText,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { SpecularButton } from "@/components/ui/SpecularButton";

interface Member {
  userId: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

interface DashboardSummaryData {
  event: {
    phase: string;
    startTime: string | null;
    endTime: string | null;
    bufferMinutes: number;
    resultsRelease: string;
    publishAt: string | null;
  };
  team: {
    id: string;
    name: string;
    inviteCode: string;
    track: string;
    leaderName?: string | null;
    members: Member[];
  } | null;
  submission: {
    id: string;
    title: string;
    summary?: string;
    category?: string;
    status: string;
    githubUrl?: string;
    demoUrl?: string;
    docsUrl?: string;
    demoVideoUrl?: string;
    submittedAt?: string;
    isLocked?: boolean;
  } | null;
  announcement: {
    id?: string;
    title?: string;
    content: string;
    type?: string;
    created_at?: string;
  } | null;
  profile: {
    id: string;
    name: string;
    email: string;
    role: string;
    identifier?: string;
  };
}

const UPCOMING_MILESTONES = [
  {
    time: "Day 1, 10:30 AM",
    title: "Problem Statements Released & 36h Hack Begins",
    status: "active",
  },
  {
    time: "Day 1, 04:30 PM",
    title: "Mentorship Round 1: Architecture Check",
    status: "upcoming",
  },
  {
    time: "Day 2, 09:30 AM",
    title: "Mentorship Round 2: Pitch & Prototype Polish",
    status: "upcoming",
  },
  {
    time: "Day 2, 12:30 PM",
    title: "Hard Code Freeze & Submission Window Closes",
    status: "deadline",
  },
  {
    time: "Day 2, 05:00 PM",
    title: "Valedictory Ceremony & Award Presentation",
    status: "upcoming",
  },
];

export function ParticipantDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const [newTeamName, setNewTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [submittingTeam, setSubmittingTeam] = useState(false);

  const fetchSummary = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/dashboard/summary");
      if (!res.ok) {
        throw new Error(`Failed to load dashboard summary (${res.status})`);
      }
      const json = await res.json();
      if (json.data) {
        setData(json.data);
        setError(null);
      } else {
        throw new Error(json.error?.message || "Empty response received");
      }
    } catch (err: any) {
      console.error("Error fetching dashboard summary:", err);
      setError(err.message || "Unable to connect to dashboard service.");
    } finally {
      setLoading(false);
      if (isManualRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(() => fetchSummary(false), 60000);
    const onFocus = () => fetchSummary(false);
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchSummary]);

  const handleCopyInviteCode = () => {
    if (!data?.team?.inviteCode) return;
    navigator.clipboard.writeText(data.team.inviteCode);
    setCopiedCode(true);
    toast.success("Team invite code copied to clipboard!");
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) {
      toast.error("Please enter a team name.");
      return;
    }
    setSubmittingTeam(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: newTeamName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to create team.");
      }
      toast.success("Team created successfully! You are the Team Leader.");
      setNewTeamName("");
      await fetchSummary(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to create team.");
    } finally {
      setSubmittingTeam(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      toast.error("Please enter an invite code.");
      return;
    }
    setSubmittingTeam(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", invite_code: joinCode.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to join team.");
      }
      toast.success("Successfully joined the squad!");
      setJoinCode("");
      await fetchSummary(true);
    } catch (err: any) {
      toast.error(err.message || "Invalid invite code or squad is full.");
    } finally {
      setSubmittingTeam(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 text-center animate-pulse space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 mx-auto flex items-center justify-center text-primary">
          <Users size={24} />
        </div>
        <h2 className="text-xl font-bold text-foreground">Loading Your Workspace...</h2>
        <p className="text-xs text-muted-foreground">Retrieving team roster, submission status, and event schedule.</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 rounded-2xl bg-destructive/10 border border-destructive/30 text-center max-w-lg mx-auto my-12">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
        <h3 className="text-lg font-bold text-foreground mb-2">Unable to Load Workspace</h3>
        <p className="text-sm text-muted-foreground mb-5">{error}</p>
        <button
          type="button"
          onClick={() => fetchSummary(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-95 transition-opacity cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Retry Connection
        </button>
      </div>
    );
  }

  const team = data?.team;
  const hasTeam = !!team?.id;
  const submission = data?.submission;
  const event = data?.event;
  const announcement = data?.announcement;
  const profile = data?.profile;

  const displayName = profile?.name || user?.user_metadata?.name || "Hacker";
  const displayIdentifier = profile?.identifier || user?.user_metadata?.identifier || "PARTICIPANT";

  const isFinalized = submission?.status === "submitted" || submission?.isLocked;
  const isDraft = submission?.status === "draft" && !submission?.isLocked;
  const hasSubmission = !!submission?.id;

  const membersList = team?.members && team.members.length > 0 ? team.members : [
    {
      userId: profile?.id || "1",
      name: displayName,
      email: profile?.email || user?.email || "",
      role: "leader",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-4 pb-16 animate-entrance sm:px-6">
      {/* ── 1. Team Identity & Workspace Header ── */}
      <SpotlightCard className="relative overflow-hidden border-y border-border bg-surface-elevated p-5 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Shield size={13} />
                {hasTeam ? "Team Leader Workspace" : "Participant Workspace"}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-secondary/15 border border-secondary/30 text-secondary text-xs font-mono font-bold">
                {hasTeam ? `ID: ${team.id.slice(0, 8)}` : displayIdentifier}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-success/15 text-success border border-success/30 text-xs font-semibold flex items-center gap-1">
                <Unlock size={12} /> Active Account
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-foreground tracking-tight">
              {hasTeam ? team.name : `Welcome, ${displayName}`}
            </h1>

            <div className="text-xs sm:text-sm text-muted-foreground flex flex-wrap items-center gap-2">
              {hasTeam ? (
                <>
                  <span>Domain Track: <strong className="text-foreground">{team?.track || "AI & Intelligent Systems"}</strong></span>
                  <span>&bull;</span>
                  <span>Leader: <strong className="text-foreground">{team?.leaderName || displayName}</strong></span>
                  <span>&bull;</span>
                  <span>Roster: <strong className="text-foreground">{membersList.length}/6 Members</strong></span>
                </>
              ) : (
                <span>Form or join a team to activate your project workspace and unlock submission controls.</span>
              )}
            </div>
          </div>

          {/* Quick Actions & Invite Code Box */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {hasTeam && team?.inviteCode && (
              <div className="px-4 py-2.5 rounded-2xl bg-accent/50 border border-border flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Team Invite Code
                  </div>
                  <div className="font-mono text-sm font-bold text-foreground">
                    {team.inviteCode}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyInviteCode}
                  className="p-2 rounded-xl bg-card border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all cursor-pointer shadow-xs"
                  title="Copy Invite Code"
                >
                  {copiedCode ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                </button>
              </div>
            )}

            {hasTeam ? (
              <Link href="/submit">
                <SpecularButton variant="primary" size="md">
                  <span>{isFinalized ? "View Submission" : hasSubmission ? "Continue Submission" : "Start Submission"}</span>
                  <ArrowRight size={15} />
                </SpecularButton>
              </Link>
            ) : (
              <div className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-muted text-muted-foreground font-semibold text-xs sm:text-sm border border-border">
                <Lock size={14} />
                <span>Team Required to Submit</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => fetchSummary(true)}
              disabled={refreshing}
              className="p-3 rounded-2xl border border-border bg-card hover:bg-accent text-foreground transition-colors cursor-pointer shrink-0"
              title="Sync Workspace"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            </button>
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
      </SpotlightCard>

      {/* ── Onboarding / Team Formation (When no team registered) ── */}
      {!hasTeam && (
        <div id="team-formation" className="space-y-6 border-y border-secondary/40 bg-surface-elevated p-5 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-secondary uppercase tracking-wider">
                <Users size={14} />
                <span>Squad Formation Required</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-foreground">
                Register Your Hackathon Team
              </h2>
            </div>
            <div className="text-xs text-muted-foreground max-w-sm">
              <strong className="text-foreground">Submission Availability:</strong> Project repositories and final evaluations require a registered squad of 1–4 builders.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create Team Form */}
            <form onSubmit={handleCreateTeam} className="rounded-2xl border border-border bg-accent/20 p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">CREATE A TEAM</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">Becomes Leader</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Start a new squad, receive a shareable invite code, and invite up to 3 teammates.
                </p>
                <div className="pt-2">
                  <label htmlFor="team-name-input" className="block text-xs font-bold text-foreground mb-1">
                    Team / Squad Name
                  </label>
                  <input
                    id="team-name-input"
                    type="text"
                    placeholder="e.g. Jaipur Matrix"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                    disabled={submittingTeam}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingTeam || !newTeamName.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Create Squad</span>
                <ArrowRight size={13} />
              </button>
            </form>

            {/* Join Team Form */}
            <form onSubmit={handleJoinTeam} className="rounded-2xl border border-border bg-accent/20 p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">JOIN EXISTING TEAM</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Teammate Entry</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Have an invite code from your squad leader? Enter it here to join their roster.
                </p>
                <div className="pt-2">
                  <label htmlFor="invite-code-input" className="block text-xs font-bold text-foreground mb-1">
                    Squad Invite Code
                  </label>
                  <input
                    id="invite-code-input"
                    type="text"
                    placeholder="e.g. A9B2X7"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-foreground text-xs font-mono font-bold tracking-wider uppercase focus:outline-none focus:ring-1 focus:ring-secondary"
                    disabled={submittingTeam}
                    maxLength={20}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingTeam || !joinCode.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold shadow-sm hover:bg-secondary/90 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Join Squad</span>
                <ArrowRight size={13} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── 2. Primary Status Row: Event Phase & Submission Status ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Phase Card */}
        <SpotlightCard className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Event Phase</span>
            <Clock size={16} className="text-secondary" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-foreground uppercase tracking-wide">
              {event?.phase || "HACKING"}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>36-Hour Continuous Sprint</span>
            </div>
          </div>
        </SpotlightCard>

        {/* Submission Status Card */}
        <SpotlightCard className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Project State</span>
            <FileCheck size={16} className="text-secondary" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-foreground">
              {isFinalized ? (
                <span className="text-emerald-600 dark:text-emerald-400">Finalized</span>
              ) : hasSubmission ? (
                <span className="text-amber-600 dark:text-amber-400">In Draft</span>
              ) : (
                <span className="text-muted-foreground">Not Started</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {isFinalized
                ? "Locked for Jury Evaluation"
                : hasSubmission
                ? "Ready to polish & finalize"
                : "Awaiting initial write-up"}
            </div>
          </div>
        </SpotlightCard>

        {/* Team Capacity Meter */}
        <SpotlightCard className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Roster Capacity</span>
            <Users size={16} className="text-secondary" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-foreground">{membersList.length}</span>
              <span className="text-sm font-semibold text-muted-foreground">/ 6 members</span>
            </div>
            <div className="w-full bg-accent/60 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (membersList.length / 6) * 100)}%` }}
              />
            </div>
          </div>
        </SpotlightCard>

        {/* Next Hard Checkpoint */}
        <SpotlightCard className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Code Freeze</span>
            <Flame size={16} className="text-primary" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-foreground">
              Day 2 • 12:30 PM
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Submission window closes sharp
            </div>
          </div>
        </SpotlightCard>
      </div>

      {/* ── 3. Central Two-Column Grid: Team Roster & Project Submission ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Left Column: Team Roster & Member Management */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <Users className="text-primary" size={18} />
                  Team Roster ({membersList.length}/4)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verified members collaborating under team {team?.name || "Squad"}.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {membersList.map((member, idx) => {
                const isLeader = member.role === "leader" || idx === 0;
                return (
                  <div
                    key={member.userId || idx}
                    className="p-3.5 rounded-2xl bg-accent/30 border border-border flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold flex items-center justify-center text-xs">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground flex items-center gap-2">
                          <span>{member.name}</span>
                          {isLeader && (
                            <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary text-[10px] font-bold uppercase border border-secondary/25">
                              Leader
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-xs">
                          {member.email}
                        </div>
                      </div>
                    </div>

                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 shrink-0">
                      Verified
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Need roster adjustments?</span>
            <Link href="/faq" className="text-primary font-semibold hover:underline">
              Review Roster FAQs →
            </Link>
          </div>
        </div>

        {/* Right Column: Project Submission Details & Quick Links */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <FileCheck className="text-primary" size={18} />
                  Project Submission
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Track repository, live demonstration, and write-up details.
                </p>
              </div>

              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  isFinalized
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25"
                    : hasSubmission
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25"
                    : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                {isFinalized ? "Locked for Evaluation" : hasSubmission ? "Draft Saved" : "Pending Submission"}
              </span>
            </div>

            {hasSubmission ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-accent/30 border border-border">
                  <h4 className="text-base font-bold text-foreground">{submission.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {submission.summary || "No summary write-up provided yet."}
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  {submission.githubUrl && (
                    <a
                      href={submission.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-3 rounded-xl bg-card border border-border hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-2 font-mono text-foreground truncate">
                        <Github size={15} className="text-secondary shrink-0" />
                        <span className="truncate">{submission.githubUrl}</span>
                      </div>
                      <ExternalLink size={13} className="text-muted-foreground shrink-0" />
                    </a>
                  )}

                  {submission.demoUrl && (
                    <a
                      href={submission.demoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-3 rounded-xl bg-card border border-border hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-2 font-mono text-foreground truncate">
                        <Globe size={15} className="text-secondary shrink-0" />
                        <span className="truncate">{submission.demoUrl}</span>
                      </div>
                      <ExternalLink size={13} className="text-muted-foreground shrink-0" />
                    </a>
                  )}
                </div>
              </div>
            ) : !hasTeam ? (
              <div className="p-6 rounded-2xl bg-accent/20 border border-dashed border-secondary/40 text-center space-y-3">
                <Users size={32} className="mx-auto text-secondary" />
                <div>
                  <h4 className="text-sm font-bold text-foreground">Squad Registration Required</h4>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-sm mx-auto">
                    Submissions are managed per registered squad. Create or join a team above to unlock your project repository and submission slot.
                  </p>
                </div>
                <a
                  href="#team-formation"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/90 transition-colors shadow-sm"
                >
                  <span>Form or Join Squad</span>
                  <ArrowRight size={13} />
                </a>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-accent/20 border border-dashed border-border text-center space-y-3">
                <FileText size={32} className="mx-auto text-muted-foreground opacity-50" />
                <div>
                  <h4 className="text-sm font-bold text-foreground">No Project Submitted Yet</h4>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-sm mx-auto">
                    Fill in your project overview, GitHub repository, live demonstration link, and technical architecture.
                  </p>
                </div>
                <Link
                  href="/submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <span>Open Submission Form</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
            {hasTeam ? (
              <Link
                href="/submit"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span>{isFinalized ? "Inspect Full Write-up" : "Open Submission Form"}</span>
                <ArrowRight size={12} />
              </Link>
            ) : (
              <a
                href="#team-formation"
                className="text-xs font-bold text-secondary hover:underline flex items-center gap-1"
              >
                <span>Register Squad to Submit</span>
                <ArrowRight size={12} />
              </a>
            )}
            <Link href="/guidelines" className="text-xs text-muted-foreground hover:text-foreground">
              Submission Specs →
            </Link>
          </div>
        </div>
      </div>

      {/* ── 4. Timeline Milestones & Participant Resources ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Upcoming Milestones Schedule */}
        <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <Calendar className="text-secondary" size={18} />
                Event Journey Milestones
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Key checkpoints across the 36-hour schedule.
              </p>
            </div>
            <Link
              href="/timeline"
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span>Full Schedule</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          <div className="space-y-3">
            {UPCOMING_MILESTONES.map((m, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-accent/30 border border-border/70 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-secondary bg-secondary/15 px-2.5 py-1 rounded-md border border-secondary/25">
                    {m.time}
                  </span>
                  <span className="font-semibold text-foreground">{m.title}</span>
                </div>

                {m.status === "active" ? (
                  <span className="inline-flex items-center gap-1 font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 text-[10px]">
                    <Flame size={11} /> LIVE
                  </span>
                ) : m.status === "deadline" ? (
                  <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md text-[10px] border border-amber-500/20">
                    DEADLINE
                  </span>
                ) : (
                  <span className="text-muted-foreground text-[10px]">UPCOMING</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Resources & Support Links */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-border mb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Sparkles className="text-primary" size={16} />
                Participant Resources
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quick access to portals and rules.
              </p>
            </div>

            <div className="space-y-2">
              {[
                { title: "Problem Statements", desc: "Challenge briefs & tracks", href: "/problem-statements", icon: MessageSquare },
                { title: "Event Schedule", desc: "Detailed 36-hour timeline", href: "/timeline", icon: Calendar },
                { title: "Participant FAQ", desc: "Support & common queries", href: "/faq", icon: HelpCircle },
                { title: "Rules & Rubrics", desc: "Judging criteria specs", href: "/guidelines", icon: BookOpen },
              ].map((res, i) => {
                const Icon = res.icon;
                return (
                  <Link
                    key={i}
                    href={res.href}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-accent/30 hover:bg-accent border border-border/50 hover:border-primary/40 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                        <Icon size={14} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                          {res.title}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{res.desc}</div>
                      </div>
                    </div>
                    <ArrowRight size={13} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-border mt-4 text-[11px] text-muted-foreground text-center">
            Need urgent help? Visit Lab Block 3 Help Desk.
          </div>
        </div>
      </div>
    </div>
  );
}
