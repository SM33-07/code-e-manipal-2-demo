import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { pool } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { getPublicEventConfig } from '@/lib/event/eventConfigHelper';
import { logAudit } from '@/lib/auth/telemetry';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/admin/event-config/problem-statements
 *
 * Releases challenge statements through their own audited, admin-only gate.
 * It intentionally does not transition the broader event state machine.
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  let body: { published?: unknown };
  try {
    body = await req.json();
  } catch {
    return Errors.BAD_REQUEST('Invalid request body.');
  }

  if (body.published !== true) {
    return Errors.BAD_REQUEST('Only an explicit publication action is supported.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT problem_statements_published FROM public.event_config WHERE id = 1 FOR UPDATE'
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return Errors.NOT_FOUND('Event configuration not found.');
    }

    const wasPublished = rows[0].problem_statements_published === true;
    if (!wasPublished) {
      await client.query(
        `UPDATE public.event_config
         SET problem_statements_published = TRUE, updated_at = NOW()
         WHERE id = 1`
      );
    }
    await client.query('COMMIT');

    if (!wasPublished) {
      logAudit({
        userId: user.id,
        action: 'PROBLEM_STATEMENTS_PUBLISHED',
        targetTable: 'event_config',
        targetId: '1',
        details: { previous_value: false, published: true },
      }).catch(() => {});
    }

    return successResponse({
      problem_statements_published: true,
      already_published: wasPublished,
      config: await getPublicEventConfig(),
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    logger.error('Problem-statement publication failed', { error: String(error) });
    return Errors.INTERNAL('Unable to publish problem statements.');
  } finally {
    client.release();
  }
}, 'admin');
