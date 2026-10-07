import { PoolClient } from 'pg';
import { pool, query } from '@/lib/db';
import { JudgeReview, ReviewHistoryEntry } from '@/types';
import { logger } from '@/lib/utils/logger';

export interface ScorePayload {
  score_innovation?: number | null;
  score_technical?: number | null;
  score_presentation?: number | null;
  score_impact?: number | null;
}

export interface ReviewSaveParams {
  submission_id: string;
  judge_id: string;
  actor_id: string;
  actor_role: string;
  scores: ScorePayload;
  feedback?: string | null;
  is_complete?: boolean;
  expected_version: number;
  reason?: string;
}

export interface ReviewUpdateByIdParams {
  id: string;
  actor_id: string;
  actor_role: string;
  scores: ScorePayload;
  feedback?: string | null;
  is_complete?: boolean;
  expected_version: number;
  reason?: string;
}

export interface ReviewReopenParams {
  id: string;
  admin_id: string;
  reason: string;
  expected_version?: number;
  scores?: ScorePayload;
  feedback?: string | null;
}

export class ConcurrencyError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrencyError';
    this.statusCode = 409;
    this.code = 'CONFLICT';
  }
}

export class PhaseFrozenError extends Error {
  statusCode: number;
  code: string;
  constructor(message = 'Judging phase is closed; scores are frozen') {
    super(message);
    this.name = 'PhaseFrozenError';
    this.statusCode = 403;
    this.code = 'FORBIDDEN';
  }
}

export class ReviewLockedError extends Error {
  statusCode: number;
  code: string;
  constructor(message = 'This review is finalised and locked. Contact an admin to re-open it.') {
    super(message);
    this.name = 'ReviewLockedError';
    this.statusCode = 403;
    this.code = 'FORBIDDEN';
  }
}

export class ForbiddenReviewError extends Error {
  statusCode: number;
  code: string;
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenReviewError';
    this.statusCode = 403;
    this.code = 'FORBIDDEN';
  }
}

export class NotFoundReviewError extends Error {
  statusCode: number;
  code: string;
  constructor(message = 'Review not found') {
    super(message);
    this.name = 'NotFoundReviewError';
    this.statusCode = 404;
    this.code = 'NOT_FOUND';
  }
}

/**
 * Server-side score calculator based on rubric weights (1.0 each default).
 * Ignores any client-submitted totals.
 */
export function calculateTotalScore(scores: {
  score_innovation?: number | null;
  score_technical?: number | null;
  score_presentation?: number | null;
  score_impact?: number | null;
}): number {
  const s1 = typeof scores.score_innovation === 'number' ? scores.score_innovation : 0;
  const s2 = typeof scores.score_technical === 'number' ? scores.score_technical : 0;
  const s3 = typeof scores.score_presentation === 'number' ? scores.score_presentation : 0;
  const s4 = typeof scores.score_impact === 'number' ? scores.score_impact : 0;
  return s1 + s2 + s3 + s4;
}

/**
 * Transaction executor with exponential backoff & randomized jitter (50ms–200ms)
 * for PostgreSQL serialization conflicts (40001) and deadlocks (40P01).
 */
export async function withTransactionRetry<T>(
  operation: (client: PoolClient) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let attempt = 0;
  while (true) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (err: any) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback failure on connection termination
      }

      const isRetryable = err.code === '40001' || err.code === '40P01';
      if (isRetryable && attempt < maxRetries) {
        attempt++;
        const jitter = Math.floor(50 + Math.random() * 150); // 50ms - 200ms
        const delay = Math.min(jitter * Math.pow(2, attempt - 1), 1000);
        logger.warn('Retrying transaction due to serialization conflict or deadlock', {
          code: err.code,
          attempt,
          delayMs: delay,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (isRetryable) {
        throw new ConcurrencyError(
          'Review was modified elsewhere. Please refresh to load latest scores.'
        );
      }

      throw err;
    } finally {
      client.release();
    }
  }
}

/**
 * Transactional upsert of a judge review with phase locking, optimistic concurrency,
 * and immutable historical archiving.
 */
export async function saveReviewTransactional(params: ReviewSaveParams): Promise<JudgeReview> {
  return withTransactionRetry(async (client) => {
    // 1. Atomic Phase-Locked Transaction (Anti-TOCTOU Invariant)
    const phaseRes = await client.query(
      'SELECT event_phase FROM public.event_config WHERE id = 1 FOR UPDATE'
    );
    if (phaseRes.rows.length === 0 || phaseRes.rows[0].event_phase !== 'JUDGING') {
      throw new PhaseFrozenError('Judging phase is closed; scores are frozen');
    }

    // 2. Assignment Check (requireJudgeAssignment)
    if (params.actor_role !== 'admin') {
      const assignRes = await client.query(
        'SELECT 1 FROM public.judge_assignments WHERE judge_id = $1 AND submission_id = $2 LIMIT 1',
        [params.judge_id, params.submission_id]
      );
      if (assignRes.rows.length === 0) {
        throw new ForbiddenReviewError('Judge is not assigned to this submission');
      }
    }

    // 3. Lock review row
    const existingRes = await client.query(
      'SELECT * FROM public.judge_reviews WHERE submission_id = $1 AND judge_id = $2 FOR UPDATE',
      [params.submission_id, params.judge_id]
    );

    const existing = existingRes.rows[0];

    if (existing) {
      // Judges may revise their own submitted review during JUDGING; admins use the audited reopen path.
      if (existing.is_complete && params.actor_role === 'admin') {
        throw new ReviewLockedError(
          'This review is finalised and locked. Contact an admin to re-open it.'
        );
      }
      if (existing.is_complete && params.actor_role !== 'admin' && params.is_complete === false) {
        throw new ForbiddenReviewError('A submitted review cannot be reverted to a draft');
      }

      // Optimistic Concurrency Check
      if (existing.version !== params.expected_version) {
        throw new ConcurrencyError(
          'Review was modified elsewhere. Please refresh to load latest scores.'
        );
      }

      // Archive current review state into review_history before updating
      const previousScores = {
        score_innovation: existing.score_innovation,
        score_technical: existing.score_technical,
        score_presentation: existing.score_presentation,
        score_impact: existing.score_impact,
        total: calculateTotalScore(existing),
      };

      await client.query(
        `INSERT INTO public.review_history (
          review_id, submission_id, judge_id, round, version,
          previous_scores, previous_feedback, changed_by, reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          existing.id,
          existing.submission_id,
          existing.judge_id,
          '1',
          existing.version,
          JSON.stringify(previousScores),
          existing.feedback || null,
          params.actor_id,
          params.reason || (
            existing.is_complete
              ? 'Judge review revision'
              : params.is_complete
                ? 'Judge evaluation submission'
                : 'Judge evaluation autosave'
          ),
        ]
      );

      // Update review
      const updateRes = await client.query(
        `UPDATE public.judge_reviews
         SET score_innovation = COALESCE($1, score_innovation),
             score_technical = COALESCE($2, score_technical),
             score_presentation = COALESCE($3, score_presentation),
             score_impact = COALESCE($4, score_impact),
             feedback = COALESCE($5, feedback),
             is_complete = COALESCE($6, is_complete),
             version = version + 1,
             updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [
          params.scores.score_innovation !== undefined ? params.scores.score_innovation : null,
          params.scores.score_technical !== undefined ? params.scores.score_technical : null,
          params.scores.score_presentation !== undefined ? params.scores.score_presentation : null,
          params.scores.score_impact !== undefined ? params.scores.score_impact : null,
          params.feedback !== undefined ? params.feedback : null,
          params.is_complete !== undefined ? params.is_complete : null,
          existing.id,
        ]
      );

      const updated = updateRes.rows[0];

      // Sync submission status if completed
      if (params.is_complete) {
        await client.query(
          'UPDATE public.submissions SET status = $1, updated_at = NOW() WHERE id = $2',
          ['reviewed', params.submission_id]
        );
      } else {
        await client.query(
          "UPDATE public.submissions SET status = 'under_review', updated_at = NOW() WHERE id = $1 AND status != 'reviewed'",
          [params.submission_id]
        );
      }

      return {
        ...updated,
        total_score: calculateTotalScore(updated),
      };
    } else {
      // First review record creation
      if (
        params.expected_version !== 0
      ) {
        throw new ConcurrencyError(
          'Review was modified elsewhere. Please refresh to load latest scores.'
        );
      }

      const insertRes = await client.query(
        `INSERT INTO public.judge_reviews (
          submission_id, judge_id, score_innovation, score_technical,
          score_presentation, score_impact, feedback, is_complete, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
        RETURNING *`,
        [
          params.submission_id,
          params.judge_id,
          params.scores.score_innovation ?? null,
          params.scores.score_technical ?? null,
          params.scores.score_presentation ?? null,
          params.scores.score_impact ?? null,
          params.feedback ?? null,
          Boolean(params.is_complete),
        ]
      );

      const created = insertRes.rows[0];

      if (params.is_complete) {
        await client.query(
          'UPDATE public.submissions SET status = $1, updated_at = NOW() WHERE id = $2',
          ['reviewed', params.submission_id]
        );
      } else {
        await client.query(
          "UPDATE public.submissions SET status = 'under_review', updated_at = NOW() WHERE id = $1 AND status != 'reviewed'",
          [params.submission_id]
        );
      }

      return {
        ...created,
        total_score: calculateTotalScore(created),
      };
    }
  });
}

/**
 * Transactional update of a review by ID with assignment/ownership checks,
 * version check, and history archive.
 */
export async function updateReviewByIdTransactional(
  params: ReviewUpdateByIdParams
): Promise<JudgeReview> {
  // Single Administrative Path: Admins cannot modify reviews through generic update path
  if (params.actor_role === 'admin') {
    throw new ForbiddenReviewError(
      'Admins cannot modify reviews through the generic update endpoint. Use /api/admin/reviews/[id]/reopen.'
    );
  }

  return withTransactionRetry(async (client) => {
    // 1. Atomic Phase-Locked Transaction (Anti-TOCTOU Invariant)
    const phaseRes = await client.query(
      'SELECT event_phase FROM public.event_config WHERE id = 1 FOR UPDATE'
    );
    if (phaseRes.rows.length === 0 || phaseRes.rows[0].event_phase !== 'JUDGING') {
      throw new PhaseFrozenError('Judging phase is closed; scores are frozen');
    }

    // 2. Lock review row
    const existingRes = await client.query(
      'SELECT * FROM public.judge_reviews WHERE id = $1 FOR UPDATE',
      [params.id]
    );

    if (existingRes.rows.length === 0) {
      throw new NotFoundReviewError('Review not found');
    }

    const existing = existingRes.rows[0];

    // Ownership check: Judge cannot modify another judge's review
    if (existing.judge_id !== params.actor_id) {
      throw new ForbiddenReviewError("Cannot modify another judge's review");
    }

    if (existing.is_complete && params.is_complete === false) {
      throw new ForbiddenReviewError('A submitted review cannot be reverted to a draft');
    }

    const assignmentRes = await client.query(
      'SELECT 1 FROM public.judge_assignments WHERE judge_id = $1 AND submission_id = $2 LIMIT 1 FOR KEY SHARE',
      [params.actor_id, existing.submission_id]
    );
    if (assignmentRes.rows.length === 0) {
      throw new ForbiddenReviewError('Judge is not assigned to this submission');
    }

    // Optimistic Concurrency Check
    if (existing.version !== params.expected_version) {
      throw new ConcurrencyError(
        'Review was modified elsewhere. Please refresh to load latest scores.'
      );
    }

    // Archive current scores to review_history
    const previousScores = {
      score_innovation: existing.score_innovation,
      score_technical: existing.score_technical,
      score_presentation: existing.score_presentation,
      score_impact: existing.score_impact,
      total: calculateTotalScore(existing),
    };

    await client.query(
      `INSERT INTO public.review_history (
        review_id, submission_id, judge_id, round, version,
        previous_scores, previous_feedback, changed_by, reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        existing.id,
        existing.submission_id,
        existing.judge_id,
        '1',
        existing.version,
        JSON.stringify(previousScores),
        existing.feedback || null,
        params.actor_id,
        params.reason || (
          existing.is_complete
            ? 'Judge review revision'
            : params.is_complete
              ? 'Judge evaluation submission'
              : 'Judge evaluation update'
        ),
      ]
    );

    // Update review
    const updateRes = await client.query(
      `UPDATE public.judge_reviews
       SET score_innovation = COALESCE($1, score_innovation),
           score_technical = COALESCE($2, score_technical),
           score_presentation = COALESCE($3, score_presentation),
           score_impact = COALESCE($4, score_impact),
           feedback = COALESCE($5, feedback),
           is_complete = COALESCE($6, is_complete),
           version = version + 1,
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        params.scores.score_innovation !== undefined ? params.scores.score_innovation : null,
        params.scores.score_technical !== undefined ? params.scores.score_technical : null,
        params.scores.score_presentation !== undefined ? params.scores.score_presentation : null,
        params.scores.score_impact !== undefined ? params.scores.score_impact : null,
        params.feedback !== undefined ? params.feedback : null,
        params.is_complete !== undefined ? params.is_complete : null,
        existing.id,
      ]
    );

    const updated = updateRes.rows[0];

    // Sync submission status if completed
    if (params.is_complete) {
      await client.query(
        'UPDATE public.submissions SET status = $1, updated_at = NOW() WHERE id = $2',
        ['reviewed', existing.submission_id]
      );
    }

    return {
      ...updated,
      total_score: calculateTotalScore(updated),
    };
  });
}

/**
 * Dedicated administrative score correction / reopen workflow.
 * Strictly permitted during JUDGING phase only.
 * Archives current score row to review_history with mandatory reason and ON DELETE RESTRICT integrity.
 * Increments version, sets is_complete = false, and records in audit_logs.
 */
export async function reopenReviewTransactional(params: ReviewReopenParams): Promise<JudgeReview> {
  if (!params.reason || typeof params.reason !== 'string' || params.reason.trim().length < 5) {
    const err = new Error('A valid reason (minimum 5 characters) is required to reopen a review') as any;
    err.statusCode = 400;
    err.code = 'BAD_REQUEST';
    throw err;
  }

  return withTransactionRetry(async (client) => {
    // 1. Atomic Phase-Locked Transaction (Post-Judging Review Freeze)
    // Once event_phase = 'RESULTS', reviews are 100% immutable to judges and admins.
    const phaseRes = await client.query(
      'SELECT event_phase FROM public.event_config WHERE id = 1 FOR UPDATE'
    );
    if (phaseRes.rows.length === 0 || phaseRes.rows[0].event_phase !== 'JUDGING') {
      throw new PhaseFrozenError(
        'Judging phase is closed; scores are frozen. Administrative review corrections are permitted strictly during the JUDGING phase.'
      );
    }

    // 2. Lock review row
    const existingRes = await client.query(
      'SELECT * FROM public.judge_reviews WHERE id = $1 FOR UPDATE',
      [params.id]
    );

    if (existingRes.rows.length === 0) {
      throw new NotFoundReviewError('Review not found');
    }

    const existing = existingRes.rows[0];

    // Optimistic Concurrency Check
    if (
      params.expected_version !== undefined &&
      params.expected_version !== null &&
      existing.version !== params.expected_version
    ) {
      throw new ConcurrencyError(
        'Review was modified elsewhere. Please refresh to load latest scores.'
      );
    }

    // 3. Archive current state into review_history (ADR-005)
    const previousScores = {
      score_innovation: existing.score_innovation,
      score_technical: existing.score_technical,
      score_presentation: existing.score_presentation,
      score_impact: existing.score_impact,
      total: calculateTotalScore(existing),
    };

    await client.query(
      `INSERT INTO public.review_history (
        review_id, submission_id, judge_id, round, version,
        previous_scores, previous_feedback, changed_by, reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        existing.id,
        existing.submission_id,
        existing.judge_id,
        '1',
        existing.version,
        JSON.stringify(previousScores),
        existing.feedback || null,
        params.admin_id,
        params.reason.trim(),
      ]
    );

    // 4. Update review: unlock (is_complete = false), apply corrections if provided, bump version
    const updateRes = await client.query(
      `UPDATE public.judge_reviews
       SET is_complete = false,
           score_innovation = COALESCE($1, score_innovation),
           score_technical = COALESCE($2, score_technical),
           score_presentation = COALESCE($3, score_presentation),
           score_impact = COALESCE($4, score_impact),
           feedback = COALESCE($5, feedback),
           version = version + 1,
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        params.scores?.score_innovation !== undefined ? params.scores.score_innovation : null,
        params.scores?.score_technical !== undefined ? params.scores.score_technical : null,
        params.scores?.score_presentation !== undefined ? params.scores.score_presentation : null,
        params.scores?.score_impact !== undefined ? params.scores.score_impact : null,
        params.feedback !== undefined ? params.feedback : null,
        existing.id,
      ]
    );

    const updated = updateRes.rows[0];

    // 5. Update submission status back to under_review if needed
    await client.query(
      'UPDATE public.submissions SET status = $1, updated_at = NOW() WHERE id = $2',
      ['under_review', existing.submission_id]
    );

    // 6. Record operation in append-only audit_logs
    await client.query(
      `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        params.admin_id,
        'REVIEW_REOPENED',
        'judge_reviews',
        existing.id,
        JSON.stringify({
          reason: params.reason.trim(),
          submission_id: existing.submission_id,
          judge_id: existing.judge_id,
          previous_version: existing.version,
          new_version: updated.version,
          scores_corrected: Boolean(params.scores),
        }),
      ]
    );

    logger.info('Admin reopened review', {
      reviewId: existing.id,
      adminId: params.admin_id,
      reason: params.reason.trim(),
      version: updated.version,
    });

    return {
      ...updated,
      total_score: calculateTotalScore(updated),
    };
  });
}

/**
 * Fetch immutable review history audit trail for a review
 */
export async function getReviewHistory(reviewId: string): Promise<ReviewHistoryEntry[]> {
  const res = await query(
    `SELECT rh.*, json_build_object('name', p.name, 'email', p.email) AS changed_by_profile
     FROM public.review_history rh
     LEFT JOIN public.profiles p ON p.id = rh.changed_by
     WHERE rh.review_id = $1
     ORDER BY rh.version ASC, rh.changed_at ASC`,
    [reviewId]
  );
  return res.rows as ReviewHistoryEntry[];
}
