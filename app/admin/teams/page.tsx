"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Filter,
  Lock,
  Unlock,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Loader2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Send,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";

interface AdminTeam {
  id: string;
  name: string;
  team_code?: string;
  category?: string;
  submission_frozen: boolean;
  deadline_extension: string | null;
  member_count: number;
  submitted_at: string | null;
  created_at: string;
}

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [trackFilter, setTrackFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [togglingGlobal, setTogglingGlobal] = useState(false);

  // Deadline extension modal state
  const [selectedTeam, setSelectedTeam] = useState<AdminTeam | null>(null);
  const [extensionMinutes, setExtensionMinutes] = useState(30);
  const [savingExtension, setSavingExtension] = useState(false);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/teams");
      if (!res.ok) throw new Error("Failed to load teams");
      const json = await res.json();
      setTeams(json.data ?? []);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch teams");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Toggle freeze for single team
  const handleToggleFreeze = async (team: AdminTeam) => {
    setUpdatingId(team.id);
    const newFrozen = !team.submission_frozen;
    try {
      const res = await fetch("/api/admin/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: team.id,
          submission_frozen: newFrozen,
        }),
      });
      if (!res.ok) throw new Error("Failed to update freeze status");

      setTeams((prev) =>
        prev.map((t) => (t.id === team.id ? { ...t, submission_frozen: newFrozen } : t))
      );
      toast.success(
        `Submission ${newFrozen ? "frozen" : "unfrozen"} for team ${team.name}`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update freeze status");
    } finally {
      setUpdatingId(null);
    }
  };

  // Toggle global freeze
  const handleToggleGlobalFreeze = async (freezeAll: boolean) => {
    if (!confirm(`Are you sure you want to ${freezeAll ? "FREEZE" : "UNFREEZE"} submissions globally for ALL teams?`)) {
      return;
    }
    setTogglingGlobal(true);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          global: true,
          submission_frozen: freezeAll,
        }),
      });
      if (!res.ok) throw new Error("Failed to toggle global freeze");

      setTeams((prev) =>
        prev.map((t) => ({ ...t, submission_frozen: freezeAll }))
      );
      toast.success(
        `Submissions globally ${freezeAll ? "frozen" : "unfrozen"} for all teams`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update global freeze status");
    } finally {
      setTogglingGlobal(false);
    }
  };

  // Save deadline extension
  const handleSaveExtension = async () => {
    if (!selectedTeam) return;
    setSavingExtension(true);
    try {
      const newDeadline = new Date(Date.now() + extensionMinutes * 60 * 1000).toISOString();
      const res = await fetch("/api/admin/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTeam.id,
          deadline_extension: newDeadline,
        }),
      });
      if (!res.ok) throw new Error("Failed to set extension");

      setTeams((prev) =>
        prev.map((t) =>
          t.id === selectedTeam.id ? { ...t, deadline_extension: newDeadline } : t
        )
      );
      toast.success(`Extended deadline by ${extensionMinutes}m for ${selectedTeam.name}`);
      setSelectedTeam(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to set deadline extension");
    } finally {
      setSavingExtension(false);
    }
  };

  const handleClearExtension = async (teamId: string) => {
    setSavingExtension(true);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: teamId,
          deadline_extension: null,
        }),
      });
      if (!res.ok) throw new Error("Failed to clear extension");

      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, deadline_extension: null } : t))
      );
      toast.success("Deadline extension removed");
      setSelectedTeam(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to clear extension");
    } finally {
      setSavingExtension(false);
    }
  };

  // Filtered teams
  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        (t.team_code && t.team_code.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q));

      const matchesTrack =
        trackFilter === "all" ||
        (t.category && t.category.toLowerCase() === trackFilter.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "submitted" && !!t.submitted_at) ||
        (statusFilter === "draft" && !t.submitted_at) ||
        (statusFilter === "frozen" && t.submission_frozen);

      return matchesSearch && matchesTrack && matchesStatus;
    });
  }, [teams, searchQuery, trackFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = teams.length;
    const submitted = teams.filter((t) => !!t.submitted_at).length;
    const frozen = teams.filter((t) => t.submission_frozen).length;
    const extended = teams.filter((t) => !!t.deadline_extension).length;
    return { total, submitted, frozen, extended };
  }, [teams]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-secondary uppercase tracking-wider mb-1">
            <Users size={14} />
            <span>OPERATIONAL ROSTER OVERSIGHT</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
            Teams & Roster Management
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Audit participating teams, control submission freeze locks, grant time extensions, and oversee project readiness.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/registrations"
            className="px-3.5 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-accent transition-colors flex items-center gap-1.5"
          >
            <span>Registration Raw Data</span>
            <ExternalLink size={13} className="text-muted-foreground" />
          </Link>
          <button
            type="button"
            onClick={fetchTeams}
            disabled={loading}
            className="p-2.5 rounded-xl border border-border bg-card text-foreground hover:bg-accent transition-colors cursor-pointer"
            title="Refresh Teams"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Total Teams
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-foreground mt-1">
            {stats.total}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Verified on roster</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Submitted Projects
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.submitted}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {stats.total > 0 ? Math.round((stats.submitted / stats.total) * 100) : 0}% completion
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Frozen Submissions
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
            {stats.frozen}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Submissions locked</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Extensions Granted
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-secondary mt-1">
            {stats.extended}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Active time concessions</p>
        </div>
      </div>

      {/* Global Control Bar */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-secondary/15 text-secondary border border-secondary/25">
            <Lock size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Global Submission Lock</h3>
            <p className="text-xs text-muted-foreground">
              Lock or unlock submission access across all participating teams simultaneously.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={togglingGlobal}
            onClick={() => handleToggleGlobalFreeze(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-600/15 border border-amber-600/30 text-amber-600 dark:text-amber-400 text-xs font-semibold hover:bg-amber-600/25 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Lock size={13} />
            <span>Freeze All</span>
          </button>
          <button
            type="button"
            disabled={togglingGlobal}
            onClick={() => handleToggleGlobalFreeze(false)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600/15 border border-emerald-600/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-600/25 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Unlock size={13} />
            <span>Unfreeze All</span>
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search teams by name, code, or track..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-card text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={trackFilter}
            onChange={(e) => setTrackFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-card text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
          >
            <option value="all">All Tracks</option>
            <option value="AI & Intelligent Systems">AI & Intelligent Systems</option>
            <option value="Web3 & Blockchain">Web3 & Blockchain</option>
            <option value="FinTech & Healthcare">FinTech & Healthcare</option>
            <option value="Open Innovation">Open Innovation</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-card text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted Only</option>
            <option value="draft">Draft Only</option>
            <option value="frozen">Frozen Only</option>
          </select>
        </div>
      </div>

      {/* Teams Data Table */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 size={24} className="animate-spin text-primary mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Loading team records...</p>
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={32} className="mx-auto text-muted-foreground opacity-40 mb-2" />
            <h3 className="text-sm font-bold text-foreground">No teams match your filter</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Try adjusting your search query or track filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-accent/40 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4">Track</th>
                  <th className="py-3 px-4">Roster</th>
                  <th className="py-3 px-4">Submission Status</th>
                  <th className="py-3 px-4">Freeze State</th>
                  <th className="py-3 px-4">Deadline Extension</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredTeams.map((team) => {
                  const isSubmitted = !!team.submitted_at;
                  const isFrozen = team.submission_frozen;
                  const isUpdating = updatingId === team.id;

                  return (
                    <tr key={team.id} className="hover:bg-accent/20 transition-colors">
                      {/* Team Name & Code */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-foreground">{team.name}</div>
                        <div className="font-mono text-[11px] text-secondary mt-0.5">
                          {team.team_code || team.id.slice(0, 8)}
                        </div>
                      </td>

                      {/* Track */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-accent text-[11px] font-semibold text-muted-foreground border border-border">
                          {team.category || "General Track"}
                        </span>
                      </td>

                      {/* Members */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
                          <Users size={13} className="text-muted-foreground" />
                          <span>{team.member_count ?? 1} Members</span>
                        </div>
                      </td>

                      {/* Submission Status */}
                      <td className="py-3.5 px-4">
                        {isSubmitted ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                              <CheckCircle2 size={11} />
                              <span>Submitted</span>
                            </span>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(team.submitted_at!).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-muted-foreground border border-border text-[11px] font-medium">
                            <Clock size={11} />
                            <span>In Draft</span>
                          </span>
                        )}
                      </td>

                      {/* Freeze State Toggle */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleToggleFreeze(team)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            isFrozen
                              ? "bg-amber-600/15 border border-amber-600/30 text-amber-600 dark:text-amber-400 hover:bg-amber-600/25"
                              : "bg-emerald-600/10 border border-emerald-600/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/20"
                          }`}
                        >
                          {isUpdating ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : isFrozen ? (
                            <Lock size={12} />
                          ) : (
                            <Unlock size={12} />
                          )}
                          <span>{isFrozen ? "Frozen" : "Unlocked"}</span>
                        </button>
                      </td>

                      {/* Deadline Extension */}
                      <td className="py-3.5 px-4">
                        {team.deadline_extension ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-secondary/15 border border-secondary/30 text-secondary text-[11px] font-bold">
                              Extended to{" "}
                              {new Date(team.deadline_extension).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleClearExtension(team.id)}
                              className="text-xs text-muted-foreground hover:text-destructive"
                              title="Clear extension"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Standard</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedTeam(team)}
                            className="px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-accent text-xs font-semibold text-foreground transition-colors cursor-pointer"
                          >
                            Extend Time
                          </button>
                          <Link
                            href="/admin/submissions"
                            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                            title="View Submissions"
                          >
                            <ChevronRight size={16} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deadline Extension Modal */}
      {selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-secondary uppercase tracking-wider mb-1">
                <Clock size={13} />
                <span>ADMIN TIME OVERRIDE</span>
              </div>
              <h3 className="text-lg font-bold text-foreground">
                Grant Deadline Extension
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Set a custom deadline extension for team <strong className="text-foreground">{selectedTeam.name}</strong>.
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-foreground">
                Extension Duration (Minutes from now)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[15, 30, 60, 120].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setExtensionMinutes(mins)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      extensionMinutes === mins
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border text-foreground hover:bg-accent"
                    }`}
                  >
                    +{mins}m
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Team submission window will remain unlocked until{" "}
                <strong className="text-foreground">
                  {new Date(Date.now() + extensionMinutes * 60 * 1000).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
                .
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setSelectedTeam(null)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingExtension}
                onClick={handleSaveExtension}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {savingExtension && <Loader2 size={13} className="animate-spin" />}
                <span>Save Extension</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
