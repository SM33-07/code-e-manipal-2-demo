import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { query } from '@/lib/db';
import { successResponse, Errors } from '@/lib/utils/response';
import { upsertReview } from '@/services/judgingService';
import { sanitizeScore, isValidUUID } from '@/lib/utils/validate';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/judging/reviews
 * Judge/Admin — creates or updates (upserts) a review for a submission.
 *
 * The judge must be assigned to the submission.
 * Scores are optional per-save — judges can save partial drafts.
 * Setting is_complete: true finalises the review.
 *
 * Body:
 * {
 *   submission_id: string        (required)
 *   score_innovation?:    1–10
 *   score_technical?:     1–10
 *   score_presentation?:  1–10
 *   score_impact?:        1–10
 *   feedback?:            string
 *   is_complete?:         boolean
 * }
 */
export const POST = withAuth(async (req, { user, profile }) => {
  try {
    const body = await req.json();

    const {
      submission_id,
      score_innovation,
      score_technical,
      score_presentation,
      score_impact,
      feedback,
      is_complete,
    } = body;

    // Validate submission_id
    if (!submission_id || !isValidUUID(submission_id)) {
      return Errors.BAD_REQUEST('A valid submission_id is required');
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

    // Admins skip the assignment check
    if (profile?.role !== 'admin') {
      const assignmentRes = await query(
        'SELECT 1 FROM public.judge_assignments WHERE judge_id = $1 AND submission_id = $2 LIMIT 1',
        [user.id, submission_id]
      );

      if (assignmentRes.rows.length === 0) {
        return Errors.FORBIDDEN();
      }
    }

    // Check if score is already complete / locked
    const existingRes = await query(
      'SELECT is_complete FROM public.judge_reviews WHERE submission_id = $1 AND judge_id = $2 LIMIT 1',
      [submission_id, user.id]
    );
    if (existingRes.rows.length > 0 && existingRes.rows[0].is_complete) {
      return Errors.FORBIDDEN();
    }

    // Upsert the review
    const review = await upsertReview({
      submission_id,
      judge_id: user.id,
      ...sanitizedScores,
      feedback:    typeof feedback === 'string' ? feedback.trim() : undefined,
      is_complete: Boolean(is_complete),
    });

    // Sync submission status
    const newStatus = is_complete ? 'reviewed' : 'under_review';
    await query(
      'UPDATE public.submissions SET status = $1 WHERE id = $2',
      [newStatus, submission_id]
    );

    logger.info('POST /api/judging/reviews', {
      reviewId:     review.id,
      submissionId: submission_id,
      judgeId:      user.id,
      is_complete,
    });

    return successResponse(review, undefined, 201);
  } catch (err) {
    logger.error('POST /api/judging/reviews', { error: err instanceof Error ? err.message : JSON.stringify(err) });
    return Errors.INTERNAL();
  }
}, 'judge');

/**
 * GET /api/judging/reviews
 * Judge/Admin — returns all reviews submitted by the current judge.
 */
export const GET = withAuth(async (req, { user }) => {
  try {
    const res = await query(
      'SELECT * FROM public.judge_reviews WHERE judge_id = $1',
      [user.id]
    );

    const mapped = res.rows.map((row: any) => ({
      submissionId: row.submission_id,
      judgeId: row.judge_id,
      criteria: {
        innovation: row.score_innovation,
        technical: row.score_technical,
        presentation: row.score_presentation,
        impact: row.score_impact,
      },
      feedback: row.feedback || '',
      isComplete: row.is_complete,
    }));

    return successResponse(mapped);
  } catch (err) {
    logger.error('GET /api/judging/reviews', { error: String(err) });
    return Errors.INTERNAL();
  }
}, 'judge');

