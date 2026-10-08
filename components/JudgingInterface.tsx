"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Save,
  Lightbulb,
  Code,
  Video,
  Target,
  FileText,
  Bookmark,
  ExternalLink,
} from "lucide-react";
import {
  Submission,
  Score,
  Criteria,
  WEIGHTS,
} from "@/types/judging";
import { calculateWeightedScore } from "@/utils/scoring";

interface JudgingInterfaceProps {
  submission: Submission;
  judgeId: string;
  existingScore?: Score;
  onSave: (score: Score, navigateToNext?: boolean) => void;
  onBack: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export function JudgingInterface({
  submission,
  judgeId,
  existingScore,
  onSave,
  onBack,
  onNext,
  onPrev,
  hasNext = false,
  hasPrev = false,
}: JudgingInterfaceProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "writeup" | "reflection">("overview");

  const [criteria, setCriteria] = useState<Criteria>(
    existingScore?.criteria || {
      innovation: 5,
      technical: 5,
      presentation: 5,
      impact: 5,
    }
  );

  const [feedback, setFeedback] = useState(existingScore?.feedback || "");

  useEffect(() => {
    setMounted(true);
    setCriteria(
      existingScore?.criteria || {
        innovation: 5,
        technical: 5,
        presentation: 5,
        impact: 5,
      }
    );
    setFeedback(existingScore?.feedback || "");
    setActiveTab("overview");
  }, [submission.id, existingScore]);

  if (!mounted) return null;

  const weightedScore = calculateWeightedScore(criteria);

  const updateCriterion = (key: keyof Criteria, value: number) => {
    setCriteria((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = (navigateToNext = false) => {
    const score: Score = {
      submissionId: submission.id,
      judgeId,
      criteria,
      feedback: feedback.trim(),
      isComplete: true,
    };
    onSave(score, navigateToNext);
  };

  const criteriaConfig = [
    {
      key: "innovation" as keyof Criteria,
      icon: Lightbulb,
      color: "text-amber-500",
      label: "Innovation",
      desc: "Novelty and originality of the solution.",
    },
    {
      key: "technical" as keyof Criteria,
      icon: Code,
      color: "text-primary",
      label: "Technical Implementation",
      desc: "Quality of code, architecture, and complexity.",
    },
    {
      key: "presentation" as keyof Criteria,
      icon: Video,
      color: "text-secondary",
      label: "Presentation",
      desc: "Clarity and quality of the demo and write-up.",
    },
    {
      key: "impact" as keyof Criteria,
      icon: Target,
      color: "text-emerald-500",
      label: "Impact",
      desc: "Potential real-world impact and scalability.",
    },
  ];

  // Quick Preset Comments
  const feedbackPresets = {
    positive: [
      { text: "✨ Outstanding UI/UX", desc: "Impressive visual style and details" },
      { text: "📦 Clean Architecture", desc: "Well-structured directory and files" },
      { text: "💡 Highly Innovative", desc: "Fresh idea solving a real friction point" },
      { text: "🚀 Production Ready", desc: "Stable build and live deployment" }
    ],
    constructive: [
      { text: "⚠️ Video Demo Missing", desc: "Add or fix the video demo link" },
      { text: "🛠️ Refactoring Needed", desc: "Modularize large components" },
      { text: "📈 Feasibility Risks", desc: "Evaluate real-world economics" },
      { text: "💬 Pitch Polish", desc: "Make slides and key talking points clearer" }
    ]
  };

  const handleAddPreset = (text: string) => {
    setFeedback((prev) => {
      const trimmed = prev.trim();
      const bullet = `- ${text}`;
      if (!trimmed) return bullet;
      if (trimmed.includes(text)) return prev;
      return `${trimmed}\n${bullet}`;
    });
  };

  const getYoutubeEmbed = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11
      ? `https://www.youtube.com/embed/${match[2]}`
      : null;
  };

  const embedUrl = getYoutubeEmbed(submission.demoUrl);
  const isLocked = Boolean(existingScore?.isComplete);

  return (
    <div className="w-full flex flex-col gap-6">
      
      {/* Top navigation actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-primary hover:bg-muted rounded-xl px-4 w-fit"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Sequential list navigation */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={onPrev}
            disabled={!hasPrev}
            className="h-9 px-3 rounded-xl font-bold text-xs border-border text-foreground hover:bg-muted disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          <span className="text-xs font-bold text-muted-foreground select-none">
            Project Navigation
          </span>
          <Button
            variant="outline"
            onClick={onNext}
            disabled={!hasNext}
            className="h-9 px-3 rounded-xl font-bold text-xs border-border text-foreground hover:bg-muted disabled:opacity-30"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Submission Details */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border border-border bg-card shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-4">
              <div>
                <CardTitle className="text-2xl font-bold text-foreground">
                  {submission.title}
                </CardTitle>
                <CardDescription className="text-muted-foreground mt-1">
                  Blind Evaluation — Team size: {submission.teamSize} members
                </CardDescription>
              </div>

              {/* Sub-navigation tabs */}
              <div className="flex border-b border-border mt-6 gap-2">
                {(["overview", "writeup", "reflection"] as const).map((tab) => {
                  const isActive = activeTab === tab;
                  const label =
                    tab === "overview"
                      ? "Overview"
                      : tab === "writeup"
                      ? "Technical Write-up"
                      : "Challenges & Reflection";

                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`pb-2.5 px-3 text-sm font-semibold transition-all relative ${
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                      {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardHeader>

            <CardContent className="pt-2 space-y-4">
              {activeTab === "overview" && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5" /> Project Summary
                    </h4>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                      {submission.description || "No description provided."}
                    </p>
                  </div>

                  {embedUrl ? (
                    <div className="mt-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-3 flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5" /> Demo Video Preview
                      </h4>
                      <div className="relative aspect-video rounded-xl overflow-hidden border border-border bg-black">
                        <iframe
                          src={embedUrl}
                          title={`${submission.title} Demo`}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="absolute inset-0 w-full h-full border-0"
                        />
                      </div>
                    </div>
                  ) : submission.demoUrl ? (
                    <div className="mt-4 pt-4 border-t border-border">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5" /> Project Demo
                      </h4>
                      <a
                        href={submission.demoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/20"
                      >
                        Launch Project Demo <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  ) : null}
                </div>
              )}

              {activeTab === "writeup" && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Technical Details & Architecture
                  </h4>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {submission.writeup || "No technical write-up provided."}
                  </p>
                </div>
              )}

              {activeTab === "reflection" && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5" /> Challenges & Learnings
                  </h4>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {submission.reflection || "No challenge reflection provided."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Scoring Rubric */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border border-border bg-card shadow-sm rounded-2xl">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-bold text-foreground">
                  Evaluation Scoresheet
                </CardTitle>
                {isLocked && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center gap-1">
                    🔒 Score Locked
                  </span>
                )}
              </div>
              <CardDescription className="text-muted-foreground">
                {isLocked ? "This evaluation has been completed and locked." : "Grade each rubric criterion out of 10 points."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {criteriaConfig.map(({ key, icon: Icon, color, label, desc }) => (
                <div key={key} className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${color}`} />
                      <Label className="font-bold text-sm text-foreground">
                        {label}
                      </Label>
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        ({(WEIGHTS[key] * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <span className="text-base font-bold font-mono text-primary">
                      {criteria[key]} / 10
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {desc}
                  </p>
                  <div className="flex items-center gap-3 select-none">
                    <span className="text-xs font-bold text-muted-foreground">1</span>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={criteria[key]}
                      disabled={isLocked}
                      onChange={(e) => updateCriterion(key, Number(e.target.value))}
                      className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer bg-muted accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="text-xs font-bold text-muted-foreground">10</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Feedback & Submission Action */}
          <Card className="border border-border bg-card shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">
                Qualitative Feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                readOnly={isLocked}
                placeholder={isLocked ? "No feedback provided." : "Write bulleted feedback notes for the team..."}
                rows={4}
                className="w-full text-sm rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary bg-background border border-border text-foreground transition-all read-only:opacity-75 read-only:cursor-not-allowed"
              />

              {/* Preset Comments Panel */}
              {!isLocked && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground block">
                    Quick preset templates (click to insert)
                  </Label>
                  
                  <div className="flex flex-wrap gap-1.5">
                    {feedbackPresets.positive.map((preset) => (
                      <button
                        key={preset.text}
                        onClick={() => handleAddPreset(preset.text)}
                        title={preset.desc}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-border bg-muted/50 text-foreground hover:bg-muted transition-all active:scale-95"
                      >
                        {preset.text}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {feedbackPresets.constructive.map((preset) => (
                      <button
                        key={preset.text}
                        onClick={() => handleAddPreset(preset.text)}
                        title={preset.desc}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-border bg-muted/50 text-foreground hover:bg-muted transition-all active:scale-95"
                      >
                        {preset.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Weighted Score
                  </span>
                  <div className="text-2xl font-black font-mono text-foreground mt-0.5">
                    {weightedScore.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">/ 10</span>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
                  {isLocked ? (
                    <div className="px-4 py-2 rounded-xl font-bold text-xs bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center justify-center gap-1.5">
                      🔒 Evaluation Submitted & Locked
                    </div>
                  ) : (
                    <>
                      <Button
                        onClick={() => handleSave(false)}
                        variant="outline"
                        className="h-10 px-4 rounded-xl font-bold text-xs border-border text-foreground hover:bg-muted"
                      >
                        <Save className="w-4 h-4 mr-1.5" />
                        Save & Stay
                      </Button>
                      
                      {hasNext && (
                        <Button
                          onClick={() => handleSave(true)}
                          className="h-10 px-4 rounded-xl font-bold text-xs bg-primary text-primary-foreground hover:opacity-95 shadow-sm"
                        >
                          <Save className="w-4 h-4 mr-1.5" />
                          Save & Next
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
