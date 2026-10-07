"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  Terminal,
  Cpu,
  Shield,
  ArrowRight,
  Calendar,
  MapPin,
  Clock,
  Layers,
  Code2,
  Trophy,
  Award,
  Medal,
  Activity,
  ArrowUpRight,
  type LucideIcon
} from "lucide-react";

import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { OptionWheel } from "@/components/ui/OptionWheel";
import { TextReveal } from "@/components/ui/TextReveal";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { FinalCta } from "@/components/ui/FinalCta";
import { SponsorPartners } from "@/components/ui/SponsorPartners";
import { DETAILED_TRACKS, EVENT_IDENTITY, PRIZE_STRUCTURE } from "@/lib/event/eventConstants";

type EventIndexStatus =
  | "checking"
  | "upcoming"
  | "live"
  | "submission"
  | "submission-closed"
  | "judging"
  | "results-pending"
  | "results"
  | "ended"
  | "unavailable";

export default function HomePage() {
  const { role, isAuthenticated, loading } = useAuth();
  const [eventStatus, setEventStatus] = useState<EventIndexStatus>("checking");

  useEffect(() => {
    let cancelled = false;

    async function loadEventStatus() {
      try {
        const response = await fetch("/api/event-config", { cache: "no-store" });
        const result: {
          data?: { event_phase?: string; results_release?: string };
          error?: string;
        } = await response.json();

        if (!response.ok || !result.data?.event_phase) {
          throw new Error(result.error || `Event configuration request failed (${response.status})`);
        }

        if (!cancelled) {
          const { event_phase: phase, results_release: release } = result.data;
          switch (phase) {
            case "NOT_STARTED":
              setEventStatus("upcoming");
              break;
            case "HACKING":
              setEventStatus("live");
              break;
            case "SUBMISSION":
              setEventStatus("submission");
              break;
            case "SUBMISSION_CLOSED":
              setEventStatus("submission-closed");
              break;
            case "JUDGING":
              setEventStatus("judging");
              break;
            case "RESULTS":
              setEventStatus(release === "PUBLISHED" ? "results" : "results-pending");
              break;
            case "ENDED":
              setEventStatus("ended");
              break;
            default:
              throw new Error(`Unrecognized event phase: ${phase}`);
          }
        }
      } catch (error) {
        console.error("Unable to load the event index status.", error);
        if (!cancelled) setEventStatus("unavailable");
      }
    }

    void loadEventStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const getWorkspaceHref = () => {
    if (role === "admin") return "/admin";
    if (role === "judge") return "/judge";
    return "/dashboard";
  };

  const tracks = DETAILED_TRACKS;

  const highlights = [
    { label: "Finale", value: `${EVENT_IDENTITY.durationHours} hours`, sub: "On-campus sprint" },
    { label: "Prize pool", value: PRIZE_STRUCTURE.advertisedTotal, sub: "Advertised total" },
    { label: "Challenge tracks", value: String(DETAILED_TRACKS.length), sub: "Official tracks" },
    { label: "Host", value: "MUJ", sub: "Manipal University Jaipur" }
  ];
  const prizeCards: { index: string; title: string; detail: string; icon: LucideIcon }[] = [
    { index: "01", title: "Winner", detail: PRIZE_STRUCTURE.winner, icon: Trophy },
    { index: "02", title: "1st Runner Up", detail: PRIZE_STRUCTURE.firstRunnerUp, icon: Medal },
    { index: "03", title: "2nd Runner Up", detail: PRIZE_STRUCTURE.secondRunnerUp, icon: Medal },
    { index: "TOP 10", title: "Top 10 Recognition", detail: PRIZE_STRUCTURE.top10, icon: Award },
  ];
  const eventStatusLabel: Record<EventIndexStatus, string> = {
    checking: "Checking status",
    upcoming: "Upcoming",
    live: "Hackathon in progress",
    submission: "Submission phase",
    "submission-closed": "Submissions closed",
    judging: "Judging",
    "results-pending": "Results in preparation",
    results: "Results published",
    ended: "Event concluded",
    unavailable: "Status unavailable",
  };


  return (
    <div className="mx-auto max-w-7xl space-y-16 px-4 py-6 sm:space-y-24 sm:px-6 sm:py-10">
      {/* ── HERO BANNER ── */}
      <section className="home-hero relative isolate -mx-4 flex min-h-[min(760px,calc(100svh-5rem))] items-center overflow-hidden border-y border-border/70 px-4 py-12 sm:-mx-6 sm:px-8 sm:py-16 lg:px-12 lg:py-14">
        <div className="hero-route-lines pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          <svg viewBox="0 0 1200 700" preserveAspectRatio="none" className="h-full w-full text-secondary">
            <path d="M660 700V480c0-62 50-112 112-112h168c62 0 112-50 112-112V0" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M740 700V516c0-36 29-65 65-65h123c106 0 192-86 192-192V0" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="660" cy="480" r="4" fill="currentColor" />
            <circle cx="1052" cy="256" r="4" fill="currentColor" />
          </svg>
        </div>
        <div className="relative z-10 grid w-full gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)] lg:items-center lg:gap-12">
          <div className="hero-sequence max-w-4xl space-y-6 sm:space-y-7">
            <div data-hero-step className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <span className="inline-flex items-center gap-2 text-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Manipal University Jaipur
              </span>
              <span aria-hidden="true" className="text-border">/</span>
              <span>{EVENT_IDENTITY.edition}</span>
            </div>

            <div data-hero-step className="space-y-4">
              <TextReveal as="h1" className="max-w-4xl text-[clamp(3.1rem,8.2vw,8.5rem)] font-black leading-[0.92] tracking-[-0.055em] text-foreground">
                Build what <span className="text-primary">moves</span> us forward.
              </TextReveal>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground sm:text-sm">
                Code-e-Manipal <span className="text-secondary">2.0</span> · {EVENT_IDENTITY.durationHours}-hour hackathon
              </p>
            </div>

            <p data-hero-step className="max-w-xl text-base leading-relaxed text-foreground/80 sm:text-lg">
              A focused engineering sprint at Manipal University Jaipur. Choose a challenge, build with your team, and present a working solution.
            </p>

            <div data-hero-step className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
              {loading ? (
                <div className="h-12 w-full max-w-52 animate-pulse bg-accent sm:w-52" />
              ) : isAuthenticated ? (
                <Link
                  href={getWorkspaceHref()}
                  className="hero-primary-action group inline-flex min-h-12 w-full items-center justify-center gap-2 bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-[background-color,transform] hover:bg-primary/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
                >
                  <span>Access {role === "admin" ? "Operations" : role === "judge" ? "Evaluation" : "Workspace"}</span>
                  <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="hero-primary-action group inline-flex min-h-12 w-full items-center justify-center gap-2 bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-[background-color,transform] hover:bg-primary/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
                >
                  <span>Enter the portal</span>
                  <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              )}

              <Link
                href="/timeline"
                className="group inline-flex min-h-12 items-center justify-center gap-2 border border-border bg-surface-elevated px-5 py-2.5 text-sm font-semibold text-foreground transition-[border-color,background-color] hover:border-secondary hover:bg-accent"
              >
                <Calendar size={15} className="text-secondary" />
                <span>Explore the timeline</span>
              </Link>

              <Link
                href="/problem-statements"
                className="group inline-flex min-h-12 items-center justify-center gap-2 border border-border bg-surface-elevated px-5 py-2.5 text-sm font-semibold text-foreground transition-[border-color,background-color] hover:border-primary hover:bg-accent"
              >
                <Code2 size={15} className="text-primary" />
                <span>Problem Statements</span>
              </Link>
            </div>

            <div data-hero-step className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border/80 pt-4 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-2"><Calendar size={14} className="text-primary" />{EVENT_IDENTITY.finaleDates}</span>
              <span className="inline-flex items-center gap-2"><MapPin size={14} className="text-secondary" />{EVENT_IDENTITY.hostInstitution}</span>
              <span className="inline-flex items-center gap-2"><Clock size={14} className="text-primary" />{EVENT_IDENTITY.durationHours} hours</span>
            </div>
          </div>

          <aside className="hero-index relative isolate overflow-hidden border-y border-l-4 border-secondary bg-card px-5 py-5 sm:px-7 sm:py-6 lg:min-h-[390px] lg:border-y-0 lg:border-l-4 lg:px-8 lg:py-8">
            <div className="hero-index-number pointer-events-none absolute -right-1 -top-12 select-none font-black leading-none text-secondary/[0.09]" aria-hidden="true">02</div>
            <div className="relative z-10 flex h-full flex-col justify-between gap-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">Hackathon intelligence</p>
                  <h2 className="mt-2 text-xl font-black tracking-tight text-foreground sm:text-2xl">Event index</h2>
                </div>
                <span className="font-mono text-xs font-bold tracking-[0.18em] text-muted-foreground">CEM / 02</span>
              </div>

              <div className="flex items-center gap-3 border-y border-border/80 py-3">
                <span className={`event-status-marker ${["live", "submission", "submission-closed", "judging"].includes(eventStatus) ? "event-status-marker--active" : ""}`} aria-hidden="true" />
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Current status</p>
                  <p className="mt-0.5 text-sm font-bold text-foreground" aria-live="polite">{eventStatusLabel[eventStatus]}</p>
                </div>
                <Activity className="ml-auto text-secondary" size={18} aria-hidden="true" />
              </div>

              <div>
                <div className="flex items-end justify-between gap-3">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Official tracks</p>
                  <span className="font-mono text-xs font-bold text-secondary">
                    {String(DETAILED_TRACKS.length).padStart(2, "0")} / {String(DETAILED_TRACKS.length).padStart(2, "0")}
                  </span>
                </div>
                <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 lg:grid-cols-1 lg:gap-y-2.5">
                  {DETAILED_TRACKS.slice(0, 4).map((track, index) => (
                    <li key={track.id} className={`hero-index-track hero-index-track--${index + 1} flex min-w-0 items-baseline justify-between gap-2 border-b border-border/70 pb-2 text-xs font-medium text-foreground/85`}>
                      <span className="truncate">{track.title}</span>
                      <span className="shrink-0 font-mono text-[9px] text-muted-foreground">{track.tag.replace("TRACK ", "")}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/problem-statements" className="group mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary transition-colors hover:text-primary/75">
                  Explore all tracks
                  <ArrowUpRight size={14} className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* ── OVERLAPPING EVENT METRICS RAIL ── */}
      <ScrollReveal as="section" className="hero-stats-rail relative z-20 -mt-20 grid grid-cols-2 overflow-hidden border border-border bg-surface-elevated shadow-md sm:-mt-28 sm:grid-cols-4">
        {highlights.map((item, idx) => (
          <SpotlightCard
            key={idx}
            className="hero-stat rounded-none border-0 border-r border-border p-4 shadow-none last:border-r-0 sm:p-6 lg:p-7"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-secondary font-mono">
              {item.label}
            </span>
            <div className="my-2">
              <div className="text-xl font-black tracking-tight text-foreground sm:text-2xl lg:text-3xl">
                {item.value}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{item.sub}</div>
            </div>
            <div className="hero-stat-rule h-px w-8 bg-primary/65" />
          </SpotlightCard>
        ))}
      </ScrollReveal>

      {/* ── TECHNICAL TRACKS & OPTION WHEEL EXPLORER ── */}
      <ScrollReveal as="section" className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-secondary uppercase tracking-wider mb-1">
              <Layers size={14} />
              <span>Architectural Arenas</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">
              Core Technical Tracks
            </h2>
          </div>
          <Link
            href="/problem-statements"
            className="text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Review Full Track Specifications</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {/* Interactive Track Dial (Option Wheel) */}
        <OptionWheel />

        {/* Full Track Accessible Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {tracks.map((t) => (
            <SpotlightCard
              key={t.id}
              className="p-6 sm:p-7 flex flex-col justify-between group"
            >
              <Link
                href="/problem-statements"
                aria-label={`Explore ${t.title} problem statements`}
                className="flex h-full flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-secondary">{t.tag}</span>
                    <span className="h-2 w-2 rounded-full bg-secondary/40 transition-colors group-hover:bg-secondary" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-foreground transition-colors group-hover:text-primary">
                    {t.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {t.desc}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs">
                  <span className="text-muted-foreground">36-Hour Sprint Target</span>
                  <span className="flex items-center gap-1 font-semibold text-secondary">
                    <span>Explore Briefs</span>
                    <ArrowRight size={12} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </SpotlightCard>
          ))}
        </div>
      </ScrollReveal>

      {/* ── PRIZE ARCHITECTURE ── */}
      <ScrollReveal as="section" className="grid gap-6 lg:grid-cols-[0.9fr_1.6fr] lg:items-stretch">
        <div className="rounded-3xl border border-border bg-surface-elevated p-7 shadow-sm sm:p-9">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-secondary"><Award size={15} />Competition Recognition</div>
          <TextReveal as="h2" className="mt-4 text-3xl font-black tracking-tight text-foreground sm:text-4xl">Built to reward serious work.</TextReveal>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">A layered recognition structure for the projects that demonstrate technical depth, credible execution, and real-world impact.</p>
          <Link href="/timeline" className="mt-8 inline-flex items-center gap-2 text-xs font-bold text-primary hover:text-primary/80">View ceremony schedule <ArrowRight size={14} /></Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {prizeCards.map(({ index, title, detail, icon: PrizeIcon }) => (
            <article
              key={title}
              className={`prize-rank group rounded-2xl border border-border bg-card p-5 shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-secondary/60 hover:shadow-md ${index === "01" ? "prize-rank--winner sm:col-span-2" : ""}`}
            >
              <div className="flex items-start justify-between">
                <span className="font-mono text-[11px] font-bold text-secondary">{index}</span>
                <PrizeIcon size={18} className="text-primary transition-transform duration-200 group-hover:-translate-y-0.5" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-foreground">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{detail}</p>
            </article>
          ))}
        </div>
      </ScrollReveal>

      {/* ── CONSOLE CAPABILITIES / SYSTEM ARCHITECTURE ── */}
      <ScrollReveal as="section" className="mission-section relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
            <Cpu size={14} />
            <span>Mission Infrastructure</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-foreground">
            Built for Serious Hackathon Operations
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
            The Code-e-Manipal 2.0 portal is engineered from the ground up to deliver low-latency telemetry, deterministic submission state machines, and cryptographically verified adjudication.
          </p>
        </div>

        <div className="mission-card-grid grid grid-cols-1 gap-4 pt-2 sm:grid-cols-3">
          <FeatureCard index="01" icon={Terminal} title="Immutable Finalization" description="Submission states transition through strict verification locks with tamper-proof timestamps and audit logs." />
          <FeatureCard index="02" icon={Shield} title="Blind Adjudication" description="Dual-blind jury review matrices prevent bias. Scores remain sealed until official ceremony release." />
          <FeatureCard index="03" icon={Trophy} title="Live Telemetry" description="Real-time phase transitions, synchronized countdown clocks, and live broadcast announcements for all squads." />
        </div>
      </ScrollReveal>

      {/* OFFICIAL_PARTNERS default list used — logos served from /public/images/partners/ */}
      <ScrollReveal as="div"><SponsorPartners /></ScrollReveal>

      {/* ── FOOTER CALLOUT ── */}
      <ScrollReveal as="div"><FinalCta title="Ready to Begin the Engineering Sprint?" description="Sign in with your provisioned team credentials or review the event timeline before the challenge release." href="/login" action="Enter Console" /></ScrollReveal>
    </div>
  );
}
