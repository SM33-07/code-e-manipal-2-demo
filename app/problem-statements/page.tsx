import Link from "next/link";
import { Calendar, CheckCircle2, Clock, Lock, Unlock } from "lucide-react";
import { getEventConfigState } from "@/lib/event/eventConfigHelper";
import { ProblemStatementsAdminControls } from "./ProblemStatementsAdminControls";

// Publication is an operational server-side state, never a build-time value.
export const dynamic = "force-dynamic";

const PROBLEMS = [
  {
    track: "Track 01 · AI & Intelligent Systems",
    title: "Autonomous Multi-Modal Copilot for Rural Healthcare Diagnostics",
    brief: "Design an offline-first or low-bandwidth AI diagnostic copilot capable of triaging medical symptoms, localizing vernacular speech, and generating structured clinical summaries.",
    deliverables: ["Working multi-modal inference pipeline with low-connectivity fallback", "Vernacular speech-to-text or symptom-triage interface", "Public GitHub repository with reproducible setup", "Live demonstration with sample patient triage cases"],
  },
  {
    track: "Track 02 · Web3 & Decentralized Tech",
    title: "Verifiable Zero-Knowledge Supply Chain Provenance for Artisanal Crafts",
    brief: "Build a decentralized provenance verification system using zero-knowledge proofs and decentralized identity to authenticate genuine handcrafted GI-tagged goods.",
    deliverables: ["Smart-contract suite for product identity and provenance", "Zero-knowledge proof or gas-optimized verification flow", "Mobile-friendly consumer verification interface", "Comprehensive tests and public repository"],
  },
  {
    track: "Track 03 · FinTech & Healthcare Innovation",
    title: "Real-Time Fraud & Anomaly Triage for Micro-Merchant UPI Payments",
    brief: "Develop an edge-computed anomaly-detection pipeline that intercepts rogue QR injection, duplicate webhook replays, and fraudulent chargeback schemes for micro-merchants.",
    deliverables: ["Low-latency transaction anomaly service", "Merchant alert dashboard or soundbox prototype", "Fraud simulation harness", "Public code repository with architecture diagram"],
  },
  {
    track: "Track 04 · Open Innovation & Sustainability",
    title: "Clean Energy Optimization & Peak Load Shifting for University Microgrids",
    brief: "Create a smart-meter dispatch dashboard that balances solar feeds, diesel backup generators, and campus peak loads using predictive demand forecasting.",
    deliverables: ["Predictive load-optimization algorithm", "Interactive energy-management console", "Carbon-abatement metric calculator", "Clear open-source repository"],
  },
];

export default async function ProblemStatementsPage() {
  const config = await getEventConfigState();
  // This gate is deliberately independent of the hackathon phase. The static
  // challenge data below is never rendered into the server payload while false.
  const published = config.problem_statements_published;

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-4 sm:px-6 sm:py-8">
      <ProblemStatementsAdminControls published={published} />
    <header className="surface-panel border-y border-border bg-surface-elevated/90 px-5 py-8 sm:px-10 sm:py-12">
      <div className="max-w-3xl space-y-4">
        <div className="inline-flex items-center gap-2 border-b border-secondary/50 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-secondary">
            {published ? <Unlock size={13} /> : <Lock size={13} />}
            {published ? "PROBLEM STATEMENTS LIVE" : "LOCKED · AWAITING PUBLICATION"}
          </div>
          <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-6xl">Problem statements</h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {published ? "The official Code-e-Manipal 2.0 problem statements are live." : "Coming Soon. Problem statements will be released by the organizers."}
          </p>
        </div>
      </header>

      {published ? (
        <section className="space-y-6">
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold text-foreground sm:text-2xl">Official Problem Statements</h2><span className="rounded-full border border-secondary/30 bg-secondary/15 px-3 py-1 text-xs font-bold text-secondary">4 Active</span></div>
          {PROBLEMS.map((problem) => (
            <article key={problem.title} className="problem-statement-card surface-card border border-border bg-surface-elevated/90 px-4 py-6 sm:px-7 sm:py-8">
              <p className="text-xs font-bold uppercase tracking-wider text-secondary">{problem.track}</p>
              <h2 className="mt-2 text-xl font-bold text-foreground sm:text-2xl">{problem.title}</h2>
              <p className="mt-4 border-l-2 border-primary bg-accent/70 p-4 text-sm leading-relaxed text-foreground">{problem.brief}</p>
              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Expected Deliverables</h3>
              <ul className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">{problem.deliverables.map((item) => <li key={item} className="flex gap-2 border-t border-border/70 py-3 text-xs leading-relaxed text-muted-foreground"><CheckCircle2 className="shrink-0 text-primary" size={15} />{item}</li>)}</ul>
              <Link href="/submit" className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Submit Solution</Link>
            </article>
          ))}
        </section>
      ) : (
        <section className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
          <Lock className="mx-auto text-secondary" size={34} />
          <h2 className="mt-4 text-2xl font-bold text-foreground">Awaiting Publication</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">The challenge vault is sealed. Check the event timeline and return when the organizers release the official briefs.</p>
          <div className="mt-6 flex justify-center gap-3"><Link href="/timeline" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground"><Calendar size={14} />View Timeline</Link><span className="inline-flex items-center gap-2 rounded-xl bg-secondary/15 px-4 py-2 text-xs font-bold text-secondary"><Clock size={14} />Awaiting Publication</span></div>
        </section>
      )}
    </div>
  );
}
