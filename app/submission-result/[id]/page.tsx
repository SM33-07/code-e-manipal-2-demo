"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { 
  CheckCircle2, Github, Globe, FileText, ExternalLink, 
  Clock, Calendar, Award, MessageSquare, Layers, 
  AlertTriangle, Cpu, Users, Video, Play, BookOpen, 
  Compass, ArrowUpRight, Flame, Heart, Share2
} from "lucide-react";

import AppShell from "@/components/ui/AppShell";
import { Confetti } from "@/components/ui/Confetti";

// ─── Animations ─────────────────────────────────────────────────────────────
const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 },
  },
};

// ─── Markdown Parser Helper ──────────────────────────────────────────────────
function renderMarkdownLite(text: string) {
  if (!text) return <p className="text-muted-foreground italic">No details provided for this section.</p>;
  const paragraphs = text.split("\n\n");

  return paragraphs.map((p, i) => {
    const trimmed = p.trim();
    if (!trimmed) return null;

    const lines = trimmed.split("\n");
    const isList = lines.every((l) => l.trim().startsWith("-"));

    if (isList) {
      return (
        <ul key={i} className="list-disc list-inside space-y-1.5 ml-2 my-3 text-foreground/80 leading-relaxed text-sm md:text-base">
          {lines.map((line, j) => (
            <li
              key={j}
              dangerouslySetInnerHTML={{
                __html: formatBold(line.replace(/^-\s*/, "")),
              }}
            />
          ))}
        </ul>
      );
    }

    return (
      <p
        key={i}
        className="my-3 text-foreground/80 leading-relaxed text-sm md:text-base"
        dangerouslySetInnerHTML={{
          __html: formatBold(trimmed.replace(/\n/g, "<br/>")),
        }}
      />
    );
  });
}

function formatBold(text: string) {
  return text.replace(
    /\*\*(.*?)\*\*/g,
    '<strong class="text-foreground font-semibold">$1</strong>'
  );
}

// ─── Video Embed Helper ──────────────────────────────────────────────────────
function getEmbedUrl(url: string) {
  if (!url) return null;
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const ytMatch = url.match(ytRegex);
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }
  const loomRegex = /loom\.com\/share\/([a-zA-Z0-9]+)/;
  const loomMatch = url.match(loomRegex);
  if (loomMatch) {
    return `https://www.loom.com/embed/${loomMatch[1]}`;
  }
  return null;
}

export default function SubmissionResultPage() {
  const { id } = useParams();
  const [submission, setSubmission] = useState<any>(null);
  const [upvoted, setUpvoted] = useState(false);
  const [upvoteCount, setUpvoteCount] = useState(42);

  useEffect(() => {
    async function fetchSubmission() {
      try {
        const res = await fetch(`/api/submissions/${id}`);
        if (res.ok) {
          const data = await res.json();
          setSubmission(data.data);
        }
      } catch (err) {
        console.error("Failed to load submission:", err);
      }
    }

    if (id) fetchSubmission();
  }, [id]);

  if (!submission) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full border-2 border-jaipur-gold/20 border-t-jaipur-gold animate-spin" />
            <p className="text-sm text-muted-foreground">Loading Solution Write-Up...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const teamName = submission.teams?.name || "Team";
  const hackathonName = submission.teams?.hackathon || "LearnIT 2025";
  const submittedAt = submission.created_at ? new Date(submission.created_at) : new Date();
  const embedUrl = getEmbedUrl(submission.demo_video_url);

  // Calculate Average Judge Scores if reviews are available
  const activeReviews = submission.reviews?.filter((r: any) => r.is_complete) || [];
  const hasScores = activeReviews.length > 0;
  
  let avgScores: any = null;
  if (hasScores) {
    avgScores = {
      innovation: parseFloat((activeReviews.reduce((sum: number, r: any) => sum + (r.score_innovation || 0), 0) / activeReviews.length).toFixed(1)),
      technical: parseFloat((activeReviews.reduce((sum: number, r: any) => sum + (r.score_technical || 0), 0) / activeReviews.length).toFixed(1)),
      presentation: parseFloat((activeReviews.reduce((sum: number, r: any) => sum + (r.score_presentation || 0), 0) / activeReviews.length).toFixed(1)),
      impact: parseFloat((activeReviews.reduce((sum: number, r: any) => sum + (r.score_impact || 0), 0) / activeReviews.length).toFixed(1)),
    };
    avgScores.total = parseFloat(((avgScores.innovation + avgScores.technical + avgScores.presentation + avgScores.impact) / 4).toFixed(1));
  }

  return (
    <AppShell>
      <Confetti />

      <motion.main
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-8"
      >
        {/* ─── Success Confirmation Alert ─── */}
        <motion.div
          variants={item}
          className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 md:p-5 flex items-start gap-4 shadow-sm"
        >
          <div className="p-2 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 shrink-0">
            <CheckCircle2 className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-green-800 dark:text-green-400">
              Project Locked and Submitted Successfully!
            </h2>
            <p className="text-xs text-green-700/80 dark:text-green-400/80 mt-1 leading-relaxed">
              Congratulations! Your solution write-up has been successfully logged to the database. The evaluators will review this documentation and your presentation pitch during active grading rounds.
            </p>
          </div>
        </motion.div>

        {/* ─── Kaggle Write-Up Header Block ─── */}
        <motion.div
          variants={item}
          className="glass-card p-6 md:p-8 rounded-2xl border border-jaipur-gold/20 flex flex-col md:flex-row items-start justify-between gap-6"
        >
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-jaipur-primary/10 border border-jaipur-primary/20 text-jaipur-primary font-bold uppercase tracking-wider">
                🏆 Solution Write-up
              </span>
              <span className="px-2.5 py-1 rounded-full bg-jaipur-gold/10 border border-jaipur-gold/20 text-jaipur-gold font-medium">
                {submission.category || "General"} Category
              </span>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
              {submission.title}
            </h1>

            <p className="text-lg text-muted-foreground font-medium italic">
              {submission.tagline || "A novel approach towards solving event constraints."}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-xs text-muted-foreground font-mono">
              <span className="flex items-center gap-1">
                <Users size={13} className="text-jaipur-primary" />
                Team: <strong className="text-foreground font-semibold">{teamName}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar size={13} />
                {format(submittedAt, "MMM d, yyyy")}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock size={13} />
                {format(submittedAt, "h:mm a")}
              </span>
            </div>
          </div>

          {/* Upvote & Action Bar (Kaggle Style) */}
          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto border-t md:border-none pt-4 md:pt-0">
            <button 
              onClick={() => {
                setUpvoted(!upvoted);
                setUpvoteCount(prev => upvoted ? prev - 1 : prev + 1);
              }}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-semibold text-sm transition-all active:scale-95 duration-200 cursor-pointer flex-1 md:flex-initial ${
                upvoted 
                  ? "bg-jaipur-primary border-jaipur-primary text-white shadow-md shadow-jaipur-primary/20" 
                  : "bg-jaipur-secondary/40 border-jaipur-gold/20 hover:border-jaipur-gold/50 text-foreground"
              }`}
            >
              <Heart size={16} className={upvoted ? "fill-white text-white" : "text-jaipur-primary"} />
              <span>Upvote ({upvoteCount})</span>
            </button>
            <button className="p-2.5 rounded-xl border border-jaipur-gold/20 hover:border-jaipur-gold/50 bg-jaipur-secondary/40 text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              <Share2 size={16} />
            </button>
          </div>
        </motion.div>

        {/* ─── Main Content Grid ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* ─── Left Column: Sticky Sidebar ─── */}
          <div className="lg:col-span-1 space-y-6">
            <div className="lg:sticky lg:top-24 space-y-6">
              
              {/* Quick Resources links */}
              <motion.div variants={item} className="glass-card p-5 rounded-xl border border-jaipur-gold/20 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Compass size={14} className="text-jaipur-primary" /> Resources & Code
                </h3>
                <div className="flex flex-col gap-2">
                  {submission.github_url ? (
                    <a 
                      href={submission.github_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 p-3 rounded-lg bg-jaipur-secondary/30 hover:bg-jaipur-primary/10 border border-jaipur-gold/15 text-sm font-medium hover:text-jaipur-primary transition-all duration-200 group"
                    >
                      <Github size={16} className="text-muted-foreground group-hover:text-jaipur-primary" />
                      <span className="flex-1 truncate">Source Repository</span>
                      <ArrowUpRight size={13} className="opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                    </a>
                  ) : (
                    <div className="text-xs p-3 rounded-lg bg-muted/20 border border-border/50 text-muted-foreground italic text-center">
                      No repository linked
                    </div>
                  )}

                  {submission.demo_url && (
                    <a 
                      href={submission.demo_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 p-3 rounded-lg bg-jaipur-secondary/30 hover:bg-jaipur-primary/10 border border-jaipur-gold/15 text-sm font-medium hover:text-jaipur-primary transition-all duration-200 group"
                    >
                      <Globe size={16} className="text-muted-foreground group-hover:text-jaipur-primary" />
                      <span className="flex-1 truncate">Live Deployment</span>
                      <ArrowUpRight size={13} className="opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                    </a>
                  )}

                  {submission.docs_url && (
                    <a 
                      href={submission.docs_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 p-3 rounded-lg bg-jaipur-secondary/30 hover:bg-jaipur-primary/10 border border-jaipur-gold/15 text-sm font-medium hover:text-jaipur-primary transition-all duration-200 group"
                    >
                      <FileText size={16} className="text-muted-foreground group-hover:text-jaipur-primary" />
                      <span className="flex-1 truncate">Documentation / Slides</span>
                      <ArrowUpRight size={13} className="opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                    </a>
                  )}
                </div>
              </motion.div>

              {/* Technologies Tag Box */}
              <motion.div variants={item} className="glass-card p-5 rounded-xl border border-jaipur-gold/20 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Cpu size={14} className="text-jaipur-primary" /> Technology Stack
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {submission.technologies && submission.technologies.length > 0 ? (
                    submission.technologies.map((tech: string) => (
                      <span key={tech} className="text-xs px-2 py-1 rounded bg-jaipur-secondary/60 border border-jaipur-gold/10 text-foreground font-mono">
                        {tech}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">No tags specified</span>
                  )}
                </div>
              </motion.div>

              {/* Team Members list */}
              <motion.div variants={item} className="glass-card p-5 rounded-xl border border-jaipur-gold/20 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Users size={14} className="text-jaipur-primary" /> Team Contributors
                </h3>
                <div className="space-y-2.5">
                  {submission.teams?.team_members && submission.teams.team_members.length > 0 ? (
                    submission.teams.team_members.map((member: any) => (
                      <div key={member.user_id} className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-jaipur-secondary border border-jaipur-gold/20 text-jaipur-primary font-bold text-xs flex items-center justify-center uppercase shrink-0">
                          {member.profiles?.name?.charAt(0) || "U"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{member.profiles?.name || "Participant"}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">{member.role || "Member"}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground italic">No members logged</div>
                  )}
                </div>
              </motion.div>

              {/* Document Outline (Sticky TOC Sidebar navigation) */}
              <motion.div variants={item} className="glass-card p-5 rounded-xl border border-jaipur-gold/20 space-y-2 hidden lg:block">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Document Outline
                </h3>
                <nav className="space-y-2 text-xs font-medium">
                  <a href="#summary" className="block text-muted-foreground hover:text-jaipur-primary border-l-2 border-transparent pl-2.5 py-0.5 hover:border-jaipur-primary/50 transition-all">1. Summary Abstract</a>
                  <a href="#problem" className="block text-muted-foreground hover:text-jaipur-primary border-l-2 border-transparent pl-2.5 py-0.5 hover:border-jaipur-primary/50 transition-all">2. Problem Statement</a>
                  <a href="#architecture" className="block text-muted-foreground hover:text-jaipur-primary border-l-2 border-transparent pl-2.5 py-0.5 hover:border-jaipur-primary/50 transition-all">3. Architecture & Details</a>
                  <a href="#challenges" className="block text-muted-foreground hover:text-jaipur-primary border-l-2 border-transparent pl-2.5 py-0.5 hover:border-jaipur-primary/50 transition-all">4. Challenges & What Worked</a>
                  <a href="#roadmap" className="block text-muted-foreground hover:text-jaipur-primary border-l-2 border-transparent pl-2.5 py-0.5 hover:border-jaipur-primary/50 transition-all">5. Future Roadmap</a>
                  {embedUrl && <a href="#video-pitch" className="block text-muted-foreground hover:text-jaipur-primary border-l-2 border-transparent pl-2.5 py-0.5 hover:border-jaipur-primary/50 transition-all">6. Video Presentation</a>}
                  <a href="#reviews" className="block text-muted-foreground hover:text-jaipur-primary border-l-2 border-transparent pl-2.5 py-0.5 hover:border-jaipur-primary/50 transition-all">7. Evaluation & Feedback</a>
                </nav>
              </motion.div>

            </div>
          </div>

          {/* ─── Right Column: Write-Up Narrative (Kaggle Post) ─── */}
          <div className="lg:col-span-3 space-y-8">
            
            {/* The Writeup Body */}
            <motion.div 
              variants={item} 
              className="glass-card p-6 md:p-10 rounded-2xl border border-jaipur-gold/20 space-y-10 text-left"
            >
              
              {/* SECTION 1: Summary Abstract */}
              <section id="summary" className="scroll-mt-24 space-y-3">
                <h2 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2.5 pb-2 border-b border-jaipur-gold/15">
                  <span className="text-jaipur-primary text-lg font-mono">1.</span>
                  Summary Abstract
                </h2>
                <div className="prose dark:prose-invert max-w-none text-foreground/80">
                  {renderMarkdownLite(submission.summary)}
                </div>
              </section>

              {/* SECTION 2: Problem Statement */}
              <section id="problem" className="scroll-mt-24 space-y-3">
                <h2 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2.5 pb-2 border-b border-jaipur-gold/15">
                  <span className="text-jaipur-primary text-lg font-mono">2.</span>
                  Problem Statement & Context
                </h2>
                <div className="prose dark:prose-invert max-w-none text-foreground/80">
                  {renderMarkdownLite(submission.problem_solved || submission.description)}
                </div>
              </section>

              {/* SECTION 3: Technical Implementation & Architecture */}
              <section id="architecture" className="scroll-mt-24 space-y-4">
                <h2 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2.5 pb-2 border-b border-jaipur-gold/15">
                  <span className="text-jaipur-primary text-lg font-mono">3.</span>
                  Architecture & Implementation Details
                </h2>
                
                {/* Architecture writeup */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">Architecture Overview</h4>
                    <div className="prose dark:prose-invert max-w-none text-foreground/80">
                      {renderMarkdownLite(submission.architecture_overview)}
                    </div>
                  </div>
                  
                  {submission.technical_challenges && (
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">Technical Implementation Notes</h4>
                      <div className="prose dark:prose-invert max-w-none text-foreground/80">
                        {renderMarkdownLite(submission.technical_challenges)}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* SECTION 4: Challenges faced & What worked well */}
              <section id="challenges" className="scroll-mt-24 space-y-4">
                <h2 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2.5 pb-2 border-b border-jaipur-gold/15">
                  <span className="text-jaipur-primary text-lg font-mono">4.</span>
                  Key Challenges & Validations
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="p-5 rounded-xl bg-jaipur-secondary/20 border border-jaipur-gold/10 space-y-2">
                    <h3 className="text-sm font-bold text-jaipur-primary flex items-center gap-2">
                      <Flame size={15} /> What Failed / Challenges Encountered
                    </h3>
                    <div className="text-xs md:text-sm text-foreground/80 leading-relaxed">
                      {renderMarkdownLite(submission.challenges_faced || "No negative constraints documented.")}
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-jaipur-secondary/20 border border-jaipur-gold/10 space-y-2">
                    <h3 className="text-sm font-bold text-[#F0C060] flex items-center gap-2">
                      <CheckCircle2 size={15} /> What Worked Well / Validation
                    </h3>
                    <div className="text-xs md:text-sm text-foreground/80 leading-relaxed">
                      {renderMarkdownLite(submission.what_worked_well || "No positive validation results documented.")}
                    </div>
                  </div>
                </div>

                {submission.lessons_learned && (
                  <div className="pt-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">Reflection & Learnings</h4>
                    <div className="prose dark:prose-invert max-w-none text-foreground/80">
                      {renderMarkdownLite(submission.lessons_learned)}
                    </div>
                  </div>
                )}
              </section>

              {/* SECTION 5: Future Roadmap */}
              <section id="roadmap" className="scroll-mt-24 space-y-3">
                <h2 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2.5 pb-2 border-b border-jaipur-gold/15">
                  <span className="text-jaipur-primary text-lg font-mono">5.</span>
                  Future Roadmap & Scalability
                </h2>
                <div className="prose dark:prose-invert max-w-none text-foreground/80">
                  {renderMarkdownLite(submission.future_roadmap)}
                </div>
              </section>

              {/* SECTION 6: Embedded Demo Video */}
              {embedUrl && (
                <section id="video-pitch" className="scroll-mt-24 space-y-4">
                  <h2 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2.5 pb-2 border-b border-jaipur-gold/15">
                    <span className="text-jaipur-primary text-lg font-mono">6.</span>
                    Presentation Pitch & Video Demo
                  </h2>
                  <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden border border-jaipur-gold/30 shadow-lg bg-black">
                    <iframe 
                      src={embedUrl}
                      title={`${submission.title} Demo Video`}
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </section>
              )}

            </motion.div>

            {/* SECTION 7: Peer Review / Evaluation Block (Comment Section style) */}
            <motion.div 
              id="reviews"
              variants={item} 
              className="glass-card p-6 md:p-8 rounded-2xl border border-jaipur-gold/20 space-y-6 text-left scroll-mt-24"
            >
              <h2 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2.5">
                <Award className="w-5.5 h-5.5 text-jaipur-gold" />
                Evaluation & Peer Feedback
              </h2>

              {!hasScores ? (
                <div className="text-center py-10">
                  <div className="w-14 h-14 rounded-full bg-jaipur-secondary/40 flex items-center justify-center mx-auto mb-3">
                    <Award className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <p className="text-base font-semibold text-foreground/80">Evaluation Pending</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    The panel of evaluators has not finalized scores for this submission. Grading feedback will show up here.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Scores Stat Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="p-4 rounded-xl bg-jaipur-primary/10 border border-jaipur-primary/25 text-center flex flex-col justify-center">
                      <p className="text-3xl font-extrabold text-jaipur-primary">{avgScores.total}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-wider">Composite Rating</p>
                    </div>
                    <div className="p-4 rounded-xl bg-jaipur-secondary/40 border border-jaipur-gold/15 text-center">
                      <p className="text-2xl font-bold text-foreground">{avgScores.innovation}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Innovation</p>
                    </div>
                    <div className="p-4 rounded-xl bg-jaipur-secondary/40 border border-jaipur-gold/15 text-center">
                      <p className="text-2xl font-bold text-foreground">{avgScores.technical}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Tech Depth</p>
                    </div>
                    <div className="p-4 rounded-xl bg-jaipur-secondary/40 border border-jaipur-gold/15 text-center">
                      <p className="text-2xl font-bold text-foreground">{avgScores.presentation}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Presentation</p>
                    </div>
                    <div className="p-4 rounded-xl bg-jaipur-secondary/40 border border-jaipur-gold/15 text-center col-span-2 md:col-span-1">
                      <p className="text-2xl font-bold text-foreground">{avgScores.impact}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Impact</p>
                    </div>
                  </div>

                  {/* Individual Comments / Reviews */}
                  <div className="space-y-4 pt-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <MessageSquare size={13} /> Evaluator Reviews ({activeReviews.length})
                    </h3>
                    <div className="divide-y divide-jaipur-gold/10">
                      {activeReviews.map((review: any, idx: number) => (
                        <div key={idx} className="py-4 first:pt-0 last:pb-0 flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-jaipur-gold/10 border border-jaipur-gold/30 text-jaipur-gold font-bold text-xs flex items-center justify-center uppercase shrink-0">
                            {review.profiles?.name?.charAt(0) || "J"}
                          </div>
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex justify-between items-baseline gap-2">
                              <h4 className="text-xs font-bold text-foreground">{review.profiles?.name || "Anonymous Judge"}</h4>
                              <span className="text-[10px] text-muted-foreground font-mono">Verified Evaluator</span>
                            </div>
                            <p className="text-xs md:text-sm text-foreground/80 leading-relaxed italic">
                              &quot;{review.feedback || "No verbal feedback provided, scores locked."}&quot;
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>

          </div>
        </div>

      </motion.main>
    </AppShell>
  );
}