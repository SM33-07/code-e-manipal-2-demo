/**
 * Canonical Event Schedule & Timeline Service (Phase 2 Requirement A & B)
 * File: services/timelineService.ts
 *
 * Implements:
 * - Single source of truth for event timeline backed by public.timeline_events.
 * - Automatic real-time event status derivation based on database server time:
 *     - 'upcoming':  now < start_timestamp
 *     - 'current':   now >= start_timestamp AND now <= end_timestamp
 *     - 'completed': now > end_timestamp
 * - Exact boundary semantics: [start_timestamp, end_timestamp] is inclusive.
 * - Draft schedule isolation: participant endpoints filter out is_published = FALSE.
 * - Round-aware timers: active round, time remaining, and next round metadata.
 * - Timezone support: canonical timestamps stored in timestamptz and rendered in configured timezone (Asia/Kolkata).
 */

import { pool, query } from '@/lib/db';
import { logger } from '@/lib/utils/logger';

export const EVENT_TIMEZONE = 'Asia/Kolkata';

export type EventStatus = 'upcoming' | 'current' | 'completed';

export interface TimelineEventRecord {
  id: string;
  title: string;
  day_label: string;
  time_range: string;
  start_time: string | null;
  end_time: string | null;
  start_timestamp: string | null;
  end_timestamp: string | null;
  timezone: string;
  venue: string | null;
  description: string | null;
  card_position: 'left' | 'right';
  display_order: number;
  status: EventStatus;
  event_type: string;
  is_published: boolean;
  opens_submissions: boolean;
  closes_submissions: boolean;
  reminders_enabled: boolean;
  reminder_offsets_minutes: number[];
  created_at: string;
  updated_at: string;
}

export interface ActiveRoundInfo {
  activeRound: TimelineEventRecord | null;
  nextRound: TimelineEventRecord | null;
  isHackingActive: boolean;
  timeRemainingSeconds: number | null;
  timeRemainingFormatted: string;
  serverTime: string;
}

/**
 * Derives dynamic event status based on authoritative server timestamp.
 * Exact boundary semantics:
 * - upcoming:  serverNow < start
 * - current:   serverNow >= start AND serverNow <= end
 * - completed: serverNow > end
 */
export function deriveEventStatus(
  startIso: string | null,
  endIso: string | null,
  serverNowMs: number
): EventStatus {
  if (!startIso) return 'upcoming';

  const startMs = new Date(startIso).getTime();
  const endMs = endIso ? new Date(endIso).getTime() : startMs + 3600000;

  if (serverNowMs < startMs) {
    return 'upcoming';
  } else if (serverNowMs >= startMs && serverNowMs <= endMs) {
    return 'current';
  } else {
    return 'completed';
  }
}

/**
 * Retrieves the published timeline events for participants with live derived status.
 * Strictly isolates unpublished draft events.
 */
export async function getPublishedTimeline(): Promise<{
  events: TimelineEventRecord[];
  serverTime: string;
  config: { is_published: boolean; published_at: string | null; published_version: number };
}> {
  const { rows } = await query(`
    SELECT 
      tc.is_published as cfg_is_published,
      tc.published_at as cfg_published_at,
      tc.published_version as cfg_published_version,
      NOW() as server_now,
      te.id, te.title, te.day_label, te.time_range, te.start_time, te.end_time,
      te.start_timestamp, te.end_timestamp, te.timezone, te.venue, te.description,
      te.card_position, te.display_order, te.event_type, te.is_published,
      te.opens_submissions, te.closes_submissions, te.reminders_enabled,
      te.reminder_offsets_minutes, te.created_at, te.updated_at
    FROM public.timeline_config tc
    LEFT JOIN public.timeline_events te ON te.is_published = TRUE
    WHERE tc.id = 1
    ORDER BY te.display_order ASC;
  `);

  if (rows.length === 0) {
    return {
      events: [],
      serverTime: new Date().toISOString(),
      config: { is_published: true, published_at: null, published_version: 1 },
    };
  }

  const first = rows[0];
  const config = {
    is_published: Boolean(first.cfg_is_published),
    published_at: first.cfg_published_at ? new Date(first.cfg_published_at).toISOString() : null,
    published_version: Number(first.cfg_published_version || 1),
  };

  const serverNow = new Date(first.server_now);
  const serverNowMs = serverNow.getTime();

  if (!config.is_published) {
    return {
      events: [],
      serverTime: serverNow.toISOString(),
      config,
    };
  }

  const events: TimelineEventRecord[] = rows
    .filter((r: any) => r.id !== null)
    .map((e: any) => {
      const derivedStatus = deriveEventStatus(e.start_timestamp, e.end_timestamp, serverNowMs);
      return {
        id: e.id,
        title: e.title,
        day_label: e.day_label,
        time_range: e.time_range,
        start_time: e.start_time,
        end_time: e.end_time,
        start_timestamp: e.start_timestamp,
        end_timestamp: e.end_timestamp,
        timezone: e.timezone,
        venue: e.venue,
        description: e.description,
        card_position: e.card_position,
        display_order: e.display_order,
        status: derivedStatus,
        event_type: e.event_type,
        is_published: e.is_published,
        opens_submissions: e.opens_submissions,
        closes_submissions: e.closes_submissions,
        reminders_enabled: e.reminders_enabled,
        reminder_offsets_minutes: e.reminder_offsets_minutes,
        created_at: e.created_at,
        updated_at: e.updated_at,
      };
    });

  return {
    events,
    serverTime: serverNow.toISOString(),
    config,
  };
}

/**
 * Retrieves all timeline events including drafts for administrative operations.
 */
export async function getAllTimelineEventsAdmin(): Promise<{
  events: TimelineEventRecord[];
  serverTime: string;
  config: any;
}> {
  const { rows: timeRows } = await query('SELECT NOW() as server_now');
  const serverNow = new Date(timeRows[0].server_now);
  const serverNowMs = serverNow.getTime();

  const { rows: configRows } = await query('SELECT * FROM public.timeline_config WHERE id = 1');
  const { rows: rawEvents } = await query(
    'SELECT * FROM public.timeline_events ORDER BY display_order ASC'
  );

  const events: TimelineEventRecord[] = rawEvents.map((e: any) => ({
    ...e,
    status: deriveEventStatus(e.start_timestamp, e.end_timestamp, serverNowMs),
  }));

  return {
    events,
    serverTime: serverNow.toISOString(),
    config: configRows[0] || null,
  };
}

/**
 * Derives round-aware timer state based on published schedule events.
 */
export async function getActiveRoundInfo(): Promise<ActiveRoundInfo> {
  const { events, serverTime } = await getPublishedTimeline();
  const serverNowMs = new Date(serverTime).getTime();

  let activeRound: TimelineEventRecord | null = null;
  let nextRound: TimelineEventRecord | null = null;

  for (const e of events) {
    if (e.status === 'current') {
      activeRound = e;
      break;
    }
  }

  for (const e of events) {
    if (e.status === 'upcoming') {
      nextRound = e;
      break;
    }
  }

  let isHackingActive = false;
  let timeRemainingSeconds: number | null = null;
  let timeRemainingFormatted = 'Not Started';

  if (activeRound && activeRound.end_timestamp) {
    const endMs = new Date(activeRound.end_timestamp).getTime();
    timeRemainingSeconds = Math.max(0, Math.floor((endMs - serverNowMs) / 1000));
    isHackingActive = activeRound.event_type === 'hack' || activeRound.opens_submissions === true;

    const hours = Math.floor(timeRemainingSeconds / 3600);
    const minutes = Math.floor((timeRemainingSeconds % 3600) / 60);
    const seconds = timeRemainingSeconds % 60;
    timeRemainingFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  } else if (nextRound && nextRound.start_timestamp) {
    const startMs = new Date(nextRound.start_timestamp).getTime();
    timeRemainingSeconds = Math.max(0, Math.floor((startMs - serverNowMs) / 1000));
    timeRemainingFormatted = `Starts in ${Math.ceil(timeRemainingSeconds / 60)}m`;
  }

  return {
    activeRound,
    nextRound,
    isHackingActive,
    timeRemainingSeconds,
    timeRemainingFormatted,
    serverTime,
  };
}

/**
 * Updates a timeline event (Admin only).
 */
export async function updateTimelineEvent(
  id: string,
  data: Partial<TimelineEventRecord>
): Promise<TimelineEventRecord | null> {
  const allowedFields = [
    'title',
    'day_label',
    'time_range',
    'start_time',
    'end_time',
    'start_timestamp',
    'end_timestamp',
    'venue',
    'description',
    'card_position',
    'display_order',
    'event_type',
    'is_published',
    'opens_submissions',
    'closes_submissions',
    'reminders_enabled',
    'reminder_offsets_minutes',
  ];

  const keys = Object.keys(data).filter((k) => allowedFields.includes(k));
  if (keys.length === 0) return null;

  const setClauses = keys.map((key, i) => `"${key}" = $${i + 2}`);
  setClauses.push('updated_at = NOW()');
  const values = keys.map((key) => (data as any)[key]);

  const { rows } = await query(
    `UPDATE public.timeline_events
     SET ${setClauses.join(', ')}
     WHERE id = $1
     RETURNING *`,
    [id, ...values]
  );

  return rows[0] || null;
}

/**
 * Publishes or unpublishes the timeline configuration.
 */
export async function setTimelinePublication(isPublished: boolean): Promise<any> {
  const { rows } = await query(
    `UPDATE public.timeline_config
     SET is_published = $1,
         published_at = CASE WHEN $1 = TRUE THEN NOW() ELSE published_at END,
         published_version = published_version + 1,
         updated_at = NOW()
     WHERE id = 1
     RETURNING *`,
    [isPublished]
  );
  return rows[0];
}
