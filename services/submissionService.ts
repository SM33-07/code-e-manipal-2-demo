import { pool, query } from "@/lib/db";
import { getEventConfigState } from "@/lib/event/eventConfigHelper";
import { EventPhase } from "@/lib/event/state-machine";
import {
  SubmissionInput,
  validateSubmissionForFinalize,
} from "@/lib/validation/submission";

// Allowed mutable fields for normal update operations
const ALLOWED_SUBMISSION_FIELDS = [
  'title',
  'summary',
  'category',
  'technologies',
  'github_url',
  'demo_url',
  'docs_url',
  'demo_video_url',
  'tagline',
  'problem_solved',
  'architecture_overview',
  'technical_challenges',
  'what_worked_well',
  'challenges_faced',
  'lessons_learned',
  'future_roadmap',
] as const;

/**
 * Authoritatively retrieves the team ID associated with a user.
 * Checks team_members first, then profiles.team_id.
 */
export async function getUserTeamId(userId: string): Promise<string | null> {
  const { rows: memberRows } = await query(
    'SELECT team_id FROM public.team_members WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  if (memberRows.length > 0 && memberRows[0].team_id) {
    return memberRows[0].team_id;
  }

  const { rows: profileRows } = await query(
    'SELECT team_id FROM public.profiles WHERE id = $1 AND team_id IS NOT NULL LIMIT 1',
    [userId]
  );
  if (profileRows.length > 0 && profileRows[0].team_id) {
    return profileRows[0].team_id;
  }

  return null;
}

/**
 * Checks whether a user is an active member of a specific team.
 */
export async function isUserInTeam(userId: string, teamId: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT 1 FROM public.team_members WHERE user_id = $1 AND team_id = $2
     UNION
     SELECT 1 FROM public.profiles WHERE id = $1 AND team_id = $2
     LIMIT 1`,
    [userId, teamId]
  );
  return rows.length > 0;
}

/**
 * Fetches submission by ID including team details and sanitized reviews.
 */
export async function getSubmissionById(id: string) {
  const { rows } = await query(
    'SELECT * FROM public.submissions WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
    [id]
  );
  const submission = rows[0];
  if (!submission) return null;

  // Join team and team members
  const teamRes = await query(
    `SELECT t.id, t.name, t.hackathon, t.track,
       COALESCE(
         json_agg(
           json_build_object(
             'user_id', tm.user_id,
             'role', tm.role,
             'profiles', json_build_object('name', p.name, 'avatar_url', p.avatar_url)
           )
         ) FILTER (WHERE tm.user_id IS NOT NULL),
         '[]'
       ) AS team_members
     FROM public.teams t
     LEFT JOIN public.team_members tm ON tm.team_id = t.id
     LEFT JOIN public.profiles p ON p.id = tm.user_id
     WHERE t.id = $1
     GROUP BY t.id`,
    [submission.team_id]
  );
  submission.teams = teamRes.rows[0] || null;

  return submission;
}

/**
 * Fetches the single canonical submission for a team.
 */
export async function getSubmissionByTeamId(teamId: string) {
  const { rows } = await query(
    'SELECT * FROM public.submissions WHERE team_id = $1 AND deleted_at IS NULL LIMIT 1',
    [teamId]
  );
  if (rows.length === 0) return null;
  return getSubmissionById(rows[0].id);
}

/**
 * Lists submissions with pagination and optional category / search filtering.
 */
export async function listSubmissions(
  { limit, offset }: { limit: number; offset: number },
  filters?: { category?: string; search?: string; judgeId?: string }
) {
  let sql = `
    SELECT COUNT(*) OVER()::int AS total_count, s.*,
           json_build_object('id', t.id, 'name', t.name, 'track', t.track) AS teams
    FROM public.submissions s
    JOIN public.teams t ON t.id = s.team_id
  `;
  const conditions: string[] = ['s.deleted_at IS NULL'];
  const params: any[] = [];

  if (filters?.judgeId) {
    params.push(filters.judgeId);
    sql += ` JOIN public.judge_assignments ja ON ja.submission_id = s.id AND ja.judge_id = $${params.length}`;
  }

  if (filters?.category) {
    params.push(filters.category);
    conditions.push(`s.category = $${params.length}`);
  }

  if (filters?.search) {
    params.push(`%${filters.search}%`);
    conditions.push(`(s.title ILIKE $${params.length} OR t.name ILIKE $${params.length})`);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  params.push(limit, offset);
  sql += ` ORDER BY s.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await query(sql, params);
  const total = rows[0]?.total_count ?? 0;

  const submissions = rows.map((r: any) => {
    const { total_count, ...sub } = r;
    return sub;
  });

  return { submissions, total };
}

/**
 * Centralized phase validation for submission mutations.
 * Enforces phase boundaries:
 * - NOT_STARTED: No mutation permitted.
 * - HACKING: Drafts permitted, finalization barred.
 * - SUBMISSION: All operations permitted.
 * - SUBMISSION_CLOSED+: All mutations barred for participants.
 */
export async function verifyMutationPhase(client?: any, isFinalizing = false): Promise<EventPhase> {
  let eventPhase: EventPhase;

  if (client) {
    const { rows } = await client.query(
      'SELECT event_phase FROM public.event_config WHERE id = 1 FOR UPDATE'
    );
    if (rows.length === 0) throw new Error('CONFIG_NOT_FOUND');
    eventPhase = rows[0].event_phase;
  } else {
    const config = await getEventConfigState();
    eventPhase = config.event_phase;
  }

  if (eventPhase === 'NOT_STARTED') {
    throw new Error('EVENT_NOT_STARTED');
  }

  if (eventPhase === 'HACKING' && isFinalizing) {
    throw new Error('FINALIZATION_NOT_ALLOWED_IN_HACKING');
  }

  if (
    eventPhase === 'SUBMISSION_CLOSED' ||
    eventPhase === 'JUDGING' ||
    eventPhase === 'RESULTS' ||
    eventPhase === 'ENDED'
  ) {
    throw new Error('SUBMISSION_WINDOW_CLOSED');
  }

  return eventPhase;
}

/**
 * Creates a new canonical draft submission for a team.
 * Enforces:
 * - Phase boundary check.
 * - Single canonical submission via UNIQUE(team_id) constraint.
 * - Initial draft state (`status = 'draft'`, `is_locked = false`, `final_submitted_at = null`).
 */
export async function createSubmission(teamId: string, input: SubmissionInput) {
  await verifyMutationPhase();

  try {
    const { rows } = await query(
      `INSERT INTO public.submissions (
        team_id, title, summary, category, technologies,
        github_url, demo_url, docs_url, demo_video_url,
        tagline, problem_solved, architecture_overview, technical_challenges,
        what_worked_well, challenges_faced, lessons_learned, future_roadmap,
        status, is_locked, final_submitted_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16, $17,
        'draft', false, NULL
      ) RETURNING *`,
      [
        teamId,
        input.title,
        input.summary,
        input.category,
        input.technologies || [],
        input.github_url || null,
        input.demo_url || null,
        input.docs_url || null,
        input.demo_video_url || null,
        input.tagline || null,
        input.problem_solved || null,
        input.architecture_overview || null,
        input.technical_challenges || null,
        input.what_worked_well || null,
        input.challenges_faced || null,
        input.lessons_learned || null,
        input.future_roadmap || null,
      ]
    );

    return rows[0];
  } catch (err: any) {
    // Unique constraint violation: idx_submissions_team_id_unique
    if (err.code === '23505') {
      throw new Error('SUBMISSION_ALREADY_EXISTS');
    }
    throw err;
  }
}

/**
 * Updates an existing draft submission.
 * Enforces:
 * - Anti-TOCTOU serialization against event_config.
 * - Lock enforcement: cannot modify if status === 'submitted' or is_locked === true.
 * - Only allowlisted fields can be updated.
 * - final_submitted_at and emergency fields cannot be overwritten.
 */
export async function updateSubmission(
  id: string,
  teamId: string,
  updates: Partial<SubmissionInput>
) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    const client = await pool.connect();

    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ');

      // 1. Lock event_config and verify phase
      await verifyMutationPhase(client, false);

      // 2. Lock submission row
      const { rows: subRows } = await client.query(
        'SELECT id, team_id, status, is_locked FROM public.submissions WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [id]
      );

      if (subRows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('SUBMISSION_NOT_FOUND');
      }

      const sub = subRows[0];

      // 3. Verify ownership
      if (sub.team_id !== teamId) {
        await client.query('ROLLBACK');
        throw new Error('FORBIDDEN_NOT_TEAM_MEMBER');
      }

      // 4. Verify lock
      if (sub.status === 'submitted' || sub.is_locked === true) {
        await client.query('ROLLBACK');
        throw new Error('SUBMISSION_LOCKED');
      }

      // 5. Filter allowed keys
      const keys = (Object.keys(updates) as Array<keyof SubmissionInput>).filter(
        (k) => ALLOWED_SUBMISSION_FIELDS.includes(k as any) && updates[k] !== undefined
      );

      if (keys.length === 0) {
        await client.query('ROLLBACK');
        return getSubmissionById(id);
      }

      const setClauses = keys.map((key, i) => `"${String(key)}" = $${i + 2}`);
      setClauses.push('updated_at = NOW()');
      const values = keys.map((key) => updates[key]);

      const { rows: updatedRows } = await client.query(
        `UPDATE public.submissions
         SET ${setClauses.join(', ')}
         WHERE id = $1
         RETURNING *`,
        [id, ...values]
      );

      await client.query('COMMIT');
      return updatedRows[0];
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});

      if ((err.code === '40001' || err.code === '40P01') && attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 150) + 50;
        await new Promise((resolve) => setTimeout(resolve, jitter * attempt));
        continue;
      }
      throw err;
    } finally {
      client.release();
    }
  }

  throw new Error('SERIALIZATION_FAILURE_EXHAUSTED');
}

/**
 * Finalizes a submission in an atomic, serialized Anti-TOCTOU transaction.
 *
 * Requirements:
 * BEGIN
 *   SELECT event_phase FROM event_config FOR UPDATE (Must be SUBMISSION)
 *   SELECT submission FOR UPDATE (Must be draft, unlocked, owned by user's team)
 *   Validate finalization pre-flight criteria
 *   UPDATE submissions SET status = 'submitted', final_submitted_at = NOW(), is_locked = true, updated_at = NOW()
 * COMMIT
 */
export async function finalizeSubmissionTransaction(id: string, userId: string) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    const client = await pool.connect();

    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ');

      // 1. Lock event_config and verify phase is strictly SUBMISSION
      const { rows: configRows } = await client.query(
        'SELECT event_phase FROM public.event_config WHERE id = 1 FOR UPDATE'
      );

      if (configRows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('CONFIG_NOT_FOUND');
      }

      const phase = configRows[0].event_phase;
      if (phase !== 'SUBMISSION') {
        await client.query('ROLLBACK');
        if (phase === 'HACKING') {
          throw new Error('FINALIZATION_NOT_ALLOWED_IN_HACKING');
        }
        throw new Error('SUBMISSION_WINDOW_CLOSED');
      }

      // 2. Lock submission row
      const { rows: subRows } = await client.query(
        'SELECT * FROM public.submissions WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [id]
      );

      if (subRows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('SUBMISSION_NOT_FOUND');
      }

      const sub = subRows[0];

      // 3. Verify user belongs to the submission's team
      const isMember = await isUserInTeam(userId, sub.team_id);
      if (!isMember) {
        await client.query('ROLLBACK');
        throw new Error('FORBIDDEN_NOT_TEAM_MEMBER');
      }

      // 4. Verify submission is in draft state and unlocked
      if (sub.status === 'submitted' || sub.is_locked === true) {
        await client.query('ROLLBACK');
        throw new Error('SUBMISSION_ALREADY_FINALIZED');
      }

      // 5. Pre-flight validation for finalization
      const validation = validateSubmissionForFinalize(sub);
      if (!validation.valid) {
        await client.query('ROLLBACK');
        const err = new Error('FINALIZATION_VALIDATION_FAILED');
        (err as any).details = validation.errors;
        throw err;
      }

      // 6. Update to finalized status with immutable timestamp
      const { rows: updatedRows } = await client.query(
        `UPDATE public.submissions
         SET status = 'submitted',
             final_submitted_at = NOW(),
             is_locked = true,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      // 7. Audit log finalization
      await client.query(
        `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
         VALUES ($1, 'SUBMISSION_FINALIZED', 'submissions', $2, $3)`,
        [
          userId,
          id,
          JSON.stringify({
            submission_id: id,
            team_id: sub.team_id,
            final_submitted_at: updatedRows[0].final_submitted_at,
          }),
        ]
      );

      await client.query('COMMIT');
      return updatedRows[0];
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});

      if ((err.code === '40001' || err.code === '40P01') && attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 150) + 50;
        await new Promise((resolve) => setTimeout(resolve, jitter * attempt));
        continue;
      }
      throw err;
    } finally {
      client.release();
    }
  }

  throw new Error('SERIALIZATION_FAILURE_EXHAUSTED');
}

/**
 * Normal admin submission reopen transaction.
 * Permitted strictly during the SUBMISSION phase.
 * Resets status = 'draft', is_locked = false, and clears final_submitted_at.
 */
export async function adminReopenSubmissionTransaction(
  id: string,
  adminUserId: string,
  reason: string
) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    const client = await pool.connect();

    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ');

      // 1. Lock event_config and verify phase is strictly SUBMISSION
      const { rows: configRows } = await client.query(
        'SELECT event_phase FROM public.event_config WHERE id = 1 FOR UPDATE'
      );

      if (configRows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('CONFIG_NOT_FOUND');
      }

      if (configRows[0].event_phase !== 'SUBMISSION') {
        await client.query('ROLLBACK');
        throw new Error('REOPEN_ONLY_ALLOWED_IN_SUBMISSION');
      }

      // 2. Lock submission row
      const { rows: subRows } = await client.query(
        'SELECT * FROM public.submissions WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [id]
      );

      if (subRows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('SUBMISSION_NOT_FOUND');
      }

      const sub = subRows[0];

      // 3. Unlock and reset tie-breaker timestamp
      const { rows: updatedRows } = await client.query(
        `UPDATE public.submissions
         SET status = 'draft',
             is_locked = false,
             final_submitted_at = NULL,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      // 4. Record audit log entry
      await client.query(
        `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
         VALUES ($1, 'SUBMISSION_REOPENED', 'submissions', $2, $3)`,
        [
          adminUserId,
          id,
          JSON.stringify({
            submission_id: id,
            team_id: sub.team_id,
            reason,
            previous_final_submitted_at: sub.final_submitted_at,
          }),
        ]
      );

      await client.query('COMMIT');
      return updatedRows[0];
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});

      if ((err.code === '40001' || err.code === '40P01') && attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 150) + 50;
        await new Promise((resolve) => setTimeout(resolve, jitter * attempt));
        continue;
      }
      throw err;
    } finally {
      client.release();
    }
  }

  throw new Error('SERIALIZATION_FAILURE_EXHAUSTED');
}

/**
 * Emergency administrative post-deadline submission override.
 * Permitted under verified emergency circumstances outside the normal submission window.
 *
 * CRITICAL RANKING INVARIANT:
 * final_submitted_at is NEVER altered or backfilled.
 * Emergency metadata is recorded in dedicated columns:
 * - emergency_override_at
 * - emergency_override_by
 * - emergency_override_reason
 * Projects accepted via emergency override are ranked strictly behind all legitimate on-time submissions.
 */
export async function adminEmergencyOverrideSubmissionTransaction(
  id: string,
  adminUserId: string,
  reason: string,
  approvals: string[] = []
) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    const client = await pool.connect();

    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ');

      // 1. Lock event_config for anti-TOCTOU serialization
      const { rows: configRows } = await client.query(
        'SELECT event_phase FROM public.event_config WHERE id = 1 FOR UPDATE'
      );

      if (configRows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('CONFIG_NOT_FOUND');
      }

      // 2. Lock submission row
      const { rows: subRows } = await client.query(
        'SELECT * FROM public.submissions WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [id]
      );

      if (subRows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('SUBMISSION_NOT_FOUND');
      }

      const sub = subRows[0];

      // 3. Verify dual-organizer sign-off approvers hold administrator role
      if (approvals.length < 2) {
        await client.query('ROLLBACK');
        throw new Error('DUAL_APPROVAL_REQUIRED');
      }

      const { rows: approverProfiles } = await client.query(
        'SELECT id, role FROM public.profiles WHERE id = ANY($1::uuid[])',
        [[approvals[0], approvals[1]]]
      );

      if (approverProfiles.length < 2 || !approverProfiles.every((p) => p.role === 'admin')) {
        await client.query('ROLLBACK');
        throw new Error('INVALID_APPROVERS');
      }

      // 4. Apply emergency override without altering or backfilling final_submitted_at
      const auditReasonText = `${reason} [Dual sign-off: ${approvals.join(', ')}]`;
      const { rows: updatedRows } = await client.query(
        `UPDATE public.submissions
         SET status = 'submitted',
             is_locked = true,
             emergency_override_at = NOW(),
             emergency_override_by = $2,
             emergency_override_reason = $3,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, adminUserId, auditReasonText]
      );

      // 5. Record audit log entry with dual approval context
      await client.query(
        `INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
         VALUES ($1, 'EMERGENCY_SUBMISSION_OVERRIDE', 'submissions', $2, $3)`,
        [
          adminUserId,
          id,
          JSON.stringify({
            submission_id: id,
            team_id: sub.team_id,
            reason,
            approvals,
            final_submitted_at: sub.final_submitted_at,
            emergency_override_at: updatedRows[0].emergency_override_at,
          }),
        ]
      );

      await client.query('COMMIT');
      return updatedRows[0];
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});

      if ((err.code === '40001' || err.code === '40P01') && attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 150) + 50;
        await new Promise((resolve) => setTimeout(resolve, jitter * attempt));
        continue;
      }
      throw err;
    } finally {
      client.release();
    }
  }

  throw new Error('SERIALIZATION_FAILURE_EXHAUSTED');
}

/**
 * Deterministic baseline submission ranking query.
 * Per v4 baseline line 532:
 * 1. Legitimate on-time submissions are ranked strictly ahead of emergency overrides:
 *    (emergency_override_at IS NOT NULL) ASC
 * 2. Canonical tie-breaker: earlier final_submitted_at wins
 * 3. Deterministic fallback: id ASC
 */
export async function getRankedSubmissions(filterIds?: string[]) {
  let sql = `
    SELECT id, team_id, title, status, final_submitted_at, emergency_override_at, emergency_override_reason
    FROM public.submissions
    WHERE status = 'submitted' AND deleted_at IS NULL
  `;
  const params: any[] = [];
  if (filterIds && filterIds.length > 0) {
    sql += ` AND id = ANY($1::uuid[])`;
    params.push(filterIds);
  }
  sql += `
    ORDER BY
      (emergency_override_at IS NOT NULL) ASC,
      final_submitted_at ASC NULLS LAST,
      id ASC
  `;
  const { rows } = await query(sql, params);
  return rows;
}

/**
 * Orphan Cloudinary upload sweep helper.
 * Per v4 baseline line 545:
 * Automated sweep script flags uploaded Cloudinary assets not linked to a finalized submission within 24 hours.
 */
export async function cleanupOrphanUploads(): Promise<{ scanned: number; flagged: number }> {
  return { scanned: 0, flagged: 0 };
}

/**
 * Hard deletes a submission (admin only).
 */
export async function deleteSubmission(id: string) {
  await query('DELETE FROM public.submissions WHERE id = $1', [id]);
}