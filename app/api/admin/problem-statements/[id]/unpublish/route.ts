import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withAuth } from '@/lib/middleware/withAuth';
import { pool } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { logAudit } from '@/lib/auth/telemetry';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/admin/problem-statements/[id]/unpublish
 * Unpublishes an individual problem statement, withdrawing it from participants.
 */
export const POST = withAuth(async (_req: NextRequest, { user, params }) => {
  const statementId = params?.id;
  if (!statementId) {
    return Errors.BAD_REQUEST('Statement ID is required.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: updated } = await client.query(`
      UPDATE public.problem_statements
      SET is_published = false, updated_at = NOW()
      WHERE id = $1
      RETURNING id, title;
    `, [statementId]);

    if (updated.length === 0) {
      await client.query('ROLLBACK');
      return Errors.NOT_FOUND('Problem statement not found.');
    }

    // Check if there are any remaining published statements
    const { rows: remaining } = await client.query(`
      SELECT count(*)::int as count FROM public.problem_statements WHERE is_published = true;
    `);

    if (remaining[0].count === 0) {
      await client.query(`
        UPDATE public.event_config
        SET problem_statements_published = false, updated_at = NOW()
        WHERE id = 1;
      `);
    }

    await client.query('COMMIT');

    try {
      revalidatePath('/problem-statements');
      revalidatePath('/api/problem-statements');
    } catch (e) {
      logger.warn('Failed to revalidate /problem-statements', { error: String(e) });
    }

    logAudit({
      userId: user.id,
      action: 'PROBLEM_STATEMENT_UNPUBLISHED',
      targetTable: 'problem_statements',
      targetId: statementId,
      details: { title: updated[0].title },
    });

    return successResponse({
      published: false,
      statementId,
      title: updated[0].title,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return Errors.INTERNAL('Failed to unpublish problem statement: ' + err.message);
  } finally {
    client.release();
  }
}, 'admin');
