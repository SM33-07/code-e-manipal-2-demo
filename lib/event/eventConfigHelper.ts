import { query } from '@/lib/db';
import { getEffectiveResultsRelease, ResultsReleaseState } from './results-release';
import { EventPhase } from './state-machine';

export interface EventConfigState {
  id: number;
  event_phase: EventPhase;
  results_release: ResultsReleaseState;
  publish_at: string | null;
  buffer_minutes: number;
  active_release_id: string | null;
  start_time: string | null;
  end_time: string | null;
  /** Explicit release gate for challenge content; intentionally independent of event_phase. */
  problem_statements_published: boolean;
  updated_at: string;
  // Computed legacy compatibility fields
  hackathon_is_started: string;
  hackathon_start_time: string | null;
  hackathon_duration_hours: string;
  results_published: string;
  results_publish_time: string | null;
}

/**
 * Public Allowlisted Response Contract (ADR-011 / Phase 3)
 * Strictly strips internal metadata, database IDs, and active_release_id.
 */
export interface PublicEventConfig {
  event_phase: EventPhase;
  results_release: ResultsReleaseState;
  start_time: string | null;
  end_time: string | null;
  publish_at: string | null;
  countdown_target: string | null;
  announcements: Array<{
    id: string;
    title: string;
    content: string;
    priority: string;
    created_at: string;
  }>;
  active_round: string;
  problem_statements_published: boolean;
}

/**
 * Universal Event Config Loader:
 * Reads event_config state and computes effective release status without database writes.
 */
export async function getEventConfigState(): Promise<EventConfigState> {
  const now = new Date();

  try {
    // 1. Attempt structured singleton query (Post-Migration Schema)
    const { rows } = await query('SELECT * FROM public.event_config WHERE id = 1 LIMIT 1');
    if (rows.length > 0 && 'event_phase' in rows[0]) {
      const row = rows[0];
      const effectiveRelease = getEffectiveResultsRelease(
        {
          results_release: row.results_release,
          publish_at: row.publish_at,
          active_release_id: row.active_release_id,
          buffer_minutes: row.buffer_minutes,
        },
        now
      );

      const isStarted = row.event_phase !== 'NOT_STARTED';
      let legacyRelease = 'false';
      if (effectiveRelease === 'PUBLISHED') legacyRelease = 'true';
      else if (effectiveRelease === 'PUBLISHING') legacyRelease = 'publishing';

      return {
        id: 1,
        event_phase: row.event_phase,
        results_release: effectiveRelease,
        publish_at: row.publish_at ? new Date(row.publish_at).toISOString() : null,
        buffer_minutes: row.buffer_minutes || 5,
        active_release_id: row.active_release_id || null,
        start_time: row.start_time ? new Date(row.start_time).toISOString() : null,
        end_time: row.end_time ? new Date(row.end_time).toISOString() : null,
        problem_statements_published: row.problem_statements_published === true,
        updated_at: new Date(row.updated_at).toISOString(),
        // Legacy computed fields
        hackathon_is_started: isStarted ? 'true' : 'false',
        hackathon_start_time: row.start_time ? new Date(row.start_time).toISOString() : null,
        hackathon_duration_hours: '48',
        results_published: legacyRelease,
        results_publish_time: row.publish_at ? new Date(row.publish_at).toISOString() : null,
      };
    }
  } catch (err: any) {
    // If column "event_phase" does not exist or table is key-value, fall through to KV loader
  }

  // 2. Fallback to Legacy Key-Value query (Pre-Migration Schema)
  try {
    const { rows } = await query('SELECT key, value FROM public.event_config');
    const kv = rows.reduce((acc: Record<string, string>, r: any) => {
      acc[r.key] = r.value;
      return acc;
    }, {});

    const isStarted = kv.hackathon_is_started === 'true';
    let phase: EventPhase = isStarted ? 'HACKING' : 'NOT_STARTED';
    let rawRelease: ResultsReleaseState = 'DRAFT';

    if (kv.results_published === 'true') {
      phase = 'RESULTS';
      rawRelease = 'PUBLISHED';
    } else if (kv.results_published === 'publishing') {
      phase = 'RESULTS';
      rawRelease = 'PUBLISHING';
    }

    const effectiveRelease = getEffectiveResultsRelease(
      { results_release: rawRelease, publish_at: kv.results_publish_time || null },
      now
    );

    return {
      id: 1,
      event_phase: phase,
      results_release: effectiveRelease,
      publish_at: kv.results_publish_time || null,
      buffer_minutes: 5,
      active_release_id: null,
      start_time: kv.hackathon_start_time || null,
      end_time: null,
      problem_statements_published: kv.problem_statements_published === 'true',
      updated_at: new Date().toISOString(),
      hackathon_is_started: kv.hackathon_is_started || 'false',
      hackathon_start_time: kv.hackathon_start_time || null,
      hackathon_duration_hours: kv.hackathon_duration_hours || '48',
      results_published: effectiveRelease === 'PUBLISHED' ? 'true' : effectiveRelease === 'PUBLISHING' ? 'publishing' : 'false',
      results_publish_time: kv.results_publish_time || null,
    };
  } catch (err: any) {
    // Return sensible defaults if database unreachable during cold start
    return {
      id: 1,
      event_phase: 'NOT_STARTED',
      results_release: 'DRAFT',
      publish_at: null,
      buffer_minutes: 5,
      active_release_id: null,
      start_time: null,
      end_time: null,
      problem_statements_published: false,
      updated_at: new Date().toISOString(),
      hackathon_is_started: 'false',
      hackathon_start_time: null,
      hackathon_duration_hours: '48',
      results_published: 'false',
      results_publish_time: null,
    };
  }
}

/**
 * Returns the strictly allowlisted public representation of the event configuration.
 *
 * Conforms 100% to IMPLEMENTATION_BASELINE_v4_FINAL.md:
 * Exactly the public operational fields required by the portal, including the
 * explicit challenge-publication gate (which contains no challenge content).
 * - event_phase
 * - results_release
 * - start_time
 * - end_time
 * - publish_at
 * - countdown_target
 * - announcements
 * - active_round
 */
export async function getPublicEventConfig(): Promise<PublicEventConfig> {
  const fullConfig = await getEventConfigState();

  // Determine countdown target based on current phase and release state
  let countdownTarget: string | null = null;
  if (fullConfig.event_phase === 'NOT_STARTED' && fullConfig.start_time) {
    countdownTarget = fullConfig.start_time;
  } else if (fullConfig.event_phase === 'HACKING' && fullConfig.end_time) {
    countdownTarget = fullConfig.end_time;
  } else if (fullConfig.event_phase === 'RESULTS' && fullConfig.results_release === 'PUBLISHING' && fullConfig.publish_at) {
    countdownTarget = fullConfig.publish_at;
  }

  // Fetch active announcements
  let announcements: PublicEventConfig['announcements'] = [];
  try {
    const { rows } = await query(
      `SELECT id, title, content, priority, created_at
       FROM public.announcements
       WHERE is_active = true
       ORDER BY created_at DESC`
    );
    announcements = rows.map((r: any) => ({
      id: r.id,
      title: r.title || '',
      content: r.content,
      priority: r.priority || 'NORMAL',
      created_at: r.created_at ? new Date(r.created_at).toISOString() : '',
    }));
  } catch {
    announcements = [];
  }

  return {
    event_phase: fullConfig.event_phase,
    results_release: fullConfig.results_release,
    start_time: fullConfig.start_time,
    end_time: fullConfig.end_time,
    publish_at: fullConfig.publish_at,
    countdown_target: countdownTarget,
    announcements,
    active_round: '1',
    problem_statements_published: fullConfig.problem_statements_published,
  };
}
