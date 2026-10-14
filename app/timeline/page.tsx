import React from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Clock,
  MapPin,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
  Info,
} from 'lucide-react';
import { pool } from '@/lib/db';

export const revalidate = 60; // ISR cache revalidated on publish

interface TimelineEvent {
  id: string;
  title: string;
  day_label: string;
  time_range: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  description: string | null;
  card_position: 'left' | 'right';
  display_order: number;
  status: string;
  event_type: string;
}

async function getTimelineData(): Promise<{ isPublished: boolean; events: TimelineEvent[] }> {
  try {
    const { rows: configRows } = await pool.query(`
      SELECT is_published FROM public.timeline_config WHERE id = 1;
    `);
    const isPublished = configRows.length > 0 ? configRows[0].is_published : true;

    if (!isPublished) {
      return { isPublished: false, events: [] };
    }

    const { rows: events } = await pool.query(`
      SELECT id, title, day_label, time_range, start_time, end_time,
             venue, description, card_position, display_order, status, event_type
      FROM public.timeline_events
      WHERE is_published = true
      ORDER BY display_order ASC;
    `);

    return { isPublished: true, events };
  } catch (err) {
    console.error('Error fetching timeline data:', err);
    return { isPublished: true, events: [] };
  }
}

export default async function TimelinePage() {
  const { isPublished, events } = await getTimelineData();

  // Group events by day label
  const day1Events = events.filter((e) => e.day_label?.toUpperCase().includes('DAY 1') || e.day_label?.toUpperCase().includes('15'));
  const day2Events = events.filter((e) => e.day_label?.toUpperCase().includes('DAY 2') || e.day_label?.toUpperCase().includes('16'));
  const otherEvents = events.filter((e) => !day1Events.includes(e) && !day2Events.includes(e));

  return (
    <div className="min-h-screen bg-[#FFF9F5] text-[#2C1810] dark:bg-[#120D0A] dark:text-[#F5EBE6] transition-colors">
      {/* Decorative Jaipur Architectural Arch Header */}
      <div className="relative overflow-hidden border-b border-[#E8D5C8]/70 dark:border-[#382820]/70 bg-gradient-to-b from-[#FDEEE3] to-[#FFF9F5] dark:from-[#1D140F] dark:to-[#120D0A] px-4 py-12 sm:px-6 sm:py-16 text-center">
        {/* Subtle decorative motif */}
        <div className="absolute inset-0 pointer-events-none opacity-5 dark:opacity-10 bg-[radial-gradient(#9A3412_1px,transparent_1px)] [background-size:16px_16px]" />
        
        <div className="relative mx-auto max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D97706]/40 bg-[#D97706]/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-[#B45309] dark:text-[#FBBF24]">
            <Sparkles size={13} className="text-[#D97706]" />
            Official Event Schedule
          </div>
          
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-[0.25em] text-[#9A3412] dark:text-[#F87171]">
            TIMELINE OF
          </h2>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-[#451A03] dark:text-[#FFF7ED]">
            Code-e-Manipal <span className="text-[#B45309] dark:text-[#F59E0B]">2.0</span>
          </h1>

          <p className="mx-auto max-w-xl text-sm sm:text-base leading-relaxed text-[#78350F]/80 dark:text-[#D1A083]">
            15–16 October 2026 &bull; Manipal University Jaipur &bull; 36-Hour Hackathon Sprint
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {!isPublished ? (
          /* Unpublished / Sealed Schedule View */
          <div className="mx-auto max-w-md rounded-3xl border border-[#E5D5C5] bg-white/80 p-8 text-center shadow-lg dark:border-[#3A2A20] dark:bg-[#1A1410]/90">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FEF3C7] text-[#D97706] dark:bg-[#2A1D0E] dark:text-[#F59E0B]">
              <Lock size={28} />
            </div>
            <h2 className="mt-4 text-xl font-bold text-[#451A03] dark:text-[#FFF7ED]">
              Timeline Awaiting Publication
            </h2>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#78350F]/70 dark:text-[#A88575]">
              The official event timeline is currently being finalized by the organizing committee. Please check back shortly before registration opens.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-xl bg-[#9A3412] px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-[#7C2D12] transition-colors"
              >
                Return to Portal
              </Link>
            </div>
          </div>
        ) : (
          /* Live Vertical Timeline */
          <div className="relative">
            {/* Day 1 Section */}
            {day1Events.length > 0 && (
              <div className="mb-14">
                {/* Day 1 Header Badge */}
                <div className="flex justify-center mb-8">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#7C2D12] px-6 py-2 shadow-md text-white text-sm font-black uppercase tracking-widest border border-[#9A3412]">
                    <CalendarDays size={16} />
                    DAY 1 &bull; 15 OCTOBER 2026
                  </div>
                </div>

                {/* Timeline Grid */}
                <div className="relative">
                  {/* Central Spine Line (desktop) / Left Spine (mobile) */}
                  <div className="absolute top-0 bottom-0 left-6 md:left-1/2 w-0.5 -translate-x-1/2 bg-[#D97706] dark:bg-[#B45309]" />

                  <div className="space-y-6 md:space-y-8">
                    {day1Events.map((event) => (
                      <TimelineCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Day 2 Section */}
            {day2Events.length > 0 && (
              <div className="mb-14">
                {/* Day 2 Header Badge */}
                <div className="flex justify-center mb-8">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#7C2D12] px-6 py-2 shadow-md text-white text-sm font-black uppercase tracking-widest border border-[#9A3412]">
                    <CalendarDays size={16} />
                    DAY 2 &bull; 16 OCTOBER 2026
                  </div>
                </div>

                {/* Timeline Grid */}
                <div className="relative">
                  <div className="absolute top-0 bottom-0 left-6 md:left-1/2 w-0.5 -translate-x-1/2 bg-[#D97706] dark:bg-[#B45309]" />

                  <div className="space-y-6 md:space-y-8">
                    {day2Events.map((event) => (
                      <TimelineCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Other Events Section (if any) */}
            {otherEvents.length > 0 && (
              <div className="mb-14">
                <div className="flex justify-center mb-8">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#78350F] px-6 py-2 shadow-md text-white text-sm font-black uppercase tracking-widest">
                    ADDITIONAL SESSIONS
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute top-0 bottom-0 left-6 md:left-1/2 w-0.5 -translate-x-1/2 bg-[#D97706]" />
                  <div className="space-y-6 md:space-y-8">
                    {otherEvents.map((event) => (
                      <TimelineCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer info banner */}
        <div className="mt-12 rounded-2xl border border-[#E8D5C8] bg-[#FFF5EE] p-5 text-center text-xs text-[#78350F] dark:border-[#382820] dark:bg-[#1A130E] dark:text-[#C49B88]">
          <p className="flex items-center justify-center gap-2 font-medium">
            <Info size={14} className="text-[#D97706] shrink-0" />
            Activities and venues are subject to authorized adjustments by the Code-e-Manipal 2.0 Organizing Committee.
          </p>
        </div>
      </div>
    </div>
  );
}

function TimelineCard({ event }: { event: TimelineEvent }) {
  const isLeft = event.card_position === 'left';

  return (
    <div className="relative flex items-center md:justify-between">
      {/* Node Marker on Spine */}
      <div className="absolute left-6 md:left-1/2 -translate-x-1/2 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#D97706] bg-[#FFF9F5] dark:bg-[#120D0A] shadow-sm">
        <div className="h-2 w-2 rounded-full bg-[#D97706]" />
      </div>

      {/* Card Container */}
      <div
        className={`w-full pl-12 md:pl-0 md:w-[45%] ${
          isLeft ? 'md:mr-auto md:text-right' : 'md:ml-auto md:text-left'
        }`}
      >
        <div className="group rounded-2xl border border-[#E5D5C5] bg-white p-5 shadow-sm hover:shadow-md transition-all dark:border-[#3A2A20] dark:bg-[#18120D]">
          {/* Time Badge */}
          <div
            className={`flex items-center gap-2 mb-2 ${
              isLeft ? 'md:justify-end' : 'md:justify-start'
            }`}
          >
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#D97706]/30 bg-[#FEF3C7] px-2.5 py-0.5 text-xs font-bold text-[#B45309] dark:bg-[#2A1D0E] dark:text-[#FBBF24]">
              <Clock size={12} className="text-[#D97706]" />
              {event.time_range}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-base sm:text-lg font-black text-[#451A03] dark:text-[#FFF7ED]">
            {event.title}
          </h3>

          {/* Venue & Notes */}
          {(event.venue || event.description) && (
            <div
              className={`mt-2.5 space-y-1 text-xs text-[#78350F]/85 dark:text-[#C79D89] ${
                isLeft ? 'md:text-right' : 'md:text-left'
              }`}
            >
              {event.venue && (
                <div
                  className={`flex items-center gap-1.5 ${
                    isLeft ? 'md:justify-end' : 'md:justify-start'
                  }`}
                >
                  <MapPin size={13} className="text-[#DC2626] shrink-0" />
                  <span className="font-semibold text-[#991B1B] dark:text-[#FCA5A5]">
                    Venue: {event.venue}
                  </span>
                </div>
              )}
              {event.description && (
                <p className="italic text-[#92400E] dark:text-[#FCD34D]/90">
                  &bull; {event.description}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
