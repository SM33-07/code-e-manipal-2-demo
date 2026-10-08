"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileCode,
  Search,
  ExternalLink,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Loader2,
  RefreshCw,
  GitBranch,
  Globe,
  Users,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

interface Submission {
  id: string;
  team_id: string;
  title: string;
  description: string;
  category: string;
  repo_url: string;
  demo_url?: string;
  status: "draft" | "submitted";
  is_locked: boolean;
  final_submitted_at: string | null;
  created_at: string;
  team_name?: string;
}

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Reopen modal state
  const [reopenTarget, setReopenTarget] = useState<Submission | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [reopening, setReopening] = useState(false);

  // Detail inspection modal state
  const [detailTarget, setDetailTarget] = useState<Submission | null>(null);

  const fetchSubmissions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/submissions?${params}`);
      if (!res.ok) throw new Error("Failed to load submissions");
      const json = await res.json();
      setSubmissions(json.data ?? []);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch submissions");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, searchQuery]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Execute Reopen Action
  const handleConfirmReopen = async () => {
    if (!reopenTarget) return;
    if (reopenReason.trim().length < 10) {
      toast.error("A mandatory reason (minimum 10 characters) is required.");
      return;
    }

    setReopening(true);
    try {
      const res = await fetch(`/api/admin/submissions/${reopenTarget.id}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reopenReason.trim() }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to reopen submission");
      }

      toast.success(`Submission "${reopenTarget.title}" reopened for team edits`);
      setReopenTarget(null);
      setReopenReason("");
      await fetchSubmissions();
    } catch (err: any) {
      toast.error(err.message || "Error reopening submission");
    } finally {
      setReopening(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-secondary uppercase tracking-wider mb-1">
            <FileCode size={14} />
            <span>SUBMISSIONS OVERSIGHT</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
            Project Submissions
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Audit finalized repositories, review live demos, and manage audited reopening requests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/teams"
            className="px-3.5 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-accent transition-colors"
          >
            Teams Console
          </Link>
          <button
            type="button"
            onClick={fetchSubmissions}
            disabled={loading}
            className="p-2.5 rounded-xl border border-border bg-card text-foreground hover:bg-accent transition-colors cursor-pointer"
            title="Refresh submissions"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
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
            placeholder="Search submissions by title or description..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-card text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-card text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
          >
            <option value="all">All Categories</option>
            <option value="AI & Intelligent Systems">AI & Intelligent Systems</option>
            <option value="Web3 & Blockchain">Web3 & Blockchain</option>
            <option value="FinTech & Healthcare">FinTech & Healthcare</option>
            <option value="Open Innovation">Open Innovation</option>
          </select>
        </div>
      </div>

      {/* Submissions List */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 size={24} className="animate-spin text-primary mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Loading submissions...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="p-12 text-center">
            <FileCode size={32} className="mx-auto text-muted-foreground opacity-40 mb-2" />
            <h3 className="text-sm font-bold text-foreground">No submissions found</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Submissions will appear here as teams save drafts and finalize projects.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-accent/40 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Project Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status & Lock</th>
                  <th className="py-3 px-4">Submitted At</th>
                  <th className="py-3 px-4">Links</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {submissions.map((sub) => {
                  const isSubmitted = sub.status === "submitted";
                  const isLocked = sub.is_locked;

                  return (
                    <tr key={sub.id} className="hover:bg-accent/20 transition-colors">
                      {/* Project Title */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-bold text-foreground truncate">{sub.title}</div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                          {sub.description}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-accent text-[11px] font-semibold text-muted-foreground border border-border">
                          {sub.category || "General"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {isSubmitted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                              <CheckCircle2 size={11} />
                              <span>Finalized</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-muted-foreground border border-border text-[11px] font-medium">
                              <Clock size={11} />
                              <span>Draft</span>
                            </span>
                          )}
                          {isLocked && (
                            <span title="Locked for evaluation">
                              <Lock size={12} className="text-secondary" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Submitted At */}
                      <td className="py-3.5 px-4 text-xs text-muted-foreground">
                        {sub.final_submitted_at ? (
                          new Date(sub.final_submitted_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        ) : (
                          <span className="italic opacity-60">Not finalized</span>
                        )}
                      </td>

                      {/* Links */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {sub.repo_url && (
                            <a
                              href={sub.repo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                              title="GitHub Repository"
                            >
                              <GitBranch size={15} />
                            </a>
                          )}
                          {sub.demo_url && (
                            <a
                              href={sub.demo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                              title="Live Demo"
                            >
                              <Globe size={15} />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailTarget(sub)}
                            className="p-1.5 rounded-lg border border-border bg-background hover:bg-accent text-foreground transition-colors cursor-pointer"
                            title="Inspect Details"
                          >
                            <Eye size={14} />
                          </button>

                          {/* Reopen Action (audited override) */}
                          {isSubmitted && (
                            <button
                              type="button"
                              onClick={() => {
                                setReopenTarget(sub);
                                setReopenReason("");
                              }}
                              className="px-2.5 py-1 rounded-lg border border-amber-600/30 bg-amber-600/10 text-amber-600 dark:text-amber-400 hover:bg-amber-600/20 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                              title="Reopen submission to allow participant edits"
                            >
                              <RotateCcw size={12} />
                              <span>Reopen</span>
                            </button>
                          )}
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

      {/* Inspect Detail Modal */}
      {detailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div>
              <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">
                Submission Inspection
              </span>
              <h3 className="text-xl font-extrabold text-foreground mt-0.5">
                {detailTarget.title}
              </h3>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-accent text-[11px] font-semibold text-muted-foreground border border-border">
                {detailTarget.category}
              </span>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div>
                <span className="font-semibold text-foreground">Project Description:</span>
                <p className="mt-1 text-muted-foreground leading-relaxed bg-muted/50 p-3 rounded-xl border border-border">
                  {detailTarget.description}
                </p>
              </div>

              <div className="space-y-1.5 pt-1">
                {detailTarget.repo_url && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Git Repository:</span>
                    <a
                      href={detailTarget.repo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 font-mono"
                    >
                      <span>{detailTarget.repo_url}</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}
                {detailTarget.demo_url && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Demo URL:</span>
                    <a
                      href={detailTarget.demo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 font-mono"
                    >
                      <span>{detailTarget.demo_url}</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Submission State:</span>
                  <span className="font-semibold text-foreground capitalize">
                    {detailTarget.status} ({detailTarget.is_locked ? "Locked" : "Unlocked"})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setDetailTarget(null)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audited Reopen Modal */}
      {reopenTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-600/15 text-amber-600 dark:text-amber-400 border border-amber-600/25">
                <RotateCcw size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Reopen Finalized Submission
                </h3>
                <p className="text-xs text-muted-foreground">
                  Project: <strong className="text-foreground">{reopenTarget.title}</strong>
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-300">
              <p>
                <strong>Audited Action:</strong> Reopening unlocks the submission, transitions it back
                to &ldquo;draft&rdquo;, and appends an immutable log record in the system audit trail.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Mandatory Justification Reason (min 10 characters)
              </label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="e.g. Authorized typo correction in repository URL as per team leader request..."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-border bg-background text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-[11px] text-muted-foreground">
                {reopenReason.length} / 10 characters minimum
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setReopenTarget(null);
                  setReopenReason("");
                }}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reopening || reopenReason.trim().length < 10}
                onClick={handleConfirmReopen}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {reopening && <Loader2 size={13} className="animate-spin" />}
                <span>Confirm & Reopen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
