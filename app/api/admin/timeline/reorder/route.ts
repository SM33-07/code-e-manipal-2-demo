import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { pool } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { logAudit } from '@/lib/auth/telemetry';

/**
 * POST /api/admin/timeline/reorder
 * Reorders events in bulk using transactions.
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Errors.BAD_REQUEST('Invalid JSON payload.');
  }

  const { items } = body;
  if (!Array.isArray(items)) {
    return Errors.BAD_REQUEST('Expected an array of { id, display_order } items.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const item of items) {
      if (!item.id || item.display_order === undefined) continue;
      await client.query(`
        UPDATE public.timeline_events
        SET display_order = $1, updated_at = NOW()
        WHERE id = $2::uuid;
      `, [item.display_order, item.id]);
    }

    await client.query('COMMIT');

    logAudit({
      userId: user.id,
      action: 'TIMELINE_REORDERED',
      targetTable: 'timeline_events',
      targetId: 'multiple',
      details: { count: items.length },
    });

    return successResponse({ reordered: true, count: items.length });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return Errors.INTERNAL('Failed to reorder timeline events: ' + err.message);
  } finally {
    client.release();
  }
}, 'admin');
