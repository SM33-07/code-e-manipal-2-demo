"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/AuthProvider";
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
  Github,
  Globe,
  Lock,
} from "lucide-react";


// ─── Dynamic Imports (SSR disabled) ──────────────────────────────────────────
// SubmissionForm: Main form component with 5 sections (Project, Tech, Links, Reflection, Team)
// SubmissionCard: Card displayed in Browse tab for each submission
// TypewriterText: Animated rotating text in hero
// AnimatedCounter: Number animation for stat cards
const SubmissionForm = dynamic(
  () => import("@/components/SubmissionForm").then((m) => m.SubmissionForm),
  { ssr: false }
);
const SubmissionCard = dynamic(
  () => import("@/components/SubmissionCard").then((m) => m.SubmissionCard),
  { ssr: false }
);
const TypewriterText = dynamic(
  () => import("@/components/Typewriter").then((m) => m.TypewriterText),
  { ssr: false }
);
const AnimatedCounter = dynamic(
  () => import("@/components/AnimatedCounter").then((m) => m.AnimatedCounter),
  { ssr: false }
);



const CATEGORY_FILTERS = [
  "All",
  "AI/ML",
  "Web Dev",
  "Mobile",
  "Blockchain",
  "IoT",
  "Cybersecurity",
  "Other",
];

// ─── Stat Card Component ──────────────────────────────────────────────────────
// Renders animated stat boxes in hero (Submissions, Categories, Hours Left)
// Design: left accent border, left-aligned label + large value + subtitle, badge pill top-right
function StatCard({
  value,
  label,
  suffix = "",
  delay = 0,
  subtitle = "",
  badge = "",
  accentColor = "#8F102A",
}: {
  value: number;
  label: string;
  suffix?: string;
  delay?: number;
  subtitle?: string;
  badge?: string;
  accentColor?: string;
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        padding: "24px 28px 22px",
        borderRadius: "16px",
        background: "var(--card)",
        border: "1px solid var(--jaipur-secondary-light)",
        borderLeft: `4px solid ${accentColor}`,
        opacity: visible ? 1 : 0,
        transform: visible ? (hovered ? "translateY(-4px)" : "translateY(0)") : "translateY(20px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.3s cubic-bezier(0.22,1,0.36,1), box-shadow 0.3s ease`,
        boxShadow: hovered ? "0 12px 30px rgba(143,16,42,0.16)" : "0 4px 20px rgba(143,16,42,0.08)",
        minWidth: "210px",
        textAlign: "left",
      }}
    >
      {/* Badge pill — top right */}
      {badge && (
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "3px 10px",
            borderRadius: "999px",
            background: `${accentColor}18`,
            color: accentColor,
            fontSize: "0.72rem",
            fontWeight: 600,
          }}
        >
          ↗ {badge}
        </div>
      )}

      {/* Label */}
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--muted-foreground)",
          fontWeight: 500,
          marginBottom: "6px",
        }}
      >
        {label}
      </div>

      {/* Value */}
      <div
        style={{
          fontSize: "2rem",
          fontWeight: 800,
          color: "var(--foreground)",
          lineHeight: 1.1,
          marginBottom: "6px",
        }}
      >
        <AnimatedCounter target={value} suffix={suffix} />
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div
          style={{
            fontSize: "0.72rem",
            color: "var(--muted-foreground)",
            opacity: 0.7,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

// ─── Tab Button Component ─────────────────────────────────────────────────────
// Header navigation tabs: "Submit" and "Browse"
// Controls: active/hover colors, border, background, badge count styling
// Active: maroon bg, cream text | Hover: light cream bg | Default: cream bg, brown text
function TabButton({
  active,
  onClick,
  children,
  count,
  isDark = false,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
  isDark?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "10px 22px",
        borderRadius: "10px",
        border: active
          ? "none"
          : hovered
            ? isDark
              ? "1px solid rgba(212,115,42,0.45)"
              : "1px solid #E9C39B"
            : isDark
              ? "1px solid rgba(201,162,39,0.25)"
              : "1px solid #EBCFB5",
        background: active
          ? isDark
            ? "#D4732A"
            : "#8F102A"
          : hovered
            ? isDark
              ? "rgba(212,115,42,0.18)"
              : "#FCEAD8"
            : isDark
              ? "rgba(30,18,8,0.72)"
              : "#FFF6ED",
        color: active
          ? isDark
            ? "#0F0A05"
            : "#FFF7F1"
          : hovered
            ? isDark
              ? "#F0C060"
              : "#A15C2E"
            : isDark
              ? "#B89A85"
              : "#A15C2E",
        fontSize: "0.9rem",
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.25s ease",
        display: "flex",
        alignItems: "center",
        gap: "7px",
        boxShadow: active
          ? isDark
            ? "0 4px 16px rgba(212,115,42,0.3)"
            : "0 4px 16px rgba(143,16,42,0.3)"
          : "none",
        whiteSpace: "nowrap",
      }}
    >
      {children}
      {count !== undefined && (
        <span
          style={{
            fontSize: "0.72rem",
            padding: "1px 6px",
            borderRadius: "999px",
            background: active
              ? isDark
                ? "rgba(15,10,5,0.25)"
                : "rgba(255,247,241,0.3)"
              : isDark
                ? "rgba(201,162,39,0.15)"
                : "rgba(235,207,181,0.3)",
            color: active
              ? isDark
                ? "#0F0A05"
                : "#FFF7F1"
              : isDark
                ? "#F0C060"
                : "#A15C2E",
            transition: "all 0.25s ease",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Pulse Ring Component ─────────────────────────────────────────────────────
// Animated pulsing dot for "Live" badge in header
// Controls: outer ring color (gold), inner dot color, animation timing
function PulseRing() {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        width: "10px",
        height: "10px",
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "#D59B3D",
          animation: "pulse-ring-outer 2s ease-out infinite",
        }}
      />
      <span
        style={{
          position: "absolute",
          inset: "2px",
          borderRadius: "50%",
          background: "#E8B55A",
        }}
      />
      <style>{`
        @keyframes pulse-ring-outer {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </span>
  );
}

// ─── User Menu Component ────────────────────────────────────────────────────────
// Header user avatar + dropdown with email and logout
// Controls: button style (secondary), avatar gradient (maroon), dropdown bg/border/shadow
// Logout button: maroon text, hover background
function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = async () => {
    logout();
    router.push("/login");
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 12px",
          borderRadius: "6px",
          background: "#FFF8F1",
          border: "1px solid #EBC9AA",
          color: "#9A5A2B",
          fontSize: "0.75rem",
          fontWeight: 500,
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#FCEAD8";
          e.currentTarget.style.borderColor = "#EBCFB5";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#FFF8F1";
          e.currentTarget.style.borderColor = "#EBC9AA";
        }}
      >
        <div
          style={{
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #8F102A, #A61B36)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.65rem",
            color: "#FFF6EE",
            fontWeight: 700,
          }}
        >
          {(user?.name || user?.email || "User").charAt(0).toUpperCase()}
        </div>
        <span>{user?.name}</span>
      </button>

      {showMenu && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 10,
            marginTop: "8px",
            background: "rgba(255,248,239,0.98)",
            border: "1px solid #EBCFB5",
            borderRadius: "8px",
            padding: "8px 0",
            minWidth: "160px",
            zIndex: 1000,
            boxShadow: "0 6px 24px rgba(173,114,55,0.12)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid #EBCFB5",
              fontSize: "0.7rem",
              color: "#B89A85",
            }}
          >
            {user?.email}
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "none",
              border: "none",
              color: "#8F102A",
              fontSize: "0.75rem",
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(143,16,42,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none";
            }}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────────
// State:
//   activeTab: "submit" | "browse" - switches between form and gallery
//   submissions: array of all submissions from API
//   loading: shows spinner while fetching
//   searchQuery: text filter for browse grid
//   activeCategory: category filter pill selection
//   headerVisible/heroVisible: entrance animation triggers
//   showFilters: toggles category filter pills visibility
export default function Home() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "submit" | "browse" | "leaderboard"
  >("submit");
  const [publicResults, setPublicResults] = useState<any[]>([]);
  const [resultsMeta, setResultsMeta] = useState<{ published: boolean; status: string; publish_time: string | null }>({
    published: false,
    status: "false",
    publish_time: null,
  });
  const [loadingResults, setLoadingResults] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [heroVisible, setHeroVisible] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Timer & Team states
  const [timerConfig, setTimerConfig] = useState<{
    hackathon_start_time?: string;
    hackathon_duration_hours?: string;
    hackathon_is_started?: string;
  } | null>(null);
  const [team, setTeam] = useState<any>(null);
  const [timeRemainingHours, setTimeRemainingHours] = useState<number>(48);
  const [countdownBadge, setCountdownBadge] = useState<string>("Ongoing");
  const [countdownSubtitle, setCountdownSubtitle] = useState<string>("until deadline");
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // Fetch timer config and team details on mount
  useEffect(() => {
    const fetchTimerAndTeam = async () => {
      try {
        const res = await fetch("/api/event-config");
        if (res.ok) {
          const json = await res.json();
          setTimerConfig(json.data || null);
        }
      } catch (err) {
        console.error("Failed to load event config:", err);
      }

      try {
        const res = await fetch("/api/teams");
        if (res.ok) {
          const json = await res.json();
          setTeam(json.data || null);
        }
      } catch (err) {
        console.error("Failed to load team details:", err);
      }
    };

    fetchTimerAndTeam();
    const interval = setInterval(fetchTimerAndTeam, 5000); // Poll every 5s for publishing status
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchPublicResults = async () => {
      setLoadingResults(true);
      try {
        const res = await fetch("/api/results/public");
        if (res.ok) {
          const json = await res.json();
          setPublicResults(json.data || []);
          setResultsMeta({
            published: json.meta?.published ?? false,
            status: (json.meta?.status as string) ?? (json.meta?.published ? "true" : "false"),
            publish_time: (json.meta?.publish_time as string) ?? null,
          });
        }
      } catch (err) {
        console.error("Failed to load public results:", err);
      } finally {
        setLoadingResults(false);
      }
    };

    fetchPublicResults();
    const interval = setInterval(fetchPublicResults, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // Update countdown ticking
  useEffect(() => {
    const updateCountdown = () => {
      if (!timerConfig) return;

      const isStarted = timerConfig.hackathon_is_started === "true";
      if (!isStarted) {
        const durationHours = parseFloat(timerConfig.hackathon_duration_hours || "48");
        setTimeRemainingHours(durationHours);
        setCountdownBadge("Not Started");
        setCountdownSubtitle("yet to begin");
        setIsLocked(true);
        return;
      }

      const start = new Date(timerConfig.hackathon_start_time || "").getTime();
      const durationHours = parseFloat(timerConfig.hackathon_duration_hours || "48");
      const globalEnd = start + durationHours * 60 * 60 * 1000;

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

  // Entrance animations on mount
  useEffect(() => {
    setMounted(true);
    setTimeout(() => setHeroVisible(true), 100);
  }, []);

  // Fetch submissions from server on mount
  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const res = await fetch("/api/submissions");

      const text = await res.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error("❌ NOT JSON:", text);
        throw new Error("Invalid JSON");
      }

      if (!res.ok) {
        console.error("🔥 API ERROR:", data);
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
      setLoading(false); // ✅ ALWAYS RUNS
    }
  };

  const router = useRouter(); // ✅ ADD THIS at top of component

  const isDark = mounted && resolvedTheme === "dark";

  // ─── handleSubmission ────────────────────────────────────────────────────────
  // Called by SubmissionForm onSubmit
  // Maps form data to API payload, POSTs to /api/submissions
  // On success: prepends new submission to list, shows toast, redirects to result page
  const handleSubmission = async (newSubmission: any) => {
    try {
      const payload = {
        team_id: newSubmission.teamId, // ⚠️ IMPORTANT
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error("RAW:", text);
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

  // ─── filteredSubmissions ─────────────────────────────────────────────────────
  // Derived state: filters submissions by searchQuery (name, team, summary, tagline)
  // and activeCategory. Used in Browse tab grid.
  const filteredSubmissions = submissions.filter((s) => {
    const matchesSearch =
      !searchQuery ||
      s.projectName
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      s.teamName
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (s.solutionSummary || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (s.tagline || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    const matchesCategory =
      activeCategory === "All" || s.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(
    new Set(submissions.map((s) => s.category).filter(Boolean)),
  );

  return (
    <ProtectedRoute>
      <div
        style={{
          minHeight: "100vh",
          color: "var(--foreground)",
          position: "relative",
          zIndex: 2,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >

        {/* ── Hero ── */}
        <section
          style={{
            position: "relative",
            zIndex: 10,
            textAlign: "center",
            paddingTop: "128px",
            paddingBottom: "40px",
            paddingLeft: "80px",
            paddingRight: "32px",
            maxWidth: "1280px",
            margin: "0 auto",
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible
              ? "translateY(0)"
              : "translateY(30px)",
            transition:
              "opacity 0.8s ease 0.1s, transform 0.8s cubic-bezier(0.22,1,0.36,1) 0.1s",
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "170px",
              padding: "15px 14px",
              borderRadius: "999px",
              background: "#8F102A",
              border: "1px solid #E9C39B",
              marginBottom: "24px",
              fontSize: "1.48rem",
              color: "#FFF6EE",
              fontWeight: 500,
              letterSpacing: "0.03em",
            }}
          >
            <Sparkles style={{ width: "27px", height: "22px", color: "#D59B3D" }} />
            Hackathon Submission Portal
            <Sparkles style={{ width: "27px", height: "22px", color: "#D59B3D" }} />
          </div>

          {/* Main heading */}
          <h1
            style={{
              fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
              fontWeight: 800,
              lineHeight: 1.1,
              marginBottom: "16px",
              letterSpacing: "-0.02em",
            }}
          >
            <span style={{ color: "var(--jaipur-primary)", display: "block" }}>
              Build the Future,
            </span>
            <span
              style={{
                color: "var(--jaipur-gold)",
                display: "block",
                animation: "header-glow 3s ease-in-out infinite",
              }}
            >
              <TypewriterText
                texts={[
                  "Submit Your Vision",
                  "Share Your Innovation",
                  "Launch Your Idea",
                  "Show Your Talent",
                ]}
              />
            </span>
          </h1>

          <p
            style={{
              fontSize: "1.05rem",
              color: "var(--muted-foreground)",
              maxWidth: "560px",
              margin: "0 auto 36px",
              lineHeight: 1.7,
            }}
          >
            Join hundreds of developers building the next
            generation of technology. Submit your project, get
            discovered, and compete for glory.
          </p>

          {/* Stats */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
              gap: "16px",
              flexWrap: "wrap",
              margin: "0 0 36px",
              marginLeft: "calc((100% - 560px) / 2 - 70px)",
            }}
          >
            <StatCard
              value={submissions.length}
              label="Total Submissions"
              subtitle="registered projects"
              badge="Live"
              accentColor="#8F102A"
              delay={400}
            />
            <StatCard
              value={categories.length || 6}
              label="Active Tracks"
              subtitle="tech categories"
              badge="Open"
              accentColor="#C9A227"
              delay={550}
            />
            <StatCard
              value={timeRemainingHours}
              label="Time Remaining"
              suffix="h"
              subtitle={countdownSubtitle}
              badge={countdownBadge}
              accentColor={countdownBadge === "Closed" ? "#8F102A" : countdownBadge === "Extended" ? "#C9A227" : "#D4732A"}
              delay={700}
            />
          </div>

          {/* ── Tab Buttons below hero ── */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
              gap: "12px",
              marginLeft: "calc((100% - 560px) / 2 + 20px)",
            }}
          >
            <TabButton
              active={activeTab === "submit"}
              onClick={() => setActiveTab("submit")}
              isDark={isDark}
            >
              <Zap style={{ width: "14px", height: "14px" }} />
              Submit Project
            </TabButton>
            <TabButton
              active={activeTab === "browse"}
              onClick={() => setActiveTab("browse")}
              count={submissions.length}
              isDark={isDark}
            >
              <Trophy style={{ width: "14px", height: "14px" }} />
              Review Your Submission
            </TabButton>
            <TabButton
              active={activeTab === "leaderboard"}
              onClick={() => setActiveTab("leaderboard")}
              isDark={isDark}
            >
              <Trophy style={{ width: "14px", height: "14px" }} />
              Leaderboard
            </TabButton>
          </div>
        </section>

        {/* ── Main Container ── */}
        <main
          style={{
            position: "relative",
            zIndex: 10,
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "0px 32px 80px 0px",
          }}
        >
          {/* ── Submit Tab ── */}
          {activeTab === "submit" && (
            <div
              style={{
                animation:
                  "float-up 0.5s cubic-bezier(0.22,1,0.36,1) forwards",
                display: "flex",
                justifyContent: "flex-start",
                width: "100%",
                marginLeft: "calc((100% - 560px) / 2 - 70px)",
              }}
            >
              <div style={{ maxWidth: "720px", width: "100%" }}>
              <div
                style={{
                  borderRadius: "20px",
                  background: isDark ? "#1E1208" : "#FCF6EF",
                  border: isDark ? "1px solid rgba(201,162,39,0.25)" : "1px solid #EBCFB5",
                  overflow: "hidden",
                  boxShadow: isDark
                    ? "0 20px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(201,162,39,0.15)"
                    : "0 20px 60px rgba(173,114,55,0.1), 0 0 0 1px rgba(235,207,181,0.2)",
                }}
              >
                {/* Form header */}
                <div
                  style={{
                    padding: "28px 32px 0",
                    borderBottom: isDark ? "1px solid rgba(201,162,39,0.2)" : "1px solid #EBCFB5",
                    paddingBottom: "20px",
                    background: isDark
                      ? "linear-gradient(180deg, rgba(201,162,39,0.06) 0%, transparent 100%)"
                      : "linear-gradient(180deg, rgba(213,155,61,0.08) 0%, transparent 100%)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "6px",
                    }}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: isDark ? "rgba(212,115,42,0.12)" : "rgba(143,16,42,0.12)",
                        border: isDark ? "1px solid rgba(201,162,39,0.3)" : "1px solid #EBCFB5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Zap
                        style={{
                          width: "14px",
                          height: "14px",
                          color: isDark ? "#D4732A" : "#8F102A",
                        }}
                      />
                    </div>
                    <h2
                      style={{
                        fontSize: "1.55rem",
                        fontWeight: 700,
                        color: isDark ? "#F0C060" : "#8F102A",
                        margin: 0,
                      }}
                    >
                      Submit Your Project
                    </h2>
                  </div>
                  <p
                    style={{
                      fontSize: "0.99rem",
                      color: isDark ? "#B89A85" : "#7A5A4A",
                      margin: 0,
                    }}
                  >
                    Share your creation with the hackathon
                    community. Fields marked with{" "}
                    <span style={{ color: isDark ? "#D4732A" : "#8F102A" }}>*</span>{" "}
                    are required.
                  </p>
                </div>

                {isLocked && (
                  <div
                    style={{
                      margin: "28px 32px 0",
                      padding: "20px 24px",
                      borderRadius: "12px",
                      background: isDark ? "rgba(143,16,42,0.15)" : "rgba(143,16,42,0.06)",
                      border: "1px solid rgba(143,16,42,0.3)",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "14px",
                    }}
                  >
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "rgba(143,16,42,0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#8F102A",
                        flexShrink: 0,
                      }}
                    >
                      <Lock size={18} />
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: isDark ? "#F0C060" : "#8F102A" }}>
                        Submissions Locked
                      </h4>
                      <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                        {timerConfig?.hackathon_is_started !== "true"
                          ? "The hackathon event has not been started yet by the administrators. Submissions will open once the countdown begins."
                          : "Submissions for Code-e-Manipal 2.0 are now closed as the deadline has passed. The portal is frozen for all teams, except those with active approved extensions."}
                      </p>
                    </div>
                  </div>
                )}

                <div style={{ padding: "28px 32px 32px" }}>
                  <SubmissionForm onSubmit={handleSubmission} disabled={isLocked} />
                </div>
              </div>

              {/* Quick links */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "20px",
                  marginTop: "20px",
                }}
              >
                {[
                  {
                    icon: (
                      <Github
                        style={{ width: "13px", height: "13px" }}
                      />
                    ),
                    label: "GitHub Docs",
                  },
                  {
                    icon: (
                      <Globe
                        style={{ width: "18px", height: "13px" }}
                      />
                    ),
                    label: "learnitmuj.org",
                  },
                ].map(({ icon, label }) => (
                  <button
                    key={label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      fontSize: "1.00rem",
                      color: "#B89A85",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      transition: "color 0.2s ease",
                      padding: 0,
                    }}
                    onMouseEnter={(e) =>
                    ((
                      e.currentTarget as HTMLButtonElement
                    ).style.color = "#D59B3D")
                    }
                    onMouseLeave={(e) =>
                    ((
                      e.currentTarget as HTMLButtonElement
                    ).style.color = "#B89A85")
                    }
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
              </div>
            </div>
          )}

          {/* ── Browse Tab ── */}
          {activeTab === "browse" && (
            <div
              style={{
                animation:
                  "float-up 0.5s cubic-bezier(0.22,1,0.36,1) forwards",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "100%",
                paddingLeft: "32px", // Balances the parent's padding-right of 32px
              }}
            >
              <div style={{ maxWidth: "720px", width: "100%", display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* Browse header */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    marginBottom: "12px",
                    gap: "6px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <Trophy
                      style={{
                        width: "20px",
                        height: "20px",
                        color: isDark ? "#F0C060" : "#D59B3D",
                      }}
                    />
                    <h2
                      style={{
                        fontSize: "1.7rem",
                        fontWeight: 700,
                        color: isDark ? "#F0C060" : "#8F102A",
                        margin: 0,
                      }}
                    >
                      Review Your Submission
                    </h2>
                  </div>
                  <p
                    style={{
                      fontSize: "1.00rem",
                      color: isDark ? "#B89A85" : "#7A5A4A",
                      margin: 0,
                    }}
                  >
                    {filteredSubmissions.length === 0
                      ? "You have not submitted a project yet."
                      : "Your team's submitted project."}
                  </p>
                </div>

                {/* Search - only show if there are multiple submissions */}
                {submissions.length > 1 && (
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "12px",
                    }}
                  >
                    <div style={{ position: "relative" }}>
                      <Search
                        style={{
                          position: "absolute",
                          left: "11px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: "14px",
                          height: "14px",
                          color: isDark ? "#F0C060" : "#B89A85",
                          pointerEvents: "none",
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) =>
                          setSearchQuery(e.target.value)
                        }
                        style={{
                          padding: "9px 14px 9px 34px",
                          borderRadius: "10px",
                          background: isDark ? "rgba(30,18,8,0.75)" : "rgba(255,255,255,0.72)",
                          border: isDark ? "1px solid rgba(201,162,39,0.25)" : "1px solid #E6C7A8",
                          color: isDark ? "#F5EFE0" : "#6A4635",
                          fontSize: "1.00rem",
                          outline: "none",
                          width: "220px",
                          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                        }}
                        onFocus={(e) =>
                        ((
                          e.target as HTMLInputElement
                        ).style.borderColor = isDark ? "#D4732A" : "#C9822B")
                        }
                        onBlur={(e) =>
                        ((
                          e.target as HTMLInputElement
                        ).style.borderColor = isDark ? "rgba(201,162,39,0.25)" : "#E6C7A8")
                        }
                      />
                    </div>
                    <button
                      onClick={() => setShowFilters((v) => !v)}
                      style={{
                        padding: "9px 14px",
                        borderRadius: "10px",
                        background: showFilters
                          ? isDark
                            ? "#D4732A"
                            : "#8F102A"
                          : isDark
                            ? "rgba(30,18,8,0.72)"
                            : "#FFF8F1",
                        border: showFilters
                          ? "none"
                          : isDark
                            ? "1px solid rgba(201,162,39,0.25)"
                            : "1px solid #EBC9AA",
                        color: showFilters
                          ? isDark
                            ? "#0F0A05"
                            : "#FFF7F1"
                          : isDark
                            ? "#F0C060"
                            : "#9A5A2B",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        fontSize: "1.0rem",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <SlidersHorizontal
                        style={{ width: "13px", height: "13px" }}
                      />
                      Filter
                      <ChevronDown
                        style={{
                          width: "12px",
                          height: "12px",
                          transform: showFilters
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                        }}
                      />
                    </button>
                  </div>
                )}

                {/* Category filter pills - only show if there are multiple submissions */}
                {showFilters && submissions.length > 1 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      justifyContent: "center",
                      marginBottom: "24px",
                      padding: "16px",
                      borderRadius: "12px",
                      background: isDark ? "rgba(30,18,8,0.92)" : "rgba(255,248,239,0.88)",
                      border: isDark ? "1px solid rgba(201,162,39,0.3)" : "1px solid #EBCFB5",
                      animation:
                        "float-up 0.3s cubic-bezier(0.22,1,0.36,1) forwards",
                    }}
                  >
                    {CATEGORY_FILTERS.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        style={{
                          padding: "5px 14px",
                          borderRadius: "999px",
                          fontSize: "1.00rem",
                          fontWeight:
                            activeCategory === cat ? 600 : 400,
                          background:
                            activeCategory === cat
                              ? isDark
                                ? "#D4732A"
                                : "#8F102A"
                              : isDark
                                ? "rgba(30,18,8,0.6)"
                                : "#FFF6ED",
                          border:
                            activeCategory === cat
                              ? "none"
                              : isDark
                                ? "1px solid rgba(201,162,39,0.2)"
                                : "1px solid #E9C39B",
                          color:
                            activeCategory === cat
                              ? isDark
                                ? "#0F0A05"
                                : "#FFF7F1"
                              : isDark
                                ? "#B89A85"
                                : "#A15C2E",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}

                {/* Cards grid */}
                {loading ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "80px 0",
                      gap: "16px",
                    }}
                  >
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "50%",
                        border: isDark ? "2px solid rgba(201,162,39,0.25)" : "2px solid #EBCFB5",
                        borderTopColor: isDark ? "#D4732A" : "#D59B3D",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    <p
                      style={{
                        color: isDark ? "#B89A85" : "#7A5A4A",
                        fontSize: "0.9rem",
                      }}
                    >
                      Loading submissions...
                    </p>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  </div>
                ) : filteredSubmissions.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "80px 0",
                      animation: "float-up 0.5s ease forwards",
                    }}
                  >
                    <div
                      style={{
                        width: "72px",
                        height: "72px",
                        borderRadius: "20px",
                        background: isDark ? "rgba(212,115,42,0.12)" : "rgba(143,16,42,0.1)",
                        border: isDark ? "1px solid rgba(201,162,39,0.25)" : "1px solid #EBCFB5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 20px",
                      }}
                    >
                      <Code2
                        style={{
                          width: "30px",
                          height: "30px",
                          color: isDark ? "#D4732A" : "#8F102A",
                        }}
                      />
                    </div>
                    <h3
                      style={{
                        color: isDark ? "#F0C060" : "#8F102A",
                        fontSize: "1.1rem",
                        marginBottom: "8px",
                      }}
                    >
                      {searchQuery
                        ? "No results found"
                        : "No submissions yet"}
                    </h3>
                    <p
                      style={{
                        color: "#B89A85",
                        fontSize: "0.88rem",
                      }}
                    >
                      {searchQuery
                        ? "Try a different search term or category"
                        : "Be the first to submit your project!"}
                    </p>
                    {!searchQuery && (
                      <button
                        onClick={() => setActiveTab("submit")}
                        style={{
                          marginTop: "20px",
                          padding: "10px 22px",
                          borderRadius: "10px",
                          background:
                            "linear-gradient(90deg, #8F102A 0%, #A61B36 50%, #7A0E22 100%)",
                          border: "none",
                          color: "#FFF6EE",
                          fontSize: "0.88rem",
                          fontWeight: 500,
                          cursor: "pointer",
                          boxShadow:
                            "0 4px 16px rgba(143,16,42,0.3)",
                        }}
                      >
                        Submit First Project →
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      width: "100%",
                      gap: "20px",
                    }}
                  >
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
            </div>
          )}

          {/* ── Leaderboard Tab ── */}
          {activeTab === "leaderboard" && (
            <div
              style={{
                animation: "float-up 0.5s cubic-bezier(0.22,1,0.36,1) forwards",
                display: "flex",
                justifyContent: "flex-start",
                width: "100%",
                marginLeft: "calc((100% - 560px) / 2 - 70px)",
              }}
            >
              <div style={{ maxWidth: "800px", width: "100%" }}>
                {!resultsMeta.published ? (
                  <div
                    style={{
                      borderRadius: "20px",
                      background: isDark ? "#1E1208" : "#FCF6EF",
                      border: isDark ? "1px solid rgba(201,162,39,0.25)" : "1px solid #EBCFB5",
                      padding: "48px 32px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        width: "64px",
                        height: "64px",
                        borderRadius: "50%",
                        background: isDark ? "rgba(212,115,42,0.15)" : "rgba(143,16,42,0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 20px",
                        color: isDark ? "#F0C060" : "#8F102A",
                      }}
                    >
                      <Trophy style={{ width: "32px", height: "32px" }} />
                    </div>

                    {resultsMeta.status === "publishing" ? (
                      <div>
                        <h3 className="text-xl font-bold font-serif mb-2 text-foreground">
                          Publishing in Progress!
                        </h3>
                        <p className="text-sm text-[#A08070] max-w-md mx-auto mb-4">
                          Official Announcement: Results announcement in progress! The leaderboard will be live in 5 minutes.
                        </p>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 font-mono font-bold text-sm animate-pulse">
                          <span>⏳ Unlocks in 5 Minutes</span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-xl font-bold font-serif mb-2 text-foreground">
                          Leaderboard Locked
                        </h3>
                        <p className="text-sm text-[#A08070] max-w-md mx-auto">
                          Results have not been published yet by the organizers. Please check back after evaluations are complete!
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      borderRadius: "20px",
                      background: isDark ? "#1E1208" : "#FCF6EF",
                      border: isDark ? "1px solid rgba(201,162,39,0.25)" : "1px solid #EBCFB5",
                      padding: "32px",
                    }}
                  >
                    <div className="flex items-center justify-between pb-4 border-b border-[#C9A227]/20 mb-6">
                      <div>
                        <h3 className="text-2xl font-bold font-serif text-foreground flex items-center gap-2">
                          <Trophy className="text-jaipur-gold" size={24} />
                          Official Leaderboard
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Final ranked results of Code-e-Manipal 2.0 projects
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 uppercase tracking-wider">
                        Live Ranks
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-[#C9A227]/20 text-muted-foreground text-xs uppercase tracking-wider">
                            <th className="py-3 px-4 font-bold">Rank</th>
                            <th className="py-3 px-4 font-bold">Project</th>
                            <th className="py-3 px-4 font-bold">Category</th>
                            <th className="py-3 px-4 font-bold text-right">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {publicResults.map((r, idx) => (
                            <tr key={r.id} className="border-b border-[#C9A227]/10 hover:bg-[#C9A227]/5 transition-colors">
                              <td className="py-4 px-4 font-bold font-serif text-base">
                                {idx === 0 ? "🥇 #1" : idx === 1 ? "🥈 #2" : idx === 2 ? "🥉 #3" : `#${idx + 1}`}
                              </td>
                              <td className="py-4 px-4">
                                <div className="font-bold text-foreground">{r.title}</div>
                                <div className="text-xs text-muted-foreground line-clamp-1">{r.summary}</div>
                              </td>
                              <td className="py-4 px-4 text-xs font-semibold text-muted-foreground">
                                {r.category}
                              </td>
                              <td className="py-4 px-4 text-right font-black font-serif text-jaipur-gold text-base">
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
            </div>
          )}
        </main>

        {/* ── Footer ── */}
        <footer
          style={{
            position: "relative",
            zIndex: 7,
            borderTop: isDark ? "1px solid rgba(201,162,39,0.25)" : "1px solid #EBCFB5",
            background: isDark ? "rgba(30,18,8,0.6)" : "rgba(255,248,239,0.6)",
            backdropFilter: "blur(10px)",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "6px",
            }}
          >
            <img
              src="/logo.png"
              alt="logo"
              style={{
                width: "22px",
                height: "22px",
                objectFit: "contain",
              }}
            />
            <span
              style={{
                fontSize: "1.40rem",
                fontWeight: 600,
                color: isDark ? "#F0C060" : "#8F102A",
              }}
            >
              Code-e-Manipal 2.0
            </span>
          </div>
          <p
            style={{
              fontSize: "1.00rem",
              color: "#B89A85",
              margin: 0,
            }}
          >
            Powered by LearnIT · Build the Future
          </p>
        </footer>

        {/* Global keyframe styles */}
        <style>{`
        @keyframes float-up {
          0% { opacity: 0; transform: translateY(24px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes header-glow {
          0%, 100% { filter: drop-shadow(0 0 8px ${isDark ? "rgba(212,115,42,0.4)" : "rgba(143,16,42,0.4)"}); }
          50% { filter: drop-shadow(0 0 20px ${isDark ? "rgba(201,162,39,0.7)" : "rgba(213,155,61,0.7)"}); }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${isDark ? "#0F0A05" : "#FFF9F3"}; }
        ::-webkit-scrollbar-thumb { background: ${isDark ? "rgba(201,162,39,0.25)" : "#EBCFB5"}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${isDark ? "#D4732A" : "#D59B3D"}; }
        input::placeholder { color: ${isDark ? "rgba(184,154,133,0.45)" : "#B89A85"} !important; }
      `}</style>
      </div>
    </ProtectedRoute>);
}
