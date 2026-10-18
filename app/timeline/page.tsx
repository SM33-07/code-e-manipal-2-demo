"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  MapPin,
  CheckCircle2,
  Flame,
  ArrowRight,
  Lock,
} from "lucide-react";
import { Timeline, TimelineEntry } from "@/components/ui/timeline";

interface ScheduleItem {
  id: string;
  time: string;
  title: string;
  location: string;
  description: string;
  phase: "online" | "day1" | "day2";
  type: "ceremony" | "hack" | "checkpoint" | "hospitality" | "eval" | "awards";
  status: "completed" | "current" | "upcoming" | "locked";
}

const RAW_SCHEDULE: ScheduleItem[] = [
  // Online Phase (Pre-Event Onboarding)
  {
    id: "onl-1",
    time: "06 OCT, 10:00 AM",
    title: "Round 1: Online Assessment (MCQ) on Unstop",
    location: "Unstop Platform",
    description:
      "45 questions on unstop covering Programming fundamentals, Logical Reasoning, Computer Science fundamentals, and Problem Solving. Result out within 48 hrs. 120 teams to qualify for the next stage. Registration link would be shared in our bio on 1st of Oct, 2026 at 12:00 PM.",
    phase: "online",
    type: "checkpoint",
    status: "completed",
  },
  {
    id: "onl-2",
    time: "11 OCT, 2026",
    title: "National Shortlist Announcement",
    location: "Unstop & Official Portal",
    description:
      "Announcement of qualifying teams selected for Round 2 Offline Finale at Manipal University Jaipur.",
    phase: "online",
    type: "checkpoint",
    status: "completed",
  },
  {
    id: "onl-3",
    time: "PRIOR TO FINALE",
    title: "Portal Provisioning & Workspace Activation",
    location: "Online Portal",
    description:
      "Shortlisted Team Leaders receive credentials, verify rosters (1–6 members), and access the Code-e-Manipal 2.0 workspace.",
    phase: "online",
    type: "checkpoint",
    status: "completed",
  },
  {
    id: "onl-4",
    time: "OCT 14, 06:00 PM",
    title: "Pre-Hack Briefing & System Verification",
    location: "Online / Discord",
    description:
      "Briefing on hackathon rules, submission guidelines, evaluation criteria, and workspace readiness.",
    phase: "online",
    type: "checkpoint",
    status: "completed",
  },

  // Day 1 — 15 October 2026 (Authoritative UPDATED TIMELINE.pdf)
  {
    id: "d1-1",
    time: "9:00 AM – 11:00 AM",
    title: "Registration Open",
    location: "ABI",
    description:
      "Participant check-in, registration kit distribution, Wi-Fi configuration, and workstation table allocation at ABI.",
    phase: "day1",
    type: "hospitality",
    status: "completed",
  },
  {
    id: "d1-2",
    time: "11:00 AM – 1:00 PM",
    title: "Opening Ceremony",
    location: "Vasanti Pai",
    description:
      "Grand opening ceremony, keynote address by university leadership and partners, followed by introduction of mentors and jury.",
    phase: "day1",
    type: "ceremony",
    status: "completed",
  },
  {
    id: "d1-3",
    time: "1:00 PM – 2:30 PM",
    title: "Lunch",
    location: "Old Mess, AB1",
    description:
      "Buffet lunch provided for all registered participants, mentors, and organizing staff at Old Mess, AB1.",
    phase: "day1",
    type: "hospitality",
    status: "upcoming",
  },
  {
    id: "d1-4",
    time: "2:00 PM – 7:00 PM",
    title: "Project Making",
    location: "Team Workstations",
    description:
      "Problem statement closes at 4:00 PM. 36-hour sprint development commences across all project tracks.",
    phase: "day1",
    type: "hack",
    status: "current",
  },
  {
    id: "d1-5",
    time: "8:00 PM – 9:30 PM",
    title: "Dinner",
    location: "Old Mess, AB1",
    description:
      "Dinner service at Old Mess, AB1. Midnight caffeine and refreshment stations open throughout the night.",
    phase: "day1",
    type: "hospitality",
    status: "upcoming",
  },

  // Day 2 — 16 October 2026 (Authoritative UPDATED TIMELINE.pdf)
  {
    id: "d2-1",
    time: "6:00 AM – 7:30 AM",
    title: "Judging Round 2",
    location: "Team Workstations",
    description:
      "7:30 AM: results out. Evaluation of project prototype progress, system architecture, and tech stack execution.",
    phase: "day2",
    type: "eval",
    status: "upcoming",
  },
  {
    id: "d2-2",
    time: "8:00 AM – 9:30 AM",
    title: "Breakfast",
    location: "Old Mess, AB1",
    description:
      "Breakfast service at Old Mess, AB1. Final presentation prep and polish before afternoon demonstrations.",
    phase: "day2",
    type: "hospitality",
    status: "upcoming",
  },
  {
    id: "d2-3",
    time: "12:00 PM – 1:00 PM",
    title: "Lunch",
    location: "Old Mess, AB1",
    description:
      "Lunch service at Old Mess, AB1 prior to final round jury evaluations.",
    phase: "day2",
    type: "hospitality",
    status: "upcoming",
  },
  {
    id: "d2-4",
    time: "1:00 PM – 3:00 PM",
    title: "Final Round 3 Judging",
    location: "Vasanti Pai",
    description:
      "Final jury evaluation, live demonstrations, and prototype pitching before the grand jury panel at Vasanti Pai.",
    phase: "day2",
    type: "eval",
    status: "upcoming",
  },
  {
    id: "d2-5",
    time: "3:00 PM – 5:00 PM",
    title: "Result & Closing Ceremony",
    location: "Vasanti Pai",
    description:
      "Valedictory closing ceremony, announcement of track winners and overall champions, and prize distribution at Vasanti Pai.",
    phase: "day2",
    type: "awards",
    status: "upcoming",
  },
];

const PHASES = [
  { id: "all", label: "All Phases", badge: "10/10" },
  { id: "online", label: "Online Phase", badge: "4 Sessions" },
  { id: "day1", label: "Day 01 (Oct 15)", badge: "5 Programs" },
  { id: "day2", label: "Day 02 (Oct 16)", badge: "5 Milestones" },
] as const;

export default function TimelinePage() {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>(RAW_SCHEDULE);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  // Authoritative real-time sync with database server clock & published events
  useEffect(() => {
    let isMounted = true;

    const fetchTimeline = async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/timeline", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const serverEvents = json.data?.events;

        if (Array.isArray(serverEvents) && serverEvents.length > 0 && isMounted) {
          // Merge dynamic database events for Day 1 and Day 2 while preserving pre-event online phase
          const onlineItems = RAW_SCHEDULE.filter((i) => i.phase === "online");
          const liveDbItems: ScheduleItem[] = serverEvents.map((e: any) => ({
            id: e.id,
            time: e.time_range || `${e.start_time || ''} – ${e.end_time || ''}`,
            title: e.title,
            location: e.venue || "Manipal University Jaipur",
            description: e.description || "",
            phase: String(e.day_label || '').trim().toUpperCase().includes('DAY 1') ? "day1" : "day2",
            type: (e.event_type as any) || "general",
            status: e.status || "upcoming",
          }));

          setScheduleItems([...onlineItems, ...liveDbItems]);
        }
      } catch (err) {
        // Keep current schedule items on network transient failure
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchTimeline();

    // Controlled polling interval (20 seconds)
    const interval = setInterval(fetchTimeline, 20000);

    // Visibility catch-up (sleeping/background tab wakes up)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchTimeline();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Network reconnection catch-up
    const handleOnline = () => {
      fetchTimeline();
    };
    window.addEventListener("online", handleOnline);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const renderEventCards = (items: ScheduleItem[]) => {
    return (
      <div className="space-y-4">
        {items.map((item) => {
          const isCompleted = item.status === "completed";
          const isCurrent = item.status === "current";
          const isUpcoming = item.status === "upcoming";
          const isLocked = item.status === "locked";

          return (
            <div
              key={item.id}
              data-timeline-status={item.status}
              className={`timeline-event-card border-l-2 bg-surface-elevated p-4 sm:p-5 transition-colors ${
                isCurrent
                  ? "border-primary"
                  : isCompleted
                  ? "border-secondary/60 opacity-80"
                  : isLocked
                  ? "border-dashed border-border opacity-75"
                  : "border-border hover:border-secondary"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-secondary bg-secondary/15 px-2.5 py-1 rounded-md border border-secondary/25">
                    {item.time}
                  </span>

                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/15 px-2.5 py-0.5 rounded-full border border-primary/30">
                      <Flame size={12} />
                      <span>CURRENT</span>
                    </span>
                  )}

                  {isCompleted && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border">
                      <CheckCircle2 size={11} className="text-secondary" />
                      <span>Completed</span>
                    </span>
                  )}

                  {isUpcoming && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary bg-secondary/10 px-2 py-0.5 rounded-md border border-secondary/25">
                      <Clock size={11} />
                      <span>Upcoming</span>
                    </span>
                  )}

                  {isLocked && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground bg-accent/40 px-2 py-0.5 rounded-md border border-border">
                      <Lock size={11} />
                      <span>Locked</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin size={13} className="text-secondary shrink-0" />
                  <span className="truncate">{item.location}</span>
                </div>
              </div>

              <h4 className="text-base sm:text-lg font-bold text-foreground">
                {item.title}
              </h4>
              <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  // Group into Aceternity Timeline structure
  const onlineItems = scheduleItems.filter((i) => i.phase === "online");
  const day1Items = scheduleItems.filter((i) => i.phase === "day1");
  const day2Items = scheduleItems.filter((i) => i.phase === "day2");

  const timelineData: TimelineEntry[] = [];

  if (activeFilter === "all" || activeFilter === "online") {
    timelineData.push({
      title: "Online Phase",
      subtitle: "Key orientation & briefing",
      badge: "Stage 01",
      content: renderEventCards(onlineItems),
    });
  }

  if (activeFilter === "all" || activeFilter === "day1") {
    timelineData.push({
      title: "15 October — Day 1",
      subtitle: "Reporting & Hacking Launch",
      badge: "Stage 02",
      content: renderEventCards(day1Items),
    });
  }

  if (activeFilter === "all" || activeFilter === "day2") {
    timelineData.push({
      title: "16 October — Day 2",
      subtitle: "Code Freeze & Jury Demos",
      badge: "Stage 03",
      content: renderEventCards(day2Items),
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-4 sm:py-8 px-4 sm:px-6">
      {/* Header */}
      <header className="surface-panel relative overflow-hidden border-y border-border bg-surface-elevated/90 p-5 sm:p-9">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 border-b border-secondary/50 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-secondary">
            <CalendarDays size={14} />
            <span>OFFICIAL 36-HOUR EVENT SCHEDULE</span>
          </div>
          <h1 className="mt-4 text-4xl sm:text-6xl font-black tracking-tight text-foreground">
            Hackathon Timeline
          </h1>
          <p className="mt-2.5 max-w-2xl text-sm sm:text-base text-muted-foreground leading-relaxed">
            Follow the complete chronological schedule of Code-e-Manipal 2.0. From registration and
            challenge reveal to mentorship rounds, code freeze, and jury evaluation.
          </p>

          {/* Quick Metrics */}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground pt-4 border-t border-border">
            <div className="flex items-center gap-1.5">
              <Clock size={15} className="text-secondary" />
              <span>
                Duration: <strong className="text-foreground">36 Hours Continuous</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarDays size={15} className="text-secondary" />
              <span>
                Dates: <strong className="text-foreground">15 & 16 October 2026</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin size={15} className="text-secondary" />
              <span>
                Venue: <strong className="text-foreground">Manipal University Jaipur</strong>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Phase Filter Controls */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {PHASES.map(({ id, label, badge }) => {
          const isActive = activeFilter === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveFilter(id)}
              className={`inline-flex min-h-11 items-center gap-2 border px-4 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <span>{label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-background text-muted-foreground border border-border"
                }`}
              >
                {badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Aceternity-Inspired Continuous Timeline Component */}
      <Timeline data={timelineData} />

      {/* Bottom CTA Card */}
      <div className="flex flex-col items-start justify-between gap-4 border-t border-border bg-surface-elevated px-4 py-5 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-sm font-bold text-foreground">Next Hackathon Action</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review challenge tracks or prepare your team workspace while the countdown ticks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/problem-statements"
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1.5"
          >
            <span>Problem Statements</span>
            <ArrowRight size={13} />
          </Link>
          <Link
            href={isDemo ? "/results" : "/dashboard"}
            className="px-4 py-2 rounded-xl border border-border bg-background text-xs font-semibold text-foreground hover:bg-accent transition-colors"
          >
            {isDemo ? "View Results" : "My Workspace"}
          </Link>
        </div>
      </div>
    </div>
  );
}
