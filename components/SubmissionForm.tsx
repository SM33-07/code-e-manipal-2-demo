"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Send, Loader2, Code2, Users, FileText, Link, Video,
  BookOpen, Lightbulb, AlertTriangle, GraduationCap,
  Map, Lock, Plus, X, Cpu, GitBranch, Layers, Zap,
} from "lucide-react";
import { BorderGlow } from "@/components/ui/BorderGlow";
import { OFFICIAL_TRACKS } from "@/lib/event/eventConstants";

// ─── Submission Interface ─────────────────────────────────────────────────────
export interface Submission {
  id: string;
  submittedAt: string;
  projectName: string;
  tagline: string;
  problemSolved: string;
  solutionSummary: string;
  techStack: string[];
  architectureOverview: string;
  technicalChallenges: string;
  githubUrl: string;
  videoUrl: string;
  docsUrl: string;
  whatWorkedWell: string;
  challengesFaced: string;
  lessonsLearned: string;
  futureRoadmap: string;
  teamName: string;
  teamMembers: string[];
  category: string;
}

interface SubmissionFormProps {
  onSubmit: (submission: Omit<Submission, "id" | "submittedAt">) => Promise<void>;
  disabled?: boolean;
}

// ─── Tech Stack Options ───────────────────────────────────────────────────────
const TECH_STACK_OPTIONS = [
  "React", "Vue", "Angular", "Next.js", "TypeScript", "Node.js",
  "Python", "Django", "FastAPI", "Flask", "PostgreSQL", "MySQL",
  "MongoDB", "Redis", "Docker", "Kubernetes", "AWS", "GCP", "Azure",
  "TensorFlow", "PyTorch", "Solidity", "Swift", "Kotlin", "Flutter",
  "GraphQL", "Rust", "Go", "Java", "C++",
];

const CATEGORIES = [...OFFICIAL_TRACKS];

// ─── Word Counter ─────────────────────────────────────────────────────────────
function wordCount(text: string) {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({
  number, title, subtitle, icon, completed,
}: {
  number: number; title: string; subtitle: string; icon: React.ReactNode; completed?: boolean;
}) {
  return (
    <div className="flex items-start gap-3.5 mb-4 pb-4 border-b border-border">
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
          completed
            ? "bg-emerald-600 text-white shadow-sm"
            : "bg-primary text-primary-foreground shadow-sm"
        }`}
      >
        {completed ? "✓" : number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-secondary shrink-0">{icon}</span>
          <h3 className="text-base font-bold text-foreground m-0 tracking-tight">
            {title}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1 mb-0 leading-relaxed">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

// ─── Field Component ──────────────────────────────────────────────────────────
function Field({
  label, icon, id, name, type = "text", value, onChange, placeholder,
  required, multiline, rows, maxWords, hint,
}: {
  label: string; icon?: React.ReactNode; id: string; name: string; type?: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder: string; required?: boolean; multiline?: boolean; rows?: number;
  maxWords?: number; hint?: string;
}) {
  const words = maxWords ? wordCount(value) : 0;
  const overLimit = maxWords ? words > maxWords : false;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-xs font-semibold text-foreground flex items-center gap-1"
        >
          {label}
          {required && <span className="text-destructive text-xs">*</span>}
        </label>
        {maxWords && (
          <span
            className={`text-xs ${
              overLimit
                ? "text-destructive font-bold"
                : words > maxWords * 0.85
                ? "text-amber-500"
                : "text-muted-foreground"
            }`}
          >
            {words}/{maxWords} words
          </span>
        )}
      </div>
      <div className="relative">
        {icon && (
          <span
            className={`absolute left-3.5 ${
              multiline ? "top-3" : "top-1/2 -translate-y-1/2"
            } text-muted-foreground pointer-events-none flex`}
          >
            {icon}
          </span>
        )}
        {multiline ? (
          <textarea
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            rows={rows || 4}
            required={required}
            className={`w-full ${
              icon ? "pl-10 pr-3.5 py-2.5" : "px-3.5 py-2.5"
            } rounded-xl bg-card border ${
              overLimit ? "border-destructive ring-1 ring-destructive/40" : "border-border"
            } text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all resize-y leading-relaxed`}
          />
        ) : (
          <input
            id={id}
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            className={`w-full ${
              icon ? "pl-10 pr-3.5 py-2.5" : "px-3.5 py-2.5"
            } rounded-xl bg-card border ${
              overLimit ? "border-destructive ring-1 ring-destructive/40" : "border-border"
            } text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all`}
          />
        )}
      </div>
      {hint && (
        <p className="text-xs text-muted-foreground m-0 leading-relaxed">
          {hint}
        </p>
      )}
    </div>
  );
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────
function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 md:p-7 rounded-2xl bg-card border border-border shadow-sm">
      {children}
    </div>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────
export function SubmissionForm({ onSubmit, disabled = false }: SubmissionFormProps) {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    projectName: "",
    tagline: "",
    problemSolved: "",
    solutionSummary: "",
    techStack: [] as string[],
    architectureOverview: "",
    technicalChallenges: "",
    githubUrl: "",
    videoUrl: "",
    docsUrl: "",
    whatWorkedWell: "",
    challengesFaced: "",
    lessonsLearned: "",
    futureRoadmap: "",
    teamName: "",
    teamMembers: [] as string[],
    category: "",
  });
  const [memberInput, setMemberInput] = useState("");
  const [lockedMembers, setLockedMembers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const toggleTech = (tech: string) => {
    setFormData((prev) => ({
      ...prev,
      techStack: prev.techStack.includes(tech)
        ? prev.techStack.filter((t) => t !== tech)
        : [...prev.techStack, tech],
    }));
  };

  const addMember = () => {
    const name = memberInput.trim();
    if (!name || formData.teamMembers.includes(name) || lockedMembers) return;
    setFormData((prev) => ({ ...prev, teamMembers: [...prev.teamMembers, name] }));
    setMemberInput("");
  };

  const removeMember = (name: string) => {
    if (lockedMembers) return;
    setFormData((prev) => ({
      ...prev,
      teamMembers: prev.teamMembers.filter((m) => m !== name),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.projectName) { toast.error("Project Name is required"); return; }
    if (!formData.tagline) { toast.error("Tagline is required"); return; }
    if (!formData.problemSolved) { toast.error("Problem Solved is required"); return; }
    if (!formData.solutionSummary) { toast.error("Solution Summary is required"); return; }
    if (wordCount(formData.solutionSummary) > 500) { toast.error("Solution Summary exceeds 500 words"); return; }
    if (!formData.category) { toast.error("Please select a Category"); return; }
    if (formData.techStack.length === 0) { toast.error("Please select at least one tech stack item"); return; }
    if (!formData.architectureOverview) { toast.error("Architecture Overview is required"); return; }
    if (wordCount(formData.architectureOverview) > 300) { toast.error("Architecture Overview exceeds 300 words"); return; }
    if (!formData.technicalChallenges) { toast.error("Unique Technical Challenges is required"); return; }
    if (!formData.githubUrl) { toast.error("GitHub/Code Repository link is required"); return; }
    if (!formData.videoUrl) { toast.error("Presentation/Demo Video link is required"); return; }
    if (!formData.docsUrl) { toast.error("Documentation/Slides link is required"); return; }
    if (!formData.whatWorkedWell) { toast.error("'What Worked Well' is required"); return; }
    if (!formData.challengesFaced) { toast.error("'What Failed / Challenges Encountered' is required"); return; }
    if (!formData.lessonsLearned) { toast.error("Lessons Learned is required"); return; }
    if (!formData.futureRoadmap) { toast.error("Future Roadmap / Next Steps is required"); return; }
    if (!formData.teamName) { toast.error("Team Name is required"); return; }
    if (formData.teamMembers.length === 0) { toast.error("Please add at least one team member"); return; }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      setFormData({
        projectName: "", tagline: "", problemSolved: "", solutionSummary: "",
        techStack: [], architectureOverview: "", technicalChallenges: "",
        githubUrl: "", videoUrl: "", docsUrl: "",
        whatWorkedWell: "", challengesFaced: "", lessonsLearned: "", futureRoadmap: "",
        teamName: "", teamMembers: [], category: "",
      });
      setLockedMembers(false);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3500);
    } catch {
      toast.error("Failed to submit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-6">
      <fieldset disabled={disabled} className="border-0 p-0 m-0 flex flex-col gap-6 w-full">

        {/* ── Section 1: Project Overview ── */}
        <Section>
          <SectionHeader
            number={1}
            title="Project Overview"
            subtitle="Project Name, Tagline, Problem Solved, and Solution Summary (Max 500 words)"
            icon={<Layers className="w-4 h-4" />}
            completed={!!(formData.projectName && formData.solutionSummary)}
          />
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="Project Name" required
                icon={<Code2 className="w-3.5 h-3.5" />}
                id="projectName" name="projectName"
                value={formData.projectName} onChange={handleChange}
                placeholder="My Awesome Project"
              />
              <Field
                label="Tagline" required
                icon={<Zap className="w-3.5 h-3.5" />}
                id="tagline" name="tagline"
                value={formData.tagline} onChange={handleChange}
                placeholder="One-line pitch of your project"
              />
            </div>
            <Field
              label="Problem Solved" required
              icon={<AlertTriangle className="w-3.5 h-3.5" />}
              id="problemSolved" name="problemSolved"
              value={formData.problemSolved} onChange={handleChange}
              placeholder="What specific problem does your project address?"
              multiline rows={3}
            />
            <Field
              label="Solution Summary" required
              icon={<FileText className="w-3.5 h-3.5" />}
              id="solutionSummary" name="solutionSummary"
              value={formData.solutionSummary} onChange={handleChange}
              placeholder="Describe your solution — how it works, what makes it unique, and the impact it creates..."
              multiline rows={5}
              maxWords={500}
            />
            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                Category
                <span className="text-destructive text-xs">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const active = formData.category === cat;
                  return (
                    <button
                      key={cat} type="button"
                      onClick={() => setFormData((p) => ({ ...p, category: active ? "" : cat }))}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Section 2: Technical Details ── */}
        <Section>
          <SectionHeader
            number={2}
            title="Technical Details"
            subtitle="Tech Stack Used (selection list), Architecture Overview (Max 300 words), Unique Technical Challenges Solved"
            icon={<Cpu className="w-4 h-4" />}
            completed={formData.techStack.length > 0 && !!formData.architectureOverview}
          />
          <div className="flex flex-col gap-4">
            {/* Tech Stack multi-select */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-secondary" />
                Tech Stack Used
                <span className="text-destructive text-xs">*</span>
                <span className="text-xs text-muted-foreground font-normal">
                  — {formData.techStack.length} selected
                </span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TECH_STACK_OPTIONS.map((tech) => {
                  const selected = formData.techStack.includes(tech);
                  return (
                    <button
                      key={tech} type="button" onClick={() => toggleTech(tech)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                        selected
                          ? "bg-secondary text-secondary-foreground shadow-sm font-semibold"
                          : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
                      }`}
                    >
                      {selected && <span>✓</span>}
                      {tech}
                    </button>
                  );
                })}
              </div>
            </div>
            <Field
              label="Architecture Overview" required
              icon={<Layers className="w-3.5 h-3.5" />}
              id="architectureOverview" name="architectureOverview"
              value={formData.architectureOverview} onChange={handleChange}
              placeholder="Describe your system architecture — components, data flow, key design decisions..."
              multiline rows={4}
              maxWords={300}
            />
            <Field
              label="Unique Technical Challenges Solved" required
              icon={<Lightbulb className="w-3.5 h-3.5" />}
              id="technicalChallenges" name="technicalChallenges"
              value={formData.technicalChallenges} onChange={handleChange}
              placeholder="What were the hardest technical problems you overcame?"
              multiline rows={3}
            />
          </div>
        </Section>

        {/* ── Section 3: External Links ── */}
        <Section>
          <SectionHeader
            number={3}
            title="External Links"
            subtitle="Public GitHub/Code Repository (required), Presentation/Demo Video (required), Documentation/Slides (optional)"
            icon={<Link className="w-4 h-4" />}
            completed={!!(formData.githubUrl && formData.videoUrl)}
          />
          <div className="flex flex-col gap-4">
            <Field
              label="Public GitHub / Code Repository" required
              icon={<GitBranch className="w-3.5 h-3.5" />}
              id="githubUrl" name="githubUrl" type="url"
              value={formData.githubUrl} onChange={handleChange}
              placeholder="https://github.com/username/repo"
              hint="Required for validation — must be a public repository"
            />
            <Field
              label="Presentation / Demo Video" required
              icon={<Video className="w-3.5 h-3.5" />}
              id="videoUrl" name="videoUrl" type="url"
              value={formData.videoUrl} onChange={handleChange}
              placeholder="https://youtube.com/watch?v=... or similar"
              hint="Required — link to your demo video or presentation recording"
            />
            <Field
              label="Documentation / Slides" required
              icon={<BookOpen className="w-3.5 h-3.5" />}
              id="docsUrl" name="docsUrl" type="url"
              value={formData.docsUrl} onChange={handleChange}
              placeholder="https://docs.google.com/... or similar"
              hint="Required — technical documentation, slides, or Notion page"
            />
          </div>
        </Section>

        {/* ── Section 4: Reflection ── */}
        <Section>
          <SectionHeader
            number={4}
            title="Reflection"
            subtitle="What Worked Well, What Failed/Challenges Encountered, Lessons Learned, Future Roadmap/Next Steps"
            icon={<GraduationCap className="w-4 h-4" />}
            completed={!!(formData.whatWorkedWell && formData.lessonsLearned)}
          />
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="What Worked Well?" required
                icon={<Lightbulb className="w-3.5 h-3.5" />}
                id="whatWorkedWell" name="whatWorkedWell"
                value={formData.whatWorkedWell} onChange={handleChange}
                placeholder="Highlight your team's biggest wins and successes..."
                multiline rows={4}
              />
              <Field
                label="What Failed / Challenges Encountered?" required
                icon={<AlertTriangle className="w-3.5 h-3.5" />}
                id="challengesFaced" name="challengesFaced"
                value={formData.challengesFaced} onChange={handleChange}
                placeholder="Be honest about what didn't go as planned..."
                multiline rows={4}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="Lessons Learned" required
                icon={<GraduationCap className="w-3.5 h-3.5" />}
                id="lessonsLearned" name="lessonsLearned"
                value={formData.lessonsLearned} onChange={handleChange}
                placeholder="Key takeaways your team gained from this experience..."
                multiline rows={4}
              />
              <Field
                label="Future Roadmap / Next Steps" required
                icon={<Map className="w-3.5 h-3.5" />}
                id="futureRoadmap" name="futureRoadmap"
                value={formData.futureRoadmap} onChange={handleChange}
                placeholder="Where would you take this project next?"
                multiline rows={4}
              />
            </div>
          </div>
        </Section>

        {/* ── Section 5: Team Info ── */}
        <Section>
          <SectionHeader
            number={5}
            title="Team Info"
            subtitle="Display of locked team members (read-only after locking)"
            icon={<Users className="w-4 h-4" />}
            completed={!!formData.teamName && formData.teamMembers.length > 0 && lockedMembers}
          />
          <div className="flex flex-col gap-4">
            <Field
              label="Team Name" required
              icon={<Users className="w-3.5 h-3.5" />}
              id="teamName" name="teamName"
              value={formData.teamName} onChange={handleChange}
              placeholder="Team Innovators"
            />
            {/* Team members input */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-secondary" />
                Team Members
                <span className="text-destructive text-xs">*</span>
                {lockedMembers && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-500 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                    <Lock className="w-2.5 h-2.5" />
                    Locked
                  </span>
                )}
              </label>

              {/* Add member input */}
              {!lockedMembers && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={memberInput}
                    onChange={(e) => setMemberInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMember(); } }}
                    placeholder="Enter team member name, press Enter"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                  <button
                    type="button" onClick={addMember}
                    className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold transition-all hover:opacity-95 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              )}

              {/* Members display */}
              {formData.teamMembers.length > 0 && (
                <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
                  <div className="flex flex-wrap gap-2">
                    {formData.teamMembers.map((member, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-medium text-foreground shadow-sm"
                      >
                        {lockedMembers && <Lock className="w-2.5 h-2.5 text-amber-500" />}
                        <span>👤</span>
                        <span>{member}</span>
                        {!lockedMembers && (
                          <button
                            type="button" onClick={() => removeMember(member)}
                            className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {lockedMembers && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 m-0">
                      Team roster is locked and will be submitted as read-only.
                    </p>
                  )}
                </div>
              )}

              {/* Lock / Unlock button */}
              {formData.teamMembers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLockedMembers((v) => !v)}
                  className={`self-start px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                    lockedMembers
                      ? "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
                  }`}
                >
                  <Lock className="w-3 h-3" />
                  {lockedMembers ? "Unlock Team Roster" : "Lock Team Roster"}
                </button>
              )}
            </div>
          </div>
        </Section>

        {/* ── Submit Button ── */}
        <div className="pt-2">
          <BorderGlow active={!disabled && !isSubmitting && !submitted}>
            <button
              type="submit"
              disabled={isSubmitting || disabled}
              className={`w-full h-13 px-8 rounded-xl text-base font-bold flex items-center justify-center gap-2.5 transition-all duration-300 shadow-md ${
                disabled
                  ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                  : submitted
                  ? "bg-emerald-600 text-white shadow-emerald-500/20"
                  : "bg-primary text-primary-foreground hover:opacity-95 active:scale-[0.99] shadow-primary/25 cursor-pointer"
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting all 5 sections...
                </>
              ) : submitted ? (
                <>✓ Successfully Submitted!</>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Hackathon Project
                </>
              )}
            </button>
          </BorderGlow>

          <p className="text-center text-xs text-muted-foreground mt-3">
            All 5 sections will be saved · Submissions are visible to all participants
          </p>
        </div>
      </fieldset>
    </form>
  );
}
