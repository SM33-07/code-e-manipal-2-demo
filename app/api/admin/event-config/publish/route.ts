import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, Errors } from '@/lib/utils/response';
import { logger } from '@/lib/utils/logger';
import { materializeResultsSnapshot } from '@/lib/event/results-release';

/**
 * POST /api/admin/event-config/publish
 *
 * Admin only — Initiates results publication and snapshot materialization.
 *
 * Invariants:
 * 1. Executes in a serializable transaction with SELECT ... FOR UPDATE.
 * 2. Idempotent: If results are already PUBLISHED or PUBLISHING, returns existing
 *    countdown / release without regenerating or re-materializing.
 * 3. Independent judging gate: If in DRAFT, strictly and independently checks judging
 *    completeness. Even if event_phase is forced to RESULTS via emergency override,
 *    this endpoint strictly aborts if judging is incomplete.
 * 4. Materializes immutable results_snapshot, initializes results_awards, and sets
 *    results_release = 'PUBLISHING' with countdown publish_at.
 */
export const POST = withAuth(async (req: NextRequest, { user }: { user: any }) => {
  try {
    const result = await materializeResultsSnapshot(user.id);

    return successResponse({
      message: result.isIdempotentReplay
        ? `Results release is already in progress or published (${result.status}).`
        : 'Results snapshot materialized successfully. Buffer countdown initiated.',
      status: result.status,
      release_id: result.releaseId,
      publish_at: result.publishAt,
      buffer_minutes: result.bufferMinutes,
      is_idempotent_replay: result.isIdempotentReplay,
      total_ranked: result.totalRanked,
    });
  } catch (err: any) {
    if (err.code === 'JUDGING_INCOMPLETE') {
      logger.warn('Results publication aborted due to incomplete judging', {
        reasons: err.details?.reasons,
      });
      return Errors.BAD_REQUEST(err.message, err.details);
    }

    logger.error('POST /api/admin/event-config/publish failed', { error: String(err) });
    return Errors.INTERNAL('Failed to publish results.');
  }
}, 'admin');
