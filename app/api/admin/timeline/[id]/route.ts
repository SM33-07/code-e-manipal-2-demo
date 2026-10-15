import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { pool } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { logAudit } from '@/lib/auth/telemetry';

/**
 * PUT /api/admin/timeline/[id]
 * Updates an existing timeline event.
 */
export const PUT = withAuth(async (req: NextRequest, { user, params }) => {
  const eventId = params?.id;
  if (!eventId) {
    return Errors.BAD_REQUEST('Event ID is required.');
  }

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
    start_timestamp,
    end_timestamp,
    venue,
    description,
    card_position,
    status,
    event_type,
    display_order,
    is_published,
    opens_submissions,
    closes_submissions,
    reminders_enabled,
    reminder_offsets_minutes,
  } = body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query(
      'SELECT id, title FROM public.timeline_events WHERE id = $1::uuid FOR UPDATE',
      [eventId]
    );

    if (existing.length === 0) {
      await client.query('ROLLBACK');
      return Errors.NOT_FOUND('Timeline event not found.');
    }

    const { rows: updated } = await client.query(`
      UPDATE public.timeline_events
      SET
        title = COALESCE($1, title),
        day_label = COALESCE($2, day_label),
        time_range = COALESCE($3, time_range),
        start_time = COALESCE($4, start_time),
        end_time = COALESCE($5, end_time),
        venue = $6,
        description = $7,
        card_position = COALESCE($8, card_position),
        status = COALESCE($9, status),
        event_type = COALESCE($10, event_type),
        display_order = COALESCE($11, display_order),
        is_published = COALESCE($12, is_published),
        start_timestamp = COALESCE($13, start_timestamp),
        end_timestamp = COALESCE($14, end_timestamp),
        opens_submissions = COALESCE($15, opens_submissions),
        closes_submissions = COALESCE($16, closes_submissions),
        reminders_enabled = COALESCE($17, reminders_enabled),
        reminder_offsets_minutes = COALESCE($18, reminder_offsets_minutes),
        updated_at = NOW()
      WHERE id = $19::uuid
      RETURNING *;
    `, [
      title?.trim() || null,
      day_label?.trim() || null,
      time_range?.trim() || null,
      start_time?.trim() || null,
      end_time?.trim() || null,
      venue !== undefined ? (venue?.trim() || null) : null,
      description !== undefined ? (description?.trim() || null) : null,
      card_position || null,
      status || null,
      event_type || null,
      display_order !== undefined ? display_order : null,
      is_published !== undefined ? is_published : null,
      start_timestamp ? new Date(start_timestamp) : null,
      end_timestamp ? new Date(end_timestamp) : null,
      opens_submissions !== undefined ? opens_submissions : null,
      closes_submissions !== undefined ? closes_submissions : null,
      reminders_enabled !== undefined ? reminders_enabled : null,
      reminder_offsets_minutes !== undefined ? reminder_offsets_minutes : null,
      eventId,
    ]);

    await client.query('COMMIT');

    logAudit({
      userId: user.id,
      action: 'TIMELINE_EVENT_UPDATED',
      targetTable: 'timeline_events',
      targetId: eventId,
      details: { title: updated[0].title, day_label: updated[0].day_label },
    });

    return successResponse({ event: updated[0] });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return Errors.INTERNAL('Failed to update timeline event: ' + err.message);
  } finally {
    client.release();
  }
}, 'admin');

/**
 * DELETE /api/admin/timeline/[id]
 * Deletes a timeline event with confirmation.
 */
export const DELETE = withAuth(async (_req: NextRequest, { user, params }) => {
  const eventId = params?.id;
  if (!eventId) {
    return Errors.BAD_REQUEST('Event ID is required.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: deleted } = await client.query(
      'DELETE FROM public.timeline_events WHERE id = $1::uuid RETURNING id, title',
      [eventId]
    );

    if (deleted.length === 0) {
      await client.query('ROLLBACK');
      return Errors.NOT_FOUND('Timeline event not found.');
    }

    await client.query('COMMIT');

    logAudit({
      userId: user.id,
      action: 'TIMELINE_EVENT_DELETED',
      targetTable: 'timeline_events',
      targetId: eventId,
      details: { title: deleted[0].title },
    });

    return successResponse({ deleted: true, id: eventId });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return Errors.INTERNAL('Failed to delete timeline event: ' + err.message);
  } finally {
    client.release();
  }
}, 'admin');
