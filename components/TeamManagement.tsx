"use client";

import { useState, useEffect } from "react";
import {
  Users, Lock, Unlock, Copy, Check, UserPlus,
  LogIn, LogOut, Shield, UserCircle,
} from "lucide-react";
import { useAuth } from "./AuthProvider";

// ── Type definitions ──────────────────────────────────────────────────────────
interface TeamMember {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
}

interface TeamInfo {
  id: string;
  name: string;
  leaderName: string;
  leaderId: string;
  members: TeamMember[];
  inviteCode: string;
  isLocked: boolean;
  maxSize: number;
  createdAt: string;
}

// ── Hackathon config ──────────────────────────────────────────────────────────
const HACKATHON_CONFIG = {
  name: "Code-e-Manipal 2.0",
  minTeamSize: 1,
  maxTeamSize: 6,
  phase: 1,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function mapApiTeamToInfo(team: any): TeamInfo {
  const members: TeamMember[] = (team.team_members || []).map((m: any) => ({
    id: m.user_id,
    name: m.profiles?.name || m.name || "Unknown",
    email: m.profiles?.email || m.email || "",
    joinedAt: m.joined_at,
  }));
  const leader = team.team_members?.find((m: any) => m.role === "leader");
  return {
    id: team.id,
    name: team.name,
    leaderName: team.leader_name || "",
    leaderId: leader?.user_id || team.created_by || "",
    members,
    inviteCode: team.invite_code || "",
    isLocked: team.is_locked || false,
    maxSize: HACKATHON_CONFIG.maxTeamSize,
    createdAt: team.created_at,
  };
}

export function TeamManagement() {
  const { user, role, isAuthenticated, login, logout } = useAuth();
  const [mounted, setMounted] = useState(false);

  // ── State ─────────────────────────────────────────────────────────────────
  const [allTeams, setAllTeams] = useState<TeamInfo[]>([]);
  const [myTeam, setMyTeam] = useState<TeamInfo | null>(null);
  const [teamName, setTeamName] = useState("");
  const [leaderName, setLeaderName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Fetch data from API on mount ──────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated) {
      fetchMyTeam();
      fetchAllTeams();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // ── Auto-refresh every 5s when in a team ──
  useEffect(() => {
    if (!myTeam) return;
    const id = setInterval(fetchMyTeam, 5000);
    return () => clearInterval(id);
  }, [myTeam?.id]);

  const fetchMyTeam = async () => {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) {
        const json = await res.json();
        setMyTeam(mapApiTeamToInfo(json.data));
      } else {
        setMyTeam(null);
      }
    } catch {
      setMyTeam(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTeams = async () => {
    try {
      const res = await fetch("/api/teams?all=true");
      if (res.ok) {
        const json = await res.json();
        setAllTeams((json.data || []).map(mapApiTeamToInfo));
      }
    } catch {
      // silently fail
    }
  };

  const refreshAll = async () => {
    await Promise.all([fetchMyTeam(), fetchAllTeams()]);
  };

  // ── Login handler ─────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      setEmail("");
      setPassword("");
      setError("");
    } catch {
      setError("Login failed. Check your credentials.");
    }
  };

  // ── Create Team ───────────────────────────────────────────────────────────
  const createTeam = async () => {
    if (!user) return setError("Please log in to create a team");
    if (!teamName.trim()) return setError("Please enter a team name");
    if (myTeam) return setError("You are already in a team");
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: teamName.trim(), leader_name: leaderName.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        return setError(data.error || "Failed to create team");
      }
      setTeamName("");
      setLeaderName("");
      setError("");
      await refreshAll();
    } catch {
      setError("Failed to create team. Please try again.");
    }
  };

  // ── Join Team ─────────────────────────────────────────────────────────────
  const joinTeam = async () => {
    if (!user) return setError("Please log in to join a team");
    if (!inviteCode.trim()) return setError("Please enter an invite code");
    if (myTeam) return setError("You are already in a team. Leave your current team first.");
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", invite_code: inviteCode.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        return setError(data.error || "Invalid invite code");
      }
      setInviteCode("");
      setError("");
      await refreshAll();
    } catch {
      setError("Failed to join team. Please try again.");
    }
  };

  // ── Leave / Disband Team ──────────────────────────────────────────────────
  const leaveTeam = async () => {
    if (!myTeam || !user) return;
    try {
      if (myTeam.leaderId === user.id) {
        if (myTeam.members.length > 1) return setError("Transfer leadership or disband the team first");
        const res = await fetch(`/api/teams/${myTeam.id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json();
          return setError(data.error || "Failed to disband team");
        }
      } else {
        const res = await fetch(`/api/teams/${myTeam.id}/members`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json();
          return setError(data.error || "Failed to leave team");
        }
      }
      setError("");
      await refreshAll();
    } catch {
      setError("An error occurred. Please try again.");
    }
  };

  // ── Toggle lock ───────────────────────────────────────────────────────────
  const toggleLock = async () => {
    if (!myTeam || !user || myTeam.leaderId !== user.id) return;
    if (HACKATHON_CONFIG.phase === 2 && !myTeam.isLocked) return setError("Cannot unlock team during Phase 2");
    try {
      const res = await fetch(`/api/teams/${myTeam.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_locked: !myTeam.isLocked }),
      });
      if (!res.ok) {
        const data = await res.json();
        return setError(data.error || "Failed to update team");
      }
      setError("");
      await refreshAll();
    } catch {
      setError("An error occurred. Please try again.");
    }
  };

  // ── Copy invite code to clipboard ─────────────────────────────────────────
  const copyInviteCode = () => {
    if (myTeam) {
      navigator.clipboard.writeText(myTeam.inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const isTeamLeader = myTeam && user && myTeam.leaderId === user.id;

  if (!mounted) return null;

  // ── LOGIN WALL ─────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md p-8 rounded-2xl bg-card border border-border shadow-lg">
          <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
            Sign In to Team Hub
          </h2>
          <p className="text-xs text-muted-foreground text-center mb-6">
            Log in with your hackathon account to view or register your team.
          </p>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
            {error && <span className="text-xs text-destructive font-medium">{error}</span>}
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-95 shadow-sm"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── LOADING STATE ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-sm font-semibold text-muted-foreground animate-pulse">
          Loading team roster...
        </p>
      </div>
    );
  }

  // ── AUTHENTICATED DASHBOARD ───────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-20 flex flex-col gap-6">

      {/* ── HERO TEXT BLOCK ────────────────────────────────────────────────── */}
      <div className="relative w-full">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-2">
          <Users className="w-3.5 h-3.5 text-secondary" />
          Participant Workspace
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight m-0">
          Team Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1 mb-0">
          Manage your squad, copy invite codes, and lock your roster for judging.
        </p>
      </div>

      {/* ── PHASE BAR ──────────────────────────────────────────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5 min-w-[240px]">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="text-sm font-bold text-foreground">
              Phase {HACKATHON_CONFIG.phase}:
            </span>
            <span className="text-xs text-muted-foreground ml-2">
              {HACKATHON_CONFIG.phase === 1 ? "Registration Open" : "Submissions Locked"}
              {" · "}Limit: {HACKATHON_CONFIG.minTeamSize}–{HACKATHON_CONFIG.maxTeamSize} members
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
        >
          <LogOut size={14} /> Logout
        </button>
      </div>

      {/* ── ERROR BANNER ───────────────────────────────────────────────────── */}
      {error && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
          {error}
        </div>
      )}

      {/* ── CONTENT GRID ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">

        {/* ── LEFT CARD (Team Info or Create/Join) ───────────────────────────── */}
        <div className={role === "admin" ? "lg:col-span-8" : "lg:col-span-12"}>
          <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden p-6 sm:p-7">
            {myTeam ? (
              // ── TEAM INFO VIEW ──────────────────────────────────────────────
              <div className="flex flex-col gap-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <UserCircle className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground m-0">
                        {myTeam.name}
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5 mb-0">
                        {isTeamLeader ? "You are the Team Leader" : "Team Member"}
                        {myTeam.leaderName && ` · Leader: ${myTeam.leaderName}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted border border-border text-foreground">
                      {myTeam.isLocked ? <Lock size={12} className="text-amber-500" /> : <Unlock size={12} className="text-emerald-500" />}
                      {myTeam.isLocked ? "Locked" : "Open"}
                    </span>
                    <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold bg-primary text-primary-foreground shadow-sm">
                      {myTeam.members.length}/{myTeam.maxSize}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                    Team Members ({myTeam.members.length})
                  </h3>
                  <div className="flex flex-col gap-2">
                    {myTeam.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-background border border-border"
                      >
                        <div className="flex items-center gap-3">
                          <UserCircle className="w-5 h-5 text-secondary" />
                          <span className="text-sm font-semibold text-foreground">
                            {member.name}
                          </span>
                        </div>
                        {member.id === myTeam.leaderId && (
                          <span className="text-[11px] font-bold text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                            LEADER
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {isTeamLeader && !myTeam.isLocked && myTeam.members.length < myTeam.maxSize && (
                  <div className="p-4 rounded-xl bg-muted/40 border border-border">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Team Invite Code
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <div className="flex-1 px-4 py-2.5 rounded-xl bg-card border border-border font-mono text-base font-bold text-primary tracking-widest flex items-center">
                        {myTeam.inviteCode}
                      </div>
                      <button
                        type="button"
                        onClick={copyInviteCode}
                        className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-95 shadow-sm transition-all"
                      >
                        {copiedCode ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy Code</>}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 pt-2 border-t border-border">
                  {isTeamLeader && (
                    <button
                      type="button"
                      onClick={toggleLock}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-semibold hover:bg-muted transition-all cursor-pointer"
                    >
                      {myTeam.isLocked ? <Unlock size={14} /> : <Lock size={14} />}
                      {myTeam.isLocked ? "Unlock Team Roster" : "Lock Team Roster"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={leaveTeam}
                    className="text-xs font-semibold text-destructive hover:underline cursor-pointer bg-transparent border-0 p-0"
                  >
                    {isTeamLeader ? "Disband Team" : "Leave Team"}
                  </button>
                </div>
              </div>
            ) : (
              // ── CREATE / JOIN FORMS ─────────────────────────────────────────
              <div className="flex flex-col gap-8">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <Users className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-bold text-foreground m-0">
                      Create a New Team
                    </h2>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Form a new team as the leader and invite teammates with your unique code.
                  </p>
                  <div className="flex flex-col gap-3">
                    <input
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="Team name (e.g. Apex Innovators)"
                      className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    />
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        value={leaderName}
                        onChange={(e) => setLeaderName(e.target.value)}
                        placeholder="Leader display name"
                        className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={createTeam}
                        className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-95 shadow-sm transition-all flex items-center justify-center gap-1.5"
                      >
                        <UserPlus size={14} /> Create Team
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border" />

                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <LogIn className="w-5 h-5 text-secondary" />
                    <h2 className="text-xl font-bold text-foreground m-0">
                      Join Existing Team
                    </h2>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Enter the invite code provided by your team leader.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="Paste invite code"
                      className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border text-foreground font-mono text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={joinTeam}
                      className="px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:opacity-95 shadow-sm transition-all flex items-center justify-center gap-1.5"
                    >
                      <UserPlus size={14} /> Join Team
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT CARD (Admin view of all teams) ────────────────────────────── */}
        {role === "admin" && (
          <div className="lg:col-span-4">
            <div className="rounded-2xl bg-card border border-border shadow-sm p-5 flex flex-col h-[480px]">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-bold text-foreground m-0">
                  Registered Teams
                </h3>
                <span className="text-xs font-bold text-primary px-2.5 py-0.5 rounded-full bg-primary/10">
                  {allTeams.length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Global event roster
              </p>
              <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
                {allTeams.length > 0 ? (
                  allTeams.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-background border border-border flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate m-0">
                          {t.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 mb-0">
                          {t.members.length} member{t.members.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                        {t.members.length}/{t.maxSize}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No teams registered yet
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
