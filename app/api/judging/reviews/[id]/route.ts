import { withAuth } from '@/lib/middleware/withAuth';
import { query } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { sanitizeScore, isValidUUID } from '@/lib/utils/validate';
import { logger } from '@/lib/utils/logger';
import {
  updateReviewByIdTransactional,
  calculateTotalScore,
  ConcurrencyError,
  PhaseFrozenError,
  ReviewLockedError,
  ForbiddenReviewError,
  NotFoundReviewError,
} from '@/lib/judging/history';

/**
 * GET /api/judging/reviews/:id
 * Judge/Admin — fetch a single review.
 * Judges can only view their own reviews prior to results release.
 */
export const GET = withAuth(async (_req, { user, profile, params }) => {
  try {
    const id = params?.id;
    if (!id || !isValidUUID(id)) return Errors.BAD_REQUEST('Invalid review ID');

    const res = await query('SELECT * FROM public.judge_reviews WHERE id = $1 LIMIT 1', [id]);
    if (res.rows.length === 0) return Errors.NOT_FOUND('Review');

    const review = res.rows[0];

    // Privacy isolation guard: judge cannot view peer reviews
    if (profile?.role !== 'admin' && review.judge_id !== user.id) {
      return Errors.FORBIDDEN("Cannot view another judge's review prior to results release");
    }

    return successResponse({
      ...review,
      total_score: calculateTotalScore(review),
    });
  } catch (err) {
    logger.error('GET /api/judging/reviews/[id]', { error: String(err) });
    return Errors.INTERNAL();
  }
}, 'judge');

/**
 * PUT /api/judging/reviews/:id
 * Judge — update scores / feedback on an existing review.
 *
 * Rules:
 * - Admins cannot use this generic update path; must use /api/admin/reviews/[id]/reopen
 * - The owning judge may revise a completed review during JUDGING
 * - Review writes are frozen outside JUDGING
 * - Optimistic concurrency via expected_version returns 409 Conflict on mismatch
 * - Atomic phase lock prevents updates outside of JUDGING phase
 * - Archives previous review state into review_history
 * - Server calculates total score from criteria weights
 */
export const PUT = withAuth(async (req, { user, profile, params }) => {
  try {
    const id = params?.id;
    if (!id || !isValidUUID(id)) return Errors.BAD_REQUEST('Invalid review ID');

    // Single Administrative Path enforcement (ADR-005)
    if (profile?.role === 'admin') {
      return Errors.FORBIDDEN(
        'Admins cannot modify reviews through the generic update endpoint. Use /api/admin/reviews/[id]/reopen.'
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return Errors.BAD_REQUEST('Invalid JSON request body');
    }

    const {
      score_innovation,
      score_technical,
      score_presentation,
      score_impact,
      feedback,
      is_complete,
      expected_version,
      reason,
    } = body;

    if (
      typeof expected_version !== 'number' ||
      !Number.isSafeInteger(expected_version) ||
      expected_version < 0
    ) {
      return Errors.BAD_REQUEST('A valid expected_version is required');
    }

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

    const updated = await updateReviewByIdTransactional({
      id,
      actor_id: user.id,
      actor_role: profile?.role || 'judge',
      scores: sanitizedScores,
      feedback: typeof feedback === 'string' ? feedback.trim() : undefined,
      is_complete: is_complete !== undefined ? Boolean(is_complete) : undefined,
      expected_version,
      reason: typeof reason === 'string' ? reason.trim() : undefined,
    });

    logger.info('PUT /api/judging/reviews/[id]', {
      reviewId: id,
      judgeId: user.id,
      version: updated.version,
    });

    return successResponse(updated);
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

    logger.error('PUT /api/judging/reviews/[id]', { error: String(err) });
    return Errors.INTERNAL();
  }
}, 'judge');
