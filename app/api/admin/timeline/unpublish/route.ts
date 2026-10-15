import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withAuth } from '@/lib/middleware/withAuth';
import { pool } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { logAudit } from '@/lib/auth/telemetry';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/admin/timeline/unpublish
 * Unpublishes the timeline from public view.
 */
export const POST = withAuth(async (_req: NextRequest, { user }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: configRows } = await client.query(`
      UPDATE public.timeline_config
      SET
        is_published = false,
        updated_at = NOW()
      WHERE id = 1
      RETURNING *;
    `);

    await client.query('COMMIT');

    try {
      revalidatePath('/timeline');
      revalidatePath('/api/timeline');
    } catch (e) {
      logger.warn('Failed to revalidate /timeline cache', { error: String(e) });
    }

    logAudit({
      userId: user.id,
      action: 'TIMELINE_UNPUBLISHED',
      targetTable: 'timeline_config',
      targetId: '1',
      details: { unpublished_at: new Date().toISOString() },
    });

    return successResponse({
      published: false,
      message: 'Timeline has been unpublished from public view.',
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return Errors.INTERNAL('Failed to unpublish timeline: ' + err.message);
  } finally {
    client.release();
  }
}, 'admin');
