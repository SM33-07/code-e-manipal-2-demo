import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { query } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { sanitizeScore, isValidUUID } from '@/lib/utils/validate';
import { logger } from '@/lib/utils/logger';
import {
  saveReviewTransactional,
  calculateTotalScore,
  ConcurrencyError,
  PhaseFrozenError,
  ReviewLockedError,
  ForbiddenReviewError,
  NotFoundReviewError,
} from '@/lib/judging/history';

/**
 * POST /api/judging/reviews
 * Judge/Admin — creates or updates a review for a submission.
 *
 * Requirements:
 * - Atomic Phase verification (JUDGING phase only)
 * - Assignment check (requireJudgeAssignment)
 * - Optimistic concurrency lock via expected_version
 * - Completed reviews remain editable by their assigned judge during JUDGING
 * - The event phase lock freezes all reviews outside JUDGING
 * - Archiving previous state to review_history
 * - Server-side score calculation (client totals ignored)
 */
export const POST = withAuth(async (req, { user, profile }) => {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return Errors.BAD_REQUEST('Invalid JSON request body');
    }

    const {
      submission_id,
      score_innovation,
      score_technical,
      score_presentation,
      score_impact,
      feedback,
      is_complete,
      expected_version,
      reason,
    } = body;

    // Validate submission_id
    if (!submission_id || !isValidUUID(submission_id)) {
      return Errors.BAD_REQUEST('A valid submission_id is required');
    }

    if (
      typeof expected_version !== 'number' ||
      !Number.isSafeInteger(expected_version) ||
      expected_version < 0
    ) {
      return Errors.BAD_REQUEST('A valid expected_version is required');
    }

    // Validate scores if provided
    const scoreFields: Record<string, unknown> = {
      score_innovation,
      score_technical,
      score_presentation,
      score_impact,
    };

    const sanitizedScores: Record<string, number | undefined> = {};
    for (const [key, val] of Object.entries(scoreFields)) {
      if (val === undefined || val === null) continue;
      const sanitized = sanitizeScore(val);
      if (sanitized === undefined) {
        return Errors.BAD_REQUEST(`${key} must be an integer between 1 and 10`);
      }
      sanitizedScores[key] = sanitized;
    }

    const review = await saveReviewTransactional({
      submission_id,
      judge_id: user.id,
      actor_id: user.id,
      actor_role: profile?.role || 'judge',
      scores: sanitizedScores,
      feedback: typeof feedback === 'string' ? feedback.trim() : undefined,
      is_complete: is_complete !== undefined ? Boolean(is_complete) : undefined,
      expected_version,
      reason: typeof reason === 'string' ? reason.trim() : undefined,
    });

    logger.info('POST /api/judging/reviews', {
      reviewId: review.id,
      submissionId: submission_id,
      judgeId: user.id,
      version: review.version,
      is_complete: review.is_complete,
    });

    return successResponse(review, undefined, 201);
  } catch (err: any) {
    if (err instanceof ConcurrencyError || err.statusCode === 409) {
      return Errors.CONFLICT(err.message);
    }
    if (
      err instanceof PhaseFrozenError ||
      err instanceof ReviewLockedError ||
      err instanceof ForbiddenReviewError ||
      err.statusCode === 403
    ) {
      return Errors.FORBIDDEN(err.message);
    }
    if (err instanceof NotFoundReviewError || err.statusCode === 404) {
      return Errors.NOT_FOUND('Review');
    }
    if (err.statusCode === 400) {
      return Errors.BAD_REQUEST(err.message);
    }

    logger.error('POST /api/judging/reviews', {
      error: err instanceof Error ? err.message : JSON.stringify(err),
    });
    return Errors.INTERNAL();
  }
}, 'judge');

/**
 * GET /api/judging/reviews
 * Judge/Admin — returns reviews.
 * - Judges can strictly view only their own reviews (preventing preview of peer scores).
 * - Admins can view all reviews or filter by submission/judge.
 */
export const GET = withAuth(async (req, { user, profile }) => {
  try {
    const { searchParams } = new URL(req.url);
    const submissionId = searchParams.get('submission_id');
    const requestedJudgeId = searchParams.get('judge_id');

    let sql = 'SELECT * FROM public.judge_reviews WHERE 1=1';
    const params: any[] = [];

    if (profile?.role === 'admin') {
      if (requestedJudgeId && isValidUUID(requestedJudgeId)) {
        params.push(requestedJudgeId);
        sql += ` AND judge_id = $${params.length}`;
      }
    } else {
      // Non-admin judges are strictly limited to their own evaluations
      if (requestedJudgeId && requestedJudgeId !== user.id) {
        return Errors.FORBIDDEN("Cannot view another judge's reviews prior to results release");
      }
      params.push(user.id);
      sql += ` AND judge_id = $${params.length}`;
    }

    if (submissionId && isValidUUID(submissionId)) {
      params.push(submissionId);
      sql += ` AND submission_id = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC';

    const res = await query(sql, params);

    const mapped = res.rows.map((row: any) => ({
      id: row.id,
      submission_id: row.submission_id,
      submissionId: row.submission_id,
      judge_id: row.judge_id,
      judgeId: row.judge_id,
      score_innovation: row.score_innovation,
      score_technical: row.score_technical,
      score_presentation: row.score_presentation,
      score_impact: row.score_impact,
      total_score: calculateTotalScore(row),
      criteria: {
        innovation: row.score_innovation,
        technical: row.score_technical,
        presentation: row.score_presentation,
        impact: row.score_impact,
      },
      feedback: row.feedback || '',
      is_complete: row.is_complete,
      isComplete: row.is_complete,
      version: row.version,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return successResponse(mapped);
  } catch (err) {
    logger.error('GET /api/judging/reviews', { error: String(err) });
    return Errors.INTERNAL();
  }
}, 'judge');
