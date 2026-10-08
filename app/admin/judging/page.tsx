"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Gavel,
  Search,
  UserCheck,
  ShieldAlert,
  Loader2,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface JudgeAssignment {
  id: string;
  judge_id: string;
  submission_id: string;
  assigned_at: string;
  submissions?: {
    id: string;
    title: string;
    category: string;
    status: string;
  };
  profiles?: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
  };
  review?: {
    id: string;
    is_complete: boolean;
    score_innovation?: number;
    score_technical?: number;
    score_presentation?: number;
    score_impact?: number;
    version?: number;
    feedback?: string;
  } | null;
}

export default function AdminJudgingPage() {
  const [assignments, setAssignments] = useState<JudgeAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [autoAssigning, setAutoAssigning] = useState(false);

  // Review Correction modal state
  const [reopenReviewId, setReopenReviewId] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [expectedVersion, setExpectedVersion] = useState<number | undefined>(undefined);
  const [scoreInnovation, setScoreInnovation] = useState<number | "">("");
  const [scoreTechnical, setScoreTechnical] = useState<number | "">("");
  const [scorePresentation, setScorePresentation] = useState<number | "">("");
  const [scoreImpact, setScoreImpact] = useState<number | "">("");
  const [correcting, setCorrecting] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/assignments");
      if (!res.ok) throw new Error("Failed to load assignments");
      const json = await res.json();
      setAssignments(json.data ?? []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load judge assignments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleAutoAssign = async () => {
    if (!confirm("Are you sure you want to run automated judge assignment across all submitted projects?")) {
      return;
    }
    setAutoAssigning(true);
    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto_assign" }),
      });
      if (!res.ok) throw new Error("Auto-assignment failed");
      toast.success("Automated judge distribution completed");
      await fetchAssignments();
    } catch (err: any) {
      toast.error(err.message || "Failed to run auto-assignment");
    } finally {
      setAutoAssigning(false);
    }
  };

  const openCorrectionForReview = (rev: any) => {
    setReopenReviewId(rev.id);
    setExpectedVersion(rev.version);
    setScoreInnovation(rev.score_innovation ?? "");
    setScoreTechnical(rev.score_technical ?? "");
    setScorePresentation(rev.score_presentation ?? "");
    setScoreImpact(rev.score_impact ?? "");
    setReopenReason("");
    setShowCorrectionModal(true);
  };

  const handleReopenReview = async () => {
    if (!reopenReviewId || reopenReason.trim().length < 5) {
      toast.error("Valid review ID and justification reason (min 5 characters) are required.");
      return;
    }
    setCorrecting(true);
    try {
      const payload: any = {
        reason: reopenReason.trim(),
      };
      if (expectedVersion !== undefined) payload.expected_version = expectedVersion;
      if (scoreInnovation !== "") payload.score_innovation = Number(scoreInnovation);
      if (scoreTechnical !== "") payload.score_technical = Number(scoreTechnical);
      if (scorePresentation !== "") payload.score_presentation = Number(scorePresentation);
      if (scoreImpact !== "") payload.score_impact = Number(scoreImpact);

      const res = await fetch(`/api/admin/reviews/${reopenReviewId}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to reopen review");

      toast.success("Review score correction committed successfully");
      setShowCorrectionModal(false);
      setReopenReviewId("");
      setReopenReason("");
      setExpectedVersion(undefined);
      setScoreInnovation("");
      setScoreTechnical("");
      setScorePresentation("");
      setScoreImpact("");
      await fetchAssignments();
    } catch (err: any) {
      toast.error(err.message || "Failed to execute score correction");
    } finally {
      setCorrecting(false);
    }
  };

  const filteredAssignments = assignments.filter((a) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const judgeName = a.profiles?.name?.toLowerCase() || "";
    const judgeEmail = a.profiles?.email?.toLowerCase() || "";
    const projTitle = a.submissions?.title?.toLowerCase() || "";
    return judgeName.includes(q) || judgeEmail.includes(q) || projTitle.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-secondary uppercase tracking-wider mb-1">
            <Gavel size={14} />
            <span>EVALUATION CONTROL & AUDIT</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
            Judging Operations
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Monitor judge assignments, trigger automated allocation, and execute audited score corrections.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={autoAssigning}
            onClick={handleAutoAssign}
            className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            {autoAssigning ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            <span>Auto-Assign Judges</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCorrectionModal(true)}
            className="px-3.5 py-2 rounded-xl border border-amber-600/30 bg-amber-600/10 text-amber-600 dark:text-amber-400 text-xs font-semibold hover:bg-amber-600/20 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw size={13} />
            <span>Score Correction</span>
          </button>
          <button
            type="button"
            onClick={fetchAssignments}
            disabled={loading}
            className="p-2.5 rounded-xl border border-border bg-card text-foreground hover:bg-accent transition-colors cursor-pointer"
            title="Refresh assignments"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by judge name, email, or project title..."
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-card text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Assignments Table */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 size={24} className="animate-spin text-primary mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Loading judge assignments...</p>
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="p-12 text-center">
            <Gavel size={32} className="mx-auto text-muted-foreground opacity-40 mb-2" />
            <h3 className="text-sm font-bold text-foreground">No judge assignments found</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click &ldquo;Auto-Assign Judges&rdquo; to distribute finalized submissions across the jury panel.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-accent/40 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Judge</th>
                  <th className="py-3 px-4">Assigned Submission</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Evaluation Status</th>
                  <th className="py-3 px-4">Assigned At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredAssignments.map((a) => (
                  <tr key={a.id} className="hover:bg-accent/20 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-foreground">{a.profiles?.name || "Assigned Judge"}</div>
                      <div className="text-[11px] text-muted-foreground">{a.profiles?.email}</div>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-bold text-foreground truncate">
                        {a.submissions?.title || a.submission_id.slice(0, 8)}
                      </div>
                      <div className="text-[11px] text-secondary font-mono">
                        {a.submission_id.slice(0, 8)}...
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-accent text-[11px] font-semibold text-muted-foreground border border-border">
                        {a.submissions?.category || "General"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {a.review ? (
                        a.review.is_complete ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 size={11} />
                            <span>Completed (v{a.review.version})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            <Clock size={11} />
                            <span>In Progress</span>
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">Pending</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-muted-foreground">
                      {new Date(a.assigned_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {a.review && (
                          <button
                            type="button"
                            onClick={() => openCorrectionForReview(a.review)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-600/30 bg-amber-600/10 text-amber-600 dark:text-amber-400 text-xs font-semibold hover:bg-amber-600/20 transition-colors cursor-pointer"
                            title="Execute audited score correction"
                          >
                            <RotateCcw size={11} />
                            <span>Correct</span>
                          </button>
                        )}
                        <Link
                          href={`/judge/evaluate/${a.submission_id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <span>Rubric</span>
                          <ExternalLink size={12} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Score Correction / Reopen Modal */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-600/15 text-amber-600 dark:text-amber-400 border border-amber-600/25">
                <RotateCcw size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Audited Score Correction
                </h3>
                <p className="text-xs text-muted-foreground">
                  Update rubric values or unlock review with mandatory audit justification.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Review UUID
                </label>
                <input
                  type="text"
                  value={reopenReviewId}
                  onChange={(e) => setReopenReviewId(e.target.value)}
                  placeholder="Paste review UUID (e.g. from results or audit logs)..."
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                />
              </div>

              {/* Rubric Score Inputs (1–10) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Innovation
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={scoreInnovation}
                    onChange={(e) => setScoreInnovation(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="1–10"
                    className="w-full p-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Technical
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={scoreTechnical}
                    onChange={(e) => setScoreTechnical(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="1–10"
                    className="w-full p-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Presentation
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={scorePresentation}
                    onChange={(e) => setScorePresentation(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="1–10"
                    className="w-full p-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Impact
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={scoreImpact}
                    onChange={(e) => setScoreImpact(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="1–10"
                    className="w-full p-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Correction Justification (min 5 characters)
                </label>
                <textarea
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="e.g. Authorized recount after mentor discrepancy was verified..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowCorrectionModal(false)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={correcting || !reopenReviewId || reopenReason.trim().length < 5}
                onClick={handleReopenReview}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {correcting && <Loader2 size={13} className="animate-spin" />}
                <span>
                  {scoreInnovation !== "" || scoreTechnical !== "" ? "Commit Correction" : "Unlock for Correction"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
