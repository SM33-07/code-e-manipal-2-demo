import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { pool } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { logAudit } from '@/lib/auth/telemetry';
import { OFFICIAL_TRACKS } from '@/lib/event/eventConstants';

/**
 * PUT /api/admin/problem-statements/[id]
 * Updates an existing problem statement.
 */
export const PUT = withAuth(async (req: NextRequest, { user, params }) => {
  const statementId = params?.id;
  if (!statementId) {
    return Errors.BAD_REQUEST('Statement ID is required.');
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Errors.BAD_REQUEST('Invalid JSON payload.');
  }

  const {
    title,
    track,
    description,
    requirements,
    deliverables,
    constraints,
    attachment_url,
    attachment_name,
    is_published,
    display_order,
  } = body;

  if (track && !OFFICIAL_TRACKS.includes(track.trim())) {
    return Errors.BAD_REQUEST('Invalid track specified.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query(
      'SELECT id, title, track FROM public.problem_statements WHERE id = $1 FOR UPDATE',
      [statementId]
    );

    if (existing.length === 0) {
      await client.query('ROLLBACK');
      return Errors.NOT_FOUND('Problem statement not found.');
    }

    const { rows: updated } = await client.query(`
      UPDATE public.problem_statements
      SET
        title = COALESCE($1, title),
        track = COALESCE($2, track),
        description = COALESCE($3, description),
        requirements = CASE WHEN $4::text IS NOT NULL THEN $4::jsonb ELSE requirements END,
        deliverables = CASE WHEN $5::text IS NOT NULL THEN $5::jsonb ELSE deliverables END,
        constraints = COALESCE($6, constraints),
        attachment_url = COALESCE($7, attachment_url),
        attachment_name = COALESCE($8, attachment_name),
        is_published = COALESCE($9, is_published),
        display_order = COALESCE($10, display_order),
        updated_at = NOW()
      WHERE id = $11
      RETURNING *;
    `, [
      title?.trim() || null,
      track?.trim() || null,
      description?.trim() || null,
      requirements !== undefined ? JSON.stringify(requirements) : null,
      deliverables !== undefined ? JSON.stringify(deliverables) : null,
      constraints !== undefined ? (constraints?.trim() || null) : null,
      attachment_url !== undefined ? (attachment_url?.trim() || null) : null,
      attachment_name !== undefined ? (attachment_name?.trim() || null) : null,
      is_published !== undefined ? Boolean(is_published) : null,
      display_order !== undefined ? Number(display_order) : null,
      statementId,
    ]);

    await client.query('COMMIT');

    logAudit({
      userId: user.id,
      action: 'PROBLEM_STATEMENT_UPDATED',
      targetTable: 'problem_statements',
      targetId: statementId,
      details: { title: updated[0].title, track: updated[0].track },
    });

    return successResponse({ statement: updated[0] });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return Errors.INTERNAL('Failed to update problem statement: ' + err.message);
  } finally {
    client.release();
  }
}, 'admin');

/**
 * DELETE /api/admin/problem-statements/[id]
 * Deletes or archives a problem statement with confirmation.
 */
export const DELETE = withAuth(async (_req: NextRequest, { user, params }) => {
  const statementId = params?.id;
  if (!statementId) {
    return Errors.BAD_REQUEST('Statement ID is required.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if any team selected this problem
    const { rows: teamRef } = await client.query(
      'SELECT count(*)::int as count FROM public.teams WHERE selected_problem_id = $1',
      [statementId]
    );

    if (teamRef[0].count > 0) {
      await client.query('ROLLBACK');
      return Errors.CONFLICT(`Cannot delete: ${teamRef[0].count} team(s) have selected this problem statement.`);
    }

    const { rows: deleted } = await client.query(
      'DELETE FROM public.problem_statements WHERE id = $1 RETURNING id, title',
      [statementId]
    );

    if (deleted.length === 0) {
      await client.query('ROLLBACK');
      return Errors.NOT_FOUND('Problem statement not found.');
    }

    await client.query('COMMIT');

    logAudit({
      userId: user.id,
      action: 'PROBLEM_STATEMENT_DELETED',
      targetTable: 'problem_statements',
      targetId: statementId,
      details: { title: deleted[0].title },
    });

    return successResponse({ deleted: true, id: statementId });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return Errors.INTERNAL('Failed to delete problem statement: ' + err.message);
  } finally {
    client.release();
  }
}, 'admin');
