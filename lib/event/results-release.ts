/**
 * CODE-e-MANIPAL 2.0 — Results Release Engine & Snapshot Materialization
 *
 * Implements:
 * 1. DRAFT → PUBLISHING → PUBLISHED buffer engine
 * 2. Shared, side-effect-free getEffectiveResultsRelease()
 * 3. publish_at countdown semantics
 * 4. Atomic & idempotent results snapshot materialization
 * 5. Strictly release-bound background worker reconciliation
 *
 * Per IMPLEMENTATION_BASELINE_v4_FINAL.md (Phase 3).
 */

import crypto from 'crypto';
import { pool, query } from '../db';
import { checkJudgingCompleteness } from './state-machine';
import { logAudit } from '../auth/telemetry';
import { logger } from '../utils/logger';

export const RESULTS_RELEASES = ['DRAFT', 'PUBLISHING', 'PUBLISHED'] as const;
export type ResultsReleaseState = (typeof RESULTS_RELEASES)[number];

export interface ResultsReleaseConfig {
  results_release: ResultsReleaseState | string;
  publish_at: string | Date | null;
  active_release_id?: string | null;
  buffer_minutes?: number;
}

/**
 * Shared, strictly read-only helper to compute the effective results release status.
 *
 * When results_release is 'PUBLISHING' and the current time has passed publish_at,
 * the effective release status becomes 'PUBLISHED' immediately and deterministically,
 * WITHOUT waiting for background workers and WITHOUT triggering any database writes.
 *
 * @param config - Current configuration containing results_release and publish_at
 * @param now - Reference timestamp (defaults to current system time)
 * @returns Effective ResultsReleaseState ('DRAFT', 'PUBLISHING', or 'PUBLISHED')
 */
export function getEffectiveResultsRelease(
  config: ResultsReleaseConfig,
  now: Date = new Date()
): ResultsReleaseState {
  const stored = (config.results_release as ResultsReleaseState) || 'DRAFT';

  if (stored === 'PUBLISHING' && config.publish_at) {
    const publishTime = new Date(config.publish_at).getTime();
    if (!isNaN(publishTime) && now.getTime() >= publishTime) {
      return 'PUBLISHED';
    }
  }

  return stored;
}

export interface MaterializeSnapshotResult {
  status: ResultsReleaseState;
  releaseId: string;
  publishAt: string;
  bufferMinutes: number;
  isIdempotentReplay: boolean;
  totalRanked: number;
}

/**
 * Atomically materializes the mathematical results snapshot.
 *
 * Invariants:
 * 1. Strictly serializable via SELECT ... FOR UPDATE.
 * 2. Idempotent: If effective release is already 'PUBLISHING' or 'PUBLISHED', returns
 *    existing release metadata without regenerating.
 * 3. Independent judging gate: If in 'DRAFT', independently verifies judging completeness.
 *    Even if event_phase is forced to RESULTS via emergency override, publication strictly
 *    aborts if judging is incomplete.
 * 4. Generates immutable results_snapshot, initializes results_awards, and sets buffer countdown.
 */
export async function materializeResultsSnapshot(
  adminUserId: string
): Promise<MaterializeSnapshotResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');

    // 1. Lock event_config row
    const { rows: configRows } = await client.query(
      'SELECT * FROM public.event_config WHERE id = 1 FOR UPDATE'
    );

    if (configRows.length === 0) {
      throw new Error('Event configuration record (id=1) not found.');
    }

    const config = configRows[0];
    const now = new Date();
    const effectiveStatus = getEffectiveResultsRelease(config, now);

    // 2. Idempotency Check: Already PUBLISHED or PUBLISHING
    if (effectiveStatus === 'PUBLISHED' || effectiveStatus === 'PUBLISHING') {
      await client.query('COMMIT');
      logger.info('Publish endpoint called idempotently', {
        effectiveStatus,
        activeReleaseId: config.active_release_id,
      });

      return {
        status: effectiveStatus,
        releaseId: config.active_release_id || '',
        publishAt: config.publish_at ? new Date(config.publish_at).toISOString() : '',
        bufferMinutes: config.buffer_minutes || 5,
        isIdempotentReplay: true,
        totalRanked: 0,
      };
    }

    // 3. Independent Judging Gate Enforcement (ADR-011 / Phase 3)
    const judgingStatus = await checkJudgingCompleteness();
    if (!judgingStatus.isComplete) {
      await client.query('ROLLBACK');
      const err = new Error(
        `Cannot publish results: judging is incomplete. ${judgingStatus.reasons.join('; ')}`
      ) as any;
      err.code = 'JUDGING_INCOMPLETE';
      err.details = judgingStatus;
      throw err;
    }

    // 4. Compute official scores and rankings from public.get_ranked_results
    const { rows: rankedRows } = await client.query(
      'SELECT * FROM public.get_ranked_results(NULL, 1)'
    );

    const releaseId = crypto.randomUUID();
    const bufferMinutes = config.buffer_minutes || 5;
    const publishAt = new Date(Date.now() + bufferMinutes * 60 * 1000);

    const snapshotPayload = {
      release_id: releaseId,
      generated_at: now.toISOString(),
      generated_by: adminUserId,
      buffer_minutes: bufferMinutes,
      total_submissions: rankedRows.length,
      rankings: rankedRows,
    };

    // 5. Insert immutable results_snapshot
    await client.query(
      `INSERT INTO public.results_snapshot (release_id, snapshot_payload, created_at, created_by)
       VALUES ($1, $2, NOW(), $3)`,
      [releaseId, JSON.stringify(snapshotPayload), adminUserId]
    );

    // 6. Initialize corresponding results_awards overlay
    await client.query(
      `INSERT INTO public.results_awards (release_id, award_overlay, updated_at, updated_by)
       VALUES ($1, '{}'::jsonb, NOW(), $2)`,
      [releaseId, adminUserId]
    );

    // 7. Update event_config to PUBLISHING state with countdown
    await client.query(
      `UPDATE public.event_config SET
         active_release_id = $1,
         results_release = 'PUBLISHING',
         publish_at = $2,
         event_phase = 'RESULTS',
         updated_at = NOW()
       WHERE id = 1`,
      [releaseId, publishAt.toISOString()]
    );

    await client.query('COMMIT');

    // 8. Log audit record
    logAudit({
      userId: adminUserId,
      action: 'RESULTS_PUBLISH_INITIATED',
      targetTable: 'results_snapshot',
      targetId: releaseId,
      details: {
        releaseId,
        bufferMinutes,
        publishAt: publishAt.toISOString(),
        rankedCount: rankedRows.length,
      },
    }).catch(() => {});

    logger.info('Results snapshot materialized successfully', {
      releaseId,
      bufferMinutes,
      publishAt: publishAt.toISOString(),
    });

    return {
      status: 'PUBLISHING',
      releaseId,
      publishAt: publishAt.toISOString(),
      bufferMinutes,
      isIdempotentReplay: false,
      totalRanked: rankedRows.length,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignored
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Reconciles the database results_release column once publish_at has passed.
 *
 * Strict Release-Binding Invariant:
 * The worker is bound to the specific release_id it was scheduled for.
 * If the release was rolled back to JUDGING and active_release_id was cleared,
 * 0 rows are updated and the worker exits cleanly without stomping state.
 *
 * @param releaseId - The release_id bound to this worker run
 * @returns boolean indicating whether reconciliation updated the row
 */
export async function reconcilePublishWorker(releaseId: string): Promise<boolean> {
  try {
    const { rowCount } = await query(
      `UPDATE public.event_config
       SET results_release = 'PUBLISHED',
           updated_at = NOW()
       WHERE event_phase = 'RESULTS'
         AND results_release = 'PUBLISHING'
         AND active_release_id = $1
         AND publish_at IS NOT NULL
         AND NOW() >= publish_at`,
      [releaseId]
    );

    return (rowCount ?? 0) > 0;
  } catch (err) {
    logger.error('reconcilePublishWorker failed', { releaseId, error: String(err) });
    return false;
  }
}
