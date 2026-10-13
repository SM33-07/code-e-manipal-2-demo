"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Award, FileText, CheckSquare } from "lucide-react";

import { SubmissionList, JudgeSubmission } from "./SubmissionList";
import { JudgingInterface } from "./JudgingInterface";
import { Confetti } from "./ui/Confetti";
import { Score } from "@/types/judging";
import { calculateWeightedScore } from "@/utils/scoring";

interface AssignedSubmissionResponse {
  submission_id: string;
  reviewed: boolean;
  submissions: {
    id: string;
    title: string;
    summary?: string | null;
    description?: string | null;
    category?: string | null;
    status?: string;
    demo_url?: string | null;
    demo_video_url?: string | null;
    track?: string | null;
    teams?: { name?: string; track?: string } | null;
  };
  review: {
    id: string;
    is_complete: boolean;
    version: number;
    score_innovation: number | null;
    score_technical: number | null;
    score_presentation: number | null;
    score_impact: number | null;
    feedback: string | null;
  } | null;
}

interface Props {
  judgeId: string;
  judgeName: string;
  onLogout: () => void;
}

export function JudgeDashboard({ judgeId, judgeName, onLogout }: Props) {
  const [mounted, setMounted] = useState(false);

  const [submissions, setSubmissions] = useState<JudgeSubmission[]>([]);
  const [allScores, setAllScores] = useState<Score[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "graded">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  // Celebration state
  const [dismissedCelebration, setDismissedCelebration] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("submissions");

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status === "all" || status === "pending" || status === "graded") {
      setStatusFilter(status);
    }
    setSearchQuery(params.get("q")?.slice(0, 100) ?? "");
    const page = Number.parseInt(params.get("page") || "", 10);
    if (Number.isInteger(page) && page > 0 && page <= 1000) {
      setCurrentPage(page);
    }
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/judging/assignments");
      if (!res.ok) {
        throw new Error(`Failed to fetch assignments: ${res.status} ${res.statusText}`);
      }
      const json = await res.json();
      if (!Array.isArray(json.data)) {
        throw new Error("Assignment response was invalid.");
      }

      const data = json.data as AssignedSubmissionResponse[];
      const mapped: JudgeSubmission[] = data.map((assignment) => {
        const sub = assignment.submissions;
        const reviewStatus = !assignment.review
          ? "not_started"
          : assignment.review.is_complete
            ? "submitted"
            : "in_progress";
        return {
          id: sub.id ?? assignment.submission_id,
          title: sub.title || "Untitled submission",
          description: sub.description ?? sub.summary ?? "",
          writeup: sub.description ?? "",
          reflection: "",
          demoUrl: sub.demo_video_url ?? sub.demo_url ?? "",
          teamName: sub.teams?.name || "Assigned team",
          track: sub.teams?.track || sub.track || sub.category || "",
          reviewStatus,
          reviewVersion: assignment.review?.version ?? null,
        };
      });

      setSubmissions(mapped);
      setAllScores(data.flatMap((assignment): Score[] => {
        const review = assignment.review;
        if (!review) return [];
        return [{
          submissionId: assignment.submission_id,
          judgeId,
          criteria: {
            innovation: review.score_innovation ?? 0,
            technical: review.score_technical ?? 0,
            presentation: review.score_presentation ?? 0,
            impact: review.score_impact ?? 0,
          },
          feedback: review.feedback ?? "",
          isComplete: review.is_complete,
          version: review.version,
        }];
      }));
      setError(null);

    } catch (err) {
      console.error("Failed to load assignments or reviews:", err);
      setError("Could not refresh assigned teams. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const allCount = submissions.length;
  const gradedCount = submissions.filter((s) => s.reviewStatus === "submitted").length;
  const pendingCount = allCount - gradedCount;
  const progressPercent = allCount > 0 ? (gradedCount / allCount) * 100 : 0;
  const isAllGraded = allCount > 0 && gradedCount === allCount;

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        query === "" ||
        s.title.toLowerCase().includes(query) ||
        s.teamName.toLowerCase().includes(query) ||
        s.track.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "graded" && s.reviewStatus === "submitted") ||
        (statusFilter === "pending" && s.reviewStatus !== "submitted");

      return matchesSearch && matchesStatus;
    });
  }, [submissions, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSubmissions.length / itemsPerPage));
  const activePageSubmissions = useMemo(() => {
    const adjustedPage = Math.min(currentPage, totalPages);
    const startIndex = (adjustedPage - 1) * itemsPerPage;
    return filteredSubmissions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSubmissions, currentPage, totalPages]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredSubmissions, totalPages, currentPage]);

  const topThreeRanked = useMemo(() => {
    return allScores
      .filter((s) => s.isComplete)
      .map((s) => {
        const sub = submissions.find((subItem) => subItem.id === s.submissionId);
        return {
          id: s.submissionId,
          title: sub ? `${sub.teamName} — ${sub.title}` : "Untitled Project",
          score: calculateWeightedScore(s.criteria),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [allScores, submissions]);

  const showCelebration = allCount > 0 && gradedCount === allCount && !dismissedCelebration;

  const selectedIndexInFiltered = useMemo(() => {
    if (!selectedSubmissionId) return -1;
    return filteredSubmissions.findIndex((s) => s.id === selectedSubmissionId);
  }, [selectedSubmissionId, filteredSubmissions]);

  const hasNext = selectedIndexInFiltered !== -1 && selectedIndexInFiltered < filteredSubmissions.length - 1;
  const hasPrev = selectedIndexInFiltered > 0;

  const handleNextSubmission = () => {
    if (hasNext) {
      setSelectedSubmissionId(filteredSubmissions[selectedIndexInFiltered + 1].id);
    }
  };

  const handlePrevSubmission = () => {
    if (hasPrev) {
      setSelectedSubmissionId(filteredSubmissions[selectedIndexInFiltered - 1].id);
    }
  };

  const selectedSubmission = submissions.find(
    (s) => s.id === selectedSubmissionId
  );

  const existingScore = selectedSubmissionId
    ? allScores.find((s) => s.submissionId === selectedSubmissionId)
    : undefined;

  const router = useRouter();

  const openEvaluation = (id: string) => {
    const returnParams = new URLSearchParams({
      status: statusFilter,
      q: searchQuery,
      page: String(currentPage),
    });
    const returnTo = `/judge?${returnParams.toString()}`;
    router.push(`/judge/evaluate/${encodeURIComponent(id)}?returnTo=${encodeURIComponent(returnTo)}`);
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="min-h-[50vh] p-6 flex items-center justify-center">
        <p className="text-muted-foreground font-semibold text-sm animate-pulse">Loading assigned submissions...</p>
      </div>
    );
  }

  return (
    <div className="text-foreground flex flex-col pb-16">
      {/* Celebration overlay */}
      {showCelebration && (
        <div className="fixed inset-0 bg-black/75 z-[200] flex items-center justify-center p-4">
          <Confetti />
          <div className="max-w-md w-full border border-border bg-card p-6 sm:p-8 rounded-2xl shadow-2xl text-center">
            <div className="mx-auto w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-4">
              <CheckSquare className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-2">
              All Evaluations Complete!
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-6 leading-relaxed">
              You have submitted reviews for all {allCount} assigned projects. Submitted reviews are locked; contact an administrator if a correction is required.
            </p>
            <Button
              onClick={() => setDismissedCelebration(true)}
              className="w-full bg-primary text-primary-foreground font-bold text-sm py-2.5 rounded-xl shadow-md"
            >
              Continue In Workspace
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        {/* Workspace Title & Context Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5" />
                Jury Evaluation Console
              </span>
              <span className="text-xs text-muted-foreground">&bull;</span>
              <span className="text-xs font-mono text-muted-foreground">{judgeName}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight m-0">
              MY EVALUATION WORKSPACE
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 mb-0">
              Score your assigned hackathon submissions across the 4 official rubric dimensions.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={loadAssignments}
              disabled={loading}
              className="min-h-11 px-3.5 py-2 rounded-xl border border-border bg-card text-foreground hover:bg-muted text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Refresh Queue
            </button>
          </div>
        </div>

        {/* Workspace tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-card flex flex-row gap-1 h-auto p-1 mb-6 border border-border rounded-xl justify-start">
            <TabsTrigger
              value="submissions"
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Award className="w-4 h-4 mr-2" />
              Assigned Submissions ({gradedCount}/{allCount})
            </TabsTrigger>
            <TabsTrigger
              value="guidance"
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <FileText className="w-4 h-4 mr-2" />
              Judging Guidance & Rubric
            </TabsTrigger>
          </TabsList>

          {/* Submissions Tab Workspace */}
          <TabsContent value="submissions" className="mt-0 outline-none">
            {/* Quick overview stats banner */}
            <div className="p-6 border border-border rounded-2xl mb-8 flex flex-col md:flex-row items-center justify-between gap-6 bg-card shadow-sm">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                  <CheckSquare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground m-0">
                    Evaluation Progress
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-0">
                    Review and score each assigned project.
                  </p>
                </div>
              </div>

              {/* Progress bar info */}
              <div className="w-full md:max-w-xs space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="text-foreground">{gradedCount} / {allCount} projects</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-2 transition-all duration-500 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Filters and search container */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="relative w-full md:max-w-xs">
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full h-10 pl-4 pr-4 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>

              {/* Status pills selector */}
              <div className="flex flex-wrap items-center gap-2">
                {([
                  { key: "all", label: "All Projects", count: allCount },
                  { key: "pending", label: "Needs Review", count: pendingCount },
                  { key: "graded", label: "Submitted", count: gradedCount },
                ] as const).map((filter) => {
                  const isActive = statusFilter === filter.key;
                  return (
                    <button
                      key={filter.key}
                      onClick={() => {
                        setStatusFilter(filter.key);
                        setCurrentPage(1);
                      }}
                      className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border cursor-pointer ${
                        isActive
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {filter.label}
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                        isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        {filter.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submission Grid Cards */}
            {error && (
              <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                <p>{error}</p>
                <button type="button" onClick={loadAssignments} className="mt-3 min-h-11 rounded-lg border border-current px-3 font-semibold">
                  Retry
                </button>
              </div>
            )}
            <SubmissionList
              submissions={activePageSubmissions}
              onSelectSubmission={openEvaluation}
            />

            {/* Grid Pagination Actions */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-10">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-9 px-4 rounded-xl font-bold text-xs border-border text-foreground hover:bg-muted disabled:opacity-35"
                >
                  Previous
                </Button>
                <span className="text-xs font-bold text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-9 px-4 rounded-xl font-bold text-xs border-border text-foreground hover:bg-muted disabled:opacity-35"
                >
                  Next
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Judging Guidance & Rubric Tab */}
          <TabsContent value="guidance" className="mt-0 outline-none">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="text-xs font-bold text-secondary uppercase tracking-wider mb-2">
                  Criterion 01 • Weight: 30%
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">
                  Technical Architecture & Execution
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Evaluate system complexity, code quality, repo cleanliness, reproducibility, and architectural soundness. Assess whether the solution leverages modern engineering practices, scalable design patterns, and robust error handling.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="text-xs font-bold text-secondary uppercase tracking-wider mb-2">
                  Criterion 02 • Weight: 30%
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">
                  Innovation & Originality
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Evaluate novelty of the approach, creative problem solving, and technological ambition. Does this project offer an innovative perspective or breakthrough mechanism compared to existing off-the-shelf software?
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="text-xs font-bold text-secondary uppercase tracking-wider mb-2">
                  Criterion 03 • Weight: 20%
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">
                  Practical Impact & Real-World Utility
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Assess real-world viability, addressable problem significance, and operational feasibility. Does this solution provide genuine value to target users, businesses, or public infrastructure?
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="text-xs font-bold text-secondary uppercase tracking-wider mb-2">
                  Criterion 04 • Weight: 20%
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">
                  Presentation & Documentation
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Review the quality of technical documentation, README setup instructions, live prototype walkthrough, and clarity of the team&apos;s demonstration.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
