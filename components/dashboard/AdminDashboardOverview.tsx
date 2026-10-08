'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import {
  ShieldAlert,
  Users,
  FileText,
  Scale,
  CheckCircle,
  Radio,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Trophy,
  BarChart3,
  ClipboardList,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Settings,
} from 'lucide-react';

interface AdminStats {
  totalTeams: number;
  totalSubmissions: number;
  submittedCount: number;
  reviewedCount: number;
  totalUsers: number;
}

export function AdminDashboardOverview() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    totalTeams: 0,
    totalSubmissions: 0,
    submittedCount: 0,
    reviewedCount: 0,
    totalUsers: 0,
  });
  const [eventConfig, setEventConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [teamsRes, subsRes, cfgRes, usersRes] = await Promise.all([
        fetch('/api/teams'),
        fetch('/api/submissions'),
        fetch('/api/event-config'),
        fetch('/api/admin/users'),
      ]);

      const teamsData = teamsRes.ok ? await teamsRes.json() : {};
      const subsData = subsRes.ok ? await subsRes.json() : {};
      const cfgData = cfgRes.ok ? await cfgRes.json() : {};
      const usersData = usersRes.ok ? await usersRes.json() : {};

      const teams = Array.isArray(teamsData.data) ? teamsData.data : [];
      const subs = Array.isArray(subsData.data) ? subsData.data : [];
      const users = Array.isArray(usersData.data) ? usersData.data : [];

      const reviewed = subs.filter((s: any) => s.is_reviewed || s.status === 'reviewed').length;

      setStats({
        totalTeams: teams.length,
        totalSubmissions: subs.length,
        submittedCount: subs.filter((s: any) => s.status === 'submitted').length,
        reviewedCount: reviewed,
        totalUsers: users.length,
      });

      setEventConfig(cfgData.data || null);
    } catch (err) {
      console.error('Error loading admin overview metrics:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Administrator';
  const pendingReviews = Math.max(0, stats.totalSubmissions - stats.reviewedCount);

  return (
    <div className="space-y-8">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              Event Operations Snapshot
            </span>
            <span className="text-xs text-muted-foreground">&bull;</span>
            <span className="text-xs font-mono text-muted-foreground">
              {user?.email || 'ADMIN-CONSOLE'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Welcome back, {displayName}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Real-time event pulse, critical alerts, and direct shortcuts to deep operations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent hover:bg-muted border border-border text-foreground text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh snapshot metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Syncing...' : 'Sync Pulse'}
          </button>

          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors shadow-sm"
          >
            <span>Operations Center</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Critical Status & Phase Banner */}
      <div className="p-5 rounded-2xl border border-secondary/30 bg-secondary/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-secondary/20 text-secondary">
            <Radio size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">
                Active Event Phase: {eventConfig?.event_phase?.replace(/_/g, ' ') || 'Phase Active'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary uppercase border border-primary/25">
                {eventConfig?.hackathon_is_started === 'true' ? 'Live Running' : 'Setup / Locked'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Results State: {eventConfig?.results_published === 'true' ? 'Published to Leaderboard' : 'Draft / Embargoed'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/admin/event"
            className="px-3.5 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-xs font-semibold text-foreground transition-colors"
          >
            Phase Controls
          </Link>
          <Link
            href="/admin/results"
            className="px-3.5 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-xs font-semibold text-foreground transition-colors"
          >
            Results & Ceremony
          </Link>
        </div>
      </div>

      {/* Primary Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Registered Teams</span>
            <Users className="w-4 h-4 text-secondary" />
          </div>
          <div className="text-3xl font-extrabold text-foreground font-mono">
            {loading ? '-' : stats.totalTeams}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Across active tracks
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Submissions</span>
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div className="text-3xl font-extrabold text-primary font-mono">
            {loading ? '-' : stats.totalSubmissions}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Projects lodged in portal
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Reviewed Projects</span>
            <CheckCircle className="w-4 h-4 text-success" />
          </div>
          <div className="text-3xl font-extrabold text-success font-mono">
            {loading ? '-' : stats.reviewedCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Graded by judges
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Review</span>
            <Scale className="w-4 h-4 text-warning" />
          </div>
          <div className="text-3xl font-extrabold text-warning font-mono">
            {loading ? '-' : pendingReviews}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Awaiting evaluations
          </p>
        </div>
      </div>

      {/* Detailed Operations Grid Shortcuts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">Operational Modules</h3>
            <p className="text-xs text-muted-foreground">Direct access into specialized administrative control centers</p>
          </div>
          <Link
            href="/admin"
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <span>Launch Complete Console</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/admin"
            className="p-5 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Settings size={20} />
              </div>
              <h4 className="font-bold text-sm text-foreground mb-1">Operations Center</h4>
              <p className="text-xs text-muted-foreground leading-snug">
                Unified command center for live judge allocations, auto-assign shuffle, and real-time oversight.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-primary">
              <span>Open Console</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            href="/admin/event"
            className="p-5 rounded-2xl border border-border bg-card hover:border-secondary/50 hover:shadow-md transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="size-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Radio size={20} />
              </div>
              <h4 className="font-bold text-sm text-foreground mb-1">Event Control & Timers</h4>
              <p className="text-xs text-muted-foreground leading-snug">
                Manage 7-phase state machine, duration overrides, announcements broadcast, and grace buffers.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-secondary">
              <span>Manage Pipeline</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            href="/admin/users"
            className="p-5 rounded-2xl border border-border bg-card hover:border-border-subtle hover:shadow-md transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="size-10 rounded-xl bg-accent text-foreground flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Users size={20} />
              </div>
              <h4 className="font-bold text-sm text-foreground mb-1">User Management & Roles</h4>
              <p className="text-xs text-muted-foreground leading-snug">
                Create accounts, assign Participant/Judge/Admin roles, search users, and force password resets.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-foreground">
              <span>Directory</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            href="/admin/teams"
            className="p-5 rounded-2xl border border-border bg-card hover:border-border-subtle hover:shadow-md transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="size-10 rounded-xl bg-accent text-foreground flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <ClipboardList size={20} />
              </div>
              <h4 className="font-bold text-sm text-foreground mb-1">Teams & Registrations</h4>
              <p className="text-xs text-muted-foreground leading-snug">
                Inspect registered teams, member rosters, track allocations, and export team CSV records.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-foreground">
              <span>View Teams</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            href="/admin/results"
            className="p-5 rounded-2xl border border-border bg-card hover:border-secondary/50 hover:shadow-md transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="size-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Trophy size={20} />
              </div>
              <h4 className="font-bold text-sm text-foreground mb-1">Results & Publishing</h4>
              <p className="text-xs text-muted-foreground leading-snug">
                Arm the 5-minute countdown, verify winner ranks, release public leaderboard, and conclude event.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-secondary">
              <span>Publishing Hub</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            href="/admin/analytics"
            className="p-5 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <BarChart3 size={20} />
              </div>
              <h4 className="font-bold text-sm text-foreground mb-1">Analytics & Audit Reports</h4>
              <p className="text-xs text-muted-foreground leading-snug">
                Category distribution breakdowns, scoring variance audits, and executive Excel exports.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-primary">
              <span>View Analytics</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
