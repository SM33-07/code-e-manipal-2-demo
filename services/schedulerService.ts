/**
 * Durable Canonical Event Scheduler & Announcement Service (Phase 2 Requirement E)
 * File: services/schedulerService.ts
 *
 * Implements:
 * - PostgreSQL advisory lock (pg_try_advisory_lock) to prevent concurrent execution.
 * - Server-authoritative time evaluation for event start/end and deadline reminders.
 * - Unique idempotency keys per transition/offset to guarantee exact-once delivery.
 * - Stale recovery threshold (default 2 hours) to avoid alert floods after outages.
 * - Draft schedule isolation: draft/unpublished events never generate announcements.
 * - Separation of announcement creation from per-user receipt delivery.
 */

import { pool, query } from '@/lib/db';
import { logger } from '@/lib/utils/logger';

export const SCHEDULER_LOCK_ID = 742189;
export const STALE_NOTIFICATION_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface SchedulerTickResult {
  executed: boolean;
  serverTime: string;
  processedEventsCount: number;
  newAnnouncementsCount: number;
  newAnnouncementKeys: string[];
  skippedStaleCount: number;
  message?: string;
}

/**
 * Runs one authoritative scheduler tick.
 * Protected by pg_try_advisory_lock so concurrent cron jobs or serverless workers
 * will safely skip execution without collision.
 */
export async function runSchedulerTick(options?: {
  forceStalePublish?: boolean;
}): Promise<SchedulerTickResult> {
  const client = await pool.connect();

  try {
    // 1. Acquire advisory lock
    const { rows: lockRows } = await client.query(
      'SELECT pg_try_advisory_lock($1) AS lock_acquired',
      [SCHEDULER_LOCK_ID]
    );

    const lockAcquired = Boolean(lockRows[0]?.lock_acquired);
    if (!lockAcquired) {
      logger.info('Scheduler tick skipped: advisory lock held by another worker');
      return {
        executed: false,
        serverTime: new Date().toISOString(),
        processedEventsCount: 0,
        newAnnouncementsCount: 0,
        newAnnouncementKeys: [],
        skippedStaleCount: 0,
        message: 'Lock held by active scheduler worker',
      };
    }

    // 2. Fetch authoritative database server time
    const { rows: timeRows } = await client.query('SELECT NOW() AS server_now');
    const serverNow = new Date(timeRows[0].server_now);
    const serverNowMs = serverNow.getTime();

    // 3. Query all published events with canonical timestamps
    const { rows: events } = await client.query(`
      SELECT id, title, venue, start_timestamp, end_timestamp,
             opens_submissions, closes_submissions, reminders_enabled,
             reminder_offsets_minutes, is_published
      FROM public.timeline_events
      WHERE is_published = TRUE AND start_timestamp IS NOT NULL
      ORDER BY display_order ASC
    `);

    let newAnnouncementsCount = 0;
    const newAnnouncementKeys: string[] = [];
    let skippedStaleCount = 0;

    for (const event of events) {
      const startMs = new Date(event.start_timestamp).getTime();
      const endMs = event.end_timestamp ? new Date(event.end_timestamp).getTime() : null;

      // ── A. Event Start Announcement ──
      if (serverNowMs >= startMs) {
        const idempotencyKey = `timeline_${event.id}_start`;
        const timeSinceStart = serverNowMs - startMs;

        if (timeSinceStart <= STALE_NOTIFICATION_THRESHOLD_MS || options?.forceStalePublish) {
          const content = `Event Started: "${event.title}" is now underway at ${event.venue || 'Vasanti Pai'}.`;
          const created = await insertAnnouncementIfMissing(client, {
            content,
            type: 'info',
            idempotencyKey,
            eventId: event.id,
          });
          if (created) {
            newAnnouncementsCount++;
            newAnnouncementKeys.push(idempotencyKey);
          }
        } else {
          skippedStaleCount++;
        }
      }

      // ── B. Submission Opening Announcement ──
      if (event.opens_submissions && serverNowMs >= startMs) {
        const idempotencyKey = `sub_open_${event.id}`;
        const timeSinceStart = serverNowMs - startMs;

        if (timeSinceStart <= STALE_NOTIFICATION_THRESHOLD_MS || options?.forceStalePublish) {
          const content = `Submissions Open: Submissions are now officially open for ${event.title}!`;
          const created = await insertAnnouncementIfMissing(client, {
            content,
            type: 'urgent',
            idempotencyKey,
            eventId: event.id,
            linkUrl: '/submit',
          });
          if (created) {
            newAnnouncementsCount++;
            newAnnouncementKeys.push(idempotencyKey);
          }
        } else {
          skippedStaleCount++;
        }
      }

      // ── C. Configurable Deadline Reminders ──
      if (
        event.reminders_enabled &&
        endMs &&
        Array.isArray(event.reminder_offsets_minutes)
      ) {
        for (const offset of event.reminder_offsets_minutes) {
          const reminderTargetMs = endMs - offset * 60 * 1000;

          if (serverNowMs >= reminderTargetMs && serverNowMs < endMs) {
            const idempotencyKey = `reminder_${event.id}_${offset}m`;
            const timeSinceTrigger = serverNowMs - reminderTargetMs;

            if (timeSinceTrigger <= STALE_NOTIFICATION_THRESHOLD_MS || options?.forceStalePublish) {
              const content = `Deadline Reminder: ${offset} minutes remaining before ${event.title} deadline!`;
              const type = offset <= 15 ? 'urgent' : 'warning';
              const created = await insertAnnouncementIfMissing(client, {
                content,
                type,
                idempotencyKey,
                eventId: event.id,
                linkUrl: '/submit',
              });
              if (created) {
                newAnnouncementsCount++;
                newAnnouncementKeys.push(idempotencyKey);
              }
            } else {
              skippedStaleCount++;
            }
          }
        }
      }

      // ── D. Event Concluded / Submissions Closed Announcement ──
      if (endMs && serverNowMs >= endMs) {
        const idempotencyKey = `timeline_${event.id}_end`;
        const timeSinceEnd = serverNowMs - endMs;

        if (timeSinceEnd <= STALE_NOTIFICATION_THRESHOLD_MS || options?.forceStalePublish) {
          const content = event.closes_submissions
            ? `Submissions Closed: The deadline for ${event.title} has passed. Submissions are now closed.`
            : `Event Concluded: "${event.title}" has ended.`;
          const type = event.closes_submissions ? 'urgent' : 'info';
          const created = await insertAnnouncementIfMissing(client, {
            content,
            type,
            idempotencyKey,
            eventId: event.id,
          });
          if (created) {
            newAnnouncementsCount++;
            newAnnouncementKeys.push(idempotencyKey);
          }
        } else {
          skippedStaleCount++;
        }
      }
    }

    // 4. Update last_scheduler_tick in event_config
    await client.query(`
      UPDATE public.event_config
      SET last_scheduler_tick = NOW(), updated_at = NOW()
      WHERE id = 1
    `);

    logger.info('Scheduler tick completed successfully', {
      serverTime: serverNow.toISOString(),
      processedEvents: events.length,
      newAnnouncements: newAnnouncementsCount,
      skippedStale: skippedStaleCount,
    });

    return {
      executed: true,
      serverTime: serverNow.toISOString(),
      processedEventsCount: events.length,
      newAnnouncementsCount,
      newAnnouncementKeys,
      skippedStaleCount,
    };
  } finally {
    // 5. Always release advisory lock
    await client.query('SELECT pg_advisory_unlock($1)', [SCHEDULER_LOCK_ID]).catch((err) => {
      logger.error('Failed to release scheduler advisory lock', { error: String(err) });
    });
    client.release();
  }
}

/**
 * Idempotently inserts an announcement.
 * Returns true if a new record was created, false if skipped due to idempotency constraint.
 */
async function insertAnnouncementIfMissing(
  client: any,
  params: {
    content: string;
    type: 'info' | 'warning' | 'urgent' | 'success';
    idempotencyKey: string;
    eventId?: string;
    linkUrl?: string;
  }
): Promise<boolean> {
  const { rows } = await client.query(
    `INSERT INTO public.announcements (
       id, content, type, is_active, idempotency_key, event_id, link_url, created_at
     ) VALUES (
       gen_random_uuid(), $1, $2, TRUE, $3, $4, $5, NOW()
     )
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    [
      params.content,
      params.type,
      params.idempotencyKey,
      params.eventId || null,
      params.linkUrl || null,
    ]
  );

  return rows.length > 0;
}
