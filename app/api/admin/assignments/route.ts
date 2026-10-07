import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { query } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import {
  assignJudge,
  removeJudgeAssignment,
  autoAssignAllJudges,
} from '@/services/judgingService';
import { isValidUUID } from '@/lib/utils/validate';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/admin/assignments
 * Admin — list all judge assignments with submission + judge details.
 */
export const GET = withAuth(async (req) => {
  try {
    const judgeId = req.nextUrl.searchParams.get('judge_id');

    let sql = `
      SELECT 
        ja.*,
        json_build_object(
          'id', s.id,
          'title', s.title,
          'category', s.category,
          'status', s.status
        ) AS submissions,
        json_build_object(
          'id', p.id,
          'name', p.name,
          'email', p.email,
          'avatar_url', p.avatar_url
        ) AS profiles,
        (
          SELECT json_build_object(
            'id', jr.id,
            'is_complete', jr.is_complete,
            'score_innovation', jr.score_innovation,
            'score_technical', jr.score_technical,
            'score_presentation', jr.score_presentation,
            'score_impact', jr.score_impact,
            'version', jr.version,
            'feedback', jr.feedback
          )
          FROM public.judge_reviews jr
          WHERE jr.judge_id = ja.judge_id AND jr.submission_id = ja.submission_id
          LIMIT 1
        ) AS review
      FROM public.judge_assignments ja
      JOIN public.submissions s ON s.id = ja.submission_id
      JOIN public.profiles p ON p.id = ja.judge_id
    `;
    const params: any[] = [];
    if (judgeId) {
      if (!isValidUUID(judgeId)) return Errors.BAD_REQUEST('Invalid judge_id');
      sql += ' WHERE ja.judge_id = $1';
      params.push(judgeId);
    }
    sql += ' ORDER BY ja.assigned_at DESC';

    const { rows } = await query(sql, params);
    return successResponse(rows ?? []);
  } catch (err) {
    logger.error('GET /api/admin/assignments', { error: String(err) });
    return Errors.INTERNAL();
  }
}, 'admin');

/**
 * POST /api/admin/assignments
 * Admin — manually assign a judge to a submission,
 *         OR trigger auto-assign of all judges to all submitted submissions.
 *
 * Body (manual):    { action: 'assign',    judge_id, submission_id }
 * Body (unassign):  { action: 'unassign',  judge_id, submission_id }
 * Body (auto):      { action: 'auto_assign' }
 */
export const POST = withAuth(async (req) => {
  try {
    const body = await req.json();
    const action = body.action as string;

    // ── Auto assign ───────────────────────────────────────────
    if (action === 'auto_assign' || body.auto) {
      const count = await autoAssignAllJudges();

      logger.info('POST /api/admin/assignments (auto_assign)', { assigned: count });
      return successResponse({ action: 'auto_assign', assigned: count });
    }

    // ── Manual assign / unassign ──────────────────────────────
    const { judge_id, submission_id } = body;

    if (!judge_id || !isValidUUID(judge_id)) {
      return Errors.BAD_REQUEST('A valid judge_id is required');
    }
    if (!submission_id || !isValidUUID(submission_id)) {
      return Errors.BAD_REQUEST('A valid submission_id is required');
    }

    // Verify the user is actually a judge (or admin)
    const profileRes = await query(
      'SELECT role, name FROM public.profiles WHERE id = $1',
      [judge_id]
    );
    const profile = profileRes.rows[0];

    if (!profile) return Errors.NOT_FOUND('Judge');

    if (profile.role === 'participant') {
      return Errors.BAD_REQUEST(`User "${profile.name}" is not a judge or admin`);
    }

    if (action === 'unassign') {
      await removeJudgeAssignment(judge_id, submission_id);
      logger.info('POST /api/admin/assignments (unassign)', { judge_id, submission_id });
      return successResponse({ action: 'unassign', judge_id, submission_id });
    }

    // Default: assign
    await assignJudge(judge_id, submission_id);

    logger.info('POST /api/admin/assignments (assign)', { judge_id, submission_id });
    return successResponse({ action: 'assign', judge_id, submission_id }, undefined, 201);

  } catch (err) {
    logger.error('POST /api/admin/assignments', { error: String(err) });
    return Errors.INTERNAL();
  }
}, 'admin');