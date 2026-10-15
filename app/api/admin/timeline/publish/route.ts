import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withAuth } from '@/lib/middleware/withAuth';
import { pool } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { logAudit } from '@/lib/auth/telemetry';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/admin/timeline/publish
 * Publishes the approved timeline, making it live without redeployment.
 */
export const POST = withAuth(async (_req: NextRequest, { user }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update config
    const { rows: configRows } = await client.query(`
      UPDATE public.timeline_config
      SET
        is_published = true,
        published_at = NOW(),
        published_version = published_version + 1,
        updated_at = NOW()
      WHERE id = 1
      RETURNING *;
    `);

    // 2. Mark events as published
    await client.query(`
      UPDATE public.timeline_events
      SET is_published = true, updated_at = NOW();
    `);

    await client.query('COMMIT');

    // 3. Cache revalidation
    try {
      revalidatePath('/timeline');
      revalidatePath('/api/timeline');
    } catch (e) {
      logger.warn('Failed to revalidate /timeline cache', { error: String(e) });
    }

    logAudit({
      userId: user.id,
      action: 'TIMELINE_PUBLISHED',
      targetTable: 'timeline_config',
      targetId: '1',
      details: {
        published_version: configRows[0]?.published_version,
        published_at: configRows[0]?.published_at,
      },
    });

    return successResponse({
      published: true,
      publishedAt: configRows[0]?.published_at,
      version: configRows[0]?.published_version,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return Errors.INTERNAL('Failed to publish timeline: ' + err.message);
  } finally {
    client.release();
  }
}, 'admin');
