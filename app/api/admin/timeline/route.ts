import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { pool } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { logAudit } from '@/lib/auth/telemetry';

/**
 * GET /api/admin/timeline
 * Fetches all timeline events (draft and published) with timeline configuration.
 */
export const GET = withAuth(async (_req: NextRequest, { user }) => {
  const { rows: configRows } = await pool.query(`
    SELECT is_published, published_at, published_version, updated_at
    FROM public.timeline_config
    WHERE id = 1;
  `);

  const { rows: events } = await pool.query(`
    SELECT id, title, day_label, time_range, start_time, end_time,
           start_timestamp, end_timestamp, timezone, venue, description,
           display_order, card_position, status, event_type, is_published,
           opens_submissions, closes_submissions, reminders_enabled,
           reminder_offsets_minutes, created_at, updated_at
    FROM public.timeline_events
    ORDER BY display_order ASC;
  `);

  return successResponse({
    config: configRows[0] || { is_published: true, published_version: 1 },
    events,
  });
}, 'admin');

/**
 * POST /api/admin/timeline
 * Creates a new timeline event.
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Errors.BAD_REQUEST('Invalid JSON payload.');
  }

  const {
    title,
    day_label,
    time_range,
    start_time,
    end_time,
    venue,
    description,
    card_position = 'right',
    status = 'upcoming',
    event_type = 'general',
    display_order,
  } = body;

  if (!title || !day_label || !time_range) {
    return Errors.BAD_REQUEST('Title, day label (e.g. DAY 1), and time range are required.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Calculate display order if not specified
    let order = display_order;
    if (order === undefined || order === null) {
      const { rows: maxRows } = await client.query('SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM public.timeline_events');
      order = maxRows[0].next_order;
    }

    const { rows: newEvent } = await client.query(`
      INSERT INTO public.timeline_events (
        title, day_label, time_range, start_time, end_time, venue, description,
        card_position, display_order, status, event_type, is_published
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
      RETURNING *;
    `, [
      title.trim(),
      day_label.trim(),
      time_range.trim(),
      start_time?.trim() || null,
      end_time?.trim() || null,
      venue?.trim() || null,
      description?.trim() || null,
      card_position === 'left' ? 'left' : 'right',
      order,
      status || 'upcoming',
      event_type || 'general',
    ]);

    await client.query('COMMIT');

    logAudit({
      userId: user.id,
      action: 'TIMELINE_EVENT_CREATED',
      targetTable: 'timeline_events',
      targetId: newEvent[0].id,
      details: { title, day_label, time_range },
    });

    return successResponse({ event: newEvent[0] }, undefined, 201);
  } catch (err: any) {
    await client.query('ROLLBACK');
    return Errors.INTERNAL('Failed to create timeline event: ' + err.message);
  } finally {
    client.release();
  }
}, 'admin');
