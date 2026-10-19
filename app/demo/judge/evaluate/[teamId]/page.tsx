"use client";

import React, { useState, use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  ExternalLink,
  Github,
  Globe,
  Video,
  FileText,
  Sliders,
  Sparkles,
  Save,
  RotateCcw,
  ShieldCheck,
  Check,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { DemoRoleSwitcher } from "@/components/demo/DemoRoleSwitcher";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { getDemoJudgeSubmission, DEMO_JUDGE_DATA, type DemoJudgeSubmissionItem } from "@/lib/demo/demoFixtures";
import { calculateWeightedScore } from "@/utils/scoring";

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default function DemoJudgeEvaluatePage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const teamId = resolvedParams.teamId;

  // Resolve submission from demo fixtures or fallback to demo-sub-01
  const submission: DemoJudgeSubmissionItem = useMemo(() => {
    return (
      getDemoJudgeSubmission(teamId) ||
      DEMO_JUDGE_DATA.assignedSubmissions[0]
    );
  }, [teamId]);

  // Client-side interactive scoring state
  const [innovation, setInnovation] = useState<number>(submission.scores.innovation);
  const [technical, setTechnical] = useState<number>(submission.scores.technical);
  const [presentation, setPresentation] = useState<number>(submission.scores.presentation);
  const [impact, setImpact] = useState<number>(submission.scores.impact);
  const [feedback, setFeedback] = useState<string>(submission.feedback || "");
  const [savedLocally, setSavedLocally] = useState<boolean>(submission.reviewStatus === "completed");

  // Real-time weighted score calculation
  const weightedTotal = useMemo(() => {
    const raw = calculateWeightedScore({
      innovation,
      technical,
      presentation,
      impact,
    });
    // Multiplied by 10 to scale from 1-10 to 1-100 scale
    return Math.round(raw * 10 * 10) / 10;
  }, [innovation, technical, presentation, impact]);

  const handleSaveEvaluation = () => {
    setSavedLocally(true);
    toast.success("Evaluation saved to local client state! (Zero backend persistence in demo mode)");
  };

  const handleResetDefaults = () => {
    setInnovation(submission.scores.innovation);
    setTechnical(submission.scores.technical);
    setPresentation(submission.scores.presentation);
    setImpact(submission.scores.impact);
    setFeedback(submission.feedback || "");
    setSavedLocally(submission.reviewStatus === "completed");
    toast.info("Scoring reset to initial demo values.");
  };

  return (
    <div className="min-h-screen bg-transparent pb-24">
      <DemoRoleSwitcher currentRole="judge" />

      <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 space-y-8">
        {/* Top Header & Breadcrumb */}
        <div className="relative overflow-hidden rounded-2xl border border-border border-l-4 border-l-secondary bg-surface-elevated p-6 sm:p-7 shadow-sm">
          {/* Subtle architectural backdrop */}
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden opacity-18 dark:opacity-12 bg-cover bg-center bg-[url('/images/heritage/light/15-city-palace-hall-arches.webp')] dark:bg-[url('/images/heritage/dark/01-jantar-mantar-arch.webp')]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 pointer-events-none bg-gradient-to-r from-surface-elevated/96 via-surface-elevated/90 to-surface-elevated/75 dark:from-surface-elevated/98 dark:via-surface-elevated/92 dark:to-surface-elevated/80"
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/demo/judge"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors shadow-xs"
              >
                <ArrowLeft size={14} />
                <span>Back to Queue</span>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-secondary/15 border border-secondary/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary">
                    {submission.track}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">Ref: {submission.problemStatementId}</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-1">
                  Evaluate: {submission.teamName}
                </h1>
              </div>
            </div>

            {/* Dynamic Live Score Badge */}
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <div className="rounded-2xl border-2 border-secondary/40 bg-secondary/10 px-5 py-2.5 text-right backdrop-blur-xs shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-secondary font-mono block">
                  Live Weighted Score
                </span>
                <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                  {weightedTotal} <span className="text-xs font-normal text-muted-foreground">/ 100</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Evaluation Viewport: Left Column (Rubric Simulator) + Right Column (Project Dossier) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Interactive Rubric Sliders */}
          <div className="lg:col-span-2 space-y-6">
            <SpotlightCard className="rounded-2xl border border-border bg-surface-elevated p-6 sm:p-7 space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <Sliders size={18} className="text-secondary" />
                  <h2 className="text-lg font-bold text-foreground">
                    Interactive Rubric Controls (1.0 – 10.0)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Reset sliders to default fixture scores"
                >
                  <RotateCcw size={12} />
                  <span>Reset Sliders</span>
                </button>
              </div>

              {/* Criterion 1: Innovation (30%) */}
              <div className="space-y-2 p-4 rounded-xl border border-border bg-surface/60">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-primary uppercase tracking-wide">
                      1. Innovation & Creativity (30% Weight)
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Novelty of concept, uniqueness of technical approach, and creative problem-solving.
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface border border-primary/30 px-3 py-1 font-mono text-base font-bold text-primary">
                    {innovation.toFixed(1)}
                  </div>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.1"
                  value={innovation}
                  onChange={(e) => setInnovation(parseFloat(e.target.value))}
                  className="w-full accent-primary cursor-pointer h-2 bg-input rounded-lg"
                />
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span>1.0 (Standard / Basic)</span>
                  <span>5.0 (Moderate)</span>
                  <span>10.0 (Groundbreaking)</span>
                </div>
              </div>

              {/* Criterion 2: Technical Execution (30%) */}
              <div className="space-y-2 p-4 rounded-xl border border-border bg-surface/60">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-secondary uppercase tracking-wide">
                      2. Technical Execution (30% Weight)
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Code architecture, algorithmic complexity, runtime reliability, and engineering rigor.
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface border border-secondary/30 px-3 py-1 font-mono text-base font-bold text-secondary">
                    {technical.toFixed(1)}
                  </div>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.1"
                  value={technical}
                  onChange={(e) => setTechnical(parseFloat(e.target.value))}
                  className="w-full accent-secondary cursor-pointer h-2 bg-input rounded-lg"
                />
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span>1.0 (Fragile / Incomplete)</span>
                  <span>5.0 (Functional)</span>
                  <span>10.0 (Production-Grade)</span>
                </div>
              </div>

              {/* Criterion 3: Presentation & UI/UX (20%) */}
              <div className="space-y-2 p-4 rounded-xl border border-border bg-surface/60">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-jaipur-pink uppercase tracking-wide">
                      3. UI/UX & Presentation (20% Weight)
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Design polish, accessibility, documentation quality, and live demonstration clarity.
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface border border-jaipur-pink/30 px-3 py-1 font-mono text-base font-bold text-jaipur-pink">
                    {presentation.toFixed(1)}
                  </div>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.1"
                  value={presentation}
                  onChange={(e) => setPresentation(parseFloat(e.target.value))}
                  className="w-full accent-jaipur-pink cursor-pointer h-2 bg-input rounded-lg"
                />
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span>1.0 (Minimal UI)</span>
                  <span>5.0 (Clean Design)</span>
                  <span>10.0 (Exceptional Aesthetics)</span>
                </div>
              </div>

              {/* Criterion 4: Impact & Viability (20%) */}
              <div className="space-y-2 p-4 rounded-xl border border-border bg-surface/60">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-jaipur-terracotta uppercase tracking-wide">
                      4. Impact & Viability (20% Weight)
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Real-world deployment feasibility, market/community viability, and problem significance.
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface border border-jaipur-terracotta/30 px-3 py-1 font-mono text-base font-bold text-jaipur-terracotta">
                    {impact.toFixed(1)}
                  </div>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.1"
                  value={impact}
                  onChange={(e) => setImpact(parseFloat(e.target.value))}
                  className="w-full accent-jaipur-terracotta cursor-pointer h-2 bg-input rounded-lg"
                />
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span>1.0 (Narrow Scope)</span>
                  <span>5.0 (Practical Utility)</span>
                  <span>10.0 (Transformative)</span>
                </div>
              </div>

              {/* Feedback Textarea */}
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="text-xs font-bold text-foreground uppercase tracking-wide">
                  Qualitative Feedback & Jury Notes
                </label>
                <textarea
                  rows={4}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Enter detailed feedback on technical execution, code quality, or architectural choices..."
                  className="w-full p-3 text-xs bg-surface border border-border rounded-xl text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-secondary transition-all"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {savedLocally ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                      <CheckCircle2 size={14} />
                      Evaluation saved in client session
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-400">
                      <Info size={14} />
                      Unsaved local slider adjustments
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleSaveEvaluation}
                    className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/90 transition-all shadow-sm cursor-pointer"
                  >
                    <Save size={14} />
                    <span>Save Evaluation (Simulated)</span>
                  </button>
                </div>
              </div>
            </SpotlightCard>
          </div>

          {/* Right Column: Submission Dossier & Artifacts */}
          <div className="space-y-6">
            <SpotlightCard className="rounded-2xl border border-border bg-surface-elevated p-6 space-y-5">
              <div className="border-b border-border pb-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-secondary font-mono">Assigned Project Dossier</p>
                <h3 className="text-lg font-bold text-foreground mt-0.5 leading-snug">
                  {submission.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                  By {submission.teamName}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">Description</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {submission.description}
                </p>
              </div>

              {/* Links */}
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">Verified Artifacts</p>
                <div className="space-y-1.5">
                  <a
                    href={submission.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg border border-border bg-surface text-xs font-semibold text-foreground hover:bg-accent transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Github size={14} className="text-primary" />
                      <span>Code Repository</span>
                    </span>
                    <ExternalLink size={12} className="text-muted-foreground" />
                  </a>

                  <a
                    href={submission.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg border border-border bg-surface text-xs font-semibold text-foreground hover:bg-accent transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Globe size={14} className="text-secondary" />
                      <span>Interactive Live Demo</span>
                    </span>
                    <ExternalLink size={12} className="text-muted-foreground" />
                  </a>

                  <a
                    href={submission.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg border border-border bg-surface text-xs font-semibold text-foreground hover:bg-accent transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FileText size={14} className="text-jaipur-pink" />
                      <span>Documentation</span>
                    </span>
                    <ExternalLink size={12} className="text-muted-foreground" />
                  </a>

                  <a
                    href={submission.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg border border-border bg-surface text-xs font-semibold text-foreground hover:bg-accent transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Video size={14} className="text-jaipur-terracotta" />
                      <span>Walkthrough Video</span>
                    </span>
                    <ExternalLink size={12} className="text-muted-foreground" />
                  </a>
                </div>
              </div>

              {/* Security Isolation Notice */}
              <div className="p-3 rounded-xl border border-border bg-surface/50 text-[11px] text-muted-foreground space-y-1">
                <span className="flex items-center gap-1 font-bold text-foreground">
                  <ShieldCheck size={13} className="text-emerald-400" />
                  Local State Isolation
                </span>
                <p className="leading-snug">
                  Any score edits and notes remain strictly in your browser session. Re-opening or refreshing the page will reset to default verified fixtures.
                </p>
              </div>
            </SpotlightCard>
          </div>
        </div>
      </main>
    </div>
  );
}
