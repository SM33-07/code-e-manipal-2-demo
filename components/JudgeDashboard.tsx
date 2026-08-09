"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Award, FileText, ClipboardList, CheckSquare } from "lucide-react";

import { SubmissionList, JudgeSubmission } from "./SubmissionList";
import { JudgingInterface } from "./JudgingInterface";
import { Leaderboard } from "./Leaderboard";
import { Confetti } from "./ui/Confetti";
import { SuccessSummaryCard } from "./SuccessSummaryCard";
import { Score } from "@/types/judging";
import { calculateWeightedScore } from "@/utils/scoring";

interface Props {
  judgeId: string;
  judgeName: string;
  onLogout: () => void;
}

export function JudgeDashboard({ judgeId, judgeName, onLogout }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [submissions, setSubmissions] = useState<JudgeSubmission[]>([]);
  const [allScores, setAllScores] = useState<Score[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "graded">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  // Dismiss Celebration overlay state
  const [dismissedCelebration, setDismissedCelebration] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("submissions");

  useEffect(() => {
    setMounted(true);
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    setLoading(true);
    try {
      // Fetch assignments
      const res = await fetch("/api/judging/assignments");
      if (!res.ok) {
        throw new Error(`Failed to fetch assignments: ${res.status} ${res.statusText}`);
      }
      const json = await res.json();
      const data = Array.isArray(json.data) ? json.data : [];

      const mapped: JudgeSubmission[] = data.map((a: any, idx: number) => {
        const sub = a.submissions ?? {};
        const label = `Project ${String.fromCharCode(65 + idx)}`;
        return {
          id: sub.id ?? a.submission_id,
          title: label,
          description: sub.description ?? sub.summary ?? "",
          writeup: sub.description ?? "",
          reflection: sub.technical_challenges ?? "",
          demoUrl: sub.demo_video_url ?? sub.demo_url ?? "",
          teamSize: 1,
          judged: a.reviewed ?? false,
        };
      });

      setSubmissions(mapped);

      // Fetch existing reviews / scores
      const reviewsRes = await fetch("/api/judging/reviews");
      if (!reviewsRes.ok) {
        throw new Error(`Failed to fetch reviews: ${reviewsRes.status} ${reviewsRes.statusText}`);
      }
      const reviewsJson = await reviewsRes.json();
      const reviewsData = Array.isArray(reviewsJson.data) ? reviewsJson.data : [];
      setAllScores(reviewsData);

    } catch (err) {
      console.error("Failed to load assignments or reviews:", err);
    } finally {
      setLoading(false);
    }
  };

  const isDark = resolvedTheme === "dark";

  // Counts based on active submissions data
  const allCount = submissions.length;
  const gradedCount = submissions.filter((s) => s.judged).length;
  const pendingCount = allCount - gradedCount;
  const progressPercent = allCount > 0 ? (gradedCount / allCount) * 100 : 0;
  const isAllGraded = allCount > 0 && gradedCount === allCount;

  // Auto-switch to leaderboard tab when all are graded
  useEffect(() => {
    if (isAllGraded) {
      setActiveTab("leaderboard");
    }
  }, [isAllGraded]);

  // Filter Submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        query === "" ||
        s.title.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "graded" && s.judged) ||
        (statusFilter === "pending" && !s.judged);

      return matchesSearch && matchesStatus;
    });
  }, [submissions, searchQuery, statusFilter]);

  // Paginated Submissions Slice
  const totalPages = Math.max(1, Math.ceil(filteredSubmissions.length / itemsPerPage));
  const activePageSubmissions = useMemo(() => {
    const adjustedPage = Math.min(currentPage, totalPages);
    const startIndex = (adjustedPage - 1) * itemsPerPage;
    return filteredSubmissions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSubmissions, currentPage, totalPages]);

  // Adjust page indicator dynamically
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredSubmissions, totalPages, currentPage]);

  // Calculate top 3 rankings for SuccessSummaryCard
  const topThreeRanked = useMemo(() => {
    return allScores
      .filter((s) => s.isComplete)
      .map((s) => {
        const sub = submissions.find((subItem) => subItem.id === s.submissionId);
        return {
          id: s.submissionId,
          title: sub?.title ?? "Untitled Project",
          score: calculateWeightedScore(s.criteria),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [allScores, submissions]);

  // Celebration trigger: all projects graded and not dismissed
  const showCelebration = allCount > 0 && gradedCount === allCount && !dismissedCelebration;

  // Navigation Logic for Scoring View Takeover
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

  const handleSaveScore = async (score: Score, navigateToNext = false) => {
    try {
      const res = await fetch("/api/judging/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: score.submissionId,
          score_innovation: score.criteria.innovation,
          score_technical: score.criteria.technical,
          score_presentation: score.criteria.presentation,
          score_impact: score.criteria.impact,
          feedback: score.feedback,
          is_complete: score.isComplete,
        }),
      });

      if (!res.ok) throw new Error("Save failed");

      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === score.submissionId ? { ...s, judged: true } : s
        )
      );
      setAllScores((prev) => [
        ...prev.filter((s) => s.submissionId !== score.submissionId),
        score,
      ]);

      if (navigateToNext && hasNext) {
        handleNextSubmission();
      } else {
        setSelectedSubmissionId(null);
      }
    } catch (err) {
      console.error("Save score error:", err);
    }
  };

  if (!mounted) return null;

  // Heritage theme variable classes
  const titleClass = isDark ? "text-[#F5EFE0]" : "text-[#8F102A]";
  const subClass = isDark ? "text-[#A08070]" : "text-[#7A5A4A]";
  const bgCardClass = isDark ? "bg-[#1E1208] border-[#C9A227]/20" : "bg-[#FCF6EF] border-[#EBCFB5]";
  const dividerClass = isDark ? "bg-[#C9A227]/10" : "bg-[#EBCFB5]/40";

  if (loading) {
    return (
      <div className="min-h-[60vh] p-6 flex items-center justify-center">
        <p className="text-[#A08070] font-bold text-base animate-pulse">Loading your assigned submissions...</p>
      </div>
    );
  }

  // Active Scoring View Takeover
  if (selectedSubmission) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 py-8">
        <JudgingInterface
          submission={selectedSubmission}
          judgeId={judgeId}
          existingScore={existingScore}
          onSave={handleSaveScore}
          onBack={() => setSelectedSubmissionId(null)}
          onNext={handleNextSubmission}
          onPrev={handlePrevSubmission}
          hasNext={hasNext}
          hasPrev={hasPrev}
        />
      </div>
    );
  }

  return (
    <div className="w-full pb-16">
      {/* Confetti & Success summary celebration overlay */}
      {showCelebration && (
        <>
          <Confetti />
          <SuccessSummaryCard
            topThree={topThreeRanked}
            onClose={() => setDismissedCelebration(true)}
            onGoToLeaderboard={() => {
              setDismissedCelebration(true);
              setActiveTab("leaderboard");
            }}
          />
        </>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8 mt-6">
          <div className="flex items-center gap-4">
            <Image
              src="/logo.png"
              alt="logo"
              width={56}
              height={56}
              className="w-14 h-14 object-contain"
            />
            <div>
              <h1
                className={`text-3xl sm:text-4xl font-black tracking-tight font-serif ${titleClass}`}
              >
                Judge Workspace
              </h1>
              <p className={`text-base font-medium mt-1 ${subClass}`}>
                Welcome, {judgeName}
              </p>
            </div>
          </div>
          
          <Button
            variant="outline"
            onClick={onLogout}
            className={`
              w-full sm:w-auto h-11 px-5 rounded-xl font-bold transition-all
              ${isDark 
                ? "border-[#C9A227]/20 text-[#D4732A] hover:bg-[#C9A227]/10" 
                : "border-[#EBCFB5] text-[#8F102A] hover:bg-[#8F102A]/5"}
            `}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Workspace tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-transparent flex flex-row gap-4 h-auto p-0 mb-6 border-b border-[#EBCFB5]/30 dark:border-[#C9A227]/10 justify-start">
            <TabsTrigger
              value="submissions"
              disabled={isAllGraded}
              className={`
                px-5 pb-3 pt-1 rounded-none border-b-2 border-transparent bg-transparent
                text-base font-bold shadow-none transition-all disabled:opacity-40 disabled:cursor-not-allowed
                data-[state=active]:bg-transparent data-[state=active]:shadow-none
                ${isDark
                  ? "text-[#A08070] data-[state=active]:border-b-[#F0C060] data-[state=active]:text-[#F0C060]"
                  : "text-[#B89A85] data-[state=active]:border-b-[#8F102A] data-[state=active]:text-[#8F102A]"}
              `}
            >
              <Award className="w-4 h-4 mr-2" />
              Submissions {isAllGraded && "(Completed)"}
            </TabsTrigger>
            <TabsTrigger
              value="leaderboard"
              className={`
                px-5 pb-3 pt-1 rounded-none border-b-2 border-transparent bg-transparent
                text-base font-bold shadow-none transition-all
                data-[state=active]:bg-transparent data-[state=active]:shadow-none
                ${isDark
                  ? "text-[#A08070] data-[state=active]:border-b-[#F0C060] data-[state=active]:text-[#F0C060]"
                  : "text-[#B89A85] data-[state=active]:border-b-[#8F102A] data-[state=active]:text-[#8F102A]"}
              `}
            >
              <FileText className="w-4 h-4 mr-2" />
              Leaderboard
            </TabsTrigger>
          </TabsList>

          {/* Submissions Tab Workspace */}
          <TabsContent value="submissions" className="mt-0 outline-none">
            
            {/* Quick overview stats banner */}
            <div className={`p-6 border rounded-2xl mb-8 flex flex-col md:flex-row items-center justify-between gap-6 ${bgCardClass}`}>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-[#8F102A]/5 dark:bg-[#D4732A]/5 text-[#8F102A] dark:text-[#F0C060]">
                  <CheckSquare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className={`font-bold font-serif text-lg ${titleClass}`}>
                    Assigned Evaluations Progress
                  </h3>
                  <p className={`text-xs ${subClass}`}>
                    Review and grade each assigned project.
                  </p>
                </div>
              </div>

              {/* Progress bar info */}
              <div className="w-full md:max-w-xs space-y-2">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className={subClass}>Grading Complete</span>
                  <span className={titleClass}>{gradedCount} / {allCount} projects</span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-[#8F102A] dark:bg-[#D4732A] h-1.5 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Filters and search container */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              {/* Search bar input */}
              <div className="relative w-full md:max-w-xs">
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="
                    w-full h-11 pl-4 pr-10 text-sm rounded-xl border focus:outline-none focus:ring-1
                    bg-[#FCF6EF]/50 border-[#EBCFB5] text-[#6A4635] focus:border-[#8F102A] focus:ring-[#8F102A]
                    dark:bg-[#0F0A05] dark:border-[#C9A227]/35 dark:text-[#F5EFE0] dark:focus:border-[#D4732A] dark:focus:ring-[#D4732A]
                    transition-all duration-200
                  "
                />
              </div>

              {/* Status pills selector */}
              <div className="flex flex-wrap items-center gap-2">
                {([
                  { key: "all", label: "All Projects", count: allCount },
                  { key: "pending", label: "Pending", count: pendingCount },
                  { key: "graded", label: "Graded", count: gradedCount },
                ] as const).map((filter) => {
                  const isActive = statusFilter === filter.key;
                  return (
                    <button
                      key={filter.key}
                      onClick={() => {
                        setStatusFilter(filter.key);
                        setCurrentPage(1);
                      }}
                      className={`
                        h-10 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 border
                        ${isActive
                          ? "bg-[#8F102A] text-white border-[#8F102A] dark:bg-[#D4732A] dark:text-[#0F0A05] dark:border-[#D4732A] shadow-sm"
                          : "bg-[#FCF6EF]/40 border-[#EBCFB5] text-[#6A4635] hover:bg-[#8F102A]/5 dark:bg-[#1E1208]/40 dark:border-[#C9A227]/25 dark:text-[#A08070] dark:hover:bg-[#C9A227]/10"}
                      `}
                    >
                      {filter.label}
                      <span className={`
                        px-1.5 py-0.5 rounded-md text-[10px] font-extrabold
                        ${isActive 
                          ? "bg-white/20 text-white dark:bg-[#0F0A05]/20 dark:text-[#0F0A05]" 
                          : "bg-[#8F102A]/10 text-[#8F102A] dark:bg-[#D4732A]/10 dark:text-[#F0C060]"}
                      `}>
                        {filter.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submission Grid Cards */}
            <SubmissionList
              submissions={activePageSubmissions}
              onSelectSubmission={setSelectedSubmissionId}
            />

            {/* Grid Pagination Actions */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-10">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`
                    h-10 px-4 rounded-xl font-bold transition-all text-xs
                    ${isDark 
                      ? "border-[#C9A227]/20 text-[#A08070] hover:bg-[#C9A227]/10 disabled:opacity-35" 
                      : "border-[#EBCFB5] text-[#6A4635] hover:bg-[#8F102A]/5 disabled:opacity-35"}
                  `}
                >
                  Previous
                </Button>
                <span className="text-sm font-bold text-[#B89A85] dark:text-[#A08070]">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={`
                    h-10 px-4 rounded-xl font-bold transition-all text-xs
                    ${isDark 
                      ? "border-[#C9A227]/20 text-[#A08070] hover:bg-[#C9A227]/10 disabled:opacity-35" 
                      : "border-[#EBCFB5] text-[#6A4635] hover:bg-[#8F102A]/5 disabled:opacity-35"}
                  `}
                >
                  Next
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="mt-0 outline-none">
            <Leaderboard submissions={submissions} scores={allScores} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
