import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withAuth } from '@/lib/middleware/withAuth';
import { pool } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { logAudit } from '@/lib/auth/telemetry';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/admin/problem-statements/[id]/publish
 * Publishes an individual problem statement, making it visible to participants.
 */
export const POST = withAuth(async (_req: NextRequest, { user, params }) => {
  const statementId = params?.id;
  if (!statementId) {
    return Errors.BAD_REQUEST('Statement ID is required.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Mark statement as published
    const { rows: updated } = await client.query(`
      UPDATE public.problem_statements
      SET is_published = true, updated_at = NOW()
      WHERE id = $1
      RETURNING id, title, track;
    `, [statementId]);

    if (updated.length === 0) {
      await client.query('ROLLBACK');
      return Errors.NOT_FOUND('Problem statement not found.');
    }

    // 2. Ensure global problem_statements_published flag is true
    await client.query(`
      UPDATE public.event_config
      SET problem_statements_published = true, updated_at = NOW()
      WHERE id = 1;
    `);

    await client.query('COMMIT');

    try {
      revalidatePath('/problem-statements');
      revalidatePath('/api/problem-statements');
    } catch (e) {
      logger.warn('Failed to revalidate /problem-statements', { error: String(e) });
    }

    logAudit({
      userId: user.id,
      action: 'PROBLEM_STATEMENT_PUBLISHED',
      targetTable: 'problem_statements',
      targetId: statementId,
      details: { title: updated[0].title, track: updated[0].track },
    });

    return successResponse({
      published: true,
      statementId,
      title: updated[0].title,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return Errors.INTERNAL('Failed to publish problem statement: ' + err.message);
  } finally {
    client.release();
  }
}, 'admin');
