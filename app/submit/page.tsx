"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import type { Submission } from "@/components/SubmissionForm";
import { toast } from "sonner";
import {
  Code2,
  Trophy,
  Zap,
  Search,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
  Lock,
} from "lucide-react";

// ─── Dynamic Imports (SSR disabled) ──────────────────────────────────────────
const SubmissionForm = dynamic(
  () => import("@/components/SubmissionForm").then((m) => m.SubmissionForm),
  { ssr: false }
);
const SubmissionCard = dynamic(
  () => import("@/components/SubmissionCard").then((m) => m.SubmissionCard),
  { ssr: false }
);
const AnimatedCounter = dynamic(
  () => import("@/components/AnimatedCounter").then((m) => m.AnimatedCounter),
  { ssr: false }
);

import { OFFICIAL_TRACKS } from "@/lib/event/eventConstants";

const CATEGORY_FILTERS = [
  "All",
  ...OFFICIAL_TRACKS,
];

import { SpotlightCard } from "@/components/ui/SpotlightCard";

// ─── Stat Card Component ──────────────────────────────────────────────────────
function StatCard({
  value,
  label,
  suffix = "",
  subtitle = "",
  badge = "",
}: {
  value: number | null;
  label: string;
  suffix?: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <SpotlightCard className="p-5 flex-1 min-w-[200px] text-left transition-all hover:-translate-y-0.5">
      {badge && (
        <div className="absolute top-3.5 right-3.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
          ↗ {badge}
        </div>
      )}
      <div className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">
        {label}
      </div>
      <div className="text-3xl font-extrabold text-foreground leading-tight mb-1">
        {value === null ? "—" : <AnimatedCounter target={value} suffix={suffix} />}
      </div>
      {subtitle && (
        <div className="text-xs text-muted-foreground">
          {subtitle}
        </div>
      )}
    </SpotlightCard>
  );
}

// ─── Tab Button Component ─────────────────────────────────────────────────────
function TabButton({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-card text-foreground hover:bg-muted border border-border"
      }`}
    >
      {children}
      {count !== undefined && (
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-bold ${
            active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────────
export default function SubmissionPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"submit" | "browse" | "leaderboard">("submit");
  const [publicResults, setPublicResults] = useState<any[]>([]);
  const [resultsMeta, setResultsMeta] = useState<{ published: boolean; status: string; publish_time: string | null }>({
    published: false,
    status: "draft",
    publish_time: null,
  });

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [showFilters, setShowFilters] = useState(false);

  // Countdown timer state
  const [timerConfig, setTimerConfig] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [timeRemainingHours, setTimeRemainingHours] = useState<number>(0);
  const [countdownBadge, setCountdownBadge] = useState<string>("Ongoing");
  const [countdownSubtitle, setCountdownSubtitle] = useState<string>("until deadline");
  const [isLocked, setIsLocked] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    fetchTimerConfig();
    fetchTeam();
    fetchPublicResults();
    fetchSubmissions();
  }, []);

  const fetchPublicResults = async () => {
    try {
      const res = await fetch("/api/results/public");
      const json = await res.json();
      // Response shape: { data: RankedResult[] | [], meta: { published: bool, status, publish_time } }
      const isPublished = json.meta?.published ?? false;
      const resultsArr = Array.isArray(json.data) ? json.data : [];
      setPublicResults(resultsArr);
      setResultsMeta({
        published: isPublished,
        status: json.meta?.status ?? "false",
        publish_time: json.meta?.publish_time ?? null,
      });
    } catch {
      // silently fail
    }
  };

  const fetchTimerConfig = async () => {
    try {
      // Correct endpoint: /api/event-config (public event configuration)
      const res = await fetch("/api/event-config");
      const json = await res.json();
      if (json.data) setTimerConfig(json.data);
    } catch {
      // silently fail
    }
  };

  const fetchTeam = async () => {
    try {
      const res = await fetch("/api/teams");
      const json = await res.json();
      if (json.data) setTeam(json.data);
    } catch {
      // silently fail
    }
  };

  const fetchSubmissions = async () => {
    try {
      const res = await fetch("/api/submissions");
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Invalid JSON");
      }

      if (!res.ok) {
        throw new Error(data?.error || "Failed");
      }

      const mapped = (data.data || []).map((item: any) => ({
        id: item.id,
        submittedAt: item.created_at || item.submitted_at,
        projectName: item.title,
        tagline: item.tagline,
        problemSolved: item.problem_solved,
        solutionSummary: item.summary,
        techStack: item.technologies || [],
        architectureOverview: item.architecture_overview,
        technicalChallenges: item.technical_challenges,
        githubUrl: item.github_url,
        videoUrl: item.demo_video_url,
        docsUrl: item.docs_url,
        whatWorkedWell: item.what_worked_well,
        challengesFaced: item.challenges_faced,
        lessonsLearned: item.lessons_learned,
        futureRoadmap: item.future_roadmap,
        teamName: item.teams?.name || "Team",
        teamMembers: item.teams?.team_members?.map((m: any) => m.profiles?.name).filter(Boolean) || [],
        category: item.category,
      }));

      setSubmissions(mapped);
    } catch (err) {
      console.error("CLIENT ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time Countdown calculation
  useEffect(() => {
    const updateCountdown = () => {
      const isStarted = timerConfig?.hackathon_is_started === "true";
      const startTime = timerConfig?.hackathon_start_time
        ? new Date(timerConfig.hackathon_start_time).getTime()
        : null;
      const configuredDuration = Number(timerConfig?.hackathon_duration_hours);
      const durationHours = Number.isFinite(configuredDuration) ? configuredDuration : 0;

      if (!isStarted || !startTime) {
        setTimeRemainingHours(durationHours);
        setCountdownBadge("Scheduled");
        setCountdownSubtitle("event not started");
        setIsLocked(true);
        return;
      }

      const globalEnd = startTime + durationHours * 60 * 60 * 1000;
      let effectiveEnd = globalEnd;
      const hasExtension = team && team.deadline_extension;
      if (hasExtension) {
        effectiveEnd = new Date(team.deadline_extension).getTime();
      }

      const remainingMs = effectiveEnd - Date.now();

      if (remainingMs <= 0) {
        setTimeRemainingHours(0);
        setCountdownBadge("Closed");
        setCountdownSubtitle(hasExtension ? "extension expired" : "deadline passed");
        setIsLocked(true);
      } else {
        const hoursLeft = Math.ceil(remainingMs / (1000 * 60 * 60));
        setTimeRemainingHours(hoursLeft);
        setCountdownBadge(hasExtension ? "Extended" : "Ongoing");
        setCountdownSubtitle(hasExtension ? "extended deadline" : "until deadline");
        setIsLocked(false);
      }
    };

    updateCountdown();
    const ticker = setInterval(updateCountdown, 1000);
    return () => clearInterval(ticker);
  }, [timerConfig, team]);

  const handleSubmission = async (newSubmission: any) => {
    try {
      const payload = {
        team_id: newSubmission.teamId,
        teamName: newSubmission.teamName,
        title: newSubmission.projectName,
        summary: newSubmission.solutionSummary,
        description: newSubmission.solutionSummary,
        category: newSubmission.category,
        technologies: newSubmission.techStack || [],
        github_url: newSubmission.githubUrl,
        demo_url: newSubmission.demoUrl,
        docs_url: newSubmission.docsUrl,
        demo_video_url: newSubmission.videoUrl,
        tagline: newSubmission.tagline,
        problem_solved: newSubmission.problemSolved,
        architecture_overview: newSubmission.architectureOverview,
        technical_challenges: newSubmission.technicalChallenges,
        what_worked_well: newSubmission.whatWorkedWell,
        challenges_faced: newSubmission.challengesFaced,
        lessons_learned: newSubmission.lessonsLearned,
        future_roadmap: newSubmission.futureRoadmap,
      };

      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Invalid JSON");
      }

      if (!res.ok) {
        toast.error(data.error || "Submission failed");
        return;
      }

      setSubmissions((prev) => [data.data, ...prev]);
      toast.success("Project submitted successfully!");
      router.push(`/submission-result/${data.data.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    }
  };

  const filteredSubmissions = submissions.filter((s) => {
    const matchesSearch =
      !searchQuery ||
      s.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.teamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.solutionSummary || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.tagline || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      activeCategory === "All" || s.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(
    new Set(submissions.map((s) => s.category).filter(Boolean)),
  );

  if (!mounted) return null;

  return (
    <ProtectedRoute>
      <div className="min-h-screen text-foreground relative z-10">

        {/* ── Hero Container ── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-8 text-left">
          {/* Approved Capsule Banner */}
          <div className="inline-flex items-center gap-2.5 px-6 py-2 rounded-full bg-primary/15 border border-primary/30 text-primary dark:bg-[#A85346]/25 dark:text-[#E9DDC8] dark:border-[#B88A45]/40 text-xs sm:text-sm font-bold tracking-wider uppercase mb-5 shadow-sm">
            <Sparkles className="w-4 h-4 text-secondary shrink-0" />
            Hackathon Submission Portal
            <Sparkles className="w-4 h-4 text-secondary shrink-0" />
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl font-black leading-[1.02] tracking-tight mb-4">
            <span className="block text-foreground">Project submission</span>
            <span className="block text-primary text-3xl sm:text-5xl">Document the build.</span>
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mb-8 leading-relaxed">
            Add your project details, repository, and demonstration links for the event team and judges.
          </p>

          {/* Stats */}
          <div className="flex flex-wrap gap-4 justify-center mb-8">
            <StatCard
              value={submissions.length}
              label="Total Submissions"
              subtitle="registered projects"
              badge="Live"
            />
            <StatCard
              value={categories.length}
              label="Submitted categories"
              subtitle="across current projects"
            />
            <StatCard
              value={timerConfig?.hackathon_duration_hours ? timeRemainingHours : null}
              label="Time Remaining"
              suffix="h"
              subtitle={countdownSubtitle}
              badge={timerConfig?.hackathon_duration_hours ? countdownBadge : "Awaiting config"}
            />
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-3 justify-center mb-8">
            <TabButton
              active={activeTab === "submit"}
              onClick={() => setActiveTab("submit")}
            >
              <Zap className="w-4 h-4" />
              Submit Project
            </TabButton>
            <TabButton
              active={activeTab === "browse"}
              onClick={() => setActiveTab("browse")}
              count={submissions.length}
            >
              <Trophy className="w-4 h-4" />
              Review Your Submission
            </TabButton>
            {resultsMeta.published && (
              <TabButton
                active={activeTab === "leaderboard"}
                onClick={() => setActiveTab("leaderboard")}
              >
                <Trophy className="w-4 h-4 text-secondary" />
                Leaderboard
              </TabButton>
            )}
          </div>
        </section>

        {/* ── Content Container ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-20">

          {/* ── Submit Tab ── */}
          {activeTab === "submit" && (
            <div className="w-full flex flex-col gap-6">
              <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
                {/* Form header */}
                <div className="p-6 md:p-8 border-b border-border bg-muted/20">
                  <h2 className="text-xl md:text-2xl font-bold text-foreground m-0">
                    Project Submission Form
                  </h2>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1 mb-0">
                    Provide all 5 sections of your technical write-up. Fields marked with <span className="text-destructive">*</span> are mandatory.
                  </p>
                </div>

                {isLocked && (
                  <div className="m-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-destructive/20 text-destructive flex items-center justify-center shrink-0">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="m-0 text-sm font-bold text-destructive">
                        Submissions Locked
                      </h4>
                      <p className="m-0 mt-1 text-xs text-muted-foreground leading-relaxed">
                        {timerConfig?.hackathon_is_started !== "true"
                          ? "The hackathon event has not been started yet by the administrators. Submissions will open once the countdown begins."
                          : "Submissions for Code-e-Manipal 2.0 are now closed as the deadline has passed."}
                      </p>
                    </div>
                  </div>
                )}

                <div className="p-6 md:p-8">
                  <SubmissionForm onSubmit={handleSubmission} disabled={isLocked} />
                </div>
              </div>
            </div>
          )}

          {/* ── Browse Tab ── */}
          {activeTab === "browse" && (
            <div className="w-full flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground m-0">
                    Submitted Projects
                  </h2>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1 mb-0">
                    Explore and review project write-ups submitted across all tracks.
                  </p>
                </div>

                {/* Search */}
                {submissions.length > 0 && (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search submissions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-card border border-border text-foreground text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                      />
                    </div>
                    <button
                      onClick={() => setShowFilters((v) => !v)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                        showFilters
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      Filter
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>
                )}
              </div>

              {/* Filters */}
              {showFilters && (
                <div className="p-4 rounded-xl bg-card border border-border flex flex-wrap gap-2">
                  {CATEGORY_FILTERS.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                        activeCategory === cat
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {/* Grid */}
              {loading ? (
                <div className="py-20 text-center">
                  <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3" />
                  <p className="text-xs text-muted-foreground">Loading submissions...</p>
                </div>
              ) : filteredSubmissions.length === 0 ? (
                <div className="py-16 text-center rounded-2xl bg-card border border-border p-8">
                  <div className="w-12 h-12 rounded-xl bg-muted text-muted-foreground flex items-center justify-center mx-auto mb-3">
                    <Code2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-1">
                    {searchQuery ? "No matching projects found" : "No submissions registered yet"}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    {searchQuery ? "Try refining your query or track filter." : "Be the first team to submit a project!"}
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={() => setActiveTab("submit")}
                      className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:opacity-95"
                    >
                      Open Submission Form →
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {filteredSubmissions.map((submission, i) => (
                    <SubmissionCard
                      key={submission.id}
                      submission={submission}
                      index={i}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Leaderboard Tab ── */}
          {activeTab === "leaderboard" && (
            <div className="w-full flex flex-col gap-6">
              {!resultsMeta.published ? (
                <div className="rounded-2xl bg-card border border-border p-12 text-center shadow-sm">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-7 h-7" />
                  </div>

                  {resultsMeta.status === "publishing" ? (
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-2">
                        Official Results Announcement in Progress!
                      </h3>
                      <p className="text-xs text-muted-foreground max-w-md mx-auto mb-4">
                        Evaluation scores are being verified. The leaderboard will be released shortly.
                      </p>
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 font-mono font-bold text-xs animate-pulse">
                        <span>⏳ Unlocks in 5 Minutes</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-2">
                        Leaderboard Locked
                      </h3>
                      <p className="text-xs text-muted-foreground max-w-md mx-auto">
                        Official evaluations are currently underway. Results will be published here upon completion of the judging rounds.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl bg-card border border-border p-6 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-foreground flex items-center gap-2 m-0">
                        <Trophy className="text-secondary w-5 h-5" />
                        Official Hackathon Leaderboard
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 mb-0">
                        Final evaluated rankings of Code-e-Manipal 2.0 submissions
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 uppercase tracking-wider">
                      Verified
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                          <th className="py-3 px-4 font-bold">Rank</th>
                          <th className="py-3 px-4 font-bold">Project</th>
                          <th className="py-3 px-4 font-bold">Category</th>
                          <th className="py-3 px-4 font-bold text-right">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {publicResults.map((r, idx) => (
                          <tr key={r.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-sm">
                              {idx === 0 ? "🥇 #1" : idx === 1 ? "🥈 #2" : idx === 2 ? "🥉 #3" : `#${idx + 1}`}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-foreground">{r.title}</div>
                              <div className="text-xs text-muted-foreground line-clamp-1">{r.summary}</div>
                            </td>
                            <td className="py-3.5 px-4 text-xs font-medium text-muted-foreground">
                              {r.category}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-primary text-sm">
                              {r.computed?.total_score?.toFixed(2) ?? "0.00"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
