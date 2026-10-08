"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Submission } from "./SubmissionForm";
import {
  Github, Video, BookOpen, Tag, Users, Calendar,
  ChevronDown, ChevronUp, Lock, Cpu, Lightbulb,
  AlertTriangle, GraduationCap, Map, ExternalLink,
  CheckCircle2, Layers,
} from "lucide-react";

interface SubmissionCardProps {
  submission: Submission;
  index?: number;
}

/* ── Palette per mode ─────────────────────────────────────────────────────── */

const lightPalette = {
  cardBg:        "#FFFDF9",
  cardBgHover:   "#FAF5EE",
  border:        "#D8C7B0",
  borderHover:   "#C97878",
  shadow:        "0 4px 20px rgba(176,138,69,0.08)",
  shadowHover:   "0 12px 36px rgba(201,120,120,0.14)",
  spotlight:     "rgba(201,120,120,0.08)",
  shimmer:       "linear-gradient(90deg, transparent, rgba(216,199,176,0.5), transparent)",
  shimmerHover:  "linear-gradient(90deg, transparent, rgba(201,120,120,0.4), rgba(210,172,104,0.4), transparent)",
  title:         "#1F1612",
  titleHover:    "#C97878",
  tagline:       "#B08A45",
  teamIcon:      "#C97878",
  teamText:      "#8A463B",
  memberDot:     "rgba(140,114,100,0.5)",
  memberIcon:    "#B08A45",
  memberText:    "#B08A45",
  techBadgeBg:   "rgba(201,120,120,0.08)",
  techBadgeBdr:  "rgba(201,120,120,0.2)",
  techBadgeText: "#8A463B",
  overflowBg:    "rgba(176,138,69,0.1)",
  overflowBdr:   "rgba(176,138,69,0.25)",
  overflowText:  "#B08A45",
  summary:       "#5B4336",
  divider:       "#E6D7C3",
  ghLinkColor:   "#1F1612",
  ghLinkBg:      "rgba(201,120,120,0.08)",
  ghLinkBdr:     "rgba(201,120,120,0.2)",
  ghLinkBgH:     "rgba(201,120,120,0.16)",
  vidLinkColor:  "#C97878",
  vidLinkBg:     "rgba(201,120,120,0.08)",
  vidLinkBdr:     "rgba(201,120,120,0.2)",
  vidLinkBgH:    "rgba(201,120,120,0.16)",
  docLinkColor:  "#B08A45",
  docLinkBg:     "rgba(176,138,69,0.08)",
  docLinkBdr:    "rgba(176,138,69,0.2)",
  docLinkBgH:    "rgba(176,138,69,0.16)",
  expandBg:      "rgba(201,120,120,0.05)",
  expandActive:  "#C97878",
  expandMuted:   "#8C7264",
  sectionTitle:  "#B08A45",
  detailIcon:    "#B08A45",
  detailLabel:   "#8C7264",
  detailValue:   "#5B4336",
  fullStackBg:   "rgba(201,120,120,0.08)",
  fullStackBdr:  "rgba(201,120,120,0.2)",
  fullStackText: "#C97878",
  memberPillBg:  "rgba(176,138,69,0.08)",
  memberPillBdr: "rgba(176,138,69,0.2)",
  memberPillTxt: "#8A463B",
  footerDate:    "#8C7264",
  dotDone:       "#C97878",
  dotDoneGlow:   "rgba(201,120,120,0.4)",
  dotEmpty:      "#D8C7B0",
};

const darkPalette = {
  cardBg:        "#0C1728",
  cardBgHover:   "#112035",
  border:        "#1E3857",
  borderHover:   "#C97878",
  shadow:        "0 4px 20px rgba(0,0,0,0.4)",
  shadowHover:   "0 12px 36px rgba(0,0,0,0.6)",
  spotlight:     "rgba(201,120,120,0.08)",
  shimmer:       "linear-gradient(90deg, transparent, rgba(30,56,87,0.5), transparent)",
  shimmerHover:  "linear-gradient(90deg, transparent, rgba(201,120,120,0.5), rgba(210,172,104,0.4), transparent)",
  title:         "#F5F0EB",
  titleHover:    "#E4A1A1",
  tagline:       "#D2AC68",
  teamIcon:      "#C97878",
  teamText:      "#A8B8CC",
  memberDot:     "#3A5372",
  memberIcon:    "#D2AC68",
  memberText:    "#D2AC68",
  techBadgeBg:   "rgba(201,120,120,0.12)",
  techBadgeBdr:  "rgba(201,120,120,0.25)",
  techBadgeText: "#E4A1A1",
  overflowBg:    "rgba(210,172,104,0.12)",
  overflowBdr:   "rgba(210,172,104,0.25)",
  overflowText:  "#D2AC68",
  summary:       "#A8B8CC",
  divider:       "#1E3857",
  ghLinkColor:   "#E2D8CE",
  ghLinkBg:      "rgba(201,120,120,0.12)",
  ghLinkBdr:     "rgba(201,120,120,0.25)",
  ghLinkBgH:     "rgba(201,120,120,0.22)",
  vidLinkColor:  "#E4A1A1",
  vidLinkBg:     "rgba(201,120,120,0.12)",
  vidLinkBdr:     "rgba(201,120,120,0.25)",
  vidLinkBgH:    "rgba(201,120,120,0.22)",
  docLinkColor:  "#D2AC68",
  docLinkBg:     "rgba(210,172,104,0.1)",
  docLinkBdr:    "rgba(210,172,104,0.2)",
  docLinkBgH:    "rgba(210,172,104,0.2)",
  expandBg:      "rgba(201,120,120,0.08)",
  expandActive:  "#C97878",
  expandMuted:   "#7C90A8",
  sectionTitle:  "#D2AC68",
  detailIcon:    "#D2AC68",
  detailLabel:   "#7C90A8",
  detailValue:   "#E2D8CE",
  fullStackBg:   "rgba(201,120,120,0.12)",
  fullStackBdr:  "rgba(201,120,120,0.25)",
  fullStackText: "#E4A1A1",
  memberPillBg:  "rgba(210,172,104,0.1)",
  memberPillBdr: "rgba(210,172,104,0.22)",
  memberPillTxt: "#D2AC68",
  footerDate:    "#7C90A8",
  dotDone:       "#C97878",
  dotDoneGlow:   "rgba(201,120,120,0.5)",
  dotEmpty:      "#1E3857",
};

/* ── Category colours ─────────────────────────────────────────────────────── */

const LIGHT_CATEGORY_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  // 9 Official Tracks
  "AI/ML":                         { bg: "rgba(139,92,246,0.12)",  text: "#7c3aed", glow: "rgba(139,92,246,0.35)" },
  "HealthTech":                    { bg: "rgba(236,72,153,0.12)",  text: "#db2777", glow: "rgba(236,72,153,0.35)" },
  "FinTech/EdTech":                { bg: "rgba(245,158,11,0.12)",  text: "#b45309", glow: "rgba(245,158,11,0.35)" },
  "Cybersecurity":                 { bg: "rgba(239,68,68,0.12)",   text: "#dc2626", glow: "rgba(239,68,68,0.35)"  },
  "Generative AI & LLMs":          { bg: "rgba(168,85,247,0.12)",  text: "#9333ea", glow: "rgba(168,85,247,0.35)" },
  "Multi-Agent Systems":           { bg: "rgba(99,102,241,0.12)",  text: "#4f46e5", glow: "rgba(99,102,241,0.35)" },
  "Gaming & Immersive Tech":       { bg: "rgba(16,185,129,0.12)",  text: "#059669", glow: "rgba(16,185,129,0.35)" },
  "Smart City and Infrastructure": { bg: "rgba(20,184,166,0.12)",  text: "#0d9488", glow: "rgba(20,184,166,0.35)" },
  "Open Innovation":               { bg: "rgba(234,88,12,0.12)",   text: "#c2410c", glow: "rgba(234,88,12,0.35)"  },
  // Legacy / Fallback
  "Mobile":                        { bg: "rgba(16,185,129,0.12)",  text: "#059669", glow: "rgba(16,185,129,0.35)" },
  "Blockchain":                    { bg: "rgba(245,158,11,0.12)",  text: "#b45309", glow: "rgba(245,158,11,0.35)" },
  "Web Dev":                       { bg: "rgba(59,130,246,0.12)",  text: "#2563eb", glow: "rgba(59,130,246,0.35)" },
  "IoT":                           { bg: "rgba(20,184,166,0.12)",  text: "#0d9488", glow: "rgba(20,184,166,0.35)" },
  "Other":                         { bg: "rgba(100,116,139,0.12)", text: "#64748b", glow: "rgba(100,116,139,0.35)"},
  "default":                       { bg: "rgba(143,16,42,0.1)",    text: "#8F102A", glow: "rgba(143,16,42,0.3)" },
};

const DARK_CATEGORY_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  // 9 Official Tracks
  "AI/ML":                         { bg: "rgba(139,92,246,0.15)",  text: "#c4b5fd", glow: "rgba(139,92,246,0.4)" },
  "HealthTech":                    { bg: "rgba(236,72,153,0.15)",  text: "#f472b6", glow: "rgba(236,72,153,0.4)" },
  "FinTech/EdTech":                { bg: "rgba(245,158,11,0.15)",  text: "#fcd34d", glow: "rgba(245,158,11,0.4)" },
  "Cybersecurity":                 { bg: "rgba(239,68,68,0.15)",   text: "#fca5a5", glow: "rgba(239,68,68,0.4)"  },
  "Generative AI & LLMs":          { bg: "rgba(168,85,247,0.15)",  text: "#d8b4fe", glow: "rgba(168,85,247,0.4)" },
  "Multi-Agent Systems":           { bg: "rgba(99,102,241,0.15)",  text: "#a5b4fc", glow: "rgba(99,102,241,0.4)" },
  "Gaming & Immersive Tech":       { bg: "rgba(16,185,129,0.15)",  text: "#6ee7b7", glow: "rgba(16,185,129,0.4)" },
  "Smart City and Infrastructure": { bg: "rgba(20,184,166,0.15)",  text: "#5eead4", glow: "rgba(20,184,166,0.4)" },
  "Open Innovation":               { bg: "rgba(234,88,12,0.15)",   text: "#fdba74", glow: "rgba(234,88,12,0.4)"  },
  // Legacy / Fallback
  "Mobile":                        { bg: "rgba(16,185,129,0.15)",  text: "#6ee7b7", glow: "rgba(16,185,129,0.4)" },
  "Blockchain":                    { bg: "rgba(245,158,11,0.15)",  text: "#fcd34d", glow: "rgba(245,158,11,0.4)" },
  "Web Dev":                       { bg: "rgba(59,130,246,0.15)",  text: "#93c5fd", glow: "rgba(59,130,246,0.4)" },
  "IoT":                           { bg: "rgba(20,184,166,0.15)",  text: "#5eead4", glow: "rgba(20,184,166,0.4)" },
  "Other":                         { bg: "rgba(100,116,139,0.15)", text: "#cbd5e1", glow: "rgba(100,116,139,0.4)"},
  "default":                       { bg: "rgba(212,115,42,0.15)",  text: "#E8924A", glow: "rgba(212,115,42,0.4)" },
};

/* ── Detail Row ───────────────────────────────────────────────────────────── */

function DetailRow({ icon, label, value, p }: { icon: React.ReactNode; label: string; value: string; p: typeof lightPalette }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: "9px", alignItems: "flex-start" }}>
      <span style={{ color: p.detailIcon, marginTop: "1px", flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: "0.68rem", fontWeight: 600, color: p.detailLabel, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>
          {label}
        </div>
        <p style={{ fontSize: "0.8rem", color: p.detailValue, lineHeight: 1.6, margin: 0 }}>
          {value}
        </p>
      </div>
    </div>
  );
}

/* ── Submission Card ──────────────────────────────────────────────────────── */

export function SubmissionCard({ submission, index = 0 }: SubmissionCardProps) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const p = isDark ? darkPalette : lightPalette;
  const catColors = isDark ? DARK_CATEGORY_COLORS : LIGHT_CATEGORY_COLORS;
  const catStyle = catColors[submission.category] || catColors["default"];

  // Staggered entrance
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), index * 75);
          observer.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    const el = cardRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [index]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const dateObj = submission.submittedAt ? new Date(submission.submittedAt) : null;
  const formattedDate = dateObj && !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })
    : "Date Unavailable";

  const sectionHeadingStyle = (color: string) => ({
    fontSize: "0.74rem",
    fontWeight: 700,
    color: color,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    borderBottom: `1px solid ${isDark ? "rgba(201,162,39,0.15)" : "rgba(213,155,61,0.25)"}`,
    paddingBottom: "4px",
    marginBottom: "8px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  });

  const renderMarkdownLite = (text: string) => {
    if (!text) return <p style={{ fontSize: "0.8rem", color: p.summary, fontStyle: "italic", margin: "4px 0 0" }}>Not specified.</p>;
    const paragraphs = text.split("\n\n");

    return paragraphs.map((pGroup, i) => {
      const trimmed = pGroup.trim();
      if (!trimmed) return null;

      const lines = trimmed.split("\n");
      const isList = lines.every((l) => l.trim().startsWith("-"));

      if (isList) {
        return (
          <ul key={i} style={{ listStyleType: "disc", paddingLeft: "16px", margin: "6px 0", fontSize: "0.8rem", color: p.summary }}>
            {lines.map((line, j) => (
              <li
                key={j}
                dangerouslySetInnerHTML={{
                  __html: line.replace(/^-\s*/, "").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
                }}
              />
            ))}
          </ul>
        );
      }

      return (
        <p
          key={i}
          style={{ fontSize: "0.8rem", color: p.summary, lineHeight: 1.5, margin: "6px 0" }}
          dangerouslySetInnerHTML={{
            __html: trimmed.replace(/\n/g, "<br/>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
          }}
        />
      );
    });
  };

  const hasGithub = !!submission.githubUrl;
  const hasVideo  = !!submission.videoUrl;
  const hasDocs   = !!submission.docsUrl;

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={handleMouseMove}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? (hovered ? "translateY(-4px)" : "translateY(0)") : "translateY(28px) scale(0.96)",
        transition: "opacity 0.55s cubic-bezier(0.22,1,0.36,1), transform 0.35s cubic-bezier(0.22,1,0.36,1), box-shadow 0.35s ease, border-color 0.35s ease, background 0.35s ease",
        position: "relative",
        borderRadius: "16px",
        background: hovered ? p.cardBgHover : p.cardBg,
        border: `1px solid ${hovered ? p.borderHover : p.border}`,
        boxShadow: hovered ? p.shadowHover : p.shadow,
        overflow: "hidden",
      }}
    >
      {/* Spotlight */}
      {hovered && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
          background: `radial-gradient(200px circle at ${mousePos.x}px ${mousePos.y}px, ${p.spotlight}, transparent 65%)`,
        }} />
      )}

      {/* Top edge shimmer */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "1px",
        background: hovered ? p.shimmerHover : p.shimmer,
        transition: "all 0.35s ease",
      }} />

      {/* Left accent bar */}
      <div style={{
        position: "absolute", top: "15%", left: 0, width: "3px",
        height: hovered ? "70%" : "0%",
        background: `linear-gradient(180deg, transparent, ${catStyle.glow.replace(/0\.\d+\)/, "0.85)")}, transparent)`,
        borderRadius: "0 2px 2px 0",
        transition: "height 0.45s cubic-bezier(0.22,1,0.36,1)",
      }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* ── Card Header ── */}
        <div style={{ padding: "20px 20px 6px" }}>
          <div style={{ marginBottom: "10px" }}>
            <h3 style={{
              fontSize: "1.05rem", fontWeight: 700,
              color: hovered ? p.titleHover : p.title,
              marginBottom: "2px", lineHeight: 1.3,
              transition: "color 0.2s",
            }}>
              {submission.projectName}
            </h3>
            {submission.tagline && (
              <p style={{ fontSize: "0.78rem", color: p.tagline, margin: "0 0 4px", fontStyle: "italic" }}>
                &ldquo;{submission.tagline}&rdquo;
              </p>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <Users style={{ width: "11px", height: "11px", color: p.teamIcon }} />
              <span style={{ fontSize: "0.76rem", color: p.teamText }}>
                {submission.teamName}
              </span>
              {submission.teamMembers?.length > 0 && (
                <>
                  <span style={{ color: p.memberDot, fontSize: "0.7rem" }}>·</span>
                  <Lock style={{ width: "9px", height: "9px", color: p.memberIcon }} />
                  <span style={{ fontSize: "0.7rem", color: p.memberText }}>
                    {submission.teamMembers.length} member{submission.teamMembers.length !== 1 ? "s" : ""}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Category + Tech stack badges */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
            {submission.category && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                padding: "3px 9px", borderRadius: "999px", fontSize: "0.69rem", fontWeight: 600,
                background: catStyle.bg,
                border: `1px solid ${catStyle.glow.replace(/0\.\d+\)/, "0.25)")}`,
                color: catStyle.text,
                transition: "box-shadow 0.3s",
                ...(hovered ? { boxShadow: `0 0 10px ${catStyle.glow}` } : {}),
              }}>
                <Tag style={{ width: "9px", height: "9px" }} />
                {submission.category}
              </span>
            )}
            {(submission.techStack || []).slice(0, 3).map((tech) => (
              <span key={tech} style={{
                padding: "2px 8px", borderRadius: "6px", fontSize: "0.67rem",
                background: p.techBadgeBg, border: `1px solid ${p.techBadgeBdr}`,
                color: p.techBadgeText,
              }}>
                {tech}
              </span>
            ))}
            {(submission.techStack || []).length > 3 && (
              <span style={{
                padding: "2px 8px", borderRadius: "6px", fontSize: "0.67rem",
                background: p.overflowBg, border: `1px solid ${p.overflowBdr}`,
                color: p.overflowText,
              }}>
                +{submission.techStack.length - 3}
              </span>
            )}
          </div>

          {/* Solution summary */}
          <p style={{
            fontSize: "0.825rem", color: p.summary, lineHeight: 1.65,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {submission.solutionSummary || submission.problemSolved}
          </p>
        </div>

        {/* ── External Links Row ── */}
        {(hasGithub || hasVideo || hasDocs) && (
          <div style={{
            padding: "10px 20px",
            borderTop: `1px solid ${p.divider}`,
            display: "flex", gap: "8px", flexWrap: "wrap",
          }}>
            {hasGithub && (
              <a href={submission.githubUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem",
                  color: p.ghLinkColor, textDecoration: "none",
                  padding: "4px 10px", borderRadius: "7px",
                  background: p.ghLinkBg, border: `1px solid ${p.ghLinkBdr}`,
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = p.ghLinkBgH; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = p.ghLinkBg; }}
              >
                <Github style={{ width: "11px", height: "11px" }} /> GitHub
              </a>
            )}
            {hasVideo && (
              <a href={submission.videoUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem",
                  color: p.vidLinkColor, textDecoration: "none",
                  padding: "4px 10px", borderRadius: "7px",
                  background: p.vidLinkBg, border: `1px solid ${p.vidLinkBdr}`,
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = p.vidLinkBgH; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = p.vidLinkBg; }}
              >
                <Video style={{ width: "11px", height: "11px" }} /> Demo
              </a>
            )}
            {hasDocs && (
              <a href={submission.docsUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem",
                  color: p.docLinkColor, textDecoration: "none",
                  padding: "4px 10px", borderRadius: "7px",
                  background: p.docLinkBg, border: `1px solid ${p.docLinkBdr}`,
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = p.docLinkBgH; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = p.docLinkBg; }}
              >
                <BookOpen style={{ width: "11px", height: "11px" }} /> Docs
              </a>
            )}
          </div>
        )}

        {/* ── Expand / Collapse ── */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            width: "100%", padding: "10px 20px",
            borderTop: `1px solid ${p.divider}`,
            borderLeft: "none",
            borderRight: "none",
            borderBottom: "none",
            borderRadius: "0 0 0 0",
            background: expanded ? p.expandBg : "transparent",
            color: expanded ? p.expandActive : p.expandMuted,
            fontSize: "0.75rem", fontWeight: 500, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = p.expandActive; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = expanded ? p.expandActive : p.expandMuted; }}
        >
          {expanded ? (
            <><ChevronUp style={{ width: "12px", height: "12px" }} /> Hide Details</>
          ) : (
            <><ChevronDown style={{ width: "12px", height: "12px" }} /> View Full Write-Up</>
          )}
        </button>

        {/* ── Expanded Details ── */}
        {expanded && (
          <div style={{
            padding: "20px",
            borderTop: `1px solid ${p.divider}`,
            display: "flex", flexDirection: "column", gap: "20px",
            animation: "expand-in 0.3s cubic-bezier(0.22,1,0.36,1) forwards",
            textAlign: "left",
          }}>
            {/* Header / Intro */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: `1px solid ${p.divider}`, paddingBottom: "10px" }}>
              <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: "rgba(213,155,61,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen style={{ width: "12px", height: "12px", color: p.expandActive }} />
              </div>
              <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: p.title, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Kaggle Solution Write-Up
              </h4>
            </div>

            {/* 1. Problem Statement */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <h5 style={sectionHeadingStyle(p.sectionTitle)}>
                <AlertTriangle style={{ width: "11px", height: "11px" }} /> 1. Problem Statement & Context
              </h5>
              {renderMarkdownLite(submission.problemSolved || submission.solutionSummary)}
            </div>

            {/* 2. Architecture Overview */}
            {(submission.architectureOverview || (submission.techStack && submission.techStack.length > 0)) && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <h5 style={sectionHeadingStyle(p.sectionTitle)}>
                  <Cpu style={{ width: "11px", height: "11px" }} /> 2. Architecture & Design
                </h5>
                {submission.architectureOverview && renderMarkdownLite(submission.architectureOverview)}
                
                {(submission.techStack || []).length > 0 && (
                  <div style={{ marginTop: "10px" }}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 600, color: p.detailLabel, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Full Stack Components
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                      {submission.techStack.map((tech) => (
                        <span key={tech} style={{
                          padding: "2px 8px", borderRadius: "6px", fontSize: "0.7rem",
                          background: p.fullStackBg, border: `1px solid ${p.fullStackBdr}`,
                          color: p.fullStackText,
                        }}>{tech}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. Technical Challenges */}
            {submission.technicalChallenges && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <h5 style={sectionHeadingStyle(p.sectionTitle)}>
                  <Layers style={{ width: "11px", height: "11px" }} /> 3. Technical Challenges
                </h5>
                {renderMarkdownLite(submission.technicalChallenges)}
              </div>
            )}

            {/* 4. Outcomes & Validation */}
            {(submission.challengesFaced || submission.whatWorkedWell) && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
                {submission.challengesFaced && (
                  <div style={{ flex: 1 }}>
                    <h5 style={sectionHeadingStyle(p.sectionTitle)}>
                      <AlertTriangle style={{ width: "11px", height: "11px" }} /> 4a. Challenges Faced
                    </h5>
                    {renderMarkdownLite(submission.challengesFaced)}
                  </div>
                )}
                {submission.whatWorkedWell && (
                  <div style={{ flex: 1 }}>
                    <h5 style={sectionHeadingStyle(p.sectionTitle)}>
                      <CheckCircle2 style={{ width: "11px", height: "11px" }} /> 4b. What Worked Well
                    </h5>
                    {renderMarkdownLite(submission.whatWorkedWell)}
                  </div>
                )}
              </div>
            )}

            {/* 5. Learnings & Reflections */}
            {submission.lessonsLearned && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <h5 style={sectionHeadingStyle(p.sectionTitle)}>
                  <GraduationCap style={{ width: "11px", height: "11px" }} /> 5. Lessons Learned
                </h5>
                {renderMarkdownLite(submission.lessonsLearned)}
              </div>
            )}

            {/* 6. Future Roadmap */}
            {submission.futureRoadmap && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <h5 style={sectionHeadingStyle(p.sectionTitle)}>
                  <Map style={{ width: "11px", height: "11px" }} /> 6. Future Roadmap
                </h5>
                {renderMarkdownLite(submission.futureRoadmap)}
              </div>
            )}

            {/* Team Roster */}
            {(submission.teamMembers || []).length > 0 && (
              <div style={{ borderTop: `1px solid ${p.divider}`, paddingTop: "14px" }}>
                <h5 style={{ fontSize: "0.74rem", fontWeight: 700, color: p.sectionTitle, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px", display: "flex", alignItems: "center", gap: "5px" }}>
                  <Lock style={{ width: "11px", height: "11px" }} /> Team Roster (Locked)
                </h5>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {submission.teamMembers.map((m, i) => (
                    <span key={i} style={{
                      display: "flex", alignItems: "center", gap: "5px",
                      padding: "3px 10px", borderRadius: "999px", fontSize: "0.72rem",
                      background: p.memberPillBg, border: `1px solid ${p.memberPillBdr}`,
                      color: p.memberPillTxt,
                    }}>
                      <Lock style={{ width: "9px", height: "9px", opacity: 0.6 }} />
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: "10px 20px",
          borderTop: `1px solid ${p.divider}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Calendar style={{ width: "10px", height: "10px", color: p.footerDate }} />
            <span style={{ fontSize: "0.68rem", color: p.footerDate }}>{formattedDate}</span>
          </div>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            {[
              !!(submission.projectName && submission.solutionSummary),
              !!(submission.techStack?.length && submission.architectureOverview),
              !!(submission.githubUrl && submission.videoUrl),
              !!(submission.whatWorkedWell || submission.lessonsLearned),
              !!(submission.teamName),
            ].map((done, i) => (
              <div
                key={i}
                title={`Section ${i + 1}`}
                style={{
                  width: "5px", height: "5px", borderRadius: "50%",
                  background: done ? p.dotDone : p.dotEmpty,
                  boxShadow: done ? `0 0 4px ${p.dotDoneGlow}` : "none",
                  transition: "all 0.2s",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes expand-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
