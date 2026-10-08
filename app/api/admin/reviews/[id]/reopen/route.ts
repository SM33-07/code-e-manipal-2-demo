import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, Errors } from '@/lib/utils/response';
import { isValidUUID, sanitizeScore } from '@/lib/utils/validate';
import { logger } from '@/lib/utils/logger';
import {
  reopenReviewTransactional,
  ConcurrencyError,
  PhaseFrozenError,
  NotFoundReviewError,
} from '@/lib/judging/history';

/**
 * POST /api/admin/reviews/:id/reopen
 * Admin-only: dedicated score correction & reopen endpoint.
 *
 * Requirements:
 * - Requires mandatory reason (minimum 5 chars)
 * - Atomic phase verification: strictly permitted during JUDGING phase only
 * - Enforces optimistic concurrency (expected_version)
 * - Archives previous review state into review_history (ADR-005)
 * - Reopens review (is_complete = false)
 * - Appends audit log entry
 */
export const POST = withAuth(async (req, { user, params }) => {
  try {
    const id = params?.id;
    if (!id || !isValidUUID(id)) {
      return Errors.BAD_REQUEST('Invalid review ID');
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return Errors.BAD_REQUEST('Invalid JSON request body');
    }

    const {
      reason,
      expected_version,
      score_innovation,
      score_technical,
      score_presentation,
      score_impact,
      feedback,
    } = body;

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return Errors.BAD_REQUEST('A valid reason (minimum 5 characters) is required to reopen a review');
    }

    // Optional score corrections
    const scoreFields: Record<string, unknown> = {
      score_innovation,
      score_technical,
      score_presentation,
      score_impact,
    };

    const sanitizedScores: Record<string, number | undefined> = {};
    let hasScores = false;

    for (const [key, val] of Object.entries(scoreFields)) {
      if (val === undefined || val === null) continue;
      const sanitized = sanitizeScore(val);
      if (sanitized === undefined) {
        return Errors.BAD_REQUEST(`${key} must be an integer between 1 and 10`);
      }
      sanitizedScores[key] = sanitized;
      hasScores = true;
    }

    const updated = await reopenReviewTransactional({
      id,
      admin_id: user.id,
      reason: reason.trim(),
      expected_version: typeof expected_version === 'number' ? expected_version : undefined,
      scores: hasScores ? sanitizedScores : undefined,
      feedback: typeof feedback === 'string' ? feedback.trim() : undefined,
    });

    logger.info('POST /api/admin/reviews/[id]/reopen', {
      reviewId: id,
      adminId: user.id,
      version: updated.version,
    });

    return successResponse(updated);
  } catch (err: any) {
    if (err instanceof ConcurrencyError || err.statusCode === 409) {
      return Errors.CONFLICT(err.message);
    }
    if (err instanceof PhaseFrozenError || err.statusCode === 403) {
      return Errors.FORBIDDEN(err.message);
    }
    if (err instanceof NotFoundReviewError || err.statusCode === 404) {
      return Errors.NOT_FOUND('Review');
    }
    if (err.statusCode === 400) {
      return Errors.BAD_REQUEST(err.message);
    }

    logger.error('POST /api/admin/reviews/[id]/reopen', {
      error: err instanceof Error ? err.message : String(err),
    });
    return Errors.INTERNAL();
  }
}, 'admin');
