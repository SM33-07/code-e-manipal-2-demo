"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Users,
  FileText,
  Scale,
  CheckCircle,
  Radio,
  ArrowRight,
  Sparkles,
  Trophy,
  BarChart3,
  Search,
  Filter,
  ExternalLink,
  Lock,
  Plus,
  Download,
  History,
  ShieldCheck,
  ChevronRight,
  Eye,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { DemoRoleSwitcher } from "@/components/demo/DemoRoleSwitcher";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import {
  DEMO_ADMIN_DATA,
  type DemoAdminUser,
  type DemoAdminSubmissionRecord,
  type DemoAuditLogRecord,
} from "@/lib/demo/demoFixtures";

export default function DemoAdminPage() {
  const [data] = useState(DEMO_ADMIN_DATA);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "submissions" | "judging" | "audit">("overview");

  // User management state
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Submissions management state
  const [subSearch, setSubSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState<string>("all");
  const [inspectingSub, setInspectingSub] = useState<DemoAdminSubmissionRecord | null>(null);

  // Audit logs state
  const [logFilter, setLogFilter] = useState<string>("all");

  const filteredUsers = useMemo(() => {
    return data.users.filter((u) => {
      const matchesSearch =
        userSearch === ""
          ? true
          : u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
            u.email.toLowerCase().includes(userSearch.toLowerCase());
      const matchesRole = roleFilter === "all" ? true : u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [data.users, userSearch, roleFilter]);

  const tracks = useMemo(() => {
    return Array.from(new Set(data.submissions.map((s) => s.track)));
  }, [data.submissions]);

  const filteredSubmissions = useMemo(() => {
    return data.submissions.filter((s) => {
      const matchesSearch =
        subSearch === ""
          ? true
          : s.title.toLowerCase().includes(subSearch.toLowerCase()) ||
            s.teamName.toLowerCase().includes(subSearch.toLowerCase());
      const matchesTrack = trackFilter === "all" ? true : s.track === trackFilter;
      return matchesSearch && matchesTrack;
    });
  }, [data.submissions, subSearch, trackFilter]);

  const filteredLogs = useMemo(() => {
    return data.auditLogs.filter((l) => {
      if (logFilter === "all") return true;
      return l.action.toLowerCase().includes(logFilter.toLowerCase()) || l.role.toLowerCase() === logFilter.toLowerCase();
    });
  }, [data.auditLogs, logFilter]);

  const handleBlockedAction = (actionName: string) => {
    toast.error(`Action Blocked: ${actionName} is strictly disabled in public demo mode.`);
  };

  return (
    <div className="min-h-screen bg-transparent pb-24">
      <DemoRoleSwitcher currentRole="admin" />

      <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-jaipur-pink/40 bg-jaipur-pink/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-jaipur-pink">
                <ShieldAlert size={12} />
                Event Operations Console
              </span>
              <span className="text-muted-foreground text-xs font-mono">·</span>
              <span className="text-xs font-mono text-muted-foreground">
                Role: Lead Administrator
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              Event Command Center
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Real-time monitoring snapshot for Code-e-Manipal 2.0 Grand Finale.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBlockedAction("Bulk User Generation")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
            >
              <Plus size={13} />
              <span>Create User (Blocked)</span>
            </button>
            <button
              type="button"
              onClick={() => handleBlockedAction("Production CSV Export")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
            >
              <Download size={13} />
              <span>Export Roster (Blocked)</span>
            </button>
          </div>
        </div>

        {/* Top 6 KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <SpotlightCard className="p-4 rounded-xl border border-border bg-surface-elevated">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Teams</p>
            <p className="text-2xl font-black text-foreground mt-0.5">{data.stats.totalTeams}</p>
            <span className="text-[10px] text-primary font-semibold">86 On-Campus</span>
          </SpotlightCard>

          <SpotlightCard className="p-4 rounded-xl border border-border bg-surface-elevated">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Submissions</p>
            <p className="text-2xl font-black text-foreground mt-0.5">{data.stats.totalSubmissions}</p>
            <span className="text-[10px] text-emerald-400 font-semibold">100% Rate</span>
          </SpotlightCard>

          <SpotlightCard className="p-4 rounded-xl border border-border bg-surface-elevated">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Jury Reviewed</p>
            <p className="text-2xl font-black text-emerald-400 mt-0.5">{data.stats.reviewedCount}</p>
            <span className="text-[10px] text-muted-foreground font-mono">94.8% Complete</span>
          </SpotlightCard>

          <SpotlightCard className="p-4 rounded-xl border border-border bg-surface-elevated">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Users</p>
            <p className="text-2xl font-black text-foreground mt-0.5">{data.stats.totalUsers}</p>
            <span className="text-[10px] text-secondary font-semibold">14 Judges · 8 Admins</span>
          </SpotlightCard>

          <SpotlightCard className="p-4 rounded-xl border border-border bg-surface-elevated">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Avg Score</p>
            <p className="text-2xl font-black text-foreground mt-0.5">{data.stats.avgScore}</p>
            <span className="text-[10px] text-muted-foreground font-mono">/ 100 Scale</span>
          </SpotlightCard>

          <SpotlightCard className="p-4 rounded-xl border border-border bg-surface-elevated">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tracks</p>
            <p className="text-2xl font-black text-foreground mt-0.5">{data.stats.tracksCount}</p>
            <span className="text-[10px] text-jaipur-pink font-semibold">9 Disciplines</span>
          </SpotlightCard>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-surface border border-border text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === "overview"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Overview & Status
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === "users"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Users & Roles ({data.users.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("submissions")}
            className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === "submissions"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Teams & Submissions ({data.submissions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("judging")}
            className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === "judging"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Judge Matrix ({data.judgeAllocations.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === "audit"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Security & Audit Logs ({data.auditLogs.length})
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SpotlightCard className="lg:col-span-2 rounded-2xl border border-border bg-surface-elevated p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-base font-bold text-foreground">Event Lifecycle Controls</h3>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Global Freeze Active
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl border border-border bg-surface space-y-1">
                  <p className="font-semibold text-muted-foreground">Current Event Phase</p>
                  <p className="text-base font-bold text-foreground">RESULTS (Concluded)</p>
                  <p className="text-[11px] text-muted-foreground">Valedictory closing ceremony concluded.</p>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-surface space-y-1">
                  <p className="font-semibold text-muted-foreground">Submission Window</p>
                  <p className="text-base font-bold text-emerald-400">LOCKED BY DEADLINE</p>
                  <p className="text-[11px] text-muted-foreground">Hard freeze applied to 78 submitted projects.</p>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-surface space-y-1">
                  <p className="font-semibold text-muted-foreground">Results Public Release</p>
                  <p className="text-base font-bold text-primary">PUBLISHED</p>
                  <p className="text-[11px] text-muted-foreground">Verified rubric rankings live on public leaderboard.</p>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-surface space-y-1">
                  <p className="font-semibold text-muted-foreground">Problem Statements</p>
                  <p className="text-base font-bold text-secondary">35 CHALLENGES RELEASED</p>
                  <p className="text-[11px] text-muted-foreground">Visible to participants and guests.</p>
                </div>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  Administrative mutation protection enabled in demo mode.
                </span>
                <button
                  type="button"
                  onClick={() => handleBlockedAction("Event Phase Override")}
                  className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
                >
                  Edit Configuration (Blocked)
                </button>
              </div>
            </SpotlightCard>

            <SpotlightCard className="rounded-2xl border border-border bg-surface-elevated p-6 space-y-4">
              <div className="border-b border-border pb-3">
                <h3 className="text-base font-bold text-foreground">Quick Track Distribution</h3>
                <p className="text-xs text-muted-foreground mt-0.5">86 Teams across 9 disciplines</p>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between font-medium">
                    <span>AI/ML & Earth Observation</span>
                    <span className="font-mono">16 teams</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: "20%" }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-medium">
                    <span>HealthTech</span>
                    <span className="font-mono">12 teams</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                    <div className="h-full bg-secondary" style={{ width: "15%" }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-medium">
                    <span>Cybersecurity</span>
                    <span className="font-mono">10 teams</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                    <div className="h-full bg-jaipur-pink" style={{ width: "12%" }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-medium">
                    <span>Smart City & Infrastructure</span>
                    <span className="font-mono">10 teams</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                    <div className="h-full bg-jaipur-terracotta" style={{ width: "12%" }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-medium">
                    <span>Other 5 Tracks</span>
                    <span className="font-mono">38 teams</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                    <div className="h-full bg-muted-foreground/40" style={{ width: "41%" }} />
                  </div>
                </div>
              </div>
            </SpotlightCard>
          </div>
        )}

        {/* TAB 2: USERS & ROLES */}
        {activeTab === "users" && (
          <SpotlightCard className="rounded-2xl border border-border bg-surface-elevated p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Users & Access Control</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Inspect synthetic user directory, roles, and verified statuses.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="h-9 pl-9 pr-3 text-xs bg-surface border border-border rounded-xl text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-all w-48 sm:w-56"
                  />
                </div>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="h-9 px-3 text-xs bg-surface border border-border rounded-xl text-foreground outline-none focus:border-primary cursor-pointer"
                >
                  <option value="all">All Roles</option>
                  <option value="participant">Participants</option>
                  <option value="judge">Judges</option>
                  <option value="admin">Admins</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-mono uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Email Address</th>
                    <th className="py-2.5 px-3">Assigned Role</th>
                    <th className="py-2.5 px-3">Team / Affiliation</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-accent/40 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-foreground">{user.name}</td>
                      <td className="py-2.5 px-3 font-mono text-muted-foreground text-[11px]">{user.email}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            user.role === "admin"
                              ? "bg-jaipur-pink/15 text-jaipur-pink border border-jaipur-pink/30"
                              : user.role === "judge"
                              ? "bg-secondary/15 text-secondary border border-secondary/30"
                              : "bg-primary/15 text-primary border border-primary/30"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {user.teamName || (user.role === "judge" ? "Jury Panel" : "Core Operations")}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                          <CheckCircle size={12} />
                          {user.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleBlockedAction(`Role Change for ${user.name}`)}
                          className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          Edit Role
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SpotlightCard>
        )}

        {/* TAB 3: TEAMS & SUBMISSIONS */}
        {activeTab === "submissions" && (
          <SpotlightCard className="rounded-2xl border border-border bg-surface-elevated p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Teams & Submission Dossiers</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Search, filter, and inspect verified project submissions and scores.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search project or team..."
                    value={subSearch}
                    onChange={(e) => setSubSearch(e.target.value)}
                    className="h-9 pl-9 pr-3 text-xs bg-surface border border-border rounded-xl text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-all w-48 sm:w-56"
                  />
                </div>

                <select
                  value={trackFilter}
                  onChange={(e) => setTrackFilter(e.target.value)}
                  className="h-9 px-3 text-xs bg-surface border border-border rounded-xl text-foreground outline-none focus:border-primary cursor-pointer"
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

            {/* Submissions Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-mono uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Rank</th>
                    <th className="py-2.5 px-3">Team</th>
                    <th className="py-2.5 px-3">Project Title</th>
                    <th className="py-2.5 px-3">Track</th>
                    <th className="py-2.5 px-3">Score</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Inspection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredSubmissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-accent/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                        {sub.rank ? `#${sub.rank}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-foreground">{sub.teamName}</td>
                      <td className="py-2.5 px-3 text-muted-foreground max-w-xs truncate">{sub.title}</td>
                      <td className="py-2.5 px-3">
                        <span className="rounded bg-surface px-2 py-0.5 text-[10px] text-muted-foreground">
                          {sub.track}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                        {sub.score ? `${sub.score}` : "Pending"}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setInspectingSub(sub)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                        >
                          <Eye size={12} />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SpotlightCard>
        )}

        {/* TAB 4: JUDGE ALLOCATION MATRIX */}
        {activeTab === "judging" && (
          <SpotlightCard className="rounded-2xl border border-border bg-surface-elevated p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Judge Panel Allocation Matrix</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Review assignment quotas, completion rates, and track coverage.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleBlockedAction("Judge Reallocation")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Lock size={12} />
                <span>Rebalance Panel (Blocked)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.judgeAllocations.map((judge) => {
                const percent = Math.round((judge.completedCount / judge.assignedCount) * 100);

                return (
                  <div key={judge.judgeId} className="p-4 rounded-xl border border-border bg-surface/60 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-foreground text-sm">{judge.judgeName}</h4>
                        <p className="text-[11px] font-mono text-muted-foreground">Badge: {judge.badgeId}</p>
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        {judge.completedCount} / {judge.assignedCount} ({percent}%)
                      </span>
                    </div>

                    <div className="h-2 rounded-full bg-surface overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${percent}%` }} />
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {judge.assignedTracks.map((t) => (
                        <span key={t} className="rounded bg-surface px-2 py-0.5 text-[10px] text-muted-foreground font-mono">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </SpotlightCard>
        )}

        {/* TAB 5: AUDIT LOGS */}
        {activeTab === "audit" && (
          <SpotlightCard className="rounded-2xl border border-border bg-surface-elevated p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Operational & Security Audit Trail</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Chronological record of event transitions, role validations, and locks.
                </p>
              </div>

              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="h-9 px-3 text-xs bg-surface border border-border rounded-xl text-foreground outline-none focus:border-primary cursor-pointer"
              >
                <option value="all">All Events</option>
                <option value="admin">Admin Actions</option>
                <option value="system">System Jobs</option>
                <option value="judge">Judge Evaluations</option>
                <option value="participant">Participant Submissions</option>
              </select>
            </div>

            <div className="space-y-2.5">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl border border-border bg-surface/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">{log.action}</span>
                      <span className="rounded bg-surface px-1.5 py-0.2 text-[9px] font-mono uppercase text-muted-foreground">
                        {log.role}
                      </span>
                      <span className="text-muted-foreground text-[11px]">by {log.actor}</span>
                    </div>
                    <p className="text-muted-foreground text-[11px]">{log.details}</p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 sm:text-right font-mono text-[10px] text-muted-foreground">
                    <span>{new Date(log.timestamp).toLocaleTimeString()} UTC</span>
                    <span className="rounded-full bg-emerald-500/15 text-emerald-400 px-2 py-0.2 font-bold uppercase">
                      {log.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </SpotlightCard>
        )}

        {/* Modal: Submission Detail Inspection */}
        {inspectingSub && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface-elevated p-6 space-y-5 shadow-2xl">
              <div className="flex items-start justify-between border-b border-border pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary font-mono">
                    Submission Inspection Dossier
                  </span>
                  <h3 className="text-lg font-bold text-foreground mt-0.5">
                    {inspectingSub.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Team: <span className="font-semibold text-foreground">{inspectingSub.teamName}</span> ({inspectingSub.membersCount} members)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingSub(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <p className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Track</p>
                  <p className="mt-0.5 text-foreground font-semibold">{inspectingSub.track}</p>
                </div>

                <div>
                  <p className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Evaluation Score</p>
                  <p className="mt-0.5 font-mono text-base font-bold text-emerald-400">
                    {inspectingSub.score ? `${inspectingSub.score} / 100` : "Pending evaluation"}
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-border">
                  <p className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Submission Artifacts</p>
                  <div className="flex flex-col gap-1.5 font-mono text-[11px]">
                    <a
                      href={inspectingSub.githubUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1.5"
                    >
                      <ExternalLink size={12} />
                      <span>{inspectingSub.githubUrl || "https://github.com/demo/repo"}</span>
                    </a>
                    <a
                      href={inspectingSub.demoUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-secondary hover:underline flex items-center gap-1.5"
                    >
                      <ExternalLink size={12} />
                      <span>{inspectingSub.demoUrl || "https://demo.example.com"}</span>
                    </a>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex justify-end">
                <button
                  type="button"
                  onClick={() => setInspectingSub(null)}
                  className="px-4 py-2 rounded-xl bg-surface border border-border text-xs font-semibold text-foreground hover:bg-accent transition-colors cursor-pointer"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
